"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, ClipboardList, Factory, Inbox, PackageCheck, Truck, X } from "lucide-react";
import { useErfassung } from "@/components/erfassung/ErfassungProvider";
import { useOverlayStore } from "@/lib/overlayStore";
import styles from "./RolfHome.module.css";

export type RolfOrder = {
  id: string;
  orderNumber: string;
  customerName: string | null;
  title: string;
  detail: string | null;
  station: string;
  status: string;
  statusText: string;
  risk: string;
  dueDate: string;
  dueLabel: string;
  dueValue: string;
};

type RolfIdentity = {
  displayName: string;
  role: "buero" | "meister" | "readonly";
  canCreateOrder: boolean;
};

export type RolfHomeModel =
  | ({ kind: "data"; orders: readonly RolfOrder[] } & RolfIdentity)
  | ({ kind: "empty" } & RolfIdentity)
  | { kind: "denied"; message: string }
  | { kind: "error"; message: string };

const RISK_ORDER: Readonly<Record<string, number>> = {
  red: 0,
  blocked: 1,
  orange: 2,
  yellow: 3,
  green: 4,
};

function dueTimestamp(value: string): number {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : Number.MAX_SAFE_INTEGER;
}

function rankedOrders(orders: readonly RolfOrder[]): readonly RolfOrder[] {
  return [...orders]
    .sort((left, right) => {
      const risk = (RISK_ORDER[left.risk] ?? 5) - (RISK_ORDER[right.risk] ?? 5);
      if (risk !== 0) return risk;
      const due = dueTimestamp(left.dueDate) - dueTimestamp(right.dueDate);
      return due !== 0 ? due : left.orderNumber.localeCompare(right.orderNumber, "de");
    })
    .slice(0, 6);
}

function riskLabel(risk: string): string {
  if (risk === "red") return "Kritisch";
  if (risk === "blocked") return "Blockiert";
  if (risk === "orange") return "Dringend";
  if (risk === "yellow") return "Knapp";
  if (risk === "green") return "Im Plan";
  return "Ohne Risikowert";
}

export function RolfHomeClient({ model }: { model: RolfHomeModel }) {
  const { openErfassung } = useErfassung();
  const openOrder = useOverlayStore((state) => state.openOrder);
  const [goodsOutOpen, setGoodsOutOpen] = useState(false);

  if (model.kind === "denied") {
    return <section className={styles.state} role="status"><h1>Zugriff nicht freigegeben</h1><p>{model.message}</p></section>;
  }
  if (model.kind === "error") {
    return <section className={styles.state} role="alert"><h1>Der Tag ist nicht verfügbar</h1><p>{model.message}</p><p>Es werden keine veralteten Daten angezeigt.</p></section>;
  }

  const orders = model.kind === "data" ? model.orders : [];
  const priority = rankedOrders(orders);
  const finished = orders.filter((order) => order.station === "fertig");
  const inProduction = orders.filter((order) => order.station === "galvanik");
  const canWrite = model.role !== "readonly";

  return (
    <section className={styles.screen} aria-labelledby="rolf-title" data-testid="rolf-v8-home">
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Der Tag</p>
          <h1 id="rolf-title">Guten Tag, {model.displayName}</h1>
          <p>Was heute Aufmerksamkeit braucht – aus dem aktuellen Auftragsbestand.</p>
        </div>
        <Link className={styles.primaryLink} href="/orders"><ClipboardList aria-hidden="true" />Alle Aufträge<ArrowRight aria-hidden="true" /></Link>
      </header>

      <nav className={styles.quick} aria-label="Schnellaktionen">
        {canWrite && model.canCreateOrder ? (
          <button type="button" onClick={() => openErfassung({ mode: "order", intent: "create_order", source: "shortcut", returnTo: "/" })}>
            <Inbox aria-hidden="true" /><span><strong>Neuer Eingang</strong><small>Auftrag kanonisch erfassen</small></span>
          </button>
        ) : null}
        {canWrite ? (
          <button type="button" onClick={() => setGoodsOutOpen(true)}>
            <Truck aria-hidden="true" /><span><strong>Ware raus</strong><small>{finished.length} fertig gemeldet</small></span>
          </button>
        ) : null}
        <Link href="/warendurchlauf"><Factory aria-hidden="true" /><span><strong>Werkstatt</strong><small>{inProduction.length} in der Galvanik</small></span></Link>
      </nav>

      {model.kind === "empty" ? (
        <div className={styles.state} role="status">
          <PackageCheck aria-hidden="true" />
          <h2>Der Auftragsbestand ist leer</h2>
          <p>Aufträge und Werkstattstatus wurden geprüft. Es liegen derzeit keine offenen Aufgaben vor.</p>
        </div>
      ) : (
        <div className={styles.grid}>
          <section className={styles.attention} aria-labelledby="attention-title">
            <header className={styles.sectionHeader}>
              <div><span className={styles.signal} aria-hidden="true" /> <h2 id="attention-title">Das braucht dich</h2></div>
              <span>{orders.length} offene Aufträge</span>
            </header>
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
            <Link href="/warendurchlauf"><span><Factory aria-hidden="true" />Galvanik</span><strong>{inProduction.length}</strong><small>in Arbeit</small></Link>
            <Link href="/orders"><span><ClipboardList aria-hidden="true" />Aufträge</span><strong>{orders.length}</strong><small>offen geladen</small></Link>
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
