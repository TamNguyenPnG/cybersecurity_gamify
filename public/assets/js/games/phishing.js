/* ============================================================
   Game 1 — Spot the phishing.

   A full email image. The player clicks the suspicious details; each
   correct click is ringed and pinned with a label. The point is awarded
   only when every hotspot has been found.

   Ends on: all found · timer expiry · the player pressing Next.
   ============================================================ */
GAMES.register('hotspot', function () {
  'use strict';

  var el = GAMES.el;

  return {
    mount: function (host, cfg, ctx) {
      GAMES.intro(host, cfg, ctx, function () { start(host, cfg, ctx); });
    }
  };

  function start(host, cfg, ctx) {
    var total = cfg.hotspots.length;
    var found = {};
    var misses = 0;
    var done = false;

    var wrap = el('div', 'hotspot-game');

    var bar = el('div', 'hotspot-bar');
    var counter = el('div', 'hotspot-counter');
    var nextBtn = el('button', 'btn btn-ghost btn-sm',
      UI.escape(ctx.t('game.next')));
    nextBtn.type = 'button';
    bar.appendChild(counter);
    bar.appendChild(nextBtn);
    wrap.appendChild(bar);

    /* The image and the click layer share one positioned box so hotspot
       rectangles stay accurate at any rendered size. */
    var stage = el('div', 'hotspot-stage');
    var img = document.createElement('img');
    img.className = 'hotspot-img';
    img.src = cfg.image;
    img.alt = ctx.pick(cfg.title);
    img.draggable = false;
    stage.appendChild(img);

    var layer = el('div', 'hotspot-layer');
    stage.appendChild(layer);
    wrap.appendChild(stage);

    var list = el('div', 'hotspot-list');
    wrap.appendChild(list);

    host.appendChild(wrap);

    function paint() {
      counter.innerHTML = UI.escape(
        ctx.t('game.found', { n: Object.keys(found).length, total: total }));
    }
    paint();

    stage.addEventListener('click', function (ev) {
      if (done) return;
      var box = img.getBoundingClientRect();
      var x = (ev.clientX - box.left) / box.width;
      var y = (ev.clientY - box.top) / box.height;

      for (var i = 0; i < cfg.hotspots.length; i++) {
        var h = cfg.hotspots[i];
        var r = h.rect;
        if (x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3]) {
          if (found[h.id]) return;
          found[h.id] = true;
          reveal(h);
          paint();
          if (Object.keys(found).length === total) finish(true);
          return;
        }
      }

      misses += 1;
      var dot = el('span', 'hotspot-miss');
      dot.style.left = (x * 100) + '%';
      dot.style.top = (y * 100) + '%';
      layer.appendChild(dot);
      setTimeout(function () { dot.remove(); }, 700);
    });

    function reveal(h) {
      var r = h.rect;
      var ring = el('span', 'hotspot-ring');
      ring.style.left = (r[0] * 100) + '%';
      ring.style.top = (r[1] * 100) + '%';
      ring.style.width = ((r[2] - r[0]) * 100) + '%';
      ring.style.height = ((r[3] - r[1]) * 100) + '%';
      layer.appendChild(ring);

      var row = el('div', 'hotspot-item');
      row.innerHTML =
        '<span class="hotspot-tick">&#10003;</span>' +
        '<span><strong>' + UI.escape(ctx.pick(h.label)) + '</strong>' +
        '<em>' + UI.escape(ctx.pick(h.why)) + '</em></span>';
      list.appendChild(row);
    }

    nextBtn.addEventListener('click', function () { finish(false); });

    ctx.setTimer(cfg.timeLimitS, function () { finish(false); });

    function finish(all) {
      if (done) return;
      done = true;
      ctx.clearTimer();

      /* Reveal anything still hidden so the game always teaches, even
         when the player runs out of time. */
      cfg.hotspots.forEach(function (h) {
        if (!found[h.id]) {
          var r = h.rect;
          var ring = el('span', 'hotspot-ring is-missed');
          ring.style.left = (r[0] * 100) + '%';
          ring.style.top = (r[1] * 100) + '%';
          ring.style.width = ((r[2] - r[0]) * 100) + '%';
          ring.style.height = ((r[3] - r[1]) * 100) + '%';
          layer.appendChild(ring);

          var row = el('div', 'hotspot-item is-missed');
          row.innerHTML =
            '<span class="hotspot-tick">&#215;</span>' +
            '<span><strong>' + UI.escape(ctx.pick(h.label)) + '</strong>' +
            '<em>' + UI.escape(ctx.pick(h.why)) + '</em></span>';
          list.appendChild(row);
        }
      });

      nextBtn.remove();
      var n = Object.keys(found).length;
      GAMES.outcome(
        host, ctx, all,
        all ? ctx.t('game.hotspot.win') : ctx.t('game.hotspot.miss'),
        ctx.t('game.hotspot.summary', { n: n, total: total }),
        function () {
          ctx.finish(all ? cfg.points : 0,
            { points: all ? cfg.points : 0, found: n, total: total, misses: misses });
        }
      );
    }
  }
}());
