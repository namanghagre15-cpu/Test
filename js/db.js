/* ============================================================
   db.js — Money follow: Shared Dexie.js database + core logic
   Requires the classic Dexie CDN script (window.Dexie) to have
   executed BEFORE this module runs.
   ============================================================ */

export const db = new Dexie('MoneyFollowDB');

db.version(1).stores({
  transactions: '++id, amount, category, type, walletType, expenseType, date, note, isPending, recurringId',
  wallets: 'type, balance',
  vaultGoals: '++id, title, targetAmount, savedAmount, deadline, isEmergency',
  recurring: '++id, title, amount, category, walletType, expenseType, frequency, nextDueDate, active',
  ledger: '++id, personName, amount, direction, note, date, settled',
  splits: '++id, title, totalAmount, payer, date, note, participantsJson',
  challenges: '++id, type, status, startDate, endDate',
  archives: '++id, label, createdDate, snapshotJson',
});

/* ------------------------------------------------------------
   Local settings (localStorage) — synchronous, needed on paint
   for things like theme/ghost-mode/pin, so we avoid async races.
   ------------------------------------------------------------ */
const LS_PREFIX = 'mf_';

export function getLocal(key, fallback = null) {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function setLocal(key, value) {
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
  } catch {
    /* storage full or unavailable — fail silently, app still works */
  }
}

export function removeLocal(key) {
  localStorage.removeItem(LS_PREFIX + key);
}

/* ------------------------------------------------------------
   Wallet helpers (Dual-Wallet Math: cash vs online)
   ------------------------------------------------------------ */

export async function initWallets() {
  const cash = await db.wallets.get('cash');
  if (!cash) await db.wallets.put({ type: 'cash', balance: 0 });
  const online = await db.wallets.get('online');
  if (!online) await db.wallets.put({ type: 'online', balance: 0 });
}

export async function getWallets() {
  await initWallets();
  return db.wallets.toArray();
}

export async function getWalletBalance(type) {
  await initWallets();
  const w = await db.wallets.get(type);
  return w ? w.balance : 0;
}

export async function adjustWalletBalance(type, delta) {
  await initWallets();
  await db.transaction('rw', db.wallets, async () => {
    const w = await db.wallets.get(type);
    const newBalance = Math.round(((w ? w.balance : 0) + delta) * 100) / 100;
    await db.wallets.put({ type, balance: newBalance });
  });
}

export async function getTotalWalletBalance() {
  const wallets = await getWallets();
  return wallets.reduce((sum, w) => sum + w.balance, 0);
}

export async function transferBetweenWallets(fromType, toType, amount) {
  if (amount <= 0) throw new Error('Transfer amount must be greater than zero.');
  const fromBalance = await getWalletBalance(fromType);
  if (fromBalance < amount) throw new Error(`Insufficient balance in ${fromType} wallet.`);
  await adjustWalletBalance(fromType, -amount);
  await adjustWalletBalance(toType, amount);
  await db.transactions.add({
    amount,
    category: 'Wallet Transfer',
    type: 'transfer',
    walletType: fromType,
    expenseType: null,
    date: new Date().toISOString(),
    note: `Transferred to ${toType === 'cash' ? 'Cash' : 'Online'}`,
    isPending: 0,
    recurringId: null,
  });
}

/* ------------------------------------------------------------
   Payment-method memory: remember the last wallet used per category
   ------------------------------------------------------------ */

export function rememberWalletForCategory(category, walletType) {
  const map = getLocal('wallet_memory', {});
  map[category] = walletType;
  setLocal('wallet_memory', map);
}

export function recallWalletForCategory(category) {
  const map = getLocal('wallet_memory', {});
  return map[category] || null;
}

/* ------------------------------------------------------------
   Transactions: income + expenses
   ------------------------------------------------------------ */

export async function addIncome({ walletType, amount, note }) {
  await adjustWalletBalance(walletType, amount);
  return db.transactions.add({
    amount,
    category: 'Pocket Money',
    type: 'income',
    walletType,
    expenseType: null,
    date: new Date().toISOString(),
    note: note || '',
    isPending: 0,
    recurringId: null,
  });
}

export async function addExpense({ amount, category, walletType, expenseType, note, isPending, recurringId }) {
  const id = await db.transactions.add({
    amount,
    category,
    type: 'expense',
    walletType,
    expenseType,
    date: new Date().toISOString(),
    note: note || '',
    isPending: isPending ? 1 : 0,
    recurringId: recurringId || null,
  });
  if (!isPending) {
    await adjustWalletBalance(walletType, -amount);
  }
  rememberWalletForCategory(category, walletType);
  return id;
}

export async function getPendingTransactions() {
  return db.transactions.where('isPending').equals(1).toArray();
}

export async function commitPendingTransaction(id) {
  const tx = await db.transactions.get(id);
  if (!tx) return;
  await adjustWalletBalance(tx.walletType, -tx.amount);
  await db.transactions.update(id, { isPending: 0 });
}

export async function cancelPendingTransaction(id) {
  await db.transactions.delete(id);
}

export async function getRecentTransactions(limit = 8) {
  return db.transactions.orderBy('date').reverse().limit(limit).toArray();
}

export async function getAllTransactions() {
  return db.transactions.orderBy('date').reverse().toArray();
}

export async function getTransactionsInRange(startDate, endDate) {
  const all = await db.transactions.orderBy('date').reverse().toArray();
  return all.filter((t) => {
    const d = new Date(t.date);
    return d >= startDate && d <= endDate;
  });
}

export async function updateTransaction(id, changes) {
  const tx = await db.transactions.get(id);
  if (!tx) return;

  // Reverse the original wallet effect (if it had been committed)
  if (!tx.isPending) {
    if (tx.type === 'expense') await adjustWalletBalance(tx.walletType, tx.amount);
    else if (tx.type === 'income') await adjustWalletBalance(tx.walletType, -tx.amount);
  }

  const merged = { ...tx, ...changes };
  await db.transactions.update(id, changes);

  // Re-apply the new wallet effect
  if (!merged.isPending) {
    if (merged.type === 'expense') await adjustWalletBalance(merged.walletType, -merged.amount);
    else if (merged.type === 'income') await adjustWalletBalance(merged.walletType, merged.amount);
  }
}

export async function deleteTransaction(id) {
  const tx = await db.transactions.get(id);
  if (!tx) return;
  if (!tx.isPending) {
    if (tx.type === 'expense') await adjustWalletBalance(tx.walletType, tx.amount);
    else if (tx.type === 'income') await adjustWalletBalance(tx.walletType, -tx.amount);
  }
  await db.transactions.delete(id);
}

export async function searchTransactions({ query, category, type, walletType, expenseType, startDate, endDate }) {
  let list = await db.transactions.orderBy('date').reverse().toArray();
  if (query) {
    const q = query.toLowerCase();
    list = list.filter(
      (t) => (t.note || '').toLowerCase().includes(q) || (t.category || '').toLowerCase().includes(q)
    );
  }
  if (category) list = list.filter((t) => t.category === category);
  if (type) list = list.filter((t) => t.type === type);
  if (walletType) list = list.filter((t) => t.walletType === walletType);
  if (expenseType) list = list.filter((t) => t.expenseType === expenseType);
  if (startDate) list = list.filter((t) => new Date(t.date) >= startDate);
  if (endDate) list = list.filter((t) => new Date(t.date) <= endDate);
  return list;
}

/* ------------------------------------------------------------
   Discipline Vault (savings goals + emergency fund)
   ------------------------------------------------------------ */

export async function getVaultGoals() {
  return db.vaultGoals.toArray();
}

export async function initEmergencyFund() {
  const existing = await db.vaultGoals.where('isEmergency').equals(1).first();
  if (!existing) {
    await db.vaultGoals.add({
      title: 'Emergency Fund',
      targetAmount: 0,
      savedAmount: 0,
      deadline: null,
      isEmergency: 1,
    });
  }
}

export async function addVaultGoal({ title, targetAmount, deadline }) {
  return db.vaultGoals.add({ title, targetAmount, savedAmount: 0, deadline: deadline || null, isEmergency: 0 });
}

export async function contributeToVaultGoal(goalId, amount, walletType) {
  const balance = await getWalletBalance(walletType);
  if (amount <= 0) throw new Error('Amount must be greater than zero');
  if (balance < amount) throw new Error(`Insufficient balance in ${walletType} wallet`);
  await adjustWalletBalance(walletType, -amount);
  const goal = await db.vaultGoals.get(goalId);
  await db.vaultGoals.update(goalId, { savedAmount: goal.savedAmount + amount });
}

export async function withdrawFromVaultGoal(goalId, amount, walletType) {
  const goal = await db.vaultGoals.get(goalId);
  if (!goal || goal.savedAmount < amount) throw new Error('Insufficient vault balance');
  await db.vaultGoals.update(goalId, { savedAmount: goal.savedAmount - amount });
  await adjustWalletBalance(walletType, amount);
}

export async function deleteVaultGoal(goalId) {
  return db.vaultGoals.delete(goalId);
}

export async function getTotalVaultLocked() {
  const goals = await db.vaultGoals.toArray();
  return goals.reduce((sum, g) => sum + g.savedAmount, 0);
}

/* ------------------------------------------------------------
   Dashboard aggregate helpers
   ------------------------------------------------------------ */

// Wallet balances already exclude vault-locked money (contributing to a
// goal debits the wallet), so "available to spend" = sum of wallets.
export async function getAvailableToSpend() {
  return getTotalWalletBalance();
}

export async function getCategoryBreakdown(startDate, endDate) {
  let txs = await db.transactions.where('type').equals('expense').toArray();
  if (startDate) txs = txs.filter((t) => new Date(t.date) >= startDate);
  if (endDate) txs = txs.filter((t) => new Date(t.date) <= endDate);
  const map = {};
  txs.forEach((t) => {
    if (t.isPending) return;
    map[t.category] = (map[t.category] || 0) + t.amount;
  });
  return map;
}

export async function getNeedsVsWants(startDate, endDate) {
  let txs = await db.transactions.where('type').equals('expense').toArray();
  if (startDate) txs = txs.filter((t) => new Date(t.date) >= startDate);
  if (endDate) txs = txs.filter((t) => new Date(t.date) <= endDate);
  let need = 0;
  let want = 0;
  txs.forEach((t) => {
    if (t.isPending) return;
    if (t.expenseType === 'need') need += t.amount;
    else if (t.expenseType === 'want') want += t.amount;
  });
  return { need, want };
}

export async function getCashVsOnline(startDate, endDate) {
  let txs = await db.transactions.where('type').equals('expense').toArray();
  if (startDate) txs = txs.filter((t) => new Date(t.date) >= startDate);
  if (endDate) txs = txs.filter((t) => new Date(t.date) <= endDate);
  let cash = 0;
  let online = 0;
  txs.forEach((t) => {
    if (t.isPending) return;
    if (t.walletType === 'cash') cash += t.amount;
    else if (t.walletType === 'online') online += t.amount;
  });
  return { cash, online };
}

export async function getDailySpendBuckets(days = 7) {
  const txs = await db.transactions.where('type').equals('expense').toArray();
  const buckets = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const label =
      days <= 7
        ? d.toLocaleDateString('en-IN', { weekday: 'short' })
        : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    buckets.push({ label, key: d.toDateString(), total: 0 });
  }
  txs.forEach((t) => {
    if (t.isPending) return;
    const key = new Date(t.date).toDateString();
    const bucket = buckets.find((b) => b.key === key);
    if (bucket) bucket.total += t.amount;
  });
  return buckets;
}

export async function getMonthlyIncomeExpense(monthOffset = 0) {
  const txs = await db.transactions.toArray();
  let income = 0;
  let expense = 0;
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  txs.forEach((t) => {
    const d = new Date(t.date);
    if (d.getMonth() !== target.getMonth() || d.getFullYear() !== target.getFullYear()) return;
    if (t.isPending) return;
    if (t.type === 'income') income += t.amount;
    else if (t.type === 'expense') expense += t.amount;
  });
  return { income, expense };
}

export async function getBiggestExpense(startDate, endDate) {
  let txs = await db.transactions.where('type').equals('expense').toArray();
  if (startDate) txs = txs.filter((t) => new Date(t.date) >= startDate);
  if (endDate) txs = txs.filter((t) => new Date(t.date) <= endDate);
  txs = txs.filter((t) => !t.isPending);
  if (txs.length === 0) return null;
  return txs.reduce((max, t) => (t.amount > max.amount ? t : max), txs[0]);
}

export async function getAverageDailySpend(startDate, endDate) {
  let txs = await db.transactions.where('type').equals('expense').toArray();
  txs = txs.filter((t) => !t.isPending && new Date(t.date) >= startDate && new Date(t.date) <= endDate);
  const total = txs.reduce((sum, t) => sum + t.amount, 0);
  const dayCount = Math.max(1, Math.round((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1);
  return total / dayCount;
}

/* ------------------------------------------------------------
   Monthly Budget & Daily Safe-to-Spend
   ------------------------------------------------------------ */

export function getMonthlyBudget() {
  return getLocal('monthly_budget', 0);
}

export function setMonthlyBudget(amount) {
  setLocal('monthly_budget', amount);
}

export async function getDailySafeToSpend() {
  const available = await getAvailableToSpend();
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = daysInMonth - now.getDate() + 1;
  return available / Math.max(1, daysLeft);
}

export function getLowBalanceThreshold() {
  return getLocal('low_balance_threshold', 100);
}

export function setLowBalanceThreshold(amount) {
  setLocal('low_balance_threshold', amount);
}

/* ------------------------------------------------------------
   Mess vs Outside Food alert
   ------------------------------------------------------------ */

export function getOutsideFoodWeeklyLimit() {
  return getLocal('outside_food_limit', 500);
}

export function setOutsideFoodWeeklyLimit(amount) {
  setLocal('outside_food_limit', amount);
}

export async function getThisWeekOutsideFoodSpend() {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay());
  start.setHours(0, 0, 0, 0);
  const txs = await db.transactions.where('type').equals('expense').toArray();
  return txs
    .filter((t) => !t.isPending && t.category === 'Outside Food' && new Date(t.date) >= start)
    .reduce((sum, t) => sum + t.amount, 0);
}

/* ------------------------------------------------------------
   Smart Spending Insights (rule-based)
   ------------------------------------------------------------ */

export async function generateInsights() {
  const insights = [];
  const { income, expense } = await getMonthlyIncomeExpense();
  const { need, want } = await getNeedsVsWants();
  const breakdown = await getCategoryBreakdown();
  const budget = getMonthlyBudget();

  if (income === 0 && expense === 0) {
    insights.push('👋 Add your first pocket money entry to start tracking this month.');
    return insights;
  }

  if (want + need > 0) {
    const wantPct = Math.round((want / (want + need)) * 100);
    if (wantPct >= 50) {
      insights.push(`✨ ${wantPct}% of your spending this month is on Wants — maybe park some in the Vault?`);
    } else {
      insights.push(`🧠 Nice discipline — only ${wantPct}% went to Wants this month.`);
    }
  }

  const topCategory = Object.entries(breakdown).sort((a, b) => b[1] - a[1])[0];
  if (topCategory) {
    insights.push(`📌 ${topCategory[0]} is your top spend this month at ₹${Math.round(topCategory[1])}.`);
  }

  if (budget > 0) {
    const pct = Math.round((expense / budget) * 100);
    if (pct >= 100) insights.push(`🚨 You've crossed your monthly budget (${pct}% used).`);
    else if (pct >= 80) insights.push(`⚠️ You've used ${pct}% of your monthly budget already.`);
    else insights.push(`✅ You're at ${pct}% of your monthly budget — good pace.`);
  }

  return insights;
}

/* ------------------------------------------------------------
   Financial Health Score (0-100, rule-based composite)
   ------------------------------------------------------------ */

export async function getFinancialHealthScore() {
  const { income, expense } = await getMonthlyIncomeExpense();
  const { need, want } = await getNeedsVsWants();
  const vaultLocked = await getTotalVaultLocked();
  const budget = getMonthlyBudget();

  let score = 50; // baseline

  // Budget adherence (up to +/-20)
  if (budget > 0) {
    const usage = expense / budget;
    if (usage <= 0.8) score += 20;
    else if (usage <= 1) score += 10;
    else score -= 20;
  }

  // Needs vs wants ratio (up to +20)
  const totalSpend = need + want;
  if (totalSpend > 0) {
    const needRatio = need / totalSpend;
    score += Math.round((needRatio - 0.5) * 40); // reward need-heavy spending
  }

  // Savings rate: vault locked relative to income (up to +20)
  if (income > 0) {
    const savingsRate = vaultLocked / income;
    score += Math.min(20, Math.round(savingsRate * 40));
  }

  // No-spend streak bonus (up to +10)
  const streak = getCurrentNoSpendStreak();
  score += Math.min(10, streak * 2);

  score = Math.max(0, Math.min(100, Math.round(score)));

  let label = 'Needs Work';
  if (score >= 80) label = 'Excellent';
  else if (score >= 60) label = 'Good';
  else if (score >= 40) label = 'Fair';

  return { score, label };
}

/* ------------------------------------------------------------
   No-Spend Day streak & Savings Challenges
   ------------------------------------------------------------ */

export function getNoSpendDays() {
  return getLocal('no_spend_days', []);
}

export async function canMarkTodayNoSpend() {
  const today = new Date().toDateString();
  const days = getNoSpendDays();
  if (days.includes(today)) return false;
  const txs = await db.transactions.where('type').equals('expense').toArray();
  const hasExpenseToday = txs.some((t) => !t.isPending && new Date(t.date).toDateString() === today);
  return !hasExpenseToday;
}

export function markTodayNoSpend() {
  const today = new Date().toDateString();
  const days = getNoSpendDays();
  if (!days.includes(today)) {
    days.push(today);
    setLocal('no_spend_days', days);
  }
}

export function getCurrentNoSpendStreak() {
  const days = new Set(getNoSpendDays());
  let streak = 0;
  const cursor = new Date();
  // Count backward from today while consecutive days are marked
  while (days.has(cursor.toDateString())) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export async function getChallengeProgress() {
  const streak = getCurrentNoSpendStreak();
  const vaultLocked = await getTotalVaultLocked();
  const goals = await getVaultGoals();

  return [
    {
      id: 'no_spend_day',
      title: 'No-Spend Day',
      emoji: '🚫💸',
      description: 'Log a full day with zero expenses.',
      progress: getNoSpendDays().length > 0 ? 1 : 0,
      target: 1,
      complete: getNoSpendDays().length > 0,
    },
    {
      id: 'streak_7',
      title: '7-Day No-Spend Streak',
      emoji: '🔥',
      description: 'Hit 7 consecutive no-spend days.',
      progress: Math.min(streak, 7),
      target: 7,
      complete: streak >= 7,
    },
    {
      id: 'vault_starter',
      title: 'Vault Starter',
      emoji: '🏦',
      description: 'Lock away your first ₹100 in the Vault.',
      progress: Math.min(vaultLocked, 100),
      target: 100,
      complete: vaultLocked >= 100 && goals.length > 0,
    },
  ];
}

/* ------------------------------------------------------------
   Recurring Expenses
   ------------------------------------------------------------ */

export async function getRecurringList() {
  return db.recurring.toArray();
}

export async function addRecurring({ title, amount, category, walletType, expenseType, frequency, startDate }) {
  return db.recurring.add({
    title,
    amount,
    category,
    walletType,
    expenseType,
    frequency, // 'weekly' | 'monthly'
    nextDueDate: startDate || new Date().toISOString(),
    active: 1,
  });
}

export async function deleteRecurring(id) {
  return db.recurring.delete(id);
}

export async function toggleRecurringActive(id, active) {
  return db.recurring.update(id, { active: active ? 1 : 0 });
}

function advanceDate(iso, frequency) {
  const d = new Date(iso);
  if (frequency === 'weekly') d.setDate(d.getDate() + 7);
  else d.setMonth(d.getMonth() + 1);
  return d.toISOString();
}

// Runs on dashboard load: auto-post any recurring expense that is due,
// then advances its schedule. Returns a list of newly created entries.
export async function runDueRecurring() {
  const items = await db.recurring.where('active').equals(1).toArray();
  const posted = [];
  const now = new Date();
  for (const item of items) {
    let due = new Date(item.nextDueDate);
    let safety = 0;
    while (due <= now && safety < 24) {
      await addExpense({
        amount: item.amount,
        category: item.category,
        walletType: item.walletType,
        expenseType: item.expenseType,
        note: `Recurring: ${item.title}`,
        isPending: false,
        recurringId: item.id,
      });
      posted.push(item.title);
      const nextIso = advanceDate(due.toISOString(), item.frequency);
      due = new Date(nextIso);
      await db.recurring.update(item.id, { nextDueDate: nextIso });
      safety++;
    }
  }
  return posted;
}

/* ------------------------------------------------------------
   Khata: Lend/Borrow ledger + Roommate splitter
   ------------------------------------------------------------ */

export async function addLedgerEntry({ personName, amount, direction, note }) {
  return db.ledger.add({
    personName,
    amount,
    direction, // 'owe_me' | 'i_owe'
    note: note || '',
    date: new Date().toISOString(),
    settled: 0,
  });
}

export async function getLedgerEntries() {
  return db.ledger.orderBy('date').reverse().toArray();
}

export async function markLedgerSettled(id) {
  return db.ledger.update(id, { settled: 1 });
}

export async function deleteLedgerEntry(id) {
  return db.ledger.delete(id);
}

export async function getLedgerTotals() {
  const entries = await getLedgerEntries();
  let owedToMe = 0;
  let iOwe = 0;
  entries.forEach((e) => {
    if (e.settled) return;
    if (e.direction === 'owe_me') owedToMe += e.amount;
    else iOwe += e.amount;
  });
  return { owedToMe, iOwe };
}

export function buildWhatsAppReminderLink(personName, amount, note) {
  const msg = `Hi ${personName}! Just a friendly reminder — ${formatINR(amount)}${
    note ? ` (${note})` : ''
  } is pending. Whenever you get a chance 🙂`;
  return `https://wa.me/?text=${encodeURIComponent(msg)}`;
}

export async function addSplit({ title, totalAmount, payer, participants, note }) {
  // participants: array of { name, iPaid (bool) } — even split among all participants
  const share = Math.round((totalAmount / participants.length) * 100) / 100;
  const id = await db.splits.add({
    title,
    totalAmount,
    payer,
    date: new Date().toISOString(),
    note: note || '',
    participantsJson: JSON.stringify(participants.map((p) => ({ ...p, share }))),
  });

  // If the current user paid, auto-create "owe_me" ledger entries for everyone else
  if (payer === 'me') {
    for (const p of participants) {
      if (p.name && p.name.toLowerCase() !== 'me') {
        await addLedgerEntry({
          personName: p.name,
          amount: share,
          direction: 'owe_me',
          note: `Split: ${title}`,
        });
      }
    }
  }
  return id;
}

export async function getSplits() {
  const rows = await db.splits.orderBy('date').reverse().toArray();
  return rows.map((r) => ({ ...r, participants: JSON.parse(r.participantsJson || '[]') }));
}

export async function deleteSplit(id) {
  return db.splits.delete(id);
}

/* ------------------------------------------------------------
   Semester-wise Archive
   ------------------------------------------------------------ */

export async function archiveCurrentSemester(label) {
  const txs = await getAllTransactions();
  const { income, expense } = await computeAllTimeTotalsFrom(txs);
  const breakdown = {};
  txs.forEach((t) => {
    if (t.type === 'expense' && !t.isPending) breakdown[t.category] = (breakdown[t.category] || 0) + t.amount;
  });

  const snapshot = {
    transactionCount: txs.length,
    income,
    expense,
    breakdown,
  };

  await db.archives.add({
    label,
    createdDate: new Date().toISOString(),
    snapshotJson: JSON.stringify(snapshot),
  });

  await db.transactions.clear();
}

async function computeAllTimeTotalsFrom(txs) {
  let income = 0;
  let expense = 0;
  txs.forEach((t) => {
    if (t.isPending) return;
    if (t.type === 'income') income += t.amount;
    else if (t.type === 'expense') expense += t.amount;
  });
  return { income, expense };
}

export async function getArchives() {
  const rows = await db.archives.orderBy('createdDate').reverse().toArray();
  return rows.map((r) => ({ ...r, snapshot: JSON.parse(r.snapshotJson || '{}') }));
}

export async function deleteArchive(id) {
  return db.archives.delete(id);
}

/* ------------------------------------------------------------
   JSON Backup Export / Import
   ------------------------------------------------------------ */

export async function exportBackupJSON() {
  const [transactions, wallets, vaultGoals, recurring, ledger, splits, challenges, archives] = await Promise.all([
    db.transactions.toArray(),
    db.wallets.toArray(),
    db.vaultGoals.toArray(),
    db.recurring.toArray(),
    db.ledger.toArray(),
    db.splits.toArray(),
    db.challenges.toArray(),
    db.archives.toArray(),
  ]);

  const localSettings = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(LS_PREFIX)) localSettings[k] = localStorage.getItem(k);
  }

  const backup = {
    app: 'Money follow',
    exportedAt: new Date().toISOString(),
    version: 1,
    data: { transactions, wallets, vaultGoals, recurring, ledger, splits, challenges, archives },
    localSettings,
  };

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `money-follow-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function importBackupJSON(file) {
  const text = await file.text();
  const backup = JSON.parse(text);
  if (!backup || !backup.data) throw new Error('This file does not look like a valid Money follow backup.');

  const { transactions, wallets, vaultGoals, recurring, ledger, splits, challenges, archives } = backup.data;

  await db.transaction(
    'rw',
    [db.transactions, db.wallets, db.vaultGoals, db.recurring, db.ledger, db.splits, db.challenges, db.archives],
    async () => {
      await Promise.all([
        db.transactions.clear(),
        db.wallets.clear(),
        db.vaultGoals.clear(),
        db.recurring.clear(),
        db.ledger.clear(),
        db.splits.clear(),
        db.challenges.clear(),
        db.archives.clear(),
      ]);
      if (transactions) await db.transactions.bulkAdd(transactions);
      if (wallets) await db.wallets.bulkAdd(wallets);
      if (vaultGoals) await db.vaultGoals.bulkAdd(vaultGoals);
      if (recurring) await db.recurring.bulkAdd(recurring);
      if (ledger) await db.ledger.bulkAdd(ledger);
      if (splits) await db.splits.bulkAdd(splits);
      if (challenges) await db.challenges.bulkAdd(challenges);
      if (archives) await db.archives.bulkAdd(archives);
    }
  );

  if (backup.localSettings) {
    Object.entries(backup.localSettings).forEach(([k, v]) => {
      try {
        localStorage.setItem(k, v);
      } catch {
        /* ignore */
      }
    });
  }
}

export async function wipeAllData() {
  await Promise.all([
    db.transactions.clear(),
    db.vaultGoals.clear(),
    db.recurring.clear(),
    db.ledger.clear(),
    db.splits.clear(),
    db.challenges.clear(),
    db.archives.clear(),
  ]);
  await db.wallets.clear();
  await initWallets();
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i);
    if (k && k.startsWith(LS_PREFIX) && !k.includes('theme')) localStorage.removeItem(k);
  }
}

/* ------------------------------------------------------------
   Formatting utilities
   ------------------------------------------------------------ */

export function formatINR(amount) {
  const n = Number(amount) || 0;
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

export function formatDate(iso) {
  const d = new Date(iso);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  if (isToday) return 'Today, ' + d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  if (isYesterday) return 'Yesterday, ' + d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export const CATEGORIES = [
  'Mess',
  'Outside Food',
  'Travel',
  'Books',
  'Fun',
  'Bills',
  'Semester Fees',
  'Photostat',
  'Lab Material',
  'Rent',
  'Health',
  'Other',
];

export const CATEGORY_ICONS = {
  Mess: '🍛',
  'Outside Food': '🍔',
  Travel: '🚌',
  Books: '📚',
  Fun: '🎮',
  Bills: '🧾',
  'Semester Fees': '🎓',
  Photostat: '🖨️',
  'Lab Material': '🧪',
  Rent: '🏠',
  Health: '💊',
  Other: '🛍️',
  'Pocket Money': '💵',
  'Wallet Transfer': '🔄',
};

export function categoryIcon(category) {
  return CATEGORY_ICONS[category] || '💳';
}

// Time-based category suggestion (breakfast/mess in morning, travel midday, dinner at night)
export function suggestCategoryByTime() {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 10) return 'Mess';
  if (hour >= 10 && hour < 16) return 'Travel';
  if (hour >= 16 && hour < 20) return 'Fun';
  if (hour >= 20 || hour < 1) return 'Outside Food';
  return 'Other';
}
