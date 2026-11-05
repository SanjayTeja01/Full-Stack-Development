import { Suspense } from "react";
import { ProductDetail } from "./product-detail";
import { Spinner } from "@/components/ui/feedback";

export default function ProductPage({ params }: PageProps<"/products/[id]">) {
  return (
    <Suspense fallback={<Spinner />}>
      <ProductDetail params={params} />
    </Suspense>
  );
}
