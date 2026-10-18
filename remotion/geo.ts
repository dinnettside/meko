import { geoBounds, geoCentroid, geoContains, geoDistance, geoInterpolate, geoMercator, geoPath } from "d3-geo";
import type { GeoProjection } from "d3-geo";
import type { Feature, Geometry } from "geojson";
import { COUNTRIES } from "@/lib/countries";
import { yearsIn } from "@/lib/numbers";
import { partPoint } from "@/lib/regions";
import { seaPath } from "@/lib/sea-routes";
import type { Scene } from "@/lib/storyboard";
import { countries, countryContains, countryFeature, homeland, mainland, mapIdOf } from "@/lib/world";

type Box = [[number, number], [number, number]];
type MapSceneData = Extract<Scene, { kind: "map" }>;
type Route = NonNullable<MapSceneData["routes"]>[number];
type LonLat = [number, number];

// How much room the camera leaves around a part of a country that a label names, in degrees, so the part and its
// label are in view and not on the edge.
const PART_MARGIN = 2;
// Coastlines on this map are simplified, so a port can lie just off its country's coast. About 30 km still counts.
const NEAR_OFFSETS = [-0.3, 0, 0.3];
// A sea route is drawn along great circles with a point about every 40 km, and its corners rounded over about as far.
const SEA_STEP = 40 / 6371;

export type MapLayout = {
  projection: GeoProjection;
  paths: { code: string | null; d: string }[]; // every country, with its ISO code when it has one
  homePathOf: (code: string) => string; // a country without its overseas territories, for coloring it
  pointOf: (code: string) => [number, number] | null; // the middle of a country's mainland, on screen
  project: (lon: number, lat: number) => [number, number] | null;
};

const codeByMapId = new Map(Object.entries(COUNTRIES).map(([code, entry]) => [entry.mapId, code]));

// Every country a map scene mentions. The camera fits all of them, not only the ones in `frame`.
export function mapCodes(scene: MapSceneData): string[] {
  return [
    ...new Set([
      ...scene.frame,
      ...scene.highlights.map((highlight) => highlight.country),
      ...(scene.arrows ?? []).flatMap((arrow) => [arrow.from, arrow.to]),
    ]),
  ];
}

// The places a map scene must show besides its countries, as [longitude, latitude]: the parts of countries that its
// labels name, like Alaska for "Alaska" on the United States, and every route, whose sea legs can swing far from
// their stops, like around Africa. Labels and arrows go to those parts, so the camera shows them too, even a part
// the map does not color, like Hawaii.
// The year a map scene's narration is about, its latest year, so a sea route only uses the canals open then.
export function sceneYear(scene: MapSceneData): number | undefined {
  const years = yearsIn(scene.narration);
  return years.length > 0 ? Math.max(...years) : undefined;
}

export function mapPoints(scene: MapSceneData): LonLat[] {
  const parts = scene.highlights.flatMap((highlight) => {
    const part = partPoint(highlight.label ?? "", highlight.country);
    return part ? [part] : [];
  });
  // Every eighth point of a route, about every 80 km at sea, is enough for the camera.
  const routes = (scene.routes ?? []).flatMap((route) =>
    routeLegs(route, route.year ?? sceneYear(scene)).flatMap((leg) => leg.filter((_, index) => index % 8 === 0 || index === leg.length - 1)),
  );
  return [...parts, ...routes];
}

// The way a route goes, leg by leg, as [longitude, latitude] points from one stop to the next. A land leg is just its
// two stops, since the scene draws one smooth curve through all of them. A sea leg goes through water, along the
// shortest way through the sea lanes (lib/sea-routes.ts), with its corners rounded so it does not look jagged.
export function routeLegs(route: Route, year?: number): LonLat[][] {
  const stops = route.stops.map((stop): LonLat => [stop.lon, stop.lat]);
  return stops.slice(1).map((to, index) => {
    const from = stops[index];
    return route.by === "sea" ? roundCorners(alongGreatCircles(seaPath(from, to, year))) : [from, to];
  });
}

// Points close together along the great circles between the given points. Longitudes stay continuous across the
// 180th meridian, so a route across the Pacific is one line.
function alongGreatCircles(points: LonLat[]): LonLat[] {
  const line: LonLat[] = [points[0]];
  for (let index = 1; index < points.length; index++) {
    const along = geoInterpolate(points[index - 1], points[index]);
    const steps = Math.max(1, Math.ceil(geoDistance(points[index - 1], points[index]) / SEA_STEP));
    for (let step = 1; step <= steps; step++) {
      const [lon, lat] = along(step / steps);
      const before = line[line.length - 1][0];
      line.push([lon + 360 * Math.round((before - lon) / 360), lat]);
    }
  }
  return line;
}

// Cuts every corner of a line a quarter of the way along both its sides, twice over (Chaikin's method). The ends stay.
function roundCorners(points: LonLat[]): LonLat[] {
  let line = points;
  for (let round = 0; round < 2; round++) {
    const next: LonLat[] = [line[0]];
    for (let index = 1; index < line.length; index++) {
      const [a, b] = [line[index - 1], line[index]];
      next.push([0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]]);
      next.push([0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]]);
    }
    next.push(line[line.length - 1]);
    line = next;
  }
  return line;
}

// Which of the given countries a place lies in, as the map draws them, or null. A country the place lies inside wins
// over one it only lies near, so a border city like Strasbourg is in France and not in Germany, and each place is in
// one country only. Only when no country has it does a place in Crimea count for Russia, as in a map of the Crimean
// War; with Ukraine on the map it is in Ukraine, where the map draws it.
export function countryOf(codes: string[], lon: number, lat: number): string | null {
  const isIn = (code: string, dLon: number, dLat: number) => {
    const country = countryFeature(code);
    return country !== undefined && geoContains(country, [lon + dLon, lat + dLat]);
  };
  const isNear = (code: string) => NEAR_OFFSETS.some((dLon) => NEAR_OFFSETS.some((dLat) => isIn(code, dLon, dLat)));
  return (
    codes.find((code) => isIn(code, 0, 0)) ??
    codes.find(isNear) ??
    codes.find((code) => countryContains(code, lon, lat)) ??
    null
  );
}

// A Mercator projection that fits the given countries inside the box, and the area around the given points.
export function fitProjection(frameCodes: string[], box: Box, points: LonLat[] = []): GeoProjection {
  const focus: Feature<Geometry>[] = frameCodes
    .map((code) => countryFeature(code))
    .flatMap((country) => (country ? [mainland(country)] : []))
    .filter((shape) => shape !== null);
  // With no country it can draw, the map shows the whole world rather than a corner of it.
  if (focus.length === 0) return geoMercator().fitExtent(box, { type: "FeatureCollection", features: countries });
  for (const [lon, lat] of points) {
    const corners: LonLat[] = [[lon - PART_MARGIN, lat - PART_MARGIN], [lon + PART_MARGIN, lat + PART_MARGIN]];
    focus.push({ type: "Feature", properties: {}, geometry: { type: "MultiPoint", coordinates: corners } });
  }
  const collection = { type: "FeatureCollection" as const, features: focus };
  // Turn the globe so the countries sit in the middle. Without this, a country that crosses the 180th
  // meridian, like Russia, is cut in two and the camera has to show the whole world.
  const [[west], [east]] = geoBounds(collection);
  const middle = west <= east ? (west + east) / 2 : (west + east + 360) / 2;
  return geoMercator().rotate([-middle, 0]).fitExtent(box, collection);
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

// Fits a Mercator projection to the given countries and points inside the box, and projects every country.
export function layoutMap(frameCodes: string[], box: Box, points: LonLat[] = []): MapLayout {
  const projection = fitProjection(frameCodes, box, points);
  const path = geoPath(projection);

  return {
    projection,
    paths: countries.map((country) => ({ code: codeByMapId.get(mapIdOf(country)) ?? null, d: path(country) ?? "" })),
    homePathOf: (code) => {
      const country = countryFeature(code);
      const shape = country ? homeland(country) : null;
      return shape ? (path(shape) ?? "") : "";
    },
    pointOf: (code) => {
      const country = countryFeature(code);
      const shape = country ? mainland(country) : null;
      return shape ? (projection(geoCentroid(shape)) ?? null) : null;
    },
    project: (lon, lat) => projection([lon, lat]) ?? null,
  };
}
