/* Procedural Web Audio: ambience, positional creature sounds, footsteps, heartbeat, silence */
(function (D) {
  'use strict';
  let ac = null, master, musicG, sfxG, revG, comp, noiseBuf;
  let tensionG, humG, fireG, elevG;
  let breath = null;
  let hbT = 0, swellTO = null, duckTO = null;
  const st = { tension: 0, fear: 0, power: false };

  function now() { return ac.currentTime; }
  function setPos(p, v) {
    if (p.positionX) { p.positionX.value = v.x; p.positionY.value = v.y; p.positionZ.value = v.z; }
    else p.setPosition(v.x, v.y, v.z);
  }
  function impulse(sec, decay) {
    const len = ac.sampleRate * sec, b = ac.createBuffer(2, len, ac.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); }
    return b;
  }
  function noiseSrc(loop) {
    const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = !!loop; return s;
  }
  // one-shot filtered noise burst
  function nb(o) {
    const t = now() + (o.delay || 0), s = noiseSrc(false), f = ac.createBiquadFilter(), g = ac.createGain();
    f.type = o.type || 'bandpass'; f.frequency.setValueAtTime(o.f || 800, t); f.Q.value = o.q || 1;
    if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + o.dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(o.vol || 0.2, t + (o.a || 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    s.connect(f); f.connect(g); g.connect(o.out || sfxG);
    s.start(t, Math.random() * 1.5); s.stop(t + o.dur + 0.05);
  }
  // one-shot oscillator
  function tn(o) {
    const t = now() + (o.delay || 0), os = ac.createOscillator(), g = ac.createGain();
    os.type = o.type || 'sine'; os.frequency.setValueAtTime(o.f, t);
    if (o.to) os.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + o.dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(o.vol || 0.2, t + (o.a || 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    os.connect(g); g.connect(o.out || sfxG); os.start(t); os.stop(t + o.dur + 0.05);
  }
  // positional chain -> returns input node
  function chainAt(pos, muffled) {
    const p = ac.createPanner();
    p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = 1.6; p.maxDistance = 90; p.rolloffFactor = 1.35;
    setPos(p, pos); p.connect(sfxG);
    const send = ac.createGain(); send.gain.value = 0.5; p.connect(send); send.connect(revG);
    if (muffled) { const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 280; lp.connect(p); return lp; }
    return p;
  }
  function vols() {
    if (!ac) return;
    const s = D.settings;
    master.gain.value = s.master; musicG.gain.value = s.music * 0.9; sfxG.gain.value = s.sfx;
  }

  const A = D.Audio = {
    get ready() { return !!ac; },
    init() {
      if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
      try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; return; }
      comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 6; comp.connect(ac.destination);
      master = ac.createGain(); master.connect(comp);
      musicG = ac.createGain(); musicG.connect(master);
      sfxG = ac.createGain(); sfxG.connect(master);
      const conv = ac.createConvolver(); conv.buffer = impulse(2.6, 2.4);
      revG = ac.createGain(); revG.gain.value = 0.32; revG.connect(conv); conv.connect(master);
      const len = ac.sampleRate * 2; noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      vols(); startAmbient();
    },
    applySettings: vols,
    resume() { if (ac && ac.state === 'suspended') ac.resume(); },
    suspend() { if (ac && ac.state === 'running') ac.suspend(); },

    // ---- listener ----
    listener(x, y, z, yaw) {
      if (!ac) return;
      const L = ac.listener, fx = -Math.sin(yaw), fz = -Math.cos(yaw);
      if (L.positionX) {
        L.positionX.value = x; L.positionY.value = y; L.positionZ.value = z;
        L.forwardX.value = fx; L.forwardY.value = 0; L.forwardZ.value = fz;
        L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0;
      } else { L.setPosition(x, y, z); L.setOrientation(fx, 0, fz, 0, 1, 0); }
    },

    // ---- state ----
    setTension(v) { st.tension = v; if (tensionG) tensionG.gain.setTargetAtTime(v * 0.10, now(), 0.4); },
    setFear(v) { st.fear = v; },
    setPower(on) { st.power = on; if (humG) humG.gain.setTargetAtTime(on ? 0.05 : 0.012, now(), 1.2); },
    duck(sec) {
      if (!ac) return;
      const t = now(); musicG.gain.cancelScheduledValues(t); musicG.gain.setTargetAtTime(0.0, t, 0.05);
      if (humG) humG.gain.setTargetAtTime(0.0, t, 0.05);
      clearTimeout(duckTO);
      duckTO = setTimeout(() => { vols(); if (humG) humG.gain.setTargetAtTime(st.power ? 0.05 : 0.012, now(), 1.5); }, sec * 1000);
    },
    fire(on) { if (fireG) fireG.gain.setTargetAtTime(on ? 0.35 : 0, now(), 0.8); },
    elevator(on) { if (elevG) elevG.gain.setTargetAtTime(on ? 0.12 : 0, now(), 0.4); },

    // ---- UI / feedback ----
    click() { if (!ac) return; tn({ f: 1500, to: 600, dur: 0.04, vol: 0.12, type: 'square' }); },
    uiHover() { if (!ac) return; tn({ f: 500, dur: 0.05, vol: 0.04, type: 'triangle' }); },
    pickup() { if (!ac) return; tn({ f: 660, to: 990, dur: 0.18, vol: 0.12, type: 'triangle' }); tn({ f: 990, to: 1320, dur: 0.2, vol: 0.08, type: 'sine', delay: 0.08 }); },
    paper() { if (!ac) return; nb({ type: 'highpass', f: 2500, dur: 0.25, vol: 0.12, a: 0.05 }); nb({ type: 'bandpass', f: 4000, q: 2, dur: 0.15, vol: 0.08, delay: 0.12 }); },
    flash(on) { if (!ac) return; nb({ type: 'bandpass', f: 2200, q: 3, dur: 0.03, vol: 0.18 }); tn({ f: on ? 700 : 500, dur: 0.03, vol: 0.06, type: 'square', delay: 0.01 }); },
    unlock() { if (!ac) return; tn({ f: 220, to: 160, dur: 0.12, vol: 0.14, type: 'square' }); tn({ f: 330, to: 440, dur: 0.1, vol: 0.1, type: 'square', delay: 0.14 }); },
    locked() { if (!ac) return; tn({ f: 140, to: 120, dur: 0.08, vol: 0.14, type: 'square' }); tn({ f: 130, to: 110, dur: 0.08, vol: 0.12, type: 'square', delay: 0.12 }); },
    ding() { if (!ac) return; tn({ f: 1046, dur: 1.2, vol: 0.14, type: 'sine' }); tn({ f: 784, dur: 1.4, vol: 0.12, type: 'sine', delay: 0.35 }); },
    heal() { if (!ac) return; tn({ f: 392, to: 784, dur: 0.6, vol: 0.12, type: 'sine' }); },
    battery() { if (!ac) return; tn({ f: 220, to: 440, dur: 0.15, vol: 0.12, type: 'square' }); nb({ type: 'bandpass', f: 1800, dur: 0.08, vol: 0.1, delay: 0.1 }); },
    chapter() { if (!ac) return; tn({ f: 55, dur: 4, vol: 0.28, type: 'sawtooth', a: 1.2 }); tn({ f: 82, dur: 4, vol: 0.2, type: 'sawtooth', a: 1.5 }); tn({ f: 116, dur: 3.5, vol: 0.12, type: 'triangle', a: 1.4 }); },
    stinger(v) { if (!ac) return; v = v || 1; tn({ f: 90, to: 60, dur: 1.4, vol: 0.28 * v, type: 'sawtooth', a: 0.02 }); tn({ f: 2200, to: 1800, dur: 0.9, vol: 0.05 * v, type: 'square', a: 0.01 }); nb({ type: 'lowpass', f: 400, dur: 1.2, vol: 0.3 * v }); },
    thump(v) { if (!ac) return; tn({ f: 70, to: 30, dur: 0.5, vol: 0.5 * (v || 1), type: 'sine' }); nb({ type: 'lowpass', f: 200, dur: 0.4, vol: 0.4 * (v || 1) }); },

    // ---- movement ----
    footstep(surface, vol) {
      if (!ac) return; vol = vol || 1;
      switch (surface) {
        case 'carpet': nb({ type: 'lowpass', f: 380, dur: 0.14, vol: 0.18 * vol }); break;
        case 'wood': nb({ type: 'bandpass', f: 520, q: 1.5, dur: 0.1, vol: 0.2 * vol }); tn({ f: 120, to: 70, dur: 0.1, vol: 0.16 * vol }); break;
        case 'tile': nb({ type: 'bandpass', f: 2300, q: 2, dur: 0.07, vol: 0.2 * vol }); tn({ f: 900, to: 400, dur: 0.04, vol: 0.05 * vol, type: 'square' }); break;
        case 'metal': tn({ f: 320, to: 260, dur: 0.18, vol: 0.12 * vol, type: 'triangle' }); nb({ type: 'bandpass', f: 1500, dur: 0.06, vol: 0.14 * vol }); break;
        default: nb({ type: 'bandpass', f: 800, q: 1, dur: 0.09, vol: 0.2 * vol }); tn({ f: 90, to: 50, dur: 0.08, vol: 0.12 * vol });
      }
    },
    stepAt(pos, vol, muffled) {
      if (!ac) return; const out = chainAt(pos, muffled); vol = vol || 1;
      tn({ f: 62, to: 32, dur: 0.35, vol: 0.55 * vol, out: out });
      nb({ type: 'lowpass', f: 420, dur: 0.22, vol: 0.5 * vol, out: out });
      if (Math.random() < 0.5) nb({ type: 'bandpass', f: 1400, q: 3, dur: 0.05, vol: 0.12 * vol, out: out, delay: 0.04 });
    },
    mimicStep(pos, vol) { if (!ac) return; const out = chainAt(pos, false); nb({ type: 'bandpass', f: 500, q: 1.5, dur: 0.1, vol: 0.28 * (vol || 1), out: out }); tn({ f: 110, to: 70, dur: 0.1, vol: 0.2 * (vol || 1), out: out }); },
    knock(pos, muffled) {
      if (!ac) return; const out = chainAt(pos, muffled);
      [0, 0.28, 0.5].forEach(d => { tn({ f: 160, to: 90, dur: 0.14, vol: 0.5, delay: d, out: out }); nb({ type: 'bandpass', f: 400, q: 1, dur: 0.1, vol: 0.4, delay: d, out: out }); });
    },
    doorCreak(pos, slam) {
      if (!ac) return; const out = pos ? chainAt(pos, false) : sfxG;
      if (slam) { tn({ f: 80, to: 40, dur: 0.5, vol: 0.6, out: out }); nb({ type: 'lowpass', f: 600, dur: 0.4, vol: 0.5, out: out }); return; }
      nb({ type: 'bandpass', f: 300, to: 900, q: 8, dur: 0.7, vol: 0.12, a: 0.2, out: out });
      tn({ f: 180, to: 260, dur: 0.6, vol: 0.04, type: 'sawtooth', a: 0.25, out: out });
    },
    growl(pos, vol) {
      if (!ac) return; const out = chainAt(pos, false); vol = vol || 1;
      tn({ f: 70, to: 50, dur: 1.6, vol: 0.35 * vol, type: 'sawtooth', a: 0.3, out: out });
      nb({ type: 'bandpass', f: 220, to: 120, q: 4, dur: 1.5, vol: 0.4 * vol, a: 0.3, out: out });
    },
    screech(vol) {
      if (!ac) return; vol = vol || 1;
      tn({ f: 900, to: 2400, dur: 0.9, vol: 0.25 * vol, type: 'sawtooth', a: 0.02 });
      tn({ f: 1330, to: 3100, dur: 0.9, vol: 0.18 * vol, type: 'square', a: 0.02 });
      nb({ type: 'bandpass', f: 2000, to: 5000, q: 2, dur: 0.9, vol: 0.4 * vol });
      A.thump(vol);
    },
    whisper(pan) {
      if (!ac) return;
      const t = now(), s = noiseSrc(true), f = ac.createBiquadFilter(), g = ac.createGain(), p = ac.createStereoPanner();
      f.type = 'bandpass'; f.Q.value = 6; f.frequency.setValueAtTime(900, t);
      for (let i = 1; i < 10; i++) f.frequency.linearRampToValueAtTime(500 + Math.random() * 1800, t + i * 0.28);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.28, t + 0.5); g.gain.setValueAtTime(0.28, t + 2); g.gain.exponentialRampToValueAtTime(0.0001, t + 3);
      p.pan.value = pan || 0; s.connect(f); f.connect(g); g.connect(p); p.connect(sfxG); s.start(t); s.stop(t + 3.1);
    },
    breathBurst(pos) {
      if (!ac) return; const out = chainAt(pos, false);
      nb({ type: 'bandpass', f: 700, q: 2, dur: 1.1, vol: 0.4, a: 0.4, out: out }); nb({ type: 'bandpass', f: 500, q: 2, dur: 1.4, vol: 0.35, a: 0.5, out: out, delay: 1.3 });
    },
    // continuous creature breathing, positional
    breathing(on, pos, vol) {
      if (!ac) return;
      if (on && !breath) {
        const s = noiseSrc(true), f = ac.createBiquadFilter(), g = ac.createGain(), lfo = ac.createOscillator(), lg = ac.createGain();
        f.type = 'bandpass'; f.frequency.value = 650; f.Q.value = 2.5;
        g.gain.value = 0; lfo.frequency.value = 0.33; lg.gain.value = 0.5; lfo.connect(lg); lg.connect(g.gain);
        const p = ac.createPanner(); p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = 1.5; p.rolloffFactor = 1.4;
        const mg = ac.createGain(); mg.gain.value = 0;
        s.connect(f); f.connect(g); g.connect(mg); mg.connect(p); p.connect(sfxG); s.start(); lfo.start();
        breath = { s, lfo, p, mg };
      }
      if (!breath) return;
      if (on) { setPos(breath.p, pos); breath.mg.gain.setTargetAtTime(Math.min(1.4, vol || 0.5), now(), 0.3); }
      else breath.mg.gain.setTargetAtTime(0, now(), 0.4);
    },
    // sound muffled coming from another floor
    thumpAbove(pos, vol) { if (!ac) return; const out = chainAt(pos, true); tn({ f: 55, to: 30, dur: 0.5, vol: 0.6 * (vol || 1), out: out }); nb({ type: 'lowpass', f: 160, dur: 0.4, vol: 0.5 * (vol || 1), out: out }); },
    elevatorDing: function () { A.ding(); },

    update(dt) {
      if (!ac) return;
      // heartbeat
      const fear = st.fear;
      if (fear > 0.12) {
        hbT -= dt;
        if (hbT <= 0) {
          const v = Math.min(1, fear * 1.1);
          tn({ f: 62, to: 38, dur: 0.18, vol: 0.55 * v });
          tn({ f: 58, to: 36, dur: 0.16, vol: 0.4 * v, delay: 0.17 });
          hbT = 60 / (62 + fear * 100);
        }
      }
    }
  };

  function startAmbient() {
    // slow drone
    const o1 = ac.createOscillator(), o2 = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
    o1.type = 'sine'; o1.frequency.value = 46; o2.type = 'sawtooth'; o2.frequency.value = 46.5;
    f.type = 'lowpass'; f.frequency.value = 140; g.gain.value = 0.2;
    const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 60; lfo.connect(lg); lg.connect(f.frequency);
    o1.connect(f); o2.connect(f); f.connect(g); g.connect(musicG); o1.start(); o2.start(); lfo.start();
    // electrical hum
    const h1 = ac.createOscillator(), h2 = ac.createOscillator(), hf = ac.createBiquadFilter();
    h1.type = 'square'; h1.frequency.value = 100; h2.type = 'sawtooth'; h2.frequency.value = 150; hf.type = 'lowpass'; hf.frequency.value = 380;
    humG = ac.createGain(); humG.gain.value = 0.012; h1.connect(hf); h2.connect(hf); hf.connect(humG); humG.connect(sfxG); h1.start(); h2.start();
    // tension layer
    const t1 = ac.createOscillator(), t2 = ac.createOscillator(); t1.type = 'sine'; t1.frequency.value = 311; t2.type = 'sine'; t2.frequency.value = 466.6;
    tensionG = ac.createGain(); tensionG.gain.value = 0;
    const trem = ac.createOscillator(), tg = ac.createGain(); trem.frequency.value = 5.5; tg.gain.value = 0.5; trem.connect(tg); tg.connect(tensionG.gain);
    t1.connect(tensionG); t2.connect(tensionG); tensionG.connect(musicG); t1.start(); t2.start(); trem.start();
    // fire roar
    const fs = noiseSrc(true), ff = ac.createBiquadFilter(); ff.type = 'lowpass'; ff.frequency.value = 500;
    fireG = ac.createGain(); fireG.gain.value = 0; fs.connect(ff); ff.connect(fireG); fireG.connect(sfxG); fs.start();
    // elevator rumble
    const es = noiseSrc(true), ef = ac.createBiquadFilter(); ef.type = 'lowpass'; ef.frequency.value = 120;
    elevG = ac.createGain(); elevG.gain.value = 0; es.connect(ef); ef.connect(elevG); elevG.connect(sfxG); es.start();
    scheduleSwell();
  }
  function scheduleSwell() {
    clearTimeout(swellTO);
    swellTO = setTimeout(() => {
      if (ac && ac.state === 'running') {
        const base = [110, 123.5, 138.6, 146.8][Math.floor(Math.random() * 4)];
        const t = now(), dur = 7 + Math.random() * 5;
        [1, 1.0595, 1.5, 1.414].slice(0, 2 + (Math.random() * 3 | 0)).forEach(r => {
          const o = ac.createOscillator(), g = ac.createGain(); o.type = Math.random() < 0.5 ? 'sine' : 'triangle'; o.frequency.value = base * r * (Math.random() < 0.3 ? 2 : 1);
          g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.05, t + dur * 0.5); g.gain.linearRampToValueAtTime(0.0001, t + dur);
          o.connect(g); g.connect(musicG); o.start(t); o.stop(t + dur + 0.1);
        });
        if (Math.random() < 0.4) nb({ type: 'bandpass', f: 180, to: 90, q: 12, dur: 4, vol: 0.08, a: 1.5, out: musicG });   // distant metal groan
      }
      scheduleSwell();
    }, 9000 + Math.random() * 14000);
  }
})(window.DLBY);
