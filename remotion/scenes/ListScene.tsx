import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { TimedWord } from "@/lib/elevenlabs";
import { VIDEO } from "@/lib/theme";
import { CardMarks, cardFill, drawnCard } from "../cards";
import { Icon } from "../icons";
import { ease } from "../motion";
import { revealTimes } from "../spoken";
import { useTheme } from "../theme";

const GAP = 40;
const CARD_HEIGHT = 300;

// Two to four things of one kind side by side, like types, goods or effects. Each card comes in as the narration
// names it, and the newest gets the amber rule. There are no arrows and no numbers, because the items do not lead
// to each other: that is what steps are for.
//
// As the last scene, the list sums up the video, and each card gets a check mark as it comes in. A card can show an
// icon above its title, like gold bars for "Gold". In Blueprint the newest card's chalk frame turns yellow instead of
// getting a rule; in Field guide the cards are tags with a punched hole.
export function ListScene({
  items,
  words,
  durationSec,
  summary = false,
}: {
  items: { title: string; detail?: string; icon?: string }[];
  words: TimedWord[];
  durationSec: number;
  summary?: boolean;
}) {
  const theme = useTheme();
  const { colors, fonts, drawing } = theme;
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const usable = VIDEO.width - 2 * VIDEO.sideMargin;
  const cardWidth = (usable - GAP * (items.length - 1)) / items.length;
  const starts = revealTimes(
    items.map((item) => `${item.title} ${item.detail ?? ""}`),
    words,
    { firstSec: 0.3, spreadSec: Math.max(0.8, durationSec * 0.7), gapSec: 0.5, durationSec },
  );
  const time = frame / fps;
  const newest = starts.reduce((latest, start, index) => (time >= start ? index : latest), 0);
  // The longest word has to fit on one line of its card, so long words get smaller type instead of breaking.
  const longestWord = Math.max(...items.flatMap((item) => item.title.split(/\s+/).map((word) => word.length)));
  const textWidth = cardWidth - 64 - (summary ? 64 : 0);
  const titleSize = Math.min(items.length > 3 ? 58 : 70, Math.floor(textWidth / (longestWord * 0.6)));
  const iconSize = Math.min(140, Math.round(cardWidth * 0.36));

  return (
    <AbsoluteFill style={{ justifyContent: "center", padding: `${VIDEO.topSpace}px ${VIDEO.sideMargin}px ${VIDEO.captionSpace}px` }}>
      {/* The cards stretch to the tallest one, so a long detail makes the whole row taller instead of spilling out. */}
      <div style={{ display: "flex", alignItems: "stretch", gap: GAP }}>
        {items.map((item, index) => {
          const appear = ease(frame, fps, starts[index], 0.5);
          const rule = ease(frame, fps, starts[index] + 0.1, 0.5);
          const check = ease(frame, fps, starts[index] + 0.35, 0.3);
          const isNewest = index === newest;
          const edgeColor = isNewest ? colors.signal : undefined;
          return (
            <div
              key={index}
              style={{
                width: cardWidth,
                minHeight: CARD_HEIGHT,
                padding: "40px 32px",
                ...(drawing.card === "solid" ? { backgroundColor: colors.land } : drawnCard(theme, edgeColor)),
                opacity: appear,
                transform: `translateY(${(1 - appear) * 30}px)`,
                position: "relative",
              }}
            >
              {drawing.card !== "outline" ? (
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    height: 10,
                    width: `${rule * 100}%`,
                    backgroundColor: isNewest ? colors.signal : colors.border,
                  }}
                />
              ) : null}
              <CardMarks edgeColor={edgeColor} hole />
              {summary ? (
                <div
                  style={{
                    position: "absolute",
                    top: 28,
                    right: 28,
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    backgroundColor: colors.teal,
                    color: colors.onSignal,
                    fontSize: 38,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: check,
                    transform: `scale(${1.4 - 0.4 * check})`,
                  }}
                >
                  ✓
                </div>
              ) : null}
              {item.icon ? (
                <div style={{ marginBottom: 22, transform: `scale(${0.8 + 0.2 * appear})`, transformOrigin: "left bottom" }}>
                  <Icon name={item.icon} size={iconSize} color={isNewest ? colors.signal : colors.paper} cut={cardFill(theme)} />
                </div>
              ) : null}
              <div
                style={{
                  fontFamily: fonts.display,
                  fontSize: titleSize * fonts.displayScale,
                  fontWeight: fonts.displayWeight,
                  lineHeight: 1.05,
                  paddingRight: summary ? 64 : 0,
                  color: isNewest ? colors.signal : colors.paper,
                }}
              >
                {item.title}
              </div>
              {item.detail ? (
                <div style={{ marginTop: 24, fontFamily: fonts.body, fontSize: 40, lineHeight: 1.2, color: colors.dim }}>
                  {item.detail}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}
