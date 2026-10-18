import { createContext, useContext } from "react";
import { interpolateColors } from "remotion";
import { THEMES } from "@/lib/themes";
import type { Theme } from "@/lib/themes";

// The look of the video being drawn (lib/themes.ts), set once by StoryboardVideo for the whole video.
const ThemeContext = createContext<Theme>(THEMES.night);
export const ThemeProvider = ThemeContext.Provider;
export const useTheme = () => useContext(ThemeContext);

// A color from the theme ("#RRGGBB") made see-through, for chalk lines and ink edges that let the ground show.
export function alpha(color: string, opacity: number): string {
  const [red, green, blue] = [1, 3, 5].map((start) => parseInt(color.slice(start, start + 2), 16));
  return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
}

// `amount` of a color mixed into another, as a solid color: a pale tint of a color on the page, for example.
export const mix = (color: string, into: string, amount: number) => interpolateColors(amount, [0, 1], [into, color]);
