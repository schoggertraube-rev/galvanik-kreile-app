"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Search } from "lucide-react";
import { getOrdersDb } from "@/app/actions/orders.actions";
import { getUrgency } from "@/lib/orders/getUrgency";

type OperationalOrder = {
  id: string;
  orderNumber?: string | null;
  customerName?: string | null;
  title?: string | null;
  task?: string | null;
  currentStationId?: string | null;
  station?: string | null;
  status?: string | null;
  dueDate?: string | null;
};

type LoadState = "loading" | "ready" | "error";
type Filter = "all" | "overdue" | "without_due_date";

function dueState(dueDate: string | null | undefined) {
  const urgency = getUrgency(dueDate);
  if (urgency === "kritisch") return "überfällig";
  if (urgency === "gefaehrdet") return "Termin heute oder morgen";
  if (urgency === "im_plan") return "Termin hinterlegt";
  return "Zugesagter Termin nicht hinterlegt";
}

function formatDueDate(dueDate: string | null | undefined) {
  if (!dueDate) return "—";
  const date = new Date(dueDate);
  if (Number.isNaN(date.getTime())) return "ungültiges Datum";
  return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<OperationalOrder[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    let active = true;

    async function load() {
      setLoadState("loading");
      setLoadError(null);
      try {
        const result = await getOrdersDb();
        if (!active) return;
        if (!result.ok) {
          setLoadState("error");
          setLoadError(result.message || "Auftragsdaten konnten nicht bestätigt werden.");
          return;
        }
        setOrders(result.data as OperationalOrder[]);
        setLoadState("ready");
      } catch {
        if (!active) return;
        setLoadState("error");
        setLoadError("Auftragsdaten konnten nicht bestätigt werden.");
      }
    }

    void load();
    return () => { active = false; };
  }, [reloadKey]);

  const counts = useMemo(() => ({
    all: orders.length,
    overdue: orders.filter((order) => getUrgency(order.dueDate) === "kritisch").length,
    without_due_date: orders.filter((order) => getUrgency(order.dueDate) === "unbekannt").length,
  }), [orders]);

  const filteredOrders = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLocaleLowerCase("de-DE");
    return orders.filter((order) => {
      const matchesSearch = !normalizedSearch || [order.orderNumber, order.customerName, order.title, order.task]
        .some((value) => String(value ?? "").toLocaleLowerCase("de-DE").includes(normalizedSearch));
      if (!matchesSearch) return false;
      if (filter === "overdue") return getUrgency(order.dueDate) === "kritisch";
      if (filter === "without_due_date") return getUrgency(order.dueDate) === "unbekannt";
      return true;
    });
  }, [filter, orders, searchTerm]);

  if (loadState === "loading") {
    return (
      <main className="mx-auto max-w-md space-y-3 p-12 text-center text-text-muted">
        <RefreshCw className="mx-auto h-8 w-8 animate-spin" />
        <p className="font-extrabold text-navy-900">Auftragsbuch wird geladen</p>
        <p className="text-xs">Es werden noch keine Bestands-, Frist- oder Risikoaussagen angezeigt.</p>
      </main>
    );
  }

  if (loadState === "error") {
    return (
      <main className="mx-auto max-w-md space-y-4 p-12 text-center text-text-muted">
        <AlertTriangle className="mx-auto h-10 w-10 text-danger-red" />
        <p className="font-extrabold text-navy-900">Auftragsdaten sind derzeit unbekannt</p>
        <p className="text-sm">{loadError}</p>
        <button className="rounded-lg bg-navy-900 px-4 py-2 text-sm font-semibold text-white" onClick={() => setReloadKey((value) => value + 1)}>Erneut laden</button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 pb-12">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-navy-900">Auftragsbuch</h1>
        <p className="max-w-3xl text-sm text-text-muted">Diese Liste zeigt nur tenantgebunden gelesene Aufträge, ihren gespeicherten Prozessschritt und den gespeicherten Termin. Risiko-, Kapazitäts-, Oberflächen- und Detailaussagen bleiben bis zu ihrem eigenen Datenvertrag geschlossen.</p>
      </header>

      <div className="flex flex-col gap-3 rounded-xl border border-neutral-gray-300 bg-white p-3 md:flex-row md:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Aufträge suchen</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input className="w-full rounded-lg border border-neutral-gray-300 py-2 pl-9 pr-3 text-sm" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Auftrag, Kunde oder Beschreibung suchen" />
        </label>
        <div className="flex flex-wrap gap-2">
          <button className={`rounded-lg px-3 py-2 text-xs font-semibold ${filter === "all" ? "bg-navy-900 text-white" : "border border-neutral-gray-300"}`} onClick={() => setFilter("all")}>Alle ({counts.all})</button>
          <button className={`rounded-lg px-3 py-2 text-xs font-semibold ${filter === "overdue" ? "bg-navy-900 text-white" : "border border-neutral-gray-300"}`} onClick={() => setFilter("overdue")}>Überfällig ({counts.overdue})</button>
          <button className={`rounded-lg px-3 py-2 text-xs font-semibold ${filter === "without_due_date" ? "bg-navy-900 text-white" : "border border-neutral-gray-300"}`} onClick={() => setFilter("without_due_date")}>Termin fehlt ({counts.without_due_date})</button>
        </div>
      </div>

      {filteredOrders.length === 0 ? (
        <section className="rounded-xl border border-neutral-gray-300 bg-white p-10 text-center text-sm text-text-muted">Nach erfolgreichem Laden gibt es für diese Auswahl keine Aufträge.</section>
      ) : (
        <section className="overflow-hidden rounded-xl border border-neutral-gray-300 bg-white">
          <div className="grid grid-cols-[minmax(110px,0.75fr)_minmax(130px,1fr)_minmax(130px,1fr)_minmax(120px,0.9fr)] gap-3 border-b border-neutral-gray-200 bg-bg-app-soft px-4 py-3 text-xs font-bold uppercase tracking-wide text-text-muted">
            <span>Auftrag</span><span>Kunde</span><span>Prozessschritt</span><span>Termin</span>
          </div>
          {filteredOrders.map((order) => (
            <article key={order.id} className="grid grid-cols-1 gap-2 border-b border-neutral-gray-100 px-4 py-4 last:border-b-0 md:grid-cols-[minmax(110px,0.75fr)_minmax(130px,1fr)_minmax(130px,1fr)_minmax(120px,0.9fr)] md:gap-3">
              <div><p className="font-mono text-sm font-bold text-navy-900">{order.orderNumber || "Nummer nicht hinterlegt"}</p><p className="mt-1 text-xs text-text-muted">{order.title || order.task || "Beschreibung nicht hinterlegt"}</p></div>
              <p className="text-sm text-navy-900">{order.customerName || "Kunde nicht hinterlegt"}</p>
              <p className="text-sm text-navy-900">{order.currentStationId || order.station || "Prozessschritt nicht hinterlegt"}</p>
              <div><p className="text-sm text-navy-900">{formatDueDate(order.dueDate)}</p><p className="mt-1 text-xs text-text-muted">{dueState(order.dueDate)}</p></div>
            </article>
          ))}
        </section>
      )}

      <p className="text-xs text-text-muted">Die Auftragsdetailansicht und die Auftragsanlage sind noch nicht freigegeben. <Link className="font-semibold text-navy-900 underline" href="/customers">Zur Kundenkartei</Link></p>
    </main>
  );
}
