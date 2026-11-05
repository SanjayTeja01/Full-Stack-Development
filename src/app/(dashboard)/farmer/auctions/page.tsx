"use client";

import * as React from "react";
import Link from "next/link";
import { Gavel, Plus } from "lucide-react";
import type { Auction } from "@shared/types";
import { auctionPhase, type AuctionPhase } from "@shared/auction";
import { formatINR } from "@shared/money";
import { formatQuantity, unitShort } from "@shared/units";
import { useAuth } from "@/components/auth/auth-provider";
import { subscribeFarmerAuctions } from "@/lib/data/auctions";
import { useServerNow } from "@/lib/hooks/use-server-clock";
import { call, errorMessage } from "@/lib/firebase/callable";
import { PageHeader } from "@/components/layout/app-shell";
import { AuctionPhaseBadge } from "@/components/auctions/auction-status";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { formatDateTime, formatDuration } from "@/lib/format";

type Tab = "active" | "draft" | "ended" | "cancelled";
const tabOf = (p: AuctionPhase): Tab => (p === "draft" ? "draft" : p === "cancelled" ? "cancelled" : p === "ended" ? "ended" : "active");

export default function FarmerAuctionsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [items, setItems] = React.useState<Auction[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState<Tab>("active");
  const [busy, setBusy] = React.useState<string | null>(null);
  const { now, ready } = useServerNow(1000);
  React.useEffect(() => subscribeFarmerAuctions(user!.uid, setItems, (e) => setError(e.message)), [user]);

  const phased = React.useMemo(
    () => (items ?? []).map((a) => ({ a, phase: auctionPhase({ status: a.status, startsAtMs: a.startsAt.toMillis(), endsAtMs: a.endsAt.toMillis() }, now) })),
    [items, now],
  );
  const visible = phased.filter((x) => tabOf(x.phase) === tab);

  const publish = async (a: Auction) => {
    setBusy(a.auctionId);
    try {
      const res = await call<{ auctionId: string }, { status: string }>("publishAuction", { auctionId: a.auctionId });
      toast.success(res.status === "live" ? "Your auction is live." : "Auction scheduled.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageHeader
        title="My auctions"
        description="Auctions reserve stock from your listings while they run."
        actions={
          <Button asChild>
            <Link href="/farmer/auctions/new">
              <Plus /> Create auction
            </Link>
          </Button>
        }
      />
      {error ? (
        <ErrorState message="Your auctions could not be loaded." onRetry={() => location.reload()} />
      ) : (
        <>
          <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
            <TabsList className="mb-4">
              {(
                [
                  ["active", "Scheduled and live"],
                  ["draft", "Drafts"],
                  ["ended", "Ended"],
                  ["cancelled", "Cancelled"],
                ] as [Tab, string][]
              ).map(([v, l]) => (
                <TabsTrigger key={v} value={v}>
                  {l} {items && ready && <span className="ml-1 text-xs text-muted-foreground tabular">{phased.filter((x) => tabOf(x.phase) === v).length}</span>}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          {!items || !ready ? (
            <Skeleton className="h-32" />
          ) : visible.length === 0 ? (
            <EmptyState icon={Gavel} title="No auctions here" description="Create an auction from one of your active listings." />
          ) : (
            <ul className="space-y-3">
              {visible.map(({ a, phase }) => {
                const unit = unitShort(a.unit);
                return (
                  <li key={a.auctionId} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{a.productName}</span>
                        <AuctionPhaseBadge phase={phase} auction={a} />
                      </div>
                      <p className="text-sm text-muted-foreground tabular">
                        {formatQuantity(a.quantity, a.unit)} · from {formatINR(a.startingPrice)}/{unit} · {a.bidCount} {a.bidCount === 1 ? "bid" : "bids"}
                        {a.currentHighestBid !== null && ` · highest ${formatINR(a.currentHighestBid)}/${unit}`}
                        {a.winningBid !== null && ` · won at ${formatINR(a.winningBid)}/${unit}`}
                      </p>
                      <p className="text-xs text-muted-foreground tabular">
                        {phase === "live"
                          ? `Ends in ${formatDuration(a.endsAt.toMillis() - now)}`
                          : phase === "upcoming" || phase === "starting_soon"
                            ? `Starts ${formatDateTime(a.startsAt)}`
                            : `${formatDateTime(a.startsAt)} to ${formatDateTime(a.endsAt)}`}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {a.status === "draft" ? (
                        <>
                          <Button asChild size="sm" variant="secondary">
                            <Link href={`/farmer/auctions/${a.auctionId}/edit`}>Edit</Link>
                          </Button>
                          <Button size="sm" onClick={() => publish(a)} loading={busy === a.auctionId}>
                            Publish
                          </Button>
                        </>
                      ) : (
                        <>
                          {a.agreementId && (
                            <Button asChild size="sm">
                              <Link href={`/agreements/${a.agreementId}`}>Agreement</Link>
                            </Button>
                          )}
                          <Button asChild size="sm" variant="secondary">
                            <Link href={`/auctions/${a.auctionId}`}>View</Link>
                          </Button>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </>
  );
}
