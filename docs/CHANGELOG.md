# Changelog

All notable changes to **Cybersecurity Awareness Month — October 2026**.

---

## 2026-09-25 — v2.2 "The real roster"

The demo list of 18 invented people is gone. The site now runs on the actual
HR list: **254 employees across 15 departments**.

### How the roster gets in

```
data/source/EE List - Cybersecurity.xlsx   ← what HR sends
        │  python data/scripts/import_roster.py
        ▼
data/source/employees.csv                  ← readable, hand-correctable
        │  python data/scripts/build_db.py --reset
        ▼
data/app.db
```

The CSV in the middle means `build_db.py` needs **only the Python standard
library** — a deployment box does not need `openpyxl` — and a single wrong
department is a one-line fix rather than a spreadsheet round-trip.

### None of this is in git

`data/source/` is **gitignored**, alongside `data/app.db`. This repository is
public, and the roster is 254 real names and real email addresses; publishing
it would be a privacy breach. The roster lives only on the machine that runs
the site.

A fresh checkout therefore has no roster. `build_db.py` seeds a five-person
demo list so the site still starts; drop the spreadsheet into `data/source/`
and run the two commands above to load the real one.

**`data/scripts/import_roster.py`** (new) reads the `Name`, `Email` and
`Function` columns and:

* splits `TRAN NHI (NHÌ TRẦN)` into `name` = *Tran Nhi* and
  `name_vi` = *Nhì Trần*, so the Vietnamese spelling is available for display;
* normalises capitalisation, since the spreadsheet mixes ALL CAPS and Title Case;
* skips malformed emails and duplicates, and reports each one;
* files anyone with a blank `Function` under **Global Innovation** rather than
  dropping them, so the headcount always matches the spreadsheet. One person
  (`tran.n.9@pg.com`) is in that position.

**`data/scripts/build_db.py`** no longer carries a hard-coded list. It reads
the CSV, derives the department dropdown from whatever departments actually
appear, and falls back to a five-person demo roster if the CSV is missing so
the site still starts on a fresh clone.

> The login dropdown is now: Digital · ESS · Engineering · Global Innovation ·
> HDL · HR · Home Care · I-Trade · ICA · LFE · MPD & SIEL · Plant Manager ·
> Platform · QA/QC · WHSNO.

### New: a `performance` view

`attempts` is an append-only ledger — good for auditing, awkward for reporting.
Alongside it there is now **`performance`**, one row per person per chapter:

| | |
|---|---|
| `plays` | how many times they played |
| `best_score` · `worst_score` · `avg_score` · `max_score` | the score spread |
| `total_time_s` | seconds across every attempt |
| `first_perfect_attempt` | which attempt first hit full marks, or `NULL` |
| `first_played_at` · `last_played_at` | ISO-8601 UTC |

plus `name`, `name_vi` and `department` joined in, so a ranking or a
department breakdown is a single `SELECT`.

It is a **view**, not a table: nothing writes to it, and it is recalculated on
every query, so it can never drift out of step with `attempts`. Example
queries are in `setup-guide.md` §8.

### Schema changes

```sql
employees ADD COLUMN name_vi TEXT      -- Vietnamese spelling
CREATE VIEW performance                -- rollup of attempts
```

Both require a rebuild: `python data\scripts\build_db.py --reset`.

### Files touched

```
data/scripts/import_roster.py    new — spreadsheet → employees.csv
data/scripts/build_db.py         reads the CSV; name_vi; performance view
.gitignore                       data/source/ excluded — real personal data
docs/setup-guide.md              §4 rewritten; §8 rewritten around performance
docs/data-contract.md            employees + performance documented
public/assets/js/pages/login.js  preview states use real departments
README.md                        data section and structure updated
```

---

## 2026-09-25 — v2.1.1 "Two bug fixes"

### 1. Two eye icons on the password field

The final mini-game draws its own show/hide eye next to the password box.
Edge and Chrome *also* draw a native reveal control inside any
`input[type="password"]`, so the field showed two eyes side by side. The
native controls are now hidden in CSS (`::-ms-reveal`, `::-ms-clear`,
`::-webkit-credentials-auto-fill-button`,
`::-webkit-strong-password-auto-fill-button`), leaving only ours.

### 2. Switching language restarted the mini-game

v2.1 made the language switch work mid-chapter by **re-mounting** the game.
That was too blunt: it wiped whatever the player had done — cards already
sorted, signs already found, the option they had just picked.

The engine now re-labels **in place** instead. A new hook,
`ctx.live(fn)`, lets a game register a function that rewrites its own text;
the engine runs it once at mount and again on every `i18n:change`. The DOM
is never rebuilt, so:

* a falling card keeps falling, mid-flight, in the new language;
* a branching option already chosen stays chosen, with its feedback showing;
* found phishing signs keep their rings and get new captions;
* the password trap's result panel re-translates without resetting;
* timers, scores and progress are untouched.

Re-mounting survives only as a fallback for a game that registers no hooks.

> `ctx.lang` is now a snapshot taken at mount and will be stale after a
> switch. Inside a `ctx.live` block, always read the language through
> `ctx.pick()` or `ctx.t()`.

#### Files touched

```
public/assets/css/games.css           hide native password reveal controls
public/assets/js/games/engine.js      ctx.live hook; relang() re-labels
public/assets/js/games/phishing.js    re-label hotspot list in place
public/assets/js/games/truefalse.js   re-label zones and the falling card
public/assets/js/games/branching.js   view + paint(); re-label slide in place
public/assets/js/games/password.js    re-label prompt and result panel
public/assets/js/games/quiz.js        ctx.live replaces a global listener
```

---

## 2026-09-25 — v2.1 "Quieter endings"

A follow-up pass on how the mini-games close, on the result stats, and on
language switching mid-chapter.

### Mini-game endings no longer give anything away

Both scored games used to end with a debrief: how many you got, plus the
answers you missed. That turned a retry into a memory exercise rather than a
second test, so the debriefs are gone.

* **Game 1 — Spot the phishing.** The closing dialog is now one line: either
  *"You found every sign"* or *"Some clues slipped through"*. The "you found
  n of 5" sub-line was removed, and the signs that were missed are no longer
  circled in amber at the end. Signs you *do* find during play are still
  ringed and explained, exactly as before.
* **Game 2 — Safe or unsafe.** The correct-sorting list and the "you judged
  n of 6 correctly" line were removed. Running out of time and sorting the
  last card now lead to the same single dialog.

The running score in the top-right of the chapter header is unchanged — that
is where the player watches their points, not the end-of-game dialogs.

### Result screen — total time replaces best score

The third stat tile was *Your best score*; it is now **Total time**, shown as
`m:ss`. The engine already measured how long a run took (`durationS`), so the
chapter now forwards it to the result page as `&time=` and the page formats it.

> `GET /api/chapters` is no longer called from the result page — the tile it
> fed is gone. The endpoint itself is unchanged and still drives the Main Hall.

### Language can now be switched mid-chapter

Previously the engine captured the language once, when the chapter started, so
pressing **EN** halfway through left the game in Vietnamese until the next
chapter. Now:

* `ctx.pick()` reads the *current* language on every call.
* The engine listens for `i18n:change` and re-labels the mini-game that is on
  screen. Nothing is torn down and nothing restarts.
* A generation counter stops a stale mount from reporting a result, so a
  language switch can never double-score or skip a game.

All game content (`public/content/games/chapter-01.json`) and both UI
dictionaries were verified complete in English and Vietnamese — 162 keys each,
no drift, no Vietnamese text left in the English file.

### Files touched

```
public/assets/js/games/engine.js      live language, re-mount, generation guard
public/assets/js/games/phishing.js    no end-of-game reveal or tally
public/assets/js/games/truefalse.js   no answer key or tally
public/assets/js/pages/chapter.js     forwards &time= to the result page
public/assets/js/pages/result.js      total time instead of personal best
public/result.html                    third stat tile relabelled
public/content/i18n/{en,vi}.json      +result.stat.time, -4 unused keys
```

---

## 2026-09-25 — v2.0 "Real data, real games"

This release replaces the Excel/mock data layer with a real SQLite database
behind a small Python API, rebuilds the Main Hall, and replaces Chapter 1's
quiz with four purpose-built mini-games.

### Data layer — Excel is gone, SQLite is in

| Before | After |
|---|---|
| `data/templates/*.xlsx` read by hand | `data/app.db` (SQLite), created by `data/scripts/build_db.py` |
| `public/assets/js/data/db.js` held mock arrays | `server.py` owns the data; the browser talks to `/api/*` |

* **Added `server.py`** — serves `public/` *and* a JSON API. It is now the only
  supported way to run the site; opening `index.html` from the filesystem will
  no longer work because every screen needs the API.
* **Added `data/scripts/build_db.py`** — creates the schema and seeds
  10 departments, 18 employees and the 4 chapter windows. `--reset` wipes and
  rebuilds.
* **Removed** the `.xlsx` templates and the `openpyxl` workflow.
* **`data/app.db` is gitignored.** It is generated, not committed.

Tables: `departments`, `employees`, `chapters`, `attempts`, `chapter_exits`.

API surface:

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/employees?q=` | Login autocomplete — **email + name only** |
| GET | `/api/departments` | Department dropdown |
| GET | `/api/kpis` | The three headline numbers |
| GET | `/api/records?email=` | One user's attempt history |
| GET | `/api/chapters?email=` | Per-user chapter states (the lock policy) |
| POST | `/api/auth/verify` | Email + department check |
| POST | `/api/attempts` | Save a finished attempt |
| POST | `/api/chapter/exit` | Burn the one-off grace play |

### Main Hall — rebuilt

* **Removed the leaderboard entirely.** Progress is now personal, not public.
* **KPI tiles changed from four to three.** Removed *Top department* and
  *Bravo points awarded*; added **Average score**. The set is now
  *People completed · Total plays · Average score*.
  Average score is the mean of each participant's **best** score per chapter,
  so a deliberately bad retry cannot drag someone down.
* **Chapters moved above the KPI strip** and now span the full page width.
* **Hero is a single full image** (`public/assets/img/hero.png`), shown
  uncropped on the left. If that file is absent, an art-direction placeholder
  renders in its place.
* **The guide panel moved to the right of the hero image**, above the CTA.
* **Added a "My records" button** in the header. It opens a drawer listing
  every attempt: **date · chapter · score · attempt number**.
* Removed the demo "reset progress" / "mark complete" controls.

### Login

* The autocomplete dropdown now shows **email and name only** — the
  department was removed from each row so the list cannot leak the answer to
  the department check. The server never sends it either.
* Suggestions and the identity check now come from the API instead of a
  bundled mock array. Both error states are unchanged:
  * **Error A** — email not in the database → red border + shake.
  * **Error B** — email valid, department wrong → amber border.

### Chapter locking

A chapter is open only inside its week. After the window closes:

| Situation | Result |
|---|---|
| The user already played it | **Locked** |
| The user never played it | **One last play** ("grace") |
| The user used that last play, or left without retrying | **Locked** |

Leaving a grace chapter without pressing *Play again* burns the chance
permanently (sent via `navigator.sendBeacon` so it survives the page unload).

Chapters 2–4 have no content yet and are locked with *Coming soon*.

### Chapter 1 — four mini-games replace the quiz

The chase UI was removed. Chapter 1 is now worth **5 points** across four games:

1. **Spot the phishing** (1 pt) — click every suspicious detail in a real
   phishing email screenshot. 2-minute timer. All five clues required.
2. **Safe or unsafe** (1 pt) — statements fall from the top; drag each into
   the *recommended* or *banned* zone. All six required.
3. **Branching story** (1 pt) — a three-slide decision story about reporting
   phishing. All three must be answered correctly.
4. **The password trap** (+2 pts or **zero**) — a box asks for the user's
   password. Typing one and submitting fails the whole chapter; pressing
   *Cancel* scores 2 points and triggers fireworks.

Notes on the password trap: the code only ever reads the field's **length**,
then clears it. Nothing typed there is transmitted, stored or logged, and the
failure message says so explicitly. Submitting an empty box shows
*"Please enter your password"* rather than letting the user bypass the trap.

Games 1–3 reveal the correct answers after a failure, so a wrong run still
teaches. Answer order is shuffled on every play.

* **Added** `public/assets/js/games/` — `engine.js` plus one module per game
  (`phishing`, `truefalse`, `branching`, `password`, `quiz`).
* **Added** `public/content/games/chapter-01.json` — all four games' content,
  bilingual, in one file.
* **Added** `public/assets/css/games.css`.
* `quiz.js` remains as the fallback for chapters 2–4 once they get content.

### Result screen

* Removed the leaderboard rank stat; it now shows **your best score** for the
  chapter, fetched from the server.
* Accepts a `&max=` parameter so the screen is not hard-coded to 5 points.

### Internationalisation

The VI/EN layer is unchanged in design — one dictionary per language, one key
per string, switchable at runtime without a reload. This release added 51 keys
for the games and the new Hall, and removed the obsolete leaderboard and
Bravo-points keys. Both dictionaries are kept exactly in sync (165 keys each).

### Fixes

* `POST /api/attempts` silently dropped the connection on any error. The
  handler now returns a JSON 500 and logs a traceback.
* The client sent `chapter_id` / `max_score` while the server read `chapter` /
  `maxScore`, so no attempt was ever saved. The server now accepts both.
* Attempts are stamped with the demo date when `--today` is in use, so the
  records drawer no longer shows plays outside the window that allowed them.

### Known limitations

* Chapters 2–4 have no questions yet.
* `public/assets/img/hero.png` is not in the repo — drop the final artwork
  there and it replaces the placeholder automatically.
* `server.py` has a demo clock (`TODAY_OVERRIDE`) so the October windows are
  testable before October. **Set it to `None` for production.**

---

## 2026-09-24 — v1.1

* Added the bilingual (VI/EN) layer and the runtime language switch.
* Restructured the repo into `public/`, `data/` and `docs/`.

## 2026-09-23 — v1.0

* First build: login, main hall, chapter template and result screens as a
  static HTML/CSS/vanilla-JS site.
