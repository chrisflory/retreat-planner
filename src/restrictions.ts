/** Deed restrictions and HOA facts the user records for a chosen parcel. Map APIs do not carry these. */

export type UseAnswer = "unknown" | "allowed" | "banned";
export type HoaStatus = "unknown" | "none" | "yes";
export type CcrStatus = "unknown" | "none" | "recorded";

export type DeedLimits = {
  hoa: HoaStatus;
  hoaName: string;
  hoaDues: number;
  ccr: CcrStatus;
  rv: UseAnswer;
  chickens: UseAnswer;
  garden: UseAnswer;
  hunting: UseAnswer;
  well: UseAnswer;
  septic: UseAnswer;
  buildings: UseAnswer;
  offgrid: UseAnswer;
  minHouse: UseAnswer;
  notes: string;
};

export const EMPTY_DEED: DeedLimits = {
  hoa: "unknown",
  hoaName: "",
  hoaDues: 0,
  ccr: "unknown",
  rv: "unknown",
  chickens: "unknown",
  garden: "unknown",
  hunting: "unknown",
  well: "unknown",
  septic: "unknown",
  buildings: "unknown",
  offgrid: "unknown",
  minHouse: "unknown",
  notes: "",
};

export const USE_ITEMS: { key: keyof Pick<DeedLimits, "rv" | "chickens" | "garden" | "hunting" | "well" | "septic" | "buildings" | "offgrid" | "minHouse">; label: string; short: string }[] = [
  { key: "rv", label: "RV or manufactured home as the residence", short: "RV living" },
  { key: "chickens", label: "Chickens", short: "chickens" },
  { key: "garden", label: "Garden and fences", short: "garden" },
  { key: "hunting", label: "Hunting and shooting", short: "hunting" },
  { key: "well", label: "A well", short: "a well" },
  { key: "septic", label: "Septic or an outhouse", short: "septic" },
  { key: "buildings", label: "Barn, coop and sheds", short: "outbuildings" },
  { key: "offgrid", label: "Solar, a generator, or no grid power", short: "off-grid power" },
  { key: "minHouse", label: "A cabin or RV meets any minimum house size", short: "minimum house size" },
];

export type UseKey = (typeof USE_ITEMS)[number]["key"];

export type Verdict = "pass" | "fail" | "unknown";

export function deedOf(raw: Partial<DeedLimits> | undefined): DeedLimits {
  const d = { ...EMPTY_DEED, ...raw };
  d.hoaDues = Number.isFinite(d.hoaDues) ? Math.max(0, d.hoaDues) : 0;
  return d;
}

export function hoaFinding(d: DeedLimits): { verdict: Verdict; value: string } {
  if (d.hoa === "none") return { verdict: "pass", value: "None" };
  if (d.hoa === "yes") {
    const who = d.hoaName.trim() || "Yes";
    const dues = d.hoaDues > 0 ? `, $${Math.round(d.hoaDues).toLocaleString("en-US")}/yr` : "";
    return { verdict: "fail", value: `${who}${dues}` };
  }
  return { verdict: "unknown", value: "Not filled in" };
}

export function usesFinding(d: DeedLimits): { verdict: Verdict; value: string } {
  const bans = USE_ITEMS.filter((i) => d[i.key] === "banned");
  if (bans.length) return { verdict: "fail", value: `Banned: ${bans.map((i) => i.short).join(", ")}` };
  const open = USE_ITEMS.filter((i) => d[i.key] !== "allowed");
  if (open.length === 0) return { verdict: "pass", value: "All marked allowed" };
  if (d.ccr === "none" && d.hoa === "none") return { verdict: "pass", value: "No HOA and no recorded covenants marked" };
  if (open.length === USE_ITEMS.length) return { verdict: "unknown", value: "Not filled in" };
  return { verdict: "unknown", value: `${USE_ITEMS.length - open.length} of ${USE_ITEMS.length} marked allowed` };
}

export function bannedUses(d: DeedLimits): string[] {
  return USE_ITEMS.filter((i) => d[i.key] === "banned").map((i) => i.label);
}

const clerkSlug = (county: string) => county.replace(/ county$/i, "").toLowerCase().replace(/[^a-z]/g, "");

export function recordLinks(county: string | undefined, stateCode: string | undefined): { site: string; url: string }[] {
  const name = (county ?? "").replace(/ county$/i, "").trim();
  const links: { site: string; url: string }[] = [];
  if (stateCode === "OK" && name) {
    links.push({
      site: `${name} County clerk records`,
      url: `https://okcountyrecords.com/search/${clerkSlug(name)}`,
    });
  }
  const where = name ? `"${name} County" ${stateCode ?? ""}`.trim() : (stateCode ?? "");
  const q = `${where} county clerk recorder search covenants restrictions "homeowners association"`.trim();
  links.push({ site: "Find the county clerk", url: `https://www.google.com/search?q=${encodeURIComponent(q)}` });
  return links;
}

export type ChosenLand = {
  id: string;
  name: string;
  url: string;
  county?: string;
  stateCode?: string;
  price: number;
  acres: number;
  deed: DeedLimits;
};

export type ListingDeedSource = {
  id: string;
  name: string;
  url: string;
  price: number;
  acres: number;
  deed?: Partial<DeedLimits>;
  check?: { county?: string; stateCode?: string };
};

/** Prefer the live listing, so edits on Land search show up after returning to the plan. */
export function resolveChosen(chosen: ChosenLand | null, listings: ListingDeedSource[]): ChosenLand | null {
  if (!chosen) return null;
  const live = listings.find((l) => l.id === chosen.id);
  if (!live) return { ...chosen, deed: deedOf(chosen.deed) };
  return {
    id: live.id,
    name: live.name,
    url: live.url,
    price: live.price,
    acres: live.acres,
    county: live.check?.county ?? chosen.county,
    stateCode: live.check?.stateCode ?? chosen.stateCode,
    deed: deedOf(live.deed ?? chosen.deed),
  };
}
