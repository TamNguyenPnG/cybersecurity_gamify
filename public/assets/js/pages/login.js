/* ============================================================
   Login portal.

   Talks to server.py: the email list comes from /api/employees (email +
   name only — never the department, so the dropdown can't leak the
   answer) and the identity check is done server-side by /api/auth/verify.
   ============================================================ */
I18N.ready.then(function () {
  'use strict';

  var form      = document.getElementById('loginForm');
  var emailEl   = document.getElementById('email');
  var deptEl    = document.getElementById('dept');
  var emailField= document.getElementById('emailField');
  var deptField = document.getElementById('deptField');
  var ac        = document.getElementById('emailAC');
  var btn       = document.getElementById('submitBtn');
  var btnLabel  = document.getElementById('btnLabel');

  var activeIdx = -1;
  var current   = [];
  /* The user must PICK a suggestion — free typing alone is not accepted. */
  var pickedEmail = null;
  var acToken = 0;

  /* ---------- Populate departments ---------- */
  API.departments().then(function (list) {
    list.forEach(function (d) {
      var o = document.createElement('option');
      o.value = d; o.textContent = d;
      deptEl.appendChild(o);
    });
  }, function () {
    UI.toast(I18N.t('ch.loadFailed'), 'error');
  });

  /* ---------- Error helpers ---------- */
  function clearErrors() {
    emailField.classList.remove('is-error', 'is-warning', 'shake');
    deptField.classList.remove('is-error', 'is-warning', 'shake');
  }
  function showEmailError() {
    clearErrors();
    emailField.classList.add('is-error');
    void emailField.offsetWidth;   // restart the shake animation reliably
    emailField.classList.add('shake');
    emailEl.focus();
  }
  function showDeptError() {
    clearErrors();
    deptField.classList.add('is-warning');
    void deptField.offsetWidth;
    deptField.classList.add('shake');
    deptEl.focus();
  }

  /* ---------- Autocomplete ---------- */
  function closeAC() {
    ac.classList.remove('open');
    emailEl.setAttribute('aria-expanded', 'false');
    activeIdx = -1;
  }

  function openAC(html) {
    ac.innerHTML = html;
    ac.classList.add('open');
    emailEl.setAttribute('aria-expanded', 'true');
  }

  function renderAC(term) {
    term = String(term || '').trim();
    if (!term) { closeAC(); return; }

    var token = ++acToken;
    API.employees(term).then(function (rows) {
      if (token !== acToken) return;      // a newer keystroke already won
      current = rows;
      ac.innerHTML = '';

      if (!rows.length) {
        openAC('<div class="ac-empty">' + UI.escape(I18N.t('login.acEmpty')) + '</div>');
        return;
      }

      var lower = term.toLowerCase();
      rows.forEach(function (emp, i) {
        var idx = emp.email.toLowerCase().indexOf(lower);
        var label = UI.escape(emp.email);
        if (idx !== -1) {
          label = UI.escape(emp.email.slice(0, idx)) +
                  '<mark>' + UI.escape(emp.email.substr(idx, term.length)) + '</mark>' +
                  UI.escape(emp.email.slice(idx + term.length));
        }
        var row = document.createElement('div');
        row.className = 'ac-item';
        row.setAttribute('role', 'option');
        row.setAttribute('data-i', i);
        /* Email + name only. The department is intentionally absent. */
        row.innerHTML =
          '<div class="ac-avatar">' + UI.escape(UI.initials(emp.name)) + '</div>' +
          '<div><div class="ac-mail">' + label + '</div>' +
          '<div class="ac-dept">' + UI.escape(emp.name) + '</div></div>';
        row.addEventListener('mousedown', function (e) {
          e.preventDefault();
          choose(i);
        });
        ac.appendChild(row);
      });

      ac.classList.add('open');
      emailEl.setAttribute('aria-expanded', 'true');
    }, function () {
      if (token !== acToken) return;
      openAC('<div class="ac-empty">' + UI.escape(I18N.t('ch.loadFailed')) + '</div>');
    });
  }

  function highlight(i) {
    var items = ac.querySelectorAll('.ac-item');
    items.forEach(function (n) { n.classList.remove('active'); });
    if (items[i]) {
      items[i].classList.add('active');
      items[i].scrollIntoView({ block: 'nearest' });
    }
    activeIdx = i;
  }

  function choose(i) {
    var emp = current[i];
    if (!emp) return;
    emailEl.value = emp.email;
    pickedEmail = emp.email;
    pickedName = emp.name;
    closeAC();
    clearErrors();
    deptEl.focus();
  }

  var pickedName = null;
  var debounce;

  emailEl.addEventListener('input', function () {
    pickedEmail = null;      // typing invalidates a previous pick
    clearErrors();
    clearTimeout(debounce);
    var v = emailEl.value;
    debounce = setTimeout(function () { renderAC(v); }, 140);
  });

  emailEl.addEventListener('focus', function () {
    if (emailEl.value.trim()) renderAC(emailEl.value);
  });

  emailEl.addEventListener('blur', function () { setTimeout(closeAC, 120); });

  emailEl.addEventListener('keydown', function (e) {
    if (!ac.classList.contains('open')) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); highlight(Math.min(activeIdx + 1, current.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); highlight(Math.max(activeIdx - 1, 0)); }
    else if (e.key === 'Enter' && activeIdx >= 0) { e.preventDefault(); choose(activeIdx); }
    else if (e.key === 'Escape') { closeAC(); }
  });

  deptEl.addEventListener('change', clearErrors);

  /* ---------- Submit ---------- */
  function setLoading(on) {
    btn.disabled = on;
    btnLabel.setAttribute('data-i18n', on ? 'login.verifying' : 'login.cta');
    btnLabel.textContent = I18N.t(on ? 'login.verifying' : 'login.cta');
    var sp = btn.querySelector('.spinner');
    if (on && !sp) {
      var s = document.createElement('span');
      s.className = 'spinner';
      btn.appendChild(s);
    } else if (!on && sp) {
      sp.remove();
    }
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    clearErrors();
    closeAC();

    var typed = emailEl.value.trim().toLowerCase();
    var dept  = deptEl.value;

    /* The email must have been chosen from the list, not just typed. */
    if (!typed || pickedEmail !== typed) { showEmailError(); return; }
    if (!dept) { showDeptError(); return; }

    setLoading(true);

    API.verify(typed, dept).then(function (res) {
      setLoading(false);
      if (!res.ok) {
        /* ERROR A — unknown email. ERROR B — department mismatch. */
        if (res.error === 'department-mismatch') showDeptError();
        else showEmailError();
        return;
      }
      UI.session.set({
        email: res.user.email,
        name: res.user.name,
        dept: res.user.department
      });
      window.location.href = 'main-hall.html';
    }, function (err) {
      setLoading(false);
      if (err.code === 'department-mismatch') showDeptError();
      else if (err.code === 'email-not-found') showEmailError();
      else UI.toast(I18N.t('ch.loadFailed'), 'error');
    });
  });

  /* ---------- State preview switcher (design deliverable) ---------- */
  var switcher = document.getElementById('stateSwitcher');
  if (!switcher) return;

  switcher.addEventListener('click', function (e) {
    var b = e.target.closest('[data-state]');
    if (!b) return;

    switcher.querySelectorAll('.tab').forEach(function (t) { t.classList.remove('active'); });
    b.classList.add('active');

    var state = b.dataset.state;
    setLoading(false);
    clearErrors();
    closeAC();

    if (state === 'default') {
      emailEl.value = ''; deptEl.value = ''; pickedEmail = null; emailEl.blur();
    }
    if (state === 'focus') {
      emailEl.value = 'minh';
      emailEl.focus();
      renderAC('minh');
    }
    if (state === 'loading') {
      emailEl.value = 'minh.cs@pg.com';
      deptEl.value = 'Human Resources';
      setLoading(true);
    }
    if (state === 'errorA') {
      emailEl.value = 'unknown.person@pg.com';
      deptEl.value = 'Finance';
      pickedEmail = null;
      showEmailError();
    }
    if (state === 'errorB') {
      emailEl.value = 'minh.cs@pg.com';
      pickedEmail = 'minh.cs@pg.com';
      deptEl.value = 'Finance';   // record says Human Resources
      showDeptError();
    }
  });
});
