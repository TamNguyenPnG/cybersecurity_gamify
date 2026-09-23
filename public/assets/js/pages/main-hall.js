/* Main Hall — KPI strip, chapter selector, rules, leaderboard. */
I18N.ready.then(function () {
  'use strict';

  /* ---------- Signed-in user ---------- */
  var who = document.getElementById('whoami');

  function renderWho() {
    var user = UI.session.get();
    if (user) {
      who.innerHTML =
        '<div class="avatar">' + UI.escape(UI.initials(user.name)) + '</div>' +
        '<div><div class="t-small" style="color:var(--text-headline);font-weight:700">' + UI.escape(user.name) + '</div>' +
        '<div class="t-caption">' + UI.escape(user.dept) + '</div></div>';
    } else {
      who.innerHTML = '<a class="btn btn-secondary" style="padding:9px 20px;font-size:14px" href="index.html">' +
        UI.escape(I18N.t('nav.signIn')) + '</a>';
    }
  }
  renderWho();

  /* ---------- KPI tiles ---------- */
  var KPI_ICONS = {
    'top-dept': '<path d="M3 21h18M6 21V9l6-5 6 5v12M10 21v-5h4v5" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
    'completed': '<path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
    'plays': '<path d="M7 4v16l13-8z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
    'bravo': '<path d="M8 3h8v5a4 4 0 01-8 0V3zM12 12v5M8.5 21h7M5 5H3v2a4 4 0 004 4M19 5h2v2a4 4 0 01-4 4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>'
  };

  var grid = document.getElementById('kpiGrid');

  function renderKpis() {
    grid.innerHTML = '';
    DB.kpis.forEach(function (k, i) {
      var accents = ['--ch1', '--ch2', '--ch3', '--ch4'];
      var el = document.createElement('div');
      el.className = 'glass glass-hover kpi';
      el.style.setProperty('--accent', 'var(' + accents[i] + ')');
      el.innerHTML =
        '<div class="kpi-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none">' + KPI_ICONS[k.key] + '</svg></div>' +
        '<div class="kpi-value">' + UI.escape(k.value) + '</div>' +
        '<div class="kpi-label">' + UI.escape(I18N.t('kpi.' + k.key + '.label')) + '</div>' +
        '<div class="t-caption" style="opacity:.75">' + UI.escape(I18N.t('kpi.' + k.key + '.sub')) + '</div>' +
        '<div class="kpi-bar"><span style="width:0%"></span></div>';
      grid.appendChild(el);
      // Animate the bar in after paint.
      setTimeout(function () {
        el.querySelector('.kpi-bar span').style.transition = 'width 1s ease';
        el.querySelector('.kpi-bar span').style.width = k.pct + '%';
      }, 120 + i * 90);
    });
  }
  renderKpis();

  /* ---------- Chapter cards ---------- */
  var CH_ICONS = [
    '<circle cx="12" cy="12" r="3.4" stroke="currentColor" stroke-width="1.8"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    '<rect x="4" y="3" width="16" height="18" rx="2.5" stroke="currentColor" stroke-width="1.8"/><path d="M10 18h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    '<path d="M5 12a7 7 0 0114 0M8.5 12a3.5 3.5 0 017 0M12 15.5v.1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    '<path d="M12 3v11M8 10l4 4 4-4M4 18v2h16v-2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>'
  ];

  var LOCK_SVG = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><rect x="4" y="10" width="16" height="11" rx="2.5" stroke="currentColor" stroke-width="2"/><path d="M8 10V7a4 4 0 118 0v3" stroke="currentColor" stroke-width="2"/></svg>';

  function chapterState(ch) {
    var p = UI.progress.get(ch.id);
    if (p && p.best > 0) return 'completed';
    // Chapter 1 is always open; a chapter unlocks once the previous is completed.
    if (ch.id === 1) return 'available';
    var prev = UI.progress.get(ch.id - 1);
    return (prev && prev.best > 0) ? 'available' : 'locked';
  }

  function renderChapters() {
    var wrap = document.getElementById('chapterGrid');
    wrap.innerHTML = '';
    var completed = 0;

    DB.chapters.forEach(function (ch, i) {
      var state = chapterState(ch);
      var p = UI.progress.get(ch.id);
      if (state === 'completed') completed++;

      var card = document.createElement(state === 'locked' ? 'div' : 'a');
      card.className = 'glass glass-hover chapter-card is-' + state;
      card.dataset.ch = ch.id;
      if (state !== 'locked') card.href = 'chapter.html?ch=' + ch.id;

      var unlock = I18N.t('chapter.' + ch.id + '.unlock');
      var foot;
      if (state === 'locked') {
        foot = '<span class="lock-pill">' + LOCK_SVG + ' ' + UI.escape(I18N.t('hall.card.unlocks', { date: unlock })) + '</span>';
      } else if (state === 'completed') {
        foot = '<span class="score-chip">' + p.best + '/' + (p.total || 5) + '</span>' +
               '<span class="ch-action">' + UI.escape(I18N.t('hall.card.playAgain')) + '</span>';
      } else {
        foot = '<span class="lock-pill">' + UI.escape(I18N.t('hall.card.unlocked', { date: unlock })) + '</span>' +
               '<span class="ch-action">' + UI.escape(I18N.t('hall.card.start')) + '</span>';
      }

      card.innerHTML =
        '<span class="ch-node"></span>' +
        (state === 'completed'
          ? '<span class="check-badge"><svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></span>'
          : '') +
        '<div class="ch-num">CH ' + ch.num + '</div>' +
        '<div class="ch-icon">' +
          (state === 'locked'
            ? '<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="4" y="10" width="16" height="11" rx="2.5" stroke="currentColor" stroke-width="1.8"/><path d="M8 10V7a4 4 0 118 0v3" stroke="currentColor" stroke-width="1.8"/></svg>'
            : '<svg width="22" height="22" viewBox="0 0 24 24" fill="none">' + CH_ICONS[i] + '</svg>') +
        '</div>' +
        '<h3 class="ch-title">' + UI.escape(I18N.t('chapter.' + ch.id + '.title')) + '</h3>' +
        '<p class="ch-desc">' + UI.escape(I18N.t('chapter.' + ch.id + '.desc')) + '</p>' +
        '<div class="ch-foot">' + foot + '</div>';

      wrap.appendChild(card);
    });

    // Light the constellation line proportionally to completion.
    var pct = (completed / DB.chapters.length) * 100;
    document.getElementById('litLine').style.width = pct + '%';
  }

  renderChapters();

  /* ---------- Rules panel ---------- */
  var panel = document.getElementById('rulesPanel');
  document.getElementById('rulesToggle').addEventListener('click', function () {
    var collapsed = panel.classList.toggle('collapsed');
    this.setAttribute('aria-expanded', String(!collapsed));
  });

  /* ---------- Leaderboard ---------- */
  var lbBody = document.getElementById('lbBody');
  var subWrap = document.getElementById('lbSubfilter');
  var mode = 'all';
  var sub = null;

  function renderLB() {
    var filter = {};
    if (mode === 'chapter' && sub) filter.chapter = sub;
    if (mode === 'dept' && sub) filter.dept = sub;

    var rows = DB.leaderboard(filter);
    lbBody.innerHTML = '';

    if (!rows.length) {
      lbBody.innerHTML = '<tr><td colspan="5" class="t-caption" style="padding:26px;text-align:center">' +
        UI.escape(I18N.t('hall.lbEmpty')) + '</td></tr>';
      return;
    }

    rows.forEach(function (r, i) {
      var tr = document.createElement('tr');
      if (i < 3) tr.className = 'rank-' + (i + 1);
      tr.innerHTML =
        '<td><span class="rank-badge">' + (i + 1) + '</span></td>' +
        '<td><div class="lb-user"><span class="avatar">' + UI.escape(UI.initials(r.name)) + '</span>' +
          '<span class="lb-name">' + UI.escape(r.name) + '</span></div></td>' +
        '<td>' + UI.escape(r.dept) + '</td>' +
        '<td><strong style="color:var(--text-headline)">' + r.best + '/5</strong></td>' +
        '<td>' + r.plays + '</td>';
      lbBody.appendChild(tr);
    });
  }

  function renderSub() {
    subWrap.innerHTML = '';
    if (mode === 'all') { subWrap.classList.add('hidden'); sub = null; renderLB(); return; }

    subWrap.classList.remove('hidden');
    var opts = mode === 'chapter'
      ? DB.chapters.map(function (c) { return { v: c.id, l: 'CH ' + c.num + ' · ' + I18N.t('chapter.' + c.id + '.title') }; })
      : DB.departments.map(function (d) { return { v: d, l: d }; });

    opts.forEach(function (o, i) {
      var b = document.createElement('button');
      b.className = 'tab' + (i === 0 ? ' active' : '');
      b.textContent = o.l;
      b.addEventListener('click', function () {
        subWrap.querySelectorAll('.tab').forEach(function (t) { t.classList.remove('active'); });
        b.classList.add('active');
        sub = o.v;
        renderLB();
      });
      subWrap.appendChild(b);
    });
    sub = opts[0].v;
    renderLB();
  }

  document.getElementById('lbTabs').addEventListener('click', function (e) {
    var b = e.target.closest('[data-filter]');
    if (!b) return;
    this.querySelectorAll('.tab').forEach(function (t) { t.classList.remove('active'); });
    b.classList.add('active');
    mode = b.dataset.filter;
    renderSub();
  });

  renderLB();

  /* ---------- Demo controls ---------- */
  document.getElementById('demoReset').addEventListener('click', function (e) {
    e.preventDefault();
    localStorage.removeItem('csm_progress');
    renderChapters();
    UI.toast(I18N.t('hall.toast.reset'));
  });
  document.getElementById('demoComplete').addEventListener('click', function (e) {
    e.preventDefault();
    UI.progress.save(1, 5, 5);
    renderChapters();
    UI.toast(I18N.t('hall.toast.complete'));
  });
  document.getElementById('demoLogout').addEventListener('click', function (e) {
    e.preventDefault();
    UI.session.clear();
    window.location.href = 'index.html';
  });

  /* ---------- Re-render dynamic content on language change ---------- */
  window.addEventListener('i18n:change', function () {
    renderWho();
    renderKpis();
    renderChapters();
    if (mode === 'all') { renderLB(); } else { renderSub(); }
  });
});
