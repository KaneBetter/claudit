import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { db } from './database.js';

const PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects');
const SCAN_INTERVAL_MS = 60_000; // 1 minute

// Track last scanned mtime per file to skip unchanged files
const lastScannedMtime = new Map<string, number>();
let scanTimer: ReturnType<typeof setInterval> | null = null;

// Prepared statements (lazy-initialized)
let _stmtInsert: ReturnType<typeof db.prepare> | null = null;
let _stmtExists: ReturnType<typeof db.prepare> | null = null;

function getInsertStmt() {
  if (!_stmtInsert) {
    _stmtInsert = db.prepare(`
      INSERT OR IGNORE INTO token_usage (id, sessionId, inputTokens, outputTokens, cacheCreationTokens, cacheReadTokens, totalTokens, createdAt)
      VALUES (@id, @sessionId, @inputTokens, @outputTokens, @cacheCreationTokens, @cacheReadTokens, @totalTokens, @createdAt)
    `);
  }
  return _stmtInsert;
}

function getExistsStmt() {
  if (!_stmtExists) {
    _stmtExists = db.prepare('SELECT 1 FROM token_usage WHERE id = ?');
  }
  return _stmtExists;
}

interface ParsedUsage {
  messageId: string;
  sessionId: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  timestamp: string;
}

/**
 * Parse a JSONL session file and extract the final usage per message turn.
 * Returns one entry per unique message ID (the last streaming update).
 */
function parseSessionFile(filePath: string): ParsedUsage[] {
  const sessionId = path.basename(filePath, '.jsonl');

  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch {
    return [];
  }

  // Group by message.id — keep only the last entry per message (final streaming update)
  const byMessageId = new Map<string, ParsedUsage>();

  for (const line of content.split('\n')) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line);
      if (entry.type !== 'assistant') continue;

      const msg = entry.message;
      if (!msg?.usage) continue;

      const messageId = msg.id || entry.uuid || '';
      if (!messageId) continue;

      const usage = msg.usage;
      byMessageId.set(messageId, {
        messageId,
        sessionId,
        inputTokens: usage.input_tokens || 0,
        outputTokens: usage.output_tokens || 0,
        cacheCreationTokens: usage.cache_creation_input_tokens || 0,
        cacheReadTokens: usage.cache_read_input_tokens || 0,
        timestamp: entry.timestamp || new Date().toISOString(),
      });
    } catch {
      // skip malformed lines
    }
  }

  return Array.from(byMessageId.values());
}

/**
 * Generate a deterministic ID for a token usage record based on session + message.
 * This ensures the same turn is never double-counted.
 */
function makeRecordId(sessionId: string, messageId: string): string {
  return crypto.createHash('sha256')
    .update(`${sessionId}:${messageId}`)
    .digest('hex')
    .slice(0, 36); // same length as UUID
}

/**
 * Scan all JSONL session files and insert new token usage records.
 * Returns the number of new records inserted.
 */
export function scanAllSessions(): number {
  if (!fs.existsSync(PROJECTS_DIR)) return 0;

  let inserted = 0;
  const insertStmt = getInsertStmt();
  const existsStmt = getExistsStmt();

  const projectDirs = fs.readdirSync(PROJECTS_DIR, { withFileTypes: true });

  for (const dir of projectDirs) {
    if (!dir.isDirectory()) continue;
    const dirPath = path.join(PROJECTS_DIR, dir.name);

    let files: string[];
    try {
      files = fs.readdirSync(dirPath).filter(f => f.endsWith('.jsonl'));
    } catch {
      continue;
    }

    for (const file of files) {
      const filePath = path.join(dirPath, file);

      // Skip unchanged files
      let stat: fs.Stats;
      try {
        stat = fs.statSync(filePath);
      } catch {
        continue;
      }

      const lastMtime = lastScannedMtime.get(filePath);
      if (lastMtime && stat.mtimeMs <= lastMtime) continue;

      // Parse and insert
      const usages = parseSessionFile(filePath);
      for (const u of usages) {
        const id = makeRecordId(u.sessionId, u.messageId);
        const totalTokens = u.inputTokens + u.outputTokens + u.cacheCreationTokens + u.cacheReadTokens;

        if (totalTokens === 0) continue;

        // Skip if already exists
        if (existsStmt.get(id)) continue;

        try {
          insertStmt.run({
            id,
            sessionId: u.sessionId,
            inputTokens: u.inputTokens,
            outputTokens: u.outputTokens,
            cacheCreationTokens: u.cacheCreationTokens,
            cacheReadTokens: u.cacheReadTokens,
            totalTokens,
            createdAt: u.timestamp,
          });
          inserted++;
        } catch (err) {
          // INSERT OR IGNORE handles duplicates, but log other errors
          console.error('[tokenScanner] Insert error:', err);
        }
      }

      lastScannedMtime.set(filePath, stat.mtimeMs);
    }
  }

  if (inserted > 0) {
    console.log(`[tokenScanner] Inserted ${inserted} new token usage records`);
  }

  return inserted;
}

/**
 * Start the periodic token scanner.
 */
export function startTokenScanner(): void {
  // Initial scan
  console.log('[tokenScanner] Starting initial scan...');
  const count = scanAllSessions();
  console.log(`[tokenScanner] Initial scan complete: ${count} records inserted`);

  // Periodic re-scan
  scanTimer = setInterval(() => {
    try {
      scanAllSessions();
    } catch (err) {
      console.error('[tokenScanner] Scan error:', err);
    }
  }, SCAN_INTERVAL_MS);
}

/**
 * Stop the periodic scanner.
 */
export function stopTokenScanner(): void {
  if (scanTimer) {
    clearInterval(scanTimer);
    scanTimer = null;
  }
}
