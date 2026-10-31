const pl = require('planck');
const { wrap, clamp } = require('../src/sim.js');
function ray(sim, p1, p2, kinds) {
  let hit = null;
  sim.world.rayCast(p1, p2, (f, point, normal, frac) => {
    const u = f.getUserData() || {};
    if (!kinds.includes(u.kind)) return -1;
    if (f.isSensor()) return -1;
    if (f.getBody() === sim.rider) return -1;
    hit = { point, normal, frac, kind: u.kind };
    return frac;
  });
  return hit;
}

function bot(sim, opts) {
  const inp = { tilt: 0, jump: false, duck: false, grabL: false, grabR: false };
  const r = sim.rider;
  if (!r) return inp;
  const c = r.getWorldCenter();
  const g = sim.gdir;
  const v = r.getLinearVelocity();
  const ang = r.getAngle();
  if (!sim.grounded) {
    // Ziel: auf Boden unter/vor uns ausrichten
    const ahead = { x: c.x + v.x * 0.25, y: c.y + v.y * 0.25 };
    const h = ray(sim, pl.Vec2(ahead.x, ahead.y), pl.Vec2(ahead.x + g.x * 40, ahead.y + g.y * 40), ['terrain', 'rail', 'loop']);
    let tgt = Math.atan2(g.x, -g.y);
    if (h) tgt = Math.atan2(-h.normal.x, h.normal.y);
    if (opts.flip && sim.air.t > 0.1 && sim.air.flips < opts.flip && (!h || h.frac * 40 > 9)) {
      inp.tilt = 1;
    } else {
      const d = wrap(tgt - ang);
      inp.tilt = clamp(-d * 2.2 + r.getAngularVelocity() * 0.12, -1, 1);
    }
    if (opts.grab && sim.air.t > 0.2 && (!h || h.frac * 40 > 5)) inp.grabR = true;
  } else if (sim.rail) {
    const R = sim.rail, a = R.path.at(R.s), dir = Math.sign(R.v) || 1;
    const n = { x: -a.ty, y: a.tx };
    const p = r.getPosition();
    for (const hh of [0.6, 1.4]) {
      const o = { x: p.x + n.x * hh, y: p.y + n.y * hh };
      if (ray(sim, pl.Vec2(o.x, o.y), pl.Vec2(o.x + a.tx * dir * 8, o.y + a.ty * dir * 8), ['hazard'])) inp.jump = true;
    }
    return inp;
  } else {
    const n = sim.groundN;
    const t = { x: n.y, y: -n.x }; // Tangente vorwärts (für +x)
    const dir = Math.sign(v.x * t.x + v.y * t.y) || 1;
    const fx = t.x * dir, fy = t.y * dir;
    // Abgrund voraus?
    const lookP = { x: c.x + fx * 2.2 + n.x * 0.5, y: c.y + fy * 2.2 + n.y * 0.5 };
    const down = ray(sim, pl.Vec2(lookP.x, lookP.y), pl.Vec2(lookP.x - n.x * 6, lookP.y - n.y * 6), ['terrain', 'rail', 'loop']);
    if (!down) inp.jump = true;
    // Hindernis in Kopfhöhe?
    let head = null;
    for (const hh of [1.25, 1.45]) {
      const hb = { x: c.x + n.x * hh, y: c.y + n.y * hh };
      head = head || ray(sim, pl.Vec2(hb.x, hb.y), pl.Vec2(hb.x + fx * 7, hb.y + fy * 7), ['terrain', 'hazard']);
    }
    const lb = { x: c.x - n.x * 0.1, y: c.y - n.y * 0.1 };
    const low = ray(sim, pl.Vec2(lb.x, lb.y), pl.Vec2(lb.x + fx * 5, lb.y + fy * 5), ['hazard']);
    if (head && !low) inp.duck = true;
    if (low) inp.jump = true;
  }
  return inp;
}

module.exports = { bot, ray };
