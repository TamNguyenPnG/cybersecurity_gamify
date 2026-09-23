/* Login portal — email autocomplete, department match, error states. */
(function () {
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

  /* ---------- Populate departments ---------- */
  DB.departments.forEach(function (d) {
    var o = document.createElement('option');
    o.value = d; o.textContent = d;
    deptEl.appendChild(o);
  });

  /* ---------- Error helpers ---------- */
  function clearErrors() {
    emailField.classList.remove('is-error', 'is-warning', 'shake');
    deptField.classList.remove('is-error', 'is-warning', 'shake');
  }
  function showEmailError() {
    clearErrors();
    emailField.classList.add('is-error');
    // Restart the shake animation reliably.
    void emailField.offsetWidth;
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

  function renderAC(term) {
    current = DB.searchEmails(term);
    ac.innerHTML = '';

    if (!term.trim()) { closeAC(); return; }

    if (!current.length) {
      ac.innerHTML = '<div class="ac-empty">No matching P&amp;G account found.</div>';
      ac.classList.add('open');
      emailEl.setAttribute('aria-expanded', 'true');
      return;
    }

    current.forEach(function (emp, i) {
      var idx = emp.email.toLowerCase().indexOf(term.trim().toLowerCase());
      var label = UI.escape(emp.email);
      if (idx !== -1) {
        label = UI.escape(emp.email.slice(0, idx)) +
                '<mark>' + UI.escape(emp.email.substr(idx, term.trim().length)) + '</mark>' +
                UI.escape(emp.email.slice(idx + term.trim().length));
      }
      var row = document.createElement('div');
      row.className = 'ac-item';
      row.setAttribute('role', 'option');
      row.setAttribute('data-i', i);
      row.innerHTML =
        '<div class="ac-avatar">' + UI.escape(UI.initials(emp.name)) + '</div>' +
        '<div><div class="ac-mail">' + label + '</div>' +
        '<div class="ac-dept">' + UI.escape(emp.name) + ' · ' + UI.escape(emp.dept) + '</div></div>';
      row.addEventListener('mousedown', function (e) {
        e.preventDefault();
        choose(i);
      });
      ac.appendChild(row);
    });

    ac.classList.add('open');
    emailEl.setAttribute('aria-expanded', 'true');
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
    closeAC();
    clearErrors();
    deptEl.focus();
  }

  emailEl.addEventListener('input', function () {
    pickedEmail = null;      // typing invalidates a previous pick
    clearErrors();
    renderAC(emailEl.value);
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
    btnLabel.textContent = on ? 'Verifying' : 'Enter';
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

    setLoading(true);

    // Simulated network latency so the loading state is visible.
    setTimeout(function () {
      setLoading(false);

      var emp = DB.findByEmail(typed);

      // ERROR A — email not in the database, or never picked from the list.
      if (!emp || pickedEmail !== emp.email) {
        showEmailError();
        return;
      }

      if (!dept) {
        showDeptError();
        return;
      }

      // ERROR B — email is valid but the department does not match the record.
      if (dept !== emp.dept) {
        showDeptError();
        return;
      }

      UI.session.set({ email: emp.email, name: emp.name, dept: emp.dept });
      window.location.href = 'main-hall.html';
    }, 900);
  });

  /* ---------- State preview switcher (design deliverable) ---------- */
  var switcher = document.getElementById('stateSwitcher');
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
})();
