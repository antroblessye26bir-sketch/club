(() => {
  const user = initPage('members');
  if (!user) return;
  const colours = { active: 'green', pending: 'amber', inactive: 'red' };
  const clubsOf = m => m.clubIds.map(clubName).join(', ') || '-';

  function filtered() {
    const query = $('#search').value.toLowerCase();
    const status = $('#statusFilter').value;
    return Store.all('users').filter(m =>
      `${m.name} ${m.email} ${m.dept}`.toLowerCase().includes(query) && (!status || m.status === status));
  }

  function render() {
    $('#rows').innerHTML = filtered().map(m => `<tr>
      <td><strong>${esc(m.name)}</strong><div class="muted">${esc(m.email)}</div></td>
      <td>${esc(m.dept)}<div class="muted">Year: ${esc(m.year)}</div></td>
      <td>${esc(clubsOf(m))}</td>
      <td class="role">${esc(m.role)}</td>
      <td><span class="badge ${colours[m.status]}">${esc(m.status)}</span></td>
      <td><div class="actions">
        ${m.status === 'pending' ? `<button class="btn sm" data-action="approve" data-id="${m.id}">Approve</button>` : ''}
        <button class="btn outline sm" data-action="edit" data-id="${m.id}">Edit</button>
        ${m.id !== user.id ? `<button class="btn danger sm" data-action="remove" data-id="${m.id}">Delete</button>` : ''}
      </div></td>
    </tr>`).join('') || emptyRow(6, 'No members found.');
  }

  function openForm(member) {
    const isSelf = member?.id === user.id;
    const fields = [
      { name: 'name', label: 'Full name', value: member?.name },
      { name: 'email', label: 'Email', type: 'email', value: member?.email },
      { name: 'dept', label: 'Department', value: member?.dept },
      { name: 'year', label: 'Year', value: member?.year },
      { name: 'phone', label: 'Phone (optional)', type: 'tel', value: member?.phone, required: false }
    ];
    if (!isSelf) fields.push( /* admins cannot demote or disable themselves */
      { name: 'role', label: 'Role', type: 'select', value: member?.role || 'member', options: [['member', 'Member'], ['admin', 'Admin']] },
      { name: 'status', label: 'Status', type: 'select', value: member?.status || 'active', options: [['active', 'Active'], ['pending', 'Pending'], ['inactive', 'Inactive']] });
    if (!member) fields.push({ name: 'password', label: 'Temporary password (min. 6 characters)', type: 'password' });

    formModal(member ? 'Edit member' : 'Add member', fields, data => {
      data.email = data.email.toLowerCase();
      if (Store.all('users').some(u => u.id !== member?.id && u.email === data.email)) return 'This email is already in use.';
      if (member) {
        Store.update('users', member.id, data);
        if (isSelf) $('#whoName').textContent = data.name;
      } else {
        if (data.password.length < 6) return 'Password must be at least 6 characters.';
        Store.add('users', { ...data, password: hashPassword(data.password), clubIds: [], joined: dateStr() });
      }
      render();
    });
  }

  onAction({
    add: () => openForm(),
    edit: id => openForm(Store.find('users', id)),
    approve(id) { Store.update('users', id, { status: 'active' }); toast('Member approved.'); render(); },
    remove(id) {
      if (id === user.id || !confirm('Delete this member permanently?')) return;
      Store.remove('users', id);
      toast('Member deleted.');
      render();
    },
    export() {
      exportCSV('members.csv', [['Name', 'Email', 'Department', 'Year', 'Phone', 'Clubs', 'Role', 'Status', 'Joined'],
        ...filtered().map(m => [m.name, m.email, m.dept, m.year, m.phone, clubsOf(m), m.role, m.status, m.joined])]);
    }
  });
  $('#search').oninput = render;
  $('#statusFilter').onchange = render;
  render();
})();
