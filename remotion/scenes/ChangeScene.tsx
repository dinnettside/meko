import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { TimedWord } from "@/lib/elevenlabs";
import { VIDEO } from "@/lib/theme";
import { formatYear } from "../format";
import { ease } from "../motion";
import { revealAt } from "../spoken";
import { useTheme } from "../theme";

// An old name or status struck through and replaced by the new one. The old one stands first; as the narration
// gets to the new one, a line strikes the old one out, and the new one lands under it.
export function ChangeScene({
  from,
  to,
  year,
  words,
  durationSec,
}: {
  from: string;
  to: string;
  year?: number;
  words: TimedWord[];
  durationSec: number;
}) {
  const { colors, fonts } = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fromIn = ease(frame, fps, 0.2, 0.6);
  // The strike lands just before the new name is said, and never in the scene's first second.
  const strikeAt = Math.max(1, revealAt(words, to, Math.min(2.2, durationSec * 0.4), 1, durationSec) - 0.4);
  const strike = ease(frame, fps, strikeAt, 0.45);
  const toIn = ease(frame, fps, strikeAt + 0.35, 0.35);

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: `0 ${VIDEO.sideMargin}px ${VIDEO.captionSpace}px` }}>
      <div style={{ position: "relative", display: "inline-block", opacity: fromIn }}>
        <div
          style={{
            fontFamily: fonts.display,
            fontSize: 120 * fonts.displayScale,
            fontWeight: fonts.displayWeight,
            lineHeight: 1.05,
            textAlign: "center",
            color: strike > 0.5 ? colors.dim : colors.paper,
          }}
        >
          {from}
        </div>
        <div
          style={{
            position: "absolute",
            left: -16,
            top: "54%",
            height: 12,
            width: `calc(${strike * 100}% + ${strike * 32}px)`,
            backgroundColor: colors.alert,
            transform: "rotate(-3deg)",
            transformOrigin: "left center",
          }}
        />
      </div>
      <div
        style={{
          margin: "28px 0",
          fontFamily: fonts.label,
          fontSize: 44,
          fontWeight: 600,
          color: colors.dim,
          opacity: toIn,
        }}
      >
        {year !== undefined ? `↓  ${formatYear(year)}` : "↓"}
      </div>
      <div
        style={{
          fontFamily: fonts.display,
          fontSize: 140 * fonts.displayScale,
          fontWeight: fonts.displayWeight,
          lineHeight: 1.05,
          textAlign: "center",
          color: colors.signal,
          opacity: toIn,
          transform: `scale(${1.3 - 0.3 * toIn})`,
        }}
      >
        {to}
      </div>
    </AbsoluteFill>
  );
}
