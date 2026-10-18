// Templates for science, part 1: Trym's code from his film engine (the science half of templates/stat_naturfag.js),
// adapted for Meko with English text and the Night atlas theme. See ../engine.js for how templates work.
import { register, H } from "../engine.js";

const CN = 'Science';
const N = (U, v, d = 2) => { const r = Math.round(v * Math.pow(10, d)) / Math.pow(10, d); return U.fmtNum(r, Number.isInteger(r) ? 0 : d); };
register('atom_model', {
  cat: CN, title: 'Atom model', desc: 'A nucleus of protons and neutrons, and electron shells with the electrons in orbit.', use: 'Atoms, elements and electron shells.',
  params: 'symbol, name, protons, neutrons, shells: [electrons in each shell]', example: { symbol: 'Na', name: 'Sodium', protons: 11, neutrons: 12, shells: [2, 8, 1] },
  build(p, c) {
    const { U, th } = c, id = c.id, cx = 720, cy = 560, S = p.shells || [2, 8, 1], r = H.rng(p.protons || 11), nuc = (p.protons || 0) + (p.neutrons || 0);
    let o = U.bg();
    S.forEach((n, k) => { const R = 130 + k * 85; o += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${th.line}" stroke-width="3" opacity="0"${U.A('fade', 0.1 + k * 0.08, 0.06)}/>`; for (let e = 0; e < n; e++) o += `<circle id="${id}e${k}_${e}" r="13" fill="${th.accent2}" opacity="0"${U.A('fade', 0.2 + k * 0.08, 0.06)}/>`; });
    for (let i = 0; i < Math.min(40, nuc); i++) { const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 52; o += `<circle cx="${(cx + d * Math.cos(a)).toFixed(1)}" cy="${(cy + d * Math.sin(a)).toFixed(1)}" r="15" fill="${i < (p.protons || 0) ? th.bad : th.muted}" stroke="${th.bg}" stroke-width="2"${U.A('pop', 0.04 + i * 0.004, 0.04, { cx, cy })}/>`; }
    return o + `<g${U.A('left', 0.5, 0.08)}>${U.card(1240, 300, 420, 300, { f: th.surface, s: th.line, sw: 2 })}${U.T(1450, 420, p.symbol || '', { fam: 'd', s: 100, w: 700, f: th.accent })}${U.T(1450, 480, p.name || '', { s: 34, w: 700 })}${U.T(1450, 530, (p.protons || 0) + ' protons, ' + (p.neutrons || 0) + ' neutrons', { s: 24, f: th.muted })}${U.T(1450, 566, 'Electrons: ' + S.join(', '), { s: 24, f: th.muted })}</g>`;
  },
  init(g, p, c) { return { S: (p.shells || [2, 8, 1]).map((n, k) => Array.from({ length: n }, (_, e) => g.querySelector('#' + c.id + 'e' + k + '_' + e))) }; },
  render(l, st) { st.S.forEach((sh, k) => { const R = 130 + k * 85, w = 0.9 / (k + 1); sh.forEach((el, e) => { const a = (2 * Math.PI * e) / sh.length + l.t * w; el.setAttribute('cx', (720 + R * Math.cos(a)).toFixed(1)); el.setAttribute('cy', (560 + R * Math.sin(a)).toFixed(1)); }); }); },
});
const MOL = {
  H2O: { name: 'Water', atoms: [['O', 0, 0], ['H', -150, 110], ['H', 150, 110]], bonds: [[0, 1, 1], [0, 2, 1]] },
  CO2: { name: 'Carbon dioxide', atoms: [['C', 0, 0], ['O', -230, 0], ['O', 230, 0]], bonds: [[0, 1, 2], [0, 2, 2]] },
  CH4: { name: 'Methane', atoms: [['C', 0, 0], ['H', 0, -190], ['H', 0, 190], ['H', -190, 0], ['H', 190, 0]], bonds: [[0, 1, 1], [0, 2, 1], [0, 3, 1], [0, 4, 1]] },
  O2: { name: 'Oxygen', atoms: [['O', -110, 0], ['O', 110, 0]], bonds: [[0, 1, 2]] },
  NH3: { name: 'Ammonia', atoms: [['N', 0, -30], ['H', -160, 90], ['H', 160, 90], ['H', 0, 170]], bonds: [[0, 1, 1], [0, 2, 1], [0, 3, 1]] },
};
register('molecule', {
  cat: CN, title: 'Molecule', desc: 'Atoms as balls and bonds as lines, with the name and formula. Knows water, carbon dioxide, methane, oxygen and ammonia, or takes its own atoms.', use: 'Chemical substances and bonds.',
  params: 'formula: H2O|CO2|CH4|O2|NH3, or atoms: [[symbol, x, y]], bonds: [[i, j, count]], name', example: { formula: 'H2O' },
  build(p, c) {
    const { U, th } = c, M = MOL[p.formula] || { name: p.name || '', atoms: p.atoms || [], bonds: p.bonds || [] }, col = { H: '#f2f2f2', O: '#e04a3f', C: '#5e6d83', N: '#3f6fd8', Na: '#9b6bd6', Cl: '#3fbf5f' }, rad = { H: 52, O: 78, C: 74, N: 76 }, cx = 860, cy = 560;
    let o = U.bg();
    M.bonds.forEach(([a, b, n], k) => { const A = M.atoms[a], B = M.atoms[b], dx = B[1] - A[1], dy = B[2] - A[2], L = Math.hypot(dx, dy), ox = (-dy / L) * 14, oy = (dx / L) * 14; for (let i = 0; i < n; i++) { const off = n > 1 ? (i - 0.5) * 2 : 0; o += H.line(U, cx + A[1] + ox * off, cy + A[2] + oy * off, cx + B[1] + ox * off, cy + B[2] + oy * off, th.muted, 12, 0.3 + k * 0.05); } });
    M.atoms.forEach(([s, x, y], k) => { const R = rad[s] || 70; o += `<g${U.A('pop', 0.05 + k * 0.06, 0.05, { cx: cx + x, cy: cy + y })}><circle cx="${cx + x}" cy="${cy + y}" r="${R}" fill="${col[s] || th.accent}" stroke="${th.ink}" stroke-opacity=".3" stroke-width="3"/><circle cx="${cx + x - R * 0.3}" cy="${cy + y - R * 0.3}" r="${R * 0.25}" fill="#fff" opacity=".35"/>${U.T(cx + x, cy + y + 16, s, { fam: 'd', s: 46, w: 700, f: s === 'H' ? '#222' : '#fff' })}</g>`; });
    const f = p.formula ? p.formula.replace(/(\d)/g, (d) => '₀₁₂₃₄₅₆₇₈₉'[d]) : '';
    return o + U.T(1500, 520, f, { fam: 'd', s: 90, w: 700, f: th.accent, an: U.A('fade', 0.5, 0.06) }) + U.T(1500, 590, M.name, { s: 40, w: 600, an: U.A('fade', 0.55, 0.06) });
  },
});
register('element_card', {
  cat: CN, title: 'Element card', desc: 'A square from the periodic table with the symbol, name, atomic number and atomic mass.', use: 'Introducing an element.',
  params: 'symbol, name, number, mass, group, facts: [text]', example: { symbol: 'O', name: 'Oxygen', number: 8, mass: '16.00', group: 'Non-metal', facts: ['Makes up about 21% of the air', 'Needed for burning and breathing'] },
  build(p, c) {
    const { U, th } = c;
    return U.bg() + `<g${U.A('pop', 0.04, 0.07, { cx: 660, cy: 540 })}>${U.card(420, 270, 480, 540, { f: th.surface, s: th.accent, sw: 8 })}${U.T(460, 350, String(p.number ?? ''), { a: 'start', fam: 'd', s: 54, w: 700, f: th.muted })}${U.T(660, 620, p.symbol || '', { fam: 'd', s: 230, w: 700, f: th.accent })}${U.T(660, 700, p.name || '', { s: 44, w: 700 })}${U.T(660, 760, String(p.mass ?? ''), { s: 34, f: th.muted })}</g>` +
      (p.group ? U.T(1020, 380, p.group, { a: 'start', s: 40, w: 700, f: th.accent2, an: U.A('left', 0.2, 0.08) }) : '') + (p.facts || []).slice(0, 4).map((f, k) => `<g${U.A('left', 0.3 + k * 0.1, 0.07)}><circle cx="1032" cy="${470 + k * 80}" r="10" fill="${th.accent}"/>${U.T(1060, 482 + k * 80, f, { a: 'start', s: 34 })}</g>`).join('');
  },
});
const PLANETS = [['Mercury', 0.24, '#a8a29a', 8], ['Venus', 0.62, '#e0c088', 12], ['Earth', 1, '#4a8fd8', 13], ['Mars', 1.88, '#d0603a', 10], ['Jupiter', 11.86, '#d9a06b', 26], ['Saturn', 29.46, '#e6cf8f', 22], ['Uranus', 84, '#9fd8e0', 17], ['Neptune', 164.8, '#4a6fd8', 17]];
register('solar_system', {
  cat: CN, title: 'Solar system', desc: 'The Sun with the eight planets in orbit, the inner ones going round faster than the outer ones. Distances are not to scale.', use: 'The planets, their order and how long they take to go round.',
  params: 'labels, speed', example: {},
  build(p, c) {
    const { U, th } = c, id = c.id;
    let o = U.bg() + `<defs><radialGradient id="${id}sun"><stop offset="0" stop-color="#fff3b0"/><stop offset=".6" stop-color="#ffb52e"/><stop offset="1" stop-color="#ff7a1a" stop-opacity="0"/></radialGradient></defs><circle cx="960" cy="560" r="90" fill="url(#${id}sun)"/>`;
    PLANETS.forEach((q, k) => { const rx = 140 + k * 90, ry = rx * 0.42; o += `<ellipse cx="960" cy="560" rx="${rx}" ry="${ry}" fill="none" stroke="${th.line}" stroke-width="2" opacity="0"${U.A('fade', 0.05 + k * 0.04, 0.06)}/><g id="${id}p${k}" opacity="0"${U.A('fade', 0.1 + k * 0.04, 0.06)}><circle r="${q[3]}" fill="${q[2]}"/>${p.labels !== false ? U.T(0, -q[3] - 10, q[0], { s: 22, w: 700, f: th.ink }) : ''}</g>`; });
    return o + U.T(960, 940 - 30, 'Distances and sizes are not to scale', { s: 24, f: th.muted });
  },
  init(g, p, c) { return { P: PLANETS.map((_, k) => g.querySelector('#' + c.id + 'p' + k)) }; },
  render(l, st, p) { st.P.forEach((el, k) => { const rx = 140 + k * 90, ry = rx * 0.42, a = 1.3 + k * 0.7 + (l.t * (p.speed ?? 1.2)) / Math.sqrt(PLANETS[k][1]); el.setAttribute('transform', `translate(${(960 + rx * Math.cos(a)).toFixed(1)} ${(560 + ry * Math.sin(a)).toFixed(1)})`); }); },
});
register('moon_phases', {
  cat: CN, title: 'Moon phases', desc: 'The eight phases of the Moon, from new moon to full moon and back, in order.', use: 'The phases of the Moon and how sunlight falls on it.',
  params: 'labels, note', example: { note: 'About 29.5 days from new moon to new moon' },
  build(p, c) {
    const { U, th } = c, names = ['New moon', 'Waxing crescent', 'First quarter', 'Waxing gibbous', 'Full moon', 'Waning gibbous', 'Last quarter', 'Waning crescent'], R = 70, dark = th.surface, lit = th.ink;
    return U.bg() + names.map((n, k) => {
      const x = 200 + k * 217, y = 520, f = k / 8, wax = f <= 0.5, ph = Math.cos(2 * Math.PI * f), ex = Math.abs(ph) * R;
      const sweepOuter = wax ? 1 : 0, termSweep = ph > 0 ? (wax ? 0 : 1) : wax ? 1 : 0;
      const path = k === 0 ? '' : k === 4 ? `<circle cx="${x}" cy="${y}" r="${R}" fill="${lit}"/>` : `<path d="M${x} ${y - R}A${R} ${R} 0 0 ${sweepOuter} ${x} ${y + R}A${ex.toFixed(1)} ${R} 0 0 ${termSweep} ${x} ${y - R}Z" fill="${lit}"/>`;
      return `<g${U.A('up', 0.05 + k * 0.07, 0.06)}><circle cx="${x}" cy="${y}" r="${R}" fill="${dark}" stroke="${th.line}" stroke-width="2"/>${path}${p.labels !== false ? U.wrap(n, 10).map((t, i) => U.T(x, y + 120 + i * 32, t, { s: 26, w: 600 })).join('') : ''}</g>`;
    // The length of the cycle is shown only as a note given in the params, since no source of the video may back it.
    }).join('') + (p.note ? `<path d="M180 330H1740" stroke="${th.accent}" stroke-width="3" stroke-dasharray="10 10" opacity=".6"/>` + U.T(960, 300, p.note, { s: 32, f: th.muted, an: U.A('fade', 0.7, 0.06) }) : '');
  },
});
register('states_of_matter', {
  cat: CN, title: 'States of matter', desc: 'Particles in a solid, a liquid and a gas: packed and shaking, loose and sliding, and spread out and fast.', use: 'Solids, liquids and gases, and what happens when something is heated.',
  params: 'labels: [solid, liquid, gas]', example: { labels: ['Ice', 'Water', 'Steam'] },
  build(p, c) {
    const { U, th } = c, id = c.id, L = p.labels || ['Solid', 'Liquid', 'Gas'], cols = [th.accent2, th.accent, th.bad];
    let o = U.bg();
    [0, 1, 2].forEach((k) => { const x0 = 160 + k * 560; o += `<g${U.A('up', 0.05 + k * 0.12, 0.08)}><rect x="${x0}" y="260" width="480" height="480" rx="${th.radius}" fill="${th.surface}" stroke="${th.line}" stroke-width="4"/>${U.T(x0 + 240, 810, L[k], { fam: 'd', s: 50, w: 700, f: cols[k] })}</g>`; for (let i = 0; i < 25; i++) o += `<circle id="${id}m${k}_${i}" r="22" fill="${cols[k]}" opacity="0"${U.A('fade', 0.08 + k * 0.12, 0.06)}/>`; });
    return o;
  },
  init(g, p, c) { return { M: [0, 1, 2].map((k) => Array.from({ length: 25 }, (_, i) => g.querySelector('#' + c.id + 'm' + k + '_' + i))) }; },
  render(l, st) {
    const t = l.t;
    st.M.forEach((arr, k) => arr.forEach((el, i) => {
      const x0 = 160 + k * 560, r = (n) => Math.sin(n * 12.9898 + i * 78.233) * 43758.5453 % 1; let x, y;
      if (k === 0) { x = x0 + 80 + (i % 5) * 80 + Math.sin(t * 9 + i) * 4; y = 340 + Math.floor(i / 5) * 80 + Math.cos(t * 8 + i * 2) * 4; }
      else if (k === 1) { const gx = i % 5, gy = Math.floor(i / 5); x = x0 + 70 + gx * 84 + Math.sin(t * 1.5 + i * 1.7) * 22; y = 470 + gy * 52 + Math.cos(t * 1.3 + i) * 10; }
      else { const vx = 140 + Math.abs(r(1)) * 160, vy = 120 + Math.abs(r(2)) * 160, w = 400, h = 400, px = (Math.abs(r(3)) * w + vx * t) % (2 * w), py = (Math.abs(r(4)) * h + vy * t) % (2 * h); x = x0 + 40 + (px > w ? 2 * w - px : px); y = 300 + (py > h ? 2 * h - py : py); }
      el.setAttribute('cx', x.toFixed(1)); el.setAttribute('cy', y.toFixed(1));
    }));
  },
});
register('icon_chain', {
  cat: CN, title: 'Icon chain', desc: 'Links with icons and labels, joined by arrows. Fits food chains, value chains and processes.', use: 'Food chains, production chains and how something passes from one link to the next.',
  params: 'nodes: [{icon, label}], arrowLabel, title', example: { title: 'A food chain', nodes: [{ icon: 'sun', label: 'The Sun' }, { icon: 'leaf', label: 'Grass' }, { icon: 'wheat', label: 'Insect' }, { icon: 'tree', label: 'Bird' }, { icon: 'star', label: 'Hawk' }], arrowLabel: '' },
  build(p, c) {
    const { U, th } = c, Nd = (p.nodes || []).slice(0, 6), n = Math.max(1, Nd.length), w = 1600 / n, cols = th.series;
    let o = U.bg() + H.title(U, th, p.title, 250);
    Nd.forEach((q, k) => { const x = 160 + w * (k + 0.5), at = 0.08 + k * (0.65 / n); o += `<g${U.A('pop', at, 0.05, { cx: x, cy: 540 })}><circle cx="${x}" cy="540" r="${Math.min(110, w * 0.32)}" fill="${th.surface}" stroke="${cols[k % 6]}" stroke-width="6"/>${U.icon(q.icon || 'dot', x, 540, Math.min(130, w * 0.38), cols[k % 6])}</g>` + U.T(x, 720, q.label || '', { s: 36, w: 700, an: U.A('fade', at + 0.03, 0.05) }); if (k < n - 1) o += H.arrow(U, th.muted, x + Math.min(110, w * 0.32) + 12, 540, x + w - Math.min(110, w * 0.32) - 12, 540, at + 0.06, 6) + (p.arrowLabel ? U.T(x + w / 2, 510, p.arrowLabel, { s: 22, f: th.muted }) : ''); });
    return o;
  },
});
register('wave', {
  cat: CN, title: 'Wave', desc: 'A moving wave with the amplitude and wavelength marked.', use: 'Sound, light, water waves and oscillations.',
  params: 'amplitude (pixels), wavelength (pixels), speed, label', example: { amplitude: 140, wavelength: 480, label: 'Transverse wave' },
  build(p, c) {
    const { U, th } = c, id = c.id, A = p.amplitude ?? 140, L = p.wavelength ?? 480;
    return U.bg() + `<path d="M160 560H1760" stroke="${th.line}" stroke-width="3" stroke-dasharray="10 8"/><path id="${id}w" fill="none" stroke="${th.accent}" stroke-width="7" stroke-linecap="round"/>` +
      `<g opacity="0"${U.A('fade', 0.4, 0.06)}><path d="M${400} ${560 - A}H${400 + L}" stroke="${th.accent2}" stroke-width="3"/><path d="M400 ${560 - A - 20}V${560 - A + 20}M${400 + L} ${560 - A - 20}V${560 - A + 20}" stroke="${th.accent2}" stroke-width="3"/>${U.T(400 + L / 2, 560 - A - 30, 'Wavelength λ', { s: 30, w: 700, f: th.accent2 })}</g>` +
      `<g opacity="0"${U.A('fade', 0.55, 0.06)}><path d="M1640 560V${560 - A}" stroke="${th.good}" stroke-width="4"/>${U.T(1660, 560 - A / 2, 'Amplitude', { a: 'start', s: 30, w: 700, f: th.good, halo: 8 })}</g>` + (p.label ? U.T(960, 880, p.label, { fam: 'd', s: 48, w: 700, an: U.A('fade', 0.05, 0.06) }) : '');
  },
  init(g, p, c) { return { w: g.querySelector('#' + c.id + 'w') }; },
  render(l, st, p) { const A = p.amplitude ?? 140, L = p.wavelength ?? 480, ph = (l.t * (p.speed ?? 1)) * 2 * Math.PI * 0.5; let d = ''; for (let x = 160; x <= 1760; x += 8) d += (x === 160 ? 'M' : 'L') + x + ' ' + (560 - A * Math.sin(((x - 400) / L) * 2 * Math.PI - ph + Math.PI / 2 * 0)).toFixed(1); st.w.setAttribute('d', d); },
});
register('circuit', {
  cat: CN, title: 'Electric circuit', desc: 'A simple circuit with a battery, a switch and a light bulb. The switch closes, the current flows and the bulb lights up.', use: 'Current, voltage and closed circuits.',
  params: 'at (when the switch closes)', example: { at: 0.35 },
  build(p, c) {
    const { U, th } = c, id = c.id, a = p.at ?? 0.35;
    let o = U.bg() + `<path d="M500 300H1420V800H500Z" fill="none" stroke="${th.ink}" stroke-width="8" stroke-linejoin="round"/>` +
      `<rect x="470" y="470" width="60" height="160" fill="${th.bg}"/><path d="M445 500H555M470 545H530M445 590H555M470 635H530" stroke="${th.ink}" stroke-width="8"/>` + U.T(410, 560, '+', { s: 40, w: 700, f: th.bad }) + U.T(410, 640, '−', { s: 40, w: 700, f: th.accent2 }) + U.T(330, 760, 'Battery', { s: 30, f: th.muted }) +
      `<rect x="860" y="280" width="200" height="40" fill="${th.bg}"/><circle cx="870" cy="300" r="10" fill="${th.ink}"/><circle cx="1050" cy="300" r="10" fill="${th.ink}"/><g${U.A('rot', a, 0.06, { a0: -30, a1: 0, cx: 870, cy: 300 })}><path d="M870 300H1050" stroke="${th.ink}" stroke-width="8"/></g>` + U.T(960, 350, 'Switch', { s: 30, f: th.muted }) +
      `<rect x="1400" y="470" width="40" height="160" fill="${th.bg}"/><circle cx="1420" cy="550" r="70" fill="${th.surface}" stroke="${th.ink}" stroke-width="6"/><circle cx="1420" cy="550" r="110" fill="none" stroke="${th.accent}" stroke-width="6" stroke-opacity=".6" opacity="0"${U.A('fade', a + 0.06, 0.08)}/><circle cx="1420" cy="550" r="64" fill="${th.accent}" opacity="0"${U.A('fade', a + 0.06, 0.05)}/>` + U.T(1556, 562, 'Light bulb', { a: 'start', s: 30, f: th.muted });
    for (let i = 0; i < 14; i++) o += `<circle id="${id}q${i}" r="9" fill="${th.accent2}" opacity="0"/>`;
    return o;
  },
  init(g, p, c) { return { Q: Array.from({ length: 14 }, (_, i) => g.querySelector('#' + c.id + 'q' + i)) }; },
  render(l, st, p) {
    const on = l.p > (p.at ?? 0.35) + 0.04, per = 2 * (920 + 500);
    st.Q.forEach((el, i) => { if (!on) { el.setAttribute('opacity', 0); return; } let d = (i / 14) * per + l.t * 220; d %= per; let x, y; if (d < 920) { x = 500 + d; y = 300; } else if (d < 1420) { x = 1420; y = 300 + d - 920; } else if (d < 2340) { x = 1420 - (d - 1420); y = 800; } else { x = 500; y = 800 - (d - 2340); } el.setAttribute('cx', x.toFixed(1)); el.setAttribute('cy', y.toFixed(1)); el.setAttribute('opacity', 0.9); });
  },
});
register('light_refraction', {
  cat: CN, title: 'Refraction', desc: 'A ray of light passes from one substance into another and bends. The new angle is worked out with Snell’s law.', use: 'Light, refraction and the refractive index.',
  params: 'n1, n2 (refractive indices), angle (angle of incidence in degrees), top, bottom (names of the substances)', example: { n1: 1.0, n2: 1.33, angle: 45, top: 'Air', bottom: 'Water' },
  build(p, c) {
    const { U, th } = c, n1 = p.n1 ?? 1, n2 = p.n2 ?? 1.33, a = ((p.angle ?? 45) * Math.PI) / 180, sb = (n1 / n2) * Math.sin(a), b = Math.asin(Math.min(1, sb)), O = [960, 560], L = 420;
    const I = [O[0] - L * Math.sin(a), O[1] - L * Math.cos(a)], R = [O[0] + L * Math.sin(b), O[1] + L * Math.cos(b)];
    return U.bg() + `<rect x="-2000" y="560" width="5920" height="3000" fill="${th.accent2}" fill-opacity=".18" data-fm-bg="1"/><path d="M160 560H1760" stroke="${th.ink}" stroke-width="3"/><path d="M960 180V940" stroke="${th.muted}" stroke-width="3" stroke-dasharray="12 10"/>` +
      U.T(200, 520, p.top || 'Air', { a: 'start', s: 36, w: 700 }) + U.T(200, 620, p.bottom || 'Water', { a: 'start', s: 36, w: 700, f: th.accent2 }) + U.T(980, 200, 'Normal', { a: 'start', s: 26, f: th.muted }) +
      H.arrow(U, th.accent, I[0], I[1], O[0], O[1], 0.1, 8) + (sb <= 1 ? H.arrow(U, th.accent, O[0], O[1], R[0], R[1], 0.32, 8) : U.T(960, 760, 'Total internal reflection', { s: 40, w: 700, f: th.bad })) +
      U.T(O[0] - 90, O[1] - 140, (p.angle ?? 45) + '°', { s: 36, w: 700, f: th.accent, an: U.A('fade', 0.25, 0.05) }) + (sb <= 1 ? U.T(O[0] + 70, O[1] + 170, N(U, (b * 180) / Math.PI, 1) + '°', { s: 36, w: 700, f: th.accent, an: U.A('fade', 0.45, 0.05) }) : '') +
      `<g${U.A('left', 0.55, 0.08)}>${U.card(1340, 240, 440, 200, { f: th.surface, s: th.line, sw: 2 })}${U.T(1370, 310, 'n₁ · sin θ₁ = n₂ · sin θ₂', { a: 'start', fam: 'd', s: 32, w: 700, f: th.accent })}${U.T(1370, 380, 'n₁ = ' + N(U, n1) + ',  n₂ = ' + N(U, n2), { a: 'start', s: 30 })}</g>`;
  },
});
