/*
 * Film engine core for Meko's template scenes.
 *
 * This is Trym's own code from his film engine ("filmmotor", version 4), adapted for Meko. This copy keeps the part
 * that draws and animates one template: the helpers (makeU and H), the icons, the template registry (register,
 * preset and TPL) and the shared animations (prepAnims and runAnims). The templates are in ./templates.
 *
 * Left out: the film player (mount) with its black bars, vignette, grain, color grades, camera, transitions,
 * subtitles, year, chapter and source fields, play controls, audio and font loading, and the gallery. Meko's video
 * does all of that itself. The map templates are left out too, with the libraries and data they need: d3-array,
 * d3-geo and topojson-client (ISC license) and Natural Earth data (public domain). Meko has its own maps.
 *
 * Changed: the five themes are replaced by one Night atlas theme, which TemplateScene passes in (see theme.ts, built
 * from lib/theme.ts). Built-in text is in English, and numbers are written the English way. U.bg() draws nothing
 * unless it is given a color, since the scene behind a template already gives the dark ground. Added for Meko:
 * U.tw (text width measured on Meko's fonts), the halo text option, H.niceStep (round axis ticks), and counts that
 * keep their thousands separators all the way.
 *
 * How a template works: build(params, ctx) returns SVG markup for a 1920 x 1080 frame. Elements marked with data-an,
 * data-at and data-d (start and length as fractions of the shot) are animated by runAnims for a progress p from 0 to
 * 1. A template can also have init(root, params, ctx), which returns a state, and render(local, state, params, ctx,
 * root), which runs on every frame for motion that data-an cannot express. The same time always gives the same
 * picture, so a video can be rendered frame by frame.
 */

const W = 1920, H_FRAME = 1080;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const prog = (t, a, b) => (b <= a ? (t >= b ? 1 : 0) : clamp((t - a) / (b - a), 0, 1));
const lerp = (a, b, p) => a + (b - a) * p;
const ease = {
  io: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  out: (x) => 1 - Math.pow(1 - x, 3),
  back: (x) => { const c = 1.70158; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); },
};
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function wrap(text, max) {
  const out = []; let line = '';
  for (const w of String(text || '').split(/\s+/)) {
    if (!w) continue;
    if ((line + ' ' + w).trim().length > max && line) { out.push(line); line = w; } else line = (line + ' ' + w).trim();
  }
  if (line) out.push(line);
  return out;
}
// Numbers the English way, with the same rule as remotion/format.ts: thousands separators from 10,000 up, so years
// like 1789 read right. sep 'none' never groups (years), and sep 'always' groups from 1,000 (amounts in a chart that
// also has numbers of 10,000 or more). A number that rounds to zero shows as 0, never -0.
const fmtNum = (v, dec, sep) => {
  const d = dec || 0, n = Math.abs(Number(v)) < 0.5 / Math.pow(10, d) ? 0 : Number(v);
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: sep === 'always' || (sep !== 'none' && Math.abs(n) >= 10000) });
};

// Character widths in em at weight 700, measured in the browser on Meko's fonts: Fraunces (d) and Archivo (t), for
// GLYPH_CHARS in order. Added for Meko, so templates that place words, strike lines or highlights by text width fit
// these fonts. Characters not listed count as 0.6.
const GLYPH_CHARS = ' !\"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~·×−→≈±²³₀₁₂₃₄₅₆₇₈₉°–—‘’“”…λθπ√ρΩΔµé';
const GLYPH = {
  d: [
    0.16, 0.28, 0.35, 0.60, 0.55, 0.63, 0.93, 0.18, 0.33, 0.32, 0.56, 0.46, 0.24, 0.25, 0.23, 0.33, 0.64, 0.40,
    0.59, 0.54, 0.60, 0.55, 0.59, 0.51, 0.57, 0.60, 0.23, 0.24, 0.44, 0.46, 0.44, 0.55, 0.76, 0.65, 0.68, 0.65,
    0.74, 0.62, 0.56, 0.70, 0.78, 0.37, 0.43, 0.73, 0.58, 0.84, 0.68, 0.74, 0.66, 0.76, 0.70, 0.58, 0.65, 0.68,
    0.63, 0.96, 0.67, 0.63, 0.59, 0.34, 0.33, 0.34, 0.31, 0.38, 0.26, 0.48, 0.53, 0.44, 0.53, 0.46, 0.30, 0.52,
    0.55, 0.26, 0.26, 0.54, 0.28, 0.83, 0.55, 0.52, 0.54, 0.53, 0.42, 0.41, 0.33, 0.55, 0.46, 0.72, 0.48, 0.48,
    0.44, 0.38, 0.23, 0.38, 0.49, 0.28, 0.41, 0.46, 1.16, 0.63, 0.46, 0.34, 0.30, 0.55, 0.55, 0.55, 0.55, 0.55,
    0.55, 0.55, 0.55, 0.55, 0.55, 0.33, 0.47, 0.73, 0.21, 0.19, 0.40, 0.40, 0.77, 0.56, 0.55, 0.58, 0.63, 0.58,
    0.86, 0.74, 0.55, 0.46,
  ],
  t: [
    0.20, 0.30, 0.46, 0.60, 0.56, 0.97, 0.76, 0.25, 0.36, 0.36, 0.41, 0.64, 0.31, 0.33, 0.31, 0.30, 0.60, 0.60,
    0.60, 0.60, 0.60, 0.60, 0.60, 0.59, 0.60, 0.60, 0.34, 0.34, 0.64, 0.64, 0.64, 0.61, 1.00, 0.72, 0.72, 0.73,
    0.74, 0.68, 0.62, 0.80, 0.75, 0.30, 0.60, 0.73, 0.59, 0.87, 0.75, 0.79, 0.68, 0.79, 0.73, 0.68, 0.64, 0.75,
    0.69, 0.96, 0.71, 0.70, 0.65, 0.35, 0.30, 0.35, 0.64, 0.52, 0.23, 0.58, 0.61, 0.57, 0.61, 0.58, 0.31, 0.61,
    0.60, 0.27, 0.26, 0.57, 0.27, 0.89, 0.60, 0.61, 0.61, 0.61, 0.38, 0.56, 0.34, 0.60, 0.55, 0.80, 0.57, 0.55,
    0.52, 0.39, 0.25, 0.39, 0.64, 0.33, 0.64, 0.64, 0.99, 0.54, 0.64, 0.37, 0.37, 0.28, 0.28, 0.28, 0.28, 0.28,
    0.28, 0.28, 0.28, 0.28, 0.28, 0.40, 0.50, 1.00, 0.28, 0.28, 0.49, 0.49, 0.97, 0.49, 0.55, 0.68, 0.54, 0.56,
    0.74, 0.66, 0.61, 0.58,
  ],
};

/* Icons drawn on a 100 x 100 grid */
export const ICONS = {
  dot: '<circle cx="50" cy="50" r="30"/>',
  person: '<circle cx="50" cy="26" r="17"/><path d="M20 92Q20 50 50 48Q80 50 80 92Z"/>',
  woman: '<circle cx="50" cy="26" r="16"/><path d="M50 46Q30 46 26 70L18 92L82 92L74 70Q70 46 50 46Z"/>',
  people: '<circle cx="34" cy="30" r="14"/><circle cx="68" cy="30" r="14"/><path d="M8 88Q8 52 34 50Q52 51 56 66Q60 51 68 50Q92 52 92 88Z"/>',
  house: '<path d="M50 12L90 46L80 46L80 90L20 90L20 46L10 46Z"/>',
  factory: '<path d="M8 90L8 50L30 36L30 50L52 36L52 50L74 36L74 14L88 14L88 90Z"/>',
  tree: '<circle cx="50" cy="38" r="28"/><rect x="44" y="58" width="12" height="34"/>',
  leaf: '<path d="M20 82Q14 26 82 16Q86 76 30 80L20 92Z"/>',
  drop: '<path d="M50 8Q78 46 78 64A28 28 0 0 1 22 64Q22 46 50 8Z"/>',
  sun: '<circle cx="50" cy="50" r="20"/><path d="M50 6V22M50 78V94M6 50H22M78 50H94M18 18L30 30M70 70L82 82M18 82L30 70M70 30L82 18" stroke="currentColor" stroke-width="8" stroke-linecap="round"/>',
  cloud: '<path d="M26 78A18 18 0 0 1 26 42A24 24 0 0 1 72 36A20 20 0 0 1 76 78Z"/>',
  flame: '<path d="M50 6Q76 38 70 64A20 20 0 0 1 30 64Q24 46 40 30Q42 46 52 50Q48 30 50 6Z"/>',
  coin: '<circle cx="50" cy="50" r="38"/><circle cx="50" cy="50" r="26" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="6"/>',
  book: '<path d="M10 20Q30 12 50 22Q70 12 90 20L90 84Q70 76 50 86Q30 76 10 84Z"/>',
  scroll: '<path d="M22 14H78Q88 14 88 24V78Q88 88 78 88H24Q14 88 14 78V24Q14 14 22 14Z"/>',
  gavel: '<rect x="18" y="22" width="44" height="18" rx="4" transform="rotate(-35 40 31)"/><rect x="44" y="40" width="10" height="50" rx="4" transform="rotate(-35 49 65)"/><rect x="10" y="84" width="50" height="8" rx="3"/>',
  ballot: '<rect x="14" y="44" width="72" height="46" rx="6"/><rect x="36" y="10" width="28" height="38" rx="3" transform="rotate(8 50 29)"/>',
  flag: '<rect x="18" y="8" width="7" height="86"/><path d="M25 12H84L72 32L84 52H25Z"/>',
  globe: '<circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" stroke-width="7"/><path d="M10 50H90M50 10Q28 50 50 90M50 10Q72 50 50 90" fill="none" stroke="currentColor" stroke-width="6"/>',
  heart: '<path d="M50 88Q8 58 12 32A20 20 0 0 1 50 26A20 20 0 0 1 88 32Q92 58 50 88Z"/>',
  brain: '<path d="M30 20Q14 22 14 40Q6 52 16 64Q16 84 38 82Q44 92 50 86Q56 92 62 82Q84 84 84 64Q94 52 86 40Q86 22 70 20Q60 8 50 18Q40 8 30 20Z"/>',
  cell: '<ellipse cx="50" cy="50" rx="40" ry="32" fill="none" stroke="currentColor" stroke-width="7"/><circle cx="56" cy="48" r="13"/><circle cx="32" cy="58" r="5"/><circle cx="70" cy="66" r="4"/>',
  atom: '<circle cx="50" cy="50" r="9"/><ellipse cx="50" cy="50" rx="40" ry="15" fill="none" stroke="currentColor" stroke-width="5"/><ellipse cx="50" cy="50" rx="40" ry="15" fill="none" stroke="currentColor" stroke-width="5" transform="rotate(60 50 50)"/><ellipse cx="50" cy="50" rx="40" ry="15" fill="none" stroke="currentColor" stroke-width="5" transform="rotate(120 50 50)"/>',
  car: '<path d="M10 70L16 48Q20 38 32 38H66Q76 38 82 48L90 70V80H10Z"/><circle cx="28" cy="82" r="9"/><circle cx="72" cy="82" r="9"/>',
  phone: '<rect x="28" y="6" width="44" height="88" rx="8"/>',
  laptop: '<rect x="18" y="20" width="64" height="44" rx="4"/><path d="M6 72H94L88 82H12Z"/>',
  check: '<path d="M14 52L38 76L86 24" fill="none" stroke="currentColor" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>',
  cross: '<path d="M20 20L80 80M80 20L20 80" stroke="currentColor" stroke-width="13" stroke-linecap="round"/>',
  question: '<path d="M32 34Q32 12 52 12Q72 12 72 32Q72 46 54 52V64" fill="none" stroke="currentColor" stroke-width="12" stroke-linecap="round"/><circle cx="54" cy="84" r="8"/>',
  warning: '<path d="M50 8L94 88H6Z"/><rect x="45" y="34" width="10" height="30" fill="#fff" fill-opacity=".85"/><circle cx="50" cy="74" r="6" fill="#fff" fill-opacity=".85"/>',
  clock: '<circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" stroke-width="8"/><path d="M50 24V50L68 62" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round"/>',
  calendar: '<rect x="12" y="18" width="76" height="70" rx="8"/><rect x="12" y="18" width="76" height="18" fill="#000" fill-opacity=".25"/><rect x="26" y="8" width="8" height="18" rx="3"/><rect x="66" y="8" width="8" height="18" rx="3"/>',
  pin: '<path d="M50 94Q18 56 18 36A32 32 0 0 1 82 36Q82 56 50 94Z"/><circle cx="50" cy="36" r="12" fill="#fff" fill-opacity=".85"/>',
  bulb: '<path d="M50 8A28 28 0 0 1 66 60V72H34V60A28 28 0 0 1 50 8Z"/><rect x="36" y="76" width="28" height="8" rx="3"/><rect x="40" y="88" width="20" height="6" rx="3"/>',
  gear: '<path d="M44 6H56L58 18L68 22L78 14L86 22L78 32L82 42L94 44V56L82 58L78 68L86 78L78 86L68 78L58 82L56 94H44L42 82L32 78L22 86L14 78L22 68L18 58L6 56V44L18 42L22 32L14 22L22 14L32 22L42 18Z"/><circle cx="50" cy="50" r="14" fill="#000" fill-opacity=".3"/>',
  lock: '<rect x="20" y="44" width="60" height="46" rx="8"/><path d="M32 46V32A18 18 0 0 1 68 32V46" fill="none" stroke="currentColor" stroke-width="10"/>',
  cart: '<path d="M6 16H22L32 64H82L90 30H28" fill="none" stroke="currentColor" stroke-width="8" stroke-linejoin="round"/><circle cx="38" cy="80" r="8"/><circle cx="76" cy="80" r="8"/>',
  ship: '<path d="M10 62H90L76 86H24Z"/><rect x="46" y="14" width="6" height="48"/><path d="M52 18L80 56H52Z"/>',
  crown: '<path d="M12 80L8 30L32 50L50 18L68 50L92 30L88 80Z"/>',
  wheat: '<rect x="47" y="30" width="6" height="64"/><ellipse cx="38" cy="40" rx="8" ry="14" transform="rotate(-30 38 40)"/><ellipse cx="62" cy="40" rx="8" ry="14" transform="rotate(30 62 40)"/><ellipse cx="38" cy="62" rx="8" ry="14" transform="rotate(-30 38 62)"/><ellipse cx="62" cy="62" rx="8" ry="14" transform="rotate(30 62 62)"/><ellipse cx="50" cy="20" rx="7" ry="13"/>',
  chart: '<rect x="12" y="56" width="16" height="34"/><rect x="42" y="34" width="16" height="56"/><rect x="72" y="12" width="16" height="78"/>',
  money: '<rect x="8" y="26" width="84" height="48" rx="6"/><circle cx="50" cy="50" r="13" fill="#000" fill-opacity=".25"/>',
  virus: '<circle cx="50" cy="50" r="24"/><path d="M50 8V26M50 74V92M8 50H26M74 50H92M20 20L33 33M67 67L80 80M20 80L33 67M67 33L80 20" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>',
  planet: '<circle cx="50" cy="50" r="26"/><ellipse cx="50" cy="52" rx="46" ry="12" fill="none" stroke="currentColor" stroke-width="6" transform="rotate(-18 50 52)"/>',
  battery: '<rect x="8" y="28" width="76" height="44" rx="8"/><rect x="86" y="40" width="8" height="20" rx="3"/>',
  layers: '<path d="M50 12L92 32L50 52L8 32Z"/><path d="M8 50L50 70L92 50" fill="none" stroke="currentColor" stroke-width="8" stroke-linejoin="round"/><path d="M8 68L50 88L92 68" fill="none" stroke="currentColor" stroke-width="8" stroke-linejoin="round"/>',
  star: '<path d="M50 6L62 38L96 38L68 58L78 92L50 72L22 92L32 58L4 38L38 38Z"/>',
};

// Fraunces draws wider letters at small sizes (optical sizing): its width at a size compared with the 100px it was
// measured at for GLYPH.
const OPSZ = [[20, 1.21], [50, 1.17], [70, 1.12], [80, 1.06], [90, 1.01], [100, 1], [140, 0.99]];
const opticalWidth = (size) => {
  for (let i = 1; i < OPSZ.length; i++) {
    const [a, fa] = OPSZ[i - 1], [b, fb] = OPSZ[i];
    if (size <= b) return fa + ((Math.max(size, a) - a) * (fb - fa)) / (b - a);
  }
  return 0.99;
};

export function makeU(th) {
  const lab = (s) => (th.upper ? String(s == null ? '' : s).toUpperCase() : String(s == null ? '' : s));
  const fam = (f) => (f === 'd' ? th.fontDisplay : th.fontText);
  const A = (an, at, d, ex) => ` data-an="${an}" data-at="${(+at || 0).toFixed(3)}" data-d="${(d == null ? 0.06 : +d).toFixed(3)}"` +
    (ex ? Object.entries(ex).map(([k, v]) => ` data-${k}="${esc(v)}"`).join('') : '');
  // o.halo (added for Meko) outlines the text in the ground color, so it stays readable where it crosses a line.
  const T = (x, y, s, o = {}) => `<text x="${x}" y="${y}" text-anchor="${o.a || 'middle'}" font-family="${fam(o.fam)}" font-size="${o.s || 32}" font-weight="${o.w || 400}" fill="${o.f || th.ink}"` +
    `${o.ls ? ` letter-spacing="${o.ls}"` : ''}${o.it ? ' font-style="italic"' : ''}${o.halo ? ` paint-order="stroke" stroke="${th.bg}" stroke-width="${o.halo}" stroke-linejoin="round"` : ''}${o.id ? ` id="${o.id}"` : ''}${o.an || ''}${o.op != null ? ` opacity="${o.op}"` : ''}${o.ex || ''}>${esc(s)}</text>`;
  // About how wide a text is in pixels at size `size`, with the same font options as T: fam 'd' for the display font,
  // w for the weight and it for italic. Added for Meko (see GLYPH).
  const tw = (s, size, o = {}) => {
    const widths = GLYPH[o.fam === 'd' ? 'd' : 't'], w = o.w || 400;
    let em = 0;
    for (const ch of String(s == null ? '' : s)) { const i = GLYPH_CHARS.indexOf(ch); em += i < 0 ? 0.6 : widths[i]; }
    // A look with other fonts says how much wider or narrower they run (widthScale, added for Meko's looks).
    const scale = o.fam === 'd' ? th.widthScale?.display ?? 1 : th.widthScale?.text ?? 1;
    return scale * em * size * (o.fam === 'd' ? opticalWidth(size) : 1) * (o.it && o.fam === 'd' ? 1.11 : w >= 700 ? 1 + (w - 700) * 0.0003 : w >= 600 ? 0.97 : w >= 500 ? 0.94 : 0.915);
  };
  // A look can draw its own icons (iconMarkup, added for Meko), so a template's icons match the rest of the video.
  const icon = (name, x, y, size, fill, ex = '') => `<g transform="translate(${(x - size / 2).toFixed(1)} ${(y - size / 2).toFixed(1)}) scale(${(size / 100).toFixed(4)})" fill="${fill}" color="${fill}"${ex}>${th.iconMarkup?.(name, fill, size) ?? (ICONS[name] || ICONS.dot)}</g>`;
  const popIcon = (name, x, y, size, fill, at, d) => `<g${A('pop', at, d, { cx: x, cy: y })}>${icon(name, x, y, size, fill)}</g>`;
  // The scene behind a template gives the dark ground, so a background is only drawn in another color. It reaches far
  // past the frame, so it still covers it when the template is scaled down, and it is marked so it is not measured as
  // content.
  const bg = (fill) => (fill ? `<rect x="-2000" y="-2000" width="5920" height="5080" fill="${fill}" data-fm-bg="1"/>` : '');
  // A look can give cards their own fill and edge (th.card, added for Meko); a card that sets its own keeps them.
  const card = (x, y, w, h, o = {}) => {
    const fill = o.f || th.card?.fill || th.surface;
    const edge = o.s ? ` stroke="${o.s}" stroke-width="${o.sw || 3}"` : th.card ? ` stroke="${th.card.stroke}" stroke-width="${th.card.width}"` : '';
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${o.r ?? th.radius}" fill="${fill}"${edge}${o.an || ''}/>`;
  };
  const cw = (size, f) => size * (f === 'd' ? 0.55 : 0.5);
  return { clamp, prog, lerp, ease, esc, wrap, fmtNum, W, H: H_FRAME, th, lab, fam, A, T, tw, icon, popIcon, bg, card, cw, ICONS };
}

/* Shared drawing helpers for the templates (FilmEngine.H in the original) */
export const H = {};
H.line = (U, x0, y0, x1, y1, col, w, at, d = 0.08, ex = '') => { const l = Math.hypot(x1 - x0, y1 - y0).toFixed(0); return `<path d="M${x0} ${y0}L${x1} ${y1}" stroke="${col}" stroke-width="${w}" stroke-linecap="round" fill="none" stroke-dasharray="${l}" stroke-dashoffset="${l}"${U.A('draw', at, d, { l })}${ex}/>`; };
H.arrow = (U, col, x0, y0, x1, y1, at, w = 5) => {
  const a = Math.atan2(y1 - y0, x1 - x0), hx = x1 - 18 * Math.cos(a), hy = y1 - 18 * Math.sin(a);
  return H.line(U, x0, y0, hx, hy, col, w, at, 0.07) + `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)}L${(hx - 11 * Math.sin(a)).toFixed(1)} ${(hy + 11 * Math.cos(a)).toFixed(1)}L${(hx + 11 * Math.sin(a)).toFixed(1)} ${(hy - 11 * Math.cos(a)).toFixed(1)}Z" fill="${col}" opacity="0"${U.A('fade', at + 0.06, 0.02)}/>`;
};
H.frac = (U, x, y, n, d, s, col, an = '') => { const w = Math.max(String(n).length, String(d).length) * s * 0.32 + s * 0.2; return `<g${an}>${U.T(x, y - s * 0.16, String(n), { fam: 'd', s, w: 700, f: col })}<path d="M${(x - w).toFixed(1)} ${y}H${(x + w).toFixed(1)}" stroke="${col}" stroke-width="${Math.max(3, s / 16).toFixed(1)}" stroke-linecap="round"/>${U.T(x, y + s * 0.86, String(d), { fam: 'd', s, w: 700, f: col })}</g>`; };
H.rng = (seed) => { let s = seed % 2147483647 || 7; return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646; };
H.fn = (f) => {
  if (typeof f === 'function') return f;
  if (Array.isArray(f)) return (x) => f.reduce((s, c, i) => s + c * Math.pow(x, i), 0);
  const t = f.type;
  if (t === 'sin') return (x) => (f.a ?? 1) * Math.sin((f.b ?? 1) * x + (f.c ?? 0)) + (f.d ?? 0);
  if (t === 'exp') return (x) => (f.a ?? 1) * Math.pow(f.base ?? Math.E, (f.b ?? 1) * x);
  if (t === 'log') return (x) => (x > 0 ? (f.a ?? 1) * Math.log(x) / Math.log(f.base ?? Math.E) + (f.b ?? 0) : NaN);
  if (t === 'sqrt') return (x) => (x >= 0 ? (f.a ?? 1) * Math.sqrt(x) : NaN);
  if (t === 'rational') return (x) => (f.a ?? 1) / (x - (f.h ?? 0)) + (f.k ?? 0);
  if (t === 'poly') return H.fn(f.coeffs || [0]);
  return (x) => (f.m ?? 1) * x + (f.b ?? 0);
};
H.polyLen = (P) => P.reduce((a, q, i) => (i ? a + Math.hypot(q[0] - P[i - 1][0], q[1] - P[i - 1][1]) : 0), 0);
/* A coordinate system: o = {L, R, T, B, xMin, xMax, yMin, yMax, xStep, yStep, grid, labels, xName, yName} */
H.plot = (U, th, o) => {
  const L = o.L ?? 360, R = o.R ?? 1560, T = o.T ?? 170, B = o.B ?? 910, X = (x) => L + ((R - L) * (x - o.xMin)) / (o.xMax - o.xMin), Y = (y) => B - ((B - T) * (y - o.yMin)) / (o.yMax - o.yMin);
  const xs = o.xStep ?? Math.max(1, Math.round((o.xMax - o.xMin) / 10)), ys = o.yStep ?? Math.max(1, Math.round((o.yMax - o.yMin) / 10));
  let s = '';
  if (o.grid !== false) { for (let x = Math.ceil(o.xMin / xs) * xs; x <= o.xMax + 1e-9; x += xs) s += `<path d="M${X(x).toFixed(1)} ${T}V${B}" stroke="${th.line}" stroke-width="1" opacity=".55"/>`; for (let y = Math.ceil(o.yMin / ys) * ys; y <= o.yMax + 1e-9; y += ys) s += `<path d="M${L} ${Y(y).toFixed(1)}H${R}" stroke="${th.line}" stroke-width="1" opacity=".55"/>`; }
  const ax = o.yMin <= 0 && o.yMax >= 0 ? Y(0) : B, ay = o.xMin <= 0 && o.xMax >= 0 ? X(0) : L;
  s += H.arrow(U, th.ink, L - 10, ax, R + 30, ax, 0.02, 3) + H.arrow(U, th.ink, ay, B + 10, ay, T - 30, 0.02, 3);
  if (o.labels !== false) {
    for (let x = Math.ceil(o.xMin / xs) * xs; x <= o.xMax + 1e-9; x += xs) if (Math.abs(x) > 1e-9) s += U.T(X(x).toFixed(1), ax + 30, U.fmtNum(x, xs < 1 ? 1 : 0), { s: 20, f: th.muted });
    for (let y = Math.ceil(o.yMin / ys) * ys; y <= o.yMax + 1e-9; y += ys) if (Math.abs(y) > 1e-9) s += U.T(ay - 12, Y(y) + 7, U.fmtNum(y, ys < 1 ? 1 : 0), { a: 'end', s: 20, f: th.muted });
  }
  s += U.T(R + 34, ax + 8, o.xName || 'x', { a: 'start', s: 28, it: true, f: th.ink }) + U.T(ay + 14, T - 30, o.yName || 'y', { a: 'start', s: 28, it: true, f: th.ink });
  return { s, X, Y, L, R, T, B };
};
H.curve = (U, f, P, o, col, at, d = 0.4, w = 6) => {
  const pts = [], F = H.fn(f); let path = '', len = 0, prev = null;
  for (let k = 0; k <= 240; k++) { const x = o.xMin + ((o.xMax - o.xMin) * k) / 240, y = F(x); if (!isFinite(y) || y < o.yMin - (o.yMax - o.yMin) || y > o.yMax + (o.yMax - o.yMin)) { prev = null; continue; } const q = [P.X(x), Math.max(P.T - 40, Math.min(P.B + 40, P.Y(y)))]; path += (prev ? 'L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1); if (prev) len += Math.hypot(q[0] - prev[0], q[1] - prev[1]); prev = q; pts.push(q); }
  return `<path d="${path}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" clip-path="url(#${o.clip || 'clipPlot'})" stroke-dasharray="${len.toFixed(0)}" stroke-dashoffset="${len.toFixed(0)}"${U.A('draw', at, d, { l: len.toFixed(0) })}/>`;
};
H.clip = (P, id = 'clipPlot') => `<defs><clipPath id="${id}"><rect x="${P.L}" y="${P.T - 40}" width="${P.R - P.L}" height="${P.B - P.T + 80}"/></clipPath></defs>`;
H.title = (U, th, t, y = 200) => (t ? U.T(960, y, t, { fam: 'd', s: 52, w: 700, an: U.A('fade', 0, 0.06) }) : '');
// A round step for axis ticks about `raw` apart: 1, 2, 2.5 or 5 times a power of ten. Added for Meko.
H.niceStep = (raw) => { const p = Math.pow(10, Math.floor(Math.log10(raw || 1))), n = (raw || 1) / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p; };

export const TPL = {};
export function register(name, tpl) { TPL[name] = Object.assign({ name }, tpl); }
// A preset is a base template with its own name, description, defaults and example.
export function preset(name, base, meta) {
  TPL[name] = Object.assign({}, TPL[base], meta, { name, base, defaults: Object.assign({}, TPL[base].defaults || {}, meta.defaults || {}) });
}

// Collects every element marked with data-an under `g`, with the numbers its animation needs.
export function prepAnims(g) {
  return Array.from(g.querySelectorAll('[data-an]')).map((e) => {
    const ds = e.dataset, n = (k, d) => (ds[k] == null ? d : +ds[k]);
    return { e, an: ds.an, at: n('at', 0), d: n('d', 0.06), cx: n('cx', 0), cy: n('cy', 0), base: e.getAttribute('transform') || '', l: n('l', 0), x0: n('x0', 0), y0: n('y0', 0), x1: n('x1', 0), y1: n('y1', 0),
      a0: n('a0', 0), a1: n('a1', 0), w: n('w', 0), to: n('to', 0), from: n('from', 0), dec: n('dec', 0), sep: ds.sep, pre: ds.pre || '', suf: ds.suf || '', txt: ds.txt || '', ax: ds.ax || 'y', r0: n('r0', 10), r1: n('r1', 40), last: null };
  });
}

// Sets every animated element to where it is at progress p (0 to 1 through the shot) and time t in seconds.
export function runAnims(list, p, t) {
  for (const a of list) {
    const q = prog(p, a.at, a.at + a.d), e = a.e;
    switch (a.an) {
      case 'fade': e.setAttribute('opacity', q.toFixed(3)); break;
      case 'dim': e.setAttribute('opacity', (1 - (1 - a.to) * q).toFixed(3)); break;
      case 'pop': { const s = Math.max(0, ease.back(q)); e.setAttribute('transform', `${a.base} translate(${a.cx} ${a.cy}) scale(${s.toFixed(3)}) translate(${-a.cx} ${-a.cy})`); e.setAttribute('opacity', q > 0 ? 1 : 0); break; }
      case 'up': { e.setAttribute('transform', `${a.base} translate(0 ${(36 * (1 - ease.out(q))).toFixed(1)})`); e.setAttribute('opacity', q.toFixed(3)); break; }
      case 'left': { e.setAttribute('transform', `${a.base} translate(${(-60 * (1 - ease.out(q))).toFixed(1)} 0)`); e.setAttribute('opacity', q.toFixed(3)); break; }
      case 'stamp': { const s = 1.6 - 0.6 * ease.out(q); e.setAttribute('transform', `${a.base} translate(${a.cx} ${a.cy}) scale(${s.toFixed(3)}) translate(${-a.cx} ${-a.cy})`); e.setAttribute('opacity', q.toFixed(3)); break; }
      case 'draw': e.setAttribute('stroke-dashoffset', (a.l * (1 - ease.io(q))).toFixed(1)); break;
      case 'grow': { const k = Math.max(0.0001, ease.out(q)); const sc = a.ax === 'x' ? `${k.toFixed(4)} 1` : `1 ${k.toFixed(4)}`; e.setAttribute('transform', `${a.base} translate(${a.cx} ${a.cy}) scale(${sc}) translate(${-a.cx} ${-a.cy})`); break; }
      case 'hl': e.setAttribute('transform', `translate(${a.x0} 0) scale(${Math.max(0.0001, ease.io(q)).toFixed(4)} 1) translate(${-a.x0} 0)`); break;
      case 'type': { const s = a.txt.slice(0, Math.round(a.txt.length * q)); if (s !== a.last) { e.textContent = s; a.last = s; } break; }
      // Meko: a count toward 10,000 or more uses thousands separators all the way, so it does not jump from 9999 to 10,001.
      // A count from zero stays hidden until it starts, so no zero waits on screen.
      case 'count': { if (a.from === 0) e.setAttribute('opacity', p >= a.at ? '1' : '0'); const s = a.pre + fmtNum(lerp(a.from, a.to, ease.io(q)), a.dec, a.sep || (Math.max(Math.abs(a.from), Math.abs(a.to)) >= 10000 ? 'always' : '')) + a.suf; if (s !== a.last) { e.textContent = s; a.last = s; } break; }
      case 'rot': e.setAttribute('transform', `${a.base} rotate(${lerp(a.a0, a.a1, ease.io(q)).toFixed(2)} ${a.cx} ${a.cy})`); break;
      case 'wipe': e.setAttribute('width', Math.max(0, a.w * ease.io(q)).toFixed(1)); break;
      case 'move': { const k = ease.io(q); e.setAttribute('transform', `${a.base} translate(${lerp(a.x0, a.x1, k).toFixed(1)} ${lerp(a.y0, a.y1, k).toFixed(1)})`); break; }
      case 'pulse': { const ph = ((t * (1 / (a.d || 1))) % 1); e.setAttribute('r', lerp(a.r0, a.r1, ph).toFixed(1)); e.setAttribute('opacity', (p >= a.at ? 1 - ph : 0).toFixed(2)); break; }
      default: break;
    }
  }
}

export const util = { clamp, prog, lerp, ease, esc, wrap, fmtNum, W, H: H_FRAME };
