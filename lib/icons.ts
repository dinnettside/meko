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
] as const;

export type IconName = (typeof ICON_NAMES)[number];

export const isIconName = (name: string): name is IconName => (ICON_NAMES as readonly string[]).includes(name);
