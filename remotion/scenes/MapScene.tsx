import { useMemo } from "react";
import { AbsoluteFill, interpolateColors, useCurrentFrame, useVideoConfig } from "remotion";
import { COUNTRIES } from "@/lib/countries";
import type { TimedWord } from "@/lib/elevenlabs";
import type { Scene } from "@/lib/storyboard";
import { countryContains } from "@/lib/world";
import { cameraFrom, fitProjection, layoutMap, mapCodes } from "../geo";
import { ease } from "../motion";
import { revealAt } from "../spoken";
import { COLORS, FONTS, MOTION, VIDEO } from "@/lib/theme";

type MapSceneData = Extract<Scene, { kind: "map" }>;
type Point = [number, number];
type Box = { x: number; y: number; w: number; h: number };
type LabelSpec = { text: string; strong: boolean; startSec: number; at: Point; offsets: Point[] };
type PlacedLabel = { text: string; strong: boolean; startSec: number; x: number; y: number };

const { width: WIDTH, height: HEIGHT, captionSpace: CAPTION_SPACE } = VIDEO;
const BOX: [[number, number], [number, number]] = [
  [VIDEO.mapPadding, 110],
  [WIDTH - VIDEO.mapPadding, HEIGHT - CAPTION_SPACE - 30],
];
const TONES = { primary: COLORS.signal, secondary: COLORS.teal, muted: COLORS.muted };
// Where an arrow meets a country whose middle is far from where its history mostly happened: Russia's is deep in
// Siberia, so arrows go to the European part instead.
const ANCHORS: Record<string, [number, number]> = { RUS: [40, 55] };
const fontSize = (strong: boolean) => (strong ? VIDEO.fontSize.mapLabelStrong : VIDEO.fontSize.mapLabel);

// Rough size of a label, since text cannot be measured here. Archivo is about 0.56 em wide per character.
function labelBox(x: number, y: number, text: string, strong: boolean): Box {
  return { x, y, w: text.length * fontSize(strong) * 0.56 + 20, h: fontSize(strong) * 1.3 };
}

const overlaps = (a: Box, b: Box) => Math.abs(a.x - b.x) * 2 < a.w + b.w && Math.abs(a.y - b.y) * 2 < a.h + b.h;

// Tries each label's spots in order and keeps the first one that hits no other label or city dot.
// A label with no free spot is left out, so the map never gets cluttered.
function placeLabels(specs: LabelSpec[], dots: Point[]): PlacedLabel[] {
  const taken: Box[] = dots.map(([x, y]) => ({ x, y, w: 32, h: 32 }));
  const placed: PlacedLabel[] = [];
  for (const spec of specs) {
    for (const [dx, dy] of spec.offsets) {
      const box = labelBox(spec.at[0] + dx, spec.at[1] + dy, spec.text, spec.strong);
      const onScreen =
        box.x - box.w / 2 > 0 && box.x + box.w / 2 < WIDTH && box.y - box.h / 2 > 0 && box.y + box.h / 2 < HEIGHT - CAPTION_SPACE + 80;
      if (onScreen && !taken.some((other) => overlaps(box, other))) {
        taken.push(box);
        placed.push({ text: spec.text, strong: spec.strong, startSec: spec.startSec, x: box.x, y: box.y });
        break;
      }
    }
  }
  return placed;
}

// Everything about the map that does not move: the projection, the places, where the labels go, and when each
// part appears. A country, city or arrow comes in as the narration names it, or one after another if it never does.
function planMap(scene: MapSceneData, words: TimedWord[], durationSec: number) {
  const arrows = scene.arrows ?? [];
  const markers = scene.markers ?? [];
  const layout = layoutMap(mapCodes(scene), BOX);
  const markerStart = 0.6 + scene.highlights.length * 0.35;
  const arrowStart = markerStart + markers.length * 0.25 + 0.2;
  const reveal = (text: string, fallbackSec: number) => revealAt(words, text, fallbackSec, 0.4, durationSec);
  const fillStarts = scene.highlights.map((highlight, index) =>
    reveal(`${highlight.label ?? ""} ${COUNTRIES[highlight.country]?.name ?? ""}`, 0.5 + index * 0.35),
  );
  // A city the narration does not name comes in with its country.
  const countryStart = (marker: { lon: number; lat: number }) =>
    fillStarts.find((_, index) => countryContains(scene.highlights[index].country, marker.lon, marker.lat));

  const dots = markers.flatMap((marker, index) => {
    const point = layout.project(marker.lon, marker.lat);
    const startSec = reveal(marker.label, countryStart(marker) ?? markerStart + index * 0.25);
    return point ? [{ marker, point, startSec }] : [];
  });
  // An arrow starts or ends at a city in that country when there is one, else in the middle of the country.
  const anchor = (code: string): Point | null =>
    dots.find(({ marker }) => countryContains(code, marker.lon, marker.lat))?.point ??
    (ANCHORS[code] ? layout.project(...ANCHORS[code]) : null) ??
    layout.pointOf(code);
  // An arrow draws once the places it joins are on the map: their countries colored and their cities marked.
  const placeStart = (code: string) =>
    Math.max(
      0,
      ...scene.highlights.flatMap((highlight, index) => (highlight.country === code ? [fillStarts[index] + 0.2] : [])),
      ...dots.filter(({ marker }) => countryContains(code, marker.lon, marker.lat)).map((dot) => dot.startSec + 0.2),
    );
  const curves = arrows.flatMap((arrow, index) => {
    const from = anchor(arrow.from);
    const to = anchor(arrow.to);
    if (!from || !to || (from[0] === to[0] && from[1] === to[1])) return [];
    // Bend the line to one side by a fifth of its length.
    const control: Point = [(from[0] + to[0]) / 2 - (to[1] - from[1]) * 0.2, (from[1] + to[1]) / 2 + (to[0] - from[0]) * 0.2];
    const startSec = Math.max(reveal(arrow.label ?? "", arrowStart + index * 0.6), placeStart(arrow.from), placeStart(arrow.to));
    return [{ arrow, from, to, control, startSec }];
  });

  const specs: LabelSpec[] = dots.map(({ marker, point, startSec }) => {
    const halfWidth = labelBox(0, 0, marker.label, false).w / 2 + 24;
    return {
      text: marker.label,
      strong: false,
      startSec: startSec + 0.1,
      at: point,
      offsets: [[0, -40], [0, 44], [halfWidth, 0], [-halfWidth, 0]],
    };
  });
  // Only the main country gets a name, and only if no city already labels it.
  scene.highlights.forEach((highlight, index) => {
    const point = layout.pointOf(highlight.country);
    const hasCity = dots.some(({ marker }) => countryContains(highlight.country, marker.lon, marker.lat));
    if (highlight.tone !== "primary" || !highlight.label || !point || hasCity) return;
    specs.push({ text: highlight.label, strong: true, startSec: fillStarts[index] + 0.3, at: point, offsets: [[0, 0], [0, -56], [0, 56]] });
  });
  // With several arrows, labels crowd the map, so only a single arrow gets one.
  const [only] = curves;
  if (curves.length === 1 && only.arrow.label) {
    const middle: Point = [
      0.25 * only.from[0] + 0.5 * only.control[0] + 0.25 * only.to[0],
      0.25 * only.from[1] + 0.5 * only.control[1] + 0.25 * only.to[1],
    ];
    specs.push({ text: only.arrow.label, strong: true, startSec: only.startSec + 0.9, at: middle, offsets: [[0, -36], [0, 36]] });
  }

  return { layout, dots, curves, fillStarts, labels: placeLabels(specs, dots.map((dot) => dot.point)) };
}

// A flat map. The camera eases in on the countries, the highlighted ones fill with color one by one,
// cities appear as dots, and arrows draw from one place to the next. When the scene before is a map too, the
// camera flies on from where that map was and its colors change into the new ones, so it plays as one map.
export function MapScene({
  scene,
  previous,
  words,
  durationSec,
}: {
  scene: MapSceneData;
  previous?: MapSceneData;
  words: TimedWord[];
  durationSec: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const plan = useMemo(() => planMap(scene, words, durationSec), [scene, words, durationSec]);
  const start = useMemo(
    () => (previous ? cameraFrom(fitProjection(mapCodes(previous), BOX), plan.layout.projection) : null),
    [previous, plan],
  );

  const camera = ease(frame, fps, 0, MOTION.cameraMove);
  const centerX = WIDTH / 2;
  const centerY = (BOX[0][1] + BOX[1][1]) / 2;
  let transform = `translate(${centerX} ${centerY}) scale(${0.84 + 0.16 * camera}) translate(${-centerX} ${-centerY})`;
  if (start) {
    // Zoom at an even pace, while the spot in the middle of the screen moves in a straight line.
    const scale = Math.pow(start.scale, 1 - camera);
    const fromX = (centerX - start.x) / start.scale;
    const fromY = (centerY - start.y) / start.scale;
    const middleX = fromX + (centerX - fromX) * camera;
    const middleY = fromY + (centerY - fromY) * camera;
    transform = `translate(${centerX - scale * middleX} ${centerY - scale * middleY}) scale(${scale})`;
  }
  // Countries the map before colored start in that color. Those it no longer needs fade back to land.
  const before = new Map((previous?.highlights ?? []).map((highlight) => [highlight.country, TONES[highlight.tone]]));
  const fills = new Map(
    [...before].map(([code, color]) => [code, interpolateColors(ease(frame, fps, 0.2, 0.6), [0, 1], [color, COLORS.land])]),
  );
  scene.highlights.forEach((highlight, index) => {
    const progress = ease(frame, fps, plan.fillStarts[index], 0.6);
    fills.set(highlight.country, interpolateColors(progress, [0, 1], [before.get(highlight.country) ?? COLORS.land, TONES[highlight.tone]]));
  });

  return (
    <AbsoluteFill>
      <svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
        <g transform={transform}>
          {plan.layout.paths.map((country, index) => (
            <path
              key={index}
              d={country.d}
              fill={(country.code && fills.get(country.code)) || COLORS.land}
              stroke={COLORS.border}
              strokeWidth={1.2}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {plan.curves.map((curve, index) => (
            <Arrow key={index} {...curve} progress={ease(frame, fps, curve.startSec, 1.0)} />
          ))}
          {plan.dots.map(({ point, startSec }, index) => {
            const appear = ease(frame, fps, startSec, 0.4);
            return <circle key={index} cx={point[0]} cy={point[1]} r={12 * appear} fill={COLORS.paper} stroke={COLORS.ink} strokeWidth={4} />;
          })}
          {plan.labels.map((label, index) => (
            <MapLabel key={index} {...label} opacity={ease(frame, fps, label.startSec, 0.4)} />
          ))}
        </g>
      </svg>
    </AbsoluteFill>
  );
}

// A curved arrow that draws itself. The head appears when the line arrives.
function Arrow({ from, to, control, progress }: { from: Point; to: Point; control: Point; progress: number }) {
  const angle = (Math.atan2(to[1] - control[1], to[0] - control[0]) * 180) / Math.PI;
  const d = `M ${from[0]} ${from[1]} Q ${control[0]} ${control[1]} ${to[0]} ${to[1]}`;
  const head = { opacity: progress > 0.9 ? (progress - 0.9) * 10 : 0, transform: `translate(${to[0]} ${to[1]}) rotate(${angle})` };
  // A dark edge under the amber line keeps the arrow visible over an amber country.
  return (
    <g>
      <path d={d} fill="none" stroke={COLORS.ink} strokeWidth={16} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - progress} />
      <path d={d} fill="none" stroke={COLORS.signal} strokeWidth={8} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - progress} />
      <path d="M 0 0 L -30 -16 L -30 16 Z" fill={COLORS.signal} stroke={COLORS.ink} strokeWidth={4} strokeLinejoin="round" {...head} />
    </g>
  );
}

function MapLabel({ x, y, text, opacity, strong }: { x: number; y: number; text: string; opacity: number; strong: boolean }) {
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      dominantBaseline="middle"
      fontFamily={FONTS.body}
      fontSize={fontSize(strong)}
      fontWeight={strong ? 700 : 500}
      fill={COLORS.paper}
      stroke={COLORS.ink}
      strokeWidth={10}
      paintOrder="stroke"
      strokeLinejoin="round"
      opacity={opacity}
    >
      {text}
    </text>
  );
}
