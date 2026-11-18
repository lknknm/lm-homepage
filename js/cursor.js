// Custom cursor: a small dot that inverts whatever is under it, plus a round
// "lens" around it that splits the background's colour channels (chromatic
// aberration) in the direction of movement, scaled by speed.
//
// Only for mouse/trackpad pointers; touch devices keep the CSS cursor from
// styles.css (which is also the fallback when this script doesn't run).
// Elements live on <html>, outside <body>, so they survive the page swaps done
// by js/transition.js. Tunables are CSS variables in styles.css.
(function () {
  if (!window.matchMedia('(pointer: fine)').matches) return;

  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function cssNumber(name) {
    return parseFloat(getComputedStyle(root).getPropertyValue(name)) || 0;
  }

  function init() {
    var dot = document.createElement('div');
    dot.className = 'cursor-dot';
    dot.setAttribute('aria-hidden', 'true');

    var lens = document.createElement('div');
    lens.className = 'cursor-lens';
    lens.setAttribute('aria-hidden', 'true');
    lens.innerHTML =
      '<svg width="0" height="0" style="position:absolute">' +
        '<filter id="cursor-ca" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">' +
          // radial vector field (red = x, green = y): displacing by it scales
          // the image around the lens centre, i.e. around the cursor
          '<feImage preserveAspectRatio="none" x="0" y="0" result="map"/>' +
          // red: pushed outward (at rest) + trailing the motion
          '<feDisplacementMap in="SourceGraphic" in2="map" scale="0" xChannelSelector="R" yChannelSelector="G" result="rd"/>' +
          '<feColorMatrix in="rd" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r"/>' +
          '<feOffset in="r" dx="0" dy="0" result="rs"/>' +
          // green: untouched
          '<feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="g"/>' +
          // blue: pulled inward (at rest) + leading the motion
          '<feDisplacementMap in="SourceGraphic" in2="map" scale="0" xChannelSelector="R" yChannelSelector="G" result="bd"/>' +
          '<feColorMatrix in="bd" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="b"/>' +
          '<feOffset in="b" dx="0" dy="0" result="bs"/>' +
          '<feBlend in="rs" in2="g" mode="screen" result="rg"/>' +
          '<feBlend in="rg" in2="bs" mode="screen"/>' +
        '</filter>' +
      '</svg>';

    // lens first so the dot paints (and inverts) on top of it
    root.appendChild(lens);
    root.appendChild(dot);
    root.classList.add('custom-cursor');

    var offsets = lens.querySelectorAll('feOffset');
    var radial = lens.querySelectorAll('feDisplacementMap');
    var mapImage = lens.querySelector('feImage');
    var x = -100, y = -100, lastX = null, lastY = null;
    var vx = 0, vy = 0;          // smoothed velocity, px per frame
    var applied = { sx: 0, sy: 0 };
    var visible = false, moving = false, running = false;

    // Radial displacement map: red rises left→right, green top→bottom.
    var map = document.createElement('canvas');
    map.width = map.height = 64;
    var ctx = map.getContext('2d');
    var px = ctx.createImageData(64, 64);
    for (var j = 0; j < 64; j++) {
      for (var i = 0; i < 64; i++) {
        var o = (j * 64 + i) * 4;
        px.data[o] = Math.round(i / 63 * 255);
        px.data[o + 1] = Math.round(j / 63 * 255);
        px.data[o + 2] = 0;
        px.data[o + 3] = 255;
      }
    }
    ctx.putImageData(px, 0, 0);
    mapImage.setAttribute('href', map.toDataURL());

    // Read the tunables once (and again on resize), not every frame:
    // getComputedStyle in a per-frame loop forces a style recalc each time.
    var cfg = {};
    function readConfig() {
      cfg.max = reduceMotion.matches ? 0 : cssNumber('--cursor-ca-max');
      cfg.gain = cssNumber('--cursor-ca-gain');
      cfg.rest = cssNumber('--cursor-ca-rest');
      cfg.size = cssNumber('--cursor-lens-radius') * 2;
      applyRest();
    }

    // The always-on radial split. The map's values run 0..1 across the lens, so
    // a displacement scale of S shifts a channel by up to S/2 at the lens edge.
    function applyRest() {
      mapImage.setAttribute('width', cfg.size);
      mapImage.setAttribute('height', cfg.size);
      radial[0].setAttribute('scale', -2 * cfg.rest);  // red outward
      radial[1].setAttribute('scale', 2 * cfg.rest);   // blue inward
    }
    readConfig();
    window.addEventListener('resize', readConfig);
    reduceMotion.addEventListener('change', readConfig);

    function place() {
      var t = 'translate3d(' + x + 'px,' + y + 'px,0)';
      dot.style.transform = t;
      lens.style.transform = t;
    }

    function setClass(name, on, current) {
      if (on !== current) root.classList.toggle(name, on);
      return on;
    }

    // Move the dot as soon as the pointer moves (no waiting for the next frame),
    // and only run the effect loop while there's motion to settle.
    document.addEventListener('pointermove', function (e) {
      if (e.pointerType && e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
      x = e.clientX;
      y = e.clientY;
      if (lastX === null) { lastX = x; lastY = y; }
      place();
      visible = setClass('cursor-visible', true, visible);
      if (!running) { running = true; requestAnimationFrame(frame); }
    }, { passive: true });

    function hide() { visible = setClass('cursor-visible', false, visible); }
    document.addEventListener('pointerleave', hide);
    document.documentElement.addEventListener('mouseleave', hide);
    window.addEventListener('blur', hide);

    function frame() {
      // ease the velocity so the effect swells and settles smoothly
      vx += (x - lastX - vx) * 0.5;
      vy += (y - lastY - vy) * 0.5;
      lastX = x;
      lastY = y;

      var sx = Math.max(-cfg.max, Math.min(cfg.max, vx * cfg.gain));
      var sy = Math.max(-cfg.max, Math.min(cfg.max, vy * cfg.gain));
      // quantise to 1/4 px: invisible steps, but far fewer filter re-renders
      sx = Math.round(sx * 4) / 4;
      sy = Math.round(sy * 4) / 4;
      var split = Math.hypot(sx, sy);

      if (sx !== applied.sx || sy !== applied.sy) {
        offsets[0].setAttribute('dx', -sx);        // red trails behind the motion
        offsets[0].setAttribute('dy', -sy);
        offsets[1].setAttribute('dx', sx * 0.6);   // blue leads a little
        offsets[1].setAttribute('dy', sy * 0.6);
        applied.sx = sx;
        applied.sy = sy;
      }
      moving = setClass('cursor-moving', split > 0, moving);

      // keep going until the motion has fully settled, then stop the loop
      if (split > 0 || Math.abs(vx) > 0.01 || Math.abs(vy) > 0.01) requestAnimationFrame(frame);
      else running = false;
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
