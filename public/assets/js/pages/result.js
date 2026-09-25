/* Chapter result — WIN and PARTIAL variants. */
I18N.ready.then(function () {
  'use strict';

  var chId = Number(UI.qs('ch', 1));
  if (!(chId >= 1 && chId <= 4)) chId = 1;

  var score   = Number(UI.qs('score', 5));
  var attempt = Number(UI.qs('attempt', 1));
  var TOTAL   = Math.max(1, Number(UI.qs('max', 5)));
  var isWin   = score >= TOTAL;

  var chapter = DB.getChapter(chId);
  var page    = document.getElementById('resultPage');

  page.style.setProperty('--accent', 'var(' + chapter.accentVar + ')');

  var title = document.getElementById('resultTitle');
  var sub   = document.getElementById('resultSub');
  var figs  = document.getElementById('resultFigures');
  var note  = document.getElementById('stageNote');

  /* Personal best for this chapter, filled in once the server answers.
     (The public leaderboard was removed — progress is now personal only.) */
  var best = score;

  function renderCopy() {
    var v = isWin ? 'win' : 'partial';

    document.getElementById('chChip').textContent =
      I18N.t('ch.chip', { num: chapter.num, title: I18N.t('chapter.' + chId + '.title') });

    title.textContent = I18N.t('result.' + v + '.title');
    sub.textContent   = I18N.t('result.' + v + '.sub', { score: score, total: TOTAL });
    document.getElementById('stageTag').textContent = I18N.t('result.' + v + '.tag');
    note.innerHTML =
      '<strong style="color:var(--accent)">' + UI.escape(I18N.t('hall.artLabel')) + '</strong> ' +
      UI.escape(I18N.t('result.' + v + '.note'));

    var capHero   = UI.escape(I18N.t('result.' + v + '.capHero'));
    var capHacker = UI.escape(I18N.t('result.' + v + '.capHacker'));

    figs.innerHTML = isWin
      ? '<div class="figure fig-hero"><div class="body">🛡️</div><div class="cap">' + capHero + '</div></div>' +
        '<div class="figure hacker" style="opacity:.55"><div class="body">🔒</div><div class="cap">' + capHacker + '</div></div>'
      : '<div class="figure fig-hero" style="opacity:.75"><div class="body">🛡️</div><div class="cap">' + capHero + '</div></div>' +
        '<div class="figure hacker" style="opacity:.3;transform:translateX(30px)"><div class="body">🕵️</div><div class="cap">' + capHacker + '</div></div>';

    document.getElementById('bravoNote').textContent =
      I18N.t(isWin ? 'result.bravoTop3' : 'result.bravoKeep');

    document.getElementById('nextLabel').textContent = chId < 4
      ? I18N.t('result.next', { num: DB.getChapter(chId + 1).num })
      : I18N.t('result.finish');

    document.title = I18N.t('result.docTitle');
  }

  /* ---------- Stats ---------- */
  document.getElementById('statScore').textContent   = score + '/' + TOTAL;
  document.getElementById('statAttempt').textContent = attempt;
  var bestEl = document.getElementById('statRank');
  bestEl.textContent = best + '/' + TOTAL;

  /* Pull the real personal best from the server so a retry that scored
     lower still shows the user their best run. */
  var me = UI.session.get();
  if (me) {
    API.chapters(me.email).then(function (data) {
      (data.chapters || []).forEach(function (c) {
        if (c.id === chId && c.best != null && c.best > best) {
          best = c.best;
          bestEl.textContent = best + '/' + TOTAL;
        }
      });
    }, function () {});
  }

  /* ---------- Next / retry buttons ---------- */
  document.getElementById('againBtn').href = 'chapter.html?ch=' + chId;
  document.getElementById('nextBtn').href  = chId < 4
    ? 'chapter.html?ch=' + (chId + 1)
    : 'main-hall.html';

  /* ---------- Variant switcher highlight ---------- */
  document.getElementById(isWin ? 'tabWin' : 'tabPartial').classList.add('active');
  document.getElementById('tabWin').href     = 'result.html?ch=' + chId + '&score=5&attempt=' + attempt;
  document.getElementById('tabPartial').href = 'result.html?ch=' + chId + '&score=3&attempt=' + attempt;

  renderCopy();
  window.addEventListener('i18n:change', renderCopy);

  /* ---------- Confetti (WIN only) ---------- */
  if (isWin && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var wrap = document.createElement('div');
    wrap.className = 'confetti';
    var colors = ['#22D3EE', '#38BDF8', '#60A5FA', '#818CF8', '#FCD34D', '#34D399'];
    for (var i = 0; i < 44; i++) {
      var c = document.createElement('i');
      c.style.left = (Math.random() * 100) + '%';
      c.style.background = colors[i % colors.length];
      c.style.animationDuration = (1.8 + Math.random() * 1.8) + 's';
      c.style.animationDelay = (Math.random() * 2) + 's';
      wrap.appendChild(c);
    }
    document.getElementById('resultStage').appendChild(wrap);
  }
});
