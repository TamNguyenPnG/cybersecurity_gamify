"""
Create and seed data/app.db — the SQLite database behind the site.

Run:  python data/scripts/build_db.py          (create if missing, keep records)
      python data/scripts/build_db.py --reset  (wipe and rebuild from scratch)

People come from data/source/employees.csv, which is generated from the HR
spreadsheet by data/scripts/import_roster.py. If that CSV is missing, a small
built-in demo roster is used instead so the site still runs.

The `employees`, `departments` and `chapters` tables are reference data and are
re-seeded every run. The `attempts` and `chapter_exits` tables hold real user
activity and are only touched by --reset.
"""

import argparse
import csv
import os
import sqlite3

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DB_PATH = os.path.join(ROOT, "data", "app.db")
CSV_PATH = os.path.join(ROOT, "data", "source", "employees.csv")

SCHEMA = """
CREATE TABLE IF NOT EXISTS departments (
    name TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS employees (
    email      TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    name_vi    TEXT,
    department TEXT NOT NULL REFERENCES departments(name),
    photo      TEXT
);
CREATE INDEX IF NOT EXISTS idx_employees_name ON employees(name);

-- One row per chapter. `opens` / `closes` are inclusive ISO dates and define
-- the week that chapter is live. `has_content` gates chapters not built yet.
CREATE TABLE IF NOT EXISTS chapters (
    id          INTEGER PRIMARY KEY,
    slug        TEXT NOT NULL,
    opens       TEXT NOT NULL,
    closes      TEXT NOT NULL,
    has_content INTEGER NOT NULL DEFAULT 0
);

-- One row per completed play. Append-only; never updated or deleted.
CREATE TABLE IF NOT EXISTS attempts (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    email        TEXT NOT NULL REFERENCES employees(email),
    chapter_id   INTEGER NOT NULL REFERENCES chapters(id),
    attempt_no   INTEGER NOT NULL,
    score        INTEGER NOT NULL,
    max_score    INTEGER NOT NULL,
    duration_s   INTEGER,
    language     TEXT,
    detail       TEXT,              -- JSON: per-game breakdown
    played_at    TEXT NOT NULL      -- ISO-8601 UTC
);
CREATE INDEX IF NOT EXISTS idx_attempts_email   ON attempts(email);
CREATE INDEX IF NOT EXISTS idx_attempts_chapter ON attempts(email, chapter_id);

-- Records that a user left a chapter they were playing on grace (i.e. after
-- its window had closed and with no prior attempt). Presence of a row here
-- permanently locks that chapter for that user.
CREATE TABLE IF NOT EXISTS chapter_exits (
    email      TEXT NOT NULL REFERENCES employees(email),
    chapter_id INTEGER NOT NULL REFERENCES chapters(id),
    exited_at  TEXT NOT NULL,
    PRIMARY KEY (email, chapter_id)
);

-- Employee performance, one row per person per chapter they have played.
-- This is a VIEW, not a table: it is derived from `attempts` on every query,
-- so it can never drift out of step with the ledger. Query it like a table:
--     SELECT * FROM performance WHERE email = 'nhu.pk@pg.com';
--     SELECT * FROM performance WHERE chapter_id = 1 ORDER BY best_score DESC;
DROP VIEW IF EXISTS performance;
CREATE VIEW performance AS
SELECT
    e.email,
    e.name,
    e.name_vi,
    e.department,
    a.chapter_id,
    COUNT(*)                                   AS plays,
    MAX(a.score)                               AS best_score,
    MIN(a.score)                               AS worst_score,
    ROUND(AVG(a.score), 2)                     AS avg_score,
    MAX(a.max_score)                           AS max_score,
    SUM(COALESCE(a.duration_s, 0))             AS total_time_s,
    MIN(CASE WHEN a.score = a.max_score THEN a.attempt_no END)
                                               AS first_perfect_attempt,
    MIN(a.played_at)                           AS first_played_at,
    MAX(a.played_at)                           AS last_played_at
FROM attempts a
JOIN employees e ON e.email = a.email
GROUP BY a.email, a.chapter_id;
"""

DEMO_EMPLOYEES = [
    ("minh.cs@pg.com",  "Minh Cao Sy",     "Minh Cao Sỹ",     "HR"),
    ("tam.nt@pg.com",   "Tam Nguyen Thi",  "Tâm Nguyễn Thị",  "Platform"),
    ("linh.pd@pg.com",  "Linh Pham Duc",   "Linh Phạm Đức",   "LFE"),
    ("huy.nv@pg.com",   "Huy Nguyen Van",  "Huy Nguyễn Văn",  "Digital"),
    ("an.lt@pg.com",    "An Le Thi",       "An Lê Thị",       "HDL"),
]


def load_roster():
    """Read data/source/employees.csv, falling back to the demo roster.

    Returns (employees, departments, source_label).
    """
    if not os.path.exists(CSV_PATH):
        people = DEMO_EMPLOYEES
        label = "built-in demo roster (data/source/employees.csv not found)"
    else:
        people = []
        with open(CSV_PATH, encoding="utf-8-sig", newline="") as fh:
            for row in csv.DictReader(fh):
                email = (row.get("email") or "").strip().lower()
                name = (row.get("name") or "").strip()
                if not email or not name:
                    continue
                people.append((
                    email,
                    name,
                    (row.get("name_vi") or "").strip(),
                    (row.get("department") or "").strip() or "Unassigned",
                ))
        if not people:
            raise SystemExit(CSV_PATH + " has no usable rows")
        label = os.path.relpath(CSV_PATH, ROOT)

    departments = sorted({p[3] for p in people})
    return people, departments, label

# Chapter windows for October 2026. A chapter is playable during its window;
# afterwards it locks for anyone who already played it. Only chapter 1 has
# content built.
CHAPTERS = [
    (1, "safe-account",      "2026-10-01", "2026-10-08", 1),
    (2, "safe-device",       "2026-10-09", "2026-10-15", 0),
    (3, "safe-connection",   "2026-10-16", "2026-10-22", 0),
    (4, "safe-installation", "2026-10-23", "2026-10-29", 0),
]


def build(reset=False):
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    if reset and os.path.exists(DB_PATH):
        os.remove(DB_PATH)
        print("removed existing database")

    employees, departments, source = load_roster()

    con = sqlite3.connect(DB_PATH)
    con.execute("PRAGMA foreign_keys = ON")
    con.executescript(SCHEMA)

    con.executemany(
        "INSERT OR IGNORE INTO departments (name) VALUES (?)",
        [(d,) for d in departments],
    )
    con.executemany(
        "INSERT INTO employees (email, name, name_vi, department) "
        "VALUES (?, ?, ?, ?) "
        "ON CONFLICT(email) DO UPDATE SET name = excluded.name, "
        "name_vi = excluded.name_vi, department = excluded.department",
        employees,
    )
    con.executemany(
        "INSERT INTO chapters (id, slug, opens, closes, has_content) "
        "VALUES (?, ?, ?, ?, ?) "
        "ON CONFLICT(id) DO UPDATE SET slug = excluded.slug, "
        "opens = excluded.opens, closes = excluded.closes, "
        "has_content = excluded.has_content",
        CHAPTERS,
    )
    con.commit()

    counts = {
        t: con.execute("SELECT COUNT(*) FROM " + t).fetchone()[0]
        for t in ("departments", "employees", "chapters", "attempts",
                  "chapter_exits", "performance")
    }
    con.close()

    print("roster from", source)
    print("database ready at", os.path.relpath(DB_PATH, ROOT))
    for table, n in counts.items():
        print("  {:<14} {}".format(table, n))


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--reset", action="store_true",
                    help="delete the database and rebuild, discarding all attempts")
    build(**vars(ap.parse_args()))
