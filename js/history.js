/* ============================================================
   history.js — Transaction History: search, filter, edit, delete
   ============================================================ */
import { renderNav } from './nav.js';
import { initGhostToggle, setMoneyText } from './ghost.js';
import {
  searchTransactions,
  updateTransaction,
  deleteTransaction,
  CATEGORIES,
  categoryIcon,
  formatINR,
  formatDate,
} from './db.js';

renderNav('history');
initGhostToggle();

const listEl = document.getElementById('history-list');
const emptyEl = document.getElementById('history-empty');
const resultCountEl = document.getElementById('result-count');

const searchInput = document.getElementById('search-input');
const filterType = document.getElementById('filter-type');
const filterWallet = document.getElementById('filter-wallet');
const filterCategory = document.getElementById('filter-category');
const filterExpenseType = document.getElementById('filter-expense-type');

// Populate category filter + edit-category select
[filterCategory, document.getElementById('edit-category')].forEach((sel, idx) => {
  CATEGORIES.forEach((cat) => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = `${categoryIcon(cat)} ${cat}`;
    sel.appendChild(opt);
  });
});
// Restore the "All Categories" default label on the filter (was overwritten by loop start point)
filterCategory.insertAdjacentHTML('afterbegin', '<option value="">All Categories</option>');

let currentResults = [];

async function runSearch() {
  const startDateVal = null;
  const endDateVal = null;
  currentResults = await searchTransactions({
    query: searchInput.value.trim(),
    type: filterType.value || null,
    walletType: filterWallet.value || null,
    category: filterCategory.value || null,
    expenseType: filterExpenseType.value || null,
    startDate: startDateVal,
    endDate: endDateVal,
  });
  renderList();
}

function renderList() {
  listEl.innerHTML = '';
  resultCountEl.textContent = `${currentResults.length} transaction${currentResults.length === 1 ? '' : 's'}`;

  if (currentResults.length === 0) {
    emptyEl.classList.remove('hidden');
    return;
  }
  emptyEl.classList.add('hidden');

  currentResults.forEach((t) => {
    const isIncome = t.type === 'income';
    const isTransfer = t.type === 'transfer';
    const sign = isIncome ? '+' : isTransfer ? '↔' : '−';
    const amountColor = isIncome ? 'text-ink' : isTransfer ? 'text-sage' : 'text-crimson';
    const pendingBadge = t.isPending
      ? `<span class="text-[9px] uppercase tracking-widest font-black text-crimson bg-crimson/10 px-2 py-0.5 rounded-full ml-2">Pending</span>`
      : '';

    const item = document.createElement('div');
    item.className = 'bg-card rounded-3xl border border-sage-soft p-3';
    item.innerHTML = `
      <div class="flex items-center gap-3">
        <div class="feed-icon bg-crimson/10">${categoryIcon(t.category)}</div>
        <div class="flex-1 min-w-0">
          <p class="text-[15px] font-black leading-tight truncate">${t.category}${pendingBadge}</p>
          <p class="text-[11px] font-bold text-sage truncate">${formatDate(t.date)} · ${t.walletType === 'cash' ? 'Cash' : 'Online'}${t.note ? ' · ' + t.note : ''}</p>
        </div>
        <p class="text-[15px] font-black ${amountColor} shrink-0 mf-amt">${sign} ${formatINR(t.amount)}</p>
      </div>
      ${
        t.type !== 'transfer'
          ? `<div class="flex gap-2 mt-2 pt-2 border-t border-sage-soft/60">
        <button data-edit="${t.id}" class="flex-1 py-2 rounded-xl bg-sage/10 font-black text-[11px]">✏️ Edit</button>
        <button data-delete="${t.id}" class="flex-1 py-2 rounded-xl bg-crimson/10 text-crimson font-black text-[11px]">🗑️ Delete</button>
      </div>`
          : ''
      }
    `;
    listEl.appendChild(item);
    setMoneyText(item.querySelector('.mf-amt'), `${sign} ${formatINR(t.amount)}`);
  });

  listEl.querySelectorAll('[data-edit]').forEach((btn) => {
    btn.addEventListener('click', () => openEditModal(Number(btn.dataset.edit)));
  });
  listEl.querySelectorAll('[data-delete]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (confirm('Delete this transaction? Wallet balance will be adjusted accordingly.')) {
        await deleteTransaction(Number(btn.dataset.delete));
        await runSearch();
      }
    });
  });
}

[searchInput, filterType, filterWallet, filterCategory, filterExpenseType].forEach((el) => {
  el.addEventListener('input', runSearch);
  el.addEventListener('change', runSearch);
});

/* ---------------- Edit modal ---------------- */

const editModal = document.getElementById('edit-modal');
let editingId = null;
let editWalletType = 'cash';
let editExpenseType = 'need';

function renderEditWalletButtons() {
  document.querySelectorAll('.edit-wallet-btn').forEach((btn) => {
    const active = btn.dataset.editWallet === editWalletType;
    btn.classList.toggle('bg-charcoal', active);
    btn.classList.toggle('text-white', active);
    btn.classList.toggle('bg-card', !active);
  });
}
document.querySelectorAll('.edit-wallet-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    editWalletType = btn.dataset.editWallet;
    renderEditWalletButtons();
  });
});

function renderEditExpenseTypeButtons() {
  document.querySelectorAll('.edit-expense-type-btn').forEach((btn) => {
    const active = btn.dataset.editExpenseType === editExpenseType;
    btn.classList.toggle('bg-charcoal', active);
    btn.classList.toggle('text-white', active);
    btn.classList.toggle('bg-card', !active);
  });
}
document.querySelectorAll('.edit-expense-type-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    editExpenseType = btn.dataset.editExpenseType;
    renderEditExpenseTypeButtons();
  });
});

function openEditModal(id) {
  const tx = currentResults.find((t) => t.id === id);
  if (!tx) return;
  editingId = id;
  document.getElementById('edit-amount').value = tx.amount;
  document.getElementById('edit-category').value = tx.category;
  document.getElementById('edit-note').value = tx.note || '';
  editWalletType = tx.walletType;
  editExpenseType = tx.expenseType || 'need';
  renderEditWalletButtons();
  renderEditExpenseTypeButtons();
  editModal.classList.remove('hidden');
}

document.getElementById('edit-cancel-btn').addEventListener('click', () => editModal.classList.add('hidden'));

document.getElementById('edit-save-btn').addEventListener('click', async () => {
  const amount = parseFloat(document.getElementById('edit-amount').value);
  if (!amount || amount <= 0) {
    alert('Please enter a valid amount.');
    return;
  }
  await updateTransaction(editingId, {
    amount: Math.round(amount * 100) / 100,
    category: document.getElementById('edit-category').value,
    walletType: editWalletType,
    expenseType: editExpenseType,
    note: document.getElementById('edit-note').value.trim(),
  });
  editModal.classList.add('hidden');
  await runSearch();
});

runSearch();
