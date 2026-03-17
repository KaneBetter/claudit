import { useEffect } from 'react';
import { useUIStore, Theme } from '../stores/useUIStore';

function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (theme !== 'system') return theme;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(resolved: 'light' | 'dark') {
  document.documentElement.classList.toggle('dark', resolved === 'dark');
}

export function useThemeEffect() {
  const theme = useUIStore(s => s.theme);

  useEffect(() => {
    applyTheme(resolveTheme(theme));

    if (theme !== 'system') return;

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme(resolveTheme('system'));
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);
}

/** Returns the resolved theme ('light' | 'dark'), reacting to system changes. */
export function useResolvedTheme(): 'light' | 'dark' {
  const theme = useUIStore(s => s.theme);

  // For system theme, we derive from the DOM class which is kept in sync by useThemeEffect
  if (theme !== 'system') return theme;
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}
