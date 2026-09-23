# Cybersecurity Gamify

Front-end for **Cybersecurity Awareness Month — October 2026**: a dark-theme, star-field
gamified learning experience. Four chapters, four habits, one Champion.

Built as static HTML/CSS/vanilla JS — no build step, no dependencies.
Available in **English and Vietnamese** from one shared set of content files.

---

## Screens

| File | Screen | Notes |
|---|---|---|
| `index.html` | **Login Portal** | Email combo with live autocomplete, department match, 5 designed states |
| `main-hall.html` | **Main Hall** | Hero, KPI strip, chapter selector, rules panel, leaderboard, contact card |
| `chapter.html` | **Chapter Template** | Reusable for all 4 chapters via `?ch=1..4` |
| `result.html` | **Chapter Result** | WIN and PARTIAL variants via `?score=` |
| `styleguide.html` | **Style Sheet** | Colours, type scale, buttons, inputs, card and answer states |

---

## Running it

No build required, but it **must be served over HTTP** — questions and UI strings are
fetched as JSON, and `fetch` is blocked on the `file://` origin.

```bash
cd public

# Python
python -m http.server 8080

# Node
npx serve .
```

Then open <http://localhost:8080>.

Append `?lang=vi` to any page to force Vietnamese, or use the **EN / VI** switch in the
header. The choice is remembered in `localStorage`.

---

## Try the flows

**Login — success**
1. Type `minh` in the email field.
2. **Pick `minh.cs@pg.com` from the dropdown** (typing alone is rejected by design).
3. Choose department **Human Resources**.
4. Press **Enter**.

**Login — Error A (email not found)**
Type `unknown.person@pg.com` and submit → red border, shake, *"Email không chính xác — Email not found. Please try again."*

**Login — Error B (department mismatch)**
Pick `minh.cs@pg.com` but choose **Finance** → amber border, *"Department does not match this account. Access denied."*

Retries are unlimited. The **Preview state** panel (top right) jumps straight to any of the
five designed states: Default, Focus, Loading, Error A, Error B.

**Chapter & result**
- `chapter.html?ch=1` … `?ch=4` — accent colour, chip, and game stage swap per chapter.
- `result.html?ch=1&score=5` — WIN · `result.html?ch=1&score=3` — PARTIAL.

Chapter 1 is always unlocked; each later chapter unlocks once the previous one is completed.
The Main Hall footer has demo links to reset progress or force-complete Chapter 1.

---

## Design system

Tokens live in `:root` in `assets/css/styles.css`.

**Background** `#0B2A5B → #071B3D` vertical gradient + animated canvas star field with
constellation lines.

**Chapter accents** — every component reads `--accent`, which is reassigned per chapter:

| Chapter | Token | Hex |
|---|---|---|
| Ch1 Safe Account | `--ch1` | `#22D3EE` cyan |
| Ch2 Safe Device | `--ch2` | `#38BDF8` sky |
| Ch3 Safe Connection | `--ch3` | `#60A5FA` blue |
| Ch4 Safe Installation | `--ch4` | `#818CF8` indigo |

**Text** headline `#FFFFFF` · body `#9EC5E8` · muted `#A9C6E6`
**State** error `#F87171` · warning `#FBBF24` · success `#34D399`
**Rank** gold `#FCD34D` · silver `#CBD5E1` · bronze `#D9A066`

**Cards** glassmorphic — `rgba(255,255,255,.05)` fill, `1px rgba(255,255,255,.12)` border,
16px radius, soft accent glow on hover.

**Type** Space Grotesk for headlines, Inter for body.

Responsive at **1100px** (tablet) and **720px** (mobile). Honours `prefers-reduced-motion`.

---

## Illustration placeholders

The hero and the four game stages are **labelled placeholder frames with art direction
baked into the markup** — swap them for final artwork when it lands.

- **Hero** (`main-hall.html`) — two P&G Champions, semi-realistic, cyan rim-light,
  floating shield/lock motifs. Export 1800×800 @2x transparent PNG.
- **Game stages** (`chapter.html`) — per-chapter scene descriptions come from the
  `chapter.<n>.stage` keys in `content/i18n/*.json`. Chapter 1 ships with a working
  chase scene (hero advancing, hacker retreating, 5-step progress track).
- **Result scenes** (`result.html`) — WIN: hacker captured + confetti.
  PARTIAL: hacker dissolving into the dark.

---

## Languages

The VI / EN switch sits in every page header. Switching is instant — both dictionaries
are preloaded after first paint — and **safe mid-quiz**: the answer options are relabelled
in place without reshuffling, so your score and progress carry over.

- UI strings — `public/content/i18n/en.json` and `vi.json`, flat dot-namespaced keys.
- Questions — one file per chapter with `en` and `vi` blocks side by side.
- Markup binds through `data-i18n`, `data-i18n-html`, `data-i18n-placeholder`,
  `data-i18n-aria-label`, `data-i18n-title`.
- A missing key falls back to English, then to the key name — never a blank string.

**Adding a language:** drop `content/i18n/<code>.json` next to the others, add the code to
the list in `core/i18n.js`, and add a matching block to each question file.

`styleguide.html` is an internal dev artifact and stays English-only.

---

## Content

**Questions** live in `public/content/questions/chapter-0N.json`:

```jsonc
{
  "id": "c1q1",
  "answer": 0,                                    // index shared by BOTH languages
  "en": { "q": "…", "o": ["…", "…", "…", "…"] },
  "vi": { "q": "…", "o": ["…", "…", "…", "…"] }
}
```

One `answer` index serves both languages, so a translation can never desync which option
is correct — the translator supplies labels, not correctness. Keep `id` stable forever;
answer history references it.

**Excel templates** in `data/templates/` are the data contract for a future backend, not a
live database:

| Workbook | Grain | Purpose |
|---|---|---|
| `session_progress.xlsx` | one participant × one chapter | live standings, KPI strip, card states |
| `user_records.xlsx` | one answered question | append-only audit history |

Regenerate with `python data/scripts/build_templates.py`. Each workbook carries a
`_schema` sheet documenting every column. Full details in
[`docs/data-contract.md`](docs/data-contract.md).

---

## Wiring a real backend

Everything mock lives in `public/assets/js/data/db.js` behind the `DB` facade. Replace
these with API calls and the UI needs no changes:

| Method | Replace with |
|---|---|
| `DB.searchEmails(term)` | `GET /api/employees?q=` |
| `DB.findByEmail(email)` | `POST /api/auth/verify` |
| `DB.leaderboard(filter)` | `GET /api/leaderboard` |
| `DB.kpis` | `GET /api/stats` |

Progress persists to `localStorage` via `UI.progress`; session user to `sessionStorage`
via `UI.session`.

> **Security note:** this is a front-end prototype. Identity is verified client-side
> against mock data, which is not a real access control. Move verification server-side
> before any production use.

---

## Structure

```
cybersecurity_gamify/
├── docs/data-contract.md        Data shapes + backend swap guide
├── data/
│   ├── scripts/build_templates.py
│   └── templates/*.xlsx         Backend data contract
└── public/                      ← serve this directory
    ├── index.html               Login portal
    ├── main-hall.html           Main hall
    ├── chapter.html             Chapter template  (?ch=1..4)
    ├── result.html              Chapter result    (?score=)
    ├── styleguide.html          Style sheet
    ├── assets/
    │   ├── css/styles.css       Design system + all components
    │   └── js/
    │       ├── core/            starfield · i18n · shared UI helpers
    │       ├── data/            mock DB · question loader
    │       └── pages/           login · main-hall · chapter · result
    └── content/
        ├── questions/chapter-01..04.json
        └── i18n/{en,vi}.json
```

---

## Rules of the game

One chapter per week · 5 questions per chapter · answers shuffled every play ·
retry as many times as you like · top 3 per chapter win **200 Bravo points**.

Ranked by highest score, then total plays.
