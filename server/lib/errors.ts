import { HttpsError, logger } from "./http";
import { ZodError } from "zod";
import { DomainError } from "@shared/errors";

/** Converts domain and validation errors into HttpsErrors with safe, user-facing messages. */
export function toHttpsError(err: unknown, context: string): HttpsError {
  if (err instanceof HttpsError) return err;
  if (err instanceof DomainError) return new HttpsError(err.code, err.message, err.details);
  if (err instanceof ZodError) {
    const first = err.issues[0];
    const path = first?.path.join(".");
    return new HttpsError("invalid-argument", first ? `${path ? `${path}: ` : ""}${first.message}` : "Invalid request.", {
      issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  }
  logger.error(`Unhandled error in ${context}`, err);
  return new HttpsError("internal", "The server could not complete this request. Please try again.");
}
