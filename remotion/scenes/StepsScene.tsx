import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { TimedWord } from "@/lib/elevenlabs";
import { VIDEO } from "@/lib/theme";
import { CardMarks, cardEdge, cardFill, drawnCard } from "../cards";
import { Icon } from "../icons";
import { ease } from "../motion";
import { revealTimes } from "../spoken";
import { useTheme } from "../theme";

const GAP = 80; // room for the arrow between two boxes
const BOX_HEIGHT = 300;

// A process or a chain of causes. The steps appear one by one as the narration gets to them, and the newest step
// is marked in amber. A step can show an icon next to its number. On a Field guide tag a thin rule runs under the
// number.
export function StepsScene({ steps, icons, words, durationSec }: { steps: string[]; icons?: string[]; words: TimedWord[]; durationSec: number }) {
  const theme = useTheme();
  const { colors, fonts, drawing } = theme;
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
    <AbsoluteFill style={{ justifyContent: "center", padding: `${VIDEO.topSpace}px ${VIDEO.sideMargin}px ${VIDEO.captionSpace}px` }}>
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
                    <line x1={12} y1={30} x2={12 + (GAP - 44) * arrow} y2={30} stroke={colors.signal} strokeWidth={8} strokeLinecap="round" />
                    <path d={`M ${GAP - 14} 30 L ${GAP - 36} 16 L ${GAP - 36} 44 Z`} fill={colors.signal} opacity={arrow > 0.9 ? 1 : 0} />
                  </svg>
                </div>
              ) : null}
              <div
                style={{
                  width: boxWidth,
                  minHeight: BOX_HEIGHT,
                  padding: "30px 24px",
                  ...(drawing.card === "solid"
                    ? { border: `5px solid ${isNewest ? colors.signal : colors.border}`, backgroundColor: colors.land }
                    : drawnCard(theme, isNewest ? colors.signal : undefined)),
                  opacity: appear,
                  transform: `translateY(${(1 - appear) * 30}px)`,
                  display: "flex",
                  flexDirection: "column",
                  gap: 18,
                  position: "relative",
                }}
              >
                <CardMarks edgeColor={isNewest ? colors.signal : undefined} />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative" }}>
                  <div
                    style={{
                      fontFamily: fonts.display,
                      fontSize: 64 * fonts.displayScale,
                      fontWeight: fonts.displayWeight,
                      lineHeight: 1,
                      color: isNewest ? colors.signal : colors.dim,
                    }}
                  >
                    {index + 1}
                  </div>
                  {icons?.[index] ? (
                    <Icon name={icons[index]} size={Math.min(84, Math.round(boxWidth * 0.3))} color={isNewest ? colors.signal : colors.paper} cut={cardFill(theme)} />
                  ) : null}
                  {drawing.card === "tag" ? (
                    <div style={{ position: "absolute", left: 0, right: 0, bottom: -10, height: 2, backgroundColor: cardEdge(theme).color }} />
                  ) : null}
                </div>
                {/* A narrower cut of Archivo, so long words fit even with five boxes in a row. */}
                <div
                  style={{
                    fontFamily: fonts.body,
                    fontSize,
                    fontStretch: steps.length > 3 ? "75%" : "90%",
                    fontWeight: 600,
                    lineHeight: 1.15,
                    color: colors.paper,
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
