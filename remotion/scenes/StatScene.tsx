import { AbsoluteFill, Html5Audio, Sequence, interpolateColors, useCurrentFrame, useVideoConfig } from "remotion";
import type { TimedWord } from "@/lib/elevenlabs";
import { VIDEO } from "@/lib/theme";
import { countUp } from "../format";
import { ease } from "../motion";
import { sounds } from "../sfx";
import { revealAt } from "../spoken";
import { alpha, useTheme } from "../theme";

const DOTS = 100; // a 10 x 10 grid, so each dot is one percent

// One big number that counts up as the narration says it. With a total, a grid of dots shows how big a share
// the number is. A range, like 25 to 50 million, shows the certain part filled and the uncertain part as an outline.
// Blueprint draws the dots as square cells, like squares filled in on graph paper.
export function StatScene({
  value,
  valueMax,
  unit,
  label,
  total,
  words,
  durationSec,
}: {
  value: number;
  valueMax?: number;
  unit?: string;
  label: string;
  total?: number;
  words: TimedWord[];
  durationSec: number;
}) {
  const { colors, fonts, drawing } = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // The number counts up from the start of the scene and lands as the narration says it, so the screen never shows
  // a zero waiting for its turn.
  const start = 0;
  const spoken = revealAt(words, String(value), start, 0.3, durationSec);
  const countSec = Math.max(1.2, spoken + 0.3 - start);
  const count = ease(frame, fps, start, countSec);
  const labelIn = ease(frame, fps, start + 0.7, 0.6);
  // A percentage is always out of 100, so it gets the dots too.
  const whole = total ?? (/^(%|percent|per cent)$/i.test(unit ?? "") ? 100 : undefined);
  // The dots only show a part of the whole. A number bigger than the whole, like a 300 percent rise, or below zero
  // would fill the grid with a picture of something else, so it stands alone.
  const isPart = (amount: number) => whole !== undefined && whole > 0 && amount >= 0 && amount <= whole;
  const share = whole !== undefined && isPart(value) && isPart(valueMax ?? value) ? value / whole : null;
  const filled = share === null ? 0 : Math.round(share * DOTS);
  // Dots between the low and the high end of a range are drawn as outlines.
  const outlined = share === null || valueMax === undefined ? filled : Math.round((valueMax / (whole ?? 1)) * DOTS);

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
          <span
            style={{
              fontFamily: fonts.display,
              fontSize: (valueMax === undefined ? 260 : 200) * fonts.displayScale,
              fontWeight: fonts.displayWeight,
              lineHeight: 1,
              color: colors.signal,
            }}
          >
            {countUp(value, count)}
            {valueMax !== undefined ? `–${countUp(valueMax, count)}` : null}
          </span>
          {unit ? (
            <span style={{ fontFamily: fonts.display, fontSize: 110 * fonts.displayScale, fontWeight: fonts.displayWeight, color: colors.paper, opacity: count }}>
              {unit}
            </span>
          ) : null}
        </div>
        <div
          style={{
            marginTop: 36,
            maxWidth: 1000,
            marginInline: share === null ? "auto" : 0,
            fontFamily: fonts.body,
            fontSize: 60,
            color: colors.dim,
            opacity: labelIn,
          }}
        >
          {label}
        </div>
        {/* A range without a whole: a bar, filled up to the low end and outlined up to the high end. */}
        {valueMax !== undefined && share === null ? (
          <div style={{ display: "flex", justifyContent: "center", marginTop: 56 }}>
            <div style={{ width: 900, height: 44, display: "flex", border: `4px solid ${colors.signal}`, opacity: count }}>
              <div style={{ width: `${(value / valueMax) * 100 * count}%`, backgroundColor: colors.signal }} />
            </div>
          </div>
        ) : null}
      </div>
      {share !== null ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(10, 36px)", gap: 14 }}>
          {Array.from({ length: DOTS }, (_, index) => {
            // Dots fill one after another, starting as the number counts up.
            const fill = ease(frame, fps, start + 0.1 + (index / DOTS) * 1.4, 0.2);
            const color = index < filled ? interpolateColors(fill, [0, 1], [colors.land, colors.signal]) : colors.land;
            const uncertain = index >= filled && index < outlined;
            // Empty dots get a thin edge in the drawn looks: chalk in Blueprint, the border color on the page.
            const edge = index >= filled && drawing.card !== "solid" ? (drawing.card === "outline" ? alpha(colors.paper, 0.3) : colors.border) : null;
            return (
              <div
                key={index}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: drawing.card === "outline" ? 4 : 18,
                  backgroundColor: uncertain ? colors.land : color,
                  boxShadow: uncertain
                    ? `inset 0 0 0 4px ${interpolateColors(fill, [0, 1], [colors.land, colors.signal])}`
                    : edge
                      ? `inset 0 0 0 2px ${edge}`
                      : "none",
                }}
              />
            );
          })}
        </div>
      ) : null}
      {/* A low thud as the number lands. */}
      <Sequence from={Math.round((start + countSec) * fps)} layout="none">
        <Html5Audio src={sounds().thud} />
      </Sequence>
    </AbsoluteFill>
  );
}
