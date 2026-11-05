import { HttpsError } from "./lib/http";
import { db, FieldValue } from "./lib/admin";
import { callable, requireRole, type Actor } from "./lib/callable";
import { writeAudit } from "./lib/audit";
import { notify, type NotificationInput } from "./lib/notify";
import { createProductSchema, setProductStatusSchema, updateProductSchema, updateStockSchema } from "@shared/schemas";
import { buildSearchKeywords } from "@shared/search";
import { normalizedPricePerQuintal } from "@shared/units";
import { setAvailable, pickStock } from "@shared/stock";
import { CURRENCY } from "@shared/money";
import type { Category, ListingStatus, Product, ProductImage } from "@shared/types";

/**
 * Images must live in the farmer's own folder, and the URL must point at that same file in one of the
 * storage services the app uploads to (Vercel Blob, Cloud Storage for Firebase, or the local emulator).
 */
function assertImagePaths(images: ProductImage[], farmerId: string) {
  for (const img of images) {
    if (!img.path.startsWith(`products/${farmerId}/`) || img.path.includes("..")) {
      throw new HttpsError("invalid-argument", "Images must be uploaded to your own product folder.");
    }
    if (!imageUrlMatchesPath(img.url, img.path)) throw new HttpsError("invalid-argument", "Image links must point to an uploaded photo.");
  }
}

function imageUrlMatchesPath(raw: string, path: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol === "https:" && url.hostname.endsWith(".public.blob.vercel-storage.com")) return url.pathname === `/${path}`;
  const firebaseObject = `/o/${encodeURIComponent(path)}`;
  if (url.protocol === "https:" && url.hostname === "firebasestorage.googleapis.com") return url.pathname.endsWith(firebaseObject);
  const emulator = process.env.FIREBASE_STORAGE_EMULATOR_HOST;
  if (process.env.FIRESTORE_EMULATOR_HOST && (url.host === emulator || ["127.0.0.1", "localhost"].includes(url.hostname))) {
    return url.pathname.endsWith(firebaseObject);
  }
  return false;
}

async function assertCategory(categoryId: string) {
  const snap = await db.collection("categories").doc(categoryId).get();
  if (!snap.exists || !(snap.data() as Category).active) throw new HttpsError("invalid-argument", "Choose a valid category.");
  return snap.data() as Category;
}

function loadOwnedProduct(product: Product | undefined, actor: Actor): Product {
  if (!product) throw new HttpsError("not-found", "This listing no longer exists.");
  if (product.farmerId !== actor.uid) throw new HttpsError("permission-denied", "You can only manage your own listings.");
  return product;
}

export const createProduct = callable("createProduct", createProductSchema, async (input, actor) => {
  requireRole(actor, "farmer");
  assertImagePaths(input.images, actor.uid);
  const category = await assertCategory(input.categoryId);
  const ref = db.collection("products").doc();
  const profile = actor.profile!;
  const product = {
    productId: ref.id,
    farmerId: actor.uid,
    farmerName: profile.displayName,
    farmerVerified: profile.verificationStatus === "verified",
    name: input.name,
    nameLower: input.name.toLowerCase(),
    keywords: buildSearchKeywords(input.name, category.name, input.location.district, input.qualityGrade),
    categoryId: input.categoryId,
    description: input.description,
    images: input.images,
    unit: input.unit,
    availableQuantity: input.availableQuantity,
    reservedQuantity: 0,
    committedQuantity: 0,
    soldQuantity: 0,
    pricePerUnit: input.pricePerUnit,
    normalizedPricePerQuintal: normalizedPricePerQuintal(input.pricePerUnit, input.unit),
    currency: CURRENCY,
    minOrderQuantity: input.minOrderQuantity,
    location: { state: input.location.state, district: input.location.district, ...(input.location.village ? { village: input.location.village } : {}) },
    geo: null,
    qualityGrade: input.qualityGrade,
    qualityDetails: input.qualityDetails,
    harvestDate: input.harvestDate,
    listingStatus: (input.publish ? "active" : "draft") as ListingStatus,
    moderationStatus: "ok",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  const batch = db.batch();
  batch.set(ref, product);
  writeAudit(batch, { actorId: actor.uid, actorRole: "farmer", action: "product.created", targetType: "product", targetId: ref.id, metadata: { status: product.listingStatus } });
  await batch.commit();
  return { productId: ref.id };
});

export const updateProduct = callable("updateProduct", updateProductSchema, async (input, actor) => {
  requireRole(actor, "farmer");
  if (input.images) assertImagePaths(input.images, actor.uid);
  const category = input.categoryId ? await assertCategory(input.categoryId) : null;
  const ref = db.collection("products").doc(input.productId);
  await db.runTransaction(async (tx) => {
    const product = loadOwnedProduct((await tx.get(ref)).data() as Product | undefined, actor);
    if (product.listingStatus === "removed") throw new HttpsError("failed-precondition", "Removed listings cannot be edited.");
    if (input.unit && input.unit !== product.unit && (product.reservedQuantity > 0 || product.committedQuantity > 0)) {
      throw new HttpsError("failed-precondition", "The unit cannot change while stock is reserved for an auction or committed to an agreement.");
    }
    const { productId: _ignored, ...fields } = input;
    void _ignored;
    const next = { ...product, ...fields } as Product;
    const categoryName = category?.name ?? (await tx.get(db.collection("categories").doc(next.categoryId))).data()?.name;
    tx.update(ref, {
      ...fields,
      ...(fields.location
        ? { location: { state: fields.location.state, district: fields.location.district, ...(fields.location.village ? { village: fields.location.village } : {}) } }
        : {}),
      ...(fields.name ? { nameLower: fields.name.toLowerCase() } : {}),
      keywords: buildSearchKeywords(next.name, categoryName, next.location.district, next.qualityGrade),
      normalizedPricePerQuintal: normalizedPricePerQuintal(next.pricePerUnit, next.unit),
      updatedAt: FieldValue.serverTimestamp(),
    });
    writeAudit(tx, {
      actorId: actor.uid,
      actorRole: "farmer",
      action: "product.updated",
      targetType: "product",
      targetId: product.productId,
      metadata: { fields: Object.keys(fields), ...(fields.pricePerUnit ? { oldPrice: product.pricePerUnit, newPrice: fields.pricePerUnit } : {}) },
    });
  });
  return { ok: true };
});

const ALLOWED_TRANSITIONS: Record<ListingStatus, ListingStatus[]> = {
  draft: ["active", "removed"],
  active: ["paused", "sold_out", "removed"],
  paused: ["active", "sold_out", "removed"],
  sold_out: ["active", "paused", "removed"],
  removed: [],
};

export const setProductStatus = callable("setProductStatus", setProductStatusSchema, async (input, actor) => {
  requireRole(actor, "farmer");
  const ref = db.collection("products").doc(input.productId);
  const cancelled: { offerId: string; buyerId: string; productName: string }[] = [];
  await db.runTransaction(async (tx) => {
    const product = loadOwnedProduct((await tx.get(ref)).data() as Product | undefined, actor);
    if (product.listingStatus === input.status) return;
    if (!ALLOWED_TRANSITIONS[product.listingStatus].includes(input.status)) {
      throw new HttpsError("failed-precondition", `A ${product.listingStatus.replace("_", " ")} listing cannot be set to ${input.status.replace("_", " ")}.`);
    }
    if (input.status === "active" && product.moderationStatus === "removed_by_admin") {
      throw new HttpsError("permission-denied", "This listing was removed by an administrator.");
    }
    let pendingOffers: FirebaseFirestore.QuerySnapshot | null = null;
    if (input.status === "removed") {
      if (product.reservedQuantity > 0 || product.committedQuantity > 0) {
        throw new HttpsError(
          "failed-precondition",
          "This listing has stock reserved for an auction or committed to an agreement. Resolve those first, or pause the listing instead.",
        );
      }
      pendingOffers = await tx.get(db.collection("offers").where("productId", "==", product.productId).where("status", "==", "pending"));
    }
    tx.update(ref, { listingStatus: input.status, updatedAt: FieldValue.serverTimestamp() });
    pendingOffers?.docs.forEach((d) => {
      tx.update(d.ref, { status: "cancelled", respondedAt: FieldValue.serverTimestamp(), respondedBy: actor.uid });
      cancelled.push({ offerId: d.id, buyerId: d.get("buyerId"), productName: product.name });
    });
    writeAudit(tx, {
      actorId: actor.uid,
      actorRole: "farmer",
      action: "product.status_changed",
      targetType: "product",
      targetId: product.productId,
      metadata: { from: product.listingStatus, to: input.status, cancelledOffers: cancelled.map((c) => c.offerId) },
    });
  });
  const notes: NotificationInput[] = cancelled.map((c) => ({
    key: c.offerId,
    recipientId: c.buyerId,
    type: "offer_cancelled",
    title: "Offer cancelled",
    message: `${c.productName} was removed by the farmer, so your pending offer was cancelled.`,
    entityType: "offer",
    relatedEntityId: c.offerId,
    link: "/buyer/offers",
  }));
  await notify(notes);
  return { ok: true };
});

/**
 * Sets the farmer's free stock. Reserved and committed stock are untouched, so this can never
 * undercut an auction or accepted agreement. `expectedAvailableQuantity` guards against overwriting
 * a change made by an offer acceptance since the farmer loaded the page.
 */
export const updateStock = callable("updateStock", updateStockSchema, async (input, actor) => {
  requireRole(actor, "farmer");
  const ref = db.collection("products").doc(input.productId);
  return db.runTransaction(async (tx) => {
    const product = loadOwnedProduct((await tx.get(ref)).data() as Product | undefined, actor);
    if (product.listingStatus === "removed") throw new HttpsError("failed-precondition", "Removed listings cannot be restocked.");
    if (product.availableQuantity !== input.expectedAvailableQuantity) {
      throw new HttpsError(
        "failed-precondition",
        `Available stock changed to ${product.availableQuantity} while you were editing (for example, an offer was accepted). Review and try again.`,
        { availableQuantity: product.availableQuantity },
      );
    }
    const next = setAvailable(pickStock(product), input.availableQuantity);
    tx.update(ref, { availableQuantity: next.availableQuantity, updatedAt: FieldValue.serverTimestamp() });
    writeAudit(tx, {
      actorId: actor.uid,
      actorRole: "farmer",
      action: "stock.adjusted",
      targetType: "product",
      targetId: product.productId,
      metadata: { from: product.availableQuantity, to: next.availableQuantity, unit: product.unit },
    });
    return { availableQuantity: next.availableQuantity };
  });
});
