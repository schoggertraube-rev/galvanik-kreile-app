"use client";

import {
  Check,
  ClipboardCopy,
  FileText,
  Loader2,
  Plus,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { FormEvent, KeyboardEvent, type ReactNode, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { kundeVollstaendigkeit, CUSTOMER_FIELD_LABELS, KundeFormular, EMPTY_CUSTOMER_FORM, customerDisplayName, customerFieldError, kundeValidierung, type CustomerFormValue, type CreateCustomerInput, type CustomerAddressInput, type CustomerAddressResult, type CustomerComparisonValue } from "@/modules/customers/public";
import type { CatalogServiceChoice } from "@/modules/katalog/public";
import {
  intakePaymentContract,
  paymentModeFromPreference,
  type PaymentMode,
} from "@/lib/server/paymentContract";
import {
  Abschnitt,
  Auswahl,
  Button as KrButton,
  Chip,
  Dialog as KrDialog,
  Eingabe,
  Fakten,
  Feld,
  FormRaster,
  Hinweis,
  KrApp,
  PruefRail,
  Icon,
  Segment,
  Textfeld,
  Toast,
  useKrGeraet,
} from "@/ui/kr";
import type {
  ConvertQuoteInput,
  CreateQuoteInput,
  QuoteConversionReceipt,
  QuoteCreateReceipt,
  QuoteReadback,
  QuoteUpdateReceipt,
  UpdateQuoteInput,
} from "@/modules/quotes/public";
export type { ConvertQuoteInput, CreateQuoteInput, UpdateQuoteInput } from "@/modules/quotes/public";
import type { IntakeTextRecognition } from "@/lib/server/intakeTextRecognition";
import type { IntakeSuggestions, IntakeSuggestionsInput } from "@/lib/intakeSuggestionsContract";
import styles from "@/components/layout/TargetShell.module.css";
import {IntakeTermBlock,type IntakeTermSelection} from "./ui/IntakeTermBlock";
import type {IntakeTermOrigin} from "@/lib/intakeSuggestionsContract";
import { IntakeCaptureDialog } from "./ui/IntakeCaptureDialog";
import { Rueckfrage } from "@/ui/kr/Dialog";
import type { IntakeCapture, IntakeCaptureResult, IntakeNoteInput, IntakeNoteReading, IntakeFileInput, IntakeFileGrant, IntakeCaptureKindInput } from "./captureContract";
import { recognizeNoteConcerns } from "./captureContract";
import { findRecognizedCustomers } from "./customerRecognition";
import { ORDER_POSITION_UNITS, ORDER_POSITION_SURFACES, normaliseOrderPositionUnit, normaliseOrderPositionSurface, orderPositionQuantityError, orderPositionPriceError, FREE_TEXT_VAT_RATE_BASIS_POINTS } from "@/lib/orderPositionContract";
import { GLOBAL_CREATE_OPEN_EVENT, type GlobalCreateIntent, type GlobalCreateRequest } from "./requestGlobalCreate";
import {INTAKE_MAIL_ADOPT_EVENT} from './mailSelectionContract';
import {INTAKE_CHANGED_EVENT} from './messageContract';
import type { IntakeDeviceCommand, IntakeDeviceResult } from "./deviceContract";
import type {ErfasseAuftragInput} from "./types";
import type { IntakeDraft, IntakeDraftPorts } from "./draftContract";
import type {IntakeProspectInput,IntakeProspectResult} from './prospectContract';

export { requestGlobalCreate } from "./requestGlobalCreate";
export type { GlobalCreateIntent, GlobalCreateRequest } from "./requestGlobalCreate";

type FailureCode =
  | "FORBIDDEN"
  | "UNAUTHENTICATED"
  | "NOT_FOUND"
  | "CONFLICT"
  | "CUSTOMER_INCOMPLETE"
  | "VALIDATION_ERROR"
  | "IN_KLAERUNG"
  | "UNAVAILABLE";

type Failure = { code: FailureCode; message: string };

export type GlobalCreateCustomerChoice = {
  id: string;
  customerNumber: string | null;
  name: string;
  customerType?: "business" | "privat" | "lieferant";
  salutation?: "frau" | "herr" | "ohne" | null;
  firstName?: string | null; lastName?: string | null; contactRole?: string | null; houseNumber?: string | null;
  handoverPreference?: "pickup" | "shipping" | null; lastHandoverMode?: "pickup" | "shipping" | null; autoInfo?: boolean; vorrang?: boolean;
  invoiceTermsEnabled?:boolean;invoiceTermDays?:number|null;
  duplicateMatch?:{kind:"exact"|"possible";by:string}|null;
  companyName?: string | null;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  street?: string;
  zipCode?: string;
  city: string | null;
  country?: string;
  paymentPreference?: string;
  vatId?: string | null;

};

export type GlobalCreateCustomerResult =
  | {
      code: "OK";
      replayed: boolean;
      receipt: {
        receiptId: string;
        eventId: string;
        customerId: string;
        customerNumber: string;
        clientEventId: string;
        correlationId: string;
        actorId: string;
        recordedAt: string;
      };
      customer: GlobalCreateCustomerChoice;
    }
  | Failure;

export type GlobalCreateQuoteResult =
  | { code: "OK"; quote: QuoteReadback; receipt: QuoteCreateReceipt | QuoteUpdateReceipt; replayed: boolean }
  | Failure;

export type GlobalCreateQuoteReadResult =
  | { code: "OK"; quote: QuoteReadback }
  | Failure;

export type GlobalCreateOpenQuotesResult =
  | { code: "OK"; quotes: QuoteReadback[] }
  | Failure;

export type GlobalCreateConversionResult =
  | {
      code: "OK";
      quote: QuoteReadback;
      quoteReceipt: QuoteConversionReceipt;
      orderReceipt: {
        receiptId: string;
        eventId: string;
        orderId: string;
        orderNumber: string;
        customerId: string;
        clientEventId: string;
        correlationId: string;
        actorId: string;
        recordedAt: string;
      };
      replayed: boolean;
    }
  | Failure;

export type DirectIntakeInput = {
  geprueft: boolean;
  wishDate?:string|null;termOrigin?:import("@/lib/intakeSuggestionsContract").IntakeTermOrigin|null;processingWeeks?:1|2|3|5|null;
  draftId?: string;
  sourceCaptures?:Array<{id:string;version:number}>;
  clientEventId: string;
  customer: ErfasseAuftragInput["customer"];
  dueDate: string;
  termStatus?: "wunsch" | "bestaetigt" | "verschoben" | "gegenvorschlag";
  intakeSource?: "persoenlich" | "versand" | "abholung_firma" | "anfrage_mail" | "anfrage_telefon";
  handoverMode: "pickup" | "shipping";
  paymentMode?: "vorkasse" | "abholung" | "rechnung";
  note: string | null;
  items: Array<{ catalogServiceId:string|null; name:string; quantity:number; material:string|null; surfaceRequested:string; executionRequested:"hochglanz"|"glaenzend"|"matt"|"gelb_passiviert"|"blau_passiviert"|"offen"; unit:string|null; unitPriceCents:number|null; vatRateBasisPoints:0|700|1900|null }>;
};

export type GlobalCreateDirectIntakeResult =
  | {
      code: "OK";
      confirmationMessage?: string;
      receipt: {
        receiptId: string;
        eventId: string;
        orderId: string;
        orderNumber: string;
        customerId: string;
        clientEventId: string;
        correlationId: string;
        actorId: string;
        dueDate: string;
        termStatus: "wunsch" | "bestaetigt" | "verschoben" | "gegenvorschlag" | null;
        intakeSource: "persoenlich" | "versand" | "abholung_firma" | "anfrage_mail" | "anfrage_telefon" | null;
        handoverMode: "pickup" | "shipping";
        paymentMode: "vorkasse" | "abholung" | "rechnung";
        recordedAt: string;
      };
      replayed: boolean;
    }
  | Failure;

export type GlobalCreatePorts = {
  readIntakeOrderSource?: (orderId: string) => Promise<{ code: "OK"; source: {
    orderNumber: string; customerId: string; customerQuery: string; intakeSource?: DirectIntakeInput["intakeSource"] | null;
    items: Array<Omit<DirectIntakeInput["items"][number], "executionRequested"> & { executionRequested?: IntakeExecution | null }>;
  } } | Failure>;
  saveProspect?:(input:IntakeProspectInput)=>Promise<IntakeProspectResult>;
  drafts?: IntakeDraftPorts;
  discardCapture?: (input:{itemId:string;version:number;clientEventId:string})=>Promise<IntakeCaptureResult>;
  canCreateCustomer: boolean;
  canReadCustomers?:boolean;
  canReadMails?: boolean;
  deviceRequest?: (input: IntakeDeviceCommand) => Promise<IntakeDeviceResult>;
  getCapture?: (id: string) => Promise<IntakeCaptureResult>;
  getCaptureScope?: () => Promise<{ code: "OK"; scope: string } | { code: "FORBIDDEN"; message: string }>;
  saveCaptureNote?: (input: IntakeNoteInput) => Promise<IntakeCaptureResult>;
  readCaptureNote?: (text: string) => Promise<{ code: "OK"; data: IntakeNoteReading } | { code: "FORBIDDEN" | "VALIDATION_ERROR"; message: string }>;
  prepareCaptureFile?: (input: IntakeFileInput) => Promise<IntakeFileGrant>;
  finishCaptureFile?: (id: string) => Promise<IntakeCaptureResult>;
  chooseCaptureKind?: (input: IntakeCaptureKindInput) => Promise<IntakeCaptureResult>;
  openCaptureObject?: (target: "mailein" | "original" | "ware" | "rechnungein", arg: string) => boolean;
  canCreateOrder: boolean;
  canCreateQuote: boolean;
  canManageMoney: boolean;
  canDecide?:boolean;
  showPrimaryTrigger?: boolean;
  roleLabel: string;
  resumeQuoteId: string | null;
  resumeQuoteConversionId: string | null;
  listCustomers: () => Promise<
    | { code: "OK"; customers: GlobalCreateCustomerChoice[] }
      | { code: "DENIED" | "UNAVAILABLE"; message: string }
  >;
  searchIntakeCustomers: (query: string,candidate?:CustomerComparisonValue) => Promise<
    | { code: "OK"; customers: GlobalCreateCustomerChoice[] }
    | { code: "DENIED" | "UNAVAILABLE"; message: string }
  >;
  recognizeIntakeText: (text: string) => Promise<{ code: "OK"; data: IntakeTextRecognition } | Failure>;
  getIntakeSuggestions: (input: IntakeSuggestionsInput) => Promise<{ code: "OK"; data: IntakeSuggestions } | Failure>;
  listCatalog?: () => Promise<{ code:"OK"; services:CatalogServiceChoice[] }|{ code:"DENIED"|"UNAVAILABLE"; message:string }>;
  checkCustomerAddress?: (input: CustomerAddressInput) => Promise<{code:"OK";data:CustomerAddressResult}|{code:string;message:string}>;
  createCustomer: (input: CreateCustomerInput) => Promise<GlobalCreateCustomerResult>;
  createCustomerFromCapture?: (input: CreateCustomerInput, source: { itemId: string; version: number }) => Promise<GlobalCreateCustomerResult>;
  readCustomerCreateReceipt: (input: CreateCustomerInput) => Promise<GlobalCreateCustomerResult | Failure>;
  createQuote: (input: CreateQuoteInput) => Promise<GlobalCreateQuoteResult>;
  updateQuote: (input: UpdateQuoteInput) => Promise<GlobalCreateQuoteResult>;
  readQuoteCreateReceipt: (input: CreateQuoteInput) => Promise<GlobalCreateQuoteResult>;
  readQuoteUpdateReceipt: (input: UpdateQuoteInput) => Promise<GlobalCreateQuoteResult>;
  readQuote: (input: { quoteId: string }) => Promise<GlobalCreateQuoteReadResult>;
  listOpenQuotes: () => Promise<GlobalCreateOpenQuotesResult>;
  convertQuote: (input: ConvertQuoteInput) => Promise<GlobalCreateConversionResult>;
  readQuoteConversionReceipt: (input: { quoteId: string; clientEventId: string }) => Promise<GlobalCreateConversionResult>;
  createDirectIntake: (input: DirectIntakeInput) => Promise<GlobalCreateDirectIntakeResult>;
  readDirectIntakeReceipt: (input: { orderId: string; clientEventId: string }) => Promise<GlobalCreateDirectIntakeResult>;
  rememberQuote: (quoteId: string | null) => void;
  rememberQuoteConversion: (quoteId: string, clientEventId: string) => void;
  activeCustomerOverlayId?: string | null;
  getCreateContext?: () => Promise<{ code: "OK"; context: { customerId: string; label: string } | null } | Failure>;
  openCustomer: (customerId: string,prefill?:Partial<CustomerFormValue>) => void;
  openOrder: (orderId: string) => void;
  refresh: () => void;
  switchProfile: () => Promise<void>;
};

type Step = "choose" | "customer" | "customer-saved" | "customer-picker" | "quote-list" | "quote" | "quote-saved" | "order-saved" | "direct-intake" | "denied";
type Feedback = { kind: "validation" | "conflict" | "denied" | "error" | "unclear" | "save-failed"; message: string; requestId?: string };
type OpenQuotesState =
  | { kind: "idle" | "loading" | "empty" }
  | { kind: "data"; quotes: QuoteReadback[] }
  | { kind: "denied" | "error" | "unknown"; message: string; requestId?: string };
type CustomerDraft = CustomerFormValue;
type PositionDraft = {
  key: string;
  catalogServiceId: string;
  name: string;
  quantity: string;
  material: string;
  surfaceRequested: string;
  unit: string;
  unitPriceCents: number | null;
};
type IntakeExecution = "hochglanz" | "glaenzend" | "matt" | "gelb_passiviert" | "blau_passiviert" | "offen";
type IntakePositionDraft = { key:string; catalogServiceId:string; name:string; quantity:string; material:string; surfaceRequested:string; surfaceTouched:boolean; executionRequested:IntakeExecution; unit:string|null; unitPriceCents:number|null; priceText?:string; vatRateBasisPoints:0|700|1900|null };
type IntakeSuggestionState = { kind: "idle" | "loading" | "error" } | { kind: "data"; data: IntakeSuggestions; loading: boolean };
type IntakeTermChoice = IntakeTermSelection;
type IntakeChecklistEntry = {
  decision?:boolean;
  id: string;
  label: string;
  detail: string;
  complete: boolean;
  step: 1 | 2 | 3;
  target: string;
  targetIndex?: number;
  warning?: boolean;
  pending?: boolean;
};

const EMPTY_CUSTOMER: CustomerDraft = EMPTY_CUSTOMER_FORM;
const EMPTY_INTAKE_CUSTOMER: CustomerDraft = {...EMPTY_CUSTOMER_FORM,country:"",paymentPreference:""};

const FREE_TEXT_SERVICE = "FREE_TEXT";
const EXECUTION_OPTIONS: Array<{ wert: IntakeExecution; text: string }> = [
  { wert: "hochglanz", text: "Hochglanz" },
  { wert: "glaenzend", text: "glänzend" },
  { wert: "matt", text: "matt" },
  { wert: "gelb_passiviert", text: "gelb passiviert" },
  { wert: "blau_passiviert", text: "blau passiviert" },
  { wert: "offen", text: "noch zu klären" },
];

function customerChoiceToDraft(customer: GlobalCreateCustomerChoice): CustomerDraft {
  return {...EMPTY_INTAKE_CUSTOMER,customerType:customer.customerType??"",companyName:customer.companyName??"",
    salutation:customer.salutation??"",firstName:customer.firstName??"",lastName:customer.lastName??"",contactRole:customer.contactRole??"",
    email:customer.email??"",phone:customer.phone??"",street:customer.street??"",houseNumber:customer.houseNumber??"",zipCode:customer.zipCode??"",
    city:customer.city??"",country:customer.country??"",paymentPreference:customer.paymentPreference??"",vatId:customer.vatId??"",
    handoverPreference:customer.handoverPreference??"",autoInfo:customer.autoInfo??true,vorrang:customer.vorrang??false};
}
function customerDraftFromSearch(query: string): CustomerDraft {
  const value=query.trim();
  if(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))return {...EMPTY_CUSTOMER,email:value.toLocaleLowerCase("de-DE")};
  if(validPhone(value))return {...EMPTY_CUSTOMER,phone:value};
  if(/\b(?:gmbh|ag|kg|ohg|gbr|e\.?k\.?|ug)\b/i.test(value))return {...EMPTY_CUSTOMER,customerType:"business",companyName:value};
  const words=value.split(/\s+/).filter(Boolean);
  return {...EMPTY_CUSTOMER,customerType:words.length>=2?"privat":"",firstName:words.slice(0,-1).join(" "),lastName:words.at(-1)??""};
}

function customerSearchFromRecognition(data: IntakeTextRecognition, text: string): string {
  const field = (key: IntakeTextRecognition["fields"][number]["field"]) => data.fields.find((entry) => entry.field === key)?.value.trim() ?? "";
  const email = field("email");
  if (email) return email;
  const phone = field("phone");
  if (phone) return phone;
  const companyName = field("companyName");
  if (companyName) return companyName;
  if (!field("zipCode") && !field("city")) {
    const nameWords = text.match(/[\p{L}][\p{L}'’.-]*/gu)?.filter((word) => word.length >= 4) ?? [];
    return nameWords.slice(0, 3).join(" ");
  }

  const beforePostcode = field("zipCode") ? text.split(field("zipCode"), 1)[0] ?? "" : text;
  const words = beforePostcode.match(/[\p{L}][\p{L}'’.-]*/gu) ?? [];
  const streetIndex = words.findIndex((word) => /(?:straße|strasse|str\.?|weg|platz|allee|gasse|ring|damm|ufer|chaussee)$/iu.test(word));
  const streetStartsAt = streetIndex < 0
    ? Math.min(2, words.length)
    : streetIndex - (/^(?:straße|strasse|str\.?)$/iu.test(words[streetIndex] ?? "") ? 1 : 0);
  return streetStartsAt >= 2 ? words.slice(0, streetStartsAt).join(" ") : "";
}

function validPhone(value:string|null|undefined){return Boolean(value?.trim())&&customerFieldError("phone",{...EMPTY_CUSTOMER_FORM,phone:value??""})===null;}

const newPosition = (): PositionDraft => ({
  key: globalThis.crypto.randomUUID(),
  catalogServiceId: "",
  name: "",
  quantity: "1",
  material: "",
  surfaceRequested: "offen",
  unit: "",
  unitPriceCents: null,
});

const newIntakePosition = (): IntakePositionDraft => ({
  key: globalThis.crypto.randomUUID(),
  name: "",
  quantity: "1",
  material: "",
  surfaceRequested: "offen",
  surfaceTouched: false,
  executionRequested: "offen",
  catalogServiceId: "",
  unit: null,
  unitPriceCents: null,
  vatRateBasisPoints: null,
});

function euro(cents: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(cents / 100);
}

function nullable(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isValidDateInput(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day;
}

function isPastDateInput(value: string): boolean {
  if (!isValidDateInput(value)) return false;
  const today = new Date();
  const todayInput = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return value < todayInput;
}

type IntakeComparison = {text:string;customerId:string;query:string;items:IntakePositionDraft[];kind:string;date:string;confirmed:string;term:string;handover:string;payment:string;source:string;note:string;documents:string[];geprueft?:boolean;customerFields?:CustomerFormValue;processingWeeks?:number|null;dismissedConcerns?:string[]};
function intakeComparison(value:IntakeComparison):Record<string,string>{
  return {"Erfassen-Text":value.text,"Anliegen":JSON.stringify(value.dismissedConcerns??[]),"Kunde":value.customerId,"Kundensuche":value.query,"Kundenangaben":JSON.stringify(value.customerFields??null),"Bearbeitungszeit":String(value.processingWeeks??""),
    "Teile & Leistung":JSON.stringify(value.items.map(item=>({catalogServiceId:item.catalogServiceId,name:item.name,quantity:item.quantity,unit:item.unit,surface:item.surfaceRequested,execution:item.executionRequested,material:item.material,price:item.unitPriceCents,vat:item.vatRateBasisPoints}))),
    "Art":value.kind,"Liefertermin":value.date,"Bestätigter Termin":value.confirmed,"Termin ist":value.term,"Übergabe":value.handover,"Zahlungsmodus":value.payment,"Eingangsart":value.source,"Notiz":value.note,"Dokumente":JSON.stringify(value.documents),"Gemeinsam geprüft":String(value.geprueft===true)};
}

function intakeQuantityError(item: IntakePositionDraft): string | null {
  return orderPositionQuantityError(item.quantity, item.unit);
}

function intakePriceError(item:IntakePositionDraft,required=false):string|null{
  if(item.priceText?.trim()&&!/^\d+(?:[.,]\d{1,2})?$/.test(item.priceText.trim()))return "Preis 0,01–99.999,99 €";
  return orderPositionPriceError(item.unitPriceCents,required);
}

function captureRecognitionText(capture:IntakeCapture):string {
  if(capture.recognition?.text)return capture.recognition.text;
  if(capture.text)return capture.text;
  const labels:Record<string,string>={CUSTOMER_NAME:"Firma",CONTACT_PERSON:"Ansprechpartner",EMAIL:"E-Mail",PHONE:"Telefon",ADDRESS:"Adresse",DUE_DATE:"Liefertermin",ITEM_DESCRIPTION:"Teil",QUANTITY:"Menge",MATERIAL:"Material",SURFACE:"Oberfläche"};
  return (capture.suggestions??[]).filter(value=>typeof value.value==="string"&&value.status!=="verworfen"&&value.field!=="art")
    .map(value=>(labels[value.field]??value.field)+": "+String(value.value)).join("\n");
}

function normaliseIntakeCatalog(services: CatalogServiceChoice[]): CatalogServiceChoice[] {
  return services.map(service => {
    const unit = normaliseOrderPositionUnit(service.unit);
    const surface = normaliseOrderPositionSurface(service.surface);
    if (!unit || !surface) throw new Error("INTAKE_CATALOG_POSITION_INVALID");
    return {...service,unit,surface};
  });
}

/** The customer completeness gate and the existing payment contract own this choice. */
function intakeCustomerPayment(customer: CustomerDraft, mode: "EXISTING" | "NEW", handoverMode: "pickup" | "shipping", money: boolean,
  terms?: Pick<GlobalCreateCustomerChoice, "invoiceTermsEnabled" | "invoiceTermDays">, requestedMode?: PaymentMode): PaymentMode | null {
  if (money && kundeVollstaendigkeit({ ...customer, invoiceTermsEnabled: terms?.invoiceTermsEnabled }, { geld: true }).issues.some(issue => issue.field === "paymentPreference")) return null;
  const result = intakePaymentContract({ customerMode: mode, paymentPreference: customer.paymentPreference, handoverMode,
    invoiceTermsEnabled: terms?.invoiceTermsEnabled, invoiceTermDays: terms?.invoiceTermDays, ...(requestedMode ? { requestedMode } : {}) });
  return result.ok ? result.mode : null;
}

/** Before handover, only a customer-card choice valid for both handovers is unambiguous. */
function intakePaymentBeforeHandover(customer:CustomerDraft,money:boolean,terms:GlobalCreateCustomerChoice):PaymentMode|null {
  if(!customer.paymentPreference)return null;
  const pickup=intakeCustomerPayment(customer,"EXISTING","pickup",money,terms);
  const shipping=intakeCustomerPayment(customer,"EXISTING","shipping",money,terms);
  return pickup&&pickup===shipping?pickup:null;
}

function requestFeedback(result: Failure, requestId: string): Feedback {
  if (result.code === "VALIDATION_ERROR") return { kind: "validation", message: result.message, requestId };
  if (result.code === "CUSTOMER_INCOMPLETE") return { kind: "validation", message: result.message, requestId };
  if (result.code === "FORBIDDEN" || result.code === "UNAUTHENTICATED") return { kind: "denied", message: result.message, requestId };
  if (result.code === "CONFLICT") return { kind: "conflict", message: `${result.message} Eingaben bleiben erhalten; bitte den aktuellen Stand prüfen.`, requestId };
  if (result.code === "UNAVAILABLE") {
    return {
      kind: "unclear",
      message: `${result.message} Der Ausgang ist ungeklärt. Nicht neu beginnen: zuerst mit derselben Anfragekennung den Status prüfen.`,
      requestId,
    };
  }
  return { kind: "error", message: result.message, requestId };
}

function ReceiptFacts({ title, values }: { title: string; values: Array<[string, string]> }) {
  return (
    <details className={styles.createReceipt} aria-label={title}>
      <summary>Technische Details für Support</summary>
      <dl>{values.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    </details>
  );
}

export function GlobalCreateFlow({ ports }: { ports: GlobalCreatePorts }) {
  const geraet = useKrGeraet();
  const [open, setOpen] = useState(false);
  const [handoverToken, setHandoverToken] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("choose");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [statusChecked, setStatusChecked] = useState(false);
  const [retryConfirmed, setRetryConfirmed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [customerDraft, setCustomerDraft] = useState<CustomerDraft>(EMPTY_CUSTOMER);
  const customerType=customerDraft.customerType;
  const setCustomerType=(next:CustomerDraft["customerType"])=>setCustomerDraft(current=>({...current,customerType:next}));
  const customerName=customerDisplayName(customerDraft);
  const customerSaving=useRef(false);
  const [customerAddress,setCustomerAddress]=useState<CustomerAddressResult|null>(null);
  const customerNote=customerDraft.notes;
  const setCustomerNote=(notes:string)=>setCustomerDraft(current=>({...current,notes}));
  const [customerBaseline, setCustomerBaseline] = useState({ customerType: "", customerDraft: EMPTY_CUSTOMER, customerNote: "" });
  const [customerClosePrompt, setCustomerClosePrompt] = useState(false);
  const [supplierCustomerMode,setSupplierCustomerMode]=useState(false);
  const customerLastFocus=useRef<HTMLElement|null>(null);
  const [customerRecognitionText,setCustomerRecognitionText]=useState("");
  const [customerSource,setCustomerSource]=useState<{itemId:string;version:number}|null>(null);
  const [customerOrigins,setCustomerOrigins]=useState<Partial<Record<keyof CustomerFormValue,string>>>({});
  const [customerDuplicateResults, setCustomerDuplicateResults] = useState<GlobalCreateCustomerChoice[]>([]);
  const [customerDuplicateState, setCustomerDuplicateState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [customerDuplicateAcceptedFor, setCustomerDuplicateAcceptedFor] = useState("");
  const [customer, setCustomer] = useState<GlobalCreateCustomerChoice | null>(null);
  const [customerReceipt, setCustomerReceipt] = useState<Extract<GlobalCreateCustomerResult, { code: "OK" }>["receipt"] | null>(null);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerChoices, setCustomerChoices] = useState<GlobalCreateCustomerChoice[]>([]);
  const [customerLoad, setCustomerLoad] = useState<"idle" | "loading" | "ready" | "empty" | "error">("idle");
  const [positions, setPositions] = useState<PositionDraft[]>(() => [newPosition()]);
  const [dueDate, setDueDate] = useState("");
  const [quoteNote, setQuoteNote] = useState("");
  const [confirmedOrderDueDate, setConfirmedOrderDueDate] = useState("");
  const [awardHandoverMode, setAwardHandoverMode] = useState<"pickup" | "shipping">("pickup");
  const [awardPaymentMode, setAwardPaymentMode] = useState<"vorkasse" | "abholung" | "rechnung">("rechnung");
  const [directCustomerMode, setDirectCustomerMode] = useState<"NONE" | "EXISTING" | "NEW">("NONE");
  const [intakeHandover, setIntakeHandover] = useState<"" | "PICKUP" | "SHIPPING">("");
  const [intakeHandoverOrigin, setIntakeHandoverOrigin] = useState<"customer-card" | "last-order" | null>(null);
  const [intakeKind, setIntakeKind] = useState<"" | "auftrag" | "kv">("");

  const [intakeTermStatus, setIntakeTermStatus] = useState<"" | "wish" | "confirmed" | "counter">("");
  const [intakeSource, setIntakeSource] = useState<"" | "persoenlich" | "versand" | "abholung_firma" | "anfrage_mail" | "anfrage_telefon">("");
  const [directCustomer, setDirectCustomer] = useState<CustomerDraft>(EMPTY_INTAKE_CUSTOMER);
  const [directCustomerId, setDirectCustomerId] = useState("");
  const [intakeCustomerQuery, setIntakeCustomerQuery] = useState("");
  const [intakeCustomerResults, setIntakeCustomerResults] = useState<GlobalCreateCustomerChoice[]>([]);
  const [intakeCustomerSearchState, setIntakeCustomerSearchState] = useState<"idle" | "loading" | "ready" | "empty" | "error">("idle");
  const [intakeCustomerOverlayId, setIntakeCustomerOverlayId] = useState<string | null>(null);
  const [intakeOrigin, setIntakeOrigin] = useState<"customer-card" | null>(null);
  const [intakeSourceOrigin, setIntakeSourceOrigin] = useState<string | null>(null);
  const [intakePaymentMode, setIntakePaymentMode] = useState<PaymentMode | "">("");
  const [intakePaymentOrigin, setIntakePaymentOrigin] = useState<"customer-card" | "customer-input" | "shipping" | "manual" | null>(null);
  const [directItems, setDirectItems] = useState<IntakePositionDraft[]>(() => [newIntakePosition()]);
  const [catalogServices, setCatalogServices] = useState<CatalogServiceChoice[]>([]);
  const [directWishDate, setDirectWishDate] = useState("");
  const [intakeWishDateOrigin, setIntakeWishDateOrigin] = useState<"empty" | "recognized" | "manual">("empty");
  const [directConfirmedDate, setDirectConfirmedDate] = useState("");
  const [directNote, setDirectNote] = useState("");
  const [intakeRecognitionText, setIntakeRecognitionText] = useState("");
  const [intakeDismissedConcerns, setIntakeDismissedConcerns] = useState<string[]>([]);
  const intakeConcerns = recognizeNoteConcerns(intakeRecognitionText).filter(concern => !intakeDismissedConcerns.includes(concern.id));
  const [lastRecognizedText, setLastRecognizedText] = useState("");
  const [recognitionBusy, setRecognitionBusy] = useState(false);
  const [recognitionOverflow, setRecognitionOverflow] = useState<{ total: number; adopted: number; saved: number; text: string; items: IntakePositionDraft[] } | null>(null);
  const overflowRequest = useRef<Parameters<IntakeDraftPorts["saveDraft"]>[0] | null>(null);
  const [recognitionMarkers, setRecognitionMarkers] = useState<Array<{ key: string; label: string; value: string; source: string }>>([]);
  const [recognitionConfirmed, setRecognitionConfirmed] = useState(false);
  const [intakeSuggestionState, setIntakeSuggestionState] = useState<IntakeSuggestionState>({ kind: "idle" });
  const [intakeProcessingWeeks,setIntakeProcessingWeeks]=useState<1|2|3|5|null>(null);
  const [intakeTermOrigin,setIntakeTermOrigin]=useState<IntakeTermOrigin|null>(null);
  const [intakeTermExpired,setIntakeTermExpired]=useState(false);
  const intakeTermManuallySet=useRef(false);
  const [intakeTermChoice, setIntakeTermChoice] = useState<IntakeTermChoice | null>(null);
  const [intakeClientKey, setIntakeClientKey] = useState(() => globalThis.crypto.randomUUID());
  const prospectPending=useRef<IntakeProspectInput|null>(null);
  const [lastIntakeAction,setLastIntakeAction]=useState<'book'|'prospect'>('book');
  const [intakeBaseline, setIntakeBaseline] = useState<Record<string,string> | null>(null);
  const intakeLastFocus=useRef<HTMLElement|null>(null);
  const [intakeClosePrompt, setIntakeClosePrompt] = useState(false);
  const [intakeToast, setIntakeToast] = useState<string | null>(null);
  const [captureInIntake,setCaptureInIntake]=useState<false|"eingang"|"datei"|"eingangsfoto"|"visitenkarte">(false);
  const [intakeChecked,setIntakeChecked]=useState(false);
  const [activeDraft,setActiveDraft]=useState<IntakeDraft|null>(null);
  const draftOperation=useRef<string|null>(null);
  const draftWorking=useRef(false);
  const intakeTextStand=useRef(crypto.randomUUID());
  const intakeHasGoods=["persoenlich","versand","abholung_firma"].includes(intakeSource);
  const [intakeSourceCaptures,setIntakeSourceCaptures]=useState<IntakeCapture[]>([]);
  const customerFieldsDirty=directCustomerMode==="NEW"||directCustomerMode==="EXISTING"&&customerChoices.some(choice=>choice.id===directCustomerId&&JSON.stringify(customerChoiceToDraft(choice))!==JSON.stringify(directCustomer));
  const intakeCurrent=intakeComparison({dismissedConcerns:intakeDismissedConcerns,processingWeeks:intakeProcessingWeeks,...(customerFieldsDirty?{customerFields:directCustomer}:{}),text:intakeRecognitionText,customerId:directCustomerId,query:directCustomerId?"":intakeCustomerQuery,items:directItems,kind:intakeKind,date:directWishDate,confirmed:directConfirmedDate,term:intakeTermStatus,handover:intakeHandover,payment:ports.canManageMoney?intakePaymentMode:"",source:intakeSource,note:directNote,documents:intakeSourceCaptures.map(capture=>capture.id),geprueft:intakeChecked});
  const intakeChangedLabels=intakeBaseline?Object.keys(intakeCurrent).filter(label=>intakeCurrent[label]!==intakeBaseline[label]):[];
  const intakeDirty=intakeChangedLabels.length>0;
  const [quote, setQuote] = useState<QuoteReadback | null>(null);
  const [quoteReceipt, setQuoteReceipt] = useState<(QuoteCreateReceipt | QuoteUpdateReceipt) | null>(null);
  const [openQuotesState, setOpenQuotesState] = useState<OpenQuotesState>({ kind: "idle" });
  const [conversion, setConversion] = useState<Extract<GlobalCreateConversionResult, { code: "OK" }> | null>(null);
  const requestIds = useRef({ customer: "", quote: "", conversion: "", directCustomer: "" });
  const customerRequestSeq = useRef(0);
  const intakeCustomerSearchSeq = useRef(0);
  const intakeRecognizedQuery = useRef<string | null>(null);
  const customerDuplicateSearchSeq = useRef(0);
  const intakeSuggestionSeq = useRef(0);
  const directIntakeInFlight = useRef(false);
  const intakeCustomerOverlayWasOpen = useRef(false);
  const dialogRef = useRef<HTMLElement>(null);
  const confirmedOrderDueDateValid = isValidDateInput(confirmedOrderDueDate);
  const customerCompleteForOrder = kundeVollstaendigkeit(customerDraft, { geld: true }).vollstaendig;
  const activeCustomerOverlayId = ports.activeCustomerOverlayId;
  const listCustomers = ports.listCustomers;
  const customerReadiness=kundeVollstaendigkeit(customerDraft,{geld:ports.canManageMoney});
  const customerOrderMissingFields = customerReadiness.fehlt;
  const selectedCustomerOriginal=customerChoices.find(choice=>choice.id===directCustomerId);
  const inlineMissingFields=selectedCustomerOriginal?kundeVollstaendigkeit(customerChoiceToDraft(selectedCustomerOriginal),{geld:ports.canManageMoney}).issues.map(issue=>issue.field):[];
  const directCustomerReadiness = kundeVollstaendigkeit({...directCustomer,invoiceTermsEnabled:customerChoices.find(choice=>choice.id===directCustomerId)?.invoiceTermsEnabled}, { geld: ports.canManageMoney });
  const intakePaymentChoices = useMemo(() => {
    const unavailable = {
      vorkasse: { allowed: false, reason: "Zuerst Kunde und Übergabe wählen." },
      abholung: { allowed: false, reason: "Zuerst Kunde und Übergabe wählen." },
      rechnung: { allowed: false, reason: "Zuerst Kunde und Übergabe wählen." },
    } satisfies Record<PaymentMode, { allowed: boolean; reason: string | null }>;
    if (directCustomerMode === "NONE" || !intakeHandover) return unavailable;
    const check = (requestedMode: PaymentMode) => intakePaymentContract({
      customerMode: directCustomerMode === "NEW" ? "NEW" : "EXISTING",
      paymentPreference: directCustomer.paymentPreference,
      invoiceTermsEnabled:customerChoices.find(entry=>entry.id===directCustomerId)?.invoiceTermsEnabled,invoiceTermDays:customerChoices.find(entry=>entry.id===directCustomerId)?.invoiceTermDays,
      handoverMode: intakeHandover === "PICKUP" ? "pickup" : "shipping",
      requestedMode,
    });
    const result = {} as Record<PaymentMode, { allowed: boolean; reason: string | null }>;
    for (const mode of ["vorkasse", "abholung", "rechnung"] as const) {
      const contract = check(mode);
      result[mode] = contract.ok
        ? { allowed: true, reason: null }
        : { allowed: false, reason: contract.message };
    }
    return result;
  }, [directCustomer.paymentPreference, directCustomerId, directCustomerMode, intakeHandover,customerChoices]);
  const customerCoreComplete = Object.keys(kundeValidierung(customerDraft)).length===0;
  const customerChanged = JSON.stringify({ customerType, customerDraft, customerNote }) !== JSON.stringify(customerBaseline);
  const customerDuplicateQueries = useMemo(() => [customerName, customerDraft.phone, customerDraft.email, customerDraft.city]
    .map((value) => value?.trim() ?? "")
    .filter((value, index, values) => value.length >= 2 && values.indexOf(value) === index), [customerDraft.city, customerDraft.email, customerName, customerDraft.phone]);
  const customerDuplicateCandidate=useMemo<CustomerComparisonValue>(()=>({customerType:customerDraft.customerType,companyName:customerDraft.companyName,firstName:customerDraft.firstName,lastName:customerDraft.lastName,phone:customerDraft.phone,email:customerDraft.email,street:customerDraft.street,houseNumber:customerDraft.houseNumber,zipCode:customerDraft.zipCode,city:customerDraft.city}),[customerDraft.customerType,customerDraft.companyName,customerDraft.firstName,customerDraft.lastName,customerDraft.phone,customerDraft.email,customerDraft.street,customerDraft.houseNumber,customerDraft.zipCode,customerDraft.city]);
  const customerDuplicateQuery = customerDuplicateQueries.join("|")+JSON.stringify(customerDuplicateCandidate);
  const customerDuplicateOpen = customerDuplicateResults.length > 0
    && customerDuplicateAcceptedFor !== customerDuplicateQuery;
  const intakeSuggestionBasisKey = useMemo(() => JSON.stringify({
    kind: intakeKind === "kv"?"QUOTE":"ORDER",handover:intakeHandover,weeks:intakeProcessingWeeks,
    customerId: directCustomerMode === "EXISTING" ? directCustomerId : null,
    positions: directItems.map((item) => ({
      key: item.key,
      catalogServiceId: item.catalogServiceId === FREE_TEXT_SERVICE ? null : item.catalogServiceId,
      name: item.name.trim(),
      quantity: Number(item.quantity.replace(",", ".")),
      surfaceRequested: item.surfaceRequested.trim(),
      unit: item.unit,
      unitPriceCents: item.unitPriceCents,
    })),
  }), [directCustomerId, directCustomerMode, directItems,intakeKind,intakeHandover,intakeProcessingWeeks]);

  const requestId = (kind: keyof typeof requestIds.current) => {
    if (!requestIds.current[kind]) requestIds.current[kind] = globalThis.crypto.randomUUID();
    return requestIds.current[kind];
  };

  const resetAwardDateForQuoteContext = () => {
    setConfirmedOrderDueDate("");
  };

  const navigate = (next: Step) => {
    setFeedback(null);
    setCopied(false);
    setStatusChecked(false);
    setRetryConfirmed(false);
    setStep(next);
  };

  useEffect(()=>{
    if(!open||step!=="customer")return;
    let active=true;
    const timer=window.setTimeout(()=>{
      const input={country:customerDraft.country,zipCode:customerDraft.zipCode,city:customerDraft.city,street:customerDraft.street,houseNumber:customerDraft.houseNumber};
      if(!ports.checkCustomerAddress){setCustomerAddress({kind:"unavailable",message:"Prüfung gerade nicht möglich – wird beim Speichern geprüft",status:null,blocked:false,suggestions:[]});return;}
      void ports.checkCustomerAddress(input).then(result=>{if(!active)return;if(result.code==="OK"&&"data" in result)setCustomerAddress(result.data);else setCustomerAddress({kind:"unavailable",message:"message" in result?result.message:"Adressprüfung nicht verfügbar",status:null,blocked:false,suggestions:[]});}).catch(error=>{
        console.error("[CUSTOMER_ADDRESS_REQUEST_FAILED]",{errorName:error instanceof Error?error.name:"UnknownError"});
        if(active)setCustomerAddress({kind:"unavailable",message:"Prüfung gerade nicht möglich – wird beim Speichern geprüft",status:null,blocked:false,suggestions:[]});
      });
    },250);
    return()=>{active=false;window.clearTimeout(timer)};
  },[open,step,ports,customerDraft.country,customerDraft.zipCode,customerDraft.city,customerDraft.street,customerDraft.houseNumber]);

  useLayoutEffect(() => {
    if (!open) return;
    const formId = step === "customer" ? "kr-kunde-anlegen" : step === "direct-intake" ? "kr-neuer-eingang" : null;
    const root = (formId ? document.getElementById(formId)?.closest<HTMLElement>("[role='dialog']") : null)
      ?? dialogRef.current ?? document.querySelector<HTMLElement>("[role='dialog']");
    const target = root?.querySelector<HTMLElement>("[data-autofocus]")
      ?? root?.querySelector<HTMLElement>("input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])");
    target?.focus();
  }, [directCustomerMode, open, step]);

  useEffect(()=>{
    if(!open||step!=="direct-intake"||directCustomerMode!=="NEW")return;
    const name=customerDisplayName(directCustomer),query=name.trim().length>=2?name:directCustomer.phone||directCustomer.email;
    const sequence=++intakeCustomerSearchSeq.current;
    const timer=setTimeout(()=>{
      if(query.trim().length<2){setIntakeCustomerResults([]);setIntakeCustomerSearchState("idle");return;}
      setIntakeCustomerSearchState("loading");
      void ports.searchIntakeCustomers(query,{customerType:directCustomer.customerType,companyName:directCustomer.companyName,firstName:directCustomer.firstName,lastName:directCustomer.lastName,phone:directCustomer.phone,email:directCustomer.email,street:directCustomer.street,houseNumber:directCustomer.houseNumber,zipCode:directCustomer.zipCode,city:directCustomer.city}).then(result=>{
       if(sequence!==intakeCustomerSearchSeq.current)return;
       if(result.code!=="OK"){setIntakeCustomerSearchState("error");setFeedback({kind:"error",message:result.message});return;}
       setIntakeCustomerResults(result.customers.slice(0,3));setIntakeCustomerSearchState(result.customers.length?"ready":"empty");
      }).catch(error=>{console.error("[INTAKE_INLINE_DUPLICATE_SEARCH_FAILED]",error);if(sequence===intakeCustomerSearchSeq.current){setIntakeCustomerSearchState("error");setFeedback({kind:"error",message:"Dublettenprüfung nicht verfügbar · Code: INTAKE_INLINE_DUPLICATE_SEARCH_FAILED."});}});
    },250);
    return()=>clearTimeout(timer);
  },[open,step,directCustomerMode,directCustomer,ports]);

  useEffect(() => {
    if (!open || step !== "direct-intake" || directCustomerMode !== "NONE") return;
    const query = intakeCustomerQuery.trim();
    if (query.length < 2) return;
    if (intakeRecognizedQuery.current === query) {
      intakeRecognizedQuery.current = null;
      return;
    }
    const sequence = ++intakeCustomerSearchSeq.current;
    const timer = window.setTimeout(() => {
      setIntakeCustomerSearchState("loading");
      void ports.searchIntakeCustomers(query).then((result) => {
        if (sequence !== intakeCustomerSearchSeq.current) return;
        if (result.code !== "OK") {
          setIntakeCustomerResults([]);
          setIntakeCustomerSearchState("error");
          setFeedback({ kind: result.code === "DENIED" ? "denied" : "error", message: result.message });
          return;
        }
        setIntakeCustomerResults(result.customers.slice(0, 3));
        setIntakeCustomerSearchState(result.customers.length > 0 ? "ready" : "empty");
      }).catch(() => {
        if (sequence !== intakeCustomerSearchSeq.current) return;
        setIntakeCustomerResults([]);
        setIntakeCustomerSearchState("error");
        setFeedback({ kind: "error", message: "Die Kundensuche ist derzeit nicht verfügbar." });
      });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [directCustomerMode, intakeCustomerQuery, open, ports, step]);

  useEffect(()=>{
    if(!open||step!=="direct-intake")return;
    const positions=directItems.map(item=>({key:item.key,catalogServiceId:item.catalogServiceId===FREE_TEXT_SERVICE?null:item.catalogServiceId,name:item.name.trim(),quantity:Number(item.quantity.replace(",",".")),surfaceRequested:item.surfaceRequested.trim(),unit:item.unit,unitPriceCents:item.unitPriceCents}));
    const ready=positions.length>0&&positions.every(position=>position.name.length>=2&&orderPositionQuantityError(position.quantity,position.unit)===null&&normaliseOrderPositionSurface(position.surfaceRequested)!==null);
    if(!ready){const clear=setTimeout(()=>setIntakeSuggestionState({kind:"idle"}),0);return()=>clearTimeout(clear);}
    if(intakeTermChoice?.basisKey===intakeSuggestionBasisKey)return;
    const sequence=++intakeSuggestionSeq.current;
    const wish=intakeTermChoice?intakeTermChoice.achievableDate:/^\d{4}-\d{2}-\d{2}$/.test(directWishDate)?directWishDate:null;
    const timer=setTimeout(()=>{
      setIntakeSuggestionState(current=>current.kind==="data"?{...current,loading:true}:{kind:"loading"});
      const timeout=setTimeout(()=>{if(sequence===intakeSuggestionSeq.current){intakeSuggestionSeq.current+=1;setIntakeSuggestionState({kind:"error"});}},10_000);
      void ports.getIntakeSuggestions({customerId:directCustomerMode==="EXISTING"?directCustomerId||null:null,kind:intakeKind==="kv"?"QUOTE":"ORDER",wishDate:wish,positions,processingWeeks:intakeProcessingWeeks,handoverMode:intakeHandover?intakeHandover==="PICKUP"?"pickup":"shipping":null}).then(result=>{
        clearTimeout(timeout);if(sequence!==intakeSuggestionSeq.current)return;
        if(result.code!=="OK"){setIntakeSuggestionState({kind:"error"});return;}
        setIntakeSuggestionState({kind:"data",data:result.data,loading:false});const term=result.data.term;
        if(intakeTermChoice){
          if(intakeTermChoice.kind==="kept"||intakeTermChoice.kind==="kv")return;
          if(!term?.achievableDate||term.rating==="nicht_machbar"||term.rating==="unmoeglich"){
            setIntakeTermChoice(null);setIntakeTermOrigin(null);setIntakeTermStatus("wish");setIntakeTermExpired(true);
          }else setIntakeTermChoice(current=>current?{...current,basisKey:intakeSuggestionBasisKey}:null);
        }else if(term&&directWishDate&&!intakeTermManuallySet.current){
          if(term.rating==="passt"||term.rating==="knapp"){setIntakeTermStatus("confirmed");setIntakeTermOrigin(term.rating==="passt"?"wunsch_passt":"wunsch_knapp");}
          else {setIntakeTermStatus("wish");setIntakeTermOrigin(null);}
        }
      }).catch(error=>{clearTimeout(timeout);console.error("[INTAKE_TERM_READ_FAILED]",error);if(sequence===intakeSuggestionSeq.current)setIntakeSuggestionState({kind:"error"});});
    },250);
    return()=>{clearTimeout(timer);intakeSuggestionSeq.current+=1;};
  },[open,step,directItems,directCustomerId,directCustomerMode,directWishDate,intakeSuggestionBasisKey,intakeTermChoice,intakeProcessingWeeks,intakeHandover,intakeKind,ports]);

  useEffect(() => {
    if (!open || step !== "customer") return;
    const queries = customerDuplicateQueries;
    if (queries.length === 0) {
      const clearTimer = window.setTimeout(() => {
        setCustomerDuplicateResults([]);
        setCustomerDuplicateState("idle");
      }, 0);
      return () => window.clearTimeout(clearTimer);
    }
    const sequence = ++customerDuplicateSearchSeq.current;
    const timer = window.setTimeout(() => {
      setCustomerDuplicateState("loading");
      void Promise.all(queries.map((query) => ports.searchIntakeCustomers(query,customerDuplicateCandidate))).then((results) => {
        if (sequence !== customerDuplicateSearchSeq.current) return;
        if (results.some((result) => result.code !== "OK")) {
          setCustomerDuplicateResults([]);
          setCustomerDuplicateState("error");
          return;
        }
        const customers = results.flatMap((result) => result.code === "OK" ? result.customers : []);
        setCustomerDuplicateResults(customers.filter((customer, index) => customers.findIndex((entry) => entry.id === customer.id) === index).slice(0, 10));
        setCustomerDuplicateState("ready");
      }).catch(error => {
        console.error("[CUSTOMER_DUPLICATE_SEARCH_FAILED]",{errorName:error instanceof Error?error.name:"UnknownError"});
        if (sequence !== customerDuplicateSearchSeq.current) return;
        setCustomerDuplicateResults([]);
        setCustomerDuplicateState("error");
      });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [customerDuplicateQueries,customerDuplicateCandidate, open, ports, step]);

  useEffect(() => {
    if (!intakeToast) return;
    const timer = window.setTimeout(() => setIntakeToast(null), 3_000);
    return () => window.clearTimeout(timer);
  }, [intakeToast]);

  const closeNow = () => {
    if (!busy) {
      setCustomerClosePrompt(false);
      setOpen(false);
    }
  };

  const closeCustomerNow = () => {
    if (busy) return;
    setCustomerClosePrompt(false);
    setOpen(false);
  };

  const requestCustomerClose = () => {
    if (busy) return;
    if (customerChanged) {customerLastFocus.current=document.activeElement instanceof HTMLElement?document.activeElement:null;setCustomerClosePrompt(true);}
    else closeCustomerNow();
  };

  const requestClose = () => {
    if (busy || intakeClosePrompt || intakeCustomerOverlayId) return;
    if (step === "direct-intake" && intakeDirty) {
      intakeLastFocus.current=document.activeElement instanceof HTMLElement?document.activeElement:null;
      setIntakeClosePrompt(true);
      return;
    }
    closeNow();
  };

  const discardIntake = async () => {
    if(draftWorking.current)return;
    if(intakeRecognitionText.trim()){
      try { await saveIntakeTextOriginal(); }
      catch(cause){console.error("[INTAKE_ORIGINAL_BEFORE_DISCARD_FAILED]",cause);setFeedback({kind:"error",message:"Original konnte nicht gesichert werden · Eingaben bleiben erhalten. Code: INTAKE_ORIGINAL_BEFORE_DISCARD_FAILED."});return;}
    }
    if(activeDraft){
      if(!ports.drafts){setFeedback({kind:"error",message:"Entwurf ist nicht verbunden. Code: INTAKE_DRAFT_PORT_UNAVAILABLE."});return;}
      draftWorking.current=true;setBusy(true);
      try {
        const result=await ports.drafts.discardDraft({id:activeDraft.id,clientEventId:draftOperation.current??=crypto.randomUUID(),expectedVersion:activeDraft.version});
        if(result.code!=="OK"){setFeedback({kind:"error",message:result.message});return;}
        window.dispatchEvent(new Event("kreile:intake-drafts-changed"));
      }catch(cause){console.error("[INTAKE_DRAFT_DISCARD_REQUEST_FAILED]",cause);setFeedback({kind:"error",message:"Entwurf konnte nicht verworfen werden. Code: INTAKE_DRAFT_DISCARD_REQUEST_FAILED."});return;}
      finally{draftWorking.current=false;setBusy(false);}
    }
    reset();
    setHandoverToken(null);
    setIntakeClosePrompt(false);
    setOpen(false);
    setIntakeToast("Entwurf verworfen");
  };

  const handleDialogKey = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      requestClose();
      return;
    }
    if (event.key !== "Tab" || !dialogRef.current) return;
    const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href]")];
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable.at(-1)!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const deny = (kind: "customer" | "quote") => {
    setFeedback({
      kind: "denied",
      message: kind === "customer"
        ? `Das Profil ${ports.roleLabel} darf keine Kunden anlegen. Eine freigegebene Person ist für diesen Vorgang zuständig.`
        : `Das Profil ${ports.roleLabel} darf keinen KV oder Auftrag anlegen. Eine freigegebene Person ist für diesen Vorgang zuständig.`,
    });
    setStep("denied");
  };

  const loadCustomers = async () => {
    if (!ports.canCreateQuote) {
      deny("quote");
      return;
    }
    navigate("customer-picker");
    setCustomerLoad("loading");
    const seq = ++customerRequestSeq.current;
    try {
      const [result, catalog] = await Promise.all([
        ports.listCustomers(),
        ports.listCatalog?.() ?? Promise.resolve({ code: "UNAVAILABLE" as const, message: "Leistungskatalog ist nicht angebunden." }),
      ]);
      if (seq !== customerRequestSeq.current) return;
      if (result.code !== "OK") {
        setCustomerLoad("error");
        setFeedback({ kind: result.code === "DENIED" ? "denied" : "error", message: result.message });
        return;
      }
      if (catalog.code !== "OK") {
        setCustomerLoad("error");
        setFeedback({ kind: catalog.code === "DENIED" ? "denied" : "error", message: catalog.message });
        return;
      }
      setCatalogServices(normaliseIntakeCatalog(catalog.services));
      setCustomerChoices(result.customers);
      setCustomerLoad(result.customers.length > 0 ? "ready" : "empty");
    } catch {
      if (seq !== customerRequestSeq.current) return;
      setCustomerLoad("error");
      setFeedback({ kind: "error", message: "Der Kundenstamm konnte nicht sicher gelesen werden. Es wurde nichts angelegt." });
    }
  };

  const loadDirectIntake = async (preselectedCustomerId?: string, fromCustomerCard = false, orderCopyId?: string, sourceCapture?: IntakeCapture, sourceEntry?:{itemId:string;kind:'auftrag'|'kv'}) => {
    if (!ports.canCreateOrder) {
      deny("quote");
      return;
    }
    setIntakeChecked(false);setActiveDraft(null);draftOperation.current=null;
    const initial:IntakeComparison={text:sourceCapture?captureRecognitionText(sourceCapture):"",customerId:"",query:"",items:[newIntakePosition()],kind:fromCustomerCard?"auftrag":"",date:"",confirmed:"",term:"",handover:"",payment:"",source:"",note:"",documents:sourceCapture?[sourceCapture.id]:[]};
    setDirectItems(initial.items);setDirectWishDate("");setDirectConfirmedDate("");setDirectNote("");setIntakeRecognitionText(initial.text);setLastRecognizedText("");setRecognitionMarkers([]);setRecognitionConfirmed(false);setIntakeSuggestionState({kind:"idle"});setIntakeTermChoice(null);
    setCaptureInIntake(false);setIntakeSourceCaptures(sourceCapture?[sourceCapture]:[]);
    setDirectCustomerMode("NONE");
    setDirectCustomerId("");
    setDirectCustomer(EMPTY_INTAKE_CUSTOMER);
    setIntakeCustomerQuery("");
    setIntakeCustomerResults([]);
    setIntakeCustomerSearchState("idle");
    setIntakeCustomerOverlayId(null);
    setIntakeOrigin(fromCustomerCard ? "customer-card" : null);
    setIntakeClientKey(globalThis.crypto.randomUUID());
    setIntakeHandover("");
    setIntakeHandoverOrigin(null);
    setIntakeKind(fromCustomerCard ? "auftrag" : "");
    setIntakePaymentMode("");
    setIntakePaymentOrigin(null);
    setIntakeSource("");
    setIntakeSourceOrigin(null);
    setIntakeDismissedConcerns([]);
    setIntakeTermStatus("");setIntakeProcessingWeeks(null);setIntakeTermOrigin(null);setIntakeTermExpired(false);intakeTermManuallySet.current=false;
    setIntakeBaseline(intakeComparison(initial));
    setIntakeClosePrompt(false);
    setOpen(true);
    navigate("direct-intake");
    setCustomerLoad("loading");
    const seq = ++customerRequestSeq.current;
    try {
      let loadedSourceCapture:IntakeCapture|null=sourceCapture??null;
      if(sourceEntry){
        const read=await ports.getCapture?.(sourceEntry.itemId);if(seq!==customerRequestSeq.current)return;
        if(!read||read.code!=='OK'){setCustomerLoad('error');setFeedback({kind:'error',message:read?.message??'Original ist nicht lesbar · INTAKE_SOURCE_CAPTURE_UNAVAILABLE.'});return;}
        loadedSourceCapture=read.capture;preselectedCustomerId=loadedSourceCapture.customerId??preselectedCustomerId;
      }
      let source: Extract<Awaited<ReturnType<NonNullable<GlobalCreatePorts["readIntakeOrderSource"]>>>, { code: "OK" }>["source"] | null = null;
      if (orderCopyId) {
        const read = await ports.readIntakeOrderSource?.(orderCopyId);
        if (seq !== customerRequestSeq.current) return;
        if (!read || read.code !== "OK") {
          setCustomerLoad("error");
          setFeedback({ kind: "error", message: read?.message ?? "Ursprungsauftrag ist nicht lesbar · INTAKE_COPY_PORT_UNAVAILABLE." });
          return;
        }
        source = read.source;
        preselectedCustomerId = source.customerId;
        if (source.items.some((item) => !item.executionRequested || !normaliseOrderPositionSurface(item.surfaceRequested))) {
          setCustomerLoad("error");
          setFeedback({ kind: "error", message: "Ausführung oder Oberfläche im Ursprungsauftrag fehlt · ORDER_COPY_POSITION_INVALID." });
          return;
        }
      }
      const [result, catalog] = await Promise.all([
        source ? ports.searchIntakeCustomers(source.customerQuery) : preselectedCustomerId
          ? ports.listCustomers()
          : Promise.resolve({ code: "OK" as const, customers: [] }),
        ports.listCatalog?.() ?? Promise.resolve({ code:"UNAVAILABLE" as const, message:"Leistungskatalog ist nicht angebunden." }),
      ]);
      if (seq !== customerRequestSeq.current) return;
      if (result.code !== "OK") {
        setFeedback({ kind: result.code === "DENIED" ? "denied" : "error", message: result.message });
        return;
      }
      if (catalog.code !== "OK") {
        setFeedback({ kind: catalog.code === "DENIED" ? "denied" : "error", message: catalog.message });
        return;
      }
      setCatalogServices(normaliseIntakeCatalog(catalog.services));
      setCustomerChoices(result.customers);
      setCustomerLoad(result.customers.length ? "ready" : "empty");
      const captureInitial=loadedSourceCapture?{text:captureRecognitionText(loadedSourceCapture),documents:[loadedSourceCapture.id],...(sourceEntry?{kind:sourceEntry.kind==='kv'&&ports.canManageMoney?'kv' as const:'auftrag' as const}:{})}:{};
      if(loadedSourceCapture){setIntakeSourceCaptures([loadedSourceCapture]);setIntakeRecognitionText(captureRecognitionText(loadedSourceCapture));setRecognitionConfirmed(false);if(sourceEntry)setIntakeKind(sourceEntry.kind==='kv'&&ports.canManageMoney?'kv':'auftrag');}
      const copiedItems = source?.items.map((item) => ({ ...newIntakePosition(),
        catalogServiceId: item.catalogServiceId ?? FREE_TEXT_SERVICE, name: item.name, quantity: String(item.quantity),
        material: item.material ?? "", surfaceRequested: normaliseOrderPositionSurface(item.surfaceRequested)!, surfaceTouched: true,
        executionRequested: item.executionRequested!, unit: item.unit === null ? null : normaliseOrderPositionUnit(item.unit),
        unitPriceCents: ports.canManageMoney ? item.unitPriceCents : null,
        vatRateBasisPoints: ports.canManageMoney ? item.vatRateBasisPoints : null,
      }));
      if (source && copiedItems) {
        setDirectItems(copiedItems);
        setIntakeKind("auftrag");
        setIntakeSource(source.intakeSource ?? "");
        setIntakeSourceOrigin(source.intakeSource ? source.orderNumber : null);
      }
      let preselected = preselectedCustomerId
        ? result.customers.find((entry) => entry.id === preselectedCustomerId)
        : undefined;
      if (preselected && !source && !preselected.handoverPreference) {
        const fresh = await ports.searchIntakeCustomers(preselected.customerNumber ?? preselected.name);
        if (seq !== customerRequestSeq.current) return;
        if (fresh.code !== "OK") throw new Error("INTAKE_CUSTOMER_HISTORY_UNAVAILABLE");
        preselected = fresh.customers.find(entry => entry.id === preselectedCustomerId);
        if (!preselected) throw new Error("INTAKE_CUSTOMER_HISTORY_NOT_FOUND");
      }
      if (preselected) {
        setDirectCustomerId(preselected.id);
        const draftCustomer = customerChoiceToDraft(preselected);
        setDirectCustomer(draftCustomer);
        setDirectCustomerMode("EXISTING");
        const handover = preselected.handoverPreference ?? preselected.lastHandoverMode;
        const payment = handover ? intakeCustomerPayment(draftCustomer, "EXISTING", handover, ports.canManageMoney, preselected) : intakePaymentBeforeHandover(draftCustomer,ports.canManageMoney,preselected);
        const initialHandover = handover === "pickup" ? "PICKUP" : handover === "shipping" ? "SHIPPING" : "";
        const initialPayment = payment ?? "";
        setIntakeHandover(initialHandover);
        setIntakeHandoverOrigin(initialHandover ? preselected.handoverPreference ? "customer-card" : "last-order" : null);
        setIntakePaymentMode(initialPayment);
        setIntakePaymentOrigin(initialPayment ? "customer-card" : null);
        setIntakeBaseline(intakeComparison({...initial,...captureInitial,customerId:preselected.id,handover:initialHandover,payment:ports.canManageMoney?initialPayment:"",
          ...(source && copiedItems ? {items:copiedItems,kind:"auftrag",source:source.intakeSource ?? ""} : {})}));
      } else if (source) {
        setFeedback({ kind: "error", message: "Kunde des Ursprungsauftrags ist nicht lesbar · ORDER_COPY_CUSTOMER_UNAVAILABLE." });
      } else if(loadedSourceCapture){
        setIntakeBaseline(intakeComparison({...initial,...captureInitial}));
      }
    } catch (error) {
      console.error("[INTAKE_SOURCE_LOAD_FAILED]", { code: "INTAKE_SOURCE_LOAD_FAILED", errorName: error instanceof Error ? error.name : "UNKNOWN" });
      if (seq === customerRequestSeq.current) setFeedback({ kind: "error", message: "Die vorhandenen Kunden konnten nicht sicher gelesen werden. Es wurde nichts angelegt. Fehlercode: INTAKE_SOURCE_LOAD_FAILED." });
    }
  };

  function reset() {
    setCustomerSource(null);
    prospectPending.current=null;setLastIntakeAction('book');
    setIntakeChecked(false);setActiveDraft(null);draftOperation.current=null;
    setSupplierCustomerMode(false);setCustomerRecognitionText("");setCustomerOrigins({});setCustomerAddress(null);
    setStep("choose");
    setFeedback(null);
    setCustomerType("");
    setCustomerDraft(EMPTY_CUSTOMER);
    setCustomerNote("");
    setCustomerBaseline({ customerType: "", customerDraft: EMPTY_CUSTOMER, customerNote: "" });
    setCustomerClosePrompt(false);
    setCustomerDuplicateResults([]);
    setCustomerDuplicateState("idle");
    setCustomerDuplicateAcceptedFor("");
    setCustomer(null);
    setCustomerReceipt(null);
    setPositions([newPosition()]);
    setDueDate("");
    setQuoteNote("");
    setConfirmedOrderDueDate("");
    setAwardHandoverMode("pickup");
    setAwardPaymentMode("rechnung");
    setQuote(null);
    setQuoteReceipt(null);
    setConversion(null);
    setIntakeClientKey(globalThis.crypto.randomUUID());
    setDirectCustomer(EMPTY_INTAKE_CUSTOMER);
    setDirectCustomerId("");
    setDirectCustomerMode("NONE");
    setIntakeSourceOrigin(null);
    setIntakeDismissedConcerns([]);
    setIntakeCustomerQuery("");
    setIntakeCustomerResults([]);
    setIntakeCustomerSearchState("idle");
    setIntakeCustomerOverlayId(null);
    setIntakeOrigin(null);
    setIntakeHandoverOrigin(null);
    setIntakePaymentMode("");
    setIntakePaymentOrigin(null);
    setDirectItems([newIntakePosition()]);
    setDirectWishDate("");
    setIntakeWishDateOrigin("empty");
    setDirectConfirmedDate("");
    setDirectNote("");
    setIntakeRecognitionText("");
    setLastRecognizedText("");
    setRecognitionBusy(false);
    setRecognitionOverflow(null);
    overflowRequest.current=null;
    setRecognitionMarkers([]);
    setRecognitionConfirmed(false);
    setIntakeHandover("");
    setIntakeKind("");
    setIntakeSource("");
    setIntakeTermStatus("");
    setIntakeSuggestionState({ kind: "idle" });
    setIntakeTermChoice(null);
    setIntakeBaseline(null);
    setIntakeClosePrompt(false);
    setCaptureInIntake(false);setIntakeSourceCaptures([]);
    requestIds.current = { customer: "", quote: "", conversion: "", directCustomer: "" };
  }

  const saveIntakeDraft = async () => {
    if(draftWorking.current||directIntakeInFlight.current)return;
    if(recognitionOverflow?.items.length){setFeedback({kind:"error",message:"Bitte die übrigen Positionen zuerst als weiteren Beleg speichern."});return;}
    if(!ports.drafts){setFeedback({kind:"error",message:"Entwurf nicht gespeichert · alle Eingaben sind noch da. Code: INTAKE_DRAFT_PORT_UNAVAILABLE."});return;}
    draftWorking.current=true;setBusy(true);setFeedback(null);
    const id=activeDraft?.id??intakeClientKey;
    try {
      const originals=await saveIntakeTextOriginal();
      const payload={...draftPayload(),documents:originals.map(value=>value.id)};
      const result=await ports.drafts.saveDraft({id,clientEventId:draftOperation.current??=crypto.randomUUID(),art:"eingang",payload,
        lastField:intakeLastFocus.current?.getAttribute("data-spec-id")??null,expectedVersion:activeDraft?.version??null});
      if(result.code!=="OK"){
        setFeedback(result.code==="CONFLICT"
          ? {kind:"conflict",message:result.message}
          : {kind:"error",message:"Entwurf nicht gespeichert · alle Eingaben sind noch da. "+result.message});
        return;
      }
      window.dispatchEvent(new Event("kreile:intake-drafts-changed"));
      reset();setOpen(false);setIntakeToast("Entwurf gespeichert · steht auf Der Tag");
    }catch(cause){console.error("[INTAKE_DRAFT_SAVE_REQUEST_FAILED]",cause);setFeedback({kind:"error",message:"Entwurf nicht gespeichert · alle Eingaben sind noch da. Code: INTAKE_DRAFT_SAVE_REQUEST_FAILED."});}
    finally{draftWorking.current=false;setBusy(false);}
  };

  const restoreIntakeDraft = async (id:string) => {
    if(!ports.drafts)return;
    try {
      const result=await ports.drafts.readDrafts();
      if(result.code!=="OK")throw Error(result.message);
      const draft=result.drafts.find(value=>value.id===id);
      if(!draft||draft.art!=="eingang")throw Error("INTAKE_DRAFT_NOT_FOUND");
      const raw=draft.payload;
      // P67: version 0 remains editable. Missing business fields stay empty;
      // the stored payload is only changed by an explicit save or valid booking.
      const p:Record<string,unknown>=raw.version===undefined||raw.version===0?{
        clientKey:draft.id,customerId:raw.customerId??raw.kunde??"",
        customerMode:raw.customerId||raw.kunde?"EXISTING":"NONE",
        query:"",text:"",items:[{...newIntakePosition(),quantity:"",surfaceRequested:""}],
        kind:"",date:"",confirmed:"",term:"",handover:"",payment:"",source:"",note:"",
        geprueft:false,documents:[],recognitionMarkers:[],recognitionConfirmed:false,lastRecognizedText:"",
        intakeWishDateOrigin:null,intakeHandoverOrigin:null,intakePaymentOrigin:null,intakeOrigin:null,
        intakeSourceOrigin:null,intakeTermChoice:null,intakeProcessingWeeks:null,intakeTermOrigin:null,intakeTermExpired:false,
        ...raw,version:1,
      }:raw;
      if(p.version!==1||typeof p.clientKey!=="string"||typeof p.customerId!=="string"||typeof p.text!=="string"
        ||p.dismissedConcerns!==undefined&&(!Array.isArray(p.dismissedConcerns)||p.dismissedConcerns.some(value=>typeof value!=="string"||!recognizeNoteConcerns(p.text as string).some(concern=>concern.id===value)))
        ||!Array.isArray(p.items)||!p.items.length||p.items.some(item=>!item||typeof item!=="object"||typeof item.key!=="string"||typeof item.name!=="string"||typeof item.quantity!=="string")
        ||!["query","kind","date","confirmed","term","handover","payment","source","note","lastRecognizedText"].every(key=>typeof p[key]==="string")
        ||!Array.isArray(p.documents)||p.documents.some(value=>typeof value!=="string")||!Array.isArray(p.recognitionMarkers)||typeof p.geprueft!=="boolean")throw Error("INTAKE_DRAFT_FORMAT_INVALID");
      // This version is written by saveIntakeDraft above; canonical customer data is freshly read.
      const saved=p as ReturnType<typeof draftPayload>;
      await loadDirectIntake(saved.customerId||undefined);
      const captures=await Promise.all(saved.documents.map(async captureId=>{
        const read=await ports.getCapture?.(captureId);if(!read||read.code!=="OK")throw Error(read?.message??"INTAKE_DRAFT_ORIGINAL_UNAVAILABLE");return read.capture;
      }));
      if(saved.customerMode==="NEW"&&saved.customerFields){setDirectCustomerMode("NEW");setDirectCustomer(saved.customerFields);}
      if(saved.customerMode==="EXISTING"&&saved.customerFields)setDirectCustomer(current=>({...current,...Object.fromEntries(Object.entries(saved.customerFields).filter(([key,value])=>key in current&&!current[key as keyof CustomerFormValue]&&value))}));
      setActiveDraft(draft);setIntakeClientKey(saved.clientKey);setIntakeCustomerQuery(saved.query);setIntakeRecognitionText(saved.text);
      setIntakeDismissedConcerns(saved.dismissedConcerns??captures.find(capture=>capture.id===saved.clientKey)?.dismissedConcerns??[]);
      setDirectItems(saved.items);setIntakeKind(saved.kind);setDirectWishDate(saved.date);setDirectConfirmedDate(saved.confirmed);
      setIntakeTermStatus(saved.term);setIntakeHandover(saved.handover);setIntakePaymentMode(saved.payment);setIntakeSource(saved.source);setDirectNote(saved.note);
      setIntakeChecked(saved.geprueft);setIntakeSourceCaptures(captures);setRecognitionMarkers(saved.recognitionMarkers);setRecognitionConfirmed(saved.recognitionConfirmed);
      setLastRecognizedText(saved.lastRecognizedText);setIntakeWishDateOrigin(saved.intakeWishDateOrigin);setIntakeHandoverOrigin(saved.intakeHandoverOrigin);
      setIntakePaymentOrigin(saved.intakePaymentOrigin);setIntakeOrigin(saved.intakeOrigin);setIntakeSourceOrigin(saved.intakeSourceOrigin??null);setIntakeTermChoice(saved.intakeTermChoice);setIntakeProcessingWeeks(saved.intakeProcessingWeeks??null);setIntakeTermOrigin(saved.intakeTermOrigin??null);setIntakeTermExpired(saved.intakeTermExpired??false);
      setIntakeBaseline(intakeComparison(saved));
      if(draft.zuletzt_feld)requestAnimationFrame(()=>requestAnimationFrame(()=>{
        const field=[...document.querySelectorAll<HTMLElement>("[data-spec-id]")].find(value=>value.getAttribute("data-spec-id")===draft.zuletzt_feld);
        field?.focus();
      }));
    }catch(cause){console.error("[INTAKE_DRAFT_RESTORE_FAILED]",cause);setFeedback({kind:"error",message:"Entwurf konnte nicht geöffnet werden · gespeicherter Stand bleibt erhalten. Code: INTAKE_DRAFT_RESTORE_FAILED."});}
  };
  function draftPayload(){return {version:1,customerMode:directCustomerMode,customerFields:directCustomer,customerName:directCustomerId?customerDisplayName(directCustomer):"",clientKey:intakeClientKey,customerId:directCustomerId,query:intakeCustomerQuery,text:intakeRecognitionText,items:directItems,kind:intakeKind,
    date:directWishDate,confirmed:directConfirmedDate,term:intakeTermStatus,handover:intakeHandover,payment:intakePaymentMode,source:intakeSource,note:directNote,
    geprueft:intakeChecked,dismissedConcerns:intakeDismissedConcerns,documents:intakeSourceCaptures.map(capture=>capture.id),recognitionMarkers,recognitionConfirmed,lastRecognizedText,
    intakeWishDateOrigin,intakeHandoverOrigin,intakePaymentOrigin,intakeOrigin,intakeSourceOrigin,intakeTermChoice,intakeProcessingWeeks,intakeTermOrigin,intakeTermExpired};}

  const saveRecognitionOverflow = async () => {
    if (!recognitionOverflow?.items.length || draftWorking.current || directIntakeInFlight.current) return;
    if (!ports.drafts) { setFeedback({kind:"error",message:"Weiterer Beleg nicht gespeichert · die Positionen sind noch da. Code: INTAKE_DRAFT_PORT_UNAVAILABLE."}); return; }
    draftWorking.current=true; setBusy(true); setFeedback(null);
    const id=overflowRequest.current?.id ?? crypto.randomUUID();
    const items=recognitionOverflow.items.slice(0,20);
    const markers=items.flatMap((item,index)=>[
      {key:`position-${index}-name`,label:`Position ${index+1}`,value:item.name,source:"Text"},
      ...(item.quantity?[{key:`position-${index}-quantity`,label:"Menge",value:item.quantity,source:"Text"}]:[]),
      {key:`position-${index}-unit`,label:"Einheit",value:item.unit??"",source:"Text"},
      {key:`position-${index}-surface`,label:"Oberfläche",value:item.surfaceRequested,source:"Text"},
    ]);
    const request=overflowRequest.current ?? {id,clientEventId:crypto.randomUUID(),art:"eingang" as const,
      payload:{...draftPayload(),clientKey:id,text:recognitionOverflow.text,items,documents:[],geprueft:false,recognitionMarkers:markers,recognitionConfirmed:false,lastRecognizedText:recognitionOverflow.text},
      lastField:null,expectedVersion:null};
    overflowRequest.current=request;
    try {
      const result=await ports.drafts.saveDraft(request);
      if(result.code!=="OK") { setFeedback({kind:"error",message:"Weiterer Beleg nicht gespeichert · die Positionen sind noch da. "+result.message}); return; }
      const stored=result.drafts.find(draft=>draft.id===id&&draft.art==="eingang");
      const storedItems=stored?.payload.items;
      const requestedItems=request.payload.items;
      if(stored?.payload.clientKey!==id || !Array.isArray(storedItems) || !Array.isArray(requestedItems)
        || storedItems.length!==requestedItems.length
        || requestedItems.some((item,index)=>storedItems[index]?.name!==item.name || storedItems[index]?.quantity!==item.quantity || storedItems[index]?.unit!==item.unit)) {
        setFeedback({kind:"error",message:"Weiterer Beleg nicht bestätigt · die Positionen sind noch da. Erneut speichern. Code: INTAKE_OVERFLOW_READBACK_MISMATCH."});
        return;
      }
      overflowRequest.current=null;
      setRecognitionOverflow(current=>current?{...current,saved:current.saved+1,items:current.items.slice(20)}:null);
      window.dispatchEvent(new Event("kreile:intake-drafts-changed"));
    } catch(cause) {
      console.error("[INTAKE_OVERFLOW_DRAFT_FAILED]",cause);
      setFeedback({kind:"error",message:"Weiterer Beleg nicht gespeichert · die Positionen sind noch da. Code: INTAKE_OVERFLOW_DRAFT_FAILED."});
    } finally { draftWorking.current=false; setBusy(false); }
  };

  async function saveIntakeTextOriginal():Promise<IntakeCapture[]>{
    if(!intakeRecognitionText.trim())return intakeSourceCaptures;
    // Unchanged source text is already an original; never manufacture a copied note.
    if(intakeSourceCaptures.some(value=>value.id!==intakeClientKey&&value.text?.trim()===intakeRecognitionText.trim()))return intakeSourceCaptures;
    const selectedConcerns=intakeConcerns.map(value=>value.id);
    if(intakeSourceCaptures.some(value=>value.id===intakeClientKey&&value.text===intakeRecognitionText.trim()
      &&JSON.stringify(value.concerns)===JSON.stringify(selectedConcerns)))return intakeSourceCaptures;
    if(!ports.saveCaptureNote)throw Error("INTAKE_ORIGINAL_WRITE_PORT_UNAVAILABLE");
    const saved=await ports.saveCaptureNote({itemId:intakeClientKey,textstand:intakeTextStand.current,text:intakeRecognitionText,concerns:selectedConcerns});
    if(saved.code!=="OK")throw Error(saved.message);
    const sources=[...intakeSourceCaptures.filter(value=>value.id!==saved.capture.id),saved.capture];
    setIntakeSourceCaptures(sources);return sources;
  }

  const openWithIntent = (request: GlobalCreateIntent | GlobalCreateRequest) => {
    const intent = typeof request === "string" ? request : request.intent;
    const prefill = typeof request === "string" ? undefined : request.prefill;
    reset();
    setHandoverToken(typeof request === "string" ? null : request.handoverToken ?? null);
    setOpen(true);
    if(typeof request!=="string"&&request.draftId){void restoreIntakeDraft(request.draftId);return;}
    if (intent === "CUSTOMER") {
      if(prefill?.sourceItemId&&Number.isSafeInteger(prefill.sourceVersion)&&(prefill.sourceVersion??0)>0)setCustomerSource({itemId:prefill.sourceItemId,version:prefill.sourceVersion!});
      if(prefill?.customerMode==="lieferant"&&!ports.canManageMoney){deny("customer");return;}
      setSupplierCustomerMode(prefill?.customerMode==="lieferant");
      const initialCustomer = prefill?.customerMode==="lieferant"
        ? {...EMPTY_CUSTOMER,customerType:"lieferant" as const,paymentPreference:"",companyName:prefill.name?.trim()??'',email:prefill.email?.trim().toLowerCase()??''}
        : prefill ? { ...customerDraftFromSearch(prefill.name ?? ""), email: prefill.email?.trim().toLowerCase() ?? "" } : EMPTY_CUSTOMER;
      setCustomerType("");
      setCustomerClosePrompt(false);
      setCustomerDuplicateResults([]);
      setCustomerDuplicateAcceptedFor("");
      setCustomerDraft(initialCustomer);
      setCustomerBaseline({ customerType: initialCustomer.customerType, customerDraft: initialCustomer, customerNote: "" });
      if (ports.canCreateCustomer||prefill?.customerMode==='lieferant'&&prefill.sourceItemId&&Number.isSafeInteger(prefill.sourceVersion)&&ports.canManageMoney) navigate("customer");
      else deny("customer");
      return;
    }
    if (intent === "QUOTE") {
      if (prefill?.customerQuery) setCustomerQuery(prefill.customerQuery);
      if (prefill?.note) setQuoteNote(prefill.note);
      if (prefill?.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(prefill.dueDate)) setDueDate(prefill.dueDate);
      if (prefill?.quotePositions?.length) setPositions(prefill.quotePositions.slice(0, 20).map((position) => ({
        ...newPosition(),
        quantity: /^\d+(?:[.,]\d+)?$/.test(position.quantity ?? "") ? (position.quantity ?? "1").replace(",", ".") : "1",
        material: position.material?.slice(0, 500) ?? "",
      })));
      void loadCustomers();
      return;
    }
    if (!ports.canCreateOrder) {
      deny("quote");
      return;
    }
    if (!prefill) {
      navigate("choose");
      return;
    }
    void loadDirectIntake(prefill?.customerId, Boolean(prefill?.customerId), prefill?.orderCopyId,undefined,prefill?.sourceItemId?{itemId:prefill.sourceItemId,kind:prefill.intakeKind??'auftrag'}:undefined);
  };

  useEffect(() => {
    const handler = (event: Event) => {
      const request = event instanceof CustomEvent ? event.detail as unknown : null;
      if (request === "CUSTOMER" || request === "QUOTE" || request === "DIRECT_INTAKE") openWithIntent(request);
      else if (request && typeof request === "object" && "intent" in request) {
        const typed = request as GlobalCreateRequest;
        if (typed.intent === "CUSTOMER" || typed.intent === "QUOTE" || typed.intent === "DIRECT_INTAKE") openWithIntent(typed);
      }
    };
    window.addEventListener(GLOBAL_CREATE_OPEN_EVENT, handler);
    return () => window.removeEventListener(GLOBAL_CREATE_OPEN_EVENT, handler);
  });

  useEffect(() => {
    const handler = (event: globalThis.KeyboardEvent) => {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target;
      const isTyping = target instanceof Element
        && Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
      if (isTyping) return;
      const key = event.key.toLowerCase();
      if (!open && key === "n") {
        const visibleDialogOpen = [...document.querySelectorAll<HTMLElement>("[role='dialog']:not(.kr-dialog--karte)")]
          .some((dialog) => dialog.getClientRects().length > 0 && dialog.getAttribute("aria-hidden") !== "true");
        if (!ports.canCreateOrder || visibleDialogOpen) return;
        event.preventDefault();
        openWithIntent("DIRECT_INTAKE");
        return;
      }
      if (!open || step !== "choose") return;
      if (key === "a") {
        event.preventDefault();
        document.querySelector<HTMLButtonElement>('[data-spec-id="rein.auftrag-erfassen"]')?.click();
      } else if (key === "k") {
        event.preventDefault();
        document.querySelector<HTMLButtonElement>('[data-spec-id="rein.kunde-anlegen"]')?.click();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  const resumeQuote = async () => {
    if (!ports.canCreateQuote || !ports.resumeQuoteId) {
      deny("quote");
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      const [result, catalog] = await Promise.all([
        ports.readQuote({ quoteId: ports.resumeQuoteId }),
        ports.listCatalog?.() ?? Promise.resolve({ code: "UNAVAILABLE" as const, message: "Leistungskatalog ist nicht angebunden." }),
      ]);
      if (result.code !== "OK") {
        setFeedback(requestFeedback(result, ports.resumeQuoteId));
        return;
      }
      if (catalog.code !== "OK") {
        setFeedback({ kind: catalog.code === "DENIED" ? "denied" : "error", message: catalog.message });
        return;
      }
      setCatalogServices(normaliseIntakeCatalog(catalog.services));
      if (result.quote.status === "converted" && ports.resumeQuoteConversionId) {
        const converted = await ports.readQuoteConversionReceipt({
          quoteId: result.quote.quoteId,
          clientEventId: ports.resumeQuoteConversionId,
        });
        if (converted.code !== "OK") {
          setFeedback(requestFeedback(converted, ports.resumeQuoteConversionId));
          return;
        }
        setQuote(converted.quote);
        setConversion(converted);
        ports.rememberQuote(null);
        navigate("order-saved");
        return;
      }
      resetAwardDateForQuoteContext();
      setQuote(result.quote);
      setQuoteReceipt(null);
      setCustomer({ id: result.quote.customerId, customerNumber: result.quote.customerNumber, name: result.quote.customerDisplayName, city: null });
      navigate("quote-saved");
    } catch {
      setFeedback({ kind: "error", message: "Der gespeicherte KV konnte nicht sicher zurückgelesen werden.", requestId: ports.resumeQuoteId });
    } finally {
      setBusy(false);
    }
  };

  const editQuote = (draft: QuoteReadback) => {
    if (!ports.canCreateQuote || draft.status !== "draft") {
      deny("quote");
      return;
    }
    resetAwardDateForQuoteContext();
    setQuote(draft);
    setQuoteReceipt(null);
    const selected = customerChoices.find((entry) => entry.id === draft.customerId);
    setCustomer(selected ?? { id: draft.customerId, customerNumber: draft.customerNumber, name: draft.customerDisplayName, city: null });
    setAwardHandoverMode("pickup");
    setAwardPaymentMode(paymentModeFromPreference(selected?.paymentPreference,"shipping",selected??undefined));
    setDueDate(draft.dueDate);
    setQuoteNote(draft.note ?? "");
    setPositions(draft.positions.map((position) => {
      const surface = normaliseOrderPositionSurface(position.surfaceRequested);
      if (!surface) throw new Error("INTAKE_QUOTE_SURFACE_INVALID");
      const service = catalogServices.find((candidate) => candidate.name === position.name
        && candidate.surface === surface
        && candidate.netPriceCents === position.unitPriceCents);
      return {
        key: globalThis.crypto.randomUUID(),
        catalogServiceId: service?.id ?? "",
        name: position.name,
        quantity: String(position.quantity),
        material: position.material ?? "",
        surfaceRequested: surface,
        unit: service?.unit ?? "",
        unitPriceCents: position.unitPriceCents,
      };
    }));
    requestIds.current.quote = "";
    requestIds.current.conversion = "";
    navigate("quote");
  };

  const submitCustomer = async (event: FormEvent) => {
    event.preventDefault();
    if (!ports.canCreateCustomer&&!(supplierCustomerMode&&customerSource&&ports.canManageMoney)) {
      deny("customer");
      return;
    }
    if(customerSaving.current)return;
    const errors=kundeValidierung(customerDraft);
    const invalid=Object.entries(errors)[0];
    if(invalid){
      const ids:Record<string,string>={customerType:"kundentyp",companyName:"name",firstName:"vorname",lastName:"nachname",phone:"telefon",street:"strasse",houseNumber:"hausnummer",zipCode:"plz",city:"ort",country:"land"};
      setFeedback({kind:"validation",message:invalid[0]==="customerType"?"Noch offen: Firma oder Privat":invalid[1]});
      const root=document.querySelector<HTMLElement>(`[data-spec-id="kundeneu.${ids[invalid[0]]??invalid[0]}"]`);(root?.matches("input,textarea,select,button")?root:root?.querySelector<HTMLElement>("input,textarea,select,button"))?.focus();return;
    }
    if(customerAddress?.blocked){setFeedback({kind:"validation",message:"Adresse prüfen"});document.querySelector<HTMLElement>('[data-spec-id="kundeneu.adresse"]')?.focus();return;}
    if (customerDuplicateOpen) {
      setFeedback({ kind: "validation", message: "Bitte zuerst entscheiden, ob der ähnliche Kunde bereits vorhanden ist." });
      document.querySelector<HTMLElement>('[data-spec-id="kundeneu.dublette"]')?.focus();
      return;
    }
    const id = requestId("customer");
    setCustomerClosePrompt(false);
    setBusy(true);
    setFeedback(null);
    const input=createInputForStatus();
    customerSaving.current=true;
    try {
      const result = customerSource
        ? ports.createCustomerFromCapture ? await ports.createCustomerFromCapture(input, customerSource) : { code: "UNAVAILABLE" as const, message: "Kunde und Eingang konnten nicht gemeinsam gespeichert werden · Code: CUSTOMER_INTAKE_PORT_MISSING." }
        : await ports.createCustomer(input);
      if (result.code !== "OK") {
        setFeedback({kind:"save-failed",message:`Speichern fehlgeschlagen · alle Eingaben sind noch da · ${result.message}`,requestId:id});
        return;
      }
      setOpen(false);
      setIntakeToast(`Kunde ${result.customer.customerNumber ?? result.customer.name} angelegt`);
      if(customerSource)window.dispatchEvent(new CustomEvent(INTAKE_CHANGED_EVENT,{detail:{itemId:customerSource.itemId,customerId:result.customer.id,customerName:result.customer.name}}));
      ports.refresh();
      if(!(customerSource&&supplierCustomerMode))ports.openCustomer(result.customer.id);
    } catch (error) {
      console.error("[CUSTOMER_CREATE_REQUEST_FAILED]",{errorName:error instanceof Error?error.name:"UnknownError"});
      setFeedback({
        kind: "unclear",
        message: "Speichern fehlgeschlagen · alle Eingaben sind noch da. Code: CUSTOMER_CREATE_REQUEST_FAILED. Mit gleicher Kennung erneut speichern.",
        requestId: id,
      });
    } finally {
      setBusy(false);
      customerSaving.current=false;
    }
  };

  const recognizeCustomer = async (text=customerRecognitionText) => {
    if(busy||!text.trim())return;
    setBusy(true);setFeedback(null);
    try {
      const result=await ports.recognizeIntakeText(text);
      if(result.code!=="OK"){setFeedback({kind:"error",message:result.message});return;}
      const fields=result.data.fields.filter(field=>["companyName","phone","email","city","zipCode"].includes(field.field));
      setCustomerDraft(current=>{
        const next={...current};for(const field of fields){if(!next[field.field as keyof CustomerFormValue])Object.assign(next,{[field.field]:field.value});}
        if(!next.customerType&&next.companyName)next.customerType="business";return next;
      });
      setCustomerOrigins(current=>({...current,...Object.fromEntries(fields.map(field=>[field.field,"erkannt · "+field.source]))}));
    }catch(error){console.error("[CUSTOMER_RECOGNITION_FAILED]",{errorName:error instanceof Error?error.name:"UnknownError"});setFeedback({kind:"error",message:"Angaben konnten nicht gelesen werden. Code: CUSTOMER_RECOGNITION_FAILED."});}
    finally{setBusy(false);}
  };

  const createInputForStatus = (): CreateCustomerInput => {
    const {customerType:kind,salutation,handoverPreference,paymentTermDays,...fields}=customerDraft;
    const input:CreateCustomerInput={...fields,customerType:kind as Exclude<CustomerDraft["customerType"],"">,clientEventId:requestId("customer"),salutation:salutation||null,handoverPreference:handoverPreference||null,paymentTermDays:paymentTermDays?Number(paymentTermDays):null};
    if(!ports.canManageMoney){delete input.paymentPreference;delete input.iban;delete input.paymentTermDays;}
    return input;
  };

  const quoteInputForStatus = (): CreateQuoteInput | null => {
    if (!customer) return null;
    const mapped = positions.map((position) => ({
      name: position.name.trim(), quantity: Number(position.quantity), material: nullable(position.material),
      surfaceRequested: position.surfaceRequested.trim(), unitPriceCents: position.unitPriceCents,
    }));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || positions.some((position) => !position.catalogServiceId)
      || mapped.some((position) => position.unitPriceCents === null)) return null;
    return {
      clientEventId: requestId("quote"), customerId: customer.id, dueDate, note: nullable(quoteNote),
      positions: mapped.map((position) => ({ ...position, unitPriceCents: position.unitPriceCents! })),
    };
  };

  const updateInputForStatus = (): UpdateQuoteInput | null => {
    if (!quote) return null;
    const create = quoteInputForStatus();
    return create ? { ...create, quoteId: quote.quoteId, expectedVersion: quote.version } : null;
  };

  /** This path only reads actor- and tenant-bound receipts/readbacks. */
  const checkUnclearStatus = async () => {
    if (!feedback?.requestId) return;
    setBusy(true);
    setStatusChecked(false);
    setRetryConfirmed(false);
    try {
      if (step === "customer") {
        const result = await ports.readCustomerCreateReceipt(createInputForStatus());
        if (result.code === "OK") {
          setOpen(false);
          ports.openCustomer(result.customer.id);
          return;
        }
        setFeedback({ kind: "unclear", message: result.code === "NOT_FOUND" ? "Es wurde noch keine Speicherung gefunden. Die Eingaben bleiben erhalten." : result.message, requestId: feedback.requestId });
      } else if (step === "quote") {
        const input = quote ? updateInputForStatus() : quoteInputForStatus();
        if (!input) {
          setFeedback({ kind: "validation", message: "Die vorhandenen KV-Eingaben können nicht sicher geprüft werden.", requestId: feedback.requestId });
          return;
        }
        const result = quote
          ? await ports.readQuoteUpdateReceipt(input as UpdateQuoteInput)
          : await ports.readQuoteCreateReceipt(input as CreateQuoteInput);
        if (result.code === "OK") {
          setQuote(result.quote);
          setQuoteReceipt(result.receipt);
          ports.rememberQuote(result.quote.quoteId);
          navigate("quote-saved");
          return;
        }
        setFeedback({ kind: "unclear", message: result.code === "NOT_FOUND" ? "Es wurde noch keine Speicherung gefunden. Die Eingaben bleiben erhalten." : result.message, requestId: feedback.requestId });
      } else if (step === "quote-saved" && quote) {
        const result = await ports.readQuoteConversionReceipt({ quoteId: quote.quoteId, clientEventId: requestId("conversion") });
        if (result.code === "OK") {
          setQuote(result.quote);
          setConversion(result);
          ports.rememberQuote(null);
          navigate("order-saved");
          return;
        }
        setFeedback({ kind: "unclear", message: result.code === "NOT_FOUND" ? "Es wurde noch kein Auftrag angelegt. Der KV bleibt unverändert geöffnet." : result.message, requestId: feedback.requestId });
      }
      setStatusChecked(true);
    } catch {
      setFeedback({ kind: "unclear", message: "Der gespeicherte Stand konnte nicht sicher gelesen werden. Es wurde nichts erneut gesendet.", requestId: feedback.requestId });
    } finally {
      setBusy(false);
    }
  };

  const retryAfterStatusCheck = () => {
    if (!statusChecked) return;
    if (!retryConfirmed) {
      setRetryConfirmed(true);
      return;
    }
    if (step === "customer") void submitCustomer({ preventDefault() {} } as FormEvent);
    else if (step === "direct-intake") void submitDirectIntake({ preventDefault() {} } as FormEvent);
    else if (step === "quote") void submitQuote({ preventDefault() {} } as FormEvent);
    else if (step === "quote-saved") void convertQuote();
  };

  const startQuote = async (selected: GlobalCreateCustomerChoice) => {
    if (!ports.canCreateQuote) {
      deny("quote");
      return;
    }
    let services = catalogServices;
    if (services.length === 0) {
      setBusy(true);
      setFeedback(null);
      try {
        const catalog = await (ports.listCatalog?.() ?? Promise.resolve({ code: "UNAVAILABLE" as const, message: "Leistungskatalog ist nicht angebunden." }));
        if (catalog.code !== "OK") {
          setFeedback({ kind: catalog.code === "DENIED" ? "denied" : "error", message: catalog.message });
          return;
        }
        services = normaliseIntakeCatalog(catalog.services);
        setCatalogServices(services);
      } catch {
        setFeedback({ kind: "error", message: "Der Leistungskatalog konnte nicht sicher gelesen werden." });
        return;
      } finally {
        setBusy(false);
      }
    }
    resetAwardDateForQuoteContext();
    setAwardHandoverMode("pickup");
    setAwardPaymentMode(paymentModeFromPreference(selected.paymentPreference,"shipping",selected));
    setCustomer(selected);
    setQuote(null);
    setQuoteReceipt(null);
    setOpenQuotesState({ kind: "idle" });
    setConversion(null);
    requestIds.current.quote = "";
    requestIds.current.conversion = "";
    navigate("quote");
  };

  const submitQuote = async (event: FormEvent) => {
    event.preventDefault();
    if (!ports.canCreateQuote || !customer) {
      deny("quote");
      return;
    }
    const mapped = positions.map((position) => ({
      name: position.name.trim(),
      quantity: Number(position.quantity),
      material: nullable(position.material),
      surfaceRequested: position.surfaceRequested.trim(),
      unitPriceCents: position.unitPriceCents,
    }));
    if (!dueDate || positions.some((position) => position.catalogServiceId !== FREE_TEXT_SERVICE && !position.catalogServiceId) || mapped.some((position) => position.name.length < 2
      || !Number.isSafeInteger(position.quantity) || position.quantity < 1
      || position.surfaceRequested.length < 2 || position.unitPriceCents === null)) {
      setFeedback({ kind: "validation", message: "Termin und alle KV-Positionen brauchen Bezeichnung, Menge, Oberfläche und einen Netto-Stückpreis." });
      return;
    }
    const id = requestId("quote");
    setBusy(true);
    setFeedback(null);
    try {
      const payload = {
        clientEventId: id,
        dueDate,
        note: nullable(quoteNote),
        positions: mapped.map((position) => ({ ...position, unitPriceCents: position.unitPriceCents! })),
      };
      const result = quote
        ? await ports.updateQuote({ ...payload, quoteId: quote.quoteId, expectedVersion: quote.version })
        : await ports.createQuote({ ...payload, customerId: customer.id });
      if (result.code !== "OK") {
        setFeedback(requestFeedback(result, id));
        return;
      }
      setQuote(result.quote);
      setQuoteReceipt(result.receipt);
      ports.rememberQuote(result.quote.quoteId);
      navigate("quote-saved");
    } catch {
      setFeedback({
        kind: "unclear",
        message: "Der KV-Ausgang ist ungeklärt. Nicht neu beginnen: mit derselben Anfragekennung zuerst den gespeicherten Stand prüfen.",
        requestId: id,
      });
    } finally {
      setBusy(false);
    }
  };

  const convertQuote = async () => {
    if (!ports.canCreateQuote || !quote) {
      deny("quote");
      return;
    }
    if (!confirmedOrderDueDateValid) {
      setFeedback({ kind: "validation", message: "Bitte den zugesagten Termin für den Auftrag bestätigen." });
      return;
    }
    const id = ports.resumeQuoteConversionId ?? requestId("conversion");
    requestIds.current.conversion = id;
    ports.rememberQuoteConversion(quote.quoteId, id);
    setBusy(true);
    setFeedback(null);
    try {
      const result = await ports.convertQuote({
        quoteId: quote.quoteId,
        clientEventId: id,
        expectedVersion: quote.version,
        confirmedAward: true,
        confirmedOrderDueDate,
        handoverMode: awardHandoverMode,
        paymentMode: awardPaymentMode,
      });
      if (result.code !== "OK") {
        setFeedback(requestFeedback(result, id));
        return;
      }
      setQuote(result.quote);
      setConversion(result);
      ports.rememberQuote(null);
      navigate("order-saved");
    } catch {
      setFeedback({
        kind: "unclear",
        message: "Der Auftragseingang ist ungeklärt. Keine zweite Anlage starten: mit derselben Anfragekennung den Status prüfen.",
        requestId: id,
      });
    } finally {
      setBusy(false);
    }
  };

  const confirmRecognizedPositionField = (key: string, field: string) => {
    const index = directItems.findIndex(item => item.key === key);
    setRecognitionMarkers(current => current.filter(marker => marker.key !== `position-${index}-${field}`));
  };
  const updateDirectItem = (key: string, field: keyof Omit<IntakePositionDraft, "key" | "surfaceTouched">, value: string) => {
    confirmRecognizedPositionField(key, field);
    setDirectItems((current) => current.map((item) => item.key === key ? { ...item, [field]: value } : item));
  };

  const setDirectPositionName = (key: string, name: string) => {
    confirmRecognizedPositionField(key, "name");
    const matches = catalogServices.filter((candidate) => candidate.name.localeCompare(name.trim(), "de-DE", { sensitivity: "base" }) === 0);
    const service = matches.length === 1 ? matches[0] : null;
    setDirectItems((current) => current.map((item) => {
      if (item.key !== key) return item;
      if (!service) return { ...item, catalogServiceId: FREE_TEXT_SERVICE, name, unit: null, unitPriceCents: item.priceText===undefined?null:item.unitPriceCents, vatRateBasisPoints: item.priceText===undefined||item.unitPriceCents===null?null:FREE_TEXT_VAT_RATE_BASIS_POINTS };
      const surfaceRequested = item.surfaceTouched ? item.surfaceRequested : service.surface;
      const catalogMatchesSurface = surfaceRequested === service.surface;
      return {
        ...item,
        catalogServiceId: catalogMatchesSurface ? service.id : FREE_TEXT_SERVICE,
        name: service.name,
        surfaceRequested,
        unit: service.unit,
        unitPriceCents: item.priceText!==undefined?item.unitPriceCents:catalogMatchesSurface && ports.canManageMoney ? service.netPriceCents ?? null : null,
        vatRateBasisPoints: item.priceText!==undefined?(catalogMatchesSurface?service.vatRateBasisPoints??null:item.unitPriceCents===null?null:FREE_TEXT_VAT_RATE_BASIS_POINTS):catalogMatchesSurface && ports.canManageMoney ? service.vatRateBasisPoints ?? null : null,
      };
    }));
  };

  const setDirectPositionSurface = (key: string, surfaceRequested: string) => {
    confirmRecognizedPositionField(key, "surface");
    setDirectItems((current) => current.map((item) => {
      if (item.key !== key) return item;
      const service = catalogServices.find((candidate) => candidate.id === item.catalogServiceId);
      return service?.surface === surfaceRequested
        ? { ...item, surfaceRequested, surfaceTouched: true }
        : { ...item, catalogServiceId: FREE_TEXT_SERVICE, surfaceRequested, surfaceTouched: true, unitPriceCents: item.priceText===undefined?null:item.unitPriceCents, vatRateBasisPoints: item.priceText===undefined||item.unitPriceCents===null?null:FREE_TEXT_VAT_RATE_BASIS_POINTS };
    }));
  };

  const setDirectPositionUnit = (key: string, unit: string) => {
    confirmRecognizedPositionField(key, "unit");
    setDirectItems((current) => current.map((item) => {
      if (item.key !== key) return item;
      const service = catalogServices.find((candidate) => candidate.id === item.catalogServiceId);
      if (!service || service.unit === unit) return { ...item, unit: unit || null };
      return {
        ...item,
        catalogServiceId: FREE_TEXT_SERVICE,
        unit: unit || null,
        unitPriceCents: item.priceText===undefined?null:item.unitPriceCents,
        vatRateBasisPoints: item.priceText===undefined||item.unitPriceCents===null?null:FREE_TEXT_VAT_RATE_BASIS_POINTS,
      };
    }));
  };

  const adoptIntakeTermSuggestion=()=>{
    if(intakeSuggestionState.kind!=="data"||!intakeSuggestionState.data.term?.offerDate||!directWishDate)return;
    const date=intakeSuggestionState.data.term.offerDate;
    setIntakeTermChoice({kind:"adopted",basisKey:intakeSuggestionBasisKey,wishDate:directWishDate,achievableDate:date});
    setDirectWishDate(date);setDirectConfirmedDate(date);setIntakeTermStatus("counter");setIntakeTermOrigin("gegenvorschlag");setIntakeTermExpired(false);
  };
  const keepIntakeWish=()=>{
    if(intakeSuggestionState.kind!=="data"||!intakeSuggestionState.data.term?.achievableDate||!directWishDate||intakeSuggestionState.data.term.rating==="unmoeglich"||!ports.canDecide&&intakeKind!=="kv")return;
    setIntakeTermChoice({kind:intakeKind==="kv"?"kv":"kept",basisKey:intakeSuggestionBasisKey,wishDate:directWishDate,achievableDate:directWishDate});
    setDirectConfirmedDate(directWishDate);setIntakeTermStatus("confirmed");setIntakeTermOrigin(intakeKind==="kv"?"wunsch_kv":"ueber_auslastung");setIntakeTermExpired(false);
  };
  const chooseIntakeProposal=(proposal:NonNullable<NonNullable<IntakeSuggestions["term"]>["proposals"]>[number])=>{
    setIntakeTermChoice({kind:"proposal",basisKey:intakeSuggestionBasisKey,wishDate:intakeTermChoice?.wishDate??directWishDate,achievableDate:proposal.date,title:proposal.title});
    setDirectWishDate(proposal.date);setDirectConfirmedDate(proposal.date);setIntakeTermStatus("confirmed");setIntakeTermOrigin("vorschlag");setIntakeTermExpired(false);
  };
  const changeIntakeTermChoice=()=>{
    const wish=intakeTermChoice?.wishDate??directWishDate;setDirectWishDate(wish);setDirectConfirmedDate(wish);setIntakeTermStatus(wish?"wish":"");
    setIntakeTermChoice(null);setIntakeTermOrigin(null);setIntakeTermExpired(false);intakeTermManuallySet.current=false;
  };

  const recognizeDirectIntakeText = async () => {
    if (!intakeRecognitionText.trim()) return;
    if (recognitionOverflow?.items.length) { setFeedback({kind:"validation",message:"Bitte die übrigen Positionen zuerst als weiteren Beleg speichern."}); return; }
    setRecognitionBusy(true);
    setFeedback(null);
    try {
      await saveIntakeTextOriginal();
      const result = await ports.recognizeIntakeText(intakeRecognitionText);
      if (result.code !== "OK") {
        setFeedback({ kind: "error", message: "Erkennung nicht möglich · bitte von Hand ausfüllen" });
        return;
      }
      const values = Object.fromEntries(result.data.fields.map((field) => [field.field, field.value]));
      const recognizedCustomers = await findRecognizedCustomers(intakeRecognitionText, ports.searchIntakeCustomers, { phone: values.phone, email: values.email });
      if (recognizedCustomers.code !== "OK") {
        setIntakeCustomerResults([]);
        setIntakeCustomerSearchState("error");
        setFeedback({
          kind: recognizedCustomers.code === "DENIED" ? "denied" : "error",
          message: recognizedCustomers.message,
        });
      } else if (recognizedCustomers.customers.length > 0) {
        intakeCustomerSearchSeq.current += 1;
        intakeRecognizedQuery.current = recognizedCustomers.query;
        setIntakeCustomerQuery(recognizedCustomers.query);
        setIntakeCustomerResults(recognizedCustomers.customers);
        setIntakeCustomerSearchState("ready");
        const certainCustomer = recognizedCustomers.customers.find(entry => entry.id === recognizedCustomers.confirmedCustomerId);
        if (!directCustomerId && certainCustomer) selectIntakeCustomer("EXISTING", certainCustomer, true, Boolean(intakeHandover));
      } else {
        const customerQuery = customerSearchFromRecognition(result.data, intakeRecognitionText);
        if (customerQuery) {
          setIntakeCustomerQuery(customerQuery);
          setIntakeCustomerResults([]);
          setIntakeCustomerSearchState("idle");
        }
      }
      if (values.dueDate && !directWishDate) {
        setDirectWishDate(values.dueDate);
        setDirectConfirmedDate(values.dueDate);
        setIntakeWishDateOrigin("recognized");
        setIntakeTermStatus((current) => current || "wish");
      }
      let adoptedPositions = result.data.positions;
      let adoptedOffset = 0;
      if (result.data.positions.length > 0) {
        const recognized = result.data.positions.map((position) => {
          const unit = normaliseOrderPositionUnit(position.unit);
          const surface = normaliseOrderPositionSurface(position.surfaceRequested);
          if (!unit || !surface) throw new Error("INTAKE_RECOGNITION_POSITION_INVALID");
          return ({
          ...newIntakePosition(),
          catalogServiceId: FREE_TEXT_SERVICE,
          name: position.name,
          quantity: position.quantity,
          surfaceRequested: surface,
          surfaceTouched: false,
          executionRequested: position.executionRequested,
          unit,
        }); });
        const existing = directItems.length === 1 && !directItems[0]?.name.trim() ? [] : directItems;
        adoptedOffset = existing.length;
        const available = Math.max(0,20-existing.length);
        const adopted = recognized.slice(0,available);
        adoptedPositions = result.data.positions.slice(0,available);
        setDirectItems([...existing,...adopted]);
        const rest=recognized.slice(available);
        overflowRequest.current=null;
        setRecognitionOverflow(rest.length?{total:recognized.length,adopted:adopted.length,saved:0,text:intakeRecognitionText,items:rest}:null);
      }
      const labels: Record<string, string> = { dueDate: "Liefertermin" };
      setRecognitionMarkers([
        ...result.data.fields.filter((field) => field.field === "dueDate").map((field) => ({ key: field.field, label: labels[field.field] ?? field.field, value: field.value, source: field.source })),
        ...adoptedPositions.flatMap((position, index) => [
          { key: `position-${index+adoptedOffset}-name`, label: `Position ${index + adoptedOffset + 1}`, value: position.name, source: position.source },
          ...(position.quantity ? [{ key: `position-${index+adoptedOffset}-quantity`, label: "Menge", value: String(position.quantity), source: position.source }] : []),
          { key: `position-${index+adoptedOffset}-unit`, label: "Einheit", value: position.unit, source: position.source },
          { key: `position-${index+adoptedOffset}-surface`, label: "Oberfläche", value: position.surfaceRequested, source: position.source },
        ]),
      ]);
      setLastRecognizedText(intakeRecognitionText);
      setRecognitionConfirmed(false);
      setIntakeSuggestionState({ kind: "idle" });
      setIntakeTermChoice(null);
    } catch (error) {
      console.error("[INTAKE_RECOGNITION_FAILED]", { name: error instanceof Error ? error.name : "UnknownError" });
      setFeedback({ kind: "error", message: "Erkennung nicht möglich · bitte von Hand ausfüllen. Code: INTAKE_RECOGNITION_FAILED." });
    } finally {
      setRecognitionBusy(false);
    }
  };

  const intakePositionComplete = (item: IntakePositionDraft) =>
    (item.catalogServiceId === FREE_TEXT_SERVICE || item.catalogServiceId.length > 0)
    && item.name.trim().length >= 2
    && item.surfaceRequested.trim().length >= 2
    && Boolean(item.unit)
    && intakeQuantityError(item) === null;

  const customerIssue = (() => {
    if(directCustomerMode==="NEW"&&!directCustomer.customerType)return {detail:"Firma oder Privat wählen",target:"eingang.kundentyp"};
    if (directCustomerMode === "NONE") return { detail: "Kunde wählen", target: "eingang.kundensuche" };
    if(directCustomerMode==="NEW"&&intakeCustomerResults.length)return {detail:"Ähnlicher Kunde vorhanden · Auswahl bestätigen",target:"eingang.dublette"};
    const firstIssue = directCustomerReadiness.issues[0];
    if (firstIssue) return { detail: firstIssue.field === "paymentPreference" ? "Zahlungsbedingung wählen" : firstIssue.message, target: "eingang."+(({companyName:"name",firstName:"vorname",lastName:"nachname",phone:"telefon",street:"strasse",houseNumber:"hausnummer",zipCode:"plz",city:"ort",country:"land",paymentPreference:"zahlungsbedingung"} as Record<string,string>)[firstIssue.field]??firstIssue.field) };
    return null;
  })();
  const firstMissingName = directItems.findIndex((item) => item.name.trim().length < 2 || (!item.catalogServiceId && item.name.trim().length >= 2));
  const firstMissingQuantity = directItems.findIndex((item) => intakeQuantityError(item) !== null);
  const firstMissingUnit = directItems.findIndex((item) => !item.unit);
  const firstMissingSurface = directItems.findIndex((item) => item.surfaceRequested.trim().length < 2);
  const firstInvalidPrice = ports.canManageMoney?directItems.findIndex(item=>intakePriceError(item,intakeKind==='kv')!==null):-1;
  const pendingPositionField = (field: string) => !recognitionConfirmed && recognitionMarkers.some(marker => marker.key.startsWith("position-") && marker.key.endsWith("-" + field));
  const pendingPositionIndex = (field: string) => Number(recognitionMarkers.find(marker=>marker.key.startsWith("position-")&&marker.key.endsWith("-"+field))?.key.match(/^position-(\d+)-/)?.[1] ?? 0);
  const hasPendingRecognizedDueDate = !recognitionConfirmed && recognitionMarkers.some((marker) => marker.key === "dueDate");
  const currentTerm=intakeSuggestionState.kind==="data"?intakeSuggestionState.data.term:null;
  const termNeedsDecision=intakeTermExpired||!intakeTermChoice&&Boolean(currentTerm?.unavailableReason||currentTerm?.rating==="nicht_machbar"||currentTerm?.rating==="unmoeglich");
  const intakeChecklist: IntakeChecklistEntry[] = [
    { id: "kunde", decision:directCustomerMode==="NEW"&&intakeCustomerResults.length>0,label: "Kunde", detail: customerIssue?.detail ?? "vollständig", complete: customerIssue === null, step: 1, target: customerIssue?.target ?? "eingang.kundensuche" },
    { id: "bezeichnung", label: "Teil / Leistung", detail: firstMissingName >= 0 ? `Teil / Leistung eintragen · Position ${firstMissingName + 1}` : pendingPositionField("name") ? `Teil / Leistung ${recognitionMarkers.find(marker=>marker.key.endsWith("-name"))?.value ?? ""} · erkannt, bestätigen` : `${directItems.length} Position${directItems.length === 1 ? "" : "en"}`, complete: firstMissingName < 0 && !pendingPositionField("name"), pending: firstMissingName < 0 && pendingPositionField("name"), step: 2, target: "eingang.bezeichnung", targetIndex: firstMissingName >= 0 ? firstMissingName : pendingPositionIndex("name") },
    { id: "menge", label: "Menge", detail: firstMissingQuantity >= 0 ? `Menge eintragen · Position ${firstMissingQuantity + 1}` : pendingPositionField("quantity") ? `Menge ${recognitionMarkers.find(marker=>marker.key.endsWith("-quantity"))?.value ?? ""} · erkannt, bestätigen` : "vollständig", complete: firstMissingQuantity < 0 && !pendingPositionField("quantity"), pending: firstMissingQuantity < 0 && pendingPositionField("quantity"), step: 2, target: "eingang.menge", targetIndex: firstMissingQuantity >= 0 ? firstMissingQuantity : pendingPositionIndex("quantity") },
    { id: "einheit", label: "Einheit", detail: firstMissingUnit >= 0 ? `Einheit wählen · Position ${firstMissingUnit + 1}` : pendingPositionField("unit") ? `Einheit ${recognitionMarkers.find(marker=>marker.key.endsWith("-unit"))?.value ?? ""} · erkannt, bestätigen` : "vollständig", complete: firstMissingUnit < 0 && !pendingPositionField("unit"), pending: firstMissingUnit < 0 && pendingPositionField("unit"), step: 2, target: "eingang.einheit", targetIndex: firstMissingUnit >= 0 ? firstMissingUnit : pendingPositionIndex("unit") },
    { id: "oberflaeche", label: "Oberfläche", detail: firstMissingSurface >= 0 ? `Oberfläche wählen · Position ${firstMissingSurface + 1}` : pendingPositionField("surface") ? `Oberfläche ${recognitionMarkers.find(marker=>marker.key.endsWith("-surface"))?.value ?? ""} · erkannt, bestätigen` : "vollständig", complete: firstMissingSurface < 0 && !pendingPositionField("surface"), pending: firstMissingSurface < 0 && pendingPositionField("surface"), step: 2, target: "eingang.oberflaeche", targetIndex: firstMissingSurface >= 0 ? firstMissingSurface : pendingPositionIndex("surface") },
    ...(ports.canManageMoney&&(intakeKind==='kv'||firstInvalidPrice>=0)?[{id:'preis',label:'Preis',detail:firstInvalidPrice>=0?intakePriceError(directItems[firstInvalidPrice],intakeKind==='kv')!:'vollständig',complete:firstInvalidPrice<0,step:2 as const,target:'eingang.preis',targetIndex:Math.max(firstInvalidPrice,0)}]:[]),
    ...(ports.canManageMoney ? [{ id: "art", label: "Art", detail: intakeKind === "auftrag" ? "Auftrag" : "Art wählen", complete: intakeKind === "auftrag", step: 3 as const, target: "eingang.art" }] : []),
    { id: "liefertermin", decision:termNeedsDecision,label: "Liefertermin", detail: termNeedsDecision?intakeTermExpired?"Termin nicht mehr leistbar · Termin wählen":"Termin wählen · Wunsch zu knapp":directWishDate ? hasPendingRecognizedDueDate ? `Liefertermin ${directWishDate} · erkannt, bestätigen` : directWishDate : "Termin wählen", complete: isValidDateInput(directWishDate) && !isPastDateInput(directWishDate) && !hasPendingRecognizedDueDate&&!termNeedsDecision, pending: Boolean(directWishDate) && hasPendingRecognizedDueDate, step: 3, target: "eingang.liefertermin" },
    { id: "terminstatus", label: "Terminstatus", detail: intakeTermStatus === "wish" ? hasPendingRecognizedDueDate ? "Terminstatus Wunsch · erkannt, bestätigen" : "Wunsch" : intakeTermStatus === "confirmed" ? "bestätigt" : intakeTermStatus === "counter"?"Gegenvorschlag":"Terminstatus wählen", complete: Boolean(intakeTermStatus) && !hasPendingRecognizedDueDate, pending: Boolean(intakeTermStatus) && hasPendingRecognizedDueDate, step: 3, target: "eingang.terminstatus" },
    { id: "eingangsart", label: "Eingangsart", detail: intakeSource === "persoenlich" ? "persönlich angeliefert" : intakeSource === "versand" ? "Versand eingegangen" : intakeSource === "abholung_firma" ? "Abholung durch Firma" : intakeSource === "anfrage_mail" ? "Anfrage per Mail" : intakeSource === "anfrage_telefon" ? "Anfrage per Telefon" : "Eingangsart wählen", complete: Boolean(intakeSource), step: 3, target: "eingang.eingangsart" },
    { id: "uebergabe", label: "Übergabe", detail: intakeHandover === "PICKUP" ? "Abholung" : intakeHandover === "SHIPPING" ? "Versand" : "Übergabe wählen", complete: Boolean(intakeHandover), step: 3, target: "eingang.uebergabe" },
    ...(intakeHasGoods ? [{id:"geprueft",label:"Gemeinsam geprüft",detail:intakeChecked?"Ware gemeinsam geprüft":"Ware gemeinsam prüfen",complete:intakeChecked,step:3 as const,target:"eingang.geprueft"}] : []),
    ...(intakeHasGoods && !intakeSourceCaptures.some(capture=>capture.files.some(file=>file.captureOrigin==="warenfoto")) ? [{id:"eingangsfoto",label:"Eingangsfoto",detail:"Eingangsfoto fehlt · sperrt nicht",complete:false,warning:true,step:3 as const,target:"eingang.eingangsfoto-aufnehmen"}] : []),
    ...(ports.canManageMoney ? [{ id: "zahlungsmodus", label: "Zahlungsmodus", detail: intakePaymentMode === "abholung" ? "Bar oder Karte bei Abholung" : intakePaymentMode === "rechnung" ? "Rechnung auf Ziel" : intakePaymentMode === "vorkasse" ? "Vorkasse" : "Zahlungsmodus wählen", complete: Boolean(intakePaymentMode), step: 3 as const, target: "eingang.zahlungsmodus" }] : []),
  ];
  const requiredIntakeChecks = intakeChecklist.filter((entry) => !entry.warning);
  const completedIntakeChecks = requiredIntakeChecks.filter((entry) => entry.complete).length;
  const jumpToIntakeCheck = (entry: IntakeChecklistEntry) => {
    const focusTarget = () => {
      const roots = document.querySelectorAll<HTMLElement>(`[data-spec-id="${entry.target}"]`);
      const root = roots.item(entry.targetIndex ?? 0);
      if (!root) return;
      const target = root.matches("input, select, textarea, button, [tabindex]")
        ? root
        : root.querySelector<HTMLElement>("input, select, textarea, button, [tabindex]");
      root.scrollIntoView?.({ behavior: "smooth", block: "center" });
      target?.focus();
    };
    requestAnimationFrame(() => requestAnimationFrame(focusTarget));
  };

  const selectIntakeCustomer = useCallback((mode: "NONE" | "EXISTING", selected?: GlobalCreateCustomerChoice, markDirty = true, preserveIntakeChoices = false) => {
    setFeedback(null);
    intakeRecognizedQuery.current = null;
    if (markDirty) if (!preserveIntakeChoices) {
      setIntakeHandover("");
      setIntakeHandoverOrigin(null);
      setIntakePaymentMode("");
      setIntakePaymentOrigin(null);
    }
    if (mode === "NONE") {
      setDirectCustomerMode("NONE");
      setDirectCustomerId("");
      setDirectCustomer(EMPTY_INTAKE_CUSTOMER);
      setIntakeCustomerResults([]);
      setIntakePaymentOrigin(null);
      return;
    }
    if (!selected) return;
    const draft = customerChoiceToDraft(selected);
    setDirectCustomerMode("EXISTING");
    setDirectCustomerId(selected.id);
    setDirectCustomer(draft);
    if(!preserveIntakeChoices){
      const handover=selected.handoverPreference??selected.lastHandoverMode;
      if(handover){setIntakeHandover(handover==="pickup"?"PICKUP":"SHIPPING");setIntakeHandoverOrigin(selected.handoverPreference?"customer-card":"last-order");}
      const payment=handover?intakeCustomerPayment(draft,"EXISTING",handover,ports.canManageMoney,selected):intakePaymentBeforeHandover(draft,ports.canManageMoney,selected);
      setIntakePaymentMode(payment??"");setIntakePaymentOrigin(payment?"customer-card":null);
    }
    setCustomerChoices((current) => [selected, ...current.filter((entry) => entry.id !== selected.id)]);
    setIntakeCustomerQuery(selected.companyName ?? selected.name);
    setIntakeCustomerResults([]);
    if (preserveIntakeChoices && intakeHandover) {
      const payment = intakeCustomerPayment(draft,"EXISTING",intakeHandover === "PICKUP" ? "pickup" : "shipping",ports.canManageMoney,selected);
      setIntakePaymentMode(payment??"");setIntakePaymentOrigin(payment?"customer-card":null);
    }
  },[intakeHandover,ports.canManageMoney]);

  useEffect(()=>{
    const adopt=(event:Event)=>{
      const detail=(event as CustomEvent<{target?:string;capture?:IntakeCapture}>).detail;
      if(!open||step!=='direct-intake'||detail?.target!=='eingang'||!detail.capture||typeof detail.capture.id!=='string'||!Array.isArray(detail.capture.files))return;
      event.preventDefault();
      const capture=detail.capture;
      setIntakeSourceCaptures(current=>[...current.filter(source=>source.id!==capture.id),capture]);
      const text=captureRecognitionText(capture);
      if(text){intakeTextStand.current=crypto.randomUUID();setIntakeRecognitionText(current=>current.trim()?current:text);setRecognitionConfirmed(false);}
      const customer=customerChoices.find(choice=>choice.id===capture.customerId);
      if(customer)selectIntakeCustomer('EXISTING',customer,true,true);
      setFeedback(null);setIntakeToast('Mail übernommen · Eingaben bleiben erhalten');
    };
    window.addEventListener(INTAKE_MAIL_ADOPT_EVENT,adopt);return()=>window.removeEventListener(INTAKE_MAIL_ADOPT_EVENT,adopt);
  },[open,step,customerChoices,selectIntakeCustomer]);

  useEffect(() => {
    if (!intakeCustomerOverlayId) return;
    if (activeCustomerOverlayId === intakeCustomerOverlayId) {
      intakeCustomerOverlayWasOpen.current = true;
      return;
    }
    if (!intakeCustomerOverlayWasOpen.current) return;
    const customerId = intakeCustomerOverlayId;
    intakeCustomerOverlayWasOpen.current = false;
    setIntakeCustomerOverlayId(null);
    void listCustomers().then((result) => {
      if (result.code !== "OK") {
        setFeedback({ kind: result.code === "DENIED" ? "denied" : "error", message: result.message });
        return;
      }
      const refreshed = result.customers.find((entry) => entry.id === customerId);
      if (!refreshed) {
        setFeedback({ kind: "error", message: "Der ausgewählte Kunde konnte nach der Änderung nicht erneut gelesen werden." });
        return;
      }
      const draft = customerChoiceToDraft(refreshed);
      setDirectCustomerMode("EXISTING");
      setDirectCustomerId(refreshed.id);
      setDirectCustomer(draft);
      setCustomerChoices((current) => [refreshed, ...current.filter((entry) => entry.id !== refreshed.id)]);
      setIntakeCustomerQuery(refreshed.companyName ?? refreshed.name);
      setIntakeCustomerResults([]);
      if (intakeHandover) {
        const payment = intakeCustomerPayment(draft,"EXISTING",intakeHandover === "PICKUP" ? "pickup" : "shipping",ports.canManageMoney,refreshed);
        setIntakePaymentMode(payment??"");setIntakePaymentOrigin(payment?"customer-card":null);
      }
      setFeedback(null);
    }).catch((error: unknown) => {
      console.error("[EINGANG_CUSTOMER_REFRESH_FAILED]", {
        errorName: error instanceof Error ? error.name : "UnknownError",
        errorMessage: error instanceof Error ? error.message : "UnknownReadError",
      });
      setFeedback({ kind: "error", message: "Der ausgewählte Kunde konnte nach der Änderung nicht erneut gelesen werden." });
    });
  }, [activeCustomerOverlayId, intakeCustomerOverlayId, intakeHandover, listCustomers, ports.canManageMoney]);

  const openIntakeCustomerCreate = () => {
    if (!ports.canCreateCustomer) {
      setFeedback({ kind: "denied", message: `Das Profil ${ports.roleLabel} darf keine Kunden anlegen. Eine freigegebene Person ist für diesen Vorgang zuständig.` });
      return;
    }
    setFeedback(null);
    const initialCustomer = customerDraftFromSearch(intakeCustomerQuery);
    setCustomerType("");
    setCustomerDraft(initialCustomer);
    setCustomerNote("");
    setCustomerBaseline({ customerType: initialCustomer.customerType, customerDraft: initialCustomer, customerNote: "" });
    setCustomerClosePrompt(false);
    setCustomerDuplicateResults([]);
    setCustomerDuplicateState("idle");
    setCustomerDuplicateAcceptedFor("");
    requestIds.current.customer = "";
    setDirectCustomerMode("NEW");setDirectCustomerId("");setDirectCustomer(initialCustomer);setIntakePaymentMode("");setIntakePaymentOrigin(null);
  };

  const changeIntakeHandover = (value: "PICKUP" | "SHIPPING") => {
    setIntakeHandover(value);
    setIntakeHandoverOrigin(null);
    if (directCustomerMode === "NONE") {
      setIntakePaymentMode("");
      setIntakePaymentOrigin(null);
      return;
    }
    const shippingAdjustment = value === "SHIPPING" && intakePaymentMode === "abholung";
    const requested = shippingAdjustment ? "vorkasse" : intakePaymentOrigin === "manual" ? intakePaymentMode || undefined : undefined;
    const terms = customerChoices.find(entry=>entry.id===directCustomerId);
    const mode = directCustomerMode === "NEW" ? "NEW" : "EXISTING";
    const payment = intakeCustomerPayment(directCustomer,mode,value === "PICKUP" ? "pickup" : "shipping",ports.canManageMoney,terms,requested);
    setIntakePaymentMode(payment??"");
    setIntakePaymentOrigin(!payment ? null : shippingAdjustment ? "shipping" : intakePaymentOrigin === "manual" ? "manual" : customerFieldsDirty ? "customer-input" : "customer-card");
  };

  const changeIntakeCustomerFields = (value: CustomerDraft) => {
    setDirectCustomer(value);
    if (!intakeHandover || directCustomerMode === "NONE" || value.paymentPreference === directCustomer.paymentPreference && value.paymentTermDays === directCustomer.paymentTermDays) return;
    const mode=directCustomerMode === "NEW" ? "NEW" : "EXISTING", terms=customerChoices.find(entry=>entry.id===directCustomerId);
    const manual=intakePaymentOrigin === "manual" && intakePaymentMode ? intakeCustomerPayment(value,mode,intakeHandover === "PICKUP" ? "pickup" : "shipping",ports.canManageMoney,terms,intakePaymentMode) : null;
    const payment=manual??intakeCustomerPayment(value,mode,intakeHandover === "PICKUP" ? "pickup" : "shipping",ports.canManageMoney,terms);
    setIntakePaymentMode(payment??"");setIntakePaymentOrigin(!payment?null:manual?"manual":"customer-input");
  };

  const inlineCustomerInput=():Omit<CreateCustomerInput,"clientEventId">=>{
    const {customerType,salutation,paymentTermDays,handoverPreference,...fields}=directCustomer;
    const value:Omit<CreateCustomerInput,"clientEventId">={...fields,customerType:customerType as "business"|"privat",salutation:salutation||null,paymentTermDays:paymentTermDays?Number(paymentTermDays):null,handoverPreference:handoverPreference||null};
    if(!ports.canManageMoney){delete value.paymentPreference;delete value.paymentTermDays;delete value.iban;}
    return value;
  };
  const inlineCustomerChanges=()=>Object.fromEntries(inlineMissingFields.filter(field=>field in directCustomer).map(field=>[field,directCustomer[field as keyof CustomerFormValue]]));

  const saveProspect=async()=>{
    if(busy||directIntakeInFlight.current)return;
    if(!ports.saveProspect){setFeedback({kind:'error',message:'Interessent speichern ist nicht verbunden. Code: INTAKE_PROSPECT_PORT_UNAVAILABLE.'});return;}
    if(!prospectPending.current){
      if(directCustomerMode!=='NEW'||!ports.canCreateCustomer){setFeedback({kind:'validation',message:'Bitte einen Neukunden erfassen.'});return;}
      if(intakeCustomerResults.length){setFeedback({kind:'validation',message:'Noch offen: Kunde'});jumpToIntakeCheck({id:'kunde',label:'Kunde',detail:'Dublette prüfen',complete:false,step:1,target:'eingang.dublette'});return;}
      const invalid=Object.entries(kundeValidierung(directCustomer))[0];
      if(invalid){
        const ids:Record<string,string>={customerType:'kundentyp',companyName:'name',firstName:'vorname',lastName:'nachname',phone:'telefon',street:'strasse',houseNumber:'hausnummer',zipCode:'plz',city:'ort',country:'land'};
        setFeedback({kind:'validation',message:invalid[1]});jumpToIntakeCheck({id:'kunde',label:'Kunde',detail:invalid[1],complete:false,step:1,target:'eingang.'+(ids[invalid[0]]??invalid[0])});return;
      }
      prospectPending.current={clientKey:intakeClientKey,customer:inlineCustomerInput(),text:intakeRecognitionText,draft:draftPayload(),...(activeDraft?{activeDraft:{id:activeDraft.id,version:activeDraft.version}}:{})};
    }
    setLastIntakeAction('prospect');directIntakeInFlight.current=true;setBusy(true);setFeedback(null);
    try{
      const result=await ports.saveProspect(prospectPending.current);
      if(result.code!=='OK'){
        if(result.code!=='UNAVAILABLE')prospectPending.current=null;
        setFeedback({kind:'save-failed',message:'Speichern fehlgeschlagen · alle Eingaben sind noch da · '+result.message,requestId:intakeClientKey});return;
      }
      prospectPending.current=null;setOpen(false);setIntakeClosePrompt(false);
      window.dispatchEvent(new Event('kreile:intake-drafts-changed'));
      setIntakeToast(`Interessent ${result.customerNumber} angelegt · Angaben im Verlauf`);ports.openCustomer(result.customerId);
    }catch(cause){
      console.error('[INTAKE_PROSPECT_REQUEST_FAILED]',cause);
      setFeedback({kind:'save-failed',message:'Speichern fehlgeschlagen · alle Eingaben sind noch da. Code: INTAKE_PROSPECT_REQUEST_FAILED.',requestId:intakeClientKey});
    }finally{directIntakeInFlight.current=false;setBusy(false);}
  };

  const advanceIntakeCustomer = async (): Promise<boolean> => {
    const firstOpen = requiredIntakeChecks.find((entry) => !entry.complete);
    if (firstOpen?.step === 1) {
      setFeedback({ kind: "validation", message: `Noch offen: ${firstOpen.label}` });
      jumpToIntakeCheck(firstOpen);
      return false;
    }
    setFeedback(null);
    if (directCustomerMode==="NONE"||directCustomerMode==="EXISTING"&&!directCustomerId) {
      setFeedback({ kind: "validation", message: "Bitte einen Kunden auswählen." });
      return false;
    }
    return true;
  };

  const submitDirectIntake = async (event: FormEvent, customerKey = directCustomerId) => {
    event.preventDefault();
    if (directIntakeInFlight.current) return;
    if (!ports.canCreateOrder) {
      deny("quote");
      return;
    }
    const validDates = /^\d{4}-\d{2}-\d{2}$/.test(directWishDate) && /^\d{4}-\d{2}-\d{2}$/.test(directConfirmedDate);
    const items = directItems.map((item) => ({
      catalogServiceId: item.catalogServiceId === FREE_TEXT_SERVICE ? null : item.catalogServiceId,
      name: item.name.trim(),
      quantity: Number(item.quantity.replace(",", ".")),
      material: nullable(item.material),
      surfaceRequested: item.surfaceRequested.trim(),
      executionRequested: item.executionRequested,
      unit: item.unit,
      unitPriceCents: ports.canManageMoney ? item.unitPriceCents : null,
      vatRateBasisPoints: ports.canManageMoney && item.unitPriceCents!==null ? item.vatRateBasisPoints : null,
    }));
    const validCustomer = (directCustomerMode === "NEW" || directCustomerMode === "EXISTING" && customerKey.length > 0)
      && (directCustomerReadiness.issues.length === 0);
    if (!validCustomer || !validDates || !intakeTermStatus || !intakeSource || !intakeHandover || (ports.canManageMoney && !intakePaymentMode)
      || (intakeHasGoods&&!intakeChecked) || items.length < 1 || items.length > 20 || !directItems.every(intakePositionComplete)) {
      setFeedback({ kind: "validation", message: "Bitte Kunde, Position, Termin, Terminstatus, Eingangsart, Übergabe und Zahlungsmodus vollständig angeben." });
      return;
    }
    const id = intakeClientKey;
    setLastIntakeAction('book');
    directIntakeInFlight.current = true;
    setBusy(true);
    setFeedback(null);
    let originals:IntakeCapture[];
    try { originals=await saveIntakeTextOriginal(); }
    catch(cause){
      console.error("[INTAKE_ORIGINAL_BEFORE_BOOKING_FAILED]",cause);
      setFeedback({kind:"save-failed",message:"Original konnte nicht gesichert werden. Code: INTAKE_ORIGINAL_BEFORE_BOOKING_FAILED.",requestId:id});
      directIntakeInFlight.current=false;setBusy(false);return;
    }
    const input: DirectIntakeInput = {
      ...(originals.length?{sourceCaptures:originals.map(value=>({id:value.id,version:value.version}))}:{}),
      geprueft: intakeHasGoods && intakeChecked,
      ...(activeDraft?{draftId:activeDraft.id}:{}),
      clientEventId: id,
      customer: directCustomerMode === "NEW" ? {mode:"NEW",...inlineCustomerInput()} : {mode:"EXISTING",customerId:customerKey,...(Object.keys(inlineCustomerChanges()).length?{changes:inlineCustomerChanges()}:{})},
      // The existing F1.1 contract persists the confirmed commitment, never the non-binding wish.
      dueDate: directConfirmedDate,
      termStatus: intakeTermStatus === "confirmed" ? "bestaetigt" : intakeTermStatus === "counter" ? "gegenvorschlag" : "wunsch",
      wishDate:intakeTermChoice?.wishDate||directWishDate||null,termOrigin:intakeTermOrigin,processingWeeks:intakeProcessingWeeks,
      intakeSource,
      handoverMode: intakeHandover === "PICKUP" ? "pickup" : "shipping",
      ...(ports.canManageMoney && intakePaymentMode ? { paymentMode: intakePaymentMode } : {}),
      note: intakeSource === "anfrage_telefon" ? nullable(directNote) : null,
      items,
    };
    try {
      const created = await ports.createDirectIntake(input);
      if (created.code !== "OK") {
        setFeedback({ kind: "save-failed", message: created.message, requestId: id });
        return;
      }
      const readback = await ports.readDirectIntakeReceipt({ orderId: created.receipt.orderId, clientEventId: id });
      if (readback.code !== "OK" || readback.receipt.orderId !== created.receipt.orderId
        || readback.receipt.dueDate !== directConfirmedDate
        || readback.receipt.termStatus !== input.termStatus
        || readback.receipt.intakeSource !== input.intakeSource) {
        setFeedback({ kind: "error", message: "Der neue Eingang konnte nicht sicher erneut gelesen werden. Die Anfragekennung bleibt für den Support verfügbar.", requestId: id });
        return;
      }
      ports.refresh();
      window.dispatchEvent(new Event("kreile:intake-drafts-changed"));
      reset();
      setOpen(false);
      setIntakeToast(`Wareneingang gebucht · ${readback.receipt.orderNumber}${created.confirmationMessage?' · '+created.confirmationMessage:''}`);
      ports.openOrder(readback.receipt.orderId);
    } catch (error) {
      console.error("[EINGANG_AP01_BOOKING_REQUEST_FAILED]", {
        errorName: error instanceof Error ? error.name : "UnknownError",
        errorMessage: error instanceof Error ? error.message : "UnknownServerError",
      });
      setFeedback({
        kind: "save-failed",
        message: "Servermeldung nicht verfügbar. Fehlercode: EINGANG_AP01_BOOKING_REQUEST_FAILED.",
        requestId: id,
      });
    } finally {
      directIntakeInFlight.current = false;
      setBusy(false);
    }
  };

  const submitIntakePage = async (event: FormEvent) => {
    event.preventDefault();
    if (directIntakeInFlight.current) return;
    if (recognitionOverflow?.items.length) { setFeedback({kind:"validation",message:"Bitte die übrigen Positionen zuerst als weiteren Beleg speichern."}); return; }
    const firstOpen = requiredIntakeChecks.find((entry) => !entry.complete);
    if (firstOpen) {
      setFeedback({ kind: "validation", message: `Noch offen: ${firstOpen.label}` });
      jumpToIntakeCheck(firstOpen);
      return;
    }
    if (!await advanceIntakeCustomer()) return;
    await submitDirectIntake(event);
  };

  const copyRequestId = async () => {
    if (!feedback?.requestId) return;
    try {
      await navigator.clipboard.writeText(feedback.requestId);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const filteredCustomers = useMemo(() => {
    const query = customerQuery.trim().toLocaleLowerCase("de-DE");
    if (!query) return customerChoices;
    return customerChoices.filter((entry) => `${entry.customerNumber ?? ""} ${entry.name} ${entry.city ?? ""}`.toLocaleLowerCase("de-DE").includes(query));
  }, [customerChoices, customerQuery]);

  const surfaceOptions = ORDER_POSITION_SURFACES;

  const setPosition = (key: string, field: "name" | "quantity" | "material" | "surfaceRequested", value: string) => {
    setPositions((current) => current.map((position) => position.key === key ? { ...position, [field]: value } : position));
  };

  const setQuotePositionName = (key: string, name: string) => {
    const matches = catalogServices.filter((candidate) => candidate.name.localeCompare(name.trim(), "de-DE", { sensitivity: "base" }) === 0);
    const service = matches.length === 1 ? matches[0] : null;
    setPositions((current) => current.map((position) => position.key === key
      ? service
        ? {
            ...position,
            catalogServiceId: service.id,
            name: service.name,
            surfaceRequested: service.surface,
            unit: service.unit,
            unitPriceCents: service.netPriceCents ?? null,
          }
        : { ...position, catalogServiceId: FREE_TEXT_SERVICE, name, unit: "", unitPriceCents: null }
      : position));
  };

  const setQuotePositionSurface = (key: string, surfaceRequested: string) => {
    setPositions((current) => current.map((position) => {
      if (position.key !== key) return position;
      const service = catalogServices.find((candidate) => candidate.id === position.catalogServiceId);
      return service?.surface === surfaceRequested
        ? { ...position, surfaceRequested }
        : { ...position, catalogServiceId: FREE_TEXT_SERVICE, surfaceRequested, unit: "", unitPriceCents: null };
    }));
  };

  const setQuotePositionPrice = (key: string, euros: string) => {
    const parsed = Number.parseFloat(euros.replace(",", "."));
    setPositions((current) => current.map((position) => position.key === key
      ? { ...position, unitPriceCents: Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) : null }
      : position));
  };

  const aboveCards = (content: ReactNode) => createPortal(<KrApp geraet={geraet} portal>{content}</KrApp>, document.body);
  return (
    <>
      {ports.showPrimaryTrigger !== false ? <button type="button" className={styles.globalCreateButton} onClick={() => openWithIntent("DIRECT_INTAKE")} aria-label="Neu erfassen" aria-haspopup="dialog" aria-expanded={open}>
        <span className={styles.globalCreatePlus} aria-hidden="true">＋</span><span>Neu erfassen</span>
      </button> : null}
      {open && step === "choose" ? aboveCards(<IntakeCaptureDialog ports={ports} handoverToken={handoverToken} onClose={(message)=>{closeNow();if(message)setIntakeToast(message);}} onOrder={(customerId,source)=>void loadDirectIntake(customerId, Boolean(customerId)&&!source, undefined, source)} onCustomer={(source)=>{
        if(!ports.canCreateCustomer){deny("customer");return;}
        if(source&&!ports.createCustomerFromCapture)return "Kunde und Original können in diesem Stand noch nicht gemeinsam gespeichert werden · Code: CUSTOMER_INTAKE_PORT_MISSING.";
        navigate("customer");setCustomerSource(source?{itemId:source.id,version:source.version}:null);if(source){setIntakeSourceCaptures([source]);setCustomerRecognitionText(captureRecognitionText(source));}
      }} />) : null}
      {open && step === "customer" ? (() => {
        const customerDialog = <KrDialog
          key="customer"
          titel="Kunde anlegen"
          icon="user"
          groesse="werkbank"
          unterzeile={supplierCustomerMode ? "Lieferant anlegen" : undefined}
          schliessenSpecId="kundeneu.schliessen"
          vorSchliessen={()=>{if(busy)return false;if(customerChanged){requestCustomerClose();return false}return true;}}
          onSchliessen={closeCustomerNow}
          fuss={<>
            <KrButton data-spec-id="kundeneu.abbrechen" text="Abbrechen" onClick={requestCustomerClose} />
            <KrButton data-spec-id="kundeneu.kunde-speichern" form="kr-kunde-anlegen" type="submit" art="erledigen" icon="check" text={busy?"Wird gespeichert …":"Kunde speichern"} disabled={busy} />
          </>}
        >
          <form id="kr-kunde-anlegen" className="kr-stapel" noValidate onSubmit={(event) => void submitCustomer(event)}>
            {!customerCoreComplete && !customerName && !customerDraft.phone ? <div data-spec-id="kundeneu.zustand.leer"><Hinweis>Erst suchen – vielleicht gibt es den Kunden schon</Hinweis></div> : null}
            <div className="ev-werkbank">
              <div className="kr-stapel">
                <section className="ev-erfassen" aria-label="Schnell erfassen">
                  <div className="ev-erf-kopf"><b>Schnell erfassen</b></div>
                  <div className="ev-erf-text"><Textfeld data-spec-id="kundeneu.erfassen-text" aria-label="Schnell erfassen" rows={3} value={customerRecognitionText} onChange={event=>setCustomerRecognitionText(event.target.value)}/></div>
                  <div className="ev-erf-werkzeuge"><KrButton data-spec-id="kundeneu.angaben-erkennen" text={busy ? "Wird gelesen …" : "Angaben erkennen"} onClick={()=>void recognizeCustomer()} disabled={busy}/><KrButton data-spec-id="kundeneu.visitenkarte-scannen" icon="camera" text="Visitenkarte scannen" onClick={()=>setCaptureInIntake("visitenkarte")} disabled={busy}/><KrButton data-spec-id="kundeneu.internet-ergaenzen" art="sekundaer" text="Im Internet ergänzen · STUFE 4" disabled /></div>
                  {Object.keys(customerOrigins).length ? <div className={`ev-erkannt${Object.values(customerOrigins).some(origin=>origin?.startsWith("erkannt")) ? "" : " ev-erkannt--ok"}`} aria-live="polite">
                    <div className="ev-erkannt-kopf"><b>{Object.keys(customerOrigins).length} Angaben {Object.values(customerOrigins).some(origin=>origin?.startsWith("erkannt")) ? "erkannt und vorausgefüllt" : "bestätigt"}</b>
                      {Object.values(customerOrigins).some(origin=>origin?.startsWith("erkannt")) ? <KrButton data-spec-id="kundeneu.alles-bestaetigen" className="kr-btn--ton-blau" icon="check" text="Alles bestätigen" onClick={()=>setCustomerOrigins(current=>Object.fromEntries(Object.entries(current).map(([key,origin])=>[key,origin?.replace(/^erkannt/,"bestätigt")])))} /> : null}
                    </div><div className="ev-erk-chips">{Object.entries(customerOrigins).map(([key,origin])=><span className="ev-erk-chip" key={key}>{origin}<b>{String(customerDraft[key as keyof CustomerFormValue])}</b></span>)}</div>
                  </div> : null}
                </section>
                <KundeFormular autofocusField="customerType" prefix="kundeneu" mode="create" value={customerDraft} supplierMode={supplierCustomerMode} onChange={setCustomerDraft} origins={customerOrigins} canManageMoney={ports.canManageMoney} addressSuggestions={customerAddress?.suggestions} addressMessage={customerAddress?{tone:customerAddress.kind==="found"?"ok":customerAddress.kind==="not-checked"?"neutral":"warn",text:customerAddress.message}:null}/>
                {customerCoreComplete && customerOrderMissingFields.length > 0 ? <Hinweis><div className="kr-stapel" data-spec-id="kundeneu.zustand.teilweise">
                  <strong>Speicherbar als Interessent · für Auftrag fehlt: {customerOrderMissingFields.join(", ")}</strong>
                  <div className="kr-stapel">
                    <KrButton data-spec-id="kundeneu.als-interessent-speichern" art="primaer" text="Als Interessent speichern" onClick={() => void submitCustomer({ preventDefault() {} } as FormEvent)} />
                    <KrButton data-spec-id="kundeneu.weiter-ausfuellen" text="Weiter ausfüllen" onClick={() => {
                      const ids: Record<string, string> = { Ansprechpartner: "nachname", Vorname:"vorname",Anschrift:"strasse", "E-Mail": "email", Straße: "strasse", PLZ: "plz", Ort: "ort", Land: "land", Zahlungsbedingung: "zahlungsbedingung" };
                      const id = ids[customerOrderMissingFields[0] ?? ""];
                      if (id) document.querySelector<HTMLElement>(`[data-spec-id="kundeneu.${id}"]`)?.focus();
                    }} />
                  </div>
                </div></Hinweis> : null}
                {feedback ? <div data-spec-id="kundeneu.zustand.fehler" role="alert"><Hinweis ton="warn">{feedback.message}</Hinweis>{feedback.kind!=="validation"?<KrButton data-spec-id="kundeneu.erneut-speichern" text="Erneut speichern" onClick={()=>void submitCustomer({preventDefault(){}} as FormEvent)} disabled={busy}/>:null}</div>:null}
              </div>
              <PruefRail offeneAngaben={customerReadiness.fehlt.length}>
                {customerDuplicateState === "loading" ? <p aria-live="polite">Ähnliche Kunden werden gesucht …</p> : null}
                {customerDuplicateState === "error" ? <Hinweis ton="warn">Dublettenprüfung ist gerade nicht verfügbar. Eingaben bleiben erhalten.</Hinweis> : null}
                {customerDuplicateState === "ready" && !customerDuplicateResults.length ? <Hinweis ton="ok" icon="check">Keine Dublette gefunden · geprüft: Name, Telefon, E-Mail, Ort</Hinweis>:null}
                {customerDuplicateOpen ? <div className={`ev-kf-dub${customerDuplicateResults.some(customer=>customer.duplicateMatch?.kind==="exact") ? " ev-kf-dub--sicher" : ""}`} data-spec-id="kundeneu.dublette" tabIndex={-1}>
                  <header><strong>{customerDuplicateResults.some(customer=>customer.duplicateMatch?.kind==="exact")?"Diesen Kunden gibt es schon":"Ähnlicher Kunde vorhanden"}: {customerDuplicateResults[0]?.companyName ?? customerDuplicateResults[0]?.name}</strong></header>
                  <div className="ev-kf-dub-k">
                    {ports.canReadCustomers?<>
                      <KrButton data-spec-id="kundeneu.diesen-kunden-bearbeiten" text="Diesen Kunden bearbeiten" onClick={()=>{
                        const match=customerDuplicateResults[0];if(!match)return;
                        const prefill=Object.fromEntries(Object.entries(customerDraft).filter(([key,value])=>value!==customerBaseline.customerDraft[key as keyof CustomerFormValue])) as Partial<CustomerFormValue>;
                        setOpen(false);ports.openCustomer(match.id+"#uebernahme",prefill);
                      }}/>
                      <KrButton data-spec-id="kundeneu.vorhandenen-oeffnen" art="sekundaer" text="Vorhandenen öffnen" onClick={()=>{const match=customerDuplicateResults[0];if(match)ports.openCustomer(match.id)}}/>
                    </> : null}
                    <KrButton data-spec-id="kundeneu.ist-ein-anderer-kunde" text="Ist ein anderer Kunde" onClick={() => setCustomerDuplicateAcceptedFor(customerDuplicateQuery)} />
                  </div>
                </div> : null}
                {customerAddress ? <div className="ev-kf-adrz" role="status">{customerAddress.message}</div> : null}
                <section className="ev-kf-pl">
                  <b>Prüfliste</b><small>Pflicht</small>
                  {[{id:"kundentyp",label:"Firma oder Privat",value:customerType},{id:"name",label:"Name / Firma",value:customerName},{id:"telefon",label:"Telefon",value:customerDraft.phone}].map(row=><div className="ev-kf-pl-z" key={row.id} data-spec-id={"kundeneu.pruefliste."+row.id}><Chip text={row.value ? "ok" : "fehlt"} ton={row.value ? "ok" : "warn"}/>{row.label}</div>)}
                  <small>Für Aufträge nötig</small>
                  {[{id:"email",label:"E-Mail",value:customerDraft.email},{id:"anschrift",label:"Anschrift",value:customerAddress?.blocked?"prüfen":customerReadiness.fehlt.includes("Anschrift")?"":"OK"},...(ports.canManageMoney?[{id:"zahlungsbedingung",label:"Zahlungsbedingung",value:customerDraft.paymentPreference}]:[])].map(row=><div className="ev-kf-pl-z" key={row.id} data-spec-id={"kundeneu.pruefliste."+row.id}><Chip text={row.value === "prüfen" ? "prüfen" : row.value ? "ok" : "fehlt"} ton={row.value && row.value!=="prüfen" ? "ok" : "warn"}/>{row.label}</div>)}
                  <small className="ev-kf-pl-i" data-spec-id="kundeneu.pruefliste.info">Kundennummer wird beim Speichern vergeben</small>
                  <small className="ev-kf-pl-i">{customerReadiness.text}</small>
                </section>
              </PruefRail>
            </div>
          </form>
        </KrDialog>;
        const changedCustomerFields=[...new Set([...(customerType!==customerBaseline.customerType?["Kundentyp"]:[]),...(Object.keys(customerDraft) as Array<keyof CustomerFormValue>).filter(key=>customerDraft[key]!==customerBaseline.customerDraft[key]).map(key=>CUSTOMER_FIELD_LABELS[key]),...(customerNote!==customerBaseline.customerNote?["Notiz"]:[])])];
        const prompts=<>{customerDialog}{customerClosePrompt?<Rueckfrage felder={changedCustomerFields} beschaeftigt={busy} fehler={feedback?.message??null}
          hauptaktion={{text:"Speichern",lauftext:"Wird gespeichert …",ausfuehren:()=>void submitCustomer({preventDefault(){}} as FormEvent)}}
          onVerwerfen={closeCustomerNow} onWeiter={()=>{setCustomerClosePrompt(false);requestAnimationFrame(()=>customerLastFocus.current?.focus())}}/>:null}</>;
        return aboveCards(prompts);
      })() : null}
      {open && step === "direct-intake" ? aboveCards(
        <KrDialog
          key="intake"
          titel="Auftrag oder KV erfassen"
          icon="inbox"
          groesse="werkbank"
          schliessenSpecId="eingang.schliessen"
          vorSchliessen={()=>{if(busy||intakeClosePrompt||intakeCustomerOverlayId)return false;if(intakeDirty){requestClose();return false}return true;}}
          onSchliessen={closeNow}
          fuss={<><KrButton data-spec-id="eingang.abbrechen" text="Abbrechen" onClick={requestClose} /><KrButton data-spec-id="eingang.buchen" form="kr-neuer-eingang" type="submit" art="erledigen" icon="check" text={busy ? lastIntakeAction==='prospect'?"Wird gespeichert …":"Wird gebucht …" : "Wareneingang buchen"} disabled={busy} /></>}
        >
          <form data-spec-id="eingang" id="kr-neuer-eingang" className="kr-stapel" noValidate onSubmit={(event) => void submitIntakePage(event)}>
              {ports.resumeQuoteId ? <Hinweis><KrButton art="sekundaer" icon="arrow" text="Gespeicherten KV fortsetzen" disabled={busy} onClick={() => void resumeQuote()} /></Hinweis> : null}
              <div className="ev-werkbank"><div className="kr-stapel">
              <section className="ev-erfassen" aria-labelledby="quick-capture-title">
                <div className="ev-erf-kopf"><b id="quick-capture-title">Schnell erfassen</b></div>
                <div className="ev-erf-text"><Textfeld data-spec-id="eingang.erfassen-text" aria-label="Schnell erfassen" rows={3} maxLength={6000} value={intakeRecognitionText} onChange={(event) => { if(event.target.value.trim()!==intakeRecognitionText.trim())setIntakeDismissedConcerns([]);intakeTextStand.current=crypto.randomUUID();setIntakeRecognitionText(event.target.value); setRecognitionConfirmed(false); }} placeholder="Schreib oder füge Angaben ein …" /></div>
                <div className="ev-erf-werkzeuge">
                  {(!lastRecognizedText || intakeRecognitionText !== lastRecognizedText) ? <KrButton data-spec-id="eingang.angaben-erkennen" art={intakeRecognitionText.trim() ? "primaer" : "sekundaer"} text={recognitionBusy ? "Angaben werden erkannt …" : "Angaben erkennen"} disabled={recognitionBusy || !intakeRecognitionText.trim()} onClick={() => void recognizeDirectIntakeText()} /> : null}
                </div>
                <div className="ev-erf-werkzeuge">
                  <KrButton data-spec-id="eingang.aufnehmen" icon="camera" text="Aufnehmen" onClick={()=>setCaptureInIntake("eingang")} />
                  <KrButton data-spec-id="eingang.datei" icon="upload" text="Datei" onClick={()=>setCaptureInIntake("datei")} />
                  {ports.canReadMails?<KrButton data-spec-id="eingang.aus-mail" icon="mail" text="Aus Mail" onClick={()=>{
                    const request=new CustomEvent('kreile:oeffne',{detail:{ziel:'mailein',arg:'auswahl#eingang'},cancelable:true});
                    if(window.dispatchEvent(request))setFeedback({kind:'validation',message:'Mail-Auswahl noch nicht verfügbar · Fehlercode: INTAKE_MAIL_SELECTION_NOT_CONNECTED.'});
                  }}/>:null}
                </div>
                {intakeSourceCaptures.length?<div data-spec-id="eingang.dokument" className="kr-stapel"><strong>Originale dieser Erfassung</strong>{intakeSourceCaptures.flatMap(value=>value.files).map(file=><span key={file.id}>{file.name} · Original gesichert</span>)}</div>:null}
                {intakeConcerns.length ? <div className="ev-erk-chips" aria-label="Erkannte Anliegen">{intakeConcerns.map(concern=><span className="ev-erk-chip" key={concern.id} data-spec-id={"eingang.anliegen."+concern.id}>
                  {concern.label} · Vorschlag<KrButton art="leise" icon="x" text="" aria-label={concern.label+" abwählen"} data-spec-id={"eingang.anliegen."+concern.id+".abwaehlen"} onClick={()=>{intakeTextStand.current=crypto.randomUUID();setIntakeDismissedConcerns(previous=>[...previous,concern.id]);}}/>
                </span>)}</div>:null}
                {recognitionBusy ? <Hinweis>Angaben werden erkannt … Das Formular bleibt bedienbar.</Hinweis> : null}
                {recognitionOverflow?.items.length ? <Hinweis ton="warn"><span>{recognitionOverflow.total} Positionen erkannt · {recognitionOverflow.adopted} übernommen · {recognitionOverflow.items.length} noch offen</span><KrButton art="sekundaer" text={recognitionOverflow.saved ? "Rest als weiteren Beleg anlegen" : "Rest als zweiten Beleg anlegen"} disabled={busy} onClick={()=>void saveRecognitionOverflow()}/></Hinweis> : null}
                {recognitionOverflow && !recognitionOverflow.items.length && recognitionOverflow.saved ? <Hinweis ton="ok">{recognitionOverflow.saved === 1 ? "Weiterer Beleg" : `${recognitionOverflow.saved} weitere Belege`} als Entwurf gespeichert · auf Der Tag</Hinweis> : null}
                  {recognitionMarkers.length > 0 ? <div className={`ev-erkannt${recognitionConfirmed ? " ev-erkannt--ok" : ""}`} aria-live="polite">
                    <div className="ev-erkannt-kopf"><b>{recognitionConfirmed ? `${recognitionMarkers.length} Angaben bestätigt` : `${recognitionMarkers.length} Angaben erkannt und vorausgefüllt`}</b>
                      {!recognitionConfirmed ? <KrButton data-spec-id="eingang.alles-bestaetigen" className="kr-btn--ton-blau" icon="check" text="Alles bestätigen" onClick={() => setRecognitionConfirmed(true)} /> : null}
                    </div><div className="ev-erk-chips">{recognitionMarkers.map((marker) => <span className="ev-erk-chip" key={marker.key} data-spec-id={marker.key.includes("quantity") ? "eingang.menge.herkunft" : undefined}>{marker.label}<b>{marker.value}</b> · {recognitionConfirmed ? "bestätigt" : `erkannt · ${marker.source}`}</span>)}</div>
                  </div> : null}
              </section>
              <datalist id="kr-service-catalog">{catalogServices.map((service) => <option key={service.id} value={service.name}>{service.surface}</option>)}</datalist>
                <Abschnitt nr={0} label="Kunde">
                <h3 className="ev-abs-kopf"><span className="ev-nrkreis">1</span>Kunde <span style={{marginLeft:'auto'}}><KrButton data-spec-id="eingang.neukunde-anlegen" art="sekundaer" icon="plus" text="Neukunde anlegen" onClick={openIntakeCustomerCreate} disabled={!ports.canCreateCustomer}/></span></h3>
                <FormRaster>

                  <div className="kr-feld kr-voll"><span className="kr-feld-label">{directCustomerMode === "NONE" ? "Kunde suchen" : "Kunde"}</span>
                    {directCustomerMode === "NEW" ? <div data-spec-id="eingang.zustand.neukunde" className="kr-stapel"><KundeFormular mode="inline" prefix="eingang" value={directCustomer} onChange={changeIntakeCustomerFields} canManageMoney={ports.canManageMoney}/><KrButton data-spec-id="eingang.zurueck-zur-suche" text="Zurück zur Suche" onClick={()=>{setDirectCustomerMode("NONE");setDirectCustomerId("");setDirectCustomer(EMPTY_INTAKE_CUSTOMER);}}/></div> : directCustomerMode === "NONE" ? <div className="kr-stapel">
                      <Eingabe
                        data-spec-id="eingang.kundensuche"
                        data-intake-customer-search
                        data-autofocus
                        aria-label="Kunde suchen"
                        value={intakeCustomerQuery}
                        onChange={(event) => {
                          const value = event.target.value;
                          setIntakeCustomerQuery(value);
                          setFeedback(null);
                          if (value.trim().length < 2) {
                            setIntakeCustomerResults([]);
                            setIntakeCustomerSearchState("idle");
                          }
                        }}
                        placeholder="Name, Firma, Ansprechpartner, Telefon, E-Mail, Ort oder Kundennummer"
                      />
                      {!intakeCustomerQuery.trim() && intakeCustomerSearchState === "idle" ? <div data-spec-id="eingang.zustand.leer"><Hinweis>Kunde suchen oder Neukunde anlegen</Hinweis></div> : null}
                      {intakeCustomerSearchState === "loading" ? <p aria-live="polite">Kunden werden gesucht …</p> : null}
                      {intakeCustomerSearchState === "empty" ? <Hinweis>Kein Kunde gefunden.</Hinweis> : null}
                      {intakeCustomerResults.length > 0 ? <div className={styles.createCustomerList} aria-label="Kundentreffer">
                        {intakeCustomerResults.map((entry) => <button data-spec-id="eingang.kundensuche.treffer" type="button" key={entry.id} aria-label={`${entry.companyName ?? entry.name} · übernehmen`} onClick={() => selectIntakeCustomer("EXISTING", entry)}>
                          <span><strong>{entry.companyName ?? entry.name} · übernehmen</strong><small>{entry.customerNumber ?? "ohne Kundennummer"} · {entry.customerType === "privat" ? "Privatkunde" : entry.contactPerson ?? "kein Ansprechpartner"} · {entry.city ?? "ohne Ort"}</small></span>
                        </button>)}
                      </div> : null}
                    </div> : <div className="kr-stapel" data-spec-id="eingang.kundenzeile">
                      <Fakten zeilen={[{ k: "Name / Firma", v: customerDisplayName(directCustomer) }, { k: "Kundennummer", v: customerChoices.find((entry) => entry.id === directCustomerId)?.customerNumber ?? "fehlt" }]} />
                      {intakeOrigin === "customer-card" ? <Chip text="aus der Kundenkarte" ton="info" /> : null}{!ports.canManageMoney&&!directCustomer.paymentPreference?<Hinweis>{directCustomerReadiness.text}</Hinweis>:null}
                      <div className="kr-schnellleiste"><KrButton data-spec-id="eingang.kundenkarte" text="Kundenkarte" icon="open" onClick={()=>{intakeCustomerOverlayWasOpen.current=false;setIntakeCustomerOverlayId(directCustomerId);ports.openCustomer(directCustomerId);}}/><KrButton art="sekundaer" text="Anderer Kunde" onClick={() => selectIntakeCustomer("NONE")} /></div>
                    </div>}
                  </div>
                </FormRaster>
                {directCustomerMode === "EXISTING" && inlineMissingFields.length ? <div data-spec-id="eingang.zustand.teilweise_bestand" className="kr-stapel"><Hinweis ton="warn">Für Auftrag fehlt bei {customerDisplayName(directCustomer)}: {directCustomerReadiness.fehlt.join(", ")||"Angaben ergänzt · werden beim Buchen gespeichert"}</Hinweis><KrButton data-spec-id="eingang.jetzt-ergaenzen-bestand" text="Jetzt ergänzen" onClick={()=>{if(customerIssue)jumpToIntakeCheck({id:"kunde",label:"Kunde",detail:customerIssue.detail,complete:false,step:1,target:customerIssue.target});}}/><KundeFormular mode="inline" prefix="eingang" value={directCustomer} onChange={changeIntakeCustomerFields} canManageMoney={ports.canManageMoney} invoiceTermsEnabled={selectedCustomerOriginal?.invoiceTermsEnabled} invoiceTermDays={selectedCustomerOriginal?.invoiceTermDays} onlyFields={inlineMissingFields as Array<keyof CustomerFormValue>}/></div> : null}
                {directCustomerMode==='NEW'&&directCustomerReadiness.issues.length>0?<div data-spec-id="eingang.zustand.teilweise" className="kr-stapel"><Hinweis ton="warn">Für Auftrag fehlt bei {customerDisplayName(directCustomer)||'fehlt'}: {directCustomerReadiness.fehlt.join(', ')}</Hinweis><div className="kr-seite-werkzeug">
                  <KrButton data-spec-id="eingang.jetzt-ergaenzen" text="Jetzt ergänzen" onClick={()=>{if(customerIssue)jumpToIntakeCheck({id:'kunde',label:'Kunde',detail:customerIssue.detail,complete:false,step:1,target:customerIssue.target});}}/>
                  <KrButton data-spec-id="eingang.interessent-speichern" text={busy&&lastIntakeAction==='prospect'?'Wird gespeichert …':'Nur als Interessent speichern'} onClick={()=>void saveProspect()} disabled={busy}/>
                </div></div>:null}

</Abschnitt>

              <Abschnitt nr={1} label="Teile & Leistung">
                <h3 className="ev-abs-kopf"><span className="ev-nrkreis">2</span>Teile & Leistung</h3>
                <div className="kr-stapel">
                  {directItems.map((item, index) => <div className="ev-posform kr-form" key={item.key}>
                    <span className="kr-position-nr">{index + 1}</span>
                    <Feld label="Teil / Leistung"><Eingabe data-spec-id="eingang.bezeichnung" required minLength={1} maxLength={200} list="kr-service-catalog" placeholder="Katalog oder Freitext" value={item.name} onChange={(event) => setDirectPositionName(item.key, event.target.value)} /></Feld>
                    <Feld label="Menge"><>
                      <Eingabe aria-label="Menge" data-spec-id="eingang.menge" type="number" min="0.001" max="99999" step={item.unit === "stueck" || item.unit === "satz" ? "1" : "0.001"} aria-invalid={intakeQuantityError(item) !== null} value={item.quantity} onChange={(event) => updateDirectItem(item.key, "quantity", event.target.value)} />
                      {intakeQuantityError(item) ? <span className="kr-feld-fehler" data-spec-id="eingang.menge.fehler">{intakeQuantityError(item)}</span> : null}
                    </></Feld>
                    <Feld label="Einheit"><Auswahl data-spec-id="eingang.einheit" required value={item.unit ?? ""} onChange={(event) => setDirectPositionUnit(item.key, event.target.value)} optionen={[{ wert: "", text: "Bitte wählen" }, ...ORDER_POSITION_UNITS.map((unit) => ({ wert: unit.key, text: unit.label }))]} /></Feld>
                    <Feld label="Oberfläche" className="kr-pos-oberflaeche"><Auswahl data-spec-id="eingang.oberflaeche" required value={item.surfaceRequested} onChange={(event) => setDirectPositionSurface(item.key, event.target.value)} optionen={[{ wert: "", text: "Bitte wählen" }, ...ORDER_POSITION_SURFACES.map((surface) => ({ wert: surface.key, text: surface.label }))]} /></Feld>
                    <Feld label="Ausführung"><Auswahl data-spec-id="eingang.ausfuehrung" value={item.executionRequested} onChange={(event) => updateDirectItem(item.key, "executionRequested", event.target.value)} optionen={EXECUTION_OPTIONS} /></Feld>
                    <Feld label="Material"><Eingabe data-spec-id="eingang.material" maxLength={120} value={item.material} onChange={(event) => updateDirectItem(item.key, "material", event.target.value)} /></Feld>
                    {ports.canManageMoney?<Feld label="Preis netto je Einheit"><>
                      <Eingabe aria-label="Preis netto je Einheit" data-spec-id="eingang.preis" inputMode="decimal" aria-invalid={intakePriceError(item,intakeKind==='kv')!==null} value={item.priceText??(item.unitPriceCents===null?'':(item.unitPriceCents/100).toFixed(2).replace('.',','))} onChange={event=>{
                        const text=event.target.value.trim(),cents=/^\d+(?:[.,]\d{1,2})?$/.test(text)?Math.round(Number(text.replace(',','.'))*100):null;
                        setDirectItems(current=>current.map(line=>line.key===item.key?{...line,priceText:event.target.value,unitPriceCents:cents,vatRateBasisPoints:line.catalogServiceId===FREE_TEXT_SERVICE?cents===null?null:FREE_TEXT_VAT_RATE_BASIS_POINTS:line.vatRateBasisPoints}:line));
                      }}/>
                      {intakePriceError(item,intakeKind==='kv')?<span className="kr-feld-fehler" data-spec-id="eingang.preis.fehler">{intakePriceError(item,intakeKind==='kv')}</span>:<small>{item.unitPriceCents===null?'Preis fehlt':intakeQuantityError(item)?'Menge prüfen':`= ${euro(Math.round(Number(item.quantity.replace(',','.'))*item.unitPriceCents))} netto`}</small>}
                    </></Feld>:null}
                    {directItems.length > 1 ? <KrButton data-spec-id="eingang.position-entfernen" art="sekundaer" icon="x" label="Position entfernen" onClick={() => { setDirectItems((current) => current.filter((entry) => entry.key !== item.key)); }} /> : null}
                  </div>)}
                </div>
                <KrButton data-spec-id="eingang.position-hinzufuegen" art="sekundaer" icon="plus" text="Position hinzufügen" disabled={directItems.length >= 20} onClick={() => { setDirectItems((current) => [...current, newIntakePosition()]); }} />
              </Abschnitt>

                  <Abschnitt nr={2} label="Termin & Übergabe"><h3 className="ev-abs-kopf"><span className="ev-nrkreis">3</span>Termin & Übergabe</h3>
<FormRaster>
                  {ports.canManageMoney ? <Feld label="Art" voll><div data-spec-id="eingang.art"><Segment<"" | "auftrag" | "kv"> label="Art" wert={intakeKind} optionen={[{ wert: "auftrag", text: "Auftrag" }]} onWert={(value) => { setIntakeKind(value); }} /></div>{intakeOrigin ? <span data-spec-id="eingang.art.herkunft"><Chip text="aus Aufruf" ton="info" /></span> : null}</Feld> : null}
</FormRaster>
<IntakeTermBlock handover={intakeHandover} handoverOrigin={intakeHandoverOrigin} onHandover={changeIntakeHandover} weeks={intakeProcessingWeeks} onWeeks={setIntakeProcessingWeeks} term={intakeSuggestionState.kind==="data"?intakeSuggestionState.data.term:null} loading={intakeSuggestionState.kind==="loading"||intakeSuggestionState.kind==="data"&&intakeSuggestionState.loading} failed={intakeSuggestionState.kind==="error"} date={directWishDate} onDate={date=>{setRecognitionMarkers(current=>current.filter(marker=>marker.key!=="dueDate"));setDirectWishDate(date);setDirectConfirmedDate(date);setIntakeTermChoice(null);setIntakeTermOrigin(null);setIntakeTermExpired(false);setIntakeTermStatus(date?"wish":"");setIntakeWishDateOrigin(date?"manual":"empty");intakeTermManuallySet.current=false;}} choice={intakeTermChoice} onProposal={chooseIntakeProposal} onOffer={adoptIntakeTermSuggestion} onKeep={keepIntakeWish} onChange={changeIntakeTermChoice} canDecide={ports.canDecide===true} quote={intakeKind==="kv"} expired={intakeTermExpired} surfacePending={directItems.some(item=>{const surface=normaliseOrderPositionSurface(item.surfaceRequested);return surface===null||surface==="offen";})}/>
                {isPastDateInput(directWishDate)?<span className="kr-feld-fehler" data-spec-id="eingang.liefertermin.fehler">Liefertermin liegt in der Vergangenheit</span>:null}
                <FormRaster>
                  <Feld label="Termin ist"><div data-spec-id="eingang.terminstatus"><Segment<"" | "wish" | "confirmed" | "counter"> label="Termin ist" wert={intakeTermStatus} optionen={[{ wert: "wish", text: "Wunsch" }, { wert: "confirmed", text: "bestätigt" },...(intakeTermStatus==="counter"?[{wert:"counter" as const,text:"Gegenvorschlag"}]:[])]} onWert={(value) => { intakeTermManuallySet.current=true;setIntakeTermStatus(value); }} /></div>{intakeTermOrigin ? <small data-spec-id="eingang.terminstatus.herkunft">{{ wunsch_passt: "Wunsch passt", wunsch_knapp: "Wunsch knapp", ueber_auslastung: "Wunsch trotzdem zugesagt", vorschlag: "Vorschlag gewählt", gegenvorschlag: "Gegenvorschlag", wunsch_kv: "Wunsch übernommen (KV)" }[intakeTermOrigin]}</small> : null}</Feld>
                  <Feld label="Eingangsart"><Auswahl required data-spec-id="eingang.eingangsart" value={intakeSource} onChange={(event) => { setIntakeSource(event.target.value as typeof intakeSource); setIntakeSourceOrigin(null); }} optionen={[
                    { wert: "", text: "Bitte wählen" },
                    { wert: "persoenlich", text: "persönlich angeliefert" },
                    { wert: "versand", text: "Versand eingegangen" },
                    { wert: "abholung_firma", text: "Abholung durch Firma" },
                    { wert: "anfrage_mail", text: "Anfrage per Mail" },
                    { wert: "anfrage_telefon", text: "Anfrage per Telefon" },
                  ]} />{intakeSourceOrigin ? <span data-spec-id="eingang.eingangsart.herkunft"><Chip text={`vorgeschlagen · aus ${intakeSourceOrigin}`} ton="info" /></span> : null}</Feld>
                  {ports.canManageMoney ? <Feld label="Zahlungsmodus">
                    <div className="kr-stapel">
                      <Auswahl aria-label="Zahlungsmodus" required disabled={directCustomerMode === "NONE" || !intakeHandover} data-spec-id="eingang.zahlungsmodus" value={intakePaymentMode} onChange={(event) => {
                        setIntakePaymentMode(event.target.value as PaymentMode | "");
                        setIntakePaymentOrigin(event.target.value ? "manual" : null);
                        }} optionen={[
                        { wert: "", text: directCustomerMode === "NONE" ? "Zuerst Kunde wählen" : !intakeHandover ? "Zuerst Übergabe wählen" : "Bitte wählen" },
                        { wert: "vorkasse", text: "Vorkasse", gesperrt: !intakePaymentChoices.vorkasse.allowed },
                        { wert: "abholung", text: intakePaymentChoices.abholung.allowed ? "Bar oder Karte bei Abholung" : `Bar oder Karte bei Abholung (${intakePaymentChoices.abholung.reason})`, gesperrt: !intakePaymentChoices.abholung.allowed },
                        { wert: "rechnung", text: intakePaymentChoices.rechnung.allowed ? "Rechnung auf Ziel" : `Rechnung auf Ziel (${intakePaymentChoices.rechnung.reason})`, gesperrt: !intakePaymentChoices.rechnung.allowed },
                      ]} />
                      {intakePaymentOrigin === "shipping" ? <span data-spec-id="eingang.zahlungsmodus.herkunft"><Chip text="angepasst: Versand" ton="info" /></span> : null}{directCustomerMode === "EXISTING" && intakePaymentOrigin === "customer-card" && intakePaymentMode ? <span data-spec-id="eingang.zahlungsmodus.herkunft"><Chip text="aus Kundenkarte" ton="info" /></span> : null}
                    </div>
                  </Feld> : null}
                </FormRaster>
</Abschnitt>
<Abschnitt nr={3} label="Belege & Prüfung">
                <h3 className="ev-abs-kopf"><span className="ev-nrkreis">4</span>Belege & Prüfung</h3>
                {intakeHasGoods ? <><div data-spec-id="eingang.eingangsfoto"><KrButton icon="camera" text="Foto aufnehmen" data-spec-id="eingang.eingangsfoto-aufnehmen" onClick={()=>setCaptureInIntake("eingangsfoto")} /></div>{!intakeSourceCaptures.some(capture=>capture.files.some(file=>file.captureOrigin==="warenfoto")) ? <Hinweis ton="warn">Eingangsfoto fehlt</Hinweis> : null}<label className="kr-check"><input type="checkbox" data-spec-id="eingang.geprueft" checked={intakeChecked} onChange={event=>setIntakeChecked(event.target.checked)}/><span>Ware, Menge und Zustand gemeinsam geprüft</span></label></> : null}
                {intakeSource==="anfrage_telefon" ? <Feld label="Telefonnotiz" voll><Textfeld data-spec-id="eingang.telefonnotiz" rows={3} maxLength={2000} value={directNote} onChange={event=>setDirectNote(event.target.value)}/></Feld> : null}
                <FormRaster>
                  <Fakten zeilen={[
                    { k: "Art", v: "Auftrag" },
                    { k: "Kunde", v: directCustomerMode === "NONE" ? "fehlt" : customerDisplayName(directCustomer) || "fehlt" },
                    { k: "Positionen", v: String(directItems.length) },
                    { k: "Wunschtermin", v: directWishDate || "fehlt" },
                    { k: "Übergabe", v: intakeHandover === "PICKUP" ? "Abholung" : intakeHandover === "SHIPPING" ? "Versand" : "fehlt" },
                    ...(ports.canManageMoney ? [{ k: "Zahlungsart", v: intakePaymentMode === "abholung" ? "Bar oder Karte bei Abholung" : intakePaymentMode === "rechnung" ? "Rechnung auf Ziel" : intakePaymentMode === "vorkasse" ? "Vorkasse" : "fehlt" }] : []),
                  ]} />
                </FormRaster>
              </Abschnitt>

              </div><PruefRail offeneAngaben={requiredIntakeChecks.length-completedIntakeChecks}>
                {directCustomerMode!=='EXISTING'?<section data-spec-id="eingang.dublette" className="ev-kf-dub" aria-label="Dublettenprüfung">
                  <header><Icon name="user"/><strong>{intakeCustomerResults.length?'Ähnlicher Kunde vorhanden':'Dublettenprüfung'}</strong></header>
                  {intakeCustomerSearchState==='loading'?<p role="status">Kunden werden gesucht …</p>:intakeCustomerSearchState==='error'?<p role="alert">Dublettenprüfung nicht verfügbar · Kundensuche erneut versuchen.</p>:intakeCustomerResults.length?<div className="ev-kf-dub-z">{intakeCustomerResults.slice(0,3).map(customer=><div key={customer.id}><b>{customer.companyName??customer.name}</b><small>{customer.customerNumber??'Kundennummer fehlt'} · {customer.city??'Ort fehlt'}</small><KrButton data-spec-id="eingang.diesen-kunden-verwenden" text="Diesen Kunden verwenden" onClick={()=>selectIntakeCustomer('EXISTING',customer)}/></div>)}</div>:<p>{intakeCustomerSearchState==='empty'?'Kein Kunde zur Suche gefunden.':'Kunde suchen – mögliche Dubletten erscheinen hier.'}</p>}
                </section>:null}
                <aside className="ev-pruef" aria-label="Prüfliste" data-spec-id="eingang.pruefliste">
                <header><b>Prüfen</b><span>{completedIntakeChecks} von {requiredIntakeChecks.length} Pflichtangaben</span></header>
                  <progress value={completedIntakeChecks} max={requiredIntakeChecks.length}>{completedIntakeChecks} von {requiredIntakeChecks.length}</progress>
                <div>
                  <h3 className="ev-pl-gr">Pflicht</h3>
                  {requiredIntakeChecks.map((entry) => <button className={`ev-pl-z ev-pl-z--${entry.complete ? "gruen" : entry.pending ? "navy" : "warn"}`} data-spec-id={`eingang.pruefliste.${entry.id}`} type="button" key={entry.id} data-state={entry.complete ? "ok" : entry.decision?"entscheiden":entry.pending ? "pending" : "open"} onClick={() => jumpToIntakeCheck(entry)}>
                    <Icon name={entry.complete ? "check" : "alert"} />
                    <span><strong>{entry.label}</strong><small>{entry.detail}</small></span>
                    <Chip text={entry.complete ? "ok" : entry.decision ? `${entry.label} klären` : entry.pending ? `${entry.label} bestätigen` : `${entry.label} ${["bezeichnung","menge","preis"].includes(entry.id) ? "eintragen" : entry.id === "geprueft" ? "bestätigen" : "wählen"}`} ton={entry.complete ? "ok" : "warn"} />
                  </button>)}
                </div>
                {intakeChecklist.some((entry) => entry.warning) ? <div>
                  <h3 className="ev-pl-gr">Hinweis</h3>
                  {intakeChecklist.filter((entry) => entry.warning).map((entry) => <button className="ev-pl-z ev-pl-z--warn" data-spec-id={`eingang.pruefliste.${entry.id}`} type="button" key={entry.id} data-state="warning" onClick={() => jumpToIntakeCheck(entry)}>
                    <Icon name="alert" />
                    <span><strong>{entry.label}</strong><small>{entry.detail}</small></span>
                    <em>Hinweis</em>
                  </button>)}
                </div> : null}
              </aside></PruefRail></div>

              {feedback && !intakeClosePrompt ? <>
                <div data-spec-id={feedback.kind === "save-failed" ? "eingang.zustand.fehler" : undefined}><Hinweis ton={feedback.kind === "validation" ? "warn" : undefined}><span><strong>{feedback.kind === "save-failed" ? "Speichern fehlgeschlagen · alle Eingaben sind noch da" : feedback.kind === "unclear" ? "Ausgang ungeklärt" : "Eingabe prüfen"}</strong><br />{feedback.message}</span></Hinweis></div>
                {feedback.kind === "save-failed" ? <KrButton data-spec-id="eingang.erneut-buchen" art="primaer" text={busy ? lastIntakeAction==='prospect'?"Wird gespeichert …":"Wird gebucht …" : lastIntakeAction==='prospect'?'Erneut speichern':"Erneut buchen"} onClick={() => lastIntakeAction==='prospect'?void saveProspect():void submitDirectIntake({ preventDefault() {} } as FormEvent)} disabled={busy} /> : null}
                {feedback.kind === "unclear" ? <div className="kr-stapel">
                  <KrButton art="sekundaer" text="Status mit gleicher Kennung prüfen" onClick={() => void checkUnclearStatus()} disabled={busy} />
                  {statusChecked ? <KrButton text={retryConfirmed ? "Ja, jetzt erneut senden" : "Erneut senden vorbereiten"} onClick={retryAfterStatusCheck} disabled={busy} /> : null}
                </div> : null}
              </> : null}
          </form>
        </KrDialog>
      ) : null}
      {open && intakeClosePrompt ? aboveCards(
        <Rueckfrage felder={intakeChangedLabels} hauptaktion={ports.canCreateOrder&&requiredIntakeChecks.every(check=>check.complete)?{text:"Buchen",lauftext:"Wird gebucht …",ausfuehren:()=>void submitDirectIntake({preventDefault(){}} as FormEvent)}:undefined}
          onEntwurf={()=>void saveIntakeDraft()} beschaeftigt={busy} fehler={feedback&&["save-failed","error","unclear","conflict"].includes(feedback.kind)?feedback.message:null}
          onWeiter={()=>{setIntakeClosePrompt(false);requestAnimationFrame(()=>{if(intakeLastFocus.current?.isConnected)intakeLastFocus.current.focus()})}}
          onVerwerfen={()=>void discardIntake()} />
      ) : null}
      {open && step !== "choose" && step !== "customer" && step !== "direct-intake" ? (
        <div className={styles.createOverlay} onMouseDown={(event) => { if (event.target === event.currentTarget) closeNow(); }}>
          <section ref={dialogRef} className={styles.createDialog} role="dialog" aria-modal="true" aria-labelledby="global-create-title" onKeyDown={handleDialogKey}>
            <header className={styles.createHeader}>
              <span className={styles.createBadge}><Plus /></span>
              <div>
                <p>Kunde <span>›</span> KV / Angebot <span>›</span> Auftrag</p>
                <h2 id="global-create-title">{step === "customer-saved" ? "Kunde gesichert" : step === "customer-picker" ? "Kunde für KV wählen" : step === "quote-list" ? "Offene KVs" : step === "quote" ? quote ? "KV bearbeiten" : "Kostenvoranschlag anlegen" : step === "quote-saved" ? "KV gesichert" : step === "order-saved" ? "Auftrag angelegt" : "Berechtigung klären"}</h2>
              </div>
              <button type="button" className={styles.createIconButton} onClick={closeNow} disabled={busy} aria-label="Anlegen schließen"><X /></button>
            </header>

            <div className={styles.createBody}>
              {step === "denied" ? (
                <section className={styles.createDenied} role="alert">
                  <h3>Diese Handlung gehört zu einem anderen Profil.</h3>
                  <p>{feedback?.message}</p>
                  <button type="button" onClick={() => void ports.switchProfile()} disabled={busy} data-autofocus>Zum sicheren Profilwechsel</button>
                </section>
              ) : null}

              {step === "customer-saved" && customer && customerReceipt ? (
                <div className={styles.createSuccess}>
                  <span className={styles.createSuccessIcon}><Check /></span>
                  <h3>{customer.name} · {customer.customerNumber}</h3>
                  <p>{customerCompleteForOrder ? "Der Kunde ist vollständig gespeichert und im aktuellen Datenstand wiedergefunden." : "Der Interessent ist gespeichert und als unvollständig für einen Auftrag markiert."}</p>
                  <ReceiptFacts title="Kundenanlage – technische Details für Support" values={[["Vorgangskennung", customerReceipt.receiptId], ["Nachweis", customerReceipt.eventId], ["Zeit", customerReceipt.recordedAt]]} />
                  <div className={styles.createChoiceGrid}>
                    {customerCompleteForOrder ? <button type="button" onClick={() => void startQuote(customer)} data-autofocus><FileText /><span><strong>KV / Angebot anlegen</strong><small>Mit diesem vollständigen Kunden weiterarbeiten.</small></span></button> : null}
                    <button type="button" className={styles.createChoiceAlternate} onClick={() => { setOpen(false); ports.openCustomer(customer.id); }} data-autofocus={!customerCompleteForOrder || undefined}><UserPlus /><span><strong>{customerCompleteForOrder ? "Kundenkarte öffnen" : "Stammdaten vervollständigen"}</strong><small>{customerCompleteForOrder ? "Gespeicherten Stammdatensatz prüfen." : "Die Kundenkarte zeigt alle noch fehlenden Auftragsdaten."}</small></span></button>
                  </div>
                </div>
              ) : null}

              {step === "customer-picker" ? (
                <div>
                  <label className={styles.createSearch}>Kunde suchen<input data-autofocus value={customerQuery} onChange={(event) => setCustomerQuery(event.target.value)} placeholder="Name, Kundennummer oder Ort" /></label>
                  {customerLoad === "loading" ? <p className={styles.createLoading} role="status"><Loader2 className={styles.createSpinner} /> Kundenstamm wird sicher gelesen …</p> : null}
                  {customerLoad === "empty" ? <div className={styles.createEmpty}><h3>Noch kein belegter Kunde</h3><p>Datenstand: Der Kundenstamm ist geladen und enthält keinen passenden Kunden. Nächster Schritt: Kunde anlegen.</p>{ports.canCreateCustomer ? <button type="button" onClick={() => navigate("customer")}>Kunde anlegen</button> : null}</div> : null}
                  {customerLoad === "ready" && filteredCustomers.length === 0 ? <div className={styles.createEmpty}><h3>Keine belegte Übereinstimmung</h3><p>Der geladene Kundenstamm wurde nach Name, Kundennummer und Ort geprüft.</p></div> : null}
                  <div className={styles.createCustomerList}>{filteredCustomers.map((entry) => <button type="button" key={entry.id} onClick={() => void startQuote(entry)}><span><strong>{entry.name}</strong><small>{entry.customerNumber ?? "ohne Kundennummer"}{entry.city ? ` · ${entry.city}` : ""}</small></span><FileText /></button>)}</div>
                </div>
              ) : null}

              {step === "quote-list" ? (
                <section className={styles.createPanel} aria-label="Offene KVs">
                  {openQuotesState.kind === "idle" || openQuotesState.kind === "loading" ? <p className={styles.createLoading} role="status"><Loader2 className={styles.createSpinner} /> Offene KVs werden geladen …</p> : null}
                  {openQuotesState.kind === "empty" ? <div className={styles.createEmpty} role="status"><h3>Keine offenen KVs</h3><p>Es ist derzeit kein gespeicherter KV zur Weiterbearbeitung offen.</p></div> : null}
                  {openQuotesState.kind === "data" ? <div className={styles.createCustomerList}>{openQuotesState.quotes.map((draft) => <button type="button" key={draft.quoteId} onClick={() => editQuote(draft)}><span><strong>{draft.quoteNumber} · {draft.customerDisplayName}</strong><small>Stand {draft.version} · Terminwunsch {draft.dueDate} · {euro(draft.totalNetCents)} netto</small></span><FileText /></button>)}</div> : null}
                  {openQuotesState.kind === "denied" || openQuotesState.kind === "error" || openQuotesState.kind === "unknown" ? <section className={styles.createFeedback} data-kind={openQuotesState.kind === "unknown" ? "unclear" : openQuotesState.kind === "denied" ? "denied" : "error"} role="alert"><strong>{openQuotesState.kind === "denied" ? "Zugriff nicht freigegeben" : openQuotesState.kind === "unknown" ? "Stand noch nicht geklärt" : "Offene KVs konnten nicht geladen werden"}</strong><p>{openQuotesState.message}</p>{openQuotesState.requestId ? <details><summary>Technische Details für Support</summary><code>{openQuotesState.requestId}</code></details> : null}</section> : null}
                </section>
              ) : null}

              {step === "quote" && customer ? (
                <form className={styles.createForm} onSubmit={(event) => void submitQuote(event)}>
                  <div className={styles.createContext}><span>Kunde</span><strong>{customer.name} · {customer.customerNumber ?? "Kundennummer wird gelesen"}</strong></div>
                  <div className={styles.createPositions}>
                    <h3>Positionen</h3>
                    {positions.map((position, index) => (
                      <fieldset key={position.key} className={styles.createPosition}>
                        <legend>Position {index + 1}</legend>
                        <label className={styles.createFieldWide}>Teil / Leistung<input data-autofocus={index === 0 || undefined} required minLength={2} list="kr-service-catalog" placeholder="Katalog oder Freitext" value={position.name} onChange={(event) => setQuotePositionName(position.key, event.target.value)} /></label>
                        <label>Menge<input required inputMode="numeric" type="number" min="1" max="1000000" value={position.quantity} onChange={(event) => setPosition(position.key, "quantity", event.target.value)} /></label>
                        <label>Material<input value={position.material} onChange={(event) => setPosition(position.key, "material", event.target.value)} /></label>
                        <label>Oberfläche<select required value={position.surfaceRequested} onChange={(event) => setQuotePositionSurface(position.key, event.target.value)}><option value="">Bitte wählen</option>{surfaceOptions.map((surface) => <option key={surface.key} value={surface.key}>{surface.label}</option>)}</select></label>
                        <label>Einheit<input readOnly value={position.unit} /></label>
                        <label>Preis netto (€)<input required type="number" min="0" step="0.01" readOnly={position.catalogServiceId !== FREE_TEXT_SERVICE} value={position.unitPriceCents === null ? "" : String(position.unitPriceCents / 100)} onChange={(event) => setQuotePositionPrice(position.key, event.target.value)} /></label>
                        {positions.length > 1 ? <button type="button" className={styles.createRemove} onClick={() => setPositions((current) => current.filter((entry) => entry.key !== position.key))} aria-label={`Position ${index + 1} entfernen`}><Trash2 /></button> : null}
                      </fieldset>
                    ))}
                    {positions.length < 20 ? <button type="button" className={styles.createAddPosition} onClick={() => setPositions((current) => [...current, newPosition()])}><Plus /> Position hinzufügen</button> : null}
                  </div>
                  <div className={styles.createFormGrid}>
                    <label>Gewünschter Termin<input required type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label>
                    <label className={styles.createFieldWide}>Hinweis zum KV<textarea rows={3} value={quoteNote} onChange={(event) => setQuoteNote(event.target.value)} /></label>
                  </div>
                  <p className={styles.createPassive}>Die Angebotssumme wird erst aus dem gespeicherten KV übernommen.</p>
                  <div className={styles.createFormActions}><button type="button" onClick={() => customerReceipt ? navigate("customer-saved") : void loadCustomers()}>Zurück</button><button type="submit" className={styles.createPrimary} disabled={busy}>{busy ? <Loader2 className={styles.createSpinner} /> : <Check />} KV sichern</button></div>
                </form>
              ) : null}

              {step === "quote-saved" && quote ? (
                <div className={styles.createSuccess}>
                  <span className={styles.createSuccessIcon}><Check /></span>
                  <h3>{quote.quoteNumber} gesichert</h3>
                  <p>{quote.customerDisplayName} · {quote.positions.length} {quote.positions.length === 1 ? "Position" : "Positionen"} · {euro(quote.totalNetCents)} netto.</p>
                  <div className={styles.createContext}><span>KV-Stand</span><strong>{quote.status === "draft" ? "in Vorbereitung" : "beauftragt"}</strong><span>Bearbeitungsstand</span><strong>Stand {quote.version}</strong><span>Terminwunsch</span><strong>{quote.dueDate}</strong></div>
                  {quoteReceipt ? <ReceiptFacts title="KV – technische Details für Support" values={[["Vorgangskennung", quoteReceipt.receiptId], ["Nachweis", quoteReceipt.eventId], ["Zeit", quoteReceipt.recordedAt]]} /> : <p className={styles.createReadback}>Der KV ist sicher gespeichert und kann weiterbearbeitet werden.</p>}
                  <div className={styles.createFormActions}><a className={styles.createDownload} href={`/api/documents/${encodeURIComponent(quote.quoteId)}/quote-pdf`} target="_blank" rel="noreferrer">KV als PDF</a>{quote.status === "draft" ? <button type="button" onClick={() => editQuote(quote)} disabled={busy}>KV bearbeiten</button> : null}</div>
                  {quote.status === "draft" ? <div className={styles.createAwardBlock}>
                    <label htmlFor="confirmed-order-due-date">Zugesagter Termin für den Auftrag</label>
                    <input id="confirmed-order-due-date" required type="date" value={confirmedOrderDueDate} onChange={(event) => setConfirmedOrderDueDate(event.target.value)} aria-describedby="confirmed-order-due-date-help" aria-invalid={!confirmedOrderDueDateValid} data-autofocus />
                    <label htmlFor="quote-award-handover">Übergabe</label>
                    <select id="quote-award-handover" value={awardHandoverMode} onChange={(event) => {
                      const mode = event.target.value as "pickup" | "shipping";
                      setAwardHandoverMode(mode);
                      if (mode === "shipping" && awardPaymentMode === "abholung") setAwardPaymentMode("vorkasse");
                    }}><option value="pickup">Abholung</option><option value="shipping">Versand</option></select>
                    <label htmlFor="quote-award-payment">Zahlungsart</label>
                    <select id="quote-award-payment" value={awardPaymentMode} onChange={(event) => setAwardPaymentMode(event.target.value as "vorkasse" | "abholung" | "rechnung")}>
                      <option value="abholung" disabled={awardHandoverMode !== "pickup"}>Bar oder Karte bei Abholung</option>
                      <option value="vorkasse">Vorkasse</option>
                      <option value="rechnung">Rechnung auf Ziel</option>
                    </select>
                    <p id="confirmed-order-due-date-help" className={styles.createAwardHelp}>{confirmedOrderDueDateValid ? "Termin, Übergabe und Zahlungsart werden verbindlich an den Auftrag übergeben." : "Bitte vor dem Zuschlag einen gültigen Auftragstermin festlegen."}</p>
                    <button type="button" className={styles.createAward} onClick={() => void convertQuote()} disabled={busy || !confirmedOrderDueDateValid}>{busy ? <Loader2 className={styles.createSpinner} /> : <Check />} Zuschlag bestätigen · Auftrag anlegen</button>
                  </div> : null}
                </div>
              ) : null}

              {step === "order-saved" && conversion ? (
                <div className={styles.createSuccess}>
                  <span className={styles.createSuccessIcon}><Check /></span>
                  <h3>Auftrag {conversion.orderReceipt.orderNumber} angelegt</h3>
                  <p>Der Zuschlag ist bestätigt. Der Auftrag wurde sicher angelegt und ist mit diesem KV verknüpft.</p>
                  <ReceiptFacts title="Auftrag – technische Details für Support" values={[["KV-Nachweis", conversion.quoteReceipt.receiptId], ["Auftragsnachweis", conversion.orderReceipt.receiptId], ["Zeit", conversion.orderReceipt.recordedAt]]} />
                  <div className={styles.createFormActions}><button type="button" onClick={() => { reset(); void loadDirectIntake(); }}>Weiteren Eingang anlegen</button><button type="button" className={styles.createPrimary} onClick={() => { setOpen(false); ports.openOrder(conversion.orderReceipt.orderId); }} data-autofocus>Auftragskarte öffnen</button></div>
                </div>
              ) : null}

              {feedback && step !== "denied" ? (
                <section className={styles.createFeedback} data-kind={feedback.kind} role="alert">
                  <strong>{feedback.kind === "unclear" ? "Ausgang ungeklärt" : feedback.kind === "conflict" ? "Konflikt" : feedback.kind === "denied" ? "Zugriff verweigert" : feedback.kind === "validation" ? "Eingaben prüfen" : "Vorgang nicht abgeschlossen"}</strong>
                  <p>{feedback.message}</p>
                  {feedback.message.includes("Firmendaten") ? <a href="/settings?returnTo=%2F">Firmendaten jetzt einrichten</a> : null}
                  {feedback.requestId ? <div><code>{feedback.requestId}</code><button type="button" onClick={() => void copyRequestId()} aria-label="Anfragekennung kopieren"><ClipboardCopy /> {copied ? "Kopiert" : "Kennung kopieren"}</button></div> : null}
                  {feedback.kind === "unclear" ? <div className={styles.createStatusActions}><button type="button" className={styles.createStatusCheck} onClick={() => void checkUnclearStatus()} disabled={busy}>Status mit gleicher Kennung prüfen</button>{statusChecked ? <button type="button" onClick={retryAfterStatusCheck} disabled={busy}>{retryConfirmed ? "Ja, jetzt erneut senden" : "Erneut senden vorbereiten"}</button> : null}</div> : null}
                </section>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
      {open&&captureInIntake?aboveCards(<IntakeCaptureDialog ports={ports} mode={captureInIntake}
        onClose={()=>setCaptureInIntake(false)} onOrder={()=>undefined} onCustomer={()=>undefined}
        onAdopt={(value,message)=>{
          setIntakeSourceCaptures(previous=>[...previous.filter(existing=>existing.id!==value.id),value]);
          const text=captureRecognitionText(value);
          if(captureInIntake==="visitenkarte"){setCustomerRecognitionText(text);if(text)void recognizeCustomer(text);}
          else if(text){intakeTextStand.current=crypto.randomUUID();setIntakeRecognitionText(text);setRecognitionConfirmed(false);}
          setCaptureInIntake(false);setIntakeToast(message);
        }}/>):null}
      {intakeToast ? <Toast text={intakeToast} /> : null}
    </>
  );
}
