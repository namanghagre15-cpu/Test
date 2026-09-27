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
let amountStr = '0';

const categoryRow = document.getElementById('category-row');
const amountDisplay = document.getElementById('amount-display');
const noteInput = document.getElementById('note-input');
const formError = document.getElementById('form-error');

/* ---------------- Category selector ---------------- */

const PRIMARY_CATEGORIES = ['Mess', 'Outside Food', 'Travel', 'Bills', 'Books', 'Fun'];
const categoryMoreRow = document.getElementById('category-more-row');
const categoryMoreBtn = document.getElementById('category-more-btn');
let showMoreCategories = false;

function createCategoryButton(cat, compact = false) {
  const isActive = cat === selectedCategory;
  const el = document.createElement('button');
  el.type = 'button';
  el.className = `mf-category-pill ${isActive ? 'is-active' : ''} ${compact ? 'is-compact' : ''}`;
  el.setAttribute('aria-pressed', String(isActive));
  el.innerHTML = `<span class="mf-category-icon">${categoryIcon(cat, 18)}</span><span>${cat}</span>`;
  el.addEventListener('click', () => {
    selectedCategory = cat;
    const remembered = recallWalletForCategory(cat);
    if (remembered) {
      selectedWalletType = remembered;
      renderWalletTypeButtons();
    }
    renderCategories();
  });
  return el;
}

function renderCategories() {
  categoryRow.innerHTML = '';
  PRIMARY_CATEGORIES.forEach((cat) => categoryRow.appendChild(createCategoryButton(cat)));

  categoryMoreRow.innerHTML = '';
  CATEGORIES.filter((cat) => !PRIMARY_CATEGORIES.includes(cat)).forEach((cat) => {
    categoryMoreRow.appendChild(createCategoryButton(cat, true));
  });
  categoryMoreRow.classList.toggle('hidden', !showMoreCategories);
  categoryMoreBtn.textContent = showMoreCategories ? 'Hide extra categories' : 'More categories';
  categoryMoreBtn.setAttribute('aria-expanded', String(showMoreCategories));
}

categoryMoreBtn.addEventListener('click', () => {
  showMoreCategories = !showMoreCategories;
  renderCategories();
  if (showMoreCategories) categoryMoreRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});

function renderExpenseTypeButtons() {
  document.querySelectorAll('.expense-type-btn').forEach((btn) => {
    const active = btn.dataset.expenseType === selectedExpenseType;
    btn.classList.toggle('bg-charcoal', active);
    btn.classList.toggle('text-white', active);
    btn.classList.toggle('bg-card', !active);
    btn.classList.toggle('text-ink', !active);
  });
}
document.querySelectorAll('.expense-type-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    selectedExpenseType = btn.dataset.expenseType;
    renderExpenseTypeButtons();
  });
});

function renderWalletTypeButtons() {
  document.querySelectorAll('.wallet-type-btn').forEach((btn) => {
    const active = btn.dataset.walletType === selectedWalletType;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-pressed', String(active));
  });

  const badge = document.getElementById('payment-mode-badge');
  const helper = document.getElementById('payment-helper');
  if (badge) badge.textContent = selectedWalletType === 'online' ? 'ONLINE' : 'CASH';
  if (helper) helper.textContent = selectedWalletType === 'online'
    ? 'QR scan → UPI app → expense saved as pending.'
    : 'Saved instantly to your Money Follow wallet.';

  updatePrimaryAction();
}

document.querySelectorAll('.wallet-type-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    selectedWalletType = btn.dataset.walletType;
    renderWalletTypeButtons();
  });
});

renderCategories();
renderExpenseTypeButtons();
renderWalletTypeButtons();

/* ---------------- Numpad ---------------- */

function renderAmount() {
  amountDisplay.textContent = amountStr;
  const len = amountStr.length;
  const size = len <= 6 ? 42 : Math.max(22, 42 - (len - 6) * 2.4);
  amountDisplay.style.fontSize = size + 'px';
  updatePrimaryAction();
}

document.querySelectorAll('.numpad-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const key = btn.dataset.key;
    formError.classList.add('hidden');
    if (key === 'back') {
      amountStr = amountStr.length > 1 ? amountStr.slice(0, -1) : '0';
    } else if (key === '.') {
      if (!amountStr.includes('.')) amountStr += '.';
    } else {
      if (amountStr === '0') amountStr = key;
      else if (amountStr.length < 9) amountStr += key;
    }
    renderAmount();
  });
});

document.querySelectorAll('.mf-quick-amount').forEach((btn) => {
  btn.addEventListener('click', () => {
    amountStr = btn.dataset.quickAmount || '0';
    formError.classList.add('hidden');
    renderAmount();
  });
});

function updatePrimaryAction() {
  const amount = amountStr || '0';
  const amountText = `₹${amount}`;
  const online = selectedWalletType === 'online';
  const label = document.getElementById('save-action-label');
  const actionAmount = document.getElementById('save-action-amount');
  const metaAmount = document.getElementById('action-amount-label');
  const flowLabel = document.getElementById('action-flow-label');
  const icon = document.getElementById('save-action-icon');
  const button = document.getElementById('save-btn');
  if (!button) return;

  label.textContent = online ? 'Pay & Save' : 'Save Expense';
  actionAmount.textContent = amountText;
  metaAmount.textContent = amountText;
  flowLabel.textContent = online
    ? 'QR scanner → UPI app → save as pending'
    : 'Saved directly to Money Follow';
  button.classList.toggle('is-online', online);
  icon.innerHTML = online
    ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z"/><path d="M14 14h2v2M18 14h2v6h-6v-2M14 18h2"/></svg>`
    : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h11l4 4v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z"/><path d="M8 4v5h7V4M8 21v-7h8v7"/></svg>`;
}

function readAmount() {
  const val = parseFloat(amountStr);
  if (!val || val <= 0) {
    formError.textContent = 'Please enter a valid amount greater than 0.';
    formError.classList.remove('hidden');
    return null;
  }
  formError.classList.add('hidden');
  return Math.round(val * 100) / 100;
}

/* ---------------- Receipt photo (optional, compressed client-side) ---------------- */
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
  receiptBlob = await resizeImageToBlob(file);
  document.getElementById('receipt-preview-img').src = URL.createObjectURL(receiptBlob);
  document.getElementById('receipt-empty-row').classList.add('hidden');
  document.getElementById('receipt-preview-row').classList.remove('hidden');
});

document.getElementById('receipt-remove-btn').addEventListener('click', () => {
  receiptBlob = null;
  document.getElementById('receipt-input').value = '';
  document.getElementById('receipt-empty-row').classList.remove('hidden');
  document.getElementById('receipt-preview-row').classList.add('hidden');
});

/* ---------------- Save (instant, non-pending) ---------------- */

async function saveCashExpense() {
  const amount = readAmount();
  if (amount === null) return;

  await addExpense({
    amount,
    category: selectedCategory,
    walletType: 'cash',
    expenseType: selectedExpenseType,
    note: noteInput.value.trim(),
    isPending: false,
    receiptImage: receiptBlob,
  });

  window.location.href = 'index.html';
}

function launchQrFlow() {
  decodedPayee = { pa: '', pn: '', am: '' };
  scanModal.classList.remove('hidden');
  startCamera();
}

document.getElementById('save-btn').addEventListener('click', async () => {
  if (selectedWalletType === 'online') {
    launchQrFlow();
    return;
  }
  await saveCashExpense();
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
  amountField.value = decodedPayee.am || (amountStr !== '0' ? amountStr : '');
  showView(confirmView);
}

document.getElementById('scan-qr-btn').addEventListener('click', launchQrFlow);

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
