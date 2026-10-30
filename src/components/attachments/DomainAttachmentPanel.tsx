"use client";

import { Check, FileSearch, FileText, Image as ImageIcon, Loader2, Paperclip } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  analyzeDomainAttachmentAction,
  finalizeDomainAttachmentAction,
  getDocumentIntelligenceStatusAction,
  getDomainAttachmentOriginalAction,
  getDomainAttachmentsAction,
  reserveDomainAttachmentAction,
} from "@/app/actions/domainAttachments.actions";
import { requestGlobalCreate } from "@/components/layout/globalCreateRequest";
import styles from "./DomainAttachmentPanel.module.css";

const ACCEPTED = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const MAX_BYTES = 20 * 1024 * 1024;

type Attachment = { attachmentId: string; mimeType: string | null; fileBytes: number | null; recordedAt: string };
type Analysis = Extract<Awaited<ReturnType<typeof analyzeDomainAttachmentAction>>, { code: "OK" }>["data"];

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes.slice().buffer as ArrayBuffer);
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
}

async function uploadSigned(path: string, token: string, mimeType: string, bytes: Uint8Array) {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!baseUrl) throw new Error("SIGNED_UPLOAD_CONFIGURATION_INVALID");
  const endpoint = new URL(`/storage/v1/object/upload/sign/scans/${path}`, baseUrl);
  endpoint.searchParams.set("token", token);
  const response = await fetch(endpoint, {
    method: "PUT",
    headers: { "cache-control": "max-age=3600", "content-type": mimeType, "x-upsert": "false" },
    body: new Blob([bytes.slice().buffer as ArrayBuffer], { type: mimeType }),
  });
  if (!response.ok) throw new Error("SIGNED_UPLOAD_FAILED");
  const payload = await response.json() as { Key?: unknown };
  if (payload.Key !== `scans/${path}`) throw new Error("SIGNED_UPLOAD_READBACK_MISMATCH");
}

function sizeLabel(bytes: number | null) {
  if (bytes === null) return "Größe nicht verfügbar";
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function DomainAttachmentPanel({ targetType, targetId }: { targetType: "CUSTOMER" | "ORDER"; targetId: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Attachment[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "uploading" | "error">("loading");
  const [message, setMessage] = useState("");
  const [azure, setAzure] = useState<"loading" | "ready" | "in-klärung">("loading");
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Record<string, Analysis>>({});
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    const result = await getDomainAttachmentsAction({ targetType, targetId });
    if (result.code !== "OK") {
      setState("error"); setMessage(result.message); return;
    }
    setItems(result.data);
    setState("ready");
    setMessage("");
  }, [targetId, targetType]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    let active = true;
    void getDocumentIntelligenceStatusAction().then((result) => {
      if (active) setAzure(result.code === "OK" ? "ready" : "in-klärung");
    });
    return () => { active = false; };
  }, []);

  const choose = async (file: File | undefined) => {
    if (!file) return;
    if (!ACCEPTED.has(file.type) || file.size < 1 || file.size > MAX_BYTES) {
      setState("error"); setMessage("Erlaubt sind PDF, JPG, PNG und WebP bis 20 MB."); return;
    }
    setState("uploading"); setMessage("Datei wird sicher gespeichert …");
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const contentSha256 = await sha256(bytes);
      const reserved = await reserveDomainAttachmentAction({ targetType, targetId, clientRequestId: crypto.randomUUID(), mimeType: file.type, fileBytes: bytes.byteLength, contentSha256 });
      if (reserved.code !== "OK") throw new Error(reserved.message);
      if (!reserved.data.upload) throw new Error("Uploadfreigabe fehlt.");
      await uploadSigned(reserved.data.upload.path, reserved.data.upload.token, file.type, bytes);
      const finalized = await finalizeDomainAttachmentAction({ attachmentId: reserved.data.receipt.attachmentId, fileBytes: bytes.byteLength, contentSha256 });
      if (finalized.code !== "OK") throw new Error(finalized.message);
      await load();
    } catch (error) {
      setState("error"); setMessage(error instanceof Error ? error.message : "Datei konnte nicht sicher gespeichert werden.");
    } finally {
      if (input.current) input.current.value = "";
    }
  };

  const open = async (attachmentId: string) => {
    const result = await getDomainAttachmentOriginalAction({ attachmentId });
    if (result.code !== "OK") { setState("error"); setMessage(result.message); return; }
    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    try {
      const url = new URL(result.data.downloadUrl);
      if (!baseUrl || url.origin !== new URL(baseUrl).origin || !url.pathname.includes("/storage/v1/object/sign/scans/")) throw new Error();
      window.open(url.toString(), "_blank", "noopener,noreferrer");
    } catch {
      setState("error"); setMessage("Der sichere Download-Link ist ungültig.");
    }
  };

  const analyze = async (attachmentId: string) => {
    setAnalyzing(attachmentId); setMessage("");
    const result = await analyzeDomainAttachmentAction({ attachmentId, targetType, targetId });
    setAnalyzing(null);
    if (result.code !== "OK") { setMessage(result.message); return; }
    setAnalysis((current) => ({ ...current, [attachmentId]: result.data }));
    setSelected((current) => ({ ...current, ...Object.fromEntries(result.data.suggestions.map((_, index) => [`${attachmentId}:${index}`, false])) }));
  };

  const openQuoteReview = (attachmentId: string) => {
    const result = analysis[attachmentId];
    if (!result) return;
    const chosen = result.suggestions.filter((_, index) => selected[`${attachmentId}:${index}`]);
    if (!chosen.length) { setMessage("Bitte mindestens einen Vorschlagswert aktiv bestätigen."); return; }
    const line = (item: (typeof chosen)[number]) => `${item.label}: ${item.value} (Seite ${item.source.page}, Sicherheit ${Math.round(item.confidence * 100)} %)`;
    const quantity = chosen.find((item) => item.field === "QUANTITY")?.value;
    const material = chosen.find((item) => item.field === "MATERIAL")?.value;
    const dueDate = chosen.find((item) => item.field === "DUE_DATE")?.value;
    requestGlobalCreate({ intent: "QUOTE", prefill: {
      customerQuery: result.customerName ?? undefined,
      note: `Bestätigte Dokumentvorschläge:\n${chosen.map(line).join("\n")}`,
      dueDate: dueDate && /^\d{4}-\d{2}-\d{2}$/.test(dueDate) ? dueDate : undefined,
      quotePositions: quantity || material ? [{ quantity, material }] : undefined,
    } });
  };

  return <section className={styles.panel} aria-label="Fotos und Dokumente">
    <header><div><p>Privater Ablageort</p><h3>Fotos & Dokumente</h3></div><button type="button" onClick={() => input.current?.click()} disabled={state === "uploading"}><Paperclip />Hinzufügen</button></header>
    <input ref={input} className={styles.file} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => void choose(event.target.files?.[0])} />
    {state === "loading" || state === "uploading" ? <p className={styles.status} role="status"><Loader2 />{message || "Dokumente werden geladen …"}</p> : null}
    {state === "error" || (message && state === "ready") ? <p className={styles.error} role="alert">{message}</p> : null}
    {state === "ready" && items.length === 0 ? <p className={styles.empty}>Noch keine Fotos oder Dokumente hinterlegt.</p> : null}
    {items.length ? <ol>{items.map((item) => <li key={item.attachmentId} className={styles.documentItem}>
      <span className={styles.icon}>{item.mimeType === "application/pdf" ? <FileText /> : <ImageIcon />}</span>
      <span><strong>{item.mimeType === "application/pdf" ? "PDF-Dokument" : "Foto"}</strong><small>{sizeLabel(item.fileBytes)} · {new Date(item.recordedAt).toLocaleString("de-DE")}</small></span>
      <div className={styles.documentActions}><button type="button" onClick={() => void open(item.attachmentId)}>Öffnen</button><button type="button" disabled={azure !== "ready" || analyzing === item.attachmentId} onClick={() => void analyze(item.attachmentId)}>{analyzing === item.attachmentId ? <Loader2 className={styles.spin} /> : <FileSearch />}Auslesen</button></div>
      {analysis[item.attachmentId] ? <div className={styles.suggestions}><strong>Vorschläge aus dem Dokument</strong>{analysis[item.attachmentId].suggestions.length ? <>{analysis[item.attachmentId].suggestions.map((suggestion, index) => <label key={`${suggestion.field}:${index}`}><input type="checkbox" checked={Boolean(selected[`${item.attachmentId}:${index}`])} onChange={(event) => setSelected((current) => ({ ...current, [`${item.attachmentId}:${index}`]: event.target.checked }))} /><span><b>{suggestion.label}</b><em>{suggestion.value}</em><small>Seite {suggestion.source.page} · Sicherheit {Math.round(suggestion.confidence * 100)} %</small></span></label>)}<button type="button" onClick={() => openQuoteReview(item.attachmentId)}><Check />Ausgewählte Werte in KV prüfen</button></> : <p>Azure hat keine belastbaren Schlüsselfelder vorgeschlagen.</p>}</div> : null}
    </li>)}</ol> : null}
    {azure === "in-klärung" ? <p className={styles.empty}>Dokument lesen · In Klärung</p> : null}
  </section>;
}
