// Animated diagrams of how things work (earth), drawn for Meko in the film engine's style. See ../engine.js for how
// templates work. Every visible word comes from the params; a part without a label in the params is drawn unlabeled.
// The drawings hold no numbers, dates or other facts, so nothing on screen goes beyond what the narration says.
import { register, H } from "../engine.js";

const CAT = 'Diagrams';

// Physical things keep their natural colors in every look. These read on the dark grounds (Night atlas, Blueprint) and
// on the light page (Field guide) alike.
const MAGMA = '#E2522B'; // magma and lava
const MAGMA_HOT = '#FFB23E'; // the hottest magma, and its glow
const ROCK = ['#A88763', '#8F7052', '#775B42', '#614934']; // rock layers from the top down
const CONE = '#8E7D6D'; // a volcano's cone of old lava and ash
const CONE_LINE = '#776759'; // the layers inside the cone
const CAVITY = '#3B2B21'; // an empty chamber or channel in the rock
const ASH = '#A29C95';
const ASH_DARK = '#7E7872';
const MANTLE = '#A35F3F'; // the hot mantle under the plates
const PLATE = '#8F7052'; // a tectonic plate
const OCEANIC = '#6F665E'; // a plate of heavy ocean floor rock
const OCEANIC_LINE = '#5E5650';
const CONTINENTAL = '#A88763'; // a plate of lighter, thicker continental rock
const NEW_CRUST = '#5A4A40'; // fresh crust of cooled magma, in two tones for its bands
const NEW_CRUST_2 = '#705C4E';
const MOUNTAIN = '#8E7D6D';
const MOUNTAIN_LINE = '#776759';
const ROCK_SIDE = ['#8D7253', '#785E45', '#644D38', '#513E2C']; // the rock layers on a block's shaded side
const GROUND = '#8A9E66'; // the ground's surface, seen from above at a slant
const SCARP = '#5E4A3A'; // the face of a fault laid bare when it slips
const SEA = '#3D7DB3'; // the Earth seen from space
const SEA_GRID = '#6FA2CF';
const LAYERS = ['#8A6A4A', '#D0603A', '#F0A040', '#FFE08A']; // crust, mantle, outer core, inner core
const ROAD = '#4A4643';
const ROAD_LINE = '#EDE6D3';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const f1 = (v) => (+v).toFixed(1);
// A path through points.
const line = (P) => P.map(([x, y], i) => `${i ? 'L' : 'M'}${f1(x)} ${f1(y)}`).join('');
// Points along a gentle wave from x0 to x1 around the height y0.
const wave = (x0, x1, y0, amp, len, ph, step = 20) => {
  const P = [];
  for (let x = x0; x < x1; x += step) P.push([x, y0 + amp * Math.sin((x - x0) / len + ph)]);
  P.push([x1, y0 + amp * Math.sin((x1 - x0) / len + ph)]);
  return P;
};
// A point on a quadratic curve from a over c to b, and points along a stretch of it.
const quad = (a, c, b, t) => [(1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0], (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1]];
const quadPts = (a, c, b, t0, t1, n = 24) => Array.from({ length: n + 1 }, (_, i) => quad(a, c, b, t0 + ((t1 - t0) * i) / n));

// The look's own edge for drawn shapes: chalk lines in Blueprint, thin ink in Field guide, none on Night atlas's flat
// shapes.
const edge = (th, w) => (th.card ? ` stroke="${th.card.stroke}" stroke-width="${w ?? th.card.width}" stroke-linejoin="round"` : '');

// A stroke that draws itself along its path from `at` over `d`. pathLength makes the dash work without measuring the
// path, and the fade keeps a round cap from showing as a dot before the stroke starts.
const drawn = (U, d, col, w, at, dur) =>
  `<g opacity="0"${U.A('fade', at, 0.004)}><path d="${d}" pathLength="1000" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="1000 1010" stroke-dashoffset="1000"${U.A('draw', at, dur, { l: 1000 })}/></g>`;

// A label's words in at most two lines of maxW pixels, at the biggest size that fits, or in three at the smallest size
// (the last line takes all the words left, so none is lost). Two lines are split where they come out most even.
function fitText(U, text, maxW) {
  const words = String(text).trim().split(/\s+/), width = (t, s) => U.tw(t, s, { w: 700 });
  const split = (s) => {
    const out = [];
    let cur = '';
    for (const w of words) {
      const next = cur ? cur + ' ' + w : w;
      if (cur && width(next, s) > maxW) { out.push(cur); cur = w; } else cur = next;
    }
    if (cur) out.push(cur);
    return out;
  };
  for (const s of [38, 34]) {
    if (width(words.join(' '), s) <= maxW) return { s, lines: [words.join(' ')] };
    let best = null;
    for (let i = 1; i < words.length; i++) {
      const lines = [words.slice(0, i).join(' '), words.slice(i).join(' ')], w = Math.max(width(lines[0], s), width(lines[1], s));
      if (w <= maxW && (!best || w < best.w)) best = { w, lines };
    }
    if (best) return { s, lines: best.lines };
  }
  const lines = split(30);
  return { s: 30, lines: lines.length > 3 ? [lines[0], lines[1], lines.slice(2).join(' ')] : lines };
}

const hasText = (t) => t != null && String(t).trim() !== '';

// A name from the params set next to the point (x, y): on the 'left' side the text ends there, on the 'right' side it
// starts there, and 'top' and 'bottom' center it above or below. It comes up into place at `at`.
function nameText(U, th, text, x, y, side, at) {
  if (!hasText(text)) return '';
  const { s, lines } = fitText(U, U.lab(text), 330), lh = Math.round(s * 1.15), n = lines.length;
  let a = 'middle', tx = x, y0;
  if (side === 'left' || side === 'right') { a = side === 'left' ? 'end' : 'start'; tx = side === 'left' ? x - 16 : x + 16; y0 = y - ((n - 1) * lh) / 2 + s * 0.35; }
  else if (side === 'top') y0 = y - 14 - s * 0.24 - (n - 1) * lh;
  else y0 = y + 14 + s * 0.74;
  return `<g${U.A('up', at, 0.06)}>${lines.map((l, i) => U.T(f1(tx), f1(y0 + i * lh), l, { a, s, w: 700, f: th.ink, halo: 8 })).join('')}</g>`;
}

// A part's name from the params with a line from the part at `part` to the point (x, y), where the name is set (see
// nameText). Without a name nothing is drawn.
function callout(U, th, text, part, side, x, y, at) {
  if (!hasText(text)) return '';
  return `<g opacity="0"${U.A('fade', at, 0.004)}>${H.line(U, part[0], part[1], x, y, th.bg, 9, at, 0.06)}${H.line(U, part[0], part[1], x, y, th.ink, 3, at, 0.06)}</g>` +
    `<g${U.A('pop', at, 0.04, { cx: part[0], cy: part[1] })}><circle cx="${f1(part[0])}" cy="${f1(part[1])}" r="8" fill="${th.ink}" stroke="${th.bg}" stroke-width="3"/></g>` +
    nameText(U, th, text, x, y, side, at + 0.04);
}

// A bold arrow from (x0, y0) to (x1, y1) in the look's highlight, growing from its tail at `at`.
function bigArrow(U, th, x0, y0, x1, y1, at, w = 24) {
  const len = Math.hypot(x1 - x0, y1 - y0), deg = (Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI, hw = w / 2, hh = w * 1.15, hl = w * 1.5;
  return `<g transform="translate(${f1(x0)} ${f1(y0)}) rotate(${f1(deg)})"><g${U.A('grow', at, 0.08, { ax: 'x', cx: 0, cy: 0 })}>` +
    `<path d="M0 ${-hw}H${f1(len - hl)}V${f1(-hh)}L${f1(len)} 0L${f1(len - hl)} ${f1(hh)}V${hw}H0Z" fill="${th.accent}" stroke="${th.bg}" stroke-width="5" stroke-linejoin="round" paint-order="stroke"/></g></g>`;
}

const smooth = (x) => { const t = clamp(x, 0, 1); return t * t * (3 - 2 * t); };

register('volcano_cutaway', {
  cat: CAT, title: 'Volcano cutaway',
  desc: 'A volcano cut open: layers of rock, a magma chamber deep below and a conduit up to the crater. The chamber glows and fills, magma rises up the conduit, the volcano erupts with an ash cloud, and lava runs down its sides.',
  use: 'How a volcano works and why it erupts: magma, the chamber, the vent, eruptions and lava.',
  params: 'labels: {chamber, conduit, crater, ash, lava, crust} (each optional, 1 to 3 words from the narration), erupts (default true; false stops before the eruption), at (when it erupts, 0 to 1)',
  example: { labels: { chamber: 'Magma chamber', conduit: 'Conduit', crater: 'Crater', ash: 'Ash cloud', lava: 'Lava', crust: 'Crust' } },
  build(p, c) {
    const { U, th } = c, id = c.id, L = p.labels || {}, erupts = p.erupts !== false;
    const E = clamp(typeof p.at === 'number' ? p.at : 0.55, 0.35, 0.65); // the eruption
    const X0 = 470, X1 = 1450, GY = 510, SB = 820, CX = 960, RIM = 320, FLOOR = 342, CY = 735;
    const F0 = 0.1, F1 = erupts ? E * 0.6 : 0.48, R1 = erupts ? E : 0.8; // the chamber fills, then the magma rises
    let o = '';
    // The ground: four bands of rock, cut straight at the sides.
    const B = [GY, 590, 670, 745, SB];
    for (let k = 0; k < 4; k++) {
      const top = k === 0 ? [[X0, GY], [X1, GY]] : wave(X0, X1, B[k], 7, 110, k * 1.7);
      const bottom = k === 3 ? [[X1, SB], [X0, SB]] : wave(X0, X1, B[k + 1], 7, 110, (k + 1) * 1.7).reverse();
      o += `<path d="${line(top.concat(bottom))}Z" fill="${ROCK[k]}"${edge(th)}${U.A('up', k * 0.015, 0.07)}/>`;
    }
    // The cone, with the layers of old lava and ash inside it.
    const lf = [[905, RIM], [820, GY - 6], [640, GY]], rf = [[1015, RIM], [1100, GY - 6], [1280, GY]];
    let strata = '';
    [34, 70, 108].forEach((d) => {
      strata += `<path d="M${640 + d * 1.9} ${GY}Q${820 + d * 0.5} ${GY - 6 - d * 0.05} ${905 + d * 0.32} ${RIM + d * 1.05}M${1280 - d * 1.9} ${GY}Q${1100 - d * 0.5} ${GY - 6 - d * 0.05} ${1015 - d * 0.32} ${RIM + d * 1.05}" fill="none" stroke="${CONE_LINE}" stroke-width="4"/>`;
    });
    o += `<g${U.A('up', 0.05, 0.07)}><path d="M640 ${GY}Q820 ${GY - 6} 905 ${RIM}L928 ${FLOOR}L992 ${FLOOR}L1015 ${RIM}Q1100 ${GY - 6} 1280 ${GY}Z" fill="${CONE}"${edge(th)}/>${strata}</g>`;
    // The conduit: a channel from the chamber to the crater floor, empty until the magma rises in it.
    const conduit = [];
    for (let y = CY - 52; y >= FLOOR; y -= 12) conduit.push([CX + 12 * Math.sin((y - FLOOR) / 55), y]);
    conduit.push([CX, FLOOR]);
    o += `<g opacity="0"${U.A('fade', 0.07, 0.05)}><path d="${line(conduit)}" fill="none" stroke="${CAVITY}" stroke-width="42"/></g>`;
    // The chamber: an empty space that fills with magma from the bottom and starts to glow.
    o += `<defs><clipPath id="${id}fill"><rect x="${CX - 210}" y="${CY - 60}" width="420" height="120"${U.A('grow', F0, F1 - F0, { cx: CX, cy: CY + 60 })}/></clipPath>` +
      `<clipPath id="${id}rock"><rect x="${X0}" y="${GY}" width="${X1 - X0}" height="${SB - GY}"/></clipPath></defs>` +
      `<g opacity="0"${U.A('fade', 0.07, 0.05)}><ellipse cx="${CX}" cy="${CY}" rx="206" ry="62" fill="${CAVITY}"${edge(th)}/></g>` +
      `<g clip-path="url(#${id}fill)"><ellipse cx="${CX}" cy="${CY}" rx="194" ry="51" fill="${MAGMA}"/><ellipse cx="${CX}" cy="${CY + 14}" rx="120" ry="22" fill="${MAGMA_HOT}"/></g>` +
      `<g clip-path="url(#${id}rock)"><g opacity=".55"><ellipse cx="${CX}" cy="${CY}" rx="226" ry="80" fill="none" stroke="${MAGMA_HOT}" stroke-width="5" opacity="0"${U.A('fade', F1 - 0.05, 0.06)}/></g>` +
      `<g opacity=".3"><ellipse cx="${CX}" cy="${CY}" rx="250" ry="100" fill="none" stroke="${MAGMA_HOT}" stroke-width="4" opacity="0"${U.A('fade', F1 - 0.02, 0.06)}/></g></g>`;
    // The magma rises up the conduit, all the way to the crater when the volcano erupts.
    const rise = erupts ? conduit : conduit.slice(0, Math.round(conduit.length * 0.62));
    o += drawn(U, line(rise), MAGMA, 26, F1, R1 - F1) + drawn(U, line(rise), MAGMA_HOT, 8, F1 + 0.02, R1 - F1);
    if (erupts) {
      // The eruption: the ash cloud billows up, and lava bursts out of the crater and is thrown into the air.
      const puffs = [[960, 292, 28, 0], [948, 260, 36, 0], [882, 240, 32, 1], [1044, 244, 32, 1], [972, 226, 42, 0], [902, 210, 42, 0], [1026, 206, 44, 0], [848, 230, 32, 0], [1088, 230, 34, 0], [962, 196, 44, 0]];
      o += puffs.map(([x, y, r, back], i) => `<g${U.A('pop', E + 0.012 + i * 0.012, 0.05, { cx: x, cy: y })}><circle cx="${x}" cy="${y}" r="${r}" fill="${back ? ASH_DARK : ASH}"/></g>`).join('');
      const fx = (dx, dy, k) => `${f1(CX + dx * k)} ${f1(FLOOR + dy * k)}`;
      const fountain = (k) => `M${fx(-22, 0, k)}C${fx(-30, -30, k)} ${fx(-50, -58, k)} ${fx(-42, -92, k)}C${fx(-30, -72, k)} ${fx(-18, -64, k)} ${fx(-10, -60, k)}C${fx(-14, -92, k)} ${fx(-6, -118, k)} ${fx(4, -136, k)}C${fx(12, -110, k)} ${fx(16, -84, k)} ${fx(12, -62, k)}C${fx(22, -68, k)} ${fx(34, -78, k)} ${fx(46, -90, k)}C${fx(48, -58, k)} ${fx(32, -26, k)} ${fx(22, 0, k)}Z`;
      o += `<g${U.A('pop', E, 0.05, { cx: CX, cy: FLOOR })}><path d="${fountain(1)}" fill="${MAGMA}"/><path d="${fountain(0.58)}" fill="${MAGMA_HOT}"/></g>`;
      [[-82, -98, 10], [86, -112, 11], [-48, -156, 8], [54, -166, 9], [-112, -56, 8], [116, -66, 9]].forEach(([dx, dy, r], i) => {
        o += `<g opacity="0"${U.A('fade', E + 0.015 + i * 0.006, 0.004)}><g${U.A('move', E + 0.015 + i * 0.006, 0.07, { x0: -dx, y0: -dy - 40, x1: 0, y1: 0 })}><circle cx="${CX + dx}" cy="${FLOOR + dy}" r="${r}" fill="${MAGMA}"/></g></g>`;
      });
      // Lava runs down both sides of the cone.
      const lt = quadPts(lf[0], lf[1], lf[2], 0.03, 0.8), rt = quadPts(rf[0], rf[1], rf[2], 0.03, 0.66);
      o += drawn(U, line(lt), MAGMA, 22, E + 0.06, 0.16) + drawn(U, line(lt), MAGMA_HOT, 7, E + 0.08, 0.15) + drawn(U, line(rt), MAGMA, 22, E + 0.07, 0.14) + drawn(U, line(rt), MAGMA_HOT, 7, E + 0.09, 0.13);
    }
    // The labels, each as its part comes in.
    const conduitAt = conduit[Math.round(conduit.length * 0.3)];
    o += callout(U, th, L.crust, [560, 548], 'left', X0 - 40, 548, 0.08) +
      callout(U, th, L.chamber, [CX + 165, CY], 'right', X1 + 40, CY, F0 + 0.05) +
      callout(U, th, L.conduit, conduitAt, 'right', X1 + 40, conduitAt[1], F1 + 0.04) +
      callout(U, th, L.crater, [944, FLOOR - 6], 'left', X0 - 40, 326, erupts ? E - 0.07 : F1 + 0.12);
    if (erupts) {
      const lava = quad(rf[0], rf[1], rf[2], 0.45);
      o += callout(U, th, L.ash, [852, 226], 'left', X0 - 40, 214, E + 0.1) + callout(U, th, L.lava, lava, 'right', X1 + 40, lava[1] - 10, E + 0.15);
    }
    return o;
  },
});

// Plate boundaries. All three kinds share a frame: the drawing between x 380 and 1540, the plates' names beside it.
const PB_X0 = 380, PB_X1 = 1540, PB_MID = 960;

// Divergent: the plates move apart, magma rises from the mantle into the gap and cools into new crust. The new crust
// rides out on both plates in bands, so each plate carries bands that come out of the middle as it moves.
const DIV = { PT: 380, PB: 462, MB: 800, G: 240, K: 3 };
function divergentBuild(p, c) {
  const { U, th } = c, id = c.id, L = p.labels || {}, { PT, PB, MB, G, K } = DIV, X0 = PB_X0, X1 = PB_X1, M = PB_MID, bw = G / (2 * K);
  let o = `<defs><clipPath id="${id}cl"><rect x="${X0}" y="${PT - 20}" width="${M - X0}" height="${PB - PT + 40}"/></clipPath>` +
    `<clipPath id="${id}cr"><rect x="${M}" y="${PT - 20}" width="${X1 - M}" height="${PB - PT + 40}"/></clipPath></defs>`;
  o += `<rect x="${X0}" y="${PB - 4}" width="${X1 - X0}" height="${MB - PB + 4}" fill="${MANTLE}"${edge(th)}${U.A('up', 0, 0.07)}/>`;
  // Magma rises from deep in the mantle up to the gap.
  const plume = (w, top) => `M${M - w} ${MB}C${M - w * 0.8} ${MB - 140} ${M - top * 1.4} ${PB + 70} ${M - top} ${PB}L${M + top} ${PB}C${M + top * 1.4} ${PB + 70} ${M + w * 0.8} ${MB - 140} ${M + w} ${MB}Z`;
  o += `<g${U.A('grow', 0.14, 0.18, { cx: M, cy: MB })}><path d="${plume(92, 16)}" fill="${MAGMA}"/><path d="${plume(40, 5)}" fill="${MAGMA_HOT}"/></g>`;
  // Each plate with its bands of new crust, which wait hidden past the middle until the plate moves out (see render).
  const bands = (side) => Array.from({ length: K }, (_, k) => `<rect x="${f1(side < 0 ? M + k * bw : M - (k + 1) * bw)}" y="${PT}" width="${f1(bw)}" height="${PB - PT}" fill="${k % 2 ? NEW_CRUST_2 : NEW_CRUST}"${edge(th)}/>`).join('');
  o += `<g${U.A('up', 0.02, 0.07)}><g clip-path="url(#${id}cl)"><g id="${id}pl">${bands(-1)}<rect x="${X0 - G}" y="${PT}" width="${M - X0 + G}" height="${PB - PT}" fill="${PLATE}"${edge(th)}/></g></g>` +
    `<g clip-path="url(#${id}cr)"><g id="${id}pr">${bands(1)}<rect x="${M}" y="${PT}" width="${X1 - M + G}" height="${PB - PT}" fill="${PLATE}"${edge(th)}/></g></g>` +
    `<rect id="${id}hot" x="${M}" y="${PT}" width="0" height="${PB - PT}" fill="${MAGMA}"/></g>`;
  o += bigArrow(U, th, 790, PT - 52, 520, PT - 52, 0.1) + bigArrow(U, th, 1130, PT - 52, 1400, PT - 52, 0.1);
  return o + nameText(U, th, L.left, X0, (PT + PB) / 2, 'left', 0.06) + nameText(U, th, L.right, X1, (PT + PB) / 2, 'right', 0.06) +
    callout(U, th, L.mantle, [600, 690], 'left', X0 - 20, 690, 0.1) + callout(U, th, L.magma, [M + 34, 650], 'right', X1 + 20, 650, 0.3) +
    callout(U, th, L.crust, [M, PT + 14], 'top', M, 256, 0.56);
}
function divergentRender(l, st) {
  const gap = DIV.G * smooth((l.p - 0.2) / 0.68), w = Math.min(gap, 20);
  st.pl.setAttribute('transform', `translate(${f1(-gap / 2)} 0)`);
  st.pr.setAttribute('transform', `translate(${f1(gap / 2)} 0)`);
  st.hot.setAttribute('x', f1(PB_MID - w / 2));
  st.hot.setAttribute('width', f1(w));
}

// Convergent: the left plate slides under the right one into the mantle, and a volcano or mountains form above.
// The sinking plate is a thick stroke along its path, and bands moving along it show it sliding down.
const CONV = { MT: 462, MB: 800, slab: 'M160 432L720 432Q890 432 1000 522L1440 878', slabW: 64 };
function convergentBuild(p, c) {
  const { U, th } = c, id = c.id, L = p.labels || {}, { MT, MB, slab, slabW } = CONV, X0 = PB_X0, X1 = PB_X1, mountains = p.forms === 'mountains';
  let o = `<defs><clipPath id="${id}sec"><rect x="${X0}" y="300" width="${X1 - X0}" height="${MB - 300}"/></clipPath></defs>`;
  o += `<rect x="${X0}" y="${MT}" width="${X1 - X0}" height="${MB - MT}" fill="${MANTLE}"${edge(th)}${U.A('up', 0, 0.07)}/>`;
  // Mountains push up out of the plate on top; their foot is hidden in the plate, which is drawn over it.
  if (mountains) {
    const peaks = [[990, 384], [1032, 318], [1068, 342], [1128, 230], [1182, 300], [1232, 254], [1290, 328], [1340, 384]];
    o += `<g${U.A('grow', 0.36, 0.22, { cx: 1165, cy: 360 })}><path d="${line(peaks)}Z" fill="${MOUNTAIN}"${edge(th)}/><path d="M1128 230L1142 296L1132 352M1232 254L1242 304M1032 318L1040 350" fill="none" stroke="${MOUNTAIN_LINE}" stroke-width="4" stroke-linecap="round"/></g>`;
  }
  // The plate on top, its leading edge resting on the sinking plate.
  o += `<g clip-path="url(#${id}sec)"><g${U.A('up', 0.02, 0.07)}><path d="M884 414L960 370L1040 358H${X1 + 20}V470H1030L980 470L930 440L890 424Z" fill="${CONTINENTAL}"${edge(th)}/>` +
    // In a look with edges, a wider stroke under the sinking plate draws its edge along both sides.
    (th.card ? `<path d="${slab}" fill="none" stroke="${th.card.stroke}" stroke-width="${slabW + th.card.width * 2}"/>` : '') +
    `<path d="${slab}" fill="none" stroke="${OCEANIC}" stroke-width="${slabW}"/>` +
    `<path id="${id}tex" d="${slab}" fill="none" stroke="${OCEANIC_LINE}" stroke-width="${slabW - 2}" stroke-dasharray="18 54"/></g></g>`;
  if (!mountains) {
    // Magma rises from the sinking plate up through the plate above, and a volcano builds up where it comes out.
    const below = [], above = [];
    for (let y = 612; y >= 358; y -= 10) below.push([1200 + 12 * Math.sin((y - 266) / 46) - Math.max(0, y - 470) * 0.1, y]);
    for (let y = 362; y >= 268; y -= 8) above.push([1200 + 12 * Math.sin((y - 266) / 46), y]);
    o += drawn(U, line(below), MAGMA, 18, 0.28, 0.2) + drawn(U, line(below), MAGMA_HOT, 6, 0.3, 0.2) +
      `<g${U.A('grow', 0.47, 0.12, { cx: 1200, cy: 358 })}><path d="M1066 358Q1136 344 1180 256L1190 268L1210 268L1220 256Q1264 344 1334 358Z" fill="${CONE}"${edge(th)}/></g>` +
      drawn(U, line(above), MAGMA, 18, 0.56, 0.06) + drawn(U, line(above), MAGMA_HOT, 6, 0.57, 0.06) +
      `<g${U.A('pop', 0.62, 0.05, { cx: 1200, cy: 263 })}><ellipse cx="1200" cy="263" rx="24" ry="9" fill="${MAGMA_HOT}"/></g>`;
  }
  o += bigArrow(U, th, 470, 352, 710, 352, 0.1) + bigArrow(U, th, X1 - 10, 300, 1366, 300, 0.1);
  const magmaAt = [1206, 520];
  return o + nameText(U, th, L.left, X0, 432, 'left', 0.06) + nameText(U, th, L.right, X1, 414, 'right', 0.06) +
    callout(U, th, L.mantle, [560, 650], 'left', X0 - 20, 650, 0.12) + callout(U, th, L.trench, [886, 418], 'top', 800, 300, 0.2) +
    (mountains ? callout(U, th, L.mountains, [1128, 238], 'top', 1128, 186, 0.56) :
      callout(U, th, L.magma, magmaAt, 'right', X1 + 20, 560, 0.42) + callout(U, th, L.volcano, [1200, 258], 'top', 1200, 198, 0.62));
}
function convergentRender(l, st) {
  // The bands slide along the sinking plate, slowing to a stop as the scene settles.
  st.tex.setAttribute('stroke-dashoffset', f1(-220 * smooth(l.p)));
}

// Transform: the plates slide past each other along a jagged fault, seen from above. A road across the fault bends as
// the plates pull at it, then the fault slips in an earthquake and the road is torn apart.
const TF = { T: 270, B: 770, road: 610, D: 84, burst: [966, 395], jag: [-10, 8, -6, 12, -8, 6, -12, 10, -4, 8, -10, 12, -6, 4, -12, 8, -8, 10, -6, 12, -10] };
const tfFault = () => TF.jag.map((j, i) => [PB_MID + j, TF.T + i * ((TF.B - TF.T) / (TF.jag.length - 1))]);
const tfAt = (p) => clamp(typeof p.at === 'number' ? p.at : 0.6, 0.4, 0.68);
function transformBuild(p, c) {
  const { U, th } = c, id = c.id, L = p.labels || {}, { T, B, burst } = TF, X0 = PB_X0, X1 = PB_X1, E = tfAt(p), F = tfFault();
  let o = `<defs><clipPath id="${id}win"><rect x="${X0}" y="${T}" width="${X1 - X0}" height="${B - T}"/></clipPath></defs>`;
  o += `<g${U.A('up', 0, 0.07)}><path d="${line([[X0, T], ...F, [X0, B]])}Z" fill="${ROCK[0]}"${edge(th)}/><path d="${line([[X1, T], [X1, B], ...F.slice().reverse()])}Z" fill="${ROCK[1]}"${edge(th)}/></g>`;
  // The road, drawn by render.
  o += `<g clip-path="url(#${id}win)" opacity="0"${U.A('fade', 0.04, 0.06)}><path id="${id}rl" fill="none" stroke="${ROAD}" stroke-width="36"/><path id="${id}rr" fill="none" stroke="${ROAD}" stroke-width="36"/>` +
    `<path id="${id}ml" fill="none" stroke="${ROAD_LINE}" stroke-width="4" stroke-dasharray="22 18"/><path id="${id}mr" fill="none" stroke="${ROAD_LINE}" stroke-width="4" stroke-dasharray="22 18"/></g>`;
  o += drawn(U, line(F), CAVITY, 8, 0.06, 0.1);
  // The earthquake: a burst on the fault, and waves spreading out from it.
  o += `<g clip-path="url(#${id}win)">${[0, 1, 2].map((k) => `<circle id="${id}w${k}" cx="${burst[0]}" cy="${burst[1]}" r="1" fill="none" stroke="${th.accent}" stroke-width="6" opacity="0"/>`).join('')}</g>`;
  const star = Array.from({ length: 16 }, (_, i) => { const a = (i * Math.PI) / 8, r = i % 2 ? 22 : 52; return [burst[0] + r * Math.cos(a), burst[1] + r * Math.sin(a)]; });
  o += `<g${U.A('pop', E, 0.05, { cx: burst[0], cy: burst[1] })}><path d="${line(star)}Z" fill="${th.accent}" stroke="${th.bg}" stroke-width="5" stroke-linejoin="round" paint-order="stroke"/></g>`;
  o += bigArrow(U, th, 640, 740, 640, 470, 0.14) + bigArrow(U, th, 1290, 470, 1290, 740, 0.14);
  return o + nameText(U, th, L.left, X0, 520, 'left', 0.08) + nameText(U, th, L.right, X1, 520, 'right', 0.08) +
    callout(U, th, L.fault, F[1], 'left', X0 - 20, F[1][1], 0.18) + callout(U, th, L.quake, burst, 'right', X1 + 20, burst[1], E + 0.05);
}
function transformRender(l, st, p) {
  const { road, D } = TF, E = tfAt(p), M = PB_MID;
  // The strain bends the road while the fault holds; the slip snaps each half straight, apart from the other.
  const strain = smooth((l.p - 0.24) / (E - 0.24)), snap = smooth((l.p - E) / 0.035);
  const half = (x0, side) => line(Array.from({ length: 31 }, (_, i) => {
    const x = x0 + ((M - x0) * i) / 30;
    return [x, road + (D / 2) * ((1 - snap) * strain * Math.tanh((x - M) / 170) + snap * side)];
  }));
  const left = half(PB_X0 - 20, -1), right = half(PB_X1 + 20, 1);
  st.rl.setAttribute('d', left);
  st.ml.setAttribute('d', left);
  st.rr.setAttribute('d', right);
  st.mr.setAttribute('d', right);
  st.waves.forEach((w, k) => {
    const q = smooth((l.p - E - k * 0.03) / 0.16);
    w.setAttribute('r', f1(1 + q * (70 + k * 62)));
    w.setAttribute('opacity', (q > 0 ? (0.9 - k * 0.25) * Math.min(1, q * 4) : 0).toFixed(2));
  });
}

register('plate_boundary', {
  cat: CAT, title: 'Plate boundary',
  desc: 'Two tectonic plates where they meet, with arrows for how they move. Divergent: they move apart, magma rises into the gap and cools into new crust. Convergent: one plate slides under the other into the mantle, and a volcano or mountains form above. Transform: seen from above, they slide past each other along a jagged fault; a road across it bends, then the fault slips in an earthquake.',
  use: 'Plate tectonics: plates moving apart, colliding or sliding past each other, and the ridges, trenches, volcanoes, mountains and earthquakes this makes.',
  params: 'kind: divergent|convergent|transform, labels: {left, right (the two plates; in convergent, left is the plate that slides under), mantle, magma, crust (divergent: the new crust), trench, volcano, mountains, fault, quake} (each optional, 1 to 3 words from the narration), forms: volcano|mountains (convergent, default volcano), at (transform: when the earthquake strikes, 0 to 1)',
  example: { kind: 'convergent', labels: { left: 'Ocean plate', right: 'Continental plate', trench: 'Trench', magma: 'Magma', volcano: 'Volcano', mantle: 'Mantle' } },
  build(p, c) {
    return p.kind === 'divergent' ? divergentBuild(p, c) : p.kind === 'transform' ? transformBuild(p, c) : convergentBuild(p, c);
  },
  init(g, p, c) {
    const q = (s) => g.querySelector('#' + c.id + s);
    if (p.kind === 'divergent') return { pl: q('pl'), pr: q('pr'), hot: q('hot') };
    if (p.kind === 'transform') return { rl: q('rl'), rr: q('rr'), ml: q('ml'), mr: q('mr'), waves: [0, 1, 2].map((k) => q('w' + k)) };
    return { tex: q('tex') };
  },
  render(l, st, p) {
    if (p.kind === 'divergent') divergentRender(l, st);
    else if (p.kind === 'transform') transformRender(l, st, p);
    else convergentRender(l, st);
  },
});

// Earthquake: a block of layered ground cut by a fault. The side over the fault slips down along it, the focus bursts
// on the fault underground, waves spread out from it, and the epicenter is marked on the surface right above it.
// The block is seen from the front and a little from above: its front face, its top and its right side.
const EQ = { X0: 470, X1: 1250, T: 430, B: 790, DX: 200, DY: -120, FT: 770, FB: 950, SLIP: 48, FOCUS: 0.62 };
const eqAt = (p) => clamp(typeof p.at === 'number' ? p.at : 0.38, 0.25, 0.55);
const eqSlip = () => { const dx = EQ.FB - EQ.FT, dy = EQ.B - EQ.T, n = Math.hypot(dx, dy); return [(EQ.SLIP * dx) / n, (EQ.SLIP * dy) / n]; };
const eqFocus = () => [EQ.FT + EQ.FOCUS * (EQ.FB - EQ.FT), EQ.T + EQ.FOCUS * (EQ.B - EQ.T)];
// A circle of radius r on the ground around (x, y), as the slanted view shows it, from angle a0 to a1.
const groundRing = (x, y, r, a0, a1) => line(Array.from({ length: 41 }, (_, i) => {
  const a = a0 + ((a1 - a0) * i) / 40, k = 0.6 * r * Math.sin(a) / Math.hypot(EQ.DX, EQ.DY);
  return [x + r * Math.cos(a) + k * EQ.DX, y + k * EQ.DY];
}));
const EQ_RINGS = { front: [72, 140, 208], ground: [86, 168, 250] };
function earthquakeBuild(p, c) {
  const { U, th } = c, id = c.id, L = p.labels || {}, S = eqAt(p), { X0, X1, T, B, DX, DY, FT, FB } = EQ;
  const [sx, sy] = eqSlip(), F = eqFocus(), E = [F[0], T + sy], bandY = [T, T + 90, T + 180, T + 270, B];
  const poly = (P) => `${line(P)}Z`, faultX = (y) => FT + ((y - T) * (FB - FT)) / (B - T);
  // The rock layers of each side, cut along the fault (shapes rather than clipped boxes, so the scene measures the
  // block by what shows).
  const bands = (hang) => bandY.slice(0, 4).map((y, k) => { const y1 = bandY[k + 1]; return `<path d="${poly(hang ? [[faultX(y), y], [X1, y], [X1, y1], [faultX(y1), y1]] : [[X0, y], [faultX(y), y], [faultX(y1), y1], [X0, y1]])}" fill="${ROCK[k]}"/>`; }).join('');
  const side = bandY.slice(0, 4).map((y, k) => `<path d="${poly([[X1, y], [X1 + DX, y + DY], [X1 + DX, bandY[k + 1] + DY], [X1, bandY[k + 1]]])}" fill="${ROCK_SIDE[k]}"/>`).join('');
  const lines = (P) => (th.card ? `<path d="${poly(P)}" fill="none"${edge(th)}/>` : '');
  // The side over the fault slips down along it, and everything below the block's bottom edges is cut off, so it
  // stays inside the block.
  let o = `<defs><clipPath id="${id}base"><path d="${poly([[0, 0], [1920, 0], [1920, B + DY], [X1 + DX, B + DY], [X1, B], [0, B]])}"/></clipPath>` +
    // Where the waves show: the front face and the ground, as they are after the slip.
    `<clipPath id="${id}face"><path d="${poly([[X0, T], [FT, T], [FT + sx, T + sy], [X1 + sx, T + sy], [X1 + sx, B], [X0, B]])}"/></clipPath>` +
    `<clipPath id="${id}top"><path d="${poly([[X0, T], [FT, T], [FT + DX, T + DY], [X0 + DX, T + DY]])}"/><path d="${poly([[FT + sx, T + sy], [X1 + sx, T + sy], [X1 + DX + sx, T + DY + sy], [FT + DX + sx, T + DY + sy]])}"/></clipPath></defs>`;
  // The block; render shakes it in the earthquake.
  o += `<g id="${id}shake"><g clip-path="url(#${id}base)"${U.A('up', 0, 0.08)}>` +
    `<path id="${id}scarp" d="${poly([[FT, T], [FT + DX, T + DY], [FT + DX, T + DY], [FT, T]])}" fill="${SCARP}"${edge(th)}/>` +
    `<g><path d="${poly([[X0, T], [FT, T], [FT + DX, T + DY], [X0 + DX, T + DY]])}" fill="${GROUND}"${edge(th)}/>${bands(false)}${lines([[X0, T], [FT, T], [FB, B], [X0, B]])}</g>` +
    `<g id="${id}hw"><path d="${poly([[FT, T], [X1, T], [X1 + DX, T + DY], [FT + DX, T + DY]])}" fill="${GROUND}"${edge(th)}/>${side}${lines([[X1, T], [X1 + DX, T + DY], [X1 + DX, B + DY], [X1, B]])}` +
    `${bands(true)}${lines([[FT, T], [X1, T], [X1, B], [FB, B]])}</g></g>` +
    drawn(U, `M${FT} ${T}L${FB} ${B}`, CAVITY, 6, 0.08, 0.08) + drawn(U, `M${FT} ${T}L${FT + DX} ${T + DY}`, CAVITY, 5, 0.12, 0.05) + '</g>';
  // The two sides of the fault, about to slip past each other: the side over the fault down, the other side up.
  const [ux, uy] = [sx / EQ.SLIP, sy / EQ.SLIP], mid = [FT + 0.42 * (FB - FT), T + 0.42 * (B - T)];
  const beside = (side, along) => [mid[0] + side * 46 * uy + along * ux, mid[1] - side * 46 * ux + along * uy];
  // Once the sides have slipped, the arrows give way to the focus and the waves.
  o += `<g${U.A('dim', S + 0.05, 0.05, { to: 0 })}>${bigArrow(U, th, ...beside(1, -60), ...beside(1, 60), 0.2, 18)}${bigArrow(U, th, ...beside(-1, 60), ...beside(-1, -60), 0.2, 18)}</g>`;
  // The waves at their full size (render grows them), the focus, the line up to the epicenter and its pin.
  const waveRing = (key, k, d) => `<path id="${id}${key}${k}" d="${d}" fill="none" stroke="${th.accent}" stroke-width="6" opacity="0"/>`;
  o += `<g clip-path="url(#${id}face)">${EQ_RINGS.front.map((r, k) => waveRing('f', k, `M${f1(F[0] - r)} ${f1(F[1])}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`)).join('')}</g>` +
    `<g clip-path="url(#${id}top)">${EQ_RINGS.ground.map((r, k) => waveRing('g', k, groundRing(E[0], E[1], r, -0.1, Math.PI + 0.1))).join('')}</g>`;
  o += `<g${U.A('grow', S + 0.08, 0.06, { cx: F[0], cy: F[1] })}><path d="M${f1(F[0])} ${f1(F[1])}V${f1(E[1])}" stroke="${th.bg}" stroke-width="9"/><path d="M${f1(F[0])} ${f1(F[1])}V${f1(E[1])}" stroke="${th.ink}" stroke-width="4" stroke-dasharray="12 9"/></g>`;
  const star = Array.from({ length: 16 }, (_, i) => { const a = (i * Math.PI) / 8, r = i % 2 ? 15 : 36; return [F[0] + r * Math.cos(a), F[1] + r * Math.sin(a)]; });
  o += `<g${U.A('pop', S, 0.05, { cx: F[0], cy: F[1] })}><path d="${poly(star)}" fill="${th.accent}" stroke="${th.bg}" stroke-width="5" stroke-linejoin="round" paint-order="stroke"/></g>`;
  o += `<g${U.A('pop', S + 0.13, 0.05, { cx: E[0], cy: E[1] })}><path d="M${f1(E[0])} ${f1(E[1])}c-6 -14 -20 -26 -20 -42a20 20 0 1 1 40 0c0 16 -14 28 -20 42Z" fill="${th.accent}" stroke="${th.bg}" stroke-width="5" stroke-linejoin="round" paint-order="stroke"/><circle cx="${f1(E[0])}" cy="${f1(E[1] - 42)}" r="7" fill="${th.bg}"/></g>`;
  const waveAt = [F[0] + EQ_RINGS.front[2] * Math.cos(0.5), F[1] + EQ_RINGS.front[2] * Math.sin(0.5)], faultAt = [FT + 0.86 * (FB - FT), T + 0.86 * (B - T)];
  return o + callout(U, th, L.fault, faultAt, 'left', X0 - 30, faultAt[1], 0.14) + callout(U, th, L.focus, F, 'left', X0 - 30, F[1] - 40, S + 0.04) +
    callout(U, th, L.epicenter, [E[0], E[1] - 64], 'top', E[0], 262, S + 0.15) + callout(U, th, L.waves, waveAt, 'right', X1 + DX + 30, waveAt[1], S + 0.2);
}
function earthquakeRender(l, st, p) {
  const S = eqAt(p), [sx, sy] = eqSlip(), { FT, T, DX, DY } = EQ, q = smooth((l.p - S) / 0.03);
  st.hw.setAttribute('transform', `translate(${f1(sx * q)} ${f1(sy * q)})`);
  st.scarp.setAttribute('d', `${line([[FT, T], [FT + DX, T + DY], [FT + DX + sx * q, T + DY + sy * q], [FT + sx * q, T + sy * q]])}Z`);
  // The ground shakes for a moment as it slips.
  const shake = l.p > S && l.p < S + 0.06 ? 6 * Math.sin(l.t * 70) * (1 - (l.p - S) / 0.06) : 0;
  st.shake.setAttribute('transform', `translate(${f1(shake)} 0)`);
  // The waves grow out from the focus and from the epicenter, one after another, and stay as rings.
  const F = eqFocus();
  [['f', F], ['g', [F[0], T + sy]]].forEach(([key, c]) => st[key].forEach((w, k) => {
    const qk = smooth((l.p - S - 0.02 - k * 0.04) / 0.14), s = Math.max(0.01, qk);
    w.setAttribute('transform', `translate(${f1(c[0])} ${f1(c[1])}) scale(${s.toFixed(3)}) translate(${f1(-c[0])} ${f1(-c[1])})`);
    w.setAttribute('opacity', (qk > 0 ? (0.95 - k * 0.28) * Math.min(1, qk * 4) : 0).toFixed(2));
    w.setAttribute('stroke-width', f1(6 / s));
  }));
}

register('earthquake', {
  cat: CAT, title: 'Earthquake',
  desc: 'A block of layered ground cut by a fault. The two sides slip along the fault and the ground shakes; the focus bursts on the fault underground, seismic waves spread out from it as rings, and the epicenter is marked on the surface right above the focus.',
  use: 'How an earthquake happens: faults, the focus (hypocenter), the epicenter and seismic waves.',
  params: 'labels: {fault, focus, epicenter, waves} (each optional, 1 to 3 words from the narration), at (when the fault slips, 0 to 1)',
  example: { labels: { fault: 'Fault', focus: 'Focus', epicenter: 'Epicenter', waves: 'Seismic waves' } },
  build: earthquakeBuild,
  init(g, p, c) {
    const q = (s) => g.querySelector('#' + c.id + s);
    return { hw: q('hw'), scarp: q('scarp'), shake: q('shake'), f: [0, 1, 2].map((k) => q('f' + k)), g: [0, 1, 2].map((k) => q('g' + k)) };
  },
  render: earthquakeRender,
});

// The layers of the Earth: a globe with its top right quarter cut away to show the crust, the mantle, the outer core
// and the inner core. The layers are drawn about as thick as they are, with the crust made thicker so it shows.
const LAYER_KEYS = ['crust', 'mantle', 'outerCore', 'innerCore'];
const LAYER_R = [1, 0.95, 0.55, 0.21]; // each layer's outer radius, as a share of the Earth's
register('layers_of_earth_cutaway', {
  cat: CAT, title: 'Layers of the Earth, cut open',
  desc: 'The Earth with a quarter cut away: the piece lifts off to show the crust, the mantle, the outer core and the inner core, which are named one by one from the outside in. No depths or numbers.',
  use: 'What the inside of the Earth is made of, when the narration names its layers.',
  params: 'labels: {crust, mantle, outerCore, innerCore} (each optional, 1 to 3 words from the narration), focus: crust|mantle|outerCore|innerCore (optional; outlines that layer at the end)',
  example: { labels: { crust: 'Crust', mantle: 'Mantle', outerCore: 'Outer core', innerCore: 'Inner core' } },
  build(p, c) {
    const { U, th } = c, id = c.id, raw = p.labels || {};
    const L = { crust: raw.crust, mantle: raw.mantle, outerCore: raw.outerCore ?? raw.outer_core, innerCore: raw.innerCore ?? raw.inner_core };
    const named = LAYER_KEYS.some((k) => hasText(L[k])), R = 330, cx = named ? 760 : 960, cy = 485;
    // A quarter of a disc of radius r, from straight up round to the right.
    const quarter = (r) => `M${cx} ${cy}V${cy - r}A${r} ${r} 0 0 1 ${cx + r} ${cy}Z`;
    let grid = '';
    [0.42, 0.78, 1].forEach((k) => (grid += `<ellipse cx="${cx}" cy="${cy}" rx="${f1(R * k)}" ry="${R}" fill="none" stroke="${SEA_GRID}" stroke-width="4"/>`));
    [-0.62, -0.3, 0, 0.3, 0.62].forEach((k) => { const y = cy + R * k, w = R * Math.sqrt(1 - k * k); grid += `<path d="M${f1(cx - w)} ${f1(y)}H${f1(cx + w)}" stroke="${SEA_GRID}" stroke-width="4"/>`; });
    const surface = `<circle cx="${cx}" cy="${cy}" r="${R}" fill="${SEA}"/><g clip-path="url(#${id}globe)">${grid}</g>`;
    let o = `<defs><clipPath id="${id}globe"><circle cx="${cx}" cy="${cy}" r="${R}"/></clipPath><clipPath id="${id}cut"><path d="${quarter(R + 2)}"/></clipPath></defs>`;
    // The globe, then the layers in the cut, then the piece of the surface that lifts away from them.
    o += `<g${U.A('pop', 0, 0.08, { cx, cy })}>${surface}${th.card ? `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none"${edge(th)}/>` : ''}` +
      LAYER_R.map((k, i) => `<path d="${quarter(R * k)}" fill="${LAYERS[i]}"${edge(th)}/>`).join('') +
      `<g${U.A('dim', 0.2, 0.06, { to: 0 })}><g${U.A('move', 0.12, 0.11, { x0: 0, y0: 0, x1: 110, y1: -110 })}><g clip-path="url(#${id}cut)">${surface}</g></g></g></g>`;
    // The names, from the outside in, with lines to each layer along the middle of the cut.
    const mid = (i) => { const r = (R * (LAYER_R[i] + (LAYER_R[i + 1] ?? 0))) / 2; return [cx + r * Math.SQRT1_2, cy - r * Math.SQRT1_2]; };
    LAYER_KEYS.forEach((k, i) => { o += callout(U, th, L[k], mid(i), 'right', cx + R + 90, 268 + i * 126, 0.3 + i * 0.12); });
    // An optional outline round the layer the narration is about.
    const f = LAYER_KEYS.indexOf(p.focus);
    if (f >= 0) {
      const r0 = R * LAYER_R[f], r1 = R * (LAYER_R[f + 1] ?? 0);
      const ring = r1 > 0 ? `M${cx} ${cy - r0}A${r0} ${r0} 0 0 1 ${cx + r0} ${cy}H${cx + r1}A${r1} ${r1} 0 0 0 ${cx} ${cy - r1}Z` : quarter(r0);
      o += `<path d="${ring}" fill="none" stroke="${th.accent}" stroke-width="7" stroke-linejoin="round" opacity="0"${U.A('fade', 0.8, 0.06)}/>`;
    }
    return o;
  },
});
