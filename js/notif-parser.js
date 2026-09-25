/* ============================================================
   notif-parser.js — Parses a bank/UPI notification or SMS text
   that the user explicitly shared into Money follow (via the
   Web Share Target), to pre-fill an expense/income entry.

   This file is intentionally a pure, dependency-free module so
   it's easy to audit: it never calls fetch(), never writes to
   storage, and never logs the raw text anywhere. It only reads
   its input string and returns a plain object.

   SAFETY: any text that looks like it contains an OTP or a
   verification/security code is hard-blocked before any other
   processing happens — parseSharedText() returns
   { blocked: true } immediately and does not attempt to read
   an amount or merchant out of it.
   ============================================================ */

const SENSITIVE_PATTERNS = [
  /\botp\b/i,
  /one[\s-]?time[\s-]?password/i,
  /verification code/i,
  /security code/i,
  /do not share/i,
  /don'?t share (this|your)/i,
  /verify your/i,
  /confirm your (identity|account)/i,
  /\bpin\b.{0,15}(is|:)/i,
];

const DEBIT_WORDS = /\b(debited|debit|spent|paid|payment of|purchase of|withdrawn|sent)\b/i;
const CREDIT_WORDS = /\b(credited|credit|received|deposited|refund(ed)?)\b/i;

// Matches ₹450, Rs. 450, Rs 450.50, INR 450, 450.00 INR
const AMOUNT_RE = /(?:₹|rs\.?|inr)\s?([\d,]+(?:\.\d{1,2})?)|([\d,]+(?:\.\d{1,2})?)\s?(?:inr|rs\.?)/i;

const MERCHANT_RE = /\b(?:to|at|from|towards)\s+([A-Za-z0-9@._\-\s]{2,28}?)(?:[.,]|\son\s|\svia\s|\susing\s|$)/i;

export function isSensitiveText(text) {
  return SENSITIVE_PATTERNS.some((re) => re.test(text));
}

/**
 * @param {string} rawText - shared title + text + url, already
 *   concatenated by the caller. Never persisted by this function.
 * @returns {{blocked:true} | {blocked:false, amount:number|null,
 *   direction:'expense'|'income'|null, merchant:string|null}}
 */
export function parseSharedText(rawText) {
  const text = (rawText || '').trim();

  if (!text || isSensitiveText(text)) {
    return { blocked: true };
  }

  const amountMatch = text.match(AMOUNT_RE);
  const amount = amountMatch ? parseFloat((amountMatch[1] || amountMatch[2]).replace(/,/g, '')) : null;

  let direction = null;
  if (DEBIT_WORDS.test(text)) direction = 'expense';
  else if (CREDIT_WORDS.test(text)) direction = 'income';

  const merchantMatch = text.match(MERCHANT_RE);
  const merchant = merchantMatch ? merchantMatch[1].trim() : null;

  return { blocked: false, amount, direction, merchant };
}
