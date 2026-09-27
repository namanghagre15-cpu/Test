/* ============================================================
   onboarding.js — First-run wizard (onboarding.html).
   Deliberately does NOT import nav.js: there's no PIN yet, no
   bottom nav needed, and no recurring engine to run before the
   very first name is even set.
   ============================================================ */
import { setUserProfile } from './db.js';

window.__mfAppRendered = true;

let step = 1;
const totalSteps = 3;
let name = '';
let dob = '';

const nameInput = document.getElementById('ob-name-input');
const dobInput = document.getElementById('ob-dob-input');
const errorEl = document.getElementById('ob-error');
const nextBtn = document.getElementById('ob-next-btn');
const backBtn = document.getElementById('ob-back-btn');
const skipBtn = document.getElementById('ob-skip-btn');

function showStep(n) {
  step = n;
  for (let i = 1; i <= totalSteps; i++) {
    document.getElementById(`ob-step-${i}`).classList.toggle('hidden', i !== n);
    document.getElementById(`ob-dot-${i}`).classList.toggle('active', i <= n);
  }
  errorEl.classList.add('hidden');
  backBtn.classList.toggle('hidden', n === 1);
  skipBtn.classList.toggle('hidden', n !== 2);
  nextBtn.textContent = n === totalSteps ? 'Start Using Money follow' : 'Next';
  if (n === 1) nameInput.focus();
  if (n === 2) dobInput.focus();
}

function finish() {
  setUserProfile({ name: name.trim(), dob });
  window.location.replace('index.html');
}

nextBtn.addEventListener('click', () => {
  if (step === 1) {
    if (!nameInput.value.trim()) {
      errorEl.textContent = 'Please enter a name to continue.';
      errorEl.classList.remove('hidden');
      return;
    }
    name = nameInput.value.trim();
    showStep(2);
  } else if (step === 2) {
    dob = dobInput.value || '';
    document.getElementById('ob-done-greeting').textContent = `All set, ${name}!`;
    showStep(3);
  } else {
    finish();
  }
});

skipBtn.addEventListener('click', () => {
  dob = '';
  document.getElementById('ob-done-greeting').textContent = `All set, ${name}!`;
  showStep(3);
});

backBtn.addEventListener('click', () => {
  if (step > 1) showStep(step - 1);
});

nameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') nextBtn.click();
});

showStep(1);
