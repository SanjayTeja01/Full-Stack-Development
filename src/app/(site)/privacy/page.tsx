import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy policy" };

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-6 px-4 py-12 text-sm leading-relaxed sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Privacy policy</h1>
      <p className="rounded-md border border-warning/30 bg-warning-soft p-3 text-warning">
        Draft policy for the initial release. Have it reviewed before launch.
      </p>
      <section>
        <h2 className="text-lg font-semibold">What we collect</h2>
        <p>Your name, email, mobile number, state and district, optional village and organisation name, and the listings, messages, offers, bids and agreements you create.</p>
      </section>
      <section>
        <h2 className="text-lg font-semibold">What is public</h2>
        <p>Your display name, role, district and state, organisation name, verification status and published listings. Your email and phone number are never public.</p>
      </section>
      <section>
        <h2 className="text-lg font-semibold">When contact details are shared</h2>
        <p>Your phone number and email are shared only with the other party of an agreement: when an offer between you is accepted, or when an auction you ran or bid in ends with that person as the winner. Each reveal is recorded.</p>
      </section>
      <section>
        <h2 className="text-lg font-semibold">Auction privacy</h2>
        <p>Other bidders see bid amounts with anonymous labels, never your name. The farmer running the auction can see who bid.</p>
      </section>
      <section>
        <h2 className="text-lg font-semibold">Messages</h2>
        <p>Only the two participants can read a conversation. Administrators may review a conversation only when it has been reported.</p>
      </section>
      <section>
        <h2 className="text-lg font-semibold">Retention and deletion</h2>
        <p>Records of offers, bids, auction results and agreements are kept for audit purposes. Contact us to close your account.</p>
      </section>
    </article>
  );
}
