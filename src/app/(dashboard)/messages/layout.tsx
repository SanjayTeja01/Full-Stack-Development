"use client";

import { useSelectedLayoutSegment } from "next/navigation";
import { RequireAuth } from "@/components/auth/require-auth";
import { ConversationList } from "@/components/chat/conversation-list";
import { cn } from "@/lib/utils";

export default function MessagesLayout({ children }: { children: React.ReactNode }) {
  const segment = useSelectedLayoutSegment();
  const inThread = !!segment;
  return (
    <RequireAuth roles={["farmer", "buyer"]}>
      <div className="-mx-4 -my-6 grid h-[calc(100vh-4rem)] sm:-mx-6 lg:-mx-8 lg:grid-cols-[320px_1fr]">
        <aside className={cn("min-h-0 border-r border-border bg-card", inThread && "hidden lg:block")} aria-label="Conversations">
          <ConversationList />
        </aside>
        <section className={cn("min-h-0 min-w-0", !inThread && "hidden lg:block")}>{children}</section>
      </div>
    </RequireAuth>
  );
}
