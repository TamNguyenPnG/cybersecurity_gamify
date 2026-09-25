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
│   └── scripts/build_db.py    ← creates and seeds app.db
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

The list of who may sign in, and which department each person belongs to,
lives in **`data/scripts/build_db.py`**.

Open it and find the `EMPLOYEES` list near the bottom:

```python
EMPLOYEES = [
    ("minh.cs@pg.com",  "Minh Cao Sy",  "Human Resources", None),
    ("chi.ptm@pg.com",  "Chi Pham Thi Minh", "Marketing",   None),
    # email, full name, department, photo filename (or None)
]
```

Add one tuple per person, then rebuild:

```powershell
python data\scripts\build_db.py --reset
```

The `DEPARTMENTS` list just above it feeds the login dropdown. Every
employee's department **must** appear in that list.

### Loading from a spreadsheet instead

If HR sends you a CSV, you can load it without editing Python by hand:

```powershell
python - <<'PY'
import csv, sqlite3
con = sqlite3.connect("data/app.db")
with open("people.csv", newline="", encoding="utf-8-sig") as f:
    for row in csv.DictReader(f):          # columns: email,name,department
        con.execute("INSERT OR IGNORE INTO departments(name) VALUES (?)",
                    (row["department"],))
        con.execute("INSERT OR REPLACE INTO employees(email,name,department,photo)"
                    " VALUES (?,?,?,NULL)",
                    (row["email"].strip().lower(), row["name"], row["department"]))
con.commit()
PY
```

(On Windows PowerShell, save that snippet as `load_people.py` and run
`python load_people.py` — PowerShell has no heredocs.)

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

Open the database with any SQLite tool, or from Python:

```python
import sqlite3
con = sqlite3.connect("data/app.db")
con.row_factory = sqlite3.Row
for r in con.execute("""
        SELECT e.name, e.department, a.chapter_id,
               MAX(a.score) AS best, COUNT(*) AS plays
        FROM attempts a JOIN employees e ON e.email = a.email
        GROUP BY a.email, a.chapter_id
        ORDER BY best DESC, plays ASC"""):
    print(dict(r))
```

To export to Excel for reporting:

```python
import sqlite3, pandas as pd
con = sqlite3.connect("data/app.db")
pd.read_sql_query("SELECT * FROM attempts", con).to_excel("results.xlsx", index=False)
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
