// Types for engine.js, the film engine core (Trym's code, adapted for Meko).

// The look every template is drawn in, built from the video's look in theme.ts.
export type FilmTheme = {
  bg: string; // the ground
  surface: string; // cards, panels and other filled shapes
  ink: string; // text and strong lines
  muted: string; // secondary text
  accent: string; // the main highlight
  accent2: string; // the second highlight
  good: string; // yes, true, supported, a rise
  warn: string; // partly, uncertain
  bad: string; // no, false, a fall
  line: string; // thin lines and borders
  paper: string; // sheets of paper: documents, letters, receipts, portraits
  paperInk: string; // text on paper
  series: string[]; // colors for the series of a chart, in order
  fontDisplay: string;
  fontText: string;
  fontMono: string;
  upper: boolean; // labels in capitals
  radius: number; // corner radius of cards
  widthScale?: { display: number; text: number }; // how wide the fonts are next to Fraunces and Archivo
  // How cards are drawn in the look: their fill, and an edge (Blueprint's chalk boxes, Field guide's paper tags).
  card?: { fill: string; stroke: string; width: number };
  // The markup of an icon on its 100 x 100 grid, drawn the video's way, or undefined to use the engine's own icon.
  iconMarkup?: (name: string, fill: string, size: number) => string | undefined;
};

export type TemplateParams = Record<string, unknown>;

// Text options for Helpers.T: anchor (a), font (fam: "d" for the display font), size (s), weight (w), fill (f),
// letter spacing (ls), italic (it), id, an animation (an, from Helpers.A), opacity (op) and extra attributes (ex).
export type TextOptions = {
  a?: "start" | "middle" | "end";
  fam?: "d";
  s?: number;
  w?: number;
  f?: string;
  ls?: number;
  it?: boolean;
  id?: string;
  an?: string;
  op?: number;
  ex?: string;
  halo?: number; // outline width in the ground color, for text that crosses lines
};

// The drawing helpers a template gets as ctx.U.
export type Helpers = {
  W: number;
  H: number;
  th: FilmTheme;
  ICONS: Record<string, string>;
  clamp(x: number, a: number, b: number): number;
  prog(t: number, a: number, b: number): number;
  lerp(a: number, b: number, p: number): number;
  ease: { io(x: number): number; out(x: number): number; back(x: number): number };
  esc(s: unknown): string;
  wrap(text: string, max: number): string[];
  fmtNum(value: number, decimals?: number, sep?: string): string;
  lab(s: unknown): string;
  fam(f?: string): string;
  A(an: string, at: number, d?: number, extra?: Record<string, string | number>): string;
  T(x: number | string, y: number | string, text: unknown, options?: TextOptions): string;
  tw(text: unknown, size: number, options?: Pick<TextOptions, "fam" | "w" | "it">): number; // estimated text width
  icon(name: string, x: number, y: number, size: number, fill: string, extra?: string): string;
  popIcon(name: string, x: number, y: number, size: number, fill: string, at: number, d?: number): string;
  bg(fill?: string): string;
  card(x: number, y: number, w: number, h: number, options?: { r?: number; f?: string; s?: string; sw?: number; an?: string }): string;
  cw(size: number, f?: string): number;
};

// What build, init and render get: a prefix that makes element IDs unique, the theme and the helpers.
export type TemplateContext = { id: string; th: FilmTheme; U: Helpers; data: Record<string, unknown> };

// The moment a render hook draws: t seconds since the scene started and p the progress from 0 to 1 over the `dur`
// seconds from `start` to `end`.
export type LocalTime = { t: number; p: number; dur: number; start: number; end: number };

export type Template = {
  name: string;
  base?: string; // set for a preset: the template it copies
  cat: string; // category, like "Charts" or "Science"
  title: string;
  desc: string; // what it shows
  use: string; // when it fits
  params: string; // the params it takes, as a short description
  example?: TemplateParams;
  defaults?: TemplateParams;
  ownCamera?: boolean;
  build(params: TemplateParams, ctx: TemplateContext): string;
  init?(root: SVGGElement, params: TemplateParams, ctx: TemplateContext): unknown;
  render?(local: LocalTime, state: unknown, params: TemplateParams, ctx: TemplateContext, root: SVGGElement): void;
};

// One animated element, as prepAnims collects it.
export type Anim = { readonly e: Element; readonly an: string; readonly at: number; readonly d: number };

export const ICONS: Record<string, string>;
export const TPL: Record<string, Template>;
export const H: Record<string, (...args: never[]) => unknown>;
export const util: Pick<Helpers, "clamp" | "prog" | "lerp" | "ease" | "esc" | "wrap" | "fmtNum" | "W" | "H">;
export function makeU(th: FilmTheme): Helpers;
export function register(name: string, tpl: Omit<Template, "name">): void;
export function preset(name: string, base: string, meta: Partial<Template>): void;
export function prepAnims(root: Element): Anim[];
export function runAnims(list: Anim[], p: number, t: number): void;
