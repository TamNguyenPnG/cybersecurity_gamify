"""
Convert the HR roster spreadsheet into data/source/employees.csv.

Run:  python data/scripts/import_roster.py
      python data/scripts/import_roster.py --xlsx "path/to/other.xlsx"

Why a CSV in the middle?
  * `build_db.py` then needs nothing but the Python standard library, so the
    site can be rebuilt on a machine without openpyxl installed.
  * It is readable and easy to correct by hand, one line per person.

Neither the spreadsheet nor this CSV is committed to git -- they are real
names and real email addresses, and the repository is public. They live only
on the machine that runs the site. See .gitignore.

Expected spreadsheet columns (first sheet, header row 1):
    Name | Email | Function

`Name` cells look like  "TRAN NHI (NHI TRAN)"  -- a Latin spelling with the
Vietnamese spelling in brackets. Both are kept: the Latin one as `name`, the
Vietnamese one as `name_vi`, so the site can show whichever suits the language.

After running this, rebuild the database:
    python data/scripts/build_db.py --reset
"""

import argparse
import csv
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SOURCE_DIR = os.path.join(ROOT, "data", "source")
DEFAULT_XLSX = os.path.join(SOURCE_DIR, "EE List - Cybersecurity.xlsx")
CSV_PATH = os.path.join(SOURCE_DIR, "employees.csv")

# A person whose Function cell is empty is filed here rather than dropped, so
# the roster count always matches the spreadsheet.
FALLBACK_DEPARTMENT = "Global Innovation"

EMAIL_RE = re.compile(r"^[a-z0-9._%-]+@[a-z0-9.-]+\.[a-z]{2,}$")


def titlecase(s):
    """Tidy a name without destroying Vietnamese diacritics.

    The spreadsheet mixes ALL CAPS and Title Case; this normalises both.
    """
    out = []
    for word in s.split():
        out.append(word[:1].upper() + word[1:].lower() if word else word)
    return " ".join(out)


def split_name(raw):
    """"TRAN NHI (NHI TRAN)" -> ("Tran Nhi", "Nhi Tran"). Brackets optional."""
    raw = " ".join(str(raw).split())
    m = re.match(r"^(.*?)\s*\((.*)\)\s*$", raw)
    if m:
        return titlecase(m.group(1)), titlecase(m.group(2))
    return titlecase(raw), ""


def read_xlsx(path):
    try:
        import openpyxl
    except ImportError:
        sys.exit("openpyxl is required to read the spreadsheet: pip install openpyxl")

    ws = openpyxl.load_workbook(path, data_only=True).worksheets[0]
    header = [str(c or "").strip().lower()
              for c in next(ws.iter_rows(min_row=1, max_row=1, values_only=True))]
    try:
        i_name = header.index("name")
        i_mail = header.index("email")
        i_func = header.index("function")
    except ValueError:
        sys.exit("expected columns Name, Email, Function -- found: " + ", ".join(header))

    people, seen, warnings = [], set(), []
    for n, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        raw_name = row[i_name] if i_name < len(row) else None
        raw_mail = row[i_mail] if i_mail < len(row) else None
        raw_func = row[i_func] if i_func < len(row) else None

        if not raw_name and not raw_mail:
            continue

        email = str(raw_mail or "").strip().lower()
        if not EMAIL_RE.match(email):
            warnings.append("row {}: skipped, bad email {!r}".format(n, raw_mail))
            continue
        if email in seen:
            warnings.append("row {}: skipped, duplicate of {}".format(n, email))
            continue
        seen.add(email)

        name, name_vi = split_name(raw_name or email.split("@")[0])
        dept = " ".join(str(raw_func or "").split()) or FALLBACK_DEPARTMENT
        if not raw_func:
            warnings.append("row {}: {} has no Function, filed under {}"
                            .format(n, email, FALLBACK_DEPARTMENT))

        people.append((email, name, name_vi, dept))

    return people, warnings


def main(xlsx):
    if not os.path.exists(xlsx):
        sys.exit("spreadsheet not found: " + xlsx)

    people, warnings = read_xlsx(xlsx)
    if not people:
        sys.exit("no usable rows found in " + xlsx)

    people.sort(key=lambda p: p[1])
    os.makedirs(SOURCE_DIR, exist_ok=True)
    with open(CSV_PATH, "w", encoding="utf-8", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["email", "name", "name_vi", "department"])
        w.writerows(people)

    depts = sorted({p[3] for p in people})
    print("read   ", os.path.relpath(xlsx, ROOT))
    print("wrote  ", os.path.relpath(CSV_PATH, ROOT))
    print("        {} people, {} departments".format(len(people), len(depts)))
    for d in depts:
        print("          {:<16} {}".format(d, sum(1 for p in people if p[3] == d)))
    for line in warnings:
        print("warning", line)
    print("\nnext:   python data/scripts/build_db.py --reset")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--xlsx", default=DEFAULT_XLSX,
                    help="roster spreadsheet (default: data/source/EE List - Cybersecurity.xlsx)")
    main(**vars(ap.parse_args()))
