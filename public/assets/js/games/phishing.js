/* ============================================================
   Game 1 — Spot the phishing.

   A full email image. The player clicks the suspicious details; each
   correct click is ringed and pinned with a label. The point is awarded
   only when every hotspot has been found.

   Ends on: all found · timer expiry · the player pressing Next.
   The closing dialog only says whether every sign was found — it never
   reveals what was missed, so a retry is a fresh test.
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

    var byId = {};
    cfg.hotspots.forEach(function (h) { byId[h.id] = h; });

    var wrap = el('div', 'hotspot-game');

    var bar = el('div', 'hotspot-bar');
    var counter = el('div', 'hotspot-counter');
    var nextBtn = el('button', 'btn btn-ghost btn-sm');
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

    /* Everything written in words, re-run whenever the language changes.
       The rings, the misses and the score are untouched. */
    ctx.live(function () {
      paint();
      img.alt = ctx.pick(cfg.title);
      nextBtn.innerHTML = UI.escape(ctx.t('game.next'));
      Array.prototype.forEach.call(list.children, function (row) {
        var h = byId[row.getAttribute('data-hs')];
        if (h) label(row, h);
      });
    });

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

    function label(row, h) {
      row.innerHTML =
        '<span class="hotspot-tick">&#10003;</span>' +
        '<span><strong>' + UI.escape(ctx.pick(h.label)) + '</strong>' +
        '<em>' + UI.escape(ctx.pick(h.why)) + '</em></span>';
    }

    function reveal(h) {
      var r = h.rect;
      var ring = el('span', 'hotspot-ring');
      ring.style.left = (r[0] * 100) + '%';
      ring.style.top = (r[1] * 100) + '%';
      ring.style.width = ((r[2] - r[0]) * 100) + '%';
      ring.style.height = ((r[3] - r[1]) * 100) + '%';
      layer.appendChild(ring);

      var row = el('div', 'hotspot-item');
      row.setAttribute('data-hs', h.id);
      label(row, h);
      list.appendChild(row);
    }

    nextBtn.addEventListener('click', function () { finish(false); });

    ctx.setTimer(cfg.timeLimitS, function () { finish(false); });

    function finish(all) {
      if (done) return;
      done = true;
      ctx.clearTimer();
      nextBtn.remove();
      var n = Object.keys(found).length;

      /* A short acknowledgement only — no score breakdown, and nothing
         that hints at how many signs are left. */
      GAMES.outcome(
        host, ctx, all,
        function () {
          return ctx.t(all ? 'game.hotspot.win' : 'game.hotspot.miss');
        },
        null,
        function () {
          ctx.finish(all ? cfg.points : 0,
            { points: all ? cfg.points : 0, found: n, total: total, misses: misses });
        }
      );
    }
  }
}());
