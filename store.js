/* Data layer: everything is saved in the browser's localStorage.
   To connect a real backend later, replace the functions in this file. */
const DB_KEY = 'clubhub_db';
const SESSION_KEY = 'clubhub_session';
const CURRENCY = '₹';

/* Demo-only password scrambling. This is NOT secure hashing. */
function hashPassword(text) {
  let h = 5381;
  for (const ch of text) h = ((h * 33) ^ ch.codePointAt(0)) >>> 0;
  return h.toString(16);
}

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* Local date as YYYY-MM-DD, optionally shifted by a number of days */
function dateStr(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function seedData() {
  const user = (id, name, email, password, role, dept, year, status, clubIds) =>
    ({ id, name, email, password: hashPassword(password), role, dept, year, phone: '', status, clubIds, joined: dateStr(-90) });
  const event = (id, title, clubId, day, time, venue, capacity, description, rsvps, present = null) =>
    ({ id, title, clubId, date: dateStr(day), time, venue, capacity, description, rsvps, present });
  const txn = (day, type, category, amount, clubId, note) =>
    ({ id: uid(), date: dateStr(day), type, category, amount, clubId, note });

  return {
    users: [
      user('u1', 'Club Admin', 'admin@club.edu', 'admin123', 'admin', 'Administration', '-', 'active', []),
      user('u2', 'Aarav Sharma', 'member@club.edu', 'member123', 'member', 'Computer Science', '2nd', 'active', ['c1', 'c2']),
      user('u3', 'Priya Nair', 'priya@club.edu', 'member123', 'member', 'Electronics', '3rd', 'active', ['c1']),
      user('u4', 'Rohan Das', 'rohan@club.edu', 'member123', 'member', 'Mechanical', '1st', 'active', ['c3']),
      user('u5', 'Sara Khan', 'sara@club.edu', 'member123', 'member', 'Design', '2nd', 'pending', [])
    ],
    clubs: [
      { id: 'c1', name: 'Coding Club', category: 'Technical', description: 'Weekly coding sessions, hackathons and peer learning.', leadId: 'u3' },
      { id: 'c2', name: 'Cultural Society', category: 'Cultural', description: 'Music, dance, drama and campus festivals.', leadId: 'u2' },
      { id: 'c3', name: 'Sports Club', category: 'Sports', description: 'Inter-college tournaments and fitness activities.', leadId: 'u4' }
    ],
    events: [
      event('e1', 'Web Development Workshop', 'c1', 5, '14:00', 'Lab 204', 40, 'Hands-on introduction to HTML, CSS and JavaScript.', ['u2', 'u3']),
      event('e2', 'Annual Cultural Night', 'c2', 18, '18:00', 'Main Auditorium', 300, 'An evening of performances by students.', ['u2']),
      event('e3', 'Code Sprint', 'c1', -10, '10:00', 'Seminar Hall', 60, 'A three-hour programming contest.', ['u2', 'u3'], ['u2'])
    ],
    announcements: [
      { id: 'a1', title: 'Welcome to ClubHub', body: 'Browse clubs, RSVP to events and stay updated here.', clubId: '', pinned: true, date: dateStr(-3) },
      { id: 'a2', title: 'Hackathon teams', body: 'Form teams of up to four before the next meeting.', clubId: 'c1', pinned: false, date: dateStr(-1) }
    ],
    transactions: [
      txn(-30, 'income', 'Membership fees', 12000, '', 'Semester fees'),
      txn(-20, 'income', 'Sponsorship', 8000, 'c1', 'Local sponsor'),
      txn(-10, 'expense', 'Prizes', 3500, 'c1', 'Code Sprint prizes'),
      txn(-5, 'expense', 'Equipment', 4200, 'c3', 'Footballs and nets')
    ]
  };
}

const Store = {
  load() {
    try {
      const saved = JSON.parse(localStorage.getItem(DB_KEY));
      if (saved) return saved;
    } catch (e) { /* unreadable data: fall through and reseed */ }
    const fresh = seedData();
    this.save(fresh);
    return fresh;
  },
  save(db) { localStorage.setItem(DB_KEY, JSON.stringify(db)); },
  all(name) { return this.load()[name]; },
  find(name, id) { return this.all(name).find(r => r.id === id); },
  add(name, record) {
    const db = this.load();
    const item = { id: uid(), ...record };
    db[name].push(item);
    this.save(db);
    return item;
  },
  update(name, id, changes) {
    const db = this.load();
    const item = db[name].find(r => r.id === id);
    if (item) Object.assign(item, changes);
    this.save(db);
  },
  remove(name, id) {
    const db = this.load();
    db[name] = db[name].filter(r => r.id !== id);
    const without = list => list.filter(x => x !== id);
    if (name === 'users') {
      db.events.forEach(e => { e.rsvps = without(e.rsvps); if (e.present) e.present = without(e.present); });
      db.clubs.forEach(c => { if (c.leadId === id) c.leadId = ''; });
    }
    if (name === 'clubs') {
      db.users.forEach(u => { u.clubIds = without(u.clubIds); });
      /* Events and finance records are kept and become "All clubs" / general.
         Club-only announcements are deleted so they never become public. */
      [...db.events, ...db.transactions].forEach(r => { if (r.clubId === id) r.clubId = ''; });
      db.announcements = db.announcements.filter(a => a.clubId !== id);
    }
    this.save(db);
  }
};

const Auth = {
  current() {
    const user = Store.find('users', localStorage.getItem(SESSION_KEY));
    return user && user.status === 'active' ? user : null;
  },
  login(email, password) {
    const user = Store.all('users').find(u => u.email === email.trim().toLowerCase());
    if (!user || user.password !== hashPassword(password)) return 'Incorrect email or password.';
    if (user.status === 'pending') return 'Your account is waiting for admin approval.';
    if (user.status !== 'active') return 'Your account is inactive. Contact the admin.';
    localStorage.setItem(SESSION_KEY, user.id);
    return null;
  },
  logout() {
    localStorage.removeItem(SESSION_KEY);
    location.href = '../auth/login.html';
  }
};
