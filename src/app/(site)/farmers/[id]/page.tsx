import { Suspense } from "react";
import { FarmerProfileView } from "./farmer-profile";
import { Spinner } from "@/components/ui/feedback";

export default function FarmerProfilePage({ params }: PageProps<"/farmers/[id]">) {
  return (
    <Suspense fallback={<Spinner />}>
      <FarmerProfileView params={params} />
    </Suspense>
  );
}
