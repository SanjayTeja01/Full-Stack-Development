import { describe, expect, it, beforeAll } from "vitest";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb, codeOf, createListing, createUser, stockOf, type TestUser } from "./helpers";

const MIN = 60_000;

async function liveAuction(farmer: TestUser, productId: string, opts: { quantity?: number; reservePrice?: number | null; bidVisibility?: "public_anonymous" | "sealed" } = {}) {
  const now = Date.now();
  const res = await farmer.call<{ auctionId: string; status: string }>("createAuction", {
    productId,
    quantity: opts.quantity ?? 20,
    startingPrice: 215_000,
    minimumIncrement: 5_000,
    reservePrice: opts.reservePrice ?? null,
    startsAtMs: now,
    endsAtMs: now + 30 * MIN,
    description: "",
    conditions: "",
    bidVisibility: opts.bidVisibility ?? "public_anonymous",
    publish: true,
  });
  expect(res.status).toBe("live");
  return res.auctionId;
}

/** Moves the end time into the past so the auction can be finalised without waiting. */
async function endNow(auctionId: string) {
  await adminDb.collection("auctions").doc(auctionId).update({ endsAt: Timestamp.fromMillis(Date.now() - 1000) });
}

const bid = (u: TestUser, auctionId: string, amountPerUnit: number, idempotencyKey = crypto.randomUUID()) =>
  u.call<{ bidId: string; duplicate: boolean; bidderLabel: string }>("placeBid", { auctionId, amountPerUnit, idempotencyKey });

describe("auctions (emulator)", () => {
  let farmer: TestUser, b1: TestUser, b2: TestUser, b3: TestUser;
  beforeAll(async () => {
    [farmer, b1, b2, b3] = await Promise.all([createUser("farmer"), createUser("buyer"), createUser("buyer"), createUser("buyer")]);
  });

  it("reserves stock on publish and enforces the minimum increment (Scenario B)", async () => {
    const productId = await createListing(farmer, 100);
    const auctionId = await liveAuction(farmer, productId);
    expect(await stockOf(productId)).toMatchObject({ available: 80, reserved: 20 });

    expect(await codeOf(bid(b1, auctionId, 214_900))).toBe("failed-precondition");
    await bid(b1, auctionId, 215_000);
    expect(await codeOf(bid(b2, auctionId, 218_000))).toBe("failed-precondition");
    await bid(b2, auctionId, 220_000);
    // The leader cannot outbid themselves.
    expect(await codeOf(bid(b2, auctionId, 230_000))).toBe("failed-precondition");
    await bid(b1, auctionId, 225_000);

    const a = (await adminDb.collection("auctions").doc(auctionId).get()).data()!;
    expect(a).toMatchObject({ currentHighestBid: 225_000, bidCount: 3, bidderCount: 2, currentHighestBidderLabel: "Bidder 1" });
    // The public document never carries buyer ids.
    expect(JSON.stringify(a)).not.toContain(b1.uid);
  });

  it("farmers cannot bid and cannot cancel after the first bid", async () => {
    const productId = await createListing(farmer, 50);
    const auctionId = await liveAuction(farmer, productId);
    expect(await codeOf(farmer.call("placeBid", { auctionId, amountPerUnit: 215_000, idempotencyKey: crypto.randomUUID() }))).toBe("permission-denied");
    await bid(b1, auctionId, 215_000);
    expect(await codeOf(farmer.call("cancelAuction", { auctionId, reason: "Changed my mind" }))).toBe("failed-precondition");
  });

  it("a retried request with the same idempotency key records one bid", async () => {
    const productId = await createListing(farmer, 50);
    const auctionId = await liveAuction(farmer, productId);
    const key = crypto.randomUUID();
    const [r1, r2] = await Promise.all([bid(b1, auctionId, 215_000, key), bid(b1, auctionId, 215_000, key)].map((p) => p.catch((e) => e)));
    const ok = [r1, r2].filter((r) => !(r instanceof Error));
    expect(ok.length).toBeGreaterThanOrEqual(1);
    const again = await bid(b1, auctionId, 215_000, key);
    expect(again.duplicate).toBe(true);
    const bids = await adminDb.collection("bids").where("auctionId", "==", auctionId).get();
    expect(bids.size).toBe(1);
    expect((await adminDb.collection("auctions").doc(auctionId).get()).get("bidCount")).toBe(1);
  });

  it("concurrent bids at the same amount: exactly one is accepted (Scenario D)", async () => {
    const productId = await createListing(farmer, 50);
    const auctionId = await liveAuction(farmer, productId);
    const results = await Promise.all([b1, b2, b3].map((u) => codeOf(bid(u, auctionId, 215_000))));
    expect(results.filter((r) => r === "ok")).toHaveLength(1);
    expect(results.filter((r) => r === "failed-precondition")).toHaveLength(2);
    const a = (await adminDb.collection("auctions").doc(auctionId).get()).data()!;
    expect(a.bidCount).toBe(1);
    expect(a.currentHighestBid).toBe(215_000);
  });

  it("concurrent increasing bids leave a consistent highest bid", async () => {
    const productId = await createListing(farmer, 50);
    const auctionId = await liveAuction(farmer, productId);
    await Promise.all([codeOf(bid(b1, auctionId, 215_000)), codeOf(bid(b2, auctionId, 230_000)), codeOf(bid(b3, auctionId, 260_000))]);
    const a = (await adminDb.collection("auctions").doc(auctionId).get()).data()!;
    const state = (await adminDb.doc(`auctions/${auctionId}/private/state`).get()).data()!;
    const bids = (await adminDb.collection("bids").where("auctionId", "==", auctionId).get()).docs.map((d) => d.data());
    expect(a.bidCount).toBe(bids.length);
    expect(a.currentHighestBid).toBe(Math.max(...bids.map((b) => b.amountPerUnit)));
    expect(state.currentHighestAmount).toBe(a.currentHighestBid);
    // Accepted bids, in acceptance order, are strictly increasing by at least the increment.
    const ordered = bids.sort((x, y) => x.acceptedAt.toMillis() - y.acceptedAt.toMillis()).map((b) => b.amountPerUnit);
    for (let i = 1; i < ordered.length; i++) expect(ordered[i] - ordered[i - 1]).toBeGreaterThanOrEqual(5_000);
  });

  it("finalises once, commits stock to the winner and records an agreement", async () => {
    const productId = await createListing(farmer, 100);
    const auctionId = await liveAuction(farmer, productId, { quantity: 30 });
    await bid(b1, auctionId, 215_000);
    await bid(b2, auctionId, 220_000);
    expect(await codeOf(b1.call("requestAuctionFinalization", { auctionId }))).toBe("failed-precondition");
    await endNow(auctionId);
    expect(await codeOf(bid(b1, auctionId, 250_000))).toBe("failed-precondition");

    const runs = await Promise.all([b1, b2, farmer].map((u) => u.call<{ result: string }>("requestAuctionFinalization", { auctionId })));
    expect(runs.filter((r) => r.result === "finalized")).toHaveLength(1);

    const a = (await adminDb.collection("auctions").doc(auctionId).get()).data()!;
    expect(a).toMatchObject({ status: "ended", resultStatus: "winner", winningBid: 220_000, winnerLabel: "Bidder 2", agreementId: `auction_${auctionId}` });
    expect(await stockOf(productId)).toMatchObject({ available: 70, reserved: 0, committed: 30 });
    const agreement = (await adminDb.collection("agreements").doc(a.agreementId).get()).data()!;
    expect(agreement).toMatchObject({ buyerId: b2.uid, farmerId: farmer.uid, quantity: 30, pricePerUnit: 220_000, source: "auction" });
    expect((await adminDb.doc(`auctions/${auctionId}/participants/${b2.uid}`).get()).get("won")).toBe(true);
    const notes = await adminDb.collection("notifications").where("recipientId", "==", b2.uid).where("type", "==", "auction_won").get();
    expect(notes.size).toBe(1);
  });

  it("ends without a winner when the reserve is not met, and releases stock", async () => {
    const productId = await createListing(farmer, 100);
    const auctionId = await liveAuction(farmer, productId, { reservePrice: 300_000 });
    await bid(b1, auctionId, 250_000);
    await endNow(auctionId);
    await b1.call("requestAuctionFinalization", { auctionId });
    const a = (await adminDb.collection("auctions").doc(auctionId).get()).data()!;
    expect(a).toMatchObject({ status: "ended", resultStatus: "reserve_not_met", reserveMet: false, winningBid: null });
    expect(await stockOf(productId)).toMatchObject({ available: 100, reserved: 0, committed: 0 });
  });

  it("ends with no bids and releases stock; cancellation before bids releases stock", async () => {
    const productId = await createListing(farmer, 100);
    const a1 = await liveAuction(farmer, productId);
    const a2 = await liveAuction(farmer, productId);
    expect(await stockOf(productId)).toMatchObject({ available: 60, reserved: 40 });
    await endNow(a1);
    await b1.call("requestAuctionFinalization", { auctionId: a1 });
    expect((await adminDb.collection("auctions").doc(a1).get()).get("resultStatus")).toBe("no_bids");
    await farmer.call("cancelAuction", { auctionId: a2, reason: "Quality check failed" });
    expect((await adminDb.collection("auctions").doc(a2).get()).get("status")).toBe("cancelled");
    expect(await stockOf(productId)).toMatchObject({ available: 100, reserved: 0 });
  });

  it("cannot auction more than the available quantity", async () => {
    const productId = await createListing(farmer, 10);
    expect(
      await codeOf(
        farmer.call("createAuction", {
          productId,
          quantity: 11,
          startingPrice: 215_000,
          minimumIncrement: 5_000,
          reservePrice: null,
          startsAtMs: Date.now(),
          endsAtMs: Date.now() + 30 * MIN,
          description: "",
          conditions: "",
          bidVisibility: "public_anonymous",
          publish: true,
        }),
      ),
    ).toBe("failed-precondition");
  });

  it("sealed auctions hide amounts until the end", async () => {
    const productId = await createListing(farmer, 50);
    const auctionId = await liveAuction(farmer, productId, { bidVisibility: "sealed" });
    await bid(b1, auctionId, 240_000);
    await bid(b2, auctionId, 215_000); // valid in a sealed auction: only the starting price applies to a first bid
    let a = (await adminDb.collection("auctions").doc(auctionId).get()).data()!;
    expect(a.currentHighestBid).toBeNull();
    await endNow(auctionId);
    await b1.call("requestAuctionFinalization", { auctionId });
    a = (await adminDb.collection("auctions").doc(auctionId).get()).data()!;
    expect(a).toMatchObject({ resultStatus: "winner", winningBid: 240_000, currentHighestBid: 240_000 });
  });
});
