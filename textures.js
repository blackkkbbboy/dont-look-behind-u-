/* Procedural textures + materials (no image files needed) */
(function (D) {
  'use strict';
  const T = THREE;

  function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function grain(ctx, w, h, amt) {
    for (let i = 0; i < w * h / 5; i++) {
      const v = Math.random() * 255 | 0;
      ctx.fillStyle = 'rgba(' + v + ',' + v + ',' + v + ',' + (amt * Math.random()).toFixed(3) + ')';
      ctx.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2);
    }
  }
  function stains(ctx, w, h, n, rgb, a) {
    for (let i = 0; i < n; i++) {
      const x = Math.random() * w, y = Math.random() * h, r = 12 + Math.random() * 60;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(' + rgb + ',' + (a * Math.random()).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(' + rgb + ',0)');
      ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }
  function tex(c, rx, ry, srgb) {
    const t = new T.CanvasTexture(c);
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.repeat.set(rx || 1, ry || 1);
    if (srgb !== false) t.colorSpace = T.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }

  const B = {
    wallpaper() {
      const c = cv(256, 256), x = c.getContext('2d');
      x.fillStyle = '#7a7058'; x.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 256; i += 32) { x.fillStyle = 'rgba(40,30,10,0.22)'; x.fillRect(i, 0, 10, 256); x.fillStyle = 'rgba(200,190,150,0.10)'; x.fillRect(i + 14, 0, 4, 256); }
      for (let yy = 8; yy < 170; yy += 32) for (let xx = 4; xx < 256; xx += 32) { x.fillStyle = 'rgba(60,45,25,0.25)'; x.beginPath(); x.moveTo(xx + 5, yy); x.lineTo(xx + 10, yy + 6); x.lineTo(xx + 5, yy + 12); x.lineTo(xx, yy + 6); x.fill(); }
      x.fillStyle = '#2d1f14'; x.fillRect(0, 175, 256, 81);                       // wainscot
      x.fillStyle = '#4a3420'; x.fillRect(0, 170, 256, 7);
      for (let i = 0; i < 256; i += 64) { x.strokeStyle = 'rgba(0,0,0,0.5)'; x.strokeRect(i + 6, 186, 52, 62); }
      stains(x, 256, 256, 14, '30,20,8', 0.35); grain(x, 256, 256, 0.18);
      return tex(c);
    },
    paint() {
      const c = cv(256, 256), x = c.getContext('2d');
      x.fillStyle = '#6d7a69'; x.fillRect(0, 0, 256, 256);
      x.fillStyle = '#3d4a3d'; x.fillRect(0, 215, 256, 41);
      x.fillStyle = '#25302a'; x.fillRect(0, 211, 256, 5);
      stains(x, 256, 256, 22, '20,25,15', 0.4);
      for (let i = 0; i < 10; i++) { x.fillStyle = 'rgba(210,205,190,0.18)'; x.beginPath(); x.ellipse(Math.random() * 256, Math.random() * 200, 5 + Math.random() * 14, 3 + Math.random() * 8, Math.random() * 3, 0, 7); x.fill(); }
      grain(x, 256, 256, 0.2);
      return tex(c);
    },
    lobbyWall() {
      const c = cv(256, 256), x = c.getContext('2d');
      x.fillStyle = '#4a4c44'; x.fillRect(0, 0, 256, 256);
      x.fillStyle = '#2a2b27'; x.fillRect(0, 150, 256, 106);
      x.fillStyle = '#7d6f44'; x.fillRect(0, 146, 256, 5);
      for (let i = 0; i < 256; i += 64) { x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(i, 0, 3, 150); }
      stains(x, 256, 256, 16, '15,15,10', 0.35); grain(x, 256, 256, 0.16);
      return tex(c);
    },
    concrete() {
      const c = cv(256, 256), x = c.getContext('2d');
      x.fillStyle = '#5b5d5d'; x.fillRect(0, 0, 256, 256);
      x.fillStyle = '#3f4a47'; x.fillRect(0, 130, 256, 126);
      x.fillStyle = '#272f2d'; x.fillRect(0, 126, 256, 5);
      stains(x, 256, 256, 26, '10,10,10', 0.4);
      stains(x, 256, 256, 6, '90,45,20', 0.3);
      x.strokeStyle = 'rgba(0,0,0,0.45)'; x.lineWidth = 1;
      for (let i = 0; i < 5; i++) { x.beginPath(); let px = Math.random() * 256, py = Math.random() * 120; x.moveTo(px, py); for (let k = 0; k < 6; k++) { px += Math.random() * 18 - 9; py += Math.random() * 18; x.lineTo(px, py); } x.stroke(); }
      grain(x, 256, 256, 0.3);
      return tex(c);
    },
    carpet() {
      const c = cv(256, 256), x = c.getContext('2d');
      x.fillStyle = '#3a1e1c'; x.fillRect(0, 0, 256, 256);
      for (let yy = 0; yy < 256; yy += 32) for (let xx = 0; xx < 256; xx += 32) {
        x.fillStyle = 'rgba(120,70,40,0.25)'; x.beginPath(); x.moveTo(xx + 16, yy + 3); x.lineTo(xx + 29, yy + 16); x.lineTo(xx + 16, yy + 29); x.lineTo(xx + 3, yy + 16); x.fill();
        x.fillStyle = 'rgba(0,0,0,0.25)'; x.beginPath(); x.arc(xx + 16, yy + 16, 4, 0, 7); x.fill();
      }
      x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(0, 0, 18, 256); x.fillRect(238, 0, 18, 256);
      stains(x, 256, 256, 10, '0,0,0', 0.4); grain(x, 256, 256, 0.3);
      return tex(c);
    },
    wood() {
      const c = cv(256, 256), x = c.getContext('2d');
      for (let i = 0; i < 8; i++) { const l = 28 + Math.random() * 14; x.fillStyle = 'hsl(26,' + (35 + Math.random() * 12) + '%,' + l + '%)'; x.fillRect(i * 32, 0, 32, 256); x.fillStyle = 'rgba(0,0,0,0.6)'; x.fillRect(i * 32, 0, 2, 256); }
      for (let i = 0; i < 12; i++) { x.fillStyle = 'rgba(0,0,0,0.5)'; x.fillRect(Math.floor(Math.random() * 8) * 32, Math.random() * 256, 32, 2); }
      stains(x, 256, 256, 10, '0,0,0', 0.35); grain(x, 256, 256, 0.25);
      return tex(c);
    },
    tile() {
      const c = cv(256, 256), x = c.getContext('2d');
      for (let yy = 0; yy < 4; yy++) for (let xx = 0; xx < 4; xx++) { x.fillStyle = (xx + yy) % 2 ? '#8e8c7c' : '#4d4c44'; x.fillRect(xx * 64, yy * 64, 64, 64); }
      x.strokeStyle = 'rgba(0,0,0,0.6)'; x.lineWidth = 2;
      for (let i = 0; i <= 256; i += 64) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 256); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(256, i); x.stroke(); }
      stains(x, 256, 256, 14, '20,10,5', 0.4); grain(x, 256, 256, 0.25);
      return tex(c);
    },
    concFloor() {
      const c = cv(256, 256), x = c.getContext('2d');
      x.fillStyle = '#48494a'; x.fillRect(0, 0, 256, 256);
      stains(x, 256, 256, 24, '0,0,0', 0.45); stains(x, 256, 256, 5, '70,30,15', 0.35);
      x.strokeStyle = 'rgba(0,0,0,0.5)'; x.strokeRect(1, 1, 254, 254);
      grain(x, 256, 256, 0.35);
      return tex(c);
    },
    ceiling() {
      const c = cv(256, 256), x = c.getContext('2d');
      x.fillStyle = '#8f8d82'; x.fillRect(0, 0, 256, 256);
      x.strokeStyle = 'rgba(0,0,0,0.5)'; x.lineWidth = 3;
      for (let i = 0; i <= 256; i += 128) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 256); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(256, i); x.stroke(); }
      stains(x, 256, 256, 14, '60,45,10', 0.45); grain(x, 256, 256, 0.2);
      return tex(c);
    },
    doorWood() {
      const c = cv(128, 256), x = c.getContext('2d');
      x.fillStyle = '#5a3a22'; x.fillRect(0, 0, 128, 256);
      x.strokeStyle = 'rgba(0,0,0,0.55)'; x.lineWidth = 3;
      x.strokeRect(14, 14, 100, 90); x.strokeRect(14, 120, 100, 122);
      x.fillStyle = 'rgba(255,220,170,0.07)'; x.fillRect(16, 16, 96, 86); x.fillRect(16, 122, 96, 118);
      x.fillStyle = '#b8a05a'; x.beginPath(); x.arc(108, 130, 6, 0, 7); x.fill();
      stains(x, 128, 256, 8, '0,0,0', 0.35); grain(x, 128, 256, 0.25);
      return tex(c);
    },
    doorMetal() {
      const c = cv(128, 256), x = c.getContext('2d');
      x.fillStyle = '#585e5a'; x.fillRect(0, 0, 128, 256);
      x.fillStyle = 'rgba(0,0,0,0.25)'; for (let i = 20; i < 256; i += 36) x.fillRect(0, i, 128, 3);
      x.fillStyle = '#2d302e'; x.fillRect(100, 118, 10, 22);
      x.fillStyle = '#a02020'; x.fillRect(30, 30, 68, 20);
      stains(x, 128, 256, 12, '70,30,10', 0.35); grain(x, 128, 256, 0.3);
      return tex(c);
    }
  };

  const M = {};
  D.Tex = {
    mats: M,
    init() {
      const S = (map, o) => new T.MeshStandardMaterial(Object.assign({ map: map, roughness: 0.92, metalness: 0.02 }, o || {}));
      M.wallpaper = S(B.wallpaper());
      M.paint = S(B.paint());
      M.lobbyWall = S(B.lobbyWall());
      M.concrete = S(B.concrete());
      M.carpet = S(B.carpet());
      M.wood = S(B.wood(), { roughness: 0.6 });
      M.tile = S(B.tile(), { roughness: 0.35 });
      M.concFloor = S(B.concFloor());
      M.ceiling = S(B.ceiling());
      M.doorWood = S(B.doorWood(), { roughness: 0.7 });
      M.doorMetal = S(B.doorMetal(), { roughness: 0.55, metalness: 0.5 });
      M.base = {};
      ['wallpaper', 'paint', 'lobbyWall', 'concrete'].forEach(k => { M.base[k] = M[k].color.clone(); });
    },
    // Text on a canvas -> texture (door plates, scrawled writing)
    text(str, o) {
      o = o || {};
      const w = o.w || 256, h = o.h || 128, c = cv(w, h), x = c.getContext('2d');
      if (o.bg) { x.fillStyle = o.bg; x.fillRect(0, 0, w, h); }
      x.fillStyle = o.color || '#ddd';
      x.font = (o.font || 'bold 56px') + ' ' + (o.family || 'Georgia, serif');
      x.textAlign = 'center'; x.textBaseline = 'middle';
      const lines = String(str).split('\n');
      lines.forEach((ln, i) => x.fillText(ln, w / 2, h / 2 + (i - (lines.length - 1) / 2) * (o.lh || 60)));
      if (o.noise) grain(x, w, h, 0.2);
      const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
    },
    glow() {
      const c = cv(64, 64), x = c.getContext('2d');
      const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(210,225,255,0.45)'); g.addColorStop(1, 'rgba(120,150,255,0)');
      x.fillStyle = g; x.fillRect(0, 0, 64, 64);
      const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
    }
  };
})(window.DLBY);
