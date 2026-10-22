/*
 * FIG Studio events: the one list behind the nav's Events menu and the
 * homepage event tiles.
 *
 * Add an event here and both places show it. Upcoming or past is worked out
 * from `ends`, so an event moves from "Upcoming" to "Past" on its own the day
 * after it ends; nothing needs editing when that happens.
 *
 * `img` is the event's own poster, the image it was promoted with. Posters are
 * square, and the tiles and the menu's thumbnails are cut square to match.
 *
 * `href` starting with http is the event platform (events.figstudio.vc); a
 * path starting with / is a page on this site. Both open in the same tab, and
 * the platform links back to this site the same way, so the two read as one
 * site rather than as a visit to another one.
 */
(function () {
  var PLATFORM = 'https://events.figstudio.vc';

  var EVENTS = [
    {
      title: 'Fig AI Design Student Makeathon 2026',
      when: 'November 7–9, 2026',
      short: 'Nov 7–9',
      where: 'Online',
      ends: '2026-11-09',
      blurb: 'Three days for design students to turn AI problems into working prototypes.',
      href: PLATFORM + '/e/fig-ai-design-makeathon-2026',
      img: '/events/ai-design-makeathon/img/poster.jpg',
      imgAlt: 'Poster for the AI Design Student Makeathon, November 7 to 9, online'
    },
    {
      title: 'Frontier in Action: Physical Intelligence',
      when: 'October 10, 2026',
      short: 'Oct 10',
      where: 'San Francisco',
      ends: '2026-10-10',
      blurb: 'Physical AI demos and an investor and research panel at SF Tech Week.',
      href: '/events/physical-ai-2026',
      img: '/events/physical-ai-2026/img/poster.jpg',
      imgAlt: 'Poster for Frontier in Action: Physical AI, SF Tech Week demo day, October 10'
    },
    {
      title: 'The Executable World',
      when: 'September 19, 2026',
      short: 'Sep 19',
      where: 'Full Stack AI Hackathon',
      ends: '2026-09-19',
      blurb: 'A day of building, technical exchange and live demos.',
      href: '/events/executable-world-2026',
      img: '/events/executable-world-2026/img/poster.jpg',
      imgAlt: 'Poster for The Executable World: Full Stack AI Hackathon & Mixer, September 19'
    }
  ];

  // Past once the day it ends is over, wherever the reader is.
  function isPast(e) {
    return new Date(e.ends + 'T23:59:59') < new Date();
  }
  function isExternal(e) { return /^https?:/.test(e.href); }

  var upcoming = EVENTS.filter(function (e) { return !isPast(e); })
    .sort(function (a, b) { return a.ends < b.ends ? -1 : 1; });
  var past = EVENTS.filter(isPast)
    .sort(function (a, b) { return a.ends < b.ends ? 1 : -1; });

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }
  function linkTo(e, cls) {
    var a = el('a', cls);
    a.href = e.href;
    if (!isExternal(e) && location.pathname.replace(/\/$/, '') === e.href) {
      a.setAttribute('aria-current', 'page');
    }
    return a;
  }

  /* ---------- Nav menu ---------- */
  var dd = document.getElementById('nav-events');
  if (dd) {
    var btn = dd.querySelector('.nav-dd-btn');
    var menu = dd.querySelector('.nav-dd-menu');

    /*
     * The list, and a large poster that appears beside it -- in the empty
     * page to its left -- while the pointer or keyboard focus is on an event,
     * and goes again when it leaves. Nothing is shown until then. Phones have
     * no hover and never show it; see events.css.
     */
    var list = el('div', 'nav-dd-list');
    var preview = el('div', 'nav-dd-preview');
    var big = el('img');
    big.alt = '';
    big.decoding = 'async';
    preview.appendChild(big);
    menu.appendChild(list);
    menu.appendChild(preview);

    var shown = null;
    function hide() {
      shown = null;
      menu.classList.remove('has-preview');
      list.querySelectorAll('.nav-dd-item').forEach(function (n) {
        n.classList.remove('is-shown');
      });
    }
    function show(e, item) {
      menu.classList.add('has-preview');
      if (shown === e) return;
      shown = e;
      // Out at once, then back in over two frames, so the swap is a fade
      // rather than a cut even when the poster is already cached.
      big.classList.add('is-out');
      big.src = e.img;
      big.alt = e.imgAlt;
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { big.classList.remove('is-out'); });
      });
      list.querySelectorAll('.nav-dd-item').forEach(function (n) {
        n.classList.toggle('is-shown', n === item);
      });
    }

    function group(label, events) {
      if (!events.length) return;
      list.appendChild(el('div', 'nav-dd-label', label));
      events.forEach(function (e) {
        var a = linkTo(e, 'nav-dd-item');
        var thumb = el('img', 'nav-dd-thumb');
        thumb.src = e.img;
        thumb.alt = '';
        thumb.loading = 'lazy';
        thumb.decoding = 'async';
        a.appendChild(thumb);
        var text = el('span', 'nav-dd-text');
        text.appendChild(el('span', 'nav-dd-title', e.title));
        text.appendChild(el('span', 'nav-dd-meta', e.short + ' · ' + e.where));
        a.appendChild(text);
        a.addEventListener('mouseenter', function () { show(e, a); });
        a.addEventListener('focus', function () { show(e, a); });
        a.addEventListener('mouseleave', hide);
        a.addEventListener('blur', hide);
        list.appendChild(a);
      });
    }
    group('Upcoming', upcoming);
    group('Past events', past);
    var all = el('a', 'nav-dd-all', 'All events on the FIG platform →');
    all.href = PLATFORM;
    list.appendChild(all);

    function setOpen(open) {
      if (!open) hide();
      dd.classList.toggle('dd-open', open);
      btn.setAttribute('aria-expanded', String(open));
    }
    // The trigger is a link to the homepage tiles, so it still works without
    // this script. With it, a press opens the menu instead.
    btn.addEventListener('click', function (ev) {
      ev.preventDefault();
      setOpen(!dd.classList.contains('dd-open'));
    });
    var hover = matchMedia('(hover:hover) and (min-width:601px)');
    var closeTimer;
    dd.addEventListener('mouseenter', function () {
      if (!hover.matches) return;
      clearTimeout(closeTimer);
      setOpen(true);
    });
    dd.addEventListener('mouseleave', function () {
      if (!hover.matches) return;
      closeTimer = setTimeout(function () { setOpen(false); }, 160);
    });
    addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && dd.classList.contains('dd-open')) {
        setOpen(false);
        btn.focus();
      }
    });
    addEventListener('click', function (ev) {
      if (!dd.contains(ev.target)) setOpen(false);
    });
  }

  /* ---------- Homepage tiles ---------- */
  var tiles = document.querySelector('[data-event-tiles]');
  if (tiles) {
    upcoming.concat(past).forEach(function (e) {
      var up = !isPast(e);
      var a = linkTo(e, 'ev-tile');
      var pic = el('div', 'ev-tile-img');
      var img = el('img');
      img.src = e.img;
      img.alt = e.imgAlt;
      img.loading = 'lazy';
      img.decoding = 'async';
      pic.appendChild(img);
      a.appendChild(pic);

      var body = el('div', 'ev-tile-body');
      body.appendChild(el('span', 'ev-tile-chip' + (up ? ' is-up' : ''), up ? 'Upcoming' : 'Recap'));
      body.appendChild(el('div', 'ev-tile-meta', e.when + ' · ' + e.where));
      body.appendChild(el('h4', 'ev-tile-title', e.title));
      body.appendChild(el('p', 'ev-tile-blurb', e.blurb));
      var go = el('span', 'ev-tile-link', up && isExternal(e) ? 'Join on the platform' : 'Read the recap');
      if (!up && isExternal(e)) go.textContent = 'See the event';
      var arrow = el('span', 'arrow');
      arrow.setAttribute('aria-hidden', 'true');
      go.appendChild(arrow);
      body.appendChild(go);
      a.appendChild(body);
      tiles.appendChild(a);
    });
  }
})();
