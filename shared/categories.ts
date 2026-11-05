import type { Category } from "./types";

/**
 * Initial categories. These are written to the `categories` collection by the seed step and are
 * then managed by administrators; the app always reads categories from Firestore.
 */
export const DEFAULT_CATEGORIES: Category[] = [
  { id: "cereals", name: "Cereals", examples: ["Paddy", "Rice", "Maize", "Jowar", "Bajra", "Wheat", "Ragi"], sortOrder: 1, active: true },
  { id: "pulses", name: "Pulses", examples: ["Green gram", "Black gram", "Chickpeas", "Red gram", "Horse gram"], sortOrder: 2, active: true },
  { id: "spices", name: "Spices", examples: ["Red chillies", "Turmeric", "Coriander", "Cumin", "Pepper"], sortOrder: 3, active: true },
  { id: "oilseeds", name: "Oilseeds", examples: ["Groundnuts", "Sunflower", "Sesame", "Mustard", "Soybean"], sortOrder: 4, active: true },
  { id: "fruits", name: "Fruits", examples: ["Mango", "Banana", "Pomegranate", "Guava"], sortOrder: 5, active: true },
  { id: "vegetables", name: "Vegetables", examples: ["Onion", "Tomato", "Potato", "Brinjal"], sortOrder: 6, active: true },
  { id: "other", name: "Other produce", examples: ["Cotton", "Sugarcane", "Jaggery"], sortOrder: 7, active: true },
];

export const PRODUCT_NAME_SUGGESTIONS = DEFAULT_CATEGORIES.flatMap((c) => c.examples);

export const QUALITY_GRADES = ["Grade A", "Grade B", "Grade C", "FAQ (Fair Average Quality)", "Organic certified", "Ungraded"] as const;

export const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana",
  "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
  "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana",
  "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands", "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry",
] as const;
