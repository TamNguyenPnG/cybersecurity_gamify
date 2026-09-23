/* Chapter result — WIN and PARTIAL variants. */
(function () {
  'use strict';

  var chId    = Number(UI.qs('ch', 1));
  if (!(chId >= 1 && chId <= 4)) chId = 1;

  var score   = Number(UI.qs('score', 5));
  var attempt = Number(UI.qs('attempt', 1));
  var TOTAL   = 5;
  var isWin   = score >= TOTAL;

  var chapter = DB.getChapter(chId);
  var page    = document.getElementById('resultPage');

  /* ---------- Theming ---------- */
  page.style.setProperty('--accent', 'var(' + chapter.accentVar + ')');
  document.getElementById('chChip').textContent = 'Chapter ' + chapter.num + ' · ' + chapter.title;

  /* ---------- Copy ---------- */
  var title = document.getElementById('resultTitle');
  var sub   = document.getElementById('resultSub');
  var figs  = document.getElementById('resultFigures');
  var note  = document.getElementById('stageNote');

  if (isWin) {
    title.textContent = 'Champion! Hacker captured.';
    sub.textContent   = 'Perfect run — you locked every door before the hacker got through.';
    figs.innerHTML =
      '<div class="figure fig-hero"><div class="body">🛡️</div><div class="cap">Champion</div></div>' +
      '<div class="figure hacker" style="opacity:.55"><div class="body">🔒</div><div class="cap">Captured</div></div>';
    note.innerHTML = '<strong style="color:var(--accent)">Art direction:</strong> ' +
      'The hero catches the hacker mid-stride and locks a glowing cyan restraint around them. ' +
      'Confetti bursts from the top of the frame. Bright, celebratory rim-lighting.';
    document.getElementById('stageTag').textContent = 'Result scene — WIN';
  } else {
    title.textContent = 'The hacker got away — try again.';
    sub.textContent   = 'You scored ' + score + ' out of ' + TOTAL + '. Retry as many times as you like to reach a perfect run.';
    figs.innerHTML =
      '<div class="figure fig-hero" style="opacity:.75"><div class="body">🛡️</div><div class="cap">Champion</div></div>' +
      '<div class="figure hacker" style="opacity:.3;transform:translateX(30px)"><div class="body">🕵️</div><div class="cap">Escaping…</div></div>';
    note.innerHTML = '<strong style="color:var(--accent)">Art direction:</strong> ' +
      'The hacker dissolves into the dark at the right edge of the frame, trailing red glitch particles. ' +
      'The hero stands in the foreground, dimmer and unlit. Cool, subdued lighting.';
    document.getElementById('stageTag').textContent = 'Result scene — PARTIAL';
  }

  /* ---------- Stats ---------- */
  document.getElementById('statScore').textContent   = score + '/' + TOTAL;
  document.getElementById('statAttempt').textContent = attempt;

  // Rank this player against the chapter leaderboard by score, then plays.
  var rows = DB.leaderboard({ chapter: chId });
  var rank = 1;
  rows.forEach(function (r) {
    if (r.best > score) rank++;
  });
  document.getElementById('statRank').textContent = '#' + rank;

  /* ---------- Next / retry buttons ---------- */
  var nextBtn   = document.getElementById('nextBtn');
  var nextLabel = document.getElementById('nextLabel');
  var againBtn  = document.getElementById('againBtn');

  againBtn.href = 'chapter.html?ch=' + chId;

  if (chId < 4) {
    var nextCh = DB.getChapter(chId + 1);
    nextBtn.href = 'chapter.html?ch=' + nextCh.id;
    nextLabel.textContent = 'Unlock Chapter ' + nextCh.num;
  } else {
    nextBtn.href = 'main-hall.html';
    nextLabel.textContent = 'Finish the journey';
  }

  /* ---------- Bravo note ---------- */
  document.getElementById('bravoNote').textContent = rank <= 3
    ? 'You are currently in the top 3 for this chapter — on track for 200 Bravo points.'
    : 'Top 3 per chapter win 200 Bravo points. Keep playing to climb the leaderboard.';

  /* ---------- Variant switcher highlight ---------- */
  document.getElementById(isWin ? 'tabWin' : 'tabPartial').classList.add('active');
  document.getElementById('tabWin').href     = 'result.html?ch=' + chId + '&score=5&attempt=' + attempt;
  document.getElementById('tabPartial').href = 'result.html?ch=' + chId + '&score=3&attempt=' + attempt;

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
})();
