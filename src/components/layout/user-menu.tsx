"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { DropdownMenu } from "radix-ui";
import { Bell, ChevronDown, LayoutDashboard, LogOut, Settings } from "lucide-react";
import { dashboardPathFor, useAuth } from "@/components/auth/auth-provider";
import { useUnreadNotificationCount } from "@/lib/hooks/use-unread-notifications";

export function NotificationBell() {
  const { user } = useAuth();
  const count = useUnreadNotificationCount(user?.uid);
  return (
    <Link
      href="/notifications"
      className="relative rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
      aria-label={count ? `Notifications, ${count} unread` : "Notifications"}
    >
      <Bell className="size-5" />
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 min-w-5 rounded-full bg-danger px-1 text-center text-[11px] font-semibold leading-5 text-white tabular">
          {count > 98 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}

export function UserMenu() {
  const { profile, user, role, signOut } = useAuth();
  const router = useRouter();
  const name = profile?.displayName || user?.email || "Account";
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span className="flex size-8 items-center justify-center rounded-full bg-primary-soft font-semibold text-primary" aria-hidden>
          {name.slice(0, 1).toUpperCase()}
        </span>
        <span className="hidden max-w-32 truncate sm:inline">{name}</span>
        <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={6} className="z-50 min-w-52 rounded-md border border-border bg-card p-1 text-sm shadow-lg">
          <div className="px-2 py-1.5">
            <p className="truncate font-medium">{name}</p>
            <p className="text-xs capitalize text-muted-foreground">{role ?? "New account"}</p>
          </div>
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <DropdownMenu.Item asChild className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 outline-none data-[highlighted]:bg-muted">
            <Link href={dashboardPathFor(role)}>
              <LayoutDashboard className="size-4" /> Dashboard
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 outline-none data-[highlighted]:bg-muted">
            <Link href="/settings">
              <Settings className="size-4" /> Profile and settings
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <DropdownMenu.Item
            onSelect={async () => {
              await signOut();
              router.push("/");
            }}
            className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 outline-none data-[highlighted]:bg-muted"
          >
            <LogOut className="size-4" /> Sign out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
