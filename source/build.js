const fs = require('fs');
const rd = (p) => fs.readFileSync(p, 'utf8');
const mode = process.argv[2] || 'single';
let html = rd('src/index.template.html');
const planck = rd('node_modules/planck/dist/planck.min.js').replace(/\/\/# sourceMappingURL=.*$/m, '');
const game = [rd('src/stargen.js'), rd('src/levelkit.js'), rd('src/levels.js'), rd('src/sim.js'), rd('src/game.js')].join('\n;\n');
const head = mode === 'pwa'
  ? '<link rel="manifest" href="manifest.json">\n<link rel="apple-touch-icon" href="icon-180.png">\n<link rel="icon" href="icon-192.png">'
  : '';
html = html.replace('<!--HEADEXTRA-->', head);
html = html.split('/*PLANCK*/').join(planck.replace(/<\/script/gi, '<\\/script'));
html = html.split('/*GAME*/').join(game.replace(/<\/script/gi, '<\\/script') + (mode === 'pwa' ? "\n;if('serviceWorker' in navigator){navigator.serviceWorker.register('sw.js').catch(()=>{});}" : ''));
const out = mode === 'pwa' ? 'dist/pwa' : 'dist';
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(out + '/index.html', html);
console.log('wrote', out + '/index.html', (html.length / 1024).toFixed(0) + ' KB');
