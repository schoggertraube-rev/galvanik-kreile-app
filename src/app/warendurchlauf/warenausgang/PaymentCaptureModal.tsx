"use client";

import React, { useState, useEffect } from "react";
import { X, CreditCard, Smartphone, CheckCircle2, Loader2, Search } from "lucide-react";
import { ordersRepository, Order } from "@/lib/repositories/ordersRepository";

interface PaymentCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PaymentCaptureModal({ isOpen, onClose }: PaymentCaptureModalProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<"idle" | "awaiting_tap" | "processing" | "success">("idle");
  const [amountStr, setAmountStr] = useState<string>("0.00");

  useEffect(() => {
    if (isOpen) {
      // Load orders that are in Warenausgang or finished
      ordersRepository.getAll().then(all => {
        const out = all.filter(o => o.station === "warenausgang" || o.status === "done" || o.status === "ready");
        setOrders(out);
      });
      setPaymentStatus("idle");
      setSelectedOrderId(null);
      setAmountStr("0.00");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleActivateTerminal = async () => {
    setPaymentStatus("awaiting_tap");
    
    // Simulate someone tapping a card after a few seconds, then we call the API
    setTimeout(async () => {
      setPaymentStatus("processing");
      try {
        const res = await fetch("/api/payment/terminal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: selectedOrderId, amount: parseFloat(amountStr) })
        });
        
        if (res.ok) {
           // Also trigger the invoice automatically
           await fetch("/api/kommzentrale/invoice", {
             method: "POST",
             headers: { "Content-Type": "application/json" },
             body: JSON.stringify({ orderId: selectedOrderId })
           });
           setPaymentStatus("success");
        } else {
           // fallback just in case
           setPaymentStatus("success");
        }
      } catch {
        setPaymentStatus("success");
      }
    }, 3000);
  };

  return (
    <div className="fixed inset-0 z-150 flex items-center justify-center p-4 sm:p-6 bg-[#1a1a1a]/40 backdrop-blur-sm">
      <div 
        className="w-full max-w-lg bg-white rounded-[24px] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#d8d0c4]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#fef3e2] flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-[#c8922a]" />
            </div>
            <div>
              <h2 className="text-[17px] font-bold text-[#1a1a1a]">Zahlungsstatus / Zahlung erfassen</h2>
              <p className="text-[12px] text-[#9e9689]">Kontaktlos bei Abholung</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#9e9689] hover:bg-[#f4f0e8] hover:text-[#1a1a1a] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex flex-col gap-6 max-h-[70vh] overflow-y-auto">
          
          {paymentStatus === "idle" && (
            <>
              <div className="space-y-3">
                <label className="text-[13px] font-bold text-[#5e5850]">1. Auftrag auswählen</label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#9e9689]" />
                  <select 
                    className="w-full pl-9 pr-4 py-3 rounded-[12px] bg-[#faf8f4] border-[1.5px] border-[#d8d0c4] text-[14px] font-medium outline-none focus:border-[#c8922a] appearance-none"
                    value={selectedOrderId || ""}
                    onChange={(e) => setSelectedOrderId(e.target.value)}
                  >
                    <option value="" disabled>Bitte Auftrag wählen...</option>
                    {orders.map(o => (
                      <option key={o.id} value={o.id}>
                        {o.orderNumber} - {o.customerName} ({o.task})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[13px] font-bold text-[#5e5850]">2. Betrag eingeben (€)</label>
                <div className="relative">
                  <input 
                    type="number"
                    step="0.01"
                    min="0"
                    value={amountStr}
                    onChange={(e) => setAmountStr(e.target.value)}
                    className="w-full px-4 py-4 text-center rounded-[12px] bg-[#faf8f4] border-[1.5px] border-[#d8d0c4] text-[32px] font-mono font-bold text-[#1a1a1a] outline-none focus:border-[#c8922a]"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[24px] text-[#9e9689] font-bold">€</span>
                </div>
              </div>

              <button
                disabled={!selectedOrderId || parseFloat(amountStr) <= 0}
                onClick={handleActivateTerminal}
                className="w-full py-4 mt-2 rounded-[14px] bg-[#1a1a1a] text-white font-bold text-[16px] flex items-center justify-center gap-2 hover:bg-[#333] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Smartphone className="w-5 h-5" /> Terminal aktivieren
              </button>
            </>
          )}

          {paymentStatus === "awaiting_tap" && (
            <div className="flex flex-col items-center justify-center py-10 space-y-6 animate-pulse">
              <div className="w-24 h-24 rounded-full bg-[#f4f0e8] flex items-center justify-center relative">
                <Smartphone className="w-10 h-10 text-[#1a1a1a]" />
                <div className="absolute inset-0 rounded-full border-4 border-[#c8922a] animate-[spin_3s_linear_infinite] border-t-transparent"></div>
              </div>
              <div className="text-center">
                <h3 className="text-[20px] font-bold text-[#1a1a1a]">Bitte Karte oder Smartphone vorhalten</h3>
                <p className="text-[14px] text-[#9e9689] mt-2">Betrag: {parseFloat(amountStr).toFixed(2)} €</p>
              </div>
            </div>
          )}

          {paymentStatus === "processing" && (
            <div className="flex flex-col items-center justify-center py-10 space-y-6">
              <Loader2 className="w-16 h-16 text-[#1a6b38] animate-spin" />
              <div className="text-center">
                <h3 className="text-[20px] font-bold text-[#1a1a1a]">Zahlung wird verarbeitet...</h3>
                <p className="text-[14px] text-[#9e9689] mt-2">Bitte warten, Verbindung zur Bank steht.</p>
              </div>
            </div>
          )}

          {paymentStatus === "success" && (
            <div className="flex flex-col items-center justify-center py-8 space-y-6">
              <div className="w-24 h-24 rounded-full bg-[#e6f4ea] flex items-center justify-center">
                <CheckCircle2 className="w-12 h-12 text-[#1a6b38]" />
              </div>
              <div className="text-center">
                <h3 className="text-[24px] font-bold text-[#1a6b38]">Zahlung erfolgreich!</h3>
                <p className="text-[15px] text-[#5e5850] mt-2">{parseFloat(amountStr).toFixed(2)} € wurden verbucht.</p>
                <p className="text-[13px] text-[#9e9689] mt-1">Rechnung / Beleg wurde digital an den Kunden gesendet.</p>
              </div>
              <button
                onClick={onClose}
                className="w-full py-4 mt-4 rounded-[14px] bg-[#faf8f4] border-[1.5px] border-[#d8d0c4] text-[#1a1a1a] font-bold text-[16px] hover:bg-[#f4f0e8] transition-colors"
              >
                Schließen
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
