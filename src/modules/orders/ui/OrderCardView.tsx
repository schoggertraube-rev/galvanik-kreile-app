"use client";

import { useState } from "react";
import type { OrderCardActionPorts, OrderCardModel, OrderCardState } from "../server/types";
import styles from "./orders.module.css";

const STAGES = ["angenommen", "galvanik", "fertig", "abgeholt"] as const;

function dateLabel(value: string | null): string {
  return value ? new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(value)) : "Nicht festgelegt";
}

function dateTimeLabel(value: string): string {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function dueState(card: OrderCardModel): { label: string; tone: string } {
  if (!card.dueAt) return { label: "Termin offen", tone: "neutral" };
  const days = Math.ceil((new Date(card.dueAt).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return { label: `${Math.abs(days)} Tag${Math.abs(days) === 1 ? "" : "e"} überfällig`, tone: "critical" };
  if (days <= 3) return { label: days === 0 ? "Heute fällig" : `In ${days} Tagen fällig`, tone: "urgent" };
  return { label: "Termin im Plan", tone: "ok" };
}

function nextStep(card: OrderCardModel): string {
  if (card.station === "angenommen") return "Auftrag an die Galvanik übergeben";
  if (card.station === "galvanik") return "Bearbeitung abschließen und fertig melden";
  if (card.station === "fertig") {
    if (card.payment.kind !== "available") return "Zahlungs- und Ausgangsstand sicher neu laden";
    if ((card.payment.value.mode === "vorkasse" || card.payment.value.mode === "abholung") && card.payment.value.status !== "bezahlt") {
      return "Vollzahlung bestätigen; Warenausgang bleibt gesperrt";
    }
    return "Versand oder Abholung bestätigen";
  }
  if (card.payment.kind !== "available") return "Auftragsstand sicher neu laden";
  if (card.payment.value.invoiceState === "not_issued" && card.payment.value.mode === "rechnung") return "Rechnung aus dem bestätigten Ausgang erstellen";
  if (card.payment.value.status !== "bezahlt") return "Offenen Zahlungseingang bestätigen";
  return "Auftrag ist abgeschlossen";
}

function OrderActions({ card, actions }: { card: OrderCardModel; actions: OrderCardActionPorts }) {
  const [paymentMethod, setPaymentMethod] = useState<"bar" | "ueberweisung" | "karte">("bar");
  const [goodsOutMode, setGoodsOutMode] = useState<"versand" | "abholung">("versand");
  const [evidenceItemId, setEvidenceItemId] = useState(card.items[0]?.id ?? "");
  const busy = actions.feedback.kind === "submitting";
  const entries = [
    { key: "handoff", label: "An Galvanik übergeben", value: actions.handoff, invoke: actions.onHandoff },
    { key: "freeze", label: "Fertig melden & einfrieren", value: actions.freeze, invoke: actions.onFreeze },
    { key: "invoice", label: "Rechnung ausstellen", value: actions.invoice, invoke: actions.onIssueInvoice },
  ] as const;
  return <section className={styles.actionPanel} aria-labelledby="order-actions-title">
    <div className={styles.sectionHeader}><h3 id="order-actions-title">Verbindliche Fachaktionen</h3></div>
    <div className={styles.actionGrid}>
      {entries.filter((entry) => entry.value.visible).map((entry) => <div key={entry.key} className={styles.actionCell}>
        <button type="button" disabled={!entry.value.enabled || busy} onClick={() => void entry.invoke()}>{entry.label}</button>
        {entry.value.reason && <small>{entry.value.reason}</small>}
      </div>)}
      {actions.evidence.visible && <div className={styles.actionCell}>
        {card.items.length > 1 && <label>Teil<select value={evidenceItemId} onChange={(event) => setEvidenceItemId(event.target.value)}>{card.items.map((item) => <option key={item.id} value={item.id}>{item.position}. {item.name}</option>)}</select></label>}
        <label className={styles.fileAction} aria-disabled={!actions.evidence.enabled || busy}>Zustandsfoto hinzufügen<input type="file" accept="image/jpeg,image/png,image/webp" disabled={!actions.evidence.enabled || busy} onChange={(event) => { const file = event.target.files?.[0]; if (file && evidenceItemId) void actions.onUploadEvidence(evidenceItemId, file); event.currentTarget.value = ""; }} /></label>
        {actions.evidence.reason && <small>{actions.evidence.reason}</small>}
      </div>}
      {actions.payment.visible && <div className={styles.actionCell}>
        <label>Zahlungsart<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as typeof paymentMethod)}><option value="bar">Bar</option><option value="ueberweisung">Überweisung</option><option value="karte">Karte</option></select></label>
        <button type="button" disabled={!actions.payment.enabled || busy} onClick={() => void actions.onConfirmPayment(paymentMethod)}>Offenen Betrag bestätigen</button>
        {actions.payment.reason && <small>{actions.payment.reason}</small>}
      </div>}
      {actions.goodsOut.visible && <div className={styles.actionCell}>
        <label>Ausgangsart<select value={goodsOutMode} onChange={(event) => setGoodsOutMode(event.target.value as typeof goodsOutMode)}><option value="versand">Versand</option><option value="abholung">Abholung</option></select></label>
        <button type="button" disabled={!actions.goodsOut.enabled || busy} onClick={() => void actions.onRecordGoodsOut(goodsOutMode)}>Warenausgang bestätigen</button>
        {actions.goodsOut.reason && <small>{actions.goodsOut.reason}</small>}
      </div>}
    </div>
    {actions.feedback.kind !== "idle" && <div className={styles.actionFeedback} data-state={actions.feedback.kind} role={actions.feedback.kind === "error" || actions.feedback.kind === "conflict" ? "alert" : "status"}>
      <strong>{actions.feedback.kind === "success" ? "Readback bestätigt" : actions.feedback.kind === "conflict" ? "Zwischenstand geändert" : actions.feedback.kind === "submitting" ? "Aktion läuft" : "Aktion nicht bestätigt"}</strong>
      <p>{actions.feedback.message}</p>
      {actions.feedback.kind === "success" && <dl><div><dt>Akteur</dt><dd>{actions.feedback.receipt.actorId}</dd></div><div><dt>Zeitpunkt</dt><dd>{dateTimeLabel(actions.feedback.receipt.occurredAt)}</dd></div><div><dt>Receipt</dt><dd>{actions.feedback.receipt.receiptId}</dd></div><div><dt>Event-ID</dt><dd>{actions.feedback.receipt.eventId}</dd></div></dl>}
      {(actions.feedback.kind === "error" || actions.feedback.kind === "conflict") && <button type="button" onClick={() => void actions.onReload()}>Sicher neu laden</button>}
    </div>}
  </section>;
}

function hasVisibleActions(actions: OrderCardActionPorts | undefined): actions is OrderCardActionPorts {
  return Boolean(actions && (
    actions.handoff.visible
    || actions.evidence.visible
    || actions.freeze.visible
    || actions.invoice.visible
    || actions.payment.visible
    || actions.goodsOut.visible
    || actions.feedback.kind !== "idle"
  ));
}

function StateCard({ state, onClose }: { state: Exclude<OrderCardState, { kind: "data" }>; onClose: () => void }) {
  const isLoading = state.kind === "loading";
  return <section className={styles.card} aria-live="polite">
    <header className={styles.stateHeader}><p className={styles.eyebrow}>Auftragskarte V8</p><button onClick={onClose}>Schließen</button></header>
    <div className={styles.statePanel} data-state={state.kind}>
      <h2>{isLoading ? "Auftragskarte wird geladen …" : state.kind === "denied" ? "Zugriff nicht erlaubt" : state.kind === "conflict" ? "Stand hat sich geändert" : state.kind === "not-found" ? "Auftrag nicht gefunden" : "Auftragskarte nicht verfügbar"}</h2>
      {!isLoading && <p role="alert">{state.message}</p>}
      {isLoading && <p role="status">Daten und Belege werden sicher gelesen.</p>}
    </div>
  </section>;
}

export function OrderCardView({ state, actions, onOpenCustomer, onClose }: {
  state: OrderCardState;
  actions?: OrderCardActionPorts;
  onOpenCustomer: (customerId: string) => void;
  onClose: () => void;
}) {
  if (state.kind !== "data") return <StateCard state={state} onClose={onClose} />;
  const { card } = state;
  const due = dueState(card);
  const stageIndex = Math.max(0, STAGES.indexOf(card.station as (typeof STAGES)[number]));
  const paymentLabel = card.payment.kind === "restricted" ? card.payment.message : card.payment.kind === "unavailable" ? card.payment.message : card.payment.value.invoiceState === "not_issued"
    ? `${card.payment.value.mode === "rechnung" ? "Rechnung" : card.payment.value.mode === "vorkasse" ? "Vorkasse" : "Zahlung bei Abholung"} · Rechnung noch nicht gestellt`
    : `${card.payment.value.mode === "rechnung" ? "Rechnung" : card.payment.value.mode === "vorkasse" ? "Vorkasse" : "Abholung"} · ${card.payment.value.status === "bezahlt" ? "Vollständig bezahlt" : card.payment.value.status === "teilbezahlt" ? "Teilbezahlt" : "Zahlung offen"}`;
  const showActions = hasVisibleActions(actions);

  return <section className={styles.card} aria-labelledby="order-card-title" data-testid="order-card-v8">
    <div className={styles.brandStripe} />
    <header className={styles.cardHeader}>
      <div className={styles.identity}>
        <p className={styles.eyebrow}>Auftrag <span>{card.orderNumber}</span></p>
        <h2 id="order-card-title">{card.title}</h2>
        <button className={styles.customerLink} onClick={() => onOpenCustomer(card.customerId)}>{card.customerName} · Kundenkarte öffnen →</button>
        <p className={styles.identityMeta}>{card.items.length} Position{card.items.length === 1 ? "" : "en"} · Eingang {dateLabel(card.intakeAt)}{card.assignedTo ? ` · Zuständig ${card.assignedTo}` : ""}</p>
      </div>
      <div className={`${styles.dueCard} ${styles[due.tone]}`}>
        <span>Liefertermin</span><strong>{due.label}</strong><time>{dateLabel(card.dueAt)}</time>
      </div>
      <button className={styles.closeButton} onClick={onClose} aria-label="Auftragskarte schließen">×</button>
    </header>

    <section className={styles.lifecycle} aria-label="Auftragsverlauf">
      <p className={styles.sectionKicker}>Ort im Haus</p>
      <ol>{STAGES.map((stage, index) => <li key={stage} data-state={index < stageIndex ? "done" : index === stageIndex ? "current" : "pending"}><span>{index < stageIndex ? "✓" : index + 1}</span><strong>{stage === "abgeholt" ? "Ausgang" : stage}</strong></li>)}</ol>
      <div className={styles.paymentGate} data-allowed={card.payment.kind === "available" && card.payment.value.goodsOutAllowed}>
        <span>Zahlung · getrennte Schwelle</span><strong>{paymentLabel}</strong>
        {card.payment.kind === "available" && card.payment.value.openAmountCents !== null && <small>Offen {(card.payment.value.openAmountCents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}</small>}
      </div>
    </section>

    <div className={styles.cardBody}>
      <main className={styles.mainColumn}>
        <section className={styles.nextAction}><p className={styles.sectionKicker}>Nächster Schritt</p><h3>{nextStep(card)}</h3><p>Aus dem aktuellen Orts-, Rechnungs- und Zahlungsstand abgeleitet.</p></section>

        <section className={styles.section} aria-labelledby="parts-title"><div className={styles.sectionHeader}><h3 id="parts-title">Teile · was ist zu tun</h3><span>{card.items.length} Positionen</span></div>
          <div className={styles.items}>{card.items.map((item) => <article key={item.id}>
            <span className={styles.position}>T-{String(item.position).padStart(2, "0")}</span>
            <div><strong>{item.name}</strong><p>{item.material ?? "Material nicht hinterlegt"} → {item.surface} · {item.quantity} Stück</p>
              {item.extraWork.length > 0 && <ul className={styles.extraWork}>{item.extraWork.map((line) => <li key={line.lineId}>{line.name} · {line.minutes} min · {(line.amountCents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}{line.frozen ? " · eingefroren" : ""}</li>)}</ul>}
            </div><span className={styles.statusChip}>{card.status}</span>
          </article>)}</div>
        </section>

        <section className={styles.section} aria-labelledby="notes-title"><div className={styles.sectionHeader}><h3 id="notes-title">Notizen</h3></div>
          {card.note ? <p className={styles.note}>{card.note}</p> : <p className={styles.empty}>Für diesen Auftrag ist keine Notiz hinterlegt.</p>}
        </section>

        <section className={styles.section} aria-labelledby="evidence-title"><div className={styles.sectionHeader}><h3 id="evidence-title">Fotos &amp; Dokumente</h3><span>{card.evidence.length} Belege</span></div>
          {card.evidence.length === 0 ? <p className={styles.empty}>Noch keine verifizierten Fotos oder Dokumente vorhanden.</p> : <ul className={styles.evidence}>{card.evidence.map((record) => <li key={record.key}><strong>{record.source === "ORDER_INTAKE_ATTACHMENT" ? "Eingangsfoto" : record.source === "ORDER_STATION_ATTACHMENT" ? "Zustandsfoto" : "Bestandsdokument"}</strong><span>{record.state} · {dateTimeLabel(record.recordedAt)}</span></li>)}</ul>}
        </section>
      </main>

      <aside className={styles.rail}>
        <section className={styles.section}><div className={styles.sectionHeader}><h3>Verlauf &amp; Belege</h3></div>
          <ol className={styles.timeline}>
            {card.payment.kind === "available" && card.payment.value.goodsOut && <li><time>{dateTimeLabel(card.payment.value.goodsOut.occurredAt)}</time><strong>Warenausgang bestätigt</strong><span>{card.payment.value.goodsOut.mode} · Event {card.payment.value.goodsOut.eventId.slice(0, 8)}</span></li>}
            {card.frozenAt && <li><time>{dateTimeLabel(card.frozenAt)}</time><strong>Auftragsstand eingefroren</strong><span>{card.totalAmountCents !== null ? (card.totalAmountCents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" }) : "Betrag im Readback nicht vorhanden"}</span></li>}
            <li><time>{dateTimeLabel(card.intakeAt)}</time><strong>Wareneingang erfasst</strong><span>Version {card.version}</span></li>
          </ol>
        </section>
        {showActions && <OrderActions card={card} actions={actions} />}
      </aside>
    </div>

    <footer className={styles.actionDock}><button onClick={() => onOpenCustomer(card.customerId)}>Kunde</button>{showActions && actions.evidence.visible && <button disabled={!actions.evidence.enabled || actions.feedback.kind === "submitting"} onClick={() => document.getElementById("order-actions-title")?.scrollIntoView({ behavior: "smooth", block: "center" })}>Foto +</button>}{showActions && <button onClick={() => document.getElementById("order-actions-title")?.scrollIntoView({ behavior: "smooth", block: "center" })}>Fachaktionen</button>}<button className={styles.primaryAction} onClick={onClose}>Schließen / zurück</button></footer>
  </section>;
}
