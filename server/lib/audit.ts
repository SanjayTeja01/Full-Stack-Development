import type { Transaction, WriteBatch } from "firebase-admin/firestore";
import { db, FieldValue } from "./admin";
import type { Role } from "@shared/types";

export interface AuditEntry {
  actorId: string;
  actorRole: Role | "system";
  action: string;
  targetType: string;
  targetId: string;
  reason?: string | null;
  metadata?: Record<string, unknown>;
}

/** Writes an audit log entry as part of a transaction or batch so it commits with the change it describes. */
export function writeAudit(writer: Transaction | WriteBatch, entry: AuditEntry): void {
  const ref = db.collection("auditLogs").doc();
  const data = {
    auditLogId: ref.id,
    actorId: entry.actorId,
    actorRole: entry.actorRole,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId,
    reason: entry.reason ?? null,
    metadata: entry.metadata ?? {},
    timestamp: FieldValue.serverTimestamp(),
  };
  (writer as Transaction).set(ref, data);
}
