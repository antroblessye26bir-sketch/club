"""Form validation, template filters and CSV export."""
import csv
import io
from datetime import datetime

from flask import Response, current_app


def read_form(form, fields):
    """Validate text fields.

    `fields` maps name -> (label, required, max_length).
    Returns (data, errors).
    """
    data, errors = {}, []
    for name, (label, required, max_length) in fields.items():
        value = form.get(name, "").strip()
        if required and not value:
            errors.append(f"{label} is required.")
        elif len(value) > max_length:
            errors.append(f"{label} must be at most {max_length} characters.")
        data[name] = value
    return data, errors


def now_local():
    """Current server time in the same format as stored event times."""
    return datetime.now().strftime("%Y-%m-%dT%H:%M")


def parse_datetime(value, fmt="%Y-%m-%dT%H:%M"):
    try:
        return datetime.strptime(value, fmt)
    except (TypeError, ValueError):
        return None


def like_pattern(term):
    """Escape LIKE wildcards. Use together with ESCAPE '\\'."""
    escaped = term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


def _safe_cell(value):
    """Stop spreadsheet apps from running user text as a formula."""
    text = "" if value is None else str(value)
    if text.startswith(("=", "+", "-", "@", "\t", "\r")):
        return "'" + text
    return text


def csv_response(filename, header, rows):
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(header)
    for row in rows:
        writer.writerow([_safe_cell(v) for v in row])
    return Response(
        "﻿" + buffer.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


def fmt_datetime(value):
    parsed = parse_datetime(value)
    return parsed.strftime("%d %b %Y, %I:%M %p") if parsed else value


def fmt_date(value):
    parsed = parse_datetime((value or "")[:10], "%Y-%m-%d")
    return parsed.strftime("%d %b %Y") if parsed else value


def fmt_money(minor):
    sign = "-" if minor < 0 else ""
    return f"{sign}{current_app.config['CURRENCY']}{abs(minor) / 100:,.2f}"


def init_app(app):
    app.jinja_env.filters.update(
        datetime=fmt_datetime, date=fmt_date, money=fmt_money)
    app.jinja_env.globals["now_local"] = now_local
