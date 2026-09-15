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

function toSurface(order: WarendurchlaufOrder): WerkstattSurfaceOrder {
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

function hasDuplicateIdentity(orders: readonly WarendurchlaufOrder[]): boolean {
  const ids = new Set<string>();
  const numbers = new Set<string>();
  return orders.some((order) => {
    const duplicate = ids.has(order.id) || numbers.has(order.orderNumber);
    ids.add(order.id);
    numbers.add(order.orderNumber);
    return duplicate;
  });
}

export async function loadWerkstattHome(
  authorization: AuthorizationSnapshot,
): Promise<PhillipWerkstattViewModel> {
  if (authorization.role !== "werkstatt") {
    return { kind: "denied", message: "Diese Rollen-Startseite ist nicht freigegeben." };
  }
  if (!authorization.permissions.includes("perm_view_leitstand")) {
    return { kind: "denied", message: "Werkstattdaten sind für diese Rolle nicht freigegeben." };
  }

  try {
    const [incoming, production, kpis] = await Promise.all([
      getWareneingangOrdersAction(),
      getGalvanikOrdersAction(),
      getWarendurchlaufKPIs(),
    ]);
    if (!incoming.ok || !production.ok || !kpis.ok) {
      const denied = [incoming, production, kpis].some(
        (result) => !result.ok && (result.error === "AUTH_ERROR" || result.error === "FORBIDDEN"),
      );
      return denied
        ? { kind: "denied", message: "Werkstattdaten sind für diese Rolle nicht freigegeben." }
        : { kind: "error", message: "Werkstattdaten konnten nicht sicher geladen werden." };
    }

    const orders = [...incoming.data, ...production.data];
    if (hasDuplicateIdentity(orders)) {
      return { kind: "conflict", message: "Auftragskennungen sind nicht eindeutig. Bitte neu laden." };
    }

    if (orders.length === 0) {
      return { kind: "empty", canCreateOrder: true };
    }

    return {
      kind: "data",
      ...buildWerkstattData({
        wareneingang: incoming.data.map(toSurface),
        galvanik: production.data.map(toSurface),
        greetingName: authorization.displayName,
        canCreateOrder: true,
        kpis: kpis.data,
      }),
    };
  } catch {
    return { kind: "error", message: "Werkstattdaten konnten nicht sicher geladen werden." };
  }
}

export async function WerkstattHome({ authorization }: { authorization: AuthorizationSnapshot }) {
  return <WerkstattAppAdapter view={await loadWerkstattHome(authorization)} />;
}
