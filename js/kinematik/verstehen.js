/* PlotBot – „Inverse Kinematik verstehen“: Bedienung der Lernfigur.
   Der Stift lässt sich ziehen (Maus, Finger), mit den Pfeiltasten schieben oder als Zahl eingeben;
   Rechnung und Zeichnung kommen aus ik-bild.js, die Kinematik aus kern.js. Ohne JavaScript bleibt die Figur
   verborgen, die Seite erklärt dann alles mit festen Abbildungen. */
(function () {
  'use strict';
  const I = window.IKBild, $ = id => document.getElementById(id), box = $('ik');
  if (!box || !I) return;
  const t = window.ZK.t, z = I.zahl;
  const k = n => n.toLocaleString(window.ZK.LOCALE, { maximumFractionDigits: 1 }).replace('-', '−');   // Koordinate ohne „,0“
  const punktText = P => t(`(${k(P.x)} | ${k(P.y)})`, `(${k(P.x)}, ${k(P.y)})`);
  const schreibe = (el, s) => { if (el.textContent !== s) el.textContent = s; };   // nur bei Änderung: Live-Regionen sprechen sonst ständig
  const svg = $('ik-svg'), szene = $('ik-szene'), griff = $('ik-griff');
  const inX = $('ik-x'), inY = $('ik-y'), outL = $('ik-wl'), outR = $('ik-wr'), status = $('ik-status');
  const rechnen = $('ik-rechnen'), knoepfe = Array.from(document.querySelectorAll('#ik-wahl [data-seite]'));
  const SCHRITTE = 7, wahl = { l: null, r: null };
  const griffHinweis = griff.getAttribute('aria-label');
  let P = { x: 30, y: 100 }, schritt = 0, L = null;

  const seiteName = links => (links ? t('linken', 'left') : t('rechten', 'right'));

  /** Ein Satz dazu, ob und warum der Roboter den Punkt erreicht. */
  function statusText(L) {
    const g = I.G, lang = g.L1l + g.L2l, kurz = g.L2l - g.L1l;
    switch (L.art) {
      case 'ok': return L.imFeld
        ? t('Erreichbar. Der Punkt liegt in der Zeichenfläche.', 'Reachable. The point is inside the drawing area.')
        : t('Erreichbar, aber außerhalb der Zeichenfläche. Der PlotBot zeichnet nur im gestrichelten Quadrat.',
          'Reachable, but outside the drawing area. PlotBot only draws inside the dashed square.');
      case 'weit': {
        const links = L.l.c >= L.r.c, c = links ? L.l.c : L.r.c;
        return t(`Nicht erreichbar: Die Arme sind zu kurz. Vom ${seiteName(links)} Motor bis zum Punkt sind es ${z(c, 0)} mm, Oberarm und Unterarm messen zusammen nur ${lang} mm.`,
          `Out of reach: the arms are too short. It's ${z(c, 0)} mm from the ${seiteName(links)} motor to the point, but the upper arm and forearm together are only ${lang} mm long.`);
      }
      case 'nah': {
        const links = L.l.zuNah;
        return t(`Nicht erreichbar: Der Punkt liegt zu nah am ${seiteName(links)} Motor. Der Unterarm ist ${kurz} mm länger als der Oberarm. Auch ganz zusammengefaltet bleibt der Stift ${kurz} mm von der Motorwelle entfernt.`,
          `Out of reach: the point is too close to the ${seiteName(links)} motor. The forearm is ${kurz} mm longer than the upper arm, so even folded up completely the pen stays ${kurz} mm away from the motor shaft.`);
      }
      case 'bereich': {
        const b = I.BEREICH, links = L.t1 < b.l[0] || L.t1 > b.l[1], w = links ? L.t1 : L.t2, r = links ? b.l : b.r;
        return t(`Die Rechnung hat eine Lösung, aber der ${links ? 'linke' : 'rechte'} Oberarm müsste auf ${z(w, 0)}° schwenken. Der PlotBot lässt dort nur ${z(r[0], 0)}° bis ${z(r[1], 0)}° zu.`,
          `The maths has a solution, but the ${seiteName(links)} upper arm would have to swing to ${z(w, 0)}°. PlotBot only allows ${z(r[0], 0)}° to ${z(r[1], 0)}° on that side.`);
      }
      case 'kreuz': return t('Die Rechnung hat eine Lösung, aber die beiden Oberarme würden sich kreuzen. Solche Punkte sperrt die Firmware.',
        'The maths has a solution, but the two upper arms would cross. The firmware blocks points like this.');
      default: return t('Die Rechnung hat eine Lösung, aber der Stift läge dann hinter den beiden Ellbogen statt davor. In dieser Lage arbeitet der PlotBot nicht.',
        'The maths has a solution, but the pen would end up behind the two elbows instead of in front of them. PlotBot doesn\'t work in that position.');
    }
  }

  /** Der Satz zum Konstruktionsschritt n (Zirkel und Lineal), mit den Zahlen des aktuellen Punkts. */
  function schrittText(L, n) {
    const g = I.G, geht = L.art !== 'weit' && L.art !== 'nah';
    if (n === 1) return t(`Stich den Zirkel in jeden Motor ein und zieh einen Kreis mit ${g.L1l} mm Radius, so lang wie der Oberarm. Auf diesen beiden Kreisen liegen alle Punkte, die ein Ellbogen erreichen kann.`,
      `Put the compass point on each motor and draw a circle with a ${g.L1l} mm radius, the length of the upper arm. These two circles hold every point an elbow can reach.`);
    if (n === 2) return t(`Wähle das Ziel: Zieh den Stift dorthin, wohin der Roboter fahren soll. Im Moment steht er auf ${punktText(L.P)}.`,
      `Pick the target: drag the pen to where the robot should go. Right now it's at ${punktText(L.P)}.`);
    if (n === 3) return t(`Zieh um das Ziel einen Kreis mit ${g.L2l} mm Radius, so lang wie der Unterarm. Jeder Ellbogen ist genau ${g.L2l} mm vom Stift entfernt, liegt also auf diesem Kreis.`,
      `Draw a circle with a ${g.L2l} mm radius around the target, the length of the forearm. Each elbow is exactly ${g.L2l} mm from the pen, so it sits on this circle.`);
    if (!geht) return t('Hier schneidet der graue Kreis nicht beide Motorkreise. Ein Ellbogen fehlt, der Punkt ist unerreichbar. Zieh den Stift zurück in die grüne Fläche.',
      'Here the grey circle doesn\'t cross both motor circles. An elbow is missing, so the point is out of reach. Drag the pen back into the green area.');
    if (n === 4) return t(`Der graue Kreis schneidet jeden Motorkreis zweimal. Nur an diesen vier Punkten stimmt beides: ${g.L1l} mm bis zum Motor und ${g.L2l} mm bis zum Stift. Für jeden Motor gibt es also zwei mögliche Ellbogen.`,
      `The grey circle crosses each motor circle twice. Only at these four points do both distances fit: ${g.L1l} mm to the motor and ${g.L2l} mm to the pen. So each motor has two possible elbows.`);
    if (n === 5) {
      const frage = t('Welche Ellbogen nimmt der Roboter? Wähle auf jedem Motorkreis einen der beiden Schnittpunkte aus. ', 'Which elbows does the robot use? Pick one of the two crossing points on each motor circle. ');
      if (wahl.l === 'innen' || wahl.r === 'innen') return frage + t('Dieser Punkt passt in der Zeichnung auch. Der Oberarm greift dann aber über den anderen Motor hinweg, und in großen Teilen der Zeichenfläche kreuzen sich die Arme. Probier den anderen Punkt auf demselben Kreis.',
        'This point fits the drawing too. But then the upper arm reaches across the other motor, and over large parts of the drawing area the arms cross. Try the other point on the same circle.');
      if (wahl.l && wahl.r) return t('Richtig: Der PlotBot nimmt für jeden Motor den äußeren Ellbogen, links den linken und rechts den rechten. So bleibt jeder Arm auf seiner Seite, und in der ganzen Zeichenfläche kommen sich die Arme nicht in die Quere.',
        'Correct: PlotBot uses the outer elbow for each motor, the left one on the left and the right one on the right. That keeps each arm on its own side, and the arms don\'t get in each other\'s way anywhere in the drawing area.');
      if (wahl.l || wahl.r) return frage + t(`Der Punkt auf dem ${wahl.l ? 'blauen' : 'orangen'} Kreis stimmt. Jetzt fehlt der andere Kreis.`, `The point on the ${wahl.l ? 'blue' : 'orange'} circle is correct. Now pick one on the other circle.`);
      return frage;
    }
    if (n === 6) return t('Verbinde die Punkte mit dem Lineal: vom Motor zum Ellbogen der Oberarm, vom Ellbogen zum Stift der Unterarm. So stehen die Arme, wenn der Stift am Ziel ist.',
      'Join the points with a ruler: the upper arm from the motor to the elbow, the forearm from the elbow to the pen. This is the position of the arms when the pen is at the target.');
    return t(`Leg an jeden Motor einen Winkelmesser, die Null zeigt nach rechts. Lies ab, wohin der Oberarm zeigt: links ${z(L.t1, 0)}°, rechts ${z(L.t2, 0)}°.`,
      `Place a protractor on each motor with zero pointing right. Read off where the upper arm points: ${z(L.t1, 0)}° on the left, ${z(L.t2, 0)}° on the right.`) +
      (L.t2 < 0 ? t(' Der rechte Oberarm zeigt unter die Grundlinie, deshalb ist sein Winkel negativ.', ' The right upper arm points below the baseline, so its angle is negative.') : '') +
      (L.art === 'ok' ? t(' Auf diese Winkel dreht der Roboter seine Motoren.', ' The robot turns its motors to these angles.')
        : t(' Der PlotBot fährt diesen Punkt aber nicht an. Warum, steht unter dem Bild.', ' PlotBot won\'t go to this point, though. The note below the picture says why.'));
  }

  /** Für Fortgeschrittene: dieselben Winkel aus dem Kosinussatz, mit den Zahlen des aktuellen Punkts. */
  function rechenText(L) {
    const g = I.G;
    if (L.t1 === undefined) return t('Für diesen Punkt gibt es kein Dreieck: Die Seiten passen nicht zusammen.', 'There is no triangle for this point: the sides don\'t fit together.');
    return t(`Links: c = ${z(L.l.c)} mm, daraus α = ${z(L.l.alpha)}°. Die Richtung zum Stift ist φ = ${z(L.l.phi)}°. Motorwinkel: φ + α = ${z(L.t1)}°. Rechts: c = ${z(L.r.c)} mm, α = ${z(L.r.alpha)}°, φ = ${z(L.r.phi)}°. Motorwinkel: φ − α = ${z(L.t2)}°. (Seiten: Oberarm ${g.L1l} mm, Unterarm ${g.L2l} mm.)`,
      `Left: c = ${z(L.l.c)} mm, which gives α = ${z(L.l.alpha)}°. The direction to the pen is φ = ${z(L.l.phi)}°. Motor angle: φ + α = ${z(L.t1)}°. Right: c = ${z(L.r.c)} mm, α = ${z(L.r.alpha)}°, φ = ${z(L.r.phi)}°. Motor angle: φ − α = ${z(L.t2)}°. (Sides: upper arm ${g.L1l} mm, forearm ${g.L2l} mm.)`);
  }

  // ---------- Aufgaben: Haken, sobald die Bedingung einmal erfüllt war ----------
  const AUFGABEN = {
    links90: L => L.art === 'ok' && Math.abs(L.t1 - 90) <= 0.5,
    mitte: L => L.art === 'ok' && Math.abs(L.P.x) < 0.25,
    hoch: L => L.art === 'ok' && L.P.y >= 150,
  };
  function pruefeAufgaben(L) {
    for (const li of document.querySelectorAll('[data-aufgabe]')) {
      const haken = li.querySelector('.ik-haken');
      if (haken && haken.hidden && AUFGABEN[li.dataset.aufgabe](L)) { haken.hidden = false; haken.textContent = haken.dataset.text; }
    }
  }

  function zeige(neu) {
    L = I.loese(P);
    const geht = L.t1 !== undefined;
    szene.innerHTML = I.szene(L, { schritt, flaeche: true, neu, wahl, dreieck: rechnen.open && schritt === 0 });
    griff.setAttribute('transform', `translate(${P.x} ${-P.y})`);
    griff.style.display = schritt === 1 ? 'none' : '';
    for (const k of knoepfe) {   // Schnittpunkte zum Anklicken, nur in Schritt 5
      const innen = k.dataset.wo === 'innen', links = k.dataset.seite === 'l';
      k.style.display = schritt === 5 && geht ? '' : 'none';
      if (!geht) continue;
      const E = innen ? (links ? L.innen.E1 : L.innen.E2) : (links ? L.E1 : L.E2);
      k.setAttribute('cx', E.x); k.setAttribute('cy', -E.y);
      k.setAttribute('aria-pressed', String(wahl[k.dataset.seite] === k.dataset.wo));
    }
    schreibe($('ik-rechen-text'), rechenText(L));
    if (document.activeElement !== inX) inX.value = P.x;
    if (document.activeElement !== inY) inY.value = P.y;
    schreibe(outL, geht ? z(L.t1) + '°' : '–');
    schreibe(outR, geht ? z(L.t2) + '°' : '–');
    schreibe(status, statusText(L));
    griff.setAttribute('aria-label', t(`Stift bei x ${k(P.x)}, y ${k(P.y)}. `, `Pen at x ${k(P.x)}, y ${k(P.y)}. `) +
      (geht ? t(`Motor links ${z(L.t1, 0)}°, rechts ${z(L.t2, 0)}°. `, `Left motor ${z(L.t1, 0)}°, right ${z(L.t2, 0)}°. `) : '') + griffHinweis);
    status.className = 'ik-status ' + (L.art === 'ok' ? 'gut' : 'schlecht');
    if (schritt) {
      schreibe($('ik-schritt-nr'), t(`Schritt ${schritt} von ${SCHRITTE}`, `Step ${schritt} of ${SCHRITTE}`));
      schreibe($('ik-schritt-text'), schrittText(L, schritt));
    }
    pruefeAufgaben(L);
  }

  function setze(x, y) {
    const V = I.VIEW, raste = v => Math.round(v * 2) / 2;
    P = { x: Math.min(V.x1, Math.max(V.x0, raste(x))), y: Math.min(V.y1, Math.max(V.y0, raste(y))) };
    zeige(false);
  }

  // ---------- Ziehen, Tippen, Tasten, Zahlen ----------
  function ort(ev) {
    const m = svg.getScreenCTM().inverse(), p = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(m);
    return { x: p.x, y: -p.y };
  }
  let zieht = false;
  griff.addEventListener('pointerdown', ev => { zieht = true; griff.setPointerCapture(ev.pointerId); ev.preventDefault(); griff.focus(); });
  griff.addEventListener('pointermove', ev => { if (zieht) { const p = ort(ev); setze(p.x, p.y); } });
  const ende = () => { zieht = false; };
  griff.addEventListener('pointerup', ende);
  griff.addEventListener('pointercancel', ende);
  // Tippen ins Bild setzt den Stift – nicht in Schritt 1 (noch kein Stift) und 5 (dort wählt man Schnittpunkte)
  svg.addEventListener('click', ev => { if (schritt !== 1 && schritt !== 5 && !griff.contains(ev.target)) { const p = ort(ev); setze(p.x, p.y); } });
  griff.addEventListener('keydown', ev => {
    const w = ev.shiftKey ? 10 : 1, d = { ArrowLeft: [-w, 0], ArrowRight: [w, 0], ArrowUp: [0, w], ArrowDown: [0, -w] }[ev.key];
    if (!d) return;
    ev.preventDefault();
    setze(P.x + d[0], P.y + d[1]);
  });
  for (const el of [inX, inY]) el.addEventListener('input', () => {
    const x = parseFloat(inX.value), y = parseFloat(inY.value);
    if (isFinite(x) && isFinite(y)) setze(x, y);
  });
  for (const el of [inX, inY]) el.addEventListener('change', () => { inX.value = P.x; inY.value = P.y; });   // begrenzten Wert zurückschreiben

  // ---------- Frei ziehen oder Schritt für Schritt ----------
  const bFrei = $('ik-frei'), bSchritt = $('ik-schrittweise'), feld = $('ik-schritte'), zurueck = $('ik-zurueck'), weiter = $('ik-weiter');
  function geheZu(n) {
    schritt = n;
    bFrei.setAttribute('aria-pressed', String(n === 0));
    bSchritt.setAttribute('aria-pressed', String(n !== 0));
    feld.hidden = n === 0;
    zurueck.disabled = n <= 1;
    weiter.disabled = n >= SCHRITTE;
    zeige(true);
  }
  bFrei.addEventListener('click', () => geheZu(0));
  bSchritt.addEventListener('click', () => geheZu(schritt || 1));
  zurueck.addEventListener('click', () => geheZu(Math.max(1, schritt - 1)));
  weiter.addEventListener('click', () => geheZu(Math.min(SCHRITTE, schritt + 1)));

  for (const k of knoepfe) {
    const waehle = () => { wahl[k.dataset.seite] = k.dataset.wo; zeige(false); };
    k.addEventListener('click', ev => { ev.stopPropagation(); waehle(); });
    k.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); waehle(); } });
  }
  rechnen.addEventListener('toggle', () => zeige(false));

  box.hidden = false;
  for (const el of document.querySelectorAll('.ik-nur-js')) el.hidden = false;
  geheZu(0);
})();
