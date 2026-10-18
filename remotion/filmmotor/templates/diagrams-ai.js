// Animated diagrams of how computers and AI work, drawn for Meko in the film engine's style. See ../engine.js for how
// templates work. Every visible word comes from the params; a part without a label in the params is drawn unlabeled.
// The drawings hold no numbers, names or other facts of their own: they show how a thing works, and the narration says
// the rest. Every color comes from the video's look, so each drawing fits Night atlas, Blueprint and Field guide.
import { register } from "../engine.js";

const CD = 'Diagrams';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const smooth = (x) => { const q = clamp(x, 0, 1); return q * q * (3 - 2 * q); };
const span = (p, a, b) => clamp((p - a) / (b - a), 0, 1);
const easeIO = (x) => { const q = clamp(x, 0, 1); return q < 0.5 ? 4 * q * q * q : 1 - Math.pow(-2 * q + 2, 3) / 2; };
// Up from 0 to 1 and back down over the part [a, b], 0 elsewhere.
const bump = (x, a, b) => (x <= a || x >= b ? 0 : Math.pow(Math.sin((Math.PI * (x - a)) / (b - a)), 2));
// 1 from a to b, easing in over the stretch e before a and out over the stretch e after b.
const during = (x, a, b, e) => smooth((x - a) / e + 1) * (1 - smooth((x - b) / e));
const n1 = (v) => (+v).toFixed(1);
// A label's text from the params: a non-empty string (or a number), otherwise nothing.
const say = (v) => (typeof v === 'string' ? v.trim() : typeof v === 'number' && Number.isFinite(v) ? String(v) : '');
const labelsOf = (p) => (p.labels && typeof p.labels === 'object' && !Array.isArray(p.labels) ? p.labels : {});
// A list of words from the params: its non-empty strings, at most `max` of them.
const listOf = (v, max) => (Array.isArray(v) ? v.map(say).filter(Boolean).slice(0, max) : []);
// A moment given in the params as a fraction of the scene (TemplateScene turns a spoken word into one), kept in range.
const moment = (v, fallback, lo, hi) => (typeof v === 'number' && Number.isFinite(v) ? clamp(v, lo, hi) : fallback);
// A fixed run of numbers between 0 and 1, so the same params always draw the same picture.
const seeded = (seed) => { let s = seed; return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646; };

// Panels, boxes and nodes take the look's card style: flat on Night atlas, a chalk edge in Blueprint, an ink edge in
// Field guide. lineOf is an outline that shows in every look.
const fillOf = (th) => th.card?.fill ?? th.surface;
const edgeOf = (th, w) => (th.card ? ` stroke="${th.card.stroke}" stroke-width="${w ?? th.card.width}"` : '');
const lineOf = (th) => th.card?.stroke ?? th.muted;

// A label's words in at most two lines no wider than maxW, at the biggest of the sizes that fits (two lines are split
// where they come out most even), or else in up to three lines at the smallest size; the last line takes all the words
// left, so none is lost.
function fitText(U, text, maxW, o = {}) {
  const sizes = o.sizes || [36, 34, 32, 30], weight = o.w || 700, fam = o.fam;
  const words = String(text).trim().split(/\s+/).filter(Boolean), width = (t, s) => U.tw(t, s, { w: weight, fam });
  const all = words.join(' ');
  for (const s of sizes) {
    if (width(all, s) <= maxW) return { s, lines: [all] };
    let best = null;
    for (let i = 1; i < words.length; i++) {
      const lines = [words.slice(0, i).join(' '), words.slice(i).join(' ')], m = Math.max(width(lines[0], s), width(lines[1], s));
      if (m <= maxW && (!best || m < best.m)) best = { m, lines };
    }
    if (best) return { s, lines: best.lines };
  }
  const s = sizes[sizes.length - 1], out = [];
  let cur = '';
  for (const word of words) {
    const next = cur ? cur + ' ' + word : word;
    if (cur && width(next, s) > maxW) { out.push(cur); cur = word; } else cur = next;
  }
  if (cur) out.push(cur);
  return { s, lines: out.length > 3 ? [out[0], out[1], out.slice(2).join(' ')] : out };
}

// How wide and tall a label from the params comes out (see fitText), or zero without text.
function blockSize(U, value, o = {}) {
  const t = say(value);
  if (!t) return { w: 0, h: 0 };
  const { s, lines } = fitText(U, U.lab(t), o.maxW || 320, o);
  return { w: Math.max(...lines.map((line) => U.tw(line, s, { w: o.w || 700, fam: o.fam }))), h: s + (lines.length - 1) * Math.round(s * 1.16) };
}

// A label from the params set at (x, y). o.a is the anchor (start, middle or end) and o.v says whether y is the top,
// the middle or the bottom of the block. It is outlined in the ground color (o.halo, 0 for none), so it stays readable
// where it crosses a line. Without text it draws nothing.
function textBlock(U, th, x, y, value, o = {}) {
  const t = say(value);
  if (!t) return '';
  const { s, lines } = fitText(U, U.lab(t), o.maxW || 320, o), lh = Math.round(s * 1.16), n = lines.length;
  const first = o.v === 'top' ? y + s * 0.78 : o.v === 'bottom' ? y - (n - 1) * lh - s * 0.22 : y - ((n - 1) * lh) / 2 + s * 0.36;
  return `<g${o.an || ''}>` + lines.map((line, i) => U.T(n1(x), n1(first + i * lh), line, { a: o.a || 'middle', s, w: o.w || 700, fam: o.fam, f: o.f || th.ink, halo: o.halo ?? 8 })).join('') + '</g>';
}

// A filled arrowhead with its tip at (x, y), pointing along the angle a.
function head(x, y, a, col, size = 18) {
  const c = Math.cos(a), s = Math.sin(a), bx = x - size * c, by = y - size * s, w = size * 0.62;
  return `<path d="M${n1(x)} ${n1(y)}L${n1(bx + w * s)} ${n1(by - w * c)}L${n1(bx - w * s)} ${n1(by + w * c)}Z" fill="${col}"/>`;
}
// A line that draws itself along its path from `at` over `dur`. pathLength lets the dash work without measuring the
// path, and the fade keeps the round cap from showing as a dot before it starts.
const drawn = (U, d, col, w, at, dur) =>
  `<g opacity="0"${U.A('fade', at, 0.004)}><path d="${d}" pathLength="1000" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="1000 1010" stroke-dashoffset="1000"${U.A('draw', at, dur, { l: 1000 })}/></g>`;
// An arrow that draws itself from (x0, y0) to (x1, y1), its head showing as the line arrives.
function drawnArrow(U, x0, y0, x1, y1, col, w, at, dur, size = 18) {
  const a = Math.atan2(y1 - y0, x1 - x0), hx = x1 - (size - 3) * Math.cos(a), hy = y1 - (size - 3) * Math.sin(a);
  return drawn(U, `M${n1(x0)} ${n1(y0)}L${n1(hx)} ${n1(hy)}`, col, w, at, dur) + `<g opacity="0"${U.A('fade', at + dur * 0.8, 0.02)}>${head(x1, y1, a, col, size)}</g>`;
}
// A thin line from a label to a part, with a dot on the part, outlined in the ground color so it shows over the parts.
function leader(th, x1, y1, x2, y2) {
  const d = `M${n1(x1)} ${n1(y1)}L${n1(x2)} ${n1(y2)}`;
  return `<path d="${d}" stroke="${th.bg}" stroke-width="9" stroke-linecap="round" fill="none"/><path d="${d}" stroke="${th.ink}" stroke-width="3" stroke-linecap="round" fill="none" opacity=".8"/>` +
    `<circle cx="${n1(x1)}" cy="${n1(y1)}" r="7" fill="${th.ink}" stroke="${th.bg}" stroke-width="3"/>`;
}

// A line through points, measured: its points, the distance to each and its length.
function measured(pts) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { pts, cum, len: cum[cum.length - 1] };
}
// The same through the corners `pts` with every corner rounded off at radius r.
function rounded(pts, r) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i], [cx, cy] = pts[i + 1];
    const l1 = Math.hypot(bx - ax, by - ay), l2 = Math.hypot(cx - bx, cy - by), rr = Math.min(r, l1 / 2, l2 / 2);
    const p1 = [bx - ((bx - ax) / l1) * rr, by - ((by - ay) / l1) * rr], p2 = [bx + ((cx - bx) / l2) * rr, by + ((cy - by) / l2) * rr];
    for (let k = 0; k <= 8; k++) { const u = k / 8; out.push([(1 - u) * (1 - u) * p1[0] + 2 * (1 - u) * u * bx + u * u * p2[0], (1 - u) * (1 - u) * p1[1] + 2 * (1 - u) * u * by + u * u * p2[1]]); }
  }
  out.push(pts[pts.length - 1]);
  return measured(out);
}
// The point at distance s along a measured line.
function pointAt(tr, s) {
  const d = clamp(s, 0, tr.len);
  let i = 1;
  while (i < tr.cum.length - 1 && tr.cum[i] < d) i++;
  const [ax, ay] = tr.pts[i - 1], [bx, by] = tr.pts[i], u = (d - tr.cum[i - 1]) / (tr.cum[i] - tr.cum[i - 1] || 1);
  return [ax + (bx - ax) * u, ay + (by - ay) * u];
}
const pathOf = (pts) => 'M' + pts.map((q) => n1(q[0]) + ' ' + n1(q[1])).join('L');
// A drawing that leaves room in the frame is drawn a little bigger around (x, y), so it reads better on a phone.
const bigger = (o, x, y, k) => `<g transform="translate(${x} ${y}) scale(${k}) translate(${-x} ${-y})">${o}</g>`;

/* ---------------------------------------------------------------------------------------------------------------
 * Neural network
 * ------------------------------------------------------------------------------------------------------------- */

// Columns of nodes: four inputs, one to three hidden layers of five and three outputs, 100 px apart around y 450.
const NN = { cy: 450, r: 30, gap: 100 };
// How strongly each node fires once the signal reaches it: every input carries it, the hidden nodes fire more or less,
// and of the outputs the middle one fires the most. Fixed, so the same params always draw the same picture.
const NN_IN = [1, 0.7, 0.9, 0.55];
const NN_HIDDEN = [[0.85, 0.3, 1, 0.45, 0.65], [0.4, 0.95, 0.25, 0.8, 0.55], [0.7, 0.35, 0.9, 0.2, 0.6]];
const NN_OUT = [0.3, 1, 0.18];
const NN_WIN = 1;

function nnPlan(p) {
  const hidden = clamp(Math.round(Number(p.hidden)) || 2, 1, 3), counts = [4, ...Array(hidden).fill(5), 3], n = counts.length;
  const width = [760, 900, 1000][hidden - 1], x0 = 960 - width / 2, dx = width / (n - 1);
  const cols = counts.map((cnt, k) => Array.from({ length: cnt }, (_, i) => [x0 + k * dx, NN.cy + (i - (cnt - 1) / 2) * NN.gap]));
  const act = counts.map((_, k) => (k === 0 ? NN_IN : k === n - 1 ? NN_OUT : NN_HIDDEN[k - 1]));
  // How much of its node's signal each connection carries, and how long after the others its pulse sets off, from a
  // seeded run of numbers.
  const rnd = seeded(41 + hidden), links = [];
  for (let k = 0; k < n - 1; k++) cols[k].forEach((a, i) => cols[k + 1].forEach((b) => links.push({ k, a, b, s: (0.25 + 0.75 * rnd()) * act[k][i], lag: 0.14 * rnd() })));
  // The inputs light up at `at`; then the signal crosses one gap between columns after another, all done by 0.8.
  const at = moment(p.at, 0.2, 0.08, 0.45), each = (0.75 - at) / (n - 1);
  return { hidden, n, cols, act, links, at, each, wave: (k) => at + 0.05 + k * each, x0, dx, end: 0.8 };
}

register('neural_network', {
  cat: CD,
  title: 'Neural network',
  desc: 'Columns of nodes joined by lines: an input layer, one to three hidden layers and an output layer. A signal comes in at the inputs and flows forward as pulses along the connections; the nodes light up layer by layer, some more than others, and one output node ends up brightest.',
  use: 'How a neural network or an AI model works inside: layers of artificial neurons joined by connections, and a signal passing forward through them to an answer.',
  params: 'labels: {input, hidden, output, signal} (each optional, 1 to 3 words from the narration), hidden (how many hidden layers, 1 to 3, default 2), at (when the signal comes in, 0 to 1)',
  example: { labels: { input: 'Input layer', hidden: 'Hidden layers', output: 'Output layer', signal: 'Signal' }, hidden: 2 },
  build(p, c) {
    const { U, th } = c, id = c.id, L = labelsOf(p), P = nnPlan(p), r = NN.r, last = P.n - 1;
    const xl = P.x0 + last * P.dx, top = NN.cy - 2 * NN.gap - r, bottom = NN.cy + 2 * NN.gap + r;
    const seg = (ln) => `M${n1(ln.a[0])} ${n1(ln.a[1])}L${n1(ln.b[0])} ${n1(ln.b[1])}`;
    let o = '';
    // The connections, faint, one gap after another; over each a bright copy that lights up as the signal passes, and
    // the signal's pulse. The pulses run under the nodes, so each comes out of one node and sinks into the next.
    for (let k = 0; k < last; k++) {
      o += `<g opacity="0"${U.A('fade', 0.06 + k * 0.025, 0.06)}>` + P.links.filter((ln) => ln.k === k).map((ln) => `<path d="${seg(ln)}" stroke="${th.muted}" stroke-opacity=".4" stroke-width="2.5"/>`).join('') + '</g>';
    }
    o += P.links.map((ln, m) => `<path id="${id}h${m}" d="${seg(ln)}" pathLength="1000" stroke="${th.accent}" stroke-width="${n1(2.5 + 3 * ln.s)}" stroke-linecap="round" stroke-dasharray="1000 1010" stroke-dashoffset="1000" opacity="0"/>`).join('');
    o += P.links.map((ln, m) => `<circle id="${id}d${m}" r="${n1(5 + 4 * ln.s)}" fill="${th.accent}" opacity="0"/>`).join('');
    // The signal comes in at the inputs from the left.
    P.cols[0].forEach(([x, y]) => { o += drawnArrow(U, x - 170, y, x - r - 12, y, th.muted, 5, P.at - 0.06, 0.05); });
    // The nodes, column by column. Each lights up as the signal reaches it: the more it fires, the more of it fills.
    P.cols.forEach((col, k) => col.forEach(([x, y], i) => {
      o += `<g${U.A('pop', 0.02 + k * 0.03 + i * 0.008, 0.05, { cx: n1(x), cy: n1(y) })}><circle cx="${n1(x)}" cy="${n1(y)}" r="${r}" fill="${fillOf(th)}" stroke="${lineOf(th)}" stroke-width="3"/>` +
        `<circle id="${id}n${k}_${i}" cx="${n1(x)}" cy="${n1(y)}" r="0" fill="${th.accent}" opacity="0"/></g>`;
    }));
    // The brightest output gets a ring, and the answer leaves it to the right.
    const [wx, wy] = P.cols[last][NN_WIN];
    o += `<g${U.A('pop', P.end + 0.01, 0.05, { cx: n1(wx), cy: n1(wy) })}><circle cx="${n1(wx)}" cy="${n1(wy)}" r="${r + 13}" fill="none" stroke="${th.accent}" stroke-width="5"/></g>`;
    o += drawnArrow(U, wx + r + 20, wy, wx + 170, wy, th.accent, 6, P.end + 0.03, 0.05);
    // The names under the columns, the hidden layers' name under a bracket that spans them, and the signal's name over
    // an arrow along the top that shows which way it goes.
    const yl = bottom + 36, maxW = P.n === 5 ? 290 : 320, xh0 = P.x0 + P.dx, xh1 = P.x0 + P.hidden * P.dx;
    o += textBlock(U, th, P.x0, yl, L.input, { v: 'top', maxW, an: U.A('fade', 0.08, 0.05) });
    o += textBlock(U, th, xl, yl, L.output, { v: 'top', maxW, an: U.A('fade', 0.12, 0.05) });
    if (say(L.hidden)) {
      if (P.hidden > 1) o += `<path d="M${n1(xh0 - 40)} ${bottom + 8}V${bottom + 20}H${n1(xh1 + 40)}V${bottom + 8}" fill="none" stroke="${th.muted}" stroke-width="3" stroke-linejoin="round" opacity="0"${U.A('fade', 0.1, 0.05)}/>`;
      o += textBlock(U, th, (xh0 + xh1) / 2, yl, L.hidden, { v: 'top', maxW: P.hidden > 1 ? xh1 - xh0 + 60 : maxW, an: U.A('fade', 0.1, 0.05) });
    }
    if (say(L.signal)) {
      const ya = top - 46;
      o += drawnArrow(U, P.x0, ya, xl, ya, th.accent, 5, P.at, 0.12);
      o += textBlock(U, th, 960, ya - 22, L.signal, { v: 'bottom', maxW: 700, f: th.accent, an: U.A('fade', P.at, 0.05) });
    }
    return o;
  },
  init(g, p, c) {
    const P = nnPlan(p), q = (s) => g.querySelector('#' + c.id + s);
    return { P, nodes: P.cols.map((col, k) => col.map((_, i) => q(`n${k}_${i}`))), hl: P.links.map((_, m) => q('h' + m)), dots: P.links.map((_, m) => q('d' + m)) };
  },
  render(l, st) {
    const P = st.P, p = l.p;
    // A node lights up as a disc of the highlight that grows to fill as much of it as the node fires.
    const light = (el, a, g) => { el.setAttribute('r', n1((NN.r - 2.5) * (0.3 + 0.7 * a) * (1 - Math.pow(1 - g, 3)))); el.setAttribute('opacity', g > 0 ? '1' : '0'); };
    st.nodes[0].forEach((el, i) => light(el, P.act[0][i], smooth((p - P.at) / 0.05)));
    // Each gap: the pulses run along it, and the next column lights up as they arrive.
    for (let k = 0; k < P.n - 1; k++) {
      const v = (p - P.wave(k)) / P.each;
      st.nodes[k + 1].forEach((el, j) => light(el, P.act[k + 1][j], smooth((v - 0.6) / 0.28)));
    }
    // A connection lights up behind its pulse as it runs, brighter for the ones that carry more, and keeps a faint glow.
    // The pulses set off a little apart, and those on the stronger connections run a little faster, so the signal
    // flows rather than marches.
    P.links.forEach((ln, m) => {
      const v = (p - P.wave(ln.k)) / P.each, u = clamp((v - ln.lag) / (0.55 + 0.25 * (1 - ln.s)), 0, 1), peak = 0.25 + 0.75 * ln.s, rest = 0.2 * ln.s;
      const h = v <= ln.lag ? 0 : v < 0.95 ? peak : rest + (peak - rest) * (1 - smooth((v - 0.95) / 0.5));
      st.hl[m].setAttribute('opacity', h.toFixed(3));
      st.hl[m].setAttribute('stroke-dashoffset', n1(1000 * (1 - u)));
      const dot = st.dots[m], on = u > 0 && u < 1;
      dot.setAttribute('opacity', on ? (0.5 + 0.5 * ln.s).toFixed(3) : '0');
      if (on) {
        dot.setAttribute('cx', n1(ln.a[0] + (ln.b[0] - ln.a[0]) * u));
        dot.setAttribute('cy', n1(ln.a[1] + (ln.b[1] - ln.a[1]) * u));
      }
    });
  },
});

/* ---------------------------------------------------------------------------------------------------------------
 * Next word prediction
 * ------------------------------------------------------------------------------------------------------------- */

// The text so far as a row of word tiles along the top, ending in an empty slot; the model below the words reads them;
// the candidate next words sit in a column under the slot, each with a bar, and the chosen one rises into the slot.
const NW = { row: 250, tileH: 96, gap: 18, my: 570, mh: 170, barH: 58, barGap: 26, barMax: 420, cand: 40, rowMax: 1250 };
// Blank tiles stand in for words when the params give none. The bars' lengths: the first candidate's is the longest.
// In a second round the bars are blank and the longest is the second one, so the round reads as a new choice.
const NW_BLANK = [170, 132, 200, 150];
const NW_BLANK_W = 170;
const NW_BARS = [1, 0.6, 0.36, 0.2];
const NW_BARS_2 = [0.5, 1, 0.3, 0.18];
const NW_K2 = 1;
const easeBack = (x) => { const c = 1.70158, q = clamp(x, 0, 1) - 1; return 1 + (c + 1) * q * q * q + c * q * q; };

function nwPlan(U, p) {
  // A long text keeps its last words, the ones the next word follows.
  const L = labelsOf(p), given = listOf(p.words, 100).slice(-10), cands = listOf(p.candidates, 4), repeat = p.repeat === true, chosen = cands[0] || '';
  const tileW = (t, s) => Math.max(100, Math.round(U.tw(U.lab(t), s, { w: 600 }) + s * 1.3));
  const rowW = (s) => (given.length ? given.reduce((a, t) => a + tileW(t, s) + NW.gap, 0) : NW_BLANK.reduce((a, w) => a + w + NW.gap, 0)) + (chosen ? tileW(chosen, s) : NW_BLANK_W) + (repeat ? NW.gap + NW_BLANK_W : 0);
  const s = [52, 48, 44, 40, 36].find((size) => rowW(size) <= NW.rowMax) ?? 36;
  // Everything is laid out from x 0 and moved to the middle of the frame at the end.
  const tiles = [];
  let x = 0;
  (given.length ? given : NW_BLANK.map(() => '')).forEach((t, i) => { const w = t ? tileW(t, s) : NW_BLANK[i]; tiles.push({ text: t, x, w }); x += w + NW.gap; });
  const slot = { x, w: chosen ? tileW(chosen, s) : NW_BLANK_W }, slot2 = repeat ? { x: slot.x + slot.w + NW.gap, w: NW_BLANK_W } : null;
  const rowEnd = slot2 ? slot2.x + slot2.w : slot.x + slot.w;
  // A single candidate gets two blank ones beside it; none gives three blank ones.
  const rows = cands.length >= 2 ? cands : cands.length === 1 ? [cands[0], '', ''] : ['', '', ''];
  const colW = Math.max(110, ...rows.map((t) => (t ? U.tw(U.lab(t), NW.cand, { w: 600 }) : 0)));
  const choice = blockSize(U, L.choice, { maxW: 320, sizes: [38, 36, 34, 32] }), name = blockSize(U, L.model, { maxW: 460, sizes: [44, 40, 36, 32] });
  // The model box holds a small network and its name.
  const mw = name.w ? clamp(108 + 30 + name.w + 80, 420, 760) : 340;
  // Below the row: the model, an arrow, and the column of candidates with their bars and the choice's name. The column
  // goes right under the slot, so the chosen word rises straight up into it, unless that makes the drawing too wide;
  // then it moves left as far as needed.
  let slotCx = slot.x + slot.w / 2;
  const before = colW / 2 + 150 + mw, after = colW / 2 + 26 + NW.barMax + (choice.w ? 28 + choice.w : 0);
  const widthAt = (cx) => Math.max(rowEnd, cx + after) - Math.min(0, cx - before), lo = Math.min(before, rowEnd - after), hi = Math.max(before, rowEnd - after);
  let colCx = slotCx;
  while (widthAt(colCx) > 1800 && colCx > lo) colCx -= 10;
  if (widthAt(colCx) > 1800) colCx = clamp(slotCx, lo, hi);
  let xb = colCx + colW / 2 + 26, mx = colCx - colW / 2 - 150 - mw / 2;
  const left = Math.min(0, mx - mw / 2), right = Math.max(rowEnd, colCx + after), dx = 960 - (left + right) / 2;
  tiles.forEach((t) => { t.x += dx; t.cx = t.x + t.w / 2; });
  slot.x += dx;
  if (slot2) slot2.x += dx;
  slotCx += dx;
  colCx += dx;
  xb += dx;
  mx += dx;
  const rowY = rows.map((_, k) => NW.my + (k - (rows.length - 1) / 2) * (NW.barH + NW.barGap));
  // Where each reading line meets the top of the model.
  const m = tiles.length + (repeat ? 1 : 0), inX = Array.from({ length: m }, (_, i) => (m === 1 ? mx : mx - (mw - 140) / 2 + (i * (mw - 140)) / (m - 1)));
  // When things happen. `at` is the moment the model picks the word.
  const at = repeat ? moment(p.at, 0.38, 0.34, 0.46) : moment(p.at, 0.56, 0.42, 0.72);
  const n = tiles.length, step = Math.min(0.02, 0.1 / n), r0 = repeat ? 0.13 : 0.16, r1 = at - (repeat ? 0.15 : 0.19), b = at + 0.17, c2 = b + 0.18;
  const time = {
    tile: tiles.map((_, i) => 0.02 + i * step), slot: 0.03 + n * step, model: 0.1,
    read: tiles.map((_, i) => r0 + (i * (r1 - r0)) / n), readEnd: r1,
    arrow: at - (repeat ? 0.14 : 0.17), cand: rows.map((_, k) => at - (repeat ? 0.1 : 0.13) + k * 0.02),
    choose: at, lift: at + 0.025, rise: at + 0.06, land: at + 0.16,
    // The second round, when asked for: the model reads again with the new word, new bars, and a word rises again.
    b, cand2: rows.map((_, k) => b + 0.1 + k * 0.02), c2, lift2: c2 + 0.025, rise2: c2 + 0.055, land2: c2 + 0.15,
  };
  return { L, s, tiles, slot, slot2, slotCx, colCx, rows, colW, xb, rowY, mx, mw, name, inX, chosen, repeat, time, think: repeat ? [[r0, r1 + 0.05], [b, b + 0.1]] : [[r0, r1 + 0.05]] };
}

// A word tile with its word, or a blank tile with a gray line in place of a word. A chosen tile is filled with the
// highlight.
function wordTile(U, th, x, w, text, s, chosen) {
  const y = NW.row - NW.tileH / 2, rx = th.radius + 6;
  const box = `<rect x="${n1(x)}" y="${y}" width="${n1(w)}" height="${NW.tileH}" rx="${rx}"${chosen ? ` fill="${th.accent}"` : ` fill="${fillOf(th)}"${edgeOf(th)}`}/>`;
  return box + (text ? U.T(n1(x + w / 2), n1(NW.row + s * 0.35), U.lab(text), { s, w: 600, f: chosen ? th.bg : th.ink }) :
    `<rect x="${n1(x + 30)}" y="${NW.row - 8}" width="${n1(w - 60)}" height="16" rx="8" fill="${chosen ? th.bg : th.muted}" opacity="${chosen ? 0.65 : 0.5}"/>`);
}

// The small network drawn inside the model box: three columns of three nodes, each joined to the next column's.
function modelGlyph(th, cx, cy, id) {
  const pts = [-1, 0, 1].map((a) => [-1, 0, 1].map((b) => [cx + a * 44, cy + b * 34]));
  let o = '';
  for (let a = 0; a < 2; a++) pts[a].forEach((u) => pts[a + 1].forEach((v) => { o += `<path d="M${n1(u[0])} ${n1(u[1])}L${n1(v[0])} ${n1(v[1])}" stroke="${th.muted}" stroke-width="3" opacity=".7"/>`; }));
  pts.flat().forEach(([x, y], k) => { o += `<circle cx="${n1(x)}" cy="${n1(y)}" r="10" fill="${th.muted}"/><circle id="${id}g${k}" cx="${n1(x)}" cy="${n1(y)}" r="10" fill="${th.accent2}" opacity="0"/>`; });
  return o;
}

register('next_word_prediction', {
  cat: CD,
  title: 'How a language model writes',
  desc: 'The text so far as a row of word tiles with an empty slot at its end. A language model reads the words, a few candidate next words appear as bars of different lengths (no numbers), and the longest is chosen and rises into the slot as the next word. Can go round once more with the new word, with blank bars.',
  use: 'How chatbots and large language models write text: predicting the next word (token) from the words so far, one word at a time.',
  params: 'words (the text so far, a list of words from the narration; empty draws blank tiles), candidates (2 to 4 candidate next words from the narration, the chosen one first; empty draws blank bars), labels: {model, text, choice} (each optional, 1 to 4 words from the narration), repeat (true goes round once more with blank bars; default false), at (when the word is chosen, 0 to 1)',
  example: { words: ['The', 'cat', 'sat', 'on', 'the'], candidates: ['mat', 'floor', 'sofa'], labels: { model: 'Language model', text: 'Text so far', choice: 'Most likely word' } },
  build(p, c) {
    const { U, th } = c, id = c.id, P = nwPlan(U, p), T = P.time, L = P.L;
    const lineTop = NW.row + NW.tileH / 2 + 8, lineBottom = NW.my - NW.mh / 2 - 8, inX = P.inX;
    const curve = (x0, x1) => `M${n1(x0)} ${lineTop}C${n1(x0)} ${lineTop + 90} ${n1(x1)} ${lineBottom - 90} ${n1(x1)} ${lineBottom}`;
    const dashed = (x, w, at, gone) => `<g opacity="0"${U.A('fade', at, 0.04)}><rect x="${n1(x)}" y="${NW.row - NW.tileH / 2}" width="${n1(w)}" height="${NW.tileH}" rx="${th.radius + 6}" fill="none" stroke="${th.muted}" stroke-width="3" stroke-dasharray="12 9"${U.A('dim', gone, 0.02, { to: 0 })}/></g>`;
    let o = textBlock(U, th, P.tiles[0].x, NW.row - NW.tileH / 2 - 22, L.text, { a: 'start', v: 'bottom', maxW: 600, sizes: [38, 36, 34, 32], an: U.A('fade', 0.04, 0.05) });
    // The reading lines from the words down into the model, drawn one by one as it reads, then dimmed.
    o += `<g${U.A('dim', T.readEnd + 0.04, 0.06, { to: 0.4 })}>` + P.tiles.map((t, i) => drawn(U, curve(t.cx, inX[i]), th.accent2, 5, T.read[i], 0.05)).join('') + '</g>';
    // The word tiles, each outlined in the second highlight as the model reads it, and the empty slot.
    P.tiles.forEach((t, i) => {
      o += `<g${U.A('pop', T.tile[i], 0.05, { cx: n1(t.cx), cy: NW.row })}>${wordTile(U, th, t.x, t.w, t.text, P.s, false)}` +
        `<rect x="${n1(t.x)}" y="${NW.row - NW.tileH / 2}" width="${n1(t.w)}" height="${NW.tileH}" rx="${th.radius + 6}" fill="none" stroke="${th.accent2}" stroke-width="5" opacity="0"${U.A('fade', T.read[i], 0.04)}/></g>`;
    });
    o += dashed(P.slot.x, P.slot.w, T.slot, T.land);
    // The model: a box with a small network and its name. While it reads, its edge lights up and the network flickers.
    const mx = P.mx, mw = P.mw, groupW = 108 + (P.name.w ? 30 + P.name.w : 0), gx = mx - groupW / 2 + 54, box = `x="${n1(mx - mw / 2)}" y="${NW.my - NW.mh / 2}" width="${n1(mw)}" height="${NW.mh}" rx="${th.radius + 12}"`;
    o += `<g${U.A('pop', T.model, 0.06, { cx: n1(mx), cy: NW.my })}><rect ${box} fill="${fillOf(th)}" stroke="${lineOf(th)}" stroke-width="3"/><rect id="${id}edge" ${box} fill="none" stroke="${th.accent2}" stroke-width="6" opacity="0"/>` +
      modelGlyph(th, gx, NW.my, id) + textBlock(U, th, gx + 54 + 30, NW.my, L.model, { a: 'start', maxW: 460, sizes: [44, 40, 36, 32], halo: 0 }) + '</g>';
    // From the model to the candidates.
    o += drawnArrow(U, mx + mw / 2 + 18, NW.my, P.colCx - P.colW / 2 - 24, NW.my, th.muted, 6, T.arrow, 0.05, 22);
    // The candidates, each a word (or a blank chip) with a bar; the chosen bar turns to the highlight, the others dim.
    const rowsOf = (lengths, k0, times, tChoose, blank) => P.rows.map((t, k) => {
      const y = P.rowY[k], len = NW.barMax * lengths[k], text = blank ? '' : t;
      const word = text ? U.T(n1(P.colCx), n1(y + NW.cand * 0.36), U.lab(text), { s: NW.cand, w: 600, f: th.ink }) : `<rect x="${n1(P.colCx - 55)}" y="${n1(y - 9)}" width="110" height="18" rx="9" fill="${th.muted}" opacity=".5"/>`;
      const bar = (col, op) => `<rect x="${n1(P.xb)}" y="${n1(y - NW.barH / 2)}" width="${n1(len)}" height="${NW.barH}" rx="10" fill="${col}"${op}`;
      const row = `<g opacity="0"${U.A('fade', times[k], 0.04)}>${word}</g>${bar(th.muted, ' fill-opacity=".5"')}${U.A('grow', times[k], 0.07, { ax: 'x', cx: n1(P.xb), cy: n1(y) })}/>`;
      return k === k0 ? row + bar(th.accent, ' opacity="0"') + `${U.A('fade', tChoose, 0.03)}/>` : `<g${U.A('dim', tChoose, 0.04, { to: 0.4 })}>${row}</g>`;
    }).join('');
    const choiceAt = (k, at) => textBlock(U, th, P.xb + NW.barMax + 28, P.rowY[k], L.choice, { a: 'start', maxW: 320, sizes: [38, 36, 34, 32], f: th.accent, an: U.A('fade', at, 0.05) });
    const round1 = rowsOf(NW_BARS, 0, T.cand, T.choose, false) + choiceAt(0, T.choose + 0.02);
    o += P.repeat ? `<g${U.A('dim', T.b + 0.08, 0.04, { to: 0 })}>${round1}</g>` : round1;
    // The chosen word lifts out of the list as a tile and rises into the slot (placed by render).
    o += `<g id="${id}up1" opacity="0">${wordTile(U, th, P.slot.x, P.slot.w, P.chosen, P.s, true)}</g>`;
    if (P.repeat) {
      // Once more: a new slot, the model reads all the words again with the new one, new blank bars, and the longest
      // rises into the new slot as a blank tile.
      const s2 = P.slot2, all = [...P.tiles.map((t) => t.cx), P.slotCx];
      o += dashed(s2.x, s2.w, T.b - 0.02, T.land2);
      o += `<g opacity="0"${U.A('fade', T.b, 0.03)}><g${U.A('dim', T.b + 0.08, 0.05, { to: 0 })}>` + all.map((x, i) => `<path d="${curve(x, inX[i])}" fill="none" stroke="${th.accent2}" stroke-width="5" stroke-linecap="round"/>`).join('') + '</g></g>';
      o += `<g${U.A('dim', T.b + 0.12, 0.05, { to: 0.4 })}>${drawn(U, curve(P.slotCx, inX[all.length - 1]), th.accent2, 5, T.b, 0.04)}</g>`;
      o += rowsOf(NW_BARS_2, NW_K2, T.cand2, T.c2, true) + choiceAt(NW_K2, T.c2 + 0.02);
      o += `<g id="${id}up2" opacity="0">${wordTile(U, th, s2.x, s2.w, '', P.s, true)}</g>`;
    }
    return o;
  },
  init(g, p, c) {
    const P = nwPlan(c.U, p), q = (s) => g.querySelector('#' + c.id + s);
    return { P, edge: q('edge'), up1: q('up1'), up2: q('up2'), nodes: Array.from({ length: 9 }, (_, k) => q('g' + k)) };
  },
  render(l, st) {
    const P = st.P, T = P.time, p = l.p;
    // While the model reads, its edge lights up and the nodes of its small network flicker on and off.
    const on = Math.max(...P.think.map(([a, b]) => during(p, a, b, 0.02)));
    st.edge?.setAttribute('opacity', on.toFixed(3));
    st.nodes.forEach((el, k) => el?.setAttribute('opacity', (on * (0.5 + 0.5 * Math.sin(l.t * 9 + k * 2.1))).toFixed(3)));
    // A chosen word pops up as a tile where it is in the list and rises from there into its slot.
    const rise = (el, lift, start, fromX, fromY, toX) => {
      if (!el) return;
      const a = smooth((p - lift) / 0.04), e = easeIO(span(p, start, start + 0.1)), sc = 0.6 + 0.4 * easeBack(a);
      const x = (fromX - toX) * (1 - e), y = (fromY - NW.row) * (1 - e);
      el.setAttribute('transform', `translate(${n1(x + toX)} ${n1(y + NW.row)}) scale(${sc.toFixed(3)}) translate(${n1(-toX)} ${-NW.row})`);
      el.setAttribute('opacity', a.toFixed(3));
    };
    rise(st.up1, T.lift, T.rise, P.colCx, P.rowY[0], P.slotCx);
    if (P.repeat) rise(st.up2, T.lift2, T.rise2, P.colCx, P.rowY[NW_K2], P.slot2.x + P.slot2.w / 2);
  },
});

/* ---------------------------------------------------------------------------------------------------------------
 * CPU and GPU
 * ------------------------------------------------------------------------------------------------------------- */

// Two chips side by side, each under a queue of the same 48 tasks: the CPU with four big cores, the GPU with 48 small
// ones. The queue's front is its bottom row, nearest the chip.
const GP = { cpu: 540, gpu: 1380, qTop: 262, sq: 24, pitch: 32, chipTop: 436, chipW: 420, chipH: 330 };
const GP_CY = GP.chipTop + GP.chipH / 2;
// How long the CPU takes for each four tasks, as a share of the scene. Each of its cores is quicker at a task than one
// of the GPU's, which takes about twice as long, but the GPU has many more of them.
const GP_ROUND = 0.16;

function gpPlan(p) {
  const at = moment(p.at, 0.22, 0.12, 0.4);
  const queue = (cx) => Array.from({ length: 48 }, (_, i) => [cx + ((i % 12) - 5.5) * GP.pitch, GP.qTop + GP.sq / 2 + Math.floor(i / 12) * GP.pitch]);
  const cpuCores = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => ({ x: GP.cpu + a * 94, y: GP_CY + b * 71, w: 170, h: 124 }));
  const gpuCores = Array.from({ length: 48 }, (_, i) => ({ x: GP.gpu + ((i % 8) - 3.5) * 44, y: GP_CY + (Math.floor(i / 8) - 2.5) * 40, w: 36, h: 32 }));
  // The CPU takes its tasks from the front of the queue, four at a time, one into each core.
  const cpuOrder = Array.from({ length: 48 }, (_, k) => (3 - Math.floor(k / 12)) * 12 + (k % 12));
  // The GPU takes all 48 at once, the front row first, and they are all done together.
  const gpuGo = (i) => at + (0.036 * (3 - Math.floor(i / 12))) / 3, gpuDone = at + 0.32;
  const appear = (i) => 0.07 + (i % 12) * 0.006 + Math.floor(i / 12) * 0.008;
  return { at, cpuQ: queue(GP.cpu), gpuQ: queue(GP.gpu), cpuCores, gpuCores, cpuOrder, gpuGo, gpuDone, appear };
}

// A chip: a rounded square with pins along its four sides.
function chip(th, cx) {
  const x = cx - GP.chipW / 2, y = GP.chipTop, w = GP.chipW, h = GP.chipH;
  let pins = '';
  for (let k = 0; k < 7; k++) {
    const px = x + 45 + (k * (w - 90)) / 6, py = y + 40 + (k * (h - 80)) / 6;
    pins += `<rect x="${n1(px - 6)}" y="${y - 14}" width="12" height="14" rx="2"/><rect x="${n1(px - 6)}" y="${y + h}" width="12" height="14" rx="2"/>` +
      `<rect x="${x - 14}" y="${n1(py - 6)}" width="14" height="12" rx="2"/><rect x="${x + w}" y="${n1(py - 6)}" width="14" height="12" rx="2"/>`;
  }
  return `<g fill="${th.muted}">${pins}</g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="${fillOf(th)}" stroke="${lineOf(th)}" stroke-width="3"/>`;
}

register('gpu_parallel', {
  cat: CD,
  title: 'CPU and GPU',
  desc: 'A CPU with a few big cores beside a GPU with a grid of many small cores, each under a queue of the same tasks (small squares). The CPU works through its queue four tasks at a time, one after another; the GPU takes the whole batch into its cores at once and is done while the CPU is still going.',
  use: 'Why graphics chips (GPUs) are used for AI and graphics: many small cores working in parallel against a few fast cores working in turn.',
  params: 'labels: {cpu, gpu, cores, tasks} (each optional, 1 to 3 words from the narration), at (when both start working, 0 to 1)',
  example: { labels: { cpu: 'CPU', gpu: 'GPU', cores: 'Cores', tasks: 'Tasks' } },
  build(p, c) {
    const { U, th } = c, id = c.id, L = labelsOf(p), P = gpPlan(p);
    let o = '';
    // Each side: its name, its queue's empty places (which show once the tasks leave them), the chip and its cores.
    [[GP.cpu, L.cpu, P.cpuQ, P.cpuCores, 'c'], [GP.gpu, L.gpu, P.gpuQ, P.gpuCores, 'g']].forEach(([cx, name, Q, cores, key], side) => {
      o += textBlock(U, th, cx, GP.qTop - 26, name, { v: 'bottom', maxW: 440, fam: 'd', sizes: [48, 44, 40, 36], an: U.A('fade', 0.03 + side * 0.02, 0.05) });
      o += `<g opacity="0"${U.A('fade', 0.06, 0.05)}>` + Q.map(([x, y]) => `<rect x="${n1(x - GP.sq / 2)}" y="${n1(y - GP.sq / 2)}" width="${GP.sq}" height="${GP.sq}" rx="4" fill="none" stroke="${th.muted}" stroke-width="2" opacity=".45"/>`).join('') + '</g>';
      o += `<g${U.A('pop', 0.01 + side * 0.02, 0.06, { cx, cy: GP_CY })}>${chip(th, cx)}` +
        cores.map((k, i) => `<rect x="${n1(k.x - k.w / 2)}" y="${n1(k.y - k.h / 2)}" width="${k.w}" height="${k.h}" rx="${key === 'c' ? 10 : 4}" fill="${th.bg}" stroke="${lineOf(th)}" stroke-width="2"/>` +
          `<rect id="${id}${key}f${i}" x="${n1(k.x - k.w / 2)}" y="${n1(k.y + k.h / 2)}" width="${k.w}" height="0" rx="${key === 'c' ? 10 : 4}" fill="${th.accent}" opacity="0"/>`).join('') + '</g>';
    });
    // The tasks, placed every frame by render.
    for (let i = 0; i < 48; i++) o += `<rect id="${id}ct${i}" x="${-GP.sq / 2}" y="${-GP.sq / 2}" width="${GP.sq}" height="${GP.sq}" rx="4" fill="${th.accent2}" opacity="0"/>`;
    for (let i = 0; i < 48; i++) o += `<rect id="${id}gt${i}" x="${-GP.sq / 2}" y="${-GP.sq / 2}" width="${GP.sq}" height="${GP.sq}" rx="4" fill="${th.accent2}" opacity="0"/>`;
    // The GPU is done: a check on its corner.
    const bx = GP.gpu + GP.chipW / 2 - 8, by = GP.chipTop + 8;
    o += `<g${U.A('pop', P.gpuDone + 0.01, 0.05, { cx: bx, cy: by })}><circle cx="${bx}" cy="${by}" r="40" fill="${th.good}" stroke="${th.bg}" stroke-width="5"/>` +
      `<path d="M${bx - 18} ${by + 1}L${bx - 5} ${by + 14}L${bx + 19} ${by - 12}" fill="none" stroke="${th.bg}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/></g>`;
    // The names of the tasks and the cores between the two sides, with lines to both.
    const both = (text, y, a, b, at) => {
      const size = blockSize(U, text, { maxW: 300 });
      if (!size.w) return '';
      return `<g opacity="0"${U.A('fade', at, 0.05)}>${leader(th, a[0], a[1], 960 - size.w / 2 - 16, y)}${leader(th, b[0], b[1], 960 + size.w / 2 + 16, y)}${textBlock(U, th, 960, y, text, { maxW: 300 })}</g>`;
    };
    const qy = GP.qTop + 1.5 * GP.pitch + GP.sq / 2;
    o += both(L.tasks, qy, [GP.cpu + 5.5 * GP.pitch + 4, qy], [GP.gpu - 5.5 * GP.pitch - 4, qy], 0.14);
    o += both(L.cores, GP_CY - 30, [GP.cpu + 94 + 85 - 8, GP_CY - 71], [GP.gpu - 3.5 * 44 - 18 + 8, GP_CY - 20], 0.08);
    return bigger(o, 960, 476, 1.1);
  },
  init(g, p, c) {
    const P = gpPlan(p), q = (s) => g.querySelector('#' + c.id + s), ids = (key, n) => Array.from({ length: n }, (_, i) => q(key + i));
    return { P, cpuTasks: ids('ct', 48), gpuTasks: ids('gt', 48), cpuFill: ids('cf', 4), gpuFill: ids('gf', 48) };
  },
  render(l, st, prm, c) {
    const { th } = c, P = st.P, p = l.p, u = l.t / l.dur;
    const place = (el, x, y, sc, op) => { el.setAttribute('transform', `translate(${n1(x)} ${n1(y)}) scale(${sc.toFixed(3)})`); el.setAttribute('opacity', op.toFixed(3)); };
    // A core fills up from the bottom while it works on a task, turns to the done color when it is done, and empties.
    const fill = (el, core, arrive, done, now) => {
      const q = span(now, arrive, done), h = core.h * q, finished = now >= done;
      el.setAttribute('y', n1(core.y + core.h / 2 - h));
      el.setAttribute('height', n1(h));
      el.setAttribute('fill', finished ? th.good : th.accent);
      el.setAttribute('opacity', (now < arrive ? 0 : finished ? 1 - smooth((now - done) / 0.05) : 0.9).toFixed(3));
    };
    // The GPU: every task drops into its own core, all are worked on together, and all are done at once.
    st.gpuTasks.forEach((el, i) => {
      const [qx, qy] = P.gpuQ[i], core = P.gpuCores[i], go = P.gpuGo(i), e = easeIO(span(p, go, go + 0.07));
      const a = smooth((p - P.appear(i)) / 0.03), out = smooth((p - P.gpuDone) / 0.03);
      place(el, qx + (core.x - qx) * e, qy + (core.y - qy) * e, (0.6 + 0.4 * a) * (1 - 0.2 * e) * (1 - 0.6 * out), a * (1 - out));
    });
    st.gpuFill.forEach((el, i) => fill(el, P.gpuCores[i], P.gpuGo(i) + 0.07, P.gpuDone, p));
    // The CPU: four tasks at a time, one into each core, and the next four once those are done. It keeps going past
    // the end of the scene's animations, so it runs on time rather than on progress.
    for (let k = 0; k < 48; k++) {
      const i = P.cpuOrder[k], el = st.cpuTasks[i], [qx, qy] = P.cpuQ[i], r = Math.floor(k / 4), core = P.cpuCores[k % 4];
      const go = P.at + r * GP_ROUND + (k % 4) * 0.006, e = easeIO(span(u, go, go + 0.035)), done = P.at + r * GP_ROUND + GP_ROUND - 0.01;
      const a = smooth((p - P.appear(i)) / 0.03), out = smooth((u - done) / 0.02);
      place(el, qx + (core.x - qx) * e, qy + (core.y - qy) * e, (0.6 + 0.4 * a) * (1 + 0.6 * e) * (1 - 0.6 * out), a * (1 - out));
    }
    const r = Math.max(0, Math.floor((u - P.at) / GP_ROUND));
    st.cpuFill.forEach((el, j) => {
      const go = P.at + r * GP_ROUND + j * 0.006;
      fill(el, P.cpuCores[j], go + 0.035, P.at + r * GP_ROUND + GP_ROUND - 0.01, u < P.at ? -1 : u);
    });
  },
});

/* ---------------------------------------------------------------------------------------------------------------
 * Model training
 * ------------------------------------------------------------------------------------------------------------- */

// A loop from left to right and back: a stack of examples, the model with its dials, the comparison of its guess with
// the right answer, and the way back underneath, along which the error goes to adjust the model.
const MT = { sx: 300, cy: 450, cw: 190, ch: 140, mx: 760, mw: 380, mh: 280, px: 1060, py: 300, pw: 720, ph: 300, barX: 1100, barL: 460, barH: 56, gy: 395, ay: 520, loop: 700, gap: 6 };
// The error after each round, as a share of the right answer's bar: shorter every time.
const MT_ERR = [0.62, 0.36, 0.18, 0.08];
// The dials' pointers at the start, in degrees from straight up, and how far each turns in the first adjustment.
const MT_DIALS = [-50, 25, 105];
const MT_TURN = [40, -32, 26];

function mtPlan(p, hasName) {
  const rounds = clamp(Math.round(Number(p.rounds)) || 3, 2, 4);
  // Each round takes R of the scene; the last stops once its error is shown.
  const R = 0.76 / (rounds - 1 + 0.56), T = (k, f) => 0.1 + (k + f) * R;
  const W = (k) => MT.barL * (1 - MT_ERR[k]);
  const where = (pr) => { const v = (pr - 0.1) / R, k = clamp(Math.floor(v), 0, rounds - 1); return { k, f: v - k }; };
  const guessW = (pr) => {
    if (pr < T(0, 0.38)) return 0;
    const { k, f } = where(pr), prev = k > 0 ? W(k - 1) : 0;
    return prev + (W(k) - prev) * easeIO((f - 0.38) / 0.12);
  };
  const dialY = MT.cy + (hasName ? 34 : 0), dialX = [-115, 0, 115].map((d) => MT.mx + d);
  const dialAt = (j, pr) => MT_DIALS[j] + Array.from({ length: rounds - 1 }, (_, m) => MT_TURN[j] * Math.pow(0.62, m) * easeIO(span(pr, T(m, 0.82), T(m, 1)))).reduce((a, b) => a + b, 0);
  const cards = rounds + 1, cardAt = (i) => [MT.sx - 14 * i, MT.cy - 14 * i];
  const loop = rounded([[MT.barX + MT.barL / 2 + 90, MT.py + MT.ph], [MT.barX + MT.barL / 2 + 90, MT.loop], [MT.mx, MT.loop], [MT.mx, MT.cy + MT.mh / 2 + 4]], 30);
  return { rounds, R, T, where, guessW, dialY, dialX, dialAt, cards, cardAt, loop };
}

// An example: a card with a dot and lines on it.
const exampleCard = (th) => `<rect x="${-MT.cw / 2}" y="${-MT.ch / 2}" width="${MT.cw}" height="${MT.ch}" rx="12" fill="${th.paper}"${edgeOf(th)}/>` +
  `<circle cx="-52" cy="-18" r="21" fill="${th.accent2}"/><path d="M-14 -30H62M-14 -6H34M-70 32H62" stroke="${th.paperInk}" stroke-opacity=".35" stroke-width="10" stroke-linecap="round"/>`;

register('model_training', {
  cat: CD,
  title: 'How a model learns',
  desc: 'Training as a loop: examples go into the model, it makes a guess, the guess is compared with the right answer, the gap between them shows as an error bar, and the error goes back to adjust the model, whose dials turn. Round after round the guess comes closer and the error bar gets shorter (no numbers).',
  use: 'How machine learning and AI models are trained: guessing, measuring the error against the right answer and adjusting the weights, again and again.',
  params: 'labels: {data, model, guess, answer, error, adjust} (each optional, 1 to 3 words from the narration), rounds (2 to 4, default 3)',
  example: { labels: { data: 'Training data', model: 'Model', guess: 'Guess', answer: 'Right answer', error: 'Error', adjust: 'Adjust weights' }, rounds: 3 },
  build(p, c) {
    const { U, th } = c, id = c.id, L = labelsOf(p), P = mtPlan(p, !!say(L.model)), T = P.T;
    const mx = MT.mx, mL = mx - MT.mw / 2, mT = MT.cy - MT.mh / 2, end = MT.barX + MT.barL;
    let o = '';
    // The arrows of the loop: examples into the model, its guess out to the comparison, and the way back underneath.
    o += `<g opacity="0"${U.A('fade', 0.05, 0.05)}>` + `<path d="M${MT.sx + MT.cw / 2 + 22} ${MT.cy}H${mL - 30}" stroke="${th.muted}" stroke-width="5" stroke-linecap="round"/>${head(mL - 12, MT.cy, 0, th.muted)}` +
      `<path d="M${mx + MT.mw / 2 + 16} ${MT.cy}H${MT.px - 30}" stroke="${th.muted}" stroke-width="5" stroke-linecap="round"/>${head(MT.px - 12, MT.cy, 0, th.muted)}` +
      `<path d="${pathOf(P.loop.pts.slice(0, -1))}" fill="none" stroke="${th.muted}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>${head(mx, MT.cy + MT.mh / 2 + 8, -Math.PI / 2, th.muted)}</g>`;
    // The examples, a stack of cards; one slides into the model at the start of each round (see render).
    for (let i = P.cards - 1; i >= 0; i--) { const [x, y] = P.cardAt(i); o += `<g id="${id}card${i}" transform="translate(${x} ${y})"><g${U.A('pop', 0.02 + (P.cards - 1 - i) * 0.012, 0.05, { cx: 0, cy: 0 })}>${exampleCard(th)}</g></g>`; }
    // The model: a box with three dials, its name above them, and an edge that lights up while it works.
    o += `<g${U.A('pop', 0.03, 0.06, { cx: mx, cy: MT.cy })}><rect x="${mL}" y="${mT}" width="${MT.mw}" height="${MT.mh}" rx="${th.radius + 10}" fill="${fillOf(th)}" stroke="${lineOf(th)}" stroke-width="3"/>` +
      `<rect id="${id}glow" x="${mL}" y="${mT}" width="${MT.mw}" height="${MT.mh}" rx="${th.radius + 10}" fill="none" stroke="${th.accent}" stroke-width="7" opacity="0"/>` +
      textBlock(U, th, mx, mT + 30, L.model, { v: 'top', maxW: MT.mw - 40, sizes: [44, 40, 36, 32], halo: 0 });
    P.dialX.forEach((x, j) => {
      let ticks = '';
      for (let t = 0; t < 8; t++) { const a = (t * Math.PI) / 4; ticks += `M${n1(x + 37 * Math.sin(a))} ${n1(P.dialY - 37 * Math.cos(a))}L${n1(x + 46 * Math.sin(a))} ${n1(P.dialY - 46 * Math.cos(a))}`; }
      o += `<circle cx="${x}" cy="${P.dialY}" r="46" fill="${th.bg}" stroke="${th.ink}" stroke-width="4"/><path d="${ticks}" stroke="${th.muted}" stroke-width="3"/>` +
        `<g id="${id}dial${j}" transform="rotate(${MT_DIALS[j]} ${x} ${P.dialY})"><path d="M${x} ${P.dialY}V${P.dialY - 31}" stroke="${th.accent}" stroke-width="8" stroke-linecap="round"/></g><circle cx="${x}" cy="${P.dialY}" r="8" fill="${th.ink}"/>`;
    });
    o += '</g>';
    // The comparison: the right answer's bar from the start, the guess's bar as the guesses come, and the error, the
    // gap between them, shown in its own color. A dashed line marks where the right answer ends.
    o += `<g${U.A('fade', 0.06, 0.05)} opacity="0"><rect x="${MT.px}" y="${MT.py}" width="${MT.pw}" height="${MT.ph}" rx="${th.radius + 8}" fill="${fillOf(th)}"${edgeOf(th)}/>` +
      `<rect x="${MT.barX}" y="${MT.ay}" width="${MT.barL}" height="${MT.barH}" rx="6" fill="${th.accent2}"/>` +
      `<rect x="${MT.barX}" y="${MT.gy}" width="${MT.barL}" height="${MT.barH}" rx="6" fill="none" stroke="${th.muted}" stroke-width="2" stroke-dasharray="8 7"/>` +
      `<path d="M${end} ${MT.gy - 14}V${MT.ay + MT.barH + 14}" stroke="${th.muted}" stroke-width="3" stroke-dasharray="8 8"/></g>`;
    o += `<rect id="${id}err" x="${MT.barX}" y="${MT.gy}" width="0" height="${MT.barH}" rx="6" fill="${th.bad}" opacity="0"/>`;
    o += `<rect id="${id}guess" x="${MT.barX}" y="${MT.gy}" width="0" height="${MT.barH}" rx="6" fill="${th.ink}"/>`;
    o += textBlock(U, th, MT.barX, MT.gy - 16, L.guess, { a: 'start', v: 'bottom', maxW: 440, sizes: [38, 36, 34, 32], halo: 0, an: U.A('fade', T(0, 0.36), 0.05) });
    o += textBlock(U, th, MT.barX, MT.ay - 16, L.answer, { a: 'start', v: 'bottom', maxW: 440, sizes: [38, 36, 34, 32], halo: 0, an: U.A('fade', 0.08, 0.05) });
    o += textBlock(U, th, end + 24, MT.gy + MT.barH / 2, L.error, { a: 'start', maxW: 180, sizes: [38, 36, 34, 32], f: th.bad, halo: 0, an: U.A('fade', T(0, 0.5), 0.05) });
    // The guess going out and the error coming back, as dots.
    o += `<circle id="${id}gdot" cx="0" cy="${MT.cy}" r="12" fill="${th.ink}" opacity="0"/><circle id="${id}adot" r="13" fill="${th.bad}" opacity="0"/>`;
    o += textBlock(U, th, (MT.mx + P.loop.pts[0][0]) / 2, MT.loop + 22, L.adjust, { v: 'top', maxW: 560, sizes: [38, 36, 34, 32], an: U.A('fade', T(0, 0.58), 0.05) });
    o += textBlock(U, th, MT.sx - 14, MT.cy + MT.ch / 2 + 30, L.data, { v: 'top', maxW: 300, sizes: [38, 36, 34, 32], an: U.A('fade', 0.04, 0.05) });
    return bigger(o, 970, 480, 1.1);
  },
  init(g, p, c) {
    const P = mtPlan(p, !!say(labelsOf(p).model)), q = (s) => g.querySelector('#' + c.id + s);
    return { P, cards: Array.from({ length: P.cards }, (_, i) => q('card' + i)), glow: q('glow'), guess: q('guess'), err: q('err'), gdot: q('gdot'), adot: q('adot'), dials: [0, 1, 2].map((j) => q('dial' + j)) };
  },
  render(l, st) {
    const P = st.P, p = l.p, { k, f } = P.where(p), started = p >= 0.1;
    // In round i the front card slides from the stack into the model and is taken in.
    st.cards.forEach((el, i) => {
      const [x0, y0] = P.cardAt(i);
      if (i >= P.rounds) return;
      const t = span(p, P.T(i, 0), P.T(i, 0.16)), e = easeIO(t), x1 = MT.mx - MT.mw / 2 + 40;
      el.setAttribute('transform', `translate(${n1(x0 + (x1 - x0) * e)} ${n1(y0 + (MT.cy - y0) * e)}) scale(${(1 - 0.45 * e).toFixed(3)})`);
      el.setAttribute('opacity', (1 - smooth((t - 0.7) / 0.3)).toFixed(3));
    });
    // The model works on it, then its guess goes to the comparison and the guess bar takes its new length.
    st.glow.setAttribute('opacity', (started ? bump(f, 0.14, 0.34) : 0).toFixed(3));
    const gq = span(f, 0.28, 0.38);
    st.gdot.setAttribute('opacity', started && gq > 0 && gq < 1 ? '1' : '0');
    st.gdot.setAttribute('cx', n1(MT.mx + MT.mw / 2 + 20 + (MT.px - 20 - MT.mx - MT.mw / 2 - 20) * easeIO(gq)));
    const w = P.guessW(p);
    st.guess.setAttribute('width', n1(w));
    // The error is the gap from the guess to the right answer, set a little apart from the guess.
    const gap = w > 0 ? MT.gap : 0;
    st.err.setAttribute('x', n1(MT.barX + w + gap));
    st.err.setAttribute('width', n1(Math.max(0, MT.barL - w - gap)));
    st.err.setAttribute('opacity', smooth((p - P.T(0, 0.48)) / 0.03).toFixed(3));
    // The error goes back along the loop to the model, and its dials turn.
    const aq = span(f, 0.58, 0.8), back = started && k < P.rounds - 1 && aq > 0 && aq < 1;
    st.adot.setAttribute('opacity', back ? '1' : '0');
    if (back) { const [x, y] = pointAt(P.loop, easeIO(aq) * P.loop.len); st.adot.setAttribute('cx', n1(x)); st.adot.setAttribute('cy', n1(y)); }
    st.dials.forEach((el, j) => el.setAttribute('transform', `rotate(${P.dialAt(j, p).toFixed(2)} ${P.dialX[j]} ${P.dialY})`));
  },
});

/* ---------------------------------------------------------------------------------------------------------------
 * Internet packets
 * ------------------------------------------------------------------------------------------------------------- */

// The sender's computer on the left, the receiver's on the right, and a network of routers between them. The message
// is four parts in a square, each with its own shape; they leave as four packets by different routes and fall back into
// their places at the receiver, whatever order they arrive in.
const NET = { sx: 240, rx: 1680, my: 462, top: 374, mw: 250, mh: 176 };
const ROUTERS = { A: [590, 470], B: [795, 265], C: [795, 675], D: [960, 470], E: [1125, 265], G: [1125, 675], F: [1330, 470] };
const NET_LINKS = ['AB', 'AC', 'AD', 'BD', 'CD', 'BE', 'CG', 'DE', 'DG', 'DF', 'EF', 'GF'];
const NET_OUT = [NET.sx + NET.mw / 2, NET.my], NET_IN = [NET.rx - NET.mw / 2, NET.my];
const PK = 50, PK_AT = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => [a * 29, b * 29]);
const PK_SHAPES = ['<circle r="12"/>', '<path d="M0 -14L13 9H-13Z"/>', '<rect x="-10" y="-10" width="20" height="20"/>', '<path d="M0 -15L15 0L0 15L-15 0Z"/>'];
// The timetable, worked out so that no two packets ever meet: each packet's routers, its place in the order they leave
// in (the two nearest the way out go first), and a longer wait for the third at its second router, as at a busy one.
// The packet on the straight route arrives first, and the last to leave overtakes the one before it. The two on the
// right arrive before the two on the left, which they would otherwise pass over on the way to their places.
const PK_ROUTES = ['ABEF', 'ABDGF', 'ACDEF', 'ADF'];
const PK_LEAVE = [3, 1, 2, 0];
const PK_BUSY = { packet: 2, hop: 1, wait: 0.04 };
const PK_SPEED = 5000, PK_GAP = 0.04, PK_WAIT = 0.012;
// A hop eases a little in and out of each router, but mostly moves at an even speed, so the packets keep their spacing.
const hopEase = (u) => { const q = clamp(u, 0, 1); return 0.7 * q + 0.3 * q * q * (3 - 2 * q); };

function netPlan(p) {
  const at = moment(p.at, 0.18, 0.08, 0.24);
  const packets = PK_ROUTES.map((route, k) => {
    // The trip: from the place it split to, out of the sender, through each router, in at the receiver, along the row
    // of its place in the message and into that place.
    const [ox, oy] = PK_AT[k], from = [NET.sx + ox * 1.3, NET.my + oy * 1.3], to = [NET.rx + ox, NET.my + oy];
    const stops = [...route].map((r) => ROUTERS[r]), pts = [from, NET_OUT, ...stops, NET_IN, [NET_IN[0] + 45, to[1]], to];
    const tr = measured(pts), stopAt = [0, ...stops.map((_, i) => i + 2), pts.length - 1];
    const hops = [], keys = ['S' + route[0], ...route.slice(1).split('').map((r, i) => route[i] + r), route[route.length - 1] + 'R'];
    let t = at + 0.06 + PK_LEAVE[k] * PK_GAP;
    for (let h = 0; h < stopAt.length - 1; h++) {
      const s0 = tr.cum[stopAt[h]], s1 = tr.cum[stopAt[h + 1]], t1 = t + (s1 - s0) / PK_SPEED;
      hops.push({ t0: t, t1, s0, s1, link: keys[h] });
      t = t1 + PK_WAIT + (PK_BUSY.packet === k && PK_BUSY.hop === h ? PK_BUSY.wait : 0);
    }
    const dist = (pr) => {
      for (const h of hops) { if (pr <= h.t0) return h.s0; if (pr < h.t1) return h.s0 + (h.s1 - h.s0) * hopEase((pr - h.t0) / (h.t1 - h.t0)); }
      return tr.len;
    };
    return { tr, hops, dist, arrive: hops[hops.length - 1].t1 };
  });
  return { at, packets, whole: Math.max(...packets.map((pk) => pk.arrive)) };
}

// A computer: a monitor on a stand, its screen in the ground color.
const computer = (th, cx) => `<path d="M${cx - 24} ${NET.top + NET.mh - 2}L${cx + 24} ${NET.top + NET.mh - 2}L${cx + 36} ${NET.top + NET.mh + 40}H${cx - 36}Z" fill="${th.muted}"/>` +
  `<rect x="${cx - 78}" y="${NET.top + NET.mh + 38}" width="156" height="14" rx="7" fill="${th.muted}"/>` +
  `<rect x="${cx - NET.mw / 2}" y="${NET.top}" width="${NET.mw}" height="${NET.mh}" rx="14" fill="${fillOf(th)}" stroke="${lineOf(th)}" stroke-width="3"/>` +
  `<rect x="${cx - NET.mw / 2 + 14}" y="${NET.top + 14}" width="${NET.mw - 28}" height="${NET.mh - 28}" rx="6" fill="${th.bg}"/>`;
// A router: a disc with four arrowheads pointing out, for the ways it can send a packet on.
const router = (th, [x, y]) => `<circle cx="${x}" cy="${y}" r="34" fill="${fillOf(th)}" stroke="${lineOf(th)}" stroke-width="3"/>` +
  [0, 1, 2, 3].map((k) => { const a = (k * Math.PI) / 2, c = Math.cos(a), s = Math.sin(a); return `<path d="M${n1(x + 23 * c)} ${n1(y + 23 * s)}L${n1(x + 11 * c - 8 * s)} ${n1(y + 11 * s + 8 * c)}L${n1(x + 11 * c + 8 * s)} ${n1(y + 11 * s - 8 * c)}Z" fill="${th.muted}"/>`; }).join('');

register('internet_packets', {
  cat: CD,
  title: 'How data travels the internet',
  desc: 'A message on one computer splits into four packets, small squares told apart by the shape each carries and by its place in the message. They travel through a network of routers by different routes, arrive in a different order, and fall back into their places at the other computer, where the message is whole again.',
  use: 'How the internet sends data: packets, routers, different routes through the network, and putting the message back together at the other end.',
  params: 'labels: {sender, receiver, packets, routers, message} (each optional, 1 to 3 words from the narration), at (when the message splits into packets, 0 to 1)',
  example: { labels: { sender: 'Sender', receiver: 'Receiver', packets: 'Packets', routers: 'Routers', message: 'Message' } },
  build(p, c) {
    const { U, th } = c, id = c.id, L = labelsOf(p), P = netPlan(p), at = P.at;
    const links = [['SA', NET_OUT, ROUTERS.A], ...NET_LINKS.map((k) => [k, ROUTERS[k[0]], ROUTERS[k[1]]]), ['FR', ROUTERS.F, NET_IN]];
    let o = `<g opacity="0"${U.A('fade', 0.04, 0.06)}>` + links.map(([, a, b]) => `<path d="M${a[0]} ${a[1]}L${b[0]} ${b[1]}" stroke="${th.muted}" stroke-opacity=".5" stroke-width="4" stroke-linecap="round"/>`).join('') + '</g>';
    o += links.map(([k, a, b]) => `<path id="${id}l${k}" d="M${a[0]} ${a[1]}L${b[0]} ${b[1]}" stroke="${th.accent}" stroke-width="6" stroke-linecap="round" opacity="0"/>`).join('');
    Object.entries(ROUTERS).forEach(([k, xy], i) => {
      o += `<g${U.A('pop', 0.04 + i * 0.01, 0.05, { cx: xy[0], cy: xy[1] })}>${router(th, xy)}<circle id="${id}r${k}" cx="${xy[0]}" cy="${xy[1]}" r="34" fill="none" stroke="${th.accent}" stroke-width="7" opacity="0"/></g>`;
    });
    o += `<g${U.A('pop', 0, 0.06, { cx: NET.sx, cy: NET.my })}>${computer(th, NET.sx)}</g><g${U.A('pop', 0.02, 0.06, { cx: NET.rx, cy: NET.my })}>${computer(th, NET.rx)}</g>`;
    // The message as a card behind its four parts: it goes when the parts split, and comes back at the receiver once
    // they are all in place. Until then the receiver shows where each part goes.
    const cardAt = (x) => `<rect x="${x - 66}" y="${NET.my - 66}" width="132" height="132" rx="12" fill="${th.paper}"${edgeOf(th)}/>`;
    o += `<g opacity="0"${U.A('fade', 0.08, 0.04)}><g${U.A('dim', at, 0.03, { to: 0 })}>${cardAt(NET.sx)}</g></g>`;
    o += `<g opacity="0"${U.A('fade', 0.1, 0.05)}><g${U.A('dim', P.whole, 0.03, { to: 0 })}>` + PK_AT.map(([ox, oy]) => `<rect x="${NET.rx + ox - PK / 2}" y="${NET.my + oy - PK / 2}" width="${PK}" height="${PK}" rx="7" fill="none" stroke="${th.muted}" stroke-width="3" stroke-dasharray="9 7"/>`).join('') + '</g></g>';
    o += `<g opacity="0"${U.A('fade', P.whole, 0.03)}>${cardAt(NET.rx)}</g>`;
    // The packets, placed every frame by render.
    PK_SHAPES.forEach((shape, k) => { o += `<g id="${id}pk${k}" opacity="0"><rect x="${-PK / 2}" y="${-PK / 2}" width="${PK}" height="${PK}" rx="7" fill="${th.accent}" stroke="${th.bg}" stroke-width="4"/><g fill="${th.bg}">${shape}</g></g>`; });
    // The whole message again, with a ring round it.
    o += `<g${U.A('pop', P.whole + 0.01, 0.05, { cx: NET.rx, cy: NET.my })}><rect x="${NET.rx - 80}" y="${NET.my - 80}" width="160" height="160" rx="18" fill="none" stroke="${th.good}" stroke-width="6"/></g>`;
    o += textBlock(U, th, NET.sx, NET.top - 20, L.message, { v: 'bottom', maxW: 300, an: U.A('fade', 0.08, 0.05) });
    o += textBlock(U, th, NET.sx, NET.top + NET.mh + 74, L.sender, { v: 'top', maxW: 300, an: U.A('fade', 0.04, 0.05) });
    o += textBlock(U, th, NET.rx, NET.top + NET.mh + 74, L.receiver, { v: 'top', maxW: 300, an: U.A('fade', 0.06, 0.05) });
    o += textBlock(U, th, (NET_OUT[0] + ROUTERS.A[0] - 34) / 2, NET.my - 40, L.packets, { v: 'bottom', maxW: 210, an: U.A('fade', at + 0.04, 0.05) });
    o += textBlock(U, th, ROUTERS.B[0], ROUTERS.B[1] - 50, L.routers, { v: 'bottom', maxW: 320, an: U.A('fade', 0.12, 0.05) });
    return o;
  },
  init(g, p, c) {
    const P = netPlan(p), q = (s) => g.querySelector('#' + c.id + s);
    const links = {}, routers = {};
    ['SA', ...NET_LINKS, 'FR'].forEach((k) => { links[k] = q('l' + k); });
    Object.keys(ROUTERS).forEach((k) => { routers[k] = q('r' + k); });
    return { P, links, routers, packets: PK_SHAPES.map((_, k) => q('pk' + k)) };
  },
  render(l, st) {
    const P = st.P, p = l.p, lit = {}, glow = {};
    P.packets.forEach((pk, k) => {
      // Until it leaves, a packet sits in the message, which splits apart at `at`.
      let x, y;
      if (p <= pk.hops[0].t0) {
        const sp = 1 + 0.3 * easeIO(span(p, P.at, P.at + 0.04));
        x = NET.sx + PK_AT[k][0] * sp;
        y = NET.my + PK_AT[k][1] * sp;
      } else [x, y] = pointAt(pk.tr, pk.dist(p));
      const a = smooth((p - 0.08) / 0.04);
      st.packets[k].setAttribute('transform', `translate(${n1(x)} ${n1(y)}) scale(${(0.4 + 0.6 * a).toFixed(3)})`);
      st.packets[k].setAttribute('opacity', a > 0 ? '1' : '0');
      // The link it is on lights up, and each router flashes as the packet waits in it.
      pk.hops.forEach((h, i) => {
        lit[h.link] = Math.max(lit[h.link] || 0, 0.85 * during(p, h.t0 + 0.01, h.t1, 0.015));
        const next = pk.hops[i + 1];
        if (next) glow[h.link[1]] = Math.max(glow[h.link[1]] || 0, during(p, h.t1 - 0.005, next.t0 + 0.01, 0.015));
      });
    });
    Object.entries(st.links).forEach(([k, el]) => el?.setAttribute('opacity', (lit[k] || 0).toFixed(3)));
    Object.entries(st.routers).forEach(([k, el]) => el?.setAttribute('opacity', (glow[k] || 0).toFixed(3)));
  },
});
