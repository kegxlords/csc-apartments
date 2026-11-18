/* ============================================================
   PINNACLE APARTMENTS — first-run notice on the login page
   Shows only when the store holds zero accounts.
   ============================================================ */
(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', () => {
    const el = document.getElementById('firstRun');
    if (!el) return;
    if (window.Store && Store.live) return;
    try {
      const raw = localStorage.getItem('pinnacle.v2');
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d && Array.isArray(d.users) && d.users.length === 0) {
        el.className = 'alert alert--info show';
        el.innerHTML = UI.icon('info') +
          '<span>No resident accounts exist here yet. <a href="register.html" style="font-weight:800">Create the first account</a> to open the portal — it can be promoted to administrator afterwards.</span>';
      }
    } catch (e) { /* store unreadable — stay silent */ }
  });
})();
