import { MessageSquare } from "lucide-react";

export default function MessagesIndexPage() {
  return (
    <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
      <div>
        <MessageSquare className="mx-auto mb-2 size-8" />
        Select a conversation to read messages and offers.
      </div>
    </div>
  );
}
