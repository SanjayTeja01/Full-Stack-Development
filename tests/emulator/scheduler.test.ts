/**
 * Scenario F: an auction ends while nobody is online. The scheduled job (the same code the deployed
 * `auctionScheduler` runs every minute) finalises it without any client involvement.
 */
import { describe, expect, it } from "vitest";
import { Timestamp } from "firebase-admin/firestore";
import { deleteApp } from "firebase/app";
import { processDueAuctions } from "../../server/auctions";
import { expireDueOffers } from "../../server/offers";
import { adminDb, createListing, createUser, stockOf } from "./helpers";

describe("scheduled jobs (emulator)", () => {
  it("Scenario F: finalises an ended auction with no clients online, and is safe to run again", async () => {
    const [farmer, buyer] = await Promise.all([createUser("farmer"), createUser("buyer")]);
    const productId = await createListing(farmer, 60);
    const now = Date.now();
    const { auctionId } = await farmer.call<{ auctionId: string }>("createAuction", {
      productId,
      quantity: 25,
      startingPrice: 215_000,
      minimumIncrement: 5_000,
      reservePrice: null,
      startsAtMs: now,
      endsAtMs: now + 30 * 60_000,
      description: "",
      conditions: "",
      bidVisibility: "public_anonymous",
      publish: true,
    });
    await buyer.call("placeBid", { auctionId, amountPerUnit: 230_000, idempotencyKey: crypto.randomUUID() });
    // Everyone goes offline; time passes the end.
    await deleteApp(buyer.app);
    await adminDb.collection("auctions").doc(auctionId).update({ endsAt: Timestamp.fromMillis(Date.now() - 1000) });

    const first = await processDueAuctions();
    expect(first.finalized).toBeGreaterThanOrEqual(1);
    const a = (await adminDb.collection("auctions").doc(auctionId).get()).data()!;
    expect(a).toMatchObject({ status: "ended", resultStatus: "winner", winningBid: 230_000 });
    expect(await stockOf(productId)).toMatchObject({ available: 35, reserved: 0, committed: 25 });
    const won = await adminDb.collection("notifications").where("recipientId", "==", buyer.uid).where("type", "==", "auction_won").get();
    expect(won.size).toBe(1);

    const auditBefore = (await adminDb.collection("auditLogs").where("targetId", "==", auctionId).where("action", "==", "auction.finalized").get()).size;
    await processDueAuctions();
    const auditAfter = (await adminDb.collection("auditLogs").where("targetId", "==", auctionId).where("action", "==", "auction.finalized").get()).size;
    expect(auditAfter).toBe(auditBefore);
    expect(await stockOf(productId)).toMatchObject({ committed: 25 });
  });

  it("starts scheduled auctions when their start time passes", async () => {
    const farmer = await createUser("farmer");
    const productId = await createListing(farmer, 20);
    const start = Date.now() + 10 * 60_000;
    const { auctionId, status } = await farmer.call<{ auctionId: string; status: string }>("createAuction", {
      productId,
      quantity: 5,
      startingPrice: 100_000,
      minimumIncrement: 1_000,
      reservePrice: null,
      startsAtMs: start,
      endsAtMs: start + 30 * 60_000,
      description: "",
      conditions: "",
      bidVisibility: "public_anonymous",
      publish: true,
    });
    expect(status).toBe("scheduled");
    await adminDb.collection("auctions").doc(auctionId).update({ startsAt: Timestamp.fromMillis(Date.now() - 1000) });
    await processDueAuctions();
    expect((await adminDb.collection("auctions").doc(auctionId).get()).get("status")).toBe("live");
  });

  it("expires pending offers past their expiry", async () => {
    const [farmer, buyer] = await Promise.all([createUser("farmer"), createUser("buyer")]);
    const productId = await createListing(farmer, 20);
    const { conversationId } = await buyer.call<{ conversationId: string }>("startConversation", { farmerId: farmer.uid, productId });
    const { offerId } = await buyer.call<{ offerId: string }>("createOffer", { conversationId, productId, quantity: 5, pricePerUnit: 100_000, expiresInHours: 6 });
    await adminDb.collection("offers").doc(offerId).update({ expiresAt: Timestamp.fromMillis(Date.now() - 1000) });
    await expireDueOffers();
    expect((await adminDb.collection("offers").doc(offerId).get()).get("status")).toBe("expired");
  });
});
