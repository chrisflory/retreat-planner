import { useEffect, useState, type ReactNode } from "react";
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
import { openExternal } from "./net";
import {
  clampAcresToRange,
  DEFAULT_COUNTIES,
  expandAcreRange,
  patchLinkedLand,
  readLinkedLand,
  type LinkedLand,
} from "./planLink";
import {
  deedOf,
  recordLinks,
  resolveChosen,
  usesForPlan,
  type ChosenLand,
  type ListingDeedSource,
} from "./restrictions";

type Status = "mfj" | "single";
type Strategy = "lump" | "split" | "asNeeded";
type PowerMode = "grid" | "hybrid" | "offgrid" | "offgridAC";
type HeatMode = "propane" | "both" | "wood";
type Housing = "rv" | "house";

const isLump = (p: { strategy: Strategy }) => p.strategy !== "asNeeded";

type Params = {
  adults: number;
  k401: number;
  savings: number;
  ageNow?: number;
  retireAge: number;
  goalAge: number;
  status: Status;
  strategy: Strategy;
  rule55: boolean;
  ssMonthly: number;
  ssAge: number;
  /** Monthly benefit at full retirement age. The check at ssAge is derived from this. */
  ssPia?: number;
  otherIncome: number;
  otherUntil: number;
  /** Yearly growth on the 401(k) while it is still in the account. */
  ret: number;
  /** Yearly interest on cash after a lump or split withdrawal, and on other savings. Missing means 0. */
  cashReturn?: number;
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
  chickens: boolean;
  garden: boolean;
  hens: number;
  eggDozen: number;
  gardenSave: number;
  state: StateId;
  txMove: boolean;
  startYear: number;
  jobPay: number;
  jobContrib: number;
  jobSave: number;
  ssCut: boolean;
  finance: boolean;
  downPct: number;
  loanRate: number;
  loanYears: number;
  powerMode: PowerMode;
  heat: HeatMode;
  /** rv keeps the used-RV plan. house replaces it with a small shelter. Missing means rv. */
  housing?: Housing;
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

type StateLocal = {
  cords: number;
  ownWood: boolean;
  woodNote: string;
  summerHigh: string;
  solar: [number, number];
  coops: string;
  well: string;
  septic: string;
  pad: string;
  rvLiving: string;
  propertyTax: string;
  medicaid: string;
  dmv: string;
  forms: string;
  wildlife: string;
  site: string;
  huntIntro: string;
  deerRules: string;
  hogRules: string;
  seniorRules: string;
};

const LOCAL: Record<StateId, StateLocal> = {
  OK: {
    cords: 3, ownWood: true, woodNote: "Post oak and hickory timber regrows about ½–1 cord per acre per year",
    summerHigh: "July–August highs over 100°F", solar: [3, 6],
    coops: "Kiamichi Electric or Choctaw Electric in SE Oklahoma",
    well: "~150–300 ft; Oklahoma drillers run ~$30–50/ft installed",
    septic: "Needs a DEQ permit. Aerobic systems are common on Oklahoma clay soils",
    pad: "Red clay turns to mud; gravel is not optional",
    rvLiving: "Most rural counties have no zoning, but any dwelling with plumbing needs a DEQ-permitted septic system",
    propertyTax: "Oklahoma assesses 11–13.5% of market value at roughly 80–100 mills. That puts raw land at $75K around $400–800/yr, and an agricultural-use valuation can lower it further. Apply for the homestead exemption with the county assessor by March 15; it needs a permanent dwelling, so an RV may not qualify. At 65 you can freeze the assessed value if household income is under the county limit",
    medicaid: "In low-income years you may qualify for SoonerCare, Oklahoma's Medicaid expansion, which has no asset test",
    dmv: "Get an Oklahoma driver's license at Service Oklahoma",
    forms: "Oklahoma Form 511-NR as a part-year resident, then Form 511 each year after. Have the plan withhold Oklahoma tax (Form OK-W-4-R), or pay quarterly with Form OW-8-ES if you'll owe $1,000 or more. Oklahoma excludes $10K a person of retirement income and doesn't tax Social Security",
    wildlife: "ODWC", site: "wildlifedepartment.com",
    huntIntro: "Eastern and southeastern Oklahoma have strong deer numbers and some of the densest feral hog populations in the country. Hogs are the better long-term food source. They have no season and no bag limit, they breed two litters a year, and they carry fat, which lean venison lacks. In a collapse, local deer would be hunted out within a few seasons. By 1917, unregulated hunting had left only a few hundred deer in all of Oklahoma.",
    deerRules: "Archery runs roughly Oct 1 to Jan 15, muzzleloader in late October, and rifle for about two weeks around Thanksgiving. The yearly limit has been about 6 deer with no more than 2 bucks. Every deer must be checked in through ODWC's E-check within 24 hours. Resident landowners get some license exemptions on their own land, but tagging and E-check still apply",
    hogRules: "No closed season and no bag limit on private land. Shooting hogs at night with lights or thermal requires a free feral swine control permit from ODWC. Moving live feral hogs is heavily restricted by the Oklahoma Department of Agriculture (ODAFF)",
    seniorRules: "Oklahoma residents 64 and older can buy an inexpensive senior lifetime hunting and fishing license",
  },
  MT: {
    cords: 8, ownWood: true, woodNote: "Foothill pine and fir; you may need a few cords hauled in until your own trees are thinned",
    summerHigh: "Highs in the 90s with cool nights", solar: [1.5, 6.5],
    coops: "Fergus Electric or Yellowstone Valley Electric in central Montana",
    well: "~100–400 ft; ~$40–60/ft installed. File a water-right notice with DNRC for an exempt domestic well",
    septic: "Needs a county health department permit and a frost-protected design",
    pad: "Gumbo clay and rock; gravel and good drainage are essential",
    rvLiving: "Most rural counties have little zoning. A septic permit comes from the county sanitarian. Plan on the insulated shelter becoming the winter home",
    propertyTax: "Montana taxes most homes at about 1.35% of market value times local mills, but land that qualifies as agricultural (generally 20+ acres in production) is taxed on what it produces. Raw 50 acres often runs $500–1,200/yr. Low-income residents can apply for property tax assistance",
    medicaid: "Montana kept its Medicaid expansion, so in low-income years you may qualify",
    dmv: "Get a Montana driver's license at a Motor Vehicle Division office",
    forms: "Montana Form 2 as a part-year resident, then each year after. Montana taxes most retirement income, with a deduction for taxpayers 65 and older",
    wildlife: "Montana FWP", site: "fwp.mt.gov",
    huntIntro: "Central Montana has some of the best big-game hunting in the country: elk, mule deer, whitetail and antelope. One elk yields about four deer's worth of meat. There are no feral hogs, so there is no year-round meat source and very little fat in the diet.",
    deerRules: "General archery runs from early September to mid-October, and the general rifle season runs about five weeks from late October through the weekend after Thanksgiving. Residents can buy a general deer and elk license over the counter. You need 180 days of residency before you qualify for resident licenses",
    hogRules: "Montana has no feral hogs and works to keep it that way. Report any sighting to the Department of Livestock",
    seniorRules: "Residents 62 and older get discounted conservation, base hunting and fishing licenses",
  },
  WY: {
    cords: 8, ownWood: false, woodNote: "Little timber on basin and plains land; plan to buy firewood or cut on national forest with a permit",
    summerHigh: "Highs in the 80s and 90s with dry wind", solar: [2.5, 6.5],
    coops: "Big Horn Rural Electric or High Plains Power",
    well: "~200–600 ft; ~$40–70/ft. Every well needs a State Engineer permit before drilling",
    septic: "Needs a DEQ or county small-wastewater permit",
    pad: "Bentonite gumbo turns slick when wet; build up the pad with gravel",
    rvLiving: "Few counties zone rural land. Septic permits come from DEQ or the county. The insulated shelter carries you through winter",
    propertyTax: "Wyoming assesses homes at 9.5% of value, about 0.6% a year with typical levies. Land in agricultural use is valued on what it produces, often a few dollars an acre. Long-time residents can apply for a homeowner's exemption",
    medicaid: "Wyoming hasn't expanded Medicaid. If your income falls below the poverty line, you can't get ACA subsidies or Medicaid, so keep reported income above about $15,650",
    dmv: "Get a Wyoming driver's license at a WYDOT driver services office",
    forms: "None. Wyoming has no income tax",
    wildlife: "Wyoming Game and Fish", site: "wgfd.wyo.gov",
    huntIntro: "Wyoming has elk, mule deer and antelope, and some of the highest antelope numbers anywhere. There are no feral hogs. Many licenses are by draw, so meat is not guaranteed every year.",
    deerRules: "Residents can buy general deer and elk licenses over the counter for general hunt areas, and limited-quota areas are by draw. Seasons vary by hunt area, mostly September to November. You need a full year of residency for resident licenses",
    hogRules: "No feral hogs. Report any sighting to Game and Fish",
    seniorRules: "Lifetime licenses are discounted only after many years of residency. Check the current fee schedule",
  },
  ID: {
    cords: 6, ownWood: true, woodNote: "North Idaho fir, larch and pine timber; firewood is plentiful",
    summerHigh: "Highs in the 80s and 90s; wildfire smoke in August", solar: [1, 6],
    coops: "Northern Lights Inc. in the north Idaho panhandle",
    well: "~100–400 ft; ~$40–60/ft. Your driller files the start card with IDWR",
    septic: "Needs a permit from your public health district (Panhandle Health in the north)",
    pad: "Spring mud season and snowmelt; gravel and ditching are essential",
    rvLiving: "Bonner and Boundary counties have zoning, and some limit how long an RV can be lived in. Check with county planning before you buy",
    propertyTax: "Idaho's homeowner exemption takes 50% (up to $125K) off the value of your primary home once it's built. Bare land isn't covered; rural levies run about 0.6–1%. Residents 65+ with low income can get property tax reduction (circuit breaker)",
    medicaid: "Idaho expanded Medicaid, so in low-income years you may qualify",
    dmv: "Get an Idaho driver's license at the county DMV office",
    forms: "Idaho Form 43 as a part-year resident, then Form 40 each year after. Idaho taxes 401(k) withdrawals at 5.3% and doesn't tax Social Security",
    wildlife: "IDFG", site: "idfg.idaho.gov",
    huntIntro: "North Idaho has elk, whitetail and mule deer, bear and moose. There are no feral hogs. Timber hunting is harder than open country, but game is plentiful.",
    deerRules: "General deer and elk tags are sold over the counter to residents. Most general rifle seasons run October to mid-November, with archery in September. Report every harvest within 10 days. You need six months of residency for resident licenses",
    hogRules: "No feral hogs. Idaho bans possessing or releasing them",
    seniorRules: "Residents 65 and older with 5 years of residency can buy discounted senior licenses",
  },
  SD: {
    cords: 9, ownWood: false, woodNote: "West River ranch land has few trees; buy firewood or rely on propane",
    summerHigh: "Highs in the 90s, sometimes over 100°F", solar: [2, 6.5],
    coops: "West River Electric or Black Hills Electric",
    well: "~200–1,000 ft into deep aquifers West River; ~$35–60/ft",
    septic: "Needs a permit under state DANR rules, through the county",
    pad: "Gumbo clay is impassable when wet; gravel is essential",
    rvLiving: "Many counties have agricultural zoning but allow a dwelling on large parcels. South Dakota is also an easy domicile state for RVers",
    propertyTax: "Owner-occupied homes get a lower rate, and agricultural land is assessed on productivity. Residents 65+ with low income can freeze their assessed value",
    medicaid: "South Dakota expanded Medicaid by voter amendment, so in low-income years you may qualify",
    dmv: "Get a South Dakota driver's license at a Driver Licensing office",
    forms: "None. South Dakota has no income tax",
    wildlife: "SD Game, Fish and Parks", site: "gfp.sd.gov",
    huntIntro: "West River South Dakota has mule deer, whitetail, antelope and pheasant. There are no feral hogs. Most deer licenses are by lottery.",
    deerRules: "Most rifle deer licenses are drawn by lottery, with landowner preference on your own land. The West River rifle season runs mid-November. You need 90 days of residency for resident licenses",
    hogRules: "No established feral hogs. Report any sighting",
    seniorRules: "Check for discounted senior fishing and combination licenses",
  },
  ND: {
    cords: 10, ownWood: false, woodNote: "Few trees outside river breaks; buy firewood or rely on propane",
    summerHigh: "Highs in the 90s", solar: [1.8, 6.5],
    coops: "Roughrider Electric or Mor-Gran-Sou Electric",
    well: "~100–400 ft; ~$35–55/ft",
    septic: "Needs a permit from the district health unit",
    pad: "Clay gumbo; gravel is essential",
    rvLiving: "Township and county zoning are common. Check before you buy",
    propertyTax: "Agricultural land is valued on productivity. Residents 65+ with low income get a homestead credit, and the state now credits primary residences",
    medicaid: "North Dakota expanded Medicaid, so in low-income years you may qualify",
    dmv: "Get a North Dakota driver's license at an NDDOT driver license site",
    forms: "North Dakota Form ND-1 with Schedule ND-1NR as a part-year resident, then Form ND-1 each year after. Little or no tax is due on modest withdrawals",
    wildlife: "NDGF", site: "gf.nd.gov",
    huntIntro: "Western North Dakota has whitetail and mule deer, antelope and waterfowl. There are no feral hogs. Deer licenses are by lottery.",
    deerRules: "Deer gun licenses are drawn by lottery, and landowners on 150+ acres can get gratis licenses. The rifle season runs about 16 days from early November. You need six months of residency for resident licenses",
    hogRules: "No feral hogs. North Dakota bans possessing them",
    seniorRules: "Check for discounted senior fishing licenses",
  },
  TN: {
    cords: 3, ownWood: true, woodNote: "Oak-hickory hardwood timber regrows about 1 cord per acre per year",
    summerHigh: "Highs in the 90s with high humidity", solar: [2.5, 5.5],
    coops: "Volunteer Energy Cooperative or Sequachee Valley Electric",
    well: "~150–400 ft in limestone; ~$25–45/ft",
    septic: "Needs a TDEC permit after a soil test. Shallow rock on the Cumberland Plateau can raise the cost",
    pad: "Clay over rock; gravel is essential",
    rvLiving: "Some counties restrict living full-time in an RV. Check with the county before you buy",
    propertyTax: "Residential property is assessed at 25% of appraised value. Greenbelt classification (15+ acres in farm or forest use) lowers it a lot. Residents 65+ with low income can get tax relief or a freeze",
    medicaid: "Tennessee hasn't expanded Medicaid. If your income falls below the poverty line, you can't get ACA subsidies or TennCare, so keep reported income above about $15,650",
    dmv: "Get a Tennessee driver's license at a Driver Services Center",
    forms: "None. Tennessee has no income tax",
    wildlife: "TWRA", site: "tnwildlife.org",
    huntIntro: "Tennessee has strong whitetail and turkey numbers on the Cumberland Plateau. TWRA restricts hog hunting, so deer are the main meat source.",
    deerRules: "Archery starts in late September, and the rifle season runs from late November into early January. The limit is generous: several antlerless deer plus 2 bucks. Check every deer by midnight of the day you take it. Landowners can hunt their own land without a license",
    hogRules: "Sport hunting of hogs is mostly banned. Landowners can kill hogs on their own land and can get an exemption permit for trapping and night shooting",
    seniorRules: "Residents 65 and older can buy a discounted Senior Citizen permanent hunting and fishing license",
  },
  AR: {
    cords: 3, ownWood: true, woodNote: "Oak-hickory and pine timber; firewood is plentiful",
    summerHigh: "Highs in the upper 90s with high humidity", solar: [2.8, 5.5],
    coops: "Ozarks Electric, Carroll Electric or Ouachita Electric",
    well: "~300–600 ft in Ozark and Ouachita hard rock; ~$25–40/ft",
    septic: "Needs a Health Department permit, designed by a licensed designated representative",
    pad: "Rocky clay; gravel and culverts for runoff",
    rvLiving: "Most rural Ozark and Ouachita counties have no zoning. You still need a permitted septic system",
    propertyTax: "Property is assessed at 20% of market value, with a homestead credit of about $500 on your home. At 65 you can freeze the assessed value of your homestead",
    medicaid: "Arkansas expanded Medicaid (ARHOME), so in low-income years you may qualify",
    dmv: "Get an Arkansas driver's license at a State Police driver testing site, and register vehicles at a DFA revenue office",
    forms: "Arkansas Form AR1000NR as a part-year resident, then Form AR1000F each year after. The first $6K of retirement income is exempt",
    wildlife: "AGFC", site: "agfc.com",
    huntIntro: "The Ozarks and Ouachitas have good deer numbers and plenty of feral hogs, plus turkey and a small elk herd. This is the closest match to SE Oklahoma.",
    deerRules: "Archery starts in late September, and the modern-gun season runs most of November and December, depending on the zone. Check every deer through AGFC's app or by phone within 12 hours. You need 60 days of residency for resident licenses",
    hogRules: "Feral hogs are a public nuisance. Landowners can kill them on their own land at any time. On public land, take them only incidentally while hunting other game",
    seniorRules: "Residents 65 and older can buy an inexpensive lifetime hunting and fishing license",
  },
  MO: {
    cords: 4, ownWood: true, woodNote: "Ozark oak-hickory timber; firewood is plentiful",
    summerHigh: "Highs in the upper 90s with humidity", solar: [2.3, 5.5],
    coops: "Howell-Oregon Electric or Intercounty Electric in the Ozarks",
    well: "~300–600 ft in Ozark limestone, cased to state standards; ~$30–45/ft",
    septic: "Needs a permit from the county health department or DHSS",
    pad: "Rocky clay; gravel is essential",
    rvLiving: "Most rural Ozark counties have no zoning",
    propertyTax: "Residential property is assessed at 19% and agricultural land at 12% of its productive value. Counties can freeze taxes for homeowners 62 and older",
    medicaid: "Missouri expanded Medicaid (MO HealthNet) by voter amendment, so in low-income years you may qualify",
    dmv: "Get a Missouri driver's license at a DOR license office",
    forms: "Missouri Form MO-1040 with Form MO-NRI as a part-year resident, then MO-1040 each year after. Missouri doesn't tax Social Security",
    wildlife: "MDC", site: "mdc.mo.gov",
    huntIntro: "The Missouri Ozarks have good deer and turkey numbers. Missouri is eradicating feral hogs, so they aren't a dependable meat source.",
    deerRules: "Archery runs mid-September to mid-January, and the main firearms season runs about 11 days in mid-November. Telecheck every deer by 10 p.m. the day you take it. Resident landowners with 5+ acres get free deer and turkey permits for their own land",
    hogRules: "Hunting feral hogs is banned. Landowners can kill hogs on their own land, and MDC helps with trapping",
    seniorRules: "Residents 65 and older don't need small-game hunting or fishing permits",
  },
  WV: {
    cords: 4, ownWood: true, woodNote: "Mixed hardwood timber; firewood is plentiful",
    summerHigh: "Highs in the upper 80s with humidity", solar: [2, 5],
    coops: "Mon Power or Appalachian Power; there are few co-ops",
    well: "~100–300 ft; ~$25–40/ft",
    septic: "Needs a county health department permit; steep slopes can make it harder",
    pad: "Steep, with mud and slides; gravel and ditching are essential",
    rvLiving: "Most rural counties have no zoning",
    propertyTax: "Property is assessed at 60% of value with low rural levies. The homestead exemption takes $20K off at 65",
    medicaid: "West Virginia expanded Medicaid, so in low-income years you may qualify",
    dmv: "Get a West Virginia driver's license at a DMV regional office",
    forms: "West Virginia Form IT-140 with Schedule A as a part-year resident, then IT-140 each year after. West Virginia no longer taxes Social Security",
    wildlife: "WVDNR", site: "wvdnr.gov",
    huntIntro: "West Virginia has deer, black bear and turkey, and no feral hogs to speak of. Steep hollows make hunting and packing out harder.",
    deerRules: "Archery runs late September to December, and the buck firearms season runs two weeks starting the Monday before Thanksgiving. Check every deer electronically within 72 hours. You need 30 days of residency for resident licenses",
    hogRules: "No established feral hogs. A few native wild boar exist in the south, with limited seasons",
    seniorRules: "Residents 65 and older can buy a discounted lifetime license",
  },
  MS: {
    cords: 2, ownWood: true, woodNote: "Pine and hardwood timber; firewood is plentiful",
    summerHigh: "Highs in the upper 90s with high humidity", solar: [3, 5.5],
    coops: "4-County Electric or Central Electric",
    well: "~100–400 ft in sand aquifers; ~$20–40/ft",
    septic: "Needs a permit from the State Department of Health",
    pad: "Loess and clay; gravel is essential",
    rvLiving: "Most rural counties have little zoning",
    propertyTax: "Homes are assessed at 10% of value once you file for homestead. At 65 the first $75K of home value is exempt from most levies",
    medicaid: "Mississippi hasn't expanded Medicaid. If your income falls below the poverty line, you can't get ACA subsidies or Medicaid, so keep reported income above about $15,650",
    dmv: "Get a Mississippi driver's license at a Driver Service Bureau",
    forms: "Mississippi Form 80-205 as a part-year resident, then Form 80-105 each year after. Qualified retirement income is exempt, but check early (pre-59½) withdrawals with a CPA",
    wildlife: "MDWFP", site: "mdwfp.com",
    huntIntro: "Mississippi has strong deer and turkey numbers and plenty of feral hogs, with the longest seasons on this list.",
    deerRules: "Archery starts October 1, and gun seasons run from mid-November into January, depending on the zone. Report every deer through MDWFP's harvest app. You need 6 months of residency for resident licenses",
    hogRules: "Landowners can kill hogs on their own land at any time, and can shoot at night with a permit",
    seniorRules: "Residents 65 and older can get a free lifetime exempt license",
  },
};

type StateEst = {
  landPerAcre: number;
  propaneGal: number;
  baseGal: number;
  propTax: number;
  winterShelter: number;
  cords: number;
  stove: number;
};

type Estimates = {
  acres: number;
  propanePrice: number;
  firewoodOwn: number;
  firewoodBuy: number;
  deerLb: number;
  hogLb: number;
  lardLb: number;
  elkLb: number;
  ssCutYear: number;
  ssCutPct: number;
  highInflation: number;
  states: Record<StateId, StateEst>;
};

const DEFAULT_EST: Estimates = {
  acres: 50,
  propanePrice: 2.9,
  firewoodOwn: 40,
  firewoodBuy: 275,
  deerLb: 45,
  hogLb: 50,
  lardLb: 6,
  elkLb: 180,
  ssCutYear: 2033,
  ssCutPct: 80,
  highInflation: 7,
  states: Object.fromEntries(
    STATE_IDS.map((id) => {
      const s = STATES[id];
      const north = s.winterShelter > 0;
      return [
        id,
        {
          landPerAcre: s.landPerAcre,
          propaneGal: s.propaneGal,
          baseGal: north ? 250 : 150,
          propTax: s.propTax,
          winterShelter: s.winterShelter,
          cords: LOCAL[id].cords,
          stove: north ? 3500 : 2500,
        },
      ];
    }),
  ) as Record<StateId, StateEst>,
};

function mergeEst(stored: Partial<Estimates> | null | undefined): Estimates {
  const s = stored ?? {};
  return {
    ...DEFAULT_EST,
    ...s,
    states: Object.fromEntries(
      STATE_IDS.map((id) => [id, { ...DEFAULT_EST.states[id], ...(s.states?.[id] ?? {}) }]),
    ) as Record<StateId, StateEst>,
  };
}

let EST: Estimates = DEFAULT_EST;
const sEst = (id: StateId) => EST.states[id];

const HEAT: Record<HeatMode, { label: string; summary: string }> = {
  propane: { label: "Propane", summary: "The RV furnace and appliances run on propane. It's easy, but it's the costliest heat and depends on deliveries." },
  both: { label: "Wood stove, propane backup", summary: "A wood stove carries most of the winter. Propane covers cooking, hot water, the fridge and cold snaps when you're away or sick." },
  wood: { label: "Wood only (propane for cooking)", summary: "All heat from wood. Propane only for cooking, hot water and the fridge, so a small tank lasts most of a year." },
};
const HEAT_IDS = Object.keys(HEAT) as HeatMode[];
function heatPlan(id: StateId, mode: HeatMode) {
  const e = sEst(id);
  const baseGal = Math.min(e.baseGal, e.propaneGal);
  const propaneGal =
    mode === "propane" ? e.propaneGal : mode === "both" ? Math.round(baseGal + 0.25 * (e.propaneGal - baseGal)) : baseGal;
  const cords = mode === "propane" ? 0 : mode === "both" ? Math.ceil(e.cords * 0.8) : e.cords;
  const perCord = LOCAL[id].ownWood ? EST.firewoodOwn : EST.firewoodBuy;
  return {
    propaneGal,
    cords,
    firewood: Math.round(cords * perCord),
    stove: mode === "propane" ? 0 : e.stove,
  };
}

function derivedForState(id: StateId, heat: HeatMode) {
  const e = sEst(id);
  const h = heatPlan(id, heat);
  return {
    up: { land: Math.round(e.landPerAcre * EST.acres), winter: e.winterShelter, woodheat: h.stove },
    rec: { propane: Math.round(h.propaneGal * EST.propanePrice), firewood: h.firewood, proptax: e.propTax },
  };
}

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
  const d = derivedForState(id, p.heat ?? "propane");
  return [
    { ...p, state: id, hogsPerYear: s.hogs, elkPerYear: s.elk },
    { ...up, ...d.up, hogtrap: s.hogs > 0 ? up.hogtrap || PRESET_PLANNED.hogtrap : 0 },
    { ...rec, ...d.rec },
  ];
}

const DEFAULT_PARAMS: Params = {
  adults: 1,
  k401: 375000,
  savings: 0,
  ageNow: 58,
  retireAge: 59,
  goalAge: 85,
  status: "single",
  strategy: "lump",
  rule55: true,
  ssMonthly: 1400,
  ssAge: 62,
  otherIncome: 0,
  otherUntil: 62,
  ret: 4,
  cashReturn: 0,
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
  chickens: true,
  garden: true,
  hens: 6,
  eggDozen: 4,
  gardenSave: 700,
  state: "OK",
  txMove: true,
  startYear: 2027,
  jobPay: 0,
  jobContrib: 0,
  jobSave: 0,
  ssCut: false,
  finance: false,
  downPct: 20,
  loanRate: 7,
  loanYears: 15,
  powerMode: "grid",
  heat: "propane",
  housing: "rv",
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
const housingOf = (p: { housing?: Housing }): Housing => (p.housing === "house" ? "house" : "rv");

const EGGS_PER_HEN = 200;
const chickenUpkeep = (hens: number) => Math.round(Math.max(0, hens) * (350 / 6));

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

type Group = "core" | "hardening" | "hunting" | "food";

function homeCounted(u: { id: string }, p: { housing?: Housing }): boolean {
  const house = housingOf(p) === "house";
  if (u.id === "rv" || u.id === "rvhookup") return !house;
  if (u.id === "houseShell" || u.id === "houseStove" || u.id === "houseWire") return house;
  // The house is the winter home. The cabin line is the RV plan's backup room.
  // The house stove line replaces the RV wood-stove line so it is not counted twice.
  if (house && (u.id === "winter" || u.id === "cabin" || u.id === "woodheat")) return false;
  return true;
}

function groupOf(u: UpfrontItem, p: Params): Group {
  if (u.food) return "food";
  if (u.hunting) return "hunting";
  if (u.id === "offgrid" && p.powerMode !== "grid") return "core";
  return u.hardening ? "hardening" : "core";
}

function foodCounted(u: UpfrontItem, p: Params) {
  if (u.food === "chickens") return p.chickens;
  if (u.food === "garden") return p.garden;
  return true;
}

function upfrontTotalFor(p: Params, up: Record<string, number>): number {
  return UPFRONT.reduce((s, u) => {
    const g = groupOf(u, p);
    if (g === "hunting" && !p.hunting) return s;
    if (g === "hardening" && !p.hardening) return s;
    if (g === "food" && !foodCounted(u, p)) return s;
    if (!homeCounted(u, p)) return s;
    return s + upAmount(up, u.id, p);
  }, 0);
}


function huntYield(p: Params) {
  const deerLb = p.deerPerYear * EST.deerLb;
  const hogLb = p.hogsPerYear * EST.hogLb;
  const elkLb = (p.elkPerYear ?? 0) * EST.elkLb;
  const lardLb = p.hogsPerYear * EST.lardLb;
  const kcal =
    (deerLb + elkLb) * KCAL_VENISON_LB + hogLb * KCAL_HOG_LB + lardLb * KCAL_LARD_LB;
  const need = KCAL_PER_PERSON_YEAR * adultsOf(p);
  return { deerLb, hogLb, elkLb, lardLb, meatLb: deerLb + hogLb + elkLb, kcal, need, share: kcal / need };
}

type UpfrontItem = {
  id: string;
  label: string;
  note: string;
  hardening: boolean;
  hunting?: boolean;
  food?: "chickens" | "garden";
};

const UPFRONT: UpfrontItem[] = [
  { id: "land", label: "Land, 50 acres", note: "Same amount as the Land search maximum. A listing loaded with Use in plan replaces it. Editing the state's $/acre under Estimates also rewrites it.", hardening: false },
  { id: "winter", label: "Year-round insulated shelter", note: "Required where winters reach −20°F; an RV alone won't survive it", hardening: false },
  { id: "rv", label: "Used RV", note: "Look for a 4-season unit; it lives outdoors through ice storms and 100°F summers", hardening: false },
  { id: "houseShell", label: "House shell", note: "Insulated one-room structure, a door, and a simple foundation. Not the well, the septic, the stove, or the power equipment. Replace this with a builder's quote. A permanent dwelling can qualify for a homestead credit. You still need a septic permit, and a covenant can ban the house or set a minimum size even where the county has no zoning.", hardening: false },
  { id: "houseStove", label: "Wood stove in the house", note: "Wood stove, insulated chimney, hearth pad, and a splitting maul. This replaces the separate wood-stove line so the stove is not counted twice. Yearly firewood stays under monthly costs.", hardening: false },
  { id: "houseWire", label: "House wiring", note: "Electrical rough-in and a panel for the power setup in Assumptions. The co-op line, the solar bank, and the generator are their own lines.", hardening: false },
  { id: "closing", label: "Closing, survey, title", note: "Rural tracts often need a new survey", hardening: false },
  { id: "well", label: "Drilled well + pump", note: "~150–300 ft; Oklahoma drillers run ~$30–50/ft installed", hardening: false },
  { id: "septic", label: "Septic + permit", note: "Aerobic systems are common on Oklahoma clay soils", hardening: false },
  { id: "power", label: "Grid line drop / extension + meter", note: "$2–10K if a co-op line runs along the road; co-ops charge roughly $15–40K per mile beyond that. $0 off-grid", hardening: false },
  { id: "rvhookup", label: "RV pedestal: 50 A outlet, frost-free hydrant, sewer cleanout", note: "Hooks the RV to power, the well and the septic so you aren't hauling water or dumping tanks", hardening: false },
  { id: "starlink", label: "Starlink kit + pole or roof mount", note: "Mount it clear of trees with an open view of the northern sky", hardening: false },
  { id: "generator", label: "Dual-fuel inverter generator, 4–5 kW", note: "Runs on propane from the main tank. Covers grid outages and cloudy weeks", hardening: false },
  { id: "pad", label: "Driveway + gravel RV pad", note: "Red clay turns to mud; gravel is not optional", hardening: false },
  { id: "barn", label: "Pole barn / RV cover", note: "Protects the RV from hail and ice; doubles as a workshop", hardening: false },
  { id: "shelter", label: "In-ground storm shelter", note: "An RV is the worst place to be in a tornado", hardening: false },
  { id: "safety", label: "Safety kit: satellite SOS, NOAA radio, CO/smoke alarms, extinguishers, snake gaiters, bear spray, tourniquet", note: "Living alone, an SOS device is how you call for help after a bite, fall or chainsaw cut", hardening: false },
  { id: "propane", label: "500-gal propane tank (owned) + fill", note: "Owning the tank lets you shop suppliers", hardening: false },
  { id: "woodheat", label: "Wood stove, insulated chimney, hearth pad, splitting maul", note: "", hardening: false },
  { id: "tractor", label: "Used compact tractor, brush hog, chainsaw", note: "50 acres turns to brush in 2–3 seasons without one", hardening: false },
  { id: "fence", label: "Fence repair + gate", note: "", hardening: false },
  { id: "handpump", label: "Well hand pump (Simple Pump / Bison)", note: "Electric well pumps stop when the grid does", hardening: true },
  { id: "offgrid", label: "Solar + LiFePO4 battery bank", note: "Sized for well, fridge, fans, lights; not RV A/C", hardening: true },
  { id: "cabin", label: "Wood stove + insulated small cabin", note: "Fallback heat once stored propane runs out", hardening: true },
  { id: "food", label: "1-year food storage, per person", note: "~450 lb grains, beans, oil per person, plus canned goods", hardening: true },
  { id: "garden", label: "Canning and dry storage", note: "Jars, extra lids and shelves. The coop and the garden fence are their own switches, not this line.", hardening: true },
  { id: "coop", label: "Chicken coop, hardware-cloth run, first hens", note: "Solid coop, 1/2-inch hardware cloth, a buried or pinned apron, and latches a raccoon can't open. Sized for about six hens.", hardening: false, food: "chickens" },
  { id: "plot", label: "Fenced garden, drip line, tools", note: "The fence is most of this. A chest-high fence does not stop deer.", hardening: false, food: "garden" },
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
  land: 75000, winter: 0, rv: 40000, houseShell: 32000, houseStove: 5000, houseWire: 8000, closing: 3000, well: 15000, septic: 9000, power: 10000,
  rvhookup: 2500, starlink: 500, generator: 1200, pad: 5000,
  barn: 10000, shelter: 5000, safety: 1200, propane: 3500, woodheat: 0, tractor: 10000, fence: 5000,
  handpump: 3000, offgrid: 15000, cabin: 15000, food: 3000, garden: 800, coop: 2200, plot: 1600, rain: 3000,
  medical: 1000, comms: 2500, fuel: 3000,
  rifle: 1000, hogtrap: 1500, stand: 600, butcher: 500, freezer: 700, canner: 700,
};

const PRESET_LEAN: Record<string, number> = {
  land: 75000, winter: 0, rv: 30000, houseShell: 20000, houseStove: 4000, houseWire: 6000, closing: 2500, well: 12000, septic: 7000, power: 6000,
  rvhookup: 1500, starlink: 400, generator: 800, pad: 3000,
  barn: 0, shelter: 4000, safety: 800, propane: 3000, woodheat: 0, tractor: 5000, fence: 0,
  handpump: 2500, offgrid: 8000, cabin: 6000, food: 2000, garden: 400, coop: 1100, plot: 700, rain: 1500,
  medical: 750, comms: 1000, fuel: 2000,
  rifle: 0, hogtrap: 800, stand: 200, butcher: 300, freezer: 500, canner: 450,
};

type AgeRule = "all" | "pre65" | "post65";
type RecurringItem = { id: string; label: string; rule: AgeRule; collapse: string };

const RECURRING: RecurringItem[] = [
  { id: "food", label: "Groceries, per person (hunting, eggs and garden offset some)", rule: "all", collapse: "Stored grain, whatever the garden and the flock still produce" },
  { id: "hunt", label: "Hunting: licenses, tags, ammo, feed corn", rule: "all", collapse: "Stockpiled ammo; traps need none" },
  { id: "water", label: "Water: well testing, filters", rule: "all", collapse: "Hand pump, rain catchment, pond + filter" },
  { id: "proptax", label: "Property tax", rule: "all", collapse: "Not collected" },
  { id: "hoa", label: "HOA or road dues", rule: "all", collapse: "Not collected" },
  { id: "propane", label: "Propane", rule: "all", collapse: "Stored propane, then firewood" },
  { id: "firewood", label: "Firewood", rule: "all", collapse: "Cut your own with a bow saw and axe once gas runs out" },
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
  { id: "garden", label: "Garden: seed, soil, canning lids, row cover", rule: "all", collapse: "Saved seed, and eat only what the deer didn't" },
  { id: "chickens", label: "Chickens: feed, bedding, replacement hens", rule: "all", collapse: "Scraps cover some feed. A raccoon ends the eggs." },
  { id: "trash", label: "Trash (rural transfer station)", rule: "all", collapse: "Burn / compost" },
  { id: "rvreserve", label: "RV replacement reserve", rule: "all", collapse: "Cabin becomes the house" },
];

const RECURRING_DEFAULTS: Record<string, number> = {
  food: 3600, hunt: 400, water: 300, proptax: 500, hoa: 0, propane: 1500, firewood: 0, electric: 1500, gas: 1000, autoins: 1400,
  rvins: 1000, liability: 500, aca: 3000, medicare: 4750, oop: 750, sos: 200, internet: 1900, maint: 2500,
  septic: 200, household: 1200, garden: 350, chickens: 350, trash: 200, rvreserve: 2500,
};

const LIVING_PRESETS: Record<"bare" | "modest" | "comfortable", { label: string; note: string; values: Record<string, number> }> = {
  bare: {
    label: "Bare-bones",
    note: "Liability-only truck insurance, a $0-premium Medicare Advantage plan at 65, Starlink's cheapest plan, doing your own repairs, no RV replacement fund",
    values: {
      food: 2400, hunt: 250, water: 100, gas: 600, autoins: 700, rvins: 500, liability: 200, aca: 600, medicare: 2500,
      oop: 400, sos: 180, internet: 1100, maint: 1000, septic: 100, household: 600, garden: 200, chickens: 200, trash: 100, rvreserve: 0,
    },
  },
  modest: {
    label: "Modest",
    note: "Careful spending with some cushion for repairs and the RV wearing out",
    values: {
      food: 3000, hunt: 300, water: 200, gas: 800, autoins: 1000, rvins: 750, liability: 350, aca: 1800, medicare: 3600,
      oop: 600, sos: 180, internet: 1500, maint: 1800, septic: 150, household: 900, garden: 350, chickens: 350, trash: 150, rvreserve: 1500,
    },
  },
  comfortable: {
    label: "Comfortable",
    note: "The original estimates: full coverage insurance, Medigap Plan G at 65, regular RV replacement saving",
    values: Object.fromEntries(
      Object.entries(RECURRING_DEFAULTS).filter(([k]) => !["proptax", "hoa", "propane", "firewood", "electric"].includes(k)),
    ),
  },
};
type LivingPreset = keyof typeof LIVING_PRESETS;

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

const MIN_PLAN_AGE = 40;
const MAX_PLAN_AGE = 75;
const clampPlanAge = (n: number) =>
  Math.min(MAX_PLAN_AGE, Math.max(MIN_PLAN_AGE, Math.round(Number.isFinite(n) ? n : MIN_PLAN_AGE)));
const startAge = (p: { retireAge?: number }) => clampPlanAge(p.retireAge ?? 58);

function ageNowFrom(p: { ageNow?: number; retireAge?: number; startYear?: number }) {
  if (p.ageNow != null && Number.isFinite(p.ageNow)) return clampPlanAge(p.ageNow);
  return clampPlanAge((p.retireAge ?? 58) - yearsToRetire(p));
}

const DEFERRAL_BASE = 23500;
const DEFERRAL_CATCHUP = 31000;

function deferralNote(p: Params, contrib: number) {
  const years = yearsToRetire(p);
  if (years <= 0 || contrib <= DEFERRAL_BASE) return "";
  const now = ageNowFrom(p);
  const lastAge = now + years - 1;
  if (now >= 50) {
    return contrib > DEFERRAL_CATCHUP
      ? `The 2026 employee deferral limit at age ${now} is $31,000. Employer match can sit on top of that.`
      : "";
  }
  if (lastAge >= 50) {
    const yearTurns50 = THIS_YEAR + (50 - now);
    return contrib > DEFERRAL_CATCHUP
      ? `The 2026 employee deferral limit is $23,500 until age 50, then $31,000. This contribution is above both. Employer match can sit on top of that.`
      : `The 2026 employee deferral limit is $23,500 until you turn 50 in ${yearTurns50}, then $31,000. Employer match can sit on top of that.`;
  }
  return `The 2026 employee deferral limit at age ${now} is $23,500. It becomes $31,000 at age 50. Employer match can sit on top of that.`;
}
const rule55Applies = (p: Params) => p.rule55 && startAge(p) >= 55;
const END_AGE = 95;
const THIS_YEAR = new Date().getFullYear();

function yearsToRetire(p: { startYear?: number }) {
  return Math.max(0, Math.round(p.startYear ?? THIS_YEAR) - THIS_YEAR);
}

/** Full retirement age in months, from the Social Security birth-year table. */
function fraMonths(birthYear: number): number {
  if (birthYear <= 1937) return 65 * 12;
  if (birthYear >= 1960) return 67 * 12;
  if (birthYear >= 1943) return 66 * 12;
  return 65 * 12 + (birthYear - 1937) * 2;
}

function fraText(months: number) {
  const years = Math.floor(months / 12);
  const extra = months % 12;
  return extra === 0 ? `age ${years}` : `${years} and ${extra} months`;
}

/** Share of the full benefit paid at claimAge. Credits stop at 70 and payments don't start before 62. */
function ssBenefitFactor(claimAge: number, fraM: number) {
  const claimM = Math.min(70 * 12, Math.max(62 * 12, Math.round(claimAge * 12)));
  const early = fraM - claimM;
  if (early > 0) {
    const first = Math.min(early, 36);
    const rest = Math.max(0, early - 36);
    return 1 - (first * (5 / 9) + rest * (5 / 12)) / 100;
  }
  return 1 + Math.max(0, claimM - fraM) * (2 / 3) / 100;
}

function clampSsAge(n: number) {
  const months = Math.round((Number.isFinite(n) ? n : 67) * 12);
  return Math.min(70 * 12, Math.max(62 * 12, months)) / 12;
}

function ssPiaOf(p: { ssPia?: number; ssMonthly?: number; ssAge?: number }, ageNow: number) {
  if (p.ssPia != null && Number.isFinite(p.ssPia)) return Math.max(0, p.ssPia);
  const factor = ssBenefitFactor(p.ssAge ?? 62, fraMonths(THIS_YEAR - Math.round(ageNow)));
  return factor > 0 ? Math.max(0, (p.ssMonthly ?? 0) / factor) : 0;
}

function ssMonthlyAt(pia: number, claimAge: number, ageNow: number) {
  return Math.round(pia * ssBenefitFactor(claimAge, fraMonths(THIS_YEAR - Math.round(ageNow))));
}

function linkAges(prev: Partial<Params>, which: "now" | "retire" | "year", n: number): Params {
  const now0 = ageNowFrom(prev);
  const base: Params = { ...DEFAULT_PARAMS, ...prev, ageNow: now0 };
  if (which === "now") {
    const now = clampPlanAge(n);
    const retire = Math.min(MAX_PLAN_AGE, now + yearsToRetire(base));
    const next = { ...base, ageNow: now, retireAge: retire, startYear: THIS_YEAR + (retire - now) };
    if (next.ssPia == null) return next;
    const age = clampSsAge(next.ssAge);
    return { ...next, ssAge: age, ssMonthly: ssMonthlyAt(next.ssPia, age, now) };
  }
  if (which === "year") {
    const year = Math.min(THIS_YEAR + (MAX_PLAN_AGE - now0), Math.max(THIS_YEAR, Math.round(n)));
    return { ...base, ageNow: now0, startYear: year, retireAge: now0 + (year - THIS_YEAR) };
  }
  const retire = Math.min(MAX_PLAN_AGE, Math.max(now0, Math.round(n)));
  return { ...base, ageNow: now0, retireAge: retire, startYear: THIS_YEAR + (retire - now0) };
}

function nestEgg(p: Params) {
  const years = yearsToRetire(p);
  const r401 = (p.ret ?? 0) / 100;
  const rCash = (p.cashReturn ?? 0) / 100;
  let k401 = Math.max(0, p.k401);
  let savings = Math.max(0, p.savings ?? 0);
  const contrib = Math.max(0, p.jobContrib ?? 0);
  const save = Math.max(0, p.jobSave ?? 0);
  for (let i = 0; i < years; i++) {
    k401 = k401 * (1 + r401) + contrib;
    savings = savings * (1 + rCash) + save;
  }
  return { years, k401, savings, contrib, save };
}
const goalOf = (p: Params) => Math.min(END_AGE, Math.max(startAge(p) + 1, Math.round(p.goalAge ?? 85)));

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
  const penalty = !rule55Applies(p) && age < 59.5 ? 0.1 * w : 0;
  return { fed, ok, penalty, total: fed + ok + penalty };
}

function lumpSumTax(p: Params) {
  const parts = p.strategy === "split" ? 2 : 1;
  const one = taxOnWithdrawal(p.k401 / parts, p, startAge(p), p.txMove);
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
    if (item.id === "rvreserve" && housingOf(p) === "house") continue;
    sum +=
      item.id === "aca" && unsubsidizedHealth ? p.acaUnsub * adultsOf(p) : recAmount(rec, item.id, p);
  }
  return (sum - foodOffset(rec, p).used) * (1 + p.contingency / 100);
}

function meatOffset(rec: Record<string, number>, p: Params): number {
  if (!p.hunting) return 0;
  return Math.min(huntYield(p).meatLb * p.meatValue, recAmount(rec, "food", p) * 0.5);
}

function eggPlan(p: Params) {
  const hens = Math.max(0, Math.round(p.hens ?? 6));
  const dozens = (hens * EGGS_PER_HEN) / 12;
  return { hens, dozens, value: dozens * Math.max(0, p.eggDozen ?? 4) };
}

function gardenGrocery(p: Params) {
  return Math.max(0, p.gardenSave ?? 700) * (adultsOf(p) === 1 ? 1 : 1.6);
}

function foodOffset(rec: Record<string, number>, p: Params) {
  const food = recAmount(rec, "food", p);
  const meat = meatOffset(rec, p);
  const eggs = p.chickens ? eggPlan(p).value : 0;
  const veg = p.garden ? gardenGrocery(p) : 0;
  return { meat, eggs, veg, used: Math.min(food * 0.65, meat + eggs + veg), cap: food * 0.65 };
}

type SimResult = {
  balances: number[];
  depletedAge: number | null;
  year0Gross: number;
  year0Tax: number;
  year0Cost: number;
  year0FromSavings: number;
  stranded: number | null;
};


function loanTerms(p: Params, land: number) {
  if (!p.finance || land <= 0) return { financed: 0, payment: 0, years: 0, interest: 0 };
  const financed = land * (1 - Math.min(100, Math.max(0, p.downPct)) / 100);
  const n = Math.max(1, Math.round(p.loanYears));
  const r = p.loanRate / 100;
  const payment = r > 0 ? (financed * r) / (1 - Math.pow(1 + r, -n)) : financed / n;
  return { financed, payment, years: n, interest: payment * n - financed };
}

type SimAdjust = { spendCut?: number; extraIncome?: number; incomeUntil?: number };

function simulate(
  p: Params,
  rec: Record<string, number>,
  upfront: number,
  inflationPct: number,
  collapseAge: number | null,
  land: number,
  adjust?: SimAdjust,
): SimResult {
  const loan = loanTerms(p, land);
  const r401 = (p.ret ?? 0) / 100;
  const rCash = (p.cashReturn ?? 0) / 100;
  const inf = inflationPct / 100;
  const cliff = acaCliff(p);
  const egg = nestEgg(p);
  let balance = egg.k401;
  let cash = egg.savings;
  let year0Gross = 0;
  let year0Tax = 0;
  let year0Cost = 0;
  let year0FromSavings = 0;
  let depletedAge: number | null = null;
  let stranded: number | null = null;
  const balances: number[] = [];

  if (isLump(p)) {
    year0Gross = egg.k401;
    year0Tax = lumpSumTax({ ...p, k401: egg.k401 }).total;
    balance = egg.k401 - year0Tax + cash;
    cash = 0;
  }

  for (let age = startAge(p); age <= END_AGE; age++) {
    const t = age - startAge(p);
    if (collapseAge !== null && age >= collapseAge) {
      if (stranded === null) stranded = Math.max(0, balance + cash);
      balances.push(Math.max(0, balance + cash));
      continue;
    }
    const f = Math.pow(1 + inf, t);
    const ssFactor = p.ssCut && p.startYear + t >= EST.ssCutYear ? EST.ssCutPct / 100 : 1;
    const bonus = adjust?.extraIncome && age <= (adjust.incomeUntil ?? -1) ? adjust.extraIncome : 0;
    const income =
      (age >= p.ssAge ? p.ssMonthly * 12 * f * ssFactor : 0) + (age < p.otherUntil ? p.otherIncome : 0) + bonus;
    const extra = (t === 0 ? upfront - loan.financed : 0) + (t < loan.years ? loan.payment : 0);

    if (isLump(p)) {
      const unsub = t === 0 || (t === 1 && p.strategy === "split") || balance * rCash > cliff;
      const living = annualCost(rec, age, p, unsub) * f;
      const cost = living - Math.min(living, Math.max(0, adjust?.spendCut ?? 0) * f);
      if (t === 0) year0Cost = cost;
      const after = balance - (cost - income + extra);
      balance = after > 0 ? after * (1 + rCash) : after;
    } else {
      const inTexas = t === 0 && p.txMove;
      const plan = (unsub: boolean) => {
        const living = annualCost(rec, age, p, unsub) * f;
        const gross = living - Math.min(living, Math.max(0, adjust?.spendCut ?? 0) * f) - income + extra;
        const fromCash = Math.min(cash, Math.max(0, gross));
        const need = gross - fromCash;
        const w = need > 0 && balance > 0 ? grossUp(need, p, age, inTexas) : 0;
        return { gross, fromCash, need, w };
      };
      let s = plan(false);
      if (s.w > cliff) s = plan(true);
      if (t === 0) {
        year0Gross = s.w;
        year0Tax = s.w > 0 ? s.w - s.need : 0;
        year0Cost = s.gross + income - extra;
        year0FromSavings = s.fromCash;
      }
      cash -= s.fromCash;
      if (s.gross < 0) cash += -s.gross;
      const after = balance - (balance > 0 ? s.w : Math.max(0, s.need));
      balance = after > 0 ? after * (1 + r401) : after;
      cash *= 1 + rCash;
    }
    const total = balance + cash;
    if (total <= 0 && depletedAge === null) depletedAge = age;
    balances.push(total);
  }
  return { balances, depletedAge, year0Gross, year0Tax, year0Cost, year0FromSavings, stranded };
}

const covers = (sim: SimResult, goal: number) => sim.depletedAge === null || sim.depletedAge > goal;

function leastThatCovers(probe: (n: number) => boolean): number | null {
  if (probe(0)) return 0;
  let hi = 1000;
  for (let i = 0; i < 18 && !probe(hi); i++) hi *= 2;
  if (!probe(hi)) return null;
  let lo = 0;
  for (let i = 0; i < 28; i++) {
    const mid = (lo + hi) / 2;
    if (probe(mid)) hi = mid;
    else lo = mid;
  }
  return Math.ceil(hi);
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
  const [text, setText] = useState(String(value));
  useEffect(() => {
    setText((t) => (t === "" ? (value === 0 ? "" : String(value)) : Number(t) === value ? t : String(value)));
  }, [value]);
  return (
    <TextInput
      type="number"
      value={text}
      onChange={(v) => {
        setText(v);
        const n = Number(v);
        if (v !== "" && Number.isFinite(n)) onChange(n);
        else if (v === "") onChange(0);
      }}
      style={{ width }}
    />
  );
}

const TIPS: Record<string, string> = {
  State:
    "Where you'll buy. Sets the land price, property tax, heating, game, state income tax and every state-specific note. Your other edits stay.",
  "Acres you're buying":
    "Size of the property in the plan. The same acreage is kept inside the Land search minimum and maximum. The land cost is the Land search maximum, not acres times the state's price per acre.",
  "Adults in household":
    "People living there. Groceries, health insurance, Medicare, out-of-pocket medical and household costs are per person. Two or more adults switches filing status to married, joint.",
  "Age you are now":
    "Your age this year. Retirement age stays this many years ahead of the retirement year, and the 401(k) catch-up limit uses it.",
  "Retirement age":
    "The age you leave your job and the plan starts. Changing it moves the retirement year. The Rule of 55 needs you to be 55 or older that year. Medicare still starts at 65, and Social Security no earlier than 62.",
  "Money needs to last through age":
    "The age you still want money left. The plan then shows the monthly spending cut, or the extra yearly income, that gets you there with everything else unchanged.",
  "Year you retire": "The calendar year the plan starts. Changing it moves retirement age. Pay and contributions count for each year before this one, and it times the Social Security cut scenario.",
  "Wages until you retire, $/yr":
    "Gross pay from the job you still have, for each year before the retirement year. The part you don't contribute or save is your cost of living now and is not spent by the plan.",
  "401(k) contribution, $/yr":
    "Pre-tax amount added to the 401(k) each working year, including employer match. The 2026 employee limit is $23,500, or $31,000 at age 50 and older. Match can go above that.",
  "Saved from wages, $/yr":
    "After-tax dollars from pay that you put into other savings each working year. The plan spends these before the 401(k).",
  "401(k) balance":
    "What the 401(k) or traditional IRA is worth today. It keeps growing, and contributions are added, until the year you retire. Every dollar you later take out is taxed as ordinary income.",
  "Other savings (cash, brokerage, Roth)":
    "Money outside the 401(k): bank accounts, a brokerage account, a Roth IRA. With \"As needed\" withdrawals the plan spends this first because it comes out tax-free.",
  "Filing status":
    "Single or married filing jointly. It sets the federal tax brackets and standard deduction.",
  Withdrawal:
    "All at once: take the whole 401(k) in year one and pay tax on it in one high-bracket year. Split: half in December, half in January, so two lower-bracket years. As needed: take only what you spend each year, which costs the least tax and keeps ACA subsidies.",
  "First withdrawal while a Texas resident":
    "Take the year-one withdrawal before you move. Texas has no income tax, and other states can't tax retirement income paid to a non-resident.",
  "Rule of 55 (no 10% penalty)":
    "Leave your job in or after the year you turn 55 and you can withdraw from that employer's 401(k) without the 10% early-withdrawal penalty. Income tax still applies. Rolling it to an IRA first loses this until 59½.",
  "Seller-finance the land":
    "The seller acts as the bank: you put money down and pay them yearly. It spreads the land cost out so less of it lands in one big taxable withdrawal year.",
  "Down payment, %": "Share of the land price paid up front. Rural sellers typically ask 10–20%.",
  "Interest rate, %": "Seller-financed land typically runs 6–9%.",
  "Loan length, years": "Typical seller financing is 5–15 years, sometimes with a balloon payment due early.",
  "Social Security, $/mo":
    "The monthly check at the claim age beside it. Changing that age recalculates this from the same full benefit. Type a new amount to set the benefit at the age shown. Get the real figure from your my Social Security account at ssa.gov.",
  "Social Security, $/mo combined":
    "Combined monthly check for the household at the claim age beside it. Changing that age recalculates this from the same full benefit. Get real figures from my Social Security at ssa.gov.",
  "Claim Social Security at age":
    "Any age from 62 to 70. 62 pays 70% of the full benefit when full retirement age is 67, 65 pays about 86.7%, 67 pays 100%, and 70 pays 124%. The monthly amount updates when you change this.",
  "Part-time income, $/yr": "Any work income after you retire, counted until the age below.",
  "Part-time work until age": "The last age the part-time income is counted.",
  "401(k) growth while working, %":
    "Yearly growth on the 401(k) until you withdraw it, and on money that stays in the 401(k) when withdrawals are As needed. 4% is a conservative stock-and-bond mix. This does not grow the cash left after you take the money out.",
  "Interest on cash after withdrawal, %":
    "Yearly interest on cash after an All at once or Split withdrawal, and on other savings. Leave this at 0 if the money sits in checking. It is separate from 401(k) growth.",
  Home:
    "Used RV keeps the trailer as the house. Small house / shelter replaces it with a shell, a wood stove, and wiring, and drops the RV, the RV pedestal, the RV replacement fund, and the backup cabin. Well, septic, and power stay on their own lines.",
  "Inflation, %": "How fast living costs rise each year. Social Security rises with it (COLA).",
  "Contingency on costs, %":
    "A cushion added on top of all yearly living costs for surprises. Set it to 0 if your numbers already include one.",
  "Full-price ACA insurance (no subsidy), $/yr per person":
    "ACA is Affordable Care Act marketplace insurance (healthcare.gov), the usual coverage before Medicare at 65. Subsidies cut the premium based on your income. \"Unsubsidized\" is the full price you pay in a year your income is too high for a subsidy, such as a big 401(k) withdrawal year. About $11,000 a year for a 58-year-old's silver plan.",
  "Collapse happens at age":
    "For the failed-state scenario: the age when bills, Social Security and the value of money all stop.",
  "Power setup":
    "How the land gets electricity: a co-op grid line, grid plus solar and battery, or fully off-grid. It changes setup costs and the yearly power bill.",
  "Heat with":
    "Propane, a wood stove with propane backup, or wood only. Wood is far cheaper if you cut it yourself, but it's real work.",
  "Include collapse-hardening build":
    "Adds the grid-down items: hand pump, solar, food storage, rain catchment, medical and radios. With an RV it also adds the backup cabin. A small house already takes the place of that cabin.",
  "Hunt for meat": "Counts hunting gear costs and subtracts the meat you take from the grocery bill.",
  "Chickens for eggs":
    "Adds a coop and a fenced run, yearly feed, and the eggs those hens replace at the grocery store. Turn it off if you won't lock them up every night.",
  Hens: "About 4 to 6 hens per person. More birds means more feed and more to count at dusk. Changing this updates the yearly chicken line.",
  "Eggs at the store, $/dozen": "What a dozen eggs costs you at the store. Used only to value the eggs your hens replace.",
  "Vegetable garden":
    "Adds the fence, drip line and yearly seed, and subtracts the produce that garden replaces. The fence is what keeps deer from eating it.",
  "Produce the garden replaces, $/yr":
    "Grocery dollars of vegetables an average year replaces, for one adult. A second adult raises it. A drought, hail or an open gate makes it zero in real life. The plan still leaves most of the grocery bill.",
  "Elk taken per year": "Where elk live, one elk is about four deer's worth of meat.",
  "Deer taken per year": "Each deer is about 45 lb of boneless meat (editable under Estimates).",
  "Hogs taken per year": "Feral hogs, where they exist. Each gives meat plus lard, the fat lean venison lacks.",
  "Store meat value, $/lb": "What the meat would cost at the store, used to value the grocery savings.",
  "Propane, $/gal": "What you pay per gallon delivered to your own tank.",
  "Firewood you cut, $/cord": "Saw gas, chains and bar oil per cord when you cut your own.",
  "Firewood bought, $/cord": "Price per cord of split firewood where your land has few trees.",
  "Social Security cut starts in": "The year a trust-fund shortfall would cut benefits if Congress does nothing.",
  "Benefits paid after the cut, %": "Share of promised benefits still paid after the cut. Trustees project roughly 77–81%.",
  "High-inflation scenario, %": "The inflation rate used for the \"High inflation\" chart line.",
};

function Tip({ text, children }: { text: string; children: ReactNode }) {
  return (
    <span className="tip" tabIndex={0} data-tip={text}>
      {children}
    </span>
  );
}

function Field({
  label,
  tip,
  children,
}: {
  label: string;
  tip?: string;
  children: Parameters<typeof Row>[0]["children"];
}) {
  const text = tip ?? TIPS[label] ?? (label.startsWith("Social Security cut to") ? TIPS.ssCutToggle : undefined);
  return (
    <Row gap={8} align="center" justify="space-between">
      <Text size="small" tone="secondary">
        {text ? <Tip text={text}>{label}</Tip> : label}
      </Text>
      {children}
    </Row>
  );
}

const REC_TIPS: Record<string, string> = {
  aca: "ACA marketplace health insurance (healthcare.gov) before Medicare. This is the subsidized price in low-income years. In a year your income passes 400% of the poverty line, the plan uses the full price from Assumptions instead.",
  medicare: "From 65: Medicare Part B premium, a Medigap Plan G supplement and a Part D drug plan. A $0-premium Medicare Advantage plan costs less but limits your doctors.",
  oop: "What insurance doesn't cover: dental, glasses, prescription copays.",
  liability: "Covers someone getting hurt on your land, plus the barn and outbuildings.",
  rvins: "A full-timer policy, which covers the RV as your home with liability, unlike a recreational RV policy.",
  rvreserve: "Money set aside each year to replace the RV when it wears out, typically every 10–15 years.",
  sos: "Satellite messenger subscription (Garmin inReach or similar) so you can call for help with no cell signal.",
  maint: "Repairs on the RV, tractor, chainsaw, generator and truck.",
  proptax: "County property tax on the land and anything permanent you build.",
  hoa: "Yearly dues for an HOA or a road association. On a parcel you chose in Land search, this is the same number as that listing's dues.",
  chickens: "Layer feed, grit, oyster shell, bedding and two replacement hens a year. About $58 per hen. Table scraps lower it. A dead flock does not.",
  garden: "Seed, compost or fertilizer, drip parts, row cover and canning lids. The fence is in the one-time garden line, not here.",
};

TIPS.ssCutToggle =
  "Applies the Social Security cut scenario to the whole plan. Off, it's still shown as a separate line on the chart.";

export type { StateId };
export { STATES, STATE_IDS };

function readStored<T extends object>(key: string, defaults: T): T {
  try {
    const raw = localStorage.getItem(`retreat-planner:${key}`);
    return raw ? { ...defaults, ...JSON.parse(raw) } : { ...defaults };
  } catch {
    return { ...defaults };
  }
}

export function loadListingIntoPlan(state: StateId | null, price: number, acres: number, listing?: ListingDeedSource) {
  let p = readStored<Params>("params-v2", DEFAULT_PARAMS);
  let up = readStored<Record<string, number>>("upfront-v2", PRESET_PLANNED);
  let rec = readStored<Record<string, number>>("recurring-v2", RECURRING_DEFAULTS);
  EST = mergeEst(readStored<Partial<Estimates>>("estimates-v1", {}));
  if (acres > 0) {
    EST = { ...EST, acres };
    localStorage.setItem("retreat-planner:estimates-v1", JSON.stringify(EST));
  }
  if (state && STATES[state]) [p, up, rec] = applyState(state, p, up, rec);
  up = { ...up, land: Math.round(price) };
  if (listing) {
    const deed = deedOf(listing.deed);
    const chosen: ChosenLand = {
      id: listing.id,
      name: listing.name,
      url: listing.url,
      county: listing.check?.county,
      stateCode: listing.check?.stateCode,
      price: listing.price,
      acres: listing.acres,
      deed,
    };
    localStorage.setItem("retreat-planner:chosen-land-v1", JSON.stringify(chosen));
    rec = { ...rec, hoa: deed.hoa === "yes" ? Math.round(deed.hoaDues) : 0 };
  }
  localStorage.setItem("retreat-planner:params-v2", JSON.stringify(p));
  localStorage.setItem("retreat-planner:upfront-v2", JSON.stringify(up));
  localStorage.setItem("retreat-planner:recurring-v2", JSON.stringify(rec));
  patchLinkedLand({
    priceMax: Math.max(0, Math.round(price)),
    ...(state && STATES[state] ? { state, counties: DEFAULT_COUNTIES[state] } : {}),
  });
  if (acres > 0) expandAcreRange(acres);
}

/** Copy the saved land search onto the plan: state, acreage, and the price maximum. */
export function publishLandSearch() {
  const c = readLinkedLand();
  if (!c.saved) return;
  let p = readStored<Params>("params-v2", DEFAULT_PARAMS);
  let up = readStored<Record<string, number>>("upfront-v2", PRESET_PLANNED);
  let rec = readStored<Record<string, number>>("recurring-v2", RECURRING_DEFAULTS);
  EST = mergeEst(readStored<Partial<Estimates>>("estimates-v1", {}));
  const id = (c.state && STATES[c.state as StateId] ? c.state : stateOf(p)) as StateId;
  if (id !== stateOf(p)) [p, up, rec] = applyState(id, p, up, rec);
  up = { ...up, land: Math.max(0, Math.round(c.priceMax)) };
  EST = { ...EST, acres: clampAcresToRange(c.acresMin, c.acresMax) };
  localStorage.setItem("retreat-planner:params-v2", JSON.stringify(p));
  localStorage.setItem("retreat-planner:upfront-v2", JSON.stringify(up));
  localStorage.setItem("retreat-planner:estimates-v1", JSON.stringify(EST));
  localStorage.setItem("retreat-planner:recurring-v2", JSON.stringify(rec));
}

/** Land search changed state. Keep the land budget and refresh the state-specific costs. */
export function applyLinkedState(id: StateId) {
  let p = readStored<Params>("params-v2", DEFAULT_PARAMS);
  let up = readStored<Record<string, number>>("upfront-v2", PRESET_PLANNED);
  let rec = readStored<Record<string, number>>("recurring-v2", RECURRING_DEFAULTS);
  EST = mergeEst(readStored<Partial<Estimates>>("estimates-v1", {}));
  const budget = up.land;
  if (STATES[id]) [p, up, rec] = applyState(id, p, up, rec);
  up = { ...up, land: budget };
  localStorage.setItem("retreat-planner:params-v2", JSON.stringify(p));
  localStorage.setItem("retreat-planner:upfront-v2", JSON.stringify(up));
  localStorage.setItem("retreat-planner:recurring-v2", JSON.stringify(rec));
  patchLinkedLand({ state: id, counties: DEFAULT_COUNTIES[id] });
}

export default function RetreatPlan({ part = "plan" }: { part?: "plan" | "sustain" }) {
  const [storedP, setP] = useCanvasState<Params>("params-v2", DEFAULT_PARAMS);
  const [storedUp, setUp] = useCanvasState<Record<string, number>>("upfront-v2", PRESET_PLANNED);
  const [storedRec, setRec] = useCanvasState<Record<string, number>>("recurring-v2", RECURRING_DEFAULTS);
  const ageNow = ageNowFrom(storedP);
  const p: Params = { ...DEFAULT_PARAMS, ...storedP, ageNow };
  const up: Record<string, number> = { ...PRESET_PLANNED, ...storedUp };
  const rec: Record<string, number> = { ...RECURRING_DEFAULTS, ...storedRec };
  useEffect(() => {
    if (storedUp.coop !== undefined && storedRec.chickens !== undefined) return;
    if (storedUp.coop === undefined) {
      const g = storedUp.garden;
      setUp((prev) =>
        g === 4000
          ? { ...prev, garden: 800, coop: 2200, plot: 1600 }
          : g === 2000
            ? { ...prev, garden: 400, coop: 1100, plot: 700 }
            : { ...prev, coop: prev.coop ?? 2200, plot: prev.plot ?? 1600 },
      );
    }
    if (storedRec.chickens === undefined) {
      const g = storedRec.garden ?? 0;
      if (g >= 500) {
        setRec((prev) => ({ ...prev, garden: Math.round(g * 0.45), chickens: Math.round(g * 0.55) }));
      }
    }
  }, []);
  const [storedEst, setStoredEst] = useCanvasState<Partial<Estimates>>("estimates-v1", {});
  const [chosenStored, setChosen] = useCanvasState<ChosenLand | null>("chosen-land-v1", null);
  const [landListings, setLandListings] = useCanvasState<ListingDeedSource[]>("land-listings-v1", []);
  const chosen = resolveChosen(chosenStored, landListings);
  EST = mergeEst(storedEst);
  const est = EST;
  const [linked, setLinked] = useState<LinkedLand>(() => readLinkedLand());
  const AFFECTS: Record<string, { up?: Array<"land" | "winter" | "woodheat">; rec?: Array<"propane" | "firewood" | "proptax"> }> = {
    landPerAcre: { up: ["land"] },
    winterShelter: { up: ["winter"] },
    stove: { up: ["woodheat"] },
    propanePrice: { rec: ["propane"] },
    propaneGal: { rec: ["propane"] },
    baseGal: { rec: ["propane"] },
    firewoodOwn: { rec: ["firewood"] },
    firewoodBuy: { rec: ["firewood"] },
    cords: { rec: ["firewood"] },
    propTax: { rec: ["proptax"] },
  };
  const updateEst = (next: Estimates, key: string, current: boolean) => {
    EST = next;
    setStoredEst(next);
    const a = AFFECTS[key];
    if (!a || !current) return;
    const d = derivedForState(stateOf(p), p.heat ?? "propane");
    if (a.up) {
      const patch = Object.fromEntries(a.up.map((k) => [k, d.up[k]]));
      setUp((prev) => ({ ...prev, ...patch }));
      if (a.up.includes("land")) {
        const price = Math.max(0, Math.round(d.up.land));
        patchLinkedLand({ priceMax: price });
        setLinked((prev) => ({ ...prev, priceMax: price, saved: true }));
      }
    }
    if (a.rec) setRec((prev) => ({ ...prev, ...Object.fromEntries(a.rec!.map((k) => [k, d.rec[k]])) }));
  };
  const setEst = <K extends Exclude<keyof Estimates, "states">>(k: K, v: number) =>
    updateEst({ ...est, [k]: v }, k, true);
  const setStateEst = (id: StateId, k: keyof StateEst, v: number) =>
    updateEst({ ...est, states: { ...est.states, [id]: { ...est.states[id], [k]: v } } }, k, id === stateOf(p));
  const resetEst = () => {
    EST = DEFAULT_EST;
    setStoredEst({});
    const d = derivedForState(stateOf(p), p.heat ?? "propane");
    setUp((prev) => ({ ...prev, ...d.up }));
    setRec((prev) => ({ ...prev, ...d.rec }));
    const price = Math.max(0, Math.round(d.up.land));
    const range = expandAcreRange(DEFAULT_EST.acres);
    patchLinkedLand({ priceMax: price, ...range });
    setLinked((prev) => ({ ...prev, priceMax: price, ...range, saved: true }));
  };
  const setAcres = (n: number) => {
    const acres = Math.max(0, Math.round(n));
    updateEst({ ...est, acres }, "acres", false);
    const range = expandAcreRange(acres);
    setLinked((prev) => ({ ...prev, ...range, saved: true }));
  };

  const set = <K extends keyof Params>(k: K, v: Params[K]) => setP((prev) => ({ ...prev, [k]: v }));
  const setSsMonthly = (n: number) =>
    setP((prev) => {
      const now = ageNowFrom(prev);
      const age = clampSsAge(prev.ssAge ?? 67);
      const monthly = Math.max(0, Math.round(Number.isFinite(n) ? n : 0));
      const factor = ssBenefitFactor(age, fraMonths(THIS_YEAR - now));
      return { ...prev, ssAge: age, ssMonthly: monthly, ssPia: factor > 0 ? monthly / factor : 0 };
    });
  const setSsAge = (n: number) =>
    setP((prev) => {
      const now = ageNowFrom(prev);
      const age = clampSsAge(n);
      const pia = ssPiaOf(prev, now);
      return { ...prev, ssAge: age, ssPia: pia, ssMonthly: ssMonthlyAt(pia, age, now) };
    });
  const setAgeNow = (n: number) => setP((prev) => linkAges(prev, "now", n));
  const setRetireAge = (n: number) => setP((prev) => linkAges(prev, "retire", n));
  const setStartYear = (n: number) => setP((prev) => linkAges(prev, "year", n));
  const st = STATES[stateOf(p)];
  const pickState = (id: StateId) => {
    const [np, nu, nr] = applyState(id, p, up, rec);
    const budget = up.land ?? nu.land;
    setP(np);
    setUp({ ...nu, land: budget });
    setRec(nr);
    const counties = DEFAULT_COUNTIES[id] ?? "";
    patchLinkedLand({ state: id, counties });
    setLinked((prev) => ({ ...prev, state: id, counties, saved: true }));
  };
  useEffect(() => {
    const c = readLinkedLand();
    if (!c.saved) return;
    const budget = Math.max(0, Math.round(c.priceMax));
    const id = (c.state && STATES[c.state as StateId] ? c.state : stateOf(p)) as StateId;
    let nextRec = rec;
    if (id !== stateOf(p)) {
      const [np, nu, nr] = applyState(id, p, up, rec);
      nextRec = nr;
      setP(np);
      setUp({ ...nu, land: budget });
    } else if (budget !== Math.round(up.land ?? 0)) {
      setUp((prev) => ({ ...prev, land: budget }));
    }
    const nextAcres = clampAcresToRange(c.acresMin, c.acresMax);
    if (nextAcres !== est.acres) updateEst({ ...est, acres: nextAcres }, "acres", false);
    const live = resolveChosen(chosenStored, landListings);
    if (live) {
      const dues = live.deed.hoa === "yes" ? Math.round(live.deed.hoaDues) : 0;
      if ((nextRec.hoa ?? 0) !== dues) nextRec = { ...nextRec, hoa: dues };
    }
    if (nextRec !== rec) setRec(nextRec);
    setLinked(c);
    // Once per visit: a land search saved earlier becomes the plan's state, acres, and land cost.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const applyPreset = (preset: Record<string, number>) =>
    setUp({
      ...preset,
      land: up.land ?? preset.land,
      winter: up.winter ?? 0,
      woodheat: up.woodheat ?? 0,
      ...(p.powerMode === "grid" ? {} : { power: up.power ?? 0, offgrid: up.offgrid ?? 0 }),
    });
  const pickPower = (mode: PowerMode) => {
    const m = POWER[mode];
    set("powerMode", mode);
    setUp((prev) => ({ ...prev, power: m.power, offgrid: m.offgrid }));
    setRec((prev) => ({ ...prev, electric: m.electric }));
  };
  const heat = p.heat ?? "propane";
  const hp = heatPlan(stateOf(p), heat);
  const loc = LOCAL[stateOf(p)];
  const pickHeat = (mode: HeatMode) => {
    const h = heatPlan(stateOf(p), mode);
    set("heat", mode);
    setUp((prev) => ({ ...prev, woodheat: h.stove }));
    setRec((prev) => ({ ...prev, propane: Math.round(h.propaneGal * EST.propanePrice), firewood: h.firewood }));
  };
  const applyLiving = (id: LivingPreset) => setRec((prev) => ({ ...prev, ...LIVING_PRESETS[id].values }));
  const setFlock = (hens: number) => {
    const n = Math.max(0, Math.round(hens));
    if (n <= 0) {
      set("chickens", false);
      return;
    }
    setP((prev) => ({ ...prev, chickens: true, hens: n }));
    setRec((prev) => ({ ...prev, chickens: chickenUpkeep(n) }));
    setUp((prev) => {
      if (n >= 10 && (prev.coop ?? 2200) === 2200) return { ...prev, coop: 2800 };
      if (n < 10 && prev.coop === 2800) return { ...prev, coop: 2200 };
      return prev;
    });
  };
  const setGardenSize = (size: "off" | "kitchen" | "calorie") => {
    if (size === "off") {
      set("garden", false);
      return;
    }
    setP((prev) => ({ ...prev, garden: true, gardenSave: size === "kitchen" ? 700 : 1400 }));
    setUp((prev) => ({ ...prev, plot: size === "kitchen" ? 1600 : 3200 }));
    setRec((prev) => ({ ...prev, garden: size === "kitchen" ? 350 : 600 }));
  };
  const gardenSize = !p.garden ? "off" : (up.plot ?? 0) >= 2500 ? "calorie" : "kitchen";
  const flockSize = !p.chickens ? "off" : (p.hens ?? 6) >= 10 ? "large" : "small";
  const recLabel = (item: RecurringItem) => {
    if (item.id === "propane")
      return `Propane (~${hp.propaneGal.toLocaleString("en-US")} gal/yr at $${EST.propanePrice.toFixed(2)}: ${heat === "propane" && housingOf(p) === "rv" ? "RV furnace, cooking, hot water" : heat === "both" ? "cooking, hot water, cold-snap backup" : heat === "wood" ? "cooking, hot water, fridge" : "furnace, cooking, hot water"})`;
    if (item.id === "rvins" && housingOf(p) === "house") return "Dwelling insurance (the small house)";
    if (item.id === "maint" && housingOf(p) === "house") return "House, tractor, equipment repairs";
    if (item.id === "firewood")
      return loc.ownWood
        ? `Firewood (~${hp.cords} cords/yr cut from your land: saw gas, chains, bar oil)`
        : `Firewood (~${hp.cords} cords/yr bought at ~$${EST.firewoodBuy}/cord)`;
    if (item.id === "chickens")
      return `Chickens: feed, bedding, replacement hens (${eggs.hens} hens, about ${money(chickenUpkeep(1))} each)`;
    return item.label;
  };
  const upNote = (u: UpfrontItem) => {
    if (u.id === "offgrid") return POWER[p.powerMode]?.solarNote ?? u.note;
    if (u.id === "well") return loc.well;
    if (u.id === "septic") return loc.septic;
    if (u.id === "pad") return loc.pad;
    if (u.id === "woodheat")
      return heat === "propane"
        ? `Set "Heat with" to wood to add this. ${loc.woodNote}`
        : `${st.winterShelter > 0 ? "Goes in the insulated shelter" : "A small RV-rated stove, or one in the cabin"}. ${loc.woodNote}`;
    if (u.food === "chickens" && !p.chickens) return `Turn chickens on to count this. ${u.note}`;
    if (u.food === "garden" && !p.garden) return `Turn the garden on to count this. ${u.note}`;
    return u.note;
  };

  const setYearly = (id: string, yearly: number) => {
    const amount = Math.round(yearly);
    setRec((prev) => ({ ...prev, [id]: amount }));
    if (id !== "hoa" || !chosenStored) return;
    const dues = Math.max(0, amount);
    const stamp = (deed: ReturnType<typeof deedOf>) => ({
      ...deed,
      hoaDues: dues,
      hoa: dues > 0 ? ("yes" as const) : deed.hoa,
    });
    setLandListings((prev) =>
      prev.map((l) => (l.id === chosenStored.id ? { ...l, deed: stamp(deedOf(l.deed)) } : l)),
    );
    setChosen((prev) => (prev ? { ...prev, deed: stamp(deedOf(prev.deed)) } : prev));
  };

  const stateRows = STATE_IDS.map((id) => {
    const [sp, su, sr] = applyState(id, p, up, rec);
    if (id === stateOf(p)) su.land = up.land ?? su.land;
    const total = upfrontTotalFor(sp, su);
    const sim = simulate(sp, sr, total, sp.inflation, null, su.land ?? 0);
    return {
      id,
      s: STATES[id],
      land: su.land ?? 0,
      total,
      lumpStateTax: Math.round(lumpSumTax({ ...sp, k401: nestEgg(sp).k401, txMove: false }).ok),
      heating: (sr.propane ?? 0) + (sr.firewood ?? 0),
      cost: annualCost(sr, 60, sp, false),
      lasts: sim.depletedAge,
    };
  });

  const groupTotal = (g: Group) =>
    UPFRONT.filter((u) => groupOf(u, p) === g && homeCounted(u, p)).reduce((s, u) => s + upAmount(up, u.id, p), 0);
  const adults = adultsOf(p);
  const who = peopleLabel(adults);
  const coreTotal = groupTotal("core");
  const hardTotal = groupTotal("hardening");
  const huntTotal = groupTotal("hunting");
  const foodSetup = UPFRONT.filter((u) => groupOf(u, p) === "food" && foodCounted(u, p) && homeCounted(u, p)).reduce(
    (s, u) => s + upAmount(up, u.id, p),
    0,
  );
  const upfrontTotal = coreTotal + (p.hardening ? hardTotal : 0) + (p.hunting ? huntTotal : 0) + foodSetup;
  const hunt = huntYield(p);
  const eggs = eggPlan(p);
  const grown = foodOffset(rec, p);
  const offset = meatOffset(rec, p);
  const land = up.land ?? 0;
  const loan = loanTerms(p, land);
  const homeCost =
    housingOf(p) === "house" ? (up.houseShell ?? 0) + (up.houseStove ?? 0) + (up.houseWire ?? 0) : (up.rv ?? 0);
  const landRv = land - loan.financed + homeCost;

  const normal = simulate(p, rec, upfrontTotal, p.inflation, null, land);
  const highInf = simulate(p, rec, upfrontTotal, EST.highInflation, null, land);
  const collapse = simulate(p, rec, upfrontTotal, p.inflation, p.collapseAge, land);
  const ssCutSim = simulate({ ...p, ssCut: true }, rec, upfrontTotal, p.inflation, null, land);
  const noCutSim = simulate({ ...p, ssCut: false }, rec, upfrontTotal, p.inflation, null, land);
  const cashSim = simulate({ ...p, finance: false }, rec, upfrontTotal, p.inflation, null, land);
  const financedSim = simulate({ ...p, finance: true }, rec, upfrontTotal, p.inflation, null, land);
  const loanIfOn = loanTerms({ ...p, finance: true }, land);
  const ssCutYearAge = startAge(p) + (EST.ssCutYear - p.startYear);

  const egg = nestEgg(p);
  const lumpTax = lumpSumTax({ ...p, k401: egg.k401 });
  const lumpTaxAfterMove = lumpSumTax({ ...p, k401: egg.k401, txMove: false });
  const lumpTaxOneYear = lumpSumTax({ ...p, k401: egg.k401, strategy: "lump", txMove: true });
  const lumpTaxSplit = lumpSumTax({ ...p, k401: egg.k401, strategy: "split", txMove: true });
  const withheld = 0.2 * egg.k401;
  const savings = egg.savings;
  const netAfterTax = (isLump(p) ? egg.k401 - normal.year0Tax : egg.k401) + savings;
  const leftAfterSetup = isLump(p)
    ? netAfterTax - (upfrontTotal - loan.financed)
    : egg.k401 - normal.year0Gross + savings - normal.year0FromSavings;
  const noSavingsSim =
    (p.savings ?? 0) > 0 || (p.jobSave ?? 0) > 0
      ? simulate({ ...p, savings: 0, jobSave: 0 }, rec, upfrontTotal, p.inflation, null, land)
      : normal;
  const pm = POWER[p.powerMode] ?? POWER.grid;

  const steadyPre65 = annualCost(rec, 60, p, false);
  const steadyPost65 = annualCost(rec, 66, p, false);
  const ssAnnual = p.ssMonthly * 12;

  const nowAge = ageNowFrom(p);
  const retireAt = startAge(p);
  const planUses = usesForPlan(housingOf(p));
  const ages: string[] = [];
  for (let a = nowAge; a <= END_AGE; a++) ages.push(String(a));
  const beforeWithdrawals: (number | null)[] = [];
  {
    const r401 = (p.ret ?? 0) / 100;
    const rCash = (p.cashReturn ?? 0) / 100;
    let k401 = Math.max(0, p.k401);
    let savingsNow = Math.max(0, p.savings ?? 0);
    const contrib = Math.max(0, p.jobContrib ?? 0);
    const save = Math.max(0, p.jobSave ?? 0);
    for (let age = nowAge; age <= END_AGE; age++) {
      if (age < retireAt) {
        beforeWithdrawals.push(Math.round(k401 + savingsNow));
        k401 = k401 * (1 + r401) + contrib;
        savingsNow = savingsNow * (1 + rCash) + save;
      } else if (age === retireAt) {
        beforeWithdrawals.push(Math.round(egg.k401 + egg.savings));
      } else {
        beforeWithdrawals.push(null);
      }
    }
  }
  const afterLine = (sim: SimResult): (number | null)[] =>
    ages.map((_, i) => {
      const age = nowAge + i;
      if (age < retireAt) return null;
      const v = sim.balances[age - retireAt];
      return v == null ? null : Math.round(v);
    });
  const nestAtRetirement = beforeWithdrawals[retireAt - nowAge];
  const cashAtRetirement = afterLine(normal)[retireAt - nowAge];

  const lastsLabel = (r: SimResult) => (r.depletedAge === null ? `${END_AGE}+` : String(r.depletedAge));
  const goal = goalOf(p);
  const covered = covers(normal, goal);
  const shortfall = !covered;
  const probe = (adjust: SimAdjust) =>
    covers(simulate(p, rec, upfrontTotal, p.inflation, null, land, adjust), goal);
  const spendCut = covered ? 0 : leastThatCovers((n) => probe({ spendCut: n }));
  const extraIncome = covered ? 0 : leastThatCovers((n) => probe({ extraIncome: n, incomeUntil: goal }));
  const cutSim =
    spendCut != null && spendCut > 0
      ? simulate(p, rec, upfrontTotal, p.inflation, null, land, { spendCut })
      : null;
  const cutLasts = cutSim ? lastsLabel(cutSim) : null;
  const cutCarriesFurther = cutSim !== null && (cutSim.depletedAge === null || cutSim.depletedAge > goal + 5);
  const GOAL_AGES = [70, 75, 80, 85, 90, 95];

  const allocTaxes = normal.year0Tax;
  const allocOther = coreTotal - land - homeCost;
  const allocHard = p.hardening ? hardTotal : 0;
  const allocHunt = p.hunting ? huntTotal : 0;
  const allocFood = foodSetup;
  const allocTotal = egg.k401 + savings;
  const allocRemaining = Math.max(0, allocTotal - allocTaxes - landRv - allocOther - allocHard - allocHunt - allocFood);

  const showRec = (id: string) =>
    (id !== "firewood" || heat !== "propane" || (rec.firewood ?? 0) > 0) &&
    (id !== "hunt" || p.hunting) &&
    (id !== "chickens" || p.chickens) &&
    (id !== "garden" || p.garden) &&
    (id !== "rvreserve" || housingOf(p) === "rv");
  const shownRecurring = RECURRING.filter((i) => showRec(i.id));
  const costRows = shownRecurring.map((item) => [
    REC_TIPS[item.id] ? (
      <span key={`${item.id}-l`} className="tip" title={REC_TIPS[item.id]}>
        {recLabel(item)}
      </span>
    ) : (
      recLabel(item)
    ),
    <NumField
      key={`${item.id}-mo`}
      value={Math.round((rec[item.id] ?? 0) / 12)}
      onChange={(n) => setYearly(item.id, n * 12)}
      width={72}
    />,
    <NumField
      key={`${item.id}-yr`}
      value={rec[item.id] ?? 0}
      onChange={(n) => setYearly(item.id, n)}
      width={80}
    />,
    item.rule === "pre65" ? "Until 65" : item.rule === "post65" ? "65+" : "Every year",
    PER_PERSON_RECURRING.has(item.id) && adults > 1 ? money(recAmount(rec, item.id, p)) : "",
  ]);

  const chartItems = RECURRING.filter((i) => i.rule !== "post65" && showRec(i.id))
    .map((i) => ({ label: (i.id === "rvins" && housingOf(p) === "house" ? "Dwelling insurance" : i.label).split(" (")[0], value: recAmount(rec, i.id, p) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const upfrontTable = (group: Group) => (
    <Table
      headers={["Item", "Cost", "Why"]}
      columnAlign={["left", "right", "left"]}
      rows={UPFRONT.filter((u) => groupOf(u, p) === group && homeCounted(u, p)).map((u) => [
        u.id === "land" ? `Land, ${est.acres} acres` : u.label,
        <NumField
          key={u.id}
          value={up[u.id] ?? 0}
          onChange={(n) => {
            setUp((prev) => ({ ...prev, [u.id]: n }));
            if (u.id !== "land") return;
            const price = Math.max(0, Math.round(n));
            patchLinkedLand({ priceMax: price });
            setLinked((prev) => ({ ...prev, priceMax: price, saved: true }));
          }}
          width={88}
        />,
        <Text size="small" tone="tertiary">
          {upNote(u)}
        </Text>,
      ])}
    />
  );

  return (
    <Stack gap={20}>
      {part !== "sustain" && (
      <>
      <Stack gap={6}>
        <H1>{st.name} land retreat: retirement cash plan</H1>
        <Text tone="secondary">
          Household of {who}, age {ageNowFrom(p)}, retiring at {startAge(p)} in {p.startYear}, living in {housingOf(p) === "house" ? "a small house" : "an RV"} on {est.acres} acres
          in {st.name}
          {linked.saved ? `, the same place Land search is using (${linked.counties})` : ""}. Land is budgeted at {money(land)}
          {linked.saved ? `, the Land search maximum` : ""}. Costs
          marked "per person" scale with the household size in Assumptions. Every number with a box is editable, and
          the charts recompute as you type. Taxes use 2026 federal brackets plus {st.name} state tax (
          {st.taxNote})
          {p.txMove ? ", except that the first year's withdrawal is taken while you're still a Texas resident" : ""}.
          These are planning estimates, not tax advice. Chickens, the garden, hunting, water and the grid-down plan are on the Self-reliance tab. The switches here still change those costs.
        </Text>
      </Stack>

      <Callout tone={shortfall ? "danger" : "success"} title={`Normal economy: money lasts to age ${lastsLabel(normal)}`}>
        {p.strategy === "lump"
          ? `Taking the full ${money(egg.k401)} in one year costs about ${money(normal.year0Tax)} in tax, which is more than the ${housingOf(p) === "house" ? "house" : "RV"}. `
          : p.strategy === "split"
          ? `Splitting the ${money(egg.k401)} across two tax years (December and January) costs about ${money(normal.year0Tax)} in tax. `
          : `Withdrawing as needed, year one still costs about ${money(normal.year0Tax)} in tax because the setup spending lands in that year. `}
        {`After ${money(upfrontTotal)} of land and setup, the household spends about ${money(steadyPre65)}/yr before 65`}
        {ssAnnual > 0
          ? `, with Social Security covering ${money(ssAnnual)}/yr starting at ${p.ssAge}.`
          : ", with no Social Security counted."}
        {shortfall
          ? ` Under these assumptions it runs out at ${lastsLabel(normal)}, before your target of ${goal}. What it takes to get there is just below.`
          : ` That covers your target of ${goal}.`}
      </Callout>

      <Stack gap={8}>
        <Row gap={8} wrap align="center">
          <Text size="small" tone="secondary">
            Need the money to last through age
          </Text>
          {GOAL_AGES.map((age) => (
            <Pill key={age} size="sm" active={goal === age} onClick={() => set("goalAge", age)}>
              {age}
            </Pill>
          ))}
        </Row>
        <Callout
          tone={covered ? "success" : "warning"}
          title={covered ? `Covered through age ${goal}` : `Runs out at ${lastsLabel(normal)}, short of ${goal}`}
        >
          {covered
            ? `With the numbers entered now, money lasts to age ${lastsLabel(normal)}. Pick a later age to see what that would take.`
            : `That's ${goal - (normal.depletedAge ?? goal)} years early. Keeping everything else the same, either of these closes the gap:`}
          {!covered && (
            <Stack gap={4} style={{ marginTop: 6 }}>
              <Text size="small">
                {spendCut === null
                  ? "Spending less can't fix it. Even with living costs at $0, setup and taxes spend the account in the first years. Switch Withdrawal to \"As needed\", trim the setup, or add savings."
                  : `Spend ${money(spendCut / 12)} less per month, leaving about ${money(Math.max(0, steadyPre65 - spendCut) / 12)}/mo before 65. Both figures are today's dollars, and the cut rises with inflation.${cutCarriesFurther ? ` That same cut actually lasts to ${cutLasts}: this plan fails in the first years, and covering those covers the later ones too.` : ""}`}
              </Text>
              <Text size="small">
                {extraIncome === null
                  ? "Extra income can't fix it either, for the same reason: the account is gone before the income can refill it."
                  : `Or earn ${money(extraIncome)} more per year until age ${goal}, on top of any part-time income already entered. Type it into "Part-time income" and set "Part-time work until age" to ${goal}.`}
              </Text>
            </Stack>
          )}
        </Callout>
      </Stack>

      {egg.years > 0 && (
        <Callout tone="info" title={`Working until ${p.startYear}`}>
          {egg.years === 1
            ? `One year of pay before retirement, during ${THIS_YEAR}.`
            : `${egg.years} years of pay before retirement, ${THIS_YEAR} through ${p.startYear - 1}.`}{" "}
          Nothing is withdrawn until then. The 401(k) goes from {money(p.k401)} today to{" "}
          {money(egg.k401)}, with {money(egg.contrib)} a year contributed and {p.ret}% growth. Other savings go from{" "}
          {money(p.savings ?? 0)} to {money(egg.savings)}, with {money(egg.save)} a year saved and {p.cashReturn ?? 0}% interest.{" "}
          {(p.jobPay ?? 0) > 0 && egg.contrib + egg.save > (p.jobPay ?? 0)
            ? `Contributions plus savings add up to more than the ${money(p.jobPay)} wage.`
            : "The rest of the paycheck is your cost of living now and is not in the plan."}{" "}
          {egg.contrib > 0 ? deferralNote(p, egg.contrib) : ""}
        </Callout>
      )}

      <Grid columns={4} gap={16}>
        <Stat
          value={kMoney(netAfterTax)}
          label={`${isLump(p) ? "Cash after lump-sum tax" : "Kept in 401(k)/IRA"}${savings > 0 ? `, incl. ${kMoney(savings)} savings` : ""}`}
        />
        <Stat value={kMoney(upfrontTotal)} label={`One-time setup (land, ${housingOf(p) === "house" ? "house" : "RV"}, build-out)`} />
        <Stat value={kMoney(leftAfterSetup)} label={isLump(p) ? "Left after setup, before living costs" : "Left in account after year 1"} tone={leftAfterSetup < 100000 ? "warning" : undefined} />
        <Stat value={`${money(steadyPre65 / 12)}/mo`} label={`Living cost before 65 (${money(steadyPre65)}/yr), today's dollars`} />
      </Grid>

      {chosen && (
        <Card>
          <CardHeader>HOA and deed restrictions: {chosen.name}</CardHeader>
          <CardBody>
            <Stack gap={10}>
              <Text size="small" tone="secondary">
                {chosen.county ? `${chosen.county} County` : "County not checked yet"}
                {chosen.stateCode ? `, ${chosen.stateCode}` : ""}. {chosen.acres} acres at {money(chosen.price)}. These
                answers are what you marked on Land search. The map check cannot see covenants or an association.
                {chosen.stateCode && chosen.stateCode !== stateOf(p) ? ` The plan is currently set to ${st.name}.` : ""}
              </Text>
              <Row gap={6} wrap>
                {recordLinks(chosen.county, chosen.stateCode).map((s) => (
                  <Pill key={s.site} size="sm" onClick={() => void openExternal(s.url)}>
                    {s.site}
                  </Pill>
                ))}
                {chosen.url && (
                  <Pill size="sm" onClick={() => void openExternal(chosen.url)}>
                    Listing
                  </Pill>
                )}
                <Pill
                  size="sm"
                  onClick={() => {
                    setChosen(null);
                    setRec((prev) => ({ ...prev, hoa: 0 }));
                  }}
                >
                  Clear
                </Pill>
              </Row>
              <Text size="small">
                <Text size="small" weight="semibold">HOA or road association. </Text>
                {chosen.deed.hoa === "yes"
                  ? `${chosen.deed.hoaName.trim() || "Yes"}${chosen.deed.hoaDues > 0 ? `, ${money(chosen.deed.hoaDues)}/yr` : ""}`
                  : chosen.deed.hoa === "none"
                    ? "None"
                    : "Not filled in"}
                . <Text size="small" weight="semibold">Recorded covenants. </Text>
                {chosen.deed.ccr === "recorded" ? "Recorded" : chosen.deed.ccr === "none" ? "None found" : "Not filled in"}.
              </Text>
              <Table
                headers={["What the plan needs", "On this land"]}
                rowTone={planUses.map((item) =>
                  chosen.deed[item.key] === "banned" ? "danger" : chosen.deed[item.key] === "allowed" ? "success" : "neutral",
                )}
                rows={planUses.map((item) => [
                  item.key === "minHouse" && housingOf(p) === "house"
                    ? "The shelter meets any minimum house size"
                    : item.label,
                  chosen.deed[item.key] === "banned" ? "Banned" : chosen.deed[item.key] === "allowed" ? "Allowed" : "Unknown",
                ])}
              />
              <Text size="small" tone="secondary">
                {housingOf(p) === "house"
                  ? "This plan is a small house, so an RV ban does not block it. A minimum house size does."
                  : "This plan uses an RV, so an RV ban blocks it. A minimum house size can too if the RV is too small."}
              </Text>
              {planUses.some((item) => chosen.deed[item.key] === "banned") && (
                <Callout tone="warning" title="A recorded rule blocks part of this plan">
                  {planUses
                    .filter((item) => chosen.deed[item.key] === "banned")
                    .map((item) =>
                      item.key === "minHouse" && housingOf(p) === "house"
                        ? "The shelter meets any minimum house size"
                        : item.label,
                    )
                    .join(". ")}
                  . Confirm the clause in the declaration before you count on this parcel.
                </Callout>
              )}
              {chosen.deed.notes.trim() && (
                <Text size="small" tone="secondary">
                  {chosen.deed.notes.trim()}
                </Text>
              )}
              <Text size="small" tone="tertiary">
                {(() => {
                  const dues = chosen.deed.hoa === "yes" ? Math.round(chosen.deed.hoaDues) : 0;
                  const budget = rec.hoa ?? 0;
                  if (dues === budget) {
                    return dues > 0
                      ? `${money(dues)}/yr is included in monthly costs as HOA or road dues. Editing either amount updates the other.`
                      : "No dues are included in the monthly costs.";
                  }
                  return `Land search shows ${money(dues)}/yr. Monthly costs still have ${money(budget)}/yr.`;
                })()}
              </Text>
            </Stack>
          </CardBody>
        </Card>
      )}

      <div className="plan-main">
        <Card>
          <CardHeader>Assumptions</CardHeader>
          <CardBody>
            <div className="fields">
              <Field label="State">
                <Select
                  value={stateOf(p)}
                  onChange={(v) => pickState(v as StateId)}
                  options={STATE_IDS.map((id) => ({ value: id, label: STATES[id].name }))}
                />
              </Field>
              <Field label="Acres you're buying">
                <NumField value={est.acres} onChange={setAcres} width={72} />
              </Field>
              <div className="span-2">
                <Text size="small" tone="tertiary">
                  Land search is {linked.acresMin}–{linked.acresMax} acres
                  {linked.saved ? ` in ${linked.counties}` : ""}, maximum {money(linked.priceMax)}.
                  {linked.saved
                    ? " That maximum is the land line in setup costs."
                    : " The land line still has its own amount until you set one of them."}{" "}
                  Moving these acres outside the range widens Land search, and tightening the range there moves this
                  number back inside it.
                </Text>
              </div>
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
              <Field label="Age you are now">
                <NumField value={ageNowFrom(p)} onChange={setAgeNow} width={64} />
              </Field>
              <Field label="Retirement age">
                <NumField value={p.retireAge ?? 58} onChange={setRetireAge} width={64} />
              </Field>
              <Field label="Money needs to last through age">
                <NumField value={p.goalAge ?? 85} onChange={(n) => set("goalAge", n)} width={64} />
              </Field>
              <Field label="Year you retire">
                <NumField value={p.startYear} onChange={setStartYear} width={72} />
              </Field>
              <div className="span-2">
              <Text size="small" tone="tertiary">
                {yearsToRetire(p) === 0
                  ? `Retiring this year, at ${startAge(p)}.`
                  : `Retiring in ${p.startYear} is ${yearsToRetire(p)} ${yearsToRetire(p) === 1 ? "year" : "years"} from now, at age ${startAge(p)}.`}{" "}
                The cash chart starts then. Lasting through age {goal} is {goal - startAge(p)} years of retirement.
                {p.ssAge < startAge(p)
                  ? ` Social Security is set to age ${p.ssAge}, so the plan counts it from the year you retire.`
                  : ""}
                {p.collapseAge < startAge(p)
                  ? ` Collapse is set at ${p.collapseAge}, before retirement, so the chart treats cash as frozen from the first year.`
                  : ""}
              </Text>
              </div>
              <Field label="Wages until you retire, $/yr">
                <NumField value={p.jobPay ?? 0} onChange={(n) => set("jobPay", n)} />
              </Field>
              <Field label="401(k) contribution, $/yr">
                <NumField value={p.jobContrib ?? 0} onChange={(n) => set("jobContrib", n)} />
              </Field>
              <Field label="Saved from wages, $/yr">
                <NumField value={p.jobSave ?? 0} onChange={(n) => set("jobSave", n)} />
              </Field>
              <Field label="401(k) balance">
                <NumField value={p.k401} onChange={(n) => set("k401", n)} />
              </Field>
              <Field label="Other savings (cash, brokerage, Roth)">
                <NumField value={p.savings ?? 0} onChange={(n) => set("savings", n)} />
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
              {p.rule55 && !rule55Applies(p) && (
                <div className="span-2">
                <Text size="small" tone="tertiary">
                  The Rule of 55 needs you to leave the job in or after the year you turn 55, so it's off at{" "}
                  {startAge(p)}. Withdrawals before 59½ pay the 10% penalty.
                </Text>
                </div>
              )}
              <Field label="Seller-finance the land">
                <Toggle checked={p.finance} onChange={(v) => set("finance", v)} />
              </Field>
              {p.finance && (
                <>
                  <Field label="Down payment, %">
                    <NumField value={p.downPct} onChange={(n) => set("downPct", n)} width={64} />
                  </Field>
                  <Field label="Interest rate, %">
                    <NumField value={p.loanRate} onChange={(n) => set("loanRate", n)} width={64} />
                  </Field>
                  <Field label="Loan length, years">
                    <NumField value={p.loanYears} onChange={(n) => set("loanYears", n)} width={64} />
                  </Field>
                </>
              )}
              <Divider />
              <Field label={adults > 1 ? "Social Security, $/mo combined" : "Social Security, $/mo"}>
                <NumField value={p.ssMonthly} onChange={setSsMonthly} />
              </Field>
              <Field label="Claim Social Security at age">
                <NumField value={p.ssAge} onChange={setSsAge} width={64} />
              </Field>
              <div className="span-2">
                <Text size="small" tone="tertiary">
                  {(() => {
                    const fra = fraMonths(THIS_YEAR - ageNow);
                    const factor = ssBenefitFactor(p.ssAge, fra);
                    const pct = Math.round(factor * 1000) / 10;
                    const full = Math.round(ssPiaOf(p, ageNow));
                    return `Full retirement age is ${fraText(fra)}. This check is ${pct}% of the ${money(full)} full benefit. Changing the age recalculates it. Payments start at 62 and the increase stops at 70.`;
                  })()}
                </Text>
              </div>
              <Field label="Part-time income, $/yr">
                <NumField value={p.otherIncome} onChange={(n) => set("otherIncome", n)} />
              </Field>
              <Field label="Part-time work until age">
                <NumField value={p.otherUntil} onChange={(n) => set("otherUntil", n)} width={64} />
              </Field>
              <Field label={`Social Security cut to ${EST.ssCutPct}% from ${EST.ssCutYear}`}>
                <Toggle checked={p.ssCut} onChange={(v) => set("ssCut", v)} />
              </Field>
              <Divider />
              <Field label="401(k) growth while working, %">
                <NumField value={p.ret} onChange={(n) => set("ret", n)} width={64} />
              </Field>
              <Field label="Interest on cash after withdrawal, %">
                <NumField value={p.cashReturn ?? 0} onChange={(n) => set("cashReturn", n)} width={64} />
              </Field>
              <Field label="Inflation, %">
                <NumField value={p.inflation} onChange={(n) => set("inflation", n)} width={64} />
              </Field>
              <Field label="Contingency on costs, %">
                <NumField value={p.contingency} onChange={(n) => set("contingency", n)} width={64} />
              </Field>
              <Field label="Full-price ACA insurance (no subsidy), $/yr per person">
                <NumField value={p.acaUnsub} onChange={(n) => set("acaUnsub", n)} />
              </Field>
              <Field label="Collapse happens at age">
                <NumField value={p.collapseAge} onChange={(n) => set("collapseAge", n)} width={64} />
              </Field>
              <Field label="Home">
                <Select
                  value={housingOf(p)}
                  onChange={(v) => set("housing", v as Housing)}
                  options={[
                    { value: "rv", label: "Used RV" },
                    { value: "house", label: "Small house / shelter" },
                  ]}
                />
              </Field>
              <Field label="Power setup">
                <Select
                  value={p.powerMode}
                  onChange={(v) => pickPower(v as PowerMode)}
                  options={POWER_IDS.map((id) => ({ value: id, label: POWER[id].label }))}
                />
              </Field>
              <Field label="Heat with">
                <Select
                  value={heat}
                  onChange={(v) => pickHeat(v as HeatMode)}
                  options={HEAT_IDS.map((id) => ({ value: id, label: HEAT[id].label }))}
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
              <Field label="Chickens for eggs">
                <Toggle checked={p.chickens} onChange={(v) => set("chickens", v)} />
              </Field>
              <Field label="Hens">
                <NumField value={p.hens ?? 6} onChange={setFlock} width={64} />
              </Field>
              <Field label="Eggs at the store, $/dozen">
                <NumField value={p.eggDozen ?? 4} onChange={(n) => set("eggDozen", n)} width={64} />
              </Field>
              <Field label="Vegetable garden">
                <Toggle checked={p.garden} onChange={(v) => set("garden", v)} />
              </Field>
              <Field label="Produce the garden replaces, $/yr">
                <NumField value={p.gardenSave ?? 700} onChange={(n) => set("gardenSave", n)} />
              </Field>
              <Divider />
              <div className="span-2">
              <Row gap={8}>
                <Pill onClick={() => applyPreset(PRESET_PLANNED)}>Planned build</Pill>
                <Pill onClick={() => applyPreset(PRESET_LEAN)}>Lean build</Pill>
                <Pill
                  onClick={() => {
                    setP(DEFAULT_PARAMS);
                    setRec(RECURRING_DEFAULTS);
                    setUp(PRESET_PLANNED);
                    setChosen(null);
                  }}
                >
                  Reset
                </Pill>
              </Row>
              </div>
            </div>
          </CardBody>
        </Card>

        <Stack gap={12}>
          <H3>Money remaining by age, {p.ssCut ? "three" : "four"} scenarios</H3>
          <LineChart
            categories={ages}
            series={[
              { name: "401(k) before the withdrawals", data: beforeWithdrawals, tone: "success" },
              { name: `Normal economy (${p.inflation}% inflation)${p.ssCut ? ", Social Security cut" : ""}`, data: afterLine(normal), tone: "info" },
              ...(p.ssCut
                ? []
                : [{ name: `Social Security cut to ${EST.ssCutPct}% in ${EST.ssCutYear}`, data: afterLine(ssCutSim), tone: "danger" as const }]),
              { name: `High inflation (${EST.highInflation}%)`, data: afterLine(highInf), tone: "warning" },
              { name: `Collapse at ${p.collapseAge} (cash frozen, useless)`, data: afterLine(collapse), tone: "neutral" },
            ]}
            valuePrefix="$"
            fluid
            yFloor={-100_000}
            drop={
              nestAtRetirement != null && cashAtRetirement != null
                ? { x: String(retireAt), from: nestAtRetirement, to: cashAtRetirement }
                : undefined
            }
          />
          <Text size="small" tone="tertiary">
            X-axis: age, from today through {END_AGE}. Until retirement the green line is the 401(k)
            {savings > 0 ? " plus other savings" : ""}. Wages are not on the chart. The dotted line at retirement is
            the drop from that balance, before tax, down to what is left after tax, the land and setup, and the first
            year of costs. After that, All at once and Split are cash in the bank. As needed is what is
            still in the 401(k). The 401(k) grows at {p.ret}%. Cash earns {p.cashReturn ?? 0}% interest, and stays flat
            when that is 0. Tax on interest is ignored. Below $0 is the running shortfall. The scale stops at
            -$100,000, and a deeper shortfall runs off the bottom.
          </Text>
          <Grid columns={4} gap={12}>
            <Stat value={lastsLabel(normal)} label="Normal: money lasts to age" tone={shortfall ? "danger" : "success"} />
            <Stat value={lastsLabel(ssCutSim)} label={`Social Security cut in ${EST.ssCutYear}: lasts to age`} tone={covers(ssCutSim, goal) ? "success" : "danger"} />
            <Stat value={lastsLabel(highInf)} label="High inflation: lasts to age" tone={covers(highInf, goal) ? "success" : "danger"} />
            <Stat value={kMoney(collapse.stranded ?? 0)} label={`Collapse: cash stranded at ${p.collapseAge}`} tone="warning" />
          </Grid>
          <Callout tone="info" title="What moves the outcome most">
            Try these one at a time and watch the age change. First, set Withdrawal to "As needed": you pay less tax and
            keep subsidized health insurance in later years. Second, add $15–20K/yr of part-time income until 62.
            Third, click "Lean build".             Fourth, enter your real Social Security figure from ssa.gov at the age you plan to claim. The $1,400/mo
            default is a placeholder for one person at 62. Changing the claim age recalculates it. Use roughly $2,000 combined for a couple
            where one spouse claims a spousal benefit.
          </Callout>
          <Callout tone={savings > 0 ? "success" : "neutral"} title="Other savings">
            {savings > 0
              ? isLump(p)
                ? `Your ${money(savings)} of savings is added to the cash on hand. It lasts to age ${lastsLabel(normal)} with the savings and ${lastsLabel(noSavingsSim)} without. With "All at once" or "Split" withdrawals the whole 401(k) is taxed anyway, so savings can't lower that tax. "As needed" spends the savings first, which shrinks the year-one taxable withdrawal.`
                : `The plan spends your ${money(savings)} of savings before touching the 401(k). Savings come out tax-free, so the year-one 401(k) withdrawal drops and so does its tax (${kMoney(normal.year0Tax)} vs ${kMoney(noSavingsSim.year0Tax)} without savings). Lower reported income also helps you keep ACA subsidies. Money lasts to age ${lastsLabel(normal)} with the savings and ${lastsLabel(noSavingsSim)} without.`
              : 'Enter cash, bank, brokerage or Roth IRA money in "Other savings" under Assumptions.'}{" "}
            Roth IRA contributions come out tax- and penalty-free at any age, but Roth earnings taken before 59½ are
            taxed and penalized. In a brokerage account only the gains are taxable, usually at 0% long-term capital
            gains rates at this income. Both are treated as tax-free here.
          </Callout>
        </Stack>
      </div>

      <Stack gap={12}>
        <H2>Two what-ifs: a Social Security cut and seller financing</H2>
        <Grid columns={2} gap={20} align="start">
          <Card>
            <CardHeader>Social Security cut to {EST.ssCutPct}% in {EST.ssCutYear}</CardHeader>
            <CardBody>
              <Stack gap={10}>
                <Text size="small" tone="secondary">
                  The Social Security trust fund is projected to run short around 2033–2034. If Congress does nothing,
                  benefits for everyone drop to roughly 77–81% of what's promised. Congress has always acted before,
                  usually by raising taxes or the retirement age for younger workers, but a cut is worth stress-testing.
                  You retire in {p.startYear}, so the cut would hit at age {ssCutYearAge}.
                </Text>
                <Grid columns={3} gap={12}>
                  <Stat value={lastsLabel(noCutSim)} label="No cut: lasts to age" />
                  <Stat value={lastsLabel(ssCutSim)} label="With the cut: lasts to age" tone={ssCutSim.depletedAge !== null && ssCutSim.depletedAge < 85 ? "danger" : undefined} />
                  <Stat value={`${money(p.ssMonthly * 12 * (1 - EST.ssCutPct / 100))}/yr`} label="Benefit lost, today's dollars" tone="warning" />
                </Grid>
                <Text size="small" tone="tertiary">
                  {p.ssCut
                    ? "The cut is switched on in Assumptions, so every chart and table in the plan includes it."
                    : `The red line on the chart shows this case. Switch on "Social Security cut to ${EST.ssCutPct}% from ${EST.ssCutYear}" in Assumptions to apply it to the whole plan.`}{" "}
                  Claiming later still helps: a cut applies to whatever benefit you've earned, and waiting from 62 to
                  67 raises that benefit by about 30%.
                </Text>
              </Stack>
            </CardBody>
          </Card>
          <Card>
            <CardHeader>Seller-financing the land</CardHeader>
            <CardBody>
              <Stack gap={10}>
                <Text size="small" tone="secondary">
                  Instead of paying {money(land)} up front, put {p.downPct}% down ({money(land - loanIfOn.financed)}) and
                  pay the seller {money(loanIfOn.payment)}/yr for {loanIfOn.years} years at {p.loanRate}%. That's{" "}
                  {money(loanIfOn.interest)} of interest in total. It shrinks the year-one 401(k) withdrawal, so less of
                  it is taxed at 24–35%.
                </Text>
                <Grid columns={3} gap={12}>
                  <Stat value={kMoney(cashSim.year0Tax)} label="Year-one tax, paying cash" />
                  <Stat value={kMoney(financedSim.year0Tax)} label="Year-one tax, seller-financed" tone={financedSim.year0Tax < cashSim.year0Tax ? "success" : undefined} />
                  <Stat value={`${lastsLabel(cashSim)} → ${lastsLabel(financedSim)}`} label="Money lasts to age, cash → financed" />
                </Grid>
                <Text size="small" tone="tertiary">
                  {isLump(p)
                    ? `With Withdrawal set to "${p.strategy === "split" ? "Split over 2 tax years" : "All at once"}", the whole 401(k) is taxed up front anyway, so financing doesn't lower the tax. It only spreads the land cost over time, and you pay interest for that. Set Withdrawal to "As needed" to see the tax savings.`
                    : "With \"As needed\" withdrawals, each loan payment comes out of the 401(k) in its own year, together with that year's living costs, instead of all landing in one high-bracket year."}{" "}
                  {p.finance ? "Seller financing is switched on in Assumptions." : 'Switch on "Seller-finance the land" in Assumptions to apply it to the whole plan.'}
                </Text>
                <Callout tone="neutral" title="Doing seller financing safely">
                  Many rural {st.name} sellers offer it, typically 10–20% down, 6–9% interest and 5–15 years, sometimes with
                  a balloon payment due early. Close through a title company or real-estate attorney. Get title
                  insurance, and have a recorded deed with a mortgage, not a contract for deed: under a contract for deed
                  the seller keeps title until the last payment. Ask for no prepayment penalty, so you can pay it off
                  early from a low-tax year.
                </Callout>
              </Stack>
            </CardBody>
          </Card>
        </Grid>
      </Stack>

      <Stack gap={12}>
        <H2>Red states compared, after the 2026 midterms</H2>
        <Text tone="secondary">
          Democrats had a strong night on November 3. They flipped governorships in Texas, Georgia, Iowa, Ohio, Nevada
          and Alaska, and Kansas was still leaning Democratic as of November 4. The states below are ones where
          Republicans still hold the governor's office and both legislative chambers. Each row reruns your current
          plan using that state's income tax, winter heating, property tax and game. The land column uses that
          state's typical price per acre, except the state you have selected, which uses your land budget. Click a
          state name to load its tax, heat and game. The land budget stays what you set, and Land search switches to
          that state.
        </Text>
        <Table
          headers={["State", `${EST.acres} ac land`, "State tax on lump sum", `Heating/yr (${HEAT[heat].label.toLowerCase()})`, "Living cost/yr", "Money lasts to", "Winter low", "Growing season", "Rain", "Medicaid expansion"]}
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
            money(r.heating),
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
              current Assumptions. Land prices are rough 2025–26 asking prices for rural land with water, times your acreage. Edit them under Estimates. Check
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
                day. The plan adds {money(sEst(stateOf(p)).winterShelter)} for an insulated shelter and budgets{" "}
                {hp.propaneGal.toLocaleString("en-US")} gal/yr of propane
                {hp.cords > 0 ? ` and ${hp.cords} cords of firewood` : ""}.
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
        <H2>Where the {savings > 0 ? "401(k) and savings go" : "401(k) goes"}</H2>
        <UsageBar
          total={allocTotal}
          topLeftLabel={
            <Text size="small" tone="secondary">
              {money(egg.k401)} 401(k){egg.years > 0 ? " at retirement" : ""}
              {savings > 0 ? ` + ${money(savings)} savings` : ""}
            </Text>
          }
          topRightLabel={<Text size="small" tone="secondary">{money(allocRemaining)} left to live on</Text>}
          segments={[
            { id: "tax", value: allocTaxes, color: "red" },
            { id: "landrv", value: landRv, color: "blue" },
            { id: "core", value: allocOther, color: "cyan" },
            { id: "hard", value: allocHard, color: "purple" },
            { id: "hunt", value: allocHunt, color: "orange" },
            { id: "food", value: allocFood, color: "yellow" },
            { id: "left", value: allocRemaining, color: "green" },
          ]}
        />
        <Row gap={16} wrap>
          {(
            [
              ["red", `Taxes${rule55Applies(p) || startAge(p) >= 60 ? "" : " + 10% penalty"}: ${money(allocTaxes)}`],
              ["blue", `${housingOf(p) === "house" ? "Land + house" : "Land + RV"}: ${money(landRv)}`],
              ["cyan", `Making it livable: ${money(allocOther)}`],
              ["purple", `Collapse hardening: ${money(allocHard)}`],
              ["orange", `Hunting + processing gear: ${money(allocHunt)}`],
              ["yellow", `Chickens and garden: ${money(allocFood)}`],
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
            label={`${st.name} tax on the full ${kMoney(egg.k401)} if taken after moving`}
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
            ["Within 30 days of moving", `${loc.dmv}. Title and register the truck and RV, register to vote, and file IRS Form 8822 to change your address. Update Social Security and the 401(k) plan too.`, "These records are how you prove your residency changed, and when."],
            ["State income tax returns", NO_INCOME_TAX.has(stateOf(p)) ? `File your federal 1040 as usual. ${st.name} has no income tax return to file, and Texas has none either.` : `File your federal 1040 as usual. File ${loc.forms}. The part-year return taxes only income received after you moved, and Texas has no return to file. For later withdrawals, have the plan withhold ${st.name} tax or pay quarterly estimates.`, "Moving mid-year means one part-year state return, not two. Later withdrawals are taxed by the state you live in when you take them."],
            ["Property tax", `${loc.propertyTax}.`, "Paid to the county no matter which state's income tax applies. A homestead exemption usually needs a permanent dwelling, not an RV."],
            ["Health and hunting", `Moving to a new state lets you change ACA plans right away (60-day window), but only if you had coverage before you moved. ${loc.medicaid}. ${loc.deerRules.split(". ").find((s) => s.includes("residen")) ?? `Check ${loc.wildlife}'s minimum residency for resident hunting licenses`}.`, "A nonresident deer license costs several hundred dollars, so time the move around deer season."],
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
        <H2>Monthly living costs (normal economy, today's dollars)</H2>
        <Text tone="secondary">
          Every cost is editable as $/mo or $/yr, and the plan recomputes as you type. Start from a preset, then adjust
          any line. The presets leave property tax, propane, firewood and electricity alone, because those come from
          the state, the heat choice and the power setup. The {p.contingency}% contingency in Assumptions is added on
          top. Set it to 0 if your numbers already include a cushion.
        </Text>
        <Row gap={8} wrap>
          <Text size="small" tone="tertiary">Living-cost preset</Text>
          {(Object.keys(LIVING_PRESETS) as LivingPreset[]).map((id) => (
            <Pill key={id} onClick={() => applyLiving(id)}>
              {LIVING_PRESETS[id].label}
            </Pill>
          ))}
          <Text size="small" tone="tertiary" style={{ marginLeft: 12 }}>Heat with</Text>
          {HEAT_IDS.map((id) => (
            <Pill key={id} size="sm" active={heat === id} onClick={() => pickHeat(id)}>
              {HEAT[id].label}
            </Pill>
          ))}
        </Row>
        <Grid columns={3} gap={12}>
          {(Object.keys(LIVING_PRESETS) as LivingPreset[]).map((id) => {
            const r = { ...rec, ...LIVING_PRESETS[id].values };
            return (
              <Stat
                key={id}
                value={`${money(annualCost(r, 60, p, false) / 12)}/mo`}
                label={`${LIVING_PRESETS[id].label}: ${LIVING_PRESETS[id].note}`}
              />
            );
          })}
        </Grid>
        <Callout tone={heat === "propane" ? "neutral" : "info"} title={`Heat: ${HEAT[heat].label}, in ${st.name}`}>
          {HEAT[heat].summary}{" "}
          {heat === "propane"
            ? `In ${st.name} that's about ${sEst(stateOf(p)).propaneGal.toLocaleString("en-US")} gal/yr (${money(rec.propane ?? 0)}). Heating with wood instead would cut propane to about ${heatPlan(stateOf(p), "wood").propaneGal} gal and need about ${sEst(stateOf(p)).cords} cords a year.`
            : `In ${st.name} plan on about ${hp.cords} cords a year and ${hp.propaneGal} gal of propane. ${loc.woodNote}. ${loc.ownWood ? `Cutting your own costs about $${EST.firewoodOwn} a cord in saw gas, chains and bar oil, but it takes about a day of work per cord, so cut and stack a year ahead. Green wood won't burn well.` : `Bought firewood runs about $${EST.firewoodBuy} a cord here.`}`}{" "}
          {heat !== "propane" &&
            "Many RV insurers won't cover a wood stove, so tell your insurer, or put the stove in the cabin, barn room or shelter instead. Use an RV- or marine-rated stove with the listed clearances and an insulated chimney, and keep a CO alarm by the bed."}
        </Callout>
        <Grid columns="minmax(0, 1.2fr) minmax(0, 1fr)" gap={20} align="start">
          <Stack gap={8}>
            <Table
              headers={adults > 1 ? ["Cost", "$/mo", "$/yr", "Applies", `Household (${adults}), $/yr`] : ["Cost", "$/mo", "$/yr", "Applies"]}
              columnAlign={["left", "right", "right", "left", "right"]}
              rows={costRows}
              striped
            />
            <Text size="small" tone="tertiary">
              Monthly figures are rounded to the dollar. Health insurance before 65 depends on income: with
              "As needed" withdrawals and modest income, a subsidized ACA bronze plan can cost under $50/mo.
            </Text>
          </Stack>
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
              as {money(p.acaUnsub)}/yr per person at {startAge(p)}. {loc.medicaid}.
              {st.medicaid
                ? " Starting in 2027, federal law adds work or volunteer requirements for expansion adults under 65."
                : ""}{" "}
              Check the current rules before you rely on either.
            </Callout>
          </Stack>
        </Grid>
      </Stack>

      <Stack gap={12}>
        <Row gap={12} align="center">
          <H2>Estimates behind the numbers</H2>
          <Pill size="sm" onClick={resetEst}>Reset estimates</Pill>
        </Row>
        <Text tone="secondary">
          These are the rough figures the planner fills in for you. Change any of them to match a quote, a listing or
          what you pay locally. Your edits are saved. Editing {st.name}'s land price per acre rewrites the land cost
          and the Land search maximum. Changing the acreage does not. That maximum is the land line until you edit
          either one. Edits for other states show up in the state comparison and apply when you switch.
        </Text>
        <Grid columns={2} gap={20} align="start">
          <Card>
            <CardHeader>Prices, yields and scenarios</CardHeader>
            <CardBody>
              <Grid columns={2} gap={10}>
                <Field label="Acres you're buying">
                  <NumField value={est.acres} onChange={setAcres} width={72} />
                </Field>
                <Field label="Propane, $/gal">
                  <NumField value={est.propanePrice} onChange={(n) => setEst("propanePrice", n)} width={72} />
                </Field>
                <Field label="Firewood you cut, $/cord">
                  <NumField value={est.firewoodOwn} onChange={(n) => setEst("firewoodOwn", n)} width={72} />
                </Field>
                <Field label="Firewood bought, $/cord">
                  <NumField value={est.firewoodBuy} onChange={(n) => setEst("firewoodBuy", n)} width={72} />
                </Field>
                <Field label="Boneless meat per deer, lb">
                  <NumField value={est.deerLb} onChange={(n) => setEst("deerLb", n)} width={72} />
                </Field>
                <Field label="Meat per hog, lb">
                  <NumField value={est.hogLb} onChange={(n) => setEst("hogLb", n)} width={72} />
                </Field>
                <Field label="Lard per hog, lb">
                  <NumField value={est.lardLb} onChange={(n) => setEst("lardLb", n)} width={72} />
                </Field>
                <Field label="Boneless meat per elk, lb">
                  <NumField value={est.elkLb} onChange={(n) => setEst("elkLb", n)} width={72} />
                </Field>
                <Field label="Social Security cut starts in">
                  <NumField value={est.ssCutYear} onChange={(n) => setEst("ssCutYear", n)} width={72} />
                </Field>
                <Field label="Benefits paid after the cut, %">
                  <NumField value={est.ssCutPct} onChange={(n) => setEst("ssCutPct", n)} width={72} />
                </Field>
                <Field label="High-inflation scenario, %">
                  <NumField value={est.highInflation} onChange={(n) => setEst("highInflation", n)} width={72} />
                </Field>
              </Grid>
            </CardBody>
          </Card>
          <Text size="small" tone="tertiary">
            Defaults: propane about $2.90/gal for a homeowner-owned tank in 2026. Cutting your own wood costs about $40
            a cord in saw gas, chains and bar oil, and bought split wood about $275 a cord. A field-dressed whitetail
            gives about 45 lb of boneless meat, a 150 lb hog about 50 lb of meat and 6 lb of lard, and an elk about 180
            lb. The Social Security trustees project the trust fund running short around 2033, with about 80% of
            benefits still payable. Everything else, like setup and living costs, is edited directly in those tables.
          </Text>
        </Grid>
        <H3>By state</H3>
        <Table
          headers={["State", "Land, $/acre", "Propane heat, gal/yr", "Propane with wood heat, gal/yr", "Property tax, $/yr", "Winter shelter, $", "Firewood, cords/yr", "Wood stove setup, $"]}
          columnAlign={["left", "right", "right", "right", "right", "right", "right", "right"]}
          rowTone={STATE_IDS.map((id) => (id === stateOf(p) ? "info" : undefined))}
          rows={STATE_IDS.map((id) => {
            const e = est.states[id];
            const f = (k: keyof StateEst) => (
              <NumField key={`${id}-${k}`} value={e[k]} onChange={(n) => setStateEst(id, k, n)} width={80} />
            );
            return [
              STATES[id].name,
              f("landPerAcre"),
              f("propaneGal"),
              f("baseGal"),
              f("propTax"),
              f("winterShelter"),
              f("cords"),
              f("stove"),
            ];
          })}
          striped
        />
        <Text size="small" tone="tertiary">
          "Propane heat" is a full year of heating, cooking and hot water on propane. "Propane with wood heat" is what's
          left for cooking, hot water and the fridge when wood does the heating. A winter shelter is only budgeted where
          winters reach −20°F or colder.
          {LOCAL[stateOf(p)].ownWood
            ? ` Firewood in ${st.name} is costed as cut from your own land.`
            : ` Firewood in ${st.name} is costed as bought, because the land has few trees.`}
        </Text>
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
              In a {st.name} December, 1 kW of panels makes about {loc.solar[0]} kWh a day, and about {loc.solar[1]} kWh
              in summer.{" "}
              {loc.solar[0] >= 2.5
                ? "A 6 kW array covers the essentials year-round."
                : `A 6 kW array only makes about ${Math.round(6 * loc.solar[0])} kWh on a December day, so plan on the generator through the dark months or a larger array.`}{" "}
              A/C roughly doubles the system, so off-grid A/C uses a mini-split in the cabin or barn room, not the RV
              roof unit.
            </Text>
          </Stack>
          <Stack gap={10}>
            <Callout tone="info" title="Starlink">
              Residential service runs about $120/mo, and the kit costs $350–500. Prices and plans change, so check
              starlink.com for the land's address before you buy. The dish needs a clear view of the northern sky.{" "}
              {loc.ownWood
                ? `On timbered ${st.name} land that usually means a 10–20 ft pole or the barn roof, not the RV roof.`
                : "Open country makes that easy, but anchor the mount for high wind."}{" "}
              It draws about 1.5 kWh/day
              {st.winterShelter > 0 ? ", and noticeably more in winter when the snow-melt heater runs" : ""}. Put it on the battery-backed circuit so internet and
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
              Before you make an offer, call the electric utility that serves the parcel (for example, {loc.coops}) and
              get a written line-extension quote. A pole near the road can
              cost $2–10K to connect. A quarter mile of new line can cost more than the land. If the quote is over
              about $20K, off-grid solar is usually cheaper and has no monthly bill.
            </Callout>
          </Stack>
        </Grid>
      </Stack>
      </>
      )}

      {part === "sustain" && (
      <>
      <Stack gap={6}>
        <H1>Self-reliance: food, water and staying alive</H1>
        <Text tone="secondary">
          Chickens, a garden, hunting, the well, and what still works if the bills stop. Turning something off here
          takes it out of the retirement plan too. The dollar boxes are the same ones as on that tab. This page is
          planning {est.acres} acres in {st.name} with a land budget of {money(land)}
          {linked.saved ? `, which is the Land search maximum of ${money(linked.priceMax)}` : ""}. Changing the state,
          acreage, or land cost on either of the other pages changes those figures here.
        </Text>
      </Stack>

      <Stack gap={12}>
        <H2>{housingOf(p) === "house" ? "Water for the house" : "Water for the RV: refilling, drinking and showers"}</H2>
        <Text tone="secondary">
          {housingOf(p) === "house"
            ? "The house connects to the well and a permitted septic. Filter drinking water at the sink, and test the well for coliform and nitrates when it is drilled and every year after. Rain catchment stays the backup. The steps below are for an RV, if you switch Home back to Used RV."
            : `An RV fresh-water tank holds 40–100 gallons. With short showers, ${who} uses about ${adults === 1 ? "10–20" : `${10 * adults}–${20 * adults}`} gallons a day, so a full tank lasts about 3–7 days when you're not hooked up. The goal is to plumb the RV to the well so you never haul water.`}
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
            ["Calories", `~${(hunt.need / 1e6).toFixed(1)}M kcal (2,200/day per person)`, `1-yr stored food covers year 1. After that: about ¼ acre of garden and 4–6 hens per person${p.hunting ? `, and ${p.deerPerYear} deer + ${p.hogsPerYear} hogs (~${Math.round(hunt.share * 100)}% of calories)` : ""}`, `Year 2+. A first-year garden with a growing season of ${st.growing} seldom covers half your calories. Start it in a normal year.`],
            ["Drinking + hygiene water", `~${(1825 * adults).toLocaleString("en-US")} gal (5 gal/person/day)`, "Hand pump on the well covers this easily", "Electric pump without hand-pump backup"],
            ["Garden water", "~100–140K gal per summer for ¼ acre", `Pond, creek, rain catchment (a 1,000 sq ft roof yields ~${(Math.round((parseFloat(st.rain) * 1000 * 0.62 * 0.8) / 1000) || 0).toLocaleString("en-US")}K gal/yr with ${st.rain} of rain)`, "Drought years dry up ponds and shallow wells"],
            ["Heat", `~${sEst(stateOf(p)).propaneGal.toLocaleString("en-US")} gal propane, or ~${sEst(stateOf(p)).cords} cords of wood`, `Stored propane lasts 1–2 winters. ${loc.woodNote}`, st.winterShelter > 0 ? `Winters reach ${st.winterLow}. Losing heat is deadly within hours` : "RVs heat poorly. Ice storms are the real killer"],
            ["Medicine", "Every prescription you take, plus dental", "Stockpile what your doctor will allow, get dental work done early, learn first aid", "The largest risk past 55. You can't grow it"],
            ["Cooling", loc.summerHigh, "Shade, fans on solar, a cabin with an earth-sheltered side", "RV A/C can't run on a modest solar bank"],
          ]}
        />
      </Stack>

      <Stack gap={12}>
        <H2>Chickens and a garden</H2>
        <Text tone="secondary">
          Eggs and vegetables you raise yourself. Neither one pays back its cost in cash. A dozen eggs from six hens
          is worth about what the feed cost, and the coop is money you do not get back. The reason to do it is food
          you still have when the store is an hour away, or empty. Turn a switch off if you will not do the chores.
          An unlocked coop or an open garden gate loses the food, and the plan still counts the setup.
        </Text>
        <Row gap={8} wrap>
          <Text size="small" tone="tertiary">Chickens</Text>
          <Pill size="sm" active={flockSize === "off"} onClick={() => setFlock(0)}>
            None
          </Pill>
          <Pill size="sm" active={flockSize === "small"} onClick={() => setFlock(6)}>
            6 hens
          </Pill>
          <Pill size="sm" active={flockSize === "large"} onClick={() => setFlock(12)}>
            12 hens
          </Pill>
          <Text size="small" tone="tertiary" style={{ marginLeft: 12 }}>Garden</Text>
          <Pill size="sm" active={gardenSize === "off"} onClick={() => setGardenSize("off")}>
            None
          </Pill>
          <Pill size="sm" active={gardenSize === "kitchen"} onClick={() => setGardenSize("kitchen")}>
            Kitchen garden
          </Pill>
          <Pill size="sm" active={gardenSize === "calorie"} onClick={() => setGardenSize("calorie")}>
            Quarter-acre calorie patch
          </Pill>
        </Row>
        <Grid columns={4} gap={12}>
          <Stat value={money(foodSetup)} label="Setup counted now (coop and fence)" />
          <Stat
            value={money((p.chickens ? rec.chickens ?? 0 : 0) + (p.garden ? rec.garden ?? 0 : 0))}
            label="Feed and seed per year"
          />
          <Stat value={money(grown.eggs + grown.veg)} label="Grocery dollars replaced in an average year" tone="success" />
          <Stat
            value={money(Math.max(0, (p.chickens ? rec.chickens ?? 0 : 0) + (p.garden ? rec.garden ?? 0 : 0) - grown.eggs - grown.veg))}
            label="Yearly cost still left after that food"
          />
        </Grid>
        <Text size="small" tone="tertiary">
          {p.chickens
            ? `${eggs.hens} hens at about ${EGGS_PER_HEN} eggs each, ${Math.round(eggs.dozens)} dozen, valued at ${money(p.eggDozen ?? 4)} a dozen (${money(grown.eggs)}). Winter and the hottest months lay less, so this is a year average, not June.`
            : "Chickens are off, so no coop and no egg savings."}{" "}
          {p.garden
            ? `The garden replaces ${money(grown.veg)} of produce${adults > 1 ? " for this household" : ""}. `
            : "The garden is off, so no fence and no produce savings. "}
          Hunting, eggs and the garden together are subtracted only up to {money(grown.cap)} (65% of groceries). The
          plan uses {money(grown.used)} of that. Coffee, oil, flour, salt and a failed crop stay on the grocery line.
        </Text>
        {(up.garden ?? 0) >= 2500 && (
          <Callout tone="warning" title="The canning line may still include the coop and the fence">
            Collapse hardening still has {money(up.garden ?? 0)} on "Canning and dry storage". That line used to be the
            whole chickens-and-garden bundle. The coop and the fence are counted separately now. Set the canning line
            to about $800 unless you really mean to spend this much on jars and a canner.
            <Row gap={8}>
              <Pill size="sm" onClick={() => setUp((prev) => ({ ...prev, garden: 800 }))}>
                Set canning to $800
              </Pill>
            </Row>
          </Callout>
        )}
        {upfrontTable("food")}

        <Grid columns={2} gap={20} align="start">
          <Stack gap={10}>
            <H3>Keeping the hens alive</H3>
            <Text size="small" tone="secondary">
              You do not need a rooster for eggs. A rooster is only for hatching your own replacements, and he will
              spur you. For one person, buy two started pullets a year (about $25–35 each) and skip the rooster.
              Hens lay well for about two years, then slow down. Plan to replace them. Do not eat a bird that was
              sick.
            </Text>
            <Callout tone={st.winterShelter > 0 ? "warning" : "info"} title={st.winterShelter > 0 ? `Winter in ${st.name}` : `Summer in ${st.name}`}>
              {st.winterShelter > 0
                ? `Winters reach ${st.winterLow}. Adult hens handle that if the coop is dry, the vent is above them, and the roost is wide enough that feathers cover their toes. They do not handle a heat lamp. That is how coops burn. Frozen water is the daily chore: swap two waterers, or use a heated base on the household circuit (about $40). Short days cut laying from November to February. A small LED on a timer, about 14 hours, brings some of those eggs back.`
                : `Heat kills more hens here than a normal winter night (${st.winterLow}). Shade the west side of the coop, keep two waterers filled through the afternoon, and expect laying to drop in the hottest weeks. A frozen week still happens. Swap the water. Still no heat lamp.`}
            </Callout>
            <Table
              headers={["What kills them", "How", "What actually stops it"]}
              rows={[
                ["Raccoon", "Kills several in one night. Opens a hook-and-eye and reaches through chicken wire.", "1/2-inch hardware cloth on every hole. A latch it can't flip (carabiner or spring clip). Lock the coop at dusk."],
                ["Dog, coyote, fox", "Digs under, or carries a bird off in daylight.", "A hardware-cloth apron about 18 inches out, pinned down, or buried a foot. Don't leave them loose while you're inside."],
                ["Hawk and owl", "Takes the bird in the open.", "Overhead wire on the run. Free-range only while you are standing out there."],
                ["Snake", "Eats the eggs.", "1/2-inch mesh, and collect eggs every day so nothing learns the nest box."],
                ["Heat lamp", "Burns the coop. Cold rarely kills an adult hen.", "No lamp. Dry litter, wide roost, vent above the birds. Heated water base only."],
                ["You leave", "One unlocked night is enough.", "Count them in at dusk. An automatic door is a backup you test every week. A door that fails open is an invitation. Ask a neighbor to close it if you're gone overnight."],
              ]}
            />
            <Text size="small" tone="secondary">
              Buy birds from a local breeder or a feed store. Don't let them drink where wild ducks do. That is how
              avian flu moves, and a government order can wipe the flock. Mites show up as pale birds and dirty vent
              feathers. A dust bath of dry dirt and wood ash prevents most of it. A bird that sits fluffed and won't
              eat comes out of the coop the same day.
            </Text>
          </Stack>
          <Stack gap={10}>
            <H3>Keeping the garden from being eaten</H3>
            <Text size="small" tone="secondary">
              {gardenSize === "calorie"
                ? `A quarter acre is the size that starts to matter for calories: potatoes, sweet potatoes, dry beans, winter squash and corn. It is a part-time job from planting to frost, and the fence and the drip line are about ${money(up.plot ?? 0)}.`
                : `The kitchen garden is about 40 by 60 feet. It replaces vegetables, not the grocery bill. Calories come from potatoes, sweet potatoes, dry beans and winter squash, not from salad. A quarter-acre calorie patch needs about twice the fence and a lot more water and work. Use that pill if that is the garden you mean.`}{" "}
              {st.growing} growing season, {st.rain} of rain.
            </Text>
            <Callout tone="info" title={`${st.name} growing conditions`}>
              {st.winterShelter > 0
                ? `Start plants inside the RV. Rain here is not enough, so drip from the well is not optional, and mulch so you are not watering at noon. Hail can strip every leaf in one storm. A low hoop with hail cloth is worth more than another seed packet. Gophers take roots from below. Put hardware cloth under raised beds.`
                : `Plant a spring garden and a fall garden. The hot middle is okra, sweet potatoes, cowpeas and peppers, with mulch and drip. Tomatoes stall in the worst heat. Greens belong in the cool ends of the season.`}
              {st.hogs > 0
                ? " Feral hogs will root a garden flat in a night. Run a hog panel or an electric wire at snout height outside the deer fence. The same panels as a hog trap."
                : ""}
              {st.elk > 0 ? " Elk and deer both clear a chest-high fence. Eight feet, and a gate you close." : ""}
            </Callout>
            <Table
              headers={["What eats it", "What it does", "What actually stops it"]}
              rows={[
                ["Deer", "A few deer eat a season of food in a week, including while you are in town.", "An 8-ft fence or deer net on tall posts, and a gate you close. A chest-high fence does not work."],
                ["Rabbits", "Cut seedlings off at the ground.", "Hardware cloth along the bottom 2 feet, pinned or buried a few inches."],
                ["Raccoons", "Take corn, melons and tomatoes the night they ripen.", "Pick every day. One electric strand on the outside of the fence."],
                ["Birds", "Pull seedlings and peck fruit.", "Row cover until the plants are past the tender stage."],
                ...(st.hogs > 0
                  ? [["Feral hogs", "Root the beds and smash light wire.", "Hog panel or electric wire at snout height, outside the deer fence."] as [string, string, string]]
                  : []),
                ...(st.winterShelter > 0
                  ? ([
                      ["Gophers and voles", "Eat roots from underneath.", "Hardware cloth under the beds, and traps."],
                      ["Hail and frost", `The season is only ${st.growing}. One storm can end it.`, "Start plants indoors. A low hoop with hail cloth."],
                      ["Drought", `${st.rain} of rain will not carry a summer garden.`, "Drip from the well, and mulch. Don't count on a pond."],
                    ] as Array<[string, string, string]>)
                  : ([["Heat and bugs", "July heat stalls tomatoes. Squash bugs and hornworms take the rest.", "Mulch, drip, and row cover on squash until they flower. Plant a fall crop."]] as Array<[string, string, string]>)),
              ]}
            />
          </Stack>
        </Grid>

        <H3>The chores, or the food disappears</H3>
        <Table
          headers={["When", "Chickens", "Garden"]}
          rows={[
            ["Every morning", "Open the coop, or check the automatic door. Water. Count the birds.", "In season, look at the gate and whether the drip is actually running."],
            ["Every dusk", "Lock the coop and count again. This is the job that keeps them alive.", "Close the gate. Deer work at night."],
            ["Once a week", "Add litter or scrape the droppings board. Walk the apron for new dig holes.", "Weed, harvest what is ripe, and walk the fence for a sag or a hole."],
            ["Spring and fall", "Full clean twice a year. Replace the two oldest hens. Check for mites.", "Spring: fix the fence before anything greens up, when deer are hungriest. Fall: can or store the crop, then mulch the beds."],
          ]}
        />
        <Callout tone="warning" title="Living alone is the real risk">
          The flock and the garden fail when you are not there. One night the coop stays open, or one week the garden
          gate stays open, and the food is gone. You still paid for the coop and the fence. If you travel, hunt all
          day, or land in the hospital, someone else has to lock the birds and close the gate. Past 70 the daily chore
          is what quits first. If you already know you will not do dusk lock-up every day, turn the chickens off and
          keep the grocery line. The plan would rather you buy eggs than pretend a dead flock is still laying.
        </Callout>
      </Stack>

      <Stack gap={12}>
        <H2>Hunting in {st.name}: {st.game.toLowerCase()}</H2>
        <Text tone="secondary">{loc.huntIntro}</Text>
        {(st.hogs === 0 || st.elk > 0) && (
          <Callout tone="info" title={`What that means for the meat plan`}>
            {st.hogs === 0
              ? "With few or no feral hogs here, the plan sets hogs to 0 and loses the lard. Venison and elk are very lean, so plan on stored oil or raising a few pigs for fat."
              : ""}
            {st.elk > 0
              ? ` One elk yields about ${EST.elkLb} lb of boneless meat, about four deer's worth. The deer processing steps below apply to elk too.`
              : ""}
          </Callout>
        )}
        <Grid columns={5} gap={12}>
          <Stat value={`${hunt.meatLb} lb`} label="Boneless meat per year" />
          <Stat value={`${hunt.lardLb} lb`} label="Rendered lard per year" />
          <Stat value={`${Math.round(hunt.share * 100)}%`} label={`Of yearly calories for ${who}`} tone={hunt.share < 0.25 ? "warning" : "success"} />
          <Stat value={money(p.hunting ? offset : 0)} label="Grocery savings per year (normal economy)" />
          <Stat value={money(huntTotal)} label="Gear cost, one-time" />
        </Grid>
        <Text size="small" tone="tertiary">
          Yields assume about {EST.deerLb} lb boneless meat per deer and, for a 150 lb hog, about {EST.hogLb} lb
          of meat plus {EST.lardLb} lb of lard. Venison is ~{KCAL_VENISON_LB} kcal/lb, hog meat ~{KCAL_HOG_LB}, lard
          ~{KCAL_LARD_LB}. Meat savings are counted at your store-meat price and capped at half the grocery budget.
          Eggs and garden savings sit on top of that, and all of it together stops at 65% of groceries, so the plan
          never assumes the store bill goes to zero. Meat covers protein, not calories. Meat this lean
          can't be most of your diet anyway, so potatoes, beans, squash and stored grain still have to supply most of
          the calories. Each hunter has their own deer limit, so more adults can legally take more deer.
        </Text>

        <Grid columns={2} gap={20} align="start">
          <Stack gap={8}>
            <H3>Gear (editable)</H3>
            {upfrontTable("hunting")}
          </Stack>
          <Stack gap={8}>
            <H3>{st.name} rules to check before you hunt</H3>
            <Text size="small">
              <Text size="small" weight="semibold">{st.elk > 0 ? "Deer and elk." : "Deer."}</Text> {loc.deerRules}.
            </Text>
            <Text size="small">
              <Text size="small" weight="semibold">Feral hogs.</Text> {loc.hogRules}.
            </Text>
            <Text size="small">
              <Text size="small" weight="semibold">Senior licenses.</Text> {loc.seniorRules}. It's worth buying in a
              normal economy.
            </Text>
            <Text size="small" tone="tertiary">
              Regulations change yearly. Confirm dates, limits and residency rules in the current {loc.wildlife}{" "}
              regulations at {loc.site}.
            </Text>
          </Stack>
        </Grid>

        <H3>From the kill to the table</H3>
        <Grid columns={2} gap={16} align="start">
          <Card>
            <CardHeader trailing={<Pill size="sm">Lean, mild</Pill>}>{st.elk > 0 ? "Deer and elk" : "Whitetail deer"}</CardHeader>
            <CardBody>
              <Stack gap={8}>
                {[
                  ["Tag first.", stateOf(p) === "OK" ? "Tag the deer where it lies, then E-check it within 24 hours." : `Tag the deer where it lies, then report or check it as ${loc.wildlife} requires.`],
                  ["Field dress within an hour.", "Wear gloves. Make a shallow cut from the pelvis to the breastbone, keeping the blade edge up so you don't puncture the stomach or bladder. Cut the diaphragm, reach up and sever the windpipe, then roll the organs out. Core around the anus and pull it through. Keep the heart and liver if the liver has no spots."],
                  st.winterShelter > 0
                    ? ["Cool it fast, but don't let it freeze unskinned.", "Early archery seasons in September are warm, so treat those like summer kills: skin, quarter and ice them the same day. In November cold, hang the quarters in a shed above freezing. A carcass that freezes solid before it's skinned is very hard to process."]
                    : ["Cool it fast. Warm falls make this critical here.", "November afternoons often reach the 60s and 70s °F. The meat needs to get below 40°F within a few hours. If the air is warmer than about 40°F, skin and quarter the same day and put the quarters in coolers on ice. Keep the meat in bags or drain the meltwater daily, and it holds 3–5 days."],
                  ["Skin and quarter.", "Hang it by the hind legs on a gambrel. Skin while it's warm, which is much easier. The front shoulders come off with no joint, just cut behind the blade. Then take the hindquarters, both backstraps along the spine, the two tenderloins inside the cavity, the neck, and the rib and flank meat for grinding."],
                  ["Age it if you can.", "3–7 days at 34–40°F makes it noticeably more tender. This is optional."],
                  ["Trim hard.", "Remove all deer fat, silverskin and bloodshot meat. Deer fat is what makes venison taste gamey."],
                  ["Cut it up.", "Backstraps and hindquarter muscles become steaks and roasts, and everything else becomes grind. Mix 10–20% hog or pork fat into ground venison. It makes burgers and sausage that hold together and taste far better."],
                  ["Chronic wasting disease (CWD).", `CWD has been found in ${st.name}. Bone the meat out rather than sawing through the spine. Don't eat the brain, spinal cord, eyes, spleen or lymph nodes. Test any deer from a zone where CWD has been detected, and don't eat a deer that acted sick.`],
                ].map(([h, b], i) => (
                  <Text key={h} size="small">
                    <Text size="small" weight="semibold">{`${i + 1}. ${h}`}</Text> {b}
                  </Text>
                ))}
              </Stack>
            </CardBody>
          </Card>
          {st.hogs > 0 ? (
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
          ) : (
            <Callout tone="neutral" title={`No feral hogs in ${st.name}`}>
              Fat is the hard part of a wild-game diet here. Raise two feeder pigs a year for lard and sausage fat, or
              store cooking oil. A pig raised from spring to fall yields about 150 lb of meat and 20–30 lb of lard. The
              hog trapping and processing steps are hidden because they don't apply.
            </Callout>
          )}
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
          {st.hogs > 0
            ? `A corral trap can catch 6–12 hogs in one night, which is 300+ lb of meat. That's more than one canner and one freezer can handle quickly. Releasing feral hogs is illegal in ${st.name}, so only spring the trap when you have the time, ice and jars ready. Hogs you can't process still have to be killed and disposed of. `
            : `${st.elk > 0 ? "An elk is 180+ lb of boneless meat at once, " : "Two or three deer in a week is 100+ lb of meat, "}more than one canner and one freezer can handle quickly. `}
          A 7-quart canner load holds about 10 lb of meat and takes about 2.5 hours, including heat-up and cool-down.
          Learn all of this in a normal year while a processor and a grocery store still exist as a backup.
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
        <H3>{housingOf(p) === "house" ? "How each hazard hits a small house, and how to prepare" : "How each hazard hits an RV homestead, and how to prepare"}</H3>
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
          {housingOf(p) === "house" ? " The rows below were written for an RV. A small house does better against hail, cold, and wind. Tornadoes and flood still apply." : ""}
        </Text>
      </Stack>
      </>
      )}

      {part !== "sustain" && (
      <Stack gap={12}>
        <H2>{st.name}-specific notes</H2>
        <Grid columns={2} gap={16}>
          <Stack gap={8}>
            <Text>
              <Text weight="semibold">Where to buy.</Text>{" "}
              {stateOf(p) === "OK"
                ? "Southeast and east Oklahoma (Pushmataha, Latimer, Le Flore, McCurtain, Pittsburg counties) get 40–55 inches of rain a year, have timber for firewood, and still sell raw land near $1,500/acre. Western Oklahoma land is cheaper but gets 20–30 inches of rain, with little wood and a lot of wind."
                : `${st.region}. Expect about ${money(sEst(stateOf(p)).landPerAcre)}/acre, ${st.rain} of rain, a growing season of ${st.growing}, and winter lows of ${st.winterLow}. ${st.upside}.`}
            </Text>
            <Text>
              <Text weight="semibold">Water rights.</Text>{" "}
              {stateOf(p) === "OK"
                ? "Domestic use of groundwater and of stream water crossing your land needs no permit. Irrigating or damming a stream beyond domestic use requires a permit from the Oklahoma Water Resources Board (OWRB)."
                : `${st.water}.`}{" "}
              A spring or a creek that runs year-round is worth paying extra for. A pond is only as good as its watershed
              in a drought.
            </Text>
            <Text>
              <Text weight="semibold">Well.</Text> {loc.well}.
            </Text>
          </Stack>
          <Stack gap={8}>
            <Text>
              {housingOf(p) === "house" ? (
                <>
                  <Text weight="semibold">Living in a small house.</Text> {loc.rvLiving}. {loc.septic}. The house is wired for the power setup in Assumptions. A permanent dwelling can qualify for a homestead credit. Check the deed for a minimum house size.
                </>
              ) : (
                <>
                  <Text weight="semibold">Living in an RV.</Text> {loc.rvLiving}. {loc.septic}. Buy a four-season unit and plan to have the pole barn or cabin take over as the real shelter within 5–10 years.
                </>
              )}
            </Text>
            <Text>
              <Text weight="semibold">Property tax.</Text> {loc.propertyTax}.
            </Text>
            <Text>
              <Text weight="semibold">Hardest part.</Text> {st.downside}.
            </Text>
          </Stack>
        </Grid>
      </Stack>
      )}
    </Stack>
  );
}
