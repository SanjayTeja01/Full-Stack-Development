/**
 * Security rules tests (Scenario C and related). Runs against the Firestore and Storage emulators
 * with a separate project id, so it never touches development data.
 */
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, query, where, serverTimestamp, Timestamp } from "firebase/firestore";
import { ref, uploadBytes } from "firebase/storage";

let env: RulesTestEnvironment;

const FARMER = "farmer1";
const BUYER = "buyer1";
const OTHER_BUYER = "buyer2";
const ADMIN = "admin1";
const CONV = `${BUYER}_${FARMER}_p1`;

const as = (uid: string, role: string) => env.authenticatedContext(uid, { role }).firestore();
const anon = () => env.unauthenticatedContext().firestore();

beforeAll(async () => {
  const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080").split(":");
  const [sHost, sPort] = (process.env.FIREBASE_STORAGE_EMULATOR_HOST ?? "127.0.0.1:9199").split(":");
  env = await initializeTestEnvironment({
    projectId: "demo-farmconnect-rules",
    firestore: { rules: readFileSync("firestore.rules", "utf8"), host, port: Number(port) },
    storage: { rules: readFileSync("storage.rules", "utf8"), host: sHost, port: Number(sPort) },
  });
});
afterAll(async () => env?.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const user = (id: string, role: string) => ({ userId: id, displayName: id, role, accountStatus: "active", verificationStatus: "unverified", location: { state: "Telangana", district: "Warangal" }, bio: null, profileImage: null });
    await setDoc(doc(db, "users", FARMER), user(FARMER, "farmer"));
    await setDoc(doc(db, "users", BUYER), user(BUYER, "buyer"));
    await setDoc(doc(db, "users", OTHER_BUYER), user(OTHER_BUYER, "buyer"));
    await setDoc(doc(db, "users", ADMIN), user(ADMIN, "admin"));
    await setDoc(doc(db, "users", BUYER, "private", "contact"), { email: "b@example.com", phone: "+919000000000" });
    await setDoc(doc(db, "products", "p1"), { productId: "p1", farmerId: FARMER, listingStatus: "active", availableQuantity: 100 });
    await setDoc(doc(db, "products", "pdraft"), { productId: "pdraft", farmerId: FARMER, listingStatus: "draft" });
    await setDoc(doc(db, "conversations", CONV), {
      conversationId: CONV,
      participantIds: [BUYER, FARMER],
      buyerId: BUYER,
      farmerId: FARMER,
      status: "open",
      unreadCounts: { [BUYER]: 2, [FARMER]: 0 },
      lastReadAt: {},
    });
    await setDoc(doc(db, "conversations", CONV, "messages", "m1"), { messageId: "m1", senderId: FARMER, text: "hello", messageType: "text" });
    await setDoc(doc(db, "offers", "o1"), { offerId: "o1", buyerId: BUYER, farmerId: FARMER, status: "pending" });
    await setDoc(doc(db, "auctions", "a1"), { auctionId: "a1", farmerId: FARMER, status: "live", bidVisibility: "public_anonymous", currentHighestBid: 215000 });
    await setDoc(doc(db, "auctions", "sealed"), { auctionId: "sealed", farmerId: FARMER, status: "live", bidVisibility: "sealed", currentHighestBid: null });
    await setDoc(doc(db, "auctions", "draft"), { auctionId: "draft", farmerId: FARMER, status: "draft", bidVisibility: "public_anonymous" });
    await setDoc(doc(db, "auctions", "a1", "private", "state"), { reservePrice: 300000, currentHighestBidderId: BUYER });
    await setDoc(doc(db, "auctions", "a1", "publicBids", "b1"), { amountPerUnit: 215000, bidderLabel: "Bidder 1" });
    await setDoc(doc(db, "auctions", "sealed", "publicBids", "b2"), { amountPerUnit: 240000, bidderLabel: "Bidder 1" });
    await setDoc(doc(db, "auctions", "a1", "participants", BUYER), { buyerId: BUYER, label: "Bidder 1", highestBid: 215000 });
    await setDoc(doc(db, "bids", "b1"), { bidId: "b1", auctionId: "a1", buyerId: BUYER, farmerId: FARMER, amountPerUnit: 215000 });
    await setDoc(doc(db, "agreements", "ag1"), { agreementId: "ag1", participantIds: [BUYER, FARMER], status: "agreement_recorded" });
    await setDoc(doc(db, "stockAllocations", "al1"), { allocationId: "al1", farmerId: FARMER, status: "committed" });
    await setDoc(doc(db, "notifications", "n1"), { notificationId: "n1", recipientId: BUYER, title: "t", readAt: null });
    await setDoc(doc(db, "auditLogs", "l1"), { action: "x" });
    await setDoc(doc(db, "opsErrors", "e1"), { source: "x", resolved: false });
    await setDoc(doc(db, "reports", "r1"), { reportId: "r1", reporterId: BUYER, status: "open" });
  });
});

describe("Scenario C: one buyer cannot reach another buyer's data", () => {
  it("cannot read another buyer's conversation or its messages", async () => {
    const db = as(OTHER_BUYER, "buyer");
    await assertFails(getDoc(doc(db, "conversations", CONV)));
    await assertFails(getDocs(collection(db, "conversations", CONV, "messages")));
    await assertSucceeds(getDoc(doc(as(BUYER, "buyer"), "conversations", CONV)));
  });

  it("cannot write messages directly (only through the server), even as a participant", async () => {
    const msg = (sender: string) => ({ messageId: "m2", conversationId: CONV, senderId: sender, messageType: "text", text: "hi", createdAt: serverTimestamp() });
    await assertFails(setDoc(doc(as(OTHER_BUYER, "buyer"), "conversations", CONV, "messages", "m2"), msg(OTHER_BUYER)));
    await assertFails(setDoc(doc(as(BUYER, "buyer"), "conversations", CONV, "messages", "m2"), msg(FARMER)));
    await assertFails(setDoc(doc(as(BUYER, "buyer"), "conversations", CONV, "messages", "m2"), msg(BUYER)));
  });

  it("cannot forge offer or system messages, or edit history", async () => {
    const db = as(BUYER, "buyer");
    await assertFails(
      setDoc(doc(db, "conversations", CONV, "messages", "m3"), { messageId: "m3", conversationId: CONV, senderId: BUYER, messageType: "system", text: "Offer accepted", createdAt: serverTimestamp() }),
    );
    await assertFails(updateDoc(doc(db, "conversations", CONV, "messages", "m1"), { text: "changed" }));
    await assertFails(deleteDoc(doc(db, "conversations", CONV, "messages", "m1")));
  });

  it("can only reset their own unread count", async () => {
    const db = as(BUYER, "buyer");
    await assertSucceeds(updateDoc(doc(db, "conversations", CONV), { [`unreadCounts.${BUYER}`]: 0, [`lastReadAt.${BUYER}`]: serverTimestamp() }));
    await assertFails(updateDoc(doc(db, "conversations", CONV), { [`unreadCounts.${FARMER}`]: 5 }));
    await assertFails(updateDoc(doc(db, "conversations", CONV), { status: "blocked" }));
  });

  it("cannot read another buyer's offers, bids, participation, agreements or contact details", async () => {
    const db = as(OTHER_BUYER, "buyer");
    await assertFails(getDoc(doc(db, "offers", "o1")));
    await assertFails(getDoc(doc(db, "bids", "b1")));
    await assertFails(getDoc(doc(db, "auctions", "a1", "participants", BUYER)));
    await assertFails(getDoc(doc(db, "agreements", "ag1")));
    await assertFails(getDoc(doc(db, "users", BUYER, "private", "contact")));
    await assertFails(getDoc(doc(db, "users", BUYER)));
    await assertFails(getDocs(query(collection(db, "bids"), where("auctionId", "==", "a1"))));
  });
});

describe("Scenario C: auctions cannot be manipulated directly", () => {
  it("cannot write auction state, bids or bid history", async () => {
    const db = as(BUYER, "buyer");
    await assertFails(updateDoc(doc(db, "auctions", "a1"), { currentHighestBid: 999999 }));
    await assertFails(setDoc(doc(db, "bids", "forged"), { bidId: "forged", auctionId: "a1", buyerId: BUYER, farmerId: FARMER, amountPerUnit: 1 }));
    await assertFails(setDoc(doc(db, "auctions", "a1", "publicBids", "forged"), { amountPerUnit: 1, bidderLabel: "Bidder 9" }));
    await assertFails(updateDoc(doc(db, "auctions", "a1", "private", "state"), { currentHighestBidderId: BUYER }));
    await assertFails(updateDoc(doc(as(FARMER, "farmer"), "auctions", "a1"), { status: "ended" }));
  });

  it("hides the leader and reserve price from buyers", async () => {
    await assertFails(getDoc(doc(as(BUYER, "buyer"), "auctions", "a1", "private", "state")));
    await assertSucceeds(getDoc(doc(as(FARMER, "farmer"), "auctions", "a1", "private", "state")));
  });

  it("shows public bid history, hides sealed bids until the end, hides drafts", async () => {
    await assertSucceeds(getDocs(collection(anon(), "auctions", "a1", "publicBids")));
    await assertFails(getDocs(collection(as(BUYER, "buyer"), "auctions", "sealed", "publicBids")));
    await assertSucceeds(getDocs(collection(as(FARMER, "farmer"), "auctions", "sealed", "publicBids")));
    await assertFails(getDoc(doc(anon(), "auctions", "draft")));
    await assertSucceeds(getDoc(doc(anon(), "auctions", "a1")));
  });
});

describe("trusted records are server-written only", () => {
  it("clients cannot write products, stock, offers, agreements or categories", async () => {
    const farmer = as(FARMER, "farmer");
    await assertFails(updateDoc(doc(farmer, "products", "p1"), { availableQuantity: 1000 }));
    await assertFails(setDoc(doc(farmer, "products", "p2"), { productId: "p2", farmerId: FARMER, listingStatus: "active" }));
    await assertFails(updateDoc(doc(farmer, "stockAllocations", "al1"), { status: "released" }));
    await assertFails(updateDoc(doc(as(BUYER, "buyer"), "offers", "o1"), { status: "accepted" }));
    await assertFails(updateDoc(doc(as(BUYER, "buyer"), "agreements", "ag1"), { status: "completed" }));
    await assertFails(setDoc(doc(as(ADMIN, "admin"), "categories", "x"), { id: "x" }));
  });

  it("users cannot change their own role, status or verification", async () => {
    const db = as(FARMER, "farmer");
    await assertFails(updateDoc(doc(db, "users", FARMER), { role: "admin", updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db, "users", FARMER), { verificationStatus: "verified", updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(db, "users", FARMER), { bio: "Paddy and maize grower", updatedAt: serverTimestamp() }));
    // A suspended user cannot lift their own suspension.
    await env.withSecurityRulesDisabled(async (ctx) => updateDoc(doc(ctx.firestore(), "users", FARMER), { accountStatus: "suspended" }));
    await assertFails(updateDoc(doc(db, "users", FARMER), { accountStatus: "active", updatedAt: serverTimestamp() }));
  });

  it("notifications: recipient may only mark as read", async () => {
    await assertSucceeds(updateDoc(doc(as(BUYER, "buyer"), "notifications", "n1"), { readAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(as(BUYER, "buyer"), "notifications", "n1"), { title: "changed" }));
    await assertFails(getDoc(doc(as(OTHER_BUYER, "buyer"), "notifications", "n1")));
    await assertFails(setDoc(doc(as(BUYER, "buyer"), "notifications", "n2"), { recipientId: BUYER, readAt: null }));
  });

  it("listings: drafts are private, active listings public", async () => {
    await assertSucceeds(getDoc(doc(anon(), "products", "p1")));
    await assertFails(getDoc(doc(anon(), "products", "pdraft")));
    await assertSucceeds(getDoc(doc(as(FARMER, "farmer"), "products", "pdraft")));
  });

  it("admin-only collections", async () => {
    await assertFails(getDoc(doc(as(FARMER, "farmer"), "auditLogs", "l1")));
    await assertFails(getDoc(doc(as(BUYER, "buyer"), "opsErrors", "e1")));
    await assertSucceeds(getDoc(doc(as(ADMIN, "admin"), "auditLogs", "l1")));
    await assertSucceeds(getDoc(doc(as(BUYER, "buyer"), "reports", "r1")));
    await assertFails(getDoc(doc(as(OTHER_BUYER, "buyer"), "reports", "r1")));
    await assertFails(getDoc(doc(as(BUYER, "buyer"), "unknownCollection", "x")));
  });

  it("saved items: buyers only, own list only, strict shape", async () => {
    const db = as(BUYER, "buyer");
    await assertSucceeds(setDoc(doc(db, "users", BUYER, "savedProducts", "p1"), { productId: "p1", productName: "Maize", savedAt: serverTimestamp() }));
    await assertFails(setDoc(doc(db, "users", OTHER_BUYER, "savedProducts", "p1"), { productId: "p1", productName: "Maize", savedAt: serverTimestamp() }));
    await assertFails(setDoc(doc(db, "users", BUYER, "savedProducts", "p1x"), { productId: "p1x", productName: "Maize", savedAt: serverTimestamp(), extra: true }));
    await assertFails(
      setDoc(doc(as(FARMER, "farmer"), "users", FARMER, "savedProducts", "p1"), { productId: "p1", productName: "Maize", savedAt: Timestamp.now() }),
    );
  });

  it("suspended users cannot send messages", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => updateDoc(doc(ctx.firestore(), "users", BUYER), { accountStatus: "suspended" }));
    await assertFails(
      setDoc(doc(as(BUYER, "buyer"), "conversations", CONV, "messages", "m9"), { messageId: "m9", conversationId: CONV, senderId: BUYER, messageType: "text", text: "hi", createdAt: serverTimestamp() }),
    );
  });
});

describe("storage rules", () => {
  const png = new Uint8Array([137, 80, 78, 71]);
  it("only the owning farmer can upload images to their folder", async () => {
    const farmer = env.authenticatedContext(FARMER, { role: "farmer" }).storage();
    await assertSucceeds(uploadBytes(ref(farmer, `products/${FARMER}/u1/a.png`), png, { contentType: "image/png" }));
    await assertFails(uploadBytes(ref(farmer, `products/${FARMER}/u1/a.pdf`), png, { contentType: "application/pdf" }));
    const other = env.authenticatedContext("farmer2", { role: "farmer" }).storage();
    await assertFails(uploadBytes(ref(other, `products/${FARMER}/u2/a.png`), png, { contentType: "image/png" }));
    const buyer = env.authenticatedContext(BUYER, { role: "buyer" }).storage();
    await assertFails(uploadBytes(ref(buyer, `products/${BUYER}/u3/a.png`), png, { contentType: "image/png" }));
  });
});
