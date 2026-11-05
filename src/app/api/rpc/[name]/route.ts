import { after } from "next/server";
import { operations, HttpsError, catchUpIfDue } from "@server/index";
import { verifyAppCheck, verifyRequestAuth } from "@/lib/server/auth";

/**
 * Trusted operations for the free deployment path (Firebase Spark + Vercel). Every request is
 * authenticated from a verified Firebase ID token, validated with the shared Zod schemas and executed
 * with the Admin SDK on the server, exactly like the Cloud Functions transport.
 */
export const maxDuration = 30;

function errorResponse(err: HttpsError) {
  return Response.json({ error: { code: err.code, message: err.message, details: err.details ?? null } }, { status: err.httpStatus });
}

export async function POST(request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const op = operations.get(name);
  if (!op) return errorResponse(new HttpsError("not-found", "Unknown operation."));

  if (!(await verifyAppCheck(request))) return errorResponse(new HttpsError("unauthenticated", "App verification failed. Refresh the page and try again."));
  const auth = await verifyRequestAuth(request);
  if (auth === "invalid") return errorResponse(new HttpsError("unauthenticated", "Your session has expired. Please sign in again."));

  let body: { data?: unknown };
  try {
    body = (await request.json()) as { data?: unknown };
  } catch {
    return errorResponse(new HttpsError("invalid-argument", "Invalid request body."));
  }

  // Advance auction and offer timers in the background (throttled to about once a minute overall).
  after(() => catchUpIfDue());

  try {
    const result = await op.run(body?.data, { auth });
    return Response.json({ result: result ?? null });
  } catch (err) {
    return errorResponse(err instanceof HttpsError ? err : new HttpsError("internal", "The server could not complete this request. Please try again."));
  }
}
