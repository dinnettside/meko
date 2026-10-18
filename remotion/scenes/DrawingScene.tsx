import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { TimedWord } from "@/lib/elevenlabs";
import { drawingCanvas } from "@/lib/drawing";
import type { DrawingPart, DrawingTone } from "@/lib/storyboard";
import { DRAWING, VIDEO } from "@/lib/theme";
import { Icon } from "../icons";
import { ease } from "../motion";
import { revealTimes } from "../spoken";
import { alpha, mix, useTheme } from "../theme";
import type { Theme } from "@/lib/themes";

type Point = [number, number];

// Natural colors for things that have one, the same in every look.
const HOT = "#E8572A";
const WATER = "#3D85C6";
const PLANT = "#4F9D4F";
// The drawing's grid fills the free part of the frame (see lib/drawing.ts). Layers run across the whole frame, and one
// that reaches the bottom runs under the captions to the edge.
const { titleSize: TITLE_SIZE, labelSize: LABEL_SIZE, tubeWidth: TUBE_WIDTH, iconSizes: ICON_SIZES } = DRAWING;
// Each part comes in a moment after the one before, so the picture builds up back to front.
const PART_SEC = 0.5;
const SETTLE_SEC = 0.9; // everything is in place this long before the end, since the next scene dissolves in
const FLOW_DOTS = 7;

// The color of a tone in the look: the look's own colors for the ground, rock, the air and the highlights.
function toneColor(tone: DrawingTone, { colors }: Theme): string {
  switch (tone) {
    case "ground":
      return colors.land;
    case "rock":
      return mix(colors.paper, colors.land, 0.14);
    case "hot":
      return HOT;
    case "water":
      return WATER;
    case "air":
      return mix(colors.paper, colors.ink, 0.1);
    case "plant":
      return PLANT;
    case "signal":
      return colors.signal;
    case "second":
      return colors.teal;
    case "pale":
      return mix(colors.paper, colors.ink, 0.3);
  }
}

// How a shape is painted in the look: flat in Night atlas, as an outline over the ground in Blueprint, and as an ink
// outline over a pale tint in Field guide, like the icons.
function paintOf(color: string, tone: DrawingTone, theme: Theme): { fill: string; stroke: string; strokeWidth: number } {
  const { colors, drawing } = theme;
  // The look's own tones are close to the ground, so in Blueprint they are outlined in chalk to be seen.
  const quiet = tone === "ground" || tone === "rock" || tone === "air" || tone === "pale";
  // Tones can be mixed colors, which `alpha` cannot take, so the pale fill is mixed into the ground instead.
  if (drawing.icon === "outline") return { fill: mix(color, colors.ink, 0.18), stroke: quiet ? mix(colors.paper, colors.ink, 0.6) : color, strokeWidth: 4 };
  if (drawing.icon === "ink") return { fill: mix(color, colors.ink, 0.45), stroke: colors.paper, strokeWidth: 3 };
  return { fill: color, stroke: "none", strokeWidth: 0 };
}

// The length of a line through points, and the point at a distance along it.
function lengthOf(points: Point[]): number {
  return points.slice(1).reduce((total, point, index) => total + Math.hypot(point[0] - points[index][0], point[1] - points[index][1]), 0);
}
function pointAt(points: Point[], distance: number): Point {
  let left = distance;
  for (let index = 1; index < points.length; index++) {
    const [a, b] = [points[index - 1], points[index]];
    const step = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (left <= step) return [a[0] + ((b[0] - a[0]) * left) / Math.max(step, 1e-6), a[1] + ((b[1] - a[1]) * left) / Math.max(step, 1e-6)];
    left -= step;
  }
  return points[points.length - 1];
}

// A diagram the director drew for its topic from simple parts on a 0 to 100 grid: layers, boxes, rounded shapes, peaks,
// tubes, arrows, flowing dots and icons, with labels. The parts come in one after another, back to front; arrows draw
// along their way, dots keep flowing, and each label comes in as the narration names it.
export function DrawingScene({
  title,
  parts,
  labels,
  words,
  durationSec,
}: {
  title?: string;
  parts: DrawingPart[];
  labels: { text: string; x: number; y: number }[];
  words: TimedWord[];
  durationSec: number;
}) {
  const theme = useTheme();
  const { colors, fonts } = theme;
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const time = frame / fps;
  const { left: LEFT, right: RIGHT, X, Y } = drawingCanvas(Boolean(title));
  const doneBy = Math.max(PART_SEC, durationSec - SETTLE_SEC);
  // The parts build up over the first half of the scene, at most a third of a second apart.
  const gap = Math.min(0.35, (doneBy * 0.5) / Math.max(1, parts.length));
  const startOf = (index: number) => Math.min(doneBy - PART_SEC, 0.15 + index * gap);
  const labelStarts = revealTimes(
    labels.map((label) => label.text),
    words,
    { firstSec: 0.4, spreadSec: Math.max(0.8, durationSec * 0.6), gapSec: 0.35, durationSec },
  ).map((sec) => Math.min(doneBy - 0.3, sec));

  return (
    <AbsoluteFill>
      {title ? (
        <div
          style={{
            position: "absolute",
            top: VIDEO.topSpace,
            left: LEFT,
            width: RIGHT - LEFT,
            textAlign: "center",
            fontFamily: fonts.display,
            fontSize: TITLE_SIZE * fonts.displayScale,
            fontWeight: fonts.displayWeight,
            color: colors.paper,
            opacity: ease(frame, fps, 0.1, 0.5),
          }}
        >
          {title}
        </div>
      ) : null}
      <svg width={VIDEO.width} height={VIDEO.height} style={{ position: "absolute", left: 0, top: 0 }}>
        {parts.map((part, index) => (
          <PartShape key={index} part={part} progress={ease(frame, fps, startOf(index), PART_SEC)} time={time - startOf(index)} X={X} Y={Y} theme={theme} />
        ))}
      </svg>
      {parts.map((part, index) =>
        part.shape === "icon" ? (
          <div
            key={`icon${index}`}
            style={{
              position: "absolute",
              left: X(part.x) - ICON_SIZES[part.size] / 2,
              top: Y(part.y) - ICON_SIZES[part.size] / 2,
              opacity: ease(frame, fps, startOf(index), 0.2),
              transform: `scale(${interpolate(frame, [startOf(index) * fps, (startOf(index) + PART_SEC) * fps], [0.4, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.out(Easing.back(1.6)),
              })})`,
            }}
          >
            <Icon name={part.name} size={ICON_SIZES[part.size]} color={colors.paper} />
          </div>
        ) : null,
      )}
      {labels.map((label, index) => {
        const appear = ease(frame, fps, labelStarts[index], 0.4);
        return (
          <div
            key={`label${index}`}
            style={{
              position: "absolute",
              left: X(label.x),
              top: Y(label.y),
              transform: `translate(-50%, -50%) translateY(${(1 - appear) * 14}px)`,
              opacity: appear,
              fontFamily: fonts.body,
              fontSize: LABEL_SIZE,
              fontWeight: 700,
              color: colors.paper,
              whiteSpace: "nowrap",
              // A halo in the ground's color keeps a label readable where it crosses a shape.
              textShadow: `0 0 6px ${colors.ink}, 0 0 3px ${colors.ink}, 0 0 1px ${colors.ink}`,
            }}
          >
            {label.text}
          </div>
        );
      })}
    </AbsoluteFill>
  );
}

function PartShape({
  part,
  progress,
  time,
  X,
  Y,
  theme,
}: {
  part: DrawingPart;
  progress: number;
  time: number; // seconds since the part started to come in
  X: (x: number) => number;
  Y: (y: number) => number;
  theme: Theme;
}) {
  if (progress <= 0 || part.shape === "icon") return null;
  const color = toneColor(part.tone, theme);
  const paint = paintOf(color, part.tone, theme);
  switch (part.shape) {
    case "band": {
      // A layer across the whole frame, wiping in from the left. One that reaches the bottom runs to the frame's edge.
      const y1 = Y(part.y1);
      const y2 = part.y2 >= 99 ? VIDEO.height : Y(part.y2);
      return (
        <g>
          <rect x={0} y={y1} width={VIDEO.width * progress} height={Math.max(0, y2 - y1)} fill={paint.fill} />
          <path d={`M0 ${y1}H${VIDEO.width * progress}`} stroke={theme.drawing.icon === "solid" ? alpha(theme.colors.paper, 0.35) : paint.stroke} strokeWidth={3} />
        </g>
      );
    }
    case "box":
    case "blob":
    case "cone": {
      const [cx, cy, w, h] = [X(part.x), Y(part.y), (part.w / 100) * (VIDEO.width - 2 * VIDEO.sideMargin), (part.h / 100) * (Y(100) - Y(0))];
      const grow = { transform: `translate(${cx}px, ${cy}px) scale(${0.6 + 0.4 * progress}) translate(${-cx}px, ${-cy}px)`, opacity: progress };
      if (part.shape === "box") {
        return <rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} rx={Math.min(w, h) * 0.12} {...paint} style={grow} />;
      }
      if (part.shape === "blob") {
        return <ellipse cx={cx} cy={cy} rx={w / 2} ry={h / 2} {...paint} style={grow} />;
      }
      // A peak grows up from its base, with a narrow flat top like a crater.
      const peak = `M${cx - w / 2} ${cy} L${cx - w * 0.09} ${cy - h * progress} L${cx + w * 0.09} ${cy - h * progress} L${cx + w / 2} ${cy} Z`;
      return <path d={peak} {...paint} strokeLinejoin="round" />;
    }
    case "tube":
    case "arrow": {
      const points: Point[] = part.points.map((point) => [X(point.x), Y(point.y)]);
      const length = lengthOf(points);
      const d = `M${points.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L")}`;
      const drawn = { strokeDasharray: length, strokeDashoffset: length * (1 - progress) };
      if (part.shape === "tube") {
        return (
          <g fill="none" strokeLinecap="round" strokeLinejoin="round">
            {paint.stroke !== "none" ? <path d={d} stroke={paint.stroke} strokeWidth={TUBE_WIDTH + 2 * paint.strokeWidth} style={drawn} /> : null}
            <path d={d} stroke={paint.fill === "none" ? color : theme.drawing.icon === "outline" ? theme.colors.ink : paint.fill} strokeWidth={TUBE_WIDTH} style={drawn} />
          </g>
        );
      }
      // An arrow draws along its way; its head comes when the line is there.
      const [end, before] = [points[points.length - 1], points[points.length - 2]];
      const angle = (Math.atan2(end[1] - before[1], end[0] - before[0]) * 180) / Math.PI;
      return (
        <g>
          <path d={d} fill="none" stroke={color} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" style={drawn} />
          <path
            d="M0 0 L-30 -17 L-30 17 Z"
            fill={color}
            transform={`translate(${end[0]} ${end[1]}) rotate(${angle})`}
            opacity={progress > 0.9 ? (progress - 0.9) * 10 : 0}
          />
        </g>
      );
    }
    case "flow": {
      // Dots that keep moving along the way, the same at every frame for the same time.
      const points: Point[] = part.points.map((point) => [X(point.x), Y(point.y)]);
      const length = lengthOf(points);
      const speed = Math.max(120, length / 2.2); // pixels per second
      return (
        <g opacity={progress}>
          {Array.from({ length: FLOW_DOTS }, (_, index) => {
            const along = (((time * speed) / length + index / FLOW_DOTS) % 1 + 1) % 1;
            const [x, y] = pointAt(points, along * length);
            // A dot fades in at the start of the way and out at its end.
            const fade = Math.min(1, along * 6, (1 - along) * 6);
            return <circle key={index} cx={x} cy={y} r={11} fill={color} stroke={theme.colors.ink} strokeWidth={3} opacity={fade} />;
          })}
        </g>
      );
    }
  }
}
