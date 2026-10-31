/* Snow Stunt 2 – Darstellung, Eingabe, Menüs */
(function () {
  'use strict';
  const { Sim, J, DT, wrap, clamp, lerp } = SIM;
  const RSV = SIM.RS;
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
  const prog = Object.assign({ unlocked: LEVELS.length, best: {} }, store.get('progress2', {}));
  const saveS = () => store.set('settings', S);
  const saveP = () => store.set('progress2', prog);

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
    ice() { tone(2400, 1800, 0.12, 'sine', 0.06); },
    shatter() { noise(0.25, 6000, 0.25); tone(3000, 1500, 0.1, 'triangle', 0.08); },
    rail() { tone(1500, 1200, 0.08, 'square', 0.05); noise(0.12, 5000, 0.15); },
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
    orientMarkers(game.L, game.sim);
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
    for (const t of L.terrain) {
      const p = new Path2D();
      t.poly.forEach((q, i) => (i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1])));
      p.closePath();
      t.path = p;
      const s = new Path2D();
      t.surf.forEach((q, i) => (i ? s.lineTo(q[0], q[1]) : s.moveTo(q[0], q[1])));
      t.spath = s;
      // Eisfacetten
      const [x0, y0, x1, y1] = t.bb;
      const f = new Path2D(), sh = new Path2D();
      const n = Math.min(60, Math.ceil(((x1 - x0) * (y1 - y0)) / 30));
      let seed = Math.floor(x0 * 13 + y0 * 7);
      const rnd = () => { seed = (seed * 16807 + 11) % 2147483647; return (seed % 10000) / 10000; };
      for (let i = 0; i < n; i++) {
        const x = x0 + rnd() * (x1 - x0), y = y0 + rnd() * (y1 - y0), l = 0.8 + rnd() * 2.5, a = rnd() * Math.PI;
        f.moveTo(x, y); f.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); f.lineTo(x + Math.cos(a + 0.9) * l * 0.6, y + Math.sin(a + 0.9) * l * 0.6);
        if (i % 3 === 0) { sh.moveTo(x, y); sh.lineTo(x + l * 0.7, y + l * 0.2); sh.lineTo(x + l * 0.4, y - l * 0.6); sh.closePath(); }
      }
      t.facets = f; t.shine = sh;
    }
    L.theme = THEMES[L.theme || 0];
  }
  function orientMarkers(L, sim) {
    const upAt = (x, y) => (sim.rayGround(x, y + 0.6, x, y - 1.6) ? 1 : sim.rayGround(x, y - 0.6, x, y + 1.6) ? -1 : 1);
    for (const c of L.checkpoints) c.up = upAt(c.x, c.y);
    L.finish.up = upAt(L.finish.x, L.finish.y);
    for (const s of L.signs) s.up = s.inv ? -1 : upAt(s.x, s.y);
  }

  function snapCam() {
    const f = game.sim.focus();
    game.cam.x = f.x + 4; game.cam.y = f.y + 1.5;
    game.cam.rot = game.sim.camTarget();
    game.cam.s = baseScale();
  }
  let baseScale = () => Math.max(H, 300) / 11.5;

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
        case 'gravity': sfx.gravity(); popup('Schwerkraft!', null, 0.8, true, '#e7a6ff'); break;
        case 'pickup': sfx.boost(); sparkle(e.x, e.y, '#6dff8a'); popup('Speed!', null, 0.7, true, '#8dff9e'); break;
        case 'icicle': sfx.ice(); break;
        case 'shatter': for (let i = 0; i < 12; i++) game.parts.push({ x: e.x, y: e.y, vx: (Math.random() - 0.5) * 8, vy: Math.random() * 6, t: 0, d: 0.7, r: 0.12 + Math.random() * 0.12, c: '#d9f4ff', g: 1, shard: true }); sfx.shatter(); break;
        case 'rail': sfx.rail(); break;
        case 'spawn': if (e.inv !== undefined) {} break;
      }
    }
    s.events.length = 0;
  }
  function crashText(r) {
    return { ice: 'Eiszapfen!', hazard: 'Autsch!', head: 'Sturz!', landing: 'Schief gelandet!', grab: 'Grab nicht losgelassen!', fall: 'Abgestürzt!', reset: 'Zurück zum Checkpoint' }[r] || 'Sturz!';
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
    // Höhe über dem Boden -> rauszoomen bei großen Sprüngen
    let hgt = 0;
    if (s.rider && !s.grounded) {
      const g = s.gdir, R = 70;
      const hit = s.rayGround(f.x, f.y, f.x + g.x * R + vx * 0.3, f.y + g.y * R + vy * 0.3);
      hgt = hit ? hit.frac * R : R;
    }
    game.hgt = lerp(game.hgt || 0, hgt, 1 - Math.exp(-dt * 3));
    const zs = baseScale() * clamp(1.08 - sp / 85, 0.72, 1.05) * clamp(1 - Math.max(0, game.hgt - 2.5) / 30, 0.42, 1);
    c.s += (zs - c.s) * (1 - Math.exp(-dt * (zs < c.s ? 2.5 : 1.2)));
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
    if (s.rider && s.grounded && !s.rail && s.state === 'alive') {
      const v = s.rider.getLinearVelocity(), sp = v.length();
      if (sp > 5 && Math.random() < Math.min(1, sp / 18)) {
        const dir = Math.sign(v.x * Math.cos(s.rider.getAngle()) + v.y * Math.sin(s.rider.getAngle())) || 1;
        const p = s.rider.getWorldPoint(SIM_V(-0.6 * dir, 0));
        const n = s.groundN;
        game.parts.push({ x: p.x, y: p.y, vx: -v.x * 0.15 + n.x * (2 + Math.random() * 3), vy: -v.y * 0.15 + n.y * (2 + Math.random() * 3), t: 0, d: 0.45, r: 0.07 + Math.random() * 0.12, c: '#fff', g: 1 });
      }
    }
    if (s.rider && s.rail && s.state === 'alive' && Math.abs(s.rail.v) > 3 && Math.random() < 0.8) {
      const p = s.rider.getPosition(), v = s.rider.getLinearVelocity();
      game.parts.push({ x: p.x - s.groundN.x * 0.2, y: p.y - s.groundN.y * 0.2, vx: -v.x * 0.2 + (Math.random() - 0.5) * 3, vy: -v.y * 0.2 + Math.random() * 3, t: 0, d: 0.3, r: 0.05, c: Math.random() < 0.5 ? '#fff6b0' : '#ffb347', g: 1 });
    }
    const g = s.world.getGravity();
    for (const p of game.parts) { p.t += dt; p.vx += g.x * 0.3 * p.g * dt; p.vy += g.y * 0.3 * p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
    game.parts = game.parts.filter((p) => p.t < p.d);
    for (const p of game.popups) p.t += dt;
    game.popups = game.popups.filter((p) => p.t < p.dur);
  }

  // ---------- Themen (Tag, Gletscher, Eisberge) ----------
  const THEMES = [
    { sky: ['#2f86d8', '#74baf2', '#d9f2ff'], sea: ['#2a78bf', '#185a99'], peakL: '#f6fbff', peakS: '#a9cdea', far: '#c9e4f7', glacier: ['#e9f7ff', '#8fd0ee', '#4fa6d4'], ice: ['#d5f1ff', '#7cc6ec', '#3f93cc'], edge: '#2a6aa3', snow: '#ffffff', snowSh: '#b6d8f2', sun: '#fff7d6', cloud: 'rgba(255,255,255,0.85)' },
    { sky: ['#1f7ccc', '#5fb2ee', '#cdeeff'], sea: ['#1f6fb5', '#124f8c'], peakL: '#f3faff', peakS: '#9cc4e6', far: '#bcdcf3', glacier: ['#e4f6ff', '#7fc7ea', '#3b97cc'], ice: ['#ccf0ff', '#6fc3ec', '#2f86c4'], edge: '#235f99', snow: '#ffffff', snowSh: '#a9d2f0', sun: '#fffbe6', cloud: 'rgba(255,255,255,0.9)' },
    { sky: ['#3a8fd6', '#8cc8f2', '#fff1d9'], sea: ['#2f7fbf', '#1c5e99'], peakL: '#fffaf3', peakS: '#b7c9e3', far: '#d9e4f2', glacier: ['#f0f8ff', '#9ed3ef', '#58a9d6'], ice: ['#dff3ff', '#8acbee', '#4b9bd0'], edge: '#2d6aa0', snow: '#ffffff', snowSh: '#c3dcf0', sun: '#fff0c4', cloud: 'rgba(255,250,240,0.9)' },
    { sky: ['#1b6fc2', '#4fa6ea', '#bfe8ff'], sea: ['#1a68ad', '#0f4a85'], peakL: '#eef8ff', peakS: '#8fbbe2', far: '#b0d4f0', glacier: ['#dff4ff', '#6dbfe8', '#2f8fca'], ice: ['#c4ecff', '#62bbea', '#2a7fc0'], edge: '#1f5791', snow: '#ffffff', snowSh: '#a3cdee', sun: '#ffffff', cloud: 'rgba(255,255,255,0.9)' },
  ];

  // deterministischer Zufall für Hintergrundobjekte
  const hrand = (i, s) => { const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return x - Math.floor(x); };

  function drawBackground(theme, camX, camY, rot, t) {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate(-rot);
    const R = Math.hypot(W, H) / 2 + 10;
    const s = game.cam.s || 30;
    // Horizont folgt der Kamera nur leicht
    const hor = clamp(H * 0.12 + camY * s * 0.04, -H * 0.25, H * 0.42);
    const gr = ctx.createLinearGradient(0, -R, 0, hor);
    gr.addColorStop(0, theme.sky[0]); gr.addColorStop(0.6, theme.sky[1]); gr.addColorStop(1, theme.sky[2]);
    ctx.fillStyle = gr; ctx.fillRect(-R, -R, 2 * R, R + hor + 1);
    // Sonne
    const sx = R * 0.42, sy = -R * 0.42;
    const sg = ctx.createRadialGradient(sx, sy, 10, sx, sy, 160);
    sg.addColorStop(0, 'rgba(255,252,235,0.95)'); sg.addColorStop(0.15, 'rgba(255,248,210,0.6)'); sg.addColorStop(1, 'rgba(255,248,210,0)');
    ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(sx, sy, 160, 0, 6.283); ctx.fill();
    ctx.fillStyle = theme.sun; ctx.beginPath(); ctx.arc(sx, sy, 30, 0, 6.283); ctx.fill();
    // Wolken
    ctx.fillStyle = theme.cloud;
    for (let i = 0; i < 7; i++) {
      const span = 2 * R + 400;
      const x = ((hrand(i, 1) * span - camX * s * 0.03 - t * 6 * (0.5 + hrand(i, 2))) % span + span) % span - R - 200;
      const y = -R * 0.85 + hrand(i, 3) * R * 0.6 + hor * 0.2;
      const w = 70 + hrand(i, 4) * 90;
      ctx.globalAlpha = 0.55 + hrand(i, 5) * 0.35;
      ctx.beginPath();
      ctx.ellipse(x, y, w, w * 0.28, 0, 0, 6.283);
      ctx.ellipse(x - w * 0.45, y + 6, w * 0.5, w * 0.22, 0, 0, 6.283);
      ctx.ellipse(x + w * 0.4, y + 4, w * 0.55, w * 0.24, 0, 0, 6.283);
      ctx.ellipse(x + w * 0.05, y - w * 0.14, w * 0.45, w * 0.25, 0, 0, 6.283);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Gletscherberge (zwei Ebenen)
    const peaks = (par, spacing, hmin, hmax, seed, light, shade, base) => {
      const off = camX * s * par;
      const k0 = Math.floor((off - R - spacing) / spacing), k1 = Math.ceil((off + R + spacing) / spacing);
      for (let k = k0; k <= k1; k++) {
        const cx = k * spacing - off + (hrand(k, seed) - 0.5) * spacing * 0.5;
        const h = hmin + hrand(k, seed + 1) * (hmax - hmin);
        const w = spacing * (0.7 + hrand(k, seed + 2) * 0.6);
        const ax = cx + (hrand(k, seed + 3) - 0.5) * w * 0.3, ay = base - h;
        const lx = cx - w, rx = cx + w;
        ctx.fillStyle = light;
        ctx.beginPath(); ctx.moveTo(lx, base); ctx.lineTo(ax - w * 0.18, ay + h * 0.35); ctx.lineTo(ax, ay); ctx.lineTo(ax + w * 0.22, ay + h * 0.3); ctx.lineTo(rx, base); ctx.closePath(); ctx.fill();
        ctx.fillStyle = shade;
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax + w * 0.22, ay + h * 0.3); ctx.lineTo(rx, base); ctx.lineTo(ax + w * 0.1, base); ctx.lineTo(ax + w * 0.05, ay + h * 0.55); ctx.closePath(); ctx.fill();
      }
    };
    peaks(0.02, 260, H * 0.22, H * 0.42, 11, theme.far, theme.peakS, hor);
    peaks(0.05, 200, H * 0.12, H * 0.3, 21, theme.peakL, theme.peakS, hor + 4);
    // Gletscherkante (Eisklippen) vorne links/rechts mit Spalten
    const gOff = camX * s * 0.09;
    const gw = 900;
    const g0 = Math.floor((gOff - R) / gw), g1 = Math.ceil((gOff + R) / gw);
    for (let k = g0; k <= g1; k++) {
      if (hrand(k, 40) < 0.45) continue;
      const x0 = k * gw - gOff, wdt = 260 + hrand(k, 41) * 260, hh = H * (0.12 + hrand(k, 42) * 0.1);
      const gg = ctx.createLinearGradient(0, hor - hh, 0, hor + 10);
      gg.addColorStop(0, theme.glacier[0]); gg.addColorStop(0.5, theme.glacier[1]); gg.addColorStop(1, theme.glacier[2]);
      ctx.fillStyle = gg;
      ctx.beginPath(); ctx.moveTo(x0, hor + 10);
      const n = 9;
      for (let i = 0; i <= n; i++) { const xx = x0 + (wdt * i) / n; ctx.lineTo(xx, hor - hh + (hrand(k * 10 + i, 43) - 0.5) * 18 + (i === 0 || i === n ? hh * 0.6 : 0)); }
      ctx.lineTo(x0 + wdt, hor + 10); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(40,110,170,0.35)'; ctx.lineWidth = 2;
      for (let i = 1; i < 7; i++) { const xx = x0 + (wdt * i) / 7 + (hrand(k * 7 + i, 44) - 0.5) * 20; ctx.beginPath(); ctx.moveTo(xx, hor - hh * 0.8); ctx.lineTo(xx + 4, hor + 8); ctx.stroke(); }
    }
    // Meer mit Eisbergen
    const sea = ctx.createLinearGradient(0, hor, 0, R);
    sea.addColorStop(0, theme.sea[0]); sea.addColorStop(1, theme.sea[1]);
    ctx.fillStyle = sea; ctx.fillRect(-R, hor, 2 * R, R - hor + 1);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    for (let i = 0; i < 18; i++) { const yy = hor + 6 + hrand(i, 60) * (R - hor); const xx = ((hrand(i, 61) * 2 * R - camX * s * 0.15) % (2 * R) + 2 * R) % (2 * R) - R; ctx.fillRect(xx, yy, 20 + hrand(i, 62) * 40, 1.5); }
    const bergs = (par, spacing, size, seed, dy) => {
      const off = camX * s * par;
      const k0 = Math.floor((off - R - spacing) / spacing), k1 = Math.ceil((off + R + spacing) / spacing);
      for (let k = k0; k <= k1; k++) {
        if (hrand(k, seed) < 0.35) continue;
        const cx = k * spacing - off, sz = size * (0.5 + hrand(k, seed + 1));
        const y = hor + dy;
        const pts = [];
        const n = 6;
        for (let i = 0; i <= n; i++) pts.push([cx - sz + (2 * sz * i) / n, y - sz * (0.25 + hrand(k * 9 + i, seed + 2) * 0.55) * Math.sin((Math.PI * i) / n + 0.2)]);
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.beginPath(); ctx.moveTo(cx - sz, y); for (const p of pts) ctx.lineTo(p[0], y + (y - p[1]) * 0.5); ctx.lineTo(cx + sz, y); ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.moveTo(cx - sz, y); for (const p of pts) ctx.lineTo(p[0], p[1]); ctx.lineTo(cx + sz, y); ctx.closePath(); ctx.fill();
        ctx.fillStyle = theme.peakS;
        ctx.beginPath(); ctx.moveTo(cx, pts[3][1]); for (let i = 3; i <= n; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.lineTo(cx + sz, y); ctx.lineTo(cx + sz * 0.1, y); ctx.closePath(); ctx.fill();
      }
    };
    bergs(0.12, 340, 40, 70, 8);
    bergs(0.2, 520, 70, 80, 26);
    ctx.restore();
  }

  function render(dt) {
    const s = game.sim, L = game.L, th = L.theme, c = game.cam;
    const t = s.time;
    drawBackground(th, c.x, c.y, c.rot, performance.now() / 1000);
    applyWorld();
    const vr = Math.hypot(W, H) / 2 / c.s + 4;
    const vis = (x0, y0, x1, y1) => !(x1 < c.x - vr || x0 > c.x + vr || y1 < c.y - vr || y0 > c.y + vr);
    for (const z of L.zones) { if (!z.hidden && vis(z.x, z.y, z.x + z.w, z.y + z.h)) drawZone(z, t); }
    for (const lp of L.loops) drawLoop(lp, th);
    for (const d of L.deco) if (vis(d.x - 3, d.y - 3, d.x + 3, d.y + 6)) drawDeco(d, th);
    for (const tr of L.terrain) { const b = tr.bb; if (vis(b[0], b[1], b[2], b[3])) drawTerrain(tr, th); }
    for (const sp of L.spikes) if (vis(sp.x, sp.y - 2, sp.x + sp.w, sp.y + 2)) drawSpikes(sp);
    for (const ic of s.icicles) if (ic.body) { const p = ic.body.getPosition(); if (vis(p.x - 2, p.y - 3, p.x + 2, p.y + 1)) drawIcicle(ic); }
    for (const rp of s.rails) { const b = rp.bb; if (vis(b[0], b[1], b[2], b[3])) drawRail(rp, th); }
    for (const sg of L.signs) if (vis(sg.x - 2, sg.y - 4, sg.x + 2, sg.y + 4)) drawSignPost(sg);
    s.cps.forEach((cp, i) => { if (vis(cp.x - 2, cp.y - 5, cp.x + 2, cp.y + 5)) drawFlag(cp, L.checkpoints[i].up, cp.passed, t); });
    drawFinish(L.finish, t);
    for (const st of s.stars) if (!st.taken && vis(st.x - 1, st.y - 1, st.x + 1, st.y + 1)) drawStar(st.x, st.y, 0.55, t);
    for (const pk of s.pickups) if (!pk.taken && vis(pk.x - 1, pk.y - 1, pk.x + 1, pk.y + 1)) drawPickup(pk.x, pk.y, t);
    for (const sw of s.switches) if (vis(sw.x - 2, sw.y - 2, sw.x + 2, sw.y + 2)) drawSwitch(sw, t, s);
    for (const sw of s.saws) { const p = sw.body.getPosition(); if (vis(p.x - 5, p.y - 5, p.x + 5, p.y + 5)) drawSaw(sw, p); }
    if (s.rider) drawRider(s);
    else if (s.ragParts) drawRagdoll(s);
    for (const p of game.parts) {
      ctx.globalAlpha = Math.max(0, 1 - p.t / p.d);
      ctx.fillStyle = p.c;
      if (p.shard) { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.t * 8 + p.r * 10); ctx.fillRect(-p.r, -p.r * 0.4, p.r * 2, p.r * 0.8); ctx.restore(); }
      else { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    for (const sg of L.signs) if (vis(sg.x - 2, sg.y - 4, sg.x + 2, sg.y + 4)) drawSignFace(sg);
    drawHUD(s, L);
  }

  function drawTerrain(tr, th) {
    const b = tr.bb;
    const ceil = tr.kind === 'ceiling' || tr.under;
    const g = ctx.createLinearGradient(0, ceil ? b[1] : b[3], 0, ceil ? b[3] : b[1]);
    g.addColorStop(0, th.ice[0]); g.addColorStop(0.35, th.ice[1]); g.addColorStop(1, th.ice[2]);
    ctx.fillStyle = g;
    ctx.fill(tr.path);
    ctx.save();
    ctx.clip(tr.path);
    // Eisfacetten / Risse
    if (tr.facets) {
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 0.08; ctx.stroke(tr.facets);
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fill(tr.shine);
    }
    if (tr.snow) {
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.strokeStyle = th.snowSh; ctx.lineWidth = 1.35; ctx.stroke(tr.spath);
      ctx.strokeStyle = th.snow; ctx.lineWidth = 0.95; ctx.stroke(tr.spath);
    }
    ctx.restore();
    ctx.strokeStyle = th.edge; ctx.lineWidth = 0.1; ctx.globalAlpha = 0.55; ctx.stroke(tr.path); ctx.globalAlpha = 1;
  }

  function drawZone(z, t) {
    ctx.save();
    if (z.type === 'boost') {
      ctx.fillStyle = 'rgba(255,190,40,0.12)';
      ctx.fillRect(z.x, z.y, z.w, z.h);
      ctx.translate(z.x + z.w / 2, z.y + z.h / 2);
      ctx.rotate((z.ang * Math.PI) / 180);
      const len = Math.max(z.w, z.h);
      ctx.lineWidth = 0.26; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (let i = 0; i < 6; i++) {
        const x = (((i / 6 + t * 1.2) % 1) - 0.5) * len * 0.9;
        const a = 1 - Math.abs(x) / (len * 0.5);
        ctx.strokeStyle = `rgba(255,${150 + i * 15},30,${0.3 + 0.65 * a})`;
        ctx.beginPath(); ctx.moveTo(x - 0.6, 0.9); ctx.lineTo(x + 0.3, 0); ctx.lineTo(x - 0.6, -0.9); ctx.stroke();
      }
    } else if (z.type === 'fan') {
      const cx = z.x + z.w / 2, cy = z.y + z.h / 2;
      ctx.translate(cx, cy);
      ctx.rotate(((z.ang - 90) * Math.PI) / 180);
      const vertical = Math.abs(Math.sin((z.ang * Math.PI) / 180)) > 0.5;
      const w = vertical ? z.w : z.h, h = vertical ? z.h : z.w;
      ctx.fillStyle = 'rgba(200,240,255,0.10)';
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 0.08; ctx.lineCap = 'round';
      for (let i = 0; i < 10; i++) {
        const x = -w / 2 + ((i + 0.5) / 10) * w;
        const y = -h / 2 + (((i * 0.37 + t * 1.8) % 1) * h);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.sin(t * 3 + i) * 0.3, y + 0.9, x, y + 1.8); ctx.stroke();
      }
      const by = -h / 2;
      ctx.fillStyle = '#2f3b4c'; roundRect(-w / 2 - 0.2, by - 0.9, w + 0.4, 0.9, 0.2); ctx.fill();
      ctx.fillStyle = '#ffcc33'; ctx.fillRect(-w / 2 - 0.2, by - 0.25, w + 0.4, 0.12);
      ctx.fillStyle = '#9fb0c4';
      const n = Math.max(2, Math.round(w / 1.4));
      for (let i = 0; i < n; i++) {
        const x = -w / 2 + ((i + 0.5) / n) * w;
        const ww = Math.abs(Math.sin(t * 22 + i)) * (w / n) * 0.42;
        ctx.fillRect(x - ww, by - 0.75, ww * 2, 0.4);
      }
    } else if (z.type === 'zerog') {
      ctx.fillStyle = 'rgba(120,235,255,0.10)';
      ctx.fillRect(z.x, z.y, z.w, z.h);
      ctx.strokeStyle = 'rgba(80,200,255,0.55)'; ctx.lineWidth = 0.1; ctx.setLineDash([0.4, 0.4]);
      ctx.strokeRect(z.x, z.y, z.w, z.h); ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      const n = Math.floor((z.w * z.h) / 16);
      for (let i = 0; i < n; i++) {
        const x = z.x + hrand(i, 90) * z.w + Math.sin(t + i) * 0.4, y = z.y + hrand(i, 91) * z.h + Math.cos(t * 0.8 + i) * 0.4;
        ctx.beginPath(); ctx.arc(x, y, 0.1 + (i % 3) * 0.06, 0, 6.283); ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawLoop(lp, th) {
    ctx.save();
    ctx.lineWidth = 1.1; ctx.strokeStyle = th.ice[2];
    ctx.beginPath(); ctx.arc(lp.cx, lp.cy, lp.r + 0.55, 0, 6.283); ctx.stroke();
    ctx.lineWidth = 0.5; ctx.strokeStyle = th.snowSh;
    ctx.beginPath(); ctx.arc(lp.cx, lp.cy, lp.r + 0.17, 0, 6.283); ctx.stroke();
    ctx.lineWidth = 0.2; ctx.strokeStyle = th.snow;
    ctx.beginPath(); ctx.arc(lp.cx, lp.cy, lp.r + 0.05, 0, 6.283); ctx.stroke();
    ctx.restore();
  }

  function drawDeco(d, th) {
    ctx.save();
    ctx.translate(d.x, d.y);
    if (d.inv) ctx.scale(1, -1);
    ctx.scale(d.s, d.s);
    if (d.t === 'crystal') {
      const cr = [[-0.35, 0, 0.18, 1.1, -0.25], [0, 0, 0.24, 1.7, 0.05], [0.32, 0, 0.17, 1.0, 0.3]];
      for (const [x, y, w, h, a] of cr) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(a);
        ctx.fillStyle = 'rgba(160,225,255,0.9)';
        ctx.beginPath(); ctx.moveTo(-w, 0); ctx.lineTo(-w, h * 0.75); ctx.lineTo(0, h); ctx.lineTo(w, h * 0.75); ctx.lineTo(w, 0); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.beginPath(); ctx.moveTo(-w, 0); ctx.lineTo(-w, h * 0.75); ctx.lineTo(0, h); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    } else if (d.t === 'flagpole') {
      ctx.fillStyle = '#e74c3c'; ctx.fillRect(-0.05, 0, 0.1, 2.2);
    }
    ctx.restore();
  }

  function drawRail(rp, th) {
    const pts = rp.pts;
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // Stützen auf der Außenseite
    ctx.strokeStyle = '#3a4a5e'; ctx.lineWidth = 0.12;
    for (let s = 1; s < rp.L - 0.5; s += 3.2) {
      const a = rp.at(s);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(a.x + a.ty * 1.3, a.y - a.tx * 1.3); ctx.stroke();
    }
    const line = () => { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); };
    line(); ctx.strokeStyle = '#1d2a3a'; ctx.lineWidth = 0.3; ctx.stroke();
    line(); ctx.strokeStyle = '#ff5a36'; ctx.lineWidth = 0.2; ctx.stroke();
    // Glanz auf der Fahrseite
    ctx.beginPath();
    pts.forEach((p, i) => {
      const a = pts[Math.min(i + 1, pts.length - 1)], b = pts[Math.max(i - 1, 0)];
      let tx = a[0] - b[0], ty = a[1] - b[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
      const x = p[0] - ty * 0.05, y = p[1] + tx * 0.05;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.strokeStyle = 'rgba(255,230,210,0.85)'; ctx.lineWidth = 0.06; ctx.stroke();
    ctx.restore();
  }

  function drawSpikes(sp) {
    for (const tri of sp.tris) {
      ctx.beginPath(); ctx.moveTo(tri[0][0], tri[0][1]); ctx.lineTo(tri[1][0], tri[1][1]); ctx.lineTo(tri[2][0], tri[2][1]); ctx.closePath();
      ctx.fillStyle = 'rgba(200,245,255,0.95)'; ctx.fill();
      ctx.strokeStyle = '#2a6aa3'; ctx.lineWidth = 0.05; ctx.stroke();
    }
  }

  function drawIcicle(ic) {
    const b = ic.body, p = b.getPosition(), w = ic.d.w, len = ic.d.len;
    ctx.save();
    ctx.translate(p.x, p.y); ctx.rotate(b.getAngle());
    if (ic.state === 'hang') ctx.translate(Math.sin(game.sim.time * 30 + p.x) * 0.01, 0);
    ctx.beginPath(); ctx.moveTo(-w / 2, 0.1); ctx.lineTo(0, -len); ctx.lineTo(w / 2, 0.1); ctx.closePath();
    const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#bdeaff'); g.addColorStop(1, '#6fc0ea');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = '#2a6aa3'; ctx.lineWidth = 0.05; ctx.stroke();
    ctx.restore();
  }

  function drawSaw(sw, p) {
    const d = sw.def;
    if (d.mx || d.my) {
      ctx.save(); ctx.strokeStyle = 'rgba(20,40,70,0.35)'; ctx.lineWidth = 0.18; ctx.setLineDash([0.4, 0.3]);
      ctx.beginPath(); ctx.moveTo(d.x - (d.mx || 0), d.y - (d.my || 0)); ctx.lineTo(d.x + (d.mx || 0), d.y + (d.my || 0)); ctx.stroke(); ctx.restore();
    } else if (d.orbit) {
      ctx.save(); ctx.strokeStyle = 'rgba(20,40,70,0.3)'; ctx.lineWidth = 0.18; ctx.setLineDash([0.4, 0.3]);
      ctx.beginPath(); ctx.arc(d.x, d.y, d.orbit, 0, 6.283); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = '#3a4a5e'; ctx.lineWidth = 0.2; ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(p.x, p.y); ctx.stroke();
      ctx.fillStyle = '#3a4a5e'; ctx.beginPath(); ctx.arc(d.x, d.y, 0.3, 0, 6.283); ctx.fill();
      ctx.restore();
    }
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(sw.body.getAngle());
    const r = d.r, n = Math.max(14, Math.round(r * 10));
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * 6.283, a1 = ((i + 0.55) / n) * 6.283;
      ctx.lineTo(Math.cos(a0) * r * 0.84, Math.sin(a0) * r * 0.84);
      ctx.lineTo(Math.cos(a1) * r, Math.sin(a1) * r);
    }
    ctx.closePath();
    const g = ctx.createRadialGradient(-r * 0.2, -r * 0.2, r * 0.1, 0, 0, r);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.6, '#b9c4d2'); g.addColorStop(1, '#6e7b8c');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = '#2b3644'; ctx.lineWidth = 0.06; ctx.stroke();
    ctx.fillStyle = 'rgba(60,72,90,0.45)';
    for (let i = 0; i < 5; i++) { ctx.rotate(6.283 / 5); ctx.beginPath(); ctx.ellipse(r * 0.5, 0, r * 0.2, r * 0.07, 0, 0, 6.283); ctx.fill(); }
    ctx.fillStyle = '#e03b2b'; ctx.beginPath(); ctx.arc(0, 0, r * 0.17, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, 0, r * 0.06, 0, 6.283); ctx.fill();
    ctx.restore();
  }

  function drawStar(x, y, r, t) {
    ctx.save();
    ctx.translate(x, y);
    const pulse = 1 + Math.sin(t * 5 + x) * 0.08;
    ctx.scale(pulse, pulse);
    ctx.rotate(Math.sin(t * 2 + x) * 0.3);
    const gl = ctx.createRadialGradient(0, 0, r * 0.3, 0, 0, r * 1.8);
    gl.addColorStop(0, 'rgba(255,236,120,0.6)'); gl.addColorStop(1, 'rgba(255,220,80,0)');
    ctx.fillStyle = gl;
    ctx.beginPath(); ctx.arc(0, 0, r * 1.8, 0, 6.283); ctx.fill();
    ctx.beginPath();
    for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    ctx.closePath();
    ctx.fillStyle = '#ffd92e'; ctx.fill();
    ctx.strokeStyle = '#b8760b'; ctx.lineWidth = 0.07; ctx.stroke();
    ctx.restore();
  }

  function drawPickup(x, y, t) {
    ctx.save();
    ctx.translate(x, y + Math.sin(t * 4 + x) * 0.15);
    const gl = ctx.createRadialGradient(0, 0, 0.1, 0, 0, 1.1);
    gl.addColorStop(0, 'rgba(120,255,140,0.7)'); gl.addColorStop(1, 'rgba(80,255,120,0)');
    ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(0, 0, 1.1, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#1e9e45'; ctx.strokeStyle = '#0c4d22'; ctx.lineWidth = 0.06;
    ctx.beginPath(); ctx.arc(0, 0, 0.5, 0, 6.283); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(-0.22, 0.25); ctx.lineTo(0.05, 0.25); ctx.lineTo(-0.1, -0.02); ctx.lineTo(0.22, -0.02); ctx.lineTo(-0.15, -0.38); ctx.lineTo(0.0, -0.08); ctx.lineTo(-0.25, -0.08); ctx.closePath();
    ctx.rotate(0); ctx.fill();
    ctx.restore();
  }

  function drawSwitch(sw, t, s) {
    ctx.save();
    ctx.translate(sw.x, sw.y);
    const act = s.time - sw.t < 0.5;
    const gl = ctx.createRadialGradient(0, 0, 0.2, 0, 0, 1.6);
    gl.addColorStop(0, act ? 'rgba(255,120,255,0.8)' : 'rgba(220,110,255,0.5)'); gl.addColorStop(1, 'rgba(200,90,255,0)');
    ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(0, 0, 1.6, 0, 6.283); ctx.fill();
    ctx.save(); ctx.rotate(t * 1.5);
    ctx.fillStyle = '#8b3fd9'; ctx.strokeStyle = '#3d1470'; ctx.lineWidth = 0.08;
    roundRect(-0.65, -0.65, 1.3, 1.3, 0.25); ctx.fill(); ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.14; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const arrow = (dir) => { ctx.beginPath(); ctx.moveTo(0, -0.35 * dir); ctx.lineTo(0, 0.38 * dir); ctx.moveTo(-0.25, 0.15 * dir); ctx.lineTo(0, 0.38 * dir); ctx.lineTo(0.25, 0.15 * dir); ctx.stroke(); };
    if (sw.g === 'up') arrow(1); else if (sw.g === 'down') arrow(-1);
    else { ctx.save(); ctx.translate(-0.18, 0); ctx.scale(0.7, 0.7); arrow(1); ctx.restore(); ctx.save(); ctx.translate(0.18, 0); ctx.scale(0.7, 0.7); arrow(-1); ctx.restore(); }
    ctx.restore();
  }

  function drawFlag(cp, up, passed, t) {
    ctx.save();
    ctx.translate(cp.x, cp.y);
    if (up < 0) ctx.scale(1, -1);
    ctx.fillStyle = '#e8eef6'; ctx.fillRect(-0.07, 0, 0.14, 3.6);
    ctx.fillStyle = passed ? '#2ed06a' : '#ff4d2e';
    ctx.beginPath(); ctx.moveTo(0.07, 3.6);
    for (let i = 0; i <= 6; i++) ctx.lineTo(0.07 + i * 0.25, 3.6 - 0.05 + Math.sin(t * 6 + i) * 0.09 * (i / 6));
    for (let i = 6; i >= 0; i--) ctx.lineTo(0.07 + i * 0.25, 2.65 - 0.05 + Math.sin(t * 6 + i) * 0.09 * (i / 6) + (i / 6) * 0.15);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 0.04; ctx.stroke();
    ctx.restore();
  }

  function drawFinish(f, t) {
    ctx.save();
    ctx.translate(f.x, f.y);
    if (f.up < 0) ctx.scale(1, -1);
    ctx.fillStyle = '#e8edf4';
    ctx.fillRect(-2.9, 0, 0.2, 5.8); ctx.fillRect(2.7, 0, 0.2, 5.8);
    const cs = 0.45;
    for (let i = 0; i < 13; i++) for (let j = 0; j < 2; j++) {
      ctx.fillStyle = (i + j) % 2 ? '#111' : '#fff';
      const wave = Math.sin(t * 4 + i * 0.5) * 0.08;
      ctx.fillRect(-2.9 + i * cs, 4.9 + j * cs + wave, cs, cs);
    }
    ctx.restore();
  }

  function drawSignPost(sg) {
    ctx.save();
    ctx.translate(sg.x, sg.y);
    if (sg.up < 0) ctx.scale(1, -1);
    ctx.fillStyle = '#4a3322'; ctx.fillRect(-0.08, 0, 0.16, 1.7);
    ctx.fillStyle = sg.icon === 'warn' ? '#f2b705' : '#8a5a36';
    roundRect(-0.7, 1.55, 1.4, 1.05, 0.15); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 0.06; ctx.stroke();
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
    const [x, y] = w2s(sg.x, sg.y + 2.08 * up);
    const sc = game.cam.s;
    ctx.save();
    ctx.translate(x, y);
    const k = sc / 30;
    ctx.scale(k, k);
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
    else if (ic === 'arrowL') { ctx.moveTo(9, 0); ctx.lineTo(-9, 0); ctx.moveTo(-2, -7); ctx.lineTo(-9, 0); ctx.lineTo(-2, 7); }
    else if (ic === 'arrowUp') { ctx.moveTo(-8, 8); ctx.lineTo(8, -8); ctx.moveTo(-1, -8); ctx.lineTo(8, -8); ctx.lineTo(8, 1); }
    else if (ic === 'arrowDown') { ctx.moveTo(-8, -8); ctx.lineTo(8, 8); ctx.moveTo(-1, 8); ctx.lineTo(8, 8); ctx.lineTo(8, -1); }
    ctx.stroke();
    const tut = TUT[S.control] || TUT.tilt;
    const text = sg.text ? (tut[ic] && sg.tut !== false ? tut[ic] : sg.text) : null;
    if (text) {
      ctx.font = '700 15px -apple-system, Segoe UI, Roboto, sans-serif';
      ctx.textAlign = 'center';
      const tw = ctx.measureText(text).width + 16;
      ctx.fillStyle = 'rgba(10,30,60,0.78)';
      roundRect(-tw / 2, -50, tw, 26, 9); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillText(text, 0, -32);
    }
    ctx.restore();
  }

  // ---------- Fahrer (Cartoon-Stil mit Kontur) ----------
  const COL = { out: '#10213a', board: '#151a24', boardT: '#9dff3a', boardS: '#ff3fa4', pants: '#1d4f91', pantsD: '#163d72', jacket: '#ff7b00', jacketD: '#d65f00', stripe: '#ffffff', skin: '#f2c9a0', helmet: '#1b2230', helmetS: '#ff7b00', glove: '#ffffff', scarf: '#e8203a' };
  const OUT = 0.075;
  function seg(a, b, w, col, outline) {
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
    if (outline) { ctx.strokeStyle = COL.out; ctx.lineWidth = w + OUT * 2; ctx.stroke(); }
    else { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.stroke(); }
  }
  function drawHead(x, y, ang, face) {
    const R = 0.2 * RSV;
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(face || 1, 1);
    // Helm
    ctx.fillStyle = COL.out; ctx.beginPath(); ctx.arc(0, 0, R + OUT, 0, 6.283); ctx.fill();
    ctx.fillStyle = COL.skin; ctx.beginPath(); ctx.arc(0, 0, R, 0, 6.283); ctx.fill();
    ctx.fillStyle = COL.helmet; ctx.beginPath(); ctx.arc(0, 0.02, R * 1.06, -0.15, Math.PI + 0.35); ctx.closePath(); ctx.fill();
    ctx.fillStyle = COL.helmetS; ctx.fillRect(-R * 0.15, R * 0.35, R * 0.3, R * 0.7);
    // Brille
    const g = ctx.createLinearGradient(0, -R * 0.2, R, R * 0.1);
    g.addColorStop(0, '#ffcf3a'); g.addColorStop(0.5, '#ff4fa0'); g.addColorStop(1, '#4fd2ff');
    ctx.fillStyle = COL.out; roundRect(-R * 0.15, -R * 0.38, R * 1.25, R * 0.55, R * 0.25); ctx.fill();
    ctx.fillStyle = g; roundRect(-R * 0.08, -R * 0.31, R * 1.1, R * 0.41, R * 0.2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fillRect(R * 0.15, -R * 0.24, R * 0.25, R * 0.08);
    ctx.restore();
  }
  function drawBoard(len) {
    const h = 0.17 * RSV;
    ctx.fillStyle = COL.out; roundRect(-len - OUT, -h / 2 - OUT, (len + OUT) * 2, h + OUT * 2, h / 2 + OUT); ctx.fill();
    ctx.fillStyle = COL.board; roundRect(-len, -h / 2, len * 2, h, h / 2); ctx.fill();
    ctx.fillStyle = COL.boardT; ctx.beginPath(); ctx.moveTo(-len * 0.8, -h * 0.15); ctx.lineTo(len * 0.1, -h * 0.15); ctx.lineTo(len * 0.25, h * 0.25); ctx.lineTo(-len * 0.65, h * 0.25); ctx.closePath(); ctx.fill();
    ctx.fillStyle = COL.boardS; ctx.beginPath(); ctx.moveTo(len * 0.3, -h * 0.15); ctx.lineTo(len * 0.8, -h * 0.15); ctx.lineTo(len * 0.7, h * 0.25); ctx.lineTo(len * 0.42, h * 0.25); ctx.closePath(); ctx.fill();
  }
  function drawScarf(nx, ny, s, worldVel, ang) {
    // Schal flattert gegen die Bewegungsrichtung (in lokale Koordinaten umgerechnet)
    const t = performance.now() / 1000;
    const co = Math.cos(-ang), si = Math.sin(-ang);
    let vx = -(worldVel.x * co - worldVel.y * si), vy = -(worldVel.x * si + worldVel.y * co);
    const sp = Math.hypot(vx, vy);
    if (sp < 1) { vx = -0.4; vy = -1; } else { vx /= sp; vy /= sp; }
    const L = 0.35 * RSV * (0.8 + Math.min(1.4, sp / 12));
    ctx.strokeStyle = COL.out; ctx.lineWidth = 0.13 * RSV + OUT * 2; ctx.lineCap = 'round';
    const pts = [[nx, ny]];
    for (let i = 1; i <= 3; i++) { const w = Math.sin(t * 14 + i * 1.3) * 0.08 * i; pts.push([nx + vx * L * i - vy * w, ny + vy * L * i + vx * w]); }
    const path = () => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); };
    path(); ctx.stroke();
    path(); ctx.strokeStyle = COL.scarf; ctx.lineWidth = 0.13 * RSV; ctx.stroke();
  }
  function drawRiderPose(q, face, vel, ang) {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const L = 0.86 * RSV;
    const back = face > 0 ? ['e1', 'h1', 'k1', 'f1'] : ['e2', 'h2', 'k2', 'f2'];
    const front = face > 0 ? ['e2', 'h2', 'k2', 'f2'] : ['e1', 'h1', 'k1', 'f1'];
    const W = { arm: 0.15 * RSV, fore: 0.13 * RSV, thigh: 0.25 * RSV, shin: 0.22 * RSV, torso: 0.38 * RSV };
    // Schal hinten
    drawScarf(q.neck[0], q.neck[1], 1, vel, ang);
    // hinterer Arm
    seg(q.neck, q[back[0]], W.arm, 0, true); seg(q[back[0]], q[back[1]], W.fore, 0, true);
    seg(q.neck, q[back[0]], W.arm, COL.jacketD); seg(q[back[0]], q[back[1]], W.fore, COL.jacketD);
    hand(q[back[1]]);
    // Beine (Kontur zuerst)
    seg(q[back[3]], q[back[2]], W.shin, 0, true); seg(q[back[2]], q.hip, W.thigh, 0, true);
    seg(q[front[3]], q[front[2]], W.shin, 0, true); seg(q[front[2]], q.hip, W.thigh, 0, true);
    seg(q[back[3]], q[back[2]], W.shin, COL.pantsD); seg(q[back[2]], q.hip, W.thigh, COL.pantsD);
    // Brett
    drawBoard(L);
    seg(q[front[3]], q[front[2]], W.shin, COL.pants); seg(q[front[2]], q.hip, W.thigh, COL.pants);
    // Bindungen
    ctx.fillStyle = COL.out;
    for (const f of ['f1', 'f2']) { roundRect(q[f][0] - 0.13 * RSV, 0.04 * RSV, 0.26 * RSV, 0.12 * RSV, 0.04); ctx.fill(); }
    // Oberkörper
    seg(q.hip, q.neck, W.torso, 0, true);
    seg(q.hip, q.neck, W.torso, COL.jacket);
    // Streifen auf der Jacke
    const mx = lerp(q.hip[0], q.neck[0], 0.55), my = lerp(q.hip[1], q.neck[1], 0.55);
    const dx = q.neck[0] - q.hip[0], dy = q.neck[1] - q.hip[1], dl = Math.hypot(dx, dy) || 1;
    ctx.strokeStyle = COL.stripe; ctx.lineWidth = 0.06 * RSV; ctx.lineCap = 'butt';
    ctx.beginPath(); ctx.moveTo(mx - (dy / dl) * W.torso * 0.5, my + (dx / dl) * W.torso * 0.5); ctx.lineTo(mx + (dy / dl) * W.torso * 0.5, my - (dx / dl) * W.torso * 0.5); ctx.stroke();
    ctx.lineCap = 'round';
    // vorderer Arm
    seg(q.neck, q[front[0]], W.arm, 0, true); seg(q[front[0]], q[front[1]], W.fore, 0, true);
    seg(q.neck, q[front[0]], W.arm, COL.jacket); seg(q[front[0]], q[front[1]], W.fore, COL.jacket);
    hand(q[front[1]]);
    const ha = Math.atan2(q.head[1] - q.neck[1], q.head[0] - q.neck[0]) - Math.PI / 2;
    drawHead(q.head[0], q.head[1], ha, face);
  }
  function hand(p) {
    ctx.fillStyle = COL.out; ctx.beginPath(); ctx.arc(p[0], p[1], 0.09 * RSV + OUT * 0.8, 0, 6.283); ctx.fill();
    ctx.fillStyle = COL.glove; ctx.beginPath(); ctx.arc(p[0], p[1], 0.09 * RSV, 0, 6.283); ctx.fill();
  }
  function drawRider(s) {
    const r = s.rider;
    const p = r.getPosition();
    const pose = s.currentPose();
    const q = {}; J.forEach((k, i) => (q[k] = pose[i]));
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(r.getAngle());
    drawRiderPose(q, s.face, r.getLinearVelocity(), r.getAngle());
    ctx.restore();
  }
  function drawRagdoll(s) {
    const P = s.ragParts;
    ctx.lineCap = 'round';
    const part = (pt, col, outline) => {
      const b = pt.body, p = b.getPosition(), a = b.getAngle();
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(a);
      seg([-pt.len / 2, 0], [pt.len / 2, 0], pt.th + 0.04, col, outline);
      ctx.restore();
    };
    const order = [[P.arm1, COL.jacketD], [P.fore1, COL.jacketD], [P.shin1, COL.pantsD], [P.thigh1, COL.pantsD]];
    for (const [pt, c] of order) { part(pt, c, true); part(pt, c, false); }
    if (s.ragBoard) { const b = s.ragBoard, p = b.getPosition(); ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(b.getAngle()); drawBoard(0.86 * RSV); ctx.restore(); }
    for (const [pt, c] of [[P.shin2, COL.pants], [P.thigh2, COL.pants], [P.torso, COL.jacket], [P.arm2, COL.jacket], [P.fore2, COL.jacket]]) { part(pt, c, true); part(pt, c, false); }
    const h = P.head.body, hp = h.getPosition();
    drawHead(hp.x, hp.y, h.getAngle(), s.ragFace || 1);
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
