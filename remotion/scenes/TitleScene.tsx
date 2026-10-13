import { AbsoluteFill } from "remotion";
import { useEase } from "../motion";
import { COLORS, FONTS, VIDEO } from "@/lib/theme";

// The opening: a big serif heading with an amber rule under it.
export function TitleScene({ heading, subheading }: { heading: string; subheading?: string }) {
  const headingIn = useEase(0.2, 0.8);
  const ruleIn = useEase(0.7, 0.8);
  const subheadingIn = useEase(1.0, 0.7);
  return (
    <AbsoluteFill style={{ justifyContent: "center", padding: `0 ${VIDEO.sideMargin}px ${VIDEO.captionSpace}px` }}>
      <div
        style={{
          maxWidth: 1450,
          fontFamily: FONTS.display,
          fontSize: VIDEO.fontSize.title,
          fontWeight: 700,
          lineHeight: 1.04,
          color: COLORS.paper,
          opacity: headingIn,
          transform: `translateY(${(1 - headingIn) * 30}px)`,
        }}
      >
        {heading}
      </div>
      <div style={{ width: 260 * ruleIn, height: 12, marginTop: 56, backgroundColor: COLORS.signal }} />
      {subheading ? (
        <div style={{ marginTop: 44, fontFamily: FONTS.body, fontSize: VIDEO.fontSize.subtitle, color: COLORS.dim, opacity: subheadingIn }}>
          {subheading}
        </div>
      ) : null}
    </AbsoluteFill>
  );
}
