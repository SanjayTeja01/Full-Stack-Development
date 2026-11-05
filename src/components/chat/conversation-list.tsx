"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageSquare, Archive } from "lucide-react";
import type { Conversation } from "@shared/types";
import { useAuth } from "@/components/auth/auth-provider";
import { subscribeConversations } from "@/lib/data/chat";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

export function ConversationList() {
  const { user, role } = useAuth();
  const pathname = usePathname();
  const [items, setItems] = React.useState<Conversation[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [showArchived, setShowArchived] = React.useState(false);
  const [attempt, setAttempt] = React.useState(0);

  React.useEffect(() => {
    if (!user) return;
    return subscribeConversations(user.uid, setItems, (e) => setError(e.message));
  }, [user, attempt]);

  if (error)
    return (
      <div className="p-3">
        <ErrorState
          message="Conversations could not be loaded."
          onRetry={() => {
            setError(null);
            setAttempt((a) => a + 1);
          }}
        />
      </div>
    );
  if (!items)
    return (
      <div className="space-y-2 p-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
    );

  const visible = items.filter((c) => (showArchived ? c.archivedBy.includes(user!.uid) : !c.archivedBy.includes(user!.uid)));
  const archivedCount = items.filter((c) => c.archivedBy.includes(user!.uid)).length;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="font-semibold">{showArchived ? "Archived" : "Conversations"}</h2>
        {(archivedCount > 0 || showArchived) && (
          <button type="button" className="flex items-center gap-1 text-xs text-primary hover:underline" onClick={() => setShowArchived((s) => !s)}>
            <Archive className="size-3.5" /> {showArchived ? "Back to inbox" : `Archived (${archivedCount})`}
          </button>
        )}
      </div>
      {visible.length === 0 ? (
        <div className="p-3">
          <EmptyState
            icon={MessageSquare}
            title={showArchived ? "No archived conversations" : "No conversations yet"}
            description={
              showArchived ? undefined : role === "buyer" ? "Open a listing and message the farmer to start." : "Buyers' messages about your listings will appear here."
            }
          />
        </div>
      ) : (
        <ul className="flex-1 overflow-y-auto">
          {visible.map((c) => {
            const other = c.participantIds.find((p) => p !== user!.uid)!;
            const unread = c.unreadCounts?.[user!.uid] ?? 0;
            const active = pathname === `/messages/${c.conversationId}`;
            return (
              <li key={c.conversationId}>
                <Link
                  href={`/messages/${c.conversationId}`}
                  className={cn("flex gap-3 border-b border-border px-4 py-3 hover:bg-muted", active && "bg-primary-soft/60 hover:bg-primary-soft/60")}
                  aria-current={active ? "page" : undefined}
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted font-semibold text-muted-foreground" aria-hidden>
                    {(c.participantNames[other] ?? "?").slice(0, 1)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className={cn("truncate text-sm", unread ? "font-semibold" : "font-medium")}>{c.participantNames[other]}</span>
                      {c.lastMessageAt && <span className="shrink-0 text-xs text-muted-foreground">{formatRelative(c.lastMessageAt.toMillis())}</span>}
                    </span>
                    <span className="block truncate text-xs text-primary">{c.productName ?? "General enquiry"}</span>
                    <span className="flex items-center justify-between gap-2">
                      <span className={cn("truncate text-xs", unread ? "text-foreground" : "text-muted-foreground")}>
                        {c.status === "blocked" ? "Blocked" : c.lastMessagePreview ?? "No messages yet"}
                      </span>
                      {unread > 0 && (
                        <span className="min-w-5 shrink-0 rounded-full bg-primary px-1.5 text-center text-[11px] font-semibold leading-5 text-white tabular" aria-label={`${unread} unread`}>
                          {unread}
                        </span>
                      )}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
