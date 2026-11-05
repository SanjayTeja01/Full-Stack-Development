"use client";

import * as React from "react";
import type { Product } from "@shared/types";
import { subscribeProduct } from "@/lib/data/products";
import { useAuth } from "@/components/auth/auth-provider";
import { PageHeader } from "@/components/layout/app-shell";
import { ProductForm } from "@/components/products/product-form";
import { EmptyState, ErrorState, Spinner } from "@/components/ui/feedback";

export function EditProductView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const { user } = useAuth();
  const [product, setProduct] = React.useState<Product | null | undefined>(undefined);
  const [error, setError] = React.useState<string | null>(null);
  // Load once so incoming stock updates do not reset the form while the farmer is typing.
  React.useEffect(() => {
    const unsub = subscribeProduct(
      id,
      (p) => {
        setProduct((prev) => (prev === undefined ? p : prev));
      },
      (e) => setError(e.message),
    );
    return unsub;
  }, [id]);

  if (error) return <ErrorState message="This listing could not be loaded." />;
  if (product === undefined) return <Spinner />;
  if (!product || product.farmerId !== user?.uid) return <EmptyState title="Listing not found" description="It may have been removed, or it belongs to another account." />;
  if (product.listingStatus === "removed") return <EmptyState title="This listing was removed" description="Removed listings cannot be edited." />;
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={`Edit ${product.name}`} />
      <ProductForm product={product} />
    </div>
  );
}
