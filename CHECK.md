# Money follow — Feature Build Checklist

This file tracks every feature requested across both spec documents
(`Student_Tracker_Features.md` and `CHATGPT.md`) against what's actually
implemented in this build.

**How "✓" was decided:** each item below was only checked after the
underlying code was written and re-read end-to-end, and every JS file was
syntax-validated with Node before packaging. This is *not* the same as
clicking through the app on a real phone — I have no camera, no installed
UPI apps, and no fingerprint sensor in this sandboxed environment, so three
specific things are code-complete and use the real browser APIs (not fake
timers) but still need **your own on-device test** before you fully trust
them:
- 📷 **QR Scan** — real `getUserMedia` camera + real `jsQR` decoding (no `setTimeout` pretending to scan)
- 💳 **UPI Pay** — builds a real `upi://pay?...` deep link and hands off to your phone's UPI app chooser (a website can never confirm a bank transfer itself — that's *why* the Pending confirmation step exists)
- 🔐 **Biometric unlock** — real `navigator.credentials` WebAuthn calls, gated by whatever authenticator your device actually has

Anything marked ⚠️ **Partial** below is explained honestly, not hidden.

---

## A. Student_Tracker_Features.md (28 features)

### A. Core Architecture & Infrastructure
- [x] 1. 100% Offline-First PWA Engine — service worker caches full app shell; installs from browser "Add to Home Screen"
- [x] 2. Local Database (IndexedDB via Dexie.js) — all financial data stored locally, zero server
- [x] 3. Dual-Wallet System (Cash vs Online) — separate balances, chosen per transaction
- [x] 4. 1-Click JSON Backup & Restore — Settings → Backup & Restore
- [x] 5. Seamless View-Transitions Navigation — `@view-transition` CSS + fade fallback on every page

### B. Smart Entry & Tracking Systems
- [x] 6. Smart QR "Scan-Note-Pay" Router — **real camera scan → real `upi://` deep link**, not simulated
- [x] 7. Pending UPI Recovery System — dashboard modal asks "Did the payment succeed?" for every pending entry
- [x] 8. Numpad-First Manual Entry — custom on-screen calculator numpad replaces the OS keyboard on Add Expense ⚠️ *"3-tap" is approximate for multi-digit amounts — it's tap-per-digit, not literally 3 taps always*
- [x] 9. Fast Micro-Expense "Chillar" Widget — quick-add row on the dashboard (Xerox/Chai/Auto/etc.)
- [x] 10. Time-Based Auto Suggestions — category selector defaults based on current hour
- [x] 11. SMS Clipboard Quick-Detect — real `navigator.clipboard.readText()` + regex amount detection (works when you've actually copied the SMS text — the web platform has no permission to read SMS directly)

### C. Student Budgeting & Controls
- [x] 12. Monthly Pocket Money & Income Manager — Wallet page ⚠️ *Partial: the "1st-of-month auto-prompt" popup was not built; adding income is otherwise fully working*
- [x] 13. Dynamic Daily "Safe-to-Spend" Limit — shown on dashboard, recalculated from days left in month
- [x] 14. Needs vs Wants (Guilt-Free Meter) — tag on every expense + dedicated stats chart
- [x] 15. Mess vs Outside Food Alert System — dedicated categories + configurable weekly limit + warning banner
- [x] 16. College & Exam Specific Tagging — Semester Fees / Photostat / Lab Material categories added

### D. Target Vault (Discipline & Savings)
- [x] 17. Target Savings Wishlist — goals with title/target/deadline ⚠️ *Partial: no auto "save ₹X/day" breakdown text yet — you can see progress %, just not a suggested daily/weekly pace*
- [x] 18. Locked Balance Mode — vault contributions debit the wallet directly, so Available-to-Spend drops immediately
- [x] 19. Emergency Vault PIN & Delay Timer — withdrawal requires your app PIN (if set) + a real, enforced 5-second countdown before Confirm unlocks

### E. Khata (Social Split & Udhaar Management)
- [x] 20. Roommate Expense Splitter — new Khata page ⚠️ *Partial: even-split only for now (no custom uneven shares per person)*
- [x] 21. Lend & Borrow (Udhaar Log) — dual totals ("They owe me" / "I owe them"), mark-settled, delete
- [x] 22. 1-Tap WhatsApp Reminder Generator — real `wa.me` share link with a pre-filled polite message

### F. Privacy, Security & Archiving
- [x] 23. Ghost Mode — eye icon on Dashboard/Wallet/Vault/History masks every amount's digits instantly
- [x] 24. App Lock (PIN / Biometric) — SHA-256-hashed PIN (never stored in plaintext) + real WebAuthn biometric registration/unlock
- [x] 25. Semester-Wise Financial Archive — snapshot + clear transaction log from Settings, wallets/vault untouched
- [x] 26. Parents Expense Summary Export — real PDF (jsPDF) and Excel (SheetJS) export, with a "Smart Export" toggle to exclude Wants

### G. Custom UI/UX Engineering
- [x] 27. Bento Metric Glassmorphism Dashboard — white 80%-opacity + backdrop-blur cards throughout
- [x] 28. High-Impact FAB Cutout — charcoal nav pill, -32px floating red FAB, 4px background-matching cutout border

---

## B. CHATGPT.md (comprehensive v2 list)

### Core money tracking
- [x] Dashboard
- [x] Cash Wallet
- [x] Online Wallet
- [x] Pocket Money / Income
- [x] Expense Entry
- [x] Expense Categories (12, incl. student-specific)
- [x] Need vs Want
- [x] Cash vs Online Tracking
- [x] QR Payment — **now real (camera + jsQR), previously simulated**
- [x] Pending Payment Confirmation
- [x] Cash ↔ Online Transfer — new

### Transaction management
- [x] Transaction History — new dedicated page
- [x] Search — new
- [x] Filters (type/wallet/category/need-want) — new
- [x] Edit Transaction — new, reconciles wallet balances
- [x] Delete Transaction — reconciles wallet balances
- [x] Transaction Details (amount/type/category/wallet/need-want/date/note/pending)

### Budgeting & intelligence
- [x] Monthly Budget — new
- [x] Daily Spending Limit — new
- [x] Low Balance Alert — new (previously not implemented)
- [x] Smart Spending Insights — new, rule-based
- [x] Recurring Expenses — new, auto-posts on due date
- [x] Quick Add ("Chillar") — new
- [x] Payment Method Memory — new (remembers last wallet per category)

### Vault & discipline
- [x] Vault
- [x] Savings Goals
- [x] Vault Locked Money (excluded from Available-to-Spend)
- [x] Savings Challenges (No-Spend Day / 7-Day Streak / Vault Starter) — new
- [x] No-Spend Streak — new, real consecutive-day tracking
- [x] Emergency Fund — new, dedicated open-ended goal
- [x] Financial Health Score — new, composite 0–100 score

### Statistics
- [x] 7D / 30D / 3M / All-Time Statistics — new period tabs
- [x] Category Breakdown
- [x] Need vs Want Analytics
- [x] Cash vs Online Analytics — new
- [x] Income vs Expense Analytics
- [x] Biggest Expense — new
- [x] Average Daily Spending — new
- [x] Charts (Chart.js)

### Data & platform
- [x] Offline-First
- [x] Local Database (transactions, wallets, vault, recurring, ledger, splits, challenges, archives)
- [x] Backup Export
- [x] Backup Import
- [x] PIN Lock
- [x] Dark Mode — new (previously not implemented)
- [x] PWA Installation ⚠️ *Partial: manifest + service worker make it installable; no custom "Install this app" banner UI was built — relies on the browser's native install prompt*
- [x] Service Worker
- [x] Web App Manifest

### UI/UX system
- [x] Mobile-First UI
- [x] Floating Bottom Navigation
- [x] Bento Dashboard
- [x] Student-Oriented Visual Design
- [x] Typography System (Nunito)
- [x] Design Color System (charcoal/crimson/sage/cream, no pure black)
- [x] Rounded UI System (40px / 24px radii)
- [x] Glassmorphism-Lite
- [x] View Transitions
- [x] Hidden Scrollbars
- [x] Add-Expense Category Selector
- [x] Wallet Management Screen
- [x] Statistics Screen
- [x] Vault Screen
- [x] Available-to-Spend
- [x] Wallet Reconciliation (create/edit/delete/income/transfer all keep balances correct)
- [x] Data Persistence
- [x] Financial Discipline (overall design intent)

---

## New pages added this round
- `history.html` — search/filter/edit/delete transaction log
- `khata.html` — lend/borrow ledger + roommate bill splitter
- `settings.html` — security, budget, recurring expenses, backup, parent export, semester archive, danger zone

## Branding
- [x] Renamed app to **Money follow** everywhere (titles, manifest, service worker cache name)
- [x] App icons generated from your uploaded logo (standard + maskable, 192px/512px)
