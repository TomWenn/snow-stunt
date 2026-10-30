/* Werkzeuge zum Bauen von Levels */
(function (root) {
  'use strict';
  const D2R = Math.PI / 180;

  // einfacher deterministischer Zufall
  function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

  class Path {
    constructor(x, y) { this.pts = [[x, y]]; }
    get x() { return this.pts[this.pts.length - 1][0]; }
    get y() { return this.pts[this.pts.length - 1][1]; }
    get end() { return [this.x, this.y]; }
    l(dx, dy) { // gerade
      const n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 3));
      const x0 = this.x, y0 = this.y;
      for (let i = 1; i <= n; i++) this.pts.push([x0 + (dx * i) / n, y0 + (dy * i) / n]);
      return this;
    }
    flat(dx) { return this.l(dx, 0); }
    // Hermite-Kurve mit Start-/Endwinkel in Grad (0 = waagerecht, + = nach oben)
    h(dx, dy, a0, a1) {
      const x0 = this.x, y0 = this.y;
      const L = Math.hypot(dx, dy);
      const m0 = [Math.cos(a0 * D2R) * L, Math.sin(a0 * D2R) * L];
      const m1 = [Math.cos(a1 * D2R) * L, Math.sin(a1 * D2R) * L];
      const n = Math.max(6, Math.ceil(L / 0.7));
      for (let i = 1; i <= n; i++) {
        const t = i / n, t2 = t * t, t3 = t2 * t;
        const h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t, h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
        this.pts.push([h00 * x0 + h10 * m0[0] + h01 * (x0 + dx) + h11 * m1[0], h00 * y0 + h10 * m0[1] + h01 * (y0 + dy) + h11 * m1[1]]);
      }
      return this;
    }
    // weiche Abfahrt (flach -> flach)
    down(dx, dy) { return this.h(dx, -dy, 0, 0); }
    // Schanze: von flach in Absprungwinkel
    kick(dx, dy, ang) { return this.h(dx, dy, 0, ang); }
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

  function dedupe(pts) {
    const out = [];
    for (const p of pts) {
      const q = out[out.length - 1];
      if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 0.08) out.push(p);
    }
    const f = out[0], l = out[out.length - 1];
    if (out.length > 2 && Math.hypot(f[0] - l[0], f[1] - l[1]) < 0.08) out.pop();
    return out;
  }

  class Level {
    constructor(name, opts) {
      this.d = {
        name, terrain: [], rails: [], saws: [], spikes: [], stars: [], checkpoints: [], zones: [], signs: [], loops: [],
        deco: [], spawn: null, finish: null, cups: (opts && opts.cups) || [2000, 5000, 9000], theme: (opts && opts.theme) || 0,
      };
      this.rand = rng(name.length * 7919 + 17);
    }
    path(x, y) { return new Path(x, y); }

    // schwebende Insel / Berg: Oberfläche + zackige Unterseite
    island(p, depth, opt) {
      depth = depth == null ? 7 : depth;
      const surf = p.pts.slice();
      const x0 = surf[0][0], x1 = surf[surf.length - 1][0];
      const poly = surf.slice();
      const wdt = Math.abs(x1 - x0);
      const n = Math.max(2, Math.ceil(wdt / 2.5));
      const r = this.rand;
      // rechte Kante runter
      for (let i = 0; i <= n; i++) {
        const u = 1 - i / n;
        const x = x0 + (x1 - x0) * u;
        const ySurf = p.yAt(x);
        const bulge = Math.sin(Math.PI * Math.min(1, Math.max(0, u * 1.0)));
        let dd = depth * (0.35 + 0.65 * Math.pow(bulge, 0.6)) + (i > 0 && i < n ? (r() - 0.5) * depth * 0.25 : 0);
        if (i === 0 || i === n) dd = Math.min(1.2, depth * 0.3);
        poly.push([x + (i > 0 && i < n ? (r() - 0.5) * 0.8 : 0), Math.min(ySurf - 0.8, ySurf - dd)]);
      }
      this.d.terrain.push({ poly: dedupe(poly), surf, kind: 'island', snow: !(opt && opt.nosnow) });
      return p;
    }
    // Boden, der weit nach unten reicht
    ground(p, depth) {
      const surf = p.pts.slice();
      const minY = Math.min(...surf.map((q) => q[1])) - (depth || 40);
      const poly = surf.slice();
      poly.push([surf[surf.length - 1][0], minY]);
      poly.push([surf[0][0], minY]);
      this.d.terrain.push({ poly: dedupe(poly), surf, kind: 'island', snow: true });
      return p;
    }
    // Decke für Schwerkraft-Umkehr (Oberfläche zeigt nach unten)
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
    // Felsblock (Rechteck, leicht unregelmäßig)
    rock(x, y, w, h) {
      const r = this.rand, j = () => (r() - 0.5) * 0.3;
      const poly = [[x, y], [x + w * 0.5, y + j()], [x + w, y], [x + w + j(), y + h * 0.5], [x + w, y + h], [x + w * 0.5, y + h + j()], [x, y + h], [x + j(), y + h * 0.5]];
      this.d.terrain.push({ poly, surf: [[x, y + h], [x + w, y + h]], kind: 'rock', snow: true });
    }
    rail(x1, y1, x2, y2) { this.d.rails.push([x1, y1, x2, y2]); }
    saw(x, y, r, o) { this.d.saws.push(Object.assign({ x, y, r }, o || {})); }
    // Stacheln/Eiszapfen. dir: 'up' | 'down'
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
    star(x, y) { this.d.stars.push([x, y]); }
    // Sterne entlang einer Bahn über dem Weg
    starsAlong(p, x0, x1, n, hgt) { for (let i = 0; i < n; i++) { const x = x0 + ((x1 - x0) * i) / Math.max(1, n - 1); this.star(x, p.yAt(x) + (hgt || 1.2)); } }
    starArc(x0, y0, x1, y1, peak, n) {
      for (let i = 0; i < n; i++) { const t = n === 1 ? 0.5 : i / (n - 1); this.star(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + 4 * peak * t * (1 - t)); }
    }
    // Sterne entlang der echten Flugbahn (vorberechnet in stargen.js)
    starAuto(x0, x1, n) { (this.d.auto = this.d.auto || []).push({ x0, x1, n }); }
    checkpoint(x, y, v, dir) { this.d.checkpoints.push({ x, y, v: v == null ? 8 : v, dir: dir || 1 }); }
    spawn(x, y, v) { this.d.spawn = { x, y, v: v == null ? 6 : v, dir: 1 }; }
    finish(x, y) { this.d.finish = { x, y }; }
    zone(type, x, y, w, h, o) { this.d.zones.push(Object.assign({ type, x, y, w, h }, o || {})); }
    boost(x, y, w, h, ang, speed) { const a = (ang || 0) * D2R; this.zone('boost', x, y, w, h, { dir: [Math.cos(a), Math.sin(a)], str: 30, speed: speed || 26, ang: ang || 0 }); }
    fan(x, y, w, h, str) { this.zone('fan', x, y, w, h, { dir: [0, 1], str: str || 42 }); }
    invert(x, y, w, h) { this.zone('invert', x, y, w, h); }
    zerog(x, y, w, h) { this.zone('zerog', x, y, w, h); }
    loop(cx, groundY, r) {
      this.d.loops.push({ cx, cy: groundY + r, r });
      this.zone('boost', cx - r - 0.5, groundY, 2 * r + 1, 2 * r + 0.5, { dir: [1, 0], vel: true, str: 26, speed: 19, hidden: true });
    }
    // Schild: icon = 'jump' | 'duck' | 'flip' | 'grab' | 'arrow' | 'warn' | 'land'; text = optional
    sign(x, y, icon, text, inv) { this.d.signs.push({ x, y, icon, text, inv: !!inv }); }
    tree(x, y, s, inv) { this.d.deco.push({ t: 'tree', x, y, s: s || 1, inv: !!inv }); }
    trees(p, x0, x1, n) { const r = this.rand; for (let i = 0; i < n; i++) { const x = x0 + (x1 - x0) * r(); this.tree(x, p.yAt(x) - 0.1, 0.7 + r() * 0.7); } }

    build() {
      const d = this.d;
      let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
      for (const t of d.terrain) for (const p of t.poly) { minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
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
