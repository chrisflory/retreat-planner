import { describe, expect, it } from "vitest";
import { makePlan, planFileName, planFromFile, planToFile, uniqueName, upsertPlan, type PlanData } from "./plans";

const data: PlanData = {
  params: { k401: 248072, retireAge: 67, state: "WY" },
  upfront: { land: 200000, well: 12000 },
  recurring: { food: 3600 },
  estimates: { acres: 53 },
  chosen: null,
};

describe("plan files", () => {
  it("round-trips every entry", () => {
    const plan = makePlan("Wyoming house at 67", data);
    const back = planFromFile(planToFile(plan));
    expect(back).toMatchObject({ name: "Wyoming house at 67", ...data });
  });

  it("keeps a copy, not a reference", () => {
    const d = structuredClone(data);
    const plan = makePlan("x", d);
    (d.params as Record<string, unknown>).k401 = 1;
    expect(plan.params.k401).toBe(248072);
  });

  it("rejects files that aren't plans, in plain words", () => {
    expect(() => planFromFile("not json")).toThrow(/isn't a Retreat Planner plan/);
    expect(() => planFromFile(JSON.stringify({ hello: 1 }))).toThrow(/isn't a Retreat Planner plan/);
    expect(() => planFromFile(JSON.stringify({ app: "retreat-planner", format: 9 }))).toThrow(/newer version/);
    expect(() => planFromFile(JSON.stringify({ app: "retreat-planner", format: 1, params: {} }))).toThrow(/missing/);
  });

  it("drops non-number costs from a hand-edited file", () => {
    const text = planToFile(makePlan("x", { ...data, upfront: { land: 200000, bad: "oops" as unknown as number } }));
    expect(planFromFile(text).upfront).toEqual({ land: 200000 });
  });

  it("makes a safe file name", () => {
    expect(planFileName("Wyoming house @ 67!")).toBe("retreat-plan-wyoming-house-67.json");
    expect(planFileName("   ")).toBe("retreat-plan-plan.json");
  });
});

describe("saved plan list", () => {
  it("replaces a plan saved under the same name", () => {
    const a = makePlan("Plan A", data);
    const a2 = makePlan("plan a", { ...data, upfront: { land: 1 } });
    const list = upsertPlan(upsertPlan([], a), a2);
    expect(list).toHaveLength(1);
    expect(list[0].upfront.land).toBe(1);
  });

  it("keeps only one automatic 'before loading' plan", () => {
    let list = upsertPlan([], makePlan("Mine", data));
    list = upsertPlan(list, makePlan("Before loading A", data, true));
    list = upsertPlan(list, makePlan("Before loading B", data, true));
    expect(list.map((p) => p.name)).toEqual(["Before loading B", "Mine"]);
  });

  it("finds an unused name for an import", () => {
    const list = [makePlan("Plan", data), makePlan("Plan (2)", data)];
    expect(uniqueName(list, "Plan")).toBe("Plan (3)");
    expect(uniqueName(list, "Other")).toBe("Other");
  });
});
