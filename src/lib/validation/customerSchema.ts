import { z } from "zod";

const shortText = (max: number) => z.string().trim().max(max);
const optionalEmail = z.union([z.literal(""), z.string().trim().email().max(254)]).optional();
const customerType = z.enum([
  "business",
  "private",
  "privat",
  "institution",
  "Privatkunde",
  "Geschäftskunde",
  "Institution",
  "lead",
]).optional();

export const customerSchema = z.object({
  name: shortText(300).optional(),
  firstName: shortText(150).optional(),
  lastName: shortText(150).optional(),
  company: shortText(300).optional(),
  companyName: shortText(300).optional(),
  type: customerType,
  address: shortText(500).optional(),
  street: shortText(300).optional(),
  houseNumber: shortText(30).optional(),
  postalCode: shortText(20).optional(),
  zipCode: shortText(20).optional(),
  city: shortText(150).optional(),
  country: shortText(100).optional(),
  phone: shortText(50).optional(),
  email: optionalEmail,
  notes: shortText(5_000).optional(),
  behaviorNote: shortText(2_000).optional(),
  source: shortText(80).optional(),
  sourceRef: shortText(200).nullable().optional(),
  isLead: z.boolean().optional(),
  imageUrls: z.array(z.string().url().max(2_048)).max(20).optional(),
}).strict().superRefine((data, ctx) => {
  const company = data.company || data.companyName;
  const person = data.name || [data.firstName, data.lastName].filter(Boolean).join(" ");
  if (!company && !person) {
    ctx.addIssue({
      code: "custom",
      message: "Name oder Firma ist erforderlich.",
      path: ["name"],
    });
  }
  const postalCode = data.postalCode || data.zipCode;
  const country = data.country?.toUpperCase();
  if (postalCode && (country === "DE" || country === "DEUTSCHLAND") && !/^\d{5}$/.test(postalCode)) {
    ctx.addIssue({ code: "custom", message: "Deutsche PLZ muss fünfstellig sein.", path: ["postalCode"] });
  }
  if (postalCode && ["AT", "ÖSTERREICH", "CH", "SCHWEIZ"].includes(country || "") && !/^\d{4}$/.test(postalCode)) {
    ctx.addIssue({ code: "custom", message: "PLZ für Österreich/Schweiz muss vierstellig sein.", path: ["postalCode"] });
  }
});

export const customerUpdateSchema = z.object({
  name: shortText(300).min(1).optional(),
  companyName: shortText(300).nullable().optional(),
  type: customerType,
  address: shortText(500).nullable().optional(),
  street: shortText(300).nullable().optional(),
  city: shortText(150).nullable().optional(),
  zipCode: shortText(20).nullable().optional(),
  country: shortText(100).nullable().optional(),
  contactPerson: shortText(300).nullable().optional(),
  email: z.union([z.literal(""), z.string().trim().email().max(254), z.null()]).optional(),
  phone: shortText(50).nullable().optional(),
  notes: shortText(5_000).nullable().optional(),
  imageUrls: z.array(z.string().url().max(2_048)).max(20).optional(),
  trustLevel: z.enum(["unknown", "stable", "very_reliable", "needs_attention"]).nullable().optional(),
  internalWarning: shortText(2_000).nullable().optional(),
  tags: z.array(shortText(80)).max(50).optional(),
  creditRating: shortText(80).nullable().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "Mindestens eine Änderung ist erforderlich.");

export type CustomerInput = z.infer<typeof customerSchema>;
