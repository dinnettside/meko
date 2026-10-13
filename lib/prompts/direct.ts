import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

type Fact = { id: string; text: string };

// The opening scene only needs a title.
export function directTitlePrompt(title: string, narration: string): ChatCompletionMessageParam[] {
  return [
    {
      role: "system",
      content: [
        "You write the title card that opens a short explainer video.",
        "The heading names what the whole video is about, based on the video title, in at most 6 words.",
        "The optional subheading, at most 10 words, can hint at where the story starts.",
        "Do not use numbers that are not in the narration.",
      ].join("\n"),
    },
    { role: "user", content: `Video title: ${title}\nOpening narration: ${narration}` },
  ];
}

export function directScenePrompt(input: {
  title: string;
  position: string; // like "scene 3 of 9"
  narration: string;
  sceneFacts: Fact[];
  otherFacts: Fact[];
}): ChatCompletionMessageParam[] {
  return [
    {
      role: "system",
      content: [
        "You direct one scene of a short explainer video. Decide what is shown on screen while its narration plays.",
        "Pick one of three kinds:",
        '- "map" when the narration is about places, countries, borders, or movement between places. "frame" lists the countries the camera should show. "highlights" colors the countries the narration is about: "primary" for the main one, "secondary" for others it names, "muted" for context. Highlight labels name a country or region, never a city. Put cities and towns in "markers" with their longitude, latitude and the code of the country they lie in today. Add "arrows" from one country to another for movement, war or trade: an arrow starts and ends at a marker in that country if there is one. Label an arrow only when it adds something, and never repeat a label. Labels are at most 3 words. Keep the map simple: at most 4 highlighted countries, 3 markers and 3 arrows. Lists you do not need can be empty.',
        '- "timeline" when the narration compares events from at least two different years. Give 2 to 5 events in time order. Each event has a year, a label of at most 4 words, and the ID of the fact that states that year. Only use events and years from the facts. "focusIndex" is the position (from 0) of the event this scene is about. Use negative years for BC.',
        '- "text" when neither fits: 1 to 3 short lines of at most 8 words each that sum up the narration. Do not repeat the narration word for word.',
        "Prefer a map or a timeline when it fits, because it helps the viewer see the story.",
        'Also give "lines": 1 to 3 short lines of at most 8 words each that sum up the narration. They are shown if the visual cannot be used.',
        "Countries are ISO 3166-1 alpha-3 codes, like FRA for France and AUT for Austria. Borders on the map are modern ones.",
        "Only show numbers and years that appear in the narration or the facts. Never work out new numbers.",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `Video title: ${input.title}`,
        `This is ${input.position}.`,
        `Narration: ${input.narration}`,
        "",
        "Facts behind this scene:",
        ...input.sceneFacts.map((fact) => `${fact.id}: ${fact.text}`),
        "",
        "Other facts in the video:",
        ...input.otherFacts.map((fact) => `${fact.id}: ${fact.text}`),
      ].join("\n"),
    },
  ];
}
