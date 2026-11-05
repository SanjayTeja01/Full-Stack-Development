"use client";

import * as React from "react";
import Link from "next/link";
import { Mail, MessageCircle, Phone, ShieldAlert } from "lucide-react";
import type { Agreement } from "@shared/types";
import type { AgreementAction } from "@shared/agreement";
import { AGREEMENT_STATUS_LABELS } from "@shared/agreement";
import { formatINR } from "@shared/money";
import { formatQuantity, unitShort } from "@shared/units";
import { useAuth } from "@/components/auth/auth-provider";
import { subscribeAgreement, type CounterpartyContact } from "@/lib/data/agreements";
import { call, errorMessage } from "@/lib/firebase/callable";
import { PageHeader } from "@/components/layout/app-shell";
import { AgreementStatusBadge } from "@/components/offers/agreement-status";
import { ReportButton } from "@/components/reports/report-dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, EmptyState, Spinner } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { formatDateTime } from "@/lib/format";

export function AgreementView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const { user } = useAuth();
  const uid = user!.uid;
  const toast = useToast();
  const [a, setA] = React.useState<Agreement | null | undefined>(undefined);
  const [contacts, setContacts] = React.useState<CounterpartyContact[] | null>(null);
  const [contactError, setContactError] = React.useState<string | null>(null);
  const [confirm, setConfirm] = React.useState<AgreementAction | null>(null);
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => subscribeAgreement(id, setA, () => setA(null)), [id]);

  if (a === undefined) return <Spinner />;
  if (!a) return <EmptyState title="Agreement not found" action={<Button asChild variant="secondary"><Link href="/agreements">All agreements</Link></Button>} />;

  const other = a.participantIds.find((p) => p !== uid)!;
  const closed = a.status === "completed" || a.status === "not_completed";
  const iConfirmed = a.completionConfirmedBy.includes(uid);
  const otherConfirmed = a.completionConfirmedBy.includes(other);

  const act = async (action: AgreementAction) => {
    setBusy(true);
    try {
      const res = await call<unknown, { waitingForOtherParty: boolean }>("updateAgreementStatus", { agreementId: a.agreementId, action, note: note || null });
      toast.success(res.waitingForOtherParty ? "Recorded. Waiting for the other party to confirm." : "Agreement updated.");
      setConfirm(null);
      setNote("");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const revealContacts = async () => {
    setContactError(null);
    try {
      const res = await call<{ agreementId: string }, { contacts: CounterpartyContact[] }>("getAgreementContacts", { agreementId: a.agreementId });
      setContacts(res.contacts);
    } catch (e) {
      setContactError(errorMessage(e));
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title={`Agreement: ${a.productName}`}
        description={`${a.source === "auction" ? "Auction result" : "Accepted private offer"} recorded ${formatDateTime(a.createdAt)}`}
        actions={<AgreementStatusBadge status={a.status} />}
      />
      <Alert tone="info" title="What this agreement means">
        It records the agreed quantity and price. It is not proof of payment or delivery. Payment, transport and inspection are arranged directly between you
        and {a.participantNames[other]}.
      </Alert>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Agreed terms</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Quantity</dt>
                <dd className="tabular">{formatQuantity(a.quantity, a.unit)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Price</dt>
                <dd className="tabular">
                  {formatINR(a.pricePerUnit)}/{unitShort(a.unit)}
                </dd>
              </div>
              <div className="flex justify-between border-t border-border pt-2">
                <dt className="text-muted-foreground">Product value</dt>
                <dd className="font-semibold tabular">{formatINR(a.totalValue)}</dd>
              </div>
              <p className="text-xs text-muted-foreground">Excludes transport and other charges unless included in the offer terms.</p>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Farmer</dt>
                <dd>{a.participantNames[a.farmerId]}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Buyer</dt>
                <dd>{a.participantNames[a.buyerId]}</dd>
              </div>
            </dl>
            <div className="mt-4 flex flex-wrap gap-2">
              {a.conversationId && (
                <Button asChild size="sm" variant="secondary">
                  <Link href={`/messages/${a.conversationId}`}>Open chat</Link>
                </Button>
              )}
              <Button asChild size="sm" variant="ghost">
                <Link href={a.source === "auction" ? `/auctions/${a.sourceId}` : `/products/${a.productId}`}>{a.source === "auction" ? "View auction" : "View listing"}</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contact {a.participantNames[other]}</CardTitle>
            <CardDescription>Shared only because you are both parties to this agreement. Each view is logged.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {contactError && <Alert tone="danger">{contactError}</Alert>}
            {!contacts ? (
              <Button onClick={revealContacts} variant="secondary">
                Show contact details
              </Button>
            ) : (
              contacts.map((c) => {
                const digits = c.phone?.replace(/\D/g, "") ?? "";
                return (
                  <div key={c.userId} className="space-y-2 text-sm">
                    <p className="font-medium">
                      {c.displayName}
                      {c.organizationName && <span className="text-muted-foreground"> · {c.organizationName}</span>}
                    </p>
                    <p className="text-muted-foreground">
                      {c.district}, {c.state}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {c.phone && (
                        <Button asChild size="sm" onClick={() => a.status === "agreement_recorded" && act("contact_initiated")}>
                          <a href={`tel:${c.phone}`}>
                            <Phone /> {c.phone}
                          </a>
                        </Button>
                      )}
                      {c.phone && c.whatsappEnabled && (
                        <Button asChild size="sm" variant="secondary">
                          <a href={`https://wa.me/${digits}`} target="_blank" rel="noopener noreferrer">
                            <MessageCircle /> WhatsApp
                          </a>
                        </Button>
                      )}
                      {c.email && (
                        <Button asChild size="sm" variant="ghost">
                          <a href={`mailto:${c.email}`}>
                            <Mail /> Email
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fulfilment progress</CardTitle>
          <CardDescription>Reported by the parties. FarmConnect does not verify payment or delivery.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {a.status === "disputed" && (
            <Alert tone="danger" title="Under dispute review">
              An administrator will review this agreement and record a resolution.
            </Alert>
          )}
          {!closed && a.status !== "disputed" && (
            <div className="flex flex-wrap gap-2">
              {a.status === "agreement_recorded" && (
                <Button size="sm" variant="secondary" onClick={() => act("contact_initiated")} loading={busy && !confirm}>
                  We have been in contact
                </Button>
              )}
              {(a.status === "agreement_recorded" || a.status === "contact_initiated") && (
                <Button size="sm" variant="secondary" onClick={() => act("in_progress")} disabled={busy}>
                  Fulfilment in progress
                </Button>
              )}
              <Button size="sm" onClick={() => setConfirm("confirm_completion")} disabled={iConfirmed || busy}>
                {iConfirmed ? "You confirmed completion" : "Confirm completed"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirm("not_completed")} disabled={busy}>
                Did not go ahead
              </Button>
              <Button size="sm" variant="ghost" className="text-danger" onClick={() => setConfirm("disputed")} disabled={busy}>
                <ShieldAlert /> Raise a dispute
              </Button>
            </div>
          )}
          {!closed && (iConfirmed || otherConfirmed) && (
            <p className="text-sm text-muted-foreground">
              {iConfirmed ? "You have" : `${a.participantNames[other]} has`} confirmed completion.{" "}
              {iConfirmed && !otherConfirmed ? `Waiting for ${a.participantNames[other]}.` : !iConfirmed ? "Confirm if it is complete." : ""}
            </p>
          )}
          <ol className="space-y-2 border-l-2 border-border pl-4 text-sm">
            {a.statusHistory.map((h, i) => (
              <li key={i}>
                <span className="font-medium">{AGREEMENT_STATUS_LABELS[h.status]}</span>
                <span className="text-muted-foreground">
                  {" "}
                  · {h.by === "system" ? "System" : a.participantNames[h.by] ?? "Administrator"} · {formatDateTime(h.at)}
                </span>
                {h.note && <p className="text-xs text-muted-foreground">{h.note}</p>}
              </li>
            ))}
          </ol>
          <div className="flex justify-end">
            <ReportButton targetType="agreement" targetId={a.agreementId} label="Report a problem" />
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirm === "confirm_completion"}
        onOpenChange={(o) => !o && setConfirm(null)}
        tone="primary"
        title="Confirm the sale is complete?"
        description="Only confirm once payment and delivery are done to your satisfaction. When both parties confirm, the quantity is recorded as sold."
        confirmLabel="Confirm completed"
        loading={busy}
        onConfirm={() => act("confirm_completion")}
      />
      <ConfirmDialog
        open={confirm === "not_completed"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Mark as not completed?"
        description="This closes the agreement. The committed quantity returns to the farmer's available stock. This cannot be undone."
        confirmLabel="Mark not completed"
        loading={busy}
        onConfirm={() => act("not_completed")}
      >
        <Textarea placeholder="Reason (optional)" value={note} onChange={(e) => setNote(e.target.value)} rows={2} aria-label="Reason" />
      </ConfirmDialog>
      <ConfirmDialog
        open={confirm === "disputed"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Raise a dispute?"
        description="The agreement is frozen until an administrator reviews it. Explain what went wrong."
        confirmLabel="Raise dispute"
        loading={busy}
        onConfirm={() => act("disputed")}
      >
        <Textarea placeholder="What happened?" value={note} onChange={(e) => setNote(e.target.value)} rows={3} aria-label="Dispute details" />
      </ConfirmDialog>
    </div>
  );
}
