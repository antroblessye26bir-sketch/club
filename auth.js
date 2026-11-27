Store.load(); /* creates the sample data on first visit */
if (Auth.current()) location.replace('../dashboard/dashboard.html');

const loginForm = $('#loginForm');
if (loginForm) {
  loginForm.onsubmit = e => {
    e.preventDefault();
    const error = Auth.login($('#email').value, $('#password').value);
    if (error) return toast(error, true);
    location.href = '../dashboard/dashboard.html';
  };
}

const registerForm = $('#registerForm');
if (registerForm) {
  registerForm.onsubmit = e => {
    e.preventDefault();
    const name = $('#name').value.trim();
    const dept = $('#dept').value.trim();
    const email = $('#email').value.trim().toLowerCase();
    if (!name || !dept) return toast('Name and department cannot be blank.', true);
    if (Store.all('users').some(u => u.email === email)) return toast('This email is already registered.', true);
    Store.add('users', {
      name, email, dept, year: $('#year').value, phone: '',
      password: hashPassword($('#password').value),
      role: 'member', status: 'pending', clubIds: [], joined: dateStr()
    });
    registerForm.reset();
    toast('Registered! An admin must approve your account.');
  };
}
