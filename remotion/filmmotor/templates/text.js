// Templates for text, lists and teaching: Trym's code from his film engine (templates/tekst.js), adapted for Meko
// with English text and the Night atlas theme. See ../engine.js for how templates work.
import { register, preset } from "../engine.js";

register('title_card', {
  cat: 'Text', title: 'Title card', desc: 'A big title with a small kicker above it, a subtitle and a line that draws itself.', use: 'The opening of a video or of a new part.',
  params: 'kicker, title, subtitle', example: { kicker: 'A film about', title: 'When the people rose', subtitle: 'The French Revolution and the right to vote' },
  build(p, c) {
    const { U, th } = c, t = p.title || '', s = t.length <= 14 ? 130 : t.length <= 24 ? 104 : 80;
    const L = U.wrap(t, t.length > 24 ? 30 : 40).slice(0, 3), y0 = L.length > 2 ? 420 : L.length > 1 ? 470 : 520, yb = y0 + (L.length - 1) * s * 1.05;
    return U.bg() + (p.kicker ? U.T(960, y0 - s * 0.95, U.lab(p.kicker), { s: 30, w: 600, f: th.accent, ls: th.upper ? 8 : 1, an: U.A('fade', 0.05, 0.08) }) : '') +
      L.map((l, k) => U.T(960, y0 + k * s * 1.05, l, { fam: 'd', s, w: 700, an: U.A('up', 0.1 + k * 0.06, 0.1) })).join('') +
      `<path d="M760 ${yb + 46}H1160" stroke="${th.accent}" stroke-width="4" stroke-dasharray="400" stroke-dashoffset="400"${U.A('draw', 0.28, 0.15, { l: 400 })}/>` +
      (p.subtitle ? U.T(960, yb + 112, p.subtitle, { s: 38, f: th.muted, an: U.A('up', 0.36, 0.1) }) : '');
  },
});
register('chapter_card', {
  cat: 'Text', title: 'Chapter card', desc: 'A part number and title, with a big number in the background.', use: 'Moving on to a new part of the video.',
  params: 'label, title, number', example: { label: 'Part 2', title: 'The Enlightenment', number: '2' },
  build(p, c) {
    const { U, th } = c;
    return U.bg() + (p.number ? U.T(1500, 820, p.number, { fam: 'd', s: 560, w: 700, f: th.line, op: 0.0, an: U.A('fade', 0.02, 0.2) }) : '') +
      U.T(300, 470, U.lab(p.label || ''), { a: 'start', s: 34, w: 600, f: th.accent, ls: th.upper ? 8 : 1, an: U.A('left', 0.05, 0.1) }) +
      `<path d="M300 496H620" stroke="${th.accent}" stroke-width="4" stroke-dasharray="320" stroke-dashoffset="320"${U.A('draw', 0.1, 0.12, { l: 320 })}/>` +
      U.wrap(p.title || '', 22).slice(0, 2).map((l, k) => U.T(300, 600 + k * 110, l, { a: 'start', fam: 'd', s: 104, w: 700, an: U.A('left', 0.16 + k * 0.05, 0.1) })).join('');
  },
});
register('question_card', {
  cat: 'Text', title: 'Question card', desc: 'A question, line by line, with a big question mark behind it.', use: 'The main question of the video, or a question to the viewer.',
  params: 'label, question', example: { label: 'The question', question: 'How did the French Revolution change who could take part in democracy?' },
  build(p, c) {
    const { U, th } = c, L = U.wrap(p.question || '', 34).slice(0, 4), y0 = 560 - (L.length - 1) * 40;
    return U.bg() + U.T(330, 700, '?', { fam: 'd', s: 620, w: 700, f: th.line, op: 0, an: U.A('fade', 0.02, 0.2) }) +
      U.T(960, y0 - 110, U.lab(p.label || ''), { s: 30, w: 600, f: th.accent, ls: th.upper ? 8 : 1, an: U.A('fade', 0.04, 0.08) }) +
      L.map((l, k) => U.T(960, y0 + k * 80, l, { fam: 'd', s: 64, w: 600, an: U.A('up', 0.1 + k * 0.08, 0.1) })).join('');
  },
});
register('big_statement', {
  cat: 'Text', title: 'Big statement', desc: 'One sentence in big type, word by word. Chosen words get the accent color.', use: 'A main point, a conclusion or a sentence that should stick.',
  params: 'text, emphasis (words), size', example: { text: 'The revolution lost in the short run, but its ideas won in the long run.', emphasis: ['lost', 'won'] },
  build(p, c) {
    const { U, th } = c, size = p.size || 84, words = String(p.text || '').split(/\s+/).filter(Boolean);
    const em = new Set((p.emphasis || []).map((w) => w.toLowerCase())), sp = size * 0.28, wid = (w) => U.tw(w, size, { fam: 'd', w: 700 });
    const lines = []; let cur = [], cw = 0;
    words.forEach((w) => { const ww = wid(w); if (cw + ww > 1500 && cur.length) { lines.push(cur); cur = []; cw = 0; } cur.push(w); cw += ww + sp; });
    if (cur.length) lines.push(cur);
    const lh = size * 1.25, y0 = 540 - ((lines.length - 1) * lh) / 2 + size * 0.35;
    let out = U.bg(), i = 0;
    lines.forEach((ln, r) => {
      const tw = ln.reduce((s, w) => s + wid(w), 0) + sp * (ln.length - 1); let x = 960 - tw / 2;
      ln.forEach((w) => {
        const ww = wid(w), cx = x + ww / 2, y = y0 + r * lh, key = w.toLowerCase().replace(/[.,:;!?]/g, '');
        out += U.T(cx, y, w, { fam: 'd', s: size, w: 700, f: em.has(key) ? th.accent : th.ink, an: U.A('pop', 0.05 + (i / words.length) * 0.55, 0.05, { cx, cy: y - size * 0.3 }) });
        x += ww + sp; i++;
      });
    });
    return out;
  },
});
register('definition_card', {
  cat: 'Text', title: 'Definition', desc: 'A term with its word class, a definition and an example.', use: 'The first time a technical term is used.',
  params: 'term, kind, definition, example', example: { term: 'Popular sovereignty', kind: 'noun', definition: 'The principle that all power in the state comes from the people.', example: 'The constitution is built on popular sovereignty.' },
  build(p, c) {
    const { U, th } = c, D = U.wrap(p.definition || '', 46).slice(0, 3);
    return U.bg() + U.card(360, 260, 1200, 560, { an: U.A('fade', 0.02, 0.06) }) +
      U.T(440, 400, p.term || '', { a: 'start', fam: 'd', s: 92, w: 700, f: th.accent, an: U.A('left', 0.06, 0.1) }) +
      U.T(440, 450, p.kind || '', { a: 'start', s: 30, it: true, f: th.muted, an: U.A('fade', 0.14, 0.08) }) +
      D.map((l, k) => U.T(440, 540 + k * 52, l, { a: 'start', s: 42, an: U.A('up', 0.22 + k * 0.05, 0.08) })).join('') +
      (p.example ? U.T(440, 540 + D.length * 52 + 50, '“' + p.example + '”', { a: 'start', s: 34, it: true, f: th.muted, an: U.A('fade', 0.45, 0.1) }) : '');
  },
});
register('quote_card', {
  cat: 'Text', title: 'Quote', desc: 'A quote with a big quotation mark, a name and a role.', use: 'A source saying something important in its own words.',
  params: 'quote, author, role', example: { quote: 'Man is born free, and everywhere he is in chains.', author: 'Jean-Jacques Rousseau', role: 'The Social Contract, 1762' },
  build(p, c) {
    const { U, th } = c, L = U.wrap(p.quote || '', 38).slice(0, 4), y0 = 500 - (L.length - 1) * 38;
    return U.bg() + U.T(330, 560, '“', { fam: 'd', s: 360, w: 700, f: th.accent, an: U.A('pop', 0.02, 0.06, { cx: 330, cy: 380 }) }) +
      L.map((l, k) => U.T(1000, y0 + k * 76, l, { fam: 'd', s: 60, it: true, an: U.A('up', 0.08 + k * 0.06, 0.1) })).join('') +
      U.T(1000, y0 + L.length * 76 + 50, p.author || '', { s: 36, w: 600, f: th.accent, an: U.A('fade', 0.4, 0.1) }) +
      U.T(1000, y0 + L.length * 76 + 96, p.role || '', { s: 28, f: th.muted, an: U.A('fade', 0.46, 0.1) });
  },
});
register('kinetic_words', {
  cat: 'Text', title: 'Kinetic words', desc: 'Key words that punch in one by one, stacked in the middle of the frame.', use: 'Summing up three to five key words with force.',
  params: 'words (2–5)', example: { words: ['Liberty', 'Equality', 'Fraternity'] },
  build(p, c) {
    const { U, th } = c, W = (p.words || []).slice(0, 5), N = W.length, lh = Math.min(180, 720 / Math.max(1, N)), y0 = 540 - ((N - 1) * lh) / 2 + lh * 0.35;
    return U.bg() + W.map((w, k) => { const y = y0 + k * lh, s = Math.min(170, lh * 0.95); return U.T(960, y, U.lab(w), { fam: 'd', s, w: 800, f: k % 2 ? th.accent : th.ink, an: U.A('stamp', p.times?.[k] ?? 0.06 + k * (0.6 / N), 0.05, { cx: 960, cy: y - s * 0.3 }) }); }).join('');
  },
});
register('strike_replace', {
  cat: 'Text', title: 'Strike and replace', desc: 'Lines are struck through and replaced by the next, as when a name or a regime changes.', use: 'A change of regime or name, or an idea that is replaced.',
  params: 'items: [{text, strike: true|false}]', example: { items: [{ text: 'Kingdom of France', strike: true }, { text: 'French Republic', strike: true }, { text: 'French Empire' }] },
  build(p, c) {
    const { U, th } = c, I = (p.items || []).slice(0, 5), N = I.length, lh = 120, y0 = 540 - ((N - 1) * lh) / 2 + 24, step = 0.8 / N;
    return U.bg() + I.map((it, k) => {
      const y = y0 + k * lh, at = p.times?.[k] ?? 0.05 + k * step, w = U.tw(it.text, 72, { fam: 'd', w: 700 }), last = k === N - 1;
      return U.T(960, y, it.text, { fam: 'd', s: 72, w: 700, f: last ? th.accent : th.ink, an: U.A('up', at, 0.08) }) +
        (it.strike ? `<path d="M${960 - w / 2 - 20} ${y - 22}H${960 + w / 2 + 20}" stroke="${th.bad}" stroke-width="8" stroke-linecap="round" stroke-dasharray="${w + 40}" stroke-dashoffset="${w + 40}"${U.A('draw', at + step * 0.6, 0.08, { l: w + 40 })}/>` : '');
    }).join('');
  },
});
register('myth_buster', {
  cat: 'Fact check', title: 'Myth and fact', desc: 'A myth is shown, struck through and stamped. Then the fact comes.', use: 'Clearing up a common misunderstanding.',
  params: 'myth, fact, mythLabel, factLabel', example: { myth: 'The Bastille was full of political prisoners.', fact: 'It held only seven prisoners in 1789.' },
  build(p, c) {
    const { U, th } = c, mw = U.tw(p.myth || '', 56, { fam: 'd', w: 600 });
    return U.bg() + U.T(960, 330, U.lab(p.mythLabel || 'Myth'), { s: 30, w: 600, f: th.bad, ls: th.upper ? 8 : 1, an: U.A('fade', 0.04, 0.06) }) +
      U.T(960, 420, p.myth || '', { fam: 'd', s: 56, w: 600, f: th.muted, an: U.A('up', 0.08, 0.08) }) +
      `<path d="M${960 - mw / 2 - 20} 400H${960 + mw / 2 + 20}" stroke="${th.bad}" stroke-width="7" stroke-linecap="round" stroke-dasharray="${mw + 40}" stroke-dashoffset="${mw + 40}"${U.A('draw', 0.3, 0.1, { l: mw + 40 })}/>` +
      `<g${U.A('stamp', 0.38, 0.05, { cx: 1500, cy: 250 })}><g transform="rotate(-8 1500 250)"><rect x="1360" y="200" width="280" height="100" rx="8" fill="${th.bg}" stroke="${th.bad}" stroke-width="8"/>${U.T(1500, 272, U.lab(p.mythLabel || 'Myth'), { fam: 'd', s: 60, w: 800, f: th.bad })}</g></g>` +
      U.T(960, 600, U.lab(p.factLabel || 'Fact'), { s: 30, w: 600, f: th.good, ls: th.upper ? 8 : 1, an: U.A('fade', 0.5, 0.06) }) +
      U.wrap(p.fact || '', 40).slice(0, 2).map((l, k) => U.T(960, 690 + k * 72, l, { fam: 'd', s: 60, w: 700, an: U.A('up', 0.55 + k * 0.05, 0.08) })).join('');
  },
});
register('bullet_list', {
  cat: 'Text', title: 'Bullet list', desc: 'A list that builds up point by point, with dots, numbers, checks or crosses.', use: 'Causes, features, requirements or examples.',
  params: 'title, items, style: dot|number|check|cross', example: { title: 'Causes of the revolution', items: ['The state was nearly bankrupt', 'Poor harvests and dear bread', 'New ideas from the Enlightenment', 'The Third Estate paid the taxes'], style: 'dot' },
  build(p, c) {
    const { U, th } = c, I = (p.items || []).slice(0, 6), N = I.length, lh = Math.min(110, 560 / Math.max(1, N)), y0 = 360, step = 0.75 / Math.max(1, N);
    const mark = (k, y) => {
      const x = 420, st = p.style || 'dot';
      if (st === 'number') return `<circle cx="${x}" cy="${y - 14}" r="30" fill="${th.accent}"/>` + U.T(x, y - 2, String(k + 1), { s: 34, w: 700, f: th.bg });
      if (st === 'check') return U.icon('check', x, y - 14, 52, th.good);
      if (st === 'cross') return U.icon('cross', x, y - 14, 46, th.bad);
      return `<circle cx="${x}" cy="${y - 14}" r="11" fill="${th.accent}"/>`;
    };
    return U.bg() + (p.title ? U.T(380, 250, p.title, { a: 'start', fam: 'd', s: 70, w: 700, an: U.A('left', 0.02, 0.08) }) : '') +
      I.map((it, k) => { const y = y0 + k * lh + 30; return `<g${U.A('left', p.times?.[k] ?? 0.1 + k * step, 0.07)}>${mark(k, y)}${U.T(480, y, it, { a: 'start', s: 44 })}</g>`; }).join('');
  },
});
preset('checklist_recap', 'bullet_list', { cat: 'Teaching', title: 'Recap with checks', desc: 'The main points are checked off one by one.', use: 'The end of a part or of the video.', defaults: { style: 'check' },
  example: { title: 'What you have learned', items: ['What the society of estates was', 'Who could vote in 1791', 'Why the old order fell'] } });
preset('key_takeaways', 'bullet_list', { cat: 'Teaching', title: 'Key takeaways', desc: 'Numbered main points.', use: 'Three things the viewer should remember.', defaults: { style: 'number' },
  example: { title: 'Three things to remember', items: ['Power should come from the people', 'Power should be split in three', 'Everyone has basic rights'] } });
register('pros_cons', {
  cat: 'Comparison', title: 'Pros and cons', desc: 'Two columns of pros and cons that fill in by turns.', use: 'Weighing up a choice, a solution or an event.',
  params: 'title, pros, cons, prosLabel, consLabel', example: { title: 'Revolution', pros: ['Big changes, fast', 'Old privileges disappear'], cons: ['Chaos and violence', 'Can end in dictatorship'] },
  build(p, c) {
    const { U, th } = c, P = (p.pros || []).slice(0, 4), K = (p.cons || []).slice(0, 4), N = Math.max(P.length, K.length), step = 0.7 / Math.max(1, N * 2);
    const col = (x, items, label, color, ic, off) => U.card(x, 300, 700, 560, { an: U.A('fade', 0.04, 0.06) }) + U.T(x + 350, 380, U.lab(label), { s: 34, w: 700, f: color, ls: th.upper ? 6 : 1 }) +
      items.map((it, k) => `<g${U.A('up', 0.12 + (k * 2 + off) * step, 0.06)}>${U.icon(ic, x + 70, 470 + k * 100 - 12, 44, color)}${U.T(x + 120, 470 + k * 100, it, { a: 'start', s: 36 })}</g>`).join('');
    return U.bg() + (p.title ? U.T(960, 230, p.title, { fam: 'd', s: 64, w: 700, an: U.A('fade', 0.02, 0.06) }) : '') +
      col(220, P, p.prosLabel || 'Pros', th.good, 'check', 0) + col(1000, K, p.consLabel || 'Cons', th.bad, 'cross', 1);
  },
});
register('step_solution', {
  cat: 'Teaching', title: 'Step-by-step working', desc: 'Lines that come one by one, with the answer highlighted at the end.', use: 'Math, physics, economics or any other calculation.',
  params: 'title, steps, result', example: { title: 'What share?', steps: ['Share = part / whole', 'Share = 37 / 112', 'Share ≈ 0.33'], result: '≈ 33 percent were farmers' },
  build(p, c) {
    const { U, th } = c, S = (p.steps || []).slice(0, 6), step = 0.6 / Math.max(1, S.length);
    return U.bg() + (p.title ? U.T(380, 250, p.title, { a: 'start', fam: 'd', s: 64, w: 700, an: U.A('fade', 0.02, 0.06) }) : '') +
      S.map((s, k) => `<g${U.A('left', 0.1 + k * step, 0.06)}>${U.T(400, 380 + k * 90, '→', { a: 'start', s: 44, f: th.accent })}${U.T(470, 380 + k * 90, s, { a: 'start', fam: 'd', s: 52 })}</g>`).join('') +
      (p.result ? `<g${U.A('pop', 0.75, 0.06, { cx: 960, cy: 380 + S.length * 90 + 40 })}>${U.card(380, 380 + S.length * 90 - 20, 1160, 110, { s: th.accent, sw: 4 })}${U.T(960, 380 + S.length * 90 + 52, p.result, { fam: 'd', s: 54, w: 700, f: th.accent })}</g>` : '');
  },
});
register('formula_reveal', {
  cat: 'Teaching', title: 'Formula reveal', desc: 'The parts of a formula appear one by one, with notes below.', use: 'Formulas and relationships in science.',
  params: 'parts: [{text, note?}], caption, size', example: { parts: [{ text: 'E', note: 'energy' }, { text: '=' }, { text: 'm', note: 'mass' }, { text: '·' }, { text: 'c²', note: 'speed of light squared' }], caption: 'Mass and energy are linked' },
  build(p, c) {
    const { U, th } = c, P = p.parts || [], s = p.size || 150, gap = s * 0.27, wid = (t) => Math.max(s * 0.4, U.tw(t, s, { fam: 'd', w: 700 }));
    const tw = P.reduce((a, q) => a + wid(q.text) + gap, -gap); let x = 960 - tw / 2;
    let out = U.bg();
    P.forEach((q, k) => {
      const w = wid(q.text), cx = x + w / 2, at = 0.06 + k * 0.1;
      out += U.T(cx, 560, q.text, { fam: 'd', s, w: 700, f: q.note ? th.accent : th.ink, an: U.A('pop', at, 0.05, { cx, cy: 560 - s * 0.33 }) });
      if (q.note) out += `<g${U.A('up', at + 0.05, 0.06)}><path d="M${cx} 600V650" stroke="${th.muted}" stroke-width="3"/>${U.T(cx, 690, q.note, { s: 30, f: th.muted })}</g>`;
      x += w + gap;
    });
    return out + (p.caption ? U.T(960, 330, p.caption, { s: 40, f: th.muted, an: U.A('fade', 0.6, 0.1) }) : '');
  },
});
