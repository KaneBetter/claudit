import { DashboardData, TokenUsagePoint } from '../types';

export async function fetchDashboard(): Promise<DashboardData> {
  const res = await fetch('/api/dashboard');
  if (!res.ok) throw new Error('Failed to fetch dashboard');
  return res.json();
}

export async function fetchTokenUsageHistory(hours: number): Promise<TokenUsagePoint[]> {
  const res = await fetch(`/api/dashboard/token-usage/history?hours=${hours}`);
  if (!res.ok) throw new Error('Failed to fetch token usage history');
  const data = await res.json();
  return data.points;
}
