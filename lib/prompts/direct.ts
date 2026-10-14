import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

type Fact = { id: string; text: string };

// A second opinion on where the map's cities lie, asked without coordinates.
export function placesPrompt(title: string, places: { name: string; context: string }[]): ChatCompletionMessageParam[] {
  return [
    {
      role: "system",
      content: [
        "For each place, give its latitude and longitude and the ISO 3166-1 alpha-3 code of the country where it lies today, in the same order.",
        "Each place comes with the narration it appears in. Use it to tell apart places with similar names, like a city and a mountain range.",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `Video: ${title}`,
        "",
        "Places:",
        ...places.map((place, index) => `${index + 1}. ${place.name} (narration: "${place.context}")`),
      ].join("\n"),
    },
  ];
}

// Plans the kind of picture for every scene after the title, so the video has a rhythm.
export function directPlanPrompt(
  title: string,
  scenes: { id: string; narration: string; facts: string[] }[],
): ChatCompletionMessageParam[] {
  return [
    {
      role: "system",
      content: [
        "You plan the pictures of a short explainer video. For every scene, in order, pick the kind of picture that shows its narration best.",
        "Kinds: map (places, borders, movement between places), timeline (events from two or more different years in the facts), stat (one striking number), compare (two or more amounts in the same unit), quote (a source's own words say it best), steps (a process or a chain of causes), text (only when nothing else fits).",
        "Give the video a rhythm: never the same kind twice in a row, except two maps of different places. Use text at most twice and quote at most once.",
        "Only pick stat or compare when the scene's narration or facts give the numbers, and timeline only when its facts give at least two different years.",
      ].join("\n"),
    },
    { role: "user", content: `Video title: ${title}\n\nScenes:\n${JSON.stringify(scenes, null, 1)}` },
  ];
}

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
  sceneFacts: (Fact & { quote: string })[];
  otherFacts: Fact[];
  plannedKind?: string; // from the plan for the whole video
}): ChatCompletionMessageParam[] {
  return [
    {
      role: "system",
      content: [
        "You direct one scene of a short explainer video. Decide what is shown on screen while its narration plays.",
        "Pick the kind that shows the idea best:",
        '- "map" when the narration is about places, countries, borders, or movement between places. "frame" lists the countries the camera should show. "highlights" colors the countries the narration is about: "primary" for the main one, "secondary" for others it names, "muted" for context. Highlight labels name a country or region, never a city. Put cities and towns in "markers" with their longitude, latitude and the code of the country they lie in today. Add "arrows" from one country to another for movement, war or trade: an arrow starts and ends at a marker in that country if there is one. Label an arrow only when it adds something, and never repeat a label. Labels are at most 3 words. Keep the map simple: at most 4 highlighted countries, 3 markers and 3 arrows. Lists you do not need can be empty.',
        '- "timeline" when the narration compares events from at least two different years. Give 2 to 5 events in time order. Each event has a year, a label of at most 4 words, and the ID of the fact that states that year. Only use events and years from the facts. "focusIndex" is the position (from 0) of the event this scene is about. Use negative years for BC.',
        '- "stat" when the narration turns on one striking number. "value" is the number as the narration or facts write it, for example 25 with "unit" "million". "label" says in a few words what it counts. Give "total" only when the narration or facts name the whole the number is part of; the video then shows value out of total as dots.',
        '- "compare" when the narration compares 2 to 5 amounts in the same unit. Give a short "title" and "bars" with a label of at most 4 words and a value from the narration or facts.',
        '- "quote" when a source\'s own words say it best. Copy 5 to 30 words exactly from the source words of one of the facts behind this scene, and give that fact\'s ID.',
        '- "steps" when the narration explains a process or a chain of causes: 2 to 5 steps of at most 5 words each, in order.',
        '- "text" only when nothing else fits: 1 to 3 short lines of at most 8 words each that sum up the narration. Do not repeat the narration word for word.',
        "Showing beats telling, so use text as little as possible.",
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
        ...(input.plannedKind ? [`Planned kind for this scene: ${input.plannedKind}. Use it unless it really does not fit.`] : []),
        `Narration: ${input.narration}`,
        "",
        "Facts behind this scene, with their source words:",
        ...input.sceneFacts.map((fact) => `${fact.id}: ${fact.text} (source words: "${fact.quote}")`),
        "",
        "Other facts in the video:",
        ...input.otherFacts.map((fact) => `${fact.id}: ${fact.text}`),
      ].join("\n"),
    },
  ];
}
