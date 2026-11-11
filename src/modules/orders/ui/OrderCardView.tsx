"use client";
import {ACTOR_COPY,QUOTE_CANCELLED_ORDER_COPY as cancelledCopy,ORDER_HANDOVER_COPY} from "@/ui/situationCatalog";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import {
  goodsOutAgreementButtonText,
  type OrderCardActionPorts,
  type OrderCardEvidence,
  type OrderCardGoodsOutMode,
  type OrderCardState,
} from "../server/types";
import {
  Button,
  Chip,
  Dialog,
  Auswahl,
  Eingabe,
  Fakten,
  Feld,
  Hinweis,
  Icon,
  Karte,
  KartenBlock,
  Kartenkopf,
  NaechsteAktion,
  Notiz,
  Schnellaktionen,
  Seitenblatt,
  Segment,
  Teil,
  TerminBox,
  Textfeld,
  Verlauf,
  ZahlungsSchwelle,
  Zustand,
  Zustandskette,
  type Geraet,
  type IconName,
  type SchnellAktion,
  type SchrittStatus,
} from "@/ui/kr";

const STATIONS = ["angenommen", "galvanik", "fertig", "zahlung", "abgeholt"] as const;
const SURFACE_OPTIONS = ["Verchromen", "Vernickeln", "Verzinken", "Entchromen / prüfen", "noch zu klären"] as const;

function money(cents: number | null) {
  return cents === null ? "Nicht belegt" : new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(cents / 100);
}

function dueLabel(value: string | null) {
  if (!value) return "Kein Termin belegt";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" }) : "Termin nicht lesbar";
}

function dueStatus(value: string | null) {
  if (!value) return { relative: "Kein Termin belegt", overdue: false };
  const target = new Date(`${value.slice(0, 10)}T12:00:00`);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  if (!Number.isFinite(target.getTime())) return { relative: "Termin nicht lesbar", overdue: false };
  const days = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return { relative: `${Math.abs(days)} ${Math.abs(days) === 1 ? "Tag" : "Tage"} überfällig`, overdue: true };
  if (days === 0) return { relative: "Heute fällig", overdue: false };
  if (days === 1) return { relative: "Morgen fällig", overdue: false };
  return { relative: `In ${days} Tagen`, overdue: false };
}

function readDevice(): Geraet {
  if (window.innerWidth <= 699) return "handy";
  if (window.innerWidth <= 1399 && window.matchMedia?.("(pointer: coarse)").matches) return "tablet";
  return "desktop";
}

function subscribeDevice(onChange: () => void) {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
}

function formatMoment(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" }) : "Zeitpunkt nicht lesbar";
}

function stateText(state: Exclude<OrderCardState, { kind: "data" }>) {
  if (state.kind === "loading") return "Auftragskarte wird geladen.";
  if (state.kind === "not-found") return "Auftrag nicht vorhanden.";
  if (state.kind === "denied") return "Auftragskarte nicht freigegeben.";
  if (state.kind === "conflict") return "Auftragsstand nicht eindeutig.";
  return "Auftragskarte nicht verfügbar.";
}

function actionStatus(index: number, current: number): SchrittStatus {
  if (index < current) return "erledigt";
  if (index === current) return "aktiv";
  if (index === current + 1) return "bereit";
  return "warten";
}

function paymentModeLabel(mode: "vorkasse" | "abholung" | "rechnung" | "keiner"): string {
  if (mode === "vorkasse") return "Vorkasse";
  if (mode === "abholung") return "Abholung";
  if (mode === "keiner") return "Ohne Berechnung · Nacharbeit";
  return "Rechnung";
}

function paymentMethodLabel(method: "bar" | "ueberweisung" | "karte"): string {
  if (method === "bar") return "Bar";
  if (method === "ueberweisung") return "Überweisung";
  return "Karte";
}

type OrderCardData = Extract<OrderCardState, { kind: "data" }>["card"];

function agreementHintText(
  hint: NonNullable<OrderCardData["agreementHint"]>,
) {
  const date = hint.state === "revoked"
    ? formatMoment(hint.date)
    : dueLabel(hint.date);
  return hint.state === "revoked"
    ? `Absprache ${hint.label} widerrufen am ${date}`
    : `Absprache ${hint.label} abgelaufen am ${date}`;
}

function goodsOutMode(card: OrderCardData): OrderCardGoodsOutMode | null {
  if (card.handoverMode === "shipping") return "versand";
  if (card.handoverMode === "pickup") return "abholung";
  return null;
}

const EVIDENCE_SOURCE_LABEL: Record<OrderCardEvidence["source"], string> = {
  ORDER_STATION_ATTACHMENT: "Werkstattfoto",
  ORDER_INTAKE_ATTACHMENT: "Eingangsfoto",
  LEGACY_SCAN_UPLOAD: "Übernommener Scan",
};

const EVIDENCE_STATE_LABEL: Record<OrderCardEvidence["state"], string> = {
  VERIFIED: "Original geprüft",
  LEGACY_RECORDED: "Original erfasst",
  LEGACY_PARTIAL: "Original teilweise erfasst",
  NOT_RECORDED: "Original fehlt",
};

function evidenceLabel(entry: OrderCardEvidence): string {
  return `${EVIDENCE_SOURCE_LABEL[entry.source]} · ${EVIDENCE_STATE_LABEL[entry.state]}`;
}

function OrderHandoverPanel({card}:{card:OrderCardData}){
 const[error,setError]=useState<string|null>(null);
 const notice=card.handoverNotice;
 const open=(ziel:'aufgabe'|'mailein',arg:string)=>{if(window.dispatchEvent(new CustomEvent('kreile:oeffne',{cancelable:true,detail:{ziel,arg}})))setError(ORDER_HANDOVER_COPY.targetUnavailable);};
 return <section className="kr-stapel" data-spec-id="auftrag.uebergabe"><h3 className="kr-naechste-t">{ORDER_HANDOVER_COPY.label(card.handoverMode,card.shippingService,card.shippingServiceError)}</h3>{notice?<Hinweis ton={notice.taskId&&notice.taskState!=='erledigt'?'warn':'ok'}><p>{notice.message}</p>{notice.taskId?notice.taskState==='offen'?<Button text={ORDER_HANDOVER_COPY.task} onClick={()=>open('aufgabe',notice.taskId!)}/>:<p>{notice.taskState==='erledigt'?ORDER_HANDOVER_COPY.completed:ORDER_HANDOVER_COPY.taskUnavailable}</p>:null}<Button art="sekundaer" text={ORDER_HANDOVER_COPY.original} onClick={()=>open('mailein',notice.originalItemId)}/></Hinweis>:null}{error?<Hinweis ton="warn">{error}</Hinweis>:null}</section>;
}

export function OrderCardView({
  state,
  actions,
  attachmentPanel,
  documentsPanel,
  photoPanel,
  initialPhotosOpen=false,
  complaintsPanel,
  agreementMessage,
  onOpenCustomer,
  onClose,
}: {
  state: OrderCardState;
  actions: OrderCardActionPorts;
  attachmentPanel?: ReactNode;
  documentsPanel?: ReactNode;
  photoPanel?:ReactNode;
  initialPhotosOpen?:boolean;
  complaintsPanel?: ReactNode;
  agreementMessage?: string | null;
  onOpenCustomer: (id: string) => void;
  onClose: () => void;
}) {
  const device = useSyncExternalStore(subscribeDevice, readDevice, () => "desktop" as const);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [photosOpen,setPhotosOpen]=useState(initialPhotosOpen);
  const [paymentMethod, setPaymentMethod] = useState<"" | "bar" | "ueberweisung" | "karte">("");
  const [dueOpen, setDueOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [itemOpen, setItemOpen] = useState<string | "new" | null>(null);
  const [invoicePriceOpen, setInvoicePriceOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [goodsOutOpen, setGoodsOutOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [dismissedInvoiceReceiptId, setDismissedInvoiceReceiptId] = useState<string | null>(null);

  if (state.kind !== "data") {
    const loading = state.kind === "loading";
    const message = loading ? stateText(state) : `${stateText(state)} ${state.message}`;
    return (
      <Seitenblatt
        titel="Auftragskarte"
        onSchliessen={onClose}
        zustand={loading ? "laedt" : state.kind === "denied" ? "gesperrt" : "fehler"}
        texte={{ laedtText: message, gesperrtText: message, fehlerText: message }}
      >
        {null}
      </Seitenblatt>
    );
  }

  const card = state.card;
  if(card.status==='storniert')return <Seitenblatt titel={`Auftragskarte ${card.orderNumber}`} onSchliessen={onClose}><KartenBlock label={cancelledCopy.title}><h2>{card.orderNumber+' · '+card.title}</h2><Hinweis>{cancelledCopy.explanation}</Hinweis>{card.cancellation?<><p>{cancelledCopy.reason+' · '+card.cancellation.reason}</p><p>{cancelledCopy.actor+' · '+card.cancellation.actor+' · '+formatMoment(card.cancellation.at)}</p></>:null}<Button text={cancelledCopy.customer} onClick={()=>onOpenCustomer(card.customerId)}/>{card.cancellation?.quoteId?<Button text={cancelledCopy.quote(card.cancellation.quoteNumber)} onClick={()=>window.dispatchEvent(new CustomEvent('kreile:oeffne',{cancelable:true,detail:{ziel:'kv',arg:card.cancellation!.quoteId}}))}/>:null}{card.items.map(item=><p key={item.id}>{item.quantity+' × '+item.name}</p>)}</KartenBlock></Seitenblatt>;

  const invoiceSuccess = actions.feedback.kind === "success"
    && actions.feedback.receipt.kind === "invoice"
    && actions.feedback.receipt.receiptId !== dismissedInvoiceReceiptId
    ? actions.feedback
    : null;
  const payment = card.payment.kind === "available" ? card.payment.value : null;
  const current = card.station === "abgeholt" ? 4 : payment?.status === "bezahlt" ? 3 : Math.max(0, STATIONS.indexOf(card.station as (typeof STATIONS)[number]));
  const deadline = dueStatus(card.dueAt);
  const paymentFree = payment?.status === "bezahlt" || payment?.mode === "rechnung" || payment?.mode === "keiner";
  const missingInvoicePrices = card.items.filter((item) => item.unitPriceCents === null || item.unitPriceCents === undefined);
  const contentEnabled = Boolean(actions.content?.enabled && actions.onSaveContent);
  const contentItems = card.items.map((item) => ({
    id: item.id,
    catalogServiceId: item.catalogServiceId ?? null,
    name: item.name,
    quantity: item.quantity,
    material: item.material,
    surface: item.surface,
    unit: item.unit ?? null,
    unitPriceCents: item.unitPriceCents ?? null,
    vatRateBasisPoints: item.vatRateBasisPoints ?? null,
  }));
  const unavailable = (reason: string | null | undefined) => setNotice(reason ?? "Diese Aktion ist derzeit nicht verfügbar.");
  const openGoodsOut = () => {
    if (!actions.goodsOut.enabled) {
      unavailable(actions.goodsOut.reason);
      return;
    }
    setGoodsOutOpen(true);
  };
  const requestInvoice = () => {
    if (missingInvoicePrices.length > 0) setInvoicePriceOpen(true);
    else void actions.onIssueInvoice();
  };
  const openInvoicePdf = () => {
    if (!payment?.invoiceId) return;
    window.open(`/api/invoices/${payment.invoiceId}/pdf?disposition=inline`, "_blank", "noopener,noreferrer");
  };

  const invokeStation = (station: (typeof STATIONS)[number]) => {
    if (station === "galvanik" && actions.handoff.enabled) void actions.onHandoff();
    if (station === "fertig" && actions.freeze.enabled) void actions.onFreeze();
    if (station === "zahlung" && actions.invoice.enabled) requestInvoice();
    else if (station === "zahlung" && actions.payment.enabled) setPaymentOpen(true);
    if (station === "abgeholt" && actions.goodsOut.enabled) openGoodsOut();
  };

  const next = actions.handoff.visible
    ? { title: "Übergabe an die Galvanik", text: "In Galvanik", icon: "droplet" as IconName, enabled: actions.handoff.enabled, onClick: () => void actions.onHandoff() }
    : actions.freeze.visible
      ? { title: "Fertig melden, sobald alle Teile durch sind", text: "Fertig melden", icon: "checkc" as IconName, enabled: actions.freeze.enabled, onClick: () => void actions.onFreeze() }
      : actions.invoice.visible
        ? { title: missingInvoicePrices.length ? "Fehlende Preise ergänzen und Rechnung ausstellen" : "Rechnung unveränderlich ausstellen", text: "Rechnung", icon: "receipt" as IconName, enabled: actions.invoice.enabled, onClick: requestInvoice }
        : actions.payment.visible
          ? { title: "Zahlungseingang bestätigen", text: "Zahlung", icon: "card" as IconName, enabled: actions.payment.enabled, onClick: () => setPaymentOpen(true) }
          : actions.goodsOut.visible
            ? { title: actions.goodsOut.enabled ? "Warenausgang prüfen" : "Warenausgang wartet auf Freigabe", text: "Ware raus", icon: "truck" as IconName, enabled: actions.goodsOut.enabled, onClick: openGoodsOut }
            : null;

  const quickActions: SchnellAktion[] = [];
  if (actions.handoff.visible && actions.handoff.enabled) quickActions.push({ key: "handoff", text: "Galvanik", icon: "droplet", primaer: true, onClick: () => void actions.onHandoff() });
  if (actions.freeze.visible && actions.freeze.enabled) quickActions.push({ key: "freeze", text: "Fertig", icon: "checkc", erledigen: true, onClick: () => void actions.onFreeze() });
  if (actions.invoice.visible && actions.invoice.enabled) quickActions.push({ key: "invoice", text: "Rechnung", icon: "receipt", onClick: requestInvoice });
  if (payment?.invoiceState === "issued" && payment.invoiceId) quickActions.push({ key: "invoice-pdf", text: "PDF öffnen", icon: "file", onClick: openInvoicePdf });
  if (actions.payment.visible && actions.payment.enabled) quickActions.push({ key: "payment", text: "Zahlung", icon: "card", onClick: () => setPaymentOpen(true) });
  if (actions.goodsOut.visible && actions.goodsOut.enabled) quickActions.push({ key: "goods", text: "Ware raus", icon: "truck", primaer: true, onClick: openGoodsOut });
  if (device === "desktop" && actions.label.visible && actions.label.enabled) quickActions.push({ key: "label", text: "Laufzettel drucken", icon: "file", onClick: () => void actions.onPrintLabel() });
  quickActions.push(
    { key: "status-mail", text: "Status-Mail", icon: "mail", onClick: () => actions.onOpenStatusMail ? actions.onOpenStatusMail() : unavailable("Status-Mail ist derzeit nicht verfügbar.") },
    { key: "call", text: "Anrufen", icon: "phone", onClick: () => actions.contact?.enabled && actions.onCallCustomer ? actions.onCallCustomer() : unavailable(actions.contact?.reason) },
    { key: "photo", text: "Foto +", icon: "camera", onClick: () => actions.photo?.enabled && actions.onOpenPhoto ? actions.onOpenPhoto() : unavailable(actions.photo?.reason) },
    { key: "more", text: "Mehr", icon: "more", onClick: () => setMoreOpen(true) },
  );

  const history = [
    ...card.dueDateChanges?.map((change) => ({ key: change.eventId, zeit: formatMoment(change.changedAt), text: `Liefertermin geändert · ${dueLabel(change.changedTo)} · ${change.reason} · ${change.changedBy}`, icon: "calendar" as IconName, ton: "warn" as const })) ?? [],
    ...card.labelPrints?.map((entry) => ({ key: entry.eventId, zeit: formatMoment(entry.occurredAt), text: "Laufzettel gedruckt", icon: "file" as IconName, ton: "ok" as const })) ?? [],
    ...card.evidence.map((entry) => ({ key: entry.key, zeit: formatMoment(entry.recordedAt), text: evidenceLabel(entry), icon: "file" as IconName })),
    ...(payment?.paymentEvent ? [{ key: payment.paymentEvent.eventId, zeit: formatMoment(payment.paymentEvent.occurredAt), text: `Zahlung bestätigt · ${paymentMethodLabel(payment.paymentEvent.method)}`, icon: "card" as IconName, ton: "ok" as const }] : []),
    ...(card.frozenAt ? [{ key: "freeze", zeit: formatMoment(card.frozenAt), text: "Auftrag fertig gemeldet", icon: "checkc" as IconName, ton: "ok" as const }] : []),
    { key: "intake", zeit: formatMoment(card.intakeAt), text: `Angenommen · ${card.items.length} ${card.items.length === 1 ? "Position" : "Positionen"}`, icon: "box" as IconName },
  ];

  const head = (
    <Kartenkopf
      nummer={card.orderNumber}
      titel={card.title}
      sub={`${card.items.length} ${card.items.length === 1 ? "Position" : "Positionen"} · ${card.status}`}
      meta={<><Chip text={card.station} ton={deadline.overdue ? "rot" : "info"} /><button type="button" className="kr-pill kr-pill--kunde" onClick={() => onOpenCustomer(card.customerId)}><Icon name="user" />{card.customerName} · Kundenakte <Icon name="arrow" /></button></>}
      termin={<><TerminBox relativ={deadline.relative} datum={dueLabel(card.dueAt)} status={<Chip text={deadline.overdue ? "überfällig" : "bestätigt"} ton={deadline.overdue ? "rot" : "ok"} />} dringend={deadline.overdue} />{actions.dueDate?.visible ? <Button art="leise" icon="calendar" text="Termin ändern" disabled={!actions.dueDate.enabled} onClick={() => setDueOpen(true)} /> : null}</>}
      onSchliessen={onClose}
    />
  );

  const chain = <>
    <Zustandskette schritte={[
      { key: "angenommen", label: "angenommen", icon: "check", status: actionStatus(0, current), sub: new Date(card.intakeAt).toLocaleDateString("de-DE") },
      { key: "galvanik", label: "Galvanik", icon: "droplet", status: actionStatus(1, current), onClick: actions.handoff.visible && actions.handoff.enabled ? () => invokeStation("galvanik") : undefined },
      { key: "fertig", label: "fertig", icon: "flag", status: actionStatus(2, current), onClick: actions.freeze.visible && actions.freeze.enabled ? () => invokeStation("fertig") : undefined },
      { key: "zahlung", label: "Zahlung", icon: "card", status: paymentFree ? "erledigt" : actions.payment.enabled ? "bereit" : "gesperrt", schwelle: true, frei: paymentFree, onClick: actions.payment.visible && actions.payment.enabled ? () => setPaymentOpen(true) : undefined },
      { key: "abgeholt", label: payment?.goodsOut?.mode === "versand" ? "verschickt" : "abgeholt", icon: "truck", status: card.station === "abgeholt" ? "erledigt" : actions.goodsOut.enabled ? "bereit" : "gesperrt", onClick: actions.goodsOut.visible && actions.goodsOut.enabled ? () => invokeStation("abgeholt") : undefined },
    ]} />
    {!paymentFree && payment ? <ZahlungsSchwelle text={`${paymentModeLabel(payment.mode)} · ${payment.invoiceState === "issued" ? payment.status ?? "offen" : "Rechnung noch nicht ausgestellt"}`} aktion={actions.payment.visible && actions.payment.enabled ? <Button art="primaer" icon="card" text="Zahlung prüfen" onClick={() => setPaymentOpen(true)} /> : undefined} /> : null}
  </>;

  const responsibilityFeedback=actions.feedback.kind==='success'?actions.feedback.receipt.kind==='responsibility':'operation'in actions.feedback&&actions.feedback.operation==='responsibility';
  const main = <>
    {card.actors||card.actorReadError?<KartenBlock><section data-spec-id="auftrag.akteure">
      {card.actorReadError?<Hinweis ton="warn">{card.actorReadError}</Hinweis>:card.actors?<>
        {card.actors.createdBy?<p>{ACTOR_COPY.created(card.actors.createdBy.name??ACTOR_COPY.unknownLogin,formatMoment(card.actors.createdBy.at))}</p>:<p>{ACTOR_COPY.missing}</p>}
        {card.actors.lastActor?<p>{ACTOR_COPY.last(card.actors.lastActor.mailSender?ACTOR_COPY.mail(card.actors.lastActor.mailSender):card.actors.lastActor.name??ACTOR_COPY.unknownLogin,ACTOR_COPY.action(card.actors.lastActor.action))}</p>:null}
        {card.actors.assignmentUnavailable?<Hinweis ton="warn">{ACTOR_COPY.unreadable}<Button text={ACTOR_COPY.reload} onClick={()=>void actions.onReload()}/></Hinweis>:<>
        {card.actors.responsible?<p>{ACTOR_COPY.responsible(card.actors.responsible.name??ACTOR_COPY.unknownLogin)}</p>:<p>{ACTOR_COPY.unassigned}</p>}
        {actions.takeResponsibility?.visible&&actions.onTakeResponsibility?<Button text={card.actors.responsible?.userId===card.actors.currentLoginId?ACTOR_COPY.mine:ACTOR_COPY.take} disabled={!actions.takeResponsibility.enabled||actions.feedback.kind==='submitting'} onClick={()=>void actions.onTakeResponsibility?.()}/>:null}</>}
      </>:null}
      {responsibilityFeedback?<Hinweis ton={actions.feedback.kind==='success'?'ok':'warn'}><span role={actions.feedback.kind==='error'||actions.feedback.kind==='conflict'?'alert':'status'}>{actions.feedback.message}</span>{(actions.feedback.kind==='error'||actions.feedback.kind==='conflict')&&actions.feedback.code==='VALIDATION_ERROR'?<Button text={ACTOR_COPY.reload} onClick={()=>void actions.onReload()}/>:null}</Hinweis>:null}
    </section></KartenBlock>:null}
    <OrderHandoverPanel card={card}/>
    {complaintsPanel}
    {next ? <KartenBlock><NaechsteAktion titel={next.title} aktionen={<Button art={actions.freeze.visible ? "erledigen" : "primaer"} icon={next.icon} text={next.text} disabled={!next.enabled} onClick={next.onClick} />} /></KartenBlock> : null}
    <KartenBlock label="Teile" rechts={<Button art="leise" icon="plus" text="Teil hinzufügen" disabled={!contentEnabled || card.items.length >= 20} onClick={() => contentEnabled ? setItemOpen("new") : unavailable(actions.content?.reason)} />}>
      <div className="kr-teile">{card.items.map((item) => <Teil key={item.id} nr={`Pos. ${item.position}`} name={item.name} meta={`${item.surface} · ${item.quantity} ${item.unit ?? "Einheit fehlt"} · ${item.material ?? "Material nicht hinterlegt"}${item.extraWork.length ? ` · ${item.extraWork.length} Mehrarbeit` : ""}`} fertig={Boolean(item.finished) || current >= 2} fotoFehlt={!card.evidence.some((entry) => entry.itemIds.includes(item.id))} geraet={device} onFoto={() => actions.photo?.enabled && actions.onOpenPhoto ? actions.onOpenPhoto() : unavailable(actions.photo?.reason)} aktionen={<><Button art={item.finished ? "erledigen" : "sekundaer"} icon="check" text={device === "handy" ? undefined : "fertig"} label={`Teil ${item.finished ? "wieder öffnen" : "fertig melden"}`} disabled={!actions.onToggleItemFinished || !actions.itemStatus?.enabled || current >= 2} onClick={() => void actions.onToggleItemFinished?.(item.id, !item.finished)} /><Button art="sekundaer" icon="edit" label="Teil bearbeiten" disabled={!contentEnabled} onClick={() => contentEnabled ? setItemOpen(item.id) : unavailable(actions.content?.reason)} /></>} />)}</div>
      {card.items.length === 0 ? <Zustand art="leer" text="Für diesen Auftrag sind noch keine Positionen erfasst." /> : null}
      {actions.evidence.visible && attachmentPanel ? <div className="kr-stapel">{attachmentPanel}</div> : null}
    </KartenBlock>
    <KartenBlock label="Notizen" rechts={<Button art="leise" icon={card.note ? "edit" : "plus"} text="Notiz" disabled={!contentEnabled} onClick={() => contentEnabled ? setNoteOpen(true) : unavailable(actions.content?.reason)} />}><Notiz text={card.note ?? "Keine Auftragsnotiz hinterlegt."} bezug={<Chip text="Auftrag" ton="info" />} autor={card.assignedTo ?? "Nicht zugewiesen"} /></KartenBlock>
    <KartenBlock label="Fotos & Dokumente">
      {card.evidence.length ? <div className="kr-docs">{card.evidence.map((entry) => <span className="kr-doc" key={entry.key}>{evidenceLabel(entry)}</span>)}</div> : <Zustand art="leer" text="Noch keine Dokumente oder Fotos vorhanden." />}
      {!photosOpen?photoPanel:null}{documentsPanel}
    </KartenBlock>
    {actions.agreement?.visible ? <KartenBlock label="Zahlungsabsprache">
      {card.agreement ? <div data-spec-id="auftrag.absprache-zeile" className="kr-stapel">
        <strong>Zahlungsabsprache · {card.agreement.label} · {card.agreement.orderId === card.id ? "gilt für diesen Auftrag" : "gilt für ganzen Kunden"}</strong>
      </div> : <Zustand art="leer" text="Keine Zahlungsabsprache für diesen Auftrag festgelegt." />}
      <div className="kr-schnellleiste">
        <Button data-spec-id="auftrag.absprache" art="sekundaer" icon="receipt" text="Absprache nur für diesen Auftrag" disabled={!actions.agreement.enabled} onClick={actions.agreement.onCreate} />
        {actions.agreement.onEdit ? <Button data-spec-id="auftrag.absprache-aendern" art="sekundaer" icon="edit" text="Absprache ändern" disabled={!actions.agreement.enabled} onClick={actions.agreement.onEdit} /> : null}
        {actions.agreement.onRevoke ? <Button data-spec-id="auftrag.absprache-widerrufen" art="leise" icon="x" text="Absprache widerrufen" disabled={!actions.agreement.enabled} onClick={actions.agreement.onRevoke} /> : null}
      </div>
      {agreementMessage ? <Hinweis ton="ok">{agreementMessage}</Hinweis> : null}
    </KartenBlock> : null}
    {card.payment.kind === "available" ? <KartenBlock label="Rechnung"><Fakten zeilen={[{ k: "Zahlungsmodus", v: payment ? paymentModeLabel(payment.mode) : "Nicht belegt" }, { k: "Rechnung", v: payment?.invoiceState === "issued" ? payment.invoiceNumber ?? payment.status ?? "ausgestellt" : "noch nicht ausgestellt" }, { k: payment?.status === "bezahlt" ? "Bezahlt" : payment?.status === "teilbezahlt" ? "Noch offen" : "Offen", v: money(payment?.openAmountCents ?? null), warn: Boolean(payment?.openAmountCents) }]} />{payment?.invoiceState === "issued" && payment.invoiceId ? <Button art="sekundaer" icon="file" text="Rechnungs-PDF öffnen" onClick={openInvoicePdf} /> : null}</KartenBlock> : <KartenBlock label="Rechnung"><Zustand art={card.payment.kind === "restricted" ? "gesperrt" : "fehler"} text={card.payment.message} /></KartenBlock>}
    {actions.freeze.visible && !actions.freeze.enabled && actions.freeze.reason?.includes("Stundensatz") ? <Hinweis ton="warn">{actions.freeze.reason} <a href={`/settings?returnTo=${encodeURIComponent(`/orders/${card.id}`)}#extra-work-rate`}>Stundensatz jetzt einrichten</a>.</Hinweis> : null}
    {!responsibilityFeedback&&actions.feedback.kind !== "idle" ? (actions.feedback.kind === "submitting"||actions.feedback.kind === "pending") ? <Zustand art="laedt" text={actions.feedback.message} /> : <Hinweis ton={actions.feedback.kind === "success" ? "ok" : "warn"}>{actions.feedback.message}{actions.feedback.kind === "conflict" ? <Button art="sekundaer" icon="refresh" text="Neu laden" onClick={() => void actions.onReload()} /> : null}</Hinweis> : null}
    {notice ? <Hinweis ton="warn">{notice}</Hinweis> : null}
  </>;

  const rail = <>{device === "desktop" && quickActions.length ? <KartenBlock><Schnellaktionen aktionen={quickActions} als="raster" /></KartenBlock> : null}<KartenBlock label="Verlauf"><Verlauf eintraege={history} /></KartenBlock></>;
  const footer = device === "desktop" ? <footer className="kr-kartenfuss"><Button text="Schließen" onClick={onClose} />{next ? <Button art="primaer" icon={next.icon} text={next.text} disabled={!next.enabled} onClick={next.onClick} /> : null}</footer> : quickActions.length ? <Schnellaktionen aktionen={quickActions} als="dock" /> : undefined;

  return <>
    <Seitenblatt titel={`Auftragskarte ${card.orderNumber}`} onSchliessen={onClose}>
      <div data-spec-id="auftrag" style={{ display: "contents" }}>
        <Karte kopf={head} kette={chain} haupt={main} rail={rail} fuss={footer} />
        {photosOpen&&photoPanel?<Dialog titel="Fotos & Dokumente" icon="camera" groesse="breit" onSchliessen={()=>setPhotosOpen(false)} vorSchliessen={()=>!document.querySelector('[data-r53-photo-layer] [data-domain-uploading="true"]')}><div data-r53-photo-layer>{photoPanel}</div></Dialog>:null}
      </div>
    </Seitenblatt>
    {invoiceSuccess ? <Dialog
      titel="Rechnung ausgestellt"
      icon="receipt"
      groesse="schmal"
      onSchliessen={() => setDismissedInvoiceReceiptId(invoiceSuccess.receipt.receiptId)}
      meldung={{ text: invoiceSuccess.message, ton: "erfolg" }}
      fuss={<Button art="primaer" icon="check" text="Schließen" onClick={() => setDismissedInvoiceReceiptId(invoiceSuccess.receipt.receiptId)} />}
    >
      <Hinweis ton="ok">Die Rechnung ist gespeichert und in der Auftragskarte nachgelesen.</Hinweis>
    </Dialog> : null}
    {goodsOutOpen ? <GoodsOutDialog
      card={card}
      actions={actions}
      onClose={() => setGoodsOutOpen(false)}
      onOpenCustomer={() => onOpenCustomer(card.customerId)}
      onComplete={() => {
        setGoodsOutOpen(false);
        onClose();
      }}
    /> : null}
    {paymentOpen ? <Dialog titel="Zahlung bestätigen" icon="card" groesse="schmal" onSchliessen={() => setPaymentOpen(false)} meldung={actions.feedback.kind === "error" || actions.feedback.kind === "conflict" ? { text: actions.feedback.message, ton: "fehler" } : null} fuss={<><Button text="Abbrechen" disabled={actions.feedback.kind === "submitting"} onClick={() => setPaymentOpen(false)} /><Button art="primaer" icon="check" text="Zahlung bestätigen" disabled={!paymentMethod || actions.feedback.kind === "submitting"} onClick={async () => { if (!paymentMethod) return; const confirmed = await actions.onConfirmPayment(paymentMethod); if (confirmed) { setPaymentOpen(false); setPaymentMethod(""); } }} /></>}><Segment label="Zahlart" wert={paymentMethod} onWert={setPaymentMethod} optionen={[{ wert: "bar", text: "Bar" }, { wert: "ueberweisung", text: "Überweisung" }, { wert: "karte", text: "Karte" }]} />{(actions.feedback.kind === "submitting"||actions.feedback.kind === "pending") ? <Zustand art="laedt" text={actions.feedback.message} /> : null}</Dialog> : null}
    {invoicePriceOpen ? <Dialog titel="Preise für die Rechnung" icon="receipt" groesse="schmal" onSchliessen={() => setInvoicePriceOpen(false)}><form className="kr-stapel" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); const prices = missingInvoicePrices.map((item) => ({ itemId: item.id, unitPriceCents: Math.round(Number(form.get(`price-${item.id}`)) * 100) })); if (prices.some((price) => !Number.isSafeInteger(price.unitPriceCents) || price.unitPriceCents < 1)) return; void actions.onIssueInvoice(prices); setInvoicePriceOpen(false); }}>{missingInvoicePrices.map((item) => <Feld key={item.id} label={`${item.name} · Einzelpreis netto`}><Eingabe name={`price-${item.id}`} type="number" min="0.01" step="0.01" inputMode="decimal" required /></Feld>)}<Hinweis>Die Preise werden am Auftrag gespeichert und direkt in die unveränderliche Rechnung übernommen.</Hinweis><Button art="primaer" icon="receipt" text="Preise speichern & Rechnung ausstellen" type="submit" /></form></Dialog> : null}
    {dueOpen ? <Dialog titel="Liefertermin ändern" icon="calendar" groesse="schmal" onSchliessen={() => setDueOpen(false)}><form className="kr-stapel" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void actions.onChangeDueDate?.(String(form.get("dueDate") ?? ""), String(form.get("reason") ?? "")); setDueOpen(false); }}><Feld label="Neuer Liefertermin"><Eingabe type="date" name="dueDate" defaultValue={card.dueAt?.slice(0, 10) ?? ""} required /></Feld><Feld label="Grund der Änderung"><Textfeld name="reason" minLength={3} maxLength={500} required /></Feld><Button art="primaer" icon="calendar" text="Termin mit Grund speichern" type="submit" /></form></Dialog> : null}
    {noteOpen ? <Dialog titel="Auftragsnotiz bearbeiten" icon="edit" groesse="schmal" onSchliessen={() => setNoteOpen(false)}><form className="kr-stapel" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); const value = String(form.get("note") ?? "").trim(); void actions.onSaveContent?.({ note: value || null, items: contentItems }); setNoteOpen(false); }}><Feld label="Notiz"><Textfeld name="note" defaultValue={card.note ?? ""} maxLength={2000} /></Feld><Button art="primaer" icon="check" text="Notiz speichern" type="submit" /></form></Dialog> : null}
    {itemOpen ? <OrderItemDialog card={card} itemId={itemOpen} onClose={() => setItemOpen(null)} onSave={(items) => { void actions.onSaveContent?.({ note: card.note, items }); setItemOpen(null); }} /> : null}
    {moreOpen ? <Dialog titel="Mehr zum Auftrag" icon="more" groesse="schmal" onSchliessen={() => setMoreOpen(false)}><div className="kr-stapel">{device !== "desktop" && actions.label.visible ? <Button art="sekundaer" icon="file" text="Laufzettel drucken" disabled={!actions.label.enabled} onClick={() => { void actions.onPrintLabel(); setMoreOpen(false); }} /> : null}<Button art="sekundaer" icon="file" text="KV anlegen" onClick={() => { actions.onOpenQuote?.(); setMoreOpen(false); }} /><Button art="sekundaer" icon="copy" text="Duplizieren" onClick={() => { void actions.onDuplicate?.(); setMoreOpen(false); }} /><Button art="sekundaer" icon="upload" text="Dokument hinzufügen" onClick={() => { actions.onOpenDocument?.(); setMoreOpen(false); }} />{actions.onRecordComplaint?<Button data-spec-id="auftrag.reklamation" art="sekundaer" icon="alert" text="Reklamation" onClick={()=>{setMoreOpen(false);actions.onRecordComplaint?.();}}/>:null}</div></Dialog> : null}
  </>;
}

function GoodsOutDialog({
  card,
  actions,
  onClose,
  onOpenCustomer,
  onComplete,
}: {
  card: OrderCardData;
  actions: OrderCardActionPorts;
  onClose: () => void;
  onOpenCustomer: () => void;
  onComplete: () => void;
}) {
  const mode = goodsOutMode(card);
  const agreement = card.agreement ?? null;
  const payment = card.payment.kind === "available" ? card.payment.value : null;
  const busy = actions.feedback.kind === "submitting";
  const failure = actions.feedback.kind === "error" || actions.feedback.kind === "conflict"
    ? actions.feedback.message
    : null;
  const paymentAtPickup = mode === "abholung"
    && payment?.mode === "abholung"
    && payment.invoiceState === "issued"
    && actions.payment.enabled;
  const paymentAllowsGoodsOut = payment?.goodsOutAllowed === true;
  const agreementSpecId = agreement?.type === "sammelrechnung"
    ? "rauspruefen.uebergeben-sammelrechnung"
    : agreement?.type === "zahlungsziel"
      ? "rauspruefen.uebergeben-zahlungsziel"
      : "rauspruefen.uebergeben-rechnung-folgt";
  const agreementButton = agreement && mode
    ? goodsOutAgreementButtonText(agreement, mode)
    : null;
  const inactiveText = card.agreementHint ? agreementHintText(card.agreementHint) : null;

  const record = async () => {
    if (!mode) return;
    const completed = await actions.onRecordGoodsOut(mode, agreement ?? undefined);
    if (completed) onComplete();
  };
  const confirmAndRecord = async (method: "bar" | "karte") => {
    if (!mode) return;
    const paid = await actions.onConfirmPayment(method);
    if (!paid) return;
    const completed = await actions.onRecordGoodsOut(mode);
    if (completed) onComplete();
  };
  const genericButton = mode === "versand" ? "Versendet" : "Übergeben";
  const agreementValid = Boolean(agreement && agreementButton);
  const noPaymentPath = !agreementValid && !paymentAllowsGoodsOut && !paymentAtPickup;

  return <Dialog
    titel="Warenausgang"
    icon="truck"
    groesse="breit"
    onSchliessen={onClose}
    meldung={failure ? { text: failure, ton: "fehler" } : null}
    fuss={<>
      <Button text="Abbrechen" disabled={busy} onClick={onClose} />
      {paymentAtPickup ? <>
        <Button art="primaer" icon="card" text="Bar bezahlt · übergeben" disabled={busy} onClick={() => void confirmAndRecord("bar")} />
        <Button art="primaer" icon="card" text="Karte bezahlt · übergeben" disabled={busy} onClick={() => void confirmAndRecord("karte")} />
      </> : null}
      {agreementValid ? <Button
        data-spec-id={agreementSpecId}
        art={paymentAtPickup ? "sekundaer" : "primaer"}
        icon="truck"
        text={agreementButton ?? ""}
        disabled={busy || mode === null}
        onClick={() => void record()}
      /> : null}
      {!agreementValid && paymentAllowsGoodsOut && mode ? <Button
        art="primaer"
        icon="truck"
        text={genericButton}
        disabled={busy}
        onClick={() => void record()}
      /> : null}
    </>}
  >
    <div data-spec-id="rauspruefen" className="kr-stapel">
      <OrderHandoverPanel card={card}/>
      <div data-spec-id="rauspruefen.kopf" className="kr-stapel">
        <Fakten zeilen={[
          { k: "Auftrag", v: card.orderNumber },
          { k: "Kunde", v: card.customerName },
        ]} />
        <div className="kr-schnellleiste">
          <Button art="sekundaer" icon="file" text="Auftrag ansehen" disabled={busy} onClick={onClose} />
          <Button art="sekundaer" icon="user" text="Kunde ansehen" disabled={busy} onClick={onOpenCustomer} />
        </div>
      </div>
      <div data-spec-id="rauspruefen.zahlung" className="kr-stapel">
        {agreement ? <Hinweis ton="warn">
          <span data-spec-id="rauspruefen.absprache-kasten">
            Zahlungsabsprache · {agreement.label} · gilt für {agreement.orderId === card.id ? "diesen Auftrag" : "den ganzen Kunden"} · bis {agreement.validUntil ? dueLabel(agreement.validUntil) : "auf Widerruf"}
          </span>
          <br />
          angelegt {formatMoment(agreement.createdAt)} von {agreement.createdBy ?? "Login fehlt"} · Grund {agreement.reason}
        </Hinweis> : null}
        {inactiveText ? <Hinweis ton="warn"><span data-spec-id="rauspruefen.absprache-hinweis">{inactiveText}</span></Hinweis> : null}
        {noPaymentPath ? <Hinweis ton="warn">Zahlung fehlt</Hinweis> : null}
        {mode === null ? <Hinweis ton="warn">Übergabeweg fehlt</Hinweis> : null}
        {noPaymentPath && actions.agreement?.visible ? <Button
          data-spec-id="rauspruefen.absprache-festlegen"
          art="sekundaer"
          icon="receipt"
          text="Absprache festlegen"
          disabled={!actions.agreement.enabled || busy}
          onClick={actions.agreement.onCreate}
        /> : null}
      </div>
      {busy ? <Zustand art="laedt" text={actions.feedback.message} /> : null}
    </div>
  </Dialog>;
}

function OrderItemDialog({ card, itemId, onClose, onSave }: { card: Extract<OrderCardState, { kind: "data" }>["card"]; itemId: string | "new"; onClose: () => void; onSave: (items: NonNullable<Parameters<NonNullable<OrderCardActionPorts["onSaveContent"]>>[0]>["items"]) => void }) {
  const existing = itemId === "new" ? null : card.items.find((item) => item.id === itemId) ?? null;
  const [serviceId, setServiceId] = useState(existing?.catalogServiceId ?? "");
  const [name, setName] = useState(existing?.name ?? "");
  const [surface, setSurface] = useState(existing?.surface ?? "");
  const service = card.catalog?.find((entry) => entry.id === serviceId);
  const surfaces = [...new Set([...SURFACE_OPTIONS, ...(existing?.surface ? [existing.surface] : []), ...(card.catalog ?? []).map((entry) => entry.surface)])];
  const selectName = (value: string) => {
    const matches = (card.catalog ?? []).filter((entry) => entry.name.localeCompare(value.trim(), "de-DE", { sensitivity: "base" }) === 0);
    const selected = matches.length === 1 ? matches[0] : null;
    setName(value);
    setServiceId(selected?.id ?? "");
    if (selected) setSurface(selected.surface);
  };
  return <Dialog titel={existing ? "Teil bearbeiten" : "Teil hinzufügen"} icon={existing ? "edit" : "plus"} groesse="schmal" onSchliessen={onClose}><form className="kr-stapel" onSubmit={(event) => {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const base = service ? { catalogServiceId: service.id, name: service.name, surface: service.surface, unit: service.unit, unitPriceCents: service.netPriceCents, vatRateBasisPoints: service.vatRateBasisPoints } : { catalogServiceId: null, name: String(form.get("name") ?? ""), surface: String(form.get("surface") ?? ""), unit: null, unitPriceCents: null, vatRateBasisPoints: null };
    const changed = { id: existing?.id ?? crypto.randomUUID(), ...base, quantity: Number(form.get("quantity")), material: String(form.get("material") ?? "").trim() || null };
    const current = card.items.map((item) => ({ id: item.id, catalogServiceId: item.catalogServiceId ?? null, name: item.name, quantity: item.quantity, material: item.material, surface: item.surface, unit: item.unit ?? null, unitPriceCents: item.unitPriceCents ?? null, vatRateBasisPoints: item.vatRateBasisPoints ?? null }));
    onSave(existing ? current.map((item) => item.id === existing.id ? changed : item) : [...current, changed]);
  }}><datalist id="kr-order-item-catalog">{(card.catalog ?? []).map((entry) => <option key={entry.id} value={entry.name}>{entry.surface}</option>)}</datalist><Feld label="Teil / Bezeichnung"><Eingabe name="name" list="kr-order-item-catalog" placeholder="Katalog oder Freitext" value={name} onChange={(event) => selectName(event.target.value)} required minLength={2} maxLength={160} /></Feld><Feld label="Oberfläche"><Auswahl name="surface" value={surface} onChange={(event) => { setSurface(event.target.value); if (service?.surface !== event.target.value) setServiceId(""); }} optionen={[{ wert: "", text: "Bitte wählen" }, ...surfaces.map((entry) => ({ wert: entry, text: entry }))]} required /></Feld><Feld label="Menge"><Eingabe name="quantity" type="number" min={1} max={1_000_000} defaultValue={existing?.quantity ?? 1} required /></Feld><Feld label="Material"><Eingabe name="material" defaultValue={existing?.material ?? ""} maxLength={120} /></Feld><Button art="primaer" icon="check" text={existing ? "Teil speichern" : "Teil hinzufügen"} type="submit" /></form></Dialog>;
}
