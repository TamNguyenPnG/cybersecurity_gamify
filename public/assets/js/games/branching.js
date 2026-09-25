/* ============================================================
   Game 3 — What would you do?

   A three-slide branching story between two colleagues. Every choice
   advances the story; a wrong choice explains why before moving on.
   The point is awarded only for a clean sweep.
   ============================================================ */
GAMES.register('story', function () {
  'use strict';

  var el = GAMES.el;

  return {
    mount: function (host, cfg, ctx) {
      GAMES.intro(host, cfg, ctx, function () { start(host, cfg, ctx); });
    }
  };

  function start(host, cfg, ctx) {
    var idx = 0;
    var answers = [];
    var view = null;      // what is on screen right now, for re-labelling

    var wrap = el('div', 'story-game');
    var stage = el('div', 'story-stage');
    stage.innerHTML =
      '<div class="story-cast">' +
        '<div class="story-figure is-a"><span>&#128105;&#8205;&#128188;</span></div>' +
        '<div class="story-figure is-b"><span>&#128104;&#8205;&#128187;</span></div>' +
      '</div>' +
      '<div class="story-bubble" id="storyBubble"></div>';
    wrap.appendChild(stage);

    var panel = el('div', 'story-panel');
    wrap.appendChild(panel);
    host.appendChild(wrap);

    var bubble = stage.querySelector('#storyBubble');

    function render() {
      if (idx >= cfg.slides.length) return finish();

      var s = cfg.slides[idx];

      panel.innerHTML = '';
      var step = el('div', 'story-step');
      panel.appendChild(step);
      var question = el('h3', 'story-question');
      panel.appendChild(question);

      var opts = el('div', 'story-options');
      var buttons = [];
      GAMES.shuffle(s.options).forEach(function (o) {
        var b = el('button', 'story-option');
        b.type = 'button';
        b.addEventListener('click', function () { choose(s, o, opts, b); });
        opts.appendChild(b);
        buttons.push({ el: b, option: o });
      });
      panel.appendChild(opts);

      /* Held so a language change can rewrite the words in place; the
         option order, the disabled states and the choice all survive. */
      view = {
        slide: s, step: step, question: question, buttons: buttons,
        feedback: null, next: null, chosen: null
      };
      paint();
    }

    /* Rewrites every visible string from the current language. */
    function paint() {
      if (!view) return;
      var s = view.slide;

      if (view.done) {
        bubble.innerHTML = '<p>' + UI.escape(ctx.t(
          view.allRight ? 'game.story.winScene' : 'game.story.missScene')) + '</p>';
        return;
      }

      bubble.innerHTML =
        '<div class="story-speaker">' + UI.escape(ctx.pick(s.speaker)) + '</div>' +
        '<p>' + UI.escape(ctx.pick(s.scene)) + '</p>';

      view.step.innerHTML = UI.escape(
        ctx.t('game.card', { n: idx + 1, total: cfg.slides.length }));
      view.question.innerHTML = UI.escape(ctx.pick(s.question));
      view.buttons.forEach(function (b) {
        b.el.innerHTML = UI.escape(ctx.pick(b.option));
      });

      if (view.feedback && view.chosen) {
        var o = view.chosen;
        view.feedback.innerHTML =
          '<strong>' + UI.escape(ctx.t(o.correct
            ? 'game.story.right' : 'game.story.wrong')) + '</strong>' +
          '<p>' + UI.escape(ctx.pick({ vi: o.fbVi, en: o.fbEn })) + '</p>';
      }
      if (view.next) {
        view.next.innerHTML = UI.escape(idx === cfg.slides.length - 1
          ? ctx.t('game.finish') : ctx.t('game.continue'));
      }
    }
    ctx.live(paint);

    function choose(slide, option, optsEl, btn) {
      Array.prototype.forEach.call(optsEl.children, function (c) {
        c.disabled = true;
        c.classList.add('is-spent');
      });
      btn.classList.remove('is-spent');
      btn.classList.add(option.correct ? 'is-correct' : 'is-wrong');

      answers.push({ slide: slide.id, option: option.id, correct: !!option.correct });

      var fb = el('div', 'story-feedback ' + (option.correct ? 'is-ok' : 'is-bad'));
      panel.appendChild(fb);

      var next = el('button', 'btn btn-primary');
      next.type = 'button';
      next.addEventListener('click', function () { idx += 1; render(); });
      panel.appendChild(next);

      view.feedback = fb;
      view.next = next;
      view.chosen = option;
      paint();
    }

    function finish() {
      var right = answers.filter(function (a) { return a.correct; }).length;
      var all = right === cfg.slides.length;

      view = { done: true, allRight: all };
      paint();
      panel.innerHTML = '';

      GAMES.outcome(
        panel, ctx, all,
        function () { return ctx.t(all ? 'game.story.win' : 'game.story.miss'); },
        function () {
          return ctx.t('game.story.summary', { n: right, total: cfg.slides.length });
        },
        function () {
          ctx.finish(all ? cfg.points : 0,
            { points: all ? cfg.points : 0, correct: right,
              total: cfg.slides.length, answers: answers });
        }
      );
    }

    render();
  }
}());
