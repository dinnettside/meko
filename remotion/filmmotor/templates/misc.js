// Templates for sport, health, geography and more: Trym's code from his film engine (templates/diverse.js, without
// the flag, photo, weather and world clock templates), adapted for Meko with English text and the Night atlas theme.
// See ../engine.js for how templates work.
import { register, H } from "../engine.js";

const CSP = 'Sport and health', CG = 'Geography', CD = 'Misc';
const N = (U, v, d = 1) => { const r = Math.round(v * Math.pow(10, d)) / Math.pow(10, d); return U.fmtNum(r, Number.isInteger(r) ? 0 : d); };
register('ecg_heartbeat', {
  cat: CSP, title: 'Heartbeat', desc: 'An ECG trace scrolling across the screen, with a heart beating in time and the pulse beside it.', use: 'Pulse, exercise, health and the body.',
  params: 'bpm, label', example: { bpm: 72, label: 'Resting pulse' },
  build(p, c) {
    const { U, th } = c, id = c.id;
    let o = U.bg(); for (let x = 160; x <= 1400; x += 40) o += `<path d="M${x} 300V820" stroke="${th.line}" stroke-width="1" opacity=".5"/>`; for (let y = 300; y <= 820; y += 40) o += `<path d="M160 ${y}H1400" stroke="${th.line}" stroke-width="1" opacity=".5"/>`;
    return o + `<path id="${id}e" fill="none" stroke="${th.bad}" stroke-width="6" stroke-linejoin="round"/><g id="${id}h">${U.icon('heart', 1580, 470, 170, th.bad)}</g>` + U.T(1580, 680, String(p.bpm ?? 72), { fam: 'd', s: 110, w: 700 }) + U.T(1580, 740, 'beats per minute', { s: 28, f: th.muted }) + (p.label ? U.T(1580, 300, p.label, { s: 34, w: 700 }) : '');
  },
  init(g, p, c) { return { e: g.querySelector('#' + c.id + 'e'), h: g.querySelector('#' + c.id + 'h') }; },
  render(l, st, p) {
    const per = 60 / (p.bpm ?? 72), pxs = 260, beat = (u) => { const f = u % 1; return f < 0.1 ? 0 : f < 0.14 ? -30 * Math.sin(((f - 0.1) / 0.04) * Math.PI) : f < 0.18 ? 0 : f < 0.2 ? 30 : f < 0.23 ? -200 : f < 0.26 ? 80 : f < 0.4 ? 0 : f < 0.5 ? -45 * Math.sin(((f - 0.4) / 0.1) * Math.PI) : 0; };
    let d = ''; for (let x = 160; x <= 1400; x += 4) { const tt = l.t - (1400 - x) / pxs; d += (x === 160 ? 'M' : 'L') + x + ' ' + (560 + beat(tt / per)).toFixed(1); } st.e.setAttribute('d', d);
    const f = (l.t / per) % 1, s = 1 + 0.12 * Math.max(0, 1 - Math.abs(f - 0.22) / 0.1); st.h.setAttribute('transform', `translate(1580 470) scale(${s.toFixed(3)}) translate(-1580 -470)`);
  },
});
register('podium', {
  cat: CSP, title: 'Podium', desc: 'A podium with first place in the middle, second on the left and third on the right, with names and medals.', use: 'Results, rankings and awards.',
  params: 'first, second, third (names), title, values: [first, second, third]', example: { title: 'Biggest ports (example data)', first: 'Port A', second: 'Port B', third: 'Port C' },
  build(p, c) {
    const { U, th } = c, P = [[p.second, 2, 640, 300, '#c0c4cc'], [p.first, 1, 960, 420, '#e3b25c'], [p.third, 3, 1280, 220, '#c8865a']];
    return U.bg() + H.title(U, th, p.title, 200) + P.map(([n, r, x, h, col], k) => { const at = [0.3, 0.5, 0.1][k]; return `<rect x="${x - 150}" y="${880 - h}" width="300" height="${h}" fill="${th.surface}" stroke="${th.line}" stroke-width="3"${U.A('grow', at, 0.12, { cx: x, cy: 880 })}/>` + U.T(x, 880 - h / 2 + 30, String(r), { fam: 'd', s: 110, w: 700, f: th.line, an: U.A('fade', at + 0.1, 0.05) }) + `<g${U.A('pop', at + 0.14, 0.05, { cx: x, cy: 880 - h - 110 })}><circle cx="${x}" cy="${880 - h - 110}" r="46" fill="${col}"/>${U.T(x, 880 - h - 96, String(r), { fam: 'd', s: 44, w: 700, f: '#2a1a10' })}</g>` + U.T(x, 880 - h - 30, n || '', { s: 38, w: 700, an: U.A('fade', at + 0.16, 0.05) }) + (p.values && p.values[r - 1] != null ? U.T(x, 880 - h + 60, String(p.values[r - 1]), { s: 30, f: th.muted }) : ''); }).join('');
  },
});
register('match_score', {
  cat: CSP, title: 'Match score', desc: 'A scoreboard with the team names, goals that count up and the minute of the match.', use: 'Sport, contests and games.',
  params: 'home, away, homeScore, awayScore, minute, title', example: { title: 'Example match', home: 'Home team', away: 'Away team', homeScore: 2, awayScore: 1, minute: "90'" },
  build(p, c) {
    const { U, th } = c;
    return U.bg() + H.title(U, th, p.title, 280) + `<g${U.A('pop', 0.04, 0.06, { cx: 960, cy: 540 })}>${U.card(360, 380, 1200, 320, { f: th.surface, s: th.line, sw: 3, r: 30 })}<rect x="900" y="380" width="120" height="320" fill="${th.accent}" opacity=".15"/>${U.T(630, 520, p.home || '', { s: 44, w: 700 })}${U.T(1290, 520, p.away || '', { s: 44, w: 700 })}${U.T(960, 740, p.minute || '', { s: 34, w: 700, f: th.bad })}</g>` +
      U.T(760, 640, '0', { fam: 'd', s: 140, w: 700, f: th.accent, an: U.A('count', 0.2, 0.4, { from: 0, to: p.homeScore ?? 0, dec: 0 }) }) + U.T(960, 620, '–', { fam: 'd', s: 90, w: 700 }) + U.T(1160, 640, '0', { fam: 'd', s: 140, w: 700, f: th.accent2, an: U.A('count', 0.2, 0.4, { from: 0, to: p.awayScore ?? 0, dec: 0 }) });
  },
});
register('race_lanes', {
  cat: CSP, title: 'Race lanes', desc: 'Runners in their own lanes who each go as far as their value. Turns a comparison into a race.', use: 'Speeds, records and comparisons that should be felt.',
  params: 'lanes: [{label, value, icon}], unit, title', example: { title: 'Top speed (approximate)', lanes: [{ label: 'Human', value: 44, icon: 'person' }, { label: 'Horse', value: 88, icon: 'star' }, { label: 'Car', value: 200, icon: 'car' }], unit: ' km/h' },
  build(p, c) {
    const { U, th } = c, Ln = (p.lanes || []).slice(0, 6), max = Math.max(...Ln.map((q) => q.value)), rh = Math.min(150, 600 / Math.max(1, Ln.length)), cols = th.series;
    let o = U.bg() + H.title(U, th, p.title, 200) + `<path d="M1600 260V${280 + Ln.length * rh}" stroke="${th.ink}" stroke-width="6" stroke-dasharray="14 10"/>`;
    Ln.forEach((q, k) => { const y = 290 + k * rh + rh / 2, x1 = 360 + (1200 * q.value) / max; o += `<path d="M300 ${y + rh / 2 - 6}H1640" stroke="${th.line}" stroke-width="2"/>` + U.T(280, y + 10, q.label, { a: 'end', s: 30, w: 700 }) + `<g${U.A('move', 0.12, 0.6, { x0: 0, y0: 0, x1: x1 - 360, y1: 0 })}>${U.icon(q.icon || 'person', 360, y - 6, Math.min(90, rh * 0.7), cols[k % 6])}</g>` + U.T(x1 + 60, y + 10, N(U, q.value) + (p.unit || ''), { a: 'start', s: 30, w: 700, f: cols[k % 6], an: U.A('fade', 0.72, 0.05) }); });
    return o;
  },
});
register('rating_stars', {
  cat: CD, title: 'Star rating', desc: 'Stars that fill up to a rating, halves too.', use: 'Reviews, ratings and grades.',
  params: 'value, max, label', example: { value: 4.5, max: 5, label: 'Rating from the critics (example)' },
  build(p, c) {
    const { U, th } = c, id = c.id, m = p.max ?? 5, v = p.value ?? 4, w = 1400 / m, star = (x) => `M${x} 440L${x + 28} 506L${x + 98} 506L${x + 42} 548L${x + 62} 618L${x} 576L${x - 62} 618L${x - 42} 548L${x - 98} 506L${x - 28} 506Z`;
    let o = U.bg() + `<defs><clipPath id="${id}c"><rect x="${960 - (m * w) / 2}" y="400" width="0" height="260"${U.A('wipe', 0.15, 0.5, { w: (v / m) * m * w })}/></clipPath></defs>`;
    for (let k = 0; k < m; k++) { const x = 960 - (m * w) / 2 + w * (k + 0.5); o += `<path d="${star(x)}" fill="${th.surface}" stroke="${th.line}" stroke-width="4"/>`; }
    o += `<g clip-path="url(#${id}c)">`; for (let k = 0; k < m; k++) { const x = 960 - (m * w) / 2 + w * (k + 0.5); o += `<path d="${star(x)}" fill="${th.warn}"/>`; } o += '</g>';
    return o + U.T(960, 760, N(U, v) + ' of ' + m, { fam: 'd', s: 70, w: 700, an: U.A('fade', 0.6, 0.06) }) + (p.label ? U.T(960, 340, p.label, { s: 36, w: 600, an: U.A('fade', 0.02, 0.06) }) : '');
  },
});
register('countdown', {
  cat: CD, title: 'Countdown', desc: 'Numbers counting down with a ring going round, before a word lands.', use: 'Suspense before a reveal or a start.',
  params: 'from, label', example: { from: 3, label: 'The answer is …' },
  build(p, c) {
    const { U, th } = c, n = Math.min(10, p.from ?? 3), seg = 0.75 / n, C = (2 * Math.PI * 220).toFixed(0);
    let o = U.bg() + `<circle cx="960" cy="540" r="220" fill="none" stroke="${th.line}" stroke-width="16"/>`;
    for (let k = 0; k < n; k++) { const at = 0.02 + k * seg; o += `<g opacity="0"${U.A('fade', at, 0.01)}><g${U.A('dim', at + seg * 0.97, 0.01, { to: 0 })}><circle cx="960" cy="540" r="220" fill="none" stroke="${th.accent}" stroke-width="16" stroke-dasharray="${C}" stroke-dashoffset="${C}" transform="rotate(-90 960 540)"${U.A('draw', at, seg, { l: C })}/>${U.T(960, 600, String(n - k), { fam: 'd', s: 220, w: 700, f: th.ink })}</g></g>`; }
    return o + U.T(960, 600, p.label || '', { fam: 'd', s: 90, w: 700, f: th.accent, an: U.A('stamp', 0.8, 0.05, { cx: 960, cy: 570 }) });
  },
});
register('did_you_know', {
  cat: 'Text', title: 'Did you know', desc: 'A fact card with a light bulb and a surprising piece of information.', use: 'Fun facts and surprises that hold the attention.',
  params: 'label, fact, source', example: { label: 'Did you know …', fact: 'the Bastille held only seven prisoners when it was stormed in 1789?', source: 'Source: Example Encyclopedia (2024)' },
  build(p, c) {
    const { U, th } = c, L = U.wrap(p.fact || '', 34).slice(0, 4);
    return U.bg() + U.popIcon('bulb', 420, 500, 260, th.warn, 0.04, 0.06) + U.T(640, 350, p.label || 'Did you know …', { a: 'start', s: 44, w: 700, f: th.accent, an: U.A('left', 0.12, 0.06) }) +
      L.map((l, k) => U.T(640, 450 + k * 74, l, { a: 'start', fam: 'd', s: 60, w: 700, an: U.A('up', 0.2 + k * 0.06, 0.08) })).join('') + (p.source ? U.T(640, 470 + L.length * 74 + 30, p.source, { a: 'start', s: 26, f: th.muted, an: U.A('fade', 0.5, 0.06) }) : '');
  },
});
register('lower_third', {
  cat: 'Text', title: 'Name plate', desc: 'A name plate that slides in at the lower left, as in a documentary.', use: 'Introducing a person, a place or a source.',
  params: 'name, role, icon', example: { name: 'Olympe de Gouges', role: 'Writer, 1748–1793', icon: 'woman' },
  build(p, c) {
    const { U, th } = c;
    return U.bg() + U.icon(p.icon || 'person', 960, 470, 420, th.line) + `<g${U.A('left', 0.1, 0.08)}><rect x="160" y="700" width="14" height="150" fill="${th.accent}"/>${U.card(174, 700, 760, 150, { f: th.surface, r: 0 })}${U.T(210, 770, p.name || '', { a: 'start', fam: 'd', s: 56, w: 700 })}${U.T(210, 822, p.role || '', { a: 'start', s: 32, f: th.muted })}</g>`;
  },
});
register('end_card', {
  cat: 'Text', title: 'End card', desc: 'A closing card with a title, a few lines and a thank-you.', use: 'The end of a video.',
  params: 'title, lines, thanks', example: { title: 'When the people rose', lines: ['Script and story: Trym', 'Sources: Example Encyclopedia and others'], thanks: 'Thanks for watching' },
  build(p, c) {
    const { U, th } = c, L = p.lines || [];
    return U.bg() + U.T(960, 400, p.title || '', { fam: 'd', s: 90, w: 700, an: U.A('up', 0.04, 0.1) }) + H.line(U, 760, 450, 1160, 450, th.accent, 4, 0.15, 0.12) + L.map((l, k) => U.T(960, 540 + k * 52, l, { s: 34, f: th.muted, an: U.A('fade', 0.25 + k * 0.06, 0.06) })).join('') + U.T(960, 560 + L.length * 52 + 80, p.thanks || 'Thanks for watching', { fam: 'd', s: 50, w: 700, f: th.accent, an: U.A('fade', 0.5, 0.08) });
  },
});
register('top_list', {
  cat: 'Text', title: 'Top list', desc: 'A top list counted down from last place to first, with the winner last.', use: 'Top fives, the main causes, the biggest, the oldest and the like.',
  params: 'title, items (best first)', example: { title: 'Five key years for democracy in Norway', items: ['1814: The constitution', '1913: Women get the vote', '1898: All men get the vote', '1884: Parliamentarism', '1905: The union ends'] },
  build(p, c) {
    const { U, th } = c, I = (p.items || []).slice(0, 6), n = I.length, rh = Math.min(110, 600 / Math.max(1, n));
    return U.bg() + H.title(U, th, p.title, 210) + I.map((it, k) => { const y = 300 + k * rh, at = 0.1 + (n - 1 - k) * (0.65 / n), top = k === 0; return `<g${U.A('left', at, 0.06)}>${U.card(400, y, 1120, rh - 16, { f: top ? th.accent : th.surface, s: th.line, sw: 2 })}${U.T(460, y + rh / 2 + 6, String(k + 1), { fam: 'd', s: 56, w: 700, f: top ? th.bg : th.accent })}${U.T(540, y + rh / 2 + 4, it, { a: 'start', s: 38, w: 600, f: top ? th.bg : th.ink })}</g>`; }).join('');
  },
});
register('speech_bubbles', {
  cat: CD, title: 'Speech bubbles', desc: 'Two or three figures with speech bubbles that appear in turn.', use: 'Dialogues, opinions, debates and different points of view.',
  params: 'speakers: [{icon, name, text}]', example: { speakers: [{ icon: 'person', name: 'Revolutionary', text: 'We must change everything now!' }, { icon: 'woman', name: 'Reformer', text: 'Change takes time, but it lasts.' }] },
  build(p, c) {
    const { U, th } = c, S = (p.speakers || []).slice(0, 3), n = Math.max(1, S.length), w = 1600 / n, cols = th.series;
    return U.bg() + S.map((s, k) => { const x = 160 + w * (k + 0.5), at = 0.08 + k * (0.6 / n), L = U.wrap(s.text || '', 22).slice(0, 4), bh = 50 + L.length * 46; return U.icon(s.icon || 'person', x, 760, 220, cols[k % 3]) + U.T(x, 920, s.name || '', { s: 30, w: 700 }) + `<g${U.A('pop', at, 0.06, { cx: x, cy: 520 - bh / 2 })}>${U.card(x - 230, 560 - bh - 40, 460, bh, { f: th.surface, s: cols[k % 3], sw: 4, r: 30 })}<path d="M${x - 20} ${520}L${x} 580L${x + 24} ${520}" fill="${th.surface}" stroke="${cols[k % 3]}" stroke-width="4"/>${L.map((l, i) => U.T(x, 560 - bh - 40 + 64 + i * 46, l, { s: 34, w: 600 })).join('')}</g>`; }).join('');
  },
});
register('climate_chart', {
  cat: CG, title: 'Climate chart', desc: 'Rainfall as bars and temperature as a line for each month of the year.', use: 'Climate and geography: comparing places and seasons.',
  params: 'place, temps: [12 numbers, °C], precip: [12 numbers, mm]', example: { place: 'Example place (example data)', temps: [-4, -3, 1, 6, 11, 15, 17, 16, 11, 6, 1, -3], precip: [50, 35, 40, 40, 55, 70, 80, 90, 85, 90, 75, 55] },
  build(p, c) {
    const { U, th } = c, T = p.temps || [], P = p.precip || [], m = 'JFMAMJJASOND'.split(''), L = 360, R = 1500, B = 840, Tp = 260, X = (k) => L + ((R - L) * (k + 0.5)) / 12, pmax = Math.max(100, ...P), tmin = Math.min(-10, ...T), tmax = Math.max(25, ...T), Yp = (v) => B - ((B - Tp) * v) / pmax, Yt = (v) => B - ((B - Tp) * (v - tmin)) / (tmax - tmin);
    let o = U.bg() + H.title(U, th, p.place, 200) + `<path d="M${L} ${B}H${R}M${L} ${Tp}V${B}M${R} ${Tp}V${B}" stroke="${th.ink}" stroke-width="3"/>` + U.T(L - 20, Tp - 20, 'mm', { a: 'end', s: 24, f: th.accent2 }) + U.T(R + 20, Tp - 20, '°C', { a: 'start', s: 24, f: th.bad });
    P.forEach((v, k) => { o += `<rect x="${X(k) - 32}" y="${Yp(v)}" width="64" height="${B - Yp(v)}" fill="${th.accent2}" opacity=".7"${U.A('grow', 0.08 + k * 0.03, 0.06, { cx: X(k), cy: B })}/>` + U.T(X(k), B + 40, m[k], { s: 26, f: th.muted }); });
    const pts = T.map((v, k) => [X(k), Yt(v)]), len = H.polyLen(pts).toFixed(0);
    o += `<path d="M${pts.map((q) => q.map((v) => v.toFixed(1)).join(' ')).join('L')}" fill="none" stroke="${th.bad}" stroke-width="6" stroke-dasharray="${len}" stroke-dashoffset="${len}"${U.A('draw', 0.5, 0.3, { l: len })}/>` + (tmin < 0 ? `<path d="M${L} ${Yt(0)}H${R}" stroke="${th.bad}" stroke-width="1.5" stroke-dasharray="8 8" opacity=".6"/>` : '');
    for (let k = 0; k <= 4; k++) { const v = Math.round(tmin + ((tmax - tmin) * k) / 4); o += U.T(R + 14, Yt(v) + 8, String(v), { a: 'start', s: 22, f: th.bad }); const pv = Math.round((pmax * k) / 4); o += U.T(L - 14, Yp(pv) + 8, String(pv), { a: 'end', s: 22, f: th.accent2 }); }
    return o;
  },
});
register('compass_rose', {
  cat: CG, title: 'Compass', desc: 'A compass whose needle swings round to a direction.', use: 'Points of the compass, maps and finding the way.',
  params: 'direction (degrees, 0 = north), label', example: { direction: 135, label: 'Southeast' },
  build(p, c) {
    const { U, th } = c, cx = 960, cy = 540, R = 300, d = p.direction ?? 0;
    let o = U.bg() + `<circle cx="${cx}" cy="${cy}" r="${R}" fill="${th.surface}" stroke="${th.ink}" stroke-width="8"/>`;
    for (let a = 0; a < 360; a += 15) { const r = (a * Math.PI) / 180, l = a % 90 === 0 ? 40 : a % 45 === 0 ? 26 : 14; o += `<path d="M${(cx + R * Math.sin(r)).toFixed(1)} ${(cy - R * Math.cos(r)).toFixed(1)}L${(cx + (R - l) * Math.sin(r)).toFixed(1)} ${(cy - (R - l) * Math.cos(r)).toFixed(1)}" stroke="${th.ink}" stroke-width="3"/>`; }
    [['N', 0], ['E', 90], ['S', 180], ['W', 270]].forEach(([t, a]) => { const r = (a * Math.PI) / 180; o += U.T((cx + (R - 80) * Math.sin(r)).toFixed(1), (cy - (R - 80) * Math.cos(r) + 18).toFixed(1), t, { fam: 'd', s: 52, w: 700, f: t === 'N' ? th.bad : th.ink }); });
    return o + `<g${U.A('rot', 0.1, 0.5, { a0: 0, a1: d, cx, cy })}><path d="M${cx} ${cy - R + 70}L${cx + 26} ${cy}L${cx} ${cy + 24}L${cx - 26} ${cy}Z" fill="${th.bad}"/><path d="M${cx} ${cy + R - 70}L${cx + 26} ${cy}L${cx - 26} ${cy}Z" fill="${th.muted}"/></g><circle cx="${cx}" cy="${cy}" r="14" fill="${th.ink}"/>` + (p.label ? U.T(cx, cy + R + 80, p.label + ' (' + d + '°)', { fam: 'd', s: 50, w: 700, an: U.A('fade', 0.6, 0.06) }) : '');
  },
});
