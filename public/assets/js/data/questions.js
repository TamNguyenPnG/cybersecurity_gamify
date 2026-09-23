/* ============================================================
   Question loader.

   Questions live in public/content/questions/chapter-0N.json.
   Each question carries BOTH languages plus ONE shared `answer`
   index — so a translation can never desync the correct option.

   Requires an HTTP server (fetch does not work over file://).
   ============================================================ */
window.QUESTIONS = (function () {
  'use strict';

  var cache = {};

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function url(chapterId) {
    return 'content/questions/chapter-' + pad(Number(chapterId)) + '.json';
  }

  /* Loads the raw bilingual file for a chapter (cached). */
  function loadRaw(chapterId) {
    var id = Number(chapterId) || 1;
    if (cache[id]) return cache[id];
    cache[id] = fetch(url(id), { cache: 'no-cache' })
      .then(function (r) {
        if (!r.ok) throw new Error('questions ch' + id + ': HTTP ' + r.status);
        return r.json();
      })
      .catch(function (err) {
        delete cache[id];
        throw err;
      });
    return cache[id];
  }

  /* Returns questions flattened into the active language:
     [{ id, q, o: [...], a }]  — `a` is the correct index. */
  function get(chapterId, lang) {
    var code = lang || (window.I18N ? window.I18N.lang : 'en');
    return loadRaw(chapterId).then(function (file) {
      return (file.questions || []).map(function (item) {
        var loc = item[code] || item.en || {};
        return {
          id: item.id,
          q: loc.q || '',
          o: (loc.o || []).slice(),
          a: Number(item.answer) || 0
        };
      });
    });
  }

  function title(chapterId, lang) {
    var code = lang || (window.I18N ? window.I18N.lang : 'en');
    return loadRaw(chapterId).then(function (file) {
      return (file.title && (file.title[code] || file.title.en)) || '';
    });
  }

  return { get: get, title: title, raw: loadRaw };
})();
