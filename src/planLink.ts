/** Figures the retirement plan, self-reliance page, and land search all show. */

const prefix = "retreat-planner:";

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(prefix + key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  localStorage.setItem(prefix + key, JSON.stringify(value));
}

export const DEFAULT_COUNTIES: Record<string, string> = {
  OK: "Pushmataha, Latimer, Le Flore, McCurtain, Pittsburg",
  MT: "Fergus, Judith Basin, Meagher",
  WY: "Big Horn, Park, Washakie, Hot Springs",
  ID: "Boundary, Bonner, Benewah",
  SD: "Butte, Perkins, Harding, Meade",
  ND: "McKenzie, Dunn, Mercer",
  TN: "Cumberland, Van Buren, Grundy, Bledsoe",
  AR: "Polk, Montgomery, Newton, Searcy",
  MO: "Shannon, Texas, Howell, Douglas",
  WV: "Webster, Nicholas, Pocahontas",
  MS: "Winston, Choctaw, Attala",
};

export type LinkedLand = {
  saved: boolean;
  state: string;
  counties: string;
  acresMin: number;
  acresMax: number;
  priceMax: number;
};

export function readLinkedLand(): LinkedLand {
  const raw = localStorage.getItem(prefix + "land-criteria-v1");
  const c = raw ? readJson<Partial<LinkedLand>>("land-criteria-v1", {}) : {};
  const state = c.state || "OK";
  return {
    saved: raw !== null,
    state,
    counties: c.counties || DEFAULT_COUNTIES[state] || "",
    acresMin: Number.isFinite(c.acresMin) ? Number(c.acresMin) : 40,
    acresMax: Number.isFinite(c.acresMax) ? Number(c.acresMax) : 80,
    priceMax: Number.isFinite(c.priceMax) ? Number(c.priceMax) : 125000,
  };
}

export function patchLinkedLand(patch: Partial<Omit<LinkedLand, "saved">>) {
  const cur = readJson<Record<string, unknown>>("land-criteria-v1", {});
  writeJson("land-criteria-v1", { ...cur, ...patch });
}

export function writeLandCost(price: number) {
  const up = readJson<Record<string, number>>("upfront-v2", {});
  writeJson("upfront-v2", { ...up, land: Math.max(0, Math.round(price)) });
}

export function readPlanAcres(fallback = 50): number {
  const est = readJson<{ acres?: number }>("estimates-v1", {});
  return Number.isFinite(est.acres) ? Number(est.acres) : fallback;
}

export function writePlanAcres(acres: number) {
  const est = readJson<Record<string, unknown>>("estimates-v1", {});
  writeJson("estimates-v1", { ...est, acres: Math.max(0, Math.round(acres)) });
}

/** Keep the search range around the acreage the plan is using. */
export function expandAcreRange(acres: number) {
  const c = readLinkedLand();
  const n = Math.max(0, Math.round(acres));
  const acresMin = Math.min(c.acresMin, n);
  const acresMax = Math.max(c.acresMax, n);
  if (acresMin !== c.acresMin || acresMax !== c.acresMax) patchLinkedLand({ acresMin, acresMax });
  return { acresMin, acresMax };
}

/** Pull the plan's acreage inside the search range. Returns the acreage now in use. */
export function clampAcresToRange(min: number, max: number): number {
  const lo = Math.max(0, Math.round(Math.min(min, max)));
  const hi = Math.max(lo, Math.round(Math.max(min, max)));
  const acres = readPlanAcres();
  const next = Math.min(hi, Math.max(lo, acres));
  if (next !== acres) writePlanAcres(next);
  return next;
}

export function syncHoaFromListing(listingId: string, deed: { hoa?: string; hoaDues?: number }) {
  const chosen = readJson<{ id?: string; deed?: Record<string, unknown> } | null>("chosen-land-v1", null);
  if (!chosen || chosen.id !== listingId) return;
  const dues = deed.hoa === "yes" ? Math.max(0, Math.round(Number(deed.hoaDues) || 0)) : 0;
  const rec = readJson<Record<string, number>>("recurring-v2", {});
  writeJson("recurring-v2", { ...rec, hoa: dues });
  writeJson("chosen-land-v1", { ...chosen, deed: { ...(chosen.deed ?? {}), ...deed } });
}
