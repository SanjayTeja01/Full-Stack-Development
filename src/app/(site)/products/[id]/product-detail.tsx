"use client";

import * as React from "react";
import Link from "next/link";
import { BadgeCheck, CalendarDays, ChevronLeft, Gavel, MapPin, Ruler } from "lucide-react";
import type { Auction, Product, UserProfile } from "@shared/types";
import { formatINR } from "@shared/money";
import { formatQuantity, unitShort, UNITS } from "@shared/units";
import { auctionPhase } from "@shared/auction";
import { collection, doc, getDoc, onSnapshot, query, where } from "firebase/firestore";
import { firebase } from "@/lib/firebase/client";
import { subscribeProduct } from "@/lib/data/products";
import { useCategories } from "@/lib/data/categories";
import { useServerNow } from "@/lib/hooks/use-server-clock";
import { ProductImage, availabilityBadge } from "@/components/marketplace/product-card";
import { ProductBuyerActions } from "@/components/marketplace/contact-actions";
import { AuctionPhaseBadge } from "@/components/auctions/auction-status";
import { ReportButton } from "@/components/reports/report-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, ErrorState, Spinner } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export function ProductDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const [product, setProduct] = React.useState<Product | null | undefined>(undefined);
  const [farmer, setFarmer] = React.useState<UserProfile | null>(null);
  const [auctions, setAuctions] = React.useState<Auction[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [active, setActive] = React.useState(0);
  const { byId } = useCategories(true);
  const { now } = useServerNow(30_000);

  React.useEffect(() => subscribeProduct(id, setProduct, (e) => setError((e as Error & { code?: string }).code === "permission-denied" ? "denied" : e.message)), [id]);
  const farmerId = product?.farmerId;
  React.useEffect(() => {
    if (!farmerId) return;
    getDoc(doc(firebase().db, "users", farmerId)).then((s) => setFarmer(s.exists() ? (s.data() as UserProfile) : null), () => undefined);
    const q = query(collection(firebase().db, "auctions"), where("productId", "==", id), where("status", "in", ["scheduled", "live"]));
    return onSnapshot(q, (s) => setAuctions(s.docs.map((d) => d.data() as Auction)), () => setAuctions([]));
  }, [farmerId, id]);

  // A listing that is removed or unpublished while being viewed becomes unreadable by the rules.
  if (error === "denied" || product === null || product?.listingStatus === "removed")
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <EmptyState
          title="This listing is no longer available"
          description="The farmer may have removed it. Browse other listings in the marketplace."
          action={
            <Button asChild>
              <Link href="/marketplace">Back to marketplace</Link>
            </Button>
          }
        />
      </div>
    );
  if (error) return <div className="mx-auto max-w-xl px-4 py-16"><ErrorState message="This listing could not be loaded." onRetry={() => location.reload()} /></div>;
  if (!product) return <Spinner />;

  const unit = unitShort(product.unit);
  const canTrade = product.listingStatus === "active" && product.availableQuantity > 0;
  const img = product.images[active];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <Link href="/marketplace" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> Marketplace
      </Link>
      <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-3">
          <div className="aspect-[4/3] overflow-hidden rounded-lg border border-border bg-muted">
            {img ? (
              // eslint-disable-next-line @next/next/no-img-element -- user uploads
              <img src={img.url} alt={`${product.name}, photo ${active + 1}`} className="h-full w-full object-cover" />
            ) : (
              <ProductImage product={product} />
            )}
          </div>
          {product.images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto">
              {product.images.map((im, i) => (
                <button
                  key={im.path}
                  type="button"
                  onClick={() => setActive(i)}
                  className={cn("size-16 shrink-0 overflow-hidden rounded border-2", i === active ? "border-primary" : "border-transparent")}
                  aria-label={`Show photo ${i + 1}`}
                  aria-current={i === active}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- user uploads */}
                  <img src={im.url} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
          <Card>
            <CardContent className="space-y-4 pt-5">
              <div>
                <h2 className="font-semibold">Description</h2>
                <p className="mt-1 whitespace-pre-line text-sm text-foreground/85">{product.description}</p>
              </div>
              {product.qualityDetails && (
                <div>
                  <h2 className="font-semibold">Quality details</h2>
                  <p className="mt-1 whitespace-pre-line text-sm text-foreground/85">{product.qualityDetails}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              {availabilityBadge(product)}
              <span className="text-sm text-muted-foreground">{byId.get(product.categoryId)?.name}</span>
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{product.name}</h1>
          </div>
          <Card>
            <CardContent className="space-y-4 pt-5">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Asking price</p>
                <p className="tabular">
                  <span className="text-3xl font-semibold">{formatINR(product.pricePerUnit)}</span>
                  <span className="text-muted-foreground"> per {UNITS[product.unit].label.toLowerCase()}</span>
                </p>
                {product.unit !== "quintal" && (
                  <p className="text-sm text-muted-foreground tabular">≈ {formatINR(product.normalizedPricePerQuintal)} per quintal</p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">Transport, loading and other charges are not included unless agreed in an offer.</p>
              </div>
              <dl className="grid grid-cols-2 gap-3 border-t border-border pt-4 text-sm">
                <div>
                  <dt className="text-muted-foreground">Available now</dt>
                  <dd className="font-semibold tabular">{formatQuantity(product.availableQuantity, product.unit)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Minimum order</dt>
                  <dd className="tabular">{formatQuantity(product.minOrderQuantity, product.unit)}</dd>
                </div>
                <div>
                  <dt className="flex items-center gap-1 text-muted-foreground">
                    <Ruler className="size-3.5" /> Grade
                  </dt>
                  <dd>{product.qualityGrade ?? "Not specified"}</dd>
                </div>
                <div>
                  <dt className="flex items-center gap-1 text-muted-foreground">
                    <CalendarDays className="size-3.5" /> Harvested
                  </dt>
                  <dd>{product.harvestDate ? formatDate(new Date(product.harvestDate).getTime()) : "Not specified"}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="flex items-center gap-1 text-muted-foreground">
                    <MapPin className="size-3.5" /> Location
                  </dt>
                  <dd>
                    {[product.location.village, product.location.district, product.location.state].filter(Boolean).join(", ")}
                  </dd>
                </div>
              </dl>
              <ProductBuyerActions farmerId={product.farmerId} productId={product.productId} productName={product.name} canTrade={canTrade} />
            </CardContent>
          </Card>

          {auctions.length > 0 && (
            <Card>
              <CardContent className="space-y-3 pt-5">
                <h2 className="flex items-center gap-2 font-semibold">
                  <Gavel className="size-4 text-accent" /> Auctions for this produce
                </h2>
                {auctions.map((a) => (
                  <Link key={a.auctionId} href={`/auctions/${a.auctionId}`} className="flex items-center justify-between gap-3 rounded-md border border-border p-3 hover:bg-muted">
                    <span className="text-sm">
                      {formatQuantity(a.quantity, a.unit)} · from {formatINR(a.startingPrice)}/{unit}
                      <span className="block text-xs text-muted-foreground">Ends {formatDateTime(a.endsAt)}</span>
                    </span>
                    {now > 0 && <AuctionPhaseBadge phase={auctionPhase({ status: a.status, startsAtMs: a.startsAt.toMillis(), endsAtMs: a.endsAt.toMillis() }, now)} />}
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="pt-5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Sold by</p>
              <Link href={`/farmers/${product.farmerId}`} className="mt-1 flex items-center gap-2 font-semibold hover:text-primary">
                {product.farmerName}
                {product.farmerVerified && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                    <BadgeCheck className="size-4" /> Verified
                  </span>
                )}
              </Link>
              <p className="text-sm text-muted-foreground">
                {farmer ? `${farmer.location.district}, ${farmer.location.state}` : null}
                {farmer?.organizationName ? ` · ${farmer.organizationName}` : null}
              </p>
              {farmer && <p className="mt-1 text-xs text-muted-foreground">On FarmConnect since {formatDate(farmer.createdAt)}</p>}
            </CardContent>
          </Card>
          <div className="flex justify-end">
            <ReportButton targetType="product" targetId={product.productId} label="Report listing" />
          </div>
        </div>
      </div>
    </div>
  );
}
