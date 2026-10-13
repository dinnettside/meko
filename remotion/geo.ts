import { geoArea, geoCentroid, geoMercator, geoPath } from "d3-geo";
import type { Feature, FeatureCollection, Geometry, MultiPolygon, Polygon } from "geojson";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import atlas from "world-atlas/countries-50m.json";
import { COUNTRIES } from "@/lib/countries";

// Country shapes from world-atlas (Natural Earth, public domain). Borders are modern ones.

type CountryFeature = Feature<Geometry, { name: string }>;

const topology = atlas as unknown as Topology<{ countries: GeometryCollection<{ name: string }> }>;
const world = feature(topology, topology.objects.countries) as FeatureCollection<Geometry, { name: string }>;

// Antarctica only gets in the way on these maps.
const countries: CountryFeature[] = world.features.filter((country) => country.id !== "010");

// world-atlas uses numeric IDs, and Kosovo has none, so it is found by name.
const byMapId = new Map(countries.map((country) => [String(country.id ?? country.properties.name), country]));

export function countryFeature(code: string): CountryFeature | undefined {
  const entry = COUNTRIES[code];
  return entry ? byMapId.get(entry.mapId) : undefined;
}

// The big parts of a country, so overseas territories (like French Guiana for France) don't pull the camera away.
export function mainland(country: CountryFeature): Feature<Polygon | MultiPolygon> | null {
  const geometry = country.geometry;
  if (geometry.type === "Polygon") return { type: "Feature", properties: {}, geometry };
  if (geometry.type !== "MultiPolygon") return null;
  const parts = geometry.coordinates.map((coordinates) => ({
    coordinates,
    area: geoArea({ type: "Polygon", coordinates }),
  }));
  const largest = Math.max(...parts.map((part) => part.area));
  const big = parts.filter((part) => part.area >= largest * 0.25).map((part) => part.coordinates);
  return { type: "Feature", properties: {}, geometry: { type: "MultiPolygon", coordinates: big } };
}

export type MapLayout = {
  paths: { code: string | null; d: string }[]; // every country, with its ISO code when it has one
  pointOf: (code: string) => [number, number] | null; // where to put a label or an arrow end for a country
};

const codeByMapId = new Map(Object.entries(COUNTRIES).map(([code, entry]) => [entry.mapId, code]));

// Fits a Mercator projection to the given countries inside the box, and projects every country.
export function layoutMap(frameCodes: string[], box: [[number, number], [number, number]]): MapLayout {
  const focus = frameCodes
    .map((code) => countryFeature(code))
    .flatMap((country) => (country ? [mainland(country)] : []))
    .filter((shape) => shape !== null);
  const projection = geoMercator();
  if (focus.length > 0) projection.fitExtent(box, { type: "FeatureCollection", features: focus });
  const path = geoPath(projection);

  return {
    paths: countries.map((country) => ({
      code: codeByMapId.get(String(country.id ?? country.properties.name)) ?? null,
      d: path(country) ?? "",
    })),
    pointOf: (code) => {
      const country = countryFeature(code);
      const shape = country ? mainland(country) : null;
      return shape ? (projection(geoCentroid(shape)) ?? null) : null;
    },
  };
}
