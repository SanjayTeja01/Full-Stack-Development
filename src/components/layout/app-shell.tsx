"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Boxes,
  ClipboardList,
  FileWarning,
  FolderTree,
  Gavel,
  Handshake,
  Heart,
  LayoutDashboard,
  Menu,
  MessageSquare,
  ScrollText,
  Search,
  Settings,
  ShieldCheck,
  Store,
  Tags,
  Users,
  X,
  BadgeCheck,
  ServerCrash,
} from "lucide-react";
import type { Role } from "@shared/types";
import { useAuth } from "@/components/auth/auth-provider";
import { Brand } from "./brand";
import { NotificationBell, UserMenu } from "./user-menu";
import { Alert } from "@/components/ui/feedback";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }>; exact?: boolean };

const NAV: Record<Role, NavItem[]> = {
  farmer: [
    { href: "/farmer", label: "Overview", icon: LayoutDashboard, exact: true },
    { href: "/farmer/products", label: "My listings", icon: Boxes },
    { href: "/farmer/auctions", label: "My auctions", icon: Gavel },
    { href: "/messages", label: "Messages", icon: MessageSquare },
    { href: "/farmer/offers", label: "Offers", icon: Tags },
    { href: "/agreements", label: "Agreements", icon: Handshake },
    { href: "/notifications", label: "Notifications", icon: Bell },
    { href: "/settings", label: "Profile and settings", icon: Settings },
  ],
  buyer: [
    { href: "/buyer", label: "Overview", icon: LayoutDashboard, exact: true },
    { href: "/marketplace", label: "Marketplace", icon: Search },
    { href: "/buyer/auctions", label: "Live bidding", icon: Gavel },
    { href: "/messages", label: "Messages", icon: MessageSquare },
    { href: "/buyer/offers", label: "My offers", icon: Tags },
    { href: "/buyer/bids", label: "My bids", icon: ClipboardList },
    { href: "/buyer/saved", label: "Saved", icon: Heart },
    { href: "/agreements", label: "Agreements", icon: Handshake },
    { href: "/notifications", label: "Notifications", icon: Bell },
    { href: "/settings", label: "Profile and settings", icon: Settings },
  ],
  admin: [
    { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
    { href: "/admin/users", label: "Users", icon: Users },
    { href: "/admin/verification", label: "Verification", icon: BadgeCheck },
    { href: "/admin/listings", label: "Listings", icon: Store },
    { href: "/admin/reports", label: "Reports", icon: FileWarning },
    { href: "/admin/auctions", label: "Auctions and bids", icon: Gavel },
    { href: "/admin/agreements", label: "Agreements", icon: Handshake },
    { href: "/admin/categories", label: "Categories", icon: FolderTree },
    { href: "/admin/audit", label: "Audit log", icon: ScrollText },
    { href: "/admin/errors", label: "Operational errors", icon: ServerCrash },
  ],
};

function NavLinks({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <ul className="dashboard-nav-list space-y-1">
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "dashboard-nav-link flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
                active && "is-active bg-primary-soft text-primary hover:bg-primary-soft hover:text-primary",
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { role, profile } = useAuth();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const items = role ? NAV[role] : [];
  const suspended = profile?.accountStatus === "suspended";

  return (
    <div className="flex min-h-screen flex-col">
      <header className="dashboard-topbar sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur sm:px-6">
        <button
          type="button"
          className="rounded-md p-2 hover:bg-muted lg:hidden"
          aria-label="Open navigation"
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen(true)}
        >
          <Menu className="size-5" />
        </button>
        <Brand />
        {role === "admin" && (
          <span className="hidden items-center gap-1 rounded bg-info-soft px-2 py-0.5 text-xs font-medium text-info sm:flex">
            <ShieldCheck className="size-3" /> Administrator
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          <NotificationBell />
          <UserMenu />
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-[1400px] flex-1">
        <aside className="dashboard-sidebar sticky top-16 hidden h-[calc(100vh-4rem)] w-60 shrink-0 overflow-y-auto border-r border-border px-3 py-6 lg:block">
          <nav aria-label="Dashboard">
            <NavLinks items={items} />
          </nav>
        </aside>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
            <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
            <div className="dashboard-mobile-panel absolute inset-y-0 left-0 w-72 overflow-y-auto bg-background p-4 shadow-xl">
              <div className="mb-4 flex items-center justify-between">
                <Brand />
                <button type="button" className="rounded-md p-2 hover:bg-muted" aria-label="Close navigation" onClick={() => setMobileOpen(false)}>
                  <X className="size-5" />
                </button>
              </div>
              <NavLinks items={items} onNavigate={() => setMobileOpen(false)} />
            </div>
          </div>
        )}
        <main id="main" className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {suspended && (
            <Alert tone="danger" title="Your account is restricted" className="mb-6">
              An administrator has suspended this account. You can view your records, but you cannot list produce, send offers or bid.
              Contact support if you think this is a mistake.
            </Alert>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="dashboard-page-header mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
