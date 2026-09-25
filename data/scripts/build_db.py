"""
Create and seed data/app.db — the SQLite database behind the site.

Run:  python data/scripts/build_db.py          (create if missing, keep records)
      python data/scripts/build_db.py --reset  (wipe and rebuild from scratch)

The `employees`, `departments` and `chapters` tables are reference data and are
re-seeded every run. The `attempts` and `chapter_exits` tables hold real user
activity and are only touched by --reset.
"""

import argparse
import os
import sqlite3

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DB_PATH = os.path.join(ROOT, "data", "app.db")

SCHEMA = """
CREATE TABLE IF NOT EXISTS departments (
    name TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS employees (
    email      TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
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
"""

DEPARTMENTS = [
    "Human Resources",
    "Information Technology",
    "Finance",
    "Marketing",
    "Sales",
    "Supply Chain",
    "Research & Development",
    "Manufacturing",
    "Legal",
    "Communications",
]

EMPLOYEES = [
    ("minh.cs@pg.com",   "Minh Cao Sy",       "Human Resources"),
    ("minh.tt@pg.com",   "Minh Tran Thi",     "Marketing"),
    ("tam.nt@pg.com",    "Tam Nguyen Thi",    "Information Technology"),
    ("linh.pd@pg.com",   "Linh Pham Duc",     "Finance"),
    ("huy.nv@pg.com",    "Huy Nguyen Van",    "Information Technology"),
    ("an.lt@pg.com",     "An Le Thi",         "Supply Chain"),
    ("khanh.vd@pg.com",  "Khanh Vo Duy",      "Research & Development"),
    ("thao.dn@pg.com",   "Thao Dang Ngoc",    "Sales"),
    ("quan.hm@pg.com",   "Quan Hoang Minh",   "Manufacturing"),
    ("mai.tn@pg.com",    "Mai Truong Ngoc",   "Communications"),
    ("duc.nb@pg.com",    "Duc Nguyen Ba",     "Legal"),
    ("trang.lh@pg.com",  "Trang Le Hoang",    "Human Resources"),
    ("son.pv@pg.com",    "Son Pham Van",      "Information Technology"),
    ("yen.nh@pg.com",    "Yen Nguyen Hai",    "Finance"),
    ("bao.tq@pg.com",    "Bao Tran Quoc",     "Marketing"),
    ("ha.vt@pg.com",     "Ha Vu Thanh",       "Supply Chain"),
    ("nam.lq@pg.com",    "Nam Le Quang",      "Sales"),
    ("chi.ptm@pg.com",   "Chi Pham Thi Minh", "Research & Development"),
]

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

    con = sqlite3.connect(DB_PATH)
    con.execute("PRAGMA foreign_keys = ON")
    con.executescript(SCHEMA)

    con.executemany(
        "INSERT OR IGNORE INTO departments (name) VALUES (?)",
        [(d,) for d in DEPARTMENTS],
    )
    con.executemany(
        "INSERT INTO employees (email, name, department) VALUES (?, ?, ?) "
        "ON CONFLICT(email) DO UPDATE SET name = excluded.name, "
        "department = excluded.department",
        EMPLOYEES,
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
        for t in ("departments", "employees", "chapters", "attempts", "chapter_exits")
    }
    con.close()

    print("database ready at", os.path.relpath(DB_PATH, ROOT))
    for table, n in counts.items():
        print("  {:<14} {}".format(table, n))


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--reset", action="store_true",
                    help="delete the database and rebuild, discarding all attempts")
    build(**vars(ap.parse_args()))
