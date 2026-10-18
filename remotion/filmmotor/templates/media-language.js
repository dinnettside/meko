// Templates for media, technology and language: Trym's code from his film engine (templates/medier_sprak.js, without
// the mock-ups of real apps), adapted for Meko with English text and the Night atlas theme. See ../engine.js for how
// templates work.
import { register, H } from "../engine.js";

const CM = 'Media and technology', CL = 'Language';
register('code_snippet', {
  cat: CM, title: 'Code', desc: 'Code that appears line by line in an editor, with colors for keywords, strings and numbers.', use: 'Programming, algorithms and technology.',
  params: 'lang, lines: [text], title', example: { lang: 'python', title: 'average.py', lines: ['numbers = [4, 8, 15, 16, 23, 42]', 'mean = sum(numbers) / len(numbers)', 'print("Mean:", mean)'] },
  build(p, c) {
    const { U, th } = c, Lns = (p.lines || []).slice(0, 12), kw = /\b(def|return|if|else|elif|for|while|in|import|from|class|function|const|let|var|print|True|False|None)\b/g;
    const color = (l) => U.esc(l).replace(/(&quot;.*?&quot;|'.*?')/g, '§S$1§E').replace(kw, '§K$1§E').replace(/\b(\d+(\.\d+)?)\b/g, '§N$1§E').replace(/§S/g, `<tspan fill="${th.accent2}">`).replace(/§K/g, `<tspan fill="${th.accent}">`).replace(/§N/g, `<tspan fill="${th.bad}">`).replace(/§E/g, '</tspan>');
    return U.bg() + `<g${U.A('up', 0.02, 0.06)}><rect x="300" y="200" width="1320" height="${140 + Lns.length * 58}" rx="18" fill="${th.surface}"/><rect x="300" y="200" width="1320" height="56" rx="18" fill="${th.line}"/>${[0, 1, 2].map((k) => `<circle cx="${340 + k * 34}" cy="228" r="10" fill="${th.muted}" opacity=".6"/>`).join('')}${U.T(960, 238, p.title || p.lang || '', { s: 24, f: th.muted })}</g>` +
      Lns.map((l, k) => `<g opacity="0"${U.A('fade', 0.1 + k * (0.6 / Math.max(1, Lns.length)), 0.04)}><text x="340" y="${320 + k * 58}" font-family="${th.fontMono}" font-size="24" fill="${th.muted}">${k + 1}</text><text x="400" y="${320 + k * 58}" font-family="${th.fontMono}" font-size="32" fill="${th.ink}" xml:space="preserve">${color(l)}</text></g>`).join('');
  },
});
register('terminal', {
  cat: CM, title: 'Terminal', desc: 'Commands typed into a terminal, with the answers below.', use: 'Programming, networks and how computers are run with text.',
  params: 'lines: [{cmd, out}]', example: { lines: [{ cmd: 'ping example.com', out: 'Reply from example.com: time=12 ms' }, { cmd: 'python average.py', out: 'Mean: 18.0' }] },
  build(p, c) {
    const { U, th } = c, L = (p.lines || []).slice(0, 6), step = 0.75 / Math.max(1, L.length);
    return U.bg() + `<rect x="300" y="220" width="1320" height="${Math.max(240, 60 + L.length * 110)}" rx="16" fill="${th.surface}" stroke="${th.line}" stroke-width="2"/>` + L.map((l, k) => { const y = 300 + k * 110, at = 0.05 + k * step; return `<text x="340" y="${y}" font-family="${th.fontMono}" font-size="32" fill="${th.accent2}">$ <tspan fill="${th.ink}"${U.A('type', at, step * 0.5, { txt: l.cmd || '' })}></tspan></text>` + (l.out ? `<text x="340" y="${y + 46}" font-family="${th.fontMono}" font-size="28" fill="${th.muted}" opacity="0"${U.A('fade', at + step * 0.6, 0.03)}>${U.esc(l.out)}</text>` : ''); }).join('');
  },
});
register('sorting_algorithm', {
  cat: CM, title: 'Sorting algorithm', desc: 'Bars that swap step by step until they are in order, by bubble sort.', use: 'Algorithms, programming and logical thinking.',
  params: 'values: [number], title', example: { values: [7, 3, 9, 1, 5, 8, 2, 6, 4] },
  build(p, c) {
    const { U, th } = c, id = c.id, V = (p.values || []).slice(0, 14), steps = [V.slice()], a = V.slice();
    for (let i = 0; i < a.length; i++) for (let j = 0; j < a.length - 1 - i; j++) if (a[j] > a[j + 1]) { [a[j], a[j + 1]] = [a[j + 1], a[j]]; steps.push(a.slice()); }
    c._so = steps;
    return U.bg() + V.map((_, k) => `<g id="${id}b${k}"><rect width="80" rx="8" fill="${th.accent}"/><text text-anchor="middle" font-family="${th.fontText}" font-size="30" font-weight="700" fill="${th.ink}"></text></g>`).join('') + U.T(960, 920, '', { s: 30, f: th.muted, id: id + 'st' }) + U.T(960, 220, p.title || 'Bubble sort', { fam: 'd', s: 50, w: 700 });
  },
  init(g, p, c) { const n = (p.values || []).slice(0, 14).length; return { steps: c._so, B: Array.from({ length: n }, (_, k) => { const e = g.querySelector('#' + c.id + 'b' + k); return { e, r: e.querySelector('rect'), t: e.querySelector('text') }; }), st: g.querySelector('#' + c.id + 'st'), last: -1 }; },
  render(l, st, p, c) {
    const S = st.steps, i = Math.min(S.length - 1, Math.floor(c.U.prog(l.p, 0.05, 0.85) * S.length)); if (i === st.last) return; st.last = i;
    const cur = S[i], prev = S[Math.max(0, i - 1)], n = cur.length, w = Math.min(110, 1300 / n), max = Math.max(...cur);
    cur.forEach((v, k) => { const o = st.B[k], h = (560 * v) / max, x = 960 - (n * w) / 2 + k * w + (w - 80) / 2, sw = i > 0 && cur[k] !== prev[k]; o.r.setAttribute('x', x); o.r.setAttribute('y', 860 - h); o.r.setAttribute('height', h); o.r.setAttribute('width', Math.min(80, w - 10)); o.r.setAttribute('fill', sw ? c.th.accent2 : i === S.length - 1 ? c.th.good : c.th.accent); o.t.setAttribute('x', x + Math.min(80, w - 10) / 2); o.t.setAttribute('y', 840 - h); o.t.textContent = v; });
    st.st.textContent = i === S.length - 1 ? 'Sorted after ' + (S.length - 1) + ' swaps' : 'Swap ' + i + ' of ' + (S.length - 1);
  },
});
register('flowchart_decision', {
  cat: CM, title: 'Decision flowchart', desc: 'A question in a diamond with a yes and a no branch, and a new question or an answer on each.', use: 'Choices, judging sources, algorithms and procedures.',
  params: 'question, yes: {text, question?, yes?, no?}, no: {text}, yesLabel, noLabel', example: { question: 'Does it say who wrote it?', yes: { question: 'Is the source up to date?', yes: { text: 'Probably a good source' }, no: { text: 'Look for newer sources' } }, no: { text: 'Be extra careful' } },
  build(p, c) {
    const { U, th } = c;
    const dia = (x, y, t, at) => `<g${U.A('pop', at, 0.05, { cx: x, cy: y })}><path d="M${x} ${y - 90}L${x + 210} ${y}L${x} ${y + 90}L${x - 210} ${y}Z" fill="${th.surface}" stroke="${th.accent}" stroke-width="4"/>${U.wrap(t, 18).slice(0, 3).map((l, k, A) => U.T(x, y + 10 - (A.length - 1) * 16 + k * 32, l, { s: 26, w: 700 })).join('')}</g>`;
    const end = (x, y, t, col, at) => `<g${U.A('pop', at, 0.05, { cx: x, cy: y })}>${U.card(x - 150, y - 45, 300, 90, { f: col, r: 45 })}${U.wrap(t, 20).slice(0, 2).map((l, k, A) => U.T(x, y + 10 - (A.length - 1) * 15 + k * 30, l, { s: 26, w: 700, f: th.bg })).join('')}</g>`;
    const node = (n, x, y, at) => (n.question ? dia(x, y, n.question, at) : end(x, y, n.text || '', n === p.no || n.bad ? th.bad : th.good, at));
    let o = U.bg() + dia(760, 300, p.question || '', 0.05);
    const Y = p.yes || {}, No = p.no || {};
    o += H.arrow(U, th.good, 970, 300, 1240, 300, 0.2, 5) + U.T(1100, 280, p.yesLabel || 'Yes', { s: 28, w: 700, f: th.good }) + node(Y, 1450, 300, 0.25);
    o += H.arrow(U, th.bad, 760, 390, 760, 640, 0.35, 5) + U.T(780, 520, p.noLabel || 'No', { a: 'start', s: 28, w: 700, f: th.bad }) + node(Object.assign({ bad: true }, No), 760, 700, 0.4);
    if (Y.question) { o += H.arrow(U, th.good, 1450, 390, 1450, 640, 0.55, 5) + U.T(1470, 520, p.yesLabel || 'Yes', { a: 'start', s: 28, w: 700, f: th.good }) + node(Y.yes || { text: '' }, 1450, 700, 0.6) + (Y.no ? H.arrow(U, th.bad, 1660, 300, 1760, 300, 0.68, 5) + U.T(1700, 280, p.noLabel || 'No', { s: 28, w: 700, f: th.bad }) + end(1680, 430, Y.no.text || '', th.bad, 0.72) : ''); }
    return o;
  },
});
register('data_table', {
  cat: CM, title: 'Table', desc: 'A table whose rows appear one by one, with a row or column highlighted if wanted.', use: 'Data, comparisons, results and overviews.',
  params: 'columns: [name], rows: [[cells]], highlightRow, highlightCol, title', example: { title: 'The vote in two countries', columns: ['', 'Norway', 'France'], rows: [['All men', '1898', '1848'], ['Women', '1913', '1944'], ['Constitution', '1814', '1791']], highlightRow: 1 },
  build(p, c) {
    const { U, th } = c, C = p.columns || [], R = p.rows || [], nc = Math.max(1, C.length), w = Math.min(420, 1500 / nc), x0 = 960 - (nc * w) / 2, rh = Math.min(100, 560 / (R.length + 1)), y0 = 280;
    let o = U.bg() + H.title(U, th, p.title, 220) + `<g${U.A('fade', 0.04, 0.05)} opacity="0"><rect x="${x0}" y="${y0}" width="${nc * w}" height="${rh}" rx="8" fill="${th.accent}"/>${C.map((t, j) => U.T(x0 + j * w + w / 2, y0 + rh / 2 + 12, t, { s: 32, w: 700, f: th.bg })).join('')}</g>`;
    R.forEach((r, i) => { const y = y0 + (i + 1) * rh, hl = i === p.highlightRow, at = 0.12 + i * 0.1; o += `<g${U.A('left', at, 0.06)}><rect x="${x0}" y="${y}" width="${nc * w}" height="${rh}" fill="${hl ? th.accent2 : i % 2 ? th.surface : th.bg}" fill-opacity="${hl ? 0.3 : 1}" stroke="${th.line}" stroke-width="1"/>${r.map((t, j) => U.T(x0 + j * w + w / 2, y + rh / 2 + 12, t, { s: 32, w: j === 0 || j === p.highlightCol ? 700 : 400, f: j === p.highlightCol ? th.accent : th.ink })).join('')}</g>`; });
    return o;
  },
});
register('word_cloud', {
  cat: CL, title: 'Word cloud', desc: 'Words sized by how important or common they are, popping up one by one.', use: 'The themes of a text, brainstorming and summing up.',
  params: 'words: [{text, weight (1–10)}]', example: { words: [{ text: 'democracy', weight: 10 }, { text: 'vote', weight: 8 }, { text: 'constitution', weight: 7 }, { text: 'liberty', weight: 6 }, { text: 'equality', weight: 6 }, { text: 'people', weight: 5 }, { text: 'power', weight: 5 }, { text: 'revolution', weight: 4 }, { text: 'reform', weight: 4 }, { text: 'election', weight: 3 }, { text: 'rights', weight: 3 }, { text: 'parliament', weight: 2 }] },
  build(p, c) {
    const { U, th } = c, W = (p.words || []).slice().sort((a, b) => b.weight - a.weight).slice(0, 30), cols = th.series, placed = [];
    let o = U.bg();
    W.forEach((w, k) => {
      const s = 30 + (w.weight || 1) * 10, ww = U.tw(w.text, s, { fam: 'd', w: 700 }), hh = s;
      for (let t = 0; t < 600; t++) {
        const a = t * 0.35, r = 6 * t * 0.35, x = 960 + r * Math.cos(a) * 1.6, y = 560 + r * Math.sin(a), bx = [x - ww / 2, y - hh * 0.8, x + ww / 2, y + hh * 0.2];
        if (bx[0] < 140 || bx[2] > 1780 || bx[1] < 150 || bx[3] > 930) continue;
        if (placed.every((b) => bx[2] < b[0] || bx[0] > b[2] || bx[3] < b[1] || bx[1] > b[3])) { placed.push(bx); o += U.T(x.toFixed(0), y.toFixed(0), w.text, { fam: 'd', s, w: 700, f: cols[k % cols.length], an: U.A('pop', 0.05 + k * 0.03, 0.05, { cx: x.toFixed(0), cy: (y - s * 0.3).toFixed(0) }) }); break; }
      }
    });
    return o;
  },
});
register('sentence_analysis', {
  cat: CL, title: 'Sentence analysis', desc: 'The words of a sentence are marked with their role in the sentence, each in its own color.', use: 'Grammar: subject, verb, object and adverbial.',
  params: 'words: [{text, role}] (role: subject|verb|object|indirect object|adverbial|complement)', example: { words: [{ text: 'Anna', role: 'subject' }, { text: 'gave', role: 'verb' }, { text: 'Tom', role: 'indirect object' }, { text: 'a book', role: 'object' }, { text: 'yesterday', role: 'adverbial' }] },
  build(p, c) {
    const { U, th } = c, W = p.words || [], col = { subject: th.series[0], verb: th.series[2], object: th.series[1], 'indirect object': th.series[3], adverbial: th.series[5], complement: th.series[4] }, s = Math.min(76, (1700 - 40 * (W.length - 1)) / Math.max(0.01, W.reduce((a, w) => a + U.tw(w.text, 1, { fam: 'd', w: 700 }), 0))), sp = 40, wid = (t) => U.tw(t, s, { fam: 'd', w: 700 });
    const tot = W.reduce((a, w) => a + wid(w.text), 0) + sp * (W.length - 1); let x = 960 - tot / 2, o = U.bg();
    W.forEach((w, k) => { const ww = wid(w.text), cx = x + ww / 2, cl = col[w.role] || th.ink, at = 0.15 + k * 0.12; o += U.T(cx, 520, w.text, { fam: 'd', s, w: 700, an: U.A('fade', 0.03, 0.06) }) + `<rect x="${x}" y="550" width="${ww}" height="12" rx="6" fill="${cl}"${U.A('grow', at, 0.06, { ax: 'x', cx: x, cy: 556 })}/>` + U.T(cx, 620, w.role, { s: 28, w: 700, f: cl, an: U.A('up', at + 0.04, 0.05) }); x += ww + sp; });
    return o;
  },
});
register('letter_handwritten', {
  cat: CL, title: 'Letter', desc: 'A letter on paper whose text is written out line by line.', use: 'Historical letters, sources and diaries.',
  params: 'date, greeting, lines: [text], sign', example: { date: 'Eidsvoll, 20 May 1814', greeting: 'Dear brother,', lines: ['Today the work on the constitution is done.', 'Many of us think it will be long remembered.', 'I will come home as soon as I can.'], sign: 'Yours, Ole' },
  build(p, c) {
    const { U, th } = c, L = [p.greeting || '', ...(p.lines || []), '', p.sign || ''].slice(0, 9), step = 0.75 / L.length, f = th.fontDisplay;
    return U.bg() + `<g${U.A('up', 0.02, 0.06)} transform="rotate(1 960 540)"><rect x="520" y="170" width="880" height="760" rx="6" fill="${th.paper}" stroke="${th.line}"/>` + Array.from({ length: 12 }, (_, k) => `<path d="M570 ${330 + k * 52}H1350" stroke="${th.muted}" stroke-opacity=".35" stroke-width="2"/>`).join('') + `<text x="1340" y="250" text-anchor="end" font-family="${f}" font-style="italic" font-size="30" fill="${th.paperInk}">${U.esc(p.date || '')}</text>` +
      L.map((l, k) => `<text x="${k === L.length - 1 ? 1300 : 580}" y="${322 + k * 52}" text-anchor="${k === L.length - 1 ? 'end' : 'start'}" font-family="${f}" font-style="italic" font-size="34" fill="${th.paperInk}"${U.A('type', 0.05 + k * step, step * 0.9, { txt: l })}></text>`).join('') + '</g>';
  },
});
