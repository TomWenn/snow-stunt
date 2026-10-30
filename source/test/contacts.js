global.planck = require('planck');
require('../src/levelkit.js'); require('../src/levels.js');
const { Sim } = require('../src/sim.js');
const idx = +process.argv[2], t0 = +process.argv[3], t1 = +process.argv[4];
const L = LEVELS[idx].make(); const sim = new Sim(L, {});
while (sim.time < t1) {
  sim.step({});
  sim.events.length = 0;
  if (sim.time > t0 && sim.rider) {
    const r = sim.rider; const p = r.getPosition(); const v = r.getLinearVelocity();
    let s = `${sim.time.toFixed(3)} pos ${p.x.toFixed(2)},${p.y.toFixed(3)} v ${v.x.toFixed(1)} :`;
    for (let ce = r.getContactList(); ce; ce = ce.next) {
      const c = ce.contact; if (!c.isTouching()) continue;
      const o = ce.other; const fa = c.getFixtureA(); const other = fa.getBody() === r ? c.getFixtureB() : fa;
      const u = other.getUserData() || {}; const wm = c.getWorldManifold(null);
      s += ` [${u.kind}${u.part||''} en=${c.isEnabled()} n=${wm.normal.x.toFixed(2)},${wm.normal.y.toFixed(2)} p=${wm.points[0] ? wm.points[0].x.toFixed(2)+','+wm.points[0].y.toFixed(2) : ''} idx=${c.getChildIndexA()},${c.getChildIndexB()}]`;
    }
    console.log(s);
  }
}
