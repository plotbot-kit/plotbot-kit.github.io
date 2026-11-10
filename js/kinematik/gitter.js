/* PlotBot-Kinematiksimulator – Schrittgitter: alle Stiftpunkte, die mit ganzzahligen Schritten beider Motoren
   erreichbar sind, im sichtbaren Ausschnitt. Zeigt, wie fein die Winkelauflösung das Feld rastert.
   Quelle: simulator-gitter.js im PlotBot-Quellprojekt (Texte zweisprachig). */
(function (root) {
  'use strict';
  const ZK = root.ZK, ZD = root.ZD, t = ZK.t, L = ZK.LOCALE, MAX_PUNKTE = 120000, MIN_PX_JE_MM = 8;

  /** Schrittnummern-Bereich je Motor, der den Ausschnitt box (mm) abdeckt; Winkel per IK an einem Raster über box. */
  function schrittBereich(g, box, mode) {
    const r = g.ratio || 1, lo = [Infinity, Infinity], hi = [-Infinity, -Infinity], n = 10;
    for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) {
      const s = ZK.ik(g, { x: box.x0 + (box.x1 - box.x0) * i / n, y: box.y0 + (box.y1 - box.y0) * j / n });
      if (!s || s.mode !== mode) continue;
      [ZK.normL(s.t1), ZK.normR(s.t2)].forEach((t, k) => {
        const m = t * r / g.step;
        lo[k] = Math.min(lo[k], m); hi[k] = Math.max(hi[k], m);
      });
    }
    if (!isFinite(lo[0]) || !isFinite(lo[1])) return null;
    // Rand: Winkel ändern sich zwischen den Rasterpunkten nicht linear
    const pad = k => Math.ceil((hi[k] - lo[k]) * 0.1) + 2;
    return [0, 1].map(k => [Math.floor(lo[k]) - pad(k), Math.ceil(hi[k]) + pad(k)]);
  }

  /** Gitterpunkte im Ausschnitt: Liste {x, y, k1, k2}, oder {zuViele} bzw. null. */
  function punkte(g, box, mode) {
    if (!(g.step > 0)) return null;
    const br = schrittBereich(g, box, mode);
    if (!br) return null;
    const n1 = br[0][1] - br[0][0] + 1, n2 = br[1][1] - br[1][0] + 1;
    if (n1 * n2 > MAX_PUNKTE) return { zuViele: n1 * n2 };
    const r = g.ratio || 1, out = [];
    for (let k1 = br[0][0]; k1 <= br[0][1]; k1++) for (let k2 = br[1][0]; k2 <= br[1][1]; k2++) {
      const t1 = k1 * g.step / r, t2 = k2 * g.step / r, f = ZK.fk(g, t1, t2, mode);
      if (!f || f.P.x < box.x0 || f.P.x > box.x1 || f.P.y < box.y0 || f.P.y > box.y1) continue;
      if (ZK.limitViolation(g, Object.assign(f, { t1, t2 }))) continue;
      out.push({ x: f.P.x, y: f.P.y, k1, k2 });
    }
    return { punkte: out, n1, n2 };
  }

  /** Mittlerer Abstand zum nächsten Gitterpunkt in Richtung beider Schrittachsen am Stift (mm je Schritt). */
  function abstand(g, s) {
    const j = ZK.jacobian(g, s), d = g.step / (g.ratio || 1);
    return j ? [Math.hypot(j[0], j[1]) * d, Math.hypot(j[2], j[3]) * d] : null;
  }

  function draw(ctx, v, cw, ch, st) {
    const g = st.g, tl = ZD.toW(v, 0, 0), br = ZD.toW(v, cw, ch);
    const box = { x0: tl.x, x1: br.x, y0: br.y, y1: tl.y };
    const c = ZK.ik(g, { x: g.cx, y: g.cy }), mode = st.angles ? st.angles.mode : c ? c.mode : 1;
    let msg;
    if (v.scale < MIN_PX_JE_MM) msg = t('Schrittgitter: zum Anzeigen hineinzoomen (Mausrad oder „Am Stift hineinzoomen“)', 'Step lattice: zoom in to show it (mouse wheel or "Zoom in at the pen")');
    else {
      const res = punkte(g, box, mode);
      if (!res) msg = t('Schrittgitter: im Ausschnitt nichts erreichbar', 'Step lattice: nothing reachable in view');
      else if (res.zuViele) msg = t(`Schrittgitter: ${res.zuViele.toLocaleString(L)} Kandidaten – weiter hineinzoomen`, `Step lattice: ${res.zuViele.toLocaleString(L)} candidates – zoom in further`);
      else {
        const rad = Math.max(1.2, Math.min(3, v.scale * 0.015));
        ctx.fillStyle = 'rgba(17,24,39,0.75)';
        for (const p of res.punkte) { const s = ZD.toS(v, p); ctx.fillRect(s.x - rad, s.y - rad, 2 * rad, 2 * rad); }
        const a = st.pose && abstand(g, st.pose);
        const f3 = x => x.toLocaleString(L, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
        msg = t(`Schrittgitter: ${res.punkte.length.toLocaleString(L)} Punkte im Ausschnitt`, `Step lattice: ${res.punkte.length.toLocaleString(L)} points in view`) +
          (a ? t(` · am Stift ${f3(a[0])} mm je Schritt links, ${f3(a[1])} mm rechts`, ` · at the pen ${f3(a[0])} mm per step left, ${f3(a[1])} mm right`) : '');
      }
    }
    ctx.font = '12px system-ui';
    const w = ctx.measureText(msg).width;
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(8, 8, w + 12, 22);
    ctx.fillStyle = '#111'; ctx.fillText(msg, 14, 23);
  }

  const ZG = { punkte, abstand, draw };
  root.ZG = ZG;
})(window);
