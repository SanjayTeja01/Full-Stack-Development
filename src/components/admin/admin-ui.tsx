"use client";

import * as React from "react";
import { collection, onSnapshot, query, type QueryConstraint } from "firebase/firestore";
import { firebase } from "@/lib/firebase/client";
import { errorMessage } from "@/lib/firebase/callable";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";

/**
 * Live query for admin pages. Rules allow these reads only for administrators.
 * `key` must change whenever the constraints change.
 */
export function useAdminQuery<T>(path: string, constraints: QueryConstraint[], key: string) {
  const [items, setItems] = React.useState<T[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const ref = React.useRef(constraints);
  React.useEffect(() => {
    ref.current = constraints;
  });
  React.useEffect(() => {
    return onSnapshot(
      query(collection(firebase().db, path), ...ref.current),
      (s) => {
        setError(null);
        setItems(s.docs.map((d) => ({ ...(d.data() as T), _id: d.id })));
      },
      (e) => setError(e.message),
    );
  }, [path, key]);
  return { items: items as (T & { _id: string })[] | null, error };
}

/**
 * Confirms an administrative action and collects the reason that goes into the audit log.
 * `onSubmit` must throw on failure; the dialog stays open and shows the error.
 */
export function ActionDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  tone = "primary",
  reasonLabel = "Reason (recorded in the audit log)",
  reasonRequired = true,
  children,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string;
  confirmLabel: string;
  tone?: "primary" | "danger";
  reasonLabel?: string;
  reasonRequired?: boolean;
  children?: React.ReactNode;
  onSubmit: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const submit = async () => {
    if (reasonRequired && reason.trim().length < 5) return setError("Give a reason of at least 5 characters.");
    setBusy(true);
    setError(null);
    try {
      await onSubmit(reason.trim());
      setReason("");
      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent title={title} description={description}>
        <div className="space-y-4">
          {children}
          <Field label={reasonLabel} htmlFor="admin-reason">
            <Textarea id="admin-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
          </Field>
          {error && <Alert tone="danger">{error}</Alert>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant={tone} onClick={submit} loading={busy}>
              {confirmLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function FilterTabs<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div role="tablist" className="mb-4 flex flex-wrap gap-1 rounded-md bg-muted p-1 text-sm">
      {options.map(([v, l]) => (
        <button
          key={v}
          role="tab"
          aria-selected={value === v}
          onClick={() => onChange(v)}
          className={value === v ? "rounded bg-card px-3 py-1.5 font-medium shadow-sm" : "rounded px-3 py-1.5 text-muted-foreground hover:text-foreground"}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
