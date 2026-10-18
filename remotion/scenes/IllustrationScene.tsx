import { useMemo } from "react";
import type { ReactNode } from "react";
import { AbsoluteFill, Easing, interpolate, interpolateColors, useCurrentFrame, useVideoConfig } from "remotion";
import type { TimedWord } from "@/lib/elevenlabs";
import type { Backdrop, FigureLook } from "@/lib/storyboard";
import { VIDEO } from "@/lib/theme";
import { FIGURE_ASPECT, Figure } from "../figures";
import { Icon } from "../icons";
import { ease } from "../motion";
import { revealTimes } from "../spoken";
import { alpha, useTheme } from "../theme";

type ItemSize = "small" | "medium" | "large";
type Item = { icon?: string; figure?: FigureLook; label?: string; x: number; y: number; size?: ItemSize };
type Link = { from: number; to: number; label?: string };
type Point = [number, number];
type Box = { left: number; top: number; right: number; bottom: number };
type Label = { lines: string[]; fontSize: number; width: number; height: number };
// An item at the size it is drawn: its picture (`size` tall and `width` wide; a figure is narrower than an icon), its
// label, and how far it reaches from the middle of its picture.
type Measured = { size: number; width: number; label: Label | null; half: number; above: number; below: number };
type Layout = { points: Point[]; measured: Measured[] };
type GapOf = (a: number, b: number) => number;
type Move = { axis: 0 | 1; direction: 1 | -1; distance: number };
type Curve = [Point, Point, Point]; // a curve from the first point to the last, bent toward the middle one
type ArrowPath = { curve: Curve; side: Point; cost: number };

// The picture of an item and its label in pixels, before the frame gets crowded.
const SIZES: Record<ItemSize, number> = { small: 110, medium: 170, large: 240 };
const LABEL_SIZES: Record<ItemSize, number> = { small: 34, medium: 40, large: 44 };
const MIN_LABEL_SIZE = 30;
const LABEL_GAP = 14; // between a picture and its label
const LINE_HEIGHT = 1.15;
const SPACING = 32; // the least room between two items
const LINK_SPACING = 110; // two items an arrow joins keep room for the arrow
const TITLE_SIZE = 64;
const TITLE_GAP = 44; // between the title and the items
const LINK_LABEL_SIZE = 32;
// Smaller and smaller sizes are tried until the items fit without touching.
const SCALES = [1, 0.88, 0.77, 0.68, 0.6];
// An arrow bends slightly to one side, or more, or to the other side, to go around what is in its way.
const BENDS = [0.14, -0.14, 0.25, -0.25, 0.4, -0.4, 0.55, -0.55];
// Motion, in seconds.
const POP_SEC = 0.45;
const LINK_SEC = 0.8;
const FAST_LINK_SEC = 0.45;
const LINK_GAP_SEC = 0.3; // between two arrows starting
const SETTLE_SEC = 0.9; // everything is in place this long before the end, since the next scene dissolves in over it

// The free area: inside the side margins, below the notes in the top corners (and the title), above the captions.
const LEFT = VIDEO.sideMargin;
const RIGHT = VIDEO.width - VIDEO.sideMargin;
const BOTTOM = VIDEO.height - VIDEO.captionSpace;

// A free picture the director composes from icons and figures with labels, placed on a 0 to 100 grid across the
// free part of the frame, with arrows between them. Each item pops in as the narration names its label, and the
// newest one is amber. An arrow draws once both of its ends are in.
export function IllustrationScene({
  title,
  items,
  links,
  backdrop,
  words,
  durationSec,
}: {
  title?: string;
  items: Item[];
  links?: Link[];
  backdrop?: Backdrop;
  words: TimedWord[];
  durationSec: number;
}) {
  const { colors, fonts } = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const time = frame / fps;
  const plan = useMemo(() => planIllustration(title, items, links ?? [], words, durationSec), [title, items, links, words, durationSec]);
  const titleIn = ease(frame, fps, 0.1, 0.6);

  return (
    <AbsoluteFill>
      {backdrop ? <BackdropLayer kind={backdrop} gridY={plan.gridY} appear={ease(frame, fps, 0, 0.6)} /> : null}
      {plan.title ? (
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
            lineHeight: LINE_HEIGHT,
            color: colors.paper,
            opacity: titleIn,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {plan.title}
        </div>
      ) : null}
      <svg width={VIDEO.width} height={VIDEO.height} style={{ position: "absolute", left: 0, top: 0 }}>
        {plan.arrows.map((arrow, index) => (
          <LinkArrow
            key={index}
            {...arrow}
            progress={ease(frame, fps, arrow.startSec, arrow.drawSec)}
            labelIn={ease(frame, fps, arrow.labelSec, 0.3)}
          />
        ))}
      </svg>
      {plan.items.map(({ item, point: [x, y], measured: { size, width, label }, startSec, signalUntil }, index) => {
        // The picture grows in with a little overshoot, and its label rises in just after.
        const pop = interpolate(frame, [startSec * fps, (startSec + POP_SEC) * fps], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.out(Easing.back(1.6)),
        });
        const labelIn = ease(frame, fps, startSec + 0.1, POP_SEC - 0.1);
        // Amber from when it comes in until the next named item does.
        const signal = signalUntil !== null && time >= startSec ? 1 - ease(frame, fps, signalUntil, 0.3) : 0;
        const color = interpolateColors(signal, [0, 1], [colors.paper, colors.signal]);
        return (
          <div key={index}>
            <div
              style={{
                position: "absolute",
                left: x - width / 2,
                top: y - size / 2,
                width,
                height: size,
                opacity: ease(frame, fps, startSec, 0.2),
                transform: `scale(${0.4 + 0.6 * pop})`,
              }}
            >
              {item.figure ? (
                <Figure look={item.figure} size={size} color={color} prop={item.icon} t={time} />
              ) : (
                <Icon name={item.icon ?? ""} size={size} color={color} />
              )}
            </div>
            {label ? (
              <div
                style={{
                  position: "absolute",
                  left: x - 450,
                  width: 900,
                  top: y + size / 2 + LABEL_GAP,
                  textAlign: "center",
                  whiteSpace: "nowrap",
                  fontFamily: fonts.label,
                  fontSize: label.fontSize,
                  fontWeight: 600,
                  lineHeight: LINE_HEIGHT,
                  color,
                  opacity: labelIn,
                  transform: `translateY(${(1 - labelIn) * 14}px)`,
                }}
              >
                {label.lines.map((line, lineIndex) => (
                  <div key={lineIndex}>{line}</div>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </AbsoluteFill>
  );
}

type PlannedArrow = {
  d: string;
  end: Point;
  angle: number;
  label: (Label & { at: Point }) | null;
  startSec: number;
  drawSec: number;
  labelSec: number;
};

// An arrow that draws itself from one item toward the edge of the other. The head appears as the line arrives, and
// the label beside its middle as the line passes it. Arrows and their labels are dim, so the items stand out. In
// Blueprint the head is an open chevron, as on a drawing.
function LinkArrow({ d, end, angle, label, progress, labelIn }: PlannedArrow & { progress: number; labelIn: number }) {
  const { colors, fonts, drawing } = useTheme();
  const lineHeight = (label?.fontSize ?? 0) * LINE_HEIGHT;
  const headIn = progress > 0.9 ? (progress - 0.9) * 10 : 0;
  const headAt = `translate(${end[0]} ${end[1]}) rotate(${angle})`;
  return (
    <g opacity={progress > 0 ? 1 : 0}>
      <path
        d={d}
        fill="none"
        stroke={colors.dim}
        strokeWidth={7}
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={1 - progress}
      />
      {drawing.land === "outline" ? (
        <path d="M -20 -16 L 4 0 L -20 16" fill="none" stroke={colors.dim} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" transform={headAt} opacity={headIn} />
      ) : (
        <path d="M 8 0 L -22 -15 L -22 15 Z" fill={colors.dim} stroke={colors.dim} strokeWidth={3} strokeLinejoin="round" transform={headAt} opacity={headIn} />
      )}
      {label ? (
        <text
          y={label.at[1] - ((label.lines.length - 1) * lineHeight) / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fontFamily={fonts.label}
          fontSize={label.fontSize}
          fontWeight={600}
          fill={colors.dim}
          stroke={colors.ink}
          strokeWidth={8}
          strokeLinejoin="round"
          paintOrder="stroke"
          opacity={labelIn}
        >
          {label.lines.map((line, index) => (
            <tspan key={index} x={label.at[0]} dy={index === 0 ? 0 : lineHeight}>
              {line}
            </tspan>
          ))}
        </text>
      ) : null}
    </g>
  );
}

// Where everything goes and when it comes in. None of it changes from frame to frame.
function planIllustration(title: string | undefined, items: Item[], links: Link[], words: TimedWord[], durationSec: number) {
  const heading = title?.trim() ?? "";
  const titleLines = Math.min(2, wrap(heading, TITLE_SIZE, RIGHT - LEFT).length);
  const top = heading ? VIDEO.topSpace + titleLines * TITLE_SIZE * LINE_HEIGHT + TITLE_GAP : VIDEO.topSpace;

  // Links to an item that does not exist or from an item to itself are left out, and so are repeats.
  const isItem = (index: number) => Number.isInteger(index) && index >= 0 && index < items.length;
  const pairOf = (a: number, b: number) => (a < b ? `${a} ${b}` : `${b} ${a}`);
  const seen = new Set<string>();
  const valid = links.filter((link) => {
    const key = `${link.from} ${link.to}`;
    const keep = isItem(link.from) && isItem(link.to) && link.from !== link.to && !seen.has(key);
    seen.add(key);
    return keep;
  });
  const linked = new Set(valid.map((link) => pairOf(link.from, link.to)));
  const { points, measured } = layOut(items, top, (a, b) => (linked.has(pairOf(a, b)) ? LINK_SPACING : SPACING));

  // Items come in as the narration names their labels, in their order. Items without a label come in with the first.
  const doneBy = Math.max(POP_SEC, durationSec - SETTLE_SEC);
  const named = items.flatMap((item, index) => (item.label?.trim() ? [index] : []));
  const heard = revealTimes(
    named.map((index) => items[index].label ?? ""),
    words,
    { firstSec: 0.3, spreadSec: Math.max(0.8, durationSec * 0.6), gapSec: 0.4, durationSec },
  );
  const latestStart = doneBy - POP_SEC;
  const starts = items.map(() => Math.min(latestStart, heard[0] ?? 0.3));
  named.forEach((index, order) => {
    starts[index] = Math.max(0, Math.min(latestStart, heard[order]));
  });
  // A named item is amber until the next named item comes in. The last one stays amber.
  const signalUntil = items.map((_, index): number | null => {
    const order = named.indexOf(index);
    if (order < 0) return null;
    return order + 1 < named.length ? starts[named[order + 1]] : durationSec + 1;
  });

  // Each arrow finds its way around the items and the arrows before it, then once more around all the others, so an
  // early arrow can make way for a later one. Then the labels go where no item or arrow is.
  const paths: (ArrowPath | null)[] = valid.map(() => null);
  for (let pass = 0; pass < 2; pass++) {
    valid.forEach((link, index) => {
      const others = paths.flatMap((path, other) => (path && other !== index ? [path.curve] : []));
      paths[index] = arrowPath(link.from, link.to, points, measured, top, others);
    });
  }
  const drawn = paths.flatMap((path) => (path ? [path.curve] : []));
  const taken: Box[] = [];
  const arrows = valid.flatMap((link, index) => {
    const path = paths[index];
    if (!path) return [];
    const { curve, side } = path;
    const [start, control, end] = curve;
    const others = drawn.filter((other) => other !== curve);
    return [
      {
        d: `M ${start[0]} ${start[1]} Q ${control[0]} ${control[1]} ${end[0]} ${end[1]}`,
        end,
        angle: (Math.atan2(end[1] - control[1], end[0] - control[0]) * 180) / Math.PI,
        label: link.label?.trim() ? placeLinkLabel(link.label.trim(), curve, side, points, measured, others, taken, top) : null,
        ready: Math.max(starts[link.from], starts[link.to]) + POP_SEC * 0.6,
        startSec: 0,
        drawSec: LINK_SEC,
        labelSec: 0,
      },
    ];
  });
  // An arrow draws once both of its ends are in, never at the same moment as another, and faster when it is late.
  const order = arrows.map((_, index) => index).sort((a, b) => arrows[a].ready - arrows[b].ready);
  let previous = -Infinity;
  for (const index of order) {
    const arrow = arrows[index];
    const wanted = Math.max(arrow.ready, previous + LINK_GAP_SEC);
    previous = wanted;
    arrow.drawSec = Math.min(LINK_SEC, Math.max(FAST_LINK_SEC, doneBy - wanted));
    arrow.startSec = Math.max(0, Math.min(wanted, doneBy - arrow.drawSec));
    arrow.labelSec = Math.min(arrow.startSec + 0.4 * arrow.drawSec, doneBy - 0.3);
  }

  // Where a height on the 0 to 100 grid lands on screen, as place() puts items, so a backdrop's ground or water line
  // sits where the director put it.
  const above = Math.max(...measured.map((item) => item.above));
  const below = Math.max(...measured.map((item) => item.below));
  const gridY = (share: number) => top + above + share * Math.max(0, BOTTOM - top - above - below);

  return {
    title: heading,
    gridY,
    items: items.map((item, index) => ({
      item,
      point: points[index],
      measured: measured[index],
      startSec: starts[index],
      signalUntil: signalUntil[index],
    })),
    arrows,
  };
}

// Where the picture takes place, drawn calmly behind its items in the look's colors: the ground in layers under a
// surface line, water under its surface, the ground along the bottom of the sky, stars, or the outline of a person.
// Layers grow stronger with depth by laying the text color thinly over the ground, which works on dark and light looks.
const WATER = "#3D85C6";
function BackdropLayer({ kind, gridY, appear }: { kind: Backdrop; gridY: (share: number) => number; appear: number }) {
  const { colors } = useTheme();
  const { width, height } = VIDEO;
  const line = alpha(colors.paper, 0.45);
  const band = (from: number, to: number, opacity: number, color = colors.paper) => (
    <rect x={0} y={from} width={width} height={Math.max(0, to - from)} fill={alpha(color, opacity)} />
  );
  let content: ReactNode = null;
  if (kind === "underground") {
    const surface = gridY(0.3);
    content = (
      <>
        {band(surface, gridY(0.6), 0.06)}
        {band(gridY(0.6), gridY(0.85), 0.1)}
        {band(gridY(0.85), height, 0.15)}
        <path d={`M0 ${surface}H${width}`} stroke={line} strokeWidth={5} />
        <path d={`M0 ${gridY(0.6)}H${width}M0 ${gridY(0.85)}H${width}`} stroke={alpha(colors.paper, 0.18)} strokeWidth={2} strokeDasharray="14 12" />
      </>
    );
  } else if (kind === "sea") {
    const surface = gridY(0.3);
    // A gentle wave along the surface, the same in every frame.
    const wave = Array.from({ length: 25 }, (_, index) => `${index === 0 ? "M" : "L"}${(index * width) / 24} ${surface + (index % 2 ? 10 : -10)}`).join(" ");
    content = (
      <>
        {band(surface, height, 0.16, WATER)}
        {band(gridY(0.92), height, 0.12)}
        <path d={wave} fill="none" stroke={line} strokeWidth={4} strokeLinejoin="round" />
      </>
    );
  } else if (kind === "sky") {
    const ground = gridY(0.88);
    content = (
      <>
        {band(ground, height, 0.1)}
        <path d={`M0 ${ground}H${width}`} stroke={line} strokeWidth={4} />
      </>
    );
  } else if (kind === "space") {
    // Stars scattered the same way every time.
    let seed = 11;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 2 ** 32;
    };
    content = Array.from({ length: 90 }, (_, index) => (
      <circle key={index} cx={random() * width} cy={random() * height} r={1.2 + random() * 2.2} fill={alpha(colors.paper, 0.25 + random() * 0.4)} />
    ));
  } else {
    // A person seen from the front: the head at the top of the grid, the shoulders below it and the body down past
    // the bottom, so the director can place organs where they are. Sizes are shares of the grid's height.
    const top = gridY(0);
    const span = gridY(1) - top;
    const at = (share: number) => top + share * span;
    const cx = width / 2;
    const side = (share: number) => share * span;
    const body = [
      `M${cx - side(0.07)} ${at(0.15)}`,
      `C${cx - side(0.08)} ${at(0.2)} ${cx - side(0.42)} ${at(0.18)} ${cx - side(0.46)} ${at(0.3)}`,
      `C${cx - side(0.48)} ${at(0.36)} ${cx - side(0.36)} ${at(0.5)} ${cx - side(0.34)} ${at(0.75)}`,
      `L${cx - side(0.38)} ${at(1.1)} L${cx + side(0.38)} ${at(1.1)} L${cx + side(0.34)} ${at(0.75)}`,
      `C${cx + side(0.36)} ${at(0.5)} ${cx + side(0.48)} ${at(0.36)} ${cx + side(0.46)} ${at(0.3)}`,
      `C${cx + side(0.42)} ${at(0.18)} ${cx + side(0.08)} ${at(0.2)} ${cx + side(0.07)} ${at(0.15)} Z`,
    ].join(" ");
    const fill = alpha(colors.paper, 0.06);
    const stroke = alpha(colors.paper, 0.35);
    content = (
      <>
        <path d={body} fill={fill} stroke={stroke} strokeWidth={4} strokeLinejoin="round" />
        <circle cx={cx} cy={at(0.06)} r={side(0.1)} fill={fill} stroke={stroke} strokeWidth={4} />
      </>
    );
  }
  return (
    <svg width={width} height={height} style={{ position: "absolute", left: 0, top: 0, opacity: appear }}>
      {content}
    </svg>
  );
}

// The lines a text wraps to in a box `width` wide, since text cannot be measured here. Archivo and Fraunces are
// about 0.56 em wide per character, a little more than they really are, so this errs toward more lines.
function wrap(text: string, fontSize: number, width: number): string[] {
  const lines: string[] = [];
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const last = lines[lines.length - 1];
    if (last !== undefined && textWidth(`${last} ${word}`, fontSize) <= width) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  return lines;
}

const textWidth = (text: string, fontSize: number) => text.length * fontSize * 0.56;

const labelOf = (lines: string[], fontSize: number): Label => ({
  lines,
  fontSize,
  width: Math.max(...lines.map((line) => textWidth(line, fontSize))),
  height: lines.length * fontSize * LINE_HEIGHT,
});

// A label takes two lines at most. A long one gets smaller type or a wider box, and only as a last resort loses
// its end.
function fitLabel(text: string, fontSize: number, width: number): Label {
  for (let size = fontSize; size >= MIN_LABEL_SIZE; size -= 2) {
    for (const boxWidth of [width, width * 1.4]) {
      const lines = wrap(text, size, boxWidth);
      if (lines.length <= 2 && lines.every((line) => textWidth(line, size) <= boxWidth)) return labelOf(lines, size);
    }
  }
  const lines = wrap(text, MIN_LABEL_SIZE, width * 1.4);
  return labelOf(lines.length > 2 ? [lines[0], `${lines[1]}…`] : lines, MIN_LABEL_SIZE);
}

function measure(item: Item, scale: number): Measured {
  const kind = item.size ?? "medium";
  const size = Math.round(SIZES[kind] * scale);
  const width = item.figure ? size * FIGURE_ASPECT : size;
  const text = item.label?.trim();
  const fontSize = Math.max(MIN_LABEL_SIZE, Math.round(LABEL_SIZES[kind] * Math.max(0.8, scale)));
  const label = text ? fitLabel(text, fontSize, Math.max(260, size * 1.7)) : null;
  return {
    size,
    width,
    label,
    half: Math.max(width, label?.width ?? 0) / 2,
    above: size / 2,
    below: size / 2 + (label ? LABEL_GAP + label.height : 0),
  };
}

const boxOf = ([x, y]: Point, { half, above, below }: Measured): Box => ({ left: x - half, right: x + half, top: y - above, bottom: y + below });

const clamp = (value: number, low: number, high: number) => (high < low ? (low + high) / 2 : Math.min(high, Math.max(low, value)));

// Fits the items into the free area: at full size if they fit without touching, else smaller and smaller, and as an
// even grid as the last resort. Many items are drawn smaller from the start: full size up to four.
function layOut(items: Item[], top: number, gapOf: GapOf): Layout {
  const crowd = Math.min(1, Math.sqrt(4 / Math.max(1, items.length)));
  const attempt = (wanted: Item[], scale: number): Layout => {
    const measured = wanted.map((item) => measure(item, scale * crowd));
    return { points: nudge(place(wanted, measured, top), measured, top, gapOf), measured };
  };
  for (const scale of SCALES) {
    const layout = attempt(items, scale);
    if (!crowded(layout, gapOf)) return layout;
  }
  return attempt(gridOf(items), SCALES[SCALES.length - 1]);
}

// Where x and y from 0 to 100 put each item: the whole free area is used, and an item at 0 or 100 still fits with its
// label. Every item is placed the same way, so items with the same x stand in a straight column.
function place(items: Item[], measured: Measured[], top: number): Point[] {
  const half = Math.max(...measured.map((item) => item.half));
  const above = Math.max(...measured.map((item) => item.above));
  const below = Math.max(...measured.map((item) => item.below));
  const share = (value: number) => (Number.isFinite(value) ? Math.min(100, Math.max(0, value)) / 100 : 0.5);
  // Items asked to stand on the same spot start a hair apart in their order, so they are pushed apart in that order,
  // from left to right.
  return items.map((item, index) => [
    LEFT + half + share(item.x) * Math.max(0, RIGHT - LEFT - 2 * half) + index * 0.01,
    top + above + share(item.y) * Math.max(0, BOTTOM - top - above - below),
  ]);
}

// The shortest move that puts box b at least `gap` away from box a. A distance of zero or less means they are far
// enough apart already. Ties go right, then left, down, up, so the same items always move the same way.
function separation(a: Box, b: Box, gap: number): Move {
  const moves: Move[] = [
    { axis: 0, direction: 1, distance: a.right + gap - b.left },
    { axis: 0, direction: -1, distance: b.right + gap - a.left },
    { axis: 1, direction: 1, distance: a.bottom + gap - b.top },
    { axis: 1, direction: -1, distance: b.bottom + gap - a.top },
  ];
  return moves.reduce((best, move) => (move.distance < best.distance ? move : best));
}

// Items placed too close are pushed apart, each half the way, along the shortest move, again and again until no two
// are too close. All pushes of a round are worked out before any item moves, so the same items always end up in the
// same places, and items asked to stand on one spot keep their order. Each item stays inside the free area. This
// keeps the picture close to what the director asked for.
function nudge(start: Point[], measured: Measured[], top: number, gapOf: GapOf): Point[] {
  const points = start.map(([x, y]): Point => [x, y]);
  for (let round = 0; round < 200; round++) {
    const shifts = points.map((): Point => [0, 0]);
    let moved = false;
    for (let a = 0; a < points.length; a++) {
      for (let b = a + 1; b < points.length; b++) {
        const move = separation(boxOf(points[a], measured[a]), boxOf(points[b], measured[b]), gapOf(a, b));
        if (move.distance <= 0.5) continue;
        shifts[a][move.axis] -= (move.direction * move.distance) / 2;
        shifts[b][move.axis] += (move.direction * move.distance) / 2;
        moved = true;
      }
    }
    if (!moved) break;
    points.forEach((point, index) => {
      const { half, above, below } = measured[index];
      point[0] = clamp(point[0] + shifts[index][0], LEFT + half, RIGHT - half);
      point[1] = clamp(point[1] + shifts[index][1], top + above, BOTTOM - below);
    });
  }
  return points;
}

// Whether any two items are still closer than they should be, give or take a few pixels.
function crowded({ points, measured }: Layout, gapOf: GapOf): boolean {
  return points.some((a, i) =>
    points.some((b, j) => j > i && separation(boxOf(a, measured[i]), boxOf(b, measured[j]), gapOf(i, j)).distance > 4),
  );
}

// The items in an even grid, row by row in their order, for when they crowd each other wherever they are put.
function gridOf(items: Item[]): Item[] {
  const columns = Math.ceil(Math.sqrt(items.length * 2));
  const rows = Math.ceil(items.length / columns);
  return items.map((item, index) => ({
    ...item,
    x: columns > 1 ? ((index % columns) / (columns - 1)) * 100 : 50,
    y: rows > 1 ? (Math.floor(index / columns) / (rows - 1)) * 100 : 50,
  }));
}

const pointAt = ([start, control, end]: Curve, t: number): Point => [
  (1 - t) ** 2 * start[0] + 2 * (1 - t) * t * control[0] + t ** 2 * end[0],
  (1 - t) ** 2 * start[1] + 2 * (1 - t) * t * control[1] + t ** 2 * end[1],
];

// The piece of a curve between t0 and t1, which is a curve of the same kind.
function partOf(curve: Curve, t0: number, t1: number): Curve {
  const [start, control, end] = curve;
  const mix = (axis: 0 | 1) =>
    (1 - t0) * (1 - t1) * start[axis] + ((1 - t0) * t1 + t0 * (1 - t1)) * control[axis] + t0 * t1 * end[axis];
  return [pointAt(curve, t0), [mix(0), mix(1)], pointAt(curve, t1)];
}

// Whether a point is on an item, with `pad` pixels to spare: on the oval its picture fills, or on its label.
function onItem([x, y]: Point, [centerX, centerY]: Point, { size, width, label }: Measured, pad: number): boolean {
  if (((x - centerX) / (width / 2 + pad)) ** 2 + ((y - centerY) / (size / 2 + pad)) ** 2 <= 1) return true;
  if (!label) return false;
  const labelTop = centerY + size / 2 + LABEL_GAP;
  return Math.abs(x - centerX) <= label.width / 2 + pad && y >= labelTop - pad && y <= labelTop + label.height + pad;
}

const distance = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);

const samplesOf = (curve: Curve) => Array.from({ length: 31 }, (_, index) => pointAt(curve, index / 30));

// Arrows and their labels stay clear of the title, the captions and the edges of the frame.
const inFrame = ([x, y]: Point, top: number) => x > 24 && x < VIDEO.width - 24 && y > top - 20 && y < BOTTOM + 10;

// The way of an arrow from the middle of one item's picture toward the other's. It starts outside the first item and
// ends at the edge of the second, picture or label, whichever it meets. It bends a little to the left of where it
// goes, so an arrow to the right curves up and its way back curves down. Of the bends in BENDS it takes the one with
// the least in its way: other items and the edges of the free area most, then the heads and lines of the arrows
// already drawn. `side` is the side it bulges to.
function arrowPath(from: number, to: number, points: Point[], measured: Measured[], top: number, drawn: Curve[]): ArrowPath | null {
  const [start, end] = [points[from], points[to]];
  const [dx, dy] = [end[0] - start[0], end[1] - start[1]];
  const length = Math.hypot(dx, dy);
  if (length < 1) return null;
  const drawnPoints = drawn.flatMap(samplesOf);
  let best: ArrowPath | null = null;
  for (const bend of BENDS) {
    const full: Curve = [start, [(start[0] + end[0]) / 2 + dy * bend, (start[1] + end[1]) / 2 - dx * bend], end];
    // It ends where it first meets the second item, and starts where it last leaves the first one.
    let t1 = 0;
    while (t1 < 1 && !onItem(pointAt(full, t1), end, measured[to], 18)) t1 += 0.005;
    let t0 = t1;
    while (t0 > 0 && !onItem(pointAt(full, t0), start, measured[from], 14)) t0 -= 0.005;
    const curve = partOf(full, t0 + 0.005, t1);
    if (distance(curve[0], curve[2]) < 50) continue;
    const samples = samplesOf(curve);
    const blocked = samples.filter(
      (point) =>
        !inFrame(point, top) || points.some((center, other) => other !== from && other !== to && onItem(point, center, measured[other], 12)),
    ).length;
    const alongside = samples.filter((point) => drawnPoints.some((other) => distance(point, other) < 16)).length;
    // Its head must not land on another arrow's head or start, nor its start on another's head.
    const clash = drawn.some((other) => Math.min(distance(other[2], curve[2]), distance(other[0], curve[2]), distance(other[2], curve[0])) < 60);
    const cost = 10 * blocked + (clash ? 30 : 0) + 2 * alongside;
    if (!best || cost < best.cost) best = { curve, side: [(Math.sign(bend) * dy) / length, (-Math.sign(bend) * dx) / length], cost };
  }
  return best;
}

// Whether a box comes within `pad` pixels of an item's picture or its label.
function touchesItem(box: Box, [x, y]: Point, { size, width, label }: Measured, pad: number): boolean {
  const picture = { left: x - width / 2, right: x + width / 2, top: y - size / 2, bottom: y + size / 2 };
  if (separation(picture, box, pad).distance > 0) return true;
  if (!label) return false;
  const labelTop = y + size / 2 + LABEL_GAP;
  const text = { left: x - label.width / 2, right: x + label.width / 2, top: labelTop, bottom: labelTop + label.height };
  return separation(text, box, pad).distance > 0;
}

// A link's label goes beside the middle of its arrow, on the side the arrow bulges to, else on the other side, else
// on the line itself, clear of the items, the other arrows and the labels placed before it. A label with no free spot
// is left out, so the picture never gets cluttered.
function placeLinkLabel(
  text: string,
  curve: Curve,
  side: Point,
  points: Point[],
  measured: Measured[],
  others: Curve[],
  taken: Box[],
  top: number,
): (Label & { at: Point }) | null {
  const otherPoints = others.flatMap(samplesOf);
  const label = fitLabel(text, LINK_LABEL_SIZE, 320);
  const { width, height } = label;
  const middle = pointAt(curve, 0.5);
  const reach = (Math.abs(side[0]) * width) / 2 + (Math.abs(side[1]) * height) / 2 + 14;
  const spots: Point[] = [
    [middle[0] + side[0] * reach, middle[1] + side[1] * reach],
    [middle[0] - side[0] * reach, middle[1] - side[1] * reach],
    middle,
  ];
  for (const at of spots) {
    const box = { left: at[0] - width / 2, right: at[0] + width / 2, top: at[1] - height / 2, bottom: at[1] + height / 2 };
    const free =
      inFrame([box.left, box.top], top) &&
      inFrame([box.right, box.bottom], top) &&
      points.every((center, index) => !touchesItem(box, center, measured[index], 8)) &&
      otherPoints.every(([x, y]) => x < box.left - 10 || x > box.right + 10 || y < box.top - 10 || y > box.bottom + 10) &&
      taken.every((other) => separation(other, box, 8).distance <= 0);
    if (free) {
      taken.push(box);
      return { ...label, at };
    }
  }
  return null;
}
