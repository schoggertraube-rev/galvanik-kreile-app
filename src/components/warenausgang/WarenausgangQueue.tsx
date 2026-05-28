"use client";

import { useMemo, useState } from "react";
import { Order } from "@/lib/repositories/ordersRepository";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { PackageCheck, Mail, CheckCircle2, AlertCircle } from "lucide-react";
import { trackUiEvent } from "@/lib/tracking/tracking";

interface WarenausgangQueueProps {
  orders: Order[]; // These should only be orders in warenausgang
}

export function WarenausgangQueue({ orders }: WarenausgangQueueProps) {
  // Kunde -> Aufträge
  const groupedOrders = useMemo(() => {
    const groups: Record<string, Order[]> = {};
    orders.forEach(o => {
      const c = o.customerName || "Unbekannt";
      if (!groups[c]) groups[c] = [];
      groups[c].push(o);
    });
    return groups;
  }, [orders]);

  const handleSendMail = (customerName: string) => {
    alert(`Platzhalter: E-Mail mit Zahlungs-QR für ${customerName} generiert und versendet.`);
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-4xl mx-auto">
      <div className="flex items-center justify-between text-xs text-text-muted font-semibold px-1">
        <span>{orders.length} Aufträge im Warenausgang</span>
        <span>Nach Kunde gruppiert</span>
      </div>

      {Object.entries(groupedOrders).length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-neutral-gray-100 shadow-sm text-text-muted text-sm font-medium">
          Keine fertigen Aufträge im Warenausgang.
        </div>
      ) : (
        Object.entries(groupedOrders).map(([customer, custOrders]) => {
          // Dummy-Logik: Ein Kunde gilt als vollständig, wenn alle seine Aufträge hier im Warenausgang sind.
          // Da wir hier nur die Warenausgang-Aufträge haben, wissen wir nicht zwingend, ob der Kunde noch andere offene hat, 
          // außer wir würden global filtern. Fürs Frontend nehmen wir an, wenn wir hier rendern, 
          // prüfen wir einfach, ob mehr als 0 Aufträge da sind und nennen es mal testweise "vollständig" 
          // oder simulieren es. Die echte DB-Prüfung müsste serverseitig erfolgen.
          // Für diesen Lauf definieren wir: Wenn der Kunde hier gelistet ist, 
          // nehmen wir an, wir zeigen den Button an. 
          const isComplete = true; // Placeholder für echte Vollständigkeitsprüfung (z.B. aus DB)

          return (
            <div key={customer} className="bg-white border-2 border-neutral-gray-100 rounded-3xl p-5 shadow-sm transition-all hover:border-neutral-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-bold font-serif text-navy-900">{customer}</h3>
                  {isComplete ? (
                    <span className="flex items-center gap-1.5 bg-success-green-soft text-success-green px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider">
                      <CheckCircle2 className="w-3 h-3" />
                      Bereit zum Versand
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 bg-accent-orange-soft text-accent-orange px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider">
                      <AlertCircle className="w-3 h-3" />
                      Unvollständig
                    </span>
                  )}
                </div>
                
                {isComplete && (
                  <button 
                    onClick={() => handleSendMail(customer)}
                    className="hidden sm:flex items-center gap-2 bg-navy-900 text-white px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-navy-700 transition-all active:scale-95 shadow-md"
                  >
                    <Mail className="w-4 h-4" />
                    Zahlungs-QR Mail
                  </button>
                )}
              </div>

              <div className="flex flex-col gap-3">
                {custOrders.map(o => (
                  <div key={o.id} className="flex items-center justify-between bg-bg-app-soft rounded-2xl p-4 border border-neutral-gray-100">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-success-green-soft flex items-center justify-center shrink-0">
                        <PackageCheck className="w-5 h-5 text-success-green" />
                      </div>
                      <div>
                        <div className="font-extrabold text-sm text-navy-900 font-mono tracking-tight">#{o.id.slice(0, 8).toUpperCase()}</div>
                        <div className="text-xs text-text-muted font-medium mt-0.5">
                          Fertiggestellt am {format(new Date(), "dd.MM.yy")}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {isComplete && (
                <button 
                  onClick={() => handleSendMail(customer)}
                  className="sm:hidden w-full mt-4 flex items-center justify-center gap-2 bg-navy-900 text-white px-4 py-3.5 rounded-xl text-xs font-bold hover:bg-navy-700 transition-all active:scale-95 shadow-md"
                >
                  <Mail className="w-4 h-4" />
                  Zahlungs-QR Mail
                </button>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
