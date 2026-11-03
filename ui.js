/* Menus, HUD, modals */
(function (D) {
  'use strict';
  const $ = D.$;
  const ITEMS = {
    battery: { name: 'Battery', max: 3, desc: 'Restores 50% flashlight charge. [R]' },
    medkit: { name: 'Medkit', max: 2, desc: 'Heals 45 health. [H]' },
    key_stair: { name: 'Stairwell Key', max: 1, desc: 'Opens the 2nd floor stairwell door.' },
    fuse: { name: 'Fuse', max: 1, desc: 'A ceramic fuse. The building lost power.' },
    valve: { name: 'Valve Wheel', max: 1, desc: 'Fits a boiler pressure valve.' },
    key_office: { name: 'Office Key', max: 1, desc: "Brass key tagged CARETAKER." },
    key_basement: { name: 'Basement Keycard', max: 1, desc: 'Opens the basement stairs and elevator.' },
    key_archive: { name: 'Red Archive Key', max: 1, desc: 'Opens the basement Archive.' },
    key_exit: { name: 'Brass Key', max: 1, desc: 'Unlocks the chains on the front door.' }
  };
  D.ITEMS = ITEMS;
  let toastT = null, modal = null, cardT = null;

  const UI = D.UI = {
    modal: () => modal,
    show(id) { $(id).classList.remove('hidden'); },
    hide(id) { $(id).classList.add('hidden'); },
    hideScreens() { ['loading', 'menu', 'help', 'settings', 'pause', 'dead', 'ending', 'clickgo'].forEach(UI.hide); },
    toast(msg, ms) { const t = $('toast'); t.textContent = msg; t.style.opacity = 1; clearTimeout(toastT); toastT = setTimeout(() => { t.style.opacity = 0; }, ms || 3200); },
    prompt(html) { $('prompt').innerHTML = html || ''; },
    objective(text) { $('objText').textContent = text || ''; },
    progress(p, tip) { $('loadBar').style.width = (p * 100) + '%'; if (tip) $('loadTip').textContent = tip; },
    chapterCard(n, title, sub) {
      const c = $('chapter'); $('cNum').textContent = 'CHAPTER ' + n; $('cTitle').textContent = title; $('cSub').textContent = sub;
      c.classList.remove('hidden'); c.classList.remove('show'); void c.offsetWidth; c.classList.add('show');
      clearTimeout(cardT); cardT = setTimeout(() => { c.classList.add('hidden'); c.classList.remove('show'); }, 6200);
    },
    setBars(P, S) {
      $('hpBar').style.width = P.hp + '%'; $('stBar').style.width = P.stamina + '%'; $('stBar').style.opacity = P.exhausted ? 0.45 : 1;
      $('baBar').style.width = P.battery + '%'; $('baBar').parentNode.style.display = P.hasFlash ? 'block' : 'none';
    },
    setSlots(S) {
      const el = $('slots'); let h = '';
      for (let i = 0; i < 6; i++) { const it = S.inv[i]; h += it ? '<div class="slot" title="' + ITEMS[it.type].name + '">' + short(it.type) + (it.n > 1 ? '<b>' + it.n + '</b>' : '') + '</div>' : '<div class="slot" style="opacity:.25"></div>'; }
      el.innerHTML = h;
    },

    // ---- modal helpers
    open(id, onClose) { UI.close(true); modal = { id, onClose }; UI.show(id); D.bus.emit('modal', true); D.Input.unlock(); },
    close(silent) { if (!modal) return; const m = modal; modal = null; UI.hide(m.id); if (m.onClose) m.onClose(); if (!silent) D.bus.emit('modal', false); },

    openNote(id, S) {
      const n = D.Story.notes[id]; $('noteTitle').textContent = n.title; $('noteBy').textContent = n.by; $('noteText').textContent = n.text;
      UI.open('note');
    },
    openInventory(S, act) {
      const render = () => {
        $('invCount').textContent = '(' + S.inv.length + '/6)';
        let h = ''; for (let i = 0; i < 6; i++) { const it = S.inv[i]; h += it ? '<div class="item" data-i="' + i + '"><b>' + (it.n > 1 ? 'x' + it.n : '') + '</b>' + ITEMS[it.type].name + '<small>' + ITEMS[it.type].desc + '</small><span class="drop" data-d="' + i + '">DROP</span></div>' : '<div class="item empty">empty</div>'; }
        $('invList').innerHTML = h;
        $('invList').querySelectorAll('.item[data-i]').forEach(el => {
          el.addEventListener('click', e => { const i = +el.dataset.i; if (e.target.dataset.d !== undefined) act.drop(i); else act.use(i); render(); });
          el.addEventListener('contextmenu', e => { e.preventDefault(); act.drop(+el.dataset.i); render(); });
        });
      };
      render(); UI.open('inventory');
    },
    openJournal(S, readNote) {
      const ch = D.Story.chapter(S), ob = D.Story.objective(S), dg = [0, 1, 2, 3].map(i => S.digits.indexOf(i) >= 0 ? S.code[i] : '?').join(' ');
      $('jInfo').innerHTML = 'Chapter ' + ch.n + ': <b>' + ch.title + '</b><br>Current objective: ' + (ob ? ob.text : '-') + '<br>Notes: ' + S.notes.length + ' / ' + D.Story.totalNotes + (S.digits.length ? '<br>Scratched numbers: <span style="font-family:monospace;letter-spacing:6px;color:#d8c070">' + dg + '</span>' : '');
      let h = ''; Object.keys(D.Story.notes).forEach(id => { const got = S.notes.indexOf(id) >= 0; h += got ? '<div class="item" data-n="' + id + '">' + D.Story.notes[id].title + '<small>' + D.Story.notes[id].by + '</small></div>' : '<div class="item empty">???</div>'; });
      $('jNotes').innerHTML = h; $('jNotes').querySelectorAll('[data-n]').forEach(el => el.addEventListener('click', () => { readNote(el.dataset.n); }));
      UI.open('journal');
    },
    openKeypad(S, onOpen) {
      let buf = ''; const disp = () => { $('kDisp').textContent = (buf + '----').slice(0, 4); }; disp(); $('kMsg').textContent = '';
      const g = $('kGrid'); g.innerHTML = '';
      '123456789C0X'.split('').forEach(ch => {
        const b = document.createElement('button'); b.textContent = ch === 'C' ? '<' : ch === 'X' ? 'OK' : ch;
        b.addEventListener('click', () => {
          D.Audio.click();
          if (ch === 'C') buf = buf.slice(0, -1);
          else if (ch === 'X') {
            if (buf === S.code.join('')) { $('kMsg').textContent = 'CLICK. The safe unlocks.'; D.Audio.unlock(); setTimeout(() => { UI.close(); onOpen(); }, 500); }
            else { $('kMsg').textContent = 'Wrong code.'; D.Audio.locked(); buf = ''; }
          } else if (buf.length < 4) buf += ch;
          disp();
        }); g.appendChild(b);
      });
      $('kClear').onclick = () => { buf = ''; disp(); }; $('kClose').onclick = () => UI.close();
      UI.open('keypad');
    },
    openChoice(title, text, opts) {
      $('chTitle').textContent = title; $('chText').textContent = text; const b = $('chBtns'); b.innerHTML = '';
      opts.forEach(o => { const bt = document.createElement('button'); bt.textContent = o.text; bt.addEventListener('click', () => { UI.close(); o.cb && o.cb(); }); b.appendChild(bt); });
      UI.open('choice');
    },
    openElevator(S, cur, pick) {
      const b = $('elBtns'); b.innerHTML = ''; $('elMsg').textContent = '';
      [[2, '2   SECOND FLOOR'], [1, '1   LOBBY'], [0, 'B   BASEMENT']].forEach(f => {
        const bt = document.createElement('button'); bt.textContent = f[1] + (f[0] === cur ? '  (here)' : ''); if (f[0] === cur) bt.disabled = true;
        const locked = f[0] === 0 && !S.inv.some(i => i.type === 'key_basement'); if (locked) bt.classList.add('locked');
        bt.addEventListener('click', () => { if (locked) { $('elMsg').textContent = 'ACCESS DENIED - keycard required'; D.Audio.locked(); return; } UI.close(); pick(f[0]); });
        b.appendChild(bt);
      });
      $('elClose').onclick = () => UI.close(); UI.open('elev');
    },
    // settings panel binding
    bindSettings() {
      const s = D.settings, map = [['sMaster', 'master'], ['sMusic', 'music'], ['sSfx', 'sfx'], ['sSens', 'sens'], ['sFov', 'fov'], ['sBright', 'brightness']];
      map.forEach(m => { const el = $(m[0]); el.value = s[m[1]]; el.oninput = () => { s[m[1]] = +el.value; D.saveSettings(); D.Audio.applySettings(); D.bus.emit('settings'); }; });
      $('sQual').value = s.quality; $('sQual').onchange = () => { s.quality = $('sQual').value; D.saveSettings(); D.bus.emit('settings'); };
      $('sBob').checked = s.bob; $('sBob').onchange = () => { s.bob = $('sBob').checked; D.saveSettings(); };
      $('sGrain').checked = s.grain; $('sGrain').onchange = () => { s.grain = $('sGrain').checked; D.saveSettings(); };
    }
  };
  function short(t) { return { battery: 'BAT', medkit: '+', key_stair: 'KEY', fuse: 'FUSE', valve: 'VALVE', key_office: 'KEY', key_basement: 'CARD', key_archive: 'KEY', key_exit: 'KEY' }[t] || '?'; }
})(window.DLBY);
