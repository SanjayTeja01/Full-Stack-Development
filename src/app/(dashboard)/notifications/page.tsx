"use client";

import * as React from "react";
import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import type { AppNotification } from "@shared/types";
import { useAuth } from "@/components/auth/auth-provider";
import { markAllNotificationsRead, markNotificationRead, subscribeNotifications } from "@/lib/data/notifications";
import { PageHeader } from "@/components/layout/app-shell";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/firebase/callable";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const PAGE = 50;

export default function NotificationsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [items, setItems] = React.useState<AppNotification[] | null>(null);
  const [max, setMax] = React.useState(PAGE);
  const [error, setError] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<"all" | "unread">("all");
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => subscribeNotifications(user!.uid, max, setItems, (e) => setError(e.message)), [user, max]);

  const unread = (items ?? []).filter((n) => !n.readAt).length;
  const visible = (items ?? []).filter((n) => filter === "all" || !n.readAt);

  const markAll = async () => {
    setBusy(true);
    try {
      const n = await markAllNotificationsRead(user!.uid);
      toast.success(n ? `Marked ${n} as read.` : "Nothing to mark.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Updates about messages, offers, auctions, agreements and your account."
        actions={
          <Button variant="secondary" onClick={markAll} loading={busy} disabled={!unread}>
            <CheckCheck /> Mark all as read
          </Button>
        }
      />
      <Tabs value={filter} onValueChange={(v) => setFilter(v as "all" | "unread")}>
        <TabsList className="mb-4">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="unread">
            Unread {items && <span className="ml-1 text-xs text-muted-foreground tabular">{unread}</span>}
          </TabsTrigger>
        </TabsList>
      </Tabs>
      {error ? (
        <ErrorState message="Notifications could not be loaded." onRetry={() => location.reload()} />
      ) : !items ? (
        <Skeleton className="h-40" />
      ) : visible.length === 0 ? (
        <EmptyState icon={Bell} title={filter === "unread" ? "You're all caught up" : "No notifications yet"} />
      ) : (
        <>
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
            {visible.map((n) => (
              <li key={n.notificationId} className={cn("relative flex gap-3 p-4", !n.readAt && "bg-primary-soft/40")}>
                <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-primary")} aria-hidden />
                <div className="min-w-0 flex-1">
                  <Link
                    href={n.link}
                    onClick={() => !n.readAt && markNotificationRead(n.notificationId).catch(() => undefined)}
                    className="font-medium after:absolute after:inset-0 hover:text-primary"
                  >
                    {n.title}
                    {!n.readAt && <span className="sr-only"> (unread)</span>}
                  </Link>
                  <p className="text-sm text-muted-foreground">{n.message}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(n.createdAt)}</p>
                </div>
                {!n.readAt && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="relative z-10 self-start"
                    onClick={() => markNotificationRead(n.notificationId).catch((e) => toast.error(errorMessage(e)))}
                  >
                    Mark read
                  </Button>
                )}
              </li>
            ))}
          </ul>
          {items.length >= max && (
            <div className="mt-4 flex justify-center">
              <Button variant="secondary" onClick={() => setMax((m) => m + PAGE)}>
                Show older
              </Button>
            </div>
          )}
        </>
      )}
    </>
  );
}
