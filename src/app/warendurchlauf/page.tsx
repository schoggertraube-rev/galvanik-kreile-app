import { isOrderStationForwardRole } from "@/lib/orders/orderLifecycleContract";
import { resolveAuthorization } from "@/lib/server/authorization";
import {
  buildWerkstattData,
  WerkstattView,
  type PhillipWerkstattViewModel,
} from "@/modules/werkstatt/public";
import {
  getGalvanikOrdersAction,
  getWareneingangOrdersAction,
  type WarendurchlaufOrder,
} from "@/app/warendurchlauf/actions";

const DENIAL_MESSAGE = "Zugriff nicht erlaubt.";
const ERROR_MESSAGE = "Werkstattdaten konnten nicht sicher geladen werden.";
const CONFLICT_MESSAGE = "Werkstattdaten enthalten widersprüchliche Auftragskennungen.";

function render(view: PhillipWerkstattViewModel) {
  return <WerkstattView view={view} />;
}

function hasDuplicateCanonicalOrder(orders: readonly WarendurchlaufOrder[]) {
  const ids = new Set<string>();
  const orderNumbers = new Set<string>();

  for (const order of orders) {
    if (ids.has(order.id) || orderNumbers.has(order.orderNumber)) return true;
    ids.add(order.id);
    orderNumbers.add(order.orderNumber);
  }

  return false;
}

export default async function WarendurchlaufIndex() {
  let authorization;
  try {
    authorization = await resolveAuthorization();
  } catch {
    return render({ kind: "error", message: ERROR_MESSAGE });
  }

  if (!authorization.ok) {
    return render({
      kind: authorization.reason === "AUTHORIZATION_UNAVAILABLE" ? "error" : "denied",
      message: authorization.reason === "AUTHORIZATION_UNAVAILABLE" ? ERROR_MESSAGE : DENIAL_MESSAGE,
    });
  }

  if (!isOrderStationForwardRole(authorization.data.role)) {
    return render({ kind: "denied", message: DENIAL_MESSAGE });
  }

  let wareneingangResult;
  let galvanikResult;
  try {
    [wareneingangResult, galvanikResult] = await Promise.all([
      getWareneingangOrdersAction(),
      getGalvanikOrdersAction(),
    ]);
  } catch {
    return render({ kind: "error", message: ERROR_MESSAGE });
  }

  if (!wareneingangResult.ok || !galvanikResult.ok) {
    const denied =
      (!wareneingangResult.ok && ["AUTH_ERROR", "FORBIDDEN"].includes(wareneingangResult.error)) ||
      (!galvanikResult.ok && ["AUTH_ERROR", "FORBIDDEN"].includes(galvanikResult.error));

    return render({
      kind: denied ? "denied" : "error",
      message: denied ? DENIAL_MESSAGE : ERROR_MESSAGE,
    });
  }

  const canCreateOrder = authorization.data.permissions.includes("perm_data_orders");

  if (hasDuplicateCanonicalOrder([...wareneingangResult.data, ...galvanikResult.data])) {
    return render({ kind: "conflict", message: CONFLICT_MESSAGE });
  }

  if (wareneingangResult.data.length === 0 && galvanikResult.data.length === 0) {
    return render({ kind: "empty", canCreateOrder });
  }

  return render({
    kind: "data",
    ...buildWerkstattData({
      wareneingang: wareneingangResult.data,
      galvanik: galvanikResult.data,
      canCreateOrder,
      greetingName: authorization.data.displayName ?? null,
    }),
  });
}
