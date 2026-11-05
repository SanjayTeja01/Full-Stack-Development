"use client";

import * as React from "react";
import Link from "next/link";
import { BadgeCheck, Heart, MapPin, MessageSquare, PackageOpen } from "lucide-react";
import { doc, onSnapshot } from "firebase/firestore";
import type { Product, UserProfile } from "@shared/types";
import { firebase } from "@/lib/firebase/client";
import { subscribeFarmerProducts } from "@/lib/data/products";
import { useCategories } from "@/lib/data/categories";
import { saveFarmer, unsaveFarmer, useIsSaved } from "@/lib/data/saved";
import { useAuth } from "@/components/auth/auth-provider";
import { useStartConversation } from "@/components/marketplace/contact-actions";
import { ProductCard, ProductCardSkeleton } from "@/components/marketplace/product-card";
import { ReportButton } from "@/components/reports/report-dialog";
import { Button } from "@/components/ui/button";
import { EmptyState, Spinner } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/firebase/callable";
import { formatDate } from "@/lib/format";

export function FarmerProfileView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const { user, role } = useAuth();
  const toast = useToast();
  const [profile, setProfile] = React.useState<UserProfile | null | undefined>(undefined);
  const [products, setProducts] = React.useState<Product[] | null>(null);
  const { byId } = useCategories(true);
  const { start, busy } = useStartConversation();
  const saved = useIsSaved(user?.uid, "savedFarmers", id);

  React.useEffect(
    () =>
      onSnapshot(
        doc(firebase().db, "users", id),
        (s) => setProfile(s.exists() && s.get("role") === "farmer" ? (s.data() as UserProfile) : null),
        () => setProfile(null),
      ),
    [id],
  );
  React.useEffect(() => subscribeFarmerProducts(id, setProducts, () => setProducts([]), true), [id]);

  if (profile === undefined) return <Spinner />;
  if (profile === null)
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <EmptyState title="Farmer not found" action={<Button asChild><Link href="/marketplace">Browse the marketplace</Link></Button>} />
      </div>
    );

  const active = (products ?? []).filter((p) => p.listingStatus === "active");
  const other = (products ?? []).filter((p) => p.listingStatus !== "active");

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-6 rounded-lg border border-border bg-card p-6 sm:flex-row sm:items-start">
        <div className="flex size-20 shrink-0 items-center justify-center rounded-full bg-primary-soft text-3xl font-semibold text-primary" aria-hidden>
          {profile.displayName.slice(0, 1).toUpperCase()}
        </div>
        <div className="flex-1 space-y-2">
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">
            {profile.displayName}
            {profile.verificationStatus === "verified" && (
              <span className="inline-flex items-center gap-1 rounded bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary">
                <BadgeCheck className="size-3.5" /> Verified farmer
              </span>
            )}
          </h1>
          {profile.organizationName && <p className="text-sm">{profile.organizationName}</p>}
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="size-4" /> {profile.location.district}, {profile.location.state}
          </p>
          {profile.bio && <p className="max-w-2xl whitespace-pre-line text-sm text-foreground/85">{profile.bio}</p>}
          <p className="text-xs text-muted-foreground">
            Member since {formatDate(profile.createdAt)} · {active.length} active listing{active.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:w-52">
          {role === "buyer" && (
            <>
              <Button onClick={() => start(id, null)} loading={busy}>
                <MessageSquare /> Message
              </Button>
              <Button
                variant="secondary"
                aria-pressed={saved}
                onClick={async () => {
                  try {
                    if (saved) await unsaveFarmer(user!.uid, id);
                    else await saveFarmer(user!.uid, id, profile.displayName);
                  } catch (e) {
                    toast.error(errorMessage(e));
                  }
                }}
              >
                <Heart className={saved ? "fill-danger text-danger" : ""} /> {saved ? "Saved" : "Save farmer"}
              </Button>
            </>
          )}
          {user?.uid !== id && <ReportButton targetType="user" targetId={id} label="Report profile" />}
        </div>
      </div>

      <h2 className="mb-4 mt-10 text-xl font-semibold">Listings</h2>
      {products === null ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      ) : products.length === 0 ? (
        <EmptyState icon={PackageOpen} title="No published listings" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...active, ...other].map((p) => (
            <ProductCard key={p.productId} product={p} categoryName={byId.get(p.categoryId)?.name} />
          ))}
        </div>
      )}
    </div>
  );
}
