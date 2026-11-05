"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Product, ProductImage } from "@shared/types";
import { UNITS, UNIT_IDS, unitShort, type UnitId } from "@shared/units";
import { parseRupeesToPaise, paiseToRupeeString, formatINR } from "@shared/money";
import { PRODUCT_NAME_SUGGESTIONS, QUALITY_GRADES } from "@shared/categories";
import type { CreateProductInput, UpdateProductInput } from "@shared/schemas";
import { useAuth } from "@/components/auth/auth-provider";
import { useCategories } from "@/lib/data/categories";
import { call, errorMessage } from "@/lib/firebase/callable";
import { productFormSchema, type ProductFormValues } from "@/components/forms/form-schemas";
import { LocationFields } from "@/components/forms/location-fields";
import { MoneyInput } from "@/components/forms/money-input";
import { ImageUploader } from "./image-uploader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";

export function ProductForm({ product }: { product?: Product }) {
  const { user, profile } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const { categories } = useCategories();
  const [images, setImages] = React.useState<ProductImage[]>(product?.images ?? []);
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState<"draft" | "publish" | "save" | null>(null);
  const isEdit = !!product;
  const unitLocked = isEdit && (product.reservedQuantity > 0 || product.committedQuantity > 0);

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: product
      ? {
          name: product.name,
          categoryId: product.categoryId,
          description: product.description,
          unit: product.unit,
          price: paiseToRupeeString(product.pricePerUnit),
          availableQuantity: String(product.availableQuantity),
          minOrderQuantity: String(product.minOrderQuantity),
          location: { state: product.location.state as ProductFormValues["location"]["state"], district: product.location.district, village: product.location.village ?? "" },
          qualityGrade: product.qualityGrade ?? "",
          qualityDetails: product.qualityDetails ?? "",
          harvestDate: product.harvestDate ?? "",
        }
      : {
          unit: "quintal",
          availableQuantity: "",
          minOrderQuantity: "1",
          qualityGrade: "",
          qualityDetails: "",
          harvestDate: "",
          location: profile
            ? { state: profile.location.state as ProductFormValues["location"]["state"], district: profile.location.district, village: profile.location.village ?? "" }
            : undefined,
        },
  });
  const { register, handleSubmit, formState, control } = form;
  const unit = useWatch({ control, name: "unit" }) as UnitId;
  const price = useWatch({ control, name: "price" });
  const pricePaise = price ? parseRupeesToPaise(price) : null;

  const submit = (mode: "draft" | "publish" | "save") =>
    handleSubmit(async (v) => {
      setError(null);
      setSubmitting(mode);
      const common = {
        name: v.name,
        categoryId: v.categoryId,
        description: v.description,
        images,
        unit: v.unit as UnitId,
        pricePerUnit: parseRupeesToPaise(v.price)!,
        minOrderQuantity: Number(v.minOrderQuantity),
        location: v.location,
        qualityGrade: v.qualityGrade || null,
        qualityDetails: v.qualityDetails || null,
        harvestDate: v.harvestDate || null,
      };
      try {
        if (isEdit) {
          await call<UpdateProductInput, { ok: true }>("updateProduct", { productId: product.productId, ...common });
          toast.success("Listing updated.");
          router.push("/farmer/products");
        } else {
          const res = await call<CreateProductInput, { productId: string }>("createProduct", {
            ...common,
            availableQuantity: Number(v.availableQuantity),
            publish: mode === "publish",
          });
          toast.success(mode === "publish" ? "Listing published." : "Draft saved.");
          router.push(mode === "publish" ? `/products/${res.productId}` : "/farmer/products");
        }
      } catch (e) {
        setError(errorMessage(e));
      } finally {
        setSubmitting(null);
      }
    })();

  const e = formState.errors;
  return (
    <form onSubmit={(ev) => ev.preventDefault()} className="space-y-6" noValidate>
      {error && <Alert tone="danger">{error}</Alert>}
      <Card>
        <CardHeader>
          <CardTitle>Produce</CardTitle>
          <CardDescription>Describe what you are selling as accurately as you can.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Product name" htmlFor="name" error={e.name?.message} required hint="For example: Maize (hybrid), Guntur red chillies">
              <Input id="name" list="product-suggestions" aria-invalid={!!e.name} {...register("name")} />
              <datalist id="product-suggestions">
                {PRODUCT_NAME_SUGGESTIONS.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </Field>
            <Field label="Category" htmlFor="categoryId" error={e.categoryId?.message} required>
              <NativeSelect id="categoryId" aria-invalid={!!e.categoryId} {...register("categoryId")}>
                <option value="">Choose category</option>
                {categories?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
          <Field label="Description" htmlFor="description" error={e.description?.message} required hint="Variety, moisture, storage, packing, how it can be inspected.">
            <Textarea id="description" rows={4} aria-invalid={!!e.description} {...register("description")} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Quality grade" htmlFor="qualityGrade" error={e.qualityGrade?.message}>
              <NativeSelect id="qualityGrade" {...register("qualityGrade")}>
                <option value="">Not specified</option>
                {QUALITY_GRADES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Harvest date" htmlFor="harvestDate" error={e.harvestDate?.message}>
              <Input id="harvestDate" type="date" {...register("harvestDate")} />
            </Field>
          </div>
          <Field label="Quality details" htmlFor="qualityDetails" error={e.qualityDetails?.message} hint="Optional: moisture %, foreign matter, size, lab reports.">
            <Textarea id="qualityDetails" rows={2} {...register("qualityDetails")} />
          </Field>
          <div>
            <p className="mb-2 text-sm font-medium">Photos</p>
            {user && <ImageUploader farmerId={user.uid} value={images} onChange={setImages} />}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Price and quantity</CardTitle>
          <CardDescription>The asking price is a starting point. Buyers can still make offers.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field
              label="Unit"
              htmlFor="unit"
              error={e.unit?.message}
              required
              hint={unitLocked ? "Locked while stock is reserved or committed." : undefined}
            >
              <NativeSelect id="unit" disabled={unitLocked} {...register("unit")}>
                {UNIT_IDS.map((u) => (
                  <option key={u} value={u}>
                    {UNITS[u].label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label={`Asking price per ${unitShort(unit)}`} htmlFor="price" error={e.price?.message} required>
              <Controller
                control={control}
                name="price"
                render={({ field }) => <MoneyInput id="price" suffix={`/ ${unitShort(unit)}`} aria-invalid={!!e.price} {...field} value={field.value ?? ""} />}
              />
            </Field>
            <Field label="Minimum order" htmlFor="minOrderQuantity" error={e.minOrderQuantity?.message} hint={`In ${UNITS[unit]?.plural ?? unit}`}>
              <Input id="minOrderQuantity" inputMode="numeric" {...register("minOrderQuantity")} />
            </Field>
          </div>
          {!isEdit ? (
            <Field
              label="Available quantity"
              htmlFor="availableQuantity"
              error={e.availableQuantity?.message}
              required
              hint={`Whole ${UNITS[unit]?.plural ?? unit}. You can update stock later.`}
              className="sm:max-w-xs"
            >
              <Input id="availableQuantity" inputMode="numeric" aria-invalid={!!e.availableQuantity} {...register("availableQuantity")} />
            </Field>
          ) : (
            <p className="text-sm text-muted-foreground">Change available stock from your listings page with “Update stock”.</p>
          )}
          {pricePaise && unit !== "quintal" && (
            <p className="text-sm text-muted-foreground tabular">
              Equivalent to {formatINR(Math.round((pricePaise * 100) / UNITS[unit].kgFactor))} per quintal.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Location</CardTitle>
          <CardDescription>Where the produce can be inspected or collected. Shown publicly at district level.</CardDescription>
        </CardHeader>
        <CardContent>
          <LocationFields register={register} errors={formState.errors} prefix="product-location" />
        </CardContent>
      </Card>

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => router.back()} disabled={!!submitting}>
          Cancel
        </Button>
        {isEdit ? (
          <Button type="button" loading={submitting === "save"} disabled={!!submitting} onClick={() => submit("save")}>
            Save changes
          </Button>
        ) : (
          <>
            <Button type="button" variant="secondary" loading={submitting === "draft"} disabled={!!submitting} onClick={() => submit("draft")}>
              Save as draft
            </Button>
            <Button type="button" loading={submitting === "publish"} disabled={!!submitting} onClick={() => submit("publish")}>
              Publish listing
            </Button>
          </>
        )}
      </div>
    </form>
  );
}
