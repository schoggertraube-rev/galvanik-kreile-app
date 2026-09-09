"use client";

import { useEffect, useRef, useState } from "react";
import type {
  PhillipOrderCard,
  PhillipWerkstattViewModel,
  WerkstattHeldCard,
  WerkstattViewPorts,
} from "../server/types";
import styles from "./WerkstattView.module.css";

const PICKER_TITLE_ID = "werkstatt-order-picker-title";
const PICKER_DIALOG_ID = "werkstatt-order-picker";
const WARE_RAUS_HINT_ID = "werkstatt-ware-raus-hint";

function riskStatusClassName(risk: string): string {
  if (risk === "red" || risk === "blocked") return `${styles.statusBadge} ${styles.statusDanger}`;
  if (risk === "orange" || risk === "yellow") return `${styles.statusBadge} ${styles.statusWarning}`;
  if (risk === "green") return `${styles.statusBadge} ${styles.statusSuccess}`;
  return `${styles.statusBadge} ${styles.statusNeutral}`;
}

function HeldCard({ order, onOpenOrder }: { order: WerkstattHeldCard; onOpenOrder: (orderId: string) => void }) {
  const customerName = order.customerName ?? "Kunde nicht hinterlegt";
  return (
    <li
      className={`${styles.heldItem} ${order.heldGroup === "crit" ? styles.heldItemCrit : styles.heldItemSoon}`}
      data-testid={`werkstatt-held-${order.id}`}
    >
      <div className={styles.heldMain}>
        <div className={styles.heldTop}>
          <span className={styles.heldOrderNumber}>{order.orderNumber}</span>
          <span className={riskStatusClassName(order.risk)}>{order.statusText || order.status}</span>
        </div>
        <p className={styles.heldCustomer}>{customerName}</p>
        <p className={styles.heldTitle}>{order.title}</p>
        {order.dueValue ? (
          <p className={styles.heldDue}>{order.dueLabel || "Termin"}: {order.dueValue}</p>
        ) : null}
      </div>
      <button
        type="button"
        className={`${styles.heldOpenButton} ${styles.touchTarget}`}
        aria-label={`Auftrag ${order.orderNumber} von ${customerName} öffnen`}
        onClick={() => onOpenOrder(order.id)}
      >
        Auftrag öffnen
      </button>
    </li>
  );
}

export function WerkstattView({
  view,
  ports,
}: {
  view: PhillipWerkstattViewModel;
  ports: WerkstattViewPorts;
}) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [bundleFilterActive, setBundleFilterActive] = useState(false);
  const pickerTriggerRef = useRef<HTMLElement | null>(null);
  const pickerDialogRef = useRef<HTMLElement>(null);
  const pickerCloseRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef(false);

  const isData = view.kind === "data";
  const isEmpty = view.kind === "empty";
  const authorized = isData || isEmpty;
  const canCreateOrder = authorized && view.canCreateOrder;

  useEffect(() => {
    if (!isPickerOpen) {
      if (restoreFocusRef.current) {
        restoreFocusRef.current = false;
        pickerTriggerRef.current?.focus();
      }
      return;
    }

    pickerCloseRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        restoreFocusRef.current = true;
        setIsPickerOpen(false);
        return;
      }
      if (event.key !== "Tab") return;

      const dialog = pickerDialogRef.current;
      if (!dialog) return;
      const focusable = dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable.item(0);
      const last = focusable.item(focusable.length - 1);
      const active = document.activeElement;

      if (!dialog.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isPickerOpen]);

  const openPicker = (event: { currentTarget: HTMLElement }) => {
    pickerTriggerRef.current = event.currentTarget;
    restoreFocusRef.current = false;
    setIsPickerOpen(true);
  };

  const closePicker = () => {
    restoreFocusRef.current = true;
    setIsPickerOpen(false);
  };

  const selectOrder = (orderId: string) => {
    restoreFocusRef.current = false;
    setIsPickerOpen(false);
    ports.onOpenOrder(orderId);
  };

  const scanOrder = () => {
    restoreFocusRef.current = false;
    setIsPickerOpen(false);
    ports.onScanOrder();
  };

  const pickerOrders: readonly PhillipOrderCard[] = isData ? view.pickerOrders : [];
  const heldOrders = isData
    ? bundleFilterActive && view.bundleSuggestion
      ? view.bundleSuggestion.orders
      : view.held
    : [];

  return (
    <section className={styles.screen} aria-labelledby="werkstatt-title">
      <div className={styles.inner}>
        <header className={styles.hero}>
          <p className={styles.eyebrow}>Werkstatt</p>
          <h1 id="werkstatt-title" className={styles.title}>Werkstatt</h1>
          {isData ? (
            view.dringendCount === 0 ? (
              <p className={`${styles.lead} ${styles.leadClear}`} role="status" data-testid="werkstatt-status">
                {view.greetingName ? `Servus ${view.greetingName}. ` : ""}
                Werkstatt läuft rund · nichts hängt.
              </p>
            ) : (
              <p className={styles.lead} data-testid="werkstatt-status">
                {view.greetingName ? `Servus ${view.greetingName}. ` : ""}
                <span className={styles.leadUrgent}><b>{view.dringendCount}</b> dringend</span>
                {" · "}
                <b>{view.weitereCount}</b> weitere
              </p>
            )
          ) : (
            <p className={styles.lead}>Eingang prüfen, Arbeit sicher übergeben.</p>
          )}
        </header>

        {view.kind === "denied" ? (
          <div className={styles.statePanel} role="status">
            <h2>Dieser Bereich ist geschützt</h2>
            <p>{view.message}</p>
          </div>
        ) : null}

        {view.kind === "error" ? (
          <div className={styles.statePanel} role="alert">
            <h2>Werkstatt nicht verfügbar</h2>
            <p>{view.message}</p>
          </div>
        ) : null}

        {view.kind === "conflict" ? (
          <div className={styles.statePanel} role="alert">
            <h2>Werkstattkonflikt</h2>
            <p>{view.message}</p>
          </div>
        ) : null}

        {isEmpty ? (
          <div className={styles.statePanel} role="status">
            <h2>Noch keine Daten erfasst</h2>
            <p>Sobald Aufträge im Wareneingang oder in der Galvanik liegen, erscheinen sie hier.</p>
          </div>
        ) : null}

        {isData ? (
          <div className={styles.cols}>
            <section aria-labelledby="werkstatt-held-title">
              <div className={styles.sectionHead}>
                <h2 id="werkstatt-held-title" className={styles.sectionTitle}>Heute sichern</h2>
                <span className={styles.sectionHint}>nach Termin · was heute Aufmerksamkeit braucht</span>
              </div>
              {heldOrders.length === 0 ? (
                <p className={styles.calmNote}>Keine dringenden oder knappen Aufträge.</p>
              ) : (
                <ul className={styles.heldList} data-testid="werkstatt-held-list">
                  {heldOrders.map((order) => (
                    <HeldCard key={order.id} order={order} onOpenOrder={ports.onOpenOrder} />
                  ))}
                </ul>
              )}
            </section>

            <div className={styles.rail}>
              {view.bundleSuggestion ? (
                <div className={styles.bundle} data-testid="werkstatt-bundle">
                  <p className={styles.bundleHeading}>Bündeln heute</p>
                  <p className={styles.bundleText}>
                    {view.bundleSuggestion.orders.length} Aufträge mit <b>{view.bundleSuggestion.surfaceRequested}</b>
                  </p>
                  <button
                    type="button"
                    className={`${styles.bundleButton} ${styles.touchTarget}`}
                    aria-pressed={bundleFilterActive}
                    onClick={() => setBundleFilterActive((active) => !active)}
                  >
                    {bundleFilterActive ? "Alle Aufträge zeigen" : "Nur diese Aufträge zeigen"}
                  </button>
                </div>
              ) : null}

              <button
                type="button"
                className={styles.wipTile}
                data-testid="werkstatt-wip-tile"
                onClick={ports.onOpenWip}
              >
                <span className={styles.wipLabel}>In Arbeit (Galvanik)</span>
                <span className={styles.wipCount}>{view.wipCount}</span>
              </button>

              <div className={styles.infoTile} data-testid="werkstatt-due-week-tile">
                <p className={styles.infoLabel}>Fällig diese Woche</p>
                <p className={styles.infoCount}>{view.dueThisWeekCount}</p>
              </div>
            </div>
          </div>
        ) : null}

        {authorized ? (
          <nav className={styles.actionBar} aria-label="Werkstattaktionen">
            {isData ? (
              <button
                type="button"
                className={`${styles.actionPrimary} ${styles.touchTarget}`}
                aria-haspopup="dialog"
                aria-expanded={isPickerOpen}
                aria-controls={PICKER_DIALOG_ID}
                onClick={openPicker}
              >
                Auftrag öffnen / scannen
              </button>
            ) : null}
            {isData ? (
              <button
                type="button"
                className={`${styles.actionSecondary} ${styles.touchTarget}`}
                aria-haspopup="dialog"
                aria-expanded={isPickerOpen}
                aria-controls={PICKER_DIALOG_ID}
                onClick={openPicker}
              >
                Mehrarbeit
              </button>
            ) : null}
            {isData ? (
              <button
                type="button"
                className={`${styles.actionSecondary} ${styles.touchTarget}`}
                aria-haspopup="dialog"
                aria-expanded={isPickerOpen}
                aria-controls={PICKER_DIALOG_ID}
                onClick={openPicker}
              >
                Fertig melden
              </button>
            ) : null}
            {canCreateOrder ? (
              <button
                type="button"
                className={`${styles.actionSecondary} ${styles.touchTarget}`}
                onClick={ports.onCreateOrder}
              >
                Neuer Eingang
              </button>
            ) : null}
            <div className={styles.actionGhostGroup}>
              <button
                type="button"
                className={`${styles.actionGhost} ${styles.touchTarget}`}
                disabled
                aria-disabled="true"
                aria-describedby={WARE_RAUS_HINT_ID}
              >
                Ware raus
              </button>
              <p id={WARE_RAUS_HINT_ID} className={styles.actionHint}>kommt mit F1.5-C</p>
            </div>
          </nav>
        ) : null}

        {isData && isPickerOpen ? (
          <div className={styles.pickerBackdrop}>
            <section
              ref={pickerDialogRef}
              id={PICKER_DIALOG_ID}
              className={styles.pickerDialog}
              role="dialog"
              aria-modal="true"
              aria-labelledby={PICKER_TITLE_ID}
            >
              <header className={styles.pickerHeader}>
                <div>
                  <p className={styles.pickerKicker}>Echte Werkstattaufträge</p>
                  <h2 id={PICKER_TITLE_ID} className={styles.pickerTitle}>Auftrag öffnen</h2>
                </div>
                <button
                  ref={pickerCloseRef}
                  type="button"
                  className={`${styles.pickerClose} ${styles.touchTarget}`}
                  onClick={closePicker}
                >
                  Schließen
                </button>
              </header>
              <p className={styles.pickerIntro}>Galvanik zuerst, danach Wareneingang.</p>
              <button
                type="button"
                className={`${styles.pickerScan} ${styles.touchTarget}`}
                onClick={scanOrder}
              >
                Auftrag scannen
              </button>
              <ul className={styles.pickerList}>
                {pickerOrders.map((order) => (
                  <li key={order.id}>
                    <button
                      type="button"
                      className={`${styles.pickerOrder} ${styles.touchTarget}`}
                      data-testid={`order-picker-order-${order.id}`}
                      aria-label={`Auftrag ${order.orderNumber} öffnen`}
                      onClick={() => selectOrder(order.id)}
                    >
                      <span className={styles.pickerOrderCopy}>
                        <span className={styles.pickerOrderNumber}>{order.orderNumber}</span>
                        {order.customerName ? (
                          <span className={styles.pickerCustomer}>{order.customerName}</span>
                        ) : null}
                        <span className={styles.pickerOrderTitle}>{order.title}</span>
                      </span>
                      <span className={styles.pickerStatus}>{order.statusText || order.status}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        ) : null}
      </div>
    </section>
  );
}
