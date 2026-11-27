(() => {
  const user = initPage('clubs');
  if (!user) return;
  const isAdmin = user.role === 'admin';

  function render() {
    const query = $('#search').value.toLowerCase();
    const users = Store.all('users');
    const me = Store.find('users', user.id);
    const clubs = Store.all('clubs').filter(c => `${c.name} ${c.category}`.toLowerCase().includes(query));

    $('#clubList').innerHTML = clubs.map(c => {
      const count = users.filter(u => u.status === 'active' && u.clubIds.includes(c.id)).length;
      const joined = me.clubIds.includes(c.id);
      const buttons = isAdmin
        ? `<button class="btn outline sm" data-action="edit" data-id="${c.id}">Edit</button><button class="btn danger sm" data-action="remove" data-id="${c.id}">Delete</button>`
        : `<button class="btn sm ${joined ? 'danger' : ''}" data-action="toggle" data-id="${c.id}">${joined ? 'Leave club' : 'Join club'}</button>`;
      return `<article class="card item">
        <span class="badge">${esc(c.category)}</span>
        <h3>${esc(c.name)}</h3>
        <p class="pre">${esc(c.description)}</p>
        <p class="muted">Lead: ${esc(users.find(u => u.id === c.leadId)?.name || 'Not assigned')} · ${count} member(s)</p>
        <div class="actions">${buttons}</div>
      </article>`;
    }).join('') || emptyBox('No clubs found.');
  }

  function openForm(club) {
    const leads = Store.all('users').filter(u => u.role === 'member' && u.status === 'active').map(u => [u.id, u.name]);
    formModal(club ? 'Edit club' : 'Add club', [
      { name: 'name', label: 'Club name', value: club?.name },
      { name: 'category', label: 'Category', value: club?.category },
      { name: 'description', label: 'Description', type: 'textarea', value: club?.description },
      { name: 'leadId', label: 'Club lead', type: 'select', value: club?.leadId, options: [['', 'Not assigned'], ...leads] }
    ], data => {
      if (Store.all('clubs').some(c => c.id !== club?.id && c.name.toLowerCase() === data.name.toLowerCase())) return 'A club with this name already exists.';
      const saved = club ? (Store.update('clubs', club.id, data), club) : Store.add('clubs', data);
      const lead = Store.find('users', data.leadId); /* the lead is always a member of the club */
      if (lead && !lead.clubIds.includes(saved.id)) Store.update('users', lead.id, { clubIds: [...lead.clubIds, saved.id] });
      render();
    });
  }

  onAction({
    add: () => isAdmin && openForm(),
    edit: id => isAdmin && openForm(Store.find('clubs', id)),
    remove(id) {
      if (!isAdmin || !confirm('Delete this club? Its announcements are deleted too. Events and finance records are kept as "All clubs".')) return;
      Store.remove('clubs', id);
      toast('Club deleted.');
      render();
    },
    toggle(id) {
      const me = Store.find('users', user.id);
      const joined = me.clubIds.includes(id);
      Store.update('users', me.id, { clubIds: joined ? me.clubIds.filter(c => c !== id) : [...me.clubIds, id] });
      if (joined && Store.find('clubs', id).leadId === me.id) Store.update('clubs', id, { leadId: '' });
      toast(joined ? 'You left the club.' : 'You joined the club.');
      render();
    }
  });
  $('#search').oninput = render;
  render();
})();
