"use client";

import type { OrderCardModel, OrderCardState } from "../server/types";
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
    if (!card.payment) return "Zahlungs- und Ausgangsstand sicher neu laden";
    if ((card.payment.mode === "vorkasse" || card.payment.mode === "abholung") && card.payment.status !== "bezahlt") {
      return "Vollzahlung bestätigen; Warenausgang bleibt gesperrt";
    }
    return "Versand oder Abholung bestätigen";
  }
  if (!card.payment) return "Auftragsstand sicher neu laden";
  if (card.payment.invoiceState === "not_issued" && card.payment.mode === "rechnung") return "Rechnung aus dem bestätigten Ausgang erstellen";
  if (card.payment.status !== "bezahlt") return "Offenen Zahlungseingang bestätigen";
  return "Auftrag ist abgeschlossen";
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

export function OrderCardView({ state, onOpenCustomer, onClose }: {
  state: OrderCardState;
  onOpenCustomer: (customerId: string) => void;
  onClose: () => void;
}) {
  if (state.kind !== "data") return <StateCard state={state} onClose={onClose} />;
  const { card } = state;
  const due = dueState(card);
  const stageIndex = Math.max(0, STAGES.indexOf(card.station as (typeof STAGES)[number]));
  const paymentLabel = !card.payment ? "Ab Fertigstellung verbindlich geprüft" : card.payment.invoiceState === "not_issued"
    ? "Rechnung noch nicht gestellt"
    : card.payment.status === "bezahlt" ? "Vollständig bezahlt" : card.payment.status === "teilbezahlt" ? "Teilbezahlt" : "Zahlung offen";

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
      <div className={styles.paymentGate} data-allowed={card.payment?.goodsOutAllowed ?? false}>
        <span>Zahlung · getrennte Schwelle</span><strong>{paymentLabel}</strong>
        {card.payment?.openAmountCents !== null && card.payment?.openAmountCents !== undefined && <small>Offen {(card.payment.openAmountCents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}</small>}
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
            {card.payment?.goodsOut && <li><time>{dateTimeLabel(card.payment.goodsOut.occurredAt)}</time><strong>Warenausgang bestätigt</strong><span>{card.payment.goodsOut.mode} · Event {card.payment.goodsOut.eventId.slice(0, 8)}</span></li>}
            {card.frozenAt && <li><time>{dateTimeLabel(card.frozenAt)}</time><strong>Auftragsstand eingefroren</strong><span>{card.totalAmountCents !== null ? (card.totalAmountCents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" }) : "Betrag im Readback nicht vorhanden"}</span></li>}
            <li><time>{dateTimeLabel(card.intakeAt)}</time><strong>Wareneingang erfasst</strong><span>Version {card.version}</span></li>
          </ol>
        </section>
        <section className={styles.section}><div className={styles.sectionHeader}><h3>Schnellaktionen</h3></div><p className={styles.empty}>Fachaktionen werden nur im bestätigten Auftragsfluss angeboten. Diese Karte erzeugt keinen zweiten Schreibweg.</p></section>
      </aside>
    </div>

    <footer className={styles.actionDock}><button onClick={() => onOpenCustomer(card.customerId)}>Kunde</button><button disabled>Foto +</button><button disabled>Notiz +</button><button disabled>Fachaktion</button><button className={styles.primaryAction} onClick={onClose}>Schließen</button></footer>
  </section>;
}
