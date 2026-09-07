import type { OperationalOrder } from "@/lib/types/operationalOrder";

/** Real order surface the werkstatt view reads (route-provided, never fetched here). */
export type WerkstattSurfaceOrder = OperationalOrder;

export type PhillipOrderCard = Pick<
  WerkstattSurfaceOrder,
  | "id"
  | "orderNumber"
  | "customerName"
  | "title"
  | "itemDescription"
  | "surfaceRequested"
  | "station"
  | "status"
  | "statusText"
  | "risk"
  | "dueDate"
  | "dueLabel"
  | "dueValue"
>;

export type WerkstattHeldGroup = "crit" | "soon";

export type WerkstattHeldCard = PhillipOrderCard & { heldGroup: WerkstattHeldGroup };

export type WerkstattBundleSuggestion = {
  surfaceRequested: string;
  orders: readonly PhillipOrderCard[];
};

export type WerkstattData = {
  greetingName: string | null;
  dringendCount: number;
  weitereCount: number;
  held: readonly WerkstattHeldCard[];
  bundleSuggestion: WerkstattBundleSuggestion | null;
  wipCount: number;
  dueThisWeekCount: number;
  pickerOrders: readonly PhillipOrderCard[];
  canCreateOrder: boolean;
};

export type PhillipWerkstattViewModel =
  | ({ kind: "data" } & WerkstattData)
  | { kind: "empty"; canCreateOrder: boolean }
  | { kind: "denied"; message: string }
  | { kind: "conflict"; message: string }
  | { kind: "error"; message: string };
