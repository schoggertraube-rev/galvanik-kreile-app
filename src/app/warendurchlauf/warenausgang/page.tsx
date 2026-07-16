"use client";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { BackButton } from "@/components/ui/BackButton";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, Package, Truck, MessageSquare, CreditCard, Send } from "lucide-react";
import { useState, useEffect } from "react";
import { getOrdersDb, type OrderResponse } from "@/app/actions/orders.actions";
import { useOrderModal } from "@/components/orders/OrderModalProvider";

export default function WarenausgangPage() {
  const [orders, setOrders] = useState<OrderResponse[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const { openOrder } = useOrderModal();

  useEffect(() => {
    const fetchOrders = async () => {
      const res = await getOrdersDb();
      if (!res.ok) {
        setOrders([]);
        setLoadError(res.message);
        setLoadState("error");
        return;
      }
      setOrders(res.data.filter((order) => (order.currentStationId || order.station) === "warenausgang"));
      setLoadError(null);
      setLoadState("ready");
    };
    fetchOrders();
    window.addEventListener("kreile-orders-updated", fetchOrders);
    return () => window.removeEventListener("kreile-orders-updated", fetchOrders);
  }, []);

  return (
    <div className="w-full h-full font-sans antialiased text-[#1a1a1a]">

      <div className="w-full mx-auto px-5 md:px-8 lg:px-12 xl:px-16 py-6">

        {/* Titel */}
        <div className="text-[13px] font-bold text-[#5e5850] mb-3 flex items-center gap-2">
          Warenausgang
          <span className="flex-1 h-px bg-[#d8d0c4]" />
        </div>
        <p className="text-sm text-[#9e9689] mb-5">Physische Übergabe oder Versand mit dauerhaftem Beleg bestätigen</p>

        {/* Aktionskarten */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <Link
            href="/orders"
            className="flex flex-col gap-2 p-5 rounded-[14px] cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md hover:bg-[#f4f0e8]"
            style={{ background: "#faf8f4", border: "1.5px solid #d8d0c4" }}
          >
            <div className="w-10 h-10 rounded-[10px] bg-[#e6f4ea] flex items-center justify-center mb-2">
              <CheckCircle2 className="w-5 h-5 text-[#1a6b38]" />
            </div>
            <span className="text-[15px] font-bold text-[#1a1a1a]">Auftragsakten</span>
            <span className="text-xs text-[#9e9689]">Operative Aufträge prüfen</span>
          </Link>

          <Link
            href="#handover-list"
            className="flex flex-col gap-2 p-5 rounded-[14px] cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md hover:bg-[#f4f0e8]"
            style={{ background: "#faf8f4", border: "1.5px solid #d8d0c4" }}
          >
            <div className="w-10 h-10 rounded-[10px] bg-[#fef3e2] flex items-center justify-center mb-2">
              <Package className="w-5 h-5 text-[#c8922a]" />
            </div>
            <span className="text-[15px] font-bold text-[#1a1a1a]">Abholung belegen</span>
            <span className="text-xs text-[#9e9689]">Auftrag öffnen und Abholschein bestätigen</span>
          </Link>

          <Link
            href="#handover-list"
            className="flex flex-col gap-2 p-5 rounded-[14px] cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md hover:bg-[#f4f0e8]"
            style={{ background: "#faf8f4", border: "1.5px solid #d8d0c4" }}
          >
            <div className="w-10 h-10 rounded-[10px] bg-[#fef3e2] flex items-center justify-center mb-2">
              <Truck className="w-5 h-5 text-[#c8922a]" />
            </div>
            <span className="text-[15px] font-bold text-[#1a1a1a]">Versand belegen</span>
            <span className="text-xs text-[#9e9689]">Frachtführer und Belegreferenz bestätigen</span>
          </Link>

          <Link
            href="/kommunikation"
            className="flex flex-col gap-2 p-5 rounded-[14px] cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md hover:bg-[#f4f0e8]"
            style={{ background: "#faf8f4", border: "1.5px solid #d8d0c4" }}
          >
            <div className="w-10 h-10 rounded-[10px] bg-[#fef3e2] flex items-center justify-center mb-2">
              <MessageSquare className="w-5 h-5 text-[#c8922a]" />
            </div>
            <span className="text-[15px] font-bold text-[#1a1a1a]">Kommunikation öffnen</span>
            <span className="text-xs text-[#9e9689]">Notiz erfassen; automatischer Versand ist nicht angebunden</span>
          </Link>

          <button
            disabled
            title="Zahlungsledger und serverbestätigter Betrag sind noch nicht angebunden"
            className="flex flex-col text-left gap-2 p-5 rounded-[14px] cursor-not-allowed opacity-70"
            style={{ background: "#faf8f4", border: "1.5px solid #d8d0c4" }}
          >
            <div className="w-10 h-10 rounded-[10px] bg-[#fef3e2] flex items-center justify-center mb-2">
              <CreditCard className="w-5 h-5 text-[#c8922a]" />
            </div>
            <span className="text-[15px] font-bold text-[#1a1a1a]">Zahlung erfassen</span>
            <span className="text-xs text-[#9e9689]">Noch nicht an Ledger und Zahlungsprovider angebunden</span>
          </button>
        </div>

        {/* Warenausgang Aufträge & Zahlungsstatus */}
        <div id="handover-list" className="mt-8 bg-white border border-[#d8d0c4] rounded-[14px] overflow-hidden shadow-sm">
          <div className="p-5 border-b border-[#d8d0c4] bg-[#faf8f4] flex items-center justify-between">
            <div>
              <h2 className="text-[15px] font-bold text-[#1a1a1a]">Aufträge im Warenausgang</h2>
              <p className="text-xs text-[#9e9689]">Auftrag öffnen, Warenausgang starten und reale Übergabe atomar belegen</p>
            </div>
          </div>

          <div className="flex flex-col">
            {loadState === "loading" ? (
              <div role="status" className="p-6 text-center text-[#9e9689] text-sm">Warenausgang wird geladen …</div>
            ) : loadState === "error" ? (
              <div role="alert" className="m-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"><AlertTriangle className="h-4 w-4 shrink-0" /> Aufträge nicht verfügbar: {loadError}</div>
            ) : orders.length === 0 ? (
              <div className="p-6 text-center text-[#9e9689] text-sm">Keine bestätigten Aufträge im Warenausgang</div>
            ) : (
              orders.map(o => {
                return (
                  <div key={o.id} onClick={() => openOrder(o.id)} className="flex items-center justify-between p-4 border-b border-[#d8d0c4] last:border-b-0 hover:bg-[#fcfbf9] transition-colors cursor-pointer">
                    <div className="flex flex-col">
                      <span className="font-mono text-[13px] font-bold text-[#1a1a1a]">{o.orderNumber}</span>
                      <span className="text-[14px] font-semibold text-[#1a1a1a]">{o.customerName || "Unbekannt"}</span>
                      <span className="text-[12px] text-[#5e5850]">{o.title || o.task || "Kein Titel"}</span>
                    </div>

                    <div className="flex items-center gap-6">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openOrder(o.id);
                        }}
                        className="px-3 py-1.5 bg-navy-900 text-white rounded-[8px] text-[12px] font-bold flex items-center gap-1"
                      >
                        <Send className="w-3.5 h-3.5" /> Übergabe erfassen
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
