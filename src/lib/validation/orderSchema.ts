import { z } from "zod";

const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const ENTITY_ID = /^[A-Za-z0-9_-]{1,100}$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export const VALID_ORDER_SOURCES = [
  "manual",
  "customer",
  "capture",
  "phone",
  "inquiry",
  "scan",
  "search",
  "order",
  "shortcut",
] as const;

export type OrderSource = (typeof VALID_ORDER_SOURCES)[number];

function requiredText(maximum: number, message: string) {
  return z
    .string()
    .trim()
    .min(1, message)
    .max(maximum, `Maximal ${maximum} Zeichen erlaubt.`)
    .refine((value) => !CONTROL_CHARACTERS.test(value), "Steuerzeichen sind nicht erlaubt.");
}

function optionalText(maximum: number) {
  return z
    .string()
    .trim()
    .max(maximum, `Maximal ${maximum} Zeichen erlaubt.`)
    .refine((value) => !CONTROL_CHARACTERS.test(value), "Steuerzeichen sind nicht erlaubt.")
    .optional()
    .transform((value) => value || undefined);
}

export const orderDueDateSchema = z
  .union([
    z.date(),
    z.string().regex(ISO_DATE, "Datum muss das Format JJJJ-MM-TT haben.").transform((value, context) => {
      const match = ISO_DATE.exec(value);
      if (!match) return z.NEVER;
      const year = Number(match[1]);
      const month = Number(match[2]);
      const day = Number(match[3]);
      const date = new Date(Date.UTC(year, month - 1, day, 12));
      if (
        date.getUTCFullYear() !== year
        || date.getUTCMonth() !== month - 1
        || date.getUTCDate() !== day
      ) {
        context.addIssue({ code: "custom", message: "Datum ist ungültig." });
        return z.NEVER;
      }
      return date;
    }),
  ])
  .refine((date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date.getTime() >= today.getTime();
  }, "Das Fälligkeitsdatum darf nicht in der Vergangenheit liegen.");

export const orderPartSchema = z
  .object({
    name: requiredText(200, "Teilebezeichnung darf nicht leer sein."),
    quantity: z.number().int().min(1).max(1_000_000),
    surfaceRequested: optionalText(100),
    material: optionalText(100),
  })
  .strict();

export const orderSchema = z
  .object({
    customerId: z.string().regex(ENTITY_ID, "Ungültige Kunden-ID."),
    title: requiredText(200, "Auftragstitel darf nicht leer sein."),
    task: optionalText(2_000),
    source: z.enum(VALID_ORDER_SOURCES, {
      message: "Quelle ist ein Pflichtfeld oder ungültig.",
    }),
    sourceRef: optionalText(200),
    dueDate: orderDueDateSchema.optional(),
    isQuote: z.boolean().optional().default(false),
    calendarSync: z.boolean().optional().default(false),
    timeWindow: z.enum(["ganztaegig", "vormittags", "nachmittags", "spaet"]).optional(),
    freetextOriginal: optionalText(4_000),
    customerBehaviorNote: optionalText(2_000),
    parts: z.array(orderPartSchema).min(1, "Es muss mindestens ein Bauteil angegeben werden.").max(500),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.calendarSync && !value.dueDate) {
      context.addIssue({
        code: "custom",
        path: ["dueDate"],
        message: "Für einen Kalendereintrag ist ein Fälligkeitsdatum erforderlich.",
      });
    }
  });

export type OrderInput = z.infer<typeof orderSchema>;

export const scanOrderRequestSchema = z
  .object({
    customerId: z.string().regex(ENTITY_ID, "Ungültige Kunden-ID.").optional(),
    customerName: optionalText(200),
    title: requiredText(200, "Auftragstitel darf nicht leer sein."),
    parts: z.array(orderPartSchema).min(1).max(500),
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.customerId && !value.customerName) {
      context.addIssue({
        code: "custom",
        path: ["customerId"],
        message: "Kunden-ID oder Kundenname ist erforderlich.",
      });
    }
  });

export type ScanOrderRequest = z.infer<typeof scanOrderRequestSchema>;
