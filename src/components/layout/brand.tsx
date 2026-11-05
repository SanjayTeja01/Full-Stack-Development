import Link from "next/link";
import { Sprout } from "lucide-react";
import { cn } from "@/lib/utils";

export function Brand({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={cn("flex items-center gap-2 font-semibold tracking-tight", className)}>
      <span className="brand-mark flex shrink-0 items-center justify-center text-primary-foreground">
        <Sprout className="size-5" aria-hidden />
      </span>
      <span className="brand-name">FarmConnect<span className="text-accent">.</span></span>
    </Link>
  );
}
