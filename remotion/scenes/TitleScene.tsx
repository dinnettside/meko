import { geoGraticule10, geoOrthographic, geoPath } from "d3-geo";
import { useMemo } from "react";
import { AbsoluteFill, interpolateColors, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONTS, VIDEO } from "@/lib/theme";
import { globeCountries, regionCenter } from "../globe";
import { ease, useEase } from "../motion";

const GLOBE = 760; // size of the globe drawing, in pixels
const graticule = geoGraticule10();

// The opening: a big serif heading with an amber rule under it. When the video has maps, a globe turns to the
// part of the world the story is about.
export function TitleScene({ heading, subheading, region }: { heading: string; subheading?: string; region: string[] }) {
  const headingIn = useEase(0.2, 0.8);
  const ruleIn = useEase(0.7, 0.8);
  const subheadingIn = useEase(1.0, 0.7);
  const key = region.join(",");
  const center = useMemo(() => regionCenter(key ? key.split(",") : []), [key]);

  return (
    <AbsoluteFill
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 60,
        padding: `0 ${VIDEO.sideMargin - 60}px ${VIDEO.captionSpace - 60}px ${VIDEO.sideMargin}px`,
      }}
    >
      <div style={{ flex: 1 }}>
        <div
          style={{
            maxWidth: center ? 900 : 1450,
            fontFamily: FONTS.display,
            fontSize: center ? VIDEO.fontSize.title * 0.85 : VIDEO.fontSize.title,
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
      </div>
      {center ? <Globe center={center} region={region} /> : null}
    </AbsoluteFill>
  );
}

// Turns from 70 degrees east of the region to face it, then fills the region's countries in amber.
function Globe({ center, region }: { center: [number, number]; region: string[] }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const turn = ease(frame, fps, 0, 3.2);
  const fill = ease(frame, fps, 2.4, 0.9);
  const tilt = Math.max(-35, Math.min(35, center[1]));
  const projection = geoOrthographic()
    .scale(GLOBE / 2 - 20)
    .translate([GLOBE / 2, GLOBE / 2])
    .rotate([-(center[0] + 70 * (1 - turn)), -tilt * turn]);
  const path = geoPath(projection);
  const highlight = interpolateColors(fill, [0, 1], [COLORS.land, COLORS.signal]);

  return (
    <svg width={GLOBE} height={GLOBE} viewBox={`0 0 ${GLOBE} ${GLOBE}`} style={{ opacity: ease(frame, fps, 0, 0.8) }}>
      <circle cx={GLOBE / 2} cy={GLOBE / 2} r={GLOBE / 2 - 20} fill={COLORS.globe} />
      <path d={path(graticule) ?? ""} fill="none" stroke={COLORS.border} strokeWidth={1} opacity={0.5} />
      {globeCountries.map(({ code, shape }, index) => (
        <path
          key={index}
          d={path(shape) ?? ""}
          fill={code && region.includes(code) ? highlight : COLORS.land}
          stroke={COLORS.border}
          strokeWidth={1}
        />
      ))}
      <circle cx={GLOBE / 2} cy={GLOBE / 2} r={GLOBE / 2 - 20} fill="none" stroke={COLORS.border} strokeWidth={3} />
    </svg>
  );
}
