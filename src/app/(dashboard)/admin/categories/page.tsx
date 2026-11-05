"use client";

import * as React from "react";
import { orderBy } from "firebase/firestore";
import type { Category } from "@shared/types";
import { call, errorMessage } from "@/lib/firebase/callable";
import { PageHeader } from "@/components/layout/app-shell";
import { useAdminQuery } from "@/components/admin/admin-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Alert, ErrorState, Skeleton } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";

type Draft = { id: string; name: string; description: string; examples: string; sortOrder: string; active: boolean };
const toDraft = (c?: Category): Draft => ({
  id: c?.id ?? "",
  name: c?.name ?? "",
  description: c?.description ?? "",
  examples: c?.examples.join(", ") ?? "",
  sortOrder: String(c?.sortOrder ?? 100),
  active: c?.active ?? true,
});

export default function AdminCategoriesPage() {
  const toast = useToast();
  const { items, error } = useAdminQuery<Category>("categories", [orderBy("sortOrder")], "all");
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [isNew, setIsNew] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const save = async () => {
    if (!draft) return;
    setBusy(true);
    setFormError(null);
    try {
      await call("adminUpsertCategory", {
        id: draft.id.trim(),
        name: draft.name.trim(),
        description: draft.description.trim(),
        examples: draft.examples.split(",").map((s) => s.trim()).filter(Boolean),
        sortOrder: Number(draft.sortOrder) || 0,
        active: draft.active,
      });
      toast.success("Category saved.");
      setDraft(null);
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft((d) => d && { ...d, [k]: e.target.value });

  return (
    <>
      <PageHeader
        title="Categories"
        description="Inactive categories are hidden from new listings and filters. Existing listings keep their category."
        actions={
          <Button
            onClick={() => {
              setIsNew(true);
              setDraft(toDraft());
            }}
          >
            Add category
          </Button>
        }
      />
      {error ? (
        <ErrorState message={error} />
      ) : !items ? (
        <Skeleton className="h-40" />
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {items.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
              <div>
                <span className="font-medium">{c.name}</span> <span className="font-mono text-xs text-muted-foreground">{c.id}</span>{" "}
                {!c.active && <Badge>Inactive</Badge>}
                <p className="text-xs text-muted-foreground">
                  Order {c.sortOrder} · {c.examples.join(", ") || "No examples"}
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setIsNew(false);
                  setDraft(toDraft(c));
                }}
              >
                Edit
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Dialog open={!!draft} onOpenChange={(o) => !o && !busy && setDraft(null)}>
        {draft && (
          <DialogContent title={isNew ? "Add category" : `Edit ${draft.name}`}>
            <div className="space-y-4">
              <Field label="Id" htmlFor="c-id" hint="Lowercase letters, numbers and dashes. Cannot be changed later.">
                <Input id="c-id" value={draft.id} onChange={set("id")} disabled={!isNew} />
              </Field>
              <Field label="Name" htmlFor="c-name">
                <Input id="c-name" value={draft.name} onChange={set("name")} />
              </Field>
              <Field label="Description" htmlFor="c-desc">
                <Textarea id="c-desc" rows={2} value={draft.description} onChange={set("description")} />
              </Field>
              <Field label="Examples" htmlFor="c-ex" hint="Comma separated, used as name suggestions.">
                <Input id="c-ex" value={draft.examples} onChange={set("examples")} />
              </Field>
              <Field label="Sort order" htmlFor="c-order">
                <Input id="c-order" inputMode="numeric" value={draft.sortOrder} onChange={set("sortOrder")} />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="size-4" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} /> Active
              </label>
              {formError && <Alert tone="danger">{formError}</Alert>}
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setDraft(null)} disabled={busy}>
                  Cancel
                </Button>
                <Button onClick={save} loading={busy}>
                  Save
                </Button>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
