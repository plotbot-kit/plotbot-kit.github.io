#!/usr/bin/env node
/* Erzeugt die festen Abbildungen der Seite „Inverse Kinematik verstehen“ (deutsch und englisch).
   Lädt muster.js, kern.js und ik-bild.js wie der Browser und zeichnet mit demselben Code wie die Lernfigur.
   Ersetzt in beiden Seiten den Inhalt zwischen <!-- ik-fig:NAME --> und <!-- /ik-fig:NAME -->.
   Schreibt außerdem das Arbeitsblatt (arbeitsblatt.html / worksheet.html, A4, Maßstab 1:1) neu.
   Aufruf aus dem Wurzelverzeichnis: node tools/ik-figuren.js
   Danach die PDF-Fassungen des Arbeitsblatts: siehe tools/ik-arbeitsblatt-pdf.sh */
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');
const wurzel = path.join(__dirname, '..');
const BEISPIEL = { x: 30, y: 100 };   // der Punkt, den der Text der Seite durchrechnet

function lade(lang) {
  const w = { document: { documentElement: { lang } }, Math, console };
  w.window = w;
  const ctx = vm.createContext(w);
  for (const f of ['muster.js', 'kern.js', 'ik-bild.js']) {
    vm.runInContext(fs.readFileSync(path.join(wurzel, 'js/kinematik', f), 'utf8'), ctx, { filename: f });
  }
  return w.IKBild;
}

// Bildbeschreibungen (alt-Texte) je Abbildung: [deutsch, englisch]
const ALT = {
  aufbau: ['Draufsicht auf den PlotBot: unten zwei Motorwellen im Abstand von 36 mm. Von jeder geht ein 65 mm langer Oberarm schräg nach außen, daran hängt ein 90 mm langer Unterarm. Beide Unterarme treffen sich oben im Stift. An jedem Motor ist der Winkel zwischen der Grundlinie und dem Oberarm eingezeichnet: links 119°, rechts 22°.',
    'Top view of PlotBot: two motor shafts at the bottom, 36 mm apart. A 65 mm upper arm points outward from each, with a 90 mm forearm attached. The two forearms meet at the pen at the top. At each motor the angle between the baseline and the upper arm is marked: 119° on the left, 22° on the right.'],
  s1: ['Schritt 1: um jede der beiden Motorwellen ein gestrichelter Kreis mit 65 mm Radius, links blau, rechts orange. Die Kreise überlappen sich.',
    'Step 1: a dashed circle with a 65 mm radius around each of the two motor shafts, blue on the left, orange on the right. The circles overlap.'],
  s2: ['Schritt 2: Zu den beiden Kreisen kommt der Zielpunkt des Stifts, rechts oben im gestrichelten Quadrat der Zeichenfläche.',
    'Step 2: the pen\'s target point is added to the two circles, in the upper right of the dashed square of the drawing area.'],
  s3: ['Schritt 3: ein grauer gestrichelter Kreis mit 90 mm Radius um den Zielpunkt. Er schneidet beide Motorkreise.',
    'Step 3: a grey dashed circle with a 90 mm radius around the target point. It crosses both motor circles.'],
  s4: ['Schritt 4: Vier Schnittpunkte sind markiert, zwei auf dem blauen Kreis des linken Motors und zwei auf dem orangen Kreis des rechten Motors. Auf jedem Kreis liegt ein Punkt außen und einer jenseits des anderen Motors.',
    'Step 4: four crossing points are marked, two on the left motor\'s blue circle and two on the right motor\'s orange circle. On each circle one point lies on the outside and one beyond the other motor.'],
  s5: ['Schritt 5: Die beiden äußeren Schnittpunkte sind grün ausgefüllt und mit kräftigen Armen verbunden. Die Arme zu den beiden anderen Punkten sind blass gestrichelt; sie kreuzen sich über den Motoren.',
    'Step 5: the two outer crossing points are filled green and joined up with bold arms. The arms to the other two points are faint and dashed; they cross above the motors.'],
  s6: ['Schritt 6: Von jedem Motor führt ein Oberarm zum äußeren Ellbogen und von dort ein Unterarm zum Stift. Die Hilfskreise sind noch zu sehen.',
    'Step 6: from each motor an upper arm leads to the outer elbow, and from there a forearm to the pen. The construction circles are still visible.'],
  s7: ['Schritt 7: Um jeden Motor liegt ein Winkelmesser. Der linke Oberarm zeigt auf 119°, der rechte auf 22°.',
    'Step 7: a protractor sits around each motor. The left upper arm points to 119°, the right one to 22°.'],
  dreieck: ['Das Dreieck aus linkem Motor, Ellbogen und Stift mit den Seiten 65, 90 und c. Am Motor liegen zwei Winkel übereinander: φ von der Grundlinie bis zur Linie zum Stift, darüber α bis zum Oberarm.',
    'The triangle of left motor, elbow and pen with sides 65, 90 and c. Two angles stack at the motor: φ from the baseline to the line towards the pen, and above it α up to the upper arm.'],
  flaeche: ['Die erreichbare Fläche in Grün: ein breiter, nach oben gewölbter Bereich vor dem Roboter. Er beginnt knapp 20 mm vor den Motoren und reicht bis etwa 154 mm nach vorn. Das gestrichelte Quadrat der Zeichenfläche liegt ganz darin.',
    'The reachable area in green: a wide region in front of the robot, arched at the top. It starts just under 20 mm in front of the motors and extends to about 154 mm forward. The dashed square of the drawing area lies entirely inside it.'],
};

function figuren(lang) {
  const I = lade(lang), en = lang === 'en', L = I.loese(BEISPIEL), V = I.VIEW;
  const svg = (name, inhalt) => `<svg class="ikz" viewBox="${V.x0} ${-V.y1} ${V.x1 - V.x0} ${V.y1 - V.y0}" role="img" aria-label="${ALT[name][en ? 1 : 0].replace(/"/g, '&quot;')}">${inhalt}</svg>`;
  const lbl = (x, y, s, cls, anker) => `<text class="lbl ${cls || ''}" x="${x.toFixed(1)}" y="${(-y).toFixed(1)}" text-anchor="${anker || 'middle'}">${s}</text>`;
  const mitte = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  const o = mitte(I.A, L.E1), u = mitte(L.E1, L.P), o2 = mitte(I.B, L.E2), u2 = mitte(L.E2, L.P);
  const aufbau = I.szene(L, { schritt: 0 }) +
    lbl(o.x - 6, o.y - 2, en ? 'upper arm 65' : 'Oberarm 65', 'kl-l', 'end') + lbl(u.x - 6, u.y + 4, en ? 'forearm 90' : 'Unterarm 90', '', 'end') +
    lbl(o2.x + 8, o2.y - 13, '65', 'kl-r', 'start') + lbl(u2.x + 6, u2.y + 2, '90', '', 'start') +
    lbl(L.P.x, L.P.y + 9, en ? 'pen' : 'Stift', 'kl-stift') + lbl(0, -22, '36 mm', '');
  const f = { aufbau: svg('aufbau', aufbau), flaeche: svg('flaeche', I.szene(L, { schritt: 0, flaeche: true })),
    dreieck: svg('dreieck', I.szene(L, { schritt: 0, dreieck: true })) };
  for (let n = 1; n <= 7; n++) f['s' + n] = svg('s' + n, I.szene(L, { schritt: n, wahl: { l: 'aussen', r: 'aussen' }, innenZeigen: true }));
  return { f, L, I };
}

// ---------- Arbeitsblatt zum Ausdrucken: Maßstab 1:1, A4 hoch ----------
const ZIELE = [['A', 0, 75], ['B', 30, 100], ['C', -30, 90]];
const BLATT = {
  de: { datei: 'de/kinematik/verstehen/arbeitsblatt.html', titel: 'Arbeitsblatt: Motorwinkel mit Zirkel und Geodreieck finden',
    zurueck: 'Zur Seite „Inverse Kinematik verstehen“', druck: 'Drucken Sie in Originalgröße (100 %, nicht „an Seite anpassen“). Die Kontrollstrecke unten rechts muss 50 mm messen.',
    schritte: ['Zirkel auf 65 mm stellen (Oberarm). Um jeden Motor einen Kreis ziehen.', 'Zirkel auf 90 mm stellen (Unterarm). In das Ziel A einstechen und einen Bogen ziehen, der beide Motorkreise schneidet.',
      'Der Bogen schneidet jeden Motorkreis zweimal. Auf jedem Kreis den äußeren Schnittpunkt markieren (beim linken Motor den linken): Das ist der Ellbogen.',
      'Mit dem Lineal verbinden: Motor – Ellbogen – Ziel.', 'Winkel am Motor messen, die Null zeigt nach rechts. In die Tabelle eintragen. Dann dasselbe für B und C.'],
    ziel: 'Ziel', links: 'Motor links', rechts: 'Motor rechts', feld: 'Zeichenfläche 80 × 80 mm', kontrolle: 'Kontrolle: 50 mm', masse: 'PlotBot von oben, Maßstab 1:1. Oberarm 65 mm, Unterarm 90 mm, Motoren 36 mm auseinander.' },
  en: { datei: 'en/kinematics/explained/worksheet.html', titel: 'Worksheet: find the motor angles with a compass and protractor',
    zurueck: 'Back to “Understanding inverse kinematics”', druck: 'Print at actual size (100%, not “fit to page”). The check line at the bottom right has to measure 50 mm.',
    schritte: ['Set the compass to 65 mm (upper arm). Draw a circle around each motor.', 'Set the compass to 90 mm (forearm). Put the point on target A and draw an arc that crosses both motor circles.',
      'The arc crosses each motor circle twice. On each circle mark the outer crossing point (the left one for the left motor): that\'s the elbow.',
      'Join them up with a ruler: motor – elbow – target.', 'Measure the angle at each motor with zero pointing right. Write it in the table. Then do the same for B and C.'],
    ziel: 'Target', links: 'Left motor', rechts: 'Right motor', feld: 'Drawing area 80 × 80 mm', kontrolle: 'Check: 50 mm', masse: 'PlotBot from above, scale 1:1. Upper arm 65 mm, forearm 90 mm, motors 36 mm apart.' },
};

function arbeitsblatt(lang, I) {
  const T = BLATT[lang], F = I.FELD, x0 = -90, x1 = 90, y0 = -70, y1 = 125;
  const kreuz = (x, y, r) => `<path d="M${x - r} ${-y}h${2 * r}M${x} ${-y - r}v${2 * r}"/>`;
  let g = `<line class="strich" x1="${x0}" y1="0" x2="${x1}" y2="0"/><rect class="strich" x="${F.x0}" y="${-F.y1}" width="${F.x1 - F.x0}" height="${F.y1 - F.y0}"/>`;
  g += `<text x="${F.x0 + 2}" y="${-F.y1 - 2}">${T.feld}</text>`;
  for (const [W, name, anker, dx] of [[I.A, T.links, 'end', -4], [I.B, T.rechts, 'start', 4]]) {
    g += kreuz(W.x, W.y, 3) + `<circle cx="${W.x}" cy="0" r="1.2"/><text x="${W.x + dx}" y="8" text-anchor="${anker}">${name}</text>`;
  }
  for (const [n, x, y] of ZIELE) g += kreuz(x, y, 2.5) + `<text class="fett" x="${x + 4}" y="${-y - 3}">${n}</text>`;
  g += `<path d="M40 67h50M40 65v4M90 65v4"/><text x="65" y="63" text-anchor="middle">${T.kontrolle}</text>`;
  const zeilen = ZIELE.map(z => `<tr><th scope="row">${z[0]}</th><td></td><td></td></tr>`).join('');
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${T.titel} | PlotBot-Kit</title>
<link rel="canonical" href="https://plotbot-kit.github.io/${T.datei}">
<link rel="icon" href="../../../img/blume.svg" type="image/svg+xml">
<style>
/* Erzeugt von tools/ik-figuren.js – nicht von Hand ändern */
@page { size: A4 portrait; margin: 0; }
body { margin: 0; font: 3.6mm/1.35 system-ui, -apple-system, "Segoe UI", Arial, sans-serif; color: #000; }
.blatt { width: 210mm; box-sizing: border-box; padding: 11mm 15mm 0; }
h1 { font-size: 5.4mm; margin: 0 0 1.5mm; }
p, ol { margin: 0 0 1.5mm; } ol { padding-left: 5mm; }
.kopf { display: grid; grid-template-columns: 1fr 58mm; gap: 6mm; }
table { border-collapse: collapse; width: 100%; } th, td { border: .3mm solid #000; padding: 1mm 1.5mm; height: 6.5mm; text-align: left; }
svg { display: block; width: 180mm; height: 195mm; }
svg path, svg line, svg rect, svg circle { stroke: #000; stroke-width: .3; fill: none; }
svg circle { fill: #000; } svg .strich { stroke-dasharray: 2 1.5; stroke-width: .2; }
svg text { font-size: 3.4px; fill: #000; } svg .fett { font-weight: 700; font-size: 4.2px; }
.nav { font-size: 3.4mm; }
@media print { .nav { display: none; } }
@media screen and (max-width: 210mm) { .blatt { width: auto; padding: 4mm; } svg { width: 100%; height: auto; } .kopf { grid-template-columns: 1fr; } }
</style>
</head>
<body>
<main class="blatt">
<p class="nav"><a href="./">← ${T.zurueck}</a> · ${T.druck}</p>
<h1>${T.titel}</h1>
<div class="kopf">
<div><p>${T.masse}</p><ol>${T.schritte.map(x => `<li>${x}</li>`).join('')}</ol></div>
<table><tr><th scope="col">${T.ziel}</th><th scope="col">${T.links}</th><th scope="col">${T.rechts}</th></tr>${zeilen}</table>
</div>
<svg viewBox="${x0} ${-y1} ${x1 - x0} ${y1 - y0}" role="img" aria-label="${T.masse}">${g}</svg>
</main>
</body>
</html>
`;
}

const SEITEN = { de: 'de/kinematik/verstehen/index.html', en: 'en/kinematics/explained/index.html' };
for (const [lang, datei] of Object.entries(SEITEN)) {
  const pfad = path.join(wurzel, datei), { f, L, I } = figuren(lang);
  let html = fs.readFileSync(pfad, 'utf8'), n = 0;
  for (const [name, svg] of Object.entries(f)) {
    const re = new RegExp(`(<!-- ik-fig:${name} -->)[\\s\\S]*?(<!-- /ik-fig:${name} -->)`);
    if (!re.test(html)) throw new Error(`${datei}: Marke ik-fig:${name} fehlt`);
    html = html.replace(re, (m, a, b) => a + svg + b); n++;
  }
  fs.writeFileSync(pfad, html);
  const r = v => v.toFixed(1);
  console.log(`${datei}: ${n} Abbildungen. Beispiel (${BEISPIEL.x}|${BEISPIEL.y}): links c ${r(L.l.c)}, φ ${r(L.l.phi)}, α ${r(L.l.alpha)}, Winkel ${r(L.t1)}; rechts c ${r(L.r.c)}, φ ${r(L.r.phi)}, α ${r(L.r.alpha)}, Winkel ${r(L.t2)}`);
  fs.writeFileSync(path.join(wurzel, BLATT[lang].datei), arbeitsblatt(lang, I));
  console.log('  Arbeitsblatt: ' + ZIELE.map(z => { const l = I.loese({ x: z[1], y: z[2] }); return `${z[0]} (${z[1]}|${z[2]}) ${l.art} links ${r(l.t1)} rechts ${r(l.t2)}`; }).join('; '));
}
