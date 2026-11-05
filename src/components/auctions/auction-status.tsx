import { Badge } from "@/components/ui/badge";
import type { AuctionPhase } from "@shared/auction";
import type { Auction } from "@shared/types";

export function AuctionPhaseBadge({ phase, auction }: { phase: AuctionPhase; auction?: Pick<Auction, "resultStatus"> }) {
  switch (phase) {
    case "live":
      return (
        <Badge tone="live">
          <span className="size-1.5 rounded-full bg-white" aria-hidden /> Live
        </Badge>
      );
    case "starting_soon":
      return <Badge tone="accent">Starting soon</Badge>;
    case "upcoming":
      return <Badge tone="info">Upcoming</Badge>;
    case "closing":
      return <Badge tone="warning">Closed, result pending</Badge>;
    case "cancelled":
      return <Badge tone="neutral">Cancelled</Badge>;
    case "draft":
      return <Badge tone="neutral">Draft</Badge>;
    case "ended":
      if (auction?.resultStatus === "winner") return <Badge tone="success">Ended, winner recorded</Badge>;
      if (auction?.resultStatus === "reserve_not_met") return <Badge tone="neutral">Ended, reserve not met</Badge>;
      if (auction?.resultStatus === "no_bids") return <Badge tone="neutral">Ended, no bids</Badge>;
      return <Badge tone="neutral">Ended</Badge>;
  }
}
