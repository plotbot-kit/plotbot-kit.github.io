/* PlotBot-Kinematiksimulator – Bedienung: Regler, Maus, Overlays, Testfiguren, JSON, Messwert-Anzeige.
   Angepasst aus dem PlotBot-Kinematiksimulator (ohne Fehlermodell, Texte zweisprachig). */
(function () {
  'use strict';
  const ZK = window.ZK, ZD = window.ZD, t = ZK.t, $ = id => document.getElementById(id);
  const fmt = (v, n = 1) => (isFinite(v) ? v.toLocaleString(ZK.LOCALE, { minimumFractionDigits: n, maximumFractionDigits: n }) : '–');

  // [Schlüssel, Beschriftung, min, max, Schrittweite, Einheit]
  const GEO = [['d', t('Achsabstand', 'Shaft distance'), 5, 150, 0.1, 'mm'], ['L1l', t('Oberarm links', 'Upper arm left'), 15, 150, 0.5, 'mm'],
    ['L2l', t('Unterarm links', 'Forearm left'), 15, 200, 0.5, 'mm'], ['L1r', t('Oberarm rechts', 'Upper arm right'), 15, 150, 0.5, 'mm'],
    ['L2r', t('Unterarm rechts', 'Forearm right'), 15, 200, 0.5, 'mm']];
  const AREA = [['cx', t('Mitte x', 'Centre x'), -100, 100, 1, 'mm'], ['cy', t('Mitte y', 'Centre y'), 5, 250, 1, 'mm'],
    ['w', t('Breite', 'Width'), 5, 250, 1, 'mm'], ['h', t('Höhe', 'Height'), 5, 250, 1, 'mm']];
  const DRV = [['step', t('Schritt', 'Step'), 0.01, 2, 0.001, '°'], ['backlash', t('Spiel links', 'Backlash left'), 0, 5, 0.01, '°'],
    ['backlashR', t('Spiel rechts', 'Backlash right'), 0, 5, 0.01, '°'], ['travel', t('Stellweg (0 = ∞)', 'Travel (0 = ∞)'), 0, 360, 1, '°'],
    ['speed', t('max. Tempo', 'Max. speed'), 10, 1000, 5, '°/s'], ['ratio', t('Untersetzung', 'Reduction'), 1, 4, 0.05, ':1']];
  const LIM = [['swL', t('Endschalter links', 'Limit switch left'), 90, 360, 0.01, '°'], ['swR', t('Endschalter rechts', 'Limit switch right'), -180, 90, 0.01, '°']];
  const COUPLE = { L1l: 'L1r', L1r: 'L1l', L2l: 'L2r', L2r: 'L2l' };

  const st = { g: ZK.preset('plotbot'), view: {}, ov: { reach: true, crit: true, heat: true, heatArea: true, heatFixed: false, fore90: true, range: true },
    heatFixMax: 2, heatMode: 'wieder',
    mode: 'ik', pen: { x: 0, y: 75 }, angles: null, pose: null, realPen: null, grid: null, field: null, sim: null, preset: 'plotbot' };
  const rows = {}, cv = $('cv');

  // ---------- Regler ----------
  function makeRow(parent, [key, label, min, max, step, unit], onChange) {
    const el = document.createElement('label');
    el.className = 'row';
    el.innerHTML = `<span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}">` +
      `<input type="number" min="${min}" step="${step}"><span class="unit">${unit}</span>`;
    const [range, num] = el.querySelectorAll('input');
    const set = v => { range.value = v; num.value = +(+v).toFixed(4); };
    range.addEventListener('input', () => { num.value = range.value; onChange(key, +range.value); });
    num.addEventListener('change', () => { if (num.value !== '' && isFinite(+num.value)) { range.value = num.value; onChange(key, +num.value); } });
    parent.appendChild(el);
    rows[key] = { set, range, num };
  }

  function onParam(key, v) {
    st.g[key] = v;
    if (st.g.coupled && COUPLE[key]) { st.g[COUPLE[key]] = v; rows[COUPLE[key]].set(v); }
    if (key === 'step' || key === 'ratio') updateFkRows();
    changed();
  }

  function syncRows() {
    for (const k of Object.keys(rows)) if (k in st.g) rows[k].set(st.g[k]);
    $('limits').checked = st.g.limits; $('limRows').hidden = !st.g.limits;
    $('coupled').checked = st.g.coupled; $('elbowL').value = st.g.elbowL; $('elbowR').value = st.g.elbowR; $('drive').value = st.g.drive;
    document.querySelectorAll('#presets button').forEach(b => b.classList.toggle('active', b.dataset.k === st.preset));
    updateFkRows();
  }

  function updateFkRows() {
    const r = st.g.ratio;
    for (const k of ['m1', 'm2']) {
      const row = rows[k];
      [row.range, row.num].forEach(el => { el.min = -180 * r; el.max = 360 * r; el.step = st.g.step; });
    }
    if (st.angles) { rows.m1.set(st.angles.t1 * r); rows.m2.set(st.angles.t2 * r); }
  }

  // ---------- Rechnen ----------
  let pending = false;
  function changed() {
    st.sim = null;
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; recompute(); });
  }

  function recompute() {
    const g = st.g, R = ZK.reach(g);
    st.grid = ZK.overlayGrid(g, { x: -R, y: -4, w: 2 * R, h: R + 4 }, 140);
    st.field = ZK.analyseField(g, 60);
    st.test = ZK.selfTest(g, 300);
    if (st.mode === 'ik' || !st.angles) setPen(st.pen, true); else setAngles(st.angles.t1, st.angles.t2);
  }

  /** Stift auf P setzen (IK). Bleibt stehen, wenn P nicht erreichbar ist. */
  function setPen(P, force) {
    const s = ZK.ik(st.g, P);
    if (!s) { if (force) { st.pose = null; render(); } return; }
    st.blocked = ZK.limitViolation(st.g, s);
    if (st.blocked && !force) { render(); return; }
    st.pen = { x: P.x, y: P.y }; st.angles = { t1: s.t1, t2: s.t2, mode: s.mode };
    st.pose = s; quantisedPen(); updateFkRows(); render();
  }

  /** Armwinkel setzen (FK), Stiftmodus vom letzten IK-Stand. */
  function setAngles(t1, t2) {
    const mode = st.angles ? st.angles.mode : 1, f = ZK.fk(st.g, t1, t2, mode);
    st.angles = { t1, t2, mode };
    st.pose = f ? Object.assign(f, { t1, t2, mode }) : null;
    st.blocked = st.pose && ZK.limitViolation(st.g, st.pose);
    if (f) st.pen = { x: f.P.x, y: f.P.y };
    quantisedPen(); render();
  }

  function quantisedPen() {
    const g = st.g, a = st.angles, f = a && ZK.fk(g, ZK.quantArm(g, 0, a.t1), ZK.quantArm(g, 1, a.t2), a.mode);
    st.realPen = f ? f.P : null;
  }

  // ---------- Anzeige ----------
  function resize() {
    const dpr = window.devicePixelRatio || 1, r = cv.getBoundingClientRect();
    cv.width = Math.max(10, r.width * dpr); cv.height = Math.max(10, r.height * dpr);
    if (!st.view.scale) ZD.fit(st.view, r.width, r.height, st.g);
    render();
  }

  function render() {
    // Feste Skala 0…max macht Geräte vergleichbar; relativ: kleinster Wert bis P95 (Zeichenfläche oder ganzer Bereich)
    if (st.ov.heatFixed) { st.heatMin = 0; st.heatMax = st.heatFixMax; }
    else if (st.grid) {
      const gr = st.grid, vals = [];
      for (let k = 0; k < gr.reach.length; k++) {
        if (gr.reach[k] !== 1 || (st.ov.heatArea && !ZD.inArea(st.g, gr, k))) continue;
        const h = ZD.heatValue(st, gr, k);
        if (isFinite(h)) vals.push(h);
      }
      vals.sort((a, b) => a - b);
      st.heatMin = vals.length ? vals[0] : 0;
      st.heatMax = vals.length ? Math.max(vals[Math.floor(0.95 * (vals.length - 1))], st.heatMin + 1e-6) : 1;
    }
    ZD.draw(cv, st);
    renderInfo();
  }

  const tr = (label, val, cls) => `<tr><td>${label}</td><td${cls ? ` class="${cls}"` : ''}>${val}</td></tr>`;

  function renderInfo() {
    const g = st.g, f = st.field, p = st.pose, a = st.angles, r = g.ratio, lim = g.travel > 0 ? g.travel : Infinity;
    let h = `<h3>${t('Stift und Winkel', 'Pen and angles')}</h3><table>`;
    if (p && a) {
      h += tr(t('Stift x / y', 'Pen x / y'), `${fmt(st.pen.x)} / ${fmt(st.pen.y)} mm`);
      h += tr(t('Arm links / rechts', 'Arm left / right'), `${fmt(a.t1)}° / ${fmt(a.t2)}°`);
      if (r !== 1) h += tr(t('Motor links / rechts', 'Motor left / right') + ` (×${fmt(r, 2)})`, `${fmt(a.t1 * r)}° / ${fmt(a.t2 * r)}°`);
      const crit = ZK.criticality(p), gain = ZK.errorGain(g, p);
      h += tr(t('Fehler je Schritt hier', 'Error per step here'), `${fmt(gain * g.step / r, 2)} mm`);
      const j = ZK.jacobian(g, p);
      h += tr(t('… inkl. Spiel', '… incl. backlash'), `${fmt(j ? ZK.jacError(j, (g.step + g.backlash) / r, (g.step + g.backlashR) / r) : NaN, 2)} mm`);
      const kw = Math.asin(Math.min(1, crit.min)) * 180 / Math.PI;
      const fa = ZK.foreAngle(p);
      h += tr(t('Unterarmwinkel am Stift', 'Forearm angle at the pen'), `${fmt(fa, 0)}°`, ZK.foreClass(fa));
      h += tr(t('kleinster Gelenkwinkel', 'Smallest joint angle'), `${fmt(kw, 0)}°`, kw < 10 ? 'bad' : kw < 20 ? 'warnTxt' : 'ok');
      if (st.blocked) h += tr(t('Softlimit', 'Soft limit'), t('gesperrt: ', 'blocked: ') + st.blocked, 'bad');
      else if (g.limits) h += tr(t('Abstand Endschalter L / R', 'Distance to limit switch L / R'), `${fmt(g.swL - ZK.normL(a.t1))}° / ${fmt(ZK.normR(a.t2) - g.swR)}°`);
      if (st.realPen) h += tr(t('Schrittraster-Versatz', 'Step-grid offset'), `${fmt(Math.hypot(st.realPen.x - st.pen.x, st.realPen.y - st.pen.y), 2)} mm`);
    } else h += tr(t('Stellung', 'Pose'), t('nicht montierbar', 'cannot be assembled'), 'bad');
    h += '</table>';
    if (f) {
      const pct = 100 * f.reach / f.total, s1 = f.arm1.span * r, s2 = f.arm2.span * r, need = Math.max(s1, s2);
      h += `<h3>${t('Zeichenfläche', 'Drawing area')}</h3><table>`;
      h += tr(t('erreichbar', 'reachable'), `${fmt(pct, 0)} %`, pct < 100 ? 'bad' : 'ok');
      h += tr(t('Armwinkel links', 'Arm angle left'), `${fmt(f.arm1.from, 0)}…${fmt(f.arm1.to, 0)}° (${fmt(f.arm1.span, 0)}°)`);
      h += tr(t('Armwinkel rechts', 'Arm angle right'), `${fmt(f.arm2.from, 0)}…${fmt(f.arm2.to, 0)}° (${fmt(f.arm2.span, 0)}°)`);
      h += tr(t('Motorweg nötig / vorhanden', 'Motor travel needed / available'), `${fmt(need, 0)}° / ${isFinite(lim) ? fmt(lim, 0) + '°' : '∞'}`, need > lim ? 'bad' : need > 0.9 * lim ? 'warnTxt' : 'ok');
      if (isFinite(lim)) h += tr(t('max. Untersetzung (10 % Reserve)', 'Max. reduction (10 % margin)'), `${fmt(0.9 * lim / Math.max(f.arm1.span, f.arm2.span), 2)} : 1`);
      h += tr(t('Unterarmwinkel min…max', 'Forearm angle min…max'), `${fmt(f.foreMin, 0)}…${fmt(f.foreMax, 0)}°`,
        f.foreMin >= ZK.FORE.okLo && f.foreMax <= ZK.FORE.okHi ? 'ok' : f.foreMin >= ZK.FORE.warnLo && f.foreMax <= ZK.FORE.warnHi ? 'warnTxt' : 'bad');
      h += tr(t('Fehler je 1° (Med/P95/Max)', 'Error per 1° (med/P95/max)'), `${fmt(f.perDeg.med, 2)} / ${fmt(f.perDeg.p95, 2)} / ${fmt(f.perDeg.max, 2)} mm`);
      h += tr(t('je Schritt (Med/P95)', 'per step (med/P95)'), `${fmt(f.step.med, 2)} / ${fmt(f.step.p95, 2)} mm`);
      h += tr(t('Schritt + Spiel (Med/P95)', 'step + backlash (med/P95)'), `${fmt(f.play.med, 2)} / ${fmt(f.play.p95, 2)} mm`);
      h += tr(t('Wiederholfehler Spiel L/R (Med/P95/Max)', 'Repeat error, backlash L/R (med/P95/max)'), `${fmt(f.repeat.med, 2)} / ${fmt(f.repeat.p95, 2)} / ${fmt(f.repeat.max, 2)} mm`);
      if (g.limits) h += tr(t('gesperrt (Endschalter, Oberarme)', 'blocked (limit switches, upper arms)'), f.blocked ? f.blocked + t(' Punkte', ' points') : t('nein', 'no'), f.blocked ? 'bad' : 'ok');
      h += tr(t('kritische Punkte (&lt;10°)', 'critical points (&lt;10°)'), `${f.crit} ${t('von', 'of')} ${f.total}`, f.crit ? 'bad' : 'ok');
      h += tr(t('Glieder kreuzen sich', 'links cross'), f.crossN ? f.crossN + t(' Punkte', ' points') : t('nein', 'no'), f.crossN ? 'warnTxt' : 'ok');
      if (r > 1.001) h += tr(t('Armscheiben', 'Arm pulleys') + ' (Ø ' + fmt(ZK.discRadius(g) * 2, 1) + ' mm)', f.discCollide ? t('kollidieren in einer Ebene', 'collide in one plane') : t('passen', 'fit'), f.discCollide ? 'warnTxt' : 'ok');
      if (f.flip) h += tr(t('Stift klappt um', 'pen flips over'), f.flip + t(' Punkte', ' points'), 'bad');
      h += '</table>';
    }
    if (st.sim) {
      const s = st.sim.res;
      h += `<h3>${t('Testfigur', 'Test figure')}: ${ZK.FIGURES[st.sim.fig].label}</h3><table>`;
      h += tr(t('Fahrzeit bei max. Tempo', 'Run time at max. speed'), `${fmt(s.time, 1)} s`);
      h += tr(t('Abweichung mittel / max', 'Deviation mean / max'), `${fmt(s.meanDev, 2)} / ${fmt(s.maxDev, 2)} mm`);
      if (s.unreachable) h += tr(t('nicht erreichbar', 'unreachable'), s.unreachable + t(' Punkte', ' points'), 'bad');
      if (s.blocked) h += tr(t('durch Softlimit gesperrt', 'blocked by soft limit'), s.blocked + t(' Punkte', ' points'), 'bad');
      h += tr(t('Fortschritt', 'Progress'), `${fmt(100 * st.sim.idx / Math.max(1, s.samples.length), 0)} %`) + '</table>';
    }
    h += t(`<h3>Selbsttest</h3><p class="hint">FK(IK(p)) an ${st.test ? st.test.tested : 0} Zufallspunkten: max. ${st.test ? st.test.maxErr.toExponential(1) : '–'} mm `,
      `<h3>Self-test</h3><p class="hint">FK(IK(p)) at ${st.test ? st.test.tested : 0} random points: max. ${st.test ? st.test.maxErr.toExponential(1) : '–'} mm `) +
      (st.test && st.test.maxErr < 1e-6 ? `<span class="ok">${t('bestanden', 'passed')}</span>` : `<span class="bad">${t('auffällig', 'suspicious')}</span>`) + '</p>';
    h += t(`<p class="hint">Fehlermaß: Beide Achsen liegen gleich weit daneben, in der ungünstigeren Richtung.
      Schritt = ${fmt(g.step, 3)}° ÷ ${fmt(r, 2)}, Spiel links ${fmt(g.backlash, 2)}° (${fmt(g.backlash / ZK.HALB, 0)} Halbschritte),
      rechts ${fmt(g.backlashR, 2)}° (${fmt(g.backlashR / ZK.HALB, 0)}) ÷ ${fmt(r, 2)} am Arm.</p>`,
      `<p class="hint">Error measure: both axes are off by the same amount, in the less favourable direction.
      Step = ${fmt(g.step, 3)}° ÷ ${fmt(r, 2)}, backlash left ${fmt(g.backlash, 2)}° (${fmt(g.backlash / ZK.HALB, 0)} half-steps),
      right ${fmt(g.backlashR, 2)}° (${fmt(g.backlashR / ZK.HALB, 0)}) ÷ ${fmt(r, 2)} at the arm.</p>`);
    $('info').innerHTML = h;
  }

  // ---------- Testfiguren ----------
  function startSim(animate) {
    const fig = $('figure').value, strokes = ZK.fitFigure(st.g, ZK.FIGURES[fig].strokes(), $('figOrig').checked);
    const res = ZK.simulate(st.g, strokes);
    if (!res.samples.length) return;
    st.sim = { fig, res, idx: animate ? 0 : res.samples.length, t: 0, pose: null };
    if (!animate) { simPose(res.samples.length - 1); render(); return; }
    let last = performance.now();
    const factor = () => Math.pow(10, +$('tempo').value);
    const step = now => {
      if (!st.sim || st.sim.res !== res) return;
      st.sim.t += (now - last) / 1000 * factor(); last = now;
      while (st.sim.idx < res.samples.length && res.samples[st.sim.idx].t <= st.sim.t) st.sim.idx++;
      simPose(Math.max(0, st.sim.idx - 1)); render();
      if (st.sim.idx < res.samples.length) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  function simPose(i) {
    const s = st.sim.res.samples[i], g = st.g;
    st.sim.pose = { A: { x: -g.d / 2, y: 0 }, B: { x: g.d / 2, y: 0 }, E1: s.E1, E2: s.E2, P: s.real };
  }

  // ---------- Maus ----------
  let drag = null;
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('pointerdown', e => {
    cv.setPointerCapture(e.pointerId);
    const pan = e.shiftKey || e.button !== 0 || st.mode === 'fk';
    drag = { pan, x: e.offsetX, y: e.offsetY };
    if (!pan) { st.sim = null; setPen(ZD.toW(st.view, e.offsetX, e.offsetY)); }
  });
  cv.addEventListener('pointermove', e => {
    if (!drag) return;
    if (drag.pan) { st.view.ox += e.offsetX - drag.x; st.view.oy += e.offsetY - drag.y; drag.x = e.offsetX; drag.y = e.offsetY; render(); }
    else setPen(ZD.toW(st.view, e.offsetX, e.offsetY));
  });
  cv.addEventListener('pointerup', () => { drag = null; });
  cv.addEventListener('wheel', e => {
    e.preventDefault();
    const k = Math.exp(-e.deltaY * 0.0015), v = st.view;
    v.ox = e.offsetX - (e.offsetX - v.ox) * k; v.oy = e.offsetY - (e.offsetY - v.oy) * k; v.scale *= k; render();
  }, { passive: false });

  // ---------- JSON ----------
  function exportJson() {
    const out = {};
    for (const k of Object.keys(ZK.BASE)) out[k] = st.g[k];
    $('json').value = JSON.stringify(out, null, 1);
    $('jsonMsg').textContent = t('Aktuelle Geometrie exportiert.', 'Current geometry exported.');
  }
  function importJson() {
    try {
      const inp = JSON.parse($('json').value), g = Object.assign({}, st.g);
      // Ältere Exporte ohne Spiel rechts / Endschalter: aus BASE bzw. Spiel links ergänzen, nicht vom aktiven Preset erben
      for (const k of ['limits', 'swL', 'swR']) if (!(k in inp)) g[k] = ZK.BASE[k];
      if (!('backlashR' in inp)) g.backlashR = typeof inp.backlash === 'number' ? inp.backlash : ZK.BASE.backlashR;
      for (const k of Object.keys(ZK.BASE)) {
        if (!(k in inp)) continue;
        if (typeof inp[k] !== typeof ZK.BASE[k]) throw new Error(t(`„${k}“ hat den falschen Typ`, `"${k}" has the wrong type`));
        g[k] = inp[k];
      }
      for (const k of ['d', 'L1l', 'L2l', 'L1r', 'L2r', 'w', 'h', 'ratio', 'speed']) if (!(g[k] > 0)) throw new Error(t(`„${k}“ muss > 0 sein`, `"${k}" must be > 0`));
      if (!ZK.DRIVES[g.drive]) g.drive = 'frei';
      st.g = g; st.preset = null; showFields({}); syncRows(); st.view = {}; resize();
      changed();
      $('jsonMsg').textContent = t('Geometrie übernommen.', 'Geometry imported.');
    } catch (err) { $('jsonMsg').textContent = t('Import fehlgeschlagen: ', 'Import failed: ') + err.message; }
  }

  /** Feldvarianten eines Presets als Knöpfe (z. B. 80×80 / 60×60 beim PlotBot). */
  function showFields(p) {
    const box = $('fieldBtns');
    box.innerHTML = '';
    for (const [name, f] of Object.entries(p.fields || {})) {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = name;
      b.addEventListener('click', () => {
        Object.assign(st.g, f); st.pen = { x: f.cx, y: f.cy }; syncRows(); st.view = {}; resize(); changed();
      });
      box.appendChild(b);
    }
  }

  // ---------- Aufbau ----------
  function build() {
    GEO.forEach(s => makeRow($('geoRows'), s, onParam));
    AREA.forEach(s => makeRow($('areaRows'), s, onParam));
    DRV.forEach(s => makeRow($('drvRows'), s, onParam));
    LIM.forEach(s => makeRow($('limRows'), s, onParam));
    $('limits').addEventListener('change', e => { st.g.limits = e.target.checked; $('limRows').hidden = !e.target.checked; changed(); });
    makeRow($('fkRows'), ['m1', 'Motor links', -180, 360, 0.1, '°'], (k, v) => setAngles(v / st.g.ratio, st.angles.t2));
    makeRow($('fkRows'), ['m2', 'Motor rechts', -180, 360, 0.1, '°'], (k, v) => setAngles(st.angles.t1, v / st.g.ratio));
    for (const [k, p] of Object.entries(ZK.PRESETS)) {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = p.label; b.dataset.k = k; b.title = p.hint;
      b.addEventListener('click', () => {
        st.g = ZK.preset(k); st.preset = k; st.pen = { x: st.g.cx, y: st.g.cy }; st.angles = null; st.pose = null; st.field = null;
        $('figOrig').checked = !!p.origMuster; $('presetHint').textContent = p.hint; showFields(p); syncRows(); st.view = {}; resize();
        if (st.mode === 'fk') { const s = ZK.ik(st.g, st.pen); st.angles = s && { t1: s.t1, t2: s.t2, mode: s.mode }; }
        changed();
      });
      $('presets').appendChild(b);
    }
    for (const [k, d] of Object.entries(ZK.DRIVES)) $('drive').add(new Option(d.name, k));
    for (const [k, f] of Object.entries(ZK.FIGURES)) $('figure').add(new Option(f.label, k));
    $('drive').addEventListener('change', e => {
      const d = ZK.DRIVES[e.target.value];
      Object.assign(st.g, { drive: e.target.value, step: d.step, backlash: d.backlash, backlashR: d.backlash, travel: d.travel, speed: d.speed });
      syncRows(); changed();
    });
    $('coupled').addEventListener('change', e => { st.g.coupled = e.target.checked; if (e.target.checked) {
      st.g.L1r = st.g.L1l; st.g.L2r = st.g.L2l; syncRows(); changed(); } });
    ['elbowL', 'elbowR'].forEach(id => $(id).addEventListener('change', e => { st.g[id] = e.target.value; changed(); }));
    $('ratioBtns').addEventListener('click', e => { if (e.target.dataset.r) { onParam('ratio', +e.target.dataset.r); rows.ratio.set(st.g.ratio); } });
    document.querySelectorAll('input[name=mode]').forEach(r => r.addEventListener('change', e => {
      st.mode = e.target.value; $('fkRows').hidden = st.mode !== 'fk'; st.sim = null; updateFkRows(); render();
    }));
    document.querySelectorAll('[data-ov]').forEach(c => c.addEventListener('change', e => { st.ov[e.target.dataset.ov] = e.target.checked; render(); }));
    $('heatMode').addEventListener('change', e => { st.heatMode = e.target.value; render(); });
    $('latticeZoom').addEventListener('click', () => {
      const r = cv.getBoundingClientRect(), v = st.view, P = st.realPen || st.pen;
      v.scale = Math.min(r.width, r.height) / 4; v.ox = r.width / 2 - P.x * v.scale; v.oy = r.height / 2 + P.y * v.scale;
      if (!st.ov.lattice) $('steuerung').querySelector('[data-ov=lattice]').click(); else render();
    });
    $('heatFixMax').addEventListener('change', e => { const v = +e.target.value; if (v > 0) { st.heatFixMax = v; render(); } });
    $('fitBtn').addEventListener('click', () => { st.view = {}; resize(); });
    $('runBtn').addEventListener('click', () => startSim(true));
    $('instantBtn').addEventListener('click', () => startSim(false));
    $('clearBtn').addEventListener('click', () => { st.sim = null; render(); });
    $('tempo').addEventListener('input', e => { $('tempoOut').textContent = '×' + fmt(Math.pow(10, +e.target.value), 2); });
    $('exportBtn').addEventListener('click', exportJson);
    $('importBtn').addEventListener('click', importJson);
    $('presetHint').textContent = ZK.PRESETS.plotbot.hint; showFields(ZK.PRESETS.plotbot);
    window.addEventListener('resize', resize);
    syncRows(); exportJson(); $('jsonMsg').textContent = '';
    resize(); recompute();
  }

  window.ZSim = { st, setPen, setAngles, startSim, render };
  $('sim').hidden = false;   // ohne JavaScript bleibt die Bedienung verborgen, der Text darüber erklärt das Bild
  build();
})();
