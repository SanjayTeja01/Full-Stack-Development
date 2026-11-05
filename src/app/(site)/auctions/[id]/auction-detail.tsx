"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronLeft, Clock, Gavel, Info, MapPin, ShieldCheck, Trophy, Wheat } from "lucide-react";
import type { Auction, AuctionParticipant, AuctionPrivateState, PublicBid } from "@shared/types";
import { AUCTION_LIMITS, auctionPhase, minimumNextBid, type AuctionPhase } from "@shared/auction";
import { formatINR, lineTotal, parseRupeesToPaise, paiseToRupeeString } from "@shared/money";
import { formatQuantity, unitShort, UNITS } from "@shared/units";
import { useAuth } from "@/components/auth/auth-provider";
import { subscribeAuction, subscribeAuctionPrivate, subscribeParticipant, subscribePublicBids } from "@/lib/data/auctions";
import { useServerNow } from "@/lib/hooks/use-server-clock";
import { call, CallError, errorMessage } from "@/lib/firebase/callable";
import { AuctionPhaseBadge } from "@/components/auctions/auction-status";
import { ReportButton } from "@/components/reports/report-dialog";
import { MoneyInput } from "@/components/forms/money-input";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, EmptyState, ErrorState, Spinner } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { formatDateTime, formatDuration, formatTime, newRequestId } from "@/lib/format";

export function AuctionDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const { user, role, status } = useAuth();
  const [auction, setAuction] = React.useState<Auction | null | undefined>(undefined);
  const [error, setError] = React.useState<string | null>(null);
  const { now, ready, synced } = useServerNow(1000);

  React.useEffect(() => subscribeAuction(id, setAuction, (e) => setError((e as Error & { code?: string }).code === "permission-denied" ? "denied" : e.message)), [id]);

  const phase: AuctionPhase | null =
    auction && ready ? auctionPhase({ status: auction.status, startsAtMs: auction.startsAt.toMillis(), endsAtMs: auction.endsAt.toMillis() }, now) : null;

  // Once the end time passes, ask the server to record the result instead of waiting for the next scheduler run.
  const requested = React.useRef(false);
  React.useEffect(() => {
    if (phase !== "closing" || status !== "ready" || requested.current) return;
    requested.current = true;
    const t = setTimeout(() => call("requestAuctionFinalization", { auctionId: id }).catch(() => undefined), 1500);
    return () => clearTimeout(t);
  }, [phase, status, id]);

  if (error === "denied" || auction === null)
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <EmptyState
          icon={Gavel}
          title="Auction not found"
          description="It may still be a draft, or the link may be wrong."
          action={
            <Button asChild>
              <Link href="/auctions">All auctions</Link>
            </Button>
          }
        />
      </div>
    );
  if (error)
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <ErrorState message="This auction could not be loaded." onRetry={() => location.reload()} />
      </div>
    );
  if (!auction || !phase) return <Spinner />;

  const isOwner = user?.uid === auction.farmerId;
  const isBuyer = role === "buyer" && status === "ready";
  const unit = unitShort(auction.unit);
  const showBids = auction.bidVisibility === "public_anonymous" || auction.status === "ended";

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <Link href="/auctions" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> Auctions
      </Link>
      <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-4">
          <div className="aspect-[16/9] overflow-hidden rounded-lg border border-border bg-muted">
            {auction.productImage ? (
              // eslint-disable-next-line @next/next/no-img-element -- user uploads
              <img src={auction.productImage} alt={auction.productName} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center bg-gradient-to-br from-accent-soft to-primary-soft text-accent/60" aria-hidden>
                <Wheat className="size-12" />
              </div>
            )}
          </div>
          <Card>
            <CardContent className="space-y-4 pt-5 text-sm">
              <dl className="grid grid-cols-2 gap-3">
                <div>
                  <dt className="text-muted-foreground">Quantity</dt>
                  <dd className="font-semibold tabular">{formatQuantity(auction.quantity, auction.unit)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Bids are</dt>
                  <dd>per {UNITS[auction.unit].label.toLowerCase()}, for the full quantity</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Starts</dt>
                  <dd>{formatDateTime(auction.startsAt)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Ends</dt>
                  <dd>{formatDateTime(auction.endsAt)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Bid visibility</dt>
                  <dd>{auction.bidVisibility === "sealed" ? "Sealed: amounts hidden until the end" : "Public, bidders anonymised"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Reserve price</dt>
                  <dd>{auction.hasReservePrice ? "Set by the farmer (amount not shown)" : "None"}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="flex items-center gap-1 text-muted-foreground">
                    <MapPin className="size-3.5" /> Location
                  </dt>
                  <dd>{[auction.location.village, auction.location.district, auction.location.state].filter(Boolean).join(", ")}</dd>
                </div>
              </dl>
              {auction.description && (
                <div className="border-t border-border pt-4">
                  <h2 className="font-semibold">About this lot</h2>
                  <p className="mt-1 whitespace-pre-line text-foreground/85">{auction.description}</p>
                </div>
              )}
              {auction.conditions && (
                <div className="border-t border-border pt-4">
                  <h2 className="font-semibold">Farmer&apos;s conditions</h2>
                  <p className="mt-1 whitespace-pre-line text-foreground/85">{auction.conditions}</p>
                </div>
              )}
              <p className="flex gap-2 border-t border-border pt-4 text-xs text-muted-foreground">
                <Info className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  The winner and the farmer arrange payment, transport and delivery directly. FarmConnect does not handle payments.{" "}
                  <Link href="/terms#auction-rules" className="font-medium text-primary hover:underline">
                    Auction rules
                  </Link>
                </span>
              </p>
            </CardContent>
          </Card>
          {showBids && <BidHistory auction={auction} />}
        </div>

        <div className="space-y-4">
          <div>
            <AuctionPhaseBadge phase={phase} auction={auction} />
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{auction.productName}</h1>
            <p className="text-sm text-muted-foreground">
              Auction by{" "}
              <Link href={`/farmers/${auction.farmerId}`} className="font-medium text-foreground hover:text-primary">
                {auction.farmerName}
              </Link>
              {" · "}
              <Link href={`/products/${auction.productId}`} className="hover:text-primary">
                View listing
              </Link>
            </p>
          </div>

          <Card>
            <CardContent className="space-y-4 pt-5">
              <Countdown auction={auction} phase={phase} now={now} synced={synced} />
              <PriceSummary auction={auction} phase={phase} unit={unit} />
            </CardContent>
          </Card>

          {phase === "ended" && <ResultCard auction={auction} viewerId={user?.uid ?? null} isOwner={isOwner} />}
          {phase === "cancelled" && (
            <Alert tone="warning" title="This auction was cancelled">
              {auction.cancellationReason ? `Reason: ${auction.cancellationReason}` : null} Any reserved stock has been returned to the listing.
            </Alert>
          )}

          {isBuyer && <BuyerPanel auction={auction} phase={phase} uid={user!.uid} />}
          {isOwner && <FarmerPanel auction={auction} phase={phase} />}
          {status === "signed_out" && (phase === "live" || phase === "starting_soon" || phase === "upcoming") && (
            <Card>
              <CardContent className="space-y-3 pt-5 text-sm">
                <p>Sign in with a buyer account to bid in this auction.</p>
                <div className="flex gap-2">
                  <Button asChild>
                    <Link href={`/login?next=/auctions/${auction.auctionId}`}>Sign in</Link>
                  </Button>
                  <Button asChild variant="secondary">
                    <Link href="/register?role=buyer">Create a buyer account</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
          {role === "farmer" && !isOwner && phase === "live" && <p className="text-sm text-muted-foreground">Only buyer accounts can bid in auctions.</p>}
          {status === "ready" && !isOwner && (
            <div className="flex justify-end">
              <ReportButton targetType="auction" targetId={auction.auctionId} label="Report this auction" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Countdown({ auction, phase, now, synced }: { auction: Auction; phase: AuctionPhase; now: number; synced: boolean }) {
  let label: string;
  let value: string | null = null;
  if (phase === "live") {
    label = "Ends in";
    value = formatDuration(auction.endsAt.toMillis() - now);
  } else if (phase === "upcoming" || phase === "starting_soon") {
    label = "Starts in";
    value = formatDuration(auction.startsAt.toMillis() - now);
  } else if (phase === "closing") {
    label = "Bidding has closed. Recording the result…";
  } else if (phase === "ended") {
    label = `Ended ${formatDateTime(auction.endsAt)}`;
  } else if (phase === "cancelled") {
    label = "Cancelled";
  } else {
    label = "Draft, not published";
  }
  return (
    <div className="flex items-center gap-3">
      <Clock className="size-5 text-muted-foreground" />
      <div aria-live="off">
        <p className="text-sm text-muted-foreground">{label}</p>
        {value && <p className="text-2xl font-semibold tabular">{value}</p>}
      </div>
      {!synced && value && <span className="ml-auto text-xs text-muted-foreground">Syncing clock…</span>}
    </div>
  );
}

function PriceSummary({ auction, phase, unit }: { auction: Auction; phase: AuctionPhase; unit: string }) {
  const sealed = auction.bidVisibility === "sealed";
  return (
    <dl className="grid grid-cols-2 gap-3 border-t border-border pt-4 text-sm">
      <div>
        <dt className="text-muted-foreground">Starting price</dt>
        <dd className="font-medium tabular">
          {formatINR(auction.startingPrice)}/{unit}
        </dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Minimum increment</dt>
        <dd className="font-medium tabular">{formatINR(auction.minimumIncrement)}</dd>
      </div>
      {!sealed && phase !== "ended" && (
        <>
          <div>
            <dt className="text-muted-foreground">Current highest bid</dt>
            <dd className="text-lg font-semibold text-primary tabular">
              {auction.currentHighestBid !== null ? `${formatINR(auction.currentHighestBid)}/${unit}` : "No bids yet"}
            </dd>
            {auction.currentHighestBidderLabel && <dd className="text-xs text-muted-foreground">by {auction.currentHighestBidderLabel}</dd>}
          </div>
          <div>
            <dt className="text-muted-foreground">Minimum next bid</dt>
            <dd className="text-lg font-semibold tabular">
              {formatINR(minimumNextBid({ ...auction, startsAtMs: 0, endsAtMs: 0 }))}/{unit}
            </dd>
          </div>
        </>
      )}
      <div>
        <dt className="text-muted-foreground">Bids</dt>
        <dd className="tabular">{auction.bidCount}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Bidders</dt>
        <dd className="tabular">{auction.bidderCount}</dd>
      </div>
    </dl>
  );
}

function BidHistory({ auction }: { auction: Auction }) {
  const [bids, setBids] = React.useState<PublicBid[] | null>(null);
  const [error, setError] = React.useState(false);
  const unit = unitShort(auction.unit);
  React.useEffect(() => subscribePublicBids(auction.auctionId, setBids, () => setError(true)), [auction.auctionId, auction.status]);
  return (
    <Card>
      <CardContent className="pt-5">
        <h2 className="font-semibold">Bid history</h2>
        <p className="text-xs text-muted-foreground">Bidders are shown as anonymous labels. Contact details are only shared with the winner after the auction.</p>
        {error ? (
          <p className="mt-3 text-sm text-muted-foreground">Bid history is not available.</p>
        ) : !bids ? (
          <Spinner />
        ) : bids.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No bids yet.</p>
        ) : (
          <ol className="mt-3 divide-y divide-border text-sm">
            {bids.map((b, i) => (
              <li key={b.bidId} className="flex items-center justify-between gap-3 py-2">
                <span className={i === 0 ? "font-medium" : undefined}>{b.bidderLabel}</span>
                <span className="tabular">
                  {formatINR(b.amountPerUnit)}/{unit}
                </span>
                <span className="text-xs text-muted-foreground tabular">{formatTime(b.createdAt)}</span>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

function ResultCard({ auction, viewerId, isOwner }: { auction: Auction; viewerId: string | null; isOwner: boolean }) {
  const [participant, setParticipant] = React.useState<AuctionParticipant | null>(null);
  React.useEffect(() => {
    if (!viewerId || isOwner) return;
    return subscribeParticipant(auction.auctionId, viewerId, setParticipant, () => undefined);
  }, [auction.auctionId, viewerId, isOwner]);
  const unit = unitShort(auction.unit);
  if (auction.resultStatus === "winner") {
    const won = participant?.won === true;
    return (
      <Card className={won ? "border-primary" : undefined}>
        <CardContent className="space-y-2 pt-5">
          <h2 className="flex items-center gap-2 font-semibold">
            <Trophy className="size-4 text-accent" /> {won ? "You won this auction" : `Won by ${auction.winnerLabel}`}
          </h2>
          <p className="text-sm tabular">
            Winning bid {formatINR(auction.winningBid!)}/{unit} for {formatQuantity(auction.quantity, auction.unit)}, total{" "}
            <span className="font-semibold">{formatINR(lineTotal(auction.winningBid!, auction.quantity))}</span>
          </p>
          {(won || isOwner) && auction.agreementId && (
            <>
              <p className="text-sm text-muted-foreground">An agreement has been recorded. Contact details are shared on the agreement page so you can arrange payment and delivery.</p>
              <Button asChild>
                <Link href={`/agreements/${auction.agreementId}`}>Open agreement</Link>
              </Button>
            </>
          )}
          {participant && !won && <p className="text-sm text-muted-foreground">Your highest bid was {formatINR(participant.highestBid)}/{unit}.</p>}
        </CardContent>
      </Card>
    );
  }
  return (
    <Alert tone="info" title={auction.resultStatus === "no_bids" ? "Ended with no bids" : "Ended without a winner"}>
      {auction.resultStatus === "reserve_not_met"
        ? `The highest bid${auction.currentHighestBid !== null ? ` (${formatINR(auction.currentHighestBid)}/${unit})` : ""} did not meet the reserve price.`
        : "No bids were placed."}{" "}
      The quantity has been returned to the farmer&apos;s available stock.
    </Alert>
  );
}

function BuyerPanel({ auction, phase, uid }: { auction: Auction; phase: AuctionPhase; uid: string }) {
  const toast = useToast();
  const [participant, setParticipant] = React.useState<AuctionParticipant | null>(null);
  const [amount, setAmount] = React.useState("");
  const [fieldError, setFieldError] = React.useState<string | null>(null);
  const [confirming, setConfirming] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  // One key per intended bid. A network retry reuses it, so the server can't record the same bid twice.
  const keyRef = React.useRef<string | null>(null);
  React.useEffect(() => subscribeParticipant(auction.auctionId, uid, setParticipant, () => undefined), [auction.auctionId, uid]);

  const sealed = auction.bidVisibility === "sealed";
  const unit = unitShort(auction.unit);
  const min = minimumNextBid({ ...auction, startsAtMs: 0, endsAtMs: 0 }, participant?.highestBid ?? null);
  const max = auction.startingPrice * AUCTION_LIMITS.maxBidMultiplier;
  const leading = !sealed && !!participant && auction.currentHighestBidderLabel === participant.label;
  const paise = parseRupeesToPaise(amount);

  if (phase !== "live") {
    if (phase === "upcoming" || phase === "starting_soon")
      return <Alert tone="info" title="Bidding has not started">You can bid here from {formatDateTime(auction.startsAt)}. The page updates on its own.</Alert>;
    return null;
  }

  const review = () => {
    setFieldError(null);
    if (paise === null || paise <= 0) return setFieldError("Enter your bid in rupees, with up to 2 decimal places.");
    if (paise < min) return setFieldError(`Your bid must be at least ${formatINR(min)}/${unit}.`);
    if (paise > max) return setFieldError(`Bids above ${formatINR(max)}/${unit} are not accepted. Check the amount.`);
    keyRef.current ??= newRequestId();
    setConfirming(true);
  };

  const place = async () => {
    setSubmitting(true);
    try {
      const res = await call<{ auctionId: string; amountPerUnit: number; idempotencyKey: string }, { bidderLabel: string; duplicate: boolean }>("placeBid", {
        auctionId: auction.auctionId,
        amountPerUnit: paise!,
        idempotencyKey: keyRef.current!,
      });
      keyRef.current = null;
      setConfirming(false);
      setAmount("");
      toast.success(`Bid of ${formatINR(paise!)}/${unit} placed as ${res.bidderLabel}.`);
    } catch (err) {
      const network = err instanceof CallError && (err.code === "unavailable" || err.code === "deadline-exceeded" || err.code === "unknown");
      if (!network) keyRef.current = null;
      setConfirming(false);
      const newMin = err instanceof CallError ? (err.details?.minimumNextBid as number | undefined) : undefined;
      setFieldError(
        network
          ? "We could not confirm your bid. Check your connection and press Place bid again; it will not be recorded twice."
          : newMin
            ? `${errorMessage(err)} The minimum is now ${formatINR(newMin)}/${unit}.`
            : errorMessage(err),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const quick = [min, min + auction.minimumIncrement, min + 5 * auction.minimumIncrement].filter((v) => v <= max);
  return (
    <Card>
      <CardContent className="space-y-4 pt-5">
        <h2 className="flex items-center gap-2 font-semibold">
          <Gavel className="size-4" /> Place a bid
        </h2>
        {participant && (
          <p className="text-sm">
            You are bidding as <span className="font-medium">{participant.label}</span>. Your highest bid:{" "}
            <span className="tabular font-medium">
              {formatINR(participant.highestBid)}/{unit}
            </span>
          </p>
        )}
        {leading ? (
          <Alert tone="success" title="You hold the highest bid">
            You can bid again if another buyer outbids you.
          </Alert>
        ) : (
          <>
            {!sealed && participant && <Alert tone="warning" title="You have been outbid">Bid at least {formatINR(min)}/{unit} to lead again.</Alert>}
            <Field label={`Your bid per ${UNITS[auction.unit].label.toLowerCase()}`} htmlFor="bid-amount" error={fieldError ?? undefined} hint={`At least ${formatINR(min)}/${unit}`}>
              <MoneyInput
                id="bid-amount"
                suffix={`/${unit}`}
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  keyRef.current = null;
                }}
                aria-invalid={!!fieldError}
                aria-describedby={fieldError ? "bid-amount-error" : "bid-amount-hint"}
              />
            </Field>
            <div className="flex flex-wrap gap-2">
              {quick.map((v) => (
                <Button
                  key={v}
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setAmount(paiseToRupeeString(v));
                    keyRef.current = null;
                  }}
                >
                  {formatINR(v)}
                </Button>
              ))}
            </div>
            {paise !== null && paise > 0 && (
              <p className="text-sm text-muted-foreground tabular">
                Total if you win: <span className="font-medium text-foreground">{formatINR(lineTotal(paise, auction.quantity))}</span> for {formatQuantity(auction.quantity, auction.unit)}
              </p>
            )}
            <Button className="w-full" onClick={review} loading={submitting}>
              Review bid
            </Button>
            {sealed && <p className="text-xs text-muted-foreground">Sealed auction: other buyers&apos; amounts are hidden until the end. You can raise your own bid.</p>}
          </>
        )}
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0" /> A bid is final once accepted and cannot be withdrawn. Bids are checked on the server at the moment they arrive.
        </p>
      </CardContent>
      <ConfirmDialog
        open={confirming}
        onOpenChange={(o) => !submitting && setConfirming(o)}
        title="Confirm your bid"
        description={`${formatINR(paise ?? 0)}/${unit} for ${formatQuantity(auction.quantity, auction.unit)} of ${auction.productName}. Total if you win: ${formatINR(lineTotal(paise ?? 0, auction.quantity))}. Accepted bids cannot be withdrawn.`}
        confirmLabel="Place bid"
        tone="primary"
        loading={submitting}
        onConfirm={place}
      />
    </Card>
  );
}

function FarmerPanel({ auction, phase }: { auction: Auction; phase: AuctionPhase }) {
  const toast = useToast();
  const [state, setState] = React.useState<AuctionPrivateState | null>(null);
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => subscribeAuctionPrivate(auction.auctionId, setState, () => undefined), [auction.auctionId]);
  const unit = unitShort(auction.unit);
  const canCancel = (phase === "upcoming" || phase === "starting_soon" || phase === "live") && auction.bidCount === 0;

  const cancel = async () => {
    setBusy(true);
    setError(null);
    try {
      await call("cancelAuction", { auctionId: auction.auctionId, reason });
      setCancelOpen(false);
      toast.success("Auction cancelled. The reserved quantity is back in your available stock.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardContent className="space-y-3 pt-5 text-sm">
        <h2 className="font-semibold">Your auction</h2>
        <dl className="grid grid-cols-2 gap-3">
          <div>
            <dt className="text-muted-foreground">Reserve price</dt>
            <dd className="tabular">{state?.reservePrice != null ? `${formatINR(state.reservePrice)}/${unit}` : "None"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Highest bid so far</dt>
            <dd className="tabular">{state?.currentHighestAmount != null ? `${formatINR(state.currentHighestAmount)}/${unit}` : "No bids"}</dd>
          </div>
        </dl>
        <p className="text-muted-foreground">
          {formatQuantity(auction.quantity, auction.unit)} is reserved from your listing while the auction runs. It is committed to the winner, or returned to available stock if there is no winner.
        </p>
        {canCancel ? (
          <Button variant="secondary" onClick={() => setCancelOpen(true)}>
            Cancel auction
          </Button>
        ) : (
          (phase === "live" || phase === "closing") && <p className="text-xs text-muted-foreground">Bidding has started, so this auction can only be cancelled by an administrator. Use Report if something is wrong.</p>
        )}
        <ConfirmDialog
          open={cancelOpen}
          onOpenChange={(o) => !busy && setCancelOpen(o)}
          title="Cancel this auction?"
          description="Buyers will no longer be able to bid. The reserved quantity returns to your available stock. This cannot be undone."
          confirmLabel="Cancel auction"
          loading={busy}
          onConfirm={() => (reason.trim().length >= 5 ? cancel() : setError("Give a short reason (at least 5 characters)."))}
        >
          <Field label="Reason (shown to buyers)" htmlFor="cancel-reason" error={error ?? undefined}>
            <Textarea id="cancel-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
          </Field>
        </ConfirmDialog>
      </CardContent>
    </Card>
  );
}
