// Templates for charts: Trym's code from his film engine (templates/diagram.js), adapted for Meko with English text
// and the Night atlas theme. See ../engine.js for how templates work.
import { register, preset, H } from "../engine.js";

const pal = (th) => th.series;
register('bar_chart', {
  cat: 'Charts', title: 'Bar chart', desc: 'Bars that grow one by one, standing or lying, with numbers counting up.', use: 'Comparing amounts between categories.',
  params: 'title, data: [{label, value, color}], unit, decimals, sep ("none" for years), orientation: v|h, highlight, sort, max',
  example: { title: 'Delegates by group', data: [{ label: 'Officials', value: 57 }, { label: 'Farmers', value: 37 }, { label: 'Others', value: 18 }], highlight: 0 },
  build(p, c) {
    const { U, th } = c, D = p.sort ? [...(p.data || [])].sort((a, b) => b.value - a.value) : p.data || [], N = Math.max(1, D.length);
    const max = p.max || Math.max(...D.map((d) => d.value)) * 1.12, step = 0.6 / N, sep = p.sep || (Math.max(...D.map((d) => Math.abs(d.value))) >= 10000 ? 'always' : '');
    const colr = (d, k) => d.color || (p.highlight == null ? th.accent : k === p.highlight ? th.accent : th.line);
    let out = U.bg() + (p.title ? U.T(260, 230, p.title, { a: 'start', fam: 'd', s: 56, w: 700, an: U.A('fade', 0.02, 0.06) }) : '');
    if (p.orientation === 'h') {
      const rh = Math.min(100, 600 / N);
      D.forEach((d, k) => {
        const y = 320 + k * rh, w = (1080 * d.value) / max, at = 0.1 + k * step;
        out += U.T(600, y + rh * 0.42, d.label, { a: 'end', s: 34, an: U.A('fade', at, 0.05) }) +
          `<rect x="630" y="${y}" width="${w}" height="${rh * 0.62}" rx="6" fill="${colr(d, k)}"${U.A('grow', at, 0.18, { ax: 'x', cx: 630, cy: y })}/>` +
          U.T(650 + w, y + rh * 0.42, '0', { a: 'start', s: 34, w: 700, f: th.ink, an: U.A('count', at, 0.18, { from: 0, to: d.value, dec: p.decimals || 0, suf: p.unit || '', sep }) });
      });
      return out;
    }
    const left = 300, right = 1620, base = 860, bw = Math.min(p.gap ? 1e4 : 180, ((right - left) / N) * (p.gap ?? 0.58));
    out += `<path d="M${left - 40} ${base}H${right + 40}" stroke="${th.line}" stroke-width="3"/>`;
    D.forEach((d, k) => {
      const x = left + ((right - left) / N) * (k + 0.5), h = (520 * d.value) / max, at = 0.1 + k * step;
      out += `<rect x="${x - bw / 2}" y="${base - h}" width="${bw}" height="${h}" rx="6" fill="${colr(d, k)}"${U.A('grow', at, 0.2, { cx: x, cy: base })}/>` +
        U.T(x, base - h - 24, '0', { fam: 'd', s: 48, w: 700, an: U.A('count', at, 0.2, { from: 0, to: d.value, dec: p.decimals || 0, suf: p.unit || '', sep }) }) +
        U.T(x, base + 48, d.label, { s: 32, f: th.muted, an: U.A('fade', at, 0.06) });
    });
    return out;
  },
});
preset('ranking_bars', 'bar_chart', { title: 'Ranking', desc: 'Lying bars sorted from biggest to smallest.', use: 'Top lists and rankings.', defaults: { orientation: 'h', sort: true },
  example: { title: 'Turnout (example data)', data: [{ label: 'Country A', value: 52 }, { label: 'Country B', value: 78 }, { label: 'Country C', value: 41 }, { label: 'Country D', value: 64 }], unit: '%' } });
preset('comparison_bars', 'bar_chart', { title: 'Two bars', desc: 'Two big bars side by side.', use: 'Then and now, or A against B.', defaults: { orientation: 'v' },
  example: { title: 'Men who could vote', data: [{ label: '1791', value: 66 }, { label: '1792', value: 100 }], unit: '%', highlight: 1 } });
register('bar_race', {
  cat: 'Charts', title: 'Bar race', desc: 'Lying bars that change size and swap places over time.', use: 'Change over time for several countries, parties or products.',
  params: 'title, frames: [{label, values: {name: number}}], unit, decimals, top', example: { title: 'Example data', frames: [{ label: '1900', values: { A: 10, B: 25, C: 18 } }, { label: '1950', values: { A: 40, B: 30, C: 22 } }, { label: '2000', values: { A: 55, B: 32, C: 60 } }] },
  build(p, c) {
    const { U, th } = c, id = c.id, names = Object.keys((p.frames || [{}])[0].values || {}), cols = pal(th);
    return U.bg() + (p.title ? U.T(260, 230, p.title, { a: 'start', fam: 'd', s: 56, w: 700 }) : '') + U.T(1660, 880, '', { a: 'end', fam: 'd', s: 140, w: 700, f: th.line, id: id + 'lab' }) +
      names.map((n, k) => `<g id="${id}b${k}"><rect x="600" y="0" width="10" height="60" rx="6" fill="${cols[k % cols.length]}"/>${U.T(580, 42, n, { a: 'end', s: 34 })}<text x="620" y="42" font-family="${th.fontText}" font-size="32" font-weight="700" fill="${th.ink}"></text></g>`).join('');
  },
  init(g, p, c) { const names = Object.keys((p.frames || [{}])[0].values || {}); return { names, lab: g.querySelector('#' + c.id + 'lab'), rows: names.map((_, k) => { const e = g.querySelector('#' + c.id + 'b' + k); return { e, r: e.querySelector('rect'), v: e.querySelectorAll('text')[1] }; }) }; },
  render(l, st, p, c) {
    const { U } = c, F = p.frames || [], n = F.length; if (n < 2) return;
    const f = U.clamp(l.p / 0.92, 0, 1) * (n - 1), i = Math.min(n - 2, Math.floor(f)), u = U.ease.io(f - i);
    const rank = (fr) => { const s = [...st.names].sort((a, b) => (fr.values[b] || 0) - (fr.values[a] || 0)); return Object.fromEntries(s.map((nm, k) => [nm, k])); };
    const r0 = rank(F[i]), r1 = rank(F[i + 1]), vals = st.names.map((nm) => U.lerp(F[i].values[nm] || 0, F[i + 1].values[nm] || 0, u)), max = Math.max(...vals) * 1.1 || 1, rh = Math.min(100, 560 / st.names.length), top = p.top || 8;
    st.names.forEach((nm, k) => {
      const rk = U.lerp(r0[nm], r1[nm], u), w = Math.max(4, (1000 * vals[k]) / max), o = st.rows[k];
      o.e.setAttribute('transform', `translate(0 ${(320 + rk * rh).toFixed(1)})`); o.e.setAttribute('opacity', rk < top ? 1 : 0);
      o.r.setAttribute('width', w.toFixed(1)); o.v.setAttribute('x', (620 + w).toFixed(1)); o.v.textContent = U.fmtNum(vals[k], p.decimals || 0) + (p.unit || '');
    });
    st.lab.textContent = F[Math.round(f)].label;
  },
});
function fnPoints(fn, x0, x1) {
  const pts = [];
  for (let k = 0; k <= 160; k++) {
    const x = x0 + ((x1 - x0) * k) / 160; let y = 0;
    if (fn.type === 'poly') y = (fn.coeffs || [0]).reduce((s, cc, i) => s + cc * Math.pow(x, i), 0);
    else if (fn.type === 'sin') y = (fn.a ?? 1) * Math.sin((fn.b ?? 1) * x + (fn.c ?? 0));
    else if (fn.type === 'exp') y = (fn.a ?? 1) * Math.exp((fn.b ?? 1) * x);
    else y = (fn.m ?? 1) * x + (fn.b ?? 0);
    pts.push([x, y]);
  }
  return pts;
}
register('line_chart', {
  cat: 'Charts', title: 'Line chart', desc: 'Lines that draw from left to right, with an optional filled area and notes.', use: 'Change over time, or how two numbers relate.',
  params: 'title, series: [{name, color, points: [[x, y]]}], fn, xLabel, yLabel, xMin, xMax, yMin, yMax, area, annotations: [{x, text, at}]',
  example: { title: 'Example data', xLabel: 'Year', yLabel: 'Percent', series: [{ name: 'Country A', points: [[1800, 5], [1850, 12], [1900, 30], [1950, 70], [2000, 95]] }, { name: 'Country B', points: [[1800, 2], [1850, 20], [1900, 25], [1950, 60], [2000, 90]] }], annotations: [{ x: 1900, text: 'Reform', at: 0.5 }] },
  build(p, c) {
    const { U, th } = c, cols = pal(th);
    const S = p.fn ? [{ name: p.fn.label || '', points: fnPoints(p.fn, p.xMin ?? -5, p.xMax ?? 5) }] : p.series || [];
    const all = S.flatMap((s) => s.points), xmin = p.xMin ?? Math.min(...all.map((q) => q[0])), xmax = p.xMax ?? Math.max(...all.map((q) => q[0]));
    const ymin = p.yMin ?? Math.min(0, ...all.map((q) => q[1])), ymax = p.yMax ?? Math.max(...all.map((q) => q[1])) * 1.1;
    const L = 300, R = 1600, T = 280, B = 820, X = (x) => L + ((R - L) * (x - xmin)) / (xmax - xmin || 1), Y = (y) => B - ((B - T) * (y - ymin)) / (ymax - ymin || 1);
    let out = U.bg() + (p.title ? U.T(L, 220, p.title, { a: 'start', fam: 'd', s: 52, w: 700, an: U.A('fade', 0.02, 0.06) }) : '');
    const st = H.niceStep((ymax - ymin) / 4); for (let v = Math.ceil(ymin / st - 1e-9) * st; v <= ymax + 1e-9; v += st) { const y = Y(v).toFixed(1); out += `<path d="M${L} ${y}H${R}" stroke="${th.line}" stroke-width="1.5" opacity=".6"/>` + U.T(L - 16, +y + 8, U.fmtNum(v, st < 1 ? 1 : 0), { a: 'end', s: 22, f: th.muted }); }
    const ax = ymin < 0 && ymax > 0 ? Y(0) : B, ay = p.fn && xmin < 0 && xmax > 0 ? X(0) : L;
    out += `<path d="M${L} ${ax}H${R}M${ay} ${T}V${B}" stroke="${th.muted}" stroke-width="3"/>` + U.T(L, B + 44, U.fmtNum(xmin, 0), { s: 22, f: th.muted }) + U.T(R, B + 44, U.fmtNum(xmax, 0), { s: 22, f: th.muted }) +
      (p.xLabel ? U.T((L + R) / 2, B + 60, p.xLabel, { s: 28, f: th.muted }) : '') + (p.yLabel ? U.T(L, T - 24, p.yLabel, { a: 'start', s: 26, f: th.muted }) : '');
    S.forEach((s, k) => {
      const col = s.color || cols[k % cols.length], P = s.points.map((q) => [X(q[0]), Y(q[1])]);
      const len = P.reduce((a, q, i) => (i ? a + Math.hypot(q[0] - P[i - 1][0], q[1] - P[i - 1][1]) : 0), 0) + 2, d = 'M' + P.map((q) => q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join('L');
      const at = 0.12 + k * 0.1;
      if (p.area) out += `<path d="${d}L${P[P.length - 1][0].toFixed(1)} ${B}L${P[0][0].toFixed(1)} ${B}Z" fill="${th.surface}" fill-opacity=".7" opacity="0"${U.A('fade', at + 0.4, 0.1)}/>`;
      out += `<path d="${d}" stroke="${col}" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${len.toFixed(0)}" stroke-dashoffset="${len.toFixed(0)}"${U.A('draw', at, 0.45, { l: len.toFixed(0) })}/>`;
      if (s.name) { const e = P[P.length - 1]; out += U.T(Math.min(e[0] + 16, 1760), e[1] + 10, s.name, { a: 'start', s: 28, w: 700, f: col, an: U.A('fade', at + 0.45, 0.06) }); }
    });
    (p.annotations || []).forEach((a) => { const x = X(a.x); out += `<g opacity="0"${U.A('fade', a.at ?? 0.6, 0.06)}><path d="M${x} ${T}V${B}" stroke="${th.accent2}" stroke-width="3" stroke-dasharray="10 8"/>${U.T(x + 12, T + 30, a.text, { a: 'start', s: 28, w: 600, f: th.accent2 })}</g>`; });
    return out;
  },
});
preset('area_chart', 'line_chart', { title: 'Area chart', desc: 'A line chart with the area under the line filled.', use: 'Amounts that grow over time.', defaults: { area: true },
  example: { title: 'Example data', xLabel: 'Year', series: [{ name: 'Share', points: [[1800, 5], [1850, 15], [1900, 35], [1950, 75], [2000, 98]] }] } });
preset('graph_plot', 'line_chart', { cat: 'Teaching', title: 'Function graph', desc: 'A function drawn in a coordinate system. Supports polynomials, sine, exponentials and straight lines.', use: 'Math and physics.',
  defaults: { xMin: -4, xMax: 4 }, example: { title: 'f(x) = x² − 2', fn: { type: 'poly', coeffs: [-2, 0, 1], label: 'f(x)' }, yMin: -3, yMax: 14 } });
register('pie_chart', {
  cat: 'Charts', title: 'Pie chart', desc: 'Slices that appear one by one, with a legend beside them.', use: 'How a whole is split up.',
  params: 'title, data: [{label, value, color}], donut, center', example: { title: 'Delegates by group', data: [{ label: 'Officials', value: 57 }, { label: 'Farmers', value: 37 }, { label: 'Others', value: 18 }] },
  build(p, c) {
    const { U, th } = c, D = p.data || [], cols = pal(th), tot = D.reduce((s, d) => s + d.value, 0) || 1, cx = 720, cy = 560, R = 300;
    let a = -90, out = U.bg() + (p.title ? U.T(260, 230, p.title, { a: 'start', fam: 'd', s: 56, w: 700, an: U.A('fade', 0.02, 0.06) }) : '');
    const P = (ang, r) => [cx + r * Math.cos((ang * Math.PI) / 180), cy + r * Math.sin((ang * Math.PI) / 180)];
    D.forEach((d, k) => {
      const sw = (360 * d.value) / tot, b = a + sw, col = d.color || cols[k % cols.length], at = 0.1 + k * (0.5 / D.length), lg = sw > 180 ? 1 : 0;
      if (p.donut) { const r = R - 60, p0 = P(a, r), p1 = P(b - 0.01, r), len = (Math.PI * r * sw) / 180; out += `<path d="M${p0[0].toFixed(1)} ${p0[1].toFixed(1)}A${r} ${r} 0 ${lg} 1 ${p1[0].toFixed(1)} ${p1[1].toFixed(1)}" stroke="${col}" stroke-width="110" fill="none" stroke-dasharray="${len.toFixed(0)}" stroke-dashoffset="${len.toFixed(0)}"${U.A('draw', at, 0.15, { l: len.toFixed(0) })}/>`; }
      else { const p0 = P(a, R), p1 = P(b, R); out += `<g${U.A('pop', at, 0.06, { cx, cy })}><path d="M${cx} ${cy}L${p0[0].toFixed(1)} ${p0[1].toFixed(1)}A${R} ${R} 0 ${lg} 1 ${p1[0].toFixed(1)} ${p1[1].toFixed(1)}Z" fill="${col}" stroke="${th.bg}" stroke-width="4"/></g>`; }
      out += `<g opacity="0"${U.A('fade', at, 0.06)}><rect x="1180" y="${400 + k * 80}" width="40" height="40" rx="6" fill="${col}"/>${U.T(1240, 432 + k * 80, d.label, { a: 'start', s: 34 })}${U.T(1700, 432 + k * 80, Math.round((100 * d.value) / tot) + '%', { a: 'end', s: 34, w: 700, f: col })}</g>`;
      a = b;
    });
    if (p.donut && p.center) out += U.T(cx, cy + 24, p.center, { fam: 'd', s: 72, w: 700, an: U.A('fade', 0.6, 0.08) });
    return out;
  },
});
preset('donut_chart', 'pie_chart', { title: 'Donut chart', desc: 'A pie chart with a hole and a number in the middle.', use: 'One share that should stand out, with the split around it.', defaults: { donut: true },
  example: { title: 'Delegates by group', data: [{ label: 'Officials', value: 57 }, { label: 'Farmers', value: 37 }, { label: 'Others', value: 18 }], center: '112' } });
