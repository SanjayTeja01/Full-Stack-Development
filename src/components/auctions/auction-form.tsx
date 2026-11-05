"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Auction, AuctionPrivateState, Product } from "@shared/types";
import { DAY, HOUR, MINUTE } from "@shared/auction";
import { formatINR, lineTotal, paiseToRupeeString, parseRupeesToPaise } from "@shared/money";
import { formatQuantity, unitShort, UNITS } from "@shared/units";
import type { CreateAuctionInput } from "@shared/schemas";
import { useAuth } from "@/components/auth/auth-provider";
import { subscribeFarmerProducts } from "@/lib/data/products";
import { useServerNow } from "@/lib/hooks/use-server-clock";
import { call, errorMessage } from "@/lib/firebase/callable";
import { optionalRupees, rupees, wholeNumber } from "@/components/forms/form-schemas";
import { MoneyInput } from "@/components/forms/money-input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Alert, EmptyState, Spinner } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

const DURATIONS: [string, string][] = [
  [String(30 * MINUTE), "30 minutes"],
  [String(HOUR), "1 hour"],
  [String(3 * HOUR), "3 hours"],
  [String(6 * HOUR), "6 hours"],
  [String(12 * HOUR), "12 hours"],
  [String(DAY), "1 day"],
  [String(2 * DAY), "2 days"],
  [String(3 * DAY), "3 days"],
  [String(7 * DAY), "7 days"],
  ["custom", "Choose an end time"],
];

const schema = z
  .object({
    productId: z.string().min(1, "Choose a listing"),
    quantity: wholeNumber("Quantity"),
    startingPrice: rupees("starting price"),
    minimumIncrement: rupees("minimum increment"),
    reservePrice: optionalRupees,
    startMode: z.enum(["now", "later"]),
    startsAt: z.string(),
    duration: z.string(),
    endsAt: z.string(),
    bidVisibility: z.enum(["public_anonymous", "sealed"]),
    description: z.string().trim().max(1000),
    conditions: z.string().trim().max(2000),
    acceptRules: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.startMode === "later" && !v.startsAt) ctx.addIssue({ code: "custom", path: ["startsAt"], message: "Choose a start time" });
    if (v.duration === "custom" && !v.endsAt) ctx.addIssue({ code: "custom", path: ["endsAt"], message: "Choose an end time" });
    const sp = parseRupeesToPaise(v.startingPrice);
    const rp = v.reservePrice ? parseRupeesToPaise(v.reservePrice) : null;
    if (sp && rp !== null && rp < sp) ctx.addIssue({ code: "custom", path: ["reservePrice"], message: "Reserve price cannot be below the starting price" });
    const inc = parseRupeesToPaise(v.minimumIncrement);
    if (sp && inc && inc > sp) ctx.addIssue({ code: "custom", path: ["minimumIncrement"], message: "Increment cannot exceed the starting price" });
  });
type Values = z.input<typeof schema>;

const toLocalInput = (ms: number) => {
  const d = new Date(ms - new Date(ms).getTimezoneOffset() * MINUTE);
  return d.toISOString().slice(0, 16);
};

export function AuctionForm({ auction, privateState, initialProductId }: { auction?: Auction; privateState?: AuctionPrivateState | null; initialProductId?: string | null }) {
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const { now, ready } = useServerNow(30_000);
  const [products, setProducts] = React.useState<Product[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState<"draft" | "publish" | null>(null);
  React.useEffect(() => subscribeFarmerProducts(user!.uid, (ps) => setProducts(ps.filter((p) => p.listingStatus === "active")), (e) => setError(e.message)), [user]);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: auction
      ? {
          productId: auction.productId,
          quantity: String(auction.quantity),
          startingPrice: paiseToRupeeString(auction.startingPrice),
          minimumIncrement: paiseToRupeeString(auction.minimumIncrement),
          reservePrice: privateState?.reservePrice ? paiseToRupeeString(privateState.reservePrice) : "",
          startMode: "later",
          startsAt: toLocalInput(auction.startsAt.toMillis()),
          duration: "custom",
          endsAt: toLocalInput(auction.endsAt.toMillis()),
          bidVisibility: auction.bidVisibility,
          description: auction.description,
          conditions: auction.conditions,
          acceptRules: false,
        }
      : {
          productId: initialProductId ?? "",
          quantity: "",
          startingPrice: "",
          minimumIncrement: "",
          reservePrice: "",
          startMode: "now",
          startsAt: "",
          duration: String(DAY),
          endsAt: "",
          bidVisibility: "public_anonymous",
          description: "",
          conditions: "",
          acceptRules: false,
        },
  });
  const { register, handleSubmit, formState, control, setError: setFieldError } = form;
  const errors = formState.errors;
  const w = useWatch({ control });
  const product = products?.find((p) => p.productId === w.productId);
  const unit = product ? unitShort(product.unit) : "unit";

  const times = (v: Values, nowMs: number) => {
    const startsAtMs = v.startMode === "now" ? nowMs : new Date(v.startsAt).getTime();
    const endsAtMs = v.duration === "custom" ? new Date(v.endsAt).getTime() : Math.max(startsAtMs, nowMs) + Number(v.duration);
    return { startsAtMs: Math.round(startsAtMs), endsAtMs: Math.round(endsAtMs) };
  };
  const preview = ready && w.startMode ? times(w as Values, now) : null;

  const submit = (mode: "draft" | "publish") =>
    handleSubmit(async (v) => {
      setError(null);
      if (mode === "publish" && !v.acceptRules) {
        setFieldError("acceptRules", { message: "Confirm that you accept the auction rules" });
        return;
      }
      if (!product) return setFieldError("productId", { message: "Choose an active listing" });
      if (Number(v.quantity) > product.availableQuantity) {
        return setFieldError("quantity", { message: `Only ${formatQuantity(product.availableQuantity, product.unit)} is available` });
      }
      const { startsAtMs, endsAtMs } = times(v, now || Date.now());
      if (!Number.isFinite(startsAtMs) || !Number.isFinite(endsAtMs)) return setError("Check the start and end times.");
      const payload: Omit<CreateAuctionInput, "publish"> = {
        productId: v.productId,
        quantity: Number(v.quantity),
        startingPrice: parseRupeesToPaise(v.startingPrice)!,
        minimumIncrement: parseRupeesToPaise(v.minimumIncrement)!,
        reservePrice: v.reservePrice ? parseRupeesToPaise(v.reservePrice)! : null,
        startsAtMs,
        endsAtMs,
        description: v.description,
        conditions: v.conditions,
        bidVisibility: v.bidVisibility,
      };
      setSubmitting(mode);
      try {
        let auctionId = auction?.auctionId;
        let status: string = "draft";
        if (auction) {
          await call("updateAuctionDraft", { ...payload, auctionId });
          if (mode === "publish") status = (await call<{ auctionId: string }, { status: string }>("publishAuction", { auctionId: auction.auctionId })).status;
        } else {
          const res = await call<CreateAuctionInput, { auctionId: string; status: string }>("createAuction", { ...payload, publish: mode === "publish" });
          auctionId = res.auctionId;
          status = res.status;
        }
        toast.success(status === "draft" ? "Draft saved." : status === "live" ? "Your auction is live." : "Auction scheduled.");
        router.push(status === "draft" ? "/farmer/auctions" : `/auctions/${auctionId}`);
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setSubmitting(null);
      }
    })();

  if (!products) return <Spinner />;
  if (products.length === 0 && !auction)
    return (
      <EmptyState
        title="You need an active listing first"
        description="Auctions sell part or all of the available quantity of one of your listings."
        action={
          <Button asChild>
            <Link href="/farmer/products/new">Add a listing</Link>
          </Button>
        }
      />
    );

  const sp = w.startingPrice ? parseRupeesToPaise(w.startingPrice) : null;
  return (
    <form onSubmit={(e) => e.preventDefault()} className="space-y-6" noValidate>
      {error && (
        <Alert tone="danger" title="The auction was not saved">
          {error}
        </Alert>
      )}
      <Card>
        <CardHeader>
          <CardTitle>What are you auctioning?</CardTitle>
          <CardDescription>The quantity is reserved from the listing when the auction is published, so it cannot be sold twice.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Listing" htmlFor="productId" required error={errors.productId?.message} className="sm:col-span-2">
            <NativeSelect id="productId" {...register("productId")} aria-invalid={!!errors.productId}>
              <option value="">Choose a listing</option>
              {products.map((p) => (
                <option key={p.productId} value={p.productId}>
                  {p.name} ({formatQuantity(p.availableQuantity, p.unit)} available)
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field
            label={`Quantity${product ? ` (${UNITS[product.unit].plural.toLowerCase()})` : ""}`}
            htmlFor="quantity"
            required
            error={errors.quantity?.message}
            hint={product ? `Up to ${formatQuantity(product.availableQuantity, product.unit)}` : undefined}
          >
            <Input id="quantity" inputMode="numeric" {...register("quantity")} aria-invalid={!!errors.quantity} />
          </Field>
          <Field label="Bid visibility" htmlFor="bidVisibility" hint="Public shows anonymised bids live. Sealed hides amounts until the end.">
            <NativeSelect id="bidVisibility" {...register("bidVisibility")}>
              <option value="public_anonymous">Public, bidders anonymised</option>
              <option value="sealed">Sealed</option>
            </NativeSelect>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pricing</CardTitle>
          <CardDescription>All prices are per {product ? UNITS[product.unit].label.toLowerCase() : "unit"}, for the full quantity.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Field label="Starting price" htmlFor="startingPrice" required error={errors.startingPrice?.message}>
            <MoneyInput id="startingPrice" suffix={`/${unit}`} {...register("startingPrice")} aria-invalid={!!errors.startingPrice} />
          </Field>
          <Field label="Minimum increment" htmlFor="minimumIncrement" required error={errors.minimumIncrement?.message} hint="Each new bid must beat the highest by at least this much.">
            <MoneyInput id="minimumIncrement" {...register("minimumIncrement")} aria-invalid={!!errors.minimumIncrement} />
          </Field>
          <Field label="Reserve price (optional)" htmlFor="reservePrice" error={errors.reservePrice?.message} hint="Lowest price you will accept. Buyers only see that one is set.">
            <MoneyInput id="reservePrice" suffix={`/${unit}`} {...register("reservePrice")} aria-invalid={!!errors.reservePrice} />
          </Field>
          {sp && w.quantity && /^\d+$/.test(w.quantity) && (
            <p className="text-sm text-muted-foreground tabular sm:col-span-3">
              At the starting price, {formatQuantity(Number(w.quantity), product?.unit ?? "quintal")} is worth {formatINR(lineTotal(sp, Number(w.quantity)))}.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Timing</CardTitle>
          <CardDescription>Times are in your device&apos;s time zone. Bidding opens and closes by the FarmConnect server clock. There are no automatic extensions.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Start" htmlFor="startMode">
            <NativeSelect id="startMode" {...register("startMode")}>
              <option value="now">As soon as I publish</option>
              <option value="later">At a scheduled time</option>
            </NativeSelect>
          </Field>
          {w.startMode === "later" && (
            <Field label="Start time" htmlFor="startsAt" required error={errors.startsAt?.message}>
              <Input id="startsAt" type="datetime-local" {...register("startsAt")} aria-invalid={!!errors.startsAt} />
            </Field>
          )}
          <Field label="Duration" htmlFor="duration">
            <NativeSelect id="duration" {...register("duration")}>
              {DURATIONS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </NativeSelect>
          </Field>
          {w.duration === "custom" && (
            <Field label="End time" htmlFor="endsAt" required error={errors.endsAt?.message}>
              <Input id="endsAt" type="datetime-local" {...register("endsAt")} aria-invalid={!!errors.endsAt} />
            </Field>
          )}
          {preview && Number.isFinite(preview.startsAtMs) && Number.isFinite(preview.endsAtMs) && (
            <p className="text-sm text-muted-foreground sm:col-span-2">
              Runs from {new Date(preview.startsAtMs).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })} to{" "}
              {new Date(preview.endsAtMs).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Details for buyers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="About this lot" htmlFor="description" error={errors.description?.message} hint="Quality, packing, moisture, storage. Optional.">
            <Textarea id="description" rows={3} {...register("description")} maxLength={1000} />
          </Field>
          <Field label="Conditions" htmlFor="conditions" error={errors.conditions?.message} hint="For example pickup location, loading, payment timing. Optional.">
            <Textarea id="conditions" rows={3} {...register("conditions")} maxLength={2000} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 pt-5 text-sm">
          <h2 className="font-semibold">Before you publish</h2>
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            <li>The highest valid bid at the end time wins, if it meets your reserve price.</li>
            <li>You can cancel only before the first bid. After that, only an administrator can cancel.</li>
            <li>When there is a winner, an agreement is recorded and contact details are shared between you and the winner.</li>
          </ul>
          <label className="flex items-start gap-2">
            <input type="checkbox" className="mt-1 size-4 accent-[var(--color-primary)]" {...register("acceptRules")} />
            <span>
              I accept the{" "}
              <Link href="/terms#auction-rules" target="_blank" className="font-medium text-primary hover:underline">
                auction rules
              </Link>{" "}
              and will honour the result.
            </span>
          </label>
          {errors.acceptRules && (
            <p role="alert" className="text-xs text-danger">
              {errors.acceptRules.message}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" type="button" onClick={() => submit("draft")} loading={submitting === "draft"} disabled={!!submitting}>
          Save draft
        </Button>
        <Button type="button" onClick={() => submit("publish")} loading={submitting === "publish"} disabled={!!submitting}>
          Publish auction
        </Button>
      </div>
    </form>
  );
}
