import type { AuthorizationSnapshot } from "@/lib/server/authorization";
import {
  buildWerkstattData,
  type PhillipWerkstattViewModel,
  type WerkstattSurfaceOrder,
} from "@/modules/werkstatt/public";
import {
  getGalvanikOrdersAction,
  getWarendurchlaufKPIs,
  getWareneingangOrdersAction,
  type WarendurchlaufOrder,
} from "@/app/warendurchlauf/actions";
import { WerkstattAppAdapter } from "@/app/warendurchlauf/WerkstattAppAdapter";

function surface(order: WarendurchlaufOrder): WerkstattSurfaceOrder {
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

function duplicate(orders: readonly WarendurchlaufOrder[]) {
  const ids = new Set<string>();
  const numbers = new Set<string>();
  return orders.some((order) => {
    const conflict = ids.has(order.id) || numbers.has(order.orderNumber);
    ids.add(order.id);
    numbers.add(order.orderNumber);
    return conflict;
  });
}

export async function loadWerkstattView(
  authorization: AuthorizationSnapshot,
): Promise<PhillipWerkstattViewModel> {
  if (!authorization.permissions.includes("perm_view_leitstand")) {
    return { kind: "denied", message: "Zugriff nicht erlaubt." };
  }
  try {
    const [incoming, production, kpis] = await Promise.all([
      getWareneingangOrdersAction(),
      getGalvanikOrdersAction(),
      getWarendurchlaufKPIs(),
    ]);
    if (!incoming.ok || !production.ok || !kpis.ok) {
      const denied = [incoming, production, kpis].some(
        (result) => !result.ok && ["AUTH_ERROR", "FORBIDDEN"].includes(result.error),
      );
      return {
        kind: denied ? "denied" : "error",
        message: denied ? "Zugriff nicht erlaubt." : "Werkstattdaten konnten nicht sicher geladen werden.",
      };
    }
    const orders = [...incoming.data, ...production.data];
    if (duplicate(orders)) {
      return { kind: "conflict", message: "Werkstattdaten enthalten widersprüchliche Auftragskennungen." };
    }
    const canCreateOrder = authorization.permissions.includes("perm_data_orders");
    const canOperate = authorization.role !== "readonly";
    if (orders.length === 0) return { kind: "empty", canCreateOrder, canOperate };
    return {
      kind: "data",
      ...buildWerkstattData({
        wareneingang: incoming.data.map(surface),
        galvanik: production.data.map(surface),
        canCreateOrder,
        canOperate,
        greetingName: authorization.displayName,
        kpis: kpis.data,
      }),
    };
  } catch {
    return { kind: "error", message: "Werkstattdaten konnten nicht sicher geladen werden." };
  }
}

export async function WerkstattHome({ authorization }: { authorization: AuthorizationSnapshot }) {
  return <WerkstattAppAdapter view={await loadWerkstattView(authorization)} />;
}
