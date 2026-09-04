/* ============================================================
   lock.js — App Lock (PIN + WebAuthn biometric)
   PIN is never stored in plaintext — only a SHA-256 hash
   (via the real browser SubtleCrypto API) lives in localStorage.
   Biometric unlock uses the real WebAuthn API
   (navigator.credentials.create/get) with a platform
   authenticator — this genuinely prompts Face/Touch/Fingerprint
   unlock on devices & browsers that support it; on devices
   without a platform authenticator the browser itself will
   reject registration/assertion, which we surface as an error
   rather than fake success.
   ============================================================ */
import { getLocal, setLocal, removeLocal } from './db.js';

const SESSION_UNLOCK_KEY = 'mf_unlocked';

/* ---------------- Hashing helpers (real SubtleCrypto) ---------------- */

async function sha256Hex(text) {
  const enc = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function hasPinSet() {
  return !!getLocal('pin_hash', null);
}

export async function setupPin(pin) {
  const hash = await sha256Hex(pin);
  setLocal('pin_hash', hash);
}

export async function verifyPin(pin) {
  const stored = getLocal('pin_hash', null);
  if (!stored) return false;
  const hash = await sha256Hex(pin);
  return hash === stored;
}

export function removePin() {
  removeLocal('pin_hash');
  removeLocal('webauthn_id');
}

/* ---------------- WebAuthn biometric ---------------- */

export function isWebAuthnSupported() {
  return typeof window !== 'undefined' && !!window.PublicKeyCredential;
}

export function hasBiometricRegistered() {
  return !!getLocal('webauthn_id', null);
}

function randomChallenge() {
  return crypto.getRandomValues(new Uint8Array(32));
}

export async function registerBiometric() {
  if (!isWebAuthnSupported()) throw new Error('This browser does not support biometric unlock (WebAuthn).');

  const userId = crypto.getRandomValues(new Uint8Array(16));
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge: randomChallenge(),
      rp: { name: 'Money follow' },
      user: { id: userId, name: 'student@moneyfollow.app', displayName: 'Money follow User' },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 }, // ES256
        { type: 'public-key', alg: -257 }, // RS256
      ],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
      timeout: 60000,
      attestation: 'none',
    },
  });

  if (!credential) throw new Error('Biometric registration was cancelled.');

  const idB64 = btoa(String.fromCharCode(...new Uint8Array(credential.rawId)));
  setLocal('webauthn_id', idB64);
  return true;
}

export async function verifyBiometric() {
  if (!isWebAuthnSupported()) throw new Error('This browser does not support biometric unlock (WebAuthn).');
  const idB64 = getLocal('webauthn_id', null);
  if (!idB64) throw new Error('No biometric credential registered on this device yet.');

  const rawId = Uint8Array.from(atob(idB64), (c) => c.charCodeAt(0));

  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: randomChallenge(),
      allowCredentials: [{ id: rawId, type: 'public-key' }],
      userVerification: 'required',
      timeout: 60000,
    },
  });

  return !!assertion;
}

/* ---------------- Session unlock state ---------------- */

function isUnlockedThisSession() {
  return sessionStorage.getItem(SESSION_UNLOCK_KEY) === '1';
}

function markUnlockedThisSession() {
  sessionStorage.setItem(SESSION_UNLOCK_KEY, '1');
}

/* ---------------- Lock screen UI ---------------- */

let pinBuffer = '';

function buildOverlay() {
  const overlay = document.createElement('div');
  overlay.id = 'mf-lock-overlay';
  overlay.className = 'lock-overlay';
  overlay.innerHTML = `
    <div class="lock-panel">
      <div class="w-16 h-16 rounded-3xl bg-crimson/10 flex items-center justify-center text-3xl mb-4">🔒</div>
      <h2 class="text-[22px] font-black mb-1">Enter PIN</h2>
      <p class="text-[13px] font-bold text-sage mb-5">Unlock Money follow to continue</p>

      <div id="lock-dots" class="flex gap-3 mb-6">
        <span class="lock-dot"></span><span class="lock-dot"></span><span class="lock-dot"></span><span class="lock-dot"></span>
      </div>

      <p id="lock-error" class="hidden text-[12px] font-bold text-crimson mb-3">Incorrect PIN. Try again.</p>

      <div class="numpad-grid mb-4">
        <button data-num="1" class="numpad-btn">1</button>
        <button data-num="2" class="numpad-btn">2</button>
        <button data-num="3" class="numpad-btn">3</button>
        <button data-num="4" class="numpad-btn">4</button>
        <button data-num="5" class="numpad-btn">5</button>
        <button data-num="6" class="numpad-btn">6</button>
        <button data-num="7" class="numpad-btn">7</button>
        <button data-num="8" class="numpad-btn">8</button>
        <button data-num="9" class="numpad-btn">9</button>
        <button id="lock-biometric-btn" class="numpad-btn text-xl">🫆</button>
        <button data-num="0" class="numpad-btn">0</button>
        <button id="lock-backspace-btn" class="numpad-btn text-xl">⌫</button>
      </div>
    </div>
  `;
  return overlay;
}

function updateDots() {
  const dots = document.querySelectorAll('#lock-dots .lock-dot');
  dots.forEach((d, i) => d.classList.toggle('filled', i < pinBuffer.length));
}

async function tryUnlockWithBuffer(overlay, onUnlock) {
  const ok = await verifyPin(pinBuffer);
  if (ok) {
    markUnlockedThisSession();
    overlay.remove();
    onUnlock();
  } else {
    document.getElementById('lock-error').classList.remove('hidden');
    pinBuffer = '';
    updateDots();
    overlay.querySelector('.lock-panel').classList.add('lock-shake');
    setTimeout(() => overlay.querySelector('.lock-panel').classList.remove('lock-shake'), 400);
  }
}

function wireOverlay(overlay, onUnlock) {
  overlay.querySelectorAll('[data-num]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (pinBuffer.length >= 4) return;
      pinBuffer += btn.dataset.num;
      updateDots();
      if (pinBuffer.length === 4) {
        await tryUnlockWithBuffer(overlay, onUnlock);
      }
    });
  });

  document.getElementById('lock-backspace-btn').addEventListener('click', () => {
    pinBuffer = pinBuffer.slice(0, -1);
    document.getElementById('lock-error').classList.add('hidden');
    updateDots();
  });

  const bioBtn = document.getElementById('lock-biometric-btn');
  if (hasBiometricRegistered()) {
    bioBtn.addEventListener('click', async () => {
      try {
        const ok = await verifyBiometric();
        if (ok) {
          markUnlockedThisSession();
          overlay.remove();
          onUnlock();
        }
      } catch (err) {
        document.getElementById('lock-error').textContent = err.message || 'Biometric unlock failed.';
        document.getElementById('lock-error').classList.remove('hidden');
      }
    });
  } else {
    bioBtn.style.opacity = '0.3';
    bioBtn.disabled = true;
  }
}

// Call this once per page (from nav.js). If a PIN is set and this tab
// session hasn't unlocked yet, injects a blocking lock screen.
export function initAppLock() {
  if (!hasPinSet()) return;
  if (isUnlockedThisSession()) return;

  pinBuffer = '';
  const overlay = buildOverlay();
  document.body.appendChild(overlay);
  wireOverlay(overlay, () => {
    /* no-op: page underneath is already rendered/rendering */
  });

  // Auto-prompt biometric immediately if available, so the user usually
  // doesn't need to type at all.
  if (hasBiometricRegistered()) {
    verifyBiometric()
      .then((ok) => {
        if (ok) {
          markUnlockedThisSession();
          overlay.remove();
        }
      })
      .catch(() => {
        /* fall back to PIN entry silently */
      });
  }
}
