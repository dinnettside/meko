import type { CSSProperties } from "react";

// The look of Meko in one place: colors, fonts, sizes, spacing and motion, for both the app and the videos.
// "Night atlas": a deep navy ground, slate land, warm paper text, one amber signal color for the thing to
// look at, and teal as the second highlight.

export const COLORS = {
  ink: "#0F1B2D", // background and sea
  land: "#22334B", // countries
  border: "#3A4F6E", // country borders, axis lines and input borders
  muted: "#3E5573", // countries shown for context
  globe: "#15263D", // the sea on the globe in the opening, a little lighter than the background
  paper: "#F4F1EA", // main text
  dim: "#93A1B5", // secondary text
  signal: "#FFB627", // the one thing to look at
  teal: "#4FC3B4", // second highlight
  alert: "#FF7A6B", // errors and removed sentences
  moon: "#5E6D83", // the Moon's highlands in space scenes
  moonSea: "#33425A", // the Moon's seas, darker, like the real ones
  sun: "#F7CF6E", // the Sun, warm but softer than the signal amber
  mars: "#B8603F",
  marsDark: "#A2533A", // Mars's darker ground
  captionBackground: "rgba(6, 12, 22, 0.82)",
  captionUpcoming: "rgba(147, 161, 181, 0.6)", // words the voice has not said yet
};

// The fonts are loaded by next/font in app/layout.tsx, which sets these CSS variables.
export const FONTS = {
  display: "var(--font-fraunces), Georgia, serif", // headings
  body: "var(--font-archivo), Helvetica, Arial, sans-serif", // everything else
};

// Sizes and spacing inside the 1920 x 1080 video frame, in pixels.
export const VIDEO = {
  width: 1920,
  height: 1080,
  sideMargin: 220, // left and right padding of title and text scenes
  captionSpace: 260, // room kept free for captions at the bottom
  topSpace: 150, // room kept free at the top for the year and the sources in the corners
  captionBottom: 120, // distance from the caption box to the bottom edge
  mapPadding: 240, // left and right padding when the camera fits countries
  fontSize: {
    title: 136,
    subtitle: 54,
    keyLine: 96, // the first line of a text scene
    line: 64,
    caption: 50,
    mapLabel: 38,
    mapLabelStrong: 46,
    year: 64,
    focusYear: 92,
    eventLabel: 40,
    eventLabelSmall: 32, // event labels when a long one would run into the next
    eraLabel: 30, // the name and years of a period on a timeline
  },
};

// Sizes in a drawing the director made (remotion/scenes/DrawingScene.tsx), in pixels. lib/drawing.ts uses them too,
// to place each label beside its part.
export const DRAWING = {
  titleSize: 60,
  labelSize: 38,
  labelGap: 16, // between a label and the part it names
  tubeWidth: 36,
  iconSizes: { small: 110, medium: 170, large: 240 },
};

// Animation timings, in seconds.
export const MOTION = {
  sceneFade: 0.35, // fade in and out of every scene
  entrance: 0.6, // how long a line or label takes to appear
  stagger: 0.5, // time between lines appearing
  cameraMove: 1.8, // map camera easing in
  // Slow moves over a scene's whole length, so no scene feels like a still screen: a push in, a pull back, drifts
  // to the side and up. Scale is a factor, x and y are pixels, each from the start of the scene to its end. Scenes
  // take them in turn, so two scenes in a row never move the same way.
  sceneCamera: [
    { scale: [1, 1.045], x: [0, 0], y: [0, 0] },
    { scale: [1.03, 1.03], x: [16, -16], y: [0, 0] },
    { scale: [1.045, 1], x: [0, 0], y: [0, 0] },
    { scale: [1.03, 1.03], x: [-16, 16], y: [0, 0] },
    { scale: [1.035, 1.035], x: [0, 0], y: [12, -12] },
  ],
};

// The app around the videos, "Editorial" (picked by Trym on Oct 19, 2026): black and white like a well-sourced
// article, in a light and a dark mode, so the videos' own looks stand out. One accent, a highlighter yellow, marks what
// is being said and quoted, like the marker that sweeps over a source's words in the videos.
export const APP_COLORS = {
  light: {
    bg: "#FFFFFF", // the page
    fg: "#111111", // text and the main button
    muted: "#6F6F6F", // secondary text
    rule: "#E6E6E6", // lines and borders
    surface: "#F5F5F5", // fields and cards
    mark: "#FFE45C", // the highlighter, always with dark text on it
    ok: "#1F7A4D", // supported sentences
    warn: "#A15C00", // revised sentences
    bad: "#B42318", // removed sentences and errors
  },
  dark: {
    bg: "#0B0B0B",
    fg: "#F2F2F2",
    muted: "#A0A0A0",
    rule: "#262626",
    surface: "#151515",
    mark: "#FFE45C",
    ok: "#5BC08A",
    warn: "#E0A04A",
    bad: "#F07167",
  },
};

// The app's fonts, loaded by next/font in app/layout.tsx: Newsreader for headings, Geist for everything else and Geist
// Mono for numbers like times and costs.
export const APP_FONTS = {
  serif: "var(--font-newsreader), Georgia, serif",
  sans: "var(--font-geist), Helvetica, Arial, sans-serif",
  mono: "var(--font-geist-mono), ui-monospace, monospace",
};

// The app's colors as CSS variables: light by default, dark when the system asks for it, and either one when the
// reader picks it with the switch in the header (data-theme on <html>).
export function appThemeCss(): string {
  const vars = (colors: Record<string, string>) => Object.entries(colors).map(([name, value]) => `--${name}:${value};`).join("");
  return (
    `:root{${vars(APP_COLORS.light)}color-scheme:light;}` +
    `@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){${vars(APP_COLORS.dark)}color-scheme:dark;}}` +
    `:root[data-theme="dark"]{${vars(APP_COLORS.dark)}color-scheme:dark;}`
  );
}

// The colors of the Night atlas look as CSS variables, for the parts of the app that draw in the video's style.
export const cssVariables = {
  "--ink": COLORS.ink,
  "--land": COLORS.land,
  "--border": COLORS.border,
  "--paper": COLORS.paper,
  "--dim": COLORS.dim,
  "--signal": COLORS.signal,
  "--teal": COLORS.teal,
  "--alert": COLORS.alert,
} as CSSProperties;
