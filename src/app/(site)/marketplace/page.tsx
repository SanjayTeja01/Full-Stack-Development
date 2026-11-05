import { Suspense } from "react";
import type { Metadata } from "next";
import { MarketplaceView } from "./marketplace-view";
import { Spinner } from "@/components/ui/feedback";
import { MarketBanner } from "@/components/marketplace/market-banner";

export const metadata: Metadata = { title: "Marketplace" };

export default function MarketplacePage() {
  return (
    <>
      <MarketBanner title="The marketplace" eyebrow="FIND YOUR NEXT CONNECTION" subtitle="Explore the harvest. Compare produce. Talk directly with the grower." image="harvest" />
      <div className="site-container py-8">
      <Suspense fallback={<Spinner />}>
        <MarketplaceView />
      </Suspense>
      </div>
    </>
  );
}
