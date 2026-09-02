/* ============================================================
   db.js — Shared Dexie.js database + core data logic
   Loaded as an ES module. Requires the classic Dexie CDN script
   (window.Dexie) to have executed BEFORE this module runs.
   ============================================================ */

export const db = new Dexie('StudentExpenseTrackerDB');

db.version(1).stores({
  // ++id = auto-increment primary key
  transactions: '++id, amount, category, type, walletType, expenseType, date, note, isPending',
  wallets: 'type, balance',
  vaultGoals: '++id, title, targetAmount, savedAmount, deadline',
});

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
  });
}

export async function addExpense({ amount, category, walletType, expenseType, note, isPending }) {
  const id = await db.transactions.add({
    amount,
    category,
    type: 'expense',
    walletType,
    expenseType,
    date: new Date().toISOString(),
    note: note || '',
    isPending: isPending ? 1 : 0,
  });
  if (!isPending) {
    await adjustWalletBalance(walletType, -amount);
  }
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

export async function deleteTransaction(id) {
  const tx = await db.transactions.get(id);
  if (!tx) return;
  // Refund the wallet if the transaction had actually been committed
  if (!tx.isPending) {
    if (tx.type === 'expense') {
      await adjustWalletBalance(tx.walletType, tx.amount);
    } else if (tx.type === 'income') {
      await adjustWalletBalance(tx.walletType, -tx.amount);
    }
  }
  await db.transactions.delete(id);
}

/* ------------------------------------------------------------
   Discipline Vault (savings goals)
   ------------------------------------------------------------ */

export async function getVaultGoals() {
  return db.vaultGoals.toArray();
}

export async function addVaultGoal({ title, targetAmount, deadline }) {
  return db.vaultGoals.add({ title, targetAmount, savedAmount: 0, deadline: deadline || null });
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

// Wallet balances already exclude money that has been locked into the vault
// (contributeToVaultGoal deducts from the wallet), so "available to spend"
// is simply the sum of wallet balances.
export async function getAvailableToSpend() {
  return getTotalWalletBalance();
}

export async function getCategoryBreakdown() {
  const txs = await db.transactions.where('type').equals('expense').toArray();
  const map = {};
  txs.forEach((t) => {
    if (t.isPending) return;
    map[t.category] = (map[t.category] || 0) + t.amount;
  });
  return map;
}

export async function getNeedsVsWants() {
  const txs = await db.transactions.where('type').equals('expense').toArray();
  let need = 0;
  let want = 0;
  txs.forEach((t) => {
    if (t.isPending) return;
    if (t.expenseType === 'need') need += t.amount;
    else if (t.expenseType === 'want') want += t.amount;
  });
  return { need, want };
}

export async function getWeeklySpend(days = 7) {
  const txs = await db.transactions.where('type').equals('expense').toArray();
  const buckets = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    buckets.push({ label: d.toLocaleDateString('en-IN', { weekday: 'short' }), key: d.toDateString(), total: 0 });
  }
  txs.forEach((t) => {
    if (t.isPending) return;
    const key = new Date(t.date).toDateString();
    const bucket = buckets.find((b) => b.key === key);
    if (bucket) bucket.total += t.amount;
  });
  return buckets;
}

export async function getMonthlyIncomeExpense() {
  const txs = await db.transactions.toArray();
  let income = 0;
  let expense = 0;
  const thisMonth = new Date().getMonth();
  const thisYear = new Date().getFullYear();
  txs.forEach((t) => {
    const d = new Date(t.date);
    if (d.getMonth() !== thisMonth || d.getFullYear() !== thisYear) return;
    if (t.isPending) return;
    if (t.type === 'income') income += t.amount;
    else expense += t.amount;
  });
  return { income, expense };
}

/* Utility: format a number as Indian Rupees */
export function formatINR(amount) {
  const n = Number(amount) || 0;
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

/* Utility: relative-ish date label */
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

export const CATEGORY_ICONS = {
  Food: '🍔',
  Travel: '🚌',
  Books: '📚',
  Fun: '🎮',
  Bills: '🧾',
  Rent: '🏠',
  Health: '💊',
  Other: '🛍️',
  'Pocket Money': '💵',
};

export function categoryIcon(category) {
  return CATEGORY_ICONS[category] || '💳';
}
