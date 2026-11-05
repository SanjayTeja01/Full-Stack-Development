"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRightLeft, Handshake } from "lucide-react";
import type { Offer, Product } from "@shared/types";
import { formatINR } from "@shared/money";
import { formatQuantity, unitShort } from "@shared/units";
import { call, errorMessage } from "@/lib/firebase/callable";
import { OfferStatusBadge } from "./offer-status";
import { OfferComposer } from "./offer-composer";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { formatDateTime, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

export function OfferCard({
  offer,
  uid,
  names,
  product,
  now,
}: {
  offer: Offer;
  uid: string;
  names: Record<string, string>;
  product: Product | null;
  now: number;
}) {
  const toast = useToast();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [confirm, setConfirm] = React.useState<null | "accept" | "reject" | "withdraw">(null);
  const [counterOpen, setCounterOpen] = React.useState(false);
  const mine = offer.proposedBy === uid;
  const expiresMs = offer.expiresAt?.toMillis() ?? null;
  const expiredLocally = offer.status === "pending" && expiresMs !== null && now > 0 && now >= expiresMs;
  const canRespond = offer.status === "pending" && !expiredLocally && offer.respondentId === uid;
  const canWithdraw = offer.status === "pending" && !expiredLocally && mine;
  const unit = unitShort(offer.unit);

  const act = async (action: "accept" | "reject" | "withdraw") => {
    setBusy(action);
    try {
      await call("respondToOffer", { offerId: offer.offerId, action });
      toast.success(action === "accept" ? "Offer accepted. Agreement recorded." : action === "reject" ? "Offer rejected." : "Offer withdrawn.");
      setConfirm(null);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={cn("w-full max-w-sm rounded-lg border bg-card p-4 shadow-sm", offer.status === "pending" ? "border-primary/40" : "border-border")}>
      <div className="flex items-start justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <ArrowRightLeft className="size-3.5" />
          {offer.parentOfferId ? "Counteroffer" : "Offer"} from {mine ? "you" : names[offer.proposedBy]}
        </p>
        <OfferStatusBadge status={expiredLocally ? "expired" : offer.status} />
      </div>
      <p className="mt-2 text-lg font-semibold tabular">
        {formatINR(offer.pricePerUnit)}
        <span className="text-sm font-normal text-muted-foreground">/{unit}</span>
      </p>
      <dl className="mt-1 space-y-0.5 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Quantity</dt>
          <dd className="tabular">{formatQuantity(offer.quantity, offer.unit)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Product value</dt>
          <dd className="font-medium tabular">{formatINR(offer.totalValue)}</dd>
        </div>
        {product && (
          <div className="flex justify-between gap-4 text-xs">
            <dt className="text-muted-foreground">Asking price</dt>
            <dd className="tabular text-muted-foreground">
              {formatINR(product.pricePerUnit)}/{unitShort(product.unit)}
            </dd>
          </div>
        )}
      </dl>
      {offer.terms && <p className="mt-2 rounded bg-muted px-2 py-1.5 text-xs"><span className="font-medium">Terms:</span> {offer.terms}</p>}
      {offer.message && <p className="mt-2 text-sm italic text-foreground/80">“{offer.message}”</p>}
      <p className="mt-2 text-xs text-muted-foreground">
        Sent {formatDateTime(offer.createdAt)}
        {offer.status === "pending" && expiresMs && !expiredLocally && ` · expires ${formatRelative(expiresMs, now || undefined)}`}
        {offer.status === "pending" && !expiresMs && " · no expiry"}
      </p>
      {offer.status === "countered" && <p className="mt-1 text-xs text-muted-foreground">Superseded by a counteroffer below.</p>}

      {canRespond && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setConfirm("accept")} disabled={!!busy}>
            Accept
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setCounterOpen(true)} disabled={!!busy || !product}>
            Counter
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirm("reject")} disabled={!!busy}>
            Reject
          </Button>
        </div>
      )}
      {canWithdraw && (
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">Waiting for {names[offer.respondentId]}</span>
          <Button size="sm" variant="ghost" onClick={() => setConfirm("withdraw")} disabled={!!busy}>
            Withdraw
          </Button>
        </div>
      )}
      {offer.status === "accepted" && offer.agreementId && (
        <Button asChild size="sm" variant="secondary" className="mt-3 w-full">
          <Link href={`/agreements/${offer.agreementId}`}>
            <Handshake /> View agreement and contact details
          </Link>
        </Button>
      )}

      <ConfirmDialog
        open={confirm === "accept"}
        onOpenChange={(o) => !o && setConfirm(null)}
        tone="primary"
        title="Accept these terms?"
        description={`${formatQuantity(offer.quantity, offer.unit)} at ${formatINR(offer.pricePerUnit)}/${unit}, product value ${formatINR(offer.totalValue)}. This records an agreement and commits the quantity from stock. It is not a payment; you will arrange payment and delivery directly.`}
        confirmLabel="Accept and record agreement"
        loading={busy === "accept"}
        onConfirm={() => act("accept")}
      />
      <ConfirmDialog
        open={confirm === "reject"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Reject this offer?"
        description="The other person will be notified. They can make a new offer afterwards."
        confirmLabel="Reject offer"
        loading={busy === "reject"}
        onConfirm={() => act("reject")}
      />
      <ConfirmDialog
        open={confirm === "withdraw"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Withdraw your offer?"
        description="It can no longer be accepted after you withdraw it."
        confirmLabel="Withdraw offer"
        loading={busy === "withdraw"}
        onConfirm={() => act("withdraw")}
      />
      {product && (
        <OfferComposer
          open={counterOpen}
          onOpenChange={setCounterOpen}
          mode="counter"
          product={product}
          conversationId={offer.conversationId}
          counterOfferId={offer.offerId}
          initial={{ quantity: offer.quantity, pricePerUnit: offer.pricePerUnit }}
        />
      )}
    </div>
  );
}
