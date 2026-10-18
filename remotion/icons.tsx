import type { ReactNode, SVGAttributes } from "react";
import { isIconName, type IconName } from "@/lib/icons";
import type { Theme } from "@/lib/themes";
import { mix, useTheme } from "./theme";

// Each icon is a few flat shapes on a 100 x 100 grid, filled with one color. Shapes that need a second tone use the
// background color, the `cut`, so they read on any background. Lines are used only where a line is the natural form
// (rays, orbits, a handle), and are thick enough to survive at 64 px.
//
// The look decides how the shapes are painted (see Icon at the bottom): flat in Night atlas, drawn as outlines in
// Blueprint, and as ink outlines over a pale tint in Field guide. The shapes say what each part is through a pen:
// a hole cut out of a shape, a detail line on a shape, a shape in front of the ones before it, or the gap around a
// line that crosses another line.

type Paint = SVGAttributes<SVGElement>;
type Pen = {
  hole: Paint; // a part cut out of a shape, like a window or the face of a coin
  detail: (width: number) => Paint; // a line on a shape, like a fold, a seam or a hand of a clock
  front: (width?: number) => Paint; // a shape in front of the shapes before it, kept apart from them
  gapLine: (width: number) => Paint; // the gap around a line that crosses in front of another line
};

// A line in the icon's color.
const line = (width: number) =>
  ({ fill: "none", stroke: "currentColor", strokeWidth: width, strokeLinecap: "round", strokeLinejoin: "round" }) as const;
// A line in the cut color, for details drawn on top of a shape.
const cutLine = (cut: string, width: number) =>
  ({ fill: "none", stroke: cut, strokeWidth: width, strokeLinecap: "round", strokeLinejoin: "round" }) as const;
// A cut outline painted behind a shape, so it stands apart from the shape it overlaps.
const gap = (cut: string, width = 8) => ({ stroke: cut, strokeWidth: width, strokeLinejoin: "round", paintOrder: "stroke" }) as const;

// Flat shapes: every detail is cut out of the shape in the background color.
const solidPen = (cut: string): Pen => ({
  hole: { fill: cut },
  detail: (width) => cutLine(cut, width),
  front: (width) => gap(cut, width),
  gapLine: (width) => cutLine(cut, width),
});

// A drawn icon is painted twice. First every shape in the outline color with a wide edge, which together make the
// outline around the whole icon; the details lie inside the shapes, so they are left out of it.
const NOTHING = { fill: "none", stroke: "none" } as const;
const outlinePen: Pen = { hole: {}, detail: () => NOTHING, front: () => ({}), gapLine: () => NOTHING };
// Then the shapes on top, filled with the inside color, which leaves the edge showing as the outline. Details become
// lines in the outline color, holes become outlined shapes, and a shape in front gets its own outline, so it stands
// apart from what it overlaps.
const insidePen = (cut: string, inside: string, outline: string, width: number): Pen => ({
  hole: { fill: cut, stroke: outline, strokeWidth: 0.7 * width },
  detail: (lineWidth) => cutLine(outline, Math.min(lineWidth, 0.7 * width)),
  front: () => ({ fill: inside, stroke: outline, strokeWidth: 2 * width, strokeLinejoin: "round", paintOrder: "stroke" }),
  gapLine: (lineWidth) => cutLine(cut, lineWidth),
});

// Rotation around a point, the middle of the grid by default.
const turn = (degrees: number, x = 50, y = 50) => `rotate(${degrees} ${x} ${y})`;
const EIGHT_WAYS = [0, 45, 90, 135, 180, 225, 270, 315];

// Flips a shape left to right across the middle of the grid, for the other half of a symmetric icon.
const MIRROR = "translate(100 0) scale(-1 1)";
// Moves a shape across the grid, to center an icon drawn off the middle.
const move = (dx: number, dy: number) => `translate(${dx} ${dy})`;
// A rounded bar from (x1, y1) to (x2, y2), `w` thick: a leg, a branch or a strut.
const stick = (x1: number, y1: number, x2: number, y2: number, w: number) => {
  const length = Math.hypot(x2 - x1, y2 - y1);
  const angle = (Math.atan2(x2 - x1, y1 - y2) * 180) / Math.PI;
  return (
    <rect key={`${x1} ${y1} ${x2} ${y2}`} x={x1 - w / 2} y={y1 - length - w / 2} width={w} height={length + w} rx={w / 2} transform={turn(+angle.toFixed(2), x1, y1)} />
  );
};
// Short strokes pointing away from (cx, cy), from radius r1 to r2, at each angle (degrees, clockwise from the right).
const rays = (cx: number, cy: number, r1: number, r2: number, angles: number[]) =>
  angles
    .map((a) => {
      const [c, s] = [Math.cos((a * Math.PI) / 180), Math.sin((a * Math.PI) / 180)];
      return `M${+(cx + r1 * c).toFixed(1)} ${+(cy + r1 * s).toFixed(1)}L${+(cx + r2 * c).toFixed(1)} ${+(cy + r2 * s).toFixed(1)}`;
    })
    .join("");
// Curved blades turning around (cx, cy), from radius r1 out to r2, each sweeping `sweep` degrees: a fan or a swirl.
const swirl = (cx: number, cy: number, r1: number, r2: number, angles: number[], sweep = 50) =>
  angles
    .map((a) => {
      const at = (r: number, d: number) => `${+(cx + r * Math.cos((d * Math.PI) / 180)).toFixed(1)} ${+(cy + r * Math.sin((d * Math.PI) / 180)).toFixed(1)}`;
      return `M${at(r1, a)}Q${at(r2, a)} ${at(r2, a + sweep)}`;
    })
    .join("");
// A pine of three tiers with its tip at (cx, top), `s` times the size of a 56-unit-tall crown.
const pine = (cx: number, top: number, s: number) => {
  const p = (dx: number, dy: number) => `${+(cx + dx * s).toFixed(1)} ${+(top + dy * s).toFixed(1)}`;
  return `M${p(0, 0)}L${p(12, 18)}L${p(6, 18)}L${p(18, 36)}L${p(10, 36)}L${p(24, 56)}L${p(-24, 56)}L${p(-10, 36)}L${p(-18, 36)}L${p(-6, 18)}L${p(-12, 18)}Z`;
};
// A band of waves across the grid, `h` thick, its crests `a` high.
const waveBand = (y: number, h = 12, a = 10) =>
  `M4 ${y}Q15.5 ${y - a} 27 ${y}T50 ${y}T73 ${y}T96 ${y}V${y + h}Q84.5 ${y + h + a} 73 ${y + h}T50 ${y + h}T27 ${y + h}T4 ${y + h}Z`;

const SHAPES: Record<IconName, (pen: Pen) => ReactNode> = {
  // People and power
  person: () => (
    <>
      <circle cx={50} cy={26} r={17} />
      <path d="M20 92Q20 50 50 48Q80 50 80 92Z" />
    </>
  ),
  people: (pen) => (
    <>
      <circle cx={33} cy={27} r={13} />
      <path d="M6 92Q6 52 33 50Q60 52 60 92Z" />
      <circle cx={65} cy={37} r={15} {...pen.front()} />
      <path d="M36 94Q36 60 65 58Q94 60 94 94Z" {...pen.front()} />
    </>
  ),
  astronaut: (pen) => (
    <>
      <path d="M12 96Q12 70 32 66H68Q88 70 88 96Z" />
      <rect x={40} y={76} width={20} height={11} rx={2} {...pen.hole} />
      <circle cx={50} cy={40} r={30} {...pen.front()} />
      <rect x={14} y={32} width={9} height={17} rx={3} />
      <rect x={77} y={32} width={9} height={17} rx={3} />
      <rect x={29} y={26} width={42} height={27} rx={13.5} {...pen.hole} />
      <path d="M37 35Q39 31 45 31" {...line(4)} />
    </>
  ),
  scientist: (pen) => (
    <>
      <circle cx={40} cy={24} r={16} />
      <path d="M24 23H56" {...pen.detail(5)} />
      <circle cx={33} cy={23} r={6.5} {...pen.hole} />
      <circle cx={47} cy={23} r={6.5} {...pen.hole} />
      <circle cx={33} cy={23} r={2.5} />
      <circle cx={47} cy={23} r={2.5} />
      <path d="M8 94Q8 50 40 46Q72 50 72 94Z" />
      <path d="M32 49L40 64L48 49M40 64V94" {...pen.detail(4)} />
      <path d="M68 42H82V46H79V60L92 87Q95 94 88 94H62Q55 94 58 87L71 60V46H68Z" {...pen.front()} />
      <path d="M63 77H87" {...pen.detail(4)} />
      <circle cx={84} cy={32} r={3.5} />
      <circle cx={77} cy={24} r={2.5} />
    </>
  ),
  soldier: (pen) => (
    <>
      <circle cx={50} cy={43} r={15} />
      <path d="M16 94Q16 65 50 63Q84 65 84 94Z" />
      <path d="M34 66L62 94" {...pen.detail(5)} />
      <path d="M18 44Q18 10 50 10Q82 10 82 44Q74 38 64 37H36Q26 38 18 44Z" {...pen.front(6)} />
      <path d="M22 36Q50 26 78 36" {...pen.detail(3.5)} />
    </>
  ),
  crown: (pen) => (
    <>
      <path d="M14 76L8 32L32 52L50 22L68 52L92 32L86 76Z" />
      <circle cx={8} cy={27} r={7} />
      <circle cx={50} cy={17} r={7} />
      <circle cx={92} cy={27} r={7} />
      <rect x={14} y={80} width={72} height={12} rx={3} />
      <circle cx={50} cy={62} r={6} {...pen.hole} />
      <circle cx={29} cy={64} r={4} {...pen.hole} />
      <circle cx={71} cy={64} r={4} {...pen.hole} />
    </>
  ),
  sword: (pen) => (
    <g transform={turn(45)}>
      <path d="M50 -8L59 4V70H41V4Z" />
      <path d="M50 8V62" {...pen.detail(3.5)} />
      <rect x={24} y={69} width={52} height={11} rx={5} />
      <rect x={45} y={79} width={10} height={21} rx={3} />
      <circle cx={50} cy={104} r={7} />
    </g>
  ),
  shield: (pen) => (
    <>
      <path d="M50 6L88 18V46Q88 76 50 94Q12 76 12 46V18Z" />
      <path d="M50 17L78 26V46Q78 70 50 83Q22 70 22 46V26Z" {...pen.detail(5)} />
    </>
  ),
  castle: (pen) => (
    <>
      <path d="M6 94V14H12V22H17V14H23V22H28V14H34V40H40V32H46V40H54V32H60V40H66V14H72V22H77V14H83V22H88V14H94V94Z" />
      <path d="M41 94V76A9 9 0 0 1 59 76V94Z" {...pen.hole} />
      <rect x={16} y={38} width={8} height={14} rx={4} {...pen.hole} />
      <rect x={76} y={38} width={8} height={14} rx={4} {...pen.hole} />
    </>
  ),
  flag: () => (
    <>
      <rect x={12} y={8} width={8} height={88} rx={4} />
      <circle cx={16} cy={8} r={6} />
      <path d="M19 14Q36 6 54 14Q70 22 88 14V58Q70 66 54 58Q36 50 19 58Z" />
    </>
  ),
  ballot: (pen) => (
    <>
      <rect x={12} y={50} width={76} height={42} rx={6} />
      <rect x={28} y={50} width={44} height={7} rx={3.5} {...pen.hole} />
      <rect x={34} y={8} width={32} height={46} rx={3} />
      <path d="M42 31L48 37L58 24" {...pen.detail(5)} />
    </>
  ),
  gavel: (pen) => (
    <>
      <g transform={turn(-45)}>
        <rect x={20} y={12} width={60} height={28} rx={6} />
        <path d="M31 12V40M69 12V40" {...pen.detail(4)} />
        <rect x={45} y={38} width={10} height={56} rx={5} />
      </g>
      <rect x={8} y={82} width={44} height={12} rx={4} />
    </>
  ),
  // Two sleeves, two hands, then the left hand's thumb and the right hand's four fingers wrapped over it, each finger
  // with a cut edge.
  handshake: (pen) => (
    <>
      <rect x={2} y={28} width={16} height={40} rx={3} transform={turn(-10, 10, 48)} />
      <rect x={82} y={28} width={16} height={40} rx={3} transform={turn(10, 90, 48)} />
      <path d="M19 38L38 32L47 44L36 64L19 64Z" />
      <path d="M81 32L60 27Q51 27 45 34L36 46L81 64Z" />
      {["M38 33L64 28", "M63 51L52 75", "M57 46L43 70", "M51 41L35 63", "M46 37L30 56"].map((d) => (
        <g key={d}>
          <path d={d} {...pen.gapLine(15)} />
          <path d={d} {...line(9)} />
        </g>
      ))}
    </>
  ),
  // Links seen face on, joined by links seen edge on. Each edge-on link sits in front of the link to its left and
  // behind the link to its right, so they read as interlocked.
  chains: (pen) => (
    <g transform={turn(-45)}>
      <rect x={-6} y={37} width={36} height={26} rx={13} {...line(8)} />
      <rect x={20} y={45} width={26} height={10} rx={5} {...pen.front(7)} />
      <rect x={36} y={37} width={36} height={26} rx={13} {...pen.gapLine(14)} />
      <rect x={36} y={37} width={36} height={26} rx={13} {...line(8)} />
      <rect x={62} y={45} width={26} height={10} rx={5} {...pen.front(7)} />
      <rect x={78} y={37} width={36} height={26} rx={13} {...pen.gapLine(14)} />
      <rect x={78} y={37} width={36} height={26} rx={13} {...line(8)} />
    </g>
  ),
  wall: (pen) => (
    <>
      <rect x={6} y={18} width={88} height={72} rx={3} />
      <path
        d="M6 36H94M6 54H94M6 72H94M35 18V36M65 18V36M20 36V54M50 36V54M80 36V54M35 54V72M65 54V72M20 72V90M50 72V90M80 72V90"
        {...pen.detail(5)}
        strokeLinecap="butt"
      />
    </>
  ),
  cannon: (pen) => (
    <>
      <path d="M40 70L8 90" {...line(9)} />
      <g transform={turn(-20)}>
        <path d="M18 36L84 41V57L18 62Q8 62 8 49Q8 36 18 36Z" />
        <rect x={80} y={37} width={10} height={24} rx={3} />
        <circle cx={6} cy={49} r={5} />
      </g>
      <circle cx={40} cy={70} r={20} {...pen.front()} />
      <circle cx={40} cy={70} r={13} {...pen.hole} />
      <path d="M27 70H53M33.5 58.7L46.5 81.3M33.5 81.3L46.5 58.7" {...line(4)} />
      <circle cx={40} cy={70} r={5} />
      <circle cx={74} cy={88} r={6} />
      <circle cx={88} cy={88} r={6} />
      <circle cx={81} cy={77} r={6} />
    </>
  ),
  tank: (pen) => (
    <>
      <rect x={6} y={62} width={88} height={26} rx={13} />
      {[20, 35, 50, 65, 80].map((x) => (
        <circle key={x} cx={x} cy={75} r={6} {...pen.hole} />
      ))}
      <path d="M12 58L22 46H78L90 58Z" />
      <path d="M30 47V38Q30 28 42 28H58Q68 28 70 38V47Z" />
      <rect x={66} y={33} width={30} height={7} rx={3} />
    </>
  ),
  dove: () => (
    <>
      <circle cx={22} cy={46} r={10} />
      <path d="M13 43L3 48L13 52Z" />
      <ellipse cx={48} cy={58} rx={27} ry={12} transform={turn(10, 48, 58)} />
      <path d="M68 56L94 48L89 62L94 76L66 67Z" />
      <path d="M34 52Q40 26 62 12Q76 5 94 7Q86 13 82 17L92 19Q84 25 78 27L86 31Q74 42 60 52Z" />
    </>
  ),

  // Places and buildings
  house: (pen) => (
    <>
      <rect x={66} y={14} width={11} height={24} />
      <path d="M50 8L94 46H82V92H18V46H6Z" />
      <rect x={30} y={64} width={16} height={28} rx={2} {...pen.hole} />
      <rect x={56} y={58} width={16} height={14} rx={2} {...pen.hole} />
    </>
  ),
  factory: (pen) => (
    <>
      <path d="M6 92V52L28 38V52L50 38V52L72 38V24H86V92Z" />
      <rect x={14} y={64} width={10} height={10} rx={1.5} {...pen.hole} />
      <rect x={32} y={64} width={10} height={10} rx={1.5} {...pen.hole} />
      <rect x={50} y={64} width={10} height={10} rx={1.5} {...pen.hole} />
      <circle cx={80} cy={14} r={5} />
      <circle cx={91} cy={7} r={4} />
    </>
  ),
  city: (pen) => (
    <>
      <rect x={6} y={42} width={22} height={52} />
      <rect x={32} y={12} width={26} height={82} />
      <rect x={43} y={3} width={4} height={10} />
      <rect x={62} y={30} width={18} height={64} />
      <rect x={84} y={54} width={10} height={40} />
      <path d="M40 20V70M50 20V70" {...pen.detail(6)} strokeLinecap="butt" strokeDasharray="7 6" />
      <path d="M17 50V84" {...pen.detail(8)} strokeLinecap="butt" strokeDasharray="6 6" />
      <path d="M71 38V84" {...pen.detail(7)} strokeLinecap="butt" strokeDasharray="6 6" />
    </>
  ),
  temple: () => (
    <>
      <path d="M50 6L94 30H6Z" />
      <rect x={8} y={33} width={84} height={8} />
      {[14, 35, 55, 76].map((x) => (
        <rect key={x} x={x} y={44} width={10} height={36} />
      ))}
      <rect x={8} y={83} width={84} height={5} />
      <rect x={4} y={90} width={92} height={6} />
    </>
  ),
  church: (pen) => (
    <>
      <path d="M8 94V58L30 40H70L92 58V94Z" />
      <path d="M37 94V38H35L50 12L65 38H63V94Z" {...pen.front(6)} />
      <rect x={47.5} y={0} width={5} height={14} />
      <rect x={43} y={3.5} width={14} height={5} />
      <path d="M44 94V81A6 6 0 0 1 56 81V94Z" {...pen.hole} />
      <circle cx={50} cy={57} r={5} {...pen.hole} />
      <rect x={17} y={66} width={8} height={14} rx={4} {...pen.hole} />
      <rect x={75} y={66} width={8} height={14} rx={4} {...pen.hole} />
    </>
  ),
  mosque: (pen) => (
    <>
      <rect x={24} y={56} width={52} height={38} />
      <path d="M27 58C20 44 34 32 50 24C66 32 80 44 73 58Z" />
      <rect x={48} y={12} width={4} height={14} />
      <circle cx={50} cy={11} r={3.5} />
      <path d="M8 94V31L13 14L18 31V94Z" />
      <rect x={5} y={42} width={16} height={5} rx={2} />
      <path d="M82 94V31L87 14L92 31V94Z" />
      <rect x={79} y={42} width={16} height={5} rx={2} />
      <path d="M42 94V78Q42 70 50 66Q58 70 58 78V94Z" {...pen.hole} />
      <path d="M24 57H76" {...pen.detail(3)} />
    </>
  ),
  pagoda: (pen) => (
    <>
      <rect x={48} y={3} width={4} height={14} />
      <circle cx={50} cy={4} r={3} />
      <path d="M26 26Q34 24 39 16H61Q66 24 74 26Z" />
      <rect x={37} y={25} width={26} height={14} />
      <path d="M16 48Q26 46 32 38H68Q74 46 84 48Z" />
      <rect x={31} y={47} width={38} height={14} />
      <path d="M6 72Q18 70 26 60H74Q82 70 94 72Z" />
      <rect x={24} y={71} width={52} height={23} />
      <rect x={43} y={78} width={14} height={16} rx={2} {...pen.hole} />
    </>
  ),
  pyramid: (pen) => (
    <>
      <path d="M68 40L98 90H38Z" />
      <path d="M42 14L82 90H2Z" {...pen.front()} />
      <path d="M42 14L54 90" {...pen.detail(4)} />
    </>
  ),
  tower: (pen) => (
    <>
      <path d="M22 8H32V16H42V8H58V16H68V8H78V30H22Z" />
      <path d="M30 33H70L67 82H33Z" />
      <rect x={22} y={84} width={56} height={10} rx={2} />
      <path d="M45 58V49A5 5 0 0 1 55 49V58Z" {...pen.hole} />
      <path d="M43 82V72A7 7 0 0 1 57 72V82Z" {...pen.hole} />
    </>
  ),
  bridge: () => (
    <>
      <rect x={4} y={16} width={92} height={6} rx={3} />
      {[10, 28, 47, 66, 84].map((x) => (
        <rect key={x} x={x} y={20} width={6} height={18} />
      ))}
      <path d="M2 36H98V48Q98 56 92 58V92H76Q76 58 50 58Q24 58 24 92H8V58Q2 56 2 48Z" />
    </>
  ),

  // Nature
  tree: () => (
    <>
      <circle cx={50} cy={32} r={25} />
      <circle cx={29} cy={50} r={18} />
      <circle cx={71} cy={50} r={18} />
      <circle cx={50} cy={52} r={20} />
      <rect x={44} y={58} width={12} height={36} rx={2} />
    </>
  ),
  wheat: () => (
    <>
      <path d="M50 96V26" {...line(6)} />
      <ellipse cx={50} cy={17} rx={7} ry={11} />
      {[33, 50, 67].map((y) => (
        <g key={y}>
          <ellipse cx={39} cy={y} rx={7.5} ry={13} transform={turn(-35, 39, y)} />
          <ellipse cx={61} cy={y} rx={7.5} ry={13} transform={turn(35, 61, y)} />
        </g>
      ))}
    </>
  ),
  leaf: (pen) => (
    <>
      <path d="M18 82Q24 20 86 14Q80 76 18 82Z" />
      <path d="M18 82L8 92" {...line(7)} />
      <path d="M26 74L72 28" {...pen.detail(4.5)} />
    </>
  ),
  mountain: (pen) => (
    <>
      <path d="M48 92L72 46L98 92Z" />
      <path d="M2 92L38 20L76 92Z" {...pen.front()} />
      <path d="M26 44L32 52L38 44L44 52L51 44" {...pen.detail(5)} />
      <path d="M64 61L68 66L72 61L76 66L80 61" {...pen.detail(4)} />
    </>
  ),
  drop: (pen) => (
    <>
      <path d="M50 6Q78 44 78 64A28 28 0 0 1 22 64Q22 44 50 6Z" />
      <path d="M35 64Q35 74 44 79" {...pen.detail(5)} />
    </>
  ),
  wave: (pen) => (
    <>
      <path d="M6 90C10 50 30 14 62 12C80 11 94 22 94 38C86 30 72 30 66 40C60 50 66 62 80 62C86 62 92 58 94 54V90Z" />
      <path d="M20 80C24 56 38 34 58 28" {...pen.detail(5)} />
    </>
  ),
  flame: (pen) => (
    <>
      <path d="M50 4C58 22 78 34 78 60C78 78 66 92 50 92C34 92 22 80 22 62C22 48 30 40 36 32C38 44 42 50 48 52C46 40 44 24 50 4Z" />
      <path d="M50 58C55 64 60 70 60 76C60 82 55 86 50 86C45 86 40 82 40 76C40 70 45 64 50 58Z" {...pen.hole} />
    </>
  ),
  cloud: () => <path d="M28 80A18 18 0 0 1 26 44A26 26 0 0 1 74 38A21 21 0 0 1 76 80Z" />,
  lightning: () => <path d="M58 4L18 56H46L38 96L82 40H54Z" />,
  snowflake: () => (
    <g {...line(7)}>
      {[0, 60, 120].map((a) => (
        <path key={a} d="M50 6V94M38 14L50 26L62 14M38 86L50 74L62 86" transform={turn(a)} />
      ))}
    </g>
  ),
  volcano: (pen) => (
    <>
      <circle cx={42} cy={17} r={10} />
      <circle cx={56} cy={12} r={12} />
      <circle cx={67} cy={22} r={8} />
      <path d="M4 94L36 40H64L96 94Z" {...pen.front()} />
      <path d="M41 40Q47 51 42 61Q38 69 44 78" {...pen.detail(6)} />
      <path d="M58 40Q54 52 61 63" {...pen.detail(5)} />
    </>
  ),
  rock: (pen) => (
    <>
      <path d="M8 84L18 46L42 26L70 30L90 56L92 84Z" />
      <path d="M42 26L50 54L90 56M50 54L30 84" {...pen.detail(4)} />
    </>
  ),
  fish: (pen) => (
    <>
      <path d="M78 50L96 30V70Z" />
      <path d="M6 50Q30 22 62 30Q76 34 84 50Q76 66 62 70Q30 78 6 50Z" {...pen.front()} />
      <circle cx={24} cy={46} r={4.5} {...pen.hole} />
      <path d="M48 36Q54 50 48 64" {...pen.detail(4)} />
    </>
  ),
  bird: () => <path d="M4 44Q26 28 44 46L50 56L56 46Q74 28 96 44Q74 40 62 56Q57 63 50 66Q43 63 38 56Q26 40 4 44Z" />,
  bee: (pen) => (
    <>
      <ellipse cx={36} cy={30} rx={16} ry={10} transform={turn(-30, 36, 30)} />
      <ellipse cx={60} cy={30} rx={16} ry={10} transform={turn(30, 60, 30)} />
      <ellipse cx={46} cy={62} rx={30} ry={21} {...pen.front()} />
      <path d="M38 43V81M54 43V81" {...pen.detail(6)} />
      <circle cx={83} cy={60} r={11} {...pen.front()} />
    </>
  ),
  sprout: () => (
    <>
      <path d="M50 92V44" {...line(7)} />
      <path d="M50 58Q20 60 14 30Q44 26 50 58Z" />
      <path d="M50 46Q54 16 86 14Q88 44 50 46Z" />
      <path d="M26 92H74" {...line(7)} />
    </>
  ),
  wind: () => (
    <g {...line(8)}>
      <path d="M8 36H58A12 12 0 1 0 46 24" />
      <path d="M8 56H76A12 12 0 1 1 64 68" />
      <path d="M8 76H40" />
    </g>
  ),
  sun: () => (
    <>
      <circle cx={50} cy={50} r={20} />
      <g {...line(8)}>
        {EIGHT_WAYS.map((a) => (
          <path key={a} d="M50 8V20" transform={turn(a)} />
        ))}
      </g>
    </>
  ),

  // Space
  moon: (pen) => (
    <>
      <path d="M47.9 10.05A40 40 0 1 0 87.1 64.95A34 34 0 1 1 47.9 10.05Z" />
      <circle cx={24} cy={54} r={5} {...pen.hole} />
      <circle cx={40} cy={76} r={3.5} {...pen.hole} />
    </>
  ),
  star: () => (
    <path
      d="M50 7L61.2 37.6L93.8 38.8L68.1 58.9L77 90.2L50 72L23 90.2L31.9 58.9L6.2 38.8L38.8 37.6Z"
      stroke="currentColor"
      strokeWidth={5}
      strokeLinejoin="round"
    />
  ),
  // The ring passes behind the planet, then its front half is drawn again over the planet with a cut edge.
  planet: (pen) => (
    <g transform={turn(-20)}>
      <ellipse cx={50} cy={50} rx={47} ry={12} {...line(6)} />
      <circle cx={50} cy={50} r={28} />
      <path d="M3 50A47 12 0 0 0 97 50" {...pen.gapLine(12)} strokeLinecap="butt" />
      <path d="M3 50A47 12 0 0 0 97 50" {...line(6)} />
    </g>
  ),
  // The Atlantic side of the globe: the Americas on the left, Europe and Africa on the right.
  earth: (pen) => (
    <>
      <circle cx={50} cy={50} r={42} {...pen.hole} />
      <g stroke="currentColor" strokeWidth={3} strokeLinejoin="round">
        <path d="M13 34L18 24L28 18L38 18L45 22L46 28L42 34L40 40L36 42L38 48L40 53L35 51L30 46L24 42L17 40Z" />
        <path d="M40 55L48 54L57 60L54 67L50 73L46 81L43 88L41 81L40 72L37 62Z" />
        <path d="M56 27L59 20L65 16L71 18L75 23L72 29L65 30L59 31Z" />
        <path d="M54 38L62 34L72 35L78 38L83 46L78 50L76 58L72 68L67 76L64 72L62 62L60 56L54 52L51 45Z" />
      </g>
      <circle cx={50} cy={50} r={42} {...line(7)} />
    </>
  ),
  rocket: (pen) => (
    <>
      <path d="M30 50L14 66V86L30 76Z" />
      <path d="M70 50L86 66V86L70 76Z" />
      <path d="M50 4C64 14 70 32 70 52V74H30V52C30 32 36 14 50 4Z" />
      <circle cx={50} cy={40} r={9} {...pen.hole} />
      <path d="M38 73H62L58 82H42Z" />
      <path d="M43 86Q50 102 57 86Z" />
    </>
  ),
  satellite: (pen) => (
    <g transform={turn(-40)}>
      <rect x={28} y={47} width={44} height={6} />
      <rect x={4} y={32} width={26} height={36} rx={2} />
      <rect x={70} y={32} width={26} height={36} rx={2} />
      <path d="M17 32V68M4 50H30M83 32V68M70 50H96" {...pen.detail(3)} strokeLinecap="butt" />
      <rect x={38} y={34} width={24} height={32} rx={4} />
      <path d="M50 34V22" {...line(4)} />
      <circle cx={50} cy={20} r={4.5} />
    </g>
  ),
  telescope: () => (
    <>
      <g transform={turn(-25, 50, 40)}>
        <rect x={26} y={30} width={50} height={20} rx={3} />
        <rect x={74} y={26} width={14} height={28} rx={3} />
        <rect x={12} y={34} width={15} height={12} rx={2} />
      </g>
      <path d="M50 50L30 92M50 50L70 92M50 50V92" {...line(7)} />
    </>
  ),

  // Science and health
  flask: (pen) => (
    <>
      <path d="M38 8H62M44 8V38L18 82Q14 90 24 90H76Q86 90 82 82L56 38V8" {...line(7)} />
      <path d="M31 60H69L82 82Q86 90 76 90H24Q14 90 18 82Z" />
      <circle cx={42} cy={76} r={4} {...pen.hole} />
      <circle cx={57} cy={71} r={3} {...pen.hole} />
    </>
  ),
  microscope: () => (
    <>
      <g transform={turn(20, 36, 30)}>
        <rect x={28} y={4} width={16} height={46} rx={4} />
        <rect x={26} y={0} width={20} height={8} rx={2} />
      </g>
      <path d="M66 84V62Q66 36 44 26" {...line(11)} />
      <rect x={14} y={58} width={52} height={7} rx={3} />
      <path d="M14 94H86V90Q86 84 80 84H20Q14 84 14 90Z" />
    </>
  ),
  atom: () => (
    <>
      <circle cx={50} cy={50} r={9} />
      <g {...line(7)}>
        {[0, 60, 120].map((a) => (
          <ellipse key={a} cx={50} cy={50} rx={42} ry={16} transform={turn(a)} />
        ))}
      </g>
    </>
  ),
  cell: (pen) => (
    <>
      <path d="M50 8Q82 8 90 40Q96 70 68 86Q42 98 20 78Q2 58 14 32Q26 8 50 8Z" {...line(7)} />
      <circle cx={54} cy={46} r={15} />
      <circle cx={58} cy={42} r={5} {...pen.hole} />
      <ellipse cx={30} cy={64} rx={8} ry={5} transform={turn(-20, 30, 64)} />
      <circle cx={70} cy={72} r={5} />
      <circle cx={28} cy={36} r={4} />
    </>
  ),
  virus: (pen) => (
    <>
      <g {...line(6)}>
        {EIGHT_WAYS.map((a) => (
          <path key={a} d="M50 30V12" transform={turn(a)} />
        ))}
      </g>
      {EIGHT_WAYS.map((a) => (
        <circle key={a} cx={50} cy={10} r={6} transform={turn(a)} />
      ))}
      <circle cx={50} cy={50} r={25} />
      <circle cx={42} cy={44} r={4.5} {...pen.hole} />
      <circle cx={58} cy={58} r={4} {...pen.hole} />
      <circle cx={57} cy={40} r={2.5} {...pen.hole} />
    </>
  ),
  bacteria: (pen) => (
    <>
      <path d="M66 21Q72 13 80 16T93 10M87 74Q93 80 89 87T93 96" {...line(4)} />
      <rect x={10} y={23} width={60} height={26} rx={13} transform={turn(-30, 40, 36)} />
      <rect x={40} y={57} width={48} height={22} rx={11} transform={turn(15, 64, 68)} />
      <circle cx={31.3} cy={41} r={3.5} {...pen.hole} />
      <circle cx={48.7} cy={31} r={3.5} {...pen.hole} />
      <circle cx={55.3} cy={65.7} r={3} {...pen.hole} />
      <circle cx={72.7} cy={70.3} r={3} {...pen.hole} />
    </>
  ),
  dna: () => (
    <>
      <path d="M32.4 14.6H67.6M32.4 41.4H67.6M32.4 58.6H67.6M32.4 85.4H67.6" {...line(5)} />
      <path d="M30 6C30 28 70 28 70 50C70 72 30 72 30 94M70 6C70 28 30 28 30 50C30 72 70 72 70 94" {...line(8)} />
    </>
  ),
  syringe: (pen) => (
    <g transform={turn(-45)}>
      <rect x={-6} y={36} width={7} height={28} rx={2} />
      <rect x={0} y={46} width={19} height={8} />
      <rect x={18} y={32} width={7} height={36} rx={2} />
      <rect x={24} y={38} width={50} height={24} rx={3} />
      <path d="M38 38V48M48 38V48M58 38V48" {...pen.detail(3)} strokeLinecap="butt" />
      <path d="M73 44L84 46V54L73 56Z" />
      <path d="M84 50H106" {...line(4)} />
    </g>
  ),
  pill: (pen) => (
    <g transform={turn(-45)}>
      <rect x={8} y={32} width={84} height={36} rx={18} />
      <path d="M54 39H74A11 11 0 0 1 74 61H54Z" {...pen.hole} />
    </g>
  ),
  heart: (pen) => (
    <>
      <path d="M50 88C20 68 6 52 6 34C6 20 18 10 30 10C40 10 46 16 50 24C54 16 60 10 70 10C82 10 94 20 94 34C94 52 80 68 50 88Z" />
      <path d="M18 34Q18 24 28 22" {...pen.detail(5)} />
    </>
  ),
  brain: (pen) => (
    <>
      <path d="M30 20Q14 22 14 40Q6 52 16 64Q16 84 38 82Q44 92 50 86Q56 92 62 82Q84 84 84 64Q94 52 86 40Q86 22 70 20Q60 8 50 18Q40 8 30 20Z" />
      <path
        d="M50 20V84M16 46Q26 44 28 50Q30 56 38 54M30 22Q34 30 30 36M22 72Q30 66 34 72Q36 78 42 76M84 50Q74 50 72 44Q70 38 62 40M70 22Q64 28 70 34M78 70Q70 72 66 66Q62 60 56 64"
        {...pen.detail(4)}
      />
    </>
  ),
  lungs: () => (
    <>
      <rect x={46} y={4} width={8} height={34} rx={4} />
      <path d="M50 34L38 48M50 34L62 48" {...line(7)} />
      <path d="M38 24Q20 24 13 48Q7 70 11 84Q15 94 27 90L38 85Q42 83 42 75V30Q42 24 38 24Z" />
      <path d="M62 24Q80 24 87 48Q93 70 89 84Q85 94 73 90L62 85Q58 83 58 75V30Q58 24 62 24Z" />
    </>
  ),
  bone: () => (
    <g transform={turn(-45)}>
      <rect x={18} y={42} width={64} height={16} />
      <circle cx={16} cy={40} r={12} />
      <circle cx={16} cy={60} r={12} />
      <circle cx={84} cy={40} r={12} />
      <circle cx={84} cy={60} r={12} />
    </g>
  ),
  magnet: (pen) => (
    <g transform={turn(45)}>
      <path d="M14 30H38V52A12 12 0 0 0 62 52V30H86V52A36 36 0 0 1 14 52Z" />
      <rect x={14} y={8} width={24} height={17} rx={2} />
      <rect x={62} y={8} width={24} height={17} rx={2} />
      <rect x={19} y={13} width={14} height={7} {...pen.hole} />
      <rect x={67} y={13} width={14} height={7} {...pen.hole} />
    </g>
  ),
  bulb: (pen) => (
    <>
      <path d="M50 6C30 6 18 22 18 38C18 52 28 60 33 68V72H67V68C72 60 82 52 82 38C82 22 70 6 50 6Z" />
      <path d="M32 38Q32 24 46 20" {...pen.detail(5)} />
      <rect x={34} y={76} width={32} height={6} rx={3} />
      <rect x={36} y={85} width={28} height={6} rx={3} />
      <rect x={42} y={93} width={16} height={5} rx={2.5} />
    </>
  ),
  gear: (pen) => (
    <>
      {[0, 45, 90, 135].map((a) => (
        <rect key={a} x={41} y={4} width={18} height={92} rx={4} transform={turn(a)} />
      ))}
      <circle cx={50} cy={50} r={33} />
      <circle cx={50} cy={50} r={13} {...pen.hole} />
    </>
  ),

  // Trade and travel
  gold: (pen) => (
    <>
      <path d="M29 66L35 44H65L71 66Z" />
      <path d="M6 92L12 70H42L48 92Z" />
      <path d="M52 92L58 70H88L94 92Z" />
      <path d="M33 51H67M10 77H44M56 77H90" {...pen.detail(3.5)} />
      <path d="M84 10Q86 20 96 22Q86 24 84 34Q82 24 72 22Q82 20 84 10Z" />
    </>
  ),
  // A stack of coins with one coin standing in front.
  coin: (pen) => (
    <>
      {[74, 62, 50, 38].map((y) => (
        <rect key={y} x={6} y={y} width={46} height={12} rx={6} {...pen.front(4)} />
      ))}
      <circle cx={64} cy={54} r={30} {...pen.front()} />
      <circle cx={64} cy={54} r={21} {...pen.detail(4)} />
    </>
  ),
  money: (pen) => (
    <>
      <rect x={16} y={18} width={78} height={46} rx={5} />
      <rect x={6} y={34} width={80} height={48} rx={5} {...pen.front()} />
      <circle cx={46} cy={58} r={11} {...pen.hole} />
      <circle cx={18} cy={46} r={3.5} {...pen.hole} />
      <circle cx={74} cy={70} r={3.5} {...pen.hole} />
    </>
  ),
  gem: (pen) => (
    <>
      <path d="M28 14H72L92 38L50 90L8 38Z" />
      <path d="M8 38H92M28 14L38 38L50 14L62 38L72 14M38 38L50 90L62 38" {...pen.detail(4)} />
    </>
  ),
  // A roll of cloth, its end showing the wound layers, with the loose end draped down in soft folds.
  silk: (pen) => (
    <>
      <path d="M20 38H84V46Q82 60 90 72Q96 82 90 92Q82 96 76 88Q68 78 58 82Q46 86 40 76Q34 66 24 64Q18 62 18 52Z" />
      <path d="M38 44Q48 60 66 64M58 44Q68 56 80 60" {...pen.detail(3.5)} />
      <path d="M20 8H84A8 16 0 0 1 84 40H20Z" {...pen.front(6)} />
      <ellipse cx={20} cy={24} rx={10} ry={16} {...pen.front(5)} />
      <path d="M20 24A2 3.5 0 0 1 22 27.5A4 7 0 0 1 16 24A6.5 11 0 0 1 26.5 24" {...pen.detail(3)} />
    </>
  ),
  // A heap of spice piled to a peak in a bowl, as at a spice market.
  spices: (pen) => (
    <>
      <path d="M14 54Q34 40 44 18Q50 8 56 18Q66 40 86 54Z" />
      <path d="M6 58H94Q92 90 50 92Q8 90 6 58Z" {...pen.front(6)} />
      {[
        [42, 42],
        [54, 32],
        [60, 46],
        [34, 51],
        [68, 52],
      ].map(([x, y]) => (
        <circle key={x} cx={x} cy={y} r={2.8} {...pen.hole} />
      ))}
    </>
  ),
  tea: (pen) => (
    <>
      <path d="M76 48Q92 48 92 62Q92 76 74 78" {...line(7)} />
      <path d="M26 70Q12 68 8 50L4 42L12 42Q16 54 26 56Z" />
      <path d="M22 64C22 46 34 38 50 38C66 38 78 46 78 64C78 78 70 88 62 90H38C30 88 22 78 22 64Z" />
      <path d="M34 34Q36 24 50 24Q64 24 66 34Z" />
      <circle cx={50} cy={20} r={5} />
      <path d="M24 58Q50 66 76 58" {...pen.detail(4)} />
    </>
  ),
  vase: (pen) => (
    <>
      <path d="M40 6H60V11Q55 13 55 19Q55 25 63 30Q82 42 80 62Q78 80 64 88L66 94H34L36 88Q22 80 20 62Q18 42 37 30Q45 25 45 19Q45 13 40 11Z" />
      <path d="M28 42Q50 48 72 42M24 76Q50 82 76 76M24 60Q31 54 38 60T52 60T66 60T80 60" {...pen.detail(4)} />
    </>
  ),
  barrel: (pen) => (
    <>
      <path d="M24 8H76Q88 30 88 50Q88 70 76 92H24Q12 70 12 50Q12 30 24 8Z" />
      <path d="M14 24H86M14 32H86M14 68H86M14 76H86" {...pen.detail(4)} strokeLinecap="butt" />
      <path d="M38 9Q34 50 38 91M62 9Q66 50 62 91" {...pen.detail(3)} />
    </>
  ),
  // A trotting horse, side view, facing left.
  horse: () => (
    <>
      <path d="M34 44Q36 32 52 32H78Q90 32 90 46Q90 60 78 62H44Q34 62 34 52Z" />
      <path d="M36 58L22 30L30 14L54 34Z" />
      <path d="M30 11Q24 9 19 15L4 33Q1 40 8 43Q13 44 17 40L29 31Z" />
      <path d="M25 13L28 2L33 12Z" />
      <path d="M38 58L36 76L28 86M48 60L48 92M72 60L68 92M84 56L86 74L82 92" {...line(7)} />
      <path d="M88 36Q100 44 96 72Q92 64 86 54Z" />
    </>
  ),
  // A camel with two humps, side view, facing left.
  camel: () => (
    <>
      <path d="M30 56Q28 44 36 40Q42 22 52 22Q58 24 60 34Q64 20 72 20Q80 22 82 38Q90 44 88 56Q86 64 76 64H40Q32 64 30 56Z" />
      <path d="M36 46Q24 46 20 36L18 28" {...line(11)} />
      <path d="M4 27Q4 19 13 18Q22 17 25 23L23 31Q14 33 8 33Q4 32 4 27Z" />
      <path d="M18 19L21 12L25 19Z" />
      {[36, 46, 68, 78].map((x) => (
        <rect key={x} x={x} y={60} width={6} height={34} rx={3} />
      ))}
      <path d="M87 48Q93 54 90 64" {...line(4)} />
    </>
  ),
  // A sailing ship with square sails filled by the wind, a raised stern and a pennant.
  ship: (pen) => (
    <>
      <rect x={46} y={4} width={5} height={60} />
      <path d="M50 4L66 8L50 12Z" />
      <path d="M30 12H62Q68 20 62 28H30Q36 20 30 12Z" />
      <path d="M22 32H70Q78 44 70 56H22Q30 44 22 32Z" />
      <path d="M4 52H22L26 62H80L96 54L88 78Q84 88 74 88H26Q16 88 12 80L4 62Z" />
      {[34, 50, 66].map((x) => (
        <circle key={x} cx={x} cy={74} r={3.5} {...pen.hole} />
      ))}
    </>
  ),
  cart: (pen) => (
    <>
      <path d="M70 52L96 60" {...line(6)} />
      <path d="M8 34H76L72 58H12Z" />
      <path d="M10 46H74" {...pen.detail(4)} />
      <circle cx={40} cy={70} r={21} {...pen.front()} />
      <circle cx={40} cy={70} r={13.5} {...pen.hole} />
      <path d="M26 70H54M33 57.9L47 82.1M33 82.1L47 57.9" {...line(4)} />
      <circle cx={40} cy={70} r={5} />
    </>
  ),
  train: (pen) => (
    <>
      <circle cx={78} cy={14} r={6} />
      <circle cx={90} cy={7} r={4.5} />
      <path d="M66 41L64 24H80L78 41Z" />
      <circle cx={52} cy={40} r={6} />
      <rect x={6} y={18} width={38} height={8} rx={3} />
      <rect x={10} y={24} width={30} height={44} />
      <rect x={38} y={40} width={48} height={28} rx={5} />
      <path d="M85 60L96 80H85Z" />
      <rect x={6} y={66} width={86} height={6} rx={2} />
      <rect x={17} y={32} width={16} height={14} rx={2} {...pen.hole} />
      <circle cx={24} cy={82} r={11} {...pen.front(6)} />
      <circle cx={54} cy={84} r={9} {...pen.front(6)} />
      <circle cx={76} cy={84} r={9} {...pen.front(6)} />
    </>
  ),
  car: (pen) => (
    <>
      <path d="M4 72V60Q4 52 12 51L26 49L36 34Q39 30 44 30H66Q71 30 74 34L84 49L90 50Q96 52 96 60V72Q96 76 92 76H8Q4 76 4 72Z" />
      <path d="M40 47L47 36H55V47ZM60 47V36H67L74 47Z" {...pen.hole} />
      <circle cx={26} cy={76} r={11} {...pen.front()} />
      <circle cx={74} cy={76} r={11} {...pen.front()} />
      <circle cx={26} cy={76} r={4} {...pen.hole} />
      <circle cx={74} cy={76} r={4} {...pen.hole} />
    </>
  ),
  plane: () => (
    <g transform={turn(45)}>
      <rect x={44} y={4} width={12} height={90} rx={6} />
      <path d="M50 34L94 58V68L50 54L6 68V58Z" />
      <path d="M50 78L72 90V96L50 90L28 96V90Z" />
    </g>
  ),

  // Knowledge and signs
  scroll: (pen) => (
    <>
      <rect x={22} y={18} width={56} height={66} />
      <path d="M32 36H68M32 47H68M32 58H58" {...pen.detail(4)} />
      <rect x={14} y={8} width={72} height={14} rx={7} {...pen.front(6)} />
      <rect x={14} y={80} width={72} height={14} rx={7} {...pen.front(6)} />
    </>
  ),
  book: (pen) => (
    <>
      <path d="M6 24Q26 14 47 24V88Q26 78 6 88Z" />
      <path d="M53 24Q74 14 94 24V88Q74 78 53 88Z" />
      <path
        d="M14 38Q26 33 39 38M14 50Q26 45 39 50M14 62Q26 57 39 62M61 38Q74 33 86 38M61 50Q74 45 86 50M61 62Q74 57 86 62"
        {...pen.detail(4)}
      />
    </>
  ),
  letter: (pen) => (
    <>
      <rect x={8} y={20} width={84} height={60} rx={6} />
      <path d="M13 26L50 54L87 26" {...pen.detail(5)} />
      <circle cx={50} cy={54} r={8} {...pen.front(5)} />
    </>
  ),
  newspaper: (pen) => (
    <>
      <rect x={10} y={12} width={80} height={76} rx={4} />
      <rect x={18} y={20} width={64} height={11} rx={2} {...pen.hole} />
      <rect x={18} y={39} width={28} height={22} rx={2} {...pen.hole} />
      <path d="M54 42H82M54 51H82M54 60H82M18 70H82M18 79H70" {...pen.detail(4)} />
    </>
  ),
  map: (pen) => (
    <>
      <path d="M8 22L34 12L66 22L92 12V78L66 88L34 78L8 88Z" />
      <path d="M34 12V78M66 22V88" {...pen.detail(4)} />
      <path d="M18 68Q28 42 44 52T76 34" {...pen.detail(4)} strokeLinecap="butt" strokeDasharray="6 5" />
      <circle cx={80} cy={31} r={5} {...pen.hole} />
    </>
  ),
  compass: (pen) => (
    <>
      <circle cx={50} cy={50} r={41} {...line(7)} />
      <g transform={turn(45)}>
        <path d="M50 16L63 50L50 84L37 50Z" />
        <path d="M44.5 55H55.5L50 72Z" {...pen.hole} />
      </g>
      <circle cx={50} cy={50} r={3.5} {...pen.hole} />
    </>
  ),
  clock: (pen) => (
    <>
      <circle cx={50} cy={50} r={42} />
      <path d="M50 24V50L66 60" {...pen.detail(7)} />
      {[0, 90, 180, 270].map((a) => (
        <circle key={a} cx={50} cy={15} r={3.5} {...pen.hole} transform={turn(a)} />
      ))}
    </>
  ),
  calendar: (pen) => (
    <>
      <rect x={10} y={14} width={80} height={78} rx={8} />
      <rect x={10} y={34} width={80} height={5} {...pen.hole} />
      {[22, 44, 66].map((x) => (
        <g key={x}>
          <rect x={x} y={48} width={12} height={11} rx={2} {...pen.hole} />
          <rect x={x} y={68} width={12} height={11} rx={2} {...pen.hole} />
        </g>
      ))}
      <rect x={26} y={6} width={9} height={20} rx={4.5} {...pen.front(6)} />
      <rect x={65} y={6} width={9} height={20} rx={4.5} {...pen.front(6)} />
    </>
  ),
  phone: (pen) => (
    <>
      <path d="M10 36Q10 16 50 16Q90 16 90 36V40Q90 44 86 44H70Q66 44 66 40V36Q66 30 50 30Q34 30 34 36V40Q34 44 30 44H14Q10 44 10 40Z" />
      <path d="M20 52H80L90 88Q91 92 86 92H14Q9 92 10 88Z" />
      <circle cx={50} cy={71} r={14} {...pen.hole} />
      <circle cx={50} cy={71} r={6} />
    </>
  ),
  computer: (pen) => (
    <>
      <rect x={6} y={12} width={88} height={60} rx={6} />
      <rect x={13} y={19} width={74} height={46} rx={2} {...pen.hole} />
      <path d="M42 71H58L62 85H38Z" />
      <rect x={26} y={84} width={48} height={8} rx={4} />
    </>
  ),
  radio: (pen) => (
    <>
      <path d="M64 32L82 9" {...line(5)} />
      <circle cx={83} cy={8} r={4.5} />
      <rect x={8} y={32} width={84} height={58} rx={8} />
      <path d="M18 46H50M18 56H50M18 66H50M18 76H50" {...pen.detail(5)} />
      <circle cx={72} cy={54} r={9} {...pen.hole} />
      <circle cx={72} cy={54} r={3} />
      <rect x={63} y={70} width={7} height={9} rx={2} {...pen.hole} />
      <rect x={75} y={70} width={7} height={9} rx={2} {...pen.hole} />
    </>
  ),
  chart: () => (
    <>
      <rect x={10} y={56} width={20} height={36} rx={3} />
      <rect x={40} y={34} width={20} height={58} rx={3} />
      <rect x={70} y={12} width={20} height={80} rx={3} />
    </>
  ),
  check: () => <path d="M14 52L38 76L86 24" {...line(14)} />,
  cross: () => <path d="M22 22L78 78M78 22L22 78" {...line(14)} />,
  question: () => (
    <>
      <path d="M28 34Q28 12 50 12Q72 12 72 32Q72 44 50 52V64" {...line(12)} />
      <circle cx={50} cy={84} r={8} />
    </>
  ),
  warning: (pen) => (
    <>
      <path d="M50 10L92 86H8Z" stroke="currentColor" strokeWidth={8} strokeLinejoin="round" />
      <rect x={45} y={36} width={10} height={28} rx={5} {...pen.hole} />
      <circle cx={50} cy={74} r={5.5} {...pen.hole} />
    </>
  ),
  lock: (pen) => (
    <>
      <path d="M32 46V32A18 18 0 0 1 68 32V46" {...line(10)} />
      <rect x={18} y={44} width={64} height={48} rx={8} />
      <circle cx={50} cy={63} r={7} {...pen.hole} />
      <rect x={46.5} y={63} width={7} height={16} rx={3} {...pen.hole} />
    </>
  ),
  key: (pen) => (
    <g transform={turn(-45)}>
      <circle cx={16} cy={50} r={19} />
      <circle cx={16} cy={50} r={8} {...pen.hole} />
      <rect x={30} y={44} width={74} height={12} rx={3} />
      <rect x={80} y={54} width={9} height={14} rx={2} />
      <rect x={92} y={54} width={9} height={18} rx={2} />
    </g>
  ),

  // Animals
  rabbit: (pen) => (
    <g transform={move(-4, 0)}>
      <ellipse cx={48} cy={22} rx={7} ry={17} transform={turn(24, 48, 22)} />
      <ellipse cx={37} cy={21} rx={7} ry={17} transform={turn(4, 37, 21)} />
      <path d="M24 92C20 74 26 58 40 54C56 48 80 50 88 68C93 80 88 92 76 92Z" />
      <ellipse cx={30} cy={44} rx={17} ry={14} />
      <circle cx={89} cy={78} r={7} {...pen.front(6)} />
      <circle cx={25} cy={40} r={3.5} {...pen.hole} />
      <path d="M58 92Q54 72 72 68" {...pen.detail(4)} />
    </g>
  ),
  fox: (pen) => (
    <g transform={move(0, -3)}>
      <path d="M66 50C78 38 96 42 96 58C96 70 86 74 78 68C72 64 68 60 62 58Z" />
      <path d="M85 47Q82 60 90 71" {...pen.detail(4)} />
      <path d="M30 44Q50 38 68 46Q74 56 66 64H36Q28 60 30 44Z" />
      {[30, 40, 58, 66].map((x) => (
        <rect key={x} x={x} y={56} width={6} height={36} rx={3} />
      ))}
      <path d="M3 47L18 36L19 18L28 29L36 18L38 34Q42 44 36 50Q24 56 3 47Z" />
      <circle cx={21} cy={39} r={2.8} {...pen.hole} />
    </g>
  ),
  deer: (pen) => (
    <>
      <path d="M26 22Q30 12 38 6M31 14L28 5M24 22Q18 12 10 8M18 14L20 5" {...line(4.5)} />
      <path d="M4 34Q6 28 14 26L24 22Q30 22 32 28L42 42Q60 38 78 42Q88 44 86 56Q84 64 74 64H42Q34 62 32 52L24 38Q18 40 10 40Q4 40 4 34Z" />
      <ellipse cx={32} cy={22} rx={7} ry={3.5} transform={turn(-30, 32, 22)} />
      {[34, 42, 70, 78].map((x) => (
        <rect key={x} x={x} y={56} width={5} height={38} rx={2.5} />
      ))}
      <ellipse cx={87} cy={45} rx={3} ry={6} transform={turn(30, 87, 45)} />
      <circle cx={15} cy={30} r={2.5} {...pen.hole} />
    </>
  ),
  // A wolf sitting and howling, side view, facing left.
  wolf: (pen) => (
    <g transform={move(-4, 0)}>
      <path d="M26 94L28 66Q22 56 24 48Q22 38 20 28L16 18L12 9Q12 5 16 6L24 12L28 14L35 5L39 22Q48 34 56 48Q64 60 74 64Q88 70 90 84L97 89Q96 94 90 94Z" />
      <path d="M42 94V72M60 94Q58 76 72 70" {...pen.detail(4)} />
      <circle cx={24} cy={17} r={2.2} {...pen.hole} />
    </g>
  ),
  bear: (pen) => (
    <g transform={move(0, -7)}>
      <circle cx={27} cy={33} r={6.5} />
      <rect x={42} y={62} width={12} height={28} rx={4} />
      <rect x={64} y={62} width={14} height={28} rx={4} />
      <path d="M6 50Q4 44 10 42L20 37Q26 32 34 36Q46 26 64 28Q88 30 92 52V92H78V72H42V92H28L27 64Q22 60 16 58L10 57Q6 56 6 50Z" />
      <path d="M42 76V90M78 76V90" {...pen.detail(3.5)} />
      <circle cx={16} cy={45} r={2.8} {...pen.hole} />
    </g>
  ),
  cow: (pen) => (
    <g transform={move(0, -3)}>
      <path d="M90 42Q96 56 92 72" {...line(4)} />
      <ellipse cx={92} cy={75} rx={4} ry={6} />
      <rect x={26} y={34} width={66} height={34} rx={12} />
      {[30, 42, 72, 83].map((x) => (
        <rect key={x} x={x} y={60} width={8} height={32} rx={3} />
      ))}
      <ellipse cx={64} cy={70} rx={7} ry={5} />
      <path d="M16 31Q9 27 7 18Q16 20 22 28Z" />
      <path d="M11 64Q4 64 4 56L8 36Q10 28 20 28L28 30Q34 32 32 40L27 58Q25 64 17 64Z" />
      <ellipse cx={32} cy={32} rx={8} ry={4} transform={turn(20, 32, 32)} />
      <path d="M44 40Q54 36 58 44Q60 52 50 52Q42 50 44 40ZM70 38Q80 36 84 42Q80 50 72 46Q66 42 70 38Z" {...pen.hole} />
      <circle cx={20} cy={38} r={3} {...pen.hole} />
      <circle cx={9} cy={56} r={2.2} {...pen.hole} />
    </g>
  ),
  sheep: (pen) => (
    <g transform={move(0, -5)}>
      {[40, 50, 68, 78].map((x) => (
        <rect key={x} x={x} y={66} width={6} height={27} rx={3} />
      ))}
      {[
        [34, 52, 12],
        [44, 38, 13],
        [60, 34, 13],
        [75, 40, 12],
        [85, 54, 11],
        [76, 67, 11],
        [60, 70, 12],
        [44, 68, 12],
      ].map(([cx, cy, r]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} />
      ))}
      <ellipse cx={60} cy={53} rx={26} ry={17} />
      <ellipse cx={29} cy={41} rx={8} ry={4} transform={turn(-25, 29, 41)} />
      <ellipse cx={20} cy={50} rx={11} ry={15} transform={turn(28, 20, 50)} {...pen.front()} />
      <circle cx={21} cy={45} r={2.5} {...pen.hole} />
    </g>
  ),
  pig: (pen) => (
    <g transform={move(0, -4)}>
      <path d="M86 50Q96 44 93 36Q90 30 85 35Q82 41 91 41" {...line(3.5)} />
      {[26, 38, 64, 76].map((x) => (
        <rect key={x} x={x} y={68} width={9} height={24} rx={3} />
      ))}
      <ellipse cx={54} cy={56} rx={34} ry={23} />
      <circle cx={28} cy={50} r={17} />
      <path d="M28 38Q28 22 40 20Q46 30 40 42Z" {...pen.front(5)} />
      <ellipse cx={12} cy={54} rx={7} ry={10} {...pen.front(5)} />
      <circle cx={11} cy={50} r={2.2} {...pen.hole} />
      <circle cx={11} cy={58} r={2.2} {...pen.hole} />
      <circle cx={25} cy={45} r={3} {...pen.hole} />
    </g>
  ),
  chicken: (pen) => (
    <g transform={move(0, -4)}>
      <path d="M44 86V94M38 94H50M60 86V94M54 94H66" {...line(4)} />
      <path d="M66 52L84 20Q94 28 93 46Q92 60 82 64Z" />
      <path d="M22 44Q30 58 50 54Q72 50 84 58Q86 82 62 87Q38 92 26 78Q18 64 22 44Z" />
      <circle cx={28} cy={36} r={12} />
      <path d="M17 34L7 38L17 42Z" />
      <circle cx={23} cy={22} r={4.5} />
      <circle cx={30} cy={20} r={5} />
      <circle cx={37} cy={23} r={4.5} />
      <ellipse cx={18} cy={47} rx={3.5} ry={5.5} />
      <circle cx={27} cy={33} r={2.5} {...pen.hole} />
      <path d="M44 66Q58 78 76 66" {...pen.detail(4)} />
    </g>
  ),
  // A sitting cat, its tail curled around its feet.
  cat: (pen) => (
    <g transform={move(-6, 0)}>
      <path d="M62 92Q92 94 92 74Q92 62 84 58Q86 70 84 78Q80 86 62 86Z" />
      <path d="M26 94Q22 70 30 52Q34 44 44 42Q62 44 70 64Q76 82 68 94Z" />
      <path d="M22 22L22 4L34 14ZM42 14L54 4L54 22Z" />
      <circle cx={38} cy={26} r={16} />
      <path d="M40 94V70" {...pen.detail(4)} />
      <circle cx={31} cy={25} r={2.6} {...pen.hole} />
      <circle cx={45} cy={25} r={2.6} {...pen.hole} />
    </g>
  ),
  dog: (pen) => (
    <g transform={move(0, -6)}>
      <path d="M78 46Q88 40 90 24Q96 34 92 46Q88 52 80 52Z" />
      {[32, 42, 66, 76].map((x) => (
        <rect key={x} x={x} y={56} width={7} height={36} rx={3} />
      ))}
      <path d="M30 42Q54 38 78 42Q86 46 84 58Q82 64 74 64H36Q28 62 30 42Z" />
      <path d="M8 36L16 33Q20 24 28 22Q36 22 38 30V44Q36 50 30 50L14 48Q6 46 6 40Q6 37 8 36Z" />
      <circle cx={6} cy={38} r={3.5} />
      <path d="M25 24Q34 22 36 32L34 46Q30 46 28 40Z" {...pen.front(5)} />
      <circle cx={18} cy={32} r={2.5} {...pen.hole} />
      <path d="M40 34L42 52" {...pen.detail(4)} />
    </g>
  ),
  mouse: (pen) => (
    <g transform={move(0, -7)}>
      <path d="M78 80Q96 80 94 62Q92 50 84 46" {...line(4)} />
      <path d="M4 66Q20 52 38 46Q60 40 76 54Q86 66 80 80Q76 88 66 88H30Q14 84 4 66Z" />
      <ellipse cx={34} cy={90} rx={7} ry={3} />
      <ellipse cx={62} cy={90} rx={7} ry={3} />
      <circle cx={40} cy={38} r={13} {...pen.front(6)} />
      <circle cx={40} cy={38} r={6} {...pen.hole} />
      <circle cx={20} cy={60} r={3} {...pen.hole} />
    </g>
  ),
  frog: (pen) => (
    <g transform={move(0, -4)}>
      <path d="M14 88Q4 74 12 62Q20 54 30 60L32 84Q24 92 14 88ZM86 88Q96 74 88 62Q80 54 70 60L68 84Q76 92 86 88Z" />
      <path d="M20 72Q14 50 30 40Q50 32 70 40Q86 50 80 72Q74 88 50 88Q26 88 20 72Z" />
      <circle cx={32} cy={30} r={13} />
      <circle cx={68} cy={30} r={13} />
      <circle cx={32} cy={30} r={7} {...pen.hole} />
      <circle cx={68} cy={30} r={7} {...pen.hole} />
      <circle cx={33} cy={31} r={3.5} {...pen.front(3)} />
      <circle cx={67} cy={31} r={3.5} {...pen.front(3)} />
      <path d="M32 58Q50 68 68 58" {...pen.detail(4)} />
      <ellipse cx={38} cy={90} rx={8} ry={4} />
      <ellipse cx={62} cy={90} rx={8} ry={4} />
    </g>
  ),
  // A snake rearing its head, its body two half rings.
  snake: (pen) => (
    <g transform={move(0, 4)}>
      <path d="M8 48A20 20 0 0 0 48 48H36A8 8 0 0 1 20 48Z" />
      <path d="M36 48A20 20 0 0 1 76 48H64A8 8 0 0 0 48 48Z" />
      <path d="M64 48Q64 62 78 68L94 72Q80 60 76 48Z" />
      <rect x={8} y={32} width={12} height={17} />
      <ellipse cx={16} cy={28} rx={11} ry={8.5} />
      <circle cx={13} cy={25} r={2.4} {...pen.hole} />
      <path d="M5 31L1 33M5 31L1 28" {...line(2.5)} />
    </g>
  ),
  lizard: (pen) => (
    <>
      <path d="M46 62Q42 80 54 88Q68 94 86 86Q70 88 62 80Q56 74 56 62Z" />
      {[0, 1].map((side) => (
        <g key={side} transform={side ? MIRROR : undefined}>
          <rect x={27} y={31} width={19} height={6} rx={3} />
          <rect x={25} y={19} width={6} height={18} rx={3} />
          <rect x={27} y={55} width={19} height={6} rx={3} />
          <rect x={25} y={55} width={6} height={18} rx={3} />
          <path d="M28 20L22 14M28 20V12M28 20L34 14M28 72L22 78M28 72V80M28 72L34 78" {...line(3.5)} />
        </g>
      ))}
      <ellipse cx={50} cy={46} rx={10} ry={20} />
      <ellipse cx={50} cy={20} rx={9} ry={11} />
      <circle cx={46} cy={16} r={2.2} {...pen.hole} />
      <circle cx={54} cy={16} r={2.2} {...pen.hole} />
    </>
  ),
  turtle: (pen) => (
    <>
      <rect x={22} y={60} width={13} height={24} rx={5} />
      <rect x={66} y={60} width={13} height={24} rx={5} />
      <path d="M86 62L96 68L86 70Z" />
      <path d="M6 52Q4 44 12 42Q20 42 26 50L28 62H14Q8 60 6 52Z" />
      <rect x={12} y={58} width={78} height={9} rx={4.5} />
      <path d="M17 60Q19 22 52 22Q85 22 87 60Z" {...pen.front()} />
      <path d="M36 59L41 41H63L68 59M41 41L33 30M63 41L71 30M52 41V24" {...pen.detail(4)} />
      <circle cx={12} cy={47} r={2.5} {...pen.hole} />
    </>
  ),
  whale: (pen) => (
    <g transform={move(0, 6)}>
      <path d="M27 28Q24 18 15 15M29 28Q32 18 41 15" {...line(4.5)} />
      <path d="M4 58Q4 36 32 34Q58 32 74 50Q79 55 84 51L86 43Q89 36 96 35Q94 46 91 54Q95 60 96 67Q89 65 85 62Q79 72 66 72L32 74Q4 74 4 58Z" />
      <path d="M10 64Q30 70 56 68" {...pen.detail(4)} />
      <circle cx={22} cy={54} r={3} {...pen.hole} />
    </g>
  ),
  shark: (pen) => (
    <>
      <path d="M77 49L92 23Q96 22 95 28L88 52L96 74Q96 79 91 76L77 57Z" />
      <path d="M44 41L55 16Q59 14 61 20L64 43Z" />
      <path d="M40 60L49 78Q53 81 55 76L54 61Z" />
      <path d="M4 52Q20 36 50 38Q72 40 84 50Q72 62 50 64Q22 66 4 52Z" />
      <path d="M30 45Q28 52 30 58M35 45Q33 52 35 59M40 45Q38 52 40 59" {...pen.detail(3)} />
      <circle cx={18} cy={47} r={2.5} {...pen.hole} />
    </>
  ),
  octopus: (pen) => (
    <>
      {[0, 1].map((side) => (
        <g key={side} transform={side ? MIRROR : undefined}>
          <path d="M30 52Q12 58 9 74Q7 86 16 88Q23 88 22 81Q16 80 17 73Q19 64 36 60Z" />
          <path d="M38 56Q28 70 29 83Q30 93 39 92Q45 90 42 85Q36 85 37 78Q38 68 46 60Z" />
        </g>
      ))}
      <ellipse cx={50} cy={34} rx={27} ry={28} />
      <circle cx={40} cy={36} r={5.5} {...pen.hole} />
      <circle cx={60} cy={36} r={5.5} {...pen.hole} />
      <circle cx={41} cy={37} r={2.5} {...pen.front(3)} />
      <circle cx={59} cy={37} r={2.5} {...pen.front(3)} />
    </>
  ),
  jellyfish: (pen) => (
    <>
      <path d="M30 56Q24 66 30 76Q36 86 30 94M43 58Q40 70 45 80Q49 88 45 94M57 58Q60 70 55 80Q51 88 55 94M70 56Q76 66 70 76Q64 86 70 94" {...line(4)} />
      <path d="M12 50Q12 12 50 12Q88 12 88 50Q82 57 75 51Q69 57 63 51Q57 57 50 51Q43 57 37 51Q31 57 25 51Q18 57 12 50Z" />
      <path d="M26 38Q28 26 40 22" {...pen.detail(4.5)} />
    </>
  ),
  crab: (pen) => (
    <>
      <path d="M30 62L14 66L8 78M31 69L18 77L14 89M36 74L28 85L26 95M70 62L86 66L92 78M69 69L82 77L86 89M64 74L72 85L74 95" {...line(5)} />
      <path d="M32 52L22 36M68 52L78 36" {...line(6)} />
      {[0, 1].map((side) => (
        <path key={side} d="M22 42Q8 40 9 26Q9 14 14 5Q19 14 20 21Q24 12 33 9Q32 24 29 32Q28 41 22 42Z" transform={side ? MIRROR : undefined} />
      ))}
      <path d="M42 46V34M58 46V34" {...line(4)} />
      <circle cx={42} cy={32} r={4.5} />
      <circle cx={58} cy={32} r={4.5} />
      <ellipse cx={50} cy={60} rx={27} ry={18} />
      <path d="M38 66Q50 72 62 66" {...pen.detail(4)} />
    </>
  ),
  butterfly: (pen) => (
    <>
      <path d="M48 32Q44 18 36 12M52 32Q56 18 64 12" {...line(3)} />
      <circle cx={36} cy={12} r={3.5} />
      <circle cx={64} cy={12} r={3.5} />
      {[0, 1].map((side) => (
        <g key={side} transform={side ? MIRROR : undefined}>
          <path d="M47 46Q30 14 12 16Q4 18 6 30Q8 46 46 52Z" />
          <path d="M46 52Q16 56 18 76Q22 88 34 84Q44 78 48 60Z" {...pen.front(5)} />
          <circle cx={22} cy={30} r={5} {...pen.hole} />
          <circle cx={30} cy={72} r={4} {...pen.hole} />
        </g>
      ))}
      <ellipse cx={50} cy={54} rx={4.5} ry={22} {...pen.front(4)} />
    </>
  ),
  ant: (pen) => (
    <>
      <path d="M42 54L32 66L24 82M47 56L46 70L40 88M52 54L62 66L70 84" {...line(4)} />
      <path d="M18 38L14 22L4 18" {...line(3.5)} />
      <ellipse cx={74} cy={54} rx={20} ry={14} transform={turn(10, 74, 54)} />
      <circle cx={57} cy={52} r={5} />
      <ellipse cx={44} cy={50} rx={11} ry={7.5} transform={turn(-10, 44, 50)} />
      <circle cx={22} cy={46} r={11} />
      <circle cx={19} cy={44} r={2.5} {...pen.hole} />
    </>
  ),
  spider: (pen) => (
    <>
      <path d="M50 4V30" {...line(3)} />
      <path d="M42 40L24 28L18 10M40 46L18 42L6 32M40 54L18 60L6 72M42 60L26 74L20 92M58 40L76 28L82 10M60 46L82 42L94 32M60 54L82 60L94 72M58 60L74 74L80 92" {...line(4.5)} />
      <circle cx={50} cy={44} r={12} />
      <ellipse cx={50} cy={68} rx={15} ry={18} {...pen.front(5)} />
      <circle cx={46} cy={40} r={2.2} {...pen.hole} />
      <circle cx={54} cy={40} r={2.2} {...pen.hole} />
    </>
  ),
  beetle: (pen) => (
    <>
      <path d="M36 46L20 40L14 28M34 58L16 60L8 70M36 70L22 80L18 92M64 46L80 40L86 28M66 58L84 60L92 70M64 70L78 80L82 92" {...line(5)} />
      <path d="M45 16Q40 8 32 6M55 16Q60 8 68 6" {...line(3.5)} />
      <ellipse cx={50} cy={22} rx={10} ry={8} />
      <ellipse cx={50} cy={35} rx={17} ry={9} {...pen.front(5)} />
      <path d="M50 42Q76 42 75 66Q74 88 50 93Q26 88 25 66Q24 42 50 42Z" {...pen.front(5)} />
      <path d="M50 44V91" {...pen.detail(4)} />
    </>
  ),
  mosquito: (pen) => (
    <>
      <path d="M42 54L30 70L22 94M48 56L46 76L44 94M54 54L68 70L80 92M60 52L80 50L96 36" {...line(3)} />
      <path d="M26 50L6 72" {...line(3)} />
      <ellipse cx={74} cy={58} rx={19} ry={6.5} transform={turn(22, 74, 58)} />
      <ellipse cx={46} cy={48} rx={11} ry={8} />
      <circle cx={30} cy={46} r={7} />
      <ellipse cx={58} cy={26} rx={21} ry={7} transform={turn(-38, 58, 26)} {...pen.front(5)} />
      <ellipse cx={66} cy={32} rx={19} ry={6} transform={turn(-18, 66, 32)} {...pen.front(5)} />
      <circle cx={28} cy={45} r={2} {...pen.hole} />
    </>
  ),
  owl: (pen) => (
    <>
      <path d="M22 30L18 8L36 20Q50 14 64 20L82 8L78 30Q90 52 82 74Q72 92 50 92Q28 92 18 74Q10 52 22 30Z" />
      <circle cx={36} cy={40} r={12} {...pen.hole} />
      <circle cx={64} cy={40} r={12} {...pen.hole} />
      <circle cx={36} cy={41} r={5} {...pen.front(3)} />
      <circle cx={64} cy={41} r={5} {...pen.front(3)} />
      <path d="M45 53H55L50 62Z" {...pen.hole} />
      <path d="M24 58Q26 78 40 86M76 58Q74 78 60 86" {...pen.detail(4)} />
      <path d="M44 72L50 76L56 72" {...pen.detail(3)} />
    </>
  ),
  // An eagle soaring overhead, seen from below as it banks.
  eagle: (pen) => (
    <g transform={`${move(0, -5)} ${turn(-12)}`}>
      {[0, 1].map((side) => (
        <path key={side} d="M44 40Q28 32 14 33L4 37L12 41L3 45L12 48L5 52L15 54Q30 58 44 58Z" transform={side ? MIRROR : undefined} />
      ))}
      <path d="M42 66L35 88Q50 95 65 88L58 66Z" />
      <ellipse cx={50} cy={50} rx={10} ry={22} />
      <circle cx={50} cy={28} r={7} />
      <path d="M47.5 22.5Q50 14 52.5 22.5Z" />
      <path d="M43 35Q50 38.5 57 35" {...pen.detail(3.5)} />
    </g>
  ),
  penguin: (pen) => (
    <g transform={move(9, 0)}>
      <ellipse cx={42} cy={93} rx={9} ry={3.5} />
      <ellipse cx={58} cy={93} rx={9} ry={3.5} />
      <path d="M26 24L10 30L26 33Z" />
      <path d="M30 14Q46 4 56 18Q72 42 70 72Q68 92 50 92Q30 92 28 72Q24 50 30 34Q26 24 30 14Z" />
      <path d="M36 38Q30 56 34 76Q38 86 48 86Q58 84 58 70Q56 52 44 36Z" {...pen.hole} />
      <path d="M60 42Q70 58 66 74" {...pen.detail(4.5)} />
      <circle cx={36} cy={22} r={2.6} {...pen.hole} />
    </g>
  ),
  elephant: (pen) => (
    <g transform={move(0, -5)}>
      <path d="M90 42Q96 50 94 60" {...line(3.5)} />
      <path d="M30 30Q60 22 82 32Q92 40 90 58V92H78L76 70H50L48 92H36L34 64Q26 60 26 46Z" />
      <circle cx={28} cy={40} r={18} />
      <path d="M12 42Q8 60 10 76Q12 88 20 88Q24 86 22 82Q18 80 18 72Q18 60 26 52Z" />
      <path d="M32 24Q52 20 54 40Q54 58 42 62Q34 62 32 52Z" {...pen.front(5)} />
      <path d="M20 54Q22 64 30 64Q26 60 26 54Z" {...pen.hole} />
      <circle cx={20} cy={36} r={2.6} {...pen.hole} />
    </g>
  ),
  lion: (pen) => (
    <>
      <path d="M84 46Q96 50 94 64" {...line(4)} />
      <circle cx={94} cy={67} r={5} />
      <path d="M36 44Q60 38 82 44Q90 50 86 62L84 92H74L72 66H46L44 92H34L32 62Z" />
      <circle cx={32} cy={40} r={20} />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
        <circle key={a} cx={50} cy={40} r={8} transform={`${turn(a, 32, 40)}`} />
      ))}
      <path d="M6 46Q4 38 12 34Q20 28 30 32Q36 40 34 50Q30 58 20 58L12 56Q6 54 6 46Z" {...pen.front(5)} />
      <circle cx={17} cy={39} r={2.6} {...pen.hole} />
    </>
  ),
  // A monkey's face, framed by its ears.
  monkey: (pen) => (
    <>
      <circle cx={16} cy={50} r={12} />
      <circle cx={84} cy={50} r={12} />
      <circle cx={16} cy={50} r={5.5} {...pen.hole} />
      <circle cx={84} cy={50} r={5.5} {...pen.hole} />
      <circle cx={50} cy={48} r={34} {...pen.front(6)} />
      <path d="M50 34Q58 26 66 30Q76 36 72 50Q74 58 70 66Q64 82 50 82Q36 82 30 66Q26 58 28 50Q24 36 34 30Q42 26 50 34Z" {...pen.hole} />
      <circle cx={41} cy={45} r={4.5} {...pen.front(3)} />
      <circle cx={59} cy={45} r={4.5} {...pen.front(3)} />
      <path d="M46 59V60M54 59V60" {...line(4)} />
      <path d="M42 68Q50 73 58 68" {...line(3.5)} />
    </>
  ),
  // A long-necked dinosaur, side view, facing left.
  dinosaur: (pen) => (
    <>
      <rect x={46} y={64} width={10} height={26} rx={3} />
      <rect x={60} y={64} width={10} height={26} rx={3} />
      <path d="M36 92L34 68Q22 62 20 50L12 22Q6 22 4 18Q4 10 14 10Q20 10 22 16L32 42Q44 30 62 30Q82 32 88 48L96 72Q88 66 80 62V92H70V70H46V92Z" />
      <path d="M46 76V90M70 76V90" {...pen.detail(3.5)} />
      <circle cx={12} cy={14} r={2} {...pen.hole} />
    </>
  ),

  // Plants and landscapes
  grass: () => (
    <>
      <path d="M20 92Q18 76 6 66Q24 72 28 92Z" />
      <path d="M30 92Q26 62 10 42Q34 58 40 92Z" />
      <path d="M38 92Q40 52 32 14Q52 46 50 92Z" />
      <path d="M48 92Q54 52 70 22Q64 58 60 92Z" />
      <path d="M58 92Q68 66 90 50Q72 70 68 92Z" />
      <rect x={6} y={88} width={88} height={6} rx={3} />
    </>
  ),
  flower: (pen) => (
    <>
      <path d="M50 94V50" {...line(6)} />
      <path d="M50 82Q30 82 24 66Q42 64 50 78Z" />
      <path d="M50 74Q70 74 76 58Q58 56 50 70Z" />
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <ellipse key={a} cx={50} cy={19} rx={9} ry={13} transform={turn(a, 50, 34)} />
      ))}
      <circle cx={50} cy={34} r={10} {...pen.front(5)} />
    </>
  ),
  cactus: (pen) => (
    <>
      <path d="M38 60H26Q18 60 18 52V36Q18 30 24 30Q30 30 30 36V48H38Z" />
      <path d="M62 50H72V26Q72 20 78 20Q84 20 84 26V50Q84 62 72 62H62Z" />
      <rect x={38} y={10} width={24} height={82} rx={12} />
      <path d="M50 20V86" {...pen.detail(4)} />
      <rect x={20} y={88} width={60} height={6} rx={3} />
    </>
  ),
  mushroom: (pen) => (
    <>
      <path d="M8 52Q10 14 50 12Q90 14 92 52Q92 57 86 57H14Q8 57 8 52Z" />
      <path d="M37 57Q35 76 31 89Q30 94 36 94H64Q70 94 69 89Q65 76 63 57Z" {...pen.front(6)} />
      <circle cx={30} cy={36} r={6} {...pen.hole} />
      <circle cx={55} cy={25} r={5} {...pen.hole} />
      <circle cx={72} cy={41} r={6} {...pen.hole} />
      <circle cx={48} cy={45} r={4} {...pen.hole} />
    </>
  ),
  // Two striped seeds, like sunflower seeds.
  seed: (pen) => (
    <g transform={move(-5, 0)}>
      <g transform={turn(-20, 44, 50)}>
        <path d="M44 10Q66 36 64 62Q62 88 44 88Q26 88 24 62Q22 36 44 10Z" />
        <path d="M37 30Q31 56 37 80M51 30Q57 56 51 80" {...pen.detail(3.5)} />
      </g>
      <g transform={turn(25, 76, 66)}>
        <path d="M76 46Q88 60 87 72Q86 86 76 86Q66 86 65 72Q64 60 76 46Z" {...pen.front(6)} />
        <path d="M71.5 60Q69 71 71.5 80M80.5 60Q83 71 80.5 80" {...pen.detail(3)} />
      </g>
    </g>
  ),
  apple: (pen) => (
    <>
      <path d="M50 28Q50 16 56 8" {...line(5)} />
      <path d="M54 18Q60 4 78 6Q72 20 54 18Z" />
      <path d="M50 28Q38 20 26 24Q8 32 10 56Q12 82 30 92Q40 96 50 90Q60 96 70 92Q88 82 90 56Q92 32 74 24Q62 20 50 28Z" />
      <path d="M24 46Q24 36 32 32" {...pen.detail(5)} />
    </>
  ),
  forest: (pen) => (
    <>
      <path d={pine(26, 35, 0.9)} />
      <rect x={23.5} y={84} width={5} height={10} />
      <path d={pine(74, 35, 0.9)} />
      <rect x={71.5} y={84} width={5} height={10} />
      <path d={pine(50, 15, 1.2)} {...pen.front()} />
      <rect x={46.5} y={80} width={7} height={14} {...pen.front()} />
    </>
  ),
  island: () => (
    <>
      <path d="M10 86Q18 81 26 86T42 86T58 86T74 86T90 86" {...line(4.5)} />
      <path d="M18 94Q26 89 34 94T50 94T66 94T82 94" {...line(4.5)} />
      <path d="M14 80Q50 58 86 80Z" />
      <path d="M47 72Q44 50 55 28L60 30Q51 52 54 72Z" />
      <path d="M58 26Q42 18 26 32Q40 26 56 32Z" />
      <path d="M58 26Q46 8 32 9Q48 16 56 29Z" />
      <path d="M58 26Q70 6 86 10Q70 16 60 29Z" />
      <path d="M58 26Q76 18 90 34Q74 28 60 32Z" />
    </>
  ),
  // A river winding down from the mountains, wider as it comes closer.
  river: (pen) => (
    <>
      <path d="M6 44L24 22L34 32L50 10L68 34L80 24L94 44Z" />
      <path d="M47 50C45.5 51.5 38 56.5 37 60C36 63.5 40.5 66.5 42.5 70C44.5 73.5 52 76 50 80C48 84 34 91.5 31 94H61C62.5 91.5 70.5 84 70 80C69.5 76 61.5 73.5 57.5 70C53.5 66.5 48 63.5 47 60C46 56.5 52 51.5 53 50Z" {...pen.front()} />
      <path d="M46 85Q51 82 56 85M44 64Q46.5 62 49 64" {...pen.detail(3)} />
    </>
  ),
  // A lake below the mountains, with ripples.
  lake: (pen) => (
    <>
      <path d="M10 54L32 24L44 38L60 16L90 54Z" />
      <path d="M4 75Q4 60 24 60H76Q96 60 96 75Q96 90 76 90H24Q4 90 4 75Z" {...pen.front()} />
      <path d="M18 70H40M52 70H62M30 80H54M66 80H82" {...pen.detail(4)} />
    </>
  ),
  desert: (pen) => (
    <>
      <circle cx={74} cy={24} r={11} />
      <path d="M4 64Q30 40 60 58Q76 50 96 56V82H4Z" />
      <path d="M4 80Q44 58 96 82V94H4Z" {...pen.front()} />
      <g {...pen.front(5)}>
        <path d="M18 74V44Q18 39.5 22.5 39.5Q27 39.5 27 44V74Z" />
        <path d="M18 62H14Q10 62 10 58V51Q10 48 13 48Q16 48 16 51V56H18ZM27 56H31V47Q31 44 34 44Q37 44 37 47V54Q37 60 31 60H27Z" />
      </g>
    </>
  ),
  iceberg: (pen) => (
    <>
      <path d="M30 40L42 14L50 22L60 6L74 40Z" />
      <path d="M42 14L46 40M60 6L58 40" {...pen.detail(3.5)} />
      <path d="M6 46Q13.5 42 21 46T36 46T51 46T66 46T81 46T96 46" {...line(4)} />
      <path d="M16 52H86L92 70L80 90L52 96L26 90L10 72Z" {...pen.front()} />
      <path d="M36 52L44 74L30 90M66 52L60 76L72 90" {...pen.detail(3.5)} />
    </>
  ),
  soil: (pen) => (
    <>
      <path d="M50 36V22" {...line(5)} />
      <path d="M50 26Q36 26 32 14Q46 12 50 24Z" />
      <path d="M50 22Q60 10 72 12Q70 24 52 26Z" />
      <rect x={6} y={36} width={88} height={56} rx={6} />
      <path d="M6 56Q28 50 50 56T94 56M6 76Q28 70 50 76T94 76" {...pen.detail(4)} />
      <circle cx={22} cy={66} r={4} {...pen.hole} />
      <circle cx={70} cy={64} r={3.5} {...pen.hole} />
      <ellipse cx={40} cy={86} rx={5} ry={3} {...pen.hole} />
      <circle cx={82} cy={85} r={3} {...pen.hole} />
      <path d="M50 38V50M50 44L43 50M50 46L57 52" {...pen.detail(3)} />
    </>
  ),
  cave: (pen) => (
    <g transform={move(0, -6)}>
      <path d="M4 92L10 62L22 40L38 28L54 24L70 30L84 46L92 66L96 92Z" />
      <path d="M28 92V66Q30 56 40 54L42 62L46 54L52 64L56 54L60 60L64 55Q70 58 72 66V92Z" {...pen.hole} />
      <path d="M38 28L44 42M70 30L64 44M22 40L26 50M84 46L78 54" {...pen.detail(3.5)} />
    </g>
  ),
  rainbow: (pen) => (
    <g transform={move(0, -9)}>
      <path d="M6 72A44 44 0 0 1 94 72H85A35 35 0 0 0 15 72Z" />
      <path d="M19 72A31 31 0 0 1 81 72H72A22 22 0 0 0 28 72Z" />
      <path d="M32 72A18 18 0 0 1 68 72H60A10 10 0 0 0 40 72Z" />
      {[0, 1].map((side) => (
        <path key={side} d="M8 90A8 8 0 0 1 10 74A11 11 0 0 1 31 72A9 9 0 0 1 34 90Z" transform={side ? MIRROR : undefined} {...pen.front()} />
      ))}
    </g>
  ),
  tornado: () => (
    <>
      <rect x={6} y={8} width={86} height={10} rx={5} />
      <rect x={16} y={23} width={72} height={10} rx={5} />
      <rect x={22} y={38} width={56} height={9} rx={4.5} />
      <rect x={32} y={52} width={40} height={9} rx={4.5} />
      <rect x={38} y={66} width={28} height={8} rx={4} />
      <rect x={44} y={79} width={18} height={7} rx={3.5} />
      <rect x={46} y={90} width={8} height={5} rx={2.5} />
    </>
  ),
  ocean: () => (
    <>
      {[16, 42, 68].map((y) => (
        <path key={y} d={waveBand(y)} />
      ))}
    </>
  ),
  // Branching coral on the sea floor.
  coral: () => (
    <>
      <ellipse cx={50} cy={91} rx={22} ry={4.5} />
      {[
        [50, 92, 50, 68, 12],
        [50, 70, 32, 50, 10],
        [50, 70, 68, 48, 10],
        [32, 52, 20, 32, 8],
        [32, 52, 40, 26, 8],
        [20, 34, 10, 22, 7],
        [20, 34, 22, 13, 7],
        [68, 50, 60, 25, 8],
        [68, 50, 84, 32, 8],
        [84, 34, 91, 18, 7],
        [84, 34, 76, 14, 7],
      ].map(([x1, y1, x2, y2, w]) => stick(x1, y1, x2, y2, w))}
      {[
        [10, 22],
        [22, 13],
        [40, 26],
        [60, 25],
        [91, 18],
        [76, 14],
      ].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={5.5} />
      ))}
    </>
  ),
  // An ammonite, a spiral shell, set in stone.
  fossil: (pen) => (
    <>
      <path d="M14 30L34 10L72 8L92 30L90 72L66 92L26 90L8 66Z" />
      <circle cx={50} cy={50} r={33} {...pen.hole} />
      <path d="M50 50A5 5 0 0 1 60 50A10 10 0 0 1 40 50A15 15 0 0 1 70 50A20 20 0 0 1 30 50A25 25 0 0 1 80 50A30 30 0 0 1 20 50" {...line(4)} />
      <path d={rays(55, 50, 16.5, 23.5, [200, 225, 250, 275, 300, 325]) + rays(50, 50, 21.5, 28.5, [20, 45, 70, 95, 120, 145, 170])} {...line(3)} />
    </>
  ),
  crystal: (pen) => (
    <>
      <g transform={turn(-14, 25, 94)}>
        <path d="M14 94V44L25 28L36 44V94Z" />
        <path d="M14 44L25 50L36 44M25 50V94" {...pen.detail(3)} />
      </g>
      <g transform={turn(18, 75, 94)}>
        <path d="M66 94V58L75 46L84 58V94Z" />
        <path d="M66 58L75 63L84 58M75 63V94" {...pen.detail(3)} />
      </g>
      <path d="M38 94V30L52 6L66 30V94Z" {...pen.front()} />
      <path d="M38 30L52 38L66 30M52 38V94" {...pen.detail(3.5)} />
      <path d="M4 94Q10 84 26 86Q40 80 54 86Q70 82 82 86Q94 86 96 94Z" {...pen.front()} />
    </>
  ),

  // Body and health
  eye: (pen) => (
    <>
      <path d="M4 50Q50 2 96 50Q50 98 4 50Z" />
      <circle cx={50} cy={50} r={21} {...pen.hole} />
      <circle cx={50} cy={50} r={14} {...pen.front(4)} />
      <circle cx={50} cy={50} r={6} {...pen.hole} />
    </>
  ),
  ear: (pen) => (
    <g transform={move(-6, 0)}>
      <path d="M28 38Q28 8 56 8Q84 8 84 38Q84 56 70 68Q62 76 62 86Q60 96 48 94Q36 92 38 80Q40 72 34 66Q28 58 28 38Z" />
      <path d="M42 40Q42 22 58 22Q72 22 72 38Q72 50 62 56Q54 62 54 72" {...pen.detail(5)} />
      <path d="M50 42Q52 34 58 36Q63 38 60 46" {...pen.detail(4)} />
    </g>
  ),
  nose: (pen) => (
    <>
      <path d="M44 8Q42 40 32 58Q20 64 20 74Q20 86 32 86Q38 86 42 82Q46 88 50 88Q54 88 58 82Q62 86 68 86Q80 86 80 74Q80 64 68 58Q58 40 56 8Z" />
      <ellipse cx={38} cy={78} rx={5.5} ry={3.2} transform={turn(20, 38, 78)} {...pen.hole} />
      <ellipse cx={62} cy={78} rx={5.5} ry={3.2} transform={turn(-20, 62, 78)} {...pen.hole} />
      <path d="M30 64Q26 70 30 76M70 64Q74 70 70 76" {...pen.detail(3.5)} />
    </>
  ),
  tooth: (pen) => (
    <>
      <path d="M22 20Q22 8 36 8Q44 8 50 14Q56 8 64 8Q78 8 78 20Q80 40 72 54Q68 62 66 78Q64 92 58 92Q52 92 52 80Q52 68 50 66Q48 68 48 80Q48 92 42 92Q36 92 34 78Q32 62 28 54Q20 40 22 20Z" />
      <path d="M32 22Q32 16 38 16" {...pen.detail(4)} />
    </>
  ),
  hand: (pen) => (
    <g transform={move(8, 0)}>
      <rect x={24} y={44} width={12} height={38} rx={6} transform={turn(-35, 30, 76)} />
      <rect x={26} y={16} width={12} height={46} rx={6} />
      <rect x={38} y={8} width={12} height={52} rx={6} />
      <rect x={50} y={12} width={12} height={48} rx={6} />
      <rect x={62} y={22} width={11} height={40} rx={5.5} />
      <path d="M26 48H73V70Q73 94 50 94Q26 94 26 70Z" />
      <path d="M38 22V50M50 18V50M62 28V50" {...pen.detail(3)} />
    </g>
  ),
  stomach: (pen) => (
    <g transform={move(0, 5)}>
      <rect x={46} y={2} width={10} height={22} rx={3} />
      <path d="M46 20Q44 44 36 54Q30 60 22 60H12Q6 60 6 68V88H18V74Q20 70 26 72Q44 92 66 86Q90 76 88 46Q86 22 68 16Q60 14 56 20Z" />
      <path d="M50 42Q54 62 76 60" {...pen.detail(4)} />
    </g>
  ),
  intestine: (pen) => (
    <>
      <path d="M14 94V26Q14 12 28 12H72Q86 12 86 26V76H72V30Q72 26 68 26H32Q28 26 28 30V94Z" />
      <path d="M14 42H28M14 60H28M14 78H28M44 12V26M58 12V26M72 42H86M72 60H86" {...pen.detail(3)} />
      <path d="M38 38H62Q66 38 66 44Q66 50 60 50H40Q34 50 34 56Q34 62 40 62H60Q66 62 66 68Q66 74 60 74H44" {...line(6)} />
    </>
  ),
  kidney: (pen) => (
    <>
      <rect x={18} y={40} width={26} height={8} rx={4} />
      <rect x={18} y={54} width={26} height={8} rx={4} />
      <path d="M40 60Q32 74 36 94" {...line(7)} />
      <path d="M60 8Q90 8 90 46Q90 84 60 88Q42 90 38 74Q36 64 44 58Q50 52 44 44Q36 36 40 24Q44 10 60 8Z" />
      <path d="M50 48Q62 40 72 30M50 52H74M50 56Q62 64 72 72" {...pen.detail(3.5)} />
    </>
  ),
  liver: (pen) => (
    <g transform={move(0, -5)}>
      <path d="M6 38Q8 24 28 22Q58 18 90 28Q98 32 92 40Q80 52 62 64Q46 76 34 78Q18 78 10 66Q4 54 6 38Z" />
      <path d="M58 22Q56 42 46 68" {...pen.detail(4)} />
      <ellipse cx={30} cy={82} rx={7} ry={10} transform={turn(-20, 30, 82)} {...pen.front(5)} />
    </g>
  ),
  blood: (pen) => (
    <>
      <path d="M80 48Q91 62 91 71A11 11 0 0 1 69 71Q69 62 80 48Z" />
      <path d="M42 6Q70 42 70 62A28 28 0 0 1 14 62Q14 42 42 6Z" {...pen.front()} />
      <path d="M27 62Q27 72 36 77" {...pen.detail(5)} />
    </>
  ),
  // A flexed arm.
  muscle: (pen) => (
    <>
      <path d="M4 92V70Q8 63 17 62Q20 40 38 39Q53 39 55 58Q56 48 58 38L52 36Q45 32 46 20Q48 8 62 6L74 5Q86 5 86 17Q86 28 81 34Q86 52 91 74Q93 92 77 92Z" />
      <path d="M50 19H63M51 27H64" {...pen.detail(3.5)} />
      <path d="M22 66Q36 72 50 62" {...pen.detail(4)} />
    </>
  ),
  skull: (pen) => (
    <>
      <path d="M50 6Q86 6 88 42Q88 58 78 64V78Q78 84 72 84H66V92H34V84H28Q22 84 22 78V64Q12 58 12 42Q14 6 50 6Z" />
      <ellipse cx={35} cy={46} rx={10} ry={11} {...pen.hole} />
      <ellipse cx={65} cy={46} rx={10} ry={11} {...pen.hole} />
      <path d="M50 58L44 70H56Z" {...pen.hole} />
      <path d="M42 78V92M50 78V92M58 78V92" {...pen.detail(3.5)} />
    </>
  ),
  neuron: (pen) => (
    <>
      <path d="M26 30L14 16M18 20L8 22M34 26L36 8M20 44L6 46M28 54L20 68M24 60L12 62" {...line(5)} />
      <path d="M44 48Q60 60 78 80" {...line(6)} />
      <rect x={52} y={52} width={10} height={14} rx={5} transform={turn(-48, 57, 59)} {...pen.front(4)} />
      <rect x={62.4} y={61.7} width={10} height={14} rx={5} transform={turn(-45, 67.4, 68.7)} {...pen.front(4)} />
      <path d="M78 80L91 82M78 80L84 92M78 80L90 70" {...line(4)} />
      <circle cx={92} cy={82} r={3.5} />
      <circle cx={85} cy={93} r={3.5} />
      <circle cx={91} cy={69} r={3.5} />
      <circle cx={32} cy={40} r={14} />
      <circle cx={32} cy={40} r={5} {...pen.hole} />
    </>
  ),
  bandage: (pen) => (
    <g transform={turn(-45)}>
      <rect x={4} y={33} width={92} height={34} rx={17} />
      <path d="M34 33V67M66 33V67" {...pen.detail(4)} />
      {[
        [42, 43],
        [50, 43],
        [58, 43],
        [42, 57],
        [50, 57],
        [58, 57],
      ].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={2.6} {...pen.hole} />
      ))}
    </g>
  ),
  stethoscope: (pen) => (
    <g transform={move(-6, 0)}>
      <path d="M28 12V32Q28 54 46 54Q64 54 64 32V12" {...line(6)} />
      <path d="M46 54V70Q46 90 64 90Q80 90 80 74V66" {...line(6)} />
      <rect x={22} y={6} width={12} height={8} rx={4} />
      <rect x={58} y={6} width={12} height={8} rx={4} />
      <circle cx={80} cy={56} r={12} />
      <circle cx={80} cy={56} r={5} {...pen.hole} />
    </g>
  ),
  // A hospital marked with an H: a red cross is a protected emblem.
  hospital: (pen) => (
    <>
      <rect x={6} y={46} width={18} height={48} />
      <rect x={76} y={46} width={18} height={48} />
      <rect x={20} y={14} width={60} height={80} {...pen.front()} />
      <path d="M38 24H46V34H54V24H62V52H54V42H46V52H38Z" {...pen.hole} />
      <rect x={42} y={72} width={16} height={22} rx={2} {...pen.hole} />
      <rect x={11} y={58} width={8} height={10} rx={1.5} {...pen.hole} />
      <rect x={81} y={58} width={8} height={10} rx={1.5} {...pen.hole} />
    </>
  ),
  mask: (pen) => (
    <>
      <path d="M14 36Q2 40 4 52Q6 64 18 62M86 36Q98 40 96 52Q94 64 82 62" {...line(5)} />
      <path d="M14 32Q50 20 86 32L84 64Q50 86 16 64Z" />
      <path d="M18 44Q50 34 82 44M18 54Q50 46 82 54" {...pen.detail(4)} />
    </>
  ),
  antibody: (pen) => (
    <g transform={move(0, -3)}>
      <rect x={44} y={48} width={12} height={46} rx={6} />
      <rect x={44} y={6} width={12} height={48} rx={6} transform={turn(-40, 50, 52)} />
      <rect x={44} y={6} width={12} height={48} rx={6} transform={turn(40, 50, 52)} />
      <rect x={33} y={12} width={8} height={26} rx={4} transform={turn(-40, 50, 52)} {...pen.front(4)} />
      <rect x={59} y={12} width={8} height={26} rx={4} transform={turn(40, 50, 52)} {...pen.front(4)} />
    </g>
  ),

  // Technology and AI
  chip: (pen) => (
    <>
      {[29.5, 41.5, 53.5, 65.5].map((v) => (
        <g key={v}>
          <rect x={v} y={6} width={5} height={16} rx={2} />
          <rect x={v} y={78} width={5} height={16} rx={2} />
          <rect x={6} y={v} width={16} height={5} rx={2} />
          <rect x={78} y={v} width={16} height={5} rx={2} />
        </g>
      ))}
      <rect x={18} y={18} width={64} height={64} rx={7} />
      <rect x={33} y={33} width={34} height={34} rx={3} {...pen.detail(4)} />
      <circle cx={27} cy={27} r={3} {...pen.hole} />
    </>
  ),
  gpu: (pen) => (
    <>
      <rect x={4} y={20} width={8} height={60} rx={2} />
      <rect x={24} y={68} width={44} height={12} rx={2} />
      <path d="M31 72V80M39 72V80M47 72V80M55 72V80M63 72V80" {...pen.detail(3)} />
      <rect x={10} y={24} width={86} height={48} rx={5} />
      <circle cx={34} cy={48} r={16} {...pen.hole} />
      <circle cx={72} cy={48} r={16} {...pen.hole} />
      <path d={swirl(34, 48, 5, 13, [0, 120, 240]) + swirl(72, 48, 5, 13, [0, 120, 240])} {...line(3.5)} />
      <circle cx={34} cy={48} r={4.5} {...pen.front(3)} />
      <circle cx={72} cy={48} r={4.5} {...pen.front(3)} />
    </>
  ),
  server: (pen) => (
    <>
      {[8, 38, 68].map((y) => (
        <g key={y}>
          <rect x={10} y={y} width={80} height={24} rx={4} />
          <path d={`M20 ${y + 12}H48`} {...pen.detail(4)} />
          <circle cx={70} cy={y + 12} r={3.5} {...pen.hole} />
          <circle cx={80} cy={y + 12} r={3.5} {...pen.hole} />
        </g>
      ))}
    </>
  ),
  database: (pen) => (
    <>
      <path d="M14 22V78Q14 92 50 92Q86 92 86 78V22Z" />
      <path d="M14 42Q14 54 50 54Q86 54 86 42M14 62Q14 74 50 74Q86 74 86 62" {...pen.detail(4)} />
      <ellipse cx={50} cy={22} rx={36} ry={13} {...pen.front()} />
    </>
  ),
  wifi: () => (
    <>
      <path d="M11.8 37.8A54 54 0 0 1 88.2 37.8M24.5 50.5A36 36 0 0 1 75.5 50.5M37.3 63.3A18 18 0 0 1 62.7 63.3" {...line(9)} />
      <circle cx={50} cy={76} r={7.5} />
    </>
  ),
  network: (pen) => (
    <>
      <path d="M50 50V16M50 50L16 42M50 50L84 42M50 50L28 82M50 50L72 82M50 16L84 42L72 82H28L16 42Z" {...line(5)} />
      <circle cx={50} cy={50} r={11} {...pen.front(5)} />
      {[
        [50, 16],
        [16, 42],
        [84, 42],
        [28, 82],
        [72, 82],
      ].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={8.5} {...pen.front(5)} />
      ))}
    </>
  ),
  robot: (pen) => (
    <>
      <path d="M50 18V9" {...line(4)} />
      <circle cx={50} cy={8} r={5} />
      <rect x={12} y={30} width={10} height={18} rx={3} />
      <rect x={78} y={30} width={10} height={18} rx={3} />
      <rect x={20} y={18} width={60} height={44} rx={10} />
      <circle cx={37} cy={38} r={7} {...pen.hole} />
      <circle cx={63} cy={38} r={7} {...pen.hole} />
      <rect x={38} y={50} width={24} height={5} rx={2.5} {...pen.hole} />
      <rect x={44} y={60} width={12} height={10} />
      <path d="M22 94V78Q22 68 32 68H68Q78 68 78 78V94Z" />
      <circle cx={50} cy={81} r={5} {...pen.hole} />
    </>
  ),
  code: () => <path d="M30 26L8 50L30 74M70 26L92 50L70 74M58 16L42 84" {...line(10)} />,
  laptop: (pen) => (
    <>
      <rect x={16} y={14} width={68} height={48} rx={5} />
      <rect x={22} y={20} width={56} height={36} rx={2} {...pen.hole} />
      <path d="M4 68H96L90 82Q88 86 84 86H16Q12 86 10 82Z" />
      <rect x={40} y={68} width={20} height={4} rx={2} {...pen.hole} />
    </>
  ),
  camera: (pen) => (
    <>
      <path d="M32 27L37 15H63L68 27Z" />
      <rect x={14} y={20} width={12} height={9} rx={2} />
      <rect x={6} y={25} width={88} height={60} rx={8} />
      <circle cx={50} cy={55} r={20} {...pen.hole} />
      <circle cx={50} cy={55} r={12} {...pen.front(4)} />
      <rect x={74} y={33} width={12} height={7} rx={2} {...pen.hole} />
    </>
  ),
  battery: (pen) => (
    <>
      <rect x={86} y={40} width={9} height={20} rx={3} />
      <rect x={5} y={26} width={83} height={48} rx={8} />
      <rect x={12} y={33} width={69} height={34} rx={3} {...pen.hole} />
      {[17, 33, 49].map((x) => (
        <rect key={x} x={x} y={38} width={12} height={24} rx={2} {...pen.front(3)} />
      ))}
    </>
  ),
  plug: (pen) => (
    <>
      <rect x={34} y={4} width={8} height={22} rx={3} />
      <rect x={58} y={4} width={8} height={22} rx={3} />
      <rect x={45} y={64} width={10} height={32} rx={5} />
      <path d="M22 24H78V46Q78 68 56 70H44Q22 68 22 46Z" />
      <path d="M32 36H68" {...pen.detail(4)} />
    </>
  ),
  solarpanel: (pen) => (
    <>
      <rect x={40} y={60} width={8} height={26} />
      <rect x={24} y={84} width={40} height={9} rx={3} />
      <path d="M18 14H90L80 62H6Z" />
      <path d="M36 14L24.5 62M54 14L43 62M72 14L61.5 62M12 38H85" {...pen.detail(3.5)} />
    </>
  ),
  windturbine: (pen) => (
    <>
      <path d="M46 40H54L59 94H41Z" />
      {[0, 120, 240].map((a) => (
        <path key={a} d="M46 35Q47 12 50 2Q56 14 55 35Z" transform={turn(a, 50, 37)} />
      ))}
      <circle cx={50} cy={37} r={7.5} {...pen.front(4)} />
    </>
  ),
  pylon: () => (
    <>
      <path d="M20 94L42 8H58L80 94M8 26H92M14 46H86M42 8L62.6 26M58 8L37.4 26M37.4 26L67.7 46M62.6 26L32.3 46M32.3 46L80 94M67.7 46L20 94" {...line(5)} />
      <path d="M10 26V34M90 26V34M16 46V54M84 46V54" {...line(4)} />
    </>
  ),
  antenna: () => (
    <>
      <path d="M36 94L50 32L64 94M40 76H60M44 56H56" {...line(5)} />
      <circle cx={50} cy={26} r={7} />
      <path d="M33 12Q25 24 33 38M67 12Q75 24 67 38M22 6Q10 24 22 44M78 6Q90 24 78 44" {...line(5)} />
    </>
  ),
  router: (pen) => (
    <>
      <rect x={20} y={20} width={7} height={34} rx={3.5} />
      <rect x={73} y={20} width={7} height={34} rx={3.5} />
      <path d="M38 34Q50 24 62 34M43 42Q50 36 57 42" {...line(4.5)} />
      <rect x={6} y={50} width={88} height={30} rx={8} />
      {[24, 36, 48].map((x) => (
        <circle key={x} cx={x} cy={65} r={3.5} {...pen.hole} />
      ))}
      <path d="M62 65H80" {...pen.detail(4)} />
      <rect x={16} y={80} width={10} height={6} rx={2} />
      <rect x={74} y={80} width={10} height={6} rx={2} />
    </>
  ),
  cable: (pen) => (
    <>
      <path d="M30 38V44Q30 56 42 56H58Q70 56 70 66" {...line(9)} />
      <rect x={22} y={2} width={5} height={9} rx={1} />
      <rect x={33} y={2} width={5} height={9} rx={1} />
      <rect x={17} y={8} width={26} height={24} rx={4} />
      <rect x={23} y={30} width={14} height={10} rx={2} />
      <rect x={63} y={62} width={14} height={10} rx={2} />
      <rect x={57} y={70} width={26} height={24} rx={4} />
      <path d="M63 78H77" {...pen.detail(3.5)} />
      <path d="M23 16H37" {...pen.detail(3.5)} />
    </>
  ),
  sensor: (pen) => (
    <>
      <rect x={36} y={36} width={28} height={28} rx={6} />
      <circle cx={50} cy={50} r={7} {...pen.hole} />
      <path d="M28 30Q20 50 28 70M72 30Q80 50 72 70M18 22Q6 50 18 78M82 22Q94 50 82 78" {...line(5)} />
    </>
  ),
  keyboard: (pen) => (
    <>
      <rect x={4} y={26} width={92} height={50} rx={6} />
      {[12, 23.3, 34.7, 46, 57.3, 68.7, 80].map((x) => (
        <rect key={`a${x}`} x={x} y={34} width={8} height={8} rx={1.5} {...pen.hole} />
      ))}
      {[17.7, 29, 40.3, 51.7, 63, 74.3].map((x) => (
        <rect key={`b${x}`} x={x} y={46} width={8} height={8} rx={1.5} {...pen.hole} />
      ))}
      <rect x={12} y={58} width={10} height={8} rx={1.5} {...pen.hole} />
      <rect x={26} y={58} width={48} height={8} rx={1.5} {...pen.hole} />
      <rect x={78} y={58} width={10} height={8} rx={1.5} {...pen.hole} />
    </>
  ),
  printer: (pen) => (
    <>
      <rect x={26} y={6} width={48} height={28} rx={2} />
      <rect x={8} y={28} width={84} height={40} rx={7} {...pen.front()} />
      <circle cx={78} cy={40} r={3.5} {...pen.hole} />
      <rect x={24} y={54} width={52} height={38} rx={2} {...pen.front()} />
      <path d="M32 66H68M32 76H60" {...pen.detail(4)} />
    </>
  ),
  cloudstorage: (pen) => (
    <>
      <path d="M26 78A18 18 0 0 1 24 42A26 26 0 0 1 74 36A21 21 0 0 1 78 78Z" />
      <path d="M50 42L36 56H45V70H55V56H64Z" {...pen.hole} />
    </>
  ),

  // Energy, industry and transport
  // An offshore oil platform.
  oilrig: (pen) => (
    <>
      <rect x={20} y={54} width={7} height={36} />
      <rect x={73} y={54} width={7} height={36} />
      <path d="M27 62L73 82M73 62L27 82" {...line(3.5)} />
      <path d="M6 88Q13.5 84 21 88T36 88T51 88T66 88T81 88T96 88" {...line(4.5)} />
      <path d="M36 50L46 8H54L64 50Z" />
      <path d="M40 38H60M43 26H57M45 16H55M40 38L57 26M43 26L55 16" {...pen.detail(3)} />
      <rect x={66} y={34} width={20} height={16} rx={1} />
      <rect x={10} y={48} width={80} height={9} rx={2} {...pen.front(5)} />
    </>
  ),
  coal: (pen) => (
    <g transform={move(0, -6)}>
      <path d="M6 92L10 72L26 64L40 72L42 92Z" />
      <path d="M10 72L22 78L40 72M22 78L24 92" {...pen.detail(3)} />
      {[
        ["M38 92L42 68L58 62L70 70L66 92Z", "M42 68L54 76L70 70M54 76L56 92"],
        ["M64 92L68 72L82 66L94 76L92 92Z", "M68 72L80 78L94 76M80 78L80 92"],
        ["M22 66L28 46L44 40L56 52L50 66Z", "M28 46L40 54L56 52M40 54L38 66"],
        ["M52 64L58 44L72 40L82 54L74 66Z", "M58 44L70 52L82 54M70 52L66 66"],
        ["M38 42L46 24L60 26L64 40L50 46Z", "M46 24L52 36L64 40M52 36L50 46"],
      ].map(([lump, facets]) => (
        <g key={lump}>
          <path d={lump} {...pen.front(6)} />
          <path d={facets} {...pen.detail(3)} />
        </g>
      ))}
    </g>
  ),
  // A nuclear power station: a cooling tower and the reactor dome.
  reactor: (pen) => (
    <>
      <circle cx={24} cy={20} r={8} />
      <circle cx={34} cy={13} r={9} />
      <circle cx={44} cy={20} r={7} />
      <path d="M8 92C18 72 22 50 18 30H48C44 50 48 72 58 92Z" {...pen.front()} />
      <path d="M58 92V62Q58 44 75 44Q92 44 92 62V92Z" {...pen.front()} />
    </>
  ),
  // A dam in cross-section: the reservoir held high on the left, the river low on the right.
  dam: (pen) => (
    <>
      <path d="M4 32Q10 28 16 32T28 32T40 32V92H4Z" />
      <path d="M10 50Q16 46 22 50T34 50M10 68Q16 64 22 68T34 68" {...pen.detail(3.5)} />
      <path d="M40 16H54L72 92H40Z" {...pen.front()} />
      <path d="M41 40H59M41 64H65" {...pen.detail(3.5)} />
      <path d="M72 76Q78 72 84 76T96 76V92H72Z" {...pen.front()} />
    </>
  ),
  engine: (pen) => (
    <g transform={move(0, 5)}>
      <rect x={40} y={12} width={20} height={6} rx={2} />
      <rect x={44} y={16} width={12} height={12} />
      <rect x={30} y={26} width={40} height={12} rx={2} />
      <rect x={4} y={50} width={10} height={12} rx={2} />
      <rect x={12} y={44} width={14} height={24} rx={2} />
      <path d="M74 46H86L94 38V74L86 66H74Z" />
      <rect x={24} y={36} width={52} height={42} rx={3} />
      <path d="M36 48V66M46 48V66M56 48V66M66 48V66" {...pen.detail(3.5)} />
    </g>
  ),
  hammer: () => (
    <g transform={`${move(0, 6)} ${turn(45)}`}>
      <rect x={44} y={34} width={12} height={62} rx={6} />
      <rect x={16} y={16} width={32} height={22} rx={3} />
      <rect x={44} y={18} width={16} height={18} />
      <path d="M58 18Q74 18 84 28L80 34Q72 28 58 32Z" />
    </g>
  ),
  wrench: (pen) => (
    <g transform={turn(45)}>
      <path d="M42 5.7V20Q42 25 47 25H53Q58 25 58 20V5.7A20 20 0 1 1 42 5.7Z" />
      <rect x={42} y={36} width={16} height={60} rx={8} />
      <circle cx={50} cy={84} r={4} {...pen.hole} />
    </g>
  ),
  pickaxe: () => (
    <g transform={`${move(7, 0)} ${turn(-35)}`}>
      <rect x={44} y={20} width={12} height={76} rx={6} />
      <path d="M2 36Q30 10 50 10Q70 10 98 36Q70 24 50 24Q30 24 2 36Z" />
      <rect x={41} y={8} width={18} height={20} rx={3} />
    </g>
  ),
  truck: (pen) => (
    <g transform={move(0, -4)}>
      <rect x={4} y={22} width={56} height={46} rx={3} />
      <path d="M64 70V36Q64 32 68 32H80Q84 32 86 36L94 52Q96 54 96 58V70Z" />
      <path d="M70 38H80L87 52H70Z" {...pen.hole} />
      <rect x={4} y={66} width={92} height={8} rx={2} />
      <circle cx={22} cy={78} r={10} {...pen.front()} />
      <circle cx={78} cy={78} r={10} {...pen.front()} />
      <circle cx={22} cy={78} r={4} {...pen.hole} />
      <circle cx={78} cy={78} r={4} {...pen.hole} />
    </g>
  ),
  tractor: (pen) => (
    <>
      <rect x={70} y={28} width={5} height={24} rx={2} />
      <path d="M16 50V14H50L54 50Z" />
      <path d="M22 44V20H44L47 44Z" {...pen.hole} />
      <rect x={14} y={48} width={78} height={22} rx={4} />
      <circle cx={30} cy={70} r={22} {...pen.front()} />
      <circle cx={30} cy={70} r={9} {...pen.hole} />
      <circle cx={80} cy={80} r={12} {...pen.front()} />
      <circle cx={80} cy={80} r={4.5} {...pen.hole} />
    </>
  ),
  bus: (pen) => (
    <>
      <rect x={4} y={18} width={92} height={58} rx={9} />
      {[12, 29, 46, 63].map((x) => (
        <rect key={x} x={x} y={27} width={13} height={18} rx={2} {...pen.hole} />
      ))}
      <rect x={81} y={27} width={8} height={30} rx={2} {...pen.hole} />
      <path d="M4 56H76" {...pen.detail(3.5)} />
      <circle cx={24} cy={78} r={10} {...pen.front()} />
      <circle cx={76} cy={78} r={10} {...pen.front()} />
      <circle cx={24} cy={78} r={4} {...pen.hole} />
      <circle cx={76} cy={78} r={4} {...pen.hole} />
    </>
  ),
  bicycle: () => (
    <>
      <circle cx={22} cy={64} r={17} {...line(6)} />
      <circle cx={78} cy={64} r={17} {...line(6)} />
      <path d="M22 64H48L40 38L22 64M40 38H68L48 64M68 36L78 64M40 38L38 30M66 36L64 26H74" {...line(5)} />
      <path d="M31 29H46" {...line(6)} />
      <circle cx={48} cy={64} r={4.5} />
    </>
  ),
  submarine: (pen) => (
    <g transform={move(0, 8)}>
      <path d="M52 24V10H60" {...line(4)} />
      <path d="M40 42V28Q40 24 44 24H60Q64 24 64 28V42Z" />
      <path d="M86 50L96 42V74L86 66Z" />
      <rect x={4} y={40} width={86} height={36} rx={18} />
      {[24, 40, 56, 72].map((x) => (
        <circle key={x} cx={x} cy={58} r={4.5} {...pen.hole} />
      ))}
    </g>
  ),
  helicopter: (pen) => (
    <g transform={move(0, 5)}>
      <rect x={10} y={10} width={70} height={6} rx={3} />
      <rect x={42} y={14} width={6} height={14} />
      <path d="M68 40H90V47L68 54Z" />
      <rect x={88} y={28} width={6} height={26} rx={3} />
      <path d="M16 54Q16 26 42 26H60Q72 26 72 44V58Q72 64 64 64H28Q16 64 16 54Z" />
      <path d="M22 50Q22 32 40 32V50Z" {...pen.hole} />
      <path d="M16 72Q16 78 22 78H70M34 64V78M58 64V78" {...line(4)} />
    </g>
  ),
  balloon: (pen) => (
    <>
      <path d="M38 70L40 80M62 70L60 80" {...line(3)} />
      <rect x={38} y={80} width={24} height={14} rx={2} />
      <path d="M50 4Q86 4 86 38Q86 56 64 72H36Q14 56 14 38Q14 4 50 4Z" />
      <path d="M50 5V71M50 5Q30 22 38 71M50 5Q70 22 62 71" {...pen.detail(3.5)} />
    </>
  ),
  parachute: (pen) => (
    <>
      <path d="M8 44L46 78M32 44L47 76M68 44L53 76M92 44L54 78" {...line(3)} />
      <path d="M6 44Q8 8 50 8Q92 8 94 44Q86 37 78 44Q72 37 64 44Q58 37 50 44Q42 37 36 44Q28 37 22 44Q14 37 6 44Z" />
      <path d="M36 43Q36 18 50 9M64 43Q64 18 50 9" {...pen.detail(3.5)} />
      <circle cx={50} cy={75} r={6} />
      <path d="M41 96Q41 83 50 82Q59 83 59 96Z" />
    </>
  ),
  anchor: (pen) => (
    <>
      <circle cx={50} cy={13} r={8} />
      <circle cx={50} cy={13} r={3.5} {...pen.hole} />
      <rect x={46} y={18} width={8} height={70} rx={2} />
      <rect x={30} y={28} width={40} height={8} rx={4} />
      <path d="M10 54A40 40 0 0 0 90 54H82A32 32 0 0 1 18 54Z" />
      <path d="M4 60L14 40L26 60Z" />
      <path d="M96 60L86 40L74 60Z" />
    </>
  ),
  crane: (pen) => (
    <>
      <path d="M32 4L10 18M32 4L92 18" {...line(2.5)} />
      <path d="M28 18L32 4L36 18Z" />
      <rect x={6} y={16} width={88} height={8} />
      <path d="M40 24L46 16L52 24L58 16L64 24L70 16L76 24L82 16L88 24" {...pen.detail(2.5)} />
      <rect x={6} y={24} width={14} height={10} />
      <rect x={26} y={24} width={12} height={66} />
      <path d="M26 32L38 42L26 52L38 62L26 72L38 82" {...pen.detail(2.5)} />
      <rect x={18} y={88} width={28} height={6} rx={1} />
      <path d="M80 24V52" {...line(3)} />
      <rect x={75} y={51} width={10} height={7} rx={1} />
      <path d="M80 58V65Q80 71 74 71Q70 71 70 67" {...line(4)} />
    </>
  ),
  road: (pen) => (
    <>
      <path d="M38 8H62L94 94H6Z" />
      <path d="M40.5 14L13 88M59.5 14L87 88" {...pen.detail(3)} />
      <path d="M48.8 16H51.2L51.6 26H48.4Z" {...pen.hole} />
      <path d="M48 36H52L52.8 50H47.2Z" {...pen.hole} />
      <path d="M46.6 62H53.4L54.6 84H45.4Z" {...pen.hole} />
    </>
  ),
  trafficlight: (pen) => (
    <>
      <rect x={45} y={80} width={10} height={14} />
      {[0, 1].map((side) => (
        <g key={side} transform={side ? MIRROR : undefined}>
          {[14, 36, 58].map((y) => (
            <path key={y} d={`M31 ${y}L20 ${y + 3}V${y + 9}L31 ${y + 12}Z`} />
          ))}
        </g>
      ))}
      <rect x={30} y={4} width={40} height={78} rx={10} />
      <circle cx={50} cy={21} r={8.5} {...pen.hole} />
      <circle cx={50} cy={43} r={8.5} {...pen.hole} />
      <circle cx={50} cy={65} r={8.5} {...pen.hole} />
    </>
  ),
  fuel: (pen) => (
    <>
      <path d="M62 24H72Q80 24 80 32V66Q80 74 86 74Q92 74 92 66V42" {...line(5)} />
      <rect x={87} y={26} width={10} height={16} rx={2} />
      <rect x={12} y={10} width={50} height={78} rx={6} />
      <rect x={20} y={18} width={34} height={22} rx={3} {...pen.hole} />
      <rect x={6} y={86} width={62} height={8} rx={2} />
    </>
  ),

  // Society and history
  school: (pen) => (
    <>
      <path d="M36 16L50 4L64 16Z" />
      <rect x={40} y={14} width={20} height={18} />
      <path d="M45 32V22A5 5 0 0 1 55 22V32Z" {...pen.hole} />
      <path d="M46.5 30Q46.5 23.5 50 23.5Q53.5 23.5 53.5 30Z" {...pen.front(2)} />
      <path d="M8 94V52L50 30L92 52V94Z" {...pen.front()} />
      <circle cx={50} cy={52} r={6} {...pen.hole} />
      <path d="M42 94V77Q42 71 50 71Q58 71 58 77V94Z" {...pen.hole} />
      <rect x={16} y={64} width={14} height={14} rx={2} {...pen.hole} />
      <rect x={70} y={64} width={14} height={14} rx={2} {...pen.hole} />
    </>
  ),
  bank: (pen) => (
    <>
      <path d="M50 4L94 30H6Z" />
      <circle cx={50} cy={20} r={5.5} {...pen.hole} />
      <rect x={8} y={32} width={84} height={7} />
      {[14, 30, 46, 62, 78].map((x) => (
        <rect key={x} x={x} y={42} width={8} height={38} />
      ))}
      <rect x={8} y={82} width={84} height={5} />
      <rect x={4} y={89} width={92} height={6} />
    </>
  ),
  shop: (pen) => (
    <>
      <rect x={12} y={36} width={76} height={58} />
      <rect x={18} y={50} width={34} height={26} rx={2} {...pen.hole} />
      <rect x={58} y={50} width={22} height={44} rx={2} {...pen.hole} />
      <path d="M8 10H92L96 30Q86.8 46 77.6 30Q68.4 46 59.2 30Q50 46 40.8 30Q31.6 46 22.4 30Q13.2 46 4 30Z" {...pen.front()} />
      <path d="M24.8 10L22.4 30M41.6 10L40.8 30M58.4 10L59.2 30M75.2 10L77.6 30" {...pen.detail(3.5)} />
    </>
  ),
  parliament: (pen) => (
    <>
      <rect x={47} y={4} width={6} height={12} />
      <path d="M30 36Q30 14 50 14Q70 14 70 36Z" />
      <rect x={26} y={34} width={48} height={10} />
      <rect x={6} y={50} width={88} height={36} {...pen.front()} />
      <path d="M30 56L50 46L70 56Z" {...pen.front(4)} />
      <path d="M36 60V84M45 60V84M55 60V84M64 60V84" {...pen.detail(4)} />
      {[12, 22, 72, 82].map((x) => (
        <rect key={x} x={x} y={60} width={6} height={12} rx={1} {...pen.hole} />
      ))}
      <rect x={4} y={86} width={92} height={8} rx={1} />
    </>
  ),
  megaphone: () => (
    <>
      <rect x={10} y={38} width={14} height={20} rx={3} />
      <rect x={34} y={56} width={10} height={24} rx={3} transform={turn(-10, 39, 56)} />
      <path d="M22 38L72 14Q80 12 80 20V76Q80 84 72 82L22 58Z" />
      <path d="M88 34Q94 48 88 62" {...line(5)} />
    </>
  ),
  trophy: (pen) => (
    <>
      <path d="M26 18H14Q8 18 8 26Q10 42 28 44M74 18H86Q92 18 92 26Q90 42 72 44" {...line(6)} />
      <path d="M24 8H76V30Q76 58 50 62Q24 58 24 30Z" />
      <rect x={44} y={60} width={12} height={14} />
      <rect x={30} y={74} width={40} height={8} rx={2} />
      <rect x={24} y={84} width={52} height={10} rx={2} />
      <path d="M36 20Q36 40 46 48" {...pen.detail(4)} />
    </>
  ),
  medal: (pen) => (
    <>
      <path d="M24 4H42L60 44L48 50Z" />
      <path d="M76 4H58L40 44L52 50Z" {...pen.front(5)} />
      <circle cx={50} cy={66} r={25} {...pen.front()} />
      <path d="M50 53L53.2 61.6L62.4 62L55.2 67.7L57.6 76.5L50 71.5L42.4 76.5L44.8 67.7L37.6 62L46.8 61.6Z" {...pen.hole} />
    </>
  ),
  // An ancient helmet seen from the front, with eye openings and a crest.
  helmet: (pen) => (
    <>
      <rect x={45} y={0} width={10} height={16} rx={5} />
      <path d="M50 8Q86 8 86 46V82Q86 92 76 92H57V66Q57 62 50 62Q43 62 43 66V92H24Q14 92 14 82V46Q14 8 50 8Z" />
      <path d="M20 48Q32 40 46 46V54Q44 58 40 58Q28 58 20 48Z" {...pen.hole} />
      <path d="M80 48Q68 40 54 46V54Q56 58 60 58Q72 58 80 48Z" {...pen.hole} />
      <path d="M28 26Q50 16 72 26" {...pen.detail(4)} />
    </>
  ),
  // A bow with an arrow nocked.
  bow: () => (
    <g transform={turn(-45)}>
      <path d="M38 7V93" {...line(3)} />
      <path d="M41 5Q90 50 41 95L35 92Q78 50 35 8Z" />
      <path d="M28 50H82" {...line(6)} />
      <path d="M97 50L80 40V60Z" />
      <path d="M30 50L20 40H11L21 50L11 60H20Z" />
    </g>
  ),
  spear: () => (
    <g transform={turn(45)}>
      <rect x={46} y={26} width={8} height={74} rx={4} />
      <path d="M50 -4L61 14Q63 26 57 32H43Q37 26 39 14Z" />
      <rect x={43} y={30} width={14} height={8} rx={2} />
    </g>
  ),
  axe: () => (
    <g transform={`${move(0, 5)} ${turn(30)}`}>
      <rect x={46} y={16} width={10} height={80} rx={5} />
      <path d="M48 16H36Q26 16 18 8Q8 28 18 48Q26 38 36 38H48Z" />
      <rect x={54} y={18} width={10} height={18} rx={2} />
    </g>
  ),
  catapult: (pen) => (
    <>
      <path d="M38 66L52 36L66 66" {...line(6)} />
      <g transform={turn(-38, 30, 60)}>
        <rect x={26} y={56} width={62} height={8} rx={4} />
        <path d="M80 46A9 9 0 0 0 98 46Z" />
        <circle cx={89} cy={41} r={6} />
      </g>
      <rect x={8} y={64} width={80} height={10} rx={2} />
      <circle cx={22} cy={80} r={10} {...pen.front()} />
      <circle cx={72} cy={80} r={10} {...pen.front()} />
      <circle cx={22} cy={80} r={3.5} {...pen.hole} />
      <circle cx={72} cy={80} r={3.5} {...pen.hole} />
    </>
  ),
  galleon: (pen) => (
    <>
      <rect x={16} y={10} width={4} height={46} />
      <rect x={44} y={4} width={4} height={52} />
      <rect x={73} y={12} width={4} height={38} />
      <path d="M46 4L58 7L46 10Z" />
      <path d="M8 20H28Q33 31 28 42H8Q13 31 8 20Z" />
      <path d="M33 12H59Q65 27 59 42H33Q39 27 33 12Z" />
      <path d="M64 20H86Q91 30 86 40H64Q69 30 64 20Z" />
      <path d="M4 54H22L26 62H66L70 48H96L90 78Q86 88 76 88H28Q16 88 12 80L4 62Z" />
      {[30, 42, 54, 66].map((x) => (
        <circle key={x} cx={x} cy={74} r={3} {...pen.hole} />
      ))}
    </>
  ),
  quill: (pen) => (
    <>
      <path d="M10 94V80Q10 74 16 74H40Q46 74 46 80V94Z" />
      <rect x={18} y={66} width={20} height={9} rx={2} />
      <path d="M30 66Q36 28 88 6Q78 42 34 68Z" {...pen.front(5)} />
      <path d="M33 64Q54 38 84 10" {...pen.detail(3)} />
    </>
  ),
  // A screw press, with a freshly printed sheet.
  printingpress: (pen) => (
    <>
      <rect x={8} y={6} width={9} height={88} rx={2} />
      <rect x={75} y={6} width={9} height={88} rx={2} />
      <rect x={4} y={6} width={84} height={12} rx={2} />
      <rect x={38} y={16} width={16} height={26} />
      <path d="M38 22L54 26M38 29L54 33M38 36L54 40" {...pen.detail(3)} />
      <path d="M46 33L90 24" {...line(6)} />
      <rect x={20} y={42} width={52} height={9} rx={1} />
      <rect x={4} y={56} width={84} height={9} />
      <g transform={turn(14, 74, 78)}>
        <rect x={56} y={62} width={36} height={32} rx={1.5} {...pen.front()} />
        <path d="M62 71H86M62 79H86M62 87H78" {...pen.detail(3.5)} />
      </g>
    </>
  ),
  // A desk globe on its stand.
  globe: (pen) => (
    <>
      <path d="M44 4A40 40 0 0 1 44 84" {...line(5)} />
      <rect x={40} y={82} width={8} height={6} />
      <path d="M22 94Q24 86 44 86Q64 86 66 94Z" />
      <circle cx={44} cy={44} r={31} />
      <g transform={turn(-20, 44, 44)}>
        <ellipse cx={44} cy={44} rx={13} ry={31} {...pen.detail(3.5)} />
        <path d="M13 44H75M18 28H70M18 60H70" {...pen.detail(3.5)} />
      </g>
    </>
  ),
  moneybag: (pen) => (
    <>
      <path d="M38 28L30 10Q40 14 50 8Q60 14 70 10L62 28Z" />
      <path d="M36 32Q10 50 12 72Q14 94 50 94Q86 94 88 72Q90 50 64 32Z" />
      <rect x={34} y={26} width={32} height={8} rx={4} {...pen.front(5)} />
      <circle cx={50} cy={66} r={15} {...pen.front(5)} />
      <circle cx={50} cy={66} r={9.5} {...pen.detail(3.5)} />
    </>
  ),
  piggybank: (pen) => (
    <>
      <path d="M89 52Q96 48 94 42Q92 37 87 41" {...line(3.5)} />
      <rect x={28} y={72} width={11} height={20} rx={3} />
      <rect x={66} y={72} width={11} height={20} rx={3} />
      <ellipse cx={54} cy={58} rx={36} ry={26} />
      <path d="M30 40Q30 24 42 22Q48 32 42 44Z" {...pen.front(5)} />
      <rect x={10} y={50} width={12} height={16} rx={4} {...pen.front(5)} />
      <rect x={44} y={34} width={22} height={5} rx={2.5} {...pen.hole} />
      <circle cx={30} cy={52} r={3} {...pen.hole} />
      <circle cx={55} cy={16} r={10} {...pen.front(4)} />
      <circle cx={55} cy={16} r={5.5} {...pen.detail(3)} />
    </>
  ),
  // Two grown-ups and a child, told apart by size alone.
  family: (pen) => (
    <>
      <circle cx={24} cy={22} r={11} />
      <path d="M6 90Q6 46 24 44Q42 46 42 90Z" />
      <circle cx={76} cy={22} r={11} />
      <path d="M58 90Q58 46 76 44Q94 46 94 90Z" />
      <circle cx={50} cy={52} r={9} {...pen.front(5)} />
      <path d="M36 94Q36 68 50 66Q64 68 64 94Z" {...pen.front(5)} />
    </>
  ),
  // A child holding a balloon.
  child: () => (
    <>
      <path d="M58 50L74 34" {...line(3)} />
      <ellipse cx={77} cy={20} rx={12} ry={14} />
      <path d="M74 33L77 37L80 33Z" />
      {stick(48, 70, 58, 50, 8)}
      <circle cx={36} cy={42} r={15} />
      <path d="M16 94Q16 62 36 60Q56 62 56 94Z" />
    </>
  ),
  // A sleeping baby's face, with a curl and a pacifier.
  baby: (pen) => (
    <>
      <circle cx={13} cy={56} r={7} />
      <circle cx={87} cy={56} r={7} />
      <circle cx={50} cy={54} r={37} {...pen.front(5)} />
      <path d="M48 17Q42 9 48 5Q54 3 55 9" {...pen.detail(4)} />
      <path d="M30 52Q35 57 40 52M60 52Q65 57 70 52" {...pen.detail(4)} />
      <ellipse cx={50} cy={72} rx={12} ry={7} {...pen.front(4)} />
      <circle cx={50} cy={72} r={4} {...pen.detail(3)} />
    </>
  ),

  // Science and symbols
  testtube: (pen) => (
    <g transform={`${move(-4, 0)} ${turn(25)}`}>
      <path d="M36 6H64M42 6V78Q42 92 50 92Q58 92 58 78V6" {...line(6)} />
      <path d="M42 50H58V78Q58 92 50 92Q42 92 42 78Z" />
      <circle cx={50} cy={66} r={3} {...pen.hole} />
      <circle cx={52} cy={79} r={2.5} {...pen.hole} />
    </g>
  ),
  beaker: (pen) => (
    <g transform={move(6, 0)}>
      <path d="M14 10Q22 10 26 16V80Q26 90 36 90H64Q74 90 74 80V10" {...line(7)} />
      <path d="M26 50H74V80Q74 90 64 90H36Q26 90 26 80Z" />
      <path d="M60 26H74M64 38H74" {...line(4)} />
      <circle cx={42} cy={70} r={4} {...pen.hole} />
      <circle cx={57} cy={62} r={3} {...pen.hole} />
    </g>
  ),
  petri: (pen) => (
    <>
      <path d="M6 46V54Q6 76 50 76Q94 76 94 54V46Z" />
      <ellipse cx={50} cy={46} rx={44} ry={20} {...pen.front()} />
      <ellipse cx={50} cy={46} rx={36} ry={14} {...pen.hole} />
      {[
        [36, 44, 5],
        [54, 38, 4],
        [62, 50, 5.5],
        [44, 52, 3.5],
        [71, 42, 3],
      ].map(([x, y, r]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={r} {...pen.front(3)} />
      ))}
    </>
  ),
  magnifier: (pen) => (
    <>
      <rect x={69} y={56} width={14} height={40} rx={7} transform={turn(-45, 76, 76)} />
      <circle cx={40} cy={40} r={31} />
      <circle cx={40} cy={40} r={22} {...pen.hole} />
      <path d="M26 36Q27 27 36 25" {...line(4)} />
    </>
  ),
  ruler: (pen) => (
    <g transform={turn(-45)}>
      <rect x={4} y={34} width={92} height={32} rx={3} />
      <path d="M14 34V48M24 34V42M34 34V48M44 34V42M54 34V48M64 34V42M74 34V48M84 34V42" {...pen.detail(3.5)} />
    </g>
  ),
  scale: () => (
    <>
      <path d="M16 22L6 58M16 22L26 58M84 22L74 58M84 22L94 58" {...line(3)} />
      <rect x={46} y={14} width={8} height={72} />
      <rect x={10} y={18} width={80} height={7} rx={3.5} />
      <circle cx={50} cy={12} r={6} />
      <path d="M4 58H28Q26 70 16 70Q6 70 4 58Z" />
      <path d="M72 58H96Q94 70 84 70Q74 70 72 58Z" />
      <path d="M26 94Q28 84 50 84Q72 84 74 94Z" />
    </>
  ),
  thermometer: (pen) => (
    <>
      <path d="M66 22H74M66 34H74M66 46H74" {...line(3.5)} />
      <rect x={38} y={4} width={22} height={66} rx={11} />
      <circle cx={49} cy={76} r={18} />
      <path d="M45 15Q45 11 49 11Q53 11 53 15V66A11 11 0 1 1 45 66Z" {...pen.hole} />
      <path d="M46.5 40H51.5V70A7 7 0 1 1 46.5 70Z" {...pen.front(3)} />
    </>
  ),
  gauge: (pen) => (
    <>
      <path d="M6 70A44 44 0 0 1 94 70Q94 78 86 78H14Q6 78 6 70Z" />
      <path d={rays(50, 70, 33, 41, [180, 225, 270, 315, 360])} {...pen.detail(4)} />
      <path d="M50 70L70 44" {...pen.detail(5)} />
      <circle cx={50} cy={70} r={6} {...pen.hole} />
    </>
  ),
  // A glass prism splitting a beam of light into rays.
  prism: (pen) => (
    <g transform={move(0, 11)}>
      <path d="M5 54L19 48" {...line(5)} />
      <path d="M79 44L93 39M81 48L94 52M83 52L92 64" {...line(4)} />
      <path d="M34 16L62 8L88 62L60 70Z" />
      <path d="M34 16L60 70H8Z" {...pen.front()} />
    </g>
  ),
  lens: (pen) => (
    <>
      <path d="M4 30H50L84 50M4 50H84M4 70H50L84 50" {...line(4)} />
      <path d="M50 8Q68 50 50 92Q32 50 50 8Z" {...pen.front()} />
      <circle cx={88} cy={50} r={5} />
    </>
  ),
  laser: (pen) => (
    <g transform={move(-2.5, 0)}>
      <path d="M54 50H74" {...line(6)} />
      <path d={rays(84, 50, 5, 12, [-90, -45, 0, 45, 90])} {...line(5)} />
      <rect x={4} y={32} width={42} height={36} rx={5} />
      <rect x={44} y={41} width={10} height={18} rx={2} />
      <path d="M13 44H33M13 54H27" {...pen.detail(4)} />
    </g>
  ),
  molecule: (pen) => (
    <>
      <path d="M50 50L22 26M50 50L30 80M50 50L78 76" {...line(6)} />
      <path d="M48 44L76 26M52 52L80 34" {...line(4.5)} />
      {[
        [22, 26, 11],
        [80, 30, 9],
        [30, 80, 9],
        [78, 76, 12],
        [50, 50, 14],
      ].map(([x, y, r]) => (
        <g key={`${x}-${y}`}>
          <circle cx={x} cy={y} r={r} {...pen.front(5)} />
          <path d={`M${x - r * 0.55} ${y - r * 0.1}Q${x - r * 0.5} ${y - r * 0.5} ${x - r * 0.1} ${y - r * 0.55}`} {...pen.detail(3)} />
        </g>
      ))}
    </>
  ),
  // A spiral galaxy seen at a slant, with stars around it.
  galaxy: () => (
    <>
      <path d="M66 44C66.5 45 69 48 69 50C69 52.5 67.5 56 65 58.5C62.5 61.5 58.5 65 54 67C50 69 43.5 71 38.5 71.5C33 72 27 71.5 22.5 69.5C18 67.5 14 64 12.5 60.5C11 56.5 10.5 51 13 46C15 41 23.5 32.5 26 30L27.5 31.5C25.5 34 18.5 41.5 17 46.5C16 51 17 55.5 19 58.5C21 61.5 25.5 63.5 29 64.5C33 65.5 38.5 65 42 64.5C46 63.5 50 61.5 52.5 59.5C54.5 57.5 56 55 56.5 53.5C56.5 52 55.5 50.5 54 50C53 49.5 50 50.5 49 50.5Z" />
      <path d="M34 56C33.5 55 31 52 31 50C31 47.5 32.5 44 35 41.5C37.5 38.5 41.5 35 46 33C50 31 56.5 29 61.5 28.5C67 28 73 28.5 77.5 30.5C82 32.5 86 36 87.5 39.5C89 43.5 89.5 49 87 54C85 59 76.5 67.5 74 70L72.5 68.5C74.5 66 81.5 58.5 83 53.5C84 49 83 44.5 81 41.5C79 38.5 74.5 36.5 71 35.5C67 34.5 61.5 35 58 35.5C54 36.5 50 38.5 47.5 40.5C45.5 42.5 44 45 43.5 46.5C43.5 48 44.5 49.5 46 50C47 50.5 50 49.5 51 49.5Z" />
      <ellipse cx={50} cy={50} rx={16} ry={10} transform={turn(-20)} />
      {[
        [16, 16, 3],
        [82, 14, 2.5],
        [12, 84, 2.5],
        [86, 86, 3],
        [50, 12, 2],
        [52, 90, 2],
      ].map(([x, y, r]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={r} />
      ))}
    </>
  ),
  comet: (pen) => (
    <>
      <path d="M58 20L46 34M80 44L66 58" {...line(4.5)} />
      <path d="M58 18L6 90L82 42Z" />
      <circle cx={70} cy={30} r={16} {...pen.front()} />
      <path d="M61 26Q62 19 69 18" {...pen.detail(3.5)} />
    </>
  ),
  asteroid: (pen) => (
    <>
      <circle cx={14} cy={18} r={5} />
      <circle cx={88} cy={20} r={3.5} />
      <circle cx={86} cy={86} r={5.5} />
      <path d="M20 38C23.5 33 29 26 34 24C39 22 44.5 27.5 50 27C55.5 26.5 61 19.5 66 20C71 20.5 78 25.5 81 30C84 34.5 82.5 41.5 84 47C85.5 52.5 91.5 57 90 62C88.5 67 81.5 74 76 76C70.5 78 62.5 72 56 73C49.5 74 44 82.5 38 82C32 81.5 25 74.5 21 70C17 65.5 13 59.5 13 54C13 48.5 16.5 43 20 38Z" />
      <circle cx={38} cy={44} r={7} {...pen.hole} />
      <circle cx={64} cy={58} r={9} {...pen.hole} />
      <circle cx={34} cy={66} r={4.5} {...pen.hole} />
      <circle cx={66} cy={33} r={4} {...pen.hole} />
    </>
  ),
  // Matter swirling into a dark center.
  blackhole: (pen) => (
    <>
      <path d={swirl(50, 50, 24, 45, [0, 90, 180, 270], 65)} {...line(6)} />
      <circle cx={50} cy={50} r={22} />
      <circle cx={50} cy={50} r={15} {...pen.hole} />
    </>
  ),
  radiation: () => (
    <>
      <circle cx={50} cy={47} r={8} />
      {[0, 120, 240].map((a) => (
        <path key={a} d="M71 83.4A42 42 0 0 1 29 83.4L44 57.4A12 12 0 0 0 56 57.4Z" transform={turn(a, 50, 47)} />
      ))}
    </>
  ),
  // Three arrows chasing each other around a triangle.
  recycle: () => (
    <>
      {[0, 120, 240].map((a) => (
        <g key={a} transform={turn(a, 50, 56)}>
          <path d="M72 60L80 74Q83 80 76 80H40" {...line(9)} />
          <path d="M26 80L40 69V91Z" />
        </g>
      ))}
    </>
  ),
  arrowup: () => <path d="M50 6L88 46H62V90Q62 94 58 94H42Q38 94 38 90V46H12Z" />,
  arrowdown: () => <path d="M50 6L88 46H62V90Q62 94 58 94H42Q38 94 38 90V46H12Z" transform={turn(180)} />,
  plus: () => <path d="M50 14V86M14 50H86" {...line(14)} />,
  minus: () => <path d="M14 50H86" {...line(14)} />,
  target: (pen) => (
    <>
      <circle cx={44} cy={56} r={38} />
      <circle cx={44} cy={56} r={29} {...pen.hole} />
      <circle cx={44} cy={56} r={21} {...pen.front(3)} />
      <circle cx={44} cy={56} r={12} {...pen.hole} />
      <circle cx={44} cy={56} r={5} {...pen.front(3)} />
      <path d="M44 56L84 16" {...pen.gapLine(11)} />
      <path d="M44 56L84 16M82 18V6M82 18H94" {...line(5)} />
    </>
  ),
  puzzle: () => (
    <path d="M10 32H34Q30 24 34 18Q40 10 48 14Q56 18 52 32H76V54Q84 50 88 56Q92 64 86 70Q82 74 76 70V92H54Q58 84 52 80Q44 76 38 82Q34 86 36 92H10V70Q18 74 22 68Q26 60 20 56Q14 52 10 56Z" />
  ),
  idea: (pen) => (
    <>
      <path d={rays(50, 46, 27, 37, [180, 225, 270, 315, 0])} {...line(5)} />
      <path d="M50 26C38 26 30 35 30 46C30 55 36 60 39 65V69H61V65C64 60 70 55 70 46C70 35 62 26 50 26Z" />
      <path d="M38 46Q38 37 46 34" {...pen.detail(4)} />
      <rect x={40} y={72} width={20} height={5} rx={2.5} />
      <rect x={42} y={79} width={16} height={5} rx={2.5} />
      <rect x={45} y={86} width={10} height={5} rx={2.5} />
    </>
  ),
  speech: (pen) => (
    <>
      <path d="M14 12H86Q94 12 94 20V60Q94 68 86 68H46L26 88V68H14Q6 68 6 60V20Q6 12 14 12Z" />
      <path d="M22 32H78M22 48H62" {...pen.detail(5)} />
    </>
  ),
  hourglass: () => (
    <>
      <rect x={18} y={6} width={64} height={9} rx={3} />
      <rect x={18} y={85} width={64} height={9} rx={3} />
      <path d="M28 15Q28 38 46 48V52Q28 62 28 85M72 15Q72 38 54 48V52Q72 62 72 85" {...line(5)} />
      <path d="M36 30H64Q60 40 50 46Q40 40 36 30Z" />
      <path d="M50 50V72" {...line(3)} />
      <path d="M32 85Q34 72 50 70Q66 72 68 85Z" />
    </>
  ),
  stopwatch: (pen) => (
    <>
      <rect x={44} y={6} width={12} height={8} rx={2} />
      <rect x={47} y={12} width={6} height={10} />
      <rect x={74} y={18} width={10} height={8} rx={2} transform={turn(45, 79, 22)} />
      <circle cx={50} cy={58} r={36} />
      <circle cx={50} cy={58} r={28} {...pen.hole} />
      <path d="M50 58L64 40M50 34V38M74 58H70M50 82V78M26 58H30" {...line(4)} />
      <circle cx={50} cy={58} r={5} {...pen.front(3)} />
    </>
  ),
};

const DOT = () => <circle cx={50} cy={50} r={30} />;

// A drawn icon's outline keeps about the same weight on screen at every size: a little thinner in the grid for a big
// icon and a little thicker for a small one, so icons of different sizes look drawn with the same pen.
const outlineWidth = (stroke: number, size: number) => stroke * Math.min(1.5, Math.max(0.6, Math.sqrt(120 / size)));

// An icon from lib/icons.ts at the given size, on a background of the `cut` color (the ground when left out). An
// unknown name draws a dot, so a bad name never breaks a scene.
// The shapes of an icon in a look, on its 100 x 100 grid: for Icon, and for the templates, which draw the same icons
// in their own markup (remotion/filmmotor/theme.ts).
export function iconShapes({ name, size, color, cut, theme }: { name: string; size: number; color: string; cut: string; theme: Theme }): ReactNode {
  const { colors, drawing } = theme;
  const shape = isIconName(name) ? SHAPES[name] : DOT;
  if (drawing.icon === "solid") {
    return (
      <g fill={color} color={color}>
        {shape(solidPen(cut))}
      </g>
    );
  }
  // Blueprint draws the outline in the icon's color around shapes filled with the background, like chalk on the
  // drawing. Field guide draws it in ink around a pale tint of the icon's color, like a plate in a field guide.
  // Lines keep the icon's color in both.
  const outline = drawing.icon === "ink" ? colors.paper : color;
  const inside = drawing.icon === "ink" ? mix(color, cut, 0.25) : cut;
  const width = outlineWidth(drawing.stroke, size);
  return (
    <>
      <g fill={outline} stroke={outline} strokeWidth={2 * width} strokeLinejoin="round" color={outline}>
        {shape(outlinePen)}
      </g>
      <g fill={inside} color={color}>
        {shape(insidePen(cut, inside, outline, width))}
      </g>
    </>
  );
}

export function Icon({ name, size, color, cut }: { name: string; size: number; color: string; cut?: string }) {
  const theme = useTheme();
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: "block", overflow: "visible" }}>
      {iconShapes({ name, size, color, cut: cut ?? theme.colors.ink, theme })}
    </svg>
  );
}
