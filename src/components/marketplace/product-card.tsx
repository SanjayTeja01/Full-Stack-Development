import Link from "next/link";
import { BadgeCheck, MapPin, Wheat } from "lucide-react";
import type { Product } from "@shared/types";
import { formatINR } from "@shared/money";
import { formatQuantity, unitShort } from "@shared/units";
import { Badge } from "@/components/ui/badge";

export function ProductImage({ product, className }: { product: Pick<Product, "images" | "name">; className?: string }) {
  const img = product.images[0];
  return img ? (
    // eslint-disable-next-line @next/next/no-img-element -- user uploads from Firebase Storage
    <img src={img.url} alt={product.name} className={className ?? "h-full w-full object-cover"} loading="lazy" />
  ) : (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary-soft to-accent-soft text-primary/60" aria-hidden>
      <Wheat className="size-10" />
    </div>
  );
}

export function availabilityBadge(p: Product) {
  if (p.listingStatus === "paused") return <Badge tone="warning">Paused</Badge>;
  if (p.listingStatus === "sold_out" || p.availableQuantity === 0) return <Badge tone="neutral">Currently unavailable</Badge>;
  if (p.listingStatus === "draft") return <Badge tone="neutral">Draft</Badge>;
  if (p.listingStatus === "removed") return <Badge tone="danger">Removed</Badge>;
  return <Badge tone="success">Available</Badge>;
}

export function ProductCard({ product, categoryName }: { product: Product; categoryName?: string }) {
  return (
    <Link
      href={`/products/${product.productId}`}
      className="product-card group flex flex-col overflow-hidden border border-border bg-card transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="aspect-[4/3] overflow-hidden bg-muted">
        <ProductImage product={product} />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate font-semibold group-hover:text-primary">{product.name}</h3>
            {categoryName && <p className="text-xs text-muted-foreground">{categoryName}</p>}
          </div>
          {availabilityBadge(product)}
        </div>
        <p className="tabular">
          <span className="text-lg font-semibold">{formatINR(product.pricePerUnit)}</span>
          <span className="text-sm text-muted-foreground"> / {unitShort(product.unit)} asking</span>
        </p>
        <dl className="grid grid-cols-1 gap-1 text-sm text-muted-foreground">
          <div className="flex justify-between gap-2">
            <dt>Available</dt>
            <dd className="tabular font-medium text-foreground">{formatQuantity(product.availableQuantity, product.unit)}</dd>
          </div>
          {product.qualityGrade && (
            <div className="flex justify-between gap-2">
              <dt>Grade</dt>
              <dd className="truncate text-foreground">{product.qualityGrade}</dd>
            </div>
          )}
        </dl>
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
          <span className="flex min-w-0 items-center gap-1">
            <MapPin className="size-3.5 shrink-0" />
            <span className="truncate">
              {product.location.district}, {product.location.state}
            </span>
          </span>
          <span className="flex min-w-0 items-center gap-1">
            <span className="truncate">{product.farmerName}</span>
            {product.farmerVerified && <BadgeCheck className="size-3.5 shrink-0 text-primary" aria-label="Verified farmer" />}
          </span>
        </div>
      </div>
    </Link>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card" aria-hidden>
      <div className="aspect-[4/3] animate-pulse bg-muted" />
      <div className="space-y-3 p-4">
        <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
        <div className="h-5 w-1/3 animate-pulse rounded bg-muted" />
        <div className="h-3 w-full animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}
