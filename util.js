/* DON'T LOOK BEHIND YOU - shared utilities and constants */
window.DLBY = window.DLBY || {};
(function (D) {
  'use strict';

  // World constants
  D.CELL = 2;        // metres per grid tile
  D.WALL_H = 3;      // ceiling height
  D.GAP = 12;        // vertical distance between floors
  D.GW = 40;         // grid width (tiles)
  D.GD = 19;         // grid depth (tiles)
  D.FLOOR_NAMES = ['BASEMENT', 'GROUND FLOOR', 'SECOND FLOOR'];

  // Math helpers
  D.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  D.lerp = (a, b, t) => a + (b - a) * t;
  D.damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
  D.rnd = (a, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
  D.pick = arr => arr[Math.floor(Math.random() * arr.length)];
  D.t2w = t => t * D.CELL + D.CELL / 2;           // tile index -> world centre
  D.w2t = w => Math.floor(w / D.CELL);            // world -> tile index
  D.angDiff = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };

  D.mulberry32 = function (seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  // Safe storage (private mode / file:// may throw)
  D.store = {
    get(k, def) { try { const v = localStorage.getItem('dlby.' + k); return v === null ? def : JSON.parse(v); } catch (e) { return def; } },
    set(k, v) { try { localStorage.setItem('dlby.' + k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    del(k) { try { localStorage.removeItem('dlby.' + k); } catch (e) {} }
  };

  // Settings
  D.defaults = { master: 0.8, music: 0.7, sfx: 0.9, sens: 1.0, fov: 75, quality: 'medium', bob: true, brightness: 1.0, grain: true };
  D.settings = Object.assign({}, D.defaults, D.store.get('settings', {}));
  D.saveSettings = () => D.store.set('settings', D.settings);

  // Tiny event bus
  const handlers = {};
  D.bus = {
    on(n, f) { (handlers[n] = handlers[n] || []).push(f); },
    emit(n, a, b) { (handlers[n] || []).forEach(f => { try { f(a, b); } catch (e) { console.error(e); } }); }
  };

  D.$ = id => document.getElementById(id);
})(window.DLBY);
