// Templates for time and for how things connect: Trym's code from his film engine (templates/tid_sammenheng.js),
// adapted for Meko with English text and the Night atlas theme. See ../engine.js for how templates work.
import { register, preset } from "../engine.js";

const arrow = (U, th, x0, y0, x1, y1, at, col) => {
  const len = Math.hypot(x1 - x0, y1 - y0), a = Math.atan2(y1 - y0, x1 - x0), hx = x1 - 18 * Math.cos(a), hy = y1 - 18 * Math.sin(a);
  return `<path d="M${x0.toFixed(1)} ${y0.toFixed(1)}L${hx.toFixed(1)} ${hy.toFixed(1)}" stroke="${col || th.muted}" stroke-width="5" stroke-linecap="round" stroke-dasharray="${len.toFixed(0)}" stroke-dashoffset="${len.toFixed(0)}"${U.A('draw', at, 0.07, { l: len.toFixed(0) })}/>` +
    `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)}L${(hx - 12 * Math.sin(a)).toFixed(1)} ${(hy + 12 * Math.cos(a)).toFixed(1)}L${(hx + 12 * Math.sin(a)).toFixed(1)} ${(hy - 12 * Math.cos(a)).toFixed(1)}Z" fill="${col || th.muted}" opacity="0"${U.A('fade', at + 0.06, 0.02)}/>`;
};
register('timeline', {
  cat: 'Time', title: 'Timeline', desc: 'An axis that draws itself, with events popping up above and below by turns, and optional eras as bands.', use: 'The order of events over time.',
  params: 'title, start, end, step, events: [{year, label, text, at}], bands: [{from, to, label, color}]',
  example: { title: 'Voting rights in Norway', start: 1800, end: 1920, step: 20, events: [{ year: 1814, label: 'Constitution' }, { year: 1884, label: 'Parliamentarism' }, { year: 1898, label: 'All men' }, { year: 1913, label: 'Women' }] },
  build(p, c) {
    const { U, th } = c, L = 200, R = 1720, y = 600, X = (v) => L + ((R - L) * (v - p.start)) / (p.end - p.start), E = p.events || [], step = p.step || 10;
    let out = U.bg() + (p.title ? U.T(L, 230, p.title, { a: 'start', fam: 'd', s: 56, w: 700, an: U.A('fade', 0.02, 0.06) }) : '') +
      `<path d="M${L} ${y}H${R}" stroke="${th.ink}" stroke-width="5" stroke-dasharray="${R - L}" stroke-dashoffset="${R - L}"${U.A('draw', 0.04, 0.2, { l: R - L })}/>`;
    (p.bands || []).forEach((b, k) => { out += `<g opacity="0"${U.A('fade', 0.1 + k * 0.08, 0.08)}><rect x="${X(b.from)}" y="${y - 70}" width="${X(b.to) - X(b.from)}" height="60" rx="6" fill="${b.color || th.series[k % 3]}" fill-opacity=".35"/>${U.T((X(b.from) + X(b.to)) / 2, y - 30, b.label, { s: 26, w: 600 })}</g>`; });
    for (let v = Math.ceil(p.start / step) * step; v <= p.end; v += step) out += `<path d="M${X(v)} ${y - 10}V${y + 10}" stroke="${th.muted}" stroke-width="3"/>` + U.T(X(v), y + 44, String(v), { s: 24, f: th.muted, an: U.A('fade', 0.12, 0.1) });
    E.forEach((e, k) => {
      const x = X(e.year), up = k % 2 === 0, at = e.at ?? 0.25 + k * (0.55 / Math.max(1, E.length)), ly = up ? y - 120 : y + 150;
      out += `<path d="M${x} ${y}V${up ? y - 90 : y + 90}" stroke="${th.accent}" stroke-width="3" opacity="0"${U.A('fade', at, 0.04)}/>` + U.popIcon('dot', x, y, 34, th.accent, at, 0.05) +
        `<g${U.A('up', at + 0.02, 0.06)}>${U.T(x, ly, String(e.year), { fam: 'd', s: 44, w: 700, f: th.accent })}${U.wrap(e.label || '', 18).slice(0, 2).map((l, i) => U.T(x, ly + 40 + i * 34, l, { s: 30 })).join('')}</g>`;
    });
    return out;
  },
});
preset('era_bands', 'timeline', { title: 'Eras', desc: 'A timeline with the periods as colored bands.', use: 'Showing how periods overlap or follow each other.',
  example: { title: 'From revolution to empire', start: 1785, end: 1820, step: 5, bands: [{ from: 1789, to: 1792, label: 'Monarchy' }, { from: 1792, to: 1804, label: 'Republic' }, { from: 1804, to: 1815, label: 'Empire' }] } });
register('clock_time', {
  cat: 'Time', title: 'Clock', desc: 'A clock whose hands move from one time to another.', use: 'Time passing during a day, up to a deadline or around the clock.',
  params: 'from (HH:MM), to (HH:MM), label, sub', example: { from: '06:00', to: '18:00', label: 'A twelve-hour working day', sub: 'example' },
  build(p, c) {
    const { U, th } = c, mm = (s) => { const [h, m] = String(s).split(':').map(Number); return h * 60 + m; }, m0 = mm(p.from || '00:00'); let d = mm(p.to || '00:00') - m0; if (d <= 0) d += 1440;
    const cx = 700, cy = 560, R = 260, h0 = ((m0 / 60) % 12) * 30, n0 = (m0 % 60) * 6;
    let out = U.bg() + `<circle cx="${cx}" cy="${cy}" r="${R}" fill="${th.surface}" stroke="${th.ink}" stroke-width="10"/>`;
    for (let k = 0; k < 12; k++) { const a = (k * 30 * Math.PI) / 180; out += `<path d="M${cx + (R - 20) * Math.sin(a)} ${cy - (R - 20) * Math.cos(a)}L${cx + (R - 50) * Math.sin(a)} ${cy - (R - 50) * Math.cos(a)}" stroke="${th.ink}" stroke-width="${k % 3 ? 4 : 9}"/>`; }
    return out + `<g${U.A('rot', 0.08, 0.6, { a0: h0, a1: h0 + d / 2, cx, cy })}><path d="M${cx} ${cy}V${cy - 150}" stroke="${th.ink}" stroke-width="16" stroke-linecap="round"/></g>` +
      `<g${U.A('rot', 0.08, 0.6, { a0: n0, a1: n0 + d * 6, cx, cy })}><path d="M${cx} ${cy}V${cy - 220}" stroke="${th.accent}" stroke-width="9" stroke-linecap="round"/></g><circle cx="${cx}" cy="${cy}" r="16" fill="${th.ink}"/>` +
      U.T(1120, 470, (p.from || '') + ' → ' + (p.to || ''), { a: 'start', fam: 'd', s: 80, w: 700, f: th.accent, an: U.A('fade', 0.04, 0.08) }) +
      U.wrap(p.label || '', 24).slice(0, 2).map((l, k) => U.T(1120, 560 + k * 50, l, { a: 'start', s: 42, an: U.A('up', 0.12, 0.08) })).join('') + (p.sub ? U.T(1120, 680, p.sub, { a: 'start', s: 30, f: th.muted, an: U.A('fade', 0.2, 0.08) }) : '');
  },
});
register('calendar_date', {
  cat: 'Time', title: 'Calendar date', desc: 'A calendar page that pops up with the day, month and year.', use: 'A specific date that matters.',
  params: 'day, month, year, weekday, label, sub', example: { day: 14, month: 'July', year: 1789, label: 'The storming of the Bastille' },
  build(p, c) {
    const { U, th } = c;
    return U.bg() + `<g${U.A('pop', 0.04, 0.07, { cx: 640, cy: 540 })}>${U.card(440, 300, 400, 460, { f: th.surface, s: th.line, sw: 3 })}<rect x="440" y="300" width="400" height="110" rx="${th.radius}" fill="${th.accent}"/>` +
      U.T(640, 374, U.lab(p.month || '') + ' ' + (p.year || ''), { s: 40, w: 700, f: th.bg }) + U.T(640, 640, String(p.day || ''), { fam: 'd', s: 230, w: 700 }) + (p.weekday ? U.T(640, 720, p.weekday, { s: 32, f: th.muted }) : '') + '</g>' +
      U.wrap(p.label || '', 26).slice(0, 3).map((l, k) => U.T(980, 520 + k * 58, l, { a: 'start', fam: 'd', s: 52, w: 700, an: U.A('left', 0.2 + k * 0.05, 0.08) })).join('') + (p.sub ? U.T(980, 720, p.sub, { a: 'start', s: 30, f: th.muted, an: U.A('fade', 0.35, 0.08) }) : '');
  },
});
register('cause_chain', {
  cat: 'Relations', title: 'Cause chain', desc: 'Boxes that light up one after another with arrows between them, across or down.', use: 'Cause and effect, or one event leading to the next.',
  params: 'nodes: [{text}], direction: h|v, numbered', example: { nodes: [{ text: 'The revolution' }, { text: 'Napoleon' }, { text: 'War in Europe' }, { text: 'Treaty of Kiel' }, { text: 'Constitution of 1814' }] },
  build(p, c) {
    const { U, th } = c, Nd = (p.nodes || []).slice(0, 6), N = Math.max(1, Nd.length), step = 0.75 / N;
    let out = U.bg();
    if (p.direction === 'v') {
      const h = Math.min(110, 640 / N - 30), gap = (700 - N * h) / Math.max(1, N - 1);
      // A long step gets smaller type, then two lines, so it stays inside its box (added for Meko).
      const fit = (text) => {
        const size = Math.max(28, Math.min(40, (40 * 740) / Math.max(1, U.tw(text, 40, { w: 600 }))));
        if (U.tw(text, size, { w: 600 }) <= 740) return [[text], size];
        const words = String(text).split(/\s+/), half = Math.ceil(words.length / 2);
        return [[words.slice(0, half).join(' '), words.slice(half).join(' ')], Math.max(26, Math.min(34, (34 * 740) / Math.max(1, ...[words.slice(0, half).join(' '), words.slice(half).join(' ')].map((l) => U.tw(l, 34, { w: 600 })))))];
      };
      Nd.forEach((n, k) => {
        const y = 200 + k * (h + gap), at = p.times?.[k] ?? 0.06 + k * step, [lines, size] = fit(n.text);
        const text = lines.map((l, i) => U.T(960, y + h / 2 + size * 0.35 + (i - (lines.length - 1) / 2) * size * 1.15, l, { s: size, w: 600 })).join('');
        out += `<g${U.A('pop', at, 0.05, { cx: 960, cy: y + h / 2 })}>${U.card(560, y, 800, h, { s: k === N - 1 ? th.accent : th.line, sw: 4 })}${text}</g>`;
        if (k < N - 1) out += arrow(U, th, 960, y + h + 6, 960, y + h + gap - 6, at + step * 0.6);
      });
      return out;
    }
    const gapX = 70, w = Math.min(300, (1600 - (N - 1) * gapX) / N), x0 = 960 - (N * w + (N - 1) * gapX) / 2;
    Nd.forEach((n, k) => {
      const x = x0 + k * (w + gapX), at = p.times?.[k] ?? 0.06 + k * step, L = U.wrap(n.text, Math.max(8, Math.floor(w / 22))).slice(0, 3);
      out += `<g${U.A('pop', at, 0.05, { cx: x + w / 2, cy: 560 })}>${U.card(x, 470, w, 180, { s: k === N - 1 ? th.accent : th.line, sw: 4 })}` + L.map((l, i) => U.T(x + w / 2, 560 - (L.length - 1) * 20 + i * 40 + 12, l, { s: 34, w: 600 })).join('') +
        (p.numbered ? `<circle cx="${x + w / 2}" cy="430" r="30" fill="${th.accent}"/>` + U.T(x + w / 2, 442, String(k + 1), { s: 32, w: 700, f: th.bg }) : '') + '</g>';
      if (k < N - 1) out += arrow(U, th, x + w + 8, 560, x + w + gapX - 8, 560, at + step * 0.6);
    });
    return out;
  },
});
preset('process_steps', 'cause_chain', { title: 'Process steps', desc: 'Numbered steps in a process.', use: 'How something is done or happens, in order.', defaults: { numbered: true },
  example: { nodes: [{ text: 'Proposal' }, { text: 'Debate' }, { text: 'Vote' }, { text: 'New law' }] } });
register('cycle', {
  cat: 'Relations', title: 'Cycle', desc: 'Stages in a circle with arrows between them, and a dot going round.', use: 'Things that repeat: the water cycle, economic cycles, life cycles.',
  params: 'nodes: [{text, icon}], center', example: { center: 'The water cycle', nodes: [{ text: 'Evaporation', icon: 'sun' }, { text: 'Clouds', icon: 'cloud' }, { text: 'Rain', icon: 'drop' }, { text: 'Runoff', icon: 'leaf' }] },
  build(p, c) {
    const { U, th } = c, id = c.id, Nd = (p.nodes || []).slice(0, 6), N = Math.max(1, Nd.length), cx = 960, cy = 560, rx = 360, ry = 270, P = (a) => [cx + rx * Math.cos(a), cy + ry * Math.sin(a)];
    let out = U.bg() + `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" stroke="${th.line}" stroke-width="3" stroke-dasharray="6 10"/>` + `<circle id="${id}dot" r="12" fill="${th.accent}"/>`;
    Nd.forEach((n, k) => {
      const a = -Math.PI / 2 + (2 * Math.PI * k) / N, b = -Math.PI / 2 + (2 * Math.PI * (k + 1)) / N, [x, y] = P(a), at = p.times?.[k] ?? 0.06 + k * (0.7 / N);
      const s0 = P(a + 0.32), s1 = P(b - 0.32), len = 2 * Math.PI * ((rx + ry) / 2) / N * 0.6;
      out += `<path d="M${s0[0].toFixed(1)} ${s0[1].toFixed(1)}A${rx} ${ry} 0 0 1 ${s1[0].toFixed(1)} ${s1[1].toFixed(1)}" stroke="${th.accent}" stroke-width="6" fill="none" stroke-linecap="round" stroke-dasharray="${len.toFixed(0)}" stroke-dashoffset="${len.toFixed(0)}"${U.A('draw', at + 0.06, 0.1, { l: len.toFixed(0) })}/>` +
        `<g${U.A('pop', at, 0.05, { cx: x, cy: y })}><circle cx="${x}" cy="${y}" r="78" fill="${th.surface}" stroke="${th.accent}" stroke-width="5"/>${n.icon ? U.icon(n.icon, x, y - 4, 80, th.accent) : ''}${U.T(x, y + 120, n.text, { s: 34, w: 600, halo: 8 })}</g>`;
    });
    // The center's name shrinks to stay clear of the labels of the stages beside it (added for Meko).
    const centerSize = p.center ? Math.max(32, Math.min(50, (50 * 380) / Math.max(1, U.tw(p.center, 50, { fam: 'd', w: 700 })))) : 50;
    return out + (p.center ? U.T(cx, cy + centerSize * 0.32, p.center, { fam: 'd', s: centerSize, w: 700, an: U.A('fade', 0.04, 0.1) }) : '');
  },
  init(g, p, c) { return { dot: g.querySelector('#' + c.id + 'dot') }; },
  render(l, st) { const a = -Math.PI / 2 + l.t * 0.9; st.dot.setAttribute('cx', (960 + 360 * Math.cos(a)).toFixed(1)); st.dot.setAttribute('cy', (560 + 270 * Math.sin(a)).toFixed(1)); st.dot.setAttribute('opacity', l.p > 0.7 ? 1 : 0); },
});
register('pyramid', {
  cat: 'Relations', title: 'Pyramid', desc: 'The levels of a pyramid, built from the top down.', use: 'Hierarchies, social classes, needs or amounts.',
  params: 'levels: [{label, text}] (top first)', example: { levels: [{ label: 'The king' }, { label: 'The clergy' }, { label: 'The nobility' }, { label: 'The Third Estate', text: 'about 98 percent' }] },
  build(p, c) {
    const { U, th } = c, Lv = (p.levels || []).slice(0, 6), N = Math.max(1, Lv.length), top = 200, H = 680, h = H / N, W = (y) => 120 + ((y - top) / H) * 1100;
    return U.bg() + Lv.map((l, k) => {
      const y0 = top + k * h, y1 = y0 + h - 8, w0 = W(y0), w1 = W(y1), col = k === N - 1 ? th.accent : th.surface, at = p.times?.[k] ?? 0.06 + k * (0.6 / N);
      return `<g${U.A('pop', at, 0.06, { cx: 960, cy: (y0 + y1) / 2 })}><path d="M${960 - w0 / 2} ${y0}H${960 + w0 / 2}L${960 + w1 / 2} ${y1}H${960 - w1 / 2}Z" fill="${col}" stroke="${th.line}" stroke-width="3"/>` +
        U.T(960, (y0 + y1) / 2 + (l.text ? 0 : 12), l.label, { s: Math.min(42, h * 0.38, ((w0 + w1) / 2) * 1.1 / Math.max(0.01, U.tw(l.label, 1, { w: 700 }))), w: 700, f: k === N - 1 ? th.bg : th.ink }) + (l.text ? U.T(960, (y0 + y1) / 2 + 36, l.text, { s: 26, f: k === N - 1 ? th.bg : th.muted }) : '') + '</g>';
    }).join('');
  },
});
register('tree_chart', {
  cat: 'Relations', title: 'Tree chart', desc: 'A root with branches on two levels, joined by lines that draw themselves.', use: 'Organizations, divisions and family trees.',
  params: 'root, children: [{label, children: [text]}]', example: { root: 'State power', children: [{ label: 'Legislative', children: ['Parliament'] }, { label: 'Executive', children: ['Government'] }, { label: 'Judicial', children: ['Courts'] }] },
  build(p, c) {
    const { U, th } = c, C = (p.children || []).slice(0, 5), N = Math.max(1, C.length), box = (x, y, t, at, strong) => `<g${U.A('pop', at, 0.05, { cx: x, cy: y })}>${U.card(x - 150, y - 45, 300, 90, { f: strong ? th.accent : th.surface, s: th.line, sw: 3 })}${U.T(x, y + 12, t, { s: 32, w: 700, f: strong ? th.bg : th.ink })}</g>`;
    const line = (x0, y0, x1, y1, at) => { const len = Math.abs(y1 - y0) + Math.abs(x1 - x0); const my = (y0 + y1) / 2; return `<path d="M${x0} ${y0}V${my}H${x1}V${y1}" stroke="${th.muted}" stroke-width="4" fill="none" stroke-dasharray="${len}" stroke-dashoffset="${len}"${U.A('draw', at, 0.1, { l: len })}/>`; };
    let out = U.bg() + box(960, 260, p.root || '', 0.04, true);
    C.forEach((ch, k) => {
      const x = 160 + (1600 / N) * (k + 0.5), at = p.times?.[k] ?? 0.15 + k * 0.1;
      out += line(960, 305, x, 475, at) + box(x, 520, ch.label, at + 0.08);
      (ch.children || []).slice(0, 2).forEach((g, i) => { out += line(x, 565, x, 705 + i * 120, at + 0.18) + `<g${U.A('fade', at + 0.22, 0.06)}>${U.T(x, 760 + i * 120, g, { s: 30, f: th.muted })}</g>`; });
    });
    return out;
  },
});
register('funnel', {
  cat: 'Relations', title: 'Funnel', desc: 'Stages that narrow downward, with numbers beside them.', use: 'A group that gets smaller at every step.',
  params: 'stages: [{label, value}], unit', example: { stages: [{ label: 'Adult men', value: 100 }, { label: 'Paid enough tax', value: 66 }, { label: 'Could be elected', value: 20 }], unit: '%' },
  build(p, c) {
    const { U, th } = c, S = (p.stages || []).slice(0, 6), N = Math.max(1, S.length), h = 620 / N, top = 220;
    return U.bg() + S.map((s, k) => {
      const y0 = top + k * h, y1 = y0 + h - 10, w0 = 1100 - (k * 700) / N, w1 = 1100 - ((k + 1) * 700) / N, at = p.times?.[k] ?? 0.06 + k * (0.6 / N);
      return `<g${U.A('up', at, 0.07)}><path d="M${860 - w0 / 2} ${y0}H${860 + w0 / 2}L${860 + w1 / 2} ${y1}H${860 - w1 / 2}Z" fill="${k % 2 ? th.accent2 : th.accent}" fill-opacity="${1 - k * 0.12}"/>${U.T(860, (y0 + y1) / 2 + 12, s.label, { s: 34, w: 700, f: th.bg })}</g>` +
        (s.value != null ? U.T(1500, (y0 + y1) / 2 + 16, '0', { a: 'start', fam: 'd', s: 54, w: 700, f: th.ink, an: U.A('count', at, 0.15, { from: 0, to: s.value, dec: 0, suf: p.unit || '' }) }) : '');
    }).join('');
  },
});
register('layer_stack', {
  cat: 'Relations', title: 'Layer stack', desc: 'Slanted plates stacked on top of each other, with labels beside them.', use: 'Systems that build on each other, like technology, layers of soil or levels of government.',
  params: 'layers: [{label, text, color}] (bottom first)', example: { layers: [{ label: 'Local' }, { label: 'Regional' }, { label: 'National' }, { label: 'International' }] },
  build(p, c) {
    const { U, th } = c, Ly = (p.layers || []).slice(0, 6), N = Math.max(1, Ly.length), cols = th.series;
    return U.bg() + Ly.map((l, k) => {
      const y = 780 - k * (520 / N), at = p.times?.[k] ?? 0.06 + k * (0.6 / N), col = l.color || cols[k % cols.length];
      return `<g${U.A('up', at, 0.07)}><path d="M560 ${y}L860 ${y - 110}L1220 ${y - 110}L920 ${y}Z" fill="${col}" fill-opacity=".85" stroke="${th.bg}" stroke-width="4"/><path d="M560 ${y}L920 ${y}L920 ${y + 24}L560 ${y + 24}Z" fill="${col}" fill-opacity=".55"/><path d="M920 ${y}L1220 ${y - 110}L1220 ${y - 86}L920 ${y + 24}Z" fill="${col}" fill-opacity=".4"/>` +
        `<path d="M1230 ${y - 60}H1330" stroke="${th.muted}" stroke-width="3"/>${U.T(1350, y - 50, l.label, { a: 'start', s: 38, w: 700 })}${l.text ? U.T(1350, y - 12, l.text, { a: 'start', s: 26, f: th.muted }) : ''}</g>`;
    }).join('');
  },
});
register('venn', {
  cat: 'Relations', title: 'Venn diagram', desc: 'Two or three overlapping circles, with what they share in the middle.', use: 'What two or three things have in common, and how they differ.',
  params: 'sets: [{label, text}], overlap', example: { sets: [{ label: 'France 1789', text: 'Revolution' }, { label: 'Norway 1814', text: 'No bloodshed' }], overlap: 'Popular sovereignty' },
  build(p, c) {
    const { U, th } = c, S = (p.sets || []).slice(0, 3), cols = th.series;
    const pos = S.length === 3 ? [[810, 470], [1110, 470], [960, 700]] : [[780, 560], [1140, 560]], r = S.length === 3 ? 250 : 320;
    let out = U.bg();
    S.forEach((s, k) => { const [x, y] = pos[k], lx = S.length === 3 ? x + (k === 2 ? 0 : k ? 160 : -160) : x + (k ? 120 : -120), ly = S.length === 3 ? y + (k === 2 ? 170 : -120) : y; out += `<g${U.A('pop', 0.06 + k * 0.12, 0.06, { cx: x, cy: y })}><circle cx="${x}" cy="${y}" r="${r}" fill="${cols[k]}" fill-opacity=".16" stroke="${cols[k]}" stroke-width="5"/>${U.T(lx, ly - 10, s.label, { s: 36, w: 700 })}${s.text ? U.T(lx, ly + 34, s.text, { s: 28, f: th.muted }) : ''}</g>`; });
    return out + (p.overlap ? `<g${U.A('pop', 0.5, 0.06, { cx: 960, cy: S.length === 3 ? 560 : 560 })}>${U.wrap(p.overlap, 14).slice(0, 3).map((l, i, A) => U.T(960, (S.length === 3 ? 575 : 572) + (i - (A.length - 1) / 2) * 42, l, { fam: 'd', s: 36, w: 700, f: th.ink, halo: 6 })).join('')}</g>` : '');
  },
});
register('matrix_2x2', {
  cat: 'Relations', title: 'Two-by-two matrix', desc: 'Two axes that split the frame into four fields, with points placed inside.', use: 'Placing things by two qualities, like fast or slow and peaceful or violent.',
  params: 'xTitle, yTitle, xLabels: [low, high], yLabels: [low, high], quadrants: [{title}] (top left first), points: [{x, y, label, at}] (x and y from 0 to 1)',
  example: { xTitle: 'How fast', yTitle: 'How peaceful', xLabels: ['Slow', 'Fast'], yLabels: ['Violent', 'Peaceful'], points: [{ x: 0.85, y: 0.15, label: 'France 1789' }, { x: 0.3, y: 0.85, label: 'Norway 1814' }] },
  build(p, c) {
    const { U, th } = c, L = 460, R = 1460, T = 180, B = 880, X = (v) => L + (R - L) * v, Y = (v) => B - (B - T) * v, Q = p.quadrants || [];
    let out = U.bg() + `<path d="M${(L + R) / 2} ${T}V${B}M${L} ${(T + B) / 2}H${R}" stroke="${th.muted}" stroke-width="4" stroke-dasharray="1700" stroke-dashoffset="1700"${U.A('draw', 0.04, 0.2, { l: 1700 })}/>`;
    out += U.T(R, (T + B) / 2 + 50, p.xLabels ? p.xLabels[1] : '', { a: 'end', s: 28, f: th.muted }) + U.T(L, (T + B) / 2 + 50, p.xLabels ? p.xLabels[0] : '', { a: 'start', s: 28, f: th.muted }) +
      U.T((L + R) / 2 + 16, T + 30, p.yLabels ? p.yLabels[1] : '', { a: 'start', s: 28, f: th.muted }) + U.T((L + R) / 2 + 16, B - 10, p.yLabels ? p.yLabels[0] : '', { a: 'start', s: 28, f: th.muted }) +
      (p.xTitle ? U.T(R, B + 50, p.xTitle, { a: 'end', s: 30, w: 700 }) : '') + (p.yTitle ? U.T(L - 20, T - 20, p.yTitle, { a: 'start', s: 30, w: 700 }) : '');
    Q.slice(0, 4).forEach((q, k) => { out += U.T(k % 2 ? (R + (L + R) / 2) / 2 : (L + (L + R) / 2) / 2, k < 2 ? (T + (T + B) / 2) / 2 : ((T + B) / 2 + B) / 2, q.title, { s: 34, w: 600, f: th.line, an: U.A('fade', 0.2 + k * 0.05, 0.08) }); });
    (p.points || []).forEach((pt, k) => { const x = X(pt.x), y = Y(pt.y), at = pt.at ?? 0.35 + k * 0.12; out += `<g${U.A('pop', at, 0.05, { cx: x, cy: y })}><circle cx="${x}" cy="${y}" r="20" fill="${th.series[k % 3]}"/>${U.T(x, y - 34, pt.label, { s: 32, w: 700 })}</g>`; });
    return out;
  },
});
register('network', {
  cat: 'Relations', title: 'Network', desc: 'Nodes in a ring, with one in the middle if wanted, and lines drawn between them.', use: 'Relationships, influence and contacts.',
  params: 'nodes: [{label, icon}], links: [[i, j]], center (index)', example: { center: 0, nodes: [{ label: 'The Enlightenment', icon: 'bulb' }, { label: 'USA 1776', icon: 'flag' }, { label: 'France 1789', icon: 'flame' }, { label: 'Norway 1814', icon: 'scroll' }], links: [[0, 1], [0, 2], [0, 3], [1, 2], [2, 3]] },
  build(p, c) {
    const { U, th } = c, Nd = (p.nodes || []).slice(0, 9), ci = p.center, ring = Nd.map((_, k) => k).filter((k) => k !== ci), pos = {};
    if (ci != null) pos[ci] = [960, 560];
    ring.forEach((k, i) => { const a = -Math.PI / 2 + (2 * Math.PI * i) / ring.length; pos[k] = [960 + 520 * Math.cos(a), 560 + 300 * Math.sin(a)]; });
    let out = U.bg();
    (p.links || []).forEach(([a, b], k) => { if (!pos[a] || !pos[b]) return; const len = Math.hypot(pos[b][0] - pos[a][0], pos[b][1] - pos[a][1]); out += `<path d="M${pos[a][0]} ${pos[a][1]}L${pos[b][0]} ${pos[b][1]}" stroke="${th.line}" stroke-width="5" stroke-dasharray="${len.toFixed(0)}" stroke-dashoffset="${len.toFixed(0)}"${U.A('draw', 0.3 + k * 0.05, 0.12, { l: len.toFixed(0) })}/>`; });
    Nd.forEach((n, k) => { const [x, y] = pos[k], big = k === ci, r = big ? 95 : 70; out += `<g${U.A('pop', 0.04 + k * 0.05, 0.05, { cx: x, cy: y })}><circle cx="${x}" cy="${y}" r="${r}" fill="${big ? th.accent : th.surface}" stroke="${th.accent}" stroke-width="5"/>${n.icon ? U.icon(n.icon, x, y, r * 1.0, big ? th.bg : th.accent) : ''}${U.T(x, y + r + 40, n.label, { s: 32, w: 600 })}</g>`; });
    return out;
  },
});
register('zoom_into', {
  cat: 'Relations', title: 'Zoom into', desc: 'The camera dives in through several levels, from the big to the small.', use: 'From body to cell, from country to city, from galaxy to planet.',
  params: 'levels: [{label, icon}] (biggest first)', example: { levels: [{ label: 'The body', icon: 'person' }, { label: 'Organ', icon: 'heart' }, { label: 'Cell', icon: 'cell' }, { label: 'Molecule', icon: 'atom' }] },
  ownCamera: true,
  build(p, c) {
    const { U, th } = c, id = c.id, Lv = (p.levels || []).slice(0, 5);
    return U.bg() + `<defs><clipPath id="${id}lens"><circle cx="960" cy="540" r="334"/></clipPath></defs><g clip-path="url(#${id}lens)"><g id="${id}z">` + Lv.map((l, k) => { const s = Math.pow(6, -k); return `<g id="${id}g${k}" transform="translate(960 540) scale(${s}) translate(-960 -540)"><circle cx="960" cy="540" r="330" fill="${k % 2 ? th.bg : th.surface}" stroke="${th.accent}" stroke-width="8"/>${U.icon(l.icon || 'dot', 960, 470, 260, k % 2 ? th.accent : th.accent2)}</g>`; }).join('') + `</g></g><circle cx="960" cy="540" r="330" fill="none" stroke="${th.accent}" stroke-width="8"/>` +
      Lv.map((l, k) => U.T(960, 945, l.label, { fam: 'd', s: 60, w: 700, id: id + 'l' + k, op: 0 })).join('');
  },
  init(g, p, c) { const n = (p.levels || []).length; return { z: g.querySelector('#' + c.id + 'z'), labs: Array.from({ length: n }, (_, k) => g.querySelector('#' + c.id + 'l' + k)), lv: Array.from({ length: n }, (_, k) => g.querySelector('#' + c.id + 'g' + k)), n }; },
  render(l, st, p, c) {
    const { U } = c, f = U.ease.io(U.prog(l.p, 0.08, 0.85)) * (st.n - 1), s = Math.pow(6, f);
    st.z.setAttribute('transform', `translate(960 540) scale(${s.toFixed(4)}) translate(-960 -540)`);
    st.labs.forEach((e, k) => e.setAttribute('opacity', Math.max(0, 1 - Math.abs(f - k) * 2.2).toFixed(3)));
    st.lv.forEach((e, k) => e.setAttribute('opacity', (1 - U.clamp((f - k - 0.55) / 0.35, 0, 1)).toFixed(3)));
  },
});
