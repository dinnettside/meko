import { useMemo } from "react";
import { AbsoluteFill, interpolateColors, useCurrentFrame, useVideoConfig } from "remotion";
import type { Scene } from "@/lib/storyboard";
import { countryContains } from "@/lib/world";
import { layoutMap } from "../geo";
import { ease } from "../motion";
import { CAPTION_SPACE, COLORS, FONTS } from "../theme";

type MapSceneData = Extract<Scene, { kind: "map" }>;
type Point = [number, number];
type Box = { x: number; y: number; w: number; h: number };
type LabelSpec = { text: string; strong: boolean; startSec: number; at: Point; offsets: Point[] };
type PlacedLabel = { text: string; strong: boolean; startSec: number; x: number; y: number };

const WIDTH = 1920;
const HEIGHT = 1080;
const BOX: [[number, number], [number, number]] = [
  [240, 110],
  [WIDTH - 240, HEIGHT - CAPTION_SPACE - 30],
];
const TONES = { primary: COLORS.signal, secondary: COLORS.teal, muted: COLORS.muted };
const fontSize = (strong: boolean) => (strong ? 46 : 38);

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

// Everything about the map that does not move: the projection, the places and where the labels go.
function planMap(scene: MapSceneData) {
  const arrows = scene.arrows ?? [];
  const markers = scene.markers ?? [];
  // Fit the camera to every country the scene mentions, not only the ones in `frame`.
  const codes = [
    ...new Set([...scene.frame, ...scene.highlights.map((h) => h.country), ...arrows.flatMap((a) => [a.from, a.to])]),
  ];
  const layout = layoutMap(codes, BOX);
  const markerStart = 0.6 + scene.highlights.length * 0.35;
  const arrowStart = markerStart + markers.length * 0.25 + 0.2;

  const dots = markers.flatMap((marker) => {
    const point = layout.project(marker.lon, marker.lat);
    return point ? [{ marker, point }] : [];
  });
  // An arrow starts or ends at a city in that country when there is one, else in the middle of the country.
  const anchor = (code: string): Point | null =>
    dots.find(({ marker }) => countryContains(code, marker.lon, marker.lat))?.point ?? layout.pointOf(code);
  const curves = arrows.flatMap((arrow) => {
    const from = anchor(arrow.from);
    const to = anchor(arrow.to);
    if (!from || !to || (from[0] === to[0] && from[1] === to[1])) return [];
    // Bend the line to one side by a fifth of its length.
    const control: Point = [(from[0] + to[0]) / 2 - (to[1] - from[1]) * 0.2, (from[1] + to[1]) / 2 + (to[0] - from[0]) * 0.2];
    return [{ arrow, from, to, control }];
  });

  const specs: LabelSpec[] = dots.map(({ marker, point }, index) => {
    const halfWidth = labelBox(0, 0, marker.label, false).w / 2 + 24;
    return {
      text: marker.label,
      strong: false,
      startSec: markerStart + index * 0.25 + 0.1,
      at: point,
      offsets: [[0, -40], [0, 44], [halfWidth, 0], [-halfWidth, 0]],
    };
  });
  // Only the main country gets a name, and only if no city already labels it.
  scene.highlights.forEach((highlight, index) => {
    const point = layout.pointOf(highlight.country);
    const hasCity = dots.some(({ marker }) => countryContains(highlight.country, marker.lon, marker.lat));
    if (highlight.tone !== "primary" || !highlight.label || !point || hasCity) return;
    specs.push({ text: highlight.label, strong: true, startSec: 0.8 + index * 0.35, at: point, offsets: [[0, 0], [0, -56], [0, 56]] });
  });
  // With several arrows, labels crowd the map, so only a single arrow gets one.
  const [only] = curves;
  if (curves.length === 1 && only.arrow.label) {
    const middle: Point = [
      0.25 * only.from[0] + 0.5 * only.control[0] + 0.25 * only.to[0],
      0.25 * only.from[1] + 0.5 * only.control[1] + 0.25 * only.to[1],
    ];
    specs.push({ text: only.arrow.label, strong: true, startSec: arrowStart + 0.9, at: middle, offsets: [[0, -36], [0, 36]] });
  }

  return { layout, dots, curves, labels: placeLabels(specs, dots.map((dot) => dot.point)), markerStart, arrowStart };
}

// A flat map. The camera eases in on the countries, the highlighted ones fill with color one by one,
// cities appear as dots, and arrows draw from one place to the next.
export function MapScene({ scene }: { scene: MapSceneData }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const plan = useMemo(() => planMap(scene), [scene]);

  const camera = ease(frame, fps, 0, 1.8);
  const scale = 0.84 + 0.16 * camera;
  const centerX = WIDTH / 2;
  const centerY = (BOX[0][1] + BOX[1][1]) / 2;
  const fills = new Map(
    scene.highlights.map((highlight, index) => {
      const progress = ease(frame, fps, 0.5 + index * 0.35, 0.6);
      return [highlight.country, interpolateColors(progress, [0, 1], [COLORS.land, TONES[highlight.tone]])];
    }),
  );

  return (
    <AbsoluteFill>
      <svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
        <g transform={`translate(${centerX} ${centerY}) scale(${scale}) translate(${-centerX} ${-centerY})`}>
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
            <Arrow key={index} {...curve} progress={ease(frame, fps, plan.arrowStart + index * 0.6, 1.0)} />
          ))}
          {plan.dots.map(({ point }, index) => {
            const appear = ease(frame, fps, plan.markerStart + index * 0.25, 0.4);
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
  return (
    <g>
      <path
        d={`M ${from[0]} ${from[1]} Q ${control[0]} ${control[1]} ${to[0]} ${to[1]}`}
        fill="none"
        stroke={COLORS.signal}
        strokeWidth={8}
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={1 - progress}
      />
      <path
        d="M 0 0 L -30 -16 L -30 16 Z"
        fill={COLORS.signal}
        opacity={progress > 0.9 ? (progress - 0.9) * 10 : 0}
        transform={`translate(${to[0]} ${to[1]}) rotate(${angle})`}
      />
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
