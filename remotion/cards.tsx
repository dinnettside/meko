import type { CSSProperties } from "react";
import type { Theme } from "@/lib/themes";
import { alpha, useTheme } from "./theme";

// Cards and boxes in each look (lib/themes.ts): flat panels in Night atlas, boxes drawn in chalk with short ticks past
// their corners in Blueprint, like the frame of a technical drawing, and paper tags with a thin ink edge in Field
// guide. No soft shadows in any of them.

type Edge = { width: number; color: string };

// What a card is filled with: the ground in Blueprint, where only its lines are drawn, and land otherwise. An icon on
// a card cuts its details out of this color.
export const cardFill = ({ colors, drawing }: Theme) => (drawing.card === "outline" ? colors.ink : colors.land);

// The edge of a card: none on a flat panel, a chalk line in Blueprint, an ink line in Field guide.
export function cardEdge({ colors, drawing }: Theme): Edge {
  if (drawing.card === "outline") return { width: 3, color: alpha(colors.paper, 0.7) };
  if (drawing.card === "tag") return { width: 2, color: alpha(colors.paper, 0.6) };
  return { width: 0, color: "transparent" };
}

// The box of a card in Blueprint and Field guide: its fill, its edge (in `edgeColor` when the card stands out) and
// its corners. Night atlas cards keep the boxes their scenes give them.
export function drawnCard(theme: Theme, edgeColor?: string): CSSProperties {
  const edge = cardEdge(theme);
  return { backgroundColor: cardFill(theme), border: `${edge.width}px solid ${edgeColor ?? edge.color}`, borderRadius: theme.drawing.radius };
}

// What a card has on it besides its box: ticks past its corners in Blueprint, and in Field guide a punched hole near
// its top left corner when `hole` is set. The card must be positioned.
export function CardMarks({ edgeColor, hole = false }: { edgeColor?: string; hole?: boolean }) {
  const theme = useTheme();
  const edge = cardEdge(theme);
  if (theme.drawing.card === "outline") return <CornerTicks color={edgeColor ?? edge.color} width={edge.width} length={14} />;
  if (theme.drawing.card === "tag" && hole) {
    return (
      <div
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          width: 18,
          height: 18,
          borderRadius: 9,
          backgroundColor: theme.colors.ink,
          boxShadow: `inset 0 0 0 ${edge.width}px ${edge.color}`,
        }}
      />
    );
  }
  return null;
}

// The small notes over the picture (the caption, the year and the sources) get a thinner edge than cards: none in
// Night atlas, chalk in Blueprint, ink in Field guide.
function noteEdge({ colors, drawing }: Theme): Edge {
  if (drawing.card === "outline") return { width: 2, color: alpha(colors.paper, 0.55) };
  if (drawing.card === "tag") return { width: 2, color: alpha(colors.paper, 0.45) };
  return { width: 0, color: "transparent" };
}

export function noteStyle(theme: Theme): CSSProperties {
  if (theme.drawing.card === "solid") return {};
  const edge = noteEdge(theme);
  return { border: `${edge.width}px solid ${edge.color}`, borderRadius: theme.drawing.radius };
}

// Short ticks past a note's corners in Blueprint, as on its cards. The note must be positioned.
export function NoteMarks() {
  const theme = useTheme();
  if (theme.drawing.card !== "outline") return null;
  const edge = noteEdge(theme);
  return <CornerTicks color={edge.color} width={edge.width} length={10} />;
}

// Two short lines at each corner of a box with a border `width` wide, carrying its edges on past the corner.
function CornerTicks({ color, width, length }: { color: string; width: number; length: number }) {
  const out = -width - length;
  const along: CSSProperties = { width: length, height: width };
  const down: CSSProperties = { width, height: length };
  const lines: CSSProperties[] = [
    { ...along, top: -width, left: out },
    { ...down, top: out, left: -width },
    { ...along, top: -width, right: out },
    { ...down, top: out, right: -width },
    { ...along, bottom: -width, left: out },
    { ...down, bottom: out, left: -width },
    { ...along, bottom: -width, right: out },
    { ...down, bottom: out, right: -width },
  ];
  return (
    <>
      {lines.map((line, index) => (
        <div key={index} style={{ position: "absolute", backgroundColor: color, ...line }} />
      ))}
    </>
  );
}
