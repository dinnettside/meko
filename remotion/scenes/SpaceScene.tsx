import { geoCircle, geoGraticule10, geoOrthographic, geoPath } from "d3-geo";
import type { GeoPermissibleObjects } from "d3-geo";
import { useMemo } from "react";
import { AbsoluteFill, Easing, interpolate, interpolateColors, useCurrentFrame, useVideoConfig } from "remotion";
import type { TimedWord } from "@/lib/elevenlabs";
import { MOON_SEAS, MOON_SITES, moonPlace, seaCircles } from "@/lib/moon";
import type { MoonCircle, MoonPlace } from "@/lib/moon";
import type { SpaceBody } from "@/lib/storyboard";
import { COLORS, FONTS, VIDEO } from "@/lib/theme";
import { globeCountries } from "../globe";
import { ease } from "../motion";
import { revealAt, spokenAt } from "../spoken";

type Point = [number, number];
type Box = { x: number; y: number; w: number; h: number };

// The free part of the frame: inside the side margins, below the corner notes and above the captions.
const FREE = { left: VIDEO.sideMargin, right: VIDEO.width - VIDEO.sideMargin, top: VIDEO.topSpace, bottom: VIDEO.height - VIDEO.captionSpace };
// Motion that matters is done this long before the end, since the next scene dissolves in over the last moments.
const DONE_BEFORE_END = 0.8;
const graticule = geoGraticule10();
const circle = ([lon, lat, radius]: MoonCircle) => geoCircle().center([lon, lat]).radius(radius)();
// The Moon's seas as shapes on the sphere, made once: only the camera changes from frame to frame.
const SEA_SHAPES = MOON_SEAS.flatMap((sea) => seaCircles(sea).map(circle));
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

// Rough size of a label, since text cannot be measured here. Archivo is about 0.56 em wide per character.
const labelBox = (x: number, y: number, text: string, fontSize: number): Box => ({ x, y, w: text.length * fontSize * 0.56 + 24, h: fontSize * 1.3 });
const overlaps = (a: Box, b: Box) => Math.abs(a.x - b.x) * 2 < a.w + b.w && Math.abs(a.y - b.y) * 2 < a.h + b.h;

// Letters and digits only, without a possessive "'s": "Moon's," is "moon" and "Chang'e 3" is "change3".
const plain = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9'’]/g, "")
    .replace(/['’]s$/, "")
    .replace(/['’]/g, "");

// When the narration says a name, word for word, or null if it never does. Words are compared by their letters, so
// "Chandrayaan-3" matches whether the voice gives it as one word or two.
function phraseSaidAt(words: TimedWord[], name: string): number | null {
  const wanted = plain(name);
  if (!wanted) return null;
  for (let start = 0; start < words.length; start++) {
    let joined = "";
    for (let end = start; end < words.length && joined.length < wanted.length; end++) {
      joined += plain(words[end].text);
      if (joined === wanted) return words[start].start;
    }
  }
  return null;
}

const NO_BODIES: SpaceBody[] = [];
const NO_SITES: string[] = [];

// Space: a craft flying from one body to another ("journey"), or the Moon's near side with the seas and landing
// sites the narration names ("moon").
export function SpaceScene({
  view,
  bodies,
  craft,
  sites,
  words,
  durationSec,
}: {
  view: "journey" | "moon";
  bodies?: SpaceBody[];
  craft?: { from: SpaceBody; to: SpaceBody; label?: string };
  sites?: string[];
  words: TimedWord[];
  durationSec: number;
}) {
  return view === "moon" ? (
    <MoonView sites={sites ?? NO_SITES} words={words} durationSec={durationSec} />
  ) : (
    <JourneyView bodies={bodies ?? NO_BODIES} craft={craft} words={words} durationSec={durationSec} />
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Journey

// How big each body is drawn next to the others. Not to scale: the Sun would fill the frame and the Moon would be a
// dot, so only the order of sizes is kept.
const BODY_SIZE: Record<SpaceBody, number> = { sun: 1.5, earth: 1, mars: 0.62, moon: 0.45 };
const BODY_NAME: Record<SpaceBody, string> = { earth: "Earth", moon: "Moon", sun: "Sun", mars: "Mars" };
const NAME_SPACE = 70; // room under the bodies for their names
const MIN_GAP = 110; // the least room between two bodies
const SUN_RAYS = 1.16; // the Sun's short rays sit on a ring this much bigger than its disc
const MIN_FLIGHT = 1.8; // the shortest flight, in seconds
const SETTLE_SEC = 0.5; // the craft comes to rest after it arrives
const LAUNCH_WORDS = "launched launch lifted liftoff blasted departed";


type Body = { kind: SpaceBody; x: number; y: number; r: number };

// The bodies in a row, biggest first in size but kept in the given order. With a craft, they sit low, so its arc
// has room above them.
function layoutBodies(kinds: SpaceBody[], withCraft: boolean): Body[] {
  const width = FREE.right - FREE.left;
  const totalSize = kinds.reduce((sum, kind) => sum + 2 * BODY_SIZE[kind], 0);
  const biggest = Math.max(...kinds.map((kind) => BODY_SIZE[kind]));
  const unit = Math.min((withCraft ? 180 : 230) / biggest, (width - kinds.length * MIN_GAP) / totalSize);
  // Equal room between the bodies, and half of it at each end.
  const gap = (width - totalSize * unit) / kinds.length;
  const y = withCraft ? FREE.bottom - NAME_SPACE - biggest * unit : (FREE.top + FREE.bottom - NAME_SPACE) / 2;
  let x = FREE.left + gap / 2;
  return kinds.map((kind) => {
    const r = BODY_SIZE[kind] * unit;
    const body = { kind, x: x + r, y, r };
    x += 2 * r + gap;
    return body;
  });
}

const bezier = (p0: Point, p1: Point, p2: Point, t: number): Point => [
  (1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0],
  (1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1],
];
const degrees = (radians: number) => (radians * 180) / Math.PI;
const radians = (deg: number) => (deg * Math.PI) / 180;
const pointOn = (body: Body, angle: number, out: number): Point => [
  body.x + (body.r + out) * Math.cos(radians(angle)),
  body.y + (body.r + out) * Math.sin(radians(angle)),
];
// The way from angle a to angle b, the short way round.
const turn = (a: number, b: number, t: number) => a + ((((b - a) % 360) + 540) % 360 - 180) * t;

// Everything about the journey that does not move: where the bodies are, the craft's arc, and when it flies.
function planJourney(kinds: SpaceBody[], craft: { from: SpaceBody; to: SpaceBody; label?: string } | undefined, words: TimedWord[], durationSec: number) {
  // The craft's bodies are always drawn, and each body once.
  const wanted = [...kinds, ...(craft && craft.from !== craft.to ? [craft.from, craft.to] : [])];
  const list = [...new Set(wanted.length > 0 ? wanted : (["earth", "moon"] as SpaceBody[]))];
  const flies = Boolean(craft && craft.from !== craft.to);
  const placed = layoutBodies(list, flies);
  const unit = Math.max(...placed.map((body) => body.r / BODY_SIZE[body.kind]));
  const rocketLength = clamp(unit * 0.42, 54, 76);
  if (!craft || !flies) return { bodies: placed, rocketLength, flight: null };

  const from = placed.find((body) => body.kind === craft.from)!;
  const to = placed.find((body) => body.kind === craft.to)!;
  const side = to.x >= from.x ? 1 : -1;
  // The craft leaves from the upper side facing its goal and lands on top of it. The Sun has no ground, so a craft
  // flying there stops short of it.
  const launchAngle = -90 + side * 35;
  const toSun = to.kind === "sun";
  const landAngle = toSun ? -90 - side * 50 : -90;
  const liftoff = pointOn(from, launchAngle, 0);
  const start = pointOn(from, launchAngle, rocketLength / 2);
  const end = pointOn(to, landAngle, toSun ? 60 + rocketLength / 2 : rocketLength / 2);
  const touchdown = pointOn(to, landAngle, 0);
  // The arc rises a third of its length above the higher end, more if a body in between is in the way, but stays
  // in the free part of the frame.
  const between = placed.filter((body) => body !== from && body !== to && (body.x - from.x) * (body.x - to.x) < 0);
  let lift = Math.max(140, 0.4 * Math.abs(end[0] - start[0]));
  let control: Point = [(start[0] + end[0]) / 2, Math.min(start[1], end[1]) - lift];
  const clears = (c: Point) =>
    between.every((body) => {
      for (let t = 0; t <= 1; t += 0.02) {
        const [x, y] = bezier(start, c, end, t);
        if (Math.hypot(x - body.x, y - body.y) < body.r + rocketLength * 0.6) return false;
      }
      return true;
    });
  while (!clears(control) && bezier(start, control, end, 0.5)[1] > FREE.top + rocketLength) {
    lift += 30;
    control = [(start[0] + end[0]) / 2, Math.min(start[1], end[1]) - lift];
  }

  // The craft takes off as the narration says it does, or after a second, and flies while the narration speaks.
  // It is down well before the next scene comes in.
  const latestArrival = durationSec - DONE_BEFORE_END - SETTLE_SEC;
  const said = spokenAt(words, LAUNCH_WORDS);
  const launchSec = clamp(said === null ? 1.0 : said - 0.2, 0.6, Math.max(0.6, latestArrival - MIN_FLIGHT));
  const narrationEnd = words.length > 0 ? words[words.length - 1].end : durationSec - 1;
  const arrivalSec = clamp(narrationEnd, launchSec + MIN_FLIGHT, Math.max(launchSec + 1, latestArrival));
  const labelSec = craft.label
    ? Math.min(
        revealAt(words, craft.label, launchSec + 0.35 * (arrivalSec - launchSec), launchSec, durationSec),
        durationSec - DONE_BEFORE_END - 0.5,
      )
    : 0;

  // The label sits inside the arc under its top, or above the arc, wherever it touches neither the trail nor a body.
  let label: Point | null = null;
  if (craft.label) {
    const top = bezier(start, control, end, 0.5);
    const arc = Array.from({ length: 51 }, (_, index) => bezier(start, control, end, index / 50));
    const spots: Point[] = [64, 96, 128, -56, -88].map((dy) => [top[0], top[1] + dy]);
    label =
      spots.find(([x, y]) => {
        const box = labelBox(x, y, craft.label!, VIDEO.fontSize.mapLabelStrong);
        const inFrame = box.y - box.h / 2 > 40 && box.x - box.w / 2 > 40 && box.x + box.w / 2 < VIDEO.width - 40;
        const clearOfTrail = arc.every(([ax, ay]) => !overlaps(box, { x: ax, y: ay, w: 28, h: 28 }));
        const clearOfBodies = placed.every((body) => !overlaps(box, { x: body.x, y: body.y, w: 2 * body.r + 20, h: 2 * body.r + 20 }));
        return inFrame && clearOfTrail && clearOfBodies;
      }) ?? spots[0];
  }

  return {
    bodies: placed,
    rocketLength,
    flight: { liftoff, start, control, end, touchdown, launchAngle, landAngle, lands: !toSun, launchSec, arrivalSec, labelSec, label, text: craft.label },
  };
}

function JourneyView({
  bodies,
  craft,
  words,
  durationSec,
}: {
  bodies: SpaceBody[];
  craft?: { from: SpaceBody; to: SpaceBody; label?: string };
  words: TimedWord[];
  durationSec: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const time = frame / fps;
  const plan = useMemo(() => planJourney(bodies, craft, words, durationSec), [bodies, craft, words, durationSec]);
  const { flight, rocketLength } = plan;

  return (
    <AbsoluteFill>
      <svg width={VIDEO.width} height={VIDEO.height} viewBox={`0 0 ${VIDEO.width} ${VIDEO.height}`}>
        {plan.bodies.map((body, index) => {
          const appear = ease(frame, fps, 0.1 + index * 0.15, 0.7);
          // A body's name brightens as the narration says it, matched whole, since "Sun" is too short for the
          // usual word matching.
          const named = phraseSaidAt(words, BODY_NAME[body.kind]);
          const nameColor = interpolateColors(named === null ? 0 : ease(frame, fps, named - 0.2, 0.4), [0, 1], [COLORS.dim, COLORS.paper]);
          return (
            <g key={body.kind} opacity={appear}>
              <g transform={`translate(${body.x} ${body.y}) scale(${0.9 + 0.1 * appear})`}>
                <BodyGlobe kind={body.kind} r={body.r} time={time} />
              </g>
              <text
                x={body.x}
                y={body.y + body.r * (body.kind === "sun" ? SUN_RAYS : 1) + 48}
                textAnchor="middle"
                fontFamily={FONTS.body}
                fontSize={34}
                fontWeight={600}
                fill={nameColor}
              >
                {BODY_NAME[body.kind]}
              </text>
            </g>
          );
        })}
        {flight ? <Flight flight={flight} rocketLength={rocketLength} frame={frame} fps={fps} /> : null}
        <text
          x={FREE.right}
          y={FREE.bottom + 6}
          textAnchor="end"
          fontFamily={FONTS.body}
          fontSize={26}
          fill={COLORS.dim}
          opacity={ease(frame, fps, 0.8, 0.6)}
        >
          Not to scale
        </text>
      </svg>
    </AbsoluteFill>
  );
}

type FlightPlan = NonNullable<ReturnType<typeof planJourney>["flight"]>;

// The rocket waits on its body, takes off, flies the arc leaving a dashed trail, turns tail first as it comes down
// and lands. Its label comes in beside the trail as the narration says it.
function Flight({ flight, rocketLength, frame, fps }: { flight: FlightPlan; rocketLength: number; frame: number; fps: number }) {
  const { start, control, end } = flight;
  const progress = interpolate(frame, [flight.launchSec * fps, flight.arrivalSec * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const position = bezier(start, control, end, progress);
  // Along the arc, the rocket points where it is going.
  const along = degrees(
    Math.atan2(
      2 * (1 - progress) * (control[1] - start[1]) + 2 * progress * (end[1] - control[1]),
      2 * (1 - progress) * (control[0] - start[0]) + 2 * progress * (end[0] - control[0]),
    ),
  );
  const smooth = (t: number) => t * t * (3 - 2 * t);
  let angle = along;
  if (progress < 0.15) angle = turn(flight.launchAngle, along, smooth(progress / 0.15));
  else if (flight.lands && progress > 0.6) angle = turn(along, flight.landAngle, smooth((progress - 0.6) / 0.4));
  // The engine fires from take-off until the rocket is down.
  const firing = progress > 0 && progress < 1 ? 1 : 0;
  const flame = firing * (0.75 + 0.25 * Math.sin(frame * 1.7));
  // The trail runs from the ground along the part of the arc flown so far, drawn as its own curve so the dashes do
  // not crawl.
  const partControl: Point = [start[0] + progress * (control[0] - start[0]), start[1] + progress * (control[1] - start[1])];
  const trail = `M ${flight.liftoff[0]} ${flight.liftoff[1]} L ${start[0]} ${start[1]} Q ${partControl[0]} ${partControl[1]} ${position[0]} ${position[1]}`;
  const appear = ease(frame, fps, 0.5, 0.4);
  const landed = ease(frame, fps, flight.arrivalSec, SETTLE_SEC);
  const labelIn = ease(frame, fps, flight.labelSec, 0.5);

  return (
    <g>
      {progress > 0 ? (
        <path d={trail} fill="none" stroke={COLORS.signal} strokeWidth={6} strokeLinecap="round" strokeDasharray="2 20" />
      ) : null}
      {flight.lands && landed > 0 && landed < 1 ? (
        <circle cx={flight.touchdown[0]} cy={flight.touchdown[1]} r={12 + 40 * landed} fill="none" stroke={COLORS.signal} strokeWidth={4} opacity={1 - landed} />
      ) : null}
      <g transform={`translate(${position[0]} ${position[1]}) rotate(${angle})`} opacity={appear}>
        <Rocket length={rocketLength} flame={flame} />
      </g>
      {flight.label && flight.text ? (
        <text
          x={flight.label[0]}
          y={flight.label[1] + (1 - labelIn) * 16}
          textAnchor="middle"
          dominantBaseline="middle"
          fontFamily={FONTS.body}
          fontSize={VIDEO.fontSize.mapLabelStrong}
          fontWeight={700}
          fill={COLORS.paper}
          stroke={COLORS.ink}
          strokeWidth={10}
          paintOrder="stroke"
          strokeLinejoin="round"
          opacity={labelIn}
        >
          {flight.text}
        </text>
      ) : null}
    </g>
  );
}

// A rocket pointing right, centered on the origin. Drawn on a 100-unit grid and scaled to `length`.
function Rocket({ length, flame }: { length: number; flame: number }) {
  return (
    <g transform={`scale(${length / 100})`}>
      {flame > 0 ? (
        <>
          <path d={`M -42 -9 Q ${-62 - 26 * flame} -6 ${-70 - 30 * flame} 0 Q ${-62 - 26 * flame} 6 -42 9 Z`} fill={COLORS.signal} />
          <path d={`M -42 -4 Q ${-52 - 12 * flame} -3 ${-56 - 14 * flame} 0 Q ${-52 - 12 * flame} 3 -42 4 Z`} fill={COLORS.paper} />
        </>
      ) : null}
      <path d="M -16 -12 L -38 -30 L -46 -30 L -40 -12 Z" fill={COLORS.signal} />
      <path d="M -16 12 L -38 30 L -46 30 L -40 12 Z" fill={COLORS.signal} />
      <path d="M -46 -9 L -40 -11 L -40 11 L -46 9 Z" fill={COLORS.dim} />
      <path d="M -40 -12 L 16 -12 C 32 -12 44 -7 52 0 C 44 7 32 12 16 12 L -40 12 Z" fill={COLORS.paper} />
      <circle cx={10} cy={0} r={6.5} fill={COLORS.ink} />
    </g>
  );
}

// Mars's darker ground, roughly, so it reads as a world and not a ball. Never labelled.
const MARS_PATCHES: MoonCircle[] = [
  [68, 6, 13],
  [30, -14, 11],
  [104, 26, 10],
];

// One body as a small globe: the Earth turning with its land, the Moon with its seas, Mars with a polar cap, and the
// Sun as a warm disc with short rays.
function BodyGlobe({ kind, r, time }: { kind: SpaceBody; r: number; time: number }) {
  if (kind === "sun") {
    return (
      <g>
        <circle
          r={r * SUN_RAYS}
          fill="none"
          stroke={COLORS.sun}
          strokeWidth={r * 0.07}
          strokeLinecap="round"
          strokeDasharray={`${r * 0.07} ${(2 * Math.PI * r * SUN_RAYS) / 20 - r * 0.07}`}
        />
        <circle r={r} fill={COLORS.sun} />
      </g>
    );
  }
  // The Earth turns slowly, west to east. The Moon always shows Earth the same face.
  const rotate: [number, number] = kind === "earth" ? [-10 + 6 * time, -18] : kind === "mars" ? [-60, -18] : [0, 0];
  const projection = geoOrthographic().scale(r).translate([0, 0]).rotate(rotate);
  const path = geoPath(projection);
  const draw = (shape: GeoPermissibleObjects) => path(shape) ?? "";
  if (kind === "earth") {
    return (
      <g>
        <circle r={r} fill={COLORS.globe} />
        {globeCountries.map(({ shape }, index) => (
          <path key={index} d={draw(shape)} fill={COLORS.land} stroke={COLORS.land} strokeWidth={1} />
        ))}
        <circle r={r} fill="none" stroke={COLORS.border} strokeWidth={3} />
      </g>
    );
  }
  if (kind === "mars") {
    return (
      <g>
        <circle r={r} fill={COLORS.mars} />
        {MARS_PATCHES.map((patch, index) => (
          <path key={index} d={draw(circle(patch))} fill={COLORS.marsDark} />
        ))}
        <path d={draw(circle([0, 90, 14]))} fill={COLORS.paper} opacity={0.9} />
        <circle r={r} fill="none" stroke={COLORS.border} strokeWidth={3} />
      </g>
    );
  }
  return (
    <g>
      <circle r={r} fill={COLORS.moon} />
      {SEA_SHAPES.map((shape, index) => (
        <path key={index} d={draw(shape)} fill={COLORS.moonSea} />
      ))}
      <circle r={r} fill="none" stroke={COLORS.border} strokeWidth={3} />
    </g>
  );
}


// ---------------------------------------------------------------------------------------------------------------
// The Moon

const MOON_CENTER: Point = [VIDEO.width / 2, (FREE.top + FREE.bottom) / 2];
const MOON_RADIUS = (FREE.bottom - FREE.top) / 2 - 6;
const CAMERA_SEC = 2.6; // the camera's move toward the sites, at most
const ZOOM = 0.1; // how much closer the camera gets
const TURN = 0.6; // how far the Moon turns toward the sites, as a share of the way
const MAX_TURN = 32; // in degrees
const SITE_LABEL = VIDEO.fontSize.mapLabelStrong;
const SEA_LABEL = VIDEO.fontSize.mapLabel;

type MoonMark = MoonPlace & { startSec: number; shapes: ReturnType<typeof circle>[]; label: Point | null };

// When a place comes in: as the narration says one of its names in full ("Sea of Tranquility" for "Mare
// Tranquillitatis"), else its number ("Apollo 15" is heard as "15"), else any of its longer words, else one after
// another.
function placeSpokenAt(words: TimedWord[], names: string[], fallbackSec: number, durationSec: number): number {
  const latest = durationSec - DONE_BEFORE_END - 0.6;
  const heard = names.map((name) => phraseSaidAt(words, name)).filter((sec) => sec !== null);
  const numbers = names[0].match(/\d+/g)?.join(" ");
  const said = heard.length > 0 ? Math.min(...heard) : numbers ? spokenAt(words, numbers) : null;
  if (said !== null) return clamp(said - 0.2, 0.6, latest);
  return Math.min(latest, revealAt(words, names[0], fallbackSec, 0.6, durationSec));
}

// The middle of the places, as [longitude, latitude], from the average of their directions.
function middleOf(places: MoonPlace[]): Point {
  const vectors = places.map(({ lon, lat }) => [
    Math.cos(radians(lat)) * Math.cos(radians(lon)),
    Math.cos(radians(lat)) * Math.sin(radians(lon)),
    Math.sin(radians(lat)),
  ]);
  const [x, y, z] = [0, 1, 2].map((axis) => vectors.reduce((sum, vector) => sum + vector[axis], 0));
  return [degrees(Math.atan2(y, x)), degrees(Math.atan2(z, Math.hypot(x, y)))];
}

const moonProjection = (target: Point, camera: number) =>
  geoOrthographic()
    .scale(MOON_RADIUS * (1 + ZOOM * camera))
    .translate(MOON_CENTER)
    .rotate([-target[0] * camera, -target[1] * camera]);

// Everything about the Moon that does not move: which places it shows, where the camera turns, when each place comes
// in, and where its label goes. Unknown names are skipped, and a place named twice is shown once.
function planMoon(sites: string[], words: TimedWord[], durationSec: number) {
  const places: MoonPlace[] = [];
  for (const name of sites) {
    const place = moonPlace(name);
    if (place && !places.some((other) => other.lon === place.lon && other.lat === place.lat)) places.push(place);
  }
  const middle = places.length > 0 ? middleOf(places) : ([0, 0] as Point);
  const target: Point = [clamp(middle[0] * TURN, -MAX_TURN, MAX_TURN), clamp(middle[1] * TURN, -MAX_TURN, MAX_TURN)];
  const final = moonProjection(target, 1);

  // Sites first, since a marker is the thing to look at, then the seas' names where there is room.
  const ordered = [...places.filter((place) => place.kind === "site"), ...places.filter((place) => place.kind === "sea")];
  const taken: Box[] = [];
  const at = new Map<MoonPlace, Point | null>();
  for (const place of ordered) {
    const point = final([place.lon, place.lat]);
    if (!point) continue;
    if (place.kind === "site") taken.push({ x: point[0], y: point[1], w: 40, h: 40 });
  }
  for (const place of ordered) {
    const point = final([place.lon, place.lat]);
    if (!point) {
      at.set(place, null);
      continue;
    }
    const size = place.kind === "site" ? SITE_LABEL : SEA_LABEL;
    const half = labelBox(0, 0, place.name, size).w / 2;
    const offsets: Point[] =
      place.kind === "site"
        ? [[half + 28, 0], [-half - 28, 0], [0, -52], [0, 56]]
        : [[0, 0], [0, -54], [0, 54]];
    let chosen: Point | null = null;
    for (const [dx, dy] of offsets) {
      const box = labelBox(point[0] + dx, point[1] + dy, place.name, size);
      const inFrame = box.x - box.w / 2 > 30 && box.x + box.w / 2 < VIDEO.width - 30 && box.y - box.h / 2 > FREE.top - 50 && box.y + box.h / 2 < FREE.bottom + 30;
      if (inFrame && !taken.some((other) => overlaps(box, other))) {
        taken.push(box);
        chosen = [dx, dy];
        break;
      }
    }
    at.set(place, chosen);
  }

  const marks: MoonMark[] = places.map((place, index) => {
    const namesOf = (entry: { name: string; aliases: string[] }) => [entry.name, ...entry.aliases];
    const sea = place.kind === "sea" ? MOON_SEAS.find((entry) => namesOf(entry).includes(place.name)) : undefined;
    const site = place.kind === "site" ? MOON_SITES.find((entry) => namesOf(entry).includes(place.name)) : undefined;
    const entry = sea ?? site;
    return {
      ...place,
      startSec: placeSpokenAt(words, [place.name, ...(entry ? namesOf(entry) : [])], 0.9 + index * 0.6, durationSec),
      shapes: sea ? seaCircles(sea).map(circle) : [],
      label: at.get(place) ?? null,
    };
  });
  // A short scene gets a quicker move, so the camera is still before the next scene comes in.
  const cameraSec = clamp(durationSec - DONE_BEFORE_END - 1, 1, CAMERA_SEC);
  return { target, marks, cameraSec };
}

// The Moon's near side as a map: its seas, a faint grid, a slow move toward the places the narration names, the seas
// it names in teal, and each landing site as an amber marker that comes in as it is named.
function MoonView({ sites, words, durationSec }: { sites: string[]; words: TimedWord[]; durationSec: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const plan = useMemo(() => planMoon(sites, words, durationSec), [sites, words, durationSec]);
  const camera = ease(frame, fps, 0, plan.cameraSec);
  const projection = moonProjection(plan.target, camera);
  const path = geoPath(projection);
  const draw = (shape: GeoPermissibleObjects) => path(shape) ?? "";
  const radius = projection.scale();
  const [cx, cy] = MOON_CENTER;
  const seas = plan.marks.filter((mark) => mark.kind === "sea");
  const siteMarks = plan.marks.filter((mark) => mark.kind === "site");
  // Whether a point is on the side of the Moon facing the camera.
  const facing = (lon: number, lat: number) => path({ type: "Point", coordinates: [lon, lat] }) !== null;

  return (
    <AbsoluteFill>
      <svg width={VIDEO.width} height={VIDEO.height} viewBox={`0 0 ${VIDEO.width} ${VIDEO.height}`}>
        <circle cx={cx} cy={cy} r={radius} fill={COLORS.moon} />
        {SEA_SHAPES.map((shape, index) => (
          <path key={index} d={draw(shape)} fill={COLORS.moonSea} />
        ))}
        {seas.map((mark) =>
          mark.shapes.map((shape, index) => (
            <path
              key={`${mark.name}-${index}`}
              d={draw(shape)}
              fill={COLORS.teal}
              opacity={ease(frame, fps, mark.startSec, 0.6)}
            />
          )),
        )}
        <path d={draw(graticule)} fill="none" stroke={COLORS.border} strokeWidth={1} opacity={0.45} />
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke={COLORS.border} strokeWidth={3} />
        {siteMarks.map((mark) => {
          const point = projection([mark.lon, mark.lat]);
          if (!point || !facing(mark.lon, mark.lat)) return null;
          const pop = ease(frame, fps, mark.startSec, 0.4);
          const ring = ease(frame, fps, mark.startSec, 0.9);
          return (
            <g key={mark.name}>
              {ring > 0 && ring < 1 ? <circle cx={point[0]} cy={point[1]} r={16 + 34 * ring} fill="none" stroke={COLORS.signal} strokeWidth={4} opacity={1 - ring} /> : null}
              <circle cx={point[0]} cy={point[1]} r={15 * pop} fill={COLORS.signal} stroke={COLORS.ink} strokeWidth={4} />
            </g>
          );
        })}
        {plan.marks.map((mark) => {
          const point = projection([mark.lon, mark.lat]);
          if (!point || !mark.label || !facing(mark.lon, mark.lat)) return null;
          const site = mark.kind === "site";
          return (
            <text
              key={mark.name}
              x={point[0] + mark.label[0]}
              y={point[1] + mark.label[1]}
              textAnchor="middle"
              dominantBaseline="middle"
              fontFamily={FONTS.body}
              fontSize={site ? SITE_LABEL : SEA_LABEL}
              fontWeight={site ? 700 : 600}
              fill={COLORS.paper}
              stroke={COLORS.ink}
              strokeWidth={10}
              paintOrder="stroke"
              strokeLinejoin="round"
              opacity={ease(frame, fps, mark.startSec + 0.1, 0.4)}
            >
              {mark.name}
            </text>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
}
