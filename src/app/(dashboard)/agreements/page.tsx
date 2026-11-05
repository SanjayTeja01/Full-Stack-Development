"use client";

import * as React from "react";
import Link from "next/link";
import { Handshake } from "lucide-react";
import type { Agreement } from "@shared/types";
import { formatINR } from "@shared/money";
import { formatQuantity, unitShort } from "@shared/units";
import { useAuth } from "@/components/auth/auth-provider";
import { subscribeMyAgreements } from "@/lib/data/agreements";
import { PageHeader } from "@/components/layout/app-shell";
import { AgreementStatusBadge } from "@/components/offers/agreement-status";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";

export default function AgreementsPage() {
  const { user } = useAuth();
  const [items, setItems] = React.useState<Agreement[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => subscribeMyAgreements(user!.uid, setItems, (e) => setError(e.message)), [user]);

  return (
    <>
      <PageHeader
        title="Agreements"
        description="Accepted offers and auction wins. These record agreed terms only; payment and delivery are arranged directly between the parties."
      />
      {error ? (
        <ErrorState message="Agreements could not be loaded." />
      ) : !items ? (
        <Skeleton className="h-32" />
      ) : items.length === 0 ? (
        <EmptyState icon={Handshake} title="No agreements yet" description="When an offer is accepted or an auction is won, the agreement appears here." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Produce</th>
                <th className="px-4 py-2 font-medium">With</th>
                <th className="px-4 py-2 font-medium">Terms</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Recorded</th>
              </tr>
            </thead>
            <tbody>
              {items.map((a) => {
                const other = a.participantIds.find((p) => p !== user!.uid)!;
                return (
                  <tr key={a.agreementId} className="border-b border-border last:border-0 hover:bg-muted/40">
                    <td className="px-4 py-3">
                      <Link href={`/agreements/${a.agreementId}`} className="font-medium hover:text-primary">
                        {a.productName}
                      </Link>
                      <div>
                        <Badge tone={a.source === "auction" ? "accent" : "neutral"}>{a.source === "auction" ? "Auction" : "Private offer"}</Badge>
                      </div>
                    </td>
                    <td className="px-4 py-3">{a.participantNames[other]}</td>
                    <td className="px-4 py-3 tabular">
                      {formatQuantity(a.quantity, a.unit)} @ {formatINR(a.pricePerUnit)}/{unitShort(a.unit)}
                      <div className="text-xs text-muted-foreground">{formatINR(a.totalValue)}</div>
                    </td>
                    <td className="px-4 py-3">
                      <AgreementStatusBadge status={a.status} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(a.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
