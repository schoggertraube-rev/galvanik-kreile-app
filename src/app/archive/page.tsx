"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { INITIAL_ORDERS, MockOrder } from "@/lib/mockData";
import { Archive as ArchiveIcon } from "lucide-react";
import { getStationConfig } from "@/constants/stations";
import { ordersRepository } from "@/lib/repositories/ordersRepository";
import { PageHeader } from "@/components/ui/PageHeader";

export default function ArchivePage() {
  const [orders, setOrders] = useState<MockOrder[]>([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const dbOrders = await ordersRepository.getAll();
        if (dbOrders && dbOrders.length > 0) {
          const parsed = dbOrders as unknown as MockOrder[];
          setOrders(parsed.filter(o => o.statusText === "closed" || o.statusText === "completed" || o.statusText === "shipped"));
        } else {
           setOrders(INITIAL_ORDERS.filter(o => o.statusText === "closed" || o.statusText === "completed" || o.statusText === "shipped"));
        }
      } catch (e) {
        console.error("Fehler beim Laden aus dem Repository", e);
      }
    };
    loadData();
  }, []);

  const getStationName = (station: string) => {
    return getStationConfig(station).fullName || station;
  };

  return (
    <div className="space-y-6 pb-12 font-sans antialiased text-kreile-navy max-w-5xl mx-auto">
      <PageHeader
        title="Kontrolle & Archiv"
        subtitle="Abgeschlossene und versendete Aufträge (Nur-Lese-Ansicht)."
      />

      {orders.length === 0 ? (
        <Card className="border-dashed border-2 border-kreile-border-strong bg-kreile-surface-soft/50 p-12 text-center rounded-2xl space-y-4">
          <div className="h-16 w-16 rounded-full bg-kreile-surface-warm flex items-center justify-center mx-auto text-kreile-muted">
            <ArchiveIcon className="h-8 w-8" />
          </div>
          <h4 className="font-extrabold text-lg text-kreile-navy">Keine archivierten Aufträge</h4>
          <p className="text-sm text-kreile-muted max-w-sm mx-auto leading-relaxed">
            Aktuell befinden sich keine Aufträge im Archiv. Sobald ein Auftrag den Warenausgang verlässt, taucht er hier auf.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <Card key={order.id} className="transition-all duration-300">
              <CardContent className="p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 opacity-75 hover:opacity-100">
                
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-kreile-surface-warm rounded-xl shrink-0">
                    <ArchiveIcon className="h-5 w-5 text-kreile-muted" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-black text-kreile-navy text-lg tracking-tight">{order.orderNumber}</span>
                      <span className="text-xs text-kreile-muted font-bold bg-kreile-surface-warm px-2.5 py-0.5 rounded-full border border-kreile-border-strong">{order.customerName}</span>
                      <Badge className="bg-kreile-border text-kreile-navy font-bold text-[9px] uppercase tracking-wider px-2 py-0.5">
                        Abgeschlossen
                      </Badge>
                    </div>
                    <h4 className="font-black text-slate-850 tracking-tight text-base md:text-lg">
                      {order.task}
                    </h4>
                    
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-kreile-muted pt-1">
                      <span className="font-bold text-kreile-navy bg-kreile-surface-soft border border-kreile-border-strong px-2 py-0.5 rounded-md">Letzte Station: {getStationName(order.station)}</span>
                      <span>•</span>
                      <span>Teile: {order.parts.length} Werkstücke</span>
                    </div>
                  </div>
                </div>

                <div className="w-full md:w-auto flex flex-row md:flex-col justify-between items-end gap-3 self-stretch md:self-auto border-t md:border-0 pt-3 md:pt-0">
                   <div className="text-left md:text-right text-kreile-muted">
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
