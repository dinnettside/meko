import { geoBounds, geoCentroid, geoMercator, geoPath } from "d3-geo";
import type { GeoProjection } from "d3-geo";
import { COUNTRIES } from "@/lib/countries";
import type { Scene } from "@/lib/storyboard";
import { countries, countryFeature, mainland, mapIdOf } from "@/lib/world";

type Box = [[number, number], [number, number]];

export type MapLayout = {
  projection: GeoProjection;
  paths: { code: string | null; d: string }[]; // every country, with its ISO code when it has one
  pointOf: (code: string) => [number, number] | null; // the middle of a country's mainland, on screen
  project: (lon: number, lat: number) => [number, number] | null;
};

const codeByMapId = new Map(Object.entries(COUNTRIES).map(([code, entry]) => [entry.mapId, code]));

// Every country a map scene mentions. The camera fits all of them, not only the ones in `frame`.
export function mapCodes(scene: Extract<Scene, { kind: "map" }>): string[] {
  return [
    ...new Set([
      ...scene.frame,
      ...scene.highlights.map((highlight) => highlight.country),
      ...(scene.arrows ?? []).flatMap((arrow) => [arrow.from, arrow.to]),
    ]),
  ];
}

// A Mercator projection that fits the given countries inside the box.
export function fitProjection(frameCodes: string[], box: Box): GeoProjection {
  const focus = frameCodes
    .map((code) => countryFeature(code))
    .flatMap((country) => (country ? [mainland(country)] : []))
    .filter((shape) => shape !== null);
  const collection = { type: "FeatureCollection" as const, features: focus };
  // Turn the globe so the countries sit in the middle. Without this, a country that crosses the 180th
  // meridian, like Russia, is cut in two and the camera has to show the whole world.
  const [[west], [east]] = geoBounds(collection);
  const middle = focus.length === 0 ? 0 : west <= east ? (west + east) / 2 : (west + east + 360) / 2;
  const projection = geoMercator().rotate([-middle, 0]);
  if (focus.length > 0) projection.fitExtent(box, collection);
  return projection;
}

// Where the camera starts when a map follows another map: the zoom and shift that make this map show what the
// map before it showed, so the camera can fly from there. Two Mercator maps differ only by a zoom and a shift,
// as long as the countries in view do not cross the map's edge, which is on the far side of the world.
export function cameraFrom(previous: GeoProjection, current: GeoProjection): { scale: number; x: number; y: number } {
  const scale = previous.scale() / current.scale();
  const [previousX, previousY] = previous.translate();
  const [currentX, currentY] = current.translate();
  const turnDegrees = ((((previous.rotate()[0] - current.rotate()[0]) % 360) + 540) % 360) - 180;
  return {
    scale,
    x: previousX - scale * currentX + previous.scale() * ((turnDegrees * Math.PI) / 180),
    y: previousY - scale * currentY,
  };
}

// Fits a Mercator projection to the given countries inside the box, and projects every country.
export function layoutMap(frameCodes: string[], box: Box): MapLayout {
  const projection = fitProjection(frameCodes, box);
  const path = geoPath(projection);

  return {
    projection,
    paths: countries.map((country) => ({ code: codeByMapId.get(mapIdOf(country)) ?? null, d: path(country) ?? "" })),
    pointOf: (code) => {
      const country = countryFeature(code);
      const shape = country ? mainland(country) : null;
      return shape ? (projection(geoCentroid(shape)) ?? null) : null;
    },
    project: (lon, lat) => projection([lon, lat]) ?? null,
  };
}
