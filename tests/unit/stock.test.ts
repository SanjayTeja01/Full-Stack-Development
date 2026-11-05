import { describe, expect, it } from "vitest";
import {
  commitFromAvailable,
  commitFromReservation,
  fulfilCommitment,
  releaseCommitment,
  releaseReservation,
  reserveForAuction,
  setAvailable,
  type StockLevels,
} from "@shared/stock";
import { DomainError } from "@shared/errors";

const base: StockLevels = { availableQuantity: 100, reservedQuantity: 0, committedQuantity: 0, soldQuantity: 0 };

describe("stock transitions", () => {
  it("moves stock between buckets without losing quantity", () => {
    let s = reserveForAuction(base, 40);
    expect(s).toEqual({ availableQuantity: 60, reservedQuantity: 40, committedQuantity: 0, soldQuantity: 0 });
    s = commitFromReservation(s, 40);
    expect(s.committedQuantity).toBe(40);
    s = commitFromAvailable(s, 10);
    expect(s.availableQuantity).toBe(50);
    s = fulfilCommitment(s, 40);
    expect(s.soldQuantity).toBe(40);
    s = releaseCommitment(s, 10);
    expect(s).toEqual({ availableQuantity: 60, reservedQuantity: 0, committedQuantity: 0, soldQuantity: 40 });
  });

  it("refuses to reserve or commit more than is available", () => {
    expect(() => reserveForAuction(base, 101)).toThrow(DomainError);
    const reserved = reserveForAuction(base, 80);
    // Scenario E: stock held by an auction cannot also be accepted in a private offer.
    expect(() => commitFromAvailable(reserved, 30)).toThrow(/Only 20/);
  });

  it("refuses invalid quantities and negative buckets", () => {
    expect(() => reserveForAuction(base, 0)).toThrow();
    expect(() => reserveForAuction(base, 1.5)).toThrow();
    expect(() => releaseReservation(base, 1)).toThrow();
    expect(() => setAvailable(base, -1)).toThrow();
    expect(setAvailable(reserveForAuction(base, 10), 5)).toMatchObject({ availableQuantity: 5, reservedQuantity: 10 });
  });
});
