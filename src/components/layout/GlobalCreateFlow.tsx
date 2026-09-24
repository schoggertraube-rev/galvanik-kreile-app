"use client";

import {
  ArrowLeft,
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
import type { CreateCustomerInput } from "@/modules/customers/public";
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
export const GLOBAL_CREATE_OPEN_EVENT = "path1:global-create-open";

export function requestGlobalCreate(intent: GlobalCreateIntent): void {
  window.dispatchEvent(new CustomEvent<GlobalCreateIntent>(GLOBAL_CREATE_OPEN_EVENT, { detail: intent }));
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
  city: string | null;
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
  customer:
    | { mode: "EXISTING"; customerId: string }
    | { mode: "NEW"; name: string; customerType: "business" | "privat" | "institution"; companyName: string | null; contactPerson: string | null; email: string | null; phone: string | null; city: string | null };
  dueDate: string;
  note: string | null;
  items: Array<{ name: string; quantity: number; material: string | null; surfaceRequested: string }>;
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
  createCustomer: (input: CreateCustomerInput) => Promise<GlobalCreateCustomerResult>;
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
type CustomerDraft = Omit<CreateCustomerInput, "clientEventId">;
type PositionDraft = { key: string; name: string; quantity: string; material: string; surfaceRequested: string; unitPrice: string };
type IntakePositionDraft = Omit<PositionDraft, "unitPrice">;

const EMPTY_CUSTOMER: CustomerDraft = {
  name: "",
  customerType: "business",
  companyName: null,
  contactPerson: null,
  email: null,
  phone: null,
  city: null,
};

const newPosition = (): PositionDraft => ({
  key: globalThis.crypto.randomUUID(),
  name: "",
  quantity: "1",
  material: "",
  surfaceRequested: "",
  unitPrice: "",
});

const newIntakePosition = (): IntakePositionDraft => ({
  key: globalThis.crypto.randomUUID(),
  name: "",
  quantity: "1",
  material: "",
  surfaceRequested: "",
});

function euro(cents: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(cents / 100);
}

function parseCents(value: string): number | null {
  const normalized = value.trim();
  if (!/^\d{1,7}(?:[.,]\d{1,2})?$/.test(normalized)) return null;
  const [whole, decimal = ""] = normalized.replace(",", ".").split(".");
  const cents = Number(whole) * 100 + Number(decimal.padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents <= 999_999_999 ? cents : null;
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
  const [directCustomer, setDirectCustomer] = useState<CustomerDraft>(EMPTY_CUSTOMER);
  const [directCustomerId, setDirectCustomerId] = useState("");
  const [directItems, setDirectItems] = useState<IntakePositionDraft[]>(() => [newIntakePosition()]);
  const [directWishDate, setDirectWishDate] = useState("");
  const [directConfirmedDate, setDirectConfirmedDate] = useState("");
  const [directNote, setDirectNote] = useState("");
  const [directReceipt, setDirectReceipt] = useState<Extract<GlobalCreateDirectIntakeResult, { code: "OK" }> | null>(null);
  const [quote, setQuote] = useState<QuoteReadback | null>(null);
  const [quoteReceipt, setQuoteReceipt] = useState<(QuoteCreateReceipt | QuoteUpdateReceipt) | null>(null);
  const [openQuotesState, setOpenQuotesState] = useState<OpenQuotesState>({ kind: "idle" });
  const [conversion, setConversion] = useState<Extract<GlobalCreateConversionResult, { code: "OK" }> | null>(null);
  const requestIds = useRef({ customer: "", quote: "", conversion: "" });
  const customerRequestSeq = useRef(0);
  const dialogRef = useRef<HTMLElement>(null);
  const confirmedOrderDueDateValid = isValidDateInput(confirmedOrderDueDate);

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
      const result = await ports.listCustomers();
      if (seq !== customerRequestSeq.current) return;
      if (result.code !== "OK") {
        setCustomerLoad("error");
        setFeedback({ kind: result.code === "DENIED" ? "denied" : "error", message: result.message });
        return;
      }
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
    navigate("direct-intake");
    setCustomerLoad("loading");
    const seq = ++customerRequestSeq.current;
    try {
      const result = await ports.listCustomers();
      if (seq !== customerRequestSeq.current) return;
      if (result.code !== "OK") {
        setFeedback({ kind: result.code === "DENIED" ? "denied" : "error", message: result.message });
        return;
      }
      setCustomerChoices(result.customers);
      const first = result.customers[0];
      if (first) {
        setDirectCustomerId((current) => current || first.id);
      } else {
        setDirectCustomerMode("NEW");
      }
      setCustomerLoad(result.customers.length ? "ready" : "empty");
    } catch {
      if (seq === customerRequestSeq.current) setFeedback({ kind: "error", message: "Die vorhandenen Kunden konnten nicht sicher gelesen werden. Es wurde nichts angelegt." });
    }
  };

  const openWithIntent = (intent: GlobalCreateIntent) => {
    setOpen(true);
    if (intent === "CUSTOMER") {
      if (ports.canCreateCustomer) navigate("customer");
      else deny("customer");
      return;
    }
    if (intent === "QUOTE") {
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
      const intent = event instanceof CustomEvent ? event.detail : null;
      if (intent === "CUSTOMER" || intent === "QUOTE" || intent === "DIRECT_INTAKE") openWithIntent(intent);
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
      const result = await ports.readQuote({ quoteId: ports.resumeQuoteId });
      if (result.code !== "OK") {
        setFeedback(requestFeedback(result, ports.resumeQuoteId));
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
      const result = await ports.listOpenQuotes();
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
    setPositions(draft.positions.map((position) => ({
      key: globalThis.crypto.randomUUID(), name: position.name, quantity: String(position.quantity),
      material: position.material ?? "", surfaceRequested: position.surfaceRequested,
      unitPrice: (position.unitPriceCents / 100).toFixed(2).replace(".", ","),
    })));
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
      surfaceRequested: position.surfaceRequested.trim(), unitPriceCents: parseCents(position.unitPrice),
    }));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || mapped.some((position) => position.unitPriceCents === null)) return null;
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

  const startQuote = (selected: GlobalCreateCustomerChoice) => {
    if (!ports.canCreateQuote) {
      deny("quote");
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
      unitPriceCents: parseCents(position.unitPrice),
    }));
    if (!dueDate || mapped.some((position) => position.name.length < 2
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

  const submitDirectIntake = async (event: FormEvent) => {
    event.preventDefault();
    if (!ports.canCreateQuote) {
      deny("quote");
      return;
    }
    const validDates = /^\d{4}-\d{2}-\d{2}$/.test(directWishDate) && /^\d{4}-\d{2}-\d{2}$/.test(directConfirmedDate);
    const items = directItems.map((item) => ({ name: item.name.trim(), quantity: Number(item.quantity), material: nullable(item.material), surfaceRequested: item.surfaceRequested.trim() }));
    const validCustomer = directCustomerMode === "EXISTING"
      ? directCustomerId.length > 0
      : directCustomer.name.trim().length >= 2;
    if (!validCustomer || !validDates || items.length < 1 || items.length > 20 || items.some((item) => item.name.length < 2 || item.surfaceRequested.length < 2 || !Number.isSafeInteger(item.quantity) || item.quantity < 1)) {
      setFeedback({ kind: "validation", message: "Bitte Kunde, mindestens eine Position, Terminwunsch und zugesagten Termin vollständig angeben." });
      return;
    }
    const id = globalThis.crypto.randomUUID();
    setBusy(true);
    setFeedback(null);
    const input: DirectIntakeInput = {
      clientEventId: id,
      customer: directCustomerMode === "EXISTING"
        ? { mode: "EXISTING", customerId: directCustomerId }
        : { mode: "NEW", name: directCustomer.name.trim(), customerType: directCustomer.customerType, companyName: directCustomer.companyName, contactPerson: directCustomer.contactPerson, email: directCustomer.email, phone: directCustomer.phone, city: directCustomer.city },
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

  const setCustomerField = <K extends keyof CustomerDraft>(key: K, value: CustomerDraft[K]) => {
    setCustomerDraft((current) => ({ ...current, [key]: value }));
  };

  const setPosition = (key: string, field: keyof Omit<PositionDraft, "key">, value: string) => {
    setPositions((current) => current.map((position) => position.key === key ? { ...position, [field]: value } : position));
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
    requestIds.current = { customer: "", quote: "", conversion: "" };
  };

  return (
    <>
      {ports.showPrimaryTrigger !== false ? <button type="button" className={styles.globalCreateButton} onClick={() => setOpen(true)} aria-label="Anlegen" aria-haspopup="dialog" aria-expanded={open}>
        <span className={styles.globalCreatePlus} aria-hidden="true">＋</span><span>Anlegen</span>
      </button> : null}
      {open ? (
        <div className={styles.createOverlay} onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
          <section ref={dialogRef} className={styles.createDialog} role="dialog" aria-modal="true" aria-labelledby="global-create-title" onKeyDown={handleDialogKey}>
            <header className={styles.createHeader}>
              {step !== "choose" && step !== "order-saved" ? (
                <button type="button" className={styles.createIconButton} onClick={() => navigate("choose")} aria-label="Zur Auswahl"><ArrowLeft /></button>
              ) : <span className={styles.createBadge}><Plus /></span>}
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
                  <div className={styles.createFormActions}><button type="button" onClick={reset}>Weiteren Eingang anlegen</button><button type="button" className={styles.createPrimary} onClick={() => ports.openOrder(directReceipt.receipt.orderId)}>Auftragskarte öffnen</button></div>
                  <ReceiptFacts title="Neuer Eingang – technische Details für Support" values={[["Anfragekennung", directReceipt.receipt.clientEventId], ["Bestätigung", directReceipt.receipt.receiptId]]} />
                </section>
              ) : (
                <form className={styles.createForm} onSubmit={(event) => void submitDirectIntake(event)}>
                  <p className={styles.createLead}>Neuen Eingang vollständig manuell erfassen. Der Terminwunsch bleibt sichtbar; mit dem Auftrag wird nur der ausdrücklich zugesagte Termin gesichert.</p>
                  <div className={styles.createInlineChoices} role="group" aria-label="Kunde für neuen Eingang">
                    <button type="button" aria-pressed={directCustomerMode === "NEW"} onClick={() => setDirectCustomerMode("NEW")}>Neukunde</button>
                    <button type="button" aria-pressed={directCustomerMode === "EXISTING"} onClick={() => setDirectCustomerMode("EXISTING")} disabled={customerChoices.length === 0}>Bestehender Kunde</button>
                  </div>
                  {directCustomerMode === "NEW" ? <div className={styles.createFormGrid}>
                    <label className={styles.createFieldWide}>Firma / Name<input data-autofocus required minLength={2} value={directCustomer.name} onChange={(event) => setDirectCustomer((current) => ({ ...current, name: event.target.value }))} /></label>
                    <label>Ort<input value={directCustomer.city ?? ""} onChange={(event) => setDirectCustomer((current) => ({ ...current, city: nullable(event.target.value) }))} /></label>
                    <label>Telefon<input value={directCustomer.phone ?? ""} onChange={(event) => setDirectCustomer((current) => ({ ...current, phone: nullable(event.target.value) }))} /></label>
                  </div> : <label className={styles.createFieldWide}>Kunde<select value={directCustomerId} onChange={(event) => setDirectCustomerId(event.target.value)}>{customerChoices.map((entry) => <option key={entry.id} value={entry.id}>{entry.customerNumber ?? ""} {entry.name}</option>)}</select></label>}
                  <div className={styles.createFormGrid}>
                    <label>Terminwunsch<input type="date" value={directWishDate} onChange={(event) => setDirectWishDate(event.target.value)} required /></label>
                    <label>Zugesagter Termin<input type="date" value={directConfirmedDate} onChange={(event) => setDirectConfirmedDate(event.target.value)} required /></label>
                    <label className={styles.createFieldWide}>Hinweis<input value={directNote} onChange={(event) => setDirectNote(event.target.value)} /></label>
                  </div>
                  {directItems.map((item, index) => <fieldset className={styles.createPosition} key={item.key}><legend>Position {index + 1}</legend><div className={styles.createFormGrid}>
                    <label>Teil / Bezeichnung<input required minLength={2} value={item.name} onChange={(event) => updateDirectItem(item.key, "name", event.target.value)} /></label>
                    <label>Menge<input type="number" min="1" value={item.quantity} onChange={(event) => updateDirectItem(item.key, "quantity", event.target.value)} /></label>
                    <label>Material<input value={item.material} onChange={(event) => updateDirectItem(item.key, "material", event.target.value)} /></label>
                    <label>Oberfläche<input required minLength={2} value={item.surfaceRequested} onChange={(event) => updateDirectItem(item.key, "surfaceRequested", event.target.value)} /></label>
                  </div>{directItems.length > 1 ? <button type="button" onClick={() => setDirectItems((current) => current.filter((entry) => entry.key !== item.key))}>Position entfernen</button> : null}</fieldset>)}
                  <div className={styles.createFormActions}><button type="button" onClick={() => setDirectItems((current) => current.length >= 20 ? current : [...current, newIntakePosition()])} disabled={directItems.length >= 20}>Position hinzufügen</button><button type="submit" className={styles.createPrimary} disabled={busy}>{busy ? <Loader2 className={styles.createSpinner} /> : <Check />} Eingang speichern</button></div>
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
                  <p className={styles.createLead}>Kundendaten gelten erst nach sicherer Speicherung und erneuter Prüfung als gespeichert.</p>
                  <div className={styles.createFormGrid}>
                    <label className={styles.createFieldWide}>Firma / Name<input data-autofocus required minLength={2} value={customerDraft.name} onChange={(event) => setCustomerField("name", event.target.value)} /></label>
                    <label>Kundentyp<select value={customerDraft.customerType} onChange={(event) => setCustomerField("customerType", event.target.value as CustomerDraft["customerType"])}><option value="business">Firma</option><option value="privat">Privat</option><option value="institution">Institution</option></select></label>
                    <label>Firmenname<input value={customerDraft.companyName ?? ""} onChange={(event) => setCustomerField("companyName", nullable(event.target.value))} /></label>
                    <label>Ansprechpartner<input value={customerDraft.contactPerson ?? ""} onChange={(event) => setCustomerField("contactPerson", nullable(event.target.value))} /></label>
                    <label>Telefon<input value={customerDraft.phone ?? ""} onChange={(event) => setCustomerField("phone", nullable(event.target.value))} /></label>
                    <label>E-Mail<input type="email" value={customerDraft.email ?? ""} onChange={(event) => setCustomerField("email", nullable(event.target.value))} /></label>
                    <label>Ort<input value={customerDraft.city ?? ""} onChange={(event) => setCustomerField("city", nullable(event.target.value))} /></label>
                  </div>
                  <div className={styles.createFormActions}><button type="button" onClick={() => navigate("choose")}>Zurück</button><button type="submit" className={styles.createPrimary} disabled={busy}>{busy ? <Loader2 className={styles.createSpinner} /> : <Check />} Neukunde speichern</button></div>
                </form>
              ) : null}

              {step === "customer-saved" && customer && customerReceipt ? (
                <div className={styles.createSuccess}>
                  <span className={styles.createSuccessIcon}><Check /></span>
                  <h3>{customer.name} · {customer.customerNumber}</h3>
                  <p>Der Kunde ist gespeichert und im aktuellen Datenstand wiedergefunden.</p>
                  <ReceiptFacts title="Kundenanlage – technische Details für Support" values={[["Vorgangskennung", customerReceipt.receiptId], ["Nachweis", customerReceipt.eventId], ["Zeit", customerReceipt.recordedAt]]} />
                  <div className={styles.createChoiceGrid}>
                    <button type="button" onClick={() => startQuote(customer)} data-autofocus><FileText /><span><strong>KV / Angebot anlegen</strong><small>Mit diesem echten Kunden weiterarbeiten.</small></span></button>
                    <button type="button" className={styles.createChoiceAlternate} onClick={() => { setOpen(false); ports.openCustomer(customer.id); }}><UserPlus /><span><strong>Kundenkarte öffnen</strong><small>Gespeicherten Stammdatensatz prüfen.</small></span></button>
                  </div>
                </div>
              ) : null}

              {step === "customer-picker" ? (
                <div>
                  <label className={styles.createSearch}>Kunde suchen<input data-autofocus value={customerQuery} onChange={(event) => setCustomerQuery(event.target.value)} placeholder="Name, Kundennummer oder Ort" /></label>
                  {customerLoad === "loading" ? <p className={styles.createLoading} role="status"><Loader2 className={styles.createSpinner} /> Kundenstamm wird sicher gelesen …</p> : null}
                  {customerLoad === "empty" ? <div className={styles.createEmpty}><h3>Noch kein belegter Kunde</h3><p>Datenstand: Der Kundenstamm ist geladen und enthält keinen passenden Kunden. Nächster Schritt: Kunde anlegen.</p>{ports.canCreateCustomer ? <button type="button" onClick={() => navigate("customer")}>Kunde anlegen</button> : null}</div> : null}
                  {customerLoad === "ready" && filteredCustomers.length === 0 ? <div className={styles.createEmpty}><h3>Keine belegte Übereinstimmung</h3><p>Der geladene Kundenstamm wurde nach Name, Kundennummer und Ort geprüft.</p></div> : null}
                  <div className={styles.createCustomerList}>{filteredCustomers.map((entry) => <button type="button" key={entry.id} onClick={() => startQuote(entry)}><span><strong>{entry.name}</strong><small>{entry.customerNumber ?? "ohne Kundennummer"}{entry.city ? ` · ${entry.city}` : ""}</small></span><FileText /></button>)}</div>
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
                        <label className={styles.createFieldWide}>Teil / Bezeichnung<input data-autofocus={index === 0 || undefined} required value={position.name} onChange={(event) => setPosition(position.key, "name", event.target.value)} /></label>
                        <label>Menge<input required inputMode="numeric" type="number" min="1" max="1000000" value={position.quantity} onChange={(event) => setPosition(position.key, "quantity", event.target.value)} /></label>
                        <label>Material<input value={position.material} onChange={(event) => setPosition(position.key, "material", event.target.value)} /></label>
                        <label>Oberfläche<input required value={position.surfaceRequested} onChange={(event) => setPosition(position.key, "surfaceRequested", event.target.value)} /></label>
                        <label>Netto je Stück<input required inputMode="decimal" value={position.unitPrice} onChange={(event) => setPosition(position.key, "unitPrice", event.target.value)} placeholder="0,00" /></label>
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
                  {quote.status === "draft" ? <><div className={styles.createFormActions}><button type="button" onClick={() => editQuote(quote)} disabled={busy}>KV bearbeiten</button></div><div className={styles.createAwardBlock}><label htmlFor="confirmed-order-due-date">Zugesagter Termin für den Auftrag</label><input id="confirmed-order-due-date" required type="date" value={confirmedOrderDueDate} onChange={(event) => setConfirmedOrderDueDate(event.target.value)} aria-describedby="confirmed-order-due-date-help" aria-invalid={!confirmedOrderDueDateValid} data-autofocus /><p id="confirmed-order-due-date-help" className={styles.createAwardHelp}>{confirmedOrderDueDateValid ? "Der Auftrag wird mit diesem Termin angelegt." : "Bitte vor dem Zuschlag einen gültigen Auftragstermin festlegen."}</p><button type="button" className={styles.createAward} onClick={() => void convertQuote()} disabled={busy || !confirmedOrderDueDateValid}>{busy ? <Loader2 className={styles.createSpinner} /> : <Check />} Zuschlag bestätigen · Auftrag anlegen</button></div></> : null}
                </div>
              ) : null}

              {step === "order-saved" && conversion ? (
                <div className={styles.createSuccess}>
                  <span className={styles.createSuccessIcon}><Check /></span>
                  <h3>Auftrag {conversion.orderReceipt.orderNumber} angelegt</h3>
                  <p>Der Zuschlag ist bestätigt. Der Auftrag wurde sicher angelegt und ist mit diesem KV verknüpft.</p>
                  <ReceiptFacts title="Auftrag – technische Details für Support" values={[["KV-Nachweis", conversion.quoteReceipt.receiptId], ["Auftragsnachweis", conversion.orderReceipt.receiptId], ["Zeit", conversion.orderReceipt.recordedAt]]} />
                  <div className={styles.createFormActions}><button type="button" onClick={reset}>Weiteren Vorgang anlegen</button><button type="button" className={styles.createPrimary} onClick={() => { setOpen(false); ports.openOrder(conversion.orderReceipt.orderId); }} data-autofocus>Auftragskarte öffnen</button></div>
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
