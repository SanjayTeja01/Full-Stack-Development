"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/layout/app-shell";
import { AuctionForm } from "@/components/auctions/auction-form";
import { Spinner } from "@/components/ui/feedback";

function NewAuction() {
  const params = useSearchParams();
  return <AuctionForm initialProductId={params.get("product")} />;
}

export default function NewAuctionPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Create an auction" description="Let buyers compete for a quantity from one of your listings. Save a draft or publish when ready." />
      <Suspense fallback={<Spinner />}>
        <NewAuction />
      </Suspense>
    </div>
  );
}
