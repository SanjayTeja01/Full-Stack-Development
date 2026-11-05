"use client";

import * as React from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Product } from "@shared/types";
import { formatINR, lineTotal, parseRupeesToPaise, paiseToRupeeString } from "@shared/money";
import { formatQuantity, unitShort, UNITS } from "@shared/units";
import { DEFAULT_OFFER_EXPIRY_HOURS, OFFER_EXPIRY_OPTIONS_HOURS } from "@shared/offer";
import { call, errorMessage } from "@/lib/firebase/callable";
import { rupees, wholeNumber } from "@/components/forms/form-schemas";
import { MoneyInput } from "@/components/forms/money-input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";

const schema = z.object({
  quantity: wholeNumber("Quantity"),
  price: rupees("price per unit"),
  message: z.string().max(500),
  terms: z.string().max(1000),
  expiresInHours: z.string(),
});
type Values = z.input<typeof schema>;

function expiryLabel(h: number) {
  return h < 24 ? `${h} hours` : h === 168 ? "7 days" : `${h / 24} day${h === 24 ? "" : "s"}`;
}

/** Used for a new offer (buyer) and for counteroffers (either party). */
export function OfferComposer({
  open,
  onOpenChange,
  mode,
  product,
  conversationId,
  counterOfferId,
  initial,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  mode: "offer" | "counter";
  product: Product;
  conversationId: string;
  counterOfferId?: string;
  initial?: { quantity: number; pricePerUnit: number };
}) {
  const toast = useToast();
  const [error, setError] = React.useState<string | null>(null);
  const unit = unitShort(product.unit);
  const { register, handleSubmit, formState, control, reset } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      quantity: String(initial?.quantity ?? product.minOrderQuantity),
      price: paiseToRupeeString(initial?.pricePerUnit ?? product.pricePerUnit),
      message: "",
      terms: "",
      expiresInHours: String(DEFAULT_OFFER_EXPIRY_HOURS),
    },
  });
  const qty = useWatch({ control, name: "quantity" });
  const price = useWatch({ control, name: "price" });
  const pricePaise = parseRupeesToPaise(price ?? "");
  const total = pricePaise && /^\d+$/.test(qty ?? "") ? lineTotal(pricePaise, Number(qty)) : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          reset();
          setError(null);
        }
        onOpenChange(o);
      }}
    >
      <DialogContent
        title={mode === "offer" ? `Make an offer: ${product.name}` : "Send a counteroffer"}
        description={`Asking price ${formatINR(product.pricePerUnit)}/${unit}. ${formatQuantity(product.availableQuantity, product.unit)} available now.`}
      >
        <form
          className="space-y-4"
          noValidate
          onSubmit={handleSubmit(async (v) => {
            setError(null);
            const payload = {
              quantity: Number(v.quantity),
              pricePerUnit: parseRupeesToPaise(v.price)!,
              message: v.message || null,
              terms: v.terms || null,
              expiresInHours: v.expiresInHours === "none" ? null : Number(v.expiresInHours),
            };
            try {
              if (mode === "offer") await call("createOffer", { conversationId, productId: product.productId, ...payload });
              else await call("respondToOffer", { offerId: counterOfferId!, action: "counter", ...payload });
              toast.success(mode === "offer" ? "Offer sent." : "Counteroffer sent.");
              onOpenChange(false);
              reset();
            } catch (e) {
              setError(errorMessage(e));
            }
          })}
        >
          {error && <Alert tone="danger">{error}</Alert>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={`Quantity (${UNITS[product.unit].plural})`} htmlFor="o-qty" error={formState.errors.quantity?.message} hint={`Minimum ${product.minOrderQuantity}`}>
              <Input id="o-qty" inputMode="numeric" {...register("quantity")} />
            </Field>
            <Field label={`Price per ${unit}`} htmlFor="o-price" error={formState.errors.price?.message}>
              <MoneyInput id="o-price" suffix={`/ ${unit}`} {...register("price")} />
            </Field>
          </div>
          <div className="rounded-md bg-muted p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Product value</span>
              <span className="font-semibold tabular">{total !== null ? formatINR(total) : "—"}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Quantity × price only. Transport, loading, packing and taxes are separate unless you include them in the terms below.
            </p>
          </div>
          <Field label="Terms" htmlFor="o-terms" hint="Optional: delivery point, quality conditions, what the price includes.">
            <Textarea id="o-terms" rows={2} {...register("terms")} />
          </Field>
          <Field label="Message" htmlFor="o-msg">
            <Textarea id="o-msg" rows={2} {...register("message")} />
          </Field>
          <Field label="Offer expires in" htmlFor="o-exp">
            <NativeSelect id="o-exp" {...register("expiresInHours")}>
              {OFFER_EXPIRY_OPTIONS_HOURS.map((h) => (
                <option key={h} value={h}>
                  {expiryLabel(h)}
                </option>
              ))}
              <option value="none">Does not expire</option>
            </NativeSelect>
          </Field>
          <p className="text-xs text-muted-foreground">
            If the other side accepts, the quantity is committed from the farmer&apos;s stock and an agreement is recorded. Payment and delivery are arranged directly between you.
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={formState.isSubmitting}>
              {mode === "offer" ? "Send offer" : "Send counteroffer"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
