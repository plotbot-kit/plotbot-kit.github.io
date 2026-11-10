// Progressive enhancement: hide the film section while the video file is not there yet.
(function () {
  var src = document.querySelector('.film source');
  if (!src || !window.fetch) return;
  var hide = function () { document.documentElement.classList.add('no-film'); };
  fetch(src.src, { method: 'HEAD' }).then(function (r) { if (!r.ok) hide(); }).catch(hide);
})();
