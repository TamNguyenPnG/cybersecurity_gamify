/* ============================================================
   Game 2 — Safe or unsafe?

   Statements fall from the top one at a time. The player drags each card
   into "Recommend" (left) or "Ban" (right). A card that reaches the
   bottom counts as missed. All six correct scores the point.

   When the last card settles a single dialog closes the game; the correct
   sorting is never shown, so a retry stays a real test.

   Motion is driven by requestAnimationFrame rather than a CSS transition
   so the fall can be paused mid-drag and resumed from the same position.
   ============================================================ */
GAMES.register('sort', function () {
  'use strict';

  var el = GAMES.el;

  return {
    mount: function (host, cfg, ctx) {
      GAMES.intro(host, cfg, ctx, function () { start(host, cfg, ctx); });
    }
  };

  function start(host, cfg, ctx) {
    var queue = GAMES.shuffle(cfg.statements);
    var results = [];
    var idx = 0;
    var raf = null;

    var wrap = el('div', 'sort-game');

    var bar = el('div', 'sort-bar');
    var counter = el('div', 'hotspot-counter');
    bar.appendChild(counter);
    wrap.appendChild(bar);

    var arena = el('div', 'sort-arena');

    var zoneSafe = el('div', 'sort-zone is-safe');
    var zoneUnsafe = el('div', 'sort-zone is-unsafe');

    function zoneText(node, z, icon) {
      node.innerHTML =
        '<div class="sort-zone-icon">' + icon + '</div>' +
        '<div class="sort-zone-label">' + UI.escape(ctx.pick(z.label)) + '</div>' +
        '<div class="sort-zone-hint">' + UI.escape(ctx.pick(z.hint)) + '</div>';
    }

    var lane = el('div', 'sort-lane');

    arena.appendChild(zoneSafe);
    arena.appendChild(lane);
    arena.appendChild(zoneUnsafe);
    wrap.appendChild(arena);

    var tally = el('div', 'sort-tally');
    wrap.appendChild(tally);

    host.appendChild(wrap);

    function paint() {
      counter.innerHTML = UI.escape(
        ctx.t('game.card', { n: Math.min(idx + 1, queue.length), total: queue.length }));
    }

    function cardText(card, stmt) {
      card.innerHTML = '<p>' + UI.escape(ctx.pick(stmt)) + '</p>' +
        '<div class="sort-card-keys">' +
        '<span>&#8592; ' + UI.escape(ctx.pick(cfg.zones.safe.label)) + '</span>' +
        '<span>' + UI.escape(ctx.pick(cfg.zones.unsafe.label)) + ' &#8594;</span>' +
        '</div>';
    }

    /* Re-label on a language change. The card keeps falling from exactly
       where it was — only its words are swapped. */
    var liveCard = null;
    ctx.live(function () {
      zoneText(zoneSafe, cfg.zones.safe, '&#128077;');
      zoneText(zoneUnsafe, cfg.zones.unsafe, '&#129399;');
      paint();
      if (liveCard) cardText(liveCard.el, liveCard.stmt);
    });

    function record(stmt, chosen) {
      var ok = chosen === stmt.zone;
      results.push({ id: stmt.id, chosen: chosen, correct: ok });
      var chip = el('span', 'sort-chip ' + (ok ? 'is-ok' : 'is-bad'),
        ok ? '&#10003;' : '&#215;');
      tally.appendChild(chip);
    }

    function nextCard() {
      if (idx >= queue.length) return finish();
      paint();

      var stmt = queue[idx];
      var card = el('div', 'sort-card');
      cardText(card, stmt);
      liveCard = { el: card, stmt: stmt };
      lane.appendChild(card);

      var laneBox = lane.getBoundingClientRect();
      var travel = Math.max(laneBox.height - card.offsetHeight - 8, 40);
      var duration = (cfg.fallSeconds || 16) * 1000;
      var startTs = null;
      var elapsed = 0;
      var dragging = false;
      var settled = false;
      var dragDX = 0;
      var dragDY = 0;
      var originX = 0;
      var originY = 0;

      function position() {
        var y = (elapsed / duration) * travel;
        card.style.transform =
          'translate(' + dragDX + 'px, ' + (y + dragDY) + 'px)' +
          (dragging ? ' rotate(' + (dragDX / 28) + 'deg)' : '');
        return y;
      }

      function frame(ts) {
        if (settled) return;
        if (startTs == null) startTs = ts;
        if (!dragging) elapsed = Math.min(elapsed + (ts - startTs), duration);
        startTs = ts;
        position();
        if (elapsed >= duration && !dragging) return settle(null);
        raf = requestAnimationFrame(frame);
      }
      raf = requestAnimationFrame(frame);

      function settle(chosen) {
        if (settled) return;
        settled = true;
        if (raf) cancelAnimationFrame(raf);
        if (liveCard && liveCard.el === card) liveCard = null;

        var ok = chosen === stmt.zone;
        card.classList.add(chosen == null ? 'is-missed' : (ok ? 'is-ok' : 'is-bad'));
        if (chosen === 'safe') card.classList.add('fly-left');
        if (chosen === 'unsafe') card.classList.add('fly-right');

        record(stmt, chosen);
        setTimeout(function () {
          card.remove();
          idx += 1;
          nextCard();
        }, 420);
      }

      /* --- dragging --- */
      card.addEventListener('pointerdown', function (ev) {
        if (settled) return;
        dragging = true;
        originX = ev.clientX;
        originY = ev.clientY;
        card.setPointerCapture(ev.pointerId);
        card.classList.add('is-dragging');
      });

      card.addEventListener('pointermove', function (ev) {
        if (!dragging || settled) return;
        dragDX = ev.clientX - originX;
        dragDY = ev.clientY - originY;
        position();
      });

      function release(ev) {
        if (!dragging || settled) return;
        dragging = false;
        card.classList.remove('is-dragging');

        var cardBox = card.getBoundingClientRect();
        var cx = cardBox.left + cardBox.width / 2;
        var safeBox = zoneSafe.getBoundingClientRect();
        var unsafeBox = zoneUnsafe.getBoundingClientRect();

        if (cx <= safeBox.right) return settle('safe');
        if (cx >= unsafeBox.left) return settle('unsafe');

        /* Dropped in the middle — snap back and keep falling. */
        dragDX = 0; dragDY = 0;
        position();
        startTs = null;
        raf = requestAnimationFrame(frame);
      }
      card.addEventListener('pointerup', release);
      card.addEventListener('pointercancel', release);

      /* Keyboard and click fallback, so the game is playable without
         a pointer drag. */
      function zoneClick(zone) {
        return function () { if (!settled) settle(zone); };
      }
      zoneSafe.onclick = zoneClick('safe');
      zoneUnsafe.onclick = zoneClick('unsafe');
    }

    function finish() {
      zoneSafe.onclick = null;
      zoneUnsafe.onclick = null;

      var right = results.filter(function (r) { return r.correct; }).length;
      var all = right === queue.length;

      /* A short acknowledgement only — no answer key and no tally. */
      GAMES.outcome(
        host, ctx, all,
        function () { return ctx.t(all ? 'game.sort.win' : 'game.sort.miss'); },
        null,
        function () {
          ctx.finish(all ? cfg.points : 0,
            { points: all ? cfg.points : 0, correct: right, total: queue.length,
              answers: results });
        }
      );
    }

    nextCard();
  }
}());
