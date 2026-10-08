// Stands in for an ATS backend: validates required fields on submit, then shows a confirmation.
document.addEventListener('submit', function (event) {
  event.preventDefault();
  var form = event.target;
  form.querySelectorAll('.error').forEach(function (e) { e.remove(); });
  var missing = [];
  form.querySelectorAll('[required], [aria-required="true"]').forEach(function (el) {
    var empty = el.type === 'radio' || el.type === 'checkbox'
      ? !form.querySelector('input[name="' + el.name + '"]:checked')
      : el.type === 'file' ? el.files.length === 0 : !el.value;
    if (empty) {
      missing.push(el.name || el.id);
      el.setAttribute('aria-invalid', 'true');
    }
  });
  if (missing.length) {
    var msg = document.createElement('div');
    msg.className = 'error';
    msg.textContent = 'Please complete all required fields.';
    form.prepend(msg);
    return;
  }
  var data = {};
  new FormData(form).forEach(function (value, key) { data[key] = value instanceof File ? value.name : value; });
  window.__submitted = data;
  document.body.innerHTML = '<h1>Thank you for applying!</h1><p>Your application has been submitted.</p>';
});
