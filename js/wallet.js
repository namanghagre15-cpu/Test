/* ============================================================
   wallet.js — Pocket Money, Cash vs Online, Transfer (wallet.html)
   ============================================================ */
import { renderNav } from './nav.js';
import { initGhostToggle, setMoneyText } from './ghost.js';
import { getWallets, addIncome, transferBetweenWallets, getAllTransactions, formatINR, formatDate } from './db.js';

renderNav('wallet');
initGhostToggle();

let selectedWalletType = 'cash';
let selectedDirection = 'cash-to-online';

const amountInput = document.getElementById('income-amount');
const noteInput = document.getElementById('income-note');
const errorEl = document.getElementById('income-error');
const incomeList = document.getElementById('income-list');
const incomeEmpty = document.getElementById('income-empty');

/* ---------------- Tabs ---------------- */
const tabIncome = document.getElementById('tab-income');
const tabTransfer = document.getElementById('tab-transfer');
const incomeSection = document.getElementById('income-form-section');
const transferSection = document.getElementById('transfer-form-section');

tabIncome.addEventListener('click', () => {
  tabIncome.classList.add('active');
  tabTransfer.classList.remove('active');
  incomeSection.classList.remove('hidden');
  transferSection.classList.add('hidden');
});
tabTransfer.addEventListener('click', () => {
  tabTransfer.classList.add('active');
  tabIncome.classList.remove('active');
  transferSection.classList.remove('hidden');
  incomeSection.classList.add('hidden');
});

/* ---------------- Wallet type toggle (income) ---------------- */
function renderWalletTypeButtons() {
  document.querySelectorAll('.wallet-type-btn').forEach((btn) => {
    const active = btn.dataset.walletType === selectedWalletType;
    btn.classList.toggle('bg-charcoal', active);
    btn.classList.toggle('text-white', active);
    btn.classList.toggle('bg-card', !active);
    btn.classList.toggle('text-ink', !active);
  });
}
document.querySelectorAll('.wallet-type-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    selectedWalletType = btn.dataset.walletType;
    renderWalletTypeButtons();
  });
});
renderWalletTypeButtons();

/* ---------------- Transfer direction toggle ---------------- */
function renderDirectionButtons() {
  document.querySelectorAll('.transfer-dir-btn').forEach((btn) => {
    const active = btn.dataset.direction === selectedDirection;
    btn.classList.toggle('bg-charcoal', active);
    btn.classList.toggle('text-white', active);
    btn.classList.toggle('bg-card', !active);
    btn.classList.toggle('text-ink', !active);
  });
}
document.querySelectorAll('.transfer-dir-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    selectedDirection = btn.dataset.direction;
    renderDirectionButtons();
  });
});
renderDirectionButtons();

/* ---------------- Renders ---------------- */

async function renderBalances() {
  const wallets = await getWallets();
  const cash = wallets.find((w) => w.type === 'cash');
  const online = wallets.find((w) => w.type === 'online');
  setMoneyText(document.getElementById('cash-balance'), formatINR(cash ? cash.balance : 0));
  setMoneyText(document.getElementById('online-balance'), formatINR(online ? online.balance : 0));
}

async function renderHistory() {
  const txs = (await getAllTransactions()).filter((t) => t.type === 'income' || t.type === 'transfer');
  incomeList.innerHTML = '';
  if (txs.length === 0) {
    incomeEmpty.classList.remove('hidden');
    return;
  }
  incomeEmpty.classList.add('hidden');

  txs.forEach((t) => {
    const isIncome = t.type === 'income';
    const item = document.createElement('div');
    item.className = 'bg-card rounded-3xl border border-sage-soft p-3 flex items-center gap-3';
    item.innerHTML = `
      <div class="feed-icon bg-crimson/10">${isIncome ? '💵' : '🔄'}</div>
      <div class="flex-1 min-w-0">
        <p class="text-[16px] font-black leading-tight truncate">${isIncome ? t.note || 'Pocket Money' : t.note}</p>
        <p class="text-[12px] font-bold text-sage">${formatDate(t.date)} · ${t.walletType === 'cash' ? 'Cash' : 'Online'}</p>
      </div>
      <p class="text-[15px] font-black text-ink shrink-0 mf-amt">${isIncome ? '+' : '↔'} ${formatINR(t.amount)}</p>
    `;
    incomeList.appendChild(item);
    setMoneyText(item.querySelector('.mf-amt'), `${isIncome ? '+' : '↔'} ${formatINR(t.amount)}`);
  });
}

document.getElementById('add-income-btn').addEventListener('click', async () => {
  const amount = parseFloat(amountInput.value);
  if (!amount || amount <= 0) {
    errorEl.textContent = 'Please enter a valid amount greater than 0.';
    errorEl.classList.remove('hidden');
    return;
  }
  errorEl.classList.add('hidden');

  await addIncome({
    walletType: selectedWalletType,
    amount: Math.round(amount * 100) / 100,
    note: noteInput.value.trim(),
  });

  amountInput.value = '';
  noteInput.value = '';

  await renderBalances();
  await renderHistory();
});

document.getElementById('do-transfer-btn').addEventListener('click', async () => {
  const transferErrorEl = document.getElementById('transfer-error');
  const amount = parseFloat(document.getElementById('transfer-amount').value);
  if (!amount || amount <= 0) {
    transferErrorEl.textContent = 'Please enter a valid amount greater than 0.';
    transferErrorEl.classList.remove('hidden');
    return;
  }
  const [from, to] = selectedDirection === 'cash-to-online' ? ['cash', 'online'] : ['online', 'cash'];

  try {
    await transferBetweenWallets(from, to, Math.round(amount * 100) / 100);
    transferErrorEl.classList.add('hidden');
    document.getElementById('transfer-amount').value = '';
    await renderBalances();
    await renderHistory();
  } catch (err) {
    transferErrorEl.textContent = err.message;
    transferErrorEl.classList.remove('hidden');
  }
});

renderBalances();
renderHistory();
