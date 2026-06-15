import { z } from "zod";

export const VALID_ORDER_SOURCES = [
  "manual",
  "customer",
  "capture",
  "integration-test",
  "seed",
  "demo"
] as const;

export type OrderSource = typeof VALID_ORDER_SOURCES[number];

export const orderSchema = z.object({
  customerId: z.string().optional(),
  customerName: z.string().optional(),
  title: z.string().optional(),
  currentStationId: z.string().optional(),
  source: z.enum(VALID_ORDER_SOURCES, {
    message: "Source ist ein Pflichtfeld oder ungültig"
  }),
  dueDate: z.coerce.date().refine((date) => date > new Date(), {
    message: "Das Fälligkeitsdatum muss in der Zukunft liegen.",
  }).optional(),
  parts: z.array(z.object({
    id: z.string().optional(),
    name: z.string().min(1, "Teilebezeichnung darf nicht leer sein."),
    quantity: z.coerce.number().min(1, "Menge muss mindestens 1 sein."),
    surfaceRequested: z.string().optional(),
    material: z.string().optional()
  })).min(1, "Es muss mindestens ein Bauteil angegeben werden."),
});

export type OrderInput = z.infer<typeof orderSchema>;
