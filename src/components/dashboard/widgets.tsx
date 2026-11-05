"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { AppNotification } from "@shared/types";
import { useAuth } from "@/components/auth/auth-provider";
import { subscribeNotifications } from "@/lib/data/notifications";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/feedback";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

/** A count from the user's own records. `value` is null while loading; nothing is estimated. */
export function StatCard({
  label,
  value,
  href,
  hint,
  icon: Icon,
  emphasis,
}: {
  label: string;
  value: number | string | null;
  href?: string;
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
  emphasis?: boolean;
}) {
  const body = (
    <div className={cn("dashboard-stat-card flex h-full flex-col gap-1 rounded-lg border border-border bg-card p-4 transition-colors", href && "hover:border-primary/40 hover:bg-muted/40", emphasis && "is-emphasized border-primary/50 bg-primary-soft/40")}>
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        {Icon && <span className="grid size-8 place-items-center rounded-lg bg-primary-soft text-primary"><Icon className="size-4" /></span>}
        {label}
      </span>
      {value === null ? <Skeleton className="mt-1 h-8 w-16" /> : <span className="mt-1 text-2xl font-semibold tabular text-foreground">{value}</span>}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
  return href ? (
    <Link href={href} className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {body}
    </Link>
  ) : (
    body
  );
}

export function StatGrid({ children }: { children: React.ReactNode }) {
  return <div className="dashboard-stat-grid grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</div>;
}

export function RecentNotifications() {
  const { user } = useAuth();
  const [items, setItems] = React.useState<AppNotification[] | null>(null);
  React.useEffect(() => subscribeNotifications(user!.uid, 6, setItems, () => setItems([])), [user]);
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Recent activity</CardTitle>
        <Link href="/notifications" className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">
          All notifications <ArrowRight className="size-4" />
        </Link>
      </CardHeader>
      <CardContent>
        {!items ? (
          <Skeleton className="h-24" />
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing yet. Updates about your offers, auctions and agreements will appear here.</p>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((n) => (
              <li key={n.notificationId} className="py-2.5">
                <Link href={n.link} className="flex items-start gap-2 hover:text-primary">
                  <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.readAt ? "bg-border" : "bg-primary")} aria-hidden />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{n.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {n.message} · {formatDateTime(n.createdAt)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
