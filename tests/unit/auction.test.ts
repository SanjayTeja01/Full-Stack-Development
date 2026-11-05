import { describe, expect, it } from "vitest";
import {
  auctionPhase,
  checkCancellation,
  determineOutcome,
  minimumNextBid,
  validateAuctionConfig,
  validateBid,
  MINUTE,
  type BidValidationInput,
} from "@shared/auction";

const now = 1_800_000_000_000;
const auction = {
  status: "live" as const,
  startsAtMs: now - 10 * MINUTE,
  endsAtMs: now + 10 * MINUTE,
  startingPrice: 200000,
  minimumIncrement: 5000,
  currentHighestBid: 215000,
  bidVisibility: "public_anonymous" as const,
  farmerId: "farmer1",
};
const bid = (overrides: Partial<BidValidationInput> = {}): BidValidationInput => ({
  auction,
  amountPerUnit: 220000,
  nowMs: now,
  buyerId: "buyer1",
  buyerRole: "buyer",
  buyerAccountStatus: "active",
  currentLeaderId: "buyer2",
  ownHighestBid: null,
  ...overrides,
});

describe("auction phases use trusted time", () => {
  it("derives phase from timestamps even if stored status lags", () => {
    expect(auctionPhase({ ...auction, status: "scheduled" }, now)).toBe("live");
    expect(auctionPhase({ ...auction, status: "live" }, now + 11 * MINUTE)).toBe("closing");
    expect(auctionPhase({ ...auction, status: "scheduled", startsAtMs: now + 30 * MINUTE }, now)).toBe("starting_soon");
    expect(auctionPhase({ ...auction, status: "scheduled", startsAtMs: now + 3 * 60 * MINUTE }, now)).toBe("upcoming");
    expect(auctionPhase({ ...auction, status: "cancelled" }, now)).toBe("cancelled");
  });
});

describe("bid validation", () => {
  it("applies the minimum increment rule (₹2,150 + ₹50 => ₹2,200)", () => {
    expect(minimumNextBid(auction)).toBe(220000);
    expect(validateBid(bid({ amountPerUnit: 219999 })).ok).toBe(false);
    expect(validateBid(bid({ amountPerUnit: 220000 })).ok).toBe(true);
  });
  it("validates against the starting price when there are no bids", () => {
    const fresh = { ...auction, currentHighestBid: null };
    expect(minimumNextBid(fresh)).toBe(200000);
    expect(validateBid(bid({ auction: fresh, amountPerUnit: 199900, currentLeaderId: null })).ok).toBe(false);
    expect(validateBid(bid({ auction: fresh, amountPerUnit: 200000, currentLeaderId: null })).ok).toBe(true);
  });
  it("rejects bids before the start and after the end", () => {
    expect(validateBid(bid({ nowMs: auction.startsAtMs - 1 }))).toMatchObject({ ok: false, message: /not started/ });
    expect(validateBid(bid({ nowMs: auction.endsAtMs }))).toMatchObject({ ok: false, message: /ended/ });
  });
  it("rejects ineligible bidders", () => {
    expect(validateBid(bid({ buyerRole: "farmer" })).ok).toBe(false);
    expect(validateBid(bid({ buyerAccountStatus: "suspended" })).ok).toBe(false);
    expect(validateBid(bid({ buyerId: "farmer1", currentLeaderId: null })).ok).toBe(false);
    expect(validateBid(bid({ currentLeaderId: "buyer1" })).ok).toBe(false);
  });
  it("rejects absurd bids", () => {
    expect(validateBid(bid({ amountPerUnit: 200000 * 11 })).ok).toBe(false);
    expect(validateBid(bid({ amountPerUnit: 220000.5 })).ok).toBe(false);
  });
  it("uses the buyer's own bid as the floor in sealed auctions", () => {
    const sealed = { ...auction, bidVisibility: "sealed" as const };
    expect(minimumNextBid(sealed, null)).toBe(200000);
    expect(minimumNextBid(sealed, 210000)).toBe(215000);
  });
});

describe("auction configuration", () => {
  const cfg = {
    quantity: 50,
    availableQuantity: 100,
    startingPrice: 200000,
    minimumIncrement: 5000,
    reservePrice: null,
    startsAtMs: now + 60 * MINUTE,
    endsAtMs: now + 180 * MINUTE,
    nowMs: now,
  };
  it("accepts a valid configuration", () => expect(validateAuctionConfig(cfg).ok).toBe(true));
  it("rejects quantity above available stock", () => expect(validateAuctionConfig({ ...cfg, quantity: 101 }).ok).toBe(false));
  it("rejects a reserve below the starting price", () => expect(validateAuctionConfig({ ...cfg, reservePrice: 100 }).ok).toBe(false));
  it("rejects too-short auctions", () =>
    expect(validateAuctionConfig({ ...cfg, endsAtMs: cfg.startsAtMs + 5 * MINUTE }).ok).toBe(false));
  it("rejects start times in the past", () =>
    expect(validateAuctionConfig({ ...cfg, startsAtMs: now - 60 * MINUTE }).ok).toBe(false));
});

describe("outcomes and cancellation", () => {
  it("determines winner, no bids and reserve not met", () => {
    expect(determineOutcome({ bidCount: 0, currentHighestBid: null, reservePrice: null })).toBe("no_bids");
    expect(determineOutcome({ bidCount: 3, currentHighestBid: 210000, reservePrice: 220000 })).toBe("reserve_not_met");
    expect(determineOutcome({ bidCount: 3, currentHighestBid: 220000, reservePrice: 220000 })).toBe("winner");
  });
  it("only lets admins cancel once bidding has begun", () => {
    expect(checkCancellation({ status: "live", bidCount: 0 }, false).ok).toBe(true);
    expect(checkCancellation({ status: "live", bidCount: 2 }, false).ok).toBe(false);
    expect(checkCancellation({ status: "live", bidCount: 2 }, true).ok).toBe(true);
    expect(checkCancellation({ status: "ended", bidCount: 0 }, true).ok).toBe(false);
  });
});
