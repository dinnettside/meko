// The icons a video can draw, all made in code (remotion/icons.tsx). The director picks from these names; any other
// name is dropped. They are generic shapes, never a logo or a real flag.
export const ICON_NAMES = [
  // People and power
  "person", "people", "astronaut", "scientist", "soldier", "crown", "sword", "shield", "castle", "flag", "ballot",
  "gavel", "handshake", "chains", "wall", "cannon", "tank", "dove",
  // Places and buildings
  "house", "factory", "city", "temple", "church", "mosque", "pagoda", "pyramid", "tower", "bridge",
  // Nature
  "tree", "wheat", "leaf", "mountain", "drop", "wave", "flame", "cloud", "lightning", "snowflake", "sun",
  "volcano", "rock", "fish", "bird", "bee", "sprout", "wind",
  // Space
  "moon", "star", "planet", "earth", "rocket", "satellite", "telescope",
  // Science and health
  "flask", "microscope", "atom", "cell", "virus", "bacteria", "dna", "syringe", "pill", "heart", "brain", "lungs",
  "bone", "magnet", "bulb", "gear",
  // Trade and travel
  "gold", "coin", "money", "gem", "silk", "spices", "tea", "vase", "barrel", "horse", "camel", "ship", "cart",
  "train", "car", "plane",
  // Knowledge and signs
  "scroll", "book", "letter", "newspaper", "map", "compass", "clock", "calendar", "phone", "computer", "radio",
  "chart", "check", "cross", "question", "warning", "lock", "key",
  // Animals
  "rabbit", "fox", "deer", "wolf", "bear", "cow", "sheep", "pig", "chicken", "cat", "dog", "mouse", "frog", "snake",
  "lizard", "turtle", "whale", "shark", "octopus", "jellyfish", "crab", "butterfly", "ant", "spider", "beetle",
  "mosquito", "owl", "eagle", "penguin", "elephant", "lion", "monkey", "dinosaur",
  // Plants and landscapes
  "grass", "flower", "cactus", "mushroom", "seed", "apple", "forest", "island", "river", "lake", "desert", "iceberg",
  "soil", "cave", "rainbow", "tornado", "ocean", "coral", "fossil", "crystal",
  // Body and health
  "eye", "ear", "nose", "tooth", "hand", "stomach", "intestine", "kidney", "liver", "blood", "muscle", "skull",
  "neuron", "bandage", "stethoscope", "hospital", "mask", "antibody",
  // Technology and AI
  "chip", "gpu", "server", "database", "wifi", "network", "robot", "code", "laptop", "camera", "battery", "plug",
  "solarpanel", "windturbine", "pylon", "antenna", "router", "cable", "sensor", "keyboard", "printer",
  "cloudstorage",
  // Energy, industry and transport
  "oilrig", "coal", "reactor", "dam", "engine", "hammer", "wrench", "pickaxe", "truck", "tractor", "bus", "bicycle",
  "submarine", "helicopter", "balloon", "parachute", "anchor", "crane", "road", "trafficlight", "fuel",
  // Society and history
  "school", "bank", "shop", "parliament", "megaphone", "trophy", "medal", "helmet", "bow", "spear", "axe",
  "catapult", "galleon", "quill", "printingpress", "globe", "moneybag", "piggybank", "family", "child", "baby",
  // Science and symbols
  "testtube", "beaker", "petri", "magnifier", "ruler", "scale", "thermometer", "gauge", "prism", "lens", "laser",
  "molecule", "galaxy", "comet", "asteroid", "blackhole", "radiation", "recycle", "arrowup", "arrowdown", "plus",
  "minus", "target", "puzzle", "idea", "speech", "hourglass", "stopwatch",
] as const;

export type IconName = (typeof ICON_NAMES)[number];

export const isIconName = (name: string): name is IconName => (ICON_NAMES as readonly string[]).includes(name);

// Names the model often gives for things the list draws under another name, like "data" for a database. Each points
// at an icon that pictures the same thing, never at a guess.
const ALIASES: Record<string, IconName> = {
  data: "database", dataset: "database", storage: "database", memory: "chip", processor: "chip", cpu: "chip",
  graphicscard: "gpu", ai: "robot", model: "network", neuralnetwork: "network", internet: "network", web: "network",
  signal: "wifi", wireless: "wifi", output: "arrowup", input: "arrowdown", error: "warning", mistake: "cross",
  danger: "warning", alert: "warning", success: "check", correct: "check", wrong: "cross", pipe: "cable", wire: "cable",
  electricity: "lightning", power: "lightning", energy: "lightning", current: "lightning", spark: "lightning",
  light: "bulb", lamp: "bulb", heat: "flame", fire: "flame", hot: "flame", cold: "snowflake", ice: "snowflake",
  water: "drop", groundwater: "drop", aquifer: "drop", rain: "cloud", storm: "lightning", weather: "cloud", air: "wind", gas: "cloud", steam: "cloud",
  smoke: "cloud", oxygen: "wind", carbondioxide: "cloud", co2: "cloud", food: "apple", fruit: "apple",
  plant: "sprout", seedling: "sprout", crop: "wheat", crops: "wheat", farm: "tractor", farmer: "tractor",
  animal: "rabbit", germ: "bacteria", germs: "bacteria", microbe: "bacteria", pathogen: "virus", disease: "virus",
  infection: "virus", medicine: "pill", drug: "pill", vaccine: "syringe", doctor: "stethoscope", nurse: "stethoscope",
  patient: "hospital", organ: "heart", bloodcell: "blood", nerve: "neuron", nervecell: "neuron",
  gene: "dna", genes: "dna", chromosome: "dna", cash: "money", dollar: "coin", price: "coin",
  cost: "coin", wealth: "moneybag", savings: "piggybank", trade: "ship", market: "shop", store: "shop",
  law: "gavel", court: "gavel", judge: "gavel", government: "parliament", vote: "ballot", election: "ballot",
  king: "crown", queen: "crown", emperor: "crown", ruler: "crown", war: "sword", battle: "sword", army: "soldier",
  peace: "dove", treaty: "scroll", document: "scroll", paper: "scroll", letterbox: "letter", message: "letter",
  email: "letter", mail: "letter", news: "newspaper", writing: "quill", pen: "quill", knowledge: "book",
  education: "school", student: "school", teacher: "school", time: "clock", year: "calendar", date: "calendar",
  speed: "stopwatch", fast: "stopwatch", measure: "ruler", weight: "scale", balance: "scale", temperature: "thermometer",
  search: "magnifier", research: "magnifier", experiment: "flask", chemistry: "beaker", chemical: "testtube",
  laboratory: "microscope", lab: "microscope", science: "atom", physics: "atom", nucleus: "atom", nuclear: "radiation",
  radioactive: "radiation", waste: "recycle", recycling: "recycle", growth: "arrowup", increase: "arrowup",
  rise: "arrowup", decline: "arrowdown", decrease: "arrowdown", fall: "arrowdown", goal: "target", aim: "target",
  problem: "puzzle", solution: "idea", thought: "idea", talk: "speech", speak: "speech",
  speaker: "megaphone", protest: "megaphone", town: "city", village: "house", home: "house",
  building: "factory", powerplant: "factory", industry: "factory", mine: "pickaxe",
  mining: "pickaxe", oil: "oilrig", petrol: "fuel", gasoline: "fuel", vehicle: "car", transport: "truck",
  boat: "ship", cargo: "barrel", goods: "barrel", freight: "truck", sailing: "galleon", aircraft: "plane", airplane: "plane", jet: "plane", spacecraft: "rocket",
  space: "planet", sky: "cloud", sea: "ocean", stream: "river", hill: "mountain", ground: "soil",
  earthquake: "warning", world: "globe", country: "map", travel: "compass", direction: "compass", route: "road",
  human: "person", man: "person", woman: "person", worker: "person", crowd: "people",
  population: "people", group: "people", team: "people", parent: "family", kid: "child", infant: "baby",
};

// An icon name from the list, whatever its case, spaces or plural ("Gold" is "gold", "solar panel" is "solarpanel",
// "trees" is "tree"), or one of the aliases above, or undefined when there is none.
export const iconKey = (name?: string): IconName | undefined => {
  const key = name?.trim().toLowerCase().replace(/[\s_-]+/g, "");
  if (!key) return undefined;
  if (isIconName(key)) return key;
  const singular = key.replace(/(?<=[^s])s$/, "");
  if (isIconName(singular)) return singular;
  return ALIASES[key] ?? ALIASES[singular];
};
