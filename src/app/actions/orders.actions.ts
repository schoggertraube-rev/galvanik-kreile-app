"use server";

import { unstable_noStore as noStore } from "next/cache";
import type { ActionResult } from "@/lib/server/authHelper";
import {
  resolveAuthorization,
  type AuthorizationSnapshot,
} from "@/lib/server/authorization";
import type { OperationalOrder } from "@/lib/types/operationalOrder";
import {
  transitionWareneingangToGalvanik,
  correctGalvanikToWareneingang,
  type OrderStationCommandInput,
  type OrderStationCommandResult,
  type OrderStationCorrectionCommandInput,
  type OrderStationCorrectionCommandResult,
} from "@/lib/server/commands/orderStationCommand";
import type {
  ConfigureExtraWorkCatalogInput,
  ConfigureExtraWorkCatalogResult,
  SetExtraWorkHourlyRateInput,
  SetExtraWorkHourlyRateResult,
} from "@/lib/server/commands/extraWorkAdminCommand";
import type {
  ChangeOrderItemExtraWorkInput,
  ChangeOrderItemExtraWorkResult,
} from "@/lib/server/commands/orderExtraWorkCommand";
import type {
  FreezeOrderInput,
  FreezeOrderResult,
} from "@/lib/server/commands/orderFreezeCommand";
import type {
  ReopenFrozenOrderInput,
  ReopenFrozenOrderResult,
} from "@/lib/server/commands/orderFreezeCorrectionCommand";
import type {
  AssignOrderTaskInput,
  HandBackOrderTaskInput,
  OrderTaskAssignmentResult,
} from "@/lib/server/commands/orderTaskAssignmentCommand";
import type {
  ChangeOrderPromisedDueDateInput,
  ChangeOrderPromisedDueDateResult,
} from "@/lib/server/commands/orderPromiseCommand";
import type {
  ChangeOrderContentInput,
  OrderContentResult,
  SetOrderItemFinishedInput,
} from "@/lib/server/commands/orderContentCommand";
import type {
  ExtraWorkMasterData,
  LiveOrderCard,
  OrderCardReadResult,
} from "@/lib/server/orderCardRead";
import type { EvidenceReadRecord } from "@/lib/server/evidenceRead";

// DTO Typen (zur Vereinfachung)
export type OrderResponse = OperationalOrder;

export type OrderRegisterFilter = "ALL" | "ORDER" | "QUOTE";

export type OrderRegisterEntry = {
  kind: "ORDER" | "QUOTE";
  id: string;
  reference: string;
  customerId: string;
  customerName: string;
  title: string;
  dueDate: string;
  status: string;
  changedAt: string | null;
};

export async function transitionWareneingangToGalvanikAction(
  input: OrderStationCommandInput,
): Promise<OrderStationCommandResult> {
  return transitionWareneingangToGalvanik(input);
}

/** D-F12-004: reversal (galvanik -> wareneingang/angenommen) with a mandatory reason. */
export async function correctGalvanikToWareneingangAction(
  input: OrderStationCorrectionCommandInput,
): Promise<OrderStationCorrectionCommandResult> {
  return correctGalvanikToWareneingang(input);
}

export async function changeOrderItemExtraWorkAction(
  input: ChangeOrderItemExtraWorkInput,
): Promise<ChangeOrderItemExtraWorkResult> {
  const { changeOrderItemExtraWork } = await import(
    "@/lib/server/commands/orderExtraWorkCommand"
  );
  return changeOrderItemExtraWork(input);
}

export async function freezeOrderAction(input: FreezeOrderInput): Promise<FreezeOrderResult> {
  const { freezeOrder } = await import("@/lib/server/commands/orderFreezeCommand");
  return freezeOrder(input);
}

export async function reopenFrozenOrderAction(
  input: ReopenFrozenOrderInput,
): Promise<ReopenFrozenOrderResult> {
  const { reopenFrozenOrder } = await import(
    "@/lib/server/commands/orderFreezeCorrectionCommand"
  );
  return reopenFrozenOrder(input);
}

export async function assignOrderTaskAction(
  input: AssignOrderTaskInput,
): Promise<OrderTaskAssignmentResult> {
  const { assignOrderTask } = await import(
    "@/lib/server/commands/orderTaskAssignmentCommand"
  );
  return assignOrderTask(input);
}

export async function handBackOrderTaskAction(
  input: HandBackOrderTaskInput,
): Promise<OrderTaskAssignmentResult> {
  const { handBackOrderTask } = await import(
    "@/lib/server/commands/orderTaskAssignmentCommand"
  );
  return handBackOrderTask(input);
}

export async function changeOrderPromisedDueDateAction(
  input: ChangeOrderPromisedDueDateInput,
): Promise<ChangeOrderPromisedDueDateResult> {
  const { changeOrderPromisedDueDate } = await import(
    "@/lib/server/commands/orderPromiseCommand"
  );
  return changeOrderPromisedDueDate(input);
}

export async function changeOrderContentAction(
  input: ChangeOrderContentInput,
): Promise<OrderContentResult> {
  const { changeOrderContent } = await import("@/lib/server/commands/orderContentCommand");
  return changeOrderContent(input);
}

export async function setOrderItemFinishedAction(
  input: SetOrderItemFinishedInput,
): Promise<OrderContentResult> {
  const { setOrderItemFinished } = await import("@/lib/server/commands/orderContentCommand");
  return setOrderItemFinished(input);
}

export async function configureExtraWorkCatalogPositionAction(
  input: ConfigureExtraWorkCatalogInput,
): Promise<ConfigureExtraWorkCatalogResult> {
  const { configureExtraWorkCatalogPosition } = await import(
    "@/lib/server/commands/extraWorkAdminCommand"
  );
  return configureExtraWorkCatalogPosition(input);
}

export async function setExtraWorkHourlyRateAction(
  input: SetExtraWorkHourlyRateInput,
): Promise<SetExtraWorkHourlyRateResult> {
  const { setExtraWorkHourlyRate } = await import(
    "@/lib/server/commands/extraWorkAdminCommand"
  );
  return setExtraWorkHourlyRate(input);
}

type OrderCardActionResult<T> = OrderCardReadResult<T> | {
  code: "UNAUTHENTICATED";
  message: string;
};

async function resolveOrderCardAuthorization(): Promise<
  | { ok: true; data: AuthorizationSnapshot }
  | { ok: false; result: OrderCardActionResult<never> }
> {
  let authorization;
  try {
    authorization = await resolveAuthorization();
  } catch (error) {
    console.error("[ORDER_CARD_AUTHORIZATION_ERROR]", {
      message: error instanceof Error ? error.message.slice(0, 200) : "UNKNOWN",
    });
    return {
      ok: false,
      result: { code: "UNAVAILABLE", message: "Auftragskarte ist derzeit nicht verfügbar." },
    };
  }
  if (!authorization.ok) {
    return {
      ok: false,
      result: authorization.reason === "AUTHORIZATION_UNAVAILABLE"
        ? { code: "UNAVAILABLE", message: "Auftragskarte ist derzeit nicht verfügbar." }
        : { code: "UNAUTHENTICATED", message: "Sitzung oder Berechtigung ist nicht verfügbar." },
    };
  }
  return { ok: true, data: authorization.data };
}

export async function getLiveOrderCardAction(
  input: { orderId: string },
): Promise<OrderCardActionResult<{ card: LiveOrderCard; evidence: EvidenceReadRecord[] }>> {
  noStore();
  try {
    const authorization = await resolveOrderCardAuthorization();
    if (!authorization.ok) return authorization.result;
    const [{ readLiveOrderCard }, { readEvidenceRecordsByTarget }] = await Promise.all([
      import("@/lib/server/orderCardRead"),
      import("@/lib/server/evidenceRead"),
    ]);
    const card = await readLiveOrderCard(authorization.data, input);
    if (card.code !== "OK") return card;
    const evidence = await readEvidenceRecordsByTarget(authorization.data, {
      targetType: "ORDER",
      targetId: input.orderId,
    });
    if (evidence.code !== "OK") return evidence;
    return { code: "OK", data: { card: card.data, evidence: evidence.data } };
  } catch (error) {
    console.error("[ORDER_CARD_ACTION_ERROR]", {
      orderId: input.orderId,
      message: error instanceof Error ? error.message.slice(0, 200) : "UNKNOWN",
    });
    return { code: "UNAVAILABLE", message: "Auftragskarte ist derzeit nicht verfügbar." };
  }
}

export async function getExtraWorkMasterDataAction(): Promise<OrderCardActionResult<ExtraWorkMasterData>> {
  noStore();
  try {
    const authorization = await resolveOrderCardAuthorization();
    if (!authorization.ok) return authorization.result;
    const { readExtraWorkMasterData } = await import("@/lib/server/orderCardRead");
    return readExtraWorkMasterData(authorization.data);
  } catch (error) {
    console.error("[ORDER_CARD_EXTRA_WORK_ACTION_ERROR]", {
      message: error instanceof Error ? error.message.slice(0, 200) : "UNKNOWN",
    });
    return { code: "UNAVAILABLE", message: "Mehrarbeitsstammdaten sind derzeit nicht verfügbar." };
  }
}

export async function getOrderFrozenReceiptAction(input: {
  orderId: string;
  clientEventId: string;
}) {
  noStore();
  const authorization = await resolveOrderCardAuthorization();
  if (!authorization.ok) return authorization.result;
  const { readOrderFrozenReceipt } = await import("@/lib/server/orderFreezeRead");
  return readOrderFrozenReceipt(authorization.data, input);
}

export async function getOrderFreezeCorrectionReceiptAction(input: {
  orderId: string;
  clientEventId: string;
}) {
  noStore();
  const authorization = await resolveOrderCardAuthorization();
  if (!authorization.ok) return authorization.result;
  const { readOrderFreezeCorrectionReceipt } = await import(
    "@/lib/server/orderFreezeCorrectionRead"
  );
  return readOrderFreezeCorrectionReceipt(authorization.data, input);
}

export async function getOrderTaskAssignmentReceiptAction(input: {
  orderId: string;
  clientEventId: string;
}) {
  noStore();
  const authorization = await resolveOrderCardAuthorization();
  if (!authorization.ok) return authorization.result;
  const { readOrderTaskAssignmentReceipt } = await import(
    "@/lib/server/orderTaskAssignmentRead"
  );
  return readOrderTaskAssignmentReceipt(authorization.data, input);
}

export async function getOrderItemExtraWorkReceiptAction(input: {
  orderId: string;
  clientEventId: string;
}) {
  noStore();
  const authorization = await resolveOrderCardAuthorization();
  if (!authorization.ok) return authorization.result;
  const { readOrderItemExtraWorkReceipt } = await import(
    "@/lib/server/extraWorkReceiptRead"
  );
  return readOrderItemExtraWorkReceipt(authorization.data, input);
}

export async function getExtraWorkCatalogReceiptAction(input: {
  positionId: string;
  clientEventId: string;
}) {
  noStore();
  const authorization = await resolveOrderCardAuthorization();
  if (!authorization.ok) return authorization.result;
  const { readExtraWorkCatalogReceipt } = await import(
    "@/lib/server/extraWorkReceiptRead"
  );
  return readExtraWorkCatalogReceipt(authorization.data, input);
}

export async function getExtraWorkRateReceiptAction(input: {
  rateId: string;
  clientEventId: string;
}) {
  noStore();
  const authorization = await resolveOrderCardAuthorization();
  if (!authorization.ok) return authorization.result;
  const { readExtraWorkRateReceipt } = await import(
    "@/lib/server/extraWorkReceiptRead"
  );
  return readExtraWorkRateReceipt(authorization.data, input);
}

async function resolveOperationalReadAuthorization(): Promise<ActionResult<AuthorizationSnapshot>> {
  let authorization;
  try {
    authorization = await resolveAuthorization();
  } catch {
    return {
      ok: false,
      error: "DB_ERROR",
      message: "Auftragsdaten sind derzeit nicht verfügbar.",
    };
  }

  if (!authorization.ok) {
    if (authorization.reason === "AUTHORIZATION_UNAVAILABLE") {
      return {
        ok: false,
        error: "DB_ERROR",
        message: "Auftragsdaten sind derzeit nicht verfügbar.",
      };
    }
    return {
      ok: false,
      error: "UNAUTHORIZED",
      message: "Sitzung oder Berechtigung ist nicht verfügbar.",
    };
  }

  if (!authorization.data.permissions.includes("perm_view_leitstand")) {
    return {
      ok: false,
      error: "FORBIDDEN",
      message: "Auftragsansicht ist nicht erlaubt.",
    };
  }

  return { ok: true, data: authorization.data };
}

export async function getOrdersDb(): Promise<ActionResult<OrderResponse[]>> {
  noStore();
  const authorization = await resolveOperationalReadAuthorization();
  if (!authorization.ok) return authorization;

  try {
    const { getOperationalOrders } = await import("@/lib/server/operationalOrders");
    const data = await getOperationalOrders(authorization.data);
    return { ok: true, data };
  } catch (error: unknown) {
    console.error("[ORDER_READ_ERROR]", error);
    return {
      ok: false,
      error: "DB_ERROR",
      message: "Auftragsdaten konnten nicht sicher geladen werden.",
    };
  }
}

/**
 * F3 register read: one tenant-bound source for the order list and its KV
 * filter. The UI can select either aggregate without joining client results or
 * resolving authorization twice.
 */
export async function getOrderRegisterDb(
  input: { filter: OrderRegisterFilter } = { filter: "ALL" },
): Promise<ActionResult<OrderRegisterEntry[]>> {
  noStore();
  if (
    !input
    || typeof input !== "object"
    || Object.keys(input).length !== 1
    || !["ALL", "ORDER", "QUOTE"].includes(input.filter)
  ) {
    return {
      ok: false,
      error: "VALIDATION_ERROR",
      message: "Auftragsfilter ist ungültig.",
    };
  }

  const authorization = await resolveOperationalReadAuthorization();
  if (!authorization.ok) return authorization;

  try {
    const readOrders = input.filter !== "QUOTE";
    const readQuotes = input.filter !== "ORDER";
    const [orderRows, quoteResult] = await Promise.all([
      readOrders
        ? import("@/lib/server/operationalOrders").then(({ getOperationalOrders }) => getOperationalOrders(authorization.data))
        : Promise.resolve([]),
      readQuotes
        ? import("@/modules/quotes/server-public").then(({ listOpenQuotesCommand }) => listOpenQuotesCommand({
          tenantId: authorization.data.tenantId,
          userId: authorization.data.userId,
          capabilities: {
            canCreateQuote: false,
            canReadQuote: true,
            canUpdateQuote: false,
            canConvertQuote: false,
          },
        }))
        : Promise.resolve({ code: "OK" as const, quotes: [] }),
    ]);

    if (quoteResult.code !== "OK") {
      return {
        ok: false,
        error: quoteResult.code === "FORBIDDEN" ? "FORBIDDEN" : "DB_ERROR",
        message: "Aufträge und KVs konnten nicht gemeinsam sicher geladen werden.",
      };
    }

    const entries: OrderRegisterEntry[] = [
      ...orderRows.map((order) => ({
        kind: "ORDER" as const,
        id: order.id,
        reference: order.orderNumber,
        customerId: order.customerId,
        customerName: order.customerName ?? "",
        title: order.title,
        dueDate: order.dueDate,
        status: order.status,
        changedAt: order.createdAt ?? null,
      })),
      ...quoteResult.quotes.map((quote) => ({
        kind: "QUOTE" as const,
        id: quote.quoteId,
        reference: quote.quoteNumber,
        customerId: quote.customerId,
        customerName: quote.customerDisplayName,
        title: quote.positions[0]?.name ?? quote.quoteNumber,
        dueDate: quote.dueDate,
        status: quote.status,
        changedAt: quote.updatedAt,
      })),
    ];

    entries.sort((left, right) => {
      const timeOrder = (right.changedAt ?? "").localeCompare(left.changedAt ?? "");
      return timeOrder || left.reference.localeCompare(right.reference, "de");
    });
    return { ok: true, data: entries };
  } catch (error: unknown) {
    console.error("[ORDER_REGISTER_READ_ERROR]", error);
    return {
      ok: false,
      error: "DB_ERROR",
      message: "Aufträge und KVs konnten nicht gemeinsam sicher geladen werden.",
    };
  }
}

/** Tenant-bound count from the same versioned operational read port. */
export async function getOrderCountDb(): Promise<ActionResult<{ count: number }>> {
  noStore();
  const authorization = await resolveOperationalReadAuthorization();
  if (!authorization.ok) return authorization;

  try {
    const { getOperationalOrderCount } = await import("@/lib/server/operationalOrders");
    const count = await getOperationalOrderCount(authorization.data);
    return { ok: true, data: { count } };
  } catch (error: unknown) {
    console.error("[ORDER_COUNT_ERROR]", error);
    return {
      ok: false,
      error: "DB_ERROR",
      message: "Auftragsanzahl konnte nicht sicher geladen werden.",
    };
  }
}

export async function createOrderDb(data: Record<string, unknown>): Promise<ActionResult<Record<string, unknown>>> {
  void data;
  return { ok: false, error: "CONFLICT", message: "NOT_AVAILABLE: Auftragserstellung benötigt den W3-Command-Vertrag." };
}

export async function updateOrderDb(id: string, changes: {
  status?: string;
  currentStationId?: string;
  priorityComputed?: string;
  title?: string;
}): Promise<ActionResult<Record<string, unknown>>> {
  void id;
  void changes;
  // F0-W2C-B1: This legacy ID-only writer has no actor, tenant, ownership, or
  // version contract. It must not start a partial order/item/feedback workflow.
  // W3 will replace it with a command contract; retain this ActionResult shape
  // so existing clients receive an explicit denial instead of a false success.
  return {
    ok: false,
    error: "CONFLICT",
    message: "NOT_AVAILABLE: Auftragsänderungen sind bis zum serverseitigen Command-Vertrag nicht verfügbar.",
  };
}

export async function getRiskOrders(_limit = 3): Promise<{ ok: false; error: "NOT_AVAILABLE"; message: string }> {
  void _limit;
  return { ok: false, error: "NOT_AVAILABLE", message: "NOT_AVAILABLE: Terminrisiken benötigen eine kanonische, quellgestützte Berechnung." };
}

// F0-W2C quarantine: transitionOrderProcess is an unsafe transition port without
// the W3 command contract. It denies every station transition until W3 replaces it.

export async function transitionOrderProcess(params: {
  orderId: string;
  targetStep?: string;
  action?: string;
}): Promise<ActionResult<never>> {
  void params;
  return { ok: false, error: "CONFLICT", message: "NOT_AVAILABLE: Stationswechsel benötigen den W3-Command-Vertrag." };
}

export async function createOrderFromScan(params: {
  customerId?: string;
  customerName?: string;
  title?: string;
  parts: { name: string; quantity: number; surfaceRequested?: string; material?: string }[];
  forceCreateCustomer?: boolean;
}): Promise<
  | { ok: true; data: { orderId: string; newCustomerId?: string; status: string; customerChoices?: Record<string, unknown>[] } }
  | { ok: false; error: string; message: string; details?: unknown }
> {
  void params;
  return { ok: false, error: "CONFLICT", message: "NOT_AVAILABLE: Auftragserstellung benötigt den W3-Command-Vertrag." };
}
