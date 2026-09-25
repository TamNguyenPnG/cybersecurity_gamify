/* ============================================================
   API client — talks to server.py, which owns data/app.db.

   Every call returns a promise. Network/So-server-down failures reject with
   an Error carrying a `code` so callers can show a friendly message rather
   than a stack trace.
   ============================================================ */
window.API = (function () {
  'use strict';

  var BASE = '/api';

  function request(path, opts) {
    return fetch(BASE + path, opts).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (body) {
        if (!res.ok) {
          var err = new Error(body.error || ('HTTP ' + res.status));
          err.code = body.error || 'http-' + res.status;
          err.body = body;
          throw err;
        }
        return body;
      });
    }, function () {
      var err = new Error('The server is not reachable.');
      err.code = 'offline';
      throw err;
    });
  }

  function post(path, payload) {
    return request(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {})
    });
  }

  /* Some endpoints answer with a bare array, others wrap it in a named
     key. Accept both so the client is not coupled to that choice. */
  function unwrap(key) {
    return function (r) { return Array.isArray(r) ? r : (r[key] || []); };
  }

  return {
    /* Login autocomplete. Returns [{email, name}] — department is
       deliberately NOT exposed, so the dropdown cannot leak the answer. */
    employees: function (term) {
      return request('/employees?q=' + encodeURIComponent(term || ''))
        .then(unwrap('employees'));
    },

    departments: function () {
      return request('/departments').then(unwrap('departments'));
    },

    verify: function (email, dept) {
      return post('/auth/verify', { email: email, department: dept });
    },

    kpis: function () {
      return request('/kpis').then(unwrap('kpis'));
    },

    /* Chapter availability for this user, including the lock policy verdict. */
    chapters: function (email) {
      return request('/chapters?email=' + encodeURIComponent(email || ''));
    },

    records: function (email) {
      return request('/records?email=' + encodeURIComponent(email || ''))
        .then(unwrap('records'));
    },

    saveAttempt: function (payload) {
      return post('/attempts', payload);
    },

    /* Burns the one-off grace play when a user leaves a closed chapter
       without choosing "Play again". */
    exitChapter: function (email, chapterId) {
      return post('/chapter/exit', { email: email, chapter_id: chapterId });
    }
  };
})();
