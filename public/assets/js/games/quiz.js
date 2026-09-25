/* ============================================================
   Fallback game — the classic 5-question quiz.

   Chapters 2–4 have no custom mini-games yet, so the host falls back to
   this: it wraps the whole bilingual question file from
   content/questions/chapter-0N.json as a single "game" worth one point
   per question. Incorrect answers glow red but are never revealed.
   ============================================================ */
GAMES.register('quiz', function () {
  'use strict';

  var el = GAMES.el;

  return {
    mount: function (host, cfg, ctx) {
      var items = cfg.questions || [];
      var total = items.length;
      var idx = 0, score = 0, locked = false;

      /* Option order is decided once, in terms of ORIGINAL indices, so
         switching language relabels without moving the correct answer. */
      var plan = items.map(function (item) {
        return GAMES.shuffle(item.en.o.map(function (_, i) { return i; }));
      });

      var card = el('div', 'glass quiz-card');
      host.appendChild(card);

      function render() {
        locked = false;
        var item = items[idx];
        var loc = item[ctx.lang] || item.en;

        card.innerHTML = '';
        card.appendChild(el('span', 't-overline',
          UI.escape(ctx.t('ch.counter', { n: idx + 1, total: total }))));
        card.appendChild(el('h2', 't-h3 quiz-q', UI.escape(loc.q)));

        var answers = el('div', 'answers');
        plan[idx].forEach(function (orig, i) {
          var b = el('button', 'answer',
            '<span class="key">' + String.fromCharCode(65 + i) + '</span>' +
            '<span>' + UI.escape(loc.o[orig]) + '</span>');
          b.type = 'button';
          b.addEventListener('click', function () {
            choose(answers, b, orig === Number(item.answer));
          });
          answers.appendChild(b);
        });
        card.appendChild(answers);

        card.appendChild(el('p', 't-caption quiz-note',
          UI.escape(ctx.t('ch.answersNote'))));
      }

      function choose(answers, btn, correct) {
        if (locked) return;
        locked = true;
        Array.prototype.forEach.call(answers.children, function (n) { n.disabled = true; });
        btn.classList.add('selected');

        setTimeout(function () {
          btn.classList.remove('selected');
          btn.classList.add(correct ? 'correct' : 'incorrect');
          if (correct) {
            score += 1;
            ctx.progress(score);
            UI.toast(ctx.t('ch.toast.correct'), 'ok');
          } else {
            UI.toast(ctx.t('ch.toast.wrong'), 'bad');
          }
          setTimeout(function () {
            idx += 1;
            if (idx >= total) return ctx.finish(score, { points: score, total: total });
            render();
          }, 1000);
        }, 240);
      }

      window.addEventListener('i18n:change', function () {
        if (!locked && idx < total) render();
      });

      render();
    }
  };
}());
