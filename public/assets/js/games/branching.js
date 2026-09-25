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
      bubble.innerHTML =
        '<div class="story-speaker">' + UI.escape(ctx.pick(s.speaker)) + '</div>' +
        '<p>' + UI.escape(ctx.pick(s.scene)) + '</p>';

      panel.innerHTML = '';
      panel.appendChild(el('div', 'story-step',
        UI.escape(ctx.t('game.card', { n: idx + 1, total: cfg.slides.length }))));
      panel.appendChild(el('h3', 'story-question', UI.escape(ctx.pick(s.question))));

      var opts = el('div', 'story-options');
      GAMES.shuffle(s.options).forEach(function (o) {
        var b = el('button', 'story-option', UI.escape(ctx.pick(o)));
        b.type = 'button';
        b.addEventListener('click', function () { choose(s, o, opts, b); });
        opts.appendChild(b);
      });
      panel.appendChild(opts);
    }

    function choose(slide, option, optsEl, btn) {
      Array.prototype.forEach.call(optsEl.children, function (c) {
        c.disabled = true;
        c.classList.add('is-spent');
      });
      btn.classList.remove('is-spent');
      btn.classList.add(option.correct ? 'is-correct' : 'is-wrong');

      answers.push({ slide: slide.id, option: option.id, correct: !!option.correct });

      var fb = el('div', 'story-feedback ' + (option.correct ? 'is-ok' : 'is-bad'));
      fb.innerHTML =
        '<strong>' + UI.escape(option.correct
          ? ctx.t('game.story.right') : ctx.t('game.story.wrong')) + '</strong>' +
        '<p>' + UI.escape(ctx.lang === 'vi' ? option.fbVi : option.fbEn) + '</p>';
      panel.appendChild(fb);

      var next = el('button', 'btn btn-primary',
        UI.escape(idx === cfg.slides.length - 1
          ? ctx.t('game.finish') : ctx.t('game.continue')));
      next.type = 'button';
      next.addEventListener('click', function () { idx += 1; render(); });
      panel.appendChild(next);
    }

    function finish() {
      var right = answers.filter(function (a) { return a.correct; }).length;
      var all = right === cfg.slides.length;

      bubble.innerHTML = '<p>' + UI.escape(all
        ? ctx.t('game.story.winScene') : ctx.t('game.story.missScene')) + '</p>';
      panel.innerHTML = '';

      GAMES.outcome(
        panel, ctx, all,
        all ? ctx.t('game.story.win') : ctx.t('game.story.miss'),
        ctx.t('game.story.summary', { n: right, total: cfg.slides.length }),
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
