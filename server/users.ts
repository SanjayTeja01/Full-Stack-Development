import { HttpsError } from "./lib/http";
import { z } from "zod";
import { adminAuth, db, FieldValue } from "./lib/admin";
import { callable, requireRole } from "./lib/callable";
import { writeAudit } from "./lib/audit";
import { syncFarmerOnListings } from "./lib/denormalize";
import { completeRegistrationSchema, requestVerificationSchema, updateProfileSchema } from "@shared/schemas";
import type { UserProfile } from "@shared/types";

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return `+91${digits.slice(-10)}`;
}

/**
 * Assigns the farmer or buyer role as a custom claim and creates the profile.
 * The role can only be set once; admin roles are provisioned separately with the Admin SDK.
 */
export const completeRegistration = callable("completeRegistration", completeRegistrationSchema, async (input, actor, request) => {
  if (actor.role) throw new HttpsError("already-exists", "Your account is already set up.");
  const email = request.auth?.token.email;
  if (!email) throw new HttpsError("failed-precondition", "An email address is required.");

  const userRef = db.collection("users").doc(actor.uid);
  await db.runTransaction(async (tx) => {
    const existing = await tx.get(userRef);
    if (existing.exists) throw new HttpsError("already-exists", "Your account is already set up.");
    const profile = {
      userId: actor.uid,
      displayName: input.displayName,
      role: input.role,
      location: { state: input.location.state, district: input.location.district, ...(input.location.village ? { village: input.location.village } : {}) },
      organizationName: input.organizationName,
      bio: null,
      profileImage: null,
      verificationStatus: "unverified",
      accountStatus: "active",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    tx.set(userRef, profile);
    tx.set(userRef.collection("private").doc("contact"), {
      email,
      phone: normalizePhone(input.phone),
      whatsappEnabled: input.whatsappEnabled,
      notificationPreferences: { messages: true, offers: true, auctions: true },
    });
    writeAudit(tx, { actorId: actor.uid, actorRole: "system", action: "user.registered", targetType: "user", targetId: actor.uid, metadata: { role: input.role } });
  });
  await adminAuth.setCustomUserClaims(actor.uid, { role: input.role });
  await adminAuth.updateUser(actor.uid, { displayName: input.displayName });
  return { role: input.role };
});

export const updateProfile = callable("updateProfile", updateProfileSchema, async (input, actor) => {
  requireRole(actor, "farmer", "buyer", "admin");
  const userRef = db.collection("users").doc(actor.uid);
  const batch = db.batch();
  batch.update(userRef, {
    displayName: input.displayName,
    location: { state: input.location.state, district: input.location.district, ...(input.location.village ? { village: input.location.village } : {}) },
    organizationName: input.organizationName,
    bio: input.bio,
    ...(input.profileImage !== undefined ? { profileImage: input.profileImage } : {}),
    updatedAt: FieldValue.serverTimestamp(),
  });
  batch.set(
    userRef.collection("private").doc("contact"),
    { phone: normalizePhone(input.phone), whatsappEnabled: input.whatsappEnabled, notificationPreferences: input.notificationPreferences },
    { merge: true },
  );
  await batch.commit();
  if (actor.role === "farmer" && actor.profile?.displayName !== input.displayName) {
    await syncFarmerOnListings(actor.uid, { farmerName: input.displayName });
  }
  return { ok: true };
});

/** Farmers ask for verification; an administrator reviews it. The badge is never self-assigned. */
export const requestVerification = callable("requestVerification", requestVerificationSchema, async (input, actor) => {
  requireRole(actor, "farmer");
  const profile = actor.profile as UserProfile;
  if (profile.verificationStatus === "verified") throw new HttpsError("failed-precondition", "Your account is already verified.");
  if (profile.verificationStatus === "pending") throw new HttpsError("already-exists", "Your request is already being reviewed.");
  const batch = db.batch();
  batch.set(db.collection("verificationRequests").doc(actor.uid), {
    userId: actor.uid,
    displayName: profile.displayName,
    note: input.note,
    status: "pending",
    reviewedBy: null,
    reviewNote: null,
    createdAt: FieldValue.serverTimestamp(),
    reviewedAt: null,
  });
  batch.update(db.collection("users").doc(actor.uid), { verificationStatus: "pending", updatedAt: FieldValue.serverTimestamp() });
  writeAudit(batch, { actorId: actor.uid, actorRole: "farmer", action: "verification.requested", targetType: "user", targetId: actor.uid });
  await batch.commit();
  return { ok: true };
});

/** Trusted clock for countdowns. */
export const getServerTime = callable("getServerTime", z.object({}), async () => ({ now: Date.now() }), { public: true });
