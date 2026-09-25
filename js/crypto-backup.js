/* ============================================================
   crypto-backup.js — Password-protected backup encryption.
   Uses the browser's native Web Crypto API only (no external
   crypto library): PBKDF2 (200,000 iterations, SHA-256) derives
   an AES-256-GCM key from the user's password + a random salt,
   which then encrypts the backup JSON. Nothing here ever leaves
   the device — nothing is sent to any server.
   ============================================================ */

const PBKDF2_ITERATIONS = 200000;

function toBase64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
function fromBase64(b64) {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

async function deriveKey(password, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a plain JSON string with a password. Returns an object that's
 * safe to JSON.stringify() straight into the exported backup file.
 */
export async function encryptBackupPayload(jsonString, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(jsonString)
  );
  return {
    encrypted: true,
    kdf: 'PBKDF2-SHA256',
    iterations: PBKDF2_ITERATIONS,
    salt: toBase64(salt),
    iv: toBase64(iv),
    ciphertext: toBase64(ciphertext),
  };
}

/**
 * Decrypts a payload produced by encryptBackupPayload(). Throws a clear
 * error (wrong password / corrupted file) if decryption fails — AES-GCM's
 * built-in authentication tag makes a wrong password fail loudly rather
 * than silently returning garbage.
 */
export async function decryptBackupPayload(payload, password) {
  try {
    const salt = fromBase64(payload.salt);
    const iv = fromBase64(payload.iv);
    const key = await deriveKey(password, salt);
    const plainBuf = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      fromBase64(payload.ciphertext)
    );
    return new TextDecoder().decode(plainBuf);
  } catch (e) {
    throw new Error('Incorrect password, or this backup file is corrupted.');
  }
}
