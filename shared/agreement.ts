import type { AgreementStatus } from "./types";
import { fail, OK, type RuleResult } from "./errors";

export type AgreementAction = "contact_initiated" | "in_progress" | "confirm_completion" | "not_completed" | "disputed";

export const AGREEMENT_STATUS_LABELS: Record<AgreementStatus, string> = {
  agreement_recorded: "Agreement recorded",
  contact_initiated: "Contact initiated",
  in_progress: "Fulfilment in progress",
  completed: "Completed (both confirmed)",
  not_completed: "Cancelled / not completed",
  disputed: "Disputed",
};

const TERMINAL: AgreementStatus[] = ["completed", "not_completed"];

export function checkAgreementAction(status: AgreementStatus, action: AgreementAction, isAdmin: boolean): RuleResult {
  if (TERMINAL.includes(status)) return fail("failed-precondition", "This agreement is closed.");
  if (status === "disputed" && !isAdmin) {
    return fail("failed-precondition", "This agreement is under dispute review. An administrator will resolve it.");
  }
  if (action === "contact_initiated" && status !== "agreement_recorded") return fail("failed-precondition", "Contact has already been recorded.");
  return OK;
}

/** Stock effect of moving into a status. */
export function stockEffectOf(status: AgreementStatus): "fulfil" | "release" | null {
  if (status === "completed") return "fulfil";
  if (status === "not_completed") return "release";
  return null;
}
