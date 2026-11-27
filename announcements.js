(() => {
  const user = initPage('announcements');
  if (!user) return;
  const isAdmin = user.role === 'admin';

  function render() {
    const query = $('#search').value.toLowerCase();
    const list = Store.all('announcements')
      .filter(a => isAdmin || !a.clubId || user.clubIds.includes(a.clubId))
      .filter(a => `${a.title} ${a.body}`.toLowerCase().includes(query))
      .sort((a, b) => (b.pinned - a.pinned) || b.date.localeCompare(a.date));

    $('#feed').innerHTML = list.map(a => `<article class="card notice ${a.pinned ? 'pinned' : ''}">
      <span class="badge">${esc(clubName(a.clubId))}</span> ${a.pinned ? '<span class="badge amber">Pinned</span>' : ''}
      <h3>${esc(a.title)}</h3>
      <p class="muted">${niceDate(a.date)}</p>
      <p class="pre">${esc(a.body)}</p>
      ${isAdmin ? `<div class="actions"><button class="btn outline sm" data-action="edit" data-id="${a.id}">Edit</button><button class="btn danger sm" data-action="remove" data-id="${a.id}">Delete</button></div>` : ''}
    </article>`).join('') || emptyBox('No announcements found.');
  }

  function openForm(item) {
    formModal(item ? 'Edit announcement' : 'New announcement', [
      { name: 'title', label: 'Title', value: item?.title },
      { name: 'body', label: 'Message', type: 'textarea', value: item?.body },
      { name: 'clubId', label: 'Audience', type: 'select', value: item?.clubId, options: clubOptions('Everyone') },
      { name: 'pinned', label: 'Pin to top?', type: 'select', value: item?.pinned ? 'yes' : 'no', options: [['no', 'No'], ['yes', 'Yes']] }
    ], data => {
      data.pinned = data.pinned === 'yes';
      item ? Store.update('announcements', item.id, data) : Store.add('announcements', { ...data, date: dateStr() });
      render();
    });
  }

  onAction({
    add: () => isAdmin && openForm(),
    edit: id => isAdmin && openForm(Store.find('announcements', id)),
    remove(id) {
      if (!isAdmin || !confirm('Delete this announcement?')) return;
      Store.remove('announcements', id);
      toast('Announcement deleted.');
      render();
    }
  });
  $('#search').oninput = render;
  render();
})();
