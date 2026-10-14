import { AbsoluteFill } from "remotion";
import type { Source } from "@/lib/storyboard";
import { COLORS, FONTS, VIDEO } from "@/lib/theme";
import { useEase } from "./motion";

const siteOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

export type CheckCounts = { supported: number; revised: number; removed: number };

// The closing credits: every source the video used, so anyone can check what it says, and how the fact-check went.
export function Credits({ sources, checks }: { sources: Source[]; checks?: CheckCounts }) {
  const headingIn = useEase(0.2, 0.6);
  const checksIn = useEase(0.6 + sources.length * 0.2, 0.6);
  const twoColumns = sources.length > 5;
  return (
    <AbsoluteFill style={{ justifyContent: "center", padding: `0 ${VIDEO.sideMargin}px` }}>
      <div style={{ fontFamily: FONTS.display, fontSize: 80, fontWeight: 700, color: COLORS.paper, opacity: headingIn }}>Sources</div>
      <div style={{ width: 200 * headingIn, height: 10, margin: "28px 0 52px", backgroundColor: COLORS.signal }} />
      <div style={{ display: "grid", gridTemplateColumns: twoColumns ? "1fr 1fr" : "1fr", columnGap: 80, rowGap: 30 }}>
        {sources.map((source, index) => (
          <CreditLine key={source.id} source={source} startSec={0.5 + index * 0.2} />
        ))}
      </div>
      {checks ? (
        <div style={{ marginTop: 52, fontFamily: FONTS.body, fontSize: 34, color: COLORS.teal, opacity: checksIn }}>
          ✓{" "}
          {checks.revised + checks.removed === 0
            ? `All ${checks.supported} sentences were checked against their sources and supported.`
            : `Every sentence was checked against its sources: ${checks.supported} supported, ${checks.revised} revised, ${checks.removed} removed.`}
        </div>
      ) : null}
    </AbsoluteFill>
  );
}

function CreditLine({ source, startSec }: { source: Source; startSec: number }) {
  const appear = useEase(startSec, 0.5);
  return (
    <div style={{ opacity: appear, minWidth: 0 }}>
      <div
        style={{
          fontFamily: FONTS.body,
          fontSize: 34,
          fontWeight: 600,
          color: COLORS.paper,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {source.title}
      </div>
      <div style={{ marginTop: 4, fontFamily: FONTS.body, fontSize: 28, color: COLORS.dim }}>{siteOf(source.url)}</div>
    </div>
  );
}
