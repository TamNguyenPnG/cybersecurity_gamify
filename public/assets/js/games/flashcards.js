/* ============================================================
   Safe / unsafe flashcards.

  Players swipe each statement left for unsafe or right for safe.
   ============================================================ */
GAMES.register('flashcards', function () {
  'use strict';

  var el = GAMES.el;

  return {
    mount: function (host, cfg, ctx) {
      GAMES.intro(host, cfg, ctx, function () { start(host, cfg, ctx); });
    }
  };

  function start(host, cfg, ctx) {
    var cards = GAMES.shuffle(cfg.cards);
    var index = 0;
    var correct = 0;
    var locked = false;
    var liveCard = null;

    var wrap = el('div', 'flashcards-game');
    var counter = el('div', 'hotspot-counter flashcards-counter');
    var board = el('div', 'flashcards-board');
    var instructions = el('div', 'flashcards-instructions');
    var unsafeHint = el('span', 'flashcard-instruction is-unsafe');
    var safeHint = el('span', 'flashcard-instruction is-safe');
    var unsafeCopy = el('span');
    var safeCopy = el('span');
    unsafeHint.innerHTML = '<span aria-hidden="true">&#8592; &#9888;</span>';
    safeHint.innerHTML = '<span aria-hidden="true">&#10003; &#8594;</span>';
    unsafeHint.appendChild(unsafeCopy);
    safeHint.appendChild(safeCopy);
    instructions.appendChild(unsafeHint);
    instructions.appendChild(safeHint);

    var card = el('article', 'flashcard');
    card.tabIndex = 0;
    card.setAttribute('role', 'group');
    board.appendChild(card);

    var feedback = el('p', 'flashcards-feedback');
    feedback.setAttribute('aria-live', 'polite');
    var feedbackLine = el('div', 'flashcards-feedbackline');
    feedbackLine.setAttribute('aria-hidden', 'true');
    wrap.appendChild(counter);
    wrap.appendChild(instructions);
    wrap.appendChild(board);
    wrap.appendChild(feedbackLine);
    wrap.appendChild(feedback);
    host.appendChild(wrap);

    function paint() {
      counter.textContent = ctx.t('game.card', { n: Math.min(index + 1, cards.length), total: cards.length });
      unsafeCopy.textContent = ctx.t('game.flashcards.left');
      safeCopy.textContent = ctx.t('game.flashcards.right');
      if (liveCard) card.textContent = ctx.pick(liveCard);
    }

    ctx.live(paint);

    function choose(zone) {
      if (locked || index >= cards.length) return;
      locked = true;
      var item = cards[index];
      var isCorrect = zone === item.zone;
      var isSafe = zone === 'safe';
      if (isCorrect) correct += 1;

      card.classList.add(isSafe ? 'fly-right' : 'fly-left');
      card.classList.add(isSafe ? 'is-safe-swipe' : 'is-risk-swipe');
      card.classList.add(isCorrect ? 'is-correct' : 'is-incorrect');
      feedbackLine.classList.add(isSafe ? 'is-safe' : 'is-risk');
      feedback.classList.toggle('is-correct', isCorrect);
      feedback.classList.toggle('is-incorrect', !isCorrect);
      feedback.textContent = ctx.t(isCorrect ? 'game.flashcards.correct' : 'game.flashcards.incorrect');

      setTimeout(function () {
        index += 1;
        if (index >= cards.length) {
          wrap.remove();
          return finish();
        }
        card.className = 'flashcard';
        card.style.transform = '';
        card.style.left = '';
        card.style.removeProperty('--drag-x');
        card.textContent = '';
        feedbackLine.className = 'flashcards-feedbackline';
        feedback.textContent = '';
        feedback.className = 'flashcards-feedback';
        locked = false;
        liveCard = cards[index];
        paint();
      }, 600);
    }

    var dragStart = null;
    function boundedDistance(distance) {
      var max = Math.max(0, (board.clientWidth - card.offsetWidth) / 2 - 8);
      return Math.max(-max, Math.min(max, distance));
    }

    card.addEventListener('pointerdown', function (event) {
      if (locked) return;
      event.preventDefault();
      dragStart = event.clientX;
      card.setPointerCapture(event.pointerId);
      card.classList.add('is-dragging');
    });
    card.addEventListener('pointermove', function (event) {
      if (dragStart == null || locked) return;
      var distance = boundedDistance(event.clientX - dragStart);
      card.style.setProperty('--drag-x', distance + 'px');
      card.classList.toggle('is-risk-swipe', distance < -20);
      card.classList.toggle('is-safe-swipe', distance > 20);
      feedbackLine.classList.toggle('is-risk', distance < -20);
      feedbackLine.classList.toggle('is-safe', distance > 20);
    });
    card.addEventListener('pointerup', function (event) {
      if (dragStart == null || locked) return;
      var distance = boundedDistance(event.clientX - dragStart);
      dragStart = null;
      card.classList.remove('is-dragging');
      if (Math.abs(distance) < 60) {
        card.style.removeProperty('--drag-x');
        card.classList.remove('is-risk-swipe', 'is-safe-swipe');
        feedbackLine.className = 'flashcards-feedbackline';
        return;
      }
      choose(distance > 0 ? 'safe' : 'unsafe');
    });
    card.addEventListener('pointercancel', function () {
      dragStart = null;
      card.classList.remove('is-dragging', 'is-risk-swipe', 'is-safe-swipe');
      card.style.removeProperty('--drag-x');
      feedbackLine.className = 'flashcards-feedbackline';
    });
    card.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowLeft') choose('unsafe');
      if (event.key === 'ArrowRight') choose('safe');
    });

    liveCard = cards[index];
    paint();

    function finish() {
      var allCorrect = correct === cards.length;
      var points = cfg.scoring === 'all' ? (allCorrect ? cfg.points : 0) : correct;
      GAMES.outcome(
        host, ctx, allCorrect,
        function () {
          return ctx.t(allCorrect ? 'game.flashcards.win' : 'game.flashcards.miss', {
            correct: correct, total: cards.length
          });
        },
        null,
        function () {
          ctx.finish(points, { points: points, correct: correct, total: cards.length });
        }
      );
    }
  }
}());