"use client";

import * as React from "react";
import { limit, orderBy, where, type QueryConstraint } from "firebase/firestore";
import type { AuditLog } from "@shared/types";
import { PageHeader } from "@/components/layout/app-shell";
import { useAdminQuery } from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { formatDateTime } from "@/lib/format";

export default function AdminAuditPage() {
  const [targetId, setTargetId] = React.useState("");
  const [applied, setApplied] = React.useState("");
  const [max, setMax] = React.useState(100);
  const constraints: QueryConstraint[] = [...(applied ? [where("targetId", "==", applied)] : []), orderBy("timestamp", "desc"), limit(max)];
  const { items, error } = useAdminQuery<AuditLog>("auditLogs", constraints, `${applied}-${max}`);
  return (
    <>
      <PageHeader title="Audit log" description="Sensitive actions by users, administrators and the system. Entries are written by the server and cannot be edited." />
      <form
        className="mb-4 flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setApplied(targetId.trim());
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="t-id">Target id</Label>
          <Input id="t-id" className="w-72" placeholder="User, listing, auction or agreement id" value={targetId} onChange={(e) => setTargetId(e.target.value)} />
        </div>
        <Button type="submit" variant="secondary">
          Filter
        </Button>
        {applied && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setTargetId("");
              setApplied("");
            }}
          >
            Clear
          </Button>
        )}
      </form>
      {error ? (
        <ErrorState message={error} />
      ) : !items ? (
        <Skeleton className="h-40" />
      ) : items.length === 0 ? (
        <EmptyState title="No entries" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="p-3 font-medium">Time</th>
                <th className="p-3 font-medium">Action</th>
                <th className="p-3 font-medium">Target</th>
                <th className="p-3 font-medium">Actor</th>
                <th className="p-3 font-medium">Reason and details</th>
              </tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr key={a._id} className="border-t border-border align-top">
                  <td className="whitespace-nowrap p-3 text-xs">{formatDateTime(a.timestamp)}</td>
                  <td className="p-3 font-mono text-xs">{a.action}</td>
                  <td className="p-3 text-xs">
                    {a.targetType}
                    <button type="button" className="block font-mono text-primary hover:underline" onClick={() => (setTargetId(a.targetId), setApplied(a.targetId))}>
                      {a.targetId}
                    </button>
                  </td>
                  <td className="p-3 text-xs">
                    {a.actorRole}
                    <span className="block font-mono text-muted-foreground">{a.actorId}</span>
                  </td>
                  <td className="p-3 text-xs">
                    {a.reason && <p>{a.reason}</p>}
                    {Object.keys(a.metadata ?? {}).length > 0 && (
                      <details>
                        <summary className="cursor-pointer text-primary">Details</summary>
                        <pre className="mt-1 max-w-md overflow-x-auto whitespace-pre-wrap break-all rounded bg-muted p-2 text-[11px]">{JSON.stringify(a.metadata, null, 2)}</pre>
                      </details>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {items && items.length >= max && (
        <div className="mt-4 flex justify-center">
          <Button variant="secondary" onClick={() => setMax((m) => m + 100)}>
            Load more
          </Button>
        </div>
      )}
    </>
  );
}
