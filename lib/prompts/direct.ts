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

// What each of the director's own kinds shows, for the plan's menu. The templates bring their own lines.
const OWN_KINDS: Record<string, string> = {
  map: "places, borders, movement and routes between places on Earth",
  timeline: "a time that other years in the video put in context",
  stat: "one striking number",
  compare: "two or more amounts in the same unit",
  quote: "a source's own words say it best",
  steps: "a process or a chain of causes, where each step leads to the next",
  list: "2 to 4 things of one kind side by side, like types, goods or effects",
  versus: "two sides compared point by point",
  change: "a name, ruler or status that changed into another",
  people: "the people the narration names, drawn as figures",
  space: "a journey through space, or places on the Moon",
  illustration: "a picture you compose from icons and figures with labels and arrows, also underground, at sea, in the sky, in space or inside the body, to show how something works or where it happens",
  drawing: "a diagram you draw yourself from simple shapes, only when no ready diagram and no kit picture (cutaway, journey, input_output, forces) can show it",
  text: "only when nothing else fits",
};

// The menu of kinds, one line each.
const menu = (templates: { name: string; plan: string }[]) => [
  ...Object.entries(OWN_KINDS).map(([kind, line]) => `- ${kind}: ${line}`),
  ...templates.map((template) => `- ${template.name}: ${template.plan}`),
];

// Plans the kind of picture for every scene after the title, so the video has a rhythm.
export function directPlanPrompt(
  title: string,
  scenes: { id: string; narration: string; facts: string[]; fits: string[] }[],
  templates: { name: string; plan: string }[],
): ChatCompletionMessageParam[] {
  return [
    {
      role: "system",
      content: [
        "You plan the pictures of a short explainer video, like the director of a good science or history channel. For every scene, in order, first write in \"idea\" one sentence that says what the viewer sees: the one picture that makes the narration click, like \"a cutaway of the ground with magma rising from a chamber up to the crater\" or \"electricity travelling from the power plant along the lines to a house\". Then rank the 3 kinds of picture that show that idea best, best first.",
        "Kinds:",
        ...menu(templates),
        'Each scene lists under "fits" the kinds its narration and facts have what they need for. Only rank those, and only a kind whose whole picture this scene\'s own narration and facts give: a cycle needs its steps in this scene, not only the word "cycle".',
        "Use a map when the scene is about where something happens on Earth or a movement between places on Earth. Never for space, the human body or ideas.",
        "Prefer the kind that shows what this scene is about over a general one: a cycle for a loop, a pyramid for a hierarchy, a myth card for a belief the narration says is wrong. Text, lists and single numbers are the fallbacks, not the first choice.",
        "Every video needs one or two signature scenes, two in a video of more than 8 scenes: a picture made for this topic that shows how it works or where it happens. Best is a ready diagram from the menu made for exactly this, like volcano_cutaway for how a volcano erupts; next a kit picture filled for this topic: a cutaway (what is inside or under something), a journey (one thing travelling through stages), input_output (what a process takes in and gives out) or forces (the forces on one thing); then a map or an illustration. Rank one first for the scenes that explain the core of the topic.",
        "The video should not show the same kind of picture again and again, so the other choices matter: the best one is not always used.",
        "The last scene sums up the video. When it names 2 or 3 main points, a list fits it well.",
        'Also pick the look of the whole video as "theme": "night" for history and the past: wars, empires, explorers, revolutions, politics, people of the past and epidemics of the past, like the Black Death; "blueprint" for machines, inventions, engineering, physics, chemistry, computers, technology and space; "field" for living things and the planet today: the human body, medicine, vaccines, health, food, animals, plants, nature, weather and climate.',
      ].join("\n"),
    },
    { role: "user", content: `Video title: ${title}\n\nScenes:\n${JSON.stringify(scenes, null, 1)}` },
  ];
}

// A second look at the plan, by the model as a demanding editor.
export function directCritiquePrompt(
  title: string,
  scenes: { id: string; narration: string; idea: string; picked: string; fits: string[] }[],
  templates: { name: string; plan: string }[],
): ChatCompletionMessageParam[] {
  return [
    {
      role: "system",
      content: [
        "You are the editor of a short explainer video, and you are hard to please. A planner picked a kind of picture for every scene. Challenge the plan.",
        "Find at most 3 scenes where another kind would be clearly better: one that shows what the narration is really about, where the plan chose a general picture like text, a list or a single number, or one that breaks a run of scenes that look alike.",
        "Make sure the video has a signature scene: a picture made for this topic that shows how it works or where it happens, like a ready diagram, a kit picture (cutaway, journey, input_output, forces), a map or an illustration composed for it. If the plan has none, turn the scene that explains the core of the topic into one. Check each scene\'s idea too: if a better picture would make it click, change the kind to the one that shows it.",
        'Only propose a kind listed under "fits" for that scene. Give the scene\'s id, the new kind and in a few words why.',
        "Change nothing that already works. If the plan is good, return no changes.",
        "Kinds:",
        ...menu(templates),
      ].join("\n"),
    },
    { role: "user", content: `Video title: ${title}\n\nPlan:\n${JSON.stringify(scenes, null, 1)}` },
  ];
}

// The opening scene only needs a title.
export function directTitlePrompt(title: string, narration: string, icons: readonly string[]): ChatCompletionMessageParam[] {
  return [
    {
      role: "system",
      content: [
        "You write the title card that opens a short explainer video.",
        "The heading names what the whole video is about, based on the video title, in at most 6 words.",
        "The optional subheading, at most 10 words, can hint at where the story starts.",
        'The optional "icon" pictures the whole topic, like syringe for vaccines or rocket for a rocket launch: a name from the icon list below. Leave it out when no icon is clearly about the topic.',
        "Do not use numbers that are not in the narration.",
      ].join("\n"),
    },
    { role: "user", content: `Video title: ${title}\nOpening narration: ${narration}\nIcons: ${icons.join(", ")}` },
  ];
}

// How to fill each of the director's own kinds. A scene's prompt describes only the kinds it may use.
const KIND_LINES = {
  map:
    '- "map" when the narration is about places, countries, borders, or movement between places. "frame" lists the countries the camera should show. "highlights" colors the countries the narration is about: "primary" for the main one, "secondary" for others it names, "muted" for context. Highlight labels name a country or region, never a city. Put cities, towns and ports in "markers" with their longitude, latitude and the code of the country they lie in today; never color a whole country to point at one city in it. Add "arrows" from one country to another for movement, war or trade: an arrow starts and ends at a marker in that country if there is one. Label an arrow only when it adds something, and never repeat a label. Say which way an arrow goes, like "eastward", only when the narration or facts say it. Labels are at most 3 words, and name only places and things the narration or facts name. Only mark cities the narration or facts name. Keep the map simple: at most 4 highlighted countries, 3 markers and 3 arrows. A journey along a way, like a voyage, a trade route or a march, is a route, never arrows: give "routes", up to 2, each with 2 to 6 stops in order, as city names the narration or facts give (or your markers\' labels), "by" "land" or "sea", and an optional label. The video draws the way itself, through the water for a sea route, with a ship or a camel moving along it. Use arrows only for a move between two countries with no known way, like an invasion or an influence. Lists you do not need can be empty.',
  timeline:
    '- "timeline" when the narration is about a time that other years in the video put in context. Give 2 to 5 events in time order. Each event has a year, a label of at most 4 words, and the ID of the fact that states that year. When events fall in the same year, give each a "date" from its fact, so they can share the timeline: a day and a month only, like "20 July", without the year. Only use years and dates listed under "Years in the facts", with the fact they are listed for; a fact without a listed year cannot be on a timeline. "focusIndex" is the position (from 0) of the event this scene is about. Years BC are negative. "eras" are up to 3 periods that put the events in context, like a dynasty, a reign or a war: each has the "start" and "end" year that one fact gives as one period, like "ruled from 1451 to 1481", a label of at most 4 words, and that fact\'s ID. An era must overlap the events\' years. Leave eras empty when no fact gives a period like that.',
  stat:
    '- "stat" when the narration turns on one striking number. "value" is one of the amounts listed for this scene, for example 25 with "unit" "million". "label" says in a few words what it counts. When the narration gives a range, like "25 to 50 million", show all of it: "value" 25 and "valueMax" 50, never just one end. Give "total" only when the narration or facts name the whole the number is part of; the video then shows value out of total as dots. A percentage needs no total.',
  compare:
    '- "compare" when the narration compares 2 to 5 amounts in the same unit. Give a short "title" and "bars" with a label of at most 4 words and a value from the amounts listed for this scene. Each bar\'s label and value come from one sentence of the narration or facts that gives that number for that thing.',
  quote:
    '- "quote" when a source\'s own words say it best. Copy one of the sentences listed under "Sentences you may quote", exactly as written, and give its fact\'s ID. Never shorten or join sentences. The quote says what the narration says.',
  steps:
    '- "steps" when the narration explains a process or a chain of causes: 2 to 5 steps of at most 5 words each, in order, where each step leads to the next. A list of similar things is not steps. "icons" gives an icon for each step, in the same order, or is empty.',
  list:
    '- "list" when the narration names 2 to 4 things of one kind side by side, like types, goods or effects. Each item has a "title" of 1 to 3 words, an optional "detail" of at most 6 words, and an optional "icon" that pictures it (gold for gold, silk for silk), in the order the narration names them, in its words.',
  versus:
    '- "versus" when the narration compares two sides point by point, like two empires, two plans or before and after: "left" and "right" name the sides in 1 to 3 words, with an optional icon each, and 2 to 4 "rows" each give a point ("label", 1 to 3 words) and what it is for each side, at most 5 words each. Every word of a row comes from the narration or facts: no "Yes" or "No" they do not say.',
  people:
    '- "people" when the narration is about people it names: 1 to 4 people, each with the "name" as the narration writes it, an optional "role" in its words, a "look" that fits the role they play in the story (person, astronaut, scientist, soldier, ruler, worker, explorer, doctor; ruler only for a king, queen, emperor or sultan, so a president or a minister is a person; never their gender or looks), and an optional "prop", an icon they hold, only when the narration speaks of it, like a flask for an experiment. List them in the order the narration names them.',
  space:
    '- "space" for a journey through space or places on the Moon. "view" "journey" shows "bodies" (earth, moon, sun, mars) and an optional "craft" flying "from" one "to" another, with a short "label" in the narration\'s words. "view" "moon" shows the Moon\'s near side with up to 4 "sites" the narration names, from the Moon places listed below.',
  illustration:
    '- "illustration" for a picture you compose to show how something works or where it happens. 2 to 6 "items", each an "icon" or a "figure" (a look, as for people), with a short "label" in the narration\'s words, placed at "x" and "y" from 0 to 100 (left to right, top to bottom; keep items at least 15 apart), optional "size" small, medium or large, and up to 5 "links", arrows from one item to another by their position in the list (from 0). List the items in the order the narration names them, and keep other items off the straight line between two linked items. Show how things relate: a trade, a process with things, a cause and its effects. An optional "backdrop" sets where it takes place: "underground" (the ground\'s surface at y 30, sky above it, layers of rock below; put what is underground below 30), "sea" (the water\'s surface at y 30), "sky" (the ground along the bottom), "space", or "body" (the outline of a person filling the frame, head at the top around y 10 and the chest around y 40, so organs go where they are in the body). Use it when the narration says where things happen, like magma under the ground or organs in the body.',
  drawing:
    '- "drawing" when the narration explains how something works or what is inside it, and no ready diagram fits: draw one clear picture of one thing yourself, like a textbook cutaway, never a row of the same shapes. The canvas runs from x 0 to 100 left to right and y 0 to 100 top to bottom (whole numbers like 45, never fractions like 0.45), and is about twice as wide as it is tall. "parts" are drawn in order, back to front, 3 to 10 of them: "band" (a layer across the whole width from y1 to y2, like the ground, the sea or the sky; at most 3), "box" and "blob" (a rectangle or a rounded shape centered at x, y, w wide and h tall), "cone" (a peak whose base is centered at x, y, w wide and h tall, like a volcano or a mountain), "tube" (a thick channel through 2 to 6 points, like a pipe, a vein or a vent), "arrow" (movement along 2 to 6 points), "flow" (dots that keep moving along 2 to 6 points, like magma rising or blood flowing) and "icon" (a name from the icon list at x, y, with a size); at most 4 tubes, flows and arrows together. Each part has a "tone": ground, rock, hot (magma, fire, heat), water, air, plant, signal (the one thing to look at), second or pale. "labels" are 2 to 6 labels of at most 4 words in the narration\'s words, each with the "part" it names, by its position in "parts" (from 0), a different part for each label; the video places each label beside its part. Draw the thing big, filling most of the canvas. Example, magma rising in a volcano: parts 0 a band from y 45 to 100 in rock; 1 a cone at 50, 46, 50 wide and 30 tall in ground; 2 a blob at 50, 88, 30 wide and 12 tall in hot; 3 a tube from 50, 86 to 50, 17 in hot; 4 a flow from 50, 86 to 50, 8 in hot; labels "Magma chamber" on part 2, "Crust" on part 0 and "Volcano" on part 1. Example, heat carried out of a fridge: parts 0 a box at 28, 55, 30 wide and 70 tall in pale (the fridge); 1 a tube from 40, 80 to 70, 80 to 70, 25 to 40, 25 in second (the coils); 2 a flow along the same points in signal; 3 an arrow from 75, 30 to 92, 20 in hot; labels "Inside the fridge" on part 0, "Refrigerant" on part 2 and "Heat out" on part 3. The examples show the format, not shapes to reuse: draw what this narration is about.',
  change:
    '- "change" when the narration tells how a name, ruler or status changed into another, like a city renamed or a kingdom becoming a republic: "from" and "to" in at most 4 words each, in the narration\'s words, and "year" only when the narration or facts give it.',
};
export type OwnKind = keyof typeof KIND_LINES;

export function directScenePrompt(input: {
  title: string;
  position: string; // like "scene 3 of 9"
  narration: string;
  sceneFacts: (Fact & { quote: string })[];
  icons: readonly string[]; // the icon names the video can draw
  moonPlaces: string[]; // the seas and landing sites a Moon view can show
  quotable: { factId: string; sentence: string }[]; // whole sentences of the scene's source words that a quote may show
  otherFacts: Fact[]; // other facts of the video a timeline may use
  kinds: OwnKind[]; // the director's own kinds this scene may use, besides text
  templates: string[]; // how to fill each template offered to this scene
  drawingExamples: { narration: string; drawing: unknown }[]; // drawings made before for similar scenes
  plannedKind?: string; // from the plan for the whole video
  idea?: string; // the plan's picture for this scene, in words
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
        ...input.kinds.map((kind) => KIND_LINES[kind]),
        ...input.templates.map((template) => `- ${template}`),
        '- "text" only when nothing else fits: 1 to 3 short lines of at most 8 words each that sum up the narration in its own words, shortened.',
        "Showing beats telling, so use text as little as possible.",
        'Also give "lines": 1 to 3 short lines of at most 8 words each that sum up the narration. They are shown if the visual cannot be used.',
        ...(input.kinds.includes("map") ? ["Countries are ISO 3166-1 alpha-3 codes, like FRA for France and AUT for Austria. Borders on the map are modern ones."] : []),
        "Icons are names from the icon list below; leave an icon out rather than invent one. \"cross\" is an X for no or wrong; for Christianity use \"church\".",
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
        ...(input.idea ? [`The picture planned for this scene: ${input.idea}`] : []),
        ...(input.avoidKinds.length > 0 ? [`Do not use: ${input.avoidKinds.join(", ")}.`] : []),
        `Narration: ${input.narration}`,
        `Amounts in this scene: ${input.amounts.length > 0 ? input.amounts.join("; ") : "none"}`,
        `Years in the facts: ${input.years.length > 0 ? input.years.join("; ") : "none"}`,
        `Sentences you may quote: ${input.quotable.length > 0 ? input.quotable.map((item) => `${item.factId}: "${item.sentence}"`).join(" | ") : "none"}`,
        `Icons: ${input.icons.join(", ")}`,
        ...(input.drawingExamples.length > 0
          ? [
              "Drawings made before for similar scenes, to learn from. Draw your own for this narration, and take every label from its words:",
              ...input.drawingExamples.map((example) => `- For "${example.narration}": ${JSON.stringify(example.drawing)}`),
            ]
          : []),
        ...(input.moonPlaces.length > 0 ? [`Moon places: ${input.moonPlaces.join(", ")}`] : []),
        "",
        "Facts behind this scene, with their source words:",
        ...input.sceneFacts.map((fact) => `${fact.id}: ${fact.text} (source words: "${fact.quote}")`),
        ...(input.otherFacts.length > 0
          ? ["", "Other facts in the video that state a year, for a timeline:", ...input.otherFacts.map((fact) => `${fact.id}: ${fact.text}`)]
          : []),
      ].join("\n"),
    },
  ];
}
