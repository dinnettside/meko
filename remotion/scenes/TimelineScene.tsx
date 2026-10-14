import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { TimedWord } from "@/lib/elevenlabs";
import { timeKey } from "@/lib/numbers";
import { formatYear } from "../format";
import { ease } from "../motion";
import { revealTimes } from "../spoken";
import { COLORS, FONTS, VIDEO } from "@/lib/theme";

const { width: WIDTH, height: HEIGHT, captionSpace: CAPTION_SPACE } = VIDEO;
const LEFT = 260;
const RIGHT = WIDTH - 260;
const AXIS_Y = (HEIGHT - CAPTION_SPACE) / 2 + 20;


// Splits a label into two lines when it is long, so labels next to each other don't collide.
function wrap(label: string): string[] {
  const words = label.split(" ");
  if (label.length <= 14 || words.length < 2) return [label];
  const half = Math.ceil(words.length / 2);
  return [words.slice(0, half).join(" "), words.slice(half).join(" ")];
}

const ERA_TOP = AXIS_Y + 200;
const ERA_HEIGHT = 48;
const ERA_ROW = 64;

// Events in order along a line. The axis draws from left to right, the events come in one by one as the narration
// names them, an amber line follows time from event to event, and the event the scene is about stands out in amber.
// Periods, like a dynasty or a war, lie as bands under the events, from their start to their end.
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
  // Events are evenly spaced, so a period is placed between them by time: a year halfway between two events lies
  // halfway between their dots. Years before the first or after the last event sit at the ends of the line.
  const keys = events.map((event) => timeKey(event.year, event.date));
  const xOfYear = (year: number) => {
    const key = timeKey(year);
    if (events.length < 2 || key <= keys[0]) return LEFT;
    if (key >= keys[keys.length - 1]) return RIGHT;
    const after = keys.findIndex((other) => other >= key);
    const share = (key - keys[after - 1]) / Math.max(1, keys[after] - keys[after - 1]);
    return LEFT + step * (after - 1 + share);
  };
  // Overlapping periods go on separate rows: each goes on the first row where it overlaps nothing.
  const rows: [number, number][][] = [];
  const eraRows = eras.map((era) => {
    const span: [number, number] = [xOfYear(era.start), xOfYear(era.end)];
    const free = (row: [number, number][]) => row.every(([start, end]) => span[1] <= start || span[0] >= end);
    let row = rows.findIndex(free);
    if (row === -1) row = rows.push([]) - 1;
    rows[row].push(span);
    return row;
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
          x1={LEFT - 60}
          y1={AXIS_Y}
          x2={LEFT - 60 + (RIGHT - LEFT + 120) * axis}
          y2={AXIS_Y}
          stroke={COLORS.border}
          strokeWidth={6}
          strokeLinecap="round"
        />
        {events.length > 1 ? (
          <line x1={LEFT} y1={AXIS_Y} x2={LEFT + step * reached} y2={AXIS_Y} stroke={COLORS.signal} strokeWidth={6} strokeLinecap="round" />
        ) : null}
        {eras.map((era, index) => {
          const x1 = xOfYear(era.start);
          const x2 = Math.max(x1 + 24, xOfYear(era.end));
          const y = ERA_TOP + eraRows[index] * ERA_ROW;
          const grow = ease(frame, fps, 0.3 + index * 0.25, 0.9);
          return (
            <g key={`era-${index}`} opacity={grow}>
              <rect x={x1} y={y} width={(x2 - x1) * grow} height={ERA_HEIGHT} fill={COLORS.land} stroke={COLORS.border} strokeWidth={2} />
              <rect x={x1} y={y} width={8} height={ERA_HEIGHT} fill={COLORS.teal} />
              <text x={x1 + 22} y={y + ERA_HEIGHT / 2} dominantBaseline="middle" fontFamily={FONTS.body} fontSize={30} fontWeight={600} fill={COLORS.paper}>
                {era.label} · {formatYear(era.start)}–{formatYear(era.end)}
              </text>
            </g>
          );
        })}
        {oneYear ? (
          <text
            x={WIDTH / 2}
            y={AXIS_Y - 230}
            textAnchor="middle"
            fontFamily={FONTS.display}
            fontSize={VIDEO.fontSize.year}
            fontWeight={700}
            fill={COLORS.dim}
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
              <circle cx={x} cy={AXIS_Y} r={isFocus ? 24 : 14} fill={isFocus ? COLORS.signal : COLORS.paper} />
              <text
                x={x}
                y={AXIS_Y - 70}
                textAnchor="middle"
                fontFamily={FONTS.display}
                fontSize={(isFocus ? VIDEO.fontSize.focusYear : VIDEO.fontSize.year) * (longHeadings ? 0.62 : 1)}
                fontWeight={700}
                fill={isFocus ? COLORS.signal : COLORS.paper}
              >
                {heading(event)}
              </text>
              <text
                x={x}
                y={AXIS_Y + 90}
                textAnchor="middle"
                fontFamily={FONTS.body}
                fontSize={VIDEO.fontSize.eventLabel}
                fontWeight={isFocus ? 700 : 500}
                fill={isFocus ? COLORS.paper : COLORS.dim}
              >
                {wrap(event.label).map((line, lineIndex) => (
                  <tspan key={lineIndex} x={x} dy={lineIndex === 0 ? 0 : 50}>
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
