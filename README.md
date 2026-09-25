# Cybersecurity Gamify

**Cybersecurity Awareness Month — October 2026.** A dark-theme, star-field
gamified learning experience for P&G. Four chapters, four habits, one Champion.

HTML / CSS / vanilla JS on the front end, a small Python server and a SQLite
database on the back. **No build step, no npm, no dependencies.**
Fully bilingual — **English and Vietnamese** from one shared set of content files.

> **Setting up your own data?** Start with
> [`docs/setup-guide.md`](docs/setup-guide.md) — where emails, departments,
> questions and images live.
> Reference material is in [`docs/data-contract.md`](docs/data-contract.md),
> and every recent change is listed in [`docs/CHANGELOG.md`](docs/CHANGELOG.md).

---

## Running it

```powershell
python data\scripts\build_db.py     # once — creates data/app.db
python server.py                    # serves the site + the API
```

Open <http://localhost:8099>.

`server.py` serves the pages **and** the JSON API. Opening the HTML files
directly from disk will not work — every screen reads from the API.

| Flag | Effect |
|---|---|
| `--port 9000` | Use a different port |
| `--today 2026-10-12` | Pretend it is another date, to test chapter locking |

> `server.py` ships with a **demo clock** (`TODAY_OVERRIDE = "2026-10-03"`) so
> the October windows can be tested early. **Set it to `None` for production.**

---

## Screens

| File | Screen |
|---|---|
| `index.html` | **Login** — email autocomplete + department check, 5 designed states |
| `main-hall.html` | **Main Hall** — hero, guide, chapter rail, KPI strip, records drawer, contact |
| `chapter.html?ch=1..4` | **Chapter** — hosts the mini-games, tracks score and time |
| `result.html` | **Result** — WIN and PARTIAL variants |
| `styleguide.html` | **Style sheet** — colours, type scale, components |

---

## Try it

**Sign in**
1. Type `minh` in the email field.
2. **Pick `minh.cs@pg.com` from the dropdown** — typing alone is rejected by design.
3. Choose **Human Resources**.
4. Press **Enter**.

The dropdown shows **email and name only**; the department is never sent to the
browser, so the list cannot give away the answer.

**Error A** — submit an address that is not in the database → red border + shake.
**Error B** — pick `minh.cs@pg.com` but choose **Finance** → amber border.
Retries are unlimited. The *Preview state* panel jumps to any designed state.

Append `?lang=vi` to any page to force Vietnamese, or use the **EN / VI** switch.

---

## Chapter 1 — four mini-games, 5 points

| # | Game | Points | How it is won |
|---|---|---|---|
| 1 | **Spot the phishing** | 1 | Click all five suspicious details in a real phishing email. 2-minute timer. |
| 2 | **Safe or unsafe** | 1 | Statements fall from the top; drag each into *recommended* or *banned*. All six must be right. |
| 3 | **Branching story** | 1 | A three-slide decision story about reporting phishing. All three must be right. |
| 4 | **The password trap** | +2 or **0** | A box asks for your password. Type one and you fail the whole chapter. **Cancel** and you score 2 — with fireworks. |

Games 1–3 reveal the correct answers after a failed run, so a wrong attempt
still teaches. Answer order is shuffled every play.

**About the password trap:** the code reads only the *length* of what you type,
to check the box is not empty, then clears the field. Nothing typed there is
transmitted, stored or logged — and the failure message tells the player so.

Chapters 2–4 have no content yet and show *Coming soon*.

---

## How chapters lock

Each chapter is open for one week.

| Situation | Result |
|---|---|
| Before the window opens | Locked — *"Unlocks 12 Oct"* |
| Inside the window | **Open** |
| Window closed, you already played | Locked |
| Window closed, you never played | **One last play** |
| That last play used, or you left without retrying | Locked |

Leaving a last-chance chapter without pressing *Play again* burns the chance
permanently. The server decides all of this — the browser only renders the
verdict.

---

## Data

Everything lives in **`data/app.db`** (SQLite), created and seeded by
`data/scripts/build_db.py`. It is generated, so it is **not** committed.

| Table | Holds |
|---|---|
| `departments` | The login dropdown |
| `employees` | Who may sign in — email, name, department |
| `chapters` | The four weekly windows and whether content exists |
| `attempts` | One append-only row per completed play |
| `chapter_exits` | Which last-chance plays have been burned |

The API the browser talks to:

| Method | Route |
|---|---|
| GET | `/api/employees?q=` · `/api/departments` · `/api/kpis` |
| GET | `/api/records?email=` · `/api/chapters?email=` |
| POST | `/api/auth/verify` · `/api/attempts` · `/api/chapter/exit` |

Full shapes in [`docs/data-contract.md`](docs/data-contract.md).

---

## Content

Chapter content is **bilingual in place** — every string is an object with an
`en` and a `vi` field, side by side in the same file. There is no separate
English version to keep in step; the app picks the right field at render time
and falls back to `en` if a translation is missing.

| Path | Holds |
|---|---|
| `public/content/games/chapter-01.json` | All four Chapter 1 mini-games |
| `public/content/questions/chapter-0N.json` | Classic quiz questions (fallback format) |
| `public/content/i18n/{en,vi}.json` | Every interface label, one key per string |

The two i18n files must always contain the same set of keys. A missing key
renders as the raw key, never a blank.

**Adding a language:** drop `content/i18n/<code>.json` next to the others and
add the code to the list in `core/i18n.js`.

---

## Images

All artwork lives in `public/assets/img/`.

| File | Used for |
|---|---|
| `hero.png` | The Main Hall hero — shown uncropped, full width. If absent, an art-direction placeholder renders instead. |
| `phishing-email.png` | The screenshot players click in Chapter 1, game 1 |
| `avatars/*` | Optional per-person photos |

Phishing hotspots are stored as **fractions of the image (0–1)**, so they stay
correct at any size. Swapping the screenshot means updating those rectangles —
see the setup guide.

---

## Design system

Tokens live in `:root` in `assets/css/styles.css`.

**Background** `#0B2A5B → #071B3D` gradient plus an animated canvas star field
with constellation lines.

**Chapter accents** — every component reads `--accent`, reassigned per chapter:

| Chapter | Token | Hex |
|---|---|---|
| Ch1 Safe Account | `--ch1` | `#22D3EE` cyan |
| Ch2 Safe Device | `--ch2` | `#38BDF8` sky |
| Ch3 Safe Connection | `--ch3` | `#60A5FA` blue |
| Ch4 Safe Installation | `--ch4` | `#818CF8` indigo |

**Text** headline `#FFFFFF` · body `#9EC5E8` · muted `#A9C6E6`
**State** error `#F87171` · warning `#FBBF24` · success `#34D399`

**Cards** glassmorphic — `rgba(255,255,255,.05)` fill, `1px rgba(255,255,255,.12)`
border, 16px radius, accent glow on hover.

**Type** Space Grotesk for headlines, Inter for body.

Responsive at 1100px and 720px. Honours `prefers-reduced-motion`.

---

## Structure

```
cybersecurity_gamify/
├── server.py                    Web + API server
├── data/
│   ├── app.db                   SQLite (generated, gitignored)
│   └── scripts/build_db.py      Schema + seed data
├── docs/
│   ├── setup-guide.md           How to load your own data
│   ├── data-contract.md         Tables, endpoints, file formats
│   └── CHANGELOG.md
└── public/                      Everything the browser loads
    ├── index.html · main-hall.html · chapter.html · result.html · styleguide.html
    ├── assets/
    │   ├── css/styles.css       Design system + components
    │   ├── css/games.css        Mini-game styling
    │   ├── img/                 Artwork
    │   └── js/
    │       ├── core/            starfield · i18n · shared UI helpers
    │       ├── data/            api.js (server client) · db.js (chapter colours)
    │       ├── games/           engine + one module per mini-game
    │       └── pages/           login · main-hall · chapter · result
    └── content/
        ├── games/chapter-01.json
        ├── questions/chapter-01..04.json
        └── i18n/{en,vi}.json
```

---

## Security notes

* Identity is verified **server-side** against the database. The browser session
  (`sessionStorage`) is a convenience cache, not an access control.
* The employee endpoint never returns departments, so the department check
  cannot be answered from the client.
* The password-trap game never transmits, stores or logs anything typed into it.
* This is an internal awareness tool. It has no authentication beyond the
  email/department pairing and should not be exposed to the public internet.

---

## Rules of the game

One chapter per week · 5 points per chapter · answers shuffled every play ·
retry as many times as you like · a chapter locks once its week ends.
