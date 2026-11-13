// Turntable for the hero robot: drag (Pointer Events) or arrow keys swap between 36 pre-rendered WebP frames.
// The robot turns slowly by itself (one turn in about 20 s) until the visitor first touches it: pointer down, touch,
// key or focus on the image. Then it stops for good. It pauses while the stage is off-screen.
// With prefers-reduced-motion it never turns by itself, and frames load only on intent (pointer over, focus).
// Without JS the static <picture> stays.
// If any frame fails to load, the hint disappears and the static <picture> stays.
// Texts come from data attributes in the HTML: data-frames, data-label, data-valuetext ("{deg}" = angle).
(function () {
  var fig = document.querySelector('.stage[data-frames]');
  if (!fig) return;
  var pic = fig.querySelector('picture'), img = fig.querySelector('img'), hint = fig.querySelector('.spin-hint');
  var N = 36, base = fig.getAttribute('data-frames'), frames = [], current = -1, loading = false, isReady = false;
  var label = fig.getAttribute('data-label') || img.alt;

  function url(i) { return base + (i < 10 ? '0' : '') + i + '.webp'; }
  // Frames are numbered the other way round from the drag direction ("grab the object": drag right, front moves right),
  // so frame i shows the robot turned by (N - i) * 10°. Dragging right and ArrowRight both go to lower frame numbers.
  function angle(i) { return ((N - i) % N) * 10; }
  function valuetext(deg) { return (fig.getAttribute('data-valuetext') || '{deg}°').replace('{deg}', deg); }

  function fail() {
    if (hint) hint.hidden = true;
    pic.removeAttribute('tabindex'); pic.removeAttribute('aria-label'); pic.removeAttribute('aria-describedby');
  }

  function load() {
    if (loading) return;
    loading = true;
    var left = N, failed = false;
    function get(i, done) {
      var im = new Image();
      im.onload = function () { done(); if (--left === 0 && !failed) ready(); };
      im.onerror = function () { if (!failed) { failed = true; fail(); } };
      im.src = url(i);
      frames[i] = im;
    }
    get(0, function () {   // probe frame 0 first: a missing folder costs one request, not 36
      for (var i = 1; i < N; i++) get(i, function () {});
    });
  }

  function show(i) {
    if (!isReady) return;
    i = ((i % N) + N) % N;
    if (current < 0) {   // first swap: drop the <source>, otherwise it keeps winning over img.src
      Array.prototype.forEach.call(pic.querySelectorAll('source'), function (s) { s.remove(); });
    }
    if (i !== current) img.src = frames[i].src;
    current = i;
    var deg = angle(i);
    pic.setAttribute('aria-valuenow', deg);
    pic.setAttribute('aria-valuetext', valuetext(deg));
  }

  function ready() {
    isReady = true;
    fig.classList.add('turntable');
    pic.setAttribute('role', 'slider');
    pic.setAttribute('aria-valuemin', '0');
    pic.setAttribute('aria-valuemax', '350');
    pic.setAttribute('aria-valuenow', '0');
    pic.setAttribute('aria-valuetext', valuetext(0));
    spin();
  }

  // Auto-rotation: a timer steps one frame at a time; stop() ends it for good.
  var TURN_MS = 20000, timer = null, stopped = false, visible = false;
  var calm = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  function pause() { if (timer !== null) { clearTimeout(timer); timer = null; } }
  function stop() { stopped = true; pause(); }
  function spin() {
    if (stopped || !visible || !isReady || timer !== null) return;
    timer = setTimeout(function () {
      timer = null;
      if (calm.matches) { stop(); return; }
      if (!document.hidden) show(Math.max(current, 0) - 1);
      spin();
    }, TURN_MS / N);
  }

  // Set up right away (cheap): focusable, labelled, hint visible. Frames follow on intent.
  pic.tabIndex = 0;
  pic.setAttribute('aria-label', label);
  if (hint) { hint.hidden = false; if (hint.id) pic.setAttribute('aria-describedby', hint.id); }
  img.draggable = false;
  fig.classList.add('turntable-pending');

  var startX = null, startFrame = 0;
  pic.addEventListener('pointerdown', function (e) {
    stop(); load();
    startX = e.clientX; startFrame = Math.max(current, 0);
    pic.setPointerCapture(e.pointerId);
  });
  pic.addEventListener('pointermove', function (e) {
    if (startX === null) return;
    var step = Math.max(5, pic.offsetWidth / 24);   // px per 10°: a full turn is about 1.5 image widths
    var d = -Math.round((e.clientX - startX) / step);
    if (d !== 0 || current >= 0) show(startFrame + d);
  });
  function end() { startX = null; }
  pic.addEventListener('pointerup', end);
  pic.addEventListener('pointercancel', end);
  pic.addEventListener('pointerenter', load);
  pic.addEventListener('focus', function () { stop(); load(); });
  pic.addEventListener('touchstart', stop, { passive: true });
  pic.addEventListener('keydown', function (e) {
    stop();
    var k = e.key, at = Math.max(current, 0);
    if (k === 'ArrowRight' || k === 'ArrowUp') show(at - 1);
    else if (k === 'ArrowLeft' || k === 'ArrowDown') show(at + 1);
    else if (k === 'PageUp') show(at - 9);
    else if (k === 'PageDown') show(at + 9);
    else if (k === 'Home') show(0);
    else if (k === 'End') show(1);
    else return;
    e.preventDefault();
  });

  if (!calm.matches) {
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[entries.length - 1].isIntersecting;
        if (visible && !stopped) { load(); spin(); } else pause();
      }).observe(fig);
    } else { visible = true; load(); }
  }
})();
