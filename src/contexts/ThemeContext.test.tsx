import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider, useTheme } from './ThemeContext';

function ThemeHarness() {
  const { preference, resolvedTheme, setPreference } = useTheme();
  return <div>
    <output>{`${preference}:${resolvedTheme}`}</output>
    <button onClick={() => setPreference('light')}>Light</button>
    <button onClick={() => setPreference('system')}>System</button>
  </div>;
}

afterEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
  vi.restoreAllMocks();
});

describe('ThemeProvider', () => {
  it('persists an explicit theme and applies it to the document', async () => {
    render(<ThemeProvider><ThemeHarness /></ThemeProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Light' }));
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('light'));
    expect(localStorage.getItem('onlinefs-theme')).toBe('light');
    expect(screen.getByText('light:light')).toBeInTheDocument();
  });

  it('uses the saved preference on a subsequent provider mount', () => {
    localStorage.setItem('onlinefs-theme', 'dark');
    render(<ThemeProvider><ThemeHarness /></ThemeProvider>);
    expect(screen.getByText('dark:dark')).toBeInTheDocument();
  });

  it('follows operating-system color preference while System is selected', async () => {
    let onChange: (() => void) | undefined;
    const media = {
      matches: true,
      addEventListener: (_: string, listener: () => void) => { onChange = listener; },
      removeEventListener: vi.fn(),
    } as unknown as MediaQueryList;
    vi.stubGlobal('matchMedia', vi.fn(() => media));
    render(<ThemeProvider><ThemeHarness /></ThemeProvider>);
    expect(screen.getByText('system:light')).toBeInTheDocument();
    (media as unknown as { matches: boolean }).matches = false;
    onChange?.();
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('dark'));
  });
});
