"""SQLite helpers. All queries use parameters, never string formatting of input."""
import sqlite3
from pathlib import Path

from flask import current_app, g

SCHEMA = Path(__file__).with_name("schema.sql")


def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(current_app.config["DATABASE"])
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA foreign_keys = ON")
    return g.db


def close_db(_error=None):
    conn = g.pop("db", None)
    if conn is not None:
        conn.close()


def query(sql, params=()):
    return get_db().execute(sql, params).fetchall()


def query_one(sql, params=()):
    return get_db().execute(sql, params).fetchone()


def scalar(sql, params=()):
    return get_db().execute(sql, params).fetchone()[0]


def execute(sql, params=()):
    """Run a write statement, commit it and return the cursor."""
    conn = get_db()
    with conn:
        return conn.execute(sql, params)


def init_db():
    conn = get_db()
    conn.executescript(SCHEMA.read_text(encoding="utf-8"))
    conn.commit()


def init_app(app):
    app.teardown_appcontext(close_db)
