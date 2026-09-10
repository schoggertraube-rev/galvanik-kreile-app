export type OrdersListItem = {
  id: string;
  orderNumber: string;
  customerName: string;
  title: string;
  station: string;
  status: string;
  dueAt: string | null;
  material: string | null;
  surface: string | null;
};

export type OrdersViewState =
  | { kind: "loading" }
  | { kind: "denied"; message: string }
  | { kind: "error"; message: string }
  | { kind: "conflict"; message: string }
  | { kind: "data"; orders: OrdersListItem[] };

export type OrderCardItem = {
  id: string;
  position: number;
  name: string;
  quantity: number;
  material: string | null;
  surface: string;
};

export type OrderCardModel = {
  id: string;
  version: number;
  orderNumber: string;
  customerId: string;
  customerName: string;
  title: string;
  note: string | null;
  station: string;
  status: string;
  dueAt: string | null;
  intakeAt: string;
  items: OrderCardItem[];
  frozenAt: string | null;
  totalAmountCents: number | null;
};

export type OrderCardState =
  | { kind: "loading" }
  | { kind: "denied"; message: string }
  | { kind: "not-found"; message: string }
  | { kind: "error"; message: string }
  | { kind: "conflict"; message: string }
  | { kind: "data"; card: OrderCardModel };
