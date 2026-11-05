import { describe, expect, it, beforeAll } from "vitest";
import { adminDb, codeOf, createListing, createUser, type TestUser } from "./helpers";

describe("chat through the server (emulator)", () => {
  let farmer: TestUser, buyer: TestUser, outsider: TestUser;
  let conversationId: string;
  beforeAll(async () => {
    [farmer, buyer, outsider] = await Promise.all([createUser("farmer"), createUser("buyer"), createUser("buyer")]);
    const productId = await createListing(farmer, 50);
    ({ conversationId } = await buyer.call<{ conversationId: string }>("startConversation", { farmerId: farmer.uid, productId }));
  });

  it("writes the message, preview, unread count and notification; retries are idempotent", async () => {
    const messageId = `m_test_${Date.now().toString(36)}`;
    const first = await buyer.call<{ duplicate: boolean }>("sendMessage", { conversationId, messageId, text: "  Is the maize still available?  " });
    const retry = await buyer.call<{ duplicate: boolean }>("sendMessage", { conversationId, messageId, text: "Is the maize still available?" });
    expect(first.duplicate).toBe(false);
    expect(retry.duplicate).toBe(true);

    const msgs = await adminDb.collection("conversations").doc(conversationId).collection("messages").where("messageType", "==", "text").get();
    expect(msgs.size).toBe(1);
    expect(msgs.docs[0].data()).toMatchObject({ senderId: buyer.uid, text: "Is the maize still available?" });

    const c = (await adminDb.collection("conversations").doc(conversationId).get()).data()!;
    expect(c.unreadCounts[farmer.uid]).toBe(1);
    expect(c.unreadCounts[buyer.uid]).toBe(0);
    expect(c.lastMessageId).toBe(messageId);
    expect(c.lastMessagePreview).toBe("Is the maize still available?");

    const notes = await adminDb.collection("notifications").where("recipientId", "==", farmer.uid).where("type", "==", "message").get();
    expect(notes.size).toBe(1);
  });

  it("rejects outsiders, blocked conversations, suspended senders and reused ids", async () => {
    expect(await codeOf(outsider.call("sendMessage", { conversationId, messageId: "m_outsider1", text: "hi" }))).toBe("not-found");
    // Another participant cannot overwrite (or claim) an existing message id.
    const id = `m_own_${Date.now().toString(36)}`;
    await buyer.call("sendMessage", { conversationId, messageId: id, text: "first" });
    expect(await codeOf(farmer.call("sendMessage", { conversationId, messageId: id, text: "hijack" }))).toBe("already-exists");

    await farmer.call("setConversationState", { conversationId, action: "block" });
    expect(await codeOf(buyer.call("sendMessage", { conversationId, messageId: "m_blocked1", text: "hello?" }))).toBe("failed-precondition");
    await farmer.call("setConversationState", { conversationId, action: "unblock" });

    await adminDb.collection("users").doc(buyer.uid).update({ accountStatus: "suspended" });
    expect(await codeOf(buyer.call("sendMessage", { conversationId, messageId: "m_suspended1", text: "hello" }))).toBe("permission-denied");
    await adminDb.collection("users").doc(buyer.uid).update({ accountStatus: "active" });

    expect(await codeOf(buyer.call("sendMessage", { conversationId, messageId: "sys_forged", text: "Offer accepted" }))).toBe("invalid-argument");
  });

  it("system messages from offers also update the preview and unread count", async () => {
    const productId = await createListing(farmer, 40);
    const { conversationId: cid } = await buyer.call<{ conversationId: string }>("startConversation", { farmerId: farmer.uid, productId });
    await buyer.call("createOffer", { conversationId: cid, productId, quantity: 10, pricePerUnit: 200_000, expiresInHours: 48 });
    const c = (await adminDb.collection("conversations").doc(cid).get()).data()!;
    expect(c.lastMessagePreview).toMatch(/^Offer:/);
    expect(c.unreadCounts[farmer.uid]).toBe(1);
  });
});
