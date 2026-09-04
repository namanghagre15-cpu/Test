/* ============================================================
   khata.js — Lend/Borrow ledger + Roommate Splitter (khata.html)
   The WhatsApp reminder uses the real wa.me share-link scheme,
   which opens WhatsApp's actual share sheet with the message
   pre-filled — genuinely functional, not a mockup.
   ============================================================ */
import { renderNav } from './nav.js';
import {
  addLedgerEntry,
  getLedgerEntries,
  getLedgerTotals,
  markLedgerSettled,
  deleteLedgerEntry,
  buildWhatsAppReminderLink,
  addSplit,
  getSplits,
  formatINR,
  formatDate,
} from './db.js';

renderNav('khata');

/* ---------------- Tabs ---------------- */
const tabLedger = document.getElementById('tab-ledger');
const tabSplit = document.getElementById('tab-split');
const ledgerSection = document.getElementById('ledger-section');
const splitSection = document.getElementById('split-section');

tabLedger.addEventListener('click', () => {
  tabLedger.classList.add('active');
  tabSplit.classList.remove('active');
  ledgerSection.classList.remove('hidden');
  splitSection.classList.add('hidden');
});
tabSplit.addEventListener('click', () => {
  tabSplit.classList.add('active');
  tabLedger.classList.remove('active');
  splitSection.classList.remove('hidden');
  ledgerSection.classList.add('hidden');
});

/* ---------------- Totals ---------------- */
async function renderTotals() {
  const { owedToMe, iOwe } = await getLedgerTotals();
  document.getElementById('owed-to-me').textContent = formatINR(owedToMe);
  document.getElementById('i-owe').textContent = formatINR(iOwe);
}

/* ---------------- Ledger form ---------------- */
let selectedDirection = 'owe_me';
function renderDirectionButtons() {
  document.querySelectorAll('.ledger-dir-btn').forEach((btn) => {
    const active = btn.dataset.direction === selectedDirection;
    btn.classList.toggle('bg-charcoal', active);
    btn.classList.toggle('text-white', active);
    btn.classList.toggle('bg-card', !active);
  });
}
document.querySelectorAll('.ledger-dir-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    selectedDirection = btn.dataset.direction;
    renderDirectionButtons();
  });
});
renderDirectionButtons();

document.getElementById('add-ledger-btn').addEventListener('click', async () => {
  const name = document.getElementById('ledger-name').value.trim();
  const amount = parseFloat(document.getElementById('ledger-amount').value);
  const note = document.getElementById('ledger-note').value.trim();
  const errorEl = document.getElementById('ledger-error');

  if (!name) {
    errorEl.textContent = "Please enter the person's name.";
    errorEl.classList.remove('hidden');
    return;
  }
  if (!amount || amount <= 0) {
    errorEl.textContent = 'Please enter a valid amount.';
    errorEl.classList.remove('hidden');
    return;
  }
  errorEl.classList.add('hidden');

  await addLedgerEntry({ personName: name, amount: Math.round(amount), direction: selectedDirection, note });
  document.getElementById('ledger-name').value = '';
  document.getElementById('ledger-amount').value = '';
  document.getElementById('ledger-note').value = '';
  await renderEverything();
});

async function renderLedgerList() {
  const entries = await getLedgerEntries();
  const list = document.getElementById('ledger-list');
  const empty = document.getElementById('ledger-empty');
  list.innerHTML = '';
  if (entries.length === 0) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  entries.forEach((e) => {
    const isOweMe = e.direction === 'owe_me';
    const item = document.createElement('div');
    item.className = `bg-card rounded-3xl border ${e.settled ? 'border-sage-soft opacity-60' : 'border-sage-soft'} p-4`;
    item.innerHTML = `
      <div class="flex items-center justify-between mb-2">
        <p class="text-[15px] font-black">${isOweMe ? '🤲' : '💳'} ${e.personName}</p>
        <p class="text-[15px] font-black ${isOweMe ? 'text-charcoal' : 'text-crimson'}">${formatINR(e.amount)}</p>
      </div>
      <p class="text-[11px] font-bold text-sage mb-3">${isOweMe ? 'Owes me' : 'I owe'} · ${formatDate(e.date)}${e.note ? ' · ' + e.note : ''}${e.settled ? ' · Settled ✓' : ''}</p>
      <div class="flex gap-2">
        ${!e.settled ? `<button data-settle="${e.id}" class="flex-1 py-2 rounded-xl bg-charcoal text-white font-black text-[11px]">✓ Mark Settled</button>` : ''}
        ${isOweMe && !e.settled ? `<button data-remind="${e.id}" class="flex-1 py-2 rounded-xl bg-green-600/10 text-green-700 font-black text-[11px]">💬 WhatsApp Reminder</button>` : ''}
        <button data-delete-ledger="${e.id}" class="py-2 px-3 rounded-xl bg-crimson/10 text-crimson font-black text-[11px]">🗑️</button>
      </div>
    `;
    list.appendChild(item);
  });

  list.querySelectorAll('[data-settle]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await markLedgerSettled(Number(btn.dataset.settle));
      await renderEverything();
    });
  });
  list.querySelectorAll('[data-delete-ledger]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (confirm('Delete this entry?')) {
        await deleteLedgerEntry(Number(btn.dataset.deleteLedger));
        await renderEverything();
      }
    });
  });
  list.querySelectorAll('[data-remind]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const entries2 = await getLedgerEntries();
      const entry = entries2.find((x) => x.id === Number(btn.dataset.remind));
      if (!entry) return;
      const link = buildWhatsAppReminderLink(entry.personName, entry.amount, entry.note);
      window.open(link, '_blank');
    });
  });
}

/* ---------------- Splitter ---------------- */
let selectedPayer = 'me';
function renderPayerButtons() {
  document.querySelectorAll('.split-payer-btn').forEach((btn) => {
    const active = btn.dataset.payer === selectedPayer;
    btn.classList.toggle('bg-charcoal', active);
    btn.classList.toggle('text-white', active);
    btn.classList.toggle('bg-card', !active);
  });
}
document.querySelectorAll('.split-payer-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    selectedPayer = btn.dataset.payer;
    renderPayerButtons();
  });
});
renderPayerButtons();

function parseParticipants() {
  const raw = document.getElementById('split-participants').value;
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((name) => ({ name }));
}

function updateSplitPreview() {
  const total = parseFloat(document.getElementById('split-total').value) || 0;
  const participants = parseParticipants();
  const preview = document.getElementById('split-preview');
  if (participants.length === 0 || total <= 0) {
    preview.textContent = 'Enter names to see the per-person share.';
    return;
  }
  const share = Math.round((total / participants.length) * 100) / 100;
  preview.textContent = `${formatINR(share)} per person × ${participants.length} people`;
}
document.getElementById('split-total').addEventListener('input', updateSplitPreview);
document.getElementById('split-participants').addEventListener('input', updateSplitPreview);

document.getElementById('save-split-btn').addEventListener('click', async () => {
  const title = document.getElementById('split-title').value.trim();
  const total = parseFloat(document.getElementById('split-total').value);
  const participants = parseParticipants();
  const errorEl = document.getElementById('split-error');

  if (!title) {
    errorEl.textContent = 'Please describe what this bill was for.';
    errorEl.classList.remove('hidden');
    return;
  }
  if (!total || total <= 0) {
    errorEl.textContent = 'Please enter a valid total amount.';
    errorEl.classList.remove('hidden');
    return;
  }
  if (participants.length < 2) {
    errorEl.textContent = 'Add at least 2 people to split between.';
    errorEl.classList.remove('hidden');
    return;
  }
  errorEl.classList.add('hidden');

  await addSplit({ title, totalAmount: Math.round(total), payer: selectedPayer, participants });

  document.getElementById('split-title').value = '';
  document.getElementById('split-total').value = '';
  document.getElementById('split-participants').value = '';
  updateSplitPreview();
  await renderEverything();
});

async function renderSplitList() {
  const splits = await getSplits();
  const list = document.getElementById('split-list');
  const empty = document.getElementById('split-empty');
  list.innerHTML = '';
  if (splits.length === 0) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  splits.forEach((s) => {
    const item = document.createElement('div');
    item.className = 'bg-card rounded-3xl border border-sage-soft p-4';
    item.innerHTML = `
      <div class="flex items-center justify-between mb-1">
        <p class="text-[15px] font-black">${s.title}</p>
        <p class="text-[15px] font-black">${formatINR(s.totalAmount)}</p>
      </div>
      <p class="text-[11px] font-bold text-sage mb-2">${formatDate(s.date)} · Paid by ${s.payer === 'me' ? 'me' : 'someone else'}</p>
      <div class="flex flex-wrap gap-1.5">
        ${s.participants
          .map((p) => `<span class="text-[11px] font-bold bg-sage/15 rounded-full px-2.5 py-1">${p.name}: ${formatINR(p.share)}</span>`)
          .join('')}
      </div>
    `;
    list.appendChild(item);
  });
}

async function renderEverything() {
  await renderTotals();
  await renderLedgerList();
  await renderSplitList();
}

renderEverything();
