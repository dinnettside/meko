import { AbsoluteFill, interpolateColors, useCurrentFrame, useVideoConfig } from "remotion";
import type { TimedWord } from "@/lib/elevenlabs";
import { COLORS, FONTS, VIDEO } from "@/lib/theme";
import { countUp } from "../format";
import { ease } from "../motion";
import { revealAt } from "../spoken";

const DOTS = 100; // a 10 x 10 grid, so each dot is one percent

// One big number that counts up as the narration says it. With a total, a grid of dots shows how big a share
// the number is.
export function StatScene({
  value,
  unit,
  label,
  total,
  words,
  durationSec,
}: {
  value: number;
  unit?: string;
  label: string;
  total?: number;
  words: TimedWord[];
  durationSec: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // Counting takes a moment, so it starts a little before the number is said and is done soon after.
  const start = Math.max(0.3, revealAt(words, String(value), 0.3, 0.3, durationSec) - 0.6);
  const count = ease(frame, fps, start, 1.6);
  const labelIn = ease(frame, fps, start + 0.7, 0.6);
  // A percentage is always out of 100, so it gets the dots too.
  const whole = total ?? (/^(%|percent|per cent)$/i.test(unit ?? "") ? 100 : undefined);
  const share = whole && whole > 0 ? Math.min(1, value / whole) : null;
  const filled = share === null ? 0 : Math.round(share * DOTS);

  return (
    <AbsoluteFill
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 120,
        padding: `0 ${VIDEO.sideMargin}px ${VIDEO.captionSpace}px`,
      }}
    >
      {/* Without dots, the number stands in the middle of the screen. */}
      <div style={{ flex: 1, textAlign: share === null ? "center" : "left" }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: share === null ? "center" : "flex-start",
            gap: 32,
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontFamily: FONTS.display, fontSize: 260, fontWeight: 700, lineHeight: 1, color: COLORS.signal }}>
            {countUp(value, count)}
          </span>
          {unit ? (
            <span style={{ fontFamily: FONTS.display, fontSize: 110, fontWeight: 700, color: COLORS.paper, opacity: count }}>
              {unit}
            </span>
          ) : null}
        </div>
        <div
          style={{
            marginTop: 36,
            maxWidth: 1000,
            marginInline: share === null ? "auto" : 0,
            fontFamily: FONTS.body,
            fontSize: 60,
            color: COLORS.dim,
            opacity: labelIn,
          }}
        >
          {label}
        </div>
      </div>
      {share !== null ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(10, 36px)", gap: 14 }}>
          {Array.from({ length: DOTS }, (_, index) => {
            // Dots fill one after another, starting as the number counts up.
            const fill = ease(frame, fps, start + 0.1 + (index / DOTS) * 1.4, 0.2);
            const color = index < filled ? interpolateColors(fill, [0, 1], [COLORS.land, COLORS.signal]) : COLORS.land;
            return <div key={index} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: color }} />;
          })}
        </div>
      ) : null}
    </AbsoluteFill>
  );
}
