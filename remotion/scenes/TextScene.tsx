import { AbsoluteFill } from "remotion";
import { useEase } from "../motion";
import { CAPTION_SPACE, COLORS, FONTS } from "../theme";

// Up to three short lines. The first is the key point: bigger, brighter and marked in amber.
export function TextScene({ lines }: { lines: string[] }) {
  return (
    <AbsoluteFill style={{ justifyContent: "center", padding: `0 220px ${CAPTION_SPACE}px` }}>
      {lines.map((line, index) => (
        <Line key={index} text={line} index={index} />
      ))}
    </AbsoluteFill>
  );
}

function Line({ text, index }: { text: string; index: number }) {
  const progress = useEase(0.2 + index * 0.6, 0.6);
  const isKey = index === 0;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 40,
        marginBottom: isKey ? 56 : 36,
        opacity: progress,
        transform: `translateX(${(progress - 1) * 40}px)`,
      }}
    >
      <div style={{ width: 12, alignSelf: "stretch", backgroundColor: isKey ? COLORS.signal : "transparent" }} />
      <div
        style={{
          fontFamily: isKey ? FONTS.display : FONTS.body,
          fontSize: isKey ? 96 : 64,
          fontWeight: isKey ? 700 : 500,
          lineHeight: 1.12,
          color: isKey ? COLORS.paper : COLORS.dim,
        }}
      >
        {text}
      </div>
    </div>
  );
}
