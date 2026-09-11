"use client";

import { useEffect, useState } from "react";
import { getOrdersDb } from "@/app/actions/orders.actions";
import { OrdersView, type OrdersQueryPort, type OrdersViewState } from "@/modules/orders/public";
import { useOverlayStore } from "@/lib/overlayStore";

const ORDERS_FILTER_STORAGE_KEY = "kreile.orders.filter";

export function OrdersAppAdapter() {
  const openOrder = useOverlayStore((state) => state.openOrder);
  const [state, setState] = useState<OrdersViewState>({ kind: "loading" });
  const [query, setQuery] = useState("");
  const [queryReady, setQueryReady] = useState(false);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setQuery(window.sessionStorage.getItem(ORDERS_FILTER_STORAGE_KEY) ?? "");
      setQueryReady(true);
    });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    let active = true;
    const load = async () => {
      setState({ kind: "loading" });
      try {
        const result = await getOrdersDb();
        if (!active) return;
        if (!result.ok) {
          setState(result.error === "UNAUTHORIZED" || result.error === "FORBIDDEN"
            ? { kind: "denied", message: "Auftragsbestand ist für diese Sitzung nicht freigegeben." }
            : result.error === "CONFLICT"
              ? { kind: "conflict", message: "Auftragsbestand hat sich geändert. Bitte neu laden." }
              : { kind: "error", message: "Auftragsbestand konnte nicht sicher geladen werden." });
          return;
        }
        setState({ kind: "data", orders: result.data.map((order) => ({
          id: order.id,
          orderNumber: order.orderNumber,
          customerName: order.customerName ?? "Kunde nicht hinterlegt",
          title: order.title || order.task || "Auftrag",
          station: order.station,
          status: order.status,
          dueAt: order.dueDate || null,
          material: order.parts[0]?.material ?? null,
          surface: order.surfaceRequested ?? order.parts[0]?.surfaceRequested ?? null,
        })) });
      } catch {
        if (active) setState({ kind: "error", message: "Auftragsbestand konnte nicht sicher geladen werden." });
      }
    };
    void load();
    window.addEventListener("kreile-sync-orders", load);
    return () => { active = false; window.removeEventListener("kreile-sync-orders", load); };
  }, []);
  const queryPort: OrdersQueryPort = {
    value: query,
    onChange: (value) => {
      window.sessionStorage.setItem(ORDERS_FILTER_STORAGE_KEY, value);
      setQuery(value);
    },
  };
  return <OrdersView state={queryReady ? state : { kind: "loading" }} query={queryPort} onOpenOrder={openOrder} />;
}
