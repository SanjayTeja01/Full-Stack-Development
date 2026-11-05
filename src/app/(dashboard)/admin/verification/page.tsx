"use client";

import * as React from "react";
import Link from "next/link";
import { limit, orderBy, where } from "firebase/firestore";
import type { VerificationRequest } from "@shared/types";
import { call } from "@/lib/firebase/callable";
import { PageHeader } from "@/components/layout/app-shell";
import { ActionDialog, FilterTabs, useAdminQuery } from "@/components/admin/admin-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { formatDateTime } from "@/lib/format";

type Filter = "pending" | "verified" | "rejected";

export default function AdminVerificationPage() {
  const toast = useToast();
  const [filter, setFilter] = React.useState<Filter>("pending");
  const [target, setTarget] = React.useState<{ req: VerificationRequest; decision: "verified" | "rejected" } | null>(null);
  const { items, error } = useAdminQuery<VerificationRequest>("verificationRequests", [where("status", "==", filter), orderBy("createdAt", "desc"), limit(100)], filter);
  return (
    <>
      <PageHeader title="Farmer verification" description="Check each request against the farmer's documents or a call before approving. The badge appears on their profile and listings." />
      <FilterTabs value={filter} onChange={setFilter} options={[["pending", "Pending"], ["verified", "Approved"], ["rejected", "Rejected"]]} />
      {error ? (
        <ErrorState message={error} />
      ) : !items ? (
        <Skeleton className="h-32" />
      ) : items.length === 0 ? (
        <EmptyState title={filter === "pending" ? "No requests waiting" : "Nothing here"} />
      ) : (
        <ul className="space-y-3">
          {items.map((r) => (
            <li key={r._id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Link href={`/farmers/${r.userId}`} className="font-semibold hover:text-primary">
                    {r.displayName}
                  </Link>
                  <p className="text-xs text-muted-foreground">Requested {formatDateTime(r.createdAt)}</p>
                </div>
                {r.status === "pending" ? (
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => setTarget({ req: r, decision: "rejected" })}>
                      Reject
                    </Button>
                    <Button size="sm" onClick={() => setTarget({ req: r, decision: "verified" })}>
                      Approve
                    </Button>
                  </div>
                ) : (
                  <Badge tone={r.status === "verified" ? "success" : "neutral"}>{r.status === "verified" ? "Approved" : "Rejected"}</Badge>
                )}
              </div>
              <p className="mt-2 whitespace-pre-line text-sm">{r.note}</p>
              {r.reviewNote && <p className="mt-2 text-xs text-muted-foreground">Review note: {r.reviewNote}</p>}
            </li>
          ))}
        </ul>
      )}
      {target && (
        <ActionDialog
          open
          onOpenChange={(o) => !o && setTarget(null)}
          title={target.decision === "verified" ? `Approve ${target.req.displayName}?` : `Reject ${target.req.displayName}?`}
          confirmLabel={target.decision === "verified" ? "Approve" : "Reject"}
          tone={target.decision === "verified" ? "primary" : "danger"}
          reasonLabel={target.decision === "verified" ? "Note (optional, shown to the farmer)" : "Reason (shown to the farmer)"}
          reasonRequired={target.decision === "rejected"}
          onSubmit={async (note) => {
            await call("adminReviewVerification", { userId: target.req.userId, decision: target.decision, note });
            toast.success(target.decision === "verified" ? "Farmer verified." : "Request rejected.");
          }}
        />
      )}
    </>
  );
}
