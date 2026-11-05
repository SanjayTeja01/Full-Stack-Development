import { httpsCallable } from "firebase/functions";
import { FirebaseError } from "firebase/app";
import { getToken } from "firebase/app-check";
import { BACKEND_MODE, firebase } from "./client";

export class CallError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

const NETWORK_MESSAGE = "We could not reach the server. Check your connection and try again.";

/**
 * Calls a trusted server operation. Only resolves once the backend has confirmed the operation.
 * By default the operation runs in this app's API route (/api/rpc/<name>); with NEXT_PUBLIC_BACKEND_MODE=functions
 * it runs as a Cloud Function. Both run the same server code and checks.
 */
export async function call<TIn, TOut>(name: string, data: TIn): Promise<TOut> {
  return BACKEND_MODE === "functions" ? callFunction<TIn, TOut>(name, data) : callApi<TIn, TOut>(name, data);
}

function toCallError(code: string, message: string, details?: Record<string, unknown>): CallError {
  if (code === "unavailable" || code === "deadline-exceeded") return new CallError(code, NETWORK_MESSAGE, details);
  if (code === "unauthenticated") return new CallError(code, message || "Your session has expired. Please sign in again.", details);
  return new CallError(code, message || "The request failed.", details);
}

async function callApi<TIn, TOut>(name: string, data: TIn): Promise<TOut> {
  const { auth, appCheck } = firebase();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  try {
    const idToken = await auth.currentUser?.getIdToken();
    if (idToken) headers.Authorization = `Bearer ${idToken}`;
    if (appCheck) headers["X-Firebase-AppCheck"] = (await getToken(appCheck)).token;
  } catch {
    throw new CallError("unavailable", NETWORK_MESSAGE);
  }
  let response: Response;
  try {
    response = await fetch(`/api/rpc/${encodeURIComponent(name)}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ data: data ?? {} }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new CallError("unavailable", NETWORK_MESSAGE);
  }
  let body: { result?: TOut; error?: { code: string; message: string; details?: Record<string, unknown> | null } };
  try {
    body = await response.json();
  } catch {
    throw new CallError(response.status >= 500 ? "unavailable" : "unknown", NETWORK_MESSAGE);
  }
  if (!response.ok || body.error) {
    const e = body.error ?? { code: "internal", message: "" };
    throw toCallError(e.code, e.message, e.details ?? undefined);
  }
  return body.result as TOut;
}

async function callFunction<TIn, TOut>(name: string, data: TIn): Promise<TOut> {
  try {
    const fn = httpsCallable<TIn, TOut>(firebase().functions, name, { timeout: 30_000 });
    const result = await fn(data);
    return result.data;
  } catch (err) {
    if (err instanceof FirebaseError) {
      const code = err.code.replace(/^functions\//, "");
      const details = (err as FirebaseError & { details?: Record<string, unknown> }).details;
      if (code === "internal" && /fetch|network/i.test(err.message)) throw new CallError(code, NETWORK_MESSAGE, details);
      if (code === "unauthenticated") throw new CallError(code, "Your session has expired. Please sign in again.", details);
      throw toCallError(code, err.message, details);
    }
    throw new CallError("unknown", NETWORK_MESSAGE);
  }
}

export function errorMessage(err: unknown): string {
  if (err instanceof CallError) return err.message;
  if (err instanceof FirebaseError) return friendlyFirebaseMessage(err.code);
  if (err instanceof Error) return err.message;
  return "Something went wrong.";
}

export function friendlyFirebaseMessage(code: string): string {
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
    case "auth/invalid-email":
      return "The email or password is incorrect.";
    case "auth/email-already-in-use":
      return "An account with this email already exists. Try signing in instead.";
    case "auth/weak-password":
      return "Choose a stronger password (at least 8 characters).";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a few minutes and try again.";
    case "auth/network-request-failed":
    case "unavailable":
      return NETWORK_MESSAGE;
    case "auth/user-disabled":
      return "This account has been disabled. Contact support if you think this is a mistake.";
    case "auth/expired-action-code":
      return "This link has expired. Request a new one.";
    case "auth/invalid-action-code":
      return "This link is invalid or has already been used.";
    case "permission-denied":
      return "You do not have permission to do that.";
    default:
      return "Something went wrong. Please try again.";
  }
}
