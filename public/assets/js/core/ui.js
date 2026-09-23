/* ============================================================
   Shared UI helpers + client-side persistence.
   Loaded by every page.
   ============================================================ */
window.UI = {
  initials: function (name) {
    return String(name || '').split(/\s+/).slice(0, 2)
      .map(function (p) { return p.charAt(0); }).join('').toUpperCase();
  },
  qs: function (key, fallback) {
    var v = new URLSearchParams(window.location.search).get(key);
    return v === null ? fallback : v;
  },
  escape: function (s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  },
  toast: function (msg, kind) {
    var wrap = document.querySelector('.toast-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'toast-wrap';
      document.body.appendChild(wrap);
    }
    var el = document.createElement('div');
    el.className = 'toast ' + (kind === 'bad' ? 'bad' : 'ok');
    el.setAttribute('role', 'status');
    el.textContent = msg;
    wrap.appendChild(el);
    setTimeout(function () { el.remove(); }, 2300);
  },
  /* Session persistence for the signed-in player + chapter progress. */
  session: {
    get: function () {
      try { return JSON.parse(sessionStorage.getItem('csm_user') || 'null'); }
      catch (e) { return null; }
    },
    set: function (u) { sessionStorage.setItem('csm_user', JSON.stringify(u)); },
    clear: function () { sessionStorage.removeItem('csm_user'); }
  },
  progress: {
    all: function () {
      try { return JSON.parse(localStorage.getItem('csm_progress') || '{}'); }
      catch (e) { return {}; }
    },
    get: function (ch) { return this.all()[ch] || null; },
    save: function (ch, score, total) {
      var p = this.all();
      var prev = p[ch] || { best: 0, plays: 0 };
      p[ch] = {
        best: Math.max(prev.best, score),
        plays: prev.plays + 1,
        total: total
      };
      localStorage.setItem('csm_progress', JSON.stringify(p));
      return p[ch];
    }
  }
};
