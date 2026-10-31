/* Werkzeuge zum Bauen von Levels */
(function (root) {
  'use strict';
  const D2R = Math.PI / 180;
  function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

  class Path {
    constructor(x, y, hd) { this.pts = [[x, y]]; this.hd = hd || 0; }
    get x() { return this.pts[this.pts.length - 1][0]; }
    get y() { return this.pts[this.pts.length - 1][1]; }
    get end() { return [this.x, this.y]; }
    l(dx, dy) {
      const n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 2));
      const x0 = this.x, y0 = this.y;
      for (let i = 1; i <= n; i++) this.pts.push([x0 + (dx * i) / n, y0 + (dy * i) / n]);
      this.hd = Math.atan2(dy, dx) / D2R;
      return this;
    }
    flat(dx) { return this.l(dx, 0); }
    // Hermite-Kurve; a0/a1 = Tangentenwinkel in Grad (0 = rechts, 90 = hoch, 180 = links)
    h(dx, dy, a0, a1, k) {
      const x0 = this.x, y0 = this.y;
      const L = Math.hypot(dx, dy) * (k || 1);
      const m0 = [Math.cos(a0 * D2R) * L, Math.sin(a0 * D2R) * L];
      const m1 = [Math.cos(a1 * D2R) * L, Math.sin(a1 * D2R) * L];
      const n = Math.max(8, Math.ceil(Math.hypot(dx, dy) / 0.5));
      for (let i = 1; i <= n; i++) {
        const t = i / n, t2 = t * t, t3 = t2 * t;
        const h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t, h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
        this.pts.push([h00 * x0 + h10 * m0[0] + h01 * (x0 + dx) + h11 * m1[0], h00 * y0 + h10 * m0[1] + h01 * (y0 + dy) + h11 * m1[1]]);
      }
      this.hd = a1;
      return this;
    }
    down(dx, dy) { const a = dx < 0 ? 180 : 0; return this.h(dx, -dy, a, a); }
    kick(dx, dy, ang) { const left = dx < 0; return this.h(dx, dy, left ? 180 : 0, left ? 180 - ang : ang); }
    // Kreisbogen: deg > 0 = gegen Uhrzeigersinn
    turn(deg, r) {
      const h = this.hd * D2R, s = Math.sign(deg) || 1;
      const cx = this.x - Math.sin(h) * r * s, cy = this.y + Math.cos(h) * r * s;
      const a0 = Math.atan2(this.y - cy, this.x - cx);
      const n = Math.max(6, Math.ceil((Math.abs(deg) * D2R * r) / 0.4));
      for (let i = 1; i <= n; i++) { const a = a0 + (deg * D2R * i) / n; this.pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
      this.hd += deg;
      return this;
    }
    yAt(x) {
      const p = this.pts;
      for (let i = 1; i < p.length; i++) {
        const a = p[i - 1], b = p[i];
        if ((x >= a[0] && x <= b[0]) || (x <= a[0] && x >= b[0])) {
          const t = b[0] === a[0] ? 0 : (x - a[0]) / (b[0] - a[0]);
          return a[1] + (b[1] - a[1]) * t;
        }
      }
      return x < p[0][0] ? p[0][1] : p[p.length - 1][1];
    }
  }

  function dedupe(pts, eps) {
    eps = eps || 0.08;
    const out = [];
    for (const p of pts) { const q = out[out.length - 1]; if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > eps) out.push(p); }
    const f = out[0], l = out[out.length - 1];
    if (out.length > 2 && Math.hypot(f[0] - l[0], f[1] - l[1]) < eps) out.pop();
    return out;
  }
  function resample(pts, step) {
    const out = [pts[0]];
    let acc = 0;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      acc += l;
      if (acc >= step || i === pts.length - 1) { out.push(b); acc = 0; }
    }
    return out;
  }

  class Level {
    constructor(name, opts) {
      this.d = {
        name, terrain: [], rails: [], saws: [], spikes: [], stars: [], checkpoints: [], zones: [], signs: [], loops: [],
        icicles: [], pickups: [], switches: [], deco: [], spawn: null, finish: null,
        cups: (opts && opts.cups) || [3000, 7000, 12000], theme: (opts && opts.theme) || 0,
      };
      this.rand = rng(name.length * 7919 + 17);
    }
    path(x, y, hd) { return new Path(x, y, hd); }

    // schwebende Eisscholle / Berg (Oberfläche oben, zackige Unterseite)
    island(p, depth, opt) {
      depth = depth == null ? 7 : depth;
      const surf = p.pts.slice();
      const x0 = surf[0][0], x1 = surf[surf.length - 1][0];
      const poly = surf.slice();
      const n = Math.max(2, Math.ceil(Math.abs(x1 - x0) / 2.5));
      const r = this.rand;
      for (let i = 0; i <= n; i++) {
        const u = 1 - i / n;
        const x = x0 + (x1 - x0) * u;
        const ySurf = p.yAt(x);
        const bulge = Math.sin(Math.PI * u);
        let dd = depth * (0.35 + 0.65 * Math.pow(bulge, 0.6)) + (i > 0 && i < n ? (r() - 0.5) * depth * 0.3 : 0);
        if (i === 0 || i === n) dd = Math.min(1.2, depth * 0.3);
        poly.push([x + (i > 0 && i < n ? (r() - 0.5) * 0.8 : 0), Math.min(ySurf - 0.8, ySurf - dd)]);
      }
      this.d.terrain.push({ poly: dedupe(poly), surf, kind: 'island', snow: !(opt && opt.nosnow) });
      return p;
    }
    // massiver Boden bis weit nach unten (für Steilwände/Halfpipes)
    ground(p, bottom) {
      const surf = p.pts.slice();
      const minY = bottom != null ? bottom : Math.min(...surf.map((q) => q[1])) - 30;
      const poly = surf.slice();
      poly.push([surf[surf.length - 1][0], minY]);
      poly.push([surf[0][0], minY]);
      this.d.terrain.push({ poly: dedupe(poly), surf, kind: 'island', snow: true });
      return p;
    }
    // Decke (Oberfläche unten) für Schwerkraft-Umkehr
    ceiling(p, depth) {
      depth = depth == null ? 6 : depth;
      const surf = p.pts.slice();
      const x0 = surf[0][0], x1 = surf[surf.length - 1][0];
      const poly = surf.slice();
      const n = Math.max(2, Math.ceil(Math.abs(x1 - x0) / 2.5));
      const r = this.rand;
      for (let i = 0; i <= n; i++) {
        const u = 1 - i / n;
        const x = x0 + (x1 - x0) * u;
        const ySurf = p.yAt(x);
        const bulge = Math.sin(Math.PI * u);
        let dd = depth * (0.35 + 0.65 * Math.pow(bulge, 0.6)) + (i > 0 && i < n ? (r() - 0.5) * depth * 0.25 : 0);
        if (i === 0 || i === n) dd = Math.min(1.2, depth * 0.3);
        poly.push([x, Math.max(ySurf + 0.8, ySurf + dd)]);
      }
      this.d.terrain.push({ poly: dedupe(poly), surf, kind: 'ceiling', snow: true });
      return p;
    }
    // Decke, die bis weit nach oben reicht
    roof(p, top) {
      const surf = p.pts.slice();
      const maxY = top != null ? top : Math.max(...surf.map((q) => q[1])) + 20;
      const poly = surf.slice();
      poly.push([surf[surf.length - 1][0], maxY]);
      poly.push([surf[0][0], maxY]);
      this.d.terrain.push({ poly: dedupe(poly), surf, kind: 'ceiling', snow: true });
      return p;
    }
    // Eisblock (Rechteck)
    rock(x, y, w, h, snowTop) {
      const r = this.rand, j = () => (r() - 0.5) * 0.3;
      const poly = [[x, y], [x + w * 0.5, y + j()], [x + w, y], [x + w + j(), y + h * 0.5], [x + w, y + h], [x + w * 0.5, y + h + j()], [x, y + h], [x + j(), y + h * 0.5]];
      this.d.terrain.push({ poly, surf: snowTop === false ? [[x, y], [x + w, y]] : [[x, y + h], [x + w, y + h]], kind: 'rock', snow: true, under: snowTop === false });
    }
    // Festhalte-Rail entlang eines Pfades (Fahrseite = links der Laufrichtung)
    rail(p) { this.d.rails.push({ pts: resample(dedupe(p.pts || p, 0.05), 0.35) }); return p; }
    railLine(x1, y1, x2, y2) { return this.rail(new Path(x1, y1).l(x2 - x1, y2 - y1)); }
    saw(x, y, r, o) { this.d.saws.push(Object.assign({ x, y, r }, o || {})); }
    spikes(x, y, w, dir, h) {
      h = h || 0.9;
      const n = Math.max(1, Math.round(w / 0.55));
      const sw = w / n, s = dir === 'down' ? -1 : 1;
      const tris = [];
      for (let i = 0; i < n; i++) {
        const a = x + i * sw;
        const tri = [[a, y], [a + sw, y], [a + sw / 2, y + s * h]];
        if (s < 0) tri.reverse();
        tris.push(tri);
      }
      this.d.spikes.push({ x, y, w, dir, h, tris });
    }
    // fallender Eiszapfen (Falle): hängt an (x,y), fällt wenn man in die Nähe kommt
    icicle(x, y, len, trig) { this.d.icicles.push({ x, y, len: len || 1.8, w: 0.3 + (len || 1.8) * 0.18, trig: trig || 5 }); }
    icicles(x0, x1, y, n, len, trig) { for (let i = 0; i < n; i++) this.icicle(x0 + ((x1 - x0) * i) / Math.max(1, n - 1), y, len, trig); }
    pickup(x, y) { this.d.pickups.push([x, y]); }
    gswitch(x, y, g) { this.d.switches.push({ x, y, g: g || 'toggle' }); }
    gate(x, y0, y1, g) { const n = Math.max(1, Math.round((y1 - y0) / 2.6)); for (let i = 0; i <= n; i++) this.gswitch(x, y0 + ((y1 - y0) * i) / n, g); }
    star(x, y) { this.d.stars.push([x, y]); }
    starsAlong(p, x0, x1, n, hgt) { for (let i = 0; i < n; i++) { const x = x0 + ((x1 - x0) * i) / Math.max(1, n - 1); this.star(x, p.yAt(x) + (hgt == null ? 1.4 : hgt)); } }
    starAuto(x0, x1, n) { (this.d.auto = this.d.auto || []).push({ x0, x1, n }); }
    checkpoint(x, y, v, dir) { this.d.checkpoints.push({ x, y, v: v == null ? 11 : v, dir: dir || 1 }); }
    spawn(x, y, v, dir, gsign) { this.d.spawn = { x, y, v: v == null ? 6 : v, dir: dir || 1, gsign: gsign || -1 }; }
    finish(x, y) { this.d.finish = { x, y }; }
    zone(type, x, y, w, h, o) { this.d.zones.push(Object.assign({ type, x, y, w, h }, o || {})); }
    boost(x, y, w, h, ang, speed) { const a = (ang || 0) * D2R; this.zone('boost', x, y, w, h, { dir: [Math.cos(a), Math.sin(a)], str: 32, speed: speed || 28, ang: ang || 0 }); }
    fan(x, y, w, h, str, ang) { const a = (ang == null ? 90 : ang) * D2R; this.zone('fan', x, y, w, h, { dir: [Math.cos(a), Math.sin(a)], str: str || 44, ang: ang == null ? 90 : ang }); }
    zerog(x, y, w, h) { this.zone('zerog', x, y, w, h); }
    loop(cx, groundY, r) {
      this.d.loops.push({ cx, cy: groundY + r, r });
      this.zone('boost', cx - r - 0.5, groundY, 2 * r + 1, 2 * r + 0.5, { dir: [1, 0], vel: true, str: 26, speed: 19, hidden: true });
    }
    sign(x, y, icon, text, inv) { this.d.signs.push({ x, y, icon, text, inv: !!inv }); }
    deco(t, x, y, s, inv) { this.d.deco.push({ t, x, y, s: s || 1, inv: !!inv }); }
    crystals(p, x0, x1, n) { const r = this.rand; for (let i = 0; i < n; i++) { const x = x0 + (x1 - x0) * r(); this.deco('crystal', x, p.yAt(x) - 0.15, 0.6 + r() * 0.8); } }
    flagsAlong() {}

    build() {
      const d = this.d;
      let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
      for (const t of d.terrain) for (const p of t.poly) { minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
      for (const r of d.rails) for (const p of r.pts) { minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
      d.bounds = { minX, maxX, minY, maxY };
      const gen = root.STAR_GEN && root.STAR_GEN[d.name];
      (d.auto || []).forEach((g, gi) => { if (gen && gen[gi]) for (const st of gen[gi]) d.stars.push(st); });
      if (!d.spawn) throw new Error('kein Start in ' + d.name);
      if (!d.finish) throw new Error('kein Ziel in ' + d.name);
      for (const t of d.terrain) {
        let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
        for (const p of t.poly) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
        t.bb = [x0, y0, x1, y1];
      }
      return d;
    }
  }

  const api = { Level, Path };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LK = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
