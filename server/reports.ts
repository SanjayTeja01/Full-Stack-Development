import { HttpsError } from "./lib/http";
import { db, FieldValue } from "./lib/admin";
import { callable, requireRole } from "./lib/callable";
import { writeAudit } from "./lib/audit";
import { createReportSchema } from "@shared/schemas";

const TARGET_COLLECTION = { user: "users", product: "products", conversation: "conversations", auction: "auctions", agreement: "agreements" } as const;

/** Anyone signed in can report; one open report per reporter and target to prevent spam. */
export const createReport = callable("createReport", createReportSchema, async (input, actor) => {
  requireRole(actor, "farmer", "buyer");
  const target = await db.collection(TARGET_COLLECTION[input.targetType]).doc(input.targetId).get();
  if (!target.exists) throw new HttpsError("not-found", "The item you are reporting no longer exists.");
  if (input.targetType === "conversation" || input.targetType === "agreement") {
    const participants = (target.get("participantIds") as string[]) ?? [];
    if (!participants.includes(actor.uid)) throw new HttpsError("permission-denied", "You can only report conversations and agreements you are part of.");
  }
  const reportId = `${input.targetType}_${input.targetId}_${actor.uid}`;
  const ref = db.collection("reports").doc(reportId);
  await db.runTransaction(async (tx) => {
    const existing = await tx.get(ref);
    if (existing.exists && ["open", "reviewing"].includes(existing.get("status"))) {
      throw new HttpsError("already-exists", "You have already reported this. An administrator is reviewing it.");
    }
    tx.set(ref, {
      reportId,
      reporterId: actor.uid,
      targetType: input.targetType,
      targetId: input.targetId,
      reason: input.reason,
      description: input.description,
      status: "open",
      reviewedBy: null,
      resolutionNote: null,
      createdAt: FieldValue.serverTimestamp(),
      resolvedAt: null,
    });
    writeAudit(tx, { actorId: actor.uid, actorRole: actor.role!, action: "report.created", targetType: input.targetType, targetId: input.targetId, metadata: { reason: input.reason } });
  });
  return { reportId };
});
