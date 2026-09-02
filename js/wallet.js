/* ============================================================
   wallet.js — Adding Pocket Money, Cash vs Online balances (wallet.html)
   ============================================================ */
import { renderNav } from './nav.js';
import { getWallets, addIncome, getAllTransactions, formatINR, formatDate } from './db.js';

renderNav('wallet');

let selectedWalletType = 'cash';

const amountInput = document.getElementById('income-amount');
const noteInput = document.getElementById('income-note');
const errorEl = document.getElementById('income-error');
const incomeList = document.getElementById('income-list');
const incomeEmpty = document.getElementById('income-empty');

function renderWalletTypeButtons() {
  document.querySelectorAll('.wallet-type-btn').forEach((btn) => {
    const active = btn.dataset.walletType === selectedWalletType;
    btn.classList.toggle('bg-charcoal', active);
    btn.classList.toggle('text-white', active);
    btn.classList.toggle('bg-white', !active);
    btn.classList.toggle('text-charcoal', !active);
  });
}

document.querySelectorAll('.wallet-type-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    selectedWalletType = btn.dataset.walletType;
    renderWalletTypeButtons();
  });
});

renderWalletTypeButtons();

async function renderBalances() {
  const wallets = await getWallets();
  const cash = wallets.find((w) => w.type === 'cash');
  const online = wallets.find((w) => w.type === 'online');
  document.getElementById('cash-balance').textContent = formatINR(cash ? cash.balance : 0);
  document.getElementById('online-balance').textContent = formatINR(online ? online.balance : 0);
}

async function renderIncomeHistory() {
  const txs = (await getAllTransactions()).filter((t) => t.type === 'income');
  incomeList.innerHTML = '';
  if (txs.length === 0) {
    incomeEmpty.classList.remove('hidden');
    return;
  }
  incomeEmpty.classList.add('hidden');

  txs.forEach((t) => {
    const item = document.createElement('div');
    item.className = 'bg-white rounded-3xl border border-sage-soft p-3 flex items-center gap-3';
    item.innerHTML = `
      <div class="feed-icon bg-crimson/10">💵</div>
      <div class="flex-1 min-w-0">
        <p class="text-[16px] font-black leading-tight truncate">${t.note || 'Pocket Money'}</p>
        <p class="text-[12px] font-bold text-sage">${formatDate(t.date)} · ${t.walletType === 'cash' ? 'Cash' : 'Online'}</p>
      </div>
      <p class="text-[15px] font-black text-charcoal shrink-0">+ ${formatINR(t.amount)}</p>
    `;
    incomeList.appendChild(item);
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
  await renderIncomeHistory();
});

renderBalances();
renderIncomeHistory();
