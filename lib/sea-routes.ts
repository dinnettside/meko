import { geoDistance, geoInterpolate } from "d3-geo";
import { countries } from "./world.ts";

// Sea routes that go around land. Ships sail between waypoints in open water (straits, capes and the middle of seas)
// along sea lanes, each checked to cross no land on the map (lib/world.ts), sampled every 2.5 km, except a few narrow
// straits and canals that the map's coastlines draw closed (NARROWS and CANALS). A port joins the nearest waypoints
// it can reach, the route is the shortest way through the lanes, and it is then straightened from cape to cape
// where the sea allows.

type LonLat = [number, number];

// Waypoints as [longitude, latitude], each in open water.
const WAYPOINTS: Record<string, LonLat> = {
  // The Atlantic coast of Europe, the North Sea and the Baltic
  capeStVincent: [-9.4, 36.8],
  cadizGulf: [-7.0, 36.6],
  lisbonOff: [-9.7, 38.6],
  portugalNorth: [-9.6, 41.2],
  finisterre: [-9.9, 43.2],
  biscay: [-5.5, 45.0],
  gironde: [-1.6, 45.6],
  brittany: [-3.4, 47.0],
  ushant: [-5.8, 48.3],
  scilly: [-6.3, 49.5],
  channelWest: [-4.2, 50.0],
  channelMid: [-1.3, 50.25],
  channelEast: [0.5, 50.5],
  dover: [1.45, 51.0],
  thames: [1.5, 51.6],
  northSeaSouth: [2.7, 52.3],
  frisianIslands: [4.4, 53.0],
  northSea: [3.5, 55.0],
  germanBight: [7.8, 54.2],
  jutlandWest: [7.5, 56.5],
  northSeaNorth: [2.5, 58.5],
  forth: [-2.6, 56.2],
  skagerrak: [9.0, 57.9],
  skagen: [10.45, 57.9],
  kattegat: [11.6, 57.0],
  kattegatSouth: [12.35, 56.55],
  kullen: [12.4, 56.4],
  oresund: [12.8, 55.75],
  balticWest: [12.8, 54.75],
  bornholm: [14.2, 55.0],
  bornholmSouth: [15.45, 55.0],
  balticSouth: [17.5, 55.5],
  gdanskOff: [19.0, 54.7],
  gotlandEast: [20.2, 57.3],
  hiiumaaWest: [21.7, 58.75],
  hiiumaaNorth: [22.35, 59.1],
  irbe: [22.2, 57.8],
  rigaGulf: [23.6, 57.6],
  stockholmOff: [19.8, 59.0],
  finlandGulfWest: [23.3, 59.5],
  finlandGulfEast: [26.0, 59.75],
  petersburgOff: [29.0, 59.95],
  norwaySouth: [6.5, 57.8],
  stavangerOff: [5.3, 58.85],
  bergenOff: [4.4, 60.4],
  norwayWest: [4.5, 62.5],
  trondheimOff: [7.6, 64.0],
  lofoten: [11.0, 67.5],
  norwayNorth: [16.0, 70.3],
  nordkapp: [25.8, 71.5],
  barents: [36.0, 70.5],
  murmanskOff: [33.6, 69.6],
  whiteSea: [38.8, 65.2],
  gorlo: [40.5, 66.3],
  gorloNorth: [41.45, 67.0],
  whiteSeaMouth: [41.5, 67.6],
  kolaEast: [41.0, 69.0],
  // Ireland and the Irish Sea
  irelandSouth: [-8.3, 51.55],
  mizenHead: [-10.15, 51.35],
  celticSea: [-7.0, 50.8],
  bristolChannel: [-4.5, 51.3],
  stGeorge: [-5.6, 52.0],
  irishSea: [-5.2, 53.4],
  liverpoolBay: [-3.7, 53.65],
  irishSeaNorth: [-5.2, 54.3],
  northChannel: [-5.8, 55.1],
  rathlin: [-6.2, 55.4],
  malinHead: [-6.8, 55.45],
  irelandNorth: [-8.0, 55.7],
  irelandWest: [-11.0, 53.0],
  mayoOff: [-10.0, 54.4],
  hebrides: [-8.0, 57.5],
  lewisWest: [-7.35, 58.1],
  capeWrath: [-5.0, 59.0],
  orkneyNorth: [-2.7, 59.4],
  fairIsle: [-1.9, 59.3],
  // The North Atlantic
  faroe: [-7.0, 61.2],
  icelandSouth: [-19.0, 62.9],
  reykjanes: [-23.2, 63.7],
  faxafloi: [-22.8, 64.25],
  greenlandSouth: [-44.0, 59.0],
  labrador: [-54.0, 55.0],
  belleIsle: [-54.8, 51.7],
  newfoundlandEast: [-51.5, 48.5],
  capeRace: [-52.8, 46.3],
  saintPierreSouth: [-55.85, 46.7],
  cabot: [-59.6, 47.25],
  stLawrenceGulf: [-62.5, 48.4],
  gaspe: [-65.3, 49.35],
  stLawrence: [-67.5, 49.1],
  stLawrenceUpper: [-69.5, 48.1],
  northAtlanticEast: [-15.0, 45.0],
  northAtlantic: [-35.0, 45.0],
  northAtlanticWest: [-52.0, 42.0],
  azores: [-26.5, 37.5],
  midAtlantic: [-45.0, 31.0],
  sargasso: [-62.0, 27.0],
  bermuda: [-64.7, 32.0],
  // The coast of North America
  halifaxOff: [-63.5, 44.4],
  capeSable: [-65.65, 43.4],
  gulfOfMaine: [-68.5, 43.0],
  nantucket: [-69.9, 40.95],
  blockIsland: [-71.2, 41.1],
  newYorkOff: [-73.7, 40.3],
  newYorkHarbor: [-74.0, 40.5],
  delawareOff: [-74.7, 38.7],
  delawareBay: [-75.2, 39.1],
  chesapeakeOff: [-75.6, 36.95],
  chesapeakeMouth: [-76.0, 37.0],
  chesapeakeBay: [-76.15, 37.6],
  chesapeakeNorth: [-76.3, 38.3],
  hatteras: [-75.0, 35.0],
  charlestonOff: [-79.5, 32.5],
  floridaEast: [-80.0, 28.0],
  miamiOff: [-79.75, 25.6],
  floridaStrait: [-81.5, 23.95],
  havanaOff: [-82.35, 23.35],
  gulfOfMexico: [-89.0, 25.0],
  mississippiOff: [-88.9, 28.7],
  galvestonOff: [-94.6, 29.0],
  veracruzOff: [-95.9, 19.35],
  campeche: [-90.5, 21.8],
  yucatan: [-86.0, 21.8],
  // The Caribbean
  bahamasEast: [-74.0, 25.5],
  sanSalvadorOff: [-74.2, 24.05],
  bahamasSouth: [-74.9, 22.75],
  cubaNorth: [-75.5, 22.0],
  windward: [-73.9, 19.95],
  tortuga: [-72.6, 20.15],
  haitiNorth: [-72.2, 20.05],
  hispaniolaNorth: [-69.0, 19.9],
  monaPassage: [-67.75, 18.4],
  saona: [-68.55, 18.2],
  puertoRicoNorth: [-66.1, 18.75],
  leewardIslands: [-62.0, 16.15],
  santoDomingoOff: [-69.9, 18.15],
  hispaniolaSouth: [-71.0, 17.2],
  haitiSouth: [-73.5, 17.7],
  haitiWest: [-74.6, 18.35],
  jamaicaSouth: [-76.8, 17.65],
  jamaicaSouthwest: [-77.5, 17.75],
  jamaicaWest: [-78.8, 18.3],
  cayman: [-81.5, 18.8],
  caribbean: [-75.0, 15.0],
  caribbeanEast: [-66.0, 14.5],
  antilles: [-61.05, 14.25],
  atlanticAntilles: [-58.5, 14.0],
  venezuelaOff: [-66.9, 10.95],
  curacaoSouth: [-68.9, 11.85],
  guajira: [-72.35, 12.95],
  cartagenaOff: [-75.75, 10.45],
  colon: [-79.9, 9.55],
  // South America
  panamaGulf: [-79.4, 8.75],
  panamaPacific: [-79.6, 7.2],
  colombiaPacific: [-79.0, 3.5],
  guayaquilOff: [-81.3, -2.3],
  ecuadorOff: [-80.5, 0.2],
  galapagos: [-90.0, -1.8],
  peruNorth: [-81.8, -6.0],
  callaoOff: [-77.45, -12.1],
  peruSouth: [-76.5, -15.5],
  chileNorth: [-71.0, -24.0],
  valparaisoOff: [-71.9, -33.0],
  chileMid: [-71.55, -28.55],
  chiloe: [-75.0, -42.0],
  concepcionOff: [-73.85, -37.75],
  chileSouth: [-77.0, -46.0],
  chilePatagonia: [-76.5, -52.5],
  capeHorn: [-67.3, -56.4],
  fuegoWest: [-72.0, -54.7],
  statenEast: [-63.3, -55.2],
  magellanEast: [-68.0, -52.4],
  firstNarrows: [-69.3, -52.5],
  secondNarrows: [-70.4, -52.9],
  puntaArenasOff: [-70.9, -53.5],
  froward: [-71.2, -53.95],
  magellanWestArm: [-72.3, -53.6],
  pasoLargo: [-73.35, -53.05],
  pilar: [-74.6, -52.7],
  argentinaSouth: [-65.0, -49.0],
  falklandsNorth: [-59.7, -49.9],
  falklandsEast: [-57.3, -51.9],
  valdes: [-62.5, -43.0],
  argentinaNorth: [-56.5, -38.5],
  plate: [-54.8, -35.3],
  plateInner: [-56.8, -35.1],
  brazilSouth: [-47.5, -28.0],
  rioGrandeOff: [-51.15, -31.85],
  santosOff: [-46.2, -24.3],
  rioOff: [-43.15, -23.2],
  capeFrio: [-41.8, -23.3],
  abrolhos: [-37.5, -18.0],
  salvadorOff: [-38.4, -13.3],
  recifeOff: [-34.6, -8.1],
  saoFranciscoOff: [-36.05, -10.35],
  saoRoque: [-34.8, -5.0],
  brazilNorth: [-41.0, -2.0],
  belemOff: [-47.9, -0.4],
  amazon: [-48.0, 1.5],
  guianas: [-53.0, 7.5],
  // The open Atlantic
  tropicalAtlanticEast: [-25.0, 18.0],
  capeVerdeSouth: [-24.15, 9.3],
  tropicalAtlantic: [-45.0, 15.0],
  equatorialAtlantic: [-27.0, 0.0],
  southAtlantic: [-25.0, -20.0],
  southAtlanticEast: [0.0, -30.0],
  southAtlanticWest: [-35.0, -38.0],
  stHelenaOff: [-5.8, -15.8],
  // Around Africa
  gibraltar: [-5.45, 35.97],
  trafalgar: [-6.2, 36.2],
  madeira: [-16.9, 32.45],
  canaries: [-14.9, 28.3],
  tenerifeEast: [-16.3, 28.05],
  gomeraSouth: [-17.05, 27.95],
  canariesWest: [-17.6, 27.9],
  bojador: [-15.2, 26.0],
  capeBlanc: [-17.5, 20.5],
  capeVerdeIslands: [-22.4, 15.4],
  dakarOff: [-17.75, 14.55],
  bijagos: [-17.0, 10.8],
  sierraLeone: [-13.6, 8.3],
  liberiaOff: [-11.35, 5.75],
  capePalmas: [-7.7, 4.0],
  ivoryCoastOff: [-4.0, 4.8],
  capeThreePoints: [-2.1, 4.4],
  elminaOff: [-1.35, 4.8],
  ouidahOff: [2.1, 6.05],
  lagosOff: [3.4, 6.15],
  nigerDelta: [5.8, 3.8],
  biafra: [8.0, 3.0],
  saoTome: [5.5, 0.5],
  gabon: [8.4, -1.0],
  congoMouth: [11.7, -6.1],
  luandaOff: [13.0, -8.7],
  angolaOff: [12.95, -10.65],
  benguelaOff: [13.0, -12.5],
  angolaSouth: [12.1, -14.35],
  namibiaNorth: [11.2, -17.5],
  walvisOff: [14.2, -23.0],
  luderitz: [14.75, -25.6],
  orange: [15.8, -29.0],
  columbine: [17.4, -32.9],
  capeTownOff: [18.2, -33.85],
  capeOfGoodHope: [18.4, -34.75],
  agulhas: [20.0, -35.2],
  mosselBay: [22.5, -34.6],
  portElizabethOff: [25.9, -34.15],
  eastLondon: [28.4, -33.4],
  durbanOff: [31.4, -29.9],
  zululand: [32.65, -28.15],
  delagoa: [33.3, -25.85],
  inhambaneOff: [35.35, -24.55],
  bazaruto: [35.8, -23.0],
  beiraOff: [35.3, -20.0],
  mozambiqueChannel: [40.5, -18.5],
  mozambiqueChannelSouth: [42.35, -23.2],
  mozambiqueIsland: [41.0, -15.0],
  capeDelgado: [41.0, -10.5],
  kilwaOff: [39.7, -9.0],
  mafiaNorth: [39.95, -7.45],
  zanzibarChannel: [39.05, -6.3],
  pemba: [39.3, -5.2],
  mombasaOff: [39.95, -4.1],
  malindiOff: [40.35, -3.2],
  lamuOff: [41.3, -2.4],
  mogadishuOff: [45.6, 1.9],
  somaliaSouthEast: [49.5, 5.0],
  somaliaEast: [52.0, 9.5],
  socotraWest: [52.75, 12.05],
  guardafui: [51.7, 12.1],
  madagascarNorth: [49.6, -11.5],
  madagascarEast: [50.5, -18.0],
  madagascarNortheast: [50.5, -14.9],
  madagascarSouth: [45.5, -26.6],
  madagascarSoutheast: [48.75, -23.1],
  mauritiusOff: [57.3, -20.1],
  // The Mediterranean
  alboran: [-3.0, 36.0],
  spainSoutheast: [-0.5, 37.3],
  capeNao: [0.2, 38.6],
  valenciaGulf: [0.3, 39.3],
  barcelonaOff: [2.5, 41.2],
  lionGulf: [4.5, 42.7],
  marseilleOff: [5.3, 43.1],
  toulonOff: [6.55, 43.05],
  ligurian: [8.6, 43.9],
  capCorse: [9.35, 43.2],
  westMed: [5.5, 39.0],
  algiersOff: [3.0, 37.0],
  sardiniaSouth: [9.2, 38.6],
  corsicaEast: [9.85, 42.2],
  tyrrhenianNorth: [11.0, 41.9],
  romeOff: [12.1, 41.6],
  naplesOff: [14.07, 40.6],
  tyrrhenian: [12.5, 39.8],
  sicilyNorth: [13.6, 38.5],
  messinaSouth: [15.55, 37.9],
  messinaNorth: [15.6, 38.35],
  sicilyChannel: [11.7, 37.35],
  tunisGulf: [10.6, 37.25],
  maltaChannel: [14.4, 36.4],
  ionian: [18.0, 37.0],
  otranto: [18.95, 40.3],
  adriaticSouth: [17.6, 42.0],
  adriaticMid: [14.8, 43.2],
  adriaticNorth: [13.0, 44.8],
  veniceOff: [12.6, 45.25],
  libyaWest: [13.2, 33.3],
  sidra: [19.0, 32.7],
  medCentral: [17.0, 34.5],
  peloponneseSouth: [22.3, 36.0],
  creteSouthwest: [23.85, 35.1],
  creteWest: [23.2, 35.5],
  aegeanSouth: [24.2, 36.3],
  cavoDoro: [24.6, 37.85],
  saronic: [23.7, 37.45],
  athensOff: [23.65, 37.75],
  aegeanCenter: [25.2, 38.7],
  izmirOff: [26.6, 38.85],
  thessalonikiOff: [22.9, 40.3],
  aegeanNorth: [24.6, 39.9],
  lemnosWest: [24.9, 40.05],
  lemnosEast: [25.6, 40.05],
  kassandra: [23.35, 39.9],
  dardanellesSouth: [26.05, 40.0],
  marmara: [28.0, 40.75],
  istanbulOff: [28.85, 40.8],
  bosporus: [29.05, 41.15],
  creteEast: [26.55, 35.45],
  karpathosSouth: [27.3, 35.15],
  rhodesOff: [28.5, 35.85],
  creteSouth: [25.0, 34.6],
  creteSoutheast: [26.2, 34.9],
  levantine: [31.0, 33.5],
  alexandriaOff: [29.85, 31.5],
  nileDelta: [31.35, 31.65],
  portSaid: [32.35, 31.45],
  levantSouth: [34.4, 32.3],
  levantNorth: [35.2, 33.9],
  cyprusSouth: [33.2, 34.25],
  cyprusWest: [31.9, 35.0],
  cyprusEast: [35.25, 35.4],
  iskenderun: [35.9, 36.55],
  turkeySouth: [32.5, 35.9],
  // The Black Sea
  blackSeaSouthwest: [29.6, 41.6],
  blackSeaWest: [29.3, 43.5],
  odessaOff: [30.9, 46.2],
  crimeaWest: [32.8, 44.8],
  crimeaSouth: [34.2, 44.1],
  feodosiaOff: [35.55, 44.85],
  kerchSouth: [36.2, 44.9],
  kerchMouth: [36.55, 45.0],
  kerchStrait: [36.55, 45.2],
  kerchNorth: [36.6, 45.5],
  azov: [36.5, 46.0],
  blackSeaCenter: [34.0, 43.0],
  blackSeaSouth: [35.5, 42.5],
  blackSeaEast: [39.5, 41.7],
  batumiOff: [41.4, 41.75],
  // The Caspian Sea
  caspianNorth: [49.6, 45.2],
  caspianMid: [50.6, 42.5],
  caspianSouth: [51.3, 39.0],
  // The Red Sea and the Gulf of Aden
  suez: [32.58, 29.88],
  gulfOfSuez: [33.0, 28.8],
  gubal: [34.0, 27.4],
  aqabaGulf: [34.75, 28.6],
  redSeaNorth: [35.6, 25.5],
  tiran: [34.4, 27.45],
  jeddahOff: [38.95, 21.45],
  redSeaMid: [39.0, 18.5],
  massawaOff: [39.6, 15.9],
  dahlakSouth: [40.45, 15.25],
  redSeaSouth: [42.0, 14.5],
  babElMandeb: [43.3, 12.6],
  djiboutiOff: [43.5, 11.75],
  obockOff: [43.5, 11.9],
  adenOff: [45.0, 12.45],
  gulfOfAdenEast: [49.5, 13.3],
  socotraNorth: [54.0, 13.2],
  // Arabia, the Persian Gulf and India
  salalahOff: [54.1, 16.75],
  omanSouth: [56.5, 17.0],
  masirah: [59.5, 20.3],
  rasAlHadd: [60.1, 22.6],
  muscatOff: [58.6, 23.9],
  gulfOfOman: [57.5, 25.0],
  hormuz: [56.55, 26.5],
  persianGulfEast: [54.6, 26.3],
  persianGulf: [52.0, 26.8],
  bahrainOff: [51.0, 26.6],
  gulfNorth: [49.3, 28.9],
  basraOff: [48.9, 29.6],
  arabianSeaNorth: [62.0, 23.5],
  karachiOff: [66.8, 24.55],
  gujarat: [70.0, 20.3],
  mumbaiOff: [72.55, 18.9],
  goaOff: [73.45, 15.45],
  calicutOff: [75.45, 11.25],
  kochiOff: [75.9, 9.95],
  trivandrumOff: [76.75, 8.5],
  capeComorin: [77.5, 7.6],
  arabianSea: [65.0, 15.0],
  colomboOff: [79.6, 6.9],
  galleOff: [80.25, 5.9],
  sriLankaSouth: [80.6, 5.4],
  sriLankaSoutheast: [81.6, 6.25],
  sriLankaEast: [82.3, 7.6],
  chennaiOff: [80.6, 13.1],
  bengalWest: [83.6, 17.4],
  hooghly: [88.2, 21.0],
  bayOfBengal: [88.0, 14.0],
  yangonOff: [96.4, 15.6],
  tenDegree: [92.4, 10.0],
  // The Indian Ocean
  indianOceanWest: [62.0, -5.0],
  indianOcean: [75.0, -5.0],
  indianOceanSouth: [75.0, -25.0],
  indianOceanEast: [100.0, -10.0],
  southernOceanWest: [45.0, -38.0],
  southernOcean: [80.0, -38.0],
  southernOceanEast: [105.0, -38.0],
  // Southeast Asia
  greatChannel: [94.6, 6.2],
  andamanSea: [97.0, 7.5],
  penangOff: [100.05, 5.4],
  malaccaNorth: [99.6, 4.7],
  malaccaMid: [100.6, 3.0],
  malaccaSouth: [102.3, 1.9],
  singaporeWest: [103.55, 1.15],
  singaporeEast: [104.4, 1.3],
  bintanEast: [104.8, 1.15],
  riau: [105.6, 0.0],
  karimata: [108.8, -2.2],
  jakartaOff: [106.9, -5.8],
  javaSea: [111.0, -5.2],
  bawean: [112.3, -5.6],
  javaSeaEast: [114.5, -6.3],
  sundaNorth: [106.0, -5.8],
  sundaSouth: [105.5, -6.3],
  indianOceanJava: [107.0, -9.0],
  javaWest: [105.05, -6.95],
  sumatraWest: [95.0, 2.0],
  sumatraSouthwest: [100.0, -4.0],
  baliSouth: [115.5, -9.2],
  sumbaSouth: [120.85, -10.85],
  lombok: [115.8, -8.6],
  baliNorth: [115.45, -7.8],
  floresSea: [120.0, -7.0],
  makassarOff: [118.9, -5.4],
  makassarStrait: [118.3, -2.5],
  makassarNorth: [119.95, 0.65],
  celebesSea: [122.5, 4.0],
  sulawesiNorth: [124.95, 1.9],
  moluccaSea: [126.5, 0.3],
  manipa: [127.35, -2.8],
  bandaSea: [127.0, -5.5],
  timorEast: [127.4, -8.25],
  ambonOff: [128.15, -3.95],
  timorSea: [126.0, -11.0],
  arafura: [134.0, -10.0],
  carpentariaNorth: [139.3, -9.85],
  vungTau: [107.3, 10.1],
  caMau: [104.6, 8.2],
  gulfOfThailand: [101.5, 10.0],
  bangkokBight: [100.7, 12.9],
  southChinaSeaSouth: [107.0, 6.0],
  vietnamSoutheast: [109.6, 11.3],
  vietnamCenter: [109.6, 15.0],
  hueOff: [108.0, 16.8],
  tonkin: [107.5, 19.5],
  haiphongOff: [107.2, 20.4],
  hainanSouth: [109.5, 17.8],
  hainanEast: [111.6, 19.0],
  southChinaSea: [114.0, 16.0],
  southChinaSeaEast: [116.5, 12.5],
  borneoNorth: [114.3, 5.6],
  manilaOff: [120.35, 14.45],
  zambalesOff: [119.9, 15.1],
  luzonWest: [119.3, 16.5],
  leyteGulf: [125.6, 10.8],
  sanBernardinoEast: [124.8, 12.7],
  sanBernardino: [124.2, 12.55],
  ticaoSouth: [123.85, 12.3],
  buriasPass: [123.2, 12.8],
  sibuyanSea: [122.2, 13.2],
  marinduque: [121.9, 13.2],
  verdeIsland: [121.4, 13.55],
  batangasOff: [120.7, 13.75],
  manilaApproach: [120.3, 14.0],
  leyteEntrance: [126.3, 10.6],
  surigao: [125.4, 10.2],
  surigaoSouth: [125.25, 9.85],
  boholSea: [124.6, 9.7],
  cebuOff: [124.1, 10.35],
  // East Asia
  pearlRiver: [114.1, 21.95],
  chinaSouthCoast: [116.8, 22.6],
  luzonStrait: [120.7, 21.0],
  taiwanStraitSouth: [119.0, 22.8],
  xiamenOff: [118.4, 24.2],
  taiwanStrait: [119.3, 24.6],
  taiwanStraitNorth: [120.2, 25.6],
  eastChinaSea: [123.0, 28.0],
  zhoushanOff: [123.0, 30.0],
  shanghaiOff: [122.6, 31.1],
  yellowSea: [123.5, 35.0],
  yellowSeaNorth: [123.0, 37.8],
  bohaiStrait: [121.2, 38.25],
  bohai: [119.5, 38.8],
  incheonOff: [126.2, 37.3],
  koreaSouthwest: [125.8, 33.7],
  jejuEast: [127.2, 33.5],
  koreaStrait: [129.0, 34.85],
  tsushimaStrait: [129.9, 34.1],
  ikiWest: [129.6, 33.9],
  japanSea: [134.0, 38.5],
  vladivostokOff: [132.1, 42.7],
  nagasakiOff: [129.55, 32.6],
  kyushuWest: [129.3, 31.6],
  osumi: [130.3, 30.65],
  kyushuSouth: [131.3, 30.2],
  shikokuSouth: [133.0, 32.3],
  bungo: [132.1, 33.05],
  setoWest: [131.9, 33.9],
  setoNarrows: [133.1, 34.2],
  iyoNada: [132.15, 33.65],
  setoMid: [133.3, 34.25],
  bisanSeto: [133.85, 34.35],
  shodoshimaSouth: [134.25, 34.38],
  setoEast: [134.6, 34.5],
  akashi: [135.05, 34.6],
  kiiChannel: [135.0, 33.75],
  kiiSouth: [136.75, 32.9],
  kitanStrait: [135.0, 34.15],
  osakaBay: [135.2, 34.45],
  tokyoBayOff: [139.75, 34.75],
  bosoEast: [140.8, 34.9],
  tokyoBay: [139.8, 35.4],
  japanPacific: [142.0, 36.0],
  okinawaOff: [127.6, 26.0],
  amami: [129.75, 27.55],
  philippineSea: [130.0, 20.0],
  guamOff: [144.5, 13.1],
  // Australia and New Zealand
  darwinOff: [130.3, -12.1],
  australiaNorthwest: [120.0, -16.0],
  australiaWest: [113.0, -22.0],
  carnarvonOff: [113.1, -23.75],
  sharkBayOff: [113.2, -26.55],
  perthOff: [115.2, -32.0],
  leeuwin: [114.7, -35.2],
  bight: [130.0, -35.5],
  kangarooIsland: [137.75, -39.85],
  melbourneOff: [144.6, -38.6],
  bassStrait: [146.0, -39.6],
  tasmaniaNortheast: [148.4, -40.9],
  hobartOff: [147.7, -43.3],
  brunySouth: [147.2, -43.6],
  tasmaniaSouthwest: [145.7, -44.0],
  tasmanPeninsula: [148.2, -43.1],
  tasmaniaEast: [148.8, -42.5],
  sydneyOff: [151.5, -33.9],
  newSouthWalesNorth: [153.5, -30.9],
  brisbaneOff: [153.7, -27.3],
  coralSea: [154.0, -17.0],
  capeYork: [143.8, -11.0],
  tasman: [160.0, -36.0],
  northCape: [172.7, -34.1],
  bayOfIslands: [174.35, -35.1],
  aucklandGulf: [175.1, -36.5],
  cookStrait: [174.6, -41.3],
  cookStraitWest: [173.6, -40.2],
  // The Pacific
  fijiOff: [178.45, -18.35],
  vitiLevuSouthwest: [177.45, -18.25],
  fijiWest: [176.9, -17.6],
  tahitiOff: [-149.55, -17.35],
  easterIslandOff: [-109.6, -27.3],
  hawaiiOff: [-157.7, 20.95],
  hawaiiNorth: [-155.65, 24.4],
  hawaiiNortheast: [-152.95, 28.5],
  pacificWest: [150.0, 20.0],
  marianas: [147.15, 16.75],
  rotaNorth: [145.2, 14.7],
  pacificNorthwest: [155.0, 35.0],
  northPacificWest: [170.0, 40.0],
  northPacific: [-170.0, 40.0],
  northPacificEast: [-150.0, 38.0],
  californiaOff: [-130.0, 35.0],
  galleonWest: [160.0, 13.0],
  galleonMid: [-175.0, 13.0],
  galleonEast: [-150.0, 13.0],
  hawaiiSouth: [-156.2, 18.4],
  mexicoWest: [-120.0, 13.0],
  pacificEquator: [-140.0, 0.0],
  southPacific: [-130.0, -25.0],
  southPacificEast: [-100.0, -25.0],
  southPacificWest: [-160.0, -10.0],
  tongaNorth: [-170.85, -15.1],
  pacificCentral: [175.0, 5.0],
  // The Pacific coast of the Americas
  centralAmericaPacific: [-88.0, 11.5],
  costaRicaSouth: [-83.4, 7.25],
  acapulcoOff: [-99.9, 16.6],
  michoacanOff: [-103.25, 18.15],
  mexicoPacific: [-106.0, 20.0],
  caboSanLucas: [-109.9, 22.55],
  bajaSouthwest: [-113.35, 25.65],
  bajaWest: [-116.5, 28.3],
  ensenadaOff: [-117.7, 31.4],
  sanDiegoOff: [-118.15, 32.4],
  losAngelesOff: [-118.8, 33.75],
  channelIslands: [-120.3, 33.9],
  pointConception: [-121.0, 34.2],
  sanFranciscoOff: [-122.75, 37.7],
  pointReyes: [-123.2, 37.85],
  pointArena: [-123.85, 39.0],
  mendocino: [-124.8, 40.2],
  oregon: [-125.0, 44.0],
  juanDeFuca: [-124.9, 48.45],
  juanDeFucaInner: [-123.4, 48.27],
  sanJuanIslands: [-123.05, 48.8],
  georgiaStrait: [-123.5, 49.1],
  alaskaGulf: [-145.0, 57.5],
  amukta: [-172.0, 52.6],
  beringSea: [-170.0, 58.5],
};

// Sea lanes. Each line is a chain of waypoints, each a neighbor of the next.
const LANES: string[][] = [
  // Europe
  [
    "gibraltar", "capeStVincent", "lisbonOff", "portugalNorth", "finisterre", "biscay", "ushant", "channelWest",
    "channelMid", "channelEast", "dover", "thames", "northSeaSouth", "northSea", "skagerrak", "skagen", "kattegat",
    "kattegatSouth", "kullen", "oresund", "balticWest", "bornholm", "bornholmSouth", "balticSouth", "gotlandEast",
    "hiiumaaWest", "hiiumaaNorth", "finlandGulfWest", "finlandGulfEast", "petersburgOff",
  ],
  ["gibraltar", "trafalgar", "cadizGulf", "capeStVincent"],
  ["biscay", "gironde"],
  ["biscay", "brittany", "ushant"],
  ["ushant", "scilly", "channelWest"],
  ["dover", "northSeaSouth"],
  [
    "scilly", "celticSea", "irelandSouth", "mizenHead", "irelandWest", "mayoOff", "irelandNorth", "hebrides",
    "lewisWest", "capeWrath", "orkneyNorth", "fairIsle", "northSeaNorth", "northSea", "forth",
  ],
  ["celticSea", "stGeorge", "irishSea", "liverpoolBay"],
  ["irishSea", "irishSeaNorth", "northChannel", "rathlin", "malinHead", "irelandNorth"],
  ["skagerrak", "norwaySouth", "stavangerOff", "bergenOff", "northSeaNorth"],
  ["bergenOff", "norwayWest", "trondheimOff", "lofoten", "norwayNorth", "nordkapp", "barents", "murmanskOff"],
  ["balticSouth", "gdanskOff"],
  ["gotlandEast", "irbe", "rigaGulf"],
  ["gotlandEast", "stockholmOff", "finlandGulfWest"],
  ["northSeaSouth", "frisianIslands", "germanBight", "jutlandWest", "skagerrak"],
  ["germanBight", "northSea"],
  ["celticSea", "bristolChannel", "stGeorge"],
  ["whiteSea", "gorlo", "gorloNorth", "whiteSeaMouth", "kolaEast", "barents"],
  // The North Atlantic
  ["capeWrath", "faroe", "icelandSouth", "reykjanes", "faxafloi"],
  ["reykjanes", "greenlandSouth", "labrador", "belleIsle", "newfoundlandEast", "capeRace"],
  ["faroe", "norwayWest"],
  [
    "finisterre", "northAtlanticEast", "northAtlantic", "northAtlanticWest", "capeRace", "saintPierreSouth", "cabot",
    "stLawrenceGulf", "gaspe", "stLawrence",
  ],
  ["irelandWest", "northAtlantic"],
  ["northAtlanticEast", "azores", "midAtlantic", "sargasso", "bahamasEast"],
  ["azores", "northAtlantic"],
  ["lisbonOff", "azores", "northAtlanticWest"],
  ["midAtlantic", "bermuda", "hatteras"],
  [
    "northAtlanticWest", "halifaxOff", "capeSable", "gulfOfMaine", "nantucket", "blockIsland", "newYorkOff",
    "delawareOff", "chesapeakeOff", "hatteras", "charlestonOff", "floridaEast", "miamiOff", "floridaStrait",
    "havanaOff", "gulfOfMexico", "mississippiOff", "galvestonOff",
  ],
  ["capeRace", "halifaxOff"],
  ["northAtlanticWest", "nantucket"],
  ["bermuda", "newYorkOff"],
  ["gulfOfMexico", "veracruzOff", "campeche", "yucatan", "floridaStrait"],
  ["gulfOfMexico", "yucatan"],
  ["bermuda", "sargasso", "atlanticAntilles"],
  ["stLawrence", "stLawrenceUpper"],
  ["newYorkOff", "newYorkHarbor"],
  ["delawareOff", "delawareBay"],
  ["chesapeakeOff", "chesapeakeMouth", "chesapeakeBay", "chesapeakeNorth"],
  // The Caribbean
  [
    "miamiOff", "bahamasEast", "sanSalvadorOff", "bahamasSouth", "cubaNorth", "windward", "tortuga", "haitiNorth",
    "hispaniolaNorth", "monaPassage", "puertoRicoNorth", "leewardIslands", "atlanticAntilles",
  ],
  ["sargasso", "sanSalvadorOff"],
  ["sargasso", "puertoRicoNorth"],
  ["monaPassage", "saona", "santoDomingoOff", "hispaniolaSouth", "haitiSouth", "haitiWest", "windward"],
  ["haitiSouth", "jamaicaSouth", "jamaicaSouthwest", "jamaicaWest", "cayman", "yucatan"],
  ["jamaicaSouth", "caribbean", "cartagenaOff", "colon"],
  ["caribbean", "caribbeanEast", "antilles", "atlanticAntilles"],
  ["caribbeanEast", "venezuelaOff", "curacaoSouth", "guajira", "cartagenaOff"],
  ["hispaniolaSouth", "caribbeanEast"],
  ["cayman", "colon"],
  ["atlanticAntilles", "tropicalAtlantic", "midAtlantic"],
  [
    "atlanticAntilles", "guianas", "amazon", "belemOff", "brazilNorth", "saoRoque", "recifeOff", "saoFranciscoOff",
    "salvadorOff", "abrolhos", "capeFrio", "rioOff", "santosOff", "brazilSouth", "rioGrandeOff", "plate",
    "plateInner",
  ],
  // South America
  [
    "plate", "argentinaNorth", "valdes", "argentinaSouth", "statenEast", "capeHorn", "fuegoWest", "chilePatagonia",
    "chileSouth", "chiloe", "concepcionOff", "valparaisoOff", "chileMid", "chileNorth", "peruSouth", "callaoOff",
    "peruNorth", "guayaquilOff", "ecuadorOff", "colombiaPacific", "panamaPacific", "panamaGulf",
  ],
  ["argentinaSouth", "falklandsNorth", "falklandsEast", "statenEast"],
  ["guayaquilOff", "galapagos"],
  ["panamaPacific", "galapagos"],
  ["argentinaSouth", "magellanEast", "firstNarrows"],
  ["secondNarrows", "puntaArenasOff"],
  ["pasoLargo", "pilar", "chilePatagonia"],
  // The open Atlantic
  ["canariesWest", "tropicalAtlanticEast", "tropicalAtlantic", "guianas"],
  ["canariesWest", "midAtlantic"],
  ["tropicalAtlanticEast", "capeVerdeSouth", "equatorialAtlantic", "saoRoque"],
  ["capeVerdeIslands", "tropicalAtlanticEast"],
  ["capeVerdeIslands", "equatorialAtlantic"],
  ["equatorialAtlantic", "southAtlantic", "southAtlanticEast", "capeOfGoodHope"],
  ["southAtlantic", "salvadorOff"],
  ["southAtlantic", "stHelenaOff", "namibiaNorth"],
  ["southAtlantic", "southAtlanticWest", "argentinaNorth"],
  ["southAtlanticWest", "southAtlanticEast"],
  ["southAtlanticWest", "brazilSouth"],
  ["capePalmas", "equatorialAtlantic"],
  // Around Africa
  ["capeStVincent", "madeira", "canaries"],
  ["capeStVincent", "canaries"],
  ["canaries", "tenerifeEast", "gomeraSouth", "canariesWest"],
  [
    "canaries", "bojador", "capeBlanc", "dakarOff", "bijagos", "sierraLeone", "liberiaOff", "capePalmas",
    "ivoryCoastOff", "capeThreePoints", "elminaOff", "ouidahOff", "lagosOff", "nigerDelta", "biafra", "gabon",
    "congoMouth", "luandaOff", "angolaOff", "benguelaOff", "angolaSouth", "namibiaNorth", "walvisOff", "luderitz",
    "orange", "columbine", "capeTownOff", "capeOfGoodHope", "agulhas", "mosselBay", "portElizabethOff", "eastLondon",
    "durbanOff", "zululand", "delagoa", "inhambaneOff", "bazaruto", "beiraOff", "mozambiqueChannel",
    "mozambiqueIsland", "capeDelgado", "kilwaOff", "mafiaNorth", "zanzibarChannel", "pemba", "mombasaOff",
    "malindiOff", "lamuOff", "mogadishuOff", "somaliaSouthEast", "somaliaEast", "guardafui", "gulfOfAdenEast",
  ],
  ["canariesWest", "capeBlanc"],
  ["capeBlanc", "capeVerdeIslands", "dakarOff"],
  ["nigerDelta", "saoTome", "gabon"],
  ["capeOfGoodHope", "southernOceanWest", "agulhas"],
  ["mozambiqueChannel", "mozambiqueChannelSouth", "madagascarSouth", "delagoa"],
  ["madagascarSouth", "southernOceanWest"],
  ["madagascarSouth", "madagascarSoutheast", "madagascarEast", "mauritiusOff"],
  ["madagascarEast", "madagascarNortheast", "madagascarNorth", "capeDelgado"],
  ["madagascarNorth", "indianOceanWest", "somaliaSouthEast"],
  ["madagascarNorth", "mozambiqueIsland"],
  ["indianOceanWest", "malindiOff"],
  ["madagascarSoutheast", "indianOceanSouth"],
  // The Mediterranean
  [
    "gibraltar", "alboran", "spainSoutheast", "capeNao", "valenciaGulf", "barcelonaOff", "lionGulf", "marseilleOff",
    "toulonOff", "ligurian", "capCorse", "corsicaEast", "tyrrhenianNorth", "romeOff", "naplesOff", "tyrrhenian",
  ],
  [
    "alboran", "algiersOff", "sardiniaSouth", "sicilyChannel", "maltaChannel", "ionian", "peloponneseSouth",
    "creteWest", "aegeanSouth", "saronic", "athensOff",
  ],
  ["spainSoutheast", "westMed", "lionGulf"],
  ["westMed", "algiersOff"],
  ["westMed", "sardiniaSouth", "tyrrhenian", "sicilyNorth"],
  ["tyrrhenianNorth", "tyrrhenian"],
  ["sardiniaSouth", "tunisGulf", "sicilyChannel"],
  ["sicilyChannel", "libyaWest", "medCentral", "sidra"],
  [
    "maltaChannel", "medCentral", "creteSouth", "levantine", "alexandriaOff", "nileDelta", "portSaid", "levantSouth",
    "levantNorth", "cyprusEast", "iskenderun",
  ],
  ["ionian", "otranto", "adriaticSouth", "adriaticMid", "adriaticNorth", "veniceOff"],
  ["ionian", "medCentral"],
  ["sidra", "creteSouth"],
  ["peloponneseSouth", "creteSouthwest", "creteSouth"],
  ["aegeanSouth", "cavoDoro", "aegeanCenter", "aegeanNorth", "kassandra", "thessalonikiOff"],
  ["aegeanCenter", "izmirOff"],
  ["aegeanNorth", "lemnosWest", "lemnosEast", "dardanellesSouth"],
  ["aegeanCenter", "dardanellesSouth"],
  [
    "aegeanSouth", "creteEast", "karpathosSouth", "rhodesOff", "turkeySouth", "cyprusWest", "cyprusSouth",
    "levantSouth",
  ],
  ["creteSouth", "creteSoutheast", "creteEast"],
  ["creteSouth", "karpathosSouth"],
  ["rhodesOff", "cyprusWest"],
  ["levantine", "cyprusWest"],
  ["levantine", "cyprusSouth", "levantNorth"],
  ["turkeySouth", "iskenderun"],
  ["marmara", "istanbulOff", "bosporus"],
  ["ionian", "messinaSouth"],
  ["tyrrhenian", "messinaNorth", "sicilyNorth"],
  ["messinaNorth", "naplesOff"],
  // The Black Sea
  [
    "bosporus", "blackSeaSouthwest", "blackSeaWest", "odessaOff", "crimeaWest", "crimeaSouth", "feodosiaOff",
    "kerchSouth", "kerchMouth", "kerchStrait", "kerchNorth", "azov",
  ],
  ["blackSeaSouthwest", "blackSeaCenter", "crimeaSouth"],
  ["blackSeaWest", "blackSeaCenter", "blackSeaSouth", "blackSeaEast", "batumiOff"],
  ["blackSeaSouthwest", "blackSeaSouth"],
  ["feodosiaOff", "blackSeaEast"],
  // The Red Sea, Arabia and India
  [
    "suez", "gulfOfSuez", "gubal", "redSeaNorth", "jeddahOff", "redSeaMid", "massawaOff", "dahlakSouth",
    "redSeaSouth", "babElMandeb",
  ],
  [
    "gulfOfAdenEast", "socotraNorth", "salalahOff", "omanSouth", "masirah", "rasAlHadd", "muscatOff", "gulfOfOman",
    "hormuz", "persianGulfEast", "persianGulf", "bahrainOff", "gulfNorth", "basraOff",
  ],
  ["guardafui", "socotraNorth"],
  ["somaliaEast", "socotraWest", "socotraNorth", "arabianSea"],
  ["omanSouth", "arabianSea", "goaOff"],
  [
    "rasAlHadd", "arabianSeaNorth", "karachiOff", "gujarat", "mumbaiOff", "goaOff", "calicutOff", "kochiOff",
    "trivandrumOff", "capeComorin", "colomboOff", "galleOff", "sriLankaSouth", "sriLankaSoutheast", "sriLankaEast",
    "chennaiOff", "bengalWest", "hooghly",
  ],
  ["gulfOfOman", "arabianSeaNorth"],
  ["persianGulf", "gulfNorth"],
  ["arabianSea", "arabianSeaNorth"],
  ["arabianSea", "indianOcean", "sriLankaSouth"],
  ["arabianSea", "indianOceanWest", "indianOcean"],
  ["goaOff", "indianOcean"],
  ["calicutOff", "arabianSea"],
  ["sriLankaEast", "bayOfBengal", "hooghly"],
  ["bayOfBengal", "tenDegree", "andamanSea"],
  ["chennaiOff", "bayOfBengal"],
  ["bayOfBengal", "yangonOff", "andamanSea"],
  ["sriLankaSouth", "greatChannel", "andamanSea"],
  ["indianOcean", "indianOceanSouth", "southernOcean", "southernOceanEast"],
  ["indianOcean", "indianOceanEast", "southernOceanEast"],
  ["southernOceanWest", "southernOcean"],
  ["babElMandeb", "adenOff", "gulfOfAdenEast"],
  ["babElMandeb", "obockOff", "djiboutiOff"],
  ["djiboutiOff", "adenOff"],
  ["redSeaNorth", "tiran", "aqabaGulf"],
  // Southeast Asia
  [
    "greatChannel", "malaccaNorth", "malaccaMid", "malaccaSouth", "singaporeWest", "singaporeEast", "bintanEast",
    "riau", "karimata", "javaSea", "bawean", "javaSeaEast", "floresSea", "bandaSea", "ambonOff",
  ],
  ["andamanSea", "penangOff", "malaccaNorth"],
  [
    "greatChannel", "sumatraWest", "sumatraSouthwest", "indianOceanJava", "javaWest", "sundaSouth", "sundaNorth",
    "jakartaOff", "javaSea",
  ],
  ["sumatraWest", "indianOceanEast"],
  ["indianOceanJava", "indianOceanEast"],
  ["indianOceanJava", "baliSouth", "lombok", "baliNorth", "javaSeaEast"],
  ["baliSouth", "sumbaSouth", "timorSea", "arafura", "carpentariaNorth", "capeYork"],
  [
    "floresSea", "makassarOff", "makassarStrait", "makassarNorth", "celebesSea", "sulawesiNorth", "moluccaSea",
    "manipa", "bandaSea",
  ],
  ["bandaSea", "timorEast", "timorSea"],
  [
    "singaporeEast", "southChinaSeaSouth", "vungTau", "vietnamSoutheast", "vietnamCenter", "hueOff", "tonkin",
    "haiphongOff",
  ],
  ["singaporeEast", "caMau", "gulfOfThailand", "bangkokBight"],
  ["caMau", "vungTau"],
  ["southChinaSeaSouth", "borneoNorth", "southChinaSeaEast", "manilaOff", "zambalesOff", "luzonWest", "luzonStrait"],
  [
    "vietnamCenter", "southChinaSea", "pearlRiver", "chinaSouthCoast", "taiwanStraitSouth", "xiamenOff",
    "taiwanStrait", "taiwanStraitNorth", "eastChinaSea", "zhoushanOff", "shanghaiOff", "yellowSea", "yellowSeaNorth",
    "bohaiStrait", "bohai",
  ],
  ["tonkin", "hainanSouth", "hainanEast", "pearlRiver"],
  ["vietnamSoutheast", "southChinaSea", "southChinaSeaEast"],
  ["southChinaSea", "hainanEast"],
  ["southChinaSea", "luzonStrait", "taiwanStraitSouth"],
  ["luzonStrait", "philippineSea", "okinawaOff", "eastChinaSea"],
  ["leyteGulf", "surigao", "surigaoSouth", "boholSea"],
  ["moluccaSea", "philippineSea"],
  ["philippineSea", "leyteEntrance", "leyteGulf"],
  ["surigaoSouth", "cebuOff"],
  [
    "guamOff", "sanBernardinoEast", "sanBernardino", "ticaoSouth", "buriasPass", "sibuyanSea", "marinduque",
    "verdeIsland", "batangasOff", "manilaApproach", "manilaOff",
  ],
  ["philippineSea", "sanBernardinoEast"],
  // Australia and New Zealand
  ["timorSea", "darwinOff"],
  [
    "timorSea", "australiaNorthwest", "australiaWest", "carnarvonOff", "sharkBayOff", "perthOff", "leeuwin", "bight",
    "kangarooIsland", "melbourneOff", "bassStrait", "tasmaniaNortheast", "tasmaniaEast", "sydneyOff",
    "newSouthWalesNorth", "brisbaneOff", "coralSea", "capeYork",
  ],
  ["indianOceanEast", "australiaWest"],
  ["southernOceanEast", "leeuwin"],
  ["hobartOff", "tasmanPeninsula", "tasmaniaEast"],
  ["tasman", "northCape", "bayOfIslands", "aucklandGulf"],
  ["bassStrait", "tasman"],
  ["hobartOff", "brunySouth", "tasmaniaSouthwest", "southernOceanEast"],
  ["tasman", "cookStraitWest", "cookStrait"],
  // East Asia
  ["yellowSea", "incheonOff", "yellowSeaNorth"],
  ["eastChinaSea", "koreaSouthwest", "yellowSea"],
  ["koreaSouthwest", "koreaStrait", "japanSea", "vladivostokOff"],
  ["koreaSouthwest", "tsushimaStrait", "japanSea"],
  [
    "koreaSouthwest", "jejuEast", "nagasakiOff", "kyushuWest", "osumi", "kyushuSouth", "shikokuSouth", "kiiChannel",
    "kitanStrait", "osakaBay",
  ],
  ["eastChinaSea", "kyushuWest"],
  ["tsushimaStrait", "ikiWest", "nagasakiOff"],
  ["okinawaOff", "amami", "kyushuSouth"],
  ["kiiChannel", "kiiSouth", "tokyoBayOff", "tokyoBay"],
  [
    "tokyoBayOff", "bosoEast", "japanPacific", "pacificNorthwest", "northPacificWest", "northPacific",
    "northPacificEast", "californiaOff", "sanFranciscoOff",
  ],
  [
    "philippineSea", "pacificWest", "marianas", "rotaNorth", "guamOff", "galleonWest", "galleonMid", "galleonEast",
    "mexicoWest", "acapulcoOff",
  ],
  ["pacificWest", "pacificNorthwest"],
  ["kyushuSouth", "pacificWest"],
  ["philippineSea", "guamOff"],
  [
    "shikokuSouth", "bungo", "setoWest", "iyoNada", "setoNarrows", "setoMid", "bisanSeto", "shodoshimaSouth",
    "setoEast", "akashi", "osakaBay",
  ],
  // The Pacific
  [
    "guamOff", "pacificCentral", "southPacificWest", "tahitiOff", "southPacific", "easterIslandOff",
    "southPacificEast", "chileNorth",
  ],
  ["galleonMid", "hawaiiOff", "hawaiiNorth", "hawaiiNortheast", "northPacificEast"],
  ["galleonEast", "hawaiiSouth", "hawaiiOff"],
  ["galleonEast", "pacificEquator", "southPacific"],
  ["pacificEquator", "tahitiOff"],
  ["pacificEquator", "galapagos"],
  ["southPacificEast", "chiloe"],
  ["southPacificEast", "peruSouth"],
  ["southPacificWest", "tongaNorth", "fijiOff", "tasman", "sydneyOff"],
  ["coralSea", "fijiOff"],
  ["mexicoWest", "pacificEquator"],
  ["acapulcoOff", "centralAmericaPacific", "costaRicaSouth", "panamaPacific"],
  [
    "acapulcoOff", "michoacanOff", "mexicoPacific", "caboSanLucas", "bajaSouthwest", "bajaWest", "ensenadaOff",
    "sanDiegoOff", "losAngelesOff", "channelIslands", "pointConception", "sanFranciscoOff", "pointReyes",
    "pointArena", "mendocino", "oregon", "juanDeFuca", "juanDeFucaInner", "sanJuanIslands", "georgiaStrait",
  ],
  ["mexicoWest", "caboSanLucas"],
  ["oregon", "alaskaGulf", "northPacificEast"],
  ["fijiOff", "vitiLevuSouthwest", "fijiWest", "pacificCentral"],
  ["californiaOff", "pointConception"],
  ["northPacific", "amukta", "beringSea"],
  // The Caspian Sea, a lake with no way out
  ["caspianNorth", "caspianMid", "caspianSouth"],
];

// Canals and straits narrower than the map's coastlines, which draw them closed, so these lanes cross land on the map.
// Straits narrower than the map's coastlines, which draw them closed, so these lanes cross land on the map.
const NARROWS: string[][] = [
  ["dardanellesSouth", "marmara"], // the Dardanelles
  ["messinaSouth", "messinaNorth"], // the Strait of Messina
  ["firstNarrows", "secondNarrows"], // the Strait of Magellan
  ["puntaArenasOff", "froward"],
  ["froward", "magellanWestArm"],
  ["magellanWestArm", "pasoLargo"],
];

// Canals, which the map draws as land too, with the year each opened. A route from before that year never takes it:
// Vasco da Gama sails around Africa. A route without a year never takes one either, since most voyages in these videos
// are older than the canals; the director gives a modern year when the narration speaks of today or of the canal.
const CANALS: { lane: string[]; opened: number }[] = [
  { lane: ["portSaid", "suez"], opened: 1869 }, // the Suez Canal
  { lane: ["colon", "panamaGulf"], opened: 1914 }, // the Panama Canal
];

const EARTH_KM = 6371;
// A port tries its nearest few waypoints and joins the cheapest.
const NEAREST = 6;
const LINKS = 3;
// Two ports join directly when the line between them crosses no land, if they are this close and neither lies more
// than INLAND_KM from the water on that line.
const DIRECT_KM = 2500;
const INLAND_KM = 40;
// A km over land, between a port that lies inland on the map and the sea, counts as this many km at sea, and a port
// joins only waypoints it reaches with at most LAND_SLACK_KM more land than its nearest way to the sea.
const LAND_COST = 5;
const LAND_SLACK_KM = 50;
// How often a line is checked for land: a port's link to the sea, and a straight course past waypoints.
const SAMPLE_KM = 10;
const COURSE_SAMPLE_KM = 5;
// A straight course skips at most this many waypoints at a time.
const MAX_SKIP = 6;

type Link = { to: number; km: number; opened?: number }; // `opened` only for a canal

const names = Object.keys(WAYPOINTS);
const points = Object.values(WAYPOINTS);
const indexOf = new Map(names.map((name, index) => [name, index]));
const kmBetween = (a: LonLat, b: LonLat) => geoDistance(a, b) * EARTH_KM;

// Each waypoint's neighbors, with how far they are.
const neighbors: Link[][] = points.map(() => []);
const lanes = [...[...LANES, ...NARROWS].map((lane) => ({ lane, opened: undefined })), ...CANALS];
for (const { lane, opened } of lanes) {
  for (let step = 1; step < lane.length; step++) {
    const a = indexOf.get(lane[step - 1]);
    const b = indexOf.get(lane[step]);
    if (a === undefined || b === undefined) continue;
    const km = kmBetween(points[a], points[b]);
    neighbors[a].push({ to: b, km, opened });
    neighbors[b].push({ to: a, km, opened });
  }
}

// How far a link counts in the given year: a canal is a short way through once it has opened, and closed before that
// or when the year is not known.
function linkKm(link: Link, year: number | undefined): number {
  if (link.opened === undefined) return link.km;
  return year !== undefined && year >= link.opened ? link.km : Infinity;
}

// The land of the map as the edges of its country outlines, sorted into bands half a degree of latitude high, so a
// point is tested against the edges at its own latitude only. Built the first time a sea route needs it.
const BANDS_PER_DEGREE = 2;
let bands: Float64Array[] | null = null;
function landBands(): Float64Array[] {
  if (bands) return bands;
  const built: number[][] = Array.from({ length: 180 * BANDS_PER_DEGREE }, () => []);
  const bandOf = (lat: number) => Math.min(built.length - 1, Math.max(0, Math.floor((lat + 90) * BANDS_PER_DEGREE)));
  for (const country of countries) {
    const geometry = country.geometry;
    if (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon") continue;
    const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
    for (const ring of polygons.flat()) {
      // A ring that crosses the 180th meridian, like Fiji or the tip of Russia, is made one piece, and is added a
      // second time a world to the west or east, so it covers both edges of the map.
      let shift = 0;
      const whole = ring.map(([x, y], index) => {
        const before = index > 0 ? ring[index - 1][0] : x;
        if (x - before > 180) shift -= 360;
        if (before - x > 180) shift += 360;
        return [x + shift, y];
      });
      const offsets = whole.some(([x]) => x > 180) ? [0, -360] : whole.some(([x]) => x < -180) ? [0, 360] : [0];
      for (const offset of offsets) {
        for (let index = 1; index < whole.length; index++) {
          const [x1, y1] = whole[index - 1];
          const [x2, y2] = whole[index];
          for (let band = bandOf(Math.min(y1, y2)); band <= bandOf(Math.max(y1, y2)); band++) {
            built[band].push(x1 + offset, y1, x2 + offset, y2);
          }
        }
      }
    }
  }
  bands = built.map((edges) => Float64Array.from(edges));
  return bands;
}

// Whether a point is on land: a line from it due east crosses the outlines an odd number of times.
function onLand([lon, lat]: LonLat): boolean {
  const all = landBands();
  const band = all[Math.min(all.length - 1, Math.max(0, Math.floor((lat + 90) * BANDS_PER_DEGREE)))];
  let inside = false;
  for (let index = 0; index < band.length; index += 4) {
    const x1 = band[index];
    const y1 = band[index + 1];
    const x2 = band[index + 2];
    const y2 = band[index + 3];
    if (y1 > lat !== y2 > lat && lon < x1 + ((lat - y1) * (x2 - x1)) / (y2 - y1)) inside = !inside;
  }
  return inside;
}

// How a straight line (a great circle) meets land: the km of land where it leaves `from`, on the way, and where it
// reaches `to`.
function landAlong(from: LonLat, to: LonLat): { start: number; middle: number; end: number } {
  const along = geoInterpolate(from, to);
  const steps = Math.max(2, Math.ceil(kmBetween(from, to) / SAMPLE_KM));
  const stepKm = kmBetween(from, to) / steps;
  const land = Array.from({ length: steps + 1 }, (_, step) => onLand(along(step / steps) as LonLat));
  const first = land.indexOf(false);
  const last = land.lastIndexOf(false);
  if (first === -1) return { start: steps * stepKm, middle: 0, end: 0 };
  const middle = land.slice(first, last + 1).filter((isLand) => isLand).length * stepKm;
  return { start: first * stepKm, middle, end: (steps - last) * stepKm };
}

// The waypoints a port joins: the cheapest of its nearest few, where land on the way costs extra. A port up a river,
// in a lagoon or behind a cape lies inland on this map, so it joins the sea by its shortest way over land; a waypoint
// that needs much more land than that, like one across a peninsula, is left out.
const portLinks = new Map<string, Link[]>();
function linksOf(port: LonLat): Link[] {
  const known = portLinks.get(port.join());
  if (known) return known;
  const nearest = points
    .map((point, to) => ({ to, km: kmBetween(port, point) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, NEAREST)
    .map((link) => {
      const land = landAlong(port, points[link.to]);
      return { ...link, land: land.start + land.middle + land.end };
    });
  const leastLand = Math.min(...nearest.map((link) => link.land));
  const links = nearest
    .filter((link) => link.land <= leastLand + LAND_SLACK_KM)
    .map((link) => ({ to: link.to, km: link.km + (LAND_COST - 1) * link.land }))
    .sort((a, b) => a.km - b.km)
    .slice(0, LINKS);
  portLinks.set(port.join(), links);
  return links;
}

// Whether a straight line (a great circle) between two points at sea crosses no land. The line is checked coarse to
// fine, every 64th point first and then the points halfway between those already checked, so a line across a large
// piece of land fails at once.
function clearOfLand(from: LonLat, to: LonLat): boolean {
  const along = geoInterpolate(from, to);
  const steps = Math.ceil(kmBetween(from, to) / COURSE_SAMPLE_KM);
  for (let stride = 64; stride >= 1; stride /= 2) {
    for (let step = stride; step < steps; step += stride === 64 ? stride : 2 * stride) {
      if (onLand(along(step / steps) as LonLat)) return false;
    }
  }
  return true;
}

// Straightens a way through the lanes: from each waypoint it sails straight to the farthest of the next few that it
// can reach without crossing land, as a ship goes from cape to cape instead of into every bay. The ports and their
// links to the sea stay as they are.
function straighten(path: LonLat[]): LonLat[] {
  const last = path.length - 2;
  const course = path.slice(0, 2);
  for (let at = 1; at < last; ) {
    let next = Math.min(last, at + MAX_SKIP);
    while (next > at + 1 && !clearOfLand(path[at], path[next])) next--;
    course.push(path[next]);
    at = next;
  }
  if (path.length > 2) course.push(path[path.length - 1]);
  return course;
}

// The way by sea from one port to another, as [longitude, latitude] points from `from` to `to`: straight across when
// no land is in the way, else the shortest way through the sea lanes, straightened where the sea allows. `year` is
// when the voyage took place, if the scene says, so it only uses the canals open then.
const paths = new Map<string, LonLat[]>();
export function seaPath(from: [number, number], to: [number, number], year?: number): [number, number][] {
  const id = `${from.join()} ${to.join()} ${CANALS.map((canal) => (year === undefined ? "?" : year >= canal.opened ? "o" : "c")).join("")}`;
  const known = paths.get(id);
  if (known) return known;
  const start = points.length;
  const end = points.length + 1;
  const startLinks = [...linksOf(from)];
  const endLinks = new Map(linksOf(to).map((link) => [link.to, link.km]));
  const distance = kmBetween(from, to);
  if (distance <= DIRECT_KM) {
    const land = landAlong(from, to);
    if (land.middle === 0 && land.start <= INLAND_KM && land.end <= INLAND_KM) {
      startLinks.push({ to: end, km: distance + (LAND_COST - 1) * (land.start + land.end) });
    }
  }

  // Dijkstra's shortest path over the waypoints and the two ports.
  const best = Array<number>(points.length + 2).fill(Infinity);
  const previous = Array<number>(points.length + 2).fill(-1);
  const done = Array<boolean>(points.length + 2).fill(false);
  best[start] = 0;
  for (;;) {
    let node = -1;
    for (let index = 0; index < best.length; index++) {
      if (!done[index] && best[index] < Infinity && (node === -1 || best[index] < best[node])) node = index;
    }
    if (node === -1 || node === end) break;
    done[node] = true;
    const links = node === start ? startLinks : [...neighbors[node]];
    const toEnd = endLinks.get(node);
    if (toEnd !== undefined) links.push({ to: end, km: toEnd });
    for (const link of links) {
      const km = linkKm(link, year);
      if (best[node] + km < best[link.to]) {
        best[link.to] = best[node] + km;
        previous[link.to] = node;
      }
    }
  }

  const path: [number, number][] = [to];
  for (let node = previous[end]; node !== -1 && node !== start; node = previous[node]) path.unshift(points[node]);
  path.unshift(from);
  const course = straighten(path);
  paths.set(id, course);
  return course;
}
