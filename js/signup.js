// Progressive enhancement for the mailing-list form: send it in the background and show the
// answer on the page. Without JavaScript the form posts directly to Brevo.
document.querySelectorAll('form.signup').forEach(function (form) {
  if (form.action.indexOf('sibforms.com') < 0) return;   // placeholder not replaced yet
  var status = form.querySelector('.signup-status');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var button = form.querySelector('button[type=submit]');
    button.disabled = true;
    fetch(form.action, { method: 'POST', body: new URLSearchParams(new FormData(form)) })
      .then(function (r) { return r.json(); })
      .then(function (d) { show(d && d.success ? status.dataset.ok : status.dataset.fehler, !(d && d.success)); })
      .catch(function () { show(status.dataset.fehler, true); });
    function show(text, retry) {
      status.textContent = text;
      status.hidden = false;
      if (retry) button.disabled = false; else form.querySelector('input[type=email]').disabled = true;
    }
  });
});
