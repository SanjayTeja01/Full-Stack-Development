"use client";

import * as React from "react";
import { doc, getDoc } from "firebase/firestore";
import type { Auction, AuctionPrivateState } from "@shared/types";
import { firebase } from "@/lib/firebase/client";
import { useAuth } from "@/components/auth/auth-provider";
import { PageHeader } from "@/components/layout/app-shell";
import { AuctionForm } from "@/components/auctions/auction-form";
import { EmptyState, ErrorState, Spinner } from "@/components/ui/feedback";

export function EditAuctionView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const { user } = useAuth();
  const [data, setData] = React.useState<{ auction: Auction | null; state: AuctionPrivateState | null } | null>(null);
  const [error, setError] = React.useState(false);
  React.useEffect(() => {
    const { db } = firebase();
    Promise.all([getDoc(doc(db, "auctions", id)), getDoc(doc(db, "auctions", id, "private", "state"))]).then(
      ([a, s]) => setData({ auction: a.exists() ? (a.data() as Auction) : null, state: s.exists() ? (s.data() as AuctionPrivateState) : null }),
      () => setError(true),
    );
  }, [id]);

  if (error) return <ErrorState message="This auction could not be loaded." />;
  if (!data) return <Spinner />;
  const a = data.auction;
  if (!a || a.farmerId !== user?.uid) return <EmptyState title="Auction not found" />;
  if (a.status !== "draft") return <EmptyState title="Only drafts can be edited" description="A published auction can be cancelled before the first bid, then created again." />;
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={`Edit draft: ${a.productName}`} />
      <AuctionForm auction={a} privateState={data.state} />
    </div>
  );
}
