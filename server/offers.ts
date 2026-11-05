import { HttpsError, logger } from "./lib/http";
import { db, FieldValue, Timestamp } from "./lib/admin";
import { callable, requireRole } from "./lib/callable";
import { writeAudit } from "./lib/audit";
import { writeSystemMessage } from "./lib/messages";
import { createAgreementInTx } from "./lib/agreements";
import { notify, type NotificationInput } from "./lib/notify";
import { createOfferSchema, respondToOfferSchema } from "@shared/schemas";
import { checkOfferAction, expiryFromHours, isExpired, MAX_COUNTER_ROUNDS } from "@shared/offer";
import { commitFromAvailable, pickStock } from "@shared/stock";
import { CURRENCY, formatINR, lineTotal } from "@shared/money";
import { formatQuantity, unitShort } from "@shared/units";
import { DomainError } from "@shared/errors";
import type { Conversation, Offer, Product } from "@shared/types";

type OfferDoc = Offer & { round: number };

function describe(o: { quantity: number; unit: Product["unit"]; pricePerUnit: number }) {
  return `${formatQuantity(o.quantity, o.unit)} at ${formatINR(o.pricePerUnit)}/${unitShort(o.unit)} (${formatINR(lineTotal(o.pricePerUnit, o.quantity))} total)`;
}

function assertTradableProduct(product: Product | undefined, quantity: number): Product {
  if (!product || product.listingStatus === "removed") throw new HttpsError("not-found", "This listing is no longer available.");
  if (product.listingStatus !== "active") throw new HttpsError("failed-precondition", "This listing is not accepting offers right now.");
  if (quantity < product.minOrderQuantity) {
    throw new HttpsError("failed-precondition", `The minimum order is ${formatQuantity(product.minOrderQuantity, product.unit)}.`);
  }
  if (quantity > product.availableQuantity) {
    throw new HttpsError("failed-precondition", `Only ${formatQuantity(product.availableQuantity, product.unit)} is available right now.`, {
      available: product.availableQuantity,
    });
  }
  return product;
}

/** A buyer proposes terms inside a conversation. Only one offer may be open per conversation at a time. */
export const createOffer = callable("createOffer", createOfferSchema, async (input, actor) => {
  requireRole(actor, "buyer");
  const convRef = db.collection("conversations").doc(input.conversationId);
  const productRef = db.collection("products").doc(input.productId);
  const offerRef = db.collection("offers").doc();
  const nowMs = Date.now();
  const result = await db.runTransaction(async (tx) => {
    const conv = (await tx.get(convRef)).data() as Conversation | undefined;
    if (!conv || conv.buyerId !== actor.uid) throw new HttpsError("not-found", "Conversation not found.");
    if (conv.status !== "open") throw new HttpsError("failed-precondition", "This conversation is blocked.");
    if (conv.productId && conv.productId !== input.productId) throw new HttpsError("invalid-argument", "This conversation is about a different listing.");
    const product = assertTradableProduct((await tx.get(productRef)).data() as Product | undefined, input.quantity);
    if (product.farmerId !== conv.farmerId) throw new HttpsError("invalid-argument", "This listing belongs to a different farmer.");
    const open = await tx.get(db.collection("offers").where("conversationId", "==", conv.conversationId).where("status", "==", "pending").limit(1));
    if (!open.empty && !isExpired({ ...(open.docs[0].data() as Offer), expiresAtMs: (open.docs[0].get("expiresAt") as Timestamp | null)?.toMillis() ?? null }, nowMs)) {
      throw new HttpsError("failed-precondition", "There is already an open offer in this conversation. Withdraw it or wait for a response first.");
    }
    const expiresAtMs = expiryFromHours(nowMs, input.expiresInHours);
    const offer = {
      offerId: offerRef.id,
      rootOfferId: offerRef.id,
      parentOfferId: null,
      round: 1,
      productId: product.productId,
      productName: product.name,
      buyerId: actor.uid,
      farmerId: product.farmerId,
      conversationId: conv.conversationId,
      proposedBy: actor.uid,
      respondentId: product.farmerId,
      quantity: input.quantity,
      unit: product.unit,
      pricePerUnit: input.pricePerUnit,
      currency: CURRENCY,
      totalValue: lineTotal(input.pricePerUnit, input.quantity),
      message: input.message,
      terms: input.terms,
      status: "pending",
      expiresAt: expiresAtMs ? Timestamp.fromMillis(expiresAtMs) : null,
      createdAt: FieldValue.serverTimestamp(),
      respondedAt: null,
      respondedBy: null,
      supersededBy: null,
      agreementId: null,
    };
    tx.set(offerRef, offer);
    writeSystemMessage(tx, conv.conversationId, {
      senderId: actor.uid,
      messageType: "offer",
      text: `Offer: ${describe(offer)}`,
      relatedOfferId: offerRef.id,
      key: `offer_${offerRef.id}`,
      participantIds: conv.participantIds,
    });
    writeAudit(tx, { actorId: actor.uid, actorRole: "buyer", action: "offer.created", targetType: "offer", targetId: offerRef.id, metadata: { quantity: offer.quantity, pricePerUnit: offer.pricePerUnit } });
    return { conv, offer };
  });
  await notify([
    {
      key: offerRef.id,
      recipientId: result.offer.farmerId,
      type: "offer_new",
      title: "New offer",
      message: `${result.conv.participantNames[actor.uid]} offered ${describe(result.offer)} for ${result.offer.productName}.`,
      entityType: "offer",
      relatedEntityId: offerRef.id,
      link: `/messages/${result.conv.conversationId}`,
    },
  ]);
  return { offerId: offerRef.id };
});

/**
 * Accept, reject, counter or withdraw. Acceptance re-checks the offer, the listing and uncommitted
 * stock in one transaction, then commits the stock and records the agreement atomically.
 */
export const respondToOffer = callable("respondToOffer", respondToOfferSchema, async (input, actor) => {
  requireRole(actor, "farmer", "buyer");
  const offerRef = db.collection("offers").doc(input.offerId);
  const nowMs = Date.now();
  const notes: NotificationInput[] = [];

  const outcome = await db.runTransaction(async (tx) => {
    const offer = (await tx.get(offerRef)).data() as OfferDoc | undefined;
    if (!offer || (offer.buyerId !== actor.uid && offer.farmerId !== actor.uid)) throw new HttpsError("not-found", "Offer not found.");

    // A duplicate acceptance (double click, network retry) returns the original result.
    if (input.action === "accept" && offer.status === "accepted" && offer.respondedBy === actor.uid) {
      return { kind: "duplicate" as const, agreementId: offer.agreementId };
    }
    const state = { status: offer.status, proposedBy: offer.proposedBy, respondentId: offer.respondentId, expiresAtMs: offer.expiresAt?.toMillis() ?? null };
    if (isExpired(state, nowMs)) {
      tx.update(offerRef, { status: "expired", respondedAt: FieldValue.serverTimestamp() });
      writeSystemMessage(tx, offer.conversationId, { senderId: offer.proposedBy, messageType: "system", text: "Offer expired.", relatedOfferId: offer.offerId, key: `expired_${offer.offerId}`, participantIds: [offer.buyerId, offer.farmerId] });
      return { kind: "expired" as const };
    }
    const check = checkOfferAction(state, actor.uid, input.action, nowMs);
    if (!check.ok) throw new DomainError(check.code, check.message);

    const conv = (await tx.get(db.collection("conversations").doc(offer.conversationId))).data() as Conversation;
    const names = conv.participantNames;
    const other = actor.uid === offer.buyerId ? offer.farmerId : offer.buyerId;

    if (input.action === "accept") {
      const productRef = db.collection("products").doc(offer.productId);
      const product = (await tx.get(productRef)).data() as Product | undefined;
      if (!product || product.listingStatus === "removed") throw new HttpsError("failed-precondition", "This listing was removed, so the offer cannot be accepted.");
      if (product.listingStatus !== "active") throw new HttpsError("failed-precondition", "The listing is paused or unavailable. Reactivate it before accepting.");
      if (product.unit !== offer.unit) throw new HttpsError("failed-precondition", "The listing's unit changed. Please make a new offer.");
      const next = commitFromAvailable(pickStock(product), offer.quantity);
      tx.update(productRef, { ...next, updatedAt: FieldValue.serverTimestamp() });
      const { agreementId, allocationId } = createAgreementInTx(tx, {
        source: "offer",
        sourceId: offer.offerId,
        productId: offer.productId,
        productName: offer.productName,
        farmerId: offer.farmerId,
        buyerId: offer.buyerId,
        participantNames: names,
        conversationId: offer.conversationId,
        quantity: offer.quantity,
        unit: offer.unit,
        pricePerUnit: offer.pricePerUnit,
        actorId: actor.uid,
      });
      tx.update(offerRef, { status: "accepted", respondedAt: FieldValue.serverTimestamp(), respondedBy: actor.uid, agreementId });
      writeSystemMessage(tx, offer.conversationId, {
        senderId: actor.uid,
        messageType: "system",
        text: `Offer accepted: ${describe(offer)}. An agreement has been recorded. Contact details are now shared so you can arrange payment and delivery directly.`,
        relatedOfferId: offer.offerId,
        key: `accepted_${offer.offerId}`,
        participantIds: [offer.buyerId, offer.farmerId],
      });
      writeAudit(tx, {
        actorId: actor.uid,
        actorRole: actor.role!,
        action: "offer.accepted",
        targetType: "offer",
        targetId: offer.offerId,
        metadata: { agreementId, allocationId, quantity: offer.quantity, pricePerUnit: offer.pricePerUnit, stockAfter: next },
      });
      for (const r of [offer.buyerId, offer.farmerId]) {
        notes.push({
          key: offer.offerId,
          recipientId: r,
          type: "offer_accepted",
          title: "Offer accepted",
          message: `${offer.productName}: ${describe(offer)}. Agreement recorded.`,
          entityType: "agreement",
          relatedEntityId: agreementId,
          link: `/agreements/${agreementId}`,
        });
      }
      return { kind: "accepted" as const, agreementId };
    }

    if (input.action === "reject" || input.action === "withdraw") {
      const status = input.action === "reject" ? "rejected" : "withdrawn";
      tx.update(offerRef, { status, respondedAt: FieldValue.serverTimestamp(), respondedBy: actor.uid });
      const note = input.action === "reject" && input.message ? ` "${input.message}"` : "";
      writeSystemMessage(tx, offer.conversationId, {
        senderId: actor.uid,
        messageType: "system",
        text: `${names[actor.uid]} ${status} the offer of ${describe(offer)}.${note}`,
        relatedOfferId: offer.offerId,
        key: `${status}_${offer.offerId}`,
        participantIds: [offer.buyerId, offer.farmerId],
      });
      writeAudit(tx, { actorId: actor.uid, actorRole: actor.role!, action: `offer.${status}`, targetType: "offer", targetId: offer.offerId });
      notes.push({
        key: offer.offerId,
        recipientId: other,
        type: status === "rejected" ? "offer_rejected" : "offer_withdrawn",
        title: status === "rejected" ? "Offer rejected" : "Offer withdrawn",
        message: `${names[actor.uid]} ${status} the offer for ${offer.productName}.`,
        entityType: "offer",
        relatedEntityId: offer.offerId,
        link: `/messages/${offer.conversationId}`,
      });
      return { kind: status };
    }

    // Counteroffer: the original is kept and marked as countered; the new terms are a new record.
    if (offer.round >= MAX_COUNTER_ROUNDS) throw new HttpsError("failed-precondition", "This negotiation has reached the maximum number of rounds.");
    const product = assertTradableProduct((await tx.get(db.collection("products").doc(offer.productId))).data() as Product | undefined, input.quantity);
    const counterRef = db.collection("offers").doc();
    const expiresAtMs = expiryFromHours(nowMs, input.expiresInHours);
    const counter = {
      ...offer,
      offerId: counterRef.id,
      parentOfferId: offer.offerId,
      round: offer.round + 1,
      proposedBy: actor.uid,
      respondentId: other,
      quantity: input.quantity,
      unit: product.unit,
      pricePerUnit: input.pricePerUnit,
      totalValue: lineTotal(input.pricePerUnit, input.quantity),
      message: input.message,
      terms: input.terms,
      status: "pending",
      expiresAt: expiresAtMs ? Timestamp.fromMillis(expiresAtMs) : null,
      createdAt: FieldValue.serverTimestamp(),
      respondedAt: null,
      respondedBy: null,
      supersededBy: null,
      agreementId: null,
    };
    tx.set(counterRef, counter);
    tx.update(offerRef, { status: "countered", respondedAt: FieldValue.serverTimestamp(), respondedBy: actor.uid, supersededBy: counterRef.id });
    writeSystemMessage(tx, offer.conversationId, {
      senderId: actor.uid,
      messageType: "offer",
      text: `Counteroffer: ${describe(counter)}`,
      relatedOfferId: counterRef.id,
      key: `offer_${counterRef.id}`,
      participantIds: [offer.buyerId, offer.farmerId],
    });
    writeAudit(tx, {
      actorId: actor.uid,
      actorRole: actor.role!,
      action: "offer.countered",
      targetType: "offer",
      targetId: offer.offerId,
      metadata: { counterOfferId: counterRef.id, quantity: counter.quantity, pricePerUnit: counter.pricePerUnit },
    });
    notes.push({
      key: counterRef.id,
      recipientId: other,
      type: "offer_countered",
      title: "Counteroffer received",
      message: `${names[actor.uid]} countered with ${describe(counter)} for ${offer.productName}.`,
      entityType: "offer",
      relatedEntityId: counterRef.id,
      link: `/messages/${offer.conversationId}`,
    });
    return { kind: "countered" as const, offerId: counterRef.id };
  });

  if (outcome.kind === "expired") throw new HttpsError("failed-precondition", "This offer has expired and can no longer be accepted.");
  await notify(notes);
  return outcome;
});

/** Marks pending offers past their expiry time as expired. Safe to run repeatedly. */
export async function expireDueOffers(nowMs: number = Date.now()): Promise<number> {
  const due = await db.collection("offers").where("status", "==", "pending").where("expiresAt", "<=", Timestamp.fromMillis(nowMs)).limit(200).get();
  let count = 0;
  for (const d of due.docs) {
    const expired = await db.runTransaction(async (tx) => {
      const o = (await tx.get(d.ref)).data() as Offer;
      if (o.status !== "pending") return null;
      tx.update(d.ref, { status: "expired", respondedAt: FieldValue.serverTimestamp() });
      writeSystemMessage(tx, o.conversationId, { senderId: o.proposedBy, messageType: "system", text: "Offer expired without a response.", relatedOfferId: o.offerId, key: `expired_${o.offerId}`, participantIds: [o.buyerId, o.farmerId] });
      writeAudit(tx, { actorId: "system", actorRole: "system", action: "offer.expired", targetType: "offer", targetId: o.offerId });
      return o;
    });
    if (!expired) continue;
    count++;
    await notify(
      [expired.proposedBy, expired.respondentId].map((r) => ({
        key: expired.offerId,
        recipientId: r,
        type: "offer_expired" as const,
        title: "Offer expired",
        message: `The offer for ${expired.productName} (${describe(expired)}) expired without a response.`,
        entityType: "offer" as const,
        relatedEntityId: expired.offerId,
        link: `/messages/${expired.conversationId}`,
      })),
    );
  }
  if (count) logger.info(`Expired ${count} offers`);
  return count;
}
