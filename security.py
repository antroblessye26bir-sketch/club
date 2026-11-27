"""Authentication, CSRF protection, permissions and security headers."""
import hmac
import secrets
from functools import wraps

from flask import abort, flash, g, redirect, request, session, url_for

from .db import query_one


def csrf_token():
    if "_csrf" not in session:
        session["_csrf"] = secrets.token_urlsafe(32)
    return session["_csrf"]


def _check_csrf():
    if request.method == "POST":
        sent = request.form.get("_csrf", "")
        expected = session.get("_csrf", "")
        if not expected or not hmac.compare_digest(sent.encode(), expected.encode()):
            abort(400)


def _load_user():
    g.user = None
    user_id = session.get("user_id")
    if user_id is None:
        return
    user = query_one("SELECT * FROM users WHERE id = ? AND is_active = 1", (user_id,))
    # session_version changes on password change, which signs out other devices.
    if user is None or user["session_version"] != session.get("version"):
        session.clear()
    else:
        g.user = user


def log_in(user):
    session.clear()
    session.permanent = True
    session["user_id"] = user["id"]
    session["version"] = user["session_version"]


def login_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if g.user is None:
            flash("Please sign in to continue.", "info")
            next_url = request.path if request.method == "GET" else None
            return redirect(url_for("auth.login", next=next_url))
        return view(*args, **kwargs)
    return wrapped


def admin_required(view):
    @wraps(view)
    @login_required
    def wrapped(*args, **kwargs):
        if not g.user["is_admin"]:
            abort(403)
        return view(*args, **kwargs)
    return wrapped


def membership_of(club_id):
    if g.user is None:
        return None
    return query_one("SELECT * FROM memberships WHERE user_id = ? AND club_id = ?",
                     (g.user["id"], club_id))


def is_member(club_id):
    m = membership_of(club_id)
    return bool(m and m["status"] == "approved")


def can_manage(club_id):
    """Admins manage every club; leaders manage their own."""
    if g.user is None:
        return False
    if g.user["is_admin"]:
        return True
    m = membership_of(club_id)
    return bool(m and m["status"] == "approved" and m["role"] == "leader")


def require_manage(club_id):
    if not can_manage(club_id):
        abort(403)


def managed_clubs():
    """Clubs the signed-in user may post events and announcements for."""
    from .db import query
    if g.user["is_admin"]:
        return query("SELECT id, name FROM clubs ORDER BY name")
    return query(
        """SELECT c.id, c.name FROM clubs c JOIN memberships m ON m.club_id = c.id
           WHERE m.user_id = ? AND m.role = 'leader' AND m.status = 'approved'
           ORDER BY c.name""", (g.user["id"],))


def _set_headers(response):
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "same-origin"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; img-src 'self' data:; frame-ancestors 'none'; "
        "form-action 'self'; base-uri 'self'")
    if request.endpoint != "static":
        response.headers["Cache-Control"] = "no-store"
    return response


def init_app(app):
    app.before_request(_check_csrf)
    app.before_request(_load_user)
    app.after_request(_set_headers)
    app.jinja_env.globals["csrf_token"] = csrf_token
    app.context_processor(
        lambda: {"show_finance": bool(g.get("user") and managed_clubs())})
