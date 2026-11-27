(() => {
  const user = initPage('profile');
  if (!user) return;
  const isAdmin = user.role === 'admin';
  ['name', 'email', 'dept', 'year', 'phone'].forEach(key => { $('#' + key).value = user[key] || ''; });

  $('#profileForm').onsubmit = e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    Object.keys(data).forEach(k => { data[k] = data[k].trim(); });
    if (!data.name || !data.dept || !data.year) return toast('Name, department and year cannot be blank.', true);
    Store.update('users', user.id, data);
    $('#whoName').textContent = data.name;
    toast('Profile updated.');
  };

  $('#passwordForm').onsubmit = e => {
    e.preventDefault();
    const current = Store.find('users', user.id);
    if (hashPassword($('#oldPass').value) !== current.password) return toast('Current password is incorrect.', true);
    if ($('#newPass').value !== $('#confirmPass').value) return toast('New passwords do not match.', true);
    Store.update('users', user.id, { password: hashPassword($('#newPass').value) });
    e.target.reset();
    toast('Password changed.');
  };

  /* A restored backup must contain every list and at least one active admin.
     IDs are limited to letters and numbers because they are placed in HTML. */
  function isValidBackup(db) {
    const lists = ['users', 'clubs', 'events', 'announcements', 'transactions'];
    return !!db && lists.every(k => Array.isArray(db[k]) && db[k].every(r => r && /^[a-z0-9]+$/i.test(r.id)))
      && db.users.some(u => u.role === 'admin' && u.status === 'active' && Array.isArray(u.clubIds))
      && db.events.every(e => Array.isArray(e.rsvps) && Number.isFinite(e.capacity))
      && db.transactions.every(t => Number.isFinite(t.amount) && ['income', 'expense'].includes(t.type));
  }

  onAction({
    backup: () => isAdmin && downloadFile(`clubhub-backup-${dateStr()}.json`, JSON.stringify(Store.load(), null, 2), 'application/json'),
    restore: () => isAdmin && $('#restoreFile').click(),
    reset() {
      if (!isAdmin || !confirm('Erase all data and restore the demo data?')) return;
      Store.save(seedData());
      Auth.logout();
    }
  });

  $('#restoreFile').onchange = async e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file || !isAdmin) return;
    try {
      const db = JSON.parse(await file.text());
      if (!isValidBackup(db)) throw new Error('invalid');
      if (!confirm('Replace all current data with this backup?')) return;
      Store.save(db);
      Auth.logout();
    } catch (err) {
      toast('That is not a valid ClubHub backup file.', true);
    }
  };
})();
