"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { X, Send, Clock, Package, CheckCircle2, User, FileText, Loader2, Calendar } from "lucide-react";
import { ordersRepository, Order } from "@/lib/repositories/ordersRepository";
import { customersRepository, Customer } from "@/lib/repositories/customersRepository";

interface OrderModalContextType {
  openOrder: (id: string) => void;
  closeOrder: () => void;
}

const OrderModalContext = createContext<OrderModalContextType | undefined>(undefined);

export function useOrderModal() {
  const context = useContext(OrderModalContext);
  if (!context) throw new Error("useOrderModal must be used within OrderModalProvider");
  return context;
}

const STATIONS = [
  { id: "wareneingang", label: "Wareneingang" },
  { id: "entmetallisierung", label: "Entmetallisierung" },
  { id: "schleiferei", label: "Schleiferei" },
  { id: "beschichtung", label: "Galvanik" },
  { id: "warenausgang", label: "Warenausgang" }
];

export function OrderModalProvider({ children }: { children: ReactNode }) {
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingMail, setIsSendingMail] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    if (openOrderId) {
      loadData(openOrderId);
    } else {
      setOrder(null);
      setCustomer(null);
    }
  }, [openOrderId]);

  const loadData = async (id: string) => {
    setIsLoading(true);
    try {
      const allOrders = await ordersRepository.getAll();
      const found = allOrders.find(o => o.id === id);
      if (found) {
        setOrder(found);
        if (found.customerId) {
          const allCustomers = await customersRepository.getAll();
          const cust = allCustomers.find(c => c.id === found.customerId);
          setCustomer(cust || null);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStationChange = async (stationId: string) => {
    if (!order) return;
    try {
      // Optimistic update
      setOrder(prev => prev ? { ...prev, station: stationId, currentStationId: stationId } : null);
      await ordersRepository.updateOrder(order.id, { station: stationId, currentStationId: stationId });
      
      // Dispatch custom event to tell other components to reload data
      window.dispatchEvent(new Event("kreile-orders-updated"));
    } catch(err) {
      console.error("Failed to update station", err);
      // Reload actual state on error
      loadData(order.id);
    }
  };

  const handleSendMail = async () => {
    if (!order) return;
    setIsSendingMail(true);
    try {
      const res = await fetch("/api/kommzentrale/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id, customerId: order.customerId })
      });
      const data = await res.json();
      if (data.ok) {
        setToastMsg("Status-Update via KommZentrale gesendet!");
        setTimeout(() => setToastMsg(null), 3000);
      } else {
        alert("Fehler beim Senden.");
      }
    } catch (e) {
      console.error(e);
      alert("Fehler beim Verbinden mit der KommZentrale.");
    } finally {
      setIsSendingMail(false);
    }
  };

  // Calculate Lead Time
  let leadTimeText = "Unbekannt";
  if (order?.intakeDate) {
    const intake = new Date(order.intakeDate);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - intake.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) leadTimeText = "Heute eingeliefert";
    else if (diffDays === 1) leadTimeText = "Seit 1 Tag im System";
    else leadTimeText = `Seit ${diffDays} Tagen im System`;
  }

  const renderModal = () => {
    if (!openOrderId) return null;

    return (
      <div className="fixed inset-0 z-999 flex items-center justify-center p-4 bg-navy-900/60 backdrop-blur-md animate-in fade-in duration-200">
        <div className="bg-bg-app w-full max-w-3xl max-h-[90vh] rounded-[24px] shadow-2xl overflow-hidden border border-[#d8d0c4] flex flex-col animate-in zoom-in-95 duration-300">
          
          {/* Header */}
          <div className="flex items-center justify-between p-6 bg-white border-b border-[#d8d0c4] shrink-0">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-2xl font-black font-serif text-navy-900">{order?.orderNumber || "Lädt..."}</h2>
                {order?.risk === 'red' && <span className="bg-[#c0392b] text-white text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md">Kritisch</span>}
                {order?.risk === 'orange' && <span className="bg-[#e67e22] text-white text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md">Gefahr</span>}
              </div>
              <p className="text-sm font-bold text-[#9e9689]">{order?.task || "Unbekannte Aufgabe"}</p>
            </div>
            <button onClick={() => setOpenOrderId(null)} className="p-3 bg-neutral-gray-50 hover:bg-neutral-gray-100 rounded-full transition-colors">
              <X className="w-6 h-6 text-navy-500" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-[#faf8f5]">
            
            {isLoading && !order ? (
              <div className="flex flex-col items-center justify-center py-20 text-[#9e9689]">
                <Loader2 className="w-8 h-8 animate-spin mb-4" />
                <p>Auftragsdaten werden geladen...</p>
              </div>
            ) : order ? (
              <>
                {/* Metrics Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white p-5 rounded-[16px] border border-[#d8d0c4] shadow-sm flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-navy-50 flex items-center justify-center text-navy-700">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-widest text-[#9e9689] mb-1">Durchlaufzeit</h4>
                      <p className="text-lg font-bold text-navy-900">{leadTimeText}</p>
                      {order.dueDate && <p className="text-xs text-[#c0392b] font-bold mt-1">Fällig am: {new Date(order.dueDate).toLocaleDateString("de-DE")}</p>}
                    </div>
                  </div>

                  <div className="bg-white p-5 rounded-[16px] border border-[#d8d0c4] shadow-sm flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-gold-50 flex items-center justify-center text-gold-700">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-widest text-[#9e9689] mb-1">Kundendaten</h4>
                      <p className="text-lg font-bold text-navy-900">{customer?.name || order.customerName || "Unbekannt"}</p>
                      {customer?.email && <p className="text-xs text-navy-500 mt-1">{customer.email}</p>}
                    </div>
                  </div>
                </div>

                {/* Station Pipeline */}
                <div>
                  <h3 className="text-sm font-black text-navy-900 mb-4 flex items-center gap-2">
                    <Package className="w-4 h-4 text-navy-500" />
                    Aktuelle Station
                  </h3>
                  <div className="bg-white rounded-[16px] border border-[#d8d0c4] shadow-sm p-2 flex flex-col md:flex-row md:items-center justify-between gap-2">
                    {STATIONS.map((station, idx) => {
                      const isActive = (order.station === station.id) || (order.currentStationId === station.id);
                      return (
                        <React.Fragment key={station.id}>
                          <button
                            onClick={() => handleStationChange(station.id)}
                            className={`flex-1 py-3 px-2 rounded-xl text-xs font-bold transition-all ${
                              isActive 
                                ? "bg-navy-900 text-white shadow-md scale-[1.02]" 
                                : "bg-transparent text-[#9e9689] hover:bg-neutral-gray-50 hover:text-navy-700"
                            }`}
                          >
                            {station.label}
                          </button>
                          {idx < STATIONS.length - 1 && (
                            <div className="hidden md:block w-4 h-px bg-[#d8d0c4] shrink-0" />
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center text-[#c0392b] p-6">Auftrag nicht gefunden.</div>
            )}
          </div>

          {/* Footer */}
          {order && (
            <div className="bg-white p-6 border-t border-[#d8d0c4] flex justify-between items-center shrink-0">
              <div className="text-sm text-[#27ae60] font-bold">
                {toastMsg}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setOpenOrderId(null)}
                  className="px-6 py-3 rounded-xl font-bold text-[#9e9689] hover:bg-neutral-gray-50 hover:text-navy-900 transition-colors"
                >
                  Schließen
                </button>
                <button
                  onClick={handleSendMail}
                  disabled={isSendingMail}
                  className="px-6 py-3 rounded-xl bg-navy-900 text-white font-bold hover:bg-navy-800 transition-colors flex items-center gap-2 shadow-md"
                >
                  {isSendingMail ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  {isSendingMail ? "Wird gesendet..." : "Kunden-Update senden"}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    );
  };

  return (
    <OrderModalContext.Provider value={{ openOrder: setOpenOrderId, closeOrder: () => setOpenOrderId(null) }}>
      {children}
      {renderModal()}
    </OrderModalContext.Provider>
  );
}
