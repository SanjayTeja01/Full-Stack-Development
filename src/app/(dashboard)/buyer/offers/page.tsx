import { PageHeader } from "@/components/layout/app-shell";
import { OffersView } from "@/components/offers/offers-view";

export default function OffersPage() {
  return (
    <>
      <PageHeader title="My offers" description="Private negotiations, grouped by listing. Respond from the chat, where the full conversation is kept." />
      <OffersView />
    </>
  );
}
