"use client";

import { FileText, Loader2, Mail } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  analyzeDomainAttachmentAction,
  finalizeDomainAttachmentAction,
  reserveDomainAttachmentAction,
} from "@/app/actions/domainAttachments.actions";
import { attachOutlookMailAction, getMicrosoftGraphStatusAction, listOutlookInboxAction } from "@/app/actions/communications.actions";
import { getCustomersDb } from "@/app/actions/customers.actions";
import { getOrdersDb } from "@/app/actions/orders.actions";
import { Button, Checkbox, Dialog, Hinweis } from "@/ui/kr";
import styles from "./TargetShell.module.css";

const ACCEPTED = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const MAX_BYTES = 20 * 1024 * 1024;
type InboxMessage = Extract<Awaited<ReturnType<typeof listOutlookInboxAction>>, { code: "OK" }>["data"][number];
export type F1MailCustomerChoice = {
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
type CustomerChoice = F1MailCustomerChoice;
type Suggestion = { field: string; label: string; value: string; confidence: number; source: { page: number } };

export type F1SourceMode = "camera" | "document" | "mail";

type Props = {
  mode: F1SourceMode;
  graphMessageId?: string | null;
  canUseMail: boolean;
  customerId: string | null;
  onClose: () => void;
  onMode: (mode: F1SourceMode) => void;
  onAttachment: (attachmentId: string) => void;
  onDocument: (suggestions: Suggestion[]) => void;
  onMail: (mail: InboxMessage, customer: F1MailCustomerChoice | null) => void;
  onNewCustomer: (mail: InboxMessage) => void;
};

async function sha256(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", bytes.slice().buffer as ArrayBuffer);
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
}

async function uploadSigned(path: string, token: string, mimeType: string, bytes: Uint8Array) {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!baseUrl) throw new Error("Private Ablage ist nicht konfiguriert.");
  const endpoint = new URL(`/storage/v1/object/upload/sign/scans/${path}`, baseUrl);
  endpoint.searchParams.set("token", token);
  const response = await fetch(endpoint, {
    method: "PUT",
    headers: { "cache-control": "max-age=3600", "content-type": mimeType, "x-upsert": "false" },
    body: new Blob([bytes.slice().buffer as ArrayBuffer], { type: mimeType }),
  });
  if (!response.ok) throw new Error("Das Original konnte nicht sicher hochgeladen werden.");
}

export function F1SourceDialogs(props: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [fileName, setFileName] = useState("");
  const [attachmentId, setAttachmentId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [reviewed, setReviewed] = useState(false);
  const [inbox, setInbox] = useState<InboxMessage[]>([]);
  const [mailState, setMailState] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [customers, setCustomers] = useState<CustomerChoice[]>([]);
  const [customerByMail, setCustomerByMail] = useState<Record<string, string>>({});
  const [orders, setOrders] = useState<Array<{ id: string; orderNumber: string }>>([]);
  const [orderByMail, setOrderByMail] = useState<Record<string, string>>({});

  useEffect(() => {
    if (props.mode !== "camera") return;
    let active = true;
    void navigator.mediaDevices?.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false }).then((next) => {
      if (!active) { next.getTracks().forEach((track) => track.stop()); return; }
      stream.current = next;
      if (video.current) video.current.srcObject = next;
    }).catch(() => {
      setMessage("Keine Kamera freigegeben. Bitte Datei wählen.");
      fileInput.current?.click();
    });
    return () => {
      active = false;
      stream.current?.getTracks().forEach((track) => track.stop());
      stream.current = null;
    };
  }, [props.mode]);

  useEffect(() => {
    if (props.mode !== "mail" || !props.canUseMail) return;
    let active = true;
    void Promise.all([getMicrosoftGraphStatusAction(), getOrdersDb(), getCustomersDb()]).then(async ([status, orderResult, customerResult]) => {
      if (!active) return;
      setOrders(orderResult.ok ? orderResult.data.map((entry) => ({ id: entry.id, orderNumber: entry.orderNumber })) : []);
      const nextCustomers = customerResult.ok ? customerResult.data.map((entry) => ({
        id: entry.id,
        customerNumber: entry.customerNumber,
        name: entry.name,
        customerType: entry.type === "private" || entry.type === "Privatkunde"
          ? "privat" as const
          : entry.type === "institution" || entry.type === "Institution"
            ? "institution" as const
            : "business" as const,
        companyName: entry.companyName ?? null,
        contactPerson: entry.contactPerson ?? null,
        email: entry.email ?? null,
        phone: entry.phone ?? null,
        street: entry.street ?? "",
        zipCode: entry.zipCode ?? "",
        city: entry.city ?? null,
        country: entry.country ?? "Deutschland",
        paymentPreference: entry.paymentPreference ?? "",
        vatId: entry.vatId ?? null,
        lastHandoverMode: entry.lastHandoverMode,
      })) : [];
      setCustomers(nextCustomers);
      if (status.code !== "OK") { setMessage(status.message); setMailState("error"); return; }
      const result = await listOutlookInboxAction();
      if (!active) return;
      if (result.code !== "OK") { setMessage(result.message); setMailState("error"); return; }
      const visibleInbox = props.graphMessageId
        ? result.data.filter((mail) => mail.id === props.graphMessageId)
        : result.data;
      if (props.graphMessageId && visibleInbox.length === 0) {
        setInbox([]);
        setMessage("Die ausgewählte Mail ist nicht mehr im Postfach verfügbar.");
        setMailState("error");
        return;
      }
      setInbox(visibleInbox);
      setCustomerByMail(Object.fromEntries(visibleInbox.map((mail) => {
        const senderAddress = mail.senderAddress.trim().toLowerCase();
        const exactMatches = nextCustomers.filter((customer) => customer.email?.trim().toLowerCase() === senderAddress);
        const exact = exactMatches.length === 1 ? exactMatches[0] : undefined;
        return [mail.id, props.customerId ?? exact?.id ?? ""];
      })));
      setMailState(visibleInbox.length ? "ready" : "empty");
    }).catch(() => {
      if (active) { setMessage("Postfach nicht erreichbar · In Klärung"); setMailState("error"); }
    });
    return () => { active = false; };
  }, [props.canUseMail, props.customerId, props.graphMessageId, props.mode]);

  const storeFile = async (file: File | undefined) => {
    if (!file) return;
    if (!ACCEPTED.has(file.type) || file.size < 1 || file.size > MAX_BYTES) {
      setMessage("Erlaubt sind PDF, JPG, PNG und WebP bis 20 MB.");
      return;
    }
    setBusy(true); setMessage("Original wird gesichert …"); setFileName(file.name);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const contentSha256 = await sha256(bytes);
      const reserved = await reserveDomainAttachmentAction({
        targetType: "INTAKE_DRAFT", targetId: "pending", clientRequestId: crypto.randomUUID(),
        mimeType: file.type as "image/jpeg" | "image/png" | "image/webp" | "application/pdf",
        fileBytes: bytes.byteLength, contentSha256,
      });
      if (reserved.code !== "OK" || !reserved.data.upload) throw new Error(reserved.code === "OK" ? "Uploadfreigabe fehlt." : reserved.message);
      await uploadSigned(reserved.data.upload.path, reserved.data.upload.token, file.type, bytes);
      const finalized = await finalizeDomainAttachmentAction({ attachmentId: reserved.data.receipt.attachmentId, fileBytes: bytes.byteLength, contentSha256 });
      if (finalized.code !== "OK") throw new Error(finalized.message);
      const id = finalized.data.receipt.attachmentId;
      setAttachmentId(id);
      props.onAttachment(id);
      props.onMode("document");
      setMessage("Original gesichert. Vorschläge werden gelesen …");
      const analyzed = await analyzeDomainAttachmentAction({ attachmentId: id, targetType: "INTAKE_DRAFT", targetId: id });
      if (analyzed.code !== "OK") { setSuggestions([]); setMessage(`${analyzed.message} Das Original bleibt gesichert.`); return; }
      setSuggestions(analyzed.data.suggestions);
      setSelected(Object.fromEntries(analyzed.data.suggestions.map((_, index) => [index, false])));
      setMessage(analyzed.data.suggestions.length ? "Vorschläge bitte am Original prüfen." : "Keine belastbaren Vorschläge erkannt. Bitte manuell erfassen.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Datei konnte nicht sicher gespeichert werden.");
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const capture = async () => {
    const source = video.current;
    if (!source || source.videoWidth < 1 || source.videoHeight < 1) { fileInput.current?.click(); return; }
    const canvas = document.createElement("canvas");
    canvas.width = source.videoWidth; canvas.height = source.videoHeight;
    canvas.getContext("2d")?.drawImage(source, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
    if (!blob) { setMessage("Aufnahme fehlgeschlagen. Bitte erneut versuchen."); return; }
    await storeFile(new File([blob], `Eingang-${new Date().toISOString().replace(/[:.]/g, "-")}.jpg`, { type: "image/jpeg" }));
  };

  const attachMail = async (mail: InboxMessage, targetType: "CUSTOMER" | "ORDER", targetId: string) => {
    if (!targetId) { setMessage(targetType === "CUSTOMER" ? "Bitte zuerst einen vorhandenen Kunden wählen." : "Bitte einen Auftrag wählen."); return; }
    setBusy(true); setMessage("");
    const result = await attachOutlookMailAction({ targetType, targetId, graphMessageId: mail.id });
    setBusy(false);
    setMessage(result.code === "OK" ? "Mail und unterstützte Anhänge sind am Vorgang abgelegt." : result.message);
  };

  const input = <input ref={fileInput} className={styles.f1HiddenFile} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => void storeFile(event.target.files?.[0])} />;

  if (props.mode === "camera") return <Dialog titel="Beleg / Foto aufnehmen" icon="camera" groesse="breit" onSchliessen={props.onClose} fuss={<>
    <Button data-spec-id="kamera.schliessen" text="Schließen" onClick={props.onClose} />
    <Button data-spec-id="kamera.datei-wahlen" icon="upload" text="Datei wählen" onClick={() => fileInput.current?.click()} />
    <Button data-spec-id="kamera.auslosen" art="primaer" icon="camera" text="Auslösen" disabled={busy} onClick={() => void capture()} />
  </>}>
    {input}
    <div className={styles.f1Camera}><video ref={video} autoPlay playsInline muted /><span>Zettel, Etikett oder Karte im Rahmen ausrichten</span></div>
    {message ? <Hinweis ton="warn">{message}</Hinweis> : null}
  </Dialog>;

  if (props.mode === "document") return <Dialog titel="Beleg prüfen" icon="scan" groesse="breit" onSchliessen={props.onClose} fuss={<>
    <Button data-spec-id="beleg.abbrechen" text="Abbrechen" onClick={props.onClose} />
    <Button data-spec-id="beleg.manuell-erfassen" text="Manuell erfassen" onClick={props.onClose} />
    <Button data-spec-id="beleg.in-neuer-eingang-ubernehmen" art="primaer" icon="check" text="In Neuer Eingang übernehmen" disabled={!reviewed || !suggestions.some((_, index) => selected[index])} onClick={() => {
      props.onDocument(suggestions.filter((_, index) => selected[index])); props.onClose();
    }} />
  </>}>
    {input}
    {!attachmentId ? <div className={styles.f1DocumentEmpty}><FileText /><p>Beleg wählen oder fotografieren</p><Button icon="upload" text="Datei wählen" disabled={busy} onClick={() => fileInput.current?.click()} /></div> : <div className={styles.f1DocumentGrid}>
      <section><h3>Original</h3><p>{fileName || "Gesichertes Original"}</p><small>gesichert · unverändert</small></section>
      <section><h3>Vorschläge</h3>{suggestions.map((item, index) => <label key={`${item.field}:${index}`} className={styles.f1Suggestion}><input type="checkbox" checked={Boolean(selected[index])} onChange={(event) => setSelected((current) => ({ ...current, [index]: event.target.checked }))} /><span><b>{item.label}</b><em>{item.value}</em><small>Seite {item.source.page} · Sicherheit {Math.round(item.confidence * 100)} %</small></span></label>)}</section>
    </div>}
    <div data-spec-id="beleg.geprueft"><Checkbox checked={reviewed} onChange={setReviewed}>Am Original geprüft</Checkbox></div>
    {message ? <Hinweis ton={suggestions.length ? undefined : "warn"}>{busy ? <Loader2 /> : null}{message}</Hinweis> : null}
  </Dialog>;

  return <Dialog titel="Mail zuordnen" icon="mail" groesse="breit" onSchliessen={props.onClose}>
    {!props.canUseMail ? <Hinweis ton="warn">Mails sind für dieses Profil nicht freigegeben.</Hinweis> : mailState === "loading" ? <Hinweis><Loader2 /> Postfach wird gelesen …</Hinweis> : mailState === "error" ? <Hinweis ton="warn">{message}</Hinweis> : mailState === "empty" ? <Hinweis>Keine neuen Mails.</Hinweis> : <div className={styles.f1MailList}>{inbox.map((mail) => {
      const customerId = customerByMail[mail.id] ?? "";
      const orderId = orderByMail[mail.id] ?? "";
      return <article key={mail.id}>
        <header><Mail /><div><strong>{mail.subject}</strong><small>{mail.senderName} · {mail.senderAddress}</small></div></header>
        <p>{mail.preview || "Keine Vorschau vorhanden."}</p>
        <div className={styles.f1MailActions}>
          <Button data-spec-id="mailein.neuer-eingang-aus-mail" art="primaer" icon="inbox" text="Neuer Eingang aus Mail" onClick={() => {
            props.onMail(mail, customers.find((customer) => customer.id === customerId) ?? null);
            props.onClose();
          }} />
          <select aria-label={`Kunde für ${mail.subject} wählen`} value={customerId} onChange={(event) => setCustomerByMail((current) => ({ ...current, [mail.id]: event.target.value }))}><option value="">Kunde wählen</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.customerNumber} · {customer.name}</option>)}</select>
          <Button data-spec-id="mailein.kunde-zuordnen" text="Kunde zuordnen" disabled={busy || !customerId} onClick={() => void attachMail(mail, "CUSTOMER", customerId)} />
          <select aria-label={`Auftrag für ${mail.subject} wählen`} value={orderId} onChange={(event) => setOrderByMail((current) => ({ ...current, [mail.id]: event.target.value }))}><option value="">Auftrag wählen</option>{orders.map((order) => <option key={order.id} value={order.id}>{order.orderNumber}</option>)}</select>
          <Button data-spec-id="mailein.auftrag-zuordnen" text="Auftrag zuordnen" disabled={busy || !orderId} onClick={() => void attachMail(mail, "ORDER", orderId)} />
          <Button data-spec-id="mailein.neukunde-aus-absender" text="Neukunde aus Absender" onClick={() => { props.onNewCustomer(mail); props.onClose(); }} />
          <Button data-spec-id="mailein.spater" text="Später" onClick={props.onClose} />
        </div>
      </article>;
    })}</div>}
    {message && mailState === "ready" ? <Hinweis>{message}</Hinweis> : null}
  </Dialog>;
}
