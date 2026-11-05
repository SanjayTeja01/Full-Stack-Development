import type { AgreementStatus } from "@shared/types";
import { AGREEMENT_STATUS_LABELS } from "@shared/agreement";
import { Badge } from "@/components/ui/badge";

const TONES: Record<AgreementStatus, "neutral" | "success" | "warning" | "danger" | "info"> = {
  agreement_recorded: "info",
  contact_initiated: "info",
  in_progress: "warning",
  completed: "success",
  not_completed: "neutral",
  disputed: "danger",
};

export function AgreementStatusBadge({ status }: { status: AgreementStatus }) {
  return <Badge tone={TONES[status]}>{AGREEMENT_STATUS_LABELS[status]}</Badge>;
}
