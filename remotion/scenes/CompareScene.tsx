import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { TimedWord } from "@/lib/elevenlabs";
import { COLORS, FONTS, VIDEO } from "@/lib/theme";
import { countUp } from "../format";
import { ease } from "../motion";
import { revealTimes } from "../spoken";

// Label, bar and value must fit inside the side margins: 400 + 32 + 760 + 32 + about 220 for the value.
const LABEL_WIDTH = 400;
const BAR_SPACE = 760;
const BAR_HEIGHT = 70;
const GAP = 32;
const CONTENT_WIDTH = VIDEO.width - 2 * VIDEO.sideMargin;
// The room between the year and the sources in the top corners and the captions.
const SPACE = VIDEO.height - VIDEO.topSpace - VIDEO.captionSpace;

// About how many lines a text wraps to in a box `width` wide, since text cannot be measured here. Archivo and
// Fraunces are about 0.56 em wide per character, a little more than they really are, so this errs toward more lines.
function linesOf(text: string, fontSize: number, width: number): number {
  const charWidth = fontSize * 0.56;
  let lines = 1;
  let used = 0;
  for (const word of text.split(" ")) {
    const next = used === 0 ? word.length * charWidth : used + (word.length + 1) * charWidth;
    if (used > 0 && next > width) {
      lines += 1;
      used = word.length * charWidth;
    } else used = next;
  }
  return lines;
}

// A bar chart: bars grow one after another as the narration names them, and the biggest one is amber.
export function CompareScene({
  title,
  unit,
  bars,
  words,
  durationSec,
}: {
  title: string;
  unit?: string;
  bars: { label: string; value: number }[];
  words: TimedWord[];
  durationSec: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const largest = Math.max(...bars.map((bar) => bar.value), 0);
  const titleIn = ease(frame, fps, 0.1, 0.6);
  const starts = revealTimes(
    bars.map((bar) => `${bar.label} ${bar.value}`),
    words,
    { firstSec: 0.6, spreadSec: bars.length * 0.45, gapSec: 0.3, durationSec },
  );
  const barWidth = (value: number) => (largest > 0 ? (Math.max(0, value) / largest) * BAR_SPACE : 0);
  const valueText = (value: number, progress: number) => `${countUp(value, progress)}${unit ? ` ${unit}` : ""}`;
  // How tall the chart is: the title, then each bar as tall as its label or its value, which wraps when the bar
  // leaves it little room.
  const height =
    linesOf(title, 76, CONTENT_WIDTH) * 76 * 1.15 +
    64 +
    bars.reduce((total, bar) => {
      const valueWidth = CONTENT_WIDTH - LABEL_WIDTH - barWidth(bar.value) - 2 * GAP;
      const lines = Math.max(linesOf(bar.label, 48, LABEL_WIDTH), linesOf(valueText(bar.value, 1), 48, valueWidth));
      return total + Math.max(BAR_HEIGHT, lines * 48 * 1.2) + 34;
    }, 0);
  // A tall chart is drawn smaller, so it stays clear of the notes in the top corners and of the captions.
  const fit = Math.min(1, SPACE / height);

  return (
    <AbsoluteFill style={{ justifyContent: "center", padding: `${VIDEO.topSpace}px ${VIDEO.sideMargin}px ${VIDEO.captionSpace}px` }}>
      <div style={{ transform: `scale(${fit})` }}>
        <div style={{ fontFamily: FONTS.display, fontSize: 76, fontWeight: 700, lineHeight: 1.15, color: COLORS.paper, opacity: titleIn, marginBottom: 64 }}>
          {title}
        </div>
        {bars.map((bar, index) => {
          const grow = ease(frame, fps, starts[index], 1.0);
          const isLargest = bar.value === largest;
          return (
            <div key={index} style={{ display: "flex", alignItems: "center", gap: GAP, marginBottom: 34, lineHeight: 1.2 }}>
              <div
                style={{
                  width: LABEL_WIDTH,
                  flexShrink: 0,
                  textAlign: "right",
                  fontFamily: FONTS.body,
                  fontSize: 48,
                  color: isLargest ? COLORS.paper : COLORS.dim,
                  opacity: Math.min(1, grow * 3),
                }}
              >
                {bar.label}
              </div>
              <div
                style={{
                  width: Math.max(4, barWidth(bar.value) * grow),
                  flexShrink: 0,
                  height: BAR_HEIGHT,
                  backgroundColor: isLargest ? COLORS.signal : COLORS.teal,
                }}
              />
              <div style={{ fontFamily: FONTS.body, fontSize: 48, fontWeight: 700, color: COLORS.paper, opacity: grow }}>
                {valueText(bar.value, grow)}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}
