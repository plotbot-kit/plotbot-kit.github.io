// Remembers a manual language choice: every link with data-lang stores it in localStorage.
(function () {
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[data-lang]');
    if (!a) return;
    try { localStorage.setItem('lang', a.getAttribute('data-lang')); } catch (err) { /* storage blocked: ignore */ }
  });
})();
