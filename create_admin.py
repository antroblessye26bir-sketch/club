"""Create a real administrator account:  python create_admin.py"""
import sys
from getpass import getpass

from werkzeug.security import generate_password_hash

from app import create_app
from core.db import execute, query_one
from modules.auth.routes import EMAIL_RE, password_error


def main():
    name = input("Full name: ").strip()
    email = input("Email: ").strip().lower()
    password = getpass("Password: ")
    problem = password_error(password, getpass("Confirm password: "))
    if not name or not EMAIL_RE.match(email):
        problem = "Enter a name and a valid email address."
    if problem:
        sys.exit(problem)
    with create_app().app_context():
        if query_one("SELECT 1 FROM users WHERE email = ?", (email,)):
            sys.exit("That email is already registered.")
        execute("INSERT INTO users (full_name, email, password_hash, is_admin) "
                "VALUES (?, ?, ?, 1)", (name, email, generate_password_hash(password)))
    print("Administrator created.")


if __name__ == "__main__":
    main()
