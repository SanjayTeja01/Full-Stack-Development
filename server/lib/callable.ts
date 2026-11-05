import type { ZodType } from "zod";
import { db } from "./admin";
import { HttpsError } from "./http";
import { toHttpsError } from "./errors";
import type { Role, UserProfile } from "@shared/types";

export interface Actor {
  uid: string;
  role: Role | null;
  profile: UserProfile | null;
  isAdmin: boolean;
}

/** The verified caller, taken from a Firebase ID token by the transport (never from the request body). */
export interface RequestAuth {
  uid: string;
  token: { role?: unknown; email?: string; [claim: string]: unknown };
}

export interface CallRequest {
  auth: RequestAuth | null;
}

export async function loadActor(request: CallRequest): Promise<Actor> {
  if (!request.auth) throw new HttpsError("unauthenticated", "Please sign in to continue.");
  const uid = request.auth.uid;
  const claimRole = request.auth.token.role;
  const role: Role | null = claimRole === "farmer" || claimRole === "buyer" || claimRole === "admin" ? claimRole : null;
  const snap = await db.collection("users").doc(uid).get();
  const profile = snap.exists ? (snap.data() as UserProfile) : null;
  return { uid, role, profile, isAdmin: role === "admin" };
}

/** Requires one of the given roles and an active (not suspended) account. */
export function requireRole(actor: Actor, ...roles: Role[]): void {
  if (!actor.role || !roles.includes(actor.role)) {
    throw new HttpsError("permission-denied", `This action is only available to ${roles.join(" or ")} accounts.`);
  }
  if (actor.role !== "admin" && (!actor.profile || actor.profile.accountStatus !== "active")) {
    throw new HttpsError("permission-denied", "Your account is restricted. Contact support for help.");
  }
}

interface Options {
  /** Skip loading the caller (for public endpoints such as server time). */
  public?: boolean;
}

export interface Operation<R = unknown> {
  name: string;
  /** Validates input with the shared Zod schema, loads the caller and maps domain errors to safe HttpsErrors. */
  run: (data: unknown, request: CallRequest) => Promise<R>;
}

/** Every trusted operation, by name. Transports (Next.js route, Cloud Functions) expose exactly this set. */
export const operations = new Map<string, Operation>();

/**
 * Defines a trusted operation: validates input with the shared Zod schema, loads the caller from the verified
 * ID token (never from the request body) and maps domain errors to safe, user-facing errors.
 */
export function callable<S extends ZodType, R>(
  name: string,
  schema: S,
  handler: (input: S["_output"], actor: Actor, request: CallRequest) => Promise<R>,
  options: Options = {},
): Operation<R> {
  const op: Operation<R> = {
    name,
    run: async (data, request) => {
      try {
        // Authenticate before validating, so anonymous callers learn nothing about the input format.
        const actor = options.public && !request.auth ? { uid: "", role: null, profile: null, isAdmin: false } : await loadActor(request);
        const input = schema.parse(data ?? {});
        return await handler(input, actor, request);
      } catch (err) {
        throw toHttpsError(err, name);
      }
    },
  };
  if (operations.has(name)) throw new Error(`Duplicate operation ${name}`);
  operations.set(name, op as Operation);
  return op;
}
