import { z } from "zod";
import { orderDueDateSchema } from "@/lib/validation/orderSchema";
import type { PermissionKey } from "@/lib/auth/authorizationContract";

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

export const ORDER_STATION_LABELS: Record<OrderStation, string> = {
  wareneingang: "Wareneingang",
  entmetallisierung: "Entmetallisierung",
  schleiferei: "Schleiferei",
  galvanik: "Galvanik",
  qualitaetssicherung: "Qualitätssicherung",
  warenausgang: "Warenausgang",
};

const ALLOWED_STATION_TRANSITIONS: Record<OrderStation, readonly OrderStation[]> = {
  wareneingang: ["entmetallisierung", "schleiferei", "galvanik"],
  entmetallisierung: ["schleiferei", "galvanik"],
  schleiferei: ["galvanik"],
  galvanik: ["qualitaetssicherung"],
  qualitaetssicherung: ["warenausgang"],
  warenausgang: [],
};

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
    clientRequestId: z.string().uuid(),
    expectedStation: stationSchema,
    action: z.enum(["start", "cancel"]),
  })
  .strict();

export type OrderUpdateInput = z.input<typeof orderUpdateSchema>;
export type ParsedOrderUpdate = z.output<typeof orderUpdateSchema>;
export type ProcessTransitionInput = z.input<typeof processTransitionSchema>;
export type ParsedProcessTransition = z.output<typeof processTransitionSchema>;
export type ProcessTransitionConflict =
  | "STALE_ORDER_STATION"
  | "ORDER_NOT_READY"
  | "ORDER_NOT_IN_PROGRESS";

export function requiredPermissionsForOrderUpdate(
  update: ParsedOrderUpdate,
): readonly PermissionKey[] {
  const permissions: PermissionKey[] = [];
  if (update.title !== undefined || update.task !== undefined || "dueDate" in update) {
    permissions.push("perm_data_orders");
  }
  if (update.risk !== undefined) permissions.push("perm_op_risk");
  return permissions;
}

export function getProcessTransitionConflict(
  currentStatus: OrderStatus,
  currentStation: OrderStation,
  intent: ParsedProcessTransition,
): ProcessTransitionConflict | null {
  if (intent.expectedStation !== currentStation) return "STALE_ORDER_STATION";
  if (intent.action === "start") {
    return currentStatus === "ready" ? null : "ORDER_NOT_READY";
  }
  return null;
}

export function getStateAfterStationCompletion(currentStation: OrderStation): {
  station: OrderStation;
  status: "ready" | "shipped";
  eventType: "STATION_COMPLETED" | "SHIPMENT_SENT";
} {
  const currentIndex = ORDER_STATIONS.indexOf(currentStation);
  if (currentIndex === ORDER_STATIONS.length - 1) {
    return { station: currentStation, status: "shipped", eventType: "SHIPMENT_SENT" };
  }
  return {
    station: ORDER_STATIONS[currentIndex + 1],
    status: "ready",
    eventType: "STATION_COMPLETED",
  };
}

export function parseOrderIdentifier(value: unknown): string {
  return z.string().regex(ORDER_IDENTIFIER).parse(value);
}

export function parseOrderStation(value: unknown): OrderStation {
  return stationSchema.parse(value);
}

export function getOrderStationLabel(value: unknown): string {
  return ORDER_STATION_LABELS[parseOrderStation(value)];
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
  in_progress: ["ready", "blocked", "completed", "shipped", "cancelled"],
  ready: ["in_progress", "blocked", "completed", "shipped", "cancelled"],
  blocked: ["in_progress", "ready", "cancelled"],
  completed: [],
  shipped: [],
  cancelled: [],
};

export function canTransitionOrderStatus(current: OrderStatus, next: OrderStatus): boolean {
  return current === next || ALLOWED_TRANSITIONS[current].includes(next);
}

export function canTransitionOrderStation(current: OrderStation, next: OrderStation): boolean {
  return current === next || ALLOWED_STATION_TRANSITIONS[current].includes(next);
}

export function isCompletedOrderStatus(status: OrderStatus): boolean {
  return status === "completed" || status === "shipped";
}

export function isTerminalOrderStatus(status: OrderStatus): boolean {
  return isCompletedOrderStatus(status) || status === "cancelled";
}
