"use client";

import { useEffect, useMemo, useState } from "react";
import { AtSign, Inbox, Loader2, MailPlus, Paperclip, Send } from "lucide-react";
import {
  attachOutlookMailAction,
  getMicrosoftGraphStatusAction,
  listOutlookInboxAction,
  sendCustomerMailAction,
} from "@/app/actions/communications.actions";
import { listOpenQuotesAction } from "@/app/actions/quotes.actions";
import { requestGlobalCreate } from "@/components/layout/GlobalCreateFlow";
import type { QuoteReadback } from "@/modules/quotes/public";
import styles from "./CommunicationPanel.module.css";

type Target = { targetType: "CUSTOMER" | "ORDER"; targetId: string };
type InboxMessage = Extract<Awaited<ReturnType<typeof listOutlookInboxAction>>, { code: "OK" }>["data"][number];

export function CommunicationPanel({ targetType, targetId }: Target) {
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
      const [mail, quoteResult] = await Promise.all([listOutlookInboxAction(), listOpenQuotesAction()]);
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
    void load().catch(() => {
      if (active) {
        setState("error");
        setMessage("E-Mail-Funktionen konnten nicht sicher geladen werden.");
      }
    });
    return () => { active = false; };
  }, []);

  const attach = async (mail: InboxMessage) => {
    setBusyId(mail.id);
    setFeedback("");
    const result = await attachOutlookMailAction({ targetType, targetId, graphMessageId: mail.id });
    setBusyId(null);
    setFeedback(result.code === "OK"
      ? ["Mail ist am Vorgang abgelegt.", result.data.attachmentsImported ? `${result.data.attachmentsImported} Anhang/Anhänge wurden privat gespeichert.` : "", result.data.attachmentsSkipped ? `${result.data.attachmentsSkipped} nicht unterstützte/inline Anhänge wurden nicht übernommen.` : "", result.data.attachmentWarning ?? ""].filter(Boolean).join(" ")
      : result.message);
  };

  if (state === "loading") return <section className={styles.panel} aria-busy="true"><Loader2 className={styles.spin} /><span>E-Mail-Verbindung wird geprüft.</span></section>;
  if (state !== "ready") return <section className={styles.panel} role={state === "error" ? "alert" : "status"}><header><AtSign /><div><small>E-Mail</small><h3>{state === "in-klärung" ? "In Klärung" : "Nicht verfügbar"}</h3></div></header><p>{message}</p></section>;

  return (
    <section className={styles.panel}>
      <header><AtSign /><div><small>Microsoft 365</small><h3>E-Mail am Vorgang</h3></div></header>
      <form className={styles.compose} onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setSendBusy(true);
        setFeedback("");
        const quoteId = String(form.get("quoteId") ?? "");
        const result = await sendCustomerMailAction({
          targetType,
          targetId,
          clientRequestId: globalThis.crypto.randomUUID(),
          subject: String(form.get("subject") ?? ""),
          body: String(form.get("body") ?? ""),
          ...(quoteId ? { attachment: { kind: "QUOTE" as const, documentId: quoteId } } : {}),
        });
        setSendBusy(false);
        setFeedback(result.code === "OK" ? "E-Mail wurde versendet und am Vorgang gespeichert." : result.message);
        if (result.code === "OK") event.currentTarget.reset();
      }}>
        <label>Betreff<input name="subject" required maxLength={500} /></label>
        <label>Nachricht<textarea name="body" required maxLength={20_000} /></label>
        <label>PDF-Anhang<select name="quoteId" defaultValue=""><option value="">Ohne Anhang</option>{matchingQuotes.map((quote) => <option key={quote.quoteId} value={quote.quoteId}>KV {quote.quoteNumber}</option>)}</select></label>
        <button type="submit" disabled={sendBusy}>{sendBusy ? <Loader2 className={styles.spin} /> : <Send />}Versenden</button>
      </form>
      <div className={styles.inboxHead}><Inbox /><div><small>Posteingang</small><h3>Letzte Outlook-Mails</h3></div></div>
      {inbox.length === 0 ? <p className={styles.empty}>Der Posteingang enthält keine lesbaren Mails.</p> : (
        <ol className={styles.inbox}>
          {inbox.map((mail) => <li key={mail.id}>
            <div><strong>{mail.subject}</strong><small>{mail.senderName} · {new Date(mail.receivedAt).toLocaleString("de-DE")}</small><p>{mail.preview || "Keine Vorschau vorhanden."}</p>{mail.hasAttachments ? <span><Paperclip /> Mit Anhang</span> : null}</div>
            <div className={styles.mailActions}>
              <button type="button" disabled={busyId === mail.id} onClick={() => void attach(mail)}>{busyId === mail.id ? <Loader2 className={styles.spin} /> : <Paperclip />}Am Vorgang ablegen</button>
              <button type="button" onClick={() => requestGlobalCreate({ intent: "CUSTOMER", prefill: { name: mail.senderName, email: mail.senderAddress } })}><MailPlus />Kunde anlegen</button>
              <button type="button" onClick={() => requestGlobalCreate({ intent: "QUOTE", prefill: { customerQuery: mail.senderAddress, note: `Anfrage aus Outlook: ${mail.subject}` } })}><MailPlus />KV anlegen</button>
            </div>
          </li>)}
        </ol>
      )}
      {feedback ? <p className={styles.feedback} role="status">{feedback}</p> : null}
    </section>
  );
}
