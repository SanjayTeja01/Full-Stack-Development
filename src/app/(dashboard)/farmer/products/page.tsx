"use client";

import * as React from "react";
import Link from "next/link";
import { Boxes, Eye, Gavel, MoreHorizontal, Pause, Pencil, Play, Plus, Trash2, Warehouse, CircleSlash } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import type { ListingStatus, Product } from "@shared/types";
import { formatINR } from "@shared/money";
import { formatQuantity, unitShort } from "@shared/units";
import { useAuth } from "@/components/auth/auth-provider";
import { subscribeFarmerProducts } from "@/lib/data/products";
import { useCategories } from "@/lib/data/categories";
import { call, errorMessage } from "@/lib/firebase/callable";
import { PageHeader } from "@/components/layout/app-shell";
import { ProductImage, availabilityBadge } from "@/components/marketplace/product-card";
import { StockDialog } from "@/components/products/stock-dialog";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate } from "@/lib/format";

type Filter = "all" | "active" | "draft" | "paused" | "sold_out" | "removed";

export default function FarmerProductsPage() {
  const { user } = useAuth();
  const [items, setItems] = React.useState<Product[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<Filter>("all");
  const { byId } = useCategories(true);

  React.useEffect(() => {
    if (!user) return;
    return subscribeFarmerProducts(user.uid, setItems, (e) => setError(e.message));
  }, [user]);

  const visible = (items ?? []).filter((p) => (filter === "all" ? p.listingStatus !== "removed" : p.listingStatus === filter));
  const count = (s: Filter) => (items ?? []).filter((p) => (s === "all" ? p.listingStatus !== "removed" : p.listingStatus === s)).length;

  return (
    <>
      <PageHeader
        title="My listings"
        description="Manage produce, prices and stock. Reserved and committed stock is protected automatically."
        actions={
          <Button asChild>
            <Link href="/farmer/products/new">
              <Plus /> Add listing
            </Link>
          </Button>
        }
      />
      <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
        <TabsList className="mb-4">
          {(
            [
              ["all", "All"],
              ["active", "Active"],
              ["draft", "Drafts"],
              ["paused", "Paused"],
              ["sold_out", "Unavailable"],
              ["removed", "Removed"],
            ] as [Filter, string][]
          ).map(([v, l]) => (
            <TabsTrigger key={v} value={v}>
              {l} {items && <span className="ml-1 text-xs text-muted-foreground tabular">{count(v)}</span>}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {error ? (
        <ErrorState message="Your listings could not be loaded." onRetry={() => location.reload()} />
      ) : !items ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title={filter === "all" ? "You have no listings yet" : "Nothing here"}
          description={filter === "all" ? "Add your first listing with a price, quantity and photos." : undefined}
          action={
            filter === "all" && (
              <Button asChild>
                <Link href="/farmer/products/new">
                  <Plus /> Add listing
                </Link>
              </Button>
            )
          }
        />
      ) : (
        <ul className="space-y-3">
          {visible.map((p) => (
            <ProductRow key={p.productId} product={p} categoryName={byId.get(p.categoryId)?.name} />
          ))}
        </ul>
      )}
    </>
  );
}

function ProductRow({ product: p, categoryName }: { product: Product; categoryName?: string }) {
  const toast = useToast();
  const [stockOpen, setStockOpen] = React.useState(false);
  const [confirm, setConfirm] = React.useState<null | "removed" | "sold_out">(null);
  const [busy, setBusy] = React.useState(false);
  const unit = unitShort(p.unit);

  const setStatus = async (status: ListingStatus) => {
    setBusy(true);
    try {
      await call("setProductStatus", { productId: p.productId, status });
      toast.success(
        status === "active" ? "Listing is live." : status === "paused" ? "Listing paused." : status === "removed" ? "Listing removed." : "Marked unavailable.",
      );
      setConfirm(null);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const item = "flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-muted data-[disabled]:opacity-50";
  return (
    <li className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center">
      <div className="size-20 shrink-0 overflow-hidden rounded-md bg-muted">
        <ProductImage product={p} />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/products/${p.productId}`} className="font-semibold hover:text-primary">
            {p.name}
          </Link>
          {availabilityBadge(p)}
          {p.moderationStatus === "flagged" && <Badge tone="warning">Flagged for review</Badge>}
          {p.moderationStatus === "removed_by_admin" && <Badge tone="danger">Removed by admin</Badge>}
        </div>
        <p className="text-sm text-muted-foreground">
          {categoryName ?? p.categoryId} · <span className="tabular">{formatINR(p.pricePerUnit)}/{unit}</span> · updated {formatDate(p.updatedAt)}
        </p>
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm tabular">
          <span>
            <span className="text-muted-foreground">Available</span> {formatQuantity(p.availableQuantity, p.unit)}
          </span>
          {p.reservedQuantity > 0 && (
            <span>
              <span className="text-muted-foreground">In auctions</span> {formatQuantity(p.reservedQuantity, p.unit)}
            </span>
          )}
          {p.committedQuantity > 0 && (
            <span>
              <span className="text-muted-foreground">Committed</span> {formatQuantity(p.committedQuantity, p.unit)}
            </span>
          )}
          {p.soldQuantity > 0 && (
            <span>
              <span className="text-muted-foreground">Sold</span> {formatQuantity(p.soldQuantity, p.unit)}
            </span>
          )}
        </p>
      </div>
      {p.listingStatus !== "removed" && (
        <div className="flex shrink-0 gap-2">
          {p.listingStatus === "draft" ? (
            <Button size="sm" onClick={() => setStatus("active")} loading={busy}>
              Publish
            </Button>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => setStockOpen(true)}>
              <Warehouse /> Update stock
            </Button>
          )}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Button size="icon" variant="ghost" aria-label={`More actions for ${p.name}`}>
                <MoreHorizontal />
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content align="end" sideOffset={4} className="z-50 min-w-48 rounded-md border border-border bg-card p-1 shadow-lg">
                <DropdownMenu.Item asChild className={item}>
                  <Link href={`/products/${p.productId}`}>
                    <Eye className="size-4" /> View listing
                  </Link>
                </DropdownMenu.Item>
                <DropdownMenu.Item asChild className={item}>
                  <Link href={`/farmer/products/${p.productId}/edit`}>
                    <Pencil className="size-4" /> Edit details
                  </Link>
                </DropdownMenu.Item>
                {p.listingStatus === "active" && (
                  <DropdownMenu.Item asChild className={item}>
                    <Link href={`/farmer/auctions/new?product=${p.productId}`}>
                      <Gavel className="size-4" /> Create auction
                    </Link>
                  </DropdownMenu.Item>
                )}
                {p.listingStatus === "active" && (
                  <DropdownMenu.Item className={item} onSelect={() => setStatus("paused")}>
                    <Pause className="size-4" /> Pause listing
                  </DropdownMenu.Item>
                )}
                {(p.listingStatus === "paused" || p.listingStatus === "sold_out") && (
                  <DropdownMenu.Item className={item} disabled={p.moderationStatus === "removed_by_admin"} onSelect={() => setStatus("active")}>
                    <Play className="size-4" /> Reactivate
                  </DropdownMenu.Item>
                )}
                {(p.listingStatus === "active" || p.listingStatus === "paused") && (
                  <DropdownMenu.Item className={item} onSelect={() => setConfirm("sold_out")}>
                    <CircleSlash className="size-4" /> Mark sold / unavailable
                  </DropdownMenu.Item>
                )}
                <DropdownMenu.Separator className="my-1 h-px bg-border" />
                <DropdownMenu.Item className={`${item} text-danger`} onSelect={() => setConfirm("removed")}>
                  <Trash2 className="size-4" /> Remove listing
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      )}
      <StockDialog product={p} open={stockOpen} onOpenChange={setStockOpen} />
      <ConfirmDialog
        open={confirm === "removed"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Remove this listing?"
        description={
          p.reservedQuantity > 0 || p.committedQuantity > 0
            ? "This listing has stock in an auction or an agreement, so it cannot be removed yet. Pause it instead."
            : "Buyers will no longer see it, and any pending offers on it will be cancelled. This cannot be undone."
        }
        confirmLabel="Remove listing"
        loading={busy}
        onConfirm={() => setStatus("removed")}
      />
      <ConfirmDialog
        open={confirm === "sold_out"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Mark as sold or unavailable?"
        description="Buyers will see it as currently unavailable and cannot make new offers. You can reactivate it later."
        confirmLabel="Mark unavailable"
        tone="primary"
        loading={busy}
        onConfirm={() => setStatus("sold_out")}
      />
    </li>
  );
}
