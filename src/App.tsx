import {
  BarChart,
  Callout,
  Card,
  CardBody,
  CardHeader,
  Divider,
  Grid,
  H1,
  H2,
  H3,
  LineChart,
  Pill,
  Row,
  Select,
  Stack,
  Stat,
  Swatch,
  Table,
  type Color,
  Text,
  TextInput,
  Toggle,
  UsageBar,
  useCanvasState,
} from "./ui";

type Status = "mfj" | "single";
type Strategy = "lump" | "split" | "asNeeded";
type PowerMode = "grid" | "hybrid" | "offgrid" | "offgridAC";

const isLump = (p: { strategy: Strategy }) => p.strategy !== "asNeeded";

type Params = {
  adults: number;
  k401: number;
  status: Status;
  strategy: Strategy;
  rule55: boolean;
  ssMonthly: number;
  ssAge: number;
  otherIncome: number;
  otherUntil: number;
  ret: number;
  inflation: number;
  contingency: number;
  acaUnsub: number;
  collapseAge: number;
  hardening: boolean;
  hunting: boolean;
  deerPerYear: number;
  hogsPerYear: number;
  elkPerYear: number;
  meatValue: number;
  state: StateId;
  txMove: boolean;
  powerMode: PowerMode;
};

type StateId = "OK" | "MT" | "WY" | "ID" | "SD" | "ND" | "TN" | "AR" | "MO" | "WV" | "MS";

type StateInfo = {
  name: string;
  politics: string;
  region: string;
  landPerAcre: number;
  propaneGal: number;
  propTax: number;
  winterShelter: number;
  hogs: number;
  elk: number;
  growing: string;
  rain: string;
  winterLow: string;
  game: string;
  water: string;
  medicaid: boolean;
  taxNote: string;
  upside: string;
  downside: string;
  tax: (w: number, mfj: boolean, fedTaxable: number) => number;
};

const PROPANE_PRICE = 2.9;

const STATES: Record<StateId, StateInfo> = {
  OK: {
    name: "Oklahoma",
    politics: "Republican governor and legislature held in 2026",
    region: "SE/E Oklahoma: Pushmataha, Latimer, Le Flore, McCurtain",
    landPerAcre: 1500, propaneGal: 500, propTax: 500, winterShelter: 0, hogs: 4, elk: 0,
    growing: "200–220 days", rain: "40–55 in", winterLow: "0 to 15°F", game: "Deer, feral hogs, turkey",
    water: "Mixed: you own your groundwater, and stream water is free for domestic use",
    medicaid: true,
    taxNote: "4.5% top; $10K/person retirement exclusion",
    upside: "Cheapest land with real rainfall and timber, plus hogs",
    downside: "Tornadoes, ice storms, 100°F summers",
    tax: (w, mfj) => Math.max(0, w - (mfj ? 20000 : 10000) - (mfj ? 12700 : 6350)) * 0.045,
  },
  MT: {
    name: "Montana",
    politics: "No governor race in 2026 (Gianforte, R, through 2028); legislature stayed Republican",
    region: "Central MT foothills; western valleys run $6K+/acre",
    landPerAcre: 2500, propaneGal: 1400, propTax: 900, winterShelter: 30000, hogs: 0, elk: 1,
    growing: "90–120 days", rain: "12–20 in", winterLow: "−20 to −40°F", game: "Elk, mule and whitetail deer, antelope",
    water: "Prior appropriation: a creek on your land doesn't mean you own the right to use it. Domestic wells are exempt",
    medicaid: true,
    taxNote: "~4.7% / 5.65% brackets on federal taxable income",
    upside: "Lowest population density, best big-game hunting",
    downside: "Short growing season. An RV is not livable in winter",
    tax: (_w, mfj, t) => { const b = mfj ? 42200 : 21100; return 0.047 * Math.min(t, b) + 0.0565 * Math.max(0, t - b); },
  },
  WY: {
    name: "Wyoming",
    politics: "Eric Barlow (R) won governor with 69%; Republicans hold supermajorities",
    region: "Big Horn Basin, east-central foothills",
    landPerAcre: 1500, propaneGal: 1400, propTax: 400, winterShelter: 30000, hogs: 0, elk: 1,
    growing: "80–120 days", rain: "10–15 in", winterLow: "−20 to −30°F", game: "Elk, mule deer, antelope",
    water: "Prior appropriation: water rights are scarce and enforced. Wells need a State Engineer permit",
    medicaid: false,
    taxNote: "No state income tax",
    upside: "No income tax, very low property tax, few people",
    downside: "Wind, drought, a hard climate to grow food in. No Medicaid expansion",
    tax: () => 0,
  },
  ID: {
    name: "Idaho",
    politics: "Brad Little (R) re-elected with 57%; Republicans hold supermajorities",
    region: "North Idaho: Boundary, Bonner, Benewah counties",
    landPerAcre: 4000, propaneGal: 1000, propTax: 900, winterShelter: 25000, hogs: 0, elk: 1,
    growing: "100–140 days", rain: "25–35 in (north)", winterLow: "−5 to −20°F", game: "Elk, whitetail and mule deer, bear",
    water: "Prior appropriation. Domestic wells exempt up to 13,000 gal/day. Surface water needs a right",
    medicaid: true,
    taxNote: "5.3% flat on federal taxable income",
    upside: "Timber, water and game in the north; heart of the 'American Redoubt' (Idaho, Montana, Wyoming)",
    downside: "Northern land costs 2–3× Oklahoma. Fast-growing and getting crowded",
    tax: (_w, _m, t) => 0.053 * t,
  },
  SD: {
    name: "South Dakota",
    politics: "Republican governor held in 2026; legislature stayed Republican",
    region: "West River ranch country, outside the Black Hills",
    landPerAcre: 1500, propaneGal: 1300, propTax: 800, winterShelter: 30000, hogs: 0, elk: 0,
    growing: "110–140 days", rain: "15–20 in", winterLow: "−20 to −30°F", game: "Deer, antelope, pheasant",
    water: "Prior appropriation. Domestic wells exempt",
    medicaid: true,
    taxNote: "No state income tax",
    upside: "No income tax, cheap land, easy domicile rules for RVers",
    downside: "Blizzards, few trees for firewood",
    tax: () => 0,
  },
  ND: {
    name: "North Dakota",
    politics: "No governor race in 2026 (Armstrong, R); legislature stayed Republican",
    region: "Western ND, Missouri River breaks",
    landPerAcre: 1500, propaneGal: 1600, propTax: 800, winterShelter: 30000, hogs: 0, elk: 0,
    growing: "110–130 days", rain: "15–18 in", winterLow: "−25 to −40°F", game: "Deer, antelope, waterfowl",
    water: "Prior appropriation. Domestic wells exempt",
    medicaid: true,
    taxNote: "0% to ~$48K, then 1.95–2.5%",
    upside: "Near-zero income tax, very low crime, cheap land",
    downside: "The harshest winters on this list. Minot ICBM field",
    tax: (_w, mfj, t) => { const b1 = mfj ? 81000 : 48475; const b2 = mfj ? 298000 : 244825; return 0.0195 * Math.max(0, Math.min(t, b2) - b1) + 0.025 * Math.max(0, t - b2); },
  },
  TN: {
    name: "Tennessee",
    politics: "Republican governor held in 2026; Republicans hold supermajorities",
    region: "Cumberland Plateau, rural Middle Tennessee",
    landPerAcre: 4000, propaneGal: 400, propTax: 600, winterShelter: 0, hogs: 2, elk: 0,
    growing: "180–200 days", rain: "50–55 in", winterLow: "10 to 20°F", game: "Deer, turkey; feral hogs limited by TWRA rules",
    water: "Riparian: the landowner gets reasonable use of the water",
    medicaid: false,
    taxNote: "No state income tax",
    upside: "No income tax, abundant water, long growing season",
    downside: "Land costs about 2.5× Oklahoma. No Medicaid expansion",
    tax: () => 0,
  },
  AR: {
    name: "Arkansas",
    politics: "Sanders (R) re-elected governor; legislature stayed Republican",
    region: "Ozarks, Ouachita Mountains",
    landPerAcre: 2500, propaneGal: 450, propTax: 400, winterShelter: 0, hogs: 4, elk: 0,
    growing: "190–210 days", rain: "48–55 in", winterLow: "10 to 20°F", game: "Deer, feral hogs, turkey, some elk",
    water: "Riparian. Springs and creeks are common",
    medicaid: true,
    taxNote: "3.9% top; first $6K of retirement income exempt",
    upside: "Closest match to SE Oklahoma, with more water and springs",
    downside: "Humidity, ticks, rough mountain roads",
    tax: (w, mfj) => 0.039 * Math.max(0, w - 6000 - (mfj ? 4820 : 2410)),
  },
  MO: {
    name: "Missouri",
    politics: "No governor race in 2026 (Kehoe, R); legislature stayed Republican",
    region: "Ozarks, south-central MO",
    landPerAcre: 3500, propaneGal: 600, propTax: 900, winterShelter: 0, hogs: 1, elk: 0,
    growing: "180–200 days", rain: "42–48 in", winterLow: "0 to 10°F", game: "Deer, turkey; hogs (statewide eradication)",
    water: "Riparian. Lots of springs",
    medicaid: true,
    taxNote: "4.7% top on federal taxable income",
    upside: "Springs, hardwood timber, good soils in the river bottoms",
    downside: "Hog hunting banned on public land. Whiteman AFB is a likely nuclear target",
    tax: (_w, _m, t) => 0.047 * t,
  },
  WV: {
    name: "West Virginia",
    politics: "No governor race in 2026 (Morrisey, R); Republicans hold supermajorities",
    region: "Central and southern highlands",
    landPerAcre: 2500, propaneGal: 700, propTax: 400, winterShelter: 0, hogs: 0, elk: 0,
    growing: "150–170 days", rain: "42–48 in", winterLow: "0 to 10°F", game: "Deer, bear, turkey",
    water: "Riparian. Very water-rich",
    medicaid: true,
    taxNote: "~4.82% top",
    upside: "Cheap, water-rich, hidden hollows, low property tax",
    downside: "Steep land and little flat ground for gardens. Weak economy",
    tax: (w, mfj) => 0.0482 * Math.max(0, w - (mfj ? 4000 : 2000)),
  },
  MS: {
    name: "Mississippi",
    politics: "No governor race in 2026 (Reeves, R; next race 2027); legislature Republican",
    region: "Central and northern hill country",
    landPerAcre: 3000, propaneGal: 300, propTax: 600, winterShelter: 0, hogs: 4, elk: 0,
    growing: "220–240 days", rain: "55–60 in", winterLow: "20 to 25°F", game: "Deer, feral hogs, turkey",
    water: "Riparian. Abundant",
    medicaid: false,
    taxNote: "Qualified retirement distributions exempt (verify for early withdrawals)",
    upside: "May not tax your 401(k) at all. Longest growing season on the list",
    downside: "Heat and humidity, hurricanes in the south. No Medicaid expansion",
    tax: () => 0,
  },
};

const STATE_IDS = Object.keys(STATES) as StateId[];
const NO_INCOME_TAX = new Set<StateId>(["WY", "SD", "TN"]);

type HazardCat = "Weather" | "Fire + drought" | "Wildlife + insects" | "Geologic + tropical";
const HAZARDS: Array<{ id: string; label: string; cat: HazardCat }> = [
  { id: "tornado", label: "Tornado", cat: "Weather" },
  { id: "heat", label: "Extreme heat", cat: "Weather" },
  { id: "cold", label: "Extreme cold", cat: "Weather" },
  { id: "snow", label: "Snow / blizzard", cat: "Weather" },
  { id: "ice", label: "Ice storm", cat: "Weather" },
  { id: "flood", label: "Flood / heavy rain", cat: "Weather" },
  { id: "hail", label: "Hail / high wind", cat: "Weather" },
  { id: "fire", label: "Wildfire", cat: "Fire + drought" },
  { id: "drought", label: "Drought", cat: "Fire + drought" },
  { id: "snakes", label: "Venomous snakes", cat: "Wildlife + insects" },
  { id: "ticks", label: "Ticks + insects", cat: "Wildlife + insects" },
  { id: "predators", label: "Large predators", cat: "Wildlife + insects" },
  { id: "quake", label: "Earthquake", cat: "Geologic + tropical" },
  { id: "hurricane", label: "Hurricane remnants", cat: "Geologic + tropical" },
];
const HAZARD_LEVEL = ["Low", "Moderate", "High", "Severe"];

const HAZ: Record<StateId, { r: number[]; snakes: string; er: string; frost: string }> = {
  OK: { r: [3, 3, 1, 1, 3, 2, 3, 2, 2, 3, 3, 1, 1, 0], snakes: "Copperhead, cottonmouth, timber rattlesnake, western diamondback, prairie rattlesnake, western pygmy rattlesnake, western massasauga (7 species)", er: "30–60 min", frost: "12–18 in" },
  MT: { r: [0, 1, 3, 3, 1, 1, 2, 3, 2, 1, 1, 3, 1, 0], snakes: "Prairie rattlesnake only", er: "45–120 min", frost: "48–72 in" },
  WY: { r: [1, 1, 3, 3, 1, 1, 3, 2, 3, 1, 1, 3, 1, 0], snakes: "Prairie rattlesnake, midget faded rattlesnake", er: "45–120 min", frost: "48–60 in" },
  ID: { r: [0, 1, 2, 3, 1, 1, 1, 3, 2, 1, 1, 3, 2, 0], snakes: "Western (Great Basin) rattlesnake; rare in the far north", er: "30–60 min", frost: "24–36 in" },
  SD: { r: [2, 2, 3, 3, 2, 1, 3, 2, 2, 1, 1, 1, 0, 0], snakes: "Prairie rattlesnake only", er: "45–90 min", frost: "48–72 in" },
  ND: { r: [2, 1, 3, 3, 2, 2, 3, 1, 2, 1, 1, 1, 0, 0], snakes: "Prairie rattlesnake, southwest ND only", er: "45–120 min", frost: "60–84 in" },
  TN: { r: [3, 2, 1, 1, 2, 3, 2, 1, 1, 2, 3, 1, 2, 1], snakes: "Copperhead, timber rattlesnake, pygmy rattlesnake, cottonmouth (west TN)", er: "20–45 min", frost: "12–18 in" },
  AR: { r: [3, 3, 1, 1, 3, 3, 3, 1, 1, 3, 3, 1, 2, 1], snakes: "Copperhead, cottonmouth, timber rattlesnake, western pygmy rattlesnake, western diamondback (SW corner)", er: "30–60 min", frost: "12 in" },
  MO: { r: [3, 2, 2, 2, 3, 3, 3, 1, 1, 2, 3, 1, 3, 0], snakes: "Copperhead, cottonmouth, timber rattlesnake, pygmy rattlesnake, massasauga", er: "30–60 min", frost: "24–30 in" },
  WV: { r: [1, 1, 2, 2, 2, 3, 1, 1, 0, 2, 2, 1, 0, 1], snakes: "Copperhead, timber rattlesnake", er: "30–60 min (slow mountain roads)", frost: "24–36 in" },
  MS: { r: [3, 3, 0, 0, 1, 3, 2, 1, 1, 3, 3, 1, 1, 2], snakes: "Copperhead, cottonmouth, canebrake (timber) rattlesnake, pygmy rattlesnake; eastern diamondback and coral snake in the south", er: "30–45 min", frost: "6–12 in" },
};

const HAZARD_PREP: Array<[string, string, string, string]> = [
  ["Tornado", "An RV is destroyed even by a weak tornado; tie-downs don't help. Dixie Alley states (TN, AR, MS) get night tornadoes hidden by rain.", "In-ground or FEMA P-361 safe room within 30 seconds of the RV. NOAA weather radio with alerts. Get into the shelter at the warning, not when you see it.", "$4–8K shelter, $40 radio"],
  ["Extreme heat", "RV interiors reach 120–130°F in Oklahoma and Mississippi summers. Heat kills more older adults than tornadoes.", "Pole-barn roof over the RV, a mini-split on grid or solar, and the storm shelter doubles as a 60–65°F cool room. Do outdoor work at dawn. Drink 1–2 gal of water a day.", "$1.5–3K mini-split"],
  ["Extreme cold", "Frozen RV tanks and lines, furnaces burning 10+ gal propane a day, carbon monoxide from heaters, frozen well lines above the frost line.", "Insulated shelter or skirting, heated hoses and tank pads, a wood stove. Bury well lines below the frost depth. CO and smoke detectors in every space.", "$25–30K shelter in the north; $500 skirting in the south"],
  ["Snow / blizzard", "Roads closed for days or weeks. RV roofs fail under heavy snow.", "30–60 days of supplies. Tractor with a front blade. Rake snow off roofs. Satellite communicator for when cell service drops.", "$1–3K blade"],
  ["Ice storm", "Oklahoma's 2007 ice storm left people without power for 1–2 weeks. Falling limbs crush RVs and take down lines.", "Clear trees within a tree-length of the RV and power line. Chainsaw, generator, a stocked propane tank.", "$500–1.5K tree work"],
  ["Flood / heavy rain", "Creek bottoms and hollows flash-flood fast (AR Ouachitas, WV, TN). A low-water crossing on the driveway can cut you off.", "Check the FEMA flood map before you buy. Site the RV and shelter on high ground. Avoid driveways that cross creeks, or build a raised culvert crossing.", "$2–6K culvert crossing"],
  ["Hail / high wind", "Hail shreds RV roofs and solar panels. Plains wind at 60+ mph rocks and flips trailers.", "Pole barn over the RV, hail-rated solar panels, windbreak tree rows, anchored propane tanks.", "Pole barn in setup costs"],
  ["Wildfire", "Western forest fires (MT, ID) and spring grass fires on the plains (OK, SD) move faster than you can pack.", "Mow 100 ft of defensible space around the RV. Gravel pad, metal roofs, a water tank with a pump. A packed go-bag and two ways out.", "$500–2K pump + tank"],
  ["Drought", "Ponds dry up and shallow wells drop. Gardens fail.", "Drill the well deep. Store 1,000+ gal of water. Rain catchment. Grow drought-tolerant crops.", "Well + catchment in setup costs"],
  ["Venomous snakes", "Bites happen when you step or reach into brush, rock piles, woodpiles or dark sheds. Antivenom is only at hospitals.", "Snake boots or gaiters, a flashlight at night, short grass around living areas, woodpiles away from the door, rodent control. If bitten: keep calm, keep the limb still, remove rings, call for help and go to an ER. No cutting, sucking, tourniquets or ice.", "$150 boots/gaiters"],
  ["Ticks + insects", "Lone star ticks cause alpha-gal syndrome, an allergy to red meat, which is a serious problem for a venison-and-pork diet. Also Rocky Mountain spotted fever, ehrlichiosis, Lyme, fire ants, brown recluse spiders, scorpions in Oklahoma.", "Spray clothing with permethrin, do tick checks every evening, keep guinea fowl or chickens, and shake out boots and bedding.", "$100/yr"],
  ["Large predators", "Grizzlies in NW Montana, NW Wyoming and the north Idaho panhandle. Wolves, mountain lions, black bears. Coyotes and feral dogs kill chickens. Feral boars can charge.", "Carry bear spray. Electric fencing around chickens and garden. Store garbage and feed securely. Stay alert while dressing game.", "$50 spray, $300 fence"],
  ["Earthquake", "The New Madrid fault (MO bootheel, NE Arkansas, west Tennessee, north Mississippi) could knock out bridges and roads for months. Oklahoma has smaller quakes caused by oil and gas wastewater disposal.", "Flexible propane and water connections. Strap tanks and shelving. Keep enough supplies to wait out cut-off roads.", "$200"],
  ["Hurricane remnants", "Days of heavy rain, flooding and wind, mainly in Mississippi and Tennessee.", "Same as flood prep. Secure loose items and top off fuel before landfall.", "—"],
];
const stateOf = (p: Params): StateId => (p.state && STATES[p.state] ? p.state : "OK");

function applyState(
  id: StateId,
  p: Params,
  up: Record<string, number>,
  rec: Record<string, number>,
): [Params, Record<string, number>, Record<string, number>] {
  const s = STATES[id];
  return [
    { ...p, state: id, hogsPerYear: s.hogs, elkPerYear: s.elk },
    { ...up, land: s.landPerAcre * 50, winter: s.winterShelter },
    { ...rec, propane: Math.round(s.propaneGal * PROPANE_PRICE), proptax: s.propTax },
  ];
}

const DEFAULT_PARAMS: Params = {
  adults: 1,
  k401: 375000,
  status: "single",
  strategy: "lump",
  rule55: true,
  ssMonthly: 1400,
  ssAge: 62,
  otherIncome: 0,
  otherUntil: 62,
  ret: 4,
  inflation: 3,
  contingency: 10,
  acaUnsub: 11000,
  collapseAge: 60,
  hardening: true,
  hunting: true,
  deerPerYear: 3,
  hogsPerYear: 4,
  elkPerYear: 0,
  meatValue: 5,
  state: "OK",
  txMove: true,
  powerMode: "grid",
};

const POWER: Record<
  PowerMode,
  { label: string; power: number; offgrid: number; electric: number; solarNote: string; summary: string }
> = {
  grid: {
    label: "Grid only (co-op line)",
    power: 10000, offgrid: 15000, electric: 1500,
    solarNote: "Backup only, so it's counted as collapse hardening",
    summary: "Cheapest to build if a co-op line runs along the road. Every outage takes the well, freezer and Starlink down with it.",
  },
  hybrid: {
    label: "Grid + solar and battery (hybrid)",
    power: 10000, offgrid: 18000, electric: 500,
    solarNote: "About 8 kW of panels, 20–30 kWh of battery and a hybrid inverter. The grid covers A/C peaks and cloudy weeks",
    summary: "The best fit for this plan. The grid runs the A/C and charges the battery. When the grid drops, the battery keeps the well, freezer and Starlink going.",
  },
  offgrid: {
    label: "Off-grid solar, no A/C",
    power: 0, offgrid: 22000, electric: 400,
    solarNote: "About 6 kW of panels, 30 kWh of LiFePO4 and a 48 V inverter. Runs the well, fridge, freezer, Starlink and fans",
    summary: "No line extension and no bill, but summers in the RV are fans and shade only. A generator covers cloudy stretches in winter.",
  },
  offgridAC: {
    label: "Off-grid solar with A/C",
    power: 0, offgrid: 40000, electric: 600,
    solarNote: "About 12 kW of panels and 45–60 kWh of battery, running a 12K BTU mini-split instead of the RV roof A/C",
    summary: "Full comfort with no utility, but it costs about twice as much as the no-A/C system, and the battery needs replacing in 12–15 years.",
  },
};
const POWER_IDS = Object.keys(POWER) as PowerMode[];

const DEER_LB = 45;
const HOG_LB = 50;
const HOG_LARD_LB = 6;
const KCAL_VENISON_LB = 550;
const KCAL_HOG_LB = 800;
const KCAL_LARD_LB = 4000;
const KCAL_PER_PERSON_YEAR = 2200 * 365;

const PER_PERSON_RECURRING = new Set(["food", "aca", "medicare", "oop", "household"]);
const PER_PERSON_UPFRONT = new Set(["food", "medical"]);

const adultsOf = (p: Params) => Math.max(1, Math.round(p.adults));
const peopleLabel = (n: number) => (n === 1 ? "one adult" : `${n} adults`);
const recAmount = (rec: Record<string, number>, id: string, p: Params) =>
  (rec[id] ?? 0) * (PER_PERSON_RECURRING.has(id) ? adultsOf(p) : 1);
const upAmount = (up: Record<string, number>, id: string, p: Params) =>
  (up[id] ?? 0) * (PER_PERSON_UPFRONT.has(id) ? adultsOf(p) : 1);
const acaCliff = (p: Params) => 4 * (15650 + 5500 * (adultsOf(p) - 1));

type Group = "core" | "hardening" | "hunting";

function groupOf(u: UpfrontItem, p: Params): Group {
  if (u.hunting) return "hunting";
  if (u.id === "offgrid" && p.powerMode !== "grid") return "core";
  return u.hardening ? "hardening" : "core";
}

function upfrontTotalFor(p: Params, up: Record<string, number>): number {
  return UPFRONT.reduce((s, u) => {
    const g = groupOf(u, p);
    if (g === "hunting" && !p.hunting) return s;
    if (g === "hardening" && !p.hardening) return s;
    return s + upAmount(up, u.id, p);
  }, 0);
}

const ELK_LB = 180;

function huntYield(p: Params) {
  const deerLb = p.deerPerYear * DEER_LB;
  const hogLb = p.hogsPerYear * HOG_LB;
  const elkLb = (p.elkPerYear ?? 0) * ELK_LB;
  const lardLb = p.hogsPerYear * HOG_LARD_LB;
  const kcal =
    (deerLb + elkLb) * KCAL_VENISON_LB + hogLb * KCAL_HOG_LB + lardLb * KCAL_LARD_LB;
  const need = KCAL_PER_PERSON_YEAR * adultsOf(p);
  return { deerLb, hogLb, elkLb, lardLb, meatLb: deerLb + hogLb + elkLb, kcal, need, share: kcal / need };
}

type UpfrontItem = { id: string; label: string; note: string; hardening: boolean; hunting?: boolean };

const UPFRONT: UpfrontItem[] = [
  { id: "land", label: "Land, 50 acres", note: "Set by the state selector; edit to match a real listing", hardening: false },
  { id: "winter", label: "Year-round insulated shelter", note: "Required where winters reach −20°F; an RV alone won't survive it", hardening: false },
  { id: "rv", label: "Used RV", note: "Look for a 4-season unit; it lives outdoors through ice storms and 100°F summers", hardening: false },
  { id: "closing", label: "Closing, survey, title", note: "Rural tracts often need a new survey", hardening: false },
  { id: "well", label: "Drilled well + pump", note: "~150–300 ft; Oklahoma drillers run ~$30–50/ft installed", hardening: false },
  { id: "septic", label: "Septic + DEQ permit", note: "Aerobic systems are common on Oklahoma clay soils", hardening: false },
  { id: "power", label: "Grid line drop / extension + meter", note: "$2–10K if a co-op line runs along the road; co-ops charge roughly $15–40K per mile beyond that. $0 off-grid", hardening: false },
  { id: "rvhookup", label: "RV pedestal: 50 A outlet, frost-free hydrant, sewer cleanout", note: "Hooks the RV to power, the well and the septic so you aren't hauling water or dumping tanks", hardening: false },
  { id: "starlink", label: "Starlink kit + pole or roof mount", note: "Mount it clear of trees with an open view of the northern sky", hardening: false },
  { id: "generator", label: "Dual-fuel inverter generator, 4–5 kW", note: "Runs on propane from the main tank. Covers grid outages and cloudy weeks", hardening: false },
  { id: "pad", label: "Driveway + gravel RV pad", note: "Red clay turns to mud; gravel is not optional", hardening: false },
  { id: "barn", label: "Pole barn / RV cover", note: "Protects the RV from hail and ice; doubles as a workshop", hardening: false },
  { id: "shelter", label: "In-ground storm shelter", note: "An RV is the worst place to be in a tornado", hardening: false },
  { id: "safety", label: "Safety kit: satellite SOS, NOAA radio, CO/smoke alarms, extinguishers, snake gaiters, bear spray, tourniquet", note: "Living alone, an SOS device is how you call for help after a bite, fall or chainsaw cut", hardening: false },
  { id: "propane", label: "500-gal propane tank (owned) + fill", note: "Owning the tank lets you shop suppliers", hardening: false },
  { id: "tractor", label: "Used compact tractor, brush hog, chainsaw", note: "50 acres turns to brush in 2–3 seasons without one", hardening: false },
  { id: "fence", label: "Fence repair + gate", note: "", hardening: false },
  { id: "handpump", label: "Well hand pump (Simple Pump / Bison)", note: "Electric well pumps stop when the grid does", hardening: true },
  { id: "offgrid", label: "Solar + LiFePO4 battery bank", note: "Sized for well, fridge, fans, lights; not RV A/C", hardening: true },
  { id: "cabin", label: "Wood stove + insulated small cabin", note: "Fallback heat once stored propane runs out", hardening: true },
  { id: "food", label: "1-year food storage, per person", note: "~450 lb grains, beans, oil per person, plus canned goods", hardening: true },
  { id: "garden", label: "Garden, seeds, canning, chickens + coop", note: "", hardening: true },
  { id: "rain", label: "Rain catchment + gravity filters", note: "Backup water and garden irrigation", hardening: true },
  { id: "medical", label: "Medical kit + extra Rx + dental work, per person", note: "Have dental work done before you leave insurance", hardening: true },
  { id: "comms", label: "Ham/GMRS radios, lighting, security", note: "", hardening: true },
  { id: "fuel", label: "Second propane tank + fuel storage", note: "Propane stores indefinitely; gasoline doesn't", hardening: true },
  { id: "rifle", label: "Deer/hog rifle + scope (.308, 6.5 CM, .30-06)", note: "Set to $0 if you already own one", hardening: false, hunting: true },
  { id: "hogtrap", label: "Hog corral trap (panels + root/drop gate)", note: "Catches a whole sounder at once; box traps catch one or two", hardening: false, hunting: true },
  { id: "stand", label: "Feeder, ground blind, trail cameras", note: "", hardening: false, hunting: true },
  { id: "butcher", label: "Gambrel, hoist, knives, bone saw, grinder", note: "Do your own processing; a shop charges $100–175 per deer", hardening: false, hunting: true },
  { id: "freezer", label: "Chest freezer + vacuum sealer", note: "7 cu ft holds ~200 lb; keep it on the solar circuit", hardening: false, hunting: true },
  { id: "canner", label: "Pressure canner, jars, smoker, cure salts", note: "The way to store meat with no power", hardening: false, hunting: true },
];

const PRESET_PLANNED: Record<string, number> = {
  land: 75000, winter: 0, rv: 40000, closing: 3000, well: 15000, septic: 9000, power: 10000,
  rvhookup: 2500, starlink: 500, generator: 1200, pad: 5000,
  barn: 10000, shelter: 5000, safety: 1200, propane: 3500, tractor: 10000, fence: 5000,
  handpump: 3000, offgrid: 15000, cabin: 15000, food: 3000, garden: 4000, rain: 3000,
  medical: 1000, comms: 2500, fuel: 3000,
  rifle: 1000, hogtrap: 1500, stand: 600, butcher: 500, freezer: 700, canner: 700,
};

const PRESET_LEAN: Record<string, number> = {
  land: 75000, winter: 0, rv: 30000, closing: 2500, well: 12000, septic: 7000, power: 6000,
  rvhookup: 1500, starlink: 400, generator: 800, pad: 3000,
  barn: 0, shelter: 4000, safety: 800, propane: 3000, tractor: 5000, fence: 0,
  handpump: 2500, offgrid: 8000, cabin: 6000, food: 2000, garden: 2000, rain: 1500,
  medical: 750, comms: 1000, fuel: 2000,
  rifle: 0, hogtrap: 800, stand: 200, butcher: 300, freezer: 500, canner: 450,
};

type AgeRule = "all" | "pre65" | "post65";
type RecurringItem = { id: string; label: string; rule: AgeRule; collapse: string };

const RECURRING: RecurringItem[] = [
  { id: "food", label: "Groceries, per person (garden offsets some)", rule: "all", collapse: "Garden, chickens, deer, hogs, stored grain" },
  { id: "hunt", label: "Hunting: licenses, tags, ammo, feed corn", rule: "all", collapse: "Stockpiled ammo; traps need none" },
  { id: "water", label: "Water: well testing, filters", rule: "all", collapse: "Hand pump, rain catchment, pond + filter" },
  { id: "proptax", label: "Property tax", rule: "all", collapse: "Not collected" },
  { id: "propane", label: "Propane (~500 gal/yr; RV furnace in winter)", rule: "all", collapse: "Stored propane, then firewood" },
  { id: "electric", label: "Electricity (grid bill, or generator fuel off-grid)", rule: "all", collapse: "Solar for essentials only, no A/C" },
  { id: "gas", label: "Gasoline (~5,000 mi/yr + mower)", rule: "all", collapse: "Gone in 6–12 months; walk or stay put" },
  { id: "autoins", label: "Vehicle insurance + tags", rule: "all", collapse: "Not needed" },
  { id: "rvins", label: "RV insurance (full-timer policy)", rule: "all", collapse: "Not needed" },
  { id: "liability", label: "Land liability / barn coverage", rule: "all", collapse: "Not needed" },
  { id: "aca", label: "Health insurance, per person, age <65 (ACA, subsidized)", rule: "pre65", collapse: "None; self-care and stockpiled Rx" },
  { id: "medicare", label: "Medicare B + Medigap G + Part D, per person, 65+", rule: "post65", collapse: "None" },
  { id: "oop", label: "Dental, vision, Rx out-of-pocket, per person", rule: "all", collapse: "Stockpile only" },
  { id: "sos", label: "Satellite SOS subscription (Garmin inReach or similar)", rule: "all", collapse: "Works as long as the satellites do" },
  { id: "internet", label: "Starlink Residential (~$120/mo) + cell phone", rule: "all", collapse: "Radio" },
  { id: "maint", label: "RV, tractor, equipment repairs", rule: "all", collapse: "Your labor + spare parts on hand" },
  { id: "septic", label: "Septic service", rule: "all", collapse: "Outhouse / composting" },
  { id: "household", label: "Household, clothing, personal, per person", rule: "all", collapse: "Make do, barter" },
  { id: "garden", label: "Seed, feed, garden supplies", rule: "all", collapse: "Saved seed, forage" },
  { id: "trash", label: "Trash (rural transfer station)", rule: "all", collapse: "Burn / compost" },
  { id: "rvreserve", label: "RV replacement reserve", rule: "all", collapse: "Cabin becomes the house" },
];

const RECURRING_DEFAULTS: Record<string, number> = {
  food: 3600, hunt: 400, water: 300, proptax: 500, propane: 1500, electric: 1500, gas: 1000, autoins: 1400,
  rvins: 1000, liability: 500, aca: 3000, medicare: 4750, oop: 750, sos: 200, internet: 1900, maint: 2500,
  septic: 200, household: 1200, garden: 800, trash: 200, rvreserve: 2500,
};

const FED: Record<Status, { std: number; brackets: Array<[number, number]> }> = {
  mfj: {
    std: 32200,
    brackets: [[24800, 0.1], [100800, 0.12], [211400, 0.22], [403550, 0.24], [512450, 0.32], [768700, 0.35], [1e12, 0.37]],
  },
  single: {
    std: 16100,
    brackets: [[12400, 0.1], [50400, 0.12], [105700, 0.22], [201775, 0.24], [256225, 0.32], [640600, 0.35], [1e12, 0.37]],
  },
};

const START_AGE = 58;
const END_AGE = 95;

function fedTax(income: number, status: Status, age: number): number {
  const extraStd = age >= 65 ? (status === "mfj" ? 3300 : 2050) : 0;
  const taxable = Math.max(0, income - FED[status].std - extraStd);
  let tax = 0;
  let prev = 0;
  for (const [top, rate] of FED[status].brackets) {
    if (taxable <= prev) break;
    tax += (Math.min(taxable, top) - prev) * rate;
    prev = top;
  }
  return tax;
}

function stateTax(w: number, p: Params): number {
  return STATES[stateOf(p)].tax(w, p.status === "mfj", Math.max(0, w - FED[p.status].std));
}

function taxOnWithdrawal(w: number, p: Params, age: number, inTexas = false) {
  const fed = fedTax(w, p.status, age);
  const ok = inTexas ? 0 : stateTax(w, p);
  const penalty = !p.rule55 && age < 59.5 ? 0.1 * w : 0;
  return { fed, ok, penalty, total: fed + ok + penalty };
}

function lumpSumTax(p: Params) {
  const parts = p.strategy === "split" ? 2 : 1;
  const one = taxOnWithdrawal(p.k401 / parts, p, START_AGE, p.txMove);
  return { fed: one.fed * parts, ok: one.ok * parts, penalty: one.penalty * parts, total: one.total * parts };
}

function grossUp(need: number, p: Params, age: number, inTexas = false): number {
  let w = need;
  for (let i = 0; i < 40; i++) w = need + taxOnWithdrawal(w, p, age, inTexas).total;
  return w;
}

function annualCost(
  rec: Record<string, number>,
  age: number,
  p: Params,
  unsubsidizedHealth: boolean,
): number {
  let sum = 0;
  for (const item of RECURRING) {
    if (item.rule === "pre65" && age >= 65) continue;
    if (item.rule === "post65" && age < 65) continue;
    if (item.id === "hunt" && !p.hunting) continue;
    sum +=
      item.id === "aca" && unsubsidizedHealth ? p.acaUnsub * adultsOf(p) : recAmount(rec, item.id, p);
  }
  return (sum - meatOffset(rec, p)) * (1 + p.contingency / 100);
}

function meatOffset(rec: Record<string, number>, p: Params): number {
  if (!p.hunting) return 0;
  return Math.min(huntYield(p).meatLb * p.meatValue, recAmount(rec, "food", p) * 0.5);
}

type SimResult = {
  balances: number[];
  depletedAge: number | null;
  year0Gross: number;
  year0Tax: number;
  year0Cost: number;
  stranded: number | null;
};

function simulate(
  p: Params,
  rec: Record<string, number>,
  upfront: number,
  inflationPct: number,
  collapseAge: number | null,
): SimResult {
  const r = p.ret / 100;
  const inf = inflationPct / 100;
  const cliff = acaCliff(p);
  let balance = p.k401;
  let year0Gross = 0;
  let year0Tax = 0;
  let year0Cost = 0;
  let depletedAge: number | null = null;
  let stranded: number | null = null;
  const balances: number[] = [];

  if (isLump(p)) {
    year0Gross = p.k401;
    year0Tax = lumpSumTax(p).total;
    balance = p.k401 - year0Tax;
  }

  for (let age = START_AGE; age <= END_AGE; age++) {
    const t = age - START_AGE;
    if (collapseAge !== null && age >= collapseAge) {
      if (stranded === null) stranded = Math.max(0, balance);
      balances.push(Math.max(0, balance));
      continue;
    }
    const f = Math.pow(1 + inf, t);
    const income =
      (age >= p.ssAge ? p.ssMonthly * 12 * f : 0) + (age < p.otherUntil ? p.otherIncome : 0);
    const extra = t === 0 ? upfront : 0;

    if (isLump(p)) {
      const unsub = t === 0 || (t === 1 && p.strategy === "split") || balance * r > cliff;
      const cost = annualCost(rec, age, p, unsub) * f;
      if (t === 0) year0Cost = cost;
      const after = balance - (cost - income + extra);
      balance = after > 0 ? after * (1 + r) : after;
    } else {
      let need = annualCost(rec, age, p, false) * f - income + extra;
      const inTexas = t === 0 && p.txMove;
      let w = need > 0 ? grossUp(need, p, age, inTexas) : 0;
      if (w > cliff) {
        need = annualCost(rec, age, p, true) * f - income + extra;
        w = grossUp(need, p, age, inTexas);
      }
      if (t === 0) {
        year0Gross = w;
        year0Tax = w - need;
        year0Cost = need + income - extra;
      }
      const after = balance - w;
      balance = after > 0 ? after * (1 + r) : after;
    }
    if (balance <= 0 && depletedAge === null) depletedAge = age;
    balances.push(balance);
  }
  return { balances, depletedAge, year0Gross, year0Tax, year0Cost, stranded };
}

const money = (n: number) =>
  (n < 0 ? "-$" : "$") + Math.round(Math.abs(n)).toLocaleString("en-US");
const kMoney = (n: number) => (n < 0 ? "-$" : "$") + Math.round(Math.abs(n) / 1000) + "K";

function NumField({
  value,
  onChange,
  width = 96,
}: {
  value: number;
  onChange: (n: number) => void;
  width?: number;
}) {
  return (
    <TextInput
      type="number"
      value={String(value)}
      onChange={(v) => onChange(v === "" ? 0 : Number(v))}
      style={{ width }}
    />
  );
}

function Field({ label, children }: { label: string; children: Parameters<typeof Row>[0]["children"] }) {
  return (
    <Row gap={8} align="center" justify="space-between">
      <Text size="small" tone="secondary">
        {label}
      </Text>
      {children}
    </Row>
  );
}

export default function OklahomaRetreatPlan() {
  const [storedP, setP] = useCanvasState<Params>("params-v2", DEFAULT_PARAMS);
  const [storedUp, setUp] = useCanvasState<Record<string, number>>("upfront-v2", PRESET_PLANNED);
  const [storedRec, setRec] = useCanvasState<Record<string, number>>("recurring-v2", RECURRING_DEFAULTS);
  const p: Params = { ...DEFAULT_PARAMS, ...storedP };
  const up: Record<string, number> = { ...PRESET_PLANNED, ...storedUp };
  const rec: Record<string, number> = { ...RECURRING_DEFAULTS, ...storedRec };

  const set = <K extends keyof Params>(k: K, v: Params[K]) => setP((prev) => ({ ...prev, [k]: v }));
  const st = STATES[stateOf(p)];
  const pickState = (id: StateId) => {
    const [np, nu, nr] = applyState(id, p, up, rec);
    setP(np);
    setUp(nu);
    setRec(nr);
  };
  const applyPreset = (preset: Record<string, number>) =>
    setUp({
      ...preset,
      land: up.land ?? preset.land,
      winter: up.winter ?? 0,
      ...(p.powerMode === "grid" ? {} : { power: up.power ?? 0, offgrid: up.offgrid ?? 0 }),
    });
  const pickPower = (mode: PowerMode) => {
    const m = POWER[mode];
    set("powerMode", mode);
    setUp((prev) => ({ ...prev, power: m.power, offgrid: m.offgrid }));
    setRec((prev) => ({ ...prev, electric: m.electric }));
  };

  const stateRows = STATE_IDS.map((id) => {
    const [sp, su, sr] = applyState(id, p, up, rec);
    const total = upfrontTotalFor(sp, su);
    const sim = simulate(sp, sr, total, sp.inflation, null);
    return {
      id,
      s: STATES[id],
      land: su.land ?? 0,
      total,
      lumpStateTax: Math.round(lumpSumTax({ ...sp, txMove: false }).ok),
      propane: sr.propane ?? 0,
      cost: annualCost(sr, 60, sp, false),
      lasts: sim.depletedAge,
    };
  });

  const groupTotal = (g: Group) =>
    UPFRONT.filter((u) => groupOf(u, p) === g).reduce((s, u) => s + upAmount(up, u.id, p), 0);
  const adults = adultsOf(p);
  const who = peopleLabel(adults);
  const coreTotal = groupTotal("core");
  const hardTotal = groupTotal("hardening");
  const huntTotal = groupTotal("hunting");
  const upfrontTotal = coreTotal + (p.hardening ? hardTotal : 0) + (p.hunting ? huntTotal : 0);
  const hunt = huntYield(p);
  const offset = meatOffset(rec, p);
  const landRv = (up.land ?? 0) + (up.rv ?? 0);

  const normal = simulate(p, rec, upfrontTotal, p.inflation, null);
  const highInf = simulate(p, rec, upfrontTotal, 7, null);
  const collapse = simulate(p, rec, upfrontTotal, p.inflation, p.collapseAge);

  const lumpTax = lumpSumTax(p);
  const lumpTaxAfterMove = lumpSumTax({ ...p, txMove: false });
  const lumpTaxOneYear = lumpSumTax({ ...p, strategy: "lump", txMove: true });
  const lumpTaxSplit = lumpSumTax({ ...p, strategy: "split", txMove: true });
  const withheld = 0.2 * p.k401;
  const netAfterTax = normal.year0Gross > 0 && isLump(p) ? p.k401 - normal.year0Tax : p.k401;
  const leftAfterSetup = isLump(p) ? netAfterTax - upfrontTotal : p.k401 - normal.year0Gross;
  const pm = POWER[p.powerMode] ?? POWER.grid;

  const steadyPre65 = annualCost(rec, 60, p, false);
  const steadyPost65 = annualCost(rec, 66, p, false);
  const ssAnnual = p.ssMonthly * 12;

  const ages: string[] = [];
  for (let a = START_AGE; a <= END_AGE; a++) ages.push(String(a));

  const lastsLabel = (r: SimResult) => (r.depletedAge === null ? `${END_AGE}+` : String(r.depletedAge));
  const shortfall = normal.depletedAge !== null && normal.depletedAge < 85;

  const allocTaxes = normal.year0Tax;
  const allocOther = coreTotal - landRv;
  const allocHard = p.hardening ? hardTotal : 0;
  const allocHunt = p.hunting ? huntTotal : 0;
  const allocRemaining = Math.max(0, p.k401 - allocTaxes - landRv - allocOther - allocHard - allocHunt);

  const costRows = RECURRING.map((item) => [
    item.label,
    <NumField
      key={item.id}
      value={rec[item.id] ?? 0}
      onChange={(n) => setRec((prev) => ({ ...prev, [item.id]: n }))}
      width={88}
    />,
    item.rule === "pre65" ? "Until 65" : item.rule === "post65" ? "65+" : "Every year",
    PER_PERSON_RECURRING.has(item.id) && adults > 1 ? money(recAmount(rec, item.id, p)) : "",
  ]);

  const chartItems = RECURRING.filter((i) => i.rule !== "post65" && (i.id !== "hunt" || p.hunting))
    .map((i) => ({ label: i.label.split(" (")[0], value: recAmount(rec, i.id, p) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const upfrontTable = (group: Group) => (
    <Table
      headers={["Item", "Cost", "Why"]}
      columnAlign={["left", "right", "left"]}
      rows={UPFRONT.filter((u) => groupOf(u, p) === group).map((u) => [
        u.label,
        <NumField
          key={u.id}
          value={up[u.id] ?? 0}
          onChange={(n) => setUp((prev) => ({ ...prev, [u.id]: n }))}
          width={88}
        />,
        <Text size="small" tone="tertiary">
          {u.id === "offgrid" ? pm.solarNote : u.note}
        </Text>,
      ])}
    />
  );

  return (
    <Stack gap={24} style={{ padding: 24, maxWidth: 1400, margin: "0 auto" }}>
      <Stack gap={6}>
        <H1>{st.name} 50-acre retreat: retirement cash plan</H1>
        <Text tone="secondary">
          Household of {who}, retiring at 58, living in an RV on 50 acres with a water source in {st.region}. Costs
          marked "per person" scale with the household size in Assumptions. Every number with a box is editable, and
          the charts recompute as you type. Taxes use 2026 federal brackets plus {st.name} state tax (
          {st.taxNote})
          {p.txMove ? ", except that the first year's withdrawal is taken while you're still a Texas resident" : ""}.
          These are planning estimates, not tax advice.
        </Text>
      </Stack>

      <Callout tone={shortfall ? "danger" : "success"} title={`Normal economy: money lasts to age ${lastsLabel(normal)}`}>
        {p.strategy === "lump"
          ? `Taking the full ${money(p.k401)} in one year costs about ${money(normal.year0Tax)} in tax, which is more than the RV. `
          : p.strategy === "split"
          ? `Splitting the ${money(p.k401)} across two tax years (December and January) costs about ${money(normal.year0Tax)} in tax. `
          : `Withdrawing as needed, year one still costs about ${money(normal.year0Tax)} in tax because the setup spending lands in that year. `}
        {`After ${money(upfrontTotal)} of land and setup, the household spends about ${money(steadyPre65)}/yr before 65`}
        {ssAnnual > 0
          ? `, with Social Security covering ${money(ssAnnual)}/yr starting at ${p.ssAge}.`
          : ", with no Social Security counted."}
        {shortfall
          ? " Under these assumptions the plan runs short. The levers that move it most are below the chart."
          : ""}
      </Callout>

      <Grid columns={4} gap={16}>
        <Stat value={kMoney(netAfterTax)} label={isLump(p) ? "Cash after lump-sum tax" : "Kept in 401(k)/IRA"} />
        <Stat value={kMoney(upfrontTotal)} label="One-time setup (land, RV, build-out)" />
        <Stat value={kMoney(leftAfterSetup)} label={isLump(p) ? "Left after setup, before living costs" : "Left in account after year 1"} tone={leftAfterSetup < 100000 ? "warning" : undefined} />
        <Stat value={`${money(steadyPre65)}/yr`} label="Living cost before 65, today's dollars" />
      </Grid>

      <Grid columns="minmax(0, 320px) minmax(0, 1fr)" gap={20} align="start">
        <Card>
          <CardHeader>Assumptions</CardHeader>
          <CardBody>
            <Stack gap={10}>
              <Field label="State">
                <Select
                  value={stateOf(p)}
                  onChange={(v) => pickState(v as StateId)}
                  options={STATE_IDS.map((id) => ({ value: id, label: STATES[id].name }))}
                />
              </Field>
              <Field label="Adults in household">
                <NumField
                  value={adults}
                  onChange={(n) =>
                    setP((prev) => ({
                      ...prev,
                      adults: Math.max(1, Math.round(n)),
                      status: Math.max(1, Math.round(n)) >= 2 ? "mfj" : "single",
                    }))
                  }
                  width={64}
                />
              </Field>
              <Field label="401(k) balance">
                <NumField value={p.k401} onChange={(n) => set("k401", n)} />
              </Field>
              <Field label="Filing status">
                <Select
                  value={p.status}
                  onChange={(v) => set("status", v as Status)}
                  options={[
                    { value: "mfj", label: "Married, joint" },
                    { value: "single", label: "Single" },
                  ]}
                />
              </Field>
              <Field label="Withdrawal">
                <Select
                  value={p.strategy}
                  onChange={(v) => set("strategy", v as Strategy)}
                  options={[
                    { value: "lump", label: "All at once" },
                    { value: "split", label: "Split over 2 tax years" },
                    { value: "asNeeded", label: "As needed each year" },
                  ]}
                />
              </Field>
              <Field label="First withdrawal while a Texas resident">
                <Toggle checked={p.txMove} onChange={(v) => set("txMove", v)} />
              </Field>
              <Field label="Rule of 55 (no 10% penalty)">
                <Toggle checked={p.rule55} onChange={(v) => set("rule55", v)} />
              </Field>
              <Divider />
              <Field label={adults > 1 ? "Social Security, $/mo combined" : "Social Security, $/mo"}>
                <NumField value={p.ssMonthly} onChange={(n) => set("ssMonthly", n)} />
              </Field>
              <Field label="Claim Social Security at age">
                <NumField value={p.ssAge} onChange={(n) => set("ssAge", n)} width={64} />
              </Field>
              <Field label="Part-time income, $/yr">
                <NumField value={p.otherIncome} onChange={(n) => set("otherIncome", n)} />
              </Field>
              <Field label="Part-time work until age">
                <NumField value={p.otherUntil} onChange={(n) => set("otherUntil", n)} width={64} />
              </Field>
              <Divider />
              <Field label="Return on savings, %">
                <NumField value={p.ret} onChange={(n) => set("ret", n)} width={64} />
              </Field>
              <Field label="Inflation, %">
                <NumField value={p.inflation} onChange={(n) => set("inflation", n)} width={64} />
              </Field>
              <Field label="Contingency on costs, %">
                <NumField value={p.contingency} onChange={(n) => set("contingency", n)} width={64} />
              </Field>
              <Field label="Unsubsidized ACA, $/yr per person">
                <NumField value={p.acaUnsub} onChange={(n) => set("acaUnsub", n)} />
              </Field>
              <Field label="Collapse happens at age">
                <NumField value={p.collapseAge} onChange={(n) => set("collapseAge", n)} width={64} />
              </Field>
              <Field label="Power setup">
                <Select
                  value={p.powerMode}
                  onChange={(v) => pickPower(v as PowerMode)}
                  options={POWER_IDS.map((id) => ({ value: id, label: POWER[id].label }))}
                />
              </Field>
              <Field label="Include collapse-hardening build">
                <Toggle checked={p.hardening} onChange={(v) => set("hardening", v)} />
              </Field>
              <Divider />
              <Field label="Hunt for meat">
                <Toggle checked={p.hunting} onChange={(v) => set("hunting", v)} />
              </Field>
              <Field label="Elk taken per year">
                <NumField value={p.elkPerYear} onChange={(n) => set("elkPerYear", n)} width={64} />
              </Field>
              <Field label="Deer taken per year">
                <NumField value={p.deerPerYear} onChange={(n) => set("deerPerYear", n)} width={64} />
              </Field>
              <Field label="Hogs taken per year">
                <NumField value={p.hogsPerYear} onChange={(n) => set("hogsPerYear", n)} width={64} />
              </Field>
              <Field label="Store meat value, $/lb">
                <NumField value={p.meatValue} onChange={(n) => set("meatValue", n)} width={64} />
              </Field>
              <Divider />
              <Row gap={8}>
                <Pill onClick={() => applyPreset(PRESET_PLANNED)}>Planned build</Pill>
                <Pill onClick={() => applyPreset(PRESET_LEAN)}>Lean build</Pill>
                <Pill
                  onClick={() => {
                    setP(DEFAULT_PARAMS);
                    setRec(RECURRING_DEFAULTS);
                    setUp(PRESET_PLANNED);
                  }}
                >
                  Reset
                </Pill>
              </Row>
            </Stack>
          </CardBody>
        </Card>

        <Stack gap={12}>
          <H3>Money remaining by age, three scenarios</H3>
          <LineChart
            categories={ages}
            series={[
              { name: `Normal economy (${p.inflation}% inflation)`, data: normal.balances.map(Math.round), tone: "info" },
              { name: "High inflation (7%)", data: highInf.balances.map(Math.round), tone: "warning" },
              { name: `Collapse at ${p.collapseAge} (cash frozen, useless)`, data: collapse.balances.map(Math.round), tone: "neutral" },
            ]}
            valuePrefix="$"
            height={300}
          />
          <Text size="small" tone="tertiary">
            X-axis: age. Y-axis: {isLump(p) ? "cash on hand after tax" : "pre-tax 401(k)/IRA balance"}, in
            nominal dollars. Below $0 is the running shortfall: money you'd have to find somewhere else. Model:
            spending inflates yearly, Social Security gets matching COLAs, savings earn the return rate. Tax on
            interest is ignored.
          </Text>
          <Grid columns={3} gap={12}>
            <Stat value={lastsLabel(normal)} label="Normal: money lasts to age" tone={shortfall ? "danger" : "success"} />
            <Stat value={lastsLabel(highInf)} label="High inflation: lasts to age" tone={highInf.depletedAge !== null && highInf.depletedAge < 85 ? "danger" : "success"} />
            <Stat value={kMoney(collapse.stranded ?? 0)} label={`Collapse: cash stranded at ${p.collapseAge}`} tone="warning" />
          </Grid>
          <Callout tone="info" title="What moves the outcome most">
            Try these one at a time and watch the age change. First, set Withdrawal to "As needed": you pay less tax and
            keep subsidized health insurance in later years. Second, add $15–20K/yr of part-time income until 62.
            Third, click "Lean build". Fourth, enter your real Social Security figure from ssa.gov. The $1,400/mo
            default is a placeholder estimate for one person claiming at 62. Use roughly $2,000 combined for a couple
            where one spouse claims a spousal benefit.
          </Callout>
        </Stack>
      </Grid>

      <Stack gap={12}>
        <H2>Red states compared, after the 2026 midterms</H2>
        <Text tone="secondary">
          Democrats had a strong night on November 3. They flipped governorships in Texas, Georgia, Iowa, Ohio, Nevada
          and Alaska, and Kansas was still leaning Democratic as of November 4. The states below are ones where
          Republicans still hold the governor's office and both legislative chambers. Each row reruns your current
          plan (household, 401(k), withdrawal method, build level) using that state's land price, state income tax,
          winter heating, property tax and game. Click a state name to load it into the planner.
        </Text>
        <Table
          headers={["State", "50 ac land", "State tax on lump sum", "Propane/yr", "Living cost/yr", "Money lasts to", "Winter low", "Growing season", "Rain", "Medicaid expansion"]}
          columnAlign={["left", "right", "right", "right", "right", "right", "left", "left", "left", "left"]}
          rowTone={stateRows.map((r) => (r.id === stateOf(p) ? "info" : undefined))}
          rows={stateRows.map((r) => [
            <Pill key={r.id} size="sm" active={r.id === stateOf(p)} onClick={() => pickState(r.id)}>
              {r.s.name}
            </Pill>,
            kMoney(r.land),
            !isLump(p)
              ? "Spread over years"
              : p.txMove
              ? r.lumpStateTax > 0 ? `$0 in TX (saves ${kMoney(r.lumpStateTax)})` : "$0"
              : money(r.lumpStateTax),
            money(r.propane),
            money(r.cost),
            r.lasts === null ? `${END_AGE}+` : String(r.lasts),
            r.s.winterLow,
            r.s.growing,
            r.s.rain,
            r.s.medicaid ? "Yes" : "No",
          ])}
          striped
        />
        <Grid columns={2} gap={20} align="start">
          <Stack gap={8}>
            <H3>Age the money runs out, by state</H3>
            <BarChart
              horizontal
              categories={stateRows.map((r) => r.s.name)}
              series={[{ name: "Money lasts to age", data: stateRows.map((r) => r.lasts ?? END_AGE) }]}
              yMin={55}
              beginAtZero={false}
              height={320}
            />
            <Text size="small" tone="tertiary">
              X-axis: age when savings hit zero in a normal economy ({END_AGE} means it never runs out). Uses your
              current Assumptions. Land prices are rough 2025–26 asking prices for 50 rural acres with water. Check
              real listings.
            </Text>
          </Stack>
          <Stack gap={8}>
            <H3>{st.name} at a glance</H3>
            <Text size="small"><Text size="small" weight="semibold">2026 result.</Text> {st.politics}.</Text>
            <Text size="small"><Text size="small" weight="semibold">Where to look.</Text> {st.region}.</Text>
            <Text size="small"><Text size="small" weight="semibold">Game.</Text> {st.game}.</Text>
            <Text size="small"><Text size="small" weight="semibold">Water law.</Text> {st.water}.</Text>
            <Text size="small"><Text size="small" weight="semibold">Best part.</Text> {st.upside}.</Text>
            <Text size="small"><Text size="small" weight="semibold">Hardest part.</Text> {st.downside}.</Text>
            {st.winterShelter > 0 && (
              <Callout tone="warning" title="An RV alone won't get you through this winter">
                Winters here reach {st.winterLow}. RV plumbing freezes, and a furnace can burn 10+ gallons of propane a
                day. The plan adds {money(st.winterShelter)} for an insulated shelter and budgets{" "}
                {st.propaneGal.toLocaleString("en-US")} gal/yr of propane.
              </Callout>
            )}
          </Stack>
        </Grid>
        <Callout tone="neutral" title="Left off this list">
          Texas, Iowa, Georgia, Ohio and Alaska now have Democratic governors. Utah is still fully Republican, but
          land there is expensive and the climate is dry. Florida, Alabama, South Carolina, Louisiana, Indiana and
          Nebraska are also still fully Republican, but they're costlier, denser, hurricane-prone, or poor fits for
          this plan. Kentucky has a Democratic governor until its 2027 election.
        </Callout>
      </Stack>

      <Stack gap={10}>
        <H2>Where the 401(k) goes</H2>
        <UsageBar
          total={p.k401}
          topLeftLabel={<Text size="small" tone="secondary">{money(p.k401)} gross 401(k)</Text>}
          topRightLabel={<Text size="small" tone="secondary">{money(allocRemaining)} left to live on</Text>}
          segments={[
            { id: "tax", value: allocTaxes, color: "red" },
            { id: "landrv", value: landRv, color: "blue" },
            { id: "core", value: allocOther, color: "cyan" },
            { id: "hard", value: allocHard, color: "purple" },
            { id: "hunt", value: allocHunt, color: "orange" },
            { id: "left", value: allocRemaining, color: "green" },
          ]}
        />
        <Row gap={16} wrap>
          {(
            [
              ["red", `Taxes${p.rule55 ? "" : " + 10% penalty"}: ${money(allocTaxes)}`],
              ["blue", `Land + RV: ${money(landRv)}`],
              ["cyan", `Making it livable: ${money(allocOther)}`],
              ["purple", `Collapse hardening: ${money(allocHard)}`],
              ["orange", `Hunting + processing gear: ${money(allocHunt)}`],
              ["green", `Left to live on: ${money(allocRemaining)}`],
            ] as Array<[Color, string]>
          ).map(([c, l]) => (
            <Row key={l} gap={6} align="center">
              <Swatch color={c} />
              <Text size="small">{l}</Text>
            </Row>
          ))}
        </Row>
        {isLump(p) && (
          <Text size="small" tone="tertiary">
            Lump-sum tax detail: federal {money(lumpTax.fed)}, {p.txMove ? "Texas" : st.name} {money(lumpTax.ok)}
            {lumpTax.penalty > 0 ? `, early-withdrawal penalty ${money(lumpTax.penalty)}` : ""}. The Rule of 55 only
            waives the penalty if you leave the job in or after the year you turn 55 and withdraw from that employer's
            plan. Rolling to an IRA first brings the penalty back until 59½.
          </Text>
        )}
      </Stack>

      <Stack gap={12}>
        <H2>Moving from Texas: taxes and residency</H2>
        <Text tone="secondary">
          Texas has no state income tax, and federal law (4 U.S.C. § 114) bars other states from taxing retirement
          income paid to someone who isn't their resident. Any 401(k) money paid out while you still live in Texas is
          never taxed by {st.name} or any other state. Federal tax is the same wherever you live. The "First withdrawal
          while a Texas resident" switch in Assumptions applies this to the year-one withdrawal.
        </Text>
        <Grid columns={4} gap={16}>
          <Stat
            value={kMoney(lumpTaxAfterMove.ok)}
            label={`${st.name} tax on the full ${kMoney(p.k401)} if taken after moving`}
            tone={lumpTaxAfterMove.ok > 0 ? "warning" : undefined}
          />
          <Stat value="$0" label="State tax if taken while a Texas resident" tone="success" />
          <Stat
            value={kMoney(lumpTaxOneYear.fed - lumpTaxSplit.fed)}
            label="Federal tax saved by splitting it across December and January"
            tone="success"
          />
          <Stat
            value={kMoney(Math.max(0, lumpTaxOneYear.fed - withheld))}
            label={`Federal tax still owed after the plan's 20% (${kMoney(withheld)}) withholding, taken in one year`}
          />
        </Grid>
        <Table
          headers={["When", "What to do", "Why"]}
          rows={[
            ["Before you give notice", "Ask HR whether the plan allows Rule-of-55 and partial withdrawals, and get the distribution forms. Book one session with a CPA ($200–500).", "Some plans only allow one lump sum. Partial withdrawals keep the rest growing, penalty-free, in the same plan."],
            ["Your last weeks in Texas", "Leave the job in or after the year you turn 55. Request the setup withdrawal with your Texas address on file and no state withholding. To split it, take half in December and half in January.", "Splitting puts each half in a lower federal bracket. Both halves are Texas income as long as you haven't moved yet."],
            ["Until the money is paid out", "Keep your Texas driver's license, voter registration, vehicle registration and mailing address. Buying the land is fine. Moving in is not.", `${st.name} decides residency by where your permanent home is. Acting like a resident early could make the withdrawal its income.`],
            ["Federal tax on the withdrawal", "The plan withholds 20% automatically. Pay the rest with IRS Direct Pay (Form 1040-ES) or with your return. Your 1099-R arrives in January.", "You avoid the underpayment penalty if withholding covers 100% of last year's tax, or 110% if last year's income was over $150K."],
            ["Within 30 days of moving", stateOf(p) === "OK" ? "Get an Oklahoma driver's license at Service Oklahoma. Title and register the truck and RV, register to vote, and file IRS Form 8822 to change your address. Update Social Security and the 401(k) plan too." : `Get a ${st.name} driver's license. Title and register the truck and RV, register to vote, and file IRS Form 8822 to change your address. Update Social Security and the 401(k) plan too.`, "These records are how you prove your residency changed, and when."],
            ["First April after the move", NO_INCOME_TAX.has(stateOf(p)) ? `File your federal 1040 as usual. ${st.name} has no income tax return to file. Texas has none either.` : stateOf(p) === "OK" ? "File your federal 1040 as usual. File Oklahoma Form 511-NR as a part-year resident, which taxes only income received after you moved. Texas has no return to file." : `File your federal 1040 as usual. File ${st.name}'s part-year resident return, which taxes only income received after you moved (${st.taxNote}). Texas has no return to file.`, "Moving mid-year means one part-year state return, not two."],
            ["Every year after", NO_INCOME_TAX.has(stateOf(p)) ? "Federal return only." : stateOf(p) === "OK" ? "File Form 511 as a full-year resident, due April 15. For later 401(k) withdrawals, have the plan withhold Oklahoma tax (Form OK-W-4-R), or pay quarterly with Form OW-8-ES if you'll owe $1,000 or more. Oklahoma excludes $10K a person of retirement income and doesn't tax Social Security." : `File ${st.name}'s resident return. Have the plan withhold ${st.name} tax on later withdrawals, or pay quarterly estimates.`, "Later withdrawals are taxed by the state you live in when you take them."],
            ["Property tax", stateOf(p) === "OK" ? "Apply for the homestead exemption with the county assessor by March 15. It needs a permanent dwelling, so an RV may not qualify until a cabin or manufactured home is assessed. The county treasurer bills you in the fall, with the full amount due December 31 (or half then and half by March 31)." : "Apply for the homestead exemption with the county assessor once you live there. It usually needs a permanent dwelling, not an RV.", "Paid to the county no matter which state's income tax applies."],
            ["Health and hunting", "Moving to a new state lets you change ACA plans right away (60-day window), but only if you had coverage before you moved. Resident hunting licenses have a minimum residency period, so check the wildlife department's rule.", "A nonresident deer license costs several hundred dollars, so time the move around deer season."],
          ]}
        />
        <Callout tone="info" title="Will Texas add an income tax? (as of November 5, 2026)">
          The governor-elect is Gina Hinojosa, a Democrat. During the campaign she said "I will never support a state
          income tax." Either way, a governor can't create one. Article 8, Section 24-a of the Texas Constitution bans it.
          Repealing that ban takes two-thirds of the House (100 of 150) and of the Senate (21 of 31), then a statewide
          vote, and then a separate tax law. Republicans kept the state Senate. The new Legislature meets January 12,
          2027 for 140 days, and any amendment would usually go to voters in November 2027. The earliest realistic tax
          year is 2028. Withdrawals taken in 2026 or 2027 are safe, and once you've moved, Texas could never tax your
          retirement income anyway.
        </Callout>
      </Stack>

      <Stack gap={12}>
        <H2>One-time setup costs</H2>
        <Grid columns={2} gap={20} align="start">
          <Stack gap={8}>
            <Row gap={8} align="center">
              <H3>Core: make the land livable</H3>
              <Text size="small" tone="secondary">{money(coreTotal)}</Text>
            </Row>
            {upfrontTable("core")}
          </Stack>
          <Stack gap={8}>
            <Row gap={8} align="center">
              <H3>Collapse hardening</H3>
              <Text size="small" tone="secondary">
                {money(hardTotal)}
                {p.hardening ? "" : " (excluded)"}
              </Text>
            </Row>
            {upfrontTable("hardening")}
            <Text size="small" tone="tertiary">
              This is the core tradeoff. In a normal economy, every dollar spent here shortens your runway. In a
              collapse, every dollar NOT spent here is wasted, because cash stops being useful.
            </Text>
          </Stack>
        </Grid>
      </Stack>

      <Stack gap={12}>
        <H2>Recurring costs (normal economy, today's dollars)</H2>
        <Grid columns="minmax(0, 1.2fr) minmax(0, 1fr)" gap={20} align="start">
          <Table
            headers={adults > 1 ? ["Cost", "$/yr", "Applies", `Household (${adults})`] : ["Cost", "$/yr", "Applies"]}
            columnAlign={["left", "right", "left", "right"]}
            rows={costRows}
            striped
          />
          <Stack gap={10}>
            <H3>Largest yearly costs before 65</H3>
            <BarChart
              horizontal
              categories={chartItems.map((c) => c.label)}
              series={[{ name: "Annual cost", data: chartItems.map((c) => c.value) }]}
              valuePrefix="$"
              height={300}
            />
            <Text size="small" tone="tertiary">Values in $/yr, today's dollars, before the {p.contingency}% contingency.</Text>
            <Grid columns={2} gap={12}>
              <Stat value={money(steadyPre65)} label="Total/yr before 65, incl. contingency" />
              <Stat value={money(steadyPost65)} label="Total/yr at 65+ (Medicare)" />
            </Grid>
            <Callout tone="warning" title="Health insurance is the swing cost">
              ACA subsidies are based on income. In any year you withdraw more than about {money(acaCliff(p))} (400%
              of the poverty line for {peopleLabel(adultsOf(p))}), you lose the subsidy and pay full price, modeled here
              as {money(p.acaUnsub)}/yr per person at 58. In
              low-income years you may qualify for SoonerCare, Oklahoma's Medicaid, which has no asset test. Starting in
              2027 it adds work or volunteer requirements for adults under 65. Check the current rules before you
              rely on either.
            </Callout>
          </Stack>
        </Grid>
      </Stack>

      <Stack gap={12}>
        <H2>Power and Starlink: {pm.label}</H2>
        <Text tone="secondary">
          {pm.summary} Change the setup with "Power setup" in Assumptions or with the buttons below. That rewrites the
          grid line, solar/battery and electricity costs in the plan, and you can still edit each number afterward.
        </Text>
        <Table
          headers={["Option", "Grid line", "Solar + battery", "Power cost/yr", "Runs A/C?", "When the grid fails"]}
          columnAlign={["left", "right", "right", "right", "left", "left"]}
          rowTone={POWER_IDS.map((id) => (id === p.powerMode ? "info" : undefined))}
          rows={POWER_IDS.map((id) => [
            <Pill key={id} size="sm" active={id === p.powerMode} onClick={() => pickPower(id)}>
              {POWER[id].label}
            </Pill>,
            money(POWER[id].power),
            money(POWER[id].offgrid) + (id === "grid" ? " (hardening)" : ""),
            money(POWER[id].electric),
            id === "offgrid" ? "No, fans and shade only" : id === "grid" ? "Yes, while the grid is up" : "Yes",
            id === "grid" ? "Generator, plus solar if the hardening build is on" : id === "hybrid" ? "Battery runs essentials; generator on cloudy days" : "No change. You're already independent",
          ])}
        />
        <Grid columns={2} gap={20} align="start">
          <Stack gap={8}>
            <H3>Daily electric load (sizing the system)</H3>
            <Table
              headers={["Load", "Draw", "kWh/day"]}
              columnAlign={["left", "left", "right"]}
              rows={[
                ["Well pump (1 hp submersible)", "~1,000 W, about 1 hr/day", "1.0"],
                ["Refrigerator (RV 12 V or residential)", "Cycles all day", "1.0–1.5"],
                ["Chest freezer, 7 cu ft", "Cycles all day", "0.5–1.0"],
                ["Starlink dish + router", "50–75 W average, around the clock", "1.2–1.8"],
                ["Lights, fans, laptop, phones, radio", "", "1.0"],
                ["RV water pump, furnace fan, converter", "", "0.8"],
                ["Total without A/C", "", "≈ 6–7"],
                ["12K BTU mini-split, summer", "~600–1,000 W running", "8–12"],
                ["RV roof A/C, 13.5K BTU, summer", "~1,500 W running, big start surge", "15–25"],
              ]}
              rowTone={[undefined, undefined, undefined, "info", undefined, undefined, "success", "warning", "danger"]}
            />
            <Text size="small" tone="tertiary">
              In an Oklahoma December, 1 kW of panels makes about 3 kWh a day, and about 6 kWh in summer. A 6 kW array
              covers the essentials year-round. A/C roughly doubles the system, so off-grid A/C uses a mini-split in the
              cabin or barn room, not the RV roof unit.
            </Text>
          </Stack>
          <Stack gap={10}>
            <Callout tone="info" title="Starlink">
              Residential service runs about $120/mo, and the kit costs $350–500. Prices and plans change, so check
              starlink.com for the land's address before you buy. The dish needs a clear view of the northern sky. In
              SE Oklahoma timber that usually means a 10–20 ft pole or the barn roof, not the RV roof. It draws about
              1.5 kWh/day, more when the snow-melt heater runs. Put it on the battery-backed circuit so internet and
              Wi-Fi calling stay up during an outage. It also gives you cell service through Wi-Fi calling where towers
              are weak.
            </Callout>
            <Callout tone="neutral" title="Powering the RV itself">
              Plug the RV's shore cord into the 50 A pedestal. The pedestal is fed by the grid, the hybrid inverter or
              the generator. A 30 A RV needs a 50-to-30 A adapter. Add a hardwired surge protector with low-voltage
              shutoff (about $300), because rural co-op lines sag and spike in storms. To start a roof A/C on
              battery or a small generator, add a soft-start kit (about $300). It cuts the start surge by about 70%.
            </Callout>
            <Callout tone="warning" title="Getting grid power to the land">
              Before you make an offer, call the electric co-op that serves the parcel (in SE Oklahoma, for example,
              Kiamichi Electric or Choctaw Electric) and get a written line-extension quote. A pole near the road can
              cost $2–10K to connect. A quarter mile of new line can cost more than the land. If the quote is over
              about $20K, off-grid solar is usually cheaper and has no monthly bill.
            </Callout>
          </Stack>
        </Grid>
      </Stack>

      <Stack gap={12}>
        <H2>Water for the RV: refilling, drinking and showers</H2>
        <Text tone="secondary">
          An RV fresh-water tank holds 40–100 gallons. With short showers, {who} uses about{" "}
          {adults === 1 ? "10–20" : `${10 * adults}–${20 * adults}`} gallons a day, so a full tank lasts about 3–7 days
          when you're not hooked up. The goal is to plumb the RV to the well so you never haul water.
        </Text>
        <Table
          headers={["Method", "How", "Cost", "When to use it"]}
          rowTone={["success", "info", "neutral", "warning"]}
          rows={[
            ["Hook up to the well (best)", "Run a frost-free yard hydrant at the pad, then a drinking-water hose (NSF-61, white or blue), a pressure regulator set to 40–55 psi, and an inline sediment and carbon filter into the RV's city-water inlet. Water flows on demand, like a house.", "$300–800 plus the hydrant (in the RV pedestal line)", "Every day once the well is in. Below about 20°F, use a heated hose or fill the tank and disconnect."],
            ["Fill the fresh tank from the hydrant", "Fill through the tank's fill port and run the RV's 12 V pump.", "$0", "Hard freezes, or to keep running if the well pump loses power."],
            ["Haul water", "Fill a 275-gal food-grade IBC tote or a 35–100 gal truck-bed tank at a rural water district station, then pump it into the RV with a 12 V transfer pump.", "$400–800 for tank and pump; water is cents a gallon", "Before the well is drilled, or if the well fails."],
            ["Rain, pond or creek (collapse)", "Run it through a gravity filter (Berkey or Sawyer), then boil it or add bleach. Never put untreated pond water in the RV tank.", "Rain catchment and filters are in the hardening build", "Grid-down backup only."],
          ]}
        />
        <Grid columns={2} gap={16}>
          <Callout tone="info" title="Sanitize the system">
            Do this when you buy the RV and every 6–12 months after. Add ¼ cup of plain unscented bleach per 15 gallons
            of tank, mixed into a gallon of water. Fill the tank, then run every faucet and the shower until you smell
            chlorine. Let it sit at least 4 hours (overnight is better), then drain and flush with fresh water until
            the smell is gone. Bypass and drain the water heater first.
          </Callout>
          <Callout tone="neutral" title="Drinking water and waste">
            Test the well for coliform bacteria and nitrates when it's drilled and every year after (about $25–75 at a
            state-certified lab). Use a countertop or under-sink filter for drinking water, and keep at least 14 gallons
            per person stored in case the pump fails. Gray and black tanks drain to the septic cleanout through a sewer
            hose. Keep the black valve closed until the tank is two-thirds full so solids flush out.
          </Callout>
        </Grid>
      </Stack>

      <Stack gap={12}>
        <H2>Failed-state scenario: grid down, no bills</H2>
        <Text tone="secondary">
          If the state fails at age {p.collapseAge}, the bills stop: taxes, insurance, premiums, internet, and fuel
          purchases all go to zero. So does Social Security. Whatever cash is left at that moment (
          {money(collapse.stranded ?? 0)} in this plan) has no purchasing power. That changes the question from "how
          long does the money last" to "how long can the land and stored goods keep {who} alive." The money only
          matters for what it bought before the collapse.
        </Text>
        <Table
          headers={["Bill today", "$/yr now", "After collapse", "What replaces it"]}
          columnAlign={["left", "right", "right", "left"]}
          rows={RECURRING.filter((i) => i.rule !== "post65").map((i) => [
            i.label.split(" (")[0],
            money(recAmount(rec, i.id, p)),
            "$0",
            i.collapse,
          ])}
        />
        <H3>Physical requirements for {who}, per year</H3>
        <Table
          headers={["Need", "Amount", "How the land covers it", "Weak point"]}
          rowTone={["warning", "success", "info", "danger", "warning", "danger"]}
          rows={[
            ["Calories", `~${(hunt.need / 1e6).toFixed(1)}M kcal (2,200/day per person)`, `1-yr stored food covers year 1. After that: about ¼ acre of garden and 4–6 hens per person${p.hunting ? `, and ${p.deerPerYear} deer + ${p.hogsPerYear} hogs (~${Math.round(hunt.share * 100)}% of calories)` : ""}`, "Year 2+. A first-year garden in Oklahoma clay seldom covers half your calories. Start it in a normal year."],
            ["Drinking + hygiene water", `~${(1825 * adults).toLocaleString("en-US")} gal (5 gal/person/day)`, "Hand pump on the well covers this easily", "Electric pump without hand-pump backup"],
            ["Garden water", "~100–140K gal per summer for ¼ acre", "Pond, creek, rain catchment (1,000 sq ft roof yields ~25K gal/yr in eastern OK)", "Drought years like 2011 and 2022 dry up ponds"],
            ["Heat", "~500 gal propane, or 2–4 cords of wood in a small insulated cabin", "Stored propane lasts 1–2 winters. Post-oak timberland yields roughly ½–1 cord per acre per year", "RVs heat poorly. Ice storms are the real killer"],
            ["Medicine", "Every prescription you take, plus dental", "Stockpile what your doctor will allow, get dental work done early, learn first aid", "The largest risk at 58+. You can't grow it"],
            ["Cooling", "July–August highs over 100°F", "Shade, fans on solar, a cabin with an earth-sheltered side", "RV A/C can't run on a modest solar bank"],
          ]}
        />
      </Stack>

      <Stack gap={12}>
        <H2>Hunting: whitetail deer and feral hogs</H2>
        {stateOf(p) !== "OK" && (
          <Callout tone="info" title={`Game in ${st.name}`}>
            {st.game}.{" "}
            {st.hogs === 0
              ? "There are few or no feral hogs here, so the plan sets hogs to 0 and loses the lard. Venison and elk are very lean; plan on stored oil or raising pigs for fat."
              : ""}
            {st.elk > 0
              ? ` One elk yields about ${ELK_LB} lb of boneless meat, about four deer's worth. Residents can usually buy a general elk tag over the counter.`
              : ""}{" "}
            The deer and hog processing steps below apply to elk too.
          </Callout>
        )}
        <Text tone="secondary">
          Eastern and southeastern Oklahoma have strong deer numbers and some of the densest feral hog populations in
          the country. Hogs are the better long-term food source. They have no season and no bag limit, they breed two
          litters a year, and they carry fat, which lean venison lacks. Deer are the better-tasting meat, but they are
          limited by season and tags in a normal economy. In a collapse, local deer would be hunted out within a few
          seasons. By 1917, unregulated hunting had left only a few hundred deer in all of Oklahoma.
        </Text>
        <Grid columns={5} gap={12}>
          <Stat value={`${hunt.meatLb} lb`} label="Boneless meat per year" />
          <Stat value={`${hunt.lardLb} lb`} label="Rendered lard per year" />
          <Stat value={`${Math.round(hunt.share * 100)}%`} label={`Of yearly calories for ${who}`} tone={hunt.share < 0.25 ? "warning" : "success"} />
          <Stat value={money(p.hunting ? offset : 0)} label="Grocery savings per year (normal economy)" />
          <Stat value={money(huntTotal)} label="Gear cost, one-time" />
        </Grid>
        <Text size="small" tone="tertiary">
          Yields assume about {DEER_LB} lb boneless meat per Oklahoma whitetail and, for a 150 lb hog, about {HOG_LB} lb
          of meat plus {HOG_LARD_LB} lb of lard. Venison is ~{KCAL_VENISON_LB} kcal/lb, hog meat ~{KCAL_HOG_LB}, lard
          ~{KCAL_LARD_LB}. Savings are counted at your store-meat price, capped at half the grocery budget, and are
          already subtracted in the runway chart. Meat covers your protein needs, not your calories. Meat this lean
          can't be most of your diet anyway, so the garden and stored grain still have to supply most of the
          calories. Each hunter has their own deer limit, so more adults can legally take more deer.
        </Text>

        <Grid columns={2} gap={20} align="start">
          <Stack gap={8}>
            <H3>Gear (editable)</H3>
            {upfrontTable("hunting")}
          </Stack>
          <Stack gap={8}>
            <H3>Oklahoma rules to check before you hunt</H3>
            <Text size="small">
              <Text size="small" weight="semibold">Deer.</Text> Archery runs roughly Oct 1 to Jan 15, muzzleloader in late
              October, and rifle for about two weeks around Thanksgiving. The yearly limit has been about 6 deer with no
              more than 2 bucks. Every deer must be checked in through ODWC's E-check within 24 hours. Resident
              landowners get some license exemptions on their own land, but tagging and E-check still apply.
            </Text>
            <Text size="small">
              <Text size="small" weight="semibold">Feral hogs.</Text> No closed season and no bag limit on private land.
              Shooting hogs at night with lights or thermal requires a free feral swine control permit from ODWC. During
              deer gun season, hog hunters follow deer-season orange and legal-method rules. Moving live feral hogs off
              your property is heavily restricted, so get the rules from the Oklahoma Department of Agriculture (ODAFF)
              before you think about penning them.
            </Text>
            <Text size="small">
              <Text size="small" weight="semibold">After 64.</Text> Oklahoma residents can buy an inexpensive senior
              lifetime hunting and fishing license. It's worth buying in a normal economy.
            </Text>
            <Text size="small" tone="tertiary">
              Regulations change yearly. Confirm dates and limits in the current ODWC regulations guide at
              wildlifedepartment.com.
            </Text>
          </Stack>
        </Grid>

        <H3>From the kill to the table</H3>
        <Grid columns={2} gap={16} align="start">
          <Card>
            <CardHeader trailing={<Pill size="sm">Lean, mild</Pill>}>Whitetail deer</CardHeader>
            <CardBody>
              <Stack gap={8}>
                {[
                  ["Tag first.", "Tag the deer where it lies, then E-check it within 24 hours."],
                  ["Field dress within an hour.", "Wear gloves. Make a shallow cut from the pelvis to the breastbone, keeping the blade edge up so you don't puncture the stomach or bladder. Cut the diaphragm, reach up and sever the windpipe, then roll the organs out. Core around the anus and pull it through. Keep the heart and liver if the liver has no spots."],
                  ["Cool it fast. This matters most in Oklahoma.", "November afternoons often reach the 60s and 70s °F. The meat needs to get below 40°F within a few hours. If the air is warmer than about 40°F, skin and quarter the same day and put the quarters in coolers on ice. Keep the meat in bags or drain the meltwater daily, and it holds 3–5 days."],
                  ["Skin and quarter.", "Hang it by the hind legs on a gambrel. Skin while it's warm, which is much easier. The front shoulders come off with no joint, just cut behind the blade. Then take the hindquarters, both backstraps along the spine, the two tenderloins inside the cavity, the neck, and the rib and flank meat for grinding."],
                  ["Age it if you can.", "3–7 days at 34–40°F makes it noticeably more tender. This is optional."],
                  ["Trim hard.", "Remove all deer fat, silverskin and bloodshot meat. Deer fat is what makes venison taste gamey."],
                  ["Cut it up.", "Backstraps and hindquarter muscles become steaks and roasts, and everything else becomes grind. Mix 10–20% hog fat into ground venison. It makes burgers and sausage that hold together and taste far better."],
                  ["Chronic wasting disease (CWD).", "CWD has been found in Oklahoma. Bone the meat out rather than sawing through the spine. Don't eat the brain, spinal cord, eyes, spleen or lymph nodes. Test any deer from a zone where CWD has been detected, and don't eat a deer that acted sick."],
                ].map(([h, b], i) => (
                  <Text key={h} size="small">
                    <Text size="small" weight="semibold">{`${i + 1}. ${h}`}</Text> {b}
                  </Text>
                ))}
              </Stack>
            </CardBody>
          </Card>
          <Card>
            <CardHeader trailing={<Pill size="sm">Handle with gloves</Pill>}>Feral hog</CardHeader>
            <CardBody>
              <Stack gap={8}>
                {[
                  ["Pick the right animal.", "Sows and young hogs of 50–150 lb eat best. Big boars over about 150 lb often have a strong odor called boar taint. Grind those into heavily seasoned sausage, or don't keep them."],
                  ["Protect yourself first.", "Feral hogs carry swine brucellosis, which spreads through blood and body fluids. Wear doubled nitrile gloves and eye protection, cover any cuts, and don't eat, drink or smoke while you work."],
                  ["Use the gutless method.", "Lay the hog on its side and skin the top half. Take the hindquarter, the shoulder and the backstrap. Flip it and repeat. Then make a small cut behind the last rib to reach the tenderloins. You never open the gut cavity, which keeps you away from the reproductive organs, where brucellosis concentrates."],
                  ["Inspect the meat.", "Cut away any abscesses, yellow lumps or cysts. If they're widespread, discard the whole animal. Skip the organs."],
                  ["Cool it even faster than deer.", "Trapped hogs in summer should be killed at first light and quartered on ice within the hour. Hog meat spoils faster than venison."],
                  ["Save the fat.", "Skin off the hide, which carries hair, ticks and dirt. Keep the fat to render into lard and to blend into ground venison."],
                  ["Cook to 160°F, always.", "This kills trichinella and toxoplasma. Freezing and curing don't reliably kill wild-strain parasites. Never feed raw hog scraps to dogs, because pseudorabies kills dogs."],
                  ["Clean up.", "Bury or burn the remains away from your water source. Wash knives and surfaces in a bleach solution."],
                ].map(([h, b], i) => (
                  <Text key={h} size="small">
                    <Text size="small" weight="semibold">{`${i + 1}. ${h}`}</Text> {b}
                  </Text>
                ))}
              </Stack>
            </CardBody>
          </Card>
        </Grid>

        <H3>Keeping the meat, with and without power</H3>
        <Table
          headers={["Method", "Needs power?", "Keeps", "Best for", "How"]}
          rowTone={["info", "success", "neutral", "neutral", "success", "success"]}
          rows={[
            ["Freeze, vacuum-sealed", "Yes, about 1 kWh/day", "About 12 months", "Everything", "A 7 cu ft chest freezer holds about 200 lb. Run it on the solar circuit. If the power fails long enough to thaw the meat, can it right away."],
            ["Pressure canning", "No; propane or wood stove", "1–3 years", "Stew meat, ground meat, chili, hog and venison", "Pack raw cubes in jars. Process pints 75 minutes and quarts 90 minutes. Use 10 lb on a weighted gauge (11 lb on a dial gauge) below 1,000 ft elevation, and 15 lb weighted above that. Never water-bath meat."],
            ["Jerky", "Dehydrator, or smoke and sun", "1–2 months at room temperature", "Venison only", "Heat the strips to 160°F before or after drying, per USDA. Skip hog jerky because of the parasite risk."],
            ["Smoke + salt cure", "No", "Weeks to months, kept cool", "Hog hams, bacon, venison summer sausage", "Use Prague Powder #1 for sausage and short cures, and #2 for long dry cures. Do it only in cold weather, below about 40–50°F. Still cook hog to 160°F."],
            ["Render lard", "No", "About 6 months cool, longer frozen", "Hog fat", "Cube the fat, cook it on low for 4–6 hours, then strain and jar it. Six pounds of lard holds about 24,000 kcal. It's the most valuable thing a hog gives you."],
            ["Pemmican", "No", "1+ year", "Dried lean venison + hog lard", "Pound dried venison to a powder and mix it 1:1 by weight with warm rendered lard. It keeps a long time, and it fixes the problem of lean venison having no fat."],
          ]}
        />
        <Callout tone="info" title="Practical limits">
          A corral trap can catch 6–12 hogs in one night, which is 300+ lb of meat. That's more than one canner and one
          freezer can handle quickly. A 7-quart canner load holds about 10 lb of meat and takes about 2.5 hours,
          including heat-up and cool-down. Releasing feral hogs is illegal in Oklahoma, so only spring the trap when you
          have the time, ice and jars ready. Hogs you can't process still have to be killed and disposed of. Learn all of this in a normal year while a processor and a grocery store still exist
          as a backup.
        </Callout>
      </Stack>

      <Stack gap={12}>
        <H2>Survival hazards: weather, wildlife and terrain</H2>
        <Text tone="secondary">
          Every state on the list can kill you in a different way. The southern states have tornadoes, heat, snakes
          and ticks. The northern states have cold, snow, wildfire and grizzlies. Ratings are a rough planning guide
          for rural areas in the region the plan assumes for each state, not an official index.
        </Text>
        <Table
          headers={["Hazard", ...STATE_IDS.map((id) => id)]}
          columnAlign={["left", ...STATE_IDS.map(() => "center" as const)]}
          rows={HAZARDS.map((h, i) => [
            h.label,
            ...STATE_IDS.map((id) => {
              const v = HAZ[id].r[i];
              return (
                <Text
                  key={id}
                  size="small"
                  weight={v >= 3 ? "semibold" : "normal"}
                  tone={v === 0 ? "quaternary" : v === 1 ? "tertiary" : v === 2 ? "secondary" : "primary"}
                >
                  {HAZARD_LEVEL[v]}
                </Text>
              );
            }),
          ])}
          striped
        />
        <Grid columns={2} gap={20} align="start">
          <Stack gap={8}>
            <H3>Hazard load by state</H3>
            <BarChart
              horizontal
              stacked
              categories={STATE_IDS.map((id) => STATES[id].name)}
              series={(["Weather", "Fire + drought", "Wildlife + insects", "Geologic + tropical"] as HazardCat[]).map((cat) => ({
                name: cat,
                data: STATE_IDS.map((id) =>
                  HAZARDS.reduce((s, h, i) => s + (h.cat === cat ? HAZ[id].r[i] : 0), 0),
                ),
              }))}
              height={340}
            />
            <Text size="small" tone="tertiary">
              X-axis: sum of the ratings in the table above (Low 0, Moderate 1, High 2, Severe 3), grouped by hazard
              type. A higher number means more dangers to prepare for, not a higher chance of death.
            </Text>
          </Stack>
          <Stack gap={8}>
            <H3>{st.name}: what to prepare for first</H3>
            <Text size="small">
              <Text size="small" weight="semibold">Worst hazards.</Text>{" "}
              {HAZARDS.map((h, i) => ({ h, v: HAZ[stateOf(p)].r[i] }))
                .filter((x) => x.v >= 3)
                .map((x) => x.h.label.toLowerCase())
                .join(", ") || "none rated severe"}
              .
            </Text>
            <Text size="small">
              <Text size="small" weight="semibold">Venomous snakes.</Text> {HAZ[stateOf(p)].snakes}.
            </Text>
            <Text size="small">
              <Text size="small" weight="semibold">Typical drive to an ER with antivenom.</Text> {HAZ[stateOf(p)].er}.
              Find your nearest hospital before you buy, and confirm it stocks antivenom.
            </Text>
            <Text size="small">
              <Text size="small" weight="semibold">Frost depth.</Text> {HAZ[stateOf(p)].frost}. Water lines and the
              well connection must be buried below this or they freeze.
            </Text>
            <Callout tone="warning" title={adults === 1 ? "Living alone changes the risk" : "Plan for one person down"}>
              {adults === 1
                ? "The danger isn't usually the event itself. It's being hurt with no one to call: a snakebite, a chainsaw cut, a fall from the RV roof, heat stroke or a heart attack. Carry a satellite SOS device on you at all times, not just in the truck. Set up a daily check-in with a neighbor or family member. Take a Stop the Bleed or wilderness first-aid course, and keep a tourniquet on your belt when you're cutting wood."
                : "If one adult is hurt or sick, the other has to handle chores, hunting and getting help alone. Both of you should know first aid and how to run the generator, well, tractor and radios."}
            </Callout>
          </Stack>
        </Grid>
        <H3>How each hazard hits an RV homestead, and how to prepare</H3>
        <Table
          headers={["Hazard", "What it does", "Preparation", "Rough cost"]}
          columnAlign={["left", "left", "left", "right"]}
          rowTone={HAZARDS.map((_, i) => {
            const v = HAZ[stateOf(p)].r[i];
            return v >= 3 ? "danger" : v === 2 ? "warning" : undefined;
          })}
          rows={HAZARD_PREP.map(([h, what, prep, cost]) => [
            <Text key={h} size="small" weight="semibold">{h}</Text>,
            <Text size="small" tone="secondary">{what}</Text>,
            <Text size="small">{prep}</Text>,
            <Text size="small" tone="secondary">{cost}</Text>,
          ])}
        />
        <Text size="small" tone="tertiary">
          Row markers show {st.name}'s rating: red is severe, yellow is high. The safety kit ($1,200) and satellite
          SOS subscription ($200/yr) are now in the setup and yearly costs. Most other prep is covered by items
          already budgeted: the storm shelter, pole barn, tractor, well, rain catchment and northern-winter shelter.
        </Text>
      </Stack>

      <Stack gap={12}>
        <H2>Oklahoma-specific notes</H2>
        <Grid columns={2} gap={16}>
          <Stack gap={8}>
            <Text>
              <Text weight="semibold">Where to buy.</Text> Southeast and east Oklahoma (Pushmataha, Latimer, Le Flore,
              McCurtain, Pittsburg counties) get 40–55 inches of rain a year, have timber for firewood, and still sell
              raw land near $1,500/acre. Western Oklahoma land is cheaper but gets 20–30 inches of rain, with little
              wood and a lot of wind.
            </Text>
            <Text>
              <Text weight="semibold">Water rights.</Text> Domestic use of groundwater and of stream water crossing your
              land needs no permit. Irrigating or damming a stream beyond domestic use requires a permit from the
              Oklahoma Water Resources Board (OWRB). A spring or a creek that runs year-round is worth paying extra for.
              A pond is only as good as its watershed in a drought.
            </Text>
          </Stack>
          <Stack gap={8}>
            <Text>
              <Text weight="semibold">Living in an RV.</Text> Most rural counties have no zoning, but any dwelling with
              plumbing needs a DEQ-permitted septic system. Buy a four-season unit and plan to have the pole barn or
              cabin take over as the real shelter within 5–10 years.
            </Text>
            <Text>
              <Text weight="semibold">Property tax stays low.</Text> Oklahoma assesses 11–13.5% of market value at
              roughly 80–100 mills. That puts raw land at $75K around $400–800/yr, and an agricultural-use valuation can
              lower it further. At 65 you can apply to freeze the assessed value if household income falls under the
              county limit.
            </Text>
          </Stack>
        </Grid>
      </Stack>
    </Stack>
  );
}
