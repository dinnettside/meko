// Animated diagrams of how things work (machines), drawn for Meko in the film engine's style. See ../engine.js for how
// templates work. Every visible word comes from the params; a part without a label in the params is drawn unlabeled.
// The drawings show no numbers or facts of their own: they show how a thing works, and the narration says the rest.
import { register } from "../engine.js";

const CD = 'Diagrams';

// Physical things keep their natural color in every look, chosen to read on the dark grounds and on the light page.
const FLAME = '#FF7A1A', FLAME_CORE = '#FFD34D'; // fire
const SEA = '#2F7FD0'; // sea water
const BOLT = '#FFF5C2', BOLT_EDGE = '#3A2F00'; // a lightning bolt: pale yellow-white with a dark edge
const STORM = '#5A6472'; // a storm cloud
const MOON = '#C9CED6'; // the Moon
const PLUS = '#E0473A', MINUS = '#2F6FD8', CHARGE = '#FFFFFF'; // electric charges: a red plus or a blue minus on a white disc
const SMOKE = '#9AA1A9'; // burnt gas
const LAMP = '#FFD34D'; // a lit window

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const smooth = (x) => { const q = clamp(x, 0, 1); return q * q * (3 - 2 * q); };
const span = (p, a, b) => clamp((p - a) / (b - a), 0, 1);
const easeOut = (x) => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
const n1 = (v) => (+v).toFixed(1);
// A label's text from the params: a non-empty string (or a number), otherwise nothing.
const say = (v) => (typeof v === 'string' ? v.trim() : typeof v === 'number' && Number.isFinite(v) ? String(v) : '');
// A moment given in the params as a fraction of the scene (TemplateScene turns a spoken word into one), kept in range.
const moment = (v, fallback, lo, hi) => (typeof v === 'number' && Number.isFinite(v) ? clamp(v, lo, hi) : fallback);

// A polyline's length up to each point, and the point and heading at a length along it.
const lengths = (P) => P.reduce((L, q, i) => (L.push(i ? L[i - 1] + Math.hypot(q[0] - P[i - 1][0], q[1] - P[i - 1][1]) : 0), L), []);
function along(P, L, s) {
  const d = clamp(s, 0, L[L.length - 1]);
  let lo = 1, hi = L.length - 1;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (L[mid] < d) lo = mid + 1; else hi = mid; }
  const a = P[lo - 1], b = P[lo], k = (d - L[lo - 1]) / (L[lo] - L[lo - 1] || 1);
  return { x: a[0] + (b[0] - a[0]) * k, y: a[1] + (b[1] - a[1]) * k, a: Math.atan2(b[1] - a[1], b[0] - a[0]) };
}
const pathD = (P) => (P.length ? 'M' + P.map((q) => n1(q[0]) + ' ' + n1(q[1])).join('L') : '');

// A smooth curve through points [x, y] with x rising: it starts and ends at rest and never turns back (a monotone
// cubic), so a thing moved along it speeds up from a standstill and glides to a stop.
function smoothKeys(K) {
  const d = [], m = [0];
  for (let i = 0; i < K.length - 1; i++) d.push((K[i + 1][1] - K[i][1]) / (K[i + 1][0] - K[i][0]));
  for (let i = 1; i < K.length - 1; i++) m.push(d[i - 1] * d[i] > 0 ? 2 / (1 / d[i - 1] + 1 / d[i]) : 0);
  m.push(0);
  return (x) => {
    if (x <= K[0][0]) return K[0][1];
    if (x >= K[K.length - 1][0]) return K[K.length - 1][1];
    let i = 0;
    while (x > K[i + 1][0]) i++;
    const h = K[i + 1][0] - K[i][0], t = (x - K[i][0]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * K[i][1] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * K[i + 1][1] + (t3 - t2) * h * m[i + 1];
  };
}

// A label from the params in one or more lines (wrapped at `max` characters), outlined in the ground color so it
// stays readable where it crosses a line. Without text it draws nothing. y is the first line's baseline, or the last
// line's with o.up. o: a (anchor), s (size), f (color), an (an animation from U.A), id.
function label(U, th, x, y, value, o = {}) {
  const t = say(value);
  if (!t) return '';
  const s = o.s || 34, lh = Math.round(s * 1.2), lines = U.wrap(t, o.max || 20), y0 = o.up ? y - (lines.length - 1) * lh : y;
  return `<g${o.id ? ` id="${o.id}"` : ''}${o.an || ''}>` +
    lines.map((line, i) => U.T(n1(x), n1(y0 + i * lh), line, { a: o.a || 'middle', s, w: o.w || 700, f: o.f || th.ink, halo: o.halo ?? 8 })).join('') + '</g>';
}
// A thin line from a part (with a dot on it) to its label, outlined in the ground color so it shows over the parts.
const leader = (th, x1, y1, x2, y2) => {
  const d = `M${n1(x1)} ${n1(y1)}L${n1(x2)} ${n1(y2)}`;
  return `<path d="${d}" stroke="${th.bg}" stroke-width="8" stroke-linecap="round" fill="none"/><path d="${d}" stroke="${th.ink}" stroke-width="3" stroke-linecap="round" fill="none" opacity=".8"/>` +
    `<circle cx="${n1(x1)}" cy="${n1(y1)}" r="7" fill="${th.ink}" stroke="${th.bg}" stroke-width="3"/>`;
};
// Moves a leader drawn by `leader` (inside the group g) so it starts at a part that moves.
const moveLeader = (g, x1, y1, x2, y2) => {
  if (!g) return;
  g.querySelectorAll('path').forEach((el) => el.setAttribute('d', `M${n1(x1)} ${n1(y1)}L${n1(x2)} ${n1(y2)}`));
  const dot = g.querySelector('circle');
  dot.setAttribute('cx', n1(x1));
  dot.setAttribute('cy', n1(y1));
};

/* ---------------------------------------------------------------------------------------------------------------
 * Rocket launch
 * ------------------------------------------------------------------------------------------------------------- */

// The rocket by number of stages: the length of each stage from the bottom up, and of the nose cone on top.
const ROCKETS = { 1: { stages: [134], nose: 46 }, 2: { stages: [104, 58], nose: 42 }, 3: { stages: [86, 54, 40], nose: 38 } };
const RW = 38; // the rocket's width

// The flight path, the same for every rocket. The Earth is a circle far below the frame, and the pad stands a little
// left of its top, so straight up there leans slightly left. The rocket rises straight up, then pitches over: its
// climb angle falls from upright to level along the way (as the cube of the distance left), so it turns quickly at
// first and then climbs at a shallow angle until it runs level along the orbit. The path is worked out step by step
// around the Earth's middle, with the turn's length chosen so that it ends at the orbit's height.
const FLIGHT = (() => {
  const E = { x: 660, y: 2786, r: 2000 }, alt = 540, pad = 16, rise = 240, f0 = -0.12, step = 4;
  const pt = (f, h) => [E.x + (E.r + h) * Math.sin(f), E.y - (E.r + h) * Math.cos(f)];
  const fly = (S, P) => {
    let f = f0, h = pad;
    for (let s = 0; s <= rise + S; s += step) {
      if (P) P.push(pt(f, h));
      const g = s < rise ? Math.PI / 2 : (Math.PI / 2) * Math.pow(1 - (s - rise) / S, 3);
      h += Math.sin(g) * step;
      f += (Math.cos(g) * step) / (E.r + h);
    }
    return { f, h };
  };
  let lo = 100, hi = 3000;
  for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (fly(mid).h < alt) lo = mid; else hi = mid; }
  const P = [], fA = fly(lo, P).f, iAsc = P.length - 1, fEnd = fA + 0.15;
  for (let k = 1; k <= 40; k++) P.push(pt(fA + ((fEnd + 0.15 - fA) * k) / 40, alt));
  const L = lengths(P);
  return { E, alt, pad, f0, fEnd, pt, P, L, iAsc, sAsc: L[iAsc], sEnd: L[iAsc] + (fEnd - fA) * (E.r + alt) };
})();

// What the drawing and the motion share: the rocket's stages, and where it is at each moment.
function rocketPlan(p) {
  const n = clamp(Math.round(Number(p.stages) || 2), 1, 3), shape = ROCKETS[n], lens = shape.stages, F = FLIGHT;
  // From the nose down: where each stage starts (its top) and ends (its bottom).
  const top = [], bottom = [];
  let y = shape.nose;
  for (let k = n - 1; k >= 0; k--) { top[k] = y; y += lens[k]; bottom[k] = y; }
  const total = y;
  // When things happen, as fractions of the scene: liftoff, each separation, orbit. The nose's place along the path
  // at those moments: on the pad, with the joint of each separation part of the way up, and in orbit.
  const pL = 0.1, pO = 0.8, p1 = moment(p.at, n === 3 ? 0.36 : 0.44, 0.25, 0.6);
  // The separations happen while the rocket still climbs steeply, where there is room for their names beside the path.
  const seps = n === 1 ? [] : n === 2 ? [p1] : [p1, p1 + (pO - p1) * 0.3], up = n === 3 ? [0.26, 0.42] : [0.4];
  const keys = [[pL, total], ...seps.map((ps, k) => [ps, up[k] * F.sAsc + top[k]]), [pO, F.sAsc + bottom[n - 1]], [1, F.sEnd + bottom[n - 1]]];
  const nose = smoothKeys(keys);
  const ign = [pL - 0.03, ...seps.map((ps) => ps + 0.02)], cut = [...seps, pO];
  // Where the rocket is: its nose on the path, and its body along the line back to its base, also on the path.
  const pose = (s, len) => { const a = along(F.P, F.L, s), b = along(F.P, F.L, s - len), d = Math.hypot(a.x - b.x, a.y - b.y) || 1; return { x: a.x, y: a.y, dx: (a.x - b.x) / d, dy: (a.y - b.y) / d }; };
  // Each dropped stage keeps a part of the rocket's speed, falls and tumbles. `c` is its middle when it lets go.
  const drops = seps.map((ps, k) => {
    const o = pose(nose(ps), bottom[k]), v = (nose(ps + 0.004) - nose(ps - 0.004)) / 0.008, mid = (top[k] + bottom[k]) / 2;
    return { p: ps, mid, c: [o.x - mid * o.dx, o.y - mid * o.dy], v: [0.3 * v * o.dx, 0.3 * v * o.dy], deg: (Math.atan2(o.dy, o.dx) * 180) / Math.PI + 90, joint: [o.x - top[k] * o.dx, o.y - top[k] * o.dy] };
  });
  return { ...F, n, shape, lens, top, bottom, total, pL, pO, seps, nose, pose, ign, cut, drops, G: 5200, spin: 420, fall: 0.3 };
}
// Where a dropped stage's middle is `tau` (a fraction of the scene) after it lets go.
const dropAt = (R, d, tau) => [d.c[0] + d.v[0] * tau, d.c[1] + d.v[1] * tau + 0.5 * R.G * tau * tau];

// The rocket's stages, nose up with its tip at 0 0, each in its own group so it can drop away. The top stage is the
// highlight; the stages below it are drawn in ink (and the middle one of three in the second highlight).
function rocketMarkup(th, R, id) {
  const { n, shape, top, bottom } = R, w = RW / 2, cols = n === 1 ? [th.accent] : n === 2 ? [th.ink, th.accent] : [th.ink, th.accent2, th.accent];
  let o = '';
  // The upper stages come first, so the stage below covers the engine of the one above until it drops away.
  for (let k = n - 1; k >= 0; k--) {
    const y0 = top[k], y1 = bottom[k], fl = k ? 58 : 86;
    let s = `<g id="${id}fl${k}" opacity="0"><path d="M${-w * 0.62} ${y1 + 8}Q${-w * 0.7} ${y1 + fl * 0.55} 0 ${y1 + fl}Q${w * 0.7} ${y1 + fl * 0.55} ${w * 0.62} ${y1 + 8}Z" fill="${FLAME}"/>` +
      `<path d="M${-w * 0.32} ${y1 + 8}Q${-w * 0.36} ${y1 + fl * 0.4} 0 ${y1 + fl * 0.62}Q${w * 0.36} ${y1 + fl * 0.4} ${w * 0.32} ${y1 + 8}Z" fill="${FLAME_CORE}"/></g>`;
    s += `<path d="M${-w * 0.42} ${y1 - 2}L${-w * 0.66} ${y1 + 12}H${w * 0.66}L${w * 0.42} ${y1 - 2}Z" fill="${th.muted}"/>`;
    s += `<rect x="${-w}" y="${y0}" width="${RW}" height="${y1 - y0}" fill="${cols[k]}"/>`;
    if (k < n - 1) s += `<rect x="${-w}" y="${y0}" width="${RW}" height="5" fill="${th.bg}" opacity=".55"/>`;
    if (k === 0) s += `<path d="M${-w} ${y1 - 48}L${-w - 22} ${y1 + 8}L${-w} ${y1 - 2}ZM${w} ${y1 - 48}L${w + 22} ${y1 + 8}L${w} ${y1 - 2}Z" fill="${th.muted}"/>`;
    if (k === n - 1) { const h = shape.nose; s += `<path d="M${-w} ${h}C${-w} ${h * 0.45} ${-w * 0.4} ${h * 0.06} 0 0C${w * 0.4} ${h * 0.06} ${w} ${h * 0.45} ${w} ${h}Z" fill="${cols[k]}"/>`; }
    o += `<g id="${id}st${k}">${s}</g>`;
  }
  return o;
}

register('rocket_launch', {
  cat: CD,
  title: 'Rocket launch',
  desc: 'A rocket lifts off, climbs almost straight up, then pitches over and turns along a curved path. Its lower stages separate and fall away while the top stage burns on into orbit around the curve of the Earth.',
  use: 'How a rocket reaches orbit, why rockets are built in stages, and launches of satellites, probes and crews.',
  params: 'stages (1 to 3, default 2), stageLabels: [a name for each stage, bottom stage first], liftoff, separation, orbit (names for the moments of the flight; separation may be a list with one name per separation), at (when the first stage separates)',
  example: { stages: 2, stageLabels: ['First stage', 'Second stage'], liftoff: 'Liftoff', separation: 'Stage separation', orbit: 'Orbit' },
  build(p, c) {
    const { U, th } = c, id = c.id, R = rocketPlan(p), P0 = R.pt(R.f0, 0), names = Array.isArray(p.stageLabels) ? p.stageLabels : [];
    const sepNames = Array.isArray(p.separation) ? p.separation : [p.separation];
    // The Earth with a thin band of air, reaching far past the frame. It is the ground, so it is not measured.
    let o = `<circle cx="${R.E.x}" cy="${R.E.y}" r="${R.E.r + 44}" fill="${th.accent2}" fill-opacity=".14" data-fm-bg="1"/>` +
      `<circle cx="${R.E.x}" cy="${R.E.y}" r="${R.E.r}" fill="${th.surface}" stroke="${th.ink}" stroke-opacity=".55" stroke-width="3" data-fm-bg="1"/>`;
    // The orbit, a dashed circle around the Earth across the frame: faint at first, bright once the rocket is there.
    const ro = R.E.r + R.alt, fa = Math.asin((80 - R.E.x) / ro), fb = Math.asin((1850 - R.E.x) / ro), arc = [];
    for (let k = 0; k <= 80; k++) arc.push(R.pt(fa + ((fb - fa) * k) / 80, R.alt));
    o += `<g opacity="0"${U.A('fade', 0.02, 0.06)}><path d="${pathD(arc)}" fill="none" stroke="${th.muted}" stroke-width="3" stroke-dasharray="14 14" opacity=".6"/></g>` +
      `<path d="${pathD(arc)}" fill="none" stroke="${th.accent2}" stroke-width="4" stroke-dasharray="14 14" opacity="0"${U.A('fade', R.pO - 0.02, 0.06)}/>`;
    // The pad with its tower, standing straight up from the curved ground, and the smoke at liftoff.
    const xa = -(RW / 2 + 58), xb = -(RW / 2 + 30), yt = -R.pad - R.total - 14;
    let tower = `M${xa} ${-R.pad}V${yt}M${xb} ${-R.pad}V${yt}M${xa - 8} ${yt}H${xb + 8}M${xb} ${n1(-R.pad - R.total * 0.7)}H${-RW / 2}`;
    for (let yy = -R.pad, i = 0; yy - 30 > yt; yy -= 30, i++) tower += `M${i % 2 ? xa : xb} ${yy}L${i % 2 ? xb : xa} ${yy - 30}`;
    o += `<g transform="translate(${n1(P0[0])} ${n1(P0[1])}) rotate(${n1((R.f0 * 180) / Math.PI)})"${U.A('fade', 0, 0.05)}>` +
      `<path d="${tower}" stroke="${th.muted}" stroke-width="4" stroke-linecap="round" fill="none"/>` +
      `<rect x="-90" y="${-R.pad}" width="180" height="${R.pad}" fill="${th.muted}"/>` +
      [0, 1, 2, 3, 4, 5].map((j) => `<circle id="${id}pf${j}" cx="0" cy="${-R.pad}" r="0" fill="${th.muted}" opacity="0"/>`).join('') + '</g>';
    // The path flown so far, drawn behind the rocket up to orbit, and the path of each dropped stage.
    o += `<path id="${id}trail" d="${pathD(R.P.slice(0, R.iAsc + 1))}" fill="none" stroke="${th.accent2}" stroke-width="5" stroke-linecap="round" stroke-dasharray="${n1(R.sAsc)}" stroke-dashoffset="${n1(R.sAsc)}"/>`;
    o += R.drops.map((d, k) => `<path id="${id}fall${k}" d="" fill="none" stroke="${th.muted}" stroke-width="6" stroke-linecap="round" stroke-dasharray="1 15"/>`).join('');
    // A ring where each stage let go, under the rocket so the dropping stage covers it until it has moved away.
    o += R.drops.map((d) => `<circle cx="${n1(d.joint[0])}" cy="${n1(d.joint[1])}" r="11" fill="${th.bg}" stroke="${th.ink}" stroke-width="4" opacity="0"${U.A('fade', d.p, 0.02)}/>`).join('');
    o += rocketMarkup(th, R, id);
    // The labels, each where its moment happens: liftoff at the pad, each separation by its ring with the dropped
    // stage's name at the end of its fall, the orbit on the orbit, and the top stage's name where it ends up.
    o += label(U, th, P0[0] - 108, P0[1] - 60, p.liftoff, { a: 'end', an: U.A('fade', R.pL - 0.04, 0.05) });
    R.drops.forEach((d, k) => {
      const j = d.joint, e = dropAt(R, d, R.fall);
      o += label(U, th, j[0] - 30, j[1] - 22, sepNames[k], { a: 'end', up: true, max: 14, an: U.A('fade', d.p + 0.01, 0.05) });
      o += label(U, th, e[0] + 40, e[1] + 12, names[k], { a: 'start', max: 16, an: U.A('fade', d.p + 0.16, 0.05) });
    });
    const ol = R.pt(R.fEnd + 0.1, R.alt);
    o += label(U, th, ol[0] + 10, ol[1] - 34, p.orbit, { a: 'start', up: true, max: 12, an: U.A('fade', R.pO, 0.05) });
    const fin = R.pose(R.nose(1), R.bottom[R.n - 1]), mid = (R.top[R.n - 1] + R.bottom[R.n - 1]) / 2;
    o += label(U, th, fin.x - mid * fin.dx, fin.y - mid * fin.dy + 78, names[R.n - 1], { max: 16, an: U.A('fade', 0.9, 0.05) });
    return o;
  },
  init(g, p, c) {
    const R = rocketPlan(p), q = (s) => g.querySelector('#' + c.id + s);
    return { R, stage: R.lens.map((_, k) => q('st' + k)), flame: R.lens.map((_, k) => q('fl' + k)), fall: R.drops.map((_, k) => q('fall' + k)), trail: q('trail'), puffs: [0, 1, 2, 3, 4, 5].map((j) => q('pf' + j)) };
  },
  render(l, st) {
    const R = st.R, p = l.p, t = l.t, s = R.nose(p);
    const on = R.seps.filter((ps) => p >= ps).length; // the stages below this one have dropped away
    const at = R.pose(s, R.bottom[on]), deg = (Math.atan2(at.dy, at.dx) * 180) / Math.PI + 90;
    R.lens.forEach((_, k) => {
      const g = st.stage[k];
      if (k >= on) {
        g.setAttribute('transform', `translate(${n1(at.x)} ${n1(at.y)}) rotate(${deg.toFixed(2)})`);
        g.setAttribute('opacity', '1');
      } else {
        const d = R.drops[k], tau = Math.min(p - d.p, R.fall), e = dropAt(R, d, tau), pts = [];
        g.setAttribute('transform', `translate(${n1(e[0])} ${n1(e[1])}) rotate(${(d.deg + R.spin * tau).toFixed(2)}) translate(0 ${n1(-d.mid)})`);
        g.setAttribute('opacity', (1 - smooth((tau - R.fall * 0.45) / (R.fall * 0.55))).toFixed(3));
        for (let i = 0; i <= 24; i++) pts.push(dropAt(R, d, (tau * i) / 24));
        st.fall[k].setAttribute('d', pathD(pts));
      }
      if (k >= on) st.fall[k]?.setAttribute('d', '');
      // The engine of the lowest stage still attached burns from its ignition until it drops away or reaches orbit.
      const burning = k === on && p >= R.ign[k] && p < R.cut[k], f = st.flame[k];
      f.setAttribute('opacity', burning ? '1' : '0');
      if (burning) {
        // On the pad and just above it, the flame is kept short, as if it hit the pad and spread out as smoke.
        const flick = 1 + 0.12 * Math.sin(t * 29 + k * 2) + 0.07 * Math.sin(t * 47 + k), y1 = R.bottom[k];
        const grow = smooth((p - R.ign[k]) / 0.025) * clamp((s - y1 + 12) / (k ? 58 : 86), 0.2, 1);
        f.setAttribute('transform', `translate(0 ${y1}) scale(${(0.92 + 0.08 * flick).toFixed(3)} ${(grow * flick).toFixed(3)}) translate(0 ${-y1})`);
      }
    });
    st.trail.setAttribute('stroke-dashoffset', n1(R.sAsc - clamp(s - R.bottom[on], 0, R.sAsc)));
    // Smoke puffs out to both sides of the pad as the engine lights, and clears.
    st.puffs.forEach((el, j) => {
      const q = span(p, R.ign[0] + 0.006 * j, R.pL + 0.12), side = j % 2 ? 1 : -1, dist = 46 + 34 * Math.floor(j / 2);
      el.setAttribute('cx', n1(side * dist * (0.35 + 0.65 * easeOut(q))));
      el.setAttribute('cy', n1(-R.pad - 14 - 10 * q));
      el.setAttribute('r', n1(12 + 30 * easeOut(q)));
      el.setAttribute('opacity', q > 0 && q < 1 ? (0.6 * (1 - q)).toFixed(3) : '0');
    });
  },
});

/* ---------------------------------------------------------------------------------------------------------------
 * Four-stroke engine
 * ------------------------------------------------------------------------------------------------------------- */

// A cut through one cylinder, in fixed heights: the head, the chamber's ceiling, the piston's height, where the pin
// sits in it, the crankshaft's middle, the crank's radius, the rod's length, half the bore and the wall. With these the
// piston's top runs from 300 (at the top) to 460 (at the bottom).
const ENG = { head: 180, ceil: 280, piston: 100, pin: 55, crank: 700, r: 80, rod: 265, bore: 140, wall: 30 };
// The strokes' names in the params, and the engine's middle: left of center to make room for the names, if any.
const strokeNames = (p) => (Array.isArray(p.strokes) ? p.strokes : []).slice(0, 4).map(say);
const engineX = (p) => (strokeNames(p).some(Boolean) ? 760 : 960);
const pistonTop = (a) => ENG.crank - ENG.r * Math.cos(a) - Math.sqrt(ENG.rod * ENG.rod - Math.pow(ENG.r * Math.sin(a), 2)) - ENG.pin;
// Where the cycle is at progress p: the stroke (0 intake, 1 compression, 2 power, 3 exhaust; -1 before, 4 after), how
// far through it, and the crank's angle (0 with the piston at the top). Each stroke is half a turn, with a short rest
// at the top and the bottom so each stroke reads on its own.
const STROKES = { from: 0.1, each: 0.21 };
function cycleAt(p) {
  const { from, each } = STROKES;
  if (p < from) return { k: -1, q: 0, a: 0 };
  if (p >= from + 4 * each) return { k: 4, q: 0, a: 4 * Math.PI };
  const k = Math.min(3, Math.floor((p - from) / each)), q = (p - from - k * each) / each;
  return { k, q, a: (k + smooth(q)) * Math.PI };
}
// A valve's lift through its stroke: it opens at the start, stays open and closes at the end.
const lift = (q) => 24 * smooth(q / 0.16) * smooth((1 - q) / 0.16);
const starPath = (cx, cy, R, r, n) => 'M' + Array.from({ length: n * 2 }, (_, i) => { const a = (Math.PI * i) / n - Math.PI / 2, d = i % 2 ? r : R; return n1(cx + d * Math.cos(a)) + ' ' + n1(cy + d * Math.sin(a)); }).join('L') + 'Z';

register('engine_cycle', {
  cat: CD,
  title: 'Four-stroke engine',
  desc: 'A cut through one cylinder of a piston engine. The piston goes down and up while the valves open and close: fuel and air come in, are squeezed, a spark lights them and the burning gas pushes the piston down, and the exhaust is pushed out, one stroke after another.',
  use: 'How a car engine or any piston engine works, and the four strokes of its cycle.',
  params: 'strokes: [four names in order: intake, compression, power, exhaust], parts: {intakeValve, exhaustValve, sparkPlug, piston, rod, crankshaft, fuelAir, exhaustGas} (names of the parts, each optional)',
  example: { strokes: ['Intake', 'Compression', 'Power', 'Exhaust'], parts: { intakeValve: 'Intake valve', exhaustValve: 'Exhaust valve', sparkPlug: 'Spark plug', piston: 'Piston', crankshaft: 'Crankshaft', fuelAir: 'Fuel and air', exhaustGas: 'Exhaust' } },
  build(p, c) {
    const { U, th } = c, id = c.id, E = ENG, S = strokeNames(p), list = S.some(Boolean);
    const X = engineX(p), bl = X - E.bore, br = X + E.bore, vi = X - 80, ve = X + 80, P = p.parts && typeof p.parts === 'object' ? p.parts : {};
    const inPath = `M${X - 216} 228H${vi}V${E.ceil + 2}`, exPath = `M${ve} ${E.ceil + 2}V228H${X + 216}`;
    // The crankshaft (turned in render), the rod and the crank pin.
    let o = `<g id="${id}crank"><circle cx="${X}" cy="${E.crank}" r="98" fill="${th.surface}" stroke="${th.muted}" stroke-width="4"/>` +
      `<path d="M${X - 86} ${E.crank}A86 86 0 0 0 ${X + 86} ${E.crank}Z" fill="${th.muted}"/><path d="M${X} ${E.crank}V${E.crank - E.r}" stroke="${th.muted}" stroke-width="56" stroke-linecap="round"/>` +
      `<circle cx="${X}" cy="${E.crank}" r="16" fill="${th.bg}"/></g>` +
      `<path id="${id}rod" d="" stroke="${th.ink}" stroke-width="30" stroke-linecap="round" fill="none"/><circle id="${id}cpin" r="15" fill="${th.ink}" stroke="${th.bg}" stroke-width="4"/>`;
    // The cylinder's walls, the gas in the chamber and the piston.
    o += `<rect x="${bl - E.wall}" y="${E.ceil}" width="${E.wall}" height="330" fill="${th.muted}"/><rect x="${br}" y="${E.ceil}" width="${E.wall}" height="330" fill="${th.muted}"/>` +
      `<rect id="${id}gas" x="${bl}" y="${E.ceil}" width="${2 * E.bore}" height="20" fill="${th.accent2}" opacity="0"/>` +
      `<rect id="${id}core" x="${bl}" y="${E.ceil}" width="${2 * E.bore}" height="20" fill="${FLAME_CORE}" opacity="0"/>` +
      `<g id="${id}piston"><rect x="${bl + 4}" y="0" width="${2 * E.bore - 8}" height="${E.piston}" rx="4" fill="${th.ink}"/>` +
      `<rect x="${bl + 4}" y="14" width="${2 * E.bore - 8}" height="5" fill="${th.bg}"/><rect x="${bl + 4}" y="28" width="${2 * E.bore - 8}" height="5" fill="${th.bg}"/>` +
      `<circle cx="${X}" cy="${E.pin}" r="15" fill="${th.muted}" stroke="${th.bg}" stroke-width="4"/></g>`;
    // The head with its two ports, the fuel and air or the exhaust in them, the valves and the spark plug.
    o += `<rect x="${X - 210}" y="${E.head}" width="420" height="${E.ceil - E.head}" rx="8" fill="${th.muted}"/>` +
      `<path d="${inPath}" stroke="${th.bg}" stroke-width="40" fill="none"/><path d="${exPath}" stroke="${th.bg}" stroke-width="40" fill="none"/>` +
      `<path id="${id}inGas" d="${inPath}" stroke="${th.accent2}" stroke-width="40" fill="none" opacity="0"/><path id="${id}exGas" d="${exPath}" stroke="${SMOKE}" stroke-width="40" fill="none" opacity="0"/>`;
    const valve = (vx, key) => `<g id="${id}${key}"><rect x="${vx - 5}" y="${E.head - 12}" width="10" height="${E.ceil - E.head}" fill="${th.ink}"/><path d="M${vx - 34} ${E.ceil}L${vx - 14} ${E.ceil - 14}H${vx + 14}L${vx + 34} ${E.ceil}Z" fill="${th.ink}"/></g>`;
    o += valve(vi, 'vin') + valve(ve, 'vex') +
      `<rect x="${X - 9}" y="${E.head}" width="18" height="${E.ceil - E.head + 8}" fill="${th.ink}"/><rect x="${X - 20}" y="${E.head - 22}" width="40" height="22" rx="3" fill="${th.ink}"/><rect x="${X - 9}" y="${E.head - 46}" width="18" height="26" rx="4" fill="${th.ink}"/>` +
      `<g id="${id}spark" opacity="0"><path d="${starPath(X, E.ceil + 22, 34, 13, 8)}" fill="${BOLT}" stroke="${BOLT_EDGE}" stroke-width="3" stroke-linejoin="round"/></g>`;
    for (let j = 0; j < 6; j++) o += `<circle id="${id}in${j}" r="9" fill="${th.accent2}" opacity="0"/><circle id="${id}ex${j}" r="9" fill="${SMOKE}" opacity="0"/>`;
    // The parts' names: on the left the way in, on the right the way out, each with a line to its part.
    const side = (key, y, a, ax, ay) => {
      if (!say(P[key])) return '';
      const x = a === 'end' ? X - 250 : X + 250, tx = a === 'end' ? x + 10 : x - 10;
      return `<g opacity="0"${U.A('fade', 0.04, 0.05)}>${ax == null ? '' : `<g id="${id}ld${key}">${leader(th, ax, ay, tx, y - 10)}</g>`}${label(U, th, x, y, P[key], { a, s: 32, max: 16 })}</g>`;
    };
    o += side('fuelAir', 240, 'end') + side('intakeValve', 345, 'end', vi, 252) + side('piston', 470, 'end', bl + 30, 360) + side('crankshaft', 720, 'end', X - 98, E.crank) +
      side('sparkPlug', 166, 'start', X + 9, 156) + side('exhaustGas', 240, 'start') + side('exhaustValve', 345, 'start', ve, 252) + side('rod', 600, 'start', X + 10, 520);
    // The four strokes, each lit up while it happens.
    if (list) S.forEach((s, j) => { const y = 280 + j * 120; o += `<g id="${id}sk${j}" opacity="0"${U.A('fade', 0.03 + j * 0.015, 0.05)}><rect x="1360" y="${y - 46}" width="10" height="60" rx="3" fill="${th.line}"/>${U.T(1394, y, s, { a: 'start', fam: 'd', s: 48, w: 700, f: th.muted })}</g>`; });
    return o;
  },
  init(g, p, c) {
    const q = (s) => g.querySelector('#' + c.id + s);
    return { crank: q('crank'), rod: q('rod'), cpin: q('cpin'), gas: q('gas'), core: q('core'), piston: q('piston'), inGas: q('inGas'), exGas: q('exGas'), vin: q('vin'), vex: q('vex'), spark: q('spark'),
      dotsIn: [0, 1, 2, 3, 4, 5].map((j) => q('in' + j)), dotsEx: [0, 1, 2, 3, 4, 5].map((j) => q('ex' + j)), ldPiston: q('ldpiston'), ldRod: q('ldrod'),
      rows: [0, 1, 2, 3].map((j) => q('sk' + j)), X: engineX(p) };
  },
  render(l, st, p, c) {
    const { th } = c, E = ENG, X = st.X, { k, q, a } = cycleAt(l.p), top = pistonTop(a);
    const pin = [X + E.r * Math.sin(a), E.crank - E.r * Math.cos(a)], wrist = [X, top + E.pin];
    st.crank.setAttribute('transform', `rotate(${((a * 180) / Math.PI).toFixed(2)} ${X} ${E.crank})`);
    st.rod.setAttribute('d', `M${n1(wrist[0])} ${n1(wrist[1])}L${n1(pin[0])} ${n1(pin[1])}`);
    st.cpin.setAttribute('cx', n1(pin[0]));
    st.cpin.setAttribute('cy', n1(pin[1]));
    st.piston.setAttribute('transform', `translate(0 ${n1(top)})`);
    st.vin.setAttribute('transform', `translate(0 ${n1(k === 0 ? lift(q) : 0)})`);
    st.vex.setAttribute('transform', `translate(0 ${n1(k === 3 ? lift(q) : 0)})`);
    // The gas above the piston: fuel and air drawn in, then squeezed (denser), burning after the spark, then exhaust.
    const h = n1(Math.max(0, top - E.ceil));
    st.gas.setAttribute('height', h);
    st.core.setAttribute('height', h);
    const gas = k === 0 ? [th.accent2, 0.5] : k === 1 ? [th.accent2, 0.5 + 0.35 * smooth(q)] : k === 2 ? [FLAME, 0.95 - 0.4 * q] : k === 3 ? [SMOKE, 0.65 - 0.45 * q] : [th.accent2, 0];
    st.gas.setAttribute('fill', gas[0]);
    st.gas.setAttribute('opacity', gas[1].toFixed(3));
    st.core.setAttribute('opacity', k === 2 ? (1 - smooth(q / 0.35)).toFixed(3) : '0');
    st.spark.setAttribute('opacity', k === 2 && q < 0.14 ? '1' : '0');
    if (k === 2) { const sc = 0.6 + 0.6 * Math.sin(Math.min(1, q / 0.14) * Math.PI); st.spark.setAttribute('transform', `translate(${X} ${E.ceil + 22}) scale(${sc.toFixed(3)}) translate(${-X} ${-E.ceil - 22})`); }
    st.inGas.setAttribute('opacity', k === 0 ? (0.5 * smooth(q / 0.16) * smooth((1 - q) / 0.16)).toFixed(3) : '0');
    st.exGas.setAttribute('opacity', k === 3 ? (0.65 * smooth(q / 0.16) * smooth((1 - q) / 0.16)).toFixed(3) : '0');
    // Dots of fuel and air flowing in through the open intake port, and of exhaust flowing out of the other.
    const flow = (dots, on, pts) => {
      const P = pts, L = lengths(P);
      dots.forEach((el, j) => {
        const f = q * 1.5 - j * 0.1, show = on && f >= 0 && f <= 1;
        el.setAttribute('opacity', show ? '1' : '0');
        if (show) { const pt = along(P, L, f * L[L.length - 1]); el.setAttribute('cx', n1(pt.x)); el.setAttribute('cy', n1(pt.y)); }
      });
    };
    flow(st.dotsIn, k === 0, [[X - 240, 228], [X - 80, 228], [X - 80, 300], [X - 40, 340]]);
    flow(st.dotsEx, k === 3, [[X + 40, 340], [X + 80, 300], [X + 80, 228], [X + 240, 228]]);
    moveLeader(st.ldPiston, X - E.bore + 30, top + 60, X - 240, 460);
    moveLeader(st.ldRod, (wrist[0] + pin[0]) / 2, (wrist[1] + pin[1]) / 2, X + 240, 590);
    // The strokes list: the stroke under way in the highlight, the ones done in ink, the ones to come dim.
    st.rows.forEach((row, j) => {
      if (!row) return;
      const now = j === k, done = j < k;
      row.querySelector('rect').setAttribute('fill', now ? th.accent : done ? th.ink : th.line);
      row.querySelector('text').setAttribute('fill', now ? th.accent : done ? th.ink : th.muted);
    });
  },
});

/* ---------------------------------------------------------------------------------------------------------------
 * Lightning storm
 * ------------------------------------------------------------------------------------------------------------- */

// The storm cloud as overlapping circles on a flat base, and the charges in it: their place when settled (plus at
// the top, minus at the bottom) and the mixed place they start from.
const CLOUD = { circles: [[700, 355, 72], [820, 295, 100], [965, 270, 115], [1110, 300, 95], [1225, 355, 70]], base: [640, 345, 650, 90] };
const CLOUD_PLUS = [[905, 222], [1015, 222], [790, 282], [875, 282], [960, 282], [1050, 282], [1140, 282]];
const CLOUD_MINUS = [[700, 402], [790, 402], [880, 402], [970, 402], [1060, 402], [1150, 402], [1240, 402]];
const GROUND_Y = 740, GROUND_PLUS = [760, 860, 960, 1060, 1160];
const BOLT_MAIN = [[955, 440], [928, 505], [978, 548], [946, 612], [1000, 655], [978, 700], [1004, 744]];
const BOLT_FORKS = [[[978, 548], [1040, 590], [1030, 628]], [[946, 612], [888, 660]]];
const THUNDER = { x: 970, y: 600, radii: [190, 300, 410] };
const cloudShape = (fill, extra = '') => `<g fill="${fill}"${extra}>${CLOUD.circles.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')}<rect x="${CLOUD.base[0]}" y="${CLOUD.base[1]}" width="${CLOUD.base[2]}" height="${CLOUD.base[3]}" rx="45"/></g>`;
// A charge: a white disc with a red plus or a blue minus.
const charge = (x, y, plus) => `<circle cx="${x}" cy="${y}" r="21" fill="${CHARGE}"/><path d="M${x - 11} ${y}H${x + 11}${plus ? `M${x} ${y - 11}V${y + 11}` : ''}" stroke="${plus ? PLUS : MINUS}" stroke-width="6" stroke-linecap="round"/>`;

register('lightning_storm', {
  cat: CD,
  title: 'Lightning storm',
  desc: 'A storm cloud whose charges separate, plus at the top and minus at the bottom, while plus charges gather on the ground below. A bolt of lightning strikes down to the ground, and the thunder spreads out from it in rings.',
  use: 'How lightning and thunder happen, thunderstorms, and electric charge in nature.',
  params: 'cloud, positive, negative, ground, lightning, thunder (labels, each optional), at (when the bolt strikes)',
  example: { cloud: 'Storm cloud', positive: 'Positive charge', negative: 'Negative charge', ground: 'Positive charge on the ground', lightning: 'Lightning', thunder: 'Thunder' },
  build(p, c) {
    const { U, th } = c, id = c.id, at = moment(p.at, 0.56, 0.45, 0.75), rnd = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646; })();
    // Where the charges start: the places of a grid across the cloud's middle, shuffled, so plus and minus are mixed.
    const slots = Array.from({ length: 14 }, (_, i) => [748 + (i % 7) * 76 + (rnd() - 0.5) * 24, 322 + Math.floor(i / 7) * 60 + (rnd() - 0.5) * 16]);
    for (let i = slots.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [slots[i], slots[j]] = [slots[j], slots[i]]; }
    // The ground, reaching far past the frame, with its edge.
    let o = `<rect x="-2000" y="${GROUND_Y}" width="5920" height="3000" fill="${th.surface}" data-fm-bg="1"/><path d="M-2000 ${GROUND_Y}H3920" stroke="${th.muted}" stroke-width="4" data-fm-bg="1"/>`;
    // The thunder: rings that spread out from the bolt through the air, behind the cloud and above the ground.
    o += `<defs><clipPath id="${id}air"><rect x="-2000" y="-2000" width="5920" height="${2000 + GROUND_Y}"/></clipPath></defs><g clip-path="url(#${id}air)">` +
      THUNDER.radii.map((_, k) => `<circle id="${id}ring${k}" cx="${THUNDER.x}" cy="${THUNDER.y}" r="10" fill="none" stroke="${th.ink}" stroke-width="5" opacity="0"/>`).join('') + '</g>';
    // The cloud, and its flash as the bolt strikes.
    o += `<g${U.A('fade', 0, 0.06)}>${cloudShape(STORM)}</g>` + cloudShape(BOLT, ` id="${id}flash" opacity="0"`);
    // The charges: mixed at first, then plus to the top and minus to the bottom.
    const charges = [...CLOUD_PLUS.map((q) => [q, true]), ...CLOUD_MINUS.map((q) => [q, false])];
    charges.forEach(([[x, y], plus], k) => {
      const [sx, sy] = slots[k];
      o += `<g opacity="0"${U.A('fade', 0.08 + (k % 7) * 0.008, 0.04)}><g${U.A('move', 0.18 + (k % 7) * 0.012, 0.14, { x0: n1(sx - x), y0: n1(sy - y), x1: 0, y1: 0 })}>${charge(x, y, plus)}</g></g>`;
    });
    // The plus charges gathering on the ground below.
    o += GROUND_PLUS.map((x, k) => `<g${U.A('pop', 0.4 + k * 0.012, 0.04, { cx: x, cy: GROUND_Y + 32 })}>${charge(x, GROUND_Y + 32, true)}</g>`).join('');
    // The bolt: a pale stroke with a dark edge, drawn down from the cloud (the leader), then flashing (the strike).
    const stroke = (P, col, w, a, d) => { const len = n1(lengths(P).pop() + 2); return `<path d="${pathD(P)}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${len}" stroke-dashoffset="${len}"${U.A('draw', a, d, { l: len })}/>`; };
    o += `<g id="${id}bolt">` + BOLT_FORKS.map((P) => stroke(P, BOLT_EDGE, 13, at - 0.035, 0.03)).join('') + stroke(BOLT_MAIN, BOLT_EDGE, 21, at - 0.06, 0.055) +
      BOLT_FORKS.map((P) => stroke(P, BOLT, 6, at - 0.035, 0.03)).join('') + stroke(BOLT_MAIN, BOLT, 10, at - 0.06, 0.055) + '</g>';
    // The labels: what the cloud and its charges are on the right, the bolt and the thunder on the left.
    o += label(U, th, 608, 368, p.cloud, { a: 'end', max: 14, an: U.A('fade', 0.05, 0.05) }) +
      label(U, th, 1330, 234, p.positive, { a: 'start', max: 18, an: U.A('fade', 0.34, 0.05) }) +
      label(U, th, 1330, 414, p.negative, { a: 'start', max: 18, an: U.A('fade', 0.36, 0.05) }) +
      label(U, th, 1250, GROUND_Y + 44, p.ground, { a: 'start', max: 18, an: U.A('fade', 0.46, 0.05) }) +
      label(U, th, 904, 548, p.lightning, { a: 'end', max: 14, an: U.A('fade', at + 0.02, 0.05) }) +
      label(U, th, 530, 612, p.thunder, { a: 'end', max: 14, an: U.A('fade', at + 0.2, 0.05) });
    return o;
  },
  init(g, p, c) {
    const q = (s) => g.querySelector('#' + c.id + s);
    return { at: moment(p.at, 0.56, 0.45, 0.75), bolt: q('bolt'), flash: q('flash'), rings: THUNDER.radii.map((_, k) => q('ring' + k)) };
  },
  render(l, st) {
    const p = l.p, at = st.at, f = (p - at) / 0.09;
    // The strike flickers a few times and then stays; the cloud lights up with it.
    const flicker = f < 0 ? 0.85 : f < 0.15 ? 1 : f < 0.3 ? 0.3 : f < 0.5 ? 1 : f < 0.62 ? 0.55 : 1;
    st.bolt.setAttribute('opacity', flicker.toFixed(2));
    st.flash.setAttribute('opacity', f >= 0 && f < 1 ? (flicker > 0.9 ? 0.32 * (1 - f) : 0.08).toFixed(3) : '0');
    st.rings.forEach((el, k) => {
      const q = span(p, at + 0.05 + 0.06 * k, at + 0.27 + 0.06 * k);
      el.setAttribute('r', n1(40 + (THUNDER.radii[k] - 40) * easeOut(q)));
      el.setAttribute('opacity', q > 0 ? (0.9 - 0.55 * q).toFixed(3) : '0');
    });
  },
});

/* ---------------------------------------------------------------------------------------------------------------
 * Ocean tides
 * ------------------------------------------------------------------------------------------------------------- */

// Seen from above: the Earth in the middle, the oceans around it, and the Moon's orbit. The water starts as an even
// layer and is pulled into two bulges along the line to the Moon, which then goes half way round (counterclockwise,
// as seen from above the North Pole) from the bottom to the top. Starting at the bottom also lets TemplateScene,
// which measures the picture at a few moments, see the Moon's lowest place, so the picture is placed clear of the
// captions.
const TIDE = { x: 960, y: 485, earth: 126, even: 158, a: 196, b: 138, from: Math.PI / 2, to: -Math.PI / 2 };
function tideAt(p) {
  const grow = smooth(span(p, 0.12, 0.22)), turn = smooth(span(p, 0.22, 0.84));
  return { a: TIDE.even + (TIDE.a - TIDE.even) * grow, b: TIDE.even + (TIDE.b - TIDE.even) * grow, angle: TIDE.from + (TIDE.to - TIDE.from) * turn };
}
// The Moon is big enough to hold its name, if the name is short.
const moonSize = (U, name) => clamp((name ? U.tw(name, 32, { w: 700 }) : 0) / 2 + 14, 46, 62);

register('ocean_tides', {
  cat: CD,
  title: 'Ocean tides',
  desc: 'The Earth seen from above, with the oceans pulled into two bulges: one on the side facing the Moon and one on the far side. The Moon goes round the Earth and the bulges follow it. Sizes and distances are not to scale.',
  use: 'Why the sea has tides, high and low tide, and how the Moon pulls on the oceans.',
  params: 'earth, moon, highTide, lowTide (labels, each optional)',
  example: { earth: 'Earth', moon: 'Moon', highTide: 'High tide', lowTide: 'Low tide' },
  build(p, c) {
    const { U, th } = c, id = c.id, T = TIDE, moon = say(p.moon), mr = moonSize(U, moon), orbit = 335 - mr - 14, fits = moon && U.tw(moon, 32, { w: 700 }) <= 2 * mr - 12;
    let o = `<circle cx="${T.x}" cy="${T.y}" r="${orbit}" fill="none" stroke="${th.muted}" stroke-width="3" stroke-dasharray="12 14" opacity="0"${U.A('fade', 0.06, 0.06)}/>`;
    o += `<g${U.A('fade', 0, 0.05)}><ellipse id="${id}water" cx="${T.x}" cy="${T.y}" rx="${T.even}" ry="${T.even}" fill="${SEA}"/>` +
      `<circle cx="${T.x}" cy="${T.y}" r="${T.earth}" fill="${th.surface}" stroke="${th.ink}" stroke-width="4"/>` + label(U, th, T.x, T.y + 12, p.earth, { max: 12, halo: 0 }) + '</g>';
    o += `<g id="${id}moon"><g${U.A('pop', 0.06, 0.05, { cx: 0, cy: 0 })}><circle r="${n1(mr)}" fill="${MOON}" stroke="${th.ink}" stroke-width="3"/>` +
      (fits ? U.T(0, 11, moon, { s: 32, w: 700, f: th.paperInk }) : label(U, th, mr + 14, 12, moon, { a: 'start', max: 14 })) + '</g></g>';
    // The names of the tides once the Moon has stopped above: high tide at both bulges, low tide at both sides.
    const L = T.x - orbit - 56, R = T.x + orbit + 56, tag = (text, ax, ay, x, y, a, at) => (say(text) ? `<g opacity="0"${U.A('fade', at, 0.05)}>${leader(th, ax, ay, a === 'end' ? x + 10 : x - 10, y - 11)}${label(U, th, x, y, text, { a, max: 14 })}</g>` : '');
    o += tag(p.highTide, T.x, T.y - T.a, R, T.y - 170, 'start', 0.86) + tag(p.highTide, T.x, T.y + T.a, L, T.y + 190, 'end', 0.86) +
      tag(p.lowTide, T.x - T.b, T.y, L, T.y + 12, 'end', 0.9) + tag(p.lowTide, T.x + T.b, T.y, R, T.y + 12, 'start', 0.9);
    return o;
  },
  init(g, p, c) {
    const q = (s) => g.querySelector('#' + c.id + s);
    return { water: q('water'), moon: q('moon'), orbit: 335 - moonSize(c.U, say(p.moon)) - 14 };
  },
  render(l, st) {
    const T = TIDE, s = tideAt(l.p);
    st.water.setAttribute('rx', n1(s.a));
    st.water.setAttribute('ry', n1(s.b));
    st.water.setAttribute('transform', `rotate(${((s.angle * 180) / Math.PI).toFixed(2)} ${T.x} ${T.y})`);
    st.moon.setAttribute('transform', `translate(${n1(T.x + st.orbit * Math.cos(s.angle))} ${n1(T.y + st.orbit * Math.sin(s.angle))})`);
  },
});

/* ---------------------------------------------------------------------------------------------------------------
 * Wind turbine
 * ------------------------------------------------------------------------------------------------------------- */

// The turbine seen from the front and a little from the side: the blades turn in a plane seen at an angle, so their
// tips trace an ellipse, and the nacelle behind the hub is cut open to show the shaft and the generator. A line
// carries the electricity from the generator down the tower and over two poles to three houses.
const WT = { hub: [520, 400], R: 230, squash: 0.42, ground: 780, gen: [735, 400], spinFrom: 0.12, spinTo: 0.3, flowFrom: 0.42, flowTo: 0.66 };
const HOUSES = [1420, 1580, 1740];
// The electricity's way: the cable from the generator along the nacelle and down the tower, then the line from the
// box at the tower's foot over the poles to the houses, sagging between them.
const POWER = (() => {
  const P = [[735, 432], [650, 446], [650, 735], [700, 735]];
  const sag = (a, b, d) => { for (let k = 1; k <= 16; k++) { const t = k / 16; P.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t + 4 * d * t * (1 - t)]); } };
  sag([700, 735], [960, 592], 30);
  sag([960, 592], [1240, 592], 46);
  sag([1240, 592], [1370, 700], 14);
  sag([1370, 700], [1530, 700], 12);
  sag([1530, 700], [1690, 700], 12);
  const L = lengths(P);
  // How far along the way each house is reached.
  const at = HOUSES.map((x) => { const i = P.findIndex((q) => q[0] >= x - 50 && q[1] >= 690); return L[Math.max(0, i)]; });
  return { P, L, at };
})();
// The rotor's angle at time t: it speeds up from a standstill to a steady turn, so the same time gives the same angle.
function rotorAngle(l) {
  const t0 = WT.spinFrom * l.dur, t1 = WT.spinTo * l.dur, w = 2.2;
  if (l.t <= t0) return 0;
  if (l.t < t1) return (w * Math.pow(l.t - t0, 2)) / (2 * (t1 - t0));
  return w * ((t1 - t0) / 2 + (l.t - t1));
}
const housePath = (x, y) => `M${x - 55} ${y}V${y - 80}H${x + 55}V${y}ZM${x - 68} ${y - 78}L${x} ${y - 138}L${x + 68} ${y - 78}Z`;

register('wind_turbine', {
  cat: CD,
  title: 'Wind turbine',
  desc: 'The wind turns the blades of a wind turbine, the turning shaft drives the generator inside it, and the electricity runs down the tower and along a power line to homes, which light up.',
  use: 'How wind power works, renewable energy, and how electricity gets from a power plant to homes.',
  params: 'wind, blades, generator, electricity, homes (labels, each optional)',
  example: { wind: 'Wind', blades: 'Blades', generator: 'Generator', electricity: 'Electricity', homes: 'Homes' },
  build(p, c) {
    const { U, th } = c, id = c.id, [hx, hy] = WT.hub, [gx, gy] = WT.gen;
    // The ground, reaching far past the frame, with its edge.
    let o = `<rect x="-2000" y="${WT.ground}" width="5920" height="3000" fill="${th.surface}" data-fm-bg="1"/><path d="M-2000 ${WT.ground}H3920" stroke="${th.muted}" stroke-width="4" data-fm-bg="1"/>`;
    // The wind: wavy lines blowing toward the rotor, their dashes moving with time.
    o += `<g opacity="0"${U.A('fade', 0.06, 0.06)}>` + [250, 335, 420, 505, 590].map((y, k) => {
      let d = '';
      for (let x = 90; x <= 400; x += 10) d += (x === 90 ? 'M' : 'L') + x + ' ' + n1(y + 12 * Math.sin((x + k * 70) / 42));
      return `<path id="${id}wind${k}" d="${d}" fill="none" stroke="${th.muted}" stroke-width="6" stroke-linecap="round" stroke-dasharray="70 46"/>`;
    }).join('') + '</g>';
    // The tower, the box at its foot, the poles and the line, and the houses with their windows.
    o += `<g${U.A('fade', 0, 0.05)}><path d="M640 446L660 446L672 ${WT.ground}L628 ${WT.ground}Z" fill="${th.ink}"/><rect x="684" y="735" width="44" height="${WT.ground - 735}" fill="${th.muted}"/>` +
      [960, 1240].map((x) => `<path d="M${x} ${WT.ground}V574M${x - 24} 592H${x + 24}" stroke="${th.muted}" stroke-width="6" stroke-linecap="round" fill="none"/>`).join('') +
      `<path d="${pathD(POWER.P.slice(3))}" fill="none" stroke="${th.muted}" stroke-width="3"/>` +
      HOUSES.map((x, k) => `<path d="${housePath(x, WT.ground)}" fill="${th.surface}" stroke="${th.ink}" stroke-width="4" stroke-linejoin="round"/>` +
        [-26, 26].map((dx, j) => `<rect x="${x + dx - 15}" y="${WT.ground - 62}" width="30" height="30" fill="${th.bg}" stroke="${th.ink}" stroke-width="3"/><rect id="${id}win${k}_${j}" x="${x + dx - 13.5}" y="${WT.ground - 60.5}" width="27" height="27" fill="${LAMP}" opacity="0"/>`).join('')).join('') + '</g>';
    // The nacelle, cut open: its casing, the shaft from the hub and the generator with its turning magnet.
    o += `<g${U.A('fade', 0, 0.05)}><rect x="530" y="360" width="262" height="86" rx="18" fill="${th.surface}" stroke="${th.ink}" stroke-width="4"/>` +
      `<path d="M${hx} ${hy}H${gx - 30}" stroke="${th.ink}" stroke-width="12"/><circle id="${id}coil" cx="${gx}" cy="${gy}" r="34" fill="${th.bg}" stroke="${th.ink}" stroke-width="6"/>` +
      `<g id="${id}mag"><rect x="${gx - 24}" y="${gy - 8}" width="24" height="16" fill="${PLUS}"/><rect x="${gx}" y="${gy - 8}" width="24" height="16" fill="${MINUS}"/></g>` +
      `<path d="${pathD(POWER.P.slice(0, 4))}" fill="none" stroke="${th.muted}" stroke-width="3"/></g>`;
    // The blades (drawn in render) and the hub in front of them.
    o += [0, 1, 2].map((k) => `<path id="${id}blade${k}" fill="${th.ink}" stroke="${th.bg}" stroke-width="2" stroke-linejoin="round"/>`).join('') +
      `<circle cx="${hx}" cy="${hy}" r="26" fill="${th.ink}" stroke="${th.bg}" stroke-width="3"/>`;
    // The electricity: bright dots running along the way once it flows.
    for (let k = 0; k < 40; k++) o += `<circle id="${id}e${k}" r="7" fill="${th.accent}" opacity="0"/>`;
    // The labels: the wind under its lines, the blades by the rotor, the generator above the nacelle, the electricity
    // above the line and the homes above the houses.
    o += label(U, th, 245, 668, p.wind, { max: 14, an: U.A('fade', 0.1, 0.05) }) +
      label(U, th, 390, 196, p.blades, { a: 'end', max: 14, an: U.A('fade', 0.2, 0.05) }) +
      (say(p.generator) ? `<g opacity="0"${U.A('fade', 0.32, 0.05)}>${leader(th, gx, gy - 34, 790, 292)}${label(U, th, 800, 300, p.generator, { a: 'start', max: 16 })}</g>` : '') +
      label(U, th, 1100, 548, p.electricity, { max: 18, an: U.A('fade', WT.flowFrom + 0.06, 0.05), up: true }) +
      label(U, th, HOUSES[1], 600, p.homes, { max: 18, an: U.A('fade', WT.flowTo + 0.04, 0.05), up: true });
    return o;
  },
  init(g, p, c) {
    const q = (s) => g.querySelector('#' + c.id + s);
    return { blades: [0, 1, 2].map((k) => q('blade' + k)), mag: q('mag'), coil: q('coil'), wind: [0, 1, 2, 3, 4].map((k) => q('wind' + k)), dots: Array.from({ length: 40 }, (_, k) => q('e' + k)), win: HOUSES.map((_, k) => [q(`win${k}_0`), q(`win${k}_1`)]) };
  },
  render(l, st, p, c) {
    const { th } = c, [hx, hy] = WT.hub, [gx, gy] = WT.gen, a = rotorAngle(l), spinning = l.p >= WT.spinTo;
    // Each blade tapers from the hub to its tip, which runs round the ellipse.
    st.blades.forEach((el, k) => {
      const b = a + (2 * Math.PI * k) / 3 - Math.PI / 2, tx = hx + WT.R * WT.squash * Math.cos(b), ty = hy + WT.R * Math.sin(b), len = Math.hypot(tx - hx, ty - hy) || 1, nx = -(ty - hy) / len, ny = (tx - hx) / len;
      el.setAttribute('d', `M${n1(hx + nx * 16)} ${n1(hy + ny * 16)}L${n1(tx + nx * 5)} ${n1(ty + ny * 5)}L${n1(tx - nx * 5)} ${n1(ty - ny * 5)}L${n1(hx - nx * 16)} ${n1(hy - ny * 16)}Z`);
    });
    st.mag.setAttribute('transform', `rotate(${((a * 180) / Math.PI).toFixed(2)} ${gx} ${gy})`);
    st.coil.setAttribute('stroke', spinning ? th.accent : th.ink);
    st.wind.forEach((el, k) => el.setAttribute('stroke-dashoffset', n1(-(l.t * 150 + k * 37))));
    // The electricity runs out from the generator as far as it has got, and keeps flowing; each house lights up as it
    // reaches it.
    const P = POWER, total = P.L[P.L.length - 1], front = total * smooth(span(l.p, WT.flowFrom, WT.flowTo));
    st.dots.forEach((el, k) => {
      const s = (l.t * 220 + k * 64) % (40 * 64);
      const show = l.p >= WT.flowFrom && s <= front && s <= total;
      el.setAttribute('opacity', show ? '1' : '0');
      if (show) { const pt = along(P.P, P.L, s); el.setAttribute('cx', n1(pt.x)); el.setAttribute('cy', n1(pt.y)); }
    });
    st.win.forEach((pair, k) => pair.forEach((el) => el.setAttribute('opacity', smooth((front - P.at[k] + 50) / 50).toFixed(3))));
  },
});
