import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { TimedWord } from "@/lib/elevenlabs";
import { COLORS, FONTS, VIDEO } from "@/lib/theme";
import { ease } from "../motion";
import { revealTimes } from "../spoken";

const GAP = 80; // room for the arrow between two boxes
const BOX_HEIGHT = 300;

// A process or a chain of causes. The steps appear one by one as the narration gets to them, and the newest step
// is marked in amber.
export function StepsScene({ steps, words, durationSec }: { steps: string[]; words: TimedWord[]; durationSec: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const usable = VIDEO.width - 2 * VIDEO.sideMargin;
  const boxWidth = (usable - GAP * (steps.length - 1)) / steps.length;
  // Steps the narration never names are spread over the first three quarters of the scene.
  const starts = revealTimes(steps, words, { firstSec: 0.3, spreadSec: Math.max(0.8, durationSec * 0.75), gapSec: 0.6, durationSec });
  const startOf = (index: number) => starts[index];
  const time = frame / fps;
  const newest = steps.reduce((latest, _, index) => (time >= startOf(index) ? index : latest), 0);

  // Long steps get smaller type, so they fit in narrow boxes.
  const longest = Math.max(...steps.map((step) => step.length));
  const fontSize = (steps.length > 4 ? 40 : steps.length > 3 ? 44 : 50) - (longest > 36 ? 6 : 0);

  return (
    <AbsoluteFill style={{ justifyContent: "center", padding: `0 ${VIDEO.sideMargin}px ${VIDEO.captionSpace}px` }}>
      {/* The boxes stretch to the tallest one, so a long step makes the whole row taller instead of spilling out. */}
      <div style={{ display: "flex", alignItems: "stretch" }}>
        {steps.map((step, index) => {
          const appear = ease(frame, fps, startOf(index), 0.5);
          const arrow = ease(frame, fps, startOf(index) - 0.3, 0.4);
          const isNewest = index === newest;
          return (
            <div key={index} style={{ display: "flex", alignItems: "stretch" }}>
              {index > 0 ? (
                <div style={{ display: "flex", alignItems: "center" }}>
                  <svg width={GAP} height={60} viewBox={`0 0 ${GAP} 60`} style={{ opacity: arrow }}>
                    <line x1={12} y1={30} x2={12 + (GAP - 44) * arrow} y2={30} stroke={COLORS.signal} strokeWidth={8} strokeLinecap="round" />
                    <path d={`M ${GAP - 14} 30 L ${GAP - 36} 16 L ${GAP - 36} 44 Z`} fill={COLORS.signal} opacity={arrow > 0.9 ? 1 : 0} />
                  </svg>
                </div>
              ) : null}
              <div
                style={{
                  width: boxWidth,
                  minHeight: BOX_HEIGHT,
                  padding: "30px 24px",
                  border: `5px solid ${isNewest ? COLORS.signal : COLORS.border}`,
                  backgroundColor: COLORS.land,
                  opacity: appear,
                  transform: `translateY(${(1 - appear) * 30}px)`,
                  display: "flex",
                  flexDirection: "column",
                  gap: 18,
                }}
              >
                <div style={{ fontFamily: FONTS.display, fontSize: 64, fontWeight: 700, lineHeight: 1, color: isNewest ? COLORS.signal : COLORS.dim }}>
                  {index + 1}
                </div>
                {/* A narrower cut of Archivo, so long words fit even with five boxes in a row. */}
                <div
                  style={{
                    fontFamily: FONTS.body,
                    fontSize,
                    fontStretch: steps.length > 3 ? "75%" : "90%",
                    fontWeight: 600,
                    lineHeight: 1.15,
                    color: COLORS.paper,
                    overflowWrap: "break-word",
                  }}
                >
                  {step}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}
