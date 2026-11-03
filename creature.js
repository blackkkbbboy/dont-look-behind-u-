/* THE TENANT: an original creature that only moves while unobserved.
   Real AI: grid A* pathfinding, frustum + line-of-sight observation test, flanking via view-mask penalties,
   lurking around corners, rushing when your back is turned, stair-travel between floors, door handling. */
(function (D) {
  'use strict';
  const T = THREE, C = D.CELL;

  function buildModel(black) {
    const g = new T.Group(), parts = {};
    const skin = new T.MeshStandardMaterial({ color: black ? 0x050505 : 0xb7b2a6, roughness: 0.95 });
    const dark = new T.MeshStandardMaterial({ color: black ? 0x000000 : 0x15130f, roughness: 1 });
    const eye = new T.MeshBasicMaterial({ color: 0xffffff, fog: false });
    const mk = (geo, m, x, y, z, parent) => { const me = new T.Mesh(geo, m); me.position.set(x, y, z); me.castShadow = true; (parent || g).add(me); return me; };
    parts.torso = new T.Group(); parts.torso.position.y = 1.5; g.add(parts.torso);
    mk(new T.CylinderGeometry(0.2, 0.27, 1.15, 10), skin, 0, 0.1, 0, parts.torso);
    mk(new T.CylinderGeometry(0.22, 0.24, 0.5, 10), dark, 0, -0.25, 0, parts.torso);            // tattered cloth
    parts.neck = new T.Group(); parts.neck.position.set(0, 0.7, 0.04); parts.torso.add(parts.neck);
    mk(new T.CylinderGeometry(0.06, 0.08, 0.5, 8), skin, 0, 0.2, 0, parts.neck);
    parts.head = new T.Group(); parts.head.position.set(0, 0.55, 0.05); parts.neck.add(parts.head);
    const skull = mk(new T.SphereGeometry(0.21, 14, 12), skin, 0, 0.12, 0, parts.head); skull.scale.set(0.85, 1.45, 0.95);
    mk(new T.SphereGeometry(0.05, 8, 8), eye, -0.07, 0.17, 0.17, parts.head); mk(new T.SphereGeometry(0.05, 8, 8), eye, 0.07, 0.17, 0.17, parts.head);
    parts.glow = new T.Sprite(new T.SpriteMaterial({ map: D.Tex.glow(), color: 0xcfe0ff, transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: black ? 0 : 0.55, fog: false }));
    parts.glow.scale.set(0.9, 0.9, 0.9); parts.glow.position.set(0, 0.17, 0.2); parts.head.add(parts.glow);
    // arms - far too long
    ['L', 'R'].forEach((s, i) => {
      const sx = i ? 0.3 : -0.3, a = new T.Group(); a.position.set(sx, 0.55, 0); parts.torso.add(a);
      mk(new T.CylinderGeometry(0.05, 0.04, 0.85, 7), skin, 0, -0.42, 0, a);
      const fa = new T.Group(); fa.position.y = -0.85; a.add(fa);
      mk(new T.CylinderGeometry(0.04, 0.03, 0.95, 7), skin, 0, -0.47, 0, fa);
      for (let k = 0; k < 4; k++) mk(new T.CylinderGeometry(0.012, 0.008, 0.32, 5), skin, -0.045 + k * 0.03, -1.1, 0.0, fa);
      parts['arm' + s] = a; parts['fore' + s] = fa;
    });
    // legs - bent the wrong way
    ['L', 'R'].forEach((s, i) => {
      const l = new T.Group(); l.position.set(i ? 0.13 : -0.13, 1.0, 0); g.add(l);
      mk(new T.CylinderGeometry(0.07, 0.05, 0.62, 7), skin, 0, -0.31, 0, l);
      const sh = new T.Group(); sh.position.y = -0.62; l.add(sh);
      mk(new T.CylinderGeometry(0.045, 0.035, 0.62, 7), skin, 0, -0.31, 0.03, sh);
      mk(new T.BoxGeometry(0.09, 0.04, 0.26), skin, 0, -0.62, 0.1, sh);
      parts['leg' + s] = l; parts['shin' + s] = sh;
    });
    g.traverse(o => { if (o.isMesh) o.frustumCulled = true; });
    return { g, parts };
  }

  function pose(p, ph, moving, t, lean) {
    const s = Math.sin(ph), c = Math.cos(ph);
    p.legL.rotation.x = moving ? s * 0.55 : 0; p.legR.rotation.x = moving ? -s * 0.55 : 0;
    p.shinL.rotation.x = moving ? Math.max(0, -s) * 0.9 : 0.1; p.shinR.rotation.x = moving ? Math.max(0, s) * 0.9 : 0.1;
    p.armL.rotation.x = moving ? -s * 0.22 : 0.05; p.armR.rotation.x = moving ? s * 0.22 : 0.05;
    p.armL.rotation.z = 0.12 + (moving ? 0 : Math.sin(t * 0.8) * 0.02); p.armR.rotation.z = -0.12 - (moving ? 0 : Math.sin(t * 0.8) * 0.02);
    p.foreL.rotation.x = moving ? 0.25 : 0.1; p.foreR.rotation.x = moving ? 0.25 : 0.1;
    p.torso.rotation.x = 0.1 + (moving ? 0.22 : 0); p.torso.rotation.z = moving ? c * 0.08 : 0;
    p.neck.rotation.x = 0.25; p.head.rotation.z = 0.35 + Math.sin(t * 1.3) * 0.04; p.head.rotation.y = lean || 0;
  }

  const Cr = D.Creature = {
    active: false, floor: 1, x: 0, z: 0, y: 0, yaw: 0, observed: false, frozen: false, stun: 0, aggr: 0, transit: null, dist: 99,
    path: null, pathT: 0, goalKey: '', phase: 0, animT: 0, stepD: 0, mode: 'idle', wait: 0, doorWait: 0, lastSeen: 0, burst: 0, viewMask: null, vmT: 0, lightT: 0, growlT: 8, lurk: false, rush: false, wasObserved: false,
    init() { const m = buildModel(false); Cr.model = m.g; Cr.parts = m.parts; Cr.model.visible = false; },
    attach(fi) { if (Cr.model.parent) Cr.model.parent.remove(Cr.model); D.World.floors[fi].group.add(Cr.model); Cr.model.position.y = D.World.floors[fi].y; },
    spawn(fi, tx, tz) {
      Cr.floor = fi; Cr.x = D.t2w(tx); Cr.z = D.t2w(tz); Cr.active = true; Cr.transit = null; Cr.path = null; Cr.stun = 0; Cr.attach(fi); Cr.model.visible = true; Cr.mode = 'hunt';
      Cr.model.position.set(Cr.x, D.World.floors[fi].y, Cr.z);
    },
    despawn() { Cr.active = false; if (Cr.model) Cr.model.visible = false; D.Audio.breathing(false); },
    aggression(S) { if (S.fireT > 0 || (S.flags && S.flags.looking)) return 1; return D.clamp(S.time / 1500 + (S.chapter - 1) * 0.17, 0, 1); },

    // tiles currently inside the player's field of view (penalised by flanking paths)
    buildViewMask(f) {
      const P = D.Player, m = Cr.viewMask || (Cr.viewMask = new Uint8Array(D.GW * D.GD)); m.fill(0);
      for (let i = -14; i <= 14; i++) {
        const a = P.yaw + i * 0.04 * 1.0, dx = -Math.sin(a), dz = -Math.cos(a);
        for (let d = 0; d < 40; d += 0.9) { const tx = D.w2t(P.x + dx * d), tz = D.w2t(P.z + dz * d); if (D.World.solidTile(f, tx, tz)) break; m[tz * D.GW + tx] = 1; }
      }
    },
    pathTo(f, gx, gz) {
      const W = D.World, sx = D.w2t(Cr.x), sz = D.w2t(Cr.z);
      const pen = Cr.aggr >= 0.3 && Cr.viewMask ? (x, z) => (Cr.viewMask[z * D.GW + x] ? 5 : 0) : null;
      Cr.path = W.path(f, sx, sz, gx, gz, pen); Cr.pathT = 0.5;
    },
    arrive() {
      const t = Cr.transit; Cr.transit = null; Cr.floor = t.to; Cr.x = D.t2w(t.tx); Cr.z = D.t2w(t.tz); Cr.path = null; Cr.attach(t.to); Cr.model.visible = true;
      Cr.model.position.set(Cr.x, D.World.floors[t.to].y, Cr.z);
      const f = D.World.floors[t.to]; const d = f.doorAt; // stairwell door slams
      if (D.Player.floor === t.to) D.Audio.doorCreak({ x: 4, y: f.y + 1.4, z: Cr.z }, true);
    },
    attack() {
      const P = D.Player; if (P.inv > 0) return;
      D.Audio.screech(1); P.damage(34); Cr.stun = 5.5; Cr.mode = 'recoil';
      // knock the player back
      const dx = P.x - Cr.x, dz = P.z - Cr.z, l = Math.hypot(dx, dz) || 1; P.vx += dx / l * 6; P.vz += dz / l * 6;
    },

    update(dt, S) {
      if (!Cr.active) return;
      const W = D.World, P = D.Player, G = D.Game;
      Cr.aggr = Cr.aggression(S); Cr.animT += dt;
      const same = Cr.floor === P.floor, f = W.floors[Cr.floor];
      Cr.dist = same ? Math.hypot(P.x - Cr.x, P.z - Cr.z) : 999;

      // ---- stair transit (unseen, takes time)
      if (Cr.transit) {
        Cr.model.visible = false; Cr.transit.t -= dt;
        if (Math.abs(P.floor - Cr.transit.to) <= 1 && Math.random() < dt * 0.9) D.Audio.thumpAbove({ x: P.x + D.rnd(-3, 3), y: W.floors[P.floor].y + (Cr.transit.to > P.floor ? 6 : -6), z: P.z + D.rnd(-3, 3) }, 0.7);
        if (Cr.transit.t <= 0) Cr.arrive();
        D.Audio.breathing(false); return;
      }

      // ---- observation: real frustum + line of sight test
      const wasObs = Cr.observed;
      Cr.observed = same && Cr.dist < 60 && G.canSee(Cr.x, f.y + 1.3, Cr.z, 1.2, Cr.floor);
      Cr.model.visible = !(Cr.floor !== P.floor);
      if (Cr.observed && !wasObs && Cr.dist < 24 && !Cr.silent) { D.Audio.stinger(Cr.dist < 10 ? 0.9 : 0.5); }
      Cr.wasObserved = wasObs;

      // ---- audio: breathing follows creature (even while frozen)
      if (same && Cr.dist < 26) D.Audio.breathing(true, { x: Cr.x, y: f.y + 2.2, z: Cr.z }, D.clamp(1.2 - Cr.dist / 26, 0.1, 1.3));
      else D.Audio.breathing(false);

      // ---- fear metric drives heartbeat / tension / vignette
      const fear = same ? D.clamp(1 - Cr.dist / 22, 0, 1) * (Cr.observed ? 1 : 0.8) : 0; Cr.fear = fear;

      if (Cr.stun > 0) { Cr.stun -= dt; if (Cr.stun <= 0 && Cr.mode === 'recoil') Cr.mode = 'hunt'; }

      // ---- THE RULE: if the player is looking at it, it does not move. At all.
      if (Cr.observed) { Cr.frozen = true; return; }
      Cr.frozen = false;
      if (Cr.stun > 0) { pose(Cr.parts, Cr.phase, false, Cr.animT, 0); return; }

      // ---- lights die around it as it gets stronger
      Cr.lightT -= dt;
      if (Cr.lightT <= 0 && same) { Cr.lightT = 0.6; if (Cr.aggr > 0.3) W.lightsNear(f, Cr.x, Cr.z, 6.5, fx => { if (fx.flick <= 0 && Math.random() < 0.5) fx.flick = 0.5; if (Math.random() < Cr.aggr * 0.12) fx.out = 7; }); }

      // ---- growl occasionally when close and unseen
      Cr.growlT -= dt; if (Cr.growlT <= 0 && same && Cr.dist < 18) { Cr.growlT = D.rnd(9, 20); D.Audio.growl({ x: Cr.x, y: f.y + 2, z: Cr.z }, 0.8); }

      // ---- other-floor behaviour: head to the stairs
      let goal;
      if (!same) {
        const up = P.floor > Cr.floor; goal = up ? [2, 8] : [2, 10];
        if (D.w2t(Cr.x) === goal[0] && D.w2t(Cr.z) === goal[1]) { Cr.transit = { t: 6 + Math.random() * 5, to: Cr.floor + (up ? 1 : -1), tx: 2, tz: up ? 10 : 8 }; return; }
      } else {
        // sneaking: when the creature can't see... decide goal = player tile
        goal = [D.w2t(P.x), D.w2t(P.z)];
        const gk = goal[0] + ',' + goal[1];
        if (gk !== Cr.goalKey) { Cr.goalKey = gk; Cr.pathT = Math.min(Cr.pathT, 0.15); }
      }

      Cr.vmT -= dt; if (same && Cr.aggr >= 0.3 && Cr.vmT <= 0) { Cr.vmT = 0.45; Cr.buildViewMask(f); }
      Cr.pathT -= dt;
      if (!Cr.path || Cr.pathT <= 0) Cr.pathTo(f, goal[0], goal[1]);

      // ---- speed model: rush when back is turned, lurk behind corners when being faced
      const fwd = P.forward(); let rel = 0;
      if (same && Cr.dist > 0.1) rel = (fwd.x * (Cr.x - P.x) + fwd.z * (Cr.z - P.z)) / Cr.dist;      // 1 = creature in front, -1 = behind
      let speed = D.lerp(1.3, 2.4, Cr.aggr);
      Cr.rush = false; Cr.lurk = false;
      if (same && Cr.aggr >= 0.35 && Cr.dist < 24 && rel < -0.15) { speed *= 1.7 + Cr.aggr * 0.5; Cr.rush = true; }
      else if (same && Cr.aggr >= 0.6 && Cr.dist < 11 && rel > 0.25) { speed *= 0.18; Cr.lurk = true; }
      if (same && Cr.dist > 30) speed *= 1.6;
      if (!same) speed = 2.8;

      // ---- attack when it reaches you unobserved
      if (same && Cr.dist < 1.35 && Cr.stun <= 0) { Cr.attack(); return; }

      // ---- follow path
      let moving = false;
      if (Cr.doorWait > 0) Cr.doorWait -= dt;
      else if (Cr.path && Cr.path.length) {
        const nx = Cr.path[0], tx = D.t2w(nx[0]), tz = D.t2w(nx[1]);
        const door = f.doorAt[nx[1] * D.GW + nx[0]];
        if (door && !door.open) { W.setDoor(door, true); Cr.doorWait = 0.5; if (door.locked) door.locked = null; }
        else {
          const dx = tx - Cr.x, dz = tz - Cr.z, d = Math.hypot(dx, dz), step = speed * dt;
          if (d <= step) { Cr.x = tx; Cr.z = tz; Cr.path.shift(); } else { Cr.x += dx / d * step; Cr.z += dz / d * step; }
          if (d > 0.01) Cr.yaw = Math.atan2(dx, dz);
          moving = true; Cr.stepD += Math.min(step, d); Cr.phase += Math.min(step, d) * 2.4;
        }
      }
      if (moving && Cr.stepD > 1.25) {
        Cr.stepD = 0;
        const p = { x: Cr.x, y: f.y + 0.1, z: Cr.z };
        if (same) D.Audio.stepAt(p, Cr.rush ? 1.0 : 0.8, false);
        else if (Math.abs(P.floor - Cr.floor) === 1 && Math.hypot(Cr.x - P.x, Cr.z - P.z) < 30) D.Audio.stepAt({ x: Cr.x, y: f.y + 0.1, z: Cr.z }, 0.8, true);
      }
      // stop-motion pose update (~10 fps) for a jerky, wrong look
      Cr.burst -= dt; if (Cr.burst <= 0) { Cr.burst = 0.1; pose(Cr.parts, Cr.phase, moving, Cr.animT, same ? D.clamp(D.angDiff(Cr.yaw, Math.atan2(P.x - Cr.x, P.z - Cr.z)), -0.6, 0.6) : 0); }
      Cr.model.position.set(Cr.x, f.y, Cr.z);
      Cr.model.rotation.y += D.angDiff(Cr.model.rotation.y, Cr.yaw) * Math.min(1, dt * 9);
    },

    // keep the mesh in sync when frozen (so the statue stays put) and on floor change
    syncMesh() { if (Cr.active && Cr.model && !Cr.transit) { const f = D.World.floors[Cr.floor]; Cr.model.position.set(Cr.x, f.y, Cr.z); } },
    makeApparition() { const m = buildModel(true); m.g.scale.setScalar(1.05); return m.g; }
  };
})(window.DLBY);
