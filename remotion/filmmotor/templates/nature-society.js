// Templates for science (part 2), economy and society: Trym's code from his film engine (templates/natur_samfunn.js),
// adapted for Meko with English text and the Night atlas theme. See ../engine.js for how templates work.
import { register, H } from "../engine.js";

const CN = 'Science', CE = 'Economy', CSA = 'Society';
const N = (U, v, d = 2) => { const r = Math.round(v * Math.pow(10, d)) / Math.pow(10, d); return U.fmtNum(r, Number.isInteger(r) ? 0 : d); };
const legend = (U, th, x, y, items, at) => items.map((it, k) => `<g opacity="0"${U.A('fade', at + k * 0.04, 0.05)}><rect x="${x}" y="${y + k * 46}" width="30" height="30" rx="5" fill="${it[1]}"/>${U.T(x + 44, y + k * 46 + 25, it[0], { a: 'start', s: 28, w: 600 })}</g>`).join('');
register('pendulum', {
  cat: CN, title: 'Pendulum', desc: 'A pendulum swinging back and forth, with its period worked out from its length.', use: 'Oscillation, gravity and the period of a swing.',
  params: 'length (meters), angle (degrees), g', example: { length: 1, angle: 30 },
  build(p, c) {
    const { U, th } = c, id = c.id, L = p.length ?? 1, g = p.g ?? 9.81, T = 2 * Math.PI * Math.sqrt(L / g);
    return U.bg() + `<rect x="700" y="200" width="520" height="16" rx="6" fill="${th.line}"/><path d="M960 216V780" stroke="${th.muted}" stroke-width="2" stroke-dasharray="8 8"/><path id="${id}rod" stroke="${th.ink}" stroke-width="5"/><circle id="${id}bob" r="44" fill="${th.accent}"/><circle cx="960" cy="216" r="10" fill="${th.ink}"/>` +
      `<g${U.A('left', 0.3, 0.08)}>${U.card(1320, 300, 440, 220, { f: th.surface, s: th.line, sw: 2 })}${U.T(1350, 370, 'T = 2π√(L/g)', { a: 'start', fam: 'd', s: 38, w: 700, f: th.accent })}${U.T(1350, 430, 'L = ' + N(U, L) + ' m', { a: 'start', s: 30 })}${U.T(1350, 480, 'T ≈ ' + N(U, T) + ' s', { a: 'start', fam: 'd', s: 36, w: 700 })}</g>`;
  },
  init(g, p, c) { return { rod: g.querySelector('#' + c.id + 'rod'), bob: g.querySelector('#' + c.id + 'bob'), T: 2 * Math.PI * Math.sqrt((p.length ?? 1) / (p.g ?? 9.81)) }; },
  render(l, st, p) { const th0 = ((p.angle ?? 30) * Math.PI) / 180, a = th0 * Math.cos((2 * Math.PI * l.t) / st.T), x = 960 + 540 * Math.sin(a), y = 216 + 540 * Math.cos(a); st.rod.setAttribute('d', `M960 216L${x.toFixed(1)} ${y.toFixed(1)}`); st.bob.setAttribute('cx', x.toFixed(1)); st.bob.setAttribute('cy', y.toFixed(1)); },
});
register('falling_objects', {
  cat: CN, title: 'Free fall', desc: 'A ball falls, and its position after each second is shown with the distance worked out from s = ½gt².', use: 'Acceleration, gravity and motion.',
  params: 'seconds (up to 5), g', example: { seconds: 4 },
  build(p, c) {
    const { U, th } = c, n = Math.min(5, p.seconds ?? 4), g = p.g ?? 9.81, smax = 0.5 * g * n * n, Y = (s) => 220 + (680 * s) / smax;
    let o = U.bg() + `<path d="M760 220V900" stroke="${th.line}" stroke-width="4"/>`;
    for (let t = 0; t <= n; t++) { const s = 0.5 * g * t * t, y = Y(s), at = 0.05 + (t / n) * 0.65; o += `<g${U.A('pop', at, 0.04, { cx: 960, cy: y })}><circle cx="960" cy="${y}" r="34" fill="${th.accent}" opacity="${t === n ? 1 : 0.55}"/></g>` + `<path d="M740 ${y}H780" stroke="${th.ink}" stroke-width="3"/>` + U.T(720, y + 10, t + ' s', { a: 'end', s: 30, w: 700, an: U.A('fade', at, 0.04) }) + U.T(1020, y + 10, N(U, s, 1) + ' m', { a: 'start', s: 30, f: th.accent, an: U.A('fade', at, 0.04) }); }
    return o + `<g${U.A('left', 0.75, 0.08)}>${U.card(1300, 300, 440, 160, { f: th.surface, s: th.line, sw: 2 })}${U.T(1330, 370, 's = ½ · g · t²', { a: 'start', fam: 'd', s: 40, w: 700, f: th.accent })}${U.T(1330, 425, 'g ≈ ' + N(U, g) + ' m/s²', { a: 'start', s: 28 })}</g>`;
  },
});
register('earth_layers', {
  cat: CN, title: 'Layers of the Earth', desc: 'A cut through the Earth with the crust, mantle, outer and inner core, and their depths.', use: 'What the Earth is made of, plate tectonics and volcanoes.',
  params: 'labels', example: {},
  build(p, c) {
    const { U, th } = c, cx = 760, cy = 560, L = [['Crust', '5–70 km thick', 300, '#7a5a3a'], ['Mantle', 'down to about 2,900 km', 288, '#d0603a'], ['Outer core', 'liquid, to about 5,150 km', 160, '#f0a040'], ['Inner core', 'solid, to about 6,371 km', 74, '#ffe08a']];
    return U.bg() + L.map((q, k) => `<g${U.A('pop', 0.05 + k * 0.12, 0.06, { cx, cy })}><circle cx="${cx}" cy="${cy}" r="${q[2]}" fill="${q[3]}"/></g>`).join('') + `<path d="M${cx} ${cy}L${cx + 320} ${cy - 320}V${cy}Z" fill="${th.bg}" opacity="0"/>` +
      L.map((q, k) => { const y = 300 + k * 140, r = q[2] - (k ? 20 : 4), ex = cx + r * Math.cos(-0.35), ey = cy + r * Math.sin(-0.35) + (k - 1.5) * 30; return `<g opacity="0"${U.A('fade', 0.5 + k * 0.08, 0.06)}><path d="M${ex.toFixed(0)} ${ey.toFixed(0)}L1180 ${y - 10}" stroke="${th.muted}" stroke-width="3"/><circle cx="${ex.toFixed(0)}" cy="${ey.toFixed(0)}" r="7" fill="${th.ink}"/>${U.T(1200, y, q[0], { a: 'start', fam: 'd', s: 44, w: 700 })}${U.T(1200, y + 40, q[1], { a: 'start', s: 28, f: th.muted })}</g>`; }).join('');
  },
});
register('dna_helix', {
  cat: CN, title: 'DNA helix', desc: 'A turning double helix with the base pairs A–T and C–G.', use: 'Heredity, genes and DNA.',
  params: 'label', example: { label: 'DNA' },
  build(p, c) {
    const { U, th } = c, id = c.id;
    let o = U.bg() + `<path id="${id}s1" fill="none" stroke="${th.accent}" stroke-width="10" stroke-linecap="round"/><path id="${id}s2" fill="none" stroke="${th.accent2}" stroke-width="10" stroke-linecap="round"/>`;
    for (let i = 0; i < 18; i++) o += `<path id="${id}r${i}" stroke-width="9" stroke-linecap="round"/>`;
    return o + U.T(1560, 420, p.label || 'DNA', { fam: 'd', s: 80, w: 700, f: th.ink, an: U.A('fade', 0.1, 0.06) }) + legend(U, th, 1450, 480, [['A – T', th.bad], ['C – G', th.ink]], 0.2);
  },
  init(g, p, c) { const q = (s) => g.querySelector('#' + c.id + s); return { s1: q('s1'), s2: q('s2'), R: Array.from({ length: 18 }, (_, i) => q('r' + i)) }; },
  render(l, st, p, c) {
    const ph = l.t * 1.4, X = (y, o) => 760 + 170 * Math.sin((y - 200) / 110 + ph + o); let d1 = '', d2 = '';
    for (let y = 200; y <= 920; y += 10) { d1 += (y === 200 ? 'M' : 'L') + X(y, 0).toFixed(1) + ' ' + y; d2 += (y === 200 ? 'M' : 'L') + X(y, Math.PI).toFixed(1) + ' ' + y; }
    st.s1.setAttribute('d', d1); st.s2.setAttribute('d', d2);
    st.R.forEach((el, i) => { const y = 220 + i * 40, a = X(y, 0), b = X(y, Math.PI); el.setAttribute('d', `M${a.toFixed(1)} ${y}L${b.toFixed(1)} ${y}`); el.setAttribute('stroke', i % 2 ? c.th.ink : c.th.bad); el.setAttribute('opacity', (0.45 + 0.55 * Math.abs(Math.cos((y - 200) / 110 + ph))).toFixed(2)); });
  },
});
register('punnett_square', {
  cat: CN, title: 'Punnett square', desc: 'A Punnett square where the parents’ alleles are combined, and the ratio between the traits is worked out.', use: 'Heredity, dominant and recessive genes.',
  params: 'p1, p2 (two letters, like "Aa"), dominant, recessive (names of the traits)', example: { p1: 'Aa', p2: 'Aa', dominant: 'Purple flowers', recessive: 'White flowers' },
  build(p, c) {
    const { U, th } = c, a = (p.p1 || 'Aa').split(''), b = (p.p2 || 'Aa').split(''), s = 200, x0 = 640, y0 = 340; let o = U.bg(), dom = 0;
    a.forEach((al, i) => { o += U.T(x0 - 60, y0 + i * s + s / 2 + 22, al, { fam: 'd', s: 70, w: 700, f: th.accent }); });
    b.forEach((al, j) => { o += U.T(x0 + j * s + s / 2, y0 - 40, al, { fam: 'd', s: 70, w: 700, f: th.accent2 }); });
    a.forEach((x, i) => b.forEach((y, j) => { const g = [x, y].sort((m) => (m === m.toUpperCase() ? -1 : 1)).join(''), d = g !== g.toLowerCase(); if (d) dom++; o += `<g${U.A('pop', 0.15 + (i * 2 + j) * 0.1, 0.05, { cx: x0 + j * s + s / 2, cy: y0 + i * s + s / 2 })}><rect x="${x0 + j * s + 6}" y="${y0 + i * s + 6}" width="${s - 12}" height="${s - 12}" rx="12" fill="${th.surface}" stroke="${d ? th.accent : th.accent2}" stroke-width="4"/>${U.T(x0 + j * s + s / 2, y0 + i * s + s / 2 + 26, g, { fam: 'd', s: 76, w: 700 })}</g>`; }));
    return o + `<g${U.A('left', 0.65, 0.08)}>${U.T(1180, 470, (p.dominant || 'Dominant') + ': ' + dom + ' of 4', { a: 'start', s: 36, w: 700, f: th.accent })}${U.T(1180, 530, (p.recessive || 'Recessive') + ': ' + (4 - dom) + ' of 4', { a: 'start', s: 36, w: 700, f: th.accent2 })}${U.T(1180, 610, 'Ratio ' + dom + ' : ' + (4 - dom), { a: 'start', fam: 'd', s: 48, w: 700 })}</g>`;
  },
});
register('scale_ladder', {
  cat: CN, title: 'Scale ladder', desc: 'An upright scale with a color gradient and marked points, and a pointer that can show one value.', use: 'The pH scale, decibels, temperatures, earthquakes and other scales.',
  params: 'title, min, max, marks: [{v, label}], value, colors: [bottom, top], unit', example: { title: 'The pH scale', min: 0, max: 14, marks: [{ v: 1, label: 'Stomach acid' }, { v: 3, label: 'Vinegar' }, { v: 7, label: 'Pure water' }, { v: 8, label: 'Seawater' }, { v: 12, label: 'Household ammonia' }], colors: ['#FF7A6B', '#4FC3B4'], value: 7 },
  build(p, c) {
    const { U, th } = c, id = c.id, Y = (v) => 880 - (640 * (v - p.min)) / (p.max - p.min), [c0, c1] = p.colors || [th.accent2, th.bad];
    let o = U.bg() + H.title(U, th, p.title, 190) + `<defs><linearGradient id="${id}g" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${c0}"/><stop offset="1" stop-color="${c1}"/></linearGradient></defs><rect x="800" y="240" width="90" height="640" rx="12" fill="url(#${id}g)"${U.A('grow', 0.04, 0.2, { cx: 845, cy: 880 })}/>`;
    const step = H.niceStep((p.max - p.min) / 7); for (let v = Math.ceil(p.min / step - 1e-9) * step; v <= p.max + 1e-9; v += step) o += U.T(780, Y(v) + 9, N(U, v, 1), { a: 'end', s: 24, f: th.muted });
    (p.marks || []).forEach((m, k) => { const y = Y(m.v), at = 0.25 + k * 0.08; o += `<g opacity="0"${U.A('fade', at, 0.05)}><path d="M890 ${y}H990" stroke="${th.ink}" stroke-width="3"/><circle cx="890" cy="${y}" r="8" fill="${th.ink}"/>${U.T(1004, y + 11, m.label + (m.v != null ? '  (' + N(U, m.v, 1) + (p.unit || '') + ')' : ''), { a: 'start', s: 32, w: 600 })}</g>`; });
    if (p.value != null) o += `<g${U.A('move', 0.7, 0.15, { x0: 0, y0: 880 - Y(p.value), x1: 0, y1: 0 })}><path d="M790 ${Y(p.value)}L740 ${Y(p.value) - 26}V${Y(p.value) + 26}Z" fill="${th.ink}"/></g>`;
    return o;
  },
});
register('greenhouse_effect', {
  cat: CN, title: 'Greenhouse effect', desc: 'Sunlight passes in through the atmosphere, the Earth gives off heat, and the greenhouse gases send some of the heat back.', use: 'Climate, the greenhouse effect and global warming.',
  params: 'labels', example: {},
  build(p, c) {
    const { U, th } = c, arr = (pts, col, at, w = 9) => { const d = 'M' + pts.map((q) => q.join(' ')).join('L'), len = H.polyLen(pts).toFixed(0), e = pts[pts.length - 1], b = pts[pts.length - 2], a = Math.atan2(e[1] - b[1], e[0] - b[0]); return `<path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${len}" stroke-dashoffset="${len}"${U.A('draw', at, 0.12, { l: len })}/><path d="M${e[0]} ${e[1]}l${(-26 * Math.cos(a) - 14 * Math.sin(a)).toFixed(1)} ${(-26 * Math.sin(a) + 14 * Math.cos(a)).toFixed(1)}l${(28 * Math.sin(a)).toFixed(1)} ${(-28 * Math.cos(a)).toFixed(1)}Z" fill="${col}" opacity="0"${U.A('fade', at + 0.11, 0.02)}/>`; };
    return U.bg() + `<circle cx="260" cy="220" r="80" fill="${th.accent}"/><path d="M-300 980Q960 620 2220 980V1600H-300Z" fill="${th.good}" fill-opacity=".6" data-fm-bg="1"/><path d="M-300 600Q960 260 2220 600" fill="none" stroke="${th.accent2}" stroke-width="40" stroke-opacity=".35" data-fm-bg="1"/>` +
      U.T(1500, 400, 'Atmosphere with greenhouse gases', { s: 30, w: 700, f: th.accent2, an: U.A('fade', 0.02, 0.06) }) + U.T(960, 880, 'Earth', { s: 34, w: 700 }) +
      arr([[340, 280], [760, 790]], th.accent, 0.08) + U.T(440, 470, 'Sunlight in', { a: 'end', s: 30, w: 700, f: th.accent, an: U.A('fade', 0.12, 0.05) }) +
      arr([[900, 800], [1050, 520], [1150, 250]], th.bad, 0.35) + U.T(1180, 230, 'Some heat escapes', { a: 'start', s: 28, w: 600, f: th.bad, an: U.A('fade', 0.45, 0.05) }) +
      arr([[1150, 790], [1300, 470], [1440, 760]], th.bad, 0.55) + U.T(1480, 720, 'Some heat is sent back', { a: 'start', s: 28, w: 600, f: th.bad, an: U.A('fade', 0.66, 0.05) });
  },
});
register('seasons', {
  cat: CN, title: 'Seasons', desc: 'The Earth orbiting the Sun on its tilted axis. The seasons come from the northern and southern halves leaning toward or away from the Sun.', use: 'Seasons, the Earth’s axis and daylight.',
  params: 'labels, note', example: { note: 'The Earth’s axis is tilted about 23.4°' },
  build(p, c) {
    const { U, th } = c, pos = [[1500, 560, 'June: summer in the north'], [960, 860, 'September: autumn in the north'], [420, 560, 'December: winter in the north'], [960, 260, 'March: spring in the north']];
    return U.bg() + `<ellipse cx="960" cy="560" rx="540" ry="300" fill="none" stroke="${th.line}" stroke-width="3" stroke-dasharray="10 10"/><circle cx="960" cy="560" r="90" fill="${th.accent}"/>` + U.T(960, 572, 'Sun', { s: 30, w: 700, f: th.bg }) +
      pos.map(([x, y, t], k) => { const at = 0.1 + k * 0.15, sunSide = x < 960 ? 1 : x > 960 ? -1 : 0; return `<g${U.A('pop', at, 0.06, { cx: x, cy: y })}><circle cx="${x}" cy="${y}" r="56" fill="${th.accent2}"/><path d="M${x} ${y - 56}A56 56 0 0 ${sunSide >= 0 ? 1 : 0} ${x} ${y + 56}Z" fill="#000" opacity=".35" transform="rotate(${sunSide === 0 ? (y < 560 ? 90 : -90) : 0} ${x} ${y})"/><path d="M${x + 30} ${y - 82}L${x - 30} ${y + 82}" stroke="${th.ink}" stroke-width="4"/></g>` + U.T(x, y + (y > 560 ? 110 : y < 560 ? -86 : 110), t, { s: 28, w: 700, an: U.A('fade', at + 0.04, 0.05) }); }).join('') +
      // The tilt is shown only as a note given in the params, since no source of the video may back it.
      (p.note ? U.T(160, 930, p.note, { a: 'start', s: 26, f: th.muted, an: U.A('fade', 0.75, 0.06) }) : '');
  },
});
register('magnet_field', {
  cat: CN, title: 'Magnetic field', desc: 'A bar magnet with a north and a south pole, and field lines that draw from north to south.', use: 'Magnetism, compasses and the Earth’s magnetic field.',
  params: 'lines (field lines on each side), note', example: { lines: 4, note: 'Outside the magnet, the field lines run from the north pole to the south pole' },
  build(p, c) {
    const { U, th } = c, n = p.lines ?? 4;
    let o = U.bg();
    for (let k = 1; k <= n; k++) { const h = 70 + k * 75, w = 300 + k * 90, len = (Math.PI * (w + h)).toFixed(0); [-1, 1].forEach((sgn, j) => { o += `<path d="M770 540C${770 - w * 0.6} ${540 + sgn * h * 1.3} ${1150 + w * 0.6} ${540 + sgn * h * 1.3} 1150 540" fill="none" stroke="${th.accent}" stroke-width="3" stroke-dasharray="${len}" stroke-dashoffset="${len}"${U.A('draw', 0.2 + k * 0.08 + j * 0.03, 0.2, { l: len })}/>`; }); }
    return o + `<rect x="760" y="490" width="200" height="100" fill="#e0473a"/><rect x="960" y="490" width="200" height="100" fill="#3f6fd8"/>` + U.T(860, 560, 'N', { fam: 'd', s: 60, w: 700, f: '#fff' }) + U.T(1060, 560, 'S', { fam: 'd', s: 60, w: 700, f: '#fff' }) + (p.note ? U.T(960, 920, p.note, { s: 30, f: th.muted, an: U.A('fade', 0.7, 0.06) }) : '');
  },
});
register('cell_diagram', {
  cat: CN, title: 'Cell', desc: 'A diagram of an animal or plant cell where the parts are labeled one by one.', use: 'Cells, organelles and the difference between plant and animal cells.',
  params: 'kind: animal|plant', example: { kind: 'plant' },
  build(p, c) {
    const { U, th } = c, plant = p.kind === 'plant', cx = 760, cy = 560, parts = [];
    let o = U.bg();
    if (plant) { o += `<rect x="360" y="230" width="800" height="660" rx="60" fill="${th.good}" fill-opacity=".25" stroke="${th.good}" stroke-width="14"/><rect x="380" y="250" width="760" height="620" rx="48" fill="none" stroke="${th.good}" stroke-width="4"/><rect x="620" y="330" width="380" height="380" rx="80" fill="${th.muted}" fill-opacity=".25" stroke="${th.muted}" stroke-width="4"/>`; parts.push([380, 400, 'Cell wall'], [800, 520, 'Vacuole']); [[480, 360], [470, 760], [1060, 780], [1060, 330]].forEach(([x, y]) => (o += `<ellipse cx="${x}" cy="${y}" rx="44" ry="24" fill="${th.good}"/>`)); parts.push([480, 360, 'Chloroplast']); }
    else { o += `<ellipse cx="${cx}" cy="${cy}" rx="420" ry="320" fill="${th.accent}" fill-opacity=".14" stroke="${th.accent}" stroke-width="6"/>`; parts.push([cx + 410, cy + 60, 'Cell membrane']); }
    o += `<circle cx="${plant ? 500 : 760}" cy="${plant ? 560 : 540}" r="90" fill="${th.accent}" fill-opacity=".5" stroke="${th.accent}" stroke-width="4"/>`; parts.push([plant ? 500 : 760, plant ? 560 : 540, 'Nucleus']);
    [[plant ? 1000 : 1000, plant ? 640 : 420], [plant ? 760 : 560, plant ? 800 : 700]].forEach(([x, y], k) => { o += `<ellipse cx="${x}" cy="${y}" rx="60" ry="30" fill="${th.bad}" fill-opacity=".6"/><path d="M${x - 40} ${y}q10 -16 20 0t20 0t20 0t20 0" fill="none" stroke="${th.bad}" stroke-width="3"/>`; if (!k) parts.push([x, y, 'Mitochondrion']); });
    return o + parts.map(([x, y, t], k) => { const ty = 260 + k * 120, at = 0.25 + k * 0.1; return `<g opacity="0"${U.A('fade', at, 0.05)}><path d="M${x} ${y}L1260 ${ty - 10}H1300" stroke="${th.muted}" stroke-width="3" fill="none"/><circle cx="${x}" cy="${y}" r="7" fill="${th.ink}"/>${U.T(1310, ty, t, { a: 'start', s: 36, w: 700 })}</g>`; }).join('');
  },
});
register('supply_demand', {
  cat: CE, title: 'Supply and demand', desc: 'The supply and demand curves cross at the equilibrium. Demand can shift, and the new equilibrium is shown.', use: 'How prices are set, markets, and what happens when demand changes.',
  params: 'shift (shift in demand, like 120 or −120), at', example: { shift: 140 },
  build(p, c) {
    const { U, th } = c, L = 420, R = 1320, T = 200, B = 880, sh = p.shift ?? 0, at = p.at ?? 0.55;
    const inter = (dx) => { const x = (L + 100 + R - 100 + dx) / 2, y = (T + 80 + B - 80) / 2 - dx / 2; return [x, y]; };
    const e0 = inter(0), e1 = inter(sh);
    let o = U.bg() + H.arrow(U, th.ink, L, B, L, T - 40, 0.02, 4) + H.arrow(U, th.ink, L, B, R + 60, B, 0.02, 4) + U.T(L - 20, T - 50, 'Price', { a: 'end', s: 30, w: 700 }) + U.T(R + 60, B + 50, 'Quantity', { a: 'end', s: 30, w: 700 }) +
      H.line(U, L + 100, T + 80, R - 100, B - 80, th.accent, 7, 0.08, 0.15) + U.T(R - 90, B - 90, 'Demand', { a: 'start', s: 30, w: 700, f: th.accent }) +
      H.line(U, L + 100, B - 80, R - 100, T + 80, th.accent2, 7, 0.2, 0.15) + U.T(R - 90, T + 80, 'Supply', { a: 'start', s: 30, w: 700, f: th.accent2 }) +
      `<g opacity="0"${U.A('fade', 0.38, 0.06)}><path d="M${e0[0]} ${e0[1]}V${B}M${e0[0]} ${e0[1]}H${L}" stroke="${th.muted}" stroke-width="3" stroke-dasharray="10 8"/><circle cx="${e0[0]}" cy="${e0[1]}" r="14" fill="${th.ink}"/>${U.T(L - 14, e0[1] + 10, 'P₁', { a: 'end', s: 30, w: 700 })}${U.T(e0[0], B + 44, 'Q₁', { s: 30, w: 700 })}</g>`;
    if (sh) o += `<g opacity="0"${U.A('fade', at, 0.05)}><g${U.A('move', at, 0.15, { x0: 0, y0: 0, x1: sh, y1: 0 })}><path d="M${L + 100} ${T + 80}L${R - 100} ${B - 80}" stroke="${th.accent}" stroke-width="7" stroke-dasharray="16 10"/></g></g>` +
      `<g opacity="0"${U.A('fade', at + 0.18, 0.06)}><path d="M${e1[0]} ${e1[1]}V${B}M${e1[0]} ${e1[1]}H${L}" stroke="${th.bad}" stroke-width="3" stroke-dasharray="10 8"/><circle cx="${e1[0]}" cy="${e1[1]}" r="14" fill="${th.bad}"/>${U.T(L - 14, e1[1] + 10, 'P₂', { a: 'end', s: 30, w: 700, f: th.bad })}${U.T(e1[0], B + 44, 'Q₂', { s: 30, w: 700, f: th.bad })}</g>` + U.T(1500, 400, sh > 0 ? 'Higher demand:' : 'Lower demand:', { a: 'start', s: 32, w: 700, an: U.A('fade', at + 0.2, 0.06) }) + U.T(1500, 450, sh > 0 ? 'higher price and quantity' : 'lower price and quantity', { a: 'start', s: 30, f: th.muted, an: U.A('fade', at + 0.22, 0.06) });
    return o;
  },
});
register('waterfall_chart', {
  cat: CE, title: 'Waterfall chart', desc: 'Bars that show how an amount changes step by step, with rises and falls in their own colors.', use: 'Budgets, accounts and how something has changed.',
  params: 'start: {label, value}, steps: [{label, value}], endLabel, unit', example: { start: { label: 'Pay', value: 30000 }, steps: [{ label: 'Tax', value: -9000 }, { label: 'Rent', value: -11000 }, { label: 'Food', value: -5000 }, { label: 'Side job', value: 3000 }], endLabel: 'Left over', unit: ' USD' },
  build(p, c) {
    const { U, th } = c, S = p.steps || [], all = [p.start.value]; let run = p.start.value; S.forEach((s) => { run += s.value; all.push(run); });
    const sep = Math.max(...all.map(Math.abs), ...S.map((s) => Math.abs(s.value))) >= 10000 ? 'always' : '', max = Math.max(...all) * 1.1, base = 840, Hh = (v) => (560 * v) / max, n = S.length + 2, w = 1400 / n;
    let o = U.bg() + `<path d="M240 ${base}H1700" stroke="${th.line}" stroke-width="3"/>`, cur = p.start.value;
    const bar = (k, y0, y1, col, label, val, at) => { const x = 260 + k * w; return `<rect x="${x}" y="${Math.min(y0, y1)}" width="${w * 0.7}" height="${Math.abs(y1 - y0)}" rx="4" fill="${col}"${U.A('grow', at, 0.08, { cx: x, cy: y0 })}/>` + U.T(x + w * 0.35, Math.min(y0, y1) - 16, val, { s: 26, w: 700, an: U.A('fade', at + 0.06, 0.04) }) + U.T(x + w * 0.35, base + 40, label, { s: 26, f: th.muted }); };
    o += bar(0, base, base - Hh(cur), th.accent, p.start.label, U.fmtNum(cur, 0, sep) + (p.unit || ''), 0.06);
    S.forEach((s, k) => { const y0 = base - Hh(cur), nv = cur + s.value, y1 = base - Hh(nv); o += bar(k + 1, y0, y1, s.value >= 0 ? th.good : th.bad, s.label, (s.value >= 0 ? '+' : '−') + U.fmtNum(Math.abs(s.value), 0, sep), 0.15 + k * 0.1); cur = nv; });
    return o + bar(n - 1, base, base - Hh(cur), th.accent2, p.endLabel || 'Total', U.fmtNum(cur, 0, sep) + (p.unit || ''), 0.2 + S.length * 0.1);
  },
});
register('stacked_bar', {
  cat: CE, title: 'Stacked bars', desc: 'Bars split into colors by category, with a legend.', use: 'What a whole is made of, and how the mix changes.',
  params: 'categories: [name], series: [{name, values: [number], color}], unit, title', example: { title: 'Example data: hours per day', categories: ['Monday', 'Wednesday', 'Saturday'], series: [{ name: 'School', values: [6, 6, 0] }, { name: 'Screens', values: [3, 4, 6] }, { name: 'Exercise', values: [1, 1, 2] }] },
  build(p, c) {
    const { U, th } = c, C = p.categories || [], S = p.series || [], cols = th.series, tot = C.map((_, i) => S.reduce((s, q) => s + (q.values[i] || 0), 0)), max = Math.max(...tot) * 1.1, base = 860, w = 1100 / Math.max(1, C.length);
    let o = U.bg() + H.title(U, th, p.title, 210) + `<path d="M240 ${base}H1400" stroke="${th.line}" stroke-width="3"/>`;
    C.forEach((cat, i) => { let y = base; const x = 280 + i * w; S.forEach((q, k) => { const h = (560 * (q.values[i] || 0)) / max; if (h > 0) o += `<rect x="${x}" y="${y - h}" width="${w * 0.6}" height="${h}" fill="${q.color || cols[k % cols.length]}" stroke="${th.bg}" stroke-width="3"${U.A('grow', 0.1 + i * 0.12 + k * 0.05, 0.08, { cx: x, cy: y })}/>`; y -= h; }); o += U.T(x + w * 0.3, base + 44, cat, { s: 30, f: th.muted }) + U.T(x + w * 0.3, y - 16, N(U, tot[i], 1) + (p.unit || ''), { s: 28, w: 700, an: U.A('fade', 0.4 + i * 0.12, 0.05) }); });
    return o + legend(U, th, 1480, 360, S.map((q, k) => [q.name, q.color || cols[k % cols.length]]), 0.3);
  },
});
register('receipt', {
  cat: CE, title: 'Receipt', desc: 'A receipt that prints line by line, with the total at the end.', use: 'Prices, a shopping basket, a budget or inflation.',
  params: 'title, items: [{label, price}], currency', example: { title: 'Shopping basket (example prices)', items: [{ label: 'Bread', price: 3.99 }, { label: 'Milk, 1 l', price: 1.45 }, { label: 'Eggs, 12', price: 4.2 }, { label: 'Cheese', price: 7.5 }], currency: 'USD' },
  build(p, c) {
    const { U, th } = c, I = p.items || [], tot = I.reduce((s, q) => s + q.price, 0), h = 260 + I.length * 64;
    return U.bg() + `<g${U.A('up', 0.02, 0.08)}><path d="M720 ${540 - h / 2}H1200V${540 + h / 2}l-24 -18l-24 18l-24 -18l-24 18l-24 -18l-24 18l-24 -18l-24 18l-24 -18l-24 18l-24 -18l-24 18l-24 -18l-24 18l-24 -18l-24 18l-24 -18l-24 18l-24 -18l-24 18Z" fill="${th.paper}" stroke="${th.line}"/></g>` +
      U.T(960, 540 - h / 2 + 70, p.title || 'Receipt', { s: Math.min(30, 420 / Math.max(0.01, U.tw(p.title || 'Receipt', 1, { w: 700 }))), w: 700, f: th.paperInk, an: U.A('fade', 0.06, 0.05) }) +
      I.map((q, k) => `<g${U.A('fade', 0.12 + k * 0.1, 0.05)} opacity="0">${U.T(770, 540 - h / 2 + 150 + k * 64, q.label, { a: 'start', s: 32, f: th.paperInk })}${U.T(1150, 540 - h / 2 + 150 + k * 64, U.fmtNum(q.price, 2), { a: 'end', s: 32, f: th.paperInk })}</g>`).join('') +
      `<path d="M760 ${540 + h / 2 - 90}H1160" stroke="${th.paperInk}" stroke-width="2" stroke-dasharray="6 6"/>` + U.T(770, 540 + h / 2 - 40, 'Total', { a: 'start', s: 36, w: 700, f: th.paperInk, an: U.A('fade', 0.2 + I.length * 0.1, 0.05) }) + U.T(1150, 540 + h / 2 - 40, U.fmtNum(tot, 2) + (p.currency ? ' ' + p.currency : ''), { a: 'end', s: 36, w: 700, f: th.paperInk, an: U.A('fade', 0.2 + I.length * 0.1, 0.05) });
  },
});
register('parliament_seats', {
  cat: CSA, title: 'Parliament seats', desc: 'The seats of an assembly in a half circle, colored by party, with the number needed for a majority.', use: 'Election results, majorities and coalitions.',
  params: 'parties: [{name, seats, color}], majority, title', example: { title: 'Example data: 169 seats', parties: [{ name: 'Party A', seats: 48 }, { name: 'Party B', seats: 36 }, { name: 'Party C', seats: 30 }, { name: 'Party D', seats: 22 }, { name: 'Party E', seats: 18 }, { name: 'Party F', seats: 15 }] },
  build(p, c) {
    const { U, th } = c, P = p.parties || [], tot = P.reduce((s, q) => s + q.seats, 0), maj = p.majority ?? Math.floor(tot / 2) + 1, cols = th.series;
    const rows = Math.max(4, Math.round(Math.sqrt(tot / 2.2))), seats = [];
    for (let r = 0; r < rows; r++) { const R = 260 + r * (420 / rows), nr = Math.round((tot * R) / (rows * (260 + (420 * (rows - 1)) / rows / 2) + 1e-9)); seats.push({ R, n: nr }); }
    let sum = seats.reduce((s, q) => s + q.n, 0); while (sum !== tot) { const k = sum < tot ? rows - 1 : 0; seats[k].n += sum < tot ? 1 : -1; sum += sum < tot ? 1 : -1; }
    const pos = []; seats.forEach((q) => { for (let i = 0; i < q.n; i++) { const a = Math.PI - (Math.PI * (i + 0.5)) / q.n; pos.push([960 + q.R * Math.cos(a), 840 - q.R * Math.sin(a), a]); } });
    pos.sort((x, y) => y[2] - x[2]);
    let o = U.bg() + H.title(U, th, p.title, 140), k = 0;
    P.forEach((q, pi) => { for (let i = 0; i < q.seats; i++, k++) { const s = pos[k]; if (s) o += `<circle cx="${s[0].toFixed(1)}" cy="${s[1].toFixed(1)}" r="${Math.min(18, 300 / rows / 2.3).toFixed(1)}" fill="${q.color || cols[pi % cols.length]}" opacity="0"${U.A('fade', 0.06 + (k / tot) * 0.55, 0.03)}/>`; } });
    return o + U.T(960, 820, String(tot), { fam: 'd', s: 90, w: 700 }) + U.T(960, 870, 'Majority: ' + maj, { s: 30, f: th.muted }) + P.map((q, pi) => { const per = Math.min(P.length, 6), rowsL = Math.ceil(P.length / per), lx = 170 + (pi % per) * (1600 / per), ly = 922 - (rowsL - 1 - Math.floor(pi / per)) * 40; return `<g opacity="0"${U.A('fade', 0.65 + pi * 0.03, 0.05)}><circle cx="${lx}" cy="${ly - 8}" r="12" fill="${q.color || cols[pi % cols.length]}"/>${U.T(lx + 22, ly + 2, q.name + ' ' + q.seats, { a: 'start', s: 24, w: 600 })}</g>`; }).join('');
  },
});
register('population_pyramid', {
  cat: CSA, title: 'Population pyramid', desc: 'Men on the left and women on the right in each age group, with bars growing out from the middle.', use: 'The age make-up of a population, birth rates and ageing.',
  params: 'groups: [{age, men, women}] (youngest first), title, leftLabel, rightLabel', example: { title: 'Example data (thousands)', groups: [{ age: '0–19', men: 580, women: 550 }, { age: '20–39', men: 720, women: 690 }, { age: '40–59', men: 700, women: 680 }, { age: '60–79', men: 520, women: 540 }, { age: '80+', men: 110, women: 160 }] },
  build(p, c) {
    const { U, th } = c, G = p.groups || [], max = Math.max(...G.flatMap((g) => [g.men, g.women])) * 1.1, sep = max >= 11000 ? 'always' : '', n = G.length, rh = Math.min(110, 620 / n), base = 860;
    let o = U.bg() + H.title(U, th, p.title, 190) + U.T(560, 270, p.leftLabel || 'Men', { s: 34, w: 700, f: th.accent }) + U.T(1360, 270, p.rightLabel || 'Women', { s: 34, w: 700, f: th.accent2 });
    G.forEach((g, k) => { const y = base - (k + 1) * rh, wm = (620 * g.men) / max, ww = (620 * g.women) / max, at = 0.08 + k * 0.08; o += `<rect x="${880 - wm}" y="${y + 6}" width="${wm}" height="${rh - 12}" rx="4" fill="${th.accent}"${U.A('grow', at, 0.1, { ax: 'x', cx: 880, cy: y })}/><rect x="1040" y="${y + 6}" width="${ww}" height="${rh - 12}" rx="4" fill="${th.accent2}"${U.A('grow', at, 0.1, { ax: 'x', cx: 1040, cy: y })}/>` + U.T(960, y + rh / 2 + 10, g.age, { s: 26, w: 700 }) + U.T(870 - wm, y + rh / 2 + 10, U.fmtNum(g.men, 0, sep), { a: 'end', s: 22, f: th.muted, an: U.A('fade', at + 0.08, 0.04) }) + U.T(1050 + ww, y + rh / 2 + 10, U.fmtNum(g.women, 0, sep), { a: 'start', s: 22, f: th.muted, an: U.A('fade', at + 0.08, 0.04) }); });
    return o;
  },
});
register('poll_with_margin', {
  cat: CSA, title: 'Poll with margin of error', desc: 'A bar for each option, with a margin of error that shows the uncertainty.', use: 'Opinion polls, surveys and uncertainty.',
  params: 'items: [{label, value, margin}], unit, title, note', example: { title: 'Example data: support in percent', items: [{ label: 'Party A', value: 27, margin: 2.6 }, { label: 'Party B', value: 22, margin: 2.4 }, { label: 'Party C', value: 14, margin: 2 }, { label: 'Party D', value: 9, margin: 1.7 }], unit: '%', note: 'The margin of error shows how far off a number can be' },
  build(p, c) {
    const { U, th } = c, I = p.items || [], max = Math.max(...I.map((q) => q.value + (q.margin || 0))) * 1.15, rh = Math.min(120, 560 / Math.max(1, I.length)), X = (v) => 560 + (1100 * v) / max;
    return U.bg() + H.title(U, th, p.title, 210) + I.map((q, k) => { const y = 300 + k * rh, at = 0.1 + k * 0.1; return U.T(530, y + rh * 0.45, q.label, { a: 'end', s: 32, w: 600 }) + `<rect x="560" y="${y}" width="${X(q.value) - 560}" height="${rh * 0.6}" rx="6" fill="${th.accent}"${U.A('grow', at, 0.12, { ax: 'x', cx: 560, cy: y })}/>` +
      `<g opacity="0"${U.A('fade', at + 0.14, 0.05)}><path d="M${X(q.value - (q.margin || 0))} ${y + rh * 0.3}H${X(q.value + (q.margin || 0))}M${X(q.value - (q.margin || 0))} ${y + rh * 0.12}V${y + rh * 0.48}M${X(q.value + (q.margin || 0))} ${y + rh * 0.12}V${y + rh * 0.48}" stroke="${th.ink}" stroke-width="4"/>${U.T(X(q.value + (q.margin || 0)) + 16, y + rh * 0.42, N(U, q.value, 1) + (p.unit || '') + ' ± ' + N(U, q.margin || 0, 1), { a: 'start', s: 26, w: 700 })}</g>`; }).join('') + (p.note ? U.T(960, 920, p.note, { s: 28, f: th.muted, an: U.A('fade', 0.6, 0.06) }) : '');
  },
});
register('split_bar', {
  cat: CSA, title: 'Yes or no', desc: 'One bar split between two sides, with the percentage on each side and a line at 50 percent.', use: 'Referendums, two choices and majorities.',
  params: 'left: {label, value}, right: {label, value}, title, unit', example: { title: 'Referendum (example data)', left: { label: 'Yes', value: 47.8 }, right: { label: 'No', value: 52.2 }, unit: '%' },
  build(p, c) {
    const { U, th } = c, L = p.left || {}, R = p.right || {}, tot = (L.value || 0) + (R.value || 0) || 1, w = (1400 * (L.value || 0)) / tot;
    return U.bg() + H.title(U, th, p.title, 290) + `<rect x="260" y="460" width="${w}" height="160" fill="${th.good}"${U.A('grow', 0.12, 0.3, { ax: 'x', cx: 260, cy: 540 })}/><rect x="${260 + w}" y="460" width="${1400 - w}" height="160" fill="${th.bad}"${U.A('grow', 0.12, 0.3, { ax: 'x', cx: 1660, cy: 540 })}/>` +
      `<path d="M960 420V660" stroke="${th.ink}" stroke-width="4" stroke-dasharray="10 8"/>` + U.T(960, 410, '50%', { s: 24, f: th.muted }) +
      U.T(300, 730, L.label || '', { a: 'start', s: 40, w: 700, f: th.good }) + U.T(300, 810, '0', { a: 'start', fam: 'd', s: 80, w: 700, f: th.good, an: U.A('count', 0.12, 0.3, { from: 0, to: L.value || 0, dec: 1, suf: p.unit || '' }) }) +
      U.T(1620, 730, R.label || '', { a: 'end', s: 40, w: 700, f: th.bad }) + U.T(1620, 810, '0', { a: 'end', fam: 'd', s: 80, w: 700, f: th.bad, an: U.A('count', 0.12, 0.3, { from: 0, to: R.value || 0, dec: 1, suf: p.unit || '' }) });
  },
});
