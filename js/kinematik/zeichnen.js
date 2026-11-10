/* PlotBot-Kinematiksimulator – Zeichnen auf dem Canvas (Draufsicht, mm-Raster, Overlays, Arme, Fahrspur).
   Angepasst aus dem PlotBot-Kinematiksimulator (ohne Messwert-Ringe, Texte zweisprachig). */
(function (root) {
  'use strict';
  const ZK = root.ZK, t = ZK.t;
  const COL = { grid: '#e3e9ef', grid50: '#c5d0db', axis: '#8a99a8', area: '#2f7bd8', armL: '#1f63b5', armR: '#c2410c',
    fore: '#475569', pen: '#111827', ideal: '#16a34a', real: '#dc2626', travel: '#94a3b8', reach: 'rgba(34,197,94,0.13)',
    fore90: '#db2777' };
  const VIRIDIS = [[68, 1, 84], [59, 82, 139], [33, 145, 140], [94, 201, 98], [253, 231, 37]];

  function heatColor(t) {
    t = Math.max(0, Math.min(1, t)) * (VIRIDIS.length - 1);
    const i = Math.min(VIRIDIS.length - 2, Math.floor(t)), f = t - i, a = VIRIDIS[i], b = VIRIDIS[i + 1];
    return `rgb(${a.map((v, k) => Math.round(v + (b[k] - v) * f)).join(',')})`;
  }

  /** Ansicht so einpassen, dass Sockel, Reichweite und Zeichenfläche sichtbar sind. */
  function fit(view, cw, ch, g) {
    const R = ZK.reach(g), x0 = -R - 8, x1 = R + 8, y0 = -22, y1 = Math.max(R, g.cy + g.h / 2) + 8;
    view.scale = Math.min(cw / (x1 - x0), ch / (y1 - y0));
    view.ox = cw / 2 - (x0 + x1) / 2 * view.scale;
    view.oy = ch / 2 + (y0 + y1) / 2 * view.scale;
  }
  const toS = (v, p) => ({ x: v.ox + p.x * v.scale, y: v.oy - p.y * v.scale });
  const toW = (v, x, y) => ({ x: (x - v.ox) / v.scale, y: (v.oy - y) / v.scale });

  function line(ctx, v, a, b) { const p = toS(v, a), q = toS(v, b); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); }
  function dot(ctx, v, p, r, fill) { const s = toS(v, p); ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, 2 * Math.PI); ctx.fillStyle = fill; ctx.fill(); }

  function drawGrid(ctx, v, cw, ch) {
    const tl = toW(v, 0, 0), br = toW(v, cw, ch);
    const stepPx = v.scale * 10, minor = stepPx > 14 ? 10 : 50;
    ctx.lineWidth = 1; ctx.font = '11px system-ui'; ctx.fillStyle = COL.axis;
    for (let x = Math.floor(tl.x / minor) * minor; x <= br.x; x += minor) {
      ctx.strokeStyle = x === 0 ? COL.axis : (x % 50 === 0 ? COL.grid50 : COL.grid);
      line(ctx, v, { x, y: br.y }, { x, y: tl.y });
      if (x % 50 === 0) { const s = toS(v, { x, y: 0 }); ctx.fillText(`${x}`, s.x + 2, ch - 4); }
    }
    for (let y = Math.floor(br.y / minor) * minor; y <= tl.y; y += minor) {
      ctx.strokeStyle = y === 0 ? COL.axis : (y % 50 === 0 ? COL.grid50 : COL.grid);
      line(ctx, v, { x: tl.x, y }, { x: br.x, y });
      if (y % 50 === 0) { const s = toS(v, { x: 0, y }); ctx.fillText(`${y}`, 3, s.y - 2); }
    }
    ctx.fillText('mm', cw - 26, ch - 4);
  }

  function drawCells(ctx, v, grid, colorOf) {
    const w = grid.res * v.scale + 0.6;
    for (let i = 0; i < grid.nx; i++) for (let j = 0; j < grid.ny; j++) {
      const c = colorOf(j * grid.nx + i);
      if (!c) continue;
      const s = toS(v, { x: grid.x0 + i * grid.res, y: grid.y0 + (j + 1) * grid.res });
      ctx.fillStyle = c; ctx.fillRect(s.x, s.y, w, w);
    }
  }

  function drawOverlays(ctx, v, st) {
    const gr = st.grid;
    if (!gr) return;
    if (st.ov.reach) drawCells(ctx, v, gr, k => (gr.reach[k] === 1 ? COL.reach : null));
    if (gr.reach.includes(2)) drawCells(ctx, v, gr, k => (gr.reach[k] === 2 ? hatch(ctx, 'rgba(71,85,105,0.55)') : null));
    if (st.ov.heat) {
      const mx = st.heatMax;
      ctx.globalAlpha = 0.72;
      drawCells(ctx, v, gr, k => { const h = gr.reach[k] === 1 && (!st.ov.heatArea || inArea(st.g, gr, k)) ? heatValue(st, gr, k) : NaN;
        return isFinite(h) ? heatColor((h - st.heatMin) / (mx - st.heatMin)) : null; });
      ctx.globalAlpha = 1;
    }
    if (st.ov.crit) drawCells(ctx, v, gr, k => (!gr.reach[k] ? null : gr.crit[k] < 0.17 ? 'rgba(220,38,38,0.55)'
      : gr.crit[k] < 0.34 ? 'rgba(245,158,11,0.40)' : null));
    if (st.ov.fore90 && gr.fore) drawFore90(ctx, v, gr);
  }

  /** Wert der Heatmap in Zelle k, je nach st.heatMode in mm:
      wieder = Versatz bei Richtungswechsel beider Arme um ihr Spiel (links/rechts getrennt), ungünstigere Vorzeichenlage;
      schritt = Stiftweg, wenn beide Motoren einen Schritt daneben liegen; grad = dasselbe je Grad Armwinkel. */
  function heatValue(st, gr, k) {
    const g = st.g, r = g.ratio || 1;
    if (st.heatMode === 'grad') return gr.gain[k];
    if (st.heatMode === 'schritt') return gr.gain[k] * g.step / r;
    return ZK.jacError(gr.jac.subarray(4 * k, 4 * k + 4), g.backlash / r, g.backlashR / r);
  }
  const HEAT_TITLE = { wieder: t('Wiederholfehler bei Richtungswechsel [mm]', 'Repeat error on direction change [mm]'),
    schritt: t('Stiftweg je Motorschritt [mm]', 'Pen travel per motor step [mm]'), grad: t('Stiftweg je Grad Armwinkel [mm/°]', 'Pen travel per degree of arm angle [mm/°]') };

  const hatches = {};
  /** Schraffurmuster (diagonal) in Farbe col, je Farbe einmal erzeugt. */
  function hatch(ctx, col) {
    if (hatches[col]) return hatches[col];
    const c = document.createElement('canvas'), hc = c.getContext('2d');
    c.width = c.height = 8; hc.strokeStyle = col; hc.lineWidth = 1;
    hc.beginPath(); hc.moveTo(0, 8); hc.lineTo(8, 0); hc.stroke();
    return (hatches[col] = ctx.createPattern(c, 'repeat'));
  }

  /** Isolinie per Marching Squares über die Zellmitten: alle Strecken, an denen val die Schwelle lv kreuzt. */
  function isoline(ctx, v, gr, val, lv) {
    const P = (i, j) => toS(v, { x: gr.x0 + (i + 0.5) * gr.res, y: gr.y0 + (j + 0.5) * gr.res });
    const lerp = (a, b, va, vb) => { const t = (lv - va) / (vb - va); return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; };
    for (let i = 0; i < gr.nx - 1; i++) for (let j = 0; j < gr.ny - 1; j++) {
      const c = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]], vs = c.map(([a, b]) => val[b * gr.nx + a]);
      if (!vs.every(isFinite)) continue;
      const pts = [];
      for (let e = 0; e < 4; e++) {
        const n = (e + 1) % 4;
        if ((vs[e] < lv) !== (vs[n] < lv)) pts.push(lerp(P(...c[e]), P(...c[n]), vs[e], vs[n]));
      }
      for (let q = 0; q + 1 < pts.length; q += 2) { ctx.moveTo(pts[q].x, pts[q].y); ctx.lineTo(pts[q + 1].x, pts[q + 1].y); }
    }
  }

  /** Zone, in der die Unterarme am Stift etwa rechtwinklig stehen: dezente Schraffur plus Grenzlinien. */
  function drawFore90(ctx, v, gr) {
    const F = ZK.FORE, pat = hatch(ctx, 'rgba(219,39,119,0.45)');
    drawCells(ctx, v, gr, k => (gr.reach[k] === 1 && gr.fore[k] >= F.okLo && gr.fore[k] <= F.okHi ? pat : null));
    ctx.beginPath(); isoline(ctx, v, gr, gr.fore, F.okLo); isoline(ctx, v, gr, gr.fore, F.okHi);
    ctx.strokeStyle = COL.fore90; ctx.lineWidth = 1.6; ctx.stroke();
  }

  function inArea(g, gr, k) {
    const x = gr.x0 + (k % gr.nx + 0.5) * gr.res, y = gr.y0 + (Math.floor(k / gr.nx) + 0.5) * gr.res;
    return Math.abs(x - g.cx) <= g.w / 2 && Math.abs(y - g.cy) <= g.h / 2;
  }

  function drawArea(ctx, v, g) {
    const s = toS(v, { x: g.cx - g.w / 2, y: g.cy + g.h / 2 });
    ctx.strokeStyle = COL.area; ctx.lineWidth = 2; ctx.setLineDash([8, 5]);
    ctx.strokeRect(s.x, s.y, g.w * v.scale, g.h * v.scale); ctx.setLineDash([]);
    ctx.fillStyle = COL.area; ctx.font = '12px system-ui';
    ctx.fillText(`${t('Zeichenfläche', 'Drawing area')} ${g.w}×${g.h} mm`, s.x + 4, s.y - 5);
  }

  /** Sockel, Armscheiben (bei Untersetzung) und benötigte Winkelbereiche als Bögen. */
  function drawBase(ctx, v, st) {
    const g = st.g, A = { x: -g.d / 2, y: 0 }, B = { x: g.d / 2, y: 0 }, rd = ZK.discRadius(g);
    const s0 = toS(v, { x: -g.d / 2 - 12, y: 6 });
    ctx.fillStyle = '#e2e8f0'; ctx.fillRect(s0.x, s0.y, (g.d + 24) * v.scale, 20 * v.scale);
    if (rd) for (const P of [A, B]) {
      const s = toS(v, P); ctx.beginPath(); ctx.arc(s.x, s.y, rd * v.scale, 0, 2 * Math.PI);
      ctx.strokeStyle = st.field && st.field.discCollide ? COL.real : '#64748b'; ctx.setLineDash([3, 3]); ctx.lineWidth = 1.5;
      ctx.stroke(); ctx.setLineDash([]);
    }
    if (st.ov.range && st.field) {
      const f = st.field, lim = g.travel > 0 ? g.travel : Infinity;
      [[A, f.arm1, COL.armL], [B, f.arm2, COL.armR]].forEach(([P, a, col], i) => {
        const s = toS(v, P), r = 14 * v.scale * 0.6 + 18, ok = a.span * g.ratio <= lim;
        ctx.beginPath(); ctx.arc(s.x, s.y, r, -a.to * Math.PI / 180, -a.from * Math.PI / 180);
        ctx.strokeStyle = ok ? col : COL.real; ctx.lineWidth = 5; ctx.globalAlpha = 0.65; ctx.stroke(); ctx.globalAlpha = 1;
      });
    }
    if (g.limits) drawSwitches(ctx, v, g, A, B);
    dot(ctx, v, A, 5, COL.armL); dot(ctx, v, B, 5, COL.armR);
  }

  /** Endschalterwinkel als Strahl je Achse, der gesperrte Sektor dahinter rot getönt. */
  function drawSwitches(ctx, v, g, A, B) {
    const len = Math.max(g.L1l, g.L1r) + 6, R = Math.PI / 180;
    [[A, g.swL, g.swL + 40, 'L'], [B, g.swR - 40, g.swR, 'R']].forEach(([P, a0, a1, side]) => {
      const s = toS(v, P), r = len * v.scale, sw = side === 'L' ? a0 : a1;
      ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.arc(s.x, s.y, r, -a1 * R, -a0 * R); ctx.closePath();
      ctx.fillStyle = 'rgba(220,38,38,0.10)'; ctx.fill();
      const e = { x: P.x + len * Math.cos(sw * R), y: P.y + len * Math.sin(sw * R) };
      ctx.strokeStyle = COL.real; ctx.lineWidth = 1.5; ctx.setLineDash([5, 3]); line(ctx, v, P, e); ctx.setLineDash([]);
      const ts = toS(v, e);
      ctx.fillStyle = COL.real; ctx.font = '11px system-ui';
      ctx.fillText(`${t('Endschalter', 'Limit switch')} ${sw.toLocaleString(ZK.LOCALE)}°`, ts.x + (side === 'L' ? -100 : 4), ts.y + 12);
    });
  }

  function drawArms(ctx, v, pose, alpha) {
    if (!pose) return;
    ctx.globalAlpha = alpha; ctx.lineCap = 'round';
    ctx.lineWidth = Math.min(14, Math.max(4, 3.5 * v.scale * 0.6));   // beim Hineinzoomen nicht alles verdecken
    ctx.strokeStyle = COL.armL; line(ctx, v, pose.A, pose.E1);
    ctx.strokeStyle = COL.armR; line(ctx, v, pose.B, pose.E2);
    ctx.lineWidth = Math.min(10, Math.max(3, 2.6 * v.scale * 0.6)); ctx.strokeStyle = COL.fore;
    line(ctx, v, pose.E1, pose.P); line(ctx, v, pose.E2, pose.P);
    dot(ctx, v, pose.E1, 4, '#0f172a'); dot(ctx, v, pose.E2, 4, '#0f172a');
    dot(ctx, v, pose.P, 6, COL.pen); dot(ctx, v, pose.P, 2.5, '#fff');
    ctx.globalAlpha = 1;
  }

  function drawCross(ctx, v, p, col) {
    const s = toS(v, p); ctx.strokeStyle = col; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(s.x - 6, s.y - 6); ctx.lineTo(s.x + 6, s.y + 6); ctx.moveTo(s.x + 6, s.y - 6); ctx.lineTo(s.x - 6, s.y + 6); ctx.stroke();
  }

  function polyline(ctx, v, samples, upto, key, down) {
    ctx.beginPath();
    let open = false;
    for (let i = 0; i < upto; i++) {
      const smp = samples[i];
      const d = smp.down;
      if (d !== down) { open = false; continue; }
      const s = toS(v, smp[key]);
      if (open) ctx.lineTo(s.x, s.y); else { ctx.moveTo(s.x, s.y); open = true; }
    }
    ctx.stroke();
  }

  function drawSim(ctx, v, sim) {
    if (!sim) return;
    const all = sim.res.samples, n = sim.idx;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = COL.ideal; ctx.lineWidth = 2; ctx.setLineDash([6, 4]); polyline(ctx, v, all, all.length, 'ideal', true);
    ctx.setLineDash([2, 4]); ctx.strokeStyle = COL.travel; ctx.lineWidth = 1; polyline(ctx, v, all, n, 'real', false);
    ctx.setLineDash([]); ctx.strokeStyle = COL.real; ctx.lineWidth = 1.6; polyline(ctx, v, all, n, 'real', true);
  }

  function drawLegend(ctx, cw, ch, st) {
    if (!st.ov.heat) return;
    const w = 280, h = 12, x = cw - w - 16, y = ch - 52, g = st.g;
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(x - 10, y - 40, w + 20, 76);
    for (let i = 0; i < w; i++) { ctx.fillStyle = heatColor(i / (w - 1)); ctx.fillRect(x + i, y, 1, h); }
    ctx.fillStyle = '#111'; ctx.font = '12px system-ui';
    const sub = st.heatMode === 'wieder' ? t(`Spiel L ${(g.backlash / ZK.HALB).toFixed(0)} / R ${(g.backlashR / ZK.HALB).toFixed(0)} Halbschritte, ohne Ausgleich`,
        `Backlash L ${(g.backlash / ZK.HALB).toFixed(0)} / R ${(g.backlashR / ZK.HALB).toFixed(0)} half-steps, uncompensated`)
      : st.heatMode === 'schritt' ? t('Schritt', 'Step') + ` ${g.step.toFixed(3)}° ÷ ${(g.ratio || 1).toFixed(2)}` : t('beide Arme gleich weit daneben', 'both arms off by the same amount');
    ctx.fillText(HEAT_TITLE[st.heatMode] + (st.ov.heatFixed ? t(', feste Skala', ', fixed scale') : ''), x, y - 24);
    ctx.fillStyle = '#475569'; ctx.font = '11px system-ui'; ctx.fillText(sub, x, y - 9);
    ctx.fillStyle = '#111'; ctx.font = '12px system-ui';
    const lo = st.heatMin || 0, hi = st.heatMax;
    [0, 0.5, 1].forEach(t => ctx.fillText((t === 1 ? '≥' : '') + (lo + (hi - lo) * t).toFixed(2), x + t * (w - 30), y + h + 14));
  }

  function draw(cv, st) {
    const ctx = cv.getContext('2d'), dpr = root.devicePixelRatio || 1, cw = cv.width / dpr, ch = cv.height / dpr, v = st.view;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, cw, ch);
    drawGrid(ctx, v, cw, ch);
    drawOverlays(ctx, v, st);
    drawArea(ctx, v, st.g);
    drawBase(ctx, v, st);
    if (st.ov.lattice && root.ZG) root.ZG.draw(ctx, v, cw, ch, st);
    drawSim(ctx, v, st.sim);
    if (st.sim && st.sim.pose) drawArms(ctx, v, st.sim.pose, 0.95);
    else {
      drawArms(ctx, v, st.pose, 0.95);
      if (st.pose && st.realPen) drawCross(ctx, v, st.realPen, COL.real);
    }
    drawLegend(ctx, cw, ch, st);
  }

  root.ZD = { fit, toS, toW, draw, heatColor, heatValue, inArea };
})(window);
