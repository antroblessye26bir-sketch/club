"""Application factory for the Student Club Management System."""
import os
import secrets
from datetime import timedelta
from pathlib import Path

from flask import Flask, render_template

from core import db, helpers, security
from modules import (admin, announcements, auth, clubs, dashboard, events,
                     finance, profile)

BASE_DIR = Path(__file__).resolve().parent


def _load_secret_key(instance_path):
    """Use SECRET_KEY from the environment, else create one and keep it."""
    if os.environ.get("SECRET_KEY"):
        return os.environ["SECRET_KEY"]
    key_file = Path(instance_path) / "secret_key"
    if not key_file.exists():
        key_file.write_text(secrets.token_hex(32))
    return key_file.read_text().strip()


def create_app(test_config=None):
    app = Flask(
        __name__,
        template_folder=str(BASE_DIR / "shared" / "templates"),
        static_folder=str(BASE_DIR / "shared" / "static"),
        instance_path=str(BASE_DIR / "instance"),
    )
    os.makedirs(app.instance_path, exist_ok=True)

    app.config.update(
        DATABASE=os.path.join(app.instance_path, "clubs.db"),
        SITE_NAME="CampusClubs",
        CURRENCY="₹",
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE="Lax",
        # Set COOKIE_SECURE=1 when the site is served over HTTPS.
        SESSION_COOKIE_SECURE=os.environ.get("COOKIE_SECURE") == "1",
        PERMANENT_SESSION_LIFETIME=timedelta(hours=8),
        MAX_CONTENT_LENGTH=1024 * 1024,
    )
    if test_config:
        app.config.update(test_config)
    if not app.config.get("SECRET_KEY"):
        app.config["SECRET_KEY"] = _load_secret_key(app.instance_path)

    db.init_app(app)
    security.init_app(app)
    helpers.init_app(app)

    for module in (auth, dashboard, clubs, events, announcements,
                   finance, admin, profile):
        app.register_blueprint(module.bp)

    for code, message in (
        (400, "The request could not be processed. Refresh the page and try again."),
        (403, "You do not have permission to view this page."),
        (404, "The page you are looking for does not exist."),
        (413, "The data you sent is too large."),
    ):
        app.register_error_handler(
            code,
            lambda error, c=code, m=message: (
                render_template("error.html", code=c, message=m), c),
        )

    # An absurdly large ID in a URL cannot exist in the database.
    app.register_error_handler(
        OverflowError,
        lambda error: (render_template(
            "error.html", code=404,
            message="The page you are looking for does not exist."), 404))

    with app.app_context():
        db.init_db()

    return app
