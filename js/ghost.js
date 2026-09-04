/* ============================================================
   ghost.js — Ghost Mode (public privacy blur)
   Tag every rendered amount with setMoneyText() instead of
   el.textContent = ... so toggling Ghost Mode can mask/unmask
   every amount on the current page instantly.
   ============================================================ */
import { getLocal, setLocal } from './db.js';

const tracked = new Set();

export function isGhostMode() {
  return getLocal('ghost_mode', false);
}

function mask(text) {
  return text.replace(/[0-9]/g, '•');
}

export function setMoneyText(el, text) {
  if (!el) return;
  el.dataset.real = text;
  el.classList.add('mf-amt');
  el.textContent = isGhostMode() ? mask(text) : text;
  tracked.add(el);
}

export function refreshGhostDisplay() {
  const ghosting = isGhostMode();
  // Catch any elements tagged with the class that weren't tracked yet
  // (e.g. re-rendered lists) as well as the tracked set.
  document.querySelectorAll('.mf-amt').forEach((el) => {
    const real = el.dataset.real || el.textContent;
    el.dataset.real = real;
    el.textContent = ghosting ? mask(real) : real;
    tracked.add(el);
  });
}

export function toggleGhostMode() {
  const next = !isGhostMode();
  setLocal('ghost_mode', next);
  refreshGhostDisplay();
  updateGhostToggleIcon();
  return next;
}

export function updateGhostToggleIcon() {
  const btn = document.getElementById('ghost-toggle-btn');
  if (!btn) return;
  btn.textContent = isGhostMode() ? '🙈' : '👁️';
  btn.setAttribute('aria-pressed', isGhostMode() ? 'true' : 'false');
}

export function initGhostToggle() {
  const btn = document.getElementById('ghost-toggle-btn');
  if (!btn) return;
  updateGhostToggleIcon();
  btn.addEventListener('click', () => {
    toggleGhostMode();
  });
}
