import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { Source } from "@/lib/storyboard";
import { VIDEO } from "@/lib/theme";
import { ease } from "../motion";
import { useTheme } from "../theme";

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

// A source's own words, revealed a few words at a time, with the source's name under it. Then a marker sweeps
// over the words, the way you would mark the line in a book that backs a claim. The marker's color is solid rather
// than see-through, so where two words' marks meet there is no darker seam.
export function QuoteScene({ text, source, durationSec }: { text: string; source?: Source; durationSec: number }) {
  const { colors, fonts } = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(/\s+/).filter(Boolean);
  const markIn = ease(frame, fps, 0.1, 0.5);
  const shown = 0.4 + words.length * 0.06;
  const sourceIn = ease(frame, fps, shown, 0.6);
  // The sweep starts once the words are in, and is done well before the scene ends.
  const sweepStart = shown + 0.3;
  const sweepEnd = Math.max(sweepStart + 1.2, Math.min(durationSec - 1.8, sweepStart + durationSec * 0.5));
  const sweep = interpolate(frame / fps, [sweepStart, sweepEnd], [0, words.length], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ justifyContent: "center", padding: `0 ${VIDEO.sideMargin + 40}px ${VIDEO.captionSpace}px` }}>
      <div style={{ fontFamily: fonts.display, fontSize: 280 * fonts.displayScale, lineHeight: 0.6, height: 120, color: colors.signal, opacity: markIn }}>
        “
      </div>
      <div
        style={{
          maxWidth: 1400,
          fontFamily: fonts.display,
          fontSize: 70 * fonts.displayScale,
          fontStyle: fonts.displayItalic ? "italic" : "normal",
          lineHeight: 1.25,
          color: colors.paper,
        }}
      >
        {words.map((word, index) => {
          const marked = Math.max(0, Math.min(1, sweep - index)) * 100;
          return (
            <span
              key={index}
              style={{
                opacity: ease(frame, fps, 0.4 + index * 0.06, 0.3),
                backgroundImage: `linear-gradient(to right, ${colors.marker} ${marked}%, transparent ${marked}%)`,
                boxDecorationBreak: "clone",
                WebkitBoxDecorationBreak: "clone",
                // A pixel of overlap closes the hairline gaps between words.
                paddingRight: 1,
                marginRight: -1,
              }}
            >
              {index > 0 ? " " : ""}
              {word}
            </span>
          );
        })}
      </div>
      {source ? (
        <div style={{ marginTop: 48, fontFamily: fonts.body, fontSize: 42, color: colors.dim, opacity: sourceIn }}>
          — {source.title} <span style={{ color: colors.border }}>· {hostname(source.url)}</span>
        </div>
      ) : null}
    </AbsoluteFill>
  );
}
