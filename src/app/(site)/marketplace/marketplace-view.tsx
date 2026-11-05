"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PackageSearch, SlidersHorizontal, X } from "lucide-react";
import type { DocumentData, QueryDocumentSnapshot } from "firebase/firestore";
import type { Product } from "@shared/types";
import { parseRupeesToPaise } from "@shared/money";
import { INDIAN_STATES, QUALITY_GRADES } from "@shared/categories";
import { searchProducts, type ProductFilters, type ProductSort } from "@/lib/data/products";
import { useCategories } from "@/lib/data/categories";
import { ProductCard, ProductCardSkeleton } from "@/components/marketplace/product-card";
import { Button } from "@/components/ui/button";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { EmptyState, ErrorState } from "@/components/ui/feedback";
import { cn } from "@/lib/utils";

const KEYS = ["q", "category", "state", "district", "minPrice", "maxPrice", "minQty", "grade", "harvestedAfter", "verified", "sort"] as const;
type FormState = Record<(typeof KEYS)[number], string>;

function readParams(p: URLSearchParams): FormState {
  return Object.fromEntries(KEYS.map((k) => [k, p.get(k) ?? ""])) as FormState;
}

function toFilters(f: FormState): ProductFilters {
  return {
    q: f.q || undefined,
    categoryId: f.category || undefined,
    state: f.state || undefined,
    district: f.district || undefined,
    minPrice: f.minPrice ? parseRupeesToPaise(f.minPrice) : null,
    maxPrice: f.maxPrice ? parseRupeesToPaise(f.maxPrice) : null,
    minQuantity: f.minQty && /^\d+$/.test(f.minQty) ? Number(f.minQty) * 100 : null,
    grade: f.grade || undefined,
    harvestedAfter: f.harvestedAfter || undefined,
    verifiedOnly: f.verified === "1",
    sort: (f.sort as ProductSort) || "newest",
  };
}

export function MarketplaceView() {
  const params = useSearchParams();
  const router = useRouter();
  const { categories, byId } = useCategories();
  const applied = React.useMemo(() => readParams(params), [params]);
  const [form, setForm] = React.useState<FormState>(applied);
  const [items, setItems] = React.useState<Product[] | null>(null);
  const [cursor, setCursor] = React.useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [exhausted, setExhausted] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [showFilters, setShowFilters] = React.useState(false);
  const [attempt, setAttempt] = React.useState(0);

  React.useEffect(() => {
    let alive = true;
    searchProducts(toFilters(applied), null).then(
      (page) => {
        if (!alive) return;
        setItems(page.items);
        setCursor(page.cursor);
        setExhausted(page.exhausted);
        setError(null);
      },
      (e: Error) => alive && setError(e.message),
    );
    return () => {
      alive = false;
    };
  }, [applied, attempt]);

  const apply = (next: FormState) => {
    const sp = new URLSearchParams();
    for (const k of KEYS) if (next[k]) sp.set(k, next[k]);
    setItems(null);
    if (sp.toString() === params.toString()) setAttempt((a) => a + 1);
    else router.replace(`/marketplace${sp.size ? `?${sp}` : ""}`, { scroll: false });
    setShowFilters(false);
  };

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const page = await searchProducts(toFilters(applied), cursor);
      setItems((prev) => [...(prev ?? []), ...page.items.filter((p) => !prev?.some((x) => x.productId === p.productId))]);
      setCursor(page.cursor);
      setExhausted(page.exhausted);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoadingMore(false);
    }
  };

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? ((e.target as HTMLInputElement).checked ? "1" : "") : e.target.value }));
  const activeCount = KEYS.filter((k) => k !== "sort" && k !== "q" && applied[k]).length;

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[260px_1fr]">
      <aside className={cn("lg:block", showFilters ? "block" : "hidden")} aria-label="Filters">
        <form
          className="space-y-4 rounded-lg border border-border bg-card p-4 lg:sticky lg:top-20"
          onSubmit={(e) => {
            e.preventDefault();
            apply(form);
          }}
        >
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Filters</h2>
            {activeCount > 0 && (
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={() => {
                  const cleared = { ...readParams(new URLSearchParams()), q: form.q, sort: form.sort };
                  setForm(cleared);
                  apply(cleared);
                }}
              >
                Clear all
              </button>
            )}
          </div>
          <Field label="Category" htmlFor="f-category">
            <NativeSelect id="f-category" value={form.category} onChange={set("category")}>
              <option value="">All categories</option>
              {categories?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="State" htmlFor="f-state">
            <NativeSelect id="f-state" value={form.state} onChange={set("state")}>
              <option value="">Any state</option>
              {INDIAN_STATES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="District" htmlFor="f-district">
            <Input id="f-district" value={form.district} onChange={set("district")} placeholder="e.g. Guntur" />
          </Field>
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium">Price per quintal (₹)</legend>
            <div className="flex gap-2">
              <Input aria-label="Minimum price per quintal" inputMode="decimal" placeholder="Min" value={form.minPrice} onChange={set("minPrice")} />
              <Input aria-label="Maximum price per quintal" inputMode="decimal" placeholder="Max" value={form.maxPrice} onChange={set("maxPrice")} />
            </div>
          </fieldset>
          <Field label="Minimum available (quintals)" htmlFor="f-qty">
            <Input id="f-qty" inputMode="numeric" value={form.minQty} onChange={set("minQty")} />
          </Field>
          <Field label="Quality grade" htmlFor="f-grade">
            <NativeSelect id="f-grade" value={form.grade} onChange={set("grade")}>
              <option value="">Any grade</option>
              {QUALITY_GRADES.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Harvested on or after" htmlFor="f-harvest">
            <Input id="f-harvest" type="date" value={form.harvestedAfter} onChange={set("harvestedAfter")} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={form.verified === "1"} onChange={set("verified")} />
            Verified farmers only
          </label>
          <Button type="submit" className="w-full">
            Apply filters
          </Button>
        </form>
      </aside>

      <section aria-label="Results" className="min-w-0">
        <form
          role="search"
          className="mb-4 flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            apply(form);
          }}
        >
          <Input aria-label="Search by product name" placeholder="Search by product, e.g. maize" value={form.q} onChange={set("q")} className="flex-1" />
          <div className="flex min-w-0 gap-2">
            <NativeSelect
              aria-label="Sort"
              value={form.sort || "newest"}
              onChange={(e) => {
                const next = { ...form, sort: e.target.value === "newest" ? "" : e.target.value };
                setForm(next);
                apply(next);
              }}
              className="min-w-0 flex-1 sm:w-auto sm:flex-none"
            >
              <option value="newest">Newest first</option>
              <option value="price_asc">Price per quintal: low to high</option>
              <option value="price_desc">Price per quintal: high to low</option>
            </NativeSelect>
            <Button type="submit">Search</Button>
            <Button type="button" variant="secondary" className="lg:hidden" onClick={() => setShowFilters((s) => !s)} aria-expanded={showFilters}>
              {showFilters ? <X /> : <SlidersHorizontal />}
              <span className="sr-only sm:not-sr-only">Filters{activeCount ? ` (${activeCount})` : ""}</span>
            </Button>
          </div>
        </form>

        {error ? (
          <ErrorState
            message="Listings could not be loaded. Check your connection."
            onRetry={() => {
              setError(null);
              setItems(null);
              setAttempt((a) => a + 1);
            }}
          />
        ) : items === null ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={PackageSearch}
            title="No listings match"
            description={applied.q || activeCount ? "Try removing a filter or searching for a different crop." : "No produce has been published yet."}
            action={
              (applied.q || activeCount > 0) && (
                <Button asChild variant="secondary">
                  <Link href="/marketplace">Clear search</Link>
                </Button>
              )
            }
          />
        ) : (
          <>
            <p className="mb-3 text-sm text-muted-foreground" aria-live="polite">
              Showing {items.length} listing{items.length === 1 ? "" : "s"}
              {!exhausted && " (more available)"}
            </p>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((p) => (
                <ProductCard key={p.productId} product={p} categoryName={byId.get(p.categoryId)?.name} />
              ))}
            </div>
            {!exhausted && (
              <div className="mt-6 flex justify-center">
                <Button variant="secondary" onClick={loadMore} loading={loadingMore}>
                  Load more
                </Button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
