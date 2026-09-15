"use server";

import { revalidatePath, unstable_noStore as noStore } from "next/cache";
import { resolveAuthorization } from "@/lib/server/authorization";
import { createOrderIntake } from "@/lib/server/commands/orderIntakeCommand";
import { readOrderIntakeReceipt } from "@/lib/server/orderIntakeRead";
import {
  createQuoteCommand,
  prepareQuoteConversionCommand,
  readQuoteCommand,
  readQuoteCreateReceiptCommand,
  readQuoteConversionReceiptCommand,
  type ConvertQuoteInput,
  type CreateQuoteInput,
  type QuoteCommandContext,
} from "@/modules/quotes/server-public";

function quoteCommandContext(authorization: { tenantId: string; userId: string; permissions: readonly string[] }): QuoteCommandContext {
  return {
    tenantId: authorization.tenantId,
    userId: authorization.userId,
    capabilities: {
      canCreateQuote: authorization.permissions.includes("perm_data_orders"),
      canReadQuote: authorization.permissions.includes("perm_view_leitstand"),
      canConvertQuote: authorization.permissions.includes("perm_data_orders"),
    },
  };
}

function authorizationFailure(result: Awaited<ReturnType<typeof resolveAuthorization>>) {
  if (result.ok) return null;
  return result.reason === "AUTHORIZATION_UNAVAILABLE"
    ? { code: "UNAVAILABLE" as const, message: "KV-Funktion ist derzeit nicht verfügbar." }
    : { code: "UNAUTHENTICATED" as const, message: "Sitzung oder Berechtigung ist nicht verfügbar." };
}

export async function createQuoteAction(input: CreateQuoteInput) {
  let authorization;
  try {
    authorization = await resolveAuthorization();
  } catch {
    return { code: "UNAVAILABLE" as const, message: "KV konnte nicht sicher gespeichert werden." };
  }
  const failure = authorizationFailure(authorization);
  if (failure || !authorization.ok) return failure!;
  const result = await createQuoteCommand(quoteCommandContext(authorization.data), input);
  if (result.code === "OK") {
    revalidatePath("/customers");
    revalidatePath(`/customers/${result.quote.customerId}`);
  }
  return result;
}

export async function readQuoteAction(input: { quoteId: string }) {
  noStore();
  let authorization;
  try {
    authorization = await resolveAuthorization();
  } catch {
    return { code: "UNAVAILABLE" as const, message: "KV konnte nicht sicher gelesen werden." };
  }
  const failure = authorizationFailure(authorization);
  if (failure || !authorization.ok) return failure!;
  return readQuoteCommand(quoteCommandContext(authorization.data), input);
}

/** Read-only recovery for an interrupted KV create; it never starts a command. */
export async function readQuoteCreateReceiptAction(input: CreateQuoteInput) {
  noStore();
  let authorization;
  try {
    authorization = await resolveAuthorization();
  } catch {
    return { code: "UNAVAILABLE" as const, message: "Der gespeicherte KV-Stand konnte nicht sicher gelesen werden." };
  }
  const failure = authorizationFailure(authorization);
  if (failure || !authorization.ok) return failure!;
  return readQuoteCreateReceiptCommand(quoteCommandContext(authorization.data), input);
}

/** Read-only recovery for an interrupted award. It verifies both receipts. */
export async function readQuoteConversionReceiptAction(input: { quoteId: string; clientEventId: string }) {
  noStore();
  let authorization;
  try {
    authorization = await resolveAuthorization();
  } catch {
    return { code: "UNAVAILABLE" as const, message: "Der gespeicherte Auftragsstand konnte nicht sicher gelesen werden." };
  }
  const failure = authorizationFailure(authorization);
  if (failure || !authorization.ok) return failure!;
  const persisted = await readQuoteConversionReceiptCommand(quoteCommandContext(authorization.data), input);
  if (persisted.code !== "OK") return persisted;
  try {
    const orderReceipt = await readOrderIntakeReceipt(authorization.data, {
      orderId: persisted.receipt.orderId, clientEventId: input.clientEventId,
    });
    if (!orderReceipt || orderReceipt.orderId !== persisted.receipt.orderId || orderReceipt.customerId !== persisted.receipt.customerId) {
      return { code: "UNAVAILABLE" as const, message: "Ein KV-Zuschlag wurde gefunden, der zugehörige Auftragsstand ist aber noch nicht sicher lesbar." };
    }
    return { code: "OK" as const, quote: persisted.quote, quoteReceipt: persisted.receipt, orderReceipt };
  } catch {
    return { code: "UNAVAILABLE" as const, message: "Der gespeicherte Auftragsstand konnte nicht sicher gelesen werden." };
  }
}

export async function convertQuoteToOrderAction(input: ConvertQuoteInput) {
  let authorization;
  try {
    authorization = await resolveAuthorization();
  } catch {
    return { code: "UNAVAILABLE" as const, message: "KV konnte nicht sicher beauftragt werden." };
  }
  const failure = authorizationFailure(authorization);
  if (failure || !authorization.ok) return failure!;

  const commandContext = quoteCommandContext(authorization.data);
  const prepared = await prepareQuoteConversionCommand(commandContext, input);
  if (prepared.code !== "OK") return prepared;

  const order = await createOrderIntake(prepared.orderInput);
  if (order.code !== "OK") return order;

  const persisted = await readQuoteConversionReceiptCommand(commandContext, {
    quoteId: input.quoteId,
    clientEventId: input.clientEventId,
  });
  if (persisted.code !== "OK"
    || persisted.receipt.orderId !== order.receipt.orderId
    || persisted.receipt.orderIntakeEventId !== order.receipt.eventId
    || persisted.quote.linkedOrderId !== order.receipt.orderId) {
    return { code: "UNAVAILABLE" as const, message: "Auftrag wurde angelegt, der sichere KV-Readback ist noch nicht verfügbar." };
  }

  revalidatePath("/orders");
  revalidatePath(`/orders/${order.receipt.orderId}`);
  revalidatePath("/customers");
  revalidatePath(`/customers/${persisted.receipt.customerId}`);
  return {
    code: "OK" as const,
    quote: persisted.quote,
    quoteReceipt: persisted.receipt,
    orderReceipt: order.receipt,
    replayed: prepared.replayed && order.replayed,
  };
}
