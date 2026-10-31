/* Levels */
(function (root) {
  'use strict';
  const LK = root.LK || require('./levelkit.js');
  const { Level } = LK;
  const LEVELS = [];
  const def = (name, opts, fn) => { LEVELS.push({ name, make: () => { const b = new Level(name, opts); fn(b); return b.build(); } }); };

  // ═══ 1 ─ Gletscherspalte ═══
  def('Gletscherspalte', { cups: [4500, 11500, 17500], theme: 0 }, (b) => {
    // Start-Plateau und steile Abfahrt
    const A = b.path(-18, 0).flat(18);
    b.spawn(-6, 0, 5);
    b.sign(-1, 0, 'tilt', 'Neigen');
    A.h(40, -20, 0, -8).flat(6);
    b.crystals(A, -16, -4, 3);
    b.starsAlong(A, 14, 28, 2, 1.6);
    b.sign(A.x - 3, A.y, 'jump', 'Springen');
    A.kick(10, 3.5, 28);
    const l1 = A.end;
    b.island(A, 12);
    // großer Sprung über die Spalte
    b.starAuto(l1[0] + 4, l1[0] + 14, 2);
    const B = b.path(l1[0] + 11, l1[1] - 10).h(44, -24, -34, -4).flat(14);
    b.checkpoint(B.x - 8, B.y, 16);
    // Eisbrücke mit fallenden Eiszapfen
    B.flat(8);
    b.rock(B.x - 6, B.y + 5.2, 9, 2.5);
    b.icicles(B.x - 5, B.x + 1.5, B.y + 5.2, 4, 2.2, 6);
    b.sign(B.x - 14, B.y, 'warn', 'Eiszapfen!');
    B.flat(10);
    b.sign(B.x - 6, B.y, 'duck', 'Ducken');
    B.flat(22);
    b.rock(B.x - 18, B.y + 2.3, 16, 3.2);
    b.spikes(B.x - 18, B.y + 2.3, 16, 'down', 0.35);
    b.starsAlong(B, B.x - 10, B.x - 10, 1, 0.8);
    B.flat(6).down(30, 13).flat(4);
    B.kick(9, 2.6, 26);
    const l2 = B.end;
    b.island(B, 12);
    // Sägen über der Schlucht: große unten, kleine oben
    b.saw(l2[0] + 8, l2[1] - 7, 2.4);
    b.saw(l2[0] + 13, l2[1] + 13, 1.0, { my: 1.5, period: 1.8 });
    b.starAuto(l2[0] + 9, l2[0] + 9, 1);
    const C = b.path(l2[0] + 14, l2[1] - 7).h(32, -13, -30, -3).flat(10);
    b.checkpoint(C.x - 5, C.y, 15);
    b.island(C, 9);
    // Rail mit Looping über der Spalte
    const R1 = b.path(C.x - 1.5, C.y + 0.1).flat(2.5).h(26, -11, 0, -26).turn(360, 4.5).l(13, -6);
    b.rail(R1);
    b.sign(C.x - 9, C.y, 'arrow', 'Rail!');
    b.star(C.x + 21, C.y - 7.0);
    // Landung auf D
    const D = b.path(R1.x + 5, R1.y - 5).h(28, -11, -28, 0).flat(14);
    b.checkpoint(D.x - 9, D.y, 15);
    const dEdge = D.end;
    b.island(D, 4);
    // ── Zickzack: unter D zurück nach links ──
    const ey = dEdge[1] - 12;
    const ex0 = dEdge[0] - 130;
    const E = b.path(ex0, ey - 29).h(50, 26, 26, 1.5).l(128, 3).h(9, 9, 0, 90).l(0, 22);
    b.island(E, 5);
    b.rock(E.x, ey + 1, 3.5, 30);
    b.sign(dEdge[0] + 30, ey, 'arrowL', 'Wende!');
    b.checkpoint(dEdge[0] - 60, ey, 15, -1);
    b.star(dEdge[0] + 55, ey + 12);
    b.crystals({ yAt: () => ey }, dEdge[0] - 60, dEdge[0] - 20, 4);
    // ── zweite Wende: unter E zurück nach rechts ──
    const fy = ey - 29 - 13;
    const fx0 = ex0 - 46;
    const F = b.path(fx0, fy + 30).l(0, -21).h(9, -9, -90, -1).l(200, -9);
    b.rock(fx0 - 3.5, fy - 1, 3.5, 32);
    b.checkpoint(fx0 + 70, fy - 70 * 0.045 - 0.4, 15);
    b.star(fx0 + 4, fy + 9);
    b.saw(F.x - 14, F.yAt(F.x - 14) - 0.3, 0.95);
    b.sign(F.x - 24, F.yAt(F.x - 24), 'jump', 'Springen');
    F.down(36, 16).flat(10).kick(11, 4.5, 34);
    const l3 = F.end;
    b.island(F, 10);
    // Mega-Sprung zum Ziel
    b.starAuto(l3[0] + 14, l3[0] + 14, 1);
    const G = b.path(l3[0] + 20, l3[1] - 16).h(46, -24, -36, -4).flat(30);
    b.sign(G.x - 26, G.y, 'land', 'Landen');
    b.island(G, 10);
    b.finish(G.x - 10, G.y);
  });


  // ═══ 2 ─ Eisberg-Express ═══
  def('Eisberg-Express', { cups: [6000, 14500, 22000], theme: 1 }, (b) => {
    const A = b.path(-18, 0).flat(18);
    b.spawn(-6, 0, 6);
    A.down(30, 14).flat(18);
    b.boost(A.x - 16, A.y, 14, 3, 0, 30);
    b.sign(A.x - 19, A.y, 'arrow', 'Boost!');
    A.kick(10, 3, 22);
    const l1 = A.end;
    b.island(A, 11);
    // weiter Sprung übers Meer
    b.starAuto(l1[0] + 8, l1[0] + 18, 1);
    const B = b.path(l1[0] + 22, l1[1] - 9).h(40, -18, -26, -2).flat(14);
    b.checkpoint(B.x - 8, B.y, 18);
    b.island(B, 9);
    // Wellen-Rail mit Säge auf der Kuppe (drüberspringen!)
    const R = b.path(B.x - 1.5, B.y + 0.1).flat(2.5).h(16, -7, 0, -24).h(14, 3, -24, 0).h(14, -6, 0, -28).h(16, 2, -28, 0).h(14, -8, 0, -26);
    b.rail(R);
    const crest = [B.x + 1 + 16 + 14, B.y + 0.1 - 7 + 3];
    b.saw(crest[0] + 1, crest[1] + 1.0, 0.75, { spin: -10 });
    b.sign(B.x - 6, B.y, 'jump', 'Auf der Rail springen');
    b.star(crest[0] + 1, crest[1] + 4.5);
    b.pickup(R.x - 8, R.yAt(R.x - 8) + 1.4);
    // Landung, dann Ventilator-Aufzug
    const C = b.path(R.x + 6, R.y - 6).h(30, -10, -26, 0).flat(12);
    b.checkpoint(C.x - 6, C.y, 16);
    b.sign(C.x - 1, C.y, 'arrowUp', 'Ventilator');
    C.h(10, 3, 0, 20);
    b.island(C, 7);
    const fx = C.x + 1;
    b.fan(fx, C.y - 18, 15, 28, 30);
    b.starAuto(fx + 3, fx + 13, 2);
    const D = b.path(fx + 16, C.y + 7).flat(40).down(16, 4).flat(12);
    b.island(D, 6);
    // Haarnadel-Rail: nach unten herum, kopfüber zurück nach links
    const H = b.path(D.x - 1.5, D.y + 0.1).flat(4).turn(-180, 5.5).l(-16, 0);
    b.rail(H);
    b.sign(D.x - 8, D.y, 'flip', 'Kopfüber!');
    b.star(D.x + 2.5 + 5.5 + 1.6, D.y - 5.5);
    // E: unter D, nach links abfallend, links eine Schanze
    const ey = D.y - 19;
    const E = b.path(D.x - 70, ey - 10).h(7, -2.5, -26, 0).h(50, 12.5, 0, 12).flat(12);
    b.island(E, 6);
    b.checkpoint(D.x - 30, E.yAt(D.x - 30), 14, -1);
    b.starsAlong(E, D.x - 50, D.x - 50, 1, 1.5);
    // F: unten links, dahinter Gegenwind-Ventilator (Wende nach rechts)
    const F = b.path(D.x - 112, ey - 22).h(36, 8, 8, 0);
    b.island(F, 6);
    b.fan(D.x - 140, ey - 46, 26, 40, 34, 0);
    b.starAuto(D.x - 120, D.x - 110, 1);
    // G: tiefer, nach rechts
    const G = b.path(D.x - 142, ey - 48).h(30, -6, -10, 0).flat(36).kick(10, 3, 26);
    b.checkpoint(G.x - 30, ey - 54, 16);
    b.boost(G.x - 26, ey - 54, 14, 3, 0, 27);
    b.island(G, 8);
    const l2 = G.end;
    // Schwerelos-Feld mit kreisenden Sägen
    b.zerog(l2[0] + 3, l2[1] - 8, 34, 28);
    b.saw(l2[0] + 16, l2[1] + 6, 1.1, { orbit: 5, period: 3.4 });
    b.saw(l2[0] + 28, l2[1] + 10, 0.9, { orbit: 4, period: 2.6, phase: 2 });
    b.starAuto(l2[0] + 10, l2[0] + 30, 2);
    b.pickup(l2[0] + 20, l2[1] + 8.5);
    const I = b.path(l2[0] + 40, l2[1] + 4).h(34, -14, -26, -2).flat(8);
    b.checkpoint(I.x - 4, I.y, 16);
    b.island(I, 8);
    // Finale Rail bergab zum Ziel
    const R2 = b.path(I.x - 1.5, I.y + 0.1).flat(2.5).h(36, -16, 0, -22).h(10, -2, -22, 0);
    b.rail(R2);
    b.star(I.x + 18, I.yAt(I.x) - 7 + 1.8);
    const Z = b.path(R2.x + 4, R2.y - 3).h(20, -5, -20, 0).flat(26);
    b.island(Z, 8);
    b.finish(Z.x - 10, Z.y);
  });

  // ═══ 3 ─ Kopfstand ═══
  def('Kopfstand', { cups: [4000, 11000, 17000], theme: 3 }, (b) => {
    const A = b.path(-18, 0).flat(18);
    b.spawn(-6, 0, 6);
    A.down(30, 13).flat(10);
    b.sign(A.x - 8, A.y, 'warn', 'Schwerkraft-Schalter!');
    A.kick(9, 3, 30);
    const l1 = A.end;
    b.island(A, 10);
    // Schalter in der Luft -> Schwerkraft nach oben
    b.gate(l1[0] + 10, l1[1] + 1, l1[1] + 9, 'up');
    b.starAuto(l1[0] + 5, l1[0] + 5, 1);
    // Decke: (für umgekehrte Schwerkraft "bergab" = nach oben)
    const C1 = b.path(l1[0] - 2, l1[1] + 22).flat(8).h(40, 8, 0, 10).flat(12);
    b.roof(C1, l1[1] + 46);
    b.sign(l1[0] + 22, C1.yAt(l1[0] + 22), 'land', 'Drehen & landen', true);
    b.checkpoint(l1[0] + 30, C1.yAt(l1[0] + 30), 15);
    b.saw(l1[0] + 44, C1.yAt(l1[0] + 44) + 0.25, 0.95);
    b.sign(l1[0] + 36, C1.yAt(l1[0] + 36), 'jump', 'Springen', true);
    b.starsAlong(C1, l1[0] + 44, l1[0] + 44, 1, -3.4);
    C1.flat(16);
    b.spikes(C1.x - 10, C1.y, 3, 'down', 0.7);
    b.star(C1.x - 8.5, C1.y - 3.6);
    C1.h(22, 7, 0, 16);
    b.roof(C1, l1[1] + 46);
    // Schalter unter der Decke -> runter
    const c1e = C1.end;
    b.gswitch(c1e[0] + 4, c1e[1] - 1.3, 'down');
    // langer Boden darunter
    const B = b.path(c1e[0] - 6, c1e[1] - 22).h(30, -8, -20, 0).flat(70);
    b.checkpoint(B.x - 60, B.y, 15);
    b.saw(B.x - 34, B.y + 3.1, 1.0, { my: 1.1, period: 1.5 });
    b.sign(B.x - 44, B.y, 'duck', 'Ducken');
    b.starsAlong(B, B.x - 34, B.x - 34, 1, 0.9);
    B.flat(14);
    b.boost(B.x - 12, B.y, 12, 3, 0, 24);
    b.island(B, 5);
    // Haarnadel-Rail nach oben, oben Schalter -> Schwerkraft hoch, kopfüber weiter nach links
    const H = b.path(B.x - 1.5, B.y + 0.1).flat(4).turn(180, 4.5).l(-18, 0);
    b.rail(H);
    b.gswitch(B.x + 2.5 + 4.5, B.y + 9.1 - 1.5, 'up');
    b.star(B.x + 2.5 + 4.5 + 2.2, B.y + 4.5);
    // Decke nach links (bergab = nach oben)
    const hy = B.y + 9.1;
    const C2 = b.path(B.x - 76, hy + 22).h(50, -14, -12, 0).flat(14);
    b.ceiling(C2, 5);
    b.checkpoint(B.x - 40, C2.yAt(B.x - 40), 14, -1);
    b.saw(B.x - 52, C2.yAt(B.x - 52) - 4.5, 1.2, { orbit: 3, period: 2.4 });
    b.starsAlong(C2, B.x - 64, B.x - 64, 1, -1.6);
    b.gswitch(B.x - 72, C2.yAt(B.x - 72) - 1.3, 'down');
    // tiefer Boden: Landung nach links, Wende-Wand, zurück nach rechts unter B durch
    const fy = B.y - 16;
    const fxw = B.x - 120;
    const F = b.path(fxw, fy + 26).l(0, -17).h(9, -9, -90, 0).flat(40).l(140, -4);
    b.rock(fxw - 3.5, fy - 1, 3.5, 30);
    b.island(F, 5);
    b.star(fxw + 4, fy + 10);
    b.checkpoint(B.x - 20, F.yAt(B.x - 20), 16);
    // ── Schwerkraft-Korridor ──
    const kx = F.x, ky = F.y;
    const KL = 120;
    const floor = b.path(kx, ky).flat(KL);
    b.island(floor, 5);
    const roofP = b.path(kx + 2, ky + 9).flat(KL - 2);
    b.ceiling(roofP, 4);
    b.zone('boost', kx, ky, KL, 9, { dir: [1, 0], str: 20, speed: 19, ang: 0, hidden: true });
    b.sign(kx - 6, F.yAt(kx - 6), 'warn', 'Korridor!');
    b.gswitch(kx + 18, ky + 1.3, 'up');
    b.spikes(kx + 24, ky, 22, 'up', 0.8);
    b.gswitch(kx + 46, ky + 9 - 1.3, 'down');
    b.spikes(kx + 50, ky + 9, 20, 'down', 0.8);
    b.star(kx + 34, ky + 9 - 2.4);
    b.star(kx + 60, ky + 2.4);
    b.gswitch(kx + 74, ky + 1.3, 'up');
    b.spikes(kx + 80, ky, 20, 'up', 0.8);
    b.gswitch(kx + 102, ky + 9 - 1.3, 'down');
    b.spikes(kx + 106, ky + 9, 12, 'down', 0.8);
    // Ausgang: großer Sprung zum Ziel
    const X = b.path(kx + KL, ky).down(26, 10).flat(6).kick(10, 4, 32);
    b.island(X, 9);
    const l3 = X.end;
    b.starAuto(l3[0] + 10, l3[0] + 10, 1);
    const Z = b.path(l3[0] + 18, l3[1] - 12).h(40, -18, -32, -3).flat(26);
    b.island(Z, 9);
    b.finish(Z.x - 10, Z.y);
  });

  // ═══ 4 ─ Lawinen-Wahnsinn ═══
  def('Lawinen-Wahnsinn', { cups: [5500, 12000, 19000], theme: 2 }, (b) => {
    const A = b.path(-18, 0).flat(18);
    b.spawn(-6, 0, 6);
    // riesige Steilabfahrt
    A.h(60, -34, -4, -6).flat(8);
    b.starsAlong(A, 22, 22, 1, 1.8);
    A.kick(11, 4, 30);
    const l1 = A.end;
    b.island(A, 14);
    b.starAuto(l1[0] + 14, l1[0] + 14, 1);
    const B = b.path(l1[0] + 22, l1[1] - 14).h(48, -24, -36, -2).flat(22);
    b.checkpoint(B.x - 16, B.y, 18);
    // Looping
    b.sign(B.x - 8, B.y, 'arrow', 'Looping!');
    b.boost(B.x - 12, B.y, 12, 3, 0, 27);
    const gx = B.x + 7;
    B.flat(34);
    b.loop(gx, B.y, 5.5);
    b.star(gx, B.y + 10.0);
    // Eistunnel mit fallenden Eiszapfen und Stacheln
    B.flat(6);
    const tx = B.x;
    B.flat(52);
    b.rock(tx, B.y + 5.2, 50, 3);
    b.icicles(tx + 4, tx + 46, B.y + 5.2, 8, 2.2, 7);
    b.spikes(tx + 20, B.y, 3.5, 'up', 0.7);
    b.sign(tx - 4, B.y, 'warn', 'Schnell durch!');
    b.starsAlong(B, tx + 21.75, tx + 21.75, 1, 3.6);
    b.checkpoint(B.x + 4, B.y, 16);
    B.flat(10);
    b.island(B, 10);
    // Rail-Abfahrt mit Looping, dann zweite Rail mit Säge
    const R1 = b.path(B.x - 1.5, B.y + 0.1).flat(2.5).h(22, -10, 0, -28).turn(360, 4.8).l(10, -4);
    b.rail(R1);
    b.star(B.x + 13, B.yAt(B.x) - 5.5 + 1.8);
    const R2 = b.path(R1.x + 5, R1.y - 4).h(26, -7, -18, -10).h(14, 2, -10, 10).h(16, 4, 10, 22);
    b.rail(R2);
    b.saw(R1.x + 5 + 19, R2.yAt(R1.x + 5 + 19) + 0.95, 0.55, { spin: -12 });
    b.pickup(R1.x + 5 + 36, R2.yAt(R1.x + 5 + 36) + 1.4);
    // Schwerelos-Feld nach der Rail, am Ende Schalter nach oben
    const z0 = R2.end;
    b.zerog(z0[0] + 2, z0[1] - 6, 30, 22);
    b.starAuto(z0[0] + 10, z0[0] + 24, 2);
    b.saw(z0[0] + 18, z0[1] + 10, 1.4, { orbit: 4.5, period: 3.2 });
    b.gate(z0[0] + 34, z0[1] + 2, z0[1] + 14, 'up');
    // Decke nach rechts (umgekehrte Schwerkraft)
    const C = b.path(z0[0] + 30, z0[1] + 22).flat(10).h(40, 9, 0, 12).flat(30);
    b.roof(C, z0[1] + 50);
    b.checkpoint(z0[0] + 46, C.yAt(z0[0] + 46), 16);
    b.saw(z0[0] + 64, C.yAt(z0[0] + 64) + 0.3, 0.95);
    b.sign(z0[0] + 56, C.yAt(z0[0] + 56), 'jump', 'Springen', true);
    b.spikes(C.x - 8, C.y, 2.5, 'down', 0.7);
    b.star(C.x - 6.75, C.y - 3.4);
    const ce = C.end;
    b.gswitch(ce[0] + 3, ce[1] - 1.3, 'down');
    // Lawinen-Zickzack nach unten
    const D = b.path(ce[0] - 4, ce[1] - 28).h(30, -10, -24, 0).flat(16);
    b.checkpoint(D.x - 8, D.y, 16);
    const dE = D.end;
    b.island(D, 4);
    const ey = dE[1] - 12, ex0 = dE[0] - 110;
    const E = b.path(ex0, ey - 22).h(44, 20, 24, 1.5).l(116, 2).h(9, 9, 0, 90).l(0, 22);
    b.island(E, 5);
    b.rock(E.x, ey + 1, 3.5, 30);
    b.saw(dE[0] - 40, E.yAt(dE[0] - 40) + 3.9, 1.0, { my: 1.0, period: 1.3 });
    b.sign(dE[0] - 30, E.yAt(dE[0] - 30), 'duck', 'Ducken');
    b.star(dE[0] + 54, ey + 11);
    const fy = ey - 22 - 13, fx0 = ex0 - 46;
    const F = b.path(fx0, fy + 30).l(0, -21).h(9, -9, -90, -1).l(150, -7);
    b.rock(fx0 - 3.5, fy - 1, 3.5, 32);
    b.checkpoint(fx0 + 60, F.yAt(fx0 + 60), 16);
    b.icicles(fx0 + 90, fx0 + 110, F.yAt(fx0 + 100) + 6.5, 4, 2.4, 6);
    b.rock(fx0 + 86, F.yAt(fx0 + 100) + 6.5, 28, 2.5);
    F.down(30, 14).flat(12);
    b.boost(F.x - 12, F.y, 12, 3, 0, 30);
    F.kick(12, 5, 36);
    const l3 = F.end;
    b.island(F, 10);
    // Mega-Sprung über die Lawine
    b.starAuto(l3[0] + 18, l3[0] + 18, 1);
    const Z = b.path(l3[0] + 26, l3[1] - 18).h(52, -26, -38, -3).flat(30);
    b.sign(Z.x - 26, Z.y, 'land', 'Landen');
    b.island(Z, 10);
    b.finish(Z.x - 10, Z.y);
  });
  root.LEVELS = LEVELS;
  if (typeof module !== 'undefined' && module.exports) module.exports = LEVELS;
})(typeof globalThis !== 'undefined' ? globalThis : this);
