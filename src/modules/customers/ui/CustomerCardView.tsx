"use client";

import type { CustomerCardState, CustomerOrderItem } from "../server/types";
import styles from "./customers.module.css";

function dateLabel(value: string): string {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(value));
}

function dueLabel(order: CustomerOrderItem): string {
  if (!order.dueAt) return "Termin nicht festgelegt";
  const days = Math.ceil((new Date(order.dueAt).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return `${Math.abs(days)} Tag${Math.abs(days) === 1 ? "" : "e"} überfällig`;
  if (days === 0) return "Heute fällig";
  return `Termin in ${days} Tagen`;
}

function StateCard({ state, onClose }: { state: Exclude<CustomerCardState, { kind: "data" }>; onClose: () => void }) {
  const loading = state.kind === "loading";
  return <section className={styles.card} aria-live="polite"><header className={styles.stateHeader}><p className={styles.eyebrow}>Kundenkarte V2</p><button onClick={onClose}>Schließen</button></header><div className={styles.statePanel} data-state={state.kind}><h2>{loading ? "Kundenkarte wird geladen …" : state.kind === "denied" ? "Zugriff nicht erlaubt" : state.kind === "conflict" ? "Stand hat sich geändert" : state.kind === "not-found" ? "Kunde nicht gefunden" : "Kundenkarte nicht verfügbar"}</h2>{loading ? <p role="status">Stammdaten und Aufträge werden sicher gelesen.</p> : <p role="alert">{state.message}</p>}</div></section>;
}

export function CustomerCardView({ state, onOpenOrder, onClose }: { state: CustomerCardState; onOpenOrder: (orderId: string) => void; onClose: () => void }) {
  if (state.kind !== "data") return <StateCard state={state} onClose={onClose} />;
  const { card } = state;
  const address = [card.address, [card.zipCode, card.city].filter(Boolean).join(" "), card.country].filter(Boolean).join(", ");
  const activeOrders = card.orders.filter((order) => ["angenommen", "galvanik", "fertig"].includes(order.status));
  const history = card.orders.filter((order) => !["angenommen", "galvanik", "fertig"].includes(order.status));
  const next = [...activeOrders].sort((left, right) => (left.dueAt ?? "9999").localeCompare(right.dueAt ?? "9999"))[0];
  return <section className={styles.card} aria-labelledby="customer-card-title" data-testid="customer-card-v2">
    <div className={styles.brandStripe} />
    <header className={styles.cardHeader}>
      <div className={styles.identity}><p className={styles.eyebrow}>Kunde <span>{card.customerNumber ?? "ohne Nummer"}</span></p><h2 id="customer-card-title">{card.name}</h2><p>{card.companyName && card.companyName !== card.name ? `${card.companyName} · ` : ""}{card.type}{card.classification ? ` · ${card.classification}` : ""}</p>
        <div className={styles.contactLine}>{card.contactPerson && <span>{card.contactPerson}</span>}{card.phone && <a href={`tel:${card.phone}`}>{card.phone}</a>}{card.email && <a href={`mailto:${card.email}`}>{card.email}</a>}{address && <span>{address}</span>}</div>
        {card.tags.length > 0 && <div className={styles.tags}>{card.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>}
      </div>
      <div className={styles.customerFacts}><span>Ware im Haus<strong>{card.wareImHausCount}</strong></span><span>Aufträge gesamt<strong>{card.orderCount}</strong></span></div>
      <button className={styles.closeButton} onClick={onClose} aria-label="Kundenkarte schließen">×</button>
    </header>

    <div className={styles.cardBody}>
      <main className={styles.mainColumn}>
        <section className={styles.nextAction}><p className={styles.sectionKicker}>Nächster Handlungsbedarf</p>{next ? <><h3>{next.orderNumber} · {next.title}</h3><p>{next.station} · {dueLabel(next)}</p><button onClick={() => onOpenOrder(next.id)}>Auftragskarte öffnen →</button></> : <><h3>Kein aktiver Auftrag im Haus</h3><p>Der Kundenstamm wurde geprüft; es liegt aktuell kein belegter operativer Handlungsbedarf vor.</p></>}</section>

        <section className={styles.section} aria-labelledby="active-orders"><div className={styles.sectionHeader}><h3 id="active-orders">Aktive Aufträge</h3><span>{activeOrders.length}</span></div>{activeOrders.length === 0 ? <p className={styles.empty}>Für diesen Kunden ist kein aktiver Auftrag im Haus.</p> : <div className={styles.orders}>{activeOrders.map((order) => <button key={order.id} onClick={() => onOpenOrder(order.id)} aria-label={`${order.orderNumber} ${order.title} öffnen`}><span><strong>{order.orderNumber}</strong><small>{order.title}</small></span><span><strong>{order.station}</strong><small>{dueLabel(order)}</small></span><b>→</b></button>)}</div>}</section>

        <section className={styles.section} aria-labelledby="customer-notes"><div className={styles.sectionHeader}><h3 id="customer-notes">Notizen &amp; Telefonnotizen</h3></div>{card.notes ? <p className={styles.note}>{card.notes}</p> : <p className={styles.empty}>Keine Kunden- oder Telefonnotiz im bestätigten Readback vorhanden.</p>}</section>

        <section className={styles.section} aria-labelledby="customer-history"><div className={styles.sectionHeader}><h3 id="customer-history">Historie &amp; Referenzen</h3><span>{history.length}</span></div>{history.length === 0 ? <p className={styles.empty}>Keine abgeschlossene Auftragshistorie im aktuellen Readback.</p> : <div className={styles.orders}>{history.map((order) => <button key={order.id} onClick={() => onOpenOrder(order.id)}><span><strong>{order.orderNumber}</strong><small>{order.title}</small></span><span><strong>{order.status}</strong><small>{order.dueAt ? dateLabel(order.dueAt) : "ohne Termin"}</small></span><b>→</b></button>)}</div>}</section>

        <section className={styles.section} aria-labelledby="customer-docs"><div className={styles.sectionHeader}><h3 id="customer-docs">Fotos &amp; Dokumente</h3></div><p className={styles.empty}>Kein eigener Kunden-Dokumentenvertrag vorhanden. Auftragsbezogene Belege stehen in der jeweiligen Auftragskarte.</p></section>
      </main>
      <aside className={styles.rail}>
        <section className={styles.section}><div className={styles.sectionHeader}><h3>Kontaktkontext</h3></div><dl className={styles.definitionList}><div><dt>Angelegt</dt><dd>{dateLabel(card.createdAt)}</dd></div><div><dt>Zuletzt aktualisiert</dt><dd>{dateLabel(card.updatedAt)}</dd></div><div><dt>Ansprechperson</dt><dd>{card.contactPerson ?? "Nicht hinterlegt"}</dd></div></dl></section>
        <section className={styles.section}><div className={styles.sectionHeader}><h3>Schnellaktionen</h3></div><div className={styles.quickActions}>{card.phone && <a href={`tel:${card.phone}`}>Anrufen</a>}{card.email && <a href={`mailto:${card.email}`}>E-Mail</a>}<p className={styles.empty}>Weitere Aktionen bleiben verborgen, bis ein echter Schreibvertrag angebunden ist.</p></div></section>
      </aside>
    </div>
    <footer className={styles.actionDock}>{card.phone && <a href={`tel:${card.phone}`}>Anrufen</a>}{card.email && <a href={`mailto:${card.email}`}>E-Mail</a>}<button className={styles.primaryAction} onClick={onClose}>Schließen</button></footer>
  </section>;
}
