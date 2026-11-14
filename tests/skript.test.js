// Tests für den JavaScript-Modus von „Im Browser ausprobieren“ (js/try/skript.js, js/try/block-js.js).
// Aufruf: node --test tests/*.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Schildkroete, Skript, BlockJs, DEMOS, FELD, startVon, laufe, laufende } = require('./hilfe.js');

const baum = (programm, startwert) => Schildkroete.ausfuehren(startVon(programm), FELD, startwert);

test('Drucker: jedes Beispiel zeichnet als JavaScript dieselben Striche wie als Blöcke', async () => {
  for (const sprache of ['de', 'en']) for (const demo of DEMOS) for (const startwert of [1, 4711]) {
    const js = BlockJs.alsJavaScript(demo.programm, { sprache });
    const soll = baum(demo.programm, startwert);
    const ist = await laufe(js, { startwert, sprache });
    assert.equal(soll.fehler, null, demo.name);
    assert.equal(ist.fehler, null, `${demo.name} (${sprache}): ${ist.fehler}\n${js}`);
    assert.deepEqual(ist.striche, soll.striche, `${demo.name} (${sprache})`);
    assert.deepEqual(ist.schildkroete, soll.schildkroete, `${demo.name} (${sprache})`);
    assert.equal(ist.zufall, Schildkroete.enthaeltZufall(startVon(demo.programm)), demo.name);
  }
});

test('Drucker: das Quadrat ist die for-Schleife aus der Hilfe, deutsch und englisch', () => {
  assert.equal(BlockJs.alsJavaScript(DEMOS[0].programm), 'for (let i = 0; i < 4; i++) {\n  vorwaerts(20);\n  rechts(90);\n}\n');
  assert.equal(BlockJs.alsJavaScript(DEMOS[0].programm, { sprache: 'en' }), 'for (let i = 0; i < 4; i++) {\n  forward(20);\n  right(90);\n}\n');
  for (const [datei, code] of [['de/ausprobieren/index.html', 'vorwaerts(20);\n  rechts(90);'], ['en/try/index.html', 'forward(20);\n  right(90);']])
    assert.ok(fs.readFileSync(path.join(__dirname, '..', datei), 'utf8').includes(`for (let i = 0; i &lt; 4; i++) {\n  ${code}\n}`), datei);
});

test('Hilfe: jede Funktion steht auf beiden Seiten', () => {
  for (const datei of ['de/ausprobieren/index.html', 'en/try/index.html']) {
    const html = fs.readFileSync(path.join(__dirname, '..', datei), 'utf8');
    for (const [, de, en] of Skript.NAMEN) for (const name of [de, en]) assert.match(html, new RegExp(`<code>${name}[(<]`), `${datei}: ${name}`);
  }
});

// ---- Zufällige Blockprogramme: Baum und gedrucktes JavaScript müssen dieselben Striche liefern ----

function zufallsprogramm(startwert) {
  let z = startwert >>> 0;
  const r = () => { z = (Math.imul(z, 1664525) + 1013904223) >>> 0; return z / 4294967296; };
  const ganz = (a, b) => a + Math.floor(r() * (b - a + 1));
  const aus = liste => liste[ganz(0, liste.length - 1)];
  const VARIABLEN = ['a', 'länge', 'meine Zahl', 'x', 'for'];   // auch Namen, die in JavaScript so nicht gehen
  const num = n => ({ type: 'math_number', fields: { NUM: n } });
  const ein = b => (b.type === 'math_number' && r() < 0.8 ? { shadow: b } : { block: b });
  const blk = (type, inputs, fields, extra) => ({ type, ...(fields ? { fields } : {}), ...(inputs ? { inputs } : {}), ...extra });
  const variable = () => ({ VAR: { id: aus(VARIABLEN) } });
  function zahl(tiefe) {
    const w = r();
    if (tiefe <= 0 || w < 0.4) return num(aus([0, 1, 2, 3, 5, 7.5, 10, 12, 20, 45, 90, 120, 144, -3, -10, 0.1, 1.6]));
    if (w < 0.55) return blk('variables_get', null, variable());
    if (w < 0.8) return blk('math_arithmetic', { A: ein(zahl(tiefe - 1)), B: ein(zahl(tiefe - 1)) }, { OP: aus(['ADD', 'MINUS', 'MULTIPLY', 'DIVIDE']) });
    if (w < 0.9) return blk('math_random_int', { FROM: ein(zahl(tiefe - 1)), TO: ein(zahl(tiefe - 1)) });
    return blk(aus(['zr_x', 'zr_y', 'zr_richtung']));
  }
  function frage(tiefe) {
    const w = r();
    if (tiefe <= 0 || w < 0.2) return aus([blk('zr_am_rand'), blk('logic_boolean', null, { BOOL: aus(['TRUE', 'FALSE']) })]);
    if (w < 0.6) return blk('logic_compare', { A: ein(zahl(tiefe - 1)), B: ein(zahl(tiefe - 1)) }, { OP: aus(['EQ', 'NEQ', 'LT', 'LTE', 'GT', 'GTE']) });
    if (w < 0.85) return blk('logic_operation', { A: ein(frage(tiefe - 1)), B: ein(frage(tiefe - 1)) }, { OP: aus(['AND', 'OR']) });
    return blk('logic_negate', { BOOL: ein(frage(tiefe - 1)) });
  }
  const folge = bloecke => bloecke.reduceRight((next, b) => (next ? { ...b, next: { block: next } } : b), null);
  const innen = tiefe => { const b = stapel(tiefe, ganz(0, 3)); return b ? { block: b } : undefined; };
  function befehl(tiefe) {
    const w = r();
    if (w < 0.25 || tiefe <= 0) return blk('zr_vorwaerts', { WEG: ein(zahl(2)) });
    if (w < 0.4) return blk('zr_drehe', { WINKEL: ein(zahl(2)) }, { RICHTUNG: aus(['RECHTS', 'LINKS']) });
    if (w < 0.48) return blk('zr_gehe_zu', { X: ein(zahl(1)), Y: ein(zahl(1)) });
    if (w < 0.54) return blk(aus(['zr_stift_ab', 'zr_stift_auf']));
    if (w < 0.62) return blk('variables_set', { VALUE: ein(zahl(2)) }, variable());
    if (w < 0.68) return blk('math_change', { DELTA: ein(zahl(1)) }, variable());
    if (w < 0.78) return blk('controls_repeat_ext', { TIMES: ein(r() < 0.7 ? num(aus([0, 1, 2, 3, 4, 2.5])) : zahl(1)), DO: innen(tiefe - 1) });
    if (w < 0.88) {
      const glatt = r() < 0.6, kopf = () => (glatt ? num(ganz(-3, 6)) : zahl(1));
      return blk('controls_for', { FROM: ein(kopf()), TO: ein(kopf()), BY: ein(glatt ? num(aus([1, 1, 2, -2, 3])) : zahl(1)), DO: innen(tiefe - 1) }, variable());
    }
    const sonstWenn = ganz(0, 2), sonst = r() < 0.5, eingaenge = {};
    for (let i = 0; i <= sonstWenn; i++) { eingaenge[`IF${i}`] = ein(frage(2)); eingaenge[`DO${i}`] = innen(tiefe - 1); }
    if (sonst) eingaenge.ELSE = innen(tiefe - 1);
    return blk('controls_if', eingaenge, null, sonstWenn || sonst ? { extraState: { ...(sonstWenn ? { elseIfCount: sonstWenn } : {}), ...(sonst ? { hasElse: true } : {}) } } : {});
  }
  function stapel(tiefe, anzahl) { return folge(Array.from({ length: anzahl }, () => befehl(tiefe))); }
  const programm = { type: 'zr_start', next: { block: stapel(3, ganz(1, 6)) } };
  return JSON.parse(JSON.stringify({ blocks: { languageVersion: 0, blocks: [programm] }, variables: VARIABLEN.map(v => ({ name: v, id: v })) }));
}

// Im Test ohne Worker: dieselbe Schildkröte (Skript.kern), das gedruckte Programm als Funktion. So laufen viele Programme schnell.
function ohneWorker(js, startwert) {
  const k = Skript.kern(FELD, startwert, Schildkroete, Skript.TEXTE.de, Skript.NAMEN, 1);
  let fehler = null;
  try { new Function(...Object.keys(k.api), `'use strict';\n${js}`)(...Object.values(k.api)); } catch (e) {
    if (!(e instanceof k.Abbruch)) throw new Error(`${e.message}\n${js}`);
    fehler = e.message;
  }
  return { ...k.ergebnis(), fehler };
}

test('Drucker: 400 zufällige Blockprogramme zeichnen als JavaScript dieselben Striche', () => {
  let ohneFehler = 0;
  for (let n = 1; n <= 400; n++) {
    const programm = zufallsprogramm(n);
    const soll = baum(programm, n);
    const js = BlockJs.alsJavaScript(programm);
    const ist = ohneWorker(js, n);
    if (soll.fehler) continue;   // etwa geteilt durch 0: Der Baum hält an, das Ergebnis ist kein Programm zum Vergleichen
    ohneFehler++;
    assert.equal(ist.fehler, null, `Programm ${n}: ${ist.fehler}\n${js}`);
    assert.deepEqual(ist.striche, soll.striche, `Programm ${n}\n${js}`);
    assert.deepEqual(ist.schildkroete, soll.schildkroete, `Programm ${n}\n${js}`);
  }
  assert.ok(ohneFehler > 200, `nur ${ohneFehler} Programme ohne Fehler: Der Test prüft zu wenig`);
});

test('Drucker: Sonderfälle', () => {
  const z = n => ({ shadow: { type: 'math_number', fields: { NUM: n } } });
  const start = (...b) => ({ blocks: { blocks: [{ type: 'zr_start', next: { block: b.reduceRight((next, x) => (next ? { ...x, next: { block: next } } : x), null) } }] },
    variables: [{ name: 'meine Zahl', id: 'v1' }, { name: 'x', id: 'v2' }] });
  const hol = id => ({ block: { type: 'variables_get', fields: { VAR: { id } } } });
  // Namen werden gültig und stoßen nicht mit den Funktionen zusammen; eine Variable, die auch außerhalb vorkommt, steht oben.
  assert.equal(BlockJs.alsJavaScript(start({ type: 'variables_set', fields: { VAR: { id: 'v1' } }, inputs: { VALUE: z(5) } },
    { type: 'controls_for', fields: { VAR: { id: 'v2' } }, inputs: { FROM: z(1), TO: hol('v1'), BY: z(1), DO: { block: { type: 'zr_vorwaerts', inputs: { WEG: hol('v2') } } } } })),
  'let meine_Zahl = 0;\n\nmeine_Zahl = 5;\nfor (let x_ of zaehle(1, meine_Zahl)) {\n  vorwaerts(x_);\n}\n');
  // Leerer Eingang, sonst-wenn, Kommentar mit Zeilentrenner, Klammern nur wo nötig.
  const rechne = (OP, A, B) => ({ block: { type: 'math_arithmetic', fields: { OP }, inputs: { A, B } } });
  const text = BlockJs.alsJavaScript(start(
    { type: 'controls_if', extraState: { elseIfCount: 1, hasElse: true }, inputs: { IF1: { block: { type: 'zr_am_rand' } }, DO1: { block: { type: 'zr_stift_auf' } } } },
    { type: 'zr_vorwaerts', icons: { comment: { text: 'eins vorwaerts(99)' } }, inputs: { WEG: rechne('MINUS', z(10), rechne('MINUS', z(3), z(-2))) } },
    { type: 'zr_vorwaerts', enabled: false, inputs: { WEG: z(1) } },
    { type: 'zr_drehe', fields: { RICHTUNG: 'LINKS' }, inputs: { WINKEL: rechne('MULTIPLY', rechne('ADD', z(1), z(2)), z(3)) } }));
  assert.equal(text, 'if (undefined /* hier fehlt ein Wert */) {\n} else if (amRand()) {\n  stiftAuf();\n} else {\n}\n// eins\n// vorwaerts(99)\n'
    + 'vorwaerts(10 - (3 - (-2)));\n// (ausgeschaltet)\nlinks((1 + 2) * 3);\n');
  assert.equal(BlockJs.alsJavaScript(null), '');
  assert.equal(BlockJs.alsJavaScript({ blocks: { blocks: [{ type: 'zr_start' }] } }), '');
});

// ---- Ausführen im Worker ----

test('Programm: Schleifen, Variablen, eigene Funktionen, deutsche und englische Namen', async () => {
  const r = await laufe('function seite(n) { vorwaerts(n); right(90); }\nlet x = 20;\nfor (const i of zaehle(1, 4)) seite(x);\npenUp(); goTo(10, 10); stiftAb(); vorwärts(5);');
  assert.equal(r.fehler, null);
  // In 1/10 mm Maschinenkoordinaten, so wie die Striche gesendet würden (Feld beginnt bei x −40, y 35).
  assert.equal(Schildkroete.stricheText(r.striche, FELD), '0,750 0,950 200,950 200,750 0,750|-300,450 -300,500');
});

test('Zeitlimit: Eine Endlosschleife wird abgebrochen und der Worker beendet', async () => {
  const start = Date.now();
  const r = await laufe('while (true) {}', { zeitlimit: 300 });
  assert.match(r.fehler, /^Nach 0,3 Sekunden abgebrochen/);
  assert.ok(Date.now() - start < 2000);
  assert.equal(laufende.size, 0, 'Worker läuft noch');
  assert.equal(Skript.ZEITLIMIT_MS, 2000);
});

test('Grenzen: zu viele Punkte und zu viele Schritte halten mit Zeile an', async () => {
  const punkte = await laufe('rechts(1);\nfor (;;) {\n  vorwaerts(1);\n  rechts(7);\n}');
  assert.equal(punkte.fehler, `Zeile 3: Zu viele Punkte: höchstens ${Schildkroete.PUNKTE_MAX}. Weniger Wiederholungen oder längere Striche.`);
  assert.equal(punkte.zeile, 3);
  const schritte = await laufe('for (;;) rechts(1);');
  assert.match(schritte.fehler, new RegExp(`^Zeile 1: Zu viele Schritte: höchstens ${Schildkroete.SCHRITTE_MAX}`));
  const feld = await laufe('geheZu(200, 40);');
  assert.equal(Schildkroete.pruefen(feld, FELD).sendbar, false);   // außerhalb: derselbe Weg wie bei den Blöcken
});

test('Sperre: Im Worker sind Netz, Speicher, Timer, eval und Function nicht mehr erreichbar', async () => {
  const namen = [...Skript.GEFAEHRLICH, 'Buffer', 'setImmediate', 'structuredClone', 'performance', 'crypto', 'AbortController'];
  const r = await laufe(`const da = ${JSON.stringify(namen)}.filter(n => { try { return globalThis[n] !== undefined; } catch { return true; } });
const bauer = [function () {}, () => 1, async () => 1, function* () {}, class {}].map(f => String(f.constructor));
let kette = 0;
for (let o = Object.getPrototypeOf(globalThis); o && o !== Object.prototype; o = Object.getPrototypeOf(o)) kette += Reflect.ownKeys(o).filter(k => { try { return o[k] !== undefined; } catch { return true; } }).length;
const rest = Object.getOwnPropertyNames(globalThis).filter(n => globalThis[n] !== undefined && !${JSON.stringify([...Skript.ERLAUBT, ...Skript.NAMEN.flat()])}.includes(n));
throw new Error(JSON.stringify({ da, bauer, kette, rest }));`);
  const bericht = JSON.parse(r.fehler.replace('Fehler in Zeile 6: ', ''));
  assert.deepEqual(bericht, { da: [], bauer: ['undefined', 'undefined', 'undefined', 'undefined', 'undefined'], kette: 0, rest: [] });
  // Die Funktionen der Schildkröte lassen sich nicht austauschen.
  const fest = await laufe('globalThis.vorwaerts = () => {};');
  assert.match(fest.fehler, /^Fehler in Zeile 1: /);
});

test('Sperre: import wird schon am Quelltext abgewiesen, zu langer Code auch', async () => {
  const r = await laufe('vorwaerts(1);\nconst m = import("node:fs");');
  assert.equal(r.fehler, 'Zeile 2: ‚import‘ geht hier nicht: Das Programm darf nichts nachladen.');
  assert.deepEqual(r.striche, []);
  assert.equal(laufende.size, 0);
  assert.match((await laufe(`//${'x'.repeat(Skript.CODE_MAX)}`)).fehler, /^Das Programm ist zu lang/);
});

test('Fehler: Zeilennummer und Erklärung für die häufigen Fälle, sonst die Meldung des Browsers', async () => {
  const fall = async (code, o) => { const r = await laufe(code, o); return [r.zeile, r.fehler]; };
  assert.deepEqual(await fall('vorwaerts(20);\n\nvorwarts(20);'), [3, 'Zeile 3: Den Namen ‚vorwarts‘ kenne ich nicht. Vertippt? Groß- und Kleinschreibung zählen. Meinst du ‚vorwaerts‘?']);
  assert.deepEqual(await fall('Forward(20);', { sprache: 'en' }), [1, 'Line 1: I don\'t know the name "Forward". A typo? Upper and lower case matter. Did you mean "forward"?']);
  assert.deepEqual(await fall('foo(3);'), [1, 'Zeile 1: Den Namen ‚foo‘ kenne ich nicht. Vertippt? Groß- und Kleinschreibung zählen.']);
  assert.deepEqual(await fall('for (let i = 0; i < 3; i++) {\n  rechts(90;\n}'), [2, 'Zeile 2: Hier stimmt eine Klammer nicht. Zu jeder ( gehört eine ), zu jeder { eine }.']);
  assert.deepEqual(await fall('if (true) {\n  vorwaerts(3);'), [2, 'Zeile 2: Am Ende fehlt eine Klammer. Zu jeder { gehört eine }, zu jeder ( eine ).']);
  assert.deepEqual(await fall('vorwaerts(1);\n}\nvorwaerts(2);'), [3, 'Zeile 3: Das versteht JavaScript nicht (Unexpected identifier \'vorwaerts\'). '
    + 'Fehlt hier oder in der Zeile davor eine Klammer, ein Komma oder ein Anführungszeichen?']);
  assert.deepEqual(await fall('let a = 5;\na();'), [2, 'Zeile 2: ‚a‘ ist keine Funktion, die man aufrufen kann.']);
  assert.deepEqual(await fall('vorwaerts("zwanzig");'), [1, 'Zeile 1: ‚vorwaerts‘ braucht eine Zahl.']);
  assert.deepEqual(await fall('\nnull.x;'), [2, 'Fehler in Zeile 2: Cannot read properties of null (reading \'x\')']);
  assert.deepEqual(await fall('throw 5;'), [0, 'Fehler: 5']);
  assert.equal(laufende.size, 0);
});

test('Ergebnis aus dem Worker wird geprüft, bevor die Seite damit rechnet', () => {
  const gut = { striche: [[[0, 0], [1, 1]]], schildkroete: { x: 1, y: 1, richtung: 90, stiftUnten: true } };
  assert.equal(Skript.gueltig(gut, Schildkroete), true);
  for (const striche of [null, [[[0, 0]]], [[[0, 0], [1, NaN]]], [[[0, 0], [1, '1']]], [[[0, 0], [1, 1, 1]]], ['ab'],
    [Array.from({ length: Schildkroete.PUNKTE_MAX + 1 }, () => [0, 0])]])
    assert.equal(Skript.gueltig({ ...gut, striche }, Schildkroete), false, JSON.stringify(striche).slice(0, 40));
  assert.equal(Skript.gueltig({ ...gut, schildkroete: { x: 1, y: Infinity, richtung: 0, stiftUnten: true } }, Schildkroete), false);
});
