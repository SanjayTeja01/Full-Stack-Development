"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { completeRegistrationSchema, type CompleteRegistrationInput } from "@shared/schemas";
import { call, errorMessage } from "@/lib/firebase/callable";
import { dashboardPathFor, useAuth } from "@/components/auth/auth-provider";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, Spinner } from "@/components/ui/feedback";
import { LocationFields } from "@/components/forms/location-fields";

export function OnboardingForm() {
  const params = useSearchParams();
  const router = useRouter();
  const { status, user, role, refreshClaims } = useAuth();
  const [error, setError] = React.useState<string | null>(null);
  const queryRole = params.get("role");

  const form = useForm<CompleteRegistrationInput>({
    resolver: zodResolver(completeRegistrationSchema),
    defaultValues: {
      role: queryRole === "farmer" || queryRole === "buyer" ? queryRole : undefined,
      displayName: "",
      whatsappEnabled: true,
      location: { state: undefined as unknown as CompleteRegistrationInput["location"]["state"], district: "" },
    },
  });
  const { register, handleSubmit, formState, reset, getValues } = form;

  React.useEffect(() => {
    if (user?.displayName && !getValues("displayName")) reset({ ...getValues(), displayName: user.displayName });
  }, [user, reset, getValues]);

  React.useEffect(() => {
    if (status === "signed_out") router.replace("/login?next=/onboarding");
    if (status === "ready") router.replace(dashboardPathFor(role));
  }, [status, role, router]);

  if (status === "loading" || status === "signed_out") return <Spinner />;

  const onSubmit = async (v: CompleteRegistrationInput) => {
    setError(null);
    try {
      await call("completeRegistration", v);
      await refreshClaims();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="text-xl">Complete your profile</CardTitle>
        <CardDescription>
          Your district is shown on your listings. Your phone number stays private and is only shared with the other party of an agreement.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert tone="danger" className="mb-4">
            {error}
          </Alert>
        )}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Account type" htmlFor="role" error={formState.errors.role?.message} required>
              <NativeSelect id="role" aria-invalid={!!formState.errors.role} {...register("role")}>
                <option value="">Choose</option>
                <option value="farmer">Farmer (I sell produce)</option>
                <option value="buyer">Buyer (I purchase produce)</option>
              </NativeSelect>
            </Field>
            <Field label="Display name" htmlFor="displayName" error={formState.errors.displayName?.message} required>
              <Input id="displayName" aria-invalid={!!formState.errors.displayName} {...register("displayName")} />
            </Field>
            <Field label="Mobile number" htmlFor="phone" error={formState.errors.phone?.message} required hint="10-digit Indian mobile number.">
              <Input id="phone" type="tel" inputMode="tel" autoComplete="tel" aria-invalid={!!formState.errors.phone} {...register("phone")} />
            </Field>
            <Field label="Business or organisation" htmlFor="org" error={formState.errors.organizationName?.message} hint="Optional">
              <Input id="org" autoComplete="organization" {...register("organizationName")} />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-[var(--primary)]" {...register("whatsappEnabled")} />
            This number can be contacted on WhatsApp after an agreement
          </label>
          <LocationFields register={register} errors={formState.errors} />
          <p className="text-xs text-muted-foreground">Your account type cannot be changed later without contacting support.</p>
          <Button type="submit" className="w-full sm:w-auto" loading={formState.isSubmitting}>
            Finish setup
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
