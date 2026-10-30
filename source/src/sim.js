/* Physik- und Spiellogik (läuft im Browser und headless in Node) */
(function (root) {
  'use strict';
  const pl = root.planck || (typeof require !== 'undefined' ? require('planck') : null);
  const V = (x, y) => pl.Vec2(x, y);
  const G = 20;
  const DT = 1 / 60;
  const TAU = Math.PI * 2;
  const wrap = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;

  const ZERO = [0, 0];
  const CAT = { TERRAIN: 1, RIDER: 2, RAG: 4, HAZARD: 8, RAIL: 16, LOOP: 32 };

  // ---------- Posen (lokale Koordinaten, Brett liegt auf y=0, Nase bei +x) ----------
  const J = ['f1', 'f2', 'k1', 'k2', 'hip', 'neck', 'head', 'e1', 'e2', 'h1', 'h2'];
  const P = (o) => J.map((k) => o[k]);
  const FEET = { f1: [-0.3, 0.07], f2: [0.3, 0.07] };
  const POSES = {
    stand: P({ ...FEET, k1: [-0.25, 0.47], k2: [0.27, 0.48], hip: [0.0, 0.88], neck: [0.03, 1.4], head: [0.05, 1.61], e1: [-0.3, 1.2], e2: [0.33, 1.22], h1: [-0.56, 1.1], h2: [0.6, 1.14] }),
    duck: P({ ...FEET, k1: [-0.42, 0.4], k2: [0.44, 0.42], hip: [0.0, 0.5], neck: [0.12, 0.95], head: [0.2, 1.13], e1: [-0.18, 0.7], e2: [0.4, 0.72], h1: [-0.42, 0.42], h2: [0.62, 0.48] }),
    air: P({ ...FEET, k1: [-0.33, 0.5], k2: [0.33, 0.5], hip: [0.0, 0.8], neck: [0.02, 1.3], head: [0.04, 1.51], e1: [-0.36, 1.16], e2: [0.38, 1.18], h1: [-0.62, 1.27], h2: [0.64, 1.3] }),
    nose: P({ ...FEET, k1: [-0.22, 0.56], k2: [0.36, 0.64], hip: [-0.04, 0.62], neck: [0.16, 1.08], head: [0.27, 1.27], e1: [-0.38, 1.05], e2: [0.5, 0.72], h1: [-0.62, 1.22], h2: [0.72, 0.1] }),
    tail: P({ ...FEET, k1: [-0.36, 0.64], k2: [0.22, 0.56], hip: [0.04, 0.62], neck: [-0.16, 1.08], head: [-0.27, 1.27], e1: [-0.5, 0.72], e2: [0.38, 1.05], h1: [-0.72, 0.1], h2: [0.62, 1.22] }),
    indy: P({ ...FEET, k1: [-0.3, 0.66], k2: [0.3, 0.66], hip: [0.0, 0.55], neck: [0.03, 1.05], head: [0.05, 1.25], e1: [-0.3, 0.6], e2: [0.32, 0.6], h1: [-0.1, 0.09], h2: [0.14, 0.09] }),
  };

  function blendPose(w) {
    // w: {stand,duck,air,nose,tail,indy} Gewichte
    const out = new Array(J.length);
    let tot = 0;
    for (const k in w) tot += w[k];
    for (let i = 0; i < J.length; i++) {
      let x = 0, y = 0;
      for (const k in w) { if (!w[k]) continue; x += POSES[k][i][0] * w[k]; y += POSES[k][i][1] * w[k]; }
      out[i] = [x / tot, y / tot];
    }
    return out;
  }

  // Ragdoll-Segmente: [jointA, jointB, dicke, name]
  const SEGS = [
    ['f1', 'k1', 0.17, 'shin1'], ['f2', 'k2', 0.17, 'shin2'],
    ['k1', 'hip', 0.2, 'thigh1'], ['k2', 'hip', 0.2, 'thigh2'],
    ['hip', 'neck', 0.3, 'torso'],
    ['neck', 'e1', 0.14, 'arm1'], ['neck', 'e2', 0.14, 'arm2'],
    ['e1', 'h1', 0.12, 'fore1'], ['e2', 'h2', 0.12, 'fore2'],
  ];

  const RIDER_MASS = 70, RIDER_COM = 0.45, RIDER_I = 26;

  function inside(z, p) { return p.x >= z.x && p.x <= z.x + z.w && p.y >= z.y && p.y <= z.y + z.h; }

  class Sim {
    constructor(level, opts) {
      this.L = level;
      this.opts = opts || {};
      this.world = new pl.World({ gravity: V(0, -G) });
      this.time = 0;
      this.banked = 0;
      this.pending = 0;
      this.falls = 0;
      this.events = [];
      this.disabled = new Set();
      this.state = 'alive';
      this.gdir = { x: 0, y: -1 };
      this.gmode = 'normal';
      this.stars = level.stars.map((s) => ({ x: s[0], y: s[1], taken: false, pend: false }));
      this.cps = level.checkpoints.map((c) => ({ x: c.x, y: c.y, v: c.v, dir: c.dir || 1, passed: false }));
      this.cpIndex = -1;
      this.rider = null;
      this.rag = [];
      this.ragBoard = null;
      this.saws = [];
      this.buildStatic();
      this.setupContacts();
      this.spawn(level.spawn);
    }

    emit(type, data) { this.events.push(Object.assign({ type }, data || {})); }

    buildStatic() {
      const w = this.world, L = this.L;
      const ground = w.createBody();
      const solid = { friction: 0.02, filterCategoryBits: CAT.TERRAIN, filterMaskBits: 0xffff };
      for (const t of L.terrain) {
        ground.createFixture(pl.Chain(t.poly.map((p) => V(p[0], p[1])), true), Object.assign({ userData: { kind: 'terrain' } }, solid));
      }
      for (const r of L.rails) {
        const dx = r[2] - r[0], dy = r[3] - r[1], len = Math.hypot(dx, dy);
        ground.createFixture(pl.Edge(V(r[0], r[1]), V(r[2], r[3])), {
          friction: 0.0, filterCategoryBits: CAT.RAIL, filterMaskBits: 0xffff,
          userData: { kind: 'rail', x1: r[0], y1: r[1], nx: -dy / len, ny: dx / len },
        });
      }
      for (const s of L.spikes) {
        for (const tri of s.tris) {
          ground.createFixture(pl.Polygon(tri.map((p) => V(p[0], p[1]))), { filterCategoryBits: CAT.HAZARD, filterMaskBits: 0xffff, userData: { kind: 'hazard' } });
        }
      }
      for (const lp of L.loops) {
        lp.done = false;
        const mk = (a0, a1, part) => {
          const pts = [];
          const n = Math.ceil(Math.abs(a1 - a0) / 0.12);
          for (let i = 0; i <= n; i++) { const a = lerp(a0, a1, i / n); pts.push(V(lp.cx + Math.cos(a) * lp.r, lp.cy + Math.sin(a) * lp.r)); }
          ground.createFixture(pl.Chain(pts, false), { friction: 0.02, filterCategoryBits: CAT.LOOP, filterMaskBits: 0xffff, userData: { kind: 'loop', part, loop: lp } });
        };
        mk(-Math.PI / 2, Math.PI / 4, 'A');
        mk(Math.PI / 4, Math.PI * 1.5 - 0.02, 'B');
      }
      for (const s of L.saws) {
        const b = w.createBody({ type: 'kinematic', position: V(s.x, s.y) });
        b.createFixture(pl.Circle(s.r), { filterCategoryBits: CAT.HAZARD, filterMaskBits: 0xffff, userData: { kind: 'hazard' } });
        b.setAngularVelocity(s.spin != null ? s.spin : -7);
        this.saws.push({ def: s, body: b });
      }
      this.bounds = L.bounds;
    }

    setupContacts() {
      const w = this.world;
      w.on('pre-solve', (c) => {
        const fa = c.getFixtureA(), fb = c.getFixtureB();
        const ua = fa.getUserData() || {}, ub = fb.getUserData() || {};
        let other, me;
        if (ua.kind === 'rail' || ua.kind === 'loop') { other = fa; me = fb; }
        else if (ub.kind === 'rail' || ub.kind === 'loop') { other = fb; me = fa; }
        else return;
        if (this.disabled.has(c)) { c.setEnabled(false); return; }
        const ou = other.getUserData();
        const lc = (me.getUserData() || {}).lc || ZERO;
        const pos = me.getBody().getWorldPoint(V(lc[0], lc[1]));
        if (ou.kind === 'rail') {
          const s = (pos.x - ou.x1) * ou.nx + (pos.y - ou.y1) * ou.ny;
          if (s < 0.02) { this.disabled.add(c); c.setEnabled(false); }
        } else {
          const lp = ou.loop;
          if (ou.part === 'A' && lp.done) { c.setEnabled(false); return; }
          const wm = c.getWorldManifold(null);
          const pt = wm && wm.points && wm.points[0];
          let ux, uy;
          if (pt) { ux = pt.x - lp.cx; uy = pt.y - lp.cy; } else { ux = pos.x - lp.cx; uy = pos.y - lp.cy; }
          const ul = Math.hypot(ux, uy) || 1;
          const d = ((pos.x - lp.cx) * ux + (pos.y - lp.cy) * uy) / ul;
          if (d > lp.r - 0.03) { this.disabled.add(c); c.setEnabled(false); }
        }
      });
      w.on('end-contact', (c) => { this.disabled.delete(c); });
      w.on('begin-contact', (c) => {
        const fa = c.getFixtureA(), fb = c.getFixtureB();
        this.checkCrash(fa, fb); this.checkCrash(fb, fa);
      });
    }

    checkCrash(f, o) {
      if (this.state !== 'alive' || f.getBody() !== this.rider) return;
      const u = f.getUserData() || {}, ou = o.getUserData() || {};
      if (ou.kind === 'hazard') this.crashReq = this.crashReq || 'hazard';
      else if (u.kind === 'sensor' && ou.kind === 'terrain') this.crashReq = this.crashReq || 'head';
    }

    // ---------- Fahrer ----------
    spawn(sp) {
      this.clearBodies();
      const g = this.zoneModeAt(sp.x, sp.y + 0.5 * (sp.inv ? -1 : 1));
      const inv = g === 'invert';
      const up = inv ? -1 : 1;
      const ang = inv ? Math.PI : 0;
      const dir = sp.dir || 1;
      const v = sp.v != null ? sp.v : 8;
      this.createRider(sp.x, sp.y + 0.12 * up, ang, v * dir, 0);
      this.gmode = g;
      this.gdir = inv ? { x: 0, y: 1 } : { x: 0, y: -1 };
      this.world.setGravity(V(0, inv ? G : g === 'zerog' ? 0 : -G));
      this.state = 'alive';
      this.crashReq = null;
      this.grounded = false; this.groundN = { x: -this.gdir.x, y: -this.gdir.y };
      this.onRail = false; this.grindT = 0;
      this.air = this.newAir();
      this.duck = false; this.duckT = 0; this.duckAmt = 0;
      this.grab = null; this.grabW = { nose: 0, tail: 0, indy: 0 };
      this.airAmt = 0;
      this.jumpBuf = 0; this.coyote = 0;
      this.deadT = 0;
      for (const lp of this.L.loops) lp.done = false;
      this.emit('spawn', { inv });
    }

    newAir() { return { t: 0, rot: 0, lastA: this.rider ? this.rider.getAngle() : 0, flips: 0, tricks: [], grabT: { nose: 0, tail: 0, indy: 0 }, grabbed: {}, flipDirs: [] }; }

    createRider(x, y, ang, vx, vy) {
      const b = this.world.createBody({ type: 'dynamic', position: V(x, y), angle: ang, bullet: true });
      const fd = { density: 1, friction: 0.02, restitution: 0, userData: { kind: 'board' }, filterCategoryBits: CAT.RIDER, filterMaskBits: CAT.TERRAIN | CAT.HAZARD | CAT.RAIL | CAT.LOOP };
      b.createFixture(pl.Box(0.6, 0.045), fd);
      b.createFixture(pl.Circle(V(-0.64, 0.0), 0.075), Object.assign({}, fd, { userData: { kind: 'board', lc: [-0.64, 0] } }));
      b.createFixture(pl.Circle(V(0.64, 0.0), 0.075), Object.assign({}, fd, { userData: { kind: 'board', lc: [0.64, 0] } }));
      b.setLinearVelocity(V(vx, vy));
      this.rider = b;
      this.sensors = [];
      this.makeSensors(false);
    }

    makeSensors(duck) {
      const b = this.rider;
      for (const f of this.sensors) b.destroyFixture(f);
      this.sensors = [];
      const sd = { density: 0, isSensor: true, userData: { kind: 'sensor' }, filterCategoryBits: CAT.RIDER, filterMaskBits: CAT.TERRAIN | CAT.HAZARD };
      if (!duck) {
        this.sensors.push(b.createFixture(pl.Box(0.15, 0.27, V(0.02, 1.12), 0), sd));
        this.sensors.push(b.createFixture(pl.Circle(V(0.05, 1.61), 0.17), sd));
      } else {
        this.sensors.push(b.createFixture(pl.Box(0.18, 0.2, V(0.06, 0.72), 0.3), sd));
        this.sensors.push(b.createFixture(pl.Circle(V(0.2, 1.1), 0.16), sd));
      }
      b.setMassData({ mass: RIDER_MASS, center: V(0, RIDER_COM), I: RIDER_I + RIDER_MASS * RIDER_COM * RIDER_COM });
    }

    clearBodies() {
      if (this.rider) { this.world.destroyBody(this.rider); this.rider = null; }
      for (const p of this.rag) this.world.destroyBody(p.body);
      this.rag = [];
      if (this.ragBoard) { this.world.destroyBody(this.ragBoard); this.ragBoard = null; }
      this.disabled.clear();
    }

    currentPose() {
      const w = { stand: Math.max(0, 1 - this.airAmt) * (1 - this.duckAmt), duck: this.duckAmt * (1 - this.airAmt), air: this.airAmt };
      const gsum = this.grabW.nose + this.grabW.tail + this.grabW.indy;
      const k = Math.max(0, 1 - gsum);
      w.stand *= k; w.duck *= k; w.air *= k;
      w.nose = this.grabW.nose; w.tail = this.grabW.tail; w.indy = this.grabW.indy;
      if (w.stand + w.duck + w.air + w.nose + w.tail + w.indy < 1e-4) w.stand = 1;
      return blendPose(w);
    }

    makeRagdoll() {
      const r = this.rider;
      const pose = this.currentPose();
      const pt = {};
      J.forEach((k, i) => { pt[k] = r.getWorldPoint(V(pose[i][0], pose[i][1])); });
      const v = r.getLinearVelocity(), om = r.getAngularVelocity(), c = r.getWorldCenter();
      const velAt = (p) => V(v.x - om * (p.y - c.y), v.y + om * (p.x - c.x));
      const filt = { filterGroupIndex: -1, filterCategoryBits: CAT.RAG, filterMaskBits: CAT.TERRAIN | CAT.HAZARD | CAT.RAIL | CAT.LOOP };
      const ang = r.getAngle(), pos = r.getPosition();
      // Brett
      const board = this.world.createBody({ type: 'dynamic', position: V(pos.x, pos.y), angle: ang, bullet: true });
      board.createFixture(pl.Box(0.62, 0.05), Object.assign({ density: 8, friction: 0.15 }, filt));
      board.setLinearVelocity(velAt(board.getWorldCenter()));
      board.setAngularVelocity(om);
      this.ragBoard = board;
      const parts = {};
      for (const [a, b, th, name] of SEGS) {
        const A = pt[a], B = pt[b];
        const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
        const len = Math.max(0.12, Math.hypot(B.x - A.x, B.y - A.y));
        const an = Math.atan2(B.y - A.y, B.x - A.x);
        const body = this.world.createBody({ type: 'dynamic', position: V(mx, my), angle: an, angularDamping: 0.6 });
        body.createFixture(pl.Box(len / 2, th / 2), Object.assign({ density: name === 'torso' ? 3 : 2, friction: 0.6, restitution: 0.1 }, filt));
        body.setLinearVelocity(velAt(V(mx, my)));
        body.setAngularVelocity(om);
        parts[name] = { body, name, len, th, seg: [a, b] };
      }
      const headP = pt.head;
      const head = this.world.createBody({ type: 'dynamic', position: headP, angle: ang, angularDamping: 0.6 });
      head.createFixture(pl.Circle(0.17), Object.assign({ density: 2.5, friction: 0.6, restitution: 0.15 }, filt));
      head.setLinearVelocity(velAt(headP));
      parts.head = { body: head, name: 'head', r: 0.17 };
      const joint = (A, B, anchor, lo, hi) => {
        const j = pl.RevoluteJoint({ enableLimit: lo != null, lowerAngle: lo || 0, upperAngle: hi || 0, collideConnected: false }, A, B, anchor);
        this.world.createJoint(j);
      };
      joint(parts.shin1.body, board, pt.f1, -1.2, 1.2);
      joint(parts.shin2.body, board, pt.f2, -1.2, 1.2);
      joint(parts.shin1.body, parts.thigh1.body, pt.k1, -2.4, 2.4);
      joint(parts.shin2.body, parts.thigh2.body, pt.k2, -2.4, 2.4);
      joint(parts.thigh1.body, parts.torso.body, pt.hip, -2.2, 2.2);
      joint(parts.thigh2.body, parts.torso.body, pt.hip, -2.2, 2.2);
      joint(parts.torso.body, parts.arm1.body, pt.neck);
      joint(parts.torso.body, parts.arm2.body, pt.neck);
      joint(parts.arm1.body, parts.fore1.body, pt.e1, -2.4, 2.4);
      joint(parts.arm2.body, parts.fore2.body, pt.e2, -2.4, 2.4);
      joint(parts.torso.body, head, pt.neck, -0.9, 0.9);
      this.rag = Object.values(parts);
      this.ragParts = parts;
      this.world.destroyBody(r);
      this.rider = null;
    }

    zoneModeAt(x, y) {
      let m = 'normal';
      const p = { x, y };
      for (const z of this.L.zones) {
        if (z.type === 'invert' && inside(z, p)) m = 'invert';
        else if (z.type === 'zerog' && inside(z, p)) m = 'zerog';
      }
      return m;
    }

    focus() {
      if (this.rider) return this.rider.getWorldCenter();
      if (this.ragParts) return this.ragParts.torso.body.getWorldCenter();
      return V(0, 0);
    }

    applyZones(body, mass) {
      const c = body.getWorldCenter();
      for (const z of this.L.zones) {
        if (!inside(z, c)) continue;
        if (z.type === 'fan') {
          body.applyForceToCenter(V(z.dir[0] * z.str * mass, z.dir[1] * z.str * mass), true);
        } else if (z.type === 'boost') {
          const v = body.getLinearVelocity();
          let dx = z.dir[0], dy = z.dir[1];
          if (z.vel) { const sp = Math.hypot(v.x, v.y) || 1; dx = v.x / sp; dy = v.y / sp; }
          const along = v.x * dx + v.y * dy;
          if (along < z.speed) body.applyForceToCenter(V(dx * z.str * mass, dy * z.str * mass), true);
          if (body === this.rider) this._inBoost = true;
        }
      }
    }

    // ---------- Schritt ----------
    step(inp) {
      if (this.state === 'finished') { this.world.step(DT, 8, 3); return; }
      this.time += DT;
      const fc = this.focus();
      // Schwerkraftzonen
      const gm = this.zoneModeAt(fc.x, fc.y);
      if (gm !== this.gmode) {
        this.gmode = gm;
        if (gm === 'invert') { this.world.setGravity(V(0, G)); this.gdir = { x: 0, y: 1 }; this.emit('gravity'); }
        else if (gm === 'zerog') { this.world.setGravity(V(0, 0)); this.emit('zerog'); }
        else { this.world.setGravity(V(0, -G)); if (this.gdir.y > 0) this.emit('gravity'); this.gdir = { x: 0, y: -1 }; }
      }
      const wasBoost = this._inBoost;
      this._inBoost = false;
      // Sägen bewegen
      for (const s of this.saws) {
        const d = s.def;
        if (!d.mx && !d.my) continue;
        const ph = d.phase || 0, per = d.period || 3;
        const t1 = this.time + DT;
        const nx = d.x + (d.mx || 0) * Math.sin((TAU * t1) / per + ph);
        const ny = d.y + (d.my || 0) * Math.sin((TAU * t1) / per + ph);
        const p = s.body.getPosition();
        s.body.setLinearVelocity(V((nx - p.x) / DT, (ny - p.y) / DT));
      }

      if (this.state === 'alive') { this.controlRider(inp); if (this._inBoost && !wasBoost) this.emit('boost'); }
      else {
        this.deadT += DT;
        for (const p of this.rag) this.applyZones(p.body, p.body.getMass());
      }

      this.world.step(DT, 8, 3);

      if (this.state === 'alive') this.postRider(inp);
    }

    controlRider(inp) {
      const r = this.rider;
      const m = RIDER_MASS;
      const tilt = clamp(inp.tilt || 0, -1, 1);
      // Ducken
      if (inp.duck) this.duckT = 0.35; else this.duckT -= DT;
      const wantDuck = this.duckT > 0 && !this.grab;
      if (wantDuck !== this.duck) { this.duck = wantDuck; this.makeSensors(wantDuck); }
      this.duckAmt = lerp(this.duckAmt, this.duck ? 1 : 0, 0.3);
      // Grabs (nur in der Luft)
      let g = null;
      if (this.air.t > 0.12 && !this.grounded) g = inp.grabL && inp.grabR ? 'indy' : inp.grabL ? 'tail' : inp.grabR ? 'nose' : null;
      this.grab = g;
      for (const k of ['nose', 'tail', 'indy']) this.grabW[k] = lerp(this.grabW[k], g === k ? 1 : 0, 0.32);
      this.airAmt = lerp(this.airAmt, this.grounded ? 0 : this.air.t > 0.15 ? 1 : this.airAmt, 0.15);

      const w = r.getAngularVelocity();
      const I = RIDER_I;
      if (this.grounded) {
        const n = this.groundN;
        const tgt = Math.atan2(-n.x, n.y) - tilt * 0.6;
        const diff = wrap(tgt - r.getAngle());
        r.applyTorque(clamp(I * (130 * diff - 20 * w), -12000, 12000), true);
        // Hocke beschleunigt etwas
        if (this.duck) {
          const v = r.getLinearVelocity();
          const sp = Math.hypot(v.x, v.y);
          if (sp > 0.5 && sp < 24) r.applyForceToCenter(V((v.x / sp) * m * 3, (v.y / sp) * m * 3), true);
        }
      } else {
        const maxSpin = 7.2 * (this.opts.spin || 1);
        const tw = -tilt * maxSpin;
        r.applyTorque(clamp(I * 13 * (tw - w), -9000, 9000), true);
      }
      // Springen
      if (inp.jump) this.jumpBuf = 0.15;
      else this.jumpBuf -= DT;
      if (this.jumpBuf > 0 && (this.grounded || this.coyote > 0)) {
        const n = this.groundN;
        const v = r.getLinearVelocity();
        const vn = v.x * n.x + v.y * n.y;
        const add = Math.max(0, 8 - Math.max(0, vn));
        r.setLinearVelocity(V(v.x + n.x * add, v.y + n.y * add));
        this.jumpBuf = 0; this.coyote = 0; this.grounded = false;
        this.jumpLock = 0.15;
        this.emit('jump');
      }
      // Zonen + Luftwiderstand
      this.applyZones(r, m);
      const v = r.getLinearVelocity();
      const sp = Math.hypot(v.x, v.y);
      const k = 0.0045 * m * sp;
      r.applyForceToCenter(V(-v.x * k, -v.y * k), true);
      if (sp > 40) r.setLinearVelocity(V((v.x * 40) / sp, (v.y * 40) / sp));
    }

    postRider(inp) {
      const r = this.rider;
      // Bodenkontakt
      let gn = null, rail = false, cnt = 0, nx = 0, ny = 0;
      for (let ce = r.getContactList(); ce; ce = ce.next) {
        const c = ce.contact;
        if (!c.isTouching() || !c.isEnabled()) continue;
        const fa = c.getFixtureA(), fb = c.getFixtureB();
        const mine = fa.getBody() === r ? fa : fb;
        const other = mine === fa ? fb : fa;
        if (mine.isSensor() || other.isSensor()) continue;
        const ou = other.getUserData() || {};
        if (ou.kind !== 'terrain' && ou.kind !== 'rail' && ou.kind !== 'loop') continue;
        const wm = c.getWorldManifold(null);
        if (!wm) continue;
        let n = wm.normal;
        let x = n.x, y = n.y;
        if (mine === fa) { x = -x; y = -y; }
        nx += x; ny += y; cnt++;
        if (ou.kind === 'rail') rail = true;
      }
      if (this.jumpLock > 0) { this.jumpLock -= DT; cnt = 0; }
      const wasGrounded = this.grounded;
      if (cnt > 0) {
        const l = Math.hypot(nx, ny) || 1;
        gn = { x: nx / l, y: ny / l };
        this.groundN = gn;
        this.grounded = true;
        this.coyote = 0.12;
      } else {
        this.grounded = false;
        this.coyote -= DT;
      }

      // Rail
      if (this.grounded && rail) { this.grindT += DT; this.onRail = true; }
      else if (this.onRail && !rail) {
        this.onRail = false;
        if (this.grindT > 0.25) {
          const pts = Math.round((100 + 400 * this.grindT) / 10) * 10;
          this.pending += pts;
          this.emit('trick', { text: 'Rail Slide', pts });
        }
        this.grindT = 0;
      }

      // Loop-Status
      const com = r.getWorldCenter();
      for (const lp of this.L.loops) {
        if (!lp.done && com.y > lp.cy && com.x < lp.cx && com.x > lp.cx - lp.r) lp.done = true;
        if (lp.done && (com.x > lp.cx + lp.r + 3 || com.x < lp.cx - lp.r - 6)) lp.done = false;
      }

      // Luft/Tricks
      const ang = r.getAngle();
      if (!this.grounded) {
        this.air.t += DT;
        this.air.rot += ang - this.air.lastA;
        this.air.lastA = ang;
        const fl = Math.floor((Math.abs(this.air.rot) + 0.5) / TAU);
        while (this.air.flips < fl) {
          this.air.flips++;
          const ca = this.camTarget();
          const rx = Math.cos(ca), ry = -Math.sin(ca);
          const v = r.getLinearVelocity();
          const f = v.x * rx + v.y * ry;
          const back = (this.air.rot > 0) === (f >= 0);
          const name = back ? 'Backflip' : 'Frontflip';
          this.air.tricks.push(name);
          this.emit('flip', { text: name, n: this.air.flips });
        }
        if (this.grab) {
          this.air.grabT[this.grab] += DT;
          if (this.air.grabT[this.grab] > 0.18 && !this.air.grabbed[this.grab]) {
            this.air.grabbed[this.grab] = true;
            const nm = { nose: 'Nosegrab', tail: 'Tailgrab', indy: 'Indy' }[this.grab];
            this.air.tricks.push(nm);
            this.emit('grab', { text: nm });
          }
        }
      } else {
        if (!wasGrounded && this.air.t > 0.25) this.land(ang);
        this.air = this.newAir();
      }

      // Crash
      if (this.crashReq) { this.crash(this.crashReq); return; }

      // Sterne
      const hp = r.getWorldPoint(V(0, 1.0));
      for (const s of this.stars) {
        if (s.taken) continue;
        if (Math.hypot(s.x - hp.x, s.y - hp.y) < 1.25 || Math.hypot(s.x - com.x, s.y - com.y) < 1.1) {
          s.taken = true; s.pend = true; this.pending += 200;
          this.emit('star', { x: s.x, y: s.y });
        }
      }
      // Checkpoints
      this.cps.forEach((cp, i) => {
        if (cp.passed) return;
        if (Math.abs(com.x - cp.x) < 1.3 && Math.abs(com.y - cp.y) < 6) {
          cp.passed = true;
          const v = r.getLinearVelocity();
          cp.v = clamp(Math.hypot(v.x, v.y) * 0.92, cp.v, 24);
          if (i > this.cpIndex) this.cpIndex = i;
          this.bank();
          this.emit('checkpoint', { x: cp.x, y: cp.y });
        }
      });
      // Ziel
      const fz = this.L.finish;
      if (Math.abs(com.x - fz.x) < 1.6 && Math.abs(com.y - fz.y) < 8) {
        this.bank();
        this.state = 'finished';
        this.emit('finish');
        return;
      }
      // Aus der Welt gefallen
      const b = this.bounds;
      if (com.y < b.minY - 25 || com.y > b.maxY + 25 || com.x < b.minX - 30 || com.x > b.maxX + 30) this.crash('fall');
    }

    camTarget() { return -Math.PI / 2 - Math.atan2(this.gdir.y, this.gdir.x); }

    land(ang) {
      const n = this.groundN;
      const d = Math.abs(wrap(ang - Math.atan2(-n.x, n.y)));
      if (this.grab) { this.crash('grab'); return; }
      if (d > 1.05) { this.crash('landing'); return; }
      const A = this.air;
      let pts = 0;
      for (let i = 1; i <= A.flips; i++) pts += 500 * i;
      let grabs = 0;
      for (const k in A.grabbed) { pts += 150 + Math.round(400 * A.grabT[k]); grabs++; }
      if (A.t > 1.2) pts += Math.floor(A.t / 0.5) * 50;
      let q, mult;
      if (d < 0.16) { q = 'Perfekte Landung'; mult = 2; }
      else if (d < 0.36) { q = 'Gute Landung'; mult = 1.5; }
      else { q = 'Wackelige Landung'; mult = 1; }
      this.emit('land', { q, hard: A.t });
      if (pts > 0 && (A.tricks.length || A.t > 1.2)) {
        pts = Math.round((pts * mult) / 10) * 10;
        this.pending += pts;
        this.emit('trick', { text: this.comboName(A), q, mult, pts });
      }
    }

    comboName(A) {
      const t = A.tricks;
      if (!t.length) return 'Big Air';
      const out = [];
      let i = 0;
      while (i < t.length) {
        let j = i; while (j < t.length && t[j] === t[i]) j++;
        out.push((j - i > 1 ? j - i + 'x ' : '') + t[i]);
        i = j;
      }
      return out.join(' + ');
    }

    bank() {
      this.banked += this.pending;
      this.pending = 0;
      for (const s of this.stars) s.pend = false;
    }

    crash(reason) {
      if (this.state !== 'alive') return;
      this.state = 'dead';
      this.deadT = 0;
      this.falls++;
      this.pending = 0;
      for (const s of this.stars) if (s.pend) { s.taken = false; s.pend = false; }
      if (this.rider) this.makeRagdoll();
      this.emit('crash', { reason });
    }

    respawn() {
      const cp = this.cpIndex >= 0 ? this.cps[this.cpIndex] : null;
      this.spawn(cp ? { x: cp.x, y: cp.y, v: cp.v, dir: cp.dir } : this.L.spawn);
    }

    starsTaken() { return this.stars.filter((s) => s.taken).length; }
    score() { return this.banked + this.pending; }
  }

  const api = { Sim, POSES, J, SEGS, blendPose, DT, G, wrap, clamp, lerp };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SIM = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
