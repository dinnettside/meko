import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { TimedWord } from "@/lib/elevenlabs";
import { VIDEO } from "@/lib/theme";
import { NoteMarks, noteStyle } from "./cards";
import { useTheme } from "./theme";

type CaptionLine = { words: TimedWord[]; start: number };

// Without recorded timings, spread the words evenly over the scene, leaving a short pause at the end.
export function estimateWords(narration: string, durationSec: number): TimedWord[] {
  const texts = narration.split(/\s+/).filter(Boolean);
  const step = Math.max(0.5, durationSec - 0.6) / Math.max(1, texts.length);
  return texts.map((text, index) => ({ text, start: index * step, end: (index + 1) * step }));
}

// Short caption lines: at most 7 words, a new line after each sentence, and after a comma once a line has 4 words.
function captionLines(words: TimedWord[]): CaptionLine[] {
  const lines: CaptionLine[] = [];
  let current: TimedWord[] = [];
  for (const word of words) {
    current.push(word);
    const endsSentence = /[.!?]["')]?$/.test(word.text);
    const endsClause = /[,;:]$/.test(word.text) && current.length >= 4;
    if (current.length === 7 || endsSentence || endsClause) {
      lines.push({ words: current, start: current[0].start });
      current = [];
    }
  }
  if (current.length > 0) lines.push({ words: current, start: current[0].start });
  return lines;
}

// Shows the line being spoken. Words light up as the voice says them. The box has a chalk edge with corner ticks in
// Blueprint and a thin ink edge in Field guide.
export function Caption({ words }: { words: TimedWord[] }) {
  const theme = useTheme();
  const { colors, fonts } = theme;
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const time = frame / fps;
  const lines = captionLines(words);
  const line = lines.findLast((candidate) => candidate.start <= time) ?? lines[0];
  if (!line) return null;
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: VIDEO.captionBottom }}>
      <div
        style={{
          position: "relative",
          maxWidth: 1600,
          padding: "16px 34px",
          backgroundColor: colors.captionBackground,
          fontFamily: fonts.body,
          fontSize: VIDEO.fontSize.caption,
          fontWeight: 500,
          lineHeight: 1.3,
          textAlign: "center",
          ...noteStyle(theme),
        }}
      >
        {line.words.map((word, index) => (
          <span key={index} style={{ color: word.start <= time ? colors.captionText : colors.captionUpcoming }}>
            {index > 0 ? " " : ""}
            {word.text}
          </span>
        ))}
        <NoteMarks />
      </div>
    </AbsoluteFill>
  );
}
