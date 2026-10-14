import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { TimedWord } from "@/lib/elevenlabs";
import { COLORS, FONTS, VIDEO } from "@/lib/theme";
import { countUp } from "../format";
import { ease } from "../motion";
import { revealTimes } from "../spoken";

// Label, bar and value must fit inside the side margins: 400 + 32 + 760 + 32 + about 220 for the value.
const LABEL_WIDTH = 400;
const BAR_SPACE = 760;

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

  return (
    <AbsoluteFill style={{ justifyContent: "center", padding: `0 ${VIDEO.sideMargin}px ${VIDEO.captionSpace}px` }}>
      <div style={{ fontFamily: FONTS.display, fontSize: 76, fontWeight: 700, color: COLORS.paper, opacity: titleIn, marginBottom: 64 }}>
        {title}
      </div>
      {bars.map((bar, index) => {
        const grow = ease(frame, fps, starts[index], 1.0);
        const width = largest > 0 ? (bar.value / largest) * BAR_SPACE : 0;
        const isLargest = bar.value === largest;
        return (
          <div key={index} style={{ display: "flex", alignItems: "center", gap: 32, marginBottom: 34 }}>
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
                width: Math.max(4, width * grow),
                flexShrink: 0,
                height: 70,
                backgroundColor: isLargest ? COLORS.signal : COLORS.teal,
              }}
            />
            <div style={{ fontFamily: FONTS.body, fontSize: 48, fontWeight: 700, color: COLORS.paper, opacity: grow }}>
              {countUp(bar.value, grow)}
              {unit ? ` ${unit}` : ""}
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
}
