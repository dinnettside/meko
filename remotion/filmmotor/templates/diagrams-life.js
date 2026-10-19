// Animated diagrams of how living things work (life), drawn for Meko in the film engine's style. See ../engine.js for
// how templates work. Every visible word comes from the params; a part without a label in the params is drawn
// unlabeled. The drawings hold no numbers, names or dates of their own, so nothing on screen goes beyond what the
// narration says.
import { register } from "../engine.js";

const CAT = 'Diagrams';

// Living things keep their natural colors in every look. These read on the dark grounds (Night atlas, Blueprint) and on
// the light page (Field guide) alike.
const SCLERA = '#F1EEE8'; // the white of the eye
const SCLERA_EDGE = '#C9C3B8';
const CORNEA = '#A9D6EA'; // the clear front of the eye
const IRIS = '#8A5A34';
const LENS = '#E2F1F7';
const LENS_EDGE = '#8DB8CC';
const RETINA = '#E0607A';
const NERVE = '#F0D9A0'; // a nerve
const NERVE_EDGE = '#C9A964';
const BRAIN = '#EBA3B5';
const BRAIN_FOLD = '#C46F87';
const LEAF = '#4FA44A'; // a tree's crown
const TRUNK = '#8A5A34';
const TISSUE = '#E58C97'; // the mouth and the esophagus
const TISSUE_EDGE = '#C2606E';
const STOMACH = '#E8838C';
const STOMACH_EDGE = '#BF5763';
const LIVER = '#A65A48';
const SMALL_GUT = '#F2A77E'; // the small intestine
const SMALL_GUT_EDGE = '#CF7F57';
const LARGE_GUT = '#C98463'; // the large intestine
const LARGE_GUT_EDGE = '#9E5F43';
const BLOOD = '#D9473F';
const BLOOD_EDGE = '#A8302B';
const FOOD = '#C98B3A';
const FOOD_EDGE = '#8E5F22';
const WASTE = '#6E4521'; // what is left of the food
const WASTE_EDGE = '#F3DDB5';
const CELL = '#F5D3CB'; // a body cell
const CELL_EDGE = '#D98C7E'; // its membrane
const NUCLEUS = '#C792B8';
const NUCLEUS_EDGE = '#9D6390';
const VIRUS = '#6DBE45';
const VIRUS_DARK = '#3F7F22';
const GENE = '#4338CA'; // a virus's genes
const RECEPTOR = '#E5A93C';
const BARK = '#8B6239'; // the bark the beetles sit on
const BARK_LINE = '#76512E';
// The beetles' colors: brown ones hide on the bark, green and yellow ones stand out.
const BEETLES = { h: ['#6A4527', '#4A2F19'], g: ['#7CC444', '#3F7A20'], y: ['#F2CF4A', '#A8861E'] };
const SUN = '#F5A623'; // the sun and its light
const PLANT = '#4FA44A'; // the producer's icon, a plant's green

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const f1 = (v) => (+v).toFixed(1);
const smooth = (x) => { const t = clamp(x, 0, 1); return t * t * (3 - 2 * t); };
const span = (p, a, b) => clamp((p - a) / (b - a), 0, 1);
// A path through points.
const line = (P) => P.map(([x, y], i) => `${i ? 'L' : 'M'}${f1(x)} ${f1(y)}`).join('');
// A label's text from the params: a non-empty string, otherwise nothing.
const say = (v) => (typeof v === 'string' ? v.trim() : '');
const labelsOf = (p) => (p && p.labels && typeof p.labels === 'object' ? p.labels : {});
// The look's own edge for drawn shapes: chalk lines in Blueprint, thin ink in Field guide, none on Night atlas's flat
// shapes.
const edge = (th, w) => (th.card ? ` stroke="${th.card.stroke}" stroke-width="${w ?? th.card.width}" stroke-linejoin="round"` : '');

// A measured line: its points, the distance to each point along it and its length.
function track(pts) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { pts, cum, len: cum[cum.length - 1] };
}
// The point at distance s along a measured line, with the direction of the line there in degrees.
function pointAt(tr, s) {
  const d = clamp(s, 0, tr.len);
  let i = 1;
  while (i < tr.cum.length - 1 && tr.cum[i] < d) i++;
  const [ax, ay] = tr.pts[i - 1], [bx, by] = tr.pts[i], seg = tr.cum[i] - tr.cum[i - 1] || 1, u = (d - tr.cum[i - 1]) / seg;
  return { x: ax + (bx - ax) * u, y: ay + (by - ay) * u, a: (Math.atan2(by - ay, bx - ax) * 180) / Math.PI };
}
// A line through the corners `pts` with every corner rounded off at radius r, as dense points, so things can move
// along it at an even speed.
function rounded(pts, r) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i], [cx, cy] = pts[i + 1];
    const l1 = Math.hypot(bx - ax, by - ay), l2 = Math.hypot(cx - bx, cy - by), rr = Math.min(r, l1 / 2, l2 / 2);
    const p1 = [bx - ((bx - ax) / l1) * rr, by - ((by - ay) / l1) * rr], p2 = [bx + ((cx - bx) / l2) * rr, by + ((cy - by) / l2) * rr];
    for (let k = 0; k <= 10; k++) { const u = k / 10; out.push([(1 - u) * (1 - u) * p1[0] + 2 * (1 - u) * u * bx + u * u * p2[0], (1 - u) * (1 - u) * p1[1] + 2 * (1 - u) * u * by + u * u * p2[1]]); }
  }
  out.push(pts[pts.length - 1]);
  return out;
}
// Points along a quadratic curve from a over c to b.
const quadPts = (a, c, b, n = 30) => Array.from({ length: n + 1 }, (_, i) => { const t = i / n; return [(1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0], (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1]]; });

// A stroke that draws itself along its path from `at` over `dur`. pathLength makes the dash work without measuring the
// path, and the fade keeps a round cap from showing as a dot before the stroke starts.
const drawn = (U, d, col, w, at, dur, ex = '') =>
  `<g opacity="0"${U.A('fade', at, 0.004)}><path d="${d}" pathLength="1000" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="1000 1010" stroke-dashoffset="1000"${U.A('draw', at, dur, { l: 1000 })}${ex}/></g>`;

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

// A name from the params set next to the point (x, y): on the 'left' side the text ends there, on the 'right' side it
// starts there, and 'top' and 'bottom' center it above or below. It fades in at `at`. o: w (most width), f (color),
// id, an (an animation instead of the fade).
function nameText(U, th, text, x, y, side, at, o = {}) {
  const t = say(text);
  if (!t) return '';
  const { s, lines } = fitText(U, U.lab(t), o.w || 330), lh = Math.round(s * 1.15), n = lines.length;
  let a = 'middle', tx = x, y0;
  if (side === 'left' || side === 'right') { a = side === 'left' ? 'end' : 'start'; tx = side === 'left' ? x - 16 : x + 16; y0 = y - ((n - 1) * lh) / 2 + s * 0.35; }
  else if (side === 'top') y0 = y - 14 - s * 0.24 - (n - 1) * lh;
  else y0 = y + 14 + s * 0.74;
  return `<g${o.id ? ` id="${o.id}"` : ''} opacity="0"${o.an ?? U.A('fade', at, 0.05)}>${lines.map((l, i) => U.T(f1(tx), f1(y0 + i * lh), l, { a, s, w: 700, f: o.f || th.ink, halo: 8 })).join('')}</g>`;
}

// A part's name from the params with a line from the part at `part` to the point (x, y), where the name is set (see
// nameText). Without a name nothing is drawn.
function callout(U, th, text, part, side, x, y, at, o = {}) {
  if (!say(text)) return '';
  const d = `M${f1(part[0])} ${f1(part[1])}L${f1(x)} ${f1(y)}`;
  return `<g opacity="0"${U.A('fade', at, 0.04)}><path d="${d}" stroke="${th.bg}" stroke-width="9" stroke-linecap="round" fill="none"/><path d="${d}" stroke="${th.ink}" stroke-width="3" stroke-linecap="round" fill="none"/>` +
    `<circle cx="${f1(part[0])}" cy="${f1(part[1])}" r="8" fill="${th.ink}" stroke="${th.bg}" stroke-width="3"/></g>` +
    nameText(U, th, text, x, y, side, at + 0.02, o);
}

/* ---------------------------------------------------------------------------------------------------------------
 * eye_vision: an eye cut open, seen from the side, looking left at a tree. Light from the tree goes in through the
 * cornea and the pupil, the lens bends it onto the retina, where the picture lands upside down, and a signal runs
 * along the optic nerve to the brain, which lights up.
 * ------------------------------------------------------------------------------------------------------------- */
const EYE = (() => {
  const x = 925, y = 480, R = 225, wall = 22;
  const cornea = { x: x - 130, y, r: 140 }; // the cornea is a rounder cap on the front of the eyeball
  const lensX = x - 140, irisX = x - 174, pupil = 34;
  const tree = { x: 325, base: 650, top: 372 }; // the tree's crown reaches from 372 to its top at 650 - 278
  // The picture on the retina: the tree upside down and small, its base at the top.
  const img = { x: x + 150, half: 60, k: 120 / 278 };
  const top = [tree.x, tree.top + 8], bottom = [tree.x, tree.base - 4], toBottom = [img.x, y + img.half], toTop = [img.x, y - img.half];
  // A ray goes straight from the tree through the cornea and the pupil to the lens, which bends it onto the picture.
  const ray = (S, yP, I) => { const k = (yP - S[1]) / (irisX - S[0]); return [S, [irisX, yP], [lensX, yP + k * (lensX - irisX)], I]; };
  const bundles = [
    [ray(top, y - 28, toBottom), ray(top, y + 28, toBottom)], // light from the top of the tree lands at the bottom
    [ray(bottom, y - 28, toTop), ray(bottom, y + 28, toTop)], // and light from its foot at the top
  ];
  // The optic nerve leaves the back of the eye a little below the middle and runs to the underside of the brain.
  const a = (12 * Math.PI) / 180, brain = { x: x + 610, y: y - 125 };
  const nerve = quadPts([x + (R - wall - 12) * Math.cos(a), y + (R - wall - 12) * Math.sin(a)], [x + 420, y + 110], [brain.x - 70, brain.y + 64], 40);
  return { x, y, R, wall, cornea, lensX, irisX, pupil, tree, img, bundles, brain, nerve };
})();
// When things happen, as fractions of the scene.
// The light travels to the lens, then the lens bends it onto the retina.
const EYE_T = { toLens: [0.1, 0.28], toRetina: [0.3, 0.42], image: 0.43, signal: 0.5, brain: 0.64 };
// The arc of a circle around (cx, cy) with radius r from angle a0 to a1 (degrees, clockwise on screen).
const arc = (cx, cy, r, a0, a1) => { const rad = (d) => (d * Math.PI) / 180, p0 = [cx + r * Math.cos(rad(a0)), cy + r * Math.sin(rad(a0))], p1 = [cx + r * Math.cos(rad(a1)), cy + r * Math.sin(rad(a1))]; return `M${f1(p0[0])} ${f1(p0[1])}A${r} ${r} 0 ${Math.abs(a1 - a0) > 180 ? 1 : 0} 1 ${f1(p1[0])} ${f1(p1[1])}`; };
// A tree with its foot at 0 0, 278 high.
const treeShape = (th) => `<rect x="-12" y="-128" width="24" height="130" rx="5" fill="${TRUNK}"${edge(th)}/><circle cx="0" cy="-190" r="88" fill="${LEAF}"${edge(th)}/>` +
  `<path d="M-38 -214Q-30 -246 0 -252M30 -170Q46 -196 40 -226" fill="none" stroke="#3E8A3A" stroke-width="8" stroke-linecap="round"/>`;
// The brain seen from the side, facing left, around 0 0: the cerebrum, the cerebellum under its back and the brain
// stem.
const BRAIN_SHAPE = 'M-165 25C-178 -50 -120 -118 -40 -124C40 -130 130 -105 160 -45C178 -8 172 40 140 58C100 78 40 70 0 62C-50 74 -110 80 -140 62C-158 52 -165 40 -165 25Z';
const BRAIN_FOLDS = 'M-128 -30C-100 -62 -70 -24 -44 -60M-30 -100C-4 -70 26 -108 58 -80M-112 22C-80 0 -50 34 -14 10C18 -10 44 26 86 4M84 -66C112 -40 88 -4 136 8M-62 -10C-40 -40 -10 -20 6 -46M24 -36C46 -54 70 -30 96 -36';

register('eye_vision', {
  cat: CAT, title: 'How the eye sees',
  desc: 'An eye cut open, seen from the side, looking at a tree. Light from the tree goes in through the cornea and the pupil, the lens bends it onto the retina at the back, where the picture lands upside down, and a signal runs along the optic nerve to the brain, which lights up.',
  use: 'How we see: light, the cornea, the pupil, the lens, the retina, the optic nerve and the brain.',
  params: 'labels: {light, cornea, pupil, lens, retina, opticNerve, brain} (each optional, 1 to 3 words from the narration; a part without a label is drawn without one), image (optional, default true; false leaves out the upside-down picture on the retina), signal (optional, default true; false leaves out the optic nerve and the brain)',
  example: { labels: { light: 'Light', cornea: 'Cornea', pupil: 'Pupil', lens: 'Lens', retina: 'Retina', opticNerve: 'Optic nerve', brain: 'Brain' } },
  build(p, c) {
    const { U, th } = c, id = c.id, L = labelsOf(p), E = EYE, { x, y, R, wall, cornea: C } = E, T = EYE_T;
    const inner = R - wall, ink = th.card ? th.card.stroke : null;
    let o = '';
    // The tree the eye looks at.
    o += `<g${U.A('pop', 0.02, 0.06, { cx: E.tree.x, cy: E.tree.base })}><g transform="translate(${E.tree.x} ${E.tree.base})">${treeShape(th)}</g></g>`;
    // The optic nerve and the brain, behind the eye's wall. Left out with signal false, for a scene that only speaks of
    // the eye (added for Meko).
    const signal = p.signal !== false;
    const nd = line(E.nerve);
    if (signal) o += `<g opacity="0"${U.A('fade', 0.04, 0.06)}>${ink ? `<path d="${nd}" fill="none" stroke="${ink}" stroke-width="${46 + 2 * th.card.width}" stroke-linecap="round"/>` : ''}<path d="${nd}" fill="none" stroke="${NERVE}" stroke-width="46" stroke-linecap="round"/>` +
      `<path d="${nd}" fill="none" stroke="${NERVE_EDGE}" stroke-width="3" stroke-dasharray="2 16" stroke-linecap="round"/></g>`;
    const B = E.brain;
    if (signal) o += `<g${U.A('pop', 0.05, 0.07, { cx: B.x, cy: B.y })}><g transform="translate(${B.x} ${B.y})">` +
      `<path d="M30 60L44 128H82L80 60Z" fill="${BRAIN_FOLD}"${edge(th)}/><ellipse cx="108" cy="80" rx="58" ry="36" fill="${BRAIN_FOLD}"${edge(th)}/>` +
      `<path d="${BRAIN_SHAPE}" fill="${BRAIN}"${edge(th)}/><path d="${BRAIN_FOLDS}" fill="none" stroke="${BRAIN_FOLD}" stroke-width="6" stroke-linecap="round"/>` +
      `<path id="${id}glow" d="${BRAIN_SHAPE}" fill="#FFFFFF" fill-opacity=".3" stroke="${th.accent}" stroke-width="9" stroke-linejoin="round" opacity="0"/></g></g>`;
    // The eye: inside it the clear jelly (the look's panel color), its white wall round the back, the clear cornea in
    // front, the iris with the pupil between its two halves, the lens and the retina lining the back.
    o += `<g${U.A('pop', 0, 0.07, { cx: x, cy: y })}>` +
      `<circle cx="${x}" cy="${y}" r="${inner}" fill="${th.surface}"/><circle cx="${C.x}" cy="${C.y}" r="${C.r - 14}" fill="${th.surface}"/>`;
    const sclera = arc(x, y, R - wall / 2, -145, 145), front = arc(C.x, C.y, C.r - 7, 112.8, 247.2);
    o += `${ink ? `<path d="${sclera}" fill="none" stroke="${ink}" stroke-width="${wall + 2 * th.card.width}"/><path d="${front}" fill="none" stroke="${ink}" stroke-width="${14 + 2 * th.card.width}"/>` : `<path d="${sclera}" fill="none" stroke="${SCLERA_EDGE}" stroke-width="${wall + 4}"/>`}` +
      `<path d="${sclera}" fill="none" stroke="${SCLERA}" stroke-width="${wall}"/><path d="${front}" fill="none" stroke="${CORNEA}" stroke-width="14"/>` +
      `<path d="${arc(x, y, inner - 7, -118, 118)}" fill="none" stroke="${RETINA}" stroke-width="14"/>`;
    const ix = E.irisX, lx = E.lensX, pu = E.pupil;
    o += `<rect x="${ix - 6}" y="${y - 124}" width="13" height="${124 - pu}" rx="5" fill="${IRIS}"${edge(th)}/><rect x="${ix - 6}" y="${y + pu}" width="13" height="${124 - pu}" rx="5" fill="${IRIS}"${edge(th)}/>` +
      `<path d="M${lx} ${y - 88}Q${lx + 46} ${y} ${lx} ${y + 88}Q${lx - 46} ${y} ${lx} ${y - 88}Z" fill="${LENS}" stroke="${th.card ? th.card.stroke : LENS_EDGE}" stroke-width="3" stroke-linejoin="round"/></g>`;
    // The light: from the top of the tree and from its foot, each a beam whose two edge rays meet on the retina. The
    // beams cross behind the lens, so the picture lands upside down.
    // Each beam is revealed in two legs: up to the lens, then bent by the lens onto the retina.
    const [x0, xm, x1] = [E.tree.x, E.lensX, E.img.x + 6], [a1, b1] = T.toLens, [a2, b2] = T.toRetina;
    o += `<defs><clipPath id="${id}leg1"><rect x="${x0}" y="${y - 200}" width="${xm - x0}" height="400"${U.A('wipe', a1, b1 - a1, { w: xm - x0 })}/></clipPath>` +
      `<clipPath id="${id}leg2"><rect x="${xm}" y="${y - 200}" width="${x1 - xm}" height="400"${U.A('wipe', a2, b2 - a2, { w: x1 - xm })}/></clipPath></defs>`;
    E.bundles.forEach((rays, k) => {
      const col = k ? th.accent2 : th.accent, [a, b] = rays;
      o += `<g clip-path="url(#${id}leg1)"><path d="${line([a[0], a[2], b[2]])}Z" fill="${col}" opacity=".2"/></g>` +
        `<g clip-path="url(#${id}leg2)"><path d="${line([a[2], a[3], b[2]])}Z" fill="${col}" opacity=".2"/></g>`;
      rays.forEach((r) => { o += drawn(U, line([r[0], r[2]]), col, 5, a1, b1 - a1) + drawn(U, line([r[2], r[3]]), col, 5, a2, b2 - a2); });
    });
    // The picture on the retina: the tree, small and upside down.
    if (p.image !== false) {
      const I = E.img;
      o += `<g${U.A('pop', T.image, 0.05, { cx: I.x, cy: y })}><g transform="translate(${I.x} ${y - I.half}) rotate(180) scale(${I.k.toFixed(4)})">${treeShape(th)}</g></g>`;
    }
    // The signal on its way along the optic nerve: a bright stroke with a wider faint one around it (see render).
    const len = track(E.nerve).len.toFixed(0);
    if (signal) o += `<path id="${id}sigh" d="${nd}" fill="none" stroke="${th.accent}" stroke-width="40" stroke-linecap="round" stroke-dasharray="0 ${len}" opacity="0"/>` +
      `<path id="${id}sig" d="${nd}" fill="none" stroke="${th.accent}" stroke-width="16" stroke-linecap="round" stroke-dasharray="0 ${len}" opacity="0"/>`;
    // The names, each as the light or the signal reaches its part.
    const [a0] = E.bundles[1];
    const lightAt = [(a0[0][0] + a0[1][0]) / 2, (a0[0][1] + a0[1][1]) / 2];
    o += nameText(U, th, L.light, lightAt[0] - 10, lightAt[1] + 50, 'bottom', 0.12, { w: 300 }) +
      callout(U, th, L.cornea, [C.x + C.r * Math.cos((215 * Math.PI) / 180), C.y + C.r * Math.sin((215 * Math.PI) / 180)], 'top', x - 360, y - 222, 0.205, { w: 300 }) +
      callout(U, th, L.pupil, [ix, y + pu + 2], 'bottom', ix - 40, y + 262, 0.232, { w: 300 }) +
      callout(U, th, L.lens, [lx, y - 88], 'top', x - 60, y - 222, 0.27, { w: 290 }) +
      callout(U, th, L.retina, [x + (inner - 7) * Math.cos(-0.9), y + (inner - 7) * Math.sin(-0.9)], 'top', x + 250, y - 222, 0.39, { w: 300 });
    const nm = E.nerve[22];
    if (signal) o += callout(U, th, L.opticNerve, nm, 'bottom', nm[0] + 20, nm[1] + 120, EYE_T.signal + 0.02, { w: 320 }) +
      nameText(U, th, L.brain, B.x + 10, B.y - 128, 'top', EYE_T.brain, { w: 330 });
    return o;
  },
  init(g, p, c) {
    const q = (s) => g.querySelector('#' + c.id + s);
    return { sig: q('sig'), halo: q('sigh'), glow: q('glow'), len: track(EYE.nerve).len };
  },
  render(l, st) {
    // Signals run along the optic nerve one after another once the picture has landed, and the brain lights up as each
    // one arrives.
    const t0 = EYE_T.signal * l.dur, trip = clamp(0.12 * l.dur, 0.6, 1), period = trip + 0.7, dash = 120, len = st.len;
    let head = -1, glow = 0;
    if (l.t >= t0) {
      const k = Math.floor((l.t - t0) / period), u = (l.t - t0 - k * period) / trip;
      if (u < 1) head = smooth(u) * (len + dash);
      // The glow: up as a signal arrives, then fading until the next one; the first one lights the brain for good.
      const since = l.t - t0 - trip - (u < 1 ? k - 1 : k) * period;
      if (k > 0 || u >= 1) glow = 0.55 + 0.45 * Math.max(0, 1 - since / 0.6);
    }
    const from = Math.max(0, head - dash), to = Math.min(len, head), on = head > 0 && to > from;
    [st.sig, st.halo].forEach((el, i) => {
      if (!el) return;
      el.setAttribute('stroke-dasharray', `${Math.max(0.1, to - from).toFixed(1)} ${(len + 200).toFixed(0)}`);
      el.setAttribute('stroke-dashoffset', f1(-from));
      el.setAttribute('opacity', on ? (i ? '0.3' : '1') : '0');
    });
    st.glow?.setAttribute('opacity', glow.toFixed(3));
  },
});

/* ---------------------------------------------------------------------------------------------------------------
 * digestion: a plain body outline with the digestive tract inside it. A bite of food goes from the mouth down the
 * esophagus into the stomach, which churns it into pieces; the pieces move along the small intestine, where a zoom
 * circle shows nutrients passing through its wall into the blood, and what is left moves on through the large
 * intestine. The liver is drawn as a quiet shape. As in any front view, the body's left side is on the viewer's right.
 * ------------------------------------------------------------------------------------------------------------- */
const DIG = (() => {
  const eso = [[960, 266], [960, 344], [964, 404], [976, 444], [998, 468]];
  const small = [[958, 578], [946, 604], [944, 642], [1036, 642], [1036, 670], [888, 670], [888, 698], [1036, 698], [1036, 726], [888, 726], [888, 752], [866, 754]];
  const large = [[846, 766], [846, 612], [1076, 612], [1076, 744], [1012, 766], [972, 778]];
  const inset = { x: 1400, y: 652, r: 145, spot: [1036, 712], spotR: 26 };
  return {
    body: 'M932 290L932 330C850 334 784 352 768 410L756 800H1164L1152 410C1136 352 1070 334 988 330L988 290Z',
    head: { x: 960, y: 222, rx: 64, ry: 76 },
    arms: 'M804 474Q800 640 794 800M1116 474Q1120 640 1126 800',
    mouth: [960, 264],
    eso, esoPath: rounded(eso, 30),
    stomach: 'M994 468C1000 444 1040 434 1070 446C1102 460 1112 506 1104 544C1096 584 1060 604 1018 602C994 601 974 594 960 586L956 570C976 573 1000 570 1022 560C1046 548 1054 522 1046 502C1038 486 1018 482 1004 490Z',
    belly: [1046, 530], // the middle of the stomach, where the food is churned
    liver: 'M808 472C836 440 944 434 1004 448C1008 462 994 480 974 494C934 522 872 542 830 538C810 532 800 502 808 472Z',
    smallPath: rounded(small, 14), largePath: rounded(large, 26),
    // The ways the food takes: down into the middle of the stomach, out of it along the small intestine, and along the
    // large intestine.
    down: track(rounded([...eso, [1030, 500], [1046, 528]], 30)),
    through: track(rounded([[1046, 528], [1000, 562], ...small], 14)),
    rest: track(rounded(large, 26)),
    inset,
  };
})();
// With the zoom circle, the whole drawing is moved this far left, so the body and the circle beside it sit in the middle
// together.
const DIG_DX = -80;
const DIG_T = { mouth: 0.1, down: [0.12, 0.26], churn: [0.27, 0.45], small: [0.44, 0.6], inset: 0.5, flow: 0.53, large: [0.64, 0.86] };
// The villi of the small intestine's wall in the zoom circle, their middles as offsets from its center.
const VILLI = [-96, -32, 32, 96];
// The two outer tangent lines between two circles.
function tangents(a, ra, b, rb) {
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]), th = Math.atan2(b[1] - a[1], b[0] - a[0]), ph = Math.acos((ra - rb) / d);
  return [1, -1].map((s) => [[a[0] + ra * Math.cos(th + s * ph), a[1] + ra * Math.sin(th + s * ph)], [b[0] + rb * Math.cos(th + s * ph), b[1] + rb * Math.sin(th + s * ph)]]);
}
// A tube along the points P: an edge, then the tube itself. o: band (bands across the tube, like the large intestine's
// pouches).
function tube(th, P, w, fill, edgeCol, o = {}) {
  const d = line(P), ink = th.card ? th.card.stroke : edgeCol, ew = th.card ? th.card.width * 2 : 4;
  return `<path d="${d}" fill="none" stroke="${ink}" stroke-width="${w + ew}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${fill}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>` +
    (o.band ? `<path d="${d}" fill="none" stroke="${o.band}" stroke-width="${w}" stroke-dasharray="4 24" stroke-linejoin="round"/>` : '');
}

register('digestion', {
  cat: CAT, title: 'How we digest food',
  desc: 'A plain body outline with the digestive tract inside it. A bite of food goes from the mouth down the esophagus into the stomach, which churns it into pieces; the pieces move along the small intestine, where a zoom circle shows nutrients passing through its wall into the blood, and what is left moves on through the large intestine. The liver is drawn as a quiet shape.',
  use: 'Digestion: the path food takes through the body, the stomach, the intestines and how nutrients get into the blood.',
  params: 'labels: {mouth, esophagus, stomach, smallIntestine, largeIntestine, liver, nutrients} (each optional, 1 to 3 words from the narration; a part without a label is drawn without one), zoom (optional, default true; false leaves out the zoom circle where nutrients pass into the blood)',
  example: { labels: { mouth: 'Mouth', esophagus: 'Esophagus', stomach: 'Stomach', smallIntestine: 'Small intestine', largeIntestine: 'Large intestine', liver: 'Liver', nutrients: 'Nutrients' } },
  build(p, c) {
    const { U, th } = c, id = c.id, L = labelsOf(p), D = DIG, T = DIG_T, Z = D.inset, hd = D.head, zoom = p.zoom !== false;
    let o = `<g transform="translate(${zoom ? DIG_DX : 0} 0)">`;
    // The body: a plain outline with the arms at its sides, no face and nothing that tells man from woman.
    const armLine = th.card ? th.card.stroke : th.bg;
    o += `<g opacity="0"${U.A('fade', 0, 0.06)}><path d="${D.body}" fill="${th.surface}"${edge(th)}/><ellipse cx="${hd.x}" cy="${hd.y}" rx="${hd.rx}" ry="${hd.ry}" fill="${th.surface}"${edge(th)}/>` +
      `<path d="${D.arms}" fill="none" stroke="${armLine}" stroke-width="${th.card ? th.card.width : 6}" stroke-linecap="round"/></g>`;
    // The organs, in from the top down.
    o += `<g opacity="0"${U.A('fade', 0.04, 0.05)}><path d="${D.liver}" fill="${LIVER}"${edge(th)}/></g>`;
    o += `<g opacity="0"${U.A('fade', 0.05, 0.05)}>${tube(th, D.largePath, 34, LARGE_GUT, LARGE_GUT_EDGE, { band: LARGE_GUT_EDGE })}</g>`;
    o += `<g opacity="0"${U.A('fade', 0.045, 0.05)}>${tube(th, D.smallPath, 18, SMALL_GUT, SMALL_GUT_EDGE)}</g>`;
    o += `<g opacity="0"${U.A('fade', 0.03, 0.05)}><g id="${id}stomach"><path d="${D.stomach}" fill="${STOMACH}" stroke="${th.card ? th.card.stroke : STOMACH_EDGE}" stroke-width="${th.card ? th.card.width : 4}" stroke-linejoin="round"/>` +
      `<path d="M1010 470C1030 462 1062 466 1078 484M1088 520C1086 552 1064 574 1032 582" fill="none" stroke="${STOMACH_EDGE}" stroke-width="4" stroke-linecap="round" opacity=".6"/></g></g>`;
    o += `<g opacity="0"${U.A('fade', 0.02, 0.05)}>${tube(th, D.esoPath, 16, TISSUE, TISSUE_EDGE)}<ellipse cx="${D.mouth[0]}" cy="${D.mouth[1]}" rx="25" ry="11" fill="${TISSUE}" stroke="${th.card ? th.card.stroke : TISSUE_EDGE}" stroke-width="${th.card ? th.card.width : 3}"/></g>`;
    // The food: a bite with the esophagus widening round it, then pieces, then what is left (see render).
    o += `<circle id="${id}bulge" r="18" fill="${TISSUE}" stroke="${th.card ? th.card.stroke : TISSUE_EDGE}" stroke-width="3" opacity="0"/><circle id="${id}bite" r="15" fill="${FOOD}" stroke="${FOOD_EDGE}" stroke-width="3" opacity="0"/>`;
    for (let j = 0; j < 6; j++) o += `<circle id="${id}bit${j}" r="9" fill="${FOOD}" stroke="${FOOD_EDGE}" stroke-width="3" opacity="0"/>`;
    for (let j = 0; j < 4; j++) o += `<circle id="${id}rest${j}" r="9" fill="${WASTE}" stroke="${WASTE_EDGE}" stroke-width="3" opacity="0"/>`;
    // The zoom circle on the small intestine's wall: finger-like villi reach into the gut, a blood vessel runs under
    // them with a small vessel up into each villus, and nutrients pass through the wall into the blood.
    const tl = tangents(Z.spot, Z.spotR, [Z.x, Z.y], Z.r);
    if (zoom) o += `<g opacity="0"${U.A('fade', T.inset - 0.01, 0.04)}><circle cx="${Z.spot[0]}" cy="${Z.spot[1]}" r="${Z.spotR}" fill="none" stroke="${th.ink}" stroke-width="4"/>` +
      tl.map(([a, b]) => `<path d="M${f1(a[0])} ${f1(a[1])}L${f1(b[0])} ${f1(b[1])}" stroke="${th.muted}" stroke-width="3"/>`).join('') + '</g>';
    let wall = `M${Z.x - Z.r - 10} ${Z.y + 140}V${Z.y + 6}`;
    VILLI.forEach((dx) => { const vx = Z.x + dx; wall += `H${vx - 20}V${Z.y - 46}A20 20 0 0 1 ${vx + 20} ${Z.y - 46}V${Z.y + 6}`; });
    wall += `H${Z.x + Z.r + 10}V${Z.y + 140}Z`;
    let inside = `<circle cx="${Z.x}" cy="${Z.y}" r="${Z.r}" fill="${th.surface}"/><path d="${wall}" fill="${SMALL_GUT}" stroke="${SMALL_GUT_EDGE}" stroke-width="3"/>` +
      VILLI.map((dx) => `<path d="M${Z.x + dx} ${Z.y + 60}V${Z.y - 44}" stroke="${BLOOD}" stroke-width="8" stroke-linecap="round"/>`).join('') +
      `<rect x="${Z.x - Z.r - 10}" y="${Z.y + 48}" width="${2 * Z.r + 20}" height="44" fill="${BLOOD}" stroke="${BLOOD_EDGE}" stroke-width="3"/>`;
    for (let j = 0; j < VILLI.length * 2; j++) inside += `<circle id="${id}nu${j}" r="10" fill="${th.accent}" stroke="${th.bg}" stroke-width="3" opacity="0"/>`;
    if (zoom) o += `<defs><clipPath id="${id}zoom"><circle cx="${Z.x}" cy="${Z.y}" r="${Z.r}"/></clipPath></defs>` +
      `<g${U.A('pop', T.inset, 0.06, { cx: Z.x, cy: Z.y })}><g clip-path="url(#${id}zoom)">${inside}</g><circle cx="${Z.x}" cy="${Z.y}" r="${Z.r}" fill="none" stroke="${th.ink}" stroke-width="4"/></g>`;
    // The names, each as the food reaches its part.
    o += callout(U, th, L.mouth, [934, 264], 'left', 744, 264, T.mouth, { w: 320 }) +
      callout(U, th, L.esophagus, [960, 380], 'left', 744, 380, T.down[0] + 0.03, { w: 320 }) +
      callout(U, th, L.liver, [852, 500], 'left', 744, 500, T.churn[0] + 0.05, { w: 320 }) +
      callout(U, th, L.stomach, [1098, 486], 'right', 1190, 430, T.churn[0] + 0.01, { w: 320 }) +
      callout(U, th, L.largeIntestine, [846, 650], 'left', 744, 640, T.large[0] + 0.02, { w: 320 }) +
      callout(U, th, L.smallIntestine, [888, 740], 'left', 744, 760, T.small[0] + 0.02, { w: 320 }) +
      (zoom ? nameText(U, th, L.nutrients, Z.x + Z.r, Z.y, 'right', T.flow, { w: 300 }) : '');
    return o + '</g>';
  },
  init(g, p, c) {
    const q = (s) => g.querySelector('#' + c.id + s);
    return { stomach: q('stomach'), bite: q('bite'), bulge: q('bulge'), bits: [0, 1, 2, 3, 4, 5].map((j) => q('bit' + j)), rest: [0, 1, 2, 3].map((j) => q('rest' + j)), nu: Array.from({ length: VILLI.length * 2 }, (_, j) => q('nu' + j)), esoLen: track(DIG.esoPath).len };
  },
  render(l, st, p, c) {
    const { U } = c, P = l.p, t = l.t, T = DIG_T, D = DIG, [bx, by] = D.belly;
    const put = (el, x, y, op, r) => { if (!el) return; el.setAttribute('cx', f1(x)); el.setAttribute('cy', f1(y)); el.setAttribute('opacity', op.toFixed(2)); if (r != null) el.setAttribute('r', f1(r)); };
    // The bite: in the mouth, then down the esophagus, which widens round it, into the stomach.
    const s = U.ease.io(span(P, T.down[0], T.down[1])) * D.down.len, at = pointAt(D.down, s), inMouth = P >= T.mouth && P < T.down[1];
    put(st.bite, at.x, at.y, inMouth ? 1 : 0, 15 * Math.min(1, U.ease.back(span(P, T.mouth, T.mouth + 0.025))));
    put(st.bulge, at.x, at.y, P > T.down[0] && s < st.esoLen ? 1 : 0);
    // The stomach churns while the food is in it.
    const A = smooth(span(P, T.churn[0], T.churn[0] + 0.03)) * (1 - smooth(span(P, T.churn[1] - 0.03, T.churn[1]))), w = Math.sin(t * 2 * Math.PI * 1.3);
    st.stomach?.setAttribute('transform', `translate(${bx} ${by}) scale(${(1 + 0.05 * A * w).toFixed(4)} ${(1 - 0.05 * A * w).toFixed(4)}) translate(${-bx} ${-by})`);
    // The pieces: churned round inside the stomach, then out along the small intestine one after another, getting
    // smaller as their nutrients go into the blood.
    st.bits.forEach((el, j) => {
      const leave = T.small[0] + j * 0.014, arrive = T.small[1] + j * 0.014;
      if (P < T.down[1] || P >= arrive) return put(el, bx, by, 0);
      if (P < leave) {
        const spread = smooth(span(P, T.down[1], T.down[1] + 0.03)), a = t * 2.4 + (j * Math.PI) / 3, rr = 30 * spread * (1 + 0.15 * A * w);
        return put(el, bx + rr * Math.cos(a), by + 0.62 * rr * Math.sin(a), 1, 9);
      }
      const u = span(P, leave, arrive), pt = pointAt(D.through, U.ease.io(u) * D.through.len);
      return put(el, pt.x, pt.y, Math.min(1, (1 - u) / 0.08), 9 - 2.5 * u);
    });
    // What is left goes on through the large intestine.
    st.rest.forEach((el, j) => {
      const a = T.large[0] + j * 0.025, b = T.large[1] - 0.075 + j * 0.025, u = span(P, a, b);
      if (P < a || u >= 1) return put(el, 0, 0, 0);
      const pt = pointAt(D.rest, U.ease.io(u) * D.rest.len);
      return put(el, pt.x, pt.y, Math.min(1, u / 0.05, (1 - u) / 0.12));
    });
    // Nutrients in the zoom circle: from the gut into a villus, down its small vessel into the blood and away.
    const Z = D.inset, t0 = T.flow * l.dur, period = 2.6;
    st.nu.forEach((el, j) => {
      // Each dot starts its first trip a little after the one before, from the gut, so none pops up half way.
      const u = (l.t - t0) / period - j / st.nu.length;
      if (u < 0) return put(el, 0, 0, 0);
      const k = j % VILLI.length, side = j < VILLI.length ? -1 : 1, vx = Z.x + VILLI[k], f = u - Math.floor(u);
      const tr = track([[vx + side * 34, Z.y - 140], [vx, Z.y - 58], [vx, Z.y + 70], [Z.x + Z.r + 40, Z.y + 70]]), pt = pointAt(tr, smooth(f) * tr.len);
      return put(el, pt.x, pt.y, Math.min(1, f / 0.06));
    });
  },
});

/* ---------------------------------------------------------------------------------------------------------------
 * virus_infection: a virus drifts to a cell, attaches to a receptor on its surface and puts its genes into it. The
 * cell makes copies of the genes and new viruses form around them, and then the cell bursts open on one side and the
 * new viruses come out.
 * ------------------------------------------------------------------------------------------------------------- */
const VIR = (() => {
  const cx = 1010, cy = 500, rx = 400, ry = 250;
  // The cell's edge, a little uneven, and the point on it at an angle (degrees, clockwise from the right) moved `out`
  // along the outward direction there.
  const rOf = (a) => 1 + 0.022 * Math.sin(3 * a + 0.5) + 0.014 * Math.sin(5 * a + 1.3);
  const at = (deg, out = 0) => {
    const a = (deg * Math.PI) / 180, k = rOf(a), nx = Math.cos(a) / rx, ny = Math.sin(a) / ry, n = Math.hypot(nx, ny);
    return [cx + rx * k * Math.cos(a) + (out * nx) / n, cy + ry * k * Math.sin(a) + (out * ny) / n];
  };
  const outline = Array.from({ length: 121 }, (_, i) => at(i * 3));
  const dock = 196, receptors = [dock, 236, 272, 312, 154, 118, 74];
  const R = 50; // the virus's radius; its spikes reach 18 further
  const virus = at(dock, 26 + R + 18), start = [virus[0] - 110, virus[1] - 130];
  // The new viruses: where they form inside the cell, and where they end up once the cell has burst.
  const copies = [[1110, 380], [1236, 446], [1130, 520], [1262, 590], [1082, 640], [1190, 670]];
  const out = [[1520, 318], [1640, 420], [1556, 512], [1668, 600], [1500, 680], [1620, 730]];
  // The genes' way from where the virus holds on to the middle of the cell, as a wavy line.
  const base = quadPts(at(dock, -6), [760, 420], [800, 500], 60), gt = track(base);
  const genes = base.map((q, i) => { const s = gt.cum[i], j = Math.min(i, base.length - 2), dx = base[j + 1][0] - base[j][0], dy = base[j + 1][1] - base[j][1], d = Math.hypot(dx, dy) || 1, w = 9 * Math.sin(s / 13) * Math.min(1, s / 30); return [q[0] - (dy / d) * w, q[1] + (dx / d) * w]; });
  return { cx, cy, rx, ry, at, outline, dock, receptors, R, virus, start, copies, out, genes, nucleus: [880, 520] };
})();
// When things happen, from the moment the virus attaches (`at`, a fraction of the scene). The rest is squeezed when it
// attaches late, so it always ends before the scene does.
function virusTimes(at) {
  const A = typeof at === 'number' && Number.isFinite(at) ? clamp(at, 0.12, 0.5) : 0.24, k = Math.min(1, (0.94 - A) / 0.62), T = (x) => A + x * k;
  return { A, glide: [Math.max(0.05, A - 0.12), A], inject: [T(0.02), T(0.12)], copies: [T(0.14), T(0.22)], shells: [T(0.22), T(0.4)], burst: T(0.47), out: [T(0.47), T(0.6)] };
}
// A virus round 0 0 with radius r: a ball with knobbed spikes all round.
function virusShape(th, r) {
  let o = '';
  for (let k = 0; k < 12; k++) {
    const a = (k * Math.PI) / 6 + 0.26, c = Math.cos(a), s = Math.sin(a);
    o += `<path d="M${f1(r * 0.8 * c)} ${f1(r * 0.8 * s)}L${f1((r + r * 0.28) * c)} ${f1((r + r * 0.28) * s)}" stroke="${VIRUS_DARK}" stroke-width="${f1(r * 0.13)}" stroke-linecap="round"/><circle cx="${f1((r + r * 0.28) * c)}" cy="${f1((r + r * 0.28) * s)}" r="${f1(r * 0.13)}" fill="${VIRUS_DARK}"/>`;
  }
  return o + `<circle r="${r}" fill="${VIRUS}" stroke="${th.card ? th.card.stroke : VIRUS_DARK}" stroke-width="${th.card ? th.card.width : 3}"/>`;
}
// A short wavy strand of genes round 0 0, `w` wide.
const strand = (w, col, width = 6) => { const P = []; for (let i = 0; i <= 24; i++) { const u = i / 24; P.push([-w / 2 + w * u, 7 * Math.sin(u * Math.PI * 4)]); } return `<path d="${line(P)}" fill="none" stroke="${col}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`; };

register('virus_infection', {
  cat: CAT, title: 'How a virus infects a cell',
  desc: 'A virus drifts to a cell and attaches to a receptor on its surface, then puts its genes into the cell. The cell makes copies of the genes and new viruses form around them; then the cell bursts open on one side and the new viruses come out. Each step comes in one after the other.',
  use: 'Viruses and infections: how a virus gets into a cell, takes it over to make copies of itself, and spreads.',
  params: 'labels: {virus, cell, receptor, genes, copies} (each optional, 1 to 3 words from the narration; a part without a label is drawn without one), at (optional: when the virus attaches, a fraction of the scene or a word of the narration), bursts (optional, default true; false keeps the cell whole while the new viruses leave it)',
  example: { labels: { virus: 'Virus', cell: 'Cell', receptor: 'Receptor', genes: 'Viral genes', copies: 'New viruses' } },
  build(p, c) {
    const { U, th } = c, id = c.id, L = labelsOf(p), V = VIR, T = virusTimes(p.at), A = T.A, k = Math.min(1, (0.94 - A) / 0.62);
    let o = '';
    // The cell: its inside, its nucleus and its membrane, which tears open on the right when it bursts (see render).
    const [nx, ny] = V.nucleus;
    o += `<g${U.A('pop', 0, 0.07, { cx: V.cx, cy: V.cy })}><path id="${id}cyto" d="${line(V.outline)}Z" fill="${CELL}"/>` +
      `<circle cx="${nx}" cy="${ny}" r="92" fill="${NUCLEUS}" stroke="${th.card ? th.card.stroke : NUCLEUS_EDGE}" stroke-width="${th.card ? th.card.width : 4}"/><circle cx="${nx + 24}" cy="${ny - 18}" r="26" fill="${NUCLEUS_EDGE}"/>` +
      `<path id="${id}mem" d="${line(V.outline)}" pathLength="1000" fill="none" stroke="${CELL_EDGE}" stroke-width="12" stroke-linejoin="round" stroke-linecap="round"/>` +
      (th.card ? `<path id="${id}memEdge" d="${line(V.outline)}" pathLength="1000" fill="none" stroke="${th.card.stroke}" stroke-width="${th.card.width}"/>` : '') + '</g>';
    // The receptors on the cell's surface: a stalk with a cup at its end.
    V.receptors.forEach((deg, j) => {
      const a = V.at(deg), b = V.at(deg, 18), cup = V.at(deg, 26), ang = (Math.atan2(cup[1] - a[1], cup[0] - a[0]) * 180) / Math.PI;
      o += `<g${U.A('pop', 0.04 + j * 0.006, 0.04, { cx: a[0], cy: a[1] })}><path d="M${f1(a[0])} ${f1(a[1])}L${f1(b[0])} ${f1(b[1])}" stroke="${RECEPTOR}" stroke-width="8" stroke-linecap="round"/>` +
        `<path d="M0 -13Q-12 0 0 13" transform="translate(${f1(cup[0])} ${f1(cup[1])}) rotate(${f1(ang + 180)})" fill="none" stroke="${RECEPTOR}" stroke-width="8" stroke-linecap="round"/></g>`;
    });
    // Where the virus holds on, a ring that flashes as it attaches.
    const hold = V.at(V.dock, 30);
    o += `<g opacity="0"${U.A('fade', A, 0.01)}><g${U.A('dim', A + 0.04, 0.06, { to: 0 })}><circle cx="${f1(hold[0])}" cy="${f1(hold[1])}" r="30" fill="none" stroke="${th.accent}" stroke-width="7"/></g></g>`;
    // The genes going into the cell.
    o += drawn(U, line(V.genes), GENE, 7, T.inject[0], T.inject[1] - T.inject[0]);
    // The copies: first their genes, then a new virus round each.
    V.copies.forEach(([x, y], j) => {
      const g = T.copies[0] + ((T.copies[1] - T.copies[0]) * j) / 5, sh = T.shells[0] + ((T.shells[1] - T.shells[0] - 0.05 * k) * j) / 5;
      o += `<g id="${id}cp${j}"><g${U.A('pop', sh, 0.05, { cx: x, cy: y })}><g transform="translate(${x} ${y})">${virusShape(th, 30)}</g></g>` +
        `<g${U.A('pop', g, 0.04, { cx: x, cy: y })}><g transform="translate(${x} ${y}) rotate(${(j * 37) % 90 - 45})">${strand(40, GENE, 5)}</g></g></g>`;
    });
    // The torn edge as the cell bursts.
    if (p.bursts !== false) o += `<g opacity="0"${U.A('fade', T.burst, 0.01)}><g${U.A('dim', T.burst + 0.08, 0.06, { to: 0 })}>` +
      [-50, -25, 0, 25, 50].map((d) => { const a = V.at(d * 0.6, 20), b = V.at(d * 0.6, 64); return `<path d="M${f1(a[0])} ${f1(a[1])}L${f1(b[0])} ${f1(b[1])}" stroke="${th.accent}" stroke-width="7" stroke-linecap="round"/>`; }).join('') + '</g></g>';
    // The virus that attacks, with its genes inside it until it puts them into the cell.
    o += `<g id="${id}virus" opacity="0">${virusShape(th, V.R)}<g opacity="1"${U.A('dim', T.inject[0], 0.04, { to: 0 })}>${strand(60, GENE, 7)}</g></g>`;
    // The names.
    const rcp = V.at(V.dock, 12), gm = V.genes[Math.round(V.genes.length * 0.45)];
    o += callout(U, th, L.cell, V.at(130), 'left', 660, 744, 0.05, { w: 320 }) +
      callout(U, th, L.receptor, rcp, 'left', 566, 530, Math.max(0.06, A - 0.06), { w: 300 }) +
      nameText(U, th, L.virus, V.virus[0] - V.R - 34, V.virus[1], 'left', A, { w: 300 }) +
      callout(U, th, L.genes, gm, 'top', 760, 222, T.inject[0] + 0.05 * k, { w: 320 }) +
      nameText(U, th, L.copies, 1290, 222, 'top', T.shells[0] + 0.12 * k, { w: 340 });
    return o;
  },
  init(g, p, c) {
    const q = (s) => g.querySelector('#' + c.id + s);
    return { virus: q('virus'), cyto: q('cyto'), mem: [q('mem'), q('memEdge')].filter(Boolean), copies: VIR.copies.map((_, j) => q('cp' + j)) };
  },
  render(l, st, p) {
    const V = VIR, T = virusTimes(p.at), P = l.p, t = l.t;
    // The virus: it appears, bobs as it drifts, and glides to the receptor, where it stays.
    const g = smooth(span(P, T.glide[0], T.glide[1])), bob = 1 - g;
    const x = V.start[0] + (V.virus[0] - V.start[0]) * g + bob * 8 * Math.sin(t * 1.7), y = V.start[1] + (V.virus[1] - V.start[1]) * g + bob * 8 * Math.cos(t * 1.3);
    const shown = Math.min(1, span(P, 0.03, 0.06) * 1.2), emptied = span(P, T.inject[1] - 0.02, T.inject[1] + 0.04);
    st.virus?.setAttribute('transform', `translate(${f1(x)} ${f1(y)}) rotate(${f1((1 - g) * 20 * Math.sin(t * 0.8))})`);
    st.virus?.setAttribute('opacity', (shown * (1 - 0.35 * emptied)).toFixed(3));
    // The burst: the membrane opens on the right, and the new viruses come out through the gap and drift. Without the
    // burst the cell stays whole and the new viruses leave through its membrane.
    const b = p.bursts === false ? 0 : smooth(span(P, T.burst, T.burst + 0.03)), gap = 105 * b;
    st.mem.forEach((el) => {
      el.setAttribute('stroke-dasharray', gap > 0.5 ? `${f1(1000 - 2 * gap)} ${f1(2 * gap)}` : '1000 0');
      el.setAttribute('stroke-dashoffset', f1(-gap));
    });
    // Where the membrane is gone, the cell's edge breaks into a jagged tear.
    if (st.cyto) {
      const torn = V.outline.map(([x0, y0], i) => {
        const deg = i * 3 > 180 ? i * 3 - 360 : i * 3, w = b * smooth(1 - Math.abs(deg) / 38), k = 1 - w * (0.07 + 0.045 * (i % 2 ? 1 : -1));
        return [V.cx + (x0 - V.cx) * k, V.cy + (y0 - V.cy) * k];
      });
      st.cyto.setAttribute('d', line(torn) + 'Z');
    }
    st.copies.forEach((el, j) => {
      if (!el) return;
      const u = smooth(span(P, T.out[0] + j * 0.012, T.out[1] + j * 0.012)), [x0, y0] = V.copies[j], [x1, y1] = V.out[j], drift = u * 7;
      el.setAttribute('transform', `translate(${f1((x1 - x0) * u + drift * Math.sin(t * 1.4 + j * 1.9))} ${f1((y1 - y0) * u + drift * Math.cos(t * 1.1 + j * 1.3))})`);
    });
  },
});

/* ---------------------------------------------------------------------------------------------------------------
 * natural_selection: a population of beetles on bark in three colors. A bird picks off the green and yellow ones that
 * stand out, the brown ones that are hidden survive, and their young fill the next panel: each generation is more
 * brown than the one before. The generations are panels side by side, joined by arrows, with no numbers.
 * ------------------------------------------------------------------------------------------------------------- */
// Where the beetles sit in a panel (as shares of its width and height) and how each is turned.
const SPOTS = [[0.14, 0.22, 20], [0.42, 0.16, -15], [0.72, 0.26, 35], [0.24, 0.52, -30], [0.55, 0.47, 10], [0.85, 0.55, -20], [0.12, 0.82, 15], [0.4, 0.8, -40], [0.66, 0.78, 25], [0.88, 0.86, -10]];
// Each generation's colors at those spots, and which beetles the bird catches. With three generations the bird also
// hunts in the second panel.
const GENERATIONS = {
  2: [{ cols: 'hgyhghyhgh', eat: [1, 2, 4, 6] }, { cols: 'hhhhhhhghh', eat: [] }],
  3: [{ cols: 'hgyhghyhgh', eat: [1, 2, 4, 6] }, { cols: 'hhghhhhghh', eat: [2] }, { cols: 'hhhhhhhhgh', eat: [] }],
};
function selectionPlan(p) {
  const G = Number(p.generations) === 2 ? 2 : 3, w = G === 3 ? 480 : 560, h = G === 3 ? 440 : 430, gap = G === 3 ? 120 : 220, x0 = (1920 - (G * w + (G - 1) * gap)) / 2, y0 = 485 - h / 2;
  const scale = G === 3 ? 1.15 : 1.2; // the beetles' size
  const panels = Array.from({ length: G }, (_, i) => ({ x: x0 + i * (w + gap), y: y0, w, h }));
  const spot = (i, j) => { const P = panels[i], [u, v, a] = SPOTS[j]; return { x: P.x + u * w, y: P.y + v * h, a }; };
  const hover = (i) => [panels[i].x + 0.84 * w, panels[i].y + 0.13 * h];
  // When things happen. Each panel's beetles come in, the bird hunts, and the next panel follows.
  const T = G === 3
    ? { panels: [0, 0.44, 0.69], born: [0.02, 0.46, 0.71], bird: 0.13, hunts: [[0.17, 0.39], [0.56, 0.64]], moves: [[0.52, 0.56], [0.79, 0.85]], survivors: 0.4, arrows: [0.42, 0.67] }
    : { panels: [0, 0.5], born: [0.02, 0.52], bird: 0.13, hunts: [[0.18, 0.42]], moves: [[0.62, 0.68]], survivors: 0.44, arrows: [0.48] };
  // The bird's way as moments and places: from its perch over the first panel to each beetle it catches and back up,
  // over to the next panel, and so on. It lands with its beak on the beetle, from the side it comes from.
  const keys = [[T.bird, hover(0)]], eaten = {};
  GENERATIONS[G].forEach((gen, i) => {
    const hunt = T.hunts[i];
    if (hunt && gen.eat.length) {
      const d = (hunt[1] - hunt[0]) / (gen.eat.length + 0.7);
      let prev = hover(i);
      gen.eat.forEach((j, n) => {
        const b = spot(i, j), side = b.x >= prev[0] ? 1 : -1, at = [b.x - side * 54 * scale, b.y - 24 * scale], when = hunt[0] + (n + 1) * d;
        keys.push([when - 0.35 * d, prev], [when, at]);
        eaten[i + ':' + j] = when;
        prev = at;
      });
      keys.push([hunt[1], hover(i)]);
    }
    const move = T.moves[i];
    if (move && i + 1 < G) keys.push([move[0], hover(i)], [move[1], hover(i + 1)]);
  });
  return { G, w, h, scale, panels, spot, hover, T, keys, eaten };
}
// Where the bird is at progress P: between two of its moments it hops along a low arc. It faces the way it goes, and
// while it waits it keeps facing the way it last went (worked out from its way, so every moment looks the same however
// the frames are drawn).
function birdAt(plan, P) {
  const K = plan.keys;
  let face = -1;
  if (P <= K[0][0]) return { x: K[0][1][0], y: K[0][1][1], face, moving: false };
  for (let i = 1; i < K.length; i++) {
    const [p0, a] = K[i - 1], [p1, b] = K[i], dx = b[0] - a[0], moving = Math.abs(dx) > 1 || Math.abs(b[1] - a[1]) > 1;
    if (Math.abs(dx) > 1) face = dx > 0 ? 1 : -1;
    if (P <= p1) {
      const e = smooth(span(P, p0, p1)), hop = Math.min(60, Math.hypot(dx, b[1] - a[1]) * 0.25);
      return { x: a[0] + dx * e, y: a[1] + (b[1] - a[1]) * e - hop * 4 * e * (1 - e), face, moving: moving && P > p0 };
    }
  }
  const last = K[K.length - 1][1];
  return { x: last[0], y: last[1], face, moving: false };
}
// A beetle round 0 0, head up.
function beetle(kind) {
  const [fill, dark] = BEETLES[kind] || BEETLES.h;
  return `<path d="M-14 -8L-30 -18M14 -8L30 -18M-16 4L-33 6M16 4L33 6M-14 16L-28 29M14 16L28 29M-5 -36L-13 -50M5 -36L13 -50" stroke="${dark}" stroke-width="4" stroke-linecap="round"/>` +
    `<circle cx="0" cy="-30" r="10" fill="${dark}"/><ellipse cx="0" cy="4" rx="20" ry="26" fill="${fill}" stroke="${dark}" stroke-width="2.5"/><path d="M0 -20V29" stroke="${dark}" stroke-width="2.5"/>`;
}
// The bird, side on, facing right round 0 0; its wing turns in render.
function birdShape(th, id) {
  const c = th.accent;
  return `<path d="M-28 -4L-62 -20L-58 8Z" fill="${c}" stroke="${th.bg}" stroke-width="3" stroke-linejoin="round"/><ellipse cx="0" cy="0" rx="36" ry="22" fill="${c}"/><circle cx="30" cy="-14" r="17" fill="${c}"/>` +
    `<path d="M44 -20L66 -12L44 -5Z" fill="${th.ink}" stroke="${th.bg}" stroke-width="2" stroke-linejoin="round"/><circle cx="35" cy="-18" r="4" fill="${th.bg}"/>` +
    `<path id="${id}wing" d="M-8 -8C6 -48 34 -54 42 -46C28 -26 14 -10 -8 -8Z" fill="${c}" stroke="${th.bg}" stroke-width="3" stroke-linejoin="round"/>`;
}

register('natural_selection', {
  cat: CAT, title: 'Natural selection',
  desc: 'Beetles on tree bark in three colors. A bird picks off the green and yellow ones that stand out, while the brown ones are hidden and survive; the survivors have young, and each new generation is mostly brown. The generations are panels side by side, joined by arrows, with no numbers.',
  use: 'Natural selection and evolution: variation in a population, predators, survival of the best hidden, and how a population changes over generations.',
  params: 'labels: {population, variation, predator, survivors, offspring} (each optional, 1 to 3 words from the narration; a part without a label is drawn without one), generations (optional, 2 or 3, default 3)',
  example: { labels: { population: 'Population', variation: 'Variation', predator: 'Predator', survivors: 'Survivors', offspring: 'Offspring' }, generations: 3 },
  build(p, c) {
    const { U, th } = c, id = c.id, L = labelsOf(p), S = selectionPlan(p), T = S.T;
    let o = '';
    S.panels.forEach((P, i) => {
      // The panel: a piece of bark.
      let streaks = '';
      for (let k = 0; k < 7; k++) { const x = P.x + ((k + 0.5) * P.w) / 7 + ((k * 37) % 23) - 11; streaks += `<path d="M${f1(x)} ${P.y + 18}C${f1(x + 10)} ${f1(P.y + P.h * 0.35)} ${f1(x - 12)} ${f1(P.y + P.h * 0.6)} ${f1(x + 4)} ${P.y + P.h - 18}" fill="none" stroke="${BARK_LINE}" stroke-width="6" stroke-linecap="round"/>`; }
      // The panels still to come wait as dashed outlines, so the steps ahead show from the start.
      if (i) o += `<rect x="${P.x + 2}" y="${P.y + 2}" width="${P.w - 4}" height="${P.h - 4}" rx="18" fill="none" stroke="${th.muted}" stroke-width="3" stroke-dasharray="16 12" opacity="0"${U.A('fade', 0.02, 0.05)}/>`;
      o += `<g opacity="0"${U.A('fade', T.panels[i], 0.05)}><rect x="${P.x}" y="${P.y}" width="${P.w}" height="${P.h}" rx="18" fill="${BARK}"${edge(th)}/>${streaks}</g>`;
      // The beetles of this generation, each coming in on its own.
      const gen = GENERATIONS[S.G][i];
      SPOTS.forEach((_, j) => {
        const b = S.spot(i, j);
        o += `<g${U.A('pop', T.born[i] + j * 0.007, 0.04, { cx: f1(b.x), cy: f1(b.y) })}><g id="${id}b${i}_${j}"><g transform="translate(${f1(b.x)} ${f1(b.y)}) rotate(${b.a}) scale(${S.scale})">${beetle(gen.cols[j])}</g></g></g>`;
      });
      // The arrow on to the next generation.
      if (i + 1 < S.G) {
        const ax = P.x + P.w + 22, bx2 = S.panels[i + 1].x - 22, ay = P.y + P.h / 2, len = bx2 - ax;
        o += `<g transform="translate(${ax} ${ay})"><g${U.A('grow', T.arrows[i], 0.06, { ax: 'x', cx: 0, cy: 0 })}><path d="M0 -14H${len - 34}V-30L${len} 0L${len - 34} 30V14H0Z" fill="${th.muted}"/></g></g>`;
      }
    });
    // Rings round the beetles that survived the first hunt.
    const first = GENERATIONS[S.G][0];
    if (say(L.survivors)) SPOTS.forEach((_, j) => { if (!first.eat.includes(j)) { const b = S.spot(0, j); o += `<circle cx="${f1(b.x)}" cy="${f1(b.y)}" r="${f1(46 * S.scale)}" fill="none" stroke="${th.paper}" stroke-width="5" opacity="0"${U.A('fade', T.survivors, 0.05)}/>`; } });
    // The bird.
    const h0 = S.hover(0);
    // It pops in round its own middle, so the pop moves with it (TemplateScene measures a popping part a little bigger
    // round the point it pops from).
    o += `<g id="${id}bird" transform="translate(${f1(h0[0])} ${f1(h0[1])})"><g${U.A('pop', T.bird, 0.05, { cx: 0, cy: 0 })}><g id="${id}face"><g transform="scale(${S.scale})">${birdShape(th, id)}</g></g></g></g>`;
    // The names: the population and the predator over the first panel, its variation and the survivors under it, and
    // the offspring over the second. The predator's name goes when the bird flies on from the first panel.
    const P0 = S.panels[0], P1 = S.panels[1], half = P0.w / 2 - 16, leaves = T.moves[0][0];
    o += nameText(U, th, L.population, P0.x + P0.w * 0.27, P0.y - 4, 'top', 0.05, { w: half }) +
      (say(L.predator) ? `<g${U.A('dim', leaves, 0.04, { to: 0 })}>${nameText(U, th, L.predator, P0.x + P0.w * 0.78, P0.y - 4, 'top', T.bird + 0.02, { w: half })}</g>` : '') +
      nameText(U, th, L.variation, P0.x + P0.w * 0.27, P0.y + P0.h + 4, 'bottom', 0.11, { w: half }) +
      nameText(U, th, L.survivors, P0.x + P0.w * 0.75, P0.y + P0.h + 4, 'bottom', T.survivors, { w: half }) +
      nameText(U, th, L.offspring, P1.x + P1.w / 2, P1.y - 4, 'top', T.born[1] + 0.02, { w: P1.w - 40 });
    return o;
  },
  init(g, p, c) {
    const q = (s) => g.querySelector('#' + c.id + s), S = selectionPlan(p);
    const eaten = Object.entries(S.eaten).map(([key, when]) => { const [i, j] = key.split(':').map(Number), b = S.spot(i, j); return { el: q(`b${i}_${j}`), when, x: b.x, y: b.y }; });
    return { S, bird: q('bird'), face: q('face'), wing: q('wing'), eaten };
  },
  render(l, st) {
    const P = l.p, S = st.S, b = birdAt(S, P);
    // The bird keeps flapping, faster while it flies.
    const flap = Math.sin(l.t * (b.moving ? 22 : 9)) * (b.moving ? 26 : 14);
    st.bird?.setAttribute('transform', `translate(${f1(b.x)} ${f1(b.y)})`);
    st.face?.setAttribute('transform', `scale(${b.face} 1)`);
    st.wing?.setAttribute('transform', `rotate(${f1(flap)} -6 -8)`);
    // A caught beetle is gone the moment the bird reaches it.
    st.eaten.forEach((e) => {
      if (!e.el) return;
      const k = 1 - smooth(span(P, e.when - 0.004, e.when + 0.012));
      e.el.setAttribute('transform', `translate(${f1(e.x)} ${f1(e.y)}) scale(${Math.max(0.001, k).toFixed(3)}) translate(${f1(-e.x)} ${f1(-e.y)})`);
      e.el.setAttribute('opacity', k > 0.01 ? '1' : '0');
    });
  },
});

/* ---------------------------------------------------------------------------------------------------------------
 * food_chain: the sun shines on a plant, and energy passes up a food chain of 3 to 5 links, each an icon in a disc with
 * its name under it, joined by arrows from what is eaten to what eats it. Pulses of energy run from the sun along the
 * chain to its top, and each link lights up as one reaches it.
 * ------------------------------------------------------------------------------------------------------------- */
function chainPlan(p) {
  const items = (Array.isArray(p.chain) ? p.chain : []).slice(0, 5).map((it) => (typeof it === 'string' ? { icon: '', label: say(it) } : { icon: say(it && it.icon).toLowerCase(), label: say(it && it.label) }));
  const N = items.length, spacing = [0, 0, 460, 400, 320, 275][N], r = [100, 100, 100, 96, 86, 76][N], sunGap = 330, width = sunGap + Math.max(0, N - 1) * spacing;
  // The sun on the left, the links rising to the right, the whole centered.
  const sx = 960 - (width + 50) / 2, sun = [sx, 262];
  const links = items.map((it, i) => ({ ...it, x: sx + sunGap + i * spacing, y: N > 1 ? 610 - (230 * i) / (N - 1) : 600 }));
  // When each link comes in: as the narration says it (times from TemplateScene), or spread over the first half.
  const given = Array.isArray(p.times) && p.times.length >= N ? p.times.slice(0, N).map(Number) : null;
  const at = links.map((_, i) => (given && given.every(Number.isFinite) ? clamp(given[i], 0.1, 0.9) : 0.14 + (N > 1 ? (0.42 * i) / (N - 1) : 0)));
  for (let i = 1; i < N; i++) at[i] = Math.max(at[i], at[i - 1] + 0.05);
  const first = at[0] ?? 0.14, sunAt = Math.max(0, first - 0.12);
  // The ways energy runs: the sun's light onto the first link, then each arrow, from edge to edge of the discs.
  const edgeTo = (a, b, ra, rb) => { const d = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / d, uy = (b[1] - a[1]) / d; return [[a[0] + ux * ra, a[1] + uy * ra], [b[0] - ux * rb, b[1] - uy * rb]]; };
  const legs = links.map((L, i) => (i === 0 ? edgeTo(sun, [L.x, L.y], 108, r + 14) : edgeTo([links[i - 1].x, links[i - 1].y], [L.x, L.y], r + 12, r + 14)));
  return { items, N, r, spacing, sun, links, at, sunAt, legs, relay: (at[N - 1] ?? first) + 0.08 };
}

register('food_chain', {
  cat: CAT, title: 'Food chain',
  desc: 'The sun shines on a plant, and energy passes up a food chain of 3 to 5 links, each an icon in a disc with its name under it, joined by arrows from what is eaten to what eats it. The links come in one by one from the plant up; then pulses of energy run from the sun along the chain to its top, and each link lights up as one reaches it.',
  use: 'Food chains and food webs, producers and consumers, predators and prey, and how energy from the sun passes from one living thing to the next.',
  params: 'chain: [3 to 5 links from the producer up, each {icon, label}; icon a name from the app\'s icons, label 1 to 3 words from the narration], labels: {sun, energy} (each optional), energyLoss (optional true or false, default false: the arrows get thinner up the chain, only when the narration says energy is lost at each step), times (optional: when each link comes in, fractions of the scene)',
  example: { chain: [{ icon: 'grass', label: 'Grass' }, { icon: 'rabbit', label: 'Rabbit' }, { icon: 'fox', label: 'Fox' }], labels: { sun: 'Sun', energy: 'Energy' } },
  build(p, c) {
    const { U, th } = c, id = c.id, L = labelsOf(p), C = chainPlan(p), [sx, sy] = C.sun;
    let o = '';
    // The sun, its rays turning slowly (see render).
    o += `<g${U.A('pop', C.sunAt, 0.06, { cx: sx, cy: sy })}><circle cx="${sx}" cy="${sy}" r="56" fill="${SUN}"/><path id="${id}rays" d="${sunRays(sx, sy, 0)}" stroke="${SUN}" stroke-width="9" stroke-linecap="round"/></g>`;
    // Sunlight falling on the first link: three parallel dashed rays that keep moving, each from the sun's edge to
    // where it meets the link's disc.
    if (C.N) {
      const P0 = C.links[0], a0 = C.at[0], dx = P0.x - sx, dy = P0.y - sy, dl = Math.hypot(dx, dy), ux = dx / dl, uy = dy / dl, R = C.r + 14;
      [-30, 0, 30].forEach((off, k) => {
        const ox = -uy * off, oy = ux * off, from = [sx + ux * 104 + ox, sy + uy * 104 + oy];
        // Where the ray meets the circle round the link: solve |from + s u - P0| = R for the nearer s.
        const fx = from[0] - P0.x, fy = from[1] - P0.y, b = fx * ux + fy * uy, s0 = -b - Math.sqrt(Math.max(0, b * b - (fx * fx + fy * fy - R * R))), to = [from[0] + ux * s0, from[1] + uy * s0];
        o += `<g opacity="0"${U.A('fade', a0 - 0.08 + k * 0.012, 0.04)}><path id="${id}lt${k}" d="M${f1(from[0])} ${f1(from[1])}L${f1(to[0])} ${f1(to[1])}" stroke="${SUN}" stroke-width="7" stroke-dasharray="26 16" stroke-linecap="round"/>${head(from, to, SUN, 22)}</g>`;
      });
    }
    // The arrows of energy from each link to the next, drawn just before the next link comes in.
    C.links.forEach((lk, i) => {
      if (!i) return;
      const [a, b] = C.legs[i], w = p.energyLoss === true ? 22 - ((i - 1) * 12) / Math.max(1, C.N - 2) : 18, hs = 18 + w;
      const d = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / d, uy = (b[1] - a[1]) / d, shaftEnd = [b[0] - ux * hs * 0.8, b[1] - uy * hs * 0.8];
      o += drawn(U, `M${f1(a[0])} ${f1(a[1])}L${f1(shaftEnd[0])} ${f1(shaftEnd[1])}`, th.accent, w, C.at[i] - 0.07, 0.05) +
        `<g opacity="0"${U.A('fade', C.at[i] - 0.025, 0.02)}>${head(a, b, th.accent, hs)}</g>`;
    });
    // The links: a disc with the icon, a ring that lights up as energy reaches it, and the name under it.
    C.links.forEach((lk, i) => {
      o += `<circle id="${id}ring${i}" cx="${f1(lk.x)}" cy="${f1(lk.y)}" r="${C.r + 9}" fill="none" stroke="${th.accent}" stroke-width="7" opacity="0"/>` +
        `<g${U.A('pop', C.at[i], 0.06, { cx: f1(lk.x), cy: f1(lk.y) })}><circle cx="${f1(lk.x)}" cy="${f1(lk.y)}" r="${C.r}" fill="${th.surface}" stroke="${th.card ? th.card.stroke : th.line}" stroke-width="${th.card ? th.card.width : 3}"/>` +
        (lk.icon ? U.icon(lk.icon, lk.x, lk.y, C.r * 1.25, i === 0 ? PLANT : th.ink) : '') + '</g>' +
        nameText(U, th, lk.label, lk.x, lk.y + C.r + 4, 'bottom', C.at[i] + 0.03, { w: C.N > 1 ? Math.min(300, C.spacing - 24) : 320 });
    });
    // The pulse of energy that runs along the chain (see render).
    o += `<circle id="${id}pulse" r="15" fill="${th.accent}" stroke="${th.bg}" stroke-width="5" opacity="0"/>`;
    // The names of the sun and of the energy, the energy's over the first arrow.
    o += nameText(U, th, L.sun, sx - 24, sy + 102, 'bottom', C.sunAt + 0.04, { w: 210 });
    if (C.N > 1 && say(L.energy)) {
      const [a, b] = C.legs[1], m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], top = Math.min(C.links[0].y, C.links[1].y) - C.r - 26;
      o += `<g opacity="0"${U.A('fade', C.at[1], 0.04)}><path d="M${f1(m[0])} ${f1(m[1] - 14)}L${f1(m[0])} ${f1(top + 2)}" stroke="${th.ink}" stroke-width="3" stroke-dasharray="6 7" stroke-linecap="round"/></g>` +
        nameText(U, th, L.energy, m[0], top, 'top', C.at[1] + 0.01, { w: Math.min(300, C.spacing + 40), f: th.accent });
    }
    return o;
  },
  init(g, p, c) {
    const q = (s) => g.querySelector('#' + c.id + s), C = chainPlan(p);
    return { C, rays: q('rays'), light: [0, 1, 2].map((k) => q('lt' + k)), rings: C.links.map((_, i) => q('ring' + i)), pulse: q('pulse') };
  },
  render(l, st) {
    const C = st.C, t = l.t, [sx, sy] = C.sun;
    st.rays?.setAttribute('d', sunRays(sx, sy, (t * 6 * Math.PI) / 180));
    st.light.forEach((el) => el?.setAttribute('stroke-dashoffset', f1(-(t * 70) % 42)));
    // Once the whole chain is there, pulses run from the sun up the chain, one leg after another, and each link's ring
    // flashes as a pulse reaches it.
    const t0 = C.relay * l.dur, leg = 0.45, period = C.N * leg + 0.6;
    let pulse = null;
    const flash = C.links.map(() => 0);
    if (C.N && t >= t0) {
      const u = (t - t0) % period, k = Math.floor(u / leg);
      if (k < C.N) { const f = smooth((u - k * leg) / leg), [a, b] = C.legs[k]; pulse = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]; }
      C.links.forEach((_, i) => {
        // How long ago a pulse reached this link: in this round, or in the one before.
        const since = u - (i + 1) * leg, ago = since >= 0 ? since : t - t0 >= period ? since + period : -1;
        if (ago >= 0) flash[i] = Math.max(0, 1 - ago / 0.5);
      });
    }
    st.pulse?.setAttribute('opacity', pulse ? '1' : '0');
    if (pulse) { st.pulse.setAttribute('cx', f1(pulse[0])); st.pulse.setAttribute('cy', f1(pulse[1])); }
    st.rings.forEach((el, i) => el?.setAttribute('opacity', flash[i].toFixed(3)));
  },
});

// The sun's twelve rays round (sx, sy), turned by `turn` radians. The path itself turns (not a transform), so the
// measured size of the drawing stays its true size.
function sunRays(sx, sy, turn) {
  let d = '';
  for (let k = 0; k < 12; k++) { const a = (Math.PI / 6) * k + turn; d += `M${f1(sx + 72 * Math.cos(a))} ${f1(sy + 72 * Math.sin(a))}L${f1(sx + 96 * Math.cos(a))} ${f1(sy + 96 * Math.sin(a))}`; }
  return d;
}
// An arrowhead at `to`, pointing away from `from`.
function head(from, to, col, size) {
  const a = Math.atan2(to[1] - from[1], to[0] - from[0]), [x, y] = to;
  return `<path d="M${f1(x + Math.cos(a) * 4)} ${f1(y + Math.sin(a) * 4)}L${f1(x - size * Math.cos(a) + size * 0.6 * Math.sin(a))} ${f1(y - size * Math.sin(a) - size * 0.6 * Math.cos(a))}L${f1(x - size * Math.cos(a) - size * 0.6 * Math.sin(a))} ${f1(y - size * Math.sin(a) + size * 0.6 * Math.cos(a))}Z" fill="${col}"/>`;
}
