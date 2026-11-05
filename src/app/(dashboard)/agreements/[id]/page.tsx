import { Suspense } from "react";
import { AgreementView } from "./view";
import { Spinner } from "@/components/ui/feedback";

export default function Page({ params }: PageProps<"/agreements/[id]">) {
  return (
    <Suspense fallback={<Spinner />}>
      <AgreementView params={params} />
    </Suspense>
  );
}
