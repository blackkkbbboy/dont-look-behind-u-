/* First-person player: movement with acceleration, stamina, crouch, flashlight battery, health, footsteps */
(function (D) {
  'use strict';
  const I = D.Input;
  const pos = { x: 0, z: 0 };

  const Pl = D.Player = {
    x: 0, z: 0, floor: 2, yaw: 0, pitch: 0, vx: 0, vz: 0, hp: 100, stamina: 100, battery: 100,
    flash: false, hasFlash: false, crouch: false, sprint: false, exhausted: false, eye: 1.65, bob: 0, stepD: 0, moving: false, speed: 0,
    noise: 1, inv: 0, regenDelay: 0, shake: 0, lean: 0, dead: false, frozenInput: false,
    reset(o) {
      o = o || {};
      Pl.x = o.x || 0; Pl.z = o.z || 0; Pl.floor = o.floor === undefined ? 2 : o.floor; Pl.yaw = o.yaw || 0; Pl.pitch = 0; Pl.vx = Pl.vz = 0;
      Pl.hp = o.hp === undefined ? 100 : o.hp; Pl.stamina = o.stamina === undefined ? 100 : o.stamina; Pl.battery = o.battery === undefined ? 100 : o.battery;
      Pl.hasFlash = !!o.hasFlash; Pl.flash = false; Pl.crouch = false; Pl.exhausted = false; Pl.eye = 1.65; Pl.inv = 0; Pl.dead = false; Pl.shake = 0; Pl.lean = 0;
    },
    forward() { return { x: -Math.sin(Pl.yaw), z: -Math.cos(Pl.yaw) }; },
    toggleFlash(force) {
      if (!Pl.hasFlash) return;
      const want = force === undefined ? !Pl.flash : force;
      if (want && Pl.battery <= 0) { D.bus.emit('toast', 'The battery is dead. Press R to use a spare.'); return; }
      Pl.flash = want; D.Audio.flash(Pl.flash);
    },
    damage(n) {
      if (Pl.inv > 0 || Pl.dead) return false;
      Pl.hp = Math.max(0, Pl.hp - n); Pl.inv = 1.6; Pl.shake = 1; D.bus.emit('hurt', n);
      if (Pl.hp <= 0) { Pl.dead = true; D.bus.emit('death'); }
      return true;
    },
    update(dt, active) {
      const W = D.World, f = W.floors[Pl.floor];
      if (Pl.inv > 0) Pl.inv -= dt;
      Pl.shake = Math.max(0, Pl.shake - dt * 1.4);
      if (!active) { Pl.moving = false; Pl.speed = 0; Pl.vx = Pl.vz = 0; Pl.noise = 0; return; }

      const [mx, my] = I.look(), k = 0.0022 * D.settings.sens;
      Pl.yaw -= mx * k; Pl.pitch = D.clamp(Pl.pitch - my * k, -1.45, 1.45);

      let fw = (I.down('KeyW') || I.down('ArrowUp') ? 1 : 0) - (I.down('KeyS') || I.down('ArrowDown') ? 1 : 0);
      let st = (I.down('KeyD') || I.down('ArrowRight') ? 1 : 0) - (I.down('KeyA') || I.down('ArrowLeft') ? 1 : 0);
      const wantCrouch = I.down('ControlLeft') || I.down('ControlRight') || I.down('KeyC');
      Pl.crouch = wantCrouch;
      const wantSprint = (I.down('ShiftLeft') || I.down('ShiftRight')) && fw > 0 && !Pl.crouch;
      Pl.sprint = wantSprint && !Pl.exhausted && Pl.stamina > 0;
      const len = Math.hypot(fw, st) || 1; fw /= len; st /= len;
      const has = fw !== 0 || st !== 0;
      const target = !has ? 0 : Pl.crouch ? 1.35 : Pl.sprint ? 4.8 : 2.6;
      const sn = Math.sin(Pl.yaw), cs = Math.cos(Pl.yaw);
      const tx = (-sn * fw + cs * st) * target, tz = (-cs * fw - sn * st) * target;
      const acc = has ? 8 : 11;
      Pl.vx += (tx - Pl.vx) * Math.min(1, acc * dt); Pl.vz += (tz - Pl.vz) * Math.min(1, acc * dt);
      Pl.speed = Math.hypot(Pl.vx, Pl.vz); Pl.moving = Pl.speed > 0.3;

      // stamina
      if (Pl.sprint && Pl.moving) { Pl.stamina -= 20 * dt; Pl.regenDelay = 1.0; if (Pl.stamina <= 0) { Pl.stamina = 0; Pl.exhausted = true; } }
      else { Pl.regenDelay -= dt; if (Pl.regenDelay <= 0) Pl.stamina = Math.min(100, Pl.stamina + (Pl.crouch ? 20 : 13) * dt); if (Pl.exhausted && Pl.stamina >= 25) Pl.exhausted = false; }

      // move with collision (axis separated for sliding)
      pos.x = Pl.x; pos.z = Pl.z;
      pos.x += Pl.vx * dt; W.collide(f, pos, 0.32);
      pos.z += Pl.vz * dt; W.collide(f, pos, 0.32);
      const moved = Math.hypot(pos.x - Pl.x, pos.z - Pl.z);
      Pl.x = pos.x; Pl.z = pos.z;

      // eye height, bob, footsteps
      Pl.eye = D.damp(Pl.eye, Pl.crouch ? 1.05 : 1.65, 9, dt);
      if (Pl.moving) {
        Pl.bob += moved * (Pl.sprint ? 2.3 : 2.9);
        Pl.stepD += moved;
        const stride = Pl.sprint ? 2.0 : Pl.crouch ? 1.2 : 1.55;
        if (Pl.stepD > stride) { Pl.stepD = 0; D.Audio.footstep(W.surfaceAt(f, Pl.x, Pl.z), Pl.sprint ? 1.0 : Pl.crouch ? 0.4 : 0.7); }
      }
      Pl.noise = !Pl.moving ? 1 : Pl.sprint ? 18 : Pl.crouch ? 3 : 8;
      Pl.lean = D.damp(Pl.lean, -st * 0.025, 6, dt);

      // flashlight battery
      if (Pl.flash) { Pl.battery -= 0.40 * dt; if (Pl.battery <= 0) { Pl.battery = 0; Pl.flash = false; D.Audio.flash(false); D.bus.emit('toast', 'The flashlight dies. Press R for a spare battery.'); } }
    }
  };
})(window.DLBY);
