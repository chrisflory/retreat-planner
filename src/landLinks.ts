// Search links for the CoStar land sites. Formats checked by loading each one (November 2026).

const slug = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export type LandQuery = {
  /** Full state name, e.g. "Oklahoma". */
  stateName: string;
  /** Two-letter state code, e.g. "OK". */
  stateCode: string;
  /** County name without "County", or null for the whole state. */
  county: string | null;
  acresMin: number;
  acresMax: number;
  /** 0 means no price limit. */
  priceMax: number;
};

/**
 * LandWatch: /{state}-land-for-sale/{county}-county/{type}/price-under-N/acres-A-B
 * The property type goes after the county. "{state}-{type}-for-sale" (the old format) is a 400 page
 * for every type except plain land and undeveloped land. typeSlug null means all land.
 */
export function landwatchUrl(q: LandQuery, typeSlug: string | null): string {
  const lo = Math.max(0, Math.round(q.acresMin));
  const hi = Math.max(0, Math.round(q.acresMax));
  const parts = [`${slug(q.stateName)}-land-for-sale`];
  if (q.county) parts.push(`${slug(q.county)}-county`);
  if (typeSlug) parts.push(typeSlug);
  if (q.priceMax > 0) parts.push(`price-under-${Math.round(q.priceMax)}`);
  if (lo > 0 && hi > lo) parts.push(`acres-${lo}-${hi}`);
  else if (lo > 0) parts.push(`acres-over-${lo}`);
  else if (hi > 0) parts.push(`acres-under-${hi}`);
  return `https://www.landwatch.com/${parts.join("/")}`;
}

/**
 * Land.com: /{County}-County-{ST}/{type}/under-N/A-B-acres/ (or /{State}/... for the whole state).
 * Price comes before acres, the order Land.com itself uses.
 */
export function landComUrl(q: LandQuery, typeSlug: string): string {
  const lo = Math.max(0, Math.round(q.acresMin));
  const hi = Math.max(0, Math.round(q.acresMax));
  const place = q.county
    ? `${q.county.trim().replace(/\s+/g, "-")}-County-${q.stateCode.toUpperCase()}`
    : q.stateName.trim().replace(/\s+/g, "-");
  const parts = [place, typeSlug];
  if (q.priceMax > 0) parts.push(`under-${Math.round(q.priceMax)}`);
  if (lo > 0 && hi > lo) parts.push(`${lo}-${hi}-acres`);
  else if (lo > 0) parts.push(`over-${lo}-acres`);
  else if (hi > 0) parts.push(`under-${hi}-acres`);
  return `https://www.land.com/${parts.join("/")}/`;
}

/** LandWatch's and Land.com's names for a home on land. */
export const LANDWATCH_HOMES = "homes";
export const LANDCOM_HOMES = "residential-property";
