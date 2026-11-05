"use client";

import * as React from "react";
import { limit, orderBy, where } from "firebase/firestore";
import type { OpsError } from "@shared/types";
import { call, errorMessage } from "@/lib/firebase/callable";
import { PageHeader } from "@/components/layout/app-shell";
import { FilterTabs, useAdminQuery } from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { formatDateTime } from "@/lib/format";

export default function AdminErrorsPage() {
  const toast = useToast();
  const [filter, setFilter] = React.useState<"open" | "resolved">("open");
  const [busy, setBusy] = React.useState<string | null>(null);
  const { items, error } = useAdminQuery<OpsError>("opsErrors", [where("resolved", "==", filter === "resolved"), orderBy("createdAt", "desc"), limit(100)], filter);
  return (
    <>
      <PageHeader
        title="System errors"
        description="Failures in background work, such as a notification that could not be sent. The main operation (a bid, an acceptance) has already been saved; these need follow-up only."
      />
      <FilterTabs value={filter} onChange={setFilter} options={[["open", "Unresolved"], ["resolved", "Resolved"]]} />
      {error ? (
        <ErrorState message={error} />
      ) : !items ? (
        <Skeleton className="h-32" />
      ) : items.length === 0 ? (
        <EmptyState title={filter === "open" ? "No unresolved errors" : "Nothing here"} />
      ) : (
        <ul className="space-y-3">
          {items.map((e) => (
            <li key={e._id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-sm font-medium">{e.source}</p>
                  <p className="break-words text-sm">{e.message}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(e.createdAt)}</p>
                </div>
                {!e.resolved && (
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={busy === e._id}
                    onClick={async () => {
                      setBusy(e._id);
                      try {
                        await call("adminResolveError", { errorId: e._id });
                      } catch (err) {
                        toast.error(errorMessage(err));
                      } finally {
                        setBusy(null);
                      }
                    }}
                  >
                    Mark resolved
                  </Button>
                )}
              </div>
              {Object.keys(e.context ?? {}).length > 0 && (
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all rounded bg-muted p-2 text-[11px]">{JSON.stringify(e.context, null, 2)}</pre>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
