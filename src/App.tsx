import { useEffect, useMemo, useState, type ReactNode } from "react";
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
  Section,
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
  exportPlanFile,
  importPlanFile,
  makePlan,
  planFromFile,
  uniqueName,
  upsertPlan,
  type PlanData,
  type SavedPlan,
} from "./plans";
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

import {
  isLump,
  STATES,
  STATE_IDS,
  NO_INCOME_TAX,
  LOCAL,
  DEFAULT_EST,
  mergeEst,
  EST,
  sEst,
  HEAT,
  HEAT_IDS,
  heatPlan,
  derivedForState,
  HAZARDS,
  HAZARD_LEVEL,
  HAZ,
  HAZARD_PREP,
  stateOf,
  applyState,
  DEFAULT_PARAMS,
  POWER,
  POWER_IDS,
  housingOf,
  EGGS_PER_HEN,
  chickenUpkeep,
  KCAL_VENISON_LB,
  KCAL_HOG_LB,
  KCAL_LARD_LB,
  KCAL_PER_PERSON_YEAR,
  PER_PERSON_RECURRING,
  PER_PERSON_UPFRONT,
  adultsOf,
  peopleLabel,
  recAmount,
  upAmount,
  acaCliff,
  homeCounted,
  groupOf,
  foodCounted,
  upfrontTotalFor,
  huntYield,
  UPFRONT,
  PRESET_PLANNED,
  PRESET_LEAN,
  RECURRING,
  RECURRING_DEFAULTS,
  LIVING_PRESETS,
  FED,
  MIN_PLAN_AGE,
  MAX_PLAN_AGE,
  clampPlanAge,
  startAge,
  ageNowFrom,
  DEFERRAL_BASE,
  DEFERRAL_CATCHUP,
  deferralNote,
  rule55Applies,
  END_AGE,
  THIS_YEAR,
  yearsToRetire,
  fraMonths,
  fraText,
  ssBenefitFactor,
  clampSsAge,
  ssPiaOf,
  ssMonthlyAt,
  linkAges,
  nestEgg,
  goalOf,
  fedTax,
  taxableSocialSecurity,
  stateTax,
  taxOnWithdrawal,
  ssPay,
  otherPay,
  lumpSumTax,
  grossUp,
  annualCost,
  meatOffset,
  eggPlan,
  gardenGrocery,
  foodOffset,
  loanTerms,
  simulate,
  covers,
  leastThatCovers,
  type Status,
  type Strategy,
  type PowerMode,
  type HeatMode,
  type Housing,
  type Params,
  type StateId,
  type StateInfo,
  type StateLocal,
  type StateEst,
  type Estimates,
  type HazardCat,
  type Group,
  type UpfrontItem,
  type AgeRule,
  type RecurringItem,
  type LivingPreset,
  type SimResult,
  type SimAdjust,
  setEstimates,
  marketOdds,
  recoveryAge,
  unpaidThrough,
  badStartReturns,
  hasSpouse,
  fplOf,
  type HealthPlan,
} from "./engine";

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
  "Living in":
    "Used RV keeps the trailer and its costs. Small house / shelter replaces them with a shell, a wood stove, and wiring. Well, septic, and power stay on their own lines. Setting an RV cost to $0 does not switch this.",
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
  aca: "ACA marketplace health insurance (healthcare.gov) before Medicare. Only used when pricing from income is off in Assumptions. Then it's the subsidized price, and a year with income past 400% of the poverty line uses the full price instead.",
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
  setEstimates(mergeEst(readStored<Partial<Estimates>>("estimates-v1", {})));
  if (acres > 0) {
    setEstimates({ ...EST, acres });
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
  setEstimates(mergeEst(readStored<Partial<Estimates>>("estimates-v1", {})));
  const id = (c.state && STATES[c.state as StateId] ? c.state : stateOf(p)) as StateId;
  if (id !== stateOf(p)) [p, up, rec] = applyState(id, p, up, rec);
  up = { ...up, land: Math.max(0, Math.round(c.priceMax)) };
  setEstimates({ ...EST, acres: clampAcresToRange(c.acresMin, c.acresMax) });
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
  setEstimates(mergeEst(readStored<Partial<Estimates>>("estimates-v1", {})));
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
  const [savedPlans, setSavedPlans] = useCanvasState<SavedPlan[]>("saved-plans-v1", []);
  const [planName, setPlanName] = useState("");
  const [planStatus, setPlanStatus] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const currentPlan = (): PlanData => ({
    params: storedP as unknown as Record<string, unknown>,
    upfront: storedUp,
    recurring: storedRec,
    estimates: storedEst as Record<string, unknown>,
    chosen: chosenStored,
  });
  const savePlan = () => {
    const name = planName.trim() || `Plan ${new Date().toLocaleDateString("en-US")}`;
    const exists = savedPlans.some((x) => !x.auto && x.name.toLowerCase() === name.toLowerCase());
    setSavedPlans((list) => upsertPlan(list, makePlan(name, currentPlan())));
    setPlanName(name);
    setPlanStatus({ tone: "ok", text: exists ? `Updated "${name}" with what's entered now.` : `Saved "${name}".` });
  };
  const loadPlan = (plan: SavedPlan) => {
    const keep = `Before loading ${plan.name}`;
    setSavedPlans((list) => upsertPlan(list, makePlan(keep, currentPlan(), true)));
    setP(plan.params as unknown as Params);
    setUp(plan.upfront);
    setRec(plan.recurring);
    setStoredEst(plan.estimates as Partial<Estimates>);
    setEstimates(mergeEst(plan.estimates as Partial<Estimates>));
    setChosen((plan.chosen ?? null) as ChosenLand | null);
    if (!plan.auto) setPlanName(plan.name);
    setPlanStatus({ tone: "ok", text: `Loaded "${plan.name}". What you had before is kept as "${keep}".` });
  };
  const deletePlan = (plan: SavedPlan) => {
    setSavedPlans((list) => list.filter((x) => x !== plan && !(x.name === plan.name && x.savedAt === plan.savedAt)));
    setPlanStatus({ tone: "ok", text: `Deleted "${plan.name}".` });
  };
  const exportPlan = async (plan: SavedPlan) => {
    try {
      const where = await exportPlanFile(plan);
      if (where !== null) setPlanStatus({ tone: "ok", text: where ? `Exported "${plan.name}" to ${where}.` : `Downloaded "${plan.name}".` });
    } catch (e) {
      setPlanStatus({ tone: "error", text: `Couldn't export: ${e instanceof Error ? e.message : String(e)}` });
    }
  };
  const importPlan = async () => {
    try {
      const text = await importPlanFile();
      if (text === null) return;
      const plan = planFromFile(text);
      const name = uniqueName(savedPlans, plan.name);
      setSavedPlans((list) => upsertPlan(list, { ...plan, name }));
      setPlanStatus({ tone: "ok", text: `Imported "${name}". Click Load to use it.` });
    } catch (e) {
      setPlanStatus({ tone: "error", text: e instanceof Error ? e.message : String(e) });
    }
  };
  const [landListings, setLandListings] = useCanvasState<ListingDeedSource[]>("land-listings-v1", []);
  const chosen = resolveChosen(chosenStored, landListings);
  setEstimates(mergeEst(storedEst));
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
    setEstimates(next);
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
    setEstimates(DEFAULT_EST);
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
  /** The preset whose amounts all match the living costs now. None once any of its lines is edited. */
  const activeLiving = (Object.keys(LIVING_PRESETS) as LivingPreset[]).find((id) =>
    Object.entries(LIVING_PRESETS[id].values).every(([k, v]) => (rec[k] ?? 0) === v),
  );
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

  /** The plan's pre-65 health premium at an age (today's dollars), or the flat line when income-based is off. */
  const healthAtAge = (age: number): boolean | number => {
    if (p.acaByIncome === false || age >= 65) return false;
    const h = normal.health[age - startAge(p)];
    return h ? h.cost : false;
  };
  const steadyPre65 = annualCost(rec, Math.max(60, startAge(p) + 1), p, healthAtAge(Math.max(60, startAge(p) + 1)));
  const livingAtStart = annualCost(rec, startAge(p), p, healthAtAge(startAge(p)));
  const steadyPost65 = annualCost(rec, 66, p, false);
  // The household's yearly check when it starts, in today's dollars, after any cut and with a spouse's check.
  const ssAnnual = ssPay(p, Math.max(0, p.ssAge - startAge(p)), 0);

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
      // Today's dollars, to match the rest of the chart.
      const deflate = Math.pow(1 + p.inflation / 100, age - nowAge);
      if (age < retireAt) {
        beforeWithdrawals.push(Math.round((k401 + savingsNow) / deflate));
        k401 = k401 * (1 + r401) + contrib;
        savingsNow = savingsNow * (1 + rCash) + save;
      } else if (age === retireAt) {
        beforeWithdrawals.push(Math.round(egg.k401 + egg.savings));
      } else {
        beforeWithdrawals.push(null);
      }
    }
  }
  /** A scenario's balances in today's dollars (the plan's costs are in today's dollars too), using that scenario's inflation. */
  const afterLine = (sim: SimResult, infPct = p.inflation): (number | null)[] =>
    ages.map((_, i) => {
      const age = nowAge + i;
      if (age < retireAt) return null;
      const k = age - retireAt;
      const v = sim.balances[k];
      if (v == null) return null;
      return Math.round(Math.max(0, v) / Math.pow(1 + infPct / 100, k));
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
  const roughSim = isLump(p)
    ? null
    : simulate(p, rec, upfrontTotal, p.inflation, null, land, { returns: badStartReturns(p) });
  // Market odds run a few hundred simulations, so only redo them when an input changes.
  const oddsKey = part === "sustain" ? "" : JSON.stringify([p, rec, upfrontTotal, land, goal, EST]);
  const odds = useMemo(
    () => (part === "sustain" ? null : marketOdds(p, rec, upfrontTotal, p.inflation, land, goal)),
    [oddsKey],
  );
  const backAt = recoveryAge(normal, startAge(p));
  const unpaidGap =
    normal.depletedAge !== null ? unpaidThrough(normal, startAge(p), (backAt ?? END_AGE + 1) - 1) : 0;
  const incomeNames = (p.otherIncome ?? 0) > 0 ? "Social Security and part-time pay" : "Social Security";
  const oddsPct = odds ? Math.round(odds.chance * 100) : 0;
  const oddsTone: "success" | "warning" | "danger" = oddsPct >= 85 ? "success" : oddsPct >= 60 ? "warning" : "danger";
  const pre65Health = normal.health.slice(0, Math.max(0, 65 - retireAt));
  const HEALTH_LABEL: Record<HealthPlan["kind"], string> = {
    medicaid: "Medicaid",
    subsidized: "Subsidized",
    full: "Full price",
    gap: "Coverage gap",
  };

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
    .map((i) => {
      const h = i.id === "aca" ? healthAtAge(Math.max(60, startAge(p) + 1)) : false;
      const label = i.id === "aca" && typeof h === "number" ? "Health insurance (from income)" : (i.id === "rvins" && housingOf(p) === "house" ? "Dwelling insurance" : i.label).split(" (")[0];
      return { label, value: typeof h === "number" ? Math.round(h) : recAmount(rec, i.id, p) };
    })
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

  const livingChoice = (
    <Stack gap={4}>
      <Row gap={8} wrap align="center">
        <Text size="small" tone="secondary">
          Living in
        </Text>
        <Pill size="sm" active={housingOf(p) === "rv"} onClick={() => set("housing", "rv")}>
          Used RV
        </Pill>
        <Pill size="sm" active={housingOf(p) === "house"} onClick={() => set("housing", "house")}>
          Small house / shelter
        </Pill>
      </Row>
      <Text size="small" tone="tertiary">
        {housingOf(p) === "house"
          ? "The plan uses a shell, a wood stove, and wiring. The RV, the pedestal, and the RV replacement fund are left out. Well, septic, and power stay separate."
          : "The plan uses a used RV. Choosing Small house / shelter replaces those costs. Setting the RV line to $0 does not switch the plan."}
      </Text>
    </Stack>
  );

  return (
    <Stack gap={20}>
      {part !== "sustain" && (
      <>
      <Stack gap={6}>
        <H1>{st.name} land retreat: retirement cash plan</H1>
        {livingChoice}
        <Text tone="secondary">
          Household of {who}, age {ageNowFrom(p)}, retiring at {startAge(p)} in {p.startYear}, living in{" "}
          {housingOf(p) === "house" ? "a small house" : "an RV"} on {est.acres} acres in {st.name}
          {linked.saved ? ` (${linked.counties})` : ""}. Land is budgeted at {money(land)}. Every number with a box is
          editable, and everything recomputes as you type.
        </Text>
        <details className="method">
          <summary>How the math works</summary>
          <Text size="small" tone="secondary">
            Costs marked "per person" scale with the household size. Taxes use 2026 federal brackets plus {st.name} state
            tax ({st.taxNote}). Brackets and the standard deduction rise with each chart line's inflation. The Social
            Security tax thresholds don't, because the law fixes them, so more of the benefit is taxed as prices rise.
            The $6,000 deduction for people 65 and older is counted for 2025 through 2028. Interest on cash is taxed the
            year after it's earned. State tax is on the 401(k) withdrawal
            {p.txMove ? ", except that the withdrawal is taken while you're still a Texas resident" : ""}. Health insurance
            before 65 is priced from each year's income with the 2026 ACA subsidy table
            {p.acaByIncome === false ? " (turned off in Assumptions, so the flat health line is used)" : ""}. Market
            odds replay retirement {odds && !odds.cashOnly ? odds.runs : 300} times with the 401(k) return swinging around
            its average by the amount in Assumptions. These are planning estimates, not tax or financial advice. Chickens,
            the garden, hunting, water and the grid-down plan are on the Self-reliance tab.
          </Text>
        </details>
      </Stack>

      <div className={`hero ${covered ? "ok" : "short"}`}>
        <div className="hero-verdict">
          <div className="hero-age">{lastsLabel(normal)}</div>
          <div className="hero-caption">Money lasts to age, normal economy</div>
          <div className="hero-goal">
            <span>{covered ? `Covers your goal of ${goal}` : `${goal - (normal.depletedAge ?? goal)} years short of ${goal}`}</span>
          </div>
          {backAt !== null && (
            <div className="hero-note">
              Back above $0 at {backAt}, when {incomeNames} starts to beat the bills
            </div>
          )}
        </div>
        <div className="hero-side">
          <Row gap={6} wrap align="center">
            <Text size="small" tone="secondary">
              Money needs to last through age
            </Text>
            {GOAL_AGES.map((age) => (
              <Pill key={age} size="sm" active={goal === age} onClick={() => set("goalAge", age)}>
                {age}
              </Pill>
            ))}
          </Row>
          <Grid columns={3} gap={12}>
            <Stat
              value={odds ? (odds.cashOnly ? (odds.chance ? "Yes" : "No") : `${oddsPct}%`) : "…"}
              label={odds?.cashOnly ? "Lasts to goal (cash, so markets don't move it)" : `Chance it lasts to ${goal} with market swings`}
              tone={odds?.cashOnly ? (odds.chance ? "success" : "danger") : oddsTone}
            />
            <Stat
              value={roughSim ? lastsLabel(roughSim) : "—"}
              label={roughSim ? "Rough market start: lasts to age" : "Rough start: no effect on cash"}
              tone={roughSim ? (covers(roughSim, goal) ? "success" : "danger") : undefined}
            />
            <Stat
              value={lastsLabel(highInf)}
              label={`High inflation (${EST.highInflation}%): lasts to age`}
              tone={covers(highInf, goal) ? "success" : "danger"}
            />
          </Grid>
        </div>
      </div>

      <div className="jump-nav">
        {[
          ["assumptions", "Assumptions"],
          ["whatifs", "What-ifs"],
          ["states", "States"],
          ["allocation", "Where it goes"],
          ["texas", "Texas move"],
          ["setup", "Setup costs"],
          ["living", "Living costs"],
          ["estimates", "Estimates"],
          ["power", "Power"],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            className="jump-link"
            onClick={() => document.getElementById(`sec-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}
          >
            {label}
          </button>
        ))}
      </div>

      <Callout
        tone={covered ? "success" : "warning"}
        title={covered ? `Covered through age ${goal}` : `Runs out at ${lastsLabel(normal)}, short of ${goal}`}
      >
        {covered
          ? `With the numbers entered now, money lasts to age ${lastsLabel(normal)}. Pick a later age to see what that would take.`
          : `That's ${goal - (normal.depletedAge ?? goal)} years early.${
              backAt !== null
                ? ` From ${normal.depletedAge} to ${backAt - 1} about ${money(unpaidGap)} of bills (today's dollars) have nothing to pay them. From ${backAt} on, ${incomeNames} is more than the budgeted bills, so the leftover builds up again and the chart line climbs back. That money only exists if you really spend no more than the budget.`
                : ""
            } Keeping everything else the same, either of these closes the gap:`}
        {!covered && (
          <Stack gap={4} style={{ marginTop: 6 }}>
            <Text size="small">
              {spendCut === null
                ? "Spending less can't fix it. Even with living costs at $0, setup and taxes spend the account in the first years. Switch Withdrawal to \"As needed\", trim the setup, or add savings."
                : `Spend ${money(spendCut / 12)} less per month, leaving about ${money(Math.max(0, livingAtStart - spendCut) / 12)}/mo at age ${startAge(p)}. Both figures are today's dollars, and the cut rises with inflation.${cutCarriesFurther ? ` That same cut actually lasts to ${cutLasts}: this plan fails in the first years, and covering those covers the later ones too.` : ""}`}
            </Text>
            <Text size="small">
              {extraIncome === null
                ? "Extra income can't fix it either, for the same reason: the account is gone before the income can refill it."
                : `Or earn ${money(extraIncome)} more per year until age ${goal}, on top of any part-time income already entered. Type it into "Part-time income" and set "Part-time work until age" to ${goal}.`}
            </Text>
          </Stack>
        )}
      </Callout>

      <Callout tone={shortfall ? "danger" : "success"} title="How the money moves">
        {p.strategy === "lump"
          ? `Taking the full ${money(egg.k401)} in one year costs about ${money(normal.year0Tax)} in tax, which is more than the ${housingOf(p) === "house" ? "house" : "RV"}. `
          : p.strategy === "split"
          ? `Splitting the ${money(egg.k401)} across two tax years (December and January) costs about ${money(normal.year0Tax)} in tax. `
          : `Withdrawing as needed, year one still costs about ${money(normal.year0Tax)} in tax because the setup spending lands in that year. `}
        {`After ${money(upfrontTotal)} of land and setup, the household spends about ${money(livingAtStart)}/yr at age ${startAge(p)}`}
        {ssAnnual > 0
          ? `, with Social Security covering ${money(ssAnnual)}/yr starting at ${p.ssAge}.`
          : ", with no Social Security counted."}
        {shortfall
          ? ` Under these assumptions it runs out at ${lastsLabel(normal)}, before your target of ${goal}. What it takes to get there is just below.`
          : ` That covers your target of ${goal}.`}
      </Callout>

      {egg.years > 0 && (
        <Callout tone="info" title={`Working until ${p.startYear}`}>
          {egg.years === 1
            ? `One year of pay before retirement, during ${THIS_YEAR}.`
            : `${egg.years} years of pay before retirement, ${THIS_YEAR} through ${p.startYear - 1}.`}{" "}
          Nothing is withdrawn until then. The 401(k) goes from {money(p.k401)} today to{" "}
          {money(egg.k401Future)} in {p.startYear}, with {money(egg.contrib)} a year contributed and {p.ret}% growth.
          After {egg.years} {egg.years === 1 ? "year" : "years"} of {p.inflation}% inflation that buys what{" "}
          {money(egg.k401)} buys today, and the plan uses that figure, because the costs, the land and Social
          Security are all in today's dollars.
          {p.ret < p.inflation ? ` At ${p.ret}% growth the account loses ground to inflation every year until you retire.` : ""}{" "}
          {(p.savings ?? 0) > 0 || (egg.save ?? 0) > 0
            ? `Other savings go from ${money(p.savings ?? 0)} to ${money(egg.savingsFuture)} in ${p.startYear} (${money(egg.savings)} in today's dollars), with ${money(egg.save)} a year saved and ${p.cashReturn ?? 0}% interest. `
            : ""}
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
        <Stat value={`${money(livingAtStart / 12)}/mo`} label={`Living cost at ${startAge(p)} (${money(livingAtStart)}/yr), today's dollars`} />
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

      <div className="plan-main" id="sec-assumptions">
        <Card>
          <CardHeader>Assumptions</CardHeader>
          <CardBody>
            <div className="sections">
            <Section
              title="Saved plans"
              defaultOpen={false}
              summary={savedPlans.filter((x) => !x.auto).length ? `${savedPlans.filter((x) => !x.auto).length} saved` : "Save these entries to come back to them"}
            >
              <div className="plans">
                <Row gap={8} align="center">
                  <TextInput value={planName} onChange={setPlanName} placeholder="Name this plan, like Wyoming house at 67" style={{ flex: 1 }} />
                  <Pill onClick={savePlan}>Save</Pill>
                </Row>
                <Row gap={8} wrap>
                  <Pill size="sm" onClick={() => void exportPlan(makePlan(planName || "Current plan", currentPlan()))}>
                    Export current plan
                  </Pill>
                  <Pill size="sm" onClick={() => void importPlan()}>
                    Import a plan file
                  </Pill>
                </Row>
                {planStatus && <div className={`plan-status ${planStatus.tone}`}>{planStatus.text}</div>}
                {savedPlans.length > 0 && (
                  <div className="plan-list">
                    {savedPlans.map((plan) => (
                      <div key={`${plan.name}-${plan.savedAt}`} className={`plan-row${plan.auto ? " auto" : ""}`}>
                        <div className="plan-meta">
                          <div className="plan-name">{plan.name}</div>
                          <div className="plan-date">
                            {plan.auto ? "Kept automatically · " : ""}
                            {new Date(plan.savedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
                          </div>
                        </div>
                        <Pill size="sm" onClick={() => loadPlan(plan)}>Load</Pill>
                        <Pill size="sm" onClick={() => void exportPlan(plan)}>Export</Pill>
                        <Pill size="sm" onClick={() => deletePlan(plan)}>Delete</Pill>
                      </div>
                    ))}
                  </div>
                )}
                <Text size="small" tone="tertiary">
                  Saving keeps every entry on every tab: assumptions, setup and living costs, and estimates. Loading a
                  plan keeps what you had as "Before loading …" so you can switch back. Export makes a .json file you can
                  back up or open on another computer with Import.
                </Text>
              </div>
            </Section>
            <Section title="You and the timeline" defaultOpen={true} summary={`${st.name}, ${who}, retire at ${startAge(p)}`}>
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
            </div>
            </Section>
            <Section title="Savings and withdrawals" defaultOpen={true} summary={`${kMoney(p.k401)} 401(k), ${p.strategy === "lump" ? "all at once" : p.strategy === "split" ? "split" : "as needed"}`}>
            <div className="fields">
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
            </div>
            </Section>
            <Section title="Social Security and other income" defaultOpen={true} summary={`${money(p.ssMonthly)}/mo at ${p.ssAge}`}>
            <div className="fields">
              <Field label={adults > 1 ? "Your Social Security, $/mo" : "Social Security, $/mo"}>
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
              {hasSpouse(p) && (
                <>
                  <Field label="Spouse's Social Security, $/mo">
                    <NumField value={p.ssSpouseMonthly ?? 0} onChange={(n) => set("ssSpouseMonthly", n)} />
                  </Field>
                  <Field label="Your age when the spouse's check starts">
                    <NumField value={p.ssSpouseStart ?? 67} onChange={(n) => set("ssSpouseStart", n)} width={64} />
                  </Field>
                  <div className="span-2">
                    <Text size="small" tone="tertiary">
                      Enter the spouse's own benefit from ssa.gov, or the spousal benefit (up to half of your full benefit)
                      if that's larger. If you entered a combined figure above before, set this to $0 to avoid counting it
                      twice.
                    </Text>
                  </div>
                </>
              )}
              <Field label="Part-time income, $/yr">
                <NumField value={p.otherIncome} onChange={(n) => set("otherIncome", n)} />
              </Field>
              <Field label="Part-time work until age">
                <NumField value={p.otherUntil} onChange={(n) => set("otherUntil", n)} width={64} />
              </Field>
              <Field label={`Social Security cut to ${EST.ssCutPct}% from ${EST.ssCutYear}`}>
                <Toggle checked={p.ssCut} onChange={(v) => set("ssCut", v)} />
              </Field>
            </div>
            </Section>
            <Section title="Health insurance before 65" defaultOpen={true} summary={p.acaByIncome === false ? "Flat line" : "Priced from income"}>
            <div className="fields">
              <Field label="Price ACA insurance from income">
                <Toggle checked={p.acaByIncome !== false} onChange={(v) => set("acaByIncome", v)} />
              </Field>
              <Field label="Full-price ACA insurance (no subsidy), $/yr per person">
                <NumField value={p.acaUnsub} onChange={(n) => set("acaUnsub", n)} />
              </Field>
              {st.medicaid && p.acaByIncome !== false && (
                <Field label="Use Medicaid in low-income years">
                  <Toggle checked={p.useMedicaid !== false} onChange={(v) => set("useMedicaid", v)} />
                </Field>
              )}
              <div className="span-2">
                <Text size="small" tone="tertiary">
                  {p.acaByIncome === false
                    ? `Uses the flat health line in living costs, and full price in any year income passes ${money(acaCliff(p))}.`
                    : `Each year's premium comes from that year's income: withdrawals, part-time pay, interest and all of Social Security. Above ${money(acaCliff(p))} (400% of the poverty line) there's no subsidy.`}{" "}
                  {st.medicaid
                    ? `${st.name} expanded Medicaid, which covers income under about ${money(fplOf(p) * 1.38)}. For anyone 55 or older, the state can recover Medicaid costs from the estate after death, and land counts. Turn Medicaid off to price full coverage instead.`
                    : `${st.name} hasn't expanded Medicaid. Income under ${money(fplOf(p))} gets no subsidy at all, so the plan charges full price in those years.`}
                </Text>
              </div>
            </div>
            </Section>
            <Section title="Markets, inflation and collapse" defaultOpen={false} summary={`${p.ret}% growth, ${p.inflation}% inflation, collapse at ${p.collapseAge}`}>
            <div className="fields">
              <Field label="401(k) growth, %/yr average">
                <NumField value={p.ret} onChange={(n) => set("ret", n)} width={64} />
              </Field>
              <Field label="Yearly swing in 401(k) returns, %">
                <NumField value={p.vol ?? 10} onChange={(n) => set("vol", n)} width={64} />
              </Field>
              <div className="span-2">
                <Text size="small" tone="tertiary">
                  How far a typical year lands from the average. About 5 for mostly bonds, 10 for a 50/50 mix, 15 for
                  mostly stocks. It drives the market odds and the rough-start line. It doesn't affect cash.
                </Text>
              </div>
              <Field label="Interest on cash after withdrawal, %">
                <NumField value={p.cashReturn ?? 0} onChange={(n) => set("cashReturn", n)} width={64} />
              </Field>
              <Field label="Inflation, %">
                <NumField value={p.inflation} onChange={(n) => set("inflation", n)} width={64} />
              </Field>
              <Field label="Contingency on costs, %">
                <NumField value={p.contingency} onChange={(n) => set("contingency", n)} width={64} />
              </Field>
              <Field label="Collapse happens at age">
                <NumField value={p.collapseAge} onChange={(n) => set("collapseAge", n)} width={64} />
              </Field>
            </div>
            </Section>
            <Section title="Home, power and heat" defaultOpen={false} summary={`${housingOf(p) === "house" ? "Small house" : "RV"}, ${POWER[p.powerMode]?.label ?? ""}`}>
            <div className="fields">
              <Field label="Living in">
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
            </div>
            </Section>
            <Section title="Food: hunting, chickens and garden" defaultOpen={false} summary={[p.hunting && "hunting", p.chickens && "chickens", p.garden && "garden"].filter(Boolean).join(", ") || "None"}>
            <div className="fields">
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
            </div>
            </Section>
              <div className="preset-row">
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

        <div className="plan-results">
          <Card>
            <CardHeader>Money remaining by age, in today's dollars</CardHeader>
            <CardBody>
              <Stack gap={10}>
                <LineChart
                  categories={ages}
                  series={[
                    { name: "401(k) before the withdrawals", data: beforeWithdrawals, tone: "success" },
                    { name: `Normal economy (${p.inflation}% inflation)${p.ssCut ? ", Social Security cut" : ""}`, data: afterLine(normal), tone: "info" },
                    ...(roughSim
                      ? [{ name: "Rough market start", data: afterLine(roughSim), color: "purple" as const, dashed: true }]
                      : []),
                    ...(p.ssCut
                      ? []
                      : [{ name: `Social Security cut to ${EST.ssCutPct}% in ${EST.ssCutYear}`, data: afterLine(ssCutSim), tone: "danger" as const }]),
                    { name: `High inflation (${EST.highInflation}%)`, data: afterLine(highInf, EST.highInflation), tone: "warning" },
                    { name: `Collapse at ${p.collapseAge} (cash frozen)`, data: afterLine(collapse), tone: "neutral" },
                  ]}
                  valuePrefix="$"
                  fluid
                  yFloor={0}
                  drop={
                    nestAtRetirement != null && cashAtRetirement != null
                      ? { x: String(retireAt), from: nestAtRetirement, to: cashAtRetirement }
                      : undefined
                  }
                />
                <Grid columns={3} gap={12}>
                  <Stat value={lastsLabel(normal)} label="Normal: lasts to age" tone={shortfall ? "danger" : "success"} />
                  <Stat
                    value={odds ? (odds.cashOnly ? "n/a" : `${oddsPct}%`) : "…"}
                    label={odds?.cashOnly ? "Market odds (cash plan)" : `Chance it lasts to ${goal}`}
                    tone={odds && !odds.cashOnly ? oddsTone : undefined}
                  />
                  <Stat
                    value={roughSim ? lastsLabel(roughSim) : "n/a"}
                    label="Rough market start: lasts to age"
                    tone={roughSim ? (covers(roughSim, goal) ? "success" : "danger") : undefined}
                  />
                  <Stat value={lastsLabel(ssCutSim)} label={`Social Security cut in ${EST.ssCutYear}`} tone={covers(ssCutSim, goal) ? "success" : "danger"} />
                  <Stat value={lastsLabel(highInf)} label="High inflation: lasts to age" tone={covers(highInf, goal) ? "success" : "danger"} />
                  <Stat value={kMoney(collapse.stranded ?? 0)} label={`Collapse: cash stranded at ${p.collapseAge}`} tone="warning" />
                </Grid>
                <details className="method">
                  <summary>Reading the chart</summary>
                  <Text size="small" tone="tertiary">
                    Age runs from today through {END_AGE}. Until retirement the green line is the 401(k)
                    {savings > 0 ? " plus other savings" : ""}; wages aren't shown. The dotted drop at retirement is the
                    401(k) before tax down to what's left after tax, the land and setup, and the first year of costs.
                    After that, "All at once" and "Split" are cash in the bank and "As needed" is what's still in the
                    401(k). The 401(k) grows {p.ret}% a year and cash earns {p.cashReturn ?? 0}%. Amounts are in today's dollars, so a line that holds flat is
                    keeping up with inflation. A line sits at $0 in
                    years the money has run out; those bills go unpaid and aren't carried forward as a debt. If income
                    later beats the budgeted bills, the leftover builds the line back up.
                    {roughSim
                      ? ` The rough start gives the 401(k) a ${Math.round(p.ret - 2 * (p.vol ?? 10))}% return in year one and ${Math.round(p.ret - (p.vol ?? 10))}% in years two and three, then ${p.ret}% after that.`
                      : ""}
                    {odds && !odds.cashOnly
                      ? ` Market odds: in ${oddsPct}% of ${odds.runs} replays with random yearly returns the money lasted past ${goal}.${odds.worstTenth !== null ? ` In the worst tenth it ran out by ${odds.worstTenth}.` : ""}`
                      : ""}
                  </Text>
                </details>
              </Stack>
            </CardBody>
          </Card>
        </div>
      </div>

      <Grid columns={2} gap={16} align="start">
          <Callout tone="info" title="What moves the outcome most">
          Try these one at a time and watch the age change. First, set Withdrawal to "As needed": you pay less tax and
          keep subsidized health insurance in later years. Second, add $15–20K/yr of part-time income until 62.
          Third, click "Lean build". Fourth, enter your real Social Security figure from ssa.gov at the age you plan
          to claim. The $1,400/mo default is a placeholder for one person at 62. Changing the claim age recalculates
          it. With two adults, enter the spouse's check in its own field.
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
      </Grid>

      <Stack gap={12}>
        <H2 id="sec-whatifs">Two what-ifs: a Social Security cut and seller financing</H2>
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
        <H2 id="sec-states">Red states compared, after the 2026 midterms</H2>
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
        <H2 id="sec-allocation">Where the {savings > 0 ? "401(k) and savings go" : "401(k) goes"}</H2>
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
            Lump-sum tax detail: federal {money(lumpTax.fed)} (the 401(k) plus Social Security taxed on those returns), {p.txMove ? "Texas" : st.name} {money(lumpTax.ok)}
            {lumpTax.penalty > 0 ? `, early-withdrawal penalty ${money(lumpTax.penalty)}` : ""}. The Rule of 55 only
            waives the penalty if you leave the job in or after the year you turn 55 and withdraw from that employer's
            plan. Rolling to an IRA first brings the penalty back until 59½.
          </Text>
        )}
      </Stack>

      <Stack gap={12}>
        <H2 id="sec-texas">Moving from Texas: taxes and residency</H2>
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
        <H2 id="sec-setup">One-time setup costs</H2>
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
        <H2 id="sec-living">Monthly living costs (normal economy, today's dollars)</H2>
        <Text tone="secondary">
          Every cost is editable as $/mo or $/yr, and the plan recomputes as you type. Start from a preset, then adjust
          any line. The presets leave property tax, propane, firewood and electricity alone, because those come from
          the state, the heat choice and the power setup. The {p.contingency}% contingency in Assumptions is added on
          top. Set it to 0 if your numbers already include a cushion.
        </Text>
        <Row gap={8} wrap>
          <Text size="small" tone="tertiary">Living-cost preset</Text>
          {(Object.keys(LIVING_PRESETS) as LivingPreset[]).map((id) => (
            <Pill key={id} active={activeLiving === id} color="green" onClick={() => applyLiving(id)}>
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
                value={`${money(annualCost(r, 60, p, healthAtAge(60)) / 12)}/mo`}
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
              Monthly figures are rounded to the dollar.
              {p.acaByIncome === false
                ? " Health insurance before 65 uses the line above."
                : " The health insurance line above is only used if pricing from income is off in Assumptions; the plan prices each year from income instead."}
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
              {p.acaByIncome === false
                ? `The plan uses the flat health line, and full price (${money(p.acaUnsub)}/yr per person) in any year income passes about ${money(acaCliff(p))}, 400% of the poverty line for ${peopleLabel(adultsOf(p))}. `
                : `Before 65 the premium is priced from each year's income with the 2026 subsidy table. Above about ${money(acaCliff(p))} (400% of the poverty line for ${peopleLabel(adultsOf(p))}) there's no subsidy, and full price is ${money(p.acaUnsub)}/yr per person. `}
              {loc.medicaid}.
              {st.medicaid
                ? " Starting in 2027, federal law adds work or volunteer requirements for expansion adults under 65, and the state can recover Medicaid costs from the estate of anyone who got benefits at 55 or older."
                : ""}{" "}
              Check the current rules before you rely on either.
              {pre65Health.length > 0 && (
                <div className="health-strip">
                  {pre65Health.map((h, i) => (
                    <div key={i} className={`health-year ${h.kind}`}>
                      <div className="health-age">{retireAt + i}</div>
                      <div className="health-kind">{HEALTH_LABEL[h.kind]}</div>
                      <div className="health-cost">{money(h.cost / 12)}/mo</div>
                    </div>
                  ))}
                </div>
              )}
            </Callout>
          </Stack>
        </Grid>
      </Stack>

      <Stack gap={12}>
        <Row gap={12} align="center">
          <H2 id="sec-estimates">Estimates behind the numbers</H2>
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
        <H2 id="sec-power">Power and Starlink: {pm.label}</H2>
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
            {housingOf(p) === "house" ? (
              <Callout tone="neutral" title="Powering the house">
                The house wiring line is the panel and the rough-in. The co-op line, the solar bank, and the generator
                stay on their own lines. A small house does not use the RV pedestal.
              </Callout>
            ) : (
              <Callout tone="neutral" title="Powering the RV itself">
                Plug the RV's shore cord into the 50 A pedestal. The pedestal is fed by the grid, the hybrid inverter or
                the generator. A 30 A RV needs a 50-to-30 A adapter. Add a hardwired surge protector with low-voltage
                shutoff (about $300), because rural co-op lines sag and spike in storms. To start a roof A/C on
                battery or a small generator, add a soft-start kit (about $300). It cuts the start surge by about 70%.
              </Callout>
            )}
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
        {livingChoice}
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
            ? "The house connects to the well and a permitted septic. Filter drinking water at the sink, and test the well for coliform and nitrates when it is drilled and every year after. Rain catchment stays the backup."
            : `An RV fresh-water tank holds 40–100 gallons. With short showers, ${who} uses about ${adults === 1 ? "10–20" : `${10 * adults}–${20 * adults}`} gallons a day, so a full tank lasts about 3–7 days when you're not hooked up. The goal is to plumb the RV to the well so you never haul water.`}
        </Text>
        <Table
          headers={["Method", "How", "Cost", "When to use it"]}
          rowTone={["success", "info", "neutral", "warning"]}
          rows={
            housingOf(p) === "house"
              ? [
                  ["Well to the house (best)", "The drilled well and pressure tank feed the sink, shower, and toilet. Filter drinking water at the sink.", "The well and septic lines in setup", "Every day once the well and septic are in."],
                  ["Rain catchment", "Roof water into a tank, then a gravity filter, for the garden and as backup drinking water after you filter or boil it.", "Rain catchment is in the hardening build", "Dry weeks, or if the well pump is down."],
                  ["Haul water", "A food-grade tank filled at a rural water station, then a transfer pump into storage at the house.", "$400–800 for tank and pump", "Before the well is drilled, or if the well fails."],
                  ["Pond or creek (collapse)", "Filter, then boil or bleach. Do not run untreated surface water through the house plumbing.", "Filters are in the hardening build", "Grid-down backup only."],
                ]
              : [
                  ["Hook up to the well (best)", "Run a frost-free yard hydrant at the pad, then a drinking-water hose (NSF-61, white or blue), a pressure regulator set to 40–55 psi, and an inline sediment and carbon filter into the RV's city-water inlet. Water flows on demand, like a house.", "$300–800 plus the hydrant (in the RV pedestal line)", "Every day once the well is in. Below about 20°F, use a heated hose or fill the tank and disconnect."],
                  ["Fill the fresh tank from the hydrant", "Fill through the tank's fill port and run the RV's 12 V pump.", "$0", "Hard freezes, or to keep running if the well pump loses power."],
                  ["Haul water", "Fill a 275-gal food-grade IBC tote or a 35–100 gal truck-bed tank at a rural water district station, then pump it into the RV with a 12 V transfer pump.", "$400–800 for tank and pump; water is cents a gallon", "Before the well is drilled, or if the well fails."],
                  ["Rain, pond or creek (collapse)", "Run it through a gravity filter (Berkey or Sawyer), then boil it or add bleach. Never put untreated pond water in the RV tank.", "Rain catchment and filters are in the hardening build", "Grid-down backup only."],
                ]
          }
        />
        <Grid columns={2} gap={16}>
          {housingOf(p) === "house" ? (
            <>
              <Callout tone="info" title="Sanitize the well">
                Shock the well when it is drilled and if a test comes back dirty. Use the health department's bleach
                dose for the well volume, run each faucet until you smell chlorine, wait, then flush. Do not drink it
                until the chlorine is gone.
              </Callout>
              <Callout tone="neutral" title="Drinking water and waste">
                Test the well for coliform bacteria and nitrates when it's drilled and every year after (about $25–75 at
                a state-certified lab). Filter at the sink, and keep at least 14 gallons per person stored if the pump
                fails. Waste goes to the permitted septic. Pump it on the schedule in the monthly costs.
              </Callout>
            </>
          ) : (
            <>
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
            </>
          )}
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
