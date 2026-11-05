"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { sendEmailVerification, sendPasswordResetEmail } from "firebase/auth";
import { BadgeCheck, Clock, MailCheck } from "lucide-react";
import { updateProfileSchema, type UpdateProfileInput } from "@shared/schemas";
import type { PrivateContact, VerificationRequest } from "@shared/types";
import { firebase } from "@/lib/firebase/client";
import { call, errorMessage } from "@/lib/firebase/callable";
import { useAuth } from "@/components/auth/auth-provider";
import { PageHeader } from "@/components/layout/app-shell";
import { LocationFields } from "@/components/forms/location-fields";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, Spinner } from "@/components/ui/feedback";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";

export default function SettingsPage() {
  const { user, profile, role } = useAuth();
  const [contact, setContact] = React.useState<PrivateContact | null>(null);
  React.useEffect(() => {
    if (!user) return;
    getDoc(doc(firebase().db, "users", user.uid, "private", "contact")).then((s) => setContact((s.data() as PrivateContact) ?? null));
  }, [user]);
  if (!profile || !contact) return <Spinner />;
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Profile and settings" />
      <ProfileForm contact={contact} />
      {role === "farmer" && <VerificationCard />}
      <AccountCard />
    </div>
  );
}

function ProfileForm({ contact }: { contact: PrivateContact }) {
  const { profile, role } = useAuth();
  const toast = useToast();
  const [error, setError] = React.useState<string | null>(null);
  const form = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      displayName: profile!.displayName,
      phone: contact.phone?.replace(/^\+91/, "") ?? "",
      whatsappEnabled: contact.whatsappEnabled ?? false,
      location: { state: profile!.location.state as UpdateProfileInput["location"]["state"], district: profile!.location.district, village: profile!.location.village ?? "" },
      organizationName: profile!.organizationName ?? "",
      bio: profile!.bio ?? "",
      notificationPreferences: contact.notificationPreferences,
    },
  });
  const { register, handleSubmit, formState } = form;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>
          {role === "farmer"
            ? "Your name, district, organisation and bio are shown on your public profile."
            : "Farmers see your name and organisation in conversations, offers and agreements."}{" "}
          Your phone and email are private.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          noValidate
          onSubmit={handleSubmit(async (v) => {
            setError(null);
            try {
              await call("updateProfile", v);
              toast.success("Profile saved.");
            } catch (e) {
              setError(errorMessage(e));
            }
          })}
        >
          {error && <Alert tone="danger">{error}</Alert>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Display name" htmlFor="displayName" error={formState.errors.displayName?.message} required>
              <Input id="displayName" {...register("displayName")} />
            </Field>
            <Field label="Organisation" htmlFor="org" error={formState.errors.organizationName?.message}>
              <Input id="org" {...register("organizationName")} />
            </Field>
            <Field label="Mobile number" htmlFor="phone" error={formState.errors.phone?.message} required>
              <Input id="phone" type="tel" {...register("phone")} />
            </Field>
            <label className="flex items-center gap-2 self-end pb-2 text-sm">
              <input type="checkbox" className="size-4 accent-[var(--primary)]" {...register("whatsappEnabled")} />
              Reachable on WhatsApp
            </label>
          </div>
          <LocationFields register={register} errors={formState.errors} />
          <Field label="About you" htmlFor="bio" error={formState.errors.bio?.message} hint="Optional. Crops you grow, typical volumes, how buyers can inspect.">
            <Textarea id="bio" rows={3} {...register("bio")} />
          </Field>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">In-app notifications</legend>
            {(
              [
                ["messages", "New messages"],
                ["offers", "Offers and agreements"],
                ["auctions", "Auctions and bids"],
              ] as const
            ).map(([k, l]) => (
              <label key={k} className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="size-4 accent-[var(--primary)]" {...register(`notificationPreferences.${k}`)} />
                {l}
              </label>
            ))}
            <p className="text-xs text-muted-foreground">Important notices about agreements, auction results and your account are always sent.</p>
          </fieldset>
          <Button type="submit" loading={formState.isSubmitting}>
            Save profile
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function VerificationCard() {
  const { user, profile } = useAuth();
  const toast = useToast();
  const [request, setRequest] = React.useState<VerificationRequest | null>(null);
  const [note, setNote] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  React.useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(firebase().db, "verificationRequests", user.uid), (s) => setRequest((s.data() as VerificationRequest) ?? null), () => undefined);
  }, [user]);
  const status = profile!.verificationStatus;
  return (
    <Card id="verification" className="scroll-mt-20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Farmer verification
          {status === "verified" && (
            <Badge tone="success">
              <BadgeCheck /> Verified
            </Badge>
          )}
          {status === "pending" && (
            <Badge tone="info">
              <Clock /> Under review
            </Badge>
          )}
          {status === "rejected" && <Badge tone="danger">Not approved</Badge>}
        </CardTitle>
        <CardDescription>
          An administrator reviews your details before a verified badge appears on your profile and listings.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {status === "rejected" && request?.reviewNote && <Alert tone="warning" title="Reviewer note">{request.reviewNote}</Alert>}
        {(status === "unverified" || status === "rejected") && (
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setSaving(true);
              try {
                await call("requestVerification", { note });
                toast.success("Verification requested.");
                setNote("");
              } catch (err) {
                toast.error(errorMessage(err));
              } finally {
                setSaving(false);
              }
            }}
          >
            <Field label="Details for the reviewer" htmlFor="vnote" hint="For example: land record or FPO membership number, village, crops grown.">
              <Textarea id="vnote" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
            <Button type="submit" loading={saving} disabled={note.trim().length < 10}>
              Request verification
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function AccountCard() {
  const { user } = useAuth();
  const toast = useToast();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Account</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p>
          Email: <span className="font-medium">{user?.email}</span>{" "}
          {user?.emailVerified ? (
            <Badge tone="success">
              <MailCheck /> Verified
            </Badge>
          ) : (
            <Badge tone="warning">Not verified</Badge>
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          {!user?.emailVerified && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                sendEmailVerification(user!).then(
                  () => toast.success("Verification email sent."),
                  (e) => toast.error(errorMessage(e)),
                )
              }
            >
              Resend verification email
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              sendPasswordResetEmail(firebase().auth, user!.email!).then(
                () => toast.success("Password reset email sent."),
                (e) => toast.error(errorMessage(e)),
              )
            }
          >
            Change password
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
