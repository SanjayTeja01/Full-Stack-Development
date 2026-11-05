"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";

export function HeroSearch() {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  return (
    <form
      role="search"
      className="hero-search"
      onSubmit={(e) => {
        e.preventDefault();
        router.push(q.trim() ? `/marketplace?q=${encodeURIComponent(q.trim())}` : "/marketplace");
      }}
    >
      <label htmlFor="hero-search" className="sr-only">
        Search produce
      </label>
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          id="hero-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="What are you looking for? Rice, maize, chillies…"
          className="focus-visible:ring-2 focus-visible:ring-ring/40 rounded-md"
        />
      </div>
      <Button type="submit">
        Search <Search className="size-3.5" />
      </Button>
    </form>
  );
}
