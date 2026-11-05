import type { UnitId } from "./units";
import type { Currency } from "./money";

/** Structural timestamp type satisfied by both client and Admin SDK Timestamps. */
export interface Ts {
  toMillis(): number;
  toDate(): Date;
}

export type Role = "farmer" | "buyer" | "admin";
export type AccountStatus = "active" | "suspended";
export type VerificationStatus = "unverified" | "pending" | "verified" | "rejected";

export interface Location {
  state: string;
  district: string;
  village?: string;
}

/** Public profile: users/{uid}. Contains no contact details. */
export interface UserProfile {
  userId: string;
  displayName: string;
  role: Role;
  location: Location;
  organizationName?: string | null;
  bio?: string | null;
  profileImage?: string | null;
  verificationStatus: VerificationStatus;
  accountStatus: AccountStatus;
  createdAt: Ts;
  updatedAt: Ts;
}

export interface NotificationPreferences {
  messages: boolean;
  offers: boolean;
  auctions: boolean;
}

/** Private details: users/{uid}/private/contact. Owner and admins only. */
export interface PrivateContact {
  email: string;
  phone?: string | null;
  whatsappEnabled?: boolean;
  notificationPreferences: NotificationPreferences;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  examples: string[];
  sortOrder: number;
  active: boolean;
}

export type ListingStatus = "draft" | "active" | "paused" | "sold_out" | "removed";

export interface ProductImage {
  path: string;
  url: string;
}

export interface Product {
  productId: string;
  farmerId: string;
  farmerName: string;
  farmerVerified: boolean;
  name: string;
  nameLower: string;
  keywords: string[];
  categoryId: string;
  description: string;
  images: ProductImage[];
  unit: UnitId;
  /** Stock that is free to be offered, auctioned or sold. */
  availableQuantity: number;
  /** Stock reserved for scheduled or live auctions. */
  reservedQuantity: number;
  /** Stock committed to accepted offers and auction wins awaiting fulfilment. */
  committedQuantity: number;
  /** Stock reported as sold by mutual confirmation. */
  soldQuantity: number;
  pricePerUnit: number;
  normalizedPricePerQuintal: number;
  currency: Currency;
  minOrderQuantity: number;
  location: Location;
  geo?: { lat: number; lng: number } | null;
  qualityGrade?: string | null;
  qualityDetails?: string | null;
  harvestDate?: string | null;
  listingStatus: ListingStatus;
  moderationStatus: "ok" | "flagged" | "removed_by_admin";
  createdAt: Ts;
  updatedAt: Ts;
}

export type ConversationStatus = "open" | "archived" | "blocked";

export interface Conversation {
  conversationId: string;
  participantIds: string[];
  buyerId: string;
  farmerId: string;
  participantNames: Record<string, string>;
  productId: string | null;
  productName: string | null;
  status: ConversationStatus;
  blockedBy: string | null;
  archivedBy: string[];
  lastMessageAt: Ts | null;
  lastMessagePreview: string | null;
  lastMessageSenderId: string | null;
  unreadCounts: Record<string, number>;
  lastReadAt: Record<string, Ts>;
  createdAt: Ts;
  updatedAt: Ts;
}

export type MessageType = "text" | "offer" | "system";

export interface Message {
  messageId: string;
  conversationId: string;
  senderId: string;
  messageType: MessageType;
  text: string;
  relatedOfferId?: string | null;
  createdAt: Ts;
}

export type OfferStatus = "pending" | "countered" | "accepted" | "rejected" | "withdrawn" | "expired" | "cancelled";

export interface Offer {
  offerId: string;
  rootOfferId: string;
  parentOfferId: string | null;
  productId: string;
  productName: string;
  buyerId: string;
  farmerId: string;
  conversationId: string;
  /** Who proposed these terms. */
  proposedBy: string;
  /** Who must respond. */
  respondentId: string;
  quantity: number;
  unit: UnitId;
  pricePerUnit: number;
  currency: Currency;
  totalValue: number;
  message?: string | null;
  terms?: string | null;
  status: OfferStatus;
  expiresAt: Ts | null;
  createdAt: Ts;
  respondedAt: Ts | null;
  respondedBy: string | null;
  supersededBy: string | null;
  agreementId: string | null;
}

export type AuctionStatus = "draft" | "scheduled" | "live" | "ended" | "cancelled";
export type AuctionResultStatus = "pending" | "winner" | "no_bids" | "reserve_not_met" | "cancelled";
export type BidVisibility = "public_anonymous" | "sealed";

/** Public auction document. Never contains buyer ids. */
export interface Auction {
  auctionId: string;
  farmerId: string;
  farmerName: string;
  productId: string;
  productName: string;
  productImage: string | null;
  categoryId: string;
  location: Location;
  quantity: number;
  unit: UnitId;
  startingPrice: number;
  minimumIncrement: number;
  hasReservePrice: boolean;
  reserveMet: boolean | null;
  startsAt: Ts;
  endsAt: Ts;
  /** Reserved for future anti-sniping extensions; equals endsAt in v1. */
  originalEndsAt: Ts;
  extensionCount: number;
  description: string;
  conditions: string;
  bidVisibility: BidVisibility;
  status: AuctionStatus;
  currentHighestBid: number | null;
  currentHighestBidderLabel: string | null;
  bidCount: number;
  bidderCount: number;
  resultStatus: AuctionResultStatus;
  winningBid: number | null;
  winnerLabel: string | null;
  agreementId: string | null;
  cancellationReason: string | null;
  cancelledBy: string | null;
  currency: Currency;
  createdAt: Ts;
  updatedAt: Ts;
  publishedAt: Ts | null;
  finalizedAt: Ts | null;
}

/** auctions/{id}/private/state: farmer and admins only. */
export interface AuctionPrivateState {
  reservePrice: number | null;
  currentHighestBidderId: string | null;
  currentHighestBidId: string | null;
  /** Highest bid amount; for sealed auctions this is kept here until the auction ends. */
  currentHighestAmount: number | null;
  winnerId: string | null;
  allocationId: string | null;
}

/** auctions/{id}/participants/{buyerId}: the buyer, the farmer and admins. */
export interface AuctionParticipant {
  buyerId: string;
  label: string;
  joinedAt: Ts;
  highestBid: number;
  lastBidAt: Ts;
  /** Set on the winner's entry when the auction is finalised. */
  won?: boolean;
}

/** auctions/{id}/publicBids/{bidId}: anonymised bid history. */
export interface PublicBid {
  bidId: string;
  amountPerUnit: number;
  bidderLabel: string;
  createdAt: Ts;
}

export interface Bid {
  bidId: string;
  auctionId: string;
  productName: string;
  farmerId: string;
  buyerId: string;
  bidderLabel: string;
  amountPerUnit: number;
  quantity: number;
  unit: UnitId;
  status: "accepted";
  idempotencyKey: string;
  createdAt: Ts;
  acceptedAt: Ts;
}

export type AllocationStatus = "reserved" | "committed" | "released" | "fulfilled";

export interface StockAllocation {
  allocationId: string;
  productId: string;
  farmerId: string;
  referenceType: "auction" | "offer";
  referenceId: string;
  agreementId: string | null;
  quantity: number;
  unit: UnitId;
  status: AllocationStatus;
  history: { status: AllocationStatus; at: Ts; reason: string }[];
  createdAt: Ts;
  updatedAt: Ts;
  releasedAt: Ts | null;
}

export type AgreementStatus =
  | "agreement_recorded"
  | "contact_initiated"
  | "in_progress"
  | "completed"
  | "not_completed"
  | "disputed";

export interface Agreement {
  agreementId: string;
  source: "offer" | "auction";
  sourceId: string;
  productId: string;
  productName: string;
  farmerId: string;
  buyerId: string;
  participantIds: string[];
  participantNames: Record<string, string>;
  conversationId: string | null;
  allocationId: string;
  quantity: number;
  unit: UnitId;
  pricePerUnit: number;
  totalValue: number;
  currency: Currency;
  status: AgreementStatus;
  completionConfirmedBy: string[];
  statusHistory: { status: AgreementStatus; by: string; at: Ts; note: string | null }[];
  createdAt: Ts;
  updatedAt: Ts;
}

export type NotificationType =
  | "message"
  | "offer_new"
  | "offer_countered"
  | "offer_accepted"
  | "offer_rejected"
  | "offer_withdrawn"
  | "offer_expired"
  | "offer_cancelled"
  | "auction_scheduled"
  | "auction_starting"
  | "auction_started"
  | "auction_new_bid"
  | "auction_outbid"
  | "auction_ended"
  | "auction_won"
  | "auction_no_winner"
  | "auction_cancelled"
  | "listing_update"
  | "agreement_update"
  | "moderation";

export interface AppNotification {
  notificationId: string;
  recipientId: string;
  type: NotificationType;
  title: string;
  message: string;
  entityType: "conversation" | "offer" | "auction" | "product" | "agreement" | "account" | "report";
  relatedEntityId: string;
  link: string;
  createdAt: Ts;
  readAt: Ts | null;
}

export type ReportTargetType = "user" | "product" | "conversation" | "auction" | "agreement";
export type ReportStatus = "open" | "reviewing" | "resolved" | "dismissed";

export interface Report {
  reportId: string;
  reporterId: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  description: string;
  status: ReportStatus;
  reviewedBy: string | null;
  resolutionNote: string | null;
  createdAt: Ts;
  resolvedAt: Ts | null;
}

export interface AuditLog {
  auditLogId: string;
  actorId: string;
  actorRole: Role | "system";
  action: string;
  targetType: string;
  targetId: string;
  reason: string | null;
  metadata: Record<string, unknown>;
  timestamp: Ts;
}

export interface OpsError {
  errorId: string;
  source: string;
  message: string;
  context: Record<string, unknown>;
  createdAt: Ts;
  resolved: boolean;
}

export interface VerificationRequest {
  userId: string;
  displayName: string;
  note: string;
  status: "pending" | "verified" | "rejected";
  reviewedBy: string | null;
  reviewNote: string | null;
  createdAt: Ts;
  reviewedAt: Ts | null;
}
