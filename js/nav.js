/* ============================================================
   nav.js — Shared floating bottom navigation bar
   Also acts as the shared "app bootstrap" imported by every
   page: registers the service worker, runs the app-lock gate,
   and posts any due recurring expenses.
   ============================================================ */
import { initAppLock } from './lock.js';
import { runDueRecurring } from './db.js';
import './theme.js';

// Register the service worker once, from whichever page loads first.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => {
      console.warn('Service worker registration failed:', err);
    });
  });
}

// Gate the page behind PIN/biometric lock if the user has one set up.
initAppLock();

// Silently post any recurring expenses that came due since last visit.
runDueRecurring().catch((err) => console.warn('Recurring engine error:', err));

const ICONS = {
  home: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9a1 1 0 0 0 1 1H9a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1h2.5a1 1 0 0 0 1-1v-9"/></svg>`,
  wallet: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="M3 10h18"/><circle cx="16.5" cy="14" r="1.2" fill="currentColor" stroke="none"/></svg>`,
  plus: `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`,
  chart: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V10M12 20V4M20 20v-7"/></svg>`,
  lock: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2.5"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/></svg>`,
};

const NAV_ITEMS = [
  { id: 'dashboard', href: 'index.html', icon: 'home', label: 'Home' },
  { id: 'wallet', href: 'wallet.html', icon: 'wallet', label: 'Wallet' },
  { id: 'add', href: 'add.html', icon: 'plus', label: 'Add', isFab: true },
  { id: 'stats', href: 'stats.html', icon: 'chart', label: 'Stats' },
  { id: 'vault', href: 'vault.html', icon: 'lock', label: 'Vault' },
];

export function renderNav(activePage) {
  const container = document.getElementById('bottom-nav');
  if (!container) return;

  container.innerHTML = `
    <nav class="bottom-nav-pill" aria-label="Primary navigation">
      ${NAV_ITEMS.map((item) => {
        if (item.isFab) {
          return `<a href="${item.href}" class="nav-fab" aria-label="${item.label}">${ICONS[item.icon]}</a>`;
        }
        const active = item.id === activePage;
        return `<a href="${item.href}" class="nav-item ${active ? 'active' : ''}" aria-label="${item.label}" aria-current="${active ? 'page' : 'false'}">${ICONS[item.icon]}</a>`;
      }).join('')}
    </nav>
  `;
}
