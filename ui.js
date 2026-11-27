/* Shared UI helpers: page layout, forms, messages and formatting. */
const $ = (sel, root = document) => root.querySelector(sel);

/* Escape user input before putting it into HTML (prevents script injection) */
const esc = value => String(value ?? '').replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const money = n => (n < 0 ? '-' : '') + CURRENCY + Math.abs(n).toLocaleString('en-IN');
const niceDate = s => new Date(s + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const clubName = id => Store.find('clubs', id)?.name || 'All clubs';
const clubOptions = (allLabel = 'All clubs') => [['', allLabel], ...Store.all('clubs').map(c => [c.id, c.name])];
const emptyRow = (cols, text) => `<tr><td colspan="${cols}" class="empty">${esc(text)}</td></tr>`;
const emptyBox = text => `<div class="card empty">${esc(text)}</div>`;

const PAGES = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'clubs', label: 'Clubs' },
  { key: 'members', label: 'Members', adminOnly: true },
  { key: 'events', label: 'Events' },
  { key: 'attendance', label: 'Attendance' },
  { key: 'announcements', label: 'Announcements' },
  { key: 'finance', label: 'Finance', adminOnly: true },
  { key: 'profile', label: 'My Profile' }
];

/* Call at the top of each page: checks login/role and draws the menu.
   Returns the logged-in user, or null if the page is redirecting. */
function initPage(key) {
  const user = Auth.current();
  if (!user) { location.replace('../auth/login.html'); return null; }
  const isAdmin = user.role === 'admin';
  if (PAGES.find(p => p.key === key).adminOnly && !isAdmin) {
    location.replace('../dashboard/dashboard.html');
    return null;
  }
  const links = PAGES.filter(p => isAdmin || !p.adminOnly).map(p =>
    `<a href="../${p.key}/${p.key}.html" class="${p.key === key ? 'active' : ''}">${p.label}</a>`).join('');

  document.body.insertAdjacentHTML('afterbegin', `
    <aside class="sidebar"><div class="brand">Club<span>Hub</span></div><nav>${links}</nav></aside>
    <div class="overlay"></div>
    <header class="topbar">
      <button class="btn outline sm menu-btn" aria-label="Open menu">☰ Menu</button>
      <div class="who"><strong id="whoName">${esc(user.name)}</strong><div class="muted">${isAdmin ? 'Administrator' : 'Member'}</div></div>
      <button class="btn outline sm" id="logoutBtn">Log out</button>
    </header>`);

  $('.menu-btn').onclick = () => document.body.classList.toggle('nav-open');
  $('.overlay').onclick = () => document.body.classList.remove('nav-open');
  $('#logoutBtn').onclick = () => Auth.logout();
  document.querySelectorAll('.admin-only').forEach(el => { el.hidden = !isAdmin; });
  return user;
}

function toast(message, isError = false) {
  $('.toast')?.remove();
  const el = document.createElement('div');
  el.className = 'toast' + (isError ? ' error' : '');
  el.setAttribute('role', 'status');
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

/* Pop-up form. fields: {name, label, type, value, options, required, min}
   onSave(values) may return an error message to keep the form open. */
function formModal(title, fields, onSave) {
  const dlg = document.createElement('dialog');
  const control = f => {
    const attrs = `name="${f.name}" id="f_${f.name}" ${f.required === false ? '' : 'required'}`;
    const value = f.value ?? '';
    if (f.type === 'select') return `<select ${attrs.replace('required', f.options[0]?.[0] === '' ? '' : 'required')}>${f.options.map(([v, text]) =>
      `<option value="${esc(v)}" ${String(v) === String(value) ? 'selected' : ''}>${esc(text)}</option>`).join('')}</select>`;
    if (f.type === 'textarea') return `<textarea ${attrs}>${esc(value)}</textarea>`;
    return `<input type="${f.type || 'text'}" ${attrs} value="${esc(value)}" ${f.min !== undefined ? `min="${f.min}"` : ''}>`;
  };
  dlg.innerHTML = `<form><h2>${esc(title)}</h2>
    ${fields.map(f => `<div class="field"><label for="f_${f.name}">${esc(f.label)}</label>${control(f)}</div>`).join('')}
    <div class="actions"><button type="button" class="btn outline" data-close>Cancel</button><button class="btn">Save</button></div></form>`;
  document.body.appendChild(dlg);
  dlg.addEventListener('close', () => dlg.remove());
  $('[data-close]', dlg).onclick = () => dlg.close();
  $('form', dlg).onsubmit = e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    for (const f of fields) {
      data[f.name] = data[f.name].trim();
      if (f.required !== false && f.type !== 'select' && !data[f.name]) return toast(`${f.label} cannot be blank.`, true);
      if (f.type === 'number') data[f.name] = Number(data[f.name]);
    }
    const error = onSave(data);
    if (error) return toast(error, true);
    dlg.close();
    toast('Saved successfully.');
  };
  dlg.showModal();
}

/* One click handler for all buttons that have a data-action attribute */
function onAction(handlers) {
  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (btn) handlers[btn.dataset.action]?.(btn.dataset.id);
  });
}

function downloadFile(filename, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function exportCSV(filename, rows) {
  const cell = v => {
    let s = String(v ?? '');
    if (typeof v === 'string' && /^[=+\-@]/.test(s)) s = "'" + s; /* stops spreadsheet formulas */
    return `"${s.replace(/"/g, '""')}"`;
  };
  downloadFile(filename, '﻿' + rows.map(r => r.map(cell).join(',')).join('\r\n'), 'text/csv');
}
