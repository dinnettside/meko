import { COUNTRIES } from "./countries.ts";

// Regions a map label may name, with the countries that lie in them today. Broad ones like "Europe" or "the
// Mediterranean" are left out, because they are used loosely.
const REGIONS: Record<string, string[]> = {
  "central asia": ["KAZ", "UZB", "TKM", "KGZ", "TJK", "AFG"],
  "east asia": ["CHN", "MNG", "KOR", "PRK", "JPN", "TWN"],
  "eastern asia": ["CHN", "MNG", "KOR", "PRK", "JPN", "TWN"],
  "far east": ["CHN", "MNG", "KOR", "PRK", "JPN", "TWN", "RUS"],
  "south asia": ["IND", "PAK", "BGD", "NPL", "LKA", "BTN", "MDV", "AFG"],
  "southeast asia": ["THA", "VNM", "KHM", "LAO", "MMR", "MYS", "SGP", "IDN", "PHL", "BRN", "TLS"],
  indochina: ["VNM", "LAO", "KHM"],
  "middle east": ["TUR", "SYR", "IRQ", "IRN", "SAU", "JOR", "ISR", "PSE", "LBN", "EGY", "YEM", "OMN", "ARE", "QAT", "KWT", "BHR", "CYP"],
  "near east": ["TUR", "SYR", "IRQ", "IRN", "SAU", "JOR", "ISR", "PSE", "LBN", "EGY", "YEM", "OMN", "ARE", "QAT", "KWT", "BHR", "CYP"],
  "western asia": ["TUR", "SYR", "IRQ", "IRN", "SAU", "JOR", "ISR", "PSE", "LBN", "YEM", "OMN", "ARE", "QAT", "KWT", "BHR", "CYP", "ARM", "AZE", "GEO"],
  "north africa": ["EGY", "LBY", "TUN", "DZA", "MAR", "SDN", "ESH", "MRT"],
  "northern africa": ["EGY", "LBY", "TUN", "DZA", "MAR", "SDN", "ESH", "MRT"],
  "east africa": ["ETH", "SOM", "KEN", "TZA", "UGA", "ERI", "DJI", "SDN", "SSD", "RWA", "BDI", "MOZ", "MDG"],
  "eastern africa": ["ETH", "SOM", "KEN", "TZA", "UGA", "ERI", "DJI", "SDN", "SSD", "RWA", "BDI", "MOZ", "MDG"],
  "west africa": ["NGA", "GHA", "CIV", "SEN", "MLI", "BFA", "NER", "GIN", "SLE", "LBR", "TGO", "BEN", "GMB", "GNB", "MRT", "CPV"],
  "western africa": ["NGA", "GHA", "CIV", "SEN", "MLI", "BFA", "NER", "GIN", "SLE", "LBR", "TGO", "BEN", "GMB", "GNB", "MRT", "CPV"],
  persia: ["IRN"],
  anatolia: ["TUR"],
  "asia minor": ["TUR"],
  byzantium: ["TUR", "GRC"],
  mesopotamia: ["IRQ", "SYR", "TUR", "KWT"],
  levant: ["SYR", "LBN", "ISR", "PSE", "JOR"],
  arabia: ["SAU", "YEM", "OMN", "ARE", "QAT", "KWT", "BHR"],
  "arabian peninsula": ["SAU", "YEM", "OMN", "ARE", "QAT", "KWT", "BHR"],
  caucasus: ["ARM", "AZE", "GEO", "RUS"],
  crimea: ["UKR", "RUS"],
  siberia: ["RUS"],
  scandinavia: ["NOR", "SWE", "DNK"],
  balkans: ["ALB", "BIH", "BGR", "HRV", "GRC", "MNE", "MKD", "SRB", "SVN", "ROU", "XKX", "TUR"],
  iberia: ["ESP", "PRT"],
  gaul: ["FRA", "BEL"],
};

// Seas and oceans, which a label on a country should never name.
const SEAS = ["pacific", "atlantic", "indian ocean", "arctic", "black sea", "red sea", "caspian", "baltic", "north sea", "caribbean"];

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const names = (label: string, name: string) => new RegExp(`(^|[^\\p{L}])${escape(name)}($|[^\\p{L}])`, "u").test(label);

// Why a label does not fit the country it colors, or null when it does: it names another country, or a region
// the country does not lie in, like China labeled "Central Asia".
export function labelMismatch(label: string, country: string): string | null {
  const text = label.toLowerCase();
  const own = COUNTRIES[country]?.name ?? country;
  const sea = SEAS.find((name) => names(text, name));
  if (sea) return `${sea} is a sea, not part of ${own}`;
  for (const [region, members] of Object.entries(REGIONS)) {
    if (names(text, region) && !members.includes(country)) return `${own} is not in ${region}`;
  }
  for (const [code, entry] of Object.entries(COUNTRIES)) {
    const other = entry.name.toLowerCase();
    // "Papua New Guinea" names Guinea, but only as part of its own name.
    if (code !== country && names(text, other) && !own.toLowerCase().includes(other)) return `it names ${entry.name}, not ${own}`;
  }
  // Other names count too: "Rome" on Romania (ROU) means Italy.
  for (const [code, aliases] of Object.entries(COUNTRY_ALIASES)) {
    const alias = aliases.find((name) => names(text, name));
    if (code !== country && alias && !(COUNTRY_ALIASES[country] ?? []).includes(alias)) {
      return `"${alias}" is in ${COUNTRIES[code]?.name ?? code}, not ${own}`;
    }
  }
  return null;
}

// Other names a text may use for a country, where its own name does not match: "French" for France.
export const COUNTRY_ALIASES: Record<string, string[]> = {
  FRA: ["french", "gaul"],
  ESP: ["spanish", "iberia"],
  GRC: ["greek"],
  NLD: ["dutch"],
  GBR: ["british", "britain", "england", "english"],
  USA: ["american", "america", "united states"],
  TUR: ["turkey", "turkish", "ottoman", "anatolia", "byzantine", "constantinople"],
  IRN: ["persia", "persian"],
  ITA: ["rome", "roman", "venice", "genoa"],
  IRQ: ["mesopotamia", "baghdad"],
};

// Continents, seas, rivers and other places a world map shows that are not countries.
const FEATURES = [
  "europe", "european", "asia", "asian", "africa", "african", "americas", "north america", "south america", "australia",
  "mediterranean", "atlantic", "pacific", "indian ocean", "arctic", "black sea", "red sea", "caspian", "baltic", "north sea",
  "caribbean", "sahara", "himalaya", "himalayas", "alps", "andes", "nile", "danube", "rhine", "yangtze", "amazon", "silk road",
];

// Well-known cities and historic places, so a scene that only names cities still counts as being about places.
const CITIES = [
  // Europe
  "athens", "sparta", "rome", "pompeii", "florence", "venice", "genoa", "milan", "naples", "messina", "palermo", "pisa",
  "paris", "versailles", "lyon", "marseille", "strasbourg", "orleans", "normandy", "london", "york", "edinburgh", "dublin",
  "berlin", "munich", "hamburg", "leipzig", "nuremberg", "vienna", "prague", "budapest", "warsaw", "krakow", "moscow",
  "st. petersburg", "petrograd", "leningrad", "stalingrad", "kyiv", "kiev", "kaffa", "feodosia", "sevastopol", "madrid",
  "barcelona", "seville", "cadiz", "palos", "granada", "valencia", "lisbon", "amsterdam", "brussels", "waterloo", "geneva",
  "zurich", "stockholm", "copenhagen", "oslo", "constantinople", "istanbul", "byzantium", "troy", "ragusa", "dubrovnik",
  "belgrade", "sarajevo", "bucharest", "auschwitz", "dunkirk", "verdun", "gallipoli", "bastille",
  // Africa and the Middle East
  "cairo", "alexandria", "giza", "thebes", "luxor", "memphis", "carthage", "tunis", "timbuktu", "marrakesh",
  "tangier", "jerusalem", "bethlehem", "mecca", "medina", "damascus", "aleppo", "antioch", "baghdad", "babylon", "nineveh",
  "ur", "persepolis", "tehran", "isfahan", "basra", "beirut", "petra", "suez", "addis ababa", "zanzibar", "cape town",
  "johannesburg", "lagos", "kinshasa", "nairobi",
  // Asia
  "samarkand", "bukhara", "kashgar", "dunhuang", "xi'an", "chang'an", "lanzhou", "beijing", "peking", "nanjing",
  "shanghai", "hong kong", "canton", "guangzhou", "hangzhou", "karakorum", "khanbaliq", "tokyo", "edo", "kyoto",
  "hiroshima", "nagasaki", "seoul", "pyongyang", "hanoi", "saigon", "bangkok", "angkor", "singapore", "malacca", "jakarta",
  "batavia", "manila", "delhi", "new delhi", "agra", "calcutta", "kolkata", "bombay", "mumbai", "madras", "calicut",
  "goa", "lahore", "karachi", "dhaka", "kabul", "kandahar", "balkh", "merv", "hormuz", "muscat", "aden",
  // The Americas and Oceania
  "new york", "washington", "boston", "philadelphia", "jamestown", "plymouth", "gettysburg", "chicago", "detroit",
  "los angeles", "san francisco", "houston", "cape canaveral", "pearl harbor", "honolulu", "new orleans", "havana",
  "mexico city", "tenochtitlan", "cusco", "machu picchu", "lima", "quito", "bogota", "caracas", "rio de janeiro",
  "sao paulo", "buenos aires", "santiago", "panama city", "montreal", "quebec", "toronto", "ottawa", "sydney",
  "melbourne", "auckland", "hispaniola", "guanahani", "san salvador", "la navidad",
];

// Whether a text names a place a map can show: a country, region, continent, sea or well-known city. A capitalized
// word that starts like a country's name counts ("Chinese" for China); four-letter names must match whole ("Iran").
export function namesAPlace(text: string): boolean {
  const lower = text.toLowerCase();
  if (Object.keys(REGIONS).some((region) => names(lower, region))) return true;
  if (FEATURES.some((feature) => names(lower, feature))) return true;
  if (CITIES.some((city) => names(lower, city))) return true;
  if (Object.values(COUNTRY_ALIASES).flat().some((alias) => names(lower, alias))) return true;
  return Object.values(COUNTRIES).some(({ name }) => {
    const word = name.split(/[^\p{L}]+/u).sort((a, b) => b.length - a.length)[0] ?? "";
    if (word.length < 4) return false;
    const start = word.length === 4 ? word : word.slice(0, 4);
    return new RegExp(`(^|[^\\p{L}])${escape(start)}${word.length === 4 ? "(?!\\p{L})" : ""}`, "u").test(text);
  });
}
