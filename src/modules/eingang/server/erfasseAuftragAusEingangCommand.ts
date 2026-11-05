import "server-only";

import {
  hasAuthorizationArea,
  resolveAuthorization,
  type AuthorizationSnapshot,
} from "@/lib/server/authorization";
import {
  createOrderIntake,
  type OrderIntakeCustomerInput,
  type CustomerWriter,type CustomerUpdater,
  type OrderIntakeItemInput,
  type OrderIntakeSource,
  type OrderIntakeTermStatus,
} from "@/lib/server/commands/orderIntakeCommand";
import { createIntakeOrderBinding, type IntakeOrderSource } from "./intakeOrderBinding";
import { scheduleIntakeConfirmation } from "./intakeConfirmation";
import type { PaymentMode } from "@/lib/server/paymentContract";
import type { OrderReadiness } from "@/modules/customers/public";
import type {
  ErfasseAuftragResult,
} from "../types";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

import type {IntakeTermOrigin} from "@/lib/intakeSuggestionsContract";
type NormalizedInput = {
  wishDate?:string|null;termOrigin?:IntakeTermOrigin|null;processingWeeks?:1|2|3|5|null;
  geprueft: boolean;
  draftId?: string;
  sourceCaptures?:IntakeOrderSource[];
  clientKey: string;
  text: string | null;
  telefonNotiz: string | null;
  customer: OrderIntakeCustomerInput;
  dueDate: string;
  items: OrderIntakeItemInput[];
  intakeSource: OrderIntakeSource | undefined;
  termStatus: OrderIntakeTermStatus | undefined;
  handoverMode: "pickup" | "shipping" | undefined;
  paymentMode: PaymentMode | undefined;
};

type ErfasseAuftragFailure = Exclude<ErfasseAuftragResult, { code: "OK" }>;

type EingangAuthorization =
  | { ok: true; data: AuthorizationSnapshot }
  | { ok: false; result: ErfasseAuftragResult };

export type EingangCustomerPreflight = {
  customerId: string;
  readiness: OrderReadiness;
};

function plainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function normalizeInput(input: unknown): NormalizedInput | null {
  if (!plainObject(input) || typeof input.geprueft !== "boolean" || typeof input.clientKey !== "string" || !UUID_PATTERN.test(input.clientKey)) return null;
  if(input.draftId!==undefined&&(typeof input.draftId!=="string"||!UUID_PATTERN.test(input.draftId)))return null;
  if(input.sourceCaptures!==undefined&&(!Array.isArray(input.sourceCaptures)||!input.sourceCaptures.length
    ||input.sourceCaptures.some(source=>!plainObject(source)||Object.keys(source).sort().join(",")!=="id,version"||typeof source.id!=="string"||!UUID_PATTERN.test(source.id)||!Number.isSafeInteger(source.version)||(source.version as number)<1)
    ||new Set(input.sourceCaptures.map(source=>source.id)).size!==input.sourceCaptures.length))return null;
  if (input.text !== null && typeof input.text !== "string") return null;
  const text = typeof input.text === "string" ? input.text.trim() : null;
  if (text && text.length > 20_000) return null;
  if (input.telefonNotiz !== undefined && input.telefonNotiz !== null && (typeof input.telefonNotiz !== "string" || input.telefonNotiz.length > 2000)) return null;
  const telefonNotiz = input.intakeSource === "anfrage_telefon" && typeof input.telefonNotiz === "string" ? input.telefonNotiz.trim() || null : null;
  if (!plainObject(input.customer) || input.customer.mode!=="EXISTING"&&input.customer.mode!=="NEW"
    || input.customer.mode==="EXISTING"&&(typeof input.customer.customerId!=="string"||!input.customer.customerId.trim())) return null;
  if (typeof input.dueDate !== "string" || !Array.isArray(input.items)) return null;
  if (input.intakeSource !== undefined
    && input.intakeSource !== "persoenlich"
    && input.intakeSource !== "versand"
    && input.intakeSource !== "abholung_firma"
    && input.intakeSource !== "anfrage_mail"
    && input.intakeSource !== "anfrage_telefon") return null;
  if (input.termStatus !== undefined
    && input.termStatus !== "wunsch"
    && input.termStatus !== "bestaetigt"
    && input.termStatus !== "verschoben" && input.termStatus!=="gegenvorschlag") return null;
  if (input.handoverMode !== undefined && input.handoverMode !== "pickup" && input.handoverMode !== "shipping") return null;
  if (input.paymentMode !== undefined
    && input.paymentMode !== "vorkasse"
    && input.paymentMode !== "abholung"
    && input.paymentMode !== "rechnung") return null;
  return {
    ...(input.sourceCaptures?{sourceCaptures:input.sourceCaptures as IntakeOrderSource[]}:{}),
    geprueft: input.geprueft,
    ...(Object.hasOwn(input,"wishDate")?{wishDate:input.wishDate as string|null}:{}),...(Object.hasOwn(input,"termOrigin")?{termOrigin:input.termOrigin as IntakeTermOrigin|null}:{}),...(Object.hasOwn(input,"processingWeeks")?{processingWeeks:input.processingWeeks as 1|2|3|5|null}:{}),
    ...(input.draftId?{draftId:input.draftId as string}:{}),
    clientKey: input.clientKey,
    text: text || null,
    telefonNotiz,
    customer: input.customer.mode==='EXISTING'?{...input.customer,customerId:(input.customer.customerId as string).trim()} as OrderIntakeCustomerInput:input.customer as OrderIntakeCustomerInput,
    dueDate: input.dueDate,
    items: input.items as OrderIntakeItemInput[],
    intakeSource: input.intakeSource as OrderIntakeSource | undefined,
    termStatus: input.termStatus as OrderIntakeTermStatus | undefined,
    handoverMode: input.handoverMode,
    paymentMode: input.paymentMode,
  };
}

async function authorizeEingang(): Promise<EingangAuthorization> {
  const authorization = await resolveAuthorization();
  if (!authorization.ok) {
    return authorization.reason === "AUTHORIZATION_UNAVAILABLE"
      ? {
          ok: false,
          result: {
            code: "CONFLICT",
            message: "Eingang konnte nicht sicher gespeichert werden. Fehlercode: EINGANG_AUTH_UNAVAILABLE.",
          },
        }
      : {
          ok: false,
          result: { code: "UNAUTHENTICATED", message: "Sitzung ist nicht verfügbar." },
        };
  }
  if (!hasAuthorizationArea(authorization.data, "eingang")) {
    return {
      ok: false,
      result: { code: "FORBIDDEN", message: "Eingang ist für diesen Login nicht freigegeben." },
    };
  }
  return { ok: true, data: authorization.data };
}

function validateCustomerPreflight(
  input: NormalizedInput,
  preflight: EingangCustomerPreflight | undefined,
): { code: "OK" } | ErfasseAuftragFailure {
  if(input.customer.mode==="NEW"||input.customer.changes)return {code:"OK"};
  if (!preflight || preflight.customerId !== input.customer.customerId) {
    return {
      code: "CONFLICT",
      message: "Kundenstand konnte nicht sicher geprüft werden. Fehlercode: EINGANG_CUSTOMER_PREFLIGHT_MISSING.",
    };
  }
  if (preflight.readiness.issues.length > 0) {
    return {
      code: "CUSTOMER_INCOMPLETE",
      message: `Kunde ist für den Auftrag unvollständig: ${preflight.readiness.issues.map((issue) => issue.message).join(", ")}. Bitte im Abschnitt Kunde ergänzen.`,
      missing: preflight.readiness.issues.map((issue) => issue.field),
    };
  }
  return { code: "OK" };
}

export async function erfasseAuftragAusEingangCommand(
  input: unknown,
  customerPreflight?: EingangCustomerPreflight,
  customerWriter?:CustomerWriter,customerUpdater?:CustomerUpdater,
  afterResponse?:(task:()=>Promise<void>)=>void,
): Promise<ErfasseAuftragResult> {
  const normalized = normalizeInput(input);
  if (!normalized) {
    return { code: "VALIDATION_ERROR", message: "Eingangsdaten sind unvollständig oder ungültig." };
  }

  const createAuthorization = await authorizeEingang();
  if (!createAuthorization.ok) return createAuthorization.result;
  const readiness = validateCustomerPreflight(normalized, customerPreflight);
  if (readiness.code !== "OK") return readiness;
  const goods=normalized.intakeSource!==undefined&&["persoenlich","versand","abholung_firma"].includes(normalized.intakeSource);
  const inquiry=normalized.intakeSource!==undefined&&["anfrage_mail","anfrage_telefon"].includes(normalized.intakeSource);
  if(goods&&!normalized.geprueft||inquiry&&normalized.geprueft)return {code:"VALIDATION_ERROR",message:goods?"Ware, Menge und Zustand gemeinsam prüfen.":"Bei einer Anfrage ist noch keine Ware geprüft."};
  const binding=createIntakeOrderBinding({clientEventId:normalized.clientKey,customerId:normalized.customer.mode==="EXISTING"?normalized.customer.customerId:null,note:normalized.text,telefonNotiz:normalized.telefonNotiz,sources:normalized.sourceCaptures,draftId:normalized.draftId});
  const order = await createOrderIntake({
    geprueft: normalized.geprueft,
    ...(normalized.wishDate!==undefined?{wishDate:normalized.wishDate}:{}),...(normalized.termOrigin!==undefined?{termOrigin:normalized.termOrigin}:{}),...(normalized.processingWeeks!==undefined?{processingWeeks:normalized.processingWeeks}:{}),
    clientEventId: normalized.clientKey,
    customer: normalized.customer,
    dueDate: normalized.dueDate,
    termStatus: normalized.termStatus ?? null,
    handoverMode: normalized.handoverMode,
    intakeSource: normalized.intakeSource ?? null,
    items: normalized.items,
    note: normalized.text,
    ...(hasAuthorizationArea(createAuthorization.data, "geld") && normalized.paymentMode
      ? { paymentMode: normalized.paymentMode }
      : {}),
  },customerWriter,binding,customerUpdater);
  if (order.code !== "OK") {
    if(order.code==='FORBIDDEN'&&!hasAuthorizationArea(createAuthorization.data,'geld')&&normalized.items.some(item=>item.unitPriceCents!==null||item.vatRateBasisPoints!==null)){
      return {code:'VALIDATION_ERROR',message:'Preisangaben benötigen das Recht Geld. Es wurde nichts gespeichert.'};
    }
    if (order.code === "UNAVAILABLE") {
      console.error("[EINGANG_AP01_ORDER_WRITE_FAILED]", { message: order.message });
      return {
        code: "CONFLICT",
        message: "Auftrag konnte nicht sicher gespeichert werden. Fehlercode: EINGANG_ORDER_WRITE_FAILED.",
      };
    }
    if (order.code === "NOT_FOUND") {
      return { code: "VALIDATION_ERROR", message: order.message };
    }
    return order;
  }

  return {
    code: "OK",
    orderNumber: order.receipt.orderNumber,
    orderId: order.receipt.orderId,
    intakeItemId: binding.itemId()!,
    replayed: order.replayed,
    confirmationMessage: await scheduleIntakeConfirmation(createAuthorization.data,order.receipt,afterResponse),
  };
}
