(() => {
  const user = initPage('attendance');
  if (!user) return;
  const today = dateStr();
  /* Attendance can only be taken for events held today or earlier */
  const held = Store.all('events').filter(e => e.date <= today).sort((a, b) => b.date.localeCompare(a.date));

  if (user.role !== 'admin') {
    $('#memberView').hidden = false;
    const records = held.filter(e => e.present && (e.rsvps.includes(user.id) || e.present.includes(user.id)));
    const attended = records.filter(e => e.present.includes(user.id)).length;
    const rate = records.length ? Math.round(attended / records.length * 100) + '%' : '-';
    $('#myStats').innerHTML = [['Events recorded', records.length], ['Attended', attended], ['Attendance rate', rate]]
      .map(([l, v]) => `<div class="card stat"><span class="muted">${l}</span><strong>${v}</strong></div>`).join('');
    $('#history').innerHTML = records.map(e => {
      const was = e.present.includes(user.id);
      return `<tr><td>${esc(e.title)}</td><td>${niceDate(e.date)}</td><td><span class="badge ${was ? 'green' : 'red'}">${was ? 'Present' : 'Absent'}</span></td></tr>`;
    }).join('') || emptyRow(3, 'No attendance records yet.');
    return;
  }

  $('#adminView').hidden = false;
  const select = $('#eventSelect');
  select.innerHTML = held.map(e => `<option value="${e.id}">${esc(e.title)} (${niceDate(e.date)})</option>`).join('')
    || '<option value="">No events held yet</option>';

  /* People expected: club members, anyone who RSVP'd, and anyone already marked */
  function roster(ev) {
    return Store.all('users').filter(u => u.role === 'member' &&
      (ev.present?.includes(u.id) || ev.rsvps.includes(u.id) ||
        (u.status === 'active' && (!ev.clubId || u.clubIds.includes(ev.clubId)))));
  }

  function updateSummary() {
    const boxes = [...document.querySelectorAll('#sheet input')];
    const saved = Store.find('events', select.value)?.present;
    $('#summary').textContent = select.value
      ? `${boxes.filter(b => b.checked).length} of ${boxes.length} marked present · ${saved ? 'Record saved earlier' : 'Not recorded yet'}` : '';
  }

  function render() {
    const ev = Store.find('events', select.value);
    $('#sheet').innerHTML = (ev ? roster(ev) : []).map(m => `<tr>
      <td><input type="checkbox" value="${m.id}" aria-label="Mark ${esc(m.name)} present" ${ev.present?.includes(m.id) ? 'checked' : ''}></td>
      <td>${esc(m.name)}</td><td>${esc(m.dept)}</td><td>${ev.rsvps.includes(m.id) ? 'Yes' : 'No'}</td></tr>`).join('')
      || emptyRow(4, ev ? 'No members for this event.' : 'Attendance opens on the day of an event.');
    $('.save-btn').disabled = !ev;
    updateSummary();
  }

  onAction({
    save() {
      if (!select.value) return;
      const present = [...document.querySelectorAll('#sheet input:checked')].map(b => b.value);
      Store.update('events', select.value, { present });
      toast('Attendance saved.');
      updateSummary();
    },
    export() {
      const ev = Store.find('events', select.value);
      if (!ev?.present) return toast('Save attendance before exporting.', true);
      exportCSV('attendance.csv', [['Event', 'Date', 'Name', 'Department', 'Status'],
        ...roster(ev).map(m => [ev.title, ev.date, m.name, m.dept, ev.present.includes(m.id) ? 'Present' : 'Absent'])]);
    }
  });
  select.onchange = render;
  $('#sheet').onchange = updateSummary;
  render();
})();
