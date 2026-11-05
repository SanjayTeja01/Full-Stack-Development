import type { Transaction } from "firebase-admin/firestore";
import { db, FieldValue, Timestamp } from "./admin";
import { writeAudit } from "./audit";
import type { AllocationStatus, StockAllocation } from "@shared/types";
import type { UnitId } from "@shared/units";
import { CURRENCY, lineTotal } from "@shared/money";

export interface AgreementInput {
  source: "offer" | "auction";
  sourceId: string;
  productId: string;
  productName: string;
  farmerId: string;
  buyerId: string;
  participantNames: Record<string, string>;
  conversationId: string | null;
  quantity: number;
  unit: UnitId;
  pricePerUnit: number;
  actorId: string;
}

/**
 * Records an agreement and its committed stock allocation in the caller's transaction.
 * Ids are derived from the source so a retried operation cannot create a second agreement.
 */
export function createAgreementInTx(tx: Transaction, a: AgreementInput, existingAllocationId?: string): { agreementId: string; allocationId: string } {
  const agreementId = `${a.source}_${a.sourceId}`;
  const allocationId = existingAllocationId ?? `alloc_${a.source}_${a.sourceId}`;
  const now = Timestamp.now();
  if (!existingAllocationId) {
    tx.set(db.collection("stockAllocations").doc(allocationId), {
      allocationId,
      productId: a.productId,
      farmerId: a.farmerId,
      referenceType: a.source,
      referenceId: a.sourceId,
      agreementId,
      quantity: a.quantity,
      unit: a.unit,
      status: "committed",
      history: [{ status: "committed", at: now, reason: "Offer accepted" }],
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      releasedAt: null,
    });
  }
  tx.set(db.collection("agreements").doc(agreementId), {
    agreementId,
    source: a.source,
    sourceId: a.sourceId,
    productId: a.productId,
    productName: a.productName,
    farmerId: a.farmerId,
    buyerId: a.buyerId,
    participantIds: [a.farmerId, a.buyerId],
    participantNames: a.participantNames,
    conversationId: a.conversationId,
    allocationId,
    quantity: a.quantity,
    unit: a.unit,
    pricePerUnit: a.pricePerUnit,
    totalValue: lineTotal(a.pricePerUnit, a.quantity),
    currency: CURRENCY,
    status: "agreement_recorded",
    completionConfirmedBy: [],
    statusHistory: [{ status: "agreement_recorded", by: a.actorId, at: now, note: null }],
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  writeAudit(tx, {
    actorId: a.actorId,
    actorRole: a.source === "auction" ? "system" : "farmer",
    action: "agreement.recorded",
    targetType: "agreement",
    targetId: agreementId,
    metadata: { source: a.source, sourceId: a.sourceId, quantity: a.quantity, pricePerUnit: a.pricePerUnit, allocationId },
  });
  return { agreementId, allocationId };
}

/** Appends a status change to an allocation's history inside a transaction. */
export function updateAllocationInTx(tx: Transaction, allocation: StockAllocation, status: AllocationStatus, reason: string, extra: Record<string, unknown> = {}) {
  tx.update(db.collection("stockAllocations").doc(allocation.allocationId), {
    status,
    history: FieldValue.arrayUnion({ status, at: Timestamp.now(), reason }),
    updatedAt: FieldValue.serverTimestamp(),
    ...(status === "released" || status === "fulfilled" ? { releasedAt: FieldValue.serverTimestamp() } : {}),
    ...extra,
  });
}
