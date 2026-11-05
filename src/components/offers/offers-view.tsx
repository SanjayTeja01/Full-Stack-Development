"use client";

import * as React from "react";
import Link from "next/link";
import { Tags } from "lucide-react";
import type { Offer, OfferStatus } from "@shared/types";
import { formatINR } from "@shared/money";
import { formatQuantity, unitShort } from "@shared/units";
import { useAuth } from "@/components/auth/auth-provider";
import { subscribeMyOffers } from "@/lib/data/chat";
import { useServerNow } from "@/lib/hooks/use-server-clock";
import { OfferStatusBadge } from "./offer-status";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";

type Group = "action" | OfferStatus;

/** Offers grouped by negotiation (root offer). The latest round decides the group's status. */
export function OffersView() {
  const { user, role } = useAuth();
  const uid = user!.uid;
  const tradeRole = role === "farmer" ? "farmer" : "buyer";
  const [offers, setOffers] = React.useState<Offer[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState<Group>("action");
  const { now } = useServerNow(30_000);

  React.useEffect(() => subscribeMyOffers(uid, tradeRole, setOffers, (e) => setError(e.message)), [uid, tradeRole]);

  const chains = React.useMemo(() => {
    const map = new Map<string, Offer[]>();
    for (const o of offers ?? []) map.set(o.rootOfferId, [...(map.get(o.rootOfferId) ?? []), o]);
    return Array.from(map.values())
      .map((list) => list.sort((a, b) => (a.createdAt?.toMillis() ?? 0) - (b.createdAt?.toMillis() ?? 0)))
      .sort((a, b) => (b.at(-1)!.createdAt?.toMillis() ?? 0) - (a.at(-1)!.createdAt?.toMillis() ?? 0));
  }, [offers]);

  const effectiveStatus = (o: Offer): OfferStatus =>
    o.status === "pending" && o.expiresAt && now > 0 && o.expiresAt.toMillis() <= now ? "expired" : o.status;
  const groupOf = (chain: Offer[]): Group => {
    const last = chain.at(-1)!;
    const s = effectiveStatus(last);
    if (s === "pending" && last.respondentId === uid) return "action";
    return s;
  };
  const tabs: [Group, string][] = [
    ["action", "Needs your response"],
    ["pending", "Waiting for them"],
    ["accepted", "Accepted"],
    ["rejected", "Rejected"],
    ["withdrawn", "Withdrawn"],
    ["expired", "Expired"],
    ["cancelled", "Cancelled"],
  ];
  const visible = chains.filter((c) => groupOf(c) === tab);

  if (error) return <ErrorState message="Offers could not be loaded." onRetry={() => location.reload()} />;
  return (
    <>
      <Tabs value={tab} onValueChange={(v) => setTab(v as Group)}>
        <TabsList className="mb-4">
          {tabs.map(([v, l]) => (
            <TabsTrigger key={v} value={v}>
              {l} <span className="ml-1 text-xs text-muted-foreground tabular">{chains.filter((c) => groupOf(c) === v).length}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {!offers ? (
        <Skeleton className="h-32" />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Tags}
          title="No offers here"
          action={
            role === "buyer" && (
              <Button asChild variant="secondary">
                <Link href="/marketplace">Find produce</Link>
              </Button>
            )
          }
        />
      ) : (
        <ul className="space-y-4">
          {visible.map((chain) => {
            const last = chain.at(-1)!;
            return (
              <li key={last.rootOfferId} className="rounded-lg border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <Link href={`/products/${last.productId}`} className="font-semibold hover:text-primary">
                      {last.productName}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      Latest: {formatQuantity(last.quantity, last.unit)} at <span className="tabular">{formatINR(last.pricePerUnit)}/{unitShort(last.unit)}</span> ·{" "}
                      <span className="tabular">{formatINR(last.totalValue)}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <OfferStatusBadge status={effectiveStatus(last)} />
                    <Button asChild size="sm" variant={groupOf(chain) === "action" ? "primary" : "secondary"}>
                      <Link href={last.status === "accepted" && last.agreementId ? `/agreements/${last.agreementId}` : `/messages/${last.conversationId}`}>
                        {groupOf(chain) === "action" ? "Respond" : last.status === "accepted" ? "Agreement" : "Open chat"}
                      </Link>
                    </Button>
                  </div>
                </div>
                {chain.length > 1 && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs font-medium text-primary">Negotiation history ({chain.length} rounds)</summary>
                    <ol className="mt-2 space-y-1.5 border-l-2 border-border pl-4 text-sm">
                      {chain.map((o, i) => (
                        <li key={o.offerId} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="text-xs text-muted-foreground">Round {i + 1}</span>
                          <span>{o.proposedBy === uid ? "You" : tradeRole === "farmer" ? "Buyer" : "Farmer"}</span>
                          <span className="tabular">
                            {formatQuantity(o.quantity, o.unit)} @ {formatINR(o.pricePerUnit)}/{unitShort(o.unit)}
                          </span>
                          <OfferStatusBadge status={effectiveStatus(o)} />
                          <span className="text-xs text-muted-foreground">{formatDateTime(o.createdAt)}</span>
                        </li>
                      ))}
                    </ol>
                  </details>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
