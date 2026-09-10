"use client";

import { useEffect, useState } from "react";
import { getOrdersDb } from "@/app/actions/orders.actions";
import { OrdersView, type OrdersViewState } from "@/modules/orders/public";
import { useOverlayStore } from "@/lib/overlayStore";

export function OrdersAppAdapter() {
  const openOrder = useOverlayStore((state) => state.openOrder);
  const [state, setState] = useState<OrdersViewState>({ kind: "loading" });
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
  return <OrdersView state={state} onOpenOrder={openOrder} />;
}
