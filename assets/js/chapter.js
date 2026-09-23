/* Chapter template — reusable across all 4 chapters.
   Only the accent colour, chip label and game stage change per chapter. */
(function () {
  'use strict';

  var chId    = Number(UI.qs('ch', 1));
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

  /* ---------- Per-chapter theming ---------- */
  page.style.setProperty('--accent', 'var(' + chapter.accentVar + ')');
  document.getElementById('chChip').textContent = 'Chapter ' + chapter.num + ' · ' + chapter.title;
  document.getElementById('stageTag').textContent = 'Game scene — Chapter ' + chapter.num + ': ' + chapter.title;
  document.getElementById('stageNote').innerHTML =
    '<strong style="color:var(--accent)">Game stage placeholder.</strong> ' + UI.escape(chapter.stage);
  document.title = 'Chapter ' + chapter.num + ' · ' + chapter.title + ' — Cybersecurity Month 2026';

  /* ---------- Attempt counter ---------- */
  var prev = UI.progress.get(chId);
  var attempt = (prev ? prev.plays : 0) + 1;
  document.getElementById('attemptLabel').textContent = 'Attempt ' + attempt;

  /* ---------- Build the shuffled quiz ---------- */
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // Shuffle the options inside each question, tracking where the answer moved.
  var quiz = DB.getQuestions(chId).map(function (item) {
    var opts = item.o.map(function (text, i) { return { text: text, correct: i === item.a }; });
    return { q: item.q, opts: shuffle(opts) };
  });

  var idx = 0, score = 0, locked = false;

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

  /* ---------- Render a question ---------- */
  function render() {
    locked = false;
    var item = quiz[idx];

    qCount.textContent = 'Question ' + (idx + 1) + ' of ' + TOTAL;
    qText.textContent = item.q;
    scoreEl.textContent = score + ' / ' + TOTAL;
    renderDots();
    renderTrack();

    answers.innerHTML = '';
    item.opts.forEach(function (opt, i) {
      var b = document.createElement('button');
      b.className = 'answer';
      b.type = 'button';
      b.innerHTML = '<span class="key">' + String.fromCharCode(65 + i) + '</span><span>' + UI.escape(opt.text) + '</span>';
      b.addEventListener('click', function () { pick(b, opt); });
      answers.appendChild(b);
    });
  }

  /* ---------- Answer handling ---------- */
  function pick(btn, opt) {
    if (locked) return;
    locked = true;

    // Disable every option once one is chosen.
    answers.querySelectorAll('.answer').forEach(function (n) { n.disabled = true; });

    btn.classList.add('selected');

    setTimeout(function () {
      btn.classList.remove('selected');
      if (opt.correct) {
        btn.classList.add('correct');
        score++;
        scoreEl.textContent = score + ' / ' + TOTAL;
        renderTrack();
        UI.toast('Correct!', 'ok');
      } else {
        // Incorrect: glow red but never reveal the right answer.
        btn.classList.add('incorrect');
        UI.toast('Not quite.', 'bad');
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

  render();
})();
