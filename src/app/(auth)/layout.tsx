import Link from "next/link";
import { Brand } from "@/components/layout/brand";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-muted/50">
      <header className="flex h-16 items-center px-4 sm:px-6">
        <Brand />
      </header>
      <main id="main" className="flex flex-1 items-start justify-center px-4 py-8 sm:py-14">
        {children}
      </main>
      <footer className="flex justify-center gap-4 py-6 text-xs text-muted-foreground">
        <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
        <Link href="/terms" className="hover:text-foreground">Terms</Link>
        <Link href="/help" className="hover:text-foreground">Help</Link>
      </footer>
    </div>
  );
}
