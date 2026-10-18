import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { TimedWord } from "@/lib/elevenlabs";
import { timeKey } from "@/lib/numbers";
import { formatYear, formatYears } from "../format";
import { ease } from "../motion";
import { revealTimes } from "../spoken";
import { cardEdge, cardFill } from "../cards";
import { alpha, useTheme } from "../theme";
import { VIDEO } from "@/lib/theme";

const { width: WIDTH, height: HEIGHT, captionSpace: CAPTION_SPACE } = VIDEO;
const LEFT = 260;
const RIGHT = WIDTH - 260;
// The axis runs on a little past the first and the last event.
const AXIS_START = LEFT - 60;
const AXIS_END = RIGHT + 60;
const AXIS_Y = (HEIGHT - CAPTION_SPACE) / 2 + 20;
// Labels keep this far from the edges of the frame, and event labels this far from each other.
const EDGE = 40;
const LABEL_GAP = 24;

// Rough width of a line of text, since text cannot be measured here. Archivo is about 0.56 em wide per character.
const textWidth = (text: string, fontSize: number) => text.length * fontSize * 0.56;

// Splits a label into two lines when it is wider than `maxWidth`, at the space that makes the longer line shortest.
function wrap(label: string, fontSize: number, maxWidth: number): string[] {
  const words = label.split(" ");
  if (textWidth(label, fontSize) <= maxWidth || words.length < 2) return [label];
  const widest = (lines: string[]) => Math.max(...lines.map((line) => textWidth(line, fontSize)));
  const splits = words.slice(1).map((_, index) => [words.slice(0, index + 1).join(" "), words.slice(index + 1).join(" ")]);
  return splits.reduce((best, lines) => (widest(lines) < widest(best) ? lines : best));
}

const ERA_TOP = AXIS_Y + 200;
const ERA_HEIGHT = 48;
const ERA_ROW = 64;
const ERA_ROWS = 3; // a fourth row would run into the captions
const ERA_GAP = 40; // between periods on the same row

// Events in order along a line. The axis draws from left to right, the events come in one by one as the narration
// names them, an amber line follows time from event to event, and the event the scene is about stands out in amber.
// Periods, like a dynasty or a war, lie as bands under the events, from their start to their end. In Blueprint the axis
// is a chalk line, the events are rings, and the bands are outlined like boxes on a drawing; in Field guide the bands
// are paper tags.
export function TimelineScene({
  events,
  focusIndex,
  eras = [],
  words,
  durationSec,
}: {
  events: { year: number; label: string; date?: string }[];
  focusIndex: number;
  eras?: { start: number; end: number; label: string }[];
  words: TimedWord[];
  durationSec: number;
}) {
  const theme = useTheme();
  const { colors, fonts, drawing } = theme;
  const outlined = drawing.land === "outline";
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const axis = ease(frame, fps, 0.1, 0.9);
  const step = events.length > 1 ? (RIGHT - LEFT) / (events.length - 1) : 0;
  const spacing = Math.max(0.4, Math.min(1.8, (durationSec * 0.6) / events.length));
  // When every event falls in one year, each shows its date and the year stands once above the line.
  const oneYear = events.length > 1 && events.every((event) => event.year === events[0].year && event.date);
  const heading = (event: (typeof events)[number]) =>
    oneYear ? (event.date ?? "") : event.date ? `${event.date} ${formatYear(event.year)}` : formatYear(event.year);
  // Long headings, like "20 July 1969", get smaller type so they do not run into each other.
  const longHeadings = events.some((event) => heading(event).length > 7);
  // Each event label must fit in the space between its dot and the next one, and inside the frame, on at most two
  // lines. When one does not, every label gets the smaller size, so they stay alike.
  const labelSpace = events.length > 1 ? Math.min(step - LABEL_GAP, 2 * (LEFT - EDGE)) : WIDTH - 2 * VIDEO.sideMargin;
  const labelsFit = (fontSize: number) =>
    events.every((event) => wrap(event.label, fontSize, labelSpace).every((line) => textWidth(line, fontSize) <= labelSpace));
  const labelSize = labelsFit(VIDEO.fontSize.eventLabel) ? VIDEO.fontSize.eventLabel : VIDEO.fontSize.eventLabelSmall;
  // Events are evenly spaced, so a period is placed between them by time: a year halfway between two events lies
  // halfway between their dots. A period that began before the first event starts where the axis starts, and one
  // that lasted past the last event runs to where the axis ends.
  const keys = events.map((event) => timeKey(event.year, event.date));
  const first = keys[0];
  const last = keys[keys.length - 1];
  const xOfYear = (year: number) => {
    const key = timeKey(year);
    if (key <= first) return key < first ? AXIS_START : LEFT;
    if (key >= last) return key > last ? AXIS_END : RIGHT;
    const after = keys.findIndex((other) => other >= key);
    const share = (key - keys[after - 1]) / Math.max(1, keys[after] - keys[after - 1]);
    return LEFT + step * (after - 1 + share);
  };
  // A period that lies wholly before the first event or after the last has no place on this axis, so it is left out.
  // The label starts inside the band and may run on past its end. When it would run out of the frame, it sits just
  // before the band instead. Each period goes on the first row where neither its band nor its label comes near
  // another one, and a period that finds no free row is left out rather than squeezed in.
  const rows: [number, number][][] = [];
  const placedEras = eras.flatMap((era) => {
    if (events.length < 2 || era.start >= era.end || timeKey(era.start) >= last || timeKey(era.end) <= first) return [];
    const x1 = xOfYear(era.start);
    const x2 = Math.max(x1 + 24, xOfYear(era.end));
    const text = `${era.label} · ${formatYears(era.start, era.end)}`;
    const width = textWidth(text, VIDEO.fontSize.eraLabel);
    const textX = x1 + 22 + width <= WIDTH - EDGE ? x1 + 22 : x1 - 14 - width;
    if (textX < EDGE) return [];
    const extent: [number, number] = [Math.min(x1, textX), Math.max(x2, textX + width)];
    const free = (row: [number, number][]) => row.every(([start, end]) => extent[1] + ERA_GAP <= start || extent[0] >= end + ERA_GAP);
    let row = rows.findIndex(free);
    if (row === -1 && rows.length < ERA_ROWS) row = rows.push([]) - 1;
    if (row === -1) return [];
    rows[row].push(extent);
    return [{ x1, x2, y: ERA_TOP + row * ERA_ROW, text, textX }];
  });
  const starts = revealTimes(
    events.map((event) => `${Math.abs(event.year)} ${event.date ?? ""} ${event.label}`),
    words,
    { firstSec: 0.5, spreadSec: spacing * events.length, gapSec: 0.4, durationSec },
  );
  const startOf = (index: number) => starts[index];
  // How far along the axis the amber line has come: it moves on to each event as that event appears.
  const reached = events.reduce((total, _, index) => total + (index === 0 ? 0 : ease(frame, fps, startOf(index) - 0.3, 0.5)), 0);

  return (
    <AbsoluteFill>
      <svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
        <line
          x1={AXIS_START}
          y1={AXIS_Y}
          x2={AXIS_START + (AXIS_END - AXIS_START) * axis}
          y2={AXIS_Y}
          stroke={outlined ? alpha(colors.paper, 0.55) : colors.border}
          strokeWidth={6}
          strokeLinecap="round"
        />
        {events.length > 1 ? (
          <line x1={LEFT} y1={AXIS_Y} x2={LEFT + step * reached} y2={AXIS_Y} stroke={colors.signal} strokeWidth={6} strokeLinecap="round" />
        ) : null}
        {placedEras.map((era, index) => {
          const grow = ease(frame, fps, 0.3 + index * 0.25, 0.9);
          return (
            <g key={`era-${index}`} opacity={grow}>
              <rect
                x={era.x1}
                y={era.y}
                width={(era.x2 - era.x1) * grow}
                height={ERA_HEIGHT}
                rx={drawing.card === "solid" ? 0 : drawing.radius}
                fill={cardFill(theme)}
                stroke={drawing.card === "solid" ? colors.border : cardEdge(theme).color}
                strokeWidth={2}
              />
              <rect x={era.x1} y={era.y} width={8} height={ERA_HEIGHT} fill={colors.teal} />
              {/* A label that runs on past its band keeps the band's edge from cutting through its letters, where
                  the edge is drawn strong enough to. */}
              <text
                x={era.textX}
                y={era.y + ERA_HEIGHT / 2}
                dominantBaseline="middle"
                fontFamily={fonts.label}
                fontSize={VIDEO.fontSize.eraLabel}
                fontWeight={600}
                fill={colors.paper}
                {...(drawing.card === "solid" ? {} : { stroke: cardFill(theme), strokeWidth: 8, strokeLinejoin: "round", paintOrder: "stroke" })}
              >
                {era.text}
              </text>
            </g>
          );
        })}
        {oneYear ? (
          <text
            x={WIDTH / 2}
            y={AXIS_Y - 230}
            textAnchor="middle"
            fontFamily={fonts.display}
            fontSize={VIDEO.fontSize.year * fonts.displayScale}
            fontWeight={fonts.displayWeight}
            fill={colors.dim}
            opacity={axis}
          >
            {formatYear(events[0].year)}
          </text>
        ) : null}
        {events.map((event, index) => {
          const x = events.length > 1 ? LEFT + step * index : WIDTH / 2;
          const isFocus = index === focusIndex;
          const appear = ease(frame, fps, startOf(index), 0.5);
          return (
            <g key={index} opacity={appear} transform={`translate(0 ${(1 - appear) * 20})`}>
              {outlined ? (
                // A ring on the chalk line, with a dot in the middle of the one the scene is about.
                <g>
                  <circle cx={x} cy={AXIS_Y} r={isFocus ? 22 : 13} fill={colors.ink} stroke={isFocus ? colors.signal : colors.paper} strokeWidth={5} />
                  {isFocus ? <circle cx={x} cy={AXIS_Y} r={9} fill={colors.signal} /> : null}
                </g>
              ) : (
                <circle cx={x} cy={AXIS_Y} r={isFocus ? 24 : 14} fill={isFocus ? colors.signal : colors.paper} />
              )}
              <text
                x={x}
                y={AXIS_Y - 70}
                textAnchor="middle"
                fontFamily={fonts.display}
                fontSize={(isFocus ? VIDEO.fontSize.focusYear : VIDEO.fontSize.year) * (longHeadings ? 0.62 : 1) * fonts.displayScale}
                fontWeight={fonts.displayWeight}
                fill={isFocus ? colors.signal : colors.paper}
              >
                {heading(event)}
              </text>
              <text
                x={x}
                y={AXIS_Y + 90}
                textAnchor="middle"
                fontFamily={fonts.label}
                fontSize={labelSize}
                fontWeight={isFocus ? 700 : 500}
                fill={isFocus ? colors.paper : colors.dim}
              >
                {wrap(event.label, labelSize, labelSpace).map((line, lineIndex) => (
                  <tspan key={lineIndex} x={x} dy={lineIndex === 0 ? 0 : labelSize * 1.25}>
                    {line}
                  </tspan>
                ))}
              </text>
            </g>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
}
