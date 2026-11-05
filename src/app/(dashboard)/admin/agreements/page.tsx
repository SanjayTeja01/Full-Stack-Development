"use client";

import * as React from "react";
import Link from "next/link";
import { limit, orderBy, where, type QueryConstraint } from "firebase/firestore";
import type { Agreement, AgreementStatus } from "@shared/types";
import { formatINR } from "@shared/money";
import { formatQuantity, unitShort } from "@shared/units";
import { call } from "@/lib/firebase/callable";
import { PageHeader } from "@/components/layout/app-shell";
import { ActionDialog, FilterTabs, useAdminQuery } from "@/components/admin/admin-ui";
import { AgreementStatusBadge } from "@/components/offers/agreement-status";
import { Button } from "@/components/ui/button";
import { Field, NativeSelect } from "@/components/ui/input";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { formatDateTime } from "@/lib/format";

type Filter = "disputed" | "open" | "closed";
const OPEN: AgreementStatus[] = ["agreement_recorded", "contact_initiated", "in_progress"];

export default function AdminAgreementsPage() {
  const toast = useToast();
  const [filter, setFilter] = React.useState<Filter>("disputed");
  const [target, setTarget] = React.useState<Agreement | null>(null);
  const [status, setStatus] = React.useState<"in_progress" | "completed" | "not_completed">("not_completed");
  const constraints: QueryConstraint[] = [
    where("status", filter === "disputed" ? "==" : "in", filter === "disputed" ? "disputed" : filter === "open" ? OPEN : ["completed", "not_completed"]),
    orderBy("updatedAt", "desc"),
    limit(100),
  ];
  const { items, error } = useAdminQuery<Agreement>("agreements", constraints, filter);
  return (
    <>
      <PageHeader title="Agreements" description="Agreements record trades arranged outside FarmConnect. Resolve disputes by recording the outcome; this settles the committed stock." />
      <FilterTabs value={filter} onChange={setFilter} options={[["disputed", "Disputed"], ["open", "Open"], ["closed", "Closed"]]} />
      {error ? (
        <ErrorState message={error} />
      ) : !items ? (
        <Skeleton className="h-32" />
      ) : items.length === 0 ? (
        <EmptyState title="No agreements here" />
      ) : (
        <ul className="space-y-3">
          {items.map((a) => (
            <li key={a.agreementId} className="rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/agreements/${a.agreementId}`} className="font-semibold hover:text-primary">
                      {a.productName}
                    </Link>
                    <AgreementStatusBadge status={a.status} />
                  </div>
                  <p className="text-xs text-muted-foreground tabular">
                    {a.participantNames[a.farmerId]} to {a.participantNames[a.buyerId]} · {formatQuantity(a.quantity, a.unit)} at {formatINR(a.pricePerUnit)}/{unitShort(a.unit)} ·{" "}
                    {formatINR(a.totalValue)} · from {a.source}
                  </p>
                  <p className="text-xs text-muted-foreground">Updated {formatDateTime(a.updatedAt)}</p>
                </div>
                {a.status !== "completed" && a.status !== "not_completed" && (
                  <Button size="sm" onClick={() => setTarget(a)}>
                    Record outcome
                  </Button>
                )}
              </div>
              <details className="mt-2">
                <summary className="cursor-pointer text-xs font-medium text-primary">History ({a.statusHistory.length})</summary>
                <ol className="mt-2 space-y-1 border-l-2 border-border pl-4 text-xs">
                  {a.statusHistory.map((h, i) => (
                    <li key={i}>
                      <span className="font-medium">{h.status.replaceAll("_", " ")}</span> by {a.participantNames[h.by] ?? h.by} · {formatDateTime(h.at)}
                      {h.note && <span className="block text-muted-foreground">{h.note}</span>}
                    </li>
                  ))}
                </ol>
              </details>
            </li>
          ))}
        </ul>
      )}
      {target && (
        <ActionDialog
          open
          onOpenChange={(o) => !o && setTarget(null)}
          title={`Record outcome: ${target.productName}`}
          description="Completed moves the committed quantity to sold. Not completed returns it to the farmer's available stock. Both parties are notified."
          confirmLabel="Record outcome"
          onSubmit={async (reason) => {
            await call("adminResolveAgreement", { agreementId: target.agreementId, status, reason });
            toast.success("Agreement updated.");
          }}
        >
          <Field label="Outcome" htmlFor="outcome">
            <NativeSelect id="outcome" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
              <option value="not_completed">Not completed (return stock)</option>
              <option value="completed">Completed (mark sold)</option>
              <option value="in_progress">Back in progress (keep stock committed)</option>
            </NativeSelect>
          </Field>
        </ActionDialog>
      )}
    </>
  );
}
