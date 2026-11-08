import { useEffect, useState, type ReactNode } from "react";
import {
  Callout,
  Card,
  CardBody,
  CardHeader,
  Divider,
  Grid,
  H1,
  H2,
  H3,
  Pill,
  Row,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Toggle,
  useCanvasState,
} from "./ui";
import { applyLinkedState, publishLandSearch, STATES, STATE_IDS, type StateId } from "./App";
import { checkWater, fmtDist, miles, M_PER_MILE, parseLatLon, propertyRadiusM, runChecks, type CheckResult, type WaterFeature } from "./geo";
import { LandMap } from "./LandMap";
import { openExternal } from "./net";
import {
  deedOf,
  hoaFinding,
  recordLinks,
  USE_ITEMS,
  usesFinding,
  type CcrStatus,
  type DeedLimits,
  type HoaStatus,
  type UseAnswer,
  type UseKey,
} from "./restrictions";
import { clampAcresToRange, DEFAULT_COUNTIES, readPlanAcres, syncHoaFromListing, writeLandCost } from "./planLink";

type PropType = "any" | "hunting" | "recreational" | "farms" | "undeveloped" | "timber" | "waterfront";

const PROP_TYPES: Record<PropType, { label: string; lw: string; lc: string }> = {
  any: { label: "All land", lw: "land", lc: "all-land" },
  hunting: { label: "Hunting", lw: "hunting-property", lc: "hunting-land" },
  recreational: { label: "Recreational", lw: "recreational-property", lc: "recreational-property" },
  farms: { label: "Farms and ranches", lw: "farms-and-ranches", lc: "ranches" },
  undeveloped: { label: "Undeveloped", lw: "undeveloped-land", lc: "undeveloped-land" },
  timber: { label: "Timberland", lw: "timberland-property", lc: "timberland" },
  waterfront: { label: "Waterfront", lw: "waterfront-property", lc: "waterfront-property" },
};

const STATE_META: Record<StateId, { code: string; counties: string; view: [number, number, number] }> = {
  OK: { code: "OK", counties: DEFAULT_COUNTIES.OK, view: [34.5, -95.2, 8] },
  MT: { code: "MT", counties: DEFAULT_COUNTIES.MT, view: [47.0, -109.8, 7] },
  WY: { code: "WY", counties: DEFAULT_COUNTIES.WY, view: [44.3, -108.3, 7] },
  ID: { code: "ID", counties: DEFAULT_COUNTIES.ID, view: [48.0, -116.6, 8] },
  SD: { code: "SD", counties: DEFAULT_COUNTIES.SD, view: [45.0, -103.0, 7] },
  ND: { code: "ND", counties: DEFAULT_COUNTIES.ND, view: [47.5, -102.6, 7] },
  TN: { code: "TN", counties: DEFAULT_COUNTIES.TN, view: [35.7, -85.2, 8] },
  AR: { code: "AR", counties: DEFAULT_COUNTIES.AR, view: [35.0, -93.4, 7] },
  MO: { code: "MO", counties: DEFAULT_COUNTIES.MO, view: [37.1, -91.9, 8] },
  WV: { code: "WV", counties: DEFAULT_COUNTIES.WV, view: [38.4, -80.5, 8] },
  MS: { code: "MS", counties: DEFAULT_COUNTIES.MS, view: [33.1, -89.3, 8] },
};

type Criteria = {
  state: StateId;
  counties: string;
  acresMin: number;
  acresMax: number;
  priceMax: number;
  type: PropType;
  waterOnLand: boolean;
  waterWithinMi: number;
  perennial: boolean;
  fishing: boolean;
  powerWithinMi: number;
  noFlood: boolean;
  hospitalWithinMi: number;
  townWithinMi: number;
  noHoa: boolean;
  usesAllowed: boolean;
  /** Older saves used this one switch. New saves use `zillow` instead. */
  withHouse?: boolean;
  zillow: ZillowOpts;
};

type ZillowOpts = {
  houses: boolean;
  townhomes: boolean;
  multiFamily: boolean;
  condos: boolean;
  lotsLand: boolean;
  apartments: boolean;
  manufactured: boolean;
  byAgent: boolean;
  byOwner: boolean;
  newConstruction: boolean;
  comingSoon: boolean;
  foreclosure: boolean;
  auction: boolean;
  /** 0 means Any. */
  beds: number;
  bedsExact: boolean;
  /** 0 means Any. Halves are allowed, matching Zillow. */
  baths: number;
};

const DEFAULT_ZILLOW: ZillowOpts = {
  houses: false,
  townhomes: false,
  multiFamily: false,
  condos: false,
  lotsLand: true,
  apartments: false,
  manufactured: false,
  byAgent: true,
  byOwner: true,
  newConstruction: true,
  comingSoon: true,
  foreclosure: true,
  auction: false,
  beds: 0,
  bedsExact: false,
  baths: 0,
};

const BED_OPTIONS = [
  { value: "0", label: "Any" },
  { value: "1", label: "1+" },
  { value: "2", label: "2+" },
  { value: "3", label: "3+" },
  { value: "4", label: "4+" },
  { value: "5", label: "5+" },
];

const BATH_OPTIONS = [
  { value: "0", label: "Any" },
  { value: "1", label: "1+" },
  { value: "1.5", label: "1.5+" },
  { value: "2", label: "2+" },
  { value: "3", label: "3+" },
  { value: "4", label: "4+" },
];

const ZILLOW_HOME: { key: Exclude<keyof ZillowOpts, "beds" | "baths">; label: string; filter: string }[] = [
  { key: "houses", label: "Houses", filter: "isSingleFamily" },
  { key: "townhomes", label: "Townhomes", filter: "isTownhouse" },
  { key: "multiFamily", label: "Multi-family", filter: "isMultiFamily" },
  { key: "condos", label: "Condos/Co-ops", filter: "isCondo" },
  { key: "lotsLand", label: "Lots/Land", filter: "isLotLand" },
  { key: "apartments", label: "Apartments", filter: "isApartment" },
  { key: "manufactured", label: "Manufactured", filter: "isManufactured" },
];

const ZILLOW_LISTING: { key: Exclude<keyof ZillowOpts, "beds" | "baths">; label: string; filter: string }[] = [
  { key: "byAgent", label: "For sale by agent", filter: "isForSaleByAgent" },
  { key: "byOwner", label: "For sale by owner", filter: "isForSaleByOwner" },
  { key: "newConstruction", label: "New construction", filter: "isNewConstruction" },
  { key: "comingSoon", label: "Coming soon", filter: "isComingSoon" },
  { key: "foreclosure", label: "Foreclosure", filter: "isForSaleForeclosure" },
  { key: "auction", label: "Auction", filter: "isAuction" },
];

const DEFAULT_CRITERIA: Criteria = {
  state: "OK",
  counties: STATE_META.OK.counties,
  acresMin: 40,
  acresMax: 80,
  priceMax: 125000,
  type: "hunting",
  waterOnLand: false,
  waterWithinMi: 1,
  perennial: true,
  fishing: true,
  powerWithinMi: 1,
  noFlood: true,
  hospitalWithinMi: 45,
  townWithinMi: 20,
  noHoa: true,
  usesAllowed: true,
  withHouse: false,
  zillow: DEFAULT_ZILLOW,
};

/** Fill missing fields, and turn Houses and Manufactured on when an older save had "With a house" on. */
function normalizeCriteria(stored: Partial<Criteria> | undefined): Criteria {
  const zillow = { ...DEFAULT_ZILLOW, ...(stored?.zillow ?? {}) };
  if (stored?.zillow == null && stored?.withHouse) {
    zillow.houses = true;
    zillow.manufactured = true;
  }
  return { ...DEFAULT_CRITERIA, ...stored, zillow };
}

function wantsDwelling(z: ZillowOpts) {
  return z.houses || z.townhomes || z.multiFamily || z.condos || z.apartments || z.manufactured;
}

export type Listing = {
  id: string;
  name: string;
  url: string;
  price: number;
  acres: number;
  lat: number;
  lon: number;
  notes: string;
  deed?: DeedLimits;
  check?: Omit<CheckResult, "water"> & { water?: Omit<NonNullable<CheckResult["water"]>, "features"> };
  checkedAt?: string;
};

const slug = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const money = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

const SQFT_PER_ACRE = 43560;

/** Lot size is square feet. Every home type and listing type is sent from the toggles. */
function zillowSearch(place: string, acresMin: number, acresMax: number, priceMax: number, z: ZillowOpts) {
  const filterState: Record<string, unknown> = { sortSelection: { value: "lot" } };
  for (const opt of [...ZILLOW_HOME, ...ZILLOW_LISTING]) filterState[opt.filter] = { value: z[opt.key] };
  if (z.beds > 0) filterState.beds = z.bedsExact ? { min: z.beds, max: z.beds } : { min: z.beds };
  if (z.baths > 0) filterState.baths = { min: z.baths };
  const lot: { min?: number; max?: number } = {};
  if (acresMin > 0) lot.min = acresMin * SQFT_PER_ACRE;
  if (acresMax > 0) lot.max = acresMax * SQFT_PER_ACRE;
  if (lot.min != null || lot.max != null) filterState.lotSize = lot;
  if (priceMax > 0) filterState.price = { max: priceMax };
  const state = { pagination: {}, isMapVisible: true, isListVisible: true, filterState };
  return `https://www.zillow.com/${place}/?searchQueryState=${encodeURIComponent(JSON.stringify(state))}`;
}

function searchLinks(c: Criteria, county: string | null) {
  const st = STATES[c.state];
  const code = STATE_META[c.state].code;
  const t = PROP_TYPES[c.type];
  const lo = Math.max(0, Math.round(c.acresMin));
  const hi = Math.max(0, Math.round(c.acresMax));
  const lwAcres =
    lo > 0 && hi > lo ? `/acres-${lo}-${hi}` : lo > 0 ? `/acres-over-${lo}` : hi > 0 ? `/acres-under-${hi}` : "";
  const lwPrice = c.priceMax > 0 ? `/price-under-${Math.round(c.priceMax)}` : "";
  const countySeg = county ? `/${slug(county)}-county` : "";
  const where = county ? `"${county} County" ${code}` : st.name;
  const dwelling = wantsDwelling(c.zillow);
  const lwKind = dwelling ? "homes" : t.lw;
  const typeWords = c.type === "any" ? "" : `${t.label.toLowerCase()} `;
  const acres = lo > 0 || hi > 0 ? `${lo}-${hi} acres ` : "";
  const dwellingWords = [
    c.zillow.houses ? "house" : "",
    c.zillow.manufactured ? "cabin OR manufactured home" : "",
    c.zillow.townhomes ? "townhouse" : "",
    c.zillow.condos ? "condo" : "",
    c.zillow.multiFamily ? "multi-family" : "",
    c.zillow.apartments ? "apartment" : "",
  ].filter(Boolean);
  const googleBase = dwelling
    ? `${where} ${acres}${dwellingWords.join(" OR ")} ${c.zillow.lotsLand ? "on acreage " : ""}${typeWords}creek OR pond`
    : `${where} land for sale ${lo}-${hi} acres ${c.type === "any" ? "" : t.label.toLowerCase()} creek OR pond`;
  const google = c.zillow.auction ? googleBase : `${googleBase} -auction`;
  const place = county ? `${slug(county)}-county-${code.toLowerCase()}` : code.toLowerCase();
  const zillow = zillowSearch(place, lo, hi, Math.max(0, Math.round(c.priceMax)), c.zillow);
  return [
    { site: "LandWatch", url: `https://www.landwatch.com/${slug(st.name)}-${lwKind}-for-sale${countySeg}${lwPrice}${lwAcres}` },
    { site: "Zillow", url: zillow },
    { site: "Other brokers (Google)", url: `https://www.google.com/search?q=${encodeURIComponent(google)}` },
  ];
}

type Verdict = "pass" | "fail" | "unknown";
type Row = { label: string; value: string; verdict: Verdict; note?: string };

function evaluate(l: Listing, c: Criteria): Row[] {
  const k = l.check;
  const w = k?.water;
  const r = propertyRadiusM(l.acres);
  const rows: Row[] = [];
  const v = (ok: boolean | null | undefined): Verdict => (ok === null || ok === undefined ? "unknown" : ok ? "pass" : "fail");
  const ppa = l.acres > 0 ? l.price / l.acres : 0;
  rows.push({ label: `Price under ${money(c.priceMax)}`, value: `${money(l.price)} (${money(ppa)}/acre)`, verdict: v(l.price > 0 ? l.price <= c.priceMax : null) });
  rows.push({ label: `${c.acresMin}–${c.acresMax} acres`, value: `${l.acres} acres`, verdict: v(l.acres > 0 ? l.acres >= c.acresMin && l.acres <= c.acresMax : null) });
  if (k?.stateCode) {
    const inPlan = STATE_IDS.find((id) => STATE_META[id].code === k.stateCode);
    rows.push({ label: "County", value: `${k.county ?? "?"}, ${k.stateCode}`, verdict: inPlan ? "pass" : "unknown", note: inPlan ? undefined : "Not one of the planner's states" });
  }
  const water = w ? w.nearestM : undefined;
  if (c.waterOnLand)
    rows.push({ label: "Water on the land", value: w ? fmtDist(w.nearestM) + (w.nearestName ? ` (${w.nearestName})` : "") : "not checked", verdict: v(w ? water !== null && water! <= r : null), note: "Within the property's approximate footprint around the pin" });
  if (c.waterWithinMi > 0)
    rows.push({ label: `Water within ${c.waterWithinMi} mi`, value: w ? fmtDist(w.nearestM) + (w.nearestName ? ` (${w.nearestName})` : "") : "not checked", verdict: v(w ? water !== null && miles(water!) <= c.waterWithinMi : null) });
  if (c.perennial)
    rows.push({ label: `Year-round (perennial) water within ${Math.max(c.waterWithinMi, 1)} mi`, value: w ? fmtDist(w.nearestPerennialM) : "not checked", verdict: v(w ? w.nearestPerennialM !== null && miles(w.nearestPerennialM) <= Math.max(c.waterWithinMi, 1) : null), note: "USGS-mapped; seasonal creeks don't count" });
  if (c.fishing)
    rows.push({ label: "Fishing: pond, lake or year-round stream within 1 mi", value: w ? `pond/lake ${fmtDist(w.nearestPondM)}, stream ${fmtDist(w.nearestPerennialM)}` : "not checked", verdict: v(w ? Math.min(w.nearestPondM ?? Infinity, w.nearestPerennialM ?? Infinity) <= M_PER_MILE : null), note: "Stock ponds under an acre rarely hold fish" });
  if (c.noFlood)
    rows.push({
      label: "Not in a FEMA high-risk flood zone",
      value: k?.flood ? (k.flood.zone ? `Zone ${k.flood.zone}` : "No FEMA flood map for this spot") : k?.errors.flood ? `check failed: ${k.errors.flood}` : "not checked",
      verdict: k?.flood ? (k.flood.zone ? v(!k.flood.highRisk) : "unknown") : "unknown",
      note: "At the pin only; check the build site on the FEMA map",
    });
  if (c.powerWithinMi > 0)
    rows.push({
      label: `Power line within ${c.powerWithinMi} mi`,
      value: k?.power ? fmtDist(k.power.nearestM) + (k.power.voltage ? ` (${Number(k.power.voltage) / 1000} kV)` : "") : k?.errors.osm ? `check failed: ${k.errors.osm}` : "not checked",
      verdict: k?.power ? (k.power.nearestM !== null && miles(k.power.nearestM) <= c.powerWithinMi ? "pass" : "unknown") : "unknown",
      note: "OpenStreetMap misses many rural lines. Ask the co-op",
    });
  if (c.hospitalWithinMi > 0)
    rows.push({
      label: `Hospital within ${c.hospitalWithinMi} mi (straight line)`,
      value: k?.hospital ? `${k.hospital.name}, ${miles(k.hospital.m).toFixed(0)} mi` : k?.hospital === null ? "none within 50 mi" : "not checked",
      verdict: k?.hospital !== undefined ? v(k.hospital !== null && miles(k.hospital.m) <= c.hospitalWithinMi) : "unknown",
    });
  if (c.townWithinMi > 0)
    rows.push({
      label: `Town within ${c.townWithinMi} mi (straight line)`,
      value: k?.town ? `${k.town.name}, ${miles(k.town.m).toFixed(0)} mi` : k?.town === null ? "none within 40 mi" : "not checked",
      verdict: k?.town !== undefined ? v(k.town !== null && miles(k.town.m) <= c.townWithinMi) : "unknown",
    });
  const deed = deedOf(l.deed);
  if (c.noHoa) {
    const hoa = hoaFinding(deed);
    rows.push({
      label: "No HOA or road association",
      value: hoa.value,
      verdict: hoa.verdict,
      note: "Marked from the listing, the plat, or the county clerk. The map check cannot see this",
    });
  }
  if (c.usesAllowed) {
    const uses = usesFinding(deed);
    rows.push({
      label: "RV, chickens, garden, hunting, well and outbuildings allowed",
      value: uses.value,
      verdict: uses.verdict,
      note: "A recorded covenant can ban these even where the county has no zoning",
    });
  }
  if (k?.elevationFt !== undefined) rows.push({ label: "Elevation at pin", value: `${Math.round(k.elevationFt).toLocaleString("en-US")} ft`, verdict: "unknown" });
  return rows;
}

const TONE: Record<Verdict, string> = { pass: "#22c55e", fail: "#ef4444", unknown: "#a3a3a3" };
const VERDICT_TEXT: Record<Verdict, string> = { pass: "Yes", fail: "No", unknown: "?" };

function score(rows: Row[]) {
  const judged = rows.filter((r) => r.label !== "Elevation at pin" && r.label !== "County");
  const pass = judged.filter((r) => r.verdict === "pass").length;
  const fail = judged.filter((r) => r.verdict === "fail").length;
  return { pass, fail, total: judged.length, tone: fail > 0 ? (pass >= judged.length - 1 ? "#f59e0b" : TONE.fail) : pass === judged.length ? TONE.pass : "#3b82f6" };
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Row gap={8} align="center" justify="space-between">
      <Text size="small" tone="secondary">
        {label}
      </Text>
      {children}
    </Row>
  );
}

function Num({ value, onChange, width = 90 }: { value: number; onChange: (n: number) => void; width?: number }) {
  return <TextInput type="number" value={String(value)} onChange={(v) => onChange(v === "" ? 0 : Number(v))} style={{ width }} />;
}

const EMPTY_FORM = { name: "", url: "", price: "", acres: "", where: "", notes: "" };

function Choice<T extends string>({ value, options, onChange }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <Row gap={4} wrap>
      {options.map((o) => (
        <Pill key={o.id} size="sm" active={value === o.id} onClick={() => onChange(o.id)}>
          {o.label}
        </Pill>
      ))}
    </Row>
  );
}

const HOA_CHOICES: { id: HoaStatus; label: string }[] = [
  { id: "unknown", label: "Unknown" },
  { id: "none", label: "None" },
  { id: "yes", label: "Yes" },
];
const CCR_CHOICES: { id: CcrStatus; label: string }[] = [
  { id: "unknown", label: "Unknown" },
  { id: "none", label: "None found" },
  { id: "recorded", label: "Recorded" },
];
const USE_CHOICES: { id: UseAnswer; label: string }[] = [
  { id: "unknown", label: "Unknown" },
  { id: "allowed", label: "Allowed" },
  { id: "banned", label: "Banned" },
];

function DeedCard({ listing, onChange }: { listing: Listing; onChange: (patch: Partial<DeedLimits>) => void }) {
  const d = deedOf(listing.deed);
  const county = listing.check?.county;
  const stateCode = listing.check?.stateCode;
  const setUse = (key: UseKey, v: UseAnswer) => onChange({ [key]: v });
  return (
    <Card>
      <CardHeader>HOA and recorded restrictions</CardHeader>
      <CardBody>
        <Stack gap={10}>
          <Text size="small" tone="secondary">
            Covenants are private rules recorded with the county clerk. They bind later owners. A listing that says
            unrestricted often means the county has no zoning, not that nobody recorded rules. Rules can ban an RV,
            chickens, a garden fence, hunting, a well, or anything short of a site-built house. Some tracts have no
            association and still have covenants. Others have an association only to collect road dues.
          </Text>
          <Text size="small" tone="secondary">
            Ask the seller for every declaration and plat. Then read the title commitment: recorded restrictions are
            listed in Schedule B by book and page. Search the clerk's index for the subdivision name and the seller's
            name. An empty search for one instrument type does not mean the tract is clear.
            {stateCode === "OK" &&
              " In Oklahoma the title company has to give the buyer a copy of the recorded covenants at closing, for at most $25 (60 O.S. § 857)."}
          </Text>
          <Row gap={6} wrap>
            {recordLinks(county, stateCode).map((s) => (
              <Pill key={s.site} size="sm" onClick={() => void openExternal(s.url)}>
                {s.site}
              </Pill>
            ))}
          </Row>
          {!county && (
            <Text size="small" tone="tertiary">
              The county clerk link uses this pin's county once the check finishes.
            </Text>
          )}
          <Row gap={8} align="center" justify="space-between" wrap>
            <Text size="small" tone="secondary">HOA or road association</Text>
            <Choice value={d.hoa} options={HOA_CHOICES} onChange={(v) => onChange({ hoa: v, hoaDues: v === "yes" ? d.hoaDues : 0 })} />
          </Row>
          {d.hoa === "yes" && (
            <>
              <Field label="Association name">
                <TextInput value={d.hoaName} onChange={(v) => onChange({ hoaName: v })} placeholder="Name" style={{ width: 180 }} />
              </Field>
              <Field label="Dues, $ per year">
                <Num value={d.hoaDues} onChange={(n) => onChange({ hoaDues: n })} />
              </Field>
            </>
          )}
          <Row gap={8} align="center" justify="space-between" wrap>
            <Text size="small" tone="secondary">Recorded covenants</Text>
            <Choice value={d.ccr} options={CCR_CHOICES} onChange={(v) => onChange({ ccr: v })} />
          </Row>
          <Divider />
          <Text size="small" weight="semibold">
            What this plan needs the rules to allow
          </Text>
          {USE_ITEMS.map((item) => (
            <Row key={item.key} gap={8} align="center" justify="space-between" wrap>
              <Text size="small" tone="secondary">{item.label}</Text>
              <Choice value={d[item.key]} options={USE_CHOICES} onChange={(v) => setUse(item.key, v)} />
            </Row>
          ))}
          <Stack gap={4}>
            <Text size="small" tone="secondary">
              Restriction language, from the declaration or Schedule B
            </Text>
            <textarea
              className="input"
              value={d.notes}
              onChange={(e) => onChange({ notes: e.target.value })}
              placeholder="Paste the clauses that mention dwellings, animals, hunting, wells, or dues."
            />
          </Stack>
        </Stack>
      </CardBody>
    </Card>
  );
}

export default function LandSearch({
  onUseInPlan,
}: {
  onUseInPlan: (state: StateId | null, price: number, acres: number, listing: Listing) => void;
}) {
  const [storedC, setC] = useCanvasState<Criteria>("land-criteria-v1", DEFAULT_CRITERIA);
  const c = normalizeCriteria(storedC);
  const [listings, setListings] = useCanvasState<Listing[]>("land-listings-v1", []);
  const [planAcres, setPlanAcres] = useState(() => readPlanAcres());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [waterById, setWaterById] = useState<Record<string, WaterFeature[]>>({});

  const set = <K extends keyof Criteria>(k: K, v: Criteria[K]) => setC((prev) => ({ ...normalizeCriteria(prev), [k]: v }));
  const setZillow = <K extends keyof ZillowOpts>(k: K, v: ZillowOpts[K]) =>
    setC((prev) => {
      const next = normalizeCriteria(prev);
      return { ...next, zillow: { ...next.zillow, [k]: v } };
    });
  useEffect(() => {
    publishLandSearch();
    setPlanAcres(readPlanAcres());
  }, []);
  const pending = parseLatLon(form.where);
  const counties = c.counties.split(",").map((s) => s.trim()).filter(Boolean);
  const selected = listings.find((l) => l.id === selectedId) ?? null;
  const evaluated = listings.map((l) => ({ l, rows: evaluate(l, c) }));

  useEffect(() => {
    if (!selected || waterById[selected.id] || busy[selected.id]) return;
    let live = true;
    checkWater(selected.lat, selected.lon)
      .then((w) => live && setWaterById((m) => ({ ...m, [selected.id]: w.features })))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [selectedId]);

  const check = async (l: Listing) => {
    setBusy((b) => ({ ...b, [l.id]: true }));
    const save = (r: CheckResult) => {
      const { water, ...rest } = r;
      if (water) setWaterById((m) => ({ ...m, [l.id]: water.features }));
      const slim = { ...rest, water: water ? { nearestM: water.nearestM, nearestName: water.nearestName, nearestPerennialM: water.nearestPerennialM, nearestPondM: water.nearestPondM } : undefined };
      setListings((prev) => prev.map((x) => (x.id === l.id ? { ...x, check: slim, checkedAt: new Date().toISOString() } : x)));
    };
    const final = await runChecks(l.lat, l.lon, save);
    save(final);
    setBusy((b) => ({ ...b, [l.id]: false }));
  };

  const add = () => {
    const loc = parseLatLon(form.where);
    const price = Number(form.price.replace(/[$,\s]/g, ""));
    const acres = Number(form.acres.replace(/[,\s]/g, ""));
    if (!loc) return setFormError("Click the map, or paste coordinates like 34.4012, -95.4123 (a Google Maps link works too).");
    if (!(price > 0) || !(acres > 0)) return setFormError("Enter the asking price and the acreage.");
    const l: Listing = {
      id: Math.random().toString(36).slice(2, 10),
      name: form.name.trim() || `${acres} acres`,
      url: form.url.trim(),
      price,
      acres,
      lat: loc[0],
      lon: loc[1],
      notes: form.notes.trim(),
    };
    setListings((prev) => [...prev, l]);
    setForm(EMPTY_FORM);
    setFormError("");
    setSelectedId(l.id);
    void check(l);
  };

  const remove = (id: string) => {
    setListings((prev) => prev.filter((x) => x.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const setDeed = (id: string, patch: Partial<DeedLimits>) => {
    setListings((prev) =>
      prev.map((x) => {
        if (x.id !== id) return x;
        const deed = { ...deedOf(x.deed), ...patch };
        syncHoaFromListing(id, deed);
        return { ...x, deed };
      }),
    );
  };

  const planState = (l: Listing): StateId | null =>
    STATE_IDS.find((id) => STATE_META[id].code === l.check?.stateCode) ?? null;

  const linkRows = [null, ...counties].map((county) => [
    <Text key="w" weight="semibold">{county ? `${county} County` : `All of ${STATES[c.state].name}`}</Text>,
    <Row key="l" gap={6} wrap>
      {searchLinks(c, county).map((s) => (
        <Pill key={s.site} size="sm" onClick={() => void openExternal(s.url)}>
          {s.site}
        </Pill>
      ))}
    </Row>,
  ]);

  return (
    <Stack gap={20}>
      <Stack gap={6}>
        <H1>Land search</H1>
        <Text tone="secondary">
          Set what you're looking for, open the listing sites already filtered to your counties and property type, then
          drop each promising listing on the map. The app checks it against free government and map data: USGS water,
          FEMA flood zones, elevation, county, mapped power lines, and the nearest hospital and town. It scores the
          listing against your criteria and can load the price into the retirement plan. Deed restrictions and an HOA are not in that map data. Mark them from the listing, the plat, and the county clerk, and they travel with the parcel when you use it in the plan.
        </Text>
      </Stack>

      <Grid columns="minmax(0, 340px) minmax(0, 1fr)" gap={20} align="start">
        <Card>
          <CardHeader>What you're looking for</CardHeader>
          <CardBody>
            <Stack gap={10}>
              <Field label="State">
                <Select
                  value={c.state}
                  onChange={(v) => {
                    const id = v as StateId;
                    setC((prev) => ({ ...normalizeCriteria(prev), state: id, counties: STATE_META[id].counties }));
                    applyLinkedState(id);
                  }}
                  options={STATE_IDS.map((id) => ({ value: id, label: STATES[id].name }))}
                />
              </Field>
              <Stack gap={4}>
                <Text size="small" tone="secondary">
                  Counties (comma-separated)
                </Text>
                <TextInput value={c.counties} onChange={(v) => set("counties", v)} style={{ width: "100%" }} />
              </Stack>
              <Field label="Property type">
                <Select value={c.type} onChange={(v) => set("type", v as PropType)} options={(Object.keys(PROP_TYPES) as PropType[]).map((k) => ({ value: k, label: PROP_TYPES[k].label }))} />
              </Field>
              <Text size="small" tone="secondary">
                Zillow home type
              </Text>
              {ZILLOW_HOME.map((opt) => (
                <Field key={opt.key} label={opt.label}>
                  <Toggle checked={c.zillow[opt.key]} onChange={(v) => setZillow(opt.key, v)} />
                </Field>
              ))}
              <Text size="small" tone="secondary">
                Zillow listing type
              </Text>
              {ZILLOW_LISTING.map((opt) => (
                <Field key={opt.key} label={opt.label}>
                  <Toggle checked={c.zillow[opt.key]} onChange={(v) => setZillow(opt.key, v)} />
                </Field>
              ))}
              <Text size="small" tone="secondary">
                Beds and baths
              </Text>
              <Field label="Bedrooms">
                <Select value={String(c.zillow.beds)} onChange={(v) => setZillow("beds", Number(v))} options={BED_OPTIONS} />
              </Field>
              <Field label="Exact bedroom count">
                <Toggle checked={c.zillow.bedsExact} onChange={(v) => setZillow("bedsExact", v)} />
              </Field>
              <Field label="Bathrooms">
                <Select value={String(c.zillow.baths)} onChange={(v) => setZillow("baths", Number(v))} options={BATH_OPTIONS} />
              </Field>
              <Text size="small" tone="tertiary">
                The app sends the checked types to Zillow with your acre range and price, largest lots first. Lots/Land
                starts on and Auction starts off. Bedrooms and bathrooms start at Any, so a lot with no house is kept.
                Exact bedroom count sends that number only.{" "}
                {wantsDwelling(c.zillow)
                  ? "A house type is on, so LandWatch opens its homes search for the same county, acres, and price."
                  : "No house type is on, so LandWatch stays on vacant land for the property type above."}{" "}
                {c.zillow.auction
                  ? "Auction is on, so auction listings are included."
                  : "Auction is off. The broker search drops that word. LandWatch has no auction switch, so skip a card there if it says auction."}
              </Text>
              <Field label="Acres, minimum">
                <Num
                  value={c.acresMin}
                  onChange={(n) => {
                    set("acresMin", n);
                    setPlanAcres(clampAcresToRange(n, c.acresMax));
                  }}
                  width={70}
                />
              </Field>
              <Field label="Acres, maximum">
                <Num
                  value={c.acresMax}
                  onChange={(n) => {
                    set("acresMax", n);
                    setPlanAcres(clampAcresToRange(c.acresMin, n));
                  }}
                  width={70}
                />
              </Field>
              <Field label="Price, maximum">
                <Num
                  value={c.priceMax}
                  onChange={(n) => {
                    set("priceMax", n);
                    writeLandCost(n);
                  }}
                />
              </Field>
              <Text size="small" tone="tertiary">
                The retirement plan and the self-reliance page use {STATES[c.state].name}, {planAcres} acres, and{" "}
                {money(c.priceMax)} as the land cost. Changing the state, this range, or this maximum updates those pages.
                A listing you load with Use in plan replaces the acreage and the land cost with that parcel.
              </Text>
              <Divider />
              <Field label="Water on the land">
                <Toggle checked={c.waterOnLand} onChange={(v) => set("waterOnLand", v)} />
              </Field>
              <Field label="Any water within, miles (0 = skip)">
                <Num value={c.waterWithinMi} onChange={(n) => set("waterWithinMi", n)} width={70} />
              </Field>
              <Field label="Require year-round water">
                <Toggle checked={c.perennial} onChange={(v) => set("perennial", v)} />
              </Field>
              <Field label="Fishing nearby">
                <Toggle checked={c.fishing} onChange={(v) => set("fishing", v)} />
              </Field>
              <Field label="Power line within, miles (0 = skip)">
                <Num value={c.powerWithinMi} onChange={(n) => set("powerWithinMi", n)} width={70} />
              </Field>
              <Field label="Avoid FEMA flood zones">
                <Toggle checked={c.noFlood} onChange={(v) => set("noFlood", v)} />
              </Field>
              <Field label="Hospital within, miles (0 = skip)">
                <Num value={c.hospitalWithinMi} onChange={(n) => set("hospitalWithinMi", n)} width={70} />
              </Field>
              <Field label="Town within, miles (0 = skip)">
                <Num value={c.townWithinMi} onChange={(n) => set("townWithinMi", n)} width={70} />
              </Field>
              <Field label="No HOA or road association">
                <Toggle checked={c.noHoa} onChange={(v) => set("noHoa", v)} />
              </Field>
              <Field label="Plan's uses allowed by covenants">
                <Toggle checked={c.usesAllowed} onChange={(v) => set("usesAllowed", v)} />
              </Field>
              <Divider />
              <Pill
                onClick={() => {
                  setC(DEFAULT_CRITERIA);
                  applyLinkedState(DEFAULT_CRITERIA.state);
                  writeLandCost(DEFAULT_CRITERIA.priceMax);
                  setPlanAcres(clampAcresToRange(DEFAULT_CRITERIA.acresMin, DEFAULT_CRITERIA.acresMax));
                }}
              >
                Reset criteria
              </Pill>
            </Stack>
          </CardBody>
        </Card>

        <Stack gap={12}>
          <H2>1. Search the listing sites</H2>
          <Text tone="secondary">
            LandWatch opens in your usual browser on the county, {wantsDwelling(c.zillow) ? "homes" : "property type"}, {c.acresMin}–
            {c.acresMax} acres{c.priceMax > 0 ? `, and under ${money(c.priceMax)}` : ""}. Land.com and Lands of America
            answer this computer with Access Denied on every page, including a single listing, in Chrome as well as
            Brave. Those buttons are gone. Zillow opens in Chrome with the home types and listing types checked above,
            on that acre range and price. Save the search on the site to get new listings by email.
          </Text>
          <Table headers={["Where", "Open search"]} rows={linkRows} />
          <Callout tone="neutral" title="Why the app doesn't scrape the sites">
            LandWatch, Land.com and Lands of America are owned by CoStar, and their terms ban automated access. They
            also block bots. Opening the searches in your browser and adding the good listings here keeps you within
            their rules, and their free email alerts do the watching for you.
          </Callout>
          <Callout tone="info" title="Also worth checking">
            The listing's county GIS or appraiser site (for parcel lines, owner and taxes), the county clerk for
            recorded covenants and any owners' association, the electric co-op (a written line-extension quote),
            starlink.com/map (service at the address), and your state's wildlife department maps of public hunting land nearby.
          </Callout>
        </Stack>
      </Grid>

      <Stack gap={12}>
        <H2>2. Check a listing</H2>
        <Grid columns="minmax(0, 360px) minmax(0, 1fr)" gap={20} align="start">
          <Card>
            <CardHeader>Add a listing</CardHeader>
            <CardBody>
              <Stack gap={10}>
                <Text size="small" tone="secondary">
                  Click the property on the map, or paste coordinates or a Google Maps link. Most listings show a map
                  pin or GPS coordinates.
                </Text>
                <TextInput value={form.where} onChange={(v) => setForm({ ...form, where: v })} placeholder="34.4012, -95.4123" style={{ width: "100%" }} />
                <Text size="small" tone={pending ? "secondary" : "tertiary"}>
                  {pending ? `Location: ${pending[0].toFixed(5)}, ${pending[1].toFixed(5)}` : "No location yet"}
                </Text>
                <TextInput value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="Name, e.g. Kiamichi 60" style={{ width: "100%" }} />
                <TextInput value={form.url} onChange={(v) => setForm({ ...form, url: v })} placeholder="Listing link (optional)" style={{ width: "100%" }} />
                <Row gap={8}>
                  <TextInput value={form.price} onChange={(v) => setForm({ ...form, price: v })} placeholder="Price" style={{ width: "50%" }} />
                  <TextInput value={form.acres} onChange={(v) => setForm({ ...form, acres: v })} placeholder="Acres" style={{ width: "50%" }} />
                </Row>
                <TextInput value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} placeholder="Notes: well, power at road, owner financing…" style={{ width: "100%" }} />
                {formError && (
                  <Text size="small" tone="secondary" style={{ color: "var(--c-red)" }}>
                    {formError}
                  </Text>
                )}
                <Pill onClick={add}>Add and check</Pill>
              </Stack>
            </CardBody>
          </Card>
          <Stack gap={8}>
            <LandMap
              center={STATE_META[c.state].view}
              listings={evaluated.map(({ l, rows }) => ({ id: l.id, name: l.name, lat: l.lat, lon: l.lon, acres: l.acres, tone: l.check ? score(rows).tone : "#a3a3a3" }))}
              selectedId={selectedId}
              pending={pending}
              water={selectedId ? waterById[selectedId] ?? [] : []}
              onPick={(lat, lon) => setForm((f) => ({ ...f, where: `${lat.toFixed(5)}, ${lon.toFixed(5)}` }))}
              onSelect={setSelectedId}
            />
            <Text size="small" tone="tertiary">
              Dot colors: green meets everything, blue has nothing failing yet, amber misses one, red misses more. The
              selected listing shows its approximate footprint (a circle of its acreage around the pin), a dashed
              1-mile ring, and USGS-mapped water: solid blue is year-round, dashed is seasonal. Switch to aerial view
              with the layer button.
            </Text>
          </Stack>
        </Grid>

        {listings.length > 0 && (
          <Table
            headers={["Listing", "Price", "Acres", "$/acre", "Nearest water", "Flood zone", "Power line", "Hospital", "HOA", "Meets", ""]}
            columnAlign={["left", "right", "right", "right", "left", "left", "left", "left", "left", "left", "left"]}
            rowTone={evaluated.map(({ l }) => (l.id === selectedId ? "info" : undefined))}
            rows={evaluated.map(({ l, rows }) => {
              const s = score(rows);
              const k = l.check;
              return [
                <Pill key="n" size="sm" active={l.id === selectedId} onClick={() => setSelectedId(l.id)}>
                  {l.name}
                </Pill>,
                money(l.price),
                String(l.acres),
                money(l.price / l.acres),
                k?.water ? fmtDist(k.water.nearestM) : k?.errors.water ? "error" : busy[l.id] ? "checking…" : "—",
                k?.flood ? (k.flood.zone ?? "unmapped") : k?.errors.flood ? "error" : busy[l.id] ? "checking…" : "—",
                k?.power ? fmtDist(k.power.nearestM) : k?.errors.osm ? "error" : busy[l.id] ? "checking…" : "—",
                k?.hospital ? `${miles(k.hospital.m).toFixed(0)} mi` : k?.hospital === null ? "50+ mi" : busy[l.id] ? "checking…" : "—",
                l.deed?.hoa === "yes" ? "Yes" : l.deed?.hoa === "none" ? "None" : "—",
                <Text key="s" size="small" weight="semibold" style={{ color: k || l.deed ? s.tone : undefined }}>
                  {k || l.deed ? `${s.pass} of ${s.total}` : "—"}
                </Text>,
                <Row key="a" gap={4} wrap>
                  {l.url && (
                    <Pill size="sm" onClick={() => void openExternal(l.url)}>
                      Open
                    </Pill>
                  )}
                  <Pill size="sm" onClick={() => void check(l)}>
                    {busy[l.id] ? "Checking…" : "Recheck"}
                  </Pill>
                  <Pill size="sm" onClick={() => onUseInPlan(planState(l), l.price, l.acres, l)}>
                    Use in plan
                  </Pill>
                  <Pill size="sm" onClick={() => remove(l.id)}>
                    Remove
                  </Pill>
                </Row>,
              ];
            })}
          />
        )}

        {selected && (
          <Stack gap={8}>
            <H3>{selected.name}: how it measures up</H3>
            <Table
              headers={["Criterion", "Finding", "Meets?", "Note"]}
              rowTone={evaluate(selected, c).map((r) => (r.verdict === "pass" ? "success" : r.verdict === "fail" ? "danger" : "neutral"))}
              rows={evaluate(selected, c).map((r) => [
                r.label,
                r.value,
                <Text key="v" size="small" weight="semibold" style={{ color: TONE[r.verdict] }}>
                  {r.label === "Elevation at pin" ? "" : VERDICT_TEXT[r.verdict]}
                </Text>,
                <Text key="n" size="small" tone="tertiary">
                  {r.note ?? ""}
                </Text>,
              ])}
            />
            <DeedCard listing={selected} onChange={(patch) => setDeed(selected.id, patch)} />
            {selected.notes && (
              <Text size="small" tone="secondary">
                Notes: {selected.notes}
              </Text>
            )}
            {selected.check && Object.keys(selected.check.errors).length > 0 && (
              <Callout tone="warning" title="Some checks didn't finish">
                {Object.entries(selected.check.errors)
                  .map(([k, v]) => `${k === "osm" ? "Power, hospital and town (OpenStreetMap)" : k}: ${v}`)
                  .join(". ")}
                . These public servers are sometimes slow or busy. Click Recheck in a minute.
              </Callout>
            )}
            <Text size="small" tone="tertiary">
              "Use in plan" sets the retirement plan's land cost to {money(selected.price)} and its acreage to{" "}
              {selected.acres}
              {planState(selected) ? `, and switches the plan to ${STATES[planState(selected)!].name}` : ""}. Distances to the hospital and town are straight-line,
              so expect 1.3–1.5× that by road. The checks use the pin as the center of the property. Walk the land and
              check the county parcel map before you trust any of it. Property radius at {selected.acres} acres: about{" "}
              {fmtDist(propertyRadiusM(selected.acres))}.
            </Text>
          </Stack>
        )}
      </Stack>
    </Stack>
  );
}
