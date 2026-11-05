"use client";

import * as React from "react";
import type { Product } from "@shared/types";
import { formatQuantity, UNITS } from "@shared/units";
import { call, errorMessage } from "@/lib/firebase/callable";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";

export function StockBreakdown({ product }: { product: Product }) {
  const rows = [
    { label: "Available", value: product.availableQuantity, hint: "Free to offer, auction or sell" },
    { label: "Reserved for auctions", value: product.reservedQuantity, hint: "Held by scheduled or live auctions" },
    { label: "Committed", value: product.committedQuantity, hint: "Accepted offers and auction wins awaiting fulfilment" },
    { label: "Sold", value: product.soldQuantity, hint: "Confirmed complete by both parties" },
  ];
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {rows.map((r) => (
        <div key={r.label} className="rounded-md bg-muted/60 p-3">
          <dt className="text-xs text-muted-foreground" title={r.hint}>
            {r.label}
          </dt>
          <dd className="mt-0.5 font-semibold tabular">{formatQuantity(r.value, product.unit)}</dd>
        </div>
      ))}
    </dl>
  );
}

export function StockDialog({ product, open, onOpenChange }: { product: Product; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [value, setValue] = React.useState(String(product.availableQuantity));
  const [expected, setExpected] = React.useState(product.availableQuantity);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const toast = useToast();

  const reset = () => {
    setValue(String(product.availableQuantity));
    setExpected(product.availableQuantity);
    setError(null);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent title={`Update stock: ${product.name}`} description="Set how much is free to sell. Reserved and committed stock are not affected.">
        <div className="space-y-4">
          <StockBreakdown product={product} />
          {error && <Alert tone="danger">{error}</Alert>}
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!/^\d+$/.test(value)) return setError("Enter a whole number of zero or more.");
              setSaving(true);
              setError(null);
              try {
                await call("updateStock", { productId: product.productId, availableQuantity: Number(value), expectedAvailableQuantity: expected });
                toast.success("Stock updated.");
                onOpenChange(false);
              } catch (err) {
                setError(errorMessage(err));
                setExpected(product.availableQuantity);
              } finally {
                setSaving(false);
              }
            }}
          >
            <Field label={`Available quantity (${UNITS[product.unit].plural})`} htmlFor="stock">
              <Input id="stock" inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)} />
            </Field>
            {product.availableQuantity !== expected && (
              <p className="text-xs text-warning">
                Stock changed to {formatQuantity(product.availableQuantity, product.unit)} since you opened this. Saving will use the latest value as the starting point.
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={saving}>
                Save stock
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
