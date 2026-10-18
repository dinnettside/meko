import { useId, useMemo } from "react";
import { AbsoluteFill, Html5Audio, Sequence, interpolateColors, useCurrentFrame, useVideoConfig } from "remotion";
import { COUNTRIES } from "@/lib/countries";
import type { TimedWord } from "@/lib/elevenlabs";
import { partPoint } from "@/lib/regions";
import type { Scene } from "@/lib/storyboard";
import { cameraFrom, countryOf, fitProjection, focusArea, layoutMap, mapCodes, mapPoints, mapProjection, routeLegs, sceneYear } from "../geo";
import type { MapLayout } from "../geo";
import { Hatch } from "../hatch";
import { Icon } from "../icons";
import { ease } from "../motion";
import { sounds } from "../sfx";
import { revealAt, revealTimes } from "../spoken";
import { alpha, useTheme } from "../theme";
import { MOTION, VIDEO } from "@/lib/theme";

type MapSceneData = Extract<Scene, { kind: "map" }>;
type Route = NonNullable<MapSceneData["routes"]>[number];
type Point = [number, number];
type Box = { x: number; y: number; w: number; h: number };
type LabelSpec = { text: string; strong: boolean; startSec: number; at: Point; offsets: Point[] };
type PlacedLabel = { text: string; strong: boolean; startSec: number; x: number; y: number };

const { width: WIDTH, height: HEIGHT, captionSpace: CAPTION_SPACE } = VIDEO;
const BOX: [[number, number], [number, number]] = [
  [VIDEO.mapPadding, 110],
  [WIDTH - VIDEO.mapPadding, HEIGHT - CAPTION_SPACE - 30],
];
// An arrow draws in a second, or faster when it starts late. It and its label must be done this long before the next
// scene starts to dissolve in over this one, so there is time to read them.
const ARROW_SEC = 1.0;
const FAST_ARROW_SEC = 0.6;
const READ_SEC = 0.8;
// Where an arrow meets a country whose middle is far from where its history mostly happened: Russia's is deep in
// Siberia, so arrows go to the European part instead.
const ANCHORS: Record<string, [number, number]> = { RUS: [40, 55] };
// A route reaches each stop as the narration names it. A leg takes this long, depending on its length on screen,
// or less when the next stop is named sooner; between legs the route waits at the stop it reached.
const ROUTE_PX_PER_SEC = 420;
const LEG_MIN_SEC = 0.6;
const LEG_MAX_SEC = 2.6;
// A ship travels at the head of a sea route and a camel at the head of a land route, on a disc in the route's color.
const HEAD_DISC = 66;
const HEAD_ICON = 46;
// What travels along a route when the director gives nothing: a ship by sea, a plain arrowhead by land.
const HEAD_ICONS = { sea: "ship", land: undefined } as const;
// Which way each head icon faces as drawn in remotion/icons.tsx, so it can be turned to face the way it travels.
const FACES_LEFT: Record<string, boolean> = { ship: false, camel: true, horse: true, train: false, car: false };
const fontSize = (strong: boolean) => (strong ? VIDEO.fontSize.mapLabelStrong : VIDEO.fontSize.mapLabel);
// A map that zooms into its cities flies in over this long. A shorter scene has no time to show the countries first.
const ZOOM_SEC = 1.6;
const FLIGHT_VOLUME = 0.14;
const MIN_ZOOM_SCENE_SEC = 5.5;
const CENTER_X = WIDTH / 2;
const CENTER_Y = (BOX[0][1] + BOX[1][1]) / 2;

// Where the camera is: a point of the map's layout is drawn at scale * point + (x, y) on screen.
type Camera = { scale: number; x: number; y: number };
const SETTLED: Camera = { scale: 1, x: 0, y: 0 };
// Between two cameras: the zoom changes at an even pace, and the spot in the middle of the screen moves in a straight
// line.
function between(from: Camera, to: Camera, t: number): Camera {
  const scale = from.scale * Math.pow(to.scale / from.scale, t);
  const [fromX, fromY] = [(CENTER_X - from.x) / from.scale, (CENTER_Y - from.y) / from.scale];
  const [toX, toY] = [(CENTER_X - to.x) / to.scale, (CENTER_Y - to.y) / to.scale];
  const [middleX, middleY] = [fromX + (toX - fromX) * t, fromY + (toY - fromY) * t];
  return { scale, x: CENTER_X - scale * middleX, y: CENTER_Y - scale * middleY };
}
// A camera pulled back by a factor below 1, around the middle of the screen.
const pulledBack = (camera: Camera, factor: number): Camera => ({
  scale: factor * camera.scale,
  x: factor * camera.x + (1 - factor) * CENTER_X,
  y: factor * camera.y + (1 - factor) * CENTER_Y,
});

// Rough size of a label, since text cannot be measured here. Archivo is about 0.56 em wide per character.
function labelBox(x: number, y: number, text: string, strong: boolean): Box {
  return { x, y, w: text.length * fontSize(strong) * 0.56 + 20, h: fontSize(strong) * 1.3 };
}

const overlaps = (a: Box, b: Box) => Math.abs(a.x - b.x) * 2 < a.w + b.w && Math.abs(a.y - b.y) * 2 < a.h + b.h;

// Tries each label's spots in order and keeps the first one that hits no other label or city dot.
// A label with no free spot is left out, so the map never gets cluttered.
function placeLabels(specs: LabelSpec[], dots: Point[]): PlacedLabel[] {
  const taken: Box[] = dots.map(([x, y]) => ({ x, y, w: 32, h: 32 }));
  const placed: PlacedLabel[] = [];
  for (const spec of specs) {
    for (const [dx, dy] of spec.offsets) {
      const box = labelBox(spec.at[0] + dx, spec.at[1] + dy, spec.text, spec.strong);
      const onScreen =
        box.x - box.w / 2 > 0 && box.x + box.w / 2 < WIDTH && box.y - box.h / 2 > 0 && box.y + box.h / 2 < HEIGHT - CAPTION_SPACE + 80;
      if (onScreen && !taken.some((other) => overlaps(box, other))) {
        taken.push(box);
        placed.push({ text: spec.text, strong: spec.strong, startSec: spec.startSec, x: box.x, y: box.y });
        break;
      }
    }
  }
  return placed;
}

// How a route is drawn: its line on screen, how far along the line each point is, and when it covers each leg.
type RoutePlan = {
  by: Route["by"];
  icon?: string; // what travels along it, or none for a plain arrowhead
  color: string;
  line: Point[];
  lengths: number[];
  legs: { from: number; to: number; startSec: number; endSec: number }[];
  stops: { point: Point; label?: string; atSec: number }[];
};

// A smooth curve through the points, as many points close together: a centripetal Catmull-Rom spline, which passes
// through every point without loops or overshoot, drawn as cubic Bézier curves.
function smoothCurve(points: Point[]): Point[][] {
  const distance = (a: Point, b: Point) => Math.hypot(b[0] - a[0], b[1] - a[1]);
  return points.slice(1).map((p2, index) => {
    const p1 = points[index];
    const p0 = points[index - 1] ?? p1;
    const p3 = points[index + 2] ?? p2;
    const [d1, d2, d3] = [distance(p0, p1), distance(p1, p2), distance(p2, p3)].map(Math.sqrt);
    const control = (a: Point, b: Point, c: Point, da: number, db: number): Point =>
      da === 0
        ? b
        : ([0, 1].map((k) => (da * da * c[k] - db * db * a[k] + (2 * da * da + 3 * da * db + db * db) * b[k]) / (3 * da * (da + db))) as Point);
    const c1 = control(p0, p1, p2, d1, d2);
    const c2 = control(p3, p2, p1, d3, d2);
    const steps = Math.max(8, Math.ceil(distance(p1, p2) / 10));
    return Array.from({ length: steps + 1 }, (_, step): Point => {
      const t = step / steps;
      const [a, b, c, d] = [(1 - t) ** 3, 3 * (1 - t) ** 2 * t, 3 * (1 - t) * t ** 2, t ** 3];
      return [a * p1[0] + b * c1[0] + c * c2[0] + d * p2[0], a * p1[1] + b * c1[1] + c * c2[1] + d * p2[1]];
    });
  });
}

// The point at a distance along a line, given how far along the line each of its points is.
function pointAlong(line: Point[], lengths: number[], at: number): Point {
  const index = Math.max(1, lengths.findIndex((length) => length >= at));
  if (lengths[index] === undefined || at >= lengths[lengths.length - 1]) return line[line.length - 1];
  const part = (at - lengths[index - 1]) / Math.max(1e-6, lengths[index] - lengths[index - 1]);
  const [a, b] = [line[index - 1], line[index]];
  return [a[0] + (b[0] - a[0]) * part, a[1] + (b[1] - a[1]) * part];
}

// A route on screen and on time. Its legs follow the land or the sea (remotion/geo.ts); it reaches each stop as the
// narration names the stop, or one stop after another if it never does, and is done READ_SEC before the next scene
// dissolves in, faster if it must.
function planRoute(
  route: Route,
  color: string,
  layout: MapLayout,
  words: TimedWord[],
  firstSec: number,
  durationSec: number,
  year: number | undefined,
) {
  const stops = route.stops.flatMap((stop) => {
    const point = layout.project(stop.lon, stop.lat);
    return point ? [{ ...stop, point }] : [];
  });
  if (stops.length < 2) return null;
  const legLines =
    route.by === "sea"
      ? routeLegs({ ...route, stops }, year).map((leg) =>
          leg.flatMap(([lon, lat]) => {
            const point = layout.project(lon, lat);
            return point ? [point] : [];
          }),
        )
      : smoothCurve(stops.map((stop) => stop.point));

  // One line from the first stop to the last, and how far along it each point and each stop is.
  const line: Point[] = [stops[0].point];
  const lengths = [0];
  const stopAt = [0];
  for (const leg of legLines) {
    for (const point of [...leg.slice(1, -1), stops[stopAt.length].point]) {
      const last = line[line.length - 1];
      line.push(point);
      lengths.push(lengths[lengths.length - 1] + Math.hypot(point[0] - last[0], point[1] - last[1]));
    }
    stopAt.push(lengths[lengths.length - 1]);
  }

  // In a short scene with many stops the legs share what time there is, down to a few frames each.
  const doneBy = Math.max(0, durationSec - MOTION.sceneFade - READ_SEC);
  const gap = Math.min(LEG_MIN_SEC, Math.max(0.15, (doneBy - firstSec) / (stops.length - 1)));
  const spoken = revealTimes(
    stops.map((stop) => stop.label ?? ""),
    words,
    { firstSec, spreadSec: Math.max(0, doneBy - firstSec), gapSec: gap, durationSec },
  );
  // Stops the narration names too late are moved earlier, keeping their order and the time between them in proportion.
  const [first, last] = [spoken[0], spoken[spoken.length - 1]];
  const start = Math.max(0, Math.min(first, doneBy - gap * (stops.length - 1)));
  const end = Math.max(start, Math.min(last, doneBy));
  const times = spoken.map((sec) => (last > first ? start + ((sec - first) * (end - start)) / (last - first) : start));
  for (let index = times.length - 2; index >= 0; index--) {
    times[index] = Math.max(0, Math.min(times[index], times[index + 1] - gap));
  }

  const legs = stopAt.slice(1).map((to, index) => {
    const from = stopAt[index];
    const wantedSec = Math.max(LEG_MIN_SEC, Math.min(LEG_MAX_SEC, (to - from) / ROUTE_PX_PER_SEC));
    const legSec = Math.min(times[index + 1] - times[index], wantedSec);
    return { from, to, startSec: times[index + 1] - legSec, endSec: times[index + 1] };
  });
  const plan: RoutePlan = {
    by: route.by,
    icon: route.icon ?? HEAD_ICONS[route.by],
    color,
    line,
    lengths,
    legs,
    stops: stops.map((stop, index) => ({ point: stop.point, label: stop.label, atSec: times[index] })),
  };
  return plan;
}

// How far along its line a route is drawn at a moment, or -1 before it starts. Each leg eases in and out, so the head
// slows down as it reaches a stop.
function drawnLength(plan: RoutePlan, sec: number): number {
  if (sec < plan.stops[0].atSec) return -1;
  for (const leg of plan.legs) {
    if (sec >= leg.endSec) continue;
    if (sec <= leg.startSec) return leg.from;
    const t = (sec - leg.startSec) / (leg.endSec - leg.startSec);
    return leg.from + (leg.to - leg.from) * (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);
  }
  return plan.lengths[plan.lengths.length - 1];
}

// Everything about the map that does not move: the projection, the places, where the labels go, and when each
// part appears. A country, city or arrow comes in as the narration names it, or one after another if it never does.
// The routes take the colors in `routeColors` in turn: the main route in amber, the second in teal.
function planMap(scene: MapSceneData, words: TimedWord[], durationSec: number, routeColors: string[]) {
  const arrows = scene.arrows ?? [];
  const markers = scene.markers ?? [];
  const codes = mapCodes(scene);
  const focus = durationSec >= MIN_ZOOM_SCENE_SEC ? focusArea(scene) : null;
  const layout = layoutMap(codes, BOX, mapPoints(scene), focus);
  const markerStart = 0.6 + scene.highlights.length * 0.35;
  const arrowStart = markerStart + markers.length * 0.25 + 0.2;
  const reveal = (text: string, fallbackSec: number) => revealAt(words, text, fallbackSec, 0.4, durationSec);
  const fillStarts = scene.highlights.map((highlight, index) =>
    reveal(`${highlight.label ?? ""} ${COUNTRIES[highlight.country]?.name ?? ""}`, 0.5 + index * 0.35),
  );

  // A city the narration does not name comes in with its country.
  const countryStart = (country: string | null) =>
    fillStarts.find((_, index) => scene.highlights[index].country === country);

  // Each city belongs to the one country it lies in.
  const dots = markers.flatMap((marker, index) => {
    const point = layout.project(marker.lon, marker.lat);
    const country = countryOf(codes, marker.lon, marker.lat);
    const startSec = reveal(marker.label, countryStart(country) ?? markerStart + index * 0.25);
    return point ? [{ marker, point, country, startSec }] : [];
  });
  // An arrow starts or ends at a city in that country when there is one, else on the part of the country a label
  // names, like Crimea, else in the middle of the country. Its second end never takes the point its first end took,
  // like a part that the labels of both countries name, such as Punjab.
  const anchor = (code: string, taken: Point | null = null): Point | null => {
    const parts = scene.highlights.flatMap((highlight) => {
      const part = highlight.country === code ? partPoint(highlight.label ?? "", code) : null;
      return part ? [layout.project(...part)] : [];
    });
    const choices = [
      ...dots.filter((dot) => dot.country === code).map((dot) => dot.point),
      ...parts,
      ANCHORS[code] ? layout.project(...ANCHORS[code]) : null,
      layout.pointOf(code),
    ];
    const isTaken = (point: Point) => taken !== null && point[0] === taken[0] && point[1] === taken[1];
    return choices.find((point) => point && !isTaken(point)) ?? null;
  };
  // An arrow draws once the places it joins are on the map: their countries colored and their cities marked.
  const placeStart = (code: string) =>
    Math.max(
      0,
      ...scene.highlights.flatMap((highlight, index) => (highlight.country === code ? [fillStarts[index] + 0.2] : [])),
      ...dots.filter((dot) => dot.country === code).map((dot) => dot.startSec + 0.2),
    );
  const arrowsDoneBy = durationSec - MOTION.sceneFade - READ_SEC;
  const curves = arrows.flatMap((arrow, index) => {
    // An arrow within one country does not say which of its cities it leaves from, and a guess can point the wrong
    // way, so it is left out.
    if (arrow.from === arrow.to) return [];
    const from = anchor(arrow.from);
    const to = anchor(arrow.to, from);
    if (!from || !to) return [];
    // Bend the line to one side by a fifth of its length.
    const control: Point = [(from[0] + to[0]) / 2 - (to[1] - from[1]) * 0.2, (from[1] + to[1]) / 2 + (to[0] - from[0]) * 0.2];
    const wanted = Math.max(reveal(arrow.label ?? "", arrowStart + index * 0.6), placeStart(arrow.from), placeStart(arrow.to));
    // A place named at the very end of the narration would leave the arrow drawing as the scene dissolves, so the
    // arrow draws faster then, and starts a little before the place is colored if it must.
    const drawSec = Math.min(ARROW_SEC, Math.max(FAST_ARROW_SEC, arrowsDoneBy - wanted));
    const startSec = Math.max(0, Math.min(wanted, arrowsDoneBy - drawSec));
    return [{ arrow, from, to, control, startSec, drawSec }];
  });

  const specs: LabelSpec[] = dots.map(({ marker, point, startSec }) => {
    const halfWidth = labelBox(0, 0, marker.label, false).w / 2 + 24;
    return {
      text: marker.label,
      strong: false,
      startSec: startSec + 0.1,
      at: point,
      offsets: [[0, -40], [0, 44], [halfWidth, 0], [-halfWidth, 0]],
    };
  });
  // Only the main country gets a name, and only if no city already labels it. A name for a far part of the country,
  // like "Alaska", goes on that part.
  scene.highlights.forEach((highlight, index) => {
    const part = partPoint(highlight.label ?? "", highlight.country);
    const point = part ? layout.project(...part) : layout.pointOf(highlight.country);
    const hasCity = dots.some((dot) => dot.country === highlight.country);
    if (highlight.tone !== "primary" || !highlight.label || !point || hasCity) return;
    specs.push({ text: highlight.label, strong: true, startSec: fillStarts[index] + 0.3, at: point, offsets: [[0, 0], [0, -56], [0, 56]] });
  });
  // With several arrows, labels crowd the map, so only a single arrow gets one. It comes in as the line passes the
  // middle, where the label sits, so it is fully in place by the time the arrow is drawn.
  const [only] = curves;
  if (curves.length === 1 && only.arrow.label) {
    const middle: Point = [
      0.25 * only.from[0] + 0.5 * only.control[0] + 0.25 * only.to[0],
      0.25 * only.from[1] + 0.5 * only.control[1] + 0.25 * only.to[1],
    ];
    const startSec = only.startSec + 0.3 * only.drawSec;
    specs.push({ text: only.arrow.label, strong: true, startSec, at: middle, offsets: [[0, -36], [0, 36]] });
  }

  // Routes start after the cities, and draw along their way. A stop with a name gets a dot and a label as the route
  // reaches it, unless a city dot is already there. A route's own name goes near its middle, wherever there is room
  // left, and comes in as the route passes the middle.
  const routes = (scene.routes ?? []).flatMap((route, index) => {
    const plan = planRoute(route, routeColors[index % routeColors.length], layout, words, arrowStart, durationSec, route.year ?? sceneYear(scene));
    return plan ? [{ route, plan }] : [];
  });
  const stopDots: { point: Point; startSec: number }[] = [];
  for (const { plan } of routes) {
    for (const stop of plan.stops) {
      const near = (point: Point) => Math.hypot(point[0] - stop.point[0], point[1] - stop.point[1]) < 2;
      if (stop.label && !dots.some((dot) => near(dot.point)) && !stopDots.some((dot) => near(dot.point))) {
        stopDots.push({ point: stop.point, startSec: stop.atSec });
      }
    }
  }
  for (const { plan } of routes) {
    for (const stop of plan.stops) {
      if (!stop.label || !stopDots.some((dot) => dot.point === stop.point)) continue;
      const side = labelBox(0, 0, stop.label, false).w / 2 + 24;
      const offsets: Point[] = [
        [0, 44], [0, -44], [side, 0], [-side, 0], [side - 20, -40], [20 - side, -40], [side - 20, 44], [20 - side, 44],
      ];
      specs.push({ text: stop.label, strong: false, startSec: stop.atSec + 0.1, at: stop.point, offsets });
    }
  }

  for (const { route, plan } of routes) {
    if (!route.label) continue;
    const total = plan.lengths[plan.lengths.length - 1];
    const middle = pointAlong(plan.line, plan.lengths, total / 2);
    // Beside the route near its middle first, then further from it, and on the line itself as a last resort.
    const shares = [0.5, 0.42, 0.58, 0.34, 0.66, 0.26, 0.74];
    const offsets = [[-44, 44], [-90, 90], [0]].flatMap((sides) =>
      shares.flatMap((share) => {
        const [x, y] = pointAlong(plan.line, plan.lengths, total * share);
        return sides.map((side): Point => [x - middle[0], y - middle[1] + side]);
      }),
    );
    const leg = plan.legs.find((each) => each.to >= total / 2) ?? plan.legs[plan.legs.length - 1];
    const startSec = leg.startSec + ((total / 2 - leg.from) / Math.max(1, leg.to - leg.from)) * (leg.endSec - leg.startSec);
    specs.push({ text: route.label, strong: true, startSec, at: middle, offsets });
  }
  const allDots = [...dots.map((dot) => dot.point), ...stopDots.map((dot) => dot.point)];
  // A map that zooms in shows its countries first, and flies into its cities as the first of them is named, so the
  // viewer sees where they are before seeing them up close.
  const firstPlaceSec = Math.min(...dots.map((dot) => dot.startSec), ...routes.map(({ plan }) => plan.stops[0]?.atSec ?? Infinity));
  const zoom = focus
    ? {
        from: cameraFrom(fitProjection(codes, BOX, mapPoints(scene)), layout.projection),
        startSec: Math.min(Math.max(firstPlaceSec - 0.4, MOTION.cameraMove + 0.2), durationSec - ZOOM_SEC - READ_SEC - MOTION.sceneFade),
      }
    : null;
  return { layout, zoom, dots, curves, routes: routes.map(({ plan }) => plan), stopDots, fillStarts, labels: placeLabels(specs, allDots) };
}

// A flat map. The camera eases in on the countries, the highlighted ones fill with color one by one,
// cities appear as dots, arrows draw from one place to the next, and routes draw along their way by land or sea with a
// camel or a ship at their head. When the scene before is a map too, the camera flies on from where that map was and
// its colors change into the new ones, so it plays as one map. In Blueprint the map is a plan: countries are chalk
// outlines, highlighted ones are hatched in their color, and arrows and routes are dashed.
export function MapScene({
  scene,
  previous,
  words,
  durationSec,
}: {
  scene: MapSceneData;
  previous?: MapSceneData;
  words: TimedWord[];
  durationSec: number;
}) {
  const { colors, drawing } = useTheme();
  const outlined = drawing.land === "outline";
  const hatchId = `hatch${useId().replace(/[^A-Za-z0-9]/g, "")}`;
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tones = { primary: colors.signal, secondary: colors.teal, muted: colors.muted };
  const routeColors = useMemo(() => [colors.signal, colors.teal], [colors]);
  const plan = useMemo(() => planMap(scene, words, durationSec, routeColors), [scene, words, durationSec, routeColors]);
  // Where the map before left its camera, seen from this map, so the camera can fly on from there.
  const start = useMemo(() => (previous ? cameraFrom(mapProjection(previous, BOX), plan.layout.projection) : null), [previous, plan]);
  const homePaths = useMemo(() => {
    const codes = new Set([...scene.highlights, ...(previous?.highlights ?? [])].map((highlight) => highlight.country));
    return new Map([...codes].map((code) => [code, plan.layout.homePathOf(code)]));
  }, [scene, previous, plan]);

  // The camera eases in on the countries, or flies on from the map before. A map that zooms in settles first on the
  // wide view of its countries, then flies into its cities; after another map, which already showed where they are,
  // it flies straight to them.
  const camera = ease(frame, fps, 0, MOTION.cameraMove);
  const zoom = start ? null : plan.zoom;
  let view = start ? between(start, SETTLED, camera) : pulledBack(zoom ? zoom.from : SETTLED, 0.84 + 0.16 * camera);
  if (zoom) view = between(view, SETTLED, ease(frame, fps, zoom.startSec, ZOOM_SEC));
  const transform = `translate(${view.x} ${view.y}) scale(${view.scale})`;
  // Countries the map before colored start in that color. Those it no longer needs fade back to land. In Blueprint a
  // country's outline changes from chalk to its color along with its hatching.
  const chalk = alpha(colors.paper, 0.55);
  const edgeOf = (color: string) => (color === colors.land ? chalk : color);
  const tint = (progress: number, from: string, to: string) => ({
    fill: interpolateColors(progress, [0, 1], [from, to]),
    edge: interpolateColors(progress, [0, 1], [edgeOf(from), edgeOf(to)]),
  });
  const before = new Map((previous?.highlights ?? []).map((highlight) => [highlight.country, tones[highlight.tone]]));
  const fills = new Map([...before].map(([code, color]) => [code, tint(ease(frame, fps, 0.2, 0.6), color, colors.land)]));
  scene.highlights.forEach((highlight, index) => {
    const progress = ease(frame, fps, plan.fillStarts[index], 0.6);
    fills.set(highlight.country, tint(progress, before.get(highlight.country) ?? colors.land, tones[highlight.tone]));
  });

  return (
    <AbsoluteFill>
      <svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
        {outlined ? (
          <defs>
            {[...fills].map(([code, { fill }]) => (
              <Hatch key={code} id={`${hatchId}${code}`} color={fill} background={colors.land} zoom={view.scale} />
            ))}
          </defs>
        ) : null}
        <g transform={transform}>
          {plan.layout.paths.map((country, index) => (
            <path
              key={index}
              d={country.d}
              fill={colors.land}
              stroke={outlined ? chalk : colors.border}
              strokeWidth={outlined ? 1.4 : 1.2}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {/* Colored countries on top, without their overseas territories. */}
          {[...fills].map(([code, { fill, edge }]) => (
            <path
              key={code}
              d={homePaths.get(code) ?? ""}
              fill={outlined ? `url(#${hatchId}${code})` : fill}
              stroke={outlined ? edge : colors.border}
              strokeWidth={outlined ? 2.5 : 1.2}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {plan.curves.map((curve, index) => (
            <Arrow key={index} {...curve} progress={ease(frame, fps, curve.startSec, curve.drawSec)} />
          ))}
          {plan.routes.map((route, index) => (
            <RouteLine key={index} plan={route} length={drawnLength(route, frame / fps)} />
          ))}
          {/* Cities are dots, or rings in Blueprint, like the points on a plan. */}
          {[...plan.dots, ...plan.stopDots].map(({ point, startSec }, index) => {
            const appear = ease(frame, fps, startSec, 0.4);
            return (
              <circle
                key={index}
                cx={point[0]}
                cy={point[1]}
                r={12 * appear}
                fill={outlined ? colors.ink : colors.paper}
                stroke={outlined ? colors.paper : colors.ink}
                strokeWidth={4}
              />
            );
          })}
          {plan.routes.map((route, index) => (
            <RouteHead key={index} plan={route} sec={frame / fps} fps={fps} />
          ))}
          {plan.labels.map((label, index) => (
            <MapLabel key={index} {...label} opacity={ease(frame, fps, label.startSec, 0.4)} />
          ))}
        </g>
      </svg>
      {/* A rush of air as the camera zooms into the cities. Flights from one map to the next have none, since they
          come often. */}
      {zoom ? (
        <Sequence from={Math.round(zoom.startSec * fps)} layout="none">
          <Html5Audio src={sounds().flight} volume={FLIGHT_VOLUME} />
        </Sequence>
      ) : null}
    </AbsoluteFill>
  );
}

// An open arrowhead, as on a plan, pointing right from the origin.
const CHEVRON = "M -26 -15 L 0 0 L -26 15";

// A curved arrow that draws itself. The head appears when the line arrives.
function Arrow({ from, to, control, progress }: { from: Point; to: Point; control: Point; progress: number }) {
  const { colors, drawing } = useTheme();
  const angle = (Math.atan2(to[1] - control[1], to[0] - control[0]) * 180) / Math.PI;
  const d = `M ${from[0]} ${from[1]} Q ${control[0]} ${control[1]} ${to[0]} ${to[1]}`;
  const head = { opacity: progress > 0.9 ? (progress - 0.9) * 10 : 0, transform: `translate(${to[0]} ${to[1]}) rotate(${angle})` };
  if (drawing.land === "outline") {
    // A dashed line with an open head. It is drawn as the part of the curve flown so far, so the dashes stay put
    // instead of crawling along it.
    if (progress <= 0) return null;
    const middle: Point = [from[0] + (control[0] - from[0]) * progress, from[1] + (control[1] - from[1]) * progress];
    const end: Point = [
      (1 - progress) ** 2 * from[0] + 2 * (1 - progress) * progress * control[0] + progress ** 2 * to[0],
      (1 - progress) ** 2 * from[1] + 2 * (1 - progress) * progress * control[1] + progress ** 2 * to[1],
    ];
    const part = `M ${from[0]} ${from[1]} Q ${middle[0]} ${middle[1]} ${end[0]} ${end[1]}`;
    const line = { fill: "none", strokeLinecap: "round", strokeLinejoin: "round" } as const;
    return (
      <g>
        <path d={part} {...line} stroke={colors.ink} strokeWidth={14} />
        <path d={part} {...line} stroke={colors.signal} strokeWidth={6} strokeDasharray="20 14" />
        <path d={CHEVRON} {...line} stroke={colors.ink} strokeWidth={14} {...head} />
        <path d={CHEVRON} {...line} stroke={colors.signal} strokeWidth={6} {...head} />
      </g>
    );
  }
  // A dark edge under the amber line keeps the arrow visible over an amber country. Before it starts, nothing is
  // drawn: a round line cap would leave a dot at its start.
  if (progress <= 0) return null;
  return (
    <g>
      <path d={d} fill="none" stroke={colors.ink} strokeWidth={16} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - progress} />
      <path d={d} fill="none" stroke={colors.signal} strokeWidth={8} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - progress} />
      <path d="M 0 0 L -30 -16 L -30 16 Z" fill={colors.signal} stroke={colors.ink} strokeWidth={4} strokeLinejoin="round" {...head} />
    </g>
  );
}

// A route as drawn so far: a strong rounded line in the route's color on a dark edge, so it reads on sea and land.
// Dashed in Blueprint, like a way drawn on a plan.
function RouteLine({ plan, length }: { plan: RoutePlan; length: number }) {
  const { colors, drawing } = useTheme();
  if (length <= 0) return null;
  const end = plan.lengths.findIndex((each) => each >= length);
  const points = [...plan.line.slice(0, end === -1 ? plan.line.length : end), pointAlong(plan.line, plan.lengths, length)];
  const d = `M ${points.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L ")}`;
  const style = { fill: "none", strokeLinecap: "round", strokeLinejoin: "round" } as const;
  return (
    <g>
      <path d={d} {...style} stroke={colors.ink} strokeWidth={18} />
      <path d={d} {...style} stroke={plan.color} strokeWidth={10} strokeDasharray={drawing.land === "outline" ? "24 16" : undefined} />
    </g>
  );
}

// The ship or camel at the head of a route, on a disc in the route's color. It pops in at the first stop, faces the
// way it travels, and fades once it has reached the last stop, so the stop's dot and name show. Where icons are drawn
// as outlines, the disc is the ground with a ring in the route's color, and the icon is drawn in that color.
function RouteHead({ plan, sec, fps }: { plan: RoutePlan; sec: number; fps: number }) {
  const { colors, drawing } = useTheme();
  const length = drawnLength(plan, sec);
  if (length < 0) return null;
  const arrived = plan.legs[plan.legs.length - 1].endSec;
  const opacity = 1 - ease(sec * fps, fps, arrived + 0.3, 0.3);
  if (opacity <= 0) return null;
  const [x, y] = pointAlong(plan.line, plan.lengths, length);
  // Which way it goes: from a little behind the head, or at the very start, towards a little ahead.
  const behind = length > 20 ? pointAlong(plan.line, plan.lengths, length - 20) : [x, y];
  const ahead = length > 20 ? [x, y] : pointAlong(plan.line, plan.lengths, 20);
  const scale = ease(sec * fps, fps, plan.stops[0].atSec, 0.35);
  // Without an icon, a plain arrowhead in the route's color points the way.
  if (!plan.icon) {
    const angle = (Math.atan2(ahead[1] - behind[1], ahead[0] - behind[0]) * 180) / Math.PI;
    return (
      <g transform={`translate(${x} ${y}) rotate(${angle}) scale(${scale})`} opacity={opacity}>
        <path d="M 20 0 L -14 -16 L -6 0 L -14 16 Z" fill={plan.color} stroke={colors.ink} strokeWidth={4} strokeLinejoin="round" />
      </g>
    );
  }
  const turned = ahead[0] < behind[0] !== (FACES_LEFT[plan.icon] ?? false);
  const flat = drawing.icon === "solid";
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} opacity={opacity}>
      <circle r={HEAD_DISC / 2} fill={flat ? plan.color : colors.ink} stroke={flat ? colors.ink : plan.color} strokeWidth={5} />
      <g transform={`scale(${turned ? -1 : 1} 1) translate(${-HEAD_ICON / 2} ${-HEAD_ICON / 2})`}>
        <Icon name={plan.icon} size={HEAD_ICON} color={flat ? colors.ink : plan.color} cut={flat ? plan.color : colors.ink} />
      </g>
    </g>
  );
}

function MapLabel({ x, y, text, opacity, strong }: { x: number; y: number; text: string; opacity: number; strong: boolean }) {
  const { colors, fonts } = useTheme();
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      dominantBaseline="middle"
      fontFamily={fonts.label}
      fontSize={fontSize(strong)}
      fontWeight={strong ? 700 : 500}
      fill={colors.paper}
      stroke={colors.ink}
      strokeWidth={10}
      paintOrder="stroke"
      strokeLinejoin="round"
      opacity={opacity}
    >
      {text}
    </text>
  );
}
