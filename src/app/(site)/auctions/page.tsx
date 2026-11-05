import type { Metadata } from "next";
import Link from "next/link";
import { AuctionsView } from "@/components/auctions/auctions-view";
import { MarketBanner } from "@/components/marketplace/market-banner";

export const metadata: Metadata = { title: "Auctions" };

export default function AuctionsPage() {
  return (
    <>
      <MarketBanner title="An open opportunity" eyebrow="FARMCONNECT AUCTIONS" subtitle="Discover the next lot. Place your bid. Make a connection." image="maize" />
      <div className="site-container py-8">
      <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
        Time-limited auctions run by farmers. Bids are per unit for the full quantity, and the server clock decides when bidding opens and closes.{" "}
        <Link href="/terms#auction-rules" className="font-medium text-primary hover:underline">
          Read the auction rules
        </Link>
        .
      </p>
      <div className="mt-6">
        <AuctionsView />
      </div>
      </div>
    </>
  );
}
