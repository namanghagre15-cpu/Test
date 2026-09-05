/* ============================================================
   app.js — Dashboard (index.html) logic
   ============================================================ */
import { renderNav, showToast } from './nav.js';
import { initGhostToggle } from './ghost.js';
import { setMoneyText } from './ghost.js';
import {
  getAvailableToSpend,
  getTotalVaultLocked,
  getWallets,
  getRecentTransactions,
  getPendingTransactions,
  commitPendingTransaction,
  cancelPendingTransaction,
  getMonthlyIncomeExpense,
  getMonthlyBudget,
  getDailySafeToSpend,
  getLowBalanceThreshold,
  getCategoryBudgetStatus,
  generateInsights,
  getFinancialHealthScore,
  getCurrentNoSpendStreak,
  addExpense,
  formatINR,
  formatDate,
  categoryIcon,
} from './db.js';
import { icon } from './icons.js';

renderNav('dashboard');
window.__mfAppRendered = true;
initGhostToggle();

const feedList = document.getElementById('feed-list');
const feedEmpty = document.getElementById('feed-empty');

const CHILLAR_PRESETS = [
  { label: '+₹5 Xerox', amount: 5, category: 'Photostat' },
  { label: '+₹10 Chai', amount: 10, category: 'Outside Food' },
  { label: '+₹20 Auto', amount: 20, category: 'Travel' },
  { label: '+₹15 Printout', amount: 15, category: 'Photostat' },
  { label: '+₹30 Mess Extra', amount: 30, category: 'Mess' },
];

function renderChillarRow() {
  const row = document.getElementById('chillar-row');
  row.innerHTML = '';
  CHILLAR_PRESETS.forEach((preset) => {
    const btn = document.createElement('button');
    btn.className = 'chillar-btn';
    btn.textContent = preset.label;
    btn.addEventListener('click', async () => {
      await addExpense({
        amount: preset.amount,
        category: preset.category,
        walletType: 'cash',
        expenseType: 'want',
        note: 'Quick add',
        isPending: false,
      });
      showToast(`Added ${preset.label}`);
      await refreshAll();
    });
    row.appendChild(btn);
  });
}


async function renderCategoryBudgetAlerts() {
  const status = await getCategoryBudgetStatus();
  const el = document.getElementById('category-budget-alerts');
  const overBudget = status.filter((s) => s.pct >= 80);
  if (overBudget.length === 0) {
    el.innerHTML = '';
    return;
  }
  el.innerHTML = overBudget
    .map((s) => {
      const crossed = s.pct >= 100;
      return `
      <div class="rounded-2xl ${crossed ? 'bg-crimson/10 border-crimson/30' : 'bg-crimson/5 border-crimson/15'} border px-4 py-3 flex items-center gap-3">
        <span class="text-crimson shrink-0">${icon('alertTriangle', 16)}</span>
        <p class="text-[12px] font-bold ${crossed ? 'text-crimson' : 'text-ink'} leading-snug">
          ${crossed ? "You've crossed" : "You're close to"} your ${s.category} budget — ${formatINR(s.spent)} of ${formatINR(s.limit)} this month.
        </p>
      </div>`;
    })
    .join('');
}

async function renderSummary() {
  const [available, vaultLocked, wallets, dailySafe] = await Promise.all([
    getAvailableToSpend(),
    getTotalVaultLocked(),
    getWallets(),
    getDailySafeToSpend(),
  ]);

  setMoneyText(document.getElementById('available-amount'), formatINR(available));
  setMoneyText(document.getElementById('safe-budget'), formatINR(available));
  setMoneyText(document.getElementById('vault-locked'), formatINR(vaultLocked));
  document.getElementById('safe-today-line').textContent = `Today's safe budget: ${formatINR(dailySafe)}`;

  const cash = wallets.find((w) => w.type === 'cash');
  const online = wallets.find((w) => w.type === 'online');
  setMoneyText(document.getElementById('cash-balance'), formatINR(cash ? cash.balance : 0));
  setMoneyText(document.getElementById('online-balance'), formatINR(online ? online.balance : 0));

  // Low balance alert
  const threshold = getLowBalanceThreshold();
  document.getElementById('low-balance-alert').classList.toggle('hidden', available >= threshold);

  await renderCategoryBudgetAlerts();

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

  // Monthly budget block
  const budget = getMonthlyBudget();
  const budgetBlock = document.getElementById('budget-block');
  if (budget > 0) {
    budgetBlock.classList.remove('hidden');
    const pct = Math.min(100, Math.round((expense / budget) * 100));
    document.getElementById('budget-label').textContent = `${formatINR(expense)} / ${formatINR(budget)}`;
    document.getElementById('budget-fill').style.width = pct + '%';
    document.getElementById('budget-fill').style.background = pct >= 100 ? '#ca0013' : '#171e19';
  } else {
    budgetBlock.classList.add('hidden');
  }
}

async function renderHealthAndStreak() {
  const { score, label } = await getFinancialHealthScore();
  document.getElementById('health-score').textContent = score;
  document.getElementById('health-label').textContent = label;
  document.getElementById('streak-count').innerHTML = `${getCurrentNoSpendStreak()} <span class="text-[13px]">days</span> ${icon('fire', 16)}`;
}

async function renderInsights() {
  const insights = await generateInsights();
  const list = document.getElementById('insights-list');
  list.innerHTML = insights
    .map(
      (ins) => `
      <div class="bg-card rounded-2xl border border-sage-soft px-4 py-3 flex items-center gap-3">
        <div class="bento-icon shrink-0">${icon(ins.icon, 16)}</div>
        <p class="text-[13px] font-bold text-ink leading-snug">${ins.text}</p>
      </div>`
    )
    .join('');
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
    const isTransfer = t.type === 'transfer';
    const sign = isIncome ? '+' : isTransfer ? '↔' : '−';
    const amountColor = isIncome ? 'text-ink' : isTransfer ? 'text-sage' : 'text-crimson';
    const pendingBadge = t.isPending
      ? `<span class="text-[9px] uppercase tracking-widest font-black text-crimson bg-crimson/10 px-2 py-0.5 rounded-full ml-2">Pending</span>`
      : '';

    const item = document.createElement('div');
    item.className = 'bg-card rounded-3xl border border-sage-soft p-3 flex items-center gap-3';
    item.innerHTML = `
      <div class="feed-icon bg-crimson/10">${categoryIcon(t.category)}</div>
      <div class="flex-1 min-w-0">
        <p class="text-[16px] font-black leading-tight truncate">${t.category}${pendingBadge}</p>
        <p class="text-[12px] font-bold text-sage">${formatDate(t.date)} · ${t.walletType === 'cash' ? 'Cash' : 'Online'}</p>
      </div>
      <p class="text-[15px] font-black ${amountColor} shrink-0 mf-amt">${sign} ${formatINR(t.amount)}</p>
    `;
    feedList.appendChild(item);
    setMoneyText(item.querySelector('.mf-amt'), `${sign} ${formatINR(t.amount)}`);
  });
}

/* ---------------- Pending UPI Recovery ---------------- */

let pendingQueue = [];

async function checkPending() {
  pendingQueue = await getPendingTransactions();
  if (pendingQueue.length > 0) showPendingModal();
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
  await renderHealthAndStreak();
  await renderInsights();
  await renderFeed();
}

renderChillarRow();
refreshAll().then(checkPending);
