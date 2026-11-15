import { describe, expect, it } from "vitest";
import {
  DEFAULT_PARAMS,
  PRESET_PLANNED,
  RECURRING_DEFAULTS,
  acaFor,
  acaPercent,
  badStartReturns,
  covers,
  deferralLimit,
  derivedForState,
  fedTax,
  fraMonths,
  goalOf,
  lumpSumTax,
  marketOdds,
  simulate,
  ssBenefitFactor,
  ssPay,
  stateOf,
  taxableSocialSecurity,
  upfrontTotalFor,
  type Params,
} from "./engine";

/** The plan as the app builds it from the planned preset and the chosen state. */
function inputs(over: Partial<Params> = {}) {
  const p: Params = { ...DEFAULT_PARAMS, ...over };
  const d = derivedForState(stateOf(p), p.heat);
  const up: Record<string, number> = { ...PRESET_PLANNED, ...d.up };
  const rec: Record<string, number> = { ...RECURRING_DEFAULTS, ...d.rec };
  return { p, up, rec, upfront: upfrontTotalFor(p, up), land: up.land };
}

function run(over: Partial<Params> = {}, returns?: number[]) {
  const { p, rec, upfront, land } = inputs(over);
  return simulate(p, rec, upfront, p.inflation, null, land, returns ? { returns } : undefined);
}

describe("federal income tax, 2026", () => {
  it("matches the single brackets", () => {
    // $100,000 - $16,100 = $83,900: 10% of 12,400 + 12% of 38,000 + 22% of 33,500
    expect(fedTax(100000, "single", 59)).toBeCloseTo(13170, 0);
  });

  it("matches the joint brackets", () => {
    // $100,000 - $32,200 = $67,800: 10% of 24,800 + 12% of 43,000
    expect(fedTax(100000, "mfj", 59)).toBeCloseTo(7640, 0);
  });

  it("adds the $6,000 senior deduction for 2025–2028 only", () => {
    // 50,000 - 16,100 - 2,050 - 6,000 = 25,850
    expect(fedTax(50000, "single", 66, 1, 2027)).toBeCloseTo(1240 + 13450 * 0.12, 0);
    // No senior deduction in 2029: 50,000 - 16,100 - 2,050 = 31,850
    expect(fedTax(50000, "single", 66, 1, 2029)).toBeCloseTo(1240 + 19450 * 0.12, 0);
    // Not before 65
    expect(fedTax(50000, "single", 64, 1, 2027)).toBeCloseTo(fedTax(50000, "single", 64, 1, 2029), 6);
  });

  it("phases the senior deduction out above $75,000", () => {
    const full = fedTax(100000, "single", 66, 1, 2029);
    const withSenior = fedTax(100000, "single", 66, 1, 2026);
    // 6,000 - 6% of 25,000 = 4,500 deducted at the 22% rate
    expect(full - withSenior).toBeCloseTo(4500 * 0.22, 0);
  });
});

describe("taxable Social Security (Pub. 915)", () => {
  it("is zero under the first threshold", () => {
    expect(taxableSocialSecurity(20000, 10000, "single")).toBe(0);
  });
  it("taxes up to half between the thresholds", () => {
    // combined 32,000: half of the 7,000 above 25,000
    expect(taxableSocialSecurity(24000, 20000, "single")).toBe(3500);
  });
  it("taxes up to 85% above the upper threshold", () => {
    // combined 55,000: 4,500 + 85% of 21,000
    expect(taxableSocialSecurity(30000, 40000, "single")).toBeCloseTo(22350, 6);
    expect(taxableSocialSecurity(30000, 400000, "single")).toBeCloseTo(25500, 6);
  });
});

describe("Social Security claiming", () => {
  it("uses the birth-year full retirement age", () => {
    expect(fraMonths(1960)).toBe(67 * 12);
    expect(fraMonths(1957)).toBe(66 * 12 + 6);
    expect(fraMonths(1950)).toBe(66 * 12);
    expect(fraMonths(1955)).toBe(66 * 12 + 2);
    expect(fraMonths(1940)).toBe(65 * 12 + 6);
  });
  it("reduces early claims and credits delay", () => {
    expect(ssBenefitFactor(62, 67 * 12)).toBeCloseTo(0.7, 6);
    expect(ssBenefitFactor(67, 67 * 12)).toBeCloseTo(1, 6);
    expect(ssBenefitFactor(70, 67 * 12)).toBeCloseTo(1.24, 6);
  });
  it("adds the spouse's check only with two adults", () => {
    const base = { ...DEFAULT_PARAMS, ssAge: 62, ssMonthly: 1000, ssSpouseMonthly: 800, ssSpouseStart: 64 };
    const age62 = 62 - base.retireAge;
    const age64 = 64 - base.retireAge;
    expect(ssPay({ ...base, adults: 1 }, age64, 0)).toBe(12000);
    expect(ssPay({ ...base, adults: 2 }, age62, 0)).toBe(12000);
    expect(ssPay({ ...base, adults: 2 }, age64, 0)).toBe(21600);
  });
});

describe("ACA health cost", () => {
  it("follows the 2026 applicable percentage table", () => {
    expect(acaPercent(1)).toBeCloseTo(0.021, 6);
    expect(acaPercent(1.75)).toBeCloseTo(0.0419 + 0.5 * (0.066 - 0.0419), 6);
    expect(acaPercent(3.5)).toBeCloseTo(0.0996, 6);
    expect(acaPercent(4.01)).toBeNull();
  });

  it("uses Medicaid at low income in an expansion state", () => {
    const p = { ...DEFAULT_PARAMS, state: "OK" as const };
    expect(acaFor(15000, p)).toMatchObject({ kind: "medicaid", cost: 0 });
    expect(acaFor(15000, { ...p, useMedicaid: false })).toMatchObject({ kind: "full", cost: p.acaUnsub });
  });

  it("charges full price in the coverage gap of a non-expansion state", () => {
    const p = { ...DEFAULT_PARAMS, state: "TN" as const };
    expect(acaFor(10000, p)).toMatchObject({ kind: "gap", cost: p.acaUnsub });
    expect(acaFor(20000, p).kind).toBe("subsidized");
    expect(acaFor(20000, p).cost).toBeCloseTo(20000 * 0.021, 6);
  });

  it("has no subsidy above 400% of the poverty line", () => {
    expect(acaFor(70000, DEFAULT_PARAMS)).toMatchObject({ kind: "full", cost: DEFAULT_PARAMS.acaUnsub });
  });
});

describe("401(k) deferral limits, 2026", () => {
  it("has the base, catch-up and age 60–63 limits", () => {
    expect(deferralLimit(45)).toBe(24500);
    expect(deferralLimit(55)).toBe(32500);
    expect(deferralLimit(61)).toBe(35750);
    expect(deferralLimit(64)).toBe(32500);
  });
});

describe("simulation", () => {
  const rich = { k401: 1500000, strategy: "asNeeded" as const };

  it("taxes the lump withdrawal with that year's Social Security", () => {
    const { p } = inputs();
    const tax = lumpSumTax(p);
    expect(tax.total).toBeGreaterThan(0);
    expect(tax.ok).toBe(0); // withdrawn while a Texas resident by default
  });

  it("is deterministic", () => {
    expect(run(rich).balances).toEqual(run(rich).balances);
  });

  it("taxes interest on cash", () => {
    // Past 65 with no Social Security, living costs don't depend on income, so the only
    // difference between these two plans in year two is the tax on year one's interest.
    const base = { strategy: "lump" as const, k401: 2000000, ageNow: 65, retireAge: 66, ssMonthly: 0, ssPia: undefined };
    const none = run({ ...base, cashReturn: 0 });
    const some = run({ ...base, cashReturn: 5 });
    const spend = none.balances[0] - none.balances[1];
    const untaxed = (some.balances[0] - spend) * 1.05;
    expect(some.balances[1]).toBeLessThan(untaxed - 5000);
  });

  it("does worse with a rough start in the market", () => {
    const normal = run(rich);
    const rough = run(rich, badStartReturns({ ...DEFAULT_PARAMS, ...rich }));
    expect(rough.balances[10]).toBeLessThan(normal.balances[10]);
  });

  it("records Medicaid years when income is low in an expansion state", () => {
    const sim = run({ strategy: "lump", k401: 600000, state: "OK", retireAge: 59, ageNow: 58 });
    // After the withdrawal year, income is only interest until Social Security at 62.
    expect(sim.health[1].kind).toBe("medicaid");
    expect(sim.health[0].kind).toBe("full");
  });

  it("records the coverage gap in a non-expansion state", () => {
    const sim = run({ strategy: "lump", k401: 600000, state: "TN", retireAge: 59, ageNow: 58 });
    expect(sim.health[1].kind).toBe("gap");
  });
});

describe("market odds", () => {
  it("is repeatable for the same seed", () => {
    const { p, rec, upfront, land } = inputs({ k401: 900000, strategy: "asNeeded" });
    const a = marketOdds(p, rec, upfront, p.inflation, land, goalOf(p), 60);
    const b = marketOdds(p, rec, upfront, p.inflation, land, goalOf(p), 60);
    expect(a).toEqual(b);
    expect(a.chance).toBeGreaterThanOrEqual(0);
    expect(a.chance).toBeLessThanOrEqual(1);
  });

  it("matches the steady plan when there is no swing", () => {
    const { p, rec, upfront, land } = inputs({ k401: 900000, strategy: "asNeeded", vol: 0 });
    const odds = marketOdds(p, rec, upfront, p.inflation, land, goalOf(p));
    const steady = simulate(p, rec, upfront, p.inflation, null, land);
    expect(odds.chance).toBe(covers(steady, goalOf(p)) ? 1 : 0);
  });

  it("treats a lump plan as cash", () => {
    const { p, rec, upfront, land } = inputs({ strategy: "lump" });
    expect(marketOdds(p, rec, upfront, p.inflation, land, goalOf(p)).cashOnly).toBe(true);
  });
});
