// Templates for numbers, shares and gauges: Trym's code from his film engine (templates/tall.js), adapted for Meko
// with English text and the Night atlas theme. See ../engine.js for how templates work.
import { register, preset } from "../engine.js";

const cnt = (U, at, d, to, o = {}) => U.A('count', at, d, { from: o.from || 0, to, dec: o.dec || 0, pre: o.pre || '', suf: o.suf || '', sep: o.sep || '' });
register('big_number', {
  cat: 'Numbers', title: 'Big number', desc: 'One number that counts up, with a label and an optional icon.', use: 'One number that should stick: a count, an amount, a percentage.',
  params: 'value, decimals, prefix, suffix, label, sub, icon, color, from, at, dur', example: { value: 17000, label: 'sentenced to death and executed', sub: 'during the Terror, 1793–1794', icon: 'warning' },
  build(p, c) {
    const { U, th } = c, col = p.color || th.accent, hi = !!p.icon, y = hi ? 620 : 570;
    return U.bg() + (hi ? U.popIcon(p.icon, 960, 300, 150, col, 0.02, 0.06) : '') +
      U.T(960, y, (p.prefix || '') + '0' + (p.suffix || ''), { fam: 'd', s: 230, w: 700, f: col, an: cnt(U, p.at ?? 0.06, p.dur ?? 0.5, p.value, { dec: p.decimals, pre: p.prefix, suf: p.suffix, from: p.from }) }) +
      U.T(960, y + 90, U.lab(p.label || ''), { s: 42, w: 600, ls: th.upper ? 6 : 0, an: U.A('up', 0.3, 0.08) }) +
      (p.sub ? U.T(960, y + 146, p.sub, { s: 32, f: th.muted, an: U.A('up', 0.36, 0.08) }) : '');
  },
});
register('stat_trio', {
  cat: 'Numbers', title: 'Key numbers side by side', desc: 'Two to four numbers that each count up.', use: 'A summary of several numbers on the same subject.',
  params: 'stats: [{value, decimals, prefix, suffix, label, sub, sep ("none" for years)}]', example: { stats: [{ value: 112, label: 'delegates' }, { value: 57, label: 'officials' }, { value: 37, label: 'farmers' }] },
  build(p, c) {
    const { U, th } = c, S = (p.stats || []).slice(0, 4), N = Math.max(1, S.length), w = 1600 / N;
    // Every number gets the same size, small enough that the longest, like "75 million", fits its column (added for
    // Meko: long numbers ran into each other).
    const widest = Math.max(...S.map((s) => U.tw(`${s.prefix || ''}${U.fmtNum(s.value, s.decimals || 0)}${s.suffix || ''}`, 150, { fam: 'd', w: 700 })), 1);
    const size = Math.min(150, Math.floor((150 * (w - 70)) / widest));
    return U.bg() + S.map((s, k) => {
      const x = 160 + w * (k + 0.5), at = p.times?.[k] ?? 0.06 + k * 0.12;
      return U.T(x, 540, '0', { fam: 'd', s: size, w: 700, f: k % 2 ? th.accent2 : th.accent, an: cnt(U, at, 0.35, s.value, { dec: s.decimals, pre: s.prefix, suf: s.suffix, sep: s.sep }) }) +
        U.T(x, 615, U.lab(s.label || ''), { s: 34, w: 600, an: U.A('up', at + 0.1, 0.08) }) + (s.sub ? U.T(x, 665, s.sub, { s: 28, f: th.muted, an: U.A('up', at + 0.14, 0.08) }) : '') +
        (k ? `<path d="M${160 + w * k} 380V700" stroke="${th.line}" stroke-width="3" stroke-dasharray="320" stroke-dashoffset="320"${U.A('draw', 0.04, 0.15, { l: 320 })}/>` : '');
    }).join('');
  },
});
register('uncertainty_range', {
  cat: 'Fact check', title: 'Uncertain range', desc: 'A number given as a range. The certain part is solid and the uncertain part striped.', use: 'When the sources give a range instead of one number.',
  params: 'low, high, decimals, unit, label, note, max, certainLabel, uncertainLabel', example: { low: 35000, high: 40000, max: 45000, label: 'Deaths during the Terror', note: 'Including those killed without a trial', certainLabel: 'At least', uncertainLabel: 'Uncertain' },
  build(p, c) {
    const { U, th } = c, id = c.id, max = p.max || p.high * 1.25, x0 = 260, x1 = 1660, X = (v) => x0 + ((x1 - x0) * v) / max, f = (v) => U.fmtNum(v, p.decimals || 0, Math.abs(p.high) >= 10000 ? 'always' : '');
    return U.bg() + `<defs><pattern id="${id}st" width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="10" height="22" fill="${th.accent}" fill-opacity=".6"/></pattern></defs>` +
      U.T(960, 300, U.lab(p.label || ''), { s: 38, w: 600, ls: th.upper ? 6 : 0, an: U.A('fade', 0.02, 0.06) }) +
      U.T(960, 460, f(p.low) + '–' + f(p.high) + (p.unit ? ' ' + p.unit : ''), { fam: 'd', s: 130, w: 700, f: th.accent, an: U.A('up', 0.06, 0.1) }) +
      `<rect x="${x0}" y="600" width="${X(p.low) - x0}" height="80" fill="${th.accent}"${U.A('grow', 0.22, 0.25, { ax: 'x', cx: x0, cy: 640 })}/>` +
      `<rect x="${X(p.low)}" y="600" width="${X(p.high) - X(p.low)}" height="80" fill="url(#${id}st)" stroke="${th.accent}" stroke-width="3" stroke-dasharray="10 8" opacity="0"${U.A('fade', 0.5, 0.1)}/>` +
      `<path d="M${x0} 700H${x1}" stroke="${th.line}" stroke-width="3"/>` +
      [[0, '0'], [p.low, f(p.low)], [p.high, f(p.high)]].map(([v, t], k) => U.T(X(v), 740, t, { s: 26, f: th.muted, an: U.A('fade', 0.25 + k * 0.12, 0.06) })).join('') +
      U.T((x0 + X(p.low)) / 2, 580, U.lab(p.certainLabel || 'Certain'), { s: 26, w: 600, f: th.ink, an: U.A('fade', 0.4, 0.06) }) +
      U.T((X(p.low) + X(p.high)) / 2, 580, U.lab(p.uncertainLabel || 'Uncertain'), { s: 26, w: 600, f: th.muted, an: U.A('fade', 0.56, 0.06) }) +
      (p.note ? U.T(960, 830, p.note, { s: 32, f: th.muted, an: U.A('up', 0.62, 0.08) }) : '');
  },
});
register('unit_grid', {
  cat: 'Numbers', title: 'Share grid', desc: 'Figures in a grid appear while the number counts up. A figure can be a dot, an icon or a tally mark.', use: 'Shares like “98 out of 100” or “3 out of 10”.',
  params: 'total, value, cols, icon (dot|tally|icon name), color, rest, label, sub, at, dur, countTo, prefix, suffix',
  example: { total: 100, value: 98, label: 'out of 100 French people', sub: 'were in the Third Estate' },
  build(p, c) {
    const { U, th } = c, total = p.total || 100, cols = p.cols || 10, rows = Math.ceil(total / cols), cell = p.cell || Math.min(62, Math.floor(600 / Math.max(cols, rows * 0.9)));
    const gx = p.gridX ?? 1260 - ((cols - 1) * cell) / 2, gy = p.gridY ?? Math.round(540 - ((rows - 1) * cell) / 2), col = p.color || th.accent, rest = p.rest || th.line;
    const a = p.at ?? 0.08, d = p.dur ?? 0.5;
    let out = U.bg();
    for (let i = 0; i < total; i++) {
      const x = gx + (i % cols) * cell, y = gy + Math.floor(i / cols) * cell, f = i < p.value ? col : rest, ic = p.icon || 'dot';
      const shape = ic === 'dot' ? `<ellipse cx="${x}" cy="${y + cell * 0.15}" rx="${cell * 0.35}" ry="${cell * 0.21}" fill="${f}" opacity=".8"/><circle cx="${x}" cy="${y}" r="${cell * 0.21}" fill="${f}"/>`
        : ic === 'tally' ? `<rect x="${x - cell * 0.12}" y="${y - cell * 0.4}" width="${cell * 0.24}" height="${cell * 0.8}" rx="${cell * 0.08}" fill="${f}"/>` : U.icon(ic, x, y, cell * 0.85, f);
      out += `<g${U.A('pop', a + (i / total) * d, 0.05, { cx: x, cy: y })}>${shape}</g>`;
    }
    return out + U.T(560, 560, '0', { fam: 'd', s: Math.min(260, 70000 / Math.max(1, U.tw((p.prefix || '') + U.fmtNum(p.countTo || p.value, 0) + (p.suffix || ''), 100, { fam: 'd', w: 700 }))), w: 700, f: col, an: cnt(U, a, d, p.countTo || p.value, { pre: p.prefix, suf: p.suffix }) }) +
      U.T(560, 640, U.lab(p.label || ''), { s: 36, w: 600, ls: th.upper ? 6 : 0, an: U.A('up', a + d * 0.5, 0.08) }) +
      (p.sub ? U.T(560, 690, p.sub, { s: 28, f: th.muted, an: U.A('up', a + d * 0.6, 0.08) }) : '');
  },
});
preset('icon_array', 'unit_grid', { title: 'Icon array', desc: 'A share shown with people or other icons.', use: 'Shares of people, houses, cars or anything else that can be counted.',
  defaults: { icon: 'person', total: 10, cols: 5, cell: 130 }, example: { value: 7, label: 'out of 10', sub: 'example data' } });
preset('tally_marks', 'unit_grid', { title: 'Tally marks', desc: 'One mark per unit, often with one mark standing for many.', use: 'Big numbers that should be felt, like losses or votes.',
  defaults: { icon: 'tally', total: 400, cols: 25, cell: 26 }, example: { value: 170, countTo: 17000, label: 'sentenced and executed', sub: 'one mark = 100 people' } });
register('year_roll', {
  cat: 'Time', title: 'Rolling year', desc: 'A year that rolls from one year to another.', use: 'Showing how much time has passed, or jumping in time.',
  params: 'from, to, label, sub', example: { from: 1614, to: 1789, label: 'The Estates-General meet again', sub: 'for the first time in 175 years' },
  build(p, c) {
    const { U, th } = c;
    return U.bg() + U.T(960, 600, String(p.from), { fam: 'd', s: 300, w: 700, f: th.accent, an: cnt(U, 0.08, 0.5, p.to, { from: p.from, sep: 'none' }) }) +
      U.T(960, 700, U.lab(p.label || ''), { s: 40, w: 600, ls: th.upper ? 6 : 0, an: U.A('up', 0.5, 0.08) }) + (p.sub ? U.T(960, 756, p.sub, { s: 32, f: th.muted, an: U.A('up', 0.56, 0.08) }) : '');
  },
});
register('gauge', {
  cat: 'Numbers', title: 'Gauge', desc: 'A half circle with zones and a needle that swings to the value.', use: 'Levels, risk, scores or ratings.',
  params: 'value, min, max, label, unit, decimals, zones: [{to, color}], minLabel, maxLabel', example: { value: 72, label: 'Turnout', unit: '%', minLabel: '0', maxLabel: '100' },
  build(p, c) {
    const { U, th } = c, min = p.min ?? 0, max = p.max ?? 100, cx = 960, cy = 760, R = 380, ang = (v) => -180 + (180 * (v - min)) / (max - min);
    const pt = (a, r = R) => [cx + r * Math.cos((a * Math.PI) / 180), cy + r * Math.sin((a * Math.PI) / 180)];
    // One plain band unless zones are given: red, amber and green zones would judge the value as bad or good (changed
    // for Meko).
    const zones = p.zones || [{ to: max, color: th.surface }];
    let from = min, out = U.bg() + U.T(960, 260, U.lab(p.label || ''), { s: 40, w: 600, ls: th.upper ? 6 : 0, an: U.A('fade', 0.02, 0.06) });
    zones.forEach((z, k) => { const a0 = pt(ang(from)), a1 = pt(ang(z.to)); out += `<path d="M${a0[0].toFixed(1)} ${a0[1].toFixed(1)}A${R} ${R} 0 0 1 ${a1[0].toFixed(1)} ${a1[1].toFixed(1)}" stroke="${z.color}" stroke-width="64" fill="none" opacity="0"${U.A('fade', 0.06 + k * 0.08, 0.08)}/>`; from = z.to; });
    return out + `<g transform=""${U.A('rot', 0.3, 0.35, { a0: -90, a1: ang(p.value) + 90, cx, cy })}><path d="M${cx - 12} ${cy}L${cx} ${cy - R + 80}L${cx + 12} ${cy}Z" fill="${th.ink}"/></g><circle cx="${cx}" cy="${cy}" r="26" fill="${th.ink}"/>` +
      U.T(cx, cy + 110, '0', { fam: 'd', s: 90, w: 700, f: th.accent, an: cnt(U, 0.3, 0.35, p.value, { dec: p.decimals, suf: p.unit || '' }) }) +
      U.T(pt(-180)[0], cy + 60, p.minLabel ?? String(min), { s: 30, f: th.muted }) + U.T(pt(0)[0], cy + 60, p.maxLabel ?? String(max), { s: 30, f: th.muted });
  },
});
preset('confidence_meter', 'gauge', { cat: 'Fact check', title: 'How sure is it', desc: 'A gauge from uncertain to certain.', use: 'Showing how well documented a claim is.',
  defaults: { min: 0, max: 100, minLabel: 'Uncertain', maxLabel: 'Certain', unit: '%' }, example: { value: 90, label: 'How sure is this?' } });
register('progress_bar', {
  cat: 'Numbers', title: 'Progress bar', desc: 'A bar that fills to a share, with a number counting up.', use: 'A share of a goal, progress or coverage.',
  params: 'value, max, label, sub, unit, color, decimals', example: { value: 40, max: 100, unit: '%', label: 'Share of men who could vote', sub: 'example data' },
  build(p, c) {
    const { U, th } = c, max = p.max ?? 100, w = 1200, fw = (w * p.value) / max, col = p.color || th.accent;
    return U.bg() + U.wrap(p.label || '', 50).slice(0, 2).map((l, k) => U.T(360, 400 + k * 52, l, { a: 'start', s: 42, w: 600, an: U.A('fade', 0.02, 0.06) })).join('') +
      `<rect x="360" y="520" width="${w}" height="70" rx="35" fill="${th.surface}" stroke="${th.line}" stroke-width="2"/><rect x="360" y="520" width="0" height="70" rx="35" fill="${col}"${U.A('wipe', 0.12, 0.45, { w: fw })}/>` +
      U.T(1560, 690, '0', { a: 'end', fam: 'd', s: 90, w: 700, f: col, an: cnt(U, 0.12, 0.45, p.value, { dec: p.decimals, suf: p.unit || '' }) }) +
      (p.sub ? U.T(360, 680, p.sub, { a: 'start', s: 30, f: th.muted, an: U.A('fade', 0.5, 0.08) }) : '');
  },
});
register('thermometer', {
  cat: 'Numbers', title: 'Thermometer', desc: 'A thermometer that rises to the value.', use: 'Temperature, tension, support or pressure that rises.',
  params: 'value, min, max, label, sub, unit, decimals', example: { value: 1.2, min: 0, max: 2, unit: ' °C', label: 'Warming since pre-industrial times', sub: 'example data' },
  build(p, c) {
    const { U, th } = c, min = p.min ?? 0, max = p.max ?? 100, h = (480 * (p.value - min)) / (max - min);
    return U.bg() + `<rect x="900" y="240" width="120" height="540" rx="60" fill="${th.surface}" stroke="${th.line}" stroke-width="4"/><circle cx="960" cy="800" r="80" fill="${th.bad}"/>` +
      `<rect x="925" y="${760 - h}" width="70" height="${h + 20}" rx="35" fill="${th.bad}"${U.A('grow', 0.1, 0.5, { cx: 960, cy: 780 })}/>` +
      [0, 0.25, 0.5, 0.75, 1].map((f) => `<path d="M1030 ${760 - 480 * f}H1060" stroke="${th.muted}" stroke-width="3"/>` + U.T(1075, 768 - 480 * f, U.fmtNum(min + f * (max - min), p.decimals ?? 1), { a: 'start', s: 24, f: th.muted })).join('') +
      U.T(1260, 520, '0', { a: 'start', fam: 'd', s: 120, w: 700, f: th.bad, an: cnt(U, 0.1, 0.5, p.value, { dec: p.decimals ?? 1, suf: p.unit || '' }) }) +
      U.wrap(p.label || '', 26).slice(0, 3).map((l, k) => U.T(1260, 600 + k * 46, l, { a: 'start', s: 36, an: U.A('fade', 0.4, 0.08) })).join('') +
      (p.sub ? U.T(1260, 600 + 3 * 46 + 10, p.sub, { a: 'start', s: 28, f: th.muted, an: U.A('fade', 0.5, 0.08) }) : '');
  },
});
