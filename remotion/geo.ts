import { geoCentroid, geoMercator, geoPath } from "d3-geo";
import { COUNTRIES } from "@/lib/countries";
import { countries, countryFeature, mainland, mapIdOf } from "@/lib/world";

export type MapLayout = {
  paths: { code: string | null; d: string }[]; // every country, with its ISO code when it has one
  pointOf: (code: string) => [number, number] | null; // the middle of a country's mainland, on screen
  project: (lon: number, lat: number) => [number, number] | null;
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
    paths: countries.map((country) => ({ code: codeByMapId.get(mapIdOf(country)) ?? null, d: path(country) ?? "" })),
    pointOf: (code) => {
      const country = countryFeature(code);
      const shape = country ? mainland(country) : null;
      return shape ? (projection(geoCentroid(shape)) ?? null) : null;
    },
    project: (lon, lat) => projection([lon, lat]) ?? null,
  };
}
