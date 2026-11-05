import { Suspense } from "react";
import { EditAuctionView } from "./view";
import { Spinner } from "@/components/ui/feedback";

export default function Page({ params }: PageProps<"/farmer/auctions/[id]/edit">) {
  return (
    <Suspense fallback={<Spinner />}>
      <EditAuctionView params={params} />
    </Suspense>
  );
}
