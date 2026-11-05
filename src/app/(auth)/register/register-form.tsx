"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createUserWithEmailAndPassword, sendEmailVerification, updateProfile } from "firebase/auth";
import { Sprout, ShoppingBasket } from "lucide-react";
import { firebase } from "@/lib/firebase/client";
import { errorMessage } from "@/lib/firebase/callable";
import { useAuth } from "@/components/auth/auth-provider";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { cn } from "@/lib/utils";

const schema = z
  .object({
    role: z.enum(["farmer", "buyer"], { message: "Choose how you will use FarmConnect" }),
    displayName: z.string().trim().min(2, "Enter your name").max(60),
    email: z.string().trim().email("Enter a valid email address"),
    password: z.string().min(8, "Use at least 8 characters").max(128),
    confirm: z.string(),
    accept: z.literal(true, { message: "You must accept the terms to continue" }),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords do not match" });
type Values = z.input<typeof schema>;

export function RegisterForm() {
  const params = useSearchParams();
  const router = useRouter();
  const { status } = useAuth();
  const [error, setError] = React.useState<string | null>(null);
  const initialRole = params.get("role") === "farmer" || params.get("role") === "buyer" ? (params.get("role") as "farmer" | "buyer") : undefined;
  const { register, handleSubmit, formState, control, setValue } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { role: initialRole },
  });
  const role = useWatch({ control, name: "role" });

  React.useEffect(() => {
    if (status === "ready") router.replace("/");
  }, [status, router]);

  const onSubmit = async (v: Values) => {
    setError(null);
    try {
      const cred = await createUserWithEmailAndPassword(firebase().auth, v.email, v.password);
      await updateProfile(cred.user, { displayName: v.displayName });
      sendEmailVerification(cred.user).catch(() => undefined);
      router.push(`/onboarding?role=${v.role}`);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle className="text-xl">Create your FarmConnect account</CardTitle>
        <CardDescription>It takes two short steps. You will add your location and phone number next.</CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert tone="danger" className="mb-4">
            {error}
          </Alert>
        )}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">I want to</legend>
            <div className="grid gap-3 sm:grid-cols-2" role="radiogroup">
              {[
                { value: "farmer" as const, title: "Sell produce", body: "List crops, negotiate and run auctions.", Icon: Sprout },
                { value: "buyer" as const, title: "Buy produce", body: "Search, negotiate and bid on listings.", Icon: ShoppingBasket },
              ].map(({ value, title, body, Icon }) => (
                <label
                  key={value}
                  className={cn(
                    "flex cursor-pointer gap-3 rounded-md border p-3 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                    role === value ? "border-primary bg-primary-soft" : "border-input bg-card hover:bg-muted",
                  )}
                >
                  <input type="radio" value={value} className="sr-only" {...register("role")} onChange={() => setValue("role", value, { shouldValidate: true })} checked={role === value} />
                  <Icon className={cn("mt-0.5 size-5", role === value ? "text-primary" : "text-muted-foreground")} />
                  <span>
                    <span className="block text-sm font-medium">{title}</span>
                    <span className="block text-xs text-muted-foreground">{body}</span>
                  </span>
                </label>
              ))}
            </div>
            {formState.errors.role && <p className="mt-1.5 text-xs text-danger" role="alert">{formState.errors.role.message}</p>}
          </fieldset>
          <Field label="Your name" htmlFor="displayName" error={formState.errors.displayName?.message} hint="Shown on your profile and in chats.">
            <Input id="displayName" autoComplete="name" aria-invalid={!!formState.errors.displayName} {...register("displayName")} />
          </Field>
          <Field label="Email" htmlFor="email" error={formState.errors.email?.message}>
            <Input id="email" type="email" autoComplete="email" aria-invalid={!!formState.errors.email} {...register("email")} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Password" htmlFor="password" error={formState.errors.password?.message}>
              <Input id="password" type="password" autoComplete="new-password" aria-invalid={!!formState.errors.password} {...register("password")} />
            </Field>
            <Field label="Confirm password" htmlFor="confirm" error={formState.errors.confirm?.message}>
              <Input id="confirm" type="password" autoComplete="new-password" aria-invalid={!!formState.errors.confirm} {...register("confirm")} />
            </Field>
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-0.5 size-4 accent-[var(--primary)]" {...register("accept")} />
            <span>
              I agree to the{" "}
              <Link href="/terms" className="text-primary hover:underline" target="_blank">
                terms of use
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="text-primary hover:underline" target="_blank">
                privacy policy
              </Link>
              .
            </span>
          </label>
          {formState.errors.accept && <p className="-mt-3 text-xs text-danger" role="alert">{formState.errors.accept.message}</p>}
          <Button type="submit" className="w-full" loading={formState.isSubmitting}>
            Continue
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already registered?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
