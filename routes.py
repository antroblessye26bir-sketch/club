"""Announcements module: campus-wide and club notices."""
from flask import (Blueprint, abort, flash, g, redirect, render_template,
                   request, url_for)

from core.db import execute, query, query_one
from core.helpers import read_form
from core.security import can_manage, login_required, managed_clubs

bp = Blueprint("announcements", __name__, url_prefix="/announcements",
               template_folder="templates")


def can_edit(club_id):
    """Campus-wide notices belong to admins; club notices to club managers."""
    if club_id is None:
        return bool(g.user and g.user["is_admin"])
    return can_manage(club_id)


@bp.route("/")
@login_required
def index():
    rows = query(
        """SELECT a.*, c.name AS club_name, u.full_name AS author FROM announcements a
           LEFT JOIN clubs c ON c.id = a.club_id
           LEFT JOIN users u ON u.id = a.author_id
           WHERE ? = 1 OR a.club_id IS NULL OR a.club_id IN
             (SELECT club_id FROM memberships WHERE user_id = ? AND status = 'approved')
           ORDER BY a.pinned DESC, a.created_at DESC, a.id DESC""",
        (g.user["is_admin"], g.user["id"]))
    editable = {r["id"] for r in rows if can_edit(r["club_id"])}
    can_create = bool(g.user["is_admin"] or managed_clubs())
    return render_template("announcements/index.html", items=rows,
                           editable=editable, can_create=can_create)


def _form(item=None):
    clubs = managed_clubs()
    if not clubs and not g.user["is_admin"]:
        abort(403)
    data = dict(item) if item else {"club_id": request.args.get("club_id", type=int)}
    if request.method == "POST":
        data, errors = read_form(request.form, {
            "title": ("Title", True, 120), "body": ("Message", True, 3000)})
        data["pinned"] = int("pinned" in request.form)
        if item:
            data["club_id"] = item["club_id"]
        else:
            raw = request.form.get("club_id", "")
            data["club_id"] = request.form.get("club_id", type=int)
            if raw and data["club_id"] is None:
                errors.append("Choose a valid audience.")
            elif not can_edit(data["club_id"]) or (
                    data["club_id"] is not None
                    and data["club_id"] not in [c["id"] for c in clubs]):
                errors.append("Choose an audience that you are allowed to post to.")
        if not errors:
            if item:
                execute("UPDATE announcements SET title = ?, body = ?, pinned = ? "
                        "WHERE id = ?",
                        (data["title"], data["body"], data["pinned"], item["id"]))
                flash("Announcement updated.", "success")
            else:
                execute("""INSERT INTO announcements (club_id, author_id, title, body,
                           pinned) VALUES (?, ?, ?, ?, ?)""",
                        (data["club_id"], g.user["id"], data["title"],
                         data["body"], data["pinned"]))
                flash("Announcement published.", "success")
            return redirect(url_for("announcements.index"))
        for error in errors:
            flash(error, "error")
    return render_template("announcements/form.html", item=item, data=data, clubs=clubs)


def _get_editable(item_id):
    item = query_one("SELECT * FROM announcements WHERE id = ?", (item_id,))
    if item is None:
        abort(404)
    if not can_edit(item["club_id"]):
        abort(403)
    return item


@bp.route("/new", methods=["GET", "POST"])
@login_required
def create():
    return _form()


@bp.route("/<int:item_id>/edit", methods=["GET", "POST"])
@login_required
def edit(item_id):
    return _form(_get_editable(item_id))


@bp.route("/<int:item_id>/delete", methods=["POST"])
@login_required
def delete(item_id):
    _get_editable(item_id)
    execute("DELETE FROM announcements WHERE id = ?", (item_id,))
    flash("Announcement deleted.", "success")
    return redirect(url_for("announcements.index"))
