"use server";

import { unstable_noStore as noStore } from "next/cache";
import { resolveAuthorization } from "@/lib/server/authorization";
import {
  attachInboxMessage,
  readCommunicationInbox,
  readLinkedCommunicationMessages,
  sendCommunicationMail,
} from "@/lib/server/communicationPort";
import { readMicrosoftGraphConfigurationStatus } from "@/lib/server/microsoftGraph";
import { readQuoteAction, readQuotePdfAction } from "@/app/actions/quotes.actions";

type TargetInput = { targetType: "CUSTOMER" | "ORDER"; targetId: string };

async function authorization() {
  return resolveAuthorization();
}

export async function getMicrosoftGraphStatusAction() {
  noStore();
  const authorizationResult = await authorization();
  if (!authorizationResult.ok) return { code: "UNAUTHENTICATED" as const, message: authorizationResult.message };
  const auth = authorizationResult.data;
  if (!auth.areas?.includes("mails")) return { code: "FORBIDDEN" as const, message: "Microsoft 365 ist für dieses Profil nicht freigegeben." };
  return readMicrosoftGraphConfigurationStatus().code === "READY"
    ? { code: "OK" as const }
    : { code: "IN_KLAERUNG" as const, message: "Microsoft 365 · In Klärung. Die Preview-Zugangsdaten sind noch nicht vollständig verbunden." };
}

export async function listOutlookInboxAction(input?: TargetInput) {
  noStore();
  const authorizationResult = await authorization();
  if (!authorizationResult.ok) return { code: "UNAUTHENTICATED" as const, message: authorizationResult.message };
  return input
    ? readLinkedCommunicationMessages(authorizationResult.data, input)
    : readCommunicationInbox(authorizationResult.data);
}

export async function attachOutlookMailAction(input: TargetInput & { graphMessageId: string }) {
  const authorizationResult = await authorization();
  if (!authorizationResult.ok) return { code: "UNAUTHENTICATED" as const, message: authorizationResult.message };
  return attachInboxMessage(authorizationResult.data, input);
}

export async function sendCustomerMailAction(input: TargetInput & {
  clientRequestId: string;
  subject: string;
  body: string;
  attachment?: { kind: "QUOTE"; documentId: string };
}) {
  const authorizationResult = await authorization();
  if (!authorizationResult.ok) return { code: "UNAUTHENTICATED" as const, message: authorizationResult.message };
  const auth = authorizationResult.data;
  let attachment;
  if (input.attachment) {
    const quote = await readQuoteAction({ quoteId: input.attachment.documentId });
    if (quote.code !== "OK") return quote;
    const belongs = input.targetType === "CUSTOMER"
      ? quote.quote.customerId === input.targetId
      : quote.quote.linkedOrderId === input.targetId;
    if (!belongs) return { code: "FORBIDDEN" as const, message: "Der KV gehört nicht zu diesem Kunden oder Auftrag." };
    const pdf = await readQuotePdfAction({ quoteId: input.attachment.documentId });
    if (pdf.code !== "OK") return pdf;
    attachment = {
      filename: `${pdf.quoteNumber}.pdf`,
      contentType: "application/pdf" as const,
      bytes: new Uint8Array(pdf.pdf),
    };
  }
  return sendCommunicationMail(auth, {
    targetType: input.targetType,
    targetId: input.targetId,
    clientRequestId: input.clientRequestId,
    subject: input.subject,
    body: input.body,
    attachment,
  });
}
