import { getJSON } from "./net";

export const M_PER_MILE = 1609.34;
const FT_PER_M = 3.28084;

type LatLon = [number, number];
export type WaterFeature = { name: string | null; kind: string; perennial: boolean; line?: LatLon[][]; area?: LatLon[][]; distM: number };

export type CheckResult = {
  county?: string;
  stateCode?: string;
  elevationFt?: number;
  flood?: { zone: string; highRisk: boolean } | { zone: null; highRisk: false };
  water?: {
    nearestM: number | null;
    nearestName: string | null;
    nearestPerennialM: number | null;
    nearestPondM: number | null;
    features: WaterFeature[];
  };
  power?: { nearestM: number | null; voltage: string | null };
  hospital?: { name: string; m: number } | null;
  town?: { name: string; m: number } | null;
  errors: Record<string, string>;
};

export const propertyRadiusM = (acres: number) => Math.sqrt((Math.max(acres, 0.1) * 4046.86) / Math.PI);

function project(lat0: number, lon0: number) {
  const kx = Math.cos((lat0 * Math.PI) / 180) * 111320;
  return ([lat, lon]: LatLon): [number, number] => [(lon - lon0) * kx, (lat - lat0) * 110540];
}

function distToPath(path: LatLon[], proj: (p: LatLon) => [number, number]): number {
  let best = Infinity;
  for (let i = 0; i < path.length; i++) {
    const [ax, ay] = proj(path[i]);
    if (path.length === 1) return Math.hypot(ax, ay);
    if (i === 0) continue;
    const [bx, by] = proj(path[i - 1]);
    const dx = ax - bx;
    const dy = ay - by;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(bx * dx + by * dy) / len2));
    best = Math.min(best, Math.hypot(bx + t * dx, by + t * dy));
  }
  return best;
}

function insideRings(rings: LatLon[][], proj: (p: LatLon) => [number, number]): boolean {
  let inside = false;
  for (const ring of rings) {
    const pts = ring.map(proj);
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i];
      const [xj, yj] = pts[j];
      if (yi > 0 !== yj > 0 && 0 < ((xj - xi) * (0 - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

export function haversineM(a: LatLon, b: LatLon): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const h =
    Math.sin(r(b[0] - a[0]) / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(r(b[1] - a[1]) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

const arcgisPoint = (lat: number, lon: number) =>
  encodeURIComponent(JSON.stringify({ x: lon, y: lat, spatialReference: { wkid: 4326 } }));

function arcgisQuery(base: string, lat: number, lon: number, extra: Record<string, string>) {
  const q = new URLSearchParams({
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    outSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    f: "json",
    ...extra,
  });
  return `${base}/query?geometry=${arcgisPoint(lat, lon)}&${q.toString()}`;
}

type ArcFeature = { attributes: Record<string, unknown>; geometry?: { paths?: number[][][]; rings?: number[][][] } };
type ArcResponse = { features?: ArcFeature[]; error?: { message: string } };

const FLOW_KIND: Record<number, string> = { 460: "Stream/river", 558: "River/lake channel", 336: "Canal/ditch" };
const BODY_KIND: Record<number, string> = { 390: "Lake/pond", 436: "Reservoir", 466: "Swamp/marsh" };
const toLatLon = (pts: number[][]): LatLon[] => pts.map(([x, y]) => [y, x]);

export async function checkWater(lat: number, lon: number): Promise<NonNullable<CheckResult["water"]>> {
  const base = "https://hydro.nationalmap.gov/arcgis/rest/services/nhd/MapServer";
  const common = { distance: String(Math.round(2 * M_PER_MILE)), units: "esriSRUnit_Meter", returnGeometry: "true", maxAllowableOffset: "0.0001" };
  const [flow, body] = await Promise.all([
    getJSON<ArcResponse>(arcgisQuery(`${base}/6`, lat, lon, { ...common, outFields: "gnis_name,fcode,ftype" })),
    getJSON<ArcResponse>(arcgisQuery(`${base}/12`, lat, lon, { ...common, outFields: "gnis_name,fcode,ftype,areasqkm" })),
  ]);
  if (flow.error) throw new Error(flow.error.message);
  const proj = project(lat, lon);
  const features: WaterFeature[] = [];
  for (const f of flow.features ?? []) {
    const ftype = Number(f.attributes.ftype ?? f.attributes.FTYPE);
    const fcode = Number(f.attributes.fcode ?? f.attributes.FCODE);
    if (!FLOW_KIND[ftype]) continue;
    const line = (f.geometry?.paths ?? []).map(toLatLon);
    const distM = Math.min(...line.map((p) => distToPath(p, proj)));
    features.push({
      name: (f.attributes.gnis_name ?? f.attributes.GNIS_NAME ?? null) as string | null,
      kind: FLOW_KIND[ftype],
      perennial: fcode === 46006 || ftype === 558,
      line,
      distM,
    });
  }
  for (const f of body?.features ?? []) {
    const ftype = Number(f.attributes.ftype ?? f.attributes.FTYPE);
    const fcode = Number(f.attributes.fcode ?? f.attributes.FCODE);
    if (!BODY_KIND[ftype]) continue;
    const area = (f.geometry?.rings ?? []).map(toLatLon);
    const distM = insideRings(area, proj) ? 0 : Math.min(...area.map((r) => distToPath(r, proj)));
    features.push({
      name: (f.attributes.gnis_name ?? f.attributes.GNIS_NAME ?? null) as string | null,
      kind: BODY_KIND[ftype],
      perennial: fcode === 39004 || fcode === 39009 || ftype === 436,
      area,
      distM,
    });
  }
  features.sort((a, b) => a.distM - b.distM);
  const min = (xs: WaterFeature[]) => (xs.length ? xs[0].distM : null);
  const nearest = features[0];
  return {
    nearestM: nearest ? nearest.distM : null,
    nearestName: nearest ? nearest.name ?? nearest.kind : null,
    nearestPerennialM: min(features.filter((f) => f.perennial)),
    nearestPondM: min(features.filter((f) => f.area && f.kind !== "Swamp/marsh")),
    features,
  };
}

async function checkFlood(lat: number, lon: number): Promise<NonNullable<CheckResult["flood"]>> {
  const r = await getJSON<ArcResponse>(
    arcgisQuery("https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28", lat, lon, {
      outFields: "FLD_ZONE,ZONE_SUBTY,SFHA_TF",
      returnGeometry: "false",
    }),
    40000,
  );
  if (r.error) throw new Error(r.error.message);
  const f = r.features?.[0];
  if (!f) return { zone: null, highRisk: false };
  const zone = String(f.attributes.FLD_ZONE ?? "?");
  const sub = f.attributes.ZONE_SUBTY ? ` (${String(f.attributes.ZONE_SUBTY).toLowerCase()})` : "";
  return { zone: zone + sub, highRisk: f.attributes.SFHA_TF === "T" };
}

async function checkCounty(lat: number, lon: number) {
  const r = await getJSON<{ results?: Array<{ county_name: string; state_code: string }> }>(
    `https://geo.fcc.gov/api/census/area?lat=${lat}&lon=${lon}&format=json`,
  );
  const hit = r.results?.[0];
  if (!hit) throw new Error("outside the US");
  return { county: hit.county_name, stateCode: hit.state_code };
}

async function checkElevation(lat: number, lon: number) {
  const r = await getJSON<{ value?: number | string }>(
    `https://epqs.nationalmap.gov/v1/json?x=${lon}&y=${lat}&units=Feet&wkid=4326`,
  );
  const v = Number(r.value);
  if (!Number.isFinite(v) || v < -1000) throw new Error("no elevation data");
  return v;
}

type OsmElement = {
  type: string;
  tags?: Record<string, string>;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  geometry?: Array<{ lat: number; lon: number }>;
};

async function checkOsm(lat: number, lon: number) {
  const here = `${lat},${lon}`;
  const q = `[out:json][timeout:80];
way["power"~"^(line|minor_line)$"](around:${Math.round(3 * M_PER_MILE)},${here});
out geom;
(node["amenity"="hospital"](around:${Math.round(50 * M_PER_MILE)},${here});way["amenity"="hospital"](around:${Math.round(50 * M_PER_MILE)},${here}););
out center tags;
node["place"~"^(town|city)$"](around:${Math.round(40 * M_PER_MILE)},${here});
out;`;
  const r = await getJSON<{ elements: OsmElement[] }>(
    `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(q)}`,
    95000,
  );
  const proj = project(lat, lon);
  let power: { nearestM: number | null; voltage: string | null } = { nearestM: null, voltage: null };
  let hospital: { name: string; m: number } | null = null;
  let town: { name: string; m: number } | null = null;
  for (const e of r.elements) {
    const t = e.tags ?? {};
    if (t.power && e.geometry) {
      const d = distToPath(e.geometry.map((g) => [g.lat, g.lon] as LatLon), proj);
      if (power.nearestM === null || d < power.nearestM) power = { nearestM: d, voltage: t.voltage ?? null };
    } else if (t.amenity === "hospital") {
      const c = e.center ?? (e.lat !== undefined ? { lat: e.lat, lon: e.lon! } : null);
      if (!c) continue;
      const d = haversineM([lat, lon], [c.lat, c.lon]);
      if (!hospital || d < hospital.m) hospital = { name: t.name ?? "Hospital", m: d };
    } else if (t.place && e.lat !== undefined) {
      const d = haversineM([lat, lon], [e.lat, e.lon!]);
      if (!town || d < town.m) town = { name: t.name ?? "Town", m: d };
    }
  }
  return { power, hospital, town };
}

export async function runChecks(lat: number, lon: number, onPartial: (r: CheckResult) => void): Promise<CheckResult> {
  const result: CheckResult = { errors: {} };
  const push = () => onPartial({ ...result, errors: { ...result.errors } });
  const step = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (e) {
      result.errors[name] = e instanceof Error ? e.message : String(e);
    }
    push();
  };
  await Promise.all([
    step("county", async () => {
      Object.assign(result, await checkCounty(lat, lon));
    }),
    step("elevation", async () => {
      result.elevationFt = await checkElevation(lat, lon);
    }),
    step("water", async () => {
      result.water = await checkWater(lat, lon);
    }),
    step("flood", async () => {
      result.flood = await checkFlood(lat, lon);
    }),
    step("osm", async () => {
      const o = await checkOsm(lat, lon);
      result.power = o.power;
      result.hospital = o.hospital;
      result.town = o.town;
    }),
  ]);
  return result;
}

export const miles = (m: number) => m / M_PER_MILE;
export const fmtDist = (m: number | null | undefined) =>
  m === null || m === undefined ? "none found" : m < 300 ? `${Math.round(m * FT_PER_M)} ft` : `${miles(m).toFixed(1)} mi`;

export function parseLatLon(s: string): LatLon | null {
  const at = s.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  const m = at ?? s.match(/(-?\d{1,2}\.\d+)\s*[, ]\s*(-?\d{1,3}\.\d+)/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lon = Number(m[2]);
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return [lat, lon];
}
