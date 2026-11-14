// „Im Browser ausprobieren“: Blöcke zusammensetzen und einem simulierten PlotBot beim Zeichnen zusehen.
// Angepasst aus der Blockly-Seite der PlotBot-Firmware (Blöcke, Thema, Werkzeugleiste, Laden der Demos).
// Dazu der JavaScript-Modus: dasselbe Programm getippt statt gesteckt (js-editor.js, skript.js, block-js.js).
// Weggelassen: Senden an den Roboter, Zustand vom Roboter, Speichern, Export und Import. Diese Seite spricht mit keinem Gerät.
// Texte der Bedienung stehen im HTML (data-Attribute), Texte der Blöcke in texte.js, damit die deutsche und die englische Seite dieselbe Datei nutzen.
'use strict';
(function () {
  const $ = id => document.getElementById(id);
  const werkzeug = $('werkzeug');
  if (!werkzeug || typeof Blockly === 'undefined' || typeof Texte === 'undefined') return;
  const TEXT = werkzeug.dataset;
  const sprache = document.documentElement.lang === 'en' ? 'en' : 'de';
  const fuelle = (vorlage, werte) => vorlage.replace(/\{(\w+)\}/g, (_, k) => String(werte[k]));

  // Keine Hilfe aus dem Internet und ein schlankes Kontextmenü, wie auf dem Roboter.
  for (const k of Object.keys(Blockly.Msg)) if (k.endsWith('_HELPURL')) Blockly.Msg[k] = '';
  for (const eintrag of ['blockHelp', 'blockInline', 'blockCollapseExpand'])
    if (Blockly.ContextMenuRegistry.registry.getItem(eintrag)) Blockly.ContextMenuRegistry.registry.unregister(eintrag);

  // Eigene Blöcke der Schildkröte wie in der Firmware. Was auf ihnen steht, kommt aus texte.js in der Sprache der Seite;
  // Typen, Feldnamen und gespeicherte Werte sind in beiden Sprachen gleich.
  const eigen = (type, rest) => {
    const t = Texte.block(type, sprache);
    return { type, message0: t.text, ...(t.tipp ? { tooltip: t.tipp } : {}), ...rest };
  };
  const auswahl = type => Object.entries(Texte.block(type, sprache).optionen).map(([wert, text]) => [text, wert]);
  const anweisung = { previousStatement: null, nextStatement: null };
  const zahlEingang = name => ({ type: 'input_value', name, check: 'Number' });
  Blockly.common.defineBlocksWithJsonArray([
    eigen('zr_start', { nextStatement: null, colour: 45 }),
    eigen('zr_stift_ab', { ...anweisung, style: 'stift_blocks' }),
    eigen('zr_stift_auf', { ...anweisung, style: 'stift_blocks' }),
    eigen('zr_vorwaerts', { args0: [zahlEingang('WEG')], inputsInline: true, ...anweisung, style: 'bewegen_blocks' }),
    eigen('zr_drehe', { args0: [{ type: 'field_dropdown', name: 'RICHTUNG', options: auswahl('zr_drehe') }, zahlEingang('WINKEL')],
      inputsInline: true, ...anweisung, style: 'bewegen_blocks' }),
    eigen('zr_gehe_zu', { args0: [zahlEingang('X'), zahlEingang('Y')], inputsInline: true, ...anweisung, style: 'bewegen_blocks' }),
    eigen('zr_x', { output: 'Number', style: 'bewegen_blocks' }),
    eigen('zr_y', { output: 'Number', style: 'bewegen_blocks' }),
    eigen('zr_richtung', { output: 'Number', style: 'bewegen_blocks' }),
    eigen('zr_am_rand', { output: 'Boolean', style: 'bewegen_blocks' }),
  ]);

  // Jede Kategorie hat eine eigene Farbe, ihre Blöcke tragen dieselbe.
  const FARBEN = { stift: '#a5745b', bewegen: '#5b67a5', wiederholen: '#5ba55b', logik: '#4a9ba5', zahlen: '#995ba5', variablen: '#a55b80' };
  const block = farbe => ({ colourPrimary: farbe });
  const THEMA = Blockly.Theme.defineTheme('zeichenroboter', {
    base: Blockly.Themes.Classic,
    blockStyles: {
      stift_blocks: block(FARBEN.stift), bewegen_blocks: block(FARBEN.bewegen), loop_blocks: block(FARBEN.wiederholen),
      logic_blocks: block(FARBEN.logik), math_blocks: block(FARBEN.zahlen),
      variable_blocks: block(FARBEN.variablen), variable_dynamic_blocks: block(FARBEN.variablen),
    },
    categoryStyles: Object.fromEntries(Object.entries(FARBEN).map(([name, colour]) => [name, { colour }])),
  });

  const kategorie = (name, rest) => ({ kind: 'category', name: Texte.kategorie(name, sprache), categorystyle: name, ...rest });
  const zahl = n => ({ shadow: { type: 'math_number', fields: { NUM: n } } });
  const BEISPIEL = Programme.DEMOS[0].programm;
  const WERKZEUGE = {
    kind: 'categoryToolbox',
    contents: [
      kategorie('stift', { contents: [
        { kind: 'block', type: 'zr_stift_ab' }, { kind: 'block', type: 'zr_stift_auf' },
      ] }),
      kategorie('bewegen', { contents: [
        { kind: 'block', type: 'zr_vorwaerts', inputs: { WEG: zahl(10) } },
        { kind: 'block', type: 'zr_drehe', inputs: { WINKEL: zahl(90) } },
        { kind: 'block', type: 'zr_gehe_zu', inputs: { X: zahl(40), Y: zahl(40) } },
        { kind: 'block', type: 'zr_am_rand' }, { kind: 'block', type: 'zr_x' }, { kind: 'block', type: 'zr_y' },
        { kind: 'block', type: 'zr_richtung' },
      ] }),
      kategorie('wiederholen', { contents: [
        { kind: 'block', type: 'controls_repeat_ext', inputs: { TIMES: zahl(4) } },
        { kind: 'block', type: 'controls_for', inputs: { FROM: zahl(1), TO: zahl(10), BY: zahl(1) } },
      ] }),
      kategorie('logik', { contents: [
        { kind: 'block', type: 'controls_if' },
        { kind: 'block', type: 'controls_if', extraState: { hasElse: true } },
        { kind: 'block', type: 'logic_compare', inputs: { A: zahl(0), B: zahl(0) } },
        { kind: 'block', type: 'logic_operation' }, { kind: 'block', type: 'logic_negate' }, { kind: 'block', type: 'logic_boolean' },
      ] }),
      kategorie('zahlen', { contents: [
        { kind: 'block', type: 'math_number', fields: { NUM: 10 } },
        { kind: 'block', type: 'math_arithmetic', inputs: { A: zahl(1), B: zahl(1) } },
        { kind: 'block', type: 'math_random_int', inputs: { FROM: zahl(1), TO: zahl(10) } },
      ] }),
      kategorie('variablen', { custom: 'VARIABLE' }),
    ],
  };

  werkzeug.hidden = false;   // erst sichtbar machen, sonst misst Blockly 0 × 0
  const arbeitsbereich = Blockly.inject('arbeitsbereich', {
    toolbox: WERKZEUGE, theme: THEMA, media: '../../vendor/blockly/', sounds: false, comments: true, trashcan: true,
    renderer: 'zelos',
    zoom: { controls: true, wheel: true, pinch: true, startScale: document.getElementById('arbeitsbereich').offsetWidth < 500 ? 0.6 : 0.85, maxScale: 1.5, minScale: 0.3 },
    move: { scrollbars: true, drag: true, wheel: false },
  });
  window.plotbotArbeitsbereich = arbeitsbereich;   // für Tests im Browser

  const roboter = RoboterVorschau.erzeuge($('zeichnung'));
  const feld = Schildkroete.feldAus(RoboterVorschau.MASCHINENFELD);
  const startBlock = () => arbeitsbereich.getBlocksByType('zr_start', false)[0];
  const melde = (text, fehler) => { $('meldung').textContent = text; $('meldung').classList.toggle('fehler', Boolean(fehler)); };
  let pruefung = null, ergebnis = null;
  let modus = 'bloecke';   // oder 'js'
  const editor = JsEditor.erzeuge($('js-text'), $('js-zeilen'), $('js-fehler'));
  let lauf = null;         // laufendes JavaScript-Programm im Worker
  let startwert = Math.floor(Math.random() * 4294967296);

  function ladeProgramm(programm) {
    try { Blockly.serialization.workspaces.load(programm, arbeitsbereich); } catch { /* unten: Startbelegung */ }
    if (!startBlock()) Blockly.serialization.workspaces.load(BEISPIEL, arbeitsbereich);
    startBlock().setDeletable(false);
    arbeitsbereich.scroll(0, 0);
  }

  function knoepfe() {
    const laeuft = roboter.laeuft();
    $('los').disabled = laeuft || !pruefung || !pruefung.sendbar;
    $('stopp').textContent = laeuft ? TEXT.stopp : TEXT.neu;
  }

  // Zeigt gestrichelt, was gezeichnet würde, und sagt, ob es aufs Blatt passt.
  function zeige(neu) {
    ergebnis = neu;
    pruefung = Schildkroete.pruefen(ergebnis, feld);
    roboter.zeige(ergebnis.striche, pruefung.aussen);
    if (pruefung.sendbar) melde(fuelle(TEXT.bereit, { n: pruefung.anzahl }));
    else if (modus === 'js' && pruefung.anzahl === 0 && !ergebnis.fehler) melde(TEXT.leerJs);
    else if (modus === 'js' && !ergebnis.fehler && pruefung.aussen.length && TEXT.aussen)   // englische Seite: eigener Text statt des deutschen aus pruefen()
      melde(fuelle(pruefung.aussen.length === 1 ? TEXT.aussenEins : TEXT.aussen, { n: pruefung.aussen.length }), true);
    else melde(Texte.meldung(pruefung.grund, sprache), pruefung.anzahl > 0 || Boolean(ergebnis.fehler));
    knoepfe();
  }

  // Rechnet das Programm durch: die Blöcke sofort, das JavaScript in einem Worker (skript.js).
  function aktualisieren() {
    if (lauf) lauf.abbrechen();
    lauf = null;
    if (modus === 'js') return aktualisiereJs();
    const programm = Blockly.serialization.blocks.save(startBlock(), { addCoordinates: false, addInputBlocks: true, addNextBlocks: true });
    $('wuerfeln').hidden = !Schildkroete.enthaeltZufall(programm);
    zeige(Schildkroete.ausfuehren(programm, feld, startwert));
  }

  function aktualisiereJs() {
    const meiner = lauf = Skript.laufe(editor.text(), { feld, startwert, sprache, erzeugeWorker: JsEditor.erzeugeWorker });
    meiner.versprechen.then(neu => {
      if (!neu || meiner !== lauf) return;   // überholt oder abgebrochen
      lauf = null;
      $('wuerfeln').hidden = !neu.zufall;
      editor.zeigeFehler(neu.fehler, neu.zeile);
      if (!neu.fehler) return zeige(neu);
      // Bei einem Fehler bleibt die letzte Vorschau stehen, damit sie beim Tippen nicht flackert; gezeichnet wird erst wieder ohne Fehler.
      pruefung = null;
      melde(neu.fehler, true);
      knoepfe();
    });
  }

  // Blöcke und JavaScript sind zwei Ansichten mit je eigenem Programm; nur „Als JavaScript zeigen“ überträgt, und nur in diese Richtung.
  function setzeModus(neu) {
    modus = neu;
    const js = modus === 'js';
    $('arbeitsbereich').hidden = js;
    $('hinweis-bloecke').hidden = js;
    $('als-js').hidden = js;
    $('js-bereich').hidden = !js;
    $('modus-bloecke').setAttribute('aria-pressed', String(!js));
    $('modus-js').setAttribute('aria-pressed', String(js));
    roboter.zuruecksetzen();
    roboter.zeige([], []);   // die Vorschau der anderen Ansicht nicht stehen lassen
    if (js) editor.auffrischen();
    else Blockly.svgResize(arbeitsbereich);
    aktualisieren();
  }

  const alsJavaScript = programm => BlockJs.alsJavaScript(programm, { sprache });

  function zeichnen() {
    if (!pruefung || !pruefung.sendbar) return;
    const tempo = Number($('tempo').value) || 1;
    roboter.start(ergebnis.striche, tempo,
      anteil => { $('meldung').textContent = fuelle(TEXT.zeichnet, { p: Math.round(anteil * 100) }); },
      abgebrochen => { melde(abgebrochen ? TEXT.gestoppt : TEXT.fertig); knoepfe(); });
    knoepfe();
    zurZeichnung();
  }

  // Auf dem Handy liegt die Zeichnung unter den Blöcken: dorthin scrollen, wenn sie nicht ganz zu sehen ist.
  function zurZeichnung() {
    const r = $('zeichnung').getBoundingClientRect();
    if (r.top >= 0 && r.bottom <= window.innerHeight) return;
    const ruhig = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    $('zeichnung').scrollIntoView({ behavior: ruhig ? 'auto' : 'smooth', block: 'center' });
  }

  let warte = null;
  const spaeter = () => {
    clearTimeout(warte);
    roboter.stopp();
    pruefung = null;
    knoepfe();
    warte = setTimeout(aktualisieren, modus === 'js' ? 400 : 150);
  };
  $('js-text').addEventListener('input', spaeter);
  $('modus-bloecke').addEventListener('click', () => setzeModus('bloecke'));
  $('modus-js').addEventListener('click', () => setzeModus('js'));
  $('als-js').addEventListener('click', () => {
    if (editor.geaendert() && !window.confirm(TEXT.ueberschreiben)) return;
    editor.setze(alsJavaScript(Blockly.serialization.workspaces.save(arbeitsbereich)));
    setzeModus('js');
  });
  arbeitsbereich.addChangeListener(e => {
    if (!e.isUiEvent && modus !== 'js') spaeter();
  });

  $('los').addEventListener('click', zeichnen);
  $('stopp').addEventListener('click', () => {
    if (roboter.laeuft()) roboter.stopp();
    else { roboter.zuruecksetzen(); aktualisieren(); }
  });
  $('wuerfeln').addEventListener('click', () => { startwert = Math.floor(Math.random() * 4294967296); aktualisieren(); });
  $('beispiel').addEventListener('change', e => {
    const demo = Programme.DEMOS[Number(e.target.value)];
    if (!demo) return;
    if (modus === 'js' && editor.geaendert() && !window.confirm(TEXT.ueberschreiben)) { e.target.value = ''; return; }
    roboter.zuruecksetzen();
    if (modus === 'js') editor.setze(alsJavaScript(demo.programm));   // im JavaScript-Modus bleiben die Blöcke, wie sie sind
    else ladeProgramm(demo.programm);
    aktualisieren();
  });

  ladeProgramm(BEISPIEL);
  editor.setze(alsJavaScript(BEISPIEL));
  aktualisieren();
  window.addEventListener('resize', () => { if (modus !== 'js') Blockly.svgResize(arbeitsbereich); });
}());
