import { describe, expect, it, beforeAll } from "vitest";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb, codeOf, createListing, createUser, stockOf, type TestUser } from "./helpers";

async function openOffer(buyer: TestUser, farmerId: string, productId: string, quantity: number, pricePerUnit = 200_000) {
  const { conversationId } = await buyer.call<{ conversationId: string }>("startConversation", { farmerId, productId });
  const { offerId } = await buyer.call<{ offerId: string }>("createOffer", { conversationId, productId, quantity, pricePerUnit, expiresInHours: 48 });
  return { conversationId, offerId };
}
const accept = (u: TestUser, offerId: string) => u.call<{ kind: string; agreementId?: string }>("respondToOffer", { offerId, action: "accept" });

describe("offers and stock (emulator)", () => {
  let farmer: TestUser, buyer: TestUser, buyer2: TestUser, outsider: TestUser;
  beforeAll(async () => {
    [farmer, buyer, buyer2, outsider] = await Promise.all([createUser("farmer"), createUser("buyer"), createUser("buyer"), createUser("buyer")]);
  });

  it("Scenario A: offer, counteroffer, acceptance, agreement and contact sharing", async () => {
    const productId = await createListing(farmer, 120);
    const { offerId, conversationId } = await openOffer(buyer, farmer.uid, productId, 50, 200_000);
    // Only the respondent can accept; the proposer cannot accept their own offer.
    expect(await codeOf(accept(buyer, offerId))).not.toBe("ok");
    const counter = await farmer.call<{ kind: string; offerId: string }>("respondToOffer", { offerId, action: "counter", quantity: 50, pricePerUnit: 210_000, expiresInHours: 48 });
    expect((await adminDb.collection("offers").doc(offerId).get()).get("status")).toBe("countered");
    // The superseded offer can no longer be accepted.
    expect(await codeOf(accept(farmer, offerId))).not.toBe("ok");
    const res = await accept(buyer, counter.offerId);
    expect(res.kind).toBe("accepted");
    expect(await stockOf(productId)).toMatchObject({ available: 70, committed: 50 });
    const agreement = (await adminDb.collection("agreements").doc(res.agreementId!).get()).data()!;
    expect(agreement).toMatchObject({ quantity: 50, pricePerUnit: 210_000, totalValue: 10_500_000, conversationId });
    const contacts = await buyer.call<{ contacts: { userId: string; phone: string | null }[] }>("getAgreementContacts", { agreementId: res.agreementId });
    expect(contacts.contacts.map((c) => c.userId)).toEqual([farmer.uid]);
    expect(await codeOf(outsider.call("getAgreementContacts", { agreementId: res.agreementId }))).toBe("not-found");
  });

  it("accepting twice (including at the same moment) records one agreement and commits stock once", async () => {
    const productId = await createListing(farmer, 100);
    const { offerId } = await openOffer(buyer, farmer.uid, productId, 30);
    const results = await Promise.all([accept(farmer, offerId), accept(farmer, offerId)].map((p) => p.catch((e) => e)));
    const ok = results.filter((r) => !(r instanceof Error)) as { agreementId?: string }[];
    expect(ok.length).toBeGreaterThanOrEqual(1);
    expect(new Set(ok.map((r) => r.agreementId)).size).toBe(1);
    const again = await accept(farmer, offerId);
    expect(again.agreementId).toBe(ok[0].agreementId);
    expect(await stockOf(productId)).toMatchObject({ available: 70, committed: 30 });
    const agreements = await adminDb.collection("agreements").where("sourceId", "==", offerId).get();
    expect(agreements.size).toBe(1);
  });

  it("an expired offer cannot be accepted", async () => {
    const productId = await createListing(farmer, 100);
    const { offerId } = await openOffer(buyer, farmer.uid, productId, 10);
    await adminDb.collection("offers").doc(offerId).update({ expiresAt: Timestamp.fromMillis(Date.now() - 1000) });
    expect(await codeOf(accept(farmer, offerId))).toBe("failed-precondition");
    expect((await adminDb.collection("offers").doc(offerId).get()).get("status")).toBe("expired");
    expect(await stockOf(productId)).toMatchObject({ available: 100, committed: 0 });
  });

  it("Scenario E: stock reserved for an auction cannot also be accepted in a private offer", async () => {
    const productId = await createListing(farmer, 50);
    const { offerId } = await openOffer(buyer, farmer.uid, productId, 40);
    const now = Date.now();
    await farmer.call("createAuction", {
      productId,
      quantity: 30,
      startingPrice: 200_000,
      minimumIncrement: 5_000,
      reservePrice: null,
      startsAtMs: now,
      endsAtMs: now + 30 * 60_000,
      description: "",
      conditions: "",
      bidVisibility: "public_anonymous",
      publish: true,
    });
    expect(await stockOf(productId)).toMatchObject({ available: 20, reserved: 30 });
    expect(await codeOf(accept(farmer, offerId))).toBe("failed-precondition");
    expect(await stockOf(productId)).toMatchObject({ available: 20, reserved: 30, committed: 0 });
    expect((await adminDb.collection("offers").doc(offerId).get()).get("status")).toBe("pending");

    // And the other way round: committed stock cannot be auctioned.
    const p2 = await createListing(farmer, 50);
    const o2 = await openOffer(buyer2, farmer.uid, p2, 40);
    await accept(farmer, o2.offerId);
    expect(
      await codeOf(
        farmer.call("createAuction", {
          productId: p2,
          quantity: 20,
          startingPrice: 200_000,
          minimumIncrement: 5_000,
          reservePrice: null,
          startsAtMs: Date.now(),
          endsAtMs: Date.now() + 30 * 60_000,
          description: "",
          conditions: "",
          bidVisibility: "public_anonymous",
          publish: true,
        }),
      ),
    ).toBe("failed-precondition");
    expect(await stockOf(p2)).toMatchObject({ available: 10, reserved: 0, committed: 40 });
  });

  it("two offers accepted at the same moment cannot oversell", async () => {
    const productId = await createListing(farmer, 50);
    const a = await openOffer(buyer, farmer.uid, productId, 30);
    const b = await openOffer(buyer2, farmer.uid, productId, 30);
    const results = await Promise.all([codeOf(accept(farmer, a.offerId)), codeOf(accept(farmer, b.offerId))]);
    expect(results.filter((r) => r === "ok")).toHaveLength(1);
    expect(await stockOf(productId)).toMatchObject({ available: 20, committed: 30 });
  });
});
