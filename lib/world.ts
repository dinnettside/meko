import { geoArea, geoCentroid, geoContains, geoDistance } from "d3-geo";
import type { Feature, FeatureCollection, Geometry, MultiPolygon, Polygon, Position } from "geojson";
import { feature, merge } from "topojson-client";
import type {
  GeometryCollection,
  MultiPolygon as TopoMultiPolygon,
  Polygon as TopoPolygon,
  Topology,
} from "topojson-specification";
import atlas from "world-atlas/countries-50m.json";
import { COUNTRIES } from "./countries.ts";

// Country shapes from world-atlas (Natural Earth, public domain). Borders are modern ones.
// Used by the map scenes and by the server to check map markers.

export type CountryFeature = Feature<Geometry, { name: string }>;
export type CountryTopology = Topology<{ countries: GeometryCollection<{ name: string }> }>;

const RUSSIA = "643";
const UKRAINE = "804";
const SIMFEROPOL: [number, number] = [34.1, 44.95];

// The country shapes in a world-atlas file, and the shape of Crimea. Natural Earth draws Crimea as part of Russia.
// These maps follow the borders the UN recognizes, so Crimea is moved to Ukraine.
export function countryShapes(topology: CountryTopology): { shapes: CountryFeature[]; crimea: Feature<Polygon> | null } {
  const shapes = (feature(topology, topology.objects.countries) as FeatureCollection<Geometry, { name: string }>).features;
  const russia = topology.objects.countries.geometries.find((geometry) => geometry.id === RUSSIA);
  const ukraine = topology.objects.countries.geometries.find((geometry) => geometry.id === UKRAINE);
  if (russia?.type !== "MultiPolygon" || (ukraine?.type !== "Polygon" && ukraine?.type !== "MultiPolygon")) {
    return { shapes, crimea: null };
  }
  const index = russia.arcs.findIndex((arcs) => geoContains(feature(topology, { type: "Polygon", arcs }), SIMFEROPOL));
  if (index === -1) return { shapes, crimea: null };
  const crimea: TopoPolygon = { type: "Polygon", arcs: russia.arcs[index] };
  const rest: TopoMultiPolygon<{ name: string }> = { ...russia, arcs: russia.arcs.filter((_, other) => other !== index) };
  return {
    shapes: shapes.map((country) => {
      if (country.id === RUSSIA) return feature(topology, rest);
      if (country.id === UKRAINE) return { ...country, geometry: merge(topology, [ukraine, crimea]) };
      return country;
    }),
    crimea: feature(topology, crimea),
  };
}

const topology = atlas as unknown as CountryTopology;
const { shapes, crimea } = countryShapes(topology);

// Antarctica is left out: it only gets in the way, and Mercator maps cannot show it.
export const countries: CountryFeature[] = shapes.filter((country) => country.id !== "010");

// world-atlas uses numeric IDs, and Kosovo has none, so it is found by name.
export const mapIdOf = (country: CountryFeature) => String(country.id ?? country.properties.name);

// Two shapes share Australia's ID; the other is the tiny Ashmore and Cartier Islands. The biggest shape wins, so a map
// of Australia shows Australia.
const byMapId = new Map<string, CountryFeature>();
for (const country of countries) {
  const known = byMapId.get(mapIdOf(country));
  if (!known || geoArea(country) > geoArea(known)) byMapId.set(mapIdOf(country), country);
}

export function countryFeature(code: string): CountryFeature | undefined {
  const entry = COUNTRIES[code];
  return entry ? byMapId.get(entry.mapId) : undefined;
}

// Whether a map can draw this country. Every code in COUNTRIES can except Antarctica's.
export const canDraw = (code: string) => countryFeature(code) !== undefined;

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

// How far a part of a country may lie from the parts already colored and still be colored with them.
const HOMELAND_KM = 2800;
const EARTH_RADIUS_KM = 6371;
const MAX_COAST_POINTS = 500;
const homelands = new WeakMap<Feature<Geometry>, Feature<Polygon | MultiPolygon> | null>();

const kmBetween = (a: Position, b: Position) => geoDistance([a[0], a[1]], [b[0], b[1]]) * EARTH_RADIUS_KM;

// The parts of a country that belong together. Alaska, Sicily and Papua are colored with their countries, but French
// Guiana, Reunion and Hawaii are not, so coloring France does not color a patch of South America. Starting from the
// largest part, a part is kept when it lies near a part already kept. Distances to the largest part are measured to
// its coast, because its middle can be far inland.
export function homeland(country: Feature<Geometry>): Feature<Polygon | MultiPolygon> | null {
  const known = homelands.get(country);
  if (known !== undefined) return known;
  const shape = findHomeland(country.geometry);
  homelands.set(country, shape);
  return shape;
}

function findHomeland(geometry: Geometry): Feature<Polygon | MultiPolygon> | null {
  if (geometry.type === "Polygon") return { type: "Feature", properties: {}, geometry };
  if (geometry.type !== "MultiPolygon") return null;
  const parts = geometry.coordinates.map((coordinates) => {
    const polygon = { type: "Polygon" as const, coordinates };
    return { coordinates, area: geoArea(polygon), center: geoCentroid(polygon) };
  });
  const largest = parts.reduce((best, part) => (part.area > best.area ? part : best));
  const ring = largest.coordinates[0];
  const step = Math.ceil(ring.length / MAX_COAST_POINTS);
  const coast = ring.filter((_, index) => index % step === 0);
  const nearCoast = (center: Position) => coast.some((point) => kmBetween(center, point) <= HOMELAND_KM);

  const kept = new Set(parts.filter((part) => part === largest || nearCoast(part.center)));
  const nearKept = (center: Position) => [...kept].some((other) => kmBetween(center, other.center) <= HOMELAND_KM);
  // Each round keeps the parts near a part kept before, so this ends after at most one round per part.
  for (let grew = true; grew; ) {
    grew = false;
    for (const part of parts) {
      if (kept.has(part) || !nearKept(part.center)) continue;
      kept.add(part);
      grew = true;
    }
  }
  const coordinates = parts.filter((part) => kept.has(part)).map((part) => part.coordinates);
  return { type: "Feature", properties: {}, geometry: { type: "MultiPolygon", coordinates } };
}

// True if the point lies in the shape, or within about 30 km of it, because coastlines on this map are simplified.
function isNear(shape: Feature<Geometry>, lon: number, lat: number): boolean {
  const offsets = [0, -0.3, 0.3];
  return offsets.some((dLon) => offsets.some((dLat) => geoContains(shape, [lon + dLon, lat + dLat])));
}

// True if the point lies in the country. A place in Crimea counts for Russia too, as in a history of the Crimean War.
export function countryContains(code: string, lon: number, lat: number): boolean {
  const country = countryFeature(code);
  if (!country) return false;
  return isNear(country, lon, lat) || (code === "RUS" && crimea !== null && isNear(crimea, lon, lat));
}

// The middle of a country's mainland, as [longitude, latitude].
export function countryCenter(code: string): [number, number] | null {
  const country = countryFeature(code);
  const shape = country ? mainland(country) : null;
  return shape ? geoCentroid(shape) : null;
}
