"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { logout } from "@/app/actions/auth";
import { chooseIntakeCaptureKindAction } from "@/app/actions/eingang.actions";
import { createCustomerAction, getCustomersDb, readCustomerCreateReceiptAction, readCustomerAddressAction } from "@/app/actions/customers.actions";
import { erfasseAuftragAusEingangAction, getIntakeDraftsAction, saveIntakeDraftAction, discardIntakeDraftAction, getIntakePendingScopeAction, saveIntakeNoteAction, recognizeIntakeNoteAction, prepareIntakeFileAction, finishIntakeFileAction, getIntakeCaptureAction, saveIntakeDeviceRequestAction, discardIntakeCaptureAction } from "@/app/actions/eingang.actions";
import { convertQuoteToOrderAction, createQuoteAction, listOpenQuotesAction, readQuoteAction, readQuoteCreateReceiptAction, readQuoteConversionReceiptAction, readQuoteUpdateReceiptAction, updateQuoteAction } from "@/app/actions/quotes.actions";
import { getOrderIntakeReceiptAction, getOrderIntakeSuggestionsAction, recognizeOrderIntakeTextAction, searchOrderIntakeCustomersAction } from "@/app/warendurchlauf/actions";
import { getIntakeCatalogAction } from "@/app/actions/catalog.actions";
import {getOpenIntakeMailsAction,saveIntakeProspectAction} from "@/app/actions/eingang.actions";
import { getOrderRegisterDb, getLiveOrderCardAction } from "@/app/actions/orders.actions";
import {
  GlobalCreateFlow,requestGlobalCreate,IntakeMessageDialogs,type MailSelectionPorts,
  type GlobalCreateConversionResult,
  type GlobalCreateCustomerResult,
  type GlobalCreateCustomerChoice,
  type CustomerComparisonValue,
  type GlobalCreateQuoteReadResult,
  type GlobalCreateQuoteResult,
  type GlobalCreateOpenQuotesResult,
  type GlobalCreateDirectIntakeResult,
  type DirectIntakeInput,
  type ConvertQuoteInput,
  type CreateQuoteInput,
  type UpdateQuoteInput,
} from "@/modules/eingang/public";

import { usePermissions } from "@/lib/auth/PermissionsContext";
import { isAppRole } from "@/lib/auth/authorizationContract";
import { useOverlayStore } from "@/lib/overlayStore";

type ChoiceSource={contactPerson?:string|null;id:string;customerNumber?:string|null;name:string;customerType:string;companyName?:string|null;salutation?:"frau"|"herr"|"ohne"|null;firstName?:string|null;lastName?:string|null;contactRole?:string|null;email?:string|null;phone?:string|null;street?:string|null;houseNumber?:string|null;zipCode?:string|null;city?:string|null;country?:string|null;paymentPreference?:string|null;vatId?:string|null;handoverPreference?:"pickup"|"shipping"|null;autoInfo?:boolean;vorrang?:boolean;invoiceTermsEnabled?:boolean;invoiceTermDays?:number|null;duplicateMatch?:{kind:"exact"|"possible";by:string}|null};
function customerChoice(source:ChoiceSource):GlobalCreateCustomerChoice {
  if(source.customerType!=="business"&&source.customerType!=="privat"&&source.customerType!=="lieferant")throw new Error("CUSTOMER_TYPE_READMODEL_INVALID");
  return {...source,customerNumber:source.customerNumber??null,customerType:source.customerType,companyName:source.companyName??null,
    contactPerson:source.contactPerson??null,street:source.street??"",zipCode:source.zipCode??"",city:source.city??null,country:source.country??"",paymentPreference:source.paymentPreference??undefined};
}

type CreateCustomerInput = Parameters<typeof createCustomerAction>[0];

const PENDING_QUOTE_KEY = "path1.global-create.pending-quote";
const PENDING_QUOTE_CONVERSION_KEY = "path1.global-create.pending-quote-conversion";

export function GlobalCreateAppAdapter() {
  const router = useRouter();
  const mailPorts=useMemo<MailSelectionPorts>(()=>({list:getOpenIntakeMailsAction,read:getIntakeCaptureAction}),[]);
  const openCustomer = useOverlayStore((state) => state.openCustomer);
  const openOrder = useOverlayStore((state) => state.openOrder);
  const activeCustomerOverlayId = useOverlayStore((state) => {
    for (let index = state.stack.length - 1; index >= 0; index -= 1) {
      const overlay = state.stack[index];
      if (overlay?.type === "customer") return overlay.id.split("#")[0];
    }
    return null;
  });
  const { canAction, hasArea, name, role } = usePermissions();
  const [resumeQuoteId, setResumeQuoteId] = useState<string | null>(null);
  const [resumeQuoteConversionId, setResumeQuoteConversionId] = useState<string | null>(null);
  const canCreateCustomer = canAction("createCustomer");
  const canCreateQuote = canAction("createQuote");
  const roleLabel = name.trim() || "dieses Profil";

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setResumeQuoteId(window.sessionStorage.getItem(PENDING_QUOTE_KEY));
      setResumeQuoteConversionId(window.sessionStorage.getItem(PENDING_QUOTE_CONVERSION_KEY));
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const rememberQuote = (quoteId: string | null) => {
    if (quoteId) {
      window.sessionStorage.setItem(PENDING_QUOTE_KEY, quoteId);
      window.sessionStorage.removeItem(PENDING_QUOTE_CONVERSION_KEY);
    } else {
      window.sessionStorage.removeItem(PENDING_QUOTE_KEY);
      window.sessionStorage.removeItem(PENDING_QUOTE_CONVERSION_KEY);
    }
    setResumeQuoteId(quoteId);
    setResumeQuoteConversionId(null);
  };

  const rememberQuoteConversion = (quoteId: string, clientEventId: string) => {
    window.sessionStorage.setItem(PENDING_QUOTE_KEY, quoteId);
    window.sessionStorage.setItem(PENDING_QUOTE_CONVERSION_KEY, clientEventId);
    setResumeQuoteId(quoteId);
    setResumeQuoteConversionId(clientEventId);
  };

  useEffect(()=>{
    const handler=(event:Event)=>{const {ziel,arg}=(event as CustomEvent<{ziel:string;arg?:unknown}>).detail??{};
      if(ziel==="kundeneu"){requestGlobalCreate({intent:"CUSTOMER",prefill:typeof arg==="string"&&arg.endsWith("#lieferant")?{customerMode:"lieferant"}:undefined});return;}
      if (ziel === "eingang" && typeof arg === "string" && arg.endsWith("#kopie")) {
        requestGlobalCreate({ intent: "DIRECT_INTAKE", prefill: { orderCopyId: arg.slice(0, -6) } }); return;
      }
      if (ziel === "eingang" && (arg == null || typeof arg === "string" && !arg.includes("#"))) {
        requestGlobalCreate(typeof arg === "string" && arg ? { intent: "DIRECT_INTAKE", prefill: { customerId: arg } } : "DIRECT_INTAKE"); return;
      }
      if (ziel === "auftrag" && typeof arg === "string") { openOrder(arg); return; }
        if((ziel==="kunde"||ziel==="kundebearbeiten")&&typeof arg==="string")openCustomer(ziel==="kundebearbeiten"&&!arg.includes("#")?arg+"#bearbeiten":arg);
    };
    window.addEventListener("kreile:oeffne",handler);return()=>window.removeEventListener("kreile:oeffne",handler);
  },[openCustomer,openOrder]);

  // Keep one safe, typed intake boundary mounted for authenticated workshop roles.
  // Their request is denied by the same flow before any command can run.
  if (!role || !isAppRole(role)) return null;

  return (
    <><IntakeMessageDialogs ports={mailPorts}/><GlobalCreateFlow
      ports={{
        readIntakeOrderSource: async (orderId) => {
          const result = await getLiveOrderCardAction({ orderId });
          if (result.code !== "OK") return result;
          return { code: "OK", source: { orderNumber: result.data.card.orderNumber, customerId: result.data.card.customerId,
            customerQuery: result.data.card.customerNumber ?? result.data.card.customerName,
            intakeSource: result.data.card.intakeSource, items: result.data.card.items } };
        },
        saveProspect:saveIntakeProspectAction,
        drafts: { readDrafts: getIntakeDraftsAction, saveDraft: saveIntakeDraftAction, discardDraft: discardIntakeDraftAction },
        canCreateCustomer,
        canReadCustomers:hasArea("kunden"),
        canReadMails: hasArea("mails"),
        getCaptureScope: getIntakePendingScopeAction,
        getCapture: getIntakeCaptureAction,
        discardCapture: discardIntakeCaptureAction,
        deviceRequest: saveIntakeDeviceRequestAction,
        saveCaptureNote: saveIntakeNoteAction,
        readCaptureNote: recognizeIntakeNoteAction,
        prepareCaptureFile: prepareIntakeFileAction,
        finishCaptureFile: finishIntakeFileAction,
        chooseCaptureKind: chooseIntakeCaptureKindAction,
        openCaptureObject: (ziel, arg) => !window.dispatchEvent(new CustomEvent("kreile:oeffne", { detail: { ziel, arg }, cancelable: true })),
        canCreateOrder: hasArea("eingang"),
        canCreateQuote,
        canManageMoney: hasArea("geld"),
        canDecide:hasArea("entscheiden"),
        showPrimaryTrigger: false,
        roleLabel,
        resumeQuoteId,
        resumeQuoteConversionId,
        listCustomers: async () => {
          const result = await getCustomersDb();
          if (!result.ok) {
            return {
              code: result.error === "UNAUTHORIZED" || result.error === "FORBIDDEN" ? "DENIED" as const : "UNAVAILABLE" as const,
              message: result.error === "UNAUTHORIZED" || result.error === "FORBIDDEN"
                ? "Der Kundenstamm ist für dieses Profil nicht freigegeben."
                : "Der Kundenstamm konnte nicht sicher gelesen werden.",
            };
          }
          return {
            code: "OK" as const,
            customers: result.data.map(customer=>customerChoice({...customer,customerType:customer.type})),

          };
        },
        searchIntakeCustomers: async (query,candidate?:CustomerComparisonValue) => {
          const result = await searchOrderIntakeCustomersAction(candidate?{query,candidate}:{query});
          if (!result.ok) {
            return {
              code: result.error === "FORBIDDEN" || result.error === "AUTH_ERROR" ? "DENIED" as const : "UNAVAILABLE" as const,
              message: result.message,
            };
          }
          return {
            code: "OK" as const,
            customers: result.data.customers.map(customerChoice),

          };
        },
        recognizeIntakeText: async (text) => {
          const result = await recognizeOrderIntakeTextAction({ text });
          if (result.ok) return { code: "OK" as const, data: result.data };
          return {
            code: result.error === "FORBIDDEN" ? "FORBIDDEN" as const : result.error === "AUTH_ERROR" ? "UNAUTHENTICATED" as const : "UNAVAILABLE" as const,
            message: result.message,
          };
        },
        getIntakeSuggestions: async (input) => {
          const result = await getOrderIntakeSuggestionsAction(input);
          if (result.ok) return { code: "OK" as const, data: result.data };
          return {
            code: result.error === "FORBIDDEN" ? "FORBIDDEN" as const : result.error === "AUTH_ERROR" ? "UNAUTHENTICATED" as const : "UNAVAILABLE" as const,
            message: result.message,
          };
        },
        listCatalog: async () => {
          const result = await getIntakeCatalogAction();
          return result.code === "OK" ? result : { code: result.code === "FORBIDDEN" ? "DENIED" as const : "UNAVAILABLE" as const, message: result.message };
        },
        checkCustomerAddress: readCustomerAddressAction,
        createCustomer: async (input: CreateCustomerInput): Promise<GlobalCreateCustomerResult> => {
          const result = await createCustomerAction(input);
          if (result.code !== "OK") return result;
          return {
            code: "OK",
            replayed: result.replayed,
            receipt: result.receipt,
            customer: customerChoice(result.customer),
          };
        },
        readCustomerCreateReceipt: async (input: CreateCustomerInput): Promise<GlobalCreateCustomerResult> => {
          const result = await readCustomerCreateReceiptAction(input);
          if (result.code !== "OK") return result;
          return {code:"OK",replayed:true,receipt:result.receipt,customer:customerChoice(result.customer)};
        },
        createQuote: async (input: CreateQuoteInput): Promise<GlobalCreateQuoteResult> => createQuoteAction(input),
        updateQuote: async (input: UpdateQuoteInput): Promise<GlobalCreateQuoteResult> => updateQuoteAction(input),
        readQuoteCreateReceipt: async (input: CreateQuoteInput): Promise<GlobalCreateQuoteResult> => {
          const result = await readQuoteCreateReceiptAction(input);
          return result.code === "OK" ? { ...result, replayed: true } : result;
        },
        readQuote: async (input: { quoteId: string }): Promise<GlobalCreateQuoteReadResult> => readQuoteAction(input),
        listOpenQuotes: async (): Promise<GlobalCreateOpenQuotesResult> => listOpenQuotesAction(),
        readQuoteUpdateReceipt: async (input: UpdateQuoteInput): Promise<GlobalCreateQuoteResult> => {
          const result = await readQuoteUpdateReceiptAction(input);
          return result.code === "OK" ? { ...result, replayed: true } : result;
        },
        convertQuote: async (input: ConvertQuoteInput): Promise<GlobalCreateConversionResult> => convertQuoteToOrderAction(input),
        readQuoteConversionReceipt: async (input: { quoteId: string; clientEventId: string }): Promise<GlobalCreateConversionResult> => {
          const result = await readQuoteConversionReceiptAction(input);
          return result.code === "OK" ? { ...result, replayed: true } : result;
        },
        createDirectIntake: async (input: DirectIntakeInput): Promise<GlobalCreateDirectIntakeResult> => {
          const result = await erfasseAuftragAusEingangAction({
            geprueft: input.geprueft,
            ...(input.wishDate!==undefined?{wishDate:input.wishDate}:{}),...(input.termOrigin!==undefined?{termOrigin:input.termOrigin}:{}),...(input.processingWeeks!==undefined?{processingWeeks:input.processingWeeks}:{}),
            ...(input.draftId ? {draftId:input.draftId} : {}),
            ...(input.sourceCaptures?{sourceCaptures:input.sourceCaptures}:{}),
            clientKey: input.clientEventId,
            text: null,
            telefonNotiz: input.intakeSource === "anfrage_telefon" ? input.note : null,
            customer: input.customer,
            dueDate: input.dueDate,
            items: input.items,
            intakeSource: input.intakeSource,
            termStatus: input.termStatus,
            handoverMode: input.handoverMode,
            paymentMode: input.paymentMode,
          });
          if (result.code !== "OK") return result;
          const readback = await getOrderIntakeReceiptAction({ orderId: result.orderId, clientEventId: input.clientEventId });
          if (!readback.ok) {
            return {
              code: readback.error === "FORBIDDEN" ? "FORBIDDEN" : readback.error === "AUTH_ERROR" ? "UNAUTHENTICATED" : "UNAVAILABLE",
              message: readback.message,
            };
          }
          if (!readback.data) return { code: "UNAVAILABLE", message: "Der gespeicherte Eingang konnte nicht sicher gelesen werden." };
          return { code: "OK", replayed: result.replayed, receipt: readback.data, confirmationMessage: result.confirmationMessage };
        },
        readDirectIntakeReceipt: async ({ orderId, clientEventId }): Promise<GlobalCreateDirectIntakeResult> => {
          const result = await getOrderIntakeReceiptAction({ orderId, clientEventId });
          if (!result.ok) {
            return {
              code: result.error === "FORBIDDEN" ? "FORBIDDEN" : result.error === "AUTH_ERROR" ? "UNAUTHENTICATED" : "UNAVAILABLE",
              message: result.message,
            };
          }
          if (!result.data) return { code: "NOT_FOUND", message: "Der gespeicherte Eingang wurde nicht gefunden." };
          return { code: "OK", replayed: true, receipt: result.data };
        },
        rememberQuote,
        rememberQuoteConversion,
        activeCustomerOverlayId,
        getCreateContext: async () => {
          const overlay = [...useOverlayStore.getState().stack].reverse().find(entry => entry.type === "customer" || entry.type === "order");
          if (!overlay || (overlay.type !== "customer" && overlay.type !== "order")) return { code: "OK", context: null };
          if (overlay.type === "order") {
            const result = await getOrderRegisterDb({ filter: "ORDER" });
            if (!result.ok) return { code: "UNAVAILABLE", message: result.message };
            const order = result.data.find(entry => entry.id === overlay.id.split("#")[0]);
            return order ? { code: "OK", context: { customerId: order.customerId, label: `${order.reference} · ${order.customerName}` } }
              : { code: "NOT_FOUND", message: "Auftrag des geöffneten Kontexts wurde nicht gefunden." };
          }
          const result = await getCustomersDb();
          if (!result.ok) return { code: "UNAVAILABLE", message: "Kundenkontext konnte nicht sicher gelesen werden." };
          const customer = result.data.find(entry => entry.id === overlay.id.split("#")[0]);
          return customer ? { code: "OK", context: { customerId: customer.id, label: customer.name } }
            : { code: "NOT_FOUND", message: "Kunde des geöffneten Kontexts wurde nicht gefunden." };
        },
        openCustomer,
        openOrder,
        refresh: () => router.refresh(),
        switchProfile: async () => {
          await logout();
          router.replace("/start");
          router.refresh();
        },
      }}
    /></>
  );
}
