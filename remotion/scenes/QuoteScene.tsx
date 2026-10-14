import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { Source } from "@/lib/storyboard";
import { COLORS, FONTS, VIDEO } from "@/lib/theme";
import { ease } from "../motion";

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

// The marker behind the quote: amber at a third, blended with the ink ground. It is solid rather than see-through,
// so where two words' marks meet there is no darker seam.
const MARKER = "#61502B";

// A source's own words, revealed a few words at a time, with the source's name under it. Then a marker sweeps
// over the words, the way you would mark the line in a book that backs a claim.
export function QuoteScene({ text, source, durationSec }: { text: string; source?: Source; durationSec: number }) {
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
      <div style={{ fontFamily: FONTS.display, fontSize: 280, lineHeight: 0.6, height: 120, color: COLORS.signal, opacity: markIn }}>
        “
      </div>
      <div style={{ maxWidth: 1400, fontFamily: FONTS.display, fontSize: 70, fontStyle: "italic", lineHeight: 1.25, color: COLORS.paper }}>
        {words.map((word, index) => {
          const marked = Math.max(0, Math.min(1, sweep - index)) * 100;
          return (
            <span
              key={index}
              style={{
                opacity: ease(frame, fps, 0.4 + index * 0.06, 0.3),
                backgroundImage: `linear-gradient(to right, ${MARKER} ${marked}%, transparent ${marked}%)`,
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
        <div style={{ marginTop: 48, fontFamily: FONTS.body, fontSize: 42, color: COLORS.dim, opacity: sourceIn }}>
          — {source.title} <span style={{ color: COLORS.border }}>· {hostname(source.url)}</span>
        </div>
      ) : null}
    </AbsoluteFill>
  );
}
