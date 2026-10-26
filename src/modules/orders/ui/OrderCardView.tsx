"use client";
import { useState, type ReactNode } from "react";
import {
  ArrowLeft,
  CalendarClock,
  Check,
  ChevronRight,
  FileText,
  PackageCheck,
  ReceiptText,
  RefreshCw,
  Truck,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";
import type {
  OrderCardActionPorts,
  OrderCardModel,
  OrderCardState,
} from "../server/types";
import styles from "./orders.module.css";

const STATIONS = ["angenommen", "galvanik", "fertig", "zahlung", "abgeholt"] as const;
function money(cents: number | null) {
  return cents === null
    ? null
    : new Intl.NumberFormat("de-DE", {
        style: "currency",
        currency: "EUR",
      }).format(cents / 100);
}
function dueLabel(value: string | null) {
  if (!value) return "Kein Termin belegt";
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "Termin nicht lesbar";
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
function nextStep(card: OrderCardModel, actions: OrderCardActionPorts) {
  if (actions.handoff.visible) return "Übergabe an die Galvanik";
  if (actions.freeze.visible) return "Fertig melden und Abrechnung einfrieren";
  if (actions.invoice.visible) return "Rechnung unveränderlich ausstellen";
  if (actions.payment.visible) return "Zahlungseingang bestätigen";
  if (actions.goodsOut.visible) return "Warenausgang bestätigen";
  return card.station === "abgeholt"
    ? "Auftrag ist ausgegeben"
    : "Kein weiterer freigegebener Schritt";
}
function ActionButton({
  label,
  enabled,
  reason,
  onClick,
  icon: Icon,
}: {
  label: string;
  enabled: boolean;
  reason: string | null;
  onClick: () => void;
  icon: typeof Check;
}) {
  return (
    <div className={styles.actionItem}>
      <button type="button" disabled={!enabled} onClick={onClick}>
        <Icon />
        <span>{label}</span>
      </button>
      {!enabled && reason ? <small>{reason}</small> : null}
    </div>
  );
}

export function OrderCardView({
  state,
  actions,
  attachmentPanel,
  onOpenCustomer,
  onClose,
}: {
  state: OrderCardState;
  actions: OrderCardActionPorts;
  attachmentPanel?: ReactNode;
  onOpenCustomer: (id: string) => void;
  onClose: () => void;
}) {
  const [paymentOpen, setPaymentOpen] = useState(false);
  if (state.kind === "loading")
    return (
      <article className={styles.cardState} aria-busy="true">
        <h1>Auftragskarte wird geladen</h1>
      </article>
    );
  if (state.kind !== "data")
    return (
      <article
        className={styles.cardState}
        role={state.kind === "error" ? "alert" : "status"}
      >
        <button type="button" onClick={onClose}>
          <ArrowLeft />
          Zurück
        </button>
        <h1>
          {state.kind === "not-found"
            ? "Auftrag nicht vorhanden"
            : state.kind === "denied"
              ? "Auftragskarte nicht freigegeben"
              : state.kind === "conflict"
                ? "Auftragsstand nicht eindeutig"
                : "Auftragskarte nicht verfügbar"}
        </h1>
        <p>{state.message}</p>
      </article>
    );
  const card = state.card;
  const payment = card.payment.kind === "available" ? card.payment.value : null;
  const current = card.station === "abgeholt" ? 4 : payment?.status === "bezahlt" ? 3 : Math.max(0, STATIONS.indexOf(card.station as (typeof STATIONS)[number]));
  const deadline = dueStatus(card.dueAt);
  const advanceFromChain = (station: (typeof STATIONS)[number]) => {
    if (station === "galvanik" && actions.handoff.visible && actions.handoff.enabled) return void actions.onHandoff();
    if (station === "fertig" && actions.freeze.visible && actions.freeze.enabled) return void actions.onFreeze();
    if (station === "zahlung" && actions.invoice.visible && actions.invoice.enabled) return void actions.onIssueInvoice();
    if (station === "zahlung" && actions.payment.visible && actions.payment.enabled) return setPaymentOpen(true);
    if (station === "abgeholt" && actions.goodsOut.visible && actions.goodsOut.enabled) return void actions.onRecordGoodsOut("abholung");
  };
  const realActions = [
    actions.handoff.visible,
    actions.evidence.visible,
    actions.freeze.visible,
    actions.invoice.visible,
    actions.payment.visible,
    actions.goodsOut.visible,
  ].filter(Boolean).length;
  const confirmPayment = async (method: "bar" | "ueberweisung" | "karte") => {
    await actions.onConfirmPayment(method);
    setPaymentOpen(false);
  };
  return (
    <article className={styles.orderCardV8} data-testid="order-card-v8">
      <header className={styles.cardHeader}>
        <button type="button" className={styles.back} onClick={onClose} aria-label="Zurück">
          <ArrowLeft />
          <span>Zurück</span>
        </button>
        <div className={styles.identityBlock}>
          <p>{card.orderNumber}</p>
          <h1>{card.title}</h1>
          <button type="button" onClick={() => onOpenCustomer(card.customerId)}>
            <UserRound /> {card.customerName}
            <ChevronRight />
          </button>
        </div>
        <div className={styles.due} data-overdue={deadline.overdue}>
          <small>Liefertermin</small>
          <strong>{deadline.relative}</strong>
          <small>{dueLabel(card.dueAt)}</small>
          <span data-station={card.station}>{card.station}</span>
        </div>
        <button
          type="button"
          className={styles.close}
          onClick={onClose}
          aria-label="Schließen"
        >
          <X />
        </button>
      </header>
      <div className={styles.cardScroll}>
        <section className={styles.lifecycle} aria-labelledby="lifecycle-title">
          <div className={styles.sectionTitle}>
            <p>Verlauf</p>
            <h2 id="lifecycle-title">Auftrag und Zahlung</h2>
          </div>
          <ol>
            {STATIONS.map((station, index) => (
              <li
                key={station}
                data-done={index <= current}
                data-current={index === current}
              >
                <button type="button" onClick={() => advanceFromChain(station)} disabled={index !== current + 1} aria-label={`${station} als nächsten Schritt ausführen`}>
                  <span>{index < current ? <Check /> : index + 1}</span>
                  <b>{station === "abgeholt" ? "abgeholt / verschickt" : station}</b>
                </button>
              </li>
            ))}
          </ol>
          <div className={styles.paymentGate}>
            <ReceiptText />
            <div>
              <small>Zahlung · getrennte Schwelle</small>
              {card.payment.kind === "available" ? (
                <>
                  <strong>
                    {payment?.mode} ·{" "}
                    {payment?.invoiceState === "issued"
                      ? (payment.status ?? "offen")
                      : "Rechnung noch nicht ausgestellt"}
                  </strong>
                  {payment?.openAmountCents !== null &&
                  payment?.openAmountCents !== undefined ? (
                    <span>Offen: {money(payment.openAmountCents)}</span>
                  ) : null}
                </>
              ) : (
                <>
                  <strong>
                    {card.payment.kind === "restricted"
                      ? "Details für diese Rolle geschützt"
                      : "Zahlungsstand nicht verfügbar"}
                  </strong>
                  <span>{card.payment.message}</span>
                </>
              )}
            </div>
          </div>
        </section>
        <section className={styles.next}>
          <small>Nächster echter Schritt</small>
          <h2>{nextStep(card, actions)}</h2>
          <p>
            Auftragsversion {card.version} · Zustand {card.status}
          </p>
        </section>
        <section className={styles.dueHistory} aria-labelledby="due-history-title">
          <div className={styles.sectionTitle}>
            <p>Termintreue</p>
            <h2 id="due-history-title">Liefertermin und Verlauf</h2>
          </div>
          {actions.dueDate?.visible && actions.onChangeDueDate ? (
            <form
              className={styles.dueEditor}
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                 void actions.onChangeDueDate?.(
                  String(form.get("dueDate") ?? ""),
                  String(form.get("reason") ?? ""),
                );
              }}
            >
              <label>
                Neuer Liefertermin
                <input
                  type="date"
                  name="dueDate"
                  defaultValue={card.dueAt?.slice(0, 10) ?? ""}
                  required
                />
              </label>
              <label>
                Grund der Änderung
                <textarea
                  name="reason"
                  minLength={3}
                  maxLength={500}
                  required
                  placeholder="Warum ändert sich der zugesagte Termin?"
                />
              </label>
              <button type="submit" disabled={!actions.dueDate?.enabled}>
                <CalendarClock />
                Termin mit Grund speichern
              </button>
              {!actions.dueDate?.enabled && actions.dueDate?.reason ? (
                <small>{actions.dueDate.reason}</small>
              ) : null}
            </form>
          ) : null}
          {card.dueDateChanges?.length ? (
            <ol className={styles.dueChangeList}>
              {card.dueDateChanges.map((change) => (
                <li key={change.eventId}>
                  <CalendarClock />
                  <span>
                    <strong>{dueLabel(change.changedTo)}</strong>
                    <small>{change.reason}</small>
                  </span>
                  <span>
                    <strong>{change.changedBy}</strong>
                    <small>{new Date(change.changedAt).toLocaleString("de-DE")}</small>
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className={styles.truthEmpty}>Noch keine Terminänderung gespeichert.</p>
          )}
        </section>
        <section className={styles.parts} aria-labelledby="parts-title">
          <div className={styles.sectionTitle}>
            <p>Positionen</p>
            <h2 id="parts-title">Teile und Leistungen</h2>
          </div>
          {card.items.length === 0 ? (
            <p className={styles.truthEmpty}>
              Für diesen Auftrag sind noch keine Positionen erfasst.
            </p>
          ) : (
            <ol>
              {card.items.map((item) => (
                <li key={item.id}>
                  <header>
                    <span>Pos. {item.position}</span>
                    <strong>
                      {item.quantity} × {item.name}
                    </strong>
                  </header>
                  <dl>
                    <div>
                      <dt>Material</dt>
                      <dd>{item.material ?? "Nicht hinterlegt"}</dd>
                    </div>
                    <div>
                      <dt>Oberfläche</dt>
                      <dd>{item.surface}</dd>
                    </div>
                  </dl>
                  {item.extraWork.length ? (
                    <ul>
                      {item.extraWork.map((line) => (
                        <li key={line.lineId}>
                          {line.name} · {line.minutes} Min. ·{" "}
                          {money(line.amountCents)}
                          {line.frozen ? " · eingefroren" : ""}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
          {actions.evidence.visible && attachmentPanel ? (
            <div>{attachmentPanel}</div>
          ) : null}
        </section>
        <div className={styles.detailGrid}>
          <section>
            <div className={styles.sectionTitle}>
              <p>Auftragsnotiz</p>
              <h2>Kontext</h2>
            </div>
            <p className={styles.truthEmpty}>
              {card.note ?? "Keine Auftragsnotiz hinterlegt."}
            </p>
            <dl className={styles.metaList}>
              <div>
                <dt>Zuständig</dt>
                <dd>{card.assignedTo ?? "Nicht zugewiesen"}</dd>
              </div>
              <div>
                <dt>Eingang</dt>
                <dd>{new Date(card.intakeAt).toLocaleString("de-DE")}</dd>
              </div>
              <div>
                <dt>Freeze</dt>
                <dd>
                  {card.frozenAt
                    ? new Date(card.frozenAt).toLocaleString("de-DE")
                    : "Noch nicht erfolgt"}
                </dd>
              </div>
            </dl>
          </section>
          <section>
            <div className={styles.sectionTitle}>
              <p>Originale und Belege</p>
              <h2>Dokumentation</h2>
            </div>
            {card.evidence.length ? (
              <ol className={styles.evidence}>
                {card.evidence.map((item) => (
                  <li key={item.key}>
                    <FileText />
                    <span>
                      <strong>{item.source}</strong>
                      <small>
                        {item.state} ·{" "}
                        {new Date(item.recordedAt).toLocaleString("de-DE")}
                      </small>
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className={styles.truthEmpty}>
                Noch keine Dokumente oder Fotos vorhanden.
              </p>
            )}
          </section>
        </div>
        {actions.feedback.kind !== "idle" ? (
          <section
            className={styles.feedback}
            data-kind={actions.feedback.kind}
            role={
              actions.feedback.kind === "error" ||
              actions.feedback.kind === "conflict"
                ? "alert"
                : "status"
            }
          >
            <strong>{actions.feedback.message}</strong>
            {actions.feedback.kind === "success" ? (
              <details>
                <summary>Technische Details für Support</summary>
                <small>
                  Vorgang durch {actions.feedback.receipt.actorId} ·{" "}
                  {new Date(
                    actions.feedback.receipt.occurredAt,
                  ).toLocaleString("de-DE")} · Ereignis{" "}
                  {actions.feedback.receipt.eventId} · Beleg{" "}
                  {actions.feedback.receipt.receiptId}
                </small>
              </details>
            ) : null}
            {actions.feedback.kind === "conflict" ? (
              <button type="button" onClick={() => void actions.onReload()}>
                <RefreshCw />
                Neu laden
              </button>
            ) : null}
          </section>
        ) : null}
      </div>
      {paymentOpen ? (
        <div className={styles.paymentOverlay} onMouseDown={(event) => { if (event.target === event.currentTarget) setPaymentOpen(false); }}>
          <section className={styles.paymentDialog} role="dialog" aria-modal="true" aria-labelledby="payment-dialog-title">
            <header><div><small>Zahlungseingang</small><h2 id="payment-dialog-title">Zahlart wählen und bestätigen</h2></div><button type="button" aria-label="Zahlung schließen" onClick={() => setPaymentOpen(false)}><X /></button></header>
            <p>Erst die tatsächlich erhaltene Zahlart wählen. Danach wird der Geldeingang verbindlich gespeichert.</p>
            <div>
              <button type="button" onClick={() => void confirmPayment("bar")}>Barzahlung bestätigen</button>
              <button type="button" onClick={() => void confirmPayment("ueberweisung")}>Überweisung bestätigen</button>
              <button type="button" onClick={() => void confirmPayment("karte")}>Kartenzahlung bestätigen</button>
            </div>
          </section>
        </div>
      ) : null}
      {realActions > 0 ? (
        <footer className={styles.actionDock} aria-label="Auftragsaktionen">
          {actions.handoff.visible ? (
            <ActionButton
              label="In Galvanik"
              enabled={actions.handoff.enabled}
              reason={actions.handoff.reason}
              onClick={() => void actions.onHandoff()}
              icon={PackageCheck}
            />
          ) : null}
          {actions.freeze.visible ? (
            <ActionButton
              label="Fertig melden"
              enabled={actions.freeze.enabled}
              reason={actions.freeze.reason}
              onClick={() => void actions.onFreeze()}
              icon={Check}
            />
          ) : null}
          {actions.invoice.visible ? (
            <ActionButton
              label="Rechnung"
              enabled={actions.invoice.enabled}
              reason={actions.invoice.reason}
              onClick={() => void actions.onIssueInvoice()}
              icon={ReceiptText}
            />
          ) : null}
          {actions.payment.visible ? (
            <ActionButton
              label="Zahlung bestätigen"
              enabled={actions.payment.enabled}
              reason={actions.payment.reason}
              onClick={() => setPaymentOpen(true)}
              icon={WalletCards}
            />
          ) : null}
          {actions.goodsOut.visible ? (
            <>
              <ActionButton
                label="Versand"
                enabled={actions.goodsOut.enabled}
                reason={actions.goodsOut.reason}
                onClick={() => void actions.onRecordGoodsOut("versand")}
                icon={Truck}
              />
              <ActionButton
                label="Abholung"
                enabled={actions.goodsOut.enabled}
                reason={actions.goodsOut.reason}
                onClick={() => void actions.onRecordGoodsOut("abholung")}
                icon={PackageCheck}
              />
            </>
          ) : null}
        </footer>
      ) : null}
    </article>
  );
}
