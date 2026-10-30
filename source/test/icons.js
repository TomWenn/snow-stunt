const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  for (const s of [180, 192, 512]) {
    const data = await p.evaluate((S) => {
      const c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d');
      const k = S / 512;
      const g = x.createLinearGradient(0, 0, 0, S); g.addColorStop(0, '#0b1531'); g.addColorStop(0.6, '#25407a'); g.addColorStop(1, '#6f93cf');
      x.fillStyle = g; x.fillRect(0, 0, S, S);
      x.scale(k, k);
      x.fillStyle = 'rgba(235,242,255,0.9)'; x.beginPath(); x.arc(390, 120, 46, 0, 7); x.fill();
      x.fillStyle = '#2a3f70'; x.beginPath(); x.moveTo(0, 380); x.lineTo(150, 230); x.lineTo(260, 330); x.lineTo(380, 210); x.lineTo(512, 330); x.lineTo(512, 512); x.lineTo(0, 512); x.fill();
      x.fillStyle = '#f4f9ff'; x.beginPath(); x.moveTo(0, 470); x.quadraticCurveTo(250, 330, 512, 420); x.lineTo(512, 512); x.lineTo(0, 512); x.fill();
      // Fahrer im Flip
      x.save(); x.translate(250, 250); x.rotate(-0.5);
      x.lineCap = 'round';
      x.fillStyle = '#ff7a1a'; x.beginPath(); x.roundRect(-110, 60, 220, 26, 13); x.fill();
      x.strokeStyle = '#22325a'; x.lineWidth = 30; x.beginPath(); x.moveTo(-50, 60); x.lineTo(-30, 0); x.lineTo(0, -20); x.moveTo(50, 60); x.lineTo(35, 0); x.lineTo(0, -20); x.stroke();
      x.strokeStyle = '#e8412f'; x.lineWidth = 46; x.beginPath(); x.moveTo(0, -20); x.lineTo(5, -95); x.stroke();
      x.lineWidth = 20; x.beginPath(); x.moveTo(5, -90); x.lineTo(-60, -60); x.lineTo(-95, 55); x.moveTo(5, -90); x.lineTo(70, -110); x.stroke();
      x.fillStyle = '#f2c9a0'; x.beginPath(); x.arc(10, -135, 27, 0, 7); x.fill();
      x.fillStyle = '#f5f7fb'; x.beginPath(); x.arc(10, -133, 29, Math.PI + 0.2, -0.2); x.fill();
      x.fillStyle = '#ffb02e'; x.fillRect(-14, -140, 48, 14);
      x.restore();
      return c.toDataURL('image/png');
    }, s);
    require('fs').writeFileSync(`dist/pwa/icon-${s}.png`, Buffer.from(data.split(',')[1], 'base64'));
  }
  await b.close();
})();
