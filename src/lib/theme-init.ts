// The one inline script on the page: applies the saved/system theme before
// first paint (no flash) and enables the scroll-reveal initial state.
//
// It is built from the constants in theme.ts, and astro.config.mjs hashes this
// exact string into the Content Security Policy, so the two can't drift.
import { DEFAULT_THEME_PREF, THEME_COLOR, THEME_PREFS, THEME_STORAGE_KEY } from './theme';

const j = JSON.stringify;

export const THEME_INIT_SCRIPT = `(function () {
  var root = document.documentElement;
  root.classList.add('reveal-ready');
  var pref = ${j(DEFAULT_THEME_PREF)};
  try {
    pref = localStorage.getItem(${j(THEME_STORAGE_KEY)}) || pref;
  } catch (e) {}
  if (${j(THEME_PREFS)}.indexOf(pref) < 0) pref = ${j(DEFAULT_THEME_PREF)};
  var dark = pref === 'system' ? matchMedia('(prefers-color-scheme: dark)').matches : pref === 'dark';
  root.dataset.themePref = pref;
  root.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]').content = dark ? ${j(THEME_COLOR.dark)} : ${j(THEME_COLOR.light)};
})();`;
