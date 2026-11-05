import type { Transaction } from "firebase-admin/firestore";
import { db, FieldValue } from "./admin";

/**
 * Updates the conversation preview and the other participants' unread counts for a new message.
 * Uses a merge write (no read), so it can be called after other reads in any transaction.
 */
export function applyMessageToConversation(
  tx: Transaction,
  conversationId: string,
  m: { messageId: string; senderId: string; text: string; participantIds: string[] },
): void {
  const unreadCounts: Record<string, FirebaseFirestore.FieldValue> = {};
  m.participantIds.filter((p) => p !== m.senderId).forEach((p) => (unreadCounts[p] = FieldValue.increment(1)));
  tx.set(
    db.collection("conversations").doc(conversationId),
    {
      unreadCounts,
      lastMessageAt: FieldValue.serverTimestamp(),
      lastMessagePreview: m.text.slice(0, 140),
      lastMessageSenderId: m.senderId,
      lastMessageId: m.messageId,
      archivedBy: [],
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

/** Writes a structured (offer/system) message into a conversation as part of a transaction. */
export function writeSystemMessage(
  tx: Transaction,
  conversationId: string,
  m: { senderId: string; messageType: "offer" | "system"; text: string; relatedOfferId?: string | null; key: string; participantIds: string[] },
): void {
  // Deterministic id so a retried operation cannot post the same event twice.
  const id = `sys_${m.key}`.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 200);
  const ref = db.collection("conversations").doc(conversationId).collection("messages").doc(id);
  tx.set(ref, {
    messageId: id,
    conversationId,
    senderId: m.senderId,
    messageType: m.messageType,
    text: m.text,
    relatedOfferId: m.relatedOfferId ?? null,
    createdAt: FieldValue.serverTimestamp(),
  });
  applyMessageToConversation(tx, conversationId, { messageId: id, senderId: m.senderId, text: m.text, participantIds: m.participantIds });
}

export function conversationIdFor(buyerId: string, farmerId: string, productId: string | null): string {
  return `${buyerId}_${farmerId}_${productId ?? "general"}`;
}
