import { NoteMarks, noteStyle } from "./cards";
import { useEase } from "./motion";
import { useTheme } from "./theme";

export { sceneSites } from "./sites";

// A small, calm note in the top right corner: where what the narration says comes from.
export function SourceChip({ sites }: { sites: string[] }) {
  const theme = useTheme();
  const { colors, fonts } = theme;
  const appear = useEase(0.8, 0.6);
  if (sites.length === 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        top: 48,
        right: 56,
        padding: "10px 20px",
        backgroundColor: colors.captionBackground,
        fontFamily: fonts.label,
        fontSize: 28,
        color: colors.dim,
        opacity: appear,
        ...noteStyle(theme),
      }}
    >
      {sites.length > 1 ? "Sources" : "Source"}: <span style={{ color: colors.captionText }}>{sites.join(" · ")}</span>
      <NoteMarks />
    </div>
  );
}
