/**
 * Seeds the LOCAL EMULATOR with reference data and demo accounts.
 * Refuses to run against a real project.
 *
 *   npm run seed            categories + admin + demo farmer/buyer accounts
 *
 * Demo accounts are clearly named "Demo ..." and use @example.com addresses. No listings,
 * bids or other activity are fabricated; create those through the app.
 */
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { DEFAULT_CATEGORIES } from "../shared/categories";

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.error("Refusing to seed: FIRESTORE_EMULATOR_HOST and FIREBASE_AUTH_EMULATOR_HOST must be set (run via `npm run seed`).");
  process.exit(1);
}

const projectId = process.env.GCLOUD_PROJECT || "demo-farmconnect";
initializeApp({ projectId });
const db = getFirestore();
const auth = getAuth();

const PASSWORD = "farmconnect-demo";

async function ensureUser(email: string, displayName: string, role: "farmer" | "buyer" | "admin", extra: { state: string; district: string; org?: string; phone: string }) {
  let user;
  try {
    user = await auth.getUserByEmail(email);
  } catch {
    user = await auth.createUser({ email, password: PASSWORD, displayName, emailVerified: true });
  }
  await auth.setCustomUserClaims(user.uid, { role });
  const ref = db.collection("users").doc(user.uid);
  await ref.set({
    userId: user.uid,
    displayName,
    role,
    location: { state: extra.state, district: extra.district },
    organizationName: extra.org ?? null,
    bio: null,
    profileImage: null,
    verificationStatus: "unverified",
    accountStatus: "active",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  await ref.collection("private").doc("contact").set({
    email,
    phone: extra.phone,
    whatsappEnabled: true,
    notificationPreferences: { messages: true, offers: true, auctions: true },
  });
  return user.uid;
}

async function main() {
  const batch = db.batch();
  for (const c of DEFAULT_CATEGORIES) batch.set(db.collection("categories").doc(c.id), c);
  await batch.commit();
  console.log(`Seeded ${DEFAULT_CATEGORIES.length} categories.`);

  await ensureUser("admin@example.com", "Demo Administrator", "admin", { state: "Telangana", district: "Hyderabad", phone: "+919000000001" });
  await ensureUser("farmer@example.com", "Demo Farmer (Ramesh)", "farmer", { state: "Andhra Pradesh", district: "Guntur", phone: "+919000000002" });
  await ensureUser("buyer@example.com", "Demo Buyer (Lakshmi Traders)", "buyer", {
    state: "Telangana",
    district: "Warangal",
    org: "Lakshmi Traders (demo)",
    phone: "+919000000003",
  });
  await ensureUser("buyer2@example.com", "Demo Buyer 2 (Sri Mills)", "buyer", { state: "Karnataka", district: "Raichur", org: "Sri Mills (demo)", phone: "+919000000004" });
  console.log(`Demo accounts ready. Password for all: ${PASSWORD}`);
  console.log("  admin@example.com, farmer@example.com, buyer@example.com, buyer2@example.com");
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
