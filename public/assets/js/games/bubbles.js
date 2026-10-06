/* ============================================================
   Game — Safe Action bubbles.

   Bubbles drift inside a rectangular frame, bouncing off the walls and
   off each other like billiard balls. Each one carries a label. Popping a
   Safe Action sets off fireworks; popping a Cyber Risk sets off a bomb and
   costs a life. Pop every Safe Action before lives or time run out to score.

   Each label appears on exactly one bubble and never comes back once
   popped, so a player cannot farm a known keyword for points.
   ============================================================ */
GAMES.register('bubbles', function () {
  'use strict';

  var el = GAMES.el;
  var REDUCED = !!(window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var HUES = [188, 202, 216, 230, 246];
  var SPARKS = ['#22D3EE', '#38BDF8', '#60A5FA', '#818CF8', '#FCD34D', '#34D399', '#FFFFFF'];
  var FIRE = ['#FF5A1F', '#FFB020', '#FF2D2D', '#FFE08A'];

  return {
    mount: function (host, cfg, ctx) {
      GAMES.intro(host, cfg, ctx, function () { start(host, cfg, ctx); });
    }
  };

  function start(host, cfg, ctx) {
    var maxLives = cfg.lives || 3;
    var pool = [];
    (cfg.safe || []).forEach(function (s) { pool.push({ id: s.id, safe: true, label: s.label }); });
    (cfg.risks || []).forEach(function (r) { pool.push({ id: r.id, safe: false, label: r.label }); });
    var goal = (cfg.safe || []).length;

    var collected = 0;
    var lives = maxLives;
    var hits = [];
    var bubbles = [];
    var particles = [];
    var over = false;
    var W = 0, H = 0, R = 50;

    var wrap = el('div', 'bubble-game');

    var bar = el('div', 'bubble-bar');
    var counter = el('div', 'hotspot-counter');
    var heartsEl = el('div', 'bubble-lives');
    bar.appendChild(counter);
    bar.appendChild(heartsEl);
    wrap.appendChild(bar);

    var arena = el('div', 'bubble-arena');
    var canvas = document.createElement('canvas');
    canvas.className = 'bubble-fx';
    arena.appendChild(canvas);
    wrap.appendChild(arena);
    host.appendChild(wrap);

    var fx = canvas.getContext('2d');
    var dpr = window.devicePixelRatio || 1;

    function measure() {
      var r = arena.getBoundingClientRect();
      W = r.width;
      H = r.height;
      R = Math.max(36, Math.min(58, W / 11));
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
      fx.setTransform(dpr, 0, 0, dpr, 0, 0);
      bubbles.forEach(function (b) { setSize(b); });
    }

    function setSize(b) {
      b.r = R;
      b.el.style.width = (R * 2) + 'px';
      b.el.style.height = (R * 2) + 'px';
    }

    window.addEventListener('resize', measure);

    /* ---------- words (re-run on every language change) ---------- */
    function paintHud() {
      counter.innerHTML = UI.escape(ctx.t('game.bubbles.collected', { n: collected, goal: goal }));
      var s = '';
      for (var i = 0; i < maxLives; i++) s += i < lives ? '\u2764\uFE0F' : '\uD83D\uDDA4';
      heartsEl.textContent = s;
      heartsEl.setAttribute('aria-label', ctx.t('game.bubbles.livesAria'));
    }

    function paintBubble(b) {
      b.face.textContent = ctx.pick(b.item.label);
    }

    ctx.live(function () {
      paintHud();
      bubbles.forEach(paintBubble);
    });

    /* ---------- spawning ---------- */
    function spawn(item) {
      var x = R, y = R;
      for (var tries = 0; tries < 40; tries++) {
        x = R + Math.random() * Math.max(W - 2 * R, 1);
        y = R + Math.random() * Math.max(H - 2 * R, 1);
        var clear = bubbles.every(function (o) {
          var dx = o.x - x, dy = o.y - y;
          return Math.sqrt(dx * dx + dy * dy) > o.r + R + 4;
        });
        if (clear) break;
      }

      var angle = Math.random() * Math.PI * 2;
      var speed = 70 + Math.random() * 60;

      var btn = el('button', 'bubble');
      btn.type = 'button';
      var face = el('span', 'bubble-face');
      face.style.setProperty('--h', HUES[Math.floor(Math.random() * HUES.length)]);
      btn.appendChild(face);
      arena.appendChild(btn);

      var b = {
        x: x, y: y, r: R,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        item: item, el: btn, face: face
      };
      btn._bubble = b;
      setSize(b);
      paintBubble(b);
      bubbles.push(b);
      place(b);
    }

    function place(b) {
      b.el.style.transform = 'translate(' + (b.x - b.r) + 'px,' + (b.y - b.r) + 'px)';
    }

    /* ---------- physics ---------- */
    function collide(a, b) {
      var dx = b.x - a.x, dy = b.y - a.y;
      var d = Math.sqrt(dx * dx + dy * dy);
      var min = a.r + b.r;
      if (d >= min) return;
      if (d === 0) { dx = 1; dy = 0; d = 1; }

      var nx = dx / d, ny = dy / d;
      var push = (min - d) / 2;
      a.x -= nx * push; a.y -= ny * push;
      b.x += nx * push; b.y += ny * push;

      var vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (vn > 0) return;             // already separating

      var ma = a.r * a.r, mb = b.r * b.r;
      var j = (-2 * vn) / (1 / ma + 1 / mb);
      a.vx -= (j * nx) / ma; a.vy -= (j * ny) / ma;
      b.vx += (j * nx) / mb; b.vy += (j * ny) / mb;
    }

    function step(dt) {
      var i, j, b;
      for (i = 0; i < bubbles.length; i++) {
        b = bubbles[i];
        b.x += b.vx * dt;
        b.y += b.vy * dt;
      }
      for (i = 0; i < bubbles.length; i++) {
        for (j = i + 1; j < bubbles.length; j++) collide(bubbles[i], bubbles[j]);
      }
      for (i = 0; i < bubbles.length; i++) {
        b = bubbles[i];
        if (b.x - b.r < 0)  { b.x = b.r;     b.vx =  Math.abs(b.vx); }
        if (b.x + b.r > W)  { b.x = W - b.r; b.vx = -Math.abs(b.vx); }
        if (b.y - b.r < 0)  { b.y = b.r;     b.vy =  Math.abs(b.vy); }
        if (b.y + b.r > H)  { b.y = H - b.r; b.vy = -Math.abs(b.vy); }

        /* Keep them lively without letting collisions speed them up. */
        var sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy) || 1;
        var clamped = Math.max(55, Math.min(sp, 150));
        if (clamped !== sp) { b.vx *= clamped / sp; b.vy *= clamped / sp; }
        place(b);
      }
    }

    /* ---------- effects ---------- */
    function sparks(x, y, n, colours) {
      for (var i = 0; i < n; i++) {
        var a = (Math.PI * 2 * i) / n + Math.random() * 0.25;
        var sp = 1.6 + Math.random() * 3.6;
        particles.push({
          kind: 'dot', glow: true, x: x, y: y,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 0.05,
          life: 1, decay: 0.014 + Math.random() * 0.014,
          colour: colours[Math.floor(Math.random() * colours.length)],
          size: 1.5 + Math.random() * 2
        });
      }
    }

    function ring(x, y, colour, maxR) {
      particles.push({ kind: 'ring', x: x, y: y, radius: 6, maxR: maxR, life: 1, decay: 0.045, colour: colour });
    }

    function fireworks(x, y) {
      if (REDUCED) return;
      ring(x, y, '#FCD34D', 70);
      sparks(x, y, 44, SPARKS);
      setTimeout(function () { sparks(x - 28, y - 18, 28, SPARKS); }, 140);
      setTimeout(function () { sparks(x + 30, y - 26, 28, SPARKS); }, 280);
    }

    function bomb(x, y) {
      if (REDUCED) return;
      ring(x, y, '#FF5A1F', 110);
      sparks(x, y, 38, FIRE);
      for (var i = 0; i < 16; i++) {
        particles.push({
          kind: 'dot', glow: false, x: x + (Math.random() - 0.5) * 24, y: y + (Math.random() - 0.5) * 24,
          vx: (Math.random() - 0.5) * 1.6, vy: -0.4 - Math.random() * 1.1, g: -0.004,
          life: 0.8, decay: 0.012 + Math.random() * 0.01,
          colour: '#3A3F4B', size: 7 + Math.random() * 8
        });
      }
      arena.classList.remove('is-shake');
      void arena.offsetWidth;
      arena.classList.add('is-shake');
    }

    function floater(x, y, text, cls) {
      var n = el('span', 'bubble-float ' + cls);
      n.textContent = text;
      n.style.left = Math.max(90, Math.min(x, W - 90)) + 'px';
      n.style.top = y + 'px';
      arena.appendChild(n);
      setTimeout(function () { n.remove(); }, 1100);
    }

    function boom(x, y) {
      var n = el('span', 'bubble-boom', '\uD83D\uDCA5');
      n.style.left = x + 'px';
      n.style.top = y + 'px';
      arena.appendChild(n);
      setTimeout(function () { n.remove(); }, 700);
    }

    function draw(k) {
      fx.clearRect(0, 0, W, H);
      for (var i = particles.length - 1; i >= 0; i--) {
        var p = particles[i];
        p.life -= p.decay * k;
        if (p.life <= 0) { particles.splice(i, 1); continue; }

        if (p.kind === 'ring') {
          p.radius += (p.maxR - p.radius) * 0.18 * k;
          fx.globalCompositeOperation = 'lighter';
          fx.globalAlpha = Math.max(p.life, 0);
          fx.strokeStyle = p.colour;
          fx.lineWidth = 3;
          fx.beginPath();
          fx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          fx.stroke();
          continue;
        }

        p.x += p.vx * k;
        p.y += p.vy * k;
        p.vy += p.g * k;
        p.vx *= 0.99;
        fx.globalCompositeOperation = p.glow ? 'lighter' : 'source-over';
        fx.globalAlpha = Math.max(p.life, 0) * (p.glow ? 1 : 0.55);
        fx.fillStyle = p.colour;
        fx.beginPath();
        fx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        fx.fill();
      }
      fx.globalAlpha = 1;
      fx.globalCompositeOperation = 'source-over';
    }

    /* ---------- loop ---------- */
    var last = null;
    function frame(ts) {
      if (!wrap.isConnected) { window.removeEventListener('resize', measure); return; }
      var dt = last == null ? 0 : Math.min((ts - last) / 1000, 0.05);
      last = ts;
      if (!over) step(dt);
      draw(dt * 60);
      requestAnimationFrame(frame);
    }

    /* ---------- popping ---------- */
    function pop(b) {
      if (over) return;
      var i = bubbles.indexOf(b);
      if (i === -1) return;
      bubbles.splice(i, 1);
      b.el.remove();

      var label = ctx.pick(b.item.label);
      hits.push({ id: b.item.id, safe: b.item.safe });

      if (b.item.safe) {
        collected += 1;
        fireworks(b.x, b.y);
        floater(b.x, b.y, label + ' \u2713', 'is-safe');
      } else {
        lives -= 1;
        bomb(b.x, b.y);
        boom(b.x, b.y);
        floater(b.x, b.y - 30, label + ' \u2717', 'is-risk');
      }
      paintHud();

      if (collected >= goal) return finish('win');
      if (lives <= 0) return finish('lives');
    }

    arena.addEventListener('pointerdown', function (ev) {
      var t = ev.target.closest && ev.target.closest('.bubble');
      if (!t || !t._bubble) return;
      ev.preventDefault();
      pop(t._bubble);
    });
    /* Keyboard activation (Enter / Space) arrives as a click with no pointer. */
    arena.addEventListener('click', function (ev) {
      var t = ev.target.closest && ev.target.closest('.bubble');
      if (t && t._bubble && ev.detail === 0) pop(t._bubble);
    });

    /* ---------- end ---------- */
    function finish(reason) {
      if (over) return;
      over = true;
      ctx.clearTimer();
      bubbles.forEach(function (b) { b.el.disabled = true; b.el.classList.add('is-frozen'); });

      var win = reason === 'win';
      var key = win ? 'game.bubbles.win' : (reason === 'time' ? 'game.bubbles.time' : 'game.bubbles.lives');

      /* Let the last explosion play before the dialog appears. */
      setTimeout(function () {
        if (!wrap.isConnected) return;
        var modal = el('div', 'game-modal');
        (document.getElementById('chapterPage') || document.body).appendChild(modal);

        GAMES.outcome(
          modal, ctx, win,
          function () { return ctx.t(key); },
          function () { return ctx.t('game.bubbles.summary', { n: collected, goal: goal }); },
          function () {
            modal.remove();
            ctx.finish(win ? cfg.points : 0, {
              points: win ? cfg.points : 0, collected: collected, goal: goal,
              livesLeft: lives, ended: reason, hits: hits
            });
          }
        );
      }, REDUCED ? 200 : 900);
    }

    /* ---------- go ---------- */
    measure();
    GAMES.shuffle(pool).forEach(spawn);
    paintHud();
    requestAnimationFrame(frame);
    ctx.setTimer(cfg.timeLimitS || 60, function () { finish('time'); });
  }
}());
