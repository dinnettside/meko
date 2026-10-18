// Kit scenes for Meko, drawn in the film engine's style (see ../engine.js for how templates work). A kit template is
// told only WHAT is in the picture: the things in it with their names and icons, where they are in words, and what
// moves between them. The code decides WHERE and HOW: the layout and spacing, where each name goes, the routes things
// travel, the animation and its timing. So the director, a language model that is good with words and bad with
// geometry, can fill them for any topic and the picture still looks drawn by hand.
//
// Every visible word comes from the params; a thing without a label is drawn without one. The drawings hold no
// numbers, names or facts of their own.
import { register } from "../engine.js";

const CAT = 'Kit';

// Natural things keep a natural color in every look, chosen to read on the dark grounds (Night atlas, Blueprint) and
// on the light page (Field guide) alike.
const SKY = '#7DB9E8'; // the strip of sky, laid thinly over the ground
const GRASS = '#8A9E66'; // the ground's surface
const SOIL = ['#A88763', '#8F7052', '#775B42', '#614934']; // soil and rock from the top down
const WATER = ['#5AA2D8', '#4489C7', '#3672B1', '#2A5E99']; // the sea from the surface down
const FOAM = '#DCEFFB'; // the line of the water's surface
const SAND = '#C9A86E'; // the seabed
const SAND_LINE = '#A8884F';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const f1 = (v) => (+v).toFixed(1);
const say = (v) => (typeof v === 'string' ? v.trim() : '');
const smooth = (x) => { const t = clamp(x, 0, 1); return t * t * (3 - 2 * t); };
// A bump from 0 up to 1 and back down as x goes from 0 to 1, and 0 outside.
const bump = (x) => (x <= 0 || x >= 1 ? 0 : Math.sin(Math.PI * x));
const line = (P) => P.map(([x, y], i) => `${i ? 'L' : 'M'}${f1(x)} ${f1(y)}`).join('');
// Points along a gentle wave from x0 to x1 around the height y0.
const wave = (x0, x1, y0, amp, len, ph, step = 16) => {
  const P = [];
  for (let x = x0; x < x1; x += step) P.push([x, y0 + amp * Math.sin((x - x0) / len + ph)]);
  P.push([x1, y0 + amp * Math.sin((x1 - x0) / len + ph)]);
  return P;
};
// The look's own edge for drawn shapes: chalk lines in Blueprint, thin ink in Field guide, none on Night atlas's flat
// shapes.
const edge = (th, w) => (th.card ? ` stroke="${th.card.stroke}" stroke-width="${w ?? th.card.width}" stroke-linejoin="round"` : '');
// The outline of a figure or a casing: ink in the outlined looks, a quieter line on Night atlas.
const outlineOf = (th) => (th.card ? th.ink : th.muted);
// An icon name as the look's icons know it ("Gold" is "gold"); a missing one draws a dot.
const iconOf = (v) => (typeof v === 'string' && v.trim() ? v.trim().toLowerCase() : 'dot');
const word = (v, list, fallback) => { const s = typeof v === 'string' ? v.trim().toLowerCase() : ''; return list.includes(s) ? s : fallback; };

/* ---------------------------------------------------------------------------------------------------------------
 * Text and name tags
 * ------------------------------------------------------------------------------------------------------------- */

const LABEL_SIZES = [34, 32, 30];

// A name's words at the biggest size that fits maxW pixels: on one line, else on two lines split where they come out
// most even, else on up to three lines at the smallest size (the last line takes the words left, so none is lost).
function fitText(U, text, maxW, sizes = LABEL_SIZES) {
  const words = String(text).trim().split(/\s+/).filter(Boolean), width = (t, s) => U.tw(t, s, { w: 700 });
  const done = (s, lines) => { const lh = Math.round(s * 1.14); return { s, lines, lh, w: Math.max(...lines.map((l) => width(l, s))), h: lines.length * lh }; };
  const all = words.join(' ');
  for (const s of sizes) if (width(all, s) <= maxW) return done(s, [all]);
  for (const s of sizes) {
    let best = null;
    for (let i = 1; i < words.length; i++) {
      const lines = [words.slice(0, i).join(' '), words.slice(i).join(' ')], w = Math.max(width(lines[0], s), width(lines[1], s));
      if (w <= maxW && (!best || w < best.w)) best = { w, lines };
    }
    if (best) return done(s, best.lines);
  }
  const s = sizes[sizes.length - 1], lines = [];
  let cur = '';
  for (const w of words) { const next = cur ? cur + ' ' + w : w; if (cur && width(next, s) > maxW) { lines.push(cur); cur = w; } else cur = next; }
  if (cur) lines.push(cur);
  return done(s, lines.length > 3 ? [lines[0], lines[1], lines.slice(2).join(' ')] : lines);
}

// Lines of text set at x (centered, or ending or starting there with o.a), with the block's middle at y.
const textLines = (U, x, y, fit, o = {}) => fit.lines.map((l, i) => U.T(f1(x), f1(y + (i - (fit.lines.length - 1) / 2) * fit.lh + fit.s * 0.35), l, Object.assign({ s: fit.s, w: 700 }, o))).join('');

// A name on a tag in the look's own card style (a flat panel, a chalk box or a paper tag), so it reads on soil, water
// or the page alike.
const PADX = 16, PADY = 6;
const tagSize = (fit) => ({ w: fit.w + 2 * PADX, h: fit.h + 2 * PADY });
function tag(U, th, b, fit, col) {
  const h = b.y1 - b.y0;
  return U.card(f1(b.x0), f1(b.y0), f1(b.x1 - b.x0), f1(h), { r: Math.min(h / 2, th.radius + 6) }) + textLines(U, (b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, fit, { f: col || th.ink });
}

/* ---------------------------------------------------------------------------------------------------------------
 * Geometry
 * ------------------------------------------------------------------------------------------------------------- */

const rect = (x0, y0, x1, y1) => ({ x0, y0, x1, y1 });
const centered = (x, y, w, h) => rect(x - w / 2, y - h / 2, x + w / 2, y + h / 2);
const overlap = (a, b, m = 0) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) + m) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) + m);
// How far into a circle or a box (with a margin m) a box reaches, as an area.
const hits = (b, o, m) => (o.r != null ? overlap(b, rect(o.x - o.r, o.y - o.r, o.x + o.r, o.y + o.r), m) : overlap(b, o, m));
// Whether a point lies inside a circle or a box, and how deep.
const depth = (q, o) => {
  if (o.r != null) return Math.max(0, o.r - Math.hypot(q[0] - o.x, q[1] - o.y));
  return Math.max(0, Math.min(q[0] - o.x0, o.x1 - q[0], q[1] - o.y0, o.y1 - q[1]));
};

// Centers for things of widths w in a row from x0 to x1, kept in order, each as near the center it wants as it can be
// with at least `gap` between neighbors (one number, or one per pair: gap[i] between thing i and the next): things that
// would touch move as one block, centered on what its members want. The same works for a column of heights.
function packRow(units, x0, x1, gap) {
  const blocks = [], after = (i) => (Array.isArray(gap) ? gap[i] ?? 0 : gap);
  const place = (b) => {
    let sum = 0;
    b.items.forEach((i, k) => { sum += units[i].want - b.offs[k]; });
    b.left = clamp(sum / b.items.length, x0, Math.max(x0, x1 - b.w));
  };
  units.forEach((u, i) => {
    let b = { items: [i], offs: [u.w / 2], w: u.w };
    place(b);
    while (blocks.length) {
      const prev = blocks[blocks.length - 1], g = after(prev.items[prev.items.length - 1]);
      if (prev.left + prev.w + g <= b.left + 0.01) break;
      blocks.pop();
      const shift = prev.w + g;
      b = { items: prev.items.concat(b.items), offs: prev.offs.concat(b.offs.map((o) => o + shift)), w: prev.w + g + b.w };
      place(b);
    }
    blocks.push(b);
  });
  const xs = [];
  blocks.forEach((b) => b.items.forEach((i, k) => { xs[i] = b.left + b.offs[k]; }));
  return xs;
}

// A measured line: its points, the distance to each point along it and its length, and the point at a distance.
function track(pts) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { pts, cum, len: cum[cum.length - 1] };
}
function pointAt(tr, s) {
  const d = clamp(s, 0, tr.len);
  let lo = 1, hi = tr.cum.length - 1;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (tr.cum[mid] < d) lo = mid + 1; else hi = mid; }
  const a = tr.pts[lo - 1], b = tr.pts[lo], k = (d - tr.cum[lo - 1]) / (tr.cum[lo] - tr.cum[lo - 1] || 1);
  return { x: a[0] + (b[0] - a[0]) * k, y: a[1] + (b[1] - a[1]) * k };
}
const quad = (a, c, b, t) => [(1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0], (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1]];
// Whether segments pq and rs cross.
const crosses = (p, q, r, s) => {
  const d = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  return d(p, q, r) * d(p, q, s) < 0 && d(r, s, p) * d(r, s, q) < 0;
};
const crossings = (A, B) => {
  let n = 0;
  for (let i = 1; i < A.length; i++) for (let j = 1; j < B.length; j++) if (crosses(A[i - 1], A[i], B[j - 1], B[j])) n++;
  return n;
};

/* ---------------------------------------------------------------------------------------------------------------
 * Flows: dots that keep moving from one thing to another along a route that steers clear of everything else
 * ------------------------------------------------------------------------------------------------------------- */

// The route from the circle a to the circle b ({x, y, r}): of the smooth curves between them, bent one way or the
// other by as much as it takes, the one that keeps clearest of the other things, the names and the routes drawn before
// it, stays inside `bounds`, and is short.
function route(a, b, obstacles, routes, bounds) {
  const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  let best = null;
  for (const k of [0, 0.14, -0.14, 0.28, -0.28, 0.42, -0.42, 0.58, -0.58, 0.76, -0.76, 0.96, -0.96, 1.2, -1.2]) {
    const c = [(a.x + b.x) / 2 + nx * k * L, (a.y + b.y) / 2 + ny * k * L];
    const ua = Math.hypot(c[0] - a.x, c[1] - a.y) || 1, ub = Math.hypot(c[0] - b.x, c[1] - b.y) || 1;
    const start = [a.x + ((c[0] - a.x) / ua) * a.r, a.y + ((c[1] - a.y) / ua) * a.r];
    const end = [b.x + ((c[0] - b.x) / ub) * b.r, b.y + ((c[1] - b.y) / ub) * b.r];
    const pts = Array.from({ length: 41 }, (_, i) => quad(start, c, end, i / 40));
    let cost = Math.abs(k) * 160, len = 0;
    pts.forEach((q, i) => {
      for (const o of obstacles) { const d = depth(q, o); if (d > 0) cost += 300 + d * 30; }
      // Running along another route, as two flows between the same things would, costs too: they take two lanes.
      if (i > 2 && i < pts.length - 3) for (const r of routes) if (r.pts.some((p) => Math.abs(p[0] - q[0]) < 26 && Math.abs(p[1] - q[1]) < 26)) cost += 80;
      if (q[0] < bounds.x0 || q[0] > bounds.x1 || q[1] < bounds.y0 || q[1] > bounds.y1) cost += 3000;
      if (i) len += Math.hypot(q[0] - pts[i - 1][0], q[1] - pts[i - 1][1]);
    });
    // A route too short to show its dots bends out into an arc instead.
    cost += len * 0.15 + Math.max(0, 110 - len) * 10;
    for (const r of routes) cost += crossings(pts, r.pts) * 500;
    if (!best || cost < best.cost) best = { cost, start, c, end, pts };
  }
  return best;
}

// Where a route's name goes: beside the route near its middle, on whichever side and at whichever point keeps it
// clearest of the things, the names, the other routes and its own route, inside `bounds`.
function flowLabelBox(r, size, obstacles, routes, bounds) {
  const { w, h } = size, n = r.pts.length;
  let best = null;
  for (const t of [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8]) {
    const i = Math.round(t * (n - 1)), q = r.pts[i], a = r.pts[Math.max(0, i - 1)], b = r.pts[Math.min(n - 1, i + 1)];
    const tl = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, nx = -(b[1] - a[1]) / tl, ny = (b[0] - a[0]) / tl;
    const reach = (Math.abs(nx) * w) / 2 + (Math.abs(ny) * h) / 2 + 14;
    for (const sgn of [1, -1]) {
      const bx = centered(q[0] + sgn * nx * reach, q[1] + sgn * ny * reach, w, h);
      let cost = Math.abs(t - 0.5) * 300;
      for (const o of obstacles) cost += hits(bx, o, 8) * (o.soft ? 1 : 4);
      for (const other of routes) for (const p of other.pts) if (p[0] > bx.x0 - 6 && p[0] < bx.x1 + 6 && p[1] > bx.y0 - 6 && p[1] < bx.y1 + 6) cost += 900;
      cost += (Math.max(0, bounds.x0 - bx.x0) + Math.max(0, bx.x1 - bounds.x1) + Math.max(0, bounds.y0 - bx.y0) + Math.max(0, bx.y1 - bounds.y1)) * 200;
      if (!best || cost < best.cost) best = { cost, box: bx };
    }
  }
  return best.box;
}

// Routes every flow between the placed things (each {x, y, r}), avoiding the other things and `boxes` (the names),
// then places the flows' names, which also keep off the `soft` boxes (lines of the setting) where they can. Each flow
// starts once both its ends are in, and never in the same moment as another.
function planFlows(U, flows, spots, boxes, bounds, soft = [], lines = []) {
  const avoid = lines.map((pts) => ({ pts })); // lines drawn already (the body's leaders): crossed as little as can be
  const out = [];
  let last = -1;
  const order = flows.map((_, k) => k).sort((a, b) => Math.max(spots[flows[a].from].at, spots[flows[a].to].at) - Math.max(spots[flows[b].from].at, spots[flows[b].to].at) || a - b);
  const starts = [];
  order.forEach((k) => {
    const f = flows[k], ready = Math.max(spots[f.from].at, spots[f.to].at) + 0.06;
    starts[k] = Math.min(0.9, Math.max(ready, last + 0.07));
    last = starts[k];
  });
  flows.forEach((f, k) => {
    const A = spots[f.from], B = spots[f.to];
    const others = spots.filter((_, i) => i !== f.from && i !== f.to).map((s) => ({ x: s.x, y: s.y, r: s.r + 16 }));
    const r = route({ x: A.x, y: A.y, r: A.r + 6 }, { x: B.x, y: B.y, r: B.r + 12 }, others.concat(boxes.map((b) => rect(b.x0 - 12, b.y0 - 12, b.x1 + 12, b.y1 + 12))), out.concat(avoid), bounds);
    out.push(Object.assign(r, { flow: f, at: starts[k], tr: track(r.pts) }));
  });
  // The names, once every route is known, so a name never sits on a route drawn after it.
  const placed = [];
  out.forEach((r) => {
    if (!r.flow.label) return;
    r.fit = fitText(U, U.lab(r.flow.label), 300, [32, 30]);
    const obstacles = spots.map((s) => ({ x: s.x, y: s.y, r: s.r + 6 })).concat(boxes, placed, soft.map((b) => Object.assign({ soft: true }, b)));
    r.box = flowLabelBox(r, tagSize(r.fit), obstacles, out.concat(avoid), bounds);
    placed.push(r.box);
  });
  return out;
}

// A flow's route (drawn in as it starts), its arrowhead, its moving dots (placed by render) and its name.
const DOT_GAP = 104, DOT_SPEED = 150;
function flowMarkup(U, th, id, r, k) {
  const d = `M${f1(r.start[0])} ${f1(r.start[1])}Q${f1(r.c[0])} ${f1(r.c[1])} ${f1(r.end[0])} ${f1(r.end[1])}`;
  const ang = Math.atan2(r.end[1] - r.c[1], r.end[0] - r.c[0]), ca = Math.cos(ang), sa = Math.sin(ang);
  const tip = [r.end[0] + ca * 6, r.end[1] + sa * 6], back = [tip[0] - ca * 26, tip[1] - sa * 26];
  const head = `M${f1(tip[0])} ${f1(tip[1])}L${f1(back[0] - sa * 14)} ${f1(back[1] + ca * 14)}L${f1(back[0] + sa * 14)} ${f1(back[1] - ca * 14)}Z`;
  const n = Math.max(2, Math.ceil(r.tr.len / DOT_GAP));
  let o = `<g opacity="0"${U.A('fade', r.at, 0.004)}><path d="${d}" pathLength="1000" fill="none" stroke="${th.ink}" stroke-opacity=".42" stroke-width="5" stroke-linecap="round" stroke-dasharray="1000 1010" stroke-dashoffset="1000"${U.A('draw', r.at, 0.08, { l: 1000 })}/></g>`;
  o += `<path d="${head}" fill="${th.accent}" stroke="${th.bg}" stroke-width="3" stroke-linejoin="round" paint-order="stroke" opacity="0"${U.A('fade', r.at + 0.07, 0.03)}/>`;
  for (let i = 0; i < n; i++) o += `<circle id="${id}f${k}d${i}" cx="${f1(r.start[0])}" cy="${f1(r.start[1])}" r="10" fill="${th.accent}" stroke="${th.bg}" stroke-width="3" opacity="0"/>`;
  return o;
}
const flowLabelMarkup = (U, th, r) => (r.box ? `<g${U.A('up', r.at + 0.05, 0.06)}>${tag(U, th, r.box, r.fit, th.accent)}</g>` : '');

// Moves the dots of every flow along its route: they come out of the start one after another once the flow has begun
// and keep flowing, fading in and out at the ends. The same time always gives the same picture.
function moveDots(l, flows) {
  flows.forEach((f) => {
    const since = l.t - f.at * l.dur, n = f.dots.length, gap = f.tr.len / n;
    f.dots.forEach((el, i) => {
      if (!el) return;
      const run = since * DOT_SPEED - i * gap;
      if (since < 0.15 || run < 0) { el.setAttribute('opacity', '0'); return; }
      const s = run % f.tr.len, pt = pointAt(f.tr, s);
      el.setAttribute('cx', f1(pt.x));
      el.setAttribute('cy', f1(pt.y));
      el.setAttribute('opacity', Math.min(1, s / 26, (f.tr.len - s) / 26, (since - 0.15) * 4).toFixed(2));
    });
  });
}

/* ---------------------------------------------------------------------------------------------------------------
 * cutaway: a cross-section of a place with things inside it and things moving between them
 * ------------------------------------------------------------------------------------------------------------- */

const SETTINGS = ['ground', 'sea', 'body', 'box'];
const ZONES = ['sky', 'surface', 'upper', 'lower'];
const SIDES = ['left', 'center', 'right'];
const SIDE_RANK = { left: 0, center: 1, right: 2 };
const SIDE_AT = { left: 0.17, center: 0.5, right: 0.83 };
const ICON_SIZES = [176, 164, 152, 140, 128, 118, 108, 98, 90, 82, 76];
// The biggest icons for a scene with one, two, ... six things: a few things can be drawn bigger than many.
const MAX_ICON = [176, 176, 176, 164, 150, 140];
const GAP_X = 36; // the least room between things side by side
const FLOW_GAP = 150; // more room between neighbors joined by a flow, so its dots and name show
const LGAP = 10; // between a thing and its name
const TOP = 150, BOTTOM = 820, ROOM = BOTTOM - TOP; // the free part of the frame

// The params, cleaned: at most six things, each with its zone and side (a missing or unknown one is the middle of the
// zone under the surface), and at most four flows between different things. The things keep their place in the
// params, since `times` and the flows count by it.
function cutawayInput(p) {
  const raw = Array.isArray(p.items) ? p.items : [];
  const items = [], index = new Map();
  raw.forEach((it, i) => {
    if (!it || typeof it !== 'object' || items.length >= 6) return;
    index.set(i, items.length);
    items.push({ k: items.length, src: i, icon: iconOf(it.icon), label: say(it.label), zone: word(it.zone, ZONES, 'upper'), side: word(it.side, SIDES, 'center') });
  });
  // Each thing comes in as the narration names it (times, from TemplateScene), or spread over the first part of the
  // scene, after the setting.
  const n = items.length;
  items.forEach((it) => {
    const t = Array.isArray(p.times) ? Number(p.times[it.src]) : NaN;
    it.at = Number.isFinite(t) ? clamp(t, 0.1, 0.9) : 0.14 + (n > 1 ? (0.5 * it.k) / (n - 1) : 0.08);
  });
  const flows = [];
  for (const f of Array.isArray(p.flows) ? p.flows : []) {
    if (!f || typeof f !== 'object' || flows.length >= 4) continue;
    const a = index.get(Number(f.from)), b = index.get(Number(f.to));
    if (a === undefined || b === undefined || a === b || flows.some((g) => g.from === a && g.to === b)) continue;
    flows.push({ from: a, to: b, label: say(f.label) });
  }
  const links = new Set(flows.flatMap((f) => [f.from + '-' + f.to, f.to + '-' + f.from]));
  const setting = word(p.setting, SETTINGS, 'ground');
  const layerList = Array.isArray(p.layers) ? p.layers.slice(0, 4) : [];
  const layers = setting === 'ground' || setting === 'sea'
    ? Array.from({ length: clamp(layerList.length || (setting === 'sea' ? 2 : 3), 2, 4) }, (_, k) => ({ label: say(layerList[k] && layerList[k].label) }))
    : [];
  return { setting, items, flows, links, layers, boxLabel: setting === 'box' ? say(p.boxLabel) : '' };
}

// A thing at icon size s with its name fitted to maxLW, as a unit: how wide the two take together, with the name on a
// tag under (or over) the icon ('tag'), or beside it ('side'). A name beside its thing faces out of the
// picture, so the room between things stays free for the flows: left of a thing on the left, right of one on the
// right, and for one in the middle on the side away from the things it is joined to (`left` says it goes left).
function unitOf(U, it, s, maxLW, mode, left) {
  if (!it.label) return { it, s, mode, fit: null, tw: 0, th: 0, w: s };
  const fit = fitText(U, U.lab(it.label), maxLW - 2 * PADX), t = tagSize(fit);
  return mode === 'side' ? { it, s, mode, fit, left, tw: t.w, th: t.h, w: s + LGAP + t.w } : { it, s, mode, fit, tw: t.w, th: t.h, w: Math.max(s, t.w) };
}

// The things of one zone in one row, or in two staggered rows when one row would be too tight, sorted from left to
// right by their sides. Neighbors joined by a flow get more room between them.
function zoneRows(U, list, W, s, maxRows, mode, links, faceLeft) {
  if (!list.length) return { rows: [], fits: true, mode };
  const sorted = list.slice().sort((a, b) => SIDE_RANK[a.side] - SIDE_RANK[b.side] || a.k - b.k);
  let best = null;
  for (let n = 1; n <= Math.min(maxRows, sorted.length); n++) {
    const groups = Array.from({ length: n }, (_, j) => sorted.filter((_, q) => q % n === j));
    const slot = W / Math.max(...groups.map((g) => g.length)) - GAP_X;
    const maxLW = mode === 'side' ? clamp(slot - s - LGAP, 160, 340) : clamp(slot, 170, 380);
    const rows = groups.map((g) => {
      const units = g.map((it) => unitOf(U, it, s, maxLW, mode, faceLeft(it)));
      units.gaps = units.slice(1).map((u, j) => GAP_X + (links.has(units[j].it.k + '-' + u.it.k) ? FLOW_GAP : 0));
      return units;
    });
    // The extra room around flows can be squeezed (see rowXs), so a row fits when it fits with the least gaps.
    const fits = rows.every((row) => row.reduce((a, u) => a + u.w, 0) + GAP_X * (row.length - 1) <= W);
    const tall = rows.some((row) => row.some((u) => u.fit && u.fit.lines.length > 2));
    best = { rows, fits, mode };
    if (fits && !tall) break;
  }
  return best;
}

// The icon centers of a row's things across x0..x1: each near where its side says, with the extra room around flows
// where it fits, and the room left over shared out, so things that want the same spot spread a little.
function rowXs(row, x0, x1) {
  const W = x1 - x0, sumW = row.reduce((a, u) => a + u.w, 0);
  let gaps = row.gaps.slice();
  const need = sumW + gaps.reduce((a, g) => a + g, 0);
  if (need > W) {
    const extra = gaps.reduce((a, g) => a + g - GAP_X, 0);
    gaps = gaps.map((g) => GAP_X + (g - GAP_X) * Math.max(0, 1 - (need - W) / (extra || 1)));
  } else {
    const bonus = Math.min(70, (W - need) / (row.length + 1));
    gaps = gaps.map((g) => g + bonus);
  }
  // A name beside its icon shifts the pair, so the icon itself stays near its spot.
  const shift = (u) => (u.mode === 'side' && u.fit ? ((u.left ? -1 : 1) * (u.w - u.s)) / 2 : 0);
  return packRow(row.map((u) => ({ w: u.w, want: x0 + SIDE_AT[u.it.side] * W + shift(u) })), x0, x1, gaps).map((cx, j) => cx - shift(row[j]));
}

// Where a thing's name tag goes for a thing at (x, y): beside it, or under or over it, kept inside x0..x1.
function tagFor(u, x, y, where, x0, x1) {
  if (!u.fit) return null;
  if (u.mode === 'side') {
    const bx = u.left ? x - u.s / 2 - LGAP - u.tw : x + u.s / 2 + LGAP;
    return rect(bx, y - u.th / 2, bx + u.tw, y + u.th / 2);
  }
  const cx = clamp(x, x0 + u.tw / 2, x1 - u.tw / 2);
  return where === 'above' ? rect(cx - u.tw / 2, y - u.s / 2 - LGAP - u.th, cx + u.tw / 2, y - u.s / 2 - LGAP) : rect(cx - u.tw / 2, y + u.s / 2 + LGAP, cx + u.tw / 2, y + u.s / 2 + LGAP + u.th);
}

// The boxes a row of things takes, measured from its icon line: each icon (the part of its square an icon fills) and
// each name tag.
function rowBoxes(row, xs, where, tx0, tx1) {
  const boxes = [];
  row.forEach((u, j) => {
    boxes.push(rect(xs[j] - u.s * 0.45, -u.s * 0.45, xs[j] + u.s * 0.45, u.s * 0.45));
    const t = tagFor(u, xs[j], 0, where, tx0, tx1);
    if (t) boxes.push(t);
  });
  return boxes;
}
const boxTop = (r) => Math.min(...r.boxes.map((b) => b.y0));
const boxBottom = (r) => Math.max(...r.boxes.map((b) => b.y1));

// The least distance between the icon lines of row A and row B under it. Their things and names may not touch, but
// they may sit at overlapping heights where they do not overlap from side to side, as a designer would put a cloud up
// on the left beside a house standing on the right. A row still sits a good part of an icon lower than the row above
// it, so the zones read from top to bottom; `apart` keeps the two rows wholly one above the other (the floors of a box).
function rowSep(A, B, apart) {
  let sep = (A.z === 'upper' && B.z === 'lower' ? 0.75 : 0.55) * Math.max(A.s, B.s);
  if (apart) sep = Math.max(sep, boxBottom(A) - boxTop(B) + 30);
  for (const a of A.boxes) for (const b of B.boxes) {
    if (a.x1 + 26 <= b.x0 || b.x1 + 26 <= a.x0) continue;
    sep = Math.max(sep, a.y1 - b.y0 + 24);
  }
  return sep;
}

// The ground, the sea and the box share one plan. The rows of things go from the sky down, each pushed below the one
// above only as far as their things and names need, with the surface line between the rows above it and under it;
// the room left over goes to the gaps, most of it next to the zones that hold things. The icons get the biggest size
// at which everything fits, and when the names under the things make it too tall, the zones that save the most put
// their names beside the things.
function planBands(U, th, inp) {
  const { setting, items, layers, boxLabel, links, flows } = inp, by = (z) => items.filter((it) => it.zone === z);
  const box = setting === 'box', sea = setting === 'sea';
  // The layers' names go in a column left of the block.
  const layerFits = layers.map((L) => (L.label ? fitText(U, U.lab(L.label), 300, [32, 30]) : null));
  const gutter = layerFits.some(Boolean) ? Math.max(...layerFits.filter(Boolean).map((f) => f.w)) + 46 : 0;
  // A box is as wide as its fullest zone needs, so a box with a few things looks like a machine and not a hall.
  const most = Math.max(...ZONES.map((z) => by(z).length));
  const blockW = box ? [940, 940, 1180, 1300][Math.min(most, 3)] + (most >= 4 ? 220 : 0) : Math.min(1640, 1740 - gutter);
  const BX0 = 960 - (gutter + blockW) / 2 + gutter, BX1 = BX0 + blockW;
  const WALL = box ? 24 : 0, ix0 = BX0 + WALL + 30, ix1 = BX1 - WALL - 30;
  const plate = box && boxLabel ? fitText(U, U.lab(boxLabel), 700, [40, 36, 34]) : null, plateH = plate ? plate.h + 24 : 0;
  const zoneX = (z) => (z === 'sky' || (box && z === 'surface') ? [BX0 + 20, BX1 - 20] : [ix0, ix1]);
  const tagX = (z) => (z === 'upper' || z === 'lower' ? [BX0 + WALL + 6, BX1 - WALL - 6] : [BX0 + 6, BX1 - 6]);
  // Whether a thing's name beside it goes on its left: on the left side, or in the middle when more of the things it is
  // joined to are on the right.
  const faceLeft = (it) => {
    if (it.side !== 'center') return it.side === 'left';
    const lean = flows.reduce((a, f) => { const o = f.from === it.k ? items[f.to] : f.to === it.k ? items[f.from] : null; return a + (o ? SIDE_RANK[o.side] - 1 : 0); }, 0);
    return lean > 0;
  };
  // The rows from the top down, with their things' x and the boxes they take.
  const rowsOf = (Z) => ZONES.flatMap((z) => Z[z].rows.map((row) => {
    const [x0, x1] = zoneX(z), xs = rowXs(row, x0, x1), where = z === 'surface' ? 'above' : 'below';
    return { z, row, xs, where, s: row[0].s, mode: Z[z].mode, boxes: rowBoxes(row, xs, where, ...tagX(z)) };
  }));
  // The gaps from the top of the frame down, through the rows, the surface line and (at sea) the seabed to the bottom:
  // each with the least it may be and its share of the room left over.
  const stack = (rows) => {
    const above = rows.filter((r) => r.z === 'sky' || r.z === 'surface'), under = rows.filter((r) => r.z === 'upper' || r.z === 'lower');
    const G = [], marks = [], gap = (min, w, mark) => { G.push({ min, w }); marks.push(mark); };
    let prev = null;
    above.forEach((r) => { gap(prev ? rowSep(prev, r) : 18 - boxTop(r), prev ? (prev.z === r.z ? 0.3 : 1) : r.z === 'sky' ? 1 : 0.8, r); prev = r; });
    if (!prev) gap(box ? 0 : 76, box ? 0 : 0.4, 'line');
    else if (prev.z === 'surface') gap(sea ? prev.s * 0.2 : prev.s / 2 + 3, 0, 'line');
    else gap(boxBottom(prev) + 12, 0.6, 'line');
    // How far things floating on the water reach under its line.
    const surf = above.find((r) => r.z === 'surface'), dip = sea && surf ? Math.max(0, boxBottom(surf) - surf.s * 0.2) : 0;
    const inTop = box ? WALL + 26 : 18 + dip, hasUpper = under.some((r) => r.z === 'upper');
    prev = null;
    under.forEach((r) => {
      if (!prev) gap(inTop - boxTop(r) + (r.z === 'lower' && !hasUpper ? (box ? 70 : 90) : 0), 1.2, r);
      else gap(rowSep(prev, r, box && prev.z !== r.z), prev.z === r.z ? 0.3 : 1.4, r);
      prev = r;
    });
    if (sea) {
      if (prev && prev.z === 'lower') gap(prev.s / 2 + 2, 0, 'seabed'); // it rests on the seabed
      else gap(prev ? boxBottom(prev) + 60 : inTop + 150, 0.6, 'seabed');
      const names = prev && prev.z === 'lower' && prev.mode !== 'side' ? Math.max(0, ...prev.row.map((u) => (u.fit ? LGAP + u.th : 0))) : 0;
      gap(Math.max(58, names + 16), 0, 'end');
    } else {
      const pad = !prev ? (box ? 250 : 220) : prev.z === 'lower' ? 22 : 96;
      gap((prev ? boxBottom(prev) : 0) + pad + WALL, !prev ? 0.4 : prev.z === 'lower' ? 1 : 0.8, 'end');
    }
    // Things in the sky stay wholly above the surface: where one reaches too low, the rows under it move down.
    const li = marks.indexOf('line'), sum = (a, b) => G.slice(a, b).reduce((t, g) => t + g.min, 0);
    marks.forEach((m, i) => {
      if (typeof m !== 'object' || m.z !== 'sky') return;
      const short = boxBottom(m) + 12 - sum(i + 1, li + 1);
      if (short > 0) { let k = li; while (k > i + 1 && !G[k].w) k--; G[k].min += short; }
    });
    if (!box && sum(0, li + 1) < 76) G[0].min += 76 - sum(0, li + 1);
    const least = box ? 250 + 2 * WALL : sea ? 210 : 220, deep = sum(li + 1, G.length);
    if (deep < least) { let k = G.length - 1; while (k > li + 1 && !G[k].w) k--; G[k].min += least - deep; }
    return { G, marks, total: sum(0, G.length) + plateH };
  };
  let plan = null;
  for (const s of ICON_SIZES.filter((v) => v <= MAX_ICON[clamp(items.length, 1, 6) - 1])) {
    const mode = {}, Z = {};
    const zr = (z) => zoneRows(U, by(z), zoneX(z)[1] - zoneX(z)[0], s, z === 'surface' ? 1 : 2, mode[z], links, faceLeft);
    ZONES.forEach((z) => { mode[z] = 'tag'; Z[z] = zr(z); });
    let S = stack(rowsOf(Z));
    while (S.total > ROOM) {
      let best = null;
      for (const z of ZONES) {
        if (mode[z] === 'side' || !Z[z].rows.length || !by(z).some((it) => it.label)) continue;
        const was = Z[z];
        mode[z] = 'side';
        Z[z] = zr(z);
        const alt = Z[z], T = stack(rowsOf(Z)).total;
        Z[z] = was;
        mode[z] = 'tag';
        if (alt.fits && T < S.total - 1 && (!best || T < best.T)) best = { z, alt, T };
      }
      if (!best) break;
      mode[best.z] = 'side';
      Z[best.z] = best.alt;
      S = stack(rowsOf(Z));
    }
    plan = { s, Z, S };
    if (S.total <= ROOM && ZONES.every((z) => Z[z].fits)) break;
  }
  const { S } = plan, rows = S.marks.filter((m) => typeof m === 'object'), extra = Math.max(0, ROOM - S.total), weight = S.G.reduce((a, g) => a + g.w, 0);
  const pos = new Map();
  let y = TOP;
  S.G.forEach((g, i) => { y += g.min + (weight ? (extra * g.w) / weight : 0); pos.set(S.marks[i], y); });
  const LY = pos.get('line'), bottom = pos.get('end'), SB = sea ? pos.get('seabed') : bottom; // the surface, the seabed, the bottom
  const spots = [];
  rows.forEach((r) => {
    const ry = pos.get(r), [tx0, tx1] = tagX(r.z);
    r.row.forEach((u, j) => spots.push({ u, x: r.xs[j], y: ry, box: tagFor(u, r.xs[j], ry, r.where, tx0, tx1) }));
  });
  // A box's shelf goes between its upper and its lower things.
  const ups = rows.filter((r) => r.z === 'upper'), lows = rows.filter((r) => r.z === 'lower'), lastUp = ups[ups.length - 1];
  const divider = box && ups.length && lows.length ? (pos.get(lastUp) + boxBottom(lastUp) + pos.get(lows[0]) + boxTop(lows[0])) / 2 : null;
  // Lines of the setting that names keep off where they can: the surface, the seabed, and the walls of a box.
  const soft = [rect(BX0, LY - 10, BX1, LY + 10)];
  if (sea) soft.push(rect(BX0, SB - 12, BX1, SB + 12));
  if (box) soft.push(rect(BX0, bottom - WALL - 4, BX1, bottom + 4), rect(BX0 - 4, LY, BX0 + WALL + 4, bottom), rect(BX1 - WALL - 4, LY, BX1 + 4, bottom));
  return { s: plan.s, spots, BX0, BX1, LY, SB, bottom, WALL, gutter, layerFits, plate, soft, divider, bounds: rect(BX0 + 8, TOP, BX1 - 8, box ? bottom : BOTTOM) };
}

// The ground: a strip of sky, the surface and two to four layers of soil and rock, each wiped in from the left, with
// the layers' names beside them.
function groundStage(U, th, id, P, layers) {
  const { BX0, BX1, LY, SB } = P, n = layers.length, ys = Array.from({ length: n + 1 }, (_, k) => LY + ((SB - LY) * k) / n);
  const soil = n === 2 ? [SOIL[0], SOIL[2]] : n === 3 ? [SOIL[0], SOIL[1], SOIL[3]] : SOIL;
  let o = `<rect x="${f1(BX0)}" y="${TOP}" width="${f1(BX1 - BX0)}" height="${f1(LY - TOP)}" fill="${SKY}" fill-opacity=".16" opacity="0"${U.A('fade', 0, 0.06)}/>`;
  for (let k = 0; k < n; k++) {
    const top = k === 0 ? [[BX0, LY], [BX1, LY]] : wave(BX0, BX1, ys[k], 7, 110, k * 1.7);
    const bot = k === n - 1 ? [[BX1, SB], [BX0, SB]] : wave(BX0, BX1, ys[k + 1], 7, 110, (k + 1) * 1.7).reverse();
    o += clipWipe(U, id + 'w' + k, BX0, ys[k] - 14, BX1, ys[k + 1] + 14, 0.01 + k * 0.025,
      `<path d="${line(top.concat(bot))}Z" fill="${soil[k]}"${edge(th)}/>` + (k === 0 ? `<path d="M${f1(BX0)} ${f1(LY - 5)}H${f1(BX1)}V${f1(LY + 8)}H${f1(BX0)}Z" fill="${GRASS}"${edge(th)}/>` : ''));
  }
  return o + layerNames(U, th, P, ys);
}

// The sea: a strip of sky, the water from its surface down in two to four bands, and the seabed.
function seaStage(U, th, id, P, layers) {
  const { BX0, BX1, LY, SB, bottom } = P, n = layers.length, ys = Array.from({ length: n + 1 }, (_, k) => LY + ((SB - LY) * k) / n);
  const water = n === 2 ? [WATER[0], WATER[2]] : n === 3 ? [WATER[0], WATER[1], WATER[3]] : WATER;
  const surf = wave(BX0, BX1, LY, 7, 46, 0, 10), bed = wave(BX0, BX1, SB, 9, 80, 1.1, 12);
  let o = `<rect x="${f1(BX0)}" y="${TOP}" width="${f1(BX1 - BX0)}" height="${f1(LY - TOP)}" fill="${SKY}" fill-opacity=".16" opacity="0"${U.A('fade', 0, 0.06)}/>`;
  for (let k = 0; k < n; k++) {
    const top = k === 0 ? surf : [[BX0, ys[k]], [BX1, ys[k]]];
    const bot = k === n - 1 ? bed.slice().reverse() : [[BX1, ys[k + 1]], [BX0, ys[k + 1]]];
    o += clipWipe(U, id + 'w' + k, BX0, ys[k] - 14, BX1, ys[k + 1] + 14, 0.01 + k * 0.025, `<path d="${line(top.concat(bot))}Z" fill="${water[k]}"${edge(th)}/>` +
      (k === 0 ? `<path d="${line(surf)}" fill="none" stroke="${FOAM}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>` : ''));
  }
  o += clipWipe(U, id + 'wb', BX0, SB - 14, BX1, bottom + 2, 0.01 + n * 0.025, `<path d="${line(bed.concat([[BX1, bottom], [BX0, bottom]]))}Z" fill="${SAND}"${edge(th)}/>` +
    `<path d="${line(wave(BX0 + 60, BX1 - 60, SB + (bottom - SB) * 0.55, 4, 40, 0.6, 12))}" fill="none" stroke="${SAND_LINE}" stroke-width="3" stroke-dasharray="26 34" stroke-linecap="round"/>`);
  return o + layerNames(U, th, P, ys);
}

// A group shown through a box that wipes open from the left.
const clipWipe = (U, cid, x0, y0, x1, y1, at, inner) =>
  `<defs><clipPath id="${cid}"><rect x="${f1(x0 - 2)}" y="${f1(y0)}" width="${f1(x1 - x0 + 4)}" height="${f1(y1 - y0)}"${U.A('wipe', at, 0.09, { w: f1(x1 - x0 + 4) })}/></clipPath></defs><g clip-path="url(#${cid})">${inner}</g>`;

// The layers' names in the column left of the block, each at the middle of its layer with a tick to it.
function layerNames(U, th, P, ys) {
  let o = '';
  P.layerFits.forEach((fit, k) => {
    if (!fit) return;
    const y = (ys[k] + ys[k + 1]) / 2 + (k === 0 ? 4 : 0);
    o += `<g opacity="0"${U.A('fade', 0.07 + k * 0.025, 0.06)}><path d="M${f1(P.BX0 - 16)} ${f1(y)}H${f1(P.BX0 + 14)}" stroke="${th.ink}" stroke-width="3" stroke-linecap="round"/>${textLines(U, P.BX0 - 26, y, fit, { a: 'end', f: th.ink })}</g>`;
  });
  return o;
}

// The box: a casing cut open to show its inside, its walls hatched where they are cut, with a dashed shelf between the
// upper and the lower part when both hold things, and its name under it.
function boxStage(U, th, id, P) {
  const { BX0, BX1, LY, bottom, WALL } = P, top = LY, W = BX1 - BX0, H = bottom - top, ink = outlineOf(th);
  const walls = `M${f1(BX0)} ${f1(top)}H${f1(BX1)}V${f1(bottom)}H${f1(BX0)}Z M${f1(BX0 + WALL)} ${f1(top + WALL)}V${f1(bottom - WALL)}H${f1(BX1 - WALL)}V${f1(top + WALL)}Z`;
  let hatch = '';
  for (let x = BX0 - H; x < BX1; x += 18) hatch += `M${f1(x)} ${f1(bottom)}L${f1(x + H)} ${f1(top)}`;
  let o = `<defs><clipPath id="${id}wall"><path d="${walls}" clip-rule="evenodd"/></clipPath></defs><g${U.A('up', 0, 0.08)}>` +
    `<rect x="${f1(BX0 + WALL)}" y="${f1(top + WALL)}" width="${f1(W - 2 * WALL)}" height="${f1(H - 2 * WALL)}" fill="${th.surface}" fill-opacity=".5"/>` +
    `<path d="${walls}" fill="${th.surface}" fill-rule="evenodd"/><g clip-path="url(#${id}wall)"><path d="${hatch}" stroke="${th.muted}" stroke-opacity=".7" stroke-width="3"/></g>` +
    `<path d="${walls}" fill="none" stroke="${ink}" stroke-width="4" stroke-linejoin="round"/>`;
  if (P.divider) o += `<path d="M${f1(BX0 + WALL)} ${f1(P.divider)}H${f1(BX1 - WALL)}" stroke="${ink}" stroke-opacity=".55" stroke-width="4" stroke-dasharray="18 12"/>`;
  o += '</g>';
  if (P.plate) o += `<g${U.A('up', 0.06, 0.06)}>${textLines(U, (BX0 + BX1) / 2, bottom + 14 + P.plate.h / 2, P.plate, { fam: 'd', f: th.ink })}</g>`;
  return o;
}

// The body: a neutral figure from the front (head, neck, shoulders, arms, the body down to the hips), with no face and
// nothing that tells gender, drawn in the look's panel color. Its zones are the head, the chest and the belly.
function figure(cx, top, H) {
  const r = 0.12 * H, hy = top + r, nk = 0.36 * r, sh = top + 2 * r + 0.035 * H, T = 0.3 * H, aw = 0.085 * H, bottom = top + H;
  const torso = `M${f1(cx - nk)} ${f1(hy + 0.7 * r)}V${f1(sh)}C${f1(cx - nk - 0.3 * T)} ${f1(sh + 0.005 * H)} ${f1(cx - T)} ${f1(sh)} ${f1(cx - T)} ${f1(sh + 0.1 * H)}` +
    `L${f1(cx - 0.87 * T)} ${f1(top + 0.7 * H)}L${f1(cx - 0.93 * T)} ${f1(bottom)}H${f1(cx + 0.93 * T)}L${f1(cx + 0.87 * T)} ${f1(top + 0.7 * H)}L${f1(cx + T)} ${f1(sh + 0.1 * H)}` +
    `C${f1(cx + T)} ${f1(sh)} ${f1(cx + nk + 0.3 * T)} ${f1(sh + 0.005 * H)} ${f1(cx + nk)} ${f1(sh)}V${f1(hy + 0.7 * r)}Z`;
  const arm = (sg) => `M${f1(cx + sg * (T + 0.022 * H + aw / 2))} ${f1(sh + 0.1 * H)}L${f1(cx + sg * (T + 0.05 * H + aw / 2))} ${f1(top + 0.86 * H)}`;
  return {
    r, hy, T, aw, sh, bottom, torso, arms: [arm(-1), arm(1)], outer: T + 0.05 * H + aw,
    zones: { surface: { y0: hy - 0.62 * r, y1: hy + 0.62 * r, half: 0.48 * r }, upper: { y0: sh + 0.045 * H, y1: top + 0.6 * H, half: 0.56 * T }, lower: { y0: top + 0.6 * H, y1: bottom - 0.03 * H, half: 0.54 * T } },
  };
}

// Whether the line from a to b passes through any of the circles.
const blocked = (a, b, circles) => circles.some((o) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1, t = clamp(((o.x - a[0]) * dx + (o.y - a[1]) * dy) / L2, 0, 1);
  return Math.hypot(a[0] + t * dx - o.x, a[1] + t * dy - o.y) < o.r;
});

// The body's plan: the things inside the figure by zone and side, a thing above the head over it. The names of things
// on the left and right go in a column beside the figure, with lines to them, like an anatomy chart; a thing in the
// middle of the chest or belly has its name on a tag under it.
function planBody(U, th, inp) {
  const { items } = inp, cx = 960, by = (z) => items.filter((it) => it.zone === z);
  const sky = by('sky').slice().sort((a, b) => SIDE_RANK[a.side] - SIDE_RANK[b.side] || a.k - b.k);
  const tagH = 62; // a one-line tag and the gap above it
  let plan = null;
  // Things above the head on the left or right float beside it, over the shoulders; only one in the middle needs a
  // band of its own over the head.
  const overHead = sky.some((it) => it.side === 'center');
  for (const s0 of [140, 128, 118, 108, 98, 90, 82]) {
    const skyB = overHead ? s0 + 40 : 0, top = TOP + skyB, H = ROOM - skyB, F = figure(cx, top, H), spots = [];
    let ok = true;
    // The chest and the belly share the body under the shoulders. Each keeps its own part when both hold things (the
    // fuller one a little more), and a crowded one takes the whole body when the other is empty.
    const T0 = F.zones.upper.y0, T1 = F.zones.lower.y1, load = (z) => Math.max(0, ...SIDES.map((sd) => by(z).filter((it) => it.side === sd).length));
    const lc = load('upper'), lb = load('lower');
    let split = T0 + (T1 - T0) * 0.43;
    if (lc && lb) split = T0 + (T1 - T0) * clamp(0.43 + ((lc - lb) / (lc + lb)) * 0.25, 0.3, 0.62);
    else if (lc > 1) split = T1;
    else if (lb > 1) split = T0;
    const zones = { surface: F.zones.surface, upper: { ...F.zones.upper, y1: split }, lower: { ...F.zones.lower, y0: split } };
    ['surface', 'upper', 'lower'].forEach((z) => {
      const Zr = zones[z], list = by(z), zh = Zr.y1 - Zr.y0;
      if (!list.length) return;
      const g = { left: [], center: [], right: [] };
      list.forEach((it) => g[it.side].push(it));
      const cols = SIDES.filter((sd) => g[sd].length), wide = !g.center.length && cols.length === 2 ? 1.2 : 1;
      const xOf = (sd) => cx + (sd === 'left' ? -1 : sd === 'right' ? 1 : 0) * Zr.half * wide;
      let s = s0;
      for (let i = 1; i < cols.length; i++) s = Math.min(s, xOf(cols[i]) - xOf(cols[i - 1]) - 14);
      if (z === 'surface') s = Math.min(s, list.length > 1 ? 0.62 * F.r : 0.95 * F.r);
      // A single thing in the middle of the chest or belly has its name on a tag under it; several share the columns.
      const tags = z !== 'surface' && g.center.length < 2, room = (it) => (tags && it.side === 'center' && it.label ? tagH : 0);
      SIDES.forEach((sd) => { if (g[sd].length) s = Math.min(s, (zh - g[sd].reduce((a, it) => a + room(it), 0)) / g[sd].length - 12); });
      if (s < 50) ok = false;
      s = Math.max(s, 40);
      const single = cols.every((sd) => g[sd].length === 1);
      if (z === 'surface' && g.center.length && cols.length > 1) {
        // In the head, a thing in the middle sits under the things at the sides, so its line out passes below them.
        cols.forEach((sd) => g[sd].forEach((it, j) => spots.push({ u: { it, s, noTag: true }, x: xOf(sd), y: Zr.y0 + zh * (sd === 'center' ? 0.78 : 0.24) + j * (s + 8) })));
      } else if (single) {
        // One thing per side: all on one line, with room under it for a tag in the middle.
        const need = s + Math.max(0, ...list.map(room)), y = Zr.y0 + (zh - need) / 2 + s / 2;
        list.forEach((it) => spots.push({ u: { it, s, noTag: !tags }, x: xOf(it.side), y }));
      } else {
        cols.forEach((sd) => {
          const stack = g[sd], hs = stack.map((it) => s + room(it)), gap = (zh - hs.reduce((a, h) => a + h, 0)) / (stack.length + 1);
          let y = Zr.y0 + gap;
          stack.forEach((it, j) => { spots.push({ u: { it, s, noTag: !tags }, x: xOf(sd), y: y + s / 2 }); y += hs[j] + gap; });
        });
      }
    });
    if (overHead) {
      const xs = packRow(sky.map((it) => ({ w: s0 + 40, want: cx + (it.side === 'left' ? -2.4 : it.side === 'right' ? 2.4 : 0) * F.r })), cx - 5 * F.r, cx + 5 * F.r, 30);
      sky.forEach((it, j) => spots.push({ u: { it, s: s0 }, x: xs[j], y: TOP + skyB / 2 - 4 }));
    } else {
      ['left', 'right'].forEach((sd) => sky.filter((it) => it.side === sd).forEach((it, j) => {
        const sg = sd === 'left' ? -1 : 1, s = Math.min(s0, 0.2 * H);
        spots.push({ u: { it, s }, x: cx + sg * (F.r + 44 + s / 2 + j * (s + 24)), y: top + s / 2 + 2 });
      }));
    }
    plan = { F, top, H, spots };
    if (ok) break;
  }
  const { F, spots } = plan, icons = spots.map((sp) => ({ x: sp.x, y: sp.y, r: sp.u.s * 0.46 + 6 }));
  const colX = { left: cx - F.outer - 40, right: cx + F.outer + 40 };
  const out = { left: [], right: [] };
  spots.forEach((sp, i) => {
    const it = sp.u.it;
    sp.u.mode = 'tag';
    if (!it.label) return;
    sp.u.fit = fitText(U, U.lab(it.label), 360);
    const t = tagSize(sp.u.fit);
    sp.u.tw = t.w;
    sp.u.th = t.h;
    if (it.side !== 'center') { out[it.side].push(i); return; }
    // A thing in the middle of the chest or belly: a tag under it, when that is clear.
    const others = icons.filter((_, j) => j !== i), below = tagFor(sp.u, sp.x, sp.y, 'below', 0, 1920);
    if (!sp.u.noTag && it.zone !== 'surface' && it.zone !== 'sky' && !others.some((o) => hits(below, o, 4))) { sp.box = below; return; }
    // Otherwise out at the side with fewer names whose line does not cross another thing; when both lines would, the
    // line first goes down (or up) into the gap between the rows of things and then out, like a bent leader on a chart.
    const sides = out.left.length <= out.right.length ? ['left', 'right'] : ['right', 'left'];
    const straight = sides.find((sd) => !blocked([sp.x, sp.y], [colX[sd], sp.y], others));
    if (straight) { out[straight].push(i); return; }
    const reach = sp.u.s * 0.5 + 24;
    for (const k of [1, -1, 1.7, -1.7]) {
      const yc = sp.y + k * reach, sd = sides.find((d) => !blocked([sp.x, yc], [colX[d], yc], others) && !blocked([sp.x, sp.y + Math.sign(k) * sp.u.s * 0.5], [sp.x, yc], others));
      if (sd && yc > TOP && yc < BOTTOM) { sp.elbow = yc; out[sd].push(i); return; }
    }
    out[sides[0]].push(i);
  });
  // Each column of names, packed so none overlaps, in the order of the things.
  ['left', 'right'].forEach((side) => {
    const want = (i) => spots[i].elbow ?? spots[i].y, list = out[side].slice().sort((a, b) => want(a) - want(b));
    if (!list.length) return;
    const ys = packRow(list.map((i) => ({ w: spots[i].u.fit.h, want: want(i) })), TOP, BOTTOM, 16);
    list.forEach((i, j) => {
      const sp = spots[i], x = colX[side], y = ys[j], w = sp.u.fit.w, h = sp.u.fit.h;
      sp.text = { x, y, a: side === 'left' ? 'end' : 'start' };
      sp.box = side === 'left' ? rect(x - w, y - h / 2, x, y + h / 2) : rect(x, y - h / 2, x + w, y + h / 2);
      const end = [x + (side === 'left' ? 14 : -14), y], dx = end[0] - sp.x, dy = end[1] - sp.y, d = Math.hypot(dx, dy) || 1, rr = sp.u.s * 0.46 + 4;
      sp.leader = sp.elbow != null ? [[sp.x, sp.y + Math.sign(y - sp.y) * rr], [sp.x, y], end] : [[sp.x + (dx / d) * rr, sp.y + (dy / d) * rr], end];
    });
  });
  // The leaders, as lines the flows and their names keep off.
  const lines = spots.filter((sp) => sp.leader).map((sp) => sp.leader.slice(1).flatMap((b, j) => {
    const a = sp.leader[j];
    return Array.from({ length: 9 }, (_, i) => [a[0] + ((b[0] - a[0]) * i) / 8, a[1] + ((b[1] - a[1]) * i) / 8]);
  }));
  return { spots, F, cx, soft: [], lines, bounds: rect(cx - F.outer - 30, TOP, cx + F.outer + 30, BOTTOM) };
}

function bodyStage(U, th, P) {
  const { F } = P, ink = outlineOf(th), fill = th.surface;
  const armStroke = (w, col) => F.arms.map((d) => `<path d="${d}" stroke="${col}" stroke-width="${f1(w)}" stroke-linecap="round" fill="none"/>`).join('');
  return `<g${U.A('up', 0, 0.08)}>${armStroke(F.aw + 8, ink)}${armStroke(F.aw, fill)}` +
    `<path d="${F.torso}" fill="${fill}" stroke="${ink}" stroke-width="4" stroke-linejoin="round"/>` +
    `<circle cx="${f1(P.cx)}" cy="${f1(F.hy)}" r="${f1(F.r)}" fill="${fill}" stroke="${ink}" stroke-width="4"/></g>`;
}

function cutawayPlan(p, c) {
  const { U, th } = c, inp = cutawayInput(p);
  const P = inp.setting === 'body' ? planBody(U, th, inp) : planBands(U, th, inp);
  // Each spot: its thing, where it is, its icon's radius, and when it comes in.
  P.spots.forEach((sp) => { sp.r = sp.u.s * 0.46; sp.at = sp.u.it.at; });
  const spots = P.spots.slice().sort((a, b) => a.u.it.k - b.u.it.k);
  const boxes = spots.filter((sp) => sp.box).map((sp) => sp.box);
  const flows = planFlows(U, inp.flows, spots, boxes, P.bounds, P.soft, P.lines || []);
  return { inp, P, spots, flows };
}

function cutawayBuild(p, c) {
  const { U, th } = c, id = c.id, { inp, P, spots, flows } = cutawayPlan(p, c);
  let o = inp.setting === 'ground' ? groundStage(U, th, id, P, inp.layers) : inp.setting === 'sea' ? seaStage(U, th, id, P, inp.layers) : inp.setting === 'box' ? boxStage(U, th, id, P) : bodyStage(U, th, P);
  flows.forEach((r, k) => { o += flowMarkup(U, th, id, r, k); });
  // Each thing pops in as the narration names it, in the highlight for a moment, then settles in ink. Its name
  // comes in beside it.
  spots.forEach((sp) => {
    const { u, x, y, at } = sp;
    o += `<g${U.A('pop', at, 0.05, { cx: f1(x), cy: f1(y) })}>${U.icon(u.it.icon, x, y, u.s, th.ink)}<g${U.A('dim', at + 0.07, 0.12, { to: 0 })}>${U.icon(u.it.icon, x, y, u.s, th.accent)}</g></g>`;
    if (!sp.box) return;
    if (sp.text) {
      const d = line(sp.leader);
      o += `<g opacity="0"${U.A('fade', at + 0.03, 0.05)} fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="${d}" stroke="${th.bg}" stroke-width="9"/><path d="${d}" stroke="${th.ink}" stroke-width="3"/>` +
        `${textLines(U, sp.text.x, sp.text.y, u.fit, { a: sp.text.a, f: th.ink, halo: 8 })}</g>`;
    } else o += `<g${sp.box.y1 > BOTTOM - 40 ? ` opacity="0"${U.A('fade', at + 0.03, 0.05)}` : U.A('up', at + 0.03, 0.06)}>${tag(U, th, sp.box, u.fit)}</g>`;
  });
  flows.forEach((r) => { o += flowLabelMarkup(U, th, r); });
  return o;
}

register('cutaway', {
  cat: CAT, title: 'Cutaway',
  desc: 'A cross-section of a place, drawn by the code: the ground in layers under a strip of sky, the sea from its surface down to the seabed, a person’s body from the front, or a casing cut open. The things the narration names pop in where it says they are, each as an icon with its name, and dots keep flowing between the things that it says move from one to another, along routes that steer clear of everything else.',
  use: 'What is where inside something, and what moves between its parts: groundwater and wells, roots in the soil, an oil well or a mine, organs in the body, the parts inside a machine or a house, life at different depths of the sea.',
  params: 'setting: ground|sea|body|box; layers (ground and sea only, optional): [{label?}] 2 to 4 from the top down (for the sea, the water’s depth zones; the seabed is always drawn under them); boxLabel (box only, optional): what the box is; items: [{icon, label?, zone: sky|surface|upper|lower, side: left|center|right}] 2 to 6, where zone means for ground: in the air, standing on the ground, underground near the surface, deep underground; sea: above the water, on the water, in the water, near the seabed; body: above the head, the head, the chest, the belly; box: above it, on top of it, inside near the top, inside near the bottom; flows: [{from, to, label?}] 0 to 4, item indices, dots move from item from to item to. Labels 1 to 4 words from the narration. Items come in at times (one per item, set by the code).',
  example: {
    setting: 'ground',
    layers: [{ label: 'Soil' }, { label: 'Sand and gravel' }, { label: 'Aquifer' }],
    items: [
      { icon: 'cloud', label: 'Rain', zone: 'sky', side: 'left' },
      { icon: 'house', label: 'Farm', zone: 'surface', side: 'right' },
      { icon: 'drop', label: 'Groundwater', zone: 'lower', side: 'center' },
      { icon: 'gear', label: 'Pump', zone: 'upper', side: 'right' },
    ],
    flows: [{ from: 0, to: 2, label: 'Seeps down' }, { from: 2, to: 3 }, { from: 3, to: 1, label: 'Pumped up' }],
  },
  build: cutawayBuild,
  init(g, p, c) {
    const { flows } = cutawayPlan(p, c);
    return { flows: flows.map((r, k) => ({ at: r.at, tr: r.tr, dots: Array.from({ length: Math.max(2, Math.ceil(r.tr.len / DOT_GAP)) }, (_, i) => g.querySelector(`#${c.id}f${k}d${i}`)) })) };
  },
  render(l, st) { moveDots(l, st.flows); },
});

/* ---------------------------------------------------------------------------------------------------------------
 * journey: something travelling along a track through stations, and changing on the way
 * ------------------------------------------------------------------------------------------------------------- */

// When the traveller reaches each station (times, from TemplateScene, counted by the stations' places in the params,
// or spread over the scene), kept in order and far enough apart for it to travel, and when it leaves: it stays a
// while, then sets off so it arrives on time.
function journeyTimes(p, src) {
  const t = [], N = src.length;
  for (let k = 0; k < N; k++) {
    const v = Array.isArray(p.times) ? Number(p.times[src[k]]) : NaN;
    t.push(Number.isFinite(v) ? v : 0.16 + (N > 1 ? (0.7 * k) / (N - 1) : 0.3));
  }
  if (!N) return { t, d: [] };
  t[0] = clamp(t[0], 0.12, 0.88);
  for (let k = 1; k < N; k++) t[k] = Math.max(t[k], t[k - 1] + 0.05);
  if (t[N - 1] > 0.9) { const a = t[0], k = (0.9 - a) / (t[N - 1] - a || 1); for (let i = 1; i < N; i++) t[i] = a + (t[i] - a) * k; }
  const d = t.map((tk, k) => (k < N - 1 ? tk + Math.min(0.1, 0.45 * (t[k + 1] - tk)) : tk + 0.07));
  return { t, d };
}

function journeyPlan(p, c) {
  const { U } = c, raw = Array.isArray(p.stations) ? p.stations : [];
  const stations = raw.map((s, src) => ({ s, src })).filter(({ s }) => s && typeof s === 'object').slice(0, 6)
    .map(({ s, src }) => ({ src, icon: iconOf(s.icon), label: say(s.label), becomes: typeof s.becomes === 'string' && s.becomes.trim() ? iconOf(s.becomes) : '' }));
  const tv = p.traveller && typeof p.traveller === 'object' ? p.traveller : {};
  const traveller = { icon: iconOf(tv.icon), label: say(tv.label) };
  const N = stations.length;
  // Up to four stations in a straight row; five or six along a gentle arc, which gives the names more room.
  const R = [122, 122, 116, 104, 86, 78][clamp(N, 1, 6) - 1], rT = N <= 3 ? 70 : N === 4 ? 64 : 54, arc = N >= 5 ? 74 : 0;
  const stub = 2 * rT + 46, tail = 34;
  const gap = N > 1 ? Math.min([0, 760, 600, 470][N - 1] || 1e9, (1760 - stub - tail) / (N - 1)) : 0;
  const first = 960 - ((N - 1) * gap + stub + tail) / 2 + stub, xs = stations.map((_, k) => first + k * gap);
  const fits = stations.map((s) => (s.label ? fitText(U, U.lab(s.label), N > 1 ? Math.min(420, gap - 30) : 420, N <= 4 ? [40, 38, 36, 34, 32, 30] : [36, 34, 32, 30]) : null));
  const labelH = Math.max(0, ...fits.map((f) => (f ? f.h : 0)));
  const tFit = traveller.label ? fitText(U, U.lab(traveller.label), 320, N <= 4 ? [36, 34, 32, 30] : [32, 30]) : null, tSize = tFit ? tagSize(tFit) : { w: 0, h: 0 };
  const lift = rT + 28; // from the track up to a station's disc
  const total = arc + (labelH ? labelH + 18 : 0) + 2 * R + lift + rT + (tFit ? 12 + tSize.h : 0);
  const low = TOP + (BOTTOM - TOP - total) / 2 + total - rT - (tFit ? 12 + tSize.h : 0); // the track's lowest point
  const x0 = first - stub, x1 = (N ? xs[N - 1] : first) + tail, mid = (x0 + x1) / 2, half = (x1 - x0) / 2;
  const yAt = (x) => low - arc * (1 - Math.pow((x - mid) / half, 2));
  const pts = [];
  for (let x = x0; x < x1; x += 10) pts.push([x, yAt(x)]);
  pts.push([x1, yAt(x1)]);
  const tr = track(pts);
  const sAt = (x) => { let i = 0; while (i < pts.length - 1 && pts[i + 1][0] < x) i++; return tr.cum[i] + (x - pts[i][0]) * ((tr.cum[i + 1] - tr.cum[i]) / (pts[i + 1][0] - pts[i][0] || 1)); };
  const { t, d } = journeyTimes(p, stations.map((st) => st.src));
  const S = stations.map((s, k) => ({ ...s, x: xs[k], jy: yAt(xs[k]), y: yAt(xs[k]) - lift - R, s: sAt(xs[k]), fit: fits[k], t: t[k], d: d[k] }));
  // The traveller comes in at the start of the track a moment before it sets off for the first station.
  const e0 = N ? clamp(t[0] - 0.14, 0.03, t[0] - 0.06) : 0.05;
  const keys = [[e0, 0], [e0 + 0.03, 0]];
  S.forEach((st, k) => { keys.push([st.t, st.s]); if (k < N - 1) keys.push([st.d, st.s]); });
  // Its forms: what it starts as, and what it turns into as it leaves a station that changes it.
  const forms = [{ icon: traveller.icon, at: 0 }];
  S.forEach((st) => { if (st.becomes && st.becomes !== forms[forms.length - 1].icon) forms.push({ icon: st.becomes, at: st.d }); });
  return { S, R, rT, tr, pts, keys, forms, traveller, tFit, tSize, e0 };
}

// How far along the track the traveller is at progress p: it eases from each stop to the next and waits at each.
function travellerAt(keys, p) {
  if (p <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [p0, s0] = keys[i - 1], [p1, s1] = keys[i];
    if (p < p1) return s0 === s1 ? s0 : s0 + (s1 - s0) * (p1 > p0 ? smooth((p - p0) / (p1 - p0)) : 1);
  }
  return keys[keys.length - 1][1];
}

function journeyBuild(p, c) {
  const { U, th } = c, id = c.id, J = journeyPlan(p, c), { S, R, rT, tr } = J;
  const d = line(J.pts), last = S.length - 1, disc = th.card ? th.card.fill : th.surface;
  // The track: a pipe that draws itself from the start, and the part travelled filling in the highlight behind the
  // traveller (set by render).
  let o = `<g opacity="0"${U.A('fade', 0, 0.004)}>` +
    `<path d="${d}" pathLength="1000" fill="none" stroke="${th.muted}" stroke-width="26" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="1000 1010" stroke-dashoffset="1000"${U.A('draw', 0, 0.1, { l: 1000 })}/>` +
    `<path d="${d}" pathLength="1000" fill="none" stroke="${th.bg}" stroke-width="13" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="1000 1010" stroke-dashoffset="1000"${U.A('draw', 0, 0.1, { l: 1000 })}/></g>` +
    `<path id="${id}fill" d="${d}" pathLength="1000" fill="none" stroke="${th.accent}" stroke-width="13" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="1000 1010" stroke-dashoffset="1000"/>`;
  // Each station: its stop on the track, a stem up to its disc with its icon, and its name above. Upcoming stations
  // are dim; the one the traveller has reached lights up in the highlight, and the ones it has left stay in ink. Each
  // look is a layer over the dim one, shown in turn; the disc swells a little when it is reached (see render).
  const stem = (st, ring) => `<path d="M${f1(st.x)} ${f1(st.jy - 13)}V${f1(st.y + R)}" stroke="${ring}" stroke-width="6" stroke-linecap="round"/>` +
    `<circle cx="${f1(st.x)}" cy="${f1(st.jy)}" r="15" fill="${th.bg}" stroke="${ring}" stroke-width="6"/>`;
  const face = (st, ring, iconCol, textCol) => `<circle cx="${f1(st.x)}" cy="${f1(st.y)}" r="${R}" fill="${disc}" stroke="${ring}" stroke-width="6"/>${U.icon(st.icon, st.x, st.y, R * 1.12, iconCol)}` +
    (st.fit ? textLines(U, st.x, st.y - R - 18 - st.fit.h / 2, st.fit, { f: textCol }) : '');
  S.forEach((st, k) => {
    const layers = (part) => `<g opacity=".45">${part(th.line, th.muted, th.muted)}</g>` +
      `<g opacity="0"${U.A('fade', st.t, 0.03)}><g${k < last ? U.A('dim', st.d, 0.04, { to: 0 }) : ''}>${part(th.accent, th.accent, th.ink)}</g></g>` +
      (k < last ? `<g opacity="0"${U.A('fade', st.d, 0.04)}>${part(th.ink, th.ink, th.ink)}</g>` : '');
    o += `<g${U.A('pop', 0.03 + k * 0.025, 0.05, { cx: f1(st.x), cy: f1(st.y) })}>${layers((ring) => stem(st, ring))}` +
      `<g id="${id}s${k}">${layers((ring, iconCol, textCol) => face(st, ring, iconCol, textCol))}</g></g>`;
  });
  // The traveller: its icon in a ring, which changes as it leaves a station that changes it, and its name under it
  // until its first change, since the name says what it was.
  const start = pointAt(tr, 0);
  let forms = '';
  J.forms.forEach((f, j) => {
    const next = J.forms[j + 1], icon = U.icon(f.icon, 0, 0, rT * 1.25, th.accent);
    const shown = next ? `<g${U.A('dim', next.at, 0.03, { to: 0 })}>${icon}</g>` : icon;
    forms += j ? `<g opacity="0"${U.A('fade', f.at, 0.03)}>${shown}</g>` : shown;
  });
  const changeAt = J.forms[1] ? J.forms[1].at : null;
  const nameTag = J.tFit ? `<g${changeAt != null ? U.A('dim', changeAt, 0.03, { to: 0 }) : ''}>${tag(U, th, rect(-J.tSize.w / 2, rT + 12, J.tSize.w / 2, rT + 12 + J.tSize.h), J.tFit)}</g>` : '';
  o += `<g id="${id}trav" transform="translate(${f1(start.x)} ${f1(start.y)})"><g${U.A('pop', J.e0, 0.05, { cx: 0, cy: 0 })}>` +
    `<g id="${id}ring"><circle r="${rT}" fill="${th.bg}" stroke="${th.accent}" stroke-width="7"/>${forms}</g>${nameTag}</g></g>`;
  return o;
}

register('journey', {
  cat: CAT, title: 'Journey',
  desc: 'Something travelling along a track through stations in order, drawn by the code: up to four stations in a row, five or six along a gentle arc. The traveller, an icon in a ring with its name, moves from station to station and waits at each; a station lights up when it is reached and stays inked once left, and upcoming ones are dim. As it leaves a station that changes it, the traveller turns into something else.',
  use: 'One thing moving through stages in order and changing on the way: food through the gut, electricity from a power plant to a home, a data packet through the internet, a bill through parliament, water through a treatment plant.',
  params: 'traveller: {icon, label?}; stations: [{icon, label, becomes?}] 2 to 6 in order, where becomes is an icon name the traveller turns into as it leaves that station (its own name then goes, since it named what it was). Labels 1 to 4 words from the narration. The traveller reaches each station at times (one per station, set by the code).',
  example: {
    traveller: { icon: 'lightning', label: 'Electricity' },
    stations: [{ icon: 'factory', label: 'Power plant' }, { icon: 'tower', label: 'Power lines' }, { icon: 'gear', label: 'Substation' }, { icon: 'house', label: 'Homes', becomes: 'bulb' }],
  },
  build: journeyBuild,
  init(g, p, c) {
    const J = journeyPlan(p, c), q = (s) => g.querySelector('#' + c.id + s);
    return { J, trav: q('trav'), ring: q('ring'), fill: q('fill'), st: J.S.map((_, k) => q('s' + k)) };
  },
  render(l, st) {
    const { J } = st, s = travellerAt(J.keys, l.p), pt = pointAt(J.tr, s);
    if (st.trav) st.trav.setAttribute('transform', `translate(${f1(pt.x)} ${f1(pt.y)})`);
    if (st.fill) st.fill.setAttribute('stroke-dashoffset', l.p > J.e0 + 0.03 ? f1(1000 * (1 - s / J.tr.len)) : '1000');
    // A station swells a little as it is reached, and the ring as the traveller changes.
    J.S.forEach((sta, k) => {
      const el = st.st[k];
      if (!el) return;
      const k1 = 1 + 0.08 * bump((l.p - sta.t) / 0.07);
      el.setAttribute('transform', `translate(${f1(sta.x)} ${f1(sta.y)}) scale(${k1.toFixed(4)}) translate(${f1(-sta.x)} ${f1(-sta.y)})`);
    });
    if (st.ring) {
      const k2 = 1 + 0.16 * J.forms.slice(1).reduce((a, f) => a + bump((l.p - f.at + 0.01) / 0.06), 0);
      st.ring.setAttribute('transform', `scale(${k2.toFixed(4)})`);
    }
  },
});
