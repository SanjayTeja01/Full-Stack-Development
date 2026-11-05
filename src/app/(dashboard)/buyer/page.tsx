"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, ClipboardList, Gavel, Handshake, Heart, MessageSquare, PackageCheck, Search, Tags } from "lucide-react";
import type { Agreement, Auction, Bid, Conversation, Offer } from "@shared/types";
import { auctionPhase } from "@shared/auction";
import { useAuth } from "@/components/auth/auth-provider";
import { subscribeMyBids, subscribeOpenAuctions } from "@/lib/data/auctions";
import { subscribeConversations, subscribeMyOffers } from "@/lib/data/chat";
import { subscribeMyAgreements } from "@/lib/data/agreements";
import { useSaved } from "@/lib/data/saved";
import { useServerNow } from "@/lib/hooks/use-server-clock";
import { PageHeader } from "@/components/layout/app-shell";
import { RecentNotifications, StatCard, StatGrid } from "@/components/dashboard/widgets";
import { AuctionCard } from "@/components/auctions/auction-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/feedback";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

const OPEN_AGREEMENT = ["agreement_recorded", "contact_initiated", "in_progress", "disputed"];

export default function BuyerOverviewPage() {
  const { user, profile } = useAuth();
  const uid = user!.uid;
  const [offers, setOffers] = React.useState<Offer[] | null>(null);
  const [convs, setConvs] = React.useState<Conversation[] | null>(null);
  const [agreements, setAgreements] = React.useState<Agreement[] | null>(null);
  const [bids, setBids] = React.useState<Bid[] | null>(null);
  const [open, setOpen] = React.useState<Auction[] | null>(null);
  const { items: savedProducts } = useSaved(uid, "savedProducts");
  const { now, ready } = useServerNow(1000);
  const ignore = () => undefined;
  React.useEffect(() => subscribeMyOffers(uid, "buyer", setOffers, ignore), [uid]);
  React.useEffect(() => subscribeConversations(uid, setConvs, ignore), [uid]);
  React.useEffect(() => subscribeMyAgreements(uid, setAgreements, ignore), [uid]);
  React.useEffect(() => subscribeMyBids(uid, setBids, ignore), [uid]);
  React.useEffect(() => subscribeOpenAuctions(setOpen, ignore, 30), []);

  const phaseOf = (a: Auction) => auctionPhase({ status: a.status, startsAtMs: a.startsAt.toMillis(), endsAtMs: a.endsAt.toMillis() }, now);
  const live = open && ready ? open.filter((a) => phaseOf(a) === "live") : null;
  const myLiveAuctionIds = new Set((bids ?? []).map((b) => b.auctionId));
  const biddingIn = live && bids ? live.filter((a) => myLiveAuctionIds.has(a.auctionId)).length : null;
  const toRespond = offers && ready ? offers.filter((o) => o.status === "pending" && o.respondentId === uid && (!o.expiresAt || o.expiresAt.toMillis() > now)).length : null;
  const waiting = offers && ready ? offers.filter((o) => o.status === "pending" && o.proposedBy === uid && (!o.expiresAt || o.expiresAt.toMillis() > now)).length : null;
  const unread = convs ? convs.reduce((s, c) => s + (c.unreadCounts?.[uid] ?? 0), 0) : null;
  const openAgreements = agreements?.filter((a) => OPEN_AGREEMENT.includes(a.status)).length ?? null;

  return (
    <>
      <PageHeader
        title={`Welcome, ${profile?.displayName ?? "buyer"}`}
        description="Your negotiations, bids and agreements at a glance."
        actions={
          <Button asChild>
            <Link href="/marketplace">
              <Search /> Find produce
            </Link>
          </Button>
        }
      />
      <div className="space-y-6">
        <ScrollReveal><section className="relative isolate flex min-h-[210px] flex-col justify-between gap-6 overflow-hidden rounded-2xl border border-border bg-[#173b2b] p-6 text-white shadow-lg sm:flex-row sm:items-center sm:p-8" aria-label="Buyer workspace shortcuts" style={{ backgroundImage: "linear-gradient(90deg, #173b2bf2 0%, #173b2bdc 50%, #173b2b6b 100%), url('/images/maize.webp')", backgroundPosition: "center", backgroundSize: "cover" }}>
          <div className="max-w-xl"><span className="text-xs font-semibold tracking-[0.18em] text-[#d8e5ae]">YOUR SOURCING WORKSPACE</span><h2 className="mt-3 font-serif text-3xl tracking-tight sm:text-4xl">Find the right harvest for your market.</h2><p className="mt-3 max-w-lg text-sm leading-6 text-white/80">Explore fresh listings, save promising lots, then connect directly with the farmer.</p></div>
          <div className="flex min-w-52 flex-col gap-2 rounded-xl border border-white/30 bg-white/15 p-3 backdrop-blur-xl"><Link className="flex items-center justify-between rounded-lg px-3 py-3 text-sm text-white transition hover:bg-white/15" href="/marketplace">Explore produce <ArrowRight className="size-4 text-[#e0e9ba]" /></Link><Link className="flex items-center justify-between rounded-lg px-3 py-3 text-sm text-white transition hover:bg-white/15" href="/buyer/saved">View saved listings <ArrowRight className="size-4 text-[#e0e9ba]" /></Link></div>
        </section></ScrollReveal>
        <ScrollReveal delay={70}><StatGrid>
          <StatCard label="Counteroffers to answer" value={toRespond} href="/buyer/offers" icon={Tags} emphasis={!!toRespond} />
          <StatCard label="Unread messages" value={unread} href="/messages" icon={MessageSquare} emphasis={!!unread} />
          <StatCard label="Offers awaiting farmers" value={waiting} href="/buyer/offers" icon={Tags} />
          <StatCard label="Live auctions you're in" value={biddingIn} href="/buyer/bids" icon={ClipboardList} />
          <StatCard label="Open agreements" value={openAgreements} href="/agreements" icon={Handshake} />
          <StatCard label="Saved listings" value={savedProducts?.length ?? null} href="/buyer/saved" icon={Heart} />
        </StatGrid></ScrollReveal>
        <ScrollReveal delay={110}><section className="grid gap-3 sm:grid-cols-3" aria-label="How sourcing works">
          {[
            { step: "01", title: "Discover produce", detail: "Compare local harvests, quantities and prices.", icon: Search },
            { step: "02", title: "Make your move", detail: "Send a private offer or place a live bid.", icon: Gavel },
            { step: "03", title: "Confirm the trade", detail: "Agree terms with the farmer directly.", icon: PackageCheck },
          ].map(({ step, title, detail, icon: Icon }) => (
            <article key={step} className="rounded-xl border border-border bg-white/80 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex items-center justify-between"><span className="font-mono text-xs text-muted-foreground">{step} / BUY</span><Icon className="size-4 text-primary" /></div>
              <h2 className="mt-3 text-sm font-semibold">{title}</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>
            </article>
          ))}
        </section></ScrollReveal>
        <ScrollReveal delay={140}><div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Live auctions</CardTitle>
              <Link href="/buyer/auctions" className="text-sm font-medium text-primary hover:underline">
                All auctions
              </Link>
            </CardHeader>
            <CardContent>
              {!live ? (
                <Skeleton className="h-40" />
              ) : live.length === 0 ? (
                <p className="text-sm text-muted-foreground">No auctions are live right now.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {live.slice(0, 2).map((a) => (
                    <AuctionCard key={a.auctionId} auction={a} now={now} />
                  ))}
                </div>
              )}
              {live && live.length > 2 && <p className="mt-3 text-xs text-muted-foreground">{live.length - 2} more live now.</p>}
            </CardContent>
          </Card>
          <RecentNotifications />
        </div></ScrollReveal>
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Gavel className="size-3.5" /> Auction wins and accepted offers create agreements. Payment and delivery are arranged directly with the farmer.
        </p>
      </div>
    </>
  );
}
