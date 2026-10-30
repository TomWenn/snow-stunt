const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERR ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await p.goto('file://' + process.cwd() + '/dist/index.html');
  await p.waitForTimeout(300);
  const cdp = await ctx.newCDPSession(p);
  const touch = async (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i })) });
  // Neigungssimulation
  // sx, sy in Bildschirmkoordinaten -> Gerätekoordinaten bei window.orientation = 90 (screen = (-ay, ax))
  const motion = (sx, sy) => p.evaluate(([sx, sy]) => {
    const e = new Event('devicemotion'); e.accelerationIncludingGravity = { x: sy, y: -sx, z: -3 }; window.dispatchEvent(e);
  }, [sx, sy]);
  console.log('ctrl vorher', await p.evaluate(() => __game.S.control));
  await p.tap('#bPlay');
  console.log('ctrl nach Spielen', await p.evaluate(() => __game.S.control));
  await p.waitForTimeout(300);
  await p.screenshot({ path: 'shots/t_levels.png' });
  await p.click('.lv >> nth=0');
  for (let i = 0; i < 20; i++) { await motion(0, -9); await p.waitForTimeout(20); }
  await p.waitForTimeout(1700);
  const info = await p.evaluate(() => ({ seen: __game.tiltSt.seen, conv: __game.tiltSt.conv, roll: __game.tiltSt.roll, ctrl: __game.S.control, orient: window.orientation }));
  console.log('nach Start', JSON.stringify(info));
  // nach rechts neigen
  for (let i = 0; i < 10; i++) { await motion(4, -8); await p.waitForTimeout(20); }
  console.log('rechts geneigt', await p.evaluate(() => __game.tiltSt.roll.toFixed(2)));
  // umgekehrte Konvention
  await p.evaluate(() => { __game.tiltSt.conv = 0; });
  for (let i = 0; i < 10; i++) { await motion(-4, 8); await p.waitForTimeout(20); }
  console.log('rechts (andere Konv.)', await p.evaluate(() => __game.tiltSt.roll.toFixed(2) + ' conv ' + __game.tiltSt.conv));
  for (let i = 0; i < 5; i++) { await motion(0, 9); await p.waitForTimeout(20); }
  await p.waitForTimeout(1500);
  // Grab rechts halten + Swipe hoch
  await touch('touchStart', [[700, 250]]);
  await p.waitForTimeout(400);
  await p.screenshot({ path: 'shots/t_grab.png' });
  await touch('touchEnd', []);
  await touch('touchStart', [[400, 300]]); await touch('touchMove', [[400, 220]]); await touch('touchEnd', []);
  await p.waitForTimeout(150);
  await p.screenshot({ path: 'shots/t_jump.png' });
  const st = await p.evaluate(() => ({ air: __game.game.sim.air.t, grounded: __game.game.sim.grounded }));
  console.log('nach Swipe', JSON.stringify(st));
  // Pause
  await p.tap('#pauseBtn'); await p.waitForTimeout(200);
  await p.screenshot({ path: 'shots/t_pause.png' });
  console.log(errs.join('\n') || 'keine Fehler');
  await b.close();
})();
