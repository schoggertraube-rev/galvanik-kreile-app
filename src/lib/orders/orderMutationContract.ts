import { z } from "zod";
import { orderDueDateSchema } from "@/lib/validation/orderSchema";

const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const ORDER_IDENTIFIER = /^[A-Za-z0-9_-]{1,100}$/;

export const ORDER_STATIONS = [
  "wareneingang",
  "entmetallisierung",
  "schleiferei",
  "galvanik",
  "qualitaetssicherung",
  "warenausgang",
] as const;

export const ORDER_STATUSES = [
  "in_progress",
  "ready",
  "blocked",
  "completed",
  "shipped",
  "cancelled",
] as const;

export const ORDER_RISKS = ["green", "yellow", "orange", "red", "blocked"] as const;

export type OrderStation = (typeof ORDER_STATIONS)[number];
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type OrderRisk = (typeof ORDER_RISKS)[number];

const stationSchema = z
  .enum([...ORDER_STATIONS, "beschichtung"])
  .transform((station): OrderStation => station === "beschichtung" ? "galvanik" : station);

const textSchema = (maximum: number) => z
    .string()
    .trim()
    .max(maximum)
    .refine((value) => !CONTROL_CHARACTERS.test(value), "Steuerzeichen sind nicht erlaubt.");

export const orderUpdateSchema = z
  .object({
    status: z.enum(ORDER_STATUSES).optional(),
    currentStationId: stationSchema.optional(),
    risk: z.enum(ORDER_RISKS).optional(),
    title: textSchema(200).min(1).optional(),
    task: textSchema(2_000).nullable().optional(),
    dueDate: orderDueDateSchema.nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "Mindestens eine Änderung ist erforderlich.");

export const processTransitionSchema = z
  .object({
    orderId: z.string().regex(ORDER_IDENTIFIER),
    targetStep: stationSchema.optional(),
    action: z.enum(["start", "complete"]).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (Boolean(value.targetStep) === Boolean(value.action)) {
      context.addIssue({
        code: "custom",
        message: "Genau eine Prozessaktion oder Zielstation ist erforderlich.",
      });
    }
  });

export type OrderUpdateInput = z.input<typeof orderUpdateSchema>;
export type ParsedOrderUpdate = z.output<typeof orderUpdateSchema>;
export type ProcessTransitionInput = z.input<typeof processTransitionSchema>;

export function parseOrderIdentifier(value: unknown): string {
  return z.string().regex(ORDER_IDENTIFIER).parse(value);
}

export function parseOrderStation(value: unknown): OrderStation {
  return stationSchema.parse(value);
}

export function normalizeStoredOrderStatus(value: string): OrderStatus | "unknown" {
  const normalized = value.trim().toLowerCase();
  if (ORDER_STATUSES.includes(normalized as OrderStatus)) return normalized as OrderStatus;
  if (["abgeschlossen", "fertig", "done"].includes(normalized)) return "completed";
  if (["versendet", "delivered"].includes(normalized)) return "shipped";
  if (["storniert", "canceled"].includes(normalized)) return "cancelled";
  if (["qs/fertigprüfung", "bereit für versand"].includes(normalized)) return "ready";
  return "unknown";
}

const ALLOWED_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  in_progress: ["ready", "blocked", "completed", "cancelled"],
  ready: ["in_progress", "blocked", "completed", "shipped", "cancelled"],
  blocked: ["in_progress", "ready", "cancelled"],
  completed: [],
  shipped: [],
  cancelled: [],
};

export function canTransitionOrderStatus(current: OrderStatus, next: OrderStatus): boolean {
  return current === next || ALLOWED_TRANSITIONS[current].includes(next);
}

export function isCompletedOrderStatus(status: OrderStatus): boolean {
  return status === "completed" || status === "shipped";
}

export function isTerminalOrderStatus(status: OrderStatus): boolean {
  return isCompletedOrderStatus(status) || status === "cancelled";
}
