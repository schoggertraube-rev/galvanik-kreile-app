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

function parseDueDate(dueDate: string): Date | null {
  const trimmed = dueDate.trim();
  if (!trimmed) return null;
  const isoDateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (isoDateOnly) {
    const [, year, month, day] = isoDateOnly;
    const local = new Date(Number(year), Number(month) - 1, Number(day));
    return Number.isNaN(local.getTime()) ? null : local;
  }
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Calendar week ending the local Sunday, not a rolling 7-day window. */
function isDueThisWeek(dueDate: string, now: Date): boolean {
  const parsed = parseDueDate(dueDate);
  if (!parsed) return false;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDay = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  if (dueDay.getTime() < today.getTime()) return false;
  const daysUntilSunday = today.getDay() === 0 ? 0 : 7 - today.getDay();
  const endOfWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() + daysUntilSunday);
  return dueDay.getTime() <= endOfWeek.getTime();
}

function buildBundleSuggestion(orders: readonly PhillipOrderCard[]): WerkstattBundleSuggestion | null {
  const groups = new Map<string, PhillipOrderCard[]>();
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
      const dueA = parseDueDate(a.dueDate)?.getTime() ?? Number.POSITIVE_INFINITY;
      const dueB = parseDueDate(b.dueDate)?.getTime() ?? Number.POSITIVE_INFINITY;
      return dueA - dueB;
    });

  return {
    greetingName: input.greetingName,
    dringendCount: held.filter((order) => order.heldGroup === "crit").length,
    weitereCount: held.filter((order) => order.heldGroup === "soon").length,
    held,
    bundleSuggestion: buildBundleSuggestion(combined),
    wipCount: galvanik.length,
    dueThisWeekCount: combined.filter((order) => isDueThisWeek(order.dueDate, now)).length,
    pickerOrders: combined,
    canCreateOrder: input.canCreateOrder,
  };
}
