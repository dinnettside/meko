// Openings for Meko: more ways a video can start than its own title card, so videos in the feed do not all open the
// same way. Each draws only words and numbers the title scene and its narration already have. See ../engine.js for how
// templates work, and lib/looks-intro.ts for when each is picked.
import { register } from "../engine.js";

const CAT = 'Openings';
const DISPLAY = { fam: 'd', w: 700 };

// Splits a text into lines no wider than `width`, at the biggest size from `big` down to `small` that needs at most
// `most` lines, then evens the lines out so the last one is not a lone word. A word too long for the width makes the
// text smaller still, and at `small` it takes as many lines as it needs, so no word is ever left out. `o` is the font,
// as for U.tw.
function fitLines(U, text, width, most, big, small, o = {}) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  // Each word is measured once per size and a line is its words and the spaces between them, since measuring on the
  // real fonts takes the browser a moment each time.
  const known = new Map();
  const widthOf = (word, size) => {
    const key = `${size} ${word}`;
    if (!known.has(key)) known.set(key, U.tw(word, size, o));
    return known.get(key);
  };
  const wrapAt = (size, w) => {
    // A space on its own measures as nothing in SVG text, so it is measured between two letters.
    const lines = [], space = widthOf('n n', size) - widthOf('nn', size);
    let lineW = 0;
    for (const word of words) {
      const wordW = widthOf(word, size);
      if (lines.length && lineW + space + wordW <= w) {
        lines[lines.length - 1] += ` ${word}`;
        lineW += space + wordW;
      } else {
        lines.push(word);
        lineW = wordW;
      }
    }
    return lines;
  };
  let size = big;
  while (size > small && wrapAt(size, width).length > most) size = Math.max(small, Math.floor(size * 0.95));
  while (size > 20 && words.some((word) => widthOf(word, size) > width)) size = Math.floor(size * 0.95);
  // Narrower lines while there are as many of them, so they come out about even.
  const count = wrapAt(size, width).length;
  let w = width;
  while (count > 1 && w > width * 0.5 && wrapAt(size, w * 0.97).length === count) w *= 0.97;
  return { lines: wrapAt(size, w), size };
}

// Lines of text one under the other from the baseline `y`, each coming in with the animation `an` gives for its index.
const lines = (U, fit, x, y, lh, o, an) => fit.lines.map((line, k) => U.T(x, (y + k * lh).toFixed(1), line, { ...o, s: fit.size, an: an(k) })).join('');

// Grows an element calmly into place around its middle (its data-cx and data-cy): from a little smaller and
// transparent to its full size, without the overshoot of the engine's pop.
function settle(U, el, p, at, d) {
  if (!el) return;
  const q = U.ease.out(U.prog(p, at, at + d)), cx = +el.dataset.cx, cy = +el.dataset.cy, s = 0.82 + 0.18 * q;
  el.setAttribute('transform', `translate(${cx} ${cy}) scale(${s.toFixed(4)}) translate(${-cx} ${-cy})`);
  el.setAttribute('opacity', q.toFixed(3));
}

register('icon_hero', {
  cat: CAT, title: 'Icon opening', desc: 'The topic’s icon big in the middle, growing in calmly inside a ring that draws itself, with the title under it and the subtitle small below.',
  use: 'The opening of a video whose topic has an icon.',
  params: 'icon, title, subtitle', example: { icon: 'heart', title: 'How the Heart Pumps Blood', subtitle: 'Four chambers, two loops, one steady beat' },
  build(p, c) {
    const { U, th } = c;
    // Without an icon the title is the picture, so it is set bigger.
    const head = fitLines(U, p.title, 1500, 2, p.icon ? 92 : 140, 60, DISPLAY);
    const sub = fitLines(U, p.subtitle, 1400, 2, 46, 36);
    const headH = head.lines.length * head.size * 1.08, subH = sub.lines.length ? 30 + sub.lines.length * sub.size * 1.3 : 0;
    // The icon takes the room the words leave. Without an icon the words stand alone.
    const r = p.icon ? Math.max(120, Math.min(230, (650 - headH - subH - 44) / 2)) : 0;
    const top = 540 - (2 * r + (r ? 44 : 0) + headH + subH) / 2, cy = top + r, y = top + 2 * r + (r ? 44 : 0) + head.size * 0.8;
    const ring = 2 * Math.PI * r;
    return U.bg() +
      (r ? `<circle cx="960" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="none" stroke="${th.muted}" stroke-opacity="0.45" stroke-width="4" stroke-dasharray="${ring.toFixed(0)}" stroke-dashoffset="${ring.toFixed(0)}" transform="rotate(-90 960 ${cy.toFixed(1)})"${U.A('draw', 0.02, 0.3, { l: ring.toFixed(0) })}/>` +
        `<g id="${c.id}icon" data-cx="960" data-cy="${cy.toFixed(1)}" opacity="0">${U.icon(p.icon, 960, cy, r * 1.45, th.accent)}</g>` : '') +
      lines(U, head, 960, y, head.size * 1.08, { ...DISPLAY, f: th.ink }, (k) => U.A('up', 0.28 + k * 0.05, 0.1)) +
      lines(U, sub, 960, y + (head.lines.length - 1) * head.size * 1.08 + 30 + sub.size * 1.3, sub.size * 1.3, { f: th.muted }, () => U.A('fade', 0.42, 0.1));
  },
  init(root, p, c) { return { icon: root.querySelector(`#${c.id}icon`) }; },
  render(l, st, p, c) { settle(c.U, st.icon, l.p, 0.06, 0.3); },
});

// When a number opening's count starts and lands, as fractions of the scene. It starts a moment before the narration
// says the number (`at`, which TemplateScene finds from the spoken number) and lands about a second later, as the voice
// finishes saying it. Without a time it starts at once.
function countTimes(p, c) {
  const from = Math.min(0.6, Math.max(0.02, typeof p.at === 'number' ? p.at : 0.06));
  return { from, land: from + Math.min(0.3, 1 / (c?.dur || 8)) };
}

register('number_hook', {
  cat: CAT, title: 'Number opening', desc: 'A number the opening sentence says counts up big as it is said, between the small word before it and its unit, with the words of its clause over and under it so it reads as the narration says it, and the title small at the top.',
  use: 'The opening of a video whose first sentence states a striking number.',
  params: 'value, decimals, sign (a currency sign written before the number, like "$"), prefix (a word like "over" that the number needs), suffix (its unit, like " years" or "%"), lead (the words of its clause before it), label (the words after it), title, at (when the number is said: a fraction of the scene, or the number as the narration writes it)',
  example: { value: 1500, prefix: 'over', suffix: ' years', label: 'a vast network of routes linked China to Europe', title: 'The Silk Road' },
  build(p, c) {
    const { U, th } = c, value = Number(p.value) || 0, dec = p.decimals || 0, sign = String(p.sign || '');
    // Thousands separators from 1,000, as the narration writes them. A currency sign is part of the number and counts with it.
    const sep = Math.abs(value) >= 1000 ? 'always' : '', shown = sign + U.fmtNum(value, dec, sep);
    const prefix = String(p.prefix || '').trim(), unit = String(p.suffix || '');
    // A unit joined to the number ("363-foot", "45%") sits right against it; a word ("years") a space away.
    const joined = !/^\s/.test(unit), unitText = unit.trim();
    // The number as big as fits the frame with its words beside it, which are about a third of its size.
    const widthAt = (s) => U.tw(shown, s, DISPLAY) + (prefix ? U.tw(prefix, s * 0.34, DISPLAY) + s * 0.12 : 0) + (unitText ? U.tw(unitText, s * 0.34, DISPLAY) + (joined ? s * 0.03 : s * 0.1) : 0);
    const size = Math.floor(Math.min(330, (330 * 1500) / Math.max(1, widthAt(330)))), small = Math.round(size * 0.34);
    const head = fitLines(U, p.title, 1300, 2, 64, 44, DISPLAY);
    // The words before the number go over it and the words after it under it, so the three read as one sentence.
    const lead = fitLines(U, p.lead, 1400, 2, 52, 38);
    const label = fitLines(U, p.label, 1400, 2, 52, 38);
    const { from, land } = countTimes(p, c);
    // The lockup sits in the middle, with the title and the lead over it and the label under it.
    const headH = head.lines.length * head.size * 1.1, labelH = label.lines.length * label.size * 1.3;
    const leadH = lead.lines.length ? (lead.lines.length - 1) * lead.size * 1.3 + lead.size * 0.75 + 34 : 0;
    // How far the number reaches above its line: Blueprint's figures stand taller than most, and a dollar sign taller
    // still. Field guide's numerals hang below the line (old-style figures), so the label keeps clear of them.
    const top = size * (sign ? 0.9 : 0.8), below = size * 0.18 + 36;
    const base = 540 + (headH + 60 + leadH + top - (labelH + below)) / 2;
    const left = 960 - widthAt(size) / 2;
    const leadY = base - top - 34 - (lead.lines.length - 1) * lead.size * 1.3;
    const headY = base - top - leadH - 60 - (head.lines.length - 1) * head.size * 1.1;
    // The word before, the number and its unit are one line of text, so the browser sets them side by side on the
    // fonts it has and the gaps are exact. While the number counts, only its digits show: "over 944 years" on the way
    // would read as a claim. The word before and the unit keep their places and come in as the count lands (render).
    const lockup = `<text x="${left.toFixed(1)}" y="${base.toFixed(1)}" text-anchor="start" font-family="${U.fam('d')}" font-weight="700"${U.A('fade', from, 0.04)}>` +
      (prefix ? `<tspan class="${c.id}words" font-size="${small}" fill="${th.muted}" fill-opacity="0">${U.esc(prefix)}</tspan>` : '') +
      `<tspan font-size="${size}" fill="${th.accent}"${prefix ? ` dx="${Math.round(size * 0.12)}"` : ''}${U.A('count', from, land - from, { from: 0, to: value, dec, sep, pre: sign })}>${U.esc(shown)}</tspan>` +
      (unitText ? `<tspan class="${c.id}words" font-size="${small}" fill="${th.accent}" fill-opacity="0" dx="${Math.round(joined ? size * 0.03 : size * 0.1)}">${U.esc(unitText)}</tspan>` : '') +
      '</text>';
    return U.bg() +
      lines(U, head, 960, headY, head.size * 1.1, { ...DISPLAY, f: th.muted }, () => U.A('fade', 0.02, 0.08)) +
      lines(U, lead, 960, leadY, lead.size * 1.3, { f: th.ink }, (k) => U.A('up', 0.02 + k * 0.03, 0.08)) +
      lockup +
      lines(U, label, 960, base + below + label.size, label.size * 1.3, { f: th.ink }, (k) => U.A('up', land + 0.02 + k * 0.04, 0.1));
  },
  init(root, p, c) { return { words: [...root.querySelectorAll(`.${c.id}words`)], land: countTimes(p, c).land }; },
  // A part of a line of text cannot be faded with opacity, so the words fade with their fill.
  render(l, st, p, c) { const q = c.U.prog(l.p, st.land - 0.02, st.land + 0.06).toFixed(3); for (const word of st.words) word.setAttribute('fill-opacity', q); },
});

register('date_hook', {
  cat: CAT, title: 'Date opening', desc: 'A date the opening sentence says, set big like a dateline: the day, a rule that draws itself, the month over the year, and the title under it.',
  use: 'The opening of a video whose first sentence names the day it happened.',
  params: 'day, month, year, title', example: { day: 16, month: 'July', year: 1969, title: 'Apollo 11' },
  build(p, c) {
    const { U, th } = c, day = String(p.day ?? ''), month = String(p.month || '');
    const year = Number(p.year) < 0 ? `${-Number(p.year)} BC` : String(p.year ?? '');
    // The day as tall as the month and the year stacked beside it, the whole date at most 1,400 wide.
    const widthAt = (s) => U.tw(day, s, DISPLAY) + s * 0.3 + Math.max(U.tw(month, s * 0.36, DISPLAY), U.tw(year, s * 0.36, DISPLAY));
    const size = Math.floor(Math.min(380, (380 * 1400) / Math.max(1, widthAt(380)))), side = Math.round(size * 0.36), cap = size * 0.7;
    const head = fitLines(U, p.title, 1300, 2, 84, 52, DISPLAY);
    const headH = head.lines.length * head.size * 1.1;
    // The title keeps clear of numerals that hang below the line, like Field guide's old-style figures.
    const below = size * 0.2 + 40;
    const base = 540 + (cap - headH - below) / 2;
    // The day is set from its right end and the month and year from their left, so the gaps around the rule are
    // exact whatever the fonts' real widths.
    const ruleX = 960 - widthAt(size) / 2 + U.tw(day, size, DISPLAY) + size * 0.13, sideX = ruleX + size * 0.17;
    return U.bg() +
      U.T((ruleX - size * 0.13).toFixed(1), base.toFixed(1), day, { a: 'end', ...DISPLAY, s: size, f: th.accent, an: U.A('up', 0.03, 0.12) }) +
      `<path d="M${ruleX.toFixed(1)} ${(base - cap).toFixed(1)}V${base.toFixed(1)}" stroke="${th.accent}" stroke-width="6" stroke-linecap="round" fill="none" stroke-dasharray="${cap.toFixed(0)}" stroke-dashoffset="${cap.toFixed(0)}"${U.A('draw', 0.1, 0.15, { l: cap.toFixed(0) })}/>` +
      U.T(sideX, base - cap + side * 0.72, month, { a: 'start', ...DISPLAY, s: side, f: th.ink, an: U.A('left', 0.16, 0.1) }) +
      U.T(sideX, base, year, { a: 'start', ...DISPLAY, s: side, f: th.muted, an: U.A('left', 0.22, 0.1) }) +
      lines(U, head, 960, base + below + head.size * 0.8, head.size * 1.1, { ...DISPLAY, f: th.ink }, (k) => U.A('up', 0.34 + k * 0.05, 0.1));
  },
});

register('headline_words', {
  cat: CAT, title: 'Headline opening', desc: 'The title in large type, its words rising one by one from under their line, the last word in the accent color, with the subtitle fading in under them.',
  use: 'The opening of a video with a short title.',
  params: 'title, subtitle', example: { title: 'How Neural Networks Learn', subtitle: 'By adjusting weights to make smaller mistakes' },
  build(p, c) {
    const { U, th } = c, x0 = 220;
    const head = fitLines(U, p.title, 1480, 3, 170, 76, DISPLAY), lh = head.size * 1.06;
    const sub = fitLines(U, p.subtitle, 1400, 2, 54, 38);
    const n = head.lines.join(' ').split(' ').length, step = Math.min(0.08, 0.4 / n);
    const top = 540 - (head.lines.length * lh + (sub.lines.length ? 40 + sub.lines.length * sub.size * 1.3 : 0)) / 2;
    let out = U.bg(), k = 0;
    head.lines.forEach((line, r) => {
      // Each line is a window the words rise into from below, so a word is hidden until it rises. The window reaches
      // far to both sides, so a font that runs wider than measured is never cut off.
      const base = top + head.size * 0.84 + r * lh, y = base.toFixed(1), clip = `${c.id}line${r}`;
      // One text per line, so the browser sets the spaces between the words on the fonts it really has. Each word is
      // a tspan that render() raises into place; it is drawn settled, in case render cannot run.
      const words = [];
      for (const word of line.split(' ')) {
        words.push(`<tspan class="${c.id}word" y="${y}" data-base="${y}" data-from="${(0.02 + k * step).toFixed(3)}"${k === n - 1 ? ` fill="${th.accent}"` : ''}>${U.esc(word)}</tspan>`);
        k++;
      }
      // The window has room for accents above and descenders below, and a word starts far enough down to be out of it.
      out += `<defs><clipPath id="${clip}"><rect x="-2000" y="${(base - head.size * 1.15).toFixed(1)}" width="5920" height="${(head.size * 1.55).toFixed(1)}"/></clipPath></defs>` +
        `<g clip-path="url(#${clip})"><text x="${x0}" y="${y}" text-anchor="start" font-family="${U.fam('d')}" font-size="${head.size}" font-weight="700" fill="${th.ink}" data-drop="${(head.size * 1.45).toFixed(1)}">${words.join(' ')}</text></g>`;
    });
    const subY = top + head.lines.length * lh + 40 + sub.size;
    // The subtitle only fades in, since rising from below it would pass over the captions.
    return out + lines(U, sub, x0, subY, sub.size * 1.3, { a: 'start', f: th.muted }, () => U.A('fade', 0.1 + n * step, 0.12));
  },
  init(root, p, c) {
    return [...root.querySelectorAll(`.${c.id}word`)].map((el) => ({ el, base: +el.dataset.base, from: +el.dataset.from, drop: +el.parentNode.dataset.drop }));
  },
  // A tspan cannot be moved with a transform, so each word rises by its y, and fades in with its fill on the way.
  render(l, words, p, c) {
    for (const word of words) {
      const q = c.U.ease.out(c.U.prog(l.p, word.from, word.from + 0.13));
      word.el.setAttribute('y', (word.base + (1 - q) * word.drop).toFixed(1));
      word.el.setAttribute('fill-opacity', Math.min(1, q * 2).toFixed(3));
    }
  },
});

register('split_title', {
  cat: CAT, title: 'Split opening', desc: 'The frame split in two: the topic’s icon big on one side, and on the other a solid panel in the accent color that slides in with the title and subtitle on it in the ground color.',
  use: 'The opening of a video whose topic has an icon.',
  params: 'icon, title, subtitle', example: { icon: 'rocket', title: 'Apollo 11', subtitle: 'How did Apollo 11 land humans on the Moon?' },
  build(p, c) {
    const { U, th } = c;
    // The icon keeps its own colors on the ground, since an icon cuts its details in the ground color and would be a
    // bare silhouette on the panel. Without an icon the panel takes most of the frame.
    const edge = p.icon ? 760 : 300, x0 = edge + 110, width = 1800 - x0;
    const head = fitLines(U, p.title, width, 3, 140, 68, DISPLAY), lh = head.size * 1.06;
    const sub = fitLines(U, p.subtitle, width, 3, 52, 38);
    const textH = head.lines.length * lh + 64 + sub.lines.length * sub.size * 1.3;
    const y = 540 - textH / 2 + head.size * 0.8, ruleY = y + (head.lines.length - 1) * lh + head.size * 0.42;
    // The panel reaches far past the frame, so it fills its side even when the scene is moved or scaled, and it is
    // marked as ground, so it is not measured as part of the picture.
    return U.bg() +
      `<g data-fm-bg="1"><g${U.A('move', 0, 0.12, { x0: 1960 - edge, y0: 0, x1: 0, y1: 0 })}><rect x="${edge}" y="-2000" width="${4000 - edge}" height="5080" fill="${th.accent}"/></g></g>` +
      (p.icon ? `<g id="${c.id}icon" data-cx="${edge / 2}" data-cy="540" opacity="0">${U.icon(p.icon, edge / 2, 540, 420, th.accent)}</g>` : '') +
      lines(U, head, x0, y, lh, { a: 'start', ...DISPLAY, f: th.bg }, (k) => U.A('left', 0.14 + k * 0.05, 0.1)) +
      `<path d="M${x0} ${ruleY.toFixed(1)}H${x0 + 160}" stroke="${th.bg}" stroke-width="8" stroke-linecap="round" stroke-dasharray="160" stroke-dashoffset="160"${U.A('draw', 0.26, 0.1, { l: 160 })}/>` +
      lines(U, sub, x0, ruleY + 22 + sub.size * 1.1, sub.size * 1.3, { a: 'start', f: th.bg, ex: ' fill-opacity="0.8"' }, () => U.A('fade', 0.34, 0.1));
  },
  init(root, p, c) { return { icon: root.querySelector(`#${c.id}icon`) }; },
  render(l, st, p, c) { settle(c.U, st.icon, l.p, 0.1, 0.3); },
});
