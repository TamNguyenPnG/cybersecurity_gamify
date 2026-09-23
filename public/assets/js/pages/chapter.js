/* Chapter template — reusable across all 4 chapters.
   Only the accent colour, chip label and game stage change per chapter.

   Questions are loaded from content/questions/chapter-0N.json. Each question
   carries both languages and ONE shared `answer` index, so switching language
   mid-quiz re-labels the options without changing which one is correct. */
I18N.ready.then(function () {
  'use strict';

  var chId = Number(UI.qs('ch', 1));
  if (!(chId >= 1 && chId <= 4)) chId = 1;

  var chapter = DB.getChapter(chId);
  var TOTAL   = 5;

  var page    = document.getElementById('chapterPage');
  var answers = document.getElementById('answers');
  var qText   = document.getElementById('qText');
  var qCount  = document.getElementById('qCounter');
  var dotsEl  = document.getElementById('dots');
  var scoreEl = document.getElementById('scoreText');
  var timerEl = document.getElementById('timerText');

  /* ---------- Per-chapter theming (re-applied on language change) ---------- */
  page.style.setProperty('--accent', 'var(' + chapter.accentVar + ')');

  function renderChrome() {
    var vars = { num: chapter.num, title: I18N.t('chapter.' + chId + '.title') };
    document.getElementById('chChip').textContent = I18N.t('ch.chip', vars);
    document.getElementById('stageTag').textContent = I18N.t('ch.stageTag', vars);
    document.getElementById('stageTag').removeAttribute('data-i18n');
    document.getElementById('stageNote').innerHTML =
      '<strong style="color:var(--accent)">' + UI.escape(I18N.t('ch.stageLabel')) + '</strong> ' +
      UI.escape(I18N.t('chapter.' + chId + '.stage'));
    document.title = I18N.t('ch.docTitle', vars);
    document.getElementById('attemptLabel').textContent = I18N.t('ch.attempt', { n: attempt });
  }

  /* ---------- Attempt counter ---------- */
  var prev = UI.progress.get(chId);
  var attempt = (prev ? prev.plays : 0) + 1;

  renderChrome();

  /* ---------- Quiz state ---------- */
  var file = null;     // raw bilingual question file
  var plan = [];       // per-question shuffled option order (language-independent)
  var idx = 0, score = 0, locked = false;

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* ---------- Progress dots ---------- */
  function renderDots() {
    dotsEl.innerHTML = '';
    for (var i = 0; i < TOTAL; i++) {
      var d = document.createElement('span');
      d.className = 'dot' + (i < idx ? ' done' : (i === idx ? ' current' : ''));
      dotsEl.appendChild(d);
    }
  }

  /* ---------- Chase scene ---------- */
  function renderTrack() {
    var track = document.getElementById('track');
    track.querySelectorAll('.step').forEach(function (n) { n.remove(); });
    for (var i = 0; i < TOTAL; i++) {
      var s = document.createElement('span');
      s.className = 'step' + (i < score ? ' done' : '');
      s.style.left = ((i + 0.5) / TOTAL * 100) + '%';
      s.textContent = i + 1;
      track.appendChild(s);
    }
    document.getElementById('trackFill').style.width = (score / TOTAL * 100) + '%';
    // Hero closes in, hacker backs away as the score climbs.
    document.getElementById('heroFig').style.transform   = 'translateX(' + (score * 14) + 'px)';
    document.getElementById('hackerFig').style.transform = 'translateX(' + (score * -6) + 'px)';
    document.getElementById('hackerFig').style.opacity   = String(1 - score * 0.1);
  }

  /* ---------- Render the current question in the active language ---------- */
  function render() {
    if (!file) return;
    locked = false;

    var item = file.questions[idx];
    var loc  = item[I18N.lang] || item.en;

    qCount.textContent = I18N.t('ch.counter', { n: idx + 1, total: TOTAL });
    qText.textContent = loc.q;
    qText.removeAttribute('data-i18n');   // no longer the "Loading…" placeholder
    scoreEl.textContent = score + ' / ' + TOTAL;
    renderDots();
    renderTrack();

    answers.innerHTML = '';
    plan[idx].forEach(function (origIndex, i) {
      var b = document.createElement('button');
      b.className = 'answer';
      b.type = 'button';
      b.innerHTML = '<span class="key">' + String.fromCharCode(65 + i) + '</span>' +
                    '<span>' + UI.escape(loc.o[origIndex]) + '</span>';
      b.addEventListener('click', function () {
        pick(b, origIndex === Number(item.answer));
      });
      answers.appendChild(b);
    });
  }

  /* ---------- Answer handling ---------- */
  function pick(btn, isCorrect) {
    if (locked) return;
    locked = true;

    // Disable every option once one is chosen.
    answers.querySelectorAll('.answer').forEach(function (n) { n.disabled = true; });
    btn.classList.add('selected');

    setTimeout(function () {
      btn.classList.remove('selected');
      if (isCorrect) {
        btn.classList.add('correct');
        score++;
        scoreEl.textContent = score + ' / ' + TOTAL;
        renderTrack();
        UI.toast(I18N.t('ch.toast.correct'), 'ok');
      } else {
        // Incorrect: glow red but never reveal the right answer.
        btn.classList.add('incorrect');
        UI.toast(I18N.t('ch.toast.wrong'), 'bad');
      }
      setTimeout(next, 1100);
    }, 260);
  }

  function next() {
    idx++;
    if (idx >= TOTAL) return finish();
    render();
  }

  function finish() {
    UI.progress.save(chId, score, TOTAL);
    window.location.href = 'result.html?ch=' + chId + '&score=' + score + '&attempt=' + attempt;
  }

  /* ---------- Timer ---------- */
  var started = Date.now();
  setInterval(function () {
    var s = Math.floor((Date.now() - started) / 1000);
    timerEl.textContent =
      String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  }, 1000);

  /* ---------- Language change: relabel without losing progress ---------- */
  window.addEventListener('i18n:change', function () {
    renderChrome();
    if (!locked) render();
  });

  /* ---------- Load questions, then start ---------- */
  QUESTIONS.raw(chId).then(function (data) {
    file = data;
    TOTAL = file.questions.length || 5;
    plan = file.questions.map(function (item) {
      return shuffle(item.en.o.map(function (_, i) { return i; }));
    });
    render();
  }).catch(function (err) {
    console.error(err);
    qText.textContent = 'Could not load questions. Serve this site over HTTP (see README).';
  });
});
