// Übernommen aus der PlotBot-Firmware (Schildkröte der Handyseite).
// Auf der Webseite rechnet sie die Striche für die Vorschau; gesendet wird nichts.
// Schildkröte für die Blockly-Seite: führt die Blöcke aus und prüft das Ergebnis für die Vorschau.
// Kein eval, kein erzeugter Code: ausfuehren() läuft über den gespeicherten Baum der Blöcke (Blockly-JSON) und kennt nur
// die Blocktypen unten. Ohne Blockly und ohne Browser testbar.
// Koordinaten des Kinds: mm ab der Ecke links unten des Felds, so wie die Vorschau es zeigt, y nach oben.
// Gesendet wird in 1/10 mm Maschinenkoordinaten (BR-61); drehen tut die Firmware (BR-68), nicht diese Datei.
'use strict';
(function (wurzel, fabrik) {
  if (typeof module === 'object' && module.exports) module.exports = fabrik();
  else wurzel.Schildkroete = fabrik();
}(typeof self !== 'undefined' ? self : this, function () {
  // Grenzen von aktion=striche (BR-63, strichliste.h) und gegen Endlosschleifen (BR-73).
  const PUNKTE_MAX = 1000;
  const TEXT_MAX = 10000;
  const SCHRITTE_MAX = 10000;
  // „am Rand?“ ist wahr, wenn die Schildkröte höchstens so viele mm vom Feldrand entfernt ist oder außerhalb steht (BR-93).
  const RAND_MM = 1;
  const GENAU = 1e-9;   // Spiel für Rundungsfehler beim Vergleich mit RAND_MM
  // Alle Blocktypen, die ausfuehren() kennt; dieselbe Liste prüft programme.js beim Laden und Einlesen (BR-72, BR-107).
  const BLOCKTYPEN = Object.freeze(['zr_start', 'zr_stift_ab', 'zr_stift_auf', 'zr_vorwaerts', 'zr_drehe', 'zr_gehe_zu', 'zr_x', 'zr_y',
    'zr_richtung', 'zr_am_rand', 'controls_repeat_ext', 'controls_for', 'controls_if', 'variables_set', 'variables_get', 'math_change',
    'math_number', 'math_arithmetic', 'math_random_int', 'logic_boolean', 'logic_compare', 'logic_operation', 'logic_negate']);

  class Abbruch extends Error {}

  // Startzustand: Mitte des Felds, Blick nach oben (vom Kind weg), Stift unten wie bei Logo.
  function neueSchildkroete(feld) {
    return { x: feld.breite / 2, y: feld.hoehe / 2, richtung: 90, stiftUnten: true };
  }

  // feld aus /status: [x0, x1, y0, y1] in mm (BR-70). Breite und Höhe in 1/10 mm, damit die Prüfung wie in der Firmware rechnet.
  function feldAus(maschinenFeld) {
    const [x0, x1, y0, y1] = maschinenFeld.map(Number);
    if (![x0, x1, y0, y1].every(Number.isFinite) || x1 <= x0 || y1 <= y0) return null;
    return { x0, y0, breite: x1 - x0, hoehe: y1 - y0 };
  }

  const zehntel = mm => Math.round(mm * 10) + 0;   // + 0 macht aus −0 eine 0

  // Punkt des Kinds → Maschinenkoordinaten in 1/10 mm, gerundet wie gesendet.
  function inMaschine(feld, p) {
    return [zehntel(feld.x0 + p[0]), zehntel(feld.y0 + p[1])];
  }

  // Im Feld, wie imFeld in kinematik.cpp, aber auf den gerundeten 1/10-mm-Werten, die die Firmware bekommt.
  function imFeld(feld, p) {
    const [x, y] = inMaschine(feld, p);
    return x >= zehntel(feld.x0) && x <= zehntel(feld.x0 + feld.breite) && y >= zehntel(feld.y0) && y <= zehntel(feld.y0 + feld.hoehe);
  }

  // Abstand zum nächsten Feldrand in mm (Kind), negativ außerhalb; „am Rand?“ vergleicht ihn mit RAND_MM (BR-93).
  function amRand(feld, s) {
    return Math.min(s.x, feld.breite - s.x, s.y, feld.hoehe - s.y) <= RAND_MM + GENAU;
  }

  // Zufall mit Startwert (mulberry32): gleicher Startwert, gleiche Zahlen, also gleiche Vorschau und gleiche Striche (BR-91).
  function zufallsquelle(startwert) {
    let z = startwert >>> 0;
    return function () {
      z = (z + 0x6D2B79F5) >>> 0;
      let t = z;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // In Blockly deaktiviert? Blockly 13 speichert disabledReasons, ältere Stände enabled: false (BR-110).
  const aktiv = b => !(b.enabled === false || (Array.isArray(b.disabledReasons) && b.disabledReasons.length > 0));

  // Ob irgendwo im Programm ein Zufallsblock steckt, auch in einem Zweig, der nicht läuft (BR-92: Knopf „Neu würfeln“).
  // Geht den Baum mit einer eigenen Liste durch, nicht rekursiv, damit tiefe Programme den Aufrufstapel nicht sprengen.
  function enthaeltZufall(programm) {
    const offen = programm ? [programm] : [];
    while (offen.length) {
      const b = offen.pop();
      if (!b || typeof b !== 'object') continue;
      if (b.type === 'math_random_int') return true;
      if (b.next) offen.push(b.next.block);
      for (const e of Object.values(b.inputs || {})) if (e) offen.push(e.block, e.shadow);
    }
    return false;
  }

  // Führt das Programm unter dem Startblock aus. programm: Blockly-JSON des Startblocks, startwert für den Zufall.
  // Ergebnis: Striche in mm (Kind), Endlage der Schildkröte, gezählte Schritte und Punkte, fehler oder null.
  function ausfuehren(programm, feld, startwert = 1) {
    const s = neueSchildkroete(feld);
    const wuerfel = zufallsquelle(startwert);
    const striche = [];
    const variablen = new Map();
    let offen = null;   // laufender Strich, solange der Stift unten ist
    let schritte = 0;
    let punkte = 0;

    const zaehle = () => {
      if (++schritte > SCHRITTE_MAX) throw new Abbruch(`Zu viele Schritte: höchstens ${SCHRITTE_MAX}. Ist eine Wiederholung zu groß?`);
    };
    const punkt = p => {
      if (++punkte > PUNKTE_MAX) throw new Abbruch(`Zu viele Punkte: höchstens ${PUNKTE_MAX}. Weniger Wiederholungen oder längere Striche.`);
      offen.push(p);
    };
    const gleich = (a, b) => zehntel(a[0]) === zehntel(b[0]) && zehntel(a[1]) === zehntel(b[1]);

    function ziehe(x, y) {
      const von = [s.x, s.y];
      s.x = x;
      s.y = y;
      if (!s.stiftUnten) return;
      const nach = [x, y];
      if (!offen) {
        if (gleich(von, nach)) return;   // nichts bewegt, kein Strich
        offen = [];
        striche.push(offen);
        punkt(von);
      }
      if (!gleich(offen[offen.length - 1], nach)) punkt(nach);
    }

    // Wert eines Eingangs: Zahl oder wahr/falsch. Ein leerer Eingang hält mit Meldung an.
    function wert(eingang, name, was) {
      // Ein deaktivierter Block im Eingang zählt als leer, auch wenn ein Schatten darunter liegt (BR-110).
      const ziel = eingang && (eingang.block ? (aktiv(eingang.block) ? eingang.block : null) : eingang.shadow);
      if (!ziel) throw new Abbruch(`Bei „${name}“ fehlt ${was}.`);
      return rechne(ziel);
    }

    function zahl(eingang, name) {
      const w = wert(eingang, name, 'eine Zahl');
      if (typeof w === 'boolean') throw new Abbruch(`Bei „${name}“ steht ein Wahrheitswert, gebraucht wird eine Zahl.`);
      if (!Number.isFinite(w)) throw new Abbruch(`Bei „${name}“ kommt keine Zahl heraus (etwa geteilt durch 0).`);
      return w;
    }

    function wahrheit(eingang, name, was = 'ein Wahrheitswert') {
      const w = wert(eingang, name, was);
      if (typeof w !== 'boolean') throw new Abbruch(`Bei „${name}“ kommt kein wahr oder falsch heraus.`);
      return w;
    }

    // Zufallszahl von … bis wie in Blockly, aber ganz und immer in [von, bis], auch bei vertauschten Grenzen (BR-91).
    function zufallszahl(a, b) {
      const lo = Math.ceil(Math.min(a, b)), hi = Math.floor(Math.max(a, b));
      if (lo > hi) throw new Abbruch(`Zwischen ${a} und ${b} liegt keine ganze Zahl.`);
      const z = lo + Math.floor(wuerfel() * (hi - lo + 1));
      if (!Number.isFinite(z)) throw new Abbruch('Bei „Zufallszahl“ sind die Grenzen zu groß.');
      return z;
    }

    function vergleiche(b) {
      const ein = b.inputs || {};
      const op = b.fields && b.fields.OP;
      if (op === 'EQ' || op === 'NEQ') {
        const gleich = wert(ein.A, 'Vergleich', 'ein Wert') === wert(ein.B, 'Vergleich', 'ein Wert');
        return op === 'EQ' ? gleich : !gleich;
      }
      const a = zahl(ein.A, 'Vergleich'), c = zahl(ein.B, 'Vergleich');
      if (op === 'LT') return a < c;
      if (op === 'LTE') return a <= c;
      if (op === 'GT') return a > c;
      if (op === 'GTE') return a >= c;
      throw new Abbruch('Diesen Vergleich kennt der Roboter nicht.');
    }

    function rechne(b) {
      zaehle();
      const ein = b.inputs || {};
      switch (b.type) {
        case 'math_number': return Number(b.fields && b.fields.NUM);
        case 'variables_get': return variablen.has(variableId(b)) ? variablen.get(variableId(b)) : 0;
        case 'math_arithmetic': {
          const a = zahl(ein.A, 'Rechnen'), c = zahl(ein.B, 'Rechnen');
          const op = b.fields && b.fields.OP;
          if (op === 'ADD') return a + c;
          if (op === 'MINUS') return a - c;
          if (op === 'MULTIPLY') return a * c;
          if (op === 'DIVIDE') return a / c;
          throw new Abbruch('Diese Rechenart kennt der Roboter nicht.');
        }
        case 'math_random_int': return zufallszahl(zahl(ein.FROM, 'Zufallszahl von'), zahl(ein.TO, 'Zufallszahl bis'));
        case 'zr_x': return s.x;
        case 'zr_y': return s.y;
        case 'zr_richtung': return s.richtung;
        case 'zr_am_rand': return amRand(feld, s);
        case 'logic_boolean': return (b.fields && b.fields.BOOL) === 'TRUE';
        case 'logic_compare': return vergleiche(b);
        case 'logic_operation': {
          const op = b.fields && b.fields.OP;
          if (op !== 'AND' && op !== 'OR') throw new Abbruch('Diese Verknüpfung kennt der Roboter nicht.');
          const a = wahrheit(ein.A, 'und/oder');
          if (op === 'AND' ? !a : a) return a;   // rechts nur, wenn nötig, wie in Blockly
          return wahrheit(ein.B, 'und/oder');
        }
        case 'logic_negate': return !wahrheit(ein.BOOL, 'nicht');
        default: throw new Abbruch(`Der Block „${b.type}“ liefert hier keinen Wert.`);
      }
    }

    function variableId(b) {
      const v = b.fields && b.fields.VAR;
      return v && (v.id || v.name);
    }

    function stapel(b) {
      for (; b; b = b.next && b.next.block) if (aktiv(b)) befehl(b);   // deaktiviert: samt Inhalt aus, der Rest läuft (BR-110)
    }

    // wenn – sonst wenn – sonst: Zahl der Zweige aus extraState, so wie Blockly 13 es speichert (BR-90).
    function wenn(ein, extra) {
      const zweige = 1 + Math.max(0, Math.floor(Number(extra && extra.elseIfCount) || 0));
      for (let i = 0; i < zweige; i++)
        if (wahrheit(ein[`IF${i}`], 'falls', 'eine Bedingung')) return stapel(ein[`DO${i}`] && ein[`DO${i}`].block);   // Name wie auf der Seite
      return stapel(ein.ELSE && ein.ELSE.block);
    }

    // zähle von a bis b in Schritten s: Richtung aus a und b, Schritt als Betrag wie in Blockly; Schritt 0 hält an.
    // Gezählt wird mit k und relativer Toleranz, damit die Anzahl nicht an Rundungsfehlern hängt: 0 bis 0,3 in 0,1 läuft
    // viermal (Blockly summiert den Fehler auf und läuft dreimal). Der Wert geht nie über b hinaus
    // und landet auf b, wenn er es bis auf Rundungsfehler trifft.
    function zaehleSchleife(b, ein) {
      const von = zahl(ein.FROM, 'zähle von'), bis = zahl(ein.TO, 'zähle bis'), schritt = Math.abs(zahl(ein.BY, 'zähle in Schritten'));
      if (schritt === 0) throw new Abbruch('Bei „zähle“ geht Schritt 0 nicht: Die Schleife käme nie an.');
      const vorzeichen = bis >= von ? 1 : -1;
      const anzahl = Math.floor(Math.abs(bis - von) / schritt * (1 + 1e-12)) + 1;
      for (let k = 0; k < anzahl; k++) {
        zaehle();
        const i = von + vorzeichen * k * schritt;
        const amZiel = vorzeichen * (i - bis) > 0 || Math.abs(i - bis) <= Math.abs(bis - von) * 1e-12;
        variablen.set(variableId(b), amZiel ? bis : i);
        stapel(ein.DO && ein.DO.block);
      }
    }

    function befehl(b) {
      zaehle();
      const ein = b.inputs || {};
      switch (b.type) {
        case 'zr_start': return;
        case 'zr_stift_ab': s.stiftUnten = true; return;
        case 'zr_stift_auf': s.stiftUnten = false; offen = null; return;
        case 'zr_vorwaerts': {
          const weg = zahl(ein.WEG, 'gehe vorwärts');
          const r = s.richtung * Math.PI / 180;
          return ziehe(s.x + weg * Math.cos(r), s.y + weg * Math.sin(r));
        }
        case 'zr_drehe': {
          const winkel = zahl(ein.WINKEL, 'drehe dich');
          s.richtung += (b.fields && b.fields.RICHTUNG) === 'LINKS' ? winkel : -winkel;
          s.richtung = ((s.richtung % 360) + 360) % 360 + 0;
          return;
        }
        case 'zr_gehe_zu': return ziehe(zahl(ein.X, 'gehe zu x'), zahl(ein.Y, 'gehe zu y'));
        case 'controls_repeat_ext': {
          const n = Math.floor(zahl(ein.TIMES, 'wiederhole'));
          for (let i = 0; i < n; i++) {
            zaehle();
            stapel(ein.DO && ein.DO.block);
          }
          return;
        }
        case 'controls_for': return zaehleSchleife(b, ein);
        case 'controls_if': return wenn(ein, b.extraState);
        case 'variables_set': variablen.set(variableId(b), wert(ein.VALUE, 'setze', 'ein Wert')); return;
        case 'math_change': {
          const alt = variablen.has(variableId(b)) ? variablen.get(variableId(b)) : 0;
          if (typeof alt !== 'number') throw new Abbruch('Bei „ändere“ steht ein Wahrheitswert, gebraucht wird eine Zahl.');
          variablen.set(variableId(b), alt + zahl(ein.DELTA, 'ändere'));
          return;
        }
        default: throw new Abbruch(`Den Block „${b.type}“ kennt der Roboter nicht.`);
      }
    }

    let fehler = null;
    try {
      if (!programm || programm.type !== 'zr_start') throw new Abbruch('Kein Startblock „Los“.');
      stapel(programm);
    } catch (e) {
      if (e instanceof RangeError) fehler = 'Das Programm ist zu tief verschachtelt.';   // Aufrufstapel voll
      else if (e instanceof Abbruch) fehler = e.message;
      else throw e;
    }
    return { striche: striche.filter(st => st.length > 1), schildkroete: s, schritte, punkte, fehler };
  }

  // Wert für aktion=striche: „x,y x,y|x,y“ in 1/10 mm Maschinenkoordinaten (BR-61).
  function stricheText(striche, feld) {
    return striche.map(st => st.map(p => inMaschine(feld, p).join(',')).join(' ')).join('|');
  }

  // Ob und warum gesendet werden darf (BR-74). Punkte außerhalb kommen für die Vorschau mit.
  function pruefen(ergebnis, feld) {
    const aussen = [];
    let anzahl = 0;
    for (const st of ergebnis.striche) for (const p of st) { anzahl++; if (!imFeld(feld, p)) aussen.push(p); }
    const text = stricheText(ergebnis.striche, feld);
    let grund = null;
    if (ergebnis.fehler) grund = ergebnis.fehler;
    else if (anzahl === 0) grund = 'Noch keine Striche: Häng Blöcke unter „Los“.';
    else if (aussen.length) grund = `${aussen.length} Punkt${aussen.length === 1 ? '' : 'e'} außerhalb des Felds (rot).`;
    else if (anzahl > PUNKTE_MAX) grund = `Zu viele Punkte: höchstens ${PUNKTE_MAX}.`;
    else if (text.length > TEXT_MAX) grund = `Zu lang: höchstens ${TEXT_MAX} Zeichen.`;
    return { sendbar: grund === null, grund, anzahl, aussen, text };
  }

  // Wo der Roboter in der Vorschau steht: Die Vorschau zeigt das Blatt so, wie das Kind es sieht. Bei gedreht sitzt es
  // gegenüber, der Roboter steht also oben (BR-75).
  const roboterKante = gedreht => (gedreht ? 'oben' : 'unten');

  return { PUNKTE_MAX, TEXT_MAX, SCHRITTE_MAX, RAND_MM, BLOCKTYPEN, feldAus, enthaeltZufall, inMaschine, imFeld, ausfuehren, stricheText, pruefen, roboterKante, neueSchildkroete };
}));
