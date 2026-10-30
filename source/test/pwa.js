const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 });
  const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERR ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await p.goto('http://localhost:8765/index.html#level2');
  await p.waitForTimeout(1500);
  const sw = await p.evaluate(async () => !!(await navigator.serviceWorker.getRegistration()));
  console.log('Service Worker:', sw);
  // Tricks per Tastatur: springen + flip
  await p.keyboard.down('ArrowRight'); await p.waitForTimeout(100); await p.keyboard.up('ArrowRight');
  await p.evaluate(() => { const s = __game.game.sim; s.banked = 7400; s.bank(); s.state = 'finished'; s.emit('finish'); });
  await p.waitForTimeout(1800);
  await p.screenshot({ path: 'shots/p_result.png' });
  console.log(errs.join('\n') || 'keine Fehler');
  await b.close();
})();
