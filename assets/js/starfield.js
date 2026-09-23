/* Animated star field with constellation lines.
   Renders to a fixed full-viewport canvas behind all page content. */
(function () {
  'use strict';

  function init() {
    var canvas = document.getElementById('starfield');
    if (!canvas) return;

    var ctx = canvas.getContext('2d');
    var stars = [];
    var w = 0, h = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var LINK_DIST = 132;

    function resize() {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
    }

    function build() {
      // Density scales with viewport but stays bounded for mobile perf.
      var count = Math.round(Math.min(220, Math.max(70, (w * h) / 9000)));
      stars = [];
      for (var i = 0; i < count; i++) {
        var big = Math.random() < 0.14;
        stars.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: big ? 1.4 + Math.random() * 1.3 : 0.5 + Math.random() * 1.0,
          o: 0.1 + Math.random() * 0.5,
          cyan: Math.random() < 0.3,
          vx: (Math.random() - 0.5) * 0.12,
          vy: (Math.random() - 0.5) * 0.12,
          tw: Math.random() * Math.PI * 2,
          tws: 0.008 + Math.random() * 0.018
        });
      }
    }

    function draw() {
      ctx.clearRect(0, 0, w, h);

      // Constellation lines between nearby stars
      for (var i = 0; i < stars.length; i++) {
        for (var j = i + 1; j < stars.length; j++) {
          var dx = stars[i].x - stars[j].x;
          var dy = stars[i].y - stars[j].y;
          var d2 = dx * dx + dy * dy;
          if (d2 < LINK_DIST * LINK_DIST) {
            var alpha = (1 - Math.sqrt(d2) / LINK_DIST) * 0.16;
            ctx.strokeStyle = 'rgba(34,211,238,' + alpha.toFixed(3) + ')';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(stars[i].x, stars[i].y);
            ctx.lineTo(stars[j].x, stars[j].y);
            ctx.stroke();
          }
        }
      }

      // Stars
      for (var k = 0; k < stars.length; k++) {
        var s = stars[k];
        s.tw += s.tws;
        var op = s.o * (0.65 + 0.35 * Math.sin(s.tw));
        ctx.fillStyle = s.cyan
          ? 'rgba(34,211,238,' + op.toFixed(3) + ')'
          : 'rgba(255,255,255,' + op.toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();

        if (!reduced) {
          s.x += s.vx;
          s.y += s.vy;
          if (s.x < -6) s.x = w + 6; else if (s.x > w + 6) s.x = -6;
          if (s.y < -6) s.y = h + 6; else if (s.y > h + 6) s.y = -6;
        }
      }
      requestAnimationFrame(draw);
    }

    var t;
    window.addEventListener('resize', function () {
      clearTimeout(t);
      t = setTimeout(resize, 160);
    });

    resize();
    requestAnimationFrame(draw);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
