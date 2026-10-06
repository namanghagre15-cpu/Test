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
  detectRecurringCandidates,
  dismissRecurringSuggestion,
  addRecurring,
  generateInsights,
  getFinancialHealthScore,
  getCurrentNoSpendStreak,
  addExpense,
  formatINR,
  formatDate,
  categoryIcon,
  getUserProfile,
  getChillarPresets,
  setChillarPresets,
  CATEGORIES,
  getLedgerTotals,
  getLedgerEntries,
} from './db.js';
import { icon } from './icons.js';
import { confirmDialog } from './dialog.js';

renderNav('dashboard');
window.__mfAppRendered = true;
initGhostToggle();

document.getElementById('greeting-name').textContent = getUserProfile().name || 'there';
document.getElementById('today-date').textContent = new Date().toLocaleDateString('en-IN', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});
const nowHour = new Date().getHours();
document.getElementById('greeting-word').textContent =
  nowHour < 12 ? 'Good morning' : nowHour < 17 ? 'Good afternoon' : 'Good evening';

const feedList = document.getElementById('feed-list');
const feedEmpty = document.getElementById('feed-empty');

/* ---------------- Chillar — editable one-tap quick-add presets ---------------- */

function renderChillarRow() {
  const presets = getChillarPresets();
  const row = document.getElementById('chillar-row');
  row.innerHTML = '';
  presets.forEach((preset, i) => {
    const btn = document.createElement('button');
    btn.className = 'chillar-btn';
    btn.innerHTML = `<span class="chillar-ico chillar-tint-${i % 5}">${categoryIcon(preset.category, 15)}</span><span>${preset.label}</span>`;
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

const chillarSheet = document.getElementById('chillar-sheet');
const chillarCategorySelect = document.getElementById('chillar-new-category');
CATEGORIES.forEach((cat) => {
  const opt = document.createElement('option');
  opt.value = cat;
  opt.textContent = cat;
  chillarCategorySelect.appendChild(opt);
});

let editingChillarIndex = null;

function renderChillarEditList() {
  const presets = getChillarPresets();
  const list = document.getElementById('chillar-list');
  if (presets.length === 0) {
    list.innerHTML = '<p class="text-[12px] font-bold text-sage text-center py-4">No presets yet — add one below.</p>';
    return;
  }
  list.innerHTML = presets
    .map(
      (p, i) => `
      <div class="flex items-center justify-between bg-sage/10 rounded-2xl px-4 py-3 ${editingChillarIndex === i ? 'border border-crimson/40' : ''}">
        <div class="min-w-0">
          <p class="text-[13px] font-black truncate">${p.label}</p>
          <p class="text-[11px] font-bold text-sage">₹${p.amount} · ${p.category}</p>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <button data-edit-chillar="${i}" class="w-8 h-8 rounded-full bg-sage/20 text-ink flex items-center justify-center">${icon('edit', 13)}</button>
          <button data-remove-chillar="${i}" class="w-8 h-8 rounded-full bg-crimson/10 text-crimson flex items-center justify-center">${icon('trash', 14)}</button>
        </div>
      </div>`
    )
    .join('');
  list.querySelectorAll('[data-remove-chillar]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!(await confirmDialog('Remove this quick-add preset?', { okLabel: 'Remove' }))) return;
      const presetsNow = getChillarPresets();
      presetsNow.splice(Number(btn.dataset.removeChillar), 1);
      setChillarPresets(presetsNow);
      if (editingChillarIndex === Number(btn.dataset.removeChillar)) resetChillarForm();
      renderChillarEditList();
      renderChillarRow();
    });
  });
  list.querySelectorAll('[data-edit-chillar]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const i = Number(btn.dataset.editChillar);
      const p = getChillarPresets()[i];
      editingChillarIndex = i;
      document.getElementById('chillar-new-label').value = p.label.replace(/^\+₹\d+(\.\d+)?\s*/, '');
      document.getElementById('chillar-new-amount').value = p.amount;
      chillarCategorySelect.value = p.category;
      document.getElementById('chillar-add-btn').textContent = 'Save Changes';
      renderChillarEditList();
    });
  });
}

function resetChillarForm() {
  editingChillarIndex = null;
  document.getElementById('chillar-new-label').value = '';
  document.getElementById('chillar-new-amount').value = '';
  document.getElementById('chillar-add-btn').textContent = 'Add Preset';
}

document.getElementById('chillar-edit-btn').addEventListener('click', () => {
  resetChillarForm();
  renderChillarEditList();
  chillarSheet.classList.remove('hidden');
});
document.getElementById('chillar-sheet-overlay').addEventListener('click', (e) => {
  if (e.target.id === 'chillar-sheet-overlay') {
    resetChillarForm();
    chillarSheet.classList.add('hidden');
  }
});
document.getElementById('chillar-sheet-done').addEventListener('click', () => {
  resetChillarForm();
  chillarSheet.classList.add('hidden');
});

document.getElementById('chillar-add-btn').addEventListener('click', () => {
  const label = document.getElementById('chillar-new-label').value.trim();
  const amount = parseFloat(document.getElementById('chillar-new-amount').value);
  const category = chillarCategorySelect.value;
  if (!label || !amount || amount <= 0) return;
  const presets = getChillarPresets();
  const newPreset = { label: `+₹${amount} ${label}`, amount, category };
  if (editingChillarIndex !== null) {
    presets[editingChillarIndex] = newPreset;
  } else {
    presets.push(newPreset);
  }
  setChillarPresets(presets);
  resetChillarForm();
  renderChillarEditList();
  renderChillarRow();
});


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

async function renderRecurringSuggestions() {
  const candidates = await detectRecurringCandidates();
  const el = document.getElementById('recurring-suggestions');
  if (candidates.length === 0) {
    el.innerHTML = '';
    return;
  }
  el.innerHTML = candidates
    .slice(0, 2)
    .map(
      (c) => `
      <div class="rounded-2xl bg-sage/10 border border-sage-soft px-4 py-3">
        <p class="text-[12px] font-bold text-ink leading-snug mb-2 flex items-center gap-2">
          <span class="text-crimson shrink-0">${icon('repeat', 15)}</span>
          You've spent ${formatINR(c.amount)} on ${c.category} ${c.count} times — make it recurring?
        </p>
        <div class="flex gap-2">
          <button data-add-recurring="${c.key}" class="flex-1 py-2 rounded-xl bg-charcoal text-white font-black text-[11px]">Add as Recurring</button>
          <button data-dismiss-recurring="${c.key}" class="px-3 py-2 rounded-xl border border-sage-soft font-black text-[11px] text-sage">Not now</button>
        </div>
      </div>`
    )
    .join('');

  el.querySelectorAll('[data-dismiss-recurring]').forEach((btn) => {
    btn.addEventListener('click', () => {
      dismissRecurringSuggestion(btn.dataset.dismissRecurring);
      renderRecurringSuggestions();
    });
  });
  el.querySelectorAll('[data-add-recurring]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const c = candidates.find((x) => x.key === btn.dataset.addRecurring);
      if (!c) return;
      await addRecurring({
        title: c.category,
        amount: c.amount,
        category: c.category,
        walletType: c.walletType,
        expenseType: c.expenseType,
        frequency: 'monthly',
      });
      showToast(`${c.category} added as a recurring expense`);
      await renderRecurringSuggestions();
    });
  });
}

function initials(name) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?';
}

async function renderKhataTeaser() {
  const [{ owedToMe, iOwe }, entries] = await Promise.all([getLedgerTotals(), getLedgerEntries()]);
  setMoneyText(document.getElementById('khata-teaser-owed'), formatINR(owedToMe));
  setMoneyText(document.getElementById('khata-teaser-owe'), formatINR(iOwe));
  const open = entries.filter((e) => !e.settled);
  document.getElementById('khata-teaser-sub').textContent =
    open.length > 0 ? `Money between you and friends · ${open.length} open` : 'Nothing pending — all settled up';

  const entriesEl = document.getElementById('khata-teaser-entries');
  entriesEl.innerHTML = open
    .slice(0, 2)
    .map((e) => {
      const theyOweMe = e.direction === 'owe_me';
      return `
      <div class="khata-entry-row">
        <span class="khata-avatar">${initials(e.personName)}</span>
        <div class="min-w-0 flex-1">
          <p class="text-[13px] font-black truncate">${e.personName}</p>
          ${e.note ? `<p class="text-[11px] font-bold text-ink-soft truncate">${e.note}</p>` : ''}
        </div>
        <div class="text-right shrink-0">
          <p class="text-[13px] font-black ${theyOweMe ? 'text-crimson' : 'text-ink'}">${formatINR(e.amount)}</p>
          <p class="text-[10px] font-bold text-ink-soft">${theyOweMe ? 'owes you' : 'you owe'}</p>
        </div>
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
  const cashBal = cash ? cash.balance : 0;
  const onlineBal = online ? online.balance : 0;
  setMoneyText(document.getElementById('cash-balance'), formatINR(cashBal));
  setMoneyText(document.getElementById('online-balance'), formatINR(onlineBal));
  const walletTotal = cashBal + onlineBal;
  const cashPct = walletTotal > 0 ? Math.round((cashBal / walletTotal) * 100) : 50;
  document.getElementById('cash-online-fill').style.width = `${cashPct}%`;

  // Low balance alert
  const threshold = getLowBalanceThreshold();
  const lowBalanceActive = available < threshold;
  document.getElementById('low-balance-alert').classList.toggle('hidden', !lowBalanceActive);
  document.getElementById('notif-badge').classList.toggle('hidden', !lowBalanceActive);

  await renderCategoryBudgetAlerts();
  await renderRecurringSuggestions();
  await renderKhataTeaser();

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
    const monthName = new Date().toLocaleDateString('en-IN', { month: 'long' });
    document.getElementById('budget-month-label').textContent = `${monthName} budget`;
    document.getElementById('budget-label').textContent = `${formatINR(expense)} / ${formatINR(budget)}`;
    document.getElementById('budget-fill').style.width = pct + '%';
    document.getElementById('budget-fill').style.background = pct >= 100 ? '#ca0013' : '#ffffff';
  } else {
    budgetBlock.classList.add('hidden');
  }

  // Days left in the month (hero pill)
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = lastDay - now.getDate();
  document.getElementById('days-left-pill').textContent =
    daysLeft <= 0 ? 'Last day' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`;
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

    const title = t.note ? t.note : t.category;
    const subtitle = t.note ? `${t.category} · ${formatDate(t.date)}` : formatDate(t.date);
    const walletLabel = t.walletType === 'cash' ? 'Cash' : 'Online';

    const item = document.createElement('div');
    item.className = 'bg-card rounded-3xl border border-sage-soft p-3 flex items-center gap-3';
    item.innerHTML = `
      <div class="feed-icon bg-crimson/10">${categoryIcon(t.category)}</div>
      <div class="flex-1 min-w-0">
        <p class="text-[16px] font-black leading-tight truncate">${title}${pendingBadge}</p>
        <p class="text-[12px] font-bold text-sage truncate">${subtitle}</p>
      </div>
      <div class="text-right shrink-0">
        <p class="text-[15px] font-black ${amountColor} mf-amt">${sign} ${formatINR(t.amount)}</p>
        ${!isTransfer ? `<span class="feed-wallet-tag">${walletLabel}</span>` : ''}
      </div>
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
