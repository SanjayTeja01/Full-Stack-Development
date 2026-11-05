import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

/**
 * Initialises the Admin SDK once per process.
 * - Cloud Functions / emulators: application default credentials and the project from the environment.
 * - Vercel (free plan path): FIREBASE_SERVICE_ACCOUNT_KEY holds the service-account JSON. It is a server-only
 *   secret: never prefix it with NEXT_PUBLIC_, never log it, never return it to a client.
 */
function init() {
  if (getApps().length) return;
  const usingEmulators = !!process.env.FIRESTORE_EMULATOR_HOST;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (raw && !usingEmulators) {
    let parsed: { project_id: string; client_email: string; private_key: string };
    try {
      parsed = JSON.parse(raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8"));
    } catch {
      throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON (or base64-encoded JSON).");
    }
    initializeApp({
      credential: cert({ projectId: parsed.project_id, clientEmail: parsed.client_email, privateKey: parsed.private_key.replace(/\\n/g, "\n") }),
      projectId: parsed.project_id,
    });
    return;
  }
  const projectId = process.env.GCLOUD_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  initializeApp(projectId ? { projectId } : undefined);
}
init();

export const db = getFirestore();
export const adminAuth = getAuth();
export { FieldValue, Timestamp };

export const REGION = "asia-south1";
