# Application themes

OnlineFS supports Light, Dark, and System themes. The header's **Color theme** selector is keyboard-operable; the choice is saved as `onlinefs-theme` in `localStorage`. With System selected (the default), the app follows `prefers-color-scheme` and reacts when the operating-system setting changes.

`index.html` contains a small synchronous bootstrap that reads the saved preference and applies `data-theme` to `<html>` before the application bundle paints. `ThemeProvider` in `src/contexts/ThemeContext.tsx` owns the runtime preference, system preference listener, document color scheme, and browser theme color. Use `useTheme()` when a component needs to read or change the preference.

## Component styling

Use the semantic CSS custom properties in `src/index.css` rather than hardcoded foreground/background colors. They are shared by the existing utility color aliases and classic component styles:

- Surfaces: `--bg-primary`, `--bg-secondary`, `--bg-card`, `--bg-card-hover`, `--bg-input`, `--surface-hover`
- Text: `--text-primary`, `--text-secondary`, `--text-muted`, `--text-accent`
- Controls: `--primary`, `--primary-hover`, `--primary-light`, `--border`, `--border-hover`, `--border-active`, `--input`, `--ring`
- Feedback: `--success`, `--success-light`, `--warning`, `--warning-light`, `--danger`, `--danger-light`, `--info`, `--info-light` and corresponding `*-text` colors
- Elevation/overlays: `--shadow-sm`, `--shadow-md`, `--shadow-lg`, `--overlay-backdrop`

Prefer existing classes such as `.glass-card`, `.btn`, `.form-input`, `.badge-*`, `.alert-*`, and utility colors such as `bg-card` / `text-text-primary`. If a component needs a new surface or state, add a semantic token with a dark default and a light override under `:root[data-theme="light"]`; do not branch styles in React based on theme. Keep visible focus indicators, preserve disabled states, and check text/background contrast in both palettes. Use `prefers-reduced-motion`-aware transitions for theme changes.

The leave-summary print sheet intentionally uses its own white paper palette for legibility and is not themed; its on-screen application shell remains themed.
