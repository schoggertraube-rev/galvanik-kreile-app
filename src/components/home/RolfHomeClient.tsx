"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Inbox, Truck, X } from "lucide-react";
import { requestGlobalCreate } from "@/components/layout/GlobalCreateFlow";
import { usePermissions } from "@/lib/auth/PermissionsContext";
import { useOverlayStore } from "@/lib/overlayStore";
import type { OrdersHomeProjection, OrdersHomeSource } from "@/modules/orders/public";
import styles from "./RolfHome.module.css";

type RolfIdentity = {
  role: "buero" | "meister" | "readonly";
  canCreateOrder: boolean;
};

export type RolfHomeModel =
  | ({ kind: "data"; projection: OrdersHomeProjection } & RolfIdentity)
  | ({ kind: "empty"; projection: OrdersHomeProjection } & RolfIdentity)
  | { kind: "denied"; message: string }
  | { kind: "error"; message: string };

function riskLabel(risk: OrdersHomeSource["risk"]): string {
  if (risk === "red") return "Kritisch";
  if (risk === "blocked") return "Blockiert";
  if (risk === "orange") return "Dringend";
  if (risk === "yellow") return "Knapp";
  if (risk === "green") return "im Plan";
  return "Ohne Risikowert";
}

function statusLabel(order: OrdersHomeSource): string {
  const labels: Record<string, string> = {
    angenommen: "Angenommen",
    wareneingang: "Angenommen",
    galvanik: "In Galvanik",
    fertig: "Fertig",
    raus: "Raus / abgeholt",
    abgeholt: "Raus / abgeholt",
    versendet: "Raus / abgeholt",
  };
  const status = order.statusText?.trim() || order.status;
  return labels[status.toLowerCase()] ?? labels[order.station.toLowerCase()] ?? "Status nicht hinterlegt";
}

function openOrdersLabel(count: number): string {
  return count === 1 ? "1 offener Auftrag" : `${count} offene Aufträge`;
}

function CompactOrderList({
  orders,
  onOpen,
}: {
  orders: readonly OrdersHomeSource[];
  onOpen: (orderId: string) => void;
}) {
  return (
    <ul className={styles.compactList}>
      {orders.slice(0, 3).map((order) => (
        <li key={order.id} className={styles.compactListRow}>
          <button
            type="button"
            className={styles.compactListOpen}
            aria-label={`Auftrag ${order.orderNumber} öffnen`}
            onClick={() => onOpen(order.id)}
          >
            <ArrowRight aria-hidden="true" />
          </button>
          <span className={styles.compactListCopy}>
            <span>
              <strong>{order.orderNumber}</strong>
              {order.customerName ?? "Kunde nicht hinterlegt"}
            </span>
            <small>{order.detail ?? order.title}</small>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function RolfHomeClient({ model }: { model: RolfHomeModel }) {
  const openOrder = useOverlayStore((state) => state.openOrder);
  const { hasPermission, loading: permissionsLoading } = usePermissions();
  const [goodsOutOpen, setGoodsOutOpen] = useState(false);

  if (model.kind === "denied") {
    return (
      <section className={styles.state} role="status">
        <h1>Der Tag</h1>
        <p>Du kannst den Tagesbestand nicht öffnen.</p>
      </section>
    );
  }
  if (model.kind === "error") {
    return (
      <section className={styles.state} role="alert">
        <h1>Der Tag</h1>
        <p>Der Tagesbestand ist gerade nicht verfügbar.</p>
      </section>
    );
  }

  const orders = model.projection.orders;
  const priority = model.projection.priority;
  const finished = orders.filter((order) => order.station === "fertig");
  const recent = model.projection.recent;
  const urgentCount = orders.filter((order) => ["red", "blocked", "orange"].includes(order.risk)).length;
  const canWrite = model.role !== "readonly";
  const canStartOrder = canWrite && model.canCreateOrder && !permissionsLoading && hasPermission("perm_data_orders");

  return (
    <section className={styles.screen} aria-labelledby="rolf-title" data-testid="rolf-v8-home">
      <header className={styles.hero}>
        <div>
          <h1 id="rolf-title">Der Tag</h1>
          <p className={styles.dayLine}>
            {orders.length === 0
              ? "Heute keine offenen Aufträge."
              : urgentCount === 0
                ? "Alle dringenden Punkte erledigt — nichts Kritisches offen."
                : `${urgentCount} dringend · ${orders.length - urgentCount} weitere brauchen dich.`}
          </p>
        </div>
      </header>

      <nav className={styles.quick} aria-label="Schnellaktionen">
        {canStartOrder ? (
          <button type="button" onClick={() => requestGlobalCreate("DIRECT_INTAKE")}>
            <Inbox aria-hidden="true" /><span><strong>Neuer Eingang</strong><small>Kunde, Teile und Termin</small></span>
          </button>
        ) : null}
        {canWrite ? (
          <button type="button" onClick={() => setGoodsOutOpen(true)} disabled={finished.length === 0}>
            <Truck aria-hidden="true" /><span><strong>Ware raus</strong><small>{finished.length === 1 ? "1 Auftrag fertig" : `${finished.length} Aufträge fertig`}</small></span>
          </button>
        ) : null}
      </nav>

      <div className={styles.grid}>
        <section className={styles.attention} aria-labelledby="attention-title">
          <header className={styles.sectionHeader}>
            <div><span className={styles.signal} aria-hidden="true" /><h2 id="attention-title">Das braucht dich</h2></div>
            <span>{openOrdersLabel(orders.length)}</span>
          </header>

          {priority.length === 0 ? (
            <p className={styles.sectionEmpty} role="status">Heute keine offenen Aufträge.</p>
          ) : (
            <ol className={styles.priorityList}>
              {priority.map((order, index) => (
                <li key={order.id}>
                  <article
                    className={`${styles.orderCard} ${index === 0 ? styles.orderCardDominant : ""}`}
                    data-risk={order.risk}
                  >
                    <span className={styles.risk}>{riskLabel(order.risk)}</span>
                    <span className={styles.orderNumber}>{order.orderNumber}</span>
                    <strong>{order.customerName ?? "Kunde nicht hinterlegt"}</strong>
                    <span>{order.detail ?? order.title}</span>
                    <small>{statusLabel(order)} · {order.dueLabel}: {order.dueValue}</small>
                    <button
                      type="button"
                      className={styles.orderCardOpen}
                      aria-label={`Auftrag ${order.orderNumber} öffnen`}
                      onClick={() => openOrder(order.id)}
                    >
                      <ArrowRight aria-hidden="true" />
                    </button>
                  </article>
                </li>
              ))}
            </ol>
          )}
        </section>

        <aside className={styles.dayAreas} aria-label="Weitere Tagesbereiche">
          <section className={styles.dayArea} aria-labelledby="today-out-title">
            <header className={styles.dayAreaHeader}>
              <div><Truck aria-hidden="true" /><h2 id="today-out-title">Heute raus</h2></div>
              <strong>{finished.length}</strong>
            </header>
            {finished.length === 0 ? (
              <p className={styles.dayAreaEmpty}>Heute keine fertigen Aufträge.</p>
            ) : (
              <CompactOrderList orders={finished} onOpen={openOrder} />
            )}
            <button type="button" className={styles.sectionAction} onClick={() => setGoodsOutOpen(true)} disabled={!canWrite || finished.length === 0}>
              Warenausgang öffnen<ArrowRight aria-hidden="true" />
            </button>
          </section>

          <section className={styles.dayArea} aria-labelledby="recent-title">
            <header className={styles.dayAreaHeader}>
              <div><Inbox aria-hidden="true" /><h2 id="recent-title">Neu seit gestern 18:30</h2></div>
              <strong>{recent.length}</strong>
            </header>
            {recent.length === 0 ? (
              <p className={styles.dayAreaEmpty}>Seit gestern keine neuen Aufträge.</p>
            ) : (
              <CompactOrderList orders={recent} onOpen={openOrder} />
            )}
            <Link className={styles.sectionAction} href="/orders" prefetch={false}>Auftragsbestand öffnen<ArrowRight aria-hidden="true" /></Link>
          </section>
        </aside>
      </div>

      {goodsOutOpen ? (
        <div className={styles.backdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) setGoodsOutOpen(false); }}>
          <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="goods-out-title">
            <header><div><p>Fertig gemeldete Aufträge</p><h2 id="goods-out-title">Ware raus</h2></div><button type="button" onClick={() => setGoodsOutOpen(false)} aria-label="Schließen"><X /></button></header>
            {finished.length === 0 ? <p role="status">Keine fertig gemeldete Ware.</p> : (
              <ul>{finished.map((order) => <li key={order.id}><button type="button" onClick={() => { setGoodsOutOpen(false); openOrder(order.id); }}><span><strong>{order.orderNumber}</strong>{order.customerName ?? "Kunde nicht hinterlegt"}</span><span>{order.dueLabel}: {order.dueValue}</span></button></li>)}</ul>
            )}
          </section>
        </div>
      ) : null}
    </section>
  );
}
