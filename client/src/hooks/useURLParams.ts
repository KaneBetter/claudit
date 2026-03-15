import { useEffect } from 'react';
import { useUIStore } from '../stores/useUIStore';

/**
 * Syncs sidebar collapsed state with URL search params.
 * - On mount: reads `?sidebar=0` (collapsed) or `?sidebar=1` (expanded)
 * - On state change: updates URL without page reload
 */
export function useURLParams() {
  const sidebarCollapsed = useUIStore(s => s.sidebarCollapsed);
  const setSidebarCollapsed = useUIStore(s => s.setSidebarCollapsed);

  // Read URL params on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sidebarParam = params.get('sidebar');
    if (sidebarParam === '0') {
      setSidebarCollapsed(true);
    } else if (sidebarParam === '1') {
      setSidebarCollapsed(false);
    }
  }, [setSidebarCollapsed]);

  // Write URL params on state change
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const currentVal = params.get('sidebar');
    const newVal = sidebarCollapsed ? '0' : '1';

    if (currentVal !== null && currentVal !== newVal) {
      params.set('sidebar', newVal);
      window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
    } else if (currentVal !== null && currentVal === newVal) {
      // Already in sync
    }
    // If no sidebar param in URL, don't add one (only update if already present)
  }, [sidebarCollapsed]);
}
