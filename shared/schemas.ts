import { z } from "zod";
import { UNIT_IDS } from "./units";
import { INDIAN_STATES } from "./categories";
import { OFFER_EXPIRY_OPTIONS_HOURS } from "./offer";

/** Input schemas for every trusted operation. Used by forms (client) and Cloud Functions (server). */

const trimmed = (min: number, max: number, label: string) =>
  z.string().trim().min(min, `${label} must be at least ${min} characters`).max(max, `${label} must be at most ${max} characters`);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be at most ${max} characters`)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

export const id = z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/, "Invalid id");
export const paise = z.number().int("Amount must be in whole paise").positive("Amount must be greater than zero").max(1_000_000_000_00);
export const wholeQuantity = z.number().int("Quantity must be a whole number").positive("Quantity must be greater than zero").max(10_000_000);
export const unitSchema = z.enum(UNIT_IDS as [string, ...string[]]).transform((u) => u as (typeof UNIT_IDS)[number]);

export const locationSchema = z.object({
  state: z.enum(INDIAN_STATES, { message: "Select a state" }),
  district: trimmed(2, 60, "District"),
  village: optionalText(60).transform((v) => v ?? undefined),
});

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^(\+91[\s-]?)?[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number");

export const completeRegistrationSchema = z.object({
  role: z.enum(["farmer", "buyer"]),
  displayName: trimmed(2, 60, "Name"),
  phone: phoneSchema,
  whatsappEnabled: z.boolean().default(false),
  location: locationSchema,
  organizationName: optionalText(100),
});
export type CompleteRegistrationInput = z.input<typeof completeRegistrationSchema>;

export const updateProfileSchema = z.object({
  displayName: trimmed(2, 60, "Name"),
  phone: phoneSchema,
  whatsappEnabled: z.boolean(),
  location: locationSchema,
  organizationName: optionalText(100),
  bio: optionalText(500),
  profileImage: z.string().url().max(2048).nullable().optional(),
  notificationPreferences: z.object({ messages: z.boolean(), offers: z.boolean(), auctions: z.boolean() }),
});
export type UpdateProfileInput = z.input<typeof updateProfileSchema>;

export const productImageSchema = z.object({
  path: z.string().max(512),
  url: z.string().url().max(2048),
});

export const productFieldsSchema = z.object({
  name: trimmed(2, 80, "Product name"),
  categoryId: id,
  description: trimmed(10, 2000, "Description"),
  images: z.array(productImageSchema).max(6, "At most 6 images"),
  unit: unitSchema,
  pricePerUnit: paise,
  minOrderQuantity: wholeQuantity.default(1),
  location: locationSchema,
  qualityGrade: optionalText(60),
  qualityDetails: optionalText(500),
  harvestDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
    .optional()
    .nullable()
    .transform((v) => v ?? null),
});

export const createProductSchema = productFieldsSchema.extend({
  availableQuantity: z.number().int().min(0).max(10_000_000),
  publish: z.boolean(),
});
export type CreateProductInput = z.input<typeof createProductSchema>;

export const updateProductSchema = productFieldsSchema.partial().extend({ productId: id });
export type UpdateProductInput = z.input<typeof updateProductSchema>;

export const setProductStatusSchema = z.object({
  productId: id,
  status: z.enum(["active", "paused", "sold_out", "removed"]),
});

export const updateStockSchema = z.object({
  productId: id,
  availableQuantity: z.number().int().min(0).max(10_000_000),
  expectedAvailableQuantity: z.number().int().min(0),
});

export const startConversationSchema = z.object({
  farmerId: id,
  productId: id.nullable().optional().transform((v) => v ?? null),
});

export const createOfferSchema = z.object({
  conversationId: id,
  productId: id,
  quantity: wholeQuantity,
  pricePerUnit: paise,
  message: optionalText(500),
  terms: optionalText(1000),
  expiresInHours: z
    .number()
    .refine((h) => (OFFER_EXPIRY_OPTIONS_HOURS as readonly number[]).includes(h), "Invalid expiry")
    .nullable(),
});
export type CreateOfferInput = z.input<typeof createOfferSchema>;

export const respondToOfferSchema = z.discriminatedUnion("action", [
  z.object({ offerId: id, action: z.literal("accept") }),
  z.object({ offerId: id, action: z.literal("reject"), message: optionalText(500) }),
  z.object({ offerId: id, action: z.literal("withdraw") }),
  z.object({
    offerId: id,
    action: z.literal("counter"),
    quantity: wholeQuantity,
    pricePerUnit: paise,
    message: optionalText(500),
    terms: optionalText(1000),
    expiresInHours: z
      .number()
      .refine((h) => (OFFER_EXPIRY_OPTIONS_HOURS as readonly number[]).includes(h), "Invalid expiry")
      .nullable(),
  }),
]);
export type RespondToOfferInput = z.input<typeof respondToOfferSchema>;

export const auctionFieldsSchema = z.object({
  productId: id,
  quantity: wholeQuantity,
  startingPrice: paise,
  minimumIncrement: paise,
  reservePrice: paise.nullable(),
  startsAtMs: z.number().int().positive(),
  endsAtMs: z.number().int().positive(),
  description: trimmed(0, 1000, "Description"),
  conditions: trimmed(0, 2000, "Conditions"),
  bidVisibility: z.enum(["public_anonymous", "sealed"]).default("public_anonymous"),
});

export const createAuctionSchema = auctionFieldsSchema.extend({ publish: z.boolean() });
export type CreateAuctionInput = z.input<typeof createAuctionSchema>;

export const updateAuctionDraftSchema = auctionFieldsSchema.extend({ auctionId: id });
export const publishAuctionSchema = z.object({ auctionId: id });
export const cancelAuctionSchema = z.object({ auctionId: id, reason: trimmed(5, 500, "Reason") });

export const placeBidSchema = z.object({
  auctionId: id,
  amountPerUnit: paise,
  idempotencyKey: z.string().regex(/^[A-Za-z0-9-]{8,64}$/, "Invalid request id"),
});
export type PlaceBidInput = z.input<typeof placeBidSchema>;

export const updateAgreementSchema = z.object({
  agreementId: id,
  action: z.enum(["contact_initiated", "in_progress", "confirm_completion", "not_completed", "disputed"]),
  note: optionalText(500),
});

export const createReportSchema = z.object({
  targetType: z.enum(["user", "product", "conversation", "auction", "agreement"]),
  targetId: id,
  reason: z.enum(["misleading_listing", "prohibited_item", "fraud", "harassment", "spam", "bid_manipulation", "non_fulfilment", "other"]),
  description: trimmed(10, 2000, "Description"),
});

export const setConversationStateSchema = z.object({
  conversationId: id,
  action: z.enum(["block", "unblock", "archive", "unarchive"]),
});

/** The client picks the message id and reuses it on retry, so a resend can never post a duplicate. */
export const sendMessageSchema = z.object({
  conversationId: id,
  messageId: z.string().regex(/^m_[A-Za-z0-9_-]{4,100}$/, "Invalid message id"),
  text: trimmed(1, 2000, "Message"),
});

export const requestVerificationSchema = z.object({ note: trimmed(10, 1000, "Note") });

export const adminSetAccountStatusSchema = z.object({
  userId: id,
  status: z.enum(["active", "suspended"]),
  reason: trimmed(5, 500, "Reason"),
});
export const adminReviewVerificationSchema = z.object({
  userId: id,
  decision: z.enum(["verified", "rejected"]),
  note: trimmed(0, 500, "Note"),
});
export const adminModerateProductSchema = z.object({
  productId: id,
  action: z.enum(["flag", "remove", "restore"]),
  reason: trimmed(5, 500, "Reason"),
});
export const adminResolveReportSchema = z.object({
  reportId: id,
  status: z.enum(["reviewing", "resolved", "dismissed"]),
  note: trimmed(0, 1000, "Note"),
});
export const adminUpsertCategorySchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{2,40}$/, "Use lowercase letters, numbers and dashes"),
  name: trimmed(2, 60, "Name"),
  description: trimmed(0, 300, "Description"),
  examples: z.array(trimmed(1, 40, "Example")).max(20),
  sortOrder: z.number().int().min(0).max(1000),
  active: z.boolean(),
});
export const adminResolveAgreementSchema = z.object({
  agreementId: id,
  status: z.enum(["in_progress", "completed", "not_completed"]),
  reason: trimmed(5, 500, "Reason"),
});
export const adminResolveErrorSchema = z.object({ errorId: id });
