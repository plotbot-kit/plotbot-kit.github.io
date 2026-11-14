// „Als JavaScript zeigen“: druckt ein Blockprogramm (Blockly-JSON, wie schildkroete.js es ausführt) als lesbares JavaScript
// mit den Funktionen aus skript.js. Eigener Drucker über den Baum, kein Blockly-Generator, kein DOM.
// Nur diese Richtung: Aus JavaScript werden keine Blöcke.
// Der Test lässt jedes Beispiel durch beide Wege laufen und verlangt dieselben Striche. Damit das auch in Randfällen
// stimmt, druckt er die schlichte for-Schleife nur, wo sie genau so zählt wie der Block, sonst for … of zaehle(…).
'use strict';
(function (wurzel, fabrik) {
  if (typeof module === 'object' && module.exports) module.exports = fabrik(require('./skript.js'));
  else wurzel.BlockJs = fabrik(wurzel.Skript);
}(typeof self !== 'undefined' ? self : this, function (Skript) {
  const RESERVIERT = new Set(['break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default', 'delete', 'do', 'else', 'enum',
    'export', 'extends', 'false', 'finally', 'for', 'function', 'if', 'import', 'in', 'instanceof', 'new', 'null', 'return', 'super', 'switch',
    'this', 'throw', 'true', 'try', 'typeof', 'var', 'void', 'while', 'with', 'yield', 'let', 'static', 'await', 'async', 'of', 'implements',
    'interface', 'package', 'private', 'protected', 'public', 'arguments', 'eval', 'undefined', 'NaN', 'Infinity', ...Skript.ERLAUBT,
    ...Skript.NAMEN.flat()]);
  const ZAEHLER = ['i', 'j', 'k', 'm', 'n', 'p', 'q'];
  const TEXTE = {
    de: { fehlt: 'hier fehlt ein Wert', unbekannt: 'Diesen Block kenne ich nicht', aus: 'ausgeschaltet' },
    en: { fehlt: 'a value is missing here', unbekannt: 'Unknown block', aus: 'switched off' },
  };
  // Vorrang der Operatoren in JavaScript, nur so weit die Blöcke sie brauchen.
  const V = { oder: 1, und: 2, gleich: 3, vergleich: 4, plus: 5, mal: 6, vor: 7, atom: 8 };
  const RECHNEN = { ADD: ['+', V.plus], MINUS: ['-', V.plus], MULTIPLY: ['*', V.mal], DIVIDE: ['/', V.mal] };
  const VERGLEICH = { EQ: ['===', V.gleich], NEQ: ['!==', V.gleich], LT: ['<', V.vergleich], LTE: ['<=', V.vergleich], GT: ['>', V.vergleich], GTE: ['>=', V.vergleich] };
  const LOGIK = { AND: ['&&', V.und], OR: ['||', V.oder] };

  const aktiv = b => !(b.enabled === false || (Array.isArray(b.disabledReasons) && b.disabledReasons.length > 0));
  const varId = b => { const v = b.fields && b.fields.VAR; return v && (v.id || v.name); };
  const naechster = b => (b.next && b.next.block) || null;
  // Der Block in einem Eingang; ein deaktivierter zählt als leer, auch über einem Schatten (wie in schildkroete.js).
  const inhalt = e => (e ? (e.block ? (aktiv(e.block) ? e.block : null) : e.shadow || null) : null);
  const kinder = b => Object.values(b.inputs || {}).flatMap(e => (e ? [e.block, e.shadow] : [])).concat(naechster(b)).filter(Boolean);

  // Geht alle Blöcke ab b durch, ohne Rekursion.
  function jeder(b, tu) {
    const offen = b ? [b] : [];
    while (offen.length) {
      const x = offen.pop();
      tu(x);
      offen.push(...kinder(x));
    }
  }

  function startblock(programm) {
    if (!programm) return null;
    if (programm.type === 'zr_start') return programm;
    const oben = programm.blocks && programm.blocks.blocks;
    return (Array.isArray(oben) && oben.find(b => b && b.type === 'zr_start')) || null;
  }

  // Namen der Variablen als gültige, freie JavaScript-Namen.
  function namensliste(programm, ids) {
    const bekannt = new Map((programm.variables || []).map(v => [v.id, v.name]));
    const vergeben = new Set(), namen = new Map();
    for (const id of ids) {
      let name = String(bekannt.get(id) || id).normalize('NFC').replace(/[^\p{L}\p{N}_$]/gu, '_');
      if (!name || /^\p{N}/u.test(name)) name = `_${name}`;
      if (RESERVIERT.has(name)) name += '_';
      for (let n = 2, basis = name; vergeben.has(name); n++) name = `${basis}${n}`;
      vergeben.add(name);
      namen.set(id, name);
    }
    return namen;
  }

  // Druckt das Programm unter dem Startblock. programm: Zustand von Blockly.serialization.workspaces.save oder der Startblock.
  function alsJavaScript(programm, optionen = {}) {
    const sprache = optionen.sprache === 'en' ? 'en' : 'de', T = TEXTE[sprache];
    const N = schluessel => Skript.nameVon(schluessel, sprache);
    const start = startblock(programm);
    if (!start) return '';

    // Welche Variablen es gibt, wie oft sie vorkommen und ob jemand außer einer Zählschleife sie setzt.
    const vorkommen = new Map(), gesetzt = new Set(), schleifen = new Map();
    jeder(naechster(start), b => {
      const id = varId(b);
      if (id === undefined || id === null || !/^(variables_|math_change|controls_for)/.test(b.type)) return;
      vorkommen.set(id, (vorkommen.get(id) || 0) + 1);
      if (b.type === 'variables_set' || b.type === 'math_change') gesetzt.add(id);
      if (b.type === 'controls_for') schleifen.set(id, (schleifen.get(id) || 0) + 1);
    });
    const namen = namensliste(programm.variables ? programm : {}, vorkommen.keys());
    // Eine Zählvariable gehört nur ihrer Schleife, wenn sie nirgends sonst vorkommt: dann genügt „let“ im Schleifenkopf.
    const lokal = new Set();
    jeder(naechster(start), b => {
      if (b.type !== 'controls_for') return;
      const id = varId(b);
      let innen = 0;
      jeder(b.inputs && b.inputs.DO && b.inputs.DO.block, x => { if (varId(x) === id && /^(variables_|math_change|controls_for)/.test(x.type)) innen++; });
      if (schleifen.get(id) === 1 && !gesetzt.has(id) && vorkommen.get(id) === innen + 1) lokal.add(id);
    });
    const belegt = new Set(namen.values());
    const zaehler = ZAEHLER.filter(z => !belegt.has(z));

    const fehlt = () => ({ t: `undefined /* ${T.fehlt} */`, v: V.atom });
    const ganz = b => (b && b.type === 'math_number' && Number.isSafeInteger(Number(b.fields && b.fields.NUM)) ? Number(b.fields.NUM) : null);
    const klammer = (a, mindestens) => (a.v < mindestens ? `(${a.t})` : a.t);

    function zweistellig(b, tabelle) {
      const [zeichen, v] = tabelle[b.fields && b.fields.OP] || [];
      if (!zeichen) return fehlt();
      const ein = b.inputs || {}, links = wert(ein.A), rechts = wert(ein.B);
      // Rechts auch bei gleichem Vorrang klammern (a - (b - c)); „und“ in „oder“ und negative Zahlen rechts der Lesbarkeit wegen.
      const l = links.v < v || (v === V.oder && links.v === V.und) ? `(${links.t})` : links.t;
      const r = rechts.v <= v || (v === V.oder && rechts.v === V.und) || rechts.t.startsWith('-') ? `(${rechts.t})` : rechts.t;
      return { t: `${l} ${zeichen} ${r}`, v };
    }

    function wert(eingang) {
      const b = inhalt(eingang);
      if (!b) return fehlt();
      const ein = b.inputs || {};
      switch (b.type) {
        case 'math_number': { const n = Number(b.fields && b.fields.NUM); return { t: String(n), v: n < 0 ? V.vor : V.atom }; }
        case 'variables_get': return { t: namen.get(varId(b)), v: V.atom };
        case 'math_arithmetic': return zweistellig(b, RECHNEN);
        case 'logic_compare': return zweistellig(b, VERGLEICH);
        case 'logic_operation': return zweistellig(b, LOGIK);
        case 'logic_negate': return { t: `!${klammer(wert(ein.BOOL), V.vor)}`, v: V.vor };
        case 'logic_boolean': return { t: (b.fields && b.fields.BOOL) === 'TRUE' ? 'true' : 'false', v: V.atom };
        case 'math_random_int': return { t: `${N('zufall')}(${wert(ein.FROM).t}, ${wert(ein.TO).t})`, v: V.atom };
        case 'zr_x': return { t: 'x()', v: V.atom };
        case 'zr_y': return { t: 'y()', v: V.atom };
        case 'zr_richtung': return { t: `${N('richtung')}()`, v: V.atom };
        case 'zr_am_rand': return { t: `${N('amRand')}()`, v: V.atom };
        default: return fehlt();
      }
    }

    const zeilen = [];
    const schreibe = (tiefe, text) => zeilen.push('  '.repeat(tiefe) + text);

    // zähle von … bis …: schlichte for-Schleife nur mit ganzen Zahlen im Kopf und eigener Variable, sonst die Liste aus zaehle().
    function zaehlkopf(b) {
      const ein = b.inputs || {}, id = varId(b), name = namen.get(id);
      const von = ganz(inhalt(ein.FROM)), bis = ganz(inhalt(ein.TO)), weite = ganz(inhalt(ein.BY));
      if (lokal.has(id) && von !== null && bis !== null && weite !== null && weite !== 0) {
        const s = Math.abs(weite), hoch = bis >= von;
        const weiter = s === 1 ? `${name}${hoch ? '++' : '--'}` : `${name} ${hoch ? '+=' : '-='} ${s}`;
        return `for (let ${name} = ${von}; ${name} ${hoch ? '<=' : '>='} ${bis}; ${weiter}) {`;
      }
      const dritte = inhalt(ein.BY) && weite === 1 ? '' : `, ${wert(ein.BY).t}`;
      return `for (${lokal.has(id) ? 'let ' : ''}${name} of ${N('zaehle')}(${wert(ein.FROM).t}, ${wert(ein.TO).t}${dritte})) {`;
    }

    function wiederholkopf(b, ebene) {
      const z = zaehler[ebene] || `z${ebene + 1}`;
      const fest = inhalt(b.inputs && b.inputs.TIMES);
      if (fest && fest.type === 'math_number' && Number.isFinite(Number(fest.fields && fest.fields.NUM)))
        return `for (let ${z} = 0; ${z} < ${Math.floor(Number(fest.fields.NUM))}; ${z}++) {`;
      // Die Anzahl einmal ausrechnen, wie der Block es tut, nicht bei jeder Runde neu.
      return `for (let ${z} = 0, ${z}Ende = Math.floor(${wert(b.inputs && b.inputs.TIMES).t}); ${z} < ${z}Ende; ${z}++) {`;
    }

    function stapel(b, tiefe, ebene) {
      for (; b; b = naechster(b)) {
        if (!aktiv(b)) { schreibe(tiefe, `// (${T.aus})`); continue; }
        const notiz = b.icons && b.icons.comment && b.icons.comment.text;
        if (notiz) for (const z of String(notiz).split(/\r\n|[\n\r\u2028\u2029]/)) schreibe(tiefe, `// ${z}`.trimEnd());
        const ein = b.inputs || {};
        const rumpf = (eingang, e = ebene) => stapel(eingang && eingang.block, tiefe + 1, e);
        switch (b.type) {
          case 'zr_stift_ab': schreibe(tiefe, `${N('stiftAb')}();`); break;
          case 'zr_stift_auf': schreibe(tiefe, `${N('stiftAuf')}();`); break;
          case 'zr_vorwaerts': schreibe(tiefe, `${N('vorwaerts')}(${wert(ein.WEG).t});`); break;
          case 'zr_drehe': schreibe(tiefe, `${N((b.fields && b.fields.RICHTUNG) === 'LINKS' ? 'links' : 'rechts')}(${wert(ein.WINKEL).t});`); break;
          case 'zr_gehe_zu': schreibe(tiefe, `${N('geheZu')}(${wert(ein.X).t}, ${wert(ein.Y).t});`); break;
          case 'variables_set': schreibe(tiefe, `${namen.get(varId(b))} = ${wert(ein.VALUE).t};`); break;
          case 'math_change': schreibe(tiefe, `${namen.get(varId(b))} += ${wert(ein.DELTA).t};`); break;
          case 'controls_repeat_ext':
            schreibe(tiefe, wiederholkopf(b, ebene));
            rumpf(ein.DO, ebene + 1);
            schreibe(tiefe, '}');
            break;
          case 'controls_for':
            schreibe(tiefe, zaehlkopf(b));
            rumpf(ein.DO);
            schreibe(tiefe, '}');
            break;
          case 'controls_if': {
            const zweige = 1 + Math.max(0, Math.floor(Number(b.extraState && b.extraState.elseIfCount) || 0));
            for (let i = 0; i < zweige; i++) {
              schreibe(tiefe, `${i ? '} else ' : ''}if (${wert(ein[`IF${i}`]).t}) {`);
              rumpf(ein[`DO${i}`]);
            }
            if (ein.ELSE || (b.extraState && b.extraState.hasElse)) {
              schreibe(tiefe, '} else {');
              rumpf(ein.ELSE);
            }
            schreibe(tiefe, '}');
            break;
          }
          default: schreibe(tiefe, `// ${T.unbekannt}: ${String(b.type).replace(/[^\w]/g, '')}`);
        }
      }
    }

    try {
      stapel(naechster(start), 0, 0);
    } catch (e) {
      if (!(e instanceof RangeError)) throw e;
      return `// ${sprache === 'en' ? 'The program is nested too deeply.' : 'Das Programm ist zu tief verschachtelt.'}\n`;
    }
    const global = [...namen].filter(([id]) => !lokal.has(id)).map(([, name]) => `let ${name} = 0;`);
    const text = (global.length && zeilen.length ? [...global, '', ...zeilen] : [...global, ...zeilen]).join('\n');
    return text ? `${text}\n` : '';
  }

  return { alsJavaScript };
}));
