// Diagonal lines over an area, the way a technical drawing marks a part: Blueprint marks highlighted countries and
// seas with them instead of filling them. An SVG pattern, to use as fill={`url(#${id})`}. `zoom` is the scale of the
// camera the area is drawn under, so the lines keep the same spacing on screen however close the camera is.
const SPACING = 12;
const WIDTH = 3;

export function Hatch({ id, color, background, zoom = 1 }: { id: string; color: string; background: string; zoom?: number }) {
  return (
    <pattern id={id} width={SPACING} height={SPACING} patternUnits="userSpaceOnUse" patternTransform={`scale(${1 / zoom}) rotate(45)`}>
      <rect width={SPACING} height={SPACING} fill={background} />
      <path d={`M${WIDTH / 2} 0V${SPACING}`} stroke={color} strokeWidth={WIDTH} />
    </pattern>
  );
}
