import { RequireAuth } from "@/components/auth/require-auth";

// Content depends on the signed-in user, which is only known in the browser.
export const instant = false;

export default function RoleLayout({ children }: { children: React.ReactNode }) {
  return <RequireAuth roles={["buyer"]}>{children}</RequireAuth>;
}
