/* Snow Stunt 2 – Darstellung, Eingabe, Menüs */
(function () {
  'use strict';
  const { Sim, J, DT, wrap, clamp, lerp } = SIM;
  const LEVELS = window.LEVELS;
  const $ = (id) => document.getElementById(id);
  const cv = $('c');
  const ctx = cv.getContext('2d');
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = window.navigator.standalone || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);

  // ---------- Speicher ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem('ss2_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('ss2_' + k, JSON.stringify(v)); } catch (e) {} },
  };
  const S = Object.assign({ control: isTouch ? 'tilt' : 'keys', sens: 22, invert: false, sound: true, calib: 0 }, store.get('settings', {}));
  if (!isTouch) S.control = 'keys';
  const prog = Object.assign({ unlocked: 1, best: {} }, store.get('progress', {}));
  const saveS = () => store.set('settings', S);
  const saveP = () => store.set('progress', prog);

  // ---------- Bildschirm ----------
  let W = 0, H = 0, DPR = 1;
  const safe = { l: 0, r: 0, t: 0, b: 0 };
  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    const r = $('safe').getBoundingClientRect();
    safe.l = r.left; safe.t = r.top; safe.r = W - r.right; safe.b = H - r.bottom;
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 200));
  resize();

  // ---------- Ton ----------
  let AC = null, master = null, noiseBuf = null, carve = null;
  function audioInit() {
    if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
    try {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      master = AC.createGain(); master.gain.value = S.sound ? 0.6 : 0; master.connect(AC.destination);
      noiseBuf = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const src = AC.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
      const bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.7;
      const g = AC.createGain(); g.gain.value = 0;
      src.connect(bp); bp.connect(g); g.connect(master); src.start();
      carve = { g, bp };
    } catch (e) { AC = null; }
  }
  function tone(f0, f1, dur, type, vol, delay) {
    if (!AC || !S.sound) return;
    const t = AC.currentTime + (delay || 0);
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol || 0.3, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, freq, vol, delay) {
    if (!AC || !S.sound) return;
    const t = AC.currentTime + (delay || 0);
    const s = AC.createBufferSource(); s.buffer = noiseBuf;
    const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(freq, t); f.frequency.exponentialRampToValueAtTime(80, t + dur);
    const g = AC.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random()); s.stop(t + dur + 0.02);
  }
  const sfx = {
    jump() { noise(0.18, 2500, 0.25); tone(220, 440, 0.12, 'triangle', 0.12); },
    land(h) { noise(0.16, 1200, 0.3 + Math.min(0.3, h * 0.1)); tone(110, 50, 0.15, 'sine', 0.35); },
    star() { tone(1046, 1046, 0.09, 'square', 0.08); tone(1568, 1568, 0.16, 'square', 0.08, 0.07); },
    crash() { noise(0.5, 1800, 0.55); tone(90, 35, 0.35, 'sine', 0.5); tone(300, 60, 0.25, 'sawtooth', 0.08); },
    cp() { [523, 659, 784].forEach((f, i) => tone(f, f, 0.14, 'triangle', 0.18, i * 0.08)); },
    trick(m) { tone(600, 1200, 0.18, 'triangle', 0.15); if (m >= 2) tone(900, 1800, 0.22, 'triangle', 0.12, 0.1); },
    flip() { tone(500, 700, 0.08, 'sine', 0.1); },
    finish() { [523, 659, 784, 1046].forEach((f, i) => tone(f, f, 0.22, 'triangle', 0.2, i * 0.11)); },
    boost() { noise(0.35, 4000, 0.18); tone(200, 800, 0.3, 'sawtooth', 0.05); },
    gravity() { tone(300, 900, 0.4, 'sine', 0.15); tone(900, 300, 0.4, 'sine', 0.1, 0.1); },
  };

  // ---------- Eingabe ----------
  const input = { tilt: 0, jump: false, duck: false, grabL: false, grabR: false };
  const keys = {};
  let jumpQ = false;
  const touches = new Map();
  let duckUntil = 0;
  const tiltSt = { roll: 0, seen: false, conv: 0, raw: 0 };

  function screenAxes(ax, ay) {
    const o = typeof window.orientation === 'number' ? window.orientation : screen.orientation ? screen.orientation.angle : 0;
    switch ((o + 360) % 360) {
      case 90: return [-ay, ax];
      case 270: return [ay, -ax];
      case 180: return [-ax, -ay];
      default: return [ax, ay];
    }
  }
  function onMotion(e) {
    const a = e.accelerationIncludingGravity;
    if (!a || a.x == null) return;
    tiltSt.seen = true;
    const [sx, sy] = screenAxes(a.x, a.y);
    const z = a.z || 0;
    if (Math.abs(sy) > 2.5) tiltSt.conv = lerp(tiltSt.conv, sy < 0 ? 1 : -1, tiltSt.conv === 0 ? 1 : 0.04);
    const c = tiltSt.conv >= 0 ? 1 : -1;
    let roll = Math.atan2(c * sx, Math.hypot(sy, z));
    if (S.invert) roll = -roll;
    tiltSt.raw = roll;
    tiltSt.roll = lerp(tiltSt.roll, roll, 0.45);
  }
  window.addEventListener('devicemotion', onMotion);

  async function askMotion() {
    try {
      if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
        const r = await DeviceMotionEvent.requestPermission();
        return r === 'granted';
      }
    } catch (e) { return false; }
    return true;
  }

  function tiltValue() {
    if (S.control !== 'tilt' || !tiltSt.seen) return 0;
    const max = (S.sens * Math.PI) / 180;
    let v = (tiltSt.roll - S.calib) / max;
    const dz = 0.06;
    v = Math.abs(v) < dz ? 0 : (v - Math.sign(v) * dz) / (1 - dz);
    return clamp(v, -1, 1);
  }

  function zoneOf(x) {
    if (S.control === 'buttons') {
      if (x < W * 0.25) return 'rotL';
      if (x < W * 0.5) return 'rotR';
      if (x < W * 0.75) return 'grabL';
      return 'grabR';
    }
    return x < W / 2 ? 'grabL' : 'grabR';
  }

  cv.addEventListener('touchstart', (e) => {
    e.preventDefault();
    audioInit();
    for (const t of e.changedTouches) {
      touches.set(t.identifier, { x0: t.clientX, y0: t.clientY, t0: performance.now(), kind: zoneOf(t.clientX) });
    }
    onTapAnywhere();
  }, { passive: false });
  cv.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      const o = touches.get(t.identifier);
      if (!o) continue;
      const dx = t.clientX - o.x0, dy = t.clientY - o.y0;
      const young = performance.now() - o.t0 < 320;
      if (young && o.kind !== 'swipeUp' && o.kind !== 'duck' && Math.abs(dy) > 28 && Math.abs(dy) > Math.abs(dx) * 1.1) {
        if (dy < 0) { o.kind = 'swipeUp'; jumpQ = true; onSwipeUp(); }
        else { o.kind = 'duck'; duckUntil = performance.now() + 450; }
      }
    }
  }, { passive: false });
  const endT = (e) => { e.preventDefault(); for (const t of e.changedTouches) touches.delete(t.identifier); };
  cv.addEventListener('touchend', endT, { passive: false });
  cv.addEventListener('touchcancel', endT, { passive: false });
  cv.addEventListener('mousedown', () => { audioInit(); onTapAnywhere(); });
  document.addEventListener('gesturestart', (e) => e.preventDefault());

  window.addEventListener('keydown', (e) => {
    audioInit();
    if (keys[e.code]) return;
    keys[e.code] = true;
    if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Space') { jumpQ = true; onSwipeUp(); onTapAnywhere(); }
    if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
    if (e.code === 'KeyR' && game.sim && game.mode === 'play') { game.sim.crash('reset'); }
    if (e.code === 'Enter') onTapAnywhere();
  });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });

  function readInput() {
    let grabL = false, grabR = false, rot = 0, duck = performance.now() < duckUntil;
    for (const o of touches.values()) {
      if (o.kind === 'grabL') grabL = true;
      else if (o.kind === 'grabR') grabR = true;
      else if (o.kind === 'rotL') rot -= 1;
      else if (o.kind === 'rotR') rot += 1;
      else if (o.kind === 'duck') duck = true;
    }
    if (keys.ArrowLeft) rot -= 1;
    if (keys.ArrowRight) rot += 1;
    if (keys.ArrowDown || keys.KeyS) duck = true;
    if (keys.KeyA || keys.KeyX) grabL = true;
    if (keys.KeyD || keys.KeyC) grabR = true;
    input.tilt = clamp(rot !== 0 ? rot : tiltValue(), -1, 1);
    input.duck = duck; input.grabL = grabL; input.grabR = grabR;
    input.jump = jumpQ; jumpQ = false;
    return input;
  }

  // ---------- Spielzustand ----------
  const game = { mode: 'menu', idx: 0, sim: null, L: null, acc: 0, last: 0, popups: [], parts: [], cam: { x: 0, y: 0, rot: 0, s: 30 }, finT: 0, introT: 0, shake: 0, flakes: [] };
  for (let i = 0; i < 70; i++) game.flakes.push({ x: Math.random(), y: Math.random(), z: 0.3 + Math.random() * 0.7, p: Math.random() * 6 });

  function startLevel(i) {
    audioInit();
    game.idx = i;
    game.L = LEVELS[i].make();
    prepLevel(game.L);
    game.sim = new Sim(game.L, {});
    game.popups = []; game.parts = [];
    game.mode = 'play'; game.finT = 0; game.introT = 0; game.acc = 0;
    snapCam();
    showOv(null);
    $('pauseBtn').style.display = 'block';
    if (S.control === 'tilt' && isTouch) {
      setTimeout(() => {
        if (!tiltSt.seen && S.control === 'tilt') {
          S.control = 'buttons'; saveS();
          toast('Kein Bewegungssensor verfügbar – Tasten-Steuerung aktiviert (links drehen, rechts Grabs).', 5000);
        }
      }, 1500);
    }
  }

  function prepLevel(L) {
    const sim0 = { zones: L.zones };
    const inv = (x, y) => L.zones.some((z) => z.type === 'invert' && x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h);
    for (const c of L.checkpoints) c.up = inv(c.x, c.y - 0.5) ? -1 : 1;
    L.finish.up = inv(L.finish.x, L.finish.y - 0.5) ? -1 : 1;
    for (const s of L.signs) s.up = s.inv || inv(s.x, s.y - 0.5) ? -1 : 1;
    for (const t of L.terrain) {
      const p = new Path2D();
      t.poly.forEach((q, i) => (i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1])));
      p.closePath();
      t.path = p;
      const s = new Path2D();
      t.surf.forEach((q, i) => (i ? s.lineTo(q[0], q[1]) : s.moveTo(q[0], q[1])));
      t.spath = s;
    }
    L.theme = THEMES[L.theme || 0];
    void sim0;
  }

  function snapCam() {
    const f = game.sim.focus();
    game.cam.x = f.x + 4; game.cam.y = f.y + 1.5;
    game.cam.rot = game.sim.camTarget();
    game.cam.s = baseScale();
  }
  let baseScale = () => Math.max(H, 300) / 15.5;

  function onTapAnywhere() {
    if (game.mode === 'play' && game.sim && game.sim.state === 'dead' && game.sim.deadT > 0.45) {
      game.sim.respawn();
      touches.clear();
      jumpQ = false;
    }
  }
  function onSwipeUp() {}

  function togglePause() {
    if (game.mode === 'play') { game.mode = 'pause'; showOv('pause'); }
    else if (game.mode === 'pause') { resume(); }
  }
  function resume() { game.mode = 'play'; showOv(null); game.last = performance.now(); touches.clear(); }

  // ---------- Hauptschleife ----------
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = Math.min(0.1, (now - (game.last || now)) / 1000);
    game.last = now;
    if (game.mode === 'play') {
      game.acc += dt;
      let n = 0;
      while (game.acc >= DT && n < 6) {
        const inp = readInput();
        game.sim.step(inp);
        handleEvents();
        game.acc -= DT; n++;
      }
      if (n === 6) game.acc = 0;
      if (game.sim.state === 'finished') {
        game.finT += dt;
        if (game.finT > 1.3 && game.mode === 'play') showResult();
      }
      game.introT += dt;
      updateCarve();
    } else if (carve && AC) carve.g.gain.setTargetAtTime(0, AC.currentTime, 0.05);
    if (game.sim) { updateCam(dt); updateParts(dt); render(dt); }
    else renderMenuBg(dt);
  }

  function updateCarve() {
    if (!carve || !AC) return;
    const s = game.sim;
    let v = 0;
    if (s.rider && s.state === 'alive') {
      const sp = s.rider.getLinearVelocity().length();
      v = s.grounded ? Math.min(0.35, sp / 60) : Math.min(0.12, sp / 200);
      carve.bp.frequency.setTargetAtTime(s.grounded ? 500 + sp * 30 : 1800, AC.currentTime, 0.1);
    }
    carve.g.gain.setTargetAtTime(S.sound ? v : 0, AC.currentTime, 0.08);
  }

  function handleEvents() {
    const s = game.sim;
    for (const e of s.events) {
      switch (e.type) {
        case 'jump': sfx.jump(); break;
        case 'land': sfx.land(e.hard || 0); burst(s.rider, 10, '#fff'); break;
        case 'star': sfx.star(); sparkle(e.x, e.y, '#ffe04a'); popup('+200', null, 0.6, true); break;
        case 'checkpoint': sfx.cp(); popup('Checkpoint', 'Punkte gesichert', 1.2); sparkle(e.x, e.y + 2, '#7dff9a'); break;
        case 'trick': sfx.trick(e.mult || 1); popup(e.text, (e.q ? e.q + (e.mult > 1 ? ' ×' + e.mult : '') + '  ' : '') + '+' + fmt(e.pts), 1.6); break;
        case 'flip': sfx.flip(); break;
        case 'crash': sfx.crash(); game.shake = 0.35; popup(crashText(e.reason), null, 1.2, false, '#ff7a6b'); if (navigator.vibrate) try { navigator.vibrate(60); } catch (x) {} break;
        case 'finish': sfx.finish(); break;
        case 'boost': sfx.boost(); break;
        case 'gravity': sfx.gravity(); break;
        case 'spawn': if (e.inv !== undefined) {} break;
      }
    }
    s.events.length = 0;
  }
  function crashText(r) {
    return { hazard: 'Autsch!', head: 'Sturz!', landing: 'Schief gelandet!', grab: 'Grab nicht losgelassen!', fall: 'Abgestürzt!', reset: 'Zurück zum Checkpoint' }[r] || 'Sturz!';
  }
  const fmt = (n) => Math.round(n).toLocaleString('de-DE');

  function popup(text, sub, dur, small, color) {
    game.popups.push({ text, sub, t: 0, dur: dur || 1.5, small: !!small, color });
    if (game.popups.length > 4) game.popups.shift();
  }
  function toast(msg, ms) {
    const t = $('toast'); t.textContent = msg; t.style.display = 'block';
    clearTimeout(toast._t); toast._t = setTimeout(() => (t.style.display = 'none'), ms || 2500);
  }

  // ---------- Kamera ----------
  let updateCam = function (dt) {
    const s = game.sim, c = game.cam;
    const f = s.focus();
    let vx = 0, vy = 0;
    const b = s.rider || (s.ragParts && s.ragParts.torso.body);
    if (b) { const v = b.getLinearVelocity(); vx = v.x; vy = v.y; }
    const sp = Math.hypot(vx, vy);
    const look = s.state === 'alive' ? 0.32 : 0.1;
    const up = { x: -s.gdir.x, y: -s.gdir.y };
    const tx = f.x + clamp(vx * look, -9, 9) + up.x * 1.4, ty = f.y + clamp(vy * look * 0.6, -5, 5) + up.y * 1.4;
    const k = 1 - Math.exp(-dt * 6);
    c.x += (tx - c.x) * k; c.y += (ty - c.y) * k;
    const zs = baseScale() * clamp(1.08 - sp / 75, 0.7, 1.05);
    c.s += (zs - c.s) * (1 - Math.exp(-dt * 1.5));
    const dr = wrap(s.camTarget() - c.rot);
    c.rot += dr * (1 - Math.exp(-dt * 4.5));
    if (game.shake > 0) game.shake -= dt;
  };
  function w2s(x, y) {
    const c = game.cam, dx = x - c.x, dy = y - c.y, co = Math.cos(c.rot), si = Math.sin(c.rot);
    return [W / 2 + (dx * co - dy * si) * c.s, H / 2 - (dx * si + dy * co) * c.s];
  }
  function applyWorld() {
    const c = game.cam;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    let sx = 0, sy = 0;
    if (game.shake > 0) { sx = (Math.random() - 0.5) * 10 * game.shake; sy = (Math.random() - 0.5) * 10 * game.shake; }
    ctx.translate(W / 2 + sx, H / 2 + sy);
    ctx.scale(c.s, -c.s);
    ctx.rotate(c.rot);
    ctx.translate(-c.x, -c.y);
  }

  // ---------- Partikel ----------
  function burst(body, n, col) {
    if (!body) return;
    const p = body.getWorldPoint(SIM_V(0, 0));
    for (let i = 0; i < n; i++) game.parts.push({ x: p.x + (Math.random() - 0.5), y: p.y, vx: (Math.random() - 0.5) * 6, vy: Math.random() * 4, t: 0, d: 0.6 + Math.random() * 0.4, r: 0.08 + Math.random() * 0.1, c: col, g: 1 });
  }
  function sparkle(x, y, col) {
    for (let i = 0; i < 14; i++) { const a = Math.random() * 6.28, v = 2 + Math.random() * 4; game.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, d: 0.5 + Math.random() * 0.3, r: 0.1, c: col, g: 0 }); }
  }
  const SIM_V = (x, y) => planck.Vec2(x, y);
  function updateParts(dt) {
    const s = game.sim;
    // Schneespray
    if (s.rider && s.grounded && s.state === 'alive') {
      const v = s.rider.getLinearVelocity(), sp = v.length();
      if (sp > 5 && Math.random() < Math.min(1, sp / 18)) {
        const dir = Math.sign(v.x * Math.cos(s.rider.getAngle()) + v.y * Math.sin(s.rider.getAngle())) || 1;
        const p = s.rider.getWorldPoint(SIM_V(-0.6 * dir, 0));
        const n = s.groundN;
        game.parts.push({ x: p.x, y: p.y, vx: -v.x * 0.15 + n.x * (2 + Math.random() * 3), vy: -v.y * 0.15 + n.y * (2 + Math.random() * 3), t: 0, d: 0.45, r: 0.07 + Math.random() * 0.12, c: '#fff', g: 1 });
      }
    }
    const g = s.world.getGravity();
    for (const p of game.parts) { p.t += dt; p.vx += g.x * 0.3 * p.g * dt; p.vy += g.y * 0.3 * p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
    game.parts = game.parts.filter((p) => p.t < p.d);
    for (const p of game.popups) p.t += dt;
    game.popups = game.popups.filter((p) => p.t < p.dur);
  }

  // ---------- Themen ----------
  const THEMES = [
    { sky: ['#0b1531', '#25407a', '#6f93cf'], m: ['#3a5590', '#2a3f70', '#1b2a50'], rock: ['#4f6290', '#232c4c'], snow: '#f4f9ff', snowSh: '#a9c6ec', moon: true },
    { sky: ['#1f1238', '#6a3a78', '#f29b6b'], m: ['#7a4a7c', '#4f2f62', '#2e1c44'], rock: ['#6c4f7c', '#2a1d3c'], snow: '#fff6f0', snowSh: '#e2b8c8', sun: true },
    { sky: ['#06121a', '#0f3442', '#2d7c8a'], m: ['#1f5966', '#163f4c', '#0d2832'], rock: ['#3b6b77', '#13303a'], snow: '#effcff', snowSh: '#9fd9e4', moon: true },
    { sky: ['#140b22', '#2e1747', '#5b3a8a'], m: ['#46306e', '#33215a', '#211443'], rock: ['#56478a', '#1e1638'], snow: '#f6f2ff', snowSh: '#b9a8ea', moon: true },
  ];

  // ---------- Zeichnen ----------
  function mtn(x, seed) { return Math.sin(x * 0.011 + seed) * 0.5 + Math.sin(x * 0.027 + seed * 2.1) * 0.3 + Math.sin(x * 0.063 + seed * 3.7) * 0.12 + Math.abs(Math.sin(x * 0.0045 + seed)) * 0.6; }
  function drawBackground(theme, camX, camY, rot, t) {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate(-rot);
    const R = Math.hypot(W, H) / 2 + 10;
    const gr = ctx.createLinearGradient(0, -R, 0, R);
    gr.addColorStop(0, theme.sky[0]); gr.addColorStop(0.55, theme.sky[1]); gr.addColorStop(1, theme.sky[2]);
    ctx.fillStyle = gr; ctx.fillRect(-R, -R, 2 * R, 2 * R);
    // Mond / Sonne
    const mx = R * 0.45, my = -R * 0.45;
    ctx.fillStyle = theme.sun ? 'rgba(255,214,150,0.9)' : 'rgba(235,242,255,0.9)';
    ctx.shadowColor = theme.sun ? 'rgba(255,170,90,0.8)' : 'rgba(200,220,255,0.7)'; ctx.shadowBlur = 40;
    ctx.beginPath(); ctx.arc(mx, my, theme.sun ? 34 : 24, 0, 6.283); ctx.fill();
    ctx.shadowBlur = 0;
    // Bergketten (Parallaxe)
    const layers = [[0.08, 0.2, 0.55], [0.16, 0.35, 0.42], [0.28, 0.5, 0.3]];
    layers.forEach(([par, seed, base], li) => {
      const off = camX * game.cam.s * par;
      const voff = clamp(camY * game.cam.s * par * 0.25, -H * 0.3, H * 0.3);
      ctx.fillStyle = theme.m[li];
      ctx.beginPath();
      ctx.moveTo(-R, R);
      for (let x = -R; x <= R + 20; x += 18) {
        const wx = x + off;
        const hgt = mtn(wx * (1 + li * 0.3), seed * 10 + li) * H * (0.16 + li * 0.04);
        ctx.lineTo(x, H * base - hgt + voff + li * 30);
      }
      ctx.lineTo(R, R); ctx.closePath(); ctx.fill();
      // Schneespitzen der hinteren Kette
      if (li === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fill();
      }
    });
    // Schneeflocken
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    for (const f of game.flakes) {
      f.y += 0.0009 * f.z * 16; f.x += Math.sin(t * 0.7 + f.p) * 0.0004;
      if (f.y > 1) { f.y = 0; f.x = Math.random(); }
      let x = ((f.x * 2 * R - camX * game.cam.s * 0.5 * f.z) % (2 * R) + 2 * R) % (2 * R) - R;
      let y = ((f.y * 2 * R + camY * game.cam.s * 0.5 * f.z) % (2 * R) + 2 * R) % (2 * R) - R;
      ctx.globalAlpha = 0.35 + f.z * 0.5;
      ctx.beginPath(); ctx.arc(x, y, 1 + f.z * 1.8, 0, 6.283); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function render(dt) {
    const s = game.sim, L = game.L, th = L.theme, c = game.cam;
    const t = s.time;
    drawBackground(th, c.x, c.y, c.rot, performance.now() / 1000);
    applyWorld();
    const vr = Math.hypot(W, H) / 2 / c.s + 4;
    const vis = (x0, y0, x1, y1) => !(x1 < c.x - vr || x0 > c.x + vr || y1 < c.y - vr || y0 > c.y + vr);

    // Zonen (hinter Terrain)
    for (const z of L.zones) { if (!z.hidden && vis(z.x, z.y, z.x + z.w, z.y + z.h)) drawZone(z, t); }
    // Loops (Rückseite)
    for (const lp of L.loops) drawLoop(lp, th);
    // Deko
    for (const d of L.deco) if (vis(d.x - 3, d.y - 3, d.x + 3, d.y + 6)) drawTree(d, th);
    // Terrain
    for (const tr of L.terrain) {
      const b = tr.bb;
      if (!vis(b[0], b[1], b[2], b[3])) continue;
      drawTerrain(tr, th);
    }
    // Rails
    for (const r of L.rails) if (vis(Math.min(r[0], r[2]), Math.min(r[1], r[3]) - 3, Math.max(r[0], r[2]), Math.max(r[1], r[3]) + 3)) drawRail(r);
    // Stacheln
    for (const sp of L.spikes) if (vis(sp.x, sp.y - 2, sp.x + sp.w, sp.y + 2)) drawSpikes(sp);
    // Schilder, Checkpoints, Ziel
    for (const sg of L.signs) if (vis(sg.x - 2, sg.y - 4, sg.x + 2, sg.y + 4)) drawSignPost(sg);
    s.cps.forEach((cp, i) => { if (vis(cp.x - 2, cp.y - 5, cp.x + 2, cp.y + 5)) drawFlag(cp, L.checkpoints[i].up, cp.passed, t); });
    drawFinish(L.finish, t);
    // Sterne
    for (const st of s.stars) if (!st.taken && vis(st.x - 1, st.y - 1, st.x + 1, st.y + 1)) drawStar(st.x, st.y, 0.5, t);
    // Sägen
    for (const sw of s.saws) { const p = sw.body.getPosition(); if (vis(p.x - 4, p.y - 4, p.x + 4, p.y + 4)) drawSaw(sw, p); }
    // Fahrer
    if (s.rider) drawRider(s);
    else if (s.ragParts) drawRagdoll(s);
    // Partikel
    for (const p of game.parts) {
      ctx.globalAlpha = 1 - p.t / p.d;
      ctx.fillStyle = p.c;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Texte in Bildschirmkoordinaten
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    for (const sg of L.signs) if (vis(sg.x - 2, sg.y - 4, sg.x + 2, sg.y + 4)) drawSignFace(sg);
    drawHUD(s, L);
  }

  function drawTerrain(tr, th) {
    const b = tr.bb;
    const ceil = tr.kind === 'ceiling';
    const g = ctx.createLinearGradient(0, ceil ? b[1] : b[3], 0, ceil ? b[3] : b[1]);
    g.addColorStop(0, th.rock[0]); g.addColorStop(1, th.rock[1]);
    ctx.fillStyle = g;
    ctx.fill(tr.path);
    if (!tr.snow) return;
    ctx.save();
    ctx.clip(tr.path);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.strokeStyle = th.snowSh; ctx.lineWidth = 1.25; ctx.stroke(tr.spath);
    ctx.strokeStyle = th.snow; ctx.lineWidth = 0.85; ctx.stroke(tr.spath);
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 0.06; ctx.stroke(tr.spath);
  }

  function drawZone(z, t) {
    ctx.save();
    if (z.type === 'boost') {
      ctx.fillStyle = 'rgba(255,190,40,0.10)';
      ctx.fillRect(z.x, z.y, z.w, z.h);
      ctx.translate(z.x + z.w / 2, z.y + z.h / 2);
      ctx.rotate((z.ang * Math.PI) / 180);
      const len = Math.max(z.w, z.h);
      ctx.lineWidth = 0.22; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (let i = 0; i < 6; i++) {
        const x = (((i / 6 + t * 1.2) % 1) - 0.5) * len * 0.9;
        const a = 1 - Math.abs(x) / (len * 0.5);
        ctx.strokeStyle = `rgba(255,${180 + i * 10},60,${0.25 + 0.6 * a})`;
        ctx.beginPath(); ctx.moveTo(x - 0.5, 0.8); ctx.lineTo(x + 0.3, 0); ctx.lineTo(x - 0.5, -0.8); ctx.stroke();
      }
    } else if (z.type === 'fan') {
      ctx.fillStyle = 'rgba(180,230,255,0.07)';
      ctx.fillRect(z.x, z.y, z.w, z.h);
      ctx.strokeStyle = 'rgba(220,245,255,0.45)'; ctx.lineWidth = 0.07;
      for (let i = 0; i < 9; i++) {
        const x = z.x + ((i + 0.5) / 9) * z.w;
        const y = z.y + (((i * 0.37 + t * 1.6) % 1) * z.h);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.sin(t * 3 + i) * 0.2, y + 1.6); ctx.stroke();
      }
      // Ventilatorgehäuse
      const cx = z.x + z.w / 2, by = z.y;
      ctx.fillStyle = '#39414f'; ctx.fillRect(cx - z.w / 2, by - 0.6, z.w, 0.6);
      ctx.fillStyle = '#5c6675'; ctx.fillRect(cx - z.w / 2, by - 0.1, z.w, 0.15);
      ctx.fillStyle = '#9aa6b5';
      const n = Math.max(2, Math.round(z.w / 1.3));
      for (let i = 0; i < n; i++) {
        const x = z.x + ((i + 0.5) / n) * z.w;
        const w = Math.abs(Math.sin(t * 20 + i)) * (z.w / n) * 0.4;
        ctx.fillRect(x - w, by - 0.5, w * 2, 0.35);
      }
    } else if (z.type === 'invert') {
      ctx.fillStyle = 'rgba(190,90,255,0.10)';
      ctx.fillRect(z.x, z.y, z.w, z.h);
      ctx.strokeStyle = 'rgba(210,140,255,0.35)'; ctx.lineWidth = 0.1; ctx.setLineDash([0.6, 0.5]);
      ctx.strokeRect(z.x, z.y, z.w, z.h); ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(220,160,255,0.28)'; ctx.lineWidth = 0.15;
      for (let x = z.x + 2; x < z.x + z.w - 1; x += 4) for (let y = z.y + 2; y < z.y + z.h - 1; y += 4) {
        const yy = y + ((t * 1.5 + x * 0.1) % 1) * 1.5;
        ctx.beginPath(); ctx.moveTo(x - 0.35, yy - 0.3); ctx.lineTo(x, yy + 0.1); ctx.lineTo(x + 0.35, yy - 0.3); ctx.stroke();
      }
    } else if (z.type === 'zerog') {
      ctx.fillStyle = 'rgba(80,230,255,0.09)';
      ctx.fillRect(z.x, z.y, z.w, z.h);
      ctx.strokeStyle = 'rgba(120,240,255,0.35)'; ctx.lineWidth = 0.1; ctx.setLineDash([0.4, 0.4]);
      ctx.strokeRect(z.x, z.y, z.w, z.h); ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(170,250,255,0.3)';
      const n = Math.floor((z.w * z.h) / 18);
      for (let i = 0; i < n; i++) {
        const fx = (Math.sin(i * 12.9898) * 43758.5453) % 1, fy = (Math.sin(i * 78.233) * 12345.678) % 1;
        const x = z.x + Math.abs(fx) * z.w + Math.sin(t + i) * 0.4, y = z.y + Math.abs(fy) * z.h + Math.cos(t * 0.8 + i) * 0.4;
        ctx.beginPath(); ctx.arc(x, y, 0.12 + (i % 3) * 0.06, 0, 6.283); ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawLoop(lp, th) {
    ctx.save();
    ctx.lineWidth = 1.0; ctx.strokeStyle = th.rock[1];
    ctx.beginPath(); ctx.arc(lp.cx, lp.cy, lp.r + 0.5, 0, 6.283); ctx.stroke();
    ctx.lineWidth = 0.45; ctx.strokeStyle = th.snowSh;
    ctx.beginPath(); ctx.arc(lp.cx, lp.cy, lp.r + 0.15, 0, 6.283); ctx.stroke();
    ctx.lineWidth = 0.18; ctx.strokeStyle = th.snow;
    ctx.beginPath(); ctx.arc(lp.cx, lp.cy, lp.r + 0.05, 0, 6.283); ctx.stroke();
    // Stützen
    ctx.strokeStyle = th.rock[1]; ctx.lineWidth = 0.35;
    for (const a of [-0.7, 0.7]) { ctx.beginPath(); ctx.moveTo(lp.cx + Math.sin(a) * lp.r, lp.cy - Math.cos(a) * lp.r); ctx.lineTo(lp.cx + Math.sin(a) * (lp.r + 1.5), lp.cy - lp.r); ctx.stroke(); }
    ctx.restore();
  }

  function drawTree(d, th) {
    ctx.save();
    ctx.translate(d.x, d.y);
    if (d.inv) ctx.scale(1, -1);
    ctx.scale(d.s, d.s);
    ctx.fillStyle = '#3b2a22'; ctx.fillRect(-0.12, 0, 0.24, 0.8);
    const cols = ['#1d4a4a', '#235757', '#2a6363'];
    for (let i = 0; i < 3; i++) {
      const y = 0.6 + i * 0.85, w = 1.3 - i * 0.32;
      ctx.fillStyle = cols[i];
      ctx.beginPath(); ctx.moveTo(-w, y); ctx.lineTo(w, y); ctx.lineTo(0, y + 1.5); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath(); ctx.moveTo(-w * 0.55, y + 0.62); ctx.lineTo(w * 0.55, y + 0.62); ctx.lineTo(0, y + 1.5); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  function drawRail(r) {
    const dx = r[2] - r[0], dy = r[3] - r[1], len = Math.hypot(dx, dy);
    const nx = -dy / len, ny = dx / len;
    ctx.save();
    ctx.strokeStyle = '#2c3442'; ctx.lineWidth = 0.14;
    const n = Math.max(2, Math.round(len / 3.5));
    for (let i = 0; i <= n; i++) {
      const x = r[0] + (dx * i) / n, y = r[1] + (dy * i) / n;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - nx * 1.6, y - ny * 1.6); ctx.stroke();
    }
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#6f7f96'; ctx.lineWidth = 0.2;
    ctx.beginPath(); ctx.moveTo(r[0], r[1]); ctx.lineTo(r[2], r[3]); ctx.stroke();
    ctx.strokeStyle = '#e6eefc'; ctx.lineWidth = 0.07;
    ctx.beginPath(); ctx.moveTo(r[0] + nx * 0.04, r[1] + ny * 0.04); ctx.lineTo(r[2] + nx * 0.04, r[3] + ny * 0.04); ctx.stroke();
    ctx.restore();
  }

  function drawSpikes(sp) {
    for (const tri of sp.tris) {
      ctx.beginPath(); ctx.moveTo(tri[0][0], tri[0][1]); ctx.lineTo(tri[1][0], tri[1][1]); ctx.lineTo(tri[2][0], tri[2][1]); ctx.closePath();
      ctx.fillStyle = 'rgba(190,240,255,0.92)'; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 0.04; ctx.stroke();
    }
  }

  function drawSaw(sw, p) {
    const d = sw.def;
    if (d.mx || d.my) {
      ctx.save(); ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 0.15; ctx.setLineDash([0.4, 0.3]);
      ctx.beginPath(); ctx.moveTo(d.x - (d.mx || 0), d.y - (d.my || 0)); ctx.lineTo(d.x + (d.mx || 0), d.y + (d.my || 0)); ctx.stroke(); ctx.restore();
    }
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(sw.body.getAngle());
    const r = d.r, n = Math.max(12, Math.round(r * 9));
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * 6.283, a1 = ((i + 0.6) / n) * 6.283;
      ctx.lineTo(Math.cos(a0) * r * 0.86, Math.sin(a0) * r * 0.86);
      ctx.lineTo(Math.cos(a1) * r * 1.0, Math.sin(a1) * r * 1.0);
    }
    ctx.closePath();
    const g = ctx.createRadialGradient(0, 0, r * 0.1, 0, 0, r);
    g.addColorStop(0, '#f1f4f8'); g.addColorStop(0.7, '#aab4c2'); g.addColorStop(1, '#6b7686');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = '#4b5463'; ctx.lineWidth = 0.05; ctx.stroke();
    ctx.fillStyle = 'rgba(80,90,105,0.5)';
    for (let i = 0; i < 4; i++) { ctx.rotate(1.5708); ctx.beginPath(); ctx.ellipse(r * 0.5, 0, r * 0.18, r * 0.07, 0, 0, 6.283); ctx.fill(); }
    ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.arc(0, 0, r * 0.16, 0, 6.283); ctx.fill();
    ctx.restore();
  }

  function drawStar(x, y, r, t) {
    ctx.save();
    ctx.translate(x, y);
    const pulse = 1 + Math.sin(t * 5 + x) * 0.08;
    ctx.scale(pulse, pulse);
    ctx.rotate(Math.sin(t * 2 + x) * 0.3);
    const gl = ctx.createRadialGradient(0, 0, r * 0.3, 0, 0, r * 1.7);
    gl.addColorStop(0, 'rgba(255,236,120,0.55)'); gl.addColorStop(1, 'rgba(255,220,80,0)');
    ctx.fillStyle = gl;
    ctx.beginPath(); ctx.arc(0, 0, r * 1.7, 0, 6.283); ctx.fill();
    ctx.beginPath();
    for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    ctx.closePath();
    ctx.fillStyle = '#ffd92e'; ctx.fill();
    ctx.strokeStyle = '#b8860b'; ctx.lineWidth = 0.06; ctx.stroke();
    ctx.restore();
  }

  function drawFlag(cp, up, passed, t) {
    ctx.save();
    ctx.translate(cp.x, cp.y);
    if (up < 0) ctx.scale(1, -1);
    ctx.fillStyle = '#d7dde6'; ctx.fillRect(-0.06, 0, 0.12, 3.2);
    ctx.fillStyle = passed ? '#38d26b' : '#ff5a3c';
    ctx.beginPath(); ctx.moveTo(0.06, 3.2);
    for (let i = 0; i <= 6; i++) ctx.lineTo(0.06 + i * 0.22, 3.2 - 0.05 + Math.sin(t * 6 + i) * 0.08 * (i / 6));
    for (let i = 6; i >= 0; i--) ctx.lineTo(0.06 + i * 0.22, 2.35 - 0.05 + Math.sin(t * 6 + i) * 0.08 * (i / 6) + (i / 6) * 0.15);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function drawFinish(f, t) {
    ctx.save();
    ctx.translate(f.x, f.y);
    if (f.up < 0) ctx.scale(1, -1);
    ctx.fillStyle = '#e8edf4';
    ctx.fillRect(-2.6, 0, 0.18, 5.2); ctx.fillRect(2.42, 0, 0.18, 5.2);
    const cs = 0.4;
    for (let i = 0; i < 13; i++) for (let j = 0; j < 2; j++) {
      ctx.fillStyle = (i + j) % 2 ? '#111' : '#fff';
      const wave = Math.sin(t * 4 + i * 0.5) * 0.08;
      ctx.fillRect(-2.6 + i * cs, 4.4 + j * cs + wave, cs, cs);
    }
    ctx.restore();
  }

  function drawSignPost(sg) {
    ctx.save();
    ctx.translate(sg.x, sg.y);
    if (sg.up < 0) ctx.scale(1, -1);
    ctx.fillStyle = '#5a3b26'; ctx.fillRect(-0.08, 0, 0.16, 1.6);
    ctx.fillStyle = sg.icon === 'warn' ? '#f2b705' : '#8a5a36';
    roundRect(-0.65, 1.45, 1.3, 1.0, 0.15); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 0.06; ctx.stroke();
    ctx.restore();
  }
  function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  const TUT = {
    tilt: { tilt: 'Handy neigen = drehen', jump: 'Nach oben wischen = Springen', duck: 'Nach unten wischen = Ducken', grab: 'Linke/rechte Hälfte halten = Grab', flip: 'In der Luft neigen = Flip', land: 'Gerade landen = Bonus ×2' },
    buttons: { tilt: '⟲ ⟳ links = drehen', jump: 'Nach oben wischen = Springen', duck: 'Nach unten wischen = Ducken', grab: 'Rechte Tasten halten = Grab', flip: 'In der Luft ⟲/⟳ = Flip', land: 'Gerade landen = Bonus ×2' },
    keys: { tilt: '← → = drehen', jump: '↑ = Springen', duck: '↓ = Ducken', grab: 'A / D halten = Grab', flip: '← → in der Luft = Flip', land: 'Gerade landen = Bonus ×2' },
  };
  function drawSignFace(sg) {
    const up = sg.up;
    const [x, y] = w2s(sg.x, sg.y + 1.95 * up);
    const sc = game.cam.s;
    ctx.save();
    ctx.translate(x, y);
    const k = sc / 30;
    ctx.scale(k, k);
    // Symbol
    ctx.strokeStyle = '#fff'; ctx.fillStyle = '#fff'; ctx.lineWidth = 3.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const ic = sg.icon;
    ctx.beginPath();
    if (ic === 'jump') { ctx.moveTo(0, 9); ctx.lineTo(0, -9); ctx.moveTo(-7, -2); ctx.lineTo(0, -9); ctx.lineTo(7, -2); }
    else if (ic === 'duck') { ctx.moveTo(0, -9); ctx.lineTo(0, 9); ctx.moveTo(-7, 2); ctx.lineTo(0, 9); ctx.lineTo(7, 2); }
    else if (ic === 'flip' || ic === 'tilt') { ctx.arc(0, 0, 8, -2.6, 2.0); ctx.moveTo(-3, 9); ctx.lineTo(-3.6, 6.5); ctx.lineTo(-6.5, 5.5); }
    else if (ic === 'grab') { ctx.moveTo(-9, 4); ctx.lineTo(9, 4); ctx.moveTo(-3, -7); ctx.lineTo(-3, 3); ctx.moveTo(3, -7); ctx.lineTo(3, 3); }
    else if (ic === 'land') { ctx.moveTo(-10, 6); ctx.lineTo(10, 6); ctx.moveTo(-6, 1); ctx.lineTo(6, 1); ctx.moveTo(-4, -7); ctx.lineTo(4, -7); ctx.moveTo(0, -7); ctx.lineTo(0, -2); }
    else if (ic === 'warn') { ctx.strokeStyle = '#222'; ctx.moveTo(0, -8); ctx.lineTo(0, 3); ctx.moveTo(0, 8); ctx.lineTo(0, 8.5); }
    else if (ic === 'arrow') { ctx.moveTo(-9, 0); ctx.lineTo(9, 0); ctx.moveTo(2, -7); ctx.lineTo(9, 0); ctx.lineTo(2, 7); }
    else if (ic === 'arrowUp') { ctx.moveTo(-8, 8); ctx.lineTo(8, -8); ctx.moveTo(-1, -8); ctx.lineTo(8, -8); ctx.lineTo(8, 1); }
    else if (ic === 'arrowDown') { ctx.moveTo(-8, -8); ctx.lineTo(8, 8); ctx.moveTo(-1, 8); ctx.lineTo(8, 8); ctx.lineTo(8, -1); }
    ctx.stroke();
    // Text
    const tut = TUT[S.control] || TUT.tilt;
    const text = sg.text ? (tut[ic] && sg.tut !== false ? tut[ic] : sg.text) : null;
    if (text) {
      ctx.font = '700 15px -apple-system, Segoe UI, Roboto, sans-serif';
      ctx.textAlign = 'center';
      const tw = ctx.measureText(text).width + 16;
      ctx.fillStyle = 'rgba(10,20,45,0.72)';
      roundRectS(-tw / 2, -50, tw, 26, 9); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillText(text, 0, -32);
    }
    ctx.restore();
  }
  function roundRectS(x, y, w, h, r) { roundRect(x, y, w, h, r); }

  // Fahrer
  const COL = { board: '#ff7a1a', boardB: '#1d2233', pants: '#22325a', jacket: '#e8412f', jacketD: '#b52c1f', skin: '#f2c9a0', helmet: '#f5f7fb', glove: '#1b1f2a', goggle: '#ffb02e' };
  function limb(a, b, w, col) { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
  function drawHead(x, y, ang) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    ctx.fillStyle = COL.skin; ctx.beginPath(); ctx.arc(0, 0, 0.17, 0, 6.283); ctx.fill();
    ctx.fillStyle = COL.helmet; ctx.beginPath(); ctx.arc(0, 0.01, 0.185, -0.25, Math.PI + 0.25); ctx.closePath(); ctx.fill();
    ctx.fillStyle = COL.goggle; roundRect(-0.15, -0.06, 0.3, 0.09, 0.04); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(-0.1, -0.03, 0.06, 0.03);
    ctx.restore();
  }
  function drawBoard(len) {
    ctx.fillStyle = COL.boardB;
    roundRect(-len, -0.075, len * 2, 0.15, 0.075); ctx.fill();
    ctx.fillStyle = COL.board;
    roundRect(-len + 0.02, -0.03, len * 2 - 0.04, 0.09, 0.045); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.fillRect(-0.15, 0.0, 0.3, 0.03);
  }
  function drawRider(s) {
    const r = s.rider;
    const p = r.getPosition();
    const pose = s.currentPose();
    const q = {}; J.forEach((k, i) => (q[k] = pose[i]));
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(r.getAngle());
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // hinterer Arm
    limb(q.neck, q.e1, 0.13, COL.jacketD); limb(q.e1, q.h1, 0.12, COL.jacketD);
    ctx.fillStyle = COL.glove; ctx.beginPath(); ctx.arc(q.h1[0], q.h1[1], 0.075, 0, 6.283); ctx.fill();
    // Beine
    limb(q.f1, q.k1, 0.19, COL.pants); limb(q.k1, q.hip, 0.21, COL.pants);
    limb(q.f2, q.k2, 0.19, COL.pants); limb(q.k2, q.hip, 0.21, COL.pants);
    // Brett
    drawBoard(0.72);
    ctx.fillStyle = '#111'; ctx.fillRect(q.f1[0] - 0.1, 0.04, 0.2, 0.07); ctx.fillRect(q.f2[0] - 0.1, 0.04, 0.2, 0.07);
    // Oberkörper
    limb(q.hip, q.neck, 0.32, COL.jacket);
    // vorderer Arm
    limb(q.neck, q.e2, 0.13, COL.jacket); limb(q.e2, q.h2, 0.12, COL.jacket);
    ctx.fillStyle = COL.glove; ctx.beginPath(); ctx.arc(q.h2[0], q.h2[1], 0.075, 0, 6.283); ctx.fill();
    const ha = Math.atan2(q.head[1] - q.neck[1], q.head[0] - q.neck[0]) - Math.PI / 2;
    drawHead(q.head[0], q.head[1], ha);
    ctx.restore();
  }
  function drawRagdoll(s) {
    const P = s.ragParts;
    ctx.lineCap = 'round';
    const seg = (part, col) => {
      const b = part.body, p = b.getPosition(), a = b.getAngle();
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(a);
      ctx.strokeStyle = col; ctx.lineWidth = part.th + 0.02;
      ctx.beginPath(); ctx.moveTo(-part.len / 2, 0); ctx.lineTo(part.len / 2, 0); ctx.stroke();
      ctx.restore();
    };
    seg(P.arm1, COL.jacketD); seg(P.fore1, COL.jacketD);
    seg(P.shin1, COL.pants); seg(P.thigh1, COL.pants); seg(P.shin2, COL.pants); seg(P.thigh2, COL.pants);
    if (s.ragBoard) {
      const b = s.ragBoard, p = b.getPosition();
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(b.getAngle()); drawBoard(0.72); ctx.restore();
    }
    seg(P.torso, COL.jacket); seg(P.arm2, COL.jacket); seg(P.fore2, COL.jacket);
    const h = P.head.body, hp = h.getPosition();
    drawHead(hp.x, hp.y, h.getAngle());
  }

  function drawHUD(s, L) {
    const pad = 12;
    const x0 = safe.l + pad, y0 = safe.t + pad;
    ctx.textAlign = 'left';
    ctx.font = '900 italic 24px -apple-system, Segoe UI, Roboto, sans-serif';
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.fillStyle = '#fff';
    const sc = fmt(s.banked);
    ctx.strokeText(sc, x0, y0 + 22); ctx.fillText(sc, x0, y0 + 22);
    if (s.pending > 0) {
      const w = ctx.measureText(sc).width;
      ctx.font = '800 italic 18px -apple-system, Segoe UI, Roboto, sans-serif';
      ctx.fillStyle = '#ffd34d';
      const t = ' +' + fmt(s.pending);
      ctx.strokeText(t, x0 + w, y0 + 21); ctx.fillText(t, x0 + w, y0 + 21);
    }
    // Sterne
    ctx.save(); ctx.translate(x0 + 9, y0 + 42); ctx.scale(18, -18); drawStar(0, 0, 0.5, 0); ctx.restore();
    ctx.font = '800 16px -apple-system, Segoe UI, Roboto, sans-serif'; ctx.fillStyle = '#fff';
    const st = `${s.starsTaken()}/${s.stars.length}`;
    ctx.strokeText(st, x0 + 22, y0 + 48); ctx.fillText(st, x0 + 22, y0 + 48);
    // Zeit
    ctx.textAlign = 'center';
    const tm = fmtTime(s.time);
    ctx.font = '800 17px -apple-system, Segoe UI, Roboto, sans-serif';
    ctx.strokeText(tm, W / 2, y0 + 20); ctx.fillText(tm, W / 2, y0 + 20);
    // Levelname am Anfang
    if (game.introT < 2.5) {
      const a = Math.min(1, (2.5 - game.introT) * 2);
      ctx.globalAlpha = a;
      ctx.font = '900 italic 30px -apple-system, Segoe UI, Roboto, sans-serif';
      const t = `${game.idx + 1}. ${L.name}`;
      ctx.strokeText(t, W / 2, H * 0.3); ctx.fillText(t, W / 2, H * 0.3);
      ctx.globalAlpha = 1;
    }
    // Popups
    let py = H * 0.22;
    for (const p of game.popups) {
      const k = p.t / p.dur;
      const a = k < 0.1 ? k / 0.1 : k > 0.75 ? (1 - k) / 0.25 : 1;
      const sc2 = 1 + Math.max(0, 0.15 - p.t) * 2;
      ctx.globalAlpha = Math.max(0, a);
      ctx.save(); ctx.translate(W / 2, py); ctx.scale(sc2, sc2);
      ctx.font = `900 italic ${p.small ? 18 : 26}px -apple-system, Segoe UI, Roboto, sans-serif`;
      ctx.fillStyle = p.color || (p.small ? '#ffe36b' : '#fff');
      ctx.strokeText(p.text, 0, 0); ctx.fillText(p.text, 0, 0);
      if (p.sub) {
        ctx.font = '800 15px -apple-system, Segoe UI, Roboto, sans-serif'; ctx.fillStyle = '#ffd34d';
        ctx.strokeText(p.sub, 0, 22); ctx.fillText(p.sub, 0, 22);
      }
      ctx.restore();
      py += p.sub ? 52 : 32;
    }
    ctx.globalAlpha = 1;
    // Sturz-Hinweis
    if (s.state === 'dead' && s.deadT > 0.6) {
      ctx.globalAlpha = 0.6 + Math.sin(s.deadT * 5) * 0.3;
      ctx.font = '800 20px -apple-system, Segoe UI, Roboto, sans-serif'; ctx.fillStyle = '#fff';
      const t = isTouch ? 'Tippen zum Weiterfahren' : 'Leertaste zum Weiterfahren';
      ctx.strokeText(t, W / 2, H * 0.62); ctx.fillText(t, W / 2, H * 0.62);
      ctx.globalAlpha = 1;
    }
    // Touch-Tasten
    if (isTouch && s.state === 'alive') drawTouchUI(s);
    // Neigungsanzeige (klein)
    if (S.control === 'tilt' && isTouch && tiltSt.seen) {
      const v = tiltValue();
      ctx.save(); ctx.translate(W / 2, H - safe.b - 14);
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; roundRect(-50, -3, 100, 6, 3); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(v * 47, 0, 5, 0, 6.283); ctx.fill();
      ctx.restore();
    }
  }
  const fmtTime = (t) => { const m = Math.floor(t / 60), s = t - m * 60; return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`; };

  function drawTouchUI(s) {
    const act = { grabL: input.grabL, grabR: input.grabR };
    const r = 34, yb = H - safe.b - r - 14;
    const btn = (x, label, on) => {
      ctx.globalAlpha = on ? 0.55 : 0.22;
      ctx.fillStyle = on ? '#ffd34d' : '#fff';
      ctx.beginPath(); ctx.arc(x, yb, r, 0, 6.283); ctx.fill();
      ctx.globalAlpha = on ? 0.95 : 0.6;
      ctx.fillStyle = '#0d1630';
      const big = label.length === 1;
      ctx.font = `800 ${big ? 26 : 12}px -apple-system, Segoe UI, Roboto, sans-serif`; ctx.textAlign = 'center';
      ctx.fillText(label, x, yb + (big ? 9 : 4));
      ctx.globalAlpha = 1;
    };
    if (S.control === 'buttons') {
      btn(safe.l + 14 + r, '⟲', input.tilt < 0);
      btn(safe.l + 14 + r * 3 + 12, '⟳', input.tilt > 0);
      btn(W - safe.r - 14 - r * 3 - 12, 'TAIL', act.grabL);
      btn(W - safe.r - 14 - r, 'NOSE', act.grabR);
    } else {
      btn(safe.l + 14 + r, 'TAIL', act.grabL);
      btn(W - safe.r - 14 - r, 'NOSE', act.grabR);
    }
  }

  // Menü-Hintergrund
  let menuT = 0;
  function renderMenuBg(dt) {
    menuT += dt;
    drawBackground(THEMES[0], menuT * 25, 0, 0, menuT);
  }

  // ---------- Ergebnis ----------
  function cupOf(L, score) { const c = L.cups; return score >= c[2] ? 'g' : score >= c[1] ? 's' : score >= c[0] ? 'b' : 'n'; }
  function showResult() {
    const s = game.sim, L = game.L;
    game.mode = 'result';
    $('pauseBtn').style.display = 'none';
    const sc = s.score(), cup = cupOf(L, sc);
    const best = prog.best[game.idx] || { score: 0, stars: 0, cup: 'n' };
    const isBest = sc > best.score;
    const rank = { n: 0, b: 1, s: 2, g: 3 };
    prog.best[game.idx] = { score: Math.max(best.score, sc), stars: Math.max(best.stars, s.starsTaken()), cup: rank[cup] > rank[best.cup || 'n'] ? cup : best.cup, time: Math.min(best.time || 1e9, s.time) };
    prog.unlocked = Math.max(prog.unlocked, Math.min(LEVELS.length, game.idx + 2));
    saveP();
    const cupEl = $('rCup');
    cupEl.className = 'bigcup cup ' + cup;
    cupEl.textContent = { g: '1', s: '2', b: '3', n: '–' }[cup];
    $('rTitle').textContent = { g: 'Gold-Pokal!', s: 'Silber-Pokal!', b: 'Bronze-Pokal!', n: 'Geschafft!' }[cup];
    $('rScore').textContent = fmt(sc);
    $('rStars').textContent = `${s.starsTaken()}/${s.stars.length}`;
    $('rTime').textContent = fmtTime(s.time);
    $('rFalls').textContent = s.falls;
    const need = cup === 'g' ? '' : `Nächster Pokal ab ${fmt(L.cups[{ n: 0, b: 1, s: 2 }[cup]])} Punkten · `;
    $('rBest').textContent = (isBest && best.score > 0 ? 'Neuer Rekord! · ' : '') + need + `Rekord: ${fmt(prog.best[game.idx].score)}`;
    $('rNext').style.display = game.idx + 1 < LEVELS.length ? 'inline-block' : 'none';
    showOv('result');
  }

  // ---------- Menüs ----------
  const ovs = ['menu', 'levels', 'settings', 'help', 'pause', 'result'];
  let settingsFrom = 'menu';
  function showOv(id) {
    for (const o of ovs) $(o).classList.toggle('show', o === id);
  }
  function buildGrid() {
    const g = $('grid'); g.innerHTML = '';
    LEVELS.forEach((lv, i) => {
      const b = prog.best[i];
      const d = document.createElement('div');
      d.className = 'lv' + (i >= prog.unlocked ? ' locked' : '');
      d.innerHTML = `<div class="n">${i + 1}</div><div class="t">${lv.name}</div><div class="s">${b ? `<span class="cup ${b.cup}"></span>${fmt(b.score)} · ★${b.stars}` : i < prog.unlocked ? 'Neu' : '🔒'}</div>`;
      d.onclick = () => startLevel(i);
      g.appendChild(d);
    });
  }
  const tap = (id, fn) => $(id).addEventListener('click', (e) => { e.preventDefault(); audioInit(); fn(); });
  tap('bPlay', async () => {
    if (isTouch && S.control === 'tilt') {
      const ok = await askMotion();
      if (!ok) { S.control = 'buttons'; saveS(); toast('Bewegungssensor nicht erlaubt – Tasten-Steuerung aktiv. In den Einstellungen änderbar.', 4500); }
    }
    buildGrid(); showOv('levels');
  });
  tap('bSettings', () => { settingsFrom = 'menu'; syncSettings(); showOv('settings'); });
  tap('bHelp', () => showOv('help'));
  document.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', () => showOv(b.dataset.back)));
  tap('sBack', () => { if (settingsFrom === 'pause') showOv('pause'); else showOv('menu'); });
  tap('pResume', resume);
  tap('pCp', () => { resume(); game.sim.crash('reset'); game.sim.respawn(); });
  tap('pRestart', () => startLevel(game.idx));
  tap('pSettings', () => { settingsFrom = 'pause'; syncSettings(); showOv('settings'); });
  tap('pLevels', () => { game.mode = 'menu'; game.sim = null; $('pauseBtn').style.display = 'none'; buildGrid(); showOv('levels'); });
  tap('rNext', () => startLevel(game.idx + 1));
  tap('rAgain', () => startLevel(game.idx));
  tap('rLevels', () => { game.mode = 'menu'; game.sim = null; buildGrid(); showOv('levels'); });
  $('pauseBtn').addEventListener('touchstart', (e) => { e.preventDefault(); togglePause(); }, { passive: false });
  $('pauseBtn').addEventListener('click', (e) => { e.preventDefault(); togglePause(); });

  function segSet(id, val, fn) {
    const el = $(id);
    el.querySelectorAll('button').forEach((b) => {
      b.classList.toggle('on', b.dataset.v === String(val));
      b.onclick = () => { fn(b.dataset.v); syncSettings(); saveS(); };
    });
  }
  function syncSettings() {
    segSet('sCtrl', S.control === 'keys' ? 'buttons' : S.control, async (v) => {
      if (!isTouch) { toast('Am Computer wird mit der Tastatur gesteuert.'); return; }
      if (v === 'tilt') { const ok = await askMotion(); if (!ok) { toast('Bewegungssensor nicht erlaubt.'); return; } }
      S.control = v; saveS(); syncSettings();
    });
    segSet('sInv', S.invert ? 1 : 0, (v) => (S.invert = v === '1'));
    segSet('sSnd', S.sound ? 1 : 0, (v) => { S.sound = v === '1'; if (master) master.gain.value = S.sound ? 0.6 : 0; });
    const sl = $('sSens');
    sl.value = S.sens;
    $('sSensL').textContent = `Voller Ausschlag bei ${S.sens}° Neigung`;
    sl.oninput = () => { S.sens = +sl.value; $('sSensL').textContent = `Voller Ausschlag bei ${S.sens}° Neigung`; saveS(); };
    $('sCalL').textContent = S.calib ? `Gesetzt: ${((S.calib * 180) / Math.PI).toFixed(1)}° – Handy in Spielhaltung halten und tippen` : 'Handy in Spielhaltung halten und tippen';
  }
  tap('sCal', async () => {
    await askMotion();
    setTimeout(() => {
      if (!tiltSt.seen) { toast('Kein Bewegungssensor gefunden.'); return; }
      S.calib = tiltSt.raw; saveS(); syncSettings(); toast('Neutralstellung gespeichert.');
    }, 300);
  });
  tap('sUnlock', () => { prog.unlocked = LEVELS.length; saveP(); toast('Alle Level freigeschaltet.'); });

  if (isTouch && !standalone) {
    $('installHint').innerHTML = isIOS ? 'Tipp: In Safari auf <b>Teilen</b> → <b>Zum Home-Bildschirm</b> tippen, dann läuft das Spiel im Vollbild.' : '';
  } else if (!isTouch) {
    $('installHint').innerHTML = 'Steuerung am Computer: <kbd>←</kbd><kbd>→</kbd> drehen · <kbd>↑</kbd> springen · <kbd>↓</kbd> ducken · <kbd>A</kbd>/<kbd>D</kbd> Grabs';
  }

  // Seite im Hintergrund -> Pause
  document.addEventListener('visibilitychange', () => { if (document.hidden && game.mode === 'play') togglePause(); });

  // Testzugang (für automatisierte Tests)
  window.__game = { game, startLevel, input, keys, tiltSt, S };
  const fromHash = () => {
    const qs = location.hash.match(/level(\d+)/); if (qs && LEVELS[+qs[1] - 1]) startLevel(+qs[1] - 1);
    const ov = location.hash.match(/overview(\d+)/);
    if (ov) {
      startLevel(+ov[1] - 1); game.mode = 'overview';
      const b = game.L.bounds;
      game.cam.x = (b.minX + b.maxX) / 2; game.cam.y = (b.minY + b.maxY) / 2; game.cam.rot = 0;
      game.cam.s = Math.min(W / (b.maxX - b.minX + 10), H / (b.maxY - b.minY + 10));
      baseScale = () => game.cam.s;
      updateCam = () => {};
      game.introT = 99;
    }
  };
  window.addEventListener('hashchange', fromHash);
  fromHash();

  requestAnimationFrame(frame);
})();
