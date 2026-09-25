/* ============================================================
   Fallback game — the classic 5-question quiz.

   Chapters 2–4 have no custom mini-games yet, so the host falls back to
   this: it wraps the whole bilingual question file from
   content/questions/chapter-0N.json as a single "game" worth one point
   per question. Incorrect answers glow red but are never revealed.
   Switching language relabels the card in place, so an answer already
   given is not undone.
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

      var view = null;

      function lang() { return (window.I18N && window.I18N.lang) || ctx.lang; }

      function render() {
        locked = false;
        var item = items[idx];

        card.innerHTML = '';
        var counter = el('span', 't-overline');
        card.appendChild(counter);
        var q = el('h2', 't-h3 quiz-q');
        card.appendChild(q);

        var answers = el('div', 'answers');
        var buttons = [];
        plan[idx].forEach(function (orig, i) {
          var b = el('button', 'answer');
          b.type = 'button';
          b.addEventListener('click', function () {
            choose(answers, b, orig === Number(item.answer));
          });
          answers.appendChild(b);
          buttons.push({ el: b, orig: orig, key: String.fromCharCode(65 + i) });
        });
        card.appendChild(answers);

        var note = el('p', 't-caption quiz-note');
        card.appendChild(note);

        view = { item: item, counter: counter, q: q, buttons: buttons, note: note };
        paint();
      }

      /* Relabels what is on screen. Disabled states, the selection and the
         correct/incorrect glow all survive a language change. */
      function paint() {
        if (!view) return;
        var loc = view.item[lang()] || view.item.en;
        view.counter.innerHTML = UI.escape(ctx.t('ch.counter', { n: idx + 1, total: total }));
        view.q.innerHTML = UI.escape(loc.q);
        view.buttons.forEach(function (b) {
          b.el.innerHTML = '<span class="key">' + b.key + '</span>' +
            '<span>' + UI.escape(loc.o[b.orig]) + '</span>';
        });
        view.note.innerHTML = UI.escape(ctx.t('ch.answersNote'));
      }
      ctx.live(paint);

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

      render();
    }
  };
}());
