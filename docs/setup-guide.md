# Setup guide

Everything you need to get the site running and to load your own data.

---

## 1. Requirements

* **Python 3.9 or newer.** Nothing else — no Node, no npm, no build step.
* A modern browser.

Check it:

```powershell
python --version
```

---

## 2. First run

From the repository root:

```powershell
# 1. Create the database (only needed once)
python data\scripts\build_db.py

# 2. Start the site
python server.py
```

Then open **http://localhost:8099**.

> `server.py` serves the web pages *and* the API. Opening `public/index.html`
> directly from the filesystem will **not** work — every screen reads from the
> API.

Useful flags:

| Command | What it does |
|---|---|
| `python server.py --port 9000` | Run on a different port |
| `python server.py --today 2026-10-12` | Pretend it is a different date (see §7) |
| `python data\scripts\build_db.py --reset` | Wipe and rebuild the database |

---

## 3. Where everything lives

```
cybersecurity_gamify/
├── server.py                  ← the web + API server
├── data/
│   ├── app.db                 ← SQLite database (generated, not in git)
│   ├── source/                ← NOT in git (real names and emails)
│   │   ├── EE List - Cybersecurity.xlsx   ← the roster HR sends you
│   │   └── employees.csv      ← generated from it
│   └── scripts/
│       ├── import_roster.py   ← spreadsheet → employees.csv
│       └── build_db.py        ← employees.csv → app.db
├── docs/                      ← this guide, the data contract, the changelog
└── public/                    ← everything the browser loads
    ├── index.html             ← login
    ├── main-hall.html
    ├── chapter.html
    ├── result.html
    ├── assets/
    │   ├── css/
    │   ├── img/               ← put your images here
    │   └── js/
    │       ├── core/          ← starfield, shared UI, i18n
    │       ├── data/          ← api.js (server client), db.js (chapter colours)
    │       ├── games/         ← one file per mini-game
    │       └── pages/         ← one file per screen
    └── content/
        ├── games/             ← chapter-01.json — the mini-game content
        ├── questions/         ← classic quiz question files
        └── i18n/              ← en.json and vi.json
```

---

## 4. Loading your people (email + department)

The roster comes from an HR spreadsheet. It is loaded in two steps:

```
data/source/EE List - Cybersecurity.xlsx   ← the spreadsheet HR sends you
            │  python data/scripts/import_roster.py
            ▼
data/source/employees.csv                  ← readable, easy to correct by hand
            │  python data/scripts/build_db.py --reset
            ▼
data/app.db                                ← what the site reads
```

> **None of these three files is in git.** They are real names and real email
> addresses, and this repository is public, so `data/source/` and `app.db` are
> both gitignored. They live only on the machine that runs the site.
>
> On a fresh checkout there is no roster at all — `build_db.py` seeds a
> five-person demo list so the site still starts. Drop the spreadsheet into
> `data/source/` and run the two commands below to load the real one.

### When HR sends a new list

1. Save the file over `data/source/EE List - Cybersecurity.xlsx`.
   It needs three columns in row 1: **Name**, **Email**, **Function**.
2. Run both steps:

```powershell
python data\scripts\import_roster.py
python data\scripts\build_db.py --reset
```

`import_roster.py` prints a headcount per department and warns about anything
it skipped (bad email, duplicate) or patched (missing Function). Read those
warnings — they are the only sign something in the spreadsheet is wrong.

If the spreadsheet is somewhere else:

```powershell
python data\scripts\import_roster.py --xlsx "C:\path\to\other.xlsx"
```

> `import_roster.py` needs `openpyxl` (`pip install openpyxl`).
> `build_db.py` does not — it only reads the CSV, so a deployment machine
> needs nothing beyond Python itself.

### About names

Name cells look like `TRAN NHI (NHÌ TRẦN)` — a Latin spelling with the
Vietnamese spelling in brackets. Both are kept:

| Column | Value | Used for |
|---|---|---|
| `name` | `Tran Nhi` | login autocomplete, greetings |
| `name_vi` | `Nhì Trần` | available for Vietnamese display |

Capitalisation is normalised, so `TRAN NHI` and `Tran Nhi` both end up the same.

### Editing one person by hand

For a single correction, edit `data/source/employees.csv` directly
(`email,name,name_vi,department`) and re-run `build_db.py --reset`. Do not
edit `app.db` by hand — the next rebuild overwrites it.

> **`--reset` deletes every play record.** During October, add people without
> `--reset`: `python data\scripts\build_db.py`. That re-seeds the roster and
> leaves `attempts` alone.

### The department dropdown

The login dropdown is built from whatever departments appear in the CSV — you
never maintain a separate list. Right now that is 15:

```
Digital · ESS · Engineering · Global Innovation · HDL · HR · Home Care
I-Trade · ICA · LFE · MPD & SIEL · Plant Manager · Platform · QA/QC · WHSNO
```

### What the login actually checks

1. The typed email must be **chosen from the suggestion list**. Free typing is
   rejected even if the address is correct.
2. The selected department must match the employee's stored department.

The suggestion list returns **email and name only**. The department is never
sent to the browser, so nobody can read the answer out of the dropdown.

---

## 5. Adding images

All images go in **`public/assets/img/`**.

| File | Used by | Notes |
|---|---|---|
| `hero.png` | Main Hall | The big hero artwork. Shown **uncropped** at full width on the left of the hero. Suggested 1800×800 @2x, PNG. If the file is missing, an art-direction placeholder appears instead. |
| `phishing-email.png` | Chapter 1, game 1 | The phishing email screenshot players click on. |
| `avatars/*` | Optional | Per-person photos. Put the filename in the employee's `photo` column. |

To swap the hero: drop your file in as `public/assets/img/hero.png` and
refresh. Nothing else to change.

To swap the phishing screenshot you must also move the clickable hotspots —
see §6.

---

## 6. Editing chapter content

### The mini-games (Chapter 1)

All four games live in one file:
**`public/content/games/chapter-01.json`**.

It is bilingual — every piece of text has an `en` and a `vi` field side by
side. There is **no separate English file to maintain**; the app picks the
field matching the active language at render time. If a `vi` value is missing,
the `en` value is used as the fallback.

```jsonc
{
  "chapter": 1,
  "maxScore": 5,
  "games": [
    {
      "id": "phish", "type": "hotspot", "points": 1,
      "title":  { "en": "Spot the phishing", "vi": "Tìm dấu hiệu lừa đảo" },
      "image":  "assets/img/phishing-email.png",
      "timeLimitS": 120,
      "hotspots": [
        {
          "rect": [0.06, 0.18, 0.46, 0.23],     // x1, y1, x2, y2
          "label": { "en": "Lookalike sender domain", "vi": "..." },
          "why":   { "en": "...", "vi": "..." }
        }
      ]
    }
  ]
}
```

**Hotspot coordinates are fractions of the image, from 0 to 1**, not pixels.
`[0.06, 0.18, 0.46, 0.23]` means "from 6 % to 46 % across, 18 % to 23 % down".
Using fractions means the boxes stay correct at any screen size. To find them,
open the image in any editor, read the pixel rectangle, and divide by the
image's width and height.

The other three game types in the same file:

| `type` | What the author supplies |
|---|---|
| `sort` | `statements[]`, each with `zone: "safe"` or `"unsafe"` |
| `story` | `slides[]`, each with a `question` and `options[]` where one has `correct: true` |
| `trap` | The prompt, button labels and the win/fail messages |

### The classic quiz (Chapters 2–4)

Chapters 2–4 have no content yet. When you are ready, either:

* add a `content/games/chapter-02.json` in the same shape as above, **or**
* fill in `public/content/questions/chapter-02.json` with a plain question
  list — the app falls back to a standard 5-question quiz automatically.

Then flip the chapter's `has_content` flag to `1` in the `CHAPTERS` list in
`build_db.py` and rebuild.

### Interface text

`public/content/i18n/en.json` and `vi.json` hold every label in the interface,
one key per string. To change wording, edit the value — never the key. The two
files must always contain the **same set of keys**.

---

## 7. Chapter dates and the demo clock

The four weekly windows are defined in `build_db.py`:

```python
CHAPTERS = [
    (1, "safe-account",      "2026-10-01", "2026-10-08", 1),
    (2, "safe-device",       "2026-10-09", "2026-10-15", 0),
    (3, "safe-connection",   "2026-10-16", "2026-10-22", 0),
    (4, "safe-installation", "2026-10-23", "2026-10-29", 0),
    # id, slug, opens, closes, has_content
]
```

Because those are real October dates, nothing is playable before October. So
`server.py` has a **demo clock** near the top:

```python
TODAY_OVERRIDE = "2026-10-03"   # set to None for production
```

**Set this to `None` before you go live**, otherwise the site will be frozen on
that date forever.

You can also override it per run without editing the file:

```powershell
python server.py --today 2026-10-12
```

### How the lock works

| Situation | The chapter is |
|---|---|
| Before `opens` | Locked — "Unlocks 12 Oct" |
| Between `opens` and `closes` | **Open** |
| After `closes`, user already played it | Locked |
| After `closes`, user never played it | **One last play** |
| After `closes`, user used that last play or left without retrying | Locked |
| `has_content = 0` | Locked — "Coming soon" |

---

## 8. Reading the results

Two things record what people did:

| | What it holds |
|---|---|
| `attempts` | One row per finished play. Append-only — nothing is ever updated or deleted, so a retry never erases the earlier score. |
| `performance` | A **view** that rolls `attempts` up to one row per person per chapter. Query it exactly like a table; it can never fall out of step, because it is recalculated on every query. |

`performance` gives you: `email`, `name`, `name_vi`, `department`,
`chapter_id`, `plays`, `best_score`, `worst_score`, `avg_score`, `max_score`,
`total_time_s`, `first_perfect_attempt`, `first_played_at`, `last_played_at`.

```python
import sqlite3
con = sqlite3.connect("data/app.db")
con.row_factory = sqlite3.Row

# Chapter 1 ranking — highest score first, fewest plays breaks the tie
for r in con.execute("""
        SELECT name, department, best_score, plays, total_time_s
        FROM performance
        WHERE chapter_id = 1
        ORDER BY best_score DESC, plays ASC, total_time_s ASC"""):
    print(dict(r))
```

Other useful queries:

```sql
-- One person's whole journey
SELECT * FROM performance WHERE email = 'nhu.pk@pg.com';

-- Participation by department
SELECT department, COUNT(DISTINCT email) AS people, ROUND(AVG(best_score), 2) AS avg_best
FROM performance WHERE chapter_id = 1 GROUP BY department ORDER BY people DESC;

-- Who has not played chapter 1 yet
SELECT e.email, e.name, e.department FROM employees e
WHERE NOT EXISTS (SELECT 1 FROM attempts a
                  WHERE a.email = e.email AND a.chapter_id = 1);

-- Everyone who scored full marks
SELECT name, department, first_perfect_attempt FROM performance
WHERE chapter_id = 1 AND best_score = max_score ORDER BY first_perfect_attempt;
```

To export to Excel for reporting:

```python
import sqlite3, pandas as pd
con = sqlite3.connect("data/app.db")
with pd.ExcelWriter("results.xlsx") as x:
    pd.read_sql_query("SELECT * FROM performance", con).to_excel(x, "Performance", index=False)
    pd.read_sql_query("SELECT * FROM attempts", con).to_excel(x, "Every play", index=False)
```

Each player can see their own history in the app via the **My records**
button in the Main Hall header.

---

## 9. Troubleshooting

| Symptom | Cause |
|---|---|
| Every screen is blank or shows "Could not load" | `server.py` is not running, or you opened the HTML file directly |
| The login list is empty | The database has no employees — run `build_db.py` |
| All four chapters say "Unlocks…" | Today is outside every window — set `TODAY_OVERRIDE` |
| Chapter 1 opens but games do not start | `content/games/chapter-01.json` is missing or malformed JSON |
| The phishing rings land in the wrong place | The hotspot rectangles do not match the current image — see §6 |
| A label shows as a raw key like `hall.cta` | That key is missing from the active language file |
