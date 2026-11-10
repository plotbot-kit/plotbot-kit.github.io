// Turntable for the hero robot: drag (Pointer Events) or arrow keys swap between 36 pre-rendered WebP frames.
// Progressive enhancement: frames load only once the figure is visible (or on first touch of the image).
// If any frame fails to load, nothing changes: no hint, no slider role, the static <picture> stays.
// Texts come from data attributes in the HTML: data-frames, data-label, data-valuetext ("{deg}" = angle).
(function () {
  var fig = document.querySelector('.stage[data-frames]');
  if (!fig) return;
  var pic = fig.querySelector('picture'), img = fig.querySelector('img'), hint = fig.querySelector('.spin-hint');
  var N = 36, base = fig.getAttribute('data-frames'), frames = [], current = -1, loading = false;

  function url(i) { return base + (i < 10 ? '0' : '') + i + '.webp'; }

  function load() {
    if (loading) return;
    loading = true;
    var left = N, failed = false;
    function fetch(i, done) {
      var im = new Image();
      im.onload = function () { done(); if (--left === 0 && !failed) ready(); };
      im.onerror = function () { failed = true; };
      im.src = url(i);
      frames[i] = im;
    }
    fetch(0, function () {   // probe frame 0 first: a missing folder costs one request, not 36
      for (var i = 1; i < N; i++) fetch(i, function () {});
    });
  }

  function show(i) {
    i = ((i % N) + N) % N;
    if (current < 0) {   // first swap: drop the <source>, otherwise it keeps winning over img.src
      Array.prototype.forEach.call(pic.querySelectorAll('source'), function (s) { s.remove(); });
    }
    if (i !== current) img.src = frames[i].src;
    current = i;
    pic.setAttribute('aria-valuenow', i * 10);
    pic.setAttribute('aria-valuetext', (fig.getAttribute('data-valuetext') || '{deg}°').replace('{deg}', i * 10));
  }

  function ready() {
    fig.classList.add('turntable');
    pic.tabIndex = 0;
    pic.setAttribute('role', 'slider');
    pic.setAttribute('aria-label', fig.getAttribute('data-label') || img.alt);
    pic.setAttribute('aria-valuemin', '0');
    pic.setAttribute('aria-valuemax', '350');
    pic.setAttribute('aria-valuenow', '0');
    pic.setAttribute('aria-valuetext', (fig.getAttribute('data-valuetext') || '{deg}°').replace('{deg}', 0));
    img.draggable = false;
    if (hint) hint.hidden = false;

    var startX = null, startFrame = 0;
    pic.addEventListener('pointerdown', function (e) {
      startX = e.clientX; startFrame = Math.max(current, 0);
      pic.setPointerCapture(e.pointerId);
    });
    pic.addEventListener('pointermove', function (e) {
      if (startX === null) return;
      var step = Math.max(5, pic.offsetWidth / 24);   // px per 10°: a full turn is about 1.5 image widths
      var d = Math.round((e.clientX - startX) / step);
      if (d !== 0 || current >= 0) show(startFrame + d);
    });
    function end() { startX = null; }
    pic.addEventListener('pointerup', end);
    pic.addEventListener('pointercancel', end);
    pic.addEventListener('keydown', function (e) {
      var k = e.key, base = Math.max(current, 0);
      if (k === 'ArrowRight' || k === 'ArrowUp') show(base + 1);
      else if (k === 'ArrowLeft' || k === 'ArrowDown') show(base - 1);
      else if (k === 'Home') show(0);
      else return;
      e.preventDefault();
    });
  }

  pic.addEventListener('pointerdown', load, { once: true });
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      if (entries.some(function (en) { return en.isIntersecting; })) { io.disconnect(); load(); }
    }, { rootMargin: '200px' });
    io.observe(fig);
  }
})();
