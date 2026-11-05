import { HttpsError, logger } from "./lib/http";
import { db, FieldValue } from "./lib/admin";
import { callable, requireRole } from "./lib/callable";
import { applyMessageToConversation, conversationIdFor } from "./lib/messages";
import { notify } from "./lib/notify";
import { writeAudit } from "./lib/audit";
import { sendMessageSchema, startConversationSchema, setConversationStateSchema } from "@shared/schemas";
import type { Conversation, Message, NotificationPreferences, Product, UserProfile } from "@shared/types";

/**
 * Buyers start conversations with farmers. One conversation per buyer, farmer and product
 * (or one general conversation without a product), so repeated clicks reuse the same thread.
 */
export const startConversation = callable("startConversation", startConversationSchema, async (input, actor) => {
  requireRole(actor, "buyer");
  const farmerSnap = await db.collection("users").doc(input.farmerId).get();
  const farmer = farmerSnap.data() as UserProfile | undefined;
  if (!farmer || farmer.role !== "farmer") throw new HttpsError("not-found", "This farmer could not be found.");
  if (farmer.accountStatus !== "active") throw new HttpsError("failed-precondition", "This farmer's account is not active.");

  let productName: string | null = null;
  if (input.productId) {
    const product = (await db.collection("products").doc(input.productId).get()).data() as Product | undefined;
    if (!product || product.farmerId !== input.farmerId || !["active", "paused", "sold_out"].includes(product.listingStatus)) {
      throw new HttpsError("not-found", "This listing is no longer available.");
    }
    productName = product.name;
  }

  const conversationId = conversationIdFor(actor.uid, input.farmerId, input.productId);
  const ref = db.collection("conversations").doc(conversationId);
  await db.runTransaction(async (tx) => {
    const existing = await tx.get(ref);
    if (existing.exists) {
      const c = existing.data() as Conversation;
      if (c.archivedBy.includes(actor.uid)) tx.update(ref, { archivedBy: FieldValue.arrayRemove(actor.uid) });
      return;
    }
    tx.set(ref, {
      conversationId,
      participantIds: [actor.uid, input.farmerId],
      buyerId: actor.uid,
      farmerId: input.farmerId,
      participantNames: {
        [actor.uid]: actor.profile!.organizationName ? `${actor.profile!.displayName} (${actor.profile!.organizationName})` : actor.profile!.displayName,
        [input.farmerId]: farmer.displayName,
      },
      productId: input.productId,
      productName,
      status: "open",
      blockedBy: null,
      archivedBy: [],
      lastMessageAt: null,
      lastMessagePreview: null,
      lastMessageSenderId: null,
      lastMessageId: null,
      unreadCounts: { [actor.uid]: 0, [input.farmerId]: 0 },
      lastReadAt: {},
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
  return { conversationId };
});

export const setConversationState = callable("setConversationState", setConversationStateSchema, async (input, actor) => {
  requireRole(actor, "farmer", "buyer");
  const ref = db.collection("conversations").doc(input.conversationId);
  await db.runTransaction(async (tx) => {
    const c = (await tx.get(ref)).data() as Conversation | undefined;
    if (!c || !c.participantIds.includes(actor.uid)) throw new HttpsError("not-found", "Conversation not found.");
    switch (input.action) {
      case "block":
        if (c.status === "blocked") return;
        tx.update(ref, { status: "blocked", blockedBy: actor.uid, updatedAt: FieldValue.serverTimestamp() });
        writeAudit(tx, { actorId: actor.uid, actorRole: actor.role!, action: "conversation.blocked", targetType: "conversation", targetId: c.conversationId });
        break;
      case "unblock":
        if (c.status !== "blocked") return;
        if (c.blockedBy !== actor.uid) throw new HttpsError("permission-denied", "Only the person who blocked this conversation can unblock it.");
        tx.update(ref, { status: "open", blockedBy: null, updatedAt: FieldValue.serverTimestamp() });
        writeAudit(tx, { actorId: actor.uid, actorRole: actor.role!, action: "conversation.unblocked", targetType: "conversation", targetId: c.conversationId });
        break;
      case "archive":
        tx.update(ref, { archivedBy: FieldValue.arrayUnion(actor.uid) });
        break;
      case "unarchive":
        tx.update(ref, { archivedBy: FieldValue.arrayRemove(actor.uid) });
        break;
    }
  });
  return { ok: true };
});

/**
 * Sends a text message. Writes the message, the conversation preview and the unread counts in one
 * transaction, then notifies the other participant. Idempotent on the client-chosen message id.
 */
export const sendMessage = callable("sendMessage", sendMessageSchema, async (input, actor) => {
  requireRole(actor, "farmer", "buyer");
  const ref = db.collection("conversations").doc(input.conversationId);
  const messageRef = ref.collection("messages").doc(input.messageId);
  const result = await db.runTransaction(async (tx) => {
    const [convSnap, existing] = await Promise.all([tx.get(ref), tx.get(messageRef)]);
    const c = convSnap.data() as Conversation | undefined;
    if (!c || !c.participantIds.includes(actor.uid)) throw new HttpsError("not-found", "Conversation not found.");
    if (existing.exists) {
      if ((existing.data() as Message).senderId !== actor.uid) throw new HttpsError("already-exists", "Message id already used.");
      return null; // a retried send that already succeeded
    }
    if (c.status !== "open") throw new HttpsError("failed-precondition", "This conversation is blocked.");
    tx.set(messageRef, {
      messageId: input.messageId,
      conversationId: input.conversationId,
      senderId: actor.uid,
      messageType: "text",
      text: input.text,
      createdAt: FieldValue.serverTimestamp(),
    });
    applyMessageToConversation(tx, input.conversationId, { messageId: input.messageId, senderId: actor.uid, text: input.text, participantIds: c.participantIds });
    return c;
  });
  if (!result) return { messageId: input.messageId, duplicate: true };

  for (const recipient of result.participantIds.filter((p) => p !== actor.uid)) {
    try {
      const prefs = (await db.collection("users").doc(recipient).collection("private").doc("contact").get()).get("notificationPreferences") as
        | NotificationPreferences
        | undefined;
      if (prefs && prefs.messages === false) continue;
      await notify([
        {
          key: input.conversationId,
          recipientId: recipient,
          type: "message",
          title: `New message from ${result.participantNames[actor.uid] ?? "a user"}`,
          message: (result.productName ? `${result.productName}: ` : "") + input.text.slice(0, 120),
          entityType: "conversation",
          relatedEntityId: input.conversationId,
          link: `/messages/${input.conversationId}`,
        },
      ]);
    } catch (e) {
      logger.warn("message notification skipped", e);
    }
  }
  return { messageId: input.messageId, duplicate: false };
});
