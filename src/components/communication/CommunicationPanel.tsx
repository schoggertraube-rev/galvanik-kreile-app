"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AtSign, Inbox, Loader2, MailPlus, Paperclip, Send } from "lucide-react";
import {
  attachOutlookMailAction,
  importOutlookMailAction,
  getMicrosoftGraphStatusAction,
  listOutlookInboxAction,
  sendCustomerMailAction,
} from "@/app/actions/communications.actions";
import { listOpenQuotesAction } from "@/app/actions/quotes.actions";
import { requestGlobalCreate } from "@/components/layout/GlobalCreateFlow";
import type { QuoteReadback } from "@/modules/quotes/public";
import styles from "./CommunicationPanel.module.css";

type Target = { targetType: "CUSTOMER" | "ORDER"; targetId: string };
type Composer={subject:string;body:string;onSubject:(value:string)=>void;onBody:(value:string)=>void;onSend:()=>void;busy:boolean};
type InboxMessage = {
  id: string;
  subject: string;
  senderName: string;
  senderAddress: string;
  receivedAt: string;
  preview: string;
  body: string;
  hasAttachments: boolean | null;
};

export function CommunicationPanel({ targetType, targetId,composer }: Target & {composer?:Composer}) {
  const [state, setState] = useState<"loading" | "ready" | "in-klärung" | "error">("loading");
  const [message, setMessage] = useState("");
  const [inbox, setInbox] = useState<InboxMessage[]>([]);
  const [quotes, setQuotes] = useState<QuoteReadback[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [sendBusy, setSendBusy] = useState(false);
  const [feedback, setFeedback] = useState("");

  const matchingQuotes = useMemo(() => quotes.filter((quote) => targetType === "CUSTOMER"
    ? quote.customerId === targetId
    : quote.linkedOrderId === targetId), [quotes, targetId, targetType]);

  useEffect(() => {
    if(composer)return;
    let active = true;
    const load = async () => {
      const status = await getMicrosoftGraphStatusAction();
      if (!active) return;
      if (status.code === "IN_KLAERUNG") {
        setState("in-klärung");
        setMessage(status.message);
        return;
      }
      if (status.code !== "OK") {
        setState("error");
        setMessage(status.message);
        return;
      }
      const [mail, quoteResult] = await Promise.all([
        targetType === "ORDER"
          ? listOutlookInboxAction({ targetType, targetId })
          : listOutlookInboxAction(),
        listOpenQuotesAction(),
      ]);
      if (!active) return;
      if (mail.code !== "OK") {
        setState(mail.code === "IN_KLAERUNG" ? "in-klärung" : "error");
        setMessage(mail.message);
        return;
      }
      setInbox(mail.data);
      setQuotes(quoteResult.code === "OK" ? quoteResult.quotes : []);
      setState("ready");
    };
    void load().catch((error) => {
      console.error("[COMMUNICATION_PANEL_READ_FAILED]",error);
      if (active) {
        setState("error");
        setMessage("E-Mail-Funktionen konnten nicht sicher geladen werden.");
      }
    });
    return () => { active = false; };
  }, [targetId, targetType,composer]);

  const attach = async (mail: InboxMessage) => {
    setBusyId(mail.id);
    setFeedback("");
    const result = await attachOutlookMailAction({ targetType, targetId, graphMessageId: mail.id });
    setBusyId(null);
    setFeedback(result.code === "OK"
      ? ["Mail ist am Vorgang abgelegt.", result.data.attachmentsImported ? `${result.data.attachmentsImported} Anhang/Anhänge wurden privat gespeichert.` : "", result.data.attachmentsSkipped ? `${result.data.attachmentsSkipped} Signatur- oder nicht einzeln unterstützte Anhänge bleiben im Mail-Original.` : "", result.data.attachmentWarning ?? ""].filter(Boolean).join(" ")
      : result.message);
  };
  const captureMail=async(mail:InboxMessage,intent:'CUSTOMER'|'QUOTE')=>{
    if(busyId)return;
    setBusyId(mail.id);setFeedback('');
    try{
      const result=await importOutlookMailAction(mail.id);
      if(result.code!=='OK'){setFeedback(result.message);return;}
      requestGlobalCreate({intent,prefill:{sourceItemId:result.itemId,...(intent==='CUSTOMER'?{name:mail.senderName,email:mail.senderAddress}:{customerQuery:mail.senderAddress,note:mail.body})}});
    }catch(error){console.error('[COMMUNICATION_CAPTURE_FAILED]',error instanceof Error?error.name:'UnknownError');setFeedback('Mail-Original noch nicht sicher übernommen · bitte erneut versuchen.');}
    finally{setBusyId(null);}
  };

  const sendLock=useRef(false);
  const pendingSend=useRef<Parameters<typeof sendCustomerMailAction>[0]|null>(null);
  const [sendUnclear,setSendUnclear]=useState(false);
  const composeForm=(
      <form className={styles.compose} onSubmit={async (event) => {
        event.preventDefault();
        if(composer){composer.onSend();return;}
        if(sendLock.current)return;
        const formElement=event.currentTarget,form=new FormData(formElement);
        if(pendingSend.current&&(pendingSend.current.targetType!==targetType||pendingSend.current.targetId!==targetId)){setFeedback('Vorherigen Versand zuerst am ursprünglichen Vorgang prüfen.');return;}
        const quoteId=String(form.get('quoteId')??'');
        const input=pendingSend.current??{targetType,targetId,clientRequestId:globalThis.crypto.randomUUID(),subject:String(form.get('subject')??''),body:String(form.get('body')??''),...(quoteId?{attachment:{kind:'QUOTE' as const,documentId:quoteId}}:{})};
        pendingSend.current=input;sendLock.current=true;setSendBusy(true);setFeedback('');
        try{
          const result=await sendCustomerMailAction(input);
          setFeedback(result.code==='OK'?('notice'in result&&typeof result.notice==='string'&&result.notice?result.notice:'E-Mail wurde versendet und am Vorgang gespeichert.'):result.message);
          if(result.code==='OK'){pendingSend.current=null;setSendUnclear(false);formElement.reset();}
          else if(result.code==='UNAVAILABLE'||result.code==='CONFLICT'){setSendUnclear(true);}
          else{pendingSend.current=null;setSendUnclear(false);}
        }catch(error){console.error('[COMMUNICATION_SEND_UNCONFIRMED]',error);setSendUnclear(true);setFeedback('Ausgang ungeklärt · Eingaben und Kennung bleiben erhalten. Mit gleicher Kennung erneut versuchen.');}
        finally{sendLock.current=false;setSendBusy(false);}
      }}>
        <label>Betreff<input name="subject" required maxLength={500} value={composer?.subject} disabled={composer?.busy||sendBusy||sendUnclear} onChange={composer?event=>composer.onSubject(event.target.value):undefined} /></label>
        <label>Nachricht<textarea name="body" required maxLength={20_000} value={composer?.body} disabled={composer?.busy||sendBusy||sendUnclear} onChange={composer?event=>composer.onBody(event.target.value):undefined} /></label>
        {!composer?<label>PDF-Anhang<select name="quoteId" defaultValue="" disabled={sendBusy||sendUnclear}><option value="">Ohne Anhang</option>{matchingQuotes.map((quote) => <option key={quote.quoteId} value={quote.quoteId}>KV {quote.quoteNumber}</option>)}</select></label>:null}
        {!composer?<button type="submit" disabled={sendBusy}>{sendBusy ? <Loader2 className={styles.spin} /> : <Send />}{sendUnclear?"Mit gleicher Kennung erneut versuchen":"Versenden"}</button>:null}
      </form>
  );
  if(composer)return <section className={styles.panel}>{composeForm}</section>;

  if (state === "loading") return <section className={styles.panel} aria-busy="true"><Loader2 className={styles.spin} /><span>E-Mail-Verbindung wird geprüft.</span></section>;
  if (state !== "ready") return <section className={styles.panel} role={state === "error" ? "alert" : "status"}><header><AtSign /><div><small>E-Mail</small><h3>{state === "in-klärung" ? "In Klärung" : "Nicht verfügbar"}</h3></div></header><p>{message}</p></section>;

  return (
    <section className={styles.panel}>
      <header><AtSign /><div><small>Microsoft 365</small><h3>E-Mail am Vorgang</h3></div></header>
      {composeForm}
      <div className={styles.inboxHead}><Inbox /><div><small>{targetType === "ORDER" ? "Auftrag" : "Posteingang"}</small><h3>{targetType === "ORDER" ? "Zugeordnete Outlook-Mails" : "Letzte Outlook-Mails"}</h3></div></div>
      {targetType === "ORDER" ? inbox.length === 0 ? <p className={styles.empty}>Diesem Auftrag sind keine Mails zugeordnet.</p> : (
        <ol className={styles.inbox}>
          {inbox.map((mail) => <li key={mail.id}>
            <div><strong>{mail.subject}</strong><small>{mail.senderName} · {mail.senderAddress} · {new Date(mail.receivedAt).toLocaleString("de-DE")}</small><p>{mail.body}</p></div>
          </li>)}
        </ol>
      ) : inbox.length === 0 ? <p className={styles.empty}>Der Posteingang enthält keine lesbaren Mails.</p> : (
        <ol className={styles.inbox}>
          {inbox.map((mail) => <li key={mail.id}>
            <div><strong>{mail.subject}</strong><small>{mail.senderName} · {new Date(mail.receivedAt).toLocaleString("de-DE")}</small><p>{mail.preview || "Keine Vorschau vorhanden."}</p>{mail.hasAttachments ? <span><Paperclip /> Mit Anhang</span> : null}</div>
            <div className={styles.mailActions}>
              <button type="button" disabled={busyId === mail.id} onClick={() => void attach(mail)}>{busyId === mail.id ? <Loader2 className={styles.spin} /> : <Paperclip />}Am Vorgang ablegen</button>
              <button type="button" disabled={busyId!==null} onClick={() => void captureMail(mail,'CUSTOMER')}><MailPlus />Kunde anlegen</button>
              <button type="button" disabled={busyId!==null} onClick={() => void captureMail(mail,'QUOTE')}><MailPlus />KV anlegen</button>
            </div>
          </li>)}
        </ol>
      )}
      {feedback ? <p className={styles.feedback} role="status">{feedback}</p> : null}
    </section>
  );
}
