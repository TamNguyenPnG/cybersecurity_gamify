"""
Cybersecurity Gamify — static file server + JSON API backed by SQLite.

Run:  python server.py            (http://localhost:8099)
      python server.py --port 80
      python server.py --today 2026-10-12    (pretend it is another date)

Serves everything in public/ and handles /api/* against data/app.db.
Standard library only — no pip install required.
"""

import argparse
import json
import os
import sqlite3
import traceback
import datetime
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

ROOT = os.path.dirname(os.path.abspath(__file__))
PUBLIC = os.path.join(ROOT, "public")
DB_PATH = os.path.join(ROOT, "data", "app.db")

# ---------------------------------------------------------------------------
# Demo clock.
#
# The chapter windows in the database are the real October 2026 dates, so
# before October the site would show every chapter as "upcoming" and nothing
# would be playable. This override lets the site be demonstrated at any time.
#
# SET THIS TO None FOR PRODUCTION so the server uses the real date.
# ---------------------------------------------------------------------------
TODAY_OVERRIDE = "2026-10-03"

MAX_SCORE = 5


def today():
    if TODAY_OVERRIDE:
        return datetime.date.fromisoformat(TODAY_OVERRIDE)
    return datetime.date.today()


def connect():
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys = ON")
    return con


def now_iso():
    """Timestamp for a stored attempt.

    When the demo clock is overridden we stamp attempts with that date too —
    otherwise the records drawer shows plays that fall outside the very
    chapter window that allowed them.
    """
    now = datetime.datetime.now(datetime.timezone.utc)
    if TODAY_OVERRIDE:
        d = datetime.date.fromisoformat(TODAY_OVERRIDE)
        now = now.replace(year=d.year, month=d.month, day=d.day)
    return now.isoformat(timespec="seconds")


# ---------------------------------------------------------------------------
# Chapter availability
# ---------------------------------------------------------------------------

def chapter_states(con, email):
    """Resolve every chapter to one of:

        upcoming   window has not opened yet
        available  inside its window
        grace      window closed, but this user never played it — one last
                   chance, which ends the moment they leave the chapter
        locked     window closed and they played it, or used their grace run,
                   or the chapter has no content built
    """
    d = today()
    rows = con.execute("SELECT * FROM chapters ORDER BY id").fetchall()

    played = set()
    exited = set()
    if email:
        played = {r["chapter_id"] for r in con.execute(
            "SELECT DISTINCT chapter_id FROM attempts WHERE email = ?", (email,))}
        exited = {r["chapter_id"] for r in con.execute(
            "SELECT chapter_id FROM chapter_exits WHERE email = ?", (email,))}

    out = []
    for r in rows:
        cid = r["id"]
        opens = datetime.date.fromisoformat(r["opens"])
        closes = datetime.date.fromisoformat(r["closes"])

        if not r["has_content"]:
            state, reason = "locked", "no-content"
        elif d < opens:
            state, reason = "upcoming", "not-open-yet"
        elif d <= closes:
            state, reason = "available", "open"
        elif cid in played:
            state, reason = "locked", "window-closed"
        elif cid in exited:
            state, reason = "locked", "grace-used"
        else:
            state, reason = "grace", "last-chance"

        best = None
        plays = 0
        if email:
            agg = con.execute(
                "SELECT MAX(score) AS best, COUNT(*) AS plays FROM attempts "
                "WHERE email = ? AND chapter_id = ?", (email, cid)).fetchone()
            best, plays = agg["best"], agg["plays"]

        out.append({
            "id": cid,
            "slug": r["slug"],
            "opens": r["opens"],
            "closes": r["closes"],
            "hasContent": bool(r["has_content"]),
            "state": state,
            "reason": reason,
            "best": best,
            "plays": plays,
        })
    return out


# ---------------------------------------------------------------------------
# API handlers
# ---------------------------------------------------------------------------

def api_employees(con, q):
    """Autocomplete source. Deliberately returns email and name only —
    the department is never exposed, so it cannot be guessed at login."""
    term = (q.get("q", [""])[0] or "").strip().lower()
    if not term:
        return []
    like = "%" + term + "%"
    rows = con.execute(
        "SELECT email, name FROM employees "
        "WHERE LOWER(email) LIKE ? OR LOWER(name) LIKE ? "
        "ORDER BY email LIMIT 6", (like, like)).fetchall()
    return [dict(r) for r in rows]


def api_verify(con, body):
    email = (body.get("email") or "").strip().lower()
    dept = (body.get("department") or "").strip()
    row = con.execute(
        "SELECT email, name, department, photo FROM employees WHERE LOWER(email) = ?",
        (email,)).fetchone()
    if not row:
        return {"ok": False, "error": "email-not-found"}
    if row["department"] != dept:
        return {"ok": False, "error": "department-mismatch"}
    return {"ok": True, "user": dict(row)}


def api_departments(con):
    return [r["name"] for r in con.execute(
        "SELECT name FROM departments ORDER BY name")]


def api_kpis(con):
    """Three headline numbers for the main hall."""
    total_people = con.execute("SELECT COUNT(*) AS n FROM employees").fetchone()["n"]
    completed = con.execute(
        "SELECT COUNT(DISTINCT email) AS n FROM attempts").fetchone()["n"]
    plays = con.execute("SELECT COUNT(*) AS n FROM attempts").fetchone()["n"]

    # Average of each participant's best score per chapter — one bad retry
    # should not drag a participant's average down.
    avg_row = con.execute(
        "SELECT AVG(best) AS avg FROM ("
        "  SELECT MAX(score) AS best FROM attempts GROUP BY email, chapter_id"
        ")").fetchone()
    avg = round(avg_row["avg"], 1) if avg_row["avg"] is not None else 0

    return [
        {"key": "completed", "value": str(completed),
         "pct": round(completed / total_people * 100) if total_people else 0,
         "sub": {"n": total_people}},
        {"key": "plays", "value": "{:,}".format(plays), "pct": min(plays * 4, 100)},
        {"key": "avg", "value": "{}/{}".format(avg, MAX_SCORE),
         "pct": round(avg / MAX_SCORE * 100)},
    ]


def api_records(con, q):
    """Every attempt this user has made, newest first — powers the
    'My records' panel."""
    email = (q.get("email", [""])[0] or "").strip().lower()
    if not email:
        return []
    rows = con.execute(
        "SELECT chapter_id, attempt_no, score, max_score, duration_s, "
        "       language, played_at "
        "FROM attempts WHERE LOWER(email) = ? "
        "ORDER BY played_at DESC, id DESC", (email,)).fetchall()
    return [dict(r) for r in rows]


def api_save_attempt(con, body):
    email = (body.get("email") or "").strip().lower()
    chapter = int(body.get("chapter_id") or body.get("chapter") or 0)
    score = int(body.get("score") or 0)

    if not con.execute("SELECT 1 FROM employees WHERE email = ?", (email,)).fetchone():
        return {"ok": False, "error": "unknown-user"}
    if not con.execute("SELECT 1 FROM chapters WHERE id = ?", (chapter,)).fetchone():
        return {"ok": False, "error": "unknown-chapter"}

    prev = con.execute(
        "SELECT COUNT(*) AS n FROM attempts WHERE email = ? AND chapter_id = ?",
        (email, chapter)).fetchone()["n"]

    con.execute(
        "INSERT INTO attempts (email, chapter_id, attempt_no, score, max_score, "
        "duration_s, language, detail, played_at) VALUES (?,?,?,?,?,?,?,?,?)",
        (email, chapter, prev + 1, score,
         int(body.get("max_score") or body.get("maxScore") or MAX_SCORE),
         body.get("duration_s") or body.get("durationS"),
         body.get("language"),
         json.dumps(body.get("detail") or {}, ensure_ascii=False), now_iso()))
    con.commit()
    return {"ok": True, "attempt_no": prev + 1, "attemptNo": prev + 1}


def api_exit_chapter(con, body):
    """Called when a user leaves a chapter they were playing on grace.
    Burns the one-off chance permanently."""
    email = (body.get("email") or "").strip().lower()
    chapter = int(body.get("chapter_id") or body.get("chapter") or 0)
    if not email:
        return {"ok": False, "error": "unknown-user"}
    con.execute(
        "INSERT OR IGNORE INTO chapter_exits (email, chapter_id, exited_at) "
        "VALUES (?,?,?)", (email, chapter, now_iso()))
    con.commit()
    return {"ok": True}


# ---------------------------------------------------------------------------
# HTTP plumbing
# ---------------------------------------------------------------------------

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=PUBLIC, **kw)

    def log_message(self, fmt, *args):
        if "/api/" in (self.path or ""):
            super().log_message(fmt, *args)

    def _send_json(self, payload, status=200):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self):
        length = int(self.headers.get("Content-Length") or 0)
        if not length:
            return {}
        try:
            return json.loads(self.rfile.read(length).decode("utf-8"))
        except ValueError:
            return {}

    def do_GET(self):
        parsed = urlparse(self.path)
        if not parsed.path.startswith("/api/"):
            return super().do_GET()

        q = parse_qs(parsed.query)
        con = connect()
        try:
            route = parsed.path
            if route == "/api/employees":
                return self._send_json(api_employees(con, q))
            if route == "/api/departments":
                return self._send_json(api_departments(con))
            if route == "/api/kpis":
                return self._send_json(api_kpis(con))
            if route == "/api/records":
                return self._send_json(api_records(con, q))
            if route == "/api/chapters":
                email = (q.get("email", [""])[0] or "").strip().lower()
                return self._send_json({
                    "today": today().isoformat(),
                    "chapters": chapter_states(con, email),
                })
            return self._send_json({"error": "not-found"}, 404)
        finally:
            con.close()

    def do_POST(self):
        parsed = urlparse(self.path)
        if not parsed.path.startswith("/api/"):
            return self._send_json({"error": "not-found"}, 404)

        body = self._read_json()
        con = connect()
        try:
            route = parsed.path
            if route == "/api/auth/verify":
                return self._send_json(api_verify(con, body))
            if route == "/api/attempts":
                return self._send_json(api_save_attempt(con, body))
            if route == "/api/chapter/exit":
                return self._send_json(api_exit_chapter(con, body))
            return self._send_json({"error": "not-found"}, 404)
        except Exception as exc:                      # noqa: BLE001
            # Without this the connection is simply dropped and the browser
            # reports an opaque network failure instead of a usable error.
            traceback.print_exc()
            return self._send_json({"error": "server-error",
                                    "detail": str(exc)}, 500)
        finally:
            con.close()


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--port", type=int, default=8099)
    ap.add_argument("--today", help="override the current date, e.g. 2026-10-12")
    args = ap.parse_args()

    if args.today:
        global TODAY_OVERRIDE
        TODAY_OVERRIDE = args.today

    if not os.path.exists(DB_PATH):
        raise SystemExit(
            "data/app.db not found — run: python data/scripts/build_db.py")

    srv = ThreadingHTTPServer(("0.0.0.0", args.port), Handler)
    print("Cybersecurity Gamify running on http://localhost:{}".format(args.port))
    print("serving   {}".format(os.path.relpath(PUBLIC, ROOT)))
    print("database  {}".format(os.path.relpath(DB_PATH, ROOT)))
    print("date      {}{}".format(today().isoformat(),
                                  "  (override)" if TODAY_OVERRIDE else ""))
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\nstopped")


if __name__ == "__main__":
    main()
