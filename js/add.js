/* ============================================================
   add.js — Manual Entry & QR Scan Simulation (add.html)
   ============================================================ */
import { renderNav } from './nav.js';
import { addExpense, categoryIcon } from './db.js';

renderNav('add');

const CATEGORIES = ['Food', 'Travel', 'Books', 'Fun', 'Bills', 'Other'];

let selectedCategory = CATEGORIES[0];
let selectedExpenseType = 'need';

const categoryRow = document.getElementById('category-row');
const amountInput = document.getElementById('amount-input');
const noteInput = document.getElementById('note-input');
const formError = document.getElementById('form-error');

function renderCategories() {
  categoryRow.innerHTML = '';
  CATEGORIES.forEach((cat) => {
    const isActive = cat === selectedCategory;
    const el = document.createElement('button');
    el.type = 'button';
    el.className = `chip ${isActive ? 'chip-active' : 'chip-inactive'}`;
    el.innerHTML = isActive
      ? `<span class="chip-dot">${categoryIcon(cat)}</span><span class="font-black text-[13px]">${cat}</span>`
      : `<span>${categoryIcon(cat)}</span>`;
    el.addEventListener('click', () => {
      selectedCategory = cat;
      renderCategories();
    });
    categoryRow.appendChild(el);
  });
}

function renderExpenseTypeButtons() {
  document.querySelectorAll('.expense-type-btn').forEach((btn) => {
    const type = btn.dataset.expenseType;
    const active = type === selectedExpenseType;
    btn.classList.toggle('bg-charcoal', active);
    btn.classList.toggle('text-white', active);
    btn.classList.toggle('bg-white', !active);
    btn.classList.toggle('text-charcoal', !active);
  });
}

document.querySelectorAll('.expense-type-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    selectedExpenseType = btn.dataset.expenseType;
    renderExpenseTypeButtons();
  });
});

renderCategories();
renderExpenseTypeButtons();

function readAmount() {
  const val = parseFloat(amountInput.value);
  if (!val || val <= 0) {
    formError.textContent = 'Please enter a valid amount greater than 0.';
    formError.classList.remove('hidden');
    return null;
  }
  formError.classList.add('hidden');
  return Math.round(val * 100) / 100;
}

/* ---------------- Pay with Cash: instant, non-pending ---------------- */
document.getElementById('pay-cash-btn').addEventListener('click', async () => {
  const amount = readAmount();
  if (amount === null) return;

  await addExpense({
    amount,
    category: selectedCategory,
    walletType: 'cash',
    expenseType: selectedExpenseType,
    note: noteInput.value.trim(),
    isPending: false,
  });

  window.location.href = 'index.html';
});

/* ---------------- Scan QR / Pay Online: simulated, marked pending ---------------- */
document.getElementById('pay-qr-btn').addEventListener('click', async () => {
  const amount = readAmount();
  if (amount === null) return;

  const modal = document.getElementById('scan-modal');
  const scanningEl = document.getElementById('scan-scanning');
  const successEl = document.getElementById('scan-success');
  scanningEl.classList.remove('hidden');
  successEl.classList.add('hidden');
  modal.classList.remove('hidden');

  await addExpense({
    amount,
    category: selectedCategory,
    walletType: 'online',
    expenseType: selectedExpenseType,
    note: noteInput.value.trim(),
    isPending: true,
  });

  // Simulate the QR-scan → UPI-app round trip
  setTimeout(() => {
    scanningEl.classList.add('hidden');
    successEl.classList.remove('hidden');
    setTimeout(() => {
      window.location.href = 'index.html';
    }, 1400);
  }, 1500);
});
