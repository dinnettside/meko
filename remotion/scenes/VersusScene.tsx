import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { TimedWord } from "@/lib/elevenlabs";
import { COLORS, FONTS, VIDEO } from "@/lib/theme";
import { Icon } from "../icons";
import { ease } from "../motion";
import { revealTimes } from "../spoken";

const LABEL_WIDTH = 330;
const GAP = 28;
// The width of each side's column: what is left once the margins, the label column and the gaps are taken.
const SIDE_WIDTH = (VIDEO.width - 2 * VIDEO.sideMargin - LABEL_WIDTH - 2 * GAP) / 2;
// The room between the year and the sources in the top corners and the captions.
const SPACE = VIDEO.height - VIDEO.topSpace - VIDEO.captionSpace;

// About how many lines a text wraps to in a box `width` wide, since text cannot be measured here. Archivo and
// Fraunces are about 0.56 em wide per character, a little more than they really are, so this errs toward more lines.
function linesOf(text: string, fontSize: number, width: number): number {
  const charWidth = fontSize * 0.56;
  let lines = 1;
  let used = 0;
  for (const word of text.split(" ")) {
    const next = used === 0 ? word.length * charWidth : used + (word.length + 1) * charWidth;
    if (used > 0 && next > width) {
      lines += 1;
      used = word.length * charWidth;
    } else used = next;
  }
  return lines;
}

// Two sides compared point by point, like a scoreboard. The two names come first, then each point as the narration
// gets to it, with what it is for each side. The left side is teal and the right side amber.
export function VersusScene({
  left,
  right,
  leftIcon,
  rightIcon,
  rows,
  words,
  durationSec,
}: {
  left: string;
  right: string;
  leftIcon?: string;
  rightIcon?: string;
  rows: { label: string; left: string; right: string }[];
  words: TimedWord[];
  durationSec: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const headersIn = ease(frame, fps, 0.2, 0.6);
  const starts = revealTimes(
    rows.map((row) => `${row.label} ${row.left} ${row.right}`),
    words,
    { firstSec: 0.9, spreadSec: Math.max(1, durationSec * 0.65), gapSec: 0.6, durationSec },
  );
  const columns = `${LABEL_WIDTH}px 1fr 1fr`;
  // How tall the scoreboard is: the names with their colored bars, then each row as tall as its longest text.
  const cellLines = (text: string) => linesOf(text, 40, SIDE_WIDTH - 60);
  const height =
    Math.max(linesOf(left, 64, SIDE_WIDTH), linesOf(right, 64, SIDE_WIDTH)) * 64 * 1.05 +
    54 +
    rows.reduce(
      (total, row) =>
        total + 18 + Math.max(linesOf(row.label, 36, LABEL_WIDTH) * 36 * 1.2, Math.max(cellLines(row.left), cellLines(row.right)) * 46 + 44),
      0,
    );
  // A tall scoreboard is drawn smaller, so it stays clear of the notes in the top corners and of the captions.
  const fit = Math.min(1, SPACE / height);

  return (
    <AbsoluteFill style={{ justifyContent: "center", padding: `${VIDEO.topSpace}px ${VIDEO.sideMargin}px ${VIDEO.captionSpace}px` }}>
      <div style={{ transform: `scale(${fit})` }}>
        <div style={{ display: "grid", gridTemplateColumns: columns, columnGap: GAP, opacity: headersIn, marginBottom: 28 }}>
          <div />
          {[
            { name: left, color: COLORS.teal, icon: leftIcon },
            { name: right, color: COLORS.signal, icon: rightIcon },
          ].map((side) => (
            <div key={side.name} style={{ fontFamily: FONTS.display, fontSize: 64, fontWeight: 700, color: COLORS.paper, lineHeight: 1.05 }}>
              {side.icon ? (
                <div style={{ marginBottom: 14 }}>
                  <Icon name={side.icon} size={84} color={side.color} />
                </div>
              ) : null}
              {side.name}
              <div style={{ marginTop: 16, height: 10, width: `${headersIn * 100}%`, backgroundColor: side.color }} />
            </div>
          ))}
        </div>
        {rows.map((row, index) => {
          const appear = ease(frame, fps, starts[index], 0.45);
          return (
            <div
              key={index}
              style={{
                display: "grid",
                gridTemplateColumns: columns,
                columnGap: GAP,
                marginTop: 18,
                opacity: appear,
                transform: `translateY(${(1 - appear) * 24}px)`,
              }}
            >
              <div style={{ alignSelf: "center", fontFamily: FONTS.body, fontSize: 36, fontWeight: 600, lineHeight: 1.2, color: COLORS.dim }}>
                {row.label}
              </div>
              {[
                { text: row.left, color: COLORS.teal },
                { text: row.right, color: COLORS.signal },
              ].map((cell, side) => (
                <div
                  key={side}
                  style={{
                    padding: "22px 26px",
                    backgroundColor: COLORS.land,
                    borderLeft: `8px solid ${cell.color}`,
                    fontFamily: FONTS.body,
                    fontSize: 40,
                    fontWeight: 500,
                    lineHeight: 1.15,
                    color: COLORS.paper,
                  }}
                >
                  {cell.text}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}
