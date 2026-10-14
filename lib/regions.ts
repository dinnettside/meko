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

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const names = (label: string, name: string) => new RegExp(`(^|[^\\p{L}])${escape(name)}($|[^\\p{L}])`, "u").test(label);

// Why a label does not fit the country it colors, or null when it does: it names another country, or a region
// the country does not lie in, like China labeled "Central Asia".
export function labelMismatch(label: string, country: string): string | null {
  const text = label.toLowerCase();
  const own = COUNTRIES[country]?.name ?? country;
  for (const [region, members] of Object.entries(REGIONS)) {
    if (names(text, region) && !members.includes(country)) return `${own} is not in ${region}`;
  }
  for (const [code, entry] of Object.entries(COUNTRIES)) {
    const other = entry.name.toLowerCase();
    // "Papua New Guinea" names Guinea, but only as part of its own name.
    if (code !== country && names(text, other) && !own.toLowerCase().includes(other)) return `it names ${entry.name}, not ${own}`;
  }
  return null;
}
