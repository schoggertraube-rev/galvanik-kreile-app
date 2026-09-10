/** Minimal real order surface injected by the route composition root. */
export type WerkstattSurfaceOrder = {
  id: string;
  orderNumber: string;
  customerName: string | null;
  title: string;
  itemDescription: string | null;
  surfaceRequested: string | null;
  station: string;
  status: string;
  statusText: string;
  risk: string;
  dueDate: string;
  dueLabel: string;
  dueValue: string;
};

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
  orders: readonly WerkstattHeldCard[];
};

/** Tenant-bound KPI snapshot supplied by the canonical SQL read model. */
export type WerkstattKpiSnapshot = {
  wipCount: number;
  dueThisWeekCount: number;
};

/** App-owned interactions injected into the reusable Werkstatt UI. */
export type WerkstattViewPorts = {
  onOpenOrder: (orderId: string) => void;
  onOpenGoodsOut: (orderId: string) => void;
  onOpenWip: () => void;
  onScanOrder: () => void;
  onCreateOrder: () => void;
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
  goodsOutCandidates: readonly PhillipOrderCard[];
  canCreateOrder: boolean;
};

export type PhillipWerkstattViewModel =
  | ({ kind: "data" } & WerkstattData)
  | { kind: "empty"; canCreateOrder: boolean }
  | { kind: "denied"; message: string }
  | { kind: "conflict"; message: string }
  | { kind: "error"; message: string };
