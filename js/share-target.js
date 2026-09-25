/* ============================================================
   share-target.js — Handles Android's "Share" sheet entry point.
   The shared text is only ever held in memory for this one page
   load — it's never written to localStorage/IndexedDB, and is
   discarded the moment the user taps Add or Discard (or just
   navigates away).
   ============================================================ */
import { renderNav } from './nav.js';
import { isShareToAddEnabled, addExpense, addIncome, CATEGORIES } from './db.js';
import { icon } from './icons.js';
import { parseSharedText } from './notif-parser.js';

renderNav('add');
window.__mfAppRendered = true;

function show(id) {
  ['disabled-card', 'blocked-card', 'no-amount-card', 'confirm-card'].forEach((cardId) => {
    document.getElementById(cardId).classList.toggle('hidden', cardId !== id);
  });
}

document.getElementById('disabled-icon').innerHTML = icon('cloudOff', 26);
document.getElementById('blocked-icon').innerHTML = icon('shield', 26);
document.getElementById('no-amount-icon').innerHTML = icon('search', 26);

if (!isShareToAddEnabled()) {
  show('disabled-card');
} else {
  const params = new URLSearchParams(window.location.search);
  // Combine whatever the share sheet sent us. This local variable is the
  // ONLY place this text ever lives — nothing here gets persisted.
  const sharedText = [params.get('title'), params.get('text'), params.get('url')].filter(Boolean).join(' ');

  // Clear the URL bar's query string immediately so the raw shared text
  // doesn't linger in browser history longer than necessary.
  if (window.history.replaceState) {
    window.history.replaceState({}, '', window.location.pathname);
  }

  const result = parseSharedText(sharedText);

  if (result.blocked) {
    show('blocked-card');
  } else if (!result.amount) {
    show('no-amount-card');
  } else {
    show('confirm-card');
    initConfirmForm(result);
  }
}

function initConfirmForm(result) {
  document.getElementById('confirm-amount').value = result.amount;
  document.getElementById('detected-badge').innerHTML = `${icon('sparkle', 12)} Detected from shared message`;
  document.getElementById('confirm-note').value = result.merchant ? `From share: ${result.merchant}` : 'From shared message';

  const categorySelect = document.getElementById('confirm-category');
  CATEGORIES.forEach((cat) => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    categorySelect.appendChild(opt);
  });

  let direction = result.direction === 'income' ? 'income' : 'expense';
  let wallet = 'online'; // UPI/bank messages are overwhelmingly online-wallet activity

  function paintDirection() {
    document.querySelectorAll('.direction-btn').forEach((b) => {
      b.classList.toggle('bg-charcoal', b.dataset.direction === direction);
      b.classList.toggle('text-white', b.dataset.direction === direction);
    });
    document.getElementById('category-wrap').classList.toggle('hidden', direction === 'income');
  }
  function paintWallet() {
    document.querySelectorAll('.wallet-btn').forEach((b) => {
      b.classList.toggle('bg-charcoal', b.dataset.wallet === wallet);
      b.classList.toggle('text-white', b.dataset.wallet === wallet);
    });
  }
  document.querySelectorAll('.direction-btn').forEach((b) => {
    b.addEventListener('click', () => {
      direction = b.dataset.direction;
      paintDirection();
    });
  });
  document.querySelectorAll('.wallet-btn').forEach((b) => {
    b.addEventListener('click', () => {
      wallet = b.dataset.wallet;
      paintWallet();
    });
  });
  paintDirection();
  paintWallet();

  document.getElementById('discard-btn').addEventListener('click', () => {
    window.location.href = 'index.html';
  });

  document.getElementById('confirm-add-btn').addEventListener('click', async () => {
    const amount = parseFloat(document.getElementById('confirm-amount').value) || 0;
    if (amount <= 0) return;
    const note = document.getElementById('confirm-note').value.trim();

    if (direction === 'income') {
      await addIncome({ walletType: wallet, amount, note });
    } else {
      await addExpense({
        amount,
        category: categorySelect.value,
        walletType: wallet,
        expenseType: 'need',
        note,
      });
    }
    window.location.href = 'index.html';
  });
}
