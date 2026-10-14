import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
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

// A source's own words, revealed a few words at a time, with the source's name under it.
export function QuoteScene({ text, source }: { text: string; source?: Source }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(/\s+/).filter(Boolean);
  const markIn = ease(frame, fps, 0.1, 0.5);
  const sourceIn = ease(frame, fps, 0.5 + words.length * 0.06, 0.6);

  return (
    <AbsoluteFill style={{ justifyContent: "center", padding: `0 ${VIDEO.sideMargin + 40}px ${VIDEO.captionSpace}px` }}>
      <div style={{ fontFamily: FONTS.display, fontSize: 280, lineHeight: 0.6, height: 120, color: COLORS.signal, opacity: markIn }}>
        “
      </div>
      <div style={{ maxWidth: 1400, fontFamily: FONTS.display, fontSize: 70, fontStyle: "italic", lineHeight: 1.25, color: COLORS.paper }}>
        {words.map((word, index) => (
          <span key={index} style={{ opacity: ease(frame, fps, 0.4 + index * 0.06, 0.3) }}>
            {index > 0 ? " " : ""}
            {word}
          </span>
        ))}
      </div>
      {source ? (
        <div style={{ marginTop: 48, fontFamily: FONTS.body, fontSize: 42, color: COLORS.dim, opacity: sourceIn }}>
          — {source.title} <span style={{ color: COLORS.border }}>· {hostname(source.url)}</span>
        </div>
      ) : null}
    </AbsoluteFill>
  );
}
