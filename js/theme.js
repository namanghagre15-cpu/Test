/* ============================================================
   theme.js — Dark / Light mode
   Reads/writes localStorage directly (not via db.js) so the
   very first inline <script> in <head> can flip the theme
   before first paint without waiting on any module graph.
   ============================================================ */
import { getLocal, setLocal } from './db.js';

export function isDarkMode() {
  return getLocal('dark_mode', false);
}

export function applyTheme(dark) {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
}

export function toggleTheme() {
  const next = !isDarkMode();
  setLocal('dark_mode', next);
  applyTheme(next);
  return next;
}

// Ensure the DOM reflects the stored preference (in case the inline
// bootstrap script in <head> was somehow skipped).
applyTheme(isDarkMode());
