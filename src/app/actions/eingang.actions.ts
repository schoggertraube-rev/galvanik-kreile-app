"use server";

import { createHash } from "node:crypto";
import { after } from "next/server";
import { getAppSession } from "@/lib/server/appSession";
import {selectIntakeConcern,finishIntakeUse,reopenIntake} from '@/modules/eingang/server-public';
export async function selectIntakeConcernAction(input:unknown){return selectIntakeConcern(input);}
export async function finishIntakeUseAction(input:unknown){return finishIntakeUse(input);}
export async function reopenIntakeAction(input:unknown){return reopenIntake(input);}
import {readOpenIntakeMails} from '@/modules/eingang/server-public';
import {saveIntakeProspect} from '@/modules/eingang/server-public';
export async function saveIntakeProspectAction(input:unknown){return saveIntakeProspect(input,createCustomerInTransaction,readCustomerProfile);}
export async function getOpenIntakeMailsAction(){return readOpenIntakeMails();}
import { processIntakeDeviceRequest, discardIntakeCapture } from "@/modules/eingang/server-public";
import { readIntakeDrafts, writeIntakeDraft, discardIntakeDraft, retryIntakeRecognition } from "@/modules/eingang/server-public";

export async function getIntakeDraftsAction() { return readIntakeDrafts(); }
export async function saveIntakeDraftAction(input:unknown) { return writeIntakeDraft(input); }
export async function discardIntakeDraftAction(input:unknown) { return discardIntakeDraft(input); }
export async function retryIntakeRecognitionAction(input:unknown) { return retryIntakeRecognition(input); }

import {
  erfasseAuftragAusEingangCommand,
  type ErfasseAuftragResult,
} from "@/modules/eingang/server-public";
import { hasAuthorizationArea, resolveAuthorization } from "@/lib/server/authorization";
import {createCustomerInTransaction,updateCustomerInTransaction, readCustomerProfile} from "@/modules/customers/server-public";
import {createOrderIntake} from "@/lib/server/commands/orderIntakeCommand";
import {presentOrderIntakeReceipt} from "@/lib/server/orderIntakeRead";
import { readCustomerOrderReadinessCommand } from "@/modules/customers/server-public";
import { saveIntakeNote, readIntakeCapture, readIntakeNoteText, readIntakePendingScope, prepareIntakeFile, finishIntakeFile, readIntakeFileChanges } from "@/modules/eingang/server-public";
import type { IntakeContext } from "@/modules/eingang/public";

export async function saveIntakeNoteAction(input: unknown) {
  return saveIntakeNote(input, readCustomerProfile);
}
export async function discardIntakeCaptureAction(input:unknown){return discardIntakeCapture(input);}
export async function prepareIntakeFileAction(input: unknown) { return prepareIntakeFile(input); }
export async function finishIntakeFileAction(fileId: string) { return finishIntakeFile(fileId); }
export async function getIntakePendingScopeAction() { return readIntakePendingScope(); }
export async function getIntakeFileChangesAction(since: string, after: string | null) { return readIntakeFileChanges(since, after); }
export async function saveIntakeDeviceRequestAction(input: unknown) {
  const session = await getAppSession();
  const fingerprint = session ? createHash("sha256").update(JSON.stringify(["intake-device", session.tenantId, session.userId, session.issuedAt])).digest("hex") : null;
  return processIntakeDeviceRequest(input, fingerprint);
}
export async function getIntakeCaptureAction(itemId: string, context?: IntakeContext) {
  return readIntakeCapture(itemId, context);
}
export async function recognizeIntakeNoteAction(text: string) {
  const authorization = await resolveAuthorization();
  if (!authorization.ok || !hasAuthorizationArea(authorization.data, "eingang")) return { code: "FORBIDDEN" as const, message: "Eingang ist nicht freigegeben." };
  if (typeof text !== "string" || text.length > 20_000) return { code: "VALIDATION_ERROR" as const, message: "Notiz darf höchstens 20.000 Zeichen enthalten." };
  return { code: "OK" as const, data: readIntakeNoteText(text) };
}

function existingCustomerId(input: unknown): string | null {
  if (input === null || typeof input !== "object" || Array.isArray(input)) return null;
  const customer = (input as Record<string, unknown>).customer;
  if (customer === null || typeof customer !== "object" || Array.isArray(customer)) return null;
  const value = customer as Record<string, unknown>;
  return value.mode === "EXISTING" && typeof value.customerId === "string" && value.customerId.trim().length > 0
    ? value.customerId.trim()
    : null;
}

export async function erfasseAuftragAusEingangAction(input: unknown): Promise<ErfasseAuftragResult> {
  const customerId = existingCustomerId(input);
  const authorization = await resolveAuthorization();
  if (!customerId || !authorization.ok || !hasAuthorizationArea(authorization.data, "eingang") || (input as {customer?:{changes?:unknown}})?.customer?.changes) {
    return erfasseAuftragAusEingangCommand(input,undefined,createCustomerInTransaction,updateCustomerInTransaction,after);
  }
  const customer = await readCustomerOrderReadinessCommand(authorization.data, {
    customerId,
    requirePaymentPreference: hasAuthorizationArea(authorization.data, "geld"),
  });
  if (customer.code !== "OK") {
    return customer.code === "NOT_FOUND"
      ? { code: "VALIDATION_ERROR", message: customer.message }
      : { code: "CONFLICT", message: customer.message };
  }
  const readiness = customer.readiness;
  if (readiness.issues.length > 0) {
    return {
      code: "CUSTOMER_INCOMPLETE",
      message: `Kunde ist für den Auftrag unvollständig: ${readiness.issues.map((issue) => issue.message).join(", ")}. Bitte im Abschnitt Kunde ergänzen.`,
      missing: readiness.issues.map((issue) => issue.field),
    };
  }
  return erfasseAuftragAusEingangCommand(input, { customerId, readiness },undefined,undefined,after);
}

export async function createOrderIntakeAction(input:unknown){
  const authorization=await resolveAuthorization();
  if(!authorization.ok)return {code:"UNAUTHENTICATED" as const,message:authorization.message};
  const result=await createOrderIntake(input,createCustomerInTransaction);
  return result.code==="OK"?{...result,receipt:presentOrderIntakeReceipt(result.receipt,hasAuthorizationArea(authorization.data,"geld"))}:result;
}
