/* ============================================================
   Game 4 — One last step.  (The trap.)

   The site asks for the player's password to "finish the test". The only
   winning move is to refuse: Cancel scores 2 points, submitting a
   password wipes the entire chapter score.

   PRIVACY: the typed value is never read, stored, logged or transmitted.
   The code below only ever looks at `.value.length` to decide whether the
   box is empty, and the field is wiped immediately afterwards. The input
   is deliberately outside any <form>, has autocomplete off, and nothing
   here touches localStorage or the network.
   ============================================================ */
GAMES.register('trap', function () {
  'use strict';

  var el = GAMES.el;

  return {
    mount: function (host, cfg, ctx) { start(host, cfg, ctx); }
  };

  function start(host, cfg, ctx) {
    var resolved = false;

    var wrap = el('div', 'trap-game');
    var card = el('div', 'trap-card');

    card.appendChild(el('div', 'trap-lock', '&#128274;'));
    var title = el('h2', 'trap-title');
    card.appendChild(title);
    var prompt = el('p', 'trap-prompt');
    card.appendChild(prompt);

    var field = el('div', 'trap-field');
    var input = document.createElement('input');
    input.type = 'password';
    input.className = 'input trap-input';
    input.autocomplete = 'off';
    input.setAttribute('autocapitalize', 'off');
    input.setAttribute('autocorrect', 'off');
    input.setAttribute('spellcheck', 'false');
    input.setAttribute('data-1p-ignore', 'true');

    var eye = el('button', 'trap-eye', eyeIcon(false));
    eye.type = 'button';
    eye.addEventListener('click', function () {
      var shown = input.type === 'text';
      input.type = shown ? 'password' : 'text';
      eye.innerHTML = eyeIcon(!shown);
      input.focus();
    });

    field.appendChild(input);
    field.appendChild(eye);
    card.appendChild(field);

    var warn = el('div', 'trap-warning');
    warn.setAttribute('role', 'alert');
    card.appendChild(warn);

    var actions = el('div', 'trap-actions');
    var cancel = el('button', 'btn btn-ghost');
    cancel.type = 'button';
    var submit = el('button', 'btn btn-primary');
    submit.type = 'button';
    actions.appendChild(cancel);
    actions.appendChild(submit);
    card.appendChild(actions);

    wrap.appendChild(card);
    host.appendChild(wrap);
    setTimeout(function () { input.focus(); }, 60);

    /* Re-label on a language change. Anything already typed stays put —
       the value is never read here, only replaced by the player. */
    var panelState = null;
    ctx.live(function () {
      title.innerHTML = UI.escape(ctx.pick(cfg.title));
      prompt.innerHTML = UI.escape(ctx.pick(cfg.prompt));
      input.placeholder = ctx.pick(cfg.placeholder);
      input.setAttribute('aria-label', ctx.pick(cfg.placeholder));
      eye.setAttribute('aria-label', ctx.t('game.trap.toggle'));
      cancel.innerHTML = UI.escape(ctx.pick(cfg.cancelLabel));
      submit.innerHTML = UI.escape(ctx.pick(cfg.submitLabel));
      if (warn.textContent) warn.textContent = ctx.pick(cfg.emptyWarning);
      if (panelState) panelState();
    });

    function attempt() {
      /* Only the length is ever inspected. The value itself is never read. */
      if (input.value.length === 0) {
        warn.textContent = ctx.pick(cfg.emptyWarning);
        card.classList.remove('shake');
        void card.offsetWidth;                      // restart the animation
        card.classList.add('shake');
        input.focus();
        return;
      }
      input.value = '';                             // wipe before doing anything
      fail();
    }

    submit.addEventListener('click', attempt);
    input.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') { ev.preventDefault(); attempt(); }
    });
    cancel.addEventListener('click', function () { input.value = ''; win(); });

    function fail() {
      if (resolved) return;
      resolved = true;
      card.classList.add('is-failed');
      host.innerHTML = '';

      var panel = el('div', 'trap-result is-fail');
      var btn = el('button', 'btn btn-primary');
      btn.type = 'button';
      btn.addEventListener('click', function () {
        ctx.finish(0, { points: 0, submitted: true }, { zeroAll: true });
      });

      panelState = function () {
        panel.innerHTML =
          '<div class="trap-result-icon">&#9888;</div>' +
          '<h2>' + UI.escape(ctx.pick(cfg.failTitle)) + '</h2>' +
          '<p>' + UI.escape(ctx.pick(cfg.failBody)) + '</p>' +
          '<div class="trap-note">' + UI.escape(ctx.pick(cfg.failNote)) + '</div>';
        btn.innerHTML = UI.escape(ctx.t('game.seeResult'));
        panel.appendChild(btn);
      };
      panelState();
      host.appendChild(panel);
    }

    function win() {
      if (resolved) return;
      resolved = true;
      host.innerHTML = '';

      var panel = el('div', 'trap-result is-win');
      var btn = el('button', 'btn btn-primary');
      btn.type = 'button';
      btn.addEventListener('click', function () {
        ctx.finish(cfg.points, { points: cfg.points, submitted: false });
      });

      panelState = function () {
        panel.innerHTML =
          '<div class="trap-result-icon">&#10003;</div>' +
          '<h2>' + UI.escape(ctx.pick(cfg.winTitle)) + '</h2>' +
          '<p>' + UI.escape(ctx.pick(cfg.winBody)) + '</p>' +
          '<div class="trap-award">+' + cfg.points + '</div>';
        btn.innerHTML = UI.escape(ctx.t('game.seeResult'));
        panel.appendChild(btn);
      };
      panelState();
      host.appendChild(panel);

      fireworks(host);
    }
  }

  function eyeIcon(shown) {
    return shown
      ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none">' +
        '<path d="M3 3l18 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' +
        '<path d="M10.6 5.2A9.7 9.7 0 0112 5c5 0 9 4.5 9 7 0 .9-.6 2.1-1.6 3.2M6.3 6.8C3.9 8.3 3 10.3 3 12c0 2.5 4 7 9 7 1.5 0 2.9-.4 4.1-1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' +
        '</svg>'
      : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none">' +
        '<path d="M3 12s3.6-7 9-7 9 7 9 7-3.6 7-9 7-9-7-9-7z" stroke="currentColor" stroke-width="1.8"/>' +
        '<circle cx="12" cy="12" r="2.6" stroke="currentColor" stroke-width="1.8"/>' +
        '</svg>';
  }

  /* Particles launched from the bottom edge, celebrating the refusal. */
  function fireworks(host) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var canvas = document.createElement('canvas');
    canvas.className = 'trap-fireworks';
    host.appendChild(canvas);

    var ctx2d = canvas.getContext('2d');
    var dpr = window.devicePixelRatio || 1;

    function size() {
      var r = host.getBoundingClientRect();
      canvas.width = r.width * dpr;
      canvas.height = r.height * dpr;
      canvas.style.width = r.width + 'px';
      canvas.style.height = r.height + 'px';
      ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    size();
    window.addEventListener('resize', size);

    var COLOURS = ['#22D3EE', '#38BDF8', '#60A5FA', '#818CF8', '#FCD34D', '#FFFFFF'];
    var parts = [];
    var shells = 0;
    var W = function () { return canvas.width / dpr; };
    var H = function () { return canvas.height / dpr; };

    function burst(x, y) {
      var n = 46 + Math.floor(Math.random() * 22);
      var colour = COLOURS[Math.floor(Math.random() * COLOURS.length)];
      for (var i = 0; i < n; i++) {
        var a = (Math.PI * 2 * i) / n + Math.random() * 0.2;
        var sp = 1.6 + Math.random() * 3.4;
        parts.push({
          x: x, y: y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          life: 1, decay: 0.012 + Math.random() * 0.012,
          colour: colour, r: 1.4 + Math.random() * 1.8
        });
      }
    }

    /* Each shell rises from below the frame before exploding. */
    function launch() {
      if (shells >= 7) return;
      shells += 1;
      var targetX = W() * (0.15 + Math.random() * 0.7);
      var targetY = H() * (0.18 + Math.random() * 0.4);
      var rocket = { x: targetX, y: H() + 10, vy: -(5 + Math.random() * 2.5) };
      var rise = setInterval(function () {
        rocket.y += rocket.vy;
        parts.push({
          x: rocket.x + (Math.random() - 0.5) * 2, y: rocket.y,
          vx: 0, vy: 0.4, life: 0.5, decay: 0.05,
          colour: '#FCD34D', r: 1.2
        });
        if (rocket.y <= targetY) {
          clearInterval(rise);
          burst(rocket.x, rocket.y);
        }
      }, 16);
      setTimeout(launch, 420 + Math.random() * 380);
    }

    var running = true;
    function tick() {
      if (!running) return;
      ctx2d.clearRect(0, 0, W(), H());
      for (var i = parts.length - 1; i >= 0; i--) {
        var p = parts[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.045;                 // gravity
        p.vx *= 0.99;
        p.life -= p.decay;
        if (p.life <= 0) { parts.splice(i, 1); continue; }
        ctx2d.globalAlpha = Math.max(p.life, 0);
        ctx2d.fillStyle = p.colour;
        ctx2d.beginPath();
        ctx2d.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx2d.fill();
      }
      ctx2d.globalAlpha = 1;
      requestAnimationFrame(tick);
    }

    launch();
    tick();
    setTimeout(function () {
      running = false;
      window.removeEventListener('resize', size);
      canvas.remove();
    }, 9000);
  }
}());
