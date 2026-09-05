/* ============================================================
   boot-guard.js — NOT a module, loaded as a plain <script> in
   <head> on every page, before anything else. Its only job: if
   the real app (Dexie + the page's own module script) fails to
   start — e.g. a fully offline cold start where a required CDN
   library couldn't load — show a clear, friendly banner instead
   of leaving the screen silently blank. Your data in this case
   is completely safe; it's still sitting in IndexedDB on this
   device untouched. This banner just tells you what to do next.
   ============================================================ */
(function () {
  var shown = false;

  function showBanner() {
    if (shown || document.getElementById('mf-boot-error')) return;
    shown = true;
    var el = document.createElement('div');
    el.id = 'mf-boot-error';
    el.setAttribute(
      'style',
      'position:fixed;inset:0;z-index:9999;background:#171e19;color:#fff;' +
        'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
        'text-align:center;padding:2rem;font-family:sans-serif;'
    );
    el.innerHTML =
      '<div style="width:56px;height:56px;border-radius:20px;background:rgba(202,0,19,0.15);' +
      'display:flex;align-items:center;justify-content:center;margin-bottom:16px;">' +
      '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#ca0013" stroke-width="2.1" ' +
      'stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18"/>' +
      '<path d="M8.5 16.5a5 5 0 0 1 6 0M5.5 12.8a10 10 0 0 1 3-1.9M18.5 12.8a10 10 0 0 0-3.6-2.3M2 8.8a15 15 0 0 1 4.8-2.9M22 8.8a15 15 0 0 0-7.3-3.6"/>' +
      '<circle cx="12" cy="19.3" r="1" fill="#ca0013" stroke="none"/></svg></div>' +
      '<p style="font-weight:900;font-size:18px;margin:0 0 8px;">Couldn\'t load Money follow</p>' +
      '<p style="font-weight:600;font-size:13px;color:#b7c6c2;max-width:320px;margin:0 0 20px;line-height:1.5;">' +
      'This usually happens on the very first open after being fully offline. ' +
      'Your data is safe on this device — nothing is deleted. Reconnect to the internet, then reload.</p>' +
      '<button id="mf-boot-retry" style="background:#ca0013;color:#fff;border:none;padding:14px 28px;' +
      'border-radius:16px;font-weight:900;font-size:14px;">Reload</button>';
    document.body.appendChild(el);
    document.getElementById('mf-boot-retry').addEventListener('click', function () {
      window.location.reload();
    });
  }

  // Case 1: a script/module failed to load or threw during startup
  // (e.g. Dexie never arrived, so `new Dexie(...)` in db.js throws).
  window.addEventListener('error', function (e) {
    if (!window.__mfAppRendered) showBanner();
  });
  window.addEventListener('unhandledrejection', function () {
    if (!window.__mfAppRendered) showBanner();
  });

  // Case 2: nothing threw an observable error, but the app also never
  // finished its first render (e.g. a silently-rejected dynamic import).
  // Every page script sets window.__mfAppRendered = true once its first
  // render completes — if that hasn't happened after a few seconds,
  // something is stuck, so show the same helpful banner.
  setTimeout(function () {
    if (!window.__mfAppRendered) showBanner();
  }, 4000);
})();
