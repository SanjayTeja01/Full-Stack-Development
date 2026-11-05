import { HttpsError, logger } from "./lib/http";
import type { Transaction } from "firebase-admin/firestore";
import { z } from "zod";
import { db, FieldValue, Timestamp } from "./lib/admin";
import { callable, requireRole, type Actor } from "./lib/callable";
import { writeAudit } from "./lib/audit";
import { createAgreementInTx, updateAllocationInTx } from "./lib/agreements";
import { conversationIdFor, writeSystemMessage } from "./lib/messages";
import { notify, type NotificationInput } from "./lib/notify";
import { recordOpsError } from "./lib/ops";
import { cancelAuctionSchema, createAuctionSchema, id, placeBidSchema, publishAuctionSchema, updateAuctionDraftSchema } from "@shared/schemas";
import {
  AUCTION_LIMITS,
  MINUTE,
  auctionPhase,
  bidderLabel,
  checkCancellation,
  determineOutcome,
  minimumNextBid,
  validateAuctionConfig,
  validateBid,
} from "@shared/auction";
import { commitFromReservation, pickStock, releaseReservation, reserveForAuction } from "@shared/stock";
import { CURRENCY, formatINR } from "@shared/money";
import { formatQuantity, unitShort } from "@shared/units";
import { DomainError } from "@shared/errors";
import type { Auction, AuctionParticipant, AuctionPrivateState, Conversation, Product, StockAllocation, UserProfile } from "@shared/types";

const minDurationMs = () => Number(process.env.AUCTION_MIN_DURATION_MINUTES || 15) * MINUTE;
const auctionRef = (auctionId: string) => db.collection("auctions").doc(auctionId);
const stateRef = (auctionId: string) => auctionRef(auctionId).collection("private").doc("state");

function priceLabel(a: Pick<Auction, "unit">, paise: number) {
  return `${formatINR(paise)}/${unitShort(a.unit)}`;
}

function assertOwnedProduct(product: Product | undefined, actor: Actor): Product {
  if (!product || product.listingStatus === "removed") throw new HttpsError("not-found", "This listing no longer exists.");
  if (product.farmerId !== actor.uid) throw new HttpsError("permission-denied", "You can only auction your own produce.");
  return product;
}

/** Reserves stock and moves a draft (or new) auction to scheduled/live inside a transaction. */
function publishInTx(tx: Transaction, actor: Actor, product: Product, a: Auction, reservePrice: number | null, nowMs: number) {
  if (product.listingStatus !== "active") throw new HttpsError("failed-precondition", "Only active listings can be auctioned. Reactivate the listing first.");
  const startsAtMs = Math.max(a.startsAt.toMillis(), nowMs);
  const check = validateAuctionConfig({
    quantity: a.quantity,
    availableQuantity: product.availableQuantity,
    startingPrice: a.startingPrice,
    minimumIncrement: a.minimumIncrement,
    reservePrice,
    startsAtMs: a.startsAt.toMillis(),
    endsAtMs: a.endsAt.toMillis(),
    nowMs,
    minDurationMs: minDurationMs(),
  });
  if (!check.ok) throw new DomainError(check.code, check.message, check.details);
  const next = reserveForAuction(pickStock(product), a.quantity);
  const allocationId = `alloc_auction_${a.auctionId}`;
  tx.update(db.collection("products").doc(product.productId), { ...next, updatedAt: FieldValue.serverTimestamp() });
  tx.set(db.collection("stockAllocations").doc(allocationId), {
    allocationId,
    productId: product.productId,
    farmerId: product.farmerId,
    referenceType: "auction",
    referenceId: a.auctionId,
    agreementId: null,
    quantity: a.quantity,
    unit: product.unit,
    status: "reserved",
    history: [{ status: "reserved", at: Timestamp.now(), reason: "Auction published" }],
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    releasedAt: null,
  });
  const live = startsAtMs <= nowMs;
  tx.update(auctionRef(a.auctionId), {
    status: live ? "live" : "scheduled",
    startsAt: Timestamp.fromMillis(startsAtMs),
    publishedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  tx.set(stateRef(a.auctionId), { allocationId }, { merge: true });
  writeAudit(tx, {
    actorId: actor.uid,
    actorRole: "farmer",
    action: "auction.published",
    targetType: "auction",
    targetId: a.auctionId,
    metadata: { quantity: a.quantity, startsAtMs, endsAtMs: a.endsAt.toMillis(), allocationId, stockAfter: next },
  });
  return { live, startsAtMs };
}

async function notifySavers(farmerId: string, n: Omit<NotificationInput, "recipientId">) {
  try {
    const savers = await db.collectionGroup("savedFarmers").where("farmerId", "==", farmerId).limit(500).get();
    await notify(savers.docs.map((d) => ({ ...n, recipientId: d.ref.parent.parent!.id })));
  } catch (e) {
    await recordOpsError("notifySavers", e, { farmerId });
  }
}

export const createAuction = callable("createAuction", createAuctionSchema, async (input, actor) => {
  requireRole(actor, "farmer");
  const nowMs = Date.now();
  const ref = db.collection("auctions").doc();
  const result = await db.runTransaction(async (tx) => {
    const product = assertOwnedProduct((await tx.get(db.collection("products").doc(input.productId))).data() as Product | undefined, actor);
    const auction = {
      auctionId: ref.id,
      farmerId: actor.uid,
      farmerName: actor.profile!.displayName,
      productId: product.productId,
      productName: product.name,
      productImage: product.images[0]?.url ?? null,
      categoryId: product.categoryId,
      location: product.location,
      quantity: input.quantity,
      unit: product.unit,
      startingPrice: input.startingPrice,
      minimumIncrement: input.minimumIncrement,
      hasReservePrice: input.reservePrice !== null,
      reserveMet: input.reservePrice === null ? null : false,
      startsAt: Timestamp.fromMillis(input.startsAtMs),
      endsAt: Timestamp.fromMillis(input.endsAtMs),
      originalEndsAt: Timestamp.fromMillis(input.endsAtMs),
      extensionCount: 0,
      description: input.description,
      conditions: input.conditions,
      bidVisibility: input.bidVisibility,
      status: "draft",
      currentHighestBid: null,
      currentHighestBidderLabel: null,
      bidCount: 0,
      bidderCount: 0,
      resultStatus: "pending",
      winningBid: null,
      winnerLabel: null,
      agreementId: null,
      cancellationReason: null,
      cancelledBy: null,
      currency: CURRENCY,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      publishedAt: null,
      finalizedAt: null,
    };
    tx.set(ref, auction);
    tx.set(stateRef(ref.id), {
      reservePrice: input.reservePrice,
      currentHighestBidderId: null,
      currentHighestBidId: null,
      currentHighestAmount: null,
      winnerId: null,
      allocationId: null,
    });
    writeAudit(tx, { actorId: actor.uid, actorRole: "farmer", action: "auction.created", targetType: "auction", targetId: ref.id, metadata: { publish: input.publish } });
    if (!input.publish) return { status: "draft" as const, auction };
    const pub = publishInTx(tx, actor, product, { ...auction, startsAt: Timestamp.fromMillis(input.startsAtMs) } as unknown as Auction, input.reservePrice, nowMs);
    return { status: pub.live ? ("live" as const) : ("scheduled" as const), auction };
  });
  if (result.status !== "draft") await announce(result.auction as unknown as Auction, result.status);
  return { auctionId: ref.id, status: result.status };
});

async function announce(a: Auction, status: "live" | "scheduled") {
  const when = status === "live" ? "is live now" : `starts ${a.startsAt.toDate().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`;
  await notify([
    {
      key: a.auctionId,
      recipientId: a.farmerId,
      type: "auction_scheduled",
      title: status === "live" ? "Your auction is live" : "Auction scheduled",
      message: `${formatQuantity(a.quantity, a.unit)} of ${a.productName} ${when}.`,
      entityType: "auction",
      relatedEntityId: a.auctionId,
      link: `/auctions/${a.auctionId}`,
    },
  ]);
  await notifySavers(a.farmerId, {
    key: a.auctionId,
    type: "auction_scheduled",
    title: `New auction from ${a.farmerName}`,
    message: `${formatQuantity(a.quantity, a.unit)} of ${a.productName}, from ${priceLabel(a, a.startingPrice)}. ${status === "live" ? "Bidding is open." : "Starts soon."}`,
    entityType: "auction",
    relatedEntityId: a.auctionId,
    link: `/auctions/${a.auctionId}`,
  });
}

export const updateAuctionDraft = callable("updateAuctionDraft", updateAuctionDraftSchema, async (input, actor) => {
  requireRole(actor, "farmer");
  await db.runTransaction(async (tx) => {
    const a = (await tx.get(auctionRef(input.auctionId))).data() as Auction | undefined;
    if (!a || a.farmerId !== actor.uid) throw new HttpsError("not-found", "Auction not found.");
    if (a.status !== "draft") throw new HttpsError("failed-precondition", "Only draft auctions can be edited. Published auctions can be cancelled before the first bid.");
    const product = assertOwnedProduct((await tx.get(db.collection("products").doc(input.productId))).data() as Product | undefined, actor);
    tx.update(auctionRef(a.auctionId), {
      productId: product.productId,
      productName: product.name,
      productImage: product.images[0]?.url ?? null,
      categoryId: product.categoryId,
      location: product.location,
      unit: product.unit,
      quantity: input.quantity,
      startingPrice: input.startingPrice,
      minimumIncrement: input.minimumIncrement,
      hasReservePrice: input.reservePrice !== null,
      reserveMet: input.reservePrice === null ? null : false,
      startsAt: Timestamp.fromMillis(input.startsAtMs),
      endsAt: Timestamp.fromMillis(input.endsAtMs),
      originalEndsAt: Timestamp.fromMillis(input.endsAtMs),
      description: input.description,
      conditions: input.conditions,
      bidVisibility: input.bidVisibility,
      updatedAt: FieldValue.serverTimestamp(),
    });
    tx.set(stateRef(a.auctionId), { reservePrice: input.reservePrice }, { merge: true });
  });
  return { ok: true };
});

export const publishAuction = callable("publishAuction", publishAuctionSchema, async (input, actor) => {
  requireRole(actor, "farmer");
  const nowMs = Date.now();
  const out = await db.runTransaction(async (tx) => {
    const a = (await tx.get(auctionRef(input.auctionId))).data() as Auction | undefined;
    if (!a || a.farmerId !== actor.uid) throw new HttpsError("not-found", "Auction not found.");
    if (a.status !== "draft") throw new HttpsError("failed-precondition", "This auction is already published.");
    const state = (await tx.get(stateRef(a.auctionId))).data() as AuctionPrivateState;
    const product = assertOwnedProduct((await tx.get(db.collection("products").doc(a.productId))).data() as Product | undefined, actor);
    const pub = publishInTx(tx, actor, product, a, state.reservePrice, nowMs);
    return { a: { ...a, startsAt: Timestamp.fromMillis(pub.startsAtMs) }, status: pub.live ? ("live" as const) : ("scheduled" as const) };
  });
  await announce(out.a, out.status);
  return { status: out.status };
});

/**
 * Cancels an auction under the published policy and releases its reserved stock.
 * Farmers may cancel only before the first bid; administrators may cancel with a recorded reason.
 */
export async function cancelAuctionCore(auctionId: string, actor: Actor, reason: string) {
  const out = await db.runTransaction(async (tx) => {
    const a = (await tx.get(auctionRef(auctionId))).data() as Auction | undefined;
    if (!a || (a.farmerId !== actor.uid && !actor.isAdmin)) throw new HttpsError("not-found", "Auction not found.");
    const check = checkCancellation(a, actor.isAdmin);
    if (!check.ok) throw new DomainError(check.code, check.message);
    const state = (await tx.get(stateRef(auctionId))).data() as AuctionPrivateState;
    let allocation: StockAllocation | undefined;
    let product: Product | undefined;
    if (state.allocationId) {
      allocation = (await tx.get(db.collection("stockAllocations").doc(state.allocationId))).data() as StockAllocation | undefined;
      product = (await tx.get(db.collection("products").doc(a.productId))).data() as Product | undefined;
    }
    const participants = await tx.get(auctionRef(auctionId).collection("participants"));
    if (allocation && product && allocation.status === "reserved") {
      const next = releaseReservation(pickStock(product), allocation.quantity);
      tx.update(db.collection("products").doc(a.productId), { ...next, updatedAt: FieldValue.serverTimestamp() });
      updateAllocationInTx(tx, allocation, "released", `Auction cancelled: ${reason}`);
    }
    tx.update(auctionRef(auctionId), {
      status: "cancelled",
      resultStatus: "cancelled",
      cancellationReason: reason,
      cancelledBy: actor.isAdmin ? "admin" : "farmer",
      finalizedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    writeAudit(tx, {
      actorId: actor.uid,
      actorRole: actor.role!,
      action: "auction.cancelled",
      targetType: "auction",
      targetId: auctionId,
      reason,
      metadata: { bidCount: a.bidCount, previousStatus: a.status },
    });
    return { a, bidders: participants.docs.map((d) => d.id) };
  });
  const recipients = [...out.bidders, ...(actor.uid === out.a.farmerId ? [] : [out.a.farmerId])];
  await notify(
    recipients.map((r) => ({
      key: auctionId,
      recipientId: r,
      type: "auction_cancelled" as const,
      title: "Auction cancelled",
      message: `The auction for ${out.a.productName} was cancelled. Reason: ${reason}`,
      entityType: "auction" as const,
      relatedEntityId: auctionId,
      link: `/auctions/${auctionId}`,
    })),
  );
  return { ok: true };
}

export const cancelAuction = callable("cancelAuction", cancelAuctionSchema, async (input, actor) => {
  requireRole(actor, "farmer");
  return cancelAuctionCore(input.auctionId, actor, input.reason);
});

/**
 * Places a bid. All validation runs here against the server clock inside a transaction on the auction
 * document, so concurrent bids are applied one at a time: if another bid lands first, this one is
 * re-validated against the new highest bid and rejected if it no longer meets the minimum.
 * The bid id is derived from the buyer's idempotency key, so a retried request returns the original result.
 */
export const placeBid = callable("placeBid", placeBidSchema, async (input, actor) => {
  requireRole(actor, "buyer");
  const bidId = `${input.auctionId}_${actor.uid}_${input.idempotencyKey}`;
  const bidRef = db.collection("bids").doc(bidId);
  const participantRef = auctionRef(input.auctionId).collection("participants").doc(actor.uid);

  const out = await db.runTransaction(async (tx) => {
    const [aSnap, sSnap, bSnap, pSnap] = await Promise.all([tx.get(auctionRef(input.auctionId)), tx.get(stateRef(input.auctionId)), tx.get(bidRef), tx.get(participantRef)]);
    const a = aSnap.data() as Auction | undefined;
    if (!a || a.status === "draft") throw new HttpsError("not-found", "Auction not found.");
    const state = sSnap.data() as AuctionPrivateState;
    const existing = bSnap.data();
    if (existing) {
      if (existing.amountPerUnit !== input.amountPerUnit) throw new HttpsError("already-exists", "This request was already used for a different bid amount.");
      return { duplicate: true as const, a, previousLeader: null, label: existing.bidderLabel as string };
    }
    const participant = pSnap.data() as AuctionParticipant | undefined;
    const nowMs = Date.now();
    const check = validateBid({
      auction: { ...a, startsAtMs: a.startsAt.toMillis(), endsAtMs: a.endsAt.toMillis() },
      amountPerUnit: input.amountPerUnit,
      nowMs,
      buyerId: actor.uid,
      buyerRole: actor.role ?? undefined,
      buyerAccountStatus: actor.profile?.accountStatus,
      currentLeaderId: state.currentHighestBidderId,
      ownHighestBid: participant?.highestBid ?? null,
    });
    if (!check.ok) {
      const min = minimumNextBid({ ...a, startsAtMs: 0, endsAtMs: 0 }, participant?.highestBid ?? null);
      throw new DomainError(check.code, check.message, { ...check.details, minimumNextBid: min });
    }

    const now = Timestamp.fromMillis(nowMs);
    const label = participant?.label ?? bidderLabel(a.bidderCount + 1);
    const isNewHighest = state.currentHighestAmount === null || input.amountPerUnit > state.currentHighestAmount;
    tx.set(bidRef, {
      bidId,
      auctionId: a.auctionId,
      productName: a.productName,
      farmerId: a.farmerId,
      buyerId: actor.uid,
      bidderLabel: label,
      amountPerUnit: input.amountPerUnit,
      quantity: a.quantity,
      unit: a.unit,
      status: "accepted",
      idempotencyKey: input.idempotencyKey,
      createdAt: now,
      acceptedAt: now,
    });
    tx.set(auctionRef(a.auctionId).collection("publicBids").doc(bidId), { bidId, amountPerUnit: input.amountPerUnit, bidderLabel: label, createdAt: now });
    tx.set(participantRef, {
      buyerId: actor.uid,
      label,
      joinedAt: participant?.joinedAt ?? now,
      highestBid: Math.max(participant?.highestBid ?? 0, input.amountPerUnit),
      lastBidAt: now,
    });
    tx.update(auctionRef(a.auctionId), {
      status: "live",
      bidCount: FieldValue.increment(1),
      ...(participant ? {} : { bidderCount: FieldValue.increment(1) }),
      ...(a.bidVisibility === "public_anonymous" && isNewHighest ? { currentHighestBid: input.amountPerUnit, currentHighestBidderLabel: label } : {}),
      updatedAt: FieldValue.serverTimestamp(),
    });
    if (isNewHighest) {
      tx.update(stateRef(a.auctionId), { currentHighestAmount: input.amountPerUnit, currentHighestBidderId: actor.uid, currentHighestBidId: bidId });
    }
    return { duplicate: false as const, a, previousLeader: isNewHighest ? state.currentHighestBidderId : null, label };
  });

  const a = out.a;
  if (!out.duplicate) {
    const notes: NotificationInput[] = [
      {
        key: a.auctionId,
        recipientId: a.farmerId,
        type: "auction_new_bid",
        title: "New bid on your auction",
        message: `${out.label} bid ${priceLabel(a, input.amountPerUnit)} for ${a.productName}.`,
        entityType: "auction",
        relatedEntityId: a.auctionId,
        link: `/auctions/${a.auctionId}`,
      },
    ];
    if (a.bidVisibility === "public_anonymous" && out.previousLeader && out.previousLeader !== actor.uid) {
      notes.push({
        key: bidId,
        recipientId: out.previousLeader,
        type: "auction_outbid",
        title: "You have been outbid",
        message: `Another bidder offered ${priceLabel(a, input.amountPerUnit)} for ${a.productName}.`,
        entityType: "auction",
        relatedEntityId: a.auctionId,
        link: `/auctions/${a.auctionId}`,
      });
    }
    await notify(notes);
  }
  return { bidId, amountPerUnit: input.amountPerUnit, bidderLabel: out.label, duplicate: out.duplicate };
});

/**
 * Records the outcome of an auction whose end time has passed. Idempotent: an auction that is
 * already ended or cancelled is left untouched, so retries and overlapping runs are safe.
 */
export async function finalizeAuction(auctionId: string, nowMs: number = Date.now()): Promise<"finalized" | "skipped"> {
  const out = await db.runTransaction(async (tx) => {
    const a = (await tx.get(auctionRef(auctionId))).data() as Auction | undefined;
    if (!a || a.status === "ended" || a.status === "cancelled" || a.status === "draft") return null;
    if (nowMs < a.endsAt.toMillis()) return null;
    const state = (await tx.get(stateRef(auctionId))).data() as AuctionPrivateState;
    const productRef = db.collection("products").doc(a.productId);
    const product = (await tx.get(productRef)).data() as Product;
    const allocation = state.allocationId ? ((await tx.get(db.collection("stockAllocations").doc(state.allocationId))).data() as StockAllocation) : undefined;
    const outcome = determineOutcome({ bidCount: a.bidCount, currentHighestBid: state.currentHighestAmount, reservePrice: state.reservePrice });
    const participants = await tx.get(auctionRef(auctionId).collection("participants"));

    let winner: { id: string; label: string; conversationId: string; agreementId: string } | null = null;
    let conv: Conversation | undefined;
    let winnerProfile: UserProfile | undefined;
    if (outcome === "winner") {
      const winnerId = state.currentHighestBidderId!;
      const conversationId = conversationIdFor(winnerId, a.farmerId, a.productId);
      conv = (await tx.get(db.collection("conversations").doc(conversationId))).data() as Conversation | undefined;
      winnerProfile = (await tx.get(db.collection("users").doc(winnerId))).data() as UserProfile;
      const label = (participants.docs.find((d) => d.id === winnerId)?.get("label") as string) ?? "Winner";
      winner = { id: winnerId, label, conversationId, agreementId: `auction_${auctionId}` };
    }

    // ---- writes ----
    if (winner && allocation) {
      const next = commitFromReservation(pickStock(product), a.quantity);
      tx.update(productRef, { ...next, updatedAt: FieldValue.serverTimestamp() });
      updateAllocationInTx(tx, allocation, "committed", `Auction won by ${winner.label}`, { agreementId: winner.agreementId });
      const winnerName = winnerProfile!.organizationName ? `${winnerProfile!.displayName} (${winnerProfile!.organizationName})` : winnerProfile!.displayName;
      if (!conv) {
        tx.set(db.collection("conversations").doc(winner.conversationId), {
          conversationId: winner.conversationId,
          participantIds: [winner.id, a.farmerId],
          buyerId: winner.id,
          farmerId: a.farmerId,
          participantNames: { [winner.id]: winnerName, [a.farmerId]: a.farmerName },
          productId: a.productId,
          productName: a.productName,
          status: "open",
          blockedBy: null,
          archivedBy: [],
          lastMessageAt: null,
          lastMessagePreview: null,
          lastMessageSenderId: null,
          lastMessageId: null,
          unreadCounts: { [winner.id]: 0, [a.farmerId]: 0 },
          lastReadAt: {},
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      createAgreementInTx(
        tx,
        {
          source: "auction",
          sourceId: auctionId,
          productId: a.productId,
          productName: a.productName,
          farmerId: a.farmerId,
          buyerId: winner.id,
          participantNames: { [winner.id]: winnerName, [a.farmerId]: a.farmerName },
          conversationId: winner.conversationId,
          quantity: a.quantity,
          unit: a.unit,
          pricePerUnit: state.currentHighestAmount!,
          actorId: "system",
        },
        allocation.allocationId,
      );
      writeSystemMessage(tx, winner.conversationId, {
        senderId: a.farmerId,
        messageType: "system",
        text: `Auction result: ${winner.label} won ${formatQuantity(a.quantity, a.unit)} at ${priceLabel(a, state.currentHighestAmount!)}. An agreement has been recorded. Contact details are now shared so you can arrange payment and delivery directly.`,
        key: `auction_won_${auctionId}`,
        participantIds: [winner.id, a.farmerId],
      });
    } else if (allocation && allocation.status === "reserved") {
      const next = releaseReservation(pickStock(product), allocation.quantity);
      tx.update(productRef, { ...next, updatedAt: FieldValue.serverTimestamp() });
      updateAllocationInTx(tx, allocation, "released", outcome === "no_bids" ? "Auction ended with no bids" : "Auction ended; reserve price not met");
    }
    tx.update(auctionRef(auctionId), {
      status: "ended",
      resultStatus: outcome,
      reserveMet: state.reservePrice === null ? null : outcome === "winner",
      winningBid: winner ? state.currentHighestAmount : null,
      winnerLabel: winner?.label ?? null,
      agreementId: winner?.agreementId ?? null,
      ...(a.bidVisibility === "sealed" && state.currentHighestAmount !== null ? { currentHighestBid: state.currentHighestAmount } : {}),
      finalizedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    tx.update(stateRef(auctionId), { winnerId: winner?.id ?? null });
    if (winner) tx.update(auctionRef(auctionId).collection("participants").doc(winner.id), { won: true });
    writeAudit(tx, {
      actorId: "system",
      actorRole: "system",
      action: "auction.finalized",
      targetType: "auction",
      targetId: auctionId,
      metadata: { outcome, winningBid: winner ? state.currentHighestAmount : null, winnerId: winner?.id ?? null, bidCount: a.bidCount, finalizedAtMs: nowMs },
    });
    return { a, outcome, winner, amount: state.currentHighestAmount, bidders: participants.docs.map((d) => d.id) };
  });
  if (!out) return "skipped";

  const { a, outcome, winner, amount, bidders } = out;
  const notes: NotificationInput[] = [];
  const link = `/auctions/${auctionId}`;
  if (winner) {
    notes.push({
      key: auctionId,
      recipientId: a.farmerId,
      type: "auction_ended",
      title: "Auction ended with a winner",
      message: `${winner.label} won ${a.productName} at ${priceLabel(a, amount!)}. Contact details are on the agreement.`,
      entityType: "agreement",
      relatedEntityId: winner.agreementId,
      link: `/agreements/${winner.agreementId}`,
    });
    notes.push({
      key: auctionId,
      recipientId: winner.id,
      type: "auction_won",
      title: "You won the auction",
      message: `You won ${formatQuantity(a.quantity, a.unit)} of ${a.productName} at ${priceLabel(a, amount!)}. Contact the farmer to arrange payment and delivery.`,
      entityType: "agreement",
      relatedEntityId: winner.agreementId,
      link: `/agreements/${winner.agreementId}`,
    });
  } else {
    notes.push({
      key: auctionId,
      recipientId: a.farmerId,
      type: "auction_no_winner",
      title: "Auction ended without a winner",
      message: `${a.productName}: ${outcome === "no_bids" ? "no bids were placed" : "the reserve price was not met"}. The quantity is back in your available stock.`,
      entityType: "auction",
      relatedEntityId: auctionId,
      link,
    });
  }
  for (const b of bidders.filter((x) => x !== winner?.id)) {
    notes.push({
      key: auctionId,
      recipientId: b,
      type: "auction_ended",
      title: "Auction ended",
      message: `The auction for ${a.productName} has ended. ${outcome === "winner" ? "Your bid was not the highest." : "No winner was recorded (reserve price not met)."}`,
      entityType: "auction",
      relatedEntityId: auctionId,
      link,
    });
  }
  await notify(notes);
  return "finalized";
}

/** Starts due auctions, sends starting-soon notices and finalises ended auctions. Safe to run repeatedly. */
export async function processDueAuctions(nowMs: number = Date.now()) {
  const now = Timestamp.fromMillis(nowMs);
  let started = 0;
  let finalized = 0;

  const due = await db.collection("auctions").where("status", "in", ["scheduled", "live"]).where("endsAt", "<=", now).limit(100).get();
  for (const d of due.docs) {
    try {
      if ((await finalizeAuction(d.id, nowMs)) === "finalized") finalized++;
    } catch (e) {
      await recordOpsError("finalizeAuction", e, { auctionId: d.id });
    }
  }

  const toStart = await db.collection("auctions").where("status", "==", "scheduled").where("startsAt", "<=", now).limit(200).get();
  for (const d of toStart.docs) {
    const a = await db.runTransaction(async (tx) => {
      const cur = (await tx.get(d.ref)).data() as Auction;
      if (cur.status !== "scheduled" || auctionPhase({ status: cur.status, startsAtMs: cur.startsAt.toMillis(), endsAtMs: cur.endsAt.toMillis() }, nowMs) !== "live") return null;
      tx.update(d.ref, { status: "live", updatedAt: FieldValue.serverTimestamp() });
      return cur;
    });
    if (!a) continue;
    started++;
    await notify([
      {
        key: a.auctionId,
        recipientId: a.farmerId,
        type: "auction_started",
        title: "Your auction has started",
        message: `Bidding is open for ${a.productName}.`,
        entityType: "auction",
        relatedEntityId: a.auctionId,
        link: `/auctions/${a.auctionId}`,
      },
    ]);
    await notifySavers(a.farmerId, {
      key: a.auctionId,
      type: "auction_started",
      title: "Auction started",
      message: `Bidding is open for ${formatQuantity(a.quantity, a.unit)} of ${a.productName} from ${a.farmerName}.`,
      entityType: "auction",
      relatedEntityId: a.auctionId,
      link: `/auctions/${a.auctionId}`,
    });
  }

  const soon = await db
    .collection("auctions")
    .where("status", "==", "scheduled")
    .where("startsAt", "<=", Timestamp.fromMillis(nowMs + AUCTION_LIMITS.startingSoonWindowMs / 4))
    .limit(200)
    .get();
  for (const d of soon.docs) {
    const a = d.data() as Auction & { startingSoonNotified?: boolean };
    if (a.startingSoonNotified || a.startsAt.toMillis() <= nowMs) continue;
    await d.ref.update({ startingSoonNotified: true });
    await notifySavers(a.farmerId, {
      key: a.auctionId,
      type: "auction_starting",
      title: "Auction starting soon",
      message: `${a.productName} from ${a.farmerName} starts in about 15 minutes.`,
      entityType: "auction",
      relatedEntityId: a.auctionId,
      link: `/auctions/${a.auctionId}`,
    });
  }
  if (started || finalized) logger.info(`Auctions: started ${started}, finalized ${finalized}`);
  return { started, finalized };
}

/** Lets a client request finalisation as soon as the end time passes, so results appear without waiting for the scheduler. */
export const requestAuctionFinalization = callable("requestAuctionFinalization", z.object({ auctionId: id }), async (input, actor) => {
  if (!actor.uid) throw new HttpsError("unauthenticated", "Please sign in.");
  const a = (await auctionRef(input.auctionId).get()).data() as Auction | undefined;
  if (!a) throw new HttpsError("not-found", "Auction not found.");
  if (Date.now() < a.endsAt.toMillis()) throw new HttpsError("failed-precondition", "This auction has not ended yet.");
  return { result: await finalizeAuction(input.auctionId) };
});
