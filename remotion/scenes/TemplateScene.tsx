import { useId, useLayoutEffect, useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useDelayRender, useVideoConfig } from "remotion";
import type { TimedWord } from "@/lib/elevenlabs";
import { VIDEO } from "@/lib/theme";
import { TPL, makeU, prepAnims, runAnims } from "../filmmotor/engine";
import type { Anim, FilmTheme, Template, TemplateContext, TemplateParams } from "../filmmotor/engine";
import "../filmmotor/templates";
import { filmFontCss, filmTheme } from "../filmmotor/theme";
import { useTheme } from "../theme";
import { revealTimes, spokenAt } from "../spoken";

// Everything is in place this long before the scene ends, since the next scene dissolves in over its last moments.
const SETTLE_SEC = 0.8;
// A picture lands a moment before its word is heard, as in spoken.ts.
const LEAD_SEC = 0.2;
// Params that say when something happens, as a fraction of the scene from 0 to 1. A word can be given instead, and
// the thing then happens as the narration says it.
const TIMING_KEYS = new Set(["at", "highlightAt", "revealAt", "changeAt"]);
// The list in a template's params whose items come in one after another, and the field of each item that the
// narration says, so each item comes in as it is said instead of on the template's own beat. The templates read the
// times as `times` (one fraction of the scene per item); others keep their own timing.
const ITEM_LISTS: Record<string, { list: string; text?: string }> = {
  cycle: { list: "nodes", text: "text" },
  pyramid: { list: "levels", text: "label" },
  cause_chain: { list: "nodes", text: "text" },
  process_steps: { list: "nodes", text: "text" },
  icon_chain: { list: "nodes", text: "label" },
  layer_stack: { list: "layers", text: "label" },
  funnel: { list: "stages", text: "label" },
  tree_chart: { list: "children", text: "label" },
  bullet_list: { list: "items" },
  key_takeaways: { list: "items" },
  checklist_recap: { list: "items" },
  kinetic_words: { list: "words" },
  strike_replace: { list: "items", text: "text" },
  stat_trio: { list: "stats", text: "label" },
  cutaway: { list: "items", text: "label" },
  journey: { list: "stations", text: "label" },
  forces: { list: "forces", text: "label" },
  food_chain: { list: "chain", text: "label" },
};
// The free part of the frame: below the notes in the top corners, above the captions, a little in from the sides.
const FREE = { left: 40, top: VIDEO.topSpace, right: VIDEO.width - 40, bottom: VIDEO.height - VIDEO.captionSpace };
// How much bigger than its settled size an element gets at the top of the engine's pop animation.
const POP_OVERSHOOT = 1.1;
// The moments (progress through the scene) a template with its own render hook is measured at, close enough together
// that a part swinging out between two of them (an orbiting Moon) is not missed.
const MOTION_SAMPLES = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];

type Box = { left: number; top: number; right: number; bottom: number };
type Built = { template: Template; params: TemplateParams; ctx: TemplateContext; markup: string };
type Live = { anims: Anim[]; state: unknown; broken: boolean };

// One of the film engine's animated templates (remotion/filmmotor), drawn in the Night atlas style. The template is
// placed so it stays clear of the captions and the corner notes, scaled down if it does not fit. Its animations run
// over the scene up to its last 0.8 seconds, so everything has settled before the next scene dissolves in.
export function TemplateScene({
  template,
  params,
  words,
  durationSec,
}: {
  template: string;
  params: TemplateParams;
  words: TimedWord[];
  durationSec: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { delayRender, continueRender } = useDelayRender();
  // Element IDs must be unique on the page, also while two template scenes overlap in a dissolve.
  const id = `fm${useId().replace(/[^A-Za-z0-9]/g, "")}_`;
  const activeSec = Math.max(0.1, durationSec - SETTLE_SEC);
  const time = frame / fps;
  const progress = Math.min(1, Math.max(0, time / activeSec));
  // The template is drawn in the video's look.
  const theme = useTheme();
  const film = useMemo(() => filmTheme(theme), [theme]);
  const built = useMemo(() => buildTemplate(template, params, words, activeSec, id, film), [template, params, words, activeSec, id, film]);
  const placeRef = useRef<SVGGElement>(null);
  const rootRef = useRef<SVGGElement>(null);
  const liveRef = useRef<Live | null>(null);
  const nowRef = useRef({ progress: 0, time: 0 });

  // Once per template and params: draws it, measures it as it looks when settled, and places it in the free area. A
  // template with its own motion (a swinging pendulum, orbiting planets) is measured at a few more moments too.
  useLayoutEffect(() => {
    const root = rootRef.current;
    const place = placeRef.current;
    if (!root || !place || !built) return;
    root.innerHTML = built.markup;
    const live = mount(built, root);
    liveRef.current = live;
    const placeIt = () => {
      let box: Box | null = null;
      try {
        for (const sample of built.template.render ? MOTION_SAMPLES : [1]) {
          draw(built, live, root, sample, sample * activeSec, activeSec);
          box = union(box, measureContent(root));
        }
      } catch (error) {
        box = null;
        console.error(`The template "${built.template.name}" could not be measured, so it is not placed.`, error);
      }
      place.setAttribute("transform", box ? fitInto(box) : "");
      draw(built, live, root, nowRef.current.progress, nowRef.current.time, activeSec);
    };
    placeIt();
    // Text measured before its font has loaded has the wrong width, so it is measured again once the fonts are in.
    let handle: number | null = null;
    let gone = false;
    const release = () => {
      if (handle !== null) continueRender(handle);
      handle = null;
    };
    if (document.fonts.status === "loading") {
      handle = delayRender("Waiting for the fonts to place a template scene");
      document.fonts.ready.then(() => {
        if (!gone) placeIt();
        release();
      });
    }
    return () => {
      gone = true;
      release();
      liveRef.current = null;
      root.innerHTML = "";
    };
  }, [built, activeSec, delayRender, continueRender]);

  // Every frame: the animations and the template's own motion at this moment. The same frame always looks the same.
  useLayoutEffect(() => {
    nowRef.current = { progress, time };
    const root = rootRef.current;
    const live = liveRef.current;
    if (root && built && live) draw(built, live, root, progress, time, activeSec);
  }, [built, progress, time, activeSec]);

  return (
    <AbsoluteFill>
      <svg className="film-template" viewBox={`0 0 ${VIDEO.width} ${VIDEO.height}`} width="100%" height="100%">
        <style>{filmFontCss(theme)}</style>
        <g ref={placeRef}>
          <g ref={rootRef} />
        </g>
      </svg>
    </AbsoluteFill>
  );
}

// The template's SVG markup with its defaults filled in, or null for a template that does not exist or fails to draw.
function buildTemplate(name: string, params: TemplateParams, words: TimedWord[], activeSec: number, id: string, film: FilmTheme): Built | null {
  const template = Object.hasOwn(TPL, name) ? TPL[name] : undefined;
  if (!template) {
    console.error(`There is no template called "${name}".`);
    return null;
  }
  const merged = timedParams({ ...template.defaults, ...params }, words, activeSec) as TemplateParams;
  const times = itemTimes(name, merged, words, activeSec);
  if (times) merged.times = times;
  const ctx: TemplateContext = { id, th: film, U: makeU(film), data: {} };
  try {
    return { template, params: merged, ctx, markup: template.build(merged, ctx) };
  } catch (error) {
    console.error(`The template "${name}" could not be drawn with these params.`, error);
    return null;
  }
}

// A copy of the params where every timing given as a word becomes the point in the scene where the narration says
// it. A word the narration never says leaves the template's own timing.
function timedParams(value: unknown, words: TimedWord[], activeSec: number): unknown {
  if (Array.isArray(value)) return value.map((item) => timedParams(item, words, activeSec));
  if (!value || typeof value !== "object") return value;
  const copy: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (TIMING_KEYS.has(key) && typeof item === "string") {
      const saidSec = spokenAt(words, item);
      if (saidSec !== null) copy[key] = Math.min(0.95, Math.max(0, (saidSec - LEAD_SEC) / activeSec));
    } else {
      copy[key] = timedParams(item, words, activeSec);
    }
  }
  return copy;
}

// When each item of a template's list comes in, as a fraction of the scene: a moment before the narration says it, in
// order, or spread over the scene when it never says it (see revealTimes). Undefined for a template without such a list.
function itemTimes(name: string, params: TemplateParams, words: TimedWord[], activeSec: number): number[] | undefined {
  const spec = Object.hasOwn(ITEM_LISTS, name) ? ITEM_LISTS[name] : undefined;
  const items = spec ? params[spec.list] : undefined;
  if (!spec || !Array.isArray(items) || items.length === 0) return undefined;
  const texts = items.map((item) => String((spec.text && item && typeof item === "object" ? (item as Record<string, unknown>)[spec.text] : item) ?? ""));
  const seconds = revealTimes(texts, words, { firstSec: 0.3, spreadSec: activeSec * 0.7, gapSec: 0.35, durationSec: activeSec + SETTLE_SEC });
  return seconds.map((sec) => Math.min(0.95, Math.max(0, sec / activeSec)));
}

// Collects the animated elements of freshly drawn markup and runs the template's own setup.
function mount(built: Built, root: SVGGElement): Live {
  const anims = prepAnims(root);
  try {
    return { anims, state: built.template.init?.(root, built.params, built.ctx) ?? null, broken: false };
  } catch (error) {
    console.error(`The template "${built.template.name}" could not start.`, error);
    return { anims, state: null, broken: true };
  }
}

function draw(built: Built, live: Live, root: SVGGElement, progress: number, time: number, activeSec: number) {
  runAnims(live.anims, progress, time);
  if (!built.template.render || live.broken) return;
  try {
    built.template.render({ t: time, p: progress, dur: activeSec, start: 0, end: activeSec }, live.state, built.params, built.ctx, root);
  } catch (error) {
    // A template that fails once stops drawing its own motion, instead of failing on every frame.
    live.broken = true;
    console.error(`The template "${built.template.name}" failed while drawing.`, error);
  }
}

// The box around everything visible in a drawn template, in its own 1920 x 1080 units. Backgrounds (marked
// data-fm-bg), hidden and empty elements and definitions are left out, and a clip path cuts an element down.
function measureContent(root: SVGGElement): Box | null {
  const rootMatrix = root.getCTM();
  if (!rootMatrix) return null;
  const toRoot = rootMatrix.inverse();
  let box: Box | null = null;
  for (const element of root.querySelectorAll<SVGGraphicsElement>("path, rect, circle, ellipse, line, polyline, polygon, text, image, use")) {
    if (element.closest("defs, clipPath, mask, pattern, marker, symbol, [data-fm-bg]") || !isVisible(element, root)) continue;
    if (element instanceof SVGTextElement && !element.textContent?.trim()) continue;
    const local = element.getBBox();
    const matrix = element.getCTM();
    if (!matrix || (local.width === 0 && local.height === 0)) continue;
    const m = toRoot.multiply(matrix);
    let own: Box | null = null;
    // A pop overshoots by about a tenth before it settles, so a popping element counts a tenth bigger around the
    // point it pops from.
    const pop = element.closest<SVGGraphicsElement>('[data-an="pop"]');
    const popMatrix = pop?.getCTM();
    const popAt = pop && popMatrix ? apply(toRoot.multiply(popMatrix), Number(pop.dataset.cx), Number(pop.dataset.cy)) : null;
    // An element that moves into place also counts where it starts from.
    const move = element.closest<SVGGraphicsElement>('[data-an="move"]');
    const moveMatrix = move?.getCTM();
    const startOffsets = [[0, 0]];
    if (move && moveMatrix) {
      const mm = toRoot.multiply(moveMatrix);
      const dx = Number(move.dataset.x0) - Number(move.dataset.x1);
      const dy = Number(move.dataset.y0) - Number(move.dataset.y1);
      startOffsets.push([mm.a * dx + mm.c * dy, mm.b * dx + mm.d * dy]);
    }
    for (const [x, y] of [
      [local.x, local.y],
      [local.x + local.width, local.y],
      [local.x, local.y + local.height],
      [local.x + local.width, local.y + local.height],
    ]) {
      let { x: px, y: py } = apply(m, x, y);
      if (popAt) {
        px = popAt.x + (px - popAt.x) * POP_OVERSHOOT;
        py = popAt.y + (py - popAt.y) * POP_OVERSHOOT;
      }
      for (const [ox, oy] of startOffsets) own = union(own, { left: px + ox, top: py + oy, right: px + ox, bottom: py + oy });
    }
    const clip = clipBox(element, toRoot);
    if (own && clip) {
      own = { left: Math.max(own.left, clip.left), top: Math.max(own.top, clip.top), right: Math.min(own.right, clip.right), bottom: Math.min(own.bottom, clip.bottom) };
      if (own.right <= own.left || own.bottom <= own.top) continue;
    }
    box = union(box, own);
  }
  return box;
}

// The box of the clip path an element is drawn through, if any, in the template's units.
function clipBox(element: Element, toRoot: DOMMatrix): Box | null {
  const clipped = element.closest<SVGGraphicsElement>("[clip-path]");
  const id = clipped?.getAttribute("clip-path")?.match(/url\(#([^)]+)\)/)?.[1];
  const shape = id ? (clipped?.ownerDocument.getElementById(id)?.firstElementChild as SVGGraphicsElement | null) : null;
  const matrix = clipped?.getCTM();
  if (!shape || !matrix) return null;
  const s = shape.getBBox();
  const m = toRoot.multiply(matrix);
  let box: Box | null = null;
  for (const [x, y] of [
    [s.x, s.y],
    [s.x + s.width, s.y],
    [s.x, s.y + s.height],
    [s.x + s.width, s.y + s.height],
  ]) {
    const p = apply(m, x, y);
    box = union(box, { left: p.x, top: p.y, right: p.x, bottom: p.y });
  }
  return box;
}

function union(a: Box | null, b: Box | null): Box | null {
  if (!a || !b) return a ?? b;
  return { left: Math.min(a.left, b.left), top: Math.min(a.top, b.top), right: Math.max(a.right, b.right), bottom: Math.max(a.bottom, b.bottom) };
}

// A point through a matrix. getCTM gives an SVGMatrix, which has no transformPoint in every browser.
function apply(m: DOMMatrix, x: number, y: number) {
  return { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f };
}

function isVisible(element: Element, root: Element): boolean {
  for (let node: Element | null = element; node && node !== root; node = node.parentElement) {
    const opacity = node.getAttribute("opacity");
    if ((opacity !== null && Number(opacity) < 0.02) || node.getAttribute("display") === "none") return false;
  }
  return true;
}

// Where the template goes: scaled down only if it does not fit the free area, centered in it from top to bottom, and
// from side to side kept where the template put it, pushed inside the free area if it sticks out.
function fitInto(box: Box): string {
  const scale = Math.min(1, (FREE.right - FREE.left) / (box.right - box.left), (FREE.bottom - FREE.top) / (box.bottom - box.top));
  const dy = (FREE.top + FREE.bottom) / 2 - ((box.top + box.bottom) / 2) * scale;
  let dx = (VIDEO.width / 2) * (1 - scale);
  const left = box.left * scale + dx;
  const right = box.right * scale + dx;
  if (left < FREE.left) dx += FREE.left - left;
  else if (right > FREE.right) dx -= right - FREE.right;
  return `translate(${dx.toFixed(1)} ${dy.toFixed(1)}) scale(${scale.toFixed(4)})`;
}
