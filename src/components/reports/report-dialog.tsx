"use client";

import * as React from "react";
import { Flag } from "lucide-react";
import type { ReportTargetType } from "@shared/types";
import { call, errorMessage } from "@/lib/firebase/callable";
import { useAuth } from "@/components/auth/auth-provider";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, NativeSelect, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";

const REASONS: { value: string; label: string }[] = [
  { value: "misleading_listing", label: "Misleading listing or price" },
  { value: "prohibited_item", label: "Prohibited item" },
  { value: "fraud", label: "Suspected fraud or scam" },
  { value: "harassment", label: "Harassment or abuse" },
  { value: "spam", label: "Spam" },
  { value: "bid_manipulation", label: "Suspicious bidding" },
  { value: "non_fulfilment", label: "Did not complete an agreement" },
  { value: "other", label: "Something else" },
];

export function ReportButton({ targetType, targetId, label = "Report" }: { targetType: ReportTargetType; targetId: string; label?: string }) {
  const { status } = useAuth();
  const toast = useToast();
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  if (status !== "ready") return null;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          <Flag /> {label}
        </Button>
      </DialogTrigger>
      <DialogContent title={`Report this ${targetType}`} description="An administrator will review your report. The other person is not told who reported them.">
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!reason) return setError("Choose a reason.");
            if (description.trim().length < 10) return setError("Describe the problem in at least 10 characters.");
            setSaving(true);
            setError(null);
            try {
              await call("createReport", { targetType, targetId, reason, description });
              toast.success("Report sent. Thank you.");
              setOpen(false);
              setReason("");
              setDescription("");
            } catch (err) {
              setError(errorMessage(err));
            } finally {
              setSaving(false);
            }
          }}
        >
          {error && <Alert tone="danger">{error}</Alert>}
          <Field label="Reason" htmlFor="report-reason">
            <NativeSelect id="report-reason" value={reason} onChange={(e) => setReason(e.target.value)}>
              <option value="">Choose a reason</option>
              {REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="What happened?" htmlFor="report-desc">
            <Textarea id="report-desc" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Send report
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
