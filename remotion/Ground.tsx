import { useId } from "react";
import { VIDEO } from "@/lib/theme";
import { alpha, useTheme } from "./theme";

// The grain of the paper in Field guide: faint specks and short fibres on a tile that repeats. They are scattered once,
// the same way every time, so the paper never flickers from frame to frame.
const GRAIN_TILE = 320;
const GRAIN = (() => {
  let seed = 7;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  let specks = "";
  let fibres = "";
  for (let index = 0; index < 260; index++) {
    const [x, y] = [random() * GRAIN_TILE, random() * GRAIN_TILE];
    if (index % 3 === 0) {
      const angle = random() * Math.PI;
      const length = 3 + random() * 6;
      fibres += `M${x.toFixed(1)} ${y.toFixed(1)}l${(Math.cos(angle) * length).toFixed(1)} ${(Math.sin(angle) * length).toFixed(1)}`;
    } else {
      const r = (0.5 + random() * 0.9).toFixed(2);
      specks += `M${(x - Number(r)).toFixed(1)} ${y.toFixed(1)}a${r} ${r} 0 1 0 ${2 * Number(r)} 0a${r} ${r} 0 1 0 ${-2 * Number(r)} 0`;
    }
  }
  return { specks, fibres };
})();

// The ground behind every scene. It stays still while the scene's camera moves, and each scene draws its own, so a
// scene coming in covers the one before it: plain ink in Night atlas, a drawing grid in Blueprint, and paper with a
// faint grain and slightly darker edges in Field guide.
export function Ground() {
  const { colors, drawing } = useTheme();
  const id = useId().replace(/[^A-Za-z0-9]/g, "");
  const { width, height } = VIDEO;
  if (drawing.texture === "grid") {
    // Thin lines every 48 px and stronger ones every 240 px. The strong lines are set so one runs across the middle.
    return (
      <svg width={width} height={height} style={{ position: "absolute", left: 0, top: 0 }}>
        <defs>
          <pattern id={`${id}fine`} width={48} height={48} y={60} patternUnits="userSpaceOnUse">
            <path d="M0 0.5H48M0.5 0V48" fill="none" stroke={alpha(colors.border, 0.35)} strokeWidth={1} />
          </pattern>
          <pattern id={`${id}strong`} width={240} height={240} y={60} patternUnits="userSpaceOnUse">
            <path d="M0 1H240M1 0V240" fill="none" stroke={alpha(colors.border, 0.6)} strokeWidth={2} />
          </pattern>
        </defs>
        <rect width={width} height={height} fill={`url(#${id}fine)`} />
        <rect width={width} height={height} fill={`url(#${id}strong)`} />
      </svg>
    );
  }
  if (drawing.texture === "paper") {
    return (
      <svg width={width} height={height} style={{ position: "absolute", left: 0, top: 0 }}>
        <defs>
          <pattern id={`${id}grain`} width={GRAIN_TILE} height={GRAIN_TILE} patternUnits="userSpaceOnUse">
            <path d={GRAIN.specks} fill={alpha(colors.dim, 0.08)} />
            <path d={GRAIN.fibres} fill="none" stroke={alpha(colors.dim, 0.06)} strokeWidth={1} strokeLinecap="round" />
          </pattern>
          <radialGradient id={`${id}edges`} cx="50%" cy="50%" r="72%">
            <stop offset="55%" stopColor={colors.dim} stopOpacity={0} />
            <stop offset="100%" stopColor={colors.dim} stopOpacity={0.13} />
          </radialGradient>
        </defs>
        <rect width={width} height={height} fill={`url(#${id}grain)`} />
        <rect width={width} height={height} fill={`url(#${id}edges)`} />
      </svg>
    );
  }
  return null;
}
