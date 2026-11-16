import { describe, expect, it } from "vitest";
import { LANDCOM_HOMES, LANDWATCH_HOMES, landComUrl, landwatchUrl } from "./landLinks";

const q = { stateName: "Oklahoma", stateCode: "OK", county: "Pushmataha", acresMin: 40, acresMax: 125, priceMax: 200000 };

describe("LandWatch links", () => {
  it("puts the property type after the county", () => {
    expect(landwatchUrl(q, "hunting-property")).toBe(
      "https://www.landwatch.com/oklahoma-land-for-sale/pushmataha-county/hunting-property/price-under-200000/acres-40-125",
    );
  });
  it("leaves the type out for all land", () => {
    expect(landwatchUrl(q, null)).toBe("https://www.landwatch.com/oklahoma-land-for-sale/pushmataha-county/price-under-200000/acres-40-125");
  });
  it("uses the homes type for a house", () => {
    expect(landwatchUrl(q, LANDWATCH_HOMES)).toContain("/pushmataha-county/homes/");
  });
  it("handles open-ended acres, no price and the whole state", () => {
    expect(landwatchUrl({ ...q, acresMax: 0, priceMax: 0 }, null)).toBe("https://www.landwatch.com/oklahoma-land-for-sale/pushmataha-county/acres-over-40");
    expect(landwatchUrl({ ...q, acresMin: 0 }, null)).toMatch(/acres-under-125$/);
    expect(landwatchUrl({ ...q, county: null, stateName: "West Virginia" }, null)).toMatch(/^https:\/\/www\.landwatch\.com\/west-virginia-land-for-sale\/price/);
    expect(landwatchUrl({ ...q, county: "Le Flore" }, null)).toContain("/le-flore-county/");
  });
});

describe("Land.com links", () => {
  it("uses Land.com's place, type, price, acres order", () => {
    expect(landComUrl(q, "hunting-land")).toBe("https://www.land.com/Pushmataha-County-OK/hunting-land/under-200000/40-125-acres/");
  });
  it("uses residential-property for a house", () => {
    expect(landComUrl(q, LANDCOM_HOMES)).toContain("/residential-property/");
  });
  it("handles open-ended acres, no price and the whole state", () => {
    expect(landComUrl({ ...q, acresMax: 0, priceMax: 0 }, "all-land")).toBe("https://www.land.com/Pushmataha-County-OK/all-land/over-40-acres/");
    expect(landComUrl({ ...q, county: null, stateName: "West Virginia" }, "all-land")).toBe(
      "https://www.land.com/West-Virginia/all-land/under-200000/40-125-acres/",
    );
    expect(landComUrl({ ...q, county: "Le Flore" }, "all-land")).toContain("/Le-Flore-County-OK/");
  });
});
