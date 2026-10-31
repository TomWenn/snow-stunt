/* Physik- und Spiellogik (läuft im Browser und headless in Node) */
(function (root) {
  'use strict';
  const pl = root.planck || (typeof require !== 'undefined' ? require('planck') : null);
  const V = (x, y) => pl.Vec2(x, y);
  const G = 20;
  const DT = 1 / 60;
  const TAU = Math.PI * 2;
  const RS = 1.2; // Fahrergröße
  const wrap = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const ZERO = [0, 0];
  const CAT = { TERRAIN: 1, RIDER: 2, RAG: 4, HAZARD: 8, LOOP: 32, ICE: 64 };
  const RAIL_OFF = 0.17 * RS;

  // ---------- Posen (lokale Koordinaten, Brett auf y=0, Blickrichtung +x) ----------
  const J = ['f1', 'f2', 'k1', 'k2', 'hip', 'neck', 'head', 'e1', 'e2', 'h1', 'h2'];
  const P = (o) => J.map((k) => [o[k][0] * RS, o[k][1] * RS]);
  const FEET = { f1: [-0.3, 0.07], f2: [0.3, 0.07] };
  const POSES = {
    stand: P({ ...FEET, k1: [-0.22, 0.47], k2: [0.3, 0.46], hip: [0.02, 0.86], neck: [0.06, 1.38], head: [0.09, 1.59], e1: [-0.3, 1.18], e2: [0.36, 1.2], h1: [-0.58, 1.08], h2: [0.62, 1.12] }),
    duck: P({ ...FEET, k1: [-0.42, 0.4], k2: [0.44, 0.42], hip: [0.0, 0.5], neck: [0.14, 0.94], head: [0.23, 1.12], e1: [-0.18, 0.7], e2: [0.42, 0.72], h1: [-0.42, 0.42], h2: [0.64, 0.48] }),
    air: P({ ...FEET, k1: [-0.33, 0.52], k2: [0.34, 0.5], hip: [0.0, 0.8], neck: [0.04, 1.3], head: [0.07, 1.51], e1: [-0.38, 1.18], e2: [0.4, 1.2], h1: [-0.66, 1.32], h2: [0.68, 1.34] }),
    nose: P({ ...FEET, k1: [-0.22, 0.56], k2: [0.36, 0.64], hip: [-0.04, 0.62], neck: [0.16, 1.08], head: [0.27, 1.27], e1: [-0.38, 1.05], e2: [0.5, 0.72], h1: [-0.62, 1.24], h2: [0.72, 0.1] }),
    tail: P({ ...FEET, k1: [-0.36, 0.64], k2: [0.22, 0.56], hip: [0.04, 0.62], neck: [-0.16, 1.08], head: [-0.27, 1.27], e1: [-0.5, 0.72], e2: [0.38, 1.05], h1: [-0.72, 0.1], h2: [0.62, 1.24] }),
    indy: P({ ...FEET, k1: [-0.3, 0.66], k2: [0.3, 0.66], hip: [0.0, 0.55], neck: [0.03, 1.05], head: [0.05, 1.25], e1: [-0.3, 0.6], e2: [0.32, 0.6], h1: [-0.1, 0.09], h2: [0.14, 0.09] }),
    rail: P({ ...FEET, k1: [-0.3, 0.44], k2: [0.32, 0.44], hip: [0.0, 0.74], neck: [0.1, 1.22], head: [0.15, 1.43], e1: [-0.42, 1.0], e2: [0.44, 1.02], h1: [-0.7, 0.92], h2: [0.72, 0.94] }),
  };

  function blendPose(w, face) {
    const out = new Array(J.length);
    let tot = 0;
    for (const k in w) tot += w[k];
    for (let i = 0; i < J.length; i++) {
      let x = 0, y = 0;
      for (const k in w) { if (!w[k]) continue; x += POSES[k][i][0] * w[k]; y += POSES[k][i][1] * w[k]; }
      out[i] = [(x / tot) * (face || 1), y / tot];
    }
    return out;
  }

  const SEGS = [
    ['f1', 'k1', 0.17, 'shin1'], ['f2', 'k2', 0.17, 'shin2'],
    ['k1', 'hip', 0.2, 'thigh1'], ['k2', 'hip', 0.2, 'thigh2'],
    ['hip', 'neck', 0.3, 'torso'],
    ['neck', 'e1', 0.14, 'arm1'], ['neck', 'e2', 0.14, 'arm2'],
    ['e1', 'h1', 0.12, 'fore1'], ['e2', 'h2', 0.12, 'fore2'],
  ];

  const RIDER_MASS = 70, RIDER_COM = 0.45 * RS, RIDER_I = 26 * RS * RS;

  // ---------- Rails (Festhalte-Rails, beliebige Polylinie) ----------
  function railPath(pts) {
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const L = cum[cum.length - 1];
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const p of pts) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
    const segT = (i) => { const a = pts[i], b = pts[i + 1], l = cum[i + 1] - cum[i] || 1; return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; };
    return {
      pts, cum, L, bb: [x0 - 2, y0 - 2, x1 + 2, y1 + 2],
      at(s) {
        s = clamp(s, 0, L);
        let i = 0;
        while (i < pts.length - 2 && cum[i + 1] < s) i++;
        const a = pts[i], l = cum[i + 1] - cum[i] || 1, t = (s - cum[i]) / l;
        const b = pts[i + 1];
        let [tx, ty] = segT(i);
        // weiche Tangente an Knickpunkten
        if (t > 0.5 && i < pts.length - 2) { const n = segT(i + 1), k = (t - 0.5); tx = lerp(tx, n[0], k); ty = lerp(ty, n[1], k); }
        else if (t < 0.5 && i > 0) { const n = segT(i - 1), k = (0.5 - t); tx = lerp(tx, n[0], k); ty = lerp(ty, n[1], k); }
        const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
        return { x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, tx, ty };
      },
      project(px, py) {
        let best = null;
        for (let i = 0; i < pts.length - 1; i++) {
          const a = pts[i], b = pts[i + 1];
          const abx = b[0] - a[0], aby = b[1] - a[1], l2 = abx * abx + aby * aby || 1;
          const t = clamp(((px - a[0]) * abx + (py - a[1]) * aby) / l2, 0, 1);
          const qx = a[0] + abx * t, qy = a[1] + aby * t;
          const d = Math.hypot(px - qx, py - qy);
          if (!best || d < best.d) {
            const l = Math.sqrt(l2), tx = abx / l, ty = aby / l;
            best = { d, s: cum[i] + t * l, side: (px - qx) * -ty + (py - qy) * tx, tx, ty, t, i };
          }
        }
        return best;
      },
    };
  }

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
      this.gsign = -1;
      this.gdir = { x: 0, y: -1 };
      this.zerog = false;
      this.stars = level.stars.map((s) => ({ x: s[0], y: s[1], taken: false, pend: false }));
      this.pickups = (level.pickups || []).map((s) => ({ x: s[0], y: s[1], taken: false }));
      this.switches = (level.switches || []).map((s) => ({ x: s.x, y: s.y, g: s.g, t: -9 }));
      this.cps = level.checkpoints.map((c) => ({ x: c.x, y: c.y, v: c.v, vmin: c.v, dir: c.dir || 1, passed: false, gsign: null }));
      this.cpIndex = -1;
      this.rails = (level.rails || []).map((r) => railPath(r.pts || r));
      this.rider = null;
      this.rag = [];
      this.ragBoard = null;
      this.saws = [];
      this.icicles = [];
      this.face = 1;
      this.buildStatic();
      this.setupContacts();
      this.spawn(level.spawn);
    }

    emit(type, data) { this.events.push(Object.assign({ type }, data || {})); }

    buildStatic() {
      const w = this.world, L = this.L;
      const ground = w.createBody();
      this.ground = ground;
      const solid = { friction: 0.02, filterCategoryBits: CAT.TERRAIN, filterMaskBits: 0xffff };
      for (const t of L.terrain) {
        ground.createFixture(pl.Chain(t.poly.map((p) => V(p[0], p[1])), true), Object.assign({ userData: { kind: 'terrain' } }, solid));
      }
      for (const s of L.spikes) {
        for (const tri of s.tris) ground.createFixture(pl.Polygon(tri.map((p) => V(p[0], p[1]))), { filterCategoryBits: CAT.HAZARD, filterMaskBits: 0xffff, userData: { kind: 'hazard' } });
      }
      for (const lp of L.loops) {
        lp.done = false;
        const mk = (a0, a1, part) => {
          const pts = [];
          const n = Math.ceil(Math.abs(a1 - a0) / 0.1);
          for (let i = 0; i <= n; i++) { const a = lerp(a0, a1, i / n); pts.push(V(lp.cx + Math.cos(a) * lp.r, lp.cy + Math.sin(a) * lp.r)); }
          ground.createFixture(pl.Chain(pts, false), { friction: 0.02, filterCategoryBits: CAT.LOOP, filterMaskBits: 0xffff, userData: { kind: 'loop', part, loop: lp } });
        };
        mk(-Math.PI / 2, Math.PI / 4, 'A');
        mk(Math.PI / 4, Math.PI * 1.5 - 0.02, 'B');
      }
      for (const s of L.saws) {
        const b = w.createBody({ type: 'kinematic', position: V(s.x, s.y) });
        b.createFixture(pl.Circle(s.r * 0.92), { filterCategoryBits: CAT.HAZARD, filterMaskBits: 0xffff, userData: { kind: 'hazard' } });
        b.setAngularVelocity(s.spin != null ? s.spin : -9 / Math.max(0.6, s.r));
        this.saws.push({ def: s, body: b });
      }
      this.bounds = L.bounds;
      this.makeIcicles();
    }

    makeIcicles() {
      for (const ic of this.icicles) if (ic.body) this.world.destroyBody(ic.body);
      this.icicles = (this.L.icicles || []).map((d) => {
        const b = this.world.createBody({ type: 'kinematic', position: V(d.x, d.y) });
        const w = d.w || 0.5, len = d.len || 1.6;
        b.createFixture(pl.Polygon([V(-w / 2, 0), V(0, -len), V(w / 2, 0)]), { density: 2, filterCategoryBits: CAT.HAZARD, filterMaskBits: CAT.RIDER | CAT.TERRAIN | CAT.RAG, userData: { kind: 'hazard', icicle: true } });
        return { d, body: b, state: 'hang', t: 0 };
      });
    }

    setupContacts() {
      const w = this.world;
      w.on('pre-solve', (c) => {
        const fa = c.getFixtureA(), fb = c.getFixtureB();
        const ua = fa.getUserData() || {}, ub = fb.getUserData() || {};
        let other, me;
        if (ua.kind === 'loop') { other = fa; me = fb; }
        else if (ub.kind === 'loop') { other = fb; me = fa; }
        else return;
        if (this.disabled.has(c)) { c.setEnabled(false); return; }
        const ou = other.getUserData();
        const lc = (me.getUserData() || {}).lc || ZERO;
        const pos = me.getBody().getWorldPoint(V(lc[0], lc[1]));
        const lp = ou.loop;
        if (ou.part === 'A' && lp.done) { c.setEnabled(false); return; }
        const wm = c.getWorldManifold(null);
        const pt = wm && wm.points && wm.points[0];
        let ux, uy;
        if (pt) { ux = pt.x - lp.cx; uy = pt.y - lp.cy; } else { ux = pos.x - lp.cx; uy = pos.y - lp.cy; }
        const ul = Math.hypot(ux, uy) || 1;
        const d = ((pos.x - lp.cx) * ux + (pos.y - lp.cy) * uy) / ul;
        if (d > lp.r - 0.03) { this.disabled.add(c); c.setEnabled(false); }
      });
      w.on('end-contact', (c) => { this.disabled.delete(c); });
      w.on('begin-contact', (c) => {
        const fa = c.getFixtureA(), fb = c.getFixtureB();
        this.checkCrash(fa, fb); this.checkCrash(fb, fa);
        // fallende Eiszapfen zerbrechen am Boden
        const ua = fa.getUserData() || {}, ub = fb.getUserData() || {};
        if (ua.icicle && ub.kind === 'terrain') this.iceHit = (this.iceHit || []).concat([fa.getBody()]);
        if (ub.icicle && ua.kind === 'terrain') this.iceHit = (this.iceHit || []).concat([fb.getBody()]);
      });
    }

    checkCrash(f, o) {
      if (this.state !== 'alive' || f.getBody() !== this.rider) return;
      const u = f.getUserData() || {}, ou = o.getUserData() || {};
      if (ou.kind === 'hazard') this.crashReq = this.crashReq || (ou.icicle ? 'ice' : 'hazard');
      else if (u.kind === 'sensor' && ou.kind === 'terrain') this.crashReq = this.crashReq || 'head';
    }

    // ---------- Fahrer ----------
    spawn(sp) {
      this.clearBodies();
      this.gsign = sp.gsign || this.L.spawn.gsign || -1;
      const inv = this.gsign > 0;
      const up = inv ? -1 : 1;
      const dir = sp.dir || 1;
      const v = sp.v != null ? sp.v : 8;
      // Richtung entlang des Bodens
      let tx = dir, ty = 0, ang = inv ? Math.PI : 0;
      const hit = this.rayGround(sp.x, sp.y + 1.5 * up, sp.x, sp.y - 3 * up);
      let px = sp.x, py = sp.y;
      if (hit) {
        const n = hit.normal;
        tx = n.y * dir; ty = -n.x * dir;
        if (inv) { tx = -tx; ty = -ty; }
        ang = Math.atan2(-n.x, n.y);
        px = hit.point.x + n.x * 0.1 * RS; py = hit.point.y + n.y * 0.1 * RS;
      }
      this.createRider(px, py, ang, tx * v, ty * v);
      this.face = dir;
      this.zerog = false;
      this.setGravity();
      this.state = 'alive';
      this.crashReq = null;
      this.grounded = false; this.groundN = { x: -this.gdir.x, y: -this.gdir.y };
      this.rail = null; this.railCool = 0; this.grindT = 0;
      this.air = this.newAir();
      this.duck = false; this.duckT = 0; this.duckAmt = 0;
      this.grab = null; this.grabW = { nose: 0, tail: 0, indy: 0 };
      this.airAmt = 0; this.railAmt = 0;
      this.jumpBuf = 0; this.coyote = 0;
      this.deadT = 0;
      for (const lp of this.L.loops) lp.done = false;
      for (const p of this.pickups) p.taken = false;
      this.makeIcicles();
      this.emit('spawn', { inv });
    }

    rayGround(x1, y1, x2, y2) {
      let hit = null;
      this.world.rayCast(V(x1, y1), V(x2, y2), (f, point, normal, frac) => {
        const u = f.getUserData() || {};
        if (u.kind !== 'terrain') return -1;
        hit = { point: V(point.x, point.y), normal: V(normal.x, normal.y), frac };
        return frac;
      });
      return hit;
    }

    setGravity() {
      this.world.setGravity(this.zerog ? V(0, 0) : V(0, this.gsign * G));
      this.gdir = { x: 0, y: this.gsign };
    }

    newAir() { return { t: 0, rot: 0, lastA: this.rider ? this.rider.getAngle() : 0, flips: 0, tricks: [], grabT: { nose: 0, tail: 0, indy: 0 }, grabbed: {} }; }

    createRider(x, y, ang, vx, vy) {
      const b = this.world.createBody({ type: 'dynamic', position: V(x, y), angle: ang, bullet: true });
      const fd = { density: 1, friction: 0.02, restitution: 0, userData: { kind: 'board' }, filterCategoryBits: CAT.RIDER, filterMaskBits: CAT.TERRAIN | CAT.HAZARD | CAT.LOOP };
      b.createFixture(pl.Box(0.6 * RS, 0.045 * RS), fd);
      b.createFixture(pl.Circle(V(-0.64 * RS, 0.0), 0.075 * RS), Object.assign({}, fd, { userData: { kind: 'board', lc: [-0.64 * RS, 0] } }));
      b.createFixture(pl.Circle(V(0.64 * RS, 0.0), 0.075 * RS), Object.assign({}, fd, { userData: { kind: 'board', lc: [0.64 * RS, 0] } }));
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
      const fx = this.face || 1;
      if (!duck) {
        this.sensors.push(b.createFixture(pl.Box(0.15 * RS, 0.27 * RS, V(0.04 * RS * fx, 1.12 * RS), 0), sd));
        this.sensors.push(b.createFixture(pl.Circle(V(0.09 * RS * fx, 1.59 * RS), 0.17 * RS), sd));
      } else {
        this.sensors.push(b.createFixture(pl.Box(0.18 * RS, 0.2 * RS, V(0.06 * RS * fx, 0.72 * RS), 0.3 * fx), sd));
        this.sensors.push(b.createFixture(pl.Circle(V(0.22 * RS * fx, 1.1 * RS), 0.16 * RS), sd));
      }
      b.setMassData({ mass: RIDER_MASS, center: V(0, RIDER_COM), I: RIDER_I + RIDER_MASS * RIDER_COM * RIDER_COM });
    }

    clearBodies() {
      if (this.rider) { this.world.destroyBody(this.rider); this.rider = null; }
      for (const p of this.rag) this.world.destroyBody(p.body);
      this.rag = [];
      this.ragParts = null;
      if (this.ragBoard) { this.world.destroyBody(this.ragBoard); this.ragBoard = null; }
      this.disabled.clear();
    }

    currentPose() {
      const ra = this.railAmt || 0;
      const w = { stand: Math.max(0, 1 - this.airAmt) * (1 - this.duckAmt), duck: this.duckAmt * (1 - this.airAmt), air: this.airAmt };
      const gsum = this.grabW.nose + this.grabW.tail + this.grabW.indy;
      const k = Math.max(0, 1 - gsum) * (1 - ra);
      w.stand *= k; w.duck *= k; w.air *= k;
      w.nose = this.grabW.nose; w.tail = this.grabW.tail; w.indy = this.grabW.indy;
      w.rail = ra;
      if (w.stand + w.duck + w.air + w.nose + w.tail + w.indy + w.rail < 1e-4) w.stand = 1;
      return blendPose(w, this.face);
    }

    makeRagdoll() {
      const r = this.rider;
      const pose = this.currentPose();
      const pt = {};
      J.forEach((k, i) => { pt[k] = r.getWorldPoint(V(pose[i][0], pose[i][1])); });
      const v = r.getLinearVelocity(), om = r.getAngularVelocity(), c = r.getWorldCenter();
      const velAt = (p) => V(v.x - om * (p.y - c.y), v.y + om * (p.x - c.x));
      const filt = { filterGroupIndex: -1, filterCategoryBits: CAT.RAG, filterMaskBits: CAT.TERRAIN | CAT.HAZARD | CAT.LOOP };
      const ang = r.getAngle(), pos = r.getPosition();
      const board = this.world.createBody({ type: 'dynamic', position: V(pos.x, pos.y), angle: ang, bullet: true });
      board.createFixture(pl.Box(0.62 * RS, 0.05 * RS), Object.assign({ density: 8, friction: 0.15 }, filt));
      board.setLinearVelocity(velAt(board.getWorldCenter()));
      board.setAngularVelocity(om);
      this.ragBoard = board;
      const parts = {};
      for (const [a, b, th0, name] of SEGS) {
        const th = th0 * RS;
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
      head.createFixture(pl.Circle(0.17 * RS), Object.assign({ density: 2.5, friction: 0.6, restitution: 0.15 }, filt));
      head.setLinearVelocity(velAt(headP));
      parts.head = { body: head, name: 'head', r: 0.17 * RS };
      const joint = (A, B, anchor, lo, hi) => {
        this.world.createJoint(pl.RevoluteJoint({ enableLimit: lo != null, lowerAngle: lo || 0, upperAngle: hi || 0, collideConnected: false }, A, B, anchor));
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
      this.ragFace = this.face;
      this.world.destroyBody(r);
      this.rider = null;
    }

    zeroGAt(x, y) {
      const p = { x, y };
      for (const z of this.L.zones) if (z.type === 'zerog' && inside(z, p)) return true;
      return false;
    }

    focus() {
      if (this.rider) return this.rider.getWorldCenter();
      if (this.ragParts) return this.ragParts.torso.body.getWorldCenter();
      return V(0, 0);
    }

    applyZones(body, mass, isRider) {
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
          if (isRider && !z.hidden) this._inBoost = true;
        }
      }
    }

    // ---------- Schritt ----------
    step(inp) {
      if (this.state === 'finished') { this.world.step(DT, 8, 3); return; }
      this.time += DT;
      const fc = this.focus();
      const zg = this.zeroGAt(fc.x, fc.y);
      if (zg !== this.zerog) { this.zerog = zg; this.setGravity(); if (zg) this.emit('zerog'); }
      const wasBoost = this._inBoost;
      this._inBoost = false;
      // Sägen bewegen
      for (const s of this.saws) {
        const d = s.def;
        const per = d.period || 3, ph = d.phase || 0;
        const t1 = this.time + DT;
        let nx = d.x, ny = d.y;
        if (d.orbit) { const a = (TAU * t1) / per + ph; nx = d.x + Math.cos(a) * d.orbit; ny = d.y + Math.sin(a) * d.orbit; }
        else if (d.mx || d.my) { const k = Math.sin((TAU * t1) / per + ph); nx = d.x + (d.mx || 0) * k; ny = d.y + (d.my || 0) * k; }
        else continue;
        const p = s.body.getPosition();
        s.body.setLinearVelocity(V((nx - p.x) / DT, (ny - p.y) / DT));
      }
      // Eiszapfen auslösen
      for (const ic of this.icicles) {
        if (ic.state !== 'hang' || !this.rider) continue;
        const c = this.rider.getWorldCenter();
        const v = this.rider.getLinearVelocity();
        const trig = ic.d.trig || 5;
        const dx = ic.d.x - c.x;
        if (Math.abs(dx) < trig && Math.sign(dx) === Math.sign(v.x || 1) && Math.abs(ic.d.y - c.y) < 14) {
          ic.state = 'fall';
          ic.body.setType('dynamic');
          ic.body.setGravityScale(1.3);
          this.emit('icicle', { x: ic.d.x, y: ic.d.y });
        }
      }

      if (this.state === 'alive') { this.controlRider(inp); if (this._inBoost && !wasBoost) this.emit('boost'); }
      else {
        this.deadT += DT;
        for (const p of this.rag) this.applyZones(p.body, p.body.getMass(), false);
      }

      this.world.step(DT, 8, 3);

      // zerbrochene Eiszapfen entfernen
      if (this.iceHit) {
        for (const b of this.iceHit) {
          const ic = this.icicles.find((q) => q.body === b);
          if (ic && ic.state === 'fall') { const p = b.getPosition(); this.emit('shatter', { x: p.x, y: p.y }); this.world.destroyBody(b); ic.body = null; ic.state = 'gone'; }
        }
        this.iceHit = null;
      }

      if (this.state === 'alive') this.postRider(inp);
    }

    controlRider(inp) {
      const r = this.rider;
      const m = RIDER_MASS;
      const tilt = clamp(inp.tilt || 0, -1, 1);
      if (this.railCool > 0) this.railCool -= DT;
      // Ducken
      if (inp.duck) this.duckT = 0.35; else this.duckT -= DT;
      const wantDuck = this.duckT > 0 && !this.grab && !this.rail;
      if (wantDuck !== this.duck) { this.duck = wantDuck; this.makeSensors(wantDuck); }
      this.duckAmt = lerp(this.duckAmt, this.duck ? 1 : 0, 0.3);
      // Grabs (nur in der Luft)
      let g = null;
      if (this.air.t > 0.12 && !this.grounded && !this.rail) g = inp.grabL && inp.grabR ? 'indy' : inp.grabL ? 'tail' : inp.grabR ? 'nose' : null;
      this.grab = g;
      for (const k of ['nose', 'tail', 'indy']) this.grabW[k] = lerp(this.grabW[k], g === k ? 1 : 0, 0.32);
      this.airAmt = lerp(this.airAmt, this.grounded || this.rail ? 0 : this.air.t > 0.15 ? 1 : this.airAmt, 0.15);
      this.railAmt = lerp(this.railAmt, this.rail ? 1 : 0, 0.25);
      if (inp.jump) this.jumpBuf = 0.15; else this.jumpBuf -= DT;

      // ---- an einer Rail ----
      if (this.rail) {
        const R = this.rail;
        const a = R.path.at(R.s);
        const gv = this.world.getGravity();
        R.v += (gv.x * a.tx + gv.y * a.ty) * DT;
        R.v -= Math.sign(R.v) * Math.min(Math.abs(R.v), (0.5 + 0.004 * R.v * R.v) * DT);
        // Boost-Zonen auf Rails
        for (const z of this.L.zones) {
          if (z.type === 'boost' && inside(z, r.getWorldCenter())) { const dir = Math.sign(R.v) || 1; if (Math.abs(R.v) < z.speed) R.v += dir * z.str * DT; this._inBoost = true; }
        }
        r.setGravityScale(0);
        r.setLinearVelocity(V(a.tx * R.v, a.ty * R.v));
        r.setAngularVelocity(0);
        if (this.jumpBuf > 0) {
          const n = { x: -a.ty, y: a.tx };
          this.detachRail(V(a.tx * R.v + n.x * 10, a.ty * R.v + n.y * 10));
          this.jumpBuf = 0;
          this.jumpLock = 0.15;
          this.emit('jump');
        }
        return;
      }

      const w = r.getAngularVelocity();
      const I = RIDER_I;
      if (this.grounded) {
        const n = this.groundN;
        const tgt = Math.atan2(-n.x, n.y) - tilt * 0.6;
        const diff = wrap(tgt - r.getAngle());
        r.applyTorque(clamp(I * (130 * diff - 20 * w), -16000, 16000), true);
        if (this.duck) {
          const v = r.getLinearVelocity();
          const sp = Math.hypot(v.x, v.y);
          if (sp > 0.5 && sp < 26) r.applyForceToCenter(V((v.x / sp) * m * 3, (v.y / sp) * m * 3), true);
        }
      } else {
        const maxSpin = 7.2 * (this.opts.spin || 1);
        const tw = -tilt * maxSpin;
        r.applyTorque(clamp(I * 13 * (tw - w), -13000, 13000), true);
      }
      // Springen
      if (this.jumpBuf > 0 && (this.grounded || this.coyote > 0)) {
        const n = this.groundN;
        const v = r.getLinearVelocity();
        const vn = v.x * n.x + v.y * n.y;
        const add = Math.max(0, 8.5 - Math.max(0, vn));
        r.setLinearVelocity(V(v.x + n.x * add, v.y + n.y * add));
        this.jumpBuf = 0; this.coyote = 0; this.grounded = false;
        this.jumpLock = 0.15;
        this.emit('jump');
      }
      this.applyZones(r, m, true);
      const v = r.getLinearVelocity();
      const sp = Math.hypot(v.x, v.y);
      const k = 0.003 * m * sp;
      r.applyForceToCenter(V(-v.x * k, -v.y * k), true);
      if (sp > 42) r.setLinearVelocity(V((v.x * 42) / sp, (v.y * 42) / sp));
    }

    detachRail(vel) {
      const r = this.rider;
      r.setGravityScale(1);
      if (vel) r.setLinearVelocity(vel);
      if (this.grindT > 0.25) {
        const pts = Math.round((100 + 450 * this.grindT) / 10) * 10;
        this.pending += pts;
        this.emit('trick', { text: 'Rail Grind', pts });
      }
      this.grindT = 0;
      this.rail = null;
      this.railCool = 0.35;
      this.grounded = false;
      this.air = this.newAir();
    }

    tryAttachRail() {
      if (this.railCool > 0) return false;
      const r = this.rider;
      const p = r.getPosition();
      const v = r.getLinearVelocity();
      for (const path of this.rails) {
        const bb = path.bb;
        if (p.x < bb[0] || p.x > bb[2] || p.y < bb[1] || p.y > bb[3]) continue;
        const q = path.project(p.x, p.y);
        if (!q || q.side < -0.12 || q.side > RAIL_OFF + 0.35) continue;
        if (q.s < 0.05 && path.L > 1) { /* Anfang */ }
        const nx = -q.ty, ny = q.tx;
        const vn = v.x * nx + v.y * ny;
        if (vn > 1.0) continue; // entfernt sich (z.B. von unten durchgesprungen)
        // Ausrichtung prüfen
        const theta = Math.atan2(q.ty, q.tx);
        const ang = r.getAngle();
        const d = Math.abs(wrap(ang - theta));
        const airborne = this.air.t > 0.25;
        if (this.grab && airborne) { this.crash('grab'); return true; }
        if (d > 1.05) { if (airborne) { this.crash('landing'); return true; } continue; }
        if (airborne) this.land(ang, { x: nx, y: ny });
        const vt = v.x * q.tx + v.y * q.ty;
        this.rail = { path, s: q.s, v: vt };
        this.grindT = 0;
        this.grounded = true;
        this.groundN = { x: nx, y: ny };
        this.emit('rail');
        this.air = this.newAir();
        this.snapRail();
        return true;
      }
      return false;
    }

    snapRail() {
      const R = this.rail, r = this.rider;
      const a = R.path.at(R.s);
      const n = { x: -a.ty, y: a.tx };
      const theta = Math.atan2(a.ty, a.tx);
      const cur = r.getAngle();
      r.setTransform(V(a.x + n.x * RAIL_OFF, a.y + n.y * RAIL_OFF), cur + wrap(theta - cur));
      r.setLinearVelocity(V(a.tx * R.v, a.ty * R.v));
      r.setAngularVelocity(0);
      this.groundN = n;
    }

    postRider(inp) {
      const r = this.rider;
      // ---- Rail-Fahrt ----
      if (this.rail) {
        const R = this.rail;
        R.s += R.v * DT;
        this.grindT += DT;
        if (R.s < 0 || R.s > R.path.L) {
          const a = R.path.at(R.s);
          this.detachRail(V(a.tx * R.v, a.ty * R.v));
        } else {
          this.snapRail();
          this.grounded = true;
          const along = R.v;
          if (Math.abs(along) > 1.5) this.setFace(Math.sign(along));
        }
      }
      if (!this.rail) {
        // Bodenkontakt
        let cnt = 0, nx = 0, ny = 0;
        for (let ce = r.getContactList(); ce; ce = ce.next) {
          const c = ce.contact;
          if (!c.isTouching() || !c.isEnabled()) continue;
          const fa = c.getFixtureA(), fb = c.getFixtureB();
          const mine = fa.getBody() === r ? fa : fb;
          const other = mine === fa ? fb : fa;
          if (mine.isSensor() || other.isSensor()) continue;
          const ou = other.getUserData() || {};
          if (ou.kind !== 'terrain' && ou.kind !== 'loop') continue;
          const wm = c.getWorldManifold(null);
          if (!wm) continue;
          let x = wm.normal.x, y = wm.normal.y;
          if (mine === fa) { x = -x; y = -y; }
          nx += x; ny += y; cnt++;
        }
        if (this.jumpLock > 0) { this.jumpLock -= DT; cnt = 0; }
        const wasGrounded = this.grounded;
        if (cnt > 0) {
          const l = Math.hypot(nx, ny) || 1;
          this.groundN = { x: nx / l, y: ny / l };
          this.grounded = true;
          this.coyote = 0.12;
        } else {
          this.grounded = false;
          this.coyote -= DT;
        }
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
          if (this.tryAttachRail()) { if (this.state !== 'alive') return; }
        } else {
          if (!wasGrounded && this.air.t > 0.25) this.land(ang);
          if (this.state !== 'alive') return;
          this.air = this.newAir();
          // Blickrichtung
          const v = r.getLinearVelocity();
          const along = v.x * Math.cos(ang) + v.y * Math.sin(ang);
          if (Math.abs(along) > 2) this.setFace(Math.sign(along));
          this.tryAttachRail();
        }
      }
      if (this.state !== 'alive') return;

      // Loop-Status
      const com = r.getWorldCenter();
      for (const lp of this.L.loops) {
        if (!lp.done && com.y > lp.cy && com.x < lp.cx && com.x > lp.cx - lp.r) lp.done = true;
        if (lp.done && (com.x > lp.cx + lp.r + 3 || com.x < lp.cx - lp.r - 6)) lp.done = false;
      }

      if (this.crashReq) { this.crash(this.crashReq); return; }

      // Sterne
      const hp = r.getWorldPoint(V(0, 1.0 * RS));
      for (const s of this.stars) {
        if (s.taken) continue;
        if (Math.hypot(s.x - hp.x, s.y - hp.y) < 1.4 || Math.hypot(s.x - com.x, s.y - com.y) < 1.3) {
          s.taken = true; s.pend = true; this.pending += 250;
          this.emit('star', { x: s.x, y: s.y });
        }
      }
      // Speed-Pickups
      for (const p of this.pickups) {
        if (p.taken) continue;
        if (Math.hypot(p.x - com.x, p.y - com.y) < 1.5 || Math.hypot(p.x - hp.x, p.y - hp.y) < 1.4) {
          p.taken = true;
          if (this.rail) { this.rail.v += (Math.sign(this.rail.v) || 1) * 9; }
          else {
            const v = r.getLinearVelocity(); const sp = Math.hypot(v.x, v.y) || 1;
            const ns = Math.min(40, sp + 9);
            r.setLinearVelocity(V((v.x / sp) * ns, (v.y / sp) * ns));
          }
          this.emit('pickup', { x: p.x, y: p.y });
        }
      }
      // Schwerkraft-Schalter
      for (const s of this.switches) {
        if (this.time - s.t < 0.8) continue;
        if (Math.hypot(s.x - com.x, s.y - com.y) < 1.7 || Math.hypot(s.x - hp.x, s.y - hp.y) < 1.5) {
          s.t = this.time;
          const ng = s.g === 'up' ? 1 : s.g === 'down' ? -1 : -this.gsign;
          if (ng !== this.gsign) { this.gsign = ng; this.setGravity(); this.emit('gravity'); }
        }
      }
      // Checkpoints
      this.cps.forEach((cp, i) => {
        if (cp.passed) return;
        if (Math.abs(com.x - cp.x) < 1.6 && Math.abs(com.y - cp.y) < 6) {
          cp.passed = true;
          const v = r.getLinearVelocity();
          cp.v = clamp(Math.hypot(v.x, v.y), cp.vmin, 30);
          cp.dir = v.x >= 0 ? 1 : -1;
          cp.gsign = this.gsign;
          if (i > this.cpIndex) this.cpIndex = i;
          this.bank();
          this.emit('checkpoint', { x: cp.x, y: cp.y });
        }
      });
      // Ziel
      const fz = this.L.finish;
      if (Math.abs(com.x - fz.x) < 1.8 && Math.abs(com.y - fz.y) < 8) {
        if (this.rail) this.detachRail();
        this.bank();
        this.state = 'finished';
        this.emit('finish');
        return;
      }
      const b = this.bounds;
      if (com.y < b.minY - 25 || com.y > b.maxY + 25 || com.x < b.minX - 30 || com.x > b.maxX + 30) this.crash('fall');
    }

    setFace(f) {
      if (f === this.face) return;
      this.face = f;
      this.makeSensors(this.duck);
    }

    camTarget() { return -Math.PI / 2 - Math.atan2(this.gdir.y, this.gdir.x); }

    land(ang, nOverride) {
      const n = nOverride || this.groundN;
      const d = Math.abs(wrap(ang - Math.atan2(-n.x, n.y)));
      if (this.grab) { this.crash('grab'); return; }
      if (d > 1.05) { this.crash('landing'); return; }
      const A = this.air;
      let pts = 0;
      for (let i = 1; i <= A.flips; i++) pts += 500 * i;
      for (const k in A.grabbed) pts += 150 + Math.round(400 * A.grabT[k]);
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
      this.rail = null;
      for (const s of this.stars) if (s.pend) { s.taken = false; s.pend = false; }
      if (this.rider) { this.rider.setGravityScale(1); this.makeRagdoll(); }
      this.emit('crash', { reason });
    }

    respawn() {
      const cp = this.cpIndex >= 0 ? this.cps[this.cpIndex] : null;
      this.spawn(cp ? { x: cp.x, y: cp.y, v: cp.v, dir: cp.dir, gsign: cp.gsign } : this.L.spawn);
    }

    starsTaken() { return this.stars.filter((s) => s.taken).length; }
    score() { return this.banked + this.pending; }
  }

  const api = { Sim, POSES, J, SEGS, blendPose, railPath, DT, G, RS, RAIL_OFF, wrap, clamp, lerp };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SIM = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
