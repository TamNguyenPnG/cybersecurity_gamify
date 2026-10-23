/* Persistent, non-linear chapter: four challenge rooms and a final key vault. */
GAMES.register('escape-room', (function () {
  'use strict';

  var el = GAMES.el;

  return {
    mount: function (host, cfg, ctx) {
      var user = UI.session.get();
      var state;
      var wrap = el('section', 'escape-game');
      var closeFullscreen;
      var renderCurrent = function () {};
      var stopChallenge = function () {};
      var dialog = null;
      var busy = false;
      var finished = false;

      function fitScreen() {
        var header = document.querySelector('header');
        wrap.style.setProperty('--fs-top', (header ? header.getBoundingClientRect().bottom : 0) + 'px');
      }
      function text(key) { return ctx.pick(cfg.ui[key]); }
      function node(tag, cls, value) {
        var n = el(tag, cls);
        if (value != null) n.textContent = value;
        return n;
      }
      function button(label, fn, cls) {
        var b = node('button', 'btn ' + (cls || 'btn-secondary'), label);
        b.type = 'button';
        b.addEventListener('click', fn);
        return b;
      }
      function image(src, alt, parent) {
        var img = node('img', 'escape-image');
        img.src = src;
        img.alt = alt;
        img.draggable = false;
        parent.appendChild(img);
        return img;
      }
      /* Tall or square artwork gets a narrow picture column. The class is set up
         front so the layout does not jump when the image finishes loading; the
         loaded size only corrects it (landscape artwork goes back to the wide layout). */
      function artLayout(c) {
        return 'escape-room-layout' + (c.image && c.type !== 'hotspots' ? ' is-portrait' : '');
      }
      function fitLayout(layout, img) {
        function mark() {
          layout.classList.toggle('is-portrait', img.naturalHeight >= img.naturalWidth * 0.9);
        }
        if (img.complete && img.naturalWidth) mark();
        else img.addEventListener('load', mark);
      }
      function score() {
        return cfg.rooms.filter(function (r) { return state.rooms[r.id].passed; }).length;
      }
      function paintScore() { ctx.progress(score() + (state.masterPassed ? 1 : 0)); }
      function removeDialog() {
        if (dialog) { dialog.close(); dialog.remove(); dialog = null; }
      }
      function modal(title, body, actions) {
        removeDialog();
        dialog = node('dialog', 'escape-dialog');
        dialog.appendChild(node('h2', '', title));
        if (body) dialog.appendChild(node('p', '', body));
        var controls = node('div', 'escape-controls');
        actions.forEach(function (a, i) {
          controls.appendChild(button(a.label, function () {
            removeDialog();
            a.run();
          }, i === 0 ? 'btn-primary btn-next' : 'btn-secondary'));
        });
        dialog.appendChild(controls);
        dialog.addEventListener('cancel', function (e) { e.preventDefault(); });
        wrap.appendChild(dialog);
        dialog.showModal();
      }
      function error(err, retry) {
        console.error('Escape room request failed:', err);
        renderCurrent = function () {
          modal(text('saveFailed'), err.code || err.message, [
            { label: text('retry'), run: retry },
            { label: text('hall'), run: loadHall }
          ]);
        };
        renderCurrent();
      }
      function action(name, payload, success) {
        if (busy) return;
        busy = true;
        wrap.setAttribute('aria-busy', 'true');
        API.escapeAction(name, Object.assign({ email: user.email }, payload)).then(function (r) {
          busy = false;
          wrap.removeAttribute('aria-busy');
          state = r.progress || r;
          paintScore();
          success(r);
        }, function (err) {
          busy = false;
          wrap.removeAttribute('aria-busy');
          error(err, function () { action(name, payload, success); });
        });
      }
      function screen(draw) {
        stopChallenge();
        stopChallenge = function () {};
        ctx.clearTimer();
        removeDialog();
        renderCurrent = draw;
        draw();
      }
      function backButton() {
        var b = button('\u2190 ' + text('hall'), loadHall, 'escape-back');
        b.dataset.back = '';
        return b;
      }
      function makeBar(title, back) {
        var bar = node('div', 'escape-bar');
        bar.appendChild(node('h2', '', title));
        if (back) bar.appendChild(backButton());
        return bar;
      }
      function chrome(title, back) {
        wrap.replaceChildren();
        wrap.appendChild(makeBar(title, back));
      }
      function statusLabel(room) {
        var s = state.rooms[room.id];
        if (s.passed) return text('key') + ': ' + s.hint;
        var played = Object.keys(s.results).length;
        if (played && played < room.challenges.length) return text('inProgress');
        return text(s.attempted ? 'played' : 'notPlayed');
      }
      function showHall() {
        screen(function () {
          chrome(ctx.pick(cfg.title), false);
          var stage = node('div', 'escape-hall');
          image(cfg.hallImage, ctx.pick(cfg.title), stage);
          cfg.rooms.concat([{ id: 'master', door: cfg.masterDoor }]).forEach(function (r) {
            var master = r.id === 'master';
            var title = master ? text('master') : ctx.pick(r.title);
            var label = master ? text(state.masterUnlocked ? 'unlocked' : 'locked') : statusLabel(r);
            var door = button(title + '\n' + label, function () {
              if (master) {
                if (!state.masterUnlocked) {
                  return modal(text('locked'), text('masterLocked'), [
                    { label: text('continue'), run: showHall }
                  ]);
                }
                return openDoor(door, showMaster);
              }
              openDoor(door, function () { showRoom(r); });
            }, 'escape-door' + (master && !state.masterUnlocked ? ' is-locked' : ''));
            var rect = r.door;
            door.style.left = rect[0] * 100 + '%';
            door.style.top = rect[1] * 100 + '%';
            door.style.width = (rect[2] - rect[0]) * 100 + '%';
            door.style.height = (rect[3] - rect[1]) * 100 + '%';
            door.dataset.room = r.id;
            door.setAttribute('aria-label', title + ': ' + label);
            stage.appendChild(door);
          });
          wrap.appendChild(stage);
          var list = node('nav', 'escape-room-nav');
          cfg.rooms.forEach(function (r) {
            list.appendChild(button(ctx.pick(r.title) + ' · ' + statusLabel(r), function () { showRoom(r); }));
          });
          wrap.appendChild(list);
          wrap.appendChild(node('p', 'escape-note', text('keyOrder')));
          wrap.appendChild(node('p', 'escape-note', text('saved')));
        });
      }
      function openDoor(door, next) {
        if (busy) return;
        busy = true;
        door.classList.add('is-opening');
        setTimeout(function () { busy = false; next(); }, 360);
      }
      function loadHall() {
        if (busy) return;
        stopChallenge();
        ctx.clearTimer();
        busy = true;
        wrap.setAttribute('aria-busy', 'true');
        API.escapeStatus(user.email).then(function (r) {
          busy = false;
          wrap.removeAttribute('aria-busy');
          state = r;
          paintScore();
          showHall();
        }, function (err) {
          busy = false;
          wrap.removeAttribute('aria-busy');
          error(err, loadHall);
        });
      }
      function showRoom(room) {
        screen(function () {
          chrome(ctx.pick(room.title), true);
          var layout = node('div', 'escape-room-layout');
          var art = node('div', 'escape-art escape-room-art');
          image(room.image, ctx.pick(room.title), art);
          var s = state.rooms[room.id];
          room.challenges.forEach(function (c, index) {
            var has = Object.prototype.hasOwnProperty.call(s.results, c.id);
            var passedNow = has && s.results[c.id] === true && !s.passed;
            var failedNow = has && s.results[c.id] === false && !s.passed;
            var b = button('', function () {
              if (s.passed) startRoom(room, index);
              else if (!s.run_id) startRoom(room, index);
              else playChallenge(room, index);
            }, 'escape-challenge-door' + (passedNow ? ' is-passed' : '') + (failedNow ? ' is-failed' : ''));
            if (passedNow) {
              b.appendChild(node('span', 'door-state', '\u2713 ' + text('passed')));
            } else if (failedNow) {
              b.appendChild(node('span', 'door-state', '\u2717 ' + text('failed')));
              b.appendChild(node('span', 'door-start', text('startChallenge')));
            } else {
              b.appendChild(node('span', '', text('startChallenge')));
            }
            position(b, room.challengeDoors[index]);
            b.dataset.challenge = c.id;
            b.setAttribute('aria-label', ctx.pick(c.title) + (passedNow ? ': ' + text('passed') :
              failedNow ? ': ' + text('failed') + ' \u2014 ' + text('startChallenge') : ''));
            b.disabled = passedNow;
            art.appendChild(b);
          });
          layout.appendChild(art);
          var panel = node('div', 'escape-panel');
          panel.appendChild(node('h3', s.passed ? 'escape-key' : '', statusLabel(room)));
          panel.appendChild(node('p', '', text('roomRules')));
          var complete = Object.keys(s.results).length === room.challenges.length;
          if (s.passed) {
            panel.appendChild(button(text('replay'), function () { startRoom(room, 0); }, 'btn-primary'));
          } else {
            room.challenges.forEach(function (c, index) {
              var has = Object.prototype.hasOwnProperty.call(s.results, c.id);
              var ok = has && s.results[c.id] === true;
              var b = button((index + 1) + '. ' + ctx.pick(c.title) + ' — ' +
                (ok ? text('passed') : (has ? text('failed') + ' \u00b7 ' : '') + (ok ? '' : text('startChallenge'))), function () {
                if (!s.run_id) startRoom(room, index);
                else playChallenge(room, index);
              }, ok ? 'btn-secondary' : 'btn-primary');
              b.disabled = ok;
              panel.appendChild(b);
            });
            if (complete) {
              panel.appendChild(button(text('replay'), function () { startRoom(room, 0); }));
            }
          }
          layout.appendChild(panel);
          wrap.appendChild(layout);
        });
      }
      function startRoom(room, index) {
        action('start', { room_id: room.id }, function () { playChallenge(room, index); });
      }
      /* A challenge may carry its own failure message in `miss`. */
      function missText(c, answers) {
        if (c.type === 'alarm' && answers.elapsed + (answers.errors || 0) * 5 >= c.seconds) return text('alarmMiss');
        return c.miss ? ctx.pick(c.miss) : text('challengeMiss');
      }
      function finishChallenge(room, c, answers) {
        stopChallenge();
        stopChallenge = function () {};
        ctx.clearTimer();
        var payload = {
          room_id: room.id, run_id: state.rooms[room.id].run_id,
          challenge_id: c.id, answers: answers
        };
        action('challenge', payload, function (r) {
          renderCurrent = function () {
            modal(text(r.passed ? (c.type === 'alarm' ? 'alarmWin' : 'challengeWin') : 'failed'),
              r.passed && c.type === 'sms' ? text('smishing') :
                (r.passed ? ctx.pick(c.title) : missText(c, answers)), [
                  { label: text('continue'), run: function () { nextChallenge(room, c); } }
                ]);
          };
          renderCurrent();
        });
      }
      function nextChallenge(room, current) {
        var start = room.challenges.indexOf(current);
        var results = state.rooms[room.id].results;
        for (var i = 1; i <= room.challenges.length; i++) {
          var next = (start + i) % room.challenges.length;
          if (!Object.prototype.hasOwnProperty.call(results, room.challenges[next].id)) {
            return playChallenge(room, next);
          }
        }
        showRoom(room);
        renderCurrent = function () {
          var s = state.rooms[room.id];
          modal(ctx.pick(room.title), s.passed ? text('roomWin') + ' ' + s.hint : text('roomMiss'), [
            { label: text('hall'), run: showHall },
            { label: text('replay'), run: function () { startRoom(room, 0); } }
          ]);
        };
        renderCurrent();
      }
      function playChallenge(room, index) {
        var c = room.challenges[index];
        var data = { choice: null, marks: [], found: [], placements: {}, order: [], actions: [], errors: 0 };
        var selected = null;
        var alertStarted = null;
        var timer = null;
        var submitted = false;
        var feedback = '';
        var options = c.options ? GAMES.shuffle(c.options) : [];
        var items = c.items ? GAMES.shuffle(c.items) : [];
        var clues = c.clues ? GAMES.shuffle(c.clues) : [];
        var bubble = { started: false, built: false, handle: null, live: [], title: null, prompt: null };
        if (c.type === 'sequence') data.order = new Array(c.order.length).fill(null);

        function left() {
          return Math.max(0, c.seconds - (Date.now() - alertStarted) / 1000 - data.errors * 5);
        }
        function submit() {
          if (submitted || busy) return;
          submitted = true;
          if (alertStarted != null) data.elapsed = (Date.now() - alertStarted) / 1000;
          finishChallenge(room, c, data);
        }
        function vaultText(key, vars) {
          var s = ctx.pick(cfg.ui[key]);
          Object.keys(vars || {}).forEach(function (k) { s = s.replace('{' + k + '}', vars[k]); });
          return s;
        }
        /* The chapter 2 bubble game, run inside this room. Its own outcome
           dialog is skipped: the result is sent to the server like any other. */
        function drawBubbles() {
          var title = ctx.pick(room.title) + ' \u00b7 ' + (index + 1) + '/' + room.challenges.length;
          if (bubble.built) {
            var old = wrap.querySelector('.escape-bar');
            if (old) old.replaceWith(makeBar(title, true));
            bubble.title.textContent = ctx.pick(c.title);
            bubble.prompt.textContent = ctx.pick(c.prompt);
            bubble.thumb.alt = ctx.pick(c.title);
            bubble.live.forEach(function (fn) { fn(); });
            return;
          }
          chrome(title, true);
          var skip = button(text('skip'), function () { data = {}; submit(); });
          if (!bubble.started) {
            /* Before the game: the challenge picture beside its brief, like every other challenge. */
            var intro = node('div', artLayout(c));
            var introArt = node('div', 'escape-art');
            var pic = image(c.image || room.image, ctx.pick(c.title), introArt);
            var introPanel = node('div', 'escape-panel');
            introPanel.appendChild(node('h3', '', ctx.pick(c.title)));
            introPanel.appendChild(node('p', 'escape-prompt', ctx.pick(c.prompt)));
            introPanel.appendChild(button(ctx.t('game.start'), function () { bubble.started = true; draw(); }, 'btn-primary'));
            introPanel.appendChild(skip);
            intro.appendChild(introArt);
            intro.appendChild(introPanel);
            wrap.appendChild(intro);
            fitLayout(intro, pic);
            return;
          }
          bubble.built = true;
          /* While playing the arena needs the width, so the picture shrinks to a thumbnail. */
          var box = node('div', 'escape-bubble-box');
          var head = node('div', 'escape-bubble-head');
          bubble.thumb = image(c.image || room.image, ctx.pick(c.title), head);
          var headText = node('div', 'escape-bubble-text');
          bubble.title = node('h3', '', ctx.pick(c.title));
          bubble.prompt = node('p', 'escape-prompt', ctx.pick(c.prompt));
          headText.appendChild(bubble.title);
          headText.appendChild(bubble.prompt);
          head.appendChild(headText);
          box.appendChild(head);
          wrap.appendChild(box);
          var arenaHost = node('div', 'escape-bubble-host');
          box.appendChild(arenaHost);
          box.appendChild(skip);
          var gameCfg = Object.assign({}, c, { points: 1, timeLimitS: c.seconds, noIntro: true });
          bubble.handle = GAMES.get('bubbles').mount(arenaHost, gameCfg, {
            pick: ctx.pick,
            setTimer: ctx.setTimer,
            clearTimer: ctx.clearTimer,
            t: function (key, vars) {
              if (key === 'game.bubbles.collected') return vaultText('vaultFound', vars);
              if (key === 'game.bubbles.livesAria') return vaultText('vaultLives');
              return ctx.t(key, vars);
            },
            live: function (fn) { bubble.live.push(fn); fn(); },
            finish: function (points, detail) {
              data = { hits: (detail.hits || []).map(function (h) { return h.id; }) };
              submit();
            }
          });
        }
        function btnChoice(option, fn, active) {
          var b = button(ctx.pick(option.label), fn, 'escape-option' + (active ? ' is-selected' : ''));
          b.dataset.option = option.id;
          return b;
        }
        /* Full-width find-the-risks view. Once everything is found the player
           reviews the marked image and presses Complete; nothing auto-exits. */
        function drawDetective() {
          chrome(ctx.pick(room.title) + ' \u00b7 ' + (index + 1) + '/' + room.challenges.length, true);
          var all = data.found.length === c.hotspots.length;
          var bar = node('div', 'escape-detective-bar');
          bar.appendChild(node('strong', '', ctx.pick(c.title) + ' \u2014 ' + text('found') + ': ' +
            data.found.length + '/' + c.hotspots.length));
          var note = all ? text('allFound') : (feedback || ctx.pick(c.prompt));
          bar.appendChild(node('span', all ? 'escape-feedback' : 'escape-detective-hint', note));
          if (all) {
            var done = button(text('complete'), submit, 'btn-primary btn-next');
            done.dataset.complete = '';
            bar.appendChild(done);
          } else {
            bar.appendChild(button(text('skip'), function () { data = {}; submit(); }));
          }
          wrap.appendChild(bar);

          var stage = node('div', 'escape-detective-full');
          var frame = node('div', 'escape-detective-frame');
          var img = image(c.image, ctx.pick(c.title), frame);
          c.hotspots.forEach(function (h) {
            if (data.found.indexOf(h.id) === -1) return;
            var ring = node('span', 'escape-risk-ring');
            position(ring, h.rect);
            ring.appendChild(node('span', 'escape-risk-pin' + (h.rect[1] < 0.1 ? ' is-below' : ''),
              '\u2713 ' + ctx.pick(h.label)));
            frame.appendChild(ring);
          });
          stage.appendChild(frame);
          wrap.appendChild(stage);
          if (all) return;
          img.addEventListener('click', function (e) {
            var box = img.getBoundingClientRect();
            var x = (e.clientX - box.left) / box.width;
            var y = (e.clientY - box.top) / box.height;
            var h = c.hotspots.find(function (h) {
              return x >= h.rect[0] && x <= h.rect[2] && y >= h.rect[1] && y <= h.rect[3];
            });
            if (h && data.found.indexOf(h.id) === -1) {
              data.found.push(h.id);
              feedback = '';
            } else if (!h) feedback = text('miss');
            draw();
          });
        }
        function draw() {
          if (c.type === 'hotspots' && c.fullscreen) return drawDetective();
          if (c.type === 'bubbles') return drawBubbles();
          chrome(ctx.pick(room.title) + ' · ' + (index + 1) + '/' + room.challenges.length, true);
          var layout = node('div', artLayout(c));
          var art = node('div', 'escape-art');
          var panel = node('div', 'escape-panel');
          var pic = image(c.image || room.image, ctx.pick(c.title), art);
          fitLayout(layout, pic);
          panel.appendChild(node('h3', '', ctx.pick(c.title)));
          panel.appendChild(node('p', 'escape-prompt', ctx.pick(c.prompt)));
          if (feedback) panel.appendChild(node('p', 'escape-feedback', feedback));
          layout.appendChild(art);
          layout.appendChild(panel);
          wrap.appendChild(layout);

          if (c.type === 'choice' || (c.type === 'sms' && data.choice == null)) {
            options.forEach(function (o) {
              panel.appendChild(btnChoice(o, function () {
                data.choice = o.id;
                if (c.type === 'sms' && o.id === c.correct) draw();
                else submit();
              }));
            });
          } else if (c.type === 'sms') {
            panel.appendChild(node('p', '', text('chooseClues')));
            clues.forEach(function (o) {
              var active = data.marks.indexOf(o.id) !== -1;
              panel.appendChild(btnChoice(o, function () {
                if (active) data.marks.splice(data.marks.indexOf(o.id), 1);
                else data.marks.push(o.id);
                draw();
              }, active));
            });
            var check = button(text('submit'), submit, 'btn-primary');
            check.disabled = data.marks.length !== 3;
            panel.appendChild(check);
          } else if (c.type === 'hotspots') {
            art.classList.add('escape-detective');
            var frame = node('div', 'escape-detective-frame');
            var img = art.querySelector('img');
            art.appendChild(frame);
            frame.appendChild(img);
            c.hotspots.forEach(function (h) {
              if (data.found.indexOf(h.id) === -1) return;
              var ring = node('span', 'escape-risk-ring');
              position(ring, h.rect);
              frame.appendChild(ring);
              panel.appendChild(node('p', 'escape-feedback', '\u2713 ' + ctx.pick(h.label)));
            });
            panel.appendChild(node('p', '', text('found') + ': ' + data.found.length + '/' + c.hotspots.length));
            img.addEventListener('click', function (e) {
              var box = img.getBoundingClientRect();
              var x = (e.clientX - box.left) / box.width;
              var y = (e.clientY - box.top) / box.height;
              var h = c.hotspots.find(function (h) {
                return x >= h.rect[0] && x <= h.rect[2] && y >= h.rect[1] && y <= h.rect[3];
              });
              if (h && data.found.indexOf(h.id) === -1) {
                data.found.push(h.id);
                feedback = '';
                if (data.found.length === c.hotspots.length) return submit();
              } else if (!h) feedback = text('miss');
              draw();
            });
          } else if (c.type === 'sort') {
            if (!c.hideProgress) {
              panel.appendChild(node('p', '', text('assigned') + ': ' + Object.keys(data.placements).length + '/' + items.length));
            }
            items.forEach(function (o) {
              var group = c.groups.find(function (g) { return g.id === data.placements[o.id]; });
              var b = btnChoice(o, function () { selected = o.id; draw(); }, selected === o.id);
              if (group) {
                var tag = node('small', 'escape-tag' + (group.tone ? ' is-' + group.tone : ''),
                  ' \u2192 ' + ctx.pick(group.label));
                b.appendChild(tag);
              }
              b.draggable = true;
              b.addEventListener('dragstart', function (e) {
                selected = o.id;
                e.dataTransfer.setData('text/plain', o.id);
              });
              panel.appendChild(b);
            });
            var groups = node('div', 'escape-groups');
            c.groups.forEach(function (g) {
              function assign(id) {
                if (!items.some(function (o) { return o.id === id; })) return;
                data.placements[id] = g.id;
                selected = null;
                draw();
              }
              var target = button('', function () { if (selected) assign(selected); },
                'escape-drop' + (g.tone ? ' is-' + g.tone : ''));
              if (g.icon) {
                var icon = node('img', 'escape-drop-icon');
                icon.src = g.icon;
                icon.alt = '';
                icon.draggable = false;
                target.appendChild(icon);
              }
              target.appendChild(node('span', '', ctx.pick(g.label)));
              target.dataset.group = g.id;
              target.addEventListener('dragover', function (e) { e.preventDefault(); });
              target.addEventListener('drop', function (e) { e.preventDefault(); assign(e.dataTransfer.getData('text/plain')); });
              groups.appendChild(target);
            });
            panel.appendChild(groups);
            var send = button(text('submit'), submit, 'btn-primary');
            send.disabled = Object.keys(data.placements).length !== items.length;
            panel.appendChild(send);
          } else if (c.type === 'sequence') {
            /* Tiles may go into any slot, be swapped or taken back freely.
               Nothing is judged until Submit, so a wrong order costs nothing early.
               `vertical` stacks the slots top to bottom as a to-do list. */
            var put = function (slotIndex, id) {
              if (!id || items.every(function (o) { return o.id !== id; })) return;
              var from = data.order.indexOf(id);
              var displaced = data.order[slotIndex];
              data.order[slotIndex] = id;
              if (from !== -1 && from !== slotIndex) data.order[from] = displaced;
              selected = null;
              draw();
            };
            var track = node('div', 'escape-slots' + (c.vertical ? ' is-vertical' : ''));
            track.style.setProperty('--cols', c.vertical ? 1 : (c.order.length <= 4 ? c.order.length : Math.ceil(c.order.length / 2)));
            c.order.forEach(function (stepId, i) {
              var tile = items.find(function (o) { return o.id === data.order[i]; });
              var slot = button('', function () {
                if (selected) return put(i, selected);
                if (tile) { data.order[i] = null; draw(); }
              }, 'escape-slot' + (tile ? ' is-filled' : ''));
              slot.dataset.slot = i;
              slot.appendChild(node('small', '', String(i + 1)));
              slot.appendChild(node('span', '', tile ? ctx.pick(tile.label) : ''));
              if (tile) {
                slot.dataset.tile = tile.id;
                slot.draggable = true;
                slot.addEventListener('dragstart', function (e) {
                  e.dataTransfer.setData('text/plain', tile.id);
                });
              }
              slot.addEventListener('dragover', function (e) {
                e.preventDefault();
                slot.classList.add('is-over');
              });
              slot.addEventListener('dragleave', function () { slot.classList.remove('is-over'); });
              slot.addEventListener('drop', function (e) {
                e.preventDefault();
                put(i, e.dataTransfer.getData('text/plain'));
              });
              track.appendChild(slot);
            });
            panel.appendChild(track);
            var tray = node('div', 'escape-tray');
            tray.addEventListener('dragover', function (e) { e.preventDefault(); });
            tray.addEventListener('drop', function (e) {
              e.preventDefault();
              var back = data.order.indexOf(e.dataTransfer.getData('text/plain'));
              if (back !== -1) { data.order[back] = null; draw(); }
            });
            items.forEach(function (o) {
              if (data.order.indexOf(o.id) !== -1) return;
              var tileBtn = btnChoice(o, function () { selected = selected === o.id ? null : o.id; draw(); }, selected === o.id);
              tileBtn.classList.add('escape-tile');
              tileBtn.draggable = true;
              tileBtn.addEventListener('dragstart', function (e) {
                e.dataTransfer.setData('text/plain', o.id);
              });
              tray.appendChild(tileBtn);
            });
            panel.appendChild(tray);
            panel.appendChild(button(text('reset'), function () {
              data.order = new Array(c.order.length).fill(null);
              selected = null;
              draw();
            }));
            var seal = button(text('submit'), submit, 'btn-primary');
            seal.disabled = data.order.some(function (id) { return !id; });
            panel.appendChild(seal);
          } else if (c.type === 'alarm') {
            if (alertStarted == null) {
              panel.appendChild(button(ctx.t('game.start'), function () {
                alertStarted = Date.now();
                timer = setInterval(function () {
                  var clock = wrap.querySelector('[data-alarm-clock]');
                  if (clock) clock.textContent = Math.ceil(left()) + 's';
                  if (left() <= 0) { feedback = text('alarmMiss'); submit(); }
                }, 100);
                draw();
              }, 'btn-primary'));
            } else {
              var clock = node('strong', 'escape-clock', Math.ceil(left()) + 's');
              clock.setAttribute('data-alarm-clock', '');
              panel.appendChild(clock);
              panel.appendChild(node('p', '', text('alerts') + ': ' + data.actions.length + '/4'));
              var alert = c.alerts[data.actions.length];
              if (alert) {
                var alertWindow = node('div', 'escape-alert-window');
                alertWindow.appendChild(node('h3', '', ctx.pick(alert.title)));
                panel.appendChild(alertWindow);
                alert.options.forEach(function (o) {
                  alertWindow.appendChild(btnChoice(o, function () {
                    if (left() <= 0) return submit();
                    if (o.id === alert.correct) {
                      data.actions.push(o.id);
                      feedback = ctx.pick(alert.learning);
                      if (data.actions.length === c.alerts.length) return submit();
                    } else {
                      data.errors += 1;
                      feedback = text('incorrect');
                      if (left() <= 0) return submit();
                    }
                    draw();
                  }));
                });
              }
            }
          }
          panel.appendChild(button(text('skip'), function () {
            data = {};
            submit();
          }));
        }
        screen(draw);
        stopChallenge = function () {
          if (timer) clearInterval(timer);
          if (bubble.handle) bubble.handle.stop();
        };
      }
      function position(n, r) {
        n.style.left = r[0] * 100 + '%';
        n.style.top = r[1] * 100 + '%';
        n.style.width = (r[2] - r[0]) * 100 + '%';
        n.style.height = (r[3] - r[1]) * 100 + '%';
      }
      /* Same rectangle as position(), but as CSS variables so the stylesheet can
         drop the overlay into normal flow on narrow screens. */
      function pad(n, r) {
        n.style.setProperty('--l', r[0] * 100 + '%');
        n.style.setProperty('--t', r[1] * 100 + '%');
        n.style.setProperty('--w', (r[2] - r[0]) * 100 + '%');
        n.style.setProperty('--h', (r[3] - r[1]) * 100 + '%');
      }
      /* The key entry sits on the keypad painted in the Master Room image: four
         letter boxes and the LAUNCH button. Pressing LAUNCH starts a countdown
         with a bait "download your certificate" button; clicking it fails the launch. */
      function showMaster() {
        if (!state.masterUnlocked) return showHall();
        var keypad = cfg.masterKeypad;
        var letters = ['', '', '', ''];
        var deadline = null;
        var ticker = null;
        var notice = '';

        function secondsLeft() { return Math.max(0, Math.ceil((deadline - Date.now()) / 1000)); }
        function stopTicker() {
          if (ticker) { clearInterval(ticker); ticker = null; }
        }
        function sendLaunch(trap) {
          stopTicker();
          deadline = null;
          action('master', { code: letters.join(''), trap: trap }, function (r) { showVideo(r.passed, trap); });
        }
        function startCountdown() {
          notice = '';
          deadline = Date.now() + keypad.seconds * 1000;
          ticker = setInterval(function () {
            var n = secondsLeft();
            var clock = wrap.querySelector('[data-launch-clock]');
            if (clock) clock.textContent = String(n);
            if (n <= 0) sendLaunch(false);
          }, 200);
          draw();
        }
        function draw() {
          chrome(text('master'), true);
          var secured = cfg.rooms.every(function (r) { return state.rooms[r.id].passed; });
          var keys = node('div', 'escape-key-row');
          cfg.rooms.forEach(function (r) {
            var hint = state.rooms[r.id].hint;
            keys.appendChild(node('span', 'escape-key-chip' + (hint ? ' is-earned' : ''),
              ctx.pick(r.title) + ' \u00b7 ' + (hint || '?')));
          });
          wrap.appendChild(keys);
          if (!secured) wrap.appendChild(node('p', 'escape-feedback escape-master-note', text('needAllRooms')));
          if (notice) wrap.appendChild(node('p', 'escape-feedback escape-master-note', notice));

          var launching = deadline != null;
          var stage = node('div', 'escape-master-stage');
          var frame = node('div', 'escape-master-frame');
          image(cfg.masterImage, text('master'), frame);
          var form = node('form', 'escape-keypad');
          form.setAttribute('aria-label', text('code'));
          form.noValidate = true;
          var boxes = [];
          keypad.boxes.forEach(function (rect, i) {
            var inp = node('input', 'escape-key-box');
            inp.type = 'text';
            inp.maxLength = 1;
            inp.autocomplete = 'off';
            inp.autocapitalize = 'characters';
            inp.spellcheck = false;
            inp.value = letters[i];
            inp.disabled = launching;
            inp.dataset.keybox = i;
            inp.setAttribute('aria-label', text('launchChar').replace('{n}', i + 1));
            pad(inp, rect);
            inp.addEventListener('focus', function () { inp.select(); });
            inp.addEventListener('input', function () {
              var v = inp.value.replace(/[^A-Za-z]/g, '').slice(-1).toUpperCase();
              inp.value = v;
              letters[i] = v;
              if (v && i < boxes.length - 1) boxes[i + 1].focus();
            });
            inp.addEventListener('keydown', function (e) {
              if (e.key === 'Backspace' && !inp.value && i > 0) {
                e.preventDefault();
                letters[i - 1] = '';
                boxes[i - 1].value = '';
                boxes[i - 1].focus();
              } else if (e.key === 'ArrowLeft' && i > 0) {
                boxes[i - 1].focus();
              } else if (e.key === 'ArrowRight' && i < boxes.length - 1) {
                boxes[i + 1].focus();
              }
            });
            inp.addEventListener('paste', function (e) {
              e.preventDefault();
              var pasted = (e.clipboardData.getData('text') || '').replace(/[^A-Za-z]/g, '').toUpperCase();
              for (var k = 0; k < pasted.length && i + k < boxes.length; k++) {
                letters[i + k] = pasted.charAt(k);
                boxes[i + k].value = pasted.charAt(k);
              }
              boxes[Math.min(i + pasted.length, boxes.length - 1)].focus();
            });
            boxes.push(inp);
            form.appendChild(inp);
          });
          var go = node('button', 'escape-launch', launching ? text('launching') : text('launch'));
          go.type = 'submit';
          go.disabled = launching;
          pad(go, keypad.launch);
          form.appendChild(go);
          form.addEventListener('submit', function (e) {
            e.preventDefault();
            if (launching || busy) return;
            if (letters.some(function (l) { return !l; })) {
              notice = text('codeIncomplete');
              draw();
              var firstEmpty = wrap.querySelectorAll('.escape-key-box')[letters.findIndex(function (l) { return !l; })];
              if (firstEmpty) firstEmpty.focus();
              return;
            }
            startCountdown();
          });
          frame.appendChild(form);
          if (launching) {
            var clock = node('div', 'escape-launch-clock');
            clock.setAttribute('role', 'timer');
            clock.appendChild(node('strong', '', String(secondsLeft())));
            clock.firstChild.setAttribute('data-launch-clock', '');
            clock.appendChild(node('small', '', text('countdown')));
            pad(clock, keypad.clock);
            frame.appendChild(clock);
            var bait = button('', function () { sendLaunch(true); }, 'escape-trap');
            bait.appendChild(node('span', '', '\u2B07 ' + text('trapButton')));
            bait.dataset.trap = '';
            pad(bait, keypad.trap);
            frame.appendChild(bait);
          }
          stage.appendChild(frame);
          wrap.appendChild(stage);
        }
        screen(draw);
        stopChallenge = stopTicker;
      }
      /* Ends the chapter with whatever has been earned and goes to the result page. */
      function finishChapter() {
        if (finished) return;
        finished = true;
        stopChallenge();
        window.removeEventListener('pagehide', cleanup);
        window.removeEventListener('resize', fitScreen);
        closeFullscreen();
        ctx.finish(score() + (state.masterPassed ? 1 : 0), { rooms: state.rooms, master: !!state.masterPassed });
      }
      /* A failed launch: after the video the player is told the mission was not
         completed and invited to play again. `ended` survives a language switch,
         which redraws this screen without replaying the video. */
      function showVideo(passed, trapped, ended) {
        var resumeAt = 0;
        screen(function () {
          var oldVideo = wrap.querySelector('video');
          if (oldVideo) resumeAt = oldVideo.currentTime;
          chrome(text(passed ? 'launchWin' : (trapped ? 'launchTrap' : 'launchFail')), false);
          var video = node('video', 'escape-video');
          video.src = passed ? cfg.winVideo : cfg.failVideo;
          video.autoplay = !ended;
          video.muted = true;
          video.playsInline = true;
          video.controls = true;
          video.addEventListener('loadedmetadata', function () {
            if (ended) video.currentTime = Math.max(0, video.duration - 0.05);
            else if (resumeAt) video.currentTime = resumeAt;
          });
          var controls = node('div', 'escape-controls');
          function play() {
            video.play().catch(function (err) {
              console.error('Escape video autoplay failed:', err);
              UI.toast(text('playVideo'), 'bad');
            });
          }
          function announceFailure() {
            if (passed) return;
            ended = true;
            renderCurrent = function () { showVideo(passed, trapped, true); };
            modal(text('failTitle'), text('failBody'), [
              { label: text('playAgain'), run: showMaster },
              { label: text('results'), run: finishChapter },
              { label: text('hall'), run: loadHall }
            ]);
          }
          controls.appendChild(button(text('playVideo'), play));
          controls.appendChild(backButton());
          if (!passed) controls.appendChild(button(text('retry'), showMaster));
          controls.appendChild(button(text('results'), finishChapter, 'btn-primary btn-next'));
          video.addEventListener('ended', announceFailure);
          video.addEventListener('error', function () {
            UI.toast(text('videoError'), 'bad');
            announceFailure();
          });
          wrap.appendChild(video);
          wrap.appendChild(controls);
          if (ended) announceFailure();
          else play();
        });
      }
      function cleanup() {
        stopChallenge();
        removeDialog();
        window.removeEventListener('resize', fitScreen);
      }
      window.addEventListener('pagehide', cleanup);
      ctx.live(function () { renderCurrent(); fitScreen(); });
      host.appendChild(node('p', '', text('loading')));
      function load() {
        API.escapeStatus(user.email).then(function (r) {
          state = r;
          paintScore();
          host.replaceChildren();
          GAMES.intro(host, cfg, ctx, function () {
            closeFullscreen = GAMES.fullscreen(wrap);
            window.addEventListener('resize', fitScreen);
            showHall();
          });
        }, function (err) {
          console.error('Could not load escape progress:', err);
          host.replaceChildren(node('p', '', text('loadFailed')), button(text('retry'), load));
        });
      }
      load();
    }
  };
})());
