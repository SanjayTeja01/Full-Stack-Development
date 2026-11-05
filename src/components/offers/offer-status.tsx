import type { OfferStatus } from "@shared/types";
import { OFFER_STATUS_LABELS } from "@shared/offer";
import { Badge } from "@/components/ui/badge";

const TONES: Record<OfferStatus, "neutral" | "success" | "warning" | "danger" | "info" | "accent"> = {
  pending: "info",
  countered: "neutral",
  accepted: "success",
  rejected: "danger",
  withdrawn: "neutral",
  expired: "warning",
  cancelled: "neutral",
};

export function OfferStatusBadge({ status }: { status: OfferStatus }) {
  return <Badge tone={TONES[status]}>{OFFER_STATUS_LABELS[status]}</Badge>;
}
