/* ============================================================
   Mock data layer — stands in for the real backend.
   Replace DB.* calls with API requests when wiring the server.
   ============================================================ */
window.DB = (function () {
  'use strict';

  var DEPARTMENTS = [
    'Human Resources',
    'Information Technology',
    'Finance',
    'Marketing',
    'Sales',
    'Supply Chain',
    'Research & Development',
    'Manufacturing',
    'Legal',
    'Communications'
  ];

  /* Registered employees. Email must match EXACTLY one record,
     and the chosen department must match that record. */
  var EMPLOYEES = [
    { email: 'minh.cs@pg.com',      name: 'Minh Cao Sy',        dept: 'Human Resources' },
    { email: 'minh.tt@pg.com',      name: 'Minh Tran Thi',      dept: 'Marketing' },
    { email: 'tam.nt@pg.com',       name: 'Tam Nguyen Thi',     dept: 'Information Technology' },
    { email: 'linh.pd@pg.com',      name: 'Linh Pham Duc',      dept: 'Finance' },
    { email: 'huy.nv@pg.com',       name: 'Huy Nguyen Van',     dept: 'Information Technology' },
    { email: 'an.lt@pg.com',        name: 'An Le Thi',          dept: 'Supply Chain' },
    { email: 'khanh.vd@pg.com',     name: 'Khanh Vo Duy',       dept: 'Research & Development' },
    { email: 'thao.dn@pg.com',      name: 'Thao Dang Ngoc',     dept: 'Sales' },
    { email: 'quan.hm@pg.com',      name: 'Quan Hoang Minh',    dept: 'Manufacturing' },
    { email: 'mai.tn@pg.com',       name: 'Mai Truong Ngoc',    dept: 'Communications' },
    { email: 'duc.nb@pg.com',       name: 'Duc Nguyen Ba',      dept: 'Legal' },
    { email: 'trang.lh@pg.com',     name: 'Trang Le Hoang',     dept: 'Human Resources' },
    { email: 'son.pv@pg.com',       name: 'Son Pham Van',       dept: 'Information Technology' },
    { email: 'yen.nh@pg.com',       name: 'Yen Nguyen Hai',     dept: 'Finance' },
    { email: 'bao.tq@pg.com',       name: 'Bao Tran Quoc',      dept: 'Marketing' },
    { email: 'ha.vt@pg.com',        name: 'Ha Vu Thanh',        dept: 'Supply Chain' },
    { email: 'nam.lq@pg.com',       name: 'Nam Le Quang',       dept: 'Sales' },
    { email: 'chi.ptm@pg.com',      name: 'Chi Pham Thi Minh',  dept: 'Research & Development' }
  ];

  /* Chapter metadata. Titles, descriptions, unlock dates and game-stage
     art direction are translated content and live in content/i18n/*.json
     under the keys chapter.<id>.title / .desc / .unlock / .stage */
  var CHAPTERS = [
    { id: 1, num: '01', accentVar: '--ch1' },
    { id: 2, num: '02', accentVar: '--ch2' },
    { id: 3, num: '03', accentVar: '--ch3' },
    { id: 4, num: '04', accentVar: '--ch4' }
  ];

  var LEADERBOARD = [
    { name: 'Minh Cao Sy',       dept: 'Human Resources',         chapter: 1, best: 5, plays: 3 },
    { name: 'Tam Nguyen Thi',    dept: 'Information Technology',  chapter: 1, best: 5, plays: 4 },
    { name: 'Linh Pham Duc',     dept: 'Finance',                 chapter: 2, best: 5, plays: 6 },
    { name: 'Huy Nguyen Van',    dept: 'Information Technology',  chapter: 1, best: 4, plays: 2 },
    { name: 'An Le Thi',         dept: 'Supply Chain',            chapter: 2, best: 4, plays: 3 },
    { name: 'Khanh Vo Duy',      dept: 'Research & Development',  chapter: 3, best: 4, plays: 5 },
    { name: 'Thao Dang Ngoc',    dept: 'Sales',                   chapter: 1, best: 4, plays: 7 },
    { name: 'Quan Hoang Minh',   dept: 'Manufacturing',           chapter: 2, best: 3, plays: 2 },
    { name: 'Mai Truong Ngoc',   dept: 'Communications',          chapter: 3, best: 3, plays: 4 },
    { name: 'Bao Tran Quoc',     dept: 'Marketing',               chapter: 1, best: 3, plays: 1 },
    { name: 'Son Pham Van',      dept: 'Information Technology',  chapter: 4, best: 3, plays: 3 },
    { name: 'Yen Nguyen Hai',    dept: 'Finance',                 chapter: 2, best: 2, plays: 2 }
  ];

  /* Labels/subs are translated: kpi.<key>.label and kpi.<key>.sub */
  var KPIS = [
    { key: 'top-dept',  value: 'IT',    pct: 86 },
    { key: 'completed', value: '412',   pct: 64 },
    { key: 'plays',     value: '1,873', pct: 78 },
    { key: 'bravo',     value: '2,400', pct: 50 }
  ];

  /* ---------- Public API ---------- */
  return {
    departments: DEPARTMENTS,
    employees: EMPLOYEES,
    chapters: CHAPTERS,
    kpis: KPIS,

    getChapter: function (id) {
      return CHAPTERS.filter(function (c) { return c.id === Number(id); })[0] || CHAPTERS[0];
    },

    /* Suggest matching employees for the email combo input. */
    searchEmails: function (term) {
      var t = String(term || '').trim().toLowerCase();
      if (!t) return [];
      return EMPLOYEES.filter(function (e) {
        return e.email.toLowerCase().indexOf(t) !== -1 ||
               e.name.toLowerCase().indexOf(t) !== -1;
      }).slice(0, 6);
    },

    findByEmail: function (email) {
      var t = String(email || '').trim().toLowerCase();
      return EMPLOYEES.filter(function (e) { return e.email.toLowerCase() === t; })[0] || null;
    },

    /* Leaderboard, ranked by best score then total plays. */
    leaderboard: function (filter) {
      var rows = LEADERBOARD.slice();
      if (filter && filter.chapter) {
        rows = rows.filter(function (r) { return r.chapter === Number(filter.chapter); });
      }
      if (filter && filter.dept) {
        rows = rows.filter(function (r) { return r.dept === filter.dept; });
      }
      rows.sort(function (a, b) {
        if (b.best !== a.best) return b.best - a.best;
        return b.plays - a.plays;
      });
      return rows;
    }
  };
})();
