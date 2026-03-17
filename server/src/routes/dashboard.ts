import { Router } from 'express';
import { DashboardData } from '../types.js';
import {
  countTasksByStatus,
  getTasksCompletedToday,
  getRecentTasks,
  getTasksByAssignee,
} from '../services/taskStorage.js';
import { getTokenUsageToday, getTokenUsageAll, getTokenCostToday, getTokenUsageTimeSeries } from '../services/tokenTracker.js';
import { scanAllSessions } from '../services/tokenScanner.js';
import { getAllAgents } from '../services/agentStorage.js';
import { isMayorOnline, isMayorEnabled, setMayorEnabled, ensureMayorRunning, stopMayor, getMayorSessionId, getMayorProjectPath, sendToMayor } from '../services/mayorService.js';
import { isWitnessRunning, getWitnessLastCheck } from '../services/witnessService.js';
import { getNgrokStatus } from '../services/ngrokStatus.js';
import { getAllMessages, createMessage, getUnreadCount } from '../services/messageStorage.js';

const router = Router();

// GET /api/dashboard — aggregated dashboard data
router.get('/', async (_req, res) => {
  try {
    const agents = getAllAgents();
    const activeAgents = agents.map(agent => {
      const tasks = getTasksByAssignee(agent.id);
      return {
        agent,
        runningSessions: tasks.filter(t => t.status === 'running').length,
        waitingSessions: tasks.filter(t => t.status === 'waiting').length,
      };
    }).filter(a => a.runningSessions > 0 || a.waitingSessions > 0);

    const ngrokStatus = await getNgrokStatus();

    const data: DashboardData = {
      running: countTasksByStatus('running'),
      waiting: countTasksByStatus('waiting'),
      doneToday: getTasksCompletedToday().length,
      failed: countTasksByStatus('failed'),
      tokenUsageToday: getTokenUsageToday(),
      tokenCostToday: getTokenCostToday(),
      recentTasks: getRecentTasks(10),
      activeAgents,
      systemStatus: {
        mayorOnline: isMayorOnline(),
        mayorSessionId: getMayorSessionId() ?? undefined,
        mayorProjectPath: getMayorProjectPath(),
        witnessRunning: isWitnessRunning(),
        witnessLastCheck: getWitnessLastCheck(),
        ngrokOnline: ngrokStatus.ngrokOnline,
      },
    };

    res.json(data);
  } catch (err) {
    console.error('Error fetching dashboard:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// POST /api/dashboard/mayor/start
router.post('/mayor/start', async (_req, res) => {
  try {
    setMayorEnabled(true);
    const sessionId = await ensureMayorRunning();
    res.json({ online: true, sessionId });
  } catch (err: any) {
    console.error('[dashboard] Failed to start mayor:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/dashboard/mayor/stop
router.post('/mayor/stop', (_req, res) => {
  setMayorEnabled(false);
  res.json({ online: false });
});

// GET /api/dashboard/mayor/messages — list Mayor messages
router.get('/mayor/messages', (req, res) => {
  try {
    const unreadOnly = req.query.unreadOnly === 'true';
    const type = req.query.type as string | undefined;
    const messages = getAllMessages({ unreadOnly, type });
    const unreadCount = getUnreadCount();
    res.json({ messages, unreadCount });
  } catch (err) {
    console.error('Error fetching mayor messages:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// POST /api/dashboard/mayor/message — human sends message to Mayor
router.post('/mayor/message', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'message is required' });
    }

    // Save as a human message in the log
    createMessage({
      type: 'human',
      source: 'dashboard',
      subject: 'Human message',
      body: message,
    });

    // Forward to Mayor if online
    if (isMayorOnline()) {
      await sendToMayor(message);
      res.json({ sent: true, mayorOnline: true });
    } else {
      res.json({ sent: false, mayorOnline: false, note: 'Mayor is offline. Message saved for when Mayor starts.' });
    }
  } catch (err: any) {
    console.error('[dashboard] Failed to send message to mayor:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dashboard/token-usage — debug endpoint for token usage stats
router.get('/token-usage', (_req, res) => {
  try {
    const today = getTokenUsageToday();
    const all = getTokenUsageAll();
    res.json({ today, allTime: all.total, recordCount: all.count });
  } catch (err) {
    console.error('Error fetching token usage:', err);
    res.status(500).json({ error: 'Failed to fetch token usage' });
  }
});

// GET /api/dashboard/token-usage/history?hours=24 — time-series token usage
router.get('/token-usage/history', (req, res) => {
  try {
    const hours = Math.min(Math.max(parseInt(req.query.hours as string) || 24, 1), 720);
    const points = getTokenUsageTimeSeries(hours);
    res.json({ hours, points });
  } catch (err) {
    console.error('Error fetching token usage history:', err);
    res.status(500).json({ error: 'Failed to fetch token usage history' });
  }
});

// POST /api/dashboard/token-usage/scan — trigger a manual token usage scan
router.post('/token-usage/scan', (_req, res) => {
  try {
    const inserted = scanAllSessions();
    const all = getTokenUsageAll();
    res.json({ inserted, allTime: all.total, recordCount: all.count });
  } catch (err) {
    console.error('Error scanning token usage:', err);
    res.status(500).json({ error: 'Failed to scan token usage' });
  }
});

export default router;
