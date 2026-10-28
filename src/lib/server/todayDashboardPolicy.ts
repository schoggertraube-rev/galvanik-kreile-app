const TERMINAL_ORDER_STATES = new Set(["abgeholt", "versendet", "raus", "storniert", "cancelled", "canceled", "completed", "done", "erledigt"]);

type TodayOrder = {
  dueDate: string;
  risk: string;
  station: string;
  status: string;
};

export type TodayOrderGuidance = {
  field: "action" | "today";
  caseId: "due" | "finished_waiting" | "tight" | "problem" | "ready_today";
  primaryActionLabel: "Fertig melden" | "Ware raus" | "Kunde vorwarnen" | "Problem lösen";
  reason: "due_today" | "overdue" | "finished_overdue" | "tight_schedule" | "reported_risk" | "ready_today";
};

const NOT_STARTED_STATIONS = new Set(["angenommen", "wareneingang", "eingang", "neu"]);

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
