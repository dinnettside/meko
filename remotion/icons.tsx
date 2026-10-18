import type { ReactNode } from "react";
import { isIconName, type IconName } from "@/lib/icons";

// Each icon is a few flat shapes on a 100 x 100 grid, filled with one color. Shapes that need a second tone use the
// background color through `cut`, so they read on any background. Lines are used only where a line is the natural
// form (rays, orbits, a handle), and are thick enough to survive at 64 px.

// A line in the icon's color.
const line = (width: number) =>
  ({ fill: "none", stroke: "currentColor", strokeWidth: width, strokeLinecap: "round", strokeLinejoin: "round" }) as const;
// A line in the cut color, for details drawn on top of a shape.
const cutLine = (cut: string, width: number) =>
  ({ fill: "none", stroke: cut, strokeWidth: width, strokeLinecap: "round", strokeLinejoin: "round" }) as const;
// A cut outline painted behind a shape, so it stands apart from the shape it overlaps.
const gap = (cut: string, width = 8) => ({ stroke: cut, strokeWidth: width, strokeLinejoin: "round", paintOrder: "stroke" }) as const;
// Rotation around a point, the middle of the grid by default.
const turn = (degrees: number, x = 50, y = 50) => `rotate(${degrees} ${x} ${y})`;
const EIGHT_WAYS = [0, 45, 90, 135, 180, 225, 270, 315];

const SHAPES: Record<IconName, (cut: string) => ReactNode> = {
  // People and power
  person: () => (
    <>
      <circle cx={50} cy={26} r={17} />
      <path d="M20 92Q20 50 50 48Q80 50 80 92Z" />
    </>
  ),
  people: (cut) => (
    <>
      <circle cx={33} cy={27} r={13} />
      <path d="M6 92Q6 52 33 50Q60 52 60 92Z" />
      <circle cx={65} cy={37} r={15} {...gap(cut)} />
      <path d="M36 94Q36 60 65 58Q94 60 94 94Z" {...gap(cut)} />
    </>
  ),
  astronaut: (cut) => (
    <>
      <path d="M12 96Q12 70 32 66H68Q88 70 88 96Z" />
      <rect x={40} y={76} width={20} height={11} rx={2} fill={cut} />
      <circle cx={50} cy={40} r={30} {...gap(cut)} />
      <rect x={14} y={32} width={9} height={17} rx={3} />
      <rect x={77} y={32} width={9} height={17} rx={3} />
      <rect x={29} y={26} width={42} height={27} rx={13.5} fill={cut} />
      <path d="M37 35Q39 31 45 31" {...line(4)} />
    </>
  ),
  scientist: (cut) => (
    <>
      <circle cx={40} cy={24} r={16} />
      <path d="M24 23H56" {...cutLine(cut, 5)} />
      <circle cx={33} cy={23} r={6.5} fill={cut} />
      <circle cx={47} cy={23} r={6.5} fill={cut} />
      <circle cx={33} cy={23} r={2.5} />
      <circle cx={47} cy={23} r={2.5} />
      <path d="M8 94Q8 50 40 46Q72 50 72 94Z" />
      <path d="M32 49L40 64L48 49M40 64V94" {...cutLine(cut, 4)} />
      <path d="M68 42H82V46H79V60L92 87Q95 94 88 94H62Q55 94 58 87L71 60V46H68Z" {...gap(cut)} />
      <path d="M63 77H87" {...cutLine(cut, 4)} />
      <circle cx={84} cy={32} r={3.5} />
      <circle cx={77} cy={24} r={2.5} />
    </>
  ),
  soldier: (cut) => (
    <>
      <circle cx={50} cy={43} r={15} />
      <path d="M16 94Q16 65 50 63Q84 65 84 94Z" />
      <path d="M34 66L62 94" {...cutLine(cut, 5)} />
      <path d="M18 44Q18 10 50 10Q82 10 82 44Q74 38 64 37H36Q26 38 18 44Z" {...gap(cut, 6)} />
      <path d="M22 36Q50 26 78 36" {...cutLine(cut, 3.5)} />
    </>
  ),
  crown: (cut) => (
    <>
      <path d="M14 76L8 32L32 52L50 22L68 52L92 32L86 76Z" />
      <circle cx={8} cy={27} r={7} />
      <circle cx={50} cy={17} r={7} />
      <circle cx={92} cy={27} r={7} />
      <rect x={14} y={80} width={72} height={12} rx={3} />
      <circle cx={50} cy={62} r={6} fill={cut} />
      <circle cx={29} cy={64} r={4} fill={cut} />
      <circle cx={71} cy={64} r={4} fill={cut} />
    </>
  ),
  sword: (cut) => (
    <g transform={turn(45)}>
      <path d="M50 -8L59 4V70H41V4Z" />
      <path d="M50 8V62" {...cutLine(cut, 3.5)} />
      <rect x={24} y={69} width={52} height={11} rx={5} />
      <rect x={45} y={79} width={10} height={21} rx={3} />
      <circle cx={50} cy={104} r={7} />
    </g>
  ),
  shield: (cut) => (
    <>
      <path d="M50 6L88 18V46Q88 76 50 94Q12 76 12 46V18Z" />
      <path d="M50 17L78 26V46Q78 70 50 83Q22 70 22 46V26Z" {...cutLine(cut, 5)} />
    </>
  ),
  castle: (cut) => (
    <>
      <path d="M6 94V14H12V22H17V14H23V22H28V14H34V40H40V32H46V40H54V32H60V40H66V14H72V22H77V14H83V22H88V14H94V94Z" />
      <path d="M41 94V76A9 9 0 0 1 59 76V94Z" fill={cut} />
      <rect x={16} y={38} width={8} height={14} rx={4} fill={cut} />
      <rect x={76} y={38} width={8} height={14} rx={4} fill={cut} />
    </>
  ),
  flag: () => (
    <>
      <rect x={12} y={8} width={8} height={88} rx={4} />
      <circle cx={16} cy={8} r={6} />
      <path d="M19 14Q36 6 54 14Q70 22 88 14V58Q70 66 54 58Q36 50 19 58Z" />
    </>
  ),
  ballot: (cut) => (
    <>
      <rect x={12} y={50} width={76} height={42} rx={6} />
      <rect x={28} y={50} width={44} height={7} rx={3.5} fill={cut} />
      <rect x={34} y={8} width={32} height={46} rx={3} />
      <path d="M42 31L48 37L58 24" {...cutLine(cut, 5)} />
    </>
  ),
  gavel: (cut) => (
    <>
      <g transform={turn(-45)}>
        <rect x={20} y={12} width={60} height={28} rx={6} />
        <path d="M31 12V40M69 12V40" {...cutLine(cut, 4)} />
        <rect x={45} y={38} width={10} height={56} rx={5} />
      </g>
      <rect x={8} y={82} width={44} height={12} rx={4} />
    </>
  ),
  // Two sleeves, two hands, then the left hand's thumb and the right hand's four fingers wrapped over it, each finger
  // with a cut edge.
  handshake: (cut) => (
    <>
      <rect x={2} y={28} width={16} height={40} rx={3} transform={turn(-10, 10, 48)} />
      <rect x={82} y={28} width={16} height={40} rx={3} transform={turn(10, 90, 48)} />
      <path d="M19 38L38 32L47 44L36 64L19 64Z" />
      <path d="M81 32L60 27Q51 27 45 34L36 46L81 64Z" />
      {["M38 33L64 28", "M63 51L52 75", "M57 46L43 70", "M51 41L35 63", "M46 37L30 56"].map((d) => (
        <g key={d}>
          <path d={d} {...cutLine(cut, 15)} />
          <path d={d} {...line(9)} />
        </g>
      ))}
    </>
  ),
  // Links seen face on, joined by links seen edge on. Each edge-on link sits in front of the link to its left and
  // behind the link to its right, so they read as interlocked.
  chains: (cut) => (
    <g transform={turn(-45)}>
      <rect x={-6} y={37} width={36} height={26} rx={13} {...line(8)} />
      <rect x={20} y={45} width={26} height={10} rx={5} {...gap(cut, 7)} />
      <rect x={36} y={37} width={36} height={26} rx={13} {...cutLine(cut, 14)} />
      <rect x={36} y={37} width={36} height={26} rx={13} {...line(8)} />
      <rect x={62} y={45} width={26} height={10} rx={5} {...gap(cut, 7)} />
      <rect x={78} y={37} width={36} height={26} rx={13} {...cutLine(cut, 14)} />
      <rect x={78} y={37} width={36} height={26} rx={13} {...line(8)} />
    </g>
  ),
  wall: (cut) => (
    <>
      <rect x={6} y={18} width={88} height={72} rx={3} />
      <path
        d="M6 36H94M6 54H94M6 72H94M35 18V36M65 18V36M20 36V54M50 36V54M80 36V54M35 54V72M65 54V72M20 72V90M50 72V90M80 72V90"
        {...cutLine(cut, 5)}
        strokeLinecap="butt"
      />
    </>
  ),
  cannon: (cut) => (
    <>
      <path d="M40 70L8 90" {...line(9)} />
      <g transform={turn(-20)}>
        <path d="M18 36L84 41V57L18 62Q8 62 8 49Q8 36 18 36Z" />
        <rect x={80} y={37} width={10} height={24} rx={3} />
        <circle cx={6} cy={49} r={5} />
      </g>
      <circle cx={40} cy={70} r={20} {...gap(cut)} />
      <circle cx={40} cy={70} r={13} fill={cut} />
      <path d="M27 70H53M33.5 58.7L46.5 81.3M33.5 81.3L46.5 58.7" {...line(4)} />
      <circle cx={40} cy={70} r={5} />
      <circle cx={74} cy={88} r={6} />
      <circle cx={88} cy={88} r={6} />
      <circle cx={81} cy={77} r={6} />
    </>
  ),
  tank: (cut) => (
    <>
      <rect x={6} y={62} width={88} height={26} rx={13} />
      {[20, 35, 50, 65, 80].map((x) => (
        <circle key={x} cx={x} cy={75} r={6} fill={cut} />
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
  house: (cut) => (
    <>
      <rect x={66} y={14} width={11} height={24} />
      <path d="M50 8L94 46H82V92H18V46H6Z" />
      <rect x={30} y={64} width={16} height={28} rx={2} fill={cut} />
      <rect x={56} y={58} width={16} height={14} rx={2} fill={cut} />
    </>
  ),
  factory: (cut) => (
    <>
      <path d="M6 92V52L28 38V52L50 38V52L72 38V24H86V92Z" />
      <rect x={14} y={64} width={10} height={10} rx={1.5} fill={cut} />
      <rect x={32} y={64} width={10} height={10} rx={1.5} fill={cut} />
      <rect x={50} y={64} width={10} height={10} rx={1.5} fill={cut} />
      <circle cx={80} cy={14} r={5} />
      <circle cx={91} cy={7} r={4} />
    </>
  ),
  city: (cut) => (
    <>
      <rect x={6} y={42} width={22} height={52} />
      <rect x={32} y={12} width={26} height={82} />
      <rect x={43} y={3} width={4} height={10} />
      <rect x={62} y={30} width={18} height={64} />
      <rect x={84} y={54} width={10} height={40} />
      <path d="M40 20V70M50 20V70" stroke={cut} strokeWidth={6} strokeDasharray="7 6" />
      <path d="M17 50V84" stroke={cut} strokeWidth={8} strokeDasharray="6 6" />
      <path d="M71 38V84" stroke={cut} strokeWidth={7} strokeDasharray="6 6" />
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
  church: (cut) => (
    <>
      <path d="M8 94V58L30 40H70L92 58V94Z" />
      <path d="M37 94V38H35L50 12L65 38H63V94Z" {...gap(cut, 6)} />
      <rect x={47.5} y={0} width={5} height={14} />
      <rect x={43} y={3.5} width={14} height={5} />
      <path d="M44 94V81A6 6 0 0 1 56 81V94Z" fill={cut} />
      <circle cx={50} cy={57} r={5} fill={cut} />
      <rect x={17} y={66} width={8} height={14} rx={4} fill={cut} />
      <rect x={75} y={66} width={8} height={14} rx={4} fill={cut} />
    </>
  ),
  mosque: (cut) => (
    <>
      <rect x={24} y={56} width={52} height={38} />
      <path d="M27 58C20 44 34 32 50 24C66 32 80 44 73 58Z" />
      <rect x={48} y={12} width={4} height={14} />
      <circle cx={50} cy={11} r={3.5} />
      <path d="M8 94V31L13 14L18 31V94Z" />
      <rect x={5} y={42} width={16} height={5} rx={2} />
      <path d="M82 94V31L87 14L92 31V94Z" />
      <rect x={79} y={42} width={16} height={5} rx={2} />
      <path d="M42 94V78Q42 70 50 66Q58 70 58 78V94Z" fill={cut} />
      <path d="M24 57H76" {...cutLine(cut, 3)} />
    </>
  ),
  pagoda: (cut) => (
    <>
      <rect x={48} y={3} width={4} height={14} />
      <circle cx={50} cy={4} r={3} />
      <path d="M26 26Q34 24 39 16H61Q66 24 74 26Z" />
      <rect x={37} y={25} width={26} height={14} />
      <path d="M16 48Q26 46 32 38H68Q74 46 84 48Z" />
      <rect x={31} y={47} width={38} height={14} />
      <path d="M6 72Q18 70 26 60H74Q82 70 94 72Z" />
      <rect x={24} y={71} width={52} height={23} />
      <rect x={43} y={78} width={14} height={16} rx={2} fill={cut} />
    </>
  ),
  pyramid: (cut) => (
    <>
      <path d="M68 40L98 90H38Z" />
      <path d="M42 14L82 90H2Z" {...gap(cut)} />
      <path d="M42 14L54 90" {...cutLine(cut, 4)} />
    </>
  ),
  tower: (cut) => (
    <>
      <path d="M22 8H32V16H42V8H58V16H68V8H78V30H22Z" />
      <path d="M30 33H70L67 82H33Z" />
      <rect x={22} y={84} width={56} height={10} rx={2} />
      <path d="M45 58V49A5 5 0 0 1 55 49V58Z" fill={cut} />
      <path d="M43 82V72A7 7 0 0 1 57 72V82Z" fill={cut} />
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
  leaf: (cut) => (
    <>
      <path d="M18 82Q24 20 86 14Q80 76 18 82Z" />
      <path d="M18 82L8 92" {...line(7)} />
      <path d="M26 74L72 28" {...cutLine(cut, 4.5)} />
    </>
  ),
  mountain: (cut) => (
    <>
      <path d="M48 92L72 46L98 92Z" />
      <path d="M2 92L38 20L76 92Z" {...gap(cut)} />
      <path d="M26 44L32 52L38 44L44 52L51 44" {...cutLine(cut, 5)} />
      <path d="M64 61L68 66L72 61L76 66L80 61" {...cutLine(cut, 4)} />
    </>
  ),
  drop: (cut) => (
    <>
      <path d="M50 6Q78 44 78 64A28 28 0 0 1 22 64Q22 44 50 6Z" />
      <path d="M35 64Q35 74 44 79" {...cutLine(cut, 5)} />
    </>
  ),
  wave: (cut) => (
    <>
      <path d="M6 90C10 50 30 14 62 12C80 11 94 22 94 38C86 30 72 30 66 40C60 50 66 62 80 62C86 62 92 58 94 54V90Z" />
      <path d="M20 80C24 56 38 34 58 28" {...cutLine(cut, 5)} />
    </>
  ),
  flame: (cut) => (
    <>
      <path d="M50 4C58 22 78 34 78 60C78 78 66 92 50 92C34 92 22 80 22 62C22 48 30 40 36 32C38 44 42 50 48 52C46 40 44 24 50 4Z" />
      <path d="M50 58C55 64 60 70 60 76C60 82 55 86 50 86C45 86 40 82 40 76C40 70 45 64 50 58Z" fill={cut} />
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
  moon: (cut) => (
    <>
      <path d="M47.9 10.05A40 40 0 1 0 87.1 64.95A34 34 0 1 1 47.9 10.05Z" />
      <circle cx={24} cy={54} r={5} fill={cut} />
      <circle cx={40} cy={76} r={3.5} fill={cut} />
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
  planet: (cut) => (
    <g transform={turn(-20)}>
      <ellipse cx={50} cy={50} rx={47} ry={12} {...line(6)} />
      <circle cx={50} cy={50} r={28} />
      <path d="M3 50A47 12 0 0 0 97 50" fill="none" stroke={cut} strokeWidth={12} />
      <path d="M3 50A47 12 0 0 0 97 50" {...line(6)} />
    </g>
  ),
  // The Atlantic side of the globe: the Americas on the left, Europe and Africa on the right.
  earth: (cut) => (
    <>
      <circle cx={50} cy={50} r={42} fill={cut} />
      <g stroke="currentColor" strokeWidth={3} strokeLinejoin="round">
        <path d="M13 34L18 24L28 18L38 18L45 22L46 28L42 34L40 40L36 42L38 48L40 53L35 51L30 46L24 42L17 40Z" />
        <path d="M40 55L48 54L57 60L54 67L50 73L46 81L43 88L41 81L40 72L37 62Z" />
        <path d="M56 27L59 20L65 16L71 18L75 23L72 29L65 30L59 31Z" />
        <path d="M54 38L62 34L72 35L78 38L83 46L78 50L76 58L72 68L67 76L64 72L62 62L60 56L54 52L51 45Z" />
      </g>
      <circle cx={50} cy={50} r={42} {...line(7)} />
    </>
  ),
  rocket: (cut) => (
    <>
      <path d="M30 50L14 66V86L30 76Z" />
      <path d="M70 50L86 66V86L70 76Z" />
      <path d="M50 4C64 14 70 32 70 52V74H30V52C30 32 36 14 50 4Z" />
      <circle cx={50} cy={40} r={9} fill={cut} />
      <path d="M38 73H62L58 82H42Z" />
      <path d="M43 86Q50 102 57 86Z" />
    </>
  ),
  satellite: (cut) => (
    <g transform={turn(-40)}>
      <rect x={28} y={47} width={44} height={6} />
      <rect x={4} y={32} width={26} height={36} rx={2} />
      <rect x={70} y={32} width={26} height={36} rx={2} />
      <path d="M17 32V68M4 50H30M83 32V68M70 50H96" {...cutLine(cut, 3)} strokeLinecap="butt" />
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
  flask: (cut) => (
    <>
      <path d="M38 8H62M44 8V38L18 82Q14 90 24 90H76Q86 90 82 82L56 38V8" {...line(7)} />
      <path d="M31 60H69L82 82Q86 90 76 90H24Q14 90 18 82Z" />
      <circle cx={42} cy={76} r={4} fill={cut} />
      <circle cx={57} cy={71} r={3} fill={cut} />
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
  cell: (cut) => (
    <>
      <path d="M50 8Q82 8 90 40Q96 70 68 86Q42 98 20 78Q2 58 14 32Q26 8 50 8Z" {...line(7)} />
      <circle cx={54} cy={46} r={15} />
      <circle cx={58} cy={42} r={5} fill={cut} />
      <ellipse cx={30} cy={64} rx={8} ry={5} transform={turn(-20, 30, 64)} />
      <circle cx={70} cy={72} r={5} />
      <circle cx={28} cy={36} r={4} />
    </>
  ),
  virus: (cut) => (
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
      <circle cx={42} cy={44} r={4.5} fill={cut} />
      <circle cx={58} cy={58} r={4} fill={cut} />
      <circle cx={57} cy={40} r={2.5} fill={cut} />
    </>
  ),
  bacteria: (cut) => (
    <>
      <path d="M66 21Q72 13 80 16T93 10M87 74Q93 80 89 87T93 96" {...line(4)} />
      <rect x={10} y={23} width={60} height={26} rx={13} transform={turn(-30, 40, 36)} />
      <rect x={40} y={57} width={48} height={22} rx={11} transform={turn(15, 64, 68)} />
      <circle cx={31.3} cy={41} r={3.5} fill={cut} />
      <circle cx={48.7} cy={31} r={3.5} fill={cut} />
      <circle cx={55.3} cy={65.7} r={3} fill={cut} />
      <circle cx={72.7} cy={70.3} r={3} fill={cut} />
    </>
  ),
  dna: () => (
    <>
      <path d="M32.4 14.6H67.6M32.4 41.4H67.6M32.4 58.6H67.6M32.4 85.4H67.6" {...line(5)} />
      <path d="M30 6C30 28 70 28 70 50C70 72 30 72 30 94M70 6C70 28 30 28 30 50C30 72 70 72 70 94" {...line(8)} />
    </>
  ),
  syringe: (cut) => (
    <g transform={turn(-45)}>
      <rect x={-6} y={36} width={7} height={28} rx={2} />
      <rect x={0} y={46} width={19} height={8} />
      <rect x={18} y={32} width={7} height={36} rx={2} />
      <rect x={24} y={38} width={50} height={24} rx={3} />
      <path d="M38 38V48M48 38V48M58 38V48" {...cutLine(cut, 3)} strokeLinecap="butt" />
      <path d="M73 44L84 46V54L73 56Z" />
      <path d="M84 50H106" {...line(4)} />
    </g>
  ),
  pill: (cut) => (
    <g transform={turn(-45)}>
      <rect x={8} y={32} width={84} height={36} rx={18} />
      <path d="M54 39H74A11 11 0 0 1 74 61H54Z" fill={cut} />
    </g>
  ),
  heart: (cut) => (
    <>
      <path d="M50 88C20 68 6 52 6 34C6 20 18 10 30 10C40 10 46 16 50 24C54 16 60 10 70 10C82 10 94 20 94 34C94 52 80 68 50 88Z" />
      <path d="M18 34Q18 24 28 22" {...cutLine(cut, 5)} />
    </>
  ),
  brain: (cut) => (
    <>
      <path d="M30 20Q14 22 14 40Q6 52 16 64Q16 84 38 82Q44 92 50 86Q56 92 62 82Q84 84 84 64Q94 52 86 40Q86 22 70 20Q60 8 50 18Q40 8 30 20Z" />
      <path
        d="M50 20V84M16 46Q26 44 28 50Q30 56 38 54M30 22Q34 30 30 36M22 72Q30 66 34 72Q36 78 42 76M84 50Q74 50 72 44Q70 38 62 40M70 22Q64 28 70 34M78 70Q70 72 66 66Q62 60 56 64"
        {...cutLine(cut, 4)}
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
  magnet: (cut) => (
    <g transform={turn(45)}>
      <path d="M14 30H38V52A12 12 0 0 0 62 52V30H86V52A36 36 0 0 1 14 52Z" />
      <rect x={14} y={8} width={24} height={17} rx={2} />
      <rect x={62} y={8} width={24} height={17} rx={2} />
      <rect x={19} y={13} width={14} height={7} fill={cut} />
      <rect x={67} y={13} width={14} height={7} fill={cut} />
    </g>
  ),
  bulb: (cut) => (
    <>
      <path d="M50 6C30 6 18 22 18 38C18 52 28 60 33 68V72H67V68C72 60 82 52 82 38C82 22 70 6 50 6Z" />
      <path d="M32 38Q32 24 46 20" {...cutLine(cut, 5)} />
      <rect x={34} y={76} width={32} height={6} rx={3} />
      <rect x={36} y={85} width={28} height={6} rx={3} />
      <rect x={42} y={93} width={16} height={5} rx={2.5} />
    </>
  ),
  gear: (cut) => (
    <>
      {[0, 45, 90, 135].map((a) => (
        <rect key={a} x={41} y={4} width={18} height={92} rx={4} transform={turn(a)} />
      ))}
      <circle cx={50} cy={50} r={33} />
      <circle cx={50} cy={50} r={13} fill={cut} />
    </>
  ),

  // Trade and travel
  gold: (cut) => (
    <>
      <path d="M29 66L35 44H65L71 66Z" />
      <path d="M6 92L12 70H42L48 92Z" />
      <path d="M52 92L58 70H88L94 92Z" />
      <path d="M33 51H67M10 77H44M56 77H90" {...cutLine(cut, 3.5)} />
      <path d="M84 10Q86 20 96 22Q86 24 84 34Q82 24 72 22Q82 20 84 10Z" />
    </>
  ),
  // A stack of coins with one coin standing in front.
  coin: (cut) => (
    <>
      {[74, 62, 50, 38].map((y) => (
        <rect key={y} x={6} y={y} width={46} height={12} rx={6} {...gap(cut, 4)} />
      ))}
      <circle cx={64} cy={54} r={30} {...gap(cut)} />
      <circle cx={64} cy={54} r={21} {...cutLine(cut, 4)} />
    </>
  ),
  money: (cut) => (
    <>
      <rect x={16} y={18} width={78} height={46} rx={5} />
      <rect x={6} y={34} width={80} height={48} rx={5} {...gap(cut)} />
      <circle cx={46} cy={58} r={11} fill={cut} />
      <circle cx={18} cy={46} r={3.5} fill={cut} />
      <circle cx={74} cy={70} r={3.5} fill={cut} />
    </>
  ),
  gem: (cut) => (
    <>
      <path d="M28 14H72L92 38L50 90L8 38Z" />
      <path d="M8 38H92M28 14L38 38L50 14L62 38L72 14M38 38L50 90L62 38" {...cutLine(cut, 4)} />
    </>
  ),
  // A roll of cloth, its end showing the wound layers, with the loose end draped down in soft folds.
  silk: (cut) => (
    <>
      <path d="M20 38H84V46Q82 60 90 72Q96 82 90 92Q82 96 76 88Q68 78 58 82Q46 86 40 76Q34 66 24 64Q18 62 18 52Z" />
      <path d="M38 44Q48 60 66 64M58 44Q68 56 80 60" {...cutLine(cut, 3.5)} />
      <path d="M20 8H84A8 16 0 0 1 84 40H20Z" {...gap(cut, 6)} />
      <ellipse cx={20} cy={24} rx={10} ry={16} {...gap(cut, 5)} />
      <path d="M20 24A2 3.5 0 0 1 22 27.5A4 7 0 0 1 16 24A6.5 11 0 0 1 26.5 24" {...cutLine(cut, 3)} />
    </>
  ),
  // A heap of spice piled to a peak in a bowl, as at a spice market.
  spices: (cut) => (
    <>
      <path d="M14 54Q34 40 44 18Q50 8 56 18Q66 40 86 54Z" />
      <path d="M6 58H94Q92 90 50 92Q8 90 6 58Z" {...gap(cut, 6)} />
      {[
        [42, 42],
        [54, 32],
        [60, 46],
        [34, 51],
        [68, 52],
      ].map(([x, y]) => (
        <circle key={x} cx={x} cy={y} r={2.8} fill={cut} />
      ))}
    </>
  ),
  tea: (cut) => (
    <>
      <path d="M76 48Q92 48 92 62Q92 76 74 78" {...line(7)} />
      <path d="M26 70Q12 68 8 50L4 42L12 42Q16 54 26 56Z" />
      <path d="M22 64C22 46 34 38 50 38C66 38 78 46 78 64C78 78 70 88 62 90H38C30 88 22 78 22 64Z" />
      <path d="M34 34Q36 24 50 24Q64 24 66 34Z" />
      <circle cx={50} cy={20} r={5} />
      <path d="M24 58Q50 66 76 58" {...cutLine(cut, 4)} />
    </>
  ),
  vase: (cut) => (
    <>
      <path d="M40 6H60V11Q55 13 55 19Q55 25 63 30Q82 42 80 62Q78 80 64 88L66 94H34L36 88Q22 80 20 62Q18 42 37 30Q45 25 45 19Q45 13 40 11Z" />
      <path d="M28 42Q50 48 72 42M24 76Q50 82 76 76M24 60Q31 54 38 60T52 60T66 60T80 60" {...cutLine(cut, 4)} />
    </>
  ),
  barrel: (cut) => (
    <>
      <path d="M24 8H76Q88 30 88 50Q88 70 76 92H24Q12 70 12 50Q12 30 24 8Z" />
      <path d="M14 24H86M14 32H86M14 68H86M14 76H86" {...cutLine(cut, 4)} strokeLinecap="butt" />
      <path d="M38 9Q34 50 38 91M62 9Q66 50 62 91" {...cutLine(cut, 3)} />
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
  ship: (cut) => (
    <>
      <rect x={46} y={4} width={5} height={60} />
      <path d="M50 4L66 8L50 12Z" />
      <path d="M30 12H62Q68 20 62 28H30Q36 20 30 12Z" />
      <path d="M22 32H70Q78 44 70 56H22Q30 44 22 32Z" />
      <path d="M4 52H22L26 62H80L96 54L88 78Q84 88 74 88H26Q16 88 12 80L4 62Z" />
      {[34, 50, 66].map((x) => (
        <circle key={x} cx={x} cy={74} r={3.5} fill={cut} />
      ))}
    </>
  ),
  cart: (cut) => (
    <>
      <path d="M70 52L96 60" {...line(6)} />
      <path d="M8 34H76L72 58H12Z" />
      <path d="M10 46H74" {...cutLine(cut, 4)} />
      <circle cx={40} cy={70} r={21} {...gap(cut)} />
      <circle cx={40} cy={70} r={13.5} fill={cut} />
      <path d="M26 70H54M33 57.9L47 82.1M33 82.1L47 57.9" {...line(4)} />
      <circle cx={40} cy={70} r={5} />
    </>
  ),
  train: (cut) => (
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
      <rect x={17} y={32} width={16} height={14} rx={2} fill={cut} />
      <circle cx={24} cy={82} r={11} {...gap(cut, 6)} />
      <circle cx={54} cy={84} r={9} {...gap(cut, 6)} />
      <circle cx={76} cy={84} r={9} {...gap(cut, 6)} />
    </>
  ),
  car: (cut) => (
    <>
      <path d="M4 72V60Q4 52 12 51L26 49L36 34Q39 30 44 30H66Q71 30 74 34L84 49L90 50Q96 52 96 60V72Q96 76 92 76H8Q4 76 4 72Z" />
      <path d="M40 47L47 36H55V47ZM60 47V36H67L74 47Z" fill={cut} />
      <circle cx={26} cy={76} r={11} {...gap(cut)} />
      <circle cx={74} cy={76} r={11} {...gap(cut)} />
      <circle cx={26} cy={76} r={4} fill={cut} />
      <circle cx={74} cy={76} r={4} fill={cut} />
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
  scroll: (cut) => (
    <>
      <rect x={22} y={18} width={56} height={66} />
      <path d="M32 36H68M32 47H68M32 58H58" {...cutLine(cut, 4)} />
      <rect x={14} y={8} width={72} height={14} rx={7} {...gap(cut, 6)} />
      <rect x={14} y={80} width={72} height={14} rx={7} {...gap(cut, 6)} />
    </>
  ),
  book: (cut) => (
    <>
      <path d="M6 24Q26 14 47 24V88Q26 78 6 88Z" />
      <path d="M53 24Q74 14 94 24V88Q74 78 53 88Z" />
      <path
        d="M14 38Q26 33 39 38M14 50Q26 45 39 50M14 62Q26 57 39 62M61 38Q74 33 86 38M61 50Q74 45 86 50M61 62Q74 57 86 62"
        {...cutLine(cut, 4)}
      />
    </>
  ),
  letter: (cut) => (
    <>
      <rect x={8} y={20} width={84} height={60} rx={6} />
      <path d="M13 26L50 54L87 26" {...cutLine(cut, 5)} />
      <circle cx={50} cy={54} r={8} {...gap(cut, 5)} />
    </>
  ),
  newspaper: (cut) => (
    <>
      <rect x={10} y={12} width={80} height={76} rx={4} />
      <rect x={18} y={20} width={64} height={11} rx={2} fill={cut} />
      <rect x={18} y={39} width={28} height={22} rx={2} fill={cut} />
      <path d="M54 42H82M54 51H82M54 60H82M18 70H82M18 79H70" {...cutLine(cut, 4)} />
    </>
  ),
  map: (cut) => (
    <>
      <path d="M8 22L34 12L66 22L92 12V78L66 88L34 78L8 88Z" />
      <path d="M34 12V78M66 22V88" {...cutLine(cut, 4)} />
      <path d="M18 68Q28 42 44 52T76 34" fill="none" stroke={cut} strokeWidth={4} strokeDasharray="6 5" />
      <circle cx={80} cy={31} r={5} fill={cut} />
    </>
  ),
  compass: (cut) => (
    <>
      <circle cx={50} cy={50} r={41} {...line(7)} />
      <g transform={turn(45)}>
        <path d="M50 16L63 50L50 84L37 50Z" />
        <path d="M44.5 55H55.5L50 72Z" fill={cut} />
      </g>
      <circle cx={50} cy={50} r={3.5} fill={cut} />
    </>
  ),
  clock: (cut) => (
    <>
      <circle cx={50} cy={50} r={42} />
      <path d="M50 24V50L66 60" {...cutLine(cut, 7)} />
      {[0, 90, 180, 270].map((a) => (
        <circle key={a} cx={50} cy={15} r={3.5} fill={cut} transform={turn(a)} />
      ))}
    </>
  ),
  calendar: (cut) => (
    <>
      <rect x={10} y={14} width={80} height={78} rx={8} />
      <rect x={10} y={34} width={80} height={5} fill={cut} />
      {[22, 44, 66].map((x) => (
        <g key={x}>
          <rect x={x} y={48} width={12} height={11} rx={2} fill={cut} />
          <rect x={x} y={68} width={12} height={11} rx={2} fill={cut} />
        </g>
      ))}
      <rect x={26} y={6} width={9} height={20} rx={4.5} {...gap(cut, 6)} />
      <rect x={65} y={6} width={9} height={20} rx={4.5} {...gap(cut, 6)} />
    </>
  ),
  phone: (cut) => (
    <>
      <path d="M10 36Q10 16 50 16Q90 16 90 36V40Q90 44 86 44H70Q66 44 66 40V36Q66 30 50 30Q34 30 34 36V40Q34 44 30 44H14Q10 44 10 40Z" />
      <path d="M20 52H80L90 88Q91 92 86 92H14Q9 92 10 88Z" />
      <circle cx={50} cy={71} r={14} fill={cut} />
      <circle cx={50} cy={71} r={6} />
    </>
  ),
  computer: (cut) => (
    <>
      <rect x={6} y={12} width={88} height={60} rx={6} />
      <rect x={13} y={19} width={74} height={46} rx={2} fill={cut} />
      <path d="M42 71H58L62 85H38Z" />
      <rect x={26} y={84} width={48} height={8} rx={4} />
    </>
  ),
  radio: (cut) => (
    <>
      <path d="M64 32L82 9" {...line(5)} />
      <circle cx={83} cy={8} r={4.5} />
      <rect x={8} y={32} width={84} height={58} rx={8} />
      <path d="M18 46H50M18 56H50M18 66H50M18 76H50" {...cutLine(cut, 5)} />
      <circle cx={72} cy={54} r={9} fill={cut} />
      <circle cx={72} cy={54} r={3} />
      <rect x={63} y={70} width={7} height={9} rx={2} fill={cut} />
      <rect x={75} y={70} width={7} height={9} rx={2} fill={cut} />
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
  warning: (cut) => (
    <>
      <path d="M50 10L92 86H8Z" stroke="currentColor" strokeWidth={8} strokeLinejoin="round" />
      <rect x={45} y={36} width={10} height={28} rx={5} fill={cut} />
      <circle cx={50} cy={74} r={5.5} fill={cut} />
    </>
  ),
  lock: (cut) => (
    <>
      <path d="M32 46V32A18 18 0 0 1 68 32V46" {...line(10)} />
      <rect x={18} y={44} width={64} height={48} rx={8} />
      <circle cx={50} cy={63} r={7} fill={cut} />
      <rect x={46.5} y={63} width={7} height={16} rx={3} fill={cut} />
    </>
  ),
  key: (cut) => (
    <g transform={turn(-45)}>
      <circle cx={16} cy={50} r={19} />
      <circle cx={16} cy={50} r={8} fill={cut} />
      <rect x={30} y={44} width={74} height={12} rx={3} />
      <rect x={80} y={54} width={9} height={14} rx={2} />
      <rect x={92} y={54} width={9} height={18} rx={2} />
    </g>
  ),
};

// An icon from lib/icons.ts at the given size. An unknown name draws a dot, so a bad name never breaks a scene.
export function Icon({ name, size, color, cut = "#0F1B2D" }: { name: string; size: number; color: string; cut?: string }) {
  const shape = isIconName(name) ? SHAPES[name] : undefined;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill={color} color={color} style={{ display: "block", overflow: "visible" }}>
      {shape ? shape(cut) : <circle cx={50} cy={50} r={30} />}
    </svg>
  );
}
