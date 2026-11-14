// Editor für den JavaScript-Modus von „Im Browser ausprobieren“: ein schlichtes <textarea> mit Zeilennummern,
// Einrücken beim Zeilenwechsel und einer markierten Fehlerzeile. Kein Editor-Framework.
// Dazu der Worker für skript.js: Das Programm läuft in einem eigenen Web Worker aus einem Blob, nie in dieser Seite.
'use strict';
(function (wurzel) {
  // Schnittstelle, die Skript.laufe erwartet. Syntaxfehler meldet der Browser als error-Ereignis mit Zeilennummer.
  function erzeugeWorker(quelle) {
    const adresse = URL.createObjectURL(new Blob([quelle], { type: 'text/javascript' }));
    const arbeiter = new Worker(adresse);
    return {
      beiNachricht: melde => { arbeiter.onmessage = e => melde(e.data); },
      beiFehler: melde => { arbeiter.onerror = e => { e.preventDefault(); melde({ text: e.message, zeile: e.lineno }); }; },
      beende: () => { arbeiter.terminate(); URL.revokeObjectURL(adresse); },
    };
  }

  function erzeuge(feld, leiste, fehlerzeile) {
    const nummern = document.createElement('div');
    leiste.appendChild(nummern);
    let vorlage = '', markiert = 0;

    // Eine Nummer je Zeile; die Zahlen selbst malt CSS (Zähler), die Fehlerzeile bekommt eine Klasse.
    function auffrischen() {
      const anzahl = feld.value.split('\n').length;
      while (nummern.childElementCount < anzahl) nummern.appendChild(document.createElement('span'));
      while (nummern.childElementCount > anzahl) nummern.lastElementChild.remove();
      for (let i = 0; i < anzahl; i++) nummern.children[i].classList.toggle('fehler', i + 1 === markiert);
      nummern.style.transform = `translateY(${-feld.scrollTop}px)`;
    }

    function zeigeFehler(text, zeile) {
      markiert = text ? zeile || 0 : 0;
      fehlerzeile.textContent = text || '';
      fehlerzeile.hidden = !text;
      auffrischen();
    }

    // Zeilenwechsel: Einrückung der Zeile übernehmen, nach { zwei Leerzeichen mehr. Eine } in einer leeren Zeile rückt zwei zurück.
    feld.addEventListener('keydown', e => {
      if ((e.key !== 'Enter' && e.key !== '}') || e.isComposing || e.ctrlKey || e.metaKey) return;
      const davor = feld.value.slice(0, feld.selectionStart);
      const zeile = davor.slice(davor.lastIndexOf('\n') + 1);
      let neu;
      if (e.key === 'Enter') neu = `\n${/^[ \t]*/.exec(zeile)[0]}${/\{\s*$/.test(zeile) ? '  ' : ''}`;
      else if (feld.selectionStart === feld.selectionEnd && /^ *  $/.test(zeile)) { neu = '}'; feld.selectionStart -= 2; }
      else return;
      e.preventDefault();
      // execCommand erhält „Rückgängig“ im Browser; wo es fehlt, direkt einsetzen.
      if (!document.execCommand || !document.execCommand('insertText', false, neu)) {
        feld.setRangeText(neu, feld.selectionStart, feld.selectionEnd, 'end');
        feld.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    feld.addEventListener('input', () => { markiert = 0; auffrischen(); });
    feld.addEventListener('scroll', auffrischen);

    return {
      text: () => feld.value,
      setze(text) { feld.value = vorlage = text; feld.scrollTop = 0; zeigeFehler(null, 0); },
      geaendert: () => feld.value !== vorlage && feld.value.trim() !== '',
      zeigeFehler, auffrischen,
    };
  }

  wurzel.JsEditor = { erzeuge, erzeugeWorker };
}(window));
