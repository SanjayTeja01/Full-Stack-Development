"use client";

import * as React from "react";
import Link from "next/link";
import { limit, orderBy, where, type QueryConstraint } from "firebase/firestore";
import type { Auction } from "@shared/types";
import { auctionPhase } from "@shared/auction";
import { formatINR } from "@shared/money";
import { formatQuantity, unitShort } from "@shared/units";
import { call, errorMessage } from "@/lib/firebase/callable";
import { useServerNow } from "@/lib/hooks/use-server-clock";
import { PageHeader } from "@/components/layout/app-shell";
import { ActionDialog, FilterTabs, useAdminQuery } from "@/components/admin/admin-ui";
import { AuctionPhaseBadge } from "@/components/auctions/auction-status";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Skeleton, Spinner } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { formatDateTime } from "@/lib/format";

type Filter = "open" | "ended" | "cancelled";
type BidRow = { bidId: string; buyerId: string; buyerName: string; bidderLabel: string; amountPerUnit: number; createdAtMs: number };
type BidDetails = { reservePrice: number | null; winnerId: string | null; bids: BidRow[] };

function BidsPanel({ auction }: { auction: Auction }) {
  const [data, setData] = React.useState<BidDetails | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    call<{ auctionId: string }, BidDetails>("adminGetAuctionBids", { auctionId: auction.auctionId }).then(setData, (e) => setError(errorMessage(e)));
  }, [auction.auctionId, auction.bidCount]);
  const unit = unitShort(auction.unit);
  if (error) return <p className="text-sm text-danger">{error}</p>;
  if (!data) return <Spinner />;
  return (
    <div className="mt-3 space-y-2 text-sm">
      <p className="text-muted-foreground">Reserve price: {data.reservePrice !== null ? `${formatINR(data.reservePrice)}/${unit}` : "none"}</p>
      {data.bids.length === 0 ? (
        <p className="text-muted-foreground">No bids.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px]">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-1 font-medium">Label</th>
                <th className="py-1 font-medium">Buyer</th>
                <th className="py-1 font-medium">Amount</th>
                <th className="py-1 font-medium">Time (server)</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {data.bids.map((b) => (
                <tr key={b.bidId} className="border-t border-border">
                  <td className="py-1.5">{b.bidderLabel}</td>
                  <td>
                    {b.buyerName} {data.winnerId === b.buyerId && <span className="text-xs font-medium text-primary">(winner)</span>}
                    <span className="block font-mono text-xs text-muted-foreground">{b.buyerId}</span>
                  </td>
                  <td>
                    {formatINR(b.amountPerUnit)}/{unit}
                  </td>
                  <td>{new Date(b.createdAtMs).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "medium" })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function AdminAuctionsPage() {
  const toast = useToast();
  const [filter, setFilter] = React.useState<Filter>("open");
  const [open, setOpen] = React.useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = React.useState<Auction | null>(null);
  const { now, ready } = useServerNow(5000);
  const constraints: QueryConstraint[] =
    filter === "open"
      ? [where("status", "in", ["scheduled", "live"]), orderBy("startsAt", "asc"), limit(200)]
      : [where("status", "==", filter), orderBy("endsAt", "desc"), limit(100)];
  const { items, error } = useAdminQuery<Auction>("auctions", constraints, filter);

  return (
    <>
      <PageHeader title="Auctions and bids" description="Inspect bids with buyer identities, and cancel an auction when there is a valid reason. Cancelling returns reserved stock to the listing." />
      <FilterTabs value={filter} onChange={setFilter} options={[["open", "Scheduled and live"], ["ended", "Ended"], ["cancelled", "Cancelled"]]} />
      {error ? (
        <ErrorState message={error} />
      ) : !items || !ready ? (
        <Skeleton className="h-40" />
      ) : items.length === 0 ? (
        <EmptyState title="No auctions here" />
      ) : (
        <ul className="space-y-3">
          {items.map((a) => {
            const phase = auctionPhase({ status: a.status, startsAtMs: a.startsAt.toMillis(), endsAtMs: a.endsAt.toMillis() }, now);
            const unit = unitShort(a.unit);
            return (
              <li key={a.auctionId} className="rounded-lg border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/auctions/${a.auctionId}`} className="font-semibold hover:text-primary">
                        {a.productName}
                      </Link>
                      <AuctionPhaseBadge phase={phase} auction={a} />
                    </div>
                    <p className="text-xs text-muted-foreground tabular">
                      {a.farmerName} · {formatQuantity(a.quantity, a.unit)} · from {formatINR(a.startingPrice)}/{unit} · {a.bidCount} bids by {a.bidderCount} bidders
                      {a.winningBid !== null && ` · won at ${formatINR(a.winningBid)}/${unit}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(a.startsAt)} to {formatDateTime(a.endsAt)}
                      {a.cancellationReason && ` · cancelled by ${a.cancelledBy}: ${a.cancellationReason}`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => setOpen(open === a.auctionId ? null : a.auctionId)}>
                      {open === a.auctionId ? "Hide bids" : "Bids"}
                    </Button>
                    {(phase === "upcoming" || phase === "starting_soon" || phase === "live" || phase === "closing") && (
                      <Button size="sm" variant="danger" onClick={() => setCancelTarget(a)}>
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
                {open === a.auctionId && <BidsPanel auction={a} />}
              </li>
            );
          })}
        </ul>
      )}
      {cancelTarget && (
        <ActionDialog
          open
          onOpenChange={(o) => !o && setCancelTarget(null)}
          title={`Cancel the auction for ${cancelTarget.productName}?`}
          description={`${cancelTarget.bidCount} bids have been placed. Bidders and the farmer are notified with your reason, and the reserved stock returns to the listing. This cannot be undone.`}
          confirmLabel="Cancel auction"
          tone="danger"
          reasonLabel="Reason (shown to bidders and recorded in the audit log)"
          onSubmit={async (reason) => {
            await call("adminCancelAuction", { auctionId: cancelTarget.auctionId, reason });
            toast.success("Auction cancelled.");
          }}
        />
      )}
    </>
  );
}
