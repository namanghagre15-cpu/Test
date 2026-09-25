/* ============================================================
   nav.js — Shared floating bottom navigation bar
   Also acts as the shared "app bootstrap" imported by every
   page: registers the service worker, runs the app-lock gate,
   and posts any due recurring expenses.
   ============================================================ */
import { initAppLock } from './lock.js';
import { runDueRecurring } from './db.js';
import './theme.js';
import './ai-chat.js';

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

  history: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12v18l-2.5-1.6L13 21l-2-1.6L9 21l-2.5-1.6L4.5 21V3H6Z"/><path d="M8 8h8M8 11.5h8M8 15h5"/></svg>`,
  khata: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 12 4-3.5 3 2 4-3 3 2.2 4-2.7 2 2.5-6 5-2.2-1.7-3.6 2.7L7 13.5Z"/><path d="m6.5 8.5 4.2 5.2M17 9.5l-4 5"/></svg>`,
  settings: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 13.5a1.7 1.7 0 0 0 .34 1.87l.06.06a2.06 2.06 0 1 1-2.92 2.92l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56v.09a2.06 2.06 0 1 1-4.12 0v-.09a1.7 1.7 0 0 0-1.11-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2.06 2.06 0 1 1-2.92-2.92l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03H4.4a2.06 2.06 0 1 1 0-4.12h.09A1.7 1.7 0 0 0 6.05 6.9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2.06 2.06 0 1 1 2.92-2.92l.06.06a1.7 1.7 0 0 0 1.87.34H10.6A1.7 1.7 0 0 0 11.63 1h.07a2.06 2.06 0 1 1 4.12 0v.09a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2.06 2.06 0 1 1 2.92 2.92l-.06.06a1.7 1.7 0 0 0 .34 1.87v.06a1.7 1.7 0 0 0 1.56 1.03h.09a2.06 2.06 0 1 1 0 4.12h-.09a1.7 1.7 0 0 0-1.56 1.03Z"/></svg>`,
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

  const allItems = [
    { id: 'dashboard', href: 'index.html', icon: 'home', label: 'Overview' },
    { id: 'add', href: 'add.html', icon: 'plus', label: 'Add', isAdd: true },
    { id: 'wallet', href: 'wallet.html', icon: 'wallet', label: 'Wallet' },
    { id: 'stats', href: 'stats.html', icon: 'chart', label: 'Statistics' },
    { id: 'history', href: 'history.html', icon: 'history', label: 'History' },
    { id: 'khata', href: 'khata.html', icon: 'khata', label: 'Khata' },
    { id: 'vault', href: 'vault.html', icon: 'lock', label: 'Vault' },
    { id: 'settings', href: 'settings.html', icon: 'settings', label: 'Settings' },
  ];

  const primary = [
    { id: 'dashboard', href: 'index.html', icon: 'home', label: 'Home' },
    { id: 'wallet', href: 'wallet.html', icon: 'wallet', label: 'Wallet' },
    { id: 'add', href: 'add.html', icon: 'plus', label: 'Add', isFab: true },
    { id: 'stats', href: 'stats.html', icon: 'chart', label: 'Stats' },
    { id: 'vault', href: 'vault.html', icon: 'lock', label: 'Vault' },
  ];

  const link = (item, className) => {
    const active = item.id === activePage;
    return `<a href="${item.href}" class="${className}${active ? ' active' : ''}" aria-label="${item.label}" aria-current="${active ? 'page' : 'false'}">${ICONS[item.icon]}<span>${item.label}</span></a>`;
  };

  container.innerHTML = `
    <aside class="mf-desktop-sidebar" aria-label="Money follow navigation">
      <a class="mf-sidebar-brand" href="index.html" aria-label="Money follow home">
        <img src="assets/logo-mark.png" alt="" />
        <div><strong>Money follow</strong><span>Student finance</span></div>
      </a>
      <div class="mf-sidebar-label">Workspace</div>
      ${allItems.slice(0, 1).map(i => link(i, 'mf-sidebar-link')).join('')}
      ${allItems.slice(2, 4).map(i => link(i, 'mf-sidebar-link')).join('')}
      ${allItems.slice(4, 7).map(i => link(i, 'mf-sidebar-link')).join('')}
      <a href="add.html" class="mf-sidebar-link add-link" aria-label="Add transaction">${ICONS.plus}<span>Add transaction</span></a>
      <div class="mf-sidebar-spacer"></div>
      <div class="mf-sidebar-footer">
        ${link(allItems[7], 'mf-sidebar-link')}
      </div>
    </aside>

    <nav class="mf-tablet-nav" aria-label="Primary navigation">
      <a class="mf-tablet-brand" href="index.html"><img src="assets/logo-mark.png" alt="" /><span>Money follow</span></a>
      ${primary.map(i => link(i, `mf-tablet-link${i.id === 'add' ? ' mf-tablet-add' : ''}`)).join('')}
      <a href="settings.html" class="mf-tablet-link ${activePage === 'settings' ? 'active' : ''}" aria-label="Settings">${ICONS.settings}<span>Settings</span></a>
    </nav>

    <nav class="bottom-nav-pill" aria-label="Primary navigation">
      ${primary.map((item) => {
        if (item.isFab) return `<a href="${item.href}" class="nav-fab" aria-label="${item.label}">${ICONS[item.icon]}</a>`;
        const active = item.id === activePage;
        return `<a href="${item.href}" class="nav-item ${active ? 'active' : ''}" aria-label="${item.label}" aria-current="${active ? 'page' : 'false'}">${ICONS[item.icon]}</a>`;
      }).join('')}
    </nav>
  `;
}

/**
 * Shared toast/snackbar. Pass { actionLabel, onAction } to show an
 * optional action button (e.g. "Undo") for a few extra seconds.
 */
export function showToast(text, { actionLabel, onAction, duration } = {}) {
  const existing = document.querySelector('.mf-toast');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.className = 'mf-toast';
  if (actionLabel && onAction) {
    el.classList.add('mf-toast-with-action');
    const span = document.createElement('span');
    span.textContent = text;
    const btn = document.createElement('button');
    btn.textContent = actionLabel;
    btn.className = 'mf-toast-action';
    btn.addEventListener('click', () => {
      el.remove();
      onAction();
    });
    el.appendChild(span);
    el.appendChild(btn);
  } else {
    el.textContent = text;
  }
  document.body.appendChild(el);
  setTimeout(() => el.remove(), duration || (actionLabel ? 5000 : 1800));
}
