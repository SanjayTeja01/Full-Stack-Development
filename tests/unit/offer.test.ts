import { describe, expect, it } from "vitest";
import { checkOfferAction, isExpired } from "@shared/offer";
import { checkAgreementAction } from "@shared/agreement";

const pending = { status: "pending" as const, proposedBy: "buyer", respondentId: "farmer", expiresAtMs: 1000 };

describe("offer actions", () => {
  it("lets only the respondent accept, reject or counter", () => {
    expect(checkOfferAction(pending, "farmer", "accept", 0).ok).toBe(true);
    expect(checkOfferAction(pending, "buyer", "accept", 0).ok).toBe(false);
    expect(checkOfferAction(pending, "stranger", "counter", 0).ok).toBe(false);
  });
  it("lets only the proposer withdraw", () => {
    expect(checkOfferAction(pending, "buyer", "withdraw", 0).ok).toBe(true);
    expect(checkOfferAction(pending, "farmer", "withdraw", 0).ok).toBe(false);
  });
  it("blocks resolved and expired offers", () => {
    expect(isExpired(pending, 1000)).toBe(true);
    expect(checkOfferAction(pending, "farmer", "accept", 1000)).toMatchObject({ ok: false, message: /expired/ });
    for (const status of ["accepted", "rejected", "withdrawn", "expired", "countered"] as const) {
      expect(checkOfferAction({ ...pending, status }, "farmer", "accept", 0).ok).toBe(false);
    }
  });
});

describe("agreement actions", () => {
  it("closes terminal agreements and reserves disputes for admins", () => {
    expect(checkAgreementAction("completed", "in_progress", false).ok).toBe(false);
    expect(checkAgreementAction("disputed", "confirm_completion", false).ok).toBe(false);
    expect(checkAgreementAction("disputed", "confirm_completion", true).ok).toBe(true);
    expect(checkAgreementAction("agreement_recorded", "contact_initiated", false).ok).toBe(true);
  });
});
