const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const touch = process.argv.includes('--touch');
  const p = await b.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: touch, isMobile: touch });
  const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERR ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  const lvl = process.argv[2] || '1';
  await p.goto('file://' + process.cwd() + '/dist/index.html');
  await p.waitForTimeout(500);
  await p.screenshot({ path: 'shots/menu.png' });
  await p.goto('file://' + process.cwd() + '/dist/index.html#level' + lvl);
  await p.waitForTimeout(300);
  const times = (process.argv[3] || '1,3,5').split(',').map(Number);
  let t0 = 0;
  for (const t of times) {
    await p.waitForTimeout((t - t0) * 1000); t0 = t;
    await p.screenshot({ path: `shots/l${lvl}_${t}.png` });
  }
  console.log(errs.join('\n') || 'keine Fehler');
  await b.close();
})();
