"use client";
import {
  ArrowLeft,
  ArrowRight,
  AtSign,
  CalendarClock,
  MapPin,
  Phone,
  UserRound,
  X,
} from "lucide-react";
import type { CustomerCardState } from "../server/types";
import styles from "./customers.module.css";
function due(value: string | null) {
  if (!value) return "Kein Termin";
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleDateString("de-DE")
    : "Termin nicht lesbar";
}
export function CustomerCardView({
  state,
  onOpenOrder,
  onClose,
}: {
  state: CustomerCardState;
  onOpenOrder: (id: string) => void;
  onClose: () => void;
}) {
  if (state.kind === "loading")
    return (
      <article className={styles.cardState} aria-busy="true">
        <h1>Kundenkarte wird geladen</h1>
      </article>
    );
  if (state.kind !== "data")
    return (
      <article
        className={styles.cardState}
        role={state.kind === "error" ? "alert" : "status"}
      >
        <button type="button" onClick={onClose}>
          <ArrowLeft />
          Zurück
        </button>
        <h1>
          {state.kind === "not-found"
            ? "Kunde nicht vorhanden"
            : state.kind === "denied"
              ? "Kundenkarte nicht freigegeben"
              : state.kind === "conflict"
                ? "Kundenstand nicht eindeutig"
                : "Kundenkarte nicht verfügbar"}
        </h1>
        <p>{state.message}</p>
      </article>
    );
  const card = state.card;
  const active = card.orders.filter((order) => order.station !== "abgeholt");
  const history = card.orders.filter((order) => order.station === "abgeholt");
  const next = active.slice().sort((a, b) => {
    const at = a.dueAt ? new Date(a.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
    const bt = b.dueAt ? new Date(b.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
    return at - bt;
  })[0];
  return (
    <article className={styles.customerCardV2} data-testid="customer-card-v2">
      <header className={styles.cardHeader}>
        <button type="button" className={styles.back} onClick={onClose} aria-label="Zurück">
          <ArrowLeft />
          <span>Zurück</span>
        </button>
        <span className={styles.avatar}>
          {card.name.slice(0, 2).toUpperCase()}
        </span>
        <div className={styles.identityBlock}>
          <p>{card.customerNumber ?? "Ohne Kundennummer"}</p>
          <h1>{card.companyName ?? card.name}</h1>
          <span>{card.companyName ? card.name : card.type}</span>
        </div>
        <button
          type="button"
          className={styles.close}
          onClick={onClose}
          aria-label="Schließen"
        >
          <X />
        </button>
      </header>
      <div className={styles.cardScroll}>
        <section className={styles.contact} aria-label="Kontakt">
          <div>
            <UserRound />
            <span>
              <small>Ansprechperson</small>
              <strong>{card.contactPerson ?? "Nicht hinterlegt"}</strong>
            </span>
          </div>
          {card.phone ? (
            <a href={`tel:${card.phone}`}>
              <Phone />
              <span>
                <small>Telefon</small>
                <strong>{card.phone}</strong>
              </span>
            </a>
          ) : null}
          {card.email ? (
            <a href={`mailto:${card.email}`}>
              <AtSign />
              <span>
                <small>E-Mail</small>
                <strong>{card.email}</strong>
              </span>
            </a>
          ) : null}
          <div>
            <MapPin />
            <span>
              <small>Adresse</small>
              <strong>
                {[
                  card.address,
                  [card.zipCode, card.city].filter(Boolean).join(" "),
                  card.country,
                ]
                  .filter(Boolean)
                  .join(", ") || "Nicht hinterlegt"}
              </strong>
            </span>
          </div>
        </section>
        <section className={styles.next}>
          <small>Nächster belegter Handlungsbedarf</small>
          {next ? (
            <>
              <h2>
                {next.orderNumber} · {next.title}
              </h2>
              <p>
                {next.station} · Termin {due(next.dueAt)}
              </p>
              <button type="button" onClick={() => onOpenOrder(next.id)}>
                Auftragskarte öffnen
                <ArrowRight />
              </button>
            </>
          ) : (
            <>
              <h2>Kein aktiver Auftrag</h2>
              <p>Der Kunden-Readback enthält derzeit keinen offenen Vorgang.</p>
            </>
          )}
        </section>
        <section className={styles.orders}>
          <header>
            <div>
              <p>Aufträge</p>
              <h2>Aktiv im Haus</h2>
            </div>
            <strong>{active.length}</strong>
          </header>
          {active.length === 0 ? (
            <p className={styles.truthEmpty}>
              Keine aktiven Aufträge zurückgelesen.
            </p>
          ) : (
            <ol>
              {active.map((order) => (
                <li key={order.id}>
                  <button type="button" onClick={() => onOpenOrder(order.id)}>
                    <span>
                      <small>{order.orderNumber}</small>
                      <strong>{order.title}</strong>
                    </span>
                    <span>
                      <b>{order.station}</b>
                      <small>{due(order.dueAt)}</small>
                    </span>
                    <ArrowRight />
                  </button>
                </li>
              ))}
            </ol>
          )}
        </section>
        <div className={styles.detailGrid}>
          <section>
            <header>
              <p>Kundenkontext</p>
              <h2>Notizen & Eigenheiten</h2>
            </header>
            <p className={styles.truthEmpty}>
              {card.notes ?? "Keine interne Kundennotiz hinterlegt."}
            </p>
            {card.tags.length ? (
              <ul className={styles.tags}>
                {card.tags.map((tag) => (
                  <li key={tag}>{tag}</li>
                ))}
              </ul>
            ) : null}
          </section>
          <section>
            <header>
              <p>Stammdaten</p>
              <h2>Verlässliche Fakten</h2>
            </header>
            <dl>
              <div>
                <dt>Klassifikation</dt>
                <dd>{card.classification ?? "Nicht hinterlegt"}</dd>
              </div>
              <div>
                <dt>Aufträge gesamt</dt>
                <dd>{card.orderCount}</dd>
              </div>
              <div>
                <dt>Ware im Haus</dt>
                <dd>{card.wareImHausCount}</dd>
              </div>
              <div>
                <dt>Aktualisiert</dt>
                <dd>{new Date(card.updatedAt).toLocaleString("de-DE")}</dd>
              </div>
            </dl>
          </section>
        </div>
        {history.length ? (
          <section className={styles.history}>
            <header>
              <p>Historie</p>
              <h2>Abgeschlossene Aufträge</h2>
            </header>
            <ol>
              {history.map((order) => (
                <li key={order.id}>
                  <button type="button" onClick={() => onOpenOrder(order.id)}>
                    <span>
                      {order.orderNumber} · {order.title}
                    </span>
                    <ArrowRight />
                  </button>
                </li>
              ))}
            </ol>
          </section>
        ) : null}
      </div>
      <footer className={styles.quickDock} aria-label="Kundenaktionen">
        <a
          href={card.phone ? `tel:${card.phone}` : undefined}
          aria-disabled={!card.phone}
        >
          <Phone />
          Anrufen
        </a>
        <a
          href={card.email ? `mailto:${card.email}` : undefined}
          aria-disabled={!card.email}
        >
          <AtSign />
          E-Mail
        </a>
        {active[0] ? (
          <button type="button" onClick={() => onOpenOrder(active[0].id)}>
            <CalendarClock />
            Aktiver Auftrag
          </button>
        ) : null}
      </footer>
    </article>
  );
}
