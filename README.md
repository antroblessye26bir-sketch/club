# CampusClubs — Student Club Management System

Python (Flask) + SQLite + plain HTML, CSS and JavaScript.
There is no database server to install and no front-end build step.

## Quick start

You need Python 3.9 or newer. Open a terminal in this folder.

    python -m venv .venv
    .venv\Scripts\activate          # Windows
    source .venv/bin/activate       # macOS / Linux

    pip install -r requirements.txt
    python seed.py                  # optional demo data
    python run.py

Open http://127.0.0.1:5000

### Demo accounts (created by seed.py)

| Role         | Email               | Password    |
|--------------|---------------------|-------------|
| Admin        | admin@campus.test   | Admin@123   |
| Club leader  | leader@campus.test  | Leader@123  |
| Student      | student@campus.test | Student@123 |

For real use, **do not run seed.py**. Run `python create_admin.py` instead.
If you already loaded the demo data, delete `instance/clubs.db` first.

## Project structure

    student_club_manager/
    ├── app.py              application factory and settings
    ├── run.py              starts the development server
    ├── seed.py             demo data
    ├── create_admin.py     creates a real administrator
    ├── core/               database, schema, security, helpers
    ├── modules/            one folder per feature (routes.py + templates/)
    │   ├── auth/  dashboard/  clubs/  events/
    │   └── announcements/  finance/  admin/  profile/
    ├── shared/             base layout, macros, CSS, JavaScript
    ├── tests/              automated tests
    └── instance/           created on first run: database and secret key

All modules share `core/` and `shared/`; they are not standalone apps.

## Modules

| Module        | What it does |
|---------------|--------------|
| auth          | Registration, sign in, sign out, failed-login limit |
| dashboard     | Landing page; personal overview and pending requests |
| clubs         | Directory with search and filter, club pages, join requests, approvals, leader roles, member CSV |
| events        | Create and edit, members-only events, seat limits, registration, attendance, attendee CSV |
| announcements | Campus-wide and club notices, pinning |
| finance       | Income and expense ledger per club, balances, CSV |
| admin         | Statistics, user search, enable or disable accounts, admin rights |
| profile       | Personal details, password change, participation history |

## Roles

| Action                                   | Student | Club leader | Admin |
|------------------------------------------|:-------:|:-----------:|:-----:|
| Browse clubs, join, register for events  |   Yes   |     Yes     |  Yes  |
| Manage members, events, notices, finance |   No    |  Own clubs  |  All  |
| Edit club details                        |   No    |  Own clubs  |  All  |
| Create or delete clubs                   |   No    |     No      |  Yes  |
| Post campus-wide notices                 |   No    |     No      |  Yes  |
| Manage user accounts                     |   No    |     No      |  Yes  |

To set up a new club: sign in as admin, create the club, open
**Manage members**, and add a registered user as **Leader**.

## Customising

- Site name and currency symbol: `SITE_NAME` and `CURRENCY` in `app.py`
- Colours: the variables at the top of `shared/static/css/style.css`
- Club categories: `modules/clubs/routes.py`
- Finance categories: `modules/finance/routes.py`
- Database changes: `core/schema.sql` only creates missing tables. After
  changing an existing table, migrate it (or delete the demo database).

## Tests

    python -m unittest discover -s tests

## Security and deployment

Included: hashed passwords, CSRF tokens, role checks on the server,
parameterised SQL, escaped output, security headers and CSV formula protection.

`run.py` is for local use. Before putting the site online:

1. Use a production server, for example `pip install waitress` then
   `waitress-serve --call app:create_app`
2. Serve it over HTTPS and set the environment variable `COOKIE_SECURE=1`
3. Set a long random `SECRET_KEY` environment variable
4. Never enable `FLASK_DEBUG`, and never use the demo accounts
5. Back up `instance/clubs.db`

Event times use the server's local time zone, so set it to your campus time zone.

Not included: email verification, password reset by email, online payments
and file uploads. The failed-login limit is held in memory, so it resets on
restart and is not shared between several server processes.
