// Templates for comparisons, people, fact checks and free illustration: Trym's code from his film engine
// (templates/resten.js, without its map templates), adapted for Meko with English text and the Night atlas theme.
// See ../engine.js for how templates work.
import { register, preset } from "../engine.js";

const mark = (U, th, v, x, y) => v === 'yes' ? U.icon('check', x, y, 54, th.good) : v === 'no' ? U.icon('cross', x, y, 46, th.bad) : v === 'partly' ? `<circle cx="${x}" cy="${y}" r="22" fill="none" stroke="${th.warn}" stroke-width="7"/><path d="M${x} ${y - 22}A22 22 0 0 1 ${x} ${y + 22}Z" fill="${th.warn}"/>` : U.T(x, y + 12, v, { s: 32, w: 600 });
register('versus', {
  cat: 'Comparison', title: 'A versus B', desc: 'Two halves that slide in, with a VS badge in the middle and points on each side.', use: 'Two countries, ideas, methods or people against each other.',
  params: 'left: {title, sub, icon, points}, right: {...}, vs', example: { left: { title: 'Revolution', sub: 'France 1789', icon: 'flame', points: ['Fast', 'Violent', 'Big leaps'] }, right: { title: 'Reform', sub: 'Norway 1814–1913', icon: 'scroll', points: ['Gradual', 'Peaceful', 'Lasting'] }, vs: 'VS' },
  build(p, c) {
    const { U, th } = c, side = (s, x0, col, at, anim) => `<g${U.A(anim, at, 0.08)}><rect x="${x0 ? x0 : -2000}" y="-2000" width="2960" height="5080" fill="${col}" fill-opacity=".07" data-fm-bg="1"/>${s.icon ? U.icon(s.icon, x0 + 480, 300, 140, col) : ''}` +
      U.T(x0 + 480, 470, s.title || '', { fam: 'd', s: 76, w: 700, f: col }) + (s.sub ? U.T(x0 + 480, 520, s.sub, { s: 30, f: th.muted }) : '') + '</g>' +
      (s.points || []).slice(0, 4).map((t, k) => U.T(x0 + 480, 620 + k * 62, t, { s: 38, w: 600, an: U.A('up', at + 0.15 + k * 0.07, 0.06) })).join('');
    return U.bg() + side(p.left || {}, 0, th.accent, 0.04, 'left') + side(p.right || {}, 960, th.accent2, 0.1, 'up') +
      (p.vs ? `<g${U.A('stamp', 0.22, 0.05, { cx: 960, cy: 470 })}><circle cx="960" cy="470" r="70" fill="${th.ink}"/>${U.T(960, 488, p.vs, { fam: 'd', s: 50, w: 800, f: th.bg })}</g>` : `<path d="M960 -2000V3080" stroke="${th.line}" stroke-width="3" data-fm-bg="1"/>`);
  },
});
preset('split_screen', 'versus', { title: 'Split screen', desc: 'Two halves side by side, without a VS badge.', use: 'Two situations shown side by side at the same time.', defaults: { vs: '' },
  example: { left: { title: 'France', sub: '1792', icon: 'people', points: ['All men can vote'] }, right: { title: 'Norway', sub: '1814', icon: 'person', points: ['Some men can vote'] } } });
register('scoreboard', {
  cat: 'Comparison', title: 'Scoreboard', desc: 'A table where two columns fill in criterion by criterion with checks, crosses or text.', use: 'Weighing two things on several criteria, like fast, many and lasting.',
  params: 'left, right, criteria: [{label, left, right}] (yes|no|partly|text), verdict', example: { left: 'France', right: 'Norway', criteria: [{ label: 'Fast', left: 'yes', right: 'no' }, { label: 'Many could vote', left: 'yes', right: 'partly' }, { label: 'Lasted', left: 'no', right: 'yes' }], verdict: 'Norway gave the most lasting say' },
  build(p, c) {
    const { U, th } = c, C = (p.criteria || []).slice(0, 6), rh = Math.min(110, 520 / Math.max(1, C.length)), step = 0.6 / Math.max(1, C.length);
    let out = U.bg() + U.card(300, 200, 1320, 120 + C.length * rh, { an: U.A('fade', 0.02, 0.06) }) + U.T(1100, 280, p.left || '', { fam: 'd', s: 48, w: 700, f: th.accent }) + U.T(1420, 280, p.right || '', { fam: 'd', s: 48, w: 700, f: th.accent2 });
    C.forEach((r, k) => { const y = 320 + k * rh + rh / 2, at = 0.1 + k * step; out += `<g${U.A('left', at, 0.06)}><path d="M340 ${y - rh / 2}H1580" stroke="${th.line}" stroke-width="2"/>${U.T(370, y + 12, r.label, { a: 'start', s: 38 })}${mark(U, th, r.left, 1100, y)}${mark(U, th, r.right, 1420, y)}</g>`; });
    return out + (p.verdict ? U.T(960, 360 + C.length * rh + 90, p.verdict, { fam: 'd', s: 48, w: 700, f: th.accent, an: U.A('up', 0.8, 0.08) }) : '');
  },
});
register('scale_balance', {
  cat: 'Comparison', title: 'Scale', desc: 'A balance scale that tips toward the heavier side.', use: 'What weighs most: arguments, costs, forces.',
  params: 'left: {label, value}, right: {label, value}, at', example: { left: { label: 'Rights on paper', value: 3 }, right: { label: 'Rights that lasted', value: 5 } },
  ownCamera: false,
  build(p, c) {
    const { U, th } = c, id = c.id, pan = (k, s) => `<g id="${id}p${k}"><path d="M-130 0H130L100 60H-100Z" fill="${k ? th.accent2 : th.accent}"/><path d="M-120 0L0 -160L120 0" stroke="${th.muted}" stroke-width="3" fill="none"/>${U.T(0, 110, s.label || '', { s: 32, w: 600 })}</g>`;
    return U.bg() + `<path d="M960 380L900 860H1020Z" fill="${th.line}"/><rect x="820" y="850" width="280" height="30" rx="8" fill="${th.line}"/>` + `<g id="${id}beam"><rect x="520" y="370" width="880" height="20" rx="10" fill="${th.ink}"/></g><circle cx="960" cy="380" r="22" fill="${th.ink}"/>` + pan(0, p.left || {}) + pan(1, p.right || {});
  },
  init(g, p, c) { return { beam: g.querySelector('#' + c.id + 'beam'), p0: g.querySelector('#' + c.id + 'p0'), p1: g.querySelector('#' + c.id + 'p1') }; },
  render(l, st, p, c) {
    const { U } = c, L = (p.left || {}).value || 1, R = (p.right || {}).value || 1, ang = U.clamp(((R - L) / (L + R)) * 40, -16, 16) * U.ease.io(U.prog(l.p, p.at ?? 0.25, (p.at ?? 0.25) + 0.3)), a = (ang * Math.PI) / 180;
    st.beam.setAttribute('transform', `rotate(${ang.toFixed(2)} 960 380)`);
    st.p0.setAttribute('transform', `translate(${(960 - 420 * Math.cos(a)).toFixed(1)} ${(380 - 420 * Math.sin(a) + 170).toFixed(1)})`);
    st.p1.setAttribute('transform', `translate(${(960 + 420 * Math.cos(a)).toFixed(1)} ${(380 + 420 * Math.sin(a) + 170).toFixed(1)})`);
  },
});
register('before_after', {
  cat: 'Comparison', title: 'Before and after', desc: 'The before side shows first, then the after side is revealed from the middle.', use: 'Change: before and after a reform, a war or an invention.',
  params: 'before: {label, title, text, icon}, after: {...}, at', example: { before: { label: 'Before 1789', title: 'Absolute rule', text: 'The king holds all power', icon: 'crown' }, after: { label: 'After 1789', title: 'Popular sovereignty', text: 'Power should come from the people', icon: 'people' } },
  build(p, c) {
    const { U, th } = c, id = c.id, half = (s, x0, col) => `<rect x="${x0 ? x0 : -2000}" y="-2000" width="2960" height="5080" fill="${col}" fill-opacity=".07" data-fm-bg="1"/>${U.T(x0 + 480, 260, U.lab(s.label || ''), { s: 32, w: 600, f: col, ls: th.upper ? 6 : 0 })}${s.icon ? U.icon(s.icon, x0 + 480, 420, 170, col) : ''}${U.T(x0 + 480, 620, s.title || '', { fam: 'd', s: 70, w: 700 })}${U.wrap(s.text || '', 30).slice(0, 2).map((t, k) => U.T(x0 + 480, 690 + k * 46, t, { s: 36, f: th.muted })).join('')}`;
    return U.bg() + `<g${U.A('fade', 0.02, 0.08)}>${half(p.before || {}, 0, th.muted)}</g><defs><clipPath id="${id}clip"><rect x="960" y="-2000" width="0" height="5080"${U.A('wipe', p.at ?? 0.35, 0.25, { w: 2960 })}/></clipPath></defs>` +
      `<g clip-path="url(#${id}clip)">${U.bg(th.bg)}${half(p.after || {}, 960, th.accent)}</g><path d="M960 -2000V3080" stroke="${th.line}" stroke-width="3" data-fm-bg="1"/>`;
  },
});
// Everyone gets the same plain figure, head and shoulders without hair: Meko draws people by the role they play,
// never by their looks, so the hairstyle the original picked with `icon` is left out.
const HEAD = '<path d="M-32 -28Q-38 -80 0 -86Q38 -80 32 -28Q28 2 0 10Q-28 2 -32 -28Z"/>';
const PERSON = '<path d="M-70 104Q-66 42 0 34Q66 42 70 104Z"/>' + HEAD;
const bust = (th, x, y, icon, sc = 1) => `<g transform="translate(${x} ${y}) scale(${sc})"><ellipse rx="104" ry="128" fill="${th.accent}"/><ellipse rx="92" ry="116" fill="${th.paper}"/><g fill="${th.paperInk}" transform="translate(0 6) scale(.9)">${PERSON}</g></g>`;
register('people_ideas', {
  cat: 'People', title: 'People and ideas', desc: 'Two to four portraits appear as they are named, and a line joins each person to a tile of text.', use: 'Thinkers and ideas, people and roles, sources and what they say.',
  params: 'title, people: [{name, years, keyword, at}], tiles: [{heading, lines, at}]',
  example: { title: 'The Enlightenment', people: [{ name: 'John Locke', years: '1632–1704', keyword: 'Social contract', icon: 'longhair', at: 0.06 }, { name: 'Montesquieu', years: '1689–1755', keyword: 'Separation of powers', icon: 'profile', at: 0.2 }, { name: 'Rousseau', years: '1712–1778', keyword: 'Popular sovereignty', icon: 'wig', at: 0.34 }], tiles: [{ heading: 'The idea', lines: ['Power rests on', 'a social contract'], at: 0.5 }, { heading: 'The idea', lines: ['Power is split', 'in three'], at: 0.6 }, { heading: 'The idea', lines: ['Power comes', 'from the people'], at: 0.7 }] },
  build(p, c) {
    const { U, th } = c, P = (p.people || []).slice(0, 4), N = Math.max(1, P.length), X = (k) => 200 + (1520 / N) * (k + 0.5), tw = Math.min(360, 1520 / N - 30);
    let out = U.bg() + U.T(960, 190, U.lab(p.title || ''), { fam: 'd', s: 46, w: 700, f: th.accent, ls: th.upper ? 8 : 0, an: U.A('fade', 0, 0.06) });
    P.forEach((pp, k) => {
      const x = X(k), a = pp.at ?? 0.08 + k * 0.18, t = (p.tiles || [])[k];
      out += `<g${U.A('pop', a, 0.05, { cx: x, cy: 420 })}>${bust(th, x, 350, pp.icon)}${U.T(x, 528, pp.name, { fam: 'd', s: N >= 4 ? 26 : 30, w: 700 })}${U.T(x, 558, pp.years || '', { s: 18, f: th.muted })}${U.T(x, 600, U.lab(pp.keyword || ''), { s: 24, w: 700, f: th.accent })}</g>`;
      if (t) { const ta = t.at ?? a + 0.12; out += `<path d="M${x} 618L${x} 664" stroke="${th.accent}" stroke-width="5" stroke-linecap="round" stroke-dasharray="46" stroke-dashoffset="46"${U.A('draw', ta - 0.04, 0.04, { l: 46 })}/><g opacity="0"${U.A('fade', ta, 0.05)}>${U.card(x - tw / 2, 672, tw, 180, { f: th.paper })}${U.T(x, 718, U.lab(t.heading || ''), { s: 22, w: 700, f: th.accent })}${(t.lines || []).slice(0, 2).map((L, i) => U.T(x, 764 + i * 34, L, { fam: 'd', s: 26, it: true, f: th.paperInk })).join('')}</g>`; }
    });
    return out;
  },
});
register('people_lineup', {
  cat: 'People', title: 'People lineup', desc: 'Figures standing for groups. The figures light up in the group color when something applies to them.', use: 'Who gets the vote, rights or anything else, group by group.',
  params: 'title, groups: [{label, count, icon, color}], states: [{group, at, label}]', example: { title: 'Who could vote in 1792?', groups: [{ label: 'Men', count: 5, icon: 'person' }, { label: 'Women', count: 5, icon: 'woman' }], states: [{ group: 0, at: 0.35, label: 'All men' }] },
  build(p, c) {
    const { U, th } = c, G = p.groups || [], tot = G.reduce((s, g) => s + Math.min(g.count || 1, 8), 0) + (G.length - 1), cw = Math.min(150, 1600 / Math.max(1, tot)), x0 = 960 - (tot * cw) / 2 + cw / 2, cols = th.series;
    let out = U.bg() + (p.title ? U.T(960, 220, p.title, { fam: 'd', s: 60, w: 700, an: U.A('fade', 0.02, 0.06) }) : ''), i = 0;
    G.forEach((g, gk) => {
      const st = (p.states || []).find((s) => s.group === gk), col = g.color || cols[gk % cols.length], gx0 = x0 + i * cw;
      for (let k = 0; k < Math.min(g.count || 1, 8); k++, i++) {
        const x = x0 + i * cw, at = 0.06 + (i / tot) * 0.2;
        out += `<g${U.A('up', at, 0.06)}>${U.icon(g.icon || 'person', x, 560, cw * 0.9, th.line)}${st ? `<g opacity="0"${U.A('fade', st.at + k * 0.02, 0.05)}>${U.icon(g.icon || 'person', x, 560, cw * 0.9, col)}</g>` : ''}</g>`;
      }
      const gx = (gx0 + x0 + (i - 1) * cw) / 2;
      out += U.T(gx, 700, U.lab(g.label || ''), { s: 32, w: 700, ls: th.upper ? 5 : 0, an: U.A('fade', 0.25, 0.06) }) + (st && st.label ? U.T(gx, 410, st.label, { s: 34, w: 700, f: col, an: U.A('up', st.at, 0.06) }) : '');
      i++;
    });
    return out;
  },
});
register('profile_card', {
  cat: 'People', title: 'Profile card', desc: 'A card about one person with a portrait, years, role and key facts.', use: 'Introducing a person who matters in the story.',
  params: 'name, years, role, facts', example: { name: 'Olympe de Gouges', years: '1748–1793', role: 'Writer and champion of women’s rights', facts: ['Wrote the Declaration of the Rights of Woman in 1791', 'Was executed in 1793'], icon: 'bun' },
  build(p, c) {
    const { U, th } = c;
    return U.bg() + `<g${U.A('pop', 0.04, 0.06, { cx: 560, cy: 480 })}>${bust(th, 560, 450, p.icon, 1.35)}</g>` + U.T(560, 690, p.name || '', { fam: 'd', s: 54, w: 700, an: U.A('up', 0.12, 0.08) }) + U.T(560, 740, p.years || '', { s: 30, f: th.muted, an: U.A('up', 0.16, 0.08) }) +
      U.wrap(p.role || '', 36).slice(0, 2).map((l, k) => U.T(1000, 330 + k * 50, l, { a: 'start', fam: 'd', s: 44, w: 700, f: th.accent, an: U.A('left', 0.2, 0.08) })).join('') +
      (p.facts || []).slice(0, 4).map((f, k) => `<g${U.A('left', 0.32 + k * 0.1, 0.07)}><circle cx="1012" cy="${470 + k * 90}" r="10" fill="${th.accent}"/>${U.wrap(f, 34).slice(0, 2).map((l, i) => U.T(1040, 482 + k * 90 + i * 40, l, { a: 'start', s: 34 })).join('')}</g>`).join('');
  },
});
register('verdict_stamp', {
  cat: 'Fact check', title: 'Verdict stamp', desc: 'The claim is written on a sheet, the sentence is highlighted, and the verdict lands as a stamp.', use: 'Fact-checking a claim or a myth.',
  params: 'title, claim, note, stamp, tone: true|partly|false, highlightAt, at', example: { title: 'Claim', claim: 'The Bastille was full of political prisoners when it was stormed in 1789.', stamp: 'False', tone: 'false', note: 'It held only seven prisoners, and the crowd was after weapons.' },
  build(p, c) {
    const { U, th } = c, col = p.stampColor || { true: th.good, partly: th.warn, false: th.bad }[p.tone] || th.bad, L = U.wrap(p.claim || '', 34).slice(0, 4), lh = 64, y0 = 470 - ((L.length - 1) * lh) / 2;
    const txt = U.lab(p.stamp || 'True'), sw = Math.max(320, U.tw(txt, 92, { fam: 'd', w: 800 }) + txt.length * 6 + 100);
    return U.bg() + `<g transform="rotate(-1.2 960 540)">${U.card(420, 210, 1080, 660, { f: th.paper })}${U.T(960, 290, U.lab(p.title || 'Claim'), { s: 26, w: 700, f: th.muted, ls: th.upper ? 8 : 1 })}` +
      L.map((l, k) => { const w = U.tw(l, 48, { fam: 'd', it: true }) + 16, x0 = 960 - w / 2; return `<rect x="${x0}" y="${y0 + k * lh - 36}" width="${w}" height="46" fill="${th.accent}" opacity=".45"${U.A('hl', (p.highlightAt ?? 0.12) + k * 0.07, 0.12, { x0 })}/>` + U.T(960, y0 + k * lh, l, { fam: 'd', s: 48, it: true, f: th.paperInk }); }).join('') +
      U.wrap(p.note || '', 64).slice(0, 2).map((l, k) => U.T(960, 790 + k * 36, l, { s: 28, f: th.muted })).join('') + '</g>' +
      `<g${U.A('stamp', p.at ?? 0.6, 0.05, { cx: 1290, cy: 662 })}><g transform="rotate(-8 1290 662)"><rect x="${1290 - sw / 2}" y="592" width="${sw}" height="140" rx="10" fill="none" stroke="${col}" stroke-width="12"/>${U.T(1290, 694, txt, { fam: 'd', s: 92, w: 800, f: col, ls: 6 })}</g></g>`;
  },
});
register('claim_vs_fact', {
  cat: 'Fact check', title: 'Claim versus fact', desc: 'The claim on the left, the fact on the right and a verdict in the middle.', use: 'Correcting a claim with a short explanation.',
  params: 'claim, fact, verdict, tone: true|partly|false, claimLabel, factLabel', example: { claim: 'Everyone in France got the vote in 1789.', fact: 'In 1791 only men who paid enough tax could vote.', verdict: 'False', tone: 'false' },
  build(p, c) {
    const { U, th } = c, col = { true: th.good, partly: th.warn, false: th.bad }[p.tone] || th.bad, box = (x, label, text, color, at) => `<g${U.A('up', at, 0.08)}>${U.card(x, 300, 640, 440)}${U.T(x + 320, 380, U.lab(label), { s: 30, w: 700, f: color, ls: th.upper ? 6 : 0 })}${U.wrap(text, 26).slice(0, 5).map((l, k) => U.T(x + 320, 470 + k * 54, l, { fam: 'd', s: 42, w: 600 })).join('')}</g>`;
    return U.bg() + box(220, p.claimLabel || 'Claim', p.claim || '', th.muted, 0.04) + box(1060, p.factLabel || 'Fact', p.fact || '', th.good, 0.3) +
      `<g${U.A('stamp', 0.55, 0.05, { cx: 960, cy: 820 })}><g transform="rotate(-6 960 820)"><rect x="780" y="760" width="360" height="120" rx="10" fill="${th.bg}" stroke="${col}" stroke-width="10"/>${U.T(960, 845, U.lab(p.verdict || ''), { fam: 'd', s: 74, w: 800, f: col })}</g></g>`;
  },
});
register('source_highlight', {
  cat: 'Fact check', title: 'Source highlight', desc: 'An excerpt from a source is shown, and the words that back the claim are highlighted.', use: 'Showing where a piece of information comes from.',
  params: 'source, excerpt, highlight (words found in the excerpt), at', example: { source: 'Example source', excerpt: 'The Bastille was a prison where people could be locked up without a trial. When it was stormed in 1789, it held only seven prisoners.', highlight: 'only seven prisoners', at: 0.35 },
  build(p, c) {
    const { U, th } = c, L = U.wrap(p.excerpt || '', 46).slice(0, 7), s = 40, y0 = 380, lh = 58, hl = String(p.highlight || '').toLowerCase();
    let out = U.bg() + U.card(300, 220, 1320, Math.max(300, 200 + L.length * lh), { f: th.paper, an: U.A('fade', 0.02, 0.06) }) + `<rect x="340" y="250" width="110" height="40" rx="6" fill="${th.accent}"/>` + U.T(395, 279, U.lab('Source'), { s: 22, w: 700, f: th.bg }) + U.T(475, 281, p.source || '', { a: 'start', s: 28, w: 600, f: th.paperInk });
    const full = L.join(' ').toLowerCase(), start = hl ? full.indexOf(hl) : -1; let pos = 0;
    L.forEach((l, k) => {
      const lineStart = pos, lineEnd = pos + l.length, y = y0 + k * lh, x0 = 960 - U.tw(l, s, { fam: 'd' }) / 2;
      if (start >= 0) { const a = Math.max(start, lineStart), b = Math.min(start + hl.length, lineEnd); if (b > a) { const hx = x0 + U.tw(l.slice(0, a - lineStart), s, { fam: 'd' }); out += `<rect x="${hx.toFixed(1)}" y="${y - 38}" width="${U.tw(l.slice(a - lineStart, b - lineStart), s, { fam: 'd' }).toFixed(1)}" height="50" fill="${th.accent}" opacity=".5"${U.A('hl', p.at ?? 0.35, 0.12, { x0: hx.toFixed(1) })}/>`; } }
      out += U.T(960, y, l, { fam: 'd', s, f: th.paperInk, an: U.A('fade', 0.06 + k * 0.03, 0.06) });
      pos = lineEnd + 1;
    });
    return out;
  },
});
register('source_list', {
  cat: 'Fact check', title: 'Source list', desc: 'A list of sources that scrolls up, like credits.', use: 'Showing all the sources at the end of a video.',
  params: 'title, items', example: { title: 'Sources', items: ['Author, A. (2024). The right to vote. Example Encyclopedia.', 'Author, B. (2023). The Bastille. Example Encyclopedia.', 'Author, B. and Author, C. (2025). The French Revolution. Example Press.', 'Example Archive (n.d.). The constitution of 1814.'] },
  build(p, c) {
    const { U, th } = c, I = p.items || [];
    return U.bg() + `<defs><clipPath id="${c.id}win"><rect x="0" y="200" width="1920" height="740"/></clipPath></defs><g clip-path="url(#${c.id}win)"><g id="${c.id}roll">` + U.T(960, 300, U.lab(p.title || 'Sources'), { fam: 'd', s: 60, w: 700, f: th.accent, ls: th.upper ? 8 : 0 }) +
      I.map((t, k) => U.wrap(t, 70).slice(0, 2).map((l, i) => U.T(960, 400 + k * 110 + i * 38, l, { s: 30 })).join('')).join('') + '</g></g>';
  },
  init(g, p, c) { return { roll: g.querySelector('#' + c.id + 'roll'), h: 400 + (p.items || []).length * 110 }; },
  render(l, st) { const over = Math.max(0, st.h - 900); st.roll.setAttribute('transform', `translate(0 ${(-over * l.p).toFixed(1)})`); },
});
register('document_closeup', {
  cat: 'Fact check', title: 'Document', desc: 'A document with a heading, a date and lines of text, with an optional stamp.', use: 'Laws, treaties, reports and decisions.',
  params: 'heading, subheading, date, lines (number of text lines drawn), stamp, tone, at', example: { heading: 'The Constitution', subheading: 'Kingdom of Norway', date: '17 May 1814', lines: 8, stamp: 'Adopted', tone: 'true' },
  build(p, c) {
    const { U, th } = c, col = { true: th.good, partly: th.warn, false: th.bad }[p.tone] || th.bad, n = p.lines ?? 8;
    return U.bg() + `<g${U.A('up', 0.02, 0.1)} transform="rotate(1.2 960 540)">${U.card(600, 160, 720, 760, { f: th.paper })}${U.T(960, 280, p.heading || '', { fam: 'd', s: 64, w: 700, f: th.paperInk })}${p.subheading ? U.T(960, 330, p.subheading, { fam: 'd', s: 34, f: th.paperInk }) : ''}` +
      `<path d="M820 360H1100" stroke="${th.muted}" stroke-width="2"/>${p.date ? U.T(960, 400, '— ' + p.date + ' —', { s: 26, f: th.muted }) : ''}` + Array.from({ length: n }, (_, k) => `<rect x="${700 + (k % 2) * 20}" y="${450 + k * 46}" width="${520 - (k % 3) * 60}" height="10" rx="5" fill="${th.muted}" opacity=".45"/>`).join('') + '</g>' +
      (p.stamp ? `<g${U.A('stamp', p.at ?? 0.5, 0.05, { cx: 1180, cy: 760 })}><g transform="rotate(-9 1180 760)"><rect x="${1180 - (p.stamp.length * 30 + 80) / 2}" y="700" width="${p.stamp.length * 30 + 80}" height="120" rx="10" fill="none" stroke="${col}" stroke-width="10"/>${U.T(1180, 782, U.lab(p.stamp), { fam: 'd', s: 66, w: 800, f: col })}</g></g>` : '');
  },
});
register('icon_scene', {
  cat: 'Illustration', title: 'Icon scene', desc: 'A free scene where icons with labels pop up wherever they are placed. The icons are the ones in ICONS.', use: 'Illustrating almost anything quickly: a market, a factory, a cycle, a town.',
  params: 'title, items: [{icon, label, x, y, size, color, at}]', example: { title: 'From field to table', items: [{ icon: 'wheat', label: 'The farmer grows', x: 380, y: 520, at: 0.08 }, { icon: 'factory', label: 'The mill grinds', x: 760, y: 520, at: 0.24 }, { icon: 'cart', label: 'The shop sells', x: 1140, y: 520, at: 0.4 }, { icon: 'house', label: 'We eat', x: 1520, y: 520, at: 0.56 }] },
  build(p, c) {
    const { U, th } = c, cols = th.series;
    return U.bg() + (p.title ? U.T(960, 230, p.title, { fam: 'd', s: 60, w: 700, an: U.A('fade', 0.02, 0.06) }) : '') +
      (p.items || []).map((it, k) => `<g${U.A('pop', it.at ?? 0.08 + k * 0.12, 0.06, { cx: it.x, cy: it.y })}>${U.icon(it.icon || 'dot', it.x, it.y, it.size || 180, it.color || cols[k % cols.length])}${it.label ? U.T(it.x, it.y + (it.size || 180) / 2 + 56, it.label, { s: 34, w: 600 }) : ''}</g>`).join('');
  },
});
