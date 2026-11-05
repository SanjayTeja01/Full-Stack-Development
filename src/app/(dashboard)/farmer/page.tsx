"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Boxes, Gavel, Handshake, MessageSquare, PackageCheck, Plus, Tags } from "lucide-react";
import type { Agreement, Auction, Conversation, Offer, Product } from "@shared/types";
import { auctionPhase } from "@shared/auction";
import { formatQuantity } from "@shared/units";
import { useAuth } from "@/components/auth/auth-provider";
import { subscribeFarmerProducts } from "@/lib/data/products";
import { subscribeFarmerAuctions } from "@/lib/data/auctions";
import { subscribeConversations, subscribeMyOffers } from "@/lib/data/chat";
import { subscribeMyAgreements } from "@/lib/data/agreements";
import { useServerNow } from "@/lib/hooks/use-server-clock";
import { PageHeader } from "@/components/layout/app-shell";
import { RecentNotifications, StatCard, StatGrid } from "@/components/dashboard/widgets";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, Skeleton } from "@/components/ui/feedback";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { UNITS, type UnitId } from "@shared/units";

const OPEN_AGREEMENT = ["agreement_recorded", "contact_initiated", "in_progress", "disputed"];

export default function FarmerOverviewPage() {
  const { user, profile } = useAuth();
  const uid = user!.uid;
  const [products, setProducts] = React.useState<Product[] | null>(null);
  const [auctions, setAuctions] = React.useState<Auction[] | null>(null);
  const [offers, setOffers] = React.useState<Offer[] | null>(null);
  const [convs, setConvs] = React.useState<Conversation[] | null>(null);
  const [agreements, setAgreements] = React.useState<Agreement[] | null>(null);
  const { now, ready } = useServerNow(30_000);
  const ignore = () => undefined;
  React.useEffect(() => subscribeFarmerProducts(uid, setProducts, ignore), [uid]);
  React.useEffect(() => subscribeFarmerAuctions(uid, setAuctions, ignore), [uid]);
  React.useEffect(() => subscribeMyOffers(uid, "farmer", setOffers, ignore), [uid]);
  React.useEffect(() => subscribeConversations(uid, setConvs, ignore), [uid]);
  React.useEffect(() => subscribeMyAgreements(uid, setAgreements, ignore), [uid]);

  const active = products?.filter((p) => p.listingStatus === "active").length ?? null;
  const liveAuctions = auctions && ready ? auctions.filter((a) => auctionPhase({ status: a.status, startsAtMs: a.startsAt.toMillis(), endsAtMs: a.endsAt.toMillis() }, now) === "live").length : null;
  const upcoming = auctions && ready ? auctions.filter((a) => ["upcoming", "starting_soon"].includes(auctionPhase({ status: a.status, startsAtMs: a.startsAt.toMillis(), endsAtMs: a.endsAt.toMillis() }, now))).length : null;
  const toRespond = offers && ready ? offers.filter((o) => o.status === "pending" && o.respondentId === uid && (!o.expiresAt || o.expiresAt.toMillis() > now)).length : null;
  const unread = convs ? convs.reduce((s, c) => s + (c.unreadCounts?.[uid] ?? 0), 0) : null;
  const openAgreements = agreements?.filter((a) => OPEN_AGREEMENT.includes(a.status)).length ?? null;

  // Stock per unit, so quantities in different units are never added together.
  const stock = React.useMemo(() => {
    const m = new Map<UnitId, { available: number; reserved: number; committed: number; sold: number }>();
    for (const p of products ?? []) {
      if (p.listingStatus === "removed" || p.listingStatus === "draft") continue;
      const s = m.get(p.unit) ?? { available: 0, reserved: 0, committed: 0, sold: 0 };
      s.available += p.availableQuantity;
      s.reserved += p.reservedQuantity;
      s.committed += p.committedQuantity;
      s.sold += p.soldQuantity;
      m.set(p.unit, s);
    }
    return Array.from(m.entries());
  }, [products]);

  return (
    <>
      <PageHeader
        title={`Welcome, ${profile?.displayName ?? "farmer"}`}
        description="Your listings, negotiations and auctions at a glance."
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href="/farmer/auctions/new">
                <Gavel /> Create auction
              </Link>
            </Button>
            <Button asChild>
              <Link href="/farmer/products/new">
                <Plus /> Add listing
              </Link>
            </Button>
          </>
        }
      />
      <div className="space-y-6">
        <ScrollReveal><section className="relative isolate flex min-h-[210px] flex-col justify-between gap-6 overflow-hidden rounded-2xl border border-border bg-[#173b2b] p-6 text-white shadow-lg sm:flex-row sm:items-center sm:p-8" aria-label="Farmer workspace shortcuts" style={{ backgroundImage: "linear-gradient(90deg, #173b2bf2 0%, #173b2bdc 50%, #173b2b6b 100%), url('/images/farmer-sunset.webp')", backgroundPosition: "center", backgroundSize: "cover" }}>
          <div className="max-w-xl"><span className="text-xs font-semibold tracking-[0.18em] text-[#d8e5ae]">YOUR FARM WORKSPACE</span><h2 className="mt-3 font-serif text-3xl tracking-tight sm:text-4xl">Good trade starts in the field.</h2><p className="mt-3 max-w-lg text-sm leading-6 text-white/80">Keep your produce details current and give buyers a clear path to your harvest.</p></div>
          <div className="flex min-w-52 flex-col gap-2 rounded-xl border border-white/30 bg-white/15 p-3 backdrop-blur-xl"><Link className="flex items-center justify-between rounded-lg px-3 py-3 text-sm text-white transition hover:bg-white/15" href="/farmer/products/new">Create a listing <ArrowRight className="size-4 text-[#e0e9ba]" /></Link><Link className="flex items-center justify-between rounded-lg px-3 py-3 text-sm text-white transition hover:bg-white/15" href="/farmer/auctions">Review auctions <ArrowRight className="size-4 text-[#e0e9ba]" /></Link></div>
        </section></ScrollReveal>
        {profile?.verificationStatus === "unverified" && (
          <Alert tone="info" title="Get a verified badge">
            Verified farmers show a badge on their profile and listings. <Link href="/settings#verification" className="font-medium text-primary hover:underline">Request verification</Link>
          </Alert>
        )}
        <ScrollReveal delay={70}><StatGrid>
          <StatCard label="Offers to answer" value={toRespond} href="/farmer/offers" icon={Tags} emphasis={!!toRespond} />
          <StatCard label="Unread messages" value={unread} href="/messages" icon={MessageSquare} emphasis={!!unread} />
          <StatCard label="Active listings" value={active} href="/farmer/products" icon={Boxes} hint={products ? `${products.length} in total` : undefined} />
          <StatCard label="Live auctions" value={liveAuctions} href="/farmer/auctions" icon={Gavel} hint={upcoming !== null ? `${upcoming} scheduled` : undefined} />
          <StatCard label="Open agreements" value={openAgreements} href="/agreements" icon={Handshake} />
          <StatCard
            label="Verification"
            value={profile?.verificationStatus === "verified" ? "Verified" : profile?.verificationStatus === "pending" ? "In review" : "Not verified"}
            href="/settings#verification"
            icon={BadgeCheck}
          />
        </StatGrid></ScrollReveal>
        <ScrollReveal delay={110}><section className="grid gap-3 sm:grid-cols-3" aria-label="How selling works">
          {[
            { step: "01", title: "List your harvest", detail: "Add quantity, grade and a fair asking price.", icon: Boxes },
            { step: "02", title: "Choose how to trade", detail: "Accept offers or invite buyers to bid.", icon: Gavel },
            { step: "03", title: "Agree directly", detail: "Confirm the terms and coordinate delivery.", icon: PackageCheck },
          ].map(({ step, title, detail, icon: Icon }) => (
            <article key={step} className="rounded-xl border border-border bg-white/80 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex items-center justify-between"><span className="font-mono text-xs text-muted-foreground">{step} / SELL</span><Icon className="size-4 text-primary" /></div>
              <h2 className="mt-3 text-sm font-semibold">{title}</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>
            </article>
          ))}
        </section></ScrollReveal>
        <ScrollReveal delay={140}><div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Stock across your listings</CardTitle>
            </CardHeader>
            <CardContent>
              {!products ? (
                <Skeleton className="h-24" />
              ) : stock.length === 0 ? (
                <p className="text-sm text-muted-foreground">No published listings yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="py-1 font-medium">Unit</th>
                      <th className="py-1 font-medium">Available</th>
                      <th className="py-1 font-medium">In auctions</th>
                      <th className="py-1 font-medium">Committed</th>
                      <th className="py-1 font-medium">Sold</th>
                    </tr>
                  </thead>
                  <tbody className="tabular">
                    {stock.map(([unit, s]) => (
                      <tr key={unit} className="border-t border-border">
                        <td className="py-2">{UNITS[unit].label}</td>
                        <td>{formatQuantity(s.available, unit)}</td>
                        <td>{formatQuantity(s.reserved, unit)}</td>
                        <td>{formatQuantity(s.committed, unit)}</td>
                        <td>{formatQuantity(s.sold, unit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
          <RecentNotifications />
        </div></ScrollReveal>
      </div>
    </>
  );
}
