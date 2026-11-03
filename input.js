/* Keyboard, mouse and Pointer Lock */
(function (D) {
  'use strict';
  const keys = {}, pressed = {};
  let canvas = null, mdx = 0, mdy = 0, lockT = 0;

  D.Input = {
    locked: false,
    enabled: false,        // game accepts look/move input
    init(c) {
      canvas = c;
      addEventListener('keydown', e => {
        if (e.repeat) { if (D.Input.enabled) e.preventDefault(); return; }
        keys[e.code] = true; pressed[e.code] = true;
        if (D.Input.enabled && ['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
        D.bus.emit('key', e.code);
      });
      addEventListener('keyup', e => { keys[e.code] = false; });
      addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
      addEventListener('mousemove', e => {
        // Chrome can report a huge fake delta right as pointer lock engages: ignore the first moments and clamp spikes
        if (D.Input.locked && D.Input.enabled && performance.now() - lockT > 250) { mdx += D.clamp(e.movementX || 0, -160, 160); mdy += D.clamp(e.movementY || 0, -160, 160); }
      });
      document.addEventListener('pointerlockchange', () => {
        D.Input.locked = document.pointerLockElement === canvas; lockT = performance.now(); mdx = mdy = 0;
        D.bus.emit('lockchange', D.Input.locked);
      });
      document.addEventListener('pointerlockerror', () => D.bus.emit('lockerror'));
    },
    down(code) { return !!keys[code]; },
    hit(code) { return !!pressed[code]; },
    endFrame() { for (const k in pressed) pressed[k] = false; },
    look() { const r = [mdx, mdy]; mdx = 0; mdy = 0; return r; },
    lock() { try { if (canvas && canvas.requestPointerLock) { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } } catch (e) {} },
    unlock() { try { if (document.exitPointerLock) document.exitPointerLock(); } catch (e) {} },
    clear() { for (const k in keys) keys[k] = false; for (const k in pressed) pressed[k] = false; mdx = mdy = 0; }
  };
})(window.DLBY);
