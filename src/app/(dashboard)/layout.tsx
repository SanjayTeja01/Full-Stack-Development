import { AppShellGuarded } from "./shell";

// Dashboards render for the signed-in user only, which is resolved in the browser.
export const instant = false;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <AppShellGuarded>{children}</AppShellGuarded>;
}
