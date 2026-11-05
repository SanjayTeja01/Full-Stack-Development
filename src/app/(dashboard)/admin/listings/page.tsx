"use client";

import * as React from "react";
import Link from "next/link";
import { limit, orderBy, where, type QueryConstraint } from "firebase/firestore";
import type { Product } from "@shared/types";
import { formatINR } from "@shared/money";
import { formatQuantity, unitShort } from "@shared/units";
import { call } from "@/lib/firebase/callable";
import { PageHeader } from "@/components/layout/app-shell";
import { ActionDialog, FilterTabs, useAdminQuery } from "@/components/admin/admin-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { formatDate } from "@/lib/format";

type Filter = "active" | "flagged" | "removed" | "all";
type Action = "flag" | "remove" | "restore";

export default function AdminListingsPage() {
  const toast = useToast();
  const [filter, setFilter] = React.useState<Filter>("active");
  const [max, setMax] = React.useState(100);
  const [target, setTarget] = React.useState<{ p: Product; action: Action } | null>(null);
  const constraints: QueryConstraint[] = [
    ...(filter === "active" ? [where("listingStatus", "==", "active")] : []),
    ...(filter === "flagged" ? [where("moderationStatus", "==", "flagged")] : []),
    ...(filter === "removed" ? [where("moderationStatus", "==", "removed_by_admin")] : []),
    orderBy("updatedAt", "desc"),
    limit(max),
  ];
  const { items, error } = useAdminQuery<Product>("products", constraints, `${filter}-${max}`);
  const label: Record<Action, string> = { flag: "Flag for review", remove: "Remove listing", restore: "Restore listing" };

  return (
    <>
      <PageHeader title="Listings" description="Flag listings for review, or remove ones that break the rules. Removing cancels pending offers on the listing." />
      <FilterTabs value={filter} onChange={setFilter} options={[["active", "Active"], ["flagged", "Flagged"], ["removed", "Removed by admin"], ["all", "All"]]} />
      {error ? (
        <ErrorState message={error} />
      ) : !items ? (
        <Skeleton className="h-40" />
      ) : items.length === 0 ? (
        <EmptyState title="No listings here" />
      ) : (
        <ul className="space-y-2">
          {items.map((p) => (
            <li key={p.productId} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/products/${p.productId}`} className="font-medium hover:text-primary">
                    {p.name}
                  </Link>
                  <Badge>{p.listingStatus.replace("_", " ")}</Badge>
                  {p.moderationStatus !== "ok" && <Badge tone="danger">{p.moderationStatus === "flagged" ? "Flagged" : "Removed by admin"}</Badge>}
                </div>
                <p className="text-xs text-muted-foreground tabular">
                  {p.farmerName} · {formatINR(p.pricePerUnit)}/{unitShort(p.unit)} · {formatQuantity(p.availableQuantity, p.unit)} available
                  {p.reservedQuantity > 0 && ` · ${formatQuantity(p.reservedQuantity, p.unit)} in auctions`} · updated {formatDate(p.updatedAt)}
                </p>
              </div>
              <div className="flex gap-2">
                {p.moderationStatus === "ok" && (
                  <Button size="sm" variant="secondary" onClick={() => setTarget({ p, action: "flag" })}>
                    Flag
                  </Button>
                )}
                {p.moderationStatus !== "removed_by_admin" ? (
                  <Button size="sm" variant="danger" onClick={() => setTarget({ p, action: "remove" })}>
                    Remove
                  </Button>
                ) : null}
                {p.moderationStatus !== "ok" && (
                  <Button size="sm" variant="secondary" onClick={() => setTarget({ p, action: "restore" })}>
                    Restore
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {items && items.length >= max && (
        <div className="mt-4 flex justify-center">
          <Button variant="secondary" onClick={() => setMax((m) => m + 100)}>
            Load more
          </Button>
        </div>
      )}
      {target && (
        <ActionDialog
          open
          onOpenChange={(o) => !o && setTarget(null)}
          title={`${label[target.action]}: ${target.p.name}`}
          description={
            target.action === "remove"
              ? "The listing is hidden from buyers and the farmer is notified with your reason. Agreements already recorded are not affected."
              : target.action === "restore"
                ? "The listing returns as paused; the farmer decides when to reactivate it."
                : "Flagging marks the listing for follow-up. It stays visible."
          }
          confirmLabel={label[target.action]}
          tone={target.action === "remove" ? "danger" : "primary"}
          onSubmit={async (reason) => {
            await call("adminModerateProduct", { productId: target.p.productId, action: target.action, reason });
            toast.success("Listing updated.");
          }}
        />
      )}
    </>
  );
}
