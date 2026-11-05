"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Gavel, PackageOpen } from "lucide-react";
import type { Auction, Product } from "@shared/types";
import { subscribeLatestProducts } from "@/lib/data/products";
import { subscribeOpenAuctions } from "@/lib/data/auctions";
import { useCategories } from "@/lib/data/categories";
import { useServerNow } from "@/lib/hooks/use-server-clock";
import { ProductCard, ProductCardSkeleton } from "@/components/marketplace/product-card";
import { AuctionCard } from "@/components/auctions/auction-card";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";

function categoryPhoto(categoryId: string, name: string) {
  const category = `${categoryId} ${name}`.toLowerCase();
  if (/pulse|legume/.test(category)) return "pulses";
  if (/oil.?seed/.test(category)) return "oilseeds";
  if (/fruit|orchard/.test(category)) return "fruits";
  if (/vegetable|produce/.test(category)) return "vegetables";
  if (/cereal|grain/.test(category)) return "maize";
  if (/spice|chilli|chili/.test(category)) return "chillies";
  if (/cotton/.test(category)) return "cotton";
  return "paddy";
}

export function CategoryGrid() {
  const { categories, loading, error } = useCategories();
  if (error) return <ErrorState message="Categories could not be loaded." />;
  if (loading)
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  if (!categories?.length) return <EmptyState title="Categories have not been set up yet" />;
  return (
    <ul className="category-grid">
      {categories.map((c) => (
        <li key={c.id}>
          <Link
            href={`/marketplace?category=${c.id}`}
            className="category-tile"
          >
            <Image src={`/images/${categoryPhoto(c.id, c.name)}.webp`} alt="" fill sizes="(max-width: 767px) 50vw, 25vw" />
            <div className="category-tile-shade" />
            <div className="category-tile-copy"><div><h3>{c.name}</h3><ArrowRight /></div><p className="line-clamp-2">{c.examples.join(" · ")}</p></div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function FeaturedProducts() {
  const [items, setItems] = React.useState<Product[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [attempt, setAttempt] = React.useState(0);
  const { byId } = useCategories();
  React.useEffect(() => subscribeLatestProducts(8, setItems, (e) => setError(e.message)), [attempt]);

  if (error)
    return (
      <ErrorState
        message="Listings could not be loaded."
        onRetry={() => {
          setError(null);
          setAttempt((a) => a + 1);
        }}
      />
    );
  if (!items)
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    );
  if (items.length === 0)
    return (
      <EmptyState
        icon={PackageOpen}
        title="No produce is listed yet"
        description="When farmers publish listings they will appear here. Are you a farmer? Your listing could be the first."
        action={
          <Button asChild>
            <Link href="/register?role=farmer">List your produce</Link>
          </Button>
        }
      />
    );
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((p) => (
        <ProductCard key={p.productId} product={p} categoryName={byId.get(p.categoryId)?.name} />
      ))}
    </div>
  );
}

export function AuctionsPreview() {
  const [items, setItems] = React.useState<Auction[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const { now, ready } = useServerNow(1000);
  React.useEffect(() => subscribeOpenAuctions(setItems, (e) => setError(e.message), 12), []);

  const visible = React.useMemo(() => (items ?? []).filter((a) => a.endsAt.toMillis() > now).slice(0, 3), [items, now]);
  if (error) return <ErrorState message="Auctions could not be loaded." />;
  if (!items || !ready)
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-72" />
        ))}
      </div>
    );
  if (visible.length === 0)
    return (
      <EmptyState
        icon={Gavel}
        title="No auctions are scheduled right now"
        description="Farmers can schedule time-limited auctions for their produce. Live and upcoming auctions will show here."
        action={
          <Button asChild variant="secondary">
            <Link href="/marketplace">
              Browse listings instead <ArrowRight />
            </Link>
          </Button>
        }
      />
    );
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {visible.map((a) => (
        <AuctionCard key={a.auctionId} auction={a} now={now} />
      ))}
    </div>
  );
}
