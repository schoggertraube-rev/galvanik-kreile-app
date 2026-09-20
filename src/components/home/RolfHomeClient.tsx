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

/**
 * P1-Hydration (Minified React #418): der Datenstand wurde ohne `timeZone`
 * formatiert und damit auf dem Server in der Runtime-Zone, im Browser in der
 * Geraetezone gerendert — ein Text-Hydration-Mismatch bei jedem Laden.
 * Europe/Berlin ist die Kalenderwahrheit des Betriebs (gleiche Bindung wie in
 * der unveraenderlichen Rechnung); der Instant bleibt UTC, nur die Darstellung
 * ist gebunden. Der Formatter wird bewusst je Aufruf erzeugt, damit eine
 * Zonenregression nicht von einem beim Import eingefrorenen Formatter verdeckt
 * wird.
 */
function formatBerlinDataStand(loadedAt: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(loadedAt));
}

function riskLabel(risk: OrdersHomeSource["risk"]): string {
  if (risk === "red") return "Kritisch";
  if (risk === "blocked") return "Blockiert";
  if (risk === "orange") return "Dringend";
  if (risk === "yellow") return "Knapp";
  if (risk === "green") return "Im Plan";
  return "Ohne Risikowert";
}

export function RolfHomeClient({ model }: { model: RolfHomeModel }) {
  const openOrder = useOverlayStore((state) => state.openOrder);
  const { hasPermission, loading: permissionsLoading } = usePermissions();
  const [goodsOutOpen, setGoodsOutOpen] = useState(false);

  if (model.kind === "denied") {
    return <section className={styles.state} role="status"><h1>Der Tagesbestand ist nicht freigegeben</h1><p>Datenstand: Es wurden für dieses Profil keine Auftragsdaten geladen.</p><p>{model.message} Nächster Schritt: Mit dem freigegebenen Profil erneut anmelden.</p></section>;
  }
  if (model.kind === "error") {
    return <section className={styles.state} role="alert"><h1>Der Tagesbestand ist nicht verfügbar</h1><p>Datenstand: Es werden keine älteren Auftragsdaten angezeigt.</p><p>{model.message} Nächster Schritt: Seite erneut laden.</p></section>;
  }

  const orders = model.projection.orders;
  const priority = model.projection.priority;
  const finished = orders.filter((order) => order.station === "fertig");
  const inProduction = orders.filter((order) => order.station === "galvanik");
  const canWrite = model.role !== "readonly";
  const canStartOrder = canWrite && model.canCreateOrder && !permissionsLoading && hasPermission("perm_data_orders");

  return (
    <section className={styles.screen} aria-labelledby="rolf-title" data-testid="rolf-v8-home">
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Der Tag</p>
          <h1 id="rolf-title">Guten Tag, Rolf</h1>
          <p>Was heute Aufmerksamkeit braucht – aus dem aktuellen Auftragsbestand.</p>
          <p className={styles.dataStand}>Quelle: {model.projection.source} · Stand {formatBerlinDataStand(model.projection.loadedAt)}</p>
        </div>
        <Link className={styles.primaryLink} href="/orders" prefetch={false}><ClipboardList aria-hidden="true" />Alle Aufträge<ArrowRight aria-hidden="true" /></Link>
      </header>

      <nav className={styles.quick} aria-label="Schnellaktionen">
        {canStartOrder ? (
          <button type="button" onClick={() => requestGlobalCreate("DIRECT_INTAKE")}>
            <Inbox aria-hidden="true" /><span><strong>Neuer Eingang</strong><small>Kunde, Teile und Termin erfassen</small></span>
          </button>
        ) : null}
        {canWrite ? (
          <button type="button" onClick={() => setGoodsOutOpen(true)}>
            <Truck aria-hidden="true" /><span><strong>Ware raus</strong><small>{finished.length} fertig gemeldet</small></span>
          </button>
        ) : null}
        <Link href="/warendurchlauf" prefetch={false}><Factory aria-hidden="true" /><span><strong>Werkstatt</strong><small>{inProduction.length} in der Galvanik</small></span></Link>
      </nav>

      {model.kind === "empty" ? (
        <div className={styles.state} role="status">
          <PackageCheck aria-hidden="true" />
          <h2>Heute ist kein offener Auftrag eingegangen</h2>
          <p>Datenstand: Die mandantengebundene Auftragsprojektion ist geladen und enthält derzeit keine offenen Aufträge.</p>
          {canStartOrder ? <button type="button" className={styles.primaryLink} onClick={() => requestGlobalCreate("DIRECT_INTAKE")}>Neuen Eingang anlegen<ArrowRight aria-hidden="true" /></button> : <Link className={styles.primaryLink} href="/orders" prefetch={false}>Aufträge öffnen<ArrowRight aria-hidden="true" /></Link>}
        </div>
      ) : (
        <div className={styles.grid}>
          <section className={styles.attention} aria-labelledby="attention-title">
            <header className={styles.sectionHeader}>
              <div><span className={styles.signal} aria-hidden="true" /> <h2 id="attention-title">Das braucht dich</h2></div>
              <span>{orders.length} offene Aufträge</span>
            </header>
            {model.projection.dominant ? (
              <button className={styles.dominantAction} onClick={() => openOrder(model.projection.dominant?.orderId ?? "")} type="button">
                <span>Jetzt öffnen</span>
                <strong>{model.projection.dominant.reason}</strong>
                <ArrowRight aria-hidden="true" />
              </button>
            ) : null}
            <ol className={styles.priorityList}>
              {priority.map((order) => (
                <li key={order.id}>
                  <button type="button" className={styles.orderCard} data-risk={order.risk} onClick={() => openOrder(order.id)}>
                    <span className={styles.risk}>{riskLabel(order.risk)}</span>
                    <span className={styles.orderNumber}>{order.orderNumber}</span>
                    <strong>{order.customerName ?? "Kunde nicht hinterlegt"}</strong>
                    <span>{order.detail ?? order.title}</span>
                    <small>{order.statusText || order.status} · {order.station} · {order.dueLabel}: {order.dueValue}</small>
                    <ArrowRight aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ol>
          </section>

          <aside className={styles.facts} aria-label="Tageszahlen">
            <button type="button" onClick={() => setGoodsOutOpen(true)} disabled={!canWrite}>
              <span><Truck aria-hidden="true" />Heute raus</span><strong>{finished.length}</strong><small>fertig gemeldet</small>
            </button>
            <Link href="/warendurchlauf" prefetch={false}><span><Factory aria-hidden="true" />Galvanik</span><strong>{inProduction.length}</strong><small>in Arbeit</small></Link>
            <Link href="/orders" prefetch={false}><span><ClipboardList aria-hidden="true" />Aufträge</span><strong>{orders.length}</strong><small>offen geladen</small></Link>
          </aside>
        </div>
      )}

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
