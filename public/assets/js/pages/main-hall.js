/* ============================================================
   Main Hall.

   Reads everything live from the server: KPIs, the per-user chapter
   states (which encode the lock policy) and the personal attempt history
   shown in the records drawer.
   ============================================================ */
I18N.ready.then(function () {
  'use strict';

  var user = UI.session.get();
  if (!user) { window.location.replace('index.html'); return; }

  /* ---------- Who's signed in ---------- */
  var initials = String(user.name || user.email).trim().split(/\s+/)
    .slice(0, 2).map(function (w) { return w[0]; }).join('').toUpperCase();

  document.getElementById('whoami').innerHTML =
    '<div class="avatar">' + UI.escape(initials) + '</div>' +
    '<div><div class="t-small" style="color:var(--text-headline);font-weight:600">' +
      UI.escape(user.name) + '</div>' +
    '<div class="t-caption">' + UI.escape(user.dept) + '</div></div>';

  /* ---------- Hero artwork: fall back to the brief if absent ---------- */
  var heroImg = document.getElementById('heroImg');
  heroImg.addEventListener('error', function () {
    heroImg.hidden = true;
    document.getElementById('heroFallback').hidden = false;
  });

  /* ---------- KPIs ---------- */
  function renderKpis(kpis) {
    document.getElementById('kpiGrid').innerHTML = kpis.map(function (k) {
      return '' +
        '<div class="glass kpi">' +
          '<div class="kpi-icon">' + kpiIcon(k.key) + '</div>' +
          '<div class="kpi-value">' + UI.escape(k.value) + '</div>' +
          '<div class="kpi-label">' + UI.escape(I18N.t('kpi.' + k.key + '.label')) + '</div>' +
          '<div class="kpi-bar"><span style="width:' + Math.max(0, Math.min(100, k.pct)) + '%"></span></div>' +
          '<div class="t-caption" style="margin-top:8px">' +
            UI.escape(I18N.t('kpi.' + k.key + '.sub', k.sub || {})) + '</div>' +
        '</div>';
    }).join('');
  }

  function kpiIcon(key) {
    var paths = {
      completed: '<path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
      plays: '<path d="M7 4.5v15l12-7.5z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
      avg: '<path d="M4 18l5-6 4 3.5L20 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>'
    };
    return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
      (paths[key] || paths.plays) + '</svg>';
  }

  /* ---------- Chapter cards ---------- */
  var chapterData = [];

  function renderChapters() {
    var grid = document.getElementById('chapterGrid');
    grid.innerHTML = '';

    chapterData.forEach(function (row) {
      var meta = DB.getChapter(row.id);
      var state = row.state;
      var playable = state === 'available' || state === 'grace';
      var completed = row.best != null && row.plays > 0;

      var card = document.createElement(playable ? 'a' : 'div');
      card.className = 'ch-card' +
        (playable ? '' : ' locked') +
        (completed ? ' completed' : '') +
        (state === 'grace' ? ' is-grace' : '');
      card.style.setProperty('--accent', 'var(' + meta.accentVar + ')');
      if (playable) card.href = 'chapter.html?ch=' + row.id;

      /* Status line under the title depends on the lock verdict. */
      var status, cta;
      if (state === 'available') {
        status = I18N.t('hall.card.unlocked', { date: fmt(row.opens) });
        cta = I18N.t('hall.card.' + (completed ? 'playAgain' : 'start'));
      } else if (state === 'grace') {
        status = I18N.t('ch.graceNotice');
        cta = I18N.t('hall.card.grace');
      } else if (state === 'upcoming') {
        status = I18N.t('hall.card.unlocks', { date: fmt(row.opens) });
        cta = null;
      } else if (row.reason === 'no-content') {
        status = I18N.t('hall.card.soon');
        cta = null;
      } else {
        status = I18N.t('hall.card.closed');
        cta = null;
      }

      card.innerHTML =
        '<div class="ch-top">' +
          '<span class="ch-num">' + UI.escape(meta.num) + '</span>' +
          (playable ? '' : '<span class="ch-lock">&#128274;</span>') +
          (completed ? '<span class="ch-badge">&#10003; ' +
            UI.escape(row.best + '/5') + '</span>' : '') +
        '</div>' +
        '<h3 class="ch-title">' + UI.escape(I18N.t('chapter.' + row.id + '.title')) + '</h3>' +
        '<p class="ch-desc">' + UI.escape(I18N.t('chapter.' + row.id + '.desc')) + '</p>' +
        '<div class="ch-foot">' +
          '<span class="ch-status">' + UI.escape(status) + '</span>' +
          (cta ? '<span class="ch-cta">' + UI.escape(cta) + '</span>' : '') +
        '</div>';

      grid.appendChild(card);
    });

    /* Constellation line lights up in proportion to chapters completed. */
    var done = chapterData.filter(function (c) { return c.best != null && c.plays > 0; }).length;
    document.getElementById('litLine').style.width =
      (chapterData.length ? (done / chapterData.length) * 100 : 0) + '%';

    /* Point the hero CTA at the first chapter the user can actually play. */
    var next = chapterData.filter(function (c) {
      return c.state === 'available' || c.state === 'grace';
    })[0];
    var cta = document.getElementById('heroCta');
    if (next) {
      cta.href = 'chapter.html?ch=' + next.id;
      cta.classList.remove('is-disabled');
    } else {
      cta.href = '#';
      cta.classList.add('is-disabled');
    }
  }

  function fmt(iso) {
    if (!iso) return '';
    var d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString(I18N.lang === 'vi' ? 'vi-VN' : 'en-GB',
      { day: 'numeric', month: 'short' });
  }

  /* ---------- Records drawer ---------- */
  var backdrop = document.getElementById('recordsBackdrop');

  function openRecords() {
    backdrop.hidden = false;
    document.body.style.overflow = 'hidden';
    var body = document.getElementById('recordsBody');
    body.innerHTML = '<p class="t-caption">' + UI.escape(I18N.t('ch.loading')) + '</p>';

    API.records(user.email).then(function (rows) {
      if (!rows.length) {
        body.innerHTML = '<p class="t-body" style="opacity:.7">' +
          UI.escape(I18N.t('rec.empty')) + '</p>';
        return;
      }
      body.innerHTML =
        '<table class="rec-table"><thead><tr>' +
          '<th>' + UI.escape(I18N.t('rec.th.date')) + '</th>' +
          '<th>' + UI.escape(I18N.t('rec.th.chapter')) + '</th>' +
          '<th>' + UI.escape(I18N.t('rec.th.score')) + '</th>' +
          '<th>' + UI.escape(I18N.t('rec.th.attempt')) + '</th>' +
        '</tr></thead><tbody>' +
        rows.map(function (r) {
          var d = new Date(r.played_at.replace(' ', 'T'));
          var date = isNaN(d) ? r.played_at
            : d.toLocaleDateString(I18N.lang === 'vi' ? 'vi-VN' : 'en-GB',
                { day: '2-digit', month: 'short', year: 'numeric' });
          var pct = r.max_score ? (r.score / r.max_score) : 0;
          return '<tr>' +
            '<td>' + UI.escape(date) + '</td>' +
            '<td><span class="rec-chip" style="--accent:var(' +
              DB.getChapter(r.chapter_id).accentVar + ')">' +
              UI.escape(I18N.t('ch.chip', {
                num: DB.getChapter(r.chapter_id).num,
                title: I18N.t('chapter.' + r.chapter_id + '.title')
              })) + '</span></td>' +
            '<td class="rec-score' + (pct === 1 ? ' is-perfect' : '') + '">' +
              UI.escape(r.score + ' / ' + r.max_score) + '</td>' +
            '<td>' + UI.escape(I18N.t('rec.attemptN', { n: r.attempt_no })) + '</td>' +
          '</tr>';
        }).join('') +
        '</tbody></table>';
    }, function () {
      body.innerHTML = '<p class="t-body">' + UI.escape(I18N.t('ch.loadFailed')) + '</p>';
    });
  }

  function closeRecords() {
    backdrop.hidden = true;
    document.body.style.overflow = '';
  }

  document.getElementById('recordsBtn').addEventListener('click', openRecords);
  document.getElementById('recordsClose').addEventListener('click', closeRecords);
  backdrop.addEventListener('click', function (ev) {
    if (ev.target === backdrop) closeRecords();
  });
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' && !backdrop.hidden) closeRecords();
  });

  /* ---------- Collapsible guide ---------- */
  var toggle = document.getElementById('rulesToggle');
  toggle.addEventListener('click', function () {
    var open = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!open));
    document.getElementById('rulesPanel').classList.toggle('collapsed', open);
  });

  /* ---------- Sign out ---------- */
  document.getElementById('demoLogout').addEventListener('click', function (e) {
    e.preventDefault();
    UI.session.clear();
    window.location.href = 'index.html';
  });

  /* ---------- Load ---------- */
  function load() {
    API.kpis().then(renderKpis, function () {});
    API.chapters(user.email).then(function (data) {
      chapterData = data.chapters || [];
      renderChapters();
    }, function () {
      document.getElementById('chapterGrid').innerHTML =
        '<p class="t-body">' + UI.escape(I18N.t('ch.loadFailed')) + '</p>';
    });
  }

  window.addEventListener('i18n:change', function () {
    if (chapterData.length) renderChapters();
    API.kpis().then(renderKpis, function () {});
  });

  load();
});
