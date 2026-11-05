import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Help centre" };

const SECTIONS = [
  {
    id: "listings",
    title: "Listings and prices",
    items: [
      "Every listing shows an asking price per unit (kilogram, quintal or tonne). The asking price is what the farmer is asking, not an agreed price.",
      "Marketplace cards also show the equivalent price per quintal so you can compare listings sold in different units.",
      "Available quantity is the stock the farmer has not yet reserved for an auction or committed to an accepted offer.",
    ],
  },
  {
    id: "offers",
    title: "Offers and counteroffers",
    items: [
      "Start a conversation from a listing, then use “Make an offer” to propose a quantity and price per unit.",
      "The farmer can accept, reject or counter. A counteroffer replaces the earlier offer, which stays visible in the history as “Countered”.",
      "Only one offer can be open in a conversation at a time. Offers expire at the time you choose; expired offers cannot be accepted.",
      "When an offer is accepted, the quantity is committed from the farmer's stock and an agreement is recorded. Chat messages are never treated as a formal offer or acceptance.",
    ],
  },
  {
    id: "auctions",
    title: "Auctions",
    items: [
      "An auction sells a fixed quantity. Bids are per unit. The first bid must be at least the starting price; every later bid must be at least the current highest bid plus the minimum increment.",
      "Bidding opens and closes by the server clock. A bid that reaches the server after the end time is rejected, even if your screen still showed time remaining.",
      "Bidder identities are hidden. Other buyers see labels such as “Bidder 2”.",
      "If a reserve price is set and the highest bid is below it, the auction ends without a winner.",
      "In version one there are no automatic time extensions.",
    ],
  },
  {
    id: "agreements",
    title: "After an agreement",
    items: [
      "Contact details are shared only between the two parties of an agreement.",
      "Payment, transport, inspection and delivery are arranged directly between you. FarmConnect does not hold or transfer money.",
      "Either party can update the agreement's progress. It shows as completed only when both parties confirm.",
      "If the sale does not go ahead, mark it as not completed. The quantity returns to the farmer's available stock.",
    ],
  },
  {
    id: "safety",
    title: "Trust and safety",
    items: [
      "Report listings, users, conversations or auctions you believe are misleading or abusive. Administrators review every report.",
      "You can block a conversation. The other person will no longer be able to send messages in it.",
      "Never pay before you have inspected produce or agreed terms you trust. FarmConnect cannot reverse payments made outside the platform.",
    ],
  },
];

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Help centre</h1>
      <p className="mt-2 text-muted-foreground">How listings, negotiation, auctions and agreements work on FarmConnect.</p>
      <nav aria-label="Help sections" className="mt-6 flex flex-wrap gap-2">
        {SECTIONS.map((s) => (
          <a key={s.id} href={`#${s.id}`} className="rounded border border-border bg-card px-3 py-1 text-sm hover:bg-muted">
            {s.title}
          </a>
        ))}
      </nav>
      {SECTIONS.map((s) => (
        <section key={s.id} id={s.id} className="mt-10 scroll-mt-20">
          <h2 className="text-xl font-semibold">{s.title}</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-foreground/85">
            {s.items.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </section>
      ))}
      <p className="mt-12 text-sm text-muted-foreground">
        Still need help? <Link href="/contact" className="text-primary hover:underline">Contact us</Link>.
      </p>
    </div>
  );
}
