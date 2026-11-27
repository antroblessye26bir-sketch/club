# ClubHub - Student Club Management Website

Built with plain HTML, CSS and JavaScript. No installation or internet needed.

## How to run
1. Unzip the folder.
2. Open `index.html` in Chrome or Edge.
   If your browser does not keep you logged in between pages (some browsers
   restrict storage for local files), run a local server inside the folder:
   `python -m http.server 8000`, then open http://localhost:8000
   (or use the "Live Server" extension in VS Code).

## Demo accounts
| Role   | Email           | Password  |
|--------|-----------------|-----------|
| Admin  | admin@club.edu  | admin123  |
| Member | member@club.edu | member123 |

## Features
| Module        | Admin                              | Member                      |
|---------------|------------------------------------|-----------------------------|
| Auth          | Log in                             | Register, log in            |
| Dashboard     | Totals, balance, approvals         | Personal summary            |
| Clubs         | Add, edit, delete, assign lead     | Search, join, leave         |
| Members       | Approve, add, edit, delete, export | No access                   |
| Events        | Add, edit, delete                  | Search, RSVP, cancel        |
| Attendance    | Mark, save, export                 | View own history            |
| Announcements | Create, edit, delete, pin          | Read (own clubs + everyone) |
| Finance       | Income, expenses, totals, export   | No access                   |
| Profile       | Details, password, backup/restore  | Details, password           |

## Folder structure
    club-manager/
      index.html
      README.md
      shared/    styles.css, store.js (data), ui.js (layout and helpers)
      modules/   one folder per module, each with its own HTML, CSS and JS

Each module also uses the files in `shared/`, so keep the structure unchanged.

## Customising
- Colours: edit the variables at the top of `shared/styles.css`.
- Currency: change `CURRENCY` (and the `en-IN` locale in `shared/ui.js`).
- Sample data: edit `seedData()` in `shared/store.js`, then use
  "Reset demo data" on the admin profile page.

## Important limitation
This is a front-end project for learning, demos and college submissions.
Data lives in one browser's localStorage, so it is not shared between devices.
Logins and admin restrictions are checked only in the browser and can be
bypassed, and password scrambling is not secure. Do not store real personal or
financial data. For real use, add a server with a database, proper password
hashing and server-side permission checks.
