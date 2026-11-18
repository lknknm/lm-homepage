// Page-to-page transition: the next page is revealed top-to-bottom over the current one.
//
// Firefox doesn't support cross-document View Transitions, so instead of a normal
// navigation we fetch the next page, swap its <body>, title and stylesheets into this
// document inside document.startViewTransition(), and pushState the new URL.
// The old page stays frozen as a snapshot while the new, live page is uncovered over it
// (see the ::view-transition rules in animations.css).
//
// Anything unsupported or failing falls back to an ordinary navigation.
(function () {
  if (!document.startViewTransition || !window.fetch || !window.DOMParser) return;

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var busy = false;
  var currentPath = location.pathname + location.search;

  function isInternalPageLink(a, event) {
    if (!a || !a.href) return false;
    if (event.defaultPrevented || event.button !== 0) return false;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
    if (a.target && a.target !== '_self') return false;
    if (a.hasAttribute('download')) return false;
    var url = new URL(a.href, location.href);
    if (url.origin !== location.origin || url.protocol === 'file:') return false;
    if (!/(\.html?|\/)$/.test(url.pathname)) return false; // pages only, not assets
    // Same-page anchor links scroll normally.
    if (url.pathname + url.search === currentPath && url.hash) return false;
    return true;
  }

  function stylesheetLinks(doc) {
    return Array.prototype.slice.call(doc.querySelectorAll('head link[rel="stylesheet"]'));
  }

  function whenLoaded(link) {
    return new Promise(function (resolve) {
      link.addEventListener('load', resolve, { once: true });
      link.addEventListener('error', resolve, { once: true });
      setTimeout(resolve, 3000);
    });
  }

  // Warm the cache so the swap inside the transition doesn't wait on the network.
  function preloadStyles(doc) {
    return Promise.all(stylesheetLinks(doc).map(function (l) {
      return fetch(l.href).catch(function () {});
    }));
  }

  function swapIn(doc, url) {
    // Replace stylesheets in the new page's order (cascade order matters).
    var oldLinks = stylesheetLinks(document);
    var anchor = oldLinks[0] || null;
    var loads = stylesheetLinks(doc).map(function (l) {
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = l.href;
      document.head.insertBefore(link, anchor);
      return whenLoaded(link);
    });

    return Promise.all(loads).then(function () {
      oldLinks.forEach(function (l) { l.remove(); });
      document.title = doc.title;
      document.documentElement.replaceChild(document.adoptNode(doc.body), document.body);
      window.scrollTo(0, 0);
      currentPath = url.pathname + url.search;
    });
  }

  function cssNumber(name) {
    return parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || 0;
  }

  // The "lens" under the line: one SVG filter applied to the old page's
  // snapshot (::view-transition-old(root), see animations.css). Inside a band
  // just below the reveal line it slightly warps the page, splits its red and
  // blue channels apart, and blurs it; outside the band the page is untouched.
  // (A plain `filter` is used rather than backdrop-filter, which Firefox can't
  // apply to view-transition layers.)
  // Firefox can't render an SVG filter on a view-transition layer (the old
  // page just disappears), so it gets the reveal, line and fringes without the lens.
  var lensSupported = !/Firefox\//.test(navigator.userAgent);

  function makeFx() {
    var el = document.createElement('div');
    el.className = 'vt-fx';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML =
      '<svg width="0" height="0" style="position:absolute">' +
        '<filter id="vt-old" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" color-interpolation-filters="sRGB">' +
          // band mask: a soft-edged strip hanging below the line
          '<feFlood flood-color="#fff" result="bandRect"/>' +
          '<feGaussianBlur in="bandRect" stdDeviation="0 1" result="band"/>' +
          // slight refraction warp
          '<feTurbulence type="fractalNoise" baseFrequency="0.004 0.06" numOctaves="1" seed="3" result="noise"/>' +
          '<feDisplacementMap in="SourceGraphic" in2="noise" scale="0" xChannelSelector="R" yChannelSelector="G" result="warp"/>' +
          // channel split: red trails down, blue pulls up, green stays
          '<feColorMatrix in="warp" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r"/>' +
          '<feOffset in="r" dx="0" dy="0" result="rs"/>' +
          '<feColorMatrix in="warp" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="g"/>' +
          '<feColorMatrix in="warp" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="b"/>' +
          '<feOffset in="b" dx="0" dy="0" result="bs"/>' +
          '<feBlend in="rs" in2="g" mode="screen" result="rg"/>' +
          '<feBlend in="rg" in2="bs" mode="screen" result="split"/>' +
          // blur, mostly along the direction of motion
          '<feGaussianBlur in="split" stdDeviation="0" result="smear"/>' +
          // keep the effect only inside the band, over the untouched page
          '<feComposite in="smear" in2="band" operator="in" result="fx"/>' +
          '<feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="fx"/></feMerge>' +
        '</filter>' +
      '</svg>';
    return el;
  }

  // The reveal line's current y position, read from the edge layer's transform
  // (the edge box sits above the line, so add its height back).
  function lineY() {
    var t = getComputedStyle(document.documentElement, '::view-transition-group(vt-edge)').transform;
    var m = /matrix(3d)?\((.+)\)/.exec(t || '');
    if (!m) return null;
    var v = m[2].split(',').map(parseFloat);
    return (m[1] ? v[13] : v[5]) + cssNumber('--edge-box');
  }

  // SVG filter values can't be animated from CSS keyframes, so follow the edge
  // layer's own CSS animation every frame (this also stays in sync when the
  // transition is slowed down or stepped through in DevTools).
  function driveFx(el) {
    var anim = document.getAnimations().filter(function (a) {
      return a.effect && a.effect.pseudoElement === '::view-transition-group(vt-edge)';
    })[0];
    if (!anim) return;
    var q = function (sel) { return el.querySelector(sel); };
    var filter = q('filter');
    var bandRect = q('feFlood');
    var blurs = el.querySelectorAll('feGaussianBlur');
    var bandSoft = blurs[0], smear = blurs[1];
    var warp = q('feDisplacementMap');
    var offsets = el.querySelectorAll('feOffset');
    var maxSplit = cssNumber('--ca-split') ? cssNumber('--ca-split-px') : 0;
    var maxWarp = cssNumber('--ca-warp');
    var maxBlur = cssNumber('--band-blur');
    var bandH = cssNumber('--band-height');
    var set = function (node, attrs) { for (var k in attrs) node.setAttribute(k, attrs[k]); };

    (function frame() {
      if (!el.isConnected) return;
      var W = document.documentElement.clientWidth, H = window.innerHeight;
      set(filter, { x: -50, y: -50, width: W + 100, height: H + 100 });

      var duration = anim.effect.getComputedTiming().duration || 1;
      var p = Math.min(Math.max((anim.currentTime || 0) / duration, 0), 1);
      // follow the line's speed: peaks early (12%), then decays as it settles,
      var PEAK = 0.12;
      var amount = (p / PEAK) * Math.exp(1 - p / PEAK);
      var y = lineY();
      if (y === null) y = p * H;

      // band: strongest just under the line, fading out over --band-height
      set(bandRect, { x: -50, y: y - bandH * 0.3, width: W + 100, height: bandH * 0.75 });
      set(bandSoft, { x: -50, y: -50, width: W + 100, height: H + 100, stdDeviation: '0 ' + bandH * 0.2 });

      var d = maxSplit * amount;
      set(offsets[0], { dx: d * 0.35, dy: d });         // red trails below
      set(offsets[1], { dx: -d * 0.2, dy: -d * 0.6 });  // blue pulls up
      set(warp, { scale: maxWarp * amount });
      var b = Math.max(maxBlur * amount, 0.01);
      set(smear, { stdDeviation: b * 0.35 + ' ' + b });

      if (anim.playState !== 'finished') requestAnimationFrame(frame);
    })();
  }

  function go(href, push) {
    var url = new URL(href, location.href);
    busy = true;

    fetch(url.href, { credentials: 'same-origin' })
      .then(function (res) {
        if (!res.ok || !/text\/html/.test(res.headers.get('content-type') || '')) throw new Error('not a page');
        return res.text();
      })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        return preloadStyles(doc).then(function () { return doc; });
      })
      .then(function (doc) {
        if (push) history.pushState({}, '', url.href);
        if (reduceMotion.matches) return swapIn(doc, url);
        // The reveal edge is captured as its own layer (view-transition-name in
        // animations.css); the lens filter is applied to the old page snapshot
        // while the html.vt-fx class is set. Both are removed afterwards.
        var root = document.documentElement;
        var edge = document.createElement('div');
        edge.className = 'vt-edge';
        edge.setAttribute('aria-hidden', 'true');
        var fx = lensSupported ? makeFx() : null;
        var update = function () {
          return swapIn(doc, url).then(function () {
            if (fx) document.body.appendChild(fx);
            document.body.appendChild(edge);
            if (fx) root.classList.add('vt-fx');
          });
        };
        root.classList.add('vt-running'); // lets the custom cursor step aside (styles.css)
        var vt = document.startViewTransition(update);
        vt.ready.then(function () { if (fx) driveFx(fx); }, function () {});
        return vt.finished.finally(function () {
          root.classList.remove('vt-fx', 'vt-running');
          edge.remove();
          if (fx) fx.remove();
        });
      })
      .catch(function () { location.href = url.href; })
      .then(function () { busy = false; });
  }

  document.addEventListener('click', function (event) {
    var a = event.target.closest && event.target.closest('a');
    if (!isInternalPageLink(a, event)) return;
    event.preventDefault();
    if (!busy) go(a.href, true);
  });

  // Back/forward: load whatever page the history entry points to.
  window.addEventListener('popstate', function () {
    if (location.pathname + location.search === currentPath) return; // hash-only change
    go(location.href, false);
  });
})();
