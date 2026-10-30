const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1800, height: 700 }, deviceScaleFactor: 1 });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  for (const n of process.argv[2].split(',')) {
    await p.goto('file://' + process.cwd() + '/dist/index.html#overview' + n);
    await p.waitForTimeout(400);
    await p.screenshot({ path: `shots/ov${n}.png` });
    await p.goto('about:blank');
  }
  await b.close();
})();
