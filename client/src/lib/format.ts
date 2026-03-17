/**
 * Format a token count with K/M/B suffixes.
 * e.g., 1234 → "1.2K", 43946864 → "43.9M", 1200000000 → "1.2B"
 */
export function formatTokens(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/**
 * Format USD cost.
 * e.g., 0.0312 → "$0.03", 12.5 → "$12.50", 0 → "$0.00"
 */
export function formatCost(usd: number): string {
  if (usd >= 100) return `$${Math.round(usd)}`;
  if (usd >= 1) return `$${usd.toFixed(2)}`;
  if (usd >= 0.01) return `$${usd.toFixed(2)}`;
  if (usd > 0) return `$${usd.toFixed(3)}`;
  return '$0.00';
}
