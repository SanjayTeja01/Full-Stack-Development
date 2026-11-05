import { Suspense } from "react";
import { AuctionDetail } from "./auction-detail";
import { Spinner } from "@/components/ui/feedback";

export default function AuctionPage({ params }: PageProps<"/auctions/[id]">) {
  return (
    <Suspense fallback={<Spinner />}>
      <AuctionDetail params={params} />
    </Suspense>
  );
}
