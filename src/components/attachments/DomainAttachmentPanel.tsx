"use client";

import { FileText, Image as ImageIcon, Loader2, Paperclip } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { getDomainAttachmentOriginalAction, getDomainAttachmentsAction } from "@/app/actions/domainAttachments.actions";
import { getIntakeCaptureAction, openIntakeOriginalAction } from "@/app/actions/eingang.actions";
import { usePermissions } from "@/lib/auth/PermissionsContext";
import { retainPendingOriginal } from "@/lib/offline/pendingStore";
import { syncOriginals } from "@/lib/offline/syncOriginals";
import { getIntakeDeviceId, type IntakeFileContext } from "@/modules/eingang/public";
import { INTAKE_FILE_CONTEXT_COPY } from "@/ui/eingangCopy";
import styles from "./DomainAttachmentPanel.module.css";

const ACCEPTED = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const MAX_BYTES = 20 * 1024 * 1024;

type Attachment = { attachmentId: string; mimeType: string | null; fileBytes: number | null; recordedAt: string; intakeOriginal?:true; intakeItemId?:string; intakeName?:string; intakePart?:number; intakeTotal?:number; intakeSecured?:boolean };
function sizeLabel(bytes: number | null) {
  if (bytes === null) return "Größe nicht verfügbar";
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export async function uploadDomainAttachment(targetType:'CUSTOMER'|'ORDER',targetId:string,file:File,scope:string|null) {
  if(!ACCEPTED.has(file.type)||file.size<1||file.size>MAX_BYTES)throw Error('Erlaubt sind PDF, JPG, PNG und WebP bis 20 MB.');
  return uploadContextOriginal(targetType==='ORDER'?{auftragId:targetId}:{kundeId:targetId},file,scope);
}

/** The cards and the workshop use the same original queue and read-back. */
export async function uploadContextOriginal(kontext:IntakeFileContext,file:File,scope:string|null) {
  if(!scope)return {code:'FORBIDDEN' as const,message:INTAKE_FILE_CONTEXT_COPY.contextForbidden};
  const itemId=crypto.randomUUID(),id=crypto.randomUUID();
  await retainPendingOriginal(scope,{id,itemId,kind:'file',file,deviceId:getIntakeDeviceId(),kontext});
  const pending={code:'PENDING' as const,message:INTAKE_FILE_CONTEXT_COPY.pending};
  if(!navigator.onLine)return pending;
  try{
    await syncOriginals(scope,()=>scope,{followUp:true});
    const source=await getIntakeCaptureAction(itemId,kontext.auftragId?{orderId:kontext.auftragId}:{customerId:kontext.kundeId});
    return source.code==='OK'&&source.capture.files.some(original=>original.id===id&&original.secured)
      ?{code:'OK' as const,id}:pending;
  }catch{return pending;}
}

export function DomainAttachmentPanel({ targetType, targetId }: { targetType: "CUSTOMER" | "ORDER"; targetId: string }) {
  const input = useRef<HTMLInputElement>(null);
  const { offlineScope, hasPermission, hasArea } = usePermissions();
  const [items, setItems] = useState<Attachment[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "uploading" | "error">("loading");
  const [message, setMessage] = useState("");
  const mayUpload=offlineScope!==null&&hasPermission('perm_op_photos')&&hasArea(targetType==='ORDER'?'auftraege':'kunden');

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

  const choose = async (file: File | undefined) => {
    if (!file||!mayUpload) return;
    if (!ACCEPTED.has(file.type) || file.size < 1 || file.size > MAX_BYTES) {
      setState("error"); setMessage("Erlaubt sind PDF, JPG, PNG und WebP bis 20 MB."); return;
    }
    setState("uploading"); setMessage("Datei wird sicher gespeichert …");
    try {
      const result=await uploadDomainAttachment(targetType,targetId,file,offlineScope);
      if(result.code==='OK')await load();
      else {setState(result.code==='PENDING'?'ready':'error');setMessage(result.message);}
    } catch (error) {
      setState("error"); setMessage(error instanceof Error ? error.message : "Datei konnte nicht sicher gespeichert werden.");
    } finally {
      if (input.current) input.current.value = "";
    }
  };

  const open = async (item: Attachment) => {
    const result = item.intakeOriginal
      ? await openIntakeOriginalAction({fileId:item.attachmentId,clientEventId:crypto.randomUUID(),
        ...(targetType==='ORDER'?{orderId:targetId}:{customerId:targetId})})
      : await getDomainAttachmentOriginalAction({ attachmentId:item.attachmentId });
    if (result.code !== "OK") { setState("error"); setMessage(result.message); return; }
    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    try {
      const downloadUrl='original' in result?result.original.downloadUrl:result.data.downloadUrl;
      if(!downloadUrl)throw new Error("Original ist nicht zum Öffnen freigegeben.");
      const url = new URL(downloadUrl);
      if (!baseUrl || url.origin !== new URL(baseUrl).origin || !url.pathname.includes("/storage/v1/object/sign/scans/")) throw new Error();
      window.open(url.toString(), "_blank", "noopener,noreferrer");
    } catch {
      setState("error"); setMessage("Der sichere Download-Link ist ungültig.");
    }
  };

  return <section className={styles.panel} aria-label="Fotos und Dokumente" data-domain-uploading={state==='uploading'?'true':undefined}>
    <header><div><p>Privater Ablageort</p><h3>Fotos & Dokumente</h3></div><button type="button" onClick={() => input.current?.click()} disabled={state === "uploading"||!mayUpload}><Paperclip />Hinzufügen</button></header>
    <input ref={input} className={styles.file} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => void choose(event.target.files?.[0])} />
    {state === "loading" || state === "uploading" ? <p className={styles.status} role="status"><Loader2 />{message || "Dokumente werden geladen …"}</p> : null}
    {state === "error" || (message && state === "ready") ? <p className={styles.error} role="alert">{message}</p> : null}
    {state === "ready" && items.length === 0 ? <p className={styles.empty}>Noch keine Fotos oder Dokumente hinterlegt.</p> : null}
    {items.length ? <ol>{items.map((item) => <li key={`${item.intakeItemId??'scan'}:${item.attachmentId}`} className={styles.documentItem}>
      <span className={styles.icon}>{item.mimeType === "application/pdf" ? <FileText /> : <ImageIcon />}</span>
      <span><strong>{item.intakeName??(item.mimeType === "application/pdf" ? "PDF-Dokument" : "Foto")}</strong><small>{item.intakeOriginal?`Aus Eingang · Beleg ${item.intakePart}/${item.intakeTotal} · `:''}{sizeLabel(item.fileBytes)} · {new Date(item.recordedAt).toLocaleString("de-DE")}</small>{item.intakeOriginal&&!item.intakeSecured?<small>Original ist noch nicht sicher gespeichert.</small>:null}</span>
      <div className={styles.documentActions}><button type="button" disabled={item.intakeOriginal&&!item.intakeSecured} onClick={() => void open(item)}>Öffnen</button></div>
    </li>)}</ol> : null}
  </section>;
}
