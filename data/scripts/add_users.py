"""
Add (or update) employees directly in data/app.db.

Run:  python data/scripts/add_users.py "an.nv@pg.com|An Nguyen Van|Digital" "binh.tt@pg.com|Binh Tran Thi|HR|Bình Trần Thị"

Each argument is  email|name|department[|name_vi].
An existing email is updated; a new department is created. build_db.py --reset
wipes these rows, so keep them in data/source/employees.csv if they must last.
"""

import os
import sqlite3
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DB_PATH = os.path.join(ROOT, "data", "app.db")


def parse(spec):
    parts = [p.strip() for p in spec.split("|")]
    if len(parts) not in (3, 4) or not all(parts[:3]):
        raise SystemExit('bad user "{}" - expected email|name|department[|name_vi]'.format(spec))
    email, name, dept = parts[0].lower(), parts[1], parts[2]
    return email, name, parts[3] if len(parts) == 4 else "", dept


def main(specs):
    if not specs:
        raise SystemExit(__doc__)
    if not os.path.exists(DB_PATH):
        raise SystemExit("data/app.db not found - run: python data/scripts/build_db.py")

    users = [parse(s) for s in specs]
    con = sqlite3.connect(DB_PATH)
    con.execute("PRAGMA foreign_keys = ON")
    with con:
        con.executemany("INSERT OR IGNORE INTO departments (name) VALUES (?)",
                        [(u[3],) for u in users])
        con.executemany(
            "INSERT INTO employees (email, name, name_vi, department) VALUES (?, ?, ?, ?) "
            "ON CONFLICT(email) DO UPDATE SET name = excluded.name, "
            "name_vi = excluded.name_vi, department = excluded.department",
            users)
    for email, name, _, dept in users:
        print("saved {} ({}, {})".format(email, name, dept))
    print("employees now:", con.execute("SELECT COUNT(*) FROM employees").fetchone()[0])
    con.close()


if __name__ == "__main__":
    main(sys.argv[1:])
