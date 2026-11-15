// Saved plans: named snapshots of every input, kept in the app and exportable as .json files.
import { version as appVersion } from "../package.json";

export type PlanData = {
  params: Record<string, unknown>;
  upfront: Record<string, number>;
  recurring: Record<string, number>;
  estimates: Record<string, unknown>;
  chosen: unknown;
};

export type SavedPlan = PlanData & {
  name: string;
  savedAt: string;
  /** Kept automatically when another plan is loaded, so loading can be undone. */
  auto?: boolean;
};

type PlanFile = SavedPlan & { app: "retreat-planner"; format: 1; appVersion: string };

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

export function makePlan(name: string, data: PlanData, auto = false): SavedPlan {
  return { name: name.trim() || "Untitled plan", savedAt: new Date().toISOString(), ...structuredClone(data), ...(auto ? { auto } : {}) };
}

export function planToFile(plan: SavedPlan): string {
  const { auto: _auto, ...rest } = plan;
  const file: PlanFile = { app: "retreat-planner", format: 1, appVersion, ...rest };
  return JSON.stringify(file, null, 2);
}

/** Reads a plan file. Throws an Error with a plain-language message if it isn't one. */
export function planFromFile(text: string): SavedPlan {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("That file isn't a Retreat Planner plan (it isn't valid JSON).");
  }
  if (!isObject(raw) || raw.app !== "retreat-planner") throw new Error("That file isn't a Retreat Planner plan.");
  if (typeof raw.format !== "number" || raw.format > 1) {
    throw new Error("That plan was saved by a newer version of Retreat Planner. Update the app to open it.");
  }
  if (!isObject(raw.params) || !isObject(raw.upfront) || !isObject(raw.recurring)) {
    throw new Error("That plan file is missing some of its numbers.");
  }
  const numbers = (o: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(o).filter(([, v]) => typeof v === "number" && Number.isFinite(v))) as Record<string, number>;
  return {
    name: typeof raw.name === "string" && raw.name.trim() ? raw.name.trim() : "Imported plan",
    savedAt: typeof raw.savedAt === "string" ? raw.savedAt : new Date().toISOString(),
    params: raw.params,
    upfront: numbers(raw.upfront),
    recurring: numbers(raw.recurring),
    estimates: isObject(raw.estimates) ? raw.estimates : {},
    chosen: raw.chosen ?? null,
  };
}

export const planFileName = (name: string) =>
  `retreat-plan-${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "plan"}.json`;

const isTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/** Saves a plan file with the system dialog. Returns where it was saved, "" in a browser, or null if cancelled. */
export async function exportPlanFile(plan: SavedPlan): Promise<string | null> {
  const contents = planToFile(plan);
  const fileName = planFileName(plan.name);
  if (isTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");
    return (await invoke<string | null>("export_plan", { contents, fileName })) ?? null;
  }
  const url = URL.createObjectURL(new Blob([contents], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return "";
}

/** Asks for a plan file with the system dialog and returns its text, or null if cancelled. */
export async function importPlanFile(): Promise<string | null> {
  if (isTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");
    return (await invoke<string | null>("import_plan")) ?? null;
  }
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      file.text().then(resolve, () => resolve(null));
    };
    input.click();
  });
}

/** Adds or replaces a plan by name (case-insensitive). Auto-kept plans replace each other. */
export function upsertPlan(list: SavedPlan[], plan: SavedPlan): SavedPlan[] {
  const key = plan.name.toLowerCase();
  const rest = list.filter((p) => (plan.auto ? !p.auto : p.name.toLowerCase() !== key));
  return [plan, ...rest];
}

/** A name not already used in the list. */
export function uniqueName(list: SavedPlan[], name: string): string {
  const taken = new Set(list.map((p) => p.name.toLowerCase()));
  if (!taken.has(name.toLowerCase())) return name;
  for (let i = 2; ; i++) {
    const next = `${name} (${i})`;
    if (!taken.has(next.toLowerCase())) return next;
  }
}
