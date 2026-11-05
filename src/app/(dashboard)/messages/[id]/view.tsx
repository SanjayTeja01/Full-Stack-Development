"use client";

import * as React from "react";
import { Suspense } from "react";
import { Thread } from "@/components/chat/thread";
import { Spinner } from "@/components/ui/feedback";

export function ConversationView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  return (
    <Suspense fallback={<Spinner />}>
      <Thread key={id} conversationId={id} />
    </Suspense>
  );
}
