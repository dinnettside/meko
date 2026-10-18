import { yearsIn } from "@/lib/numbers";
import { NoteMarks, noteStyle } from "./cards";
import { formatYears } from "./format";
import { useEase } from "./motion";
import { useTheme } from "./theme";

// The year the scene is about, in the top left corner, when its narration names one: where the story is in time.
// A scene that names several years shows the span. Nothing is carried over from the scene before.
export function YearMark({ narration }: { narration: string }) {
  const theme = useTheme();
  const { colors, fonts } = theme;
  const appear = useEase(0.3, 0.6);
  const years = yearsIn(narration);
  if (years.length === 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        top: 40,
        left: 56,
        padding: "4px 20px 8px",
        backgroundColor: colors.captionBackground,
        fontFamily: fonts.year.family,
        fontSize: 48,
        fontWeight: fonts.year.weight,
        color: colors.captionText,
        opacity: appear,
        ...noteStyle(theme),
      }}
    >
      {formatYears(Math.min(...years), Math.max(...years))}
      <NoteMarks />
    </div>
  );
}
