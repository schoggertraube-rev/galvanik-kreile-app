"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { INITIAL_ORDERS, MockOrder } from "@/lib/mockData";
import { Archive as ArchiveIcon } from "lucide-react";
import { getStationConfig } from "@/constants/stations";

export default function ArchivePage() {
  const [orders, setOrders] = useState<MockOrder[]>([]);

  useEffect(() => {
    const loadData = async () => {
      if (typeof window !== "undefined") {
        const savedOrders = localStorage.getItem("kreile_orders");
        if (savedOrders) {
          try {
            const parsed: MockOrder[] = JSON.parse(savedOrders);
            // Filter for completed/closed orders
            setOrders(parsed.filter(o => o.statusText === "closed" || o.statusText === "completed" || o.statusText === "shipped"));
          } catch (e) {
            console.error("Fehler beim Laden von kreile_orders aus localStorage", e);
          }
        } else {
           setOrders(INITIAL_ORDERS.filter(o => o.statusText === "closed" || o.statusText === "completed" || o.statusText === "shipped"));
        }
      }
    };
    loadData();
  }, []);

  const getStationName = (station: string) => {
    return getStationConfig(station).fullName || station;
  };

  return (
    <div className="space-y-6 pb-12 font-sans antialiased text-slate-900 max-w-5xl mx-auto">
      <div className="space-y-2">
        <h1 className="text-4xl font-black tracking-tight font-serif text-slate-900 flex items-center gap-3">
          <ArchiveIcon className="h-10 w-10 text-slate-400" />
          Kontrolle & Archiv
        </h1>
        <p className="text-slate-500 text-sm">
          Abgeschlossene und versendete Aufträge (Nur-Lese-Ansicht).
        </p>
      </div>

      {orders.length === 0 ? (
        <Card className="border-dashed border-2 border-slate-200 bg-slate-50/50 p-12 text-center rounded-2xl space-y-4">
          <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
            <ArchiveIcon className="h-8 w-8" />
          </div>
          <h4 className="font-extrabold text-lg text-slate-700">Keine archivierten Aufträge</h4>
          <p className="text-sm text-slate-500 max-w-sm mx-auto leading-relaxed">
            Aktuell befinden sich keine Aufträge im Archiv. Sobald ein Auftrag den Warenausgang verlässt, taucht er hier auf.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <Card key={order.id} className="transition-all duration-300">
              <CardContent className="p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 opacity-75 hover:opacity-100">
                
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-slate-100 rounded-xl shrink-0">
                    <ArchiveIcon className="h-5 w-5 text-slate-500" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-black text-slate-900 text-lg tracking-tight">{order.orderNumber}</span>
                      <span className="text-xs text-slate-500 font-bold bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">{order.customerName}</span>
                      <Badge className="bg-slate-200 text-slate-700 font-bold text-[9px] uppercase tracking-wider px-2 py-0.5">
                        Abgeschlossen
                      </Badge>
                    </div>
                    <h4 className="font-black text-slate-850 tracking-tight text-base md:text-lg">
                      {order.task}
                    </h4>
                    
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 pt-1">
                      <span className="font-bold text-slate-700 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md">Letzte Station: {getStationName(order.station)}</span>
                      <span>•</span>
                      <span>Teile: {order.parts.length} Werkstücke</span>
                    </div>
                  </div>
                </div>

                <div className="w-full md:w-auto flex flex-row md:flex-col justify-between items-end gap-3 self-stretch md:self-auto border-t md:border-0 pt-3 md:pt-0">
                   <div className="text-left md:text-right text-slate-400">
                     <span className="text-[10px] font-bold uppercase tracking-wider block">Datum</span>
                     <span className="font-black tracking-tight leading-none text-xl">
                       {order.dueDate || "N/A"}
                     </span>
                   </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
