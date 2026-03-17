import crypto from 'crypto';
import { db } from './database.js';

// Lazy-initialized prepared statement to avoid module-load ordering issues
let _stmtInsert: ReturnType<typeof db.prepare> | null = null;
function getInsertStmt() {
  if (!_stmtInsert) {
    _stmtInsert = db.prepare(`
      INSERT INTO token_usage (id, sessionId, inputTokens, outputTokens, cacheCreationTokens, cacheReadTokens, totalTokens, createdAt)
      VALUES (@id, @sessionId, @inputTokens, @outputTokens, @cacheCreationTokens, @cacheReadTokens, @totalTokens, @createdAt)
    `);
  }
  return _stmtInsert;
}

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

  if (totalTokens === 0) {
    return; // Skip recording zero-usage events
  }

  try {
    getInsertStmt().run({
      id: crypto.randomUUID(),
      sessionId: event.sessionId,
      inputTokens: event.inputTokens,
      outputTokens: event.outputTokens,
      cacheCreationTokens: event.cacheCreationTokens,
      cacheReadTokens: event.cacheReadTokens,
      totalTokens,
      createdAt: new Date().toISOString(),
    });
    console.log(`[tokenTracker] Recorded ${totalTokens} tokens for session ${event.sessionId.slice(0, 8)}... (in=${event.inputTokens} out=${event.outputTokens} cacheCreate=${event.cacheCreationTokens} cacheRead=${event.cacheReadTokens})`);
  } catch (err) {
    console.error('[tokenTracker] Failed to record usage:', err);
  }
}

export function getTokenUsageToday(): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString();
  try {
    const row = db.prepare(
      'SELECT COALESCE(SUM(totalTokens), 0) as total FROM token_usage WHERE createdAt >= ?'
    ).get(todayStr) as any;
    return row?.total ?? 0;
  } catch (err) {
    console.error('[tokenTracker] Failed to query today usage:', err);
    return 0;
  }
}

export function getTokenUsageAll(): { total: number; count: number } {
  try {
    const row = db.prepare(
      'SELECT COALESCE(SUM(totalTokens), 0) as total, COUNT(*) as count FROM token_usage'
    ).get() as any;
    return { total: row?.total ?? 0, count: row?.count ?? 0 };
  } catch (err) {
    console.error('[tokenTracker] Failed to query all usage:', err);
    return { total: 0, count: 0 };
  }
}

// Claude Sonnet pricing (default) — per million tokens
const PRICING = {
  input: 3,       // $3/MTok
  output: 15,     // $15/MTok
  cacheCreate: 3.75, // $3.75/MTok
  cacheRead: 0.30,   // $0.30/MTok
};

export function computeCostUSD(input: number, output: number, cacheCreation: number, cacheRead: number): number {
  return (
    (input / 1_000_000) * PRICING.input +
    (output / 1_000_000) * PRICING.output +
    (cacheCreation / 1_000_000) * PRICING.cacheCreate +
    (cacheRead / 1_000_000) * PRICING.cacheRead
  );
}

export function getTokenCostToday(): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString();
  try {
    const row = db.prepare(`
      SELECT
        COALESCE(SUM(inputTokens), 0) as input,
        COALESCE(SUM(outputTokens), 0) as output,
        COALESCE(SUM(cacheCreationTokens), 0) as cacheCreation,
        COALESCE(SUM(cacheReadTokens), 0) as cacheRead
      FROM token_usage WHERE createdAt >= ?
    `).get(todayStr) as any;
    return computeCostUSD(row.input, row.output, row.cacheCreation, row.cacheRead);
  } catch (err) {
    console.error('[tokenTracker] Failed to compute today cost:', err);
    return 0;
  }
}

export interface TokenUsagePoint {
  time: string;       // ISO timestamp (bucket start)
  inputTokens: number;
  outputTokens: number;
  cacheTokens: number;
  totalTokens: number;
  costUSD: number;
}

/**
 * Get hourly-bucketed token usage for the last N hours.
 */
export function getTokenUsageTimeSeries(hours: number): TokenUsagePoint[] {
  const since = new Date(Date.now() - hours * 3600_000);
  since.setMinutes(0, 0, 0);
  const sinceStr = since.toISOString();

  try {
    const rows = db.prepare(`
      SELECT
        strftime('%Y-%m-%dT%H:00:00', createdAt) as bucket,
        SUM(inputTokens) as input,
        SUM(outputTokens) as output,
        SUM(cacheCreationTokens) as cacheCreation,
        SUM(cacheReadTokens) as cacheRead,
        SUM(totalTokens) as total
      FROM token_usage
      WHERE createdAt >= ?
      GROUP BY bucket
      ORDER BY bucket ASC
    `).all(sinceStr) as any[];

    // Build full hourly buckets (fill gaps with zeros)
    const bucketMap = new Map<string, any>();
    for (const row of rows) {
      bucketMap.set(row.bucket, row);
    }

    const points: TokenUsagePoint[] = [];
    const cursor = new Date(since);
    const now = new Date();

    while (cursor <= now) {
      const key = cursor.toISOString().slice(0, 13) + ':00:00';
      const row = bucketMap.get(key);
      if (row) {
        points.push({
          time: key,
          inputTokens: row.input,
          outputTokens: row.output,
          cacheTokens: row.cacheCreation + row.cacheRead,
          totalTokens: row.total,
          costUSD: computeCostUSD(row.input, row.output, row.cacheCreation, row.cacheRead),
        });
      } else {
        points.push({
          time: key,
          inputTokens: 0,
          outputTokens: 0,
          cacheTokens: 0,
          totalTokens: 0,
          costUSD: 0,
        });
      }
      cursor.setHours(cursor.getHours() + 1);
    }

    return points;
  } catch (err) {
    console.error('[tokenTracker] Failed to query time series:', err);
    return [];
  }
}
