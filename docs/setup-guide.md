# Setup guide — putting your own data in

Everything you need to change lives in **two folders**. You do not need to touch
the CSS or the page scripts.

| What you want to change | Folder | Files |
|---|---|---|
| Questions and answers | `public/content/questions/` | `chapter-01.json` … `chapter-04.json` |
| Any text on screen (EN + VI) | `public/content/i18n/` | `en.json`, `vi.json` |
| Emails, departments, leaderboard, KPIs | `public/assets/js/data/` | `db.js` |
| Images and photos | `public/assets/img/` | anything you drop in |
| Backend hand-off spec | `data/templates/` | `session_progress.xlsx`, `user_records.xlsx` |

After any change: **save the file and refresh the browser.** There is no build
step. Just remember the site has to be served over HTTP (see §0).

---

## 0. Before you start — run it

JSON files are fetched at runtime, and browsers block `fetch` on `file://`. So
double-clicking `index.html` will show an empty page. Start a tiny server
instead:

```bash
cd public
python -m http.server 8080
```

Open <http://localhost:8080>. Leave that window running while you edit.

If you ever see *"Could not load questions"*, it means you opened the file
directly instead of through the server.

---

## 1. Questions — where the quiz content comes from

**Folder:** `public/content/questions/`
**One file per chapter:** `chapter-01.json`, `chapter-02.json`, `chapter-03.json`, `chapter-04.json`

Each file holds the chapter's name and its five questions, **in both languages
at once**:

```jsonc
{
  "chapter": 1,
  "slug": "safe-account",
  "title": { "en": "Safe Account", "vi": "Tài khoản an toàn" },

  "questions": [
    {
      "id": "c1q1",
      "answer": 0,
      "en": {
        "q": "You receive an email asking you to re-verify your password. What do you do?",
        "o": [
          "Report it to IT Security and delete it",
          "Click the link and check if it looks official",
          "Forward it to your team to warn them",
          "Enter your password only if the page has HTTPS"
        ]
      },
      "vi": {
        "q": "Bạn nhận được email yêu cầu xác minh lại mật khẩu. Bạn sẽ làm gì?",
        "o": [
          "Báo cáo cho IT Security và xoá email đó",
          "Bấm vào link và kiểm tra xem có chính thống không",
          "Chuyển tiếp cho cả nhóm để cảnh báo",
          "Chỉ nhập mật khẩu nếu trang web có HTTPS"
        ]
      }
    }
  ]
}
```

### The one rule that matters

`"answer": 0` means **the first option is correct — in both languages.**

The English list and the Vietnamese list must be the *same answers in the same
order*, just translated. That is why there is only one `answer` field: a
translator supplies wording, never correctness, so the two languages can never
disagree about which option scores.

`0` = first option, `1` = second, `2` = third, `3` = fourth.

### To edit a question

1. Open the chapter file.
2. Change the `q` text and the `o` list — **in both `en` and `vi`**.
3. Check `answer` still points at the right position.
4. Save, refresh.

### To add a question

Copy an existing `{ ... }` block, paste it inside `questions`, put a comma
between blocks, and give it a **new `id`**. Ids are permanent — the answer
history references them, so never reuse or renumber one.

You can have more or fewer than five questions; the progress dots and the score
adapt. Four to six options per question is what the layout is designed for.

### Gotchas

- Use **straight quotes** `"`, not curly `"` `"`. Copying from Word breaks JSON.
- A quote *inside* text must be escaped: `\"re-verify\"`.
- **No comma after the last item** in a list or object.
- If a chapter goes blank, you have a JSON syntax error. Paste the file into
  <https://jsonlint.com> to find the line.

Options are reshuffled on every play, so don't rely on position in the wording
(never write "both of the above").

---

## 2. Emails and departments — who can log in

**File:** `public/assets/js/data/db.js`

This is the mock staff directory. Login checks two things: the email must exist
here, **and** the department the user picks must match this record.

```js
var EMPLOYEES = [
  { email: 'minh.cs@pg.com', name: 'Minh Cao Sy', dept: 'Human Resources' },
  { email: 'tam.nt@pg.com',  name: 'Tam Nguyen Thi', dept: 'Information Technology' },
  // add your people here, one line each
];
```

To add someone, copy a line and change the three values. Optionally add a photo:

```js
{ email: 'tam.nt@pg.com', name: 'Tam Nguyen Thi', dept: 'Information Technology',
  photo: 'assets/img/avatars/tam.nt.jpg' },
```

**Bulk import from a spreadsheet.** If HR gives you an Excel list, use a formula
in a helper column to produce the lines, then paste them in:

```excel
="  { email: '"&A2&"', name: '"&B2&"', dept: '"&C2&"' },"
```

Fill down, copy the column, paste between the `[` and `]`.

### Departments

The dropdown on the login screen is fed by the list just above `EMPLOYEES`:

```js
var DEPARTMENTS = ['Human Resources', 'Information Technology', 'Finance', /* … */];
```

**A department string must match exactly** — same spelling, same capitalisation
— between `DEPARTMENTS` and each employee's `dept`, or that person will always
hit the "department does not match" error.

### Leaderboard and KPI numbers

Same file, further down. These are display-only sample figures until a backend
is connected:

```js
var LEADERBOARD = [
  { name: 'Minh Cao Sy', dept: 'Human Resources', chapter: 1, best: 5, plays: 3 },
];

var KPIS = [
  { key: 'top-dept',  value: 'IT',    pct: 86 },
  { key: 'completed', value: '412',   pct: 64 },
];
```

`pct` is the little progress bar under each KPI (0–100). The KPI *labels* are
text, so they live in the i18n files, not here — see §4.

Rows are ranked automatically: highest `best`, then most `plays`. Top three get
the gold/silver/bronze glow. Add `photo: '…'` to a leaderboard row to show a
face instead of initials.

---

## 3. Images — how to attach your own artwork

**Folder:** `public/assets/img/` (create subfolders freely; `avatars/` already exists)

Paths in HTML are written **relative to `public/`**, so a file at
`public/assets/img/hero.png` is referenced as `assets/img/hero.png`.

The site currently ships **labelled placeholders** with art direction written
into them. There are four kinds of image you might want to add.

### 3a. The hero illustration (Main Hall)

Recommended export: **1800 × 800 px, transparent PNG** (or WebP), @2x.

1. Save your file as `public/assets/img/hero.png`.
2. Open `public/main-hall.html`, find `<div class="hero-art">` (around line 43).
3. Add `has-art` to that class and drop an `<img>` in as the first child:

```html
<div class="hero-art has-art">
  <img class="stage-img" src="assets/img/hero.png" alt="Two P&G Cybersecurity Champions">
  <!-- leave everything below untouched; it hides itself automatically -->
```

That's the whole change. The `has-art` class hides the placeholder figures, the
dashed frame and the art-direction note, and scales your image to fit.

To go back to the placeholder, delete the `<img>` line and remove `has-art`.

### 3b. Game-stage scenes (Chapter screen)

Same pattern, on `public/chapter.html` around line 56:

```html
<section class="game-stage has-art" id="gameStage">
  <img class="stage-img" src="assets/img/stage-ch1.png" alt="">
```

Because one file serves all four chapters, a *different* image per chapter needs
one line of JS. In `public/assets/js/pages/chapter.js`, inside `renderChrome()`:

```js
stage.classList.add('has-art');
stage.querySelector('.stage-img').src = 'assets/img/stage-ch' + chId + '.png';
```

Name your files `stage-ch1.png` … `stage-ch4.png` and that is all.

Note: the Chapter 1 chase animation (hero advancing, hacker retreating) is
driven by those placeholder figures. Replacing the stage with a flat image turns
the animation off — keep the placeholder if you want the motion.

### 3c. Result scenes (WIN / PARTIAL)

`public/result.html` uses `<div class="result-stage" id="resultStage">`. Same
`has-art` + `stage-img` pattern. For two different images, set the `src` in
`public/assets/js/pages/result.js` depending on whether the score is perfect.

Suggested export: **1200 × 700 px, transparent PNG**.

### 3d. Photos of people (avatars)

Square images, **256 × 256 px minimum**, JPG or PNG. They are cropped to a
circle automatically.

1. Save to `public/assets/img/avatars/`, e.g. `tam.nt.jpg`.
2. Add a `photo:` field to that person in `db.js` (§2).

Works in the header, the leaderboard and the sign-in card. Anyone without a
`photo` keeps their initials, so you can add photos gradually.

The **Contact HR card** avatar is hardcoded in `main-hall.html` (look for
`class="avatar"` near the bottom, showing `MC`). Replace the initials with an
`<img>`:

```html
<div class="avatar" style="width:52px;height:52px">
  <img src="assets/img/avatars/minh.cs.jpg" alt="Minh">
</div>
```

### 3e. Chapter card icons

Each chapter card has a small glowing icon (`.ch-icon`). To use your own art,
put an `<img>` inside it — it is generated in `main-hall.js`, in the
`renderChapters()` function.

### Image tips

- **Transparent PNG or WebP** — the star field must show through. A white
  rectangle will look wrong on the dark background.
- Keep each file **under ~400 KB**; there is no image pipeline to compress them.
- Always give a real `alt=""` description, except for purely decorative art
  where empty `alt=""` is correct.
- Filenames: lowercase, hyphens, no spaces.

---

## 4. Text on screen — titles, labels, buttons

**Folder:** `public/content/i18n/` — `en.json` and `vi.json`

Every visible string that is *not* a question lives here: chapter titles, unlock
dates, KPI labels, button text, error messages, the rules panel.

```jsonc
"chapter.1.title":  "Safe Account",
"chapter.1.desc":   "Keep your account safe and secured",
"chapter.1.unlock": "Oct 5",
"kpi.completed.label": "People completed",
"ch.counter": "Question {n} of {total}"
```

Rules:

- `{n}`, `{total}` and similar are filled in at runtime — **keep them exactly as
  written**, including the braces.
- `en.json` and `vi.json` must have the **same set of keys**. If Vietnamese is
  missing a key it falls back to English rather than breaking, but it will look
  inconsistent.
- To find the key behind a string on screen, search for the visible English text
  in `en.json`.

Chapter names, descriptions and unlock dates are here — **not** in `db.js`.

To change the four unlock dates, edit `chapter.1.unlock` … `chapter.4.unlock` in
both files.

---

## 5. The Excel templates — what they are *not*

**Folder:** `data/templates/`

These two workbooks are a **specification for a future backend**, not a live
database. Editing them does not change the website.

| File | One row = | Used for |
|---|---|---|
| `session_progress.xlsx` | one person × one chapter | standings, KPIs, card states |
| `user_records.xlsx` | one answered question | full audit history |

Each has a `_schema` tab explaining every column. Hand these to whoever builds
the server so the shapes agree up front. Regenerate with:

```bash
python data/scripts/build_templates.py
```

Full reference: [`docs/data-contract.md`](data-contract.md).

Right now, real progress is stored in the **browser** (`localStorage`), which
means it is per-device and clears when site data is cleared. That is expected
for a prototype.

---

## 6. Quick recipes

**Change a question's wording** → `public/content/questions/chapter-0N.json`,
edit both `en.q` and `vi.q`.

**Change which answer is correct** → same file, change `answer` to the 0-based
position of the correct option.

**Let someone log in** → add a line to `EMPLOYEES` in
`public/assets/js/data/db.js`; make sure their `dept` exactly matches an entry
in `DEPARTMENTS`.

**Add the real hero image** → drop it in `public/assets/img/`, add `has-art` and
an `<img class="stage-img">` to `.hero-art` in `main-hall.html`.

**Add profile photos** → `public/assets/img/avatars/`, then `photo: '…'` on the
person in `db.js`.

**Rename a chapter** → `chapter.N.title` in both `en.json` and `vi.json`.

**Change an unlock date** → `chapter.N.unlock` in both i18n files.

**Test Vietnamese** → add `?lang=vi` to any URL, or use the EN/VI switch.

---

## 7. When something breaks

| Symptom | Almost always |
|---|---|
| Page is blank / "Could not load questions" | Opened as a file instead of through the server (§0) |
| One chapter won't load | JSON syntax error in that chapter file — check commas and quotes |
| Text shows as `hall.title` | That key is missing from the i18n file |
| Everyone gets "department does not match" | `dept` spelling differs from `DEPARTMENTS` |
| Image doesn't appear | Wrong path — it must be relative to `public/`, e.g. `assets/img/hero.png` |
| Placeholder still showing behind the image | Forgot to add `has-art` to the parent |
| Changes don't show | Hard refresh: **Ctrl + F5** |

Nothing here can be broken permanently — every file is in Git, so
`git checkout -- <file>` restores the last committed version.
