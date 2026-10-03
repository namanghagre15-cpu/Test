/* ============================================================
   dialog.js — App-styled confirm/alert modals.
   Replaces window.confirm()/window.alert(), which render as an
   unbranded browser chrome popup (e.g. "yoursite.github.io
   says...") that looks jarring next to the rest of the app.
   Both return a Promise so call sites just add `await`.
   ============================================================ */

function buildOverlay() {
  const overlay = document.createElement('div');
  overlay.className = 'mf-dialog-overlay';
  return overlay;
}

/**
 * @param {string} message
 * @param {{title?:string, okLabel?:string}} [opts]
 * @returns {Promise<void>}
 */
export function alertDialog(message, opts = {}) {
  return new Promise((resolve) => {
    const overlay = buildOverlay();
    overlay.innerHTML = `
      <div class="mf-dialog-card">
        ${opts.title ? `<p class="mf-dialog-title">${opts.title}</p>` : ''}
        <p class="mf-dialog-msg">${message}</p>
        <div class="mf-dialog-actions">
          <button class="mf-dialog-btn mf-dialog-btn-solid" data-act="ok">${opts.okLabel || 'OK'}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('[data-act="ok"]').focus();
    overlay.querySelector('[data-act="ok"]').addEventListener('click', () => {
      overlay.remove();
      resolve();
    });
  });
}

/**
 * @param {string} message
 * @param {{title?:string, okLabel?:string, cancelLabel?:string, danger?:boolean}} [opts]
 * @returns {Promise<boolean>}
 */
export function confirmDialog(message, opts = {}) {
  return new Promise((resolve) => {
    const overlay = buildOverlay();
    overlay.innerHTML = `
      <div class="mf-dialog-card">
        ${opts.title ? `<p class="mf-dialog-title">${opts.title}</p>` : ''}
        <p class="mf-dialog-msg">${message}</p>
        <div class="mf-dialog-actions">
          <button class="mf-dialog-btn mf-dialog-btn-ghost" data-act="cancel">${opts.cancelLabel || 'Cancel'}</button>
          <button class="mf-dialog-btn ${opts.danger ? 'mf-dialog-btn-danger' : 'mf-dialog-btn-solid'}" data-act="ok">${opts.okLabel || 'OK'}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    function finish(result) {
      overlay.remove();
      resolve(result);
    }
    overlay.querySelector('[data-act="cancel"]').addEventListener('click', () => finish(false));
    overlay.querySelector('[data-act="ok"]').addEventListener('click', () => finish(true));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) finish(false);
    });
  });
}

/**
 * @param {string} message
 * @param {{title?:string, okLabel?:string, cancelLabel?:string, placeholder?:string, inputType?:string}} [opts]
 * @returns {Promise<string|null>} the typed value, or null if cancelled (same contract as window.prompt)
 */
export function promptDialog(message, opts = {}) {
  return new Promise((resolve) => {
    const overlay = buildOverlay();
    overlay.innerHTML = `
      <div class="mf-dialog-card">
        ${opts.title ? `<p class="mf-dialog-title">${opts.title}</p>` : ''}
        <p class="mf-dialog-msg">${message}</p>
        <input class="mf-dialog-input" type="${opts.inputType || 'text'}" placeholder="${opts.placeholder || ''}" />
        <div class="mf-dialog-actions">
          <button class="mf-dialog-btn mf-dialog-btn-ghost" data-act="cancel">${opts.cancelLabel || 'Cancel'}</button>
          <button class="mf-dialog-btn mf-dialog-btn-solid" data-act="ok">${opts.okLabel || 'OK'}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const input = overlay.querySelector('.mf-dialog-input');
    input.focus();

    function finish(result) {
      overlay.remove();
      resolve(result);
    }
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') finish(input.value);
    });
    overlay.querySelector('[data-act="cancel"]').addEventListener('click', () => finish(null));
    overlay.querySelector('[data-act="ok"]').addEventListener('click', () => finish(input.value));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) finish(null);
    });
  });
}
