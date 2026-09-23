# Cybersecurity Gamify

Front-end for **Cybersecurity Awareness Month — October 2026**: a dark-theme, star-field
gamified learning experience. Four chapters, four habits, one Champion.

Built as static HTML/CSS/vanilla JS — no build step, no dependencies.

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

No build required. Any static server works:

```bash
# Python
python -m http.server 8080

# Node
npx serve .
```

Then open <http://localhost:8080>.

> Open via a server rather than `file://` — `sessionStorage`/`localStorage` behave
> inconsistently on the `file:` origin in some browsers.

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
- **Game stages** (`chapter.html`) — per-chapter scene descriptions come from
  `DB.chapters[].stage` in `assets/js/data.js`. Chapter 1 ships with a working
  chase scene (hero advancing, hacker retreating, 5-step progress track).
- **Result scenes** (`result.html`) — WIN: hacker captured + confetti.
  PARTIAL: hacker dissolving into the dark.

---

## Wiring a real backend

Everything mock lives in `assets/js/data.js` behind the `DB` facade. Replace these
with API calls and the UI needs no changes:

| Method | Replace with |
|---|---|
| `DB.searchEmails(term)` | `GET /api/employees?q=` |
| `DB.findByEmail(email)` | `GET /api/employees/:email` |
| `DB.getQuestions(ch)` | `GET /api/chapters/:ch/questions` |
| `DB.leaderboard(filter)` | `GET /api/leaderboard` |
| `DB.kpis` | `GET /api/stats` |

Progress currently persists to `localStorage` via `UI.progress`; session user to
`sessionStorage` via `UI.session`.

> **Security note:** this is a front-end prototype. Identity is verified client-side
> against mock data, which is not a real access control. Move verification server-side
> before any production use.

---

## Structure

```
cybersecurity_gamify/
├── index.html           Login portal
├── main-hall.html       Main hall
├── chapter.html         Chapter template
├── result.html          Chapter result
├── styleguide.html      Style sheet
└── assets/
    ├── css/styles.css   Design system + all components
    └── js/
        ├── starfield.js Animated canvas star field
        ├── data.js      Mock DB + shared UI helpers
        ├── login.js     Autocomplete, validation, error states
        ├── main-hall.js KPIs, chapters, leaderboard
        ├── chapter.js   Quiz engine
        └── result.js    Result variants
```

---

## Rules of the game

One chapter per week · 5 questions per chapter · answers shuffled every play ·
retry as many times as you like · top 3 per chapter win **200 Bravo points**.

Ranked by highest score, then total plays.
