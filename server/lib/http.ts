/**
 * Platform-neutral error and logging primitives for the trusted server code. The same modules run
 * inside Next.js route handlers (free Spark + Vercel deployment) and inside Cloud Functions (Blaze).
 */

export type ErrorCode =
  | "cancelled"
  | "unknown"
  | "invalid-argument"
  | "deadline-exceeded"
  | "not-found"
  | "already-exists"
  | "permission-denied"
  | "resource-exhausted"
  | "failed-precondition"
  | "aborted"
  | "out-of-range"
  | "unimplemented"
  | "internal"
  | "unavailable"
  | "data-loss"
  | "unauthenticated";

const HTTP_STATUS: Record<ErrorCode, number> = {
  cancelled: 499,
  unknown: 500,
  "invalid-argument": 400,
  "deadline-exceeded": 504,
  "not-found": 404,
  "already-exists": 409,
  "permission-denied": 403,
  "resource-exhausted": 429,
  "failed-precondition": 400,
  aborted: 409,
  "out-of-range": 400,
  unimplemented: 501,
  internal: 500,
  unavailable: 503,
  "data-loss": 500,
  unauthenticated: 401,
};

/** A safe, user-facing error. Same shape as the Cloud Functions HttpsError (code, message, details). */
export class HttpsError extends Error {
  readonly httpStatus: number;
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "HttpsError";
    this.httpStatus = HTTP_STATUS[code] ?? 500;
  }
}

/** Structured console logging (Vercel and Cloud Logging both collect stdout/stderr). Never pass secrets. */
export const logger = {
  info: (msg: string, ...rest: unknown[]) => console.log(msg, ...rest),
  warn: (msg: string, ...rest: unknown[]) => console.warn(msg, ...rest),
  error: (msg: string, ...rest: unknown[]) => console.error(msg, ...rest),
};
