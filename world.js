/* The building: grid layout for 3 floors, rendering, doors, lights, collision, line-of-sight, pathfinding */
(function (D) {
  'use strict';
  const T = THREE, C = D.CELL, H = D.WALL_H, GW = D.GW, GD = D.GD;
  const PM = D.PM, P = D.Props;
  let Mt = null;

  const W = D.World = { floors: [], active: 1, root: null, pickups: {}, S: null, notes: {} };

  // ---------------------------------------------------------------- grid helpers
  function newFloor(idx) {
    const f = { idx, y: idx * D.GAP, group: new T.Group(), t: [], s: [], rm: [], doors: [], doorAt: {}, rooms: [], fixtures: [], colliders: [], inter: [], props: [], specials: [], decals: [], boxes: [] };
    for (let z = 0; z < GD; z++) { f.t.push(new Uint8Array(GW)); f.s.push(new Array(GW).fill('corr')); f.rm.push(new Array(GW).fill(null)); }
    f.group.position.y = 0;
    return f;
  }
  function carve(f, x0, z0, x1, z1, style) { for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) { f.t[z][x] = 1; f.s[z][x] = style; } }
  function ring(f, style) {
    carve(f, 2, 2, 37, 2, style); carve(f, 2, 16, 37, 16, style); carve(f, 2, 2, 2, 16, style); carve(f, 37, 2, 37, 16, style); carve(f, 2, 9, 37, 9, style);
  }
  function addRoom(f, sp) {
    sp.fl = f; sp.x0w = sp.x0 * C; sp.x1w = (sp.x1 + 1) * C; sp.z0w = sp.z0 * C; sp.z1w = (sp.z1 + 1) * C;
    sp.cx = (sp.x0w + sp.x1w) / 2; sp.cz = (sp.z0w + sp.z1w) / 2; sp.doorsObj = [];
    carve(f, sp.x0, sp.z0, sp.x1, sp.z1, sp.style);
    for (let z = sp.z0; z <= sp.z1; z++) for (let x = sp.x0; x <= sp.x1; x++) f.rm[z][x] = sp;
    sp.doors.forEach((dp, i) => {
      f.t[dp.z][dp.x] = 2; f.s[dp.z][dp.x] = f.idx === 0 ? 'conc' : 'corr'; f.rm[dp.z][dp.x] = sp;
      const d = { id: f.idx + ':' + sp.id + ':' + i, fl: f, tx: dp.x, tz: dp.z, room: sp, open: false, amt: 0, locked: sp.locked || null, type: sp.doorType || 'wood', swing: sp.back === 'N' ? 1 : -1, ai: false, ajar: 0 };
      f.doors.push(d); f.doorAt[dp.z * GW + dp.x] = d; sp.doorsObj.push(d);
    });
    f.rooms.push(sp);
    return sp;
  }
  W.roomById = (f, id) => f.rooms.find(r => r.id === id);
  W.tileOpen = (f, x, z) => x >= 0 && z >= 0 && x < GW && z < GD && f.t[z][x] !== 0;
  W.solidTile = function (f, x, z) {
    if (x < 0 || z < 0 || x >= GW || z >= GD) return true;
    const t = f.t[z][x]; if (t === 0) return true;
    if (t === 2) { const d = f.doorAt[z * GW + x]; return !(d && d.open); }
    return false;
  };
  W.surfaceAt = function (f, x, z) {
    const s = f.s[D.w2t(z)] && f.s[D.w2t(z)][D.w2t(x)];
    return s === 'room' ? 'wood' : s === 'lobby' ? 'tile' : s === 'conc' ? 'concrete' : 'carpet';
  };

  // ---------------------------------------------------------------- collision
  function pushOut(p, x0, z0, x1, z1, r) {
    const cx = D.clamp(p.x, x0, x1), cz = D.clamp(p.z, z0, z1), dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
    if (d2 >= r * r) return;
    if (d2 > 1e-8) { const d = Math.sqrt(d2), k = (r - d) / d; p.x += dx * k; p.z += dz * k; }
    else { const l = p.x - x0, rr = x1 - p.x, t = p.z - z0, b = z1 - p.z, m = Math.min(l, rr, t, b); if (m === l) p.x = x0 - r; else if (m === rr) p.x = x1 + r; else if (m === t) p.z = z0 - r; else p.z = z1 + r; }
  }
  W.collide = function (f, p, r) {
    for (let pass = 0; pass < 2; pass++) {
      const tx = D.w2t(p.x), tz = D.w2t(p.z);
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const x = tx + dx, z = tz + dz; if (W.solidTile(f, x, z)) pushOut(p, x * C, z * C, (x + 1) * C, (z + 1) * C, r); }
      for (let i = 0; i < f.colliders.length; i++) { const c = f.colliders[i]; if (c.off) continue; if (p.x > c.x0 - 2 && p.x < c.x1 + 2 && p.z > c.z0 - 2 && p.z < c.z1 + 2) pushOut(p, c.x0, c.z0, c.x1, c.z1, r); }
    }
  };
  // line of sight: walls and closed doors block (2D), step 0.4m
  W.los = function (f, x0, z0, x1, z1) {
    const dx = x1 - x0, dz = z1 - z0, dist = Math.hypot(dx, dz), n = Math.ceil(dist / 0.4);
    for (let i = 1; i < n; i++) { const k = i / n; if (W.solidTile(f, D.w2t(x0 + dx * k), D.w2t(z0 + dz * k))) return false; }
    return true;
  };
  // free run length from a point along a direction (for apparitions)
  W.rayFree = function (f, x, z, dx, dz, max) {
    let d = 0; while (d < max) { d += 0.5; if (W.solidTile(f, D.w2t(x + dx * d), D.w2t(z + dz * d))) return d - 0.5; } return max;
  };

  // ---------------------------------------------------------------- pathfinding (A*)
  W.passAI = function (f, x, z) {
    if (x < 0 || z < 0 || x >= GW || z >= GD) return false;
    const t = f.t[z][x]; if (t === 0) return false;
    const r = f.rm[z][x]; if (r && r.safe && r.safeOn) return false;
    if (t === 2) { const d = f.doorAt[z * GW + x]; if (d && d.locked && !d.ai) return false; }
    return true;
  };
  W.path = function (f, sx, sz, gx, gz, pen) {
    if (!W.passAI(f, gx, gz) || !W.passAI(f, sx, sz)) return null;
    const n = GW * GD, g = new Float32Array(n).fill(1e9), fs = new Float32Array(n).fill(1e9), came = new Int32Array(n).fill(-1), closed = new Uint8Array(n);
    const key = (x, z) => z * GW + x, h = (x, z) => Math.abs(x - gx) + Math.abs(z - gz);
    const open = [key(sx, sz)]; g[key(sx, sz)] = 0; fs[key(sx, sz)] = h(sx, sz);
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    let guard = 0;
    while (open.length && guard++ < 4000) {
      let bi = 0; for (let i = 1; i < open.length; i++) if (fs[open[i]] < fs[open[bi]]) bi = i;
      const cur = open.splice(bi, 1)[0], cx = cur % GW, cz = (cur / GW) | 0;
      if (cx === gx && cz === gz) { const out = []; let k = cur; while (k !== -1 && k !== key(sx, sz)) { out.push([k % GW, (k / GW) | 0]); k = came[k]; } return out.reverse(); }
      closed[cur] = 1;
      for (const dd of dirs) {
        const nx = cx + dd[0], nz = cz + dd[1]; if (!W.passAI(f, nx, nz)) continue;
        const nk = key(nx, nz); if (closed[nk]) continue;
        const ng = g[cur] + 1 + (pen ? pen(nx, nz) : 0);
        if (ng < g[nk]) { g[nk] = ng; came[nk] = cur; fs[nk] = ng + h(nx, nz); if (!open.includes(nk)) open.push(nk); }
      }
    }
    return null;
  };
  W.randomTile = function (f, pred, tries) {
    for (let i = 0; i < (tries || 200); i++) { const x = 2 + (Math.random() * (GW - 4) | 0), z = 1 + (Math.random() * (GD - 2) | 0); if (f.t[z][x] === 1 && (!pred || pred(x, z))) return [x, z]; }
    return null;
  };

  // ---------------------------------------------------------------- materials by style
  function wallMat(style) { return style === 'room' ? Mt.paint : style === 'lobby' ? Mt.lobbyWall : style === 'conc' ? Mt.concrete : Mt.wallpaper; }
  function floorMat(style) { return style === 'room' ? Mt.wood : style === 'lobby' ? Mt.tile : style === 'conc' ? Mt.concFloor : Mt.carpet; }

  // ---------------------------------------------------------------- render geometry
  function buildShell(f) {
    const g = f.group, wg = new T.BoxGeometry(C, H, C);
    const groups = {};
    const open = (x, z) => W.tileOpen(f, x, z);
    for (let z = 0; z < GD; z++) for (let x = 0; x < GW; x++) {
      if (f.t[z][x] !== 0) continue;
      let near = false; for (let dz = -1; dz <= 1 && !near; dz++) for (let dx = -1; dx <= 1; dx++) if (open(x + dx, z + dz)) { near = true; break; }
      if (!near) continue;
      const st = (dx, dz) => (open(x + dx, z + dz) ? f.s[z + dz][x + dx] : null);
      const sides = [st(1, 0), st(-1, 0), st(0, 1), st(0, -1)], key = sides.join('|');
      (groups[key] = groups[key] || { sides, pos: [] }).pos.push([x, z]);
    }
    const dum = new T.Object3D();
    Object.keys(groups).forEach(k => {
      const gp = groups[k], s = gp.sides, cm = f.idx === 0 ? Mt.concrete : Mt.ceiling;
      const mats = [wallMat(s[0] || 'corr'), wallMat(s[1] || 'corr'), cm, cm, wallMat(s[2] || 'corr'), wallMat(s[3] || 'corr')];
      const im = new T.InstancedMesh(wg, mats, gp.pos.length); im.castShadow = true; im.receiveShadow = true;
      gp.pos.forEach((p, i) => { dum.position.set(p[0] * C + C / 2, f.y + H / 2, p[1] * C + C / 2); dum.updateMatrix(); im.setMatrixAt(i, dum.matrix); });
      im.instanceMatrix.needsUpdate = true; g.add(im);
    });
    // floors & ceilings
    const fg = new T.PlaneGeometry(C, C).rotateX(-Math.PI / 2), cg = new T.PlaneGeometry(C, C).rotateX(Math.PI / 2);
    const fl = {}, cl = {};
    for (let z = 0; z < GD; z++) for (let x = 0; x < GW; x++) if (f.t[z][x] !== 0) { const s = f.s[z][x]; (fl[s] = fl[s] || []).push([x, z]); }
    Object.keys(fl).forEach(s => {
      const arr = fl[s];
      const a = new T.InstancedMesh(fg, floorMat(s), arr.length), b = new T.InstancedMesh(cg, s === 'conc' ? Mt.concFloor : Mt.ceiling, arr.length);
      a.receiveShadow = true; b.receiveShadow = true;
      arr.forEach((p, i) => { dum.position.set(p[0] * C + C / 2, f.y, p[1] * C + C / 2); dum.updateMatrix(); a.setMatrixAt(i, dum.matrix); dum.position.y = f.y + H; dum.updateMatrix(); b.setMatrixAt(i, dum.matrix); });
      a.instanceMatrix.needsUpdate = true; b.instanceMatrix.needsUpdate = true; g.add(a); g.add(b);
    });
  }

  // ---------------------------------------------------------------- doors
  function buildDoor(f, d) {
    const x0 = d.tx * C, z0 = d.tz * C, cx = x0 + C / 2, cz = z0 + C / 2, g = new T.Group();
    const wm = wallMat(f.s[d.tz][d.tx]);
    const mk = (w, h, dd, m, x, y, z) => { const me = new T.Mesh(new T.BoxGeometry(w, h, dd), m); me.position.set(x, y, z); me.castShadow = true; me.receiveShadow = true; g.add(me); return me; };
    mk(0.5, H, C, wm, x0 + 0.25, f.y + H / 2, cz); mk(0.5, H, C, wm, x0 + C - 0.25, f.y + H / 2, cz);
    mk(1.0, H - 2.3, C, wm, cx, f.y + 2.3 + (H - 2.3) / 2, cz);
    f.colliders.push({ x0: x0, x1: x0 + 0.5, z0: z0, z1: z0 + C }, { x0: x0 + C - 0.5, x1: x0 + C, z0: z0, z1: z0 + C });
    const pivot = new T.Group(); pivot.position.set(x0 + 0.5, f.y, cz);
    const leaf = new T.Mesh(new T.BoxGeometry(1.0, 2.3, 0.07), d.type === 'metal' ? Mt.doorMetal : Mt.doorWood);
    leaf.position.set(0.5, 1.15, 0); leaf.castShadow = true; leaf.receiveShadow = true; pivot.add(leaf); g.add(pivot);
    d.pivot = pivot; d.leaf = leaf;
    // plate on corridor side
    if (d.room && d.room.plate !== false) {
      const label = d.room.label || d.room.id;
      const pm = new T.Mesh(new T.PlaneGeometry(0.8, 0.28), new T.MeshStandardMaterial({ map: D.Tex.text(label, { w: 256, h: 90, font: 'bold 44px', color: '#d8cfa8', bg: '#2a2218', noise: true }), roughness: 0.6 }));
      const n = d.room.back === 'N';
      pm.position.set(cx, f.y + 2.65, n ? z0 + C + 0.006 : z0 - 0.006); pm.rotation.y = n ? 0 : Math.PI; g.add(pm);
    }
    f.group.add(g);
    f.inter.push({ kind: 'door', x: cx, y: f.y + 1.2, z: cz, r: 2.6, data: d, enabled: () => true });
  }
  W.setDoor = function (d, open, silent) {
    if (d.open === open) return; d.open = open;
    if (!silent) D.Audio.doorCreak({ x: d.tx * C + C / 2, y: d.fl.y + 1.4, z: d.tz * C + C / 2 }, false);
  };
  W.updateDoors = function (dt) {
    for (let k = 0; k < W.floors.length; k++) {
      const f = W.floors[k]; if (f.idx !== W.active) continue;
      f.doors.forEach(d => { const tgt = d.open ? 1 : 0; d.amt += (tgt - d.amt) * Math.min(1, dt * 5); if (Math.abs(tgt - d.amt) < 0.003) d.amt = tgt; d.pivot.rotation.y = d.swing * d.amt * 1.75 + (d.ajar || 0); });
    }
  };

  // ---------------------------------------------------------------- lights
  function addFixture(f, x, z, o) {
    o = o || {};
    const kind = o.kind || 'ceil', y = o.y !== undefined ? o.y : f.y + H - 0.05;
    const mat = new T.MeshStandardMaterial({ color: 0x222222, emissive: o.color || 0xfff0d0, emissiveIntensity: 0, roughness: 0.6 });
    if (kind === 'ceil') { const m = new T.Mesh(new T.BoxGeometry(0.9, 0.06, 0.26), mat); m.position.set(x, y, z); f.group.add(m); }
    const fx = { fl: f, x, z, y: kind === 'ceil' ? y - 0.35 : y, kind, on: o.on !== false, emg: !!o.emg, color: new T.Color(o.color || 0xfff0d0), base: o.base || 15, eBase: o.eBase || 2.2, mat, lvl: 0, out: 0, flick: 0, faulty: !!o.faulty, ft: Math.random() * 3, fstate: true, group: o.group || '', dist: o.dist || 13 };
    f.fixtures.push(fx); return fx;
  }
  W.updateLights = function (dt, px, pz, pool, power, fireT) {
    const f = W.floors[W.active], cand = [];
    for (let i = 0; i < f.fixtures.length; i++) {
      const fx = f.fixtures[i];
      let tgt = fx.on ? 1 : 0;
      if (fx.kind === 'ceil' && !power && !fx.emg) tgt = 0;
      if (fx.out > 0) { fx.out -= dt; tgt = 0; }
      if (fx.flick > 0) { fx.flick -= dt; tgt *= Math.random() < 0.45 ? 0 : 0.3 + Math.random() * 0.7; fx.lvl = tgt; }
      else {
        if (fx.faulty && tgt > 0) { fx.ft -= dt; if (fx.ft <= 0) { fx.fstate = Math.random() < 0.82; fx.ft = fx.fstate ? D.rnd(1, 7) : D.rnd(0.04, 0.3); } if (!fx.fstate) tgt *= Math.random() < 0.5 ? 0.05 : 0.45; }
        fx.lvl = D.damp(fx.lvl, tgt, 14, dt);
      }
      fx.mat.emissiveIntensity = fx.lvl * fx.eBase; fx.mat.emissive.copy(fx.color);
      if (fx.lvl > 0.03) { const dx = fx.x - px, dz = fx.z - pz, d2 = dx * dx + dz * dz; if (d2 < 22 * 22) cand.push([d2, fx]); }
    }
    cand.sort((a, b) => a[0] - b[0]);
    for (let i = 0; i < pool.length; i++) {
      const L = pool[i];
      if (i < cand.length) {
        const fx = cand[i][1]; L.visible = true; L.position.set(fx.x, fx.y, fx.z); L.color.copy(fx.color);
        L.intensity = fx.base * fx.lvl * D.settings.brightness; L.distance = fx.dist; L.decay = 2;
        if (fireT) { L.color.setHex(0xff5a1a); L.intensity *= 1 + 0.5 * Math.sin(performance.now() / 70 + i * 3); }
      } else L.visible = false;
    }
  };
  W.lightsNear = function (f, x, z, r, fn) { f.fixtures.forEach(fx => { if (Math.hypot(fx.x - x, fx.z - z) < r) fn(fx); }); };

  function placeFixtures(f) {
    let n = 0;
    for (let z = 0; z < GD; z++) for (let x = 0; x < GW; x++) {
      if (f.t[z][x] !== 1) continue; const s = f.s[z][x]; if (s === 'room') continue;
      let ok = false;
      if (s === 'corr') ok = (x + z * 2) % 3 === 0; else if (s === 'conc') ok = (x + z * 2) % 5 === 0; else if (s === 'lobby') ok = x % 3 === 1 && z % 3 === 1;
      if (!ok) continue;
      n++;
      addFixture(f, D.t2w(x), D.t2w(z), { emg: n % 3 === 0, faulty: Math.random() < (f.idx === 0 ? 0.5 : 0.25), base: s === 'lobby' ? 20 : 14, color: f.idx === 0 ? 0xdde8ff : 0xffe8c0, group: f.idx + ':' + ((x / 8) | 0) + ':' + ((z / 8) | 0), dist: s === 'lobby' ? 18 : 12 });
    }
  }

  // ---------------------------------------------------------------- props helpers
  function put(f, b, x, z, rot, o) {
    o = o || {}; const g = b.g; g.position.set(x, f.y, z); g.rotation.y = rot || 0; f.group.add(g);
    if (!o.nocol) { const sw = Math.abs(Math.sin(rot || 0)) > 0.5, hw = (sw ? b.d : b.w) / 2, hd = (sw ? b.w : b.d) / 2; const col = { x0: x - hw, x1: x + hw, z0: z - hd, z1: z + hd }; f.colliders.push(col); b.col = col; }
    f.props.push({ g, x, z, rot: rot || 0, mut: o.mut !== false, col: b.col, b });
    return b;
  }
  function rel(r, wall, a, d) {
    const N = r.back === 'N';
    if (wall === 'back') return { x: r.x0w + a, z: N ? r.z0w + d / 2 + 0.04 : r.z1w - d / 2 - 0.04, rot: N ? 0 : Math.PI };
    if (wall === 'west') return { x: r.x0w + d / 2 + 0.04, z: N ? r.z0w + a : r.z1w - a, rot: Math.PI / 2 };
    if (wall === 'east') return { x: r.x1w - d / 2 - 0.04, z: N ? r.z0w + a : r.z1w - a, rot: -Math.PI / 2 };
    return { x: r.x0w + a, z: N ? r.z0w + d : r.z1w - d, rot: N ? 0 : Math.PI };
  }
  function putRel(f, r, wall, a, b, o) { const p = rel(r, wall, a, b.d); put(f, b, p.x, p.z, p.rot, o); return p; }
  function roomLight(f, r, on, color, base) { return addFixture(f, r.cx, r.cz, { on: on, color: color || 0xffe0b0, base: base || 13, dist: 11, faulty: Math.random() < 0.3, group: f.idx + ':' + r.id }); }
  function lampLight(f, x, z, y) { return addFixture(f, x, z, { kind: 'lamp', y: f.y + y, on: true, emg: true, color: 0xffa860, base: 5.5, eBase: 0, dist: 9 }); }

  W.addPickup = function (f, id, type, x, z, y) {
    const S = W.S, taken = S.taken.indexOf(id) >= 0;
    const m = P.pickupMesh(type); m.position.set(x, f.y + y, z); m.rotation.y = Math.random() * 6; f.group.add(m); m.visible = !taken;
    const inter = { kind: 'pickup', x: x, y: f.y + y + 0.1, z: z, r: 2.4, data: { id, type }, enabled: () => !W.pickups[id].taken && (!W.pickups[id].hidden) };
    f.inter.push(inter); W.pickups[id] = { f, mesh: m, inter, taken: taken, hidden: false };
    if (type !== 'note') { const gl = new T.Sprite(new T.SpriteMaterial({ map: W.glow, color: type.indexOf('key') === 0 ? 0xffe090 : 0x9ad0ff, transparent: true, opacity: 0.35, depthWrite: false, blending: T.AdditiveBlending })); gl.scale.set(0.5, 0.5, 0.5); gl.position.y = 0.08; m.add(gl); }
    return W.pickups[id];
  };
  W.takePickup = function (id) { const p = W.pickups[id]; if (!p) return; p.taken = true; p.mesh.visible = false; if (W.S.taken.indexOf(id) < 0) W.S.taken.push(id); };
  W.hidePickup = function (id, hide) { const p = W.pickups[id]; if (!p) return; p.hidden = hide; p.mesh.visible = !hide && !p.taken; };
  W.addNote = function (f, nid, x, z, y, extra) {
    const m = P.notePaper(); m.position.set(x, f.y + y, z); f.group.add(m);
    f.inter.push({ kind: 'note', x: x, y: f.y + y + 0.1, z: z, r: 2.4, data: { id: nid }, enabled: () => true });
    return m;
  };
  function wallInter(f, kind, x, y, z, data, r, en) { const it = { kind, x, y: f.y + y, z, r: r || 2.4, data: data || {}, enabled: en || (() => true) }; f.inter.push(it); return it; }

  // ---------------------------------------------------------------- room contents
  function furnish(f, r) {
    const S = W.S, N = r.back === 'N';
    switch (r.kind) {
      case 'start': {
        r.safe = true; r.safeOn = true;
        putRel(f, r, 'back', 1.4, P.bed());
        const ns = putRel(f, r, 'back', 2.45, P.nightstand());
        const lamp = P.lamp(); put(f, lamp, ns.x, ns.z, 0, { nocol: true, mut: false }); lamp.g.position.y = f.y + 0.55;
        lampLight(f, ns.x, ns.z, 1.0); r.lamp = { x: ns.x, z: ns.z };
        putRel(f, r, 'west', 3.5, P.wardrobe()); putRel(f, r, 'east', 2.2, P.bookshelf());
        const t = P.table(); putRel(f, r, 'mid', 5.5, t, { mut: true }); put(f, P.chair(), r.cx + 2.2, r.cz + (N ? 1 : -1), N ? Math.PI : 0);
        put(f, P.rug(0x35202a), r.cx - 0.5, r.cz - (N ? 0.5 : -0.5), 0, { nocol: true, mut: false });
        W.addPickup(f, 'flashlight', 'flashlight', ns.x + 0.05, ns.z + 0.08, 0.57);
        W.addNote(f, 'n1', ns.x - 0.08, ns.z - 0.04, 0.57);
        wallInter(f, 'lamp', ns.x, 0.95, ns.z, { room: r }, 2.6);
        break;
      }
      case 'bed': {
        putRel(f, r, 'back', 1.6, P.bed()); const ns = putRel(f, r, 'back', 2.7, P.nightstand());
        putRel(f, r, 'west', 3.6, P.wardrobe()); put(f, P.chair(), r.cx + 1.5, r.cz + 1, Math.PI * 0.8);
        put(f, P.rug(), r.cx + 0.5, r.cz, 0.3, { nocol: true, mut: false }); putRel(f, r, 'east', 2.5, P.bookshelf());
        roomLight(f, r, Math.random() < 0.4);
        r._ns = ns; break;
      }
      case 'living': {
        putRel(f, r, 'back', 4.0, P.sofa(Math.random() < 0.5 ? PM.fabB : PM.fabA)); putRel(f, r, 'east', 4.2, P.tv(false), { mut: true });
        put(f, P.table(), r.cx, r.cz + (N ? 1.2 : -1.2), 0); putRel(f, r, 'west', 2.0, P.bookshelf()); putRel(f, r, 'west', 5.5, P.plant());
        put(f, P.rug(0x2a3038), r.cx, r.cz + (N ? 1.2 : -1.2), 0, { nocol: true, mut: false }); roomLight(f, r, Math.random() < 0.4); break;
      }
      case 'kitchen': {
        put(f, P.table(), r.cx, r.cz, 0); put(f, P.chair(), r.cx - 0.9, r.cz, Math.PI / 2); put(f, P.chair(), r.cx + 0.9, r.cz, -Math.PI / 2);
        putRel(f, r, 'back', 1.0, P.cabinet()); putRel(f, r, 'back', 2.0, P.washer()); putRel(f, r, 'back', 3.2, P.shelf()); putRel(f, r, 'east', 3.0, P.cabinet()); roomLight(f, r, Math.random() < 0.5); break;
      }
      case 'key': { // 209: stairwell key + diary
        putRel(f, r, 'back', 1.6, P.bed()); const ns = putRel(f, r, 'back', 2.7, P.nightstand()); putRel(f, r, 'west', 3.6, P.wardrobe());
        const tb = P.table(); put(f, tb, r.cx + 1.5, r.cz + (N ? 1 : -1), 0); put(f, P.chair(), r.cx + 1.5, r.cz + (N ? 2.0 : -2.0), 0);
        W.addPickup(f, 'key_stair', 'key_stair', ns.x, ns.z, 0.58);
        W.addNote(f, 'n3', r.cx + 1.5, r.cz + (N ? 1 : -1), 0.8);
        putRel(f, r, 'east', 2.5, P.bookshelf()); roomLight(f, r, true); break;
      }
      case 'warp': {
        putRel(f, r, 'back', 1.6, P.bed()); putRel(f, r, 'back', 2.7, P.nightstand()); putRel(f, r, 'west', 3.6, P.wardrobe()); put(f, P.chair(), r.cx, r.cz, Math.PI);
        roomLight(f, r, true); break;
      }
      case 'wrong': {
        roomLight(f, r, true, 0xff2a10, 11).faulty = true;
        const w = r.x1 - r.x0 > 2;
        const ch = P.chair(); const p = rel(r, 'back', w ? r.cx - r.x0w : 1.0, ch.d); put(f, ch, p.x, p.z + (N ? 0.6 : -0.6), N ? Math.PI : 0, { mut: false });
        const sc = P.scrawl('TURN\nAROUND', w ? 3.2 : 1.8); const q = rel(r, 'back', w ? r.cx - r.x0w : 1.0, 0.02); put(f, sc, q.x, q.z + (N ? 0.06 : -0.06), q.rot, { nocol: true, mut: false });
        if (w) { const cw = P.clockWall(); const e = rel(r, 'east', 4, 0.1); put(f, cw, e.x, e.z, e.rot, { nocol: true, mut: false }); }
        const tv = P.tv(true); const wv = rel(r, 'west', w ? 5 : 1.5, tv.d); put(f, tv, wv.x, wv.z, wv.rot, { mut: false });
        break;
      }
      case 'storage': {
        for (let i = 0; i < 6; i++) { const c = P.crate(0.7 + Math.random() * 0.4); putRel(f, r, i % 2 ? 'west' : 'back', 1.2 + i * 1.1, c); }
        putRel(f, r, 'east', 1.8, P.shelf()); putRel(f, r, 'east', 4.0, P.shelf()); put(f, P.crate(1.0), r.cx + 0.5, r.cz, 0.4);
        const ps = putRel(f, r, 'east', 6.2, P.shelf());
        W.addPickup(f, 'valve', 'valve', ps.x - 0.0, ps.z - 0.0, 1.22);
        W.addPickup(f, 'bat_storage', 'battery', r.cx + 0.5, r.cz + 0.1, 1.02);
        W.addNote(f, 'n5', r.cx - 1.2, r.cz + (N ? 1.2 : -1.2), 0.02);
        roomLight(f, r, true, 0xffe0b0, 12); break;
      }
      case 'fuse': {
        const p = rel(r, 'back', 4.0, 0.18); const fb = P.fusebox(); put(f, fb, p.x, p.z, p.rot, { nocol: true, mut: false });
        r.fuse = { x: p.x, z: p.z + (N ? 0.9 : -0.9) };
        wallInter(f, 'fusebox', r.fuse.x, 1.4, r.fuse.z, { room: r }, 2.8);
        putRel(f, r, 'west', 3, P.cabinet()); putRel(f, r, 'east', 3, P.shelf()); put(f, P.desk(), r.cx + 1.6, r.cz + (N ? 2.0 : -2.0), 0); roomLight(f, r, true, 0xe8f0ff); break;
      }
      case 'laundry': {
        for (let i = 0; i < 4; i++) putRel(f, r, 'west', 1.0 + i * 1.2, P.washer());
        put(f, P.table(), r.cx + 1.4, r.cz, 0);
        W.addPickup(f, 'fuse', 'fuse', r.cx + 1.4, r.cz, 0.82);
        addScratch(f, r, 3, 'back', 5.5); roomLight(f, r, true, 0xe0ffe8); break;
      }
      case 'office': {
        r.plate = true; put(f, P.desk(), r.cx, r.cz + (N ? 0.5 : -0.5), 0); put(f, P.chair(), r.cx, r.cz + (N ? 1.4 : -1.4), 0);
        putRel(f, r, 'west', 2.0, P.cabinet()); putRel(f, r, 'west', 3.2, P.cabinet()); putRel(f, r, 'east', 2.5, P.shelf());
        W.addPickup(f, 'key_basement', 'key_basement', r.cx - 0.3, r.cz + (N ? 0.5 : -0.5), 0.82);
        roomLight(f, r, true); break;
      }
      case 'safe104': {
        putRel(f, r, 'back', 1.6, P.bed()); putRel(f, r, 'back', 2.7, P.nightstand()); putRel(f, r, 'west', 3.6, P.wardrobe());
        const sf = { g: new T.Group(), w: 0.7, d: 0.6 }; const mm = (w, h, d, m, x, y, z) => { const me = new T.Mesh(new T.BoxGeometry(w, h, d), m); me.position.set(x, y, z); me.castShadow = true; sf.g.add(me); };
        mm(0.7, 0.7, 0.6, PM.tin, 0, 0.35, 0); mm(0.4, 0.2, 0.02, PM.black, 0, 0.5, 0.31); mm(0.12, 0.12, 0.03, M2(0x20c040), 0.2, 0.2, 0.31);
        const p = putRel(f, r, 'east', 3.6, sf); r.safeObj = p;
        wallInter(f, 'safe', p.x + (p.rot > 0 ? -0.0 : 0.0) - 0.9, 0.6, p.z, { room: r }, 2.6, () => !S.flags.safe_open);
        put(f, P.chair(), r.cx, r.cz + (N ? 1.5 : -1.5), 0); roomLight(f, r, true); break;
      }
      case 'mail': {
        const mb = P.mailboxes(); const p = rel(r, 'back', 4.0, 0.2); put(f, mb, p.x, p.z, p.rot, { nocol: true, mut: false });
        putRel(f, r, 'west', 3, P.cabinet()); put(f, P.table(), r.cx + 0.8, r.cz + (N ? 1.5 : -1.5), 0);
        addScratch(f, r, 0, 'east', 3.0); W.addPickup(f, 'bat_mail', 'battery', r.cx + 0.8, r.cz + (N ? 1.5 : -1.5), 0.82); roomLight(f, r, true); break;
      }
      case 'bed102': { furnish(f, Object.assign(r, { kind: 'bed' })); addScratch(f, r, 1, 'west', 5.0); r.kind = 'bed102'; break; }
      case 'bed105': { furnish(f, Object.assign(r, { kind: 'bed' })); addScratch(f, r, 2, 'east', 5.2); r.kind = 'bed105'; break; }
      case 'booth': {
        r.safe = true; r.safeOn = true; r.plate = false;
        put(f, P.desk(), r.cx, r.z0w + 0.8, 0); const dk = f.props[f.props.length - 1];
        put(f, P.chair(), r.cx, r.z0w + 1.8, Math.PI);
        const lamp = P.lamp(); put(f, lamp, r.cx + 0.4, r.z0w + 0.8, 0, { nocol: true, mut: false }); lamp.g.position.y = f.y + 0.8;
        lampLight(f, r.cx + 0.4, r.z0w + 0.8, 1.3); r.lamp = { x: r.cx, z: r.z0w + 1.8 };
        W.addNote(f, 'n6', r.cx - 0.5, r.z0w + 0.8, 0.82);
        W.addPickup(f, 'med_booth', 'medkit', r.x0w + 0.4, r.cz, 0.02);
        wallInter(f, 'lamp', r.cx + 0.4, 1.0, r.z0w + 0.8, { room: r }, 2.8); break;
      }
      case 'archive': {
        r.plate = true;
        for (let i = 0; i < 6; i++) putRel(f, r, 'back', 1.0 + i * 0.7, P.cabinet());
        putRel(f, r, 'west', 3.0, P.shelf()); putRel(f, r, 'west', 5.5, P.shelf()); putRel(f, r, 'east', 2.0, P.shelf());
        const dk = P.desk(); put(f, dk, r.cx + 1.0, r.cz + (N ? 0.8 : -0.8), 0);
        W.addNote(f, 'n7', r.cx + 0.2, r.cz + (N ? 0.8 : -0.8), 0.83); W.addNote(f, 'n8', r.cx + 1.0, r.cz + (N ? 0.8 : -0.8), 0.83); W.addNote(f, 'n9', r.cx + 1.8, r.cz + (N ? 0.8 : -0.8), 0.83);
        const kp = W.addPickup(f, 'key_exit', 'key_exit', r.cx + 1.0, r.cz + (N ? 1.2 : -1.2), 0.77); kp.hidden = true; kp.mesh.visible = false;
        put(f, P.chair(), r.cx + 1.0, r.cz + (N ? 1.8 : -1.8), Math.PI);
        roomLight(f, r, true, 0xffd8a0, 11); break;
      }
      case 'cage': { for (let i = 0; i < 2; i++) { const p = rel(r, 'west', 2.2 + i * 3.4, 0.1); put(f, P.cage(), p.x + 1.6, p.z, p.rot + Math.PI / 2 * 0, { mut: false }); } putRel(f, r, 'back', 5.5, P.crate(0.8)); putRel(f, r, 'east', 2.5, P.shelf()); put(f, P.crate(0.8), r.cx, r.cz, 0.5); roomLight(f, r, false); break; }
      case 'cage2': { putRel(f, r, 'back', 1.5, P.shelf()); putRel(f, r, 'east', 3, P.crate(0.9)); W.addPickup(f, 'bat_cageb', 'battery', r.cx, r.cz, 0.02); put(f, P.crate(0.8), r.cx + 1, r.cz, 0.2); roomLight(f, r, false); break; }
      case 'gen': { putRel(f, r, 'back', 3.0, P.generator()); putRel(f, r, 'west', 3.0, P.locker()); putRel(f, r, 'west', 4.0, P.locker()); W.addPickup(f, 'med_gen', 'medkit', r.cx + 1.5, r.cz, 0.02); roomLight(f, r, true, 0xe8f0ff); break; }
      case 'safe': {
        r.safe = true; r.safeOn = true; putRel(f, r, 'back', 1.5, P.table()); put(f, P.chair(), r.cx - 1, r.cz, 0.5);
        const lamp = P.lamp(); const p = rel(r, 'back', 1.5, 0.8); put(f, lamp, p.x, p.z, 0, { nocol: true, mut: false }); lamp.g.position.y = f.y + 0.8;
        lampLight(f, p.x, p.z, 1.2); r.lamp = { x: r.cx, z: r.cz }; putRel(f, r, 'east', 2.0, P.locker());
        W.addPickup(f, 'bat_maint', 'battery', r.cx + 1, r.cz, 0.02); wallInter(f, 'lamp', r.cx, 0.9, r.cz, { room: r }, 3.0); break;
      }
      case 'pipes': { for (let i = 0; i < 4; i++) { const pp = P.pipe(7); const p = rel(r, 'back', 4 + i * 4.5, 0.2); put(f, pp, p.x, p.z + (N ? 0.1 : -0.1), 0, { nocol: true, mut: false }); pp.g.position.y = f.y + 2.4 - (i % 2) * 0.25; } putRel(f, r, 'west', 2, P.crate(0.9)); putRel(f, r, 'east', 3, P.shelf()); put(f, P.crate(0.8), r.cx, r.cz, 0.3); roomLight(f, r, false); break; }
      case 'boiler': {
        for (let i = 0; i < 3; i++) putRel(f, r, 'back', 4 + i * 4.2 * 2.2 / 2.2 * 1.0, P.boiler());
        const lv = rel(r, 'back', 3, 0.3); r.lever = { x: r.x0w + 25.5, z: N ? r.z0w + 1.6 : r.z1w - 1.6 };
        const lm = new T.Mesh(new T.BoxGeometry(0.1, 0.5, 0.1), PM.red); lm.position.set(r.lever.x, f.y + 1.2, r.z1w - 0.4); lm.rotation.z = 0.4; f.group.add(lm);
        const pl = new T.Mesh(new T.BoxGeometry(0.4, 0.5, 0.1), PM.metal); pl.position.set(r.lever.x, f.y + 1.2, r.z1w - 0.35); f.group.add(pl);
        r.lever = { x: r.lever.x, z: r.z1w - 1.4 }; wallInter(f, 'lever', r.lever.x, 1.2, r.lever.z, { room: r, mesh: lm }, 2.8);
        putRel(f, r, 'east', 2.0, P.generator()); put(f, P.crate(0.9), r.x0w + 3, r.cz + 1, 0.3);
        W.addPickup(f, 'key_archive', 'key_archive', r.x0w + 9.5, r.z1w - 0.6, 1.2); put(f, { g: (() => { const g = new T.Group(); const m = new T.Mesh(new T.BoxGeometry(0.5, 0.8, 0.06), PM.metal); m.position.set(0, 1.2, 0); g.add(m); return g; })(), w: 0.5, d: 0.06 }, r.x0w + 9.5, r.z1w - 0.35, 0, { nocol: true, mut: false });
        for (let i = 0; i < 5; i++) roomLight(f, { cx: r.x0w + 3 + i * 6, cz: r.cz, id: 'b' + i }, i % 2 === 0, 0xff9a60, 12).faulty = true;
        break;
      }
      default: break;
    }
    if (r.kind === 'bed' && r._ns && r.id === '201') { W.addPickup(f, 'bat_201', 'battery', r._ns.x, r._ns.z, 0.58); }
    if (r.kind === 'bed' && r.id === '212') { W.addPickup(f, 'med_212', 'medkit', r._ns.x, r._ns.z, 0.58); }
    if (r.kind === 'bed' && r.id === '210') { W.addPickup(f, 'bat_210', 'battery', r._ns.x, r._ns.z, 0.58); }
    if (r.kind === 'bed' && r.id === '105') { }
  }
  function M2(c) { return new T.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.5 }); }

  // scratched number (puzzle): n = digit index 0..3, placed on a wall
  function addScratch(f, r, n, wall, a) {
    const p = rel(r, wall, a, 0.02), dg = String(W.S.code[n]);
    const m = new T.Mesh(new T.PlaneGeometry(0.7, 0.7), new T.MeshBasicMaterial({ map: D.Tex.text(dg, { w: 128, h: 128, font: 'bold 100px', color: 'rgba(220,214,190,0.55)', family: 'Courier New, monospace' }), transparent: true, depthWrite: false, opacity: 0.9 }));
    let x = p.x, z = p.z, ry = p.rot;
    if (wall === 'back') z += r.back === 'N' ? 0.03 : -0.03; if (wall === 'west') x += 0.03; if (wall === 'east') x -= 0.03;
    m.position.set(x, f.y + 1.3, z); m.rotation.y = ry; f.group.add(m);
    wallInter(f, 'scratch', x + (wall === 'west' ? 0.9 : wall === 'east' ? -0.9 : 0), 1.3, z + (wall === 'back' ? (r.back === 'N' ? 0.9 : -0.9) : 0), { n: n, digit: dg, room: r }, 2.8);
  }

  // ---------------------------------------------------------------- specials: stairs / elevator / exit
  function buildSpecial(f, sp) {
    const dm = f.group, tz = sp.tz, cz = tz * C + C / 2;
    const bx = (w, h, d, m, x, y, z) => { const me = new T.Mesh(new T.BoxGeometry(w, h, d), m); me.position.set(x, y, z); me.castShadow = true; me.receiveShadow = true; dm.add(me); return me; };
    const sign = (txt, x, y, z, ry, w, col, bg) => { const m = new T.Mesh(new T.PlaneGeometry(w || 0.7, (w || 0.7) * 0.32), new T.MeshBasicMaterial({ map: D.Tex.text(txt, { w: 256, h: 82, font: 'bold 40px', color: col || '#7dff9a', bg: bg || '#0a140c' }) })); m.position.set(x, y, z); m.rotation.y = ry; dm.add(m); return m; };
    if (sp.kind === 'stairUp' || sp.kind === 'stairDown') {
      const fx = 4.07; // east face of tile x=1
      bx(0.14, 2.3, 1.2, Mt.doorMetal, fx, f.y + 1.15, cz); bx(0.16, 2.4, 0.08, PM.black, fx, f.y + 1.2, cz - 0.64); bx(0.16, 2.4, 0.08, PM.black, fx, f.y + 1.2, cz + 0.64); bx(0.16, 0.08, 1.36, PM.black, fx, f.y + 2.4, cz);
      sign(sp.kind === 'stairUp' ? 'STAIRS  ▲' : 'STAIRS  ▼', 4.16, f.y + 2.68, cz, Math.PI / 2, 0.8);
      sp.ax = 5; sp.az = cz; sp.arrive = { x: 5, z: cz };
      wallInter(f, 'stair', 5, 1.2, cz, sp, 2.6);
    } else if (sp.kind === 'elevator') {
      const fx = 75.93;
      bx(0.14, 2.3, 0.55, PM.metal, fx, f.y + 1.15, cz - 0.28); bx(0.14, 2.3, 0.55, PM.metal, fx, f.y + 1.15, cz + 0.28); bx(0.16, 2.4, 0.07, PM.black, fx, f.y + 1.2, cz - 0.62); bx(0.16, 2.4, 0.07, PM.black, fx, f.y + 1.2, cz + 0.62); bx(0.16, 0.08, 1.3, PM.black, fx, f.y + 2.4, cz);
      sp.lampMat = new T.MeshStandardMaterial({ color: 0x220000, emissive: 0xff2010, emissiveIntensity: 1.5 });
      const lm = new T.Mesh(new T.BoxGeometry(0.05, 0.12, 0.12), sp.lampMat); lm.position.set(75.8, f.y + 2.7, cz); dm.add(lm);
      bx(0.06, 0.16, 0.1, PM.black, 75.85, f.y + 1.2, cz + 0.85);
      sp.arrive = { x: 75, z: cz }; wallInter(f, 'elevator', 75, 1.2, cz, sp, 2.8);
    } else if (sp.kind === 'exit') {
      const fx = 75.9;
      bx(0.14, 2.5, 1.8, PM.dark, fx, f.y + 1.25, cz - 0.0); bx(0.1, 1.8, 0.7, M2b(0x0a1520), 75.86, f.y + 1.45, cz - 0.45); bx(0.1, 1.8, 0.7, M2b(0x0a1520), 75.86, f.y + 1.45, cz + 0.45);
      const ex = sign('EXIT', 75.8, f.y + 2.72, cz, -Math.PI / 2, 0.7, '#ff6050', '#200404');
      const chain = new T.Group();
      for (let i = 0; i < 3; i++) { const c = new T.Mesh(new T.CylinderGeometry(0.025, 0.025, 2.1, 6), PM.tin); c.position.set(75.7, f.y + 1.2, cz - 0.3 + i * 0.3); c.rotation.x = (i - 1) * 0.6 + 1.2; chain.add(c); }
      const lk = new T.Mesh(new T.BoxGeometry(0.12, 0.16, 0.08), PM.metal); lk.position.set(75.66, f.y + 1.1, cz); chain.add(lk); dm.add(chain); sp.chain = chain;
      sp.arrive = { x: 75, z: cz }; wallInter(f, 'exit', 75, 1.2, cz, sp, 3.0);
    }
  }
  function M2b(c) { return new T.MeshStandardMaterial({ color: c, roughness: 0.2, metalness: 0.4 }); }

  // ---------------------------------------------------------------- floor definitions
  function makeFloor(idx, S) {
    const f = newFloor(idx);
    if (idx === 2) {
      ring(f, 'corr');
      const NX = [4, 9, 14, 19, 24, 29, 34], kn = ['bed', 'warp', 'living', 'start', 'bed', 'living', 'wrong'], ks = ['living', 'key', 'bed', 'living', 'bed', 'kitchen', 'living'];
      for (let i = 0; i < 7; i++) {
        const x0 = NX[i], x1 = i < 6 ? x0 + 3 : x0 + 1;
        addRoom(f, { id: String(201 + i), x0, z0: 4, x1, z1: 7, doors: [{ x: x0 + 1, z: 8 }], back: 'N', style: 'room', kind: kn[i], warpTo: i === 1 ? '207' : null });
        addRoom(f, { id: String(208 + i), x0, z0: 11, x1, z1: 14, doors: [{ x: x0 + 1, z: 10 }], back: 'S', style: 'room', kind: ks[i] });
      }
      f.specials.push({ kind: 'stairDown', tx: 1, tz: 10, locked: 'key_stair', lockId: 'stair2' });
      f.specials.push({ kind: 'elevator', tx: 38, tz: 5 });
    } else if (idx === 1) {
      ring(f, 'corr'); carve(f, 29, 4, 37, 14, 'lobby');
      const NX = [4, 9, 14, 19, 24];
      const N = [['Storage', 'storage'], ['Fuse Room', 'fuse'], ['103', 'living'], ['Office', 'office'], ['105', 'bed105']], Sx = [['Laundry', 'laundry'], ['102', 'bed102'], ['104', 'safe104'], ['Mail Room', 'mail'], ['106', 'wrong']];
      for (let i = 0; i < 5; i++) {
        addRoom(f, { id: N[i][0], x0: NX[i], z0: 4, x1: NX[i] + 3, z1: 7, doors: [{ x: NX[i] + 1, z: 8 }], back: 'N', style: 'room', kind: N[i][1], locked: N[i][0] === 'Office' ? 'key_office' : null, doorType: (N[i][0] === 'Storage' || N[i][0] === 'Fuse Room' || N[i][0] === 'Office') ? 'metal' : 'wood', warpTo: N[i][0] === '103' ? '106' : null, label: N[i][0] === 'Office' ? 'CARETAKER' : null });
        addRoom(f, { id: Sx[i][0], x0: NX[i], z0: 11, x1: NX[i] + 3, z1: 14, doors: [{ x: NX[i] + 1, z: 10 }], back: 'S', style: 'room', kind: Sx[i][1], doorType: Sx[i][0] === 'Laundry' ? 'metal' : 'wood' });
      }
      // security booth inside the lobby (solid ring + door)
      for (let z = 5; z <= 8; z++) for (let x = 31; x <= 34; x++) f.t[z][x] = 0;
      addRoom(f, { id: 'Security', x0: 32, z0: 6, x1: 33, z1: 7, doors: [{ x: 33, z: 8 }], back: 'N', style: 'room', kind: 'booth', label: 'SECURITY', doorType: 'wood' });
      f.specials.push({ kind: 'stairUp', tx: 1, tz: 8 }, { kind: 'stairDown', tx: 1, tz: 10, locked: 'key_basement', lockId: 'stair1' }, { kind: 'elevator', tx: 38, tz: 5 }, { kind: 'exit', tx: 38, tz: 9 });
    } else {
      ring(f, 'conc');
      addRoom(f, { id: 'Archive', x0: 4, z0: 4, x1: 11, z1: 7, doors: [{ x: 8, z: 8 }], back: 'N', style: 'conc', kind: 'archive', locked: 'key_archive', doorType: 'metal', label: 'ARCHIVE' });
      addRoom(f, { id: 'Cage A', x0: 14, z0: 4, x1: 17, z1: 7, doors: [{ x: 15, z: 8 }], back: 'N', style: 'conc', kind: 'cage', doorType: 'metal', label: 'STORAGE A' });
      addRoom(f, { id: 'Maintenance', x0: 19, z0: 4, x1: 22, z1: 7, doors: [{ x: 20, z: 8 }], back: 'N', style: 'conc', kind: 'safe', doorType: 'metal', label: 'MAINT.' });
      addRoom(f, { id: 'Cage B', x0: 24, z0: 4, x1: 27, z1: 7, doors: [{ x: 25, z: 8 }], back: 'N', style: 'conc', kind: 'cage2', doorType: 'metal', label: 'STORAGE B' });
      addRoom(f, { id: 'Generator', x0: 29, z0: 4, x1: 32, z1: 7, doors: [{ x: 30, z: 8 }], back: 'N', style: 'conc', kind: 'gen', doorType: 'metal', label: 'POWER' });
      addRoom(f, { id: 'Pipe Hall', x0: 4, z0: 11, x1: 12, z1: 14, doors: [{ x: 8, z: 10 }], back: 'S', style: 'conc', kind: 'pipes', doorType: 'metal', label: 'PIPES' });
      addRoom(f, { id: 'Boiler Room', x0: 14, z0: 11, x1: 35, z1: 14, doors: [{ x: 17, z: 10 }, { x: 30, z: 10 }], back: 'S', style: 'conc', kind: 'boiler', doorType: 'metal', label: 'BOILER' });
      f.specials.push({ kind: 'stairUp', tx: 1, tz: 8 }, { kind: 'elevator', tx: 38, tz: 5 });
    }
    return f;
  }

  // ---------------------------------------------------------------- build
  W.build = function (scene, S) {
    Mt = D.Tex.mats; W.S = S; W.pickups = {}; W.floors = []; W.glow = W.glow || D.Tex.glow();
    if (W.root) scene.remove(W.root);
    W.root = new T.Group(); scene.add(W.root);
    for (let i = 0; i < 3; i++) {
      const f = makeFloor(i, S); W.floors.push(f);
      f.specials.forEach(sp => { sp.fl = f; if (sp.lockId && S.unlocked.indexOf(sp.lockId) >= 0) sp.locked = null; });
      buildShell(f); placeFixtures(f);
      f.doors.forEach(d => { if (S.unlocked.indexOf(d.id) >= 0) d.locked = null; buildDoor(f, d); });
      f.rooms.forEach(r => furnish(f, r));
      f.specials.forEach(sp => buildSpecial(f, sp));
      // board with note n2 near the stairwell (2nd floor)
      f.group.visible = false; W.root.add(f.group);
    }
    // floor-2 bulletin board on wall (x=3 tile face at x=6), z around tile 5
    (function () {
      const f = W.floors[2], bd = P.board(1.3, 0.8); bd.g.position.set(5.96, f.y, 13); bd.g.rotation.y = -Math.PI / 2; f.group.add(bd.g);
      f.inter.push({ kind: 'note', x: 5.2, y: f.y + 1.5, z: 13, r: 2.4, data: { id: 'n2' }, enabled: () => true });
      // lobby details
      const g1 = W.floors[1];
      const rc = P.reception(); put(g1, rc, 66, 24, 0, {}); W.addNote(g1, 'n4', 66.5, 24, 1.13);
      const mm = P.memorial(); put(g1, mm, 62, 8.55, 0, { nocol: true, mut: false });
      put(g1, P.sofa(PM.fabC), 74.6, 15.5, -Math.PI / 2, {}); put(g1, P.plant(), 74.4, 8.4, 0, {}); put(g1, P.plant(), 58.8, 28.8, 0, {}); put(g1, P.sofa(PM.fabB), 71, 28.6, Math.PI, {});
      // extra batteries
      W.addPickup(g1, 'bat_lobby', 'battery', 72.5, 25.5, 0.02);
      W.addPickup(W.floors[2], 'bat_208', 'battery', 11, 24.4, 0.02);
      W.addPickup(W.floors[1], 'med_103', 'medkit', 33.0, 12.0, 0.02);
      W.addPickup(W.floors[0], 'bat_pipes', 'battery', 20, 26, 0.02);
      W.addPickup(W.floors[2], 'med_204', 'medkit', 44, 12, 0.02);
    })();
    // state restore for the 'key_exit' and visibility
    if (S.flags.n9) W.hidePickup('key_exit', false);
    W.setActive(S.floor === undefined ? 2 : S.floor);
  };
  W.setActive = function (i) { W.active = i; W.floors.forEach(f => { f.group.visible = f.idx === i; }); };
  W.fl = () => W.floors[W.active];

  // gradually sicker wall colours
  W.setDistortion = function (d) {
    const sick = { wallpaper: new T.Color(0x9a5a4a), paint: new T.Color(0x7a5a5a), lobbyWall: new T.Color(0x6a3a3a), concrete: new T.Color(0x8a5a50) };
    Object.keys(sick).forEach(k => { Mt[k].color.copy(Mt.base[k]).lerp(sick[k], d * 0.55); });
  };

  // prop mutation when out of view
  W.mutate = function (f, vis, strength) {
    const list = f.props.filter(p => p.mut && !vis(p.x, f.y + 0.8, p.z));
    if (!list.length) return null;
    const p = D.pick(list), kind = Math.random();
    if (kind < 0.4) { p.g.rotation.y += (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2; }
    else if (kind < 0.7) { const dx = D.rnd(-0.6, 0.6) * (1 + strength), dz = D.rnd(-0.6, 0.6) * (1 + strength); p.g.position.x += dx; p.g.position.z += dz; if (p.col) { p.col.x0 += dx; p.col.x1 += dx; p.col.z0 += dz; p.col.z1 += dz; } }
    else if (kind < 0.85) { p.g.rotation.z = (Math.random() < 0.5 ? 1 : -1) * D.rnd(0.05, 0.25) * (1 + strength); }
    else { p.g.rotation.y = Math.atan2(0, 0) + Math.PI; }
    return p;
  };
  // wall scrawls that appear as the building degrades
  W.addScrawl = function (f, txt) {
    const spots = []; for (let z = 3; z < GD - 2; z++) for (let x = 3; x < GW - 3; x++) { if (f.t[z][x] === 1 && f.s[z][x] !== 'room' && f.t[z - 1][x] === 0 && f.t[z + 1][x] !== 0) spots.push([x, z, 'N']); }
    if (!spots.length) return null; const s = D.pick(spots), sc = P.scrawl(txt, 1.8);
    sc.g.position.set(s[0] * C + C / 2 + D.rnd(-0.4, 0.4), f.y, s[1] * C + 0.02); sc.g.rotation.y = 0; sc.g.position.z = s[1] * C + 0.03; f.group.add(sc.g); f.decals.push(sc.g); if (f.decals.length > 14) { const o = f.decals.shift(); f.group.remove(o); }
    return sc.g;
  };
})(window.DLBY);
