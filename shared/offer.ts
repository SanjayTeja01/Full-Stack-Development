import type { OfferStatus } from "./types";
import { fail, OK, type RuleResult } from "./errors";
import { HOUR } from "./auction";

export const OFFER_EXPIRY_OPTIONS_HOURS = [6, 24, 48, 72, 168] as const;
export const DEFAULT_OFFER_EXPIRY_HOURS = 48;
export const MAX_COUNTER_ROUNDS = 20;

export type OfferAction = "accept" | "reject" | "counter" | "withdraw";

export interface OfferStateInput {
  status: OfferStatus;
  proposedBy: string;
  respondentId: string;
  expiresAtMs: number | null;
}

export function isExpired(o: OfferStateInput, nowMs: number): boolean {
  return o.status === "pending" && o.expiresAtMs !== null && nowMs >= o.expiresAtMs;
}

const RESOLVED_MESSAGES: Partial<Record<OfferStatus, string>> = {
  countered: "This offer has already been countered.",
  accepted: "This offer has already been accepted.",
  rejected: "This offer has already been rejected.",
  withdrawn: "This offer was withdrawn.",
  expired: "This offer has expired.",
  cancelled: "This offer was cancelled.",
};

export function checkOfferAction(o: OfferStateInput, actorId: string, action: OfferAction, nowMs: number): RuleResult {
  if (o.status !== "pending") return fail("failed-precondition", RESOLVED_MESSAGES[o.status] ?? "This offer is closed.");
  if (isExpired(o, nowMs)) return fail("failed-precondition", "This offer has expired.");
  if (action === "withdraw") {
    return actorId === o.proposedBy ? OK : fail("permission-denied", "Only the person who made this offer can withdraw it.");
  }
  if (actorId !== o.respondentId) {
    return fail("permission-denied", actorId === o.proposedBy ? "You cannot respond to your own offer." : "You are not part of this negotiation.");
  }
  return OK;
}

export function expiryFromHours(nowMs: number, hours: number | null): number | null {
  return hours === null ? null : nowMs + hours * HOUR;
}

export const OFFER_STATUS_LABELS: Record<OfferStatus, string> = {
  pending: "Pending",
  countered: "Countered",
  accepted: "Accepted",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
  expired: "Expired",
  cancelled: "Cancelled",
};
