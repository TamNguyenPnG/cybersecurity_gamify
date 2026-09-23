"""
Generates the two Excel data-contract templates in data/templates/.

These workbooks are a SPEC, not a database. They define the exact columns a
future backend must produce so that the front end (and any reporting/BI on
top of it) can be swapped from the mock DB to real storage without redesign.

Run:  python data/scripts/build_templates.py
Requires: openpyxl
"""

import os
from datetime import datetime

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT_DIR = os.path.join(ROOT, "data", "templates")

NAVY = "0B2A5B"
CYAN = "22D3EE"
HEAD_FILL = PatternFill("solid", fgColor=NAVY)
NOTE_FILL = PatternFill("solid", fgColor="EAF3FB")
HEAD_FONT = Font(color="FFFFFF", bold=True, size=11)
THIN = Side(style="thin", color="B9CCE0")
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)

DEPARTMENTS = [
    "Human Resources", "Information Technology", "Finance", "Marketing",
    "Sales", "Supply Chain", "Research & Development", "Manufacturing",
    "Legal", "Communications",
]

# (column header, width, type/format note, description)
PROGRESS_COLUMNS = [
    ("email",          30, "text · unique with chapter_id", "P&G email, lowercase. Foreign key to the employee directory."),
    ("full_name",      24, "text",                          "Display name shown on the leaderboard."),
    ("department",     26, "list",                          "Must match the employee record exactly, or access is denied."),
    ("chapter_id",      12, "integer 1-4",                  "Which chapter this row summarises."),
    ("chapter_title",  22, "text",                          "Denormalised for readability. Source of truth is the question file."),
    ("best_score",     12, "integer 0-5",                   "Highest score achieved across all attempts."),
    ("total_plays",    12, "integer >= 0",                  "Number of completed attempts. Ranking tiebreaker."),
    ("last_score",     12, "integer 0-5",                   "Score of the most recent attempt."),
    ("first_played_at", 20, "datetime ISO-8601",            "Timestamp of the first completed attempt."),
    ("last_played_at",  20, "datetime ISO-8601",            "Timestamp of the most recent completed attempt."),
    ("best_duration_s", 14, "integer seconds",              "Fastest completion time, for tiebreaks beyond total_plays."),
    ("status",         14, "list",                          "locked | available | completed — mirrors the chapter card state."),
    ("rank_in_chapter", 14, "integer >= 1",                 "Computed: best_score desc, then total_plays desc."),
    ("bravo_points",   12, "integer >= 0",                  "200 awarded to the top 3 of each chapter."),
    ("language",        10, "list",                         "en | vi — language used on the best attempt."),
]

PROGRESS_SAMPLE = [
    ["minh.cs@pg.com", "Minh Cao Sy", "Human Resources", 1, "Safe Account",
     5, 3, 5, "2026-10-05T09:14:00", "2026-10-06T11:02:00", 84, "completed", 1, 200, "vi"],
    ["tam.nt@pg.com", "Tam Nguyen Thi", "Information Technology", 1, "Safe Account",
     5, 4, 4, "2026-10-05T10:20:00", "2026-10-07T08:45:00", 91, "completed", 2, 200, "en"],
    ["linh.pd@pg.com", "Linh Pham Duc", "Finance", 2, "Safe Device",
     5, 6, 5, "2026-10-12T14:05:00", "2026-10-14T16:31:00", 102, "completed", 1, 200, "en"],
    ["huy.nv@pg.com", "Huy Nguyen Van", "Information Technology", 3, "Safe Connection",
     0, 0, 0, "", "", "", "locked", "", 0, "en"],
]

RECORD_COLUMNS = [
    ("record_id",      16, "text · primary key",   "Unique id for this answer row, e.g. UUID."),
    ("attempt_id",     18, "text",                 "Groups the 5 answer rows belonging to one attempt."),
    ("email",          30, "text",                 "Who answered. Foreign key to the employee directory."),
    ("department",     26, "list",                 "Department at the time of the attempt."),
    ("chapter_id",     12, "integer 1-4",          "Chapter the question belongs to."),
    ("attempt_no",     12, "integer >= 1",         "1-based attempt counter for this user + chapter."),
    ("question_id",    14, "text",                 "Stable id from the question file, e.g. c1q3. Never renumber these."),
    ("question_order", 14, "integer 1-5",          "Position the question was shown in this attempt."),
    ("options_order",  22, "text",                 "Shuffled option order as original indices, e.g. 2|0|3|1."),
    ("answer_index",   14, "integer",              "The correct option index, shared by both languages."),
    ("selected_index", 14, "integer",              "Original index of the option the user picked."),
    ("is_correct",     12, "boolean",              "TRUE / FALSE. Must equal selected_index == answer_index."),
    ("language",       10, "list",                 "en | vi — language the question was displayed in."),
    ("answered_at",    20, "datetime ISO-8601",    "When this answer was submitted."),
    ("time_taken_s",   14, "integer seconds",      "Seconds spent on this question."),
    ("attempt_score",  14, "integer 0-5",          "Final score of the attempt. Repeated on each of its rows."),
]

RECORD_SAMPLE = [
    ["rec-0001", "att-9f3c", "minh.cs@pg.com", "Human Resources", 1, 3, "c1q1", 1, "2|0|3|1", 0, 0, "TRUE", "vi", "2026-10-06T11:00:12", 14, 5],
    ["rec-0002", "att-9f3c", "minh.cs@pg.com", "Human Resources", 1, 3, "c1q4", 2, "1|3|0|2", 3, 3, "TRUE", "vi", "2026-10-06T11:00:41", 22, 5],
    ["rec-0003", "att-9f3c", "minh.cs@pg.com", "Human Resources", 1, 3, "c1q2", 3, "0|2|1|3", 2, 1, "FALSE", "vi", "2026-10-06T11:01:09", 18, 5],
]


def style_header(ws, columns):
    for i, (header, width, _type, _desc) in enumerate(columns, start=1):
        cell = ws.cell(row=1, column=i, value=header)
        cell.fill = HEAD_FILL
        cell.font = HEAD_FONT
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = BORDER
        ws.column_dimensions[get_column_letter(i)].width = width
    ws.row_dimensions[1].height = 22
    ws.freeze_panes = "A2"


def write_rows(ws, rows, start_row=2):
    for r, row in enumerate(rows, start=start_row):
        for c, value in enumerate(row, start=1):
            cell = ws.cell(row=r, column=c, value=value)
            cell.border = BORDER
            cell.alignment = Alignment(vertical="center")


def add_list_validation(ws, col_letter, options, last_row=500):
    dv = DataValidation(
        type="list",
        formula1='"' + ",".join(options) + '"',
        allow_blank=True,
        showDropDown=False,
    )
    dv.error = "Value must be one of: " + ", ".join(options)
    dv.errorTitle = "Invalid value"
    ws.add_data_validation(dv)
    dv.add("%s2:%s%d" % (col_letter, col_letter, last_row))


def add_schema_sheet(wb, columns, title, purpose, grain, notes):
    ws = wb.create_sheet("_schema")
    ws.column_dimensions["A"].width = 22
    ws.column_dimensions["B"].width = 26
    ws.column_dimensions["C"].width = 78

    ws["A1"] = title
    ws["A1"].font = Font(bold=True, size=14, color=NAVY)
    ws["A2"] = purpose
    ws["A2"].alignment = Alignment(wrap_text=True)
    ws.merge_cells("A2:C2")
    ws.row_dimensions[2].height = 30

    ws["A4"] = "Grain (one row = )"
    ws["A4"].font = Font(bold=True)
    ws["B4"] = grain
    ws.merge_cells("B4:C4")

    row = 6
    for label, value in [("Column", "Type / constraint", ), ]:
        ws.cell(row=row, column=1, value=label).font = HEAD_FONT
        ws.cell(row=row, column=1).fill = HEAD_FILL
        ws.cell(row=row, column=2, value=value).font = HEAD_FONT
        ws.cell(row=row, column=2).fill = HEAD_FILL
        ws.cell(row=row, column=3, value="Description").font = HEAD_FONT
        ws.cell(row=row, column=3).fill = HEAD_FILL
    row += 1

    for header, _w, type_note, desc in columns:
        ws.cell(row=row, column=1, value=header).font = Font(bold=True)
        ws.cell(row=row, column=2, value=type_note)
        c = ws.cell(row=row, column=3, value=desc)
        c.alignment = Alignment(wrap_text=True, vertical="top")
        for col in (1, 2, 3):
            ws.cell(row=row, column=col).border = BORDER
        row += 1

    row += 1
    ws.cell(row=row, column=1, value="Notes").font = Font(bold=True, size=12, color=NAVY)
    row += 1
    for note in notes:
        c = ws.cell(row=row, column=1, value="• " + note)
        c.alignment = Alignment(wrap_text=True, vertical="top")
        ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=3)
        ws.row_dimensions[row].height = 28
        row += 1

    row += 1
    ws.cell(row=row, column=1, value="Generated " + datetime.now().strftime("%Y-%m-%d %H:%M")).font = Font(
        italic=True, size=9, color="7B93AD"
    )
    return ws


def build_progress():
    wb = Workbook()
    ws = wb.active
    ws.title = "progress"

    style_header(ws, PROGRESS_COLUMNS)
    write_rows(ws, PROGRESS_SAMPLE)

    add_list_validation(ws, "C", DEPARTMENTS)
    add_list_validation(ws, "L", ["locked", "available", "completed"])
    add_list_validation(ws, "O", ["en", "vi"])

    add_schema_sheet(
        wb,
        PROGRESS_COLUMNS,
        "session_progress — live standings",
        "Current state per participant per chapter. This is what the Main Hall KPI strip, "
        "the chapter card states and the leaderboard read from.",
        "one participant × one chapter",
        [
            "Primary key is (email, chapter_id). A participant has at most 4 rows.",
            "Ranking rule: best_score DESC, then total_plays DESC, then best_duration_s ASC.",
            "bravo_points is derived, not entered: 200 for rank_in_chapter <= 3, otherwise 0.",
            "status is derived from progress: chapter 1 is always available; chapter N becomes "
            "available once chapter N-1 has best_score > 0.",
            "Rebuildable at any time by aggregating user_records.xlsx — treat this sheet as a "
            "materialised view, not the source of truth.",
        ],
    )

    path = os.path.join(OUT_DIR, "session_progress.xlsx")
    wb.save(path)
    return path


def build_records():
    wb = Workbook()
    ws = wb.active
    ws.title = "records"

    style_header(ws, RECORD_COLUMNS)
    write_rows(ws, RECORD_SAMPLE)

    add_list_validation(ws, "D", DEPARTMENTS)
    add_list_validation(ws, "L", ["TRUE", "FALSE"])
    add_list_validation(ws, "M", ["en", "vi"])

    add_schema_sheet(
        wb,
        RECORD_COLUMNS,
        "user_records — full answer history",
        "Append-only audit log. Every answer a participant submits produces exactly one row, "
        "so every score on the leaderboard can be reconstructed and defended.",
        "one answered question",
        [
            "Append only. Never update or delete a row — a retry creates a new attempt_id.",
            "A complete attempt is 5 rows sharing one attempt_id.",
            "question_id is the stable id from content/questions/chapter-0N.json. Keep these ids "
            "forever, even if the wording changes, so historical answers stay interpretable.",
            "answer_index is shared by both languages: the same option is correct in EN and VI, so "
            "language never affects scoring.",
            "options_order records the shuffle actually shown, which makes a disputed answer replayable.",
            "language records what the participant saw, not their profile preference.",
        ],
    )

    path = os.path.join(OUT_DIR, "user_records.xlsx")
    wb.save(path)
    return path


if __name__ == "__main__":
    if not os.path.isdir(OUT_DIR):
        os.makedirs(OUT_DIR)
    for p in (build_progress(), build_records()):
        print("wrote", os.path.relpath(p, ROOT))
