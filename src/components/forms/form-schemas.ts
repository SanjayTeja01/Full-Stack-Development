import { z } from "zod";
import { parseRupeesToPaise } from "@shared/money";
import { locationSchema } from "@shared/schemas";
import { UNIT_IDS } from "@shared/units";

/** Form-level schemas: prices are typed in rupees and converted to paise before calling the server. */
export const rupees = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `Enter the ${label}`)
    .refine((v) => {
      const p = parseRupeesToPaise(v);
      return p !== null && p > 0;
    }, "Enter an amount in rupees, with up to 2 decimal places");

export const optionalRupees = z
  .string()
  .trim()
  .refine((v) => v === "" || (parseRupeesToPaise(v) ?? 0) > 0, "Enter an amount in rupees, with up to 2 decimal places");

export const wholeNumber = (label: string, min = 1) =>
  z
    .string()
    .trim()
    .regex(/^\d+$/, `${label} must be a whole number`)
    .refine((v) => Number(v) >= min && Number(v) <= 10_000_000, `${label} must be at least ${min}`);

export const productFormSchema = z.object({
  name: z.string().trim().min(2, "Enter the product name").max(80),
  categoryId: z.string().min(1, "Choose a category"),
  description: z.string().trim().min(10, "Describe the produce in at least 10 characters").max(2000),
  unit: z.enum(UNIT_IDS as [string, ...string[]]),
  price: rupees("asking price"),
  availableQuantity: wholeNumber("Available quantity", 0),
  minOrderQuantity: wholeNumber("Minimum order", 1),
  location: locationSchema,
  qualityGrade: z.string().max(60),
  qualityDetails: z.string().max(500),
  harvestDate: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, "Use a valid date"),
});
export type ProductFormValues = z.input<typeof productFormSchema>;
