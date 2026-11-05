import Link from "next/link";
import { Clock, MapPin, Wheat } from "lucide-react";
import type { Auction } from "@shared/types";
import { auctionPhase, minimumNextBid } from "@shared/auction";
import { formatINR } from "@shared/money";
import { formatQuantity, unitShort } from "@shared/units";
import { AuctionPhaseBadge } from "./auction-status";
import { formatDateTime, formatDuration } from "@/lib/format";

export function AuctionCard({ auction, now }: { auction: Auction; now: number }) {
  const phase = auctionPhase({ status: auction.status, startsAtMs: auction.startsAt.toMillis(), endsAtMs: auction.endsAt.toMillis() }, now);
  const showBid = auction.bidVisibility === "public_anonymous";
  const unit = unitShort(auction.unit);
  return (
    <Link
      href={`/auctions/${auction.auctionId}`}
      className="group flex flex-col overflow-hidden rounded-lg border border-border bg-card transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="relative aspect-[16/9] overflow-hidden bg-muted">
        {auction.productImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- user uploads from Firebase Storage
          <img src={auction.productImage} alt={auction.productName} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-accent-soft to-primary-soft text-accent/60" aria-hidden>
            <Wheat className="size-10" />
          </div>
        )}
        <div className="absolute left-3 top-3">
          <AuctionPhaseBadge phase={phase} auction={auction} />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="font-semibold group-hover:text-primary">{auction.productName}</h3>
          <p className="text-sm text-muted-foreground">
            {formatQuantity(auction.quantity, auction.unit)} · {auction.farmerName}
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Starting price</dt>
            <dd className="tabular font-medium">
              {formatINR(auction.startingPrice)}/{unit}
            </dd>
          </div>
          {phase === "ended" ? (
            <div>
              <dt className="text-xs text-muted-foreground">Winning bid</dt>
              <dd className="tabular font-medium">{auction.winningBid !== null ? `${formatINR(auction.winningBid)}/${unit}` : "None"}</dd>
            </div>
          ) : showBid ? (
            <div>
              <dt className="text-xs text-muted-foreground">{auction.currentHighestBid !== null ? "Current bid" : "Minimum bid"}</dt>
              <dd className="tabular font-semibold text-primary">
                {formatINR(auction.currentHighestBid ?? auction.startingPrice)}/{unit}
              </dd>
            </div>
          ) : (
            <div>
              <dt className="text-xs text-muted-foreground">Bids</dt>
              <dd className="font-medium">Sealed</dd>
            </div>
          )}
          {phase === "live" && showBid && (
            <div className="col-span-2 text-xs text-muted-foreground">
              Next bid at least <span className="tabular font-medium text-foreground">{formatINR(minimumNextBid({ ...auction, startsAtMs: 0, endsAtMs: 0 }))}/{unit}</span>
              {" · "}
              {auction.bidCount} {auction.bidCount === 1 ? "bid" : "bids"}
            </div>
          )}
        </dl>
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <MapPin className="size-3.5" />
            {auction.location.district}
          </span>
          <span className="flex items-center gap-1 tabular">
            <Clock className="size-3.5" />
            {phase === "live" || phase === "closing"
              ? phase === "live"
                ? `Ends in ${formatDuration(auction.endsAt.toMillis() - now)}`
                : "Closed"
              : phase === "upcoming" || phase === "starting_soon"
                ? `Starts ${formatDateTime(auction.startsAt)}`
                : `Ended ${formatDateTime(auction.endsAt)}`}
          </span>
        </div>
      </div>
    </Link>
  );
}
