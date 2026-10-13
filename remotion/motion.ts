import { Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

// Goes from 0 to 1 between `startSec` and `startSec + durationSec` into the scene, easing out.
export function ease(frame: number, fps: number, startSec: number, durationSec: number): number {
  return interpolate(frame, [startSec * fps, (startSec + durationSec) * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
}

export function useEase(startSec: number, durationSec: number): number {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return ease(frame, fps, startSec, durationSec);
}
