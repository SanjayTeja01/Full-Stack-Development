import type { AuctionResultStatus, AuctionStatus, BidVisibility } from "./types";
import { fail, OK, type RuleResult } from "./errors";

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

export const AUCTION_LIMITS = {
  defaultMinDurationMs: 15 * MINUTE,
  maxDurationMs: 14 * DAY,
  maxScheduleAheadMs: 60 * DAY,
  /** A start time this far in the past is treated as "start now" (form submit latency). */
  startGraceMs: 5 * MINUTE,
  startingSoonWindowMs: HOUR,
  /** A single bid may not exceed this multiple of the starting price, to catch typing mistakes. */
  maxBidMultiplier: 10,
  minIncrementPaise: 100,
} as const;

export type AuctionPhase = "draft" | "upcoming" | "starting_soon" | "live" | "closing" | "ended" | "cancelled";

export interface AuctionTimingInput {
  status: AuctionStatus;
  startsAtMs: number;
  endsAtMs: number;
}

/**
 * The phase an auction is in at a trusted time. The stored status can lag behind the clock
 * until the scheduler runs, so callers must use this rather than the stored status alone.
 * "closing" means the end time has passed but the result has not been recorded yet.
 */
export function auctionPhase(a: AuctionTimingInput, nowMs: number): AuctionPhase {
  if (a.status === "draft") return "draft";
  if (a.status === "cancelled") return "cancelled";
  if (a.status === "ended") return "ended";
  if (nowMs >= a.endsAtMs) return "closing";
  if (nowMs >= a.startsAtMs) return "live";
  if (a.startsAtMs - nowMs <= AUCTION_LIMITS.startingSoonWindowMs) return "starting_soon";
  return "upcoming";
}

export function isAcceptingBids(a: AuctionTimingInput, nowMs: number): boolean {
  return auctionPhase(a, nowMs) === "live";
}

export interface BidStateInput extends AuctionTimingInput {
  startingPrice: number;
  minimumIncrement: number;
  currentHighestBid: number | null;
  bidVisibility: BidVisibility;
}

/** Minimum valid bid per unit. For sealed auctions it depends on the buyer's own previous bid. */
export function minimumNextBid(a: BidStateInput, ownHighestBid: number | null = null): number {
  if (a.bidVisibility === "sealed") {
    return ownHighestBid === null ? a.startingPrice : ownHighestBid + a.minimumIncrement;
  }
  return a.currentHighestBid === null ? a.startingPrice : a.currentHighestBid + a.minimumIncrement;
}

export interface BidValidationInput {
  auction: BidStateInput & { farmerId: string };
  amountPerUnit: number;
  nowMs: number;
  buyerId: string;
  buyerRole: string | undefined;
  buyerAccountStatus: string | undefined;
  currentLeaderId: string | null;
  ownHighestBid: number | null;
}

export function validateBid(input: BidValidationInput): RuleResult {
  const { auction, amountPerUnit, nowMs, buyerId } = input;
  if (input.buyerRole !== "buyer") return fail("permission-denied", "Only buyer accounts can bid.");
  if (input.buyerAccountStatus !== "active") return fail("permission-denied", "Your account is restricted and cannot bid.");
  if (auction.farmerId === buyerId) return fail("permission-denied", "You cannot bid on your own auction.");

  const phase = auctionPhase(auction, nowMs);
  if (phase === "cancelled") return fail("failed-precondition", "This auction was cancelled.");
  if (phase === "upcoming" || phase === "starting_soon" || phase === "draft") {
    return fail("failed-precondition", "This auction has not started yet.");
  }
  if (phase === "closing" || phase === "ended") return fail("failed-precondition", "This auction has ended.");

  if (!Number.isSafeInteger(amountPerUnit) || amountPerUnit <= 0) {
    return fail("invalid-argument", "Bid must be a positive amount.");
  }
  if (auction.bidVisibility === "public_anonymous" && input.currentLeaderId === buyerId) {
    return fail("failed-precondition", "You already hold the highest bid.");
  }
  const min = minimumNextBid(auction, input.ownHighestBid);
  if (amountPerUnit < min) {
    return fail("failed-precondition", "Bid is below the minimum next bid.", { minimumNextBid: min });
  }
  if (amountPerUnit > auction.startingPrice * AUCTION_LIMITS.maxBidMultiplier) {
    return fail("invalid-argument", `Bids above ${AUCTION_LIMITS.maxBidMultiplier}x the starting price are not accepted.`);
  }
  return OK;
}

export interface AuctionConfigInput {
  quantity: number;
  availableQuantity: number;
  startingPrice: number;
  minimumIncrement: number;
  reservePrice: number | null;
  startsAtMs: number;
  endsAtMs: number;
  nowMs: number;
  minDurationMs?: number;
}

export function validateAuctionConfig(c: AuctionConfigInput): RuleResult {
  const minDuration = c.minDurationMs ?? AUCTION_LIMITS.defaultMinDurationMs;
  if (!Number.isSafeInteger(c.quantity) || c.quantity <= 0) return fail("invalid-argument", "Quantity must be a positive whole number.");
  if (c.quantity > c.availableQuantity) {
    return fail("failed-precondition", `Only ${c.availableQuantity} is available to auction.`, { available: c.availableQuantity });
  }
  if (c.startingPrice <= 0) return fail("invalid-argument", "Starting price must be greater than zero.");
  if (c.minimumIncrement < AUCTION_LIMITS.minIncrementPaise) return fail("invalid-argument", "Minimum increment must be at least ₹1.");
  if (c.minimumIncrement > c.startingPrice) return fail("invalid-argument", "Minimum increment cannot exceed the starting price.");
  if (c.reservePrice !== null && c.reservePrice < c.startingPrice) {
    return fail("invalid-argument", "Reserve price cannot be below the starting price.");
  }
  if (c.startsAtMs < c.nowMs - AUCTION_LIMITS.startGraceMs) return fail("invalid-argument", "Start time is in the past.");
  if (c.startsAtMs > c.nowMs + AUCTION_LIMITS.maxScheduleAheadMs) return fail("invalid-argument", "Auctions can be scheduled at most 60 days ahead.");
  const effectiveStart = Math.max(c.startsAtMs, c.nowMs);
  const duration = c.endsAtMs - effectiveStart;
  if (duration < minDuration) {
    return fail("invalid-argument", `Auctions must run for at least ${Math.round(minDuration / MINUTE)} minutes.`);
  }
  if (duration > AUCTION_LIMITS.maxDurationMs) return fail("invalid-argument", "Auctions can run for at most 14 days.");
  return OK;
}

export function determineOutcome(input: {
  bidCount: number;
  currentHighestBid: number | null;
  reservePrice: number | null;
}): Exclude<AuctionResultStatus, "pending" | "cancelled"> {
  if (input.bidCount === 0 || input.currentHighestBid === null) return "no_bids";
  if (input.reservePrice !== null && input.currentHighestBid < input.reservePrice) return "reserve_not_met";
  return "winner";
}

/** Published cancellation policy. */
export function checkCancellation(a: { status: AuctionStatus; bidCount: number }, actorIsAdmin: boolean): RuleResult {
  if (a.status === "ended") return fail("failed-precondition", "This auction has already ended.");
  if (a.status === "cancelled") return fail("failed-precondition", "This auction is already cancelled.");
  if (a.bidCount > 0 && !actorIsAdmin) {
    return fail("failed-precondition", "Auctions with bids can only be cancelled by an administrator through a recorded review.");
  }
  return OK;
}

export function bidderLabel(index: number): string {
  return `Bidder ${index}`;
}
