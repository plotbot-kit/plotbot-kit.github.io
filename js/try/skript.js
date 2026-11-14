// JavaScript statt Blöcke: führt ein getipptes Programm mit Schildkröten-Funktionen aus und liefert dieselben Striche wie
// schildkroete.js. Kern ohne DOM (UMD wie schildkroete.js); den Worker selbst baut die Seite und reicht ihn als
// erzeugeWorker herein, damit dieselbe Datei im Browser, in node --test und später in der Firmware-Seite läuft.
//
// Funktionen für das Kind (deutsch | englisch, beide gelten auf beiden Seiten):
//   vorwaerts(mm) | forward     rechts(grad) | right     links(grad) | left      drehe(grad) | turn  (wie rechts)
//   stiftAb() | penDown         stiftAuf() | penUp       geheZu(x, y) | goTo     x()  y()  richtung() | heading
//   amRand() | atEdge           zufall(a, b) | random    zaehle(von, bis, schritt) | count  (Liste für for … of)
// Schleifen, if, Variablen und eigene Funktionen sind normales JavaScript.
//
// Sicherheit: Das Programm läuft nie im Kontext der Seite, sondern in einem eigenen Web Worker, den laufe() nach dem
// Ergebnis oder nach ZEITLIMIT_MS beendet. Vor der ersten Zeile des Kinds löscht sperre() alle Globals bis auf die
// Sprachmittel in ERLAUBT (also fetch, XMLHttpRequest, WebSocket, importScripts, indexedDB, caches, navigator, Worker,
// postMessage, Timer, eval, Function …); dynamisches import() weist laufe() schon am Quelltext ab.
// Die Grenzen PUNKTE_MAX und SCHRITTE_MAX kommen aus schildkroete.js; das Ergebnis prüft die Seite noch einmal (gueltig).
'use strict';
(function (wurzel, fabrik) {
  if (typeof module === 'object' && module.exports) module.exports = fabrik(require('./schildkroete.js'));
  else wurzel.Skript = fabrik(wurzel.Schildkroete);
}(typeof self !== 'undefined' ? self : this, function (Schildkroete) {
  const ZEITLIMIT_MS = 2000;
  const CODE_MAX = 20000;   // Zeichen
  const TEXT_MAX = 300;     // Zeichen einer Fehlermeldung aus dem Worker; längere schneidet laufe() ab
  // [interner Name, deutsch, englisch, weitere Schreibweisen]
  const NAMEN = Object.freeze([['vorwaerts', 'vorwaerts', 'forward', 'vorwärts'], ['rechts', 'rechts', 'right'], ['links', 'links', 'left'],
    ['drehe', 'drehe', 'turn'], ['stiftAb', 'stiftAb', 'penDown'], ['stiftAuf', 'stiftAuf', 'penUp'], ['geheZu', 'geheZu', 'goTo'],
    ['x', 'x', 'x'], ['y', 'y', 'y'], ['richtung', 'richtung', 'heading'], ['amRand', 'amRand', 'atEdge'],
    ['zufall', 'zufall', 'random'], ['zaehle', 'zaehle', 'count', 'zähle']]);
  const sprachIndex = sprache => (sprache === 'en' ? 2 : 1);
  const nameVon = (schluessel, sprache) => NAMEN.find(n => n[0] === schluessel)[sprachIndex(sprache)];

  // Was im Worker bleiben darf: nur die Sprache selbst. Alles andere löscht sperre().
  const ERLAUBT = ['Object', 'Array', 'Math', 'JSON', 'Number', 'String', 'Boolean', 'Symbol', 'BigInt', 'Map', 'Set', 'WeakMap', 'WeakSet',
    'Date', 'RegExp', 'Error', 'TypeError', 'RangeError', 'ReferenceError', 'SyntaxError', 'EvalError', 'URIError', 'AggregateError',
    'Promise', 'Reflect', 'Proxy', 'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'Infinity', 'NaN', 'undefined', 'globalThis', 'console'];
  // Bleibt davon etwas erreichbar, startet das Programm nicht.
  const GEFAEHRLICH = ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'WebTransport', 'importScripts', 'indexedDB', 'caches',
    'navigator', 'Worker', 'SharedWorker', 'BroadcastChannel', 'MessageChannel', 'postMessage', 'close', 'eval', 'Function',
    'setTimeout', 'setInterval', 'queueMicrotask', 'Blob', 'URL', 'WebAssembly', 'location', 'self', 'require', 'process'];

  const TEXTE = {
    de: {
      zahl: '‚{name}‘ braucht eine Zahl.',
      schritte: 'Zu viele Schritte: höchstens {n}. Läuft eine Schleife zu oft?',
      punkte: 'Zu viele Punkte: höchstens {n}. Weniger Wiederholungen oder längere Striche.',
      zufallLeer: 'Zwischen {a} und {b} liegt keine ganze Zahl.',
      schritt0: 'Schritt 0 geht beim Zählen nicht: Die Schleife käme nie an.',
      zeit: 'Nach {s} Sekunden abgebrochen. Wahrscheinlich endet eine Schleife nie.',
      klammer: 'Hier stimmt eine Klammer nicht. Zu jeder ( gehört eine ), zu jeder { eine }.',
      klammerEnde: 'Am Ende fehlt eine Klammer. Zu jeder { gehört eine }, zu jeder ( eine ).',
      klammerZuViel: 'Hier ist eine schließende Klammer zu viel: Zu ihr gibt es keine öffnende.',
      klammerUnklar: 'Die Klammern passen nicht zusammen. Zu jeder ( gehört eine ), zu jeder { eine }.',
      zuWeit: 'So weit kann die Schildkröte nicht rechnen: Die Zahlen sind zu groß geworden.',
      syntax: 'Das versteht JavaScript nicht ({text}). Fehlt hier oder in der Zeile davor eine Klammer, ein Komma oder ein Anführungszeichen?',
      unbekannt: 'Den Namen ‚{name}‘ kenne ich nicht. Vertippt? Groß- und Kleinschreibung zählen.',
      meinst: ' Meinst du ‚{name}‘?',
      keineFunktion: '‚{name}‘ ist keine Funktion, die man aufrufen kann.',
      zeile: 'Zeile {n}: {text}', sonst: 'Fehler in Zeile {n}: {text}', sonstOhne: 'Fehler: {text}',
      import: 'Das Wort ‚import‘ geht hier nicht, auch nicht in einem Kommentar: Das Programm darf nichts nachladen.',
      zuLang: 'Das Programm ist zu lang: höchstens {n} Zeichen.',
      sperre: 'Dieser Browser kann das Programm nicht abgeschottet ausführen. Nimm bitte die Blöcke.',
      kaputt: 'Das Programm hat kein brauchbares Ergebnis geliefert.',
    },
    en: {
      zahl: '"{name}" needs a number.',
      schritte: 'Too many steps: {n} at most. Does a loop run too often?',
      punkte: 'Too many points: {n} at most. Use fewer repeats or longer lines.',
      zufallLeer: 'There is no whole number between {a} and {b}.',
      schritt0: 'Counting in steps of 0 doesn\'t work: the loop would never finish.',
      zeit: 'Stopped after {s} seconds. A loop probably never ends.',
      klammer: 'A bracket doesn\'t match here. Every ( needs a ), every { needs a }.',
      klammerEnde: 'A bracket is missing at the end. Every { needs a }, every ( needs a ).',
      klammerZuViel: 'There is one closing bracket too many here: it has no opening bracket.',
      klammerUnklar: 'The brackets don\'t match up. Every ( needs a ), every { needs a }.',
      zuWeit: 'The turtle can\'t calculate that far: the numbers have become too big.',
      syntax: 'JavaScript doesn\'t understand this ({text}). Is a bracket, a comma or a quotation mark missing here or on the line before?',
      unbekannt: 'I don\'t know the name "{name}". Is it a typo? Upper and lower case matter.',
      meinst: ' Did you mean "{name}"?',
      keineFunktion: '"{name}" is not a function you can call.',
      zeile: 'Line {n}: {text}', sonst: 'Error in line {n}: {text}', sonstOhne: 'Error: {text}',
      import: 'You can\'t use the word "import" here, not even in a comment: programs aren\'t allowed to load anything.',
      zuLang: 'The program is too long: {n} characters at most.',
      sperre: 'This browser can\'t run the program in isolation. Please use the blocks.',
      kaputt: 'The program didn\'t return a usable result.',
    },
  };
  const fuelle = (vorlage, werte) => vorlage.replace(/\{(\w+)\}/g, (_, k) => String(werte[k]));

  // ---- Ab hier Code, der als Text in den Worker wandert: keine Bezüge nach außen. ----

  // Die Schildkröte hinter den Funktionen. Rechnet wie ausfuehren() in schildkroete.js; der Test vergleicht beide.
  function kern(feld, startwert, grenzen, T, namen, spalte) {
    class Abbruch extends Error {}
    const s = { x: feld.breite / 2, y: feld.hoehe / 2, richtung: 90, stiftUnten: true };
    const striche = [];
    let offen = null, schritte = 0, punkte = 0, zufallBenutzt = false, z = startwert >>> 0;
    const text = (vorlage, werte) => vorlage.replace(/\{(\w+)\}/g, (_, k) => String(werte[k]));
    const nenne = schluessel => namen.find(n => n[0] === schluessel)[spalte];
    const wuerfel = () => {   // mulberry32 wie in schildkroete.js
      z = (z + 0x6D2B79F5) >>> 0;
      let t = z;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const zehntel = mm => Math.round(mm * 10) + 0;
    const gleich = (a, b) => zehntel(a[0]) === zehntel(b[0]) && zehntel(a[1]) === zehntel(b[1]);
    const schritt = (n = 1) => { if ((schritte += n) > grenzen.SCHRITTE_MAX) throw new Abbruch(text(T.schritte, { n: grenzen.SCHRITTE_MAX })); };
    const punkt = p => {
      if (++punkte > grenzen.PUNKTE_MAX) throw new Abbruch(text(T.punkte, { n: grenzen.PUNKTE_MAX }));
      offen.push(p);
    };
    const zahl = (w, schluessel) => {
      if (typeof w !== 'number' || !Number.isFinite(w)) throw new Abbruch(text(T.zahl, { name: nenne(schluessel) }));
      return w;
    };
    function ziehe(x, y) {
      const von = [s.x, s.y], nach = [x, y];
      if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Abbruch(T.zuWeit);
      s.x = x;
      s.y = y;
      if (!s.stiftUnten) return;
      if (!offen) {
        if (gleich(von, nach)) return;
        offen = [];
        striche.push(offen);
        punkt(von);
      }
      if (!gleich(offen[offen.length - 1], nach)) punkt(nach);
    }
    function dreh(winkel, links, schluessel) {
      schritt();
      zahl(winkel, schluessel);
      s.richtung += links ? winkel : -winkel;
      s.richtung = ((s.richtung % 360) + 360) % 360 + 0;
    }
    const f = {
      vorwaerts(weg) {
        schritt();
        zahl(weg, 'vorwaerts');
        const r = s.richtung * Math.PI / 180;
        ziehe(s.x + weg * Math.cos(r), s.y + weg * Math.sin(r));
      },
      rechts(winkel) { dreh(winkel, false, 'rechts'); },
      links(winkel) { dreh(winkel, true, 'links'); },
      drehe(winkel) { dreh(winkel, false, 'drehe'); },
      stiftAb() { schritt(); s.stiftUnten = true; },
      stiftAuf() { schritt(); s.stiftUnten = false; offen = null; },
      geheZu(x, y) { schritt(); ziehe(zahl(x, 'geheZu'), zahl(y, 'geheZu')); },
      x() { schritt(); return s.x; },
      y() { schritt(); return s.y; },
      richtung() { schritt(); return s.richtung; },
      amRand() { schritt(); return Math.min(s.x, feld.breite - s.x, s.y, feld.hoehe - s.y) <= grenzen.RAND_MM + 1e-9; },
      zufall(a, b) {
        schritt();
        zufallBenutzt = true;
        const lo = Math.ceil(Math.min(zahl(a, 'zufall'), zahl(b, 'zufall'))), hi = Math.floor(Math.max(a, b));
        if (lo > hi) throw new Abbruch(text(T.zufallLeer, { a, b }));
        return lo + Math.floor(wuerfel() * (hi - lo + 1));
      },
      // Die Werte von „zähle von … bis …“ als Liste, gezählt wie in schildkroete.js (Richtung aus von und bis, Schritt als Betrag).
      zaehle(von, bis, ...rest) {
        zahl(von, 'zaehle');
        zahl(bis, 'zaehle');
        const betrag = Math.abs(zahl(rest.length ? rest[0] : 1, 'zaehle'));   // ohne Schritt: 1; ein leerer Wert ist ein Fehler
        if (betrag === 0) throw new Abbruch(T.schritt0);
        const vorzeichen = bis >= von ? 1 : -1;
        const anzahl = Math.floor(Math.abs(bis - von) / betrag * (1 + 1e-12)) + 1;
        schritt(anzahl);
        const werte = [];
        for (let k = 0; k < anzahl; k++) {
          const i = von + vorzeichen * k * betrag;
          const amZiel = vorzeichen * (i - bis) > 0 || Math.abs(i - bis) <= Math.abs(bis - von) * 1e-12;
          werte.push(amZiel ? bis : i);
        }
        return werte;
      },
    };
    const api = {};
    for (const [schluessel, ...schreibweisen] of namen) for (const name of schreibweisen) api[name] = f[schluessel];
    const ergebnis = () => ({ striche: striche.filter(st => st.length > 1), schildkroete: s, schritte, punkte, zufall: zufallBenutzt });
    return { api, Abbruch, ergebnis };
  }

  // Löscht im Worker alles außer den erlaubten Sprachmitteln, auch von den Prototypen des globalen Objekts, und nimmt
  // Funktionen ihren Konstruktor (sonst käme man über (function(){}).constructor wieder an eval heran).
  // Ergebnis: was danach noch erreichbar ist, also Namen aus gefaehrlich und jede Funktion oder jedes Objekt, das sich weder
  // löschen noch überschreiben ließ; leer heißt: dicht. Zahlen und Texte, die stehen bleiben, zählen nicht.
  function sperre(erlaubt, gefaehrlich) {
    const g = globalThis, rest = [];
    for (let o = g; o && o !== Object.prototype; o = Object.getPrototypeOf(o)) {
      for (const k of Reflect.ownKeys(o)) {
        if (o === g && erlaubt.includes(k)) continue;
        try { delete o[k]; } catch { /* nicht löschbar: unten überschreiben */ }
        if (!Object.prototype.hasOwnProperty.call(o, k)) continue;
        try { Object.defineProperty(o, k, { value: undefined, writable: false, configurable: false }); } catch { /* gleich prüfen */ }
        let wert;
        try { wert = o[k]; } catch { wert = o; }   // Zugriff wirft: wie ein Objekt behandeln
        if (wert !== null && (typeof wert === 'object' || typeof wert === 'function')) rest.push(String(k));
      }
    }
    for (const fn of [function () {}, function* () {}, async function () {}, async function* () {}]) {
      const p = Object.getPrototypeOf(fn);
      try { Object.defineProperty(p, 'constructor', { value: undefined, writable: false, configurable: false }); } catch { /* unten prüfen */ }
      if (p.constructor !== undefined) rest.push('Function');
    }
    for (const name of gefaehrlich) {
      let da;
      try { da = g[name] !== undefined; } catch { da = true; }
      if (da && !rest.includes(name)) rest.push(name);
    }
    return rest;
  }

  // Erste Anweisung im Worker: abschotten, Funktionen bereitstellen, Melder zurückgeben. Der Melder schickt genau einmal das Ergebnis.
  function vorspann(sperre, kern, d) {
    const g = globalThis, sende = g.postMessage.bind(g);
    const rest = sperre(d.erlaubt, d.gefaehrlich);
    if (rest.length) {
      sende({ typ: 'sperre', rest });
      throw new Error('sperre');   // bricht das Skript ab, bevor das Programm des Kinds beginnt
    }
    const k = kern(d.feld, d.startwert, d.grenzen, d.texte, d.namen, d.spalte);
    for (const [name, fn] of Object.entries(k.api)) Object.defineProperty(g, name, { value: fn, writable: false, configurable: false });
    let offen = true;
    return function (e) {
      if (!offen) return;
      offen = false;
      let fehler = null;
      if (e !== null) {
        fehler = { text: '?', name: '', zeile: 0, bekannt: e instanceof k.Abbruch };
        try {
          fehler.text = String(e && e.message !== undefined ? e.message : e).slice(0, d.textMax);
          fehler.name = String((e && e.name) || '').slice(0, 40);
          for (const m of String((e && e.stack) || '').matchAll(/:(\d+):\d+/g)) {
            const zeile = Number(m[1]) - d.versatz;
            if (zeile >= 1 && zeile <= d.zeilen) { fehler.zeile = zeile; break; }
          }
        } catch { /* Fehlerobjekt lässt sich nicht lesen */ }
      }
      try { sende({ typ: 'ergebnis', ...k.ergebnis(), fehler }); } catch { sende({ typ: 'kaputt' }); }   // Ergebnis nicht übertragbar
    };
  }

  // ---- Ende des Worker-Codes ----

  // Quelltext des Workers: Vorspann, dann ab Zeile versatz + 1 das Programm des Kinds, in einer eigenen Funktion
  // (so darf es eigene Variablen x oder y anlegen).
  function workerQuelle(code, o) {
    const sprache = o.sprache === 'en' ? 'en' : 'de';
    const grenzen = o.grenzen || Schildkroete;
    const d = { erlaubt: ERLAUBT, gefaehrlich: GEFAEHRLICH, feld: o.feld, startwert: o.startwert >>> 0, texte: TEXTE[sprache], namen: NAMEN,
      spalte: sprachIndex(sprache), zeilen: code.split('\n').length, versatz: 0, textMax: TEXT_MAX,
      grenzen: { PUNKTE_MAX: grenzen.PUNKTE_MAX, SCHRITTE_MAX: grenzen.SCHRITTE_MAX, RAND_MM: grenzen.RAND_MM } };
    const kopf = () => `'use strict';const __fertig=(${vorspann})(${sperre},${kern},${JSON.stringify(d)});try{(function(){`;
    d.versatz = kopf().split('\n').length;   // JSON steht auf einer Zeile, die Zahl ändert die Zeilenzahl nicht
    return { quelle: `${kopf()}\n${code}\n})();__fertig(null)}catch(e){__fertig(e)}`, versatz: d.versatz, zeilen: d.zeilen };
  }

  // Abstand zweier Wörter (Levenshtein), für „Meinst du …?“.
  function abstand(a, b) {
    let zeile = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const neu = [i];
      for (let j = 1; j <= b.length; j++) neu[j] = Math.min(neu[j - 1] + 1, zeile[j] + 1, zeile[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      zeile = neu;
    }
    return zeile[b.length];
  }

  function aehnlich(name, sprache) {
    const klein = name.toLowerCase();
    let bester = null, weit = 3;
    for (const n of NAMEN) for (const kandidat of [n[sprachIndex(sprache)], ...n.slice(1)]) {
      const a = abstand(klein, kandidat.toLowerCase());
      if (a < weit && a < name.length / 2 && kandidat !== name) { weit = a; bester = kandidat; }
    }
    return bester;
  }

  // Macht aus der Meldung des Browsers einen Satz für das Kind. Unbekanntes bleibt die Browsermeldung mit Zeile davor.
  function erklaere(f, sprache) {
    const T = TEXTE[sprache === 'en' ? 'en' : 'de'];
    const roh = String(f.text).replace(/^Uncaught\s+/, '');
    const mitZeile = t => (f.zeile ? fuelle(T.zeile, { n: f.zeile, text: t }) : t);
    if (f.bekannt) return mitZeile(roh);
    if (f.klammer) return mitZeile(T[f.klammer]);
    let m = /^(?:ReferenceError: )?(\S+) is not defined|Can't find variable: (\S+)/.exec(roh);
    if (m) {
      const name = m[1] || m[2], vorschlag = aehnlich(name, sprache);
      return mitZeile(fuelle(T.unbekannt, { name }) + (vorschlag ? fuelle(T.meinst, { name: vorschlag }) : ''));
    }
    m = /^(?:TypeError: )?(\S+) is not a function/.exec(roh);
    if (m) return mitZeile(fuelle(T.keineFunktion, { name: m[1] }));
    if (/missing [)}\]]|Unexpected end of|Unexpected token '?[)}\]]|expected expression, got '?[)}\]]|after argument list|Expected '[)}]'/.test(roh))
      return mitZeile(T.klammer);
    const kurz = roh.replace(/^[A-Za-z]*Error: /, '');
    if (f.syntax) return mitZeile(fuelle(T.syntax, { text: kurz }));
    return f.zeile ? fuelle(T.sonst, { n: f.zeile, text: kurz }) : fuelle(T.sonstOhne, { text: kurz });
  }

  // Grobe Zählung der Klammern, nur um die Meldung zu wählen (Texte und Kommentare zählen mit).
  // zuViel: Zeile der ersten schließenden Klammer ohne öffnende, sonst 0; offen: Zahl der nie geschlossenen.
  function klammerbilanz(code) {
    let offen = 0, zeile = 1;
    for (const c of code) {
      if (c === '\n') zeile++;
      else if (c === '(' || c === '{' || c === '[') offen++;
      else if ((c === ')' || c === '}' || c === ']') && --offen < 0) return { zuViel: zeile, offen: 0 };
    }
    return { zuViel: 0, offen };
  }

  // Prüft, was aus dem Worker kommt, bevor Vorschau und pruefen() damit rechnen: Der Worker ist nicht vertrauenswürdig.
  function gueltig(m, grenzen) {
    const endlich = v => typeof v === 'number' && Number.isFinite(v);
    if (!m || !Array.isArray(m.striche)) return false;
    let anzahl = 0;
    for (const st of m.striche) {
      if (!Array.isArray(st) || st.length < 2) return false;
      for (const p of st) if (!Array.isArray(p) || p.length !== 2 || !endlich(p[0]) || !endlich(p[1])) return false;
      anzahl += st.length;
    }
    const s = m.schildkroete;
    return anzahl <= grenzen.PUNKTE_MAX && Boolean(s) && endlich(s.x) && endlich(s.y) && endlich(s.richtung) && typeof s.stiftUnten === 'boolean';
  }

  // Führt code im Worker aus. o: feld, startwert, sprache, erzeugeWorker(quelle) → { beiNachricht, beiFehler, beende }, zeitlimit.
  // versprechen liefert { striche, schildkroete, schritte, punkte, zufall, fehler: Text oder null, zeile } wie ausfuehren(),
  // oder null, wenn abbrechen() vorher kam. Es wird nie abgelehnt.
  function laufe(code, o) {
    const sprache = o.sprache === 'en' ? 'en' : 'de', T = TEXTE[sprache], grenzen = o.grenzen || Schildkroete;
    const zeitlimit = o.zeitlimit || ZEITLIMIT_MS;
    let abbrechen = () => {};
    const versprechen = new Promise(fertig => {
      const leer = (fehler, zeile = 0) => ({ striche: [], schildkroete: null, schritte: 0, punkte: 0, zufall: /\b(zufall|random)\s*\(/.test(code), fehler, zeile });
      if (code.length > CODE_MAX) return fertig(leer(fuelle(T.zuLang, { n: CODE_MAX })));
      const verboten = /\bimport\b/.exec(code);
      if (verboten) {
        const zeile = code.slice(0, verboten.index).split('\n').length;
        return fertig(leer(fuelle(T.zeile, { n: zeile, text: T.import }), zeile));
      }
      const { quelle, versatz, zeilen } = workerQuelle(code, o);
      let arbeiter = null, uhr = null, erledigt = false;
      const schluss = r => {
        if (erledigt) return;
        erledigt = true;
        clearTimeout(uhr);
        try { if (arbeiter) arbeiter.beende(); } catch { /* schon beendet */ }
        fertig(r);
      };
      abbrechen = () => schluss(null);
      try { arbeiter = o.erzeugeWorker(quelle); } catch { return schluss(leer(T.sperre)); }
      arbeiter.beiNachricht(m => {
        if (!m || m.typ === 'sperre') return schluss(leer(T.sperre));
        if (m.typ !== 'ergebnis' || !gueltig(m, grenzen)) return schluss(leer(T.kaputt));
        const f = m.fehler && typeof m.fehler === 'object' ? m.fehler : null;
        const zeile = f && Number.isInteger(f.zeile) && f.zeile >= 1 && f.zeile <= zeilen ? f.zeile : 0;
        schluss({ striche: m.striche, schildkroete: m.schildkroete, schritte: Number(m.schritte) || 0, punkte: Number(m.punkte) || 0,
          zufall: Boolean(m.zufall), fehler: f ? erklaere({ text: String(f.text).slice(0, TEXT_MAX), zeile, bekannt: f.bekannt === true }, sprache) : null, zeile });
      });
      // Fehler, die der Worker nicht selbst fängt: vor allem Syntaxfehler, dann startet das Skript gar nicht.
      arbeiter.beiFehler(f => {
        const z = Number(f && f.zeile) - versatz;
        let zeile = z >= 1 ? Math.min(z, zeilen) : 0, klammer = null;
        if (z > zeilen) {   // Der Fehler fällt erst hinter dem Programm auf: Die Klammern gehen nicht auf.
          const bilanz = klammerbilanz(code);
          klammer = bilanz.zuViel ? 'klammerZuViel' : bilanz.offen ? 'klammerEnde' : 'klammerUnklar';
          if (bilanz.zuViel) zeile = bilanz.zuViel;
        }
        schluss(leer(erklaere({ text: String((f && f.text) || '?').slice(0, TEXT_MAX), zeile, klammer, syntax: true }, sprache), zeile));
      });
      uhr = setTimeout(() => schluss(leer(fuelle(T.zeit, { s: String(zeitlimit / 1000).replace('.', sprache === 'en' ? '.' : ',') }))), zeitlimit);
    });
    return { versprechen, abbrechen: () => abbrechen() };
  }

  return { ZEITLIMIT_MS, CODE_MAX, TEXT_MAX, NAMEN, ERLAUBT, GEFAEHRLICH, TEXTE, nameVon, kern, sperre, workerQuelle, erklaere, gueltig, laufe };
}));
