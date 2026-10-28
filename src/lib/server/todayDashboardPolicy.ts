const TERMINAL_ORDER_STATES = new Set(["abgeholt", "versendet", "raus", "storniert", "cancelled", "canceled", "completed", "done", "erledigt"]);

type TodayOrder = {
  dueDate: string;
  risk: string;
  station: string;
  status: string;
};

export function classifyOrderForToday(order: TodayOrder, today: string): "action" | "today" | null {
  const station = order.station.trim().toLowerCase();
  const status = order.status.trim().toLowerCase();
  if (TERMINAL_ORDER_STATES.has(station) || TERMINAL_ORDER_STATES.has(status)) return null;

  const dueDate = order.dueDate.slice(0, 10);
  const dueToday = dueDate === today;
  const overdue = Boolean(dueDate) && dueDate < today;
  const finished = station === "fertig" || status === "fertig";
  const risky = ["red", "blocked", "orange", "yellow"].includes(order.risk);
  const needsAction = risky || overdue || (dueToday && !finished);

  if (needsAction) return "action";
  return dueToday && finished ? "today" : null;
}
