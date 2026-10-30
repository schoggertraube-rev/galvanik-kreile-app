"use client";

import { useEffect, useMemo, useState } from "react";
import { getOrdersDb, type OrderResponse } from "@/app/actions/orders.actions";
import { requestGlobalCreate } from "@/components/layout/GlobalCreateFlow";
import { usePermissions } from "@/lib/auth/PermissionsContext";
import { useOverlayStore } from "@/lib/overlayStore";
import type { OrdersListItem } from "@/modules/orders/public";
import {
  Auftragszeile,
  SeitenKopf,
  Segment,
  SuchFeld,
  Terminuebersicht,
  Terminzeile,
  Zustand,
} from "@/ui/kr";

const KEY = "path1.orders.filter";
type ViewMode = "liste" | "woche" | "monat";
type OrderFilter = "alle" | "galvanik" | "angenommen" | "fertig";

type OrdersState =
  | { kind: "loading" }
  | { kind: "denied" | "error" | "conflict"; message: string }
  | { kind: "data"; orders: OrderListRow[]; loadedAt: string };

type OrderListRow =
  & Pick<OrdersListItem, "id" | "orderNumber" | "station" | "status" | "risk">
  & Pick<
    OrderResponse,
    | "customerName"
    | "title"
    | "task"
    | "itemDescription"
    | "surfaceRequested"
    | "parts"
    | "statusText"
    | "dueDate"
    | "dueValue"
    | "cardReadErrorCode"
  >;

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase("de-DE");
}

function toOrderListRow(order: OrderResponse): OrderListRow {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    station: order.station,
    status: order.status,
    risk: order.risk,
    customerName: order.customerName,
    title: order.title,
    task: order.task,
    itemDescription: order.itemDescription,
    surfaceRequested: order.surfaceRequested,
    parts: order.parts,
    statusText: order.statusText,
    dueDate: order.dueDate,
    dueValue: order.dueValue,
    cardReadErrorCode: order.cardReadErrorCode,
  };
}

function matchesQuery(order: OrderListRow, query: string): boolean {
  if (!query) return true;
  return normalized([
    order.orderNumber,
    order.customerName ?? "",
    order.title,
    order.task ?? "",
    order.itemDescription ?? "",
    order.station,
    order.status,
    order.statusText,
    order.surfaceRequested ?? "",
    order.cardReadErrorCode ?? "",
    ...order.parts.flatMap((part) => [part.name, part.material ?? "", part.surfaceRequested ?? ""]),
  ].join(" ")).includes(query);
}

function matchesFilter(order: OrderListRow, filter: OrderFilter): boolean {
  if (filter === "alle") return true;
  if (filter === "angenommen") return order.station === "angenommen" || order.station === "wareneingang";
  if (filter === "fertig") return ["fertig", "raus", "abgeholt", "versendet"].includes(order.station);
  return order.station === "galvanik";
}

function orderSubject(order: OrderListRow): string {
  const customer = order.customerName?.trim();
  const title = order.title.trim();
  if (customer && title.toLocaleLowerCase("de-DE").startsWith(customer.toLocaleLowerCase("de-DE"))) {
    const remainder = title.slice(customer.length).replace(/^[\s·—–-]+/, "").trim();
    if (remainder) return remainder;
  }
  return order.itemDescription?.trim() || title || "Auftrag";
}

function detailText(order: OrderListRow): string | undefined {
  if (order.cardReadErrorCode) return `Lesefehler · ${order.cardReadErrorCode}`;
  const subject = orderSubject(order);
  const surface = order.surfaceRequested?.trim();
  const quantity = order.parts.length > 0 ? `${order.parts.length} ${order.parts.length === 1 ? "Teil" : "Teile"}` : null;
  return [subject, surface, quantity, order.statusText].filter(Boolean).join(" · ") || undefined;
}

function rowTone(order: OrderListRow): "ok" | "warn" | "rot" | "info" {
  if (order.cardReadErrorCode) return "rot";
  if (order.risk === "red" || order.risk === "blocked") return "rot";
  if (order.risk === "orange" || order.risk === "yellow") return "warn";
  return order.station === "fertig" ? "ok" : "info";
}

function failureMessage(kind: Exclude<OrdersState["kind"], "loading" | "data">): string {
  if (kind === "denied") return "Aufträge sind für diese Sitzung nicht freigegeben.";
  if (kind === "conflict") return "Der Auftragsstand hat sich geändert. Bitte neu laden.";
  return "Aufträge konnten nicht geladen werden.";
}

function calendarDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12));
  return Number.isNaN(date.getTime()) ? null : date;
}

function berlinDate(value: string): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  return new Date(Date.UTC(
    Number(parts.find((part) => part.type === "year")?.value),
    Number(parts.find((part) => part.type === "month")?.value) - 1,
    Number(parts.find((part) => part.type === "day")?.value),
    12,
  ));
}

function dateKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function startOfWeek(date: Date): Date {
  const day = date.getUTCDay() || 7;
  const monday = new Date(date);
  monday.setUTCDate(date.getUTCDate() - day + 1);
  return monday;
}

function dueOrdersFor(orders: readonly OrderListRow[], date: Date): OrderListRow[] {
  const key = dateKey(date);
  return orders.filter((order) => dateKey(calendarDate(order.dueDate) ?? new Date(0)) === key);
}

function OrderRow({ order, onOpen }: { order: OrderListRow; onOpen: (id: string) => void }) {
  return <Auftragszeile
    id={order.orderNumber}
    kundeKurz={order.customerName ?? "Kunde nicht hinterlegt"}
    titel={orderSubject(order)}
    meta={detailText(order)}
    ton={rowTone(order)}
    status={{ text: order.cardReadErrorCode ?? (order.dueValue || order.statusText), ton: rowTone(order) }}
    karte
    onOeffnen={() => onOpen(order.id)}
  />;
}

export function OrdersAppAdapter() {
  const openOrder = useOverlayStore((state) => state.openOrder);
  const { hasPermission, loading: permissionsLoading } = usePermissions();
  const [state, setState] = useState<OrdersState>({ kind: "loading" });
  const [query, setQuery] = useState("");
  const [view, setView] = useState<ViewMode>("liste");
  const [filter, setFilter] = useState<OrderFilter>("alle");

  useEffect(() => {
    const stored = window.sessionStorage.getItem(KEY) ?? "";
    const search = new URLSearchParams(window.location.search);
    const requestedView = search.get("view");
    const requestedFilter = search.get("station");
    queueMicrotask(() => {
      setQuery(stored);
      if (requestedView === "woche" || requestedView === "monat") setView(requestedView);
      if (requestedFilter === "fertig" || requestedFilter === "galvanik" || requestedFilter === "angenommen") setFilter(requestedFilter);
    });
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setState({ kind: "loading" });
      try {
        const result = await getOrdersDb();
        if (!active) return;
        if (!result.ok) {
          setState({
            kind: result.error === "UNAUTHORIZED" || result.error === "FORBIDDEN" ? "denied" : result.error === "CONFLICT" ? "conflict" : "error",
            message: result.message,
          });
          return;
        }
        setState({ kind: "data", orders: result.data.map(toOrderListRow), loadedAt: new Date().toISOString() });
      } catch {
        if (active) setState({ kind: "error", message: "Aufträge konnten nicht sicher geladen werden." });
      }
    };
    void load();
    window.addEventListener("kreile-sync-orders", load);
    return () => {
      active = false;
      window.removeEventListener("kreile-sync-orders", load);
    };
  }, []);

  const orders = useMemo(() => {
    if (state.kind !== "data") return [];
    const needle = normalized(query);
    return state.orders.filter((order) => matchesFilter(order, filter) && matchesQuery(order, needle));
  }, [filter, query, state]);
  const canCreateOrder = !permissionsLoading && hasPermission("perm_data_orders");
  const updateQuery = (value: string) => {
    window.sessionStorage.setItem(KEY, value);
    setQuery(value);
  };

  const viewPicker = <Segment<ViewMode>
    label="Auftragsansicht"
    optionen={[
      { wert: "liste", text: "Liste" },
      { wert: "woche", text: "Woche" },
      { wert: "monat", text: "Monat" },
    ]}
    wert={view}
    onWert={setView}
  />;

  if (state.kind === "loading") return <section data-testid="orders-v11">
    <SeitenKopf titel="Aufträge" werkzeug={viewPicker} />
    <Zustand art="laedt" text="Aufträge werden geladen." />
  </section>;

  if (state.kind !== "data") return <section data-testid="orders-v11">
    <SeitenKopf titel="Aufträge" werkzeug={viewPicker} />
    <Zustand art={state.kind === "error" ? "fehler" : "gesperrt"} text={state.message || failureMessage(state.kind)} />
  </section>;

  if (state.orders.length === 0) return <section data-testid="orders-v11">
    <SeitenKopf titel="Aufträge" werkzeug={viewPicker} />
    <Zustand art="leer" text="Noch keine Aufträge." aktion={canCreateOrder ? { text: "Neuer Eingang", icon: "inbox", onClick: () => requestGlobalCreate("DIRECT_INTAKE") } : undefined} />
  </section>;

  const now = berlinDate(state.loadedAt);
  const monday = startOfWeek(now);
  const weekDays = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(monday);
    date.setUTCDate(monday.getUTCDate() + index);
    const dayOrders = dueOrdersFor(state.orders, date);
    return {
      datum: dateKey(date),
      label: new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(date),
      heute: dateKey(date) === dateKey(now),
      eintraege: dayOrders.map((order) => <Terminzeile key={order.id} zeit="·" art="bestätigt" auftragNr={order.orderNumber} kundeKurz={order.customerName ?? orderSubject(order)} meta={orderSubject(order)} onOeffnen={() => openOrder(order.id)} />),
    };
  });
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 12));
  const monthLength = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  const monthDays = Array.from({ length: monthLength }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), index + 1, 12));
    const dayOrders = dueOrdersFor(state.orders, date);
    return {
      datum: dateKey(date),
      label: String(index + 1),
      heute: dateKey(date) === dateKey(now),
      eintraege: dayOrders.map((order) => <span key={order.id}>{order.orderNumber}</span>),
    };
  });

  return <section data-testid="orders-v11">
    <SeitenKopf titel="Aufträge" werkzeug={viewPicker} />
    {view === "liste" ? <div className="kr-stapel">
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 260px" }}><SuchFeld wert={query} onWert={updateQuery} platzhalter="Auftrag, Kunde, Teil oder Oberfläche" /></div>
        <Segment<OrderFilter>
          label="Aufträge filtern"
          optionen={[
            { wert: "alle", text: "Alle" },
            { wert: "galvanik", text: "In Arbeit" },
            { wert: "angenommen", text: "Angenommen" },
            { wert: "fertig", text: "Fertig" },
          ]}
          wert={filter}
          onWert={setFilter}
        />
      </div>
      {orders.length ? <div className="kr-stapel" style={{ gap: 8 }}>{orders.map((order) => <OrderRow key={order.id} order={order} onOpen={openOrder} />)}</div> : <Zustand art="leer" text={query ? `Kein Auftrag für „${query}“.` : "Keine Aufträge in dieser Auswahl."} aktion={canCreateOrder ? { text: "Neuer Eingang", icon: "inbox", onClick: () => requestGlobalCreate("DIRECT_INTAKE") } : undefined} />}
    </div> : null}
    {view === "woche" ? <div className="kr-stapel"><Terminuebersicht ansicht="woche" tage={weekDays} /></div> : null}
    {view === "monat" ? <div className="kr-stapel">
      <h2 style={{ margin: 0, fontSize: 13 }}>{new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric", timeZone: "UTC" }).format(monthStart)}</h2>
      <Terminuebersicht ansicht="monat" tage={monthDays} versatz={(monthStart.getUTCDay() + 6) % 7} onTag={() => setView("woche")} />
    </div> : null}
  </section>;
}
