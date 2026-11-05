"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { applyActionCode, confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth";
import { firebase } from "@/lib/firebase/client";
import { errorMessage } from "@/lib/firebase/callable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, Spinner } from "@/components/ui/feedback";

/**
 * Handles Firebase email action links (password reset, email verification).
 * Configure this page as the custom action URL in Firebase Authentication > Templates.
 */
export function AuthAction() {
  const params = useSearchParams();
  const router = useRouter();
  const mode = params.get("mode");
  const code = params.get("oobCode") ?? "";
  const [email, setEmail] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    const { auth } = firebase();
    if (mode === "resetPassword") {
      verifyPasswordResetCode(auth, code).then(setEmail, (e) => setError(errorMessage(e)));
    } else if (mode === "verifyEmail") {
      applyActionCode(auth, code).then(
        () => setDone(true),
        (e) => setError(errorMessage(e)),
      );
    }
  }, [mode, code]);
  const unknownMode = mode !== "resetPassword" && mode !== "verifyEmail";
  const shownError = unknownMode ? "This link is not recognised." : error;

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-xl">{mode === "verifyEmail" ? "Verify your email" : "Choose a new password"}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {shownError ? (
          <>
            <Alert tone="danger">{shownError}</Alert>
            <Link href="/forgot-password" className="text-sm text-primary hover:underline">
              Request a new link
            </Link>
          </>
        ) : mode === "verifyEmail" ? (
          done ? (
            <Alert tone="success" title="Email verified">
              <Link href="/login" className="underline">Continue to FarmConnect</Link>
            </Alert>
          ) : (
            <Spinner label="Verifying" />
          )
        ) : !email ? (
          <Spinner label="Checking link" />
        ) : (
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (password.length < 8) return setError("Use at least 8 characters.");
              if (password !== confirm) return setError("Passwords do not match.");
              setSaving(true);
              try {
                await confirmPasswordReset(firebase().auth, code, password);
                router.replace("/login?reset=1");
              } catch (err) {
                setError(errorMessage(err));
                setSaving(false);
              }
            }}
          >
            <p className="text-sm text-muted-foreground">Account: {email}</p>
            <Field label="New password" htmlFor="pw">
              <Input id="pw" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            <Field label="Confirm new password" htmlFor="pw2">
              <Input id="pw2" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </Field>
            <Button type="submit" className="w-full" loading={saving}>
              Update password
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
