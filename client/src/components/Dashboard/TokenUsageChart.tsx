import { useState, useEffect, useMemo, useCallback } from 'react';
import { TokenUsagePoint } from '../../types';
import { fetchTokenUsageHistory } from '../../api/dashboard';
import { formatTokens, formatCost } from '../../lib/format';
import { cn } from '../../lib/utils';

type Period = '24h' | '7d' | '30d';
const PERIOD_HOURS: Record<Period, number> = { '24h': 24, '7d': 168, '30d': 720 };

export default function TokenUsageChart() {
  const [period, setPeriod] = useState<Period>('24h');
  const [points, setPoints] = useState<TokenUsagePoint[]>([]);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const load = useCallback(() => {
    fetchTokenUsageHistory(PERIOD_HOURS[period])
      .then(setPoints)
      .catch(console.error);
  }, [period]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 60_000);
    return () => clearInterval(timer);
  }, [load]);

  // Downsample for 7d/30d: bucket every N hours
  const displayPoints = useMemo(() => {
    if (period === '24h' || points.length <= 48) return points;
    const bucketSize = period === '30d' ? 24 : 6;
    const result: TokenUsagePoint[] = [];
    for (let i = 0; i < points.length; i += bucketSize) {
      const chunk = points.slice(i, i + bucketSize);
      result.push({
        time: chunk[0].time,
        inputTokens: chunk.reduce((s, p) => s + p.inputTokens, 0),
        outputTokens: chunk.reduce((s, p) => s + p.outputTokens, 0),
        cacheTokens: chunk.reduce((s, p) => s + p.cacheTokens, 0),
        totalTokens: chunk.reduce((s, p) => s + p.totalTokens, 0),
        costUSD: chunk.reduce((s, p) => s + p.costUSD, 0),
      });
    }
    return result;
  }, [points, period]);

  const maxVal = useMemo(() => Math.max(1, ...displayPoints.map(p => p.totalTokens)), [displayPoints]);
  const totalCost = useMemo(() => points.reduce((s, p) => s + p.costUSD, 0), [points]);
  const totalTokens = useMemo(() => points.reduce((s, p) => s + p.totalTokens, 0), [points]);

  // SVG dimensions
  const W = 600, H = 160, PAD_L = 0, PAD_R = 0, PAD_T = 8, PAD_B = 20;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;

  const pathData = useMemo(() => {
    if (displayPoints.length < 2) return { area: '', line: '' };
    const n = displayPoints.length;
    const pts = displayPoints.map((p, i) => ({
      x: PAD_L + (i / (n - 1)) * chartW,
      y: PAD_T + chartH - (p.totalTokens / maxVal) * chartH,
    }));

    const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
    const area = line + ` L${pts[pts.length - 1].x},${PAD_T + chartH} L${pts[0].x},${PAD_T + chartH} Z`;
    return { area, line };
  }, [displayPoints, maxVal, chartW, chartH]);

  // X-axis labels
  const xLabels = useMemo(() => {
    const n = displayPoints.length;
    if (n < 2) return [];
    const count = Math.min(6, n);
    const step = Math.max(1, Math.floor(n / count));
    const labels: { x: number; text: string }[] = [];
    for (let i = 0; i < n; i += step) {
      const d = new Date(displayPoints[i].time);
      const text = period === '24h'
        ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
      labels.push({
        x: PAD_L + (i / (n - 1)) * chartW,
        text,
      });
    }
    return labels;
  }, [displayPoints, period, chartW]);

  const hovered = hoveredIdx !== null ? displayPoints[hoveredIdx] : null;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-xs text-muted-foreground font-medium mb-1">Token Usage</div>
          <div className="flex items-baseline gap-3">
            <span className="text-2xl font-bold text-foreground tracking-tight">{formatTokens(totalTokens)}</span>
            <span className="text-sm text-primary font-medium">{formatCost(totalCost)}</span>
          </div>
        </div>
        {/* Period selector */}
        <div className="flex items-center gap-1 bg-secondary/50 rounded-lg p-0.5">
          {(['24h', '7d', '30d'] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                'text-[11px] px-2.5 py-1 rounded-md font-medium transition-all',
                period === p
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Tooltip */}
      {hovered && (
        <div className="flex items-center gap-4 text-[11px] text-muted-foreground mb-2 px-1">
          <span>{new Date(hovered.time).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
          <span className="text-foreground font-medium">{formatTokens(hovered.totalTokens)}</span>
          <span>In: {formatTokens(hovered.inputTokens)}</span>
          <span>Out: {formatTokens(hovered.outputTokens)}</span>
          <span>Cache: {formatTokens(hovered.cacheTokens)}</span>
          <span className="text-primary">{formatCost(hovered.costUSD)}</span>
        </div>
      )}

      {/* Chart */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        onMouseLeave={() => setHoveredIdx(null)}
      >
        <defs>
          <linearGradient id="tokenGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map(pct => {
          const y = PAD_T + chartH * (1 - pct);
          return (
            <g key={pct}>
              <line x1={PAD_L} y1={y} x2={PAD_L + chartW} y2={y} stroke="hsl(var(--border))" strokeWidth="0.5" strokeDasharray="4 4" />
              <text x={PAD_L + 2} y={y - 3} fill="hsl(var(--muted-foreground))" fontSize="8" opacity="0.5">
                {formatTokens(maxVal * pct)}
              </text>
            </g>
          );
        })}

        {/* Area fill */}
        {pathData.area && <path d={pathData.area} fill="url(#tokenGradient)" />}

        {/* Line */}
        {pathData.line && (
          <path d={pathData.line} fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        )}

        {/* Hover columns */}
        {displayPoints.map((_, i) => {
          const n = displayPoints.length;
          if (n < 2) return null;
          const x = PAD_L + (i / (n - 1)) * chartW;
          const colW = chartW / n;
          return (
            <rect
              key={i}
              x={x - colW / 2}
              y={PAD_T}
              width={colW}
              height={chartH}
              fill="transparent"
              onMouseEnter={() => setHoveredIdx(i)}
            />
          );
        })}

        {/* Hover dot */}
        {hoveredIdx !== null && displayPoints[hoveredIdx] && (() => {
          const n = displayPoints.length;
          const x = PAD_L + (hoveredIdx / (n - 1)) * chartW;
          const y = PAD_T + chartH - (displayPoints[hoveredIdx].totalTokens / maxVal) * chartH;
          return (
            <g>
              <line x1={x} y1={PAD_T} x2={x} y2={PAD_T + chartH} stroke="hsl(var(--primary))" strokeWidth="0.5" opacity="0.5" />
              <circle cx={x} cy={y} r="3.5" fill="hsl(var(--primary))" stroke="hsl(var(--background))" strokeWidth="2" />
            </g>
          );
        })()}

        {/* X-axis labels */}
        {xLabels.map((label, i) => (
          <text key={i} x={label.x} y={H - 4} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="9" opacity="0.6">
            {label.text}
          </text>
        ))}
      </svg>
    </div>
  );
}
