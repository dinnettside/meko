// "Night atlas", the look of every Meko video: a deep navy ground, slate land, warm paper text,
// and one amber signal color for the thing to look at. Teal is the second highlight.

export const COLORS = {
  ink: "#0F1B2D", // background and sea
  land: "#22334B", // countries
  border: "#3A4F6E", // country borders and axis lines
  muted: "#3E5573", // countries shown for context
  paper: "#F4F1EA", // main text
  dim: "#93A1B5", // secondary text
  signal: "#FFB627", // the one thing to look at
  teal: "#4FC3B4", // second highlight
};

// The fonts are loaded by next/font in app/layout.tsx.
export const FONTS = {
  display: "var(--font-fraunces), Georgia, serif",
  body: "var(--font-archivo), Helvetica, Arial, sans-serif",
};

// Leaves room for the captions at the bottom of the frame.
export const CAPTION_SPACE = 260;
