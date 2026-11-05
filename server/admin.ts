import { HttpsError } from "./lib/http";
import { z } from "zod";
import { db, FieldValue } from "./lib/admin";
import { callable, requireRole, type Actor } from "./lib/callable";
import { writeAudit } from "./lib/audit";
import { notify, type NotificationInput } from "./lib/notify";
import { recordOpsError } from "./lib/ops";
import { syncFarmerOnListings } from "./lib/denormalize";
import { applyAgreementStatus } from "./agreements";
import { cancelAuctionCore } from "./auctions";
import {
  adminModerateProductSchema,
  adminResolveAgreementSchema,
  adminResolveErrorSchema,
  adminResolveReportSchema,
  adminReviewVerificationSchema,
  adminSetAccountStatusSchema,
  adminUpsertCategorySchema,
  cancelAuctionSchema,
  id,
} from "@shared/schemas";
import type { Agreement, Auction, Product, Report, UserProfile, VerificationRequest } from "@shared/types";

const requireAdmin = (actor: Actor) => requireRole(actor, "admin");

/**
 * Suspends or restores an account. Suspension pauses the farmer's active listings and cancels their
 * auctions that have no bids yet; auctions that already have bids are left for an administrator to decide.
 */
export const adminSetAccountStatus = callable("adminSetAccountStatus", adminSetAccountStatusSchema, async (input, actor) => {
  requireAdmin(actor);
  if (input.userId === actor.uid) throw new HttpsError("failed-precondition", "You cannot change your own account status.");
  const userRef = db.collection("users").doc(input.userId);
  const user = (await userRef.get()).data() as UserProfile | undefined;
  if (!user) throw new HttpsError("not-found", "User not found.");
  if (user.role === "admin") throw new HttpsError("failed-precondition", "Administrator accounts are managed outside the app.");
  if (user.accountStatus === input.status) return { ok: true, pausedListings: 0, cancelledAuctions: 0, auctionsWithBids: [] as string[] };

  let pausedListings = 0;
  await db.runTransaction(async (tx) => {
    const listings =
      input.status === "suspended" && user.role === "farmer"
        ? await tx.get(db.collection("products").where("farmerId", "==", input.userId).where("listingStatus", "==", "active"))
        : null;
    tx.update(userRef, { accountStatus: input.status, updatedAt: FieldValue.serverTimestamp() });
    listings?.docs.forEach((d) => tx.update(d.ref, { listingStatus: "paused", updatedAt: FieldValue.serverTimestamp() }));
    pausedListings = listings?.size ?? 0;
    writeAudit(tx, {
      actorId: actor.uid,
      actorRole: "admin",
      action: input.status === "suspended" ? "user.suspended" : "user.restored",
      targetType: "user",
      targetId: input.userId,
      reason: input.reason,
      metadata: { pausedListings: listings?.docs.map((d) => d.id) ?? [] },
    });
  });

  let cancelledAuctions = 0;
  const auctionsWithBids: string[] = [];
  if (input.status === "suspended" && user.role === "farmer") {
    const open = await db.collection("auctions").where("farmerId", "==", input.userId).where("status", "in", ["scheduled", "live"]).get();
    for (const d of open.docs) {
      if ((d.get("bidCount") as number) > 0) {
        auctionsWithBids.push(d.id);
        continue;
      }
      try {
        await cancelAuctionCore(d.id, actor, "The farmer's account was suspended.");
        cancelledAuctions++;
      } catch (e) {
        await recordOpsError("adminSetAccountStatus.cancelAuction", e, { auctionId: d.id });
      }
    }
  }
  await notify([
    {
      key: `${input.status}_${Date.now()}`,
      recipientId: input.userId,
      type: "moderation",
      title: input.status === "suspended" ? "Your account has been suspended" : "Your account has been restored",
      message: input.status === "suspended" ? `Reason: ${input.reason}. Contact support if you think this is a mistake.` : "You can use FarmConnect normally again. Paused listings stay paused until you reactivate them.",
      entityType: "account",
      relatedEntityId: input.userId,
      link: "/settings",
    },
  ]);
  return { ok: true, pausedListings, cancelledAuctions, auctionsWithBids };
});

export const adminReviewVerification = callable("adminReviewVerification", adminReviewVerificationSchema, async (input, actor) => {
  requireAdmin(actor);
  const reqRef = db.collection("verificationRequests").doc(input.userId);
  const userRef = db.collection("users").doc(input.userId);
  await db.runTransaction(async (tx) => {
    const req = (await tx.get(reqRef)).data() as VerificationRequest | undefined;
    if (!req) throw new HttpsError("not-found", "Verification request not found.");
    if (req.status !== "pending") throw new HttpsError("failed-precondition", "This request has already been reviewed.");
    tx.update(reqRef, { status: input.decision, reviewedBy: actor.uid, reviewNote: input.note || null, reviewedAt: FieldValue.serverTimestamp() });
    tx.update(userRef, { verificationStatus: input.decision, updatedAt: FieldValue.serverTimestamp() });
    writeAudit(tx, {
      actorId: actor.uid,
      actorRole: "admin",
      action: `verification.${input.decision}`,
      targetType: "user",
      targetId: input.userId,
      reason: input.note || null,
    });
  });
  // Listings carry a denormalised "verified" badge.
  try {
    await syncFarmerOnListings(input.userId, { farmerVerified: input.decision === "verified" });
  } catch (e) {
    await recordOpsError("adminReviewVerification.sync", e, { userId: input.userId });
  }
  await notify([
    {
      key: `verification_${input.decision}`,
      recipientId: input.userId,
      type: "moderation",
      title: input.decision === "verified" ? "Your account is verified" : "Verification not approved",
      message: input.decision === "verified" ? "A verified badge now shows on your profile and listings." : `${input.note || "Your request was not approved."} You can submit a new request with more details.`,
      entityType: "account",
      relatedEntityId: input.userId,
      link: "/settings",
    },
  ]);
  return { ok: true };
});

export const adminModerateProduct = callable("adminModerateProduct", adminModerateProductSchema, async (input, actor) => {
  requireAdmin(actor);
  const ref = db.collection("products").doc(input.productId);
  const cancelled: { offerId: string; buyerId: string }[] = [];
  const product = await db.runTransaction(async (tx) => {
    const p = (await tx.get(ref)).data() as Product | undefined;
    if (!p) throw new HttpsError("not-found", "Listing not found.");
    let pending: FirebaseFirestore.QuerySnapshot | null = null;
    if (input.action === "remove") {
      if (p.reservedQuantity > 0) throw new HttpsError("failed-precondition", "This listing has stock reserved for an auction. Cancel the auction first.");
      pending = await tx.get(db.collection("offers").where("productId", "==", p.productId).where("status", "==", "pending"));
    }
    const update =
      input.action === "flag"
        ? { moderationStatus: "flagged" }
        : input.action === "remove"
          ? { moderationStatus: "removed_by_admin", listingStatus: "removed" }
          : // Restored listings come back paused so the farmer decides when to sell again.
            { moderationStatus: "ok", ...(p.listingStatus === "removed" ? { listingStatus: "paused" } : {}) };
    tx.update(ref, { ...update, updatedAt: FieldValue.serverTimestamp() });
    pending?.docs.forEach((d) => {
      tx.update(d.ref, { status: "cancelled", respondedAt: FieldValue.serverTimestamp(), respondedBy: actor.uid });
      cancelled.push({ offerId: d.id, buyerId: d.get("buyerId") });
    });
    writeAudit(tx, {
      actorId: actor.uid,
      actorRole: "admin",
      action: `product.${input.action}`,
      targetType: "product",
      targetId: p.productId,
      reason: input.reason,
      metadata: { before: { listingStatus: p.listingStatus, moderationStatus: p.moderationStatus }, cancelledOffers: cancelled.map((c) => c.offerId) },
    });
    return p;
  });
  const notes: NotificationInput[] = cancelled.map((c) => ({
    key: c.offerId,
    recipientId: c.buyerId,
    type: "offer_cancelled",
    title: "Offer cancelled",
    message: `${product.name} was removed by an administrator, so your pending offer was cancelled.`,
    entityType: "offer",
    relatedEntityId: c.offerId,
    link: "/buyer/offers",
  }));
  if (input.action !== "flag") {
    notes.push({
      key: `${input.action}_${Date.now()}`,
      recipientId: product.farmerId,
      type: "moderation",
      title: input.action === "remove" ? "A listing was removed by an administrator" : "A listing was restored",
      message: input.action === "remove" ? `${product.name}: ${input.reason}` : `${product.name} is restored and paused. Reactivate it when you are ready.`,
      entityType: "product",
      relatedEntityId: product.productId,
      link: "/farmer/products",
    });
  }
  await notify(notes);
  return { ok: true };
});

export const adminResolveReport = callable("adminResolveReport", adminResolveReportSchema, async (input, actor) => {
  requireAdmin(actor);
  const ref = db.collection("reports").doc(input.reportId);
  const report = await db.runTransaction(async (tx) => {
    const r = (await tx.get(ref)).data() as Report | undefined;
    if (!r) throw new HttpsError("not-found", "Report not found.");
    const closing = input.status === "resolved" || input.status === "dismissed";
    tx.update(ref, {
      status: input.status,
      reviewedBy: actor.uid,
      resolutionNote: input.note || null,
      resolvedAt: closing ? FieldValue.serverTimestamp() : null,
    });
    writeAudit(tx, { actorId: actor.uid, actorRole: "admin", action: `report.${input.status}`, targetType: "report", targetId: r.reportId, reason: input.note || null });
    return r;
  });
  if (input.status !== "reviewing") {
    await notify([
      {
        key: `${input.reportId}_${input.status}`,
        recipientId: report.reporterId,
        type: "moderation",
        title: "Your report was reviewed",
        message: input.status === "resolved" ? `Action was taken. ${input.note}`.trim() : `No action was needed. ${input.note}`.trim(),
        entityType: "report",
        relatedEntityId: report.reportId,
        link: "/notifications",
      },
    ]);
  }
  return { ok: true };
});

export const adminUpsertCategory = callable("adminUpsertCategory", adminUpsertCategorySchema, async (input, actor) => {
  requireAdmin(actor);
  const ref = db.collection("categories").doc(input.id);
  await db.runTransaction(async (tx) => {
    const before = (await tx.get(ref)).data();
    tx.set(ref, { ...input, description: input.description || null });
    writeAudit(tx, {
      actorId: actor.uid,
      actorRole: "admin",
      action: before ? "category.updated" : "category.created",
      targetType: "category",
      targetId: input.id,
      metadata: { before: before ?? null, after: input },
    });
  });
  return { ok: true };
});

/** Records an administrator's decision on a disputed or stalled agreement, settling the committed stock. */
export const adminResolveAgreement = callable("adminResolveAgreement", adminResolveAgreementSchema, async (input, actor) => {
  requireAdmin(actor);
  const a = await db.runTransaction(async (tx) => {
    const agreement = (await tx.get(db.collection("agreements").doc(input.agreementId))).data() as Agreement | undefined;
    if (!agreement) throw new HttpsError("not-found", "Agreement not found.");
    if (agreement.status === "completed" || agreement.status === "not_completed") throw new HttpsError("failed-precondition", "This agreement is already closed.");
    await applyAgreementStatus(tx, agreement, input.status, actor.uid, `Administrator: ${input.reason}`);
    writeAudit(tx, {
      actorId: actor.uid,
      actorRole: "admin",
      action: "agreement.resolved",
      targetType: "agreement",
      targetId: agreement.agreementId,
      reason: input.reason,
      metadata: { from: agreement.status, to: input.status },
    });
    return agreement;
  });
  await notify(
    a.participantIds.map((r) => ({
      key: `${a.agreementId}_admin_${input.status}`,
      recipientId: r,
      type: "agreement_update" as const,
      title: "An administrator updated your agreement",
      message: `${a.productName}: marked ${input.status.replace("_", " ")}. ${input.reason}`,
      entityType: "agreement" as const,
      relatedEntityId: a.agreementId,
      link: `/agreements/${a.agreementId}`,
    })),
  );
  return { ok: true };
});

export const adminResolveError = callable("adminResolveError", adminResolveErrorSchema, async (input, actor) => {
  requireAdmin(actor);
  await db.collection("opsErrors").doc(input.errorId).update({ resolved: true, resolvedBy: actor.uid, resolvedAt: FieldValue.serverTimestamp() });
  return { ok: true };
});

/** Administrators may cancel an auction even after bidding has started, with a recorded reason. */
export const adminCancelAuction = callable("adminCancelAuction", cancelAuctionSchema, async (input, actor) => {
  requireAdmin(actor);
  return cancelAuctionCore(input.auctionId, actor, input.reason);
});

/** Bid details for an auction, including buyer ids, for investigating disputes. */
export const adminGetAuctionBids = callable("adminGetAuctionBids", z.object({ auctionId: id }), async (input, actor) => {
  requireAdmin(actor);
  const a = (await db.collection("auctions").doc(input.auctionId).get()).data() as Auction | undefined;
  if (!a) throw new HttpsError("not-found", "Auction not found.");
  const bids = await db.collection("bids").where("auctionId", "==", input.auctionId).orderBy("createdAt", "desc").limit(500).get();
  const buyerIds = Array.from(new Set(bids.docs.map((d) => d.get("buyerId") as string)));
  const users = buyerIds.length ? await db.getAll(...buyerIds.map((u) => db.collection("users").doc(u))) : [];
  const names = Object.fromEntries(users.map((u) => [u.id, (u.get("displayName") as string) ?? u.id]));
  const state = (await db.doc(`auctions/${input.auctionId}/private/state`).get()).data() ?? {};
  return {
    reservePrice: state.reservePrice ?? null,
    winnerId: state.winnerId ?? null,
    bids: bids.docs.map((d) => ({
      bidId: d.id,
      buyerId: d.get("buyerId"),
      buyerName: names[d.get("buyerId")],
      bidderLabel: d.get("bidderLabel"),
      amountPerUnit: d.get("amountPerUnit"),
      createdAtMs: d.get("createdAt").toMillis(),
    })),
  };
});
