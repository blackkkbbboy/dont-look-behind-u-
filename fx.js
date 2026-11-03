/* Screen effects: vignette, film grain, flashes, fades, distortion */
(function (D) {
  'use strict';
  let g, gctx, vig, flash, fade, dst, gt = 0, fadeTO = null;
  const Fx = D.Fx = {
    distT: 0, roll: 0, fovAdd: 0, pulse: 0,
    init() {
      g = D.$('fxg'); gctx = g.getContext('2d'); vig = D.$('fxv'); flash = D.$('fxf'); fade = D.$('fxfade'); dst = D.$('gl');
    },
    // fade overlay: to=1 black, 0 clear; cb called when done
    fade(to, dur, cb, color) {
      clearTimeout(fadeTO); fade.style.background = color || '#000'; fade.style.transition = 'opacity ' + dur + 's linear'; fade.style.opacity = to;
      if (cb) fadeTO = setTimeout(cb, dur * 1000);
    },
    flashRed(a) { flash.style.transition = 'none'; flash.style.opacity = a || 0.7; flash.style.background = 'radial-gradient(circle,rgba(160,0,0,.3),rgba(120,0,0,.95))'; requestAnimationFrame(() => { flash.style.transition = 'opacity 0.9s ease-out'; flash.style.opacity = 0; }); },
    flashWhite(a) { flash.style.transition = 'none'; flash.style.opacity = a || 0.9; flash.style.background = '#fff'; requestAnimationFrame(() => { flash.style.transition = 'opacity 0.5s ease-out'; flash.style.opacity = 0; }); },
    distort(sec) { Fx.distT = Math.max(Fx.distT, sec); },
    update(dt, fear, hpFrac, dist) {
      gt += dt;
      if (D.settings.grain && gt > 0.07) { gt = 0; const w = g.width, h = g.height, id = gctx.createImageData(w, h), d = id.data; for (let i = 0; i < d.length; i += 4) { const v = Math.random() * 255 | 0; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 26; } gctx.putImageData(id, 0, 0); }
      g.style.display = D.settings.grain ? 'block' : 'none';
      Fx.pulse += dt * (1.5 + fear * 3);
      const lowHp = 1 - hpFrac, beat = Math.max(0, Math.sin(Fx.pulse * 2)) * (fear * 0.18 + lowHp * 0.12);
      vig.style.opacity = D.clamp(0.55 + fear * 0.25 + lowHp * 0.25 + beat + dist * 0.1, 0, 1);
      if (Fx.distT > 0) {
        Fx.distT -= dt; const k = Math.min(1, Fx.distT);
        dst.style.filter = 'hue-rotate(' + (Math.sin(performance.now() / 90) * 25 * k) + 'deg) saturate(' + (1 + 0.8 * k) + ') contrast(' + (1 + 0.2 * k) + ')';
        Fx.roll = Math.sin(performance.now() / 260) * 0.12 * k; Fx.fovAdd = Math.sin(performance.now() / 310) * 14 * k;
      } else {
        dst.style.filter = (lowHp > 0.55 ? 'saturate(' + (1 - (lowHp - 0.55)) + ')' : 'none'); Fx.roll = D.damp(Fx.roll, 0, 6, dt); Fx.fovAdd = D.damp(Fx.fovAdd, 0, 6, dt);
      }
    }
  };
})(window.DLBY);
