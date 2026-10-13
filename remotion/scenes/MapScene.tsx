import { useMemo } from "react";
import { AbsoluteFill, interpolateColors, useCurrentFrame, useVideoConfig } from "remotion";
import type { Scene } from "@/lib/storyboard";
import { layoutMap } from "../geo";
import { ease } from "../motion";
import { CAPTION_SPACE, COLORS, FONTS } from "../theme";

type MapSceneData = Extract<Scene, { kind: "map" }>;

const WIDTH = 1920;
const HEIGHT = 1080;
const BOX: [[number, number], [number, number]] = [
  [240, 110],
  [WIDTH - 240, HEIGHT - CAPTION_SPACE - 30],
];
const TONES = { primary: COLORS.signal, secondary: COLORS.teal, muted: COLORS.muted };

// A flat map. The camera eases in on the countries, the highlighted ones fill with color one by one,
// and arrows draw from one country to the next.
export function MapScene({ scene }: { scene: MapSceneData }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const arrows = scene.arrows ?? [];
  // Fit the camera to every country the scene mentions, not only the ones in `frame`.
  const codes = [
    ...new Set([
      ...scene.frame,
      ...scene.highlights.map((highlight) => highlight.country),
      ...arrows.flatMap((arrow) => [arrow.from, arrow.to]),
    ]),
  ];
  const key = codes.join(",");
  const layout = useMemo(() => layoutMap(key.split(","), BOX), [key]);

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
  const arrowStart = 0.8 + scene.highlights.length * 0.35;

  return (
    <AbsoluteFill>
      <svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
        <g transform={`translate(${centerX} ${centerY}) scale(${scale}) translate(${-centerX} ${-centerY})`}>
          {layout.paths.map((country, index) => (
            <path
              key={index}
              d={country.d}
              fill={(country.code && fills.get(country.code)) || COLORS.land}
              stroke={COLORS.border}
              strokeWidth={1.2}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {arrows.map((arrow, index) => {
            const from = layout.pointOf(arrow.from);
            const to = layout.pointOf(arrow.to);
            if (!from || !to) return null;
            return (
              <Arrow
                key={index}
                from={from}
                to={to}
                label={arrow.label}
                progress={ease(frame, fps, arrowStart + index * 0.6, 1.0)}
              />
            );
          })}
          {scene.highlights.map((highlight, index) => {
            const point = layout.pointOf(highlight.country);
            if (!highlight.label || !point) return null;
            return (
              <MapLabel
                key={index}
                x={point[0]}
                y={point[1]}
                text={highlight.label}
                opacity={ease(frame, fps, 0.8 + index * 0.35, 0.5)}
                strong={highlight.tone === "primary"}
              />
            );
          })}
        </g>
      </svg>
    </AbsoluteFill>
  );
}

// A curved arrow that draws itself. The head appears when the line arrives.
function Arrow({
  from,
  to,
  label,
  progress,
}: {
  from: [number, number];
  to: [number, number];
  label?: string;
  progress: number;
}) {
  const [x1, y1] = from;
  const [x2, y2] = to;
  const length = Math.hypot(x2 - x1, y2 - y1);
  // Bend the line to one side by a fifth of its length.
  const controlX = (x1 + x2) / 2 - ((y2 - y1) / length) * length * 0.2;
  const controlY = (y1 + y2) / 2 + ((x2 - x1) / length) * length * 0.2;
  const angle = (Math.atan2(y2 - controlY, x2 - controlX) * 180) / Math.PI;
  const headOpacity = progress > 0.9 ? (progress - 0.9) * 10 : 0;
  return (
    <g>
      <path
        d={`M ${x1} ${y1} Q ${controlX} ${controlY} ${x2} ${y2}`}
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
        opacity={headOpacity}
        transform={`translate(${x2} ${y2}) rotate(${angle})`}
      />
      {label ? (
        <MapLabel x={(x1 + x2) / 2 + (controlX - (x1 + x2) / 2) * 0.5} y={(y1 + y2) / 2 + (controlY - (y1 + y2) / 2) * 0.5} text={label} opacity={headOpacity} strong />
      ) : null}
    </g>
  );
}

function MapLabel({ x, y, text, opacity, strong }: { x: number; y: number; text: string; opacity: number; strong?: boolean }) {
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      dominantBaseline="middle"
      fontFamily={FONTS.body}
      fontSize={strong ? 46 : 38}
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
