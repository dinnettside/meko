import { AbsoluteFill } from "remotion";
import type { Source } from "@/lib/storyboard";
import { VIDEO } from "@/lib/theme";
import { CardMarks, drawnCard } from "./cards";
import { useEase } from "./motion";
import { useTheme } from "./theme";

const siteOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

export type CheckCounts = { supported: number; revised: number; removed: number };

// The closing credits: every source the video used, so anyone can check what it says, and how the fact-check went.
// In Blueprint they sit in a chalk frame like a drawing's title block, and in Field guide on a large paper tag.
export function Credits({ sources, checks }: { sources: Source[]; checks?: CheckCounts }) {
  const theme = useTheme();
  const { colors, fonts, drawing } = theme;
  const headingIn = useEase(0.2, 0.6);
  const checksIn = useEase(0.6 + sources.length * 0.2, 0.6);
  const twoColumns = sources.length > 5;
  return (
    <AbsoluteFill style={{ justifyContent: "center", padding: `0 ${VIDEO.sideMargin}px` }}>
      <div style={{ position: "relative" }}>
        {drawing.card !== "solid" ? (
          <div style={{ position: "absolute", inset: "-56px -64px", opacity: headingIn, ...drawnCard(theme) }}>
            <CardMarks hole />
          </div>
        ) : null}
        <div style={{ position: "relative" }}>
          <div style={{ fontFamily: fonts.display, fontSize: 80 * fonts.displayScale, fontWeight: fonts.displayWeight, color: colors.paper, opacity: headingIn }}>
            Sources
          </div>
          <div style={{ width: 200 * headingIn, height: 10, margin: "28px 0 52px", backgroundColor: colors.signal }} />
          <div style={{ display: "grid", gridTemplateColumns: twoColumns ? "1fr 1fr" : "1fr", columnGap: 80, rowGap: 30 }}>
            {sources.map((source, index) => (
              <CreditLine key={source.id} source={source} startSec={0.5 + index * 0.2} />
            ))}
          </div>
          {checks ? (
            <div style={{ marginTop: 52, fontFamily: fonts.body, fontSize: 34, color: colors.teal, opacity: checksIn }}>
              ✓{" "}
              {checks.revised + checks.removed === 0
                ? `All ${checks.supported} sentences were checked against their sources and supported.`
                : `Every sentence was checked against its sources: ${checks.supported} supported, ${checks.revised} revised, ${checks.removed} removed.`}
            </div>
          ) : null}
        </div>
      </div>
    </AbsoluteFill>
  );
}

function CreditLine({ source, startSec }: { source: Source; startSec: number }) {
  const { colors, fonts } = useTheme();
  const appear = useEase(startSec, 0.5);
  return (
    <div style={{ opacity: appear, minWidth: 0 }}>
      <div
        style={{
          fontFamily: fonts.body,
          fontSize: 34,
          fontWeight: 600,
          color: colors.paper,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {source.title}
      </div>
      <div style={{ marginTop: 4, fontFamily: fonts.label, fontSize: 28, color: colors.dim }}>{siteOf(source.url)}</div>
    </div>
  );
}
