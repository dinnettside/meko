import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { TimedWord } from "@/lib/elevenlabs";
import { ease } from "../motion";
import { revealTimes } from "../spoken";
import { COLORS, FONTS, VIDEO } from "@/lib/theme";

const { width: WIDTH, height: HEIGHT, captionSpace: CAPTION_SPACE } = VIDEO;
const LEFT = 260;
const RIGHT = WIDTH - 260;
const AXIS_Y = (HEIGHT - CAPTION_SPACE) / 2 + 20;

// Years before year 1 are shown as "BC".
const formatYear = (year: number) => (year < 0 ? `${-year} BC` : String(year));

// Splits a label into two lines when it is long, so labels next to each other don't collide.
function wrap(label: string): string[] {
  const words = label.split(" ");
  if (label.length <= 14 || words.length < 2) return [label];
  const half = Math.ceil(words.length / 2);
  return [words.slice(0, half).join(" "), words.slice(half).join(" ")];
}

// Events in order along a line. The axis draws from left to right, the events come in one by one as the narration
// names them, an amber line follows time from event to event, and the event the scene is about stands out in amber.
export function TimelineScene({
  events,
  focusIndex,
  words,
  durationSec,
}: {
  events: { year: number; label: string; date?: string }[];
  focusIndex: number;
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
