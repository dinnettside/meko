// Animated diagrams of how things work (body), drawn for Meko in the film engine's style. See ../engine.js for how
// templates work. Every visible word comes from the params; a part without a label in the params is drawn unlabeled.
// The drawings take the look's colors for the ground, organs, lines and text. Things with a natural color keep it in
// every look, so they read the same on dark and light grounds: the colors below.
import { register } from "../engine.js";

const CD = 'Diagrams';
const BLOOD_RED = '#E0453F'; // blood with oxygen
const BLOOD_BLUE = '#7467D4'; // blood without oxygen, a muted blue-purple
const WHITE = '#FFFFFF'; // text and arrows drawn on the blood colors
const LUNG = '#E8848F'; // lungs
const AIRWAY = '#C25563'; // the windpipe and the airways inside the lungs
const MUSCLE = '#B9434F'; // the diaphragm
const LEAF = '#3F9F4E'; // a leaf
const LEAF_DARK = '#2C7A3A'; // a leaf's stem
const VEIN = '#8FD08A'; // a leaf's veins
const SUN = '#F5A623'; // the sun and its light
const WATER = '#3B8FE6'; // water
const OXYGEN_ATOM = '#E2574C'; // the oxygen atoms in drawn molecules
const CARBON_ATOM = '#454B55'; // the carbon atom in a drawn molecule
const SUGAR = '#FFE6A0'; // sugar
const SUGAR_EDGE = '#B7861C';
const GERM = '#9CC53B'; // germs
const GERM_DARK = '#5F8A1E';
const WHITE_CELL = '#EEEFFC'; // a white blood cell
const WHITE_CELL_CORE = '#8F7BCB'; // its nucleus

// The text of a label in the params, or '' when it is not given.
const said = (labels, key) => (labels && typeof labels[key] === 'string' ? labels[key].trim() : '');
// Organs are flat shapes in the look's panel color. The outlined looks (Blueprint, Field guide) draw them with an ink
// edge, Night atlas with a quieter one.
const edgeOf = (th) => (th.card ? th.ink : th.muted);

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
// A measured line: its points, the distance to each point along it and its length.
function track(pts) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { pts, cum, len: cum[cum.length - 1] };
}
// The point at distance s along a measured line, with the direction of the line there in degrees.
function pointAt(tr, s) {
  const d = Math.max(0, Math.min(tr.len, s));
  let i = 1;
  while (i < tr.cum.length - 1 && tr.cum[i] < d) i++;
  const [ax, ay] = tr.pts[i - 1], [bx, by] = tr.pts[i], seg = tr.cum[i] - tr.cum[i - 1] || 1, u = (d - tr.cum[i - 1]) / seg;
  return { x: ax + (bx - ax) * u, y: ay + (by - ay) * u, a: (Math.atan2(by - ay, bx - ax) * 180) / Math.PI };
}
const pathOf = (pts) => 'M' + pts.map((q) => q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join('L');
// A smooth bump from 0 up to 1 and back over the part [a, b] of a cycle, 0 elsewhere.
const bump = (f, a, b) => (f < a || f > b ? 0 : Math.pow(Math.sin((Math.PI * (f - a)) / (b - a)), 2));
// How far a heartbeat has pushed the blood after `beats` beats: a surge while the heart squeezes, then a pause.
const surge = (beats) => { const f = beats - Math.floor(beats); return Math.floor(beats) + (f < 0.3 ? (1 - Math.cos((Math.PI * f) / 0.3)) / 2 : 1); };
// A small arrowhead pointing along +x, drawn around 0,0, for things that move along a line.
const chevron = (id, col, size = 1, ex = '') => `<path id="${id}" d="M${-8 * size} ${-10 * size}L${6 * size} 0L${-8 * size} ${10 * size}" fill="none" stroke="${col}" stroke-width="${(5 * size).toFixed(1)}" stroke-linecap="round" stroke-linejoin="round" opacity="0"${ex}/>`;
// Words that fit inside a shape `w` wide: wrapped lines and a font size of at least 30 px.
function fitLines(U, text, w, size = 32, maxLines = 3) {
  for (let s = size; s >= 30; s -= 2) {
    const lines = wrapTo(U, text, w, s);
    if (lines.length <= maxLines && lines.every((l) => U.tw(l, s, { w: 700 }) <= w)) return { lines, s };
  }
  return { lines: wrapTo(U, text, w, 30), s: 30 };
}
function wrapTo(U, text, w, s) {
  const out = [];
  let line = '';
  for (const word of String(text).split(/\s+/).filter(Boolean)) {
    const next = line ? line + ' ' + word : word;
    if (line && U.tw(next, s, { w: 700 }) > w) { out.push(line); line = word; } else line = next;
  }
  if (line) out.push(line);
  return out;
}
// A label wrapped to at most `w` px and `max` lines (30 px or larger), anchored at x like U.T. y is where the
// baseline of a one-line label goes; more lines spread around it, or stack upward from it when `up` is set.
function label(U, x, y, text, o = {}) {
  const fit = fitLines(U, text, o.w || 360, o.s || 34, o.max || 2), n = fit.lines.length, lh = fit.s * 1.12;
  return fit.lines.map((l, i) => U.T(x, (y + (o.up ? i - (n - 1) : i - (n - 1) / 2) * lh).toFixed(1), l, { a: o.a || 'middle', s: fit.s, w: o.weight || 700, f: o.f })).join('');
}
// Lines of text centered on x, with the block's middle at y.
const block = (U, x, y, fit, o) => fit.lines.map((l, i) => U.T(x, (y + (i - (fit.lines.length - 1) / 2) * fit.s * 1.12 + fit.s * 0.35).toFixed(1), l, Object.assign({ s: fit.s, w: 700 }, o))).join('');

/* ---------------------------------------------------------------------------------------------------------------
 * heart_pump: the heart from the front with its four chambers. Blood without oxygen comes back from the body into the
 * right atrium, goes down into the right ventricle and is pumped up to the lungs; blood with oxygen comes back from
 * the lungs into the left atrium, goes down into the left ventricle and is pumped out to the body. As in any drawing
 * of the heart from the front, its right side is on the viewer's left.
 * ------------------------------------------------------------------------------------------------------------- */
const HEART = {
  sx: 965, // the septum between the right and the left side
  top: 342, // the top of the heart, where the blood vessels join it
  av: 520, // the line between the atria and the ventricles
  outline: 'M838 342L1110 342C1166 342 1202 384 1202 444C1204 566 1136 652 1034 708C1008 724 982 724 958 712C850 670 742 610 744 488C736 418 768 342 838 342Z',
};
// The four blood vessels as lines in the direction the blood flows, with the moment (fraction of the scene) each is
// drawn. The vena cava comes up from the body into the right atrium, the pulmonary artery goes from the right
// ventricle to the lungs, the pulmonary vein from the lungs to the left atrium and the aorta from the left ventricle
// to the body.
const VESSELS = [
  { key: 'vein', col: BLOOD_BLUE, pts: [[952, 806], [560, 806], [560, 284], [824, 284], [824, 400]], at: 0.12, d: 0.12 },
  { key: 'lungArtery', col: BLOOD_BLUE, pts: [[927, 400], [927, 226]], at: 0.3, d: 0.07 },
  { key: 'lungVein', col: BLOOD_RED, pts: [[1003, 226], [1003, 400]], at: 0.42, d: 0.07 },
  { key: 'aorta', col: BLOOD_RED, pts: [[1154, 400], [1154, 284], [1372, 284], [1372, 806], [978, 806]], at: 0.56, d: 0.13 },
];
// The chamber names: label key, middle x and y, room across, and when the name comes in. The ventricles narrow toward
// the bottom, so their names sit in their wide top part, measured from the heart's inner edge.
const CHAMBERS = [['rightAtrium', 832, 424, 104, 0.22], ['rightVentricle', 884, 582, 140, 0.27], ['leftAtrium', 1042, 424, 120, 0.48], ['leftVentricle', 1056, 582, 146, 0.53]];
const vesselTracks = () => VESSELS.map((v) => track(rounded(v.pts, 70)));

register('heart_pump', {
  cat: CD, title: 'How the heart pumps',
  desc: 'The heart from the front with its four chambers, beating. Blood without oxygen (blue-purple) comes back from the body into the right atrium, goes down into the right ventricle and is pumped to the lungs; blood with oxygen (red) comes back from the lungs into the left atrium, goes down into the left ventricle and is pumped out to the body. Arrows move along the vessels. The heart’s right side is on the viewer’s left, as in every front view.',
  use: 'How the heart works, blood circulation, the two sides of the heart, the pulse.',
  params: 'labels: {rightAtrium, rightVentricle, leftAtrium, leftVentricle, lungs, body, withOxygen, withoutOxygen, beat} (all optional; a part without a label is drawn without one), bpm (optional, sets only how fast it beats; no number is shown)',
  example: { labels: { rightAtrium: 'Right atrium', rightVentricle: 'Right ventricle', leftAtrium: 'Left atrium', leftVentricle: 'Left ventricle', lungs: 'Lungs', body: 'Body', withoutOxygen: 'Blood without oxygen', withOxygen: 'Blood with oxygen' }, bpm: 60 },
  build(p, c) {
    const { U, th } = c, id = c.id, L = p.labels || {}, edge = edgeOf(th), { sx, av } = HEART;
    const tracks = vesselTracks();
    let o = U.bg();
    // The vessels go behind the heart, the lungs and the body, which hide their ends. Each is drawn in the order the
    // blood flows through it, and arrows then move along it.
    VESSELS.forEach((v, k) => {
      const tr = tracks[k], len = tr.len.toFixed(0);
      o += `<g opacity="0"${U.A('fade', v.at, 0.005)}><path d="${pathOf(tr.pts)}" fill="none" stroke="${v.col}" stroke-width="30" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${len}" stroke-dashoffset="${len}"${U.A('draw', v.at, v.d, { l: len })}/></g>`;
      const n = Math.floor(tr.len / 82);
      for (let i = 0; i < n; i++) o += chevron(`${id}v${k}_${i}`, WHITE, 0.9);
    });
    // The lungs, at the top: two lobes and the windpipe.
    const lx = 965;
    o += `<g${U.A('pop', 0.29, 0.06, { cx: lx, cy: 215 })}>${lungShape(lx - 60, 220, 112, 116, -1, th.surface, edge)}${lungShape(lx + 60, 220, 112, 116, 1, th.surface, edge)}<path d="M${lx} 160V194M${lx} 194L${lx - 28} 218M${lx} 194L${lx + 28} 218" fill="none" stroke="${edge}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></g>`;
    // The body, at the bottom.
    o += `<g${U.A('pop', 0.08, 0.06, { cx: 965, cy: 782 })}>${U.icon('person', 965, 778, 104, th.muted)}</g>`;
    // The heart: its wall, and inside it the chambers. The right side's atrium and ventricle hold blood without
    // oxygen, the left side's blood with oxygen. Each ventricle reaches up to the top, where its artery leaves.
    const inner = `<clipPath id="${id}in"><path d="${HEART.outline}" transform="translate(972 524) scale(0.9) translate(-972 -524)"/></clipPath>`;
    // Each side is one shape: the atrium on top, a narrow valve below it, the ventricle at the bottom and the
    // ventricle's way up to its artery. The heart's inner edge trims the outer sides.
    const right = `<path d="M700 300H873Q887 300 887 314V478Q887 504 862 506Q852 508 852 518V528Q852 538 862 538H901V300H957V900H700V552Q700 538 714 538H786Q796 538 796 528V518Q796 508 786 506L700 504Z"/>`;
    const left = `<path d="M987 300H1098Q1112 300 1112 314V478Q1112 504 1088 506Q1080 508 1080 518V528Q1080 538 1090 538H1126V300H1400V900H973V552Q973 538 987 538H1014Q1024 538 1024 528V518Q1024 508 1014 506L987 504Q973 504 973 490V314Q973 300 987 300Z"/>`;
    o += `<g${U.A('pop', 0.02, 0.07, { cx: sx, cy: 540 })}><g id="${id}heart"><defs>${inner}</defs>` +
      `<path d="${HEART.outline}" fill="${th.surface}" stroke="${edge}" stroke-width="4" stroke-linejoin="round"/>` +
      `<g clip-path="url(#${id}in)"><g fill="${BLOOD_BLUE}" opacity="0"${U.A('fade', 0.06, 0.06)}>${right}</g><g fill="${BLOOD_RED}" opacity="0"${U.A('fade', 0.06, 0.06)}>${left}</g></g>`;
    // Arrows through the valves, from each atrium down into its ventricle.
    o += chevron(`${id}rv`, WHITE, 1.1, ` data-x="824" data-y0="${av - 44}" data-y1="${av + 22}"`) + chevron(`${id}lv`, WHITE, 1.1, ` data-x="1052" data-y0="${av - 44}" data-y1="${av + 22}"`);
    o += '</g></g>';
    // The chamber names, inside the chambers. They follow the beat without being squeezed.
    CHAMBERS.forEach(([key, x, y, w, at], k) => { const t = said(L, key); if (t) o += `<g opacity="0"${U.A('fade', at, 0.05)}><g id="${id}cl${k}">${block(U, x, y, fitLines(U, t, w), { f: WHITE })}</g></g>`; });
    // Where the blood goes: the lungs and the body.
    const lungs = said(L, 'lungs'), body = said(L, 'body');
    if (lungs) o += `<g opacity="0"${U.A('fade', 0.33, 0.05)}>${label(U, lx + 142, 232, lungs, { a: 'start', w: 420 })}</g>`;
    if (body) o += `<g opacity="0"${U.A('fade', 0.1, 0.05)}>${label(U, 1016, 780, body, { a: 'start', w: 320, up: true })}</g>`;
    // The key to the two colors of blood, at the side.
    const key = [[said(L, 'withoutOxygen'), BLOOD_BLUE], [said(L, 'withOxygen'), BLOOD_RED]].filter((k) => k[0]);
    key.forEach(([t, col], k) => { const y = 500 + (k - (key.length - 1) / 2) * 84; o += `<g opacity="0"${U.A('fade', 0.72 + k * 0.04, 0.05)}><path d="M${470 - 26} ${y}H${470 + 26}" stroke="${col}" stroke-width="30" stroke-linecap="round"/>${label(U, 410, y + 11, t, { a: 'end', w: 360, s: 32, weight: 600 })}</g>`; });
    const beat = said(L, 'beat');
    if (beat) o += fitBeside(U, th, beat, 1430, 545, 0.76);
    return o;
  },
  init(g, p, c) {
    const q = (s) => g.querySelector('#' + c.id + s), tracks = vesselTracks();
    return { heart: q('heart'), names: CHAMBERS.map((_, k) => q('cl' + k)), tracks, ch: tracks.map((tr, k) => Array.from({ length: Math.floor(tr.len / 82) }, (_, i) => q(`v${k}_${i}`))), rv: q('rv'), lv: q('lv') };
  },
  render(l, st, p, c) {
    const { U } = c, bpm = Math.max(30, Math.min(150, Number(p.bpm) || 60)), beats = (l.t * bpm) / 60, f = beats - Math.floor(beats);
    // The heart squeezes toward its top, where the vessels hold it: a small squeeze of the atria, then the ventricles.
    const sq = bump(f, 0, 0.3) + 0.35 * bump(f, 0.78, 0.96);
    const kx = 1 - 0.02 * sq, ky = 1 - 0.05 * sq;
    st.heart.setAttribute('transform', `translate(${HEART.sx} ${HEART.top}) scale(${kx.toFixed(4)} ${ky.toFixed(4)}) translate(${-HEART.sx} ${-HEART.top})`);
    st.names.forEach((el, k) => { if (el) el.setAttribute('transform', `translate(${((CHAMBERS[k][1] - HEART.sx) * (kx - 1)).toFixed(1)} ${((CHAMBERS[k][2] - HEART.top) * (ky - 1)).toFixed(1)})`); });
    const flow = 42 * l.t + 58 * surge(beats);
    st.tracks.forEach((tr, k) => {
      const v = VESSELS[k], drawn = U.ease.io(U.prog(l.p, v.at, v.at + v.d)) * tr.len, n = st.ch[k].length, gap = tr.len / n;
      st.ch[k].forEach((el, i) => {
        if (!el) return;
        const s = (i * gap + flow) % tr.len, pt = pointAt(tr, s);
        el.setAttribute('transform', `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)}) rotate(${pt.a.toFixed(1)})`);
        el.setAttribute('opacity', s < drawn - 12 ? '0.9' : '0');
      });
    });
    // Blood falls from each atrium into its ventricle while the ventricles fill, between the squeezes.
    [[st.rv, 0.25], [st.lv, 0.49]].forEach(([el, at]) => {
      if (!el) return;
      const u = (f + 0.7) % 1, x = Number(el.dataset.x), y0 = Number(el.dataset.y0), y1 = Number(el.dataset.y1), y = y0 + (y1 - y0) * u;
      el.setAttribute('transform', `translate(${x} ${y.toFixed(1)}) rotate(90)`);
      el.setAttribute('opacity', l.p > at ? (0.9 * Math.min(1, Math.sin(Math.PI * u) * 2)).toFixed(2) : '0');
    });
  },
});

/* ---------------------------------------------------------------------------------------------------------------
 * lungs_breathing: the chest from the front with the two lungs, the windpipe and the diaphragm under the lungs. On
 * the in-breath the diaphragm pulls down and flattens, the chest rises and widens and the lungs fill; on the
 * out-breath it all goes back. Air moves down the windpipe into the lungs and back out.
 * ------------------------------------------------------------------------------------------------------------- */
const CHEST = {
  torso: 'M914 160L1006 160L1006 214C1020 238 1080 252 1170 262C1270 274 1318 300 1328 350L1338 812L582 812L592 350C602 300 650 274 750 262C840 252 900 238 914 214Z',
  split: [960, 318], // where the windpipe splits in two
  anchor: [[902, 322], [1018, 322]], // the lungs grow from where the airways enter them
};
// The airways the air follows, for the lung on the left of the picture; the other lung's are their mirror image. Each
// runs down the windpipe, through the bronchus and out along one branch inside the lung.
const AIR_BRANCHES = [[[818, 428], [728, 444]], [[832, 472], [792, 566]], [[868, 482], [858, 616]]];
const airTracks = () => {
  const out = [];
  [1, -1].forEach((side) => AIR_BRANCHES.forEach((br) => {
    const m = (q) => [960 + side * (q[0] - 960), q[1]];
    out.push(track(rounded([[960, 186], CHEST.split, m([906, 370]), m([880, 396]), ...br.map(m)], 34)));
  }));
  return out;
};
// How far the in-breath has gone, from 0 (breathed out) to 1 (breathed in), with the phase of the breath.
const breathAt = (t, t0, period) => { if (t < t0) return { b: 0, ph: -1, n: 0 }; const u = (t - t0) / period; return { b: (1 - Math.cos(2 * Math.PI * u)) / 2, ph: u - Math.floor(u), n: Math.floor(u) }; };
const DIAPHRAGM = (b) => { const e = 752 + 13 * b, cy = 646 + 50 * b; return `M615 ${e.toFixed(1)}Q960 ${cy.toFixed(1)} 1305 ${e.toFixed(1)}`; };

register('lungs_breathing', {
  cat: CD, title: 'How we breathe',
  desc: 'The chest from the front with the two lungs, the windpipe and the diaphragm. On each in-breath the diaphragm pulls down and flattens, the chest rises and the lungs fill with air; on the out-breath they go back and the air goes out. With labels for oxygen and carbon dioxide, the air coming in is drawn as oxygen dots and the air going out as carbon dioxide dots.',
  use: 'Breathing, the lungs, the diaphragm, how oxygen gets into the body.',
  params: 'labels: {windpipe, lungs, diaphragm, oxygen, carbonDioxide, breatheIn, breatheOut} (all optional; a part without a label is drawn without one; the oxygen and carbon dioxide dots are drawn only when both their labels are given), breathsPerMinute (optional, sets only how fast it breathes; no number is shown)',
  example: { labels: { windpipe: 'Windpipe', lungs: 'Lungs', diaphragm: 'Diaphragm', oxygen: 'Oxygen in', carbonDioxide: 'Carbon dioxide out', breatheIn: 'Breathe in', breatheOut: 'Breathe out' }, breathsPerMinute: 15 },
  build(p, c) {
    const { U, th } = c, id = c.id, L = p.labels || {}, edge = edgeOf(th), gases = !!(said(L, 'oxygen') && said(L, 'carbonDioxide'));
    const inCol = gases ? th.accent2 : th.ink, outCol = th.ink;
    let o = U.bg();
    // The chest, which rises and widens on the in-breath.
    o += `<g opacity="0"${U.A('fade', 0.0, 0.06)}><g id="${id}torso"><path d="${CHEST.torso}" fill="${th.surface}"${th.card ? ` stroke="${edge}" stroke-width="3" stroke-linejoin="round"` : ''}/></g></g>`;
    // The diaphragm, a dome of muscle under the lungs.
    o += `<g opacity="0"${U.A('fade', 0.14, 0.06)}><path id="${id}dia" d="${DIAPHRAGM(0)}" fill="none" stroke="${MUSCLE}" stroke-width="22" stroke-linecap="round"/></g>`;
    // The lungs, each with its airways inside.
    [-1, 1].forEach((side, k) => {
      const cx = 960 + side * 170, [ax, ay] = CHEST.anchor[k];
      const branches = AIR_BRANCHES.map((br) => { const m = (q) => (side < 0 ? q : [1920 - q[0], q[1]]); const pts = [m([880, 396]), ...br.map(m)]; return `<path d="${pathOf(rounded(pts, 30))}" fill="none" stroke="${AIRWAY}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>`; }).join('');
      o += `<g${U.A('pop', 0.05 + k * 0.03, 0.07, { cx: ax, cy: ay })}><g id="${id}lung${k}">${lungShape(cx, 492, 300, 384, side, LUNG, th.card ? edge : LUNG)}${branches}</g></g>`;
    });
    // The windpipe and the two bronchi.
    const [sx, sy] = CHEST.split;
    o += `<g opacity="0"${U.A('fade', 0.03, 0.06)}><path d="M960 182V${sy}M${sx} ${sy}L906 370L880 396M${sx} ${sy}L1014 370L1040 396" fill="none" stroke="${AIRWAY}" stroke-width="40" stroke-linecap="round" stroke-linejoin="round"/>`;
    for (let y = 196; y < sy - 8; y += 24) o += `<path d="M942 ${y}H978" stroke="${LUNG}" stroke-width="5" stroke-linecap="round" opacity=".55"/>`;
    o += '</g>';
    // The air: dots that stream in on the in-breath and out on the out-breath.
    const n = airTracks().length;
    for (let k = 0; k < n; k++) for (let j = 0; j < 4; j++) o += `<circle id="${id}ai${k}_${j}" r="9" fill="${inCol}" stroke="${th.bg}" stroke-width="2.5" opacity="0"/><circle id="${id}ao${k}_${j}" r="9" fill="${outCol}" stroke="${th.bg}" stroke-width="2.5" opacity="0"/>`;
    // The names of the parts, on the left, with lines to them.
    const part = (key, tx, ty, px, py, at) => { const t = said(L, key); return t ? `<g opacity="0"${U.A('fade', at, 0.05)}><path d="M${tx + 14} ${ty - 11}L${px} ${py}" stroke="${th.muted}" stroke-width="3"/><circle cx="${px}" cy="${py}" r="7" fill="${th.ink}"/>${label(U, tx, ty, t, { a: 'end', w: 480 })}</g>` : ''; };
    o += part('windpipe', 880, 214, 952, 214, 0.08) + part('lungs', 556, 470, 690, 470, 0.11) + part('diaphragm', 556, 772, 640, 756, 0.17);
    // The key to the two gases, on the right: oxygen comes in, carbon dioxide goes out.
    if (gases) [[said(L, 'oxygen'), inCol, 1], [said(L, 'carbonDioxide'), outCol, -1]].forEach(([t, col, dir], k) => {
      const y = 450 + k * 96;
      o += `<g opacity="0"${U.A('fade', 0.2 + k * 0.04, 0.05)}><circle cx="1392" cy="${y - 11}" r="13" fill="${col}" stroke="${th.bg}" stroke-width="2.5"/><path d="M1424 ${y - 11 - dir * 14}V${y - 11 + dir * 12}M1416 ${y - 11 + dir * 4}L1424 ${y - 11 + dir * 13}L1432 ${y - 11 + dir * 4}" fill="none" stroke="${th.ink}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>${label(U, 1450, y, t, { a: 'start', w: 400, s: 32, weight: 600 })}</g>`;
    });
    // In and out, shown while each happens.
    const phase = (key, k) => { const t = said(L, key); return t ? `<g id="${id}ph${k}" opacity="0">${label(U, 1040, 214, t, { a: 'start', w: 500, max: 1, f: th.accent })}</g>` : ''; };
    o += phase('breatheIn', 0) + phase('breatheOut', 1);
    return o;
  },
  init(g, p, c) {
    const q = (s) => g.querySelector('#' + c.id + s), tracks = airTracks();
    return { torso: q('torso'), dia: q('dia'), lungs: [q('lung0'), q('lung1')], ph: [q('ph0'), q('ph1')], tracks, ai: tracks.map((_, k) => [0, 1, 2, 3].map((j) => q(`ai${k}_${j}`))), ao: tracks.map((_, k) => [0, 1, 2, 3].map((j) => q(`ao${k}_${j}`))) };
  },
  render(l, st, p) {
    const bpm = Math.max(6, Math.min(40, Number(p.breathsPerMinute) || 15)), period = 60 / bpm, t0 = 0.2 * l.dur;
    const { b, ph, n } = breathAt(l.t, t0, period), inhaling = ph >= 0 && ph < 0.5;
    st.torso?.setAttribute('transform', `translate(0 ${(-7 * b).toFixed(2)}) translate(960 812) scale(${(1 + 0.035 * b).toFixed(4)} 1) translate(-960 -812)`);
    st.dia?.setAttribute('d', DIAPHRAGM(b));
    const k = 1 + 0.08 * b;
    st.lungs.forEach((el, i) => { const [ax, ay] = CHEST.anchor[i]; el?.setAttribute('transform', `translate(${ax} ${ay}) scale(${k.toFixed(4)}) translate(${-ax} ${-ay})`); });
    // The air that has come in, and gone out, since the breathing began: the dots move with it.
    const inAir = ph < 0 ? 0 : n + (inhaling ? b : 1), outAir = ph < 0 ? 0 : n + (inhaling ? 0 : 1 - b);
    st.tracks.forEach((tr, i) => {
      const side = i < 3 ? 0 : 1, [ax, ay] = CHEST.anchor[side], entry = tr.cum[3];
      const place = (el, s, op) => {
        if (!el) return;
        const pt = pointAt(tr, s), w = Math.max(0, Math.min(1, (s - entry + 60) / 60)), kk = 1 + (k - 1) * w;
        el.setAttribute('cx', (ax + (pt.x - ax) * kk).toFixed(1));
        el.setAttribute('cy', (ay + (pt.y - ay) * kk).toFixed(1));
        el.setAttribute('opacity', op.toFixed(2));
      };
      const ends = (s) => Math.max(0, Math.min(1, s / 50, (tr.len - s) / 70));
      const lane = (2 * (i % 3) + side) / 6;
      st.ai[i].forEach((el, j) => { const s = (((j + lane) / 4) * (tr.len + 80) + inAir * tr.len * 1.1) % (tr.len + 80); place(el, s, ph < 0 ? 0 : inhaling ? ends(s) : Math.max(0, ends(s) * (1 - (ph - 0.5) / 0.12))); });
      st.ao[i].forEach((el, j) => { const s = tr.len - ((((j + lane) / 4) * (tr.len + 80) + outAir * tr.len * 1.1) % (tr.len + 80)); place(el, s, !inhaling && ph >= 0 ? ends(s) : 0); });
    });
    st.ph.forEach((el, i) => { if (!el) return; const u = i === 0 ? ph / 0.5 : (ph - 0.5) / 0.5, on = ph >= 0 && u >= 0 && u <= 1; el.setAttribute('opacity', on ? Math.min(1, u / 0.1, (1 - u) / 0.1).toFixed(2) : '0'); });
  },
});

/* ---------------------------------------------------------------------------------------------------------------
 * neuron_signal: a nerve cell from the side, with its dendrites, cell body, axon and axon endings, and the next cell
 * across a small gap. Signals come in at the dendrites, the cell body fires, a signal runs down the axon to its
 * endings, chemical messengers cross the gap and the next cell lights up.
 * ------------------------------------------------------------------------------------------------------------- */
const NEURON = {
  soma: [400, 480], somaR: 62,
  // Each dendrite: the points from the cell body out to its tip, and a side branch from its middle point.
  dendrites: [
    { pts: [[366, 432], [304, 362], [262, 306]], side: [[304, 362], [228, 368]], input: true },
    { pts: [[340, 474], [258, 456], [182, 418]], side: [[258, 456], [190, 494]], input: true },
    { pts: [[362, 528], [296, 590], [250, 656]], side: [[296, 590], [216, 604]], input: true },
    { pts: [[414, 420], [424, 342], [470, 290]], side: [[424, 342], [372, 300]] },
    { pts: [[420, 540], [440, 616], [492, 664]] },
  ],
  axon: [[512, 480], [1290, 480]],
  endings: [[[1290, 480], [1344, 424], [1368, 406]], [[1290, 480], [1350, 480], [1380, 480]], [[1290, 480], [1344, 536], [1368, 554]]],
  bulbs: [[1374, 402], [1388, 480], [1374, 558]],
  // The next cell: its dendrites reach toward the endings across the gap.
  next: {
    soma: [1630, 480], somaR: 52,
    dendrites: [[[1436, 398], [1522, 428], [1584, 452]], [[1446, 480], [1580, 480]], [[1436, 562], [1522, 532], [1584, 508]], [[1618, 430], [1606, 352], [1640, 300]], [[1618, 530], [1608, 608], [1644, 660]]],
    axon: [[1680, 480], [1830, 480]],
  },
};
const dPts = (pts) => 'M' + pts.map((q) => q.join(' ')).join('L');
// When each part of the signal happens, from the moment it starts (`at`, a fraction of the scene). The whole run is
// squeezed when it starts late, so it always ends before the scene does.
const neuronTimes = (at) => {
  const a = Math.max(0.2, Math.min(0.8, Number.isFinite(at) ? at : 0.32)), k = Math.min(1, (0.94 - a) / 0.6), T = (x) => a + x * k;
  return { inputs: [T(0), T(0.08)], fire: [T(0.07), T(0.14)], axon: [T(0.12), T(0.4)], ends: [T(0.4), T(0.45)], cross: [T(0.45), T(0.53)], next: [T(0.52), T(0.6)], on: [T(0.58), T(0.66)] };
};

register('neuron_signal', {
  cat: CD, title: 'How a nerve signal travels',
  desc: 'A nerve cell with its dendrites, cell body, axon and axon endings, and the next cell across a small gap. Signals come in at the dendrites, the cell body fires, a signal runs down the axon to its endings, chemical messengers cross the gap and the next cell lights up. Can draw the axon wrapped in myelin.',
  use: 'Nerves, the brain, reflexes, how signals pass from one nerve cell to the next.',
  params: 'labels: {dendrites, cellBody, axon, myelin, axonEndings, signal, synapse, messengers, nextCell} (all optional; a part without a label is drawn without one), myelin (optional true or false: wrap the axon in myelin, default false), at (optional: when the signal starts, a fraction of the scene or a word of the narration)',
  example: { labels: { dendrites: 'Dendrites', cellBody: 'Cell body', axon: 'Axon', axonEndings: 'Axon endings', signal: 'Electrical signal', synapse: 'Synapse', nextCell: 'Next nerve cell' } },
  build(p, c) {
    const { U, th } = c, id = c.id, L = p.labels || {}, N = NEURON, nx = N.next, col = th.muted, sig = th.accent, tm = neuronTimes(p.at);
    let o = U.bg();
    const stroke = (pts, w, color, at, d) => { const tr = track(pts), len = tr.len.toFixed(0); return `<path d="${dPts(pts)}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${len}" stroke-dashoffset="${len}"${U.A('draw', at, d, { l: len })}/>`; };
    // The first cell: dendrites, cell body with its nucleus, axon and endings, drawn from the cell body out.
    N.dendrites.forEach((dd, k) => { o += stroke(dd.pts.slice(0, 2), 16, col, 0.04 + k * 0.012, 0.06) + stroke(dd.pts.slice(1), 10, col, 0.08 + k * 0.012, 0.05) + (dd.side ? stroke(dd.side, 7, col, 0.1 + k * 0.012, 0.04) : ''); });
    const [sx, sy] = N.soma;
    o += `<g${U.A('pop', 0.02, 0.06, { cx: sx, cy: sy })}><path d="M${sx + 40} ${sy - 30}L${sx + 116} ${sy - 9}V${sy + 9}L${sx + 40} ${sy + 30}Z" fill="${col}"/><circle cx="${sx}" cy="${sy}" r="${N.somaR}" fill="${col}"/><circle id="${id}fire" cx="${sx}" cy="${sy}" r="${N.somaR}" fill="${sig}" opacity="0"/><circle cx="${sx - 8}" cy="${sy - 4}" r="24" fill="${th.surface}"/></g>`;
    o += stroke(N.axon, 14, col, 0.1, 0.1);
    N.endings.forEach((e, k) => { o += stroke(e, 9, col, 0.19 + k * 0.01, 0.04); });
    N.bulbs.forEach(([x, y], k) => { o += `<g${U.A('pop', 0.22 + k * 0.01, 0.04, { cx: x, cy: y })}><circle cx="${x}" cy="${y}" r="17" fill="${col}"/><circle id="${id}bulb${k}" cx="${x}" cy="${y}" r="17" fill="${sig}" opacity="0"/></g>`; });
    // The axon's myelin, only when asked for.
    if (p.myelin === true) for (let k = 0; k < 5; k++) { const x = 566 + k * 140; o += `<rect x="${x}" y="459" width="112" height="42" rx="21" fill="${th.paper}" stroke="${th.muted}" stroke-width="3"${U.A('pop', 0.16 + k * 0.012, 0.04, { cx: x + 56, cy: 480 })}/>`; }
    // The next cell, which lights up when the signal reaches it.
    let nextCell = `<circle cx="${nx.soma[0]}" cy="${nx.soma[1]}" r="${nx.somaR}" fill="COL"/>` + nx.dendrites.map((pts) => `<path d="${dPts(pts)}" fill="none" stroke="COL" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>`).join('') + `<path d="${dPts(nx.axon)}" stroke="COL" stroke-width="12" stroke-linecap="round"/>`;
    o += `<g opacity="0"${U.A('fade', 0.2, 0.06)}>${nextCell.replace(/COL/g, col)}<circle cx="${nx.soma[0] - 6}" cy="${nx.soma[1] - 3}" r="20" fill="${th.surface}"/></g>`;
    o += `<g id="${id}lit" opacity="0">${nextCell.replace(/COL/g, sig)}<circle cx="${nx.soma[0] - 6}" cy="${nx.soma[1] - 3}" r="20" fill="${th.surface}"/></g>`;
    // The signal: inputs that run in along three dendrites, a pulse down the axon and its endings, messengers across
    // the gap and a pulse leaving along the next cell's axon.
    N.dendrites.forEach((dd, k) => { if (dd.input) o += `<circle id="${id}in${k}" r="11" fill="${sig}" opacity="0"/>`; });
    const pulse = (key, pts) => { const len = track(pts).len.toFixed(0); return `<path id="${id}${key}h" d="${dPts(pts)}" fill="none" stroke="${sig}" stroke-width="34" stroke-linecap="round" stroke-dasharray="0 ${len}" opacity="0"/><path id="${id}${key}" d="${dPts(pts)}" fill="none" stroke="${sig}" stroke-width="14" stroke-linecap="round" stroke-dasharray="0 ${len}" opacity="0"/>`; };
    o += pulse('ax', N.axon) + N.endings.map((e, k) => pulse('e' + k, e)).join('') + pulse('nx', nx.axon);
    N.bulbs.forEach((b, k) => { for (let j = 0; j < 3; j++) o += `<circle id="${id}m${k}_${j}" r="7" fill="${th.accent2}" opacity="0"/>`; });
    // The names of the parts, with lines to them.
    const name = (key, x, y, px, py, at, o2 = {}) => { const t = said(L, key); if (!t) return ''; const fit = fitLines(U, t, o2.w || 240, 34, 2), top = y - ((fit.lines.length - 1) * fit.s * 1.12) / 2; return `<g opacity="0"${U.A('fade', at, 0.05)}>${px != null ? `<path d="M${x} ${py < y ? top - fit.s * 0.85 : top + (fit.lines.length - 1) * fit.s * 1.12 + 12}L${px} ${py}" stroke="${th.muted}" stroke-width="3"/><circle cx="${px}" cy="${py}" r="6" fill="${th.ink}"/>` : ''}${block(U, x, y, fit, { f: o2.f || th.ink })}</g>`; };
    o += name('dendrites', 250, 248, 286, 340, 0.12) + name('cellBody', 400, 740, 400, 548, 0.08) + name('axon', 880, 610, p.myelin === true ? 832 : 880, 494, 0.16) +
      (p.myelin === true ? name('myelin', 706, 392, 706, 458, 0.22) : '') + name('axonEndings', 1290, 330, 1362, 396, 0.24) +
      name('signal', p.myelin === true ? 1040 : 980, 392, null, null, (tm.axon[0] + tm.axon[1]) / 2, { f: sig }) + name('synapse', 1412, 690, 1412, 562, 0.26, { w: 200 }) +
      name('nextCell', 1700, 300, 1636, 424, 0.26) + name('messengers', 1530, 760, null, null, tm.cross[0] + 0.02, { f: th.accent2 });
    return o;
  },
  init(g, p, c) {
    const q = (s) => g.querySelector('#' + c.id + s), N = NEURON;
    return {
      fire: q('fire'), lit: q('lit'), bulbs: N.bulbs.map((_, k) => q('bulb' + k)),
      inputs: N.dendrites.map((dd, k) => (dd.input ? { el: q('in' + k), tr: track([...dd.pts].reverse()) } : null)).filter(Boolean),
      pulses: [['ax', N.axon], ...N.endings.map((e, k) => ['e' + k, e]), ['nx', N.next.axon]].map(([key, pts]) => ({ el: q(key), halo: q(key + 'h'), len: track(pts).len, key })),
      msgs: N.bulbs.map((_, k) => [0, 1, 2].map((j) => q(`m${k}_${j}`))),
    };
  },
  render(l, st, p, c) {
    const { U } = c, tm = neuronTimes(p.at), pr = (r) => U.prog(l.p, r[0], r[1]), N = NEURON;
    // Inputs run in from the tips of three dendrites to the cell body.
    st.inputs.forEach(({ el, tr }, k) => { if (!el) return; const u = U.prog(l.p, tm.inputs[0] + k * 0.01, tm.inputs[1]), pt = pointAt(tr, U.ease.io(u) * tr.len); el.setAttribute('cx', pt.x.toFixed(1)); el.setAttribute('cy', pt.y.toFixed(1)); el.setAttribute('opacity', u > 0 && u < 1 ? '1' : '0'); });
    // The cell body fires, then calms down a little.
    const f = pr(tm.fire);
    st.fire?.setAttribute('opacity', (f <= 0 || f >= 1 ? 0 : f < 0.4 ? f / 0.4 : 1 - (f - 0.4) / 0.6).toFixed(2));
    // A pulse runs along a line: a bright dash moving from its start to its end.
    const run = (pl, u, dash) => {
      const head = u * (pl.len + dash), from = Math.max(0, head - dash), to = Math.min(pl.len, head), on = u > 0 && u < 1 && to > from;
      // A dash of length 0 would still draw a dot with its round cap, so a pulse that is not running is hidden.
      [pl.el, pl.halo].forEach((el, i) => { if (!el) return; el.setAttribute('stroke-dasharray', `${Math.max(0.1, to - from).toFixed(1)} ${(pl.len + 200).toFixed(0)}`); el.setAttribute('stroke-dashoffset', (-from).toFixed(1)); el.setAttribute('opacity', on ? (i ? '0.3' : '1') : '0'); });
    };
    st.pulses.forEach((pl) => run(pl, pl.key === 'ax' ? pr(tm.axon) : pl.key === 'nx' ? pr(tm.on) : pr(tm.ends), pl.key === 'ax' ? 130 : pl.key === 'nx' ? 90 : 60));
    // The endings flash, and messengers cross the gap to the next cell.
    const e = pr(tm.ends);
    st.bulbs.forEach((el) => el?.setAttribute('opacity', (e < 0.6 ? 0 : Math.min(1, (e - 0.6) / 0.4) * (1 - 0.6 * pr(tm.next))).toFixed(2)));
    st.msgs.forEach((row, k) => row.forEach((el, j) => {
      if (!el) return;
      const u = U.prog(l.p, tm.cross[0] + j * 0.015, tm.cross[1] + j * 0.015), [bx, by] = N.bulbs[k], [tx, ty] = N.next.dendrites[k][0], dy = (j - 1) * 12;
      el.setAttribute('cx', (bx + 16 + (tx - bx - 26) * U.ease.io(u)).toFixed(1));
      el.setAttribute('cy', (by + dy + (ty - by) * U.ease.io(u)).toFixed(1));
      el.setAttribute('opacity', u > 0 && u < 1 ? '1' : '0');
    }));
    // The next cell lights up, and stays a little lit.
    const n = pr(tm.next);
    st.lit?.setAttribute('opacity', (n <= 0 ? 0 : n < 0.5 ? n / 0.5 : 1 - 0.45 * ((n - 0.5) / 0.5)).toFixed(2));
  },
});

/* ---------------------------------------------------------------------------------------------------------------
 * leaf_photosynthesis: a leaf on its stem. Sunlight falls on it, water comes up the stem, carbon dioxide goes in and
 * sugar is made inside, and oxygen comes out. The gases are drawn as small molecules moving along their arrows.
 * ------------------------------------------------------------------------------------------------------------- */
const LEAF_AT = { x: 960, y: 676, turn: 10 }; // the leaf's base and how far it leans to the right, in degrees
// A point given along the leaf (y up from the base is negative) as a point in the frame.
const onLeaf = (x, y) => { const a = (LEAF_AT.turn * Math.PI) / 180; return [LEAF_AT.x + x * Math.cos(a) - y * Math.sin(a), LEAF_AT.y + x * Math.sin(a) + y * Math.cos(a)]; };
const PHOTO = {
  light: [[[424, 202], [858, 318]], [[430, 254], [866, 392]], [[424, 306], [884, 464]]],
  co2: [[[430, 500], [866, 516]], [[430, 564], [888, 572]], [[430, 628], [916, 626]]],
  o2: [[[1112, 306], [1480, 250]], [[1136, 386], [1506, 360]], [[1150, 464], [1480, 470]]],
  water: [[932, 786], [944, 728], onLeaf(0, 0), onLeaf(0, -70), onLeaf(0, -250)],
  sugar: [onLeaf(-70, -330), onLeaf(60, -270), onLeaf(-60, -170), onLeaf(70, -150)],
  sun: [318, 234],
};
const arrowHead = (from, to, col, size = 22) => { const a = Math.atan2(to[1] - from[1], to[0] - from[0]), [x, y] = to; return `<path d="M${(x + Math.cos(a) * 4).toFixed(1)} ${(y + Math.sin(a) * 4).toFixed(1)}L${(x - size * Math.cos(a) + size * 0.55 * Math.sin(a)).toFixed(1)} ${(y - size * Math.sin(a) - size * 0.55 * Math.cos(a)).toFixed(1)}L${(x - size * Math.cos(a) - size * 0.55 * Math.sin(a)).toFixed(1)} ${(y - size * Math.sin(a) + size * 0.55 * Math.cos(a)).toFixed(1)}Z" fill="${col}"/>`; };
// A small molecule of carbon dioxide (an oxygen, a carbon and an oxygen atom in a row) or oxygen (two oxygen atoms),
// drawn around 0,0.
const molecule = (id, kind, edge) => kind === 'co2'
  ? `<g id="${id}" opacity="0"><circle cx="-17" r="10" fill="${OXYGEN_ATOM}" stroke="${edge}" stroke-width="2"/><circle cx="17" r="10" fill="${OXYGEN_ATOM}" stroke="${edge}" stroke-width="2"/><circle r="11" fill="${CARBON_ATOM}" stroke="${edge}" stroke-width="2"/></g>`
  : `<g id="${id}" opacity="0"><circle cx="-8.5" r="10" fill="${OXYGEN_ATOM}" stroke="${edge}" stroke-width="2"/><circle cx="8.5" r="10" fill="${OXYGEN_ATOM}" stroke="${edge}" stroke-width="2"/></g>`;
const hexagon = (cx, cy, r) => 'M' + [0, 1, 2, 3, 4, 5].map((k) => { const a = (Math.PI / 3) * k; return (cx + r * Math.cos(a)).toFixed(1) + ' ' + (cy + r * Math.sin(a)).toFixed(1); }).join('L') + 'Z';
// The sun's twelve rays, turned by `turn` radians. The path itself turns (not a transform), so the measured size of the
// drawing stays its true size.
const sunRays = (turn) => { const [sx, sy] = PHOTO.sun; let d = ''; for (let k = 0; k < 12; k++) { const a = (Math.PI / 6) * k + turn; d += `M${(sx + 66 * Math.cos(a)).toFixed(1)} ${(sy + 66 * Math.sin(a)).toFixed(1)}L${(sx + 88 * Math.cos(a)).toFixed(1)} ${(sy + 88 * Math.sin(a)).toFixed(1)}`; } return d; };
const PHOTO_TIMES = { leaf: 0.02, light: 0.12, water: 0.26, co2: 0.4, sugar: 0.54, o2: 0.68, equation: 0.8 };

register('leaf_photosynthesis', {
  cat: CD, title: 'How a leaf makes food',
  desc: 'A leaf on its stem. Sunlight falls on it, water comes up the stem, carbon dioxide goes in, sugar is made inside the leaf and oxygen comes out. The gases move as small molecules along their arrows, and each part comes in one after the other.',
  use: 'Photosynthesis, plants, how plants make food and give off oxygen.',
  params: 'labels: {sunlight, water, carbonDioxide, oxygen, sugar} (all optional; a part without a label is drawn without one), equation (optional text shown under the drawing, only when given)',
  example: { labels: { sunlight: 'Sunlight', water: 'Water', carbonDioxide: 'Carbon dioxide', oxygen: 'Oxygen', sugar: 'Sugar' } },
  build(p, c) {
    const { U, th } = c, id = c.id, L = p.labels || {}, edge = edgeOf(th), T = PHOTO_TIMES, molEdge = th.card ? th.ink : th.bg;
    let o = U.bg();
    // The leaf on its stem, with its veins.
    const leaf = 'M0 0C-232 -100 -244 -342 0 -500C244 -342 232 -100 0 0Z';
    let veins = `<path d="M0 -6V-472" stroke="${VEIN}" stroke-width="8" stroke-linecap="round"/>`;
    [-90, -170, -250, -330, -405].forEach((y, k) => { const w = [118, 150, 150, 120, 80][k]; veins += [-1, 1].map((s) => `<path d="M0 ${y}Q${s * w * 0.5} ${y - 22} ${s * w} ${y - 70}" fill="none" stroke="${VEIN}" stroke-width="4.5" stroke-linecap="round"/>`).join(''); });
    o += `<g${U.A('grow', T.leaf, 0.1, { cx: LEAF_AT.x, cy: LEAF_AT.y })}><path d="M${LEAF_AT.x} ${LEAF_AT.y}Q${LEAF_AT.x - 10} ${LEAF_AT.y + 60} ${LEAF_AT.x - 30} ${LEAF_AT.y + 116}" fill="none" stroke="${LEAF_DARK}" stroke-width="20" stroke-linecap="round"/>` +
      `<g transform="translate(${LEAF_AT.x} ${LEAF_AT.y}) rotate(${LEAF_AT.turn})"><defs><clipPath id="${id}leaf"><path d="${leaf}"/></clipPath></defs><path d="${leaf}" fill="${LEAF}"/><g clip-path="url(#${id}leaf)"><g opacity="0"${U.A('fade', T.leaf + 0.06, 0.06)}>${veins}</g></g>${th.card ? `<path d="${leaf}" fill="none" stroke="${edge}" stroke-width="4" stroke-linejoin="round"/>` : ''}</g></g>`;
    // Sunlight: the sun, and light falling on the leaf.
    const [sx, sy] = PHOTO.sun;
    o += `<g${U.A('pop', T.light - 0.04, 0.06, { cx: sx, cy: sy })}><circle cx="${sx}" cy="${sy}" r="50" fill="${SUN}"/><path id="${id}rays" d="${sunRays(0)}" stroke="${SUN}" stroke-width="9" stroke-linecap="round"/></g>`;
    PHOTO.light.forEach(([a, b], k) => { o += `<g opacity="0"${U.A('fade', T.light + k * 0.02, 0.05)}><path id="${id}lt${k}" d="M${a[0]} ${a[1]}L${b[0]} ${b[1]}" stroke="${SUN}" stroke-width="8" stroke-dasharray="30 18" stroke-linecap="round"/>${arrowHead(a, b, SUN, 24)}</g>`; });
    // Water comes up the stem into the leaf.
    const wt = track(PHOTO.water), wl = wt.len.toFixed(0);
    o += `<g opacity="0"${U.A('fade', T.water, 0.005)}><path d="${pathOf(PHOTO.water)}" fill="none" stroke="${WATER}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${wl}" stroke-dashoffset="${wl}"${U.A('draw', T.water, 0.08, { l: wl })}/></g>`;
    o += `<g opacity="0"${U.A('fade', T.water + 0.07, 0.03)}>${arrowHead(PHOTO.water[3], PHOTO.water[4], WATER, 22)}</g>`;
    for (let j = 0; j < 5; j++) o += `<path id="${id}w${j}" d="M0 -13Q9 -2 9 4A9 9 0 0 1 -9 4Q-9 -2 0 -13Z" fill="${WATER}" stroke="${th.card ? th.ink : WHITE}" stroke-width="2" opacity="0"/>`;
    // Carbon dioxide goes in, oxygen comes out: arrows, and molecules moving along them.
    const gasArrows = (list, col, at, key) => list.map(([a, b], k) => { const len = Math.hypot(b[0] - a[0], b[1] - a[1]).toFixed(0); return `<g opacity="0"${U.A('fade', at + k * 0.02, 0.005)}><path d="M${a[0]} ${a[1]}L${b[0]} ${b[1]}" stroke="${col}" stroke-width="6" stroke-linecap="round" stroke-dasharray="${len}" stroke-dashoffset="${len}"${U.A('draw', at + k * 0.02, 0.06, { l: len })}/></g><g opacity="0"${U.A('fade', at + k * 0.02 + 0.055, 0.02)}>${arrowHead(a, b, col, 22)}</g>` + [0, 1].map((j) => molecule(`${id}${key}${k}_${j}`, key, molEdge)).join(''); }).join('');
    o += gasArrows(PHOTO.co2, th.muted, T.co2, 'co2') + gasArrows(PHOTO.o2, th.accent2, T.o2, 'o2');
    // Sugar made inside the leaf.
    PHOTO.sugar.forEach(([x, y], k) => { o += `<g${U.A('pop', T.sugar + k * 0.03, 0.05, { cx: x, cy: y })}><g id="${id}su${k}"><path d="${hexagon(x, y, 25)}" fill="${SUGAR}" stroke="${SUGAR_EDGE}" stroke-width="4" stroke-linejoin="round"/></g></g>`; });
    // The names, beside what they name.
    const name = (key, x, y, a, at, w) => { const t = said(L, key); return t ? `<g opacity="0"${U.A('fade', at, 0.05)}>${label(U, x, y, t, { a, w })}</g>` : ''; };
    o += name('sunlight', sx, sy + 140, 'middle', T.light + 0.04, 300) + name('carbonDioxide', 408, 576, 'end', T.co2 + 0.04, 360) + name('oxygen', 1530, 372, 'start', T.o2 + 0.06, 340) + name('water', 902, 776, 'end', T.water + 0.04, 400);
    const sugar = said(L, 'sugar');
    if (sugar) { const [hx, hy] = PHOTO.sugar[3]; o += `<g opacity="0"${U.A('fade', T.sugar + 0.1, 0.05)}><path d="M${hx + 26} ${hy + 8}L1214 ${hy + 64}" stroke="${th.muted}" stroke-width="3"/>${label(U, 1226, hy + 76, sugar, { a: 'start', w: 520 })}</g>`; }
    const eq = typeof p.equation === 'string' ? p.equation.trim() : '';
    if (eq) { const s = Math.max(30, Math.min(40, 620 / Math.max(1, U.tw(eq, 1, { fam: 'd', w: 700 })))); o += U.T(1480, 760, eq, { fam: 'd', s, w: 700, an: U.A('fade', T.equation, 0.06) }); }
    return o;
  },
  init(g, p, c) {
    const q = (s) => g.querySelector('#' + c.id + s);
    return {
      rays: q('rays'), light: PHOTO.light.map((_, k) => q('lt' + k)), water: track(PHOTO.water), drops: [0, 1, 2, 3, 4].map((j) => q('w' + j)),
      co2: PHOTO.co2.map((_, k) => [0, 1].map((j) => q(`co2${k}_${j}`))), o2: PHOTO.o2.map((_, k) => [0, 1].map((j) => q(`o2${k}_${j}`))), sugar: PHOTO.sugar.map((_, k) => q('su' + k)),
    };
  },
  render(l, st) {
    const T = PHOTO_TIMES, t = l.t;
    // The light keeps falling on the leaf, and the sun's rays turn slowly.
    st.light.forEach((el) => el?.setAttribute('stroke-dashoffset', (-(t * 70) % 48).toFixed(1)));
    st.rays?.setAttribute('d', sunRays((t * 6 * Math.PI) / 180));
    // Water drops rise up the stem once the water has come in.
    const wt = st.water, on = (at) => l.p >= at;
    st.drops.forEach((el, j) => {
      if (!el) return;
      const s = (j / 5) * wt.len + t * 60, d = s % wt.len, pt = pointAt(wt, d), fade = Math.max(0, Math.min(1, d / 40, (wt.len - d) / 60));
      el.setAttribute('transform', `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)})`);
      el.setAttribute('opacity', on(T.water + 0.08) ? fade.toFixed(2) : '0');
    });
    // Molecules move along the gas arrows: carbon dioxide into the leaf, oxygen out of it.
    const flow = (rows, list, at) => rows.forEach((row, k) => row.forEach((el, j) => {
      if (!el) return;
      const [a, b] = list[k], u = ((t * 0.32 + j / 2 + k * 0.17) % 1), x = a[0] + (b[0] - a[0]) * u, y = a[1] + (b[1] - a[1]) * u;
      el.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${((Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI).toFixed(1)})`);
      el.setAttribute('opacity', on(at + k * 0.02 + 0.06) ? Math.max(0, Math.min(1, u / 0.12, (1 - u) / 0.18)).toFixed(2) : '0');
    }));
    flow(st.co2, PHOTO.co2, T.co2);
    flow(st.o2, PHOTO.o2, T.o2);
    // The sugar glows softly once it is made.
    st.sugar.forEach((el, k) => { if (!el) return; const [x, y] = PHOTO.sugar[k], s = 1 + 0.05 * Math.sin(t * 3 + k * 1.3); el.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${s.toFixed(3)}) translate(${(-x).toFixed(1)} ${(-y).toFixed(1)})`); });
  },
});

/* ---------------------------------------------------------------------------------------------------------------
 * immune_response: germs drift in, antibodies (Y shapes) latch onto them, and a white blood cell comes, takes the
 * marked germs in and breaks them down.
 * ------------------------------------------------------------------------------------------------------------- */
const IMMUNE = {
  center: [960, 470], // where the white blood cell ends up
  cellR: 165,
  // Each germ: where it settles, when the white blood cell takes it in, and where it ends up inside the cell.
  germs: [
    { at: [1230, 355], take: 0.58, inside: [78, -66] },
    { at: [1213, 599], take: 0.6, inside: [84, 56] },
    { at: [960, 272], take: 0.63, inside: [-4, -106] },
    { at: [875, 663], take: 0.65, inside: [8, 104] },
    { at: [690, 355], take: 0.68, inside: [-86, -58] },
    { at: [650, 538], take: 0.7, inside: [-92, 52] },
  ],
  enter: [0.04, 0.26], // the germs drift in
  antibodies: [0.3, 0.48], // the antibodies latch on
  cell: [0.5, 0.7], // the white blood cell comes in
  digest: [0.8, 0.92], // the germs inside break down
};
const GERM_R = 40;
const germShape = () => { let d = ''; for (let k = 0; k < 9; k++) { const a = (2 * Math.PI * k) / 9; d += `M${(GERM_R * 0.8 * Math.cos(a)).toFixed(1)} ${(GERM_R * 0.8 * Math.sin(a)).toFixed(1)}L${((GERM_R + 13) * Math.cos(a)).toFixed(1)} ${((GERM_R + 13) * Math.sin(a)).toFixed(1)}`; } return `<path d="${d}" stroke="${GERM_DARK}" stroke-width="8" stroke-linecap="round"/><circle r="${GERM_R}" fill="${GERM}" stroke="${GERM_DARK}" stroke-width="4"/><circle cx="-12" cy="-8" r="8" fill="${GERM_DARK}" opacity=".55"/><circle cx="13" cy="11" r="6" fill="${GERM_DARK}" opacity=".55"/>`; };
// An antibody: a Y whose two arms reach toward +x and end at 0,0, with its stem behind it.
const antibody = (col) => `<path d="M-70 0H-28M-28 0L0 -21M-28 0L0 21" fill="none" stroke="${col}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>`;
// The outline of the white blood cell, a soft blob that changes shape a little as it moves.
const cellOutline = (cx, cy, r, t) => { const pts = []; for (let k = 0; k < 48; k++) { const a = (2 * Math.PI * k) / 48, rr = r + 5 * Math.sin(3 * a + t * 1.7) + 3 * Math.sin(5 * a - t * 2.3); pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]); } return pathOf(pts) + 'Z'; };

register('immune_response', {
  cat: CD, title: 'How the body fights germs',
  desc: 'Germs drift in, antibodies (Y shapes) latch onto them, and a white blood cell comes, takes the marked germs in and breaks them down. Each step comes in one after the other.',
  use: 'The immune system, infections, antibodies, vaccines, white blood cells.',
  params: 'labels: {germs, antibodies, whiteBloodCell} (all optional; a part without a label is drawn without one)',
  example: { labels: { germs: 'Germs', antibodies: 'Antibodies', whiteBloodCell: 'White blood cell' } },
  build(p, c) {
    const { U, th } = c, id = c.id, L = p.labels || {}, I = IMMUNE, [cx, cy] = I.center;
    let o = U.bg();
    // The white blood cell, which comes in from the right.
    o += `<g id="${id}cell" opacity="0"><path id="${id}cellEdge" d="${cellOutline(cx, cy, I.cellR, 0)}" fill="${WHITE_CELL}" stroke="${th.card ? th.ink : '#C8CBE6'}" stroke-width="4" stroke-linejoin="round"/>` +
      [[-38, -12], [0, 18], [38, -10]].map(([x, y]) => `<circle cx="${cx + x}" cy="${cy + y}" r="32" fill="${WHITE_CELL_CORE}"/>`).join('') + '</g>';
    // The germs, each with the two antibodies that latch onto it.
    I.germs.forEach((g, k) => {
      const out = Math.atan2(g.at[1] - cy, g.at[0] - cx), abs = [out - 0.8, out + 0.8].map((a) => ({ a, x: (GERM_R + 6) * Math.cos(a), y: (GERM_R + 6) * Math.sin(a) }));
      o += `<g id="${id}g${k}" opacity="0"><g id="${id}gb${k}">${germShape()}</g>` +
        // Each antibody latches on: it grows out from the point where it holds the germ.
        abs.map((b, j) => { const at = I.antibodies[0] + (k * 2 + j) * 0.016; return `<g${U.A('pop', at, 0.06, { cx: b.x.toFixed(1), cy: b.y.toFixed(1) })}><g transform="translate(${b.x.toFixed(1)} ${b.y.toFixed(1)}) rotate(${((b.a * 180) / Math.PI + 180).toFixed(1)})">${antibody(th.accent)}</g></g>`; }).join('') + '</g>';
    });
    // The names, with lines to what they name. The germs' and the antibodies' names go when the cell takes the germs.
    const name = (key, x, y, a, px, py, at, until) => { const t = said(L, key); if (!t) return ''; const lx = a === 'end' ? x + 10 : a === 'start' ? x - 10 : x; return `<g opacity="0"${U.A('fade', at, 0.05)}><g${until ? U.A('dim', until, 0.05, { to: 0 }) : ''}>${px != null ? `<path d="M${lx} ${y + 10}L${px} ${py}" stroke="${th.muted}" stroke-width="3"/><circle cx="${px}" cy="${py}" r="6" fill="${th.ink}"/>` : ''}${label(U, x, y, t, { a, w: 460 })}</g></g>`; };
    const gl = I.germs[4].at, gr = I.germs[0].at, ar = Math.atan2(gr[1] - cy, gr[0] - cx) - 0.8, tip = [gr[0] + (GERM_R + 60) * Math.cos(ar), gr[1] + (GERM_R + 60) * Math.sin(ar)];
    o += name('germs', 520, 250, 'end', gl[0] - 34, gl[1] - 34, I.enter[1] - 0.04, I.germs[4].take - 0.02) +
      name('antibodies', 1400, 222, 'start', tip[0].toFixed(0), tip[1].toFixed(0), I.antibodies[0] + 0.1, I.germs[0].take - 0.02) +
      name('whiteBloodCell', cx, cy + I.cellR + 76, 'middle', null, null, I.cell[1] + 0.06);
    return o;
  },
  init(g, p, c) {
    const q = (s) => g.querySelector('#' + c.id + s);
    return { cell: q('cell'), edge: q('cellEdge'), germs: IMMUNE.germs.map((_, k) => ({ g: q('g' + k), body: q('gb' + k) })) };
  },
  render(l, st, p, c) {
    const { U } = c, I = IMMUNE, t = l.t, [fx, fy] = I.center;
    // The white blood cell comes in from the right and settles where the germs are.
    const e = U.ease.io(U.prog(l.p, I.cell[0], I.cell[1])), ccx = fx + (1 - e) * 860;
    st.cell?.setAttribute('opacity', l.p < I.cell[0] ? '0' : Math.min(1, U.prog(l.p, I.cell[0], I.cell[0] + 0.04)).toFixed(2));
    st.cell?.setAttribute('transform', `translate(${(ccx - fx).toFixed(1)} 0)`);
    st.edge?.setAttribute('d', cellOutline(fx, fy, I.cellR, t));
    const digest = U.prog(l.p, I.digest[0], I.digest[1]);
    st.germs.forEach(({ g, body }, k) => {
      if (!g) return;
      const gm = I.germs[k], enter = U.ease.out(U.prog(l.p, I.enter[0] + k * 0.03, I.enter[0] + k * 0.03 + 0.14)), take = U.ease.io(U.prog(l.p, gm.take, gm.take + 0.08));
      // A germ drifts in from the left, bobs while it waits, and is pulled into the cell.
      const bob = [6 * Math.sin(t * 1.3 + k * 2.1), 6 * Math.cos(t * 1.1 + k * 1.7)];
      const x0 = gm.at[0] - (1 - enter) * 220 + bob[0] * (1 - take), y0 = gm.at[1] + bob[1] * (1 - take);
      const x = x0 + (ccx + gm.inside[0] - x0) * take, y = y0 + (fy + gm.inside[1] - y0) * take, s = 1 - 0.5 * take;
      g.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${s.toFixed(3)})`);
      g.setAttribute('opacity', (Math.min(1, enter * 1.4) * (1 - 0.65 * digest)).toFixed(2));
      body?.setAttribute('transform', `rotate(${(Math.sin(t * 0.9 + k) * 14).toFixed(1)})`);
    });
  },
});

// A lung lobe around cx, cy, w wide and h tall, with its rounded outer side facing `side` (-1 left, 1 right).
function lungShape(cx, cy, w, h, side, fill, edge) {
  const s = side, x = (u) => (cx + s * u * w).toFixed(1), y = (v) => (cy + v * h).toFixed(1);
  const d = `M${x(-0.28)} ${y(-0.5)}C${x(0.12)} ${y(-0.56)} ${x(0.5)} ${y(-0.1)} ${x(0.5)} ${y(0.3)}C${x(0.5)} ${y(0.5)} ${x(0.3)} ${y(0.54)} ${x(0.05)} ${y(0.5)}C${x(-0.2)} ${y(0.47)} ${x(-0.42)} ${y(0.5)} ${x(-0.5)} ${y(0.42)}C${x(-0.52)} ${y(0.1)} ${x(-0.42)} ${y(-0.48)} ${x(-0.28)} ${y(-0.5)}Z`;
  return `<path d="${d}" fill="${fill}" stroke="${edge}" stroke-width="4" stroke-linejoin="round"/>`;
}

// A short text beside the drawing, wrapped to at most 3 lines of about 330 px, with the block's middle at y.
function fitBeside(U, th, text, x, y, at) {
  const lines = wrapTo(U, text, 330, 32).slice(0, 3);
  return `<g opacity="0"${U.A('fade', at, 0.05)}>${lines.map((t, i) => U.T(x, (y + (i - (lines.length - 1) / 2) * 40 + 11).toFixed(1), t, { a: 'start', s: 32, w: 600, f: th.ink })).join('')}</g>`;
}
