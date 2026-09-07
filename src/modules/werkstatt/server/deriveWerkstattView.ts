import type {
  PhillipOrderCard,
  WerkstattBundleSuggestion,
  WerkstattData,
  WerkstattHeldCard,
  WerkstattHeldGroup,
  WerkstattSurfaceOrder,
} from "./types";

function toPhillipOrderCard(order: WerkstattSurfaceOrder): PhillipOrderCard {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    title: order.title,
    itemDescription: order.itemDescription,
    surfaceRequested: order.surfaceRequested,
    station: order.station,
    status: order.status,
    statusText: order.statusText,
    risk: order.risk,
    dueDate: order.dueDate,
    dueLabel: order.dueLabel,
    dueValue: order.dueValue,
  };
}

function classifyHeldGroup(risk: string): WerkstattHeldGroup | null {
  if (risk === "red" || risk === "orange" || risk === "blocked") return "crit";
  if (risk === "yellow") return "soon";
  return null;
}

function heldGroupWeight(group: WerkstattHeldGroup): number {
  return group === "crit" ? 0 : 1;
}

type BerlinCalendarDay = {
  year: number;
  month: number;
  day: number;
};

const BERLIN_TIME_ZONE = "Europe/Berlin";
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const BERLIN_DATE_FORMAT = new Intl.DateTimeFormat("en-CA", {
  timeZone: BERLIN_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function validatedCalendarDay(year: number, month: number, day: number): BerlinCalendarDay | null {
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

function berlinCalendarDay(date: Date): BerlinCalendarDay | null {
  if (Number.isNaN(date.getTime())) return null;
  const parts = BERLIN_DATE_FORMAT.formatToParts(date);
  const value = (type: "year" | "month" | "day") =>
    Number(parts.find((part) => part.type === type)?.value);
  return validatedCalendarDay(value("year"), value("month"), value("day"));
}

function parseDueCalendarDay(dueDate: string): BerlinCalendarDay | null {
  const trimmed = dueDate.trim();
  if (!trimmed) return null;
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (dateOnly) {
    return validatedCalendarDay(Number(dateOnly[1]), Number(dateOnly[2]), Number(dateOnly[3]));
  }

  // A timestamp without an explicit offset would reintroduce a runtime-timezone dependency.
  if (!/(?:Z|[+-]\d{2}:\d{2})$/i.test(trimmed)) return null;
  return berlinCalendarDay(new Date(trimmed));
}

function calendarOrdinal(day: BerlinCalendarDay): number {
  return Date.UTC(day.year, day.month - 1, day.day);
}

/** Calendar week ending Sunday in Europe/Berlin, never a runtime-local rolling window. */
function isDueThisWeek(dueDate: string, now: Date): boolean {
  const dueDay = parseDueCalendarDay(dueDate);
  const today = berlinCalendarDay(now);
  if (!dueDay || !today) return false;

  const dueOrdinal = calendarOrdinal(dueDay);
  const todayOrdinal = calendarOrdinal(today);
  if (dueOrdinal < todayOrdinal) return false;
  const weekday = new Date(todayOrdinal).getUTCDay();
  const daysUntilSunday = weekday === 0 ? 0 : 7 - weekday;
  return dueOrdinal <= todayOrdinal + daysUntilSunday * DAY_IN_MS;
}

function buildBundleSuggestion(orders: readonly WerkstattHeldCard[]): WerkstattBundleSuggestion | null {
  const groups = new Map<string, WerkstattHeldCard[]>();
  for (const order of orders) {
    const surface = order.surfaceRequested?.trim();
    if (!surface) continue;
    const group = groups.get(surface) ?? [];
    group.push(order);
    groups.set(surface, group);
  }

  let best: WerkstattBundleSuggestion | null = null;
  for (const [surfaceRequested, group] of groups) {
    if (group.length < 2) continue;
    if (!best || group.length > best.orders.length) {
      best = { surfaceRequested, orders: group };
    }
  }
  return best;
}

export function buildWerkstattData(
  input: {
    wareneingang: readonly WerkstattSurfaceOrder[];
    galvanik: readonly WerkstattSurfaceOrder[];
    canCreateOrder: boolean;
    greetingName: string | null;
  },
  now: Date = new Date(),
): WerkstattData {
  const wareneingang = input.wareneingang.map(toPhillipOrderCard);
  const galvanik = input.galvanik.map(toPhillipOrderCard);
  const combined = [...galvanik, ...wareneingang];

  const held: WerkstattHeldCard[] = combined
    .map((order) => {
      const heldGroup = classifyHeldGroup(order.risk);
      return heldGroup ? { ...order, heldGroup } : null;
    })
    .filter((entry): entry is WerkstattHeldCard => entry !== null)
    .sort((a, b) => {
      const weightDiff = heldGroupWeight(a.heldGroup) - heldGroupWeight(b.heldGroup);
      if (weightDiff !== 0) return weightDiff;
      const parsedDueA = parseDueCalendarDay(a.dueDate);
      const parsedDueB = parseDueCalendarDay(b.dueDate);
      const dueA = parsedDueA ? calendarOrdinal(parsedDueA) : Number.POSITIVE_INFINITY;
      const dueB = parsedDueB ? calendarOrdinal(parsedDueB) : Number.POSITIVE_INFINITY;
      return dueA - dueB;
    });

  return {
    greetingName: input.greetingName,
    dringendCount: held.filter((order) => order.heldGroup === "crit").length,
    weitereCount: held.filter((order) => order.heldGroup === "soon").length,
    held,
    bundleSuggestion: buildBundleSuggestion(held),
    wipCount: galvanik.length,
    dueThisWeekCount: combined.filter((order) => isDueThisWeek(order.dueDate, now)).length,
    pickerOrders: combined,
    canCreateOrder: input.canCreateOrder,
  };
}
