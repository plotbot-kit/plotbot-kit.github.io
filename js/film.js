// Progressive enhancement: hide the film section when the video file cannot be loaded.
// Uses the error event of the <source> element, so it works over http(s) and file:// alike.
(function () {
  var video = document.querySelector('.film video');
  if (!video) return;
  var sources = video.querySelectorAll('source');
  var last = sources[sources.length - 1];
  if (!last) return;
  last.addEventListener('error', function () { document.documentElement.classList.add('no-film'); });
  video.preload = 'metadata';   // without JS the page keeps preload="none"
  video.load();
})();
