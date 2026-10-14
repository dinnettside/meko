import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

type Fact = { id: string; text: string };

// A second opinion on where the map's cities lie, asked without coordinates.
export function placesPrompt(title: string, places: { name: string; context: string }[]): ChatCompletionMessageParam[] {
  return [
    {
      role: "system",
      content: [
        "For each place, give its latitude and longitude and the ISO 3166-1 alpha-3 code of the country where it lies today, in the same order.",
        'Set "isPlace" to false when the name is not a place on Earth at all, like a person, an institution, a group or an event.',
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
  scenes: { id: string; narration: string; facts: string[]; cannot: string[] }[],
): ChatCompletionMessageParam[] {
  return [
    {
      role: "system",
      content: [
        "You plan the pictures of a short explainer video. For every scene, in order, rank the 3 kinds of picture that would show its narration best, best first.",
        "Kinds: map (places, borders, movement between places), timeline (a time that other years in the video put in context), stat (one striking number), compare (two or more amounts in the same unit), quote (a source's own words say it best), steps (a process or a chain of causes, where each step leads to the next), list (2 to 4 things of one kind side by side, like types, goods, effects or people), versus (two sides compared point by point), change (a name, ruler or status that changed into another), text (only when nothing else fits).",
        'Each scene lists under "cannot" the kinds its facts have no data for, like a timeline without years. Never list those.',
        "Use a map when the scene is about where something happens on Earth or a movement between places on Earth. Never for space, the human body or ideas.",
        "The video should not show the same kind again and again, so the other choices matter: the best one is not always used.",
        "The last scene sums up the video. When it names 2 or 3 main points, a list fits it well.",
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
  quotable: { factId: string; sentence: string }[]; // whole sentences of the scene's source words that a quote may show
  otherFacts: Fact[];
  plannedKind?: string; // from the plan for the whole video
  avoidKinds: string[]; // kinds without data, and the kinds of the scenes next to this one
  years: string[]; // every year the facts state, like "f10: 1227"
  amounts: string[]; // the amounts in this scene's narration and facts, like "6,400 km"
}): ChatCompletionMessageParam[] {
  return [
    {
      role: "system",
      content: [
        "You direct one scene of a short explainer video. Decide what is shown on screen while its narration plays.",
        "Pick the kind that shows the idea best:",
        '- "map" when the narration is about places, countries, borders, or movement between places. "frame" lists the countries the camera should show. "highlights" colors the countries the narration is about: "primary" for the main one, "secondary" for others it names, "muted" for context. Highlight labels name a country or region, never a city. Put cities, towns and ports in "markers" with their longitude, latitude and the code of the country they lie in today; never color a whole country to point at one city in it. Add "arrows" from one country to another for movement, war or trade: an arrow starts and ends at a marker in that country if there is one. Label an arrow only when it adds something, and never repeat a label. Say which way an arrow goes, like "eastward", only when the narration or facts say it. Labels are at most 3 words, and name only places and things the narration or facts name. Only mark cities the narration or facts name. Keep the map simple: at most 4 highlighted countries, 3 markers and 3 arrows. Lists you do not need can be empty.',
        '- "timeline" when the narration is about a time that other years in the video put in context. Give 2 to 5 events in time order. Each event has a year, a label of at most 4 words, and the ID of the fact that states that year. When events fall in the same year, give each a "date" from its fact, so they can share the timeline: a day and a month only, like "20 July", without the year. Only use years and dates listed under "Years in the facts", with the fact they are listed for; a fact without a listed year cannot be on a timeline. "focusIndex" is the position (from 0) of the event this scene is about. Years BC are negative. "eras" are up to 3 periods that put the events in context, like a dynasty, a reign or a war: each has the "start" and "end" year that one fact gives as one period, like "ruled from 1451 to 1481", a label of at most 4 words, and that fact\'s ID. An era must overlap the events\' years. Leave eras empty when no fact gives a period like that.',
        '- "stat" when the narration turns on one striking number. "value" is one of the amounts listed for this scene, for example 25 with "unit" "million". "label" says in a few words what it counts. When the narration gives a range, like "25 to 50 million", show all of it: "value" 25 and "valueMax" 50, never just one end. Give "total" only when the narration or facts name the whole the number is part of; the video then shows value out of total as dots. A percentage needs no total.',
        '- "compare" when the narration compares 2 to 5 amounts in the same unit. Give a short "title" and "bars" with a label of at most 4 words and a value from the amounts listed for this scene. Each bar\'s label and value come from one sentence of the narration or facts that gives that number for that thing.',
        '- "quote" when a source\'s own words say it best. Copy one of the sentences listed under "Sentences you may quote", exactly as written, and give its fact\'s ID. Never shorten or join sentences. The quote says what the narration says.',
        '- "steps" when the narration explains a process or a chain of causes: 2 to 5 steps of at most 5 words each, in order, where each step leads to the next. A list of similar things is not steps.',
        '- "list" when the narration names 2 to 4 things of one kind side by side, like types, goods, effects or people. Each item has a "title" of 1 to 3 words and an optional "detail" of at most 6 words, in the order the narration names them, in its words.',
        '- "versus" when the narration compares two sides point by point, like two empires, two plans or before and after: "left" and "right" name the sides in 1 to 3 words, and 2 to 4 "rows" each give a point ("label", 1 to 3 words) and what it is for each side, at most 5 words each. Every word of a row comes from the narration or facts: no "Yes" or "No" they do not say.',
        '- "change" when the narration tells how a name, ruler or status changed into another, like a city renamed or a kingdom becoming a republic: "from" and "to" in at most 4 words each, in the narration\'s words, and "year" only when the narration or facts give it.',
        '- "text" only when nothing else fits: 1 to 3 short lines of at most 8 words each that sum up the narration in its own words, shortened.',
        "Showing beats telling, so use text as little as possible.",
        'Also give "lines": 1 to 3 short lines of at most 8 words each that sum up the narration. They are shown if the visual cannot be used.',
        "Countries are ISO 3166-1 alpha-3 codes, like FRA for France and AUT for Austria. Borders on the map are modern ones.",
        "Only show numbers and years that appear in the narration or the facts. Never count, add up or work out new numbers.",
        "Every label, step and line says only what the narration or the facts say, mostly in their words. Do not add people, actions or details they do not mention.",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `Video title: ${input.title}`,
        `This is ${input.position}.`,
        ...(input.plannedKind ? [`Planned kind for this scene: ${input.plannedKind}. Use it unless it really does not fit.`] : []),
        ...(input.avoidKinds.length > 0 ? [`Do not use: ${input.avoidKinds.join(", ")}.`] : []),
        `Narration: ${input.narration}`,
        `Amounts in this scene: ${input.amounts.length > 0 ? input.amounts.join("; ") : "none"}`,
        `Years in the facts: ${input.years.length > 0 ? input.years.join("; ") : "none"}`,
        `Sentences you may quote: ${input.quotable.length > 0 ? input.quotable.map((item) => `${item.factId}: "${item.sentence}"`).join(" | ") : "none"}`,
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
