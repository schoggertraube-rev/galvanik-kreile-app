"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, ClipboardList, Factory, Inbox, PackageCheck, Truck, X } from "lucide-react";
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
  if (risk === "green") return "Im Plan";
  return "Ohne Risikowert";
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Berlin",
  }).format(new Date(value));
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
        <li key={order.id}>
          <button type="button" onClick={() => onOpen(order.id)}>
            <span>
              <strong>{order.orderNumber}</strong>
              {order.customerName ?? "Kunde nicht hinterlegt"}
            </span>
            <small>{order.detail ?? order.title}</small>
            <ArrowRight aria-hidden="true" />
          </button>
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
        <h1>Der Tagesbestand ist nicht freigegeben</h1>
        <p>Für dieses Profil wurden keine Auftragsdaten geladen.</p>
        <p>{model.message} Nächster Schritt: Mit dem freigegebenen Profil erneut anmelden.</p>
      </section>
    );
  }
  if (model.kind === "error") {
    return (
      <section className={styles.state} role="alert">
        <h1>Der Tagesbestand ist nicht verfügbar</h1>
        <p>Es werden keine älteren Auftragsdaten angezeigt.</p>
        <p>{model.message} Nächster Schritt: Seite erneut laden.</p>
      </section>
    );
  }

  const orders = model.projection.orders;
  const priority = model.projection.priority;
  const finished = orders.filter((order) => order.station === "fertig");
  const inProduction = orders.filter((order) => order.station === "galvanik");
  const recent = model.projection.recent;
  const urgentCount = orders.filter((order) => ["red", "blocked", "orange"].includes(order.risk)).length;
  const canWrite = model.role !== "readonly";
  const canStartOrder = canWrite && model.canCreateOrder && !permissionsLoading && hasPermission("perm_data_orders");

  return (
    <section className={styles.screen} aria-labelledby="rolf-title" data-testid="rolf-v8-home">
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Der Tag</p>
          <h1 id="rolf-title">Guten Tag, Rolf</h1>
          <p className={styles.dayLine}>
            {orders.length === 0
              ? "Im aktuellen Auftragsbestand ist nichts offen. Deine Tagesbereiche bleiben bereit."
              : `${urgentCount} dringend · ${orders.length - urgentCount} weitere offene Aufträge.`}
          </p>
          <p className={styles.dataStand}>Quelle: {model.projection.source} · Stand {formatTimestamp(model.projection.loadedAt)}</p>
        </div>
        <Link className={styles.primaryLink} href="/orders" prefetch={false}>
          <ClipboardList aria-hidden="true" />Alle Aufträge<ArrowRight aria-hidden="true" />
        </Link>
      </header>

      <nav className={styles.quick} aria-label="Schnellaktionen">
        {canStartOrder ? (
          <button type="button" onClick={() => requestGlobalCreate("DIRECT_INTAKE")}>
            <Inbox aria-hidden="true" /><span><strong>Neuer Eingang</strong><small>Kunde, Teile und Termin erfassen</small></span>
          </button>
        ) : null}
        {canWrite ? (
          <button type="button" onClick={() => setGoodsOutOpen(true)} disabled={finished.length === 0}>
            <Truck aria-hidden="true" /><span><strong>Ware raus</strong><small>{finished.length} fertig gemeldet</small></span>
          </button>
        ) : null}
        <Link href="/warendurchlauf" prefetch={false}>
          <Factory aria-hidden="true" /><span><strong>Werkstatt</strong><small>{inProduction.length} in der Galvanik</small></span>
        </Link>
      </nav>

      <div className={styles.grid}>
        <section className={styles.attention} aria-labelledby="attention-title">
          <header className={styles.sectionHeader}>
            <div><span className={styles.signal} aria-hidden="true" /><h2 id="attention-title">Das braucht dich</h2></div>
            <span>{orders.length} offene Aufträge</span>
          </header>

          {priority.length === 0 ? (
            <div className={styles.sectionEmpty} role="status">
              <PackageCheck aria-hidden="true" />
              <div>
                <h3>Aktuell wartet kein offener Auftrag.</h3>
                <p>Neue oder dringende Arbeit erscheint hier aus dem geladenen Auftragsbestand.</p>
              </div>
              {canStartOrder ? (
                <button type="button" onClick={() => requestGlobalCreate("DIRECT_INTAKE")}>Neuen Eingang anlegen<ArrowRight aria-hidden="true" /></button>
              ) : (
                <Link href="/orders" prefetch={false}>Aufträge öffnen<ArrowRight aria-hidden="true" /></Link>
              )}
            </div>
          ) : (
            <ol className={styles.priorityList}>
              {priority.map((order, index) => (
                <li key={order.id}>
                  <button
                    type="button"
                    className={`${styles.orderCard} ${index === 0 ? styles.orderCardDominant : ""}`}
                    data-risk={order.risk}
                    onClick={() => openOrder(order.id)}
                  >
                    <span className={styles.risk}>{riskLabel(order.risk)}</span>
                    <span className={styles.orderNumber}>{order.orderNumber}</span>
                    <strong>{order.customerName ?? "Kunde nicht hinterlegt"}</strong>
                    <span>{order.detail ?? order.title}</span>
                    <small>
                      {index === 0 && model.projection.dominant ? `${model.projection.dominant.reason} · ` : ""}
                      {order.statusText || order.status} · {order.station} · {order.dueLabel}: {order.dueValue}
                    </small>
                    <ArrowRight aria-hidden="true" />
                  </button>
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
              <p className={styles.dayAreaEmpty}>Aktuell ist kein Auftrag fertig gemeldet. Es wird keine Abholung oder Auslieferung behauptet.</p>
            ) : (
              <CompactOrderList orders={finished} onOpen={openOrder} />
            )}
            <button type="button" className={styles.sectionAction} onClick={() => setGoodsOutOpen(true)} disabled={!canWrite || finished.length === 0}>
              Fertige Aufträge öffnen<ArrowRight aria-hidden="true" />
            </button>
          </section>

          <section className={styles.dayArea} aria-labelledby="recent-title">
            <header className={styles.dayAreaHeader}>
              <div><Inbox aria-hidden="true" /><h2 id="recent-title">Neu seit gestern</h2></div>
              <strong>{recent.length}</strong>
            </header>
            <p className={styles.coverage}>Zeitraum: letzte 24 Stunden</p>
            {recent.length === 0 ? (
              <p className={styles.dayAreaEmpty}>Im belegten Zeitraum ist kein neuer Auftrag hinzugekommen.</p>
            ) : (
              <CompactOrderList orders={recent} onOpen={openOrder} />
            )}
            {model.projection.recentCoverage === "partial" ? (
              <p className={styles.coverage}>Einige ältere Datensätze ohne Eingangszeit sind in dieser Zahl nicht enthalten.</p>
            ) : null}
            <Link className={styles.sectionAction} href="/orders" prefetch={false}>Auftragsbestand öffnen<ArrowRight aria-hidden="true" /></Link>
          </section>

          <section className={styles.planned} aria-labelledby="numbers-title">
            <div><ClipboardList aria-hidden="true" /><h2 id="numbers-title">Zahlen</h2><span>Geplant</span></div>
            <p>Hier erscheinen erst dann betriebliche Kennzahlen, wenn dafür ein geprüfter Datenweg freigegeben ist.</p>
          </section>
        </aside>
      </div>

      {goodsOutOpen ? (
        <div className={styles.backdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) setGoodsOutOpen(false); }}>
          <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="goods-out-title">
            <header><div><p>Fertig gemeldete Aufträge</p><h2 id="goods-out-title">Ware raus</h2></div><button type="button" onClick={() => setGoodsOutOpen(false)} aria-label="Schließen"><X /></button></header>
            {finished.length === 0 ? <p role="status">Der Auftragsbestand enthält aktuell keine fertig gemeldete Ware.</p> : (
              <ul>{finished.map((order) => <li key={order.id}><button type="button" onClick={() => { setGoodsOutOpen(false); openOrder(order.id); }}><span><strong>{order.orderNumber}</strong>{order.customerName ?? "Kunde nicht hinterlegt"}</span><span>{order.dueLabel}: {order.dueValue}</span></button></li>)}</ul>
            )}
          </section>
        </div>
      ) : null}
    </section>
  );
}
