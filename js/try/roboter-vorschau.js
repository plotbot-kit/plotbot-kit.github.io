// Draufsicht auf den PlotBot für „Im Browser ausprobieren“: Grundplatte, zwei Armpaare, Stift und ein Blatt 80 × 80 mm.
// Eigene, kleine Fassung. Maße und Konvention aus dem Roboter-Repository: firmware/lib/zeichnen/src/kinematik.h
// (Wellen bei x = ±achsabstand/2, y = 0, +y zum Zeichenfeld; Ellbogen beider Seiten „aussen“; Feld x −40…40, y 35…115).
// Die Striche kommen aus schildkroete.js in Koordinaten des Kinds (mm ab der Ecke links unten des Felds, y nach oben).
'use strict';
(function (wurzel) {
  const SVG = 'http://www.w3.org/2000/svg';
  const GEOMETRIE = Object.freeze({ achsabstand: 36, oberarm: 65, unterarm: 90, feldX: [-40, 40], feldY: [35, 115] });
  const MASCHINENFELD = [GEOMETRIE.feldX[0], GEOMETRIE.feldX[1], GEOMETRIE.feldY[0], GEOMETRIE.feldY[1]];
  const TEMPO_AB = 20;    // mm/s mit Stift auf dem Papier (bei Tempo 1)
  const TEMPO_AUF = 45;   // mm/s beim Umsetzen mit gehobenem Stift

  // Schnittpunkte zweier Kreise; „links“ liegt links der Blickrichtung c1 → c2 (wie simulator-kern.js).
  function schnitt(c1, r1, c2, r2) {
    const dx = c2.x - c1.x, dy = c2.y - c1.y, s = Math.hypot(dx, dy);
    if (s < 1e-9 || s > r1 + r2 || s < Math.abs(r1 - r2)) return null;
    const a = (r1 * r1 - r2 * r2 + s * s) / (2 * s);
    const h = Math.sqrt(Math.max(0, r1 * r1 - a * a));
    const mx = c1.x + a * dx / s, my = c1.y + a * dy / s, px = -dy / s * h, py = dx / s * h;
    return { links: { x: mx + px, y: my + py }, rechts: { x: mx - px, y: my - py } };
  }

  // Inverse Kinematik als Bild: Stift → beide Ellbogen. null, wenn der Punkt nicht erreichbar ist.
  function ellbogen(stift) {
    const g = GEOMETRIE, A = { x: -g.achsabstand / 2, y: 0 }, B = { x: g.achsabstand / 2, y: 0 };
    const l = schnitt(A, g.oberarm, stift, g.unterarm), r = schnitt(B, g.oberarm, stift, g.unterarm);
    return l && r ? { A, B, E1: l.links, E2: r.rechts } : null;
  }

  const inMaschine = p => ({ x: GEOMETRIE.feldX[0] + p[0], y: GEOMETRIE.feldY[0] + p[1] });

  function neu(tag, attribute, eltern) {
    const e = document.createElementNS(SVG, tag);
    for (const [k, v] of Object.entries(attribute)) e.setAttribute(k, v);
    eltern.appendChild(e);
    return e;
  }

  // Fahrplan: Umsetzen mit gehobenem Stift zum Anfang jedes Strichs, dann den Strich entlang.
  function fahrplan(striche, start) {
    const wege = [];
    let hier = start;
    striche.forEach((st, i) => {
      const pts = st.map(inMaschine);
      wege.push({ von: hier, nach: pts[0], ab: false, strich: i });
      for (let k = 1; k < pts.length; k++) wege.push({ von: pts[k - 1], nach: pts[k], ab: true, strich: i });
      hier = pts[pts.length - 1];
    });
    for (const w of wege) w.laenge = Math.hypot(w.nach.x - w.von.x, w.nach.y - w.von.y);
    return wege;
  }

  function erzeuge(svg) {
    const g = GEOMETRIE;
    const sy = y => -y;   // SVG: y nach unten, Roboter unten, Blatt oben, so wie das Kind davor sitzt
    svg.setAttribute('viewBox', '-95 -122 190 150');
    svg.textContent = '';
    const fx = g.feldX[0], fw = g.feldX[1] - g.feldX[0], fh = g.feldY[1] - g.feldY[0];
    neu('rect', { x: fx - 6, y: sy(g.feldY[1]) - 6, width: fw + 12, height: fh + 12, fill: '#fff', stroke: '#e7dfc4', 'stroke-width': 0.6, rx: 1 }, svg);
    const blatt = neu('g', {}, svg);
    for (let k = 10; k < 80; k += 10) {
      neu('line', { x1: fx + k, y1: sy(g.feldY[0]), x2: fx + k, y2: sy(g.feldY[1]), stroke: '#ece8dc', 'stroke-width': 0.3 }, blatt);
      neu('line', { x1: fx, y1: sy(g.feldY[0] + k), x2: fx + fw, y2: sy(g.feldY[0] + k), stroke: '#ece8dc', 'stroke-width': 0.3 }, blatt);
    }
    neu('rect', { x: fx, y: sy(g.feldY[1]), width: fw, height: fh, fill: 'none', stroke: '#4a4760', 'stroke-width': 0.4, 'stroke-dasharray': '1.5 1' }, blatt);
    const plan = neu('g', { fill: 'none', stroke: '#c9c3b0', 'stroke-width': 0.5, 'stroke-dasharray': '1 1', 'stroke-linejoin': 'round' }, svg);
    const tinte = neu('g', { fill: 'none', stroke: '#1864ab', 'stroke-width': 0.8, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);
    const rot = neu('g', { fill: '#c0271f' }, svg);
    // Grundplatte mit zwei Motoren
    neu('rect', { x: -48, y: sy(14), width: 96, height: 36, rx: 4, fill: '#55575f' }, svg);
    for (const x of [-g.achsabstand / 2, g.achsabstand / 2]) neu('circle', { cx: x, cy: 0, r: 7, fill: '#3a3c42', stroke: '#777', 'stroke-width': 0.6 }, svg);
    const arme = neu('g', { 'stroke-linecap': 'round' }, svg);
    const ober = [0, 1].map(() => neu('line', { stroke: '#f08c00', 'stroke-width': 4.5 }, arme));
    const unter = [0, 1].map(() => neu('line', { stroke: '#adb5bd', 'stroke-width': 3.2 }, arme));
    const gelenke = [0, 1, 2, 3].map(() => neu('circle', { r: 1.6, fill: '#343a40' }, arme));
    const stift = neu('circle', { r: 2.2 }, svg);

    let stiftPos = inMaschine([40, 40]);
    let ab = false;
    let lauf = null;

    function stelle(p, unten) {
      const e = ellbogen(p);
      if (!e) return;
      stiftPos = p;
      ab = unten;
      const setze = (linie, a, b) => { linie.setAttribute('x1', a.x); linie.setAttribute('y1', sy(a.y)); linie.setAttribute('x2', b.x); linie.setAttribute('y2', sy(b.y)); };
      setze(ober[0], e.A, e.E1); setze(ober[1], e.B, e.E2);
      setze(unter[0], e.E1, p); setze(unter[1], e.E2, p);
      [e.A, e.B, e.E1, e.E2].forEach((q, i) => { gelenke[i].setAttribute('cx', q.x); gelenke[i].setAttribute('cy', sy(q.y)); });
      stift.setAttribute('cx', p.x); stift.setAttribute('cy', sy(p.y));
      stift.setAttribute('fill', unten ? '#1864ab' : '#fff');
      stift.setAttribute('stroke', unten ? '#0b3d6b' : '#1864ab');
      stift.setAttribute('stroke-width', unten ? 0.6 : 1);
      stift.setAttribute('r', unten ? 1.8 : 2.6);   // gehoben wirkt er größer, weil er näher am Auge ist
    }

    const punkte = st => st.map(p => { const m = inMaschine(p); return `${m.x},${sy(m.y)}`; }).join(' ');

    // Zeigt, was gezeichnet würde: gestrichelt, Punkte außerhalb rot. Die Tinte von vorher verschwindet.
    function zeige(striche, aussen) {
      stopp();
      plan.textContent = ''; tinte.textContent = ''; rot.textContent = '';
      for (const st of striche) neu('polyline', { points: punkte(st) }, plan);
      for (const p of aussen || []) { const m = inMaschine(p); neu('circle', { cx: m.x, cy: sy(m.y), r: 1.3 }, rot); }
    }

    // Fährt die Striche ab. fortschritt(anteil) und fertig(abgebrochen) melden den Stand.
    function start(striche, tempo, fortschritt, fertig) {
      stopp();
      tinte.textContent = '';
      const wege = fahrplan(striche, stiftPos);
      const gesamt = wege.reduce((s, w) => s + w.laenge, 0) || 1;
      const linien = striche.map(() => null);
      let i = 0, weit = 0, geschafft = 0, zuletzt = null;
      lauf = { abbrechen: () => fertig(true) };
      function schritt(t) {
        if (!lauf) return;
        let budget = zuletzt === null ? 0 : Math.min(0.1, (t - zuletzt) / 1000);
        zuletzt = t;
        while (i < wege.length && budget > 0) {
          const w = wege[i];
          const v = (w.ab ? TEMPO_AB : TEMPO_AUF) * tempo;
          const rest = w.laenge - weit;
          const d = Math.min(rest, budget * v);
          weit += d; geschafft += d; budget -= d / v;
          const a = w.laenge ? weit / w.laenge : 1;
          const p = { x: w.von.x + (w.nach.x - w.von.x) * a, y: w.von.y + (w.nach.y - w.von.y) * a };
          if (w.ab) {
            if (!linien[w.strich]) linien[w.strich] = { fest: [`${w.von.x},${sy(w.von.y)}`], el: neu('polyline', {}, tinte) };
            const l = linien[w.strich], spitze = `${p.x},${sy(p.y)}`;
            if (weit >= w.laenge - 1e-9) l.fest.push(spitze);
            l.el.setAttribute('points', (weit >= w.laenge - 1e-9 ? l.fest : l.fest.concat(spitze)).join(' '));
          }
          stelle(p, w.ab);
          if (weit >= w.laenge - 1e-9) { i++; weit = 0; }
        }
        fortschritt(Math.min(1, geschafft / gesamt));
        if (i >= wege.length) {
          lauf = null;
          stelle(stiftPos, false);
          fertig(false);
          return;
        }
        lauf.rahmen = requestAnimationFrame(schritt);
      }
      lauf.rahmen = requestAnimationFrame(schritt);
    }

    function stopp() {
      if (!lauf) return;
      cancelAnimationFrame(lauf.rahmen);
      const l = lauf;
      lauf = null;
      stelle(stiftPos, false);
      l.abbrechen();
    }

    function zuruecksetzen() {
      stopp();
      tinte.textContent = '';
      stelle(inMaschine([40, 40]), false);
    }

    stelle(stiftPos, false);
    return { zeige, start, stopp, zuruecksetzen, laeuft: () => lauf !== null };
  }

  wurzel.RoboterVorschau = { GEOMETRIE, MASCHINENFELD, erzeuge, ellbogen };
}(window));
