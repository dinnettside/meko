import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONTS, VIDEO } from "@/lib/theme";
import { ease } from "../motion";

const GAP = 80; // room for the arrow between two boxes
const BOX_HEIGHT = 300;

// A process or a chain of causes. The steps appear one by one over the scene, as the narration gets to them,
// and the newest step is marked in amber.
export function StepsScene({ steps, durationSec }: { steps: string[]; durationSec: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const usable = VIDEO.width - 2 * VIDEO.sideMargin;
  const boxWidth = (usable - GAP * (steps.length - 1)) / steps.length;
  // Spread the steps over the first three quarters of the scene.
  const startOf = (index: number) => 0.3 + (index * Math.max(0.8, durationSec * 0.75)) / steps.length;
  const time = frame / fps;
  const newest = steps.reduce((latest, _, index) => (time >= startOf(index) ? index : latest), 0);

  return (
    <AbsoluteFill
      style={{
        flexDirection: "row",
        alignItems: "center",
        padding: `0 ${VIDEO.sideMargin}px ${VIDEO.captionSpace}px`,
      }}
    >
      {steps.map((step, index) => {
        const appear = ease(frame, fps, startOf(index), 0.5);
        const arrow = ease(frame, fps, startOf(index) - 0.3, 0.4);
        const isNewest = index === newest;
        return (
          <div key={index} style={{ display: "flex", alignItems: "center" }}>
            {index > 0 ? (
              <svg width={GAP} height={60} viewBox={`0 0 ${GAP} 60`} style={{ opacity: arrow }}>
                <line x1={12} y1={30} x2={12 + (GAP - 44) * arrow} y2={30} stroke={COLORS.signal} strokeWidth={8} strokeLinecap="round" />
                <path d={`M ${GAP - 14} 30 L ${GAP - 36} 16 L ${GAP - 36} 44 Z`} fill={COLORS.signal} opacity={arrow > 0.9 ? 1 : 0} />
              </svg>
            ) : null}
            <div
              style={{
                width: boxWidth,
                height: BOX_HEIGHT,
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
                  fontSize: steps.length > 4 ? 40 : steps.length > 3 ? 44 : 50,
                  fontStretch: steps.length > 3 ? "75%" : "90%",
                  fontWeight: 600,
                  lineHeight: 1.15,
                  color: COLORS.paper,
                }}
              >
                {step}
              </div>
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
}
