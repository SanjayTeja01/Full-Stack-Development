"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { Brand } from "./brand";
import { Button } from "@/components/ui/button";
import { dashboardPathFor, useAuth } from "@/components/auth/auth-provider";
import { NotificationBell, UserMenu } from "./user-menu";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/marketplace", label: "Marketplace" },
  { href: "/auctions", label: "Auctions" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/help", label: "Help" },
];

export function SiteHeader() {
  const { status, role } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Brand />
        <nav aria-label="Main" className="hidden flex-1 items-center gap-1 md:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
                pathname.startsWith(n.href) && n.href !== "/#how-it-works" && "text-foreground",
              )}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {status === "loading" ? (
            <span className="h-9 w-32" aria-hidden />
          ) : status === "signed_out" ? (
            <>
              <Button asChild variant="ghost" className="hidden sm:inline-flex">
                <Link href="/login">Log in</Link>
              </Button>
              <Button asChild>
                <Link href="/register">Get started <span aria-hidden>↗</span></Link>
              </Button>
            </>
          ) : (
            <>
              <Button asChild variant="secondary" size="sm" className="hidden sm:inline-flex">
                <Link href={dashboardPathFor(role)}>Dashboard</Link>
              </Button>
              {status === "ready" && <NotificationBell />}
              <UserMenu />
            </>
          )}
          <button
            type="button"
            className="rounded-md p-2 hover:bg-muted md:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>
      {open && (
        <nav aria-label="Mobile" className="border-t border-border bg-background px-4 py-2 md:hidden">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className="block rounded-md px-3 py-2.5 text-sm font-medium hover:bg-muted">
              {n.label}
            </Link>
          ))}
          {status === "signed_out" && (
            <Link href="/login" onClick={() => setOpen(false)} className="block rounded-md px-3 py-2.5 text-sm font-medium hover:bg-muted">
              Sign in
            </Link>
          )}
          {status !== "signed_out" && status !== "loading" && (
            <Link href={dashboardPathFor(role)} onClick={() => setOpen(false)} className="block rounded-md px-3 py-2.5 text-sm font-medium hover:bg-muted">
              Dashboard
            </Link>
          )}
        </nav>
      )}
    </header>
  );
}
