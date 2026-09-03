"use client";

import Link from "next/link";
import { useErfassung } from "@/components/erfassung/ErfassungProvider";
import { usePageView } from "@/hooks/usePageView";
import { useOverlayStore } from "@/lib/overlayStore";
import type { WarendurchlaufOrder } from "./actions";
import styles from "./PhillipWerkstatt.module.css";

export type PhillipOrderCard = Pick<
  WarendurchlaufOrder,
  | "id"
  | "orderNumber"
  | "customerName"
  | "title"
  | "itemDescription"
  | "surfaceRequested"
  | "station"
  | "status"
  | "statusText"
  | "risk"
  | "dueLabel"
  | "dueValue"
>;

export type PhillipWerkstattViewModel =
  | { kind: "data"; canCreateOrder: boolean; wareneingang: PhillipOrderCard[]; galvanik: PhillipOrderCard[] }
  | { kind: "empty"; canCreateOrder: boolean }
  | { kind: "denied"; message: string }
  | { kind: "conflict"; message: string }
  | { kind: "error"; message: string };

type OrderColumnProps = {
  title: string;
  kicker: string;
  surface: "wareneingang" | "galvanik";
  priority: "main" | "supporting";
  description: string;
  href: string;
  orders: readonly PhillipOrderCard[];
  onOpenOrder: (orderId: string) => void;
};

function OrderColumn({
  title,
  kicker,
  surface,
  priority,
  description,
  href,
  orders,
  onOpenOrder,
}: OrderColumnProps) {
  const titleId = title === "Wareneingang" ? "wareneingang-title" : "galvanik-title";
  const panelClassName = priority === "main"
    ? `${styles.panel} ${styles.primaryPanel}`
    : `${styles.panel} ${styles.supportingPanel}`;

  const statusClassName = (risk: string) => {
    if (risk === "red" || risk === "blocked") return `${styles.statusBadge} ${styles.statusDanger}`;
    if (risk === "orange" || risk === "yellow") return `${styles.statusBadge} ${styles.statusWarning}`;
    if (risk === "green") return `${styles.statusBadge} ${styles.statusSuccess}`;
    return `${styles.statusBadge} ${styles.statusNeutral}`;
  };

  return (
    <section
      className={panelClassName}
      aria-labelledby={titleId}
      data-testid={`werkstatt-surface-${surface}`}
      data-priority={priority}
    >
      <header className={styles.panelHeader}>
        <div className={styles.panelHeading}>
          <p className={styles.panelKicker}>{kicker}</p>
          <h2 id={titleId} className={styles.sectionTitle}>{title}</h2>
          <p className={styles.sectionIntro}>{description}</p>
        </div>
      </header>

      {orders.length === 0 ? (
        <div className={styles.emptyState}>
          <p>Noch keine Daten erfasst.</p>
          <Link className={`${styles.stationLink} ${styles.touchTarget}`} href={href}>Station öffnen</Link>
        </div>
      ) : (
        <ul className={styles.orderList}>
          {orders.map((order) => {
            const customerName = order.customerName ?? "Kunde nicht hinterlegt";
            const statusText = order.statusText || order.status;

            return (
              <li key={order.id}>
                <button
                  type="button"
                  className={`${styles.orderButton} ${styles.touchTarget}`}
                  data-testid={`werkstatt-order-${order.id}`}
                  aria-label={`Auftrag ${order.orderNumber} von ${customerName} öffnen`}
                  onClick={() => onOpenOrder(order.id)}
                >
                  <span className={styles.orderTopline}>
                    <span className={styles.orderNumber}>{order.orderNumber}</span>
                    <span className={statusClassName(order.risk)}>{statusText}</span>
                  </span>
                  <span className={styles.customerName}>{customerName}</span>
                  <span className={styles.orderTitle}>{order.title}</span>
                  {order.itemDescription ? (
                    <span className={styles.orderDetail}>{order.itemDescription}</span>
                  ) : null}
                  {order.surfaceRequested ? (
                    <span className={styles.orderDetail}>{order.surfaceRequested}</span>
                  ) : null}
                  {order.dueValue ? (
                    <span className={styles.dueDate}>
                      {order.dueLabel || "Termin"}: {order.dueValue}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function WarendurchlaufCockpitClient({ view }: { view: PhillipWerkstattViewModel }) {
  usePageView();
  const { openErfassung } = useErfassung();
  const openOrder = useOverlayStore((state) => state.openOrder);

  const authorized = view.kind === "data" || view.kind === "empty";
  const canCreateOrder = authorized && view.canCreateOrder;
  const wareneingang = view.kind === "data" ? view.wareneingang : [];
  const galvanik = view.kind === "data" ? view.galvanik : [];

  return (
    <section className={styles.screen} aria-labelledby="werkstatt-title">
      <div className={styles.inner}>
        <header className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Phillip · Werkstatt</p>
            <h1 id="werkstatt-title" className={styles.title}>Werkstatt</h1>
            <p className={styles.lead}>Eingang prüfen, Arbeit sicher übergeben.</p>
          </div>
          <div className={styles.heroSignal} aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
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

        {authorized ? (
          <>
            <div className={styles.workbench} data-testid="phillip-workbench">
              <OrderColumn
                title="Galvanik / fertig gemeldet"
                kicker="Ein Galvanik-Schritt"
                surface="galvanik"
                priority="main"
                description="Aufträge in der Galvanik und bestätigte Fertigmeldungen."
                href="/warendurchlauf/galvanik"
                orders={galvanik}
                onOpenOrder={openOrder}
              />
              <OrderColumn
                title="Wareneingang"
                kicker="Annahme"
                surface="wareneingang"
                priority="supporting"
                description="Neu eingegangene Aufträge sicher aufnehmen."
                href="/warendurchlauf/wareneingang"
                orders={wareneingang}
                onOpenOrder={openOrder}
              />
            </div>

            <nav className={styles.actionBar} aria-label="Werkstattaktionen">
              <Link className={`${styles.primaryAction} ${styles.touchTarget}`} href="/warendurchlauf/galvanik">
                Galvanik öffnen
              </Link>
              {canCreateOrder ? (
                <button
                  type="button"
                  className={`${styles.secondaryAction} ${styles.touchTarget}`}
                  onClick={() => openErfassung({
                    mode: "order",
                    intent: "create_order",
                    source: "shortcut",
                    returnTo: "/warendurchlauf",
                  })}
                >
                  Neuer Eingang
                </button>
              ) : null}
              <Link className={`${styles.secondaryAction} ${styles.touchTarget}`} href="/warendurchlauf/wareneingang">
                Wareneingang öffnen
              </Link>
            </nav>
          </>
        ) : null}
      </div>
    </section>
  );
}
