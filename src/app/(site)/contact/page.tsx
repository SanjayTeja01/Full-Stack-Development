import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Contact" };

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Contact</h1>
      <p className="mt-3 text-muted-foreground">
        For problems with a listing, user, conversation or auction, use the Report button on that page so an administrator can review it with full context.
      </p>
      <p className="mt-3 text-muted-foreground">
        For account or general questions, email{" "}
        <span className="font-medium text-foreground">{process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "the support address configured for this deployment"}</span>.
      </p>
      <p className="mt-6 text-sm">
        <Link href="/help" className="text-primary hover:underline">Read the help centre</Link>
      </p>
    </div>
  );
}
