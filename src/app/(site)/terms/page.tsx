import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms of use" };

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-6 px-4 py-12 text-sm leading-relaxed sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Terms of use</h1>
      <p className="rounded-md border border-warning/30 bg-warning-soft p-3 text-warning">
        Draft terms for the initial release. Have them reviewed before launch.
      </p>
      <section>
        <h2 className="text-lg font-semibold">The service</h2>
        <p>
          FarmConnect lets farmers list agricultural produce and lets buyers contact them, negotiate and bid. FarmConnect is not a party to any sale and does not
          process payments, provide transport or verify delivery.
        </p>
      </section>
      <section>
        <h2 className="text-lg font-semibold">Listings</h2>
        <p>Farmers must describe produce accurately, including grade, quantity and location, and may only list produce they own or are authorised to sell.</p>
      </section>
      <section>
        <h2 className="text-lg font-semibold">Offers and agreements</h2>
        <p>
          An accepted offer records agreed terms for the stated quantity and price per unit. Additional charges such as transport, loading or taxes are separate
          unless stated in the offer terms. An agreement is not proof of payment or delivery.
        </p>
      </section>
      <section id="auction-rules" className="scroll-mt-20">
        <h2 className="text-lg font-semibold">Auction rules</h2>
        <ol className="list-decimal space-y-1.5 pl-5">
          <li>Bids are per unit for the full auctioned quantity.</li>
          <li>The first bid must be at least the starting price. Each later bid must be at least the current highest bid plus the minimum increment.</li>
          <li>Bids are accepted only between the start and end time, as measured by the FarmConnect server.</li>
          <li>If two bids arrive at the same moment, they are processed one after the other. The second must still meet the minimum after the first is applied, or it is rejected.</li>
          <li>The current highest bidder cannot place another bid until outbid.</li>
          <li>At the end time, the highest valid bid wins, provided it meets the reserve price if one was set.</li>
          <li>A farmer may cancel an auction only before the first bid. After bidding begins, only an administrator can cancel it, with a recorded reason.</li>
          <li>There are no automatic time extensions in this version.</li>
          <li>Winning an auction records an agreement. Payment and delivery are arranged directly between the farmer and the winner.</li>
        </ol>
      </section>
      <section>
        <h2 className="text-lg font-semibold">Conduct and enforcement</h2>
        <p>Misleading listings, fake bids, harassment and non-fulfilment may lead to removal of listings or account suspension. Administrative actions are recorded with a reason.</p>
      </section>
    </article>
  );
}
