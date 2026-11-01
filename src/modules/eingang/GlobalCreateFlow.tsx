"use client";

import {
  Camera,
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
  Chip,
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
export type { ConvertQuoteInput, CreateQuoteInput, UpdateQuoteInput } from "@/modules/quotes/public";
import type { IntakeTextRecognition } from "@/lib/server/intakeTextRecognition";
import type { IntakeSuggestions, IntakeSuggestionsInput } from "@/lib/intakeSuggestionsContract";
import styles from "@/components/layout/TargetShell.module.css";
import { GLOBAL_CREATE_OPEN_EVENT, type GlobalCreateIntent, type GlobalCreateRequest } from "./requestGlobalCreate";

export { requestGlobalCreate } from "./requestGlobalCreate";
export type { GlobalCreateIntent, GlobalCreateRequest } from "./requestGlobalCreate";

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
  lastHandoverMode?: "pickup" | "shipping" | null;
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
  customer: { mode: "EXISTING"; customerId: string };
  dueDate: string;
  termStatus: "wunsch" | "bestaetigt" | "verschoben";
  intakeSource: "persoenlich" | "versand" | "abholung_firma" | "anfrage_mail" | "anfrage_telefon";
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
        termStatus: "wunsch" | "bestaetigt" | "verschoben" | null;
        intakeSource: "persoenlich" | "versand" | "abholung_firma" | "anfrage_mail" | "anfrage_telefon" | null;
        handoverMode: "pickup" | "shipping";
        paymentMode: "vorkasse" | "abholung" | "rechnung";
        recordedAt: string;
      };
      replayed: boolean;
    }
  | Failure;

export type GlobalCreatePorts = {
  canCreateCustomer: boolean;
  canCreateOrder: boolean;
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
  recognizeIntakeText: (text: string) => Promise<{ code: "OK"; data: IntakeTextRecognition } | Failure>;
  getIntakeSuggestions: (input: IntakeSuggestionsInput) => Promise<{ code: "OK"; data: IntakeSuggestions } | Failure>;
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
type IntakePositionDraft = { key:string; catalogServiceId:string; name:string; quantity:string; material:string; surfaceRequested:string; surfaceTouched:boolean; executionRequested:IntakeExecution; unit:string|null; unitPriceCents:number|null; vatRateBasisPoints:0|700|1900|null };
type IntakeSuggestionState = { kind: "idle" | "loading" | "error" } | { kind: "data"; data: IntakeSuggestions; loading: boolean };
type IntakeTermChoice = { kind: "adopted" | "kept"; basisKey: string; wishDate: string; achievableDate: string };
type IntakeChecklistEntry = {
  id: string;
  label: string;
  detail: string;
  complete: boolean;
  step: 1 | 2 | 3;
  target: string;
  warning?: boolean;
};

function CustomerFormFields({
  value,
  onChange,
  customerType,
  onCustomerType,
  onlyMissing,
  showPayment,
  onPaymentChange,
  forceFields = [],
  autofocus = false,
}: {
  value: CustomerDraft;
  onChange: (value: CustomerDraft) => void;
  customerType: "" | "business" | "privat";
  onCustomerType: (value: "business" | "privat") => void;
  onlyMissing: boolean;
  showPayment: boolean;
  onPaymentChange: (value: string) => void;
  forceFields?: readonly (keyof CustomerDraft)[];
  autofocus?: boolean;
}) {
  const set = <K extends keyof CustomerDraft>(key: K, next: CustomerDraft[K]) => onChange({ ...value, [key]: next });
  const missing = (value: string | null | undefined) => !value?.trim();
  const show = (key: keyof CustomerDraft, value: string | null | undefined) => !onlyMissing || missing(value) || forceFields.includes(key);
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
      {show("name", value.name) ? <Feld label="Name / Firma" voll><Eingabe data-spec-id="kundeneu.name" data-autofocus={autofocus || undefined} required minLength={2} maxLength={160} value={value.name} onChange={(event) => setName(event.target.value)} /></Feld> : null}
      {show("contactPerson", value.contactPerson) ? <Feld label="Ansprechpartner"><Eingabe data-spec-id="kundeneu.ansprechpartner" maxLength={120} value={value.contactPerson ?? ""} onChange={(event) => set("contactPerson", nullable(event.target.value))} /></Feld> : null}
      {show("phone", value.phone) ? <Feld label="Telefon"><Eingabe data-spec-id="kundeneu.telefon" required type="tel" minLength={6} maxLength={20} value={value.phone ?? ""} onChange={(event) => set("phone", nullable(event.target.value))} /></Feld> : null}
      {show("email", value.email) ? <Feld label="E-Mail"><Eingabe data-spec-id="kundeneu.email" type="email" maxLength={254} value={value.email ?? ""} onChange={(event) => set("email", nullable(event.target.value))} /></Feld> : null}
      {show("street", value.street) ? <Feld label="Straße"><Eingabe data-spec-id="kundeneu.strasse" maxLength={160} value={value.street} onChange={(event) => set("street", event.target.value)} /></Feld> : null}
      {show("zipCode", value.zipCode) ? <Feld label="PLZ"><Eingabe data-spec-id="kundeneu.plz" minLength={2} maxLength={10} value={value.zipCode} onChange={(event) => set("zipCode", event.target.value)} /></Feld> : null}
      {show("city", value.city) ? <Feld label="Ort"><Eingabe data-spec-id="kundeneu.ort" maxLength={100} value={value.city} onChange={(event) => set("city", event.target.value)} /></Feld> : null}
      {show("country", value.country) ? <Feld label="Land"><Auswahl data-spec-id="kundeneu.land" value={value.country} onChange={(event) => set("country", event.target.value)} optionen={[
        { wert: "Deutschland", text: "Deutschland" },
        { wert: "Österreich", text: "Österreich" },
        { wert: "Schweiz", text: "Schweiz" },
        { wert: "Anderes Land", text: "Anderes Land" },
      ]} /></Feld> : null}
      {showPayment && show("paymentPreference", value.paymentPreference) ? <Feld label="Zahlungsbedingung"><Auswahl data-spec-id="kundeneu.zahlungsbedingung" required value={value.paymentPreference || "vorkasse"} onChange={(event) => onPaymentChange(event.target.value)} optionen={[
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
    validPhone(customer.phone) && Boolean(customer.email?.trim()) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email ?? "") &&
    customer.street.trim().length >= 2 && customer.zipCode.trim().length >= 2 && customer.city.trim().length >= 1 &&
    customer.country.trim().length >= 2 && validPostcode(customer.country, customer.zipCode)
    && (!requirePaymentPreference || customer.paymentPreference.trim().length > 0);
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
  quantity: "",
  material: "",
  surfaceRequested: "",
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
  const [directCustomerMode, setDirectCustomerMode] = useState<"NONE" | "EXISTING">("NONE");
  const [intakeStep, setIntakeStep] = useState<1 | 2 | 3>(1);
  const [intakeHandover, setIntakeHandover] = useState<"" | "PICKUP" | "SHIPPING">("");
  const [intakeTermStatus, setIntakeTermStatus] = useState<"wish" | "confirmed">("wish");
  const [directCustomer, setDirectCustomer] = useState<CustomerDraft>(EMPTY_INTAKE_CUSTOMER);
  const [directCustomerType, setDirectCustomerType] = useState<"" | "business" | "privat">("");
  const [directCustomerId, setDirectCustomerId] = useState("");
  const [intakeCustomerQuery, setIntakeCustomerQuery] = useState("");
  const [intakeCustomerResults, setIntakeCustomerResults] = useState<GlobalCreateCustomerChoice[]>([]);
  const [intakeCustomerSearchState, setIntakeCustomerSearchState] = useState<"idle" | "loading" | "ready" | "empty" | "error">("idle");
  const [intakePaymentMode, setIntakePaymentMode] = useState<PaymentMode | "">("");
  const [directItems, setDirectItems] = useState<IntakePositionDraft[]>(() => [newIntakePosition()]);
  const [catalogServices, setCatalogServices] = useState<CatalogService[]>([]);
  const [directWishDate, setDirectWishDate] = useState("");
  const [intakeWishDateOrigin, setIntakeWishDateOrigin] = useState<"empty" | "recognized" | "manual">("empty");
  const [directConfirmedDate, setDirectConfirmedDate] = useState("");
  const [directNote, setDirectNote] = useState("");
  const [intakeRecognitionText, setIntakeRecognitionText] = useState("");
  const [lastRecognizedText, setLastRecognizedText] = useState("");
  const [recognitionBusy, setRecognitionBusy] = useState(false);
  const [recognitionMarkers, setRecognitionMarkers] = useState<Array<{ key: string; label: string; value: string; source: string }>>([]);
  const [recognitionConfirmed, setRecognitionConfirmed] = useState(false);
  const [intakeSuggestionState, setIntakeSuggestionState] = useState<IntakeSuggestionState>({ kind: "idle" });
  const [intakeTermChoice, setIntakeTermChoice] = useState<IntakeTermChoice | null>(null);
  const [directReceipt, setDirectReceipt] = useState<Extract<GlobalCreateDirectIntakeResult, { code: "OK" }> | null>(null);
  const [intakeClientKey, setIntakeClientKey] = useState(() => globalThis.crypto.randomUUID());
  const [quote, setQuote] = useState<QuoteReadback | null>(null);
  const [quoteReceipt, setQuoteReceipt] = useState<(QuoteCreateReceipt | QuoteUpdateReceipt) | null>(null);
  const [openQuotesState, setOpenQuotesState] = useState<OpenQuotesState>({ kind: "idle" });
  const [conversion, setConversion] = useState<Extract<GlobalCreateConversionResult, { code: "OK" }> | null>(null);
  const requestIds = useRef({ customer: "", quote: "", conversion: "", directCustomer: "" });
  const customerRequestSeq = useRef(0);
  const intakeCustomerSearchSeq = useRef(0);
  const customerDuplicateSearchSeq = useRef(0);
  const intakeSuggestionSeq = useRef(0);
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
  const intakeSuggestionBasisKey = useMemo(() => JSON.stringify({
    kind: "ORDER",
    customerId: directCustomerMode === "EXISTING" ? directCustomerId : null,
    positions: directItems.map((item) => ({
      key: item.key,
      catalogServiceId: item.catalogServiceId === FREE_TEXT_SERVICE ? null : item.catalogServiceId,
      name: item.name.trim(),
      quantity: Number(item.quantity),
      surfaceRequested: item.surfaceRequested.trim(),
      unit: item.unit,
      unitPriceCents: item.unitPriceCents,
    })),
  }), [directCustomerId, directCustomerMode, directItems]);

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
    if (!open || step !== "direct-intake" || directReceipt) return;
    const positions = directItems.map((item) => ({
      key: item.key,
      catalogServiceId: item.catalogServiceId === FREE_TEXT_SERVICE ? null : item.catalogServiceId,
      name: item.name.trim(),
      quantity: Number(item.quantity),
      surfaceRequested: item.surfaceRequested.trim(),
      unit: item.unit,
      unitPriceCents: item.unitPriceCents,
    }));
    const ready = positions.length >= 1 && positions.every((position) => position.name.length >= 2
      && Number.isSafeInteger(position.quantity) && position.quantity >= 1
      && position.surfaceRequested.length >= 2);
    if (!ready) {
      const resetTimer = window.setTimeout(() => {
        setIntakeSuggestionState({ kind: "idle" });
        setIntakeTermChoice(null);
      }, 0);
      return () => window.clearTimeout(resetTimer);
    }

    if (intakeTermChoice?.basisKey === intakeSuggestionBasisKey) {
      const chosenDate = intakeTermChoice.kind === "adopted" ? intakeTermChoice.achievableDate : intakeTermChoice.wishDate;
      if (directWishDate === chosenDate) return;
    }
    if (intakeTermChoice) {
      const resetTimer = window.setTimeout(() => setIntakeTermChoice(null), 0);
      return () => window.clearTimeout(resetTimer);
    }

    const sequence = ++intakeSuggestionSeq.current;
    const suggestionWishDate = /^\d{4}-\d{2}-\d{2}$/.test(directWishDate) ? directWishDate : null;
    const timer = window.setTimeout(() => {
      setIntakeSuggestionState((current) => current.kind === "data" ? { ...current, loading: true } : { kind: "loading" });
      const timeout = window.setTimeout(() => {
        if (sequence !== intakeSuggestionSeq.current) return;
        setIntakeSuggestionState({ kind: "error" });
      }, 10_000);
      void ports.getIntakeSuggestions({
        customerId: directCustomerMode === "EXISTING" ? directCustomerId || null : null,
        kind: "ORDER",
        wishDate: suggestionWishDate,
        positions,
      }).then((result) => {
        window.clearTimeout(timeout);
        if (sequence !== intakeSuggestionSeq.current) return;
        if (result.code !== "OK") {
          setIntakeSuggestionState({ kind: "error" });
          return;
        }
        setIntakeSuggestionState({ kind: "data", data: result.data, loading: false });
      }).catch(() => {
        window.clearTimeout(timeout);
        if (sequence === intakeSuggestionSeq.current) setIntakeSuggestionState({ kind: "error" });
      });
    }, 250);
    return () => {
      window.clearTimeout(timer);
      intakeSuggestionSeq.current += 1;
    };
  }, [directCustomerId, directCustomerMode, directItems, directReceipt, directWishDate, intakeSuggestionBasisKey, intakeTermChoice, intakeWishDateOrigin, open, ports, step]);

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
      setCustomerClosePrompt(false);
      setOpen(false);
    }
  };

  const requestCustomerClose = () => {
    if (busy) return;
    if (customerChanged) setCustomerClosePrompt(true);
    else closeNow();
  };

  const requestClose = () => {
    closeNow();
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
      setCatalogServices(catalog.services);
      setCustomerChoices(result.customers);
      setCustomerLoad(result.customers.length > 0 ? "ready" : "empty");
    } catch {
      if (seq !== customerRequestSeq.current) return;
      setCustomerLoad("error");
      setFeedback({ kind: "error", message: "Der Kundenstamm konnte nicht sicher gelesen werden. Es wurde nichts angelegt." });
    }
  };

  const loadDirectIntake = async (preselectedCustomerId?: string) => {
    if (!ports.canCreateOrder) {
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
    setIntakeClientKey(globalThis.crypto.randomUUID());
    setIntakePaymentMode("");
    setOpen(true);
    setIntakeStep(1);
    navigate("direct-intake");
    setCustomerLoad("loading");
    const seq = ++customerRequestSeq.current;
    try {
      const [result, catalog] = await Promise.all([
        preselectedCustomerId
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
      setCatalogServices(catalog.services);
      setCustomerChoices(result.customers);
      setCustomerLoad(result.customers.length ? "ready" : "empty");
      const preselected = preselectedCustomerId
        ? result.customers.find((entry) => entry.id === preselectedCustomerId)
        : undefined;
      if (preselected) {
        setDirectCustomerId(preselected.id);
        const draftCustomer = customerChoiceToDraft(preselected);
        setDirectCustomer(draftCustomer);
        setDirectCustomerMode("EXISTING");
        setDirectCustomerType(draftCustomer.customerType === "privat" ? "privat" : "business");
      }
    } catch {
      if (seq === customerRequestSeq.current) setFeedback({ kind: "error", message: "Die vorhandenen Kunden konnten nicht sicher gelesen werden. Es wurde nichts angelegt." });
    }
  };

  const openWithIntent = (request: GlobalCreateIntent | GlobalCreateRequest) => {
    const intent = typeof request === "string" ? request : request.intent;
    const prefill = typeof request === "string" ? undefined : request.prefill;
    reset();
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
    void loadDirectIntake(prefill?.customerId);
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

  const updateDirectItem = (key: string, field: keyof Omit<IntakePositionDraft, "key" | "surfaceTouched">, value: string) => {
    setDirectItems((current) => current.map((item) => item.key === key ? { ...item, [field]: value } : item));
  };

  const setDirectPositionName = (key: string, name: string) => {
    const matches = catalogServices.filter((candidate) => candidate.name.localeCompare(name.trim(), "de-DE", { sensitivity: "base" }) === 0);
    const service = matches.length === 1 ? matches[0] : null;
    setDirectItems((current) => current.map((item) => {
      if (item.key !== key) return item;
      if (!service) return { ...item, catalogServiceId: FREE_TEXT_SERVICE, name, unit: null, unitPriceCents: null, vatRateBasisPoints: null };
      const surfaceRequested = item.surfaceTouched ? item.surfaceRequested : service.surface;
      const catalogMatchesSurface = surfaceRequested === service.surface;
      return {
        ...item,
        catalogServiceId: catalogMatchesSurface ? service.id : FREE_TEXT_SERVICE,
        name: service.name,
        surfaceRequested,
        unit: catalogMatchesSurface ? service.unit : null,
        unitPriceCents: null,
        vatRateBasisPoints: catalogMatchesSurface ? service.vatRateBasisPoints : null,
      };
    }));
  };

  const setDirectPositionSurface = (key: string, surfaceRequested: string) => {
    setDirectItems((current) => current.map((item) => {
      if (item.key !== key) return item;
      const service = catalogServices.find((candidate) => candidate.id === item.catalogServiceId);
      return service?.surface === surfaceRequested
        ? { ...item, surfaceRequested, surfaceTouched: true }
        : { ...item, catalogServiceId: FREE_TEXT_SERVICE, surfaceRequested, surfaceTouched: true, unit: null, unitPriceCents: null, vatRateBasisPoints: null };
    }));
  };

  const adoptIntakeTermSuggestion = () => {
    if (intakeSuggestionState.kind !== "data" || !intakeSuggestionState.data.term || !directWishDate) return;
    const term = intakeSuggestionState.data.term;
    setIntakeTermChoice({ kind: "adopted", basisKey: intakeSuggestionBasisKey, wishDate: directWishDate, achievableDate: term.achievableDate });
    setDirectWishDate(term.achievableDate);
    setDirectConfirmedDate(term.achievableDate);
  };

  const keepIntakeWish = () => {
    if (intakeSuggestionState.kind !== "data" || !intakeSuggestionState.data.term || !directWishDate) return;
    setIntakeTermChoice({
      kind: "kept",
      basisKey: intakeSuggestionBasisKey,
      wishDate: directWishDate,
      achievableDate: intakeSuggestionState.data.term.achievableDate,
    });
  };

  const changeIntakeTermChoice = () => {
    if (intakeTermChoice?.kind === "adopted") {
      setDirectWishDate(intakeTermChoice.wishDate);
      setDirectConfirmedDate(intakeTermChoice.wishDate);
    }
    setIntakeTermChoice(null);
  };

  const recognizeDirectIntakeText = async () => {
    if (!intakeRecognitionText.trim()) return;
    setRecognitionBusy(true);
    setFeedback(null);
    try {
      const result = await ports.recognizeIntakeText(intakeRecognitionText);
      if (result.code !== "OK") {
        setFeedback({ kind: "error", message: "Erkennung nicht möglich · bitte von Hand ausfüllen" });
        return;
      }
      const values = Object.fromEntries(result.data.fields.map((field) => [field.field, field.value]));
      if (values.dueDate && !directWishDate) {
        setDirectWishDate(values.dueDate);
        setDirectConfirmedDate(values.dueDate);
        setIntakeWishDateOrigin("recognized");
      }
      if (result.data.positions.length > 0) {
        const recognized = result.data.positions.map((position) => ({
          ...newIntakePosition(),
          catalogServiceId: FREE_TEXT_SERVICE,
          name: position.name,
          quantity: position.quantity,
          surfaceRequested: position.surfaceRequested,
          surfaceTouched: false,
          executionRequested: position.executionRequested,
          unit: position.unit,
        }));
        setDirectItems((current) => {
          const existing = current.length === 1 && !current[0]?.name.trim() ? [] : current;
          return [...existing, ...recognized].slice(0, 20);
        });
      }
      const labels: Record<string, string> = { companyName: "Name / Firma", email: "E-Mail", phone: "Telefon", zipCode: "PLZ", city: "Ort", dueDate: "Liefertermin" };
      setRecognitionMarkers([
        ...result.data.fields.map((field) => ({ key: field.field, label: labels[field.field] ?? field.field, value: field.value, source: field.source })),
        ...result.data.positions.flatMap((position, index) => [
          { key: `position-${index}-name`, label: `Position ${index + 1}`, value: position.name, source: position.source },
          { key: `position-${index}-quantity`, label: "Menge", value: `${position.quantity} ${position.unit}`, source: position.source },
          { key: `position-${index}-surface`, label: "Oberfläche", value: position.surfaceRequested, source: position.source },
        ]),
      ]);
      setLastRecognizedText(intakeRecognitionText);
      setRecognitionConfirmed(false);
      setIntakeSuggestionState({ kind: "idle" });
      setIntakeTermChoice(null);
    } catch {
      setFeedback({ kind: "error", message: "Erkennung nicht möglich · bitte von Hand ausfüllen" });
    } finally {
      setRecognitionBusy(false);
    }
  };

  const intakePositionComplete = (item: IntakePositionDraft) =>
    (item.catalogServiceId === FREE_TEXT_SERVICE || item.catalogServiceId.length > 0)
    && item.name.trim().length >= 2
    && item.surfaceRequested.trim().length >= 2
    && Number.isSafeInteger(Number(item.quantity))
    && Number(item.quantity) > 0;

  const customerIssue = (() => {
    if (directCustomerMode === "NONE") return { detail: "fehlt", target: "eingang.kunde" };
    if (directCustomer.name.trim().length < 2) return { detail: "Name / Firma fehlt", target: "kundeneu.name" };
    if (!directCustomer.contactPerson?.trim()) return { detail: "Ansprechpartner fehlt", target: "kundeneu.ansprechpartner" };
    if (!validPhone(directCustomer.phone)) return { detail: "Telefon fehlt oder ungültig", target: "kundeneu.telefon" };
    if (!directCustomer.email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(directCustomer.email)) return { detail: "E-Mail fehlt oder ungültig", target: "kundeneu.email" };
    if (directCustomer.street.trim().length < 2) return { detail: "Straße fehlt", target: "kundeneu.strasse" };
    if (!directCustomer.zipCode.trim() || !validPostcode(directCustomer.country, directCustomer.zipCode)) return { detail: "PLZ fehlt oder ungültig", target: "kundeneu.plz" };
    if (!directCustomer.city.trim()) return { detail: "Ort fehlt", target: "kundeneu.ort" };
    if (!directCustomer.country.trim()) return { detail: "Land fehlt", target: "kundeneu.land" };
    if (ports.canManageMoney && !directCustomer.paymentPreference.trim()) return { detail: "Zahlungsbedingung fehlt", target: "kundeneu.zahlungsbedingung" };
    return null;
  })();
  const firstMissingName = directItems.findIndex((item) => item.name.trim().length < 2 || (!item.catalogServiceId && item.name.trim().length >= 2));
  const firstMissingQuantity = directItems.findIndex((item) => !Number.isSafeInteger(Number(item.quantity)) || Number(item.quantity) <= 0);
  const firstMissingSurface = directItems.findIndex((item) => item.surfaceRequested.trim().length < 2);
  const intakeChecklist: IntakeChecklistEntry[] = [
    { id: "kunde", label: "Kunde", detail: customerIssue?.detail ?? "vollständig", complete: customerIssue === null, step: 1, target: customerIssue?.target ?? "eingang.kunde" },
    { id: "bezeichnung", label: "Teil / Leistung", detail: firstMissingName >= 0 ? `Position ${firstMissingName + 1} fehlt` : `${directItems.length} Position${directItems.length === 1 ? "" : "en"}`, complete: firstMissingName < 0, step: 2, target: `eingang.position.${Math.max(firstMissingName, 0)}.bezeichnung` },
    { id: "menge", label: "Menge", detail: firstMissingQuantity >= 0 ? `Position ${firstMissingQuantity + 1} fehlt` : "vollständig", complete: firstMissingQuantity < 0, step: 2, target: `eingang.position.${Math.max(firstMissingQuantity, 0)}.menge` },
    { id: "oberflaeche", label: "Oberfläche", detail: firstMissingSurface >= 0 ? `Position ${firstMissingSurface + 1} fehlt` : "vollständig", complete: firstMissingSurface < 0, step: 2, target: `eingang.position.${Math.max(firstMissingSurface, 0)}.oberflaeche` },
    { id: "liefertermin", label: "Liefertermin", detail: directWishDate || "fehlt", complete: Boolean(directWishDate), step: 3, target: "eingang.liefertermin" },
    { id: "uebergabe", label: "Übergabe", detail: intakeHandover === "PICKUP" ? "Abholung" : intakeHandover === "SHIPPING" ? "Versand" : "fehlt", complete: Boolean(intakeHandover), step: 3, target: "eingang.uebergabe" },
    ...(ports.canManageMoney ? [{ id: "zahlungsmodus", label: "Zahlungsmodus", detail: intakePaymentMode === "abholung" ? "Bar oder Karte bei Abholung" : intakePaymentMode === "rechnung" ? "Rechnung auf Ziel" : intakePaymentMode === "vorkasse" ? "Vorkasse" : "fehlt", complete: Boolean(intakePaymentMode), step: 3 as const, target: "eingang.zahlungsmodus" }] : []),
  ];
  const requiredIntakeChecks = intakeChecklist.filter((entry) => !entry.warning);
  const completedIntakeChecks = requiredIntakeChecks.filter((entry) => entry.complete).length;
  const directCustomerInvalidFields: readonly (keyof CustomerDraft)[] = [
    ...(!validPhone(directCustomer.phone) && directCustomer.phone?.trim() ? ["phone" as const] : []),
    ...(Boolean(directCustomer.email?.trim()) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(directCustomer.email ?? "") ? ["email" as const] : []),
    ...(!validPostcode(directCustomer.country, directCustomer.zipCode) && directCustomer.zipCode.trim() ? ["zipCode" as const, "country" as const] : []),
  ];

  const jumpToIntakeCheck = (entry: IntakeChecklistEntry) => {
    setIntakeStep(entry.step);
    const focusTarget = () => {
      const root = document.querySelector<HTMLElement>(`[data-spec-id="${entry.target}"]`);
      if (!root) return;
      const target = root.matches("input, select, textarea, button, [tabindex]")
        ? root
        : root.querySelector<HTMLElement>("input, select, textarea, button, [tabindex]");
      root.scrollIntoView?.({ behavior: "smooth", block: "center" });
      target?.focus();
    };
    requestAnimationFrame(() => requestAnimationFrame(focusTarget));
  };

  const selectIntakeCustomer = (mode: "NONE" | "EXISTING", selected?: GlobalCreateCustomerChoice) => {
    setFeedback(null);
    setIntakeHandover("");
    setIntakePaymentMode("");
    if (mode === "NONE") {
      setDirectCustomerMode("NONE");
      setDirectCustomerType("");
      setDirectCustomerId("");
      setDirectCustomer(EMPTY_INTAKE_CUSTOMER);
      setIntakeCustomerResults([]);
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
  };

  const changeIntakeHandover = (value: "PICKUP" | "SHIPPING") => {
    setIntakeHandover(value);
    if (value === "SHIPPING" && intakePaymentMode === "abholung") {
      setIntakePaymentMode("");
    }
  };

  const changeIntakeCustomerPayment = (paymentPreference: string) => {
    setDirectCustomer((current) => ({ ...current, paymentPreference }));
  };

  const advanceIntakeCustomer = async (): Promise<string | null> => {
    if (directCustomerMode === "NONE") {
      setFeedback({ kind: "validation", message: "Bitte einen bestehenden Kunden auswählen." });
      return null;
    }
    if (!completeOrderCustomer(directCustomer, ports.canManageMoney)) {
      setFeedback({ kind: "validation", message: "Für den Auftrag fehlen Name/Firma, Ansprechpartner, Telefon, E-Mail, vollständige Anschrift oder Zahlungsbedingung." });
      return null;
    }
    setBusy(true);
    setFeedback(null);
    try {
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

  const submitDirectIntake = async (event: FormEvent, customerKey = directCustomerId) => {
    event.preventDefault();
    if (!ports.canCreateOrder) {
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
    const validCustomer = directCustomerMode === "EXISTING" && customerKey.length > 0
      && completeOrderCustomer(directCustomer, ports.canManageMoney);
    if (!validCustomer || !validDates || !intakeHandover || (ports.canManageMoney && !intakePaymentMode)
      || items.length < 1 || items.length > 20 || !directItems.every(intakePositionComplete)) {
      setFeedback({ kind: "validation", message: "Bitte Kunde, Position, Termin, Übergabe und Zahlungsmodus vollständig angeben." });
      return;
    }
    const id = intakeClientKey;
    setBusy(true);
    setFeedback(null);
    const input: DirectIntakeInput = {
      clientEventId: id,
      customer: { mode: "EXISTING", customerId: customerKey },
      // The existing F1.1 contract persists the confirmed commitment, never the non-binding wish.
      dueDate: directConfirmedDate,
      termStatus: intakeTermStatus === "confirmed" ? "bestaetigt" : "wunsch",
      intakeSource: "persoenlich",
      handoverMode: intakeHandover === "PICKUP" ? "pickup" : "shipping",
      ...(ports.canManageMoney && intakePaymentMode ? { paymentMode: intakePaymentMode } : {}),
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
      if (readback.code !== "OK" || readback.receipt.orderId !== created.receipt.orderId
        || readback.receipt.dueDate !== directConfirmedDate
        || readback.receipt.termStatus !== input.termStatus
        || readback.receipt.intakeSource !== input.intakeSource) {
        setFeedback({ kind: "error", message: "Der neue Eingang konnte nicht sicher erneut gelesen werden. Die Anfragekennung bleibt für den Support verfügbar.", requestId: id });
        return;
      }
      setDirectReceipt(readback);
      ports.refresh();
    } catch {
      setFeedback({ kind: "unclear", message: "Der Ausgang ist ungeklärt. Es wurde keine zweite Anlage ausgelöst.", requestId: id });
    } finally {
      setBusy(false);
    }
  };

  const submitIntakePage = async (event: FormEvent) => {
    event.preventDefault();
    const firstOpen = requiredIntakeChecks.find((entry) => !entry.complete);
    if (firstOpen) {
      setFeedback({ kind: "validation", message: `Noch offen: ${firstOpen.label}` });
      jumpToIntakeCheck(firstOpen);
      return;
    }
    const customerId = await advanceIntakeCustomer();
    if (!customerId) return;
    await submitDirectIntake(event, customerId);
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

  function reset() {
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
    setIntakeClientKey(globalThis.crypto.randomUUID());
    setDirectCustomer(EMPTY_INTAKE_CUSTOMER);
    setDirectCustomerType("");
    setDirectCustomerId("");
    setDirectCustomerMode("NONE");
    setIntakeCustomerQuery("");
    setIntakeCustomerResults([]);
    setIntakeCustomerSearchState("idle");
    setIntakePaymentMode("");
    setDirectItems([newIntakePosition()]);
    setDirectWishDate("");
    setIntakeWishDateOrigin("empty");
    setDirectConfirmedDate("");
    setDirectNote("");
    setIntakeHandover("");
    setIntakeTermStatus("wish");
    setIntakeSuggestionState({ kind: "idle" });
    setIntakeTermChoice(null);
    requestIds.current = { customer: "", quote: "", conversion: "", directCustomer: "" };
    setIntakeStep(1);
  }

  return (
    <>
      {ports.showPrimaryTrigger !== false ? <button type="button" className={styles.globalCreateButton} onClick={() => { reset(); void loadDirectIntake(); }} aria-label="Neu erfassen" aria-haspopup="dialog" aria-expanded={open}>
        <span className={styles.globalCreatePlus} aria-hidden="true">＋</span><span>Neu erfassen</span>
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
          key="intake"
          titel="Neu erfassen"
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
              {intakeStep === 3 ? <KrButton data-spec-id="eingang.buchen" form="kr-neuer-eingang" type="submit" art="erledigen" icon="check" text="Wareneingang buchen" disabled={busy} /> : null}
            </>
          ) : (
            <><KrButton data-spec-id="eingang.abbrechen" text="Abbrechen" onClick={requestClose} /><KrButton data-spec-id="eingang.buchen" form="kr-neuer-eingang" type="submit" art="erledigen" icon="check" text="Wareneingang buchen" disabled={busy} /></>
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
            <form id="kr-neuer-eingang" className={`kr-stapel ${styles.intakeWorkspace}`} noValidate onSubmit={(event) => void submitIntakePage(event)}>
              {ports.resumeQuoteId ? <Hinweis><KrButton art="sekundaer" icon="arrow" text="Gespeicherten KV fortsetzen" disabled={busy} onClick={() => void resumeQuote()} /></Hinweis> : null}
              <section className={styles.createQuickCapture} aria-labelledby="quick-capture-title">
                <div><h3 id="quick-capture-title">Schnell erfassen</h3><p>Paket oder persönliche Übergabe als Text erfassen</p></div>
                <Textfeld data-spec-id="eingang.erfassen-text" aria-label="Schnell erfassen" rows={3} maxLength={6000} value={intakeRecognitionText} onChange={(event) => { setIntakeRecognitionText(event.target.value); setRecognitionConfirmed(false); }} placeholder="z. B. 2 Stück Flansch verzinken, bis 12.11." />
                <div className={styles.createInlineChoices}>
                  {(!lastRecognizedText || intakeRecognitionText !== lastRecognizedText) ? <KrButton data-spec-id="eingang.erkennen" art="sekundaer" text={recognitionBusy ? "Angaben werden erkannt …" : "Angaben erkennen"} disabled={recognitionBusy || !intakeRecognitionText.trim()} onClick={() => void recognizeDirectIntakeText()} /> : null}
                </div>
                <div className={styles.createPhotoConnector} aria-label="Fotos mit Tablet/Handy" aria-disabled="true">
                  <Camera aria-hidden="true" />
                  <span><strong>Fotos mit Tablet/Handy</strong><small>Fotoerfassung ist in diesem Paket noch nicht aktiv.</small></span>
                </div>
                {recognitionBusy ? <Hinweis>Angaben werden erkannt … Das Formular bleibt bedienbar.</Hinweis> : null}
                {recognitionMarkers.length > 0 ? <div className={styles.createRecognition} aria-live="polite">
                  <strong>{recognitionConfirmed ? `${recognitionMarkers.length} Angaben bestätigt` : `${recognitionMarkers.length} Angaben erkannt und vorausgefüllt`}</strong>
                  <div>{recognitionMarkers.map((marker) => <Chip key={marker.key} text={`${marker.label}: ${marker.value} · ${recognitionConfirmed ? "bestätigt" : `erkannt · ${marker.source}`}`} ton={recognitionConfirmed ? "ok" : "info"} />)}</div>
                  {!recognitionConfirmed ? <KrButton data-spec-id="eingang.alles-bestaetigen" art="sekundaer" text="Alles bestätigen" onClick={() => setRecognitionConfirmed(true)} /> : null}
                </div> : null}
              </section>
              <datalist id="kr-service-catalog">{catalogServices.map((service) => <option key={service.id} value={service.name}>{service.surface}</option>)}</datalist>
              {isHandy ? <SchrittNav schritte={["Kunde", "Positionen", "Prüfung"]} aktuell={intakeStep - 1} erreicht={intakeStep - 1} onSchritt={(index) => setIntakeStep((index + 1) as 1 | 2 | 3)} /> : <AbschnittNav abschnitte={["Kunde", "Positionen", "Prüfung"]} aktuell={intakeStep - 1} onAbschnitt={(index) => {
                setIntakeStep((index + 1) as 1 | 2 | 3);
                document.querySelector(`[data-abschnitt="${index}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
              }} />}

              {(!isHandy || intakeStep === 1) ? <Abschnitt nr={0} label="Kunde">
                <FormRaster>
                  <Feld label="Anliegen" voll><Fakten zeilen={[{ k: "Art", v: "Auftrag" }]} /></Feld>
                  <Feld label={directCustomerMode === "NONE" ? "Kunde suchen" : "Kunde"} voll>
                    {directCustomerMode === "NONE" ? <div className="kr-stapel">
                      <Eingabe
                        data-spec-id="eingang.kunde"
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
                    </div> : <div className="kr-stapel">
                      <Fakten zeilen={[{ k: "Name / Firma", v: directCustomer.companyName ?? directCustomer.name }, { k: "Kundennummer", v: customerChoices.find((entry) => entry.id === directCustomerId)?.customerNumber ?? "fehlt" }]} />
                      <KrButton art="sekundaer" text="Anderer Kunde" onClick={() => selectIntakeCustomer("NONE")} />
                    </div>}
                  </Feld>
                </FormRaster>
                {directCustomerMode === "EXISTING" && !completeOrderCustomer(directCustomer, ports.canManageMoney) ? <>
                  <Hinweis ton="warn">Für diesen Kunden fehlen noch Pflichtdaten.</Hinweis>
                  <CustomerFormFields value={directCustomer} onChange={setDirectCustomer} customerType={directCustomerType} onCustomerType={changeDirectCustomerType} onlyMissing showPayment={ports.canManageMoney} onPaymentChange={changeIntakeCustomerPayment} forceFields={directCustomerInvalidFields} />
                </> : null}
                {intakeTermChoice ? <div className={styles.intakeSuggestion} data-spec-id="eingang.terminvorschlag">
                  <div><strong>Liefertermin {intakeTermChoice.kind === "adopted" ? intakeTermChoice.achievableDate : intakeTermChoice.wishDate}</strong><span>{intakeTermChoice.kind === "adopted" ? "Vorschlag übernommen" : "Wunsch gehalten, Kunde wird vorgewarnt"}</span></div>
                  <KrButton art="sekundaer" text="Ändern" onClick={changeIntakeTermChoice} />
                </div> : intakeSuggestionState.kind === "loading" ? <div className={styles.intakeSuggestion} data-spec-id="eingang.terminvorschlag"><span>Terminvorschlag wird berechnet …</span></div>
                  : intakeSuggestionState.kind === "error" ? <div className={styles.intakeSuggestion} data-spec-id="eingang.terminvorschlag"><span>Terminvorschlag nicht verfügbar</span></div>
                    : intakeSuggestionState.kind === "data" && intakeSuggestionState.data.term?.wishDate ? <div className={styles.intakeSuggestion} data-spec-id="eingang.terminvorschlag">
                      {intakeSuggestionState.data.term.rating === "passt" ? <div><strong>Wunsch {intakeSuggestionState.data.term.wishDate} machbar</strong>{intakeSuggestionState.loading ? <span>wird berechnet …</span> : null}</div> : <>
                        <div className={styles.intakeSuggestionHead}>
                          <strong>Terminvorschlag</strong>
                          <Chip text={intakeSuggestionState.data.term.rating === "knapp" ? "knapp" : "nicht machbar"} ton={intakeSuggestionState.data.term.rating === "knapp" ? "warn" : "rot"} />
                          {intakeSuggestionState.loading ? <span>wird berechnet …</span> : null}
                        </div>
                        <p>Wunsch {intakeSuggestionState.data.term.wishDate} → Machbar {intakeSuggestionState.data.term.achievableDate}</p>
                        <ul>{intakeSuggestionState.data.term.reasons.map((reason) => <li key={reason.kind}>{reason.text}</li>)}</ul>
                        <div className={styles.intakeSuggestionActions}>
                          <KrButton art="primaer" text={`${intakeSuggestionState.data.term.achievableDate} übernehmen`} onClick={adoptIntakeTermSuggestion} />
                          <KrButton art="sekundaer" text="Wunsch halten · Kunde vorwarnen" onClick={keepIntakeWish} />
                        </div>
                      </>}
                    </div> : null}
                <FormRaster>
                  <Feld label="Liefertermin"><Eingabe data-spec-id="eingang.liefertermin" type="date" required value={directWishDate} onChange={(event) => { setDirectWishDate(event.target.value); setDirectConfirmedDate(event.target.value); setIntakeWishDateOrigin(event.target.value ? "manual" : "empty"); }} /></Feld>
                  <Feld label="Termin ist"><div data-spec-id="eingang.terminstatus"><Segment label="Termin ist" wert={intakeTermStatus} optionen={[{ wert: "wish", text: "Wunsch" }, { wert: "confirmed", text: "bestätigt" }]} onWert={setIntakeTermStatus} /></div></Feld>
                  <Feld label="Übergabe"><div data-spec-id="eingang.uebergabe"><Segment<"" | "PICKUP" | "SHIPPING"> label="Übergabe" wert={intakeHandover} optionen={[{ wert: "PICKUP", text: "Abholung" }, { wert: "SHIPPING", text: "Versand" }]} onWert={(value) => { if (value) changeIntakeHandover(value); }} /></div></Feld>
                  {ports.canManageMoney ? <Feld label="Zahlungsmodus">
                    <Auswahl required data-spec-id="eingang.zahlungsmodus" value={intakePaymentMode} onChange={(event) => setIntakePaymentMode(event.target.value as PaymentMode | "")} optionen={[
                      { wert: "", text: "Bitte wählen" },
                      { wert: "vorkasse", text: "Vorkasse" },
                      { wert: "abholung", text: intakeHandover === "PICKUP" ? "Bar oder Karte bei Abholung" : "Bar oder Karte bei Abholung (nur bei Abholung)", gesperrt: intakeHandover === "SHIPPING" },
                      { wert: "rechnung", text: directCustomerMode === "EXISTING" && /^rechnung_/.test(directCustomer.paymentPreference) ? "Rechnung auf Ziel" : "Rechnung auf Ziel (nicht freigeschaltet)", gesperrt: !(directCustomerMode === "EXISTING" && /^rechnung_/.test(directCustomer.paymentPreference)) },
                    ]} />
                  </Feld> : null}
                </FormRaster>
              </Abschnitt> : null}

              {(!isHandy || intakeStep === 2) ? <Abschnitt nr={1} label="Positionen">
                <div className="kr-stapel">
                  {directItems.map((item, index) => <div className="kr-position" key={item.key}>
                    <span className="kr-position-nr">{index + 1}</span>
                    <Feld label="Teil / Bezeichnung"><Eingabe data-spec-id={`eingang.position.${index}.bezeichnung`} required minLength={2} list="kr-service-catalog" placeholder="Katalog oder Freitext" value={item.name} onChange={(event) => setDirectPositionName(item.key, event.target.value)} /></Feld>
                    <Feld label="Menge"><Eingabe data-spec-id={`eingang.position.${index}.menge`} type="number" min="1" value={item.quantity} onChange={(event) => updateDirectItem(item.key, "quantity", event.target.value)} /></Feld>
                    <Feld label="Oberfläche" className="kr-pos-oberflaeche"><Auswahl data-spec-id={`eingang.position.${index}.oberflaeche`} required value={item.surfaceRequested} onChange={(event) => setDirectPositionSurface(item.key, event.target.value)} optionen={[{ wert: "", text: "Bitte wählen" }, ...surfaceOptions.map((surface) => ({ wert: surface, text: surface }))]} /></Feld>
                    <Feld label="Ausführung"><Auswahl data-spec-id="eingang.position.ausfuehrung" value={item.executionRequested} onChange={(event) => updateDirectItem(item.key, "executionRequested", event.target.value)} optionen={EXECUTION_OPTIONS} /></Feld>
                    <Feld label="Material"><Eingabe data-spec-id="eingang.position.material" maxLength={120} value={item.material} onChange={(event) => updateDirectItem(item.key, "material", event.target.value)} /></Feld>
                    <KrButton art="sekundaer" icon="x" label="Position entfernen" disabled={directItems.length === 1} onClick={() => setDirectItems((current) => current.filter((entry) => entry.key !== item.key))} />
                  </div>)}
                </div>
                <KrButton art="sekundaer" icon="plus" text="Position hinzufügen" disabled={directItems.length >= 20} onClick={() => setDirectItems((current) => [...current, newIntakePosition()])} />
              </Abschnitt> : null}

              {(!isHandy || intakeStep === 3) ? <Abschnitt nr={2} label="Prüfung">
                <Feld label="Hinweis / Belege" voll><Textfeld rows={3} value={directNote} onChange={(event) => setDirectNote(event.target.value)} /></Feld>
                <FormRaster>
                  <Fakten zeilen={[
                    { k: "Art", v: "Auftrag" },
                    { k: "Kunde", v: directCustomerMode === "NONE" ? "fehlt" : directCustomer.name || "fehlt" },
                    { k: "Positionen", v: String(directItems.length) },
                    { k: "Wunschtermin", v: directWishDate || "fehlt" },
                    { k: "Übergabe", v: intakeHandover === "PICKUP" ? "Abholung" : intakeHandover === "SHIPPING" ? "Versand" : "fehlt" },
                    ...(ports.canManageMoney ? [{ k: "Zahlungsart", v: intakePaymentMode === "abholung" ? "Bar oder Karte bei Abholung" : intakePaymentMode === "rechnung" ? "Rechnung auf Ziel" : intakePaymentMode === "vorkasse" ? "Vorkasse" : "fehlt" }] : []),
                  ]} />
                </FormRaster>
              </Abschnitt> : null}

              {(!isHandy || intakeStep === 3) ? <aside className={styles.intakeChecklist} aria-label="Prüfliste" data-spec-id="eingang.pruefliste">
                <div className={styles.intakeChecklistHead}>
                  <div><span>Prüfen</span><strong>{completedIntakeChecks} von {requiredIntakeChecks.length} Pflichtangaben</strong></div>
                  <progress value={completedIntakeChecks} max={requiredIntakeChecks.length}>{completedIntakeChecks} von {requiredIntakeChecks.length}</progress>
                </div>
                <div className={styles.intakeChecklistGroup}>
                  <h3>Pflicht</h3>
                  {requiredIntakeChecks.map((entry) => <button type="button" key={entry.id} data-state={entry.complete ? "ok" : "open"} onClick={() => jumpToIntakeCheck(entry)}>
                    <span className={styles.intakeChecklistIcon}>{entry.complete ? <Check aria-hidden="true" /> : "!"}</span>
                    <span><strong>{entry.label}</strong><small>{entry.detail}</small></span>
                    <em>{entry.complete ? "ok" : "fehlt"}</em>
                  </button>)}
                </div>
                {intakeChecklist.some((entry) => entry.warning) ? <div className={styles.intakeChecklistGroup}>
                  <h3>Hinweis</h3>
                  {intakeChecklist.filter((entry) => entry.warning).map((entry) => <button type="button" key={entry.id} data-state="warning" onClick={() => jumpToIntakeCheck(entry)}>
                    <span className={styles.intakeChecklistIcon}>!</span>
                    <span><strong>{entry.label}</strong><small>{entry.detail}</small></span>
                    <em>Hinweis</em>
                  </button>)}
                </div> : null}
              </aside> : null}

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
                <h2 id="global-create-title">{step === "choose" ? "Was möchtest du anlegen?" : step === "customer" ? "Neukunde erfassen" : step === "customer-saved" ? "Kunde gesichert" : step === "customer-picker" ? "Kunde für KV wählen" : step === "quote-list" ? "Offene KVs" : step === "quote" ? quote ? "KV bearbeiten" : "Kostenvoranschlag anlegen" : step === "quote-saved" ? "KV gesichert" : step === "order-saved" ? "Auftrag angelegt" : step === "direct-intake" ? "Neu erfassen" : "Berechtigung klären"}</h2>
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
    </>
  );
}
