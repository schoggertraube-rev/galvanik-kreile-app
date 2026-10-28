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
import { FormEvent, KeyboardEvent, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { CreateCustomerInput, UpdateCustomerCommercialInput } from "@/modules/customers/public";
import type { CatalogService } from "@/modules/katalog/public";
import { paymentModeFromPreference, type PaymentMode } from "@/lib/server/paymentContract";
import {
  Abschnitt,
  AbschnittNav,
  Auswahl,
  Button as KrButton,
  Checkbox,
  Dialog as KrDialog,
  Eingabe,
  Fakten,
  Feld,
  FormRaster,
  Hinweis,
  SchrittNav,
  Segment,
  Textfeld,
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
import { F1SourceDialogs, type F1SourceMode } from "./F1SourceDialogs";
import { GLOBAL_CREATE_OPEN_EVENT, type GlobalCreateIntent, type GlobalCreateRequest } from "./globalCreateRequest";
import styles from "./TargetShell.module.css";

export { requestGlobalCreate } from "./globalCreateRequest";
export type { GlobalCreateIntent, GlobalCreateRequest } from "./globalCreateRequest";

type FailureCode =
  | "FORBIDDEN"
  | "UNAUTHENTICATED"
  | "NOT_FOUND"
  | "CONFLICT"
  | "VALIDATION_ERROR"
  | "IN_KLAERUNG"
  | "UNAVAILABLE";

type Failure = { code: FailureCode; message: string };

export type GlobalCreateCustomerChoice = {
  id: string;
  customerNumber: string | null;
  name: string;
  customerType?: "business" | "privat" | "institution";
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
      customer: { id: string; customerNumber: string | null; name: string };
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
  clientEventId: string;
  customer: { mode: "EXISTING"; customerId: string } | {
    mode: "NEW"; name: string; customerType: "business" | "privat" | "institution";
    companyName: string | null; contactPerson: string | null; email: string | null; phone: string | null;
    street: string; zipCode: string; city: string | null; country: string; paymentPreference: string; vatId: string | null;
  };
  dueDate: string;
  handoverMode: "pickup" | "shipping";
  paymentMode?: "vorkasse" | "abholung" | "rechnung";
  note: string | null;
  items: Array<{ catalogServiceId:string|null; name:string; quantity:number; material:string|null; surfaceRequested:string; executionRequested:"hochglanz"|"glaenzend"|"matt"|"gelb_passiviert"|"blau_passiviert"|"offen"; unit:string|null; unitPriceCents:number|null; vatRateBasisPoints:0|700|1900|null }>;
};

export type GlobalCreateDirectIntakeResult =
  | {
      code: "OK";
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
        handoverMode: "pickup" | "shipping";
        paymentMode: "vorkasse" | "abholung" | "rechnung";
        recordedAt: string;
      };
      replayed: boolean;
    }
  | Failure;

export type GlobalCreatePorts = {
  canCreateCustomer: boolean;
  canCreateQuote: boolean;
  canManageMoney: boolean;
  showPrimaryTrigger?: boolean;
  roleLabel: string;
  resumeQuoteId: string | null;
  resumeQuoteConversionId: string | null;
  listCustomers: () => Promise<
    | { code: "OK"; customers: GlobalCreateCustomerChoice[] }
      | { code: "DENIED" | "UNAVAILABLE"; message: string }
  >;
  searchIntakeCustomers: (query: string) => Promise<
    | { code: "OK"; customers: GlobalCreateCustomerChoice[] }
    | { code: "DENIED" | "UNAVAILABLE"; message: string }
  >;
  listCatalog?: () => Promise<{ code:"OK"; services:CatalogService[] }|{ code:"DENIED"|"UNAVAILABLE"; message:string }>;
  createCustomer: (input: CreateCustomerInput) => Promise<GlobalCreateCustomerResult>;
  updateCustomer?: (input: UpdateCustomerCommercialInput) => Promise<{ code: "OK" } | Failure>;
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
  readIntakeDraft: () => Promise<{ code: "OK"; data: { payload: Record<string, unknown>; updatedAt: string } | null } | Failure>;
  saveIntakeDraft: (payload: Record<string, unknown>) => Promise<{ code: "OK"; data: { updatedAt: string } } | Failure>;
  discardIntakeDraft: () => Promise<{ code: "OK"; data: { discarded: boolean } } | Failure>;
  attachIntakeAttachment: (input: { attachmentId: string; orderId: string }) => Promise<{ code: "OK" } | Failure>;
  attachIntakeMail: (input: { graphMessageId: string; orderId: string }) => Promise<{ code: "OK" } | Failure>;
  canUseMail: boolean;
  rememberQuote: (quoteId: string | null) => void;
  rememberQuoteConversion: (quoteId: string, clientEventId: string) => void;
  openCustomer: (customerId: string) => void;
  openOrder: (orderId: string) => void;
  refresh: () => void;
  switchProfile: () => Promise<void>;
};

type Step = "choose" | "customer" | "customer-saved" | "customer-picker" | "quote-list" | "quote" | "quote-saved" | "order-saved" | "direct-intake" | "denied";
type Feedback = { kind: "validation" | "conflict" | "denied" | "error" | "unclear"; message: string; requestId?: string };
type OpenQuotesState =
  | { kind: "idle" | "loading" | "empty" }
  | { kind: "data"; quotes: QuoteReadback[] }
  | { kind: "denied" | "error" | "unknown"; message: string; requestId?: string };
type CustomerDraft = Omit<CreateCustomerInput, "clientEventId"|"street"|"zipCode"|"city"|"country"|"paymentPreference"|"vatId"|"notes"> & {street:string;zipCode:string;city:string;country:string;paymentPreference:string;vatId:string|null};
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
type IntakePositionDraft = { key:string; catalogServiceId:string; name:string; quantity:string; material:string; surfaceRequested:string; executionRequested:IntakeExecution; unit:string|null; unitPriceCents:number|null; vatRateBasisPoints:0|700|1900|null };

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function CustomerFormFields({
  value,
  onChange,
  customerType,
  onCustomerType,
  onlyMissing,
  showPayment,
  onPaymentChange,
  autofocus = false,
}: {
  value: CustomerDraft;
  onChange: (value: CustomerDraft) => void;
  customerType: "" | "business" | "privat";
  onCustomerType: (value: "business" | "privat") => void;
  onlyMissing: boolean;
  showPayment: boolean;
  onPaymentChange: (value: string) => void;
  autofocus?: boolean;
}) {
  const set = <K extends keyof CustomerDraft>(key: K, next: CustomerDraft[K]) => onChange({ ...value, [key]: next });
  const missing = (value: string | null | undefined) => !value?.trim();
  const show = (value: string | null | undefined) => !onlyMissing || missing(value);
  const setName = (name: string) => onChange({
    ...value,
    name,
    companyName: value.customerType === "privat" ? null : nullable(name),
  });
  return <div className="kr-stapel">
    {!onlyMissing ? <div className="kr-feld kr-voll"><span className="kr-feld-label">Kundentyp</span><div data-spec-id="kundeneu.kundentyp"><Segment<"" | "business" | "privat"> label="Kundentyp" wert={customerType} optionen={[
      { wert: "business", text: "Gewerbe" },
      { wert: "privat", text: "Privat" },
    ]} onWert={(next) => { if (next) onCustomerType(next); }} /></div></div> : null}
    <FormRaster>
      {show(value.name) ? <Feld label="Name / Firma" voll><Eingabe data-spec-id="kundeneu.name" data-autofocus={autofocus || undefined} required minLength={2} maxLength={160} value={value.name} onChange={(event) => setName(event.target.value)} /></Feld> : null}
      {show(value.contactPerson) ? <Feld label="Ansprechpartner"><Eingabe data-spec-id="kundeneu.ansprechpartner" maxLength={120} value={value.contactPerson ?? ""} onChange={(event) => set("contactPerson", nullable(event.target.value))} /></Feld> : null}
      {show(value.phone) ? <Feld label="Telefon"><Eingabe data-spec-id="kundeneu.telefon" required type="tel" minLength={6} maxLength={20} value={value.phone ?? ""} onChange={(event) => set("phone", nullable(event.target.value))} /></Feld> : null}
      {show(value.email) ? <Feld label="E-Mail"><Eingabe data-spec-id="kundeneu.email" type="email" maxLength={254} value={value.email ?? ""} onChange={(event) => set("email", nullable(event.target.value))} /></Feld> : null}
      {show(value.street) ? <Feld label="Straße"><Eingabe data-spec-id="kundeneu.strasse" maxLength={160} value={value.street} onChange={(event) => set("street", event.target.value)} /></Feld> : null}
      {show(value.zipCode) ? <Feld label="PLZ"><Eingabe data-spec-id="kundeneu.plz" minLength={2} maxLength={10} value={value.zipCode} onChange={(event) => set("zipCode", event.target.value)} /></Feld> : null}
      {show(value.city) ? <Feld label="Ort"><Eingabe data-spec-id="kundeneu.ort" maxLength={100} value={value.city} onChange={(event) => set("city", event.target.value)} /></Feld> : null}
      {show(value.country) ? <Feld label="Land"><Auswahl data-spec-id="kundeneu.land" value={value.country} onChange={(event) => set("country", event.target.value)} optionen={[
        { wert: "Deutschland", text: "Deutschland" },
        { wert: "Österreich", text: "Österreich" },
        { wert: "Schweiz", text: "Schweiz" },
        { wert: "Anderes Land", text: "Anderes Land" },
      ]} /></Feld> : null}
      {showPayment && show(value.paymentPreference) ? <Feld label="Zahlungsbedingung"><Auswahl data-spec-id="kundeneu.zahlungsbedingung" required value={value.paymentPreference || "vorkasse"} onChange={(event) => onPaymentChange(event.target.value)} optionen={[
        { wert: "vorkasse", text: "Vorkasse" },
        { wert: "bar", text: "Bar oder Karte bei Abholung" },
      ]} /></Feld> : null}
    </FormRaster>
    {!onlyMissing && customerType === "business" ? <details><summary>Weitere Angaben</summary><Feld label="USt-ID"><Eingabe data-spec-id="kundeneu.ustid" maxLength={20} value={value.vatId ?? ""} onChange={(event) => set("vatId", nullable(event.target.value))} /></Feld></details> : null}
  </div>;
}

const EMPTY_CUSTOMER: CustomerDraft = {
  name: "",
  customerType: "business",
  companyName: null,
  contactPerson: null,
  email: null,
  phone: null,
  street: "",
  zipCode: "",
  city: "",
  country: "Deutschland",
  paymentPreference: "vorkasse",
  vatId: null,
};

const EMPTY_INTAKE_CUSTOMER: CustomerDraft = {
  ...EMPTY_CUSTOMER,
  paymentPreference: "bar",
};

const HANDY_QUERY = "(max-width: 699px)";
const FREE_TEXT_SERVICE = "FREE_TEXT";
const DEFAULT_SURFACES = ["Verchromen", "Vernickeln", "Verzinken", "Entchromen / prüfen", "noch zu klären"] as const;
const EXECUTION_OPTIONS: Array<{ wert: IntakeExecution; text: string }> = [
  { wert: "hochglanz", text: "Hochglanz" },
  { wert: "glaenzend", text: "glänzend" },
  { wert: "matt", text: "matt" },
  { wert: "gelb_passiviert", text: "gelb passiviert" },
  { wert: "blau_passiviert", text: "blau passiviert" },
  { wert: "offen", text: "noch zu klären" },
];
const subscribeHandy = (notify: () => void) => {
  if (typeof window.matchMedia !== "function") return () => undefined;
  const query = window.matchMedia(HANDY_QUERY);
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
};
const readHandy = () => typeof window.matchMedia === "function" && window.matchMedia(HANDY_QUERY).matches;
const readHandyServer = () => false;

function useHandy(): boolean {
  return useSyncExternalStore(subscribeHandy, readHandy, readHandyServer);
}

function customerChoiceToDraft(customer: GlobalCreateCustomerChoice): CustomerDraft {
  return {
    name: customer.name,
    customerType: customer.customerType === "privat" ? "privat" : "business",
    companyName: customer.companyName ?? null,
    contactPerson: customer.contactPerson ?? null,
    email: customer.email ?? null,
    phone: customer.phone ?? null,
    street: customer.street ?? "",
    zipCode: customer.zipCode ?? "",
    city: customer.city ?? "",
    country: customer.country ?? "Deutschland",
    paymentPreference: customer.paymentPreference ?? "",
    vatId: customer.vatId ?? null,
  };
}

function completeOrderCustomer(customer: CustomerDraft, requirePaymentPreference = true): boolean {
  return customer.name.trim().length >= 2 && Boolean(customer.contactPerson?.trim()) &&
    Boolean(customer.phone?.trim()) && Boolean(customer.email?.trim()) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email ?? "") &&
    customer.street.trim().length >= 2 && customer.zipCode.trim().length >= 2 && customer.city.trim().length >= 1 &&
    customer.country.trim().length >= 2 && (!requirePaymentPreference || customer.paymentPreference.trim().length > 0);
}

function validPhone(value: string | null | undefined): boolean {
  const phone = value?.trim() ?? "";
  return phone.length >= 6 && phone.length <= 20 && /^[0-9 +\-()/]+$/.test(phone) && phone.replace(/\D/g, "").length >= 6;
}

function validPostcode(country: string, value: string): boolean {
  const postcode = value.trim();
  if (!postcode) return true;
  if (country === "Deutschland") return /^\d{5}$/.test(postcode);
  if (country === "Österreich" || country === "Schweiz") return /^\d{4}$/.test(postcode);
  return postcode.length >= 2 && postcode.length <= 10;
}

function customerOrderMissing(customer: CustomerDraft, includePayment: boolean): string[] {
  const missing: string[] = [];
  if (!customer.contactPerson?.trim()) missing.push("Ansprechpartner");
  if (!customer.email?.trim()) missing.push("E-Mail");
  if (!customer.street.trim()) missing.push("Straße");
  if (!customer.zipCode.trim()) missing.push("PLZ");
  if (!customer.city.trim()) missing.push("Ort");
  if (!customer.country.trim()) missing.push("Land");
  if (includePayment && !customer.paymentPreference.trim()) missing.push("Zahlungsbedingung");
  return missing;
}

const newPosition = (): PositionDraft => ({
  key: globalThis.crypto.randomUUID(),
  catalogServiceId: "",
  name: "",
  quantity: "1",
  material: "",
  surfaceRequested: "",
  unit: "",
  unitPriceCents: null,
});

const newIntakePosition = (): IntakePositionDraft => ({
  key: globalThis.crypto.randomUUID(),
  name: "",
  quantity: "1",
  material: "",
  surfaceRequested: "",
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

function requestFeedback(result: Failure, requestId: string): Feedback {
  if (result.code === "VALIDATION_ERROR") return { kind: "validation", message: result.message, requestId };
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
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("choose");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [statusChecked, setStatusChecked] = useState(false);
  const [retryConfirmed, setRetryConfirmed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [customerDraft, setCustomerDraft] = useState<CustomerDraft>(EMPTY_CUSTOMER);
  const [customerType, setCustomerType] = useState<"" | "business" | "privat">("");
  const [customerNote, setCustomerNote] = useState("");
  const [customerClosePrompt, setCustomerClosePrompt] = useState(false);
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
  const [intakeStep, setIntakeStep] = useState<1 | 2 | 3>(1);
  const [intakeKind, setIntakeKind] = useState<"ORDER" | "QUOTE">("ORDER");
  const [intakeHandover, setIntakeHandover] = useState<"PICKUP" | "SHIPPING">("PICKUP");
  const [intakeSource, setIntakeSource] = useState<"personal" | "shipping" | "pickup" | "mail" | "phone">("personal");
  const [intakeTermStatus, setIntakeTermStatus] = useState<"wish" | "confirmed">("wish");
  const [quoteValidUntil, setQuoteValidUntil] = useState("");
  const [intakeChecked, setIntakeChecked] = useState(false);
  const [directCustomer, setDirectCustomer] = useState<CustomerDraft>(EMPTY_INTAKE_CUSTOMER);
  const [directCustomerType, setDirectCustomerType] = useState<"" | "business" | "privat">("");
  const [directCustomerId, setDirectCustomerId] = useState("");
  const [intakeCustomerQuery, setIntakeCustomerQuery] = useState("");
  const [intakeCustomerResults, setIntakeCustomerResults] = useState<GlobalCreateCustomerChoice[]>([]);
  const [intakeCustomerSearchState, setIntakeCustomerSearchState] = useState<"idle" | "loading" | "ready" | "empty" | "error">("idle");
  const [intakePaymentMode, setIntakePaymentMode] = useState<PaymentMode>("abholung");
  const [intakePaymentModeTouched, setIntakePaymentModeTouched] = useState(false);
  const [intakeCustomerPaymentTouched, setIntakeCustomerPaymentTouched] = useState(false);
  const [directItems, setDirectItems] = useState<IntakePositionDraft[]>(() => [newIntakePosition()]);
  const [catalogServices, setCatalogServices] = useState<CatalogService[]>([]);
  const [directWishDate, setDirectWishDate] = useState("");
  const [directConfirmedDate, setDirectConfirmedDate] = useState("");
  const [directNote, setDirectNote] = useState("");
  const [sourceMode, setSourceMode] = useState<F1SourceMode | null>(null);
  const [draftPrompt, setDraftPrompt] = useState(false);
  const [pendingAttachmentIds, setPendingAttachmentIds] = useState<string[]>([]);
  const [pendingMailId, setPendingMailId] = useState<string | null>(null);
  const [directReceipt, setDirectReceipt] = useState<Extract<GlobalCreateDirectIntakeResult, { code: "OK" }> | null>(null);
  const [quote, setQuote] = useState<QuoteReadback | null>(null);
  const [quoteReceipt, setQuoteReceipt] = useState<(QuoteCreateReceipt | QuoteUpdateReceipt) | null>(null);
  const [openQuotesState, setOpenQuotesState] = useState<OpenQuotesState>({ kind: "idle" });
  const [conversion, setConversion] = useState<Extract<GlobalCreateConversionResult, { code: "OK" }> | null>(null);
  const requestIds = useRef({ customer: "", quote: "", conversion: "", directCustomer: "" });
  const customerRequestSeq = useRef(0);
  const intakeCustomerSearchSeq = useRef(0);
  const customerDuplicateSearchSeq = useRef(0);
  const dialogRef = useRef<HTMLElement>(null);
  const confirmedOrderDueDateValid = isValidDateInput(confirmedOrderDueDate);
  const customerCompleteForOrder = completeOrderCustomer(customerDraft);
  const isHandy = useHandy();
  const customerOrderMissingFields = customerOrderMissing(customerDraft, ports.canManageMoney);
  const customerCoreComplete = Boolean(customerType)
    && customerDraft.name.trim().length >= 2
    && validPhone(customerDraft.phone);
  const customerChanged = customerType !== ""
    || JSON.stringify(customerDraft) !== JSON.stringify(EMPTY_CUSTOMER)
    || customerNote.trim().length > 0;
  const customerDuplicateQueries = useMemo(() => [customerDraft.name, customerDraft.phone, customerDraft.email, customerDraft.city]
    .map((value) => value?.trim() ?? "")
    .filter((value, index, values) => value.length >= 2 && values.indexOf(value) === index), [customerDraft.city, customerDraft.email, customerDraft.name, customerDraft.phone]);
  const customerDuplicateQuery = customerDuplicateQueries.join("|");
  const customerDuplicateOpen = customerDuplicateResults.length > 0
    && customerDuplicateAcceptedFor !== customerDuplicateQuery;

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

  const changeCustomerType = (next: "business" | "privat") => {
    setCustomerType(next);
    setCustomerDraft((current) => ({
      ...current,
      customerType: next,
      companyName: next === "privat" ? null : nullable(current.name),
      vatId: next === "privat" ? null : current.vatId,
    }));
  };

  const changeDirectCustomerType = (next: "business" | "privat") => {
    setDirectCustomerType(next);
    setDirectCustomer((current) => ({
      ...current,
      customerType: next,
      companyName: next === "privat" ? null : nullable(current.name),
      vatId: next === "privat" ? null : current.vatId,
    }));
  };

  useLayoutEffect(() => {
    if (!open) return;
    const root = dialogRef.current ?? document.querySelector<HTMLElement>("[role='dialog']");
    const target = root?.querySelector<HTMLElement>("[data-autofocus]")
      ?? root?.querySelector<HTMLElement>("input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])");
    target?.focus();
  }, [directCustomerMode, open, step]);

  useEffect(() => {
    if (!open || step !== "direct-intake" || directCustomerMode !== "NONE") return;
    const query = intakeCustomerQuery.trim();
    if (query.length < 2) return;
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
        setIntakeCustomerResults(result.customers.slice(0, 10));
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
      void Promise.all(queries.map((query) => ports.searchIntakeCustomers(query))).then((results) => {
        if (sequence !== customerDuplicateSearchSeq.current) return;
        if (results.some((result) => result.code !== "OK")) {
          setCustomerDuplicateResults([]);
          setCustomerDuplicateState("error");
          return;
        }
        const customers = results.flatMap((result) => result.code === "OK" ? result.customers : []);
        setCustomerDuplicateResults(customers.filter((customer, index) => customers.findIndex((entry) => entry.id === customer.id) === index).slice(0, 10));
        setCustomerDuplicateState("ready");
      }).catch(() => {
        if (sequence !== customerDuplicateSearchSeq.current) return;
        setCustomerDuplicateResults([]);
        setCustomerDuplicateState("error");
      });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [customerDuplicateQueries, open, ports, step]);

  const closeNow = () => {
    if (!busy) {
      setDraftPrompt(false);
      setCustomerClosePrompt(false);
      setSourceMode(null);
      setOpen(false);
    }
  };

  const requestCustomerClose = () => {
    if (busy) return;
    if (customerChanged) setCustomerClosePrompt(true);
    else closeNow();
  };

  const intakeDraftPayload = (): Record<string, unknown> => ({
    version: 1,
    kind: "INTAKE",
    customerMode: directCustomerMode,
    customerId: directCustomerId,
    customer: directCustomer,
    paymentMode: intakePaymentMode,
    paymentModeTouched: intakePaymentModeTouched,
    customerPaymentTouched: intakeCustomerPaymentTouched,
    intakeKind,
    intakeHandover,
    intakeSource,
    intakeTermStatus,
    intakeChecked,
    items: directItems,
    wishDate: directWishDate,
    confirmedDate: directConfirmedDate,
    validUntil: quoteValidUntil,
    note: directNote,
    attachmentIds: pendingAttachmentIds,
    graphMessageId: pendingMailId,
  });

  const requestClose = () => {
    if (!busy && !directReceipt) setDraftPrompt(true);
    else closeNow();
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
        ? `Das Profil ${ports.roleLabel} darf keine Kunden anlegen. Rolf ist für diesen Vorgang zuständig.`
        : `Das Profil ${ports.roleLabel} darf keinen KV oder Auftrag anlegen. Rolf ist für diesen Vorgang zuständig.`,
    });
    setStep("denied");
  };

  const restoreIntakeDraft = (payload: Record<string, unknown>) => {
    if (payload.version !== 1 || payload.kind !== "INTAKE") return;
    if (payload.customerMode === "NONE" || payload.customerMode === "EXISTING" || payload.customerMode === "NEW") setDirectCustomerMode(payload.customerMode);
    if (typeof payload.customerId === "string") setDirectCustomerId(payload.customerId);
    const restoredCustomer = payload.customer;
    if (record(restoredCustomer)) setDirectCustomer((current) => ({ ...current, ...restoredCustomer } as CustomerDraft));
    if (payload.paymentMode === "vorkasse" || payload.paymentMode === "abholung" || payload.paymentMode === "rechnung") setIntakePaymentMode(payload.paymentMode);
    if (typeof payload.paymentModeTouched === "boolean") setIntakePaymentModeTouched(payload.paymentModeTouched);
    if (typeof payload.customerPaymentTouched === "boolean") setIntakeCustomerPaymentTouched(payload.customerPaymentTouched);
    if (payload.intakeKind === "ORDER" || payload.intakeKind === "QUOTE") setIntakeKind(payload.intakeKind);
    if (payload.intakeHandover === "PICKUP" || payload.intakeHandover === "SHIPPING") setIntakeHandover(payload.intakeHandover);
    if (["personal", "shipping", "pickup", "mail", "phone"].includes(String(payload.intakeSource))) setIntakeSource(payload.intakeSource as typeof intakeSource);
    if (payload.intakeTermStatus === "wish" || payload.intakeTermStatus === "confirmed") setIntakeTermStatus(payload.intakeTermStatus);
    if (typeof payload.intakeChecked === "boolean") setIntakeChecked(payload.intakeChecked);
    if (Array.isArray(payload.items) && payload.items.length >= 1 && payload.items.length <= 20 && payload.items.every(record)) {
      setDirectItems((payload.items as Array<Record<string, unknown>>).map((item) => ({
        ...(item as IntakePositionDraft),
        executionRequested: EXECUTION_OPTIONS.some((option) => option.wert === item.executionRequested)
          ? item.executionRequested as IntakeExecution
          : "offen",
      })));
    }
    if (typeof payload.wishDate === "string") setDirectWishDate(payload.wishDate);
    if (typeof payload.confirmedDate === "string") setDirectConfirmedDate(payload.confirmedDate);
    if (typeof payload.validUntil === "string") setQuoteValidUntil(payload.validUntil);
    if (typeof payload.note === "string") setDirectNote(payload.note);
    if (Array.isArray(payload.attachmentIds)) setPendingAttachmentIds(payload.attachmentIds.filter((id): id is string => typeof id === "string"));
    if (typeof payload.graphMessageId === "string") setPendingMailId(payload.graphMessageId);
    setFeedback({ kind: "error", message: "Gespeicherter Entwurf dieses Logins wurde wieder aufgenommen." });
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
      setCatalogServices(catalog.services);
      setCustomerChoices(result.customers);
      setCustomerLoad(result.customers.length > 0 ? "ready" : "empty");
    } catch {
      if (seq !== customerRequestSeq.current) return;
      setCustomerLoad("error");
      setFeedback({ kind: "error", message: "Der Kundenstamm konnte nicht sicher gelesen werden. Es wurde nichts angelegt." });
    }
  };

  const loadDirectIntake = async (preselectedCustomerId?: string, restoreDraft = true) => {
    if (!ports.canCreateQuote) {
      deny("quote");
      return;
    }
    setDirectCustomerMode("NONE");
    setDirectCustomerType("");
    setDirectCustomerId("");
    setDirectCustomer(EMPTY_INTAKE_CUSTOMER);
    setIntakeCustomerQuery("");
    setIntakeCustomerResults([]);
    setIntakeCustomerSearchState("idle");
    setIntakePaymentMode("abholung");
    setIntakePaymentModeTouched(false);
    setIntakeCustomerPaymentTouched(false);
    setOpen(true);
    setIntakeStep(1);
    navigate("direct-intake");
    setCustomerLoad("loading");
    const seq = ++customerRequestSeq.current;
    try {
      const [result, catalog, draft] = await Promise.all([
        preselectedCustomerId
          ? ports.listCustomers()
          : Promise.resolve({ code: "OK" as const, customers: [] }),
        ports.listCatalog?.() ?? Promise.resolve({ code:"UNAVAILABLE" as const, message:"Leistungskatalog ist nicht angebunden." }),
        restoreDraft ? ports.readIntakeDraft() : Promise.resolve({ code: "OK" as const, data: null }),
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
      setCatalogServices(catalog.services);
      setCustomerChoices(result.customers);
      setCustomerLoad(result.customers.length ? "ready" : "empty");
      if (draft.code === "OK" && draft.data) restoreIntakeDraft(draft.data.payload);
      if (!ports.canManageMoney) setIntakeKind("ORDER");
      const preselected = preselectedCustomerId
        ? result.customers.find((entry) => entry.id === preselectedCustomerId)
        : undefined;
      if (preselected) {
        setDirectCustomerId(preselected.id);
        const draftCustomer = customerChoiceToDraft(preselected);
        setDirectCustomer(draftCustomer);
        setDirectCustomerMode("EXISTING");
        setDirectCustomerType(draftCustomer.customerType === "privat" ? "privat" : "business");
        setIntakePaymentMode(paymentModeFromPreference(draftCustomer.paymentPreference, "pickup"));
      }
    } catch {
      if (seq === customerRequestSeq.current) setFeedback({ kind: "error", message: "Die vorhandenen Kunden konnten nicht sicher gelesen werden. Es wurde nichts angelegt." });
    }
  };

  const openWithIntent = (request: GlobalCreateIntent | GlobalCreateRequest) => {
    const intent = typeof request === "string" ? request : request.intent;
    const prefill = typeof request === "string" ? undefined : request.prefill;
    setOpen(true);
    if (intent === "CUSTOMER") {
      setCustomerType("");
      setCustomerClosePrompt(false);
      setCustomerDuplicateResults([]);
      setCustomerDuplicateAcceptedFor("");
      setCustomerDraft(prefill
        ? { ...EMPTY_CUSTOMER, name: prefill.name?.trim() ?? "", email: prefill.email?.trim().toLowerCase() ?? null }
        : EMPTY_CUSTOMER);
      if (ports.canCreateCustomer) navigate("customer");
      else deny("customer");
      return;
    }
    if (intent === "QUOTE") {
      if (prefill?.customerQuery) setCustomerQuery(prefill.customerQuery);
      if (prefill?.note) setQuoteNote(prefill.note);
      if (prefill?.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(prefill.dueDate)) setDueDate(prefill.dueDate);
      if (prefill?.sourceMode) setSourceMode(prefill.sourceMode);
      if (prefill?.quotePositions?.length) setPositions(prefill.quotePositions.slice(0, 20).map((position) => ({
        ...newPosition(),
        quantity: /^\d+(?:[.,]\d+)?$/.test(position.quantity ?? "") ? (position.quantity ?? "1").replace(",", ".") : "1",
        material: position.material?.slice(0, 500) ?? "",
      })));
      void loadCustomers();
      return;
    }
    if (!ports.canCreateQuote) {
      deny("quote");
      return;
    }
    const selectedMailId = prefill?.sourceMode === "mail" && prefill.graphMessageId?.trim()
      ? prefill.graphMessageId.trim()
      : null;
    setSourceMode(selectedMailId ? "mail" : null);
    setPendingMailId(selectedMailId);
    void loadDirectIntake(prefill?.customerId, !selectedMailId);
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
      setCatalogServices(catalog.services);
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

  const loadOpenQuotes = async () => {
    if (!ports.canCreateQuote) {
      deny("quote");
      return;
    }
    setBusy(true);
    setOpenQuotesState({ kind: "loading" });
    navigate("quote-list");
    try {
      const [result, catalog] = await Promise.all([
        ports.listOpenQuotes(),
        ports.listCatalog?.() ?? Promise.resolve({ code: "UNAVAILABLE" as const, message: "Leistungskatalog ist nicht angebunden." }),
      ]);
      if (result.code !== "OK") {
        setOpenQuotesState({
          kind: result.code === "UNAUTHENTICATED" || result.code === "FORBIDDEN"
            ? "denied"
            : result.code === "UNAVAILABLE"
              ? "unknown"
              : "error",
          message: result.message,
        });
        return;
      }
      if (catalog.code !== "OK") {
        setOpenQuotesState({ kind: catalog.code === "DENIED" ? "denied" : "error", message: catalog.message });
        return;
      }
      setCatalogServices(catalog.services);
      setOpenQuotesState(result.quotes.length === 0
        ? { kind: "empty" }
        : { kind: "data", quotes: result.quotes });
    } catch {
      setOpenQuotesState({
        kind: "unknown",
        message: "Der Stand der offenen KVs konnte nicht sicher geladen werden. Bitte später erneut öffnen.",
      });
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
    setAwardPaymentMode(paymentModeFromPreference(selected?.paymentPreference));
    setDueDate(draft.dueDate);
    setQuoteNote(draft.note ?? "");
    setPositions(draft.positions.map((position) => {
      const service = catalogServices.find((candidate) => candidate.name === position.name
        && candidate.surface === position.surfaceRequested
        && candidate.netPriceCents === position.unitPriceCents);
      return {
        key: globalThis.crypto.randomUUID(),
        catalogServiceId: service?.id ?? "",
        name: position.name,
        quantity: String(position.quantity),
        material: position.material ?? "",
        surfaceRequested: position.surfaceRequested,
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
    if (!ports.canCreateCustomer) {
      deny("customer");
      return;
    }
    const firstMissing = !customerType
      ? { label: "Kundentyp", id: "kundeneu.kundentyp" }
      : customerDraft.name.trim().length < 2
        ? { label: "Name / Firma", id: "kundeneu.name" }
        : !validPhone(customerDraft.phone)
          ? { label: "Telefon", id: "kundeneu.telefon" }
          : null;
    if (firstMissing) {
      setFeedback({ kind: "validation", message: `Noch offen: ${firstMissing.label}` });
      document.querySelector<HTMLElement>(`[data-spec-id="${firstMissing.id}"]`)?.focus();
      return;
    }
    if (customerDraft.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerDraft.email)) {
      setFeedback({ kind: "validation", message: "E-Mail ist ungültig." });
      document.querySelector<HTMLElement>('[data-spec-id="kundeneu.email"]')?.focus();
      return;
    }
    if (!validPostcode(customerDraft.country, customerDraft.zipCode)) {
      setFeedback({ kind: "validation", message: "PLZ passt nicht zum gewählten Land." });
      document.querySelector<HTMLElement>('[data-spec-id="kundeneu.plz"]')?.focus();
      return;
    }
    if (customerDraft.vatId && !(/^DE\d{9}$/i.test(customerDraft.vatId) || (customerDraft.vatId.length >= 4 && customerDraft.vatId.length <= 20))) {
      setFeedback({ kind: "validation", message: "USt-ID ist ungültig." });
      document.querySelector<HTMLElement>('[data-spec-id="kundeneu.ustid"]')?.focus();
      return;
    }
    if (customerDuplicateOpen) {
      setFeedback({ kind: "validation", message: "Bitte zuerst entscheiden, ob der ähnliche Kunde bereits vorhanden ist." });
      return;
    }
    const id = requestId("customer");
    setBusy(true);
    setFeedback(null);
    const input: CreateCustomerInput = { ...customerDraft, clientEventId: id, notes: nullable(customerNote) };
    try {
      const result = await ports.createCustomer(input);
      if (result.code !== "OK") {
        setFeedback(requestFeedback(result, id));
        return;
      }
      setOpen(false);
      ports.openCustomer(result.customer.id);
    } catch {
      setFeedback({
        kind: "unclear",
        message: "Der Ausgang ist ungeklärt. Nicht neu beginnen: mit derselben Anfragekennung zuerst den gespeicherten Stand prüfen.",
        requestId: id,
      });
    } finally {
      setBusy(false);
    }
  };

  const createInputForStatus = (): CreateCustomerInput => ({ ...customerDraft, clientEventId: requestId("customer"), notes: nullable(customerNote) });
  const directCustomerInputForStatus = (): CreateCustomerInput => ({ ...directCustomer, clientEventId: requestId("directCustomer"), notes: null });

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
      if (step === "direct-intake" && intakeStep === 1 && directCustomerMode === "NEW") {
        const result = await ports.readCustomerCreateReceipt(directCustomerInputForStatus());
        if (result.code === "OK") {
          const choice: GlobalCreateCustomerChoice = {
            id: result.customer.id,
            customerNumber: result.customer.customerNumber,
            ...directCustomer,
            city: directCustomer.city,
          };
          setDirectCustomerId(choice.id);
          setDirectCustomerMode("EXISTING");
          setCustomerChoices((current) => [choice, ...current.filter((entry) => entry.id !== choice.id)]);
          setFeedback(null);
          setIntakeStep(2);
          return;
        }
        setFeedback({ kind: "unclear", message: result.code === "NOT_FOUND" ? "Es wurde noch keine Speicherung gefunden. Die Eingaben bleiben erhalten." : result.message, requestId: feedback.requestId });
      } else if (step === "customer") {
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
    else if (step === "direct-intake" && intakeStep === 1) void advanceIntakeCustomer();
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
        services = catalog.services;
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
    setAwardPaymentMode(paymentModeFromPreference(selected.paymentPreference));
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

  const updateDirectItem = (key: string, field: keyof Omit<IntakePositionDraft, "key">, value: string) => {
    setDirectItems((current) => current.map((item) => item.key === key ? { ...item, [field]: value } : item));
  };

  const setDirectPositionName = (key: string, name: string) => {
    const matches = catalogServices.filter((candidate) => candidate.name.localeCompare(name.trim(), "de-DE", { sensitivity: "base" }) === 0);
    const service = matches.length === 1 ? matches[0] : null;
    setDirectItems((current) => current.map((item) => item.key !== key ? item : service
      ? { ...item, catalogServiceId: service.id, name: service.name, surfaceRequested: service.surface, unit: service.unit, unitPriceCents: service.netPriceCents, vatRateBasisPoints: service.vatRateBasisPoints }
      : { ...item, catalogServiceId: FREE_TEXT_SERVICE, name, unit: null, unitPriceCents: null, vatRateBasisPoints: null }));
  };

  const setDirectPositionSurface = (key: string, surfaceRequested: string) => {
    setDirectItems((current) => current.map((item) => {
      if (item.key !== key) return item;
      const service = catalogServices.find((candidate) => candidate.id === item.catalogServiceId);
      return service?.surface === surfaceRequested
        ? { ...item, surfaceRequested }
        : { ...item, catalogServiceId: FREE_TEXT_SERVICE, surfaceRequested, unit: null, unitPriceCents: null, vatRateBasisPoints: null };
    }));
  };

  const setDirectPositionPrice = (key: string, euros: string) => {
    const parsed = Number.parseFloat(euros.replace(",", "."));
    setDirectItems((current) => current.map((item) => item.key === key
      ? { ...item, unitPriceCents: Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) : null, unit: item.unit ?? "Stück", vatRateBasisPoints: item.vatRateBasisPoints ?? 1900 }
      : item));
  };

  const intakePositionComplete = (item: IntakePositionDraft) =>
    (item.catalogServiceId === FREE_TEXT_SERVICE || item.catalogServiceId.length > 0)
    && item.name.trim().length >= 2
    && item.surfaceRequested.trim().length >= 2
    && Number.isSafeInteger(Number(item.quantity))
    && Number(item.quantity) > 0;

  const selectIntakeCustomer = (mode: "NONE" | "EXISTING" | "NEW", selected?: GlobalCreateCustomerChoice) => {
    const handoverMode = intakeHandover === "PICKUP" ? "pickup" : "shipping";
    setFeedback(null);
    setIntakePaymentModeTouched(false);
    setIntakeCustomerPaymentTouched(false);
    if (mode === "NONE") {
      setDirectCustomerMode("NONE");
      setDirectCustomerType("");
      setDirectCustomerId("");
      setDirectCustomer(EMPTY_INTAKE_CUSTOMER);
      setIntakeCustomerResults([]);
      setIntakePaymentMode(paymentModeFromPreference(null, handoverMode));
      return;
    }
    if (mode === "NEW") {
      const paymentPreference = handoverMode === "pickup" ? "bar" : "vorkasse";
      const name = intakeCustomerQuery.trim();
      setDirectCustomerMode("NEW");
      setDirectCustomerType("");
      setDirectCustomerId("");
      setDirectCustomer({
        ...EMPTY_CUSTOMER,
        name,
        companyName: name || null,
        paymentPreference,
      });
      setIntakeCustomerResults([]);
      setIntakePaymentMode(paymentModeFromPreference(paymentPreference, handoverMode));
      return;
    }
    if (!selected) return;
    const draft = customerChoiceToDraft(selected);
    setDirectCustomerMode("EXISTING");
    setDirectCustomerType(draft.customerType === "privat" ? "privat" : "business");
    setDirectCustomerId(selected.id);
    setDirectCustomer(draft);
    setCustomerChoices((current) => [selected, ...current.filter((entry) => entry.id !== selected.id)]);
    setIntakeCustomerQuery(selected.companyName ?? selected.name);
    setIntakeCustomerResults([]);
    setIntakePaymentMode(paymentModeFromPreference(draft.paymentPreference, handoverMode));
  };

  const changeIntakeHandover = (value: "PICKUP" | "SHIPPING") => {
    const handoverMode = value === "PICKUP" ? "pickup" : "shipping";
    setIntakeHandover(value);
    if (directCustomerMode === "NEW" && !intakeCustomerPaymentTouched) {
      const paymentPreference = handoverMode === "pickup" ? "bar" : "vorkasse";
      setDirectCustomer((current) => ({ ...current, paymentPreference }));
      if (!intakePaymentModeTouched) setIntakePaymentMode(paymentModeFromPreference(paymentPreference, handoverMode));
      return;
    }
    if (!intakePaymentModeTouched || (value === "SHIPPING" && intakePaymentMode === "abholung")) {
      setIntakePaymentMode(paymentModeFromPreference(directCustomer.paymentPreference, handoverMode));
    }
  };

  const changeIntakeCustomerPayment = (paymentPreference: string) => {
    setIntakeCustomerPaymentTouched(true);
    setDirectCustomer((current) => ({ ...current, paymentPreference }));
    if (!intakePaymentModeTouched) {
      setIntakePaymentMode(paymentModeFromPreference(
        paymentPreference,
        intakeHandover === "PICKUP" ? "pickup" : "shipping",
      ));
    }
  };

  const advanceIntakeCustomer = async (): Promise<string | null> => {
    if (directCustomerMode === "NONE") {
      setFeedback({ kind: "validation", message: "Bitte einen bestehenden Kunden oder ‚Neukunde anlegen‘ auswählen." });
      return null;
    }
    if (directCustomerMode === "NEW" && !directCustomerType) {
      setFeedback({ kind: "validation", message: "Bitte den Kundentyp Gewerbe oder Privat wählen." });
      return null;
    }
    if (!completeOrderCustomer(directCustomer, ports.canManageMoney)) {
      setFeedback({ kind: "validation", message: "Für den Auftrag fehlen Name/Firma, Ansprechpartner, Telefon, E-Mail, vollständige Anschrift oder Zahlungsbedingung." });
      return null;
    }
    setBusy(true);
    setFeedback(null);
    try {
      if (directCustomerMode === "NEW") {
        setIntakeStep(2);
        return "NEW";
      } else {
        if (!directCustomerId) {
          setFeedback({ kind: "validation", message: "Bitte einen Kunden auswählen." });
          return null;
        }
        const selected = customerChoices.find((entry) => entry.id === directCustomerId);
        const needsInlineUpdate = selected
          ? !completeOrderCustomer(customerChoiceToDraft(selected), ports.canManageMoney)
          : true;
        if (!needsInlineUpdate) {
          setIntakeStep(2);
          return directCustomerId;
        }
        if (!ports.updateCustomer) {
          setFeedback({ kind: "error", message: "Die Kundenaktualisierung ist derzeit nicht verfügbar." });
          return null;
        }
        const updated = await ports.updateCustomer({
          clientEventId: globalThis.crypto.randomUUID(),
          customerId: directCustomerId,
          name: directCustomer.name,
          companyName: directCustomer.companyName,
          contactPerson: directCustomer.contactPerson,
          email: directCustomer.email,
          phone: directCustomer.phone,
          street: directCustomer.street,
          zipCode: directCustomer.zipCode,
          city: directCustomer.city,
          country: directCustomer.country,
          paymentPreference: directCustomer.paymentPreference,
          vatId: directCustomer.vatId,
        });
        if (updated.code !== "OK") {
          setFeedback(requestFeedback(updated, directCustomerId));
          return null;
        }
        setCustomerChoices((current) => current.map((entry) => entry.id === directCustomerId ? { ...entry, ...directCustomer, city: directCustomer.city } : entry));
        setIntakeStep(2);
        return directCustomerId;
      }
    } catch {
      setFeedback({
        kind: "unclear",
        message: "Der Kundenstand konnte nicht sicher bestätigt werden. Es wurde noch kein Auftrag angelegt.",
        requestId: requestId("directCustomer"),
      });
      return null;
    } finally {
      setBusy(false);
    }
  };

  const createDirectCustomerOnly = async (): Promise<string | null> => {
    const clientEventId = requestId("directCustomer");
    const created = await ports.createCustomer({ ...directCustomer, clientEventId, notes: null });
    if (created.code !== "OK") {
      setFeedback(requestFeedback(created, clientEventId));
      return null;
    }
    const choice: GlobalCreateCustomerChoice = {
      id: created.customer.id, customerNumber: created.customer.customerNumber, ...directCustomer,
      city: directCustomer.city,
    };
    setDirectCustomerId(choice.id);
    setDirectCustomerMode("EXISTING");
    setCustomerChoices((current) => [choice, ...current.filter((entry) => entry.id !== choice.id)]);
    return choice.id;
  };

  const submitDirectIntake = async (event: FormEvent, customerKey = directCustomerId) => {
    event.preventDefault();
    if (!ports.canCreateQuote) {
      deny("quote");
      return;
    }
    const validDates = /^\d{4}-\d{2}-\d{2}$/.test(directWishDate) && /^\d{4}-\d{2}-\d{2}$/.test(directConfirmedDate);
    const items = directItems.map((item) => ({
      catalogServiceId: item.catalogServiceId === FREE_TEXT_SERVICE ? null : item.catalogServiceId,
      name: item.name.trim(),
      quantity: Number(item.quantity),
      material: nullable(item.material),
      surfaceRequested: item.surfaceRequested.trim(),
      executionRequested: item.executionRequested,
      unit: ports.canManageMoney ? item.unit : null,
      unitPriceCents: ports.canManageMoney ? item.unitPriceCents : null,
      vatRateBasisPoints: ports.canManageMoney ? item.vatRateBasisPoints : null,
    }));
    const validCustomer = (directCustomerMode === "NEW" || customerKey.length > 0)
      && completeOrderCustomer(directCustomer, ports.canManageMoney);
    if (!validCustomer || !validDates || items.length < 1 || items.length > 20 || !directItems.every(intakePositionComplete)) {
      setFeedback({ kind: "validation", message: "Bitte Kunde, mindestens eine Position, Terminwunsch und zugesagten Termin vollständig angeben." });
      return;
    }
    const id = globalThis.crypto.randomUUID();
    setBusy(true);
    setFeedback(null);
    const input: DirectIntakeInput = {
      clientEventId: id,
      customer: directCustomerMode === "NEW" ? {
        mode: "NEW",
        name: directCustomer.name,
        customerType: directCustomer.customerType,
        companyName: directCustomer.companyName,
        contactPerson: directCustomer.contactPerson,
        email: directCustomer.email,
        phone: directCustomer.phone,
        street: directCustomer.street,
        zipCode: directCustomer.zipCode,
        city: directCustomer.city,
        country: directCustomer.country,
        paymentPreference: directCustomer.paymentPreference,
        vatId: directCustomer.vatId,
      } : { mode: "EXISTING", customerId: customerKey },
      // The existing F1.1 contract persists the confirmed commitment, never the non-binding wish.
      dueDate: directConfirmedDate,
      handoverMode: intakeHandover === "PICKUP" ? "pickup" : "shipping",
      ...(ports.canManageMoney ? { paymentMode: intakePaymentMode } : {}),
      note: nullable(directNote),
      items,
    };
    try {
      const created = await ports.createDirectIntake(input);
      if (created.code !== "OK") {
        setFeedback(requestFeedback(created, id));
        return;
      }
      const readback = await ports.readDirectIntakeReceipt({ orderId: created.receipt.orderId, clientEventId: id });
      if (readback.code !== "OK" || readback.receipt.orderId !== created.receipt.orderId || readback.receipt.dueDate !== directConfirmedDate) {
        setFeedback({ kind: "error", message: "Der neue Eingang konnte nicht sicher erneut gelesen werden. Die Anfragekennung bleibt für den Support verfügbar.", requestId: id });
        return;
      }
      setDirectReceipt(readback);
      const attachmentResults = await Promise.all(pendingAttachmentIds.map((attachmentId) => ports.attachIntakeAttachment({ attachmentId, orderId: created.receipt.orderId })));
      const mailResult = pendingMailId ? await ports.attachIntakeMail({ graphMessageId: pendingMailId, orderId: created.receipt.orderId }) : null;
      await ports.discardIntakeDraft();
      if (attachmentResults.some((result) => result.code !== "OK") || (mailResult && mailResult.code !== "OK")) {
        setFeedback({ kind: "error", message: "Auftrag ist gespeichert. Mindestens ein Beleg oder eine Mail ist noch nicht sicher zugeordnet und bleibt In Klärung." });
      }
      ports.refresh();
    } catch {
      setFeedback({ kind: "unclear", message: "Der Ausgang ist ungeklärt. Es wurde keine zweite Anlage ausgelöst.", requestId: id });
    } finally {
      setBusy(false);
    }
  };

  const submitDirectQuote = async (customerId: string) => {
    const positions = directItems.map((item) => ({
      name: item.name.trim(),
      quantity: Number(item.quantity),
      material: nullable(item.material),
      surfaceRequested: item.surfaceRequested.trim(),
      unitPriceCents: item.unitPriceCents,
    }));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(directWishDate) || !/^\d{4}-\d{2}-\d{2}$/.test(quoteValidUntil) || positions.some((item) => item.name.length < 2 || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.surfaceRequested.length < 2 || item.unitPriceCents === null)) {
      setFeedback({ kind: "validation", message: "Bitte Liefertermin, Gültigkeit, Positionen und Netto-Preis für den KV vollständig angeben." });
      return;
    }
    const clientEventId = requestId("quote");
    setBusy(true);
    setFeedback(null);
    try {
      const quoteNoteWithValidity = [`KV gültig bis: ${quoteValidUntil}`, directNote.trim()].filter(Boolean).join("\n");
      const result = await ports.createQuote({ clientEventId, customerId, dueDate: directWishDate, note: quoteNoteWithValidity, positions: positions.map((position) => ({ ...position, unitPriceCents: position.unitPriceCents! })) });
      if (result.code !== "OK") {
        setFeedback(requestFeedback(result, clientEventId));
        return;
      }
      setQuote(result.quote);
      setQuoteReceipt(result.receipt);
      setAwardHandoverMode(intakeHandover === "PICKUP" ? "pickup" : "shipping");
      setAwardPaymentMode(paymentModeFromPreference(directCustomer.paymentPreference));
      ports.rememberQuote(result.quote.quoteId);
      navigate("quote-saved");
    } catch {
      setFeedback({ kind: "unclear", message: "Der KV-Ausgang ist ungeklärt. Nicht erneut anlegen; zuerst den Status prüfen.", requestId: clientEventId });
    } finally {
      setBusy(false);
    }
  };

  const submitIntakePage = async (event: FormEvent) => {
    event.preventDefault();
    if (!intakeChecked) {
      setFeedback({ kind: "validation", message: "Bitte Ware, Menge und Zustand gemeinsam prüfen und bestätigen." });
      return;
    }
    const customerId = await advanceIntakeCustomer();
    if (!customerId) return;
    if (intakeKind === "QUOTE") {
      const quoteCustomerId = customerId === "NEW" ? await createDirectCustomerOnly() : customerId;
      if (quoteCustomerId) await submitDirectQuote(quoteCustomerId);
    }
    else await submitDirectIntake(event, customerId);
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

  const surfaceOptions = useMemo(() => [...new Set([
    ...DEFAULT_SURFACES,
    ...catalogServices.map((service) => service.surface).filter(Boolean),
  ])], [catalogServices]);

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
            unitPriceCents: service.netPriceCents,
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

  const reset = () => {
    setStep("choose");
    setFeedback(null);
    setCustomerDraft(EMPTY_CUSTOMER);
    setCustomerNote("");
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
    setDirectReceipt(null);
    setDirectCustomer(EMPTY_INTAKE_CUSTOMER);
    setDirectCustomerType("");
    setDirectCustomerId("");
    setDirectCustomerMode("NONE");
    setIntakeCustomerQuery("");
    setIntakeCustomerResults([]);
    setIntakeCustomerSearchState("idle");
    setIntakePaymentMode("abholung");
    setIntakePaymentModeTouched(false);
    setIntakeCustomerPaymentTouched(false);
    setDirectItems([newIntakePosition()]);
    setDirectWishDate("");
    setDirectConfirmedDate("");
    setDirectNote("");
    setIntakeKind("ORDER");
    setIntakeHandover("PICKUP");
    setIntakeSource("personal");
    setIntakeTermStatus("wish");
    setQuoteValidUntil("");
    setIntakeChecked(false);
    setSourceMode(null);
    setDraftPrompt(false);
    setPendingAttachmentIds([]);
    setPendingMailId(null);
    requestIds.current = { customer: "", quote: "", conversion: "", directCustomer: "" };
    setIntakeStep(1);
  };

  return (
    <>
      {ports.showPrimaryTrigger !== false ? <button type="button" className={styles.globalCreateButton} onClick={() => { reset(); void loadDirectIntake(); }} aria-label="Anlegen" aria-haspopup="dialog" aria-expanded={open}>
        <span className={styles.globalCreatePlus} aria-hidden="true">＋</span><span>Anlegen</span>
      </button> : null}
      {open && step === "customer" ? (
        <KrDialog
          key={customerClosePrompt ? "customer-close-prompt" : "customer"}
          titel="Kunde anlegen"
          icon="user"
          groesse="breit"
          onSchliessen={requestCustomerClose}
          fuss={customerClosePrompt ? undefined : <>
            <KrButton data-spec-id="kundeneu.abbrechen" text="Abbrechen" onClick={requestCustomerClose} />
            <KrButton data-spec-id="kundeneu.kunde-speichern" form="kr-kunde-anlegen" type="submit" art="erledigen" icon="check" text="Kunde speichern" disabled={busy} />
          </>}
        >
          {customerClosePrompt ? <div className="kr-stapel">
            <h3>Eingaben verwerfen?</h3>
            <p>Die Kundenanlage enthält noch nicht gespeicherte Eingaben.</p>
            <div className="kr-stapel">
              <KrButton art="sekundaer" text="Weiter bearbeiten" onClick={() => setCustomerClosePrompt(false)} />
              <KrButton art="gefaehrlich" text="Eingaben verwerfen" onClick={closeNow} />
            </div>
          </div> : <form id="kr-kunde-anlegen" className="kr-stapel" noValidate onSubmit={(event) => void submitCustomer(event)}>
            {!customerCoreComplete && !customerDraft.name && !customerDraft.phone ? <Hinweis>Erst suchen – vielleicht gibt es den Kunden schon</Hinweis> : null}
            <div className="kr-spalten">
              <div className="kr-stapel">
                <section className="kr-stapel" aria-label="Pflicht">
                  <h3>Pflicht</h3>
                  <CustomerFormFields
                    value={customerDraft}
                    onChange={setCustomerDraft}
                    customerType={customerType}
                    onCustomerType={changeCustomerType}
                    onlyMissing={false}
                    showPayment={ports.canManageMoney}
                    onPaymentChange={(paymentPreference) => setCustomerDraft((current) => ({ ...current, paymentPreference }))}
                    autofocus
                  />
                  <Feld label="Notiz"><Textfeld data-spec-id="kundeneu.notiz" rows={3} maxLength={2000} value={customerNote} onChange={(event) => setCustomerNote(event.target.value)} /></Feld>
                </section>
                {customerDuplicateState === "loading" ? <p aria-live="polite">Ähnliche Kunden werden gesucht …</p> : null}
                {customerDuplicateState === "error" ? <Hinweis ton="warn">Dublettenprüfung ist gerade nicht verfügbar. Eingaben bleiben erhalten.</Hinweis> : null}
                {customerDuplicateOpen ? <Hinweis ton="warn"><div className="kr-stapel" data-spec-id="kundeneu.dublette">
                  <strong>Ähnlicher Kunde vorhanden: {customerDuplicateResults[0]?.companyName ?? customerDuplicateResults[0]?.name}</strong>
                  <div className="kr-stapel">
                    <KrButton data-spec-id="kundeneu.vorhandenen-oeffnen" art="sekundaer" text="Vorhandenen öffnen" onClick={() => {
                      const match = customerDuplicateResults[0];
                      if (!match) return;
                      setOpen(false);
                      ports.openCustomer(match.id);
                    }} />
                    <KrButton data-spec-id="kundeneu.trotzdem-neu" text="Trotzdem neu anlegen" onClick={() => setCustomerDuplicateAcceptedFor(customerDuplicateQuery)} />
                  </div>
                </div></Hinweis> : null}
                {customerCoreComplete && customerOrderMissingFields.length > 0 ? <Hinweis><div className="kr-stapel" data-spec-id="kundeneu.teilweise">
                  <strong>Speicherbar als Interessent · für Auftrag fehlt: {customerOrderMissingFields.join(", ")}</strong>
                  <div className="kr-stapel">
                    <KrButton data-spec-id="kundeneu.als-interessent-speichern" art="primaer" text="Als Interessent speichern" onClick={() => void submitCustomer({ preventDefault() {} } as FormEvent)} />
                    <KrButton data-spec-id="kundeneu.weiter-ausfuellen" text="Weiter ausfüllen" onClick={() => {
                      const ids: Record<string, string> = { Ansprechpartner: "ansprechpartner", "E-Mail": "email", Straße: "strasse", PLZ: "plz", Ort: "ort", Land: "land", Zahlungsbedingung: "zahlungsbedingung" };
                      const id = ids[customerOrderMissingFields[0] ?? ""];
                      if (id) document.querySelector<HTMLElement>(`[data-spec-id="kundeneu.${id}"]`)?.focus();
                    }} />
                  </div>
                </div></Hinweis> : null}
                {feedback ? <>
                  <Hinweis ton={feedback.kind === "validation" ? "warn" : undefined}><span><strong>{feedback.kind === "unclear" ? "Ausgang ungeklärt" : "Eingabe prüfen"}</strong><br />{feedback.message}</span></Hinweis>
                  {feedback.kind === "unclear" ? <div className="kr-stapel">
                    <KrButton art="sekundaer" text="Status mit gleicher Kennung prüfen" onClick={() => void checkUnclearStatus()} disabled={busy} />
                    {statusChecked ? <KrButton text={retryConfirmed ? "Ja, jetzt erneut senden" : "Erneut senden vorbereiten"} onClick={retryAfterStatusCheck} disabled={busy} /> : null}
                  </div> : null}
                </> : null}
              </div>
              <aside className="kr-stapel" aria-label="Prüfliste">
                <h3>Prüfliste</h3>
                <Fakten zeilen={[
                  { k: "Kundentyp", v: customerType ? "erfasst" : "fehlt" },
                  { k: "Name / Firma", v: customerDraft.name.trim().length >= 2 ? "erfasst" : "fehlt" },
                  { k: "Telefon", v: validPhone(customerDraft.phone) ? "erfasst" : "fehlt" },
                  { k: "Für Aufträge", v: customerOrderMissingFields.length ? `fehlt: ${customerOrderMissingFields.join(", ")}` : "vollständig" },
                  { k: "Kundennummer", v: "wird beim Speichern vergeben" },
                ]} />
              </aside>
            </div>
          </form>}
        </KrDialog>
      ) : open && step === "direct-intake" ? (
        <KrDialog
          key={draftPrompt ? "intake-with-draft-prompt" : "intake"}
          titel={intakeKind === "QUOTE" ? "Neuer Eingang · KV" : "Neuer Eingang"}
          icon="inbox"
          groesse="breit"
          onSchliessen={requestClose}
          fuss={directReceipt ? undefined : isHandy ? (
            <>
              {intakeStep > 1 ? <KrButton text="Zurück" onClick={() => setIntakeStep((intakeStep - 1) as 1 | 2)} /> : <KrButton data-spec-id="eingang.abbrechen" text="Abbrechen" onClick={requestClose} />}
              {intakeStep === 1 ? <KrButton art="primaer" icon="arrow" text="Positionen" disabled={busy} onClick={() => void advanceIntakeCustomer()} /> : null}
              {intakeStep === 2 ? <KrButton art="primaer" icon="arrow" text="Belege & Prüfung" onClick={() => {
                if (directItems.every(intakePositionComplete)) { setFeedback(null); setIntakeStep(3); }
                else setFeedback({ kind: "validation", message: "Bitte für jede Position Bezeichnung, Menge und Oberfläche angeben." });
              }} /> : null}
              {intakeStep === 3 ? <KrButton data-spec-id="eingang.buchen" form="kr-neuer-eingang" type="submit" art="erledigen" icon="check" text={intakeKind === "QUOTE" ? "KV anlegen" : "Wareneingang buchen"} disabled={busy || !intakeChecked} /> : null}
            </>
          ) : (
            <><KrButton data-spec-id="eingang.abbrechen" text="Abbrechen" onClick={requestClose} /><KrButton data-spec-id="eingang.buchen" form="kr-neuer-eingang" type="submit" art="erledigen" icon="check" text={intakeKind === "QUOTE" ? "KV anlegen" : "Wareneingang buchen"} disabled={busy || !intakeChecked} /></>
          )}
        >
          {directReceipt ? (
            <section className={styles.createSuccess}>
              <h3>Auftrag {directReceipt.receipt.orderNumber} angelegt</h3>
              <p>Der neue Eingang ist gespeichert und im Arbeitsbestand erneut bestätigt.</p>
              <p>Übergabe: {directReceipt.receipt.handoverMode === "pickup" ? "Abholung" : "Versand"} · Zahlungsart: {directReceipt.receipt.paymentMode === "abholung" ? "Bar oder Karte bei Abholung" : directReceipt.receipt.paymentMode === "rechnung" ? "Rechnung auf Ziel" : "Vorkasse"}</p>
              <KrButton art="primaer" text="Auftragskarte öffnen" onClick={() => ports.openOrder(directReceipt.receipt.orderId)} />
            </section>
          ) : (
            <form id="kr-neuer-eingang" className="kr-stapel" onSubmit={(event) => void submitIntakePage(event)}>
              {ports.resumeQuoteId ? <Hinweis><KrButton art="sekundaer" icon="arrow" text="Gespeicherten KV fortsetzen" disabled={busy} onClick={() => void resumeQuote()} /></Hinweis> : null}
              <div className={styles.createInlineChoices} aria-label="Erfassen">
                <KrButton icon="camera" text="Zettel, Etikett, Karte" onClick={() => setSourceMode("camera")} />
                <KrButton icon="upload" text="Datei lesen" onClick={() => setSourceMode("document")} />
                {ports.canUseMail ? <KrButton icon="mail" text="Aus Mail" onClick={() => setSourceMode("mail")} /> : null}
              </div>
              <datalist id="kr-service-catalog">{catalogServices.map((service) => <option key={service.id} value={service.name}>{service.surface}</option>)}</datalist>
              {isHandy ? <SchrittNav schritte={["Kunde", "Positionen", "Prüfung"]} aktuell={intakeStep - 1} erreicht={intakeStep - 1} onSchritt={(index) => setIntakeStep((index + 1) as 1 | 2 | 3)} /> : <AbschnittNav abschnitte={["Kunde", "Positionen", "Prüfung"]} aktuell={intakeStep - 1} onAbschnitt={(index) => {
                setIntakeStep((index + 1) as 1 | 2 | 3);
                document.querySelector(`[data-abschnitt="${index}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
              }} />}

              {(!isHandy || intakeStep === 1) ? <Abschnitt nr={0} label="Kunde">
                <FormRaster>
                  <Feld label="Art" voll><div data-spec-id="eingang.art"><Segment label="Art" wert={intakeKind} optionen={ports.canManageMoney ? [{ wert: "ORDER", text: "Auftrag" }, { wert: "QUOTE", text: "KV" }] : [{ wert: "ORDER", text: "Auftrag" }]} onWert={setIntakeKind} /></div></Feld>
                  <Feld label={directCustomerMode === "NONE" ? "Kunde suchen" : "Kunde"} voll>
                    {directCustomerMode === "NONE" ? <div className="kr-stapel">
                      <Eingabe
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
                      {intakeCustomerSearchState === "loading" ? <p aria-live="polite">Kunden werden gesucht …</p> : null}
                      {intakeCustomerSearchState === "empty" ? <Hinweis>Kein Kunde gefunden.</Hinweis> : null}
                      {intakeCustomerResults.length > 0 ? <div className={styles.createCustomerList} aria-label="Kundentreffer">
                        {intakeCustomerResults.map((entry) => <button type="button" key={entry.id} onClick={() => selectIntakeCustomer("EXISTING", entry)}>
                          <span><strong>{entry.companyName ?? entry.name}</strong><small>{entry.customerNumber ?? "ohne Kundennummer"} · {entry.contactPerson ?? "kein Ansprechpartner"} · {entry.city ?? "ohne Ort"}</small></span>
                          <small>Auswählen</small>
                        </button>)}
                      </div> : null}
                      {intakeCustomerResults.length > 0 ? <Hinweis ton="warn">Möglicher Doppelter vorhanden – bitte Treffer prüfen.</Hinweis> : null}
                      <KrButton art="sekundaer" icon="plus" text={intakeCustomerQuery.trim() ? `„${intakeCustomerQuery.trim()}“ als Neukunde anlegen` : "Neukunde anlegen"} onClick={() => selectIntakeCustomer("NEW")} />
                    </div> : <div className="kr-stapel">
                      <Fakten zeilen={[{ k: "Name / Firma", v: directCustomer.companyName ?? directCustomer.name }, { k: "Kundennummer", v: customerChoices.find((entry) => entry.id === directCustomerId)?.customerNumber ?? "wird beim Speichern vergeben" }]} />
                      <KrButton art="sekundaer" text="Anderer Kunde" onClick={() => selectIntakeCustomer("NONE")} />
                    </div>}
                  </Feld>
                </FormRaster>
                {directCustomerMode === "NEW" ? <CustomerFormFields value={directCustomer} onChange={setDirectCustomer} customerType={directCustomerType} onCustomerType={changeDirectCustomerType} onlyMissing={false} showPayment={ports.canManageMoney} onPaymentChange={changeIntakeCustomerPayment} autofocus /> : null}
                {directCustomerMode === "EXISTING" && !completeOrderCustomer(directCustomer, ports.canManageMoney) ? <>
                  <Hinweis ton="warn">Für diesen Kunden fehlen noch Pflichtdaten.</Hinweis>
                  <CustomerFormFields value={directCustomer} onChange={setDirectCustomer} customerType={directCustomerType} onCustomerType={changeDirectCustomerType} onlyMissing showPayment={ports.canManageMoney} onPaymentChange={changeIntakeCustomerPayment} />
                </> : null}
                <FormRaster>
                  <Feld label="Liefertermin"><Eingabe data-spec-id="eingang.liefertermin" type="date" required value={directWishDate} onChange={(event) => { setDirectWishDate(event.target.value); setDirectConfirmedDate(event.target.value); }} /></Feld>
                  <Feld label="Termin ist"><div data-spec-id="eingang.terminstatus"><Segment label="Termin ist" wert={intakeTermStatus} optionen={[{ wert: "wish", text: "Wunsch" }, { wert: "confirmed", text: "bestätigt" }]} onWert={setIntakeTermStatus} /></div></Feld>
                  <Feld label="Übergabe"><div data-spec-id="eingang.uebergabe"><Segment label="Übergabe" wert={intakeHandover} optionen={[{ wert: "PICKUP", text: "Abholung" }, { wert: "SHIPPING", text: "Versand" }]} onWert={changeIntakeHandover} /></div></Feld>
                  {ports.canManageMoney ? <Feld label="Zahlungsmodus">
                    <Auswahl required data-spec-id="eingang.zahlungsmodus" value={intakePaymentMode} onChange={(event) => { setIntakePaymentMode(event.target.value as PaymentMode); setIntakePaymentModeTouched(true); }} optionen={[
                      { wert: "vorkasse", text: "Vorkasse" },
                      { wert: "abholung", text: intakeHandover === "PICKUP" ? "Bar oder Karte bei Abholung" : "Bar oder Karte bei Abholung (nur bei Abholung)", gesperrt: intakeHandover === "SHIPPING" },
                      { wert: "rechnung", text: directCustomerMode === "EXISTING" && /^rechnung_/.test(directCustomer.paymentPreference) ? "Rechnung auf Ziel" : "Rechnung auf Ziel (nicht freigeschaltet)", gesperrt: !(directCustomerMode === "EXISTING" && /^rechnung_/.test(directCustomer.paymentPreference)) },
                    ]} />
                  </Feld> : null}
                  <Feld label="Eingangsart"><Auswahl data-spec-id="eingang.eingangsart" value={intakeSource} onChange={(event) => setIntakeSource(event.target.value as typeof intakeSource)} optionen={[{ wert: "personal", text: "persönlich angeliefert" }, { wert: "shipping", text: "Versand eingegangen" }, { wert: "pickup", text: "Abholung durch Kreile" }, { wert: "mail", text: "Anfrage per Mail" }, { wert: "phone", text: "Anfrage per Telefon" }]} /></Feld>
                  {intakeSource === "phone" ? <Feld label="Telefonnotiz" voll><Textfeld data-spec-id="eingang.telefonnotiz" rows={3} value={directNote} onChange={(event) => setDirectNote(event.target.value)} /></Feld> : null}
                  {intakeKind === "QUOTE" ? <Feld label="KV gültig bis"><Eingabe data-spec-id="eingang.gueltig_bis" type="date" required value={quoteValidUntil} onChange={(event) => setQuoteValidUntil(event.target.value)} /></Feld> : null}
                </FormRaster>
              </Abschnitt> : null}

              {(!isHandy || intakeStep === 2) ? <Abschnitt nr={1} label="Positionen">
                <div className="kr-stapel">
                  {directItems.map((item, index) => <div className="kr-position" key={item.key}>
                    <span className="kr-position-nr">{index + 1}</span>
                    <Feld label="Teil / Bezeichnung"><Eingabe required minLength={2} list="kr-service-catalog" placeholder="Katalog oder Freitext" value={item.name} onChange={(event) => setDirectPositionName(item.key, event.target.value)} /></Feld>
                    <Feld label="Menge"><Eingabe type="number" min="1" value={item.quantity} onChange={(event) => updateDirectItem(item.key, "quantity", event.target.value)} /></Feld>
                    <Feld label="Oberfläche" className="kr-pos-oberflaeche"><Auswahl required value={item.surfaceRequested} onChange={(event) => setDirectPositionSurface(item.key, event.target.value)} optionen={[{ wert: "", text: "Bitte wählen" }, ...surfaceOptions.map((surface) => ({ wert: surface, text: surface }))]} /></Feld>
                    <Feld label="Ausführung"><Auswahl data-spec-id="eingang.position.ausfuehrung" value={item.executionRequested} onChange={(event) => updateDirectItem(item.key, "executionRequested", event.target.value)} optionen={EXECUTION_OPTIONS} /></Feld>
                    <Feld label="Material"><Eingabe data-spec-id="eingang.position.material" maxLength={120} value={item.material} onChange={(event) => updateDirectItem(item.key, "material", event.target.value)} /></Feld>
                    {ports.canManageMoney && intakeKind === "QUOTE" && item.catalogServiceId === FREE_TEXT_SERVICE ? <Feld label="Preis netto (€)"><Eingabe required type="number" min="0" step="0.01" value={item.unitPriceCents === null ? "" : String(item.unitPriceCents / 100)} onChange={(event) => setDirectPositionPrice(item.key, event.target.value)} /></Feld> : null}
                    <KrButton art="sekundaer" icon="x" label="Position entfernen" disabled={directItems.length === 1} onClick={() => setDirectItems((current) => current.filter((entry) => entry.key !== item.key))} />
                  </div>)}
                </div>
                <KrButton art="sekundaer" icon="plus" text="Position hinzufügen" disabled={directItems.length >= 20} onClick={() => setDirectItems((current) => [...current, newIntakePosition()])} />
              </Abschnitt> : null}

              {(!isHandy || intakeStep === 3) ? <Abschnitt nr={2} label="Prüfung">
                <Hinweis ton="warn">Eingangsfoto fehlt</Hinweis>
                <div className={styles.createInlineChoices}>
                  <KrButton data-spec-id="eingang.eingangsfoto" icon="camera" text="Eingangsfoto" onClick={() => setSourceMode("camera")} />
                  <KrButton data-spec-id="eingang.dokument" icon="upload" text="Dokument hinzufügen" onClick={() => setSourceMode("document")} />
                </div>
                <Feld label="Hinweis / Belege" voll><Textfeld rows={3} value={directNote} onChange={(event) => setDirectNote(event.target.value)} /></Feld>
                <FormRaster>
                  <Fakten zeilen={[
                    { k: "Art", v: intakeKind === "QUOTE" ? "KV" : "Auftrag" },
                    { k: "Kunde", v: directCustomerMode === "NONE" ? "Nicht gewählt" : directCustomer.name || "Neukunde" },
                    { k: "Positionen", v: String(directItems.length) },
                    { k: "Wunschtermin", v: directWishDate || "Nicht angegeben" },
                    { k: "Übergabe", v: intakeHandover === "PICKUP" ? "Abholung" : "Versand" },
                    ...(ports.canManageMoney ? [{ k: "Zahlungsart", v: intakePaymentMode === "abholung" ? "Bar oder Karte bei Abholung" : intakePaymentMode === "rechnung" ? "Rechnung auf Ziel" : "Vorkasse" }] : []),
                  ]} />
                </FormRaster>
                <div data-spec-id="eingang.geprueft"><Checkbox checked={intakeChecked} onChange={setIntakeChecked}><b>Ware, Menge und Zustand gemeinsam geprüft</b></Checkbox></div>
              </Abschnitt> : null}

              {feedback ? <>
                <Hinweis ton={feedback.kind === "validation" ? "warn" : undefined}><span><strong>{feedback.kind === "unclear" ? "Ausgang ungeklärt" : "Eingabe prüfen"}</strong><br />{feedback.message}</span></Hinweis>
                {feedback.kind === "unclear" ? <div className="kr-stapel">
                  <KrButton art="sekundaer" text="Status mit gleicher Kennung prüfen" onClick={() => void checkUnclearStatus()} disabled={busy} />
                  {statusChecked ? <KrButton text={retryConfirmed ? "Ja, jetzt erneut senden" : "Erneut senden vorbereiten"} onClick={retryAfterStatusCheck} disabled={busy} /> : null}
                </div> : null}
              </> : null}
            </form>
          )}
        </KrDialog>
      ) : open ? (
        <div className={styles.createOverlay} onMouseDown={(event) => { if (event.target === event.currentTarget) closeNow(); }}>
          <section ref={dialogRef} className={styles.createDialog} role="dialog" aria-modal="true" aria-labelledby="global-create-title" onKeyDown={handleDialogKey}>
            <header className={styles.createHeader}>
              <span className={styles.createBadge}><Plus /></span>
              <div>
                <p>Kunde <span>›</span> KV / Angebot <span>›</span> Auftrag</p>
                <h2 id="global-create-title">{step === "choose" ? "Was möchtest du anlegen?" : step === "customer" ? "Neukunde erfassen" : step === "customer-saved" ? "Kunde gesichert" : step === "customer-picker" ? "Kunde für KV wählen" : step === "quote-list" ? "Offene KVs" : step === "quote" ? quote ? "KV bearbeiten" : "Kostenvoranschlag anlegen" : step === "quote-saved" ? "KV gesichert" : step === "order-saved" ? "Auftrag angelegt" : step === "direct-intake" ? "Neuer Eingang" : "Berechtigung klären"}</h2>
              </div>
              <button type="button" className={styles.createIconButton} onClick={closeNow} disabled={busy} aria-label="Anlegen schließen"><X /></button>
            </header>

            <div className={styles.createBody}>
              {step === "choose" ? (
                <>
                  <p className={styles.createLead}>Manuell erfassen und nach jedem Speichern sicher weiterarbeiten.</p>
                  {ports.resumeQuoteId ? (
                    <button type="button" className={styles.createResume} onClick={() => void resumeQuote()} disabled={busy} data-autofocus>
                      <FileText /> <span><strong>Gespeicherten KV fortsetzen</strong><small>Sicher gespeicherten KV weiterbearbeiten und den Zuschlag erfassen.</small></span>
                    </button>
                  ) : null}
                  <div className={styles.createChoiceGrid}>
                    <button type="button" onClick={() => ports.canCreateCustomer ? navigate("customer") : deny("customer")} data-autofocus={!ports.resumeQuoteId || undefined}>
                      <UserPlus /><span><strong>Kunde anlegen</strong><small>Neukunde manuell erfassen. Danach direkt einen KV anlegen.</small></span>
                    </button>
                    <button type="button" className={styles.createChoiceAlternate} onClick={() => void loadCustomers()}>
                      <FileText /><span><strong>Auftrag / KV anlegen</strong><small>Bestehenden Kunden wählen und einen KV sicher speichern.</small></span>
                    </button>
                    <button type="button" className={styles.createChoiceAlternate} onClick={() => void loadOpenQuotes()}>
                      <FileText /><span><strong>Offene KVs bearbeiten</strong><small>Gespeicherte Entwürfe sicher wieder aufnehmen.</small></span>
                    </button>
                  </div>
                  <p className={styles.createPassive}>Hier wird ausschließlich manuell erfasst. Weitere Anbindungen sind nicht aktiv.</p>
                </>
              ) : null}

              {step === "direct-intake" ? directReceipt ? (
                <section className={styles.createSuccess}>
                  <span className={styles.createSuccessIcon}><Check /></span>
                  <h3>Auftrag {directReceipt.receipt.orderNumber} angelegt</h3>
                  <p>Der neue Eingang ist gespeichert und im Arbeitsbestand erneut bestätigt.</p>
                  <p>Übergabe: {directReceipt.receipt.handoverMode === "pickup" ? "Abholung" : "Versand"} · Zahlungsart: {directReceipt.receipt.paymentMode === "abholung" ? "Bar oder Karte bei Abholung" : directReceipt.receipt.paymentMode === "rechnung" ? "Rechnung auf Ziel" : "Vorkasse"}</p>
                  <p>Terminwunsch: {directWishDate} · Zugesagter Termin: {directReceipt.receipt.dueDate}</p>
                  <div className={styles.createFormActions}><button type="button" onClick={() => { reset(); void loadDirectIntake(); }}>Weiteren Eingang anlegen</button><button type="button" className={styles.createPrimary} onClick={() => ports.openOrder(directReceipt.receipt.orderId)}>Auftragskarte öffnen</button></div>
                  <ReceiptFacts title="Neuer Eingang – technische Details für Support" values={[["Anfragekennung", directReceipt.receipt.clientEventId], ["Bestätigung", directReceipt.receipt.receiptId]]} />
                </section>
              ) : (
                <form className={styles.createForm} onSubmit={(event) => void submitDirectIntake(event)}>
                  <nav className={styles.createInlineChoices} aria-label="Schritte Neuer Eingang">{[1, 2, 3].map((nr) => <button key={nr} type="button" aria-current={intakeStep === nr ? "step" : undefined} aria-pressed={intakeStep === nr} onClick={() => { if (nr < intakeStep) setIntakeStep(nr as 1 | 2 | 3); }}>{nr}/3 · {nr === 1 ? "Kunde & Vereinbarung" : nr === 2 ? "Positionen" : "Prüfung & Belege"}</button>)}</nav>
                  {intakeStep === 1 ? <>
                    <p className={styles.createLead}>Kunde wählen oder neu anlegen. Fehlende Pflichtdaten werden hier ergänzt, bevor ein Auftrag entstehen kann.</p>
                    <div className={styles.createInlineChoices} role="group" aria-label="Kunde für neuen Eingang">
                      <button type="button" aria-pressed={directCustomerMode === "NEW"} onClick={() => { setDirectCustomerMode("NEW"); setDirectCustomer(EMPTY_INTAKE_CUSTOMER); setDirectCustomerId(""); }}>Neukunde</button>
                      <button type="button" aria-pressed={directCustomerMode === "EXISTING"} onClick={() => { const first = customerChoices[0]; if (first) { setDirectCustomerMode("EXISTING"); setDirectCustomerId(first.id); setDirectCustomer(customerChoiceToDraft(first)); } }} disabled={customerChoices.length === 0}>Bestehender Kunde</button>
                    </div>
                    {directCustomerMode === "EXISTING" ? <label className={styles.createFieldWide}>Kunde<select value={directCustomerId} onChange={(event) => { const selected = customerChoices.find((entry) => entry.id === event.target.value); if (selected) { setDirectCustomerId(selected.id); setDirectCustomer(customerChoiceToDraft(selected)); } }}>{customerChoices.map((entry) => <option key={entry.id} value={entry.id}>{entry.customerNumber ?? "ohne Nummer"} · {entry.name}</option>)}</select></label> : null}
                    <CustomerFormFields value={directCustomer} onChange={setDirectCustomer} customerType={directCustomerType} onCustomerType={changeDirectCustomerType} onlyMissing={false} showPayment={ports.canManageMoney} onPaymentChange={changeIntakeCustomerPayment} autofocus />
                    <div className={styles.createFormGrid}><label>Terminwunsch<input type="date" value={directWishDate} onChange={(event) => setDirectWishDate(event.target.value)} required /></label><label>Zugesagter Termin<input type="date" value={directConfirmedDate} onChange={(event) => setDirectConfirmedDate(event.target.value)} required /></label><label>Eingangsart<select defaultValue="anruf"><option value="anruf">Anruf</option><option value="persoenlich">Persönlich</option><option value="email">E-Mail</option></select></label></div>
                    <div className={styles.createFormActions}><button type="button" className={styles.createPrimary} onClick={() => void advanceIntakeCustomer()} disabled={busy}>{busy ? <Loader2 className={styles.createSpinner} /> : null} Weiter zu Positionen</button></div>
                  </> : null}
                  {intakeStep === 2 ? <>
                    <p className={styles.createLead}>Teil aus dem Katalog übernehmen oder frei beschreiben. Die Oberfläche wird immer separat gewählt; ein Preis darf zunächst offen bleiben.</p>
                    {directItems.map((item, index) => <fieldset className={styles.createPosition} key={item.key}><legend>Position {index + 1}</legend><div className={styles.createFormGrid}>
                      <label className={styles.createFieldWide}>Teil / Bezeichnung<input required minLength={2} list="kr-service-catalog" placeholder="Katalog oder Freitext" value={item.name} onChange={(event) => setDirectPositionName(item.key, event.target.value)} /></label>
                      <label>Menge<input type="number" min="1" value={item.quantity} onChange={(event) => updateDirectItem(item.key, "quantity", event.target.value)} /></label><label>Material<input maxLength={120} value={item.material} onChange={(event) => updateDirectItem(item.key, "material", event.target.value)} /></label><label>Oberfläche<select required value={item.surfaceRequested} onChange={(event) => setDirectPositionSurface(item.key, event.target.value)}><option value="">Bitte wählen</option>{surfaceOptions.map((surface) => <option key={surface} value={surface}>{surface}</option>)}</select></label><label>Ausführung<select value={item.executionRequested} onChange={(event) => updateDirectItem(item.key, "executionRequested", event.target.value)}>{EXECUTION_OPTIONS.map((option) => <option key={option.wert} value={option.wert}>{option.text}</option>)}</select></label><label>Einheit<input readOnly value={item.unit ?? "offen"} /></label>{intakeKind === "QUOTE" && item.catalogServiceId === FREE_TEXT_SERVICE ? <label>Preis netto (€)<input required type="number" min="0" step="0.01" value={item.unitPriceCents === null ? "" : String(item.unitPriceCents / 100)} onChange={(event) => setDirectPositionPrice(item.key, event.target.value)} /></label> : <label>Preis netto<input readOnly value={item.unitPriceCents === null ? "offen" : euro(item.unitPriceCents)} /></label>}
                    </div>{directItems.length > 1 ? <button type="button" onClick={() => setDirectItems((current) => current.filter((entry) => entry.key !== item.key))}>Position entfernen</button> : null}</fieldset>)}
                    <div className={styles.createFormActions}><button type="button" onClick={() => setDirectItems((current) => current.length >= 20 ? current : [...current, newIntakePosition()])} disabled={directItems.length >= 20}>Position hinzufügen</button><button type="button" className={styles.createPrimary} onClick={() => { if (directItems.every(intakePositionComplete)) { setFeedback(null); setIntakeStep(3); } else setFeedback({ kind: "validation", message: "Bitte für jede Position Bezeichnung, Menge und Oberfläche angeben." }); }}>Weiter zur Prüfung</button></div>
                  </> : null}
                  {intakeStep === 3 ? <><div className={styles.createContext}><span>Kunde</span><strong>{directCustomer.name}</strong><span>Termin</span><strong>{directConfirmedDate}</strong><span>Positionen</span><strong>{directItems.length}</strong></div><label className={styles.createFieldWide}>Hinweis / Belege<textarea rows={3} value={directNote} onChange={(event) => setDirectNote(event.target.value)} placeholder="Notiz; Fotos und Dokumente folgen in P2." /></label><div className={styles.createFormActions}><button type="button" onClick={() => setIntakeStep(2)}>Zurück</button><button type="submit" className={styles.createPrimary} disabled={busy}>{busy ? <Loader2 className={styles.createSpinner} /> : <Check />} Eingang speichern</button></div></> : null}
                </form>
              ) : null}

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
                        <label className={styles.createFieldWide}>Teil / Bezeichnung<input data-autofocus={index === 0 || undefined} required minLength={2} list="kr-service-catalog" placeholder="Katalog oder Freitext" value={position.name} onChange={(event) => setQuotePositionName(position.key, event.target.value)} /></label>
                        <label>Menge<input required inputMode="numeric" type="number" min="1" max="1000000" value={position.quantity} onChange={(event) => setPosition(position.key, "quantity", event.target.value)} /></label>
                        <label>Material<input value={position.material} onChange={(event) => setPosition(position.key, "material", event.target.value)} /></label>
                        <label>Oberfläche<select required value={position.surfaceRequested} onChange={(event) => setQuotePositionSurface(position.key, event.target.value)}><option value="">Bitte wählen</option>{surfaceOptions.map((surface) => <option key={surface} value={surface}>{surface}</option>)}</select></label>
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
      {open && sourceMode ? <F1SourceDialogs
        mode={sourceMode}
        graphMessageId={sourceMode === "mail" ? pendingMailId : null}
        canUseMail={ports.canUseMail}
        customerId={directCustomerMode === "EXISTING" ? directCustomerId : null}
        onClose={() => setSourceMode(null)}
        onMode={setSourceMode}
        onAttachment={(attachmentId) => setPendingAttachmentIds((current) => current.includes(attachmentId) ? current : [...current, attachmentId])}
        onDocument={(suggestions) => {
          const due = suggestions.find((item) => item.field === "DUE_DATE")?.value;
          const quantity = suggestions.find((item) => item.field === "QUANTITY")?.value;
          const material = suggestions.find((item) => item.field === "MATERIAL")?.value;
          const customerName = suggestions.find((item) => item.field === "CUSTOMER_NAME")?.value;
          if (due && /^\d{4}-\d{2}-\d{2}$/.test(due)) { setDirectWishDate(due); setDirectConfirmedDate(due); }
          if (customerName && directCustomerMode !== "EXISTING") {
            setDirectCustomerMode("NEW");
            setDirectCustomer((current) => ({ ...current, name: customerName }));
          }
          if (quantity || material) setDirectItems((current) => current.map((item, index) => index === 0 ? {
            ...item,
            quantity: quantity && /^\d+$/.test(quantity) ? quantity : item.quantity,
            material: material ?? item.material,
          } : item));
        }}
        onMail={(mail, matchedCustomer) => {
          setPendingMailId(mail.id);
          setIntakeSource("mail");
          setIntakeKind(ports.canManageMoney ? "QUOTE" : "ORDER");
          setDirectNote((current) => [`Anfrage aus Outlook: ${mail.subject}`, current].filter(Boolean).join("\n"));
          if (matchedCustomer) {
            const draft = customerChoiceToDraft(matchedCustomer);
            setDirectCustomerMode("EXISTING");
            setDirectCustomerId(matchedCustomer.id);
            setDirectCustomerType(draft.customerType === "privat" ? "privat" : "business");
            setDirectCustomer(draft);
            setIntakeCustomerQuery(matchedCustomer.companyName ?? matchedCustomer.name);
            setIntakePaymentMode(paymentModeFromPreference(
              draft.paymentPreference,
              intakeHandover === "PICKUP" ? "pickup" : "shipping",
            ));
          } else {
            setDirectCustomerMode("NEW");
            setDirectCustomerId("");
            setDirectCustomer((current) => ({ ...current, name: mail.senderName || mail.senderAddress, email: mail.senderAddress }));
          }
        }}
        onNewCustomer={(mail) => {
          setDirectCustomerMode("NEW");
          setDirectCustomerId("");
          setDirectCustomer((current) => ({ ...current, name: mail.senderName || mail.senderAddress, email: mail.senderAddress }));
          setPendingMailId(mail.id);
          setIntakeSource("mail");
        }}
      /> : null}
      {open && draftPrompt ? <KrDialog titel="Entwurf behalten?" icon="file" groesse="schmal" onSchliessen={() => setDraftPrompt(false)} fuss={<>
        <KrButton data-spec-id="entwurf.verwerfen" text="Verwerfen" onClick={() => void (async () => {
          setBusy(true);
          const result = await ports.discardIntakeDraft();
          setBusy(false);
          if (result.code === "OK") closeNow();
          else setFeedback(requestFeedback(result, "draft-discard"));
        })()} disabled={busy} />
        <KrButton data-spec-id="entwurf.entwurf-behalten" art="sekundaer" icon="check" text="Entwurf behalten" onClick={() => void (async () => {
          setBusy(true);
          const result = await ports.saveIntakeDraft(intakeDraftPayload());
          setBusy(false);
          if (result.code === "OK") closeNow();
          else setFeedback(requestFeedback(result, "draft-save"));
        })()} disabled={busy} />
        <KrButton data-spec-id="entwurf.weiter-bearbeiten" art="primaer" text="Weiter bearbeiten" onClick={() => setDraftPrompt(false)} disabled={busy} />
      </>}>
        <p>Der Entwurf steht danach auf „Der Tag“ dieses Logins – dort weiterbearbeiten oder verwerfen.</p>
      </KrDialog> : null}
    </>
  );
}
