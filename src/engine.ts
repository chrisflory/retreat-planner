// Money engine: pure planning data and the year-by-year simulation.
// No React here, so it can be unit tested.

export type Status = "mfj" | "single";
export type Strategy = "lump" | "split" | "asNeeded";
export type PowerMode = "grid" | "hybrid" | "offgrid" | "offgridAC";
export type HeatMode = "propane" | "both" | "wood";
export type Housing = "rv" | "house";

export const isLump = (p: { strategy: Strategy }) => p.strategy !== "asNeeded";

export type Params = {
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

export type StateId = "OK" | "MT" | "WY" | "ID" | "SD" | "ND" | "TN" | "AR" | "MO" | "WV" | "MS";

export type StateInfo = {
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

export const STATES: Record<StateId, StateInfo> = {
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

export const STATE_IDS = Object.keys(STATES) as StateId[];
export const NO_INCOME_TAX = new Set<StateId>(["WY", "SD", "TN"]);

export type StateLocal = {
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

export const LOCAL: Record<StateId, StateLocal> = {
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

export type StateEst = {
  landPerAcre: number;
  propaneGal: number;
  baseGal: number;
  propTax: number;
  winterShelter: number;
  cords: number;
  stove: number;
};

export type Estimates = {
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

export const DEFAULT_EST: Estimates = {
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

export function mergeEst(stored: Partial<Estimates> | null | undefined): Estimates {
  const s = stored ?? {};
  return {
    ...DEFAULT_EST,
    ...s,
    states: Object.fromEntries(
      STATE_IDS.map((id) => [id, { ...DEFAULT_EST.states[id], ...(s.states?.[id] ?? {}) }]),
    ) as Record<StateId, StateEst>,
  };
}

export let EST: Estimates = DEFAULT_EST;
export const sEst = (id: StateId) => EST.states[id];

export const HEAT: Record<HeatMode, { label: string; summary: string }> = {
  propane: { label: "Propane", summary: "The RV furnace and appliances run on propane. It's easy, but it's the costliest heat and depends on deliveries." },
  both: { label: "Wood stove, propane backup", summary: "A wood stove carries most of the winter. Propane covers cooking, hot water, the fridge and cold snaps when you're away or sick." },
  wood: { label: "Wood only (propane for cooking)", summary: "All heat from wood. Propane only for cooking, hot water and the fridge, so a small tank lasts most of a year." },
};
export const HEAT_IDS = Object.keys(HEAT) as HeatMode[];
export function heatPlan(id: StateId, mode: HeatMode) {
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

export function derivedForState(id: StateId, heat: HeatMode) {
  const e = sEst(id);
  const h = heatPlan(id, heat);
  return {
    up: { land: Math.round(e.landPerAcre * EST.acres), winter: e.winterShelter, woodheat: h.stove },
    rec: { propane: Math.round(h.propaneGal * EST.propanePrice), firewood: h.firewood, proptax: e.propTax },
  };
}

export type HazardCat = "Weather" | "Fire + drought" | "Wildlife + insects" | "Geologic + tropical";
export const HAZARDS: Array<{ id: string; label: string; cat: HazardCat }> = [
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
export const HAZARD_LEVEL = ["Low", "Moderate", "High", "Severe"];

export const HAZ: Record<StateId, { r: number[]; snakes: string; er: string; frost: string }> = {
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

export const HAZARD_PREP: Array<[string, string, string, string]> = [
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
export const stateOf = (p: Params): StateId => (p.state && STATES[p.state] ? p.state : "OK");

export function applyState(
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

export const DEFAULT_PARAMS: Params = {
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

export const POWER: Record<
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
export const POWER_IDS = Object.keys(POWER) as PowerMode[];
export const housingOf = (p: { housing?: Housing }): Housing => (p.housing === "house" ? "house" : "rv");

export const EGGS_PER_HEN = 200;
export const chickenUpkeep = (hens: number) => Math.round(Math.max(0, hens) * (350 / 6));

export const KCAL_VENISON_LB = 550;
export const KCAL_HOG_LB = 800;
export const KCAL_LARD_LB = 4000;
export const KCAL_PER_PERSON_YEAR = 2200 * 365;

export const PER_PERSON_RECURRING = new Set(["food", "aca", "medicare", "oop", "household"]);
export const PER_PERSON_UPFRONT = new Set(["food", "medical"]);

export const adultsOf = (p: Params) => Math.max(1, Math.round(p.adults));
export const peopleLabel = (n: number) => (n === 1 ? "one adult" : `${n} adults`);
export const recAmount = (rec: Record<string, number>, id: string, p: Params) =>
  (rec[id] ?? 0) * (PER_PERSON_RECURRING.has(id) ? adultsOf(p) : 1);
export const upAmount = (up: Record<string, number>, id: string, p: Params) =>
  (up[id] ?? 0) * (PER_PERSON_UPFRONT.has(id) ? adultsOf(p) : 1);
export const acaCliff = (p: Params) => 4 * (15650 + 5500 * (adultsOf(p) - 1));

export type Group = "core" | "hardening" | "hunting" | "food";

export function homeCounted(u: { id: string }, p: { housing?: Housing }): boolean {
  const house = housingOf(p) === "house";
  if (u.id === "rv" || u.id === "rvhookup") return !house;
  if (u.id === "houseShell" || u.id === "houseStove" || u.id === "houseWire") return house;
  // The house is the winter home. The cabin line is the RV plan's backup room.
  // The house stove line replaces the RV wood-stove line so it is not counted twice.
  if (house && (u.id === "winter" || u.id === "cabin" || u.id === "woodheat")) return false;
  return true;
}

export function groupOf(u: UpfrontItem, p: Params): Group {
  if (u.food) return "food";
  if (u.hunting) return "hunting";
  if (u.id === "offgrid" && p.powerMode !== "grid") return "core";
  return u.hardening ? "hardening" : "core";
}

export function foodCounted(u: UpfrontItem, p: Params) {
  if (u.food === "chickens") return p.chickens;
  if (u.food === "garden") return p.garden;
  return true;
}

export function upfrontTotalFor(p: Params, up: Record<string, number>): number {
  return UPFRONT.reduce((s, u) => {
    const g = groupOf(u, p);
    if (g === "hunting" && !p.hunting) return s;
    if (g === "hardening" && !p.hardening) return s;
    if (g === "food" && !foodCounted(u, p)) return s;
    if (!homeCounted(u, p)) return s;
    return s + upAmount(up, u.id, p);
  }, 0);
}


export function huntYield(p: Params) {
  const deerLb = p.deerPerYear * EST.deerLb;
  const hogLb = p.hogsPerYear * EST.hogLb;
  const elkLb = (p.elkPerYear ?? 0) * EST.elkLb;
  const lardLb = p.hogsPerYear * EST.lardLb;
  const kcal =
    (deerLb + elkLb) * KCAL_VENISON_LB + hogLb * KCAL_HOG_LB + lardLb * KCAL_LARD_LB;
  const need = KCAL_PER_PERSON_YEAR * adultsOf(p);
  return { deerLb, hogLb, elkLb, lardLb, meatLb: deerLb + hogLb + elkLb, kcal, need, share: kcal / need };
}

export type UpfrontItem = {
  id: string;
  label: string;
  note: string;
  hardening: boolean;
  hunting?: boolean;
  food?: "chickens" | "garden";
};

export const UPFRONT: UpfrontItem[] = [
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

export const PRESET_PLANNED: Record<string, number> = {
  land: 75000, winter: 0, rv: 40000, houseShell: 32000, houseStove: 5000, houseWire: 8000, closing: 3000, well: 15000, septic: 9000, power: 10000,
  rvhookup: 2500, starlink: 500, generator: 1200, pad: 5000,
  barn: 10000, shelter: 5000, safety: 1200, propane: 3500, woodheat: 0, tractor: 10000, fence: 5000,
  handpump: 3000, offgrid: 15000, cabin: 15000, food: 3000, garden: 800, coop: 2200, plot: 1600, rain: 3000,
  medical: 1000, comms: 2500, fuel: 3000,
  rifle: 1000, hogtrap: 1500, stand: 600, butcher: 500, freezer: 700, canner: 700,
};

export const PRESET_LEAN: Record<string, number> = {
  land: 75000, winter: 0, rv: 30000, houseShell: 20000, houseStove: 4000, houseWire: 6000, closing: 2500, well: 12000, septic: 7000, power: 6000,
  rvhookup: 1500, starlink: 400, generator: 800, pad: 3000,
  barn: 0, shelter: 4000, safety: 800, propane: 3000, woodheat: 0, tractor: 5000, fence: 0,
  handpump: 2500, offgrid: 8000, cabin: 6000, food: 2000, garden: 400, coop: 1100, plot: 700, rain: 1500,
  medical: 750, comms: 1000, fuel: 2000,
  rifle: 0, hogtrap: 800, stand: 200, butcher: 300, freezer: 500, canner: 450,
};

export type AgeRule = "all" | "pre65" | "post65";
export type RecurringItem = { id: string; label: string; rule: AgeRule; collapse: string };

export const RECURRING: RecurringItem[] = [
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

export const RECURRING_DEFAULTS: Record<string, number> = {
  food: 3600, hunt: 400, water: 300, proptax: 500, hoa: 0, propane: 1500, firewood: 0, electric: 1500, gas: 1000, autoins: 1400,
  rvins: 1000, liability: 500, aca: 3000, medicare: 4750, oop: 750, sos: 200, internet: 1900, maint: 2500,
  septic: 200, household: 1200, garden: 350, chickens: 350, trash: 200, rvreserve: 2500,
};

export const LIVING_PRESETS: Record<"bare" | "modest" | "comfortable", { label: string; note: string; values: Record<string, number> }> = {
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
export type LivingPreset = keyof typeof LIVING_PRESETS;

export const FED: Record<Status, { std: number; brackets: Array<[number, number]> }> = {
  mfj: {
    std: 32200,
    brackets: [[24800, 0.1], [100800, 0.12], [211400, 0.22], [403550, 0.24], [512450, 0.32], [768700, 0.35], [1e12, 0.37]],
  },
  single: {
    std: 16100,
    brackets: [[12400, 0.1], [50400, 0.12], [105700, 0.22], [201775, 0.24], [256225, 0.32], [640600, 0.35], [1e12, 0.37]],
  },
};

export const MIN_PLAN_AGE = 40;
export const MAX_PLAN_AGE = 75;
export const clampPlanAge = (n: number) =>
  Math.min(MAX_PLAN_AGE, Math.max(MIN_PLAN_AGE, Math.round(Number.isFinite(n) ? n : MIN_PLAN_AGE)));
export const startAge = (p: { retireAge?: number }) => clampPlanAge(p.retireAge ?? 58);

export function ageNowFrom(p: { ageNow?: number; retireAge?: number; startYear?: number }) {
  if (p.ageNow != null && Number.isFinite(p.ageNow)) return clampPlanAge(p.ageNow);
  return clampPlanAge((p.retireAge ?? 58) - yearsToRetire(p));
}

export const DEFERRAL_BASE = 23500;
export const DEFERRAL_CATCHUP = 31000;

export function deferralNote(p: Params, contrib: number) {
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
export const rule55Applies = (p: Params) => p.rule55 && startAge(p) >= 55;
export const END_AGE = 95;
export const THIS_YEAR = new Date().getFullYear();

export function yearsToRetire(p: { startYear?: number }) {
  return Math.max(0, Math.round(p.startYear ?? THIS_YEAR) - THIS_YEAR);
}

/** Full retirement age in months, from the Social Security birth-year table. */
export function fraMonths(birthYear: number): number {
  if (birthYear <= 1937) return 65 * 12;
  if (birthYear >= 1960) return 67 * 12;
  if (birthYear >= 1943) return 66 * 12;
  return 65 * 12 + (birthYear - 1937) * 2;
}

export function fraText(months: number) {
  const years = Math.floor(months / 12);
  const extra = months % 12;
  return extra === 0 ? `age ${years}` : `${years} and ${extra} months`;
}

/** Share of the full benefit paid at claimAge. Credits stop at 70 and payments don't start before 62. */
export function ssBenefitFactor(claimAge: number, fraM: number) {
  const claimM = Math.min(70 * 12, Math.max(62 * 12, Math.round(claimAge * 12)));
  const early = fraM - claimM;
  if (early > 0) {
    const first = Math.min(early, 36);
    const rest = Math.max(0, early - 36);
    return 1 - (first * (5 / 9) + rest * (5 / 12)) / 100;
  }
  return 1 + Math.max(0, claimM - fraM) * (2 / 3) / 100;
}

export function clampSsAge(n: number) {
  const months = Math.round((Number.isFinite(n) ? n : 67) * 12);
  return Math.min(70 * 12, Math.max(62 * 12, months)) / 12;
}

export function ssPiaOf(p: { ssPia?: number; ssMonthly?: number; ssAge?: number }, ageNow: number) {
  if (p.ssPia != null && Number.isFinite(p.ssPia)) return Math.max(0, p.ssPia);
  const factor = ssBenefitFactor(p.ssAge ?? 62, fraMonths(THIS_YEAR - Math.round(ageNow)));
  return factor > 0 ? Math.max(0, (p.ssMonthly ?? 0) / factor) : 0;
}

export function ssMonthlyAt(pia: number, claimAge: number, ageNow: number) {
  return Math.round(pia * ssBenefitFactor(claimAge, fraMonths(THIS_YEAR - Math.round(ageNow))));
}

export function linkAges(prev: Partial<Params>, which: "now" | "retire" | "year", n: number): Params {
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

export function nestEgg(p: Params) {
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
export const goalOf = (p: Params) => Math.min(END_AGE, Math.max(startAge(p) + 1, Math.round(p.goalAge ?? 85)));

export function fedTax(income: number, status: Status, age: number, factor = 1): number {
  const extraStd = (age >= 65 ? (status === "mfj" ? 3300 : 2050) : 0) * factor;
  const taxable = Math.max(0, income - FED[status].std * factor - extraStd);
  let tax = 0;
  let prev = 0;
  for (const [top, rate] of FED[status].brackets) {
    const ceiling = top * factor;
    if (taxable <= prev) break;
    tax += (Math.min(taxable, ceiling) - prev) * rate;
    prev = ceiling;
  }
  return tax;
}

/** IRS Publication 915. The $25k/$34k and $32k/$44k thresholds are not indexed by law; the plan scales them with the chart line's inflation so a benefit that is untaxed on day one stays untaxed in real terms. */
export function taxableSocialSecurity(ss: number, otherIncome: number, status: Status, factor: number): number {
  if (ss <= 0) return 0;
  const base = (status === "mfj" ? 32000 : 25000) * factor;
  const upper = (status === "mfj" ? 44000 : 34000) * factor;
  const combined = otherIncome + ss * 0.5;
  if (combined <= base) return 0;
  const tier1 = Math.min(ss * 0.5, Math.min(upper - base, combined - base) * 0.5);
  if (combined <= upper) return tier1;
  return Math.min(ss * 0.85, tier1 + 0.85 * (combined - upper));
}

export function stateTax(w: number, p: Params): number {
  return STATES[stateOf(p)].tax(w, p.status === "mfj", Math.max(0, w - FED[p.status].std));
}

export function taxOnWithdrawal(
  w: number,
  p: Params,
  age: number,
  inTexas = false,
  ss = 0,
  other = 0,
  factor = 1,
) {
  const ordinary = Math.max(0, w) + Math.max(0, other);
  const fed = fedTax(
    ordinary + taxableSocialSecurity(Math.max(0, ss), ordinary, p.status, factor),
    p.status,
    age,
    factor,
  );
  // Scale dollar exemptions and brackets by computing the tax in retirement-year dollars.
  const ok = inTexas || factor <= 0 ? 0 : stateTax(ordinary / factor, p) * factor;
  const penalty = !rule55Applies(p) && age < 59.5 ? 0.1 * Math.max(0, w) : 0;
  return { fed, ok, penalty, total: fed + ok + penalty };
}

export function ssPay(p: Params, t: number, infPct: number): number {
  if (startAge(p) + t < p.ssAge) return 0;
  const f = Math.pow(1 + infPct / 100, t);
  const cut = p.ssCut && p.startYear + t >= EST.ssCutYear ? EST.ssCutPct / 100 : 1;
  return Math.max(0, p.ssMonthly) * 12 * f * cut;
}

export function otherPay(p: Params, t: number): number {
  return startAge(p) + t < p.otherUntil ? Math.max(0, p.otherIncome) : 0;
}

/** Tax on a split or lump withdrawal, one slice per tax year, with that year's Social Security in the same return. */
export function lumpSumTax(p: Params, infPct = p.inflation, bonus = 0, bonusUntil = -1) {
  const parts = p.strategy === "split" ? 2 : 1;
  const slice = p.k401 / parts;
  let fed = 0;
  let ok = 0;
  let penalty = 0;
  for (let t = 0; t < parts; t++) {
    const age = startAge(p) + t;
    const factor = Math.pow(1 + infPct / 100, t);
    const side = otherPay(p, t) + (bonus > 0 && age <= bonusUntil ? bonus : 0);
    const one = taxOnWithdrawal(slice, p, age, p.txMove, ssPay(p, t, infPct), side, factor);
    fed += one.fed;
    ok += one.ok;
    penalty += one.penalty;
  }
  return { fed, ok, penalty, total: fed + ok + penalty };
}

export function grossUp(
  need: number,
  p: Params,
  age: number,
  inTexas: boolean,
  ss: number,
  other: number,
  factor: number,
): number {
  const base = taxOnWithdrawal(0, p, age, inTexas, ss, other, factor).total;
  let w = Math.max(0, need);
  for (let i = 0; i < 40; i++) {
    const extra = taxOnWithdrawal(w, p, age, inTexas, ss, other, factor).total - base;
    w = Math.max(0, need + extra);
  }
  return w;
}

export function annualCost(
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

export function meatOffset(rec: Record<string, number>, p: Params): number {
  if (!p.hunting) return 0;
  return Math.min(huntYield(p).meatLb * p.meatValue, recAmount(rec, "food", p) * 0.5);
}

export function eggPlan(p: Params) {
  const hens = Math.max(0, Math.round(p.hens ?? 6));
  const dozens = (hens * EGGS_PER_HEN) / 12;
  return { hens, dozens, value: dozens * Math.max(0, p.eggDozen ?? 4) };
}

export function gardenGrocery(p: Params) {
  return Math.max(0, p.gardenSave ?? 700) * (adultsOf(p) === 1 ? 1 : 1.6);
}

export function foodOffset(rec: Record<string, number>, p: Params) {
  const food = recAmount(rec, "food", p);
  const meat = meatOffset(rec, p);
  const eggs = p.chickens ? eggPlan(p).value : 0;
  const veg = p.garden ? gardenGrocery(p) : 0;
  return { meat, eggs, veg, used: Math.min(food * 0.65, meat + eggs + veg), cap: food * 0.65 };
}

export type SimResult = {
  balances: number[];
  depletedAge: number | null;
  year0Gross: number;
  year0Tax: number;
  year0Cost: number;
  year0FromSavings: number;
  stranded: number | null;
};


export function loanTerms(p: Params, land: number) {
  if (!p.finance || land <= 0) return { financed: 0, payment: 0, years: 0, interest: 0 };
  const financed = land * (1 - Math.min(100, Math.max(0, p.downPct)) / 100);
  const n = Math.max(1, Math.round(p.loanYears));
  const r = p.loanRate / 100;
  const payment = r > 0 ? (financed * r) / (1 - Math.pow(1 + r, -n)) : financed / n;
  return { financed, payment, years: n, interest: payment * n - financed };
}

export type SimAdjust = { spendCut?: number; extraIncome?: number; incomeUntil?: number };

export function simulate(
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
    year0Tax = lumpSumTax(
      { ...p, k401: egg.k401 },
      inflationPct,
      adjust?.extraIncome ?? 0,
      adjust?.incomeUntil ?? -1,
    ).total;
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
    const otherOrdinary = (age < p.otherUntil ? p.otherIncome : 0) + bonus;
    const ssCheck = (age >= p.ssAge ? p.ssMonthly * 12 * f * ssFactor : 0);
    const income = ssCheck + otherOrdinary;
    const extra = (t === 0 ? upfront - loan.financed : 0) + (t < loan.years ? loan.payment : 0);

    if (isLump(p)) {
      const unsub = t === 0 || (t === 1 && p.strategy === "split") || balance * rCash > cliff;
      const living = annualCost(rec, age, p, unsub) * f;
      const cost = living - Math.min(living, Math.max(0, adjust?.spendCut ?? 0) * f);
      if (t === 0) year0Cost = cost;
      // Withdrawal-year tax, including that year's Social Security, is already in year0Tax.
      const laterTax =
        t >= (p.strategy === "split" ? 2 : 1)
          ? taxOnWithdrawal(0, p, age, false, ssCheck, otherOrdinary, f).total
          : 0;
      const after = balance - (cost - income + extra + laterTax);
      balance = after > 0 ? after * (1 + rCash) : after;
    } else {
      const inTexas = t === 0 && p.txMove;
      const plan = (unsub: boolean) => {
        const living = annualCost(rec, age, p, unsub) * f;
        const cost = living - Math.min(living, Math.max(0, adjust?.spendCut ?? 0) * f);
        const gap = cost - income + extra;
        const baseTax = taxOnWithdrawal(0, p, age, inTexas, ssCheck, otherOrdinary, f).total;
        const gapTax = gap + baseTax;
        const fromCash = Math.min(cash, Math.max(0, gapTax));
        const need = gapTax - fromCash;
        const w = need > 0 && balance > 0 ? grossUp(need, p, age, inTexas, ssCheck, otherOrdinary, f) : 0;
        const tax = taxOnWithdrawal(w, p, age, inTexas, ssCheck, otherOrdinary, f).total;
        return { cost, gapTax, fromCash, need, w, tax };
      };
      let s = plan(false);
      if (s.w > cliff) s = plan(true);
      if (t === 0) {
        year0Gross = s.w;
        year0Tax = s.tax;
        year0Cost = s.cost;
        year0FromSavings = s.fromCash;
      }
      cash -= s.fromCash;
      if (s.gapTax < 0) cash += -s.gapTax;
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

export const covers = (sim: SimResult, goal: number) => sim.depletedAge === null || sim.depletedAge > goal;

export function leastThatCovers(probe: (n: number) => boolean): number | null {
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

export function setEstimates(next: Estimates) {
  EST = next;
}
