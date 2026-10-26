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
import { FormEvent, KeyboardEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CreateCustomerInput, UpdateCustomerCommercialInput } from "@/modules/customers/public";
import type { CatalogService } from "@/modules/katalog/public";
import type {
  ConvertQuoteInput,
  CreateQuoteInput,
  QuoteConversionReceipt,
  QuoteCreateReceipt,
  QuoteReadback,
  QuoteUpdateReceipt,
  UpdateQuoteInput,
} from "@/modules/quotes/public";
import styles from "./TargetShell.module.css";

export type GlobalCreateIntent = "CUSTOMER" | "QUOTE" | "DIRECT_INTAKE";
export type GlobalCreateRequest = {
  intent: GlobalCreateIntent;
  prefill?: {
    name?: string;
    email?: string;
    customerQuery?: string;
    note?: string;
    dueDate?: string;
    quotePositions?: Array<{ quantity?: string; material?: string }>;
  };
};
export const GLOBAL_CREATE_OPEN_EVENT = "path1:global-create-open";

export function requestGlobalCreate(request: GlobalCreateIntent | GlobalCreateRequest): void {
  window.dispatchEvent(new CustomEvent<GlobalCreateIntent | GlobalCreateRequest>(GLOBAL_CREATE_OPEN_EVENT, { detail: request }));
}

type FailureCode =
  | "FORBIDDEN"
  | "UNAUTHENTICATED"
  | "NOT_FOUND"
  | "CONFLICT"
  | "VALIDATION_ERROR"
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
  customer: { mode: "EXISTING"; customerId: string };
  dueDate: string;
  note: string | null;
  items: Array<{ catalogServiceId:string; name:string; quantity:number; material:string|null; surfaceRequested:string; unit:string; unitPriceCents:number; vatRateBasisPoints:0|700|1900 }>;
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
        recordedAt: string;
      };
      replayed: boolean;
    }
  | Failure;

export type GlobalCreatePorts = {
  canCreateCustomer: boolean;
  canCreateQuote: boolean;
  showPrimaryTrigger?: boolean;
  roleLabel: string;
  resumeQuoteId: string | null;
  listCustomers: () => Promise<
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
  rememberQuote: (quoteId: string | null) => void;
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
type CustomerDraft = Omit<CreateCustomerInput, "clientEventId"|"street"|"zipCode"|"city"|"country"|"paymentPreference"|"vatId"> & {street:string;zipCode:string;city:string;country:string;paymentPreference:string;vatId:string|null};
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
type IntakePositionDraft = { key:string; catalogServiceId:string; name:string; quantity:string; material:string; surfaceRequested:string; unit:string; unitPriceCents:number; vatRateBasisPoints:0|700|1900 };

function CustomerFields({ value, onChange, autofocus = false, requireOrderData = true }: { value: CustomerDraft; onChange: (value: CustomerDraft) => void; autofocus?: boolean; requireOrderData?: boolean }) {
  const set = <K extends keyof CustomerDraft>(key: K, next: CustomerDraft[K]) => onChange({ ...value, [key]: next });
  return <div className={styles.createFormGrid}>
    <label className={styles.createFieldWide}>Firma / Name<input data-autofocus={autofocus || undefined} required minLength={2} value={value.name} onChange={(event) => set("name", event.target.value)} /></label>
    <label>Kundentyp<select value={value.customerType} onChange={(event) => set("customerType", event.target.value as CustomerDraft["customerType"])}><option value="business">Firma</option><option value="privat">Privat</option><option value="institution">Institution</option></select></label>
    <label>Firmenname<input value={value.companyName ?? ""} onChange={(event) => set("companyName", nullable(event.target.value))} /></label>
    <label>Ansprechpartner<input required={requireOrderData} value={value.contactPerson ?? ""} onChange={(event) => set("contactPerson", nullable(event.target.value))} /></label>
    <label>Telefon<input required value={value.phone ?? ""} onChange={(event) => set("phone", nullable(event.target.value))} /></label>
    <label>E-Mail<input required={requireOrderData} type="email" value={value.email ?? ""} onChange={(event) => set("email", nullable(event.target.value))} /></label>
    <label>Straße<input required={requireOrderData} value={value.street} onChange={(event) => set("street", event.target.value)} /></label>
    <label>PLZ<input required={requireOrderData} value={value.zipCode} onChange={(event) => set("zipCode", event.target.value)} /></label>
    <label>Ort<input required={requireOrderData} value={value.city} onChange={(event) => set("city", event.target.value)} /></label>
    <label>Land<input required={requireOrderData} value={value.country} onChange={(event) => set("country", event.target.value)} /></label>
    <label>Zahlung<select value={value.paymentPreference} onChange={(event) => set("paymentPreference", event.target.value)}><option value="rechnung_14">Rechnung 14 Tage</option><option value="rechnung_30">Rechnung 30 Tage</option><option value="vorkasse">Vorkasse</option><option value="bar">Bar</option></select></label>
    <label>USt-ID<input value={value.vatId ?? ""} onChange={(event) => set("vatId", nullable(event.target.value))} /></label>
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
  paymentPreference: "rechnung_14",
  vatId: null,
};

function customerChoiceToDraft(customer: GlobalCreateCustomerChoice): CustomerDraft {
  return {
    name: customer.name,
    customerType: customer.customerType ?? "business",
    companyName: customer.companyName ?? null,
    contactPerson: customer.contactPerson ?? null,
    email: customer.email ?? null,
    phone: customer.phone ?? null,
    street: customer.street ?? "",
    zipCode: customer.zipCode ?? "",
    city: customer.city ?? "",
    country: customer.country ?? "Deutschland",
    paymentPreference: customer.paymentPreference ?? "rechnung_14",
    vatId: customer.vatId ?? null,
  };
}

function completeOrderCustomer(customer: CustomerDraft): boolean {
  return customer.name.trim().length >= 2 && Boolean(customer.contactPerson?.trim()) &&
    Boolean(customer.phone?.trim()) && Boolean(customer.email?.trim()) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email ?? "") &&
    customer.street.trim().length >= 2 && customer.zipCode.trim().length >= 2 && customer.city.trim().length >= 1 &&
    customer.country.trim().length >= 2 && customer.paymentPreference.trim().length > 0;
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
  catalogServiceId: "",
  unit: "",
  unitPriceCents: 0,
  vatRateBasisPoints: 1900,
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
  const [customer, setCustomer] = useState<GlobalCreateCustomerChoice | null>(null);
  const [customerReceipt, setCustomerReceipt] = useState<Extract<GlobalCreateCustomerResult, { code: "OK" }>["receipt"] | null>(null);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerChoices, setCustomerChoices] = useState<GlobalCreateCustomerChoice[]>([]);
  const [customerLoad, setCustomerLoad] = useState<"idle" | "loading" | "ready" | "empty" | "error">("idle");
  const [positions, setPositions] = useState<PositionDraft[]>(() => [newPosition()]);
  const [dueDate, setDueDate] = useState("");
  const [quoteNote, setQuoteNote] = useState("");
  const [confirmedOrderDueDate, setConfirmedOrderDueDate] = useState("");
  const [directCustomerMode, setDirectCustomerMode] = useState<"EXISTING" | "NEW">("NEW");
  const [intakeStep, setIntakeStep] = useState<1 | 2 | 3>(1);
  const [directCustomer, setDirectCustomer] = useState<CustomerDraft>(EMPTY_CUSTOMER);
  const [directCustomerId, setDirectCustomerId] = useState("");
  const [directItems, setDirectItems] = useState<IntakePositionDraft[]>(() => [newIntakePosition()]);
  const [catalogServices, setCatalogServices] = useState<CatalogService[]>([]);
  const [directWishDate, setDirectWishDate] = useState("");
  const [directConfirmedDate, setDirectConfirmedDate] = useState("");
  const [directNote, setDirectNote] = useState("");
  const [directReceipt, setDirectReceipt] = useState<Extract<GlobalCreateDirectIntakeResult, { code: "OK" }> | null>(null);
  const [quote, setQuote] = useState<QuoteReadback | null>(null);
  const [quoteReceipt, setQuoteReceipt] = useState<(QuoteCreateReceipt | QuoteUpdateReceipt) | null>(null);
  const [openQuotesState, setOpenQuotesState] = useState<OpenQuotesState>({ kind: "idle" });
  const [conversion, setConversion] = useState<Extract<GlobalCreateConversionResult, { code: "OK" }> | null>(null);
  const requestIds = useRef({ customer: "", quote: "", conversion: "", directCustomer: "" });
  const customerRequestSeq = useRef(0);
  const dialogRef = useRef<HTMLElement>(null);
  const confirmedOrderDueDateValid = isValidDateInput(confirmedOrderDueDate);
  const customerCompleteForOrder = completeOrderCustomer(customerDraft);

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

  useLayoutEffect(() => {
    if (!open) return;
    const target = dialogRef.current?.querySelector<HTMLElement>("[data-autofocus]")
      ?? dialogRef.current?.querySelector<HTMLElement>("input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])");
    target?.focus();
  }, [directCustomerMode, open, step]);

  const close = () => {
    if (!busy) setOpen(false);
  };

  const handleDialogKey = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
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

  const loadDirectIntake = async () => {
    if (!ports.canCreateQuote) {
      deny("quote");
      return;
    }
    setOpen(true);
    setIntakeStep(1);
    navigate("direct-intake");
    setCustomerLoad("loading");
    const seq = ++customerRequestSeq.current;
    try {
      const [result, catalog] = await Promise.all([
        ports.listCustomers(),
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
      setDirectCustomerMode("NEW");
      setDirectCustomerId("");
      setDirectCustomer(EMPTY_CUSTOMER);
      setCustomerLoad(result.customers.length ? "ready" : "empty");
    } catch {
      if (seq === customerRequestSeq.current) setFeedback({ kind: "error", message: "Die vorhandenen Kunden konnten nicht sicher gelesen werden. Es wurde nichts angelegt." });
    }
  };

  const openWithIntent = (request: GlobalCreateIntent | GlobalCreateRequest) => {
    const intent = typeof request === "string" ? request : request.intent;
    const prefill = typeof request === "string" ? undefined : request.prefill;
    setOpen(true);
    if (intent === "CUSTOMER") {
      if (prefill) setCustomerDraft({ ...EMPTY_CUSTOMER, name: prefill.name?.trim() ?? "", email: prefill.email?.trim().toLowerCase() ?? null });
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
    if (!ports.canCreateQuote) {
      deny("quote");
      return;
    }
    void loadDirectIntake();
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
    setCustomer({ id: draft.customerId, customerNumber: draft.customerNumber, name: draft.customerDisplayName, city: null });
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
    const id = requestId("customer");
    setBusy(true);
    setFeedback(null);
    const input: CreateCustomerInput = { ...customerDraft, clientEventId: id };
    try {
      const result = await ports.createCustomer(input);
      if (result.code !== "OK") {
        setFeedback(requestFeedback(result, id));
        return;
      }
      setCustomer({ id: result.customer.id, customerNumber: result.customer.customerNumber, name: result.customer.name, city: customerDraft.city });
      setCustomerReceipt(result.receipt);
      navigate("customer-saved");
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

  const createInputForStatus = (): CreateCustomerInput => ({ ...customerDraft, clientEventId: requestId("customer") });

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
          setCustomer({ id: result.customer.id, customerNumber: result.customer.customerNumber, name: result.customer.name, city: customerDraft.city });
          setCustomerReceipt(result.receipt);
          navigate("customer-saved");
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
    if (services.length === 0) {
      setFeedback({ kind: "validation", message: "Im Leistungskatalog ist noch keine aktive Leistung gepflegt." });
      return;
    }
    resetAwardDateForQuoteContext();
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
    if (!dueDate || positions.some((position) => !position.catalogServiceId) || mapped.some((position) => position.name.length < 2
      || !Number.isSafeInteger(position.quantity) || position.quantity < 1
      || position.surfaceRequested.length < 2 || position.unitPriceCents === null)) {
      setFeedback({ kind: "validation", message: "Termin und alle Positionen brauchen Bezeichnung, Menge, Oberfläche und einen gültigen Netto-Stückpreis." });
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
    const id = requestId("conversion");
    setBusy(true);
    setFeedback(null);
    try {
      const result = await ports.convertQuote({ quoteId: quote.quoteId, clientEventId: id, expectedVersion: quote.version, confirmedAward: true, confirmedOrderDueDate });
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

  const advanceIntakeCustomer = async () => {
    if (!completeOrderCustomer(directCustomer)) {
      setFeedback({ kind: "validation", message: "Für den Auftrag fehlen Name/Firma, Ansprechpartner, Telefon, E-Mail, vollständige Anschrift oder Zahlungsbedingung." });
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      if (directCustomerMode === "NEW") {
        const clientEventId = requestId("directCustomer");
        const created = await ports.createCustomer({ ...directCustomer, clientEventId });
        if (created.code !== "OK") {
          setFeedback(requestFeedback(created, clientEventId));
          return;
        }
        const choice: GlobalCreateCustomerChoice = {
          id: created.customer.id, customerNumber: created.customer.customerNumber, ...directCustomer,
          city: directCustomer.city,
        };
        setDirectCustomerId(choice.id);
        setDirectCustomerMode("EXISTING");
        setCustomerChoices((current) => [choice, ...current.filter((entry) => entry.id !== choice.id)]);
      } else {
        if (!directCustomerId) {
          setFeedback({ kind: "validation", message: "Bitte einen Kunden auswählen." });
          return;
        }
        if (!ports.updateCustomer) {
          setFeedback({ kind: "error", message: "Die Kundenaktualisierung ist derzeit nicht verfügbar." });
          return;
        }
        const updated = await ports.updateCustomer({
          clientEventId: globalThis.crypto.randomUUID(), customerId: directCustomerId, ...directCustomer,
        });
        if (updated.code !== "OK") {
          setFeedback(requestFeedback(updated, directCustomerId));
          return;
        }
        setCustomerChoices((current) => current.map((entry) => entry.id === directCustomerId ? { ...entry, ...directCustomer, city: directCustomer.city } : entry));
      }
      setIntakeStep(2);
    } catch {
      setFeedback({ kind: "unclear", message: "Der Kundenstand konnte nicht sicher bestätigt werden. Es wurde noch kein Auftrag angelegt." });
    } finally {
      setBusy(false);
    }
  };

  const submitDirectIntake = async (event: FormEvent) => {
    event.preventDefault();
    if (!ports.canCreateQuote) {
      deny("quote");
      return;
    }
    const validDates = /^\d{4}-\d{2}-\d{2}$/.test(directWishDate) && /^\d{4}-\d{2}-\d{2}$/.test(directConfirmedDate);
    const items = directItems.map((item) => ({ catalogServiceId:item.catalogServiceId, name:item.name.trim(), quantity:Number(item.quantity), material:nullable(item.material), surfaceRequested:item.surfaceRequested.trim(), unit:item.unit, unitPriceCents:item.unitPriceCents, vatRateBasisPoints:item.vatRateBasisPoints }));
    const validCustomer = directCustomerId.length > 0 && completeOrderCustomer(directCustomer);
    if (!validCustomer || !validDates || items.length < 1 || items.length > 20 || items.some((item) => !item.catalogServiceId || item.name.length < 2 || item.surfaceRequested.length < 2 || !Number.isSafeInteger(item.quantity) || item.quantity < 1)) {
      setFeedback({ kind: "validation", message: "Bitte Kunde, mindestens eine Position, Terminwunsch und zugesagten Termin vollständig angeben." });
      return;
    }
    const id = globalThis.crypto.randomUUID();
    setBusy(true);
    setFeedback(null);
    const input: DirectIntakeInput = {
      clientEventId: id,
      customer: { mode: "EXISTING", customerId: directCustomerId },
      // The existing F1.1 contract persists the confirmed commitment, never the non-binding wish.
      dueDate: directConfirmedDate,
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
      ports.refresh();
    } catch {
      setFeedback({ kind: "unclear", message: "Der Ausgang ist ungeklärt. Es wurde keine zweite Anlage ausgelöst.", requestId: id });
    } finally {
      setBusy(false);
    }
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

  const setPosition = (key: string, field: "quantity" | "material", value: string) => {
    setPositions((current) => current.map((position) => position.key === key ? { ...position, [field]: value } : position));
  };

  const selectQuoteService = (key: string, serviceId: string) => {
    const service = catalogServices.find((candidate) => candidate.id === serviceId);
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
        : { ...newPosition(), key: position.key, quantity: position.quantity, material: position.material }
      : position));
  };

  const reset = () => {
    setStep("choose");
    setFeedback(null);
    setCustomerDraft(EMPTY_CUSTOMER);
    setCustomer(null);
    setCustomerReceipt(null);
    setPositions([newPosition()]);
    setDueDate("");
    setQuoteNote("");
    setConfirmedOrderDueDate("");
    setQuote(null);
    setQuoteReceipt(null);
    setConversion(null);
    setDirectReceipt(null);
    setDirectCustomerMode("NEW");
    setDirectCustomer(EMPTY_CUSTOMER);
    setDirectCustomerId("");
    setDirectItems([newIntakePosition()]);
    setDirectWishDate("");
    setDirectConfirmedDate("");
    setDirectNote("");
    requestIds.current = { customer: "", quote: "", conversion: "", directCustomer: "" };
    setIntakeStep(1);
  };

  return (
    <>
      {ports.showPrimaryTrigger !== false ? <button type="button" className={styles.globalCreateButton} onClick={() => { reset(); void loadDirectIntake(); }} aria-label="Anlegen" aria-haspopup="dialog" aria-expanded={open}>
        <span className={styles.globalCreatePlus} aria-hidden="true">＋</span><span>Anlegen</span>
      </button> : null}
      {open ? (
        <div className={styles.createOverlay} onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
          <section ref={dialogRef} className={styles.createDialog} role="dialog" aria-modal="true" aria-labelledby="global-create-title" onKeyDown={handleDialogKey}>
            <header className={styles.createHeader}>
              <span className={styles.createBadge}><Plus /></span>
              <div>
                <p>Kunde <span>›</span> KV / Angebot <span>›</span> Auftrag</p>
                <h2 id="global-create-title">{step === "choose" ? "Was möchtest du anlegen?" : step === "customer" ? "Neukunde erfassen" : step === "customer-saved" ? "Kunde gesichert" : step === "customer-picker" ? "Kunde für KV wählen" : step === "quote-list" ? "Offene KVs" : step === "quote" ? quote ? "KV bearbeiten" : "Kostenvoranschlag anlegen" : step === "quote-saved" ? "KV gesichert" : step === "order-saved" ? "Auftrag angelegt" : step === "direct-intake" ? "Neuer Eingang" : "Berechtigung klären"}</h2>
              </div>
              <button type="button" className={styles.createIconButton} onClick={close} disabled={busy} aria-label="Anlegen schließen"><X /></button>
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
                      <button type="button" aria-pressed={directCustomerMode === "NEW"} onClick={() => { setDirectCustomerMode("NEW"); setDirectCustomer(EMPTY_CUSTOMER); setDirectCustomerId(""); }}>Neukunde</button>
                      <button type="button" aria-pressed={directCustomerMode === "EXISTING"} onClick={() => { const first = customerChoices[0]; if (first) { setDirectCustomerMode("EXISTING"); setDirectCustomerId(first.id); setDirectCustomer(customerChoiceToDraft(first)); } }} disabled={customerChoices.length === 0}>Bestehender Kunde</button>
                    </div>
                    {directCustomerMode === "EXISTING" ? <label className={styles.createFieldWide}>Kunde<select value={directCustomerId} onChange={(event) => { const selected = customerChoices.find((entry) => entry.id === event.target.value); if (selected) { setDirectCustomerId(selected.id); setDirectCustomer(customerChoiceToDraft(selected)); } }}>{customerChoices.map((entry) => <option key={entry.id} value={entry.id}>{entry.customerNumber ?? "ohne Nummer"} · {entry.name}</option>)}</select></label> : null}
                    <CustomerFields value={directCustomer} onChange={setDirectCustomer} autofocus />
                    <div className={styles.createFormGrid}><label>Terminwunsch<input type="date" value={directWishDate} onChange={(event) => setDirectWishDate(event.target.value)} required /></label><label>Zugesagter Termin<input type="date" value={directConfirmedDate} onChange={(event) => setDirectConfirmedDate(event.target.value)} required /></label><label>Eingangsart<select defaultValue="anruf"><option value="anruf">Anruf</option><option value="persoenlich">Persönlich</option><option value="email">E-Mail</option></select></label></div>
                    <div className={styles.createFormActions}><button type="button" className={styles.createPrimary} onClick={() => void advanceIntakeCustomer()} disabled={busy}>{busy ? <Loader2 className={styles.createSpinner} /> : null} Weiter zu Positionen</button></div>
                  </> : null}
                  {intakeStep === 2 ? <>
                    <p className={styles.createLead}>Leistung aus dem Katalog wählen; Oberfläche, Einheit und Preis werden verbindlich übernommen.</p>
                    {directItems.map((item, index) => <fieldset className={styles.createPosition} key={item.key}><legend>Position {index + 1}</legend><div className={styles.createFormGrid}>
                      <label className={styles.createFieldWide}>Leistung<select required value={item.catalogServiceId} onChange={(event) => { const service=catalogServices.find((candidate)=>candidate.id===event.target.value); if(service)setDirectItems((current)=>current.map((candidate)=>candidate.key===item.key?{...candidate,catalogServiceId:service.id,name:service.name,surfaceRequested:service.surface,unit:service.unit,unitPriceCents:service.netPriceCents,vatRateBasisPoints:service.vatRateBasisPoints}:candidate)); }}><option value="">Bitte wählen</option>{catalogServices.map((service)=><option key={service.id} value={service.id}>{service.name} · {service.surface} · {euro(service.netPriceCents)}/{service.unit}</option>)}</select></label>
                      <label>Menge<input type="number" min="1" value={item.quantity} onChange={(event) => updateDirectItem(item.key, "quantity", event.target.value)} /></label><label>Material<input value={item.material} onChange={(event) => updateDirectItem(item.key, "material", event.target.value)} /></label><label>Oberfläche<input readOnly value={item.surfaceRequested} /></label><label>Einheit<input readOnly value={item.unit} /></label><label>Preis netto<input readOnly value={euro(item.unitPriceCents)} /></label>
                    </div>{directItems.length > 1 ? <button type="button" onClick={() => setDirectItems((current) => current.filter((entry) => entry.key !== item.key))}>Position entfernen</button> : null}</fieldset>)}
                    <div className={styles.createFormActions}><button type="button" onClick={() => setDirectItems((current) => current.length >= 20 ? current : [...current, newIntakePosition()])} disabled={directItems.length >= 20}>Position hinzufügen</button><button type="button" className={styles.createPrimary} onClick={() => { if (directItems.every((item) => item.catalogServiceId && Number(item.quantity) > 0)) { setFeedback(null); setIntakeStep(3); } else setFeedback({ kind: "validation", message: "Bitte jede Position vollständig aus dem Leistungskatalog wählen." }); }}>Weiter zur Prüfung</button></div>
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

              {step === "customer" ? (
                <form className={styles.createForm} onSubmit={(event) => void submitCustomer(event)}>
                  <p className={styles.createLead}>Name und Telefon genügen für einen Interessenten. Fehlende Auftragsdaten werden sichtbar markiert und vor dem ersten Auftrag direkt ergänzt.</p>
                  <CustomerFields value={customerDraft} onChange={setCustomerDraft} autofocus requireOrderData={false} />
                  <div className={styles.createFormActions}><button type="button" onClick={close}>Abbrechen</button><button type="submit" className={styles.createPrimary} disabled={busy}>{busy ? <Loader2 className={styles.createSpinner} /> : <Check />} Neukunde speichern</button></div>
                </form>
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
                        <label className={styles.createFieldWide}>Leistung<select data-autofocus={index === 0 || undefined} required value={position.catalogServiceId} onChange={(event) => selectQuoteService(position.key, event.target.value)}><option value="">Bitte aus dem Katalog wählen</option>{catalogServices.map((service) => <option key={service.id} value={service.id}>{service.name} · {service.surface} · {euro(service.netPriceCents)}/{service.unit}</option>)}</select></label>
                        <label>Menge<input required inputMode="numeric" type="number" min="1" max="1000000" value={position.quantity} onChange={(event) => setPosition(position.key, "quantity", event.target.value)} /></label>
                        <label>Material<input value={position.material} onChange={(event) => setPosition(position.key, "material", event.target.value)} /></label>
                        <label>Oberfläche<input readOnly value={position.surfaceRequested} /></label>
                        <label>Einheit<input readOnly value={position.unit} /></label>
                        <label>Preis netto<input readOnly value={position.unitPriceCents === null ? "" : euro(position.unitPriceCents)} /></label>
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
                  {quote.status === "draft" ? <div className={styles.createAwardBlock}><label htmlFor="confirmed-order-due-date">Zugesagter Termin für den Auftrag</label><input id="confirmed-order-due-date" required type="date" value={confirmedOrderDueDate} onChange={(event) => setConfirmedOrderDueDate(event.target.value)} aria-describedby="confirmed-order-due-date-help" aria-invalid={!confirmedOrderDueDateValid} data-autofocus /><p id="confirmed-order-due-date-help" className={styles.createAwardHelp}>{confirmedOrderDueDateValid ? "Der Auftrag wird mit diesem Termin angelegt." : "Bitte vor dem Zuschlag einen gültigen Auftragstermin festlegen."}</p><button type="button" className={styles.createAward} onClick={() => void convertQuote()} disabled={busy || !confirmedOrderDueDateValid}>{busy ? <Loader2 className={styles.createSpinner} /> : <Check />} Zuschlag bestätigen · Auftrag anlegen</button></div> : null}
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
