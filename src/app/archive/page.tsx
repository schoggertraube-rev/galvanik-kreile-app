"use client";

import { usePageView } from "@/hooks/usePageView";
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Archive as ArchiveIcon } from "lucide-react";
import { getStationConfig } from "@/constants/stations";
import { getOrdersDb, type OrderResponse } from "@/app/actions/orders.actions";
import { PageHeader } from "@/components/ui/PageHeader";
import { AppBackButton } from "@/components/ui/AppBackButton";

type OrdersReadState = "loading" | "unavailable" | "loaded";

const ARCHIVED_ORDER_STATUSES = new Set([
  "done",
  "completed",
  "shipped",
  "abgeschlossen",
  "fertig",
]);

export default function ArchivePage() {
  usePageView();
  const [orders, setOrders] = useState<OrderResponse[]>([]);
  const [loadedOrderCount, setLoadedOrderCount] = useState(0);
  const [ordersReadState, setOrdersReadState] = useState<OrdersReadState>("loading");

  useEffect(() => {
    let active = true;
    const loadData = async () => {
      setOrders([]);
      setLoadedOrderCount(0);
      setOrdersReadState("loading");
      try {
        const dbOrdersRes = await getOrdersDb();
        if (!active) return;
        if (!dbOrdersRes.ok) {
          setOrdersReadState("unavailable");
          return;
        }
        setLoadedOrderCount(dbOrdersRes.data.length);
        setOrders(
          dbOrdersRes.data.filter((order) =>
            ARCHIVED_ORDER_STATUSES.has(order.status.trim().toLowerCase()),
          ),
        );
        setOrdersReadState("loaded");
      } catch (e) {
        console.error("Fehler beim Laden aus dem Repository", e);
        if (active) {
          setOrders([]);
          setLoadedOrderCount(0);
          setOrdersReadState("unavailable");
        }
      }
    };
    void loadData();
    return () => {
      active = false;
    };
  }, []);

  const getStationName = (station: string) => {
    return getStationConfig(station).fullName || station;
  };

  return (
    <div className="space-y-6 pb-12 font-sans antialiased text-navy-900 max-w-5xl mx-auto">
      <div className="mb-6">
        <AppBackButton fallbackHref="/" label="Zurück zum Dashboard" />
      </div>
      <PageHeader
        title="Kontrolle & Archiv"
        subtitle="Abgeschlossene und versendete Aufträge (Nur-Lese-Ansicht)."
      />

      {ordersReadState === "loading" ? (
        <Card role="status" className="border-dashed border-2 border-neutral-gray-300 bg-bg-app-soft/50 p-12 text-center rounded-2xl space-y-4">
          <ArchiveIcon className="h-8 w-8 mx-auto text-text-muted animate-pulse" />
          <h4 className="font-extrabold text-lg text-navy-900">Archiv wird geladen</h4>
          <p className="text-sm text-text-muted">Die tenantgebundenen Aufträge werden sicher gelesen.</p>
        </Card>
      ) : ordersReadState === "unavailable" ? (
        <Card role="alert" className="border-2 border-neutral-gray-300 bg-bg-app-soft/50 p-12 text-center rounded-2xl space-y-4">
          <ArchiveIcon className="h-8 w-8 mx-auto text-text-muted" />
          <h4 className="font-extrabold text-lg text-navy-900">Archiv derzeit nicht verfügbar</h4>
          <p className="text-sm text-text-muted">Es werden keine veralteten oder unvollständigen Auftragsdaten angezeigt.</p>
        </Card>
      ) : orders.length === 0 ? (
        <Card className="border-dashed border-2 border-neutral-gray-300 bg-bg-app-soft/50 p-12 text-center rounded-2xl space-y-4">
          <div className="h-16 w-16 rounded-full bg-bg-app-soft flex items-center justify-center mx-auto text-text-muted">
            <ArchiveIcon className="h-8 w-8" />
          </div>
          <h4 className="font-extrabold text-lg text-navy-900">
            {loadedOrderCount === 0
              ? "Noch keine Aufträge erfasst"
              : "Noch keine archivierten Aufträge"}
          </h4>
          <p className="text-sm text-text-muted max-w-sm mx-auto leading-relaxed">
            {loadedOrderCount === 0
              ? "Sobald ein Auftrag erfasst wurde, kann er später im Archiv erscheinen."
              : "Die geladenen Aufträge sind noch nicht abgeschlossen oder versendet."}
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <Card key={order.id} className="transition-all duration-300">
              <CardContent className="p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 opacity-75 hover:opacity-100">
                
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-bg-app-soft rounded-xl shrink-0">
                    <ArchiveIcon className="h-5 w-5 text-text-muted" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-black text-navy-900 text-lg tracking-tight">{order.orderNumber}</span>
                      <span className="text-xs text-text-muted font-bold bg-bg-app-soft px-2.5 py-0.5 rounded-full border border-neutral-gray-300">{order.customerName}</span>
                      <Badge className="bg-neutral-gray-100 text-navy-900 font-bold text-[9px] uppercase tracking-wider px-2 py-0.5">
                        Abgeschlossen
                      </Badge>
                    </div>
                    <h4 className="font-black text-slate-850 tracking-tight text-base md:text-lg">
                      {order.task}
                    </h4>
                    
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted pt-1">
                      <span className="font-bold text-navy-900 bg-bg-app-soft border border-neutral-gray-300 px-2 py-0.5 rounded-md">Letzte Station: {getStationName(order.station)}</span>
                      <span>•</span>
                      <span>Teile: {order.parts.length} Werkstücke</span>
                    </div>
                  </div>
                </div>

                <div className="w-full md:w-auto flex flex-row md:flex-col justify-between items-end gap-3 self-stretch md:self-auto border-t md:border-0 pt-3 md:pt-0">
                   <div className="text-left md:text-right text-text-muted">
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
