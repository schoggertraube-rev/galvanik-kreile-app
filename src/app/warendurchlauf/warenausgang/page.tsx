"use client";

import Link from "next/link";
import { CheckCircle2, Package, Truck, MessageSquare, CreditCard } from "lucide-react";
import { useEffect, useState } from "react";
import { getOrdersDb, type OrderResponse } from "@/app/actions/orders.actions";
import { useOrderModal } from "@/components/orders/OrderModalProvider";

const ACCOUNTING_AND_COMMUNICATION_DENIAL =
  "NOT_AVAILABLE: Zahlungsstatus, Zahlungserfassung, Rechnungsversand und Kundenbenachrichtigungen benötigen einen tenant- und ownership-geprüften Accounting- und Kommunikationsvertrag.";

type OrdersState =
  | { status: "loading" }
  | { status: "loaded"; orders: OrderResponse[] }
  | { status: "unavailable" };

export default function WarenausgangPage() {
  const [ordersState, setOrdersState] = useState<OrdersState>({ status: "loading" });
  const { openOrder } = useOrderModal();

  useEffect(() => {
    let active = true;

    const loadOrders = async () => {
      try {
        const result = await getOrdersDb();
        if (!active) return;

        if (result.ok && result.data) {
          setOrdersState({
            status: "loaded",
            orders: result.data.filter(
              (order) => order.station === "warenausgang" || order.currentStationId === "warenausgang"
            ),
          });
          return;
        }

        setOrdersState({ status: "unavailable" });
      } catch {
        if (active) setOrdersState({ status: "unavailable" });
      }
    };

    void loadOrders();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="w-full h-full font-sans antialiased text-[#1a1a1a]">
      <div className="w-full mx-auto px-5 md:px-8 lg:px-12 xl:px-16 py-6">
        <div className="text-[13px] font-bold text-[#5e5850] mb-3 flex items-center gap-2">
          Warenausgang
          <span className="flex-1 h-px bg-[#d8d0c4]" />
        </div>
        <p className="text-sm text-[#9e9689] mb-5">Fertige Aufträge, Abholung und Versand</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <Link href="/orders" className="flex flex-col gap-2 p-5 rounded-[14px] cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md hover:bg-[#f4f0e8]" style={{ background: "#faf8f4", border: "1.5px solid #d8d0c4" }}>
            <div className="w-10 h-10 rounded-[10px] bg-[#e6f4ea] flex items-center justify-center mb-2"><CheckCircle2 className="w-5 h-5 text-[#1a6b38]" /></div>
            <span className="text-[15px] font-bold text-[#1a1a1a]">Heute fertig</span>
            <span className="text-xs text-[#9e9689]">Ware aus der Produktion</span>
          </Link>

          <Link href="/warendurchlauf?station=warenausgang" className="flex flex-col gap-2 p-5 rounded-[14px] cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md hover:bg-[#f4f0e8]" style={{ background: "#faf8f4", border: "1.5px solid #d8d0c4" }}>
            <div className="w-10 h-10 rounded-[10px] bg-[#fef3e2] flex items-center justify-center mb-2"><Package className="w-5 h-5 text-[#c8922a]" /></div>
            <span className="text-[15px] font-bold text-[#1a1a1a]">Abholbereit</span>
            <span className="text-xs text-[#9e9689]">Auf Kunden wartend</span>
          </Link>

          <Link href="/warendurchlauf?station=warenausgang" className="flex flex-col gap-2 p-5 rounded-[14px] cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md hover:bg-[#f4f0e8]" style={{ background: "#faf8f4", border: "1.5px solid #d8d0c4" }}>
            <div className="w-10 h-10 rounded-[10px] bg-[#fef3e2] flex items-center justify-center mb-2"><Truck className="w-5 h-5 text-[#c8922a]" /></div>
            <span className="text-[15px] font-bold text-[#1a1a1a]">Versand vorbereiten</span>
            <span className="text-xs text-[#9e9689]">Packen & Tracking</span>
          </Link>

          <button type="button" disabled aria-label="Kundenbenachrichtigung" className="flex flex-col text-left gap-2 p-5 rounded-[14px] disabled:cursor-not-allowed disabled:opacity-60" style={{ background: "#faf8f4", border: "1.5px solid #d8d0c4" }}>
            <div className="w-10 h-10 rounded-[10px] bg-[#fef3e2] flex items-center justify-center mb-2"><MessageSquare className="w-5 h-5 text-[#c8922a]" /></div>
            <span className="text-[15px] font-bold text-[#1a1a1a]">Kundenbenachrichtigung</span>
            <span className="text-xs text-[#9e9689]">{ACCOUNTING_AND_COMMUNICATION_DENIAL}</span>
          </button>

          <button type="button" disabled aria-label="Zahlungsstatus / Zahlungserfassung" className="flex flex-col text-left gap-2 p-5 rounded-[14px] disabled:cursor-not-allowed disabled:opacity-60" style={{ background: "#faf8f4", border: "1.5px solid #d8d0c4" }}>
            <div className="w-10 h-10 rounded-[10px] bg-[#fef3e2] flex items-center justify-center mb-2"><CreditCard className="w-5 h-5 text-[#c8922a]" /></div>
            <span className="text-[15px] font-bold text-[#1a1a1a]">Zahlungsstatus / Zahlungserfassung</span>
            <span className="text-xs text-[#9e9689]">{ACCOUNTING_AND_COMMUNICATION_DENIAL}</span>
          </button>

          <button type="button" disabled aria-label="Rechnungsversand" className="flex flex-col text-left gap-2 p-5 rounded-[14px] disabled:cursor-not-allowed disabled:opacity-60" style={{ background: "#faf8f4", border: "1.5px solid #d8d0c4" }}>
            <div className="w-10 h-10 rounded-[10px] bg-[#fef3e2] flex items-center justify-center mb-2"><CreditCard className="w-5 h-5 text-[#c8922a]" /></div>
            <span className="text-[15px] font-bold text-[#1a1a1a]">Rechnungsversand</span>
            <span className="text-xs text-[#9e9689]">{ACCOUNTING_AND_COMMUNICATION_DENIAL}</span>
          </button>
        </div>

        <div className="mt-8 bg-white border border-[#d8d0c4] rounded-[14px] overflow-hidden shadow-sm">
          <div className="p-5 border-b border-[#d8d0c4] bg-[#faf8f4]">
            <h2 className="text-[15px] font-bold text-[#1a1a1a]">Aufträge im Warenausgang</h2>
            <p className="text-xs text-[#9e9689]">Bestätigte Auftragsanzeige</p>
          </div>

          <div className="flex flex-col">
            {ordersState.status === "loading" && <div className="p-6 text-center text-[#9e9689] text-sm">Aufträge werden geladen</div>}
            {ordersState.status === "unavailable" && <div data-testid="warenausgang-unavailable" className="p-6 text-center text-[#9e9689] text-sm">{ACCOUNTING_AND_COMMUNICATION_DENIAL}</div>}
            {ordersState.status === "loaded" && ordersState.orders.length === 0 && <div className="p-6 text-center text-[#9e9689] text-sm">Noch keine Aufträge erfasst</div>}
            {ordersState.status === "loaded" && ordersState.orders.map((order) => (
              <div key={order.id} data-testid="warenausgang-order-row" onClick={() => openOrder(order.id)} className="flex items-center justify-between p-4 border-b border-[#d8d0c4] last:border-b-0 hover:bg-[#fcfbf9] transition-colors cursor-pointer">
                <div className="flex flex-col">
                  <span className="font-mono text-[13px] font-bold text-[#1a1a1a]">{order.orderNumber}</span>
                  <span className="text-[14px] font-semibold text-[#1a1a1a]">{order.customerName || "Unbekannt"}</span>
                  <span className="text-[12px] text-[#5e5850]">{order.title || order.task || "Kein Titel"}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
