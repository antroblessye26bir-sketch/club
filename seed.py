"""Load demo data into an EMPTY database:  python seed.py

The demo accounts use published passwords. Use them only for local testing.
"""
import sys
from datetime import date, datetime, timedelta

from werkzeug.security import generate_password_hash

from app import create_app
from core.db import execute, scalar

DEMO_USERS = [  # name, email, password, department, year, is_admin
    ("Campus Admin", "admin@campus.test", "Admin@123", "Student Affairs", "", 1),
    ("Priya Sharma", "leader@campus.test", "Leader@123", "Computer Science", "3rd", 0),
    ("Rahul Verma", "student@campus.test", "Student@123", "Electronics", "2nd", 0),
    ("Ananya Iyer", "ananya@campus.test", "Student@123", "Mechanical", "1st", 0),
]


def at(days, hour):
    moment = datetime.now() + timedelta(days=days)
    return moment.replace(hour=hour, minute=0).strftime("%Y-%m-%dT%H:%M")


def seed():
    if scalar("SELECT COUNT(*) FROM users"):
        sys.exit("The database already has data. Delete instance/clubs.db to start over.")
    ids = [execute(
        """INSERT INTO users (full_name, email, password_hash, department,
           year_of_study, is_admin) VALUES (?, ?, ?, ?, ?, ?)""",
        (n, e, generate_password_hash(p), d, y, a)).lastrowid
        for n, e, p, d, y, a in DEMO_USERS]
    admin, leader, student, other = ids

    clubs = [execute(
        "INSERT INTO clubs (name, category, description, meeting_schedule) VALUES (?, ?, ?, ?)",
        row).lastrowid for row in [
        ("Coding Circle", "Technology",
         "Weekly problem solving, project building and peer learning for every skill level.",
         "Fridays, 4:00 PM, Lab 2"),
        ("Lens & Light", "Arts & Culture",
         "A photography club for photo walks, editing sessions and campus exhibitions.",
         "Saturdays, 10:00 AM, Studio"),
        ("Green Campus", "Social Service",
         "Volunteers working on plantation drives, recycling and awareness campaigns.",
         "Alternate Wednesdays, 3:30 PM"),
    ]]
    for user, club, role, status in [
        (leader, clubs[0], "leader", "approved"), (student, clubs[0], "member", "approved"),
        (other, clubs[0], "member", "pending"), (other, clubs[1], "leader", "approved"),
        (student, clubs[2], "member", "approved")]:
        execute("INSERT INTO memberships (user_id, club_id, role, status) VALUES (?, ?, ?, ?)",
                (user, club, role, status))

    events = [execute(
        """INSERT INTO events (club_id, title, description, venue, starts_at, ends_at,
           capacity, members_only) VALUES (?, ?, ?, ?, ?, ?, ?, ?)""", row).lastrowid
        for row in [
            (clubs[0], "Intro to Git Workshop", "Hands-on session on version control. Bring a laptop.",
             "Lab 2", at(5, 15), at(5, 17), 40, 0),
            (clubs[1], "Campus Photo Walk", "Explore the campus and practise composition.",
             "Main Gate", at(9, 7), at(9, 9), 25, 0),
            (clubs[0], "Members' Hack Night", "Build something small with your team.",
             "Innovation Room", at(14, 17), at(14, 21), 0, 1),
            (clubs[2], "Tree Plantation Drive", "Saplings and tools are provided.",
             "North Lawn", at(-10, 8), at(-10, 11), 0, 0),
        ]]
    for event, user, attended in [(events[0], student, 0), (events[3], student, 1)]:
        execute("INSERT INTO registrations (event_id, user_id, attended) VALUES (?, ?, ?)",
                (event, user, attended))

    for row in [
        (None, admin, "Club registrations are open",
         "Browse the club directory and send a request to the clubs you like.", 1),
        (clubs[0], leader, "Bring your laptops",
         "Please install Git before the workshop.", 0)]:
        execute("INSERT INTO announcements (club_id, author_id, title, body, pinned) "
                "VALUES (?, ?, ?, ?, ?)", row)

    for kind, category, text, amount, days in [
        ("income", "College grant", "Annual activity grant", 1500000, 30),
        ("income", "Membership dues", "Semester dues", 240000, 20),
        ("expense", "Food & refreshments", "Orientation snacks", 185050, 12)]:
        execute("""INSERT INTO transactions (club_id, kind, category, description,
                   amount_minor, entry_date, recorded_by) VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (clubs[0], kind, category, text, amount,
                 (date.today() - timedelta(days=days)).isoformat(), leader))


if __name__ == "__main__":
    app = create_app()
    with app.app_context():
        seed()
    print("Demo data loaded.\n")
    for name, email, password, *_ in DEMO_USERS[:3]:
        print(f"  {email:22} {password}")
