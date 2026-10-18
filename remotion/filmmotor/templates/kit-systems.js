// Kit templates for systems, drawn for Meko in the film engine's style (see ../engine.js for how templates work):
// what a process takes in and gives out, and the forces on a thing. The director only says what is in the picture
// (the things, their names, their icons and which way the forces point); the code decides where everything goes, how
// big it is, where each name sits and how it moves, so the picture is tidy for any topic. Every visible word comes
// from the params, a part without a label is drawn without one, and the drawings hold no numbers or facts of their own.
import { register, ICONS } from "../engine.js";

const CAT = 'Kit';

// Water keeps its natural color in every look, chosen to read on the dark grounds and on the light page alike.
const WATER = '#3E8EDE'; // the body of water, laid thinly over what is under the surface
const WATER_LINE = '#5AA6EE'; // the water's surface

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const smooth = (x) => { const q = clamp(x, 0, 1); return q * q * (3 - 2 * q); };
const n1 = (v) => (+v).toFixed(1);
// A text from the params: a non-empty string (or a number), otherwise ''.
const say = (v) => (typeof v === 'string' ? v.trim() : typeof v === 'number' && Number.isFinite(v) ? String(v) : '');
// A moment given in the params as a fraction of the scene (TemplateScene turns a spoken word into one), kept in range.
const moment = (v, fallback, lo, hi) => (typeof v === 'number' && Number.isFinite(v) ? clamp(v, lo, hi) : fallback);

// A polyline's length up to each point, and the point and heading at a length along it.
const lengths = (P) => P.reduce((L, q, i) => (L.push(i ? L[i - 1] + Math.hypot(q[0] - P[i - 1][0], q[1] - P[i - 1][1]) : 0), L), []);
function along(P, L, s) {
  const d = clamp(s, 0, L[L.length - 1]);
  let lo = 1, hi = L.length - 1;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (L[mid] < d) lo = mid + 1; else hi = mid; }
  const a = P[lo - 1], b = P[lo], k = (d - L[lo - 1]) / (L[lo] - L[lo - 1] || 1);
  return { x: a[0] + (b[0] - a[0]) * k, y: a[1] + (b[1] - a[1]) * k, a: Math.atan2(b[1] - a[1], b[0] - a[0]) };
}
const pathD = (P) => (P.length ? 'M' + P.map((q) => n1(q[0]) + ' ' + n1(q[1])).join('L') : '');
// A cubic curve from a over b and c to d, as n + 1 points.
const cubic = (a, b, c, d, n) => Array.from({ length: n + 1 }, (_, i) => {
  const t = i / n, u = 1 - t, k = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
  return [k[0] * a[0] + k[1] * b[0] + k[2] * c[0] + k[3] * d[0], k[0] * a[1] + k[1] * b[1] + k[2] * c[1] + k[3] * d[1]];
});
// The start of a polyline, up to the length s.
const upTo = (P, L, s) => { const out = P.filter((_, i) => L[i] < s), e = along(P, L, s); out.push([e.x, e.y]); return out; };

/* ---------------------------------------------------------------------------------------------------------------
 * Labels: fitted to a width, set in a block, and kept apart from each other
 * ------------------------------------------------------------------------------------------------------------- */

const LH = 1.14; // line height, as a share of the size

// A label's lines at size s within maxW: one line, or two split where they come out most even, or (when maxLines is
// 3) up to three lines filled in turn, the last taking all the words left. Null when it does not fit.
function splitLabel(U, text, s, maxW, maxLines, fam) {
  const words = String(text).split(/\s+/).filter(Boolean), width = (t) => U.tw(t, s, { w: 700, fam });
  if (!words.length) return [];
  if (width(words.join(' ')) <= maxW) return [words.join(' ')];
  let best = null;
  for (let i = 1; i < words.length; i++) {
    const lines = [words.slice(0, i).join(' '), words.slice(i).join(' ')], w = Math.max(width(lines[0]), width(lines[1]));
    if (w <= maxW && (!best || w < best.w)) best = { w, lines };
  }
  if (best) return best.lines;
  if (maxLines < 3) return null;
  const out = [];
  let cur = '';
  for (const w of words) { const next = cur ? cur + ' ' + w : w; if (cur && width(next) > maxW) { out.push(cur); cur = w; } else cur = next; }
  if (cur) out.push(cur);
  return out.length > 3 ? [out[0], out[1], out.slice(2).join(' ')] : out;
}

// One size for a group of labels, so they match: the biggest of `sizes` at which every label fits in one or two
// lines. At the smallest size a label may take three lines, so no word is lost.
function fitGroup(U, texts, maxW, sizes, fam) {
  for (const s of sizes) {
    const all = texts.map((t) => splitLabel(U, U.lab(t), s, maxW, 2, fam));
    if (all.every(Boolean)) return all.map((lines) => ({ s, lines, fam }));
  }
  const s = sizes[sizes.length - 1];
  return texts.map((t) => ({ s, lines: splitLabel(U, U.lab(t), s, maxW, 3, fam), fam }));
}

// Where a fitted label's lines go: anchored at x like U.T ('start', 'middle' or 'end'), and lined up on y by mode:
// 'mid' centers the block on y, 'first' centers its first line on y with the rest below, 'last' its last line with
// the rest above. Comes with the box the letters take.
function blockAt(U, fit, x, y, a, mode) {
  const lh = fit.s * LH, n = fit.lines.length, c0 = mode === 'first' ? y : mode === 'last' ? y - (n - 1) * lh : y - ((n - 1) * lh) / 2;
  const w = Math.max(0, ...fit.lines.map((l) => U.tw(l, fit.s, { w: 700, fam: fit.fam })));
  const x0 = a === 'start' ? x : a === 'end' ? x - w : x - w / 2;
  return { fit, x, a, c0, lh, box: { x0, x1: x0 + w, y0: c0 - fit.s * 0.42, y1: c0 + (n - 1) * lh + fit.s * 0.46 } };
}
const blockSvg = (U, th, b, o = {}) =>
  b.fit.lines.map((l, i) => U.T(n1(b.x), n1(b.c0 + i * b.lh + b.fit.s * 0.35), l, { a: b.a, s: b.fit.s, w: 700, fam: b.fit.fam, f: o.f || th.ink, halo: o.halo ?? 8 })).join('');

const overlaps = (a, b, m = 0) => a.x0 < b.x1 + m && b.x0 < a.x1 + m && a.y0 < b.y1 + m && b.y0 < a.y1 + m;
const area = (a, b) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
const join = (a, b) => (!a ? b : !b ? a : { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) });
// The first place among `cands` (label blocks) that keeps clear of every box in `taken`, or else the one that
// overlaps them least.
function firstFree(cands, taken, m) {
  let best = null, bestCost = Infinity;
  for (const b of cands) {
    const cost = taken.reduce((sum, t) => sum + (overlaps(b.box, t, m) ? 1 + area(b.box, t) : 0), 0);
    if (cost === 0) return b;
    if (cost < bestCost) { best = b; bestCost = cost; }
  }
  return best;
}

// Whether an icon name can be drawn: one of Meko's icons (lib/icons.ts) or one of the engine's own.
const known = (th, name) => name !== '' && (th.iconMarkup?.(name, '#000', 100) !== undefined || Object.hasOwn(ICONS, name));
// A color part of the way from `into` to `col` (both #RRGGBB), like a thin wash of it.
function mix(col, into, t) {
  const hex = (v) => { const m = /^#([0-9a-f]{6})$/i.exec(String(v).trim()); return m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) : null; };
  const a = hex(col), b = hex(into);
  return a && b ? '#' + a.map((v, i) => Math.round(b[i] + (v - b[i]) * t).toString(16).padStart(2, '0')).join('') : col;
}
// An icon, or a plain ball where there is none, drawn the look's way: flat in Night atlas, an outline in the icon's
// color in Blueprint, ink over a pale wash of the color in Field guide.
function iconOr(U, th, name, x, y, size, col) {
  if (known(th, name)) return U.icon(name, x, y, size, col);
  const r = n1(size * 0.3), at = `cx="${n1(x)}" cy="${n1(y)}" r="${r}"`;
  if (!th.card) return `<circle ${at} fill="${col}"/>`;
  const chalk = th.card.fill === th.bg;
  return `<circle ${at} fill="${chalk ? th.bg : mix(col, th.bg, 0.25)}" stroke="${chalk ? col : th.ink}" stroke-width="${n1(Math.max(3, size * 0.035))}"/>`;
}

// The look's panel fill and edge, for shapes drawn like its cards: flat panels in Night atlas, chalk-edged boxes in
// Blueprint and ink-edged tags in Field guide.
const panel = (th) => (th.card ? th.card.fill : th.surface);
const disc = (th, x, y, r, o = {}) => `<circle cx="${n1(x)}" cy="${n1(y)}" r="${n1(r)}" fill="${o.f || panel(th)}"` +
  (o.s ? ` stroke="${o.s}" stroke-width="${o.sw || 4}"` : th.card ? ` stroke="${th.card.stroke}" stroke-width="${th.card.width}"` : '') + '/>';

/* ---------------------------------------------------------------------------------------------------------------
 * input_output: a process in the middle with what goes in on the left and what comes out on the right. Things
 * flow along pipes into the process; it starts to work (it lights up, its ring turns), and the outputs come out.
 * ------------------------------------------------------------------------------------------------------------- */

// The process's middle and the radius of its disc and of its dashed ring; where the pipes end at it (tip); how far
// the inputs and outputs stand from the middle and how much the outer ones bend in toward it; the width of the pipes
// and their arrowheads, and the room for a label beside its thing. An input or output is bigger when there are fewer.
const IO = { X: 960, Y: 485, R: 156, dash: 182, tip: 204, dx: 520, bend: 46, pipe: 18, head: 32, LW: 300 };
const IO_ITEM = { 1: [72, 100], 2: [72, 100], 3: [68, 94], 4: [64, 88] }; // radius and icon size, by the most on a side
const IO_SIZES = [38, 35, 32, 30];

// The inputs or outputs from the params: at most four, each with an icon and a label (a bare string is a label).
const ioItems = (list) => (Array.isArray(list) ? list : []).slice(0, 4).map((it) => (typeof it === 'string' ? { icon: '', label: it.trim() } : { icon: say(it?.icon), label: say(it?.label) }));

// Where everything goes and when it comes in. Inputs stand on the left, outputs on the right, spread evenly from top
// to bottom with the outer ones bent in toward the process, and each has a pipe that curves into the process (or out
// of it) at its own point on the ring, so pipes never cross.
function ioPlan(p) {
  const W = moment(p.at, 0.5, 0.3, 0.65), ins = ioItems(p.inputs), outs = ioItems(p.outputs);
  const [r, icon] = IO_ITEM[Math.max(1, ins.length, outs.length)];
  const side = (items, s) => {
    const n = items.length, pitch = n <= 1 ? 0 : Math.min(230, 520 / (n - 1)), spread = n <= 1 ? 0 : Math.min(0.42, 1.25 / (n - 1));
    return items.map((it, k) => {
      const y = IO.Y + (k - (n - 1) / 2) * pitch, x = IO.X + s * (IO.dx - IO.bend * Math.pow((y - IO.Y) / 260, 2));
      const a = (k - (n - 1) / 2) * spread, u = [s * Math.cos(a), Math.sin(a)], e = [IO.X + IO.tip * u[0], IO.Y + IO.tip * u[1]];
      const edge = [x - s * (r + 14), y], from = s < 0 ? edge : e, to = s < 0 ? e : edge, reach = Math.hypot(to[0] - from[0], to[1] - from[1]) / 2.6;
      const c1 = s < 0 ? [from[0] + reach, from[1]] : [e[0] + u[0] * reach, e[1] + u[1] * reach];
      const c2 = s < 0 ? [e[0] + u[0] * reach, e[1] + u[1] * reach] : [to[0] - reach, to[1]];
      const pts = cubic(from, c1, c2, to, 40);
      return { ...it, x, y, s, pts, L: lengths(pts) };
    });
  };
  const inputs = side(ins, -1), outputs = side(outs, 1);
  // The inputs come in one after another before the process works, the outputs one after another after it.
  const inStep = inputs.length > 1 ? Math.min(0.1, (W - 0.2) / (inputs.length - 1)) : 0;
  inputs.forEach((it, k) => { it.at = 0.08 + k * inStep; it.flow = it.at + 0.11; });
  const o0 = W + 0.05, outStep = outputs.length > 1 ? Math.min(0.1, (0.84 - o0) / (outputs.length - 1)) : 0;
  outputs.forEach((it, k) => { it.at = o0 + k * outStep; it.flow = it.at + 0.04; });
  return { W, r, icon, inputs, outputs };
}

// A pipe along the points P, drawn from its start at `at` over `dur`: a flat band in Night atlas, a hollow tube with
// the look's edge in Blueprint and Field guide. It stops short of the arrowhead at its end.
function ioPipe(U, th, it, at, dur) {
  const P = upTo(it.pts, it.L, it.L[it.L.length - 1] - IO.head + 8), d = pathD(P), w = IO.pipe;
  const strokes = th.card ? [[th.card.stroke, w + 2 * th.card.width + 1], [th.card.fill, w]] : [[th.line, w]];
  return `<g opacity="0"${U.A('fade', at, 0.004)}>` + strokes.map(([col, sw]) =>
    `<path d="${d}" pathLength="1000" fill="none" stroke="${col}" stroke-width="${n1(sw)}" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="1000 1010" stroke-dashoffset="1000"${U.A('draw', at, dur, { l: 1000 })}/>`).join('') + '</g>';
}
// The arrowhead at a pipe's end, pointing the way things flow.
function ioHead(U, th, it, at) {
  const L = it.L, end = L[L.length - 1], tip = along(it.pts, L, end), back = along(it.pts, L, end - IO.head), a = Math.atan2(tip.y - back.y, tip.x - back.x);
  const nx = -Math.sin(a) * 21, ny = Math.cos(a) * 21, d = `M${n1(tip.x)} ${n1(tip.y)}L${n1(back.x + nx)} ${n1(back.y + ny)}L${n1(back.x - nx)} ${n1(back.y - ny)}Z`;
  const paint = th.card ? `fill="${th.card.fill}" stroke="${th.card.stroke}" stroke-width="${th.card.width + 0.5}"` : `fill="${th.line}"`;
  return `<path d="${d}" ${paint} stroke-linejoin="round" opacity="0"${U.A('fade', at, 0.02)}/>`;
}
// The dashes of a ring of radius r, n of them, so they meet evenly all the way round.
const dashes = (r, n) => { const k = (2 * Math.PI * r) / n; return `${n1(k * 0.6)} ${n1(k * 0.4)}`; };

register('input_output', {
  cat: CAT, title: 'Input and output',
  desc: 'A process in the middle, with what goes into it on the left and what comes out on the right, each a named icon joined to it by a pipe. The inputs come in one by one and flow along their pipes into the process; it starts to work (it lights up, its ring turns), and the outputs come out one by one. The flows keep moving to the end.',
  use: 'Anything that takes things in and gives things out: a leaf (sunlight, water and carbon dioxide in, sugar and oxygen out), a power plant, the stomach, a factory, a cell, a computer, an animal.',
  params: 'process: {icon, label} (the thing in the middle; without an icon its label goes inside it), inputs: [{icon, label}] (1 to 4, what goes in, from the left, in the order they come in), outputs: [{icon, label}] (1 to 4, what comes out, to the right, in the order they come out), each label 1 to 4 words from the narration; at (when the process starts working and the outputs come out: a fraction of the scene or a narration word, kept between 0.3 and 0.65, default 0.5)',
  example: {
    process: { icon: 'leaf', label: 'Leaf' },
    inputs: [{ icon: 'sun', label: 'Sunlight' }, { icon: 'drop', label: 'Water' }, { icon: 'cloud', label: 'Carbon dioxide' }],
    outputs: [{ icon: 'gem', label: 'Sugar' }, { icon: 'wind', label: 'Oxygen' }],
  },
  build(p, c) {
    const { U, th } = c, id = c.id, { X, Y, R } = IO, plan = ioPlan(p), { W, inputs, outputs } = plan, all = [...inputs, ...outputs];
    const proc = p.process && typeof p.process === 'object' ? p.process : {}, icon = say(proc.icon), name = say(proc.label);
    const colOf = (it) => (it.s < 0 ? th.ink : th.accent2);
    let o = '';
    // The pipes, their arrowheads and the dots that flow along them (moved by render).
    all.forEach((it, k) => {
      const draw = it.s < 0 ? it.at + 0.04 : it.at, dur = 0.07;
      o += ioPipe(U, th, it, draw, dur) + ioHead(U, th, it, draw + dur - 0.01);
      const n = Math.max(2, Math.round(it.L[it.L.length - 1] / 64));
      for (let j = 0; j < n; j++) o += `<circle id="${id}d${k}_${j}" r="${th.card ? 6 : 7}" fill="${colOf(it)}" opacity="0"/>`;
    });
    // The process: its dashed ring, its disc and its icon, quiet at first. When it works it lights up in the
    // highlight, a pulse runs out from it, and the ring turns (render).
    const ring = (col, w) => `<circle cx="${X}" cy="${Y}" r="${IO.dash}" fill="none" stroke="${col}" stroke-width="${w}" stroke-dasharray="${dashes(IO.dash, 30)}"/>`;
    const inside = icon ? '' : name;
    let core = disc(th, X, Y, R, { s: th.card ? th.card.stroke : th.line, sw: 5 }) +
      `<circle cx="${X}" cy="${Y}" r="${R}" fill="none" stroke="${th.accent}" stroke-width="8" opacity="0"${U.A('fade', W, 0.04)}/>`;
    if (icon) core += `<g${U.A('dim', W, 0.03, { to: 0 })}>${iconOr(U, th, icon, X, Y, R * 1.3, th.ink)}</g><g opacity="0"${U.A('fade', W, 0.03)}>${iconOr(U, th, icon, X, Y, R * 1.3, th.accent)}</g>`;
    else if (inside) core += blockSvg(U, th, blockAt(U, fitGroup(U, [inside], 2 * R - 44, [44, 40, 36, 32, 30], 'd')[0], X, Y, 'middle', 'mid'), { halo: 0 });
    // (The pulse is not measured as content: it stays inside the picture, and the picture's place should not depend
    // on whether TemplateScene happens to measure it mid-pulse.)
    o += `<circle id="${id}pulse" cx="${X}" cy="${Y}" r="${IO.dash}" fill="none" stroke="${th.accent}" stroke-width="5" opacity="0" data-fm-bg="1"/>`;
    o += `<g${U.A('pop', 0.02, 0.07, { cx: X, cy: Y })}><g id="${id}thump"><g${U.A('dim', W, 0.04, { to: 0 })}>${ring(th.line, 4)}</g>` +
      `<g id="${id}spin" opacity="0"${U.A('fade', W, 0.04)}>${ring(th.accent, 5)}</g>${core}</g></g>`;
    // Its name under it.
    if (icon && name) o += `<g${U.A('up', 0.07, 0.06)}>${blockSvg(U, th, blockAt(U, fitGroup(U, [name], 480, [50, 46, 42, 38], 'd')[0], X, Y + IO.dash + 30 + 21, 'middle', 'first'))}</g>`;
    // The inputs and outputs, each popping in as it comes, with its name on its outer side.
    const fits = fitGroup(U, all.map((it) => it.label), IO.LW, IO_SIZES);
    all.forEach((it, k) => {
      const pop = it.s < 0 ? it.at : it.at + 0.06;
      o += `<g${U.A('pop', pop, 0.05, { cx: n1(it.x), cy: n1(it.y) })}>${disc(th, it.x, it.y, plan.r)}${iconOr(U, th, it.icon, it.x, it.y, plan.icon, colOf(it))}</g>`;
      if (fits[k].lines.length) o += `<g${U.A('up', pop + 0.03, 0.05)}>${blockSvg(U, th, blockAt(U, fits[k], it.x + it.s * (plan.r + 22), it.y, it.s < 0 ? 'end' : 'start', 'mid'))}</g>`;
    });
    return o;
  },
  init(g, p, c) {
    const plan = ioPlan(p), q = (s) => g.querySelector('#' + c.id + s);
    const tracks = [...plan.inputs, ...plan.outputs].map((it, k) => {
      const dots = [];
      for (let j = 0, el; (el = q(`d${k}_${j}`)); j++) dots.push(el);
      return { it, dots, len: it.L[it.L.length - 1] - IO.head - 4 };
    });
    return { W: plan.W, tracks, thump: q('thump'), spin: q('spin'), pulse: q('pulse') };
  },
  render(l, st) {
    const { t, p, dur } = l, tw = st.W * dur, speed = 120, gap = 64;
    // The ring turns once the process works: it speeds up over a second, then keeps a slow, steady turn.
    const run = Math.max(0, t - tw), deg = run < 1 ? (36 * run * run) / 2 : 36 * (run - 0.5);
    st.spin?.setAttribute('transform', `rotate(${deg.toFixed(2)} ${IO.X} ${IO.Y})`);
    // A beat as it starts, and a pulse running out from it.
    const q = (p - st.W) / 0.07, s = q > 0 && q < 1 ? 1 + 0.07 * Math.sin(Math.PI * q) : 1;
    st.thump?.setAttribute('transform', `translate(${IO.X} ${IO.Y}) scale(${s.toFixed(4)}) translate(${-IO.X} ${-IO.Y})`);
    const pq = (p - st.W) / 0.1;
    st.pulse?.setAttribute('r', n1(IO.dash + 70 * Math.sqrt(clamp(pq, 0, 1))));
    st.pulse?.setAttribute('opacity', pq > 0 && pq < 1 ? (0.85 * (1 - pq)).toFixed(3) : '0');
    // The dots flow along their pipes at an even speed, from the moment the pipe is drawn, fading in at the start and
    // out at the end; behind the first dot the pipe stays full.
    st.tracks.forEach(({ it, dots, len }) => {
      const front = (t - it.flow * dur) * speed, cycle = dots.length * gap;
      dots.forEach((el, j) => {
        const sPos = (((t * speed + j * gap) % cycle) + cycle) % cycle, show = front > 0 && sPos <= front && sPos <= len;
        el.setAttribute('opacity', show ? Math.min(1, sPos / 24, (len - sPos) / 26).toFixed(3) : '0');
        if (show) { const pt = along(it.pts, it.L, sPos); el.setAttribute('cx', n1(pt.x)); el.setAttribute('cy', n1(pt.y)); }
      });
    });
  },
});

/* ---------------------------------------------------------------------------------------------------------------
 * forces: the forces on a thing, as bold arrows that grow out from its edges, in a quiet setting. At the end the
 * thing can move the way the forces push it.
 * ------------------------------------------------------------------------------------------------------------- */

// At zoom 1: the thing's size (its longer side) and a medium arrow's length. Then the gap between the thing and its
// arrows, an arrow's width, how far the thing drifts when it moves (less up or down, since the frame is wide and
// low), and how far the clouds stream past in the air. The picture is drawn at the biggest zoom that fits the frame.
const FO = { size: 210, unit: 150, gap: 14, w: 24, drift: 110, driftUp: 80, stream: 520 };
const ZOOMS = [1.35, 1.25, 1.15, 1.05, 1, 0.92, 0.85, 0.78, 0.72];
const STRENGTH = { small: 0.6, medium: 1, large: 1.45 };
const DIR = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const SETTINGS = ['air', 'water', 'ground', 'space', 'none'];
const FO_SIZES = [38, 35, 32, 30];

// Icons that face a way, in degrees clockwise from facing right (most animals are drawn facing left). The thing is
// mirrored to face the way it moves, and a plane is always turned to fly level, facing right unless it moves left.
const HEADING = {
  plane: -45, ship: 0, train: 0, tank: 0, cannon: 0, cart: 0, bee: 0,
  fish: 180, horse: 180, camel: 180, dove: 180, cow: 180, sheep: 180, pig: 180, dog: 180, cat: 180, fox: 180, wolf: 180,
  bear: 180, rabbit: 180, deer: 180, elephant: 180, lion: 180, dinosaur: 180, whale: 180, shark: 180, turtle: 180,
  snake: 180, penguin: 180, chicken: 180, mouse: 180, ant: 180, mosquito: 180,
};
// Where a floating thing's waterline is on its grid; others float with the water through their middle.
const WATERLINE = { ship: 70 };

// The part of its 100 x 100 grid an icon fills as it is drawn here (turned and mirrored), so arrows start at the
// thing's real edges whatever the icon. It is measured once per icon in the browser, along the outlines of its shapes;
// where it cannot be measured (no browser) the icon is taken to fill about 8 to 92 both ways. A plain ball fills 20 to 80.
const iconBoxes = new Map();
function iconBox(th, name, turn, mirror) {
  if (!name) return [20, 20, 80, 80];
  const key = `${name}|${turn}|${mirror}`;
  if (iconBoxes.has(key)) return iconBoxes.get(key);
  let box = [8, 8, 92, 92];
  try {
    const markup = th.iconMarkup?.(name, '#000', 100) ?? ICONS[name];
    if (typeof document !== 'undefined' && document.body && markup) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('style', 'position:absolute;left:-4000px;top:0;width:100px;height:100px;visibility:hidden');
      svg.innerHTML = `<g transform="translate(50 50) rotate(${turn}) scale(${mirror ? -1 : 1} 1) translate(-50 -50)">${markup}</g>`;
      document.body.appendChild(svg);
      const root = svg.firstElementChild, base = svg.getCTM?.()?.inverse();
      const b = [Infinity, Infinity, -Infinity, -Infinity];
      for (const el of root.querySelectorAll('path, rect, circle, ellipse, line, polyline, polygon')) {
        const len = el.getTotalLength?.(), ctm = el.getCTM?.();
        if (!len || !ctm || !base) continue;
        const m = base.multiply(ctm);
        for (let i = 0; i <= 64; i++) {
          const q = el.getPointAtLength((len * i) / 64), x = m.a * q.x + m.c * q.y + m.e, y = m.b * q.x + m.d * q.y + m.f;
          b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y);
        }
      }
      svg.remove();
      if (b[2] - b[0] > 1 && b[3] - b[1] > 1) box = b;
    }
  } catch {
    // keep the usual box
  }
  iconBoxes.set(key, box);
  return box;
}

// The thing: its icon ('' draws a plain ball), how it is turned and mirrored, and the part of its grid it fills.
function foObject(th, p, moves) {
  const obj = p.object && typeof p.object === 'object' ? p.object : {}, raw = say(obj.icon), icon = known(th, raw) ? raw : '';
  const h = HEADING[icon], mirror = h !== undefined && ((moves === 'left' && h !== 180) || (moves === 'right' && h === 180));
  // A mirrored plane faces up and to the left, so it turns the other way to fly level.
  const turn = h === -45 ? (mirror ? -45 : 45) : 0, box = iconBox(th, icon, turn, mirror);
  return { icon, label: say(obj.label), turn, mirror, box, waterline: WATERLINE[icon] ?? (box[1] + box[3]) / 2 };
}

// Everything the picture needs: the setting, the motion, the thing, the arrows with their labels (each placed clear of
// the others), when each part comes in, and the zoom it is drawn at.
function foPlan(p, c) {
  const { U, th } = c;
  const setting = SETTINGS.includes(p.setting) ? p.setting : 'none';
  let moves = Object.hasOwn(DIR, p.moves) ? p.moves : null;
  if (setting === 'ground' && moves === 'down') moves = null; // a thing on the ground cannot sink into it
  const [mx, my] = moves ? DIR[moves] : [0, 0];
  const forces = (Array.isArray(p.forces) ? p.forces : []).slice(0, 4)
    .map((f, k) => ({ k, dir: f && Object.hasOwn(DIR, f.direction) ? f.direction : null, label: say(f?.label), mult: STRENGTH[f?.strength] ?? 1 }))
    .filter((f) => f.dir);
  // Each arrow grows as the narration names its force (p.times, one per force in the params), or one after another.
  const n = forces.length;
  forces.forEach((f, i) => {
    const t = Array.isArray(p.times) ? p.times[f.k] : undefined;
    f.at = typeof t === 'number' && Number.isFinite(t) ? clamp(t, 0.06, 0.92) : 0.14 + i * (n > 1 ? 0.46 / (n - 1) : 0);
  });
  const last = n ? Math.max(...forces.map((f) => f.at)) : 0.1, pm = clamp(last + 0.12, 0.55, 0.84);
  const ob = foObject(th, p, moves);
  const fits = fitGroup(U, forces.map((f) => f.label), 300, FO_SIZES);
  const objFit = ob.label ? fitGroup(U, [ob.label], 360, [42, 38, 34, 30], 'd')[0] : null;
  // Arrows that point the same way stand side by side, in the order they come.
  const groups = {};
  forces.forEach((f, i) => { (groups[f.dir] ||= []).push(i); });
  const arrange = (z, mode) => {
    const k = (FO.size * z) / Math.max(ob.box[2] - ob.box[0], ob.box[3] - ob.box[1]), unit = FO.unit * z, half = ((ob.box[3] - ob.box[1]) * k) / 2;
    // How far the thing drifts. In water it goes up or down far enough to go from floating to under the surface.
    const D = !moves || setting === 'air' ? 0 : my === 0 ? FO.drift : setting === 'water' ? half + 30 : FO.driftUp;
    // It stands a little to the side it does not move to, so the motion is centered.
    const cx = 960 - (mx * D) / 2, cy = 485;
    const gx = cx - ((ob.box[0] + ob.box[2]) / 2 - 50) * k, gy = cy - ((ob.box[1] + ob.box[3]) / 2 - 50) * k; // the icon's middle
    const edges = { left: gx + (ob.box[0] - 50) * k, right: gx + (ob.box[2] - 50) * k, up: gy + (ob.box[1] - 50) * k, down: gy + (ob.box[3] - 50) * k };
    const objBox = { x0: edges.left, x1: edges.right, y0: edges.up, y1: edges.down };
    // The water's surface or the ground line. A thing that rises in water floats there at the end. Names keep clear of
    // the line both where it is at the start and where it is, as the picture moves, at the end.
    const line = setting === 'water' ? gy + (ob.waterline - 50) * k - (my < 0 ? D : 0) : setting === 'ground' ? edges.down : null;
    const bands = line === null ? [] : [line, line - my * D].map((y) => ({ x0: -4000, x1: 6000, y0: y - 8, y1: y + 8 }));
    const arrows = forces.map((f, i) => {
      const [dx, dy] = DIR[f.dir], g = groups[f.dir], m = g.length, j = g.indexOf(i);
      const w = m >= 3 ? (m >= 4 ? 18 : 20) : FO.w, sp = m >= 4 ? 58 : m === 3 ? 70 : 76, off = (j - (m - 1) / 2) * sp;
      const len = unit * f.mult, hh = w * 1.15, hl = w * 1.5;
      const start = dy ? [cx + off, edges[f.dir] + dy * FO.gap] : [edges[f.dir] + dx * FO.gap, cy + off];
      const tip = [start[0] + dx * len, start[1] + dy * len];
      const box = dy ? { x0: start[0] - hh, x1: start[0] + hh, y0: Math.min(start[1], tip[1]), y1: Math.max(start[1], tip[1]) } : { x0: Math.min(start[0], tip[0]), x1: Math.max(start[0], tip[0]), y0: start[1] - hh, y1: start[1] + hh };
      return { f, i, dx, dy, w, hh, hl, len, start, tip, box, rank: m === 1 ? 'one' : j === 0 ? 'first' : j === m - 1 ? 'last' : 'middle' };
    });
    // Each name goes at its arrow's tip, or beside it when that spot is taken; arrows in a pair take their outer sides.
    // The names are placed in the order the forces come, each clear of the thing, the arrows, the line and the names
    // placed before it. When the picture is short of room, an arrow pointing up or down has its name beside its tip.
    const taken = [objBox, ...arrows.map((a) => a.box), ...bands], blocks = [];
    arrows.slice().sort((a, b) => a.f.at - b.f.at).forEach((a) => {
      const fit = fits[a.i];
      if (!fit.lines.length) return;
      const [tx, ty] = a.tip, g = 18, cands = [];
      if (a.dy) {
        const beyond = (more = 0) => blockAt(U, fit, tx, a.dy < 0 ? ty - g - more - fit.s * 0.46 : ty + g + more + fit.s * 0.42, 'middle', a.dy < 0 ? 'last' : 'first');
        const beside = (side, more = 0) => blockAt(U, fit, tx + side * (a.hh + 14), ty - a.dy * (a.hl / 2 + more), side > 0 ? 'start' : 'end', 'mid');
        if (a.rank === 'first') cands.push(beside(-1), beyond(), beside(-1, 50), beside(1));
        else if (a.rank === 'last') cands.push(beside(1), beyond(), beside(1, 50), beside(-1));
        else if (mode === 'beside' && a.rank === 'one') cands.push(beside(1), beside(-1), beyond(), beside(1, 50), beside(-1, 50));
        else cands.push(beyond(), beside(1), beside(-1), beyond(60), beside(1, 60), beside(-1, 60));
      } else {
        const at = (y, md) => blockAt(U, fit, tx + a.dx * g, y, a.dx > 0 ? 'start' : 'end', md);
        const raised = () => at(ty - 14 - fit.s * 0.35, 'last'), lowered = () => at(ty + 14 + fit.s * 0.4, 'first');
        const above = () => blockAt(U, fit, tx - (a.dx * a.hl) / 2, ty - a.hh - 12 - fit.s * 0.46, 'middle', 'last');
        const below = () => blockAt(U, fit, tx - (a.dx * a.hl) / 2, ty + a.hh + 12 + fit.s * 0.42, 'middle', 'first');
        if (a.rank === 'first') cands.push(at(ty, 'last'), raised(), above(), at(ty - 50, 'last'));
        else if (a.rank === 'last') cands.push(at(ty, 'first'), lowered(), below(), at(ty + 50, 'first'));
        else cands.push(at(ty, 'mid'), raised(), lowered(), above(), below(), at(ty - 60, 'mid'), at(ty + 60, 'mid'));
      }
      const b = firstFree(cands, [...taken.filter((t) => t !== a.box), ...blocks.map((x) => x.box)], 12);
      b.arrow = a;
      blocks.push(b);
    });
    // The thing's own name: under it, over it or at a corner, wherever is free. On the ground it is never under it.
    let objBlock = null;
    if (objFit) {
      const { x0, x1, y0, y1 } = objBox, mid = (x0 + x1) / 2, gap = 20, cands = [];
      const under = () => blockAt(U, objFit, mid, y1 + gap + objFit.s * 0.42, 'middle', 'first');
      const over = () => blockAt(U, objFit, mid, y0 - gap - objFit.s * 0.46, 'middle', 'last');
      const corner = (sx, sy) => blockAt(U, objFit, sx > 0 ? x1 - 10 : x0 + 10, sy > 0 ? y1 + gap + objFit.s * 0.42 : y0 - gap - objFit.s * 0.46, sx > 0 ? 'start' : 'end', sy > 0 ? 'first' : 'last');
      if (setting === 'ground') cands.push(over(), corner(1, -1), corner(-1, -1));
      else cands.push(under(), over(), corner(1, 1), corner(-1, 1), corner(1, -1), corner(-1, -1));
      objBlock = firstFree(cands, [...taken, ...blocks.map((x) => x.box)], 14);
    }
    let box = { ...objBox };
    arrows.forEach((a) => { box = join(box, a.box); });
    blocks.forEach((b) => { box = join(box, b.box); });
    if (objBlock) box = join(box, objBlock.box);
    // With its motion, the picture takes this much room.
    const all = join(box, { x0: box.x0 + mx * D, x1: box.x1 + mx * D, y0: box.y0 + my * D, y1: box.y1 + my * D });
    return { z, k, S: 100 * k, D, cx, cy, gx, gy, edges, objBox, line, arrows, blocks, objBlock, box, all };
  };
  // The biggest zoom that fits the frame with names beyond the tips; then with names beside the tips of arrows that
  // point up or down; else the smallest, which TemplateScene scales down to fit.
  let lay = null;
  for (const mode of ['beyond', 'beside']) {
    for (const z of ZOOMS) {
      if (mode === 'beyond' && z < 0.85) break;
      const L = arrange(z, mode);
      if (L.all.x1 - L.all.x0 <= 1780 && L.all.y1 - L.all.y0 <= 630) { lay = L; break; }
    }
    if (lay) break;
  }
  lay ||= arrange(ZOOMS[ZOOMS.length - 1], 'beside');
  // The picture's middle from top to bottom, with its motion: TemplateScene sets it in the middle of the free area, so
  // the backdrop is laid out around it.
  return { setting, moves, pm, ob, forces, mid: (lay.all.y0 + lay.all.y1) / 2, ...lay };
}

// The quiet backdrop for each setting, reaching far past the frame and marked so it is not measured as content.
function foBackdrop(U, th, P, id) {
  const at = U.A('fade', 0, 0.06);
  if (P.setting === 'air') {
    // Clouds far off (streamed past by render when the thing moves), and a faint ground line far below.
    const cloud = (k, x, y, s) => {
      const parts = `<rect x="${n1(-70 * s)}" y="${n1(-26 * s)}" width="${n1(140 * s)}" height="${n1(42 * s)}" rx="${n1(21 * s)}"/><circle cx="${n1(-30 * s)}" cy="${n1(-28 * s)}" r="${n1(30 * s)}"/><circle cx="${n1(16 * s)}" cy="${n1(-38 * s)}" r="${n1(38 * s)}"/><circle cx="${n1(50 * s)}" cy="${n1(-16 * s)}" r="${n1(24 * s)}"/>`;
      const edge = th.card ? `<g fill="${th.line}" stroke="${th.line}" stroke-width="5">${parts}</g>` : '';
      return `<g id="${id}cl${k}" transform="translate(${n1(x)} ${n1(y)})">${edge}<g fill="${th.surface}">${parts}</g></g>`;
    };
    const gy = Math.max(P.mid + 330, P.box.y1 + 40);
    return `<g data-fm-bg="1"${at}>${foClouds(P).map(([x, y, s], k) => cloud(k, x, y, s)).join('')}<path d="M-2000 ${n1(gy)}H3920" stroke="${th.line}" stroke-width="4"/></g>`;
  }
  if (P.setting === 'ground') {
    // The ground under the thing: a line with hatching below it, as in a physics drawing.
    let hatch = '';
    for (let x = -2040; x <= 3960; x += 28) hatch += `M${x} ${n1(P.line + 5)}l-18 22`;
    return `<g data-fm-bg="1"${at}><path d="${hatch}" stroke="${th.line}" stroke-width="3" stroke-linecap="round"/><path d="M-2000 ${n1(P.line)}H3920" stroke="${th.muted}" stroke-width="5"/></g>`;
  }
  if (P.setting === 'space') {
    // A few stars, scattered the same way every time (twinkling in render).
    const star = (x, y, r) => `M${n1(x)} ${n1(y - r)}L${n1(x + r * 0.28)} ${n1(y - r * 0.28)}L${n1(x + r)} ${n1(y)}L${n1(x + r * 0.28)} ${n1(y + r * 0.28)}L${n1(x)} ${n1(y + r)}L${n1(x - r * 0.28)} ${n1(y + r * 0.28)}L${n1(x - r)} ${n1(y)}L${n1(x - r * 0.28)} ${n1(y - r * 0.28)}Z`;
    return `<g data-fm-bg="1"${at}>${foStars(P).map(([x, y, r], k) => `<path id="${id}st${k}" d="${star(x, y, r)}" fill="${th.ink}"/>`).join('')}</g>`;
  }
  return '';
}
// The clouds: up to five spots (with a size each) around the picture's middle where a cloud is clear of the picture,
// both where it starts and where it comes to rest after streaming past, so no cloud sits behind a name. They stream
// round within a band about the size of the frame.
const CLOUD_SPOTS = [[-760, -190, 1], [520, -200, 0.9], [-480, 200, 0.8], [780, 150, 1.05], [-300, -200, 0.7], [860, -40, 0.8],
  [-840, 230, 0.7], [320, 240, 0.75], [-640, -20, 0.85], [640, -110, 0.7], [-120, 250, 0.65], [160, -200, 0.65]];
const CLOUD_BAND = { w: 2000, h: 660 };
const wrapIn = (v, lo, span) => lo + ((((v - lo) % span) + span) % span);
function foStreamed(P, x, y, e) {
  const [mx, my] = P.moves ? DIR[P.moves] : [0, 0];
  return [wrapIn(x - mx * FO.stream * e, P.cx - CLOUD_BAND.w / 2, CLOUD_BAND.w), wrapIn(y - my * FO.stream * e, P.mid - CLOUD_BAND.h / 2, CLOUD_BAND.h)];
}
function foClouds(P) {
  const clear = ([x, y], s) => !overlaps({ x0: x - 76 * s, x1: x + 76 * s, y0: y - 78 * s, y1: y + 18 * s }, P.box, 36);
  const spots = CLOUD_SPOTS.map(([x, y, s]) => [P.cx + x, P.mid + y, s]).filter(([x, y, s]) => clear([x, y], s));
  const still = spots.filter(([x, y, s]) => clear(foStreamed(P, x, y, 1), s));
  return (still.length >= 3 ? still : spots).slice(0, 5);
}
// The stars: a seeded scatter around the picture's middle, none behind the thing, an arrow or a name.
function foStars(P) {
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646, out = [];
  const parts = [P.objBox, ...P.arrows.map((a) => a.box), ...P.blocks.map((b) => b.box), ...(P.objBlock ? [P.objBlock.box] : [])];
  for (let i = 0; out.length < 22 && i < 300; i++) {
    const x = P.cx + (rnd() - 0.5) * 1760, y = P.mid + (rnd() - 0.5) * 620, r = 5 + rnd() * 8;
    if (parts.some((b) => overlaps({ x0: x, x1: x, y0: y, y1: y }, b, 24))) continue;
    out.push([x, y, i % 3 === 0 ? r : r * 0.6]);
  }
  return out;
}
// The water's surface: a gentle wave across the frame (moved along by render).
const foWave = (y) => { const P = []; for (let x = -2100; x <= 4000; x += 24) P.push([x, y + 5 * Math.sin(x / 34)]); return pathD(P); };

register('forces', {
  cat: CAT, title: 'Forces',
  desc: 'The forces on one thing, as bold arrows that grow out from its edges, each named at its tip, in a quiet setting (the sky, water, the ground, space or nothing). Arrows that point the same way stand side by side, and their length shows how strong they are. At the end the thing can move the way the forces push it.',
  use: 'Forces and motion: lift, weight, thrust and drag on a plane; buoyancy on a ship; gravity and air resistance on a falling thing; friction on a braking car; a rocket lifting off.',
  params: 'object: {icon, label (optional)}, setting: air|water|ground|space|none (default none; in water the thing floats with the surface through it, on the ground it stands on the ground line), forces: [{direction: up|down|left|right, label (1 to 4 words), strength: small|medium|large (optional, default medium; the arrow\'s length)}] (1 to 4; forward is right; forces the same way stand side by side; each arrow grows as the narration names its force), moves: up|down|left|right|none (optional, default none; at the end the thing drifts that way, in the air the clouds stream past instead, in water up or down means rising to float or sinking under, and on the ground it cannot move down)',
  example: {
    object: { icon: 'plane', label: 'Plane' }, setting: 'air', moves: 'right',
    forces: [{ direction: 'up', label: 'Lift' }, { direction: 'down', label: 'Weight' }, { direction: 'right', label: 'Thrust' }, { direction: 'left', label: 'Drag' }],
  },
  build(p, c) {
    const { U, th } = c, id = c.id, P = foPlan(p, c), { ob, gx, gy } = P;
    let o = foBackdrop(U, th, P, id);
    // The thing, turned to face the way it goes.
    const tf = `translate(${n1(gx)} ${n1(gy)})${ob.turn ? ` rotate(${ob.turn})` : ''}${ob.mirror ? ' scale(-1 1)' : ''} translate(${n1(-gx)} ${n1(-gy)})`;
    o += `<g id="${id}da"><g${U.A('pop', 0.03, 0.07, { cx: n1(gx), cy: n1(gy) })}><g transform="${tf}">${iconOr(U, th, ob.icon, gx, gy, P.S, th.accent2)}</g></g></g>`;
    // Water over the lower part of the thing, and its surface.
    if (P.setting === 'water') {
      o += `<g data-fm-bg="1"${U.A('fade', 0, 0.06)}><rect x="-2000" y="${n1(P.line)}" width="5920" height="3000" fill="${WATER}" opacity=".32"/><path id="${id}wave" d="${foWave(P.line)}" fill="none" stroke="${WATER_LINE}" stroke-width="6"/></g>`;
    }
    // The arrows, each growing from the thing's edge, and their names.
    let arrows = '';
    P.arrows.forEach((a) => {
      const deg = (Math.atan2(a.dy, a.dx) * 180) / Math.PI, hw = a.w / 2;
      arrows += `<g transform="translate(${n1(a.start[0])} ${n1(a.start[1])}) rotate(${n1(deg)})"><g${U.A('grow', a.f.at, 0.07, { ax: 'x', cx: 0, cy: 0 })}>` +
        `<path d="M0 ${n1(-hw)}H${n1(a.len - a.hl)}V${n1(-a.hh)}L${n1(a.len)} 0L${n1(a.len - a.hl)} ${n1(a.hh)}V${n1(hw)}H0Z" fill="${th.accent}" stroke="${th.bg}" stroke-width="5" stroke-linejoin="round" paint-order="stroke"/></g></g>`;
    });
    P.blocks.forEach((b) => { arrows += `<g${U.A('up', b.arrow.f.at + 0.04, 0.05)}>${blockSvg(U, th, b)}</g>`; });
    if (P.objBlock) arrows += `<g${U.A('up', 0.08, 0.06)}>${blockSvg(U, th, P.objBlock)}</g>`;
    return o + `<g id="${id}db">${arrows}</g>`;
  },
  init(g, p, c) {
    const P = foPlan(p, c), q = (s) => g.querySelector('#' + c.id + s);
    return {
      P, drift: [q('da'), q('db')], wave: q('wave'),
      clouds: P.setting === 'air' ? foClouds(P).map((xy, k) => ({ xy, el: q('cl' + k) })) : [],
      stars: P.setting === 'space' ? foStars(P).map((_, k) => q('st' + k)) : [],
    };
  },
  render(l, st) {
    const P = st.P, e = P.moves ? smooth((l.p - P.pm) / (1 - P.pm)) : 0, [mx, my] = P.moves ? DIR[P.moves] : [0, 0];
    // The thing and its arrows drift the way it moves, and come to rest by the end.
    if (P.D) st.drift.forEach((el) => el?.setAttribute('transform', `translate(${n1(mx * P.D * e)} ${n1(my * P.D * e)})`));
    // In the air the clouds stream past the other way instead, wrapping round and fading at the ends of their band.
    st.clouds.forEach(({ xy, el }) => {
      if (!el) return;
      const [x, y] = foStreamed(P, xy[0], xy[1], e), lo = P.cx - CLOUD_BAND.w / 2, top = P.mid - CLOUD_BAND.h / 2;
      const fade = Math.min(1, (x - lo) / 160, (lo + CLOUD_BAND.w - x) / 160, (y - top) / 80, (top + CLOUD_BAND.h - y) / 80);
      el.setAttribute('transform', `translate(${n1(x)} ${n1(y)})`);
      el.setAttribute('opacity', clamp(fade, 0, 1).toFixed(3));
    });
    // The water's surface moves gently, and the stars twinkle.
    st.wave?.setAttribute('transform', `translate(${n1((l.t * 18) % (2 * Math.PI * 34))} 0)`);
    st.stars.forEach((el, k) => el?.setAttribute('opacity', (0.45 + 0.35 * Math.sin(l.t * (0.8 + (k % 5) * 0.23) + k * 1.7)).toFixed(3)));
  },
});
