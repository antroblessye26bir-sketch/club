"""Run with:  python -m unittest discover -s tests"""
import os
import re
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import create_app                      # noqa: E402
from core.db import query_one, scalar           # noqa: E402
from modules.auth.routes import _failures, safe_next   # noqa: E402
from seed import at, seed                       # noqa: E402


class AppTest(unittest.TestCase):
    def setUp(self):
        _failures.clear()
        self.tmp = tempfile.TemporaryDirectory()
        self.app = create_app({"TESTING": True, "SECRET_KEY": "test",
                               "DATABASE": os.path.join(self.tmp.name, "t.db")})
        with self.app.app_context():
            seed()

    def tearDown(self):
        self.tmp.cleanup()

    def client(self, email=None, password=None):
        c = self.app.test_client()
        if email:
            r = self.post(c, "/login", {"email": email, "password": password})
            self.assertEqual(r.status_code, 302)
        return c

    def admin(self):
        return self.client("admin@campus.test", "Admin@123")

    def leader(self):
        return self.client("leader@campus.test", "Leader@123")

    def student(self):
        return self.client("student@campus.test", "Student@123")

    def post(self, c, url, data=None, follow=False):
        with c.session_transaction() as s:
            s.setdefault("_csrf", "tok")
            token = s["_csrf"]
        return c.post(url, data={**(data or {}), "_csrf": token},
                      follow_redirects=follow)

    def value(self, sql, params=()):
        with self.app.app_context():
            return scalar(sql, params)

    def test_every_page_renders_and_links_work(self):
        """Crawl all GET links as each role; none may fail."""
        for c in (self.client(), self.student(), self.leader(), self.admin()):
            seen, todo = set(), ["/"]
            while todo:
                url = todo.pop()
                if url in seen:
                    continue
                seen.add(url)
                r = c.get(url, follow_redirects=True)
                self.assertEqual(r.status_code, 200, url)
                if r.mimetype == "text/html":
                    todo += [u.replace("&amp;", "&") for u in
                             re.findall(r'href="(/[^"]*)"', r.get_data(as_text=True))]
                r.close()
            self.assertGreater(len(seen), 5)

    def test_permissions(self):
        s = self.student()
        for url in ("/admin/", "/clubs/new", "/clubs/1/members", "/clubs/1/edit",
                    "/finance/", "/finance/1", "/events/new", "/announcements/new",
                    "/events/1/attendance", "/events/1/attendees.csv",
                    "/clubs/1/members.csv", "/finance/1/export.csv"):
            self.assertEqual(s.get(url).status_code, 403, url)
        self.assertEqual(self.post(s, "/clubs/1/delete").status_code, 403)
        self.assertEqual(self.post(s, "/events/1/delete").status_code, 403)
        self.assertEqual(self.post(s, "/announcements/1/delete").status_code, 403)
        leader = self.leader()
        self.assertEqual(leader.get("/finance/2").status_code, 403)
        self.assertEqual(leader.get("/clubs/2/members").status_code, 403)
        self.assertEqual(self.client().get("/events/3").status_code, 403)
        self.assertEqual(self.client().get("/profile/").status_code, 302)

    def test_csrf_and_safe_redirect(self):
        self.assertEqual(self.student().post("/clubs/2/join").status_code, 400)
        with self.app.test_request_context():
            for bad in ("//evil.example", "https://evil.example", "/\\evil.example", "/\t/x"):
                self.assertEqual(safe_next(bad), "/")
            self.assertEqual(safe_next("/events/1"), "/events/1")

    def test_register_login_and_rate_limit(self):
        c = self.client()
        data = {"full_name": "New User", "email": "new@campus.test",
                "password": "Passw0rd1", "confirm": "Passw0rd1", "is_admin": "1"}
        self.assertEqual(self.post(c, "/register", data).status_code, 302)
        self.assertEqual(self.value("SELECT is_admin FROM users WHERE email='new@campus.test'"), 0)
        self.assertIn(b"already exists", self.post(c, "/register", data).data)
        for _ in range(5):
            self.post(c, "/login", {"email": "new@campus.test", "password": "wrong"})
        r = self.post(c, "/login", {"email": "new@campus.test", "password": "Passw0rd1"})
        self.assertEqual(r.status_code, 429)

    def test_membership_flow(self):
        s = self.student()
        self.post(s, "/clubs/2/join")
        mid = self.value("SELECT id FROM memberships WHERE user_id=3 AND club_id=2")
        self.post(self.admin(), f"/clubs/2/members/{mid}", {"action": "approve"})
        self.assertEqual(self.value("SELECT status FROM memberships WHERE id=?", (mid,)), "approved")
        self.post(s, "/clubs/2/leave")
        self.assertEqual(self.value("SELECT COUNT(*) FROM memberships WHERE id=?", (mid,)), 0)
        self.post(self.leader(), "/clubs/1/leave")   # only leader cannot leave
        self.assertEqual(self.value("SELECT COUNT(*) FROM memberships WHERE user_id=2"), 1)
        # A leader cannot act on another club's membership through their own club.
        other = self.value("SELECT id FROM memberships WHERE club_id=2")
        r = self.post(self.leader(), f"/clubs/1/members/{other}", {"action": "remove"})
        self.assertEqual(r.status_code, 404)

    def test_club_and_event_management(self):
        a = self.admin()
        club = {"name": "Chess", "category": "Hobby", "description": "Play chess"}
        self.assertEqual(self.post(a, "/clubs/new", club).status_code, 302)
        self.assertIn(b"already exists", self.post(a, "/clubs/new", club).data)
        leader = self.leader()
        event = {"club_id": "1", "title": "Demo", "description": "d", "venue": "v",
                 "starts_at": at(3, 10), "ends_at": at(3, 11), "capacity": "1"}
        self.assertEqual(self.post(leader, "/events/new", event).status_code, 302)
        eid = self.value("SELECT id FROM events WHERE title='Demo'")
        self.post(self.student(), f"/events/{eid}/register")
        r = self.post(a, f"/events/{eid}/register", follow=True)
        self.assertIn(b"event is full", r.data)
        self.assertEqual(self.value("SELECT COUNT(*) FROM registrations WHERE event_id=?", (eid,)), 1)
        self.assertEqual(self.post(leader, "/events/new", {**event, "club_id": "2"}).status_code, 200)
        self.assertIn(b"end after", self.post(leader, "/events/new",
                      {**event, "ends_at": at(2, 10)}).data)
        self.assertIn(b"whole number", self.post(leader, "/events/new",
                      {**event, "capacity": "-5"}).data)
        self.assertEqual(self.post(a, "/clubs/1/delete").status_code, 302)
        self.assertEqual(self.value("SELECT COUNT(*) FROM events WHERE club_id=1"), 0)

    def test_oversized_numbers(self):
        self.assertEqual(self.client().get("/clubs/" + "9" * 30).status_code, 404)
        event = {"club_id": "1", "title": "t", "description": "d", "venue": "v",
                 "starts_at": at(3, 10), "ends_at": at(3, 11), "capacity": "9" * 5000}
        self.assertIn(b"whole number", self.post(self.leader(), "/events/new", event).data)

    def test_attendance(self):
        a = self.admin()
        rid = self.value("SELECT id FROM registrations WHERE event_id=4")
        self.post(a, "/events/4/attendance", {})
        self.assertEqual(self.value("SELECT attended FROM registrations WHERE id=?", (rid,)), 0)
        self.post(a, "/events/4/attendance", {"present": str(rid)})
        self.assertEqual(self.value("SELECT attended FROM registrations WHERE id=?", (rid,)), 1)

    def test_announcements_and_finance(self):
        leader = self.leader()
        notice = {"title": "<script>x</script>", "body": "b", "club_id": "1"}
        self.assertEqual(self.post(leader, "/announcements/new", notice).status_code, 302)
        self.assertNotIn(b"<script>x", leader.get("/announcements/").data)
        self.assertEqual(self.post(leader, "/announcements/new",
                         {**notice, "club_id": ""}).status_code, 200)
        entry = {"kind": "expense", "category": "Venue", "description": "=1+1",
                 "amount": "99.50", "entry_date": "2025-01-01"}
        self.assertEqual(self.post(leader, "/finance/1", entry).status_code, 302)
        self.assertIn(b"'=1+1", leader.get("/finance/1/export.csv").data)
        before = self.value("SELECT COUNT(*) FROM transactions")
        for bad in ("-1", "0", "abc", "NaN", "Infinity", "1.005", "1e30"):
            self.assertEqual(self.post(leader, "/finance/1", {**entry, "amount": bad}).status_code, 200, bad)
        self.assertEqual(self.value("SELECT COUNT(*) FROM transactions"), before)

    def test_admin_and_password(self):
        a, s, s2 = self.admin(), self.student(), self.student()
        r = self.post(s, "/profile/password", {"current": "Student@123",
                      "password": "Changed123", "confirm": "Changed123"})
        self.assertEqual(r.status_code, 302)
        self.assertEqual(s.get("/profile/").status_code, 200)
        self.assertEqual(s2.get("/profile/").status_code, 302)   # other session ended
        self.post(a, "/admin/users/3", {"action": "deactivate"})
        self.assertEqual(s.get("/profile/").status_code, 302)
        self.post(a, "/admin/users/1", {"action": "deactivate"})  # not yourself
        self.assertEqual(self.value("SELECT is_active FROM users WHERE id=1"), 1)


if __name__ == "__main__":
    unittest.main()
