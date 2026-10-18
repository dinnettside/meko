import type { Scene } from "./storyboard.ts";

// Other ways to draw the director's own kinds with Trym's templates (remotion/filmmotor), so two videos with the
// same kinds of scene still look different. A look only redraws what the scene already shows, after its checks; it
// adds no text or number of its own beyond fixed words like "Source".

export type Look = { template: string; params: Record<string, unknown> };

// What a look may need beyond the scene: whether it is the last scene, the source a quote comes from, and the
// source words around the quote.
export type LookContext = { isLast: boolean; sourceTitle?: string; excerpt?: string };

// A unit as the suffix of a number: "45%" but "25 million".
const suffix = (unit?: string) => {
  const trimmed = unit?.trim() ?? "";
  if (trimmed === "") return "";
  return /^(%|percent|per cent)$/i.test(trimmed) ? "%" : ` ${trimmed}`;
};
const decimalsOf = (value: number) => (String(value).split(".")[1] ?? "").length;

// Units of distance or speed, where bars can race each other.
const RACE_UNITS = /^(km|kilomet(?:er|re)s?|miles?|met(?:er|re)s?|m|feet|ft|km\/h|kph|mph|knots?|m\/s)$/i;
// Words for people, so a count of them can be drawn as little figures.
const PEOPLE_WORDS = /\b(people|persons?|men|women|children|adults|deaths?|died|killed|soldiers?|workers?|citizens?|voters?|residents?|patients?|students?|survivors?|victims?|inhabitants?|population)\b/i;

// The looks a scene could have. The scene's own drawing is always an option too; see pickLooks.
export function looksFor(scene: Scene, context: LookContext): Look[] {
  switch (scene.kind) {
    case "steps": {
      const nodes = scene.steps.map((text) => ({ text }));
      // Long steps and long chains stack, so every box has room for its words.
      const direction = scene.steps.length > 4 || scene.steps.some((step) => step.length > 16) ? "v" : "h";
      const icons = scene.icons ?? [];
      return [
        { template: "cause_chain", params: { nodes, direction } },
        { template: "process_steps", params: { nodes, direction, numbered: true } },
        ...(icons.length === scene.steps.length && icons.every(Boolean)
          ? [{ template: "icon_chain", params: { nodes: scene.steps.map((label, index) => ({ icon: icons[index], label })) } }]
          : []),
      ];
    }
    case "list": {
      const items = scene.items.map((item) => (item.detail ? `${item.title}: ${item.detail}` : item.title));
      // A bullet longer than about 55 letters makes the template shrink the whole list.
      if (items.some((item) => item.length > 55)) return [];
      const short = scene.items.every((item) => !item.detail && item.title.split(/\s+/).length <= 3);
      return [
        context.isLast ? { template: "key_takeaways", params: { items, style: "number" } } : { template: "bullet_list", params: { items, style: "dot" } },
        ...(short ? [{ template: "kinetic_words", params: { words: scene.items.map((item) => item.title) } }] : []),
      ];
    }
    case "versus":
      return [{ template: "scoreboard", params: { left: scene.left, right: scene.right, criteria: scene.rows.map(({ label, left, right }) => ({ label, left, right })) } }];
    case "compare": {
      const data = scene.bars.map(({ label, value }) => ({ label, value }));
      const decimals = Math.max(...scene.bars.map((bar) => decimalsOf(bar.value)));
      const unit = suffix(scene.unit);
      return [
        { template: "bar_chart", params: { title: scene.title, data, unit, decimals } },
        { template: "ranking_bars", params: { title: scene.title, data, unit, decimals, orientation: "h", sort: true } },
        ...(RACE_UNITS.test(scene.unit?.trim() ?? "") ? [{ template: "race_lanes", params: { title: scene.title, lanes: data, unit } }] : []),
      ];
    }
    case "stat": {
      const decimals = decimalsOf(scene.value);
      if (scene.valueMax !== undefined) {
        // A range: the part every estimate agrees on, and the part where they differ.
        return [
          {
            template: "uncertainty_range",
            params: { low: scene.value, high: scene.valueMax, unit: scene.unit, label: scene.label, decimals, certainLabel: "At least", uncertainLabel: "Estimates differ" },
          },
        ];
      }
      if (scene.total !== undefined) {
        const whole = Number.isInteger(scene.value) && Number.isInteger(scene.total);
        const people = PEOPLE_WORDS.test(`${scene.label} ${scene.unit ?? ""}`);
        if (whole && scene.total <= 20 && people) {
          return [{ template: "icon_array", params: { value: scene.value, total: scene.total, label: scene.label, icon: "person", cols: scene.total <= 10 ? 5 : 10 } }];
        }
        return whole && scene.total <= 100 ? [{ template: "unit_grid", params: { value: scene.value, total: scene.total, label: scene.label, cols: 10 } }] : [];
      }
      return [{ template: "big_number", params: { value: scene.value, decimals, suffix: suffix(scene.unit), label: scene.label } }];
    }
    case "quote": {
      // The source words around the quote, with the quote marked, when they fit on the page.
      const fits = context.excerpt !== undefined && context.excerpt.length <= 320 && context.excerpt.includes(scene.text);
      // The quote card has room for four lines of about 38 letters.
      return [
        ...(scene.text.length <= 150 ? [{ template: "quote_card", params: { quote: scene.text, author: context.sourceTitle ?? "", role: "" } }] : []),
        ...(fits ? [{ template: "source_highlight", params: { source: context.sourceTitle ?? "", excerpt: context.excerpt, highlight: scene.text } }] : []),
      ];
    }
    case "change":
      // The template has no place for a year, so a change with one keeps its own drawing.
      return scene.year === undefined ? [{ template: "strike_replace", params: { items: [{ text: scene.from, strike: true }, { text: scene.to }] } }] : [];
    case "text":
      return scene.lines.length === 1 && scene.lines[0].split(/\s+/).length <= 12 ? [{ template: "big_statement", params: { text: scene.lines[0], emphasis: [] } }] : [];
    default:
      return [];
  }
}

// A number from a text, the same every time, so a video's looks do not change when its storyboard is built again.
function hash(text: string): number {
  let value = 2166136261;
  for (const char of text) value = Math.imul(value ^ char.charCodeAt(0), 16777619) >>> 0;
  return value;
}

// Picks a look for each scene, or none, which keeps the scene's own drawing. Each scene's options are its own
// drawing and its looks; which one it gets depends on the video's title, so different videos mix differently. A
// template is used at most once in a video, counting the templates it shows as scenes of their own (`used`), and
// two scenes in a row never get the same template.
export function pickLooks(options: Look[][], seed: string, used: string[]): (Look | undefined)[] {
  const taken = new Set(used);
  return options.map((looks, index) => {
    const free = looks.filter((look) => !taken.has(look.template));
    const choice = hash(`${seed}#${index}`) % (free.length + 1);
    const look = choice === 0 ? undefined : free[choice - 1];
    if (look) taken.add(look.template);
    return look;
  });
}
