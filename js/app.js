/* ============================================================
   app.js — Dashboard (index.html) logic
   ============================================================ */
import { renderNav } from './nav.js';
import {
  getAvailableToSpend,
  getTotalVaultLocked,
  getWallets,
  getRecentTransactions,
  getPendingTransactions,
  commitPendingTransaction,
  cancelPendingTransaction,
  getMonthlyIncomeExpense,
  formatINR,
  formatDate,
  categoryIcon,
} from './db.js';

renderNav('dashboard');

const feedList = document.getElementById('feed-list');
const feedEmpty = document.getElementById('feed-empty');

async function renderSummary() {
  const [available, vaultLocked, wallets] = await Promise.all([
    getAvailableToSpend(),
    getTotalVaultLocked(),
    getWallets(),
  ]);

  document.getElementById('available-amount').textContent = formatINR(available);
  document.getElementById('safe-budget').textContent = formatINR(available);
  document.getElementById('vault-locked').textContent = formatINR(vaultLocked);

  const cash = wallets.find((w) => w.type === 'cash');
  const online = wallets.find((w) => w.type === 'online');
  document.getElementById('cash-balance').textContent = formatINR(cash ? cash.balance : 0);
  document.getElementById('online-balance').textContent = formatINR(online ? online.balance : 0);

  const { income, expense } = await getMonthlyIncomeExpense();
  const alertEl = document.getElementById('alert-text');
  if (income === 0 && expense === 0) {
    alertEl.textContent = 'Add your pocket money to get started this month.';
  } else if (expense > income) {
    alertEl.textContent = `You've spent ₹${Math.round(expense - income)} more than you received this month.`;
  } else {
    const pct = income ? Math.round((expense / income) * 100) : 0;
    alertEl.textContent = `You've used ${pct}% of this month's income. You're on track!`;
  }
}

async function renderFeed() {
  const txs = await getRecentTransactions(10);
  feedList.innerHTML = '';
  if (txs.length === 0) {
    feedEmpty.classList.remove('hidden');
    return;
  }
  feedEmpty.classList.add('hidden');

  txs.forEach((t) => {
    const isIncome = t.type === 'income';
    const sign = isIncome ? '+' : '−';
    const amountColor = isIncome ? 'text-charcoal' : 'text-crimson';
    const pendingBadge = t.isPending
      ? `<span class="text-[9px] uppercase tracking-widest font-black text-crimson bg-crimson/10 px-2 py-0.5 rounded-full ml-2">Pending</span>`
      : '';

    const item = document.createElement('div');
    item.className = 'bg-white rounded-3xl border border-sage-soft p-3 flex items-center gap-3';
    item.innerHTML = `
      <div class="feed-icon bg-crimson/10">${categoryIcon(t.category)}</div>
      <div class="flex-1 min-w-0">
        <p class="text-[16px] font-black leading-tight truncate">${t.category}${pendingBadge}</p>
        <p class="text-[12px] font-bold text-sage">${formatDate(t.date)} · ${t.walletType === 'cash' ? 'Cash' : 'Online'}</p>
      </div>
      <p class="text-[15px] font-black ${amountColor} shrink-0">${sign} ${formatINR(t.amount)}</p>
    `;
    feedList.appendChild(item);
  });
}

/* ---------------- Pending UPI Recovery ---------------- */

let pendingQueue = [];

async function checkPending() {
  pendingQueue = await getPendingTransactions();
  if (pendingQueue.length > 0) {
    showPendingModal();
  }
}

function showPendingModal() {
  const modal = document.getElementById('pending-modal');
  const tx = pendingQueue[0];
  if (!tx) {
    modal.classList.add('hidden');
    return;
  }
  document.getElementById('pending-desc').textContent =
    `You scanned a QR to pay ${formatINR(tx.amount)} for ${tx.category}.`;
  document.getElementById('pending-remaining').textContent =
    pendingQueue.length > 1 ? `${pendingQueue.length - 1} more pending after this` : '';
  modal.classList.remove('hidden');
}

document.getElementById('pending-confirm').addEventListener('click', async () => {
  const tx = pendingQueue.shift();
  if (tx) await commitPendingTransaction(tx.id);
  await refreshAll();
  showPendingModal();
});

document.getElementById('pending-cancel').addEventListener('click', async () => {
  const tx = pendingQueue.shift();
  if (tx) await cancelPendingTransaction(tx.id);
  await refreshAll();
  showPendingModal();
});

async function refreshAll() {
  await renderSummary();
  await renderFeed();
}

refreshAll().then(checkPending);
