import { z } from "zod";

export const customerSchema = z.object({
  name: z.string().min(2, "Der Name muss mindestens 2 Zeichen lang sein."),
  companyName: z.string().optional(),
  type: z.string().optional(),
  address: z.string().optional(),
  zipCode: z.string().optional(),
  city: z.string().optional(),
  phone: z.string().min(6, "Telefonnummer muss mindestens 6 Zeichen lang sein.").optional().or(z.literal('')),
  email: z.string().email("Bitte geben Sie eine gültige E-Mail-Adresse ein.").optional().or(z.literal('')),
  notes: z.string().optional(),
  customerNumber: z.string().optional(),
  imageUrls: z.array(z.string()).optional()
});

export type CustomerInput = z.infer<typeof customerSchema>;
