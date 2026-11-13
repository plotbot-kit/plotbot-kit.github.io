// Two-click YouTube embed. Without JS the film section is a poster that links to the video on YouTube.
// With JS the poster becomes a play button; only a click on it inserts the player from youtube-nocookie.com.
// Until then the browser sends nothing to YouTube. The video ID comes from data-youtube-id in the HTML.
(function () {
  var link = document.querySelector('.film-poster[data-youtube-id]');
  if (!link) return;
  var id = link.getAttribute('data-youtube-id');
  if (!/^[\w-]{11}$/.test(id)) return;   // not a video ID: keep the plain link
  var frame = link.parentNode;
  var button = document.createElement('button');
  button.type = 'button';
  button.className = 'film-poster';
  if (link.hasAttribute('aria-describedby')) button.setAttribute('aria-describedby', link.getAttribute('aria-describedby'));
  button.appendChild(link.querySelector('img'));
  var cta = document.createElement('span');
  cta.className = 'film-cta';
  cta.textContent = link.getAttribute('data-play-label') || link.textContent.trim();
  button.appendChild(cta);
  frame.replaceChild(button, link);
  button.addEventListener('click', function () {
    var player = document.createElement('iframe');
    player.src = 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0';
    player.title = link.getAttribute('data-title') || '';
    player.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    player.referrerPolicy = 'strict-origin-when-cross-origin';   // YouTube refuses embeds that send no referrer
    frame.replaceChild(player, button);
    player.focus();
  });
})();
