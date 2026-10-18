// Animated diagrams of how things work (physics), drawn for Meko in the film engine's style. See ../engine.js for how
// templates work. Every visible word comes from the params; a part without a label in the params is drawn unlabeled.
// The drawings hold no numbers, names or other facts of their own: they show how a thing works, and the narration
// says the rest. Signs like plus and minus are drawn shapes, not text.
import { register } from "../engine.js";

const CAT = 'Diagrams';

// Physical things keep their natural colors in every look, chosen to read on the dark grounds (Night atlas,
// Blueprint) and on the light page (Field guide) alike.
const SUN = '#F5B52E'; // the sun and sunlight
const GLOW = '#FFD34D'; // the glow of a lit bulb or window
const GLOW_EDGE = '#B07D0C'; // the edge of a lit bulb, so its glass keeps its shape on the light page
const FILAMENT = '#8A4B0F'; // a glowing filament, dark enough to show on the lit glass
const COPPER = '#C8743A'; // copper wire
const METAL = '#AEB6C1'; // metal contacts, terminals and sockets
const METAL_DARK = '#6B7480';
const SILICON_N = '#6F9BE6'; // a solar cell's thin top layer
const SILICON_P = '#3B5DA8'; // and the thick layer under it
const ANODE = '#6E7682'; // a battery's anode, graphite grey
const CATHODE = '#B0714A'; // a battery's cathode, a rust-brown metal oxide
const ELECTROLYTE = '#69C6B8'; // the electrolyte between them, drawn as a tint
const CHARGE = '#FFFFFF', PLUS = '#E0473A', MINUS = '#2F6FD8'; // charges: a red plus or a blue minus on a white disc
const PROTON = '#E2584A', NEUTRON = '#97A3B4'; // the particles in a nucleus
const FLASH = '#FFF3B8', FLASH_EDGE = '#5A4300'; // a flash of energy: pale yellow-white with a dark edge
const HOT = '#E8503A'; // hot coils
const HEAT = '#F28C38'; // heat on its way, drawn as wavy arrows
const COLD = '#3E9CF0'; // cold coils and cold air

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const smooth = (x) => { const q = clamp(x, 0, 1); return q * q * (3 - 2 * q); };
const span = (p, a, b) => clamp((p - a) / (b - a), 0, 1);
const easeOut = (x) => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
const f1 = (v) => (+v).toFixed(1);
// A label's text from the params: a non-empty string (or a number), otherwise nothing.
const say = (v) => (typeof v === 'string' ? v.trim() : typeof v === 'number' && Number.isFinite(v) ? String(v) : '');
const labelsOf = (p) => (p.labels && typeof p.labels === 'object' ? p.labels : {});
// A moment given in the params as a fraction of the scene (TemplateScene turns a spoken word into one), kept in range.
const moment = (v, fallback, lo, hi) => (typeof v === 'number' && Number.isFinite(v) ? clamp(v, lo, hi) : fallback);
const line = (P) => P.map(([x, y], i) => `${i ? 'L' : 'M'}${f1(x)} ${f1(y)}`).join('');
// The look's own edge on drawn shapes: chalk lines in Blueprint, ink in Field guide, none on Night atlas's flat shapes.
const edge = (th, w) => (th.card ? ` stroke="${th.card.stroke}" stroke-width="${w ?? th.card.width}" stroke-linejoin="round"` : '');
// The edge of small things like particles: the ground color on Night atlas, ink in the outlined looks.
const rim = (th) => (th.card ? th.ink : th.bg);

// A line through points, measured: its points, the distance to each along it, and its length.
function track(pts) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { pts, cum, len: cum[cum.length - 1] };
}
// The point at distance s along a measured line.
function pointAt(tr, s) {
  const d = clamp(s, 0, tr.len);
  let lo = 1, hi = tr.cum.length - 1;
  while (lo < hi) { const m = (lo + hi) >> 1; if (tr.cum[m] < d) lo = m + 1; else hi = m; }
  const a = tr.pts[lo - 1], b = tr.pts[lo], k = (d - tr.cum[lo - 1]) / (tr.cum[lo] - tr.cum[lo - 1] || 1);
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
}
// How far along a measured line its point nearest to (x, y) is.
function lengthNear(tr, x, y) {
  let best = 0, bd = Infinity;
  tr.pts.forEach((q, i) => { const d = Math.hypot(q[0] - x, q[1] - y); if (d < bd) { bd = d; best = i; } });
  return tr.cum[best];
}
// The points of a measured line between the distances s0 and s1 along it.
function stretch(tr, s0, s1) {
  const out = [pointAt(tr, s0)];
  tr.pts.forEach((q, i) => { if (tr.cum[i] > s0 && tr.cum[i] < s1) out.push(q); });
  out.push(pointAt(tr, s1));
  return out;
}
// A line through the corners `pts` with every corner rounded off at radius r, as dense points.
function rounded(pts, r) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i], [cx, cy] = pts[i + 1];
    const l1 = Math.hypot(bx - ax, by - ay), l2 = Math.hypot(cx - bx, cy - by), rr = Math.min(r, l1 / 2, l2 / 2);
    const p1 = [bx - ((bx - ax) / l1) * rr, by - ((by - ay) / l1) * rr], p2 = [bx + ((cx - bx) / l2) * rr, by + ((cy - by) / l2) * rr];
    for (let k = 0; k <= 8; k++) { const u = k / 8; out.push([(1 - u) * (1 - u) * p1[0] + 2 * (1 - u) * u * bx + u * u * p2[0], (1 - u) * (1 - u) * p1[1] + 2 * (1 - u) * u * by + u * u * p2[1]]); }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

// A stroke that draws itself along its path from `at` over `dur`, in a group of opacity `op`. pathLength makes the
// dash work without measuring the path, and the fade keeps a round cap from showing as a dot before it starts.
const drawn = (U, d, col, w, at, dur, op = 1) =>
  `<g opacity="${op}"><g opacity="0"${U.A('fade', at, 0.004)}><path d="${d}" pathLength="1000" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="1000 1010" stroke-dashoffset="1000"${U.A('draw', at, dur, { l: 1000 })}/></g></g>`;

// Points along a wave from a toward b, the wave easing in and out at both ends; it stops `cut` short of b to leave room
// for an arrowhead.
function wavePts(a, b, amp, wl, cut = 0) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L, end = L - cut, P = [];
  for (let s = 0; s < end; s += 5) { const e = Math.min(1, s / 22, (end - s) / 22), w = amp * e * Math.sin((2 * Math.PI * s) / wl); P.push([a[0] + ux * s - uy * w, a[1] + uy * s + ux * w]); }
  P.push([a[0] + ux * end, a[1] + uy * end]);
  return P;
}
// An arrowhead with its tip at b, pointing from a to b.
function head(a, b, col, size) {
  const g = Math.atan2(b[1] - a[1], b[0] - a[0]), c = Math.cos(g), s = Math.sin(g);
  return `<path d="M${f1(b[0] + c * 3)} ${f1(b[1] + s * 3)}L${f1(b[0] - size * c + size * 0.62 * s)} ${f1(b[1] - size * s - size * 0.62 * c)}L${f1(b[0] - size * c - size * 0.62 * s)} ${f1(b[1] - size * s + size * 0.62 * c)}Z" fill="${col}"/>`;
}
// A bold arrow from (x0, y0) to (x1, y1) in color col, growing from its tail at `at`, outlined in the ground color so
// it shows over lines.
function bigArrow(U, th, x0, y0, x1, y1, col, at, w = 26) {
  const len = Math.hypot(x1 - x0, y1 - y0), deg = (Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI, hw = w / 2, hh = w * 1.1, hl = w * 1.45;
  return `<g transform="translate(${f1(x0)} ${f1(y0)}) rotate(${f1(deg)})"><g${U.A('grow', at, 0.08, { ax: 'x', cx: 0, cy: 0 })}>` +
    `<path d="M0 ${-hw}H${f1(len - hl)}V${f1(-hh)}L${f1(len)} 0L${f1(len - hl)} ${f1(hh)}V${hw}H0Z" fill="${col}" stroke="${th.bg}" stroke-width="5" stroke-linejoin="round" paint-order="stroke"/></g></g>`;
}
// A charge drawn round 0 0: a white disc with a red plus or a blue minus, edged so it shows on the light page too.
const charge = (th, r, plus) => `<circle r="${r}" fill="${CHARGE}" stroke="${th.paperInk}" stroke-width="2.5"/>` +
  `<path d="M${f1(-r * 0.52)} 0H${f1(r * 0.52)}${plus ? `M0 ${f1(-r * 0.52)}V${f1(r * 0.52)}` : ''}" stroke="${plus ? PLUS : MINUS}" stroke-width="${f1(Math.max(3, r * 0.3))}" stroke-linecap="round"/>`;

// A label's words in at most two lines of maxW pixels at the biggest size that fits (38 or 34 px), or in up to three
// lines at 30 px (the last line takes all the words left, so none is lost). Two lines are split where they come out
// most even.
function fitText(U, text, maxW) {
  const words = String(text).trim().split(/\s+/), width = (t, s) => U.tw(t, s, { w: 700 });
  for (const s of [38, 34]) {
    if (width(words.join(' '), s) <= maxW) return { s, lines: [words.join(' ')] };
    let best = null;
    for (let i = 1; i < words.length; i++) {
      const lines = [words.slice(0, i).join(' '), words.slice(i).join(' ')], w = Math.max(width(lines[0], s), width(lines[1], s));
      if (w <= maxW && (!best || w < best.w)) best = { w, lines };
    }
    if (best) return { s, lines: best.lines };
  }
  const out = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? cur + ' ' + w : w;
    if (cur && width(next, 30) > maxW) { out.push(cur); cur = w; } else cur = next;
  }
  if (cur) out.push(cur);
  return { s: 30, lines: out.length > 3 ? [out[0], out[1], out.slice(2).join(' ')] : out };
}
// A name from the params set next to the point (x, y): 'left' ends the text there, 'right' starts it there, 'top' and
// 'bottom' center it above or below, and 'center' centers it on the point. Without text it draws nothing.
function nameLines(U, th, text, x, y, side, maxW = 330) {
  const t = say(text);
  if (!t) return '';
  const { s, lines } = fitText(U, U.lab(t), maxW), lh = Math.round(s * 1.15), n = lines.length;
  let a = 'middle', tx = x, y0;
  if (side === 'left' || side === 'right') { a = side === 'left' ? 'end' : 'start'; tx = side === 'left' ? x - 16 : x + 16; y0 = y - ((n - 1) * lh) / 2 + s * 0.35; }
  else if (side === 'top') y0 = y - 14 - s * 0.24 - (n - 1) * lh;
  else if (side === 'bottom') y0 = y + 14 + s * 0.74;
  else y0 = y - ((n - 1) * lh) / 2 + s * 0.35;
  return lines.map((l, i) => U.T(f1(tx), f1(y0 + i * lh), l, { a, s, w: 700, f: th.ink, halo: 8 })).join('');
}
// A name that fades in at `at`.
function nameText(U, th, text, x, y, side, at, maxW) {
  const t = nameLines(U, th, text, x, y, side, maxW);
  return t ? `<g opacity="0"${U.A('fade', at, 0.05)}>${t}</g>` : '';
}
// A part's name with a thin line from the part at `part` to the point (x, y), where the name is set (see nameLines).
function callout(U, th, text, part, side, x, y, at, maxW) {
  const t = nameLines(U, th, text, x, y, side, maxW);
  if (!t) return '';
  const d = `M${f1(part[0])} ${f1(part[1])}L${f1(x)} ${f1(y)}`;
  return `<g opacity="0"${U.A('fade', at, 0.05)}><path d="${d}" stroke="${th.bg}" stroke-width="9" stroke-linecap="round" fill="none"/>` +
    `<path d="${d}" stroke="${th.ink}" stroke-width="3" stroke-linecap="round" fill="none"/>` +
    `<circle cx="${f1(part[0])}" cy="${f1(part[1])}" r="7" fill="${th.ink}" stroke="${th.bg}" stroke-width="3"/>${t}</g>`;
}

// A light bulb with the middle of its glass at (cx, cy), standing in its socket. The glass, the filament and the glow
// around it light up in render (ids lit, fil and glow). Wires join the socket's sides at cy + 73, and its foot at
// cy + 106.
function bulbMarkup(th, id, cx, cy) {
  const glass = `M${cx - 24} ${cy + 50}C${cx - 24} ${cy + 38} ${cx - 56} ${cy + 22} ${cx - 56} ${cy - 6}A56 56 0 1 1 ${cx + 56} ${cy - 6}C${cx + 56} ${cy + 22} ${cx + 24} ${cy + 38} ${cx + 24} ${cy + 50}Z`;
  const coil = `M${cx - 12} ${cy + 50}V${cy + 4}L${cx - 8} ${cy - 8}L${cx - 4} ${cy + 4}L${cx} ${cy - 8}L${cx + 4} ${cy + 4}L${cx + 8} ${cy - 8}L${cx + 12} ${cy + 4}V${cy + 50}`;
  let rays = '';
  for (let k = 0; k < 9; k++) { const a = ((-200 + k * 27.5) * Math.PI) / 180; rays += `M${f1(cx + 76 * Math.cos(a))} ${f1(cy - 4 + 76 * Math.sin(a))}L${f1(cx + 102 * Math.cos(a))} ${f1(cy - 4 + 102 * Math.sin(a))}`; }
  return `<g id="${id}glow" opacity="0"><circle cx="${cx}" cy="${cy - 4}" r="70" fill="${GLOW}" opacity=".25"/><path d="${rays}" stroke="${GLOW}" stroke-width="8" stroke-linecap="round"/></g>` +
    `<path d="${glass}" fill="${th.bg}" stroke="${th.ink}" stroke-width="4" stroke-linejoin="round"/>` +
    `<path id="${id}lit" d="${glass}" fill="${GLOW}" stroke="${GLOW_EDGE}" stroke-width="4" stroke-linejoin="round" opacity="0"/>` +
    `<path d="${coil}" fill="none" stroke="${th.ink}" stroke-width="3.5" stroke-linejoin="round"/>` +
    `<path id="${id}fil" d="${coil}" fill="none" stroke="${FILAMENT}" stroke-width="3.5" stroke-linejoin="round" opacity="0"/>` +
    `<rect x="${cx - 28}" y="${cy + 50}" width="56" height="46" rx="6" fill="${METAL}" stroke="${th.ink}" stroke-width="3"/>` +
    `<path d="M${cx - 28} ${cy + 65}H${cx + 28}M${cx - 28} ${cy + 80}H${cx + 28}" stroke="${METAL_DARK}" stroke-width="3"/>` +
    `<rect x="${cx - 11}" y="${cy + 96}" width="22" height="10" rx="3" fill="${METAL_DARK}"/>`;
}
// A house standing on (cx, base), with a window that lights up in render (id win).
function houseMarkup(th, id, cx, base) {
  const wall = `M${cx - 92} ${base}V${base - 128}H${cx + 92}V${base}Z`, roof = `M${cx - 114} ${base - 126}L${cx} ${base - 222}L${cx + 114} ${base - 126}Z`;
  return `<path d="${wall}" fill="${th.surface}" stroke="${th.ink}" stroke-width="4" stroke-linejoin="round"/><path d="${roof}" fill="${th.surface}" stroke="${th.ink}" stroke-width="4" stroke-linejoin="round"/>` +
    `<rect x="${cx - 36}" y="${base - 100}" width="72" height="56" fill="${th.bg}" stroke="${th.ink}" stroke-width="3"/><rect id="${id}win" x="${cx - 34.5}" y="${base - 98.5}" width="69" height="53" fill="${GLOW}" opacity="0"/>` +
    `<path d="M${cx} ${base - 100}V${base - 44}M${cx - 36} ${base - 72}H${cx + 36}" stroke="${th.ink}" stroke-width="3"/>`;
}

/* ---------------------------------------------------------------------------------------------------------------
 * Airplane lift
 * ------------------------------------------------------------------------------------------------------------- */

// Complex numbers as [re, im], for the flow of air round the wing.
const cadd = (a, b) => [a[0] + b[0], a[1] + b[1]];
const csub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const cmul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const cdiv = (a, b) => { const d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; };
const cabs = (a) => Math.hypot(a[0], a[1]);
const cexp = (t) => [Math.cos(t), Math.sin(t)];
const csqrt = (a) => { const r = cabs(a); return [Math.sqrt(Math.max(0, (r + a[0]) / 2)), (a[1] < 0 ? -1 : 1) * Math.sqrt(Math.max(0, (r - a[0]) / 2))]; };

// The wing and the air round it, worked out once: the classic textbook wing shape (a Joukowski airfoil) tilted a
// little into the wind, and the flow of air round it as physics gives it (potential flow, with the circulation that
// lets the air leave the sharp back edge smoothly). The air over the top runs faster than the air underneath, so the
// streaks that ride on it pull ahead. Worked out in units where the wind speed is 1, drawn S pixels to a unit, with
// the wind blowing from left to right.
const WING = (() => {
  const mu = [-0.13, 0.08], R = Math.hypot(1 - mu[0], mu[1]), A = (5 * Math.PI) / 180, B = Math.atan2(mu[1], 1 - mu[0]);
  const g = 2 * R * Math.sin(A + B); // the circulation over 2 pi
  const ea = cexp(A), eb = cexp(-A), R2a = [R * R * ea[0], R * R * ea[1]];
  const S = 196, X0 = 960, Y0 = 492, XL = -4.1, XR = 4.25;
  const screen = (P) => [X0 + S * P[0], Y0 - S * P[1]];
  // From a point of the picture (in units, y up) to the circle the airfoil is made from, outside the circle.
  const zetaOf = (P) => {
    const z = cmul(P, ea), s = csqrt(csub(cmul(z, z), [4, 0])), a = [(z[0] + s[0]) / 2, (z[1] + s[1]) / 2], b = [(z[0] - s[0]) / 2, (z[1] - s[1]) / 2];
    return cabs(csub(a, mu)) >= cabs(csub(b, mu)) ? a : b;
  };
  // The air's velocity at a point, and its stream function, which stays the same along a streamline.
  const vel = (P) => {
    const zeta = zetaOf(P), d = csub(zeta, mu);
    const dw = cadd(csub(eb, cdiv(R2a, cmul(d, d))), cdiv([0, g], d));
    const W = cdiv(dw, csub([1, 0], cdiv([1, 0], cmul(zeta, zeta))));
    return cmul([W[0], -W[1]], eb);
  };
  const psi = (P) => { const d = csub(zetaOf(P), mu); return cmul(d, eb)[1] + cdiv(R2a, d)[1] + g * Math.log(cabs(d)); };
  // The outline, from the back edge over the top to the front edge and back underneath.
  const outline = [];
  for (let i = 0; i < 200; i++) {
    const t = -B + (2 * Math.PI * i) / 200, zeta = [mu[0] + R * Math.cos(t), mu[1] + R * Math.sin(t)];
    outline.push(screen(cmul(cadd(zeta, cdiv([1, 0], zeta)), eb)));
  }
  let le = 0;
  outline.forEach((q, i) => { if (q[0] < outline[le][0]) le = i; });
  const LE = outline[le], TE = outline[0], chord = TE[0] - LE[0];
  const upper = outline.slice(0, le + 1).reverse(), lower = outline.slice(le).concat([TE]);
  const yAt = (P, x) => {
    for (let i = 1; i < P.length; i++) if (P[i][0] >= x) { const a = P[i - 1], b = P[i], k = (x - a[0]) / (b[0] - a[0] || 1); return a[1] + (b[1] - a[1]) * k; }
    return P[P.length - 1][1];
  };
  // A streamline from the left edge, traced step by step along the flow, with the time the air takes to each point.
  const dir = (P) => { const v = vel(P), m = cabs(v) || 1; return [v[0] / m, v[1] / m]; };
  const trace = (y0) => {
    const pts = [], ts = [];
    let P = [XL, y0], t = 0;
    for (let i = 0; i < 1000 && P[0] <= XR; i++) {
      const q = screen(P), v = cabs(vel(P));
      if (pts.length) { const last = pts[pts.length - 1]; t += Math.hypot(q[0] - last[0], q[1] - last[1]) / S / ((v + last[2]) / 2); }
      pts.push([q[0], q[1], v]);
      ts.push(t);
      const h = 0.03, k1 = dir(P), k2 = dir([P[0] + (h / 2) * k1[0], P[1] + (h / 2) * k1[1]]), k3 = dir([P[0] + (h / 2) * k2[0], P[1] + (h / 2) * k2[1]]), k4 = dir([P[0] + h * k3[0], P[1] + h * k3[1]]);
      P = [P[0] + (h / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]), P[1] + (h / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1])];
    }
    return { pts, ts, total: t };
  };
  // Four streamlines over the wing and three under it, evenly spaced in the air they carry.
  const onWing = g * Math.log(R);
  const lines = [0.26, 0.6, 0.96, 1.34, -0.34, -0.74, -1.16].map((dpsi) => {
    let lo = -3.4, hi = 3.4;
    for (let k = 0; k < 48; k++) { const mid = (lo + hi) / 2; if (psi([XL, mid]) < onWing + dpsi) lo = mid; else hi = mid; }
    return trace((lo + hi) / 2);
  });
  // Quiet shading for the pressure: a band over the wing (lower pressure, strongest toward the front) and one under it
  // (higher pressure). Each closes along the wing's middle line, so the wing, drawn over it, hides its inner edge.
  const zone = (P, up, D, k) => {
    const out = [], back = [];
    for (let i = 0; i <= 48; i++) { const u = i / 48, x = LE[0] + u * chord, w = Math.pow(u, k); out.push([x, yAt(P, x) - up * D * 4 * w * (1 - w)]); back.push([x, (yAt(upper, x) + yAt(lower, x)) / 2]); }
    return line(out.concat(back.reverse())) + 'Z';
  };
  return { LE, TE, chord, outline, lines, yU: (x) => yAt(upper, x), yL: (x) => yAt(lower, x), low: zone(upper, 1, 100, 0.55), high: zone(lower, -1, 70, 0.8) };
})();
// The streaks: flow time per second, a new row of streaks every `every` (in flow time), each `long` long.
const FLOW = { rate: 1.3, every: 1.0, long: 0.26 };
const streakSlots = (ln) => Math.ceil((ln.total + FLOW.long) / FLOW.every) + 1;
// The part of a streamline between the flow times t0 and t1, as a path.
function segment(ln, t0, t1) {
  const { pts, ts } = ln;
  const find = (t) => { let lo = 1, hi = ts.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (ts[m] < t) lo = m + 1; else hi = m; } return lo; };
  const at = (i, t) => { const a = pts[i - 1], b = pts[i], k = clamp((t - ts[i - 1]) / (ts[i] - ts[i - 1] || 1), 0, 1); return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]; };
  const i0 = find(t0), i1 = find(t1), P = [at(i0, t0)];
  for (let i = i0; i < i1; i++) P.push(pts[i]);
  P.push(at(i1, t1));
  return line(P);
}

register('airplane_lift', {
  cat: CAT, title: 'How a wing lifts',
  desc: 'A wing seen from the side, tilted a little into the wind. Air streams over and under it, and the streaks over the top run faster and pull ahead. Quiet shading shows lower pressure above the wing and higher pressure below, and the lift arrow grows upward. The weight, thrust and drag arrows appear only when the narration names them.',
  use: 'How planes fly, how a wing makes lift, air pressure and airflow, the four forces of flight.',
  params: 'labels: {wing, airflow, lift, weight, thrust, drag, lowPressure, highPressure} (each optional, 1 to 3 words from the narration; the weight, thrust and drag arrows are drawn only when their labels are given), at (when the lift arrow grows, 0 to 1)',
  example: { labels: { wing: 'Wing', airflow: 'Airflow', lift: 'Lift', lowPressure: 'Lower pressure', highPressure: 'Higher pressure' } },
  build(p, c) {
    const { U, th } = c, id = c.id, L = labelsOf(p), W = WING, at = moment(p.at, 0.44, 0.25, 0.7);
    const ux = (k) => W.LE[0] + k * W.chord, xLift = ux(0.3), topY = W.yU(xLift), botY = W.yL(xLift);
    // The pressure: lower over the wing, higher under it.
    let o = `<g opacity=".22"><path d="${W.low}" fill="${th.accent2}" opacity="0"${U.A('fade', 0.26, 0.08)}/></g>` +
      `<g opacity=".18"><path d="${W.high}" fill="${th.accent}" opacity="0"${U.A('fade', 0.32, 0.08)}/></g>`;
    // The streamlines, and the streaks that ride along them (moved by render).
    W.lines.forEach((ln, i) => { o += drawn(U, line(ln.pts), th.muted, 3, 0.04 + i * 0.012, 0.12, 0.55); });
    W.lines.forEach((ln, i) => { for (let j = 0; j < streakSlots(ln); j++) o += `<path id="${id}s${i}_${j}" d="" fill="none" stroke="${th.ink}" stroke-width="6" stroke-linecap="round" opacity="0"/>`; });
    // The forces, each starting inside the wing: lift, and the others only when the narration names them.
    const forces = [
      ['weight', [xLift, botY - 16], [xLift, Math.min(780, botY + 250)], th.ink],
      ['thrust', [W.LE[0] + 30, W.LE[1]], [W.LE[0] - 180, W.LE[1]], th.accent2],
      ['drag', [W.TE[0] + 8, W.TE[1]], [W.TE[0] + 188, W.TE[1]], th.bad],
    ].filter(([key]) => say(L[key]));
    // Each force after the lift, one at a time, all grown and named before the scene settles.
    const fAt = (k) => Math.min(at + 0.16 + k * 0.06, 0.8 + k * 0.035);
    o += bigArrow(U, th, xLift, topY + 16, xLift, 178, th.accent, at, 30);
    forces.forEach(([, a, b, col], k) => { o += bigArrow(U, th, a[0], a[1], b[0], b[1], col, fAt(k), 24); });
    // The wing.
    o += `<g opacity="0"${U.A('fade', 0, 0.06)}><path d="${line(W.outline)}Z" fill="${th.surface}" stroke="${th.ink}" stroke-width="4" stroke-linejoin="round"/></g>`;
    // The names. The wing's goes inside it, along it, in one line or two where every corner of the words stays inside
    // the outline; else under its front.
    const wing = say(L.wing), first = W.lines[3].pts[0];
    if (wing) {
      const a = Math.atan2(W.TE[1] - W.LE[1], W.TE[0] - W.LE[0]), words = U.lab(wing).split(/\s+/), width = (t, s) => U.tw(t, s, { w: 700 });
      // One line at 34 px, else two at 30 px, the most even break first.
      const twos = [];
      for (let i = 1; i < words.length; i++) twos.push({ s: 30, lines: [words.slice(0, i).join(' '), words.slice(i).join(' ')] });
      const widest = (opt) => Math.max(...opt.lines.map((t) => width(t, opt.s)));
      const options = [{ s: 34, lines: [words.join(' ')] }, ...twos.sort((m, n) => widest(m) - widest(n))];
      // The lines of an option round the point (x, y), turned with the wing, and whether they fit inside it.
      const place = (opt, x, y) => {
        const lh = opt.s * 1.06, y0 = y - ((opt.lines.length - 1) * lh) / 2 + opt.s * 0.35;
        const inside = opt.lines.every((t, i) => {
          const hw = width(t, opt.s) / 2 + 6, top = y0 + i * lh - opt.s * 0.76, bottom = y0 + i * lh + opt.s * 0.24;
          return [[x - hw, top], [x + hw, top], [x - hw, bottom], [x + hw, bottom]].every(([px, py]) => {
            const qx = x + (px - x) * Math.cos(a) - (py - y) * Math.sin(a), qy = y + (px - x) * Math.sin(a) + (py - y) * Math.cos(a);
            return qx > W.LE[0] && qx < W.TE[0] && qy >= W.yU(qx) + 5 && qy <= W.yL(qx) - 5;
          });
        });
        return { inside, x, y, y0, lh, opt };
      };
      let fit = null;
      for (const opt of options) for (const k of [0.36, 0.3, 0.42, 0.26]) {
        const x = ux(k), y = (W.yU(x) + W.yL(x)) / 2;
        if (!fit) { const pl = place(opt, x, y); if (pl.inside) fit = pl; }
      }
      if (fit) {
        const { x, y, y0, lh, opt } = fit;
        o += `<g opacity="0"${U.A('fade', 0.06, 0.05)}><g transform="rotate(${f1((a * 180) / Math.PI)} ${f1(x)} ${f1(y)})">${opt.lines.map((t, i) => U.T(f1(x), f1(y0 + i * lh), t, { s: opt.s, w: 700, f: th.ink })).join('')}</g></g>`;
      } else {
        const px = ux(0.14);
        o += callout(U, th, wing, [px, W.yL(px) - 6], 'bottom', px - 40, W.yL(px) + 120, 0.06, 300);
      }
    }
    o += nameText(U, th, L.airflow, first[0] - 16, first[1] - 36, 'right', 0.14) +
      nameText(U, th, L.lowPressure, ux(0.64), W.yU(ux(0.64)) - 34, 'top', 0.3) +
      nameText(U, th, L.highPressure, ux(0.58), W.yL(ux(0.58)) + 34, 'bottom', 0.36) +
      nameText(U, th, L.lift, xLift + 22, 204, 'right', at + 0.06);
    forces.forEach(([key, , b], k) => {
      o += key === 'weight' ? nameText(U, th, L.weight, b[0] + 22, b[1] - 24, 'right', fAt(k) + 0.05) :
        key === 'thrust' ? nameText(U, th, L.thrust, b[0] - 4, b[1], 'left', fAt(k) + 0.05, 260) : nameText(U, th, L.drag, b[0] + 4, b[1], 'right', fAt(k) + 0.05, 260);
    });
    return o;
  },
  init(g, p, c) {
    const q = (s) => g.querySelector('#' + c.id + s);
    return { streaks: WING.lines.map((ln, i) => Array.from({ length: streakSlots(ln) }, (_, j) => q(`s${i}_${j}`))) };
  },
  render(l, st) {
    // Rows of streaks enter at the left together and ride the flow; over the wing the top ones pull ahead.
    const show = smooth(span(l.p, 0.12, 0.2)), tau = l.t * FLOW.rate, frac = ((tau % FLOW.every) + FLOW.every) % FLOW.every;
    WING.lines.forEach((ln, i) => st.streaks[i].forEach((el, j) => {
      if (!el) return;
      const a = frac + j * FLOW.every, a0 = Math.max(0, a - FLOW.long), a1 = Math.min(ln.total, a);
      if (show <= 0 || a1 <= a0) { el.setAttribute('opacity', '0'); return; }
      el.setAttribute('d', segment(ln, a0, a1));
      el.setAttribute('opacity', (0.9 * show * clamp(Math.min(a / 0.5, (ln.total - a0) / 0.5), 0, 1)).toFixed(3));
    }));
  },
});

/* ---------------------------------------------------------------------------------------------------------------
 * Solar panel
 * ------------------------------------------------------------------------------------------------------------- */

// A solar cell cut open: metal contacts on top, a thin top layer, the thick layer under it and a metal back. The light
// comes from the sun at the top left in parallel beams that lean down to the right (`lean` across for each pixel
// down), and a wire runs from the last top contact to a lamp or a house on the right and back to the cell's metal back.
const SOL = { x0: 520, x1: 1120, top: 430, junction: 484, bottom: 650, back: 676, fingers: [570, 690, 810, 930, 1050], beams: [630, 750, 870, 990], beamTop: 258, lean: 0.66, sun: [356, 228], sunR: 56, lamp: [1530, 420], house: [1530, 600] };
// The wire out to the lamp (into its socket's side) or the house (into its wall), and back from its foot to the cell.
const solarOut = (house) => (house ? [[1050, 414], [1050, 362], [1380, 362], [1380, 520], [1438, 520]] : [[1050, 414], [1050, 362], [1430, 362], [1430, 493], [1502, 493]]);
const solarBack = (house) => (house ? [[1530, 600], [1530, 663], [1120, 663]] : [[1530, 526], [1530, 663], [1120, 663]]);
// The electrons' way round the wire: out, through the lamp or house (hidden behind it), back, and into the cell's back.
const solarWire = (house) => track(rounded([...solarOut(house).slice(0, -1), [1530, house ? 520 : 493], [1530, 663], [1120, 663], [1084, 663]], 14));
// An electron's way in the cell: from where the light knocked it loose, up and along to the last top contact.
const cellPath = (x) => track([[x, SOL.junction], [x, 450], [1050, 450], [1050, 424]]);
// A beam of sunlight: where it starts, and where it hits the cell.
const beamEnds = (k) => { const b = [SOL.beams[k], SOL.top - 6]; return [[b[0] - (b[1] - SOL.beamTop) * SOL.lean, SOL.beamTop], b]; };
const SOL_DOTS = 20; // electrons along the wire
const SOL_BEAT = 1.5; // seconds between bursts of light on each beam

register('solar_panel', {
  cat: CAT, title: 'How a solar panel works',
  desc: 'A solar cell cut open, with its layers. Sunlight from the sun hits the cell in bursts, each knocking an electron loose, and the electrons run up to the top contact and round a wire to a lamp (or a house), which lights up, and back into the cell.',
  use: 'How solar panels turn sunlight into electricity, solar power, renewable energy.',
  params: 'labels: {sunlight, panel, electrons, current, device} (each optional, 1 to 3 words from the narration), powers: lamp|house (what the wire lights up, default lamp), at (when the light starts knocking electrons loose, 0 to 1)',
  example: { labels: { sunlight: 'Sunlight', panel: 'Solar cell', electrons: 'Electrons', current: 'Electric current', device: 'Lamp' } },
  build(p, c) {
    const { U, th } = c, id = c.id, L = labelsOf(p), S = SOL, house = p.powers === 'house', at = moment(p.at, 0.32, 0.2, 0.6), [sx, sy] = S.sun;
    // The sun.
    let rays = '';
    for (let k = 0; k < 12; k++) { const a = (Math.PI / 6) * k; rays += `M${f1(sx + 72 * Math.cos(a))} ${f1(sy + 72 * Math.sin(a))}L${f1(sx + 96 * Math.cos(a))} ${f1(sy + 96 * Math.sin(a))}`; }
    let o = `<g${U.A('pop', 0.04, 0.06, { cx: sx, cy: sy })}><circle cx="${sx}" cy="${sy}" r="${S.sunR}" fill="${SUN}"${edge(th)}/><path d="${rays}" stroke="${SUN}" stroke-width="9" stroke-linecap="round"/></g>`;
    // The sunlight: wavy beams from the sun to the cell, and a brighter burst of light that runs down each (render).
    S.beams.forEach((_, k) => {
      const [a, b] = beamEnds(k), d = line(wavePts(a, b, 9, 38, 20)), t0 = at - 0.16 + k * 0.02;
      o += drawn(U, d, SUN, 4, t0, 0.07) + `<g opacity="0"${U.A('fade', t0 + 0.065, 0.02)}>${head(a, b, SUN, 22)}</g>` +
        `<path id="${id}pk${k}" d="${d}" pathLength="1000" fill="none" stroke="${SUN}" stroke-width="12" stroke-linecap="round" stroke-dasharray="0 3000" opacity="0"/>`;
    });
    // The cell, cut open: the metal back, the thick layer, the thin top layer and the contacts on top.
    o += `<g${U.A('up', 0, 0.07)}><rect x="${S.x0}" y="${S.bottom}" width="${S.x1 - S.x0}" height="${S.back - S.bottom}" fill="${METAL}"${edge(th)}/>` +
      `<rect x="${S.x0}" y="${S.junction}" width="${S.x1 - S.x0}" height="${S.bottom - S.junction}" fill="${SILICON_P}"${edge(th)}/>` +
      `<rect x="${S.x0}" y="${S.top}" width="${S.x1 - S.x0}" height="${S.junction - S.top}" fill="${SILICON_N}"${edge(th)}/>` +
      S.fingers.map((x) => `<rect x="${x - 14}" y="${S.top - 16}" width="28" height="18" fill="${METAL}"${edge(th)}/>`).join('') + '</g>';
    // The wire, and the electrons: two at a time in the cell under each beam, and a stream round the wire.
    o += drawn(U, line(rounded(solarOut(house), 14)), COPPER, 9, 0.06, 0.08) + drawn(U, line(rounded(solarBack(house), 14)), COPPER, 9, 0.12, 0.06);
    S.beams.forEach((x, k) => { o += `<circle id="${id}hit${k}" cx="${x}" cy="${S.junction}" r="10" fill="none" stroke="${CHARGE}" stroke-width="5" opacity="0"/>`; });
    S.beams.forEach((_, k) => { for (let j = 0; j < 2; j++) o += `<g id="${id}ec${k}_${j}" opacity="0">${charge(th, 11, false)}</g>`; });
    for (let j = 0; j < SOL_DOTS; j++) o += `<g id="${id}ew${j}" opacity="0">${charge(th, 11, false)}</g>`;
    // The lamp or the house, over the end of the wire.
    o += `<g opacity="0"${U.A('fade', 0.08, 0.05)}>${house ? houseMarkup(th, id, S.house[0], S.house[1]) : bulbMarkup(th, id, S.lamp[0], S.lamp[1])}</g>`;
    // The names.
    o += nameText(U, th, L.sunlight, sx, sy + 98, 'bottom', at - 0.1) +
      nameText(U, th, L.panel, S.x0 - 4, (S.top + S.back) / 2, 'left', 0.06, 300) +
      callout(U, th, L.electrons, [S.beams[0], S.junction], 'bottom', S.beams[0], S.back + 50, at + 0.04) +
      nameText(U, th, L.current, 1240, 356, 'top', at + 0.1) +
      nameText(U, th, L.device, house ? 1644 : 1626, house ? 520 : 416, 'right', at + 0.2, 230);
    return o;
  },
  init(g, p, c) {
    const q = (s) => g.querySelector('#' + c.id + s), house = p.powers === 'house', wire = solarWire(house);
    const entry = house ? [1438, 520] : [1502, 493];
    return {
      wire, entry: lengthNear(wire, entry[0], entry[1]), cells: SOL.beams.map((x) => cellPath(x)), at: moment(p.at, 0.32, 0.2, 0.6),
      pk: SOL.beams.map((_, k) => q('pk' + k)), hit: SOL.beams.map((_, k) => q('hit' + k)), ec: SOL.beams.map((_, k) => [q(`ec${k}_0`), q(`ec${k}_1`)]),
      ew: Array.from({ length: SOL_DOTS }, (_, j) => q('ew' + j)), lit: ['lit', 'fil', 'glow', 'win'].map(q).filter(Boolean),
    };
  },
  render(l, st) {
    const t = l.t, p = l.p, at = st.at, P = SOL_BEAT;
    // A burst of light runs down each beam in turn; where it hits, an electron is knocked loose (with a ring) and runs
    // up through the top layer and along to the top contact.
    SOL.beams.forEach((_, k) => {
      const off = 0.37 * k, tau = t - off, q = (((tau % P) + P) % P) / P, pk = st.pk[k];
      if (pk) {
        const on = p >= at - 0.06 && q < 1 / 3, hd = q * 3000;
        pk.setAttribute('opacity', on ? '1' : '0');
        if (on) { pk.setAttribute('stroke-dasharray', `${f1(Math.min(hd, 170))} 3000`); pk.setAttribute('stroke-dashoffset', f1(-Math.max(0, hd - 170))); }
      }
      const n0 = Math.floor((tau - P / 3) / P), born = (n) => n * P + P / 3 + off, ok = (n) => born(n) >= (at - 0.02) * l.dur;
      const ring = st.hit[k], a0 = t - born(n0);
      if (ring) {
        const on = ok(n0) && a0 >= 0 && a0 < 0.45;
        ring.setAttribute('opacity', on ? (1 - a0 / 0.45).toFixed(2) : '0');
        if (on) ring.setAttribute('r', f1(10 + 34 * easeOut(a0 / 0.45)));
      }
      st.ec[k].forEach((el, j) => {
        if (!el) return;
        const age = t - born(n0 - j), tr = st.cells[k], s = age * 240, on = ok(n0 - j) && age >= 0 && s <= tr.len;
        el.setAttribute('opacity', on ? clamp((tr.len - s) / 20, 0, 1).toFixed(2) : '0');
        if (on) { const [x, y] = pointAt(tr, s), sc = 0.3 + 0.7 * smooth(age / 0.16); el.setAttribute('transform', `translate(${f1(x)} ${f1(y)}) scale(${sc.toFixed(3)})`); }
      });
    });
    // The current runs out round the wire as far as it has got, and keeps flowing; the lamp or the window lights up as
    // it gets there.
    const tr = st.wire, front = tr.len * smooth(span(p, at + 0.05, at + 0.27)), gap = tr.len / SOL_DOTS;
    st.ew.forEach((el, j) => {
      if (!el) return;
      const s = (t * 150 + j * gap) % tr.len, on = p >= at + 0.05 && s <= front;
      el.setAttribute('opacity', on ? clamp((tr.len - s) / 30, 0, 1).toFixed(2) : '0');
      if (on) { const [x, y] = pointAt(tr, s); el.setAttribute('transform', `translate(${f1(x)} ${f1(y)})`); }
    });
    const lit = smooth((front - st.entry + 10) / 40).toFixed(3);
    st.lit.forEach((el) => el.setAttribute('opacity', lit));
  },
});

/* ---------------------------------------------------------------------------------------------------------------
 * Battery circuit
 * ------------------------------------------------------------------------------------------------------------- */

// A battery cut open: its case full of electrolyte, the anode on the left and the cathode on the right, a separator
// between them, and a terminal over each. Wires run from the terminals up to a bulb.
const BAT = { x0: 500, x1: 1420, y0: 486, y1: 770, ey0: 528, ey1: 736, an: [548, 762], ca: [1158, 1372], ta: 655, tc: 1265, bulb: [960, 266], wy: 339, lanes: [566, 614, 662] };
// The electrons' way: up out of the anode, round the wire through the bulb (hidden in its socket) and down into the
// cathode.
const batPath = () => track(rounded([[BAT.ta, 690], [BAT.ta, BAT.wy], [BAT.tc, BAT.wy], [BAT.tc, 690]], 16));
const BAT_DOTS = 20, ION_DOTS = 3; // electrons round the wire, ions in each lane

register('battery_circuit', {
  cat: CAT, title: 'How a battery works',
  desc: 'A battery cut open, with its anode, cathode and electrolyte, joined by wires to a bulb. Electrons flow out of the anode, through the wire and the bulb to the cathode, while ions move through the electrolyte inside the battery, and the bulb glows.',
  use: 'How batteries store and deliver electricity, electric circuits, anode and cathode, lithium-ion and other batteries.',
  params: 'labels: {anode, cathode, electrolyte, electrons, ions, bulb} (each optional, 1 to 3 words from the narration), at (when the current starts to flow, 0 to 1)',
  example: { labels: { anode: 'Anode', cathode: 'Cathode', electrolyte: 'Electrolyte', electrons: 'Electrons', ions: 'Ions', bulb: 'Bulb' } },
  build(p, c) {
    const { U, th } = c, id = c.id, L = labelsOf(p), B = BAT, at = moment(p.at, 0.26, 0.18, 0.6), [bx, by] = B.bulb;
    // The case with the electrolyte in it, the anode, the cathode and the separator.
    let o = `<g${U.A('up', 0, 0.07)}><rect x="${B.x0}" y="${B.y0}" width="${B.x1 - B.x0}" height="${B.y1 - B.y0}" rx="26" fill="${th.surface}" stroke="${th.ink}" stroke-width="5"/>` +
      `<rect x="${B.x0 + 16}" y="${B.y0 + 16}" width="${B.x1 - B.x0 - 32}" height="${B.y1 - B.y0 - 32}" rx="14" fill="${ELECTROLYTE}" opacity=".5"/></g>`;
    const block = (x, col, at0) => `<g${U.A('pop', at0, 0.06, { cx: (x[0] + x[1]) / 2, cy: (B.ey0 + B.ey1) / 2 })}><rect x="${x[0]}" y="${B.ey0}" width="${x[1] - x[0]}" height="${B.ey1 - B.ey0}" rx="6" fill="${col}"${edge(th)}/></g>`;
    o += block(B.an, ANODE, 0.03) + block(B.ca, CATHODE, 0.05) +
      `<g opacity="0"${U.A('fade', 0.07, 0.05)}><path d="M960 ${B.ey0 - 8}V${B.ey1 + 8}" stroke="${th.ink}" stroke-width="4" stroke-dasharray="14 12" opacity=".55"/></g>`;
    // The terminals, with a minus by the anode's and a plus by the cathode's.
    const term = (x) => `<rect x="${x - 7}" y="${B.y0}" width="14" height="${B.ey0 - B.y0}" fill="${METAL}"/><rect x="${x - 24}" y="${B.y0 - 30}" width="48" height="32" rx="5" fill="${METAL}" stroke="${th.ink}" stroke-width="3"/>`;
    const sign = (x, y, plus) => `<path d="M${x - 17} ${y}H${x + 17}${plus ? `M${x} ${y - 17}V${y + 17}` : ''}" stroke="${th.ink}" stroke-width="8" stroke-linecap="round"/>`;
    o += `<g opacity="0"${U.A('fade', 0.06, 0.05)}>${term(B.ta)}${term(B.tc)}${sign(B.ta - 72, B.y0 - 30, false)}${sign(B.tc + 72, B.y0 - 30, true)}</g>`;
    // The wires up to the bulb's socket.
    o += drawn(U, line(rounded([[B.ta, B.y0 - 30], [B.ta, B.wy], [bx - 28, B.wy]], 16)), COPPER, 9, 0.08, 0.07) +
      drawn(U, line(rounded([[bx + 28, B.wy], [B.tc, B.wy], [B.tc, B.y0 - 30]], 16)), COPPER, 9, 0.12, 0.07);
    // The ions crossing the electrolyte and the electrons running round (both moved by render), then the bulb.
    B.lanes.forEach((_, k) => { for (let j = 0; j < ION_DOTS; j++) o += `<g id="${id}ion${k}_${j}" opacity="0">${charge(th, 14, true)}</g>`; });
    for (let j = 0; j < BAT_DOTS; j++) o += `<g id="${id}e${j}" opacity="0">${charge(th, 11, false)}</g>`;
    o += `<g opacity="0"${U.A('fade', 0.1, 0.05)}>${bulbMarkup(th, id, bx, by)}</g>`;
    // The names.
    o += callout(U, th, L.anode, [B.an[0] + 32, 704], 'left', B.x0 - 40, 704, 0.08) +
      callout(U, th, L.cathode, [B.ca[1] - 32, 704], 'right', B.x1 + 40, 704, 0.1) +
      nameText(U, th, L.electrolyte, 960, 712, 'center', 0.12, 330) +
      nameText(U, th, L.electrons, B.ta - 8, 404, 'left', at + 0.04) +
      callout(U, th, L.ions, [1064, B.lanes[0]], 'top', 1064, 452, at + 0.1) +
      nameText(U, th, L.bulb, bx + 102, by - 4, 'right', at + 0.12);
    return o;
  },
  init(g, p, c) {
    const q = (s) => g.querySelector('#' + c.id + s), path = batPath();
    return {
      path, at: moment(p.at, 0.26, 0.18, 0.6), entry: lengthNear(path, BAT.bulb[0] - 28, BAT.wy),
      e: Array.from({ length: BAT_DOTS }, (_, j) => q('e' + j)), ions: BAT.lanes.map((_, k) => Array.from({ length: ION_DOTS }, (_, j) => q(`ion${k}_${j}`))), lit: ['lit', 'fil', 'glow'].map(q).filter(Boolean),
    };
  },
  render(l, st) {
    const t = l.t, p = l.p, at = st.at, tr = st.path, front = tr.len * smooth(span(p, at, at + 0.22)), gap = tr.len / BAT_DOTS;
    // The electrons run out of the anode and round the wire as far as the current has got, and keep flowing.
    st.e.forEach((el, j) => {
      if (!el) return;
      const s = (t * 110 + j * gap) % tr.len, on = p >= at && s <= front;
      el.setAttribute('opacity', on ? clamp(Math.min(s / 30, (tr.len - s) / 30), 0, 1).toFixed(2) : '0');
      if (on) { const [x, y] = pointAt(tr, s); el.setAttribute('transform', `translate(${f1(x)} ${f1(y)})`); }
    });
    const lit = smooth((front - st.entry + 10) / 40).toFixed(3);
    st.lit.forEach((el) => el.setAttribute('opacity', lit));
    // The ions drift slowly through the electrolyte from the anode to the cathode.
    const on = smooth(span(p, at + 0.03, at + 0.08)), w = BAT.ca[0] - BAT.an[1];
    st.ions.forEach((row, k) => row.forEach((el, j) => {
      if (!el) return;
      const u = (t * 52 + (j * w) / ION_DOTS + k * 61) % w;
      el.setAttribute('transform', `translate(${f1(BAT.an[1] + u)} ${BAT.lanes[k]})`);
      el.setAttribute('opacity', (on * clamp(Math.min(u / 26, (w - u) / 26), 0, 1)).toFixed(2));
    }));
  },
});

/* ---------------------------------------------------------------------------------------------------------------
 * Nuclear fission
 * ------------------------------------------------------------------------------------------------------------- */

// The particles of a nucleus as a hexagonal cluster: `rings` rings round one in the middle, `gap` apart, top row first.
const hexCluster = (rings, gap) => {
  const out = [];
  for (let q = -rings; q <= rings; q++) for (let r = Math.max(-rings, -q - rings); r <= Math.min(rings, -q + rings); r++) out.push([(q + r / 2) * gap, (r * gap * Math.sqrt(3)) / 2]);
  return out.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
};
// One big nucleus of 37 particles, about half of them protons (a fixed mix, so it looks the same every time), and how
// it splits: stretched along its splitting line (up and down), the top 19 particles go to one smaller nucleus and the
// other 18 to the other, each packing into a round cluster as it flies off.
const NUC = (() => {
  const gap = 24, R = 3 * gap + 12.5, big = hexCluster(3, gap), small = hexCluster(2, gap);
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const proton = big.map(() => rnd() < 0.46);
  const stretched = big.map(([x, y]) => [x * 0.9, y * 1.3]);
  const part = (from, to, slots) => {
    const idx = Array.from({ length: to - from }, (_, i) => from + i), c0 = [0, 0];
    idx.forEach((i) => { c0[0] += stretched[i][0] / idx.length; c0[1] += stretched[i][1] / idx.length; });
    return { idx, c0, slots: slots.slice(0, idx.length) };
  };
  return { gap, R, big, proton, stretched, frags: [part(0, 19, small), part(19, 37, small)], fragR: 2 * gap + 12.5 };
})();
// Where everything is and when: the nuclei (the first, then those its neutrons hit), and every neutron's flight.
function fissionPlan(p) {
  const chain = p.chain !== false, three = Number(p.neutrons) !== 2, T = moment(p.at, 0.3, 0.15, 0.5), WOB = 0.05, FLY = 0.15;
  // Without a chain the picture is the first split alone, so it moves right to sit in the middle.
  const c1 = chain ? [560, 480] : [930, 480];
  const nuclei = [{ c: c1, k: 1, ang: 0, hit: T, split: T + WOB, dist: 150 }];
  const neutrons = [{ from: [c1[0] - 370, c1[1]], to: [c1[0] - NUC.R - 12, c1[1]], t0: 0.05, t1: T, end: 'hit' }];
  const fan = three ? [-1, 0, 1] : [-1, 1];
  if (chain) {
    // The nuclei the new neutrons hit, staggered so that their halves, which split up and down too, never meet.
    (three ? [[1030, 288], [1190, 480], [1030, 672]] : [[1070, 336], [1070, 624]]).forEach((c) => {
      const d = Math.hypot(c[0] - c1[0], c[1] - c1[1]), u = [(c[0] - c1[0]) / d, (c[1] - c1[1]) / d], hit = T + WOB + FLY, r = 0.72 * NUC.R + 10;
      neutrons.push({ from: [c1[0] + u[0] * 24, c1[1] + u[1] * 24], to: [c[0] - u[0] * r, c[1] - u[1] * r], t0: T + WOB, t1: hit, end: 'hit' });
      nuclei.push({ c, k: 0.72, ang: 0, hit, split: hit + WOB, dist: 66 });
      fan.forEach((f) => { const a = f * (three ? 0.32 : 0.26); neutrons.push({ from: c, to: [c[0] + 250 * Math.cos(a), c[1] + 250 * Math.sin(a)], t0: hit + WOB, t1: hit + WOB + 0.2, end: 'fade' }); });
    });
  } else {
    fan.forEach((f) => { const a = f * 0.4; neutrons.push({ from: c1, to: [c1[0] + 420 * Math.cos(a), c1[1] + 420 * Math.sin(a)], t0: T + WOB, t1: T + WOB + 0.28, end: 'fade' }); });
  }
  // Where the last neutrons fly to, so the chain reaction's name goes past them.
  const reach = Math.max(...neutrons.map((n) => n.to[0]));
  return { chain, T, WOB, FLY, nuclei, neutrons, reach };
}
// A particle's place in a nucleus at progress p, from the nucleus's middle in its own frame (its splitting line up and
// down): still until hit, stretching until it splits, then flying off with its half and packing into a round cluster.
function particleAt(n, i, p, F) {
  const [x, y] = NUC.big[i];
  if (p < n.hit) return [x, y];
  if (p < n.split) { const e = smooth(span(p, n.hit, n.split)), w = 0.03 * Math.sin(span(p, n.hit, n.split) * Math.PI * 4); return [x * (1 - 0.1 * e + w), y * (1 + 0.3 * e - w)]; }
  const f = i < 19 ? 0 : 1, fr = NUC.frags[f], slot = fr.slots[fr.idx.indexOf(i)], m = smooth(span(p, n.split, n.split + 0.05));
  const go = (f ? 1 : -1) * n.dist * easeOut(span(p, n.split, n.split + F)), st = NUC.stretched[i];
  return [fr.c0[0] + (st[0] - fr.c0[0]) * (1 - m) + slot[0] * m, fr.c0[1] + go + (st[1] - fr.c0[1]) * (1 - m) + slot[1] * m];
}
const toWorld = (n, [x, y]) => { const a = n.ang, k = n.k; return [n.c[0] + k * (x * Math.cos(a) - y * Math.sin(a)), n.c[1] + k * (x * Math.sin(a) + y * Math.cos(a))]; };
const starPath = (R, r, n) => 'M' + Array.from({ length: n * 2 }, (_, i) => { const a = (Math.PI * i) / n - Math.PI / 2, d = i % 2 ? r : R; return f1(d * Math.cos(a)) + ' ' + f1(d * Math.sin(a)); }).join('L') + 'Z';

register('nuclear_fission', {
  cat: CAT, title: 'Nuclear fission',
  desc: 'A neutron flies in and hits a big nucleus, a cluster of particles. The nucleus stretches and splits into two smaller nuclei with a flash of energy, and new neutrons fly out. In a chain reaction they hit more nuclei, which split in turn and send out more neutrons; their dotted paths branch like a tree.',
  use: 'How nuclear power plants and atomic bombs release energy, fission, chain reactions, uranium.',
  params: 'labels: {neutron, nucleus, fragments, energy, chainReaction} (each optional, 1 to 3 words from the narration), chain (default true; false stops after the first split), neutrons (2 or 3 new neutrons from each split, default 3), at (when the first neutron hits, 0 to 1)',
  example: { labels: { neutron: 'Neutron', nucleus: 'Uranium nucleus', fragments: 'Smaller nuclei', energy: 'Energy', chainReaction: 'Chain reaction' } },
  build(p, c) {
    const { U, th } = c, id = c.id, L = labelsOf(p), plan = fissionPlan(p), first = plan.nuclei[0], [cx, cy] = first.c, inc = plan.neutrons[0];
    // The neutrons' dotted paths, drawn behind them as they fly (render), and a ring that spreads from each split.
    let o = plan.neutrons.map((_, j) => `<path id="${id}tr${j}" d="" fill="none" stroke="${th.muted}" stroke-width="5" stroke-linecap="round" stroke-dasharray="1 13" opacity="0"/>`).join('');
    o += plan.nuclei.map((n, j) => `<circle id="${id}ring${j}" cx="${n.c[0]}" cy="${n.c[1]}" r="10" fill="none" stroke="${th.accent}" stroke-width="5" opacity="0"/>`).join('');
    // The nuclei, each popping in at the start, their particles moved by render.
    plan.nuclei.forEach((n, j) => {
      const r = 12.5 * n.k;
      o += `<g${U.A('pop', 0.01 + j * 0.025, 0.06, { cx: n.c[0], cy: n.c[1] })}>` + NUC.big.map((q, i) => {
        const [x, y] = toWorld(n, q);
        return `<circle id="${id}n${j}_${i}" cx="${f1(x)}" cy="${f1(y)}" r="${f1(r)}" fill="${NUC.proton[i] ? PROTON : NEUTRON}" stroke="${rim(th)}" stroke-width="2"/>`;
      }).join('') + '</g>';
    });
    // The flash of energy at each split, which stays as a small burst.
    o += plan.nuclei.map((n, j) => `<g id="${id}fl${j}" opacity="0"><path d="${starPath(48 * n.k, 20 * n.k, 8)}" fill="${FLASH}" stroke="${FLASH_EDGE}" stroke-width="3" stroke-linejoin="round" transform="translate(${n.c[0]} ${n.c[1]})"/></g>`).join('');
    // The flying neutrons.
    o += plan.neutrons.map((_, j) => `<circle id="${id}nt${j}" r="13" fill="${NEUTRON}" stroke="${rim(th)}" stroke-width="2.5" opacity="0"/>`).join('');
    // The names. The nucleus's fades as the neutron hits it, and the fragments are named under the lower one.
    const fragB = toWorld(first, [NUC.frags[1].c0[0], NUC.frags[1].c0[1] + first.dist]);
    o += nameText(U, th, L.neutron, (inc.from[0] + inc.to[0]) / 2, cy + 8, 'bottom', 0.06, 300) +
      `<g${U.A('dim', first.hit, 0.03, { to: 0 })}>${nameText(U, th, L.nucleus, cx, cy + NUC.R + 8, 'bottom', 0.05)}</g>` +
      nameText(U, th, L.energy, cx - 64, cy - 66, 'left', first.split + 0.03, 300) +
      nameText(U, th, L.fragments, fragB[0], fragB[1] + NUC.fragR + 2, 'bottom', first.split + 0.12) +
      (plan.chain ? nameText(U, th, L.chainReaction, plan.reach + 4, cy, 'right', plan.T + 0.32, 330) : '');
    return o;
  },
  init(g, p, c) {
    const q = (s) => g.querySelector('#' + c.id + s), plan = fissionPlan(p);
    return {
      plan, balls: plan.nuclei.map((n, j) => NUC.big.map((_, i) => q(`n${j}_${i}`))), flash: plan.nuclei.map((_, j) => q('fl' + j)), ring: plan.nuclei.map((_, j) => q('ring' + j)),
      nt: plan.neutrons.map((_, j) => q('nt' + j)), tr: plan.neutrons.map((_, j) => q('tr' + j)),
    };
  },
  render(l, st) {
    const p = l.p, plan = st.plan;
    plan.nuclei.forEach((n, j) => {
      st.balls[j].forEach((el, i) => { if (!el) return; const [x, y] = toWorld(n, particleAt(n, i, p, plan.FLY)); el.setAttribute('cx', f1(x)); el.setAttribute('cy', f1(y)); });
      // The flash pops up big as the nucleus splits and settles to a small burst; a ring spreads out and fades.
      const fl = st.flash[j], rg = st.ring[j], a = p - n.split;
      if (fl) {
        const s = a < 0 ? 0 : a < 0.03 ? 1.3 * easeOut(a / 0.03) : 1.3 - 0.7 * smooth((a - 0.03) / 0.07);
        fl.setAttribute('opacity', a < 0 ? '0' : '1');
        fl.setAttribute('transform', `translate(${n.c[0]} ${n.c[1]}) scale(${Math.max(0.001, s).toFixed(3)}) translate(${-n.c[0]} ${-n.c[1]})`);
      }
      if (rg) { const q = span(p, n.split, n.split + 0.12); rg.setAttribute('opacity', q > 0 && q < 1 ? (0.85 * (1 - q)).toFixed(2) : '0'); rg.setAttribute('r', f1(20 + 150 * n.k * easeOut(q))); }
    });
    // Each neutron flies at an even speed; the first ones vanish into the nucleus they hit, the last ones fade as they
    // fly on. Their dotted paths stay.
    plan.neutrons.forEach((nt, j) => {
      const el = st.nt[j], trail = st.tr[j], q = span(p, nt.t0, nt.t1), x = nt.from[0] + (nt.to[0] - nt.from[0]) * q, y = nt.from[1] + (nt.to[1] - nt.from[1]) * q;
      const op = p < nt.t0 ? 0 : nt.end === 'hit' ? (p < nt.t1 ? 1 : 0) : 1 - smooth(span(p, nt.t1 - 0.08, nt.t1));
      if (el) { el.setAttribute('opacity', op.toFixed(2)); el.setAttribute('cx', f1(x)); el.setAttribute('cy', f1(y)); }
      if (trail) { trail.setAttribute('opacity', q > 0 ? '0.8' : '0'); trail.setAttribute('d', q > 0 ? `M${f1(nt.from[0])} ${f1(nt.from[1])}L${f1(x)} ${f1(y)}` : ''); }
    });
  },
});

/* ---------------------------------------------------------------------------------------------------------------
 * Fridge heat pump
 * ------------------------------------------------------------------------------------------------------------- */

// A fridge seen from the side and cut open, its door on the left. Inside: a shelf of food and the cold coils along the
// ceiling. At the back: the hot coils outside, and the compressor in a nook at the bottom. One loop of pipe joins them:
// from the compressor up through the hot coils, through the expansion valve and over the top into the fridge, along
// the cold coils and down the back wall to the compressor again.
const FR = { x0: 640, x1: 1120, y0: 190, y1: 800, ix0: 676, ix1: 1084, iy0: 226, iy1: 614, shelf: 532, comp: [956, 686, 1096, 790], valve: [1146, 232] };
const FR_LOOP = [[1096, 740], [1222, 740], [1222, 640], [1146, 640], [1146, 584], [1222, 584], [1222, 528], [1146, 528], [1146, 472], [1222, 472], [1222, 416], [1146, 416], [1146, 360],
  [1222, 360], [1222, 304], [1146, 304], [1146, 160], [1000, 160], [1000, 254], [712, 254], [712, 298], [1060, 298], [1060, 740], [1096, 740]];
const frLoop = () => track(rounded(FR_LOOP, 18));
const FR_DOTS = 40;
// The food on the shelf: where heat rises from each, and their shapes (a bottle, a jar, a carton, and an apple below).
const FOOD_TOPS = [[734, 432], [833, 466], [934, 430]];
const foodMarkup = (th) => {
  const f = `fill="${th.muted}"${edge(th)}`;
  return `<rect x="716" y="462" width="36" height="70" rx="8" ${f}/><rect x="726" y="436" width="16" height="30" rx="3" ${f}/>` +
    `<rect x="800" y="478" width="66" height="54" rx="8" ${f}/><rect x="795" y="468" width="76" height="13" rx="4" ${f}/>` +
    `<path d="M904 532V452L934 432L964 452V532Z" ${f}/>` +
    `<circle cx="790" cy="588" r="24" ${f}/><path d="M790 564Q794 552 806 548" fill="none" stroke="${th.muted}" stroke-width="5" stroke-linecap="round"/>`;
};

register('fridge_heat_pump', {
  cat: CAT, title: 'How a fridge moves heat',
  desc: 'A fridge cut open with its refrigerant loop. The compressor squeezes the refrigerant, which runs hot through the coils at the back, where heat flows out into the room; it passes the expansion valve and runs cold through the coils inside, which take heat from the food. The refrigerant keeps moving round the loop, and the inside turns cold.',
  use: 'How fridges, freezers, air conditioners and heat pumps move heat, and the refrigeration cycle.',
  params: 'labels: {compressor, condenser, expansionValve, evaporator, refrigerant, heatIn, heatOut, inside} (each optional, 1 to 3 words from the narration)',
  example: { labels: { compressor: 'Compressor', condenser: 'Hot coils', expansionValve: 'Expansion valve', evaporator: 'Cold coils', refrigerant: 'Refrigerant', heatIn: 'Heat from the food', heatOut: 'Heat out', inside: 'Cold inside' } },
  build(p, c) {
    const { U, th } = c, id = c.id, L = labelsOf(p), F = FR, tr = frLoop(), [k0, k1, k2, k3] = F.comp;
    // The body, the nook for the compressor, the handle, the inside (which turns cold) and the food.
    let o = `<g${U.A('up', 0, 0.07)}><rect x="${F.x0}" y="${F.y0}" width="${F.x1 - F.x0}" height="${F.y1 - F.y0}" rx="22" fill="${th.surface}" stroke="${th.ink}" stroke-width="4"/>` +
      `<path d="M${F.x1 + 2} 664H936Q930 664 930 670V${F.y1 + 2}H${F.x1 + 2}Z" fill="${th.bg}"/><path d="M${F.x1} 664H936Q930 664 930 670V${F.y1}" fill="none" stroke="${th.ink}" stroke-width="3"/>` +
      `<rect x="614" y="404" width="14" height="116" rx="6" fill="${th.ink}"/><path d="M628 420H640M628 504H640" stroke="${th.ink}" stroke-width="6"/>` +
      `<rect x="${F.ix0}" y="${F.iy0}" width="${F.ix1 - F.ix0}" height="${F.iy1 - F.iy0}" rx="10" fill="${th.bg}" stroke="${th.ink}" stroke-width="3"/></g>`;
    o += `<g opacity=".26"><rect x="${F.ix0 + 2}" y="${F.iy0 + 2}" width="${F.ix1 - F.ix0 - 4}" height="${F.iy1 - F.iy0 - 4}" rx="9" fill="${COLD}" opacity="0"${U.A('fade', 0.56, 0.26)}/></g>`;
    o += `<g opacity="0"${U.A('fade', 0.04, 0.05)}><path d="M${F.ix0} ${F.shelf}H1030" stroke="${th.muted}" stroke-width="6" stroke-linecap="round"/>${foodMarkup(th)}</g>`;
    // The loop of pipe, drawn in from the compressor round to the compressor; the coils at the back heat up and the
    // coils inside cool down once the refrigerant runs.
    const pipe = line(tr.pts), hot = stretch(tr, lengthNear(tr, 1222, 680), lengthNear(tr, 1146, 290)), cold = stretch(tr, lengthNear(tr, 1000, 236), lengthNear(tr, 1060, 316));
    o += drawn(U, pipe, th.muted, 10, 0.06, 0.12) +
      `<g opacity="0"${U.A('fade', 0.3, 0.1)}><path d="${line(hot)}" fill="none" stroke="${HOT}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/></g>` +
      `<g opacity="0"${U.A('fade', 0.34, 0.1)}><path d="${line(cold)}" fill="none" stroke="${COLD}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/></g>`;
    // The expansion valve: two small wedges pinching the pipe.
    const [vx, vy] = F.valve;
    o += `<g${U.A('pop', 0.16, 0.05, { cx: vx, cy: vy })}><path d="M${vx - 17} ${vy - 18}H${vx + 17}L${vx} ${vy}ZM${vx - 17} ${vy + 18}H${vx + 17}L${vx} ${vy}Z" fill="${th.ink}" stroke="${th.bg}" stroke-width="3" stroke-linejoin="round"/></g>`;
    // The refrigerant, as dots running round the loop (render): hot from the compressor to the valve, cold after it.
    for (let j = 0; j < FR_DOTS; j++) o += `<circle id="${id}d${j}" r="9" fill="${HOT}" stroke="${th.bg}" stroke-width="2.5" opacity="0"/>`;
    // The compressor, over the pipe where it passes through.
    const ccx = (k0 + k2) / 2, ccy = (k1 + k3) / 2;
    o += `<g${U.A('pop', 0.08, 0.06, { cx: ccx, cy: ccy })}><g id="${id}comp"><rect x="${k0}" y="${k1}" width="${k2 - k0}" height="${k3 - k1}" rx="36" fill="${th.surface}" stroke="${th.ink}" stroke-width="4"/>` +
      `<path d="M${k0 + 18} ${ccy - 12}H${k2 - 18}M${k0 + 18} ${ccy + 12}H${k2 - 18}" stroke="${th.muted}" stroke-width="5" stroke-linecap="round"/></g></g>`;
    // The heat: wavy arrows out of the hot coils into the room, and rising from the food to the cold coils.
    const heat = (a, b, at0) => {
      const P = wavePts(a, b, 6, 34, 16);
      return `<g opacity="0"${U.A('fade', at0, 0.06)}><path class="heat" d="${line(P)}" fill="none" stroke="${HEAT}" stroke-width="7" stroke-linecap="round" stroke-dasharray="24 12"/>${head(a, b, HEAT, 20)}</g>`;
    };
    o += [330, 440, 550].map((y, k) => heat([1244, y], [1408, y], 0.38 + k * 0.02)).join('') + FOOD_TOPS.map(([x, y], k) => heat([x, y - 10], [x, 322], 0.46 + k * 0.02)).join('');
    // The names: the inside parts on the left, the parts at the back on the right, the refrigerant over the top pipe.
    o += callout(U, th, L.evaporator, [760, 254], 'left', 600, 262, 0.24) +
      callout(U, th, L.heatIn, [734, 380], 'left', 600, 380, 0.52) +
      callout(U, th, L.inside, [706, 576], 'left', 600, 576, 0.7) +
      nameText(U, th, L.refrigerant, 1000, 160, 'left', 0.28, 300) +
      nameText(U, th, L.expansionValve, vx + 14, vy, 'right', 0.2) +
      nameText(U, th, L.heatOut, 1414, 440, 'right', 0.44) +
      nameText(U, th, L.condenser, 1228, 640, 'right', 0.16) +
      callout(U, th, L.compressor, [k2 - 20, k3 - 18], 'right', 1250, 772, 0.12);
    return o;
  },
  init(g, p, c) {
    const q = (s) => g.querySelector('#' + c.id + s), loop = frLoop();
    return { loop, valve: lengthNear(loop, FR.valve[0], FR.valve[1]), dots: Array.from({ length: FR_DOTS }, (_, j) => q('d' + j)), comp: q('comp'), heat: Array.from(g.querySelectorAll('.heat')) };
  },
  render(l, st) {
    const t = l.t, p = l.p, tr = st.loop, gap = tr.len / FR_DOTS, show = smooth(span(p, 0.18, 0.24)), run = p >= 0.18;
    // The refrigerant runs round the loop: hot from the compressor through the coils at the back, cold after the valve.
    st.dots.forEach((el, j) => {
      if (!el) return;
      const s = (j * gap + (run ? (t - 0.18 * l.dur) * 95 : 0) + tr.len * 10) % tr.len, [x, y] = pointAt(tr, s);
      el.setAttribute('transform', `translate(${f1(x)} ${f1(y)})`);
      el.setAttribute('fill', s < st.valve ? HOT : COLD);
      el.setAttribute('opacity', show.toFixed(3));
    });
    // The compressor squeezes in a steady beat while it runs.
    const [k0, k1, k2, k3] = FR.comp, cx = (k0 + k2) / 2, cy = (k1 + k3) / 2, k = 1 + (run ? 0.035 * Math.abs(Math.sin(t * 5)) : 0);
    st.comp?.setAttribute('transform', `translate(${cx} ${cy}) scale(${k.toFixed(4)}) translate(${-cx} ${-cy})`);
    // The heat keeps flowing along its arrows.
    st.heat.forEach((el) => el.setAttribute('stroke-dashoffset', f1(-((t * 46) % 36))));
  },
});
