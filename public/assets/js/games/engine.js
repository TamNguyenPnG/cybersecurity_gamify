/* ============================================================
   Game engine — hosts a sequence of mini-games inside a chapter.

   Each game registers itself as:

     GAMES.register('hotspot', { mount: function (el, cfg, ctx) { ... } });

   `ctx` gives the game everything it needs and nothing more:
     ctx.lang            current language code
     ctx.pick(obj)       obj.vi / obj.en -> string for the current language
     ctx.t(key, vars)    UI string lookup
     ctx.finish(points, detail, opts)
                         called once when the game ends.
                         opts.zeroAll wipes every point earned so far.
     ctx.setTimer(sec | null)
   ============================================================ */
window.GAMES = (function () {
  'use strict';

  var registry = {};

  function register(type, impl) { registry[type] = impl; }

  /* Run a list of games one after another inside `host`. */
  function run(opts) {
    var host = opts.host;
    var games = opts.games;
    var lang = opts.lang;
    var index = 0;
    var score = 0;
    var detail = {};
    var startedAt = Date.now();
    var timerId = null;
    var gen = 0;          // bumped on every mount; stale mounts are ignored
    var over = false;

    function pick(obj) {
      if (obj == null) return '';
      if (typeof obj === 'string') return obj;
      var cur = (window.I18N && window.I18N.lang) || lang;
      return obj[cur] != null ? obj[cur] : (obj.en != null ? obj.en : '');
    }

    function paintScore() {
      if (opts.onScore) opts.onScore(score, opts.maxScore);
    }

    function paintSteps() {
      if (opts.onStep) opts.onStep(index, games.length);
    }

    function clearTimer() {
      if (timerId) { clearInterval(timerId); timerId = null; }
      if (opts.onTimer) opts.onTimer(null);
    }

    /* A countdown the host renders in the chapter header. Games opt in;
       games that do not call setTimer simply have no clock. */
    function setTimer(seconds, onExpire) {
      clearTimer();
      if (seconds == null) return;
      var left = seconds;
      if (opts.onTimer) opts.onTimer(left);
      timerId = setInterval(function () {
        left -= 1;
        if (opts.onTimer) opts.onTimer(Math.max(left, 0));
        if (left <= 0) {
          clearTimer();
          if (onExpire) onExpire();
        }
      }, 1000);
    }

    function step() {
      if (index >= games.length) {
        if (over) return;
        over = true;
        clearTimer();
        window.removeEventListener('i18n:change', relang);
        return opts.onComplete({
          score: score,
          maxScore: opts.maxScore,
          detail: detail,
          durationS: Math.round((Date.now() - startedAt) / 1000)
        });
      }

      var cfg = games[index];
      var impl = registry[cfg.type];
      gen += 1;
      var myGen = gen;
      clearTimer();
      host.innerHTML = '';
      host.scrollTop = 0;
      paintSteps();

      if (!impl) {
        console.error('No game registered for type "' + cfg.type + '"');
        index += 1;
        return step();
      }

      var finished = false;
      impl.mount(host, cfg, {
        lang: (window.I18N && window.I18N.lang) || lang,
        pick: pick,
        t: function (k, v) { return window.I18N.t(k, v); },
        setTimer: setTimer,
        clearTimer: clearTimer,
        /* Optional: preview points earned so far inside a multi-part game,
           so the HUD ticks up instead of jumping at the end. */
        progress: function (points) {
          if (myGen !== gen) return;
          if (opts.onScore) opts.onScore(score + (points || 0), opts.maxScore);
        },
        finish: function (points, gameDetail, finishOpts) {
          if (finished) return;          // a game may only report once
          if (myGen !== gen) return;     // ...and only while it is on screen
          finished = true;
          clearTimer();

          finishOpts = finishOpts || {};
          if (finishOpts.zeroAll) {
            score = 0;
            detail.zeroedBy = cfg.id;
          } else {
            score += (points || 0);
          }
          detail[cfg.id] = gameDetail || { points: points || 0 };
          paintScore();

          index += 1;
          setTimeout(step, finishOpts.delay == null ? 120 : finishOpts.delay);
        }
      });
    }

    /* Switching language restarts the current mini-game in the new
       language. Points already banked are kept; the generation guard
       above stops the discarded mount from reporting a result. */
    function relang() {
      if (!over) step();
    }
    window.addEventListener('i18n:change', relang);

    paintScore();
    step();
  }

  /* ---------- helpers shared by the individual games ---------- */

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* Intro panel shared by every game: title, brief and a Start button. */
  function intro(host, cfg, ctx, onStart) {
    var wrap = el('div', 'game-intro');
    wrap.appendChild(el('h2', 'game-intro-title', UI.escape(ctx.pick(cfg.title))));
    if (cfg.brief) {
      wrap.appendChild(el('p', 'game-intro-brief', UI.escape(ctx.pick(cfg.brief))));
    }
    var pts = cfg.points === 1
      ? ctx.t('game.worthOne')
      : ctx.t('game.worthN', { n: cfg.points });
    wrap.appendChild(el('div', 'game-intro-points', UI.escape(pts)));

    var btn = el('button', 'btn btn-primary', UI.escape(ctx.t('game.start')));
    btn.type = 'button';
    btn.addEventListener('click', function () {
      wrap.remove();
      onStart();
    });
    wrap.appendChild(btn);
    host.appendChild(wrap);
  }

  /* Outcome panel shown after a game resolves. */
  function outcome(host, ctx, ok, title, body, onNext, nextLabel) {
    var wrap = el('div', 'game-outcome ' + (ok ? 'is-win' : 'is-miss'));
    wrap.appendChild(el('div', 'game-outcome-icon', ok ? '&#10003;' : '&#33;'));
    wrap.appendChild(el('h3', null, UI.escape(title)));
    if (body) wrap.appendChild(el('p', null, UI.escape(body)));
    var btn = el('button', 'btn btn-primary',
      UI.escape(nextLabel || ctx.t('game.next')));
    btn.type = 'button';
    btn.addEventListener('click', onNext);
    wrap.appendChild(btn);
    host.appendChild(wrap);
    return wrap;
  }

  return {
    register: register,
    run: run,
    el: el,
    shuffle: shuffle,
    intro: intro,
    outcome: outcome
  };
})();
