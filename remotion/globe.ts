import { geoCentroid } from "d3-geo";
import atlas from "world-atlas/countries-110m.json";
import { COUNTRIES } from "@/lib/countries";
import { countryShapes, homeland } from "@/lib/world";
import type { CountryTopology } from "@/lib/world";

// Coarse country shapes for the turning globe in the opening. The globe is redrawn every frame, and at its size
// the coarse shapes look the same as the detailed ones.

const { shapes } = countryShapes(atlas as unknown as CountryTopology);
const codeByMapId = new Map(Object.entries(COUNTRIES).map(([code, entry]) => [entry.mapId, code]));

export const globeCountries = shapes.map((country) => ({
  code: codeByMapId.get(String(country.id ?? country.properties.name)) ?? null,
  shape: country,
  // What is colored when the country is highlighted: not its overseas territories.
  home: homeland(country) ?? country,
}));

// Where the globe turns to: the middle of the given countries, as [longitude, latitude].
export function regionCenter(codes: string[]): [number, number] | null {
  const shapes = globeCountries.filter((country) => country.code && codes.includes(country.code)).map((c) => c.home);
  return shapes.length > 0 ? geoCentroid({ type: "FeatureCollection", features: shapes }) : null;
}
