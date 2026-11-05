/** Error codes shared by Cloud Functions and the UI. Mapped to HttpsError codes on the server. */
export type DomainErrorCode =
  | "invalid-argument"
  | "failed-precondition"
  | "permission-denied"
  | "not-found"
  | "already-exists"
  | "unauthenticated"
  | "resource-exhausted";

export class DomainError extends Error {
  constructor(
    public readonly code: DomainErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export type RuleResult = { ok: true } | { ok: false; code: DomainErrorCode; message: string; details?: Record<string, unknown> };

export const OK: RuleResult = { ok: true };

export function fail(code: DomainErrorCode, message: string, details?: Record<string, unknown>): RuleResult {
  return { ok: false, code, message, details };
}

export function assertRule(result: RuleResult): void {
  if (!result.ok) throw new DomainError(result.code, result.message, result.details);
}
