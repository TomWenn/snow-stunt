// Headless-Test: ein einfacher Bot fährt jedes Level ab
global.planck = require('planck');
require('../src/stargen.js');
require('../src/levelkit.js');
require('../src/levels.js');
const { Sim, wrap, clamp } = require('../src/sim.js');
const LEVELS = globalThis.LEVELS;
const pl = planck;

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
    for (const hh of [1.1, 1.3]) {
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

function run(idx, opts) {
  opts = opts || {};
  const L = LEVELS[idx].make();
  const sim = new Sim(L, {});
  const log = [];
  let maxX = -1e9, frames = 0, stuck = 0, lastX = 0;
  const crashes = [];
  while (frames < 60 * 240) {
    frames++;
    const inp = sim.state === 'alive' ? bot(sim, opts) : {};
    sim.step(inp);
    for (const e of sim.events) {
      if (e.type === 'crash') { const f = sim.focus(); crashes.push(`${e.reason}@${f.x.toFixed(1)},${f.y.toFixed(1)} t=${sim.time.toFixed(1)}`); }
      if (e.type === 'trick') log.push(`${e.text} ${e.q || ''} +${e.pts}`);
      if (e.type === 'checkpoint') log.push(`CP ${e.x}`);
    }
    sim.events.length = 0;
    if (sim.state === 'dead' && sim.deadT > 0.5) sim.respawn();
    if (sim.state === 'finished') break;
    const f = sim.focus();
    if (opts.at && sim.time >= opts.at[0] && sim.time <= opts.at[1] && frames % 3 === 0 && sim.rider) {
      const r = sim.rider, p = r.getPosition(), v = r.getLinearVelocity();
      let cs = '';
      for (let ce = r.getContactList(); ce; ce = ce.next) { const c = ce.contact; if (!c.isTouching()) continue; const o = c.getFixtureA().getBody() === r ? c.getFixtureB() : c.getFixtureA(); cs += ' ' + ((o.getUserData() || {}).kind) + (c.isEnabled() ? '' : '(off)'); }
      console.log(`   ${sim.time.toFixed(2)} p=${p.x.toFixed(2)},${p.y.toFixed(2)} v=${v.x.toFixed(1)},${v.y.toFixed(1)} a=${r.getAngle().toFixed(2)} gr=${sim.grounded} duck=${sim.duck} inp=${JSON.stringify(inp)}${cs}`);
    }
    maxX = Math.max(maxX, f.x);
    if (sim.rider && opts.stars) { const c = sim.rider.getWorldCenter(); (run.path = run.path || []).push([c.x, c.y]); }
    if (frames % 120 === 0) {
      if (Math.abs(f.x - lastX) < 0.5 && sim.state === 'alive') stuck++; else stuck = 0;
      lastX = f.x;
      if (opts.trace) console.log(`  t=${sim.time.toFixed(1)} x=${f.x.toFixed(1)} y=${f.y.toFixed(1)} v=${sim.rider ? sim.rider.getLinearVelocity().length().toFixed(1) : '-'} g=${sim.grounded}`);
      if (stuck > 3) { crashes.push('STUCK@' + f.x.toFixed(1)); break; }
    }
    if (crashes.length > 12) break;
  }
  if (opts.stars && run.path) {
    const miss = [];
    L.stars.forEach((st, i) => { let d = 1e9; for (const q of run.path) d = Math.min(d, Math.hypot(q[0] - st[0], q[1] - st[1])); if (d > 1.2) miss.push(`#${i}(${st[0].toFixed(0)},${st[1].toFixed(1)}) d=${d.toFixed(1)}`); });
    console.log('   star misses: ' + miss.join(' '));
    run.path = null;
  }
  return { name: L.name, finished: sim.state === 'finished', time: sim.time.toFixed(1), maxX: maxX.toFixed(1), finishX: L.finish.x, score: sim.score(), stars: `${sim.starsTaken()}/${sim.stars.length}`, crashes, log };
}

const which = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2].split(',').map(Number) : LEVELS.map((_, i) => i);
const atA = process.argv.find((a) => a.startsWith('--at='));
const opts = { at: atA ? atA.slice(5).split(',').map(Number) : null, trace: process.argv.includes('--trace'), flip: process.argv.includes('--flip') ? 1 : 0, grab: process.argv.includes('--grab'), stars: process.argv.includes('--stars') };
for (const i of which) {
  const r = run(i, opts);
  console.log(`#${i + 1} ${r.name}: ${r.finished ? 'ZIEL' : 'NICHT GESCHAFFT'} t=${r.time}s maxX=${r.maxX}/${r.finishX} score=${r.score} stars=${r.stars}`);
  if (r.crashes.length) console.log('   crashes: ' + r.crashes.join(' | '));
  if (process.argv.includes('--log')) console.log('   ' + r.log.join(' | '));
}
