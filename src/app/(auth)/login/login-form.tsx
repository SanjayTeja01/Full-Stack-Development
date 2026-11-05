"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { signInWithEmailAndPassword } from "firebase/auth";
import { firebase } from "@/lib/firebase/client";
import { errorMessage } from "@/lib/firebase/callable";
import { dashboardPathFor, useAuth } from "@/components/auth/auth-provider";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";

const schema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});
type Values = z.infer<typeof schema>;

function safeNext(next: string | null): string | null {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : null;
}

export function LoginForm() {
  const params = useSearchParams();
  const router = useRouter();
  const { status, role } = useAuth();
  const [error, setError] = React.useState<string | null>(null);
  const next = safeNext(params.get("next"));
  const { register, handleSubmit, formState } = useForm<Values>({ resolver: zodResolver(schema) });

  React.useEffect(() => {
    if (status === "ready") router.replace(next ?? dashboardPathFor(role));
    if (status === "needs_onboarding") router.replace("/onboarding");
  }, [status, role, next, router]);

  const onSubmit = async (v: Values) => {
    setError(null);
    try {
      await signInWithEmailAndPassword(firebase().auth, v.email, v.password);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-xl">Sign in to FarmConnect</CardTitle>
        <CardDescription>Welcome back. Use the email you registered with.</CardDescription>
      </CardHeader>
      <CardContent>
        {params.get("expired") && (
          <Alert tone="warning" className="mb-4" title="Your session ended">
            Please sign in again to continue.
          </Alert>
        )}
        {params.get("reset") && (
          <Alert tone="success" className="mb-4" title="Password updated">
            Sign in with your new password.
          </Alert>
        )}
        {error && (
          <Alert tone="danger" className="mb-4">
            {error}
          </Alert>
        )}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Field label="Email" htmlFor="email" error={formState.errors.email?.message}>
            <Input id="email" type="email" autoComplete="email" aria-invalid={!!formState.errors.email} {...register("email")} />
          </Field>
          <Field label="Password" htmlFor="password" error={formState.errors.password?.message}>
            <Input id="password" type="password" autoComplete="current-password" aria-invalid={!!formState.errors.password} {...register("password")} />
          </Field>
          <div className="flex justify-end">
            <Link href="/forgot-password" className="text-sm text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
          <Button type="submit" className="w-full" loading={formState.isSubmitting || status === "loading" && formState.isSubmitSuccessful}>
            Sign in
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          New to FarmConnect?{" "}
          <Link href="/register" className="font-medium text-primary hover:underline">
            Create an account
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
