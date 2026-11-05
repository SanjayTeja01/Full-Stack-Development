"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import type { Role } from "@shared/types";
import { dashboardPathFor, useAuth } from "./auth-provider";
import { Spinner, EmptyState } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";

/**
 * Client-side route guard for navigation and UX only.
 * Data access is enforced by Firestore Security Rules and the server code.
 */
export function RequireAuth({ roles, children }: { roles?: Role[]; children: React.ReactNode }) {
  const { status, role, sessionExpired } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  React.useEffect(() => {
    if (status === "signed_out") {
      const params = new URLSearchParams({ next: pathname });
      if (sessionExpired) params.set("expired", "1");
      router.replace(`/login?${params.toString()}`);
    } else if (status === "needs_onboarding") {
      router.replace("/onboarding");
    }
  }, [status, sessionExpired, pathname, router]);

  if (status !== "ready") return <Spinner label={status === "signed_out" ? "Redirecting to sign in" : "Loading your account"} />;

  if (roles && (!role || !roles.includes(role))) {
    return (
      <div className="mx-auto max-w-lg py-16">
        <EmptyState
          icon={ShieldAlert}
          title="This area is not available for your account"
          description={`This section is for ${roles.join(" or ")} accounts.`}
          action={
            <Button asChild>
              <Link href={dashboardPathFor(role)}>Go to my dashboard</Link>
            </Button>
          }
        />
      </div>
    );
  }
  return <>{children}</>;
}
