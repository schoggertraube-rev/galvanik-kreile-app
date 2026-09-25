"use client";

// Aufträge 1:1 aus der Owner-Mock-Bauvorlage (mock_extract/kreile/rolf_orders).
// Markup/Klassen stammen aus Vorlage.jsx; die bereits global geladene Original-CSS
// stellt die Optik bereit. Daten: tenant- und berechtigungsgebundener Orders-Read-Port.

import { useEffect, useMemo, useState } from "react";
import { getOrdersDb, type OrderResponse } from "@/app/actions/orders.actions";
import { requestGlobalCreate } from "@/components/layout/GlobalCreateFlow";
import { usePermissions } from "@/lib/auth/PermissionsContext";
import { useOverlayStore } from "@/lib/overlayStore";
import type { OrdersListItem } from "@/modules/orders/public";

const KEY = "path1.orders.filter";

type OrdersState =
  | { kind: "loading" }
  | { kind: "denied" | "error" | "conflict"; message: string }
  | { kind: "data"; orders: OrderListRow[] };

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
    | "dueValue"
  >;

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase("de");
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
    dueValue: order.dueValue,
  };
}

function matchesQuery(order: OrderListRow, query: string): boolean {
  if (!query) return true;
  return normalized(
    [
      order.orderNumber,
      order.customerName ?? "",
      order.title,
      order.task ?? "",
      order.itemDescription ?? "",
      order.station,
      order.status,
      order.statusText,
      order.surfaceRequested ?? "",
      ...order.parts.flatMap((part) => [part.name, part.material ?? "", part.surfaceRequested ?? ""]),
    ].join(" "),
  ).includes(query);
}

function detailText(order: OrderListRow): string | null {
  const description = order.itemDescription?.trim() || order.title.trim();
  const surface = order.surfaceRequested?.trim();
  const quantity = order.parts.length > 0
    ? `${order.parts.length} ${order.parts.length === 1 ? "Teil" : "Teile"}`
    : null;
  const parts = [description, surface, quantity].filter((value): value is string => Boolean(value));
  return parts.length > 0 ? parts.join(" · ") : null;
}

function dueStatusClass(risk: string): string {
  const value = risk.toLocaleLowerCase("de");
  if (value === "green") return "ok";
  if (value === "red" || value === "orange" || value === "yellow" || value === "blocked") return "warn";
  return "";
}

function failureMessage(kind: Exclude<OrdersState["kind"], "loading" | "data">): string {
  if (kind === "denied") return "Aufträge sind für diese Sitzung nicht freigegeben.";
  if (kind === "conflict") return "Der Auftragsstand hat sich geändert. Bitte neu laden.";
  return "Aufträge konnten nicht geladen werden.";
}

export function OrdersAppAdapter() {
  const openOrder = useOverlayStore((state) => state.openOrder);
  const { hasPermission, loading: permissionsLoading } = usePermissions();
  const [state, setState] = useState<OrdersState>({ kind: "loading" });
  const [query, setQuery] = useState("");

  useEffect(() => {
    const stored = window.sessionStorage.getItem(KEY) ?? "";
    queueMicrotask(() => setQuery(stored));
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
            kind:
              result.error === "UNAUTHORIZED" || result.error === "FORBIDDEN"
                ? "denied"
                : result.error === "CONFLICT"
                  ? "conflict"
                  : "error",
            message: result.message,
          });
          return;
        }
        setState({ kind: "data", orders: result.data.map(toOrderListRow) });
      } catch {
        if (active) {
          setState({
            kind: "error",
            message: "Aufträge konnten nicht sicher geladen werden.",
          });
        }
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
    return state.orders.filter((order) => matchesQuery(order, needle));
  }, [query, state]);
  const canCreateOrder = !permissionsLoading && hasPermission("perm_data_orders");

  const updateQuery = (value: string) => {
    window.sessionStorage.setItem(KEY, value);
    setQuery(value);
  };

  return (
    <div className="app-page" aria-labelledby="orders-title">
      <div className="app-head">
        <div>
          <h1 id="orders-title" style={{ margin: 0 }}>
            Aufträge
          </h1>
          <p>Suche und Filter sind nur der Einstieg. Geöffnet wird immer dieselbe Auftragskarte V8.</p>
        </div>
        {canCreateOrder ? (
          <button className="app-btn primary" type="button" onClick={() => requestGlobalCreate("DIRECT_INTAKE")}>
            Neuer Eingang
          </button>
        ) : null}
      </div>

      <div className="app-toolbar">
        <label className="app-search">
          ⌕
          <input
            aria-label="Aufträge filtern"
            onChange={(event) => updateQuery(event.target.value)}
            placeholder="Auftrag, Kunde, Teil oder Oberfläche"
            style={{}}
            value={query}
          />
        </label>
      </div>

      {state.kind === "loading" ? (
        <div className="app-list" role="status" aria-busy="true">
          <div className="app-list-head">
            <span>Auftrag</span>
            <span>Ort &amp; Termin</span>
            <span>Nächste Handlung</span>
            <span aria-hidden="true"></span>
          </div>
          <div className="app-row">Aufträge werden geladen.</div>
        </div>
      ) : null}

      {state.kind === "denied" || state.kind === "error" || state.kind === "conflict" ? (
        <div className="app-list" role={state.kind === "error" ? "alert" : "status"}>
          <div className="app-list-head">
            <span>Auftrag</span>
            <span>Ort &amp; Termin</span>
            <span>Nächste Handlung</span>
            <span aria-hidden="true"></span>
          </div>
          <div className="app-row">{state.message || failureMessage(state.kind)}</div>
        </div>
      ) : null}

      {state.kind === "data" ? (
        <>
          {orders.length === 0 ? (
            <div className="app-list" role="status">
              <div className="app-list-head">
                <span>Auftrag</span>
                <span>Ort &amp; Termin</span>
                <span>Nächste Handlung</span>
                <span aria-hidden="true"></span>
              </div>
              <div className="app-row">
                {state.orders.length === 0 ? "Keine Aufträge." : "Keine Aufträge gefunden."}
              </div>
            </div>
          ) : (
            <div className="app-list">
              <div className="app-list-head">
                <span>Auftrag</span>
                <span>Ort &amp; Termin</span>
                <span>Nächste Handlung</span>
                <span aria-hidden="true"></span>
              </div>
              {orders.map((order) => {
                const dueValue = order.dueValue?.trim();
                const location = order.station.trim() || order.statusText.trim();
                const detail = detailText(order);
                const statusClass = dueStatusClass(order.risk);

                return (
                  <div className="app-row" key={order.id}>
                    <div className="app-main">
                      <b>
                        {order.orderNumber}
                        {order.customerName ? ` · ${order.customerName}` : ""}
                      </b>
                      {detail ? <span>{detail}</span> : null}
                    </div>
                    <div className="app-meta">
                      {location}
                      {dueValue ? <span className={`app-status ${statusClass}`.trim()}>{dueValue}</span> : null}
                    </div>
                    <div className="app-meta"></div>
                    <button
                      aria-label={`Auftrag ${order.orderNumber} öffnen`}
                      className="app-btn"
                      onClick={() => openOrder(order.id)}
                      type="button"
                    >
                      Öffnen →
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
