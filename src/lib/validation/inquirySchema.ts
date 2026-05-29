import { z } from "zod";

export const inquirySchema = z.object({
  customerId: z.string().optional().nullable(),
  customerName: z.string().min(2, "Kundenname muss mindestens 2 Zeichen lang sein."),
  subject: z.string().min(1, "Betreff darf nicht leer sein."),
  description: z.string().optional(),
  partCount: z.coerce.number().min(1, "Die Stückzahl muss mindestens 1 betragen."),
  material: z.string().optional(),
  rustLevel: z.string().optional().nullable(),
  dirtLevel: z.string().optional().nullable(),
  status: z.enum(["offen", "angeboten", "archiviert", "angenommen", "abgelehnt"]).optional(),
  photo: z.string().optional().nullable(),
  pricing: z.record(z.string(), z.unknown()).optional().nullable(),
});

export type InquiryInput = z.infer<typeof inquirySchema>;
