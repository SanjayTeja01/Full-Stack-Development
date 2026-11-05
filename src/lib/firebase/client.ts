import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaEnterpriseProvider, ReCaptchaV3Provider, type AppCheck } from "firebase/app-check";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore, type Firestore } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions, type Functions } from "firebase/functions";
import { connectStorageEmulator, getStorage, type FirebaseStorage } from "firebase/storage";

/**
 * Public web configuration only. These values identify the Firebase project and are safe in the browser;
 * access control comes from Security Rules and the server code, never from hiding these.
 */
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "demo-api-key",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "demo-farmconnect.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "demo-farmconnect",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "demo-farmconnect.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || undefined,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || undefined,
};

export const FUNCTIONS_REGION = process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_REGION || "asia-south1";
export const USE_EMULATORS = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true";
const EMULATOR_HOST = process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_HOST || "127.0.0.1";
const APP_CHECK_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY;
const APP_CHECK_V3_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_V3_SITE_KEY;
/** "api" (default): trusted operations run in this app's Next.js API routes (free plan). "functions": Cloud Functions (Blaze). */
/**
 * Where product photos are stored. "blob" (default in production): Vercel Blob, free on the Hobby plan.
 * "firebase": Cloud Storage for Firebase (needs Blaze for new buckets; always used with the local emulators).
 */
export const IMAGE_STORAGE: "blob" | "firebase" =
  process.env.NEXT_PUBLIC_IMAGE_STORAGE === "firebase" || process.env.NEXT_PUBLIC_IMAGE_STORAGE === "blob"
    ? process.env.NEXT_PUBLIC_IMAGE_STORAGE
    : USE_EMULATORS
      ? "firebase"
      : "blob";
export const BACKEND_MODE: "api" | "functions" = process.env.NEXT_PUBLIC_BACKEND_MODE === "functions" ? "functions" : "api";

interface Services {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  functions: Functions;
  storage: FirebaseStorage;
  appCheck: AppCheck | null;
}

let services: Services | null = null;

export function firebase(): Services {
  if (services) return services;
  const fresh = !getApps().length;
  const app = fresh ? initializeApp(config) : getApp();
  // App Check attests that requests come from this web app. The server enforces it when ENFORCE_APP_CHECK=true.
  let appCheck: AppCheck | null = null;
  if (fresh && (APP_CHECK_SITE_KEY || APP_CHECK_V3_SITE_KEY) && !USE_EMULATORS && typeof window !== "undefined") {
    const provider = APP_CHECK_SITE_KEY ? new ReCaptchaEnterpriseProvider(APP_CHECK_SITE_KEY) : new ReCaptchaV3Provider(APP_CHECK_V3_SITE_KEY!);
    appCheck = initializeAppCheck(app, { provider, isTokenAutoRefreshEnabled: true });
  }
  const auth = getAuth(app);
  const db = getFirestore(app);
  const functions = getFunctions(app, FUNCTIONS_REGION);
  const storage = getStorage(app);
  if (USE_EMULATORS) {
    connectAuthEmulator(auth, `http://${EMULATOR_HOST}:9099`, { disableWarnings: true });
    connectFirestoreEmulator(db, EMULATOR_HOST, 8080);
    connectFunctionsEmulator(functions, EMULATOR_HOST, 5001);
    connectStorageEmulator(storage, EMULATOR_HOST, 9199);
  }
  services = { app, auth, db, functions, storage, appCheck };
  return services;
}
