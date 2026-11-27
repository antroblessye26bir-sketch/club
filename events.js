(() => {
  const user = initPage('events');
  if (!user) return;
  const isAdmin = user.role === 'admin';
  $('#clubFilter').innerHTML = clubOptions().map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join('');

  function render() {
    const query = $('#search').value.toLowerCase();
    const when = $('#when').value;
    const club = $('#clubFilter').value;
    const today = dateStr();
    const events = Store.all('events')
      .filter(e => `${e.title} ${e.venue}`.toLowerCase().includes(query))
      .filter(e => when === 'all' || (when === 'upcoming' ? e.date >= today : e.date < today))
      .filter(e => !club || e.clubId === club)
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    if (when === 'past') events.reverse();

    $('#eventList').innerHTML = events.map(e => {
      const going = e.rsvps.includes(user.id);
      const full = e.rsvps.length >= e.capacity;
      const past = e.date < today;
      let buttons = '';
      if (isAdmin) buttons = `<button class="btn outline sm" data-action="edit" data-id="${e.id}">Edit</button><button class="btn danger sm" data-action="remove" data-id="${e.id}">Delete</button>`;
      else if (past) buttons = '<span class="muted">Event completed</span>';
      else buttons = `<button class="btn sm ${going ? 'danger' : ''}" data-action="rsvp" data-id="${e.id}" ${!going && full ? 'disabled' : ''}>${going ? 'Cancel RSVP' : full ? 'Fully booked' : 'RSVP'}</button>`;
      return `<article class="card item">
        <span class="badge">${esc(clubName(e.clubId))}</span>
        <h3>${esc(e.title)}</h3>
        <p class="event-date">${niceDate(e.date)} at ${esc(e.time)}</p>
        <p class="muted">Venue: ${esc(e.venue)}</p>
        <p class="pre">${esc(e.description)}</p>
        <div class="seats"><div style="width:${Math.min(100, e.rsvps.length / e.capacity * 100)}%"></div></div>
        <p class="muted">${e.rsvps.length} of ${e.capacity} seats booked</p>
        <div class="actions">${buttons}</div>
      </article>`;
    }).join('') || emptyBox('No events found.');
  }

  function openForm(ev) {
    formModal(ev ? 'Edit event' : 'Add event', [
      { name: 'title', label: 'Title', value: ev?.title },
      { name: 'clubId', label: 'Organising club', type: 'select', value: ev?.clubId, options: clubOptions() },
      { name: 'date', label: 'Date', type: 'date', value: ev?.date },
      { name: 'time', label: 'Time', type: 'time', value: ev?.time },
      { name: 'venue', label: 'Venue', value: ev?.venue },
      { name: 'capacity', label: 'Capacity', type: 'number', min: 1, value: ev?.capacity || 50 },
      { name: 'description', label: 'Description', type: 'textarea', value: ev?.description }
    ], data => {
      if (!Number.isInteger(data.capacity) || data.capacity < 1) return 'Capacity must be a whole number of 1 or more.';
      if (ev && data.capacity < ev.rsvps.length) return `${ev.rsvps.length} people have already RSVP'd.`;
      if (!ev && data.date < dateStr()) return 'A new event cannot be in the past.';
      ev ? Store.update('events', ev.id, data) : Store.add('events', { ...data, rsvps: [], present: null });
      render();
    });
  }

  onAction({
    add: () => isAdmin && openForm(),
    edit: id => isAdmin && openForm(Store.find('events', id)),
    remove(id) {
      if (!isAdmin || !confirm('Delete this event and its attendance record?')) return;
      Store.remove('events', id);
      toast('Event deleted.');
      render();
    },
    rsvp(id) {
      const ev = Store.find('events', id);
      const going = ev.rsvps.includes(user.id);
      if (!going && ev.rsvps.length >= ev.capacity) return toast('This event is full.', true);
      Store.update('events', id, { rsvps: going ? ev.rsvps.filter(x => x !== user.id) : [...ev.rsvps, user.id] });
      toast(going ? 'RSVP cancelled.' : 'RSVP confirmed.');
      render();
    }
  });
  $('#search').oninput = render;
  $('#when').onchange = render;
  $('#clubFilter').onchange = render;
  render();
})();
