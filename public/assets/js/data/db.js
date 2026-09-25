/* ============================================================
   Chapter presentation metadata.

   Everything dynamic (employees, departments, KPIs, records, chapter
   availability) now comes from the server — see data/api.js. What stays
   here is purely how a chapter LOOKS: its number and accent colour.
   Titles, descriptions and dates are translated content and live in
   content/i18n/*.json under chapter.<id>.*
   ============================================================ */
window.DB = (function () {
  'use strict';

  var CHAPTERS = [
    { id: 1, num: '01', accentVar: '--ch1' },
    { id: 2, num: '02', accentVar: '--ch2' },
    { id: 3, num: '03', accentVar: '--ch3' },
    { id: 4, num: '04', accentVar: '--ch4' }
  ];

  return {
    chapters: CHAPTERS,
    getChapter: function (id) {
      return CHAPTERS.filter(function (c) { return c.id === Number(id); })[0] || CHAPTERS[0];
    }
  };
})();
