// berechnet Sternpositionen entlang der Bot-Flugbahn
global.planck = require('planck');
global.STAR_GEN = {};
require('../src/levelkit.js'); require('../src/levels.js');
const { Sim } = require('../src/sim.js');
const botMod = require('./botlib.js');
const out = {};
LEVELS.forEach((lv) => {
  const L = lv.make();
  const sim = new Sim(L, {});
  const path = [];
  let f = 0;
  while (f++ < 60 * 120 && sim.state !== 'finished') {
    const inp = sim.state === 'alive' ? botMod.bot(sim, {}) : {};
    sim.step(inp); sim.events.length = 0;
    if (sim.state === 'dead' && sim.deadT > 0.5) sim.respawn();
    if (sim.rider) { const c = sim.rider.getWorldCenter(); path.push([c.x, c.y, sim.grounded]); }
  }
  out[L.name] = (L.auto || []).map((g) => {
    const res = [];
    let startIdx = 0;
    for (let i = 0; i < g.n; i++) {
      const x = g.x0 + ((g.x1 - g.x0) * i) / Math.max(1, g.n - 1);
      let k = startIdx; while (k < path.length - 1 && !(path[k][0] <= x && path[k + 1][0] >= x)) k++;
      if (k >= path.length - 1) continue;
      startIdx = k;
      const a = path[k], b = path[k + 1], t = (x - a[0]) / (b[0] - a[0] || 1);
      res.push([+x.toFixed(2), +(a[1] + (b[1] - a[1]) * t + 0.6).toFixed(2)]);
    }
    return res;
  });
});
require('fs').writeFileSync(__dirname + '/../src/stargen.js', '/* automatisch erzeugt: Sterne entlang der Flugbahnen */\n(function (r) { r.STAR_GEN = ' + JSON.stringify(out) + '; })(typeof globalThis !== "undefined" ? globalThis : this);\n');
console.log('ok', Object.keys(out).map((k) => k + ':' + out[k].map((g) => g.length).join('/')).join('  '));
