"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Archive,
  CheckCircle2,
  Clock3,
  Inbox,
  Loader2,
  Phone,
  PhoneCall,
  RefreshCw,
} from "lucide-react";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { BackButton } from "@/components/ui/BackButton";
import {
  getRecentPhoneNotes,
  updatePhoneNote,
  type PhoneNoteRecord,
} from "@/app/actions/phoneNotes.actions";
import { getOrdersDb } from "@/app/actions/orders.actions";
import { getCustomersDb } from "@/app/actions/customers.actions";
import type { Order } from "@/lib/repositories/ordersRepository";
import type { Customer } from "@/lib/repositories/customersRepository";
import { usePageView } from "@/hooks/usePageView";

type CommunicationFilter = "all" | "open" | "callback" | "parked" | "done";
type LoadState = "loading" | "ready" | "error";

const FILTERS: { id: CommunicationFilter; label: string; icon: typeof Inbox }[] = [
  { id: "all", label: "Alle", icon: Inbox },
  { id: "open", label: "Offen", icon: Clock3 },
  { id: "callback", label: "Rückruf/Warten", icon: PhoneCall },
  { id: "parked", label: "Geparkt", icon: Archive },
  { id: "done", label: "Erledigt", icon: CheckCircle2 },
];

const STATUS_LABELS: Record<string, string> = {
  new: "Neu",
  open: "Offen",
  parked: "Geparkt",
  waiting_callback: "Rückruf ausstehend",
  waiting_customer: "Wartet auf Kunde",
  done: "Erledigt",
  archived: "Archiviert",
};

function noteStatus(note: PhoneNoteRecord): string {
  return note.status || "open";
}

function matchesFilter(note: PhoneNoteRecord, filter: CommunicationFilter): boolean {
  const status = noteStatus(note);
  if (filter === "all") return true;
  if (filter === "open") return status === "new" || status === "open";
  if (filter === "callback") return status === "waiting_callback" || status === "waiting_customer";
  if (filter === "parked") return status === "parked";
  return status === "done" || status === "archived";
}

function displayTime(value: Date | string | null): string {
  if (!value) return "Zeit nicht verfügbar";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime())
    ? "Zeit nicht verfügbar"
    : date.toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" });
}

export function KommunikationClient() {
  const [notes, setNotes] = useState<PhoneNoteRecord[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filter, setFilter] = useState<CommunicationFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  usePageView();

  const load = useCallback(async (initial = false) => {
    if (initial) setLoadState("loading");
    else setIsRefreshing(true);
    try {
      const [loadedNotes, orderResult, customerResult] = await Promise.all([
        getRecentPhoneNotes(100),
        getOrdersDb(),
        getCustomersDb(),
      ]);
      if (!orderResult.ok) throw new Error(orderResult.message);
      if (!customerResult.ok) throw new Error(customerResult.message);
      setNotes(loadedNotes);
      setOrders(orderResult.data as unknown as Order[]);
      setCustomers(customerResult.data);
      setLoadError(null);
      setLoadState("ready");
      setSelectedId((current) => current && loadedNotes.some((note) => note.id === current)
        ? current
        : loadedNotes[0]?.id || null);
    } catch (error) {
      console.error("Kommunikationsdaten konnten nicht geladen werden", error);
      setLoadError(error instanceof Error ? error.message : "Kommunikationsdaten konnten nicht geladen werden.");
      setLoadState("error");
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => { void load(true); }, 0);
    const refresh = () => { if (document.visibilityState === "visible") void load(false); };
    const interval = window.setInterval(refresh, 30_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [load]);

  const customersById = useMemo(() => new Map(customers.map((customer) => [customer.id, customer])), [customers]);
  const ordersById = useMemo(() => new Map(orders.map((order) => [order.id, order])), [orders]);
  const filteredNotes = useMemo(() => notes.filter((note) => matchesFilter(note, filter)), [filter, notes]);
  const selected = notes.find((note) => note.id === selectedId) || null;
  const selectedCustomer = selected?.customerId ? customersById.get(selected.customerId) || null : null;
  const selectedOrder = selected?.orderId ? ordersById.get(selected.orderId) || null : null;

  const changeStatus = useCallback(async (status: "open" | "waiting_callback" | "parked" | "done") => {
    if (!selected) return;
    setUpdatingStatus(true);
    setMutationError(null);
    try {
      const result = await updatePhoneNote(selected.id, { status });
      if (!result.success) {
        setMutationError(result.error);
        return;
      }
      setNotes((current) => current.map((note) => note.id === result.data.id ? result.data : note));
    } catch (error) {
      console.error("Telefonnotiz-Status konnte nicht geändert werden", error);
      setMutationError("Status konnte nicht gespeichert werden.");
    } finally {
      setUpdatingStatus(false);
    }
  }, [selected]);

  return (
    <main style={{ minHeight: "100vh", background: "#F6F2EA", color: "#292119" }}>
      <div style={{ maxWidth: 1440, margin: "0 auto", padding: "24px clamp(16px, 3vw, 40px) 48px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", marginBottom: 18 }}>
          <div>
            <Breadcrumb items={[{ label: "Kommunikation" }]} />
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
              <BackButton label="Home" href="/" />
              <div>
                <h1 style={{ margin: 0, fontSize: 28, fontWeight: 750 }}>Kommunikation</h1>
                <p style={{ margin: "4px 0 0", color: "#746C61", fontSize: 13 }}>
                  Persistierte Telefonnotizen · E-Mail, Chat und Versand sind noch nicht angebunden.
                </p>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => void load(false)}
              disabled={isRefreshing}
              style={{ border: "1px solid #D8D0C3", borderRadius: 9, background: "white", padding: "9px 12px", display: "flex", alignItems: "center", gap: 7, cursor: isRefreshing ? "wait" : "pointer" }}
            >
              <RefreshCw size={15} className={isRefreshing ? "animate-spin" : ""} /> Aktualisieren
            </button>
            <Link
              href="/telefonnotiz?source=kommunikation&returnTo=%2Fkommunikation"
              style={{ borderRadius: 9, background: "#292119", color: "white", padding: "9px 13px", textDecoration: "none", display: "flex", alignItems: "center", gap: 7, fontWeight: 650, fontSize: 13 }}
            >
              <Phone size={15} /> Neue Telefonnotiz
            </Link>
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 14 }}>
          {FILTERS.map((entry) => {
            const Icon = entry.icon;
            const count = notes.filter((note) => matchesFilter(note, entry.id)).length;
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => setFilter(entry.id)}
                style={{ border: `1px solid ${filter === entry.id ? "#292119" : "#D8D0C3"}`, background: filter === entry.id ? "#292119" : "white", color: filter === entry.id ? "white" : "#4B443B", borderRadius: 999, padding: "7px 11px", display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12, fontWeight: 650 }}
              >
                <Icon size={14} /> {entry.label} <span style={{ opacity: 0.7 }}>{count}</span>
              </button>
            );
          })}
        </div>

        {loadState === "loading" && (
          <div style={{ border: "1px solid #DDD5C9", background: "white", borderRadius: 14, padding: 36, display: "flex", justifyContent: "center", gap: 10, color: "#746C61" }}>
            <Loader2 size={18} className="animate-spin" /> Autorisierte Daten werden geladen …
          </div>
        )}
        {loadState === "error" && (
          <div role="alert" style={{ border: "1px solid #F2B8B5", background: "#FFF4F2", borderRadius: 14, padding: 18, color: "#9F2D27" }}>
            <strong>Daten nicht verfügbar.</strong> {loadError}
          </div>
        )}
        {loadState === "ready" && (
          <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 420px) minmax(0, 1fr)", gap: 14, minHeight: 560 }}>
            <section aria-label="Telefonnotizen" style={{ background: "white", border: "1px solid #DDD5C9", borderRadius: 14, overflow: "hidden" }}>
              {filteredNotes.length === 0 ? (
                <div style={{ padding: 28, color: "#746C61", fontSize: 13 }}>Keine Telefonnotizen in diesem Status.</div>
              ) : filteredNotes.map((note) => {
                const customer = note.customerId ? customersById.get(note.customerId) : null;
                const sender = note.callerName || note.company || customer?.name || "Nicht zugeordnet";
                const active = note.id === selectedId;
                return (
                  <button
                    key={note.id}
                    type="button"
                    onClick={() => { setSelectedId(note.id); setMutationError(null); }}
                    style={{ width: "100%", textAlign: "left", padding: "14px 16px", border: 0, borderBottom: "1px solid #EEE8DF", background: active ? "#F3E9DE" : "white", cursor: "pointer" }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                      <strong style={{ fontSize: 13 }}>{sender}</strong>
                      <span style={{ fontSize: 11, color: "#8A8175" }}>{displayTime(note.createdAt)}</span>
                    </div>
                    <div style={{ marginTop: 5, fontSize: 12, color: "#5E564C", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{note.rawText}</div>
                    <div style={{ marginTop: 7, display: "flex", gap: 6 }}>
                      <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 5, background: "#F1ECE4", color: "#62594F" }}>{STATUS_LABELS[noteStatus(note)] || `Unbekannt: ${noteStatus(note)}`}</span>
                      {note.category && <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 5, background: "#EEF2FF", color: "#3949A0" }}>{note.category}</span>}
                    </div>
                  </button>
                );
              })}
            </section>

            <section aria-label="Telefonnotiz Details" style={{ background: "white", border: "1px solid #DDD5C9", borderRadius: 14, padding: 22 }}>
              {!selected ? (
                <div style={{ color: "#746C61" }}>Telefonnotiz auswählen.</div>
              ) : (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", marginBottom: 18 }}>
                    <div>
                      <div style={{ fontSize: 11, color: "#8A8175", textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 700 }}>Telefonnotiz</div>
                      <h2 style={{ margin: "5px 0 3px", fontSize: 21 }}>{selected.callerName || selected.company || selectedCustomer?.name || "Nicht zugeordnet"}</h2>
                      <div style={{ color: "#746C61", fontSize: 12 }}>{displayTime(selected.createdAt)} · {STATUS_LABELS[noteStatus(selected)] || `Unbekannter Status: ${noteStatus(selected)}`}</div>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: 6 }}>
                      {(["open", "waiting_callback", "parked", "done"] as const).map((status) => (
                        <button
                          key={status}
                          type="button"
                          disabled={updatingStatus || noteStatus(selected) === status}
                          onClick={() => void changeStatus(status)}
                          style={{ border: "1px solid #D8D0C3", borderRadius: 7, background: noteStatus(selected) === status ? "#EAE4DA" : "white", padding: "6px 8px", cursor: updatingStatus ? "wait" : "pointer", fontSize: 11 }}
                        >
                          {STATUS_LABELS[status]}
                        </button>
                      ))}
                    </div>
                  </div>
                  {mutationError && <div role="alert" style={{ marginBottom: 12, padding: 10, borderRadius: 8, background: "#FFF4F2", color: "#9F2D27", fontSize: 12 }}>{mutationError}</div>}
                  <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.65, borderRadius: 10, background: "#F8F5EF", padding: 16, fontSize: 14 }}>{selected.rawText}</div>
                  {selected.generatedAnswer && (
                    <div style={{ marginTop: 14 }}>
                      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".08em", color: "#8A8175", fontWeight: 700, marginBottom: 6 }}>Gespeicherter Antwortvorschlag</div>
                      <div style={{ borderLeft: "3px solid #C15B2D", padding: "8px 12px", color: "#4F473E", fontSize: 13 }}>{selected.generatedAnswer}</div>
                    </div>
                  )}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10, marginTop: 18 }}>
                    <div style={{ border: "1px solid #E5DED3", borderRadius: 9, padding: 12 }}>
                      <div style={{ fontSize: 10, color: "#8A8175", textTransform: "uppercase", fontWeight: 700 }}>Kundenzuordnung</div>
                      {selectedCustomer ? <Link href={`/customers/${encodeURIComponent(selectedCustomer.id)}`} style={{ display: "inline-block", marginTop: 6, color: "#A8441D", fontWeight: 650 }}>{selectedCustomer.name}</Link> : <div style={{ marginTop: 6, color: "#746C61", fontSize: 12 }}>Nicht verifiziert zugeordnet</div>}
                    </div>
                    <div style={{ border: "1px solid #E5DED3", borderRadius: 9, padding: 12 }}>
                      <div style={{ fontSize: 10, color: "#8A8175", textTransform: "uppercase", fontWeight: 700 }}>Auftragszuordnung</div>
                      {selectedOrder ? <Link href={`/orders/${encodeURIComponent(selectedOrder.id)}`} style={{ display: "inline-block", marginTop: 6, color: "#A8441D", fontWeight: 650 }}>{selectedOrder.orderNumber}</Link> : <div style={{ marginTop: 6, color: "#746C61", fontSize: 12 }}>Nicht verifiziert zugeordnet</div>}
                    </div>
                  </div>
                  <div style={{ marginTop: 18, padding: 12, borderRadius: 9, background: "#F1ECE4", color: "#62594F", fontSize: 12 }}>
                    Versand, E-Mail-Postfach, Chat, Anhänge und Kalender sind in diesem Fundament noch nicht verbunden; deshalb werden hier keine entsprechenden Aktionen angeboten.
                  </div>
                </>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
