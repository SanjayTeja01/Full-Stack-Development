import { describe, expect, it } from "vitest";
import { formatINR, lineTotal, parseRupeesToPaise, paiseToRupeeString } from "@shared/money";
import { normalizedPricePerQuintal, formatQuantity } from "@shared/units";
import { buildSearchKeywords, searchToken } from "@shared/search";

describe("money", () => {
  it("parses rupee strings into exact paise", () => {
    expect(parseRupeesToPaise("2150")).toBe(215000);
    expect(parseRupeesToPaise("2,150.5")).toBe(215050);
    expect(parseRupeesToPaise("0.1")).toBe(10);
    expect(parseRupeesToPaise("₹ 19.99")).toBe(1999);
    expect(parseRupeesToPaise("1.005")).toBeNull();
    expect(parseRupeesToPaise("-5")).toBeNull();
    expect(parseRupeesToPaise("abc")).toBeNull();
  });
  it("round-trips paise to rupee strings", () => {
    expect(paiseToRupeeString(215050)).toBe("2150.50");
    expect(paiseToRupeeString(215000)).toBe("2150");
  });
  it("computes line totals in integers", () => {
    expect(lineTotal(215010, 3)).toBe(645030);
    expect(() => lineTotal(Number.MAX_SAFE_INTEGER, 2)).toThrow();
  });
  it("formats INR in Indian grouping", () => {
    expect(formatINR(21500000)).toBe("₹2,15,000");
  });
});

describe("units", () => {
  it("normalizes prices to per-quintal", () => {
    expect(normalizedPricePerQuintal(2500, "kg")).toBe(250000);
    expect(normalizedPricePerQuintal(215000, "quintal")).toBe(215000);
    expect(normalizedPricePerQuintal(2150000, "tonne")).toBe(215000);
  });
  it("formats quantities with units", () => {
    expect(formatQuantity(1, "quintal")).toBe("1 quintal");
    expect(formatQuantity(1500, "kg")).toBe("1,500 kg");
    expect(formatQuantity(20, "tonne")).toBe("20 tonnes");
  });
});

describe("search keywords", () => {
  it("indexes word prefixes", () => {
    const k = buildSearchKeywords("Red Chillies", "Guntur");
    expect(k).toContain("re");
    expect(k).toContain("red");
    expect(k).toContain("chil");
    expect(k).toContain("guntur");
    expect(searchToken("  Chillies dry")).toBe("chillies");
  });
});
