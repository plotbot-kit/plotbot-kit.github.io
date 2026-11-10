/* PlotBot-Kinematiksimulator – Testmuster als Daten.
   Angepasst aus dem PlotBot-Kinematiksimulator (gekürzt auf fünf Testfiguren).
   Koordinaten in mm, ausgelegt für das Feld x −30…30, y 70…130.
   Ein Muster ist eine Liste von Strichen (Stift unten); ein Strich ist eine Liste von Stücken, die aneinander anschließen:
     {"p": [[x, y], …]}                          Polygonzug
     {"e": [cx, cy, rx, ry, a0, a1]}             Ellipsen- bzw. Kreisbogen, Winkel in Grad, a0 → a1
     {"b": [[x0, y0], [c1], [c2], [x1, y1], …]}  kubische Bézier-Kette, je weiteres Segment drei Punkte */
(function (root) {
  'use strict';
  const MUSTER = {
    "quadrat": { "label": "Quadrat (60 mm, gegen und mit dem Uhrzeigersinn)", "labelEn": "Square (60 mm, anticlockwise and clockwise)", "striche": [
      [{ "p": [[-30, 70], [30, 70], [30, 130], [-30, 130], [-30, 70], [-30, 130], [30, 130], [30, 70], [-30, 70]] }]] },
    "stern": { "label": "Fünfstern (r 28 mm)", "labelEn": "Five-pointed star (r 28 mm)", "striche": [
      [{ "p": [[0, 128], [16.46, 77.35], [-26.63, 108.65], [26.63, 108.65], [-16.46, 77.35], [0, 128]] }]] },
    "kalibrierbild": { "label": "Kalibrierbild 60×60 (Rahmen hin und zurück, Gitter, Kreuz, Kreis)", "labelEn": "Calibration sheet 60×60 (frame both ways, grid, cross, circle)", "striche": [
      [{ "p": [[-30, 70], [30, 70], [30, 130], [-30, 130], [-30, 70], [-30, 130], [30, 130], [30, 70], [-30, 70]] }],
      [{ "p": [[-10, 70], [-10, 130]] }],
      [{ "p": [[10, 130], [10, 70]] }],
      [{ "p": [[-30, 90], [30, 90]] }],
      [{ "p": [[30, 110], [-30, 110]] }],
      [{ "p": [[-4, 100], [4, 100]] }],
      [{ "p": [[0, 96], [0, 104]] }],
      [{ "e": [0, 100, 20, 20, 0, 360] }]] },
    "hallo": { "label": "Text „HALLO“ (Einstrich, 13 mm hoch)", "labelEn": "Text \"HALLO\" (single stroke, 13 mm high)", "striche": [
      [{ "p": [[-27.3, 93.5], [-27.3, 106.5]] }], [{ "p": [[-19.5, 93.5], [-19.5, 106.5]] }], [{ "p": [[-27.3, 100], [-19.5, 100]] }],
      [{ "p": [[-15.6, 93.5], [-11.7, 106.5], [-7.8, 93.5]] }], [{ "p": [[-14.04, 98.7], [-9.36, 98.7]] }],
      [{ "p": [[-3.9, 106.5], [-3.9, 93.5], [3.9, 93.5]] }],
      [{ "p": [[7.8, 106.5], [7.8, 93.5], [15.6, 93.5]] }],
      [{ "e": [23.4, 100, 3.9, 6.5, 90, 450] }]] },
    "kreis": { "label": "Kreis (r 25 mm)", "labelEn": "Circle (r 25 mm)", "striche": [[{ "e": [0, 100, 25, 25, 0, 360] }]] }
  };

  /** Stück in Punkte zerlegen; Bögen und Bézier-Kurven etwa 1 mm fein (Bézier bis ≈ 1,1 mm, der Simulator teilt nach). */
  function stueckPunkte(s) {
    if (s.p) return s.p.map(([x, y]) => ({ x, y }));
    if (s.e) {
      const [cx, cy, rx, ry, a0, a1] = s.e, n = Math.max(8, Math.ceil(Math.abs(a1 - a0) / 360 * 2 * Math.PI * Math.max(rx, ry)));
      return Array.from({ length: n + 1 }, (_, k) => {
        const a = (a0 + (a1 - a0) * k / n) * Math.PI / 180;
        return { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) };
      });
    }
    const b = s.b, out = [{ x: b[0][0], y: b[0][1] }];
    for (let i = 0; i + 3 < b.length; i += 3) {
      const [p0, p1, p2, p3] = b.slice(i, i + 4), d = (a, c) => Math.hypot(c[0] - a[0], c[1] - a[1]);
      const n = Math.max(4, Math.ceil(d(p0, p1) + d(p1, p2) + d(p2, p3)));   // Kontrollpolygon ≥ Kurvenlänge
      for (let k = 1; k <= n; k++) {
        const t = k / n, u = 1 - t, w = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
        out.push({ x: w[0] * p0[0] + w[1] * p1[0] + w[2] * p2[0] + w[3] * p3[0], y: w[0] * p0[1] + w[1] * p1[1] + w[2] * p2[1] + w[3] * p3[1] });
      }
    }
    return out;
  }

  /** Muster → Polylinien in mm: je Strich eine Liste {x, y}. */
  function polylinien(name) {
    return MUSTER[name].striche.map(strich => strich.flatMap((s, i) => (i ? stueckPunkte(s).slice(1) : stueckPunkte(s))));
  }

  const ZM = { MUSTER, polylinien };
  root.ZM = ZM;
})(window);
