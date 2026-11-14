import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';
type ResolvedTheme = Exclude<ThemePreference, 'system'>;
type ThemeContextValue = { preference: ThemePreference; resolvedTheme: ResolvedTheme; setPreference: (theme: ThemePreference) => void };

const STORAGE_KEY = 'onlinefs-theme';
const ThemeContext = createContext<ThemeContextValue | null>(null);

function readPreference(): ThemePreference {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
  } catch { /* Storage may be unavailable in private or restricted contexts. */ }
  return 'system';
}

export const ThemeProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [preference, setPreference] = useState<ThemePreference>(readPreference);
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() =>
    window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  const resolvedTheme = preference === 'system' ? systemTheme : preference;

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: light)');
    if (!media) return;
    const update = () => setSystemTheme(media.matches ? 'light' : 'dark');
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.style.colorScheme = resolvedTheme;
    document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute(
      'content', resolvedTheme === 'light' ? '#f5f7fb' : '#0a0e1a');
  }, [resolvedTheme]);

  const updatePreference = (next: ThemePreference) => {
    setPreference(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* Keep the in-memory setting. */ }
  };
  const value = useMemo(() => ({ preference, resolvedTheme, setPreference: updatePreference }), [preference, resolvedTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
