import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { TimedWord } from "@/lib/elevenlabs";
import { ease } from "../motion";
import { revealTimes } from "../spoken";
import { useTheme } from "../theme";
import { MOTION, VIDEO } from "@/lib/theme";

// Up to three short lines. The first is the key point: bigger, brighter, marked in amber, and its names and
// numbers are amber too. Each line comes in word by word as the narration gets to it, every word landing with a
// small punch, so the words arrive with the voice instead of sitting on a slide.
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

// Names and numbers stand out: any word with a digit, and capitalized words after the first.
const isKeyWord = (word: string, position: number) => /\d/.test(word) || (position > 0 && /^\p{Lu}/u.test(word));

// How long after the line starts each next word lands.
const WORD_GAP_SEC = 0.09;

function Line({ text, index, startSec }: { text: string; index: number; startSec: number }) {
  const { colors, fonts } = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const isKey = index === 0;
  const bar = ease(frame, fps, startSec, MOTION.entrance);
  const parts = text.split(/\s+/).filter(Boolean);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 40, marginBottom: isKey ? 56 : 36 }}>
      <div
        style={{
          width: 12,
          alignSelf: "stretch",
          backgroundColor: isKey ? colors.signal : "transparent",
          transform: `scaleY(${bar})`,
          transformOrigin: "top",
        }}
      />
      <div
        style={{
          fontFamily: isKey ? fonts.display : fonts.body,
          fontSize: isKey ? VIDEO.fontSize.keyLine * fonts.displayScale : VIDEO.fontSize.line,
          fontWeight: isKey ? fonts.displayWeight : 500,
          lineHeight: 1.12,
          color: isKey ? colors.paper : colors.dim,
        }}
      >
        {parts.map((word, position) => {
          const land = ease(frame, fps, startSec + position * WORD_GAP_SEC, 0.28);
          return (
            <span
              key={position}
              style={{
                display: "inline-block",
                marginRight: "0.26em",
                opacity: land,
                transform: `scale(${1.3 - 0.3 * land})`,
                color: isKey && isKeyWord(word, position) ? colors.signal : undefined,
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
    </div>
  );
}
