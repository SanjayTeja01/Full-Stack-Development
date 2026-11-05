"use client";

import * as React from "react";
import Link from "next/link";
import { Gavel } from "lucide-react";
import type { Auction } from "@shared/types";
import { auctionPhase, type AuctionPhase } from "@shared/auction";
import { INDIAN_STATES } from "@shared/categories";
import { subscribeEndedAuctions, subscribeOpenAuctions } from "@/lib/data/auctions";
import { useCategories } from "@/lib/data/categories";
import { useServerNow } from "@/lib/hooks/use-server-clock";
import { AuctionCard } from "./auction-card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input, Label, NativeSelect } from "@/components/ui/input";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";

type Tab = "live" | "starting_soon" | "upcoming" | "ended";

const TABS: [Tab, string][] = [
  ["live", "Live now"],
  ["starting_soon", "Starting soon"],
  ["upcoming", "Upcoming"],
  ["ended", "Ended"],
];

const EMPTY: Record<Tab, { title: string; description: string }> = {
  live: { title: "No auctions are live right now", description: "Check the upcoming tab for auctions that farmers have scheduled." },
  starting_soon: { title: "Nothing starts in the next hour", description: "Auctions appear here when they are within an hour of starting." },
  upcoming: { title: "No upcoming auctions", description: "Farmers schedule auctions from their listings. New ones will show here." },
  ended: { title: "No ended auctions yet", description: "Results of finished auctions are listed here." },
};

/** Browses auctions by phase. Phases are derived from the server clock, not the stored status alone. */
export function AuctionsView() {
  const [open, setOpen] = React.useState<Auction[] | null>(null);
  const [ended, setEnded] = React.useState<Auction[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState<Tab>("live");
  const [q, setQ] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [state, setState] = React.useState("");
  const { categories } = useCategories();
  const { now, ready } = useServerNow(1000);

  React.useEffect(() => subscribeOpenAuctions(setOpen, (e) => setError(e.message), 200), []);
  React.useEffect(() => subscribeEndedAuctions(setEnded, (e) => setError(e.message), 48), []);

  const grouped = React.useMemo(() => {
    const g: Record<Tab, Auction[]> = { live: [], starting_soon: [], upcoming: [], ended: [] };
    if (!ready) return g;
    const needle = q.trim().toLowerCase();
    const keep = (a: Auction) =>
      (!needle || a.productName.toLowerCase().includes(needle) || a.farmerName.toLowerCase().includes(needle) || a.location.district.toLowerCase().includes(needle)) &&
      (!category || a.categoryId === category) &&
      (!state || a.location.state === state);
    for (const a of open ?? []) {
      if (!keep(a)) continue;
      const phase: AuctionPhase = auctionPhase({ status: a.status, startsAtMs: a.startsAt.toMillis(), endsAtMs: a.endsAt.toMillis() }, now);
      // An auction past its end time is waiting for its result to be recorded; show it with the ended ones.
      if (phase === "live" || phase === "starting_soon" || phase === "upcoming") g[phase].push(a);
      else if (phase === "closing") g.ended.push(a);
    }
    g.live.sort((a, b) => a.endsAt.toMillis() - b.endsAt.toMillis());
    for (const a of ended ?? []) if (keep(a)) g.ended.push(a);
    return g;
  }, [open, ended, now, ready, q, category, state]);

  if (error) return <ErrorState message="Auctions could not be loaded." onRetry={() => location.reload()} />;
  const loading = !open || !ended || !ready;
  const items = grouped[tab];
  return (
    <div className="space-y-5">
      <div className="grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="a-q">Search</Label>
          <Input id="a-q" placeholder="Produce, farmer or district" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="a-cat">Category</Label>
          <NativeSelect id="a-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All categories</option>
            {(categories ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="a-state">State</Label>
          <NativeSelect id="a-state" value={state} onChange={(e) => setState(e.target.value)}>
            <option value="">All states</option>
            {INDIAN_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList>
          {TABS.map(([v, l]) => (
            <TabsTrigger key={v} value={v}>
              {l}
              {!loading && <span className="ml-1 text-xs text-muted-foreground tabular">{grouped[v].length}</span>}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-72" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Gavel}
          title={EMPTY[tab].title}
          description={q || category || state ? "No auctions match these filters." : EMPTY[tab].description}
          action={
            <Button asChild variant="secondary">
              <Link href="/marketplace">Browse fixed-price listings</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((a) => (
            <AuctionCard key={a.auctionId} auction={a} now={now} />
          ))}
        </div>
      )}
    </div>
  );
}
