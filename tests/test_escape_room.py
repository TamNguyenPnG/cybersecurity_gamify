import contextlib
import json
from pathlib import Path
import sqlite3
import tempfile
import threading
import unittest
from unittest.mock import patch

import server
from data.scripts import build_db


ROOT = Path(server.ROOT)
CONFIG = server.escape_config()
EMAIL = "escape-test@example.invalid"


def correct_answers(c):
    if c["type"] == "choice":
        return {"choice": c["correct"]}
    if c["type"] == "sms":
        return {"choice": c["correct"], "marks": c["marks"]}
    if c["type"] == "hotspots":
        return {"found": [h["id"] for h in c["hotspots"]]}
    if c["type"] == "sort":
        return {"placements": {i["id"]: i["group"] for i in c["items"]}}
    if c["type"] == "sequence":
        return {"order": c["order"]}
    if c["type"] == "bubbles":
        return {"hits": [i["id"] for i in c["safe"]]}
    return {"actions": [a["correct"] for a in c["alerts"]], "errors": 0, "elapsed": 5}


class EscapeFixture(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.path = str(Path(temp.name) / "test.db")
        self.db_patch = patch.object(server, "DB_PATH", self.path)
        self.db_patch.start()
        self.addCleanup(self.db_patch.stop)
        clock_patch = patch.object(server, "TODAY_OVERRIDE", "2026-10-23")
        clock_patch.start()
        self.addCleanup(clock_patch.stop)
        self.con = server.connect()
        self.addCleanup(self.con.close)
        self.con.executescript(build_db.SCHEMA)
        self.con.executescript((ROOT / "data" / "escape-room-schema.sql").read_text())
        self.con.execute("INSERT INTO departments VALUES ('Test')")
        self.con.execute("INSERT INTO employees(email,name,department) VALUES (?,?,?)",
                         (EMAIL, "Escape Test", "Test"))
        self.con.executemany("INSERT INTO chapters VALUES (?,?,?,?,?)", build_db.CHAPTERS)
        self.con.commit()

    def call(self, action, **payload):
        return server.api_escape(self.con, {"email": EMAIL, **payload}, action)

    def play_room(self, room, win=True):
        state, status = self.call("start", room_id=room["id"])
        self.assertEqual(status, 200)
        for c in room["challenges"]:
            result, status = self.call(
                "challenge", room_id=room["id"], run_id=state["rooms"][room["id"]]["run_id"],
                challenge_id=c["id"], answers=correct_answers(c) if win else {})
            self.assertEqual(status, 200)
        return result["progress"]


class EscapeDatabaseTests(EscapeFixture):
    def test_manifest_and_media(self):
        self.assertEqual(len(CONFIG["rooms"]), 4)
        self.assertEqual("".join(r["hint"] for r in CONFIG["rooms"]), "SAFE")
        for room in CONFIG["rooms"]:
            self.assertEqual(len(room["challenges"]), 4 if room["id"] == "installation" else 3)
            for c in room["challenges"]:
                self.assertTrue(server.escape_grade(c, correct_answers(c)), c["id"])
                self.assertFalse(server.escape_grade(c, {}), c["id"])
                for field in ("title", "prompt"):
                    self.assertTrue(c[field]["en"])
                    self.assertTrue(c[field]["vi"])
        def walk(value):
            if isinstance(value, dict):
                if "en" in value:
                    self.assertIn("vi", value)
                    self.assertTrue(value["vi"])
                for item in value.values():
                    walk(item)
            elif isinstance(value, list):
                for item in value:
                    walk(item)
            elif isinstance(value, str) and value.startswith("assets/"):
                self.assertTrue((ROOT / "public" / value).is_file(), value)
        walk(CONFIG)

    def test_master_needs_every_room_secured_code_and_no_trap(self):
        self.assertEqual(self.call("master", code="SAFE")[1], 409)
        for room in CONFIG["rooms"]:
            state = self.play_room(room, False)
            self.assertTrue(state["rooms"][room["id"]]["attempted"])
            self.assertIsNone(state["rooms"][room["id"]]["hint"])
        self.assertTrue(state["masterUnlocked"])
        self.assertFalse(self.call("master", code="WRNG")[0]["passed"])
        # Entering the master room is allowed, but the right code alone cannot win.
        self.assertFalse(self.call("master", code=" safe ")[0]["passed"])
        for room in CONFIG["rooms"][:3]:
            self.play_room(room)
        partial = self.call("master", code="SAFE")[0]
        self.assertFalse(partial["passed"])
        self.assertFalse(partial["progress"]["masterPassed"])
        self.play_room(CONFIG["rooms"][3])
        trapped = self.call("master", code="SAFE", trap=True)[0]
        self.assertFalse(trapped["passed"])
        self.assertFalse(trapped["progress"]["masterPassed"])
        self.assertTrue(self.call("master", code=" safe ")[0]["passed"])
        # A later bad launch never removes an earned master result.
        self.assertFalse(self.call("master", code="SAFE", trap=True)[0]["passed"])
        self.assertTrue(self.call("status")[0]["masterPassed"])

    def test_partial_and_successful_progress_survives_reconnection_and_replay(self):
        room = CONFIG["rooms"][0]
        state, _ = self.call("start", room_id=room["id"])
        run = state["rooms"][room["id"]]["run_id"]
        c = room["challenges"][0]
        self.call("challenge", room_id=room["id"], run_id=run,
                  challenge_id=c["id"], answers=correct_answers(c))
        with contextlib.closing(server.connect()) as other:
            progress = server.escape_status(other, EMAIL, CONFIG)
        self.assertEqual(progress["rooms"]["account"]["results"], {"password": True})
        self.assertFalse(progress["rooms"]["account"]["attempted"])
        self.assertIsNone(progress["rooms"]["account"]["hint"])
        self.play_room(room)
        with patch.object(server, "TODAY_OVERRIDE", "2026-10-24"):
            state, _ = self.call("status")
        self.assertEqual(state["rooms"]["account"]["hint"], "S")
        self.play_room(room, False)
        state, _ = self.call("status")
        self.assertTrue(state["rooms"]["account"]["passed"])
        self.assertEqual(state["rooms"]["account"]["hint"], "S")

    def test_stale_tabs_duplicates_and_unknown_challenges(self):
        room = CONFIG["rooms"][0]
        old, _ = self.call("start", room_id=room["id"])
        state, _ = self.call("start", room_id=room["id"])
        payload = {"room_id": room["id"], "challenge_id": "password",
                   "answers": {"choice": "strong"}}
        self.assertEqual(self.call("challenge", run_id=old["rooms"]["account"]["run_id"], **payload)[1], 409)
        run = state["rooms"]["account"]["run_id"]
        self.assertEqual(self.call("challenge", run_id=run, **payload)[1], 200)
        payload["answers"] = {}
        repeated, status = self.call("challenge", run_id=run, **payload)
        self.assertEqual(status, 200)
        self.assertTrue(repeated["passed"])
        payload["challenge_id"] = "unknown"
        self.assertEqual(self.call("challenge", run_id=run, **payload)[1], 400)

    def test_failed_challenge_retry_updates_result_and_passed_is_locked(self):
        room = CONFIG["rooms"][0]
        state, _ = self.call("start", room_id=room["id"])
        run = state["rooms"]["account"]["run_id"]
        base = {"room_id": "account", "run_id": run, "challenge_id": "password"}
        self.assertFalse(self.call("challenge", answers={"choice": "welcome"}, **base)[0]["passed"])
        retried, status = self.call("challenge", answers={"choice": "strong"}, **base)
        self.assertEqual(status, 200)
        self.assertTrue(retried["passed"])
        self.assertEqual(retried["progress"]["rooms"]["account"]["results"], {"password": True})
        locked, _ = self.call("challenge", answers={"choice": "welcome"}, **base)
        self.assertTrue(locked["passed"])
        self.assertEqual(locked["progress"]["rooms"]["account"]["results"], {"password": True})
        for c in room["challenges"][1:]:
            result, _ = self.call("challenge", room_id="account", run_id=run,
                                  challenge_id=c["id"], answers={})
        self.assertFalse(result["progress"]["rooms"]["account"]["passed"])
        sms = room["challenges"][1]
        fixed, _ = self.call("challenge", room_id="account", run_id=run,
                             challenge_id=sms["id"], answers=correct_answers(sms))
        self.assertTrue(fixed["passed"])
        office = room["challenges"][2]
        done, _ = self.call("challenge", room_id="account", run_id=run,
                            challenge_id=office["id"], answers=correct_answers(office))
        self.assertTrue(done["progress"]["rooms"]["account"]["passed"])
        self.assertEqual(done["progress"]["rooms"]["account"]["hint"], "S")

    def test_alarm_penalties_and_malformed_answers(self):
        alarm = CONFIG["rooms"][1]["challenges"][2]
        answers = correct_answers(alarm)
        answers.update(errors=1, elapsed=24.9)
        self.assertTrue(server.escape_grade(alarm, answers))
        answers["elapsed"] = 25
        self.assertFalse(server.escape_grade(alarm, answers))
        answers.update(errors=-1, elapsed=0)
        self.assertFalse(server.escape_grade(alarm, answers))
        sms = CONFIG["rooms"][0]["challenges"][1]
        self.assertFalse(server.escape_grade(sms, {"choice": "verify", "marks": [{}, {}, {}]}))
        hotspot = CONFIG["rooms"][0]["challenges"][2]
        self.assertFalse(server.escape_grade(hotspot, {"found": [{}, {}, {}, {}]}))

    def test_software_vault_grading_rules(self):
        vault = CONFIG["rooms"][3]["challenges"][3]
        safe = [i["id"] for i in vault["safe"]]
        risks = [i["id"] for i in vault["risks"]]
        self.assertEqual(sorted(safe), sorted(["email", "appscenter", "form", "manager"]))
        self.assertEqual(sorted(risks), sorted(["whatsapp", "usb", "dropbox", "crack"]))
        self.assertTrue(server.escape_grade(vault, {"hits": safe}))
        self.assertTrue(server.escape_grade(vault, {"hits": risks[:2] + safe}))
        self.assertFalse(server.escape_grade(vault, {"hits": risks[:3] + safe}))
        self.assertFalse(server.escape_grade(vault, {"hits": safe[:3]}))
        self.assertFalse(server.escape_grade(vault, {"hits": safe + safe[:1]}))
        self.assertFalse(server.escape_grade(vault, {"hits": safe + ["unknown"]}))
        self.assertFalse(server.escape_grade(vault, {"hits": [{}] * 4}))
        self.assertFalse(server.escape_grade(vault, {}))

    def test_installation_room_needs_all_four_challenges(self):
        room = CONFIG["rooms"][3]
        self.assertEqual(len(room["challenges"]), 4)
        state, _ = self.call("start", room_id="installation")
        run = state["rooms"]["installation"]["run_id"]
        for c in room["challenges"][:3]:
            result, _ = self.call("challenge", room_id="installation", run_id=run,
                                  challenge_id=c["id"], answers=correct_answers(c))
        progress = result["progress"]["rooms"]["installation"]
        self.assertFalse(progress["attempted"])
        self.assertFalse(progress["passed"])
        vault = room["challenges"][3]
        result, _ = self.call("challenge", room_id="installation", run_id=run,
                              challenge_id="vault", answers=correct_answers(vault))
        progress = result["progress"]["rooms"]["installation"]
        self.assertTrue(progress["attempted"])
        self.assertTrue(progress["passed"])
        self.assertEqual(progress["hint"], "E")

    def test_availability_and_account_isolation(self):
        self.play_room(CONFIG["rooms"][0])
        self.assertEqual(server.escape_status(self.con, "other@example.invalid", CONFIG)["rooms"]["account"]["hint"], None)
        self.assertEqual(server.api_escape(self.con, {"email": "missing"}, "status")[1], 400)
        with patch.object(server, "TODAY_OVERRIDE", "2026-10-22"):
            self.assertEqual(self.call("start", room_id="account")[1], 403)
        with patch.object(server, "TODAY_OVERRIDE", "2026-10-30"):
            self.con.execute("INSERT INTO chapter_exits VALUES (?,4,'2026-10-30')", (EMAIL,))
            self.con.commit()
            self.assertEqual(self.call("start", room_id="account")[1], 403)


try:
    from playwright.sync_api import sync_playwright
except ModuleNotFoundError:
    sync_playwright = None


@unittest.skipIf(sync_playwright is None, "Optional browser tests require Python playwright and installed Edge.")
class EscapeBrowserTests(EscapeFixture):
    def setUp(self):
        super().setUp()
        self.http = server.ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
        thread = threading.Thread(target=self.http.serve_forever, daemon=True)
        thread.start()
        def stop_server():
            self.http.shutdown()
            self.http.server_close()
            thread.join()
        self.addCleanup(stop_server)
        pw = sync_playwright().start()
        self.addCleanup(pw.stop)
        browser = pw.chromium.launch(channel="msedge", headless=True)
        self.addCleanup(browser.close)
        self.context = browser.new_context(viewport={"width": 1440, "height": 1000}, reduced_motion="reduce")
        self.addCleanup(self.context.close)
        self.context.add_init_script(
            "sessionStorage.setItem('csm_user', " + json.dumps(json.dumps(
                {"email": EMAIL, "name": "Escape Test", "department": "Test"})) + ");")
        self.page = self.context.new_page()
        self.errors = []
        self.page.on("pageerror", lambda error: self.errors.append(str(error)))
        self.url = f"http://127.0.0.1:{self.http.server_port}/chapter.html?ch=4&lang=en"
        self.open_game()

    def open_game(self):
        self.page.goto(self.url)
        self.page.locator(".game-intro button").click()
        self.page.locator(".escape-hall").wait_for()

    def continue_dialog(self):
        self.page.locator("dialog[open] .btn").first.click()

    def solve(self, c):
        page = self.page
        # Challenge artwork resizes the layout once it loads; wait so drags hit stable targets.
        page.wait_for_function("[...document.images].every(i => i.complete)")
        if c["type"] in ("choice", "sms"):
            page.locator(f'[data-option="{c["correct"]}"]').click()
            if c["type"] == "sms":
                for mark in c["marks"]:
                    page.locator(f'[data-option="{mark}"]').click()
                page.get_by_role("button", name="Submit answer", exact=True).click()
        elif c["type"] == "hotspots":
            for h in c["hotspots"]:
                img = page.locator(".escape-detective-frame img")
                img.wait_for()
                page.wait_for_function("document.querySelector('.escape-detective-frame img').naturalWidth > 0")
                box = img.bounding_box()
                x = (h["rect"][0] + h["rect"][2]) / 2 * box["width"]
                y = (h["rect"][1] + h["rect"][3]) / 2 * box["height"]
                img.click(position={"x": x, "y": y})
            if c.get("fullscreen"):
                page.locator("[data-complete]").click()
        elif c["type"] == "sort":
            for i, item in enumerate(c["items"]):
                source = page.locator(f'[data-option="{item["id"]}"]')
                target = page.locator(f'[data-group="{item["group"]}"]')
                if i == 0:
                    source.drag_to(target)
                else:
                    source.click()
                    target.click()
            page.get_by_role("button", name="Submit answer", exact=True).click()
        elif c["type"] == "sequence":
            order = c["order"]
            # Wrong order placed in any slot: nothing is judged until Submit.
            page.locator(f'[data-option="{order[3]}"]').drag_to(page.locator('[data-slot="0"]'))
            self.assertEqual(page.locator(".escape-feedback").count(), 0)
            self.assertEqual(page.locator("dialog[open]").count(), 0)
            page.locator(f'[data-option="{order[2]}"]').click()
            page.locator('[data-slot="3"]').click()
            self.assertEqual(page.locator('[data-slot="3"]').get_attribute("data-tile"), order[2])
            # Tapping a filled slot takes its tile back; swapping works too.
            page.locator('[data-slot="3"]').click()
            self.assertIsNone(page.locator('[data-slot="3"]').get_attribute("data-tile"))
            page.locator('[data-slot="0"]').drag_to(page.locator('[data-slot="2"]'))
            self.assertEqual(page.locator('[data-slot="2"]').get_attribute("data-tile"), order[3])
            self.assertTrue(page.get_by_role("button", name="Submit answer", exact=True).is_disabled())
            page.get_by_role("button", name="Reset sequence", exact=True).click()
            for i, step in enumerate(order):
                source = page.locator(f'[data-option="{step}"]')
                target = page.locator(f'[data-slot="{i}"]')
                if i % 2 == 0:
                    source.drag_to(target)
                else:
                    source.click()
                    target.click()
            page.get_by_role("button", name="Submit answer", exact=True).click()
        elif c["type"] == "alarm":
            page.get_by_role("button", name="Start", exact=True).click()
            for alert in c["alerts"]:
                page.locator(f'[data-option="{alert["correct"]}"]').click()
        elif c["type"] == "bubbles":
            page.get_by_role("button", name="Start", exact=True).click()
            for item in c["safe"]:
                self.pop(item["id"])
        page.locator("dialog[open]").wait_for()
        self.assertIn("passed" if c["type"] != "alarm" else "stabilized",
                      page.locator("dialog[open]").inner_text().lower())

    def pop(self, item_id):
        # Bubbles drift, so pop through the arena's own pointer handler.
        self.page.locator(f'.bubble[data-item="{item_id}"]').wait_for()
        self.page.evaluate(
            "(id) => document.querySelector(`.bubble[data-item=\"${id}\"]`)"
            ".dispatchEvent(new PointerEvent('pointerdown', {bubbles: true, cancelable: true}))",
            item_id)

    def launch(self, letters, trap=False):
        """Type the key on the keypad, press LAUNCH, then finish the countdown
        (or click the bait button when `trap` is set)."""
        page = self.page
        page.locator('[data-keybox="0"]').click()
        page.keyboard.type(letters)
        page.get_by_role("button", name="LAUNCH", exact=True).click()
        page.locator("[data-launch-clock]").wait_for()
        self.assertIn(page.locator("[data-launch-clock]").inner_text(), {"30", "29"})
        self.assertTrue(page.locator('[data-keybox="0"]').is_disabled())
        if trap:
            page.locator("[data-trap]").click()
        else:
            # Skip ahead instead of waiting out the real 30 seconds.
            page.evaluate("(() => { const now = Date.now; Date.now = () => now() + 31000; })()")

    def finish_video(self):
        """Let the playing video end (seek to its tail) and wait for the popup."""
        page = self.page
        page.wait_for_function("document.querySelector('video').readyState >= 1")
        if page.locator("dialog[open]").count() == 0:
            page.evaluate("(() => { const v = document.querySelector('video'); v.currentTime = Math.max(0, v.duration - 0.3); })()")
        page.locator("dialog[open]").wait_for()

    def test_master_keypad_countdown_trap_and_language(self):
        page = self.page
        for room in CONFIG["rooms"]:
            self.play_room(room)
        self.open_game()
        page.locator('[data-room="master"]').click()
        page.locator('[data-keybox="0"]').wait_for()
        # Everything lives in one frame; the old right-hand panel is gone.
        self.assertEqual(page.locator(".escape-panel").count(), 0)
        self.assertEqual(page.locator(".escape-master-frame .escape-key-box").count(), 4)
        self.assertEqual(page.locator(".escape-master-note").count(), 0)
        self.assertEqual(page.locator("[data-trap]").count(), 0)
        # Letters only, upper-cased, auto-advancing; an incomplete key does not launch.
        page.locator('[data-keybox="0"]').click()
        page.keyboard.type("s1a")
        self.assertEqual([page.locator(f'[data-keybox="{i}"]').input_value() for i in range(4)],
                         ["S", "A", "", ""])
        page.get_by_role("button", name="LAUNCH", exact=True).click()
        self.assertIn("Enter all four letters", page.locator(".escape-master-note").inner_text())
        self.assertEqual(page.locator("[data-launch-clock]").count(), 0)
        # Backspace walks back across the boxes; pasting fills them.
        page.locator('[data-keybox="0"]').click()
        page.evaluate("""() => {
            const box = document.querySelector('[data-keybox="0"]');
            const data = new DataTransfer(); data.setData('text', 's-a f!e');
            box.dispatchEvent(new ClipboardEvent('paste', {clipboardData: data, bubbles: true, cancelable: true}));
        }""")
        self.assertEqual([page.locator(f'[data-keybox="{i}"]').input_value() for i in range(4)],
                         list("SAFE"))
        page.get_by_role("button", name="LAUNCH", exact=True).click()
        page.locator("[data-trap]").wait_for()
        self.assertIn("Download to see your certificate", page.locator("[data-trap]").inner_text())
        before = int(page.locator("[data-launch-clock]").inner_text())
        # Switching language keeps the countdown running and the bait visible.
        page.evaluate("I18N.set('vi')")
        self.assertIn("Tải xuống để xem chứng nhận", page.locator("[data-trap]").inner_text())
        self.assertLessEqual(int(page.locator("[data-launch-clock]").inner_text()), before)
        self.assertTrue(page.locator('[data-keybox="0"]').is_disabled())
        # Leaving mid-countdown abandons the launch: nothing is recorded.
        page.locator("[data-back]").click()
        page.locator('[data-room="master"]').wait_for()
        self.assertIsNone(self.con.execute(
            "SELECT 1 FROM escape_rooms WHERE room_id='master'").fetchone())
        page.evaluate("I18N.set('en')")
        page.locator('[data-room="master"]').click()
        self.assertEqual(page.locator("[data-launch-clock]").count(), 0)
        # Clicking the bait fails the launch even with the correct key and every room secured.
        self.launch("SAFE", trap=True)
        page.locator("video").wait_for()
        self.assertTrue(page.locator("video").get_attribute("src").endswith("launch-fail.mp4"))
        self.assertIn("suspicious download", page.locator(".escape-bar h2").inner_text())
        self.assertEqual(self.con.execute(
            "SELECT passed FROM escape_rooms WHERE room_id='master'").fetchone()["passed"], 0)
        # The failure popup follows the video; its results button ends the chapter.
        self.finish_video()
        self.assertIn("Mission not completed", page.locator("dialog[open]").inner_text())
        page.locator("dialog[open]").get_by_role("button", name="View chapter results", exact=True).click()
        page.wait_for_url("**/result.html?**")
        self.assertIn("score=4", page.url)
        self.assertEqual(self.errors, [])

    def test_full_mission_and_persistent_hint(self):
        page = self.page
        for room in CONFIG["rooms"]:
            page.locator(f'.escape-door[data-room="{room["id"]}"]').click()
            start = 1 if room["id"] == "installation" else 0
            page.locator(f'[data-challenge="{room["challenges"][start]["id"]}"]').click()
            challenges = room["challenges"][start:] + room["challenges"][:start]
            for c in challenges:
                self.solve(c)
                self.continue_dialog()
            page.locator("dialog[open]").wait_for()
            self.assertIn(room["hint"], page.locator("dialog[open]").inner_text())
            self.continue_dialog()
        page.reload()
        page.locator(".game-intro button").click()
        page.locator('[data-room="account"]').click()
        self.assertIn("S", page.locator(".escape-key").inner_text())
        page.locator("[data-back]").click()
        page.locator('[data-room="master"]').click()
        self.launch("SAFE")
        page.locator("video").wait_for()
        self.assertTrue(page.locator("video").get_attribute("src").endswith("launch-complete.mp4"))
        page.wait_for_function("document.querySelector('video').readyState >= 2")
        page.wait_for_timeout(500)
        self.assertGreater(page.locator("video").evaluate("(v) => v.currentTime"), 0)
        # A successful launch ends quietly: no failure popup after the win video.
        page.evaluate("(() => { const v = document.querySelector('video'); v.currentTime = Math.max(0, v.duration - 0.3); })()")
        page.wait_for_function("document.querySelector('video').ended")
        page.wait_for_timeout(500)
        self.assertEqual(page.locator("dialog[open]").count(), 0)
        page.get_by_role("button", name="View chapter results", exact=True).click()
        page.wait_for_url("**/result.html?**")
        self.assertIn("score=5", page.url)
        self.assertEqual(self.con.execute("SELECT score FROM attempts").fetchone()["score"], 5)
        self.assertEqual(self.errors, [])

    def test_failure_unlock_language_mobile_and_retry(self):
        page = self.page
        page.locator('[data-room="master"]').click()
        self.assertIn("Play through every challenge", page.locator("dialog[open]").inner_text())
        self.continue_dialog()
        for room in CONFIG["rooms"]:
            page.locator(f'[data-room="{room["id"]}"]').click()
            page.locator(f'[data-challenge="{room["challenges"][0]["id"]}"]').click()
            for _ in room["challenges"]:
                page.get_by_role("button", name="Finish this challenge without passing", exact=True).click()
                page.locator("dialog[open]").wait_for()
                self.continue_dialog()
            page.locator("dialog[open]").wait_for()
            self.continue_dialog()
        page.locator('[data-room="master"]').click()
        self.assertIn("Secure all four rooms", page.locator(".escape-master-note").inner_text())
        self.launch("WRNG")
        page.locator("video").wait_for()
        self.assertTrue(page.locator("video").get_attribute("src").endswith("launch-fail.mp4"))
        # Nothing interrupts the video; the popup only appears once it has finished.
        page.wait_for_function("document.querySelector('video').readyState >= 2")
        self.finish_video()
        dialog = page.locator("dialog[open]")
        self.assertIn("Mission not completed", dialog.inner_text())
        self.assertIn("rocket launch failed. Play again to try once more", dialog.inner_text())
        for name in ("Play again", "View chapter results", "Back to the escape hall"):
            self.assertEqual(dialog.get_by_role("button", name=name, exact=False).count(), 1, name)
        # Switching language keeps the popup and the finished video (it is not replayed).
        page.evaluate("I18N.set('vi')")
        dialog = page.locator("dialog[open]")
        self.assertIn("Chưa hoàn thành nhiệm vụ", dialog.inner_text())
        self.assertIn("Phóng tên lửa thất bại. Hãy chơi lại để thử lại.", dialog.inner_text())
        self.assertEqual(page.locator("video").count(), 1)
        self.assertFalse(page.locator("video").evaluate("(v) => !v.ended && v.currentTime < 1"))
        # Play again returns to a fresh, empty keypad that can launch once more.
        dialog.get_by_role("button", name="Chơi lại", exact=True).click()
        page.locator('[data-keybox="0"]').wait_for()
        self.assertEqual(page.locator("dialog[open]").count(), 0)
        self.assertEqual(page.locator('[data-keybox="0"]').input_value(), "")
        self.assertFalse(page.locator('[data-keybox="0"]').is_disabled())
        page.locator("[data-back]").click()
        page.evaluate("I18N.set('vi')")
        page.set_viewport_size({"width": 390, "height": 844})
        page.get_by_role("button", name="Tài khoản an toàn · Đã chơi", exact=False).click()
        page.get_by_role("button", name="Chơi lại thử thách của phòng", exact=True).click()
        page.locator('[data-option="strong"]').click()
        page.locator("dialog[open]").wait_for()
        self.assertIn("Vượt qua", page.locator("dialog[open]").inner_text())
        self.assertFalse(page.evaluate("document.documentElement.scrollWidth > innerWidth"))
        self.continue_dialog()
        page.locator('[data-option="verify"]').click()
        for mark in ("urgency", "link", "bypass"):
            page.locator(f'[data-option="{mark}"]').click()
        def fail_save(route):
            route.fulfill(status=503, content_type="application/json", body='{"error":"test-unavailable"}')
        page.route("**/api/escape/challenge", fail_save, times=1)
        page.get_by_role("button", name="Nộp câu trả lời", exact=True).click()
        page.get_by_role("button", name="Thử lại", exact=True).click()
        page.locator("dialog[open]").wait_for()
        self.assertIn("Vượt qua", page.locator("dialog[open]").inner_text())
        self.assertEqual(self.errors, [])

    def test_alarm_penalty_timeout_and_partial_resume(self):
        page = self.page
        page.locator('[data-room="device"]').click()
        page.locator('[data-challenge="alarm"]').click()
        page.get_by_role("button", name="Start", exact=True).click()
        page.locator('[data-option="ignore"]').click()
        self.assertIn("−5", page.locator(".escape-feedback").inner_text())
        self.assertLessEqual(int(page.locator("[data-alarm-clock]").inner_text()[:-1]), 25)
        page.evaluate("(() => { const now = Date.now; Date.now = () => now() + 31000; })()")
        page.locator("dialog[open]").wait_for()
        self.assertIn("Not passed", page.locator("dialog[open]").inner_text())
        self.continue_dialog()
        self.assertEqual(page.locator(".escape-panel h3").inner_text(), "Find the Risk")
        page.reload()
        page.locator(".game-intro button").click()
        page.locator('[data-room="device"]').click()
        door = page.locator('[data-challenge="alarm"]')
        self.assertFalse(door.is_disabled())
        self.assertIn("Not passed", door.inner_text())
        door.hover()
        self.assertEqual(door.inner_text().strip(), "Start challenge")
        self.assertEqual(self.errors, [])

    def test_failed_challenge_can_be_retried_but_passed_stays_locked(self):
        page = self.page
        page.locator('[data-room="account"]').click()
        page.locator('[data-challenge="password"]').click()
        page.locator('[data-option="welcome"]').click()
        self.assertIn("Not passed", page.locator("dialog[open]").inner_text())
        self.continue_dialog()
        page.locator('[data-option="strong"]').wait_for(state="detached")
        page.locator('[data-back]').click()
        page.locator('[data-room="account"]').click()
        door = page.locator('[data-challenge="password"]')
        self.assertFalse(door.is_disabled())
        self.assertIn("Not passed", door.inner_text())
        door.hover()
        self.assertEqual(door.inner_text().strip(), "Start challenge")
        door.click()
        page.locator('[data-option="strong"]').click()
        self.assertIn("Challenge passed", page.locator("dialog[open]").inner_text())
        self.continue_dialog()
        page.locator('[data-back]').click()
        page.locator('[data-room="account"]').click()
        door = page.locator('[data-challenge="password"]')
        self.assertTrue(door.is_disabled())
        self.assertIn("Passed", door.inner_text())
        self.assertEqual(self.errors, [])

    def test_office_detective_fullscreen_review_before_complete(self):
        page = self.page
        office = CONFIG["rooms"][0]["challenges"][2]
        self.assertTrue(office["fullscreen"])
        page.locator('[data-room="account"]').click()
        page.locator('[data-challenge="office"]').click()
        page.locator(".escape-detective-frame img").wait_for()
        page.wait_for_function("document.querySelector('.escape-detective-frame img').naturalWidth > 0")
        self.assertEqual(page.locator(".escape-panel").count(), 0)
        img = page.locator(".escape-detective-frame img")
        box = img.bounding_box()
        self.assertGreater(box["width"], 800)
        self.assertLessEqual(box["y"] + box["height"], 1000)
        for h in office["hotspots"]:
            box = img.bounding_box()
            img.click(position={"x": (h["rect"][0] + h["rect"][2]) / 2 * box["width"],
                                "y": (h["rect"][1] + h["rect"][3]) / 2 * box["height"]})
        self.assertEqual(page.locator("dialog[open]").count(), 0)
        self.assertEqual(page.locator(".escape-risk-ring").count(), 4)
        self.assertEqual(page.locator(".escape-risk-pin").count(), 4)
        self.assertIn("All risks found", page.locator(".escape-feedback").inner_text())
        page.locator("[data-complete]").wait_for()
        page.evaluate("I18N.set('vi')")
        self.assertIn("Hoàn thành", page.locator("[data-complete]").inner_text())
        self.assertEqual(page.locator(".escape-risk-ring").count(), 4)
        page.locator("[data-complete]").click()
        page.locator("dialog[open]").wait_for()
        self.assertIn("Vượt qua", page.locator("dialog[open]").inner_text())
        self.assertEqual(self.errors, [])

    def test_connection_maze_checks_only_on_submit(self):
        page = self.page
        maze = CONFIG["rooms"][2]["challenges"][0]
        page.locator('[data-room="connection"]').click()
        page.locator('[data-challenge="maze"]').click()
        page.locator('[data-slot="0"]').wait_for()
        for i, step in enumerate(reversed(maze["order"])):
            page.locator(f'[data-option="{step}"]').click()
            page.locator(f'[data-slot="{i}"]').click()
            self.assertEqual(page.locator("dialog[open]").count(), 0)
            self.assertEqual(page.locator(".escape-feedback").count(), 0)
        page.get_by_role("button", name="Submit answer", exact=True).click()
        dialog = page.locator("dialog[open]")
        dialog.wait_for()
        self.assertIn("Not passed", dialog.inner_text())
        self.assertIn("Data breach", dialog.inner_text())
        self.continue_dialog()
        page.locator("[data-back]").click()
        page.locator('[data-room="connection"]').click()
        door = page.locator('[data-challenge="maze"]')
        self.assertFalse(door.is_disabled())
        door.click()
        for i, step in enumerate(maze["order"]):
            page.locator(f'[data-option="{step}"]').drag_to(page.locator(f'[data-slot="{i}"]'))
        page.get_by_role("button", name="Submit answer", exact=True).click()
        page.locator("dialog[open]").wait_for()
        self.assertIn("Challenge passed", page.locator("dialog[open]").inner_text())
        self.assertEqual(self.errors, [])

    def test_software_vault_win_bomb_and_language_switch(self):
        page = self.page
        vault = CONFIG["rooms"][3]["challenges"][3]
        page.locator('[data-room="installation"]').click()
        door = page.locator('[data-challenge="vault"]')
        door.wait_for()
        self.assertEqual(page.locator("[data-challenge]").count(), 4)
        door.click()
        page.get_by_role("button", name="Start", exact=True).click()
        page.locator(".bubble").first.wait_for()
        self.assertEqual(page.locator(".bubble").count(), 8)
        self.pop("email")
        self.assertIn("1 / 4", page.locator(".hotspot-counter").inner_text())
        # Switching language keeps the running game and re-labels it in place.
        page.evaluate("I18N.set('vi')")
        self.assertEqual(page.locator(".bubble").count(), 7)
        self.assertIn("Mảnh chìa khóa", page.locator(".hotspot-counter").inner_text())
        self.assertEqual(page.locator('.bubble[data-item="manager"]').inner_text(), "Quản lý phê duyệt")
        page.evaluate("I18N.set('en')")
        self.assertEqual(page.locator('.bubble[data-item="manager"]').inner_text(), "Manager Approval")
        # Three bombs end the game with the vault still locked.
        for risk in ("whatsapp", "usb", "dropbox"):
            self.pop(risk)
        page.locator("dialog[open]").wait_for()
        text = page.locator("dialog[open]").inner_text()
        self.assertIn("Not passed", text)
        self.assertIn("vault stayed locked", text)
        self.continue_dialog()
        self.assertEqual(self.con.execute(
            "SELECT results FROM escape_rooms WHERE room_id='installation'").fetchone()["results"],
            '{"vault": false}')
        self.assertEqual(self.errors, [])

    def test_ordering_challenges_use_slots_and_judge_only_on_submit(self):
        page = self.page
        room = CONFIG["rooms"][3]
        workflow = next(c for c in room["challenges"] if c["id"] == "workflow")
        escape = next(c for c in room["challenges"] if c["id"] == "escape")
        page.locator('[data-room="installation"]').click()

        def open_challenge(cid):
            page.locator(f'[data-challenge="{cid}"]').click()
            page.locator('[data-slot="0"]').wait_for()

        # Workflow: 5 tiles, 5 slots, nothing else in the pool.
        open_challenge("workflow")
        self.assertEqual(page.locator(".escape-slot").count(), 5)
        self.assertEqual(page.locator(".escape-tile").count(), 5)
        for i, step in enumerate(reversed(workflow["order"])):
            page.locator(f'[data-option="{step}"]').click()
            page.locator(f'[data-slot="{i}"]').click()
            self.assertEqual(page.locator("dialog[open]").count(), 0)
        page.get_by_role("button", name="Submit answer", exact=True).click()
        page.locator("dialog[open]").wait_for()
        text = page.locator("dialog[open]").inner_text()
        self.assertIn("Not passed", text)
        self.assertIn("approval workflow was not in the right order", text)
        self.assertNotIn("Data breach", text)
        self.continue_dialog()

        # Escape: 8 tiles to choose from, 4 slots stacked top to bottom. Continue
        # moves on to the next unplayed challenge, which is this one.
        page.locator('[data-slot="0"]').wait_for()
        self.assertEqual(page.locator(".escape-panel h3").first.inner_text(), "Software Approval Escape")
        self.assertEqual(page.locator(".escape-slot").count(), 4)
        self.assertEqual(page.locator(".escape-tile").count(), 8)
        ys = [page.locator(f'[data-slot="{i}"]').bounding_box() for i in range(4)]
        for upper, lower in zip(ys, ys[1:]):
            self.assertLess(upper["y"], lower["y"])
            self.assertAlmostEqual(upper["x"], lower["x"], delta=1)
        # A distractor can be placed and removed freely, then the real order is dragged.
        page.locator('[data-option="crack"]').drag_to(page.locator('[data-slot="1"]'))
        self.assertEqual(page.locator('[data-slot="1"]').get_attribute("data-tile"), "crack")
        page.locator('[data-slot="1"]').click()
        self.assertIsNone(page.locator('[data-slot="1"]').get_attribute("data-tile"))
        for i, step in enumerate(escape["order"]):
            page.locator(f'[data-option="{step}"]').drag_to(page.locator(f'[data-slot="{i}"]'))
        # Reorder by dragging between slots: swap the first two, then swap back.
        page.locator('[data-slot="0"]').drag_to(page.locator('[data-slot="1"]'))
        self.assertEqual(page.locator('[data-slot="0"]').get_attribute("data-tile"), escape["order"][1])
        page.locator('[data-slot="0"]').drag_to(page.locator('[data-slot="1"]'))
        self.assertEqual(page.locator('[data-slot="0"]').get_attribute("data-tile"), escape["order"][0])
        page.evaluate("I18N.set('vi')")
        self.assertEqual(page.locator('[data-slot="0"]').inner_text().split("\n")[-1], "Giải trình nhu cầu công việc")
        page.evaluate("I18N.set('en')")
        page.get_by_role("button", name="Submit answer", exact=True).click()
        page.locator("dialog[open]").wait_for()
        self.assertIn("Challenge passed", page.locator("dialog[open]").inner_text())
        self.assertEqual(self.errors, [])

    def test_existing_chapter_hosts_unchanged(self):
        for chapter in (1, 2, 3):
            self.page.goto(self.url.replace("ch=4", f"ch={chapter}"))
            self.page.locator(".game-intro").wait_for()
            self.assertTrue(self.page.locator(".game-intro-title").inner_text())
            self.assertEqual(self.page.locator(".escape-game").count(), 0)
        self.assertEqual(self.errors, [])


if __name__ == "__main__":
    unittest.main()
