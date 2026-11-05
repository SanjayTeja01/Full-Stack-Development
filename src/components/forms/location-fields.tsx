"use client";

import type { FieldErrors, UseFormRegister, FieldValues, Path } from "react-hook-form";
import { INDIAN_STATES } from "@shared/categories";
import { Field, Input, NativeSelect } from "@/components/ui/input";

type WithLocation = FieldValues & { location: { state: string; district: string; village?: string | null } };

export function LocationFields<T extends WithLocation>({
  register,
  errors,
  prefix = "location",
}: {
  register: UseFormRegister<T>;
  errors: FieldErrors<T>;
  prefix?: string;
}) {
  const locErrors = (errors as FieldErrors<WithLocation>).location;
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Field label="State" htmlFor={`${prefix}-state`} error={locErrors?.state?.message} required>
        <NativeSelect id={`${prefix}-state`} aria-invalid={!!locErrors?.state} {...register("location.state" as Path<T>)}>
          <option value="">Select state</option>
          {INDIAN_STATES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="District" htmlFor={`${prefix}-district`} error={locErrors?.district?.message} required>
        <Input id={`${prefix}-district`} aria-invalid={!!locErrors?.district} {...register("location.district" as Path<T>)} />
      </Field>
      <Field label="Village / town" htmlFor={`${prefix}-village`} error={locErrors?.village?.message}>
        <Input id={`${prefix}-village`} {...register("location.village" as Path<T>)} />
      </Field>
    </div>
  );
}
