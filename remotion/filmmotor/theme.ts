import { isIconName } from "@/lib/icons";
import type { Theme } from "@/lib/themes";
import { iconShapes } from "../icons";
import { alpha } from "../theme";
import { markupOf } from "../svg-markup";
import type { FilmTheme } from "./engine";

// The film engine's look, built from the video's look (lib/themes.ts): its ground, cards, text and the two
// highlights, so a template fits the scenes around it in Night atlas, Blueprint or Field guide alike.
export function filmTheme(theme: Theme): FilmTheme {
  const { colors } = theme;
  // A sheet of paper, like a document or a portrait card, is the text color on the dark looks. On the light Field
  // guide page it is white with ink text, so it still stands out from the page.
  const light = theme.name === "field";
  return {
    bg: colors.ink,
    surface: colors.land,
    ink: colors.paper,
    muted: colors.dim,
    accent: colors.signal,
    accent2: colors.teal,
    good: colors.teal,
    warn: colors.signal,
    bad: colors.alert,
    line: colors.border,
    paper: light ? "#FFFFFF" : colors.paper,
    paperInk: light ? colors.paper : colors.ink,
    series: [colors.signal, colors.teal, colors.alert, colors.paper, colors.dim, colors.mars],
    // The SVG text is tagged with these family names, and filmFontCss points them at the look's fonts.
    fontDisplay: "MekoDisplay, Georgia, serif",
    fontText: "MekoText, Helvetica, Arial, sans-serif",
    fontMono: "MekoMono, ui-monospace, Menlo, monospace",
    upper: false,
    radius: theme.name === "night" ? 6 : theme.drawing.radius,
    // How wide the look's fonts are next to Fraunces and Archivo, which the engine's text widths were measured on:
    // Big Shoulders is condensed, Young Serif and Work Sans run a little wide.
    widthScale: theme.name === "blueprint" ? { display: 0.78, text: 1 } : light ? { display: 1.1, text: 1.04 } : { display: 1, text: 1 },
    // Cards as the look draws its own: chalk-edged boxes on the drawing in Blueprint, lichen tags with a thin ink edge
    // in Field guide, flat panels in Night atlas.
    card:
      theme.drawing.card === "outline"
        ? { fill: colors.ink, stroke: alpha(colors.paper, 0.7), width: 3 }
        : theme.drawing.card === "tag"
          ? { fill: colors.land, stroke: alpha(colors.paper, 0.6), width: 2 }
          : undefined,
    // Meko's own icons, drawn in the look's style (flat, outlined or inked); the engine's icons for any other name.
    iconMarkup: (name, fill, size) => (isIconName(name) ? markupOf(iconShapes({ name, size, color: fill, cut: colors.ink, theme })) : undefined),
  };
}

// An SVG font-family attribute cannot use the CSS variables next/font sets, but a CSS rule can, and a rule beats the
// attribute. A font without a real bold or italic, like Young Serif, is never faked, since a faked bold smears. Used
// inside an <svg class="film-template">.
export function filmFontCss(theme: Theme): string {
  return (
    `.film-template [font-family^="MekoDisplay"]{font-family:${theme.fonts.display};font-synthesis:none}` +
    `.film-template [font-family^="MekoText"]{font-family:${theme.fonts.body}}` +
    `.film-template [font-family^="MekoMono"]{font-family:${theme.fonts.label}}`
  );
}
