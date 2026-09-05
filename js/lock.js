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
import { icon } from './icons.js';

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
  removeLocal('pin_fail_count');
  removeLocal('pin_lockout_until');
}

/* ---------------- Auto-lock timeout setting ---------------- */
// How long the app can sit in the background before it re-locks itself.
// Stored in minutes; 0 means "lock immediately on background".
export function getAutoLockMinutes() {
  return getLocal('auto_lock_minutes', 1);
}
export function setAutoLockMinutes(minutes) {
  setLocal('auto_lock_minutes', minutes);
}

/* ---------------- Failed-attempt lockout ---------------- */
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 30000;

function getFailState() {
  return {
    count: getLocal('pin_fail_count', 0),
    lockoutUntil: getLocal('pin_lockout_until', 0),
  };
}

function recordFailedAttempt() {
  const { count } = getFailState();
  const next = count + 1;
  if (next >= MAX_ATTEMPTS) {
    setLocal('pin_fail_count', 0);
    setLocal('pin_lockout_until', Date.now() + LOCKOUT_MS);
    return { locked: true, remainingMs: LOCKOUT_MS };
  }
  setLocal('pin_fail_count', next);
  return { locked: false, attemptsLeft: MAX_ATTEMPTS - next };
}

function clearFailState() {
  setLocal('pin_fail_count', 0);
  setLocal('pin_lockout_until', 0);
}

function isCurrentlyLockedOut() {
  const { lockoutUntil } = getFailState();
  return lockoutUntil && Date.now() < lockoutUntil;
}

/* ---------------- Background/inactivity tracking ---------------- */
// Records "last time the app was known to be active/visible", so that when
// the app is reopened (from Android's app switcher, a screen lock, or a
// cold start) we can tell whether it's been away longer than the user's
// chosen auto-lock timeout — even though sessionStorage itself might have
// survived a simple background/foreground cycle.
function markActiveNow() {
  setLocal('last_active_at', Date.now());
}

function shouldForceRelock() {
  const minutes = getAutoLockMinutes();
  if (minutes < 0) return false; // "Never" — auto-lock disabled
  const lastActive = getLocal('last_active_at', 0);
  const elapsedMs = Date.now() - lastActive;
  return elapsedMs >= minutes * 60000;
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
      <div class="w-16 h-16 rounded-3xl bg-crimson/10 flex items-center justify-center text-crimson mb-4">${icon('lock', 28)}</div>
      <h2 class="text-[22px] font-black mb-1">Enter PIN</h2>
      <p class="text-[13px] font-bold text-sage mb-5">Unlock Money follow to continue</p>

      <div id="lock-dots" class="flex gap-3 mb-6">
        <span class="lock-dot"></span><span class="lock-dot"></span><span class="lock-dot"></span><span class="lock-dot"></span>
      </div>

      <p id="lock-error" class="hidden text-[12px] font-bold text-crimson mb-3">Incorrect PIN. Try again.</p>
      <p id="lock-lockout" class="hidden text-[12px] font-bold text-crimson mb-3">Too many attempts. Try again in <span id="lock-lockout-secs">30</span>s.</p>

      <div id="lock-numpad" class="numpad-grid mb-4">
        <button data-num="1" class="numpad-btn">1</button>
        <button data-num="2" class="numpad-btn">2</button>
        <button data-num="3" class="numpad-btn">3</button>
        <button data-num="4" class="numpad-btn">4</button>
        <button data-num="5" class="numpad-btn">5</button>
        <button data-num="6" class="numpad-btn">6</button>
        <button data-num="7" class="numpad-btn">7</button>
        <button data-num="8" class="numpad-btn">8</button>
        <button data-num="9" class="numpad-btn">9</button>
        <button id="lock-biometric-btn" class="numpad-btn">${icon('fingerprint', 22)}</button>
        <button data-num="0" class="numpad-btn">0</button>
        <button id="lock-backspace-btn" class="numpad-btn">${icon('backspace', 20)}</button>
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
    clearFailState();
    markUnlockedThisSession();
    markActiveNow();
    overlay.remove();
    onUnlock();
  } else {
    pinBuffer = '';
    updateDots();
    const result = recordFailedAttempt();
    if (result.locked) {
      applyLockoutUI(overlay, LOCKOUT_MS);
    } else {
      document.getElementById('lock-error').textContent = `Incorrect PIN. ${result.attemptsLeft} attempt${
        result.attemptsLeft === 1 ? '' : 's'
      } left.`;
      document.getElementById('lock-error').classList.remove('hidden');
    }
    overlay.querySelector('.lock-panel').classList.add('lock-shake');
    setTimeout(() => overlay.querySelector('.lock-panel').classList.remove('lock-shake'), 400);
  }
}

let lockoutInterval = null;

function applyLockoutUI(overlay, remainingMs) {
  document.getElementById('lock-error').classList.add('hidden');
  const lockoutEl = document.getElementById('lock-lockout');
  const secsEl = document.getElementById('lock-lockout-secs');
  const numpad = document.getElementById('lock-numpad');
  lockoutEl.classList.remove('hidden');
  numpad.style.opacity = '0.35';
  numpad.style.pointerEvents = 'none';

  clearInterval(lockoutInterval);
  const tick = () => {
    const { lockoutUntil } = getFailState();
    const msLeft = lockoutUntil - Date.now();
    if (msLeft <= 0) {
      clearInterval(lockoutInterval);
      lockoutEl.classList.add('hidden');
      numpad.style.opacity = '';
      numpad.style.pointerEvents = '';
      return;
    }
    secsEl.textContent = Math.ceil(msLeft / 1000);
  };
  tick();
  lockoutInterval = setInterval(tick, 500);
}

function wireOverlay(overlay, onUnlock) {
  overlay.querySelectorAll('[data-num]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (isCurrentlyLockedOut()) return;
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
      if (isCurrentlyLockedOut()) return;
      try {
        const ok = await verifyBiometric();
        if (ok) {
          clearFailState();
          markUnlockedThisSession();
          markActiveNow();
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
// session hasn't unlocked yet — OR the app has been backgrounded/idle
// longer than the user's chosen auto-lock timeout — injects a blocking
// lock screen.
export function initAppLock() {
  if (!hasPinSet()) {
    // No PIN configured — nothing to protect, but still track activity so
    // that setting a PIN later starts from a sane baseline.
    markActiveNow();
    trackVisibility();
    return;
  }

  if (isUnlockedThisSession() && shouldForceRelock()) {
    sessionStorage.removeItem(SESSION_UNLOCK_KEY);
  }

  trackVisibility();

  if (isUnlockedThisSession()) {
    markActiveNow();
    return;
  }

  showLockOverlay();
}

function showLockOverlay() {
  if (document.getElementById('mf-lock-overlay')) return;
  pinBuffer = '';
  const overlay = buildOverlay();
  document.body.appendChild(overlay);
  wireOverlay(overlay, () => {
    /* no-op: page underneath is already rendered/rendering */
  });

  if (isCurrentlyLockedOut()) {
    const { lockoutUntil } = getFailState();
    applyLockoutUI(overlay, lockoutUntil - Date.now());
  }

  // Auto-prompt biometric immediately if available, so the user usually
  // doesn't need to type at all.
  if (hasBiometricRegistered() && !isCurrentlyLockedOut()) {
    verifyBiometric()
      .then((ok) => {
        if (ok) {
          clearFailState();
          markUnlockedThisSession();
          markActiveNow();
          overlay.remove();
        }
      })
      .catch(() => {
        /* fall back to PIN entry silently */
      });
  }
}

let visibilityTracked = false;
function trackVisibility() {
  if (visibilityTracked) return;
  visibilityTracked = true;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      // Going to background — stamp the time so we know how long we were away.
      setLocal('last_active_at_hidden', Date.now());
    } else {
      // Coming back to foreground — if we've been away longer than the
      // auto-lock timeout, force the lock screen right now, even though
      // this tab's own sessionStorage may still say "unlocked".
      if (hasPinSet() && shouldForceRelock()) {
        sessionStorage.removeItem(SESSION_UNLOCK_KEY);
        showLockOverlay();
      } else {
        markActiveNow();
      }
    }
  });
  // Also refresh the activity stamp on real interaction, so a user who's
  // actively using the app right up to backgrounding isn't unfairly
  // re-locked due to a stale timestamp.
  ['click', 'touchstart', 'keydown'].forEach((evt) =>
    document.addEventListener(evt, markActiveNow, { passive: true })
  );
}
