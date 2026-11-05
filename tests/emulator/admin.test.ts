import { describe, expect, it, beforeAll } from "vitest";
import { adminDb, codeOf, createListing, createUser, stockOf, type TestUser } from "./helpers";

const MIN = 60_000;

async function createAuction(farmer: TestUser, productId: string, quantity = 10) {
  const now = Date.now();
  const { auctionId } = await farmer.call<{ auctionId: string }>("createAuction", {
    productId,
    quantity,
    startingPrice: 100_000,
    minimumIncrement: 1_000,
    reservePrice: null,
    startsAtMs: now,
    endsAtMs: now + 30 * MIN,
    description: "",
    conditions: "",
    bidVisibility: "public_anonymous",
    publish: true,
  });
  return auctionId;
}

async function offerAndAccept(farmer: TestUser, buyer: TestUser, productId: string, quantity: number) {
  const { conversationId } = await buyer.call<{ conversationId: string }>("startConversation", { farmerId: farmer.uid, productId });
  const { offerId } = await buyer.call<{ offerId: string }>("createOffer", { conversationId, productId, quantity, pricePerUnit: 190_000, expiresInHours: 48 });
  return { conversationId, offerId };
}

describe("administration (emulator)", () => {
  let admin: TestUser, farmer: TestUser, buyer: TestUser, buyer2: TestUser;
  beforeAll(async () => {
    [admin, farmer, buyer, buyer2] = await Promise.all([createUser("admin"), createUser("farmer"), createUser("buyer"), createUser("buyer")]);
  });

  it("non-admins cannot call admin operations", async () => {
    expect(await codeOf(farmer.call("adminSetAccountStatus", { userId: buyer.uid, status: "suspended", reason: "Testing access" }))).toBe("permission-denied");
    expect(await codeOf(buyer.call("adminUpsertCategory", { id: "x-test", name: "X test", description: "", examples: [], sortOrder: 1, active: true }))).toBe("permission-denied");
  });

  it("suspending a farmer pauses listings, cancels auctions without bids and keeps auctions with bids", async () => {
    const f = await createUser("farmer");
    const p1 = await createListing(f, 100);
    const quiet = await createAuction(f, p1, 10);
    const busy = await createAuction(f, p1, 10);
    await buyer.call("placeBid", { auctionId: busy, amountPerUnit: 100_000, idempotencyKey: crypto.randomUUID() });
    expect(await stockOf(p1)).toMatchObject({ available: 80, reserved: 20 });

    const res = await admin.call<{ pausedListings: number; cancelledAuctions: number; auctionsWithBids: string[] }>("adminSetAccountStatus", {
      userId: f.uid,
      status: "suspended",
      reason: "Repeated non-fulfilment reports",
    });
    expect(res).toMatchObject({ pausedListings: 1, cancelledAuctions: 1, auctionsWithBids: [busy] });
    expect((await adminDb.collection("products").doc(p1).get()).get("listingStatus")).toBe("paused");
    expect((await adminDb.collection("auctions").doc(quiet).get()).get("status")).toBe("cancelled");
    expect((await adminDb.collection("auctions").doc(busy).get()).get("status")).toBe("live");
    expect(await stockOf(p1)).toMatchObject({ available: 90, reserved: 10 });

    // A suspended farmer cannot act.
    expect(await codeOf(f.call("setProductStatus", { productId: p1, status: "active" }))).toBe("permission-denied");
    const audit = await adminDb.collection("auditLogs").where("targetId", "==", f.uid).where("action", "==", "user.suspended").get();
    expect(audit.size).toBe(1);
    expect(audit.docs[0].get("reason")).toBe("Repeated non-fulfilment reports");

    // Admin can cancel the auction that has bids, with a reason.
    await admin.call("adminCancelAuction", { auctionId: busy, reason: "Seller suspended" });
    expect(await stockOf(p1)).toMatchObject({ available: 100, reserved: 0 });

    await admin.call("adminSetAccountStatus", { userId: f.uid, status: "active", reason: "Issue resolved with seller" });
    await f.call("setProductStatus", { productId: p1, status: "active" });
  });

  it("a suspended buyer cannot bid or make offers", async () => {
    const b = await createUser("buyer");
    const productId = await createListing(farmer, 50);
    const auctionId = await createAuction(farmer, productId, 5);
    const { conversationId } = await b.call<{ conversationId: string }>("startConversation", { farmerId: farmer.uid, productId });
    await admin.call("adminSetAccountStatus", { userId: b.uid, status: "suspended", reason: "Bid manipulation" });
    expect(await codeOf(b.call("placeBid", { auctionId, amountPerUnit: 100_000, idempotencyKey: crypto.randomUUID() }))).toBe("permission-denied");
    expect(await codeOf(b.call("createOffer", { conversationId, productId, quantity: 1, pricePerUnit: 100_000, expiresInHours: 48 }))).toBe("permission-denied");
  });

  it("removing a listing cancels its pending offers; restoring brings it back paused", async () => {
    const productId = await createListing(farmer, 50);
    const { offerId } = await offerAndAccept(farmer, buyer2, productId, 5);
    await admin.call("adminModerateProduct", { productId, action: "remove", reason: "Prohibited item" });
    let p = (await adminDb.collection("products").doc(productId).get()).data()!;
    expect(p).toMatchObject({ listingStatus: "removed", moderationStatus: "removed_by_admin" });
    expect((await adminDb.collection("offers").doc(offerId).get()).get("status")).toBe("cancelled");
    expect(await codeOf(farmer.call("setProductStatus", { productId, status: "active" }))).not.toBe("ok");
    await admin.call("adminModerateProduct", { productId, action: "restore", reason: "Appeal accepted" });
    p = (await adminDb.collection("products").doc(productId).get()).data()!;
    expect(p).toMatchObject({ listingStatus: "paused", moderationStatus: "ok" });
  });

  it("verification approval updates the profile and listings", async () => {
    const f = await createUser("farmer");
    const productId = await createListing(f, 10);
    await f.call("requestVerification", { note: "Pattadar passbook number 12345, Warangal" });
    await admin.call("adminReviewVerification", { userId: f.uid, decision: "verified", note: "" });
    expect((await adminDb.collection("users").doc(f.uid).get()).get("verificationStatus")).toBe("verified");
    expect((await adminDb.collection("products").doc(productId).get()).get("farmerVerified")).toBe(true);
    expect(await codeOf(admin.call("adminReviewVerification", { userId: f.uid, decision: "rejected", note: "again" }))).toBe("failed-precondition");
  });

  it("resolving a disputed agreement as not completed returns committed stock", async () => {
    const productId = await createListing(farmer, 40);
    const { offerId } = await offerAndAccept(farmer, buyer, productId, 15);
    const { agreementId } = await farmer.call<{ agreementId: string }>("respondToOffer", { offerId, action: "accept" });
    expect(await stockOf(productId)).toMatchObject({ available: 25, committed: 15 });
    await buyer.call("updateAgreementStatus", { agreementId, action: "disputed", note: "Quality differs from listing" });
    await admin.call("adminResolveAgreement", { agreementId, status: "not_completed", reason: "Both parties agreed to cancel" });
    expect(await stockOf(productId)).toMatchObject({ available: 40, committed: 0 });
    expect((await adminDb.collection("agreements").doc(agreementId).get()).get("status")).toBe("not_completed");
    expect(await codeOf(admin.call("adminResolveAgreement", { agreementId, status: "completed", reason: "Second attempt" }))).toBe("failed-precondition");
  });
});
