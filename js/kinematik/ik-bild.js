/* PlotBot – „Inverse Kinematik verstehen“: Rechnung und Bild für einen Stiftpunkt.
   Reine Funktionen ohne DOM: Die Seite (verstehen.js) und der Generator der festen Abbildungen
   (tools/ik-figuren.js) zeichnen mit demselben Code. Die Kinematik selbst kommt aus kern.js (ZK.ik).
   Koordinaten in mm wie in kern.js; im SVG zeigt +y nach oben, deshalb steht dort überall −y. */
(function (root) {
  'use strict';
  const ZK = root.ZK, RAD = Math.PI / 180;

  // Maße des PlotBot aus der Vorlage in kern.js: Wellenabstand 36, Oberarm 65, Unterarm 90, Feld 80 × 80 (y 35–115).
  // Quelle im Roboter-Repo: cad/params.scad:9-11 und firmware/lib/zeichnen/src/kinematik.h:12-16.
  const G = Object.assign(ZK.preset('plotbot'), { limits: false });
  // Schwenkbereiche der Oberarme in Grad: firmware/lib/zeichnen/src/kinematik.h:17-18 (= cad/params.scad:14-15)
  const BEREICH = { l: [78, 238], r: [-58, 102] };
  const A = { x: -G.d / 2, y: 0 }, B = { x: G.d / 2, y: 0 };
  const FELD = { x0: G.cx - G.w / 2, x1: G.cx + G.w / 2, y0: G.cy - G.h / 2, y1: G.cy + G.h / 2 };
  const VIEW = { x0: -110, x1: 110, y0: -30, y1: 165 };   // sichtbarer Ausschnitt in mm
  const t = ZK.t;
  const zahl = (n, d) => n.toLocaleString(ZK.LOCALE, { minimumFractionDigits: d == null ? 1 : d, maximumFractionDigits: d == null ? 1 : d });
  const r1 = n => Math.round(n * 10) / 10;

  /** Eine Seite als Dreieck Welle–Ellbogen–Stift: Abstand c, Richtung φ zum Stift, Winkel α am Motor (Kosinussatz). */
  function seite(W, L1, L2, P) {
    const c = Math.hypot(P.x - W.x, P.y - W.y), phi = Math.atan2(P.y - W.y, P.x - W.x) / RAD;
    const zuWeit = c > L1 + L2, zuNah = c < Math.abs(L2 - L1);
    const alpha = zuWeit || zuNah ? NaN : Math.acos(Math.max(-1, Math.min(1, (L1 * L1 + c * c - L2 * L2) / (2 * L1 * c)))) / RAD;
    return { W, L1, L2, c, phi, alpha, zuWeit, zuNah };
  }
  const pol = (W, r, grad) => ({ x: W.x + r * Math.cos(grad * RAD), y: W.y + r * Math.sin(grad * RAD) });

  /** Löst einen Stiftpunkt: Winkel wie die Firmware (pruefeZiel ohne Feldprüfung) und alles, was das Bild braucht.
      art: 'ok' | 'weit' (Arme zu kurz) | 'nah' (lässt sich nicht so weit falten) | 'bereich' (Schwenkbereich) |
      'kreuz' (Oberarme kreuzen sich) | 'hinten' (Stift hinter der Linie der Ellbogen, in kern.js mode −1). */
  function loese(P) {
    const l = seite(A, G.L1l, G.L2l, P), r = seite(B, G.L1r, G.L2r, P);
    const s = ZK.ik(G, P), innen = ZK.ik(Object.assign({}, G, { elbowL: 'innen', elbowR: 'innen' }), P);
    const L = { P, l, r, A, B, innen, imFeld: P.x >= FELD.x0 && P.x <= FELD.x1 && P.y >= FELD.y0 && P.y <= FELD.y1 };
    if (!s) {
      L.art = l.zuWeit || r.zuWeit ? 'weit' : 'nah';
      // Ersatzbild: Die Seite, die nicht reicht, liegt gestreckt (oder ganz gefaltet) in Richtung Stift
      const ersatz = (q, sign) => q.zuWeit ? { E: pol(q.W, q.L1, q.phi), ende: pol(q.W, q.L1 + q.L2, q.phi) }
        : q.zuNah ? { E: pol(q.W, -q.L1, q.phi), ende: pol(q.W, q.L2 - q.L1, q.phi) }
          : { E: pol(q.W, q.L1, q.phi + sign * q.alpha), ende: P };
      const el = ersatz(l, 1), er = ersatz(r, -1);
      L.E1 = el.E; L.E2 = er.E; L.endeL = el.ende; L.endeR = er.ende;
      return L;
    }
    L.E1 = s.E1; L.E2 = s.E2; L.endeL = L.endeR = P;
    L.t1 = ZK.normL(s.t1); L.t2 = ZK.normR(s.t2);
    const imBereich = L.t1 >= BEREICH.l[0] && L.t1 <= BEREICH.l[1] && L.t2 >= BEREICH.r[0] && L.t2 <= BEREICH.r[1];
    L.art = !imBereich ? 'bereich' : ZK.upperCross(s) ? 'kreuz' : s.mode < 0 ? 'hinten' : 'ok';
    return L;
  }

  let flaeche = null;
  /** Fläche, die der Stift erreicht (Raster 2 mm), als SVG-Pfad aus waagerechten Streifen. */
  function reichweite() {
    if (flaeche) return flaeche;
    const res = 2;
    let d = '';
    for (let y = VIEW.y0; y < VIEW.y1; y += res) {
      let start = null;
      for (let x = VIEW.x0; x <= VIEW.x1; x += res) {
        const ok = x < VIEW.x1 && loese({ x: x + res / 2, y: y + res / 2 }).art === 'ok';
        if (ok && start === null) start = x;
        if (!ok && start !== null) { d += `M${start} ${-y}h${x - start}v${-res}h${start - x}z`; start = null; }
      }
    }
    return (flaeche = d);
  }

  // ---------- SVG-Bausteine ----------
  const linie = (p, q, cls) => `<line class="${cls}" x1="${r1(p.x)}" y1="${r1(-p.y)}" x2="${r1(q.x)}" y2="${r1(-q.y)}"/>`;
  const punkt = (p, r, cls) => `<circle class="${cls}" cx="${r1(p.x)}" cy="${r1(-p.y)}" r="${r}"/>`;
  const text = (p, s, cls, anker) => `<text class="lbl ${cls || ''}" x="${r1(p.x)}" y="${r1(-p.y)}" text-anchor="${anker || 'middle'}">${s}</text>`;
  /** Kreisbogen um W von Winkel a0 bis a1 (Grad, mathematisch positiv = gegen den Uhrzeigersinn). */
  function bogen(W, r, a0, a1, cls) {
    const p = pol(W, r, a0), q = pol(W, r, a1), gross = Math.abs(a1 - a0) > 180 ? 1 : 0, dreh = a1 > a0 ? 0 : 1;
    return `<path class="${cls}" d="M${r1(p.x)} ${r1(-p.y)}A${r} ${r} 0 ${gross} ${dreh} ${r1(q.x)} ${r1(-q.y)}"/>`;
  }
  const winkelText = (W, r, a0, a1, s, cls) => text(pol(W, r, (a0 + a1) / 2), s, cls);

  /** Winkelmesser um W: Skala von a0 bis a1 (Grad), Striche alle 10°, lange Striche alle 30°, Zahlen von z0 bis z1. */
  function winkelmesser(W, a0, a1, z0, z1, cls) {
    const R = 32;
    let d = '', h = '';
    for (let a = a0; a <= a1; a += 10) {
      const p = pol(W, R, a), q = pol(W, R - (a % 30 === 0 ? 6 : 3), a);
      d += `M${r1(p.x)} ${r1(-p.y)}L${r1(q.x)} ${r1(-q.y)}`;
      if (a % 30 === 0 && a >= z0 && a <= z1) { const m = pol(W, R + 6, a); h += text({ x: m.x, y: m.y - 2.5 }, String(a).replace('-', '−'), 'skala'); }
    }
    return bogen(W, R, a0, a1, 'wm ' + cls) + `<path class="wm ${cls}" d="${d}"/>` + h;
  }

  /** Zeichnet die Szene als SVG-Inhalt. o.schritt: 0 = ganzer Roboter mit Winkeln, 1–7 = Zirkel-Konstruktion:
      1 Kreise um die Motoren, 2 Zielpunkt, 3 Kreis um das Ziel, 4 Schnittpunkte, 5 Ellbogen wählen (o.wahl = { l, r } mit
      'aussen' | 'innen'), 6 Arme, 7 Winkel ablesen. o.flaeche: erreichbare Fläche; o.dreieck: Dreieck des Kosinussatzes;
      o.neu: Neues des Schritts einblenden (CSS-Klasse „neu“). */
  function szene(L, o) {
    o = o || {};
    const n = o.schritt || 0, P = L.P, geht = L.art !== 'weit' && L.art !== 'nah', gut = L.art === 'ok', wahl = o.wahl || {};
    const neu = k => (o.neu && n === k ? ' neu' : '');
    const stiftDa = n === 0 || n >= 2, arme = n === 0 || n >= 6, zu = gut ? '' : ' gesperrt';
    let h = '';
    if (o.flaeche) h += `<path class="flaeche" d="${reichweite()}"/>`;
    h += `<rect class="feld" x="${FELD.x0}" y="${-FELD.y1}" width="${G.w}" height="${G.h}"/>`;
    h += linie({ x: VIEW.x0 + 6, y: 0 }, { x: VIEW.x1 - 6, y: 0 }, 'achse');
    if (n !== 7) h += text({ x: A.x - 5, y: -11 }, t('Motor links', 'left motor'), 'kl-l', 'end') + text({ x: B.x + 5, y: -11 }, t('Motor rechts', 'right motor'), 'kl-r', 'start');

    if (n === 7 && geht) h += winkelmesser(A, 60, 240, 90, 240, 'wm-l' + neu(7)) + winkelmesser(B, -60, 120, -60, 90, 'wm-r' + neu(7));
    if ((n >= 1 && n <= 6) || (n === 0 && !geht)) h += punkt(A, G.L1l, 'kreis kr-l' + neu(1)) + punkt(B, G.L1r, 'kreis kr-r' + neu(1));
    if ((n >= 3 && n <= 6) || (n === 0 && !geht)) h += punkt(P, G.L2l, 'kreis kr-stift' + neu(3));

    if (geht && (n === 4 || n === 5)) {   // vier Schnittpunkte: je Seite ein äußerer und ein innerer Ellbogen
      const kand = (E, seite, wo) => {
        const gewaehlt = n === 5 && wahl[seite] === wo;
        return punkt(E, 3.4, 'kandidat' + (gewaehlt ? (wo === 'aussen' ? ' richtig' : ' falsch') : '') + neu(4));
      };
      if (n === 5) {
        if (wahl.l === 'innen') h += linie(A, L.innen.E1, 'arm blass') + linie(L.innen.E1, P, 'arm blass');
        if (wahl.r === 'innen') h += linie(B, L.innen.E2, 'arm blass') + linie(L.innen.E2, P, 'arm blass');
        if (wahl.l === 'aussen') h += linie(A, L.E1, 'arm ober-l') + linie(L.E1, P, 'arm unter');
        if (wahl.r === 'aussen') h += linie(B, L.E2, 'arm ober-r') + linie(L.E2, P, 'arm unter');
      }
      h += kand(L.E1, 'l', 'aussen') + kand(L.innen.E1, 'l', 'innen') + kand(L.E2, 'r', 'aussen') + kand(L.innen.E2, 'r', 'innen');
    }
    if (o.dreieck && geht) {   // Dreieck Welle–Ellbogen–Stift mit φ und α
      h += linie(A, P, 'hilfs');
      h += bogen(A, 20, 0, L.l.phi, 'wb-phi') + winkelText(A, 27, 0, L.l.phi, 'φ', 'kl-phi');
      h += bogen(A, 34, L.l.phi, L.l.phi + L.l.alpha, 'wb-l') + winkelText(A, 41, L.l.phi, L.l.phi + L.l.alpha, 'α', 'kl-l');
    }
    if (arme) {
      h += linie(B, L.E2, 'arm ober-r' + zu + neu(6)) + linie(L.E2, L.endeR, 'arm unter' + zu + neu(6)) + punkt(L.E2, 3, 'gelenk' + neu(6));
      h += linie(A, L.E1, 'arm ober-l' + zu + neu(6)) + linie(L.E1, L.endeL, 'arm unter' + zu + neu(6)) + punkt(L.E1, 3, 'gelenk' + neu(6));
      if (!geht && L.endeL !== P) h += linie(L.endeL, P, 'luecke');
      if (!geht && L.endeR !== P) h += linie(L.endeR, P, 'luecke');
    }
    if (geht && (n === 0 || n === 7) && !o.dreieck) {   // Motorwinkel ab der Grundlinie
      h += bogen(A, 16, 0, L.t1, 'wb-l') + winkelText(A, n === 7 ? 54 : 26, 0, L.t1, zahl(L.t1, 0) + '°', 'kl-l wert');
      h += bogen(B, 16, 0, L.t2, 'wb-r') + winkelText(B, n === 7 ? 54 : 26, 0, L.t2, zahl(L.t2, 0) + '°', 'kl-r wert');
    }
    if (o.dreieck && geht) {
      const m = (p, q, k) => ({ x: (p.x + q.x) / 2 + k.x, y: (p.y + q.y) / 2 + k.y });
      h += text(m(A, L.E1, { x: -9, y: 0 }), zahl(G.L1l, 0), 'kl-l') + text(m(L.E1, P, { x: -4, y: 6 }), zahl(G.L2l, 0)) +
        text(m(A, P, { x: 9, y: -4 }), 'c', 'kl-phi');
    }
    h += punkt(A, 4, 'welle') + punkt(B, 4, 'welle');
    if (stiftDa) h += punkt(P, 4.5, 'stift' + zu + neu(2));
    return h;
  }

  root.IKBild = { G, A, B, FELD, VIEW, BEREICH, loese, szene, reichweite, zahl };
})(typeof window !== 'undefined' ? window : globalThis);
