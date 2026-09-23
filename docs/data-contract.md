# Data contract

This project ships as a **static front end with a mock data layer**. Nothing is
persisted server-side yet. This document defines the shape of the data a real
backend must provide so the swap is mechanical rather than a redesign.

There are three data surfaces:

| Surface | Lives in | Owned by |
|---|---|---|
| Questions & answers | `public/content/questions/chapter-0N.json` | Content team |
| UI strings (EN / VI) | `public/content/i18n/{en,vi}.json` | Content team |
| Participants, scores, history | `data/templates/*.xlsx` (spec) | Backend |

---

## 1. Questions — `public/content/questions/chapter-0N.json`

One file per chapter. Both languages live in the **same** file.

```jsonc
{
  "chapter": 1,
  "slug": "safe-account",
  "title": { "en": "Safe Account", "vi": "Tài khoản an toàn" },
  "questions": [
    {
      "id": "c1q1",          // stable forever — never renumber
      "answer": 0,           // index of the correct option, SHARED by both languages
      "en": { "q": "…", "o": ["…", "…", "…", "…"] },
      "vi": { "q": "…", "o": ["…", "…", "…", "…"] }
    }
  ]
}
```

**Why one shared `answer` index matters.** The alternative — an English file and
a Vietnamese file, each with its own correct-answer marker — lets the two drift
apart the moment someone reorders options in one language. Here the option
*positions* are the contract and the translation only supplies labels, so a
mistranslation can never change which answer scores.

Rules:

- `o` must have the same number of options in `en` and `vi`, in the same order.
- `answer` is a 0-based index into that order.
- `id` is permanent. If wording changes, keep the id; historical answer rows in
  `user_records.xlsx` reference it.
- Adding a chapter means adding `chapter-05.json` **and** `chapter.5.*` keys in
  both i18n files.

Options are shuffled at render time. The shuffle is computed once per attempt
from the option indices, so switching language mid-quiz relabels the buttons
without reordering them or changing the correct one.

---

## 2. UI strings — `public/content/i18n/{en,vi}.json`

Flat key/value maps. Keys are dot-namespaced by screen (`login.*`, `hall.*`,
`ch.*`, `result.*`) plus shared content (`chapter.<id>.*`, `kpi.<key>.*`).

- `{placeholders}` are interpolated at runtime, e.g.
  `"ch.counter": "Question {n} of {total}"`.
- A missing key falls back to English, then to the key name itself — so a gap
  degrades to readable text rather than blank UI.
- Both files must have the same key set. `en.json` is the reference.

Markup binds via attributes: `data-i18n`, `data-i18n-html`,
`data-i18n-placeholder`, `data-i18n-aria-label`, `data-i18n-title`.
Dynamic content re-renders on the `i18n:change` event.

Language is chosen by `?lang=vi` → saved preference (`localStorage.csm_lang`)
→ browser locale → English.

---

## 3. Participants and scores — the Excel templates

`data/scripts/build_templates.py` regenerates both workbooks. Each has a
`_schema` sheet documenting every column, plus sample rows.

### `session_progress.xlsx` — live standings

**Grain: one participant × one chapter.** Primary key `(email, chapter_id)`, so
a participant has at most four rows.

This is what the Main Hall reads: KPI strip, chapter card states, leaderboard.

Key columns: `email`, `full_name`, `department`, `chapter_id`, `best_score`,
`total_plays`, `last_score`, `first_played_at`, `last_played_at`,
`best_duration_s`, `status`, `rank_in_chapter`, `bravo_points`, `language`.

Derived, not entered:

- `rank_in_chapter` — `best_score` DESC, then `total_plays` DESC, then
  `best_duration_s` ASC.
- `bravo_points` — 200 when `rank_in_chapter <= 3`, else 0.
- `status` — chapter 1 is always `available`; chapter *N* becomes `available`
  once chapter *N-1* has `best_score > 0`; `completed` once `best_score > 0`.

Treat this workbook as a **materialised view**. It can be rebuilt at any time by
aggregating `user_records.xlsx`.

### `user_records.xlsx` — full answer history

**Grain: one answered question.** Append-only. A complete attempt is five rows
sharing one `attempt_id`.

Key columns: `record_id`, `attempt_id`, `email`, `department`, `chapter_id`,
`attempt_no`, `question_id`, `question_order`, `options_order`, `answer_index`,
`selected_index`, `is_correct`, `language`, `answered_at`, `time_taken_s`,
`attempt_score`.

`options_order` stores the shuffle actually shown (original indices, e.g.
`2|0|3|1`), which makes any disputed answer replayable exactly as the
participant saw it. `language` records what was displayed, not the profile
preference.

Never update or delete a row. A retry creates a new `attempt_id`.

---

## 4. Login

Access requires **both**:

1. the email to exist in the directory, and
2. the selected department to match that record.

The UI deliberately requires the user to *pick* an autocomplete suggestion —
typing a valid address without selecting it is treated as Error A. This keeps
the submitted value guaranteed-canonical.

- **Error A** (red, shake): email not found.
- **Error B** (amber): email valid, department mismatch.

Retries are unlimited; there is no lockout.

---

## 5. Swapping the mock layer for a backend

`public/assets/js/data/db.js` is the only file holding mock records. Replace
these four call sites with HTTP requests and nothing else needs to change:

| Call | Becomes |
|---|---|
| `DB.searchEmails(term)` | `GET /api/employees?q=` |
| `DB.findByEmail(email)` | `POST /api/auth/verify` (email + department) |
| `DB.leaderboard(filter)` | `GET /api/leaderboard?chapter=&dept=` |
| `DB.kpis` | `GET /api/kpis` |

Client-side state to migrate server-side:

| Key | Store | Holds |
|---|---|---|
| `csm_user` | `sessionStorage` | signed-in participant |
| `csm_progress` | `localStorage` | per-chapter best score and play count |
| `csm_lang` | `localStorage` | language preference (can stay client-side) |

Writing a completed attempt should produce five `user_records` rows and refresh
that participant's `session_progress` row in one transaction.
