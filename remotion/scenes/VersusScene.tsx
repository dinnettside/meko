import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { TimedWord } from "@/lib/elevenlabs";
import { COLORS, FONTS, VIDEO } from "@/lib/theme";
import { ease } from "../motion";
import { revealTimes } from "../spoken";

const LABEL_WIDTH = 330;

// Two sides compared point by point, like a scoreboard. The two names come first, then each point as the narration
// gets to it, with what it is for each side. The left side is teal and the right side amber.
export function VersusScene({
  left,
  right,
  rows,
  words,
  durationSec,
}: {
  left: string;
  right: string;
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

  return (
    <AbsoluteFill style={{ justifyContent: "center", padding: `0 ${VIDEO.sideMargin}px ${VIDEO.captionSpace}px` }}>
      <div style={{ display: "grid", gridTemplateColumns: columns, columnGap: 28, opacity: headersIn, marginBottom: 28 }}>
        <div />
        {[
          { name: left, color: COLORS.teal },
          { name: right, color: COLORS.signal },
        ].map((side) => (
          <div key={side.name} style={{ fontFamily: FONTS.display, fontSize: 64, fontWeight: 700, color: COLORS.paper, lineHeight: 1.05 }}>
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
              columnGap: 28,
              marginTop: 18,
              opacity: appear,
              transform: `translateY(${(1 - appear) * 24}px)`,
            }}
          >
            <div style={{ alignSelf: "center", fontFamily: FONTS.body, fontSize: 36, fontWeight: 600, color: COLORS.dim }}>{row.label}</div>
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
    </AbsoluteFill>
  );
}
