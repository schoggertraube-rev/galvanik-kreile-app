import { z } from "zod";

export const customerSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  company: z.string().optional(),
  
  street: z.string().min(1, "Straße darf nicht leer sein."),
  houseNumber: z.string().min(1, "Hausnummer darf nicht leer sein."),
  postalCode: z.string(),
  city: z.string().min(1, "Ort darf nicht leer sein."),
  country: z.string().min(1, "Land darf nicht leer sein."),
  
  phone: z.string().trim().min(4, "Bitte geben Sie eine gültige Telefonnummer ein."),
  email: z.string().email("Bitte geben Sie eine gültige E-Mail-Adresse ein."),
  
  notes: z.string().optional(),
  customerNumber: z.string().optional(),
  imageUrls: z.array(z.string()).optional()
}).superRefine((data, ctx) => {
  if (!data.company && (!data.firstName || !data.lastName)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Entweder Firma oder Vor- und Nachname müssen angegeben werden.",
      path: ["company"]
    });
  }

  const pc = data.postalCode.trim();
  const ctry = data.country.toUpperCase();
  
  if (ctry === "DE" || ctry === "DEUTSCHLAND") {
    if (!/^\d{5}$/.test(pc)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "PLZ in Deutschland muss exakt 5 Ziffern haben.", path: ["postalCode"] });
    }
  } else if (ctry === "CH" || ctry === "SCHWEIZ" || ctry === "AT" || ctry === "ÖSTERREICH") {
    if (!/^\d{4}$/.test(pc)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "PLZ in CH/AT muss exakt 4 Ziffern haben.", path: ["postalCode"] });
    }
  } else {
    if (pc.length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "PLZ darf nicht leer sein.", path: ["postalCode"] });
    }
  }
});

export type CustomerInput = z.infer<typeof customerSchema>;
