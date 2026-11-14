// Gemeinsames für die Tests: lädt die Module der Seite und stellt einen Worker bereit, der sich für skript.js wie der
// Web Worker im Browser verhält (node:worker_threads statt Blob-Worker).
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Worker } = require('node:worker_threads');

const ORDNER = path.join(__dirname, '..', 'js', 'try');
const Schildkroete = require(path.join(ORDNER, 'schildkroete.js'));
const Skript = require(path.join(ORDNER, 'skript.js'));
const BlockJs = require(path.join(ORDNER, 'block-js.js'));

// beispiele.js hängt sich an window; hier bekommt es ein leeres.
const fenster = {};
vm.runInNewContext(fs.readFileSync(path.join(ORDNER, 'beispiele.js'), 'utf8'), { window: fenster });
const DEMOS = JSON.parse(JSON.stringify(fenster.Programme.DEMOS));

const FELD = Schildkroete.feldAus([-40, 40, 35, 115]);
const startVon = programm => programm.blocks.blocks.find(b => b.type === 'zr_start');

// Dieselbe Schnittstelle wie der Blob-Worker der Seite. Die Zeile davor steht ohne Umbruch, damit Zeilennummern stimmen.
const laufende = new Set();
function erzeugeWorker(quelle) {
  const vorweg = "'use strict';globalThis.postMessage=(p=>m=>p.postMessage(m))(require('node:worker_threads').parentPort);";
  const w = new Worker(vorweg + quelle, { eval: true });
  laufende.add(w);
  return {
    beiNachricht: cb => w.on('message', cb),
    beiFehler: cb => w.on('error', e => {
      const m = /\[worker eval\]:(\d+)/.exec(String(e && e.stack));
      cb({ text: `${e && e.name}: ${e && e.message}`, zeile: m ? Number(m[1]) : 0 });
    }),
    beende: () => { laufende.delete(w); return w.terminate(); },
  };
}

const laufe = (code, o = {}) => Skript.laufe(code, { feld: FELD, startwert: 1, sprache: 'de', erzeugeWorker, ...o }).versprechen;

module.exports = { Schildkroete, Skript, BlockJs, DEMOS, FELD, startVon, erzeugeWorker, laufe, laufende };
