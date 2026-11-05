import Link from "next/link";
import { Brand } from "./brand";

const COLUMNS = [
  {
    title: "Platform",
    links: [
      { href: "/marketplace", label: "Marketplace" },
      { href: "/auctions", label: "Auctions" },
      { href: "/register?role=farmer", label: "Sell as a farmer" },
      { href: "/register?role=buyer", label: "Buy produce" },
    ],
  },
  {
    title: "Support",
    links: [
      { href: "/help", label: "Help centre" },
      { href: "/contact", label: "Contact" },
      { href: "/help#safety", label: "Trust and safety" },
    ],
  },
  {
    title: "Policies",
    links: [
      { href: "/privacy", label: "Privacy policy" },
      { href: "/terms", label: "Terms of use" },
      { href: "/terms#auction-rules", label: "Auction rules" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="site-footer mt-auto">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.5fr_repeat(3,1fr)]">
        <div className="space-y-3">
          <Brand />
          <p className="max-w-xs text-sm text-muted-foreground">
            A marketplace where farmers and buyers trade agricultural produce directly through listings, private negotiation and open auctions.
          </p>
          <p className="max-w-xs text-xs text-muted-foreground">
            Payment, transport and delivery are arranged directly between the farmer and the buyer. FarmConnect does not handle money.
          </p>
        </div>
        {COLUMNS.map((col) => (
          <div key={col.title}>
            <h2 className="text-sm font-semibold">{col.title}</h2>
            <ul className="mt-3 space-y-2">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-muted-foreground hover:text-foreground">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border">
        <p className="mx-auto max-w-7xl px-4 py-4 text-xs text-muted-foreground sm:px-6">FarmConnect. Built for direct agricultural trade.</p>
      </div>
    </footer>
  );
}
