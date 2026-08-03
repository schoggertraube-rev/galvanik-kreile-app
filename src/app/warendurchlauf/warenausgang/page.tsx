"use client";

import Link from "next/link";
import { CheckCircle2, Package, Truck, MessageSquare, CreditCard, Send } from "lucide-react";
import { useState, useEffect } from "react";
import { PaymentDrawer } from "@/components/orders/PaymentDrawer";
import { getOrdersDb } from "@/app/actions/orders.actions";
import { useOrderModal } from "@/components/orders/OrderModalProvider";

export default function WarenausgangPage() {
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [sendingInvoice, setSendingInvoice] = useState<string | null>(null);
  const { openOrder } = useOrderModal();

  useEffect(() => {
    const fetchOrders = async () => {
      const res = await getOrdersDb();
      if (res.ok && res.data) {
        setOrders(res.data.filter((o: any) => o.station === "warenausgang" || o.currentStationId === "warenausgang"));
      }
    };
    fetchOrders();
  }, []);

  const sendInvoice = async (orderId: string) => {
    setSendingInvoice(orderId);
    try {
      await fetch("/api/kommzentrale/invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId })
      });
      // Optionally show a toast here. We just stop the loading state.
    } catch(err) {
      console.error(err);
    } finally {
      setSendingInvoice(null);
    }
  };

  return (
    <div className="w-full h-full font-sans antialiased text-[#1a1a1a]">

      <div className="w-full mx-auto px-5 md:px-8 lg:px-12 xl:px-16 py-6">

        {/* Titel */}
        <div className="text-[13px] font-bold text-[#5e5850] mb-3 flex items-center gap-2">
          Warenausgang
          <span className="flex-1 h-px bg-[#d8d0c4]" />
        </div>
        <p className="text-sm text-[#9e9689] mb-5">Fertige Aufträge, Abholung, Versand und Zahlung</p>

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
            <span className="text-[15px] font-bold text-[#1a1a1a]">Heute fertig</span>
            <span className="text-xs text-[#9e9689]">Ware aus der Produktion</span>
          </Link>

          <Link
            href="/warendurchlauf?station=warenausgang"
            className="flex flex-col gap-2 p-5 rounded-[14px] cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md hover:bg-[#f4f0e8]"
            style={{ background: "#faf8f4", border: "1.5px solid #d8d0c4" }}
          >
            <div className="w-10 h-10 rounded-[10px] bg-[#fef3e2] flex items-center justify-center mb-2">
              <Package className="w-5 h-5 text-[#c8922a]" />
            </div>
            <span className="text-[15px] font-bold text-[#1a1a1a]">Abholbereit</span>
            <span className="text-xs text-[#9e9689]">Auf Kunden wartend</span>
          </Link>

          <Link
            href="/warendurchlauf?station=warenausgang"
            className="flex flex-col gap-2 p-5 rounded-[14px] cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md hover:bg-[#f4f0e8]"
            style={{ background: "#faf8f4", border: "1.5px solid #d8d0c4" }}
          >
            <div className="w-10 h-10 rounded-[10px] bg-[#fef3e2] flex items-center justify-center mb-2">
              <Truck className="w-5 h-5 text-[#c8922a]" />
            </div>
            <span className="text-[15px] font-bold text-[#1a1a1a]">Versand vorbereiten</span>
            <span className="text-xs text-[#9e9689]">Packen & Tracking</span>
          </Link>

          <Link
            href="/kommunikation"
            className="flex flex-col gap-2 p-5 rounded-[14px] cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md hover:bg-[#f4f0e8]"
            style={{ background: "#faf8f4", border: "1.5px solid #d8d0c4" }}
          >
            <div className="w-10 h-10 rounded-[10px] bg-[#fef3e2] flex items-center justify-center mb-2">
              <MessageSquare className="w-5 h-5 text-[#c8922a]" />
            </div>
            <span className="text-[15px] font-bold text-[#1a1a1a]">Kunde informieren</span>
            <span className="text-xs text-[#9e9689]">Benachrichtigung senden</span>
          </Link>

          <button
            onClick={() => setPaymentModalOpen(true)}
            className="flex flex-col text-left gap-2 p-5 rounded-[14px] cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md hover:bg-[#f4f0e8]"
            style={{ background: "#faf8f4", border: "1.5px solid #d8d0c4" }}
          >
            <div className="w-10 h-10 rounded-[10px] bg-[#fef3e2] flex items-center justify-center mb-2">
              <CreditCard className="w-5 h-5 text-[#c8922a]" />
            </div>
            <span className="text-[15px] font-bold text-[#1a1a1a]">Zahlungsstatus / Zahlung erfassen</span>
            <span className="text-xs text-[#9e9689]">Kontaktlos bei Abholung bezahlen</span>
          </button>
        </div>

        {/* Warenausgang Aufträge & Zahlungsstatus */}
        <div className="mt-8 bg-white border border-[#d8d0c4] rounded-[14px] overflow-hidden shadow-sm">
          <div className="p-5 border-b border-[#d8d0c4] bg-[#faf8f4] flex items-center justify-between">
            <div>
              <h2 className="text-[15px] font-bold text-[#1a1a1a]">Aufträge im Warenausgang</h2>
              <p className="text-xs text-[#9e9689]">Übersicht, Zahlungsstatus & Automatischer Rechnungsversand</p>
            </div>
          </div>

          <div className="flex flex-col">
            {orders.length === 0 ? (
              <div className="p-6 text-center text-[#9e9689] text-sm">Noch keine Aufträge erfasst</div>
            ) : (
              orders.map(o => {
                const isPaid = o.risk === "green";

                return (
                  <div key={o.id} onClick={() => openOrder(o.id)} className="flex items-center justify-between p-4 border-b border-[#d8d0c4] last:border-b-0 hover:bg-[#fcfbf9] transition-colors cursor-pointer">
                    <div className="flex flex-col">
                      <span className="font-mono text-[13px] font-bold text-[#1a1a1a]">{o.orderNumber}</span>
                      <span className="text-[14px] font-semibold text-[#1a1a1a]">{o.customerName || "Unbekannt"}</span>
                      <span className="text-[12px] text-[#5e5850]">{o.title || o.task || "Kein Titel"}</span>
                    </div>

                    <div className="flex items-center gap-6">
                      {/* Zahlungsstatus */}
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] uppercase font-bold text-[#9e9689] mb-1">Zahlungsstatus</span>
                        {isPaid ? (
                          <span className="px-2.5 py-1 rounded-[6px] bg-[#e6f4ea] text-[#1a6b38] text-[11px] font-bold flex items-center gap-1.5">
                            <CheckCircle2 className="w-3 h-3" /> Bezahlt
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-[6px] bg-[#fef3e2] text-[#c8922a] text-[11px] font-bold flex items-center gap-1.5">
                            <CreditCard className="w-3 h-3" /> Offen
                          </span>
                        )}
                      </div>

                      {/* 1-Klick Kommzentrale */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          sendInvoice(o.id);
                        }}
                        disabled={sendingInvoice === o.id}
                        className="px-3 py-1.5 bg-[#f5f5f5] hover:bg-[#eaeaea] text-[#1a1a1a] rounded-[8px] text-[12px] font-bold transition-colors flex items-center gap-1"
                      >
                        {sendingInvoice === o.id ? (
                          <>Wird gesendet...</>
                        ) : (
                          <><Send className="w-3.5 h-3.5" /> 1-Klick Rechnung</>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {paymentModalOpen && (
        <PaymentDrawer 
          orderData={{}} 
          onClose={() => setPaymentModalOpen(false)} 
        />
      )}
    </div>
  );
}
