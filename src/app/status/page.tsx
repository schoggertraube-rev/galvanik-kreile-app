"use client";

import { usePageView } from "@/hooks/usePageView";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  RefreshCw, 
  ShieldCheck 
} from "lucide-react";
import { MockOrder } from "@/lib/mockData";
import { getRiskConfig } from "@/constants/status";
import { getStationConfig, getAllStations } from "@/constants/stations";
import { ordersRepository } from "@/lib/repositories/ordersRepository";
import { PageHeader } from "@/components/ui/PageHeader";

export default function StatusDelayPage() {
  usePageView();
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [selectedStation, setSelectedStation] = useState<string | null>(null);
  const [orders, setOrders] = useState<MockOrder[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Load from ordersRepository on mount & sync on storage changes
  useEffect(() => {
    const loadData = async () => {
      try {
        const all = await ordersRepository.getAll();
        setOrders(all as unknown as MockOrder[]);
        setLoadError(null);
      } catch (error) {
        console.error("Statusaufträge konnten nicht geladen werden", error);
        setLoadError("Risikodaten konnten nicht geladen werden.");
      }
    };
    loadData();
    window.addEventListener("storage", loadData);
    return () => window.removeEventListener("storage", loadData);
  }, []);

  // Compute stats dynamically from the loaded state
  const countRed = orders.filter(o => o.risk === "red").length;
  const countOrange = orders.filter(o => o.risk === "orange" || o.risk === "yellow").length;
  const countBlocked = orders.filter(o => o.risk === "blocked").length;

  // Build the list of active delays/blockers (risk !== "green")
  const delayedOrders = orders.filter(o => o.risk !== "green");

  const delaysList = delayedOrders.map(o => {
    let severity: "critical" | "warning" | "minor" = "minor";
    if (o.risk === "red") severity = "critical";
    else if (o.risk === "orange" || o.risk === "yellow" || o.risk === "blocked") severity = "warning";

    return {
      id: o.orderNumber,
      orderId: o.id,
      customerName: o.customerName,
      task: o.task,
      delayText: o.dueValue ? `${o.dueLabel} ${o.dueValue}` : (o.statusText || "Kein Terminstatus dokumentiert"),
      reasonCategory: "Nicht dokumentiert",
      reasonDetail: o.delayReason || "Kein Verzögerungsgrund dokumentiert.",
      recommendedAction: o.recommendedAction || null,
      severity,
      stationName: getStationConfig(o.station).name,
      stationKey: o.station,
      risk: o.risk
    };
  });

  const filteredDelays = delaysList.filter(d => {
    const matchesCategory = filterCategory === "all" || d.reasonCategory === filterCategory;
    const matchesStation = !selectedStation || d.stationName === selectedStation;
    return matchesCategory && matchesStation;
  });

  // Dynamic station parts calculation for actual workshop workload
  const getPartsCountForStation = (stationKey: string) => {
    return orders
      .filter(o => o.station === stationKey)
      .reduce((sum, o) => sum + o.parts.length, 0);
  };

  const dynamicStations = getAllStations().map(station => {
    const partsWaiting = getPartsCountForStation(station.key);
    
    // Determine workload percentage dynamically based on parts count
    let load = station.standardLoad;
    if (partsWaiting === 0) {
      load = 15;
    } else {
      load = Math.min(95, Math.max(30, partsWaiting * 15));
    }

    // Determine color scheme & status label dynamically
    let blockerSymbol = "✅ Optimal";
    let colorClass = "bg-success-green-soft/50 border-success-green text-success-green shadow-emerald-100";
    
    if (load >= 90) {
      blockerSymbol = "⚠️ Engpass / Überlastet";
      colorClass = "bg-accent-orange-soft border-danger-red text-danger-red shadow-red-100 animate-pulse";
    } else if (load >= 75) {
      blockerSymbol = "🔥 Hohe Auslastung";
      colorClass = "bg-gold-100 border-accent-orange text-accent-orange shadow-orange-100";
    } else if (load >= 45) {
      blockerSymbol = "⏱️ Normaler Betrieb";
      colorClass = "bg-gold-100 border-yellow-200 text-yellow-950 shadow-yellow-100";
    }

    return {
      id: station.key,
      name: station.name,
      load,
      partsWaiting,
      nextFreeSlot: partsWaiting > 5 ? "Morgen 11:00" : partsWaiting > 2 ? "Heute Nachmittag" : "Sofort frei",
      blockerSymbol,
      sizeClass: station.sizeClass,
      colorClass,
      action: station.action
    };
  });

  return (
    <div className="space-y-6 pb-12 font-sans max-w-6xl">
      
      <PageHeader
        title="Werkstatt-Eskalationszentrale"
        subtitle="Kritische und gefährdete Aufträge nach gespeichertem Risikostatus."
        action={{
          label: "Filter zurücksetzen",
          onClick: () => { setFilterCategory("all"); setSelectedStation(null); },
          icon: RefreshCw,
          variant: "outline"
        }}
      />
      {loadError && (
        <div role="alert" className="p-3 rounded-xl border border-red-200 bg-red-50 text-red-800 text-sm font-semibold">
          {loadError}
        </div>
      )}

      {/* Summary Info Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-danger-red bg-accent-orange-soft/50">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-danger-red flex items-center justify-center text-danger-red font-black text-xl shrink-0">
              {countRed}
            </div>
            <div>
              <span className="text-[10px] text-text-muted font-bold uppercase block leading-none">Kritischer Verzug</span>
              <span className="font-extrabold text-navy-900 text-sm mt-1 inline-block">Sofortige Klärung nötig</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-accent-orange bg-gold-100/10">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center text-accent-orange font-black text-xl shrink-0">
              {countOrange}
            </div>
            <div>
              <span className="text-[10px] text-text-muted font-bold uppercase block leading-none">Gefährdet / Achtung</span>
              <span className="font-extrabold text-navy-900 text-sm mt-1 inline-block">Terminliche Engpässe</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-neutral-gray-300 bg-bg-app-soft/10">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-bg-app-soft flex items-center justify-center text-text-muted font-black text-xl shrink-0">
              {countBlocked}
            </div>
            <div>
              <span className="text-[10px] text-text-muted font-bold uppercase block leading-none">Wartet auf Freigabe</span>
              <span className="font-extrabold text-navy-900 text-sm mt-1 inline-block">Kundenentscheidung offen</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Grid: Escalation List (Left) & Station Heatmap (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Left Columns: Blocker Details & Cards */}
        <div className="lg:col-span-2 space-y-4">
          
          {/* Reason Category Pills Filter */}
          <div className="flex flex-wrap gap-1.5 p-1 bg-bg-app-soft rounded-lg border text-xs">
            {[
              { id: "all", label: "Alle Gründe" },
              { id: "Nicht dokumentiert", label: "Grund nicht dokumentiert" },
            ].map(cat => (
              <button
                key={cat.id}
                onClick={() => setFilterCategory(cat.id)}
                className={`px-3 py-2 rounded-md font-bold transition-all ${
                  filterCategory === cat.id
                    ? "bg-white text-navy-900 shadow-sm font-extrabold"
                    : "text-bg-app-soft5 hover:text-slate-850"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Cards List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-text-muted font-bold px-1">
              <span>{filteredDelays.length} aktive Eskalationskandidaten</span>
              {selectedStation && (
                <span 
                  className="text-navy-900 bg-bg-app-soft border border-neutral-gray-300 px-2.5 py-1 rounded cursor-pointer flex items-center gap-1 font-bold" 
                  onClick={() => setSelectedStation(null)}
                >
                  Station: {selectedStation} ✕
                </span>
              )}
            </div>

            {filteredDelays.length > 0 ? (
              filteredDelays.map(item => {

                const isCritical = item.severity === "critical";
                const isWarning = item.severity === "warning";

                const config = getRiskConfig(item.risk);
                const borderStyle = config.leftBorderClass;
                const badgeStyle = config.badgeClass;
                const cardStyle = isCritical 
                  ? "border-danger-red bg-accent-orange-soft/50 shadow-red-50/50 shadow-md"
                  : isWarning 
                    ? "border-accent-orange bg-gold-100/10 shadow-sm"
                    : "border-neutral-gray-300 bg-white shadow-sm";

                return (
                  <Card key={item.orderId} className={`transition-all duration-200 ${cardStyle} border-l-8 ${borderStyle}`}>
                    <CardContent className="p-5 space-y-4">
                      
                      {/* Top Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-extrabold text-navy-900 text-base">{item.id}</span>
                            <span className="text-xs text-text-muted font-semibold">• {item.customerName}</span>
                          </div>
                          <h4 className="font-bold text-navy-900 text-sm sm:text-base font-serif">{item.task}</h4>
                        </div>

                        <div className="text-left sm:text-right shrink-0">
                          <Badge variant="outline" className={`text-[9px] font-extrabold tracking-wider py-0.5 px-2 ${badgeStyle}`}>
                            {item.reasonCategory.toUpperCase()} • {item.stationName}
                          </Badge>
                          <span className={`block font-black text-sm mt-1 ${
                            isCritical ? "text-danger-red" : isWarning ? "text-accent-orange" : "text-slate-650"
                          }`}>
                            {item.delayText}
                          </span>
                        </div>
                      </div>

                      {/* Detail Text */}
                      <div className="text-xs text-text-muted leading-relaxed font-medium bg-bg-app-soft/50 p-3.5 rounded-xl border border-neutral-gray-100">
                        <span className="font-extrabold text-[10px] text-text-muted block uppercase mb-1">Problembeschreibung</span>
                        {item.reasonDetail}
                      </div>

                      {/* Action Bar */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                        <div className="text-[10px] text-slate-450 font-bold uppercase leading-relaxed">
                          Empfehlung: <span className="text-navy-900 font-black">{item.recommendedAction}</span>
                        </div>
                        
                        <div className="flex gap-2 w-full sm:w-auto">
                          <Button
                            size="sm"
                            disabled
                            title="Ein auditierter Maßnahmen-Workflow ist noch nicht angebunden."
                            className="h-12 text-xs font-bold w-full sm:w-auto px-4 rounded-xl"
                          >
                            Maßnahme nicht angebunden
                          </Button>
                        </div>
                      </div>

                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <Card className="p-12 text-center text-text-muted bg-white border border-neutral-gray-300 border-dashed rounded-xl space-y-3">
                <div className="w-12 h-12 rounded-full bg-success-green-soft border border-success-green flex items-center justify-center mx-auto text-success-green">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-bold text-slate-705">Keine blockierten Aufträge gefunden</p>
                  <p className="text-xs max-w-sm mx-auto mt-1">In dieser Kombination existieren keine aktiven Lieferrisiken. Alles läuft nach Plan!</p>
                </div>
              </Card>
            )}
          </div>
        </div>

        {/* Right Column: Station Heatmap */}
        <div className="space-y-4">
          <Card className="shadow-sm border-neutral-gray-300">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold text-navy-900 font-serif">Stations-Engpass-Heatmap</CardTitle>
              <CardDescription className="text-xs">Größe spiegelt wartende Teile wider, Farbe die Auslastung.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              
              {/* Responsive Grid-based Heatmap */}
              <div className="grid grid-cols-2 gap-3 min-h-[350px]">
                {dynamicStations.map(station => {
                  const isSelected = selectedStation === station.name;
                  return (
                    <div
                      key={station.id}
                      onClick={() => setSelectedStation(selectedStation === station.name ? null : station.name)}
                      className={`rounded-xl border p-3 flex flex-col justify-between transition-all duration-200 cursor-pointer shadow-sm relative overflow-hidden group ${
                        station.sizeClass
                      } ${station.colorClass} ${
                        isSelected ? "ring-2 ring-navy-900 border-transparent scale-[0.98]" : "hover:shadow-md"
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex justify-between items-start gap-1">
                          <span className="font-bold text-xs sm:text-sm tracking-tight font-serif leading-none block">{station.name}</span>
                          <span className="text-[10px] font-bold text-text-muted block shrink-0">{station.load}%</span>
                        </div>
                        <Badge className="text-[8px] bg-navy-900/10 text-slate-850 font-bold border-0 mt-1">
                          {station.blockerSymbol}
                        </Badge>
                      </div>

                      <div className="mt-4 flex items-end justify-between">
                        <div>
                          <span className="text-[9px] text-text-muted font-bold uppercase block leading-none">Wartende Teile</span>
                          <span className="text-2xl font-black block mt-0.5 leading-none">{station.partsWaiting} Stk.</span>
                        </div>
                        
                         <span className="text-[8px] font-extrabold text-navy-900 bg-bg-app-soft border border-neutral-gray-300 rounded px-1 group-hover:bg-white/40">
                           Slot: {station.nextFreeSlot.split(" ")[0]}
                         </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Heatmap Legend */}
              <div className="flex items-center justify-between text-[9px] font-bold text-text-muted border-t pt-3 px-1 uppercase tracking-wider">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-accent-orange-soft0 rounded-sm"></span> Überlast (&gt;90%)</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-gold-1000 rounded-sm"></span> Hoch (70-90%)</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-success-green-soft0 rounded-sm"></span> Optimal (&lt;70%)</span>
              </div>

            </CardContent>
          </Card>
        </div>

      </div>

    </div>
  );
}
