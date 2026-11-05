import { HttpsError } from "./lib/http";
import { z } from "zod";
import { db, FieldValue, Timestamp } from "./lib/admin";
import { callable, requireRole, type Actor } from "./lib/callable";
import { writeAudit } from "./lib/audit";
import { updateAllocationInTx } from "./lib/agreements";
import { writeSystemMessage } from "./lib/messages";
import { notify } from "./lib/notify";
import { id, updateAgreementSchema } from "@shared/schemas";
import { AGREEMENT_STATUS_LABELS, checkAgreementAction } from "@shared/agreement";
import { fulfilCommitment, pickStock, releaseCommitment } from "@shared/stock";
import { DomainError } from "@shared/errors";
import type { Agreement, AgreementStatus, PrivateContact, Product, StockAllocation, UserProfile } from "@shared/types";
import type { Transaction } from "firebase-admin/firestore";

/**
 * Applies a status change and its stock effect in one transaction:
 *   completed      -> committed stock becomes sold
 *   not_completed  -> committed stock returns to available
 */
export async function applyAgreementStatus(
  tx: Transaction,
  agreement: Agreement,
  status: AgreementStatus,
  by: string,
  note: string | null,
  extra: Record<string, unknown> = {},
): Promise<void> {
  const ref = db.collection("agreements").doc(agreement.agreementId);
  if (status === "completed" || status === "not_completed") {
    const productRef = db.collection("products").doc(agreement.productId);
    const allocRef = db.collection("stockAllocations").doc(agreement.allocationId);
    const [productSnap, allocSnap] = await Promise.all([tx.get(productRef), tx.get(allocRef)]);
    const product = productSnap.data() as Product;
    const allocation = allocSnap.data() as StockAllocation;
    if (allocation.status !== "committed") throw new HttpsError("failed-precondition", "The stock for this agreement has already been settled.");
    const next = status === "completed" ? fulfilCommitment(pickStock(product), agreement.quantity) : releaseCommitment(pickStock(product), agreement.quantity);
    tx.update(productRef, { ...next, updatedAt: FieldValue.serverTimestamp() });
    updateAllocationInTx(
      tx,
      allocation,
      status === "completed" ? "fulfilled" : "released",
      status === "completed" ? "Both parties confirmed completion" : "Agreement not completed; stock returned to available",
    );
    writeAudit(tx, {
      actorId: by,
      actorRole: "system",
      action: status === "completed" ? "stock.fulfilled" : "stock.released",
      targetType: "product",
      targetId: agreement.productId,
      metadata: { agreementId: agreement.agreementId, quantity: agreement.quantity, stockAfter: next },
    });
  }
  tx.update(ref, {
    status,
    statusHistory: FieldValue.arrayUnion({ status, by, at: Timestamp.now(), note }),
    updatedAt: FieldValue.serverTimestamp(),
    ...extra,
  });
}

async function loadParticipantAgreement(tx: Transaction, agreementId: string, actor: Actor): Promise<Agreement> {
  const a = (await tx.get(db.collection("agreements").doc(agreementId))).data() as Agreement | undefined;
  if (!a || (!a.participantIds.includes(actor.uid) && !actor.isAdmin)) throw new HttpsError("not-found", "Agreement not found.");
  return a;
}

/** Either party records progress of the external transaction. Completion requires both to confirm. */
export const updateAgreementStatus = callable("updateAgreementStatus", updateAgreementSchema, async (input, actor) => {
  requireRole(actor, "farmer", "buyer");
  const result = await db.runTransaction(async (tx) => {
    const a = await loadParticipantAgreement(tx, input.agreementId, actor);
    if (!a.participantIds.includes(actor.uid)) throw new HttpsError("permission-denied", "Only the parties to this agreement can update it.");
    const check = checkAgreementAction(a.status, input.action, false);
    if (!check.ok) throw new DomainError(check.code, check.message);

    let status: AgreementStatus;
    if (input.action === "confirm_completion") {
      if (a.completionConfirmedBy.includes(actor.uid)) return { status: a.status, waiting: true, a };
      const confirmed = [...a.completionConfirmedBy, actor.uid];
      if (!a.participantIds.every((p) => confirmed.includes(p))) {
        if (a.status === "agreement_recorded" || a.status === "contact_initiated") {
          await applyAgreementStatus(tx, a, "in_progress", actor.uid, "Completion confirmed by one party", { completionConfirmedBy: confirmed });
        } else {
          tx.update(db.collection("agreements").doc(a.agreementId), { completionConfirmedBy: confirmed, updatedAt: FieldValue.serverTimestamp() });
        }
        writeAudit(tx, { actorId: actor.uid, actorRole: actor.role!, action: "agreement.completion_confirmed", targetType: "agreement", targetId: a.agreementId });
        return { status: "in_progress" as AgreementStatus, waiting: true, a };
      }
      status = "completed";
    } else {
      status = input.action;
    }
    await applyAgreementStatus(tx, a, status, actor.uid, input.note, status === "completed" ? { completionConfirmedBy: a.participantIds } : {});
    writeAudit(tx, { actorId: actor.uid, actorRole: actor.role!, action: `agreement.${status}`, targetType: "agreement", targetId: a.agreementId, reason: input.note });
    if (a.conversationId) {
      writeSystemMessage(tx, a.conversationId, {
        senderId: actor.uid,
        messageType: "system",
        text: `${a.participantNames[actor.uid]} updated the agreement to "${AGREEMENT_STATUS_LABELS[status]}".${input.note ? ` Note: ${input.note}` : ""}`,
        key: `agreement_${a.agreementId}_${status}_${actor.uid}`,
        participantIds: a.participantIds,
      });
    }
    return { status, waiting: false, a };
  });
  const other = result.a.participantIds.find((p) => p !== actor.uid)!;
  await notify([
    {
      key: `${result.a.agreementId}_${result.status}_${actor.uid}`,
      recipientId: other,
      type: "agreement_update",
      title: result.waiting ? "Please confirm completion" : "Agreement updated",
      message: result.waiting
        ? `${result.a.participantNames[actor.uid]} marked ${result.a.productName} as completed. Confirm if it is.`
        : `${result.a.productName}: ${AGREEMENT_STATUS_LABELS[result.status]}.`,
      entityType: "agreement",
      relatedEntityId: result.a.agreementId,
      link: `/agreements/${result.a.agreementId}`,
    },
  ]);
  return { status: result.status, waitingForOtherParty: result.waiting };
});

/** Reveals the other party's contact details, only to participants of an agreement. Each reveal is audited. */
export const getAgreementContacts = callable("getAgreementContacts", z.object({ agreementId: id }), async (input, actor) => {
  requireRole(actor, "farmer", "buyer", "admin");
  const a = (await db.collection("agreements").doc(input.agreementId).get()).data() as Agreement | undefined;
  if (!a || (!a.participantIds.includes(actor.uid) && !actor.isAdmin)) throw new HttpsError("not-found", "Agreement not found.");
  const targets = actor.isAdmin && !a.participantIds.includes(actor.uid) ? a.participantIds : a.participantIds.filter((p) => p !== actor.uid);
  const contacts = await Promise.all(
    targets.map(async (uid) => {
      const [profile, contact] = await Promise.all([
        db.collection("users").doc(uid).get(),
        db.collection("users").doc(uid).collection("private").doc("contact").get(),
      ]);
      const p = profile.data() as UserProfile;
      const c = contact.data() as PrivateContact;
      return {
        userId: uid,
        role: p.role,
        displayName: p.displayName,
        organizationName: p.organizationName ?? null,
        district: p.location.district,
        state: p.location.state,
        phone: c?.phone ?? null,
        email: c?.email ?? null,
        whatsappEnabled: !!c?.whatsappEnabled,
      };
    }),
  );
  const batch = db.batch();
  writeAudit(batch, { actorId: actor.uid, actorRole: actor.role!, action: "contact.revealed", targetType: "agreement", targetId: a.agreementId, metadata: { revealed: targets } });
  await batch.commit();
  return { contacts };
});
