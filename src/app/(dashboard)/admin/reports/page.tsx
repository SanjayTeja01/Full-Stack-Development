"use client";

import * as React from "react";
import Link from "next/link";
import { limit, orderBy, where } from "firebase/firestore";
import type { Report, ReportStatus } from "@shared/types";
import { call } from "@/lib/firebase/callable";
import { PageHeader } from "@/components/layout/app-shell";
import { ActionDialog, FilterTabs, useAdminQuery } from "@/components/admin/admin-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { formatDateTime } from "@/lib/format";

const TARGET_LINK: Record<Report["targetType"], (id: string) => string> = {
  user: (id) => `/farmers/${id}`,
  product: (id) => `/products/${id}`,
  auction: (id) => `/auctions/${id}`,
  agreement: () => "/admin/agreements",
  conversation: () => "#",
};

export default function AdminReportsPage() {
  const toast = useToast();
  const [filter, setFilter] = React.useState<ReportStatus>("open");
  const [target, setTarget] = React.useState<{ r: Report; status: "reviewing" | "resolved" | "dismissed" } | null>(null);
  const { items, error } = useAdminQuery<Report>("reports", [where("status", "==", filter), orderBy("createdAt", "desc"), limit(100)], filter);
  return (
    <>
      <PageHeader
        title="Reports"
        description="Reports from users. Take action from the relevant page (users, listings, auctions or agreements), then record the outcome here so the reporter is told."
      />
      <FilterTabs value={filter} onChange={setFilter} options={[["open", "Open"], ["reviewing", "Reviewing"], ["resolved", "Resolved"], ["dismissed", "Dismissed"]]} />
      {error ? (
        <ErrorState message={error} />
      ) : !items ? (
        <Skeleton className="h-32" />
      ) : items.length === 0 ? (
        <EmptyState title="No reports here" />
      ) : (
        <ul className="space-y-3">
          {items.map((r) => (
            <li key={r._id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="warning">{r.reason.replaceAll("_", " ")}</Badge>
                    <span className="text-sm">
                      on {r.targetType}{" "}
                      {r.targetType === "conversation" ? (
                        <span className="font-mono text-xs">{r.targetId}</span>
                      ) : (
                        <Link href={TARGET_LINK[r.targetType](r.targetId)} className="font-mono text-xs text-primary hover:underline">
                          {r.targetId}
                        </Link>
                      )}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Reported {formatDateTime(r.createdAt)} by <span className="font-mono">{r.reporterId}</span>
                  </p>
                </div>
                {(r.status === "open" || r.status === "reviewing") && (
                  <div className="flex gap-2">
                    {r.status === "open" && (
                      <Button size="sm" variant="secondary" onClick={() => setTarget({ r, status: "reviewing" })}>
                        Mark reviewing
                      </Button>
                    )}
                    <Button size="sm" variant="secondary" onClick={() => setTarget({ r, status: "dismissed" })}>
                      Dismiss
                    </Button>
                    <Button size="sm" onClick={() => setTarget({ r, status: "resolved" })}>
                      Resolve
                    </Button>
                  </div>
                )}
              </div>
              <p className="mt-2 whitespace-pre-line text-sm">{r.description}</p>
              {r.resolutionNote && <p className="mt-2 text-xs text-muted-foreground">Outcome: {r.resolutionNote}</p>}
            </li>
          ))}
        </ul>
      )}
      {target && (
        <ActionDialog
          open
          onOpenChange={(o) => !o && setTarget(null)}
          title={target.status === "reviewing" ? "Mark as reviewing" : target.status === "resolved" ? "Resolve report" : "Dismiss report"}
          description={target.status === "reviewing" ? undefined : "The reporter is notified with your note."}
          confirmLabel={target.status === "reviewing" ? "Mark reviewing" : target.status === "resolved" ? "Resolve" : "Dismiss"}
          reasonLabel="Note"
          reasonRequired={target.status !== "reviewing"}
          onSubmit={async (note) => {
            await call("adminResolveReport", { reportId: target.r.reportId, status: target.status, note });
            toast.success("Report updated.");
          }}
        />
      )}
    </>
  );
}
