/* ============================================================
   icons.js — Shared line-icon SVG library
   Replaces emoji across the whole app with a single consistent
   icon language (same stroke weight/style as the bottom nav).
   Every icon is `currentColor` so it inherits text color from
   its container — set color via a class or inline style.
   ============================================================ */

const S = 2.1; // stroke width used across the set

function svg(size, inner, viewBox = '0 0 24 24') {
  return `<svg width="${size}" height="${size}" viewBox="${viewBox}" fill="none" stroke="currentColor" stroke-width="${S}" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}

const PATHS = {
  // ---- Core UI ----
  settings: `<circle cx="12" cy="12" r="3.2"/><path d="M19.4 13.5a1.7 1.7 0 0 0 .34 1.87l.06.06a2.06 2.06 0 1 1-2.92 2.92l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V19.6a2.06 2.06 0 1 1-4.12 0v-.09a1.7 1.7 0 0 0-1.11-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2.06 2.06 0 1 1-2.92-2.92l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03H4.4a2.06 2.06 0 1 1 0-4.12h.09A1.7 1.7 0 0 0 6.05 6.9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2.06 2.06 0 1 1 2.92-2.92l.06.06a1.7 1.7 0 0 0 1.87.34H10.6A1.7 1.7 0 0 0 11.63 1H11.7a2.06 2.06 0 1 1 4.12 0v.09a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2.06 2.06 0 1 1 2.92 2.92l-.06.06a1.7 1.7 0 0 0-.34 1.87v.06a1.7 1.7 0 0 0 1.56 1.03h.09a2.06 2.06 0 1 1 0 4.12h-.09a1.7 1.7 0 0 0-1.56 1.03Z"/>`,
  eye: `<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>`,
  eyeOff: `<path d="M3 3l18 18"/><path d="M10.6 5.2A9.4 9.4 0 0 1 12 5c6.4 0 10 7 10 7a16.8 16.8 0 0 1-3.06 4.06M6.5 6.5C3.7 8.3 2 12 2 12s3.6 7 10 7a9.7 9.7 0 0 0 4.15-.9"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>`,
  close: `<path d="M6 6l12 12M18 6 6 18"/>`,
  check: `<path d="M4 12.5 9.5 18 20 6"/>`,
  checkCircle: `<circle cx="12" cy="12" r="9"/><path d="m8.3 12.3 2.6 2.6 5-5.6"/>`,
  alertTriangle: `<path d="M12 3.5 22 20H2L12 3.5Z"/><path d="M12 10v4.2"/><circle cx="12" cy="17.3" r="0.15" fill="currentColor" stroke="none"/><circle cx="12" cy="17.3" r="1" fill="currentColor" stroke="none"/>`,
  info: `<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5"/><circle cx="12" cy="7.8" r="1" fill="currentColor" stroke="none"/>`,
  sparkle: `<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.6 2.6M15.4 15.4 18 18M18 6l-2.6 2.6M8.6 15.4 6 18"/>`,
  brain: `<path d="M9.5 4.5a2.7 2.7 0 0 1 2.5 1.7A2.7 2.7 0 1 1 9.3 10a3 3 0 0 0-1.8 2.8 3 3 0 0 0 1.5 2.6 2.8 2.8 0 1 0 5-1.8V6.6a2.7 2.7 0 1 1 3.2 3.9A3 3 0 0 1 19 13.3v.2a3 3 0 0 1-1.7 5.4 2.8 2.8 0 0 1-5.1 1.4 2.8 2.8 0 0 1-5-1.7 3 3 0 0 1-1.7-5.2 3 3 0 0 1 1.2-5.6A2.7 2.7 0 0 1 9.5 4.5Z"/>`,
  fire: `<path d="M12 2.5s5 4 5 9a5 5 0 0 1-10 0c0-1 .3-1.8.8-2.7.4.9 1 1.4 1.7 1.4-.3-2 .4-4 2.5-5.7-.3 1.4.2 2.3 1 3 .6.5 1 1.3 1 2.3a2.5 2.5 0 0 1-5 0"/>`,
  trophy: `<path d="M7 4h10v5a5 5 0 0 1-10 0V4Z"/><path d="M7 5H4a3 3 0 0 0 3 4M17 5h3a3 3 0 0 1-3 4"/><path d="M12 14v3M9 21h6M9.5 21c0-1.8.7-2.8 2.5-3 1.8.2 2.5 1.2 2.5 3"/>`,
  target: `<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/>`,
  shield: `<path d="M12 3 4.5 6v6c0 4.8 3.2 7.9 7.5 9 4.3-1.1 7.5-4.2 7.5-9V6L12 3Z"/><path d="m9 12 2.2 2.2L15.5 9.5"/>`,
  gift: `<rect x="3.5" y="9" width="17" height="4" rx="1"/><rect x="4.5" y="13" width="15" height="8" rx="1"/><path d="M12 9v12"/><path d="M12 9C10.5 5.5 6 5.5 6 8c0 1.2 1.4 1 6 1ZM12 9c1.5-3.5 6-3.5 6-1 0 1.2-1.4 1-6 1Z"/>`,
  handshake: `<path d="m2 12 4-3.5 3 2 4-3 3 2.2 4-2.7 2 2.5-6 5-2.2-1.7-3.6 2.7L7 13.5Z"/><path d="m6.5 8.5 4.2 5.2M17 9.5l-4 5"/>`,
  pin: `<path d="M12 22s7-7.4 7-12.5a7 7 0 1 0-14 0C5 14.6 12 22 12 22Z"/><circle cx="12" cy="9.5" r="2.5"/>`,
  download: `<path d="M12 3v13"/><path d="m6.5 11 5.5 5.5L17.5 11"/><path d="M4 21h16"/>`,
  upload: `<path d="M12 21V8"/><path d="m6.5 12.5 5.5-5.5 5.5 5.5"/><path d="M4 21h16"/>`,
  save: `<path d="M5 4h11l4 4v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z"/><path d="M8 4v5h7V4M8 21v-7h8v7"/>`,
  file: `<path d="M7 3h7l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"/><path d="M14 3v4h4"/><path d="M9 13h6M9 16.5h6"/>`,
  folder: `<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H10l2 2.2h7.5A1.5 1.5 0 0 1 21 8.7v9.8A1.5 1.5 0 0 1 19.5 20h-15A1.5 1.5 0 0 1 3 18.5v-12Z"/>`,
  repeat: `<path d="M17 2.5 20.5 6 17 9.5"/><path d="M20.5 6H8a5 5 0 0 0-5 5v1"/><path d="M7 21.5 3.5 18 7 14.5"/><path d="M3.5 18H16a5 5 0 0 0 5-5v-1"/>`,
  chat: `<path d="M4 4.5h16a1 1 0 0 1 1 1V16a1 1 0 0 1-1 1H9l-4.5 4V17H4a1 1 0 0 1-1-1V5.5a1 1 0 0 1 1-1Z"/><path d="M7.5 9h9M7.5 12.5h6"/>`,
  search: `<circle cx="10.5" cy="10.5" r="6.5"/><path d="m20 20-4.6-4.6"/>`,
  trash: `<path d="M4.5 7h15"/><path d="M9.5 7V4.8a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V7"/><path d="M6.5 7 7.3 20a1 1 0 0 0 1 .9h7.4a1 1 0 0 0 1-.9L17.5 7"/><path d="M10.3 11v6.5M13.7 11v6.5"/>`,
  edit: `<path d="M4 20h4l10.6-10.6a2 2 0 0 0 0-2.8l-1.2-1.2a2 2 0 0 0-2.8 0L4 16v4Z"/><path d="m13.5 6.5 4 4"/>`,
  plus: `<path d="M12 5v14M5 12h14"/>`,
  minus: `<path d="M5 12h14"/>`,
  arrowUp: `<path d="M12 19V5M6 10l6-6 6 6"/>`,
  arrowDown: `<path d="M12 5v14M6 14l6 6 6-6"/>`,
  swap: `<path d="M7 5v13.5M7 5 3.5 8.5M7 5l3.5 3.5"/><path d="M17 19V5.5M17 19l3.5-3.5M17 19l-3.5-3.5"/>`,
  camera: `<path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h1.7l1-1.6A1.5 1.5 0 0 1 9.5 4.6h5a1.5 1.5 0 0 1 1.3.8l1 1.6h1.7A1.5 1.5 0 0 1 20 8.5v9A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5v-9Z"/><circle cx="12" cy="13" r="3.4"/>`,
  clipboard: `<rect x="6" y="4.5" width="12" height="16" rx="1.5"/><rect x="9" y="2.5" width="6" height="3.5" rx="1"/><path d="M9 11.5h6M9 15h6"/>`,
  printer: `<path d="M6.5 8.5V4a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v4.5"/><rect x="3.5" y="8.5" width="17" height="7.5" rx="1.5"/><rect x="6.5" y="13.5" width="11" height="7" rx="1"/><circle cx="17" cy="11.2" r="0.8" fill="currentColor" stroke="none"/>`,
  flask: `<path d="M9.5 3h5M10 3v5.5L4.7 18a1.6 1.6 0 0 0 1.4 2.4h11.8a1.6 1.6 0 0 0 1.4-2.4L14 8.5V3"/><path d="M7.5 14.5h9"/>`,
  home2: `<path d="M4 11.5 12 5l8 6.5"/><path d="M6 10v9a1 1 0 0 0 1 1h3.5v-5a1.5 1.5 0 0 1 1.5-1.5 1.5 1.5 0 0 1 1.5 1.5v5H17a1 1 0 0 0 1-1v-9"/>`,
  pill: `<rect x="3.5" y="9" width="17" height="7" rx="3.5" transform="rotate(-30 12 12.5)"/><path d="m9.2 9.4 4.2 6.2"/>`,
  bag: `<path d="M6.5 8h11l1 12.5H5.5L6.5 8Z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>`,
  cash: `<rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M5.5 9v0M18.5 15v0"/>`,
  card: `<rect x="2.5" y="5.5" width="19" height="13" rx="2.2"/><path d="M2.5 9.5h19"/><path d="M6 14.5h4"/>`,
  cap: `<path d="M12 4 2 9l10 5 10-5-10-5Z"/><path d="M6 11.5V17c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5v-5.5"/><path d="M22 9v6"/>`,
  bus: `<rect x="4" y="4.5" width="16" height="12" rx="2.5"/><path d="M4 11h16"/><circle cx="8" cy="19" r="1.6"/><circle cx="16" cy="19" r="1.6"/><path d="M7 8h3M14 8h3"/>`,
  book: `<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5v-13Z"/><path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5v-13Z"/>`,
  gamepad: `<rect x="2.5" y="7.5" width="19" height="10" rx="5"/><path d="M7.5 10.5v4M5.5 12.5h4"/><circle cx="15.5" cy="10.8" r="0.9" fill="currentColor" stroke="none"/><circle cx="18" cy="13.3" r="0.9" fill="currentColor" stroke="none"/>`,
  receipt: `<path d="M6 3h12v18l-2.5-1.6L13 21l-2-1.6L9 21l-2.5-1.6L4.5 21V3H6Z"/><path d="M8 8h8M8 11.5h8M8 15h5"/>`,
  wifiOff: `<path d="M3 3l18 18"/><path d="M8.5 16.5a5 5 0 0 1 6 0M5.5 12.8a10 10 0 0 1 3-1.9M18.5 12.8a10 10 0 0 0-3.6-2.3M2 8.8a15 15 0 0 1 4.8-2.9M22 8.8a15 15 0 0 0-7.3-3.6"/><circle cx="12" cy="19.3" r="1" fill="currentColor" stroke="none"/>`,
  wifi: `<path d="M2 8.8a15 15 0 0 1 20 0"/><path d="M5.5 12.8a10 10 0 0 1 13 0"/><path d="M8.8 16.7a5 5 0 0 1 6.4 0"/><circle cx="12" cy="19.3" r="1" fill="currentColor" stroke="none"/>`,
  cloudOff: `<path d="M3 3l18 18"/><path d="M8 8.4A4.5 4.5 0 0 0 7 17h9.5a4 4 0 0 0 1.4-.3"/><path d="M18.9 14.6A4 4 0 0 0 16 8h-.6a5.5 5.5 0 0 0-9-2.2"/>`,
  person: `<circle cx="12" cy="8" r="3.6"/><path d="M4.5 20c0-4 3.4-6.5 7.5-6.5s7.5 2.5 7.5 6.5"/>`,
  people: `<circle cx="9" cy="8" r="3.2"/><path d="M2.8 19.5c0-3.4 2.8-5.7 6.2-5.7s6.2 2.3 6.2 5.7"/><path d="M15.5 5a3.2 3.2 0 0 1 0 6.3"/><path d="M17 13.9c2.6.5 4.2 2.5 4.2 5.6"/>`,
  personPlus: `<circle cx="10" cy="8" r="3.6"/><path d="M2.5 20c0-4 3.4-6.5 7.5-6.5 1.3 0 2.5.25 3.6.75"/><path d="M18 8v6M15 11h6"/>`,
  palette: `<circle cx="12" cy="12" r="9"/><circle cx="8.2" cy="10.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="12" cy="8" r="1.1" fill="currentColor" stroke="none"/><circle cx="15.8" cy="10.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="9.5" cy="15" r="1.1" fill="currentColor" stroke="none"/><path d="M12 21a9 9 0 0 1 0-18c1 3 3 2.5 3 5.5 0 2 3 1 5 3a9 9 0 0 1-8 9.5Z"/>`,
  siren: `<path d="M12 2.5a5.5 5.5 0 0 1 5.5 5.5v6h-11v-6A5.5 5.5 0 0 1 12 2.5Z"/><path d="M4.5 14h15M6 14v3M18 14v3"/><path d="M12 2.5V1M6.5 5 5 3.5M17.5 5 19 3.5"/><path d="M4.5 20.5h15"/>`,
  send: `<path d="m3 11 18-8-8 18-2.5-7.5L3 11Z"/>`,
  arrowRight: `<path d="M4 12h16M14 6l6 6-6 6"/>`,
  moon: `<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z"/>`,
  sun: `<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.3M12 19.2v2.3M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M2.5 12h2.3M19.2 12h2.3M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6"/>`,
  chevronRight: `<path d="m9 5.5 7 6.5-7 6.5"/>`,
  barChart: `<path d="M4 20V10M10 20V4M16 20v-7M4 20h16"/>`,
  refresh: `<path d="M4 12a8 8 0 0 1 14-5.2M20 12a8 8 0 0 1-14 5.2"/><path d="M18 3v4.5h-4.5M6 21v-4.5h4.5"/>`,
  lock: `<rect x="5" y="11" width="14" height="9" rx="2.5"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/>`,
  fingerprint: `<path d="M12 3.5c-4.7 0-8.5 3.8-8.5 8.5 0 2.3.4 4 1 5.5"/><path d="M12 3.5c4.7 0 8.5 3.8 8.5 8.5 0 1.4-.15 2.6-.5 3.7"/><path d="M7.2 20c1-1.7 1.5-3.8 1.5-6a3.3 3.3 0 0 1 6.6 0c0 3-1 5-2.6 7"/><path d="M9.5 20.5c1.4-2 2.2-4.3 2.2-6.5M4.5 15.5c.4-1.3.6-2.3.6-3.5a6.9 6.9 0 0 1 13.8 0c0 1.8-.2 3-.7 4.4"/>`,
  backspace: `<path d="M9 4h10a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H9l-6.5-8Z"/><path d="m11.5 9.5 5 5m0-5-5 5"/>`,
};

/** Get raw inner-path markup for a name (used when composing custom svgs). */
export function iconPath(name) {
  return PATHS[name] || PATHS.sparkle;
}

/** Render a ready-to-use <svg> string for the given icon name. */
export function icon(name, size = 22) {
  return svg(size, PATHS[name] || PATHS.info);
}

/* ---------- Category -> icon-name map (replaces old emoji map) ---------- */
export const CATEGORY_ICON_NAMES = {
  Mess: 'bag',
  'Outside Food': 'receipt',
  Travel: 'bus',
  Books: 'book',
  Fun: 'gamepad',
  Bills: 'receipt',
  'Semester Fees': 'cap',
  Photostat: 'printer',
  'Lab Material': 'flask',
  Rent: 'home2',
  Health: 'pill',
  Other: 'bag',
  'Pocket Money': 'cash',
  'Wallet Transfer': 'repeat',
};

export function categoryIconSvg(category, size = 20) {
  return icon(CATEGORY_ICON_NAMES[category] || 'card', size);
}
