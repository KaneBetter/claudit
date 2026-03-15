import crypto from 'crypto';
import { db } from './database.js';

const stmtInsert = db.prepare(`
  INSERT INTO token_usage (id, sessionId, inputTokens, outputTokens, cacheCreationTokens, cacheReadTokens, totalTokens, createdAt)
  VALUES (@id, @sessionId, @inputTokens, @outputTokens, @cacheCreationTokens, @cacheReadTokens, @totalTokens, @createdAt)
`);

export interface TokenUsageEvent {
  sessionId: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
}

export function recordTokenUsage(event: TokenUsageEvent): void {
  const totalTokens = event.inputTokens + event.outputTokens
    + event.cacheCreationTokens + event.cacheReadTokens;
  try {
    stmtInsert.run({
      id: crypto.randomUUID(),
      sessionId: event.sessionId,
      inputTokens: event.inputTokens,
      outputTokens: event.outputTokens,
      cacheCreationTokens: event.cacheCreationTokens,
      cacheReadTokens: event.cacheReadTokens,
      totalTokens,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[tokenTracker] Failed to record usage:', err);
  }
}

export function getTokenUsageToday(): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString();
  const row = db.prepare(
    'SELECT COALESCE(SUM(totalTokens), 0) as total FROM token_usage WHERE createdAt >= ?'
  ).get(todayStr) as any;
  return row?.total ?? 0;
}
