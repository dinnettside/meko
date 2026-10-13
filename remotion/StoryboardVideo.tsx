import { AbsoluteFill, Html5Audio, Series, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { TimedWord } from "@/lib/elevenlabs";
import type { Scene, Storyboard } from "@/lib/storyboard";
import type { SceneVoice } from "@/lib/voice";

// Plays a storyboard. The look is neutral on purpose until the design direction is picked.

export function sceneFrames(scene: Scene, fps: number): number {
  return Math.max(1, Math.round(scene.durationSec * fps));
}

export function storyboardFrames(storyboard: Storyboard): number {
  return storyboard.scenes.reduce((total, scene) => total + sceneFrames(scene, storyboard.fps), 0);
}

// `voice` holds the recorded narration by scene ID. Without it, the video plays silently with captions.
export function StoryboardVideo({ storyboard, voice = {} }: { storyboard: Storyboard; voice?: Record<string, SceneVoice> }) {
  return (
    <AbsoluteFill style={{ backgroundColor: "white", color: "#111", fontFamily: "Arial, Helvetica, sans-serif" }}>
      <Series>
        {storyboard.scenes.map((scene) => (
          <Series.Sequence key={scene.id} durationInFrames={sceneFrames(scene, storyboard.fps)}>
            <SceneView scene={scene} />
            <Caption words={voice[scene.id]?.words ?? estimateWords(scene.narration, scene.durationSec)} />
            {voice[scene.id] ? <Html5Audio src={voice[scene.id].audio} /> : null}
          </Series.Sequence>
        ))}
      </Series>
    </AbsoluteFill>
  );
}

function SceneView({ scene }: { scene: Scene }) {
  if (scene.kind === "title") return <TitleScene heading={scene.heading} subheading={scene.subheading} />;
  if (scene.kind === "text") return <TextScene lines={scene.lines} />;
  // Map and timeline scenes come in Phase 2. Until then they show their narration.
  return <TextScene lines={[scene.narration]} />;
}

// Fades in and slides up over half a second, starting `delaySec` into the scene.
function useEntrance(delaySec: number) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = interpolate(frame, [delaySec * fps, (delaySec + 0.5) * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return { opacity: progress, transform: `translateY(${(1 - progress) * 40}px)` };
}

function TitleScene({ heading, subheading }: { heading: string; subheading?: string }) {
  const headingStyle = useEntrance(0.2);
  const subheadingStyle = useEntrance(0.7);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: "0 160px 200px" }}>
      <div style={{ ...headingStyle, fontSize: 110, fontWeight: 700, lineHeight: 1.1, textAlign: "center" }}>
        {heading}
      </div>
      {subheading ? (
        <div style={{ ...subheadingStyle, fontSize: 56, marginTop: 40, color: "#444", textAlign: "center" }}>
          {subheading}
        </div>
      ) : null}
    </AbsoluteFill>
  );
}

function TextScene({ lines }: { lines: string[] }) {
  return (
    <AbsoluteFill style={{ justifyContent: "center", padding: "0 200px 200px" }}>
      {lines.map((line, index) => (
        <Line key={index} text={line} delaySec={0.2 + index * 0.5} />
      ))}
    </AbsoluteFill>
  );
}

function Line({ text, delaySec }: { text: string; delaySec: number }) {
  const style = useEntrance(delaySec);
  return <div style={{ ...style, fontSize: 80, fontWeight: 700, lineHeight: 1.2, marginBottom: 36 }}>{text}</div>;
}

// Without recorded timings, spread the words evenly over the scene, leaving a short pause at the end.
function estimateWords(narration: string, durationSec: number): TimedWord[] {
  const texts = narration.split(/\s+/).filter(Boolean);
  const step = Math.max(0.5, durationSec - 0.6) / Math.max(1, texts.length);
  return texts.map((text, index) => ({ text, start: index * step, end: (index + 1) * step }));
}

type CaptionLine = { words: TimedWord[]; start: number };

// Short caption lines: at most 7 words, a new line after each sentence, and after a comma once a line has 4 words.
function captionLines(words: TimedWord[]): CaptionLine[] {
  const lines: CaptionLine[] = [];
  let current: TimedWord[] = [];
  for (const word of words) {
    current.push(word);
    const endsSentence = /[.!?]["')]?$/.test(word.text);
    const endsClause = /[,;:]$/.test(word.text) && current.length >= 4;
    if (current.length === 7 || endsSentence || endsClause) {
      lines.push({ words: current, start: current[0].start });
      current = [];
    }
  }
  if (current.length > 0) lines.push({ words: current, start: current[0].start });
  return lines;
}

// Shows the line being spoken. Words light up as the voice says them.
function Caption({ words }: { words: TimedWord[] }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const time = frame / fps;
  const lines = captionLines(words);
  const line = lines.findLast((candidate) => candidate.start <= time) ?? lines[0];
  if (!line) return null;
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 140 }}>
      <div
        style={{
          maxWidth: 1600,
          padding: "16px 32px",
          backgroundColor: "rgba(0, 0, 0, 0.78)",
          fontSize: 52,
          lineHeight: 1.3,
          textAlign: "center",
        }}
      >
        {line.words.map((word, index) => (
          <span key={index} style={{ color: word.start <= time ? "white" : "rgba(255, 255, 255, 0.45)" }}>
            {index > 0 ? " " : ""}
            {word.text}
          </span>
        ))}
      </div>
    </AbsoluteFill>
  );
}
