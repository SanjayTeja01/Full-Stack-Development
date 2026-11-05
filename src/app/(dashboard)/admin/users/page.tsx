"use client";

import * as React from "react";
import Link from "next/link";
import { doc, getDoc, limit, orderBy, where, type QueryConstraint } from "firebase/firestore";
import type { PrivateContact, UserProfile } from "@shared/types";
import { firebase } from "@/lib/firebase/client";
import { call } from "@/lib/firebase/callable";
import { PageHeader } from "@/components/layout/app-shell";
import { ActionDialog, FilterTabs, useAdminQuery } from "@/components/admin/admin-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { formatDate } from "@/lib/format";

type Filter = "all" | "farmer" | "buyer" | "suspended";

export default function AdminUsersPage() {
  const toast = useToast();
  const [filter, setFilter] = React.useState<Filter>("all");
  const [q, setQ] = React.useState("");
  const [max, setMax] = React.useState(100);
  const [target, setTarget] = React.useState<UserProfile | null>(null);
  const [contacts, setContacts] = React.useState<Record<string, PrivateContact | null>>({});
  const constraints: QueryConstraint[] = [
    ...(filter === "farmer" || filter === "buyer" ? [where("role", "==", filter)] : []),
    ...(filter === "suspended" ? [where("accountStatus", "==", "suspended")] : []),
    orderBy("createdAt", "desc"),
    limit(max),
  ];
  const { items, error } = useAdminQuery<UserProfile>("users", constraints, `${filter}-${max}`);
  const needle = q.trim().toLowerCase();
  const visible = (items ?? []).filter(
    (u) => !needle || u.displayName.toLowerCase().includes(needle) || (u.organizationName ?? "").toLowerCase().includes(needle) || u.userId === q.trim(),
  );

  const showContact = async (uid: string) => {
    const s = await getDoc(doc(firebase().db, "users", uid, "private", "contact"));
    setContacts((c) => ({ ...c, [uid]: s.exists() ? (s.data() as PrivateContact) : null }));
  };

  return (
    <>
      <PageHeader title="Users" description="Suspend or restore accounts. Every change is recorded in the audit log with your reason." />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <FilterTabs value={filter} onChange={setFilter} options={[["all", "All"], ["farmer", "Farmers"], ["buyer", "Buyers"], ["suspended", "Suspended"]]} />
        <Input className="mb-4 max-w-xs" placeholder="Search loaded users by name or id" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search users" />
      </div>
      {error ? (
        <ErrorState message={error} />
      ) : !items ? (
        <Skeleton className="h-40" />
      ) : visible.length === 0 ? (
        <EmptyState title="No users match" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="p-3 font-medium">Name</th>
                <th className="p-3 font-medium">Role</th>
                <th className="p-3 font-medium">Location</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium">Joined</th>
                <th className="p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((u) => (
                <tr key={u.userId} className="border-t border-border align-top">
                  <td className="p-3">
                    {u.role === "farmer" ? (
                      <Link href={`/farmers/${u.userId}`} className="font-medium hover:text-primary">
                        {u.displayName}
                      </Link>
                    ) : (
                      <span className="font-medium">{u.displayName}</span>
                    )}
                    {u.organizationName && <span className="block text-xs text-muted-foreground">{u.organizationName}</span>}
                    {u.userId in contacts && (
                      <span className="block text-xs">
                        {contacts[u.userId] ? `${contacts[u.userId]!.email} · ${contacts[u.userId]!.phone ?? "no phone"}` : "No contact record"}
                      </span>
                    )}
                  </td>
                  <td className="p-3 capitalize">{u.role}</td>
                  <td className="p-3">
                    {u.location.district}, {u.location.state}
                  </td>
                  <td className="space-x-1 p-3">
                    <Badge tone={u.accountStatus === "active" ? "success" : "danger"}>{u.accountStatus}</Badge>
                    {u.role === "farmer" && <Badge tone={u.verificationStatus === "verified" ? "success" : "neutral"}>{u.verificationStatus}</Badge>}
                  </td>
                  <td className="p-3">{formatDate(u.createdAt)}</td>
                  <td className="space-x-1 whitespace-nowrap p-3">
                    {!(u.userId in contacts) && (
                      <Button size="sm" variant="ghost" onClick={() => showContact(u.userId)}>
                        Contact
                      </Button>
                    )}
                    {u.role !== "admin" && (
                      <Button size="sm" variant={u.accountStatus === "active" ? "danger" : "secondary"} onClick={() => setTarget(u)}>
                        {u.accountStatus === "active" ? "Suspend" : "Restore"}
                      </Button>
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
      {target && (
        <ActionDialog
          open
          onOpenChange={(o) => !o && setTarget(null)}
          title={target.accountStatus === "active" ? `Suspend ${target.displayName}?` : `Restore ${target.displayName}?`}
          description={
            target.accountStatus === "active"
              ? target.role === "farmer"
                ? "Their active listings will be paused and auctions without bids cancelled. Auctions with bids stay open for you to review. They will be notified."
                : "They will not be able to make offers or bid. They will be notified."
              : "They will be able to use FarmConnect again. Paused listings stay paused until they reactivate them."
          }
          confirmLabel={target.accountStatus === "active" ? "Suspend account" : "Restore account"}
          tone={target.accountStatus === "active" ? "danger" : "primary"}
          onSubmit={async (reason) => {
            const res = await call<unknown, { pausedListings: number; cancelledAuctions: number; auctionsWithBids: string[] }>("adminSetAccountStatus", {
              userId: target.userId,
              status: target.accountStatus === "active" ? "suspended" : "active",
              reason,
            });
            toast.success(
              target.accountStatus === "active"
                ? `Suspended. ${res.pausedListings} listings paused, ${res.cancelledAuctions} auctions cancelled.${res.auctionsWithBids.length ? ` ${res.auctionsWithBids.length} auctions with bids need review.` : ""}`
                : "Account restored.",
            );
          }}
        />
      )}
    </>
  );
}
