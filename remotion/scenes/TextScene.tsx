import { AbsoluteFill } from "remotion";
import type { TimedWord } from "@/lib/elevenlabs";
import { useEase } from "../motion";
import { revealTimes } from "../spoken";
import { COLORS, FONTS, MOTION, VIDEO } from "@/lib/theme";

// Up to three short lines. The first is the key point: bigger, brighter and marked in amber.
// The lines come in one by one, as the narration gets to them.
export function TextScene({ lines, words, durationSec }: { lines: string[]; words: TimedWord[]; durationSec: number }) {
  const spacing = Math.max(MOTION.stagger, Math.min(2.5, (durationSec * 0.7) / lines.length));
  const starts = revealTimes(lines, words, { firstSec: 0.2, spreadSec: spacing * lines.length, gapSec: MOTION.stagger, durationSec });
  return (
    <AbsoluteFill style={{ justifyContent: "center", padding: `0 ${VIDEO.sideMargin}px ${VIDEO.captionSpace}px` }}>
      {lines.map((line, index) => (
        <Line key={index} text={line} index={index} startSec={starts[index]} />
      ))}
    </AbsoluteFill>
  );
}

function Line({ text, index, startSec }: { text: string; index: number; startSec: number }) {
  const progress = useEase(startSec, MOTION.entrance);
  const isKey = index === 0;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 40,
        marginBottom: isKey ? 56 : 36,
        opacity: progress,
        transform: `translateX(${(progress - 1) * 40}px)`,
      }}
    >
      <div style={{ width: 12, alignSelf: "stretch", backgroundColor: isKey ? COLORS.signal : "transparent" }} />
      <div
        style={{
          fontFamily: isKey ? FONTS.display : FONTS.body,
          fontSize: isKey ? VIDEO.fontSize.keyLine : VIDEO.fontSize.line,
          fontWeight: isKey ? 700 : 500,
          lineHeight: 1.12,
          color: isKey ? COLORS.paper : COLORS.dim,
        }}
      >
        {text}
      </div>
    </div>
  );
}
