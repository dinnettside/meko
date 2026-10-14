import { geoCentroid } from "d3-geo";
import type { FeatureCollection, Geometry } from "geojson";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import atlas from "world-atlas/countries-110m.json";
import { COUNTRIES } from "@/lib/countries";
import { homeland } from "@/lib/world";

// Coarse country shapes for the turning globe in the opening. The globe is redrawn every frame, and at its size
// the coarse shapes look the same as the detailed ones.

const topology = atlas as unknown as Topology<{ countries: GeometryCollection<{ name: string }> }>;
const world = feature(topology, topology.objects.countries) as FeatureCollection<Geometry, { name: string }>;
const codeByMapId = new Map(Object.entries(COUNTRIES).map(([code, entry]) => [entry.mapId, code]));

export const globeCountries = world.features.map((country) => ({
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
