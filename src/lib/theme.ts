// Theme preference: 'dark' (default) | 'light' | 'system' (follow the device).
// The preference lives in <html data-theme-pref>, the resolved theme in
// <html data-theme>. BaseLayout's inline script applies the saved preference
// before first paint (using the constants below); the nav switch and the
// terminal's `theme` command change it through setTheme().

/** Cycle order for the switch and the `theme` command. */
export const THEME_PREFS = ['dark', 'light', 'system'] as const;
export type ThemePref = (typeof THEME_PREFS)[number];
export type Theme = 'dark' | 'light';

export const DEFAULT_THEME_PREF: ThemePref = 'dark';
export const THEME_STORAGE_KEY = 'theme';

/** Browser UI colour per theme. Must match --color-paper in global.css. */
export const THEME_COLOR: Record<Theme, string> = { dark: '#161412', light: '#faf9f6' };

/** Fired on <html> after the theme changes. */
export const THEME_CHANGE_EVENT = 'themechange';

export const isThemePref = (x: unknown): x is ThemePref =>
  (THEME_PREFS as readonly unknown[]).includes(x);

export const nextThemePref = (pref: ThemePref): ThemePref =>
  THEME_PREFS[(THEME_PREFS.indexOf(pref) + 1) % THEME_PREFS.length];

export const resolveTheme = (pref: ThemePref, deviceIsDark: boolean): Theme =>
  pref === 'system' ? (deviceIsDark ? 'dark' : 'light') : pref;

// ---- browser ----------------------------------------------------------------

const deviceDark = () => window.matchMedia('(prefers-color-scheme: dark)');

export function getThemePref(): ThemePref {
  const pref = document.documentElement.dataset.themePref;
  return isThemePref(pref) ? pref : DEFAULT_THEME_PREF;
}

function applyTheme(pref: ThemePref, origin?: { x: number; y: number }) {
  const root = document.documentElement;
  const theme = resolveTheme(pref, deviceDark().matches);
  const swap = () => {
    root.dataset.themePref = pref;
    root.dataset.theme = theme;
    document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')!.content =
      THEME_COLOR[theme];
    root.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT));
  };
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (theme === root.dataset.theme || !document.startViewTransition || reduced || !origin) {
    swap();
    return;
  }
  // Circular reveal expanding from `origin` (see ::view-transition rules in global.css).
  const { x, y } = origin;
  const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  document.startViewTransition(swap).ready.then(() => {
    root.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
      {
        duration: 550,
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
        pseudoElement: '::view-transition-new(root)',
      },
    );
  });
}

/** Save and apply a preference; `origin` (viewport px) centres the reveal animation. */
export function setTheme(pref: ThemePref, origin?: { x: number; y: number }) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    // Storage blocked (private mode, etc.): the theme still applies for this visit.
  }
  applyTheme(pref, origin);
}

/** Re-resolve 'system' when the device switches between light and dark. */
export function followDeviceTheme() {
  deviceDark().addEventListener('change', () => {
    if (getThemePref() === 'system') applyTheme('system');
  });
}
