/* Money follow startup guard. It is deliberately conservative: a slow tablet
   or a delayed module must not be mistaken for a broken app. */
(function () {
  var shown = false;
  var startupError = null;

  function showBanner() {
    if (shown || window.__mfAppRendered) return;
    shown = true;
    var el = document.createElement('div');
    el.id = 'mf-boot-error';
    el.setAttribute('style',
      'position:fixed;inset:0;z-index:9999;background:#171e19;color:#fff;' +
      'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
      'text-align:center;padding:2rem;font-family:sans-serif;'
    );
    var detail = startupError
      ? 'Startup error: ' + String(startupError).slice(0, 180)
      : 'The app did not finish loading. Your local data is not deleted.';
    el.innerHTML =
      '<div style="width:56px;height:56px;border-radius:20px;background:rgba(202,0,19,.15);display:flex;align-items:center;justify-content:center;margin-bottom:16px;">' +
      '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#ca0013" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18"/><path d="M8.5 16.5a5 5 0 0 1 6 0M5.5 12.8a10 10 0 0 1 3-1.9M18.5 12.8a10 10 0 0 0-3.6-2.3M2 8.8a15 15 0 0 1 4.8-2.9M22 8.8a15 15 0 0 0-7.3-3.6"/><circle cx="12" cy="19.3" r="1" fill="#ca0013" stroke="none"/></svg></div>' +
      '<p style="font-weight:900;font-size:18px;margin:0 0 8px;">Couldn\'t load Money follow</p>' +
      '<p style="font-weight:600;font-size:13px;color:#b7c6c2;max-width:340px;margin:0 0 8px;line-height:1.5;">' +
      'The app startup did not complete. Your data is safe on this device.</p>' +
      '<p style="font-size:11px;color:#8d9b97;max-width:340px;margin:0 0 20px;line-height:1.45;word-break:break-word;">' +
      detail.replace(/</g, '&lt;') + '</p>' +
      '<button id="mf-boot-retry" style="background:#ca0013;color:#fff;border:none;padding:14px 28px;border-radius:16px;font-weight:900;font-size:14px;">Reload</button>';
    (document.body || document.documentElement).appendChild(el);
    document.getElementById('mf-boot-retry').addEventListener('click', function () { window.location.reload(); });
  }

  window.addEventListener('error', function (e) {
    if (window.__mfAppRendered) return;
    startupError = e && (e.error || e.message || e.filename) || 'Script error';
    // Give the module graph a moment to settle before showing UI.
    setTimeout(showBanner, 1200);
  });

  window.addEventListener('unhandledrejection', function (e) {
    if (window.__mfAppRendered) return;
    startupError = e && e.reason ? (e.reason.stack || e.reason.message || e.reason) : 'Unhandled startup rejection';
    setTimeout(showBanner, 1200);
  });

  // 8 seconds accommodates slower Android tablets while still catching a
  // genuinely stuck module graph.
  setTimeout(function () {
    if (!window.__mfAppRendered) showBanner();
  }, 8000);
})();
