/* Procedural props: furniture, machines, pickups. Every builder returns {g,w,d}; front faces +Z, origin at footprint centre. */
(function (D) {
  'use strict';
  const T = THREE;
  const gc = {};
  function geo(w, h, d) { const k = w + ',' + h + ',' + d; return gc[k] || (gc[k] = new T.BoxGeometry(w, h, d)); }
  function cyl(rt, rb, h, seg) { const k = 'c' + rt + ',' + rb + ',' + h + ',' + seg; return gc[k] || (gc[k] = new T.CylinderGeometry(rt, rb, h, seg || 14)); }
  function M(color, rough, metal, em, emi) { return new T.MeshStandardMaterial({ color: color, roughness: rough === undefined ? 0.85 : rough, metalness: metal || 0, emissive: em || 0x000000, emissiveIntensity: emi || 1 }); }

  const PM = D.PM = {
    wood: M(0x4d3524), dark: M(0x2a1e15), oak: M(0x6b4a2e), fabA: M(0x5a3535), fabB: M(0x34444f), fabC: M(0x4a4a30),
    metal: M(0x6a6f72, 0.45, 0.7), rust: M(0x6e3f2a, 0.8, 0.4), white: M(0xb8b4a6), paper: M(0xd9d3bc, 0.95),
    black: M(0x0e0e10, 0.6), crate: M(0x6e5738), green: M(0x2f4a35), glass: M(0x88aacc, 0.1, 0.1),
    red: M(0x7a1515), screen: M(0x101418, 0.2, 0, 0x142030, 0.6), shade: M(0xffc880, 0.6, 0, 0xffa550, 1.8),
    bulb: M(0xfff1d0, 0.5, 0, 0xffe6b0, 2.2), pot: M(0x6a3a28), leaf: M(0x274a2a), tin: M(0x3a3d3c, 0.4, 0.8)
  };

  function box(g, w, h, d, m, x, y, z) {
    const me = new T.Mesh(geo(w, h, d), m); me.position.set(x, y, z); me.castShadow = true; me.receiveShadow = true; g.add(me); return me;
  }
  function cy(g, rt, rb, h, m, x, y, z, rx, rz, seg) {
    const me = new T.Mesh(cyl(rt, rb, h, seg), m); me.position.set(x, y, z); if (rx) me.rotation.x = rx; if (rz) me.rotation.z = rz; me.castShadow = true; me.receiveShadow = true; g.add(me); return me;
  }

  const P = D.Props = {
    bed() {
      const g = new T.Group();
      box(g, 1.1, 0.3, 2.1, PM.dark, 0, 0.25, 0); box(g, 1.0, 0.2, 1.95, PM.fabB, 0, 0.5, 0.02);
      box(g, 1.1, 0.95, 0.1, PM.wood, 0, 0.7, -1.02); box(g, 0.7, 0.14, 0.35, PM.white, 0, 0.64, -0.78);
      box(g, 0.96, 0.05, 0.9, PM.fabA, 0, 0.62, 0.45);
      return { g, w: 1.1, d: 2.1 };
    },
    nightstand() { const g = new T.Group(); box(g, 0.45, 0.55, 0.42, PM.wood, 0, 0.275, 0); box(g, 0.4, 0.02, 0.01, PM.black, 0, 0.35, 0.215); return { g, w: 0.45, d: 0.42 }; },
    wardrobe() { const g = new T.Group(); box(g, 1.3, 2.05, 0.6, PM.wood, 0, 1.02, 0); box(g, 0.02, 1.9, 0.02, PM.black, 0, 1.02, 0.31); box(g, 0.05, 0.2, 0.04, PM.metal, -0.08, 1.0, 0.32); box(g, 0.05, 0.2, 0.04, PM.metal, 0.08, 1.0, 0.32); return { g, w: 1.3, d: 0.6 }; },
    table() { const g = new T.Group(); box(g, 1.4, 0.07, 0.85, PM.oak, 0, 0.75, 0); [[-0.62, -0.36], [0.62, -0.36], [-0.62, 0.36], [0.62, 0.36]].forEach(p => box(g, 0.07, 0.72, 0.07, PM.wood, p[0], 0.36, p[1])); return { g, w: 1.4, d: 0.85 }; },
    chair() { const g = new T.Group(); box(g, 0.45, 0.06, 0.45, PM.wood, 0, 0.45, 0); box(g, 0.45, 0.5, 0.05, PM.wood, 0, 0.72, -0.2); [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]].forEach(p => box(g, 0.05, 0.45, 0.05, PM.dark, p[0], 0.22, p[1])); return { g, w: 0.45, d: 0.45 }; },
    sofa(m) { const g = new T.Group(); const f = m || PM.fabA; box(g, 2.0, 0.4, 0.9, f, 0, 0.3, 0); box(g, 2.0, 0.55, 0.22, f, 0, 0.7, -0.34); box(g, 0.2, 0.55, 0.9, f, -0.9, 0.5, 0); box(g, 0.2, 0.55, 0.9, f, 0.9, 0.5, 0); return { g, w: 2.0, d: 0.9 }; },
    tv(on) { const g = new T.Group(); box(g, 1.1, 0.45, 0.4, PM.wood, 0, 0.225, 0); box(g, 0.8, 0.5, 0.35, PM.black, 0, 0.7, 0); const s = box(g, 0.7, 0.4, 0.02, on ? M(0xcfd8e8, 1, 0, 0xaabbcc, 1.2) : PM.screen, 0, 0.7, 0.18); s.castShadow = false; return { g, w: 1.1, d: 0.4, screen: s }; },
    bookshelf() { const g = new T.Group(); box(g, 1.1, 2.0, 0.35, PM.dark, 0, 1.0, 0); for (let i = 0; i < 5; i++) { const y = 0.25 + i * 0.4; box(g, 1.0, 0.03, 0.34, PM.wood, 0, y - 0.19, 0.01); for (let k = 0; k < 7; k++) { const h = 0.22 + Math.random() * 0.12; box(g, 0.08, h, 0.2, M([0x5a2a2a, 0x2a3f55, 0x3a4a2a, 0x59502a][k % 4], 0.9), -0.43 + k * 0.13, y - 0.17 + h / 2, 0.04); } } return { g, w: 1.1, d: 0.35 }; },
    crate(s) { s = s || 0.9; const g = new T.Group(); box(g, s, s, s, PM.crate, 0, s / 2, 0); box(g, s + 0.02, 0.06, s + 0.02, PM.wood, 0, s * 0.2, 0); box(g, s + 0.02, 0.06, s + 0.02, PM.wood, 0, s * 0.8, 0); return { g, w: s, d: s }; },
    shelf() { const g = new T.Group(); [[-0.65, -0.2], [0.65, -0.2], [-0.65, 0.2], [0.65, 0.2]].forEach(p => box(g, 0.05, 2.0, 0.05, PM.metal, p[0], 1.0, p[1])); for (let i = 0; i < 4; i++) { box(g, 1.4, 0.04, 0.5, PM.metal, 0, 0.1 + i * 0.6, 0); if (Math.random() < 0.8) box(g, 0.3 + Math.random() * 0.5, 0.3, 0.3, PM.crate, -0.3 + Math.random() * 0.6, 0.27 + i * 0.6, 0); } return { g, w: 1.4, d: 0.5 }; },
    desk() { const g = new T.Group(); box(g, 1.7, 0.06, 0.8, PM.oak, 0, 0.76, 0); box(g, 0.5, 0.7, 0.7, PM.wood, 0.55, 0.38, 0); box(g, 0.06, 0.72, 0.7, PM.wood, -0.8, 0.37, 0); box(g, 0.2, 0.02, 0.28, PM.paper, -0.3, 0.8, 0.05); return { g, w: 1.7, d: 0.8 }; },
    cabinet() { const g = new T.Group(); box(g, 0.55, 1.35, 0.6, PM.tin, 0, 0.68, 0); for (let i = 0; i < 3; i++) box(g, 0.5, 0.02, 0.01, PM.black, 0, 0.35 + i * 0.4, 0.31); return { g, w: 0.55, d: 0.6 }; },
    washer() { const g = new T.Group(); box(g, 0.75, 0.95, 0.7, PM.white, 0, 0.48, 0); cy(g, 0.22, 0.22, 0.04, PM.black, 0, 0.55, 0.36, Math.PI / 2); return { g, w: 0.75, d: 0.7 }; },
    locker() { const g = new T.Group(); box(g, 0.5, 1.85, 0.5, PM.green, 0, 0.93, 0); box(g, 0.01, 1.7, 0.01, PM.black, 0, 0.93, 0.26); box(g, 0.2, 0.01, 0.01, PM.black, 0, 1.4, 0.26); return { g, w: 0.5, d: 0.5 }; },
    plant() { const g = new T.Group(); cy(g, 0.22, 0.17, 0.4, PM.pot, 0, 0.2, 0); for (let i = 0; i < 6; i++) { const a = i * 1.05; cy(g, 0.02, 0.1, 0.8, PM.leaf, Math.cos(a) * 0.14, 0.75, Math.sin(a) * 0.14, Math.sin(a) * 0.4, -Math.cos(a) * 0.4, 6); } return { g, w: 0.5, d: 0.5 }; },
    lamp() { const g = new T.Group(); cy(g, 0.07, 0.1, 0.05, PM.dark, 0, 0.025, 0); cy(g, 0.015, 0.015, 0.25, PM.dark, 0, 0.17, 0, 0, 0, 6); const s = cy(g, 0.1, 0.16, 0.2, PM.shade, 0, 0.36, 0); s.castShadow = false; return { g, w: 0.25, d: 0.25, shade: s }; },
    reception() { const g = new T.Group(); box(g, 4.0, 1.05, 0.9, PM.dark, 0, 0.53, 0); box(g, 4.1, 0.08, 1.0, PM.oak, 0, 1.08, 0); box(g, 0.3, 0.02, 0.4, PM.paper, 0.5, 1.13, 0.1); box(g, 0.4, 0.3, 0.3, PM.black, -1.0, 1.28, 0); return { g, w: 4.1, d: 1.0 }; },
    mailboxes() { const g = new T.Group(); box(g, 3.2, 1.3, 0.15, PM.metal, 0, 1.3, 0); for (let r = 0; r < 4; r++) for (let c = 0; c < 8; c++) box(g, 0.34, 0.2, 0.02, PM.tin, -1.4 + c * 0.4, 0.8 + r * 0.3, 0.09); return { g, w: 3.2, d: 0.15 }; },
    fusebox() { const g = new T.Group(); box(g, 0.7, 0.9, 0.18, PM.metal, 0, 1.4, 0); box(g, 0.6, 0.8, 0.02, PM.black, 0, 1.4, 0.1); for (let i = 0; i < 6; i++) box(g, 0.06, 0.1, 0.03, i === 3 ? PM.black : M(0xaa2020, 0.5), -0.2 + (i % 3) * 0.2, 1.55 - Math.floor(i / 3) * 0.3, 0.12); return { g, w: 0.7, d: 0.18 }; },
    boiler() { const g = new T.Group(); cy(g, 1.0, 1.0, 2.6, PM.rust, 0, 1.3, 0, 0, 0, 20); cy(g, 1.05, 1.05, 0.12, PM.metal, 0, 2.55, 0, 0, 0, 20); cy(g, 0.12, 0.12, 1.2, PM.metal, 0.5, 3.0, 0.3, 0, 0, 8); box(g, 0.5, 0.5, 0.1, PM.black, 0, 1.0, 1.0); const l = box(g, 0.2, 0.2, 0.05, M(0xff5a10, 0.5, 0, 0xff4400, 2), 0, 1.0, 1.06); l.castShadow = false; return { g, w: 2.1, d: 2.1 }; },
    generator() { const g = new T.Group(); box(g, 2.2, 1.1, 1.0, PM.green, 0, 0.65, 0); cy(g, 0.25, 0.25, 0.5, PM.tin, -0.6, 1.4, 0, 0, 0, 10); box(g, 0.4, 0.3, 0.05, PM.black, 0.5, 0.9, 0.52); return { g, w: 2.2, d: 1.0 }; },
    cage() { const g = new T.Group(); const w = 3.2, h = 2.4, d = 2.0; for (let i = 0; i <= 8; i++) { box(g, 0.03, h, 0.03, PM.metal, -w / 2 + i * w / 8, h / 2, d / 2); } box(g, w, 0.04, 0.04, PM.metal, 0, h, d / 2); box(g, w, 0.04, 0.04, PM.metal, 0, 0.6, d / 2); return { g, w: w, d: 0.1 }; },
    pipe(len) { const g = new T.Group(); cy(g, 0.09, 0.09, len, PM.rust, 0, 0, 0, 0, Math.PI / 2, 8); for (let i = 0; i < len; i += 2) cy(g, 0.12, 0.12, 0.1, PM.metal, -len / 2 + i, 0, 0, 0, Math.PI / 2, 8); return { g, w: len, d: 0.2 }; },
    rug(c) { const g = new T.Group(); const m = box(g, 2.4, 0.02, 1.6, M(c || 0x4a2020, 1), 0, 0.01, 0); m.castShadow = false; return { g, w: 2.4, d: 1.6 }; },
    clockWall() { const g = new T.Group(); for (let i = 0; i < 24; i++) { const c = new T.Mesh(cyl(0.16, 0.16, 0.03, 16), M(0xcfcab5, 0.6, 0, 0x201a10, 0.3)); c.rotation.x = Math.PI / 2; c.position.set(-1.6 + (i % 8) * 0.46, 1.1 + Math.floor(i / 8) * 0.5, 0.02); g.add(c); const h = box(g, 0.012, 0.12, 0.01, PM.black, c.position.x, c.position.y, 0.05); h.rotation.z = (i * 2.4) % 6.28; } return { g, w: 3.8, d: 0.1 }; },
    board(w, h, m) { const g = new T.Group(); box(g, w, h, 0.05, m || PM.wood, 0, 1.5, 0); for (let i = 0; i < 5; i++) { const p = box(g, 0.22, 0.3, 0.01, PM.paper, -w / 2 + 0.3 + i * (w - 0.5) / 5, 1.5 + (i % 2 ? 0.1 : -0.1), 0.03); p.rotation.z = (Math.random() - 0.5) * 0.2; } return { g, w: w, d: 0.06 }; },
    memorial() { const g = new T.Group(); box(g, 4.4, 1.7, 0.08, PM.dark, 0, 1.55, 0); for (let r = 0; r < 3; r++) for (let c = 0; c < 8; c++) { const p = box(g, 0.34, 0.42, 0.02, M(0x8a8676, 1), -1.8 + c * 0.5, 1.15 + r * 0.5, 0.05); p.castShadow = false; } return { g, w: 4.4, d: 0.1 }; },
    scrawl(txt, w, color) { const g = new T.Group(); const mt = new T.MeshBasicMaterial({ map: D.Tex.text(txt, { w: 512, h: 128, font: 'bold 64px', family: 'Courier New, monospace', color: color || '#7a1010', lh: 70 }), transparent: true, opacity: 0.85, depthWrite: false }); const m = new T.Mesh(new T.PlaneGeometry(w || 2.4, (w || 2.4) / 4), mt); m.position.set(0, 1.6, 0.01); g.add(m); return { g, w: w || 2.4, d: 0.02 }; },

    // pickups ----------------------------------------------------------
    pickupMesh(type) {
      const g = new T.Group();
      switch (type) {
        case 'flashlight': { box(g, 0.28, 0.06, 0.06, PM.black, 0, 0.03, 0); cy(g, 0.05, 0.04, 0.1, PM.metal, 0.17, 0.03, 0, 0, Math.PI / 2, 8); break; }
        case 'battery': { cy(g, 0.04, 0.04, 0.16, M(0x1c1c1c, 0.5, 0.3, 0x2a5a2a, 0.6), 0, 0.04, 0, 0, Math.PI / 2, 8); cy(g, 0.042, 0.042, 0.05, M(0xd8a020, 0.4, 0.6), 0.05, 0.04, 0, 0, Math.PI / 2, 8); break; }
        case 'medkit': { box(g, 0.34, 0.12, 0.22, PM.white, 0, 0.06, 0); box(g, 0.14, 0.125, 0.04, PM.red, 0, 0.06, 0); box(g, 0.04, 0.125, 0.14, PM.red, 0, 0.06, 0); break; }
        case 'fuse': { cy(g, 0.03, 0.03, 0.18, M(0xb0a090, 0.4, 0.2), 0, 0.04, 0, 0, Math.PI / 2, 8); box(g, 0.03, 0.04, 0.04, PM.metal, 0.1, 0.04, 0); box(g, 0.03, 0.04, 0.04, PM.metal, -0.1, 0.04, 0); break; }
        case 'valve': { cy(g, 0.14, 0.14, 0.03, PM.rust, 0, 0.04, 0, 0, 0, 14); box(g, 0.28, 0.025, 0.025, PM.rust, 0, 0.06, 0); box(g, 0.025, 0.025, 0.28, PM.rust, 0, 0.06, 0); break; }
        case 'photo': { box(g, 0.2, 0.01, 0.15, PM.paper, 0, 0.01, 0); break; }
        default: { // keys
          const col = { key_stair: 0xb0b0b8, key_office: 0xc9a23a, key_basement: 0x3a7ad0, key_archive: 0xc02020, key_exit: 0xe8c040 }[type] || 0xaaaaaa;
          const km = M(col, 0.35, 0.8, col, 0.35);
          cy(g, 0.05, 0.05, 0.015, km, 0, 0.02, 0, 0, 0, 12); box(g, 0.14, 0.012, 0.02, km, 0.1, 0.02, 0); box(g, 0.02, 0.012, 0.05, km, 0.15, 0.02, 0.02);
          if (type === 'key_basement') { box(g, 0.2, 0.01, 0.12, km, 0, 0.01, 0); }
        }
      }
      g.traverse(o => { if (o.isMesh) o.castShadow = false; });
      return g;
    },
    notePaper() { const g = new T.Group(); const p = box(g, 0.24, 0.01, 0.32, PM.paper, 0, 0.01, 0); p.castShadow = false; g.rotation.y = (Math.random() - 0.5) * 1.2; return g; }
  };
})(window.DLBY);
