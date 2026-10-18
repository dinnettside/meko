import { interpolateColors } from "remotion";
import { isIconName } from "@/lib/icons";
import type { FigureLook } from "@/lib/storyboard";
import { Icon } from "./icons";
import { mix, useTheme } from "./theme";

// Simple, friendly figures for the people a video names: a round head, a body, arms and legs, drawn flat in one
// color. Each look adds a few marks for a role, never for gender, skin color or a real person's likeness.
// A figure is drawn on a 120 x 170 grid, standing on the ground at the bottom, with room above the head for a hat
// and room on its right for something held in the hand. Like the icons, figures are flat in Night atlas, chalk
// outlines in Blueprint and ink outlines over a pale tint in Field guide.

const W = 120;
const H = 170;
// How wide a figure is for its height.
export const FIGURE_ASPECT = W / H;

// A thin edge in the background color around arms, hands and hats, so they read where they cross the body.
const EDGE = 2.2;
// How far the second tone, for capes, backpacks, boots and some hats, is mixed toward the background.
const SHADE = 0.45;
const HIP = 112; // where the legs meet the body; the body breathes from here
const BREATH_SEC = 3.6;
const PROP_SIZE = 48;

type Point = [number, number];

// How a figure's parts are painted: `color` for the body, `shade` for the second tone (capes, backpacks, boots, some
// hats), and `ink` for the edges around parts and the marks on them, like a belt or goggles. `edge` is how wide those
// edges are, and `grow` widens the legs, for the outline the drawn looks paint first.
type Paint = { color: string; shade: string; ink: string; edge: number; grow: number };
const edged = (paint: Paint) => ({ stroke: paint.ink, strokeWidth: 2 * paint.edge, paintOrder: "stroke" }) as const;

// The arms, from the shoulder to the hand: hanging at the sides, or the right one (on the viewer's right) raised to
// hold something. A space suit has thicker arms and bigger gloves.
const ARMS: Record<"plain" | "suit", { width: number; hand: number; left: Point[]; right: Point[]; raised: Point[] }> = {
  plain: { width: 11, hand: 6.8, left: [[43, 67], [34, 106]], right: [[77, 67], [86, 106]], raised: [[77, 67], [90, 94], [101, 78]] },
  suit: { width: 15, hand: 8.5, left: [[41, 68], [31, 104]], right: [[79, 68], [89, 104]], raised: [[79, 68], [92, 95], [102, 78]] },
};

// A figure of the given look, `size` pixels tall, filled with `color`. `prop` is an icon name (lib/icons.ts) held in
// the raised hand; any other name is left out, so the hand never holds a blank dot. `t` is the time in seconds, for
// a slow breath and a few bubbles rising from a flask.
export function Figure({ look, size, color, prop, t = 0 }: { look: FigureLook; size: number; color: string; prop?: string; t?: number }) {
  const { colors, drawing } = useTheme();
  const arms = look === "astronaut" ? ARMS.suit : ARMS.plain;
  const held = prop !== undefined && isIconName(prop) ? prop : null;
  const right = held ? arms.raised : arms.right;
  const [handX, handY] = right[right.length - 1];
  // The chest rises and falls a little, once every few seconds.
  const breath = 1 + 0.014 * (0.5 - 0.5 * Math.cos((2 * Math.PI * t) / BREATH_SEC));
  // The prop stands in the hand, which closes over its lower edge.
  const propTop = handY + 6 - PROP_SIZE;

  // The whole figure in one paint. What it holds is left out of the outline, since an icon draws its own.
  const figure = (paint: Paint, withProp: boolean) => (
    <>
      <Behind look={look} paint={paint} />
      <Legs look={look} paint={paint} />
      <g transform={`translate(0 ${HIP}) scale(1 ${breath}) translate(0 ${-HIP})`}>
        <Body look={look} paint={paint} />
        <Arm points={arms.left} width={arms.width} hand={arms.hand} paint={paint} />
        {withProp && held ? (
          <g transform={`translate(${handX - PROP_SIZE / 2} ${propTop})`}>
            <Icon name={held} size={PROP_SIZE} color={color} />
          </g>
        ) : null}
        {withProp && held === "flask" ? <Bubbles x={handX} y={propTop + 4} t={t} color={color} /> : null}
        <Arm points={right} width={arms.width} hand={arms.hand} paint={paint} />
        <Head look={look} paint={paint} />
      </g>
    </>
  );
  const shadow = <ellipse cx={60} cy={165} rx={38} ry={4.5} fill={colors.land} />;
  const box = { width: size * FIGURE_ASPECT, height: size, viewBox: `0 0 ${W} ${H}`, style: { display: "block", overflow: "visible" } } as const;
  if (drawing.icon === "solid") {
    const shade = interpolateColors(SHADE, [0, 1], [color, colors.ink]);
    return (
      <svg {...box}>
        {shadow}
        {figure({ color, shade, ink: colors.ink, edge: EDGE, grow: 0 }, true)}
      </svg>
    );
  }
  // A drawn figure is painted twice, as an icon is: first all of it in the outline color with wide edges, which
  // leaves the outline, then all of it again inside, with the marks on it drawn in the outline color. The outline is
  // chalk in the figure's color in Blueprint, with the second tone shaded in lightly; in Field guide it is ink, around
  // a pale tint of the figure's color and a deeper tint for the second tone.
  // Half an icon's outline on a figure as tall as the people scene draws them, and up to twice that in the grid on a
  // small figure, so it looks drawn with about the same pen as the icons beside it.
  const line = (drawing.stroke / 2) * Math.min(2, Math.max(1, Math.sqrt(450 / size)));
  const outline = drawing.icon === "ink" ? colors.paper : color;
  const inside = drawing.icon === "ink" ? mix(color, colors.ink, 0.25) : colors.ink;
  const shade = mix(color, colors.ink, drawing.icon === "ink" ? 0.45 : 0.2);
  return (
    <svg {...box}>
      {shadow}
      <g stroke={outline} strokeWidth={2 * line} strokeLinejoin="round">
        {figure({ color: outline, shade: outline, ink: outline, edge: line, grow: 2 * line }, false)}
      </g>
      {figure({ color: inside, shade, ink: outline, edge: line, grow: 0 }, true)}
    </svg>
  );
}

// An arm: a thick line with round ends and a round hand, edged in the background color.
function Arm({ points, width, hand, paint }: { points: Point[]; width: number; hand: number; paint: Paint }) {
  const d = `M${points.map((point) => point.join(" ")).join("L")}`;
  const [x, y] = points[points.length - 1];
  return (
    <g>
      <path d={d} fill="none" stroke={paint.ink} strokeWidth={width + 2 * paint.edge} strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke={paint.color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={x} cy={y} r={hand} fill={paint.color} {...edged(paint)} />
    </g>
  );
}

// What hangs behind the body: a ruler's cape, a space suit's backpack, an explorer's backpack with a bedroll on top.
function Behind({ look, paint }: { look: FigureLook; paint: Paint }) {
  const { shade, ink } = paint;
  if (look === "ruler") return <path d="M40 62Q60 56 80 62L97 158Q60 165 23 158Z" fill={shade} />;
  if (look === "astronaut") return <rect x={29} y={58} width={62} height={54} rx={9} fill={shade} />;
  if (look === "explorer") {
    return (
      <g>
        <rect x={30} y={62} width={60} height={46} rx={8} fill={shade} />
        <rect x={30} y={52} width={60} height={14} rx={7} fill={shade} {...edged(paint)} />
        <path d="M38 52V66M82 52V66" stroke={ink} strokeWidth={2.5} />
      </g>
    );
  }
  return null;
}

function Legs({ look, paint }: { look: FigureLook; paint: Paint }) {
  const { color, shade, grow } = paint;
  if (look === "astronaut") {
    // Thick suit legs in big boots.
    return (
      <g fill={color}>
        <path d="M49 104L48 150M71 104L72 150" stroke={color} strokeWidth={17 + grow} strokeLinecap="round" />
        <rect x={36} y={146} width={23} height={20} rx={6} {...edged(paint)} />
        <rect x={61} y={146} width={23} height={20} rx={6} {...edged(paint)} />
      </g>
    );
  }
  // Soldiers and explorers wear boots, in the second tone.
  const boots = look === "soldier" || look === "explorer" ? shade : color;
  return (
    <g>
      <path d="M50 104L49 154M70 104L71 154" stroke={color} strokeWidth={13 + grow} strokeLinecap="round" />
      <path d="M49.3 140L49 154M70.7 140L71 154" stroke={boots} strokeWidth={13.8 + grow} />
      <ellipse cx={45} cy={160} rx={9.5} ry={6} fill={boots} />
      <ellipse cx={75} cy={160} rx={9.5} ry={6} fill={boots} />
    </g>
  );
}

// The body, with the marks of each look on it.
function Body({ look, paint }: { look: FigureLook; paint: Paint }) {
  const { color, shade, ink } = paint;
  switch (look) {
    case "astronaut":
      // A wide suit with a control box on the chest.
      return (
        <g>
          <path d="M38 114L34 76Q34 60 50 60L70 60Q86 60 86 76L82 114Z" fill={color} />
          <rect x={49} y={72} width={22} height={15} rx={3} fill={ink} />
          <circle cx={55} cy={79.5} r={2.6} fill={color} />
          <circle cx={65} cy={79.5} r={2.6} fill={shade} />
        </g>
      );
    case "scientist":
      // A lab coat down to the knees, open at the neck and down the front.
      return (
        <g>
          <path d="M39 132L36 74Q36 60 51 60L69 60Q84 60 84 74L81 132Z" fill={color} {...edged(paint)} />
          <path d="M49.6 57L60 79L70.4 57Z" fill={ink} />
          <path d="M60 79V132" stroke={ink} strokeWidth={3} />
        </g>
      );
    case "doctor":
      // A buttoned coat with a stethoscope around the neck and a badge with a cross.
      return (
        <g>
          <path d="M39 132L36 74Q36 60 51 60L69 60Q84 60 84 74L81 132Z" fill={color} {...edged(paint)} />
          <path d="M50 57L60 72L70 57Z" fill={ink} />
          <path d="M49 57Q48 88 60 90Q72 88 71 57" fill="none" stroke={ink} strokeWidth={3} />
          <circle cx={60} cy={94} r={5} fill={ink} />
          <circle cx={60} cy={94} r={2} fill={color} />
          <rect x={65} y={102} width={13} height={13} rx={2.5} fill={ink} />
          <path d="M71.5 104.5V112.5M67.5 108.5H75.5" stroke={color} strokeWidth={3} />
        </g>
      );
    default:
      return (
        <g>
          <path d="M41 112L38 74Q38 60 52 60L68 60Q82 60 82 74L79 112Z" fill={color} />
          {look === "soldier" ? (
            // A belt and a strap across the chest.
            <g fill="none" stroke={ink}>
              <path d="M36 100H84" strokeWidth={5} />
              <path d="M43 59.7L77 99" strokeWidth={4} />
            </g>
          ) : null}
          {look === "worker" ? (
            // A work vest with two bright stripes.
            <g>
              <path d="M48.8 57L60 72L71.2 57Z" fill={ink} />
              <path d="M36 86H84M36 98H84" stroke={ink} strokeWidth={3.5} />
            </g>
          ) : null}
          {look === "explorer" ? <path d="M48 57V95M72 57V95" stroke={ink} strokeWidth={3.5} /> : null}
          {look === "ruler" ? <circle cx={60} cy={64} r={4} fill={shade} {...edged(paint)} /> : null}
        </g>
      );
  }
}

// The head, and what is worn on it.
function Head({ look, paint }: { look: FigureLook; paint: Paint }) {
  const { color, shade, ink } = paint;
  const head = <circle cx={60} cy={36} r={18} fill={color} />;
  switch (look) {
    case "astronaut":
      // A round helmet with a dark visor and a glint on it, on a collar ring.
      return (
        <g>
          <rect x={46} y={52} width={28} height={10} rx={3} fill={shade} />
          <circle cx={60} cy={34} r={23} fill={color} />
          <rect x={43} y={23} width={34} height={22} rx={11} fill={ink} />
          <path d="M49 30Q51 27 55 27" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
        </g>
      );
    case "scientist":
      // Goggles: two round lenses on a strap.
      return (
        <g>
          {head}
          <rect x={41} y={32} width={38} height={5} fill={ink} />
          <circle cx={52} cy={35} r={7} fill={ink} />
          <circle cx={68} cy={35} r={7} fill={ink} />
          <circle cx={52} cy={35} r={4} fill={shade} />
          <circle cx={68} cy={35} r={4} fill={shade} />
        </g>
      );
    case "soldier":
      // A broad combat helmet with a flared rim, straight across the brow.
      return (
        <g>
          {head}
          <path d="M33 38Q33 33 38 32Q38 11 60 11Q82 11 82 32Q87 33 87 38Z" fill={shade} strokeLinejoin="round" {...edged(paint)} />
        </g>
      );
    case "ruler":
      // A crown with three points.
      return (
        <g>
          {head}
          <path d="M45.5 27L43 7L52 16L60 4L68 16L77 7L74.5 27Z" fill={color} strokeLinejoin="round" {...edged(paint)} />
          <g fill={ink}>
            <circle cx={53} cy={22} r={1.8} />
            <circle cx={60} cy={22} r={1.8} />
            <circle cx={67} cy={22} r={1.8} />
          </g>
        </g>
      );
    case "worker":
      // A hard hat with a ridge and a wide brim.
      return (
        <g>
          {head}
          <path d="M42 33Q42 12 60 12Q78 12 78 33Z" fill={color} {...edged(paint)} />
          <path d="M55.5 14V32M64.5 14V32" stroke={ink} strokeWidth={2} />
          <rect x={31} y={31} width={58} height={7} rx={3.5} fill={color} {...edged(paint)} />
        </g>
      );
    case "explorer":
      // A wide-brimmed hat with a band.
      return (
        <g>
          {head}
          <path d="M45 31L47.5 16Q48.5 12 53 12L67 12Q71.5 12 72.5 16L75 31Z" fill={shade} {...edged(paint)} />
          <rect x={46} y={24} width={28} height={4} fill={ink} />
          <ellipse cx={60} cy={31} rx={33} ry={5.5} fill={shade} {...edged(paint)} />
        </g>
      );
    default:
      return head;
  }
}

// A few bubbles rising from the mouth of a flask and fading out, on a loop.
function Bubbles({ x, y, t, color }: { x: number; y: number; t: number; color: string }) {
  const sizes = [2.8, 2, 2.4];
  return (
    <g fill={color}>
      {sizes.map((r, index) => {
        const phase = (t / 1.8 + index / sizes.length) % 1;
        return <circle key={index} cx={x + 2.5 * Math.sin(phase * 7 + index * 2)} cy={y - phase * 26} r={r} opacity={Math.sin(Math.PI * phase)} />;
      })}
    </g>
  );
}
