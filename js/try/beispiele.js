// Beispielprogramme für „Im Browser ausprobieren“.
// Übernommen aus dem Roboter-Repository: firmware/web/programme.js, Abschnitt DEMOS (Bauhelfer und Demos unverändert).
// Speichern, Export und Import der Firmware-Seite fehlen hier mit Absicht: Die Webseite merkt sich nichts.
'use strict';
(function (wurzel) {
  // DEMOS-ANFANG
  // Demos als Block-JSON im Format von Blockly.serialization.workspaces (BR-97, BR-99). Die erste ist die Startbelegung.
  // Gebaut für das Feld 80 × 80 mm; der Test lässt jede durch den Interpreter laufen.
  const z = n => ({ shadow: { type: 'math_number', fields: { NUM: n } } });
  const ein = w => (typeof w === 'number' ? z(w) : { block: w });
  const blk = (type, inputs, fields) => ({ type, ...(fields ? { fields } : {}), ...(inputs ? { inputs } : {}) });
  const folge = (...b) => b.reduceRight((next, x) => (next ? { ...x, next: { block: next } } : x), null);
  const innen = (...b) => ({ block: folge(...b) });
  const vor = w => blk('zr_vorwaerts', { WEG: ein(w) });
  const drehe = (w, r = 'RECHTS') => blk('zr_drehe', { WINKEL: ein(w) }, { RICHTUNG: r });
  const geheZu = (x, y) => blk('zr_gehe_zu', { X: ein(x), Y: ein(y) });
  const auf = () => blk('zr_stift_auf');
  const ab = () => blk('zr_stift_ab');
  const wiederhole = (n, ...b) => blk('controls_repeat_ext', { TIMES: ein(n), DO: innen(...b) });
  const zaehle = (id, von, bis, schritt, ...b) => blk('controls_for', { FROM: ein(von), TO: ein(bis), BY: ein(schritt), DO: innen(...b) }, { VAR: { id } });
  const wert = id => blk('variables_get', null, { VAR: { id } });
  const zufall = (von, bis) => blk('math_random_int', { FROM: ein(von), TO: ein(bis) });
  const falls = (bedingung, ...b) => blk('controls_if', { IF0: ein(bedingung), DO0: innen(...b) });
  const demo = (name, variablen, ...b) => ({ name, programm: {
    blocks: { languageVersion: 0, blocks: [{ type: 'zr_start', x: 20, y: 20, deletable: false, next: innen(...b) }] },
    ...(variablen.length ? { variables: variablen.map(v => ({ name: v, id: v })) } : {}) } });
  const DEMOS = [
    demo('Quadrat', [], wiederhole(4, vor(20), drehe(90))),
    demo('Haus', [], auf(), geheZu(25, 15), ab(), wiederhole(4, vor(30), drehe(90)), geheZu(25, 45), geheZu(40, 62), geheZu(55, 45),
      auf(), geheZu(36, 15), ab(), geheZu(36, 28), geheZu(44, 28), geheZu(44, 15)),
    demo('Stern', [], auf(), geheZu(15, 45), ab(), drehe(90), wiederhole(5, vor(50), drehe(144))),
    demo('Blume', [], wiederhole(8, wiederhole(2, wiederhole(18, vor(1.6), drehe(5)), drehe(90)), drehe(45))),
    demo('Zufallssterne', [], wiederhole(8, auf(), geheZu(zufall(10, 70), zufall(10, 70)), ab(), wiederhole(5, vor(8), drehe(144)))),
    demo('Quadratspirale', ['i'], zaehle('i', 2, 60, 2, vor(wert('i')), drehe(90))),
    demo('Abprallen am Rand', [], drehe(30), wiederhole(200, vor(1), falls(blk('zr_am_rand'), drehe(150)))),
  ];
  // DEMOS-ENDE
  wurzel.Programme = { DEMOS };
}(window));
