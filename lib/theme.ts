import type { CSSProperties } from "react";

// The look of Meko in one place: colors, fonts, sizes, spacing and motion, for both the app and the videos.
// "Night atlas": a deep navy ground, slate land, warm paper text, one amber signal color for the thing to
// look at, and teal as the second highlight.

export const COLORS = {
  ink: "#0F1B2D", // background and sea
  land: "#22334B", // countries
  border: "#3A4F6E", // country borders, axis lines and input borders
  muted: "#3E5573", // countries shown for context
  paper: "#F4F1EA", // main text
  dim: "#93A1B5", // secondary text
  signal: "#FFB627", // the one thing to look at
  teal: "#4FC3B4", // second highlight
  alert: "#FF7A6B", // errors and removed sentences
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
  },
};

// Animation timings, in seconds.
export const MOTION = {
  sceneFade: 0.35, // fade in and out of every scene
  entrance: 0.6, // how long a line or label takes to appear
  stagger: 0.5, // time between lines appearing
  cameraMove: 1.8, // map camera easing in
};

// The colors as CSS variables for the app. app/globals.css maps them to Tailwind classes like bg-ink.
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
