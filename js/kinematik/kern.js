/* PlotBot-Kinematiksimulator – Kern: Kinematik, Feldanalyse, Testfiguren, Fahrsimulation.
   Quelle: simulator-kern.js im PlotBot-Quellprojekt (Vorlagen gekürzt, Texte zweisprachig).
   Koordinaten in mm: Achse links A = (-d/2, 0), rechts B = (+d/2, 0), +y zeigt zum Zeichenfeld.
   Winkel in Grad ab +x, gegen den Uhrzeigersinn. "Arm" = Abtriebsseite, "Motor" = Armwinkel × Untersetzung. */
(function (root) {
  'use strict';
  const RAD = Math.PI / 180;
  // Sprache der Seite: Texte, die das Skript erzeugt, gibt es deutsch und englisch
  const EN = (document.documentElement.lang || '').startsWith('en');
  const t = (de, en) => (EN ? en : de);
  const LOCALE = EN ? 'en-GB' : 'de-DE';

  // Schrittweite, Spiel, Stellweg (0 = unbegrenzt) in Grad, Höchstgeschwindigkeit in Grad/s am Motorabtrieb
  const DRIVES = {
    byj:  { name: t('28BYJ-48 1/64 direkt (Halbschritt)', '28BYJ-48 1/64 direct (half-step)'), step: 360 / 4096, backlash: 1.0, travel: 0, speed: 90 },
    sc09: { name: 'Waveshare SC09 / SCS0009', step: 300 / 1024, backlash: 0.5, travel: 300, speed: 600 },
    sg90: { name: t('SG90 (PWM, effektiv)', 'SG90 (PWM, effective)'), step: 0.75, backlash: 1.0, travel: 180, speed: 600 },
    frei: { name: t('frei (Werte von Hand)', 'custom (enter values)'), step: 0.5, backlash: 0.5, travel: 0, speed: 180 },
  };

  // backlash = Spiel links, backlashR = Spiel rechts (Grad am Motor). limits: Endschalter swL/swR (Armwinkel in Grad)
  // als Grenze und Softlimit "Oberarme kreuzen sich nicht" wie in der Firmware.
  const BASE = { d: 36, L1l: 65, L2l: 90, L1r: 65, L2r: 90, coupled: true, cx: 0, cy: 75, w: 80, h: 80,
    drive: 'byj', step: 360 / 4096, backlash: 1.0, backlashR: 1.0, travel: 0, speed: 90, ratio: 1, elbowL: 'aussen', elbowR: 'aussen',
    limits: false, swL: 270, swR: -90 };   // Vorgabe ohne Schalter: Arm zeigt nach hinten, sperrt das Feld nicht
  const HALB = 360 / 4096;   // ein Halbschritt des 28BYJ-48 (Untersetzung 1/64) in Grad

  const PRESETS = {
    plotbot: { label: 'PlotBot', hint: t('PlotBot: Wellen 36 mm auseinander, Oberarme 65 mm, Unterarme 90 mm, 28BYJ-48 im Halbschritt, ' +
        'Endschalter wie am Gerät, Zeichenfläche 80 × 80 mm (y 35–115). Spiel geschätzt.',
        'PlotBot: shafts 36 mm apart, 65 mm upper arms, 90 mm forearms, 28BYJ-48 half-stepping, ' +
        'limit switches as on the robot, 80 × 80 mm drawing area (y 35–115). Backlash estimated.'),
      geo: { d: 36, L1l: 65, L2l: 90, L1r: 65, L2r: 90, cx: 0, cy: 75, w: 80, h: 80, drive: 'byj', ratio: 1,
        limits: true, swL: 236.96, swR: -56.96 },
      fields: { [t('80×80 (y 35–115)', '80×80 (y 35–115)')]: { cx: 0, cy: 75, w: 80, h: 80 },
        [t('60×60 (y 70–130)', '60×60 (y 70–130)')]: { cx: 0, cy: 100, w: 60, h: 60 } } },
    plotclock: { label: 'Plotclock', hint: t('Plotclock-Prinzip: Achsen 25 mm, Arme 35 / 55 mm, Servos SG90; Stiftversatz vereinfacht weggelassen',
        'Plotclock principle: shafts 25 mm, arms 35 / 55 mm, SG90 servos; pen offset left out for simplicity'),
      geo: { d: 25, L1l: 35, L2l: 55, L1r: 35, L2r: 55, cx: 0, cy: 35, w: 55, h: 25, drive: 'sg90', ratio: 1 } },
  };

  function preset(key) {
    const p = PRESETS[key], dr = DRIVES[p.geo.drive];
    return Object.assign({}, BASE, { step: dr.step, backlash: dr.backlash, backlashR: dr.backlash, travel: dr.travel, speed: dr.speed }, p.geo);
  }

  // ---------- Geometrie ----------
  const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const bases = g => ({ A: { x: -g.d / 2, y: 0 }, B: { x: g.d / 2, y: 0 } });

  /** Schnittpunkte zweier Kreise; "left" liegt links der Blickrichtung c1 → c2. */
  function intersect(c1, r1, c2, r2) {
    const dx = c2.x - c1.x, dy = c2.y - c1.y, s = Math.hypot(dx, dy);
    if (s < 1e-9 || s > r1 + r2 || s < Math.abs(r1 - r2)) return null;
    const a = (r1 * r1 - r2 * r2 + s * s) / (2 * s);
    const h = Math.sqrt(Math.max(0, r1 * r1 - a * a));
    const mx = c1.x + a * dx / s, my = c1.y + a * dy / s, px = -dy / s * h, py = dx / s * h;
    return { left: { x: mx + px, y: my + py }, right: { x: mx - px, y: my - py } };
  }

  /** Vorwärtskinematik: Armwinkel (Grad) → Ellbogen und Stift. mode +1: Stift links von E1 → E2 (vor dem Sockel). */
  function fk(g, t1, t2, mode) {
    const { A, B } = bases(g);
    const E1 = { x: A.x + g.L1l * Math.cos(t1 * RAD), y: A.y + g.L1l * Math.sin(t1 * RAD) };
    const E2 = { x: B.x + g.L1r * Math.cos(t2 * RAD), y: B.y + g.L1r * Math.sin(t2 * RAD) };
    const s = intersect(E1, g.L2l, E2, g.L2r);
    if (!s) return null;
    return { P: mode < 0 ? s.right : s.left, E1, E2, A, B };
  }

  /** Inverse Kinematik: Stift P → Armwinkel. Ellbogen "aussen" = vom Sockel weg nach außen geknickt. */
  function ik(g, P) {
    const { A, B } = bases(g);
    const sl = intersect(A, g.L1l, P, g.L2l), sr = intersect(B, g.L1r, P, g.L2r);
    if (!sl || !sr) return null;
    const E1 = g.elbowL === 'innen' ? sl.right : sl.left;
    const E2 = g.elbowR === 'innen' ? sr.left : sr.right;
    return { t1: Math.atan2(E1.y - A.y, E1.x - A.x) / RAD, t2: Math.atan2(E2.y - B.y, E2.x - B.x) / RAD,
      E1, E2, A, B, P, mode: cross(E1, E2, P) >= 0 ? 1 : -1 };
  }

  function sinAng(u, v) {
    const n = Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y);
    return n < 1e-12 ? 0 : Math.abs(u.x * v.y - u.y * v.x) / n;
  }

  /** Nähe zu Singularitäten als |sin| der Gelenkwinkel: 0 = gestreckt/gefaltet bzw. Unterarme parallel. */
  function criticality(s) {
    const arm = Math.min(sinAng(sub(s.E1, s.A), sub(s.P, s.E1)), sinAng(sub(s.E2, s.B), sub(s.P, s.E2)));
    const fore = sinAng(sub(s.P, s.E1), sub(s.P, s.E2));
    return { arm, fore, min: Math.min(arm, fore) };
  }

  // Unterarmwinkel am Stift in Grad: grün im Kernbereich, gelb im Randbereich, sonst rot
  const FORE = { okLo: 70, okHi: 110, warnLo: 45, warnHi: 135 };
  /** Winkel zwischen den beiden Unterarmen im Stiftpunkt, 0…180°. */
  function foreAngle(s) {
    const u = sub(s.E1, s.P), v = sub(s.E2, s.P), n = Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y);
    return n < 1e-12 ? NaN : Math.acos(Math.max(-1, Math.min(1, (u.x * v.x + u.y * v.y) / n))) / RAD;
  }
  const foreClass = a => (a >= FORE.okLo && a <= FORE.okHi ? 'ok' : a >= FORE.warnLo && a <= FORE.warnHi ? 'warnTxt' : 'bad');

  /** Jacobi-Matrix dP/dθ in mm/° als [j1x, j1y, j2x, j2y] (Spalten: linker, rechter Arm). */
  function jacobian(g, s) {
    const h = 1e-3, f = (a, b) => fk(g, a, b, s.mode);
    const a1 = f(s.t1 + h, s.t2), b1 = f(s.t1 - h, s.t2), a2 = f(s.t1, s.t2 + h), b2 = f(s.t1, s.t2 - h);
    if (!a1 || !b1 || !a2 || !b2) return null;
    return [(a1.P.x - b1.P.x) / (2 * h), (a1.P.y - b1.P.y) / (2 * h), (a2.P.x - b2.P.x) / (2 * h), (a2.P.y - b2.P.y) / (2 * h)];
  }
  /** Stiftfehler in mm, wenn der linke Arm e1, der rechte e2 Grad daneben liegt, ungünstigere Vorzeichenlage. */
  const jacError = (j, e1, e2) => Math.max(Math.hypot(j[0] * e1 + j[2] * e2, j[1] * e1 + j[3] * e2),
    Math.hypot(j[0] * e1 - j[2] * e2, j[1] * e1 - j[3] * e2));
  /** mm Stiftfehler je Grad Armfehler, ungünstiger Fall: beide Achsen gleich weit daneben . */
  function errorGain(g, s) {
    const j = jacobian(g, s);
    return j ? jacError(j, 1, 1) : NaN;
  }

  function segCross(p1, p2, p3, p4) {
    return cross(p3, p4, p1) * cross(p3, p4, p2) < 0 && cross(p1, p2, p3) * cross(p1, p2, p4) < 0;
  }
  /** Kreuzen sich Glieder (nur in getrennten Ebenen baubar)? */
  const armsCross = s => segCross(s.A, s.E1, s.B, s.E2) || segCross(s.A, s.E1, s.E2, s.P) || segCross(s.B, s.E2, s.E1, s.P);

  /** Kreuzen sich die Oberarme (Strecken Welle–Ellbogen)? Wie firmware oberarmeKreuzen. */
  const upperCross = s => cross(s.B, s.E2, s.A) * cross(s.B, s.E2, s.E1) < 0 && cross(s.A, s.E1, s.B) * cross(s.A, s.E1, s.E2) < 0;
  // Armwinkel normiert wie in der Firmware: links [0, 360), rechts [-180, 180)
  const normL = a => ((a % 360) + 360) % 360, normR = a => normL(a + 180) - 180;

  /** Softlimit wie firmware pruefeZiel: null = frei, sonst Grund. Ohne g.limits immer frei. */
  function limitViolation(g, s) {
    if (!g.limits) return null;
    if (normL(s.t1) > g.swL) return t('Endschalter links', 'left limit switch');
    if (normR(s.t2) < g.swR) return t('Endschalter rechts', 'right limit switch');
    if (upperCross(s)) return t('Oberarme kreuzen sich', 'upper arms cross');
    return null;
  }

  /** Armwinkel auf das Schrittraster des Motors runden. Raster ab 0°: Die Firmware setzt nach der Referenzfahrt
      den Zähler auf lround(Schalterwinkel / Schritt), das Raster bleibt also auf Vielfachen des Schritts. */
  function quantArm(g, side, t) {
    if (!(g.step > 0)) return t;
    const r = g.ratio || 1;
    return Math.round(t * r / g.step) * g.step / r;
  }

  /** Teilkreisradius der Armscheibe bei GT2 mit 20 Z am Motor (2 mm Teilung), plus 2,5 mm Bordscheibe. */
  const discRadius = g => (g.ratio > 1.001 ? 20 * g.ratio * 2 / (2 * Math.PI) + 2.5 : 0);
  const reach = g => Math.max(g.L1l + g.L2l, g.L1r + g.L2r) + g.d / 2;
  const wrap = a => ((a % 360) + 540) % 360 - 180;

  function quantile(sorted, q) {
    if (!sorted.length) return NaN;
    const i = Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))));
    return sorted[i];
  }

  /** Analysiert die Zeichenfläche auf einem Raster: Erreichbarkeit, Winkelspannen, Fehler, Singularitäten, Kollision. */
  function analyseField(g, n) {
    n = n || 60;
    const res = Math.max(g.w, g.h) / n, nx = Math.max(1, Math.round(g.w / res)), ny = Math.max(1, Math.round(g.h / res));
    const c = ik(g, { x: g.cx, y: g.cy }), tc1 = c ? c.t1 : 90, tc2 = c ? c.t2 : 90, mc = c ? c.mode : 1;
    const gains = [];
    const reps = [];
    let total = 0, reachN = 0, crit = 0, crossN = 0, flip = 0, blocked = 0, critMin = 1, foreMin = Infinity, foreMax = -Infinity;
    let min1 = Infinity, max1 = -Infinity, min2 = Infinity, max2 = -Infinity;
    for (let i = 0; i <= nx; i++) for (let j = 0; j <= ny; j++) {
      total++;
      const P = { x: g.cx - g.w / 2 + i * g.w / nx, y: g.cy - g.h / 2 + j * g.h / ny };
      const s = ik(g, P);
      if (!s) continue;
      if (s.mode !== mc) { flip++; continue; }
      if (limitViolation(g, s)) { blocked++; continue; }
      reachN++;
      const r1 = wrap(s.t1 - tc1), r2 = wrap(s.t2 - tc2);
      min1 = Math.min(min1, r1); max1 = Math.max(max1, r1); min2 = Math.min(min2, r2); max2 = Math.max(max2, r2);
      const k = criticality(s).min;
      critMin = Math.min(critMin, k);
      if (k < 0.17) crit++;
      if (armsCross(s)) crossN++;
      const fa = foreAngle(s);
      if (isFinite(fa)) { foreMin = Math.min(foreMin, fa); foreMax = Math.max(foreMax, fa); }
      const jm = jacobian(g, s);
      if (jm) { gains.push(jacError(jm, 1, 1)); reps.push(jacError(jm, g.backlash / (g.ratio || 1), g.backlashR / (g.ratio || 1))); }
    }
    gains.sort((a, b) => a - b); reps.sort((a, b) => a - b);
    const st = f => ({ min: gains[0] * f, med: quantile(gains, 0.5) * f, p95: quantile(gains, 0.95) * f, max: gains[gains.length - 1] * f });
    const r = g.ratio || 1;
    return {
      total, reach: reachN, flip, blocked, crit,
      repeat: { min: reps[0], med: quantile(reps, 0.5), p95: quantile(reps, 0.95), max: reps[reps.length - 1] }, crossN, critMin, foreMin, foreMax,
      arm1: { from: tc1 + min1, to: tc1 + max1, span: max1 - min1 },
      arm2: { from: tc2 + min2, to: tc2 + max2, span: max2 - min2 },
      perDeg: st(1), step: st(g.step / r), play: st((g.step + Math.max(g.backlash, g.backlashR)) / r),
      discCollide: discRadius(g) * 2 > g.d,
    };
  }

  /** Raster über einen Bereich für Overlays: Erreichbarkeit, Kritikalität, Fehlerverstärkung (mm/°), Unterarmwinkel (°). */
  function overlayGrid(g, box, n) {
    const res = Math.max(box.w, box.h) / (n || 120), nx = Math.ceil(box.w / res), ny = Math.ceil(box.h / res);
    // reach: 0 = nicht erreichbar, 1 = erreichbar, 2 = erreichbar, aber durch Softlimit gesperrt
    const reachA = new Uint8Array(nx * ny), crit = new Float32Array(nx * ny), gain = new Float32Array(nx * ny);
    const jac = new Float32Array(4 * nx * ny).fill(NaN);
    const fore = new Float32Array(nx * ny).fill(NaN);
    const c = ik(g, { x: g.cx, y: g.cy }), mc = c ? c.mode : 1;
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
      const k = j * nx + i, s = ik(g, { x: box.x + (i + 0.5) * res, y: box.y + (j + 0.5) * res });
      if (!s || s.mode !== mc) { gain[k] = NaN; continue; }
      reachA[k] = limitViolation(g, s) ? 2 : 1; crit[k] = criticality(s).min; fore[k] = foreAngle(s);
      const jm = jacobian(g, s);
      gain[k] = jm ? jacError(jm, 1, 1) : NaN;
      if (jm) jac.set(jm, 4 * k);
    }
    return { x0: box.x, y0: box.y, res, nx, ny, reach: reachA, crit, gain, fore, jac };
  }

  // ---------- Testfiguren: Polylinien in mm aus muster.js ----------
  const ZM = root.ZM;
  const FIGURES = {};
  for (const [k, m] of Object.entries(ZM.MUSTER)) FIGURES[k] = { label: t(m.label, m.labelEn), strokes: () => ZM.polylinien(k) };

  /** Striche (mm) mittig mit 85 % Füllgrad in die Zeichenfläche einpassen; orig = in Originalmaßen lassen. */
  function fitFigure(g, strokes, orig) {
    if (orig) return strokes.map(st => st.map(p => ({ x: p.x, y: p.y })));
    const all = strokes.flat(), xs = all.map(p => p.x), ys = all.map(p => p.y);
    const bx = Math.min(...xs), by = Math.min(...ys), bw = Math.max(...xs) - bx || 1, bh = Math.max(...ys) - by || 1;
    const sc = 0.85 * Math.min(g.w / bw, g.h / bh);
    return strokes.map(st => st.map(p => ({ x: g.cx + (p.x - bx - bw / 2) * sc, y: g.cy + (p.y - by - bh / 2) * sc })));
  }

  function resample(a, b, spacing, down, out) {
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / spacing));
    for (let k = 1; k <= n; k++) out.push({ x: a.x + (b.x - a.x) * k / n, y: a.y + (b.y - a.y) * k / n, down });
  }

  /** Spieloperator: Abtrieb folgt dem Befehl erst, wenn die Lose (b) aufgebraucht ist. */
  function play(out, cmd, b) {
    if (cmd - out > b / 2) return cmd - b / 2;
    if (out - cmd > b / 2) return cmd + b / 2;
    return out;
  }

  /** Fährt eine Figur mit quantisierten Motorwinkeln und Spiel ab. Liefert Stützpunkte ideal/real mit Zeitstempel. */
  function simulate(g, strokes, spacing) {
    spacing = spacing || 0.5;
    const pts = [];
    let cur = strokes[0][0];
    pts.push({ x: cur.x, y: cur.y, down: false });
    for (const st of strokes) {
      resample(cur, st[0], spacing, false, pts);
      for (let k = 1; k < st.length; k++) resample(st[k - 1], st[k], spacing, true, pts);
      cur = st[st.length - 1];
    }
    const r = g.ratio || 1;
    const samples = [];
    let p1 = null, p2 = null, h1 = null, h2 = null, c1 = null, c2 = null, t = 0, unreachable = 0, blocked = 0, sum = 0, nDown = 0, maxDev = 0;
    for (const p of pts) {
      const s = ik(g, p);
      if (!s) { unreachable++; continue; }
      if (limitViolation(g, s)) { blocked++; continue; }
      let a1 = s.t1, a2 = s.t2;
      if (p1 !== null) { a1 += 360 * Math.round((p1 - a1) / 360); a2 += 360 * Math.round((p2 - a2) / 360); }
      p1 = a1; p2 = a2;
      const q1 = quantArm(g, 0, a1) * r, q2 = quantArm(g, 1, a2) * r;
      if (h1 === null) { h1 = q1; h2 = q2; c1 = q1; c2 = q2; }
      t += Math.max(Math.abs(q1 - c1), Math.abs(q2 - c2)) / g.speed;
      c1 = q1; c2 = q2;
      h1 = play(h1, q1, g.backlash); h2 = play(h2, q2, g.backlashR);
      const f = fk(g, h1 / r, h2 / r, s.mode);
      if (!f) { unreachable++; continue; }
      const dev = Math.hypot(f.P.x - p.x, f.P.y - p.y);
      if (p.down) { sum += dev; nDown++; maxDev = Math.max(maxDev, dev); }
      samples.push({ ideal: p, real: f.P, E1: f.E1, E2: f.E2, down: p.down, t, m1: h1, m2: h2 });
    }
    return { samples, time: t, unreachable, blocked, meanDev: nDown ? sum / nDown : NaN, maxDev };
  }

  /** Selbsttest: FK(IK(p)) ≈ p für Zufallspunkte in der Zeichenfläche. Liefert max. Abweichung in mm. */
  function selfTest(g, n) {
    let max = 0, ok = 0, seed = 12345;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let k = 0; k < (n || 500); k++) {
      const P = { x: g.cx + (rnd() - 0.5) * g.w, y: g.cy + (rnd() - 0.5) * g.h }, s = ik(g, P);
      if (!s) continue;
      const f = fk(g, s.t1, s.t2, s.mode);
      max = Math.max(max, Math.hypot(f.P.x - P.x, f.P.y - P.y)); ok++;
    }
    return { tested: ok, maxErr: max };
  }

  const ZK = { EN, t, LOCALE, DRIVES, BASE, PRESETS, HALB, preset, fk, ik, criticality, errorGain, jacobian, jacError, quantArm, upperCross, limitViolation, normL, normR, FORE, foreAngle, foreClass, armsCross, discRadius, reach, wrap,
    analyseField, overlayGrid, FIGURES, fitFigure, simulate, selfTest };
  root.ZK = ZK;
})(window);
