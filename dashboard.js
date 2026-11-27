(() => {
  const user = initPage('dashboard');
  if (!user) return;
  const isAdmin = user.role === 'admin';

  function render() {
    const { users, clubs, events, announcements, transactions } = Store.load();
    const upcoming = events.filter(e => e.date >= dateStr()).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    const visibleNews = announcements.filter(a => isAdmin || !a.clubId || user.clubIds.includes(a.clubId));
    const balance = transactions.reduce((sum, t) => sum + (t.type === 'income' ? t.amount : -t.amount), 0);
    const me = Store.find('users', user.id);

    const stats = isAdmin
      ? [['Active members', users.filter(u => u.role === 'member' && u.status === 'active').length], ['Clubs', clubs.length], ['Upcoming events', upcoming.length], ['Balance', money(balance)]]
      : [['My clubs', me.clubIds.length], ['My RSVPs', upcoming.filter(e => e.rsvps.includes(user.id)).length], ['Upcoming events', upcoming.length], ['Events attended', events.filter(e => e.present?.includes(user.id)).length]];
    $('#stats').innerHTML = stats.map(([label, value]) =>
      `<div class="card stat"><span class="muted">${label}</span><strong>${value}</strong></div>`).join('');

    $('#upcoming').innerHTML = upcoming.slice(0, 5).map(e =>
      `<li><div><strong>${esc(e.title)}</strong><div class="muted">${niceDate(e.date)} · ${esc(e.venue)}</div></div></li>`).join('')
      || '<li class="muted">No upcoming events.</li>';

    $('#news').innerHTML = [...visibleNews].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5).map(a =>
      `<li><div><strong>${esc(a.title)}</strong><div class="muted">${niceDate(a.date)} · ${esc(clubName(a.clubId))}</div></div></li>`).join('')
      || '<li class="muted">No announcements.</li>';

    if (isAdmin) {
      $('#pending').innerHTML = users.filter(u => u.status === 'pending').map(u =>
        `<li><div><strong>${esc(u.name)}</strong><div class="muted">${esc(u.email)}</div></div><button class="btn sm" data-action="approve" data-id="${u.id}">Approve</button></li>`).join('')
        || '<li class="muted">Nothing waiting for approval.</li>';
    }
  }

  onAction({
    approve(id) {
      if (!isAdmin) return;
      Store.update('users', id, { status: 'active' });
      toast('Member approved.');
      render();
    }
  });
  render();
})();
