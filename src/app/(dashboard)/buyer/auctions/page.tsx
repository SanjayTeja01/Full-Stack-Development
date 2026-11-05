import { PageHeader } from "@/components/layout/app-shell";
import { AuctionsView } from "@/components/auctions/auctions-view";

export default function BuyerAuctionsPage() {
  return (
    <>
      <PageHeader title="Live bidding" description="Live and upcoming auctions. Open an auction to see the minimum next bid and place a bid." />
      <AuctionsView />
    </>
  );
}
