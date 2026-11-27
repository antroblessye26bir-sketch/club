(() => {
  const user = initPage('finance');
  if (!user) return;
  const general = id => (id ? clubName(id) : 'General');
  $('#clubFilter').innerHTML = [['all', 'All records'], ...clubOptions('General')]
    .map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join('');

  function filtered() {
    const type = $('#typeFilter').value;
    const club = $('#clubFilter').value;
    return Store.all('transactions')
      .filter(t => (!type || t.type === type) && (club === 'all' || t.clubId === club))
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  function render() {
    const list = filtered();
    const sum = type => list.filter(t => t.type === type).reduce((s, t) => s + t.amount, 0);
    const income = sum('income'), expense = sum('expense');
    $('#totals').innerHTML = [['Total income', income], ['Total expenses', expense], ['Net balance', income - expense]]
      .map(([l, v]) => `<div class="card stat"><span class="muted">${l} (shown)</span><strong>${money(v)}</strong></div>`).join('');

    $('#rows').innerHTML = list.map(t => `<tr>
      <td>${niceDate(t.date)}</td><td>${esc(t.category)}</td><td>${esc(general(t.clubId))}</td><td>${esc(t.note || '-')}</td>
      <td class="amount ${t.type}">${t.type === 'income' ? '+' : '-'} ${money(t.amount)}</td>
      <td><div class="actions"><button class="btn outline sm" data-action="edit" data-id="${t.id}">Edit</button><button class="btn danger sm" data-action="remove" data-id="${t.id}">Delete</button></div></td>
    </tr>`).join('') || emptyRow(6, 'No transactions found.');
  }

  function openForm(t) {
    formModal(t ? 'Edit transaction' : 'Add transaction', [
      { name: 'type', label: 'Type', type: 'select', value: t?.type || 'income', options: [['income', 'Income'], ['expense', 'Expense']] },
      { name: 'amount', label: `Amount (${CURRENCY}, whole number)`, type: 'number', min: 1, value: t?.amount },
      { name: 'category', label: 'Category', value: t?.category },
      { name: 'clubId', label: 'Club', type: 'select', value: t?.clubId, options: clubOptions('General') },
      { name: 'date', label: 'Date', type: 'date', value: t?.date || dateStr() },
      { name: 'note', label: 'Note (optional)', value: t?.note, required: false }
    ], data => {
      if (!Number.isInteger(data.amount) || data.amount < 1) return 'Enter a whole amount of 1 or more.';
      t ? Store.update('transactions', t.id, data) : Store.add('transactions', data);
      render();
    });
  }

  onAction({
    add: () => openForm(),
    edit: id => openForm(Store.find('transactions', id)),
    remove(id) {
      if (!confirm('Delete this transaction?')) return;
      Store.remove('transactions', id);
      toast('Transaction deleted.');
      render();
    },
    export() {
      exportCSV('finance.csv', [['Date', 'Type', 'Category', 'Club', 'Note', 'Amount'],
        ...filtered().map(t => [t.date, t.type, t.category, general(t.clubId), t.note, t.amount])]);
    }
  });
  $('#typeFilter').onchange = render;
  $('#clubFilter').onchange = render;
  render();
})();
