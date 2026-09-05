/* ============================================================
   settings.js — Security, Budget, Recurring, Backup, Archive,
   Parent Export (settings.html)
   ============================================================ */
import { renderNav } from './nav.js';
import { isDarkMode, toggleTheme } from './theme.js';
import { isGhostMode, toggleGhostMode } from './ghost.js';
import {
  hasPinSet,
  setupPin,
  verifyPin,
  removePin,
  isWebAuthnSupported,
  hasBiometricRegistered,
  registerBiometric,
  getAutoLockMinutes,
  setAutoLockMinutes,
} from './lock.js';
import {
  getMonthlyBudget,
  setMonthlyBudget,
  getLowBalanceThreshold,
  setLowBalanceThreshold,
  getOutsideFoodWeeklyLimit,
  setOutsideFoodWeeklyLimit,
  getThisWeekOutsideFoodSpend,
  getCategoryBudgets,
  setCategoryBudget,
  getCategoryBudgetStatus,
  getRecurringList,
  addRecurring,
  deleteRecurring,
  toggleRecurringActive,
  CATEGORIES,
  categoryIcon,
  exportBackupJSON,
  importBackupJSON,
  archiveCurrentSemester,
  getArchives,
  deleteArchive,
  wipeAllData,
  getAllTransactions,
  formatINR,
} from './db.js';
import { icon } from './icons.js';

renderNav('settings');
window.__mfAppRendered = true;

/* ---------------- Appearance switches ---------------- */

function paintSwitch(el, on) {
  el.classList.toggle('on', on);
}

const darkSwitch = document.getElementById('dark-mode-switch');
paintSwitch(darkSwitch, isDarkMode());
darkSwitch.addEventListener('click', () => paintSwitch(darkSwitch, toggleTheme()));

const ghostSwitch = document.getElementById('ghost-mode-switch');
paintSwitch(ghostSwitch, isGhostMode());
ghostSwitch.addEventListener('click', () => paintSwitch(ghostSwitch, toggleGhostMode()));

/* ---------------- Security: PIN + Biometric ---------------- */

function refreshSecurityUI() {
  document.getElementById('pin-not-set').classList.toggle('hidden', hasPinSet());
  document.getElementById('pin-is-set').classList.toggle('hidden', !hasPinSet());
  const bioStatus = document.getElementById('biometric-status');
  const bioBtn = document.getElementById('register-biometric-btn');
  if (!isWebAuthnSupported()) {
    bioStatus.textContent = 'Not supported on this browser/device';
    bioBtn.disabled = true;
    bioBtn.classList.add('opacity-40');
  } else if (hasBiometricRegistered()) {
    bioStatus.textContent = 'Registered on this device \u2713';
    bioBtn.textContent = 'Re-register';
  } else {
    bioStatus.textContent = 'Not registered on this device';
    bioBtn.textContent = 'Enable';
  }
}
refreshSecurityUI();

const autoLockSelect = document.getElementById('auto-lock-select');
autoLockSelect.value = String(getAutoLockMinutes());
autoLockSelect.addEventListener('change', () => {
  setAutoLockMinutes(Number(autoLockSelect.value));
});

const pinModal = document.getElementById('pin-modal');
const pinModalTitle = document.getElementById('pin-modal-title');
const pinModalSub = document.getElementById('pin-modal-sub');
const securityError = document.getElementById('security-error');

let pinFlow = { stage: null, oldPin: '', newPin: '', buffer: '' };

function updatePinDots() {
  document.querySelectorAll('#pin-modal-dots .lock-dot').forEach((d, i) => d.classList.toggle('filled', i < pinFlow.buffer.length));
}

function updatePinModalCopy() {
  if (pinFlow.stage === 'verifyOld') {
    pinModalTitle.textContent = 'Enter current PIN';
    pinModalSub.textContent = 'Confirm it\u2019s you before changing it';
  } else if (pinFlow.stage === 'enter') {
    pinModalTitle.textContent = 'Set a 4-digit PIN';
    pinModalSub.textContent = 'Choose a new PIN';
  } else if (pinFlow.stage === 'confirm') {
    pinModalTitle.textContent = 'Confirm PIN';
    pinModalSub.textContent = 'Enter it one more time';
  }
  updatePinDots();
}

function openPinModal(stage) {
  pinFlow = { stage, oldPin: '', newPin: '', buffer: '' };
  securityError.classList.add('hidden');
  updatePinModalCopy();
  pinModal.classList.remove('hidden');
}

document.getElementById('setup-pin-btn').addEventListener('click', () => openPinModal('enter'));
document.getElementById('change-pin-btn').addEventListener('click', () => openPinModal('verifyOld'));
document.getElementById('pin-modal-cancel').addEventListener('click', () => pinModal.classList.add('hidden'));

document.getElementById('remove-pin-btn').addEventListener('click', () => {
  if (confirm('Remove your PIN? The app will no longer be locked.')) {
    removePin();
    refreshSecurityUI();
  }
});

document.querySelectorAll('[data-pmnum]').forEach((btn) => {
  btn.addEventListener('click', async () => {
    if (pinFlow.buffer.length >= 4) return;
    pinFlow.buffer += btn.dataset.pmnum;
    updatePinDots();
    if (pinFlow.buffer.length === 4) await handlePinStageComplete();
  });
});
document.getElementById('pin-modal-back').addEventListener('click', () => {
  pinFlow.buffer = pinFlow.buffer.slice(0, -1);
  updatePinDots();
});

async function handlePinStageComplete() {
  if (pinFlow.stage === 'verifyOld') {
    const ok = await verifyPin(pinFlow.buffer);
    if (!ok) {
      securityError.textContent = 'Incorrect PIN. Try again.';
      securityError.classList.remove('hidden');
      pinFlow.buffer = '';
      updatePinDots();
      return;
    }
    pinFlow.oldPin = pinFlow.buffer;
    pinFlow.buffer = '';
    pinFlow.stage = 'enter';
    updatePinModalCopy();
  } else if (pinFlow.stage === 'enter') {
    pinFlow.newPin = pinFlow.buffer;
    pinFlow.buffer = '';
    pinFlow.stage = 'confirm';
    updatePinModalCopy();
  } else if (pinFlow.stage === 'confirm') {
    if (pinFlow.buffer !== pinFlow.newPin) {
      securityError.textContent = "PINs didn't match — try again.";
      securityError.classList.remove('hidden');
      pinFlow.buffer = '';
      pinFlow.stage = 'enter';
      updatePinModalCopy();
      return;
    }
    await setupPin(pinFlow.newPin);
    pinModal.classList.add('hidden');
    refreshSecurityUI();
  }
}

document.getElementById('register-biometric-btn').addEventListener('click', async () => {
  try {
    await registerBiometric();
    refreshSecurityUI();
  } catch (err) {
    securityError.textContent = err.message;
    securityError.classList.remove('hidden');
  }
});

/* ---------------- Budget & Alerts ---------------- */

document.getElementById('monthly-budget-input').value = getMonthlyBudget() || '';
document.getElementById('low-balance-input').value = getLowBalanceThreshold() || '';
document.getElementById('outside-food-input').value = getOutsideFoodWeeklyLimit() || '';

async function checkMessAlert() {
  const limit = getOutsideFoodWeeklyLimit();
  const spent = await getThisWeekOutsideFoodSpend();
  document.getElementById('mess-alert').classList.toggle('hidden', !(limit > 0 && spent > limit));
}
checkMessAlert();

document.getElementById('save-budget-btn').addEventListener('click', async () => {
  setMonthlyBudget(parseFloat(document.getElementById('monthly-budget-input').value) || 0);
  setLowBalanceThreshold(parseFloat(document.getElementById('low-balance-input').value) || 0);
  setOutsideFoodWeeklyLimit(parseFloat(document.getElementById('outside-food-input').value) || 0);
  await checkMessAlert();
  alert('Saved!');
});

/* ---------------- Per-category budgets ---------------- */

const catBudgetCategorySelect = document.getElementById('cat-budget-category');
CATEGORIES.forEach((cat) => {
  const opt = document.createElement('option');
  opt.value = cat;
  opt.textContent = cat;
  catBudgetCategorySelect.appendChild(opt);
});

async function renderCategoryBudgets() {
  const status = await getCategoryBudgetStatus();
  const list = document.getElementById('category-budget-list');
  if (status.length === 0) {
    list.innerHTML = '<p class="text-[11px] font-bold text-sage">No category budgets set yet.</p>';
    return;
  }
  list.innerHTML = status
    .map(
      (s) => `
      <div class="flex items-center justify-between bg-sage/10 rounded-2xl px-4 py-3">
        <div class="min-w-0">
          <p class="text-[12px] font-black truncate">${s.category}</p>
          <p class="text-[10px] font-bold ${s.pct >= 100 ? 'text-crimson' : 'text-sage'}">${formatINR(s.spent)} / ${formatINR(s.limit)} this month (${s.pct}%)</p>
        </div>
        <button data-remove-cat-budget="${s.category}" class="w-8 h-8 rounded-full bg-crimson/10 text-crimson flex items-center justify-center shrink-0">${icon('trash', 13)}</button>
      </div>`
    )
    .join('');
  list.querySelectorAll('[data-remove-cat-budget]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      setCategoryBudget(btn.dataset.removeCatBudget, 0);
      await renderCategoryBudgets();
    });
  });
}
renderCategoryBudgets();

document.getElementById('cat-budget-add-btn').addEventListener('click', async () => {
  const category = catBudgetCategorySelect.value;
  const amount = parseFloat(document.getElementById('cat-budget-amount').value) || 0;
  if (amount <= 0) return;
  setCategoryBudget(category, amount);
  document.getElementById('cat-budget-amount').value = '';
  await renderCategoryBudgets();
});

/* ---------------- Recurring Expenses ---------------- */

const recurringCategorySelect = document.getElementById('recurring-category');
CATEGORIES.forEach((cat) => {
  const opt = document.createElement('option');
  opt.value = cat;
  opt.textContent = cat;
  recurringCategorySelect.appendChild(opt);
});

let recurringWallet = 'cash';
function renderRecurringWalletButtons() {
  document.querySelectorAll('.recurring-wallet-btn').forEach((btn) => {
    const active = btn.dataset.recurringWallet === recurringWallet;
    btn.classList.toggle('bg-charcoal', active);
    btn.classList.toggle('text-white', active);
    btn.classList.toggle('bg-card', !active);
  });
}
document.querySelectorAll('.recurring-wallet-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    recurringWallet = btn.dataset.recurringWallet;
    renderRecurringWalletButtons();
  });
});
renderRecurringWalletButtons();

async function renderRecurringList() {
  const items = await getRecurringList();
  const list = document.getElementById('recurring-list');
  list.innerHTML = '';
  items.forEach((r) => {
    const row = document.createElement('div');
    row.className = 'flex items-center gap-3 bg-sage/10 rounded-2xl px-3 py-2.5';
    row.innerHTML = `
      <div class="flex-1 min-w-0">
        <p class="text-[13px] font-black truncate">${categoryIcon(r.category)} ${r.title}</p>
        <p class="text-[10px] font-bold text-sage">${formatINR(r.amount)} · ${r.frequency} · next ${new Date(r.nextDueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
      </div>
      <button data-toggle-recurring="${r.id}" data-active="${r.active}" class="mf-switch ${r.active ? 'on' : ''}"><span class="knob"></span></button>
      <button data-delete-recurring="${r.id}" class="w-8 h-8 rounded-full bg-crimson/10 text-crimson flex items-center justify-center shrink-0">${icon('trash', 14)}</button>
    `;
    list.appendChild(row);
  });

  list.querySelectorAll('[data-toggle-recurring]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const nowActive = btn.dataset.active === '1';
      await toggleRecurringActive(Number(btn.dataset.toggleRecurring), !nowActive);
      await renderRecurringList();
    });
  });
  list.querySelectorAll('[data-delete-recurring]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (confirm('Delete this recurring expense?')) {
        await deleteRecurring(Number(btn.dataset.deleteRecurring));
        await renderRecurringList();
      }
    });
  });
}
renderRecurringList();

document.getElementById('add-recurring-btn').addEventListener('click', async () => {
  const title = document.getElementById('recurring-title').value.trim();
  const amount = parseFloat(document.getElementById('recurring-amount').value);
  const frequency = document.getElementById('recurring-frequency').value;
  const category = recurringCategorySelect.value;

  if (!title || !amount || amount <= 0) {
    alert('Please enter a title and a valid amount.');
    return;
  }

  await addRecurring({
    title,
    amount: Math.round(amount * 100) / 100,
    category,
    walletType: recurringWallet,
    expenseType: 'need',
    frequency,
    startDate: new Date().toISOString(),
  });

  document.getElementById('recurring-title').value = '';
  document.getElementById('recurring-amount').value = '';
  await renderRecurringList();
});

/* ---------------- Backup & Restore ---------------- */

document.getElementById('export-json-btn').addEventListener('click', () => exportBackupJSON());

document.getElementById('import-json-input').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  const statusEl = document.getElementById('backup-status');
  if (!file) return;
  if (!confirm('Importing will replace ALL current data on this device. Continue?')) {
    e.target.value = '';
    return;
  }
  try {
    await importBackupJSON(file);
    alert('Backup restored! Reloading…');
    window.location.reload();
  } catch (err) {
    statusEl.textContent = 'Import failed: ' + err.message;
    statusEl.classList.remove('hidden');
  }
});

/* ---------------- Parents Export (PDF / Excel) ---------------- */

let smartExportOn = true;
const smartSwitch = document.getElementById('smart-export-switch');
smartSwitch.addEventListener('click', () => {
  smartExportOn = !smartExportOn;
  paintSwitch(smartSwitch, smartExportOn);
});

async function buildParentSummary() {
  let txs = await getAllTransactions();
  txs = txs.filter((t) => !t.isPending);
  if (smartExportOn) txs = txs.filter((t) => t.expenseType !== 'want');

  const totalIncome = txs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpense = txs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const byCategory = {};
  txs
    .filter((t) => t.type === 'expense')
    .forEach((t) => {
      byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;
    });

  return { txs, totalIncome, totalExpense, byCategory };
}

document.getElementById('export-pdf-btn').addEventListener('click', async () => {
  const { txs, totalIncome, totalExpense, byCategory } = await buildParentSummary();
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  let y = 18;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Money follow — Expense Summary', 14, y);
  y += 8;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}${smartExportOn ? '  (Wants excluded)' : ''}`, 14, y);
  y += 10;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(`Total Income: Rs. ${Math.round(totalIncome)}`, 14, y);
  y += 7;
  doc.text(`Total Expense: Rs. ${Math.round(totalExpense)}`, 14, y);
  y += 10;

  doc.setFontSize(13);
  doc.text('By Category', 14, y);
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .forEach(([cat, amt]) => {
      doc.text(`${cat}`, 14, y);
      doc.text(`Rs. ${Math.round(amt)}`, 160, y, { align: 'right' });
      y += 6;
      if (y > 270) {
        doc.addPage();
        y = 18;
      }
    });

  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Transaction Log', 14, y);
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  txs.slice(0, 200).forEach((t) => {
    if (y > 280) {
      doc.addPage();
      y = 18;
    }
    const line = `${new Date(t.date).toLocaleDateString('en-IN')}  ${t.type.toUpperCase()}  ${t.category}  Rs.${Math.round(t.amount)}  ${t.note || ''}`;
    doc.text(line, 14, y);
    y += 5;
  });

  doc.save(`money-follow-summary-${new Date().toISOString().slice(0, 10)}.pdf`);
});

document.getElementById('export-excel-btn').addEventListener('click', async () => {
  const { txs, totalIncome, totalExpense, byCategory } = await buildParentSummary();

  const summaryRows = [
    { Metric: 'Total Income', Value: totalIncome },
    { Metric: 'Total Expense', Value: totalExpense },
    ...Object.entries(byCategory).map(([cat, amt]) => ({ Metric: `Category: ${cat}`, Value: amt })),
  ];

  const txRows = txs.map((t) => ({
    Date: new Date(t.date).toLocaleDateString('en-IN'),
    Type: t.type,
    Category: t.category,
    Wallet: t.walletType,
    'Need/Want': t.expenseType || '',
    Amount: t.amount,
    Note: t.note || '',
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), 'Summary');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(txRows), 'Transactions');
  XLSX.writeFile(wb, `money-follow-summary-${new Date().toISOString().slice(0, 10)}.xlsx`);
});

/* ---------------- Semester Archive ---------------- */

async function renderArchiveList() {
  const archives = await getArchives();
  const list = document.getElementById('archive-list');
  list.innerHTML = '';
  archives.forEach((a) => {
    const row = document.createElement('div');
    row.className = 'bg-sage/10 rounded-2xl px-4 py-3';
    row.innerHTML = `
      <div class="flex items-center justify-between mb-1">
        <p class="text-[13px] font-black">${a.label}</p>
        <button data-delete-archive="${a.id}" class="w-7 h-7 rounded-full bg-crimson/10 text-crimson flex items-center justify-center shrink-0">${icon('trash', 13)}</button>
      </div>
      <p class="text-[11px] font-bold text-sage">${new Date(a.createdDate).toLocaleDateString('en-IN')} · ${a.snapshot.transactionCount} transactions</p>
      <p class="text-[11px] font-bold text-sage">Income ${formatINR(a.snapshot.income)} · Expense ${formatINR(a.snapshot.expense)}</p>
    `;
    list.appendChild(row);
  });
  list.querySelectorAll('[data-delete-archive]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (confirm('Delete this archive record? (This does not restore the transactions.)')) {
        await deleteArchive(Number(btn.dataset.deleteArchive));
        await renderArchiveList();
      }
    });
  });
}
renderArchiveList();

document.getElementById('create-archive-btn').addEventListener('click', async () => {
  const label = document.getElementById('archive-label').value.trim() || `Archive ${new Date().toLocaleDateString('en-IN')}`;
  if (!confirm('This will snapshot and CLEAR your current transaction log. Wallet & Vault balances stay the same. Continue?')) return;
  await archiveCurrentSemester(label);
  document.getElementById('archive-label').value = '';
  await renderArchiveList();
  alert('Archived! Your transaction log has been reset for the new semester.');
});

/* ---------------- Danger Zone ---------------- */

document.getElementById('wipe-data-btn').addEventListener('click', async () => {
  if (!confirm('This will permanently erase ALL your data on this device. This cannot be undone. Continue?')) return;
  if (!confirm('Are you absolutely sure? Type OK in the next box to confirm.')) return;
  const typed = prompt('Type ERASE to confirm:');
  if (typed !== 'ERASE') {
    alert('Cancelled — nothing was deleted.');
    return;
  }
  await wipeAllData();
  alert('All data erased.');
  window.location.href = 'index.html';
});
