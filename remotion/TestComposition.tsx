import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

// Neutral test video: one line of text that fades in over 3 seconds.
export function TestComposition() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = interpolate(frame, [0, 3 * fps], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "white",
        color: "black",
        fontFamily: "sans-serif",
        fontSize: 120,
      }}
    >
      <div style={{ opacity }}>Hello from Meko</div>
    </AbsoluteFill>
  );
}
