"use server";

import { renderToBuffer } from "@react-pdf/renderer";
import { revalidatePath, unstable_noStore as noStore } from "next/cache";
import { createQuotePdfDocument } from "@/lib/pdf/QuoteDocument";
import { resolveAuthorization } from "@/lib/server/authorization";
import { readCustomerSummary } from "@/lib/server/customerSummaryRead";
import { createOrderIntake } from "@/lib/server/commands/orderIntakeCommand";
import { readOrderIntakeReceipt } from "@/lib/server/orderIntakeRead";
import { readCompanyDocumentSettings } from "@/modules/fundament/server-public";
import {
  createQuoteCommand,
  listOpenQuotesCommand,
  prepareQuoteConversionCommand,
  readQuoteCommand,
  readQuoteCreateReceiptCommand,
  readQuoteConversionReceiptCommand,
  readQuoteUpdateReceiptCommand,
  updateQuoteCommand,
  type ConvertQuoteInput,
  type CreateQuoteInput,
  type UpdateQuoteInput,
  type QuoteCommandContext,
} from "@/modules/quotes/server-public";

function quoteCommandContext(authorization: { tenantId: string; userId: string; permissions: readonly string[]; areas?: readonly string[] }): QuoteCommandContext {
  const canUseMoney = authorization.areas?.includes("geld") === true;
  return {
    tenantId: authorization.tenantId,
    userId: authorization.userId,
    capabilities: {
      canCreateQuote: canUseMoney && authorization.permissions.includes("perm_data_orders"),
      canReadQuote: canUseMoney && authorization.permissions.includes("perm_view_leitstand"),
      canUpdateQuote: canUseMoney && authorization.permissions.includes("perm_data_orders"),
      canConvertQuote: canUseMoney && authorization.permissions.includes("perm_data_orders"),
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

export async function listOpenQuotesAction() {
  noStore();
  let authorization;
  try {
    authorization = await resolveAuthorization();
  } catch {
    return { code: "UNAVAILABLE" as const, message: "Offene KVs konnten nicht sicher gelesen werden." };
  }
  const failure = authorizationFailure(authorization);
  if (failure || !authorization.ok) return failure!;
  return listOpenQuotesCommand(quoteCommandContext(authorization.data));
}

export async function updateQuoteAction(input: UpdateQuoteInput) {
  let authorization;
  try {
    authorization = await resolveAuthorization();
  } catch {
    return { code: "UNAVAILABLE" as const, message: "KV konnte nicht sicher aktualisiert werden." };
  }
  const failure = authorizationFailure(authorization);
  if (failure || !authorization.ok) return failure!;
  const result = await updateQuoteCommand(quoteCommandContext(authorization.data), input);
  if (result.code === "OK") {
    revalidatePath("/customers");
    revalidatePath(`/customers/${result.quote.customerId}`);
  }
  return result;
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

/** Read-only recovery for an interrupted KV edit; it never starts a command. */
export async function readQuoteUpdateReceiptAction(input: UpdateQuoteInput) {
  noStore();
  let authorization;
  try {
    authorization = await resolveAuthorization();
  } catch {
    return { code: "UNAVAILABLE" as const, message: "Der gespeicherte KV-Stand konnte nicht sicher gelesen werden." };
  }
  const failure = authorizationFailure(authorization);
  if (failure || !authorization.ok) return failure!;
  return readQuoteUpdateReceiptCommand(quoteCommandContext(authorization.data), input);
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

export async function readQuotePdfAction(input: { quoteId: string }) {
  noStore();
  let authorization;
  try {
    authorization = await resolveAuthorization();
  } catch {
    return { code: "UNAVAILABLE" as const, message: "KV-PDF ist derzeit nicht verfügbar." };
  }
  const failure = authorizationFailure(authorization);
  if (failure || !authorization.ok) return failure!;

  const quoteResult = await readQuoteCommand(quoteCommandContext(authorization.data), input);
  if (quoteResult.code !== "OK") return quoteResult;
  const [customerResult, companyResult] = await Promise.all([
    readCustomerSummary(authorization.data, { customerId: quoteResult.quote.customerId }),
    readCompanyDocumentSettings({
      tenantId: authorization.data.tenantId,
      actorId: authorization.data.userId,
      canRead: authorization.data.permissions.includes("perm_view_leitstand"),
    }),
  ]);
  if (customerResult.code !== "OK") return customerResult;
  if (companyResult.code !== "OK") return companyResult;

  try {
    const pdf = await renderToBuffer(createQuotePdfDocument({
      company: companyResult.company,
      customer: customerResult.data,
      quote: quoteResult.quote,
    }));
    return { code: "OK" as const, pdf, quoteNumber: quoteResult.quote.quoteNumber };
  } catch {
    return { code: "UNAVAILABLE" as const, message: "KV-PDF konnte nicht sicher erstellt werden." };
  }
}
