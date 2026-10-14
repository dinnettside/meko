import { geoArea, geoCentroid, geoContains, geoDistance } from "d3-geo";
import type { Feature, FeatureCollection, Geometry, MultiPolygon, Polygon } from "geojson";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import atlas from "world-atlas/countries-50m.json";
import { COUNTRIES } from "./countries.ts";

// Country shapes from world-atlas (Natural Earth, public domain). Borders are modern ones.
// Used by the map scenes and by the server to check map markers.

export type CountryFeature = Feature<Geometry, { name: string }>;

const topology = atlas as unknown as Topology<{ countries: GeometryCollection<{ name: string }> }>;
const world = feature(topology, topology.objects.countries) as FeatureCollection<Geometry, { name: string }>;

// Antarctica only gets in the way on these maps.
export const countries: CountryFeature[] = world.features.filter((country) => country.id !== "010");

// world-atlas uses numeric IDs, and Kosovo has none, so it is found by name.
export const mapIdOf = (country: CountryFeature) => String(country.id ?? country.properties.name);

const byMapId = new Map(countries.map((country) => [mapIdOf(country), country]));

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

// How far a part of a country may lie from its largest part and still be colored with it.
const HOMELAND_KM = 2500;
const EARTH_RADIUS_KM = 6371;

// The parts of a country near its largest part: Corsica and Sicily stay with France and Italy, but French Guiana
// and Reunion do not, so coloring France does not color a patch of South America.
export function homeland(country: Feature<Geometry>): Feature<Polygon | MultiPolygon> | null {
  const geometry = country.geometry;
  if (geometry.type === "Polygon") return { type: "Feature", properties: {}, geometry };
  if (geometry.type !== "MultiPolygon") return null;
  const parts = geometry.coordinates.map((coordinates) => {
    const polygon = { type: "Polygon" as const, coordinates };
    return { coordinates, area: geoArea(polygon), center: geoCentroid(polygon) };
  });
  const largest = parts.reduce((best, part) => (part.area > best.area ? part : best));
  const near = parts.filter((part) => geoDistance(part.center, largest.center) * EARTH_RADIUS_KM <= HOMELAND_KM);
  return { type: "Feature", properties: {}, geometry: { type: "MultiPolygon", coordinates: near.map((part) => part.coordinates) } };
}

// True if the point lies in the country, or within about 30 km of it, because coastlines on this map are simplified.
export function countryContains(code: string, lon: number, lat: number): boolean {
  const country = countryFeature(code);
  if (!country) return false;
  const offsets = [0, -0.3, 0.3];
  return offsets.some((dLon) => offsets.some((dLat) => geoContains(country, [lon + dLon, lat + dLat])));
}

// The middle of a country's mainland, as [longitude, latitude].
export function countryCenter(code: string): [number, number] | null {
  const country = countryFeature(code);
  const shape = country ? mainland(country) : null;
  return shape ? geoCentroid(shape) : null;
}
