// More ways to draw the kinds of scene that come up in almost every video (a quote, a list, a statement, steps and a
// number), so two videos with the same kinds of scene look less alike. Each redraws only what its scene already shows.
// See ../engine.js for how templates work, and lib/looks-more.ts for which scenes can use each.
import { register } from "../engine.js";

const f1 = (n) => Number(n).toFixed(1);
// Single quotation marks and guillemets as the pairs a quote can be wrapped in. Double marks are paired by doubleMarks.
const SINGLE_WRAPS = ['‘’', "''", '«»'];
// A figure right before place i of a text: a digit, or a fraction like ½.
const afterFigure = (text, i) => /\p{N}/u.test(text[i - 1] || '');
// The double quotation marks of a text, paired: `partner` maps the place of each opening or closing mark to the place of
// its partner, `inch` holds the places of inch marks, and `german` the places of „…“ pairs. A straight mark opens at the
// start and after a space, a bracket, a dash, a colon or a hyphen, as in He said:"Never", and closes anywhere else. A
// closing mark right after a figure is an inch mark, as in 12" or 5’7”, when no quote is open, and also when the marks
// would not pair up otherwise, as in "a 12" gun that could sink anything." A „ is closed by the next “ or ”.
function doubleMarks(text) {
  const partner = new Map(), inch = new Set(), german = new Set();
  for (let i = text.indexOf('„'); i >= 0; i = text.indexOf('„', i + 1)) {
    let j = i + 1;
    while (j < text.length && !((text[j] === '“' || text[j] === '”') && !german.has(j))) j++;
    if (j >= text.length) continue;
    german.add(i).add(j);
    partner.set(i, j).set(j, i);
  }
  const pair = (open, close, forced) => {
    const stack = [], pairs = new Map(), inches = new Set();
    let unmatched = 0;
    for (let i = 0; i < text.length; i++) {
      if (german.has(i) || (text[i] !== open && text[i] !== close)) continue;
      if (open === close ? i === 0 || /[\s([{—–:-]/.test(text[i - 1]) : text[i] === open) stack.push(i);
      else if (forced === i || (!stack.length && afterFigure(text, i))) inches.add(i);
      else if (stack.length) { const j = stack.pop(); pairs.set(i, j).set(j, i); }
      else unmatched++;
    }
    return { pairs, inches, unmatched: unmatched + stack.length };
  };
  for (const [open, close] of [['“', '”'], ['"', '"']]) {
    let best = pair(open, close, -1);
    // Marks that do not pair up: the first closing mark after a figure may be an inch mark instead, when that pairs up more.
    const first = [...best.pairs].find(([i, j]) => i > j && afterFigure(text, i));
    if (best.unmatched && first) {
      const tried = pair(open, close, first[0]);
      if (tried.unmatched < best.unmatched) best = tried;
    }
    best.pairs.forEach((j, i) => partner.set(i, j));
    best.inches.forEach((i) => inch.add(i));
  }
  return { partner, inch, german };
}
// A quote without the quotation marks around it, since the templates draw their own, and with its words as the source
// has them. Only a pair around the whole quote goes, and a mark at its very start or end that has no partner, which is
// the other half of a pair the quote was cut from. Marks of a quoted word inside it ("“Glasnost” meant openness") stay,
// since they are the source's own, but a pair of double marks becomes single marks, the way a quote inside a quote is
// set. Inch marks, apostrophes, „…“ and marks without a partner inside the quote stay as they are.
const bare = (quote) => {
  const text = String(quote == null ? '' : quote).trim(), last = text.length - 1;
  if (text.length < 2) return text;
  // Single marks and guillemets around the whole quote go when no mark of theirs is left inside it. An apostrophe is
  // not one: inside a word, as in "don't", or after the s of a plural, as in "workers' rights".
  const single = SINGLE_WRAPS.find((pair) => text.length > 2 && text[0] === pair[0] && text[last] === pair[1]);
  const marks = text.slice(1, -1).replace(/(?<=\p{L})['’](?=\p{L})/gu, '').replace(/(?<=s)['’](?=[\s,.;:!?)]|$)/gu, '');
  if (single && !marks.includes(single[0]) && !marks.includes(single[1])) return bare(text.slice(1, -1));
  const { partner, inch, german } = doubleMarks(text), quoteMark = (i) => '“”"„'.includes(text[i]) && !inch.has(i);
  if (text.length > 2 && partner.get(0) === last) return bare(text.slice(1, -1));
  if (quoteMark(0) && !partner.has(0)) return bare(text.slice(1));
  if (quoteMark(last) && !partner.has(last)) return bare(text.slice(0, -1));
  return text.split('').map((ch, i) => (partner.has(i) && !german.has(i) ? (partner.get(i) > i ? '‘' : '’') : ch)).join('');
};
const wordsOf = (text) => String(text == null ? '' : text).split(/\s+/).filter(Boolean);

// The words of `text` in lines no wider than `room` pixels at font size `size`, measured on the look's fonts (U.tw).
const breakLines = (U, text, size, room, o) => wordsOf(text).reduce((lines, word) => {
  const last = lines.length - 1;
  if (last >= 0 && U.tw(`${lines[last]} ${word}`, size, o) <= room) lines[last] += ` ${word}`;
  else lines.push(word);
  return lines;
}, []);

// The biggest of `sizes` at which `text` fits in at most `most` lines of `room` pixels, with the lines evened out so
// the last one is not a lone word. Text too long for that gets the smallest size and as many lines as it needs, and
// smaller still when one word is wider than the room, so no word is ever cut off. `o` is the font, as for U.tw.
function fitText(U, text, sizes, room, most, o = {}) {
  const even = (size, lines) => {
    // The narrowest width that still needs no more lines, found by halving.
    let lo = Math.max(1, ...wordsOf(text).map((w) => U.tw(w, size, o))), hi = room, best = lines;
    for (let i = 0; i < 12 && hi - lo > 4; i++) {
      const mid = (lo + hi) / 2, tried = breakLines(U, text, size, mid, o);
      if (tried.length <= lines.length) { best = tried; hi = mid; } else lo = mid;
    }
    return best;
  };
  for (const size of sizes) {
    const lines = breakLines(U, text, size, room, o);
    if (lines.length <= most && lines.every((l) => U.tw(l, size, o) <= room)) return { lines: even(size, lines), size };
  }
  const small = sizes[sizes.length - 1], widest = Math.max(1, ...wordsOf(text).map((w) => U.tw(w, small, o)));
  const size = widest > room ? Math.floor((small * room * 0.95) / widest) : small;
  return { lines: even(size, breakLines(U, text, size, room, o)), size };
}
const widthOf = (U, lines, size, o) => Math.max(0, ...lines.map((l) => U.tw(l, size, o)));
// fitText for labels side by side, which all get one size so they match: the biggest of `sizes` at which every one
// fits. When even the smallest is too big, all get the smallest, with more lines where needed, and only a label with a
// word wider than its room is set smaller still (see fitText), so the others stay readable. lib/looks-more.ts keeps
// words that long away from these templates.
function fitAll(U, texts, sizes, room, most, o = {}) {
  for (const size of sizes) {
    const fitted = texts.map((text) => fitText(U, text, [size], room, most, o));
    if (fitted.every((f) => f.size === size && f.lines.length <= most)) return fitted;
  }
  return texts.map((text) => fitText(U, text, [sizes[sizes.length - 1]], room, most, o));
}
// The latest an item of a list may start, so the last of its parts is in by the end of the scene's motion even when the
// narration names it at the very end. `parts` is how long after its start that last part is in.
const latest = (at, parts) => Math.min(at, 1 - parts);

/* Quotes */

register('pull_quote', {
  cat: 'Text', title: 'Pull quote', desc: 'A quote set large beside a thick accent bar, like a quote pulled out of a magazine article. Its lines fade in one by one, and the source comes under a thin rule.',
  use: 'A source saying something important in its own words.',
  params: 'quote, source', example: { quote: 'Man is born free, and everywhere he is in chains.', source: 'Jean-Jacques Rousseau, The Social Contract, 1762' },
  build(p, c) {
    const { U, th } = c, o = { fam: 'd', w: 500 }, so = { w: 500 };
    // The closing mark ends the last line, and the opening mark hangs in the margin, so the letters line up under each
    // other the way a magazine sets a quote.
    const { lines, size } = fitText(U, `${bare(p.quote)}”`, [96, 88, 80, 72, 66, 60, 54, 50], 1240, 4, o);
    const src = p.source ? fitText(U, p.source, [36, 33, 30], 1240, 2, so) : null;
    const lh = size * 1.24, srcLh = src ? src.size * 1.3 : 0;
    const textW = Math.max(widthOf(U, lines, size, o), src ? widthOf(U, src.lines, src.size, so) : 0);
    // The bar stands 30 pixels before the hanging mark, which is wider in some looks' fonts than in others.
    const lead = Math.round(U.tw('“', size, o) + 50), x = Math.round(Math.max(300, 960 - (textW + lead) / 2 + lead));
    const height = size * 0.94 + (lines.length - 1) * lh + (src ? 70 + src.lines.length * srcLh : 0);
    const y0 = 540 - height / 2 + size * 0.74, yl = y0 + (lines.length - 1) * lh;
    const barTop = y0 - size * 0.74, ruleY = yl + size * 0.2 + 44, at = (k) => 0.1 + k * 0.07, done = at(lines.length);
    return U.bg() + `<rect x="${x - lead}" y="${f1(barTop)}" width="14" height="${f1(yl + size * 0.2 - barTop)}" fill="${th.accent}"${U.A('grow', 0.02, 0.12, { cx: x - lead + 7, cy: f1(barTop) })}/>` +
      U.T(x - 6, f1(y0), '“', { a: 'end', ...o, s: size, an: U.A('fade', at(0), 0.1) }) +
      lines.map((l, k) => U.T(x, f1(y0 + k * lh), l, { a: 'start', ...o, s: size, an: U.A('fade', at(k), 0.1) })).join('') +
      (src ? `<path d="M${x} ${f1(ruleY)}H${x + 140}" stroke="${th.muted}" stroke-width="2" stroke-dasharray="140" stroke-dashoffset="140"${U.A('draw', done, 0.08, { l: 140 })}/>` +
        src.lines.map((l, k) => U.T(x, f1(ruleY + 26 + src.size * 0.8 + k * srcLh), l, { a: 'start', ...so, s: src.size, f: th.muted, an: U.A('fade', done + 0.05, 0.08) })).join('') : '');
  },
});

// One comma of a quotation mark on a 100 x 100 grid: a ball with a tail rising to the right, like a 6. Two side by side
// make an opening mark, and turned half round they make a closing one.
const COMMA = 'M20 68C20 34 36 12 64 2L68 10C52 18 44 30 44 39A30 30 0 1 1 20 68Z';
// A quotation mark `h` pixels tall with its top left corner at x, y. Its outline draws itself, then it fills in.
const quoteMark = (U, th, x, y, h, closing, at) => {
  const s = h / 100, pair = (attrs) => [-20, 44].map((dx) => `<path d="${COMMA}" transform="translate(${dx} 0)"${attrs}/>`).join('');
  return `<g transform="translate(${f1(x)} ${f1(y)}) scale(${s.toFixed(4)})"><g${closing ? ' transform="rotate(180 62 50)"' : ''}>` +
    `<g fill="${th.accent}" opacity="0"${U.A('fade', at + 0.07, 0.06)}>${pair('')}</g>` +
    pair(` fill="none" stroke="${th.accent}" stroke-width="${(3 / s).toFixed(2)}" stroke-linejoin="round" stroke-dasharray="320" stroke-dashoffset="320"${U.A('draw', at, 0.1, { l: 320 })}`) + '</g></g>';
};

register('quote_marks_big', {
  cat: 'Text', title: 'Big quote marks', desc: 'Giant quotation marks draw themselves before and after a quote set in italics, and its source comes on a small tag.',
  use: 'A source saying something important in its own words.',
  params: 'quote, source', example: { quote: 'Man is born free, and everywhere he is in chains.', source: 'Jean-Jacques Rousseau, The Social Contract, 1762' },
  build(p, c) {
    const { U, th } = c, o = { fam: 'd', w: 400, it: true };
    const { lines, size } = fitText(U, bare(p.quote), [76, 70, 64, 58, 52, 48], 1180, 4, o);
    const n = Math.max(1, lines.length), lh = size * 1.3, w = (k) => U.tw(lines[k] || '', size, o), h = Math.round(size * 2.2), mw = h * 1.24;
    // Laid out from the first baseline at 0, then moved so the whole is in the middle of the frame. The opening mark
    // stands before the first line and the closing one after the last, each clear of the line next to it. These places
    // come from estimated widths, which run wide for italics; render moves the marks to the measured lines.
    const yl = (n - 1) * lh, openX = 960 - Math.max(w(0), w(1)) / 2 - 30 - mw, openY = -size * 0.72 - h * 0.42;
    const closeX = 960 + Math.max(w(n - 1), w(n - 2)) / 2 + 30, closeY = yl + size * 0.2 - h * 0.58;
    const tagO = { w: 500 }, labelO = { w: 700 }, src = p.source ? fitText(U, p.source, [32, 30, 28], 900, 2, tagO) : null;
    const labelW = src ? U.tw('Source', src.size, labelO) : 0, tagW = src ? 30 + labelW + 18 + widthOf(U, src.lines, src.size, tagO) + 40 : 0;
    const tagH = src ? 26 + src.lines.length * src.size * 1.3 : 0, tagY = Math.max(yl + size * 0.3, closeY + h) + 36;
    const oy = 540 - (openY + (src ? tagY + tagH : closeY + h)) / 2, at = (k) => 0.12 + k * 0.06, closeAt = at(n) + 0.02;
    return U.bg() + `<g id="${c.id}open" data-x="${f1(openX)}" data-w="${f1(mw)}">${quoteMark(U, th, openX, oy + openY, h, false, 0.02)}</g>` +
      lines.map((l, k) => U.T(960, f1(oy + k * lh), l, { ...o, s: size, id: `${c.id}q${k}`, an: U.A('up', at(k), 0.1) })).join('') +
      `<g id="${c.id}close" data-x="${f1(closeX)}">${quoteMark(U, th, closeX, oy + closeY, h, true, closeAt)}</g>` +
      (src ? `<g${U.A('up', closeAt + 0.1, 0.08)}>${U.card(f1(960 - tagW / 2), f1(oy + tagY), f1(tagW), f1(tagH), { r: src.lines.length > 1 ? 18 : tagH / 2 })}` +
        U.T(f1(960 - tagW / 2 + 30), f1(oy + tagY + 13 + src.size * 0.95), 'Source', { a: 'start', ...labelO, s: src.size, f: th.accent }) +
        src.lines.map((l, k) => U.T(f1(960 - tagW / 2 + 30 + labelW + 18), f1(oy + tagY + 13 + src.size * 0.95 + k * src.size * 1.3), l, { a: 'start', ...tagO, s: src.size, f: th.muted })).join('') + '</g>' : '');
  },
  init(g, p, c) {
    const q = (s) => g.querySelector('#' + c.id + s), lines = [];
    for (let k = 0; q('q' + k); k++) lines.push(q('q' + k));
    return { lines, open: q('open'), close: q('close') };
  },
  render(l, st) {
    const w = (k) => (st.lines[k] ? st.lines[k].getComputedTextLength() : 0), n = st.lines.length;
    const openX = 960 - Math.max(w(0), w(1)) / 2 - 30 - Number(st.open.dataset.w), closeX = 960 + Math.max(w(n - 1), w(n - 2)) / 2 + 30;
    st.open.setAttribute('transform', `translate(${f1(openX - Number(st.open.dataset.x))} 0)`);
    st.close.setAttribute('transform', `translate(${f1(closeX - Number(st.close.dataset.x))} 0)`);
  },
});

/* Lists */

register('tile_grid', {
  cat: 'Text', title: 'Tile grid', desc: 'Two to four tiles in a grid, each with an optional icon, a title and an optional detail, coming in one by one. Two make two tall tiles, three make one tall tile beside two wide ones, four make two rows of two.',
  use: 'A few things of one kind, like types, causes or effects, that do not lead to each other.',
  params: 'items: [{title, detail?, icon?}] (2–4)',
  example: { items: [{ title: 'Weakened germs', detail: 'Too weak to make you ill', icon: 'virus' }, { title: 'Killed germs', detail: 'Cannot multiply at all', icon: 'flask' }, { title: 'Protein pieces', detail: 'Only the part to learn', icon: 'molecule' }, { title: 'Genetic code', detail: 'Cells make the protein', icon: 'dna' }] },
  build(p, c) {
    const { U, th } = c, I = (p.items || []).slice(0, 4), N = I.length, G = 32, L = 210, T = 240, Wd = 1500, Ht = 600, half = (Wd - G) / 2, row = (Ht - G) / 2;
    const boxes = N >= 4 ? [0, 1, 2, 3].map((k) => ({ x: L + (k % 2) * (half + G), y: T + Math.floor(k / 2) * (row + G), w: half, h: row }))
      : N === 3 ? [{ x: L, y: T, w: 620, h: Ht, tall: true }, { x: L + 620 + G, y: T, w: Wd - 620 - G, h: row }, { x: L + 620 + G, y: T + row + G, w: Wd - 620 - G, h: row }]
      : N === 2 ? [0, 1].map((k) => ({ x: L + k * (half + G), y: T + 40, w: half, h: Ht - 80, tall: true }))
      : [{ x: L + 250, y: T + (Ht - row) / 2, w: Wd - 500, h: row }];
    const tO = { fam: 'd', w: 700 }, pad = 48;
    // A tall tile has its icon in the top corner and its words at the bottom, up to three lines of title; a wide one has
    // its icon on the left and its words beside it. Without an icon the words sit in the middle.
    const plans = I.map((it, k) => {
      const b = boxes[k], icon = it.icon ? (b.tall ? 150 : 100) : 0, x = b.x + pad + (icon && !b.tall ? icon + 34 : 0);
      return { it, b, icon, x, most: b.tall ? 3 : 2, room: b.x + b.w - pad - x, high: b.h - 2 * pad - (b.tall && icon ? icon + 28 : 0) };
    });
    const words = (q, ts, ds) => {
      const title = fitText(U, q.it.title, [ts], q.room, q.most, tO), detail = q.it.detail ? fitText(U, q.it.detail, [ds], q.room, 3) : null;
      return { title, detail, tH: title.lines.length * title.size * 1.14, dH: detail ? 14 + detail.lines.length * detail.size * 1.3 : 0 };
    };
    // Every tile gets the same sizes: the first pair of title and detail sizes at which the words of all of them fit
    // their tiles. Title and detail shrink together, and the title shrinks on its own before a detail goes under 32
    // pixels, so the details stay readable beside big titles. The last pairs are only for words too long for that.
    const fits = (t, d) => plans.every((q) => {
      const w = words(q, t, d);
      return w.title.size === t && w.title.lines.length <= q.most && (!w.detail || (w.detail.size === d && w.detail.lines.length <= 3)) && w.tH + w.dH <= q.high;
    });
    const SIZES = [[64, 40], [58, 38], [52, 36], [48, 34], [44, 32], [40, 32], [36, 32], [34, 28], [34, 24]];
    const [ts, ds] = SIZES.find(([t, d]) => fits(t, d)) ?? SIZES[SIZES.length - 1];
    const tile = (q, at) => {
      const { it, b, icon, x } = q, { title, detail, tH, dH } = words(q, ts, ds);
      const top = b.tall && icon ? Math.max(b.y + pad + icon + 28, b.y + b.h - pad - tH - dH + title.size * 0.1) : b.y + (b.h - tH - dH) / 2 + title.size * 0.06;
      return `<g${U.A('up', at, 0.08)}>${U.card(f1(b.x), f1(b.y), f1(b.w), f1(b.h))}` +
        (icon ? U.popIcon(it.icon, b.x + pad + icon / 2, b.tall ? b.y + pad + icon / 2 : b.y + b.h / 2, icon, th.accent, at + 0.04, 0.06) : '') +
        title.lines.map((l, k) => U.T(f1(x), f1(top + title.size * 0.8 + k * title.size * 1.14), l, { a: 'start', ...tO, s: title.size })).join('') +
        (detail ? detail.lines.map((l, k) => U.T(f1(x), f1(top + tH + 14 + detail.size * 0.85 + k * detail.size * 1.3), l, { a: 'start', s: detail.size, f: th.muted })).join('') : '') + '</g>';
    };
    return U.bg() + plans.map((q, k) => tile(q, latest(p.times?.[k] ?? 0.06 + k * (0.6 / Math.max(1, N)), 0.1))).join('');
  },
});

register('numbered_rows', {
  cat: 'Teaching', title: 'Numbered rows', desc: 'Rows of text with big outlined numerals, 01, 02, 03, on the left and thin rules between them, coming in one by one.',
  use: 'The main points of a video, counted, as a recap at the end.',
  params: 'items: [{title, detail?}] (2–6)',
  example: { items: [{ title: 'Up to half of Europe died', detail: 'About 50 million people' }, { title: 'The first quarantine laws' }, { title: 'Violence against Jewish communities', detail: 'Massacres across Europe' }] },
  build(p, c) {
    const { U, th } = c, I = (p.items || []).slice(0, 6), tO = { fam: 'd', w: 700 }, nO = { fam: 'd', w: 700 };
    // The biggest numeral, title and detail sizes at which every row fits and all rows together stay within 640 pixels.
    const SIZES = [[132, 64, 40], [116, 58, 38], [102, 52, 36], [90, 46, 34], [80, 42, 32], [72, 38, 30]];
    let plan = null;
    for (const [ns, ts, ds] of SIZES) {
      const numW = U.tw('00', ns, nO), room = 1500 - numW - 56, pad = ns * 0.2;
      const rows = I.map((it) => {
        const title = fitText(U, it.title, [ts], room, 2, tO), detail = it.detail ? fitText(U, it.detail, [ds], room, 2) : null;
        const textH = title.lines.length * title.size * 1.14 + (detail ? 10 + detail.lines.length * detail.size * 1.3 : 0);
        return { title, detail, textH, h: Math.max(ns * 0.8, textH) + 2 * pad };
      });
      plan = { ns, numW, rows, total: rows.reduce((s, r) => s + r.h, 0) };
      if (plan.total <= 640) break;
    }
    const { ns, numW, rows, total } = plan;
    const textW = Math.max(0, ...rows.map((r) => Math.max(widthOf(U, r.title.lines, r.title.size, tO), r.detail ? widthOf(U, r.detail.lines, r.detail.size, {}) : 0)));
    const blockW = numW + 56 + textW, xN = Math.round(Math.max(200, 960 - blockW / 2)), x = xN + numW + 56;
    let y = 540 - total / 2, out = U.bg();
    rows.forEach((r, k) => {
      const at = latest(p.times?.[k] ?? 0.08 + k * (0.65 / Math.max(1, rows.length)), 0.1), mid = y + r.h / 2, top = mid - r.textH / 2;
      if (k > 0) out += `<path d="M${xN} ${f1(y)}H${f1(xN + blockW)}" stroke="${th.line}" stroke-width="2" stroke-dasharray="${f1(blockW)}" stroke-dashoffset="${f1(blockW)}"${U.A('draw', at, 0.08, { l: f1(blockW) })}/>`;
      out += U.T(xN, f1(mid + ns * 0.36), String(k + 1).padStart(2, '0'), { a: 'start', ...nO, s: ns, f: 'none', ex: ` stroke="${th.accent}" stroke-width="${(ns / 42).toFixed(1)}" stroke-linejoin="round"`, an: U.A('fade', at, 0.08) }) +
        `<g${U.A('left', at + 0.02, 0.08)}>` + r.title.lines.map((l, i) => U.T(x, f1(top + r.title.size * 0.8 + i * r.title.size * 1.14), l, { a: 'start', ...tO, s: r.title.size })).join('') +
        (r.detail ? r.detail.lines.map((l, i) => U.T(x, f1(top + r.title.lines.length * r.title.size * 1.14 + 10 + r.detail.size * 0.85 + i * r.detail.size * 1.3), l, { a: 'start', s: r.detail.size, f: th.muted })).join('') : '') + '</g>';
      y += r.h;
    });
    return out;
  },
});

/* Statements */

register('marker_statement', {
  cat: 'Text', title: 'Marked statement', desc: 'One sentence in big type, line by line, and then a highlighter sweeps over its key phrase.', use: 'A main point or a conclusion, with the words that matter most marked.',
  params: 'text, highlight (words of the text, in their order)', example: { text: 'The revolution lost in the short run, but its ideas won in the long run.', highlight: 'its ideas won in the long run.' },
  build(p, c) {
    const { U, th } = c, id = c.id, o = { fam: 'd', w: 700 }, words = wordsOf(p.text), marked = wordsOf(p.highlight);
    // The marked words are the last place in the text where the highlight's words come in that order, or none.
    let from = -1;
    for (let i = words.length - marked.length; marked.length > 0 && i >= 0 && from < 0; i--) if (marked.every((w, j) => words[i + j] === w)) from = i;
    const { lines, size } = fitText(U, words.join(' '), [104, 96, 88, 80, 72, 64, 58, 52], 1480, 3, o);
    const lh = size * 1.22, y0 = 540 - ((lines.length - 1) * lh) / 2 + size * 0.35, pad = size * 0.12, top = (r) => y0 + r * lh - size * 0.8;
    // Where the marked words are on each line, as characters, and when the highlighter sweeps that line: one line after
    // the other, once all the lines are in.
    let first = 0, start = 0.38;
    const marks = lines.map((line) => {
      const n = wordsOf(line).length, a = Math.max(from, first), b = Math.min(from + marked.length, first + n), own = wordsOf(line);
      first += n;
      if (from < 0 || b <= a) return null;
      const before = own.slice(0, a - (first - n)).join(' '), hit = own.slice(a - (first - n), b - (first - n)).join(' ');
      return { a: before ? before.length + 1 : 0, b: (before ? before.length + 1 : 0) + hit.length, w: U.tw(hit, size, o) + 2 * pad };
    });
    const total = marks.reduce((s, m) => s + (m ? m.w : 0), 0);
    marks.forEach((m) => { if (!m) return; m.at = start; m.d = (0.22 * m.w) / total; start += m.d; });
    // Before render measures the lines, the marks go where the estimated widths put them.
    const guess = (r) => { const m = marks[r]; return 960 - U.tw(lines[r], size, o) / 2 + U.tw(lines[r].slice(0, m.a), size, o) - pad; };
    const box = (r, kind) => `id="${id}${kind}${r}" x="${f1(guess(r))}" y="${f1(top(r))}" width="0" height="${f1(size * 1.04)}"`;
    let defs = `<mask id="${id}ink" maskUnits="userSpaceOnUse" x="-2000" y="-2000" width="5920" height="5080"><rect x="-2000" y="-2000" width="5920" height="5080" fill="#fff"/>`, clips = '', bands = '', inverse = '';
    lines.forEach((l, r) => {
      if (!marks[r]) return;
      const m = marks[r];
      // The band, a hole in the plain words where it is, and the same words in the ground color shown only there.
      defs += `<rect ${box(r, 'h')} fill="#000"/>`;
      clips += `<clipPath id="${id}k${r}"><rect ${box(r, 'kr')}/></clipPath>`;
      bands += `<rect ${box(r, 'b')} rx="${f1(size * 0.06)}" fill="${th.accent}" data-mark="${m.a} ${m.b} ${m.at.toFixed(3)} ${m.d.toFixed(3)} ${f1(pad)}"/>`;
      inverse += `<g clip-path="url(#${id}k${r})">${U.T(960, f1(y0 + r * lh), l, { ...o, s: size, f: th.bg })}</g>`;
    });
    return U.bg() + `<defs>${defs}</mask>${clips}</defs><g>${bands}</g>` +
      `<g mask="url(#${id}ink)">` + lines.map((l, r) => U.T(960, f1(y0 + r * lh), l, { ...o, s: size, id: `${id}l${r}`, an: U.A('up', 0.04 + r * 0.08, 0.1) })).join('') + '</g>' + inverse;
  },
  init(g, p, c) {
    const q = (s) => g.querySelector('#' + c.id + s), marks = [];
    for (let r = 0; q('l' + r); r++) {
      const band = q('b' + r);
      if (!band) continue;
      const [a, b, at, d, pad] = band.dataset.mark.split(' ').map(Number);
      marks.push({ line: q('l' + r), a, b, at, d, pad, parts: [band, q('h' + r), q('kr' + r)] });
    }
    return { marks };
  },
  render(l, st, p, c) {
    const { U } = c;
    st.marks.forEach((m) => {
      // Measured on the line as it is drawn, so the band fits the words in every look's font.
      const start = 960 - m.line.getComputedTextLength() / 2, left = start + (m.a > 0 ? m.line.getSubStringLength(0, m.a) : 0) - m.pad;
      const width = (m.line.getSubStringLength(m.a, m.b - m.a) + 2 * m.pad) * U.ease.io(U.prog(l.p, m.at, m.at + m.d));
      m.parts.forEach((part) => { part.setAttribute('x', f1(left)); part.setAttribute('width', f1(width)); });
    });
  },
});

register('typewriter_statement', {
  cat: 'Text', title: 'Typed statement', desc: 'A sentence types itself out behind a cursor, and its key phrase is then underlined. A line break in the text starts a new line, and the lines after the first are dimmer.',
  use: 'A main point, or a few short lines, written out as the narration says them.',
  params: 'text (a line break starts a new line), highlight (words of the first line, in their order)', example: { text: 'Vaccines teach the body to fight a germ before it ever meets it.', highlight: 'before it ever meets it.' },
  build(p, c) {
    const { U, th } = c, id = c.id, o = { fam: 'd', w: 600 }, parts = String(p.text || '').split('\n').map((s) => wordsOf(s).join(' ')).filter(Boolean);
    // The biggest size at which all the text fits in at most four lines of 1440 pixels.
    let size = 50, lines = [];
    for (const s of [92, 84, 76, 68, 62, 56, 50]) {
      const tried = parts.flatMap((text, part) => fitText(U, text, [s], 1440, 4, o).lines.map((line) => ({ line, part })));
      size = s; lines = tried;
      if (tried.length <= 4 && tried.every((l) => U.tw(l.line, s, o) <= 1440)) break;
    }
    if (lines.some((l) => U.tw(l.line, size, o) > 1440)) {
      const fitted = parts.map((text) => fitText(U, text, [size], 1440, 4, o));
      size = Math.min(...fitted.map((f) => f.size));
      lines = parts.flatMap((text, part) => fitText(U, text, [size], 1440, 99, o).lines.map((line) => ({ line, part })));
    }
    // Where the highlight is in the first part, as characters of each of its lines.
    const first = parts[0] || '', hl = String(p.highlight || '').trim(), h0 = hl ? first.lastIndexOf(hl) : -1;
    let pos = 0;
    lines.forEach((l) => {
      if (l.part !== 0) return;
      const a = Math.max(h0, pos), b = Math.min(h0 + hl.length, pos + l.line.length);
      if (h0 >= 0 && b > a) l.mark = [a - pos, b - pos];
      pos += l.line.length + 1;
    });
    const lh = size * 1.3, y0 = 540 - ((lines.length - 1) * lh) / 2 + size * 0.35, x0 = 240;
    // The lines are drawn from the left, so typing grows to the right; the block is moved to the middle on every frame,
    // measured on the real fonts. This first guess comes from the estimated widths.
    const guess = 960 - widthOf(U, lines.map((l) => l.line), size, o) / 2 - x0;
    const pre = ' style="white-space:pre"';
    return U.bg() + `<g id="${id}blk" transform="translate(${f1(guess)} 0)">` + lines.map((l, k) => {
      const y = f1(y0 + k * lh), font = { a: 'start', ...o, s: size, f: l.part ? th.muted : th.ink };
      return U.T(x0, y, l.line, { ...font, id: `${id}m${k}`, op: 0, ex: pre }) + U.T(x0, y, l.line, { ...font, id: `${id}t${k}`, ex: pre }) +
        (l.mark ? `<rect id="${id}u${k}" x="${x0}" y="${f1(y0 + k * lh + size * 0.16)}" width="0" height="${f1(Math.max(5, size * 0.08))}" rx="2" fill="${th.accent}" data-mark="${l.mark.join(' ')}"/>` : '');
    }).join('') + `<rect id="${id}cur" x="${x0}" y="${f1(y0 - size * 0.78)}" width="${f1(Math.max(4, size * 0.07))}" height="${f1(size * 0.96)}" fill="${th.accent}" opacity="0"/></g>`;
  },
  init(g, p, c) {
    const q = (s) => g.querySelector('#' + c.id + s), lines = [];
    // How many lines build drew, and what each holds; the typing runs over them as one stream with a short pause at
    // every line break.
    for (let k = 0; q('t' + k); k++) {
      const under = q('u' + k);
      lines.push({ el: q('t' + k), measure: q('m' + k), under, mark: under ? under.dataset.mark.split(' ').map(Number) : null, text: q('m' + k).textContent, shown: -1 });
    }
    const chars = lines.reduce((s, l) => s + l.text.length + 4, 0), t1 = 0.05 + Math.min(0.6, Math.max(0.2, chars * 0.0055));
    let from = 0;
    lines.forEach((l) => { l.from = from; from += l.text.length + 4; });
    return { lines, chars, t0: 0.05, t1, block: q('blk'), cursor: q('cur'), x0: Number(q('cur').getAttribute('x')) };
  },
  render(l, st, p, c) {
    const { U } = c, typed = Math.floor(st.chars * U.prog(l.p, st.t0, st.t1));
    // The block in the middle of the frame, measured on the fonts as they are drawn.
    const widest = Math.max(0, ...st.lines.map((line) => line.measure.getComputedTextLength()));
    st.block.setAttribute('transform', `translate(${f1(960 - widest / 2 - st.x0)} 0)`);
    let at = 0;
    st.lines.forEach((line, k) => {
      const shown = U.clamp(typed - line.from, 0, line.text.length);
      if (shown !== line.shown) { line.el.textContent = line.text.slice(0, shown); line.shown = shown; }
      if (typed >= line.from) at = k;
    });
    // The cursor sits after the last letter typed. Once the typing is done it blinks twice and goes.
    const cur = st.lines[at], after = (l.p - st.t1) * l.dur, size = Number(st.cursor.getAttribute('height')) / 0.96;
    const on = l.p < st.t0 - 0.02 ? false : after < 0 ? true : after < 1.6 && Math.floor(after / 0.4) % 2 === 0;
    if (cur) {
      st.cursor.setAttribute('x', f1(st.x0 + cur.el.getComputedTextLength() + size * 0.06));
      st.cursor.setAttribute('y', f1(Number(cur.el.getAttribute('y')) - size * 0.78));
    }
    st.cursor.setAttribute('opacity', on ? 1 : 0);
    // Then the key phrase is underlined, measured on the full line.
    const grow = U.ease.io(U.clamp((after - 0.2) / 0.5, 0, 1));
    st.lines.forEach((line) => {
      if (!line.under || !line.mark) return;
      const [a, b] = line.mark, left = a > 0 ? line.measure.getSubStringLength(0, a) : 0, width = line.measure.getSubStringLength(a, b - a);
      line.under.setAttribute('x', f1(st.x0 + left));
      line.under.setAttribute('width', f1(Math.max(0, width * grow)));
    });
  },
});

/* Steps */

register('stair_steps', {
  cat: 'Relations', title: 'Stair steps', desc: 'Steps that rise one by one from left to right, each with its number on it and its stage written above it, with an icon if wanted.',
  use: 'A process, or stages where each builds on the one before.',
  params: 'nodes: [{text, icon?}] (2–6)',
  example: { nodes: [{ text: 'Body meets a new germ', icon: 'virus' }, { text: 'Antibodies are made slowly', icon: 'hourglass' }, { text: 'Memory cells stay', icon: 'cell' }, { text: 'The next response is fast', icon: 'arrowup' }] },
  build(p, c) {
    const { U, th } = c, Nd = (p.nodes || []).slice(0, 6), N = Math.max(1, Nd.length), L = 240, R = 1680, colW = (R - L) / N, base = 860, lO = { w: 600 };
    const icon = Nd.some((n) => n.icon) ? Math.min(96, colW * 0.42) : 0;
    // Every label in one size, up to three lines in its own step's width.
    const labels = fitAll(U, Nd.map((n) => n.text), [46, 42, 38, 35, 32, 30], colW - 30, 3, lO);
    const labelH = Math.max(0, ...labels.map((l) => l.lines.length * l.size * 1.18)) + (icon ? icon + 16 : 0);
    // Every step rises as much as leaves room above the top one for its label.
    const rise = Math.min(150, Math.max(70, (base - 220 - labelH) / N));
    let out = U.bg() + `<path d="M${L - 40} ${base}H${R + 40}" stroke="${th.line}" stroke-width="3" stroke-dasharray="${R - L + 80}" stroke-dashoffset="${R - L + 80}"${U.A('draw', 0.02, 0.1, { l: R - L + 80 })}/>`;
    Nd.forEach((n, k) => {
      const x = L + k * colW, y = base - (k + 1) * rise, prev = base - k * rise, at = latest(p.times?.[k] ?? 0.08 + k * (0.65 / N), 0.14), cx = x + colW / 2, { lines, size } = labels[k];
      const numS = Math.min(60, rise * 0.55), edge = rise + colW;
      out += `<rect x="${f1(x)}" y="${f1(y)}" width="${f1(colW)}" height="${f1(base - y)}" fill="${th.surface}"${U.A('grow', at, 0.08, { cx: f1(x), cy: base })}/>` +
        U.T(f1(cx), f1(y + rise / 2 + numS * 0.36), String(k + 1), { fam: 'd', s: numS, w: 700, f: th.muted, an: U.A('fade', at + 0.05, 0.06) }) +
        `<path d="M${f1(x)} ${f1(prev)}V${f1(y)}H${f1(x + colW)}" fill="none" stroke="${th.accent}" stroke-width="6" stroke-linejoin="round" stroke-dasharray="${f1(edge)}" stroke-dashoffset="${f1(edge)}"${U.A('draw', at + 0.04, 0.08, { l: f1(edge) })}/>` +
        `<g${U.A('up', at + 0.06, 0.08)}>` + lines.map((l, i) => U.T(f1(cx), f1(y - 24 - size * 0.24 - (lines.length - 1 - i) * size * 1.18), l, { ...lO, s: size })).join('') + '</g>' +
        (n.icon ? U.popIcon(n.icon, cx, y - 24 - lines.length * size * 1.18 - 14 - icon / 2, icon, th.accent, at + 0.08, 0.06) : '');
    });
    return out;
  },
});

// The point a cubic curve reaches at t from 0 to 1, and the curve's length, summed over short straight pieces.
const bez = (a, b, c2, d, t) => { const u = 1 - t; return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c2 + t * t * t * d; };
const curveLength = (s) => {
  let len = 0, px = s[0], py = s[1];
  for (let i = 1; i <= 24; i++) { const t = i / 24, x = bez(s[0], s[2], s[4], s[6], t), y = bez(s[1], s[3], s[5], s[7], t); len += Math.hypot(x - px, y - py); px = x; py = y; }
  return len;
};

register('road_path', {
  cat: 'Relations', title: 'Road with stops', desc: 'A winding road that draws itself from stop to stop. Each stop is numbered, with its stage above or below it and an icon if wanted.',
  use: 'A process or a journey through stages in order.',
  params: 'nodes: [{text, icon?}] (2–6)',
  example: { nodes: [{ text: 'Signal crosses the AV node', icon: 'lightning' }, { text: 'Travels down the His bundle' }, { text: 'Races through Purkinje fibers' }, { text: 'Ventricles squeeze', icon: 'heart' }] },
  build(p, c) {
    const { U, th } = c, id = c.id, Nd = (p.nodes || []).slice(0, 6), N = Math.max(1, Nd.length), L = 180, R = 1740, colW = (R - L) / N, A = 85, mid = 540, r = 42, lO = { w: 600 };
    // The stops take turns low and high, so the road winds and each label has the room above or below its stop, up to
    // the stops on either side.
    const pts = Nd.map((_, k) => ({ x: L + colW * (k + 0.5), y: mid + (k % 2 ? -A : A) }));
    const icon = Nd.some((n) => n.icon) ? 84 : 0, room = Math.min(560, 2 * colW - 50);
    const ends = [{ x: L - 40, y: mid }, ...pts, { x: R + 40, y: mid }];
    // The road from one point to the next leaves and arrives level, so it curves through every stop.
    const segs = ends.slice(1).map((b, k) => { const a = ends[k], dx = (b.x - a.x) / 2; return [a.x, a.y, a.x + dx, a.y, b.x - dx, b.y, b.x, b.y]; });
    const d = segs.map((s, k) => (k ? '' : `M${f1(s[0])} ${f1(s[1])}`) + `C${s.slice(2).map(f1).join(' ')}`).join('');
    const times = pts.map((_, k) => latest(p.times?.[k] ?? 0.1 + k * (0.65 / N), 0.13));
    // Every label in one size, up to three lines.
    const labels = fitAll(U, Nd.map((n) => n.text), [46, 42, 38, 35, 32, 30], room, 3, lO);
    // The road reaches each stop as it comes in.
    let prevEnd = 0.02;
    const reveal = segs.map((s, k) => {
      const due = k < pts.length ? times[k] : times[pts.length - 1] + 0.08, at = Math.max(prevEnd, due - 0.07), dur = Math.max(0.02, due - at), len = f1(curveLength(s) + 2);
      prevEnd = at + dur;
      return `<path d="M${f1(s[0])} ${f1(s[1])}C${s.slice(2).map(f1).join(' ')}" fill="none" stroke="#fff" stroke-width="80" stroke-dasharray="${len}" stroke-dashoffset="${len}"${U.A('draw', at, dur, { l: len })}/>`;
    }).join('');
    let out = U.bg() + `<defs><mask id="${id}road" maskUnits="userSpaceOnUse" x="0" y="0" width="1920" height="1080">${reveal}</mask></defs>` +
      `<g mask="url(#${id}road)"><path d="${d}" fill="none" stroke="${th.line}" stroke-width="56" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${th.bg}" stroke-width="4" stroke-dasharray="22 20"/></g>`;
    Nd.forEach((n, k) => {
      const { x, y } = pts[k], up = k % 2 === 1, at = times[k], { lines, size } = labels[k];
      const own = n.icon ? icon : 0, iconY = up ? y - r - 16 - icon / 2 : y + r + 16 + icon / 2, edge = up ? y - r - (own ? own + 28 : 22) : y + r + (own ? own + 28 : 22);
      out += `<g${U.A('pop', at, 0.05, { cx: x, cy: y })}><circle cx="${f1(x)}" cy="${y}" r="${r}" fill="${th.accent}" stroke="${th.bg}" stroke-width="6"/>${U.T(f1(x), y + 14, String(k + 1), { s: 40, w: 700, f: th.bg })}</g>` +
        (n.icon ? U.popIcon(n.icon, x, iconY, icon, th.accent, at + 0.04, 0.05) : '') +
        `<g${U.A('up', at + 0.05, 0.08)}>` + lines.map((l, i) => U.T(f1(x), f1(up ? edge - size * 0.24 - (lines.length - 1 - i) * size * 1.18 : edge + size * 0.8 + i * size * 1.18), l, { ...lO, s: size })).join('') + '</g>';
    });
    return out;
  },
});

/* Numbers */

register('odometer', {
  cat: 'Numbers', title: 'Odometer', desc: 'A number whose digits roll up into place on their wheels, one after the other from the left, with a label under it.',
  use: 'One number that should stick: a count, an amount, a percentage.',
  params: 'value, decimals, suffix, label, at (when the number is said: a fraction of the scene, or the number as the narration writes it)', example: { value: 650, suffix: ' million', label: 'people watched live on television' },
  build(p, c) {
    const { U, th } = c, id = c.id, o = { fam: 'd', w: 700 }, text = U.fmtNum(Number(p.value) || 0, p.decimals || 0).replace('-', '−'), suffix = String(p.suffix || '');
    // A suffix that follows without a space, like %, is set with the digits; a word, like million, smaller after them.
    const tight = suffix !== '' && !suffix.startsWith(' '), unit = suffix.trim();
    const sized = (size) => {
      const digitW = Math.max(...'0123456789'.split('').map((d) => U.tw(d, size, o))), cellW = digitW + size * 0.2, gap = size * 0.06;
      const cells = [...text].map((ch) => ({ ch, digit: /\d/.test(ch), w: /\d/.test(ch) ? cellW : U.tw(ch, size, o) + gap }));
      const unitS = tight ? size * 0.62 : size * 0.42, unitW = unit ? U.tw(unit, unitS, o) + (tight ? size * 0.08 : size * 0.18) : 0;
      return { size, cells, unitS, unitW, width: cells.reduce((s, q) => s + q.w + (q.digit ? gap : 0), 0) + unitW };
    };
    let S = sized(210);
    if (S.width > 1500) S = sized(Math.floor((210 * 1500) / S.width));
    // The cells are tall enough for figures that hang below the line, as Young Serif's do.
    const { size, cells, unitS, width } = S, gap = size * 0.06, cellH = size * 1.2, top = 330, base = top + size * 0.93, figures = ' style="font-variant-numeric:lining-nums tabular-nums"';
    const label = p.label ? fitText(U, p.label, [54, 50, 46, 42, 38], 1400, 2, { w: 600 }) : null;
    const columns = cells.filter((q) => q.digit).length;
    // The wheels start as the narration says the number (`at`), at the latest at 0.6 of the scene as in number_hook,
    // and the last one lands up to 1.8 seconds later, by 0.88, so the label is fully in before the scene settles. The
    // unit and the label come in only then, so they are never read with a number the wheels pass on the way.
    const start = typeof p.at === 'number' ? Math.min(0.6, Math.max(0.02, p.at)) : 0.03, dur = c.dur || 6;
    const rollOf = (k) => Math.min(0.88 - start, (1 + (0.8 * k) / Math.max(1, columns - 1)) / dur), land = start + rollOf(columns - 1);
    let x = 960 - width / 2, j = 0, cards = '', wheels = '', marks = '';
    cells.forEach((q) => {
      if (!q.digit) { marks += U.T(f1(x + q.w / 2), f1(base), q.ch, { ...o, s: size, f: th.accent }); x += q.w; return; }
      // A wheel rolls up through every digit to its own, once round first unless it is the first of several, and the
      // wheels land one after another from the left. It shows two digits at a time, the one in its window and the next
      // one coming up under it; render turns them.
      const digit = Number(q.ch), turns = columns > 1 && j === 0 ? 0 : 1, steps = turns * 10 + digit, cx = x + q.w / 2;
      cards += U.card(f1(x), f1(top), f1(q.w), f1(cellH), { r: Math.min(14, size * 0.08) });
      wheels += `<g id="${id}w${j}" data-wheel="${steps} ${start.toFixed(3)} ${rollOf(j).toFixed(3)} ${f1(base)} ${f1(cellH)}">` +
        U.T(f1(cx), f1(base), String(digit), { ...o, s: size, f: th.accent, ex: figures }) + U.T(f1(cx), f1(base + cellH), String((digit + 1) % 10), { ...o, s: size, f: th.accent, ex: figures }) + '</g>';
      x += q.w + gap;
      j++;
    });
    const unitText = unit ? U.T(f1(x - gap + (tight ? size * 0.08 : size * 0.18)), f1(base), unit, { a: 'start', ...o, s: unitS, f: tight ? th.accent : th.ink }) : '';
    return U.bg() + `<defs><clipPath id="${id}win"><rect x="${f1(960 - width / 2 - 10)}" y="${f1(top)}" width="${f1(width + 20)}" height="${f1(cellH)}"/></clipPath></defs>` +
      `<g${U.A('fade', 0, 0.04)}>${cards}<g clip-path="url(#${id}win)">${wheels}</g>${marks}</g>` +
      (unitText ? `<g${U.A('fade', land - 0.02, 0.05)}>${unitText}</g>` : '') +
      (label ? `<g${U.A('up', land, 0.08)}>` + label.lines.map((l, k) => U.T(960, f1(top + cellH + 80 + k * label.size * 1.25), l, { s: label.size, w: 600 })).join('') + '</g>' : '');
  },
  init(g, p, c) {
    const wheels = [];
    for (let j = 0, el; (el = g.querySelector('#' + c.id + 'w' + j)); j++) {
      const [steps, at, d, base, cellH] = el.dataset.wheel.split(' ').map(Number), [now, next] = el.querySelectorAll('text');
      wheels.push({ steps, at, d, base, cellH, now, next, shown: -1 });
    }
    return { wheels };
  },
  render(l, st, p, c) {
    const { U } = c;
    st.wheels.forEach((w) => {
      const turned = U.ease.io(U.prog(l.p, w.at, w.at + w.d)) * w.steps, i = Math.min(w.steps, Math.floor(turned + 1e-6)), part = turned - i;
      if (i !== w.shown) { w.now.textContent = String(i % 10); w.next.textContent = String((i + 1) % 10); w.shown = i; }
      w.now.setAttribute('y', f1(w.base - part * w.cellH));
      w.next.setAttribute('y', f1(w.base + (1 - part) * w.cellH));
    });
  },
});
