/* ============================================================
   vault.js — Savings Goals, Emergency Fund, Challenges (vault.html)
   Emergency withdrawals require the app PIN (if one is set) AND
   a mandatory 5-second delay before the confirm button enables —
   both are real, enforced gates (not decorative).
   ============================================================ */
import { renderNav } from './nav.js';
import { initGhostToggle, setMoneyText } from './ghost.js';
import { hasPinSet, verifyPin } from './lock.js';
import {
  getVaultGoals,
  addVaultGoal,
  contributeToVaultGoal,
  withdrawFromVaultGoal,
  deleteVaultGoal,
  getTotalVaultLocked,
  initEmergencyFund,
  getChallengeProgress,
  canMarkTodayNoSpend,
  markTodayNoSpend,
  formatINR,
} from './db.js';
import { icon } from './icons.js';

renderNav('vault');
window.__mfAppRendered = true;
initGhostToggle();

const goalsList = document.getElementById('goals-list');
const goalsEmpty = document.getElementById('goals-empty');

/* ---------------- Render goals + challenges ---------------- */

async function renderAll() {
  await initEmergencyFund();
  const [goals, totalLocked] = await Promise.all([getVaultGoals(), getTotalVaultLocked()]);
  setMoneyText(document.getElementById('total-locked'), formatINR(totalLocked));

  goalsList.innerHTML = '';
  const visibleGoals = goals.slice().sort((a, b) => (b.isEmergency ? 1 : 0) - (a.isEmergency ? 1 : 0));

  if (visibleGoals.length === 0) {
    goalsEmpty.classList.remove('hidden');
  } else {
    goalsEmpty.classList.add('hidden');
  }

  visibleGoals.forEach((g) => {
    const hasTarget = g.targetAmount > 0;
    const pct = hasTarget ? Math.min(100, Math.round((g.savedAmount / g.targetAmount) * 100)) : 0;
    const isComplete = hasTarget && g.savedAmount >= g.targetAmount;
    const deadlineLabel = g.deadline
      ? new Date(g.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      : null;

    const card = document.createElement('div');
    card.className = `bg-card rounded-4xl border ${g.isEmergency ? 'border-crimson/30' : 'border-sage-soft'} shadow-soft p-5`;
    card.innerHTML = `
      <div class="flex items-start justify-between mb-3">
        <div>
          <h3 class="text-[18px] font-black leading-tight flex items-center gap-1.5">${g.isEmergency ? `<span class="text-crimson">${icon('shield', 16)}</span>` : ''}${g.title}</h3>
          ${deadlineLabel ? `<p class="text-[11px] font-bold text-sage mt-0.5 flex items-center gap-1">${icon('target', 12)} by ${deadlineLabel}</p>` : ''}
          ${g.isEmergency ? '<p class="text-[11px] font-bold text-sage mt-0.5">Open-ended reserve for unexpected expenses</p>' : ''}
        </div>
        ${g.isEmergency ? '' : `<button data-delete-goal="${g.id}" class="w-9 h-9 rounded-full bg-sage/15 flex items-center justify-center text-sage">${icon('trash', 15)}</button>`}
      </div>

      <div class="flex items-baseline gap-2 mb-2">
        <span class="text-[20px] font-black mf-amt" data-goal-saved="${g.id}">${formatINR(g.savedAmount)}</span>
        ${hasTarget ? `<span class="text-[13px] font-bold text-sage">/ ${formatINR(g.targetAmount)}</span>` : ''}
        ${isComplete ? `<span class="ml-auto text-[11px] font-black text-crimson flex items-center gap-1">${icon('trophy', 13)} Goal reached!</span>` : ''}
      </div>

      ${hasTarget ? `<div class="progress-track mb-4"><div class="progress-fill" style="width:${pct}%"></div></div>` : '<div class="mb-4"></div>'}

      <div class="grid grid-cols-2 gap-3">
        <button data-add-goal="${g.id}" data-title="${g.title}" class="py-3 rounded-2xl bg-charcoal text-white font-black text-[13px]">+ Add Funds</button>
        <button data-withdraw-goal="${g.id}" data-title="${g.title}" data-saved="${g.savedAmount}" class="py-3 rounded-2xl bg-card border border-sage-soft font-black text-[13px]">Withdraw</button>
      </div>
    `;
    goalsList.appendChild(card);
    setMoneyText(card.querySelector(`[data-goal-saved="${g.id}"]`), formatINR(g.savedAmount));
  });

  goalsList.querySelectorAll('[data-delete-goal]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (confirm('Delete this goal? Any saved money should be withdrawn first.')) {
        await deleteVaultGoal(Number(btn.dataset.deleteGoal));
        await renderAll();
      }
    });
  });
  goalsList.querySelectorAll('[data-add-goal]').forEach((btn) => {
    btn.addEventListener('click', () => openFundModal(Number(btn.dataset.addGoal), btn.dataset.title));
  });
  goalsList.querySelectorAll('[data-withdraw-goal]').forEach((btn) => {
    btn.addEventListener('click', () =>
      openWithdrawModal(Number(btn.dataset.withdrawGoal), btn.dataset.title, Number(btn.dataset.saved))
    );
  });

  await renderChallenges();
}

async function renderChallenges() {
  const challenges = await getChallengeProgress();
  const canMark = await canMarkTodayNoSpend();
  const list = document.getElementById('challenges-list');
  list.innerHTML = challenges
    .map((c) => {
      const pct = Math.min(100, Math.round((c.progress / c.target) * 100));
      const noSpendExtra =
        c.id === 'no_spend_day'
          ? `<button id="mark-no-spend-btn" class="mt-3 w-full py-2.5 rounded-2xl ${canMark ? 'bg-charcoal text-white' : 'bg-sage/20 text-sage'} font-black text-[12px] flex items-center justify-center gap-1.5" ${canMark ? '' : 'disabled'}>
               ${canMark ? `${icon('checkCircle', 15)} Mark Today as No-Spend` : c.complete ? 'Already logged a No-Spend day' : 'You already spent today'}
             </button>`
          : '';
      return `
      <div class="bg-card rounded-3xl border ${c.complete ? 'border-crimson/40' : 'border-sage-soft'} p-4">
        <div class="flex items-center justify-between mb-2">
          <p class="text-[14px] font-black flex items-center gap-2"><span class="text-crimson">${icon(c.icon, 16)}</span> ${c.title}</p>
          ${c.complete ? `<span class="text-[11px] font-black text-crimson flex items-center gap-1">${icon('check', 11)} Done</span>` : ''}
        </div>
        <p class="text-[12px] font-bold text-sage mb-3">${c.description}</p>
        <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
        ${noSpendExtra}
      </div>`;
    })
    .join('');

  const markBtn = document.getElementById('mark-no-spend-btn');
  if (markBtn && canMark) {
    markBtn.addEventListener('click', () => {
      markTodayNoSpend();
      renderAll();
    });
  }
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

/* ---------------- Contribute Modal ---------------- */

const fundModal = document.getElementById('fund-modal');
let fundGoalId = null;
let selectedFundWallet = 'cash';

function renderFundWalletButtons() {
  document.querySelectorAll('.fund-wallet-btn').forEach((btn) => {
    const active = btn.dataset.fundWallet === selectedFundWallet;
    btn.classList.toggle('bg-charcoal', active);
    btn.classList.toggle('text-white', active);
    btn.classList.toggle('bg-card', !active);
    btn.classList.toggle('text-ink', !active);
  });
}
document.querySelectorAll('.fund-wallet-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    selectedFundWallet = btn.dataset.fundWallet;
    renderFundWalletButtons();
  });
});

function openFundModal(goalId, title) {
  fundGoalId = goalId;
  selectedFundWallet = 'cash';
  renderFundWalletButtons();
  document.getElementById('fund-amount').value = '';
  document.getElementById('fund-error').classList.add('hidden');
  document.getElementById('fund-modal-goal').textContent = title;
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
    await contributeToVaultGoal(fundGoalId, Math.round(amount), selectedFundWallet);
    fundModal.classList.add('hidden');
    await renderAll();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.classList.remove('hidden');
  }
});

/* ---------------- Emergency Withdraw: amount -> PIN -> 5s delay -> confirm ---------------- */

const withdrawModal = document.getElementById('withdraw-modal');
let withdrawContext = { goalId: null, savedAmount: 0, amount: 0, walletType: 'cash' };
let withdrawPinBuffer = '';
let countdownTimer = null;

function showWithdrawStep(step) {
  document.getElementById('withdraw-step-amount').classList.toggle('hidden', step !== 'amount');
  document.getElementById('withdraw-step-pin').classList.toggle('hidden', step !== 'pin');
  document.getElementById('withdraw-step-delay').classList.toggle('hidden', step !== 'delay');
}

function renderWithdrawWalletButtons() {
  document.querySelectorAll('.withdraw-wallet-btn').forEach((btn) => {
    const active = btn.dataset.withdrawWallet === withdrawContext.walletType;
    btn.classList.toggle('bg-charcoal', active);
    btn.classList.toggle('text-white', active);
    btn.classList.toggle('bg-card', !active);
    btn.classList.toggle('text-ink', !active);
  });
}
document.querySelectorAll('.withdraw-wallet-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    withdrawContext.walletType = btn.dataset.withdrawWallet;
    renderWithdrawWalletButtons();
  });
});

function openWithdrawModal(goalId, title, savedAmount) {
  withdrawContext = { goalId, savedAmount, amount: 0, walletType: 'cash' };
  document.getElementById('withdraw-modal-goal').textContent = title;
  document.getElementById('withdraw-amount').value = '';
  document.getElementById('withdraw-error').classList.add('hidden');
  renderWithdrawWalletButtons();
  showWithdrawStep('amount');
  withdrawModal.classList.remove('hidden');
}

document.getElementById('withdraw-cancel-btn').addEventListener('click', () => {
  if (countdownTimer) clearInterval(countdownTimer);
  withdrawModal.classList.add('hidden');
});

document.getElementById('withdraw-continue-btn').addEventListener('click', () => {
  const amount = parseFloat(document.getElementById('withdraw-amount').value);
  const errorEl = document.getElementById('withdraw-error');
  if (!amount || amount <= 0) {
    errorEl.textContent = 'Please enter a valid amount greater than 0.';
    errorEl.classList.remove('hidden');
    return;
  }
  if (amount > withdrawContext.savedAmount) {
    errorEl.textContent = 'You cannot withdraw more than what is saved in this goal.';
    errorEl.classList.remove('hidden');
    return;
  }
  errorEl.classList.add('hidden');
  withdrawContext.amount = Math.round(amount);

  if (hasPinSet()) {
    withdrawPinBuffer = '';
    updateWithdrawPinDots();
    showWithdrawStep('pin');
  } else {
    startDelayCountdown();
  }
});

function updateWithdrawPinDots() {
  const dots = document.querySelectorAll('#withdraw-pin-dots .lock-dot');
  dots.forEach((d, i) => d.classList.toggle('filled', i < withdrawPinBuffer.length));
}

document.querySelectorAll('[data-wnum]').forEach((btn) => {
  btn.addEventListener('click', async () => {
    if (withdrawPinBuffer.length >= 4) return;
    withdrawPinBuffer += btn.dataset.wnum;
    updateWithdrawPinDots();
    if (withdrawPinBuffer.length === 4) {
      const ok = await verifyPin(withdrawPinBuffer);
      if (ok) {
        startDelayCountdown();
      } else {
        document.getElementById('withdraw-error').textContent = 'Incorrect PIN.';
        document.getElementById('withdraw-error').classList.remove('hidden');
        withdrawPinBuffer = '';
        updateWithdrawPinDots();
      }
    }
  });
});
document.getElementById('withdraw-pin-back').addEventListener('click', () => {
  withdrawPinBuffer = withdrawPinBuffer.slice(0, -1);
  updateWithdrawPinDots();
});

function startDelayCountdown() {
  showWithdrawStep('delay');
  let seconds = 5;
  const countdownEl = document.getElementById('withdraw-countdown');
  const confirmBtn = document.getElementById('withdraw-confirm-btn');
  confirmBtn.disabled = true;
  confirmBtn.classList.add('opacity-40');
  countdownEl.textContent = seconds;

  if (countdownTimer) clearInterval(countdownTimer);
  countdownTimer = setInterval(() => {
    seconds--;
    countdownEl.textContent = seconds;
    if (seconds <= 0) {
      clearInterval(countdownTimer);
      countdownEl.textContent = '✓';
      confirmBtn.disabled = false;
      confirmBtn.classList.remove('opacity-40');
    }
  }, 1000);
}

document.getElementById('withdraw-confirm-btn').addEventListener('click', async () => {
  const errorEl = document.getElementById('withdraw-error');
  try {
    await withdrawFromVaultGoal(withdrawContext.goalId, withdrawContext.amount, withdrawContext.walletType);
    withdrawModal.classList.add('hidden');
    await renderAll();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.classList.remove('hidden');
  }
});

renderAll();

// Support #challenges deep-link from dashboard quick-links
if (window.location.hash === '#challenges') {
  setTimeout(() => document.getElementById('challenges')?.scrollIntoView({ behavior: 'smooth' }), 300);
}
