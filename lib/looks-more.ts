import type { Look, LookContext } from "./looks.ts";
import type { Scene } from "./storyboard.ts";

// More looks for the kinds of scene almost every video has, drawn by the templates in
// remotion/filmmotor/templates/looks-more.js. Like the looks in looks.ts, a look only redraws what the scene already
// shows, after the same checks; it adds no text or number of its own beyond fixed words like "Source".
export function moreLooksFor(scene: Scene, context: LookContext): Look[] {
  switch (scene.kind) {
    case "quote": {
      // Both have room for about five lines of a quote.
      if (scene.text.length > 180) return [];
      const params = { quote: scene.text, source: context.sourceTitle ?? "" };
      return [
        { template: "pull_quote", params },
        { template: "quote_marks_big", params },
      ];
    }
    case "list": {
      // A title and its detail longer than about 55 letters get small in a tile, as in a bullet list (looks.ts).
      if (scene.items.some((item) => (item.detail ? `${item.title}: ${item.detail}` : item.title).length > 55)) return [];
      // Icons only when every item has one, so the tiles match.
      const icons = scene.items.every((item) => item.icon);
      const items = scene.items.map(({ title, detail, icon }) => ({ title, ...(detail ? { detail } : {}), ...(icons ? { icon } : {}) }));
      const count = scene.items.length;
      return [
        ...(count >= 2 && count <= 4 ? [{ template: "tile_grid", params: { items } }] : []),
        // Numbers would say the items come in an order. As the last scene they only count the points the video made, as
        // the key takeaways in looks.ts do.
        ...(context.isLast && count >= 2 && count <= 6 ? [{ template: "numbered_rows", params: { items: items.map(({ title, detail }) => ({ title, ...(detail ? { detail } : {}) })) } }] : []),
      ];
    }
    case "text": {
      const lines = scene.lines.map((line) => line.trim()).filter(Boolean);
      if (lines.length === 1) {
        const text = lines[0];
        // A sentence of up to about two lines of big type, typed out without a highlight. Code cannot tell which words
        // of a sentence are its claim: a negation, a hedge, a source, an exception or a second number often sits
        // outside the words it would mark ("All but 3 of the 12 crew survived"), and the highlight would then say
        // something the sentence does not. So marker_statement is only for a highlight a person or a model has chosen.
        if (text.length > 120 || text.split(/\s+/).length < 2) return [];
        return [{ template: "typewriter_statement", params: { text } }];
      }
      // A few short lines are typed one under the other, the first one brighter, as in the scene's own drawing.
      return lines.length <= 3 && lines.every((line) => line.length <= 48) ? [{ template: "typewriter_statement", params: { text: lines.join("\n") } }] : [];
    }
    case "steps": {
      const count = scene.steps.length;
      if (count < 2 || count > 6) return [];
      const icons = scene.icons ?? [];
      const nodes = scene.steps.map((text, index) => ({ text, ...(icons.length === count && icons.every(Boolean) ? { icon: icons[index] } : {}) }));
      // A road gives each stop's words room above or below it, a stair only its own step's width: fewer and shorter
      // steps fit there. A step is 1440 / count pixels wide, less a margin, and all the labels get one size, so one word
      // too long for its step would shrink them all: a word takes up to about 20 pixels a letter at the smallest size in
      // the widest look.
      const longest = Math.max(...scene.steps.map((step) => step.length));
      const longestWord = Math.max(...scene.steps.flatMap((step) => step.split(/\s+/).map((word) => word.length)));
      const stair = longest <= (count <= 3 ? 48 : count === 4 ? 36 : 26) && longestWord <= Math.floor((1440 / count - 30) / 20);
      // A road's label may be as wide as two stops' share of 1560 pixels, less a margin, up to 560.
      const road = longest <= 48 && longestWord <= Math.floor(Math.min(560, (2 * 1560) / count - 50) / 20);
      return [
        ...(stair ? [{ template: "stair_steps", params: { nodes } }] : []),
        ...(road ? [{ template: "road_path", params: { nodes } }] : []),
      ];
    }
    case "stat": {
      // The same number as the big number in looks.ts: not a range, not a share of a total, and up to nine figures.
      if (scene.valueMax !== undefined || scene.total !== undefined || !Number.isFinite(scene.value) || Math.abs(scene.value) >= 1e9) return [];
      // A number JavaScript writes with an exponent, like 5e-7, has no decimals to count, and would roll up to 0.
      const decimals = decimalsOf(scene.value);
      if (decimals > 2 || /e/i.test(String(scene.value))) return [];
      // The number as the narration writes it ("650", "1,500"), so the wheels land as it is said.
      const said = [String(scene.value), scene.value.toLocaleString("en-US", { maximumFractionDigits: 2 })].find((form) =>
        new RegExp(`(?<![\\d.,])${form.replace(/[.,]/g, "\\$&")}(?!\\d|[.,]\\d)`).test(scene.narration),
      );
      return [{ template: "odometer", params: { value: scene.value, decimals, suffix: suffix(scene.unit), label: scene.label, ...(said ? { at: said } : {}) } }];
    }
    default:
      return [];
  }
}

// A unit as the suffix of a number, with the same rule as looks.ts: "45%" but "25 million".
const suffix = (unit?: string) => {
  const trimmed = unit?.trim() ?? "";
  if (trimmed === "") return "";
  return /^(%|percent|per cent)$/i.test(trimmed) ? "%" : ` ${trimmed}`;
};
const decimalsOf = (value: number) => (String(value).split(".")[1] ?? "").length;
