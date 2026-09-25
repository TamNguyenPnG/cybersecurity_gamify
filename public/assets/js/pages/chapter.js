/* ============================================================
   Chapter host.

   Loads the chapter's game manifest (content/games/chapter-0N.json) and
   hands it to the engine. Chapters without a manifest fall back to the
   classic quiz built from content/questions/chapter-0N.json.

   Responsibilities beyond running games:
     - enforce the server's lock verdict before anything starts
     - keep the score HUD, step dots and timer in sync
     - POST the finished attempt to /api/attempts
     - POST /api/chapter/exit when the player abandons a grace play
   ============================================================ */
I18N.ready.then(function () {
  'use strict';

  var chId = Number(UI.qs('ch', 1));
  if (!(chId >= 1 && chId <= 4)) chId = 1;

  var chapter = DB.getChapter(chId);
  var user = UI.session.get();

  var page      = document.getElementById('chapterPage');
  var host      = document.getElementById('gameHost');
  var dotsEl    = document.getElementById('dots');
  var scoreText = document.getElementById('scoreText');
  var timerPill = document.getElementById('timerPill');
  var timerText = document.getElementById('timerText');
  var attemptEl = document.getElementById('attemptLabel');
  var backBtn   = document.getElementById('backBtn');

  if (!user) { window.location.replace('index.html'); return; }

  page.style.setProperty('--accent', 'var(' + chapter.accentVar + ')');

  var attempt = 1;
  var maxScore = 5;
  var finalScore = null;     // set once the chapter completes
  var isGrace = false;
  var exitReported = false;

  /* ---------- Header ---------- */
  function renderChrome() {
    var vars = { num: chapter.num, title: I18N.t('chapter.' + chId + '.title') };
    document.getElementById('chChip').textContent = I18N.t('ch.chip', vars);
    document.title = I18N.t('ch.docTitle', vars);
    attemptEl.textContent = I18N.t('ch.attempt', { n: attempt });
  }
  renderChrome();
  window.addEventListener('i18n:change', renderChrome);

  function paintScore(score, max) {
    scoreText.textContent = score + ' / ' + (max || maxScore);
  }

  function paintSteps(index, total) {
    dotsEl.innerHTML = '';
    for (var i = 0; i < total; i++) {
      var d = document.createElement('span');
      d.className = 'dot' + (i < index ? ' done' : (i === index ? ' current' : ''));
      dotsEl.appendChild(d);
    }
  }

  function paintTimer(secs) {
    if (secs == null) { timerPill.hidden = true; return; }
    timerPill.hidden = false;
    timerPill.classList.toggle('is-urgent', secs <= 15);
    timerText.textContent =
      String(Math.floor(secs / 60)).padStart(2, '0') + ':' +
      String(secs % 60).padStart(2, '0');
  }

  /* ---------- Leaving a grace chapter burns the grace ---------- */
  function reportExit() {
    if (!isGrace || exitReported || finalScore !== null) return;
    exitReported = true;
    /* keepalive lets the request survive the page unloading */
    try {
      navigator.sendBeacon(
        '/api/chapter/exit',
        new Blob([JSON.stringify({ email: user.email, chapter_id: chId })],
                 { type: 'application/json' })
      );
    } catch (e) {
      API.exitChapter(user.email, chId);
    }
  }
  backBtn.addEventListener('click', reportExit);
  window.addEventListener('pagehide', reportExit);

  /* ---------- Blocked screen ---------- */
  function blocked(reason) {
    host.innerHTML =
      '<div class="game-blocked">' +
        '<div class="game-blocked-icon">&#128274;</div>' +
        '<h2>' + UI.escape(I18N.t('ch.blocked.title')) + '</h2>' +
        '<p>' + UI.escape(I18N.t('ch.blocked.' + reason)) + '</p>' +
      '</div>';
    var a = document.createElement('a');
    a.className = 'btn btn-primary';
    a.href = 'main-hall.html';
    a.textContent = I18N.t('ch.blocked.back');
    host.querySelector('.game-blocked').appendChild(a);
    dotsEl.innerHTML = '';
  }

  /* ---------- Build the games list ---------- */
  function loadGames() {
    return fetch('content/games/chapter-' + String(chId).padStart(2, '0') + '.json')
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; })
      .then(function (manifest) {
        if (manifest && manifest.games && manifest.games.length) {
          maxScore = manifest.maxScore ||
            manifest.games.reduce(function (s, g) { return s + (g.points || 0); }, 0);
          return manifest.games;
        }
        /* Fallback: wrap the question file as one quiz game. */
        return QUESTIONS.raw(chId).then(function (file) {
          maxScore = file.questions.length;
          return [{ id: 'quiz', type: 'quiz', points: maxScore, questions: file.questions }];
        });
      });
  }

  /* ---------- Finish ---------- */
  function complete(result) {
    finalScore = result.score;
    UI.progress.save(chId, result.score, result.maxScore);

    var payload = {
      email: user.email,
      chapter_id: chId,
      score: result.score,
      max_score: result.maxScore,
      duration_s: result.durationS,
      language: I18N.lang,
      detail: result.detail
    };

    function go(attemptNo) {
      window.location.href = 'result.html?ch=' + chId +
        '&score=' + result.score +
        '&max=' + result.maxScore +
        '&time=' + (result.durationS || 0) +
        '&attempt=' + (attemptNo || attempt);
    }

    API.saveAttempt(payload).then(function (r) {
      go(r.attempt_no);
    }, function (err) {
      console.error('Could not save the attempt:', err);
      UI.toast(I18N.t('ch.saveFailed'), 'bad');
      setTimeout(function () { go(attempt); }, 1200);
    });
  }

  /* ---------- Boot ---------- */
  API.chapters(user.email).then(function (data) {
    var row = (data.chapters || []).filter(function (c) {
      return c.id === chId;
    })[0];

    if (!row) return blocked('unknown');
    if (row.state === 'locked')   return blocked(row.reason || 'closed');
    if (row.state === 'upcoming') return blocked('upcoming');

    isGrace = row.state === 'grace';
    attempt = (row.plays || 0) + 1;
    renderChrome();

    if (isGrace) UI.toast(I18N.t('ch.graceNotice'), 'bad');

    return loadGames().then(function (games) {
      paintScore(0, maxScore);
      GAMES.run({
        host: host,
        games: games,
        lang: I18N.lang,
        maxScore: maxScore,
        onScore: paintScore,
        onStep: paintSteps,
        onTimer: paintTimer,
        onComplete: complete
      });
    });
  }).catch(function (err) {
    console.error(err);
    host.innerHTML = '<p class="t-body">' +
      UI.escape(I18N.t('ch.loadFailed')) + '</p>';
  });
});
