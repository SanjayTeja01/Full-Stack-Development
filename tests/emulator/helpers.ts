/**
 * Helpers for integration tests that run against the Emulator Suite (functions, firestore, auth).
 * Users are created with the Admin SDK; trusted operations are called through the client SDK exactly
 * as the app calls them, so auth, validation and transactions are exercised end to end.
 *
 * Transport: by default operations go to the Cloud Functions emulator. Set RPC_BASE_URL (for example
 * http://localhost:3000) to send the same calls to the Next.js API route instead (the free-plan backend).
 */
import { initializeApp as initAdmin, getApps as getAdminApps } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { getFirestore as getAdminDb, FieldValue } from "firebase-admin/firestore";
import { initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";
import { connectFirestoreEmulator, getFirestore, type Firestore } from "firebase/firestore";

export const PROJECT_ID = "demo-farmconnect";
const PASSWORD = "integration-test-pw";

if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error("Integration tests must run against the emulators (FIRESTORE_EMULATOR_HOST unset).");

if (!getAdminApps().length) initAdmin({ projectId: PROJECT_ID });
export const adminDb = getAdminDb();
export const adminAuth = getAdminAuth();

export interface TestUser {
  uid: string;
  app: FirebaseApp;
  db: Firestore;
  call: <T = unknown>(name: string, data: unknown) => Promise<T>;
}

let counter = 0;
const runId = Date.now().toString(36);

export async function createUser(role: "farmer" | "buyer" | "admin", name = role): Promise<TestUser> {
  const n = ++counter;
  const email = `${role}-${runId}-${n}@test.example.com`;
  const user = await adminAuth.createUser({ email, password: PASSWORD, displayName: name, emailVerified: true });
  await adminAuth.setCustomUserClaims(user.uid, { role });
  await adminDb.collection("users").doc(user.uid).set({
    userId: user.uid,
    displayName: `${name} ${n}`,
    role,
    location: { state: "Telangana", district: "Warangal" },
    organizationName: null,
    bio: null,
    profileImage: null,
    verificationStatus: "unverified",
    accountStatus: "active",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  await adminDb.collection("users").doc(user.uid).collection("private").doc("contact").set({
    email,
    phone: "+919000000099",
    whatsappEnabled: false,
    notificationPreferences: { messages: true, offers: true, auctions: true },
  });
  const app = initializeApp({ projectId: PROJECT_ID, apiKey: "demo-key", authDomain: "localhost" }, `${role}-${n}-${runId}`);
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST ?? "127.0.0.1:9099"}`, { disableWarnings: true });
  await signInWithEmailAndPassword(auth, email, PASSWORD);
  const functions = getFunctions(app, "asia-south1");
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  const db = getFirestore(app);
  const [host, port] = process.env.FIRESTORE_EMULATOR_HOST!.split(":");
  connectFirestoreEmulator(db, host, Number(port));
  const rpcBase = process.env.RPC_BASE_URL;
  const callApi = async <T>(name: string, data: unknown): Promise<T> => {
    const token = await auth.currentUser!.getIdToken();
    const res = await fetch(`${rpcBase}/api/rpc/${name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ data }),
    });
    const body = (await res.json()) as { result?: T; error?: { code: string; message: string; details?: unknown } };
    if (body.error) throw Object.assign(new Error(body.error.message), body.error);
    return body.result as T;
  };
  return {
    uid: user.uid,
    app,
    db,
    call: rpcBase ? callApi : async <T>(name: string, data: unknown) => (await httpsCallable(functions, name)(data)).data as T,
  };
}

export async function ensureCategories() {
  const ref = adminDb.collection("categories").doc("cereals");
  if (!(await ref.get()).exists) await ref.set({ id: "cereals", name: "Cereals", examples: [], sortOrder: 1, active: true });
}

export async function createListing(farmer: TestUser, availableQuantity = 100, pricePerUnit = 200_000) {
  await ensureCategories();
  const res = await farmer.call<{ productId: string }>("createProduct", {
    name: "Test maize",
    categoryId: "cereals",
    description: "Integration test listing",
    images: [],
    unit: "quintal",
    pricePerUnit,
    minOrderQuantity: 1,
    location: { state: "Telangana", district: "Warangal" },
    availableQuantity,
    publish: true,
  });
  return res.productId;
}

export async function stockOf(productId: string) {
  const p = (await adminDb.collection("products").doc(productId).get()).data()!;
  return { available: p.availableQuantity, reserved: p.reservedQuantity, committed: p.committedQuantity, sold: p.soldQuantity };
}

/** Error code from a callable rejection, without the "functions/" prefix. */
export async function codeOf(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return "ok";
  } catch (e) {
    return String((e as { code?: string }).code ?? "unknown").replace(/^functions\//, "");
  }
}
