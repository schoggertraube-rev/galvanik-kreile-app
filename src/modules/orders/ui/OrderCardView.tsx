"use client";

import type { OrderCardState } from "../server/types";
import styles from "./orders.module.css";

export function OrderCardView({ state, onOpenCustomer, onClose }: {
  state: OrderCardState;
  onOpenCustomer: (customerId: string) => void;
  onClose: () => void;
}) {
  if (state.kind !== "data") return <section className={styles.card} aria-live="polite"><button onClick={onClose}>Schließen</button><p role={state.kind === "loading" ? "status" : "alert"}>{state.kind === "loading" ? "Auftragskarte wird geladen …" : state.message}</p></section>;
  const { card } = state;
  return <section className={styles.card} aria-labelledby="order-card-title">
    <header className={styles.cardHeader}><div><p className={styles.eyebrow}>Auftragskarte</p><h2 id="order-card-title">{card.orderNumber}</h2><button className={styles.textButton} onClick={() => onOpenCustomer(card.customerId)}>{card.customerName}</button></div><button onClick={onClose}>Schließen</button></header>
    <div className={styles.facts}><span>Status<strong>{card.status}</strong></span><span>Station<strong>{card.station}</strong></span><span>Termin<strong>{card.dueAt ? new Intl.DateTimeFormat("de-DE").format(new Date(card.dueAt)) : "Offen"}</strong></span><span>Version<strong>{card.version}</strong></span></div>
    <h3>{card.title}</h3>{card.note && <p>{card.note}</p>}
    <div className={styles.items}>{card.items.map((item) => <article key={item.id}><strong>{item.position}. {item.name}</strong><span>{item.quantity} Stück · {item.material ?? "Material offen"} · {item.surface}</span></article>)}</div>
    {card.frozenAt && <p className={styles.receipt}>Preisstand eingefroren am {new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(card.frozenAt))}{card.totalAmountCents !== null ? ` · ${(card.totalAmountCents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}` : ""}</p>}
  </section>;
}
