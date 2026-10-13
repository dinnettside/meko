import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { ease } from "../motion";
import { CAPTION_SPACE, COLORS, FONTS } from "../theme";

const WIDTH = 1920;
const HEIGHT = 1080;
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

// Events in order along a line. The axis draws from left to right, and the event the scene is
// about stands out in amber.
export function TimelineScene({ events, focusIndex }: { events: { year: number; label: string }[]; focusIndex: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const axis = ease(frame, fps, 0.1, 0.9);
  const step = events.length > 1 ? (RIGHT - LEFT) / (events.length - 1) : 0;

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
        {events.map((event, index) => {
          const x = events.length > 1 ? LEFT + step * index : WIDTH / 2;
          const isFocus = index === focusIndex;
          const appear = ease(frame, fps, 0.5 + index * 0.4, 0.5);
          return (
            <g key={index} opacity={appear} transform={`translate(0 ${(1 - appear) * 20})`}>
              <circle cx={x} cy={AXIS_Y} r={isFocus ? 24 : 14} fill={isFocus ? COLORS.signal : COLORS.paper} />
              <text
                x={x}
                y={AXIS_Y - 70}
                textAnchor="middle"
                fontFamily={FONTS.display}
                fontSize={isFocus ? 92 : 64}
                fontWeight={700}
                fill={isFocus ? COLORS.signal : COLORS.paper}
              >
                {formatYear(event.year)}
              </text>
              <text
                x={x}
                y={AXIS_Y + 90}
                textAnchor="middle"
                fontFamily={FONTS.body}
                fontSize={40}
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
