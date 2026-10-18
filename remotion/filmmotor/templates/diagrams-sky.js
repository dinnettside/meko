// Animated diagrams of how things work (the sky and space), drawn for Meko in the film engine's style. See ../engine.js
// for how templates work. Every visible word comes from the params; a part without a label in the params is drawn
// unlabeled. The drawings hold no numbers, dates, names or other facts, so nothing on screen goes beyond what the
// narration says.
import { register, H } from "../engine.js";

const CAT = 'Diagrams';

// Natural things keep their natural colors in every look. These read on the dark grounds (Night atlas, Blueprint) and
// on the light page (Field guide) alike; the outlined looks also draw an edge round them.
const SEA = '#2F7FD0'; // sea water
const SEA_LIGHT = '#8CC4F0'; // light on the water, and water on the move in a river or the ground
const RIVER = '#3D8FE0'; // a river
const VAPOR = '#5AA9E6'; // water vapor and rain
const CLOUD = '#E3E9F0'; // a white cloud
const CLOUD_DARK = '#AAB6C4'; // a rain cloud
const SUN = '#F5A623'; // the Sun
const SUN_CORE = '#FFD34D';
const GRASS = '#6E9E4F';
const SOIL = '#9A7652';
const BEDROCK = '#76593F';
const ROCK = '#8E7D6D'; // a mountain
const ROCK_SHADE = '#786959'; // a mountain's side in shade
const GROUNDWATER = '#4F82B4'; // ground soaked with water
const DROP = '#D2EAFD'; // water seeping through the ground, light enough to show on it
const WARM = '#F08A4B'; // warm sea water at the surface
const LEAF = '#3F9F4E'; // a tree's leaves
const TRUNK = '#7A5534';
const FALLEN = '#C98A3A'; // fallen leaves
const ANIMAL = '#A8784C'; // a deer's coat
const FACTORY = '#7D8794';
const FACTORY_DARK = '#5D6672';
const SMOKE = '#9AA1A9';
const FOSSIL = '#2E2824'; // coal and oil deep in the ground
const SEA_GRID = '#6FA2CF'; // the lines on a drawn globe
const NIGHT = '#0B1530'; // the night side of the Earth, laid over it
const MOON = '#C9CED6';
const MOON_SHADE = '#959BA5'; // the Moon's side away from the Sun
const MOON_DARK = '#1C2230'; // the Moon seen against the Sun
const BLOOD_MOON = '#B04A30'; // the Moon in the Earth's shadow
const BLOOD_SHADE = '#8A3A26';
const BEAM = '#FFC24A'; // sunlight, laid over the ground
const UMBRA = '#060A12'; // shadow, laid over the sunlight
const DAY_SKY = '#62A8E4';
const NIGHT_SKY = '#121B33';
const CORONA = '#F6F1DF';
const HILLS = '#2F4A34'; // the ground in a view from it
const STAR = '#FFB23E'; // a big star, and its hot core
const STAR_CORE = '#FFE08A';
const STAR_RED = '#E2522B'; // the star as it runs out of fuel
const STAR_RED_CORE = '#F28C45';
const FLASH = '#FFF4C4'; // a supernova's burst of light
const DISK = '#F07A2C'; // the glowing disk of matter round a black hole
const DISK_HOT = '#FFD36B';
const PHOTON = '#FFF1C9'; // the thin bright ring at a black hole's edge
const HOLE = '#030408';
const RAY = '#F2B441'; // a ray of light, strong enough to show on a light page

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const f1 = (v) => (+v).toFixed(1);
const smooth = (x) => { const t = clamp(x, 0, 1); return t * t * (3 - 2 * t); };
// A path through points.
const line = (P) => P.map(([x, y], i) => `${i ? 'L' : 'M'}${f1(x)} ${f1(y)}`).join('');
// A color between the hex colors a and b, k of the way from a to b.
const mixHex = (a, b, k) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - k) + parseInt(b.slice(i, i + 2), 16) * k).toString(16).padStart(2, '0')).join('');
// A moment given in the params as a fraction of the scene (TemplateScene turns a spoken word into one), kept in range.
const moment = (v, fallback, lo, hi) => (typeof v === 'number' && Number.isFinite(v) ? clamp(v, lo, hi) : fallback);
// The height of a polyline (points with x rising) at x.
const yOn = (P, x) => {
  for (let i = 1; i < P.length; i++) if (x <= P[i][0]) { const [x0, y0] = P[i - 1], [x1, y1] = P[i]; return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0 || 1); }
  return P[P.length - 1][1];
};
// A point on a quadratic curve from a over c to b, and points along it.
const quad = (a, c, b, t) => [(1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0], (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1]];
const quadPts = (a, c, b, n = 24) => Array.from({ length: n + 1 }, (_, i) => quad(a, c, b, i / n));

// A measured line: its points, the distance to each point along it and its length; and the point at a distance s
// along it.
function track(pts) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { pts, cum, len: cum[cum.length - 1] };
}
function pointAt(tr, s) {
  const d = clamp(s, 0, tr.len);
  let i = 1;
  while (i < tr.cum.length - 1 && tr.cum[i] < d) i++;
  const [ax, ay] = tr.pts[i - 1], [bx, by] = tr.pts[i], u = (d - tr.cum[i - 1]) / (tr.cum[i] - tr.cum[i - 1] || 1);
  return [ax + (bx - ax) * u, ay + (by - ay) * u];
}
// The points of a line up to `d` short of its end (where an arrowhead covers the rest).
function trimEnd(P, d) {
  const tr = track(P), stop = tr.len - d, out = [P[0]];
  for (let i = 1; i < P.length - 1 && tr.cum[i] < stop; i++) out.push(P[i]);
  return [...out, pointAt(tr, stop)];
}

// How far a looping thing has got `rate` times a second since `from` (a fraction of the scene), less its `lag`: below
// 0 it has not started yet, so each thing starts at its beginning instead of popping up half way.
const loopAt = (l, from, rate, lag = 0) => (l.t - from * l.dur) * rate - lag;
// Fades a looping thing in at the start of its run and out at the end (u from 0 to 1).
const ends = (u, a = 0.12, b = 0.2) => clamp(Math.min(u / a, (1 - u) / b), 0, 1);

// The look's own edge for drawn shapes: chalk lines in Blueprint, thin ink in Field guide, none on Night atlas's flat
// shapes.
const edge = (th, w) => (th.card ? ` stroke="${th.card.stroke}" stroke-width="${w ?? th.card.width}" stroke-linejoin="round"` : '');

// A stroke that draws itself along its path from `at` over `dur`. pathLength makes the dash work without measuring the
// path, and the fade keeps a round cap from showing as a dot before the stroke starts.
const drawn = (U, d, col, w, at, dur, ex = '') =>
  `<g opacity="0"${U.A('fade', at, 0.004)}><path d="${d}" pathLength="1000" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="1000 1010" stroke-dashoffset="1000"${U.A('draw', at, dur, { l: 1000 })}${ex}/></g>`;

// A solid arrowhead at `to`, pointing away from `from`, with an optional edge in the color `rim`.
const arrowHead = (from, to, col, size = 22, rim = '') => {
  const a = Math.atan2(to[1] - from[1], to[0] - from[0]), [x, y] = to, c = Math.cos(a), s = Math.sin(a);
  return `<path d="M${f1(x + c * 4)} ${f1(y + s * 4)}L${f1(x - size * c + size * 0.55 * s)} ${f1(y - size * s - size * 0.55 * c)}L${f1(x - size * c - size * 0.55 * s)} ${f1(y - size * s + size * 0.55 * c)}Z" fill="${col}"` +
    (rim ? ` stroke="${rim}" stroke-width="6" stroke-linejoin="round" paint-order="stroke"` : '') + '/>';
};
// A bold arrow along the points P in the look's highlight, edged in the ground color so it shows over clouds and
// water. It draws itself from `at` over `dur`, and its head comes on at the end.
function flowArrow(U, th, P, at, dur, w = 12) {
  const n = P.length, a = P[n - 2], b = P[n - 1], size = w * 2.3, stem = trimEnd(P, size * 0.8);
  return drawn(U, line(stem), th.bg, w + 10, at, dur) + drawn(U, line(stem), th.accent, w, at, dur) +
    `<g opacity="0"${U.A('fade', at + dur - 0.012, 0.012)}>${arrowHead(a, b, th.accent, size, th.bg)}</g>`;
}

// A label's text from the params: labels[key] (also spelled snake_case, or given at the top level), trimmed, or ''.
function said(p, key) {
  const L = p.labels && typeof p.labels === 'object' ? p.labels : {}, snake = key.replace(/[A-Z]/g, (m) => '_' + m.toLowerCase());
  for (const v of [L[key], L[snake], p[key]]) if (typeof v === 'string' && v.trim()) return v.trim();
  return '';
}

// A label's words in at most two lines of maxW pixels, at the biggest size that fits, or in three at the smallest size
// (the last line takes all the words left, so none is lost). Two lines are split where they come out most even.
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

// A name set next to the point (x, y): on the 'left' side the text ends there, on the 'right' side it starts there,
// and 'top' and 'bottom' center it above or below; 'middle' centers it on the point. It comes up into place at `at`.
function nameText(U, th, text, x, y, side, at, maxW = 330) {
  if (!text) return '';
  const { s, lines } = fitText(U, U.lab(text), maxW), lh = Math.round(s * 1.15), n = lines.length;
  let a = 'middle', tx = x, y0;
  if (side === 'left' || side === 'right') { a = side === 'left' ? 'end' : 'start'; tx = side === 'left' ? x - 16 : x + 16; y0 = y - ((n - 1) * lh) / 2 + s * 0.35; }
  else if (side === 'top') y0 = y - 14 - s * 0.24 - (n - 1) * lh;
  else if (side === 'bottom') y0 = y + 14 + s * 0.74;
  else y0 = y - ((n - 1) * lh) / 2 + s * 0.35;
  return `<g${U.A('up', at, 0.06)}>${lines.map((l, i) => U.T(f1(tx), f1(y0 + i * lh), l, { a, s, w: 700, f: th.ink, halo: 8 })).join('')}</g>`;
}

// A name with a line from the part at `part` (or from each of several parts) to the point (x, y), where the name is set
// (see nameText). Without a name nothing is drawn.
function callout(U, th, text, part, side, x, y, at, maxW) {
  if (!text) return '';
  return (Array.isArray(part[0]) ? part : [part]).map(([px, py]) =>
    `<g opacity="0"${U.A('fade', at, 0.004)}>${H.line(U, px, py, x, y, th.bg, 9, at, 0.06)}${H.line(U, px, py, x, y, th.ink, 3, at, 0.06)}</g>` +
    `<g${U.A('pop', at, 0.04, { cx: px, cy: py })}><circle cx="${f1(px)}" cy="${f1(py)}" r="8" fill="${th.ink}" stroke="${th.bg}" stroke-width="3"/></g>`).join('') +
    nameText(U, th, text, x, y, side, at + 0.04, maxW);
}

// The Sun's rays, turned by `turn` radians. The path itself turns (not a transform), so the measured size of the
// drawing stays its true size.
const sunRays = (x, y, r0, r1, turn, n = 12) => {
  let d = '';
  for (let k = 0; k < n; k++) { const a = ((2 * Math.PI) / n) * k + turn; d += `M${f1(x + r0 * Math.cos(a))} ${f1(y + r0 * Math.sin(a))}L${f1(x + r1 * Math.cos(a))} ${f1(y + r1 * Math.sin(a))}`; }
  return d;
};

// A cloud of overlapping puffs [x, y, r] on an optional body: a flat base [x, y, w, h] or a shape given as a list of
// points. With `at`, the puffs pop in one after another `step` apart from the biggest outward, and the body with the
// third; with `at` null the cloud is there from the start. In the outlined looks a wider stroke under all the parts
// draws one edge round the whole cloud, unless `bare` is set (for a layer laid over a cloud that has its edge).
function cloudShape(U, th, puffs, base, fill, at, step, ex = '', bare = false) {
  const body = !base ? [] : Array.isArray(base[0])
    ? [{ s: (a) => `<path d="${line(base)}Z"${a}/>`, cx: base[0][0], cy: base[0][1] }]
    : [{ s: (a) => `<rect x="${base[0]}" y="${base[1]}" width="${base[2]}" height="${base[3]}" rx="${base[3] / 2}"${a}/>`, cx: base[0] + base[2] / 2, cy: base[1] + base[3] / 2 }];
  const parts = [...puffs.map(([x, y, r]) => ({ s: (a) => `<circle cx="${x}" cy="${y}" r="${r}"${a}/>`, cx: x, cy: y })), ...body];
  const order = puffs.map((q, i) => i).sort((a, b) => puffs[b][2] - puffs[a][2] || a - b);
  const when = (i) => at + (i < puffs.length ? order.indexOf(i) : Math.min(2, puffs.length - 1)) * step;
  const layer = (attrs) => parts.map((q, i) => (at == null ? q.s(attrs) : `<g${U.A('pop', when(i), 0.05, { cx: q.cx, cy: q.cy })}>${q.s(attrs)}</g>`)).join('');
  return (th.card && !bare ? layer(` fill="none" stroke="${th.card.stroke}" stroke-width="${th.card.width * 2}"`) : '') + `<g${ex}>${layer(` fill="${fill}"`)}</g>`;
}

// Shapes (functions that take the attributes to draw with) filled in one color. In the outlined looks a wider stroke
// under them all draws one edge round the whole figure, not round each piece.
const figure = (th, shapes, fill) =>
  (th.card ? shapes.map((s) => s(` fill="none" stroke="${th.card.stroke}" stroke-width="${th.card.width * 2}" stroke-linejoin="round"`)).join('') : '') + shapes.map((s) => s(` fill="${fill}"`)).join('');

/* ---------------------------------------------------------------------------------------------------------------
 * water_cycle_landscape: a landscape cut open, with the sea on the left and a mountain on the right. The sun warms the
 * sea and water rises from it as vapor, drifts to the mountain and gathers into a cloud, which darkens and rains. The
 * rain runs down the mountain as a river back to the sea, and soaks into the ground, where it flows back to the sea
 * too. Each stage comes in after the one before, and then the water keeps going round.
 * ------------------------------------------------------------------------------------------------------------- */
const WC = {
  X0: 140, X1: 1780, BOT: 810, SEA_Y: 600,
  // The sea floor from the left edge to the shore, the land from the shore to the right edge, and the mountain from
  // its foot on the land over its peak to the right edge.
  floor: [[140, 792], [330, 784], [560, 748], [700, 700], [790, 640], [835, 600]],
  land: [[835, 600], [900, 592], [1000, 589], [1100, 586], [1780, 566]],
  mountain: [[1088, 588], [1180, 540], [1270, 470], [1350, 398], [1440, 322], [1500, 362], [1560, 412], [1630, 444], [1700, 470], [1780, 490]],
  sun: [300, 262],
  cloud: [[1040, 282, 44], [1095, 250, 58], [1165, 232, 70], [1235, 254, 56], [1285, 284, 40]],
  cloudBase: [1020, 268, 280, 44],
  wisps: [400, 466, 532, 598, 664],
  drift: [[640, 380], [780, 240], [1010, 290]],
  rain: Array.from({ length: 11 }, (_, k) => 1045 + k * 22),
  river: [[1250, 492], [1205, 527], [1160, 558], [1110, 583], [1040, 591], [960, 593], [890, 597], [845, 606]],
  // The top of the groundwater, a line run on past the sea floor (the land's outline cuts it off there), and its depth.
  bandTop: [[140, 613], [1780, 700]], bandH: 48,
  seep: [[1070, 597, 662], [1130, 580, 665], [1190, 545, 668]], // where rain soaks in: x, from y, to y
  flow: [[1560, 712], [1200, 693], [900, 677], [760, 669], [712, 660]], // the groundwater's way back to the sea
  // When each stage starts, as fractions of the scene.
  T: { sun: 0.04, evap: 0.12, drift: 0.22, cloud: 0.28, dark: 0.42, rain: 0.46, river: 0.56, ground: 0.66, sea: 0.78 },
};
const wcSurface = (x) => Math.min(yOn(WC.land, x), x >= WC.mountain[0][0] ? yOn(WC.mountain, x) : Infinity);
// A wisp of vapor: a short wave rising 100 px from 0,0.
const WISP = 'M0 0q13 -12.5 0 -25t0 -25t0 -25t0 -25';

function waterCycleBuild(p, c) {
  const { U, th } = c, id = c.id, T = WC.T, { X0, X1, BOT, SEA_Y } = WC, [sx, sy] = WC.sun;
  const landPoly = [...WC.floor, ...WC.land.slice(1), [X1, BOT], [X0, BOT]];
  const [b0, b1] = WC.bandTop, bh = WC.bandH, band = [b0, b1, [b1[0], b1[1] + bh], [b0[0], b0[1] + bh]], rock = [[b0[0], b0[1] + bh], [b1[0], b1[1] + bh], [X1, BOT], [b0[0], BOT]];
  let o = `<defs><clipPath id="${id}land"><path d="${line(landPoly)}Z"/></clipPath></defs>`;
  // The sea, behind the land, and the ground cut open: soil with grass on top, the groundwater (which shows at its
  // stage) and the rock under it.
  o += `<g${U.A('fade', 0, 0.05)}><rect x="${X0}" y="${SEA_Y}" width="${860 - X0}" height="${BOT - SEA_Y}" fill="${SEA}"/>` +
    `<path d="${line(landPoly)}Z" fill="${SOIL}"/><g clip-path="url(#${id}land)"><path d="${line(rock)}Z" fill="${BEDROCK}"/>` +
    `<g opacity="0"${U.A('fade', T.ground - 0.02, 0.05)}><path d="${line(band)}Z" fill="${GROUNDWATER}"/></g>` +
    `<path d="${line(WC.land)}" fill="none" stroke="${GRASS}" stroke-width="26"/></g>` +
    (th.card ? `<path d="${line([[X0, SEA_Y], [835, SEA_Y]])}" fill="none"${edge(th)}/><path d="${line(landPoly)}Z" fill="none"${edge(th)}/>` : '') + '</g>';
  // The mountain, standing on the land.
  const mtn = [...WC.mountain, [X1, yOn(WC.land, X1)], [WC.mountain[0][0], yOn(WC.land, WC.mountain[0][0])]];
  const peak = WC.mountain.findIndex(([, y], i, P) => P.every((q) => q[1] >= y)), shade = [...WC.mountain.slice(peak), [X1, yOn(WC.land, X1)], [1540, yOn(WC.land, 1540)], [1500, 500], [1468, 420]];
  o += `<g${U.A('up', 0.02, 0.06)}><path d="${line(mtn)}Z" fill="${ROCK}"/><path d="${line(shade)}Z" fill="${ROCK_SHADE}"/>${th.card ? `<path d="${line(mtn)}Z" fill="none"${edge(th)}/>` : ''}</g>`;
  // The sun, its rays turning slowly (see render).
  o += `<g${U.A('pop', T.sun, 0.06, { cx: sx, cy: sy })}><circle cx="${sx}" cy="${sy}" r="54" fill="${SUN}"/><circle cx="${sx}" cy="${sy}" r="34" fill="${SUN_CORE}"/>` +
    `<path id="${id}rays" d="${sunRays(sx, sy, 68, 92, 0)}" stroke="${SUN}" stroke-width="9" stroke-linecap="round"/></g>`;
  // Evaporation: wisps of vapor rising from the sea (moved by render).
  o += WC.wisps.map((x, k) => `<path id="${id}wisp${k}" d="${WISP}" fill="none" stroke="${VAPOR}" stroke-width="7" stroke-linecap="round" opacity="0"/>`).join('');
  // The vapor drifts over to the mountain along a dotted trail, as small puffs.
  const [d0, dc, d1] = WC.drift;
  o += `<g opacity="0"${U.A('fade', T.drift, 0.05)}><path d="${line(quadPts(d0, dc, d1))}" fill="none" stroke="${VAPOR}" stroke-width="5" stroke-linecap="round" stroke-dasharray="0.1 16"/></g>`;
  for (let j = 0; j < 5; j++) o += `<circle id="${id}puff${j}" r="10" fill="${VAPOR}" opacity="0"/>`;
  // Condensation: the cloud gathers puff by puff over the mountain, then darkens into a rain cloud.
  o += cloudShape(U, th, WC.cloud, WC.cloudBase, CLOUD, T.cloud, 0.025) +
    cloudShape(U, th, WC.cloud, WC.cloudBase, CLOUD_DARK, null, 0, ` opacity="0"${U.A('fade', T.dark, 0.06)}`, true);
  // Precipitation: rain falling from the cloud to the ground (moved by render).
  o += WC.rain.map((x, k) => `<path id="${id}rain${k}" d="M0 0V24" stroke="${VAPOR}" stroke-width="5" stroke-linecap="round" opacity="0"/>`).join('');
  // Runoff: a river runs down the mountain and across the land into the sea, its water moving (see render).
  o += drawn(U, line(WC.river), RIVER, 16, T.river, 0.1) +
    `<path id="${id}flow" d="${line(WC.river)}" fill="none" stroke="${SEA_LIGHT}" stroke-width="4" stroke-linecap="round" stroke-dasharray="16 30" opacity="0"/>`;
  // Groundwater: rain soaks into the ground, and the groundwater flows back to the sea.
  WC.seep.forEach((_, k) => { for (let j = 0; j < 2; j++) o += `<circle id="${id}seep${k}_${j}" r="7" fill="${DROP}" opacity="0"/>`; });
  for (let j = 0; j < 6; j++) o += `<circle id="${id}gw${j}" r="8" fill="${DROP}" opacity="0"/>`;
  // Collection: ripples run across the sea, where the water gathers again.
  const ripple = [];
  for (let x = 150; x <= 826; x += 6) ripple.push([x, SEA_Y + 18 + 5 * Math.sin(x / 14)]);
  o += `<path id="${id}ripple" d="${line(ripple)}" fill="none" stroke="${SEA_LIGHT}" stroke-width="5" stroke-linecap="round" stroke-dasharray="40 50" opacity="0"/>`;
  // The names, each as its stage comes in.
  o += nameText(U, th, said(p, 'sun'), sx + 84, sy, 'right', T.sun + 0.04, 300) +
    nameText(U, th, said(p, 'evaporation'), 692, 520, 'right', T.evap + 0.04, 290) +
    nameText(U, th, said(p, 'condensation'), 1310, 236, 'right', T.cloud + 0.08, 330) +
    nameText(U, th, said(p, 'precipitation'), 1036, 420, 'left', T.rain + 0.04, 300) +
    nameText(U, th, said(p, 'runoff'), 975, 602, 'bottom', T.river + 0.06, 300) +
    nameText(U, th, said(p, 'groundwater'), 1330, 706, 'middle', T.ground + 0.06, 380) +
    nameText(U, th, said(p, 'collection'), 470, 690, 'middle', T.sea + 0.02, 380);
  return o;
}

function waterCycleRender(l, st) {
  const T = WC.T, t = l.t, [sx, sy] = WC.sun;
  st.rays?.setAttribute('d', sunRays(sx, sy, 68, 92, (t * 5 * Math.PI) / 180));
  // Wisps rise from the sea and fade as they go.
  st.wisps.forEach((el, k) => {
    const s = loopAt(l, T.evap, 0.42, ((k * 3) % 5) * 0.2), u = s % 1;
    el.setAttribute('opacity', s < 0 ? '0' : ends(u, 0.15, 0.35).toFixed(2));
    if (s >= 0) el.setAttribute('transform', `translate(${f1(WC.wisps[k] + 5 * Math.sin(t * 1.7 + k * 2))} ${f1(WC.SEA_Y - 8 - u * 110)})`);
  });
  // Puffs of vapor drift along the trail to the cloud.
  st.puffs.forEach((el, j) => {
    const s = loopAt(l, T.drift + 0.02, 0.34, j * 0.2), u = s % 1, [x, y] = quad(...WC.drift, u);
    el.setAttribute('opacity', s < 0 ? '0' : ends(u, 0.1, 0.18).toFixed(2));
    el.setAttribute('cx', f1(x));
    el.setAttribute('cy', f1(y));
  });
  // Rain falls from the cloud's base to the ground under each drop.
  st.rain.forEach((el, k) => {
    const x = WC.rain[k], s = loopAt(l, T.rain, 1.25, (k * 0.618) % 1), u = s % 1, y0 = 314, y1 = wcSurface(x) - 30;
    el.setAttribute('opacity', s < 0 ? '0' : ends(u, 0.08, 0.1).toFixed(2));
    el.setAttribute('transform', `translate(${x} ${f1(y0 + u * (y1 - y0))})`);
  });
  // The river's water runs down to the sea, once the river is there.
  st.flow?.setAttribute('opacity', l.p >= T.river + 0.1 ? '1' : '0');
  st.flow?.setAttribute('stroke-dashoffset', f1(-t * 70));
  // Rain soaks down into the ground, and the groundwater flows to the sea.
  st.seep.forEach((row, k) => row.forEach((el, j) => {
    const [x, y0, y1] = WC.seep[k], s = loopAt(l, T.ground, 0.55, j * 0.5 + k * 0.17), u = s % 1;
    el.setAttribute('opacity', s < 0 ? '0' : ends(u, 0.15, 0.2).toFixed(2));
    el.setAttribute('cx', x);
    el.setAttribute('cy', f1(y0 + u * (y1 - y0)));
  }));
  st.gw.forEach((el, j) => {
    const s = loopAt(l, T.ground + 0.04, 0.16, j / 6), u = s % 1, [x, y] = pointAt(st.flowTrack, u * st.flowTrack.len);
    el.setAttribute('opacity', s < 0 ? '0' : ends(u, 0.08, 0.1).toFixed(2));
    el.setAttribute('cx', f1(x));
    el.setAttribute('cy', f1(y));
  });
  st.ripple?.setAttribute('opacity', l.p >= T.sea ? smooth((l.p - T.sea) / 0.04).toFixed(2) : '0');
  st.ripple?.setAttribute('stroke-dashoffset', f1(t * 30));
}

register('water_cycle_landscape', {
  cat: CAT, title: 'Water cycle',
  desc: 'A landscape cut open, with the sea, the sun and a mountain. Water evaporates from the sea as rising wisps, drifts to the mountain and gathers into a cloud, which darkens and rains. The rain runs down the mountain as a river back to the sea, and soaks into the ground, where the groundwater flows back to the sea too. The stages come one after another, then the water keeps going round.',
  use: 'The water cycle: evaporation, condensation, clouds, rain, rivers, groundwater and how water gets back to the sea.',
  params: 'labels: {sun, evaporation, condensation, precipitation, runoff, groundwater, collection} (each optional, 1 to 3 words from the narration)',
  example: { labels: { sun: 'Sun', evaporation: 'Evaporation', condensation: 'Condensation', precipitation: 'Precipitation', runoff: 'Runoff', groundwater: 'Groundwater', collection: 'Collection' } },
  build: waterCycleBuild,
  init(g, p, c) {
    const q = (s) => g.querySelector('#' + c.id + s);
    return {
      rays: q('rays'), wisps: WC.wisps.map((_, k) => q('wisp' + k)), puffs: [0, 1, 2, 3, 4].map((j) => q('puff' + j)), rain: WC.rain.map((_, k) => q('rain' + k)),
      flow: q('flow'), seep: WC.seep.map((_, k) => [0, 1].map((j) => q(`seep${k}_${j}`))), gw: [0, 1, 2, 3, 4, 5].map((j) => q('gw' + j)), flowTrack: track(WC.flow), ripple: q('ripple'),
    };
  },
  render: waterCycleRender,
});

/* ---------------------------------------------------------------------------------------------------------------
 * hurricane: on the left the storm from the side, on the right seen from above. The sea's surface warms, water
 * evaporates from it, moist air rises and towering clouds build up round a clear middle, the eye. Then the storm
 * starts to spin: seen from above, a spiral of clouds turns round a calm eye, with the wind blowing round it.
 * ------------------------------------------------------------------------------------------------------------- */
const HU = {
  sea: [220, 700, 980, 800], // x0, y0, x1, y1
  wisps: [262, 332, 402, 798, 868, 938],
  // The storm from the side, left half (the right half mirrors it round x 600): the tall cloud of the eyewall with its
  // straight side along the eye, the canopy it spreads into at the top, and a lower cloud further out.
  tower: { puffs: [[448, 626, 42], [430, 556, 54], [436, 476, 54], [452, 398, 52], [484, 336, 48], [528, 312, 40]], body: [[440, 664], [424, 590], [424, 470], [440, 380], [470, 316], [556, 300], [556, 664]] },
  canopy: { puffs: [[296, 262, 24], [364, 252, 32], [440, 248, 34], [514, 254, 28]], base: [250, 254, 310, 46] },
  outer: { puffs: [[302, 626, 36], [344, 594, 46], [388, 624, 36]], base: [266, 622, 158, 42] },
  rise: [[290, 682], [500, 682], [500, 322]], // the rising air, a curve from over the sea up into the eyewall
  mid: 600,
  // The storm from above.
  top: [1320, 470], R: 250, eye: 30, core: 98, wind: 292,
  T: { warm: 0.05, evap: 0.13, rise: 0.22, clouds: 0.34, spin: 0.5, eye: 0.6, wind: 0.68 },
};
// One arm of the spiral, from radius r0 out to r1, as a band that narrows from w0 to w1. It winds `dir` (1 clockwise
// on screen, -1 counterclockwise) by `sweep` radians as it goes out, starting at the angle a0.
function spiralArm(cx, cy, a0, dir, r0, r1, sweep, w0, w1, n = 30) {
  const C = [];
  for (let i = 0; i <= n; i++) {
    const s = i / n, r = r0 + (r1 - r0) * s, a = a0 + (dir * sweep * Math.log(r / r0)) / Math.log(r1 / r0);
    C.push([cx + r * Math.cos(a), cy + r * Math.sin(a), w0 + (w1 - w0) * Math.pow(s, 0.8)]);
  }
  const left = [], right = [];
  C.forEach(([x, y, w], i) => {
    const [px, py] = C[Math.max(0, i - 1)], [nx, ny] = C[Math.min(n, i + 1)], tl = Math.hypot(nx - px, ny - py) || 1, ox = (-(ny - py) / tl) * (w / 2), oy = ((nx - px) / tl) * (w / 2);
    left.push([x + ox, y + oy]);
    right.push([x - ox, y - oy]);
  });
  return line(left.concat(right.reverse())) + 'Z';
}
// The storm's turn at time l (degrees, positive clockwise on screen): it starts still and speeds up to a steady spin.
function stormTurn(l, from, dir) {
  const t0 = from * l.dur, t1 = (from + 0.12) * l.dur, w = 34;
  const deg = l.t <= t0 ? 0 : l.t < t1 ? (w * Math.pow(l.t - t0, 2)) / (2 * (t1 - t0)) : w * ((t1 - t0) / 2 + (l.t - t1));
  return dir * deg;
}
// The storm spins counterclockwise seen from above unless `clockwise` is set (as storms south of the equator do).
const stormDir = (p) => (p.clockwise === true || p.clockwise === 'true' ? 1 : -1);
const mirror = (x) => 2 * HU.mid - x;

function hurricaneBuild(p, c) {
  const { U, th } = c, id = c.id, T = HU.T, [x0, y0, x1, y1] = HU.sea, M = HU.mid, dir = stormDir(p), [cx, cy] = HU.top;
  // The sea, with its surface warming up.
  let o = `<g${U.A('fade', 0, 0.05)}><rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" fill="${SEA}"${edge(th)}/></g>` +
    `<g opacity="0"${U.A('fade', T.warm, 0.06)}><rect x="${x0}" y="${y0}" width="${x1 - x0}" height="26" fill="${WARM}"${edge(th)}/></g>`;
  // Water evaporates from the warm sea as rising wisps (moved by render).
  o += HU.wisps.map((x, k) => `<path id="${id}wisp${k}" d="${WISP}" fill="none" stroke="${VAPOR}" stroke-width="7" stroke-linecap="round" opacity="0"/>`).join('');
  // The towering clouds build up from the sea round the clear eye, and spread out at the top.
  const flip = (puffs) => puffs.map(([x, y, r]) => [mirror(x), y, r]);
  const flipBase = (b) => (Array.isArray(b[0]) ? b.map(([x, y]) => [mirror(x), y]) : [mirror(b[0] + b[2]), b[1], b[2], b[3]]);
  const grow = (inner, at, cxg, cyg, ax = 'y') => `<g${U.A('grow', at, 0.1, { ax, cx: cxg, cy: cyg })}>${inner}</g>`;
  [1, -1].forEach((side) => {
    const P = (q) => (side > 0 ? q : flip(q)), B = (b) => (side > 0 ? b : flipBase(b)), X = (x) => (side > 0 ? x : mirror(x));
    o += grow(cloudShape(U, th, P(HU.outer.puffs), B(HU.outer.base), CLOUD, null, 0), T.clouds, X(344), 664);
    o += grow(cloudShape(U, th, P(HU.tower.puffs), B(HU.tower.body), CLOUD, null, 0), T.clouds + 0.02, X(490), 664);
    o += grow(cloudShape(U, th, P(HU.canopy.puffs), B(HU.canopy.base), CLOUD, null, 0), T.clouds + 0.09, X(556), 276, 'x');
  });
  // The moist air rises from over the sea up into the clouds.
  const rise = quadPts(...HU.rise, 30);
  o += flowArrow(U, th, rise, T.rise, 0.08) + flowArrow(U, th, rise.map(([x, y]) => [mirror(x), y]), T.rise + 0.01, 0.08);
  // From above: the sea, and the spiral of clouds, which pops up and starts to spin (see render).
  o += `<defs><clipPath id="${id}view"><circle cx="${cx}" cy="${cy}" r="${HU.R}"/></clipPath></defs>`;
  const arms = [0, 1, 2, 3].map((k) => spiralArm(cx, cy, (Math.PI * k) / 2, -dir, 66, 238, 2.7, 62, 8));
  const swirl = (attrs) => `<circle cx="${cx}" cy="${cy}" r="${HU.core}"${attrs}/>` + arms.map((d) => `<path d="${d}"${attrs}/>`).join('');
  o += `<g opacity="0"${U.A('fade', T.spin - 0.02, 0.05)}><circle cx="${cx}" cy="${cy}" r="${HU.R}" fill="${SEA}"/></g>` +
    `<g clip-path="url(#${id}view)"><g${U.A('pop', T.spin, 0.08, { cx, cy })}><g id="${id}spin">` +
    (th.card ? swirl(` fill="none" stroke="${th.card.stroke}" stroke-width="${th.card.width * 2}"`) : '') + swirl(` fill="${CLOUD}"`) + '</g></g></g>' +
    `<circle cx="${cx}" cy="${cy}" r="${HU.R}" fill="none" stroke="${th.muted}" stroke-width="4" opacity="0"${U.A('fade', T.spin - 0.02, 0.05)}/>`;
  // The calm eye opens in the middle.
  o += `<g${U.A('pop', T.eye, 0.06, { cx, cy })}><circle cx="${cx}" cy="${cy}" r="${HU.eye}" fill="${SEA}"${edge(th)}/></g>`;
  // The wind blows round the storm: three arrows round the view, the way it spins.
  [-90, 30, 150].forEach((mid, k) => {
    const pts = [];
    for (let i = 0; i <= 20; i++) { const a = ((mid - dir * (28 - 2.8 * i)) * Math.PI) / 180; pts.push([cx + HU.wind * Math.cos(a), cy + HU.wind * Math.sin(a)]); }
    o += flowArrow(U, th, pts, T.wind + k * 0.012, 0.06, 10);
  });
  // The names: the sea, the rising air and the clouds on the side view; the eye and the wind on the view from above.
  const windAt = [cx + HU.wind * Math.cos(Math.PI / 6), cy + HU.wind * Math.sin(Math.PI / 6)];
  o += nameText(U, th, said(p, 'warmOcean'), HU.mid, 764, 'middle', T.warm + 0.05, 600) +
    nameText(U, th, said(p, 'risingAir'), 386, 480, 'left', T.rise + 0.06, 250) +
    nameText(U, th, said(p, 'clouds'), 400, 244, 'top', T.clouds + 0.08, 320) +
    callout(U, th, said(p, 'eye'), [[M, 440], [cx, cy]], 'top', 990, 222, T.eye + 0.03, 300) +
    callout(U, th, said(p, 'wind'), windAt, 'right', 1630, 650, T.wind + 0.06, 240);
  return o;
}

register('hurricane', {
  cat: CAT, title: 'Hurricane',
  desc: 'A hurricane from the side and from above. The sea\'s surface warms, water evaporates from it, moist air rises and towering clouds build up round a clear middle. Then the storm starts to spin: seen from above, a spiral of clouds turns round a calm eye, with the wind blowing round it. No sizes, speeds or names.',
  use: 'How hurricanes, typhoons and tropical cyclones form: warm sea water, evaporation, rising air, storm clouds, the spin and the eye.',
  params: 'labels: {warmOcean, risingAir, clouds, eye, wind} (each optional, 1 to 3 words from the narration), clockwise (optional, default false: the storm spins counterclockwise seen from above, as north of the equator; true for a storm south of the equator)',
  example: { labels: { warmOcean: 'Warm ocean water', risingAir: 'Rising air', clouds: 'Storm clouds', eye: 'Eye', wind: 'Wind' } },
  build: hurricaneBuild,
  init(g, p, c) {
    const q = (s) => g.querySelector('#' + c.id + s);
    return { wisps: HU.wisps.map((_, k) => q('wisp' + k)), spin: q('spin'), dir: stormDir(p) };
  },
  render(l, st) {
    const T = HU.T, [cx, cy] = HU.top;
    st.wisps.forEach((el, k) => {
      const s = loopAt(l, T.evap, 0.45, ((k * 4) % 6) / 6), u = s % 1;
      el.setAttribute('opacity', s < 0 ? '0' : ends(u, 0.15, 0.35).toFixed(2));
      if (s >= 0) el.setAttribute('transform', `translate(${f1(HU.wisps[k] + 5 * Math.sin(l.t * 1.7 + k * 2))} ${f1(HU.sea[1] - 8 - u * 96)})`);
    });
    st.spin?.setAttribute('transform', `rotate(${stormTurn(l, T.spin, st.dir).toFixed(2)} ${cx} ${cy})`);
  },
});

/* ---------------------------------------------------------------------------------------------------------------
 * carbon_cycle: a landscape with the air above, a tree, a deer, a factory, the sea and the ground cut open with coal
 * and oil deep in it. Carbon is drawn as dots: dots float in the air, and arrows carry dots from one place to the
 * next, each in turn: from the air into the tree, from the tree to the deer that eats it and out of the deer back into
 * the air, from fallen leaves down into the ground, from the air into the sea, and from the coal and oil up through
 * the factory, which burns them, back into the air. Then all the arrows keep carrying carbon round.
 * ------------------------------------------------------------------------------------------------------------- */
const CC = {
  X0: 160, X1: 1760, GY: 600, BOT: 800, SHORE: 1250, SOIL_B: 668,
  tree: { x: 380, top: 480, crown: [[380, 414, 76], [318, 448, 50], [442, 448, 50], [380, 470, 52]] },
  fallen: [[524, 597, -20], [550, 594, 15], [576, 598, -8]],
  deer: 770, // the middle of its body
  factory: { x0: 960, x1: 1110, roof: 520, chimney: [1050, 1080, 410] },
  fossil: [[880, 742, 62, 22], [966, 736, 70, 26], [1046, 748, 48, 18]],
  // The carbon in the air: dots spread across the sky, and in the sea once it has taken carbon in.
  air: [[268, 252], [356, 216], [452, 268], [540, 222], [628, 280], [716, 230], [1146, 222], [1236, 276], [1324, 228], [1412, 270], [1588, 232], [1660, 282], [826, 290], [1052, 292]],
  sea: [[1360, 686], [1454, 724], [1560, 676], [1650, 730], [1702, 662]],
  // The arrows: their points, and when each is drawn (as fractions of the scene).
  arrows: {
    plants: { pts: [[392, 236], [386, 334]], at: 0.17 },
    eat: { pts: [[452, 420], [560, 392], [650, 444]], at: 0.31 },
    breathe: { pts: [[800, 480], [822, 360], [862, 252]], at: 0.38 },
    decay: { pts: [[550, 606], [550, 694]], at: 0.48 },
    ocean: { pts: [[1500, 244], [1500, 590]], at: 0.57 },
    dig: { pts: [[1004, 712], [1004, 606]], at: 0.69 },
    burn: { pts: [[1065, 402], [1072, 330], [1086, 252]], at: 0.77 },
  },
  T: { air: 0.04, tree: 0.1, deer: 0.26, fallen: 0.45, sea: 0.55, fossil: 0.64, factory: 0.72 },
};
// An arrow's line: a straight one through two points, or a curve through three.
const ccLine = (pts) => (pts.length === 3 ? quadPts(pts[0], pts[1], pts[2], 24) : pts);
// A deer standing on the ground, facing left toward the tree, its body's middle at x.
const deerShapes = (x, gy) => [
  ...[-50, -32, 28, 46].map((dx) => (a) => `<rect x="${x + dx - 5.5}" y="${gy - 84}" width="11" height="84" rx="4"${a}/>`),
  (a) => `<ellipse cx="${x}" cy="${gy - 88}" rx="68" ry="29"${a}/>`,
  (a) => `<path d="M${x - 62} ${gy - 98}L${x - 36} ${gy - 110}L${x - 58} ${gy - 162}L${x - 80} ${gy - 154}Z"${a}/>`,
  (a) => `<ellipse cx="${x - 86}" cy="${gy - 162}" rx="25" ry="14" transform="rotate(-20 ${x - 86} ${gy - 162})"${a}/>`,
  (a) => `<ellipse cx="${x - 64}" cy="${gy - 180}" rx="6" ry="13" transform="rotate(28 ${x - 64} ${gy - 180})"${a}/>`,
  (a) => `<ellipse cx="${x - 74}" cy="${gy - 182}" rx="6" ry="13" transform="rotate(-4 ${x - 74} ${gy - 182})"${a}/>`,
  (a) => `<ellipse cx="${x + 66}" cy="${gy - 104}" rx="8" ry="13" transform="rotate(36 ${x + 66} ${gy - 104})"${a}/>`,
];
// A factory with a sawtooth roof and a chimney.
const factoryShapes = (f, gy) => {
  const teeth = [];
  for (let x = f.x0; x < f.x1 - 1; x += 50) teeth.push(`L${x} ${f.roof - 30}L${x + 50} ${f.roof}`);
  return [
    (a) => `<path d="M${f.x0} ${gy}V${f.roof}${teeth.join('')}V${gy}Z"${a}/>`,
    (a) => `<rect x="${f.chimney[0]}" y="${f.chimney[2]}" width="${f.chimney[1] - f.chimney[0]}" height="${gy - f.chimney[2]}"${a}/>`,
  ];
};

function carbonBuild(p, c) {
  const { U, th } = c, id = c.id, T = CC.T, { X0, X1, GY, BOT, SHORE, SOIL_B } = CC;
  const dot = (attrs) => `<circle r="9" fill="${th.accent}" stroke="${th.bg}" stroke-width="3"${attrs}/>`;
  // The sea, and the ground cut open: soil on top, rock below with coal and oil deep in it.
  const land = [[X0, GY], [SHORE, GY], [SHORE + 80, BOT], [X0, BOT]];
  let o = `<defs><clipPath id="${id}land"><path d="${line(land)}Z"/></clipPath></defs>` +
    `<g${U.A('fade', 0, 0.05)}><rect x="${SHORE - 20}" y="${GY}" width="${X1 - SHORE + 20}" height="${BOT - GY}" fill="${SEA}"/>` +
    `<path d="${line(land)}Z" fill="${BEDROCK}"/><g clip-path="url(#${id}land)"><rect x="${X0}" y="${GY}" width="${SHORE + 80 - X0}" height="${SOIL_B - GY}" fill="${SOIL}"/>` +
    `<path d="M${X0} ${GY}H${SHORE}" stroke="${GRASS}" stroke-width="22"/></g>` +
    CC.fossil.map(([x, y, rx, ry]) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${FOSSIL}"/>`).join('') +
    (th.card ? `<path d="${line([[SHORE, GY], [X1, GY], [X1, BOT], [SHORE + 80, BOT]])}" fill="none"${edge(th)}/><path d="${line(land)}Z" fill="none"${edge(th)}/>` : '') + '</g>';
  // The carbon in the air, floating (moved by render).
  o += CC.air.map(([x, y], k) => `<g${U.A('pop', T.air + (k % 7) * 0.008, 0.04, { cx: x, cy: y })}><g id="${id}air${k}">${dot(` cx="${x}" cy="${y}"`)}</g></g>`).join('');
  // The tree grows up from the ground.
  const { tree } = CC;
  o += `<g${U.A('grow', T.tree, 0.07, { cx: tree.x, cy: GY })}>` + figure(th, [(a) => `<rect x="${tree.x - 13}" y="${tree.top}" width="26" height="${GY - tree.top + 4}"${a}/>`], TRUNK) +
    figure(th, tree.crown.map(([x, y, r]) => (a) => `<circle cx="${x}" cy="${y}" r="${r}"${a}/>`), LEAF) + '</g>';
  // The deer, the fallen leaves, and the factory with its smoke (moved by render).
  o += `<g${U.A('pop', T.deer, 0.06, { cx: CC.deer, cy: GY - 60 })}>${figure(th, deerShapes(CC.deer, GY), ANIMAL)}</g>`;
  o += CC.fallen.map(([x, y, a], k) => `<g${U.A('pop', T.fallen + k * 0.01, 0.04, { cx: x, cy: y })}><ellipse cx="${x}" cy="${y}" rx="13" ry="6" transform="rotate(${a} ${x} ${y})" fill="${FALLEN}"${edge(th, 1.5)}/></g>`).join('');
  o += `<g${U.A('pop', T.factory, 0.06, { cx: (CC.factory.x0 + CC.factory.x1) / 2, cy: GY - 40 })}>${figure(th, factoryShapes(CC.factory, GY), FACTORY)}` +
    [990, 1030, 1070].map((x) => `<rect x="${x - 12}" y="${GY - 54}" width="24" height="24" fill="${FACTORY_DARK}"/>`).join('') + '</g>';
  for (let j = 0; j < 4; j++) o += `<circle id="${id}smoke${j}" r="10" fill="${SMOKE}" opacity="0"/>`;
  // The sea's carbon, taken in from the air.
  o += CC.sea.map(([x, y], k) => `<g${U.A('pop', T.sea + 0.08 + k * 0.012, 0.04, { cx: x, cy: y })}>${dot(` cx="${x}" cy="${y}"`)}</g>`).join('');
  // The arrows, each drawn as its stage comes, and the dots they carry (moved by render).
  Object.entries(CC.arrows).forEach(([key, a]) => {
    const P = ccLine(a.pts), n = P.length, stem = trimEnd(P, 16);
    o += drawn(U, line(stem), th.muted, 6, a.at, 0.05) + `<g opacity="0"${U.A('fade', a.at + 0.04, 0.012)}>${arrowHead(P[n - 2], P[n - 1], th.muted, 24)}</g>`;
    for (let j = 0; j < 3; j++) o += `<g id="${id}${key}${j}" opacity="0">${dot(' cx="0" cy="0"')}</g>`;
  });
  // The names, each as its part comes in.
  o += nameText(U, th, said(p, 'atmosphere'), 960, 196, 'middle', T.air + 0.04, 520) +
    nameText(U, th, said(p, 'plants'), tree.x, 640, 'middle', T.tree + 0.08, 330) +
    nameText(U, th, said(p, 'animals'), CC.deer, 640, 'middle', T.deer + 0.06, 330) +
    nameText(U, th, said(p, 'decay'), 550, 740, 'middle', T.fallen + 0.05, 300) +
    nameText(U, th, said(p, 'ocean'), 1510, 700, 'middle', T.sea + 0.05, 380) +
    nameText(U, th, said(p, 'fossilFuels'), 960, 742, 'middle', T.fossil + 0.02, 300) +
    nameText(U, th, said(p, 'burning'), 1112, 330, 'right', T.factory + 0.06, 290);
  return o;
}

register('carbon_cycle', {
  cat: CAT, title: 'Carbon cycle',
  desc: 'A landscape with the air, a tree, a deer, a factory, the sea and the ground cut open with coal and oil deep in it. Carbon is drawn as dots, and arrows carry the dots from place to place in turn: from the air into the tree, from the tree to the deer that eats it and out of the deer into the air, from fallen leaves into the ground, from the air into the sea, and from the coal and oil through the factory that burns them back into the air. Then the dots keep going round.',
  use: 'The carbon cycle: how carbon moves between the air, plants, animals, the oceans and the ground, and how burning fossil fuels adds carbon dioxide to the air.',
  params: 'labels: {atmosphere, plants, animals, ocean, decay, fossilFuels, burning} (each optional, 1 to 3 words from the narration)',
  example: { labels: { atmosphere: 'Atmosphere', plants: 'Plants', animals: 'Animals', ocean: 'Ocean', decay: 'Decay', fossilFuels: 'Fossil fuels', burning: 'Burning' } },
  build: carbonBuild,
  init(g, p, c) {
    const q = (s) => g.querySelector('#' + c.id + s);
    return {
      air: CC.air.map((_, k) => q('air' + k)), smoke: [0, 1, 2, 3].map((j) => q('smoke' + j)),
      flows: Object.entries(CC.arrows).map(([key, a]) => ({ at: a.at, tr: track(ccLine(a.pts)), dots: [0, 1, 2].map((j) => q(key + j)) })),
    };
  },
  render(l, st) {
    const t = l.t, cx = (CC.factory.chimney[0] + CC.factory.chimney[1]) / 2, cy = CC.factory.chimney[2];
    // The carbon in the air drifts gently.
    st.air.forEach((el, k) => el?.setAttribute('transform', `translate(${f1(7 * Math.sin(t * 0.9 + k * 1.3))} ${f1(5 * Math.cos(t * 0.7 + k * 2.1))})`));
    // Each arrow carries its dots along once it is drawn.
    st.flows.forEach((f) => f.dots.forEach((el, j) => {
      const s = loopAt(l, f.at + 0.05, 0.42, j / 3), u = s % 1, [x, y] = pointAt(f.tr, u * f.tr.len);
      el.setAttribute('opacity', s < 0 ? '0' : ends(u, 0.1, 0.15).toFixed(2));
      el.setAttribute('transform', `translate(${f1(x)} ${f1(y)})`);
    }));
    // Smoke rises from the chimney once the factory is there.
    st.smoke.forEach((el, j) => {
      const s = loopAt(l, CC.T.factory + 0.04, 0.4, j / 4), u = s % 1;
      el.setAttribute('opacity', s < 0 ? '0' : (0.85 * ends(u, 0.1, 0.4)).toFixed(2));
      el.setAttribute('cx', f1(cx + 10 * u + 4 * Math.sin(t * 2 + j)));
      el.setAttribute('cy', f1(cy - 8 - u * 90));
      el.setAttribute('r', f1(10 + 16 * u));
    });
  },
});

/* ---------------------------------------------------------------------------------------------------------------
 * eclipse: the Sun, the Moon and the Earth lining up, not to scale, with the sunlight as a pale band and the shadows
 * dark in it. Solar: the Moon moves along its orbit between the Sun and the Earth, and its shadow falls on the Earth;
 * a round view from the ground shows the Moon sliding over the Sun until only the corona shows round it. Lunar: the
 * Earth is between, and the Moon moves along its orbit into the Earth's shadow and turns a dim red.
 * ------------------------------------------------------------------------------------------------------------- */
const EC = {
  // Each body as [x, y, r]; the Moon's orbit round the Earth, the angle the Moon starts at and the one where it lines
  // up, and the part of the orbit drawn.
  solar: { sun: [330, 470, 130], earth: [1460, 470, 140], moonR: 38, orbit: 300, from: Math.PI + 0.62, to: Math.PI, arc: [Math.PI - 0.22, Math.PI + 0.7], inset: [1250, 712, 84] },
  lunar: { sun: [330, 470, 150], earth: [960, 470, 110], moonR: 44, orbit: 440, from: -0.56, to: 0, arc: [-0.62, 0.22] },
};
const ecKind = (p) => (p.kind === 'lunar' ? 'lunar' : 'solar');
const ecAt = (p) => moment(p.at, 0.6, 0.35, 0.8);
// The Moon's angle on its orbit at progress p: it sets off at 0.12 and lines up at `at`, then stays.
const ecAngle = (E, p, at) => E.to + (E.from - E.to) * (1 - smooth((p - 0.12) / (at - 0.12)));
const ecMoon = (E, a) => [E.earth[0] + E.orbit * Math.cos(a), E.earth[1] + E.orbit * Math.sin(a)];
// A body lit from the left: a disc with its right half in shade.
const litDisc = (x, y, r, fill, shade, ex = '') => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"${ex}/><path d="M${x} ${y - r}A${r} ${r} 0 0 1 ${x} ${y + r}Z" fill="${shade}"/>`;
// The Earth: blue with a grid of lines, its night side darker.
function earthDisc(th, id, x, y, r) {
  let grid = '';
  [0.42, 0.78].forEach((k) => (grid += `<ellipse cx="${x}" cy="${y}" rx="${f1(r * k)}" ry="${r}" fill="none" stroke="${SEA_GRID}" stroke-width="4"/>`));
  [-0.62, -0.3, 0, 0.3, 0.62].forEach((k) => { const yy = y + r * k, w = r * Math.sqrt(1 - k * k); grid += `<path d="M${f1(x - w)} ${f1(yy)}H${f1(x + w)}" stroke="${SEA_GRID}" stroke-width="4"/>`; });
  return `<defs><clipPath id="${id}earth"><circle cx="${x}" cy="${y}" r="${r}"/></clipPath></defs><circle cx="${x}" cy="${y}" r="${r}" fill="${SEA}"/>` +
    `<g clip-path="url(#${id}earth)">${grid}<path d="M${x} ${y - r}A${r} ${r} 0 0 1 ${x} ${y + r}Z" fill="${NIGHT}" opacity=".42"/></g>` +
    (th.card ? `<circle cx="${x}" cy="${y}" r="${r}" fill="none"${edge(th)}/>` : '');
}
// A cone of shadow: from the two sides of a body of radius r at M, along the unit direction u, to half-widths w at
// distance len (0 for a point).
const cone = (M, u, r, len, w) => {
  const n = [-u[1], u[0]], A = [M[0] + u[0] * len, M[1] + u[1] * len];
  return line([[M[0] + n[0] * r, M[1] + n[1] * r], [A[0] + n[0] * w, A[1] + n[1] * w], [A[0] - n[0] * w, A[1] - n[1] * w], [M[0] - n[0] * r, M[1] - n[1] * r]]) + 'Z';
};
// The corona round the Moon in the view from the ground: a ragged star of pale light.
const corona = (x, y, r) => line(Array.from({ length: 32 }, (_, i) => { const a = (Math.PI * i) / 16, k = i % 2 ? 1.18 : [1.75, 1.5, 1.95, 1.45][(i / 2) % 4]; return [x + r * k * Math.cos(a), y + r * k * Math.sin(a)]; })) + 'Z';

function eclipseBuild(p, c) {
  const { U, th } = c, id = c.id, kind = ecKind(p), E = EC[kind], at = ecAt(p), [sx, sy, sr] = E.sun, [ex, ey, er] = E.earth;
  const M0 = ecMoon(E, E.from), M1 = ecMoon(E, E.to);
  // The sunlight: a pale band from the Sun past the Earth.
  const far = kind === 'solar' ? ex : 1800, spread = kind === 'solar' ? er : sr + 10, beam = `${line([[sx, sy - sr], [far, ey - spread], [far, ey + spread], [sx, sy + sr]])}Z`;
  let o = `<defs><clipPath id="${id}beam"><path d="${beam}"/></clipPath></defs><g opacity="0"${U.A('fade', 0.05, 0.06)}><path d="${beam}" fill="${BEAM}" opacity=".22"/></g>`;
  // The shadows, which show only in the sunlight: in a solar eclipse the Moon's, which moves with it (see render); in a
  // lunar one the Earth's, which narrows behind it, inside a wider half shadow.
  if (kind === 'solar') o += `<g clip-path="url(#${id}beam)"><path id="${id}pen" fill="${UMBRA}" opacity="0"/><path id="${id}umb" fill="${UMBRA}" opacity="0"/></g>`;
  else {
    const u = [1, 0], d = far - ex;
    o += `<g clip-path="url(#${id}beam)"><g opacity="0"${U.A('fade', 0.1, 0.06)}><path d="${cone([ex, ey], u, er, d, spread - 12)}" fill="${UMBRA}" opacity=".28"/><path d="${cone([ex, ey], u, er, d, 0)}" fill="${UMBRA}" opacity=".82"/></g></g>`;
  }
  // The Moon's orbit, the part of it the Moon travels.
  const arc = [];
  for (let i = 0; i <= 40; i++) arc.push(ecMoon(E, E.arc[0] + ((E.arc[1] - E.arc[0]) * i) / 40));
  o += `<g opacity="0"${U.A('fade', 0.08, 0.05)}><path d="${line(arc)}" fill="none" stroke="${th.muted}" stroke-width="3" stroke-dasharray="12 12"/></g>`;
  // The Sun, the Earth and the Moon (moved along its orbit by render; in a lunar eclipse it reddens in the shadow).
  o += `<g${U.A('pop', 0, 0.07, { cx: sx, cy: sy })}><circle cx="${sx}" cy="${sy}" r="${sr + 18}" fill="${SUN}" opacity=".3"/><circle cx="${sx}" cy="${sy}" r="${sr}" fill="${SUN}"/><circle cx="${sx}" cy="${sy}" r="${f1(sr * 0.72)}" fill="${SUN_CORE}"/></g>`;
  o += `<g${U.A('pop', 0.04, 0.07, { cx: ex, cy: ey })}>${earthDisc(th, id, ex, ey, er)}</g>`;
  const mr = E.moonR;
  o += `<g id="${id}moon" transform="translate(${f1(M0[0])} ${f1(M0[1])})"><g${U.A('pop', 0.08, 0.05, { cx: 0, cy: 0 })}>${litDisc(0, 0, mr, MOON, MOON_SHADE, edge(th))}` +
    (kind === 'lunar' ? `<g id="${id}red" opacity="0">${litDisc(0, 0, mr, BLOOD_MOON, BLOOD_SHADE, edge(th))}</g>` : '') + '</g></g>';
  if (kind === 'solar') {
    // Where the Moon's shadow falls on the Earth: a dark spot with a paler ring round it (placed by render).
    o += `<g clip-path="url(#${id}earth)"><ellipse id="${id}spotP" cx="${ex - er + 14}" cy="${ey}" rx="34" ry="62" fill="${UMBRA}" opacity="0"/><ellipse id="${id}spotU" cx="${ex - er + 6}" cy="${ey}" rx="11" ry="18" fill="${UMBRA}" opacity="0"/></g>`;
    // The view from the ground there: the Moon slides over the Sun, the sky darkens and the corona shows.
    const [ix, iy, ir] = E.inset, s = 30;
    o += `<defs><clipPath id="${id}inset"><circle cx="${ix}" cy="${iy}" r="${ir}"/></clipPath></defs>` +
      `<g opacity="0"${U.A('fade', 0.18, 0.05)}>${H.line(U, ex - er + 6, ey, ix - ir * 0.8, iy - ir * 0.6, th.ink, 3, 0.18, 0.04)}${H.line(U, ex - er + 6, ey, ix + ir * 0.8, iy - ir * 0.6, th.ink, 3, 0.18, 0.04)}</g>` +
      `<g${U.A('pop', 0.2, 0.06, { cx: ix, cy: iy })}><g clip-path="url(#${id}inset)"><circle id="${id}sky" cx="${ix}" cy="${iy}" r="${ir}" fill="${DAY_SKY}"/>` +
      `<path id="${id}cor" d="${corona(ix, iy - 14, s)}" fill="${CORONA}" opacity="0"/><circle cx="${ix}" cy="${iy - 14}" r="${s}" fill="${SUN_CORE}"/>` +
      `<circle id="${id}imoon" cx="${ix - 2.4 * s}" cy="${iy - 14}" r="${s + 1}" fill="${MOON_DARK}"/>` +
      `<path d="M${ix - ir} ${iy + ir * 0.62}Q${ix - ir * 0.5} ${iy + ir * 0.42} ${ix} ${iy + ir * 0.58}T${ix + ir} ${iy + ir * 0.5}V${iy + ir}H${ix - ir}Z" fill="${HILLS}"/></g>` +
      `<circle cx="${ix}" cy="${iy}" r="${ir}" fill="none" stroke="${th.ink}" stroke-width="4"/></g>`;
  }
  // The names. The Moon's comes when it has lined up, beside where it stops.
  const L = (k) => said(p, k);
  o += nameText(U, th, L('sun'), sx, sy + sr + 22, 'bottom', 0.06, 340);
  if (kind === 'solar') {
    const [ix, iy, ir] = E.inset;
    o += nameText(U, th, L('earth'), ex + er + 6, ey, 'right', 0.1, 250) +
      nameText(U, th, L('moon'), M1[0] - mr - 6, M1[1], 'left', at + 0.03, 300) +
      callout(U, th, L('shadow'), [(M1[0] + ex - er) / 2 + 10, ey - 6], 'top', 1300, 286, at - 0.04, 300) +
      nameText(U, th, L('totality'), ix + ir + 8, iy, 'right', at + 0.04, 300);
  } else {
    o += nameText(U, th, L('earth'), ex, ey + er + 14, 'bottom', 0.1, 340) +
      nameText(U, th, L('moon'), M1[0] + mr + 6, M1[1], 'right', at + 0.03, 300) +
      callout(U, th, L('shadow'), [(ex + er + M1[0] - mr) / 2, ey + 40], 'bottom', 1160, 668, 0.2, 300) +
      nameText(U, th, L('totality'), M1[0], M1[1] + mr + 14, 'bottom', at + 0.04, 300);
  }
  return o;
}

function eclipseRender(l, st, p) {
  const kind = ecKind(p), E = EC[kind], at = ecAt(p), a = ecAngle(E, l.p, at), M = ecMoon(E, a), [sx, sy, sr] = E.sun, [ex, , er] = E.earth;
  st.moon.setAttribute('transform', `translate(${f1(M[0])} ${f1(M[1])})`);
  const off = Math.abs(a - E.to); // how far the Moon still is from lining up (radians)
  if (kind === 'lunar') { st.red?.setAttribute('opacity', smooth((0.2 - off) / 0.14).toFixed(3)); return; }
  // The Moon's shadow: its dark cone narrows to a point just inside the Earth, in a wider pale one; both fade in as
  // the Moon nears the line from the Sun to the Earth.
  const D = Math.hypot(M[0] - sx, M[1] - sy), u = [(M[0] - sx) / D, (M[1] - sy) / D], mr = E.moonR, apex = (ex - er - M[0]) / u[0] + 8, show = smooth((0.32 - off) / 0.22);
  st.umb.setAttribute('d', cone(M, u, mr * 0.98, apex, 0));
  st.pen.setAttribute('d', cone(M, u, mr, ex - M[0], mr + ((ex - M[0]) * (sr + mr)) / D));
  st.umb.setAttribute('opacity', (0.92 * show).toFixed(3));
  st.pen.setAttribute('opacity', (0.36 * show).toFixed(3));
  // The spot on the Earth follows the shadow, and is there only once the shadow reaches it.
  const hitY = M[1] + (u[1] / u[0]) * (ex - er - M[0]), onEarth = smooth((0.1 - off) / 0.08);
  [st.spotP, st.spotU].forEach((el, k) => { el.setAttribute('cy', f1(hitY)); el.setAttribute('opacity', ((k ? 0.92 : 0.4) * onEarth).toFixed(3)); });
  // The view from the ground: the Moon covers more of the Sun as it lines up; at the full eclipse the sky goes dark
  // and the corona shows.
  const [ix] = E.inset, s = 30, cover = smooth((0.62 - off) / 0.62), full = smooth((l.p - at) / 0.03);
  st.imoon.setAttribute('cx', f1(ix - 2.4 * s * (1 - cover)));
  st.cor.setAttribute('opacity', (0.95 * full).toFixed(3));
  st.sky.setAttribute('fill', full >= 1 ? NIGHT_SKY : full > 0 ? mixHex(DAY_SKY, NIGHT_SKY, 0.4 + 0.6 * full) : mixHex(DAY_SKY, NIGHT_SKY, 0.4 * cover * cover));
}

register('eclipse', {
  cat: CAT, title: 'Eclipse',
  desc: 'The Sun, the Moon and the Earth lining up, not to scale, with the sunlight as a pale band and the shadows dark in it. Solar: the Moon moves along its orbit between the Sun and the Earth and its shadow falls on the Earth, and a round view from the ground shows the Moon sliding over the Sun until only the corona shows. Lunar: the Moon moves along its orbit into the Earth\'s shadow and turns a dim red.',
  use: 'Solar and lunar eclipses: why they happen, the Moon\'s shadow, totality, the corona and the red Moon.',
  params: 'kind: solar|lunar (default solar), labels: {sun, moon, earth, shadow, totality} (each optional, 1 to 3 words from the narration), at (when the eclipse is full, 0 to 1)',
  example: { kind: 'solar', labels: { sun: 'Sun', moon: 'Moon', earth: 'Earth', shadow: 'Moon\'s shadow', totality: 'Totality' } },
  build: eclipseBuild,
  init(g, p, c) {
    const q = (s) => g.querySelector('#' + c.id + s);
    return { moon: q('moon'), red: q('red'), umb: q('umb'), pen: q('pen'), spotP: q('spotP'), spotU: q('spotU'), imoon: q('imoon'), cor: q('cor'), sky: q('sky') };
  },
  render: eclipseRender,
});

/* ---------------------------------------------------------------------------------------------------------------
 * black_hole: a big star burns, reddens as it runs out of fuel, collapses to a point and flashes as a supernova, and
 * leaves a black hole: a dark disc with a glowing disk of matter swirling round it. Near its edge, the event horizon,
 * light bends: the far side of the disk shows bent up over the top, a thin bright ring hugs the edge, and rays of
 * light passing by curve round it. Without the star, only the black hole is drawn, a little bigger.
 * ------------------------------------------------------------------------------------------------------------- */
const BH = { x: 960, y: 470 };
const bhFromStar = (p) => !(p.fromStar === false || p.fromStar === 'false');
const bhAt = (p) => moment(p.at, 0.3, 0.2, 0.45);
// The black hole is drawn bigger when it is all there is.
const bhScale = (p) => (bhFromStar(p) ? 1.12 : 1.25);
// When things happen: the star collapses at C, flashes, and the black hole is there a little later. Without the star
// the black hole is there from the start.
function bhTimes(p) {
  const C = bhAt(p);
  return bhFromStar(p) ? { C, hole: C + 0.15, names: C + 0.2, rays: C + 0.36 } : { C: 0, hole: 0.02, names: 0.12, rays: 0.36 };
}
// The black hole's sizes, scaled by k: the dark disc, the bright ring at its edge, the bent image of the disk's far
// side, and the disk's middle line (an ellipse seen from a little above) and width.
const bhSizes = (k) => ({ r: 100 * k, ring: 108 * k, bend: 126 * k, rx: 380 * k, ry: 78 * k, band: 46 * k });
// Half an ellipse round the black hole: the far half (over the top, from left to right) or the near half (along the
// bottom, from right to left), so streaks moving along both go round the same way.
const halfDisk = (z, far) => {
  const P = [];
  for (let i = 0; i <= 48; i++) { const a = far ? Math.PI + (Math.PI * i) / 48 : (Math.PI * i) / 48; P.push([BH.x + z.rx * Math.cos(a), BH.y + z.ry * Math.sin(a)]); }
  return line(far ? P : P.reverse());
};
// An arc round the black hole at radius r from angle a0 to a1 (radians, clockwise on screen).
const bhArc = (r, a0, a1) => `M${f1(BH.x + r * Math.cos(a0))} ${f1(BH.y + r * Math.sin(a0))}A${f1(r)} ${f1(r)} 0 0 1 ${f1(BH.x + r * Math.cos(a1))} ${f1(BH.y + r * Math.sin(a1))}`;
// Two rays of light that pass close to the black hole, above and below, and bend round it toward each other.
const bhRays = (k) => [-1, 1].map((s) => [[BH.x - 360 * k, BH.y + s * 200 * k], [BH.x - 100 * k, BH.y + s * 170 * k], [BH.x + 120 * k, BH.y + s * 170 * k], [BH.x + 360 * k, BH.y + s * 60 * k]]);
const cubicPts = (a, b, c, d, n = 40) => Array.from({ length: n + 1 }, (_, i) => { const t = i / n, u = 1 - t; return [u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0], u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1]]; });

function blackHoleBuild(p, c) {
  const { U, th } = c, id = c.id, star = bhFromStar(p), T = bhTimes(p), C = T.C, k = bhScale(p), z = bhSizes(k), { x, y } = BH;
  let o = '';
  if (star) {
    // The star, which pulses, swells and reddens, then collapses (all in render).
    o += `<g${U.A('pop', 0, 0.07, { cx: x, cy: y })}><g id="${id}star"><circle cx="${x}" cy="${y}" r="214" fill="${STAR}" opacity=".3"/><circle cx="${x}" cy="${y}" r="190" fill="${STAR}"/><circle cx="${x}" cy="${y}" r="132" fill="${STAR_CORE}"/>` +
      `<g id="${id}red" opacity="0"><circle cx="${x}" cy="${y}" r="214" fill="${STAR_RED}" opacity=".3"/><circle cx="${x}" cy="${y}" r="190" fill="${STAR_RED}"/><circle cx="${x}" cy="${y}" r="132" fill="${STAR_RED_CORE}"/></g></g></g>`;
    // The collapse: four arrows pointing in.
    o += `<g opacity="0"${U.A('fade', C - 0.03, 0.02)}><g${U.A('dim', C + 0.07, 0.03, { to: 0 })}>` + [-135, -45, 45, 135].map((deg) => {
      const a = (deg * Math.PI) / 180;
      return flowArrow(U, th, [[x + 300 * Math.cos(a), y + 300 * Math.sin(a)], [x + 222 * Math.cos(a), y + 222 * Math.sin(a)]], C - 0.03, 0.02, 12);
    }).join('') + '</g></g>';
    // The supernova: a burst of light, a ring racing out and bits of the star flung away (all in render).
    const burst = line(Array.from({ length: 32 }, (_, i) => { const a = (Math.PI * i) / 16, r = i % 2 ? 104 : [200, 168, 190, 160][(i / 2) % 4]; return [x + r * Math.cos(a), y + r * Math.sin(a)]; })) + 'Z';
    o += `<circle id="${id}wave" cx="${x}" cy="${y}" r="40" fill="none" stroke="${STAR_CORE}" stroke-width="8" opacity="0"/>` +
      `<path id="${id}burst" d="${burst}" fill="${FLASH}" stroke="${STAR}" stroke-width="7" stroke-linejoin="round" opacity="0"/>`;
    for (let j = 0; j < 12; j++) o += `<circle id="${id}bit${j}" r="${j % 3 ? 7 : 10}" fill="${j % 2 ? STAR : STAR_RED}" opacity="0"/>`;
  }
  // The black hole: the far half of the disk, the dark disc, the ring and the bent light at its edge, the near half of
  // the disk in front, and the streaks of the swirling disk (moved by render).
  const disk = (far) => `<path d="${halfDisk(z, far)}" fill="none" stroke="${DISK}" stroke-width="${f1(z.band)}" stroke-linecap="round"/>` +
    `<path id="${id}${far ? 'farS' : 'nearS'}" d="${halfDisk(z, far)}" fill="none" stroke="${DISK_HOT}" stroke-width="${f1(z.band * 0.32)}" stroke-linecap="round" stroke-dasharray="${f1(70 * k)} ${f1(46 * k)}"/>`;
  // The bent image of the far side runs over the top of the dark disc and meets the disk's far half on both sides
  // (where a circle of that radius crosses the disk's middle line).
  const meet = Math.asin(Math.sqrt((1 - Math.pow(z.bend / z.rx, 2)) / (Math.pow(z.bend / z.ry, 2) - Math.pow(z.bend / z.rx, 2))));
  o += `<g opacity="0"${U.A('fade', T.hole, 0.06)}>${disk(true)}` +
    `<path d="${bhArc(z.bend, Math.PI + meet - 0.06, 2 * Math.PI - meet + 0.06)}" fill="none" stroke="${DISK}" stroke-width="${f1(24 * k)}" stroke-linecap="round"/><path d="${bhArc(z.bend, Math.PI + meet, 2 * Math.PI - meet)}" fill="none" stroke="${DISK_HOT}" stroke-width="${f1(8 * k)}" stroke-linecap="round"/>` +
    `<path d="${bhArc(z.ring + 8 * k, Math.PI * 0.12, Math.PI * 0.88)}" fill="none" stroke="${DISK}" stroke-width="${f1(9 * k)}" stroke-linecap="round"/>` +
    `<circle id="${id}ring" cx="${x}" cy="${y}" r="${f1(z.ring)}" fill="none" stroke="${PHOTON}" stroke-width="${f1(6 * k)}"/>` +
    `<circle cx="${x}" cy="${y}" r="${f1(z.r)}" fill="${HOLE}"/>` +
    // The event horizon, marked when its name comes, behind the near half of the disk.
    (said(p, 'eventHorizon') ? `<circle cx="${x}" cy="${y}" r="${f1(z.r - 4)}" fill="none" stroke="${th.ink}" stroke-width="3" stroke-dasharray="10 9" opacity="0"${U.A('fade', T.names + 0.07, 0.04)}/>` : '') +
    `${disk(false)}</g>`;
  // Rays of light bending round it, each with a pulse of light running along it (see render).
  bhRays(k).forEach((R, j) => {
    const P = cubicPts(...R);
    o += `<g opacity="0"${U.A('fade', T.rays + j * 0.02, 0.05)}><path d="${line(P)}" fill="none" stroke="${RAY}" stroke-width="4" stroke-linecap="round" stroke-dasharray="2 12"/></g>` +
      `<circle id="${id}photon${j}" r="9" fill="${RAY}" opacity="0"/>`;
  });
  // The names: the star's stages while they last, then the black hole's parts.
  const L = (key) => said(p, key), gone = (inner, until) => (inner ? `<g${U.A('dim', until, 0.03, { to: 0 })}>${inner}</g>` : '');
  if (star) {
    o += gone(nameText(U, th, L('star'), x - 230, y, 'left', 0.07, 330), C) +
      gone(nameText(U, th, L('collapse'), x - 222, y - 214, 'left', C, 330), C + 0.09) +
      gone(nameText(U, th, L('supernova'), x + 214, y - 222, 'right', C + 0.06, 330), C + 0.2);
  }
  const edgeAt = [x + z.r * Math.cos(-0.7), y + z.r * Math.sin(-0.7)], diskAt = [x + z.rx * Math.cos(0.62), y + z.ry * Math.sin(0.62)];
  o += callout(U, th, L('blackHole'), [x - 0.3 * z.r, y - 0.36 * z.r], 'left', x - 412 * k, y, T.names, 330) +
    callout(U, th, L('eventHorizon'), edgeAt, 'right', x + 440 * k, y - 140 * k, T.names + 0.07, 330) +
    callout(U, th, L('disk'), diskAt, 'right', x + 380 * k, y + 170 * k, T.names + 0.14, 330);
  return o;
}

function blackHoleRender(l, st, p) {
  const T = bhTimes(p), C = T.C, t = l.t, { x, y } = BH, pr = l.p;
  if (st.star) {
    // The star pulses gently, swells a little and reddens as it runs out of fuel, then collapses to a point.
    const fuel = smooth((pr - 0.1) / Math.max(0.05, C - 0.13)), fall = Math.pow(clamp((pr - C) / 0.045, 0, 1), 1.6);
    const s = (1 + 0.012 * Math.sin(t * 3.2) + 0.07 * fuel) * (1 - 0.985 * fall);
    st.star.setAttribute('transform', `translate(${x} ${y}) scale(${s.toFixed(4)}) translate(${-x} ${-y})`);
    st.star.setAttribute('opacity', pr >= C + 0.045 ? '0' : '1');
    st.red.setAttribute('opacity', fuel.toFixed(3));
    // The flash: a burst that swells and fades, a ring racing out and bits flung away.
    const f = clamp((pr - C - 0.045) / 0.13, 0, 1), on = pr >= C + 0.045 && f < 1;
    const bs = 0.25 + 0.8 * Math.sin(Math.min(1, f * 2.2) * Math.PI * 0.5);
    st.burst.setAttribute('transform', `translate(${x} ${y}) rotate(${f1(f * 20)}) scale(${bs.toFixed(3)}) translate(${-x} ${-y})`);
    st.burst.setAttribute('opacity', on ? (1 - smooth((f - 0.45) / 0.55)).toFixed(3) : '0');
    st.wave.setAttribute('r', f1(40 + 166 * Math.pow(f, 0.6)));
    st.wave.setAttribute('opacity', on ? (0.9 * (1 - f)).toFixed(3) : '0');
    st.bits.forEach((el, j) => {
      const a = (2 * Math.PI * j) / 12 + 0.3 * (j % 2), r = 40 + (130 + 20 * (j % 3)) * Math.pow(f, 0.5);
      el.setAttribute('cx', f1(x + r * Math.cos(a)));
      el.setAttribute('cy', f1(y + r * Math.sin(a)));
      el.setAttribute('opacity', on ? (1 - f).toFixed(3) : '0');
    });
  }
  // The disk swirls round, and the ring at the edge shimmers.
  const k = bhScale(p), run = -t * 120 * k;
  st.farS?.setAttribute('stroke-dashoffset', f1(run));
  st.nearS?.setAttribute('stroke-dashoffset', f1(run));
  st.ring?.setAttribute('stroke-width', f1((6 + 1.5 * Math.sin(t * 5)) * k));
  // A pulse of light runs along each ray.
  st.photons.forEach((el, j) => {
    const s = loopAt(l, T.rays + 0.04 + j * 0.02, 0.35, j * 0.5), u = s % 1, [px, py] = pointAt(st.rays[j], u * st.rays[j].len);
    el.setAttribute('opacity', s < 0 ? '0' : ends(u, 0.08, 0.12).toFixed(2));
    el.setAttribute('cx', f1(px));
    el.setAttribute('cy', f1(py));
  });
}

register('black_hole', {
  cat: CAT, title: 'Black hole',
  desc: 'A big star burns, reddens as it runs out of fuel, collapses and flashes as a supernova, and leaves a black hole: a dark disc with a glowing disk of matter swirling round it. Near its edge, the event horizon, light bends: the far side of the disk shows bent over the top, a bright ring hugs the edge, and rays of light curve round it. Without the star, only the black hole and its disk. Not to scale, no numbers.',
  use: 'Black holes: how they form from collapsing stars, supernovas, the event horizon, the disk of matter round them and how they bend light.',
  params: 'labels: {star, collapse, supernova, blackHole, eventHorizon, disk} (each optional, 1 to 3 words from the narration; star, collapse and supernova only show when fromStar is on), fromStar (default true; false shows only the black hole with its disk), at (when the star collapses, 0 to 1)',
  example: { labels: { star: 'Massive star', collapse: 'Collapse', supernova: 'Supernova', blackHole: 'Black hole', eventHorizon: 'Event horizon', disk: 'Disk of matter' } },
  build: blackHoleBuild,
  init(g, p, c) {
    const q = (s) => g.querySelector('#' + c.id + s), k = bhScale(p);
    return {
      star: q('star'), red: q('red'), burst: q('burst'), wave: q('wave'), bits: Array.from({ length: 12 }, (_, j) => q('bit' + j)).filter(Boolean),
      farS: q('farS'), nearS: q('nearS'), ring: q('ring'), photons: [0, 1].map((j) => q('photon' + j)), rays: bhRays(k).map((R) => track(cubicPts(...R))),
    };
  },
  render: blackHoleRender,
});
