import type { Theme } from "@/lib/themes";
import type { FilmTheme } from "./engine";
import { filmClass, filmFontCss } from "./theme";

// Measures text on a look's real fonts, for the engine's text widths (see U.tw in engine.js), so a highlight, a strike
// line or a box drawn from a width fits its words. The text is set in a hidden SVG with the same font rules as the
// templates, so it is measured exactly as it is drawn. Only used once the look's fonts have loaded (filmFontsReady);
// before that, and outside the browser, the engine keeps its estimate.
const SVG = "http://www.w3.org/2000/svg";
const boxes = new Map<string, SVGTextElement>();
// Widths already measured, per look: a template asks for the same words at the same sizes many times while it fits.
const widths = new Map<string, Map<string, number>>();
// The weights and styles the templates draw text in.
const FACES = [
  [400, false],
  [600, false],
  [700, false],
  [800, false],
  [400, true],
  [700, true],
] as const;

function box(theme: Theme): SVGTextElement {
  const known = boxes.get(theme.name);
  if (known?.isConnected) return known;
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("class", filmClass(theme));
  svg.setAttribute("aria-hidden", "true");
  svg.style.cssText = "position:absolute;left:-10000px;top:0;width:10px;height:10px;overflow:hidden;visibility:hidden;pointer-events:none";
  const style = document.createElementNS(SVG, "style");
  style.textContent = filmFontCss(theme);
  const text = document.createElementNS(SVG, "text");
  // A space at either end counts, as it does in the engine's estimate: "word " is a word and the gap after it.
  text.style.whiteSpace = "pre";
  svg.append(style, text);
  document.body.append(svg);
  boxes.set(theme.name, text);
  widths.set(theme.name, new Map());
  return text;
}

function setFont(text: SVGTextElement, family: string, size: number, weight: number, italic: boolean, spacing?: number) {
  text.setAttribute("font-family", family);
  text.setAttribute("font-size", String(size));
  text.setAttribute("font-weight", String(weight));
  if (italic) text.setAttribute("font-style", "italic");
  else text.removeAttribute("font-style");
  if (spacing) text.setAttribute("letter-spacing", String(spacing));
  else text.removeAttribute("letter-spacing");
}

// The CSS font shorthand the hidden text is drawn with, for loading its font.
function fontOf(text: SVGTextElement): string {
  const style = getComputedStyle(text);
  return `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
}

export function textMeasurer(theme: Theme): FilmTheme["measure"] {
  return (content, size, options) => {
    if (typeof document === "undefined") return undefined;
    const text = box(theme);
    const known = widths.get(theme.name)!;
    const key = `${options.fam === "d" ? "d" : "t"}|${size}|${options.w || 400}|${options.it ? 1 : 0}|${options.ls || 0}|${content}`;
    const width = known.get(key);
    if (width !== undefined) return width;
    setFont(text, options.fam === "d" ? "MekoDisplay" : "MekoText", size, options.w || 400, Boolean(options.it), options.ls);
    text.textContent = content;
    const measured = text.getComputedTextLength();
    known.set(key, measured);
    return measured;
  };
}

// The looks whose fonts have loaded, or failed for good, and the loads under way. The browser's own check is not
// enough: Safari counts a font that is still downloading as ready, and would have text measured on its fallback.
const ready = new Set<string>();
const loading = new Map<string, Promise<void>>();

// Whether the fonts a look's templates use (display and text, in every weight and style they are drawn in) have
// loaded, so a template can be measured on them from its first frame.
export function filmFontsLoaded(theme: Theme): boolean {
  return ready.has(theme.name);
}

// Loads those fonts, once per look. Resolves when they are in, or have failed, in which case the browser's fallback is
// what is drawn, so it is what is measured.
export function filmFontsReady(theme: Theme): Promise<void> {
  if (typeof document === "undefined" || ready.has(theme.name)) return Promise.resolve();
  const known = loading.get(theme.name);
  if (known) return known;
  const text = box(theme);
  const loads: Promise<unknown>[] = [];
  for (const family of ["MekoDisplay", "MekoText"]) {
    for (const [weight, italic] of FACES) {
      setFont(text, family, 40, weight, italic);
      loads.push(document.fonts.load(fontOf(text)).catch(() => []));
    }
  }
  const done = Promise.all(loads).then(() => {
    ready.add(theme.name);
    // Nothing is measured before a look is ready, but a width cached on a fallback would be wrong from now on.
    widths.get(theme.name)?.clear();
  });
  loading.set(theme.name, done);
  return done;
}
