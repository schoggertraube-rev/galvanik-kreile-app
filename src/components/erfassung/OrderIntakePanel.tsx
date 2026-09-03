"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, PackagePlus, Plus, Search, ShieldCheck, Trash2, Upload } from "lucide-react";
import {
  createOrderIntakeAction,
  finalizeOrderIntakeAttachmentAction,
  getOrderIntakeAttachmentsAction,
  getOrderIntakeReceiptAction,
  getWareneingangOrdersAction,
  reserveOrderIntakeAttachmentAction,
  searchOrderIntakeCustomersAction,
} from "@/app/warendurchlauf/actions";
import { supabase } from "@/lib/supabase/client";
import type {
  CreateOrderIntakeInput,
  OrderIntakeReceipt,
} from "@/lib/server/commands/orderIntakeCommand";
import type { OrderIntakeCustomerOption } from "@/lib/server/orderIntakeRead";
import { ORDER_LIFECYCLE_STATUS } from "@/lib/orders/orderLifecycleContract";

const MAX_FILE_BYTES = 12 * 1024 * 1024;
const MIME_EXTENSION = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

type DraftItem = { key: string; name: string; quantity: string; material: string; surfaceRequested: string };
type PanelState = "loading" | "data" | "empty" | "denied" | "error" | "submitting" | "confirming" | "conflict" | "success";

function canCustomerLoadCommit(state: PanelState): boolean {
  return state === "loading" || state === "data" || state === "empty";
}

function newDraftItem(): DraftItem {
  return { key: crypto.randomUUID(), name: "", quantity: "1", material: "", surfaceRequested: "" };
}

function todayInBerlin(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date());
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeOptionalText(value: string): string | null {
  return normalizeText(value) || null;
}

function sameReceiptItem(
  left: OrderIntakeReceipt["items"][number],
  right: OrderIntakeReceipt["items"][number],
): boolean {
  return left.id === right.id
    && left.position === right.position
    && left.name === right.name
    && left.quantity === right.quantity
    && left.material === right.material
    && left.surfaceRequested === right.surfaceRequested;
}

function sameReceipt(left: OrderIntakeReceipt, right: OrderIntakeReceipt): boolean {
  return left.receiptId === right.receiptId
    && left.eventId === right.eventId
    && left.orderId === right.orderId
    && left.orderNumber === right.orderNumber
    && left.customerId === right.customerId
    && left.customerDisplayName === right.customerDisplayName
    && left.customerMode === right.customerMode
    && left.clientEventId === right.clientEventId
    && left.correlationId === right.correlationId
    && left.actorId === right.actorId
    && left.dueDate === right.dueDate
    && left.note === right.note
    && left.orderVersion === right.orderVersion
    && left.station === right.station
    && left.status === right.status
    && left.recordedAt === right.recordedAt
    && left.items.length === right.items.length
    && left.items.every((item, index) => sameReceiptItem(item, right.items[index]));
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function receiptMatchesSubmission(
  rec: OrderIntakeReceipt,
  input: CreateOrderIntakeInput,
  expectedCustomerDisplayName: string,
): boolean {
  if (rec.clientEventId !== input.clientEventId) return false;
  if (rec.customerMode !== input.customer.mode) return false;
  if (input.customer.mode === "EXISTING" && rec.customerId !== input.customer.customerId) return false;
  if (rec.customerDisplayName !== expectedCustomerDisplayName) return false;
  if (rec.dueDate !== input.dueDate) return false;
  if (rec.note !== input.note) return false;
  if (rec.orderVersion !== 1) return false;
  if (rec.station !== "wareneingang") return false;
  if (rec.status !== ORDER_LIFECYCLE_STATUS.ANGENOMMEN) return false;
  if (rec.items.length !== input.items.length) return false;
  return rec.items.every((item, index) => {
    if (!UUID_RE.test(item.id)) return false;
    const sent = input.items[index];
    return item.position === index + 1
      && item.name === sent.name
      && item.quantity === sent.quantity
      && item.material === sent.material
      && item.surfaceRequested === sent.surfaceRequested;
  });
}

type RetryIntent = { canonicalHash: string; clientEventId: string };

function canonicalFormHash(input: Omit<CreateOrderIntakeInput, "clientEventId">): string {
  return JSON.stringify({
    customer: input.customer,
    dueDate: input.dueDate,
    note: input.note,
    items: input.items,
  });
}

async function readAndHash(file: File): Promise<{ bytes: Uint8Array; sha256: string }> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return { bytes, sha256: Array.from(digest, (value) => value.toString(16).padStart(2, "0")).join("") };
}

export function OrderIntakePanel({
  onClose,
  setCloseBlocked,
}: {
  onClose: () => void;
  setCloseBlocked: (blocked: boolean) => void;
}) {
  const [panelState, setPanelStateValue] = useState<PanelState>("loading");
  const panelStateRef = useRef<PanelState>("loading");
  const setPanelState = useCallback((nextState: PanelState) => {
    panelStateRef.current = nextState;
    setPanelStateValue(nextState);
  }, []);
  const [message, setMessage] = useState("Kunden werden geladen.");
  const [query, setQuery] = useState("");
  const [customers, setCustomers] = useState<OrderIntakeCustomerOption[]>([]);
  const [canCreateCustomer, setCanCreateCustomer] = useState(false);
  const [customerMode, setCustomerMode] = useState<"EXISTING" | "NEW">("EXISTING");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [newCustomer, setNewCustomer] = useState({
    name: "", customerType: "business" as const, companyName: "", contactPerson: "", email: "", phone: "", city: "",
  });
  const [items, setItems] = useState<DraftItem[]>([newDraftItem()]);
  const [dueDate, setDueDate] = useState(todayInBerlin());
  const [note, setNote] = useState("");
  const [receipt, setReceipt] = useState<OrderIntakeReceipt | null>(null);
  const [attachmentMessages, setAttachmentMessages] = useState<Record<string, string>>({});
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);
  const searchSequence = useRef(0);
  const submitting = useRef(false);
  const retryIntent = useRef<RetryIntent | null>(null);

  const loadCustomers = useCallback(async (search: string) => {
    if (!canCustomerLoadCommit(panelStateRef.current)) return;
    const sequence = ++searchSequence.current;
    const result = await searchOrderIntakeCustomersAction({ query: search.trim() });
    if (sequence !== searchSequence.current || !canCustomerLoadCommit(panelStateRef.current)) return;
    if (!result.ok) {
      setCustomers([]);
      setMessage(result.message);
      setPanelState(result.error === "FORBIDDEN" || result.error === "AUTH_ERROR" ? "denied" : "error");
      return;
    }
    setCustomers(result.data.customers);
    setCanCreateCustomer(result.data.canCreateCustomer);
    const firstCustomerId = result.data.customers[0]?.id;
    if (firstCustomerId) setSelectedCustomerId((current) => current || firstCustomerId);
    setMessage(result.data.customers.length === 0 ? "Noch keine passenden Kunden erfasst." : "Kunde auswählen oder neu anlegen.");
    setPanelState(result.data.customers.length === 0 ? "empty" : "data");
  }, [setPanelState]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadCustomers(query), 250);
    return () => window.clearTimeout(timer);
  }, [loadCustomers, query]);

  const formValid = useMemo(() => {
    const customerValid = customerMode === "EXISTING"
      ? selectedCustomerId.length > 0
      : newCustomer.name.trim().length >= 2 && (!newCustomer.email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newCustomer.email.trim()));
    return customerValid && /^\d{4}-\d{2}-\d{2}$/.test(dueDate) && items.length >= 1 && items.length <= 20
      && items.every((item) => item.name.trim().length >= 2 && item.surfaceRequested.trim().length >= 2
        && Number.isSafeInteger(Number(item.quantity)) && Number(item.quantity) >= 1 && Number(item.quantity) <= 1_000_000);
  }, [customerMode, dueDate, items, newCustomer, selectedCustomerId]);

  const updateItem = (key: string, field: keyof Omit<DraftItem, "key">, value: string) => {
    setItems((current) => current.map((item) => item.key === key ? { ...item, [field]: value } : item));
  };

  const submit = async () => {
    if (!formValid || submitting.current) return;
    submitting.current = true;
    setCloseBlocked(true);
    setPanelState("submitting");
    setMessage("Wareneingang wird atomar gespeichert.");
    let expectedReceiptCustomerDisplayName: string;
    let expectedOperationalCustomerName: string;
    if (customerMode === "EXISTING") {
      const found = customers.find((c) => c.id === selectedCustomerId);
      if (!found) {
        setPanelState("error");
        setMessage("Gewählter Kunde konnte nicht eindeutig bestätigt werden.");
        submitting.current = false;
        setCloseBlocked(false);
        return;
      }
      expectedReceiptCustomerDisplayName = normalizeText(found.companyName || found.name);
      expectedOperationalCustomerName = normalizeText(found.name);
    } else {
      expectedReceiptCustomerDisplayName = normalizeText(newCustomer.companyName) || normalizeText(newCustomer.name);
      expectedOperationalCustomerName = normalizeText(newCustomer.name);
    }
    const formPayload: Omit<CreateOrderIntakeInput, "clientEventId"> = {
      customer: customerMode === "EXISTING"
        ? { mode: "EXISTING", customerId: selectedCustomerId }
        : {
            mode: "NEW",
            name: normalizeText(newCustomer.name),
            customerType: newCustomer.customerType,
            companyName: normalizeOptionalText(newCustomer.companyName),
            contactPerson: normalizeOptionalText(newCustomer.contactPerson),
            email: normalizeOptionalText(newCustomer.email),
            phone: normalizeOptionalText(newCustomer.phone),
            city: normalizeOptionalText(newCustomer.city),
          },
      dueDate,
      note: normalizeOptionalText(note),
      items: items.map((item) => ({
        name: normalizeText(item.name),
        quantity: Number(item.quantity),
        material: normalizeOptionalText(item.material),
        surfaceRequested: normalizeText(item.surfaceRequested),
      })),
    };
    const currentHash = canonicalFormHash(formPayload);
    const clientEventId = retryIntent.current && retryIntent.current.canonicalHash === currentHash
      ? retryIntent.current.clientEventId
      : crypto.randomUUID();
    retryIntent.current = { canonicalHash: currentHash, clientEventId };
    const input: CreateOrderIntakeInput = { clientEventId, ...formPayload };
    try {
      const result = await createOrderIntakeAction(input);
      if (result.code !== "OK") {
        setMessage(result.message);
        setPanelState(result.code === "CONFLICT" ? "conflict" : result.code === "FORBIDDEN" || result.code === "UNAUTHENTICATED" ? "denied" : "error");
        return;
      }
      if (!receiptMatchesSubmission(result.receipt, input, expectedReceiptCustomerDisplayName)) {
        setPanelState("error");
        setMessage("Gespeicherter Beleg stimmt nicht mit dem gesendeten Formularinhalt überein.");
        return;
      }
      setPanelState("confirming");
      setMessage("Gespeicherter Beleg und Arbeitsliste werden frisch bestätigt.");
      const [freshReceipt, freshOrders] = await Promise.all([
        getOrderIntakeReceiptAction({ orderId: result.receipt.orderId, clientEventId }),
        getWareneingangOrdersAction(),
      ]);
      if (!freshReceipt.ok || !freshReceipt.data || !sameReceipt(result.receipt, freshReceipt.data)) {
        setPanelState("error");
        setMessage("Speicherung konnte nicht durch einen frischen Readback bestätigt werden.");
        return;
      }
      const confirmedReceipt = freshReceipt.data;
      if (!freshOrders.ok) {
        setPanelState("error");
        setMessage("Speicherung konnte nicht durch einen frischen Readback bestätigt werden.");
        return;
      }
      const matchingOrders = freshOrders.data.filter((order) => {
        const canonicalDueDate = `${confirmedReceipt.dueDate}T00:00:00.000Z`;
        if (
          order.id !== confirmedReceipt.orderId
          || order.orderNumber !== confirmedReceipt.orderNumber
          || order.version !== 1
          || order.customerId !== confirmedReceipt.customerId
          || order.customerName !== expectedOperationalCustomerName
          || order.dueDate !== canonicalDueDate
          || order.station !== confirmedReceipt.station
          || order.currentStationId !== confirmedReceipt.station
          || order.status !== confirmedReceipt.status
        ) return false;
        const receiptItems = confirmedReceipt.items;
        if (order.parts.length !== receiptItems.length) return false;
        return receiptItems.every((receiptItem, index) => {
          const part = order.parts[index];
          return part.id === receiptItem.id
            && part.name === receiptItem.name
            && part.quantity === receiptItem.quantity
            && part.material === receiptItem.material
            && part.surfaceRequested === receiptItem.surfaceRequested;
        });
      });
      if (matchingOrders.length !== 1) {
        setPanelState("error");
        setMessage("Speicherung konnte nicht durch einen frischen Readback bestätigt werden.");
        return;
      }
      retryIntent.current = null;
      setReceipt(confirmedReceipt);
      setPanelState("success");
      setMessage(`Wareneingang ${confirmedReceipt.orderNumber} ist bestätigt.`);
      window.dispatchEvent(new CustomEvent("order-intake:created", { detail: { orderId: confirmedReceipt.orderId } }));
    } catch {
      setPanelState("error");
      setMessage("Wareneingang ist derzeit nicht sicher verfügbar.");
    } finally {
      submitting.current = false;
      setCloseBlocked(false);
    }
  };

  const uploadOriginal = async (itemId: string, file: File | undefined) => {
    if (!receipt || !file || uploadingItemId) return;
    if (!Object.hasOwn(MIME_EXTENSION, file.type) || file.size < 1 || file.size > MAX_FILE_BYTES) {
      setAttachmentMessages((current) => ({ ...current, [itemId]: "Nur JPEG, PNG oder WebP bis 12 MiB sind erlaubt." }));
      return;
    }
    setUploadingItemId(itemId);
    setCloseBlocked(true);
    setAttachmentMessages((current) => ({ ...current, [itemId]: "Original wird geprüft und reserviert." }));
    try {
      const { bytes, sha256 } = await readAndHash(file);
      const clientRequestId = crypto.randomUUID();
      const reserve = await reserveOrderIntakeAttachmentAction({
        orderId: receipt.orderId,
        itemId,
        expectedVersion: receipt.orderVersion,
        clientRequestId,
        mimeType: file.type as keyof typeof MIME_EXTENSION,
        fileBytes: bytes.byteLength,
        contentSha256: sha256,
      });
      if (reserve.code !== "OK" || reserve.data.receipt.state !== "PENDING" || !reserve.data.upload) {
        throw new Error(reserve.code === "CONFLICT" ? reserve.message : "Uploadfreigabe ist nicht verfügbar.");
      }
      const { receipt: pending, upload } = reserve.data;
      const expectedPath = `order-intake-evidence/v1/${pending.reservationId}.${MIME_EXTENSION[file.type as keyof typeof MIME_EXTENSION]}`;
      if (
        pending.orderId !== receipt.orderId || pending.itemId !== itemId || pending.orderVersion !== 1
        || pending.clientRequestId !== clientRequestId || pending.mimeType !== file.type
        || pending.fileBytes !== bytes.byteLength || pending.contentSha256 !== sha256
        || upload.path !== expectedPath || upload.token.trim().length === 0
      ) throw new Error("Uploadfreigabe stimmt nicht mit dem ausgewählten Original überein.");

      setAttachmentMessages((current) => ({ ...current, [itemId]: "Original wird unveränderlich hochgeladen." }));
      const uploaded = await supabase.storage.from("item-photos").uploadToSignedUrl(
        upload.path,
        upload.token,
        bytes,
        { contentType: file.type, upsert: false },
      );
      if (uploaded.error || uploaded.data?.path !== upload.path) throw new Error("Upload konnte nicht bestätigt werden.");

      const finalized = await finalizeOrderIntakeAttachmentAction({ reservationId: pending.reservationId });
      if (
        finalized.code !== "OK" || finalized.data.receipt.state !== "FINALIZED"
        || finalized.data.receipt.reservationId !== pending.reservationId
        || !finalized.data.receipt.receiptId || !finalized.data.receipt.verifiedAt
      ) throw new Error(finalized.code === "CONFLICT" ? finalized.message : "Originalbeleg konnte nicht bestätigt werden.");

      const fresh = await getOrderIntakeAttachmentsAction({ orderId: receipt.orderId, itemId });
      if (fresh.code !== "OK") throw new Error(fresh.message);
      const exact = fresh.data.receipts.filter((candidate) => (
        candidate.reservationId === pending.reservationId
        && candidate.receiptId === finalized.data.receipt.receiptId
        && candidate.state === "FINALIZED"
        && candidate.contentSha256 === sha256
        && candidate.fileBytes === bytes.byteLength
      ));
      const evidence = fresh.data.evidenceRecords.filter((candidate) => (
        candidate.source === "ORDER_INTAKE_ATTACHMENT"
        && candidate.sourceId === finalized.data.receipt.receiptId
        && candidate.original.hash === sha256
        && candidate.targets.some((target) => target.targetType === "ORDER_ITEM" && target.targetId === itemId)
      ));
      if (exact.length !== 1 || evidence.length !== 1) throw new Error("Frischer Originalbeleg ist nicht eindeutig bestätigt.");
      setAttachmentMessages((current) => ({ ...current, [itemId]: `Original bestätigt · ${file.name}` }));
    } catch (error) {
      setAttachmentMessages((current) => ({
        ...current,
        [itemId]: error instanceof Error ? error.message : "Original konnte nicht sicher gespeichert werden.",
      }));
    } finally {
      setUploadingItemId(null);
      setCloseBlocked(false);
    }
  };

  if (panelState === "loading") {
    return <div className="flex min-h-80 items-center justify-center gap-3 p-8" role="status"><Loader2 className="h-5 w-5 animate-spin" />{message}</div>;
  }
  if (panelState === "denied") {
    return <div className="p-8" role="alert"><AlertTriangle className="mb-3 h-7 w-7 text-amber-600" /><h2 className="text-xl font-semibold">Wareneingang nicht erlaubt</h2><p className="mt-2 text-sm text-slate-600">{message}</p></div>;
  }
  if (receipt) {
    return (
      <div className="space-y-6 p-5 sm:p-8">
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4" role="status">
          <CheckCircle2 className="mt-0.5 h-6 w-6 text-emerald-700" />
          <div><h2 className="text-xl font-semibold">{receipt.orderNumber} bestätigt</h2><p className="text-sm text-slate-600">{receipt.customerDisplayName} · {receipt.items.length} Teil(e) · Termin {receipt.dueDate}</p></div>
        </div>
        <section aria-labelledby="intake-originals-title">
          <div className="mb-3 flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-700" /><h3 id="intake-originals-title" className="font-semibold">Originalfotos sicher zuordnen</h3></div>
          <div className="space-y-3">
            {receipt.items.map((item) => (
              <div key={item.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div><p className="font-medium">{item.position}. {item.name}</p><p className="text-sm text-slate-500">{item.quantity} Stück · {item.surfaceRequested}</p></div>
                  <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                    {uploadingItemId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    Original wählen
                    <input
                      className="sr-only"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={uploadingItemId !== null}
                      onChange={(event) => { void uploadOriginal(item.id, event.currentTarget.files?.[0]); event.currentTarget.value = ""; }}
                    />
                  </label>
                </div>
                {attachmentMessages[item.id] ? <p className="mt-2 text-sm text-slate-600" role="status">{attachmentMessages[item.id]}</p> : null}
              </div>
            ))}
          </div>
        </section>
        <div className="flex justify-end"><button type="button" onClick={onClose} className="min-h-11 rounded-lg border border-slate-300 px-5 py-2 font-semibold">Schließen</button></div>
      </div>
    );
  }

  return (
    <form className="space-y-6 p-5 sm:p-8" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
      <header className="pr-10"><div className="mb-2 flex items-center gap-2"><PackagePlus className="h-6 w-6" /><h2 className="text-2xl font-semibold">Digitaler Wareneingang</h2></div><p className="text-sm text-slate-600">Kunde, Teile und Termin in einem bestätigten Auftrag erfassen.</p></header>

      <fieldset className="space-y-3"><legend className="font-semibold">1. Kunde</legend>
        <div className="flex gap-2">
          <button type="button" onClick={() => setCustomerMode("EXISTING")} aria-pressed={customerMode === "EXISTING"} className="min-h-11 rounded-lg border px-4 py-2 aria-pressed:border-slate-900 aria-pressed:bg-slate-100">Bestehend</button>
          <button type="button" disabled={!canCreateCustomer} onClick={() => setCustomerMode("NEW")} aria-pressed={customerMode === "NEW"} className="min-h-11 rounded-lg border px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50 aria-pressed:border-slate-900 aria-pressed:bg-slate-100">Neu anlegen</button>
        </div>
        {customerMode === "EXISTING" ? <>
          <label className="relative block"><Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" /><span className="sr-only">Kunden suchen</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, Nummer oder Ort" className="min-h-11 w-full rounded-lg border border-slate-300 py-2 pl-10 pr-3" /></label>
          {panelState === "empty" ? <div className="rounded-lg border border-dashed p-4 text-sm" role="status">{message}{canCreateCustomer ? " Jetzt neuen Kunden anlegen." : ""}</div> : null}
          {customers.length > 0 ? <select value={selectedCustomerId} onChange={(event) => setSelectedCustomerId(event.target.value)} className="min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2" aria-label="Kunde auswählen">{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.companyName || customer.name}{customer.customerNumber ? ` · ${customer.customerNumber}` : ""}{customer.city ? ` · ${customer.city}` : ""}</option>)}</select> : null}
        </> : <div className="grid gap-3 sm:grid-cols-2">
          <input required value={newCustomer.name} onChange={(event) => setNewCustomer((value) => ({ ...value, name: event.target.value }))} placeholder="Kundenname *" className="min-h-11 rounded-lg border px-3" />
          <select value={newCustomer.customerType} onChange={(event) => setNewCustomer((value) => ({ ...value, customerType: event.target.value as typeof value.customerType }))} className="min-h-11 rounded-lg border px-3"><option value="business">Unternehmen</option><option value="privat">Privat</option><option value="institution">Institution</option></select>
          <input value={newCustomer.companyName} onChange={(event) => setNewCustomer((value) => ({ ...value, companyName: event.target.value }))} placeholder="Firmenname" className="min-h-11 rounded-lg border px-3" />
          <input value={newCustomer.contactPerson} onChange={(event) => setNewCustomer((value) => ({ ...value, contactPerson: event.target.value }))} placeholder="Ansprechperson" className="min-h-11 rounded-lg border px-3" />
          <input type="email" value={newCustomer.email} onChange={(event) => setNewCustomer((value) => ({ ...value, email: event.target.value }))} placeholder="E-Mail" className="min-h-11 rounded-lg border px-3" />
          <input value={newCustomer.phone} onChange={(event) => setNewCustomer((value) => ({ ...value, phone: event.target.value }))} placeholder="Telefon" className="min-h-11 rounded-lg border px-3" />
          <input value={newCustomer.city} onChange={(event) => setNewCustomer((value) => ({ ...value, city: event.target.value }))} placeholder="Ort" className="min-h-11 rounded-lg border px-3 sm:col-span-2" />
        </div>}
      </fieldset>

      <fieldset className="space-y-3"><div className="flex items-center justify-between"><legend className="font-semibold">2. Teile</legend><button type="button" disabled={items.length >= 20} onClick={() => setItems((value) => [...value, newDraftItem()])} className="inline-flex min-h-11 items-center gap-1 rounded-lg border px-3 text-sm"><Plus className="h-4 w-4" />Teil</button></div>
        {items.map((item, index) => <div key={item.key} className="grid gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-12">
          <p className="font-semibold sm:col-span-12">Teil {index + 1}</p>
          <input required value={item.name} onChange={(event) => updateItem(item.key, "name", event.target.value)} placeholder="Bezeichnung *" className="min-h-11 rounded-lg border px-3 sm:col-span-4" />
          <input required inputMode="numeric" value={item.quantity} onChange={(event) => updateItem(item.key, "quantity", event.target.value)} placeholder="Menge *" className="min-h-11 rounded-lg border px-3 sm:col-span-2" />
          <input value={item.material} onChange={(event) => updateItem(item.key, "material", event.target.value)} placeholder="Werkstoff" className="min-h-11 rounded-lg border px-3 sm:col-span-2" />
          <input required value={item.surfaceRequested} onChange={(event) => updateItem(item.key, "surfaceRequested", event.target.value)} placeholder="Oberfläche / Behandlung *" className="min-h-11 rounded-lg border px-3 sm:col-span-3" />
          <button type="button" aria-label={`Teil ${index + 1} entfernen`} disabled={items.length === 1} onClick={() => setItems((value) => value.filter((candidate) => candidate.key !== item.key))} className="min-h-11 rounded-lg border px-3 disabled:opacity-40 sm:col-span-1"><Trash2 className="mx-auto h-4 w-4" /></button>
        </div>)}
      </fieldset>

      <fieldset className="grid gap-3 sm:grid-cols-2"><legend className="mb-3 font-semibold sm:col-span-2">3. Termin und Hinweis</legend><label className="text-sm">Wunschtermin *<input type="date" required value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border px-3" /></label><label className="text-sm">Interner Hinweis<textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} className="mt-1 min-h-24 w-full rounded-lg border p-3" /></label></fieldset>

      {(panelState === "error" || panelState === "conflict") ? <div className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm" role="alert"><AlertTriangle className="h-5 w-5 shrink-0" />{message}</div> : null}
      {(panelState === "submitting" || panelState === "confirming") ? <div className="flex gap-2 text-sm" role="status"><Loader2 className="h-5 w-5 animate-spin" />{message}</div> : null}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={onClose} disabled={panelState === "submitting" || panelState === "confirming"} className="min-h-11 rounded-lg border px-5 font-semibold">Abbrechen</button><button type="submit" disabled={!formValid || panelState === "submitting" || panelState === "confirming"} className="min-h-11 rounded-lg bg-slate-900 px-5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Wareneingang anlegen</button></div>
    </form>
  );
}
