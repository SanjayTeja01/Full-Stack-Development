import { db, FieldValue } from "./admin";
import { recordOpsError } from "./ops";
import type { AppNotification, NotificationType } from "@shared/types";

export interface NotificationInput {
  /** Deterministic key: the same key for the same event means retries do not duplicate it. */
  key: string;
  recipientId: string;
  type: NotificationType;
  title: string;
  message: string;
  entityType: AppNotification["entityType"];
  relatedEntityId: string;
  link: string;
}

function notificationId(n: NotificationInput): string {
  return `${n.type}__${n.key}__${n.recipientId}`.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 700);
}

/**
 * Sends in-app notifications after the main operation has committed.
 * Failures are recorded for administrators and never propagate, so they cannot undo a valid bid or acceptance.
 */
export async function notify(items: NotificationInput[]): Promise<void> {
  if (!items.length) return;
  try {
    const batch = db.batch();
    for (const n of items) {
      const id = notificationId(n);
      batch.set(db.collection("notifications").doc(id), {
        notificationId: id,
        recipientId: n.recipientId,
        type: n.type,
        title: n.title,
        message: n.message,
        entityType: n.entityType,
        relatedEntityId: n.relatedEntityId,
        link: n.link,
        createdAt: FieldValue.serverTimestamp(),
        readAt: null,
      });
    }
    await batch.commit();
  } catch (err) {
    await recordOpsError("notify", err, { types: items.map((i) => i.type), keys: items.map((i) => i.key) });
  }
}

/** For events that should re-surface (e.g. new chat messages): overwrite and mark unread again. */
export async function notifyUpsert(n: NotificationInput): Promise<void> {
  return notify([n]);
}
