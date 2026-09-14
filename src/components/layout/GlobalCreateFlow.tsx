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
import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import type { CreateCustomerInput } from "@/modules/customers/public";
import type {
  ConvertQuoteInput,
  CreateQuoteInput,
  QuoteConversionReceipt,
  QuoteCreateReceipt,
  QuoteReadback,
} from "@/modules/quotes/public";
import styles from "./TargetShell.module.css";

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
  | { code: "OK"; quote: QuoteReadback; receipt: QuoteCreateReceipt; replayed: boolean }
  | Failure;

export type GlobalCreateQuoteReadResult =
  | { code: "OK"; quote: QuoteReadback }
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

export type GlobalCreatePorts = {
  canCreateCustomer: boolean;
  canCreateQuote: boolean;
  roleLabel: string;
  resumeQuoteId: string | null;
  listCustomers: () => Promise<
    | { code: "OK"; customers: GlobalCreateCustomerChoice[] }
    | { code: "DENIED" | "UNAVAILABLE"; message: string }
  >;
  createCustomer: (input: CreateCustomerInput) => Promise<GlobalCreateCustomerResult>;
  createQuote: (input: CreateQuoteInput) => Promise<GlobalCreateQuoteResult>;
  readQuote: (input: { quoteId: string }) => Promise<GlobalCreateQuoteReadResult>;
  convertQuote: (input: ConvertQuoteInput) => Promise<GlobalCreateConversionResult>;
  rememberQuote: (quoteId: string | null) => void;
  openCustomer: (customerId: string) => void;
  openOrder: (orderId: string) => void;
  switchProfile: () => Promise<void>;
};

type Step = "choose" | "customer" | "customer-saved" | "customer-picker" | "quote" | "quote-saved" | "order-saved" | "denied";
type Feedback = { kind: "validation" | "conflict" | "denied" | "error" | "unclear"; message: string; requestId?: string };
type CustomerDraft = Omit<CreateCustomerInput, "clientEventId">;
type PositionDraft = { key: string; name: string; quantity: string; material: string; surfaceRequested: string; unitPrice: string };

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
    <section className={styles.createReceipt} aria-label={title}>
      <h3>{title}</h3>
      <dl>{values.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    </section>
  );
}

export function GlobalCreateFlow({ ports }: { ports: GlobalCreatePorts }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("choose");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
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
  const [quote, setQuote] = useState<QuoteReadback | null>(null);
  const [quoteReceipt, setQuoteReceipt] = useState<QuoteCreateReceipt | null>(null);
  const [conversion, setConversion] = useState<Extract<GlobalCreateConversionResult, { code: "OK" }> | null>(null);
  const requestIds = useRef({ customer: "", quote: "", conversion: "" });
  const customerRequestSeq = useRef(0);
  const dialogRef = useRef<HTMLElement>(null);

  const requestId = (kind: keyof typeof requestIds.current) => {
    if (!requestIds.current[kind]) requestIds.current[kind] = globalThis.crypto.randomUUID();
    return requestIds.current[kind];
  };

  const navigate = (next: Step) => {
    setFeedback(null);
    setCopied(false);
    setStep(next);
  };

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      const target = dialogRef.current?.querySelector<HTMLElement>("[data-autofocus]")
        ?? dialogRef.current?.querySelector<HTMLElement>("input:not([disabled]), button:not([disabled])");
      target?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open, step]);

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
        ? `Das Profil ${ports.roleLabel} darf keine Kunden anlegen. Zuständig sind Büro oder Administration.`
        : `Das Profil ${ports.roleLabel} darf keinen KV oder Auftrag anlegen. Zuständig sind Büro, Meister oder Administration.`,
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

  const startQuote = (selected: GlobalCreateCustomerChoice) => {
    if (!ports.canCreateQuote) {
      deny("quote");
      return;
    }
    setCustomer(selected);
    setQuote(null);
    setQuoteReceipt(null);
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
      const result = await ports.createQuote({
        clientEventId: id,
        customerId: customer.id,
        dueDate,
        note: nullable(quoteNote),
        positions: mapped.map((position) => ({ ...position, unitPriceCents: position.unitPriceCents! })),
      });
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
    const id = requestId("conversion");
    setBusy(true);
    setFeedback(null);
    try {
      const result = await ports.convertQuote({ quoteId: quote.quoteId, clientEventId: id, expectedVersion: quote.version, confirmedAward: true });
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
    setQuote(null);
    setQuoteReceipt(null);
    setConversion(null);
    requestIds.current = { customer: "", quote: "", conversion: "" };
  };

  return (
    <>
      <button type="button" className={styles.globalCreateButton} onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open}>
        <Plus aria-hidden="true" /> <span>Anlegen</span>
      </button>
      {open ? (
        <div className={styles.createOverlay} onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
          <section ref={dialogRef} className={styles.createDialog} role="dialog" aria-modal="true" aria-labelledby="global-create-title" onKeyDown={handleDialogKey}>
            <header className={styles.createHeader}>
              {step !== "choose" && step !== "order-saved" ? (
                <button type="button" className={styles.createIconButton} onClick={() => navigate("choose")} aria-label="Zur Auswahl"><ArrowLeft /></button>
              ) : <span className={styles.createBadge}><Plus /></span>}
              <div>
                <p>Kunde <span>›</span> KV / Angebot <span>›</span> Auftrag</p>
                <h2 id="global-create-title">
                  {step === "choose" ? "Was möchten Sie anlegen?" : step === "customer" ? "Neukunde erfassen" : step === "customer-saved" ? "Kunde gesichert" : step === "customer-picker" ? "Kunde für KV wählen" : step === "quote" ? "Kostenvoranschlag anlegen" : step === "quote-saved" ? "KV gesichert" : step === "order-saved" ? "Auftrag angelegt" : "Berechtigung klären"}
                </h2>
              </div>
              <button type="button" className={styles.createIconButton} onClick={close} disabled={busy} aria-label="Anlegen schließen"><X /></button>
            </header>

            <div className={styles.createBody}>
              {step === "choose" ? (
                <>
                  <p className={styles.createLead}>Manuell erfassen und nach jedem Speichern den echten Datenstand zurücklesen.</p>
                  {ports.resumeQuoteId ? (
                    <button type="button" className={styles.createResume} onClick={() => void resumeQuote()} disabled={busy} data-autofocus>
                      <FileText /> <span><strong>Gespeicherten KV fortsetzen</strong><small>Aus der Datenbank zurücklesen und Zuschlag bearbeiten.</small></span>
                    </button>
                  ) : null}
                  <div className={styles.createChoiceGrid}>
                    <button type="button" onClick={() => ports.canCreateCustomer ? navigate("customer") : deny("customer")} data-autofocus={!ports.resumeQuoteId || undefined}>
                      <UserPlus /><span><strong>Kunde anlegen</strong><small>Neukunde manuell erfassen. Danach direkt einen KV anlegen.</small></span>
                    </button>
                    <button type="button" className={styles.createChoiceAlternate} onClick={() => void loadCustomers()}>
                      <FileText /><span><strong>Auftrag / KV anlegen</strong><small>Bestehenden Kunden wählen und einen persistenten KV erfassen.</small></span>
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

              {step === "customer" ? (
                <form className={styles.createForm} onSubmit={(event) => void submitCustomer(event)}>
                  <p className={styles.createLead}>Kundendaten werden erst nach Receipt und fachlichem Readback als gespeichert gezeigt.</p>
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
                  <p>Der Kunde ist gespeichert und über den kanonischen Kunden-Read-Port zurückgelesen.</p>
                  <ReceiptFacts title="Kunden-Receipt" values={[["Receipt", customerReceipt.receiptId], ["Event", customerReceipt.eventId], ["Akteur", customerReceipt.actorId], ["Zeit", customerReceipt.recordedAt]]} />
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
                  {customerLoad === "empty" ? <div className={styles.createEmpty}><h3>Noch kein belegter Kunde</h3><p>Der Kundenstamm wurde geprüft. Legen Sie zuerst einen Kunden an.</p>{ports.canCreateCustomer ? <button type="button" onClick={() => navigate("customer")}>Kunde anlegen</button> : null}</div> : null}
                  {customerLoad === "ready" && filteredCustomers.length === 0 ? <div className={styles.createEmpty}><h3>Keine belegte Übereinstimmung</h3><p>Der geladene Kundenstamm wurde nach Name, Kundennummer und Ort geprüft.</p></div> : null}
                  <div className={styles.createCustomerList}>{filteredCustomers.map((entry) => <button type="button" key={entry.id} onClick={() => startQuote(entry)}><span><strong>{entry.name}</strong><small>{entry.customerNumber ?? "ohne Kundennummer"}{entry.city ? ` · ${entry.city}` : ""}</small></span><FileText /></button>)}</div>
                </div>
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
                  <p className={styles.createPassive}>Die Angebotssumme wird ausschließlich aus dem persistierten KV-Readback angezeigt.</p>
                  <div className={styles.createFormActions}><button type="button" onClick={() => customerReceipt ? navigate("customer-saved") : void loadCustomers()}>Zurück</button><button type="submit" className={styles.createPrimary} disabled={busy}>{busy ? <Loader2 className={styles.createSpinner} /> : <Check />} KV sichern</button></div>
                </form>
              ) : null}

              {step === "quote-saved" && quote ? (
                <div className={styles.createSuccess}>
                  <span className={styles.createSuccessIcon}><Check /></span>
                  <h3>{quote.quoteNumber} gesichert</h3>
                  <p>{quote.customerDisplayName} · {quote.positions.length} {quote.positions.length === 1 ? "Position" : "Positionen"} · kanonisch {euro(quote.totalNetCents)} netto.</p>
                  <div className={styles.createContext}><span>Status / Version</span><strong>{quote.status} · v{quote.version}</strong><span>Termin</span><strong>{quote.dueDate}</strong></div>
                  {quoteReceipt ? <ReceiptFacts title="KV-Receipt" values={[["Receipt", quoteReceipt.receiptId], ["Event", quoteReceipt.eventId], ["Akteur", quoteReceipt.actorId], ["Zeit", quoteReceipt.recordedAt]]} /> : <p className={styles.createReadback}>Der gespeicherte KV wurde nach Reload aus der Datenbank zurückgelesen.</p>}
                  {quote.status === "draft" ? <button type="button" className={styles.createAward} onClick={() => void convertQuote()} disabled={busy} data-autofocus>{busy ? <Loader2 className={styles.createSpinner} /> : <Check />} Zuschlag bestätigen · Auftrag anlegen</button> : null}
                </div>
              ) : null}

              {step === "order-saved" && conversion ? (
                <div className={styles.createSuccess}>
                  <span className={styles.createSuccessIcon}><Check /></span>
                  <h3>Auftrag {conversion.orderReceipt.orderNumber} angelegt</h3>
                  <p>Der Zuschlag ist bestätigt. KV und genau ein verknüpfter F1.1-Auftrag wurden mit beiden Readbacks bestätigt.</p>
                  <ReceiptFacts title="KV-Zuschlagsreceipt" values={[["Receipt", conversion.quoteReceipt.receiptId], ["Event", conversion.quoteReceipt.eventId], ["Akteur", conversion.quoteReceipt.actorId], ["Zeit", conversion.quoteReceipt.recordedAt]]} />
                  <ReceiptFacts title="F1.1-Auftragsreceipt" values={[["Receipt", conversion.orderReceipt.receiptId], ["Event", conversion.orderReceipt.eventId], ["Auftrag", conversion.orderReceipt.orderId], ["Akteur", conversion.orderReceipt.actorId], ["Zeit", conversion.orderReceipt.recordedAt]]} />
                  <div className={styles.createFormActions}><button type="button" onClick={reset}>Weiteren Vorgang anlegen</button><button type="button" className={styles.createPrimary} onClick={() => { setOpen(false); ports.openOrder(conversion.orderReceipt.orderId); }} data-autofocus>Auftragskarte öffnen</button></div>
                </div>
              ) : null}

              {feedback && step !== "denied" ? (
                <section className={styles.createFeedback} data-kind={feedback.kind} role="alert">
                  <strong>{feedback.kind === "unclear" ? "Ausgang ungeklärt" : feedback.kind === "conflict" ? "Konflikt" : feedback.kind === "denied" ? "Zugriff verweigert" : feedback.kind === "validation" ? "Eingaben prüfen" : "Vorgang nicht abgeschlossen"}</strong>
                  <p>{feedback.message}</p>
                  {feedback.requestId ? <div><code>{feedback.requestId}</code><button type="button" onClick={() => void copyRequestId()} aria-label="Anfragekennung kopieren"><ClipboardCopy /> {copied ? "Kopiert" : "Kennung kopieren"}</button></div> : null}
                  {feedback.kind === "unclear" ? <button type="button" className={styles.createStatusCheck} onClick={() => {
                    if (step === "customer") void submitCustomer({ preventDefault() {} } as FormEvent);
                    else if (step === "quote") void submitQuote({ preventDefault() {} } as FormEvent);
                    else if (step === "quote-saved") void convertQuote();
                  }} disabled={busy}>Status mit gleicher Kennung prüfen</button> : null}
                </section>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
