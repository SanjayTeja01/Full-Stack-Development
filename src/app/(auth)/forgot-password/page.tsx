"use client";

import * as React from "react";
import Link from "next/link";
import { sendPasswordResetEmail } from "firebase/auth";
import { firebase } from "@/lib/firebase/client";
import { errorMessage } from "@/lib/firebase/callable";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";

export default function ForgotPasswordPage() {
  const [email, setEmail] = React.useState("");
  const [state, setState] = React.useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = React.useState<string | null>(null);

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-xl">Reset your password</CardTitle>
        <CardDescription>We will email you a link to choose a new password.</CardDescription>
      </CardHeader>
      <CardContent>
        {state === "sent" ? (
          <Alert tone="success" title="Check your email">
            If an account exists for {email}, a reset link is on its way. The link expires after one hour.
          </Alert>
        ) : (
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setError(null);
              if (!/^\S+@\S+\.\S+$/.test(email)) {
                setError("Enter a valid email address.");
                return;
              }
              setState("sending");
              try {
                await sendPasswordResetEmail(firebase().auth, email.trim(), { url: `${window.location.origin}/login?reset=1` });
                setState("sent");
              } catch (err) {
                const msg = errorMessage(err);
                // Do not reveal whether an account exists.
                if (msg.includes("incorrect")) setState("sent");
                else {
                  setError(msg);
                  setState("idle");
                }
              }
            }}
          >
            {error && <Alert tone="danger">{error}</Alert>}
            <Field label="Email" htmlFor="email">
              <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Button type="submit" className="w-full" loading={state === "sending"}>
              Send reset link
            </Button>
          </form>
        )}
        <p className="mt-6 text-center text-sm">
          <Link href="/login" className="text-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
