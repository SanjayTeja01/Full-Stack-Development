import { PageHeader } from "@/components/layout/app-shell";
import { ProductForm } from "@/components/products/product-form";

export default function NewProductPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Add a listing" description="Publish now, or save a draft to finish later." />
      <ProductForm />
    </div>
  );
}
