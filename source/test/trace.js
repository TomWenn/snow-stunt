global.planck = require('planck');
require('../src/levelkit.js'); require('../src/levels.js');
const { Sim } = require('../src/sim.js');
const idx = +process.argv[2], t0 = +process.argv[3], t1 = +process.argv[4];
const L = LEVELS[idx].make(); const sim = new Sim(L, {});
const inp = process.argv[5] ? JSON.parse(process.argv[5]) : {};
while (sim.time < t1) {
  sim.step(inp);
  for (const e of sim.events) if (sim.time > t0) console.log('  EV', e.type, e.reason || e.text || '');
  sim.events.length = 0;
  if (sim.time > t0 && Math.round(sim.time * 60) % 6 === 0 && sim.rider) {
    const c = sim.rider.getWorldCenter(), v = sim.rider.getLinearVelocity();
    console.log(sim.time.toFixed(2), 'c', c.x.toFixed(2), c.y.toFixed(2), 'v', v.x.toFixed(1), v.y.toFixed(1), 'a', sim.rider.getAngle().toFixed(2), 'g', sim.grounded, 'n', sim.groundN.x.toFixed(2), sim.groundN.y.toFixed(2), L.loops[0] ? 'done=' + L.loops[0].done : '');
  }
}
