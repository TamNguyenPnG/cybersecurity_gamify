/* ============================================================
   i18n runtime — one set of content, two languages.

   Usage in a page script:
     I18N.ready.then(init);                     // first render
     window.addEventListener('i18n:change', render);  // re-render

   Markup:
     <h1 data-i18n="hall.h1"></h1>
     <p  data-i18n-html="hall.rule.bravo"></p>
     <input data-i18n-placeholder="login.emailPlaceholder">
     <button data-i18n-aria-label="hall.emailAria"></button>
     <title data-i18n-title="hall.docTitle"></title>
   ============================================================ */
window.I18N = (function () {
  'use strict';

  var STORE_KEY = 'csm_lang';
  var DEFAULT = 'en';
  var LANGS = [
    { code: 'en', label: 'EN', name: 'English' },
    { code: 'vi', label: 'VI', name: 'Tiếng Việt' }
  ];

  var dicts = {};
  var current = DEFAULT;

  function supported(code) {
    return LANGS.some(function (l) { return l.code === code; });
  }

  function initialLang() {
    // ?lang=vi wins (deep links / QA), then saved choice, then browser locale.
    var q = new URLSearchParams(window.location.search).get('lang');
    if (supported(q)) return q;
    var saved;
    try { saved = localStorage.getItem(STORE_KEY); } catch (e) { saved = null; }
    if (supported(saved)) return saved;
    var nav = (navigator.language || '').slice(0, 2).toLowerCase();
    return supported(nav) ? nav : DEFAULT;
  }

  function load(code) {
    if (dicts[code]) return Promise.resolve(dicts[code]);
    return fetch('content/i18n/' + code + '.json', { cache: 'no-cache' })
      .then(function (r) {
        if (!r.ok) throw new Error('i18n ' + code + ': HTTP ' + r.status);
        return r.json();
      })
      .then(function (json) { dicts[code] = json; return json; })
      .catch(function (err) {
        console.error(err);
        if (code !== DEFAULT) return load(DEFAULT);
        dicts[DEFAULT] = {};
        return dicts[DEFAULT];
      });
  }

  /* Replace {name} tokens from a vars object. */
  function interpolate(str, vars) {
    if (!vars) return str;
    return str.replace(/\{(\w+)\}/g, function (m, k) {
      return Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k]) : m;
    });
  }

  /* Falls back to English, then to the key itself, so a missing
     translation degrades to readable text instead of blank UI. */
  function t(key, vars) {
    var d = dicts[current] || {};
    var val = d[key];
    if (val === undefined && current !== DEFAULT) val = (dicts[DEFAULT] || {})[key];
    if (val === undefined) return key;
    return interpolate(val, vars);
  }

  function applyAttr(root, attr, fn) {
    var nodes = root.querySelectorAll('[' + attr + ']');
    for (var i = 0; i < nodes.length; i++) {
      fn(nodes[i], nodes[i].getAttribute(attr));
    }
  }

  function apply(root) {
    root = root || document;
    applyAttr(root, 'data-i18n', function (el, k) { el.textContent = t(k, varsOf(el)); });
    applyAttr(root, 'data-i18n-html', function (el, k) { el.innerHTML = t(k, varsOf(el)); });
    applyAttr(root, 'data-i18n-placeholder', function (el, k) { el.setAttribute('placeholder', t(k, varsOf(el))); });
    applyAttr(root, 'data-i18n-aria-label', function (el, k) { el.setAttribute('aria-label', t(k, varsOf(el))); });
    applyAttr(root, 'data-i18n-title', function (el, k) {
      if (el.tagName === 'TITLE') { document.title = t(k, varsOf(el)); }
      else { el.setAttribute('title', t(k, varsOf(el))); }
    });
    if (root === document) {
      document.documentElement.setAttribute('lang', current);
    }
  }

  /* Optional per-element interpolation values: data-i18n-vars='{"n":2}' */
  function varsOf(el) {
    var raw = el.getAttribute('data-i18n-vars');
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }

  function set(code) {
    if (!supported(code) || code === current) return Promise.resolve(current);
    return load(code).then(function () {
      current = code;
      try { localStorage.setItem(STORE_KEY, code); } catch (e) {}
      apply(document);
      window.dispatchEvent(new CustomEvent('i18n:change', { detail: { lang: code } }));
      return code;
    });
  }

  /* Renders the VI/EN switch into every [data-lang-switch] container. */
  function mountSwitch() {
    var hosts = document.querySelectorAll('[data-lang-switch]');
    for (var i = 0; i < hosts.length; i++) {
      (function (host) {
        host.innerHTML = '';
        host.className = 'lang-switch';
        host.setAttribute('role', 'group');
        host.setAttribute('aria-label', t('lang.aria'));
        LANGS.forEach(function (l) {
          var b = document.createElement('button');
          b.type = 'button';
          b.className = 'lang-btn' + (l.code === current ? ' is-active' : '');
          b.textContent = l.label;
          b.title = l.name;
          b.setAttribute('aria-pressed', l.code === current ? 'true' : 'false');
          b.addEventListener('click', function () { set(l.code); });
          host.appendChild(b);
        });
      })(hosts[i]);
    }
  }

  current = initialLang();

  var ready = load(current).then(function () {
    // Preload the other language so switching is instant.
    LANGS.forEach(function (l) { if (l.code !== current) load(l.code); });
    function boot() { apply(document); mountSwitch(); }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot);
      return new Promise(function (res) {
        document.addEventListener('DOMContentLoaded', function () { res(current); });
      });
    }
    boot();
    return current;
  });

  window.addEventListener('i18n:change', mountSwitch);

  return {
    t: t,
    apply: apply,
    set: set,
    ready: ready,
    langs: LANGS,
    get lang() { return current; }
  };
})();
