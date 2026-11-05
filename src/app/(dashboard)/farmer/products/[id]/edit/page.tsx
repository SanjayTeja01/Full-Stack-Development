import { Suspense } from "react";
import { EditProductView } from "./view";
import { Spinner } from "@/components/ui/feedback";

export default function Page({ params }: PageProps<"/farmer/products/[id]/edit">) {
  return (
    <Suspense fallback={<Spinner />}>
      <EditProductView params={params} />
    </Suspense>
  );
}
