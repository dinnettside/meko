import { geoGraticule10, geoOrthographic, geoPath } from "d3-geo";
import { useId, useMemo } from "react";
import { AbsoluteFill, interpolateColors, useCurrentFrame, useVideoConfig } from "remotion";
import { subtitleFor } from "@/lib/looks-intro";
import { VIDEO } from "@/lib/theme";
import { globeCountries, regionCenter } from "../globe";
import { Hatch } from "../hatch";
import { Icon } from "../icons";
import { ease, useEase } from "../motion";
import { alpha, useTheme } from "../theme";

const GLOBE = 760; // size of the globe drawing, in pixels
const ICON_SIZE = 460; // size of the topic's icon in a video without places
// When the picture sits above the heading, it is smaller, so a heading of two or three lines still fits over the
// captions; a short heading takes one line and leaves room for a bigger picture.
const STACKED_GLOBE = { short: 420, long: 340 };
const STACKED_ICON = { short: 340, long: 280 };
const graticule = geoGraticule10();

// A number from a text, the same every time (the same hash as lib/looks.ts), so a video always opens the same way.
function hash(text: string): number {
  let value = 2166136261;
  for (const char of text) value = Math.imul(value ^ char.charCodeAt(0), 16777619) >>> 0;
  return value;
}

// The opening: a big serif heading with an amber rule under it. When the video has maps, a globe turns to the
// part of the world the story is about; in a video without places, a big icon for the topic can take its place.
// `seed` is the video's title, so a choice made from it is the same every time the video plays: about half of the
// videos have the picture beside the heading, the others have it above a centered heading, so the videos that open
// with their own title card do not all open alike.
export function TitleScene({ heading, subheading: given, icon, region, seed }: { heading: string; subheading?: string; icon?: string; region: string[]; seed?: string }) {
  const { colors, fonts } = useTheme();
  // A subheading that only asks the heading again ("How do volcanoes erupt?" under "How Volcanoes Erupt") is left out.
  const subheading = subtitleFor(heading, given);
  const headingIn = useEase(0.2, 0.8);
  const ruleIn = useEase(0.7, 0.8);
  const subheadingIn = useEase(1.0, 0.7);
  const key = region.join(",");
  const center = useMemo(() => regionCenter(key ? key.split(",") : []), [key]);

  // A bit from the middle of the hash. The lowest bit only counts the letters with odd codes, and the same count
  // decides whether pickIntro (lib/looks.ts) keeps this title card at all, so the videos that kept it nearly always
  // got the same layout.
  if ((hash(seed ?? heading) >>> 16) % 2 === 1) {
    const length = heading.length <= 30 ? "short" : "long";
    const picture = center ? (
      <Globe center={center} region={region} size={STACKED_GLOBE[length]} />
    ) : icon ? (
      <TopicIcon name={icon} size={STACKED_ICON[length]} width={STACKED_ICON[length]} />
    ) : null;
    // A long heading is set smaller, so it takes no more than three lines.
    const size = picture ? (heading.length > 44 ? 0.58 : 0.68) * VIDEO.fontSize.title : VIDEO.fontSize.title;
    return (
      <AbsoluteFill
        style={{
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: `40px ${VIDEO.sideMargin}px ${VIDEO.captionSpace - 40}px`,
        }}
      >
        {picture}
        <div
          style={{
            marginTop: picture ? 44 : 0,
            maxWidth: 1480,
            fontFamily: fonts.display,
            fontSize: size * fonts.displayScale,
            fontWeight: fonts.displayWeight,
            lineHeight: 1.04,
            textWrap: "balance",
            color: colors.paper,
            opacity: headingIn,
            transform: `translateY(${(1 - headingIn) * 30}px)`,
          }}
        >
          {heading}
        </div>
        <div style={{ width: 200 * ruleIn, height: 10, marginTop: 36, backgroundColor: colors.signal }} />
        {subheading ? (
          <div style={{ marginTop: 28, maxWidth: 1400, fontFamily: fonts.body, fontSize: VIDEO.fontSize.subtitle, textWrap: "balance", color: colors.dim, opacity: subheadingIn }}>
            {subheading}
          </div>
        ) : null}
      </AbsoluteFill>
    );
  }

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
            maxWidth: center || icon ? 900 : 1450,
            fontFamily: fonts.display,
            fontSize: (center || icon ? VIDEO.fontSize.title * 0.85 : VIDEO.fontSize.title) * fonts.displayScale,
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
      {center ? <Globe center={center} region={region} /> : icon ? <TopicIcon name={icon} /> : null}
    </AbsoluteFill>
  );
}

// A big icon for the topic where a video about places has its globe, in a box as wide as the globe beside the heading.
// It grows in and settles with a small turn.
function TopicIcon({ name, size = ICON_SIZE, width = GLOBE }: { name: string; size?: number; width?: number }) {
  const { colors } = useTheme();
  const appear = useEase(0.2, 1.1);
  return (
    <div
      style={{
        width,
        display: "flex",
        justifyContent: "center",
        opacity: appear,
        transform: `scale(${0.7 + 0.3 * appear}) rotate(${(1 - appear) * -10}deg)`,
      }}
    >
      <Icon name={name} size={size} color={colors.signal} />
    </div>
  );
}

// Turns from 70 degrees east of the region to face it, then fills the region's countries in amber. In Blueprint the
// countries are chalk outlines and the region is hatched, as on its maps.
function Globe({ center, region, size = GLOBE }: { center: [number, number]; region: string[]; size?: number }) {
  const { colors, drawing } = useTheme();
  const hatchId = `hatch${useId().replace(/[^A-Za-z0-9]/g, "")}`;
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const turn = ease(frame, fps, 0, 3.2);
  const fill = ease(frame, fps, 2.4, 0.9);
  const tilt = Math.max(-35, Math.min(35, center[1]));
  const projection = geoOrthographic()
    .scale(size / 2 - 20)
    .translate([size / 2, size / 2])
    .rotate([-(center[0] + 70 * (1 - turn)), -tilt * turn]);
  const path = geoPath(projection);
  const highlight = interpolateColors(fill, [0, 1], [colors.land, colors.signal]);
  const outlined = drawing.land === "outline";
  const chalk = alpha(colors.paper, 0.55);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ opacity: ease(frame, fps, 0, 0.8) }}>
      {outlined ? (
        <defs>
          <Hatch id={hatchId} color={highlight} background={colors.land} />
        </defs>
      ) : null}
      <circle cx={size / 2} cy={size / 2} r={size / 2 - 20} fill={colors.globe} />
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
      <circle cx={size / 2} cy={size / 2} r={size / 2 - 20} fill="none" stroke={outlined ? chalk : colors.border} strokeWidth={3} />
    </svg>
  );
}
