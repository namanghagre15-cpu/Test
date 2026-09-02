/* ============================================================
   vault.js — Savings Goals & Discipline Vault (vault.html)
   ============================================================ */
import { renderNav } from './nav.js';
import {
  getVaultGoals,
  addVaultGoal,
  contributeToVaultGoal,
  withdrawFromVaultGoal,
  deleteVaultGoal,
  getTotalVaultLocked,
  formatINR,
} from './db.js';

renderNav('vault');

const goalsList = document.getElementById('goals-list');
const goalsEmpty = document.getElementById('goals-empty');

/* ---------------- Render ---------------- */

async function renderAll() {
  const [goals, totalLocked] = await Promise.all([getVaultGoals(), getTotalVaultLocked()]);
  document.getElementById('total-locked').textContent = formatINR(totalLocked);

  goalsList.innerHTML = '';
  if (goals.length === 0) {
    goalsEmpty.classList.remove('hidden');
    return;
  }
  goalsEmpty.classList.add('hidden');

  goals.forEach((g) => {
    const pct = g.targetAmount > 0 ? Math.min(100, Math.round((g.savedAmount / g.targetAmount) * 100)) : 0;
    const isComplete = g.savedAmount >= g.targetAmount && g.targetAmount > 0;
    const deadlineLabel = g.deadline
      ? new Date(g.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      : null;

    const card = document.createElement('div');
    card.className = 'bg-white rounded-4xl border border-sage-soft shadow-soft p-5';
    card.innerHTML = `
      <div class="flex items-start justify-between mb-3">
        <div>
          <h3 class="text-[18px] font-black leading-tight">${g.title}</h3>
          ${deadlineLabel ? `<p class="text-[11px] font-bold text-sage mt-0.5">🎯 by ${deadlineLabel}</p>` : ''}
        </div>
        <button data-delete-goal="${g.id}" class="w-9 h-9 rounded-full bg-sage/15 flex items-center justify-center text-sm">🗑️</button>
      </div>

      <div class="flex items-baseline gap-2 mb-2">
        <span class="text-[20px] font-black">${formatINR(g.savedAmount)}</span>
        <span class="text-[13px] font-bold text-sage">/ ${formatINR(g.targetAmount)}</span>
        ${isComplete ? '<span class="ml-auto text-[11px] font-black text-crimson">🎉 Goal reached!</span>' : ''}
      </div>

      <div class="progress-track mb-4">
        <div class="progress-fill" style="width:${pct}%"></div>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <button data-add-goal="${g.id}" data-title="${g.title}" class="py-3 rounded-2xl bg-charcoal text-white font-black text-[13px]">+ Add Funds</button>
        <button data-withdraw-goal="${g.id}" data-title="${g.title}" data-saved="${g.savedAmount}" class="py-3 rounded-2xl bg-white border border-sage-soft font-black text-[13px]">Withdraw</button>
      </div>
    `;
    goalsList.appendChild(card);
  });

  // Wire up per-card buttons
  goalsList.querySelectorAll('[data-delete-goal]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (confirm('Delete this goal? Any saved money should be withdrawn first.')) {
        await deleteVaultGoal(Number(btn.dataset.deleteGoal));
        await renderAll();
      }
    });
  });
  goalsList.querySelectorAll('[data-add-goal]').forEach((btn) => {
    btn.addEventListener('click', () => openFundModal(Number(btn.dataset.addGoal), btn.dataset.title, 'contribute'));
  });
  goalsList.querySelectorAll('[data-withdraw-goal]').forEach((btn) => {
    btn.addEventListener('click', () =>
      openFundModal(Number(btn.dataset.withdrawGoal), btn.dataset.title, 'withdraw', Number(btn.dataset.saved))
    );
  });
}

/* ---------------- New Goal Modal ---------------- */

const newGoalModal = document.getElementById('new-goal-modal');
document.getElementById('new-goal-btn').addEventListener('click', () => {
  document.getElementById('goal-title').value = '';
  document.getElementById('goal-target').value = '';
  document.getElementById('goal-deadline').value = '';
  document.getElementById('goal-error').classList.add('hidden');
  newGoalModal.classList.remove('hidden');
});
document.getElementById('goal-cancel-btn').addEventListener('click', () => newGoalModal.classList.add('hidden'));

document.getElementById('goal-save-btn').addEventListener('click', async () => {
  const title = document.getElementById('goal-title').value.trim();
  const target = parseFloat(document.getElementById('goal-target').value);
  const deadline = document.getElementById('goal-deadline').value;
  const errorEl = document.getElementById('goal-error');

  if (!title) {
    errorEl.textContent = 'Please give your goal a title.';
    errorEl.classList.remove('hidden');
    return;
  }
  if (!target || target <= 0) {
    errorEl.textContent = 'Please enter a target amount greater than 0.';
    errorEl.classList.remove('hidden');
    return;
  }
  errorEl.classList.add('hidden');

  await addVaultGoal({ title, targetAmount: Math.round(target), deadline: deadline || null });
  newGoalModal.classList.add('hidden');
  await renderAll();
});

/* ---------------- Contribute / Withdraw Modal ---------------- */

const fundModal = document.getElementById('fund-modal');
let fundContext = { goalId: null, mode: 'contribute', savedAmount: 0 };
let selectedFundWallet = 'cash';

function renderFundWalletButtons() {
  document.querySelectorAll('.fund-wallet-btn').forEach((btn) => {
    const active = btn.dataset.fundWallet === selectedFundWallet;
    btn.classList.toggle('bg-charcoal', active);
    btn.classList.toggle('text-white', active);
    btn.classList.toggle('bg-white', !active);
    btn.classList.toggle('text-charcoal', !active);
  });
}
document.querySelectorAll('.fund-wallet-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    selectedFundWallet = btn.dataset.fundWallet;
    renderFundWalletButtons();
  });
});

function openFundModal(goalId, title, mode, savedAmount = 0) {
  fundContext = { goalId, mode, savedAmount };
  selectedFundWallet = 'cash';
  renderFundWalletButtons();
  document.getElementById('fund-amount').value = '';
  document.getElementById('fund-error').classList.add('hidden');
  document.getElementById('fund-modal-goal').textContent = title;
  document.getElementById('fund-modal-title').textContent = mode === 'contribute' ? 'Add Funds' : 'Withdraw Funds';
  document.getElementById('fund-save-btn').textContent = mode === 'contribute' ? 'Lock it in' : 'Withdraw';
  fundModal.classList.remove('hidden');
}

document.getElementById('fund-cancel-btn').addEventListener('click', () => fundModal.classList.add('hidden'));

document.getElementById('fund-save-btn').addEventListener('click', async () => {
  const amount = parseFloat(document.getElementById('fund-amount').value);
  const errorEl = document.getElementById('fund-error');

  if (!amount || amount <= 0) {
    errorEl.textContent = 'Please enter a valid amount greater than 0.';
    errorEl.classList.remove('hidden');
    return;
  }

  try {
    if (fundContext.mode === 'contribute') {
      await contributeToVaultGoal(fundContext.goalId, Math.round(amount), selectedFundWallet);
    } else {
      if (amount > fundContext.savedAmount) throw new Error('You cannot withdraw more than what is saved.');
      await withdrawFromVaultGoal(fundContext.goalId, Math.round(amount), selectedFundWallet);
    }
    fundModal.classList.add('hidden');
    await renderAll();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.classList.remove('hidden');
  }
});

renderAll();
