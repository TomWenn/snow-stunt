/* Levels */
(function (root) {
  'use strict';
  const LK = root.LK || require('./levelkit.js');
  const { Level } = LK;
  const LEVELS = [];
  const def = (name, opts, fn) => { LEVELS.push({ name, make: () => { const b = new Level(name, opts); fn(b); return b.build(); } }); };

  // 1 ─ Erster Schnee: Grundlagen
  def('Erster Schnee', { cups: [3000, 5500, 8500] }, (b) => {
    const p = b.path(-14, 0).flat(18);
    b.spawn(-2, 0, 4);
    b.sign(2, 0, 'tilt', 'Neigen = drehen');
    p.down(28, 10).flat(10);
    b.starsAlong(p, 12, 30, 4, 1.3);
    b.sign(36, p.yAt(36), 'jump', 'Nach oben wischen = Springen');
    p.kick(8, 2.2, 22);
    b.trees(p, -12, 4, 4);
    b.island(p, 9);
    // Landehang
    const q = b.path(56, -10.5).h(36, -16, -18, -4).flat(14);
    b.starAuto(48, 56, 4);
    b.checkpoint(98, q.yAt(98), 10);
    // Ducken
    b.sign(101, q.yAt(101), 'duck', 'Nach unten wischen = Ducken');
    q.flat(30);
    b.rock(112, q.yAt(112) + 1.95, 11, 3.2);
    b.spikes(112, q.yAt(112) + 1.95, 11, 'down', 0.45);
    b.starsAlong(q, 114, 121, 3, 0.7);
    q.down(26, 9).flat(6);
    b.checkpoint(146, q.yAt(146), 9);
    b.sign(150, q.yAt(150), 'flip', 'In der Luft neigen = Flip');
    q.flat(6).kick(9, 3, 32);
    b.island(q, 12);
    b.trees(q, 60, 95, 5);
    // großer Flip-Sprung
    const r = b.path(194, -37).h(40, -18, -30, -6).flat(30);
    b.starAuto(185, 197, 5);
    b.sign(238, r.yAt(238), 'land', 'Gerade landen = Bonus!');
    b.island(r, 10);
    b.finish(258, r.yAt(258));
  });


  // Hilfsfunktion: Insel abschließen und Landehang dahinter beginnen
  const jumpTo = (b, p, gap, drop, len, fall, ang, depth) => {
    b.island(p, depth || 9);
    return b.path(p.x + gap, p.y - drop).h(len || 30, -(fall == null ? 12 : fall), -(ang == null ? 26 : ang), -4);
  };

  // 2 ─ Grab-Schule: Schanzen und Grabs
  def('Grab-Schule', { cups: [4500, 10000, 15500] }, (b) => {
    const p = b.path(-12, 0).flat(16);
    b.spawn(-2, 0, 5);
    b.sign(3, 0, 'grab', 'Grab');
    p.down(30, 12).flat(8);
    b.starsAlong(p, 14, 32, 3, 1.3);
    b.trees(p, -10, 2, 3);
    p.kick(8, 2, 25);
    const l1 = p.end;
    b.starAuto(l1[0] + 2, l1[0] + 12, 4);
    let q = jumpTo(b, p, 9, 4, 32, 14, 28);
    q.flat(10);
    b.checkpoint(q.x - 4, q.y, 12);
    b.sign(q.x - 1, q.y, 'flip', 'Flip');
    q.flat(4).kick(8, 2.5, 28);
    const l2 = q.end;
    b.starAuto(l2[0] + 3, l2[0] + 14, 5);
    let r = jumpTo(b, q, 11, 5, 34, 16, 30);
    r.flat(6);
    b.trees(r, r.x - 30, r.x - 6, 3);
    r.kick(7, 1.5, 18);
    const l3 = r.end;
    b.starAuto(l3[0] + 2, l3[0] + 9, 3);
    let s2 = jumpTo(b, r, 8, 3, 26, 10, 24);
    s2.flat(8);
    b.checkpoint(s2.x - 4, s2.y, 12);
    s2.down(20, 6).flat(4).kick(10, 3.5, 34);
    const l4 = s2.end;
    b.sign(l4[0] - 14, s2.yAt(l4[0] - 14), 'land', 'Landen');
    b.starAuto(l4[0] + 3, l4[0] + 18, 6);
    let t = jumpTo(b, s2, 14, 6, 40, 18, 32, 12);
    t.flat(24);
    b.island(t, 10);
    b.finish(t.x - 8, t.y);
  });

  // 3 ─ Sägewerk: Sägen, Rails, Eiszapfen
  def('Sägewerk', { cups: [2500, 5000, 8000], theme: 1 }, (b) => {
    const p = b.path(-12, 0).flat(14);
    b.spawn(-2, 0, 6);
    p.down(24, 9).flat(10);
    b.sign(p.x - 9, p.y, 'jump', 'Springen');
    b.saw(p.x - 2, p.y - 0.15, 0.95);
    b.star(p.x - 2, p.y + 3.2);
    p.flat(14);
    b.sign(p.x - 12, p.y, 'duck', 'Ducken');
    b.saw(p.x - 4, p.y + 2.75, 1.0);
    b.star(p.x - 4, p.y + 0.8);
    p.flat(6).down(18, 6).flat(6);
    b.checkpoint(p.x - 3, p.y, 11);
    // Rail-Brücke über eine Schlucht
    b.sign(p.x - 1, p.y, 'arrow', 'Rail!');
    b.island(p, 9);
    const rx = p.x, ry = p.y;
    b.rail(rx - 0.5, ry + 0.02, rx + 16, ry - 2.5);
    b.starsAlong({ yAt: (x) => ry + ((x - rx) / 16) * -2.5 }, rx + 2, rx + 14, 4, 1.2);
    const q = b.path(rx + 16, ry - 2.6).flat(4).down(20, 7).flat(8);
    b.trees(q, q.x - 26, q.x - 10, 3);
    // bewegte Säge
        q.flat(18);
    b.saw(q.x - 9, q.y + 4.0, 0.9, { my: 1.5, period: 1.6 });
    b.sign(q.x - 16, q.y, 'duck', 'Ducken');
    b.checkpoint(q.x - 2, q.y, 11);
    q.flat(4).kick(7, 2, 24);
    const l = q.end;
    b.starAuto(l[0] + 2, l[0] + 10, 4);
    const r = jumpTo(b, q, 9, 3, 26, 10, 24);
    r.flat(8);
    // erhöhte Rail – hochspringen
    b.sign(r.x - 6, r.y, 'jump', 'Springen');
    b.rail(r.x - 1, r.y + 1.3, r.x + 14, r.y + 1.1);
    b.spikes(r.x + 1, r.y, 12, 'up', 0.8);
    r.flat(16).down(14, 4).flat(6);
    b.checkpoint(r.x - 3, r.y, 11);
    // Eiszapfen-Tunnel mit Säge am Boden
    r.flat(36);
    b.rock(r.x - 32, r.y + 1.95, 26, 3);
    b.spikes(r.x - 32, r.y + 1.95, 26, 'down', 0.45);
    b.sign(r.x - 38, r.y, 'duck', 'Ducken');
    b.starsAlong(r, r.x - 30, r.x - 8, 5, 0.7);
    r.flat(18);
    b.island(r, 10);
    b.finish(r.x - 8, r.y);
  });

  // 4 ─ Turbo: Boosts und riesige Sprünge
  def('Turbo', { cups: [5000, 10000, 16000] }, (b) => {
    const p = b.path(-12, 0).flat(20);
    b.spawn(-2, 0, 5);
    b.boost(4, 0, 10, 2.5, 0, 24);
    b.sign(2, 0, 'arrow', 'Boost!');
    p.down(14, 4).flat(12).kick(9, 3, 30);
    const l1 = p.end;
    b.starAuto(l1[0] + 4, l1[0] + 24, 7);
    let q = jumpTo(b, p, 19, 8, 40, 18, 30, 12);
    q.flat(10);
    b.checkpoint(q.x - 6, q.y, 14);
    // lange Rail bergab
    b.island(q, 9);
    b.rail(q.x - 0.5, q.y + 0.02, q.x + 30, q.y - 10);
    b.starAuto(q.x + 4, q.x + 26, 5);
    let r = b.path(q.x + 30, q.y - 10.1).h(20, -6, -18, 0).flat(8);
    b.boost(r.x - 10, r.y, 10, 2.5, 0, 28);
    r.flat(6).kick(9, 3.5, 34);
    const l2 = r.end;
    b.starAuto(l2[0] + 4, l2[0] + 28, 7);
    let s2 = jumpTo(b, r, 22, 7, 40, 18, 30, 12);
    s2.flat(10);
    b.checkpoint(s2.x - 6, s2.y, 14);
    b.trees(s2, s2.x - 30, s2.x - 8, 3);
    s2.flat(12);
    b.saw(s2.x - 3, s2.y - 0.15, 0.95);
    b.sign(s2.x - 11, s2.y, 'jump', 'Springen');
    s2.down(30, 12).flat(8);
    b.boost(s2.x - 6, s2.y, 8, 2.5, 0, 30);
    s2.kick(8, 3, 32);
    const l3 = s2.end;
    b.starAuto(l3[0] + 4, l3[0] + 30, 6);
    let t = jumpTo(b, s2, 26, 9, 44, 20, 34, 12);
    t.flat(24);
    b.island(t, 10);
    b.finish(t.x - 8, t.y);
  });

  // 5 ─ Rückenwind: Ventilatoren und schwebende Berge
  def('Rückenwind', { cups: [3500, 9000, 14000], theme: 2 }, (b) => {
    const p = b.path(-12, 0).flat(16);
    b.spawn(-2, 0, 6);
    p.down(22, 8).flat(8);
    b.sign(p.x - 4, p.y, 'arrowUp', 'Ventilator');
    b.island(p, 9);
    // Fan 1 in der Schlucht hebt auf höhere Insel
    const fx = p.x + 2;
    b.fan(fx, p.y - 14, 7, 26, 46);
    b.starAuto(fx + 1, fx + 9, 3);
    let q = b.path(fx + 12, p.y + 5).flat(6).down(24, 7).flat(8);
    b.checkpoint(q.x - 4, q.y, 11);
    b.island(q, 8);
    // Fan 2: zweiter Lift, Sterne in der Höhe
    const f2 = q.x + 2;
    b.fan(f2, q.y - 14, 8, 28, 48);
    b.starAuto(f2 + 1, f2 + 10, 3);
    let r = b.path(f2 + 13, q.y + 7).flat(4).down(26, 10).flat(6);
    b.trees(r, r.x - 34, r.x - 6, 3);
    r.kick(7, 2, 24);
    const l = r.end;
    b.starAuto(l[0] + 2, l[0] + 12, 4);
    let s2 = jumpTo(b, r, 10, 4, 28, 12, 26);
    s2.flat(8);
    b.checkpoint(s2.x - 4, s2.y, 11);
    // Fan über Stachelgrube
    b.island(s2, 9);
    const f3 = s2.x + 1;
    b.fan(f3, s2.y - 8, 14, 20, 30);
    b.spikes(f3, s2.y - 8, 14, 'up', 0.9);
    b.rock(f3, s2.y - 9.5, 14, 1.5);
    b.starAuto(f3 + 2, f3 + 13, 4);
    let t = b.path(f3 + 16, s2.y - 1).flat(4).down(24, 8).flat(22);
    b.island(t, 10);
    b.finish(t.x - 8, t.y);
  });

  // 6 ─ Kopfüber: Schwerkraft-Umkehr
  def('Kopfüber', { cups: [2500, 5000, 8000], theme: 3 }, (b) => {
    const p = b.path(-12, 0).flat(16);
    b.spawn(-2, 0, 6);
    p.down(20, 7).flat(6);
    b.sign(p.x - 4, p.y, 'warn', 'Schwerkraft!');
    const gy = p.y;
    // Zone 1: Boden -> Decke
    const zx = p.x + 4;
    p.flat(10);
    b.island(p, 9);
    b.invert(zx, gy - 2, 34, 19);
    const c = b.path(zx - 4, gy + 9).flat(6).h(26, 6, 0, 0).flat(8);
    b.ceiling(c, 6);
    b.starsAlong({ yAt: (x) => c.yAt(x) - 1.6 }, zx + 19, zx + 31, 4, 0);
    b.sign(zx + 8, c.yAt(zx + 8), 'land', 'Drehen & landen', true);
    // nach der Zone: zurück auf den Boden
    let q = b.path(zx + 30, gy - 4).h(30, -10, -24, -2).flat(10);
    b.checkpoint(q.x - 5, q.y, 12);
    q.flat(4);
    b.island(q, 9);
    // Zone 2: lange Deckenfahrt mit Sägen
    const z2 = q.x + 2;
    b.invert(z2 - 4, q.y - 3, 52, 24);
    const c2 = b.path(z2 - 6, q.y + 10).flat(8).h(36, 9, 0, 0).flat(10);
    b.ceiling(c2, 6);
    b.saw(z2 + 20, c2.yAt(z2 + 20) - 0.3, 0.95);
    b.sign(z2 + 12, c2.yAt(z2 + 12), 'jump', 'Springen', true);
    b.starsAlong({ yAt: (x) => c2.yAt(x) - 2.6 }, z2 + 24, z2 + 42, 4, 0);
    let r = b.path(z2 + 52, q.y - 6).h(30, -10, -26, -2).flat(8);
    b.checkpoint(r.x - 4, r.y, 12);
    r.kick(8, 2.5, 28);
    const l = r.end;
    b.starAuto(l[0] + 2, l[0] + 12, 4);
    let s2 = jumpTo(b, r, 10, 4, 30, 12, 26);
    s2.flat(22);
    b.island(s2, 10);
    b.finish(s2.x - 8, s2.y);
  });

  // 7 ─ Schwerelos: Zero-G-Zonen
  def('Schwerelos', { cups: [5000, 10000, 16000], theme: 2 }, (b) => {
    const T = (d) => Math.tan((d * Math.PI) / 180);
    const p = b.path(-12, 0).flat(16);
    b.spawn(-2, 0, 6);
    p.down(26, 10).flat(6);
    b.sign(p.x - 3, p.y, 'flip', 'Flip');
    p.kick(8, 1.4, 15);
    const l1 = p.end;
    b.island(p, 10);
    // Zero-G über einer Schlucht – frei drehen!
    b.zerog(l1[0] + 2, l1[1] - 6, 28, 26);
    b.starAuto(l1[0] + 5, l1[0] + 27, 7);
    let q = b.path(l1[0] + 33, l1[1] + T(15) * 30 - 3).h(32, -14, -28, -4).flat(8);
    b.checkpoint(q.x - 4, q.y, 12);
    b.trees(q, q.x - 30, q.x - 12, 2);
    q.flat(4).kick(8, 1.4, 15);
    const l2 = q.end;
    b.island(q, 9);
    // Zero-G mit Sägen
    b.zerog(l2[0] + 2, l2[1] - 6, 34, 26);
    b.saw(l2[0] + 14, l2[1] + T(15) * 14 - 3.4, 1.0, { spin: 5 });
    b.saw(l2[0] + 25, l2[1] + T(25) * 25 + 3.6, 1.0, { spin: -5 });
    b.starAuto(l2[0] + 5, l2[0] + 31, 7);
    let r = b.path(l2[0] + 39, l2[1] + T(15) * 36 - 3).h(30, -12, -28, -4).flat(8);
    b.checkpoint(r.x - 4, r.y, 12);
    r.flat(4).kick(9, 2.8, 30);
    const l3 = r.end;
    b.island(r, 10);
    // Zero-G steil nach oben
    b.zerog(l3[0] + 2, l3[1] - 5, 22, 30);
    b.starAuto(l3[0] + 4, l3[0] + 21, 6);
    let s2 = b.path(l3[0] + 27, l3[1] + T(30) * 24 - 3).h(36, -16, -30, -4).flat(22);
    b.island(s2, 10);
    b.finish(s2.x - 8, s2.y);
  });

  // 8 ─ Looping: alles zusammen
  def('Looping', { cups: [3000, 6000, 10000], theme: 1 }, (b) => {
    const p = b.path(-12, 0).flat(16);
    b.spawn(-2, 0, 6);
    p.down(24, 10).flat(10);
    b.boost(p.x - 12, p.y, 12, 3, 0, 26);
    b.sign(p.x - 14, p.y, 'arrow', 'Looping!');
    const gx = p.x + 6;
    b.loop(gx, p.y, 5);
    b.star(gx, p.y + 9.0);
    b.star(gx - 3.6, p.y + 5.0);
    b.star(gx + 3.6, p.y + 5.0);
    p.flat(26);
    b.checkpoint(p.x - 6, p.y, 14);
    p.down(20, 6).flat(4);
    // Rail mit Sägen darüber
    b.island(p, 9);
    b.rail(p.x - 0.5, p.y + 0.02, p.x + 24, p.y - 7);
    b.saw(p.x + 12, p.y - 0.3 + 2.4, 0.8, { my: 1.5, period: 2.2 });
    b.starsAlong({ yAt: (x) => p.y - ((x - p.x) / 24) * 7 }, p.x + 3, p.x + 21, 4, 1.2);
    let q = b.path(p.x + 24, p.y - 7.1).h(18, -5, -16, 0).flat(8);
    b.checkpoint(q.x - 4, q.y, 12);
    q.flat(4);
    b.island(q, 9);
    // Schwerkraft-Umkehr mit Stacheln
    const z = q.x + 2;
    b.invert(z - 4, q.y - 3, 40, 20);
    const c = b.path(z - 6, q.y + 9).flat(8).h(26, 6, 0, 0).flat(8);
    b.ceiling(c, 6);
    b.spikes(z + 15, c.yAt(z + 15), 2.5, 'down', 0.7);
    b.sign(z + 8, c.yAt(z + 8), 'jump', 'Springen', true);
    b.starsAlong({ yAt: (x) => c.yAt(x) - 2.4 }, z + 22, z + 32, 3, 0);
    let r = b.path(z + 40, q.y - 6).h(30, -10, -26, -2).flat(8);
    b.checkpoint(r.x - 4, r.y, 12);
    b.boost(r.x - 8, r.y, 8, 3, 0, 28);
    r.flat(4).kick(9, 3.5, 34);
    const l = r.end;
    b.zerog(l[0] + 6, l[1] - 2, 18, 18);
    b.starAuto(l[0] + 3, l[0] + 24, 6);
    let s2 = jumpTo(b, r, 30, -6, 40, 18, 28, 12);
    s2.flat(22);
    b.island(s2, 10);
    b.finish(s2.x - 8, s2.y);
  });

  root.LEVELS = LEVELS;
  if (typeof module !== 'undefined' && module.exports) module.exports = LEVELS;
})(typeof globalThis !== 'undefined' ? globalThis : this);
