"use client";

import * as React from "react";
import Link from "next/link";
import { ClipboardList } from "lucide-react";
import type { Auction, AuctionParticipant, Bid } from "@shared/types";
import { auctionPhase, type AuctionPhase } from "@shared/auction";
import { formatINR } from "@shared/money";
import { formatQuantity, unitShort } from "@shared/units";
import { useAuth } from "@/components/auth/auth-provider";
import { subscribeAuctions, subscribeMyBids, subscribeMyParticipations } from "@/lib/data/auctions";
import { useServerNow } from "@/lib/hooks/use-server-clock";
import { PageHeader } from "@/components/layout/app-shell";
import { AuctionPhaseBadge } from "@/components/auctions/auction-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { formatDateTime, formatDuration } from "@/lib/format";

type Standing = { label: string; tone: "success" | "warning" | "neutral" | "info" };

function standingOf(a: Auction, phase: AuctionPhase, p: AuctionParticipant | undefined): Standing | null {
  if (!p) return null;
  if (phase === "ended") return p.won ? { label: "Won", tone: "success" } : { label: a.resultStatus === "winner" ? "Not won" : "No winner", tone: "neutral" };
  if (phase === "cancelled") return { label: "Cancelled", tone: "neutral" };
  if (phase === "closing") return { label: "Result pending", tone: "info" };
  if (a.bidVisibility === "sealed") return { label: "Sealed bid placed", tone: "info" };
  return a.currentHighestBidderLabel === p.label ? { label: "Highest bidder", tone: "success" } : { label: "Outbid", tone: "warning" };
}

export default function MyBidsPage() {
  const { user } = useAuth();
  const uid = user!.uid;
  const [bids, setBids] = React.useState<Bid[] | null>(null);
  const [auctions, setAuctions] = React.useState<Record<string, Auction>>({});
  const [parts, setParts] = React.useState<Record<string, AuctionParticipant>>({});
  const [error, setError] = React.useState<string | null>(null);
  const { now, ready } = useServerNow(1000);

  React.useEffect(() => subscribeMyBids(uid, setBids, (e) => setError(e.message)), [uid]);
  const ids = React.useMemo(() => Array.from(new Set((bids ?? []).map((b) => b.auctionId))).slice(0, 50), [bids]);
  const idsKey = ids.join(",");
  React.useEffect(() => {
    const list = idsKey ? idsKey.split(",") : [];
    const u1 = subscribeAuctions(list, setAuctions, () => undefined);
    const u2 = subscribeMyParticipations(list, uid, setParts, () => undefined);
    return () => {
      u1();
      u2();
    };
  }, [idsKey, uid]);

  if (error) return <ErrorState message="Your bids could not be loaded." onRetry={() => location.reload()} />;
  return (
    <>
      <PageHeader title="My bids" description="Every auction you have bid in, with your standing. Accepted bids cannot be withdrawn." />
      {!bids || !ready ? (
        <Skeleton className="h-32" />
      ) : ids.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="You have not bid in any auctions yet"
          action={
            <Button asChild variant="secondary">
              <Link href="/buyer/auctions">See live auctions</Link>
            </Button>
          }
        />
      ) : (
        <ul className="space-y-3">
          {ids.map((id) => {
            const a = auctions[id];
            const mine = bids.filter((b) => b.auctionId === id);
            const unit = unitShort(mine[0].unit);
            if (!a) return <Skeleton key={id} className="h-24" />;
            const phase = auctionPhase({ status: a.status, startsAtMs: a.startsAt.toMillis(), endsAtMs: a.endsAt.toMillis() }, now);
            const standing = standingOf(a, phase, parts[id]);
            return (
              <li key={id} className="rounded-lg border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/auctions/${id}`} className="font-semibold hover:text-primary">
                        {a.productName}
                      </Link>
                      <AuctionPhaseBadge phase={phase} auction={a} />
                      {standing && <Badge tone={standing.tone}>{standing.label}</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground tabular">
                      {formatQuantity(a.quantity, a.unit)} from {a.farmerName} · your highest {formatINR(Math.max(...mine.map((b) => b.amountPerUnit)))}/{unit}
                      {a.bidVisibility === "public_anonymous" && a.currentHighestBid !== null && phase !== "ended" && ` · current ${formatINR(a.currentHighestBid)}/${unit}`}
                      {phase === "ended" && a.winningBid !== null && ` · winning bid ${formatINR(a.winningBid)}/${unit}`}
                    </p>
                    {phase === "live" && <p className="text-xs text-muted-foreground tabular">Ends in {formatDuration(a.endsAt.toMillis() - now)}</p>}
                  </div>
                  <div className="flex gap-2">
                    {parts[id]?.won && a.agreementId ? (
                      <Button asChild size="sm">
                        <Link href={`/agreements/${a.agreementId}`}>Agreement</Link>
                      </Button>
                    ) : (
                      <Button asChild size="sm" variant={standing?.label === "Outbid" && phase === "live" ? "primary" : "secondary"}>
                        <Link href={`/auctions/${id}`}>{standing?.label === "Outbid" && phase === "live" ? "Bid again" : "View auction"}</Link>
                      </Button>
                    )}
                  </div>
                </div>
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs font-medium text-primary">Your bids ({mine.length})</summary>
                  <ol className="mt-2 space-y-1 border-l-2 border-border pl-4 text-sm">
                    {mine.map((b) => (
                      <li key={b.bidId} className="flex gap-3 tabular">
                        <span>
                          {formatINR(b.amountPerUnit)}/{unit}
                        </span>
                        <span className="text-xs text-muted-foreground">{formatDateTime(b.createdAt)}</span>
                      </li>
                    ))}
                  </ol>
                </details>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
