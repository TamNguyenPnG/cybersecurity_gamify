/* ============================================================
   Login portal.

   Talks to server.py: the email list comes from /api/employees (email +
   name only — never the department, so the dropdown can't leak the
   answer) and the identity check is done server-side by /api/auth/verify.
   ============================================================ */
I18N.ready.then(function () {
  'use strict';

  var form      = document.getElementById('loginForm');
  var nameEl    = document.getElementById('fullName');
  var emailEl   = document.getElementById('email');
  var deptEl    = document.getElementById('dept');
  var nameField = document.getElementById('nameField');
  var emailField= document.getElementById('emailField');
  var deptField = document.getElementById('deptField');
  var ac        = document.getElementById('emailAC');
  var btn       = document.getElementById('submitBtn');
  var btnLabel  = document.getElementById('btnLabel');
  var registerBtn = document.getElementById('registerBtn');
  var registerLabel = document.getElementById('registerLabel');
  var registrationMode = false;

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
    nameField.classList.remove('is-error', 'is-warning', 'shake');
    emailField.classList.remove('is-error', 'is-warning', 'shake');
    deptField.classList.remove('is-error', 'is-warning', 'shake');
  }
  function showNameError() {
    clearErrors();
    nameField.classList.add('is-error');
    void nameField.offsetWidth;
    nameField.classList.add('shake');
    nameEl.focus();
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
    if (registrationMode) { closeAC(); return; }
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
    if (!registrationMode) {
      var v = emailEl.value;
      debounce = setTimeout(function () { renderAC(v); }, 140);
    }
  });

  emailEl.addEventListener('focus', function () {
    if (!registrationMode && emailEl.value.trim()) renderAC(emailEl.value);
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
  nameEl.addEventListener('input', clearErrors);

  function setRegistrationMode(on) {
    registrationMode = on;
    nameField.hidden = !on;
    nameEl.required = on;
    clearErrors();
    closeAC();
    var submitKey = on ? 'login.createAccount' : 'login.cta';
    var toggleKey = on ? 'login.cancelRegister' : 'login.register';
    btnLabel.setAttribute('data-i18n', submitKey);
    btnLabel.textContent = I18N.t(submitKey);
    registerLabel.setAttribute('data-i18n', toggleKey);
    registerLabel.textContent = I18N.t(toggleKey);
    if (on) nameEl.focus();
  }

  /* ---------- Submit ---------- */
  function setLoading(button, label, on, loadingKey, idleKey) {
    button.disabled = on;
    label.setAttribute('data-i18n', on ? loadingKey : idleKey);
    label.textContent = I18N.t(on ? loadingKey : idleKey);
    var sp = button.querySelector('.spinner');
    if (on && !sp) {
      var s = document.createElement('span');
      s.className = 'spinner';
      button.appendChild(s);
    } else if (!on && sp) {
      sp.remove();
    }
  }

  registerBtn.addEventListener('click', function () {
    setRegistrationMode(!registrationMode);
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    clearErrors();
    closeAC();

    var submitAction = registrationMode ? 'register' : 'login';
    var typed = emailEl.value.trim().toLowerCase();
    var dept  = deptEl.value;

    if (submitAction === 'register' && !nameEl.value.trim()) { showNameError(); return; }
    if (!typed || (submitAction === 'login' && pickedEmail !== typed) || !emailEl.checkValidity()) {
      showEmailError(); return;
    }
    if (!dept) { showDeptError(); return; }

    if (submitAction === 'register') {
      setLoading(btn, btnLabel, true, 'login.registering', 'login.createAccount');
      registerBtn.disabled = true;
      API.register(typed, dept, nameEl.value.trim()).then(function (res) {
        setLoading(btn, btnLabel, false, 'login.registering', 'login.createAccount');
        registerBtn.disabled = false;
        if (!res.ok) {
          var key = res.error === 'email-already-registered' ? 'login.registerDuplicate' :
                    res.error === 'unknown-department' ? 'login.registerDepartment' : 'login.registerFailed';
          if (res.error === 'invalid-name') { showNameError(); return; }
          if (res.error === 'invalid-email') { showEmailError(); return; }
          UI.toast(I18N.t(key), 'bad');
          return;
        }
        pickedEmail = res.user.email;
        pickedName = res.user.name;
        emailEl.value = res.user.email;
        setRegistrationMode(false);
        UI.toast(I18N.t('login.registerSuccess'), 'ok');
      }, function (err) {
        setLoading(btn, btnLabel, false, 'login.registering', 'login.createAccount');
        registerBtn.disabled = false;
        UI.toast(I18N.t(err.code === 'email-already-registered' ? 'login.registerDuplicate' : 'login.registerFailed'), 'bad');
      });
      return;
    }

    setLoading(btn, btnLabel, true, 'login.verifying', 'login.cta');

    API.verify(typed, dept).then(function (res) {
      setLoading(btn, btnLabel, false, 'login.verifying', 'login.cta');
      if (!res.ok) { showEmailError(); return; }
      UI.session.set({
        email: res.user.email,
        name: res.user.name,
        dept: dept
      });
      window.location.href = 'main-hall.html';
    }, function (err) {
      setLoading(btn, btnLabel, false, 'login.verifying', 'login.cta');
      if (err.code === 'email-not-found') showEmailError();
      else UI.toast(I18N.t('ch.loadFailed'), 'error');
    });
  });
});
