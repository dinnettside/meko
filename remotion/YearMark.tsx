import { yearsIn } from "@/lib/numbers";
import { COLORS, FONTS } from "@/lib/theme";
import { formatYears } from "./format";
import { useEase } from "./motion";

// The year the scene is about, in the top left corner, when its narration names one: where the story is in time.
// A scene that names several years shows the span. Nothing is carried over from the scene before.
export function YearMark({ narration }: { narration: string }) {
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
        backgroundColor: COLORS.captionBackground,
        fontFamily: FONTS.display,
        fontSize: 48,
        fontWeight: 700,
        color: COLORS.paper,
        opacity: appear,
      }}
    >
      {formatYears(Math.min(...years), Math.max(...years))}
    </div>
  );
}
