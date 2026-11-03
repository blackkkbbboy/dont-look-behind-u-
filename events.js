/* Psychological horror director: scheduled scares that escalate with the chapter and time survived */
(function (D) {
  'use strict';
  const W = D.World, A = D.Audio;
  const SCRAWLS = ["DON'T LOOK\nBEHIND YOU", 'KEEP\nLOOKING', 'WE ARE\nSTILL HERE', 'TURN\nAROUND', 'REYES', '23', 'YOU LEFT\nTHE DOOR', 'LOOK AT\nUS'];
  let app = null;

  const E = D.Events = {
    t: 12, enabled: true, last: '',
    reset() { E.t = 14; clearApp(); },
    distortion(S) { return D.clamp((S.chapter - 1) / 4 * 0.8 + S.time / 3000 * 0.35, 0, 1); },

    update(dt, S) {
      if (!E.enabled) return;
      const d = E.distortion(S); S.distortion = d;
      updateApp(dt);
      E.t -= dt;
      if (E.t > 0) return;
      E.t = D.lerp(34, 9, d) * D.rnd(0.7, 1.3);
      const ok = defs.filter(e => d >= e.min && e.id !== E.last && (!e.cond || e.cond(S)));
      let tot = 0; ok.forEach(e => tot += e.w); let r = Math.random() * tot, pick = ok[0];
      for (const e of ok) { r -= e.w; if (r <= 0) { pick = e; break; } }
      if (pick) { E.last = pick.id; try { pick.run(S, d); } catch (err) { console.warn('event', pick.id, err); } }
    },
    trigger(id, S) { const e = defs.find(x => x.id === id); if (e) e.run(S, S.distortion || 0); }
  };

  const P = () => D.Player;
  const fl = () => W.floors[P().floor];
  const vis = (x, y, z) => D.Game.canSee(x, y, z, 0.6, P().floor);
  function behind(dist) { const p = P(), f = p.forward(); return { x: p.x - f.x * dist, y: fl().y + 0.2, z: p.z - f.z * dist }; }

  function clearApp() { if (app) { if (app.m.parent) app.m.parent.remove(app.m); app = null; } }
  function updateApp(dt) {
    if (!app) return; const p = P(); app.age += dt;
    if (p.floor !== app.floor) { clearApp(); return; }
    const seen = D.Game.canSee(app.x, app.f.y + 1.3, app.z, 1.0, app.floor), dist = Math.hypot(p.x - app.x, p.z - app.z);
    if (seen) app.seen += dt; else if (app.seen > 0.4) app.gone += dt;
    if (dist < 13 || app.gone > 0.35 || app.age > 16) { if (dist < 13 && seen) A.thump(0.5); clearApp(); }
  }
  function silhouette() {
    const p = P(), f = fl(), fw = p.forward();
    const free = W.rayFree(f, p.x, p.z, fw.x, fw.z, 46);
    if (free < 20) return false;
    const d = free - 1.2, x = D.t2w(D.w2t(p.x + fw.x * d)), z = D.t2w(D.w2t(p.z + fw.z * d));
    if (D.Creature.active && D.Creature.floor === p.floor && Math.hypot(D.Creature.x - x, D.Creature.z - z) < 8) return false;
    clearApp();
    const m = D.Creature.makeApparition(); m.position.set(x, f.y, z); m.rotation.y = Math.atan2(p.x - x, p.z - z); f.group.add(m);
    app = { m, x, z, f, floor: p.floor, age: 0, seen: 0, gone: 0 }; return true;
  }

  const defs = [
    { id: 'lightOut', min: 0, w: 3, run(S) { const f = fl(), p = P(); const cand = f.fixtures.filter(x => x.kind === 'ceil' && Math.hypot(x.x - p.x, x.z - p.z) < 26 && Math.hypot(x.x - p.x, x.z - p.z) > 4); if (!cand.length) return; const g = D.pick(cand).group; const dur = D.rnd(10, 25); f.fixtures.forEach(x => { if (x.group === g) { x.flick = 0.8; x.out = dur; } }); A.thump(0.25); } },
    { id: 'flicker', min: 0, w: 2, run() { const f = fl(), p = P(); f.fixtures.forEach(x => { if (Math.hypot(x.x - p.x, x.z - p.z) < 22) x.flick = D.rnd(1.2, 2.2); }); } },
    { id: 'steps', min: 0, w: 3, run() { let n = 0; const go = () => { if (n++ >= 5 || D.Game.state !== 'play') return; A.mimicStep(behind(Math.max(0.8, 4.2 - n * 0.6)), 1); setTimeout(go, 520 - n * 30); }; go(); } },
    { id: 'knock', min: 0, w: 3, run() { const f = fl(), p = P(); const ds = f.doors.filter(x => { const dx = x.tx * D.CELL - p.x, dz = x.tz * D.CELL - p.z, d = Math.hypot(dx, dz); return d > 14 && d < 40; }); if (!ds.length) return; const d = D.pick(ds); A.knock({ x: d.tx * D.CELL + 1, y: f.y + 1.3, z: d.tz * D.CELL + 1 }, false); if (Math.random() < 0.5) setTimeout(() => A.knock({ x: d.tx * D.CELL + 1, y: f.y + 1.3, z: d.tz * D.CELL + 1 }, false), 2600); } },
    { id: 'slam', min: 0.1, w: 2, run() { const f = fl(), p = P(); const ds = f.doors.filter(x => !x.locked && Math.hypot(x.tx * D.CELL - p.x, x.tz * D.CELL - p.z) > 6 && !vis(x.tx * D.CELL + 1, f.y + 1, x.tz * D.CELL + 1)); if (!ds.length) return; const d = D.pick(ds); const px = { x: d.tx * D.CELL + 1, y: f.y + 1.3, z: d.tz * D.CELL + 1 }; W.setDoor(d, !d.open, true); A.doorCreak(px, true); } },
    { id: 'whisper', min: 0.15, w: 2, run() { A.whisper(Math.random() < 0.5 ? -0.8 : 0.8); } },
    { id: 'shift', min: 0.1, w: 3, run(S, d) { for (let i = 0; i < 2 + Math.floor(d * 4); i++) W.mutate(fl(), vis, d); } },
    { id: 'silhouette', min: 0.2, w: 2.5, run() { silhouette(); } },
    { id: 'scrawl', min: 0.35, w: 2, run() { W.addScrawl(fl(), D.pick(SCRAWLS)); } },
    { id: 'distort', min: 0.3, w: 1.5, run() { D.Fx.distort(3.2); A.stinger(0.6); } },
    { id: 'silence', min: 0.25, w: 1, run() { A.duck(6); setTimeout(() => { if (D.Game.state === 'play') A.thump(1); }, 5200); } },
    { id: 'ding', min: 0.1, w: 1, run() { A.ding(); } },
    { id: 'breath', min: 0.2, w: 1.5, run() { A.breathBurst(behind(1.3)); } },
    { id: 'above', min: 0.15, w: 1.5, cond: () => P().floor < 2, run() { A.thumpAbove({ x: P().x + 2, y: fl().y + 6, z: P().z }, 1); } }
  ];
})(window.DLBY);
