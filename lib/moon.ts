// The Moon's near side for space scenes: its seas (maria) and the places spacecraft landed. The director only picks
// names from these tables, and the code places them, never the model's own coordinates.
//
// Coordinates are selenographic: latitude north and longitude east, in degrees (south and west are negative).
// Seas: names, centers and sizes from the USGS Gazetteer of Planetary Nomenclature (IAU), table
// MOON_nomenclature_center_pts, https://planetarynames.wr.usgs.gov/GIS_Downloads. `radius` is half the Gazetteer
// diameter, as degrees of arc on a Moon of radius 1737.4 km. `shape` draws the sea as circles fitted to its dark
// ground on NASA's LROC color map of the Moon (https://svs.gsfc.nasa.gov/4720), each inside the Gazetteer's extent of
// that sea. By hand: the Sea of Cold, too faint to fit, and Fra Mauro, dark highland where Apollo 14 landed, left out.
// Sites: NASA NSSDCA, "Lunar artifact impacts and landings",
// https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_artifact_impacts.html (positions measured on Lunar Reconnaissance
// Orbiter images, Wagner et al. 2017), and the Gazetteer's landing site names (Statio Tranquillitatis, Statio Shiv
// Shakti, Statio Tianchuan).

// A circle on the Moon: the longitude and latitude of its center and its radius, in degrees.
export type MoonCircle = [lon: number, lat: number, radius: number];

export type MoonSea = {
  name: string; // the English name, the way a narration says it
  aliases: string[]; // the Latin name and other spellings
  lon: number;
  lat: number;
  radius: number; // approximate radius, in degrees of arc
  shape?: MoonCircle[]; // the circles that draw the sea; without them, one circle around its center
};

export type MoonSite = { name: string; aliases: string[]; lon: number; lat: number };

export type MoonPlace = { name: string; lon: number; lat: number; kind: "sea" | "site"; radius?: number };

export const MOON_SEAS: MoonSea[] = [
  {
    name: "Sea of Tranquility",
    aliases: ["Mare Tranquillitatis", "Sea of Tranquillity"],
    lon: 30.83,
    lat: 8.35,
    radius: 14.4,
    shape: [[27.2, 10.8, 11.1], [39.2, 6.8, 7.4], [37.3, 16.3, 3.8], [27.7, -0.7, 3.6], [15.7, 11.8, 3.2]],
  },
  {
    name: "Sea of Serenity",
    aliases: ["Mare Serenitatis"],
    lon: 18.36,
    lat: 27.29,
    radius: 11.1,
    shape: [[18.3, 26.8, 10.4], [9.3, 19.8, 5], [28.8, 22.3, 3.2], [12.8, 13.3, 3.1], [6.8, 29.8, 2.8]],
  },
  {
    name: "Sea of Rains",
    aliases: ["Mare Imbrium", "Sea of Showers"],
    lon: -14.91,
    lat: 34.72,
    radius: 18.9,
    shape: [
      [-19.7, 31.8, 16.5], [-6.7, 19.8, 4.1], [-10.7, 46.8, 3.8], [-5.2, 43.8, 3.7], [-17.7, 48.3, 3.2], [-1.7, 26.8, 3.1],
      [-15.2, 15.8, 2.8],
    ],
  },
  {
    name: "Sea of Crises",
    aliases: ["Mare Crisium", "Sea of Crisis"],
    lon: 59.1,
    lat: 16.18,
    radius: 9.2,
    shape: [[59.3, 16.8, 6.8], [66.8, 16.8, 2.9], [65.8, 19.8, 2.5]],
  },
  {
    name: "Sea of Fertility",
    aliases: ["Mare Fecunditatis", "Sea of Fecundity"],
    lon: 53.67,
    lat: -7.84,
    radius: 13.9,
    shape: [[49.7, -3.3, 8.8], [58.8, -1.7, 5], [46.8, 5.3, 3.5], [54.3, -11.2, 3.2], [55.8, -14.3, 2.8]],
  },
  { name: "Sea of Nectar", aliases: ["Mare Nectaris"], lon: 34.6, lat: -15.19, radius: 5.6, shape: [[34.8, -15.2, 3.8]] },
  {
    name: "Sea of Clouds",
    aliases: ["Mare Nubium"],
    lon: -17.29,
    lat: -20.59,
    radius: 11.8,
    shape: [
      [-14.7, -22.2, 6.9], [-18.2, -15.7, 4.9], [-11.2, -15.7, 4.6], [-26.2, -22.7, 4.2], [-11.7, -9.2, 3.5],
      [-27.7, -18.2, 3.5], [-22.2, -25.2, 3], [-25.7, -27.2, 2.7],
    ],
  },
  {
    name: "Sea of Moisture",
    aliases: ["Mare Humorum", "Sea of Humors"],
    lon: -38.57,
    lat: -24.48,
    radius: 6.9,
    shape: [[-38.2, -24.2, 6.6], [-30.7, -24.2, 2.7]],
  },
  {
    name: "Sea of Cold",
    aliases: ["Mare Frigoris"],
    lon: -0.01,
    lat: 57.59,
    radius: 23.9,
    shape: [
      [-42, 53, 3.6], [-33, 54.5, 3.8], [-24, 56, 3.8], [-15, 57, 3.8], [-6, 57.5, 4], [3, 57.5, 4], [12, 58, 3.8],
      [21, 58.5, 3.8], [30, 58.5, 3.6], [36, 58, 3],
    ],
  },
  {
    name: "Sea of Vapors",
    aliases: ["Mare Vaporum", "Sea of Vapours"],
    lon: 4.09,
    lat: 13.2,
    radius: 4,
    shape: [[3.3, 13.8, 5.6], [7.8, 10.3, 4.1]],
  },
  {
    name: "Known Sea",
    aliases: ["Mare Cognitum", "Sea That Has Become Known"],
    lon: -22.31,
    lat: -10.53,
    radius: 5.8,
    shape: [[-20.7, -11.2, 4.6], [-25.7, -11.2, 3.6]],
  },
  {
    name: "Ocean of Storms",
    aliases: ["Oceanus Procellarum"],
    lon: -56.68,
    lat: 20.67,
    radius: 42.7,
    shape: [
      [-65.7, 27.8, 14.8], [-53.2, 9.8, 13.1], [-48.2, -2.7, 13], [-61.7, 42.3, 10], [-35.7, 22.8, 9.7], [-39.2, 32.2, 9],
      [-35.2, -2.2, 7.5], [-32.7, -13.7, 6.3], [-23.2, -4.5, 5], [-66.7, 12.8, 4.6], [-40.2, 13.8, 4], [-61.2, -0.7, 3.5],
      [-51.2, 50.3, 3.5], [-71.7, 13.8, 3.5], [-69.2, 51.3, 3.1], [-75.2, 44.3, 3], [-48.2, 41.8, 2.7], [-49.7, -15.7, 2.7],
    ],
  },
  {
    name: "Sea of Islands",
    aliases: ["Mare Insularum"],
    lon: -30.64,
    lat: 7.79,
    radius: 8.4,
    shape: [[-27.2, -0.7, 6], [-30.2, 4.8, 5], [-33.2, 13.3, 4.5], [-18.2, 4.8, 3.2]],
  },
  { name: "Bay of Rainbows", aliases: ["Sinus Iridum"], lon: -31.67, lat: 45.01, radius: 4.1 },
  {
    name: "Seething Bay",
    aliases: ["Sinus Aestuum"],
    lon: -8.34,
    lat: 12.1,
    radius: 5.2,
    shape: [[-8.2, 12.3, 7.3], [-10.7, 5.3, 7.2]],
  },
  {
    name: "Central Bay",
    aliases: ["Sinus Medii", "Bay of the Center", "Bay of the Centre"],
    lon: 1.03,
    lat: 1.63,
    radius: 4.7,
    shape: [[-2.2, 1.8, 3.4]],
  },
  { name: "Bay of Roughness", aliases: ["Sinus Asperitatis"], lon: 27.49, lat: -5.41, radius: 3.6, shape: [[27.7, -4.7, 3]] },
  { name: "Lake of Dreams", aliases: ["Lacus Somniorum"], lon: 30.8, lat: 37.56, radius: 7, shape: [[26.3, 36.3, 3.8]] },
];

export const MOON_SITES: MoonSite[] = [
  { name: "Tranquility Base", aliases: ["Apollo 11", "Statio Tranquillitatis", "Tranquillity Base"], lon: 23.4732, lat: 0.6741 },
  { name: "Apollo 12", aliases: [], lon: -23.4219, lat: -3.0128 },
  { name: "Apollo 14", aliases: ["Fra Mauro", "Fra Mauro highlands", "Fra Mauro formation"], lon: -17.47194, lat: -3.64589 },
  { name: "Apollo 15", aliases: ["Hadley Rille", "Hadley-Apennine", "Hadley"], lon: 3.6333, lat: 26.13239 },
  { name: "Apollo 16", aliases: ["Descartes Highlands", "Descartes"], lon: 15.5011, lat: -8.9734 },
  { name: "Apollo 17", aliases: ["Taurus-Littrow", "Taurus-Littrow valley"], lon: 30.7723, lat: 20.1911 },
  // Where Luna 2 hit is not known exactly: within 29-31 N, 1 W-1 E (NSSDCA).
  { name: "Luna 2", aliases: ["Lunik 2"], lon: 0, lat: 30 },
  // From the first Soviet report; the lander is probably at least 10 km from here (NSSDCA).
  { name: "Luna 9", aliases: ["Lunik 9"], lon: -64.37, lat: 7.13 },
  { name: "Luna 16", aliases: [], lon: 56.3638, lat: -0.5137 },
  { name: "Lunokhod 1", aliases: ["Luna 17"], lon: -35.00163, lat: 38.23764 },
  { name: "Luna 24", aliases: [], lon: 62.2129, lat: 12.7142 },
  { name: "Surveyor 1", aliases: [], lon: -43.3398, lat: -2.4745 },
  { name: "Chang'e 3", aliases: ["Yutu"], lon: -19.5117, lat: 44.1214 },
  { name: "Chang'e 5", aliases: ["Statio Tianchuan"], lon: -51.9161, lat: 43.0576 },
  { name: "Chandrayaan-3", aliases: ["Statio Shiv Shakti", "Shiv Shakti point", "Shiv Shakti"], lon: 32.3198, lat: -69.3734 },
  { name: "SLIM", aliases: ["Smart Lander for Investigating Moon"], lon: 25.251, lat: -13.316 },
];

// A name reduced to its letters and digits, so "Chang'e-3", "Change 3" and "chang e 3" are the same name. Words that
// only say what kind of place it is are dropped: "the Apollo 11 landing site" is "Apollo 11".
const key = (text: string) =>
  text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\b(?:the|landing|impact|crash|site|area)\b/g, " ")
    .replace(/[^a-z0-9]/g, "");

// A sea or landing site by its name or one of its other names, in any case and with any punctuation, or null if the
// tables do not have it. The name comes back the way the table spells the name that matched, so a label shows the
// words the narration used: "apollo 11 landing site" gives "Apollo 11", "mare tranquillitatis" gives
// "Mare Tranquillitatis".
export function moonPlace(name: string): MoonPlace | null {
  const wanted = key(name);
  if (!wanted) return null;
  for (const sea of MOON_SEAS) {
    const match = [sea.name, ...sea.aliases].find((candidate) => key(candidate) === wanted);
    if (match) return { name: match, lon: sea.lon, lat: sea.lat, kind: "sea", radius: sea.radius };
  }
  for (const site of MOON_SITES) {
    const match = [site.name, ...site.aliases].find((candidate) => key(candidate) === wanted);
    if (match) return { name: match, lon: site.lon, lat: site.lat, kind: "site" };
  }
  return null;
}

// The circles that draw a sea.
export const seaCircles = (sea: MoonSea): MoonCircle[] => sea.shape ?? [[sea.lon, sea.lat, sea.radius]];
