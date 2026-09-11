"use client";

import { useEffect, useState } from "react";
import type { OrdersViewState } from "../server/types";
import styles from "./orders.module.css";

export function OrdersView({
  state,
  onOpenOrder,
}: {
  state: OrdersViewState;
  onOpenOrder: (orderId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setQuery(window.sessionStorage.getItem("kreile.orders.filter") ?? "");
      setHydrated(true);
    });
    return () => { active = false; };
  }, []);
  const orders = state.kind === "data" ? state.orders : [];
  const visible = (() => {
    const term = query.trim().toLocaleLowerCase("de-DE");
    if (!term) return orders;
    return orders.filter((order) =>
      [order.orderNumber, order.customerName, order.title, order.material, order.surface]
        .some((value) => value?.toLocaleLowerCase("de-DE").includes(term)),
    );
  })();

  return (
    <section className={styles.page} aria-labelledby="orders-title">
      <header className={styles.header}>
        <div><p className={styles.eyebrow}>Auftragsbestand</p><h1 id="orders-title">Aufträge</h1></div>
        <p>{orders.length} tenantgebundene Aufträge</p>
      </header>
      <label className={styles.search}>Aufträge filtern
        <input value={query} onChange={(event) => {
          const nextQuery = event.target.value;
          window.sessionStorage.setItem("kreile.orders.filter", nextQuery);
          setQuery(nextQuery);
        }} data-hydrated={hydrated} placeholder="Auftragsnummer, Kunde, Teil, Material …" />
      </label>
      {state.kind === "loading" && <p role="status" className={styles.notice}>Aufträge werden geladen …</p>}
      {state.kind === "denied" && <p role="alert" className={styles.notice}>{state.message}</p>}
      {state.kind === "error" && <p role="alert" className={styles.notice}>{state.message}</p>}
      {state.kind === "conflict" && <p role="alert" className={styles.notice}>{state.message}</p>}
      {state.kind === "data" && visible.length === 0 && (
        <p className={styles.notice}>{orders.length === 0 ? "Noch keine Aufträge vorhanden." : "Keine Aufträge passen zu diesem Filter."}</p>
      )}
      {state.kind === "data" && visible.length > 0 && <div className={styles.list}>
        {visible.map((order) => <button key={order.id} className={styles.row} onClick={() => onOpenOrder(order.id)}>
          <span className={styles.number}>{order.orderNumber}</span>
          <span><strong>{order.customerName}</strong><small>{order.title}</small></span>
          <span><strong>{order.station}</strong><small>{order.dueAt ? new Intl.DateTimeFormat("de-DE").format(new Date(order.dueAt)) : "Termin offen"}</small></span>
        </button>)}
      </div>}
    </section>
  );
}
