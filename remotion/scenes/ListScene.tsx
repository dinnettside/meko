import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { TimedWord } from "@/lib/elevenlabs";
import { COLORS, FONTS, VIDEO } from "@/lib/theme";
import { ease } from "../motion";
import { revealTimes } from "../spoken";

const GAP = 40;
const CARD_HEIGHT = 300;

// Two to four things of one kind side by side, like types, goods or effects. Each card comes in as the narration
// names it, and the newest gets the amber rule. There are no arrows and no numbers, because the items do not lead
// to each other: that is what steps are for.
export function ListScene({
  items,
  words,
  durationSec,
}: {
  items: { title: string; detail?: string }[];
  words: TimedWord[];
  durationSec: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const usable = VIDEO.width - 2 * VIDEO.sideMargin;
  const cardWidth = (usable - GAP * (items.length - 1)) / items.length;
  const starts = revealTimes(
    items.map((item) => `${item.title} ${item.detail ?? ""}`),
    words,
    { firstSec: 0.3, spreadSec: Math.max(0.8, durationSec * 0.7), gapSec: 0.5, durationSec },
  );
  const time = frame / fps;
  const newest = starts.reduce((latest, start, index) => (time >= start ? index : latest), 0);
  const titleSize = items.length > 3 ? 58 : 70;

  return (
    <AbsoluteFill style={{ justifyContent: "center", padding: `0 ${VIDEO.sideMargin}px ${VIDEO.captionSpace}px` }}>
      {/* The cards stretch to the tallest one, so a long detail makes the whole row taller instead of spilling out. */}
      <div style={{ display: "flex", alignItems: "stretch", gap: GAP }}>
        {items.map((item, index) => {
          const appear = ease(frame, fps, starts[index], 0.5);
          const rule = ease(frame, fps, starts[index] + 0.1, 0.5);
          const isNewest = index === newest;
          return (
            <div
              key={index}
              style={{
                width: cardWidth,
                minHeight: CARD_HEIGHT,
                padding: "40px 32px",
                backgroundColor: COLORS.land,
                opacity: appear,
                transform: `translateY(${(1 - appear) * 30}px)`,
                position: "relative",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  height: 10,
                  width: `${rule * 100}%`,
                  backgroundColor: isNewest ? COLORS.signal : COLORS.border,
                }}
              />
              <div
                style={{
                  fontFamily: FONTS.display,
                  fontSize: titleSize,
                  fontWeight: 700,
                  lineHeight: 1.05,
                  color: isNewest ? COLORS.signal : COLORS.paper,
                  overflowWrap: "break-word",
                }}
              >
                {item.title}
              </div>
              {item.detail ? (
                <div style={{ marginTop: 24, fontFamily: FONTS.body, fontSize: 40, lineHeight: 1.2, color: COLORS.dim }}>
                  {item.detail}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}
