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
  TUR: ["turkey", "turkish", "turk", "ottoman", "anatolia", "byzantine", "constantinople"],
  IRN: ["persia", "persian"],
  ITA: ["rome", "roman", "venice", "genoa"],
  IRQ: ["mesopotamia", "baghdad"],
};

// Continents, seas, rivers and other places a world map shows that are not countries.
const FEATURES = [
  "europe", "european", "asia", "asian", "africa", "african", "americas", "north america", "south america", "australia",
  "mediterranean", "atlantic", "pacific", "indian ocean", "arctic", "black sea", "red sea", "caspian", "baltic", "north sea",
  "caribbean", "sahara", "himalaya", "himalayas", "alps", "andes", "nile", "danube", "rhine", "yangtze", "amazon", "silk road",
  "eurasia", "scandinavian", "balkan", "sahel", "gobi", "urals", "steppe", "steppes", "great plains", "rockies", "tigris",
  "euphrates", "indus", "ganges", "mekong", "volga", "mississippi", "bohemia", "flanders", "transylvania", "silesia",
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

// What people and things from a country are called, so "the Chinese" or "Soviet" name a country too. Only used to
// tell whether a text is about a place; labels are checked against COUNTRY_ALIASES above.
const DEMONYMS: Record<string, string[]> = {
  CHN: ["chinese"], DEU: ["german", "germans", "prussia", "prussian"], ITA: ["italian", "italians"], RUS: ["russian", "russians", "soviet", "soviets", "ussr"],
  GBR: ["scotland", "scottish", "wales", "welsh"], JPN: ["japanese"], IND: ["indian"], EGY: ["egyptian", "egyptians"],
  IRN: ["iranian"], IRQ: ["iraqi"], SAU: ["saudi"], MNG: ["mongol", "mongols", "mongolian"], KOR: ["korean", "koreans"],
  VNM: ["vietnamese"], POL: ["polish"], PRT: ["portuguese"], SWE: ["swedish", "swedes"], NOR: ["norwegian"], DNK: ["danish"],
  MEX: ["mexican", "aztec", "aztecs"], BRA: ["brazilian"], CAN: ["canadian"], AUS: ["australian"], ISR: ["israeli"], SYR: ["syrian"],
  AFG: ["afghan"], PAK: ["pakistani"], CUB: ["cuban"], UKR: ["ukrainian"], AUT: ["austrian", "habsburg"], HUN: ["hungarian"],
  CZE: ["czech"], PER: ["peruvian", "inca", "incas"], ARG: ["argentine"], CHL: ["chilean"], NGA: ["nigerian"], ETH: ["ethiopian"],
  KEN: ["kenyan"], ZAF: ["south african"], MAR: ["moroccan"], DZA: ["algerian"], TUN: ["tunisian"], LBY: ["libyan"],
  SDN: ["sudanese"], THA: ["thai", "siam"], KHM: ["cambodian", "khmer"], IDN: ["indonesian"], PHL: ["filipino"],
  MYS: ["malaysian"], FIN: ["finnish"], IRL: ["irish"], BEL: ["belgian"], CHE: ["swiss"],
};

// Whether a text names a country: its whole name ("China", not "Chil..." in "Children"), another name for it
// ("Persia"), or what its people are called, one or many ("Chinese", "the Persians"). Short names like "US" must
// match in capitals, so "us" does not count.
export function namesCountry(text: string, code: string): boolean {
  const name = COUNTRIES[code]?.name ?? "";
  const lower = text.toLowerCase();
  if (name.length <= 3 ? names(text, name) : names(lower, name.toLowerCase())) return true;
  if (code === "USA" && /\bU\.S\.(?:A\.)?|\bUSA\b/.test(text)) return true;
  return [...(COUNTRY_ALIASES[code] ?? []), ...(DEMONYMS[code] ?? [])].some((other) => names(lower, other) || names(lower, `${other}s`));
}

// The names a country goes by in English, besides the short ones in COUNTRIES ("US", "UK", "Türkiye").
const COMMON_NAMES: Record<string, string[]> = {
  USA: ["united states", "united states of america", "usa", "u.s.", "america"],
  GBR: ["united kingdom", "britain", "great britain"],
  TUR: ["turkey"],
  KOR: ["south korea", "korea"],
  PRK: ["north korea"],
  CZE: ["czech republic", "czechia"],
  NLD: ["netherlands", "the netherlands", "holland"],
  RUS: ["russia", "russian federation"],
  IRN: ["iran"],
  MMR: ["myanmar", "burma"],
  CIV: ["ivory coast"],
  COD: ["congo", "dr congo"],
  MKD: ["north macedonia"],
};

// Whether a text names a region or a part of the country, like "Crimea" for Ukraine or "Texas" for the US.
export function namesRegionOf(text: string, code: string): boolean {
  const lower = text.toLowerCase();
  return Object.entries(REGIONS).some(([region, members]) => members.includes(code) && names(lower, region)) || partPoint(text, code) !== null;
}

// Whether a text is the name of the country itself, as COUNTRIES or common English gives it ("Panama", "Turkey"),
// not one of its other names, some of which are cities, like Constantinople or Rome.
export function isCountryOwnName(text: string, code: string): boolean {
  const lower = text.trim().toLowerCase().replace(/^the\s+/, "");
  return [COUNTRIES[code]?.name.toLowerCase() ?? "", ...(COMMON_NAMES[code] ?? [])].includes(lower);
}

// Whether a map label is just the name of the country it is on: its name in COUNTRIES, another name for it or its
// common English name, like "Turkey" on TUR. A country may always carry its own name.
export function isCountryName(label: string, code: string): boolean {
  const text = label.trim().toLowerCase().replace(/^the\s+/, "");
  return [COUNTRIES[code]?.name.toLowerCase() ?? "", ...(COUNTRY_ALIASES[code] ?? []), ...(COMMON_NAMES[code] ?? [])].includes(text);
}

// Whether a text names a place a map can show: a country, region, continent, sea, well-known city or a part of a
// country like Sicily or Punjab. Antarctica does not count, because the maps cannot draw it.
export function namesAPlace(text: string): boolean {
  const lower = text.toLowerCase();
  if (Object.keys(REGIONS).some((region) => names(lower, region))) return true;
  if (FEATURES.some((feature) => names(lower, feature))) return true;
  if (CITIES.some((city) => names(lower, city))) return true;
  if (PARTS.some((part) => names(lower, part.name))) return true;
  return Object.keys(COUNTRIES).some((code) => code !== "ATA" && namesCountry(text, code));
}

// Names in CITIES that may still label a whole country: cities that stand for a state or an empire in history, like
// Carthage or Sparta, and regions, like Normandy.
const NOT_ONLY_CITIES = new Set([
  "athens", "sparta", "rome", "carthage", "troy", "babylon", "nineveh", "thebes", "memphis", "ur", "persepolis", "antioch",
  "venice", "genoa", "florence", "pisa", "ragusa", "dubrovnik", "byzantium", "constantinople", "timbuktu", "angkor",
  "malacca", "normandy", "gallipoli", "zanzibar", "goa", "hispaniola", "guanahani", "quebec",
]);

// Whether a map label on a country names a city in it, like "Berlin" on Germany. Coloring a whole country to point at
// one city misleads, so cities go in markers.
export function namesCity(label: string, country: string): boolean {
  const text = label.toLowerCase();
  const aliases = COUNTRY_ALIASES[country] ?? [];
  return CITIES.some((city) => names(text, city) && !NOT_ONLY_CITIES.has(city) && !aliases.includes(city));
}

// Parts of a country that lie away from its middle, with a point on each. A map label that names one is drawn there,
// so "Alaska" lands on Alaska and not in Kansas.
const PARTS: { name: string; countries: string[]; at: [number, number] }[] = [
  { name: "alaska", countries: ["USA"], at: [-152, 64.5] },
  { name: "hawaii", countries: ["USA"], at: [-157, 20.8] },
  { name: "aleutian islands", countries: ["USA"], at: [-174, 52] },
  { name: "florida", countries: ["USA"], at: [-81.6, 28.2] },
  { name: "texas", countries: ["USA"], at: [-99.3, 31.3] },
  { name: "california", countries: ["USA"], at: [-119.6, 37.2] },
  { name: "new england", countries: ["USA"], at: [-71.5, 43.7] },
  { name: "crimea", countries: ["UKR", "RUS"], at: [34.2, 45.3] },
  { name: "siberia", countries: ["RUS"], at: [100, 62] },
  { name: "kamchatka", countries: ["RUS"], at: [159, 56] },
  { name: "sakhalin", countries: ["RUS"], at: [142.9, 50.5] },
  { name: "kaliningrad", countries: ["RUS"], at: [21.0, 54.7] },
  { name: "sicily", countries: ["ITA"], at: [14.2, 37.6] },
  { name: "sardinia", countries: ["ITA"], at: [9.0, 40.1] },
  { name: "tuscany", countries: ["ITA"], at: [11.0, 43.4] },
  { name: "lombardy", countries: ["ITA"], at: [9.8, 45.6] },
  { name: "corsica", countries: ["FRA"], at: [9.1, 42.2] },
  { name: "brittany", countries: ["FRA"], at: [-3.0, 48.2] },
  { name: "provence", countries: ["FRA"], at: [6.0, 43.9] },
  { name: "catalonia", countries: ["ESP"], at: [1.5, 41.8] },
  { name: "andalusia", countries: ["ESP"], at: [-4.6, 37.4] },
  { name: "balearic islands", countries: ["ESP"], at: [2.9, 39.6] },
  { name: "canary islands", countries: ["ESP"], at: [-15.6, 28.3] },
  { name: "bavaria", countries: ["DEU"], at: [11.5, 48.8] },
  { name: "crete", countries: ["GRC"], at: [24.9, 35.2] },
  { name: "scotland", countries: ["GBR"], at: [-4.2, 56.8] },
  { name: "wales", countries: ["GBR"], at: [-3.7, 52.3] },
  { name: "northern ireland", countries: ["GBR"], at: [-6.7, 54.6] },
  { name: "svalbard", countries: ["NOR"], at: [16, 78.5] },
  { name: "kashmir", countries: ["IND", "PAK"], at: [75, 34.3] },
  { name: "punjab", countries: ["IND", "PAK"], at: [74, 31] },
  { name: "bengal", countries: ["IND", "BGD"], at: [89, 23.5] },
  { name: "tibet", countries: ["CHN"], at: [88, 31.5] },
  { name: "xinjiang", countries: ["CHN"], at: [85, 41.5] },
  { name: "manchuria", countries: ["CHN"], at: [126, 45] },
  { name: "hainan", countries: ["CHN"], at: [109.8, 19.2] },
  { name: "hokkaido", countries: ["JPN"], at: [142.8, 43.4] },
  { name: "okinawa", countries: ["JPN"], at: [127.9, 26.5] },
  { name: "java", countries: ["IDN"], at: [110, -7.4] },
  { name: "sumatra", countries: ["IDN"], at: [101.5, -0.2] },
  { name: "bali", countries: ["IDN"], at: [115.1, -8.4] },
  { name: "borneo", countries: ["IDN", "MYS"], at: [114, 1] },
  { name: "papua", countries: ["IDN"], at: [138.5, -4.5] },
  { name: "tasmania", countries: ["AUS"], at: [146.6, -42.0] },
  { name: "patagonia", countries: ["ARG", "CHL"], at: [-69, -45] },
  { name: "yucatan", countries: ["MEX"], at: [-89, 20.3] },
  { name: "zanzibar", countries: ["TZA"], at: [39.3, -6.1] },
];

// Where a label on a country goes when it names one of the parts above, as [longitude, latitude], or null.
export function partPoint(label: string, country: string): [number, number] | null {
  const text = label.toLowerCase();
  return PARTS.find((part) => part.countries.includes(country) && names(text, part.name))?.at ?? null;
}
