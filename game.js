/* Game core: renderer, state machine, interactions, chapters, save/load, endings */
(function (D) {
  'use strict';
  const T = THREE, W = D.World, P = D.Player, Cr = D.Creature, A = D.Audio, UI = D.UI, I = D.Input, Fx = D.Fx, $ = D.$;
  const G = D.Game = { state: 'boot', S: null, noLock: false, busy: false, restT: 0, target: null, t: 0 };
  let renderer, scene, camera, spot, spotT, amb, pool = [], poolN = 5, last = 0, frustum, pm, sph, errored = false;
  let introT = 0, warpCool = 0, chkT = 0, saveT = 0, invDirty = true, dropN = 0, bobY = 0, camShake = 0, whT = 0;

  // ------------------------------------------------------------------ state
  function newState() {
    const code = [0, 1, 2, 3].map(() => 1 + Math.floor(Math.random() * 9));
    return { v: 1, seed: (Math.random() * 1e9) | 0, chapter: 1, flags: {}, inv: [], notes: [], taken: [], unlocked: [], objDone: [], digits: [], code, time: 0, floor: 2, fireT: 0, lookP: 0, p: null };
  }
  const has = t => G.S.inv.some(i => i.type === t);
  function addItem(type) {
    const S = G.S, def = D.ITEMS[type], ex = S.inv.find(i => i.type === type && i.n < def.max);
    if (ex) { ex.n++; invDirty = true; return true; }
    if (S.inv.length >= 6) return false;
    S.inv.push({ type, n: 1 }); invDirty = true; return true;
  }
  function removeItem(type) { const S = G.S, i = S.inv.findIndex(x => x.type === type); if (i < 0) return false; if (--S.inv[i].n <= 0) S.inv.splice(i, 1); invDirty = true; return true; }
  G.addItem = addItem; G.has = has;
  const endsFound = () => D.store.get('ends', {});

  // ------------------------------------------------------------------ boot / renderer
  G.boot = function () {
    let ok = true;
    try { const c = document.createElement('canvas'); ok = !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { ok = false; }
    if (!ok) { showError('WebGL is not available in this browser. Try Chrome, Edge or Firefox with hardware acceleration enabled.'); return; }
    const canvas = $('gl');
    renderer = new T.WebGLRenderer({ canvas, antialias: D.settings.quality !== 'low', powerPreference: 'high-performance' });
    renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
    scene = new T.Scene(); scene.background = new T.Color(0x000000); scene.fog = new T.FogExp2(0x040405, 0.052);
    camera = new T.PerspectiveCamera(D.settings.fov, innerWidth / innerHeight, 0.05, 150); camera.rotation.order = 'YXZ'; scene.add(camera);
    spot = new T.SpotLight(0xfff0dc, 0, 38, 0.42, 0.6, 1.7); spot.position.set(0.18, -0.12, 0.1); spotT = new T.Object3D(); spotT.position.set(0, 0, -10); camera.add(spotT); spot.target = spotT; camera.add(spot);
    spot.shadow.mapSize.set(1024, 1024); spot.shadow.bias = -0.0004; spot.shadow.camera.near = 0.2;
    amb = new T.AmbientLight(0x20233a, 1.6); scene.add(amb);
    for (let i = 0; i < 7; i++) { const l = new T.PointLight(0xffe8c0, 0, 12, 2); l.visible = false; scene.add(l); pool.push(l); }
    frustum = new T.Frustum(); pm = new T.Matrix4(); sph = new T.Sphere();
    D.Tex.init(); Fx.init(); I.init(canvas); UI.bindSettings(); applyQuality();
    addEventListener('resize', onResize); D.bus.on('settings', () => { applyQuality(); camera.fov = D.settings.fov; camera.updateProjectionMatrix(); });
    D.bus.on('key', onKey); D.bus.on('lockchange', onLock); D.bus.on('modal', m => { if (m) { G.state = 'modal'; I.enabled = false; I.clear(); } else G.resumeLock(); });
    D.bus.on('toast', m => UI.toast(m)); D.bus.on('hurt', onHurt); D.bus.on('death', () => G.die('creature'));
    window.addEventListener('beforeunload', e => { if (G.state === 'play' || G.state === 'modal') { e.preventDefault(); e.returnValue = ''; } });
    window.addEventListener('error', e => showError((e.error && e.error.stack) || e.message));
    bindMenus(); Cr.init();
    refreshMenu(); UI.hide('loading'); UI.show('menu'); G.state = 'menu'; Fx.fade(0, 1.2);
    requestAnimationFrame(loop);
  };
  function applyQuality() {
    const q = D.settings.quality, dpr = window.devicePixelRatio || 1;
    renderer.setPixelRatio(q === 'low' ? Math.min(dpr, 1) * 0.7 : q === 'medium' ? Math.min(dpr, 1.25) : Math.min(dpr, 2));
    renderer.setSize(innerWidth, innerHeight, false);
    poolN = q === 'low' ? 3 : q === 'medium' ? 5 : 7;
    const sh = q !== 'low'; if (spot.castShadow !== sh) spot.castShadow = sh; spot.shadow.mapSize.set(q === 'high' ? 1024 : 512, q === 'high' ? 1024 : 512);
    amb.intensity = 1.6 * D.settings.brightness;
  }
  function onResize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
  function showError(msg) {
    if (errored) return; errored = true; console.error(msg);
    const d = document.createElement('div'); d.style.cssText = 'position:fixed;inset:0;z-index:99;background:#000;color:#d8d2c0;padding:40px;font-family:monospace;overflow:auto;white-space:pre-wrap';
    d.innerHTML = '<h2 style="color:#b3141c">SOMETHING WENT WRONG</h2><p>The game hit an error. Reload the page and choose Continue to pick up from your last save.</p><pre style="color:#7c7766;margin-top:20px"></pre><button onclick="location.reload()" style="margin-top:20px;padding:10px 20px">RELOAD</button>';
    d.querySelector('pre').textContent = String(msg); document.body.appendChild(d);
  }

  // ------------------------------------------------------------------ menus
  function refreshMenu() {
    $('btnCont').disabled = !D.store.get('save', null);
    const e = endsFound(), n = Object.keys(e).length; $('endCount').textContent = 'Endings found: ' + n + ' / 3';
  }
  function bindMenus() {
    const btn = (id, f) => $(id).addEventListener('click', () => { A.init(); A.resume(); A.click(); f(); });
    btn('btnNew', () => { if (D.store.get('save', null) && !confirm('Start a new game? Your current save will be overwritten.')) return; G.begin(newState(), true); });
    btn('btnCont', () => { const s = D.store.get('save', null); if (s) G.begin(s, false); });
    btn('btnSet', () => { G.settingsFrom = 'menu'; UI.hide('menu'); UI.show('settings'); });
    btn('btnHelp', () => { G.helpFrom = 'menu'; UI.hide('menu'); UI.show('help'); });
    $('setBack').addEventListener('click', () => { A.click(); UI.hide('settings'); UI.show(G.settingsFrom === 'pause' ? 'pause' : 'menu'); });
    document.querySelectorAll('[data-back]').forEach(b => b.addEventListener('click', () => { A.click(); UI.hide('help'); UI.show(G.helpFrom === 'pause' ? 'pause' : 'menu'); }));
    btn('pResume', () => { UI.hide('pause'); G.resumeLock(); });
    btn('pSettings', () => { G.settingsFrom = 'pause'; UI.hide('pause'); UI.show('settings'); });
    btn('pHelp', () => { G.helpFrom = 'pause'; UI.hide('pause'); UI.show('help'); });
    btn('pMenu', () => { G.save(); G.toMenu(); });
    $('clickgo').addEventListener('click', () => { UI.hide('clickgo'); G.resumeLock(); });
    btn('dRetry', () => { const s = D.store.get('save', null); UI.hide('dead'); if (s) { s.p.hp = Math.max(s.p.hp, 70); G.begin(s, false); } else G.begin(newState(), true); });
    btn('dMenu', () => G.toMenu());
    btn('eMenu', () => G.toMenu());
    $('noteClose').addEventListener('click', () => UI.close()); $('invClose').addEventListener('click', () => UI.close()); $('jClose').addEventListener('click', () => UI.close());
    document.querySelectorAll('button').forEach(b => b.addEventListener('mouseenter', () => A.uiHover()));
  }
  G.toMenu = function () {
    G.state = 'menu'; I.enabled = false; I.unlock(); UI.close(true); Cr.despawn(); A.breathing(false); A.fire(false); A.elevator(false); A.setTension(0); A.setFear(0);
    ['hud', 'pause', 'dead', 'ending', 'clickgo', 'chapter', 'loading'].forEach(UI.hide); $('fxfade').style.opacity = 0; $('gl').style.filter = 'none';
    refreshMenu(); UI.show('menu');
  };

  // ------------------------------------------------------------------ begin / load world
  G.begin = function (S, isNew) {
    G.S = S; G.state = 'loading'; errored = false; UI.hideScreens(); UI.show('loading'); UI.progress(0.08, 'Building the building...');
    Fx.fade(0, 0.1); Cr.despawn();
    setTimeout(() => {
      try {
        UI.progress(0.35);
        S.floor = S.p ? S.p.floor : 2;
        W.build(scene, S); UI.progress(0.8, 'Turning the lights off...');
        const p = S.p;
        if (isNew || !p) P.reset({ x: 41.2, z: 11.6, floor: 2, yaw: 0 });
        else P.reset(p);
        S.p = null; G.busy = false; G.restT = 0; warpCool = 0; chkT = 0; saveT = 0; invDirty = true; S.fireT = S.fireT || 0;
        W.setActive(P.floor); W.setDistortion(D.Events.distortion(S)); D.Events.reset(); D.Events.enabled = true;
        A.setPower(!!S.flags.power); A.fire(S.fireT > 0);
        // doors where the player is standing must be open
        const f = W.floors[P.floor], tx = D.w2t(P.x), tz = D.w2t(P.z), dd = f.doorAt[tz * D.GW + tx]; if (dd) W.setDoor(dd, true, true);
        W.floors.forEach(fl => fl.rooms.forEach(r => { if (r.safe) { r.safeOn = S.chapter < 5; } }));
        introT = (!isNew && S.chapter >= 2) ? 5 : 0;
        if (S.flags.looking) { S.flags.looking = false; S.lookP = 0; }
        UI.progress(1); G.syncCamera(true);
        setTimeout(() => {
          UI.hideScreens(); UI.show('hud'); G.refreshObjective(); UI.setSlots(S);
          Fx.fade(0, 2.2); I.enabled = true; G.resumeLock();
          if (isNew) { UI.toast('You wake up. Your head is pounding. You do not remember how you got here.', 6000); setTimeout(() => G.onChapter(1, true), 1800); }
          else UI.toast('Game loaded.', 2500);
        }, 350);
      } catch (e) { showError(e.stack || e); }
    }, 60);
  };

  G.resumeLock = function () {
    G.state = 'play'; I.enabled = true; I.clear(); last = performance.now(); A.resume();
    I.lock();
    setTimeout(() => { if (G.state === 'play' && !I.locked && !G.noLock) G.pause('click'); }, 800);
  };
  G.pause = function (kind) {
    if (G.state !== 'play') return; G.state = 'paused'; I.enabled = false; I.unlock(); I.clear();
    UI.show(kind === 'click' ? 'clickgo' : 'pause'); G.save();
  };
  function onLock(locked) { if (!locked && G.state === 'play' && !G.noLock) G.pause('menu'); }

  // ------------------------------------------------------------------ save
  G.save = function () {
    if (!G.S || ['play', 'paused', 'modal'].indexOf(G.state) < 0 || P.dead) return;
    const o = JSON.parse(JSON.stringify(G.S)); o.p = { x: P.x, z: P.z, floor: P.floor, yaw: P.yaw, hp: P.hp, stamina: P.stamina, battery: P.battery, hasFlash: P.hasFlash };
    if (o.fireT > 0 || o.flags.looking || o.flags.ending) return;
    D.store.set('save', o);
  };

  // ------------------------------------------------------------------ camera, visibility
  G.syncCamera = function (force) {
    const f = W.floors[P.floor]; if (!f) return;
    if (D.settings.bob && P.moving) bobY = Math.sin(P.bob * 1.0) * (P.sprint ? 0.055 : 0.035); else bobY = D.damp(bobY, 0, 8, 0.016);
    const sh = P.shake > 0 ? P.shake * P.shake : 0;
    camera.position.set(P.x + (Math.random() - 0.5) * sh * 0.12, f.y + P.eye + bobY + (Math.random() - 0.5) * sh * 0.1, P.z);
    camera.rotation.set(P.pitch, P.yaw, P.lean + Fx.roll + (D.settings.bob && P.moving ? Math.sin(P.bob * 0.5) * 0.006 : 0));
    const fov = D.settings.fov + Fx.fovAdd + (P.sprint && P.moving ? 4 : 0);
    if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = D.damp(camera.fov, fov, 10, 0.016); camera.updateProjectionMatrix(); }
    camera.updateMatrixWorld(true); camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); frustum.setFromProjectionMatrix(pm);
  };
  // real observation test used by creature + apparitions: inside the camera frustum AND unobstructed line of sight
  G.canSee = function (x, y, z, r, fi) {
    if (fi !== P.floor) return false;
    sph.center.set(x, y, z); sph.radius = r;
    if (!frustum.intersectsSphere(sph)) return false;
    return W.los(W.floors[fi], P.x, P.z, x, z);
  };

  // ------------------------------------------------------------------ input
  function onKey(code) {
    if (code === 'Escape') { if (UI.modal()) UI.close(); return; }
    if (UI.modal()) {
      const m = UI.modal().id;
      if (code === 'KeyE' && m === 'note') UI.close();
      if (code === 'Tab' && m === 'inventory') UI.close();
      if (code === 'KeyJ' && m === 'journal') UI.close();
      return;
    }
    if (G.state !== 'play' || G.busy || G.restT > 0) return;
    if (code === 'KeyE') G.interact();
    else if (code === 'KeyF') P.toggleFlash();
    else if (code === 'KeyR') G.useBattery();
    else if (code === 'KeyH') G.useMedkit();
    else if (code === 'Tab') openInv();
    else if (code === 'KeyJ') UI.openJournal(G.S, id => { UI.close(true); G.showNote(id, true); });
  }
  function openInv() {
    UI.openInventory(G.S, {
      use: i => { const it = G.S.inv[i]; if (!it) return; if (it.type === 'battery') G.useBattery(); else if (it.type === 'medkit') G.useMedkit(); else UI.toast(D.ITEMS[it.type].desc); UI.setSlots(G.S); },
      drop: i => { const it = G.S.inv[i]; if (!it) return; if (it.type !== 'battery' && it.type !== 'medkit') { UI.toast("You can't drop that. You'll need it."); return; } removeItem(it.type); const f = W.floors[P.floor]; W.addPickup(f, 'drop_' + (++dropN) + '_' + Date.now(), it.type, P.x + Math.sin(-P.yaw) * 0.0 - Math.sin(P.yaw) * 0.8, P.z - Math.cos(P.yaw) * 0.8, 0.02); UI.setSlots(G.S); }
    });
  }
  G.useBattery = function () {
    if (!P.hasFlash) return UI.toast('You have no flashlight.');
    if (!has('battery')) return UI.toast('No spare batteries.');
    if (P.battery > 85) return UI.toast('The flashlight is still charged.');
    removeItem('battery'); P.battery = Math.min(100, P.battery + 50); A.battery(); UI.toast('Battery replaced.');
  };
  G.useMedkit = function () {
    if (!has('medkit')) return UI.toast('No medkits.');
    if (P.hp >= 100) return UI.toast('You are not hurt.');
    removeItem('medkit'); P.hp = Math.min(100, P.hp + 45); A.heal(); UI.toast('You patch yourself up.');
  };
  function onHurt(n) { Fx.flashRed(0.75); Fx.distort(0.8); camShake = 1; }

  // ------------------------------------------------------------------ interaction
  function findTarget() {
    const f = W.floors[P.floor], ey = f.y + P.eye, cp = Math.cos(P.pitch), fx = -Math.sin(P.yaw) * cp, fy = Math.sin(P.pitch), fz = -Math.cos(P.yaw) * cp;
    let best = null, bs = -9;
    for (let i = 0; i < f.inter.length; i++) {
      const it = f.inter[i]; if (it.enabled && !it.enabled()) continue;
      const dx = it.x - P.x, dy = it.y - ey, dz = it.z - P.z, d = Math.hypot(dx, dy, dz); if (d > it.r) continue;
      const dot = (dx * fx + dy * fy + dz * fz) / (d || 1); if (dot < (d < 1.1 ? 0.15 : 0.86)) continue;
      if (it.kind !== 'door' && !W.los(f, P.x, P.z, it.x, it.z)) continue;
      const sc = dot - d * 0.03 + (it.kind === 'pickup' || it.kind === 'note' ? 0.04 : 0); if (sc > bs) { bs = sc; best = it; }
    }
    return best;
  }
  function labelFor(it) {
    const S = G.S, d = it.data;
    switch (it.kind) {
      case 'door': return d.locked ? 'Locked <i>(' + D.ITEMS[d.locked].name + ')</i>' : d.open ? 'Close door' : 'Open door';
      case 'pickup': return 'Take ' + (d.type === 'flashlight' ? 'flashlight' : D.ITEMS[d.type].name.toLowerCase());
      case 'note': return 'Read';
      case 'stair': return d.locked ? 'Locked stairwell <i>(' + D.ITEMS[d.locked].name + ')</i>' : (d.kind === 'stairUp' ? 'Go upstairs' : 'Go downstairs');
      case 'elevator': return S.flags.power ? 'Use elevator' : 'Elevator (no power)';
      case 'exit': return has('key_exit') ? 'Unlock the front door' : 'Front door (chained)';
      case 'fusebox': return has('fuse') ? 'Insert fuse' : 'Fuse box (a fuse is missing)';
      case 'scratch': return 'Examine scratches';
      case 'safe': return 'Open safe (keypad)';
      case 'lever': return has('valve') ? 'Fit valve wheel and overload boiler' : 'Boiler lever (needs a valve wheel)';
      case 'lamp': return d.room.safeOn ? 'Rest in the lamplight' : 'Dead lamp';
    }
    return 'Use';
  }
  G.interact = function () {
    const it = G.target; if (!it) return; const S = G.S, d = it.data, f = W.floors[P.floor];
    switch (it.kind) {
      case 'door': {
        if (d.locked) {
          if (has(d.locked)) { removeItem(d.locked); S.unlocked.push(d.id); if (d.room.id === 'Office') S.flags.office_open = true; if (d.room.id === 'Archive') S.flags.archive_open = true; d.locked = null; A.unlock(); UI.toast('Unlocked.'); }
          else { A.locked(); UI.toast('Locked. You need the ' + D.ITEMS[d.locked].name + '.'); }
        } else if (d.open) {
          if ((D.w2t(P.x) === d.tx && D.w2t(P.z) === d.tz) || (Cr.active && Cr.floor === P.floor && D.w2t(Cr.x) === d.tx && D.w2t(Cr.z) === d.tz)) UI.toast('Something is in the way.');
          else W.setDoor(d, false);
        } else W.setDoor(d, true);
        break;
      }
      case 'pickup': {
        if (d.type === 'flashlight') { P.hasFlash = true; S.flags.has_flash = true; W.takePickup(d.id); A.pickup(); UI.toast('Flashlight. Press F to toggle it. Batteries are rare.', 4500); P.toggleFlash(true); }
        else if (addItem(d.type)) { W.takePickup(d.id); A.pickup(); UI.toast('Picked up: ' + D.ITEMS[d.type].name); }
        else UI.toast('Inventory full (6 slots). Press TAB.');
        UI.setSlots(S); break;
      }
      case 'note': G.showNote(d.id, false); return;
      case 'stair': {
        if (d.locked) {
          if (has(d.locked)) { if (d.locked === 'key_stair') removeItem('key_stair'); S.unlocked.push(d.lockId); d.locked = null; A.unlock(); UI.toast('Unlocked.'); }
          else { A.locked(); UI.toast('Locked. You need the ' + D.ITEMS[d.locked].name + '.'); break; }
        }
        G.useStairs(d); break;
      }
      case 'elevator': {
        if (S.chapter >= 5) { A.locked(); UI.toast('The doors will not open. The shaft is full of something.'); break; }
        if (!S.flags.power) { A.locked(); UI.toast('The elevator is dead. There is no power.'); break; }
        UI.openElevator(S, P.floor, to => G.rideElevator(to)); return;
      }
      case 'fusebox': {
        if (S.flags.power) { UI.toast('The power is already on.'); break; }
        if (!has('fuse')) { A.locked(); UI.toast('One fuse is missing from the box.'); break; }
        removeItem('fuse'); S.flags.power = true; A.setPower(true); A.thump(0.6); A.ding(); UI.toast('The building hums back to life.');
        W.floors.forEach(fl => fl.fixtures.forEach(fx => { fx.flick = 1.4; })); UI.setSlots(S); break;
      }
      case 'scratch': {
        if (S.digits.indexOf(d.n) < 0) S.digits.push(d.n); A.paper();
        UI.toast('Scratched into the wall: ' + d.digit + '   (' + S.digits.length + ' of 4 numbers found)', 4500); break;
      }
      case 'safe': {
        if (S.inv.length >= 6 && !S.inv.some(i => i.type === 'key_office')) { UI.toast('Make room in your inventory first.'); break; }
        UI.openKeypad(S, () => { S.flags.safe_open = true; addItem('key_office'); A.pickup(); UI.toast('Inside the safe: a brass key tagged CARETAKER.'); UI.setSlots(S); G.check(); }); return;
      }
      case 'lever': {
        if (S.fireT > 0) break;
        if (!has('valve')) { A.locked(); UI.toast('The pressure lever is missing its valve wheel.'); break; }
        if (S.chapter < 4) { UI.toast('Not yet. You do not understand this building.'); break; }
        removeItem('valve'); G.startFire(); UI.setSlots(S); break;
      }
      case 'lamp': { if (d.room.safeOn) G.rest(d.room); else UI.toast('The lamp is dead. The room is not safe.'); break; }
      case 'exit': { G.useExit(); return; }
    }
    G.check();
  };

  G.showNote = function (id, fromJournal) {
    const S = G.S; A.paper();
    if (S.notes.indexOf(id) < 0) { S.notes.push(id); S.flags[id] = true; if (id === 'n9') { W.hidePickup('key_exit', false); setTimeout(() => UI.toast('A brass key lies on the desk.', 4000), 800); } G.check(); }
    UI.openNote(id, S);
  };

  G.useStairs = function (sp) {
    if (G.busy) return; G.busy = true; const dir = sp.kind === 'stairUp' ? 1 : -1, to = P.floor + dir;
    Fx.fade(1, 0.6, () => {
      A.footstep('concrete', 0.8); setTimeout(() => A.footstep('concrete', 0.8), 350); setTimeout(() => A.footstep('concrete', 0.8), 700);
      setTimeout(() => {
        const dest = dir > 0 ? { x: 5, z: D.t2w(10) } : { x: 5, z: D.t2w(8) };
        G.setFloor(to, dest.x, dest.z, -Math.PI / 2); Fx.fade(0, 0.9); G.busy = false; G.check();
      }, 1000);
    });
  };
  G.setFloor = function (fi, x, z, yaw) {
    P.floor = fi; P.x = x; P.z = z; P.yaw = yaw; P.pitch = 0; P.vx = P.vz = 0; W.setActive(fi); G.S.floor = fi;
    if (fi === 1) G.S.flags.reached_f1 = true; if (fi === 0) G.S.flags.reached_b = true;
    if (Cr.active && Cr.floor === fi && Cr.transit === null) Cr.attach(fi);
    G.syncCamera(true); G.save();
  };
  G.rideElevator = function (to) {
    if (G.busy) return; G.busy = true; const S = G.S;
    Fx.fade(1, 0.5, () => {
      A.elevator(true); UI.toast('The elevator groans...', 2500);
      const fl = W.floors[P.floor]; let stall = S.chapter >= 3 && Math.random() < 0.4;
      setTimeout(() => { if (stall) { A.thump(1); A.duck(2.5); Fx.distort(2.5); fl.fixtures.forEach(x => x.flick = 2); } }, 1400);
      setTimeout(() => {
        A.elevator(false); A.ding(); S.flags.used_elevator = true;
        const z = D.t2w(5); G.setFloor(to, 75, z, Math.PI / 2); Fx.fade(0, 0.8); G.busy = false; G.check();
      }, stall ? 4200 : 3000);
    });
  };
  G.rest = function (room) {
    const S = G.S; if (G.restT > 0) return; G.restT = 7; G.restRoom = room; Fx.fade(0.55, 1.2); UI.toast('You rest in the lamplight...', 3000); P.flash = false;
    A.heal();
  };
  function restTick(dt) {
    const S = G.S, r = G.restRoom; G.restT -= dt; P.hp = Math.min(100, P.hp + 7 * dt); P.stamina = 100;
    if (S.chapter >= 3 && Math.random() < dt * 0.07 * (S.chapter - 2)) {
      G.restT = 0; r.safeOn = false; setTimeout(() => { if (S.chapter < 5) r.safeOn = true; }, 75000);
      W.floors[P.floor].fixtures.forEach(fx => { if (fx.kind === 'lamp' && Math.hypot(fx.x - r.lamp.x, fx.z - r.lamp.z) < 6) { fx.out = 75; fx.flick = 0.8; } });
      A.thump(1); A.stinger(1); Fx.fade(0, 0.3); UI.toast('The lamp dies. It knows you are here.', 4000); Fx.distort(1.5); return;
    }
    if (G.restT <= 0) { Fx.fade(0, 1.2); G.save(); UI.toast('You feel steadier. Game saved.'); }
  }

  // ------------------------------------------------------------------ story flow
  G.refreshObjective = function () { const o = D.Story.objective(G.S); UI.objective(o ? o.text : 'Survive.'); };
  G.check = function () {
    const S = G.S, r = D.Story.check(S);
    r.done.forEach(o => { if (!(G.S.chapter === 1 && o.id === 'flash' && G.t < 3)) UI.toast('OBJECTIVE COMPLETE: ' + o.text, 3000); });
    if (r.advanced) G.onChapter(S.chapter);
    G.refreshObjective();
  };
  G.onChapter = function (n, first) {
    const S = G.S, c = D.Story.chapters[n - 1]; UI.chapterCard(n, c.title, c.sub); A.chapter();
    if (n === 2) introT = 9;
    if (n >= 3) S.flags.warp_on = true;
    if (n === 5) { W.floors.forEach(fl => fl.rooms.forEach(r => { if (r.safe) r.safeOn = false; })); W.floors.forEach(fl => fl.fixtures.forEach(fx => { if (fx.kind === 'lamp') fx.out = 9999; })); UI.toast('The lamps have gone out. Nowhere is safe now.', 4500); }
    W.setDistortion(D.Events.distortion(S)); G.refreshObjective();
    if (!first) G.save();
  };
  G.spawnCreature = function () {
    const f = W.floors[P.floor], ptx = D.w2t(P.x), ptz = D.w2t(P.z);
    for (let i = 0; i < 60; i++) {
      const c = W.randomTile(f, (x, z) => f.s[z][x] !== 'room' && Math.abs(x - ptx) + Math.abs(z - ptz) >= 26 && !f.rm[z][x]);
      if (c && W.path(f, c[0], c[1], ptx, ptz)) { Cr.spawn(P.floor, c[0], c[1]); Cr.silent = false; return true; }
    }
    return false;
  };

  // ------------------------------------------------------------------ endgame
  G.startFire = function () {
    const S = G.S; S.fireT = 110; A.fire(true); A.thump(1); A.stinger(1); Fx.distort(3); $('fireTimer').classList.remove('hidden');
    UI.toast('The boiler screams. THE BUILDING IS GOING TO BLOW. Get to the front door!', 6000);
    W.floors.forEach(fl => fl.fixtures.forEach(fx => { fx.flick = 2; })); if (!Cr.active) G.spawnCreature(); S.flags.fire = true;
  };
  G.useExit = function () {
    const S = G.S;
    if (!has('key_exit')) { A.locked(); UI.toast('The doors are chained from the outside. There is a padlock. You need a key.'); return; }
    if (S.fireT > 0) { G.ending('ash'); return; }
    const opts = [{ text: 'Open the door and leave', cb: () => G.ending('run') }];
    if (S.notes.length >= 7) opts.push({ text: 'Turn around', cb: () => G.startLook() });
    opts.push({ text: 'Not yet', cb: null });
    UI.openChoice('THE FRONT DOOR', S.notes.length >= 7 ? 'The padlock is open. Behind you, in the dark of the lobby, you can feel them waiting. You remember everything now.' : 'The padlock clicks open. Cold air touches your face. Behind you, something is very still.', opts);
  };
  G.startLook = function () {
    const S = G.S; S.flags.looking = true; S.lookP = 0; D.Events.enabled = false; $('gaze').classList.remove('hidden');
    P.yaw = Math.PI / 2; P.pitch = 0; Cr.spawn(1, 30, 9); Cr.stun = 0; W.floors[1].fixtures.forEach(fx => { fx.flick = 3; }); A.stinger(1); A.whisper(-0.7); Fx.distort(2);
    UI.toast('Turn around. Keep it in your sight. Do not look away.', 5500);
  };
  function lookTick(dt) {
    const S = G.S; whT -= dt;
    if (Cr.observed && Cr.dist < 45) S.lookP += dt; else S.lookP = Math.max(0, S.lookP - dt * 0.35);
    $('gazeBar').style.width = D.clamp(S.lookP / 14 * 100, 0, 100) + '%';
    if (whT <= 0) { whT = 3.2; A.whisper(Math.random() < 0.5 ? -0.8 : 0.8); W.floors[1].fixtures.forEach(fx => { if (Math.random() < 0.3) fx.flick = 0.4; }); }
    Cr.parts.glow.material.opacity = 0.55 + D.clamp(S.lookP / 14, 0, 1) * 0.45; Cr.parts.glow.scale.setScalar(0.9 + S.lookP / 14 * 2.2);
    if (S.lookP >= 14) G.ending('look');
  }
  G.ending = function (kind) {
    const S = G.S; if (G.state === 'ending') return;
    S.flags.ending = kind; G.state = 'ending'; I.enabled = false; I.unlock(); UI.close(true); $('gaze').classList.add('hidden'); $('fireTimer').classList.add('hidden');
    const e = D.Story.endings[kind]; D.Events.enabled = false;
    Fx.fade(1, kind === 'look' ? 3.5 : 2.2, () => {
      Cr.despawn(); A.fire(false); A.breathing(false); A.setFear(0);
      $('endTitle').textContent = e.title; $('endText').textContent = e.text;
      const m = Math.floor(S.time / 60), s = Math.floor(S.time % 60);
      $('endStats').textContent = 'NOTES FOUND ' + S.notes.length + ' / ' + D.Story.totalNotes + '     TIME SURVIVED ' + m + ':' + (s < 10 ? '0' : '') + s;
      const ends = endsFound(); ends[kind] = true; D.store.set('ends', ends); D.store.del('save');
      ['hud', 'chapter'].forEach(UI.hide); $('gl').style.filter = 'none'; UI.show('ending'); Fx.fade(0, 1.5);
    }, kind === 'look' ? '#fff' : kind === 'ash' ? '#3a0c00' : '#000');
  };
  G.die = function (cause) {
    if (G.state === 'dead' || G.state === 'ending') return;
    G.state = 'dead'; I.enabled = false; I.unlock(); UI.close(true); $('gaze').classList.add('hidden'); $('fireTimer').classList.add('hidden');
    A.screech(1); A.fire(false); A.breathing(false); Fx.flashRed(1);
    $('deadTitle').textContent = cause === 'fire' ? 'THE BUILDING TOOK YOU' : 'YOU LOOKED AWAY';
    $('deadText').textContent = cause === 'fire' ? 'The boiler went. So did everything else.' : 'It only moves when you are not looking. You forgot for just a moment.';
    Fx.fade(1, 1.6, () => { UI.hide('hud'); $('gl').style.filter = 'none'; UI.show('dead'); Fx.fade(0, 1.2); });
  };

  // ------------------------------------------------------------------ simulation
  function simulate(dt) {
    const S = G.S, f = W.floors[P.floor]; G.t += dt; S.time += dt; saveT += dt;
    const can = !G.busy && G.restT <= 0;
    P.update(dt, can); G.syncCamera();
    // flashlight
    const flick = P.flash && P.battery < 15 ? (Math.random() < 0.12 ? 0.15 : 0.85) : 1;
    spot.visible = P.flash; spot.intensity = P.flash ? 240 * flick * D.settings.brightness : 0;
    if (P.flash) { spotT.position.x = Math.sin(performance.now() / 900) * 0.15; spotT.position.y = Math.cos(performance.now() / 1300) * 0.1; }

    W.updateDoors(dt);
    if (G.restT > 0) restTick(dt);
    if (introT > 0) { introT -= dt; if (introT <= 0) { if (!G.spawnCreature()) introT = 3; else { A.stinger(0.6); } } }
    Cr.update(dt, S); Cr.syncMesh && 0;
    D.Events.update(dt, S);
    W.updateLights(dt, P.x, P.z, pool.slice(0, poolN), !!S.flags.power, S.fireT > 0);

    // triggers
    const tx = D.w2t(P.x), tz = D.w2t(P.z);
    if (P.floor === 2 && f.s[tz] && f.s[tz][tx] === 'corr' && !S.flags.left_apt) { S.flags.left_apt = true; G.check(); }
    warpCool -= dt;
    if (S.flags.warp_on && warpCool <= 0 && !G.busy && f.rm[tz] && f.t[tz][tx] === 1) {
      const r = f.rm[tz][tx];
      if (r && r.warpTo) {
        const tr = W.roomById(f, r.warpTo);
        if (tr) { const dd = tr.doorsObj[0]; P.x = D.t2w(dd.tx); P.z = D.t2w(dd.tz + (tr.back === 'N' ? -1 : 1)); P.yaw = tr.back === 'N' ? Math.PI : 0; warpCool = 5; Fx.flashWhite(0.85); A.stinger(0.8); Fx.distort(1.4); UI.toast('This is not the room you walked into.', 3500); }
      }
    }
    if (S.fireT > 0) { S.fireT -= dt; const m = Math.floor(S.fireT / 60), s = Math.floor(S.fireT % 60); $('fireTimer').textContent = 'BOILER  ' + m + ':' + (s < 10 ? '0' : '') + s; if (Math.random() < dt * 1.2) Fx.distort(0.3); if (S.fireT <= 0) G.die('fire'); }
    if (S.flags.looking) lookTick(dt);

    // interaction target
    G.target = can ? findTarget() : null;
    UI.prompt(G.target ? '<b>E</b>' + labelFor(G.target) : '');
    chkT -= dt; if (chkT <= 0) { chkT = 0.5; G.check(); }
    if (saveT > 25) { saveT = 0; G.save(); }

    // audio + effects state
    A.listener(P.x, f.y + P.eye, P.z, P.yaw);
    const fear = Cr.active ? (Cr.fear || 0) : 0; A.setFear(fear); A.setTension(fear * (Cr.observed ? 1 : 0.6));
    A.update(dt);
    Fx.update(dt, fear, P.hp / 100, S.distortion || 0);
    // HUD
    UI.setBars(P, S); $('floorlbl').textContent = D.FLOOR_NAMES[P.floor]; if (invDirty) { UI.setSlots(S); invDirty = false; }
    // fog darkens with distortion; reddens with fire
    const fd = S.fireT > 0 ? 0.07 : 0.052 + (S.distortion || 0) * 0.012; scene.fog.density = D.damp(scene.fog.density, fd, 2, dt);
    scene.fog.color.setRGB(S.fireT > 0 ? 0.12 : 0.016 + (S.distortion || 0) * 0.02, 0.016, 0.02);
  }

  function loop(t) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, (t - last) / 1000 || 0); last = t;
    try {
      if (G.state === 'play') simulate(dt);
      else if (G.state === 'modal' || G.state === 'paused' || G.state === 'dead' || G.state === 'ending') { G.syncCamera(); Fx.update(dt, 0.2, G.S ? P.hp / 100 : 1, 0); }
      if (W.floors.length && G.S && G.state !== 'menu' && G.state !== 'loading' && !G.debug.noRender) renderer.render(scene, camera);
      I.endFrame();
    } catch (e) { showError(e.stack || e); }
  }

  // ------------------------------------------------------------------ test hooks
  G.debug = {
    noRender: false,
    step(n, dt) { for (let i = 0; i < n; i++) { if (G.state !== 'play') break; simulate(dt || 0.05); I.endFrame(); } return G.state; },
    target() { return G.target ? { kind: G.target.kind, label: labelFor(G.target) } : null; },
    face(x, z, y) { const f = W.floors[P.floor]; const dx = x - P.x, dz = z - P.z, dy = (y === undefined ? f.y + 1 : y) - (f.y + P.eye); P.yaw = Math.atan2(-dx, -dz); P.pitch = Math.atan2(dy, Math.hypot(dx, dz)); },
    findInter(kind, pred) { const f = W.floors[P.floor]; return f.inter.find(i => i.kind === kind && (!pred || pred(i))); },
    tp(fi, tx, tz, yaw) { G.setFloor(fi, D.t2w(tx), D.t2w(tz), yaw || 0); },
    tpw(fi, x, z, yaw) { G.setFloor(fi, x, z, yaw || 0); },
    give(type) { return addItem(type); },
    chapter(n) { G.S.chapter = n; G.onChapter(n); },
    scene: () => scene, camera: () => camera, renderer: () => renderer, pool: () => pool, spot: () => spot
  };
  addEventListener('DOMContentLoaded', () => { try { G.boot(); } catch (e) { showError(e.stack || e); } });
})(window.DLBY);
