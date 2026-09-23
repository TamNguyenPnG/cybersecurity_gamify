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

  var CHAPTERS = [
    { id: 1, num: '01', title: 'Safe Account',      desc: 'Keep your account safe and secured',      unlock: 'Oct 5',  accentVar: '--ch1',
      stage: 'A neon chase across a data-centre corridor: the P&G hero advances left-to-right while a hooded hacker retreats into the dark. A 5-step progress track runs between them; each correct answer closes the gap by one step.' },
    { id: 2, num: '02', title: 'Safe Device',       desc: 'Protect our devices and systems',         unlock: 'Oct 12', accentVar: '--ch2',
      stage: 'A shield-wall defence scene: the hero raises a glowing barrier around laptops and phones while malware shards strike it. Each correct answer seals one more device.' },
    { id: 3, num: '03', title: 'Safe Connection',   desc: 'Connect to the system by secured ways',   unlock: 'Oct 19', accentVar: '--ch3',
      stage: 'A bridge-building scene across a dark data chasm: each correct answer lays one encrypted span so the hero can cross to the secure server node.' },
    { id: 4, num: '04', title: 'Safe Installation', desc: 'Install software by authorized solutions', unlock: 'Oct 26', accentVar: '--ch4',
      stage: 'A vault-assembly scene: the hero slots authorised software modules into a glowing vault while rogue installers are rejected at the gate.' }
  ];

  /* 5 questions per chapter. `a` is the index of the correct option. */
  var QUESTIONS = {
    1: [
      { q: 'You receive an email asking you to "re-verify" your P&G password via a link. What do you do?',
        o: ['Report it to IT Security and delete it', 'Click the link and check if it looks official', 'Forward it to your team to warn them', 'Enter your password only if the page has HTTPS'], a: 0 },
      { q: 'Which of these is the strongest passphrase for your work account?',
        o: ['P&G2026!', 'Password123', 'purple-tiger-runs-42-miles', 'yourname1990'], a: 2 },
      { q: 'Multi-factor authentication (MFA) protects you mainly because…',
        o: ['It makes your password longer', 'A stolen password alone is not enough to log in', 'It encrypts your hard drive', 'It hides your email address'], a: 1 },
      { q: 'A colleague asks to borrow your login "just for five minutes". The correct response is:',
        o: ['Share it, they are on your team', 'Share it but change the password after', 'Type it in for them yourself', 'Refuse — credentials are never shared'], a: 3 },
      { q: 'You get an unexpected MFA push notification you did not trigger. You should:',
        o: ['Approve it so it stops repeating', 'Ignore it and carry on', 'Deny it and report to IT Security immediately', 'Turn MFA off temporarily'], a: 2 }
    ],
    2: [
      { q: 'You step away from your desk for a coffee. Your laptop should be:',
        o: ['Locked (Win+L)', 'Left open, you will be quick', 'Closed but not locked', 'Left on the login screensaver timer'], a: 0 },
      { q: 'Your phone prompts you to install a security update. The best practice is:',
        o: ['Postpone it until next month', 'Install it promptly', 'Only install if IT emails you', 'Ignore updates on personal devices'], a: 1 },
      { q: 'You find an unlabelled USB drive in the meeting room. You should:',
        o: ['Plug it in to find the owner', 'Take it home to check it', 'Hand it to IT Security without plugging it in', 'Format it and reuse it'], a: 2 },
      { q: 'Which is the safest place to store confidential P&G files?',
        o: ['Personal cloud drive', 'Desktop of a shared PC', 'USB stick in your bag', 'Approved P&G-managed storage'], a: 3 },
      { q: 'Antivirus flags a file you just downloaded. The right action is:',
        o: ['Do not open it and report to IT Security', 'Open it in a different app', 'Disable antivirus and retry', 'Move it to another folder'], a: 0 }
    ],
    3: [
      { q: 'You need to work from an airport. The safest connection is:',
        o: ['Free open airport Wi-Fi', 'P&G-approved VPN over a trusted network', 'A stranger\'s mobile hotspot', 'Any network named "Free_WiFi_Secure"'], a: 1 },
      { q: 'Before entering credentials on a site, you should check that:',
        o: ['The page looks familiar', 'The domain is correct and the connection is HTTPS', 'It loaded quickly', 'A colleague sent you the link'], a: 1 },
      { q: 'A public Wi-Fi network asks you to install a "certificate" to browse. You should:',
        o: ['Install it — it is required', 'Install it only on your phone', 'Decline and use mobile data or VPN', 'Install and uninstall afterwards'], a: 2 },
      { q: 'Sharing an internal dashboard link with an external partner requires:',
        o: ['Nothing, the link is harmless', 'Approval and a controlled sharing method', 'Sending it from your personal email', 'Posting it in a public channel'], a: 1 },
      { q: 'Your VPN disconnects mid-session while handling sensitive data. You should:',
        o: ['Stop work and reconnect before continuing', 'Continue, it is only a short gap', 'Switch to personal email to finish', 'Save files locally and carry on'], a: 0 }
    ],
    4: [
      { q: 'You need a new productivity tool for your team. First step:',
        o: ['Download it from the vendor site', 'Request it through the approved software catalogue', 'Ask a colleague to share their installer', 'Use a free portable version'], a: 1 },
      { q: 'A pop-up says your browser is outdated and offers a "one-click fix". You should:',
        o: ['Click the fix', 'Close it and update via official channels', 'Call the number shown', 'Install it, then scan afterwards'], a: 1 },
      { q: 'Browser extensions are risky mainly because they can:',
        o: ['Slow down your laptop', 'Read and modify the pages you visit', 'Use extra disk space', 'Change your wallpaper'], a: 1 },
      { q: 'Using a licence key found online for paid software is:',
        o: ['Fine if the company saves money', 'Acceptable for a trial period', 'Prohibited — it is a legal and security risk', 'Allowed if IT does not notice'], a: 2 },
      { q: 'Who should install software on your P&G-managed laptop?',
        o: ['Anyone with the admin password', 'You, via approved self-service or IT', 'An external vendor on site', 'A teammate who has done it before'], a: 1 }
    ]
  };

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

  var KPIS = [
    { key: 'top-dept', label: 'Top department by participation', value: 'IT',   sub: '86% joined', pct: 86 },
    { key: 'completed', label: 'People completed',               value: '412',  sub: 'of 640 invited', pct: 64 },
    { key: 'plays',     label: 'Total plays',                    value: '1,873', sub: 'across 4 chapters', pct: 78 },
    { key: 'bravo',     label: 'Bravo points awarded',           value: '2,400', sub: '12 winners so far', pct: 50 }
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

    getQuestions: function (id) {
      return (QUESTIONS[Number(id)] || QUESTIONS[1]).slice();
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

/* ---------- Small shared helpers ---------- */
window.UI = {
  initials: function (name) {
    return String(name || '').split(/\s+/).slice(0, 2)
      .map(function (p) { return p.charAt(0); }).join('').toUpperCase();
  },
  qs: function (key, fallback) {
    var v = new URLSearchParams(window.location.search).get(key);
    return v === null ? fallback : v;
  },
  escape: function (s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  },
  toast: function (msg, kind) {
    var wrap = document.querySelector('.toast-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'toast-wrap';
      document.body.appendChild(wrap);
    }
    var el = document.createElement('div');
    el.className = 'toast ' + (kind === 'bad' ? 'bad' : 'ok');
    el.setAttribute('role', 'status');
    el.textContent = msg;
    wrap.appendChild(el);
    setTimeout(function () { el.remove(); }, 2300);
  },
  /* Session persistence for the signed-in player + chapter progress. */
  session: {
    get: function () {
      try { return JSON.parse(sessionStorage.getItem('csm_user') || 'null'); }
      catch (e) { return null; }
    },
    set: function (u) { sessionStorage.setItem('csm_user', JSON.stringify(u)); },
    clear: function () { sessionStorage.removeItem('csm_user'); }
  },
  progress: {
    all: function () {
      try { return JSON.parse(localStorage.getItem('csm_progress') || '{}'); }
      catch (e) { return {}; }
    },
    get: function (ch) { return this.all()[ch] || null; },
    save: function (ch, score, total) {
      var p = this.all();
      var prev = p[ch] || { best: 0, plays: 0 };
      p[ch] = {
        best: Math.max(prev.best, score),
        plays: prev.plays + 1,
        total: total
      };
      localStorage.setItem('csm_progress', JSON.stringify(p));
      return p[ch];
    }
  }
};
