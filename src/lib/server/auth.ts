import { getAppCheck } from "firebase-admin/app-check";
import { adminAuth } from "@server/lib/admin";
import type { RequestAuth } from "@server/index";

/** Verifies the Firebase ID token sent as `Authorization: Bearer <token>`. Returns null when absent. */
export async function verifyRequestAuth(request: Request): Promise<RequestAuth | null | "invalid"> {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer (.+)$/.exec(header);
  if (!match) return "invalid";
  try {
    // checkRevoked: suspended/disabled accounts and revoked sessions are rejected immediately.
    const decoded = await adminAuth.verifyIdToken(match[1], true);
    return { uid: decoded.uid, token: decoded };
  } catch {
    return "invalid";
  }
}

/** When ENFORCE_APP_CHECK=true, requires a valid App Check token in the X-Firebase-AppCheck header. */
export async function verifyAppCheck(request: Request): Promise<boolean> {
  if (process.env.ENFORCE_APP_CHECK !== "true") return true;
  const token = request.headers.get("x-firebase-appcheck");
  if (!token) return false;
  try {
    await getAppCheck().verifyToken(token);
    return true;
  } catch {
    return false;
  }
}
