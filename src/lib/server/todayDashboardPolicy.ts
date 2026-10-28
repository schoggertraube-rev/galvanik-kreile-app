import type { AppRole } from "@/lib/auth/authorizationContract";

const TERMINAL_ORDER_STATES = new Set(["abgeholt", "versendet", "raus", "storniert", "cancelled", "canceled", "completed", "done", "erledigt"]);

export type TodayLayoutField = "action" | "today" | "assign" | "money" | "bundle";
export type TodayLayoutColumn = "left" | "right";
export type TodayLayoutItem = { field: TodayLayoutField; column: TodayLayoutColumn; order: number };

const TODAY_LAYOUT_FIELDS = new Set<TodayLayoutField>(["action", "today", "assign", "money", "bundle"]);
const TODAY_LAYOUT_COLUMNS = new Set<TodayLayoutColumn>(["left", "right"]);

const TEMPLATE_LAYOUTS: Record<"meister" | "werkstatt" | "developer" | "leer", Array<Omit<TodayLayoutItem, "order">>> = {
  meister: [
    { field: "action", column: "left" },
    { field: "assign", column: "left" },
    { field: "today", column: "right" },
    { field: "money", column: "right" },
  ],
  werkstatt: [
    { field: "action", column: "left" },
    { field: "bundle", column: "left" },
    { field: "today", column: "right" },
  ],
  developer: [{ field: "action", column: "left" }],
  leer: [{ field: "action", column: "left" }],
};

export function parseTodayLayout(value: unknown): TodayLayoutItem[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > TODAY_LAYOUT_FIELDS.size) return null;
  const parsed: TodayLayoutItem[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item) || Object.keys(item).length !== 3) return null;
    const { field, column, order } = item as Record<string, unknown>;
    if (typeof field !== "string" || !TODAY_LAYOUT_FIELDS.has(field as TodayLayoutField)
      || typeof column !== "string" || !TODAY_LAYOUT_COLUMNS.has(column as TodayLayoutColumn)
      || typeof order !== "number" || !Number.isSafeInteger(order) || order < 0 || order >= value.length) return null;
    parsed.push({ field: field as TodayLayoutField, column: column as TodayLayoutColumn, order });
  }
  parsed.sort((a, b) => a.order - b.order);
  if (new Set(parsed.map((item) => item.field)).size !== parsed.length
    || new Set(parsed.map((item) => item.order)).size !== parsed.length
    || parsed.some((item, index) => item.order !== index)
    || parsed[0]?.field !== "action") return null;
  return parsed;
}

export function filterTodayLayout(layout: TodayLayoutItem[], allowed: ReadonlySet<TodayLayoutField>): TodayLayoutItem[] {
  return layout.filter((item) => item.field === "action" || allowed.has(item.field)).map((item, order) => ({ ...item, order }));
}

export function defaultTodayLayout(role: AppRole, allowed: ReadonlySet<TodayLayoutField>): TodayLayoutItem[] {
  const template = role === "meister" || role === "buero" || role === "admin"
    ? TEMPLATE_LAYOUTS.meister
    : role === "werkstatt"
      ? TEMPLATE_LAYOUTS.werkstatt
      : role === "developer"
        ? TEMPLATE_LAYOUTS.developer
        : TEMPLATE_LAYOUTS.leer;
  return filterTodayLayout(template.map((item, order) => ({ ...item, order })), allowed);
}

type TodayOrder = {
  dueDate: string;
  risk: string;
  station: string;
  status: string;
};

type TodayMoneyCandidate = {
  customerCountry: string | null;
  dueDate: string | null;
  goodsOutRecorded: boolean;
  paymentMode: string;
  paymentStatus: string | null;
  station: string;
};

export type TodayMoneyCase = "overdue_invoice" | "open_prepayment";

export type TodayOrderGuidance = {
  field: "action" | "today";
  caseId: "due" | "finished_waiting" | "tight" | "problem" | "ready_today";
  primaryActionLabel: "Fertig melden" | "Ware raus" | "Kunde vorwarnen" | "Problem lösen";
  reason: "due_today" | "overdue" | "finished_overdue" | "tight_schedule" | "reported_risk" | "ready_today";
};

const NOT_STARTED_STATIONS = new Set(["angenommen", "wareneingang", "eingang", "neu"]);
const BUNDLE_STATIONS = new Set(["angenommen", "wareneingang", "eingang", "galvanik"]);

export function isBundleStationForToday(station: string): boolean {
  return BUNDLE_STATIONS.has(station.trim().toLowerCase());
}

export function deriveOrderGuidance(order: TodayOrder, today: string): TodayOrderGuidance | null {
  const station = order.station.trim().toLowerCase();
  const status = order.status.trim().toLowerCase();
  if (TERMINAL_ORDER_STATES.has(station) || TERMINAL_ORDER_STATES.has(status)) return null;

  const dueDate = order.dueDate.slice(0, 10);
  const dueToday = dueDate === today;
  const overdue = Boolean(dueDate) && dueDate < today;
  const finished = station === "fertig" || status === "fertig";
  const risky = ["red", "blocked", "orange", "yellow"].includes(order.risk.trim().toLowerCase());

  if (overdue && finished) {
    return { field: "action", caseId: "finished_waiting", primaryActionLabel: "Ware raus", reason: "finished_overdue" };
  }
  if (overdue || (dueToday && !finished)) {
    return { field: "action", caseId: "due", primaryActionLabel: "Fertig melden", reason: overdue ? "overdue" : "due_today" };
  }
  if (risky && NOT_STARTED_STATIONS.has(station)) {
    return { field: "action", caseId: "tight", primaryActionLabel: "Kunde vorwarnen", reason: "tight_schedule" };
  }
  if (risky) {
    return { field: "action", caseId: "problem", primaryActionLabel: "Problem lösen", reason: "reported_risk" };
  }
  if (dueToday && finished) {
    return { field: "today", caseId: "ready_today", primaryActionLabel: "Ware raus", reason: "ready_today" };
  }
  return null;
}

export function classifyOrderForToday(order: TodayOrder, today: string): "action" | "today" | null {
  return deriveOrderGuidance(order, today)?.field ?? null;
}

export function classifyMoneyForToday(candidate: TodayMoneyCandidate, today: string): TodayMoneyCase | null {
  const country = candidate.customerCountry?.trim().toLowerCase() ?? "";
  const foreignCustomer = country !== "" && country !== "de" && country !== "deutschland";
  if (candidate.goodsOutRecorded) return null;

  const paymentMode = candidate.paymentMode.trim().toLowerCase();
  const paymentStatus = candidate.paymentStatus?.trim().toLowerCase() ?? null;
  const station = candidate.station.trim().toLowerCase();
  if (paymentMode === "vorkasse") {
    return !foreignCustomer && station === "fertig" && paymentStatus !== "bezahlt" ? "open_prepayment" : null;
  }

  const dueDate = candidate.dueDate?.slice(0, 10) ?? "";
  return dueDate !== "" && dueDate < today && (paymentStatus === "offen" || paymentStatus === "teilbezahlt")
    ? "overdue_invoice"
    : null;
}
