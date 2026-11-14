// Tests für die zweisprachigen Blocktexte von „Im Browser ausprobieren“ (js/try/texte.js, vendor/blockly/de.js und en.js).
// Aufruf: node --test tests/*.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Schildkroete, DEMOS, FELD } = require('./hilfe.js');

const WURZEL = path.join(__dirname, '..');
const lies = datei => fs.readFileSync(path.join(WURZEL, datei), 'utf8');
const Texte = require(path.join(WURZEL, 'js', 'try', 'texte.js'));
const SEITEN = { de: 'de/ausprobieren/index.html', en: 'en/try/index.html' };
const platzhalter = text => (text.match(/%\d+/g) || []).sort();
const DEUTSCH = /[äöüßÄÖÜ„“]/;

test('Blöcke: jeder eigene Block hat deutschen und englischen Text mit denselben Platzhaltern', () => {
  const typen = [...new Set(lies('js/try/ausprobieren.js').match(/'zr_\w+'/g).map(t => t.slice(1, -1)))];
  assert.ok(typen.length >= 10, 'eigene Blöcke gefunden');
  assert.deepEqual(Object.keys(Texte.BLOECKE).sort(), typen.sort(), 'texte.js und ausprobieren.js kennen dieselben Blöcke');
  for (const [typ, { de, en }] of Object.entries(Texte.BLOECKE)) {
    assert.ok(de && de.text && en && en.text, `${typ}: Text in beiden Sprachen`);
    assert.deepEqual(platzhalter(en.text), platzhalter(de.text), `${typ}: Platzhalter`);
    assert.equal(Boolean(en.tipp), Boolean(de.tipp), `${typ}: Tooltip in beiden Sprachen oder in keiner`);
    assert.deepEqual(Object.keys(en.optionen || {}), Object.keys(de.optionen || {}), `${typ}: Auswahlwerte`);
    for (const text of [en.text, en.tipp || '', ...Object.values(en.optionen || {})]) assert.doesNotMatch(text, DEUTSCH, `${typ}: englischer Text`);
  }
});

test('Blöcke: ausprobieren.js schreibt keine Blocktexte und Kategorienamen mehr selbst', () => {
  const quelle = lies('js/try/ausprobieren.js');
  assert.doesNotMatch(quelle, /message0: '|tooltip: '|kind: 'category', name: '/);
  for (const name of Object.keys(Texte.KATEGORIEN)) {
    assert.match(quelle, new RegExp(`kategorie\\('${name}'`), name);
    assert.ok(Texte.kategorie(name, 'de') && Texte.kategorie(name, 'en'), name);
    assert.notEqual(Texte.kategorie(name, 'en'), Texte.kategorie(name, 'de'), name);
  }
});

test('Beispiele: die Auswahl nennt sie auf jeder Seite in der Sprache der Seite', () => {
  assert.equal(Texte.BEISPIELE_EN.length, DEMOS.length);
  const namen = { de: DEMOS.map(d => d.name), en: Texte.BEISPIELE_EN };
  for (const [sprache, datei] of Object.entries(SEITEN)) {
    const auswahl = /<select id="beispiel">([\s\S]*?)<\/select>/.exec(lies(datei))[1];
    const optionen = [...auswahl.matchAll(/<option value="(\d+)">([^<]*)<\/option>/g)].map(m => m[2]);
    assert.deepEqual(optionen, namen[sprache], datei);
  }
});

test('Seiten: jede lädt die Blockly-Texte ihrer Sprache und texte.js vor ausprobieren.js', () => {
  for (const [sprache, datei] of Object.entries(SEITEN)) {
    const skripte = [...lies(datei).matchAll(/<script src="([^"]+)"/g)].map(m => m[1].replace(/^(\.\.\/)+/, ''));
    const blockly = skripte.filter(s => /^vendor\/blockly\/[a-z]{2}\.js$/.test(s));
    assert.deepEqual(blockly, [`vendor/blockly/${sprache}.js`], datei);
    assert.ok(skripte.indexOf('vendor/blockly/blockly_compressed.js') < skripte.indexOf(blockly[0]), datei);
    assert.ok(skripte.includes('js/try/texte.js') && skripte.indexOf('js/try/texte.js') < skripte.indexOf('js/try/ausprobieren.js'), datei);
  }
  assert.doesNotMatch(lies(SEITEN.en), /[„"]Los[“"]/, 'die englische Seite nennt den Startblock „Go“');
});

test('Blockly: die englischen Texte decken dieselben Schlüssel ab wie die deutschen', () => {
  const de = require(path.join(WURZEL, 'vendor', 'blockly', 'de.js')), en = require(path.join(WURZEL, 'vendor', 'blockly', 'en.js'));
  assert.deepEqual(Object.keys(en).sort(), Object.keys(de).sort());
  assert.equal(en.CONTROLS_REPEAT_INPUT_DO, 'do');
});

test('Meldungen: jede Meldung des Interpreters hat eine englische Fassung', () => {
  const quelle = lies('js/try/schildkroete.js');
  const roh = [...quelle.matchAll(/new Abbruch\((['`])(.*?)\1\)/g), ...quelle.matchAll(/fehler = (')(.*?)';/g)].map(m => m[2]);
  assert.ok(roh.length >= 17, `Meldungen gefunden: ${roh.length}`);
  const stellen = [...quelle.matchAll(/(?:zahl|wahrheit)\(ein[^,]*, '([^']+)'/g)].map(m => m[1]);
  assert.ok(stellen.length >= 15, `Stellen gefunden: ${stellen.length}`);
  for (const s of stellen) assert.ok(Texte.STELLEN_EN[s], `Stelle „${s}“`);
  for (const was of ['eine Zahl', 'ein Wahrheitswert', 'eine Bedingung']) {
    assert.ok(quelle.includes(`'${was}'`), was);
    assert.ok(Texte.WAS_EN[was], was);
  }
  for (const vorlage of roh) {
    const deutsch = vorlage.replace(/\$\{was\}/g, 'eine Zahl').replace(/\$\{name\}/g, 'zähle von').replace(/\$\{b\.type\}/g, 'zr_start').replace(/\$\{[^}]*\}/g, '7');
    const englisch = Texte.meldung(deutsch, 'en');
    assert.notEqual(englisch, deutsch, deutsch);
    assert.doesNotMatch(englisch, DEUTSCH, englisch);
    assert.equal(Texte.meldung(deutsch, 'de'), deutsch);
  }
});

test('Meldungen: was die Prüfung der Zeichnung sagt, kommt englisch an', () => {
  const start = b => ({ type: 'zr_start', ...(b ? { next: { block: b } } : {}) });
  const z = n => ({ shadow: { type: 'math_number', fields: { NUM: n } } });
  const vor = (weg, next) => ({ type: 'zr_vorwaerts', inputs: { WEG: z(weg) }, ...(next ? { next: { block: next } } : {}) });
  const grund = programm => Schildkroete.pruefen(Schildkroete.ausfuehren(programm, FELD, 1), FELD).grund;
  assert.equal(Texte.meldung(grund(start()), 'en'), 'No lines yet: attach blocks under "Go".');
  assert.match(Texte.meldung(grund(start(vor(60))), 'en'), /^1 point off the sheet \(red\)\.$/);
  assert.match(Texte.meldung(grund(start(vor(60, vor(60)))), 'en'), /^\d+ points off the sheet \(red\)\.$/);
  assert.equal(Texte.meldung(grund({ type: 'zr_start', next: { block: { type: 'zr_vorwaerts' } } }), 'en'), '"move forward" is missing a number.');
  assert.equal(Texte.meldung('Zu viele Punkte: höchstens 500.', 'en'), 'Too many points: at most 500.');
  assert.equal(Texte.meldung('Zu lang: höchstens 900 Zeichen.', 'en'), 'Too long: at most 900 characters.');
  assert.equal(Texte.meldung(null, 'en'), null);
});
