// Texte der Blöcke für „Im Browser ausprobieren“, deutsch und englisch.
// Die Seite wählt die Sprache über <html lang>. Blocktypen, Feldnamen und gespeichertes JSON sind in beiden Sprachen gleich:
// Hier steht nur, was auf den Blöcken zu lesen ist. Ein Programm aus der deutschen Seite läuft deshalb auch auf der englischen.
'use strict';
(function (wurzel, fabrik) {
  if (typeof module === 'object' && module.exports) module.exports = fabrik();
  else wurzel.Texte = fabrik();
}(typeof self !== 'undefined' ? self : this, function () {
  // text: message0 des Blocks (%1, %2 sind die Eingänge), tipp: Tooltip, optionen: Beschriftung der Auswahl je gespeichertem Wert.
  const BLOECKE = {
    zr_start: {
      de: { text: 'Los', tipp: 'Hier fängt dein Programm an.' },
      en: { text: 'Go', tipp: 'Your program starts here.' } },
    zr_stift_ab: {
      de: { text: 'Stift ab', tipp: 'Ab jetzt malt die Schildkröte.' },
      en: { text: 'pen down', tipp: 'The turtle draws from now on.' } },
    zr_stift_auf: {
      de: { text: 'Stift auf', tipp: 'Ab jetzt fährt die Schildkröte, ohne zu malen.' },
      en: { text: 'pen up', tipp: 'The turtle moves without drawing from now on.' } },
    zr_vorwaerts: {
      de: { text: 'gehe %1 mm vorwärts' },
      en: { text: 'move %1 mm forward' } },
    zr_drehe: {
      de: { text: 'drehe dich nach %1 um %2 °', optionen: { RECHTS: 'rechts', LINKS: 'links' } },
      en: { text: 'turn %1 by %2 °', optionen: { RECHTS: 'right', LINKS: 'left' } } },
    zr_gehe_zu: {
      de: { text: 'gehe zu x %1 y %2', tipp: 'x und y in mm ab der Ecke links unten des Felds.' },
      en: { text: 'go to x %1 y %2', tipp: 'x and y in mm, measured from the bottom left corner of the sheet.' } },
    zr_x: {
      de: { text: 'x der Schildkröte', tipp: 'Wo die Schildkröte steht: mm ab dem linken Rand.' },
      en: { text: 'turtle\'s x', tipp: 'Where the turtle is: mm from the left edge.' } },
    zr_y: {
      de: { text: 'y der Schildkröte', tipp: 'Wo die Schildkröte steht: mm ab dem unteren Rand.' },
      en: { text: 'turtle\'s y', tipp: 'Where the turtle is: mm from the bottom edge.' } },
    zr_richtung: {
      de: { text: 'Richtung der Schildkröte', tipp: 'Wohin sie schaut, in Grad: 0 rechts, 90 oben, 180 links, 270 unten.' },
      en: { text: 'turtle\'s direction', tipp: 'Which way it faces, in degrees: 0 right, 90 up, 180 left, 270 down.' } },
    zr_am_rand: {
      de: { text: 'am Rand?', tipp: 'Wahr, wenn die Schildkröte höchstens 1 mm vom Rand des Felds entfernt ist oder draußen steht.' },
      en: { text: 'at the edge?', tipp: 'True when the turtle is within 1 mm of the edge of the sheet, or off it.' } },
  };

  const KATEGORIEN = {
    stift: { de: 'Stift', en: 'Pen' },
    bewegen: { de: 'Bewegen', en: 'Move' },
    wiederholen: { de: 'Wiederholen', en: 'Repeat' },
    logik: { de: 'Logik', en: 'Logic' },
    zahlen: { de: 'Zahlen', en: 'Numbers' },
    variablen: { de: 'Variablen', en: 'Variables' },
  };

  // Englische Namen der Beispiele, in der Reihenfolge von Programme.DEMOS (die deutschen stehen dort).
  const BEISPIELE_EN = ['Square', 'House', 'Star', 'Flower', 'Random stars', 'Square spiral', 'Bouncing off the edge'];

  // Der Interpreter (schildkroete.js) kommt unverändert aus der Firmware und meldet auf Deutsch.
  // Die englische Seite übersetzt seine Meldungen hier; der Test prüft, dass keine fehlt.
  const STELLEN_EN = {
    Vergleich: 'comparison', Rechnen: 'calculation', 'Zufallszahl von': 'random integer from', 'Zufallszahl bis': 'random integer to',
    'und/oder': 'and/or', nicht: 'not', falls: 'if', 'zähle von': 'count from', 'zähle bis': 'count to',
    'zähle in Schritten': 'count by', 'gehe vorwärts': 'move forward', 'drehe dich': 'turn', 'gehe zu x': 'go to x',
    'gehe zu y': 'go to y', wiederhole: 'repeat', 'ändere': 'change',
  };
  const WAS_EN = { 'eine Zahl': 'a number', 'ein Wahrheitswert': 'a true or false value', 'eine Bedingung': 'a condition' };
  const stelle = name => STELLEN_EN[name] || name;
  const MELDUNGEN_EN = [
    [/^Zu viele Schritte: höchstens (\d+)\. Ist eine Wiederholung zu groß\?$/, m => `Too many steps: at most ${m[1]}. Is a loop repeating too many times?`],
    [/^Zu viele Punkte: höchstens (\d+)\. Weniger Wiederholungen oder längere Striche\.$/,
      m => `Too many points: at most ${m[1]}. Use fewer repeats or longer lines.`],
    [/^Bei „Zufallszahl“ sind die Grenzen zu groß\.$/, () => 'The numbers in "random integer" are too big.'],
    [/^Bei „zähle“ geht Schritt 0 nicht: Die Schleife käme nie an\.$/, () => '"count" can\'t use a step of 0: the loop would never finish.'],
    [/^Bei „(.+)“ fehlt (.+)\.$/, m => `"${stelle(m[1])}" is missing ${WAS_EN[m[2]] || 'a value'}.`],
    [/^Bei „(.+)“ steht ein Wahrheitswert, gebraucht wird eine Zahl\.$/, m => `"${stelle(m[1])}" has a true or false value, but it needs a number.`],
    [/^Bei „(.+)“ kommt keine Zahl heraus \(etwa geteilt durch 0\)\.$/, m => `"${stelle(m[1])}" doesn't work out to a number (for example, dividing by 0).`],
    [/^Bei „(.+)“ kommt kein wahr oder falsch heraus\.$/, m => `"${stelle(m[1])}" doesn't work out to true or false.`],
    [/^Zwischen (.+) und (.+) liegt keine ganze Zahl\.$/, m => `There is no whole number between ${m[1]} and ${m[2]}.`],
    [/^Diesen Vergleich kennt der Roboter nicht\.$/, () => 'The robot doesn\'t know this comparison.'],
    [/^Diese Rechenart kennt der Roboter nicht\.$/, () => 'The robot doesn\'t know this calculation.'],
    [/^Diese Verknüpfung kennt der Roboter nicht\.$/, () => 'The robot doesn\'t know this operation.'],
    [/^Der Block „(.+)“ liefert hier keinen Wert\.$/, m => `The block "${m[1]}" can't be used as a value here.`],
    [/^Den Block „(.+)“ kennt der Roboter nicht\.$/, m => `The robot doesn't know the block "${m[1]}".`],
    [/^Kein Startblock „Los“\.$/, () => 'There is no "Go" block to start from.'],
    [/^Das Programm ist zu tief verschachtelt\.$/, () => 'The program is nested too deeply.'],
    [/^Noch keine Striche: Häng Blöcke unter „Los“\.$/, () => 'No lines yet: attach blocks under "Go".'],
    [/^(\d+) Punkte? außerhalb des Felds \(rot\)\.$/, m => `${m[1]} point${m[1] === '1' ? '' : 's'} off the sheet (red).`],
    [/^Zu viele Punkte: höchstens (\d+)\.$/, m => `Too many points: at most ${m[1]}.`],
    [/^Zu lang: höchstens (\d+) Zeichen\.$/, m => `Too long: at most ${m[1]} characters.`],
  ];

  const sprachVon = sprache => (sprache === 'en' ? 'en' : 'de');
  const block = (typ, sprache) => BLOECKE[typ][sprachVon(sprache)];
  const kategorie = (name, sprache) => KATEGORIEN[name][sprachVon(sprache)];

  // Meldung des Interpreters in der Sprache der Seite. Unbekanntes bleibt, wie es ist.
  function meldung(text, sprache) {
    if (sprachVon(sprache) !== 'en' || typeof text !== 'string') return text;
    for (const [muster, englisch] of MELDUNGEN_EN) {
      const m = muster.exec(text);
      if (m) return englisch(m);
    }
    return text;
  }

  return { BLOECKE, KATEGORIEN, BEISPIELE_EN, STELLEN_EN, WAS_EN, block, kategorie, meldung };
}));
