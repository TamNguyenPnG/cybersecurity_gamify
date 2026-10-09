/* ============================================================
   Quiz game — one point per correct answer.

   Used two ways:
   - the chapter fallback: wraps content/questions/chapter-0N.json;
   - a configured game with its own `questions`, which may add
       scoring: "all" the whole game is worth `points`, awarded only when
                       every question is answered correctly
       title / brief   an intro panel before the first question
       image           artwork shown on the intro and beside each question;
                       a string, or { en, vi } when the art contains text
       count           ask a random N of the questions each play
       timePerQuestionS  seconds allowed per question; running out counts
                       as a wrong answer

   Incorrect answers glow red but are never revealed. Switching language
   relabels the card in place, so an answer already given is not undone.
   ============================================================ */
GAMES.register('quiz', function () {
  'use strict';

  var el = GAMES.el;

  return {
    mount: function (host, cfg, ctx) {
      if (!cfg.title) return play(host, cfg, ctx);

      GAMES.intro(host, cfg, ctx, function () { play(host, cfg, ctx); });
      if (cfg.image) {
        var intro = host.querySelector('.game-intro');
        var pic = el('img', 'game-intro-art');
        pic.alt = '';
        ctx.live(function () { pic.src = ctx.pick(cfg.image); });
        intro.insertBefore(pic, intro.firstChild);
      }
    }
  };

  function play(host, cfg, ctx) {
      var items = cfg.questions || [];
      if (cfg.count) items = GAMES.shuffle(items).slice(0, cfg.count);
      var total = items.length;
      var idx = 0, score = 0, locked = false;
      var limit = cfg.timePerQuestionS || 0;

      /* Option order is decided once, in terms of ORIGINAL indices, so
         switching language relabels without moving the correct answer. */
      var plan = items.map(function (item) {
        return GAMES.shuffle(item.en.o.map(function (_, i) { return i; }));
      });

      var card = el('div', 'glass quiz-card');
      if (cfg.image) {
        var split = el('div', 'quiz-split');
        var art = el('img', 'quiz-art');
        art.alt = '';
        ctx.live(function () { art.src = ctx.pick(cfg.image); });
        split.appendChild(art);
        split.appendChild(card);
        host.appendChild(split);
      } else {
        host.appendChild(card);
      }

      var view = null;

      function lang() { return (window.I18N && window.I18N.lang) || ctx.lang; }

      function render() {
        locked = false;
        var item = items[idx];

        card.innerHTML = '';
        if (limit) {
          var bar = el('div', 'quiz-timebar');
          var fill = el('span');
          fill.style.animationDuration = limit + 's';
          bar.appendChild(fill);
          card.appendChild(bar);
        }
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

        view = { item: item, counter: counter, q: q, buttons: buttons, note: note, answers: answers };
        paint();

        if (limit) ctx.setTimer(limit, timeUp);
      }

      function next() {
        idx += 1;
        if (idx >= total) {
          var all = score === total;
          var pts = cfg.scoring === 'all' ? (all ? cfg.points : 0) : score;
          var detail = { points: pts, correct: score, total: total };
          if (cfg.scoring !== 'all') return ctx.finish(pts, detail);
          return showResult(all, pts, detail);
        }
        render();
      }

      /* Popup over the page so its Next button is always in view. */
      function showResult(all, pts, detail) {
        var modal = el('div', 'game-modal');
        (document.getElementById('chapterPage') || document.body).appendChild(modal);
        GAMES.outcome(
          modal, ctx, all,
          function () { return ctx.t(all ? 'game.quiz.win' : 'game.quiz.miss', { n: pts }); },
          function () { return ctx.t('game.quiz.summary', { n: detail.correct, total: detail.total }); },
          function () { modal.remove(); ctx.finish(pts, detail); }
        );
      }

      /* Out of time: counts as a wrong answer. */
      function timeUp() {
        if (locked) return;
        locked = true;
        Array.prototype.forEach.call(view.answers.children, function (n) { n.disabled = true; });
        UI.toast(ctx.t('ch.toast.timeUp'), 'bad');
        setTimeout(next, 1000);
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
        ctx.clearTimer();
        Array.prototype.forEach.call(answers.children, function (n) { n.disabled = true; });
        btn.classList.add('selected');

        setTimeout(function () {
          btn.classList.remove('selected');
          btn.classList.add(correct ? 'correct' : 'incorrect');
          if (correct) {
            score += 1;
            if (cfg.scoring !== 'all') ctx.progress(score);
            UI.toast(ctx.t('ch.toast.correct'), 'ok');
          } else {
            UI.toast(ctx.t('ch.toast.wrong'), 'bad');
          }
          setTimeout(next, 1000);
        }, 240);
      }

      render();
  }
}());
