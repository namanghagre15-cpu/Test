/* ============================================================
   add.js — Manual Entry (numpad) + REAL QR Scan & UPI Pay (add.html)
   The QR step uses the real browser camera (getUserMedia) and a
   real QR decoder (jsQR) — no timers pretending to "scan". The
   UPI payment itself is a real `upi://` deep link handed to the
   OS, which is exactly how every UPI app integration works from
   a web page (there is no way for a website to fake a successful
   bank transfer — only the UPI app + user's bank can do that,
   which is why we still mark it "Pending" until the user confirms).
   ============================================================ */
import { renderNav } from './nav.js';
import {
  addExpense,
  categoryIcon,
  CATEGORIES,
  suggestCategoryByTime,
  recallWalletForCategory,
} from './db.js';

renderNav('add');
window.__mfAppRendered = true;

let selectedCategory = suggestCategoryByTime();
let selectedExpenseType = 'need';
let selectedWalletType = recallWalletForCategory(selectedCategory) || 'cash';
let selectedDateISO = new Date().toISOString();

const categoryRow = document.getElementById('category-row');
const amountInput = document.getElementById('amount-input');
const noteInput = document.getElementById('note-input');
const formError = document.getElementById('form-error');

/* ---------------- Amount (real device keyboard) ---------------- */

function renderAmount() {
  const len = amountInput.value.length;
  const size = len <= 6 ? 56 : Math.max(30, 56 - (len - 6) * 3);
  amountInput.style.fontSize = size + 'px';
  updateSubmitLabel();
}

amountInput.addEventListener('input', () => {
  // Digits and a single decimal point only — same intent as the old
  // numpad, just driven by the device's own keyboard now.
  let clean = amountInput.value.replace(/[^0-9.]/g, '');
  const firstDot = clean.indexOf('.');
  if (firstDot !== -1) {
    clean = clean.slice(0, firstDot + 1) + clean.slice(firstDot + 1).replace(/\./g, '');
  }
  amountInput.value = clean;
  formError.classList.add('hidden');
  renderAmount();
});

document.querySelectorAll('.quick-chip').forEach((btn) => {
  btn.addEventListener('click', () => {
    const add = Number(btn.dataset.quick) || 0;
    const current = parseFloat(amountInput.value) || 0;
    amountInput.value = String(Math.round((current + add) * 100) / 100);
    formError.classList.add('hidden');
    renderAmount();
  });
});

function readAmount() {
  const val = parseFloat(amountInput.value);
  if (!val || val <= 0) {
    formError.textContent = 'Please enter a valid amount greater than 0.';
    formError.classList.remove('hidden');
    amountInput.focus();
    return null;
  }
  formError.classList.add('hidden');
  return Math.round(val * 100) / 100;
}

/* ---------------- Date picker ---------------- */

const dateInput = document.getElementById('date-input');
const datePillLabel = document.getElementById('date-pill-label');

function formatDateLabel(iso) {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date(today);
  yest.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yest.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

document.getElementById('date-pill').addEventListener('click', () => {
  if (dateInput.showPicker) dateInput.showPicker();
  else dateInput.focus();
});
dateInput.value = new Date().toISOString().slice(0, 10);
dateInput.addEventListener('change', () => {
  if (!dateInput.value) return;
  const chosen = new Date(dateInput.value + 'T12:00:00');
  selectedDateISO = chosen.toISOString();
  datePillLabel.textContent = formatDateLabel(selectedDateISO);
});

/* ---------------- Category selector (quick row + "More" sheet) ---------------- */

const QUICK_CATEGORIES = [
  { cat: 'Outside Food', label: 'Food' },
  { cat: 'Mess', label: 'Mess' },
  { cat: 'Travel', label: 'Travel' },
  { cat: 'Bills', label: 'Bills' },
  { cat: 'Books', label: 'Books' },
];

function renderCategories() {
  const inQuick = QUICK_CATEGORIES.some((q) => q.cat === selectedCategory);
  const tiles = QUICK_CATEGORIES.map(
    (q) => `
    <button type="button" class="cat-tile ${selectedCategory === q.cat ? 'active' : ''}" data-cat="${q.cat}">
      <span class="cat-ico">${categoryIcon(q.cat, 22)}</span>
      <span class="cat-label">${q.label}</span>
    </button>`
  );
  const moreLabel = inQuick ? 'More' : selectedCategory;
  const moreIcon = inQuick
    ? `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6"/></svg>`
    : categoryIcon(selectedCategory, 22);
  tiles.push(`
    <button type="button" id="cat-more-btn" class="cat-tile ${!inQuick ? 'active' : ''}">
      <span class="cat-ico">${moreIcon}</span>
      <span class="cat-label">${moreLabel}</span>
    </button>`);
  categoryRow.innerHTML = tiles.join('');

  categoryRow.querySelectorAll('[data-cat]').forEach((el) => {
    el.addEventListener('click', () => selectCategory(el.dataset.cat));
  });
  document.getElementById('cat-more-btn').addEventListener('click', openCatSheet);
}

function selectCategory(cat) {
  selectedCategory = cat;
  const remembered = recallWalletForCategory(cat);
  if (remembered) {
    selectedWalletType = remembered;
    renderWalletTypeButtons();
  }
  renderCategories();
}

const catSheet = document.getElementById('cat-sheet');
function openCatSheet() {
  const grid = document.getElementById('cat-sheet-grid');
  grid.innerHTML = CATEGORIES.map(
    (cat) => `
    <button type="button" class="cat-tile ${selectedCategory === cat ? 'active' : ''}" data-cat="${cat}">
      <span class="cat-ico">${categoryIcon(cat, 22)}</span>
      <span class="cat-label">${cat}</span>
    </button>`
  ).join('');
  grid.querySelectorAll('[data-cat]').forEach((el) => {
    el.addEventListener('click', () => {
      selectCategory(el.dataset.cat);
      catSheet.classList.add('hidden');
    });
  });
  catSheet.classList.remove('hidden');
}
document.getElementById('cat-sheet-overlay').addEventListener('click', (e) => {
  if (e.target.id === 'cat-sheet-overlay') catSheet.classList.add('hidden');
});

/* ---------------- Need / Want toggle ---------------- */

function renderExpenseTypeButtons() {
  document.querySelectorAll('.expense-type-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.expenseType === selectedExpenseType);
  });
}
document.querySelectorAll('.expense-type-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    selectedExpenseType = btn.dataset.expenseType;
    renderExpenseTypeButtons();
  });
});

/* ---------------- Paid with (Cash / Online) ---------------- */

function renderWalletTypeButtons() {
  document.querySelectorAll('.paid-opt').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.walletType === selectedWalletType);
  });
  document.getElementById('online-flow').classList.toggle('hidden', selectedWalletType !== 'online');
  updateSubmitLabel();
}
document.querySelectorAll('.paid-opt').forEach((btn) => {
  btn.addEventListener('click', () => {
    selectedWalletType = btn.dataset.walletType;
    renderWalletTypeButtons();
  });
});

/* ---------------- Submit button (single CTA, behavior depends on Paid with) ---------------- */

const submitBtn = document.getElementById('submit-btn');
const submitLabel = document.getElementById('submit-label');
const submitIcon = document.getElementById('submit-icon');

function updateSubmitLabel() {
  const amt = parseFloat(amountInput.value) || 0;
  const shown = amt > 0 ? amt : 0;
  if (selectedWalletType === 'online') {
    submitLabel.textContent = `Pay & Save · ₹${shown}`;
    submitIcon.classList.remove('hidden');
  } else {
    submitLabel.textContent = `Save Expense · ₹${shown}`;
    submitIcon.classList.add('hidden');
  }
}

submitBtn.addEventListener('click', async () => {
  const amount = readAmount();
  if (amount === null) return;

  if (selectedWalletType === 'online') {
    decodedPayee = { pa: '', pn: '', am: String(amount) };
    scanModal.classList.remove('hidden');
    startCamera();
    return;
  }

  await addExpense({
    amount,
    category: selectedCategory,
    walletType: selectedWalletType,
    expenseType: selectedExpenseType,
    note: noteInput.value.trim(),
    isPending: false,
    receiptImage: receiptBlob,
    date: selectedDateISO,
  });

  window.location.href = 'index.html';
});

renderCategories();
renderExpenseTypeButtons();
renderWalletTypeButtons();
renderAmount();

/* ---------------- Receipt (photo OR PDF, compressed client-side) ---------------- */
let receiptBlob = null;

function resizeImageToBlob(file, maxDim = 900, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = () => {
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality);
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

document.getElementById('receipt-input').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const img = document.getElementById('receipt-preview-img');
  const pdfBadge = document.getElementById('receipt-pdf-badge');
  if (file.type === 'application/pdf') {
    receiptBlob = file;
    img.style.display = 'none';
    pdfBadge.style.display = 'flex';
    document.getElementById('receipt-sub').textContent = file.name;
  } else {
    receiptBlob = await resizeImageToBlob(file);
    img.src = URL.createObjectURL(receiptBlob);
    img.style.display = 'block';
    pdfBadge.style.display = 'none';
    document.getElementById('receipt-sub').textContent = 'Photo attached';
  }
  document.getElementById('receipt-empty-row').classList.add('hidden');
  document.getElementById('receipt-preview-row').classList.remove('hidden');
});

document.getElementById('receipt-remove-btn').addEventListener('click', () => {
  receiptBlob = null;
  document.getElementById('receipt-input').value = '';
  document.getElementById('receipt-sub').textContent = 'Snap a photo or pick a PDF';
  document.getElementById('receipt-empty-row').classList.remove('hidden');
  document.getElementById('receipt-preview-row').classList.add('hidden');
});

/* ---------------- SMS Clipboard Quick-Detect (real Clipboard API) ---------------- */

document.getElementById('clipboard-detect-btn').addEventListener('click', async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (!text) {
      formError.textContent = 'Clipboard is empty.';
      formError.classList.remove('hidden');
      return;
    }
    const match = text.match(/(?:rs\.?|inr|₹)\s?([\d,]+(?:\.\d{1,2})?)/i);
    if (!match) {
      formError.textContent = "Couldn't find an amount in your clipboard text.";
      formError.classList.remove('hidden');
      return;
    }
    const amount = parseFloat(match[1].replace(/,/g, ''));
    if (window.confirm(`₹${amount} debit detected. Fill this amount?`)) {
      amountStr = String(amount);
      renderAmount();
    }
  } catch (err) {
    formError.textContent = 'Clipboard access was denied or is unavailable in this browser.';
    formError.classList.remove('hidden');
  }
});

/* ================================================================
   REAL QR Scanner + UPI Deep Link
   ================================================================ */

const scanModal = document.getElementById('scan-modal');
const cameraView = document.getElementById('scan-camera-view');
const manualView = document.getElementById('scan-manual-view');
const confirmView = document.getElementById('scan-confirm-view');
const pendingView = document.getElementById('scan-pending-view');
const qrStatus = document.getElementById('qr-status');
const video = document.getElementById('qr-video');
const canvas = document.getElementById('qr-canvas');
const canvasCtx = canvas.getContext('2d', { willReadFrequently: true });

let mediaStream = null;
let scanRAF = null;
let decodedPayee = { pa: '', pn: '', am: '' };

function showView(view) {
  [cameraView, manualView, confirmView, pendingView].forEach((v) => v.classList.add('hidden'));
  view.classList.remove('hidden');
}

async function startCamera() {
  showView(cameraView);
  qrStatus.textContent = 'Starting camera…';
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false,
    });
    video.srcObject = mediaStream;
    await video.play();
    qrStatus.textContent = 'Scanning…';
    scanLoop();
  } catch (err) {
    qrStatus.textContent = 'Camera access denied or unavailable. You can enter the UPI ID manually instead.';
  }
}

function stopCamera() {
  if (scanRAF) cancelAnimationFrame(scanRAF);
  scanRAF = null;
  if (mediaStream) {
    mediaStream.getTracks().forEach((t) => t.stop());
    mediaStream = null;
  }
}

function scanLoop() {
  if (!mediaStream) return;
  if (video.readyState === video.HAVE_ENOUGH_DATA) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvasCtx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = canvasCtx.getImageData(0, 0, canvas.width, canvas.height);
    const code = window.jsQR ? window.jsQR(imageData.data, imageData.width, imageData.height) : null;
    if (code && code.data) {
      handleDecodedText(code.data);
      return; // stop looping — handleDecodedText takes over
    }
  }
  scanRAF = requestAnimationFrame(scanLoop);
}

function parseUpiUri(text) {
  // Real UPI Intent URI format: upi://pay?pa=<vpa>&pn=<name>&am=<amount>&cu=INR&tn=<note>
  if (!/^upi:\/\/pay/i.test(text)) return null;
  const queryStr = text.split('?')[1] || '';
  const params = new URLSearchParams(queryStr);
  return {
    pa: params.get('pa') || '',
    pn: params.get('pn') || '',
    am: params.get('am') || '',
    tn: params.get('tn') || '',
  };
}

function handleDecodedText(text) {
  const parsed = parseUpiUri(text);
  if (!parsed || !parsed.pa) {
    qrStatus.textContent = 'That QR is not a UPI payment code. Point at a valid UPI QR to try again.';
    // Keep scanning — a mis-read or unrelated QR shouldn't dead-end the flow
    scanRAF = requestAnimationFrame(scanLoop);
    return;
  }
  decodedPayee = parsed;
  stopCamera();
  openConfirmView();
}

function openConfirmView() {
  document.getElementById('qr-payee-line').textContent = `Paying ${decodedPayee.pn || decodedPayee.pa} (${decodedPayee.pa})`;
  const amountField = document.getElementById('qr-confirm-amount');
  amountField.value = decodedPayee.am || (parseFloat(amountInput.value) > 0 ? amountInput.value : '');
  showView(confirmView);
}

document.getElementById('qr-manual-entry-btn').addEventListener('click', () => {
  stopCamera();
  showView(manualView);
});

document.getElementById('manual-upi-continue-btn').addEventListener('click', () => {
  const upiId = document.getElementById('manual-upi-id').value.trim();
  if (!upiId || !upiId.includes('@')) {
    alert('Please enter a valid UPI ID (e.g. name@bank).');
    return;
  }
  decodedPayee = { pa: upiId, pn: upiId.split('@')[0], am: '' };
  openConfirmView();
});

document.getElementById('qr-confirm-cancel').addEventListener('click', () => {
  scanModal.classList.add('hidden');
  stopCamera();
  decodedPayee = { pa: '', pn: '', am: '' };
});

document.getElementById('scan-close-btn').addEventListener('click', () => {
  scanModal.classList.add('hidden');
  stopCamera();
  decodedPayee = { pa: '', pn: '', am: '' };
});

document.getElementById('qr-confirm-pay').addEventListener('click', async () => {
  const amountField = document.getElementById('qr-confirm-amount');
  const amount = parseFloat(amountField.value);
  if (!amount || amount <= 0) {
    alert('Please enter a valid amount to pay.');
    return;
  }
  const finalAmount = Math.round(amount * 100) / 100;

  // Save locally first as Pending — this is the real Pending UPI Recovery
  // workflow: we cannot know the bank-transfer result from a web page, so
  // we mark it pending and let the dashboard reconcile it afterwards.
  // Privacy: we only ever keep the payee's display name in this note, never
  // the scanned VPA/UPI ID itself — that value lives only in memory for the
  // few seconds needed to build the payment link below, and is cleared right
  // after. Nothing about who you paid is written to any settings or backup.
  await addExpense({
    amount: finalAmount,
    category: selectedCategory,
    walletType: 'online',
    expenseType: selectedExpenseType,
    note: noteInput.value.trim() || `UPI payment to ${decodedPayee.pn || 'merchant'}`,
    isPending: true,
  });

  showView(pendingView);

  // Build a genuine UPI deep link — every scanned/entered detail (payee VPA,
  // name, amount, note) is handed straight to the phone's UPI app chooser.
  const upiUrl = `upi://pay?pa=${encodeURIComponent(decodedPayee.pa)}&pn=${encodeURIComponent(
    decodedPayee.pn || 'Merchant'
  )}&am=${finalAmount}&cu=INR&tn=${encodeURIComponent(noteInput.value.trim() || selectedCategory)}`;

  setTimeout(() => {
    window.location.href = upiUrl;
  }, 400);

  setTimeout(() => {
    window.location.href = 'index.html';
  }, 2200);

  // Clear the in-memory payee details now that the handoff is done — this
  // app never persists a "recent payees" or UPI-ID list anywhere.
  decodedPayee = { pa: '', pn: '', am: '' };
});

// Make sure the camera is always released if the user navigates away.
window.addEventListener('beforeunload', stopCamera);
window.addEventListener('pagehide', stopCamera);
