import { AbsoluteFill, Easing, interpolate, interpolateColors, useCurrentFrame, useVideoConfig } from "remotion";
import type { TimedWord } from "@/lib/elevenlabs";
import type { FigureLook } from "@/lib/storyboard";
import { VIDEO } from "@/lib/theme";
import { FIGURE_ASPECT, Figure } from "../figures";
import { ease } from "../motion";
import { revealTimes } from "../spoken";
import { useTheme } from "../theme";

const GAP = 56; // between two people
// The free room between the notes in the top corners and the captions, inside the side margins.
const ROOM_WIDTH = VIDEO.width - 2 * VIDEO.sideMargin;
const ROOM_HEIGHT = VIDEO.height - VIDEO.topSpace - VIDEO.captionSpace;
const LONE_WIDTH = 900; // a lone person's name wraps within this width instead of running across the screen
const SLOT_MAX = 640; // two people stand this close, not at the far edges
const NAME_GAP = 26; // from the feet to the name
const ROLE_GAP = 10; // from the name to the role
// Sizes by how many people stand side by side: one, two, three or four.
const FIGURE_SIZES = [470, 450, 420, 390];
const NAME_SIZES = [96, 84, 72, 62];
const ROLE_SIZES = [46, 44, 40, 36];
const MIN_FIGURE = 240; // below this a figure gets lost under its text, so the whole row is drawn smaller instead

const POP_SEC = 0.5;
const NAME_DELAY_SEC = 0.15;
const NAME_SEC = 0.4;
// Everyone is in place this long before the scene ends, as the next scene dissolves in over the end.
const SETTLED_SEC = 0.8;

// How wide text is, in em per character, since it cannot be measured here. Names in Fraunces at these sizes run
// about 0.5 to 0.56 em per character, and a wide word like "Commander" up to 0.66.
const TEXT_EM = 0.56;
const WIDE_WORD_EM = 0.66;

// About how many lines a text wraps to in a box `width` wide.
function linesOf(text: string, fontSize: number, width: number): number {
  const charWidth = fontSize * TEXT_EM;
  let lines = 1;
  let used = 0;
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = used === 0 ? word.length * charWidth : used + (word.length + 1) * charWidth;
    if (used > 0 && next > width) {
      lines += 1;
      used = word.length * charWidth;
    } else used = next;
  }
  return lines;
}

const longestWord = (texts: string[]) => Math.max(1, ...texts.flatMap((text) => text.split(/\s+/).map((word) => word.length)));

// One size for all the names: the biggest allowed, or a little smaller (down to three quarters of it) when that puts
// every name on one line, or else on two.
function nameSizeFor(names: string[], biggest: number, width: number): number {
  const sizes: number[] = [];
  for (let size = biggest; size >= biggest * 0.75; size -= 1) sizes.push(size);
  const fitsIn = (lines: number) => sizes.find((size) => names.every((name) => linesOf(name, size, width) <= lines));
  return fitsIn(1) ?? fitsIn(2) ?? biggest;
}

// The people the narration names, side by side as simple figures, each with the name under it and the role
// smaller under that. Each figure pops in as the narration names the person, and the newest is amber.
export function PeopleScene({
  people,
  words,
  durationSec,
}: {
  people: { name: string; role?: string; look: FigureLook; prop?: string }[];
  words: TimedWord[];
  durationSec: number;
}) {
  const { colors, fonts } = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const time = frame / fps;
  const count = Math.max(1, people.length);
  const sizes = Math.min(count, FIGURE_SIZES.length) - 1;
  const slotWidth = count === 1 ? LONE_WIDTH : Math.min(SLOT_MAX, (ROOM_WIDTH - GAP * (count - 1)) / count);

  // One size for all names and one for all roles, small enough that the longest word fits on a line of its own.
  // Roles stay smaller than the names they belong to.
  const names = people.map((person) => person.name);
  const wordFit = (texts: string[]) => Math.floor(slotWidth / (longestWord(texts) * WIDE_WORD_EM));
  const nameSize = nameSizeFor(names, Math.min(NAME_SIZES[sizes], wordFit(names)), slotWidth);
  const roleSize = Math.min(ROLE_SIZES[sizes], wordFit(people.map((person) => person.role ?? "")), Math.round(nameSize * 0.8));
  // The figures get what is left of the room under the tallest name and role.
  const textHeight = Math.max(
    0,
    ...people.map(
      (person) =>
        linesOf(person.name, nameSize, slotWidth) * nameSize * 1.05 +
        (person.role ? ROLE_GAP + linesOf(person.role, roleSize, slotWidth) * roleSize * 1.2 : 0),
    ),
  );
  const figureSize = Math.max(MIN_FIGURE, Math.min(FIGURE_SIZES[sizes], ROOM_HEIGHT - NAME_GAP - textHeight, slotWidth / FIGURE_ASPECT));
  // A row that is still too tall is drawn smaller, so it stays clear of the notes in the corners and the captions.
  const fit = Math.min(1, ROOM_HEIGHT / (figureSize + NAME_GAP + textHeight));

  // Each person comes in as the narration says the name, and is in place before the scene ends.
  const latest = Math.max(0.3, durationSec - SETTLED_SEC - NAME_DELAY_SEC - NAME_SEC);
  const starts = revealTimes(
    names,
    words,
    { firstSec: 0.3, spreadSec: Math.max(0.8, durationSec * 0.6), gapSec: 0.45, durationSec },
  ).map((start) => Math.min(start, latest));

  return (
    <AbsoluteFill style={{ justifyContent: "center", padding: `${VIDEO.topSpace}px ${VIDEO.sideMargin}px ${VIDEO.captionSpace}px` }}>
      <div style={{ display: "flex", justifyContent: "center", alignItems: "flex-start", gap: GAP, transform: `scale(${fit})` }}>
        {people.map((person, index) => {
          const start = starts[index];
          const appear = ease(frame, fps, start, 0.2);
          // The figure grows from its feet and overshoots a little, like a pop.
          const pop = interpolate(frame, [start * fps, (start + POP_SEC) * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.out(Easing.back(1.7)),
          });
          const nameIn = ease(frame, fps, start + NAME_DELAY_SEC, NAME_SEC);
          // Amber while this is the newest person, then calm once the next one is named.
          const next = starts[index + 1];
          const highlight = next === undefined ? 1 : 1 - ease(frame, fps, next, 0.35);
          const color = interpolateColors(highlight, [0, 1], [colors.paper, colors.signal]);
          return (
            <div key={index} style={{ width: slotWidth, display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ opacity: appear, transform: `scale(${0.5 + 0.5 * pop})`, transformOrigin: "50% 100%" }}>
                <Figure look={person.look} size={figureSize} color={color} prop={person.prop} t={Math.max(0, time - start)} />
              </div>
              <div
                style={{
                  marginTop: NAME_GAP,
                  width: "100%",
                  textAlign: "center",
                  overflowWrap: "break-word",
                  opacity: nameIn,
                  transform: `translateY(${(1 - nameIn) * 16}px)`,
                }}
              >
                <div style={{ fontFamily: fonts.display, fontSize: nameSize * fonts.displayScale, fontWeight: fonts.displayWeight, lineHeight: 1.05, color }}>
                  {person.name}
                </div>
                {person.role ? (
                  <div style={{ marginTop: ROLE_GAP, fontFamily: fonts.body, fontSize: roleSize, fontWeight: 500, lineHeight: 1.2, color: colors.dim }}>
                    {person.role}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}
