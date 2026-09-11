"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, ClipboardList, Inbox, PackageCheck, Truck, X } from "lucide-react";
import { useErfassung } from "@/components/erfassung/ErfassungProvider";
import { useOverlayStore } from "@/lib/overlayStore";
import styles from "./RolfHome.module.css";

export type RolfHomeOrder = {
  id: string;
  orderNumber: string;
  customerName: string | null;
  title: string;
  task: string | null;
  itemDescription: string | null;
  station: string;
  status: string;
  statusText: string;
  risk: string;
  dueDate: string;
  dueLabel: string;
  dueValue: string;
};

type RolfRole = "buero" | "meister" | "readonly";
type RolfCommon = { displayName: string; role: RolfRole; canCreateOrder: boolean };
export type RolfHomeView =
  | ({ kind: "data"; orders: readonly RolfHomeOrder[] } & RolfCommon)
  | ({ kind: "empty" } & RolfCommon)
  | { kind: "denied"; message: string }
  | { kind: "error"; message: string };

const RISK_WEIGHT: Readonly<Record<string, number>> = { red: 0, blocked: 1, orange: 2, yellow: 3, green: 4 };

function dueTime(order: RolfHomeOrder): number {
  const value = order.dueDate ? new Date(order.dueDate).getTime() : Number.POSITIVE_INFINITY;
  return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
}

function priorityOrders(orders: readonly RolfHomeOrder[]): readonly RolfHomeOrder[] {
  return [...orders].sort((left, right) => {
    const risk = (RISK_WEIGHT[left.risk] ?? 5) - (RISK_WEIGHT[right.risk] ?? 5);
    if (risk !== 0) return risk;
    const due = dueTime(left) - dueTime(right);
    return due !== 0 ? due : left.orderNumber.localeCompare(right.orderNumber, "de");
  }).slice(0, 5);
}

function riskLabel(risk: string): string {
  if (risk === "red") return "Kritisch";
  if (risk === "blocked") return "Blockiert";
  if (risk === "orange") return "Dringend";
  if (risk === "yellow") return "Knapp";
  if (risk === "green") return "Im Plan";
  return "Nicht bewertet";
}

export function RolfHomeClient({ view }: { view: RolfHomeView }) {
  const { openErfassung } = useErfassung();
  const openOrder = useOverlayStore((state) => state.openOrder);
  const [goodsOutOpen, setGoodsOutOpen] = useState(false);

  if (view.kind === "denied") {
    return <section className={styles.state} role="status"><h1>Startseite nicht freigegeben</h1><p>{view.message}</p></section>;
  }
  if (view.kind === "error") {
    return <section className={`${styles.state} ${styles.error}`} role="alert"><h1>Tagesansicht nicht verfügbar</h1><p>{view.message}</p><p>Es werden keine veralteten oder unvollständigen Daten angezeigt.</p></section>;
  }

  const orders = view.kind === "data" ? view.orders : [];
  const priority = priorityOrders(orders);
  const goodsOutCandidates = orders.filter((order) => order.station === "fertig");
  const galvanikCount = orders.filter((order) => order.station === "galvanik").length;
  const canMutate = view.role !== "readonly";

  const openGoodsOutOrder = (orderId: string) => {
    setGoodsOutOpen(false);
    openOrder(orderId);
  };

  return (
    <section className={styles.screen} aria-labelledby="rolf-home-title" data-testid="rolf-v8-home">
      <header className={styles.hero}>
        <div>
          <p className={styles.kicker}>Der Tag</p>
          <h1 id="rolf-home-title">Guten Tag, {view.displayName}</h1>
          <p className={styles.lead}>Prioritäten aus dem aktuellen tenantgebundenen Auftragsbestand.</p>
        </div>
        <Link className={styles.ordersLink} href="/orders"><ClipboardList aria-hidden="true" />Aufträge öffnen</Link>
      </header>

      {canMutate ? (
        <nav className={styles.quickActions} aria-label="Schnellaktionen">
          {view.canCreateOrder ? (
            <button type="button" onClick={() => openErfassung({ mode: "order", intent: "create_order", source: "shortcut", returnTo: "/" })}>
              <Inbox aria-hidden="true" /><span><strong>Neuer Eingang</strong><small>Digital erfassen</small></span>
            </button>
          ) : null}
          <button type="button" onClick={() => setGoodsOutOpen(true)}>
            <Truck aria-hidden="true" /><span><strong>Ware raus</strong><small>{goodsOutCandidates.length} fertig gemeldet</small></span>
          </button>
        </nav>
      ) : null}

      {view.kind === "empty" ? (
        <div className={styles.state} role="status">
          <PackageCheck aria-hidden="true" />
          <h2>Heute liegt kein offener Auftrag vor.</h2>
          <p>Auftragsbestand und Werkstattstatus wurden geprüft.</p>
        </div>
      ) : (
        <div className={styles.dayGrid}>
          <section aria-labelledby="rolf-attention-title" className={styles.attention}>
            <header className={styles.sectionHead}>
              <div><AlertTriangle aria-hidden="true" /><h2 id="rolf-attention-title">Das braucht dich</h2></div>
              <span>{orders.length} offene Aufträge</span>
            </header>
            <ol className={styles.priorityList}>
              {priority.map((order) => (
                <li key={order.id}>
                  <button type="button" className={styles.priorityCard} data-risk={order.risk} onClick={() => openOrder(order.id)}>
                    <span className={styles.risk}>{riskLabel(order.risk)}</span>
                    <span className={styles.orderNumber}>{order.orderNumber}</span>
                    <strong>{order.customerName ?? "Kunde nicht hinterlegt"}</strong>
                    <span>{order.itemDescription || order.task || order.title}</span>
                    <span className={styles.meta}>{order.statusText || order.status} · {order.station} · {order.dueLabel}: {order.dueValue}</span>
                  </button>
                </li>
              ))}
            </ol>
          </section>

          <aside className={styles.fields} aria-label="Reale Tagesfelder">
            <button type="button" className={styles.fieldCard} onClick={() => setGoodsOutOpen(true)}>
              <span><Truck aria-hidden="true" />Heute raus</span><strong>{goodsOutCandidates.length}</strong><small>fertig gemeldet</small>
            </button>
            <Link href="/warendurchlauf" className={styles.fieldCard}>
              <span><PackageCheck aria-hidden="true" />In der Galvanik</span><strong>{galvanikCount}</strong><small>aktuelle Aufträge</small>
            </Link>
            <Link href="/orders" className={styles.fieldCard}>
              <span><ClipboardList aria-hidden="true" />Auftragsbestand</span><strong>{orders.length}</strong><small>offen geladen</small>
            </Link>
          </aside>
        </div>
      )}

      {goodsOutOpen ? (
        <div className={styles.dialogBackdrop}>
          <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="rolf-goods-out-title">
            <header><div><p>Reale fertige Aufträge</p><h2 id="rolf-goods-out-title">Ware raus</h2></div><button type="button" aria-label="Schließen" onClick={() => setGoodsOutOpen(false)}><X /></button></header>
            {goodsOutCandidates.length === 0 ? <p role="status">Keine fertig gemeldete Ware zur Ausgabe vorhanden.</p> : (
              <ul>{goodsOutCandidates.map((order) => <li key={order.id}><button type="button" onClick={() => openGoodsOutOrder(order.id)}><span><strong>{order.orderNumber}</strong>{order.customerName ?? "Kunde nicht hinterlegt"}</span><span>{order.dueLabel}: {order.dueValue}</span></button></li>)}</ul>
            )}
          </section>
        </div>
      ) : null}
    </section>
  );
}
