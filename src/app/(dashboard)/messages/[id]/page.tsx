import { Suspense } from "react";
import { ConversationView } from "./view";
import { Spinner } from "@/components/ui/feedback";

export default function Page({ params }: PageProps<"/messages/[id]">) {
  return (
    <Suspense fallback={<Spinner />}>
      <ConversationView params={params} />
    </Suspense>
  );
}
