import { COLORS, FONTS, MOTION } from "./theme.ts";

// The three looks a video can have, chosen by the director from the topic (Trym picked all three on Oct 18, 2026).
// A look is more than colors and fonts: it decides how icons and cards are drawn, what the ground looks like, how
// maps draw land, and how scenes come in and the camera moves. The app around the video keeps the Night atlas look
// from lib/theme.ts.

export const THEME_NAMES = ["night", "blueprint", "field"] as const;
export type ThemeName = (typeof THEME_NAMES)[number];

type CameraMove = { scale: readonly number[]; x: readonly number[]; y: readonly number[] };

export type Theme = {
  name: ThemeName;
  colors: {
    ink: string; // the ground and the sea
    land: string; // countries, cards and panels
    border: string; // borders, axis lines and card edges
    muted: string; // countries shown for context
    globe: string; // the sea on the globe in the opening
    paper: string; // main text
    dim: string; // secondary text
    signal: string; // the one thing to look at
    teal: string; // the second highlight
    alert: string; // struck out or wrong
    onSignal: string; // text on a signal-colored fill
    moon: string;
    moonSea: string;
    sun: string;
    mars: string;
    marsDark: string;
    captionBackground: string;
    captionText: string;
    captionUpcoming: string; // words the voice has not said yet
    marker: string; // the marker swept over a quote's words; the words on it are paper
  };
  fonts: {
    display: string;
    body: string;
    label: string;
    displayWeight: number; // headings; Young Serif comes in one weight only, and a faked bold smears
    // How big headings are set, compared with Night atlas. The scenes are laid out for Fraunces, and Young Serif is
    // about a fifth wider, so it is set smaller to take the same room instead of running into the corners.
    displayScale: number;
    displayItalic: boolean; // whether quotes are set in italic: only where the display font has a real italic
    year: { family: string; weight: number }; // the year in the top left corner
  };
  drawing: {
    // Icons and figures: flat shapes, outlines like a technical drawing, or ink outlines over a pale fill like a
    // field guide's plates.
    icon: "solid" | "outline" | "ink";
    stroke: number; // the outline's width in the icon's 100-unit grid
    radius: number; // corner radius of outlined boxes and tags, in pixels; Night atlas's flat panels stay square
    // Cards: flat panels, outlined boxes with corner ticks, or paper tags with a thin ink edge.
    card: "solid" | "outline" | "tag";
    // The ground: plain, a drawing grid, or paper.
    texture: "none" | "grid" | "paper";
    // Land on maps: filled countries, or only their outlines as in a technical drawing.
    land: "fill" | "outline";
  };
  motion: {
    // How a scene comes in over the one before: a dissolve, a wipe from left to right, or rising into place.
    transition: "dissolve" | "wipe" | "rise";
    camera: readonly CameraMove[]; // slow moves over each scene's picture, taken in turn
  };
};

const NIGHT: Theme = {
  name: "night",
  colors: {
    ink: COLORS.ink,
    land: COLORS.land,
    border: COLORS.border,
    muted: COLORS.muted,
    globe: COLORS.globe,
    paper: COLORS.paper,
    dim: COLORS.dim,
    signal: COLORS.signal,
    teal: COLORS.teal,
    alert: COLORS.alert,
    onSignal: COLORS.ink,
    moon: COLORS.moon,
    moonSea: COLORS.moonSea,
    sun: COLORS.sun,
    mars: COLORS.mars,
    marsDark: COLORS.marsDark,
    captionBackground: COLORS.captionBackground,
    captionText: COLORS.paper,
    captionUpcoming: COLORS.captionUpcoming,
    marker: "#61502B", // amber at a third, blended with the ink ground
  },
  fonts: {
    display: FONTS.display,
    body: FONTS.body,
    label: FONTS.body,
    displayWeight: 700,
    displayScale: 1,
    displayItalic: true,
    year: { family: FONTS.display, weight: 700 },
  },
  drawing: { icon: "solid", stroke: 0, radius: 14, card: "solid", texture: "none", land: "fill" },
  motion: { transition: "dissolve", camera: MOTION.sceneCamera },
};

// Cobalt, chalk lines and a drawing grid, like a technical drawing: for science, inventions, engineering and space.
const BLUEPRINT: Theme = {
  name: "blueprint",
  colors: {
    ink: "#14316E", // cobalt
    land: "#1A3A7C",
    border: "#2C4C8F", // the grid
    muted: "#24467F",
    globe: "#183A79",
    paper: "#EAF2FF", // chalk
    dim: "#8FA8D6",
    signal: "#FFD447", // signal yellow
    teal: "#5FD3F3", // cyan
    alert: "#FF8A7A",
    onSignal: "#14316E",
    moon: "#6F86B4",
    moonSea: "#3E5A92",
    sun: "#FFE08A",
    mars: "#E08A5E",
    marsDark: "#C4744E",
    captionBackground: "rgba(10, 30, 70, 0.86)",
    captionText: "#EAF2FF",
    captionUpcoming: "rgba(143, 168, 214, 0.62)",
    marker: "#2E5BA8", // a lighter cobalt, like a band shaded in on the drawing
  },
  fonts: {
    display: "var(--font-big-shoulders), 'Arial Narrow', sans-serif",
    body: "var(--font-plex-sans), Helvetica, Arial, sans-serif",
    label: "var(--font-plex-mono), ui-monospace, Menlo, monospace",
    displayWeight: 700,
    displayScale: 1,
    displayItalic: false,
    year: { family: "var(--font-plex-mono), ui-monospace, Menlo, monospace", weight: 600 },
  },
  drawing: { icon: "outline", stroke: 5, radius: 2, card: "outline", texture: "grid", land: "outline" },
  // Slow, even pans, like a camera on a rail over a drawing.
  motion: {
    transition: "wipe",
    camera: [
      { scale: [1.03, 1.03], x: [-18, 18], y: [0, 0] },
      { scale: [1.03, 1.03], x: [0, 0], y: [12, -12] },
      { scale: [1.03, 1.03], x: [18, -18], y: [0, 0] },
    ],
  },
};

// A light page with ink and two strong colors, like a field guide or a textbook plate: for nature, the body,
// health and climate.
const FIELD: Theme = {
  name: "field",
  colors: {
    ink: "#F7F9F6", // the page
    land: "#DCE6E2", // lichen
    border: "#9DB0A6",
    muted: "#C9D6D0",
    globe: "#C2D8DC", // a pale water tint, so the globe's lichen land stands out from its sea
    paper: "#18261E", // forest ink
    dim: "#5F7466",
    signal: "#2B44C7", // ultramarine
    teal: "#4F7A3A", // moss
    alert: "#B4432F",
    onSignal: "#F7F9F6",
    moon: "#B9C4BE",
    moonSea: "#93A39A",
    sun: "#E7A93B",
    mars: "#B4612F",
    marsDark: "#99512A",
    captionBackground: "rgba(247, 249, 246, 0.94)",
    captionText: "#18261E",
    captionUpcoming: "rgba(95, 116, 102, 0.62)",
    marker: "#D3DAF2", // a pale ultramarine, like a highlighter on the page
  },
  fonts: {
    display: "var(--font-young-serif), Georgia, serif",
    body: "var(--font-work-sans), Helvetica, Arial, sans-serif",
    label: "var(--font-work-sans), Helvetica, Arial, sans-serif",
    displayWeight: 400,
    displayScale: 0.85,
    displayItalic: false,
    year: { family: "var(--font-young-serif), Georgia, serif", weight: 400 },
  },
  drawing: { icon: "ink", stroke: 4, radius: 4, card: "tag", texture: "paper", land: "fill" },
  // Gentle push-ins, as when leaning in over a page.
  motion: {
    transition: "rise",
    camera: [
      { scale: [1, 1.04], x: [0, 0], y: [0, 0] },
      { scale: [1.01, 1.045], x: [0, 0], y: [6, -6] },
    ],
  },
};

export const THEMES: Record<ThemeName, Theme> = { night: NIGHT, blueprint: BLUEPRINT, field: FIELD };
