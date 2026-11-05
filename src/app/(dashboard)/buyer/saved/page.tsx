"use client";

import Link from "next/link";
import { Heart, Trash2 } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { unsaveFarmer, unsaveProduct, useSaved, type SavedFarmer, type SavedProduct } from "@/lib/data/saved";
import { PageHeader } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, Skeleton } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";

export default function SavedPage() {
  const { user } = useAuth();
  const products = useSaved<SavedProduct>(user?.uid, "savedProducts");
  const farmers = useSaved<SavedFarmer>(user?.uid, "savedFarmers");
  return (
    <>
      <PageHeader title="Saved" description="Products and farmers you bookmarked." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Products</CardTitle>
          </CardHeader>
          <CardContent>
            {!products.items ? (
              <Skeleton className="h-24" />
            ) : products.items.length === 0 ? (
              <EmptyState icon={Heart} title="No saved products" action={<Button asChild variant="secondary"><Link href="/marketplace">Browse marketplace</Link></Button>} />
            ) : (
              <ul className="divide-y divide-border">
                {products.items.map((p) => (
                  <li key={p.productId} className="flex items-center justify-between gap-3 py-3">
                    <Link href={`/products/${p.productId}`} className="min-w-0">
                      <span className="block truncate font-medium hover:text-primary">{p.productName}</span>
                      <span className="text-xs text-muted-foreground">Saved {formatDate(p.savedAt)}</span>
                    </Link>
                    <Button size="icon" variant="ghost" aria-label={`Remove ${p.productName}`} onClick={() => unsaveProduct(user!.uid, p.productId)}>
                      <Trash2 />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Farmers</CardTitle>
          </CardHeader>
          <CardContent>
            {!farmers.items ? (
              <Skeleton className="h-24" />
            ) : farmers.items.length === 0 ? (
              <EmptyState icon={Heart} title="No saved farmers" />
            ) : (
              <ul className="divide-y divide-border">
                {farmers.items.map((f) => (
                  <li key={f.farmerId} className="flex items-center justify-between gap-3 py-3">
                    <Link href={`/farmers/${f.farmerId}`} className="min-w-0">
                      <span className="block truncate font-medium hover:text-primary">{f.farmerName}</span>
                      <span className="text-xs text-muted-foreground">Saved {formatDate(f.savedAt)}</span>
                    </Link>
                    <Button size="icon" variant="ghost" aria-label={`Remove ${f.farmerName}`} onClick={() => unsaveFarmer(user!.uid, f.farmerId)}>
                      <Trash2 />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
