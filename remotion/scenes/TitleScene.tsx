import { geoGraticule10, geoOrthographic, geoPath } from "d3-geo";
import { useId, useMemo } from "react";
import { AbsoluteFill, interpolateColors, useCurrentFrame, useVideoConfig } from "remotion";
import { VIDEO } from "@/lib/theme";
import { globeCountries, regionCenter } from "../globe";
import { Hatch } from "../hatch";
import { ease, useEase } from "../motion";
import { alpha, useTheme } from "../theme";

const GLOBE = 760; // size of the globe drawing, in pixels
const graticule = geoGraticule10();

// The opening: a big serif heading with an amber rule under it. When the video has maps, a globe turns to the
// part of the world the story is about.
export function TitleScene({ heading, subheading, region }: { heading: string; subheading?: string; region: string[] }) {
  const { colors, fonts } = useTheme();
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
            fontFamily: fonts.display,
            fontSize: (center ? VIDEO.fontSize.title * 0.85 : VIDEO.fontSize.title) * fonts.displayScale,
            fontWeight: fonts.displayWeight,
            lineHeight: 1.04,
            color: colors.paper,
            opacity: headingIn,
            transform: `translateY(${(1 - headingIn) * 30}px)`,
          }}
        >
          {heading}
        </div>
        <div style={{ width: 260 * ruleIn, height: 12, marginTop: 56, backgroundColor: colors.signal }} />
        {subheading ? (
          <div style={{ marginTop: 44, fontFamily: fonts.body, fontSize: VIDEO.fontSize.subtitle, color: colors.dim, opacity: subheadingIn }}>
            {subheading}
          </div>
        ) : null}
      </div>
      {center ? <Globe center={center} region={region} /> : null}
    </AbsoluteFill>
  );
}

// Turns from 70 degrees east of the region to face it, then fills the region's countries in amber. In Blueprint the
// countries are chalk outlines and the region is hatched, as on its maps.
function Globe({ center, region }: { center: [number, number]; region: string[] }) {
  const { colors, drawing } = useTheme();
  const hatchId = `hatch${useId().replace(/[^A-Za-z0-9]/g, "")}`;
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
  const highlight = interpolateColors(fill, [0, 1], [colors.land, colors.signal]);
  const outlined = drawing.land === "outline";
  const chalk = alpha(colors.paper, 0.55);

  return (
    <svg width={GLOBE} height={GLOBE} viewBox={`0 0 ${GLOBE} ${GLOBE}`} style={{ opacity: ease(frame, fps, 0, 0.8) }}>
      {outlined ? (
        <defs>
          <Hatch id={hatchId} color={highlight} background={colors.land} />
        </defs>
      ) : null}
      <circle cx={GLOBE / 2} cy={GLOBE / 2} r={GLOBE / 2 - 20} fill={colors.globe} />
      <path d={path(graticule) ?? ""} fill="none" stroke={colors.border} strokeWidth={1} opacity={0.5} />
      {globeCountries.map(({ shape }, index) => (
        <path key={index} d={path(shape) ?? ""} fill={colors.land} stroke={outlined ? chalk : colors.border} strokeWidth={1} />
      ))}
      {/* The region on top, without overseas territories. */}
      {globeCountries
        .filter(({ code }) => code && region.includes(code))
        .map(({ home }, index) => (
          <path
            key={index}
            d={path(home) ?? ""}
            fill={outlined ? `url(#${hatchId})` : highlight}
            stroke={outlined ? interpolateColors(fill, [0, 1], [chalk, colors.signal]) : colors.border}
            strokeWidth={outlined ? 2 : 1}
          />
        ))}
      <circle cx={GLOBE / 2} cy={GLOBE / 2} r={GLOBE / 2 - 20} fill="none" stroke={outlined ? chalk : colors.border} strokeWidth={3} />
    </svg>
  );
}
