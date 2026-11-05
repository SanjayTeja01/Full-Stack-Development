"use client";

import * as React from "react";
import Link from "next/link";
import { BadgeCheck, Boxes, FileWarning, Gavel, Handshake, ServerCrash, Users, UserX } from "lucide-react";
import { collection, getCountFromServer, limit, orderBy, query, where, type QueryConstraint } from "firebase/firestore";
import type { AuditLog } from "@shared/types";
import { firebase } from "@/lib/firebase/client";
import { PageHeader } from "@/components/layout/app-shell";
import { StatCard, StatGrid } from "@/components/dashboard/widgets";
import { useAdminQuery } from "@/components/admin/admin-ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/feedback";
import { formatDateTime } from "@/lib/format";

const COUNTS: { key: string; path: string; where: QueryConstraint[] }[] = [
  { key: "farmers", path: "users", where: [where("role", "==", "farmer")] },
  { key: "buyers", path: "users", where: [where("role", "==", "buyer")] },
  { key: "suspended", path: "users", where: [where("accountStatus", "==", "suspended")] },
  { key: "verification", path: "verificationRequests", where: [where("status", "==", "pending")] },
  { key: "reports", path: "reports", where: [where("status", "in", ["open", "reviewing"])] },
  { key: "listings", path: "products", where: [where("listingStatus", "==", "active")] },
  { key: "flagged", path: "products", where: [where("moderationStatus", "==", "flagged")] },
  { key: "auctions", path: "auctions", where: [where("status", "in", ["scheduled", "live"])] },
  { key: "disputes", path: "agreements", where: [where("status", "==", "disputed")] },
  { key: "errors", path: "opsErrors", where: [where("resolved", "==", false)] },
];

export default function AdminOverviewPage() {
  const [counts, setCounts] = React.useState<Record<string, number | null>>({});
  React.useEffect(() => {
    const { db } = firebase();
    COUNTS.forEach((c) =>
      getCountFromServer(query(collection(db, c.path), ...c.where)).then(
        (s) => setCounts((p) => ({ ...p, [c.key]: s.data().count })),
        () => setCounts((p) => ({ ...p, [c.key]: null })),
      ),
    );
  }, []);
  const { items: audit } = useAdminQuery<AuditLog>("auditLogs", [orderBy("timestamp", "desc"), limit(8)], "recent");
  const v = (k: string) => (k in counts ? (counts[k] ?? "—") : null);

  return (
    <>
      <PageHeader title="Administration" description="Counts are read live from the database when this page opens." />
      <div className="space-y-6">
        <StatGrid>
          <StatCard label="Pending verifications" value={v("verification")} href="/admin/verification" icon={BadgeCheck} emphasis={!!counts.verification} />
          <StatCard label="Open reports" value={v("reports")} href="/admin/reports" icon={FileWarning} emphasis={!!counts.reports} />
          <StatCard label="Disputed agreements" value={v("disputes")} href="/admin/agreements" icon={Handshake} emphasis={!!counts.disputes} />
          <StatCard label="Unresolved system errors" value={v("errors")} href="/admin/errors" icon={ServerCrash} emphasis={!!counts.errors} />
          <StatCard label="Farmers" value={v("farmers")} href="/admin/users" icon={Users} />
          <StatCard label="Buyers" value={v("buyers")} href="/admin/users" icon={Users} />
          <StatCard label="Suspended accounts" value={v("suspended")} href="/admin/users" icon={UserX} />
          <StatCard label="Active listings" value={v("listings")} href="/admin/listings" icon={Boxes} hint={counts.flagged ? `${counts.flagged} flagged` : undefined} />
          <StatCard label="Scheduled and live auctions" value={v("auctions")} href="/admin/auctions" icon={Gavel} />
        </StatGrid>
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Recent audit log</CardTitle>
            <Link href="/admin/audit" className="text-sm font-medium text-primary hover:underline">
              Full log
            </Link>
          </CardHeader>
          <CardContent>
            {!audit ? (
              <Skeleton className="h-24" />
            ) : audit.length === 0 ? (
              <p className="text-sm text-muted-foreground">No entries yet.</p>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {audit.map((a) => (
                  <li key={a._id} className="flex flex-wrap justify-between gap-2 py-2">
                    <span>
                      <span className="font-mono text-xs">{a.action}</span> on {a.targetType} <span className="font-mono text-xs text-muted-foreground">{a.targetId}</span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {a.actorRole} · {formatDateTime(a.timestamp)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
