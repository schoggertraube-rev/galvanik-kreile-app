"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  RefreshCw, 
  Flame, 
  ShieldAlert, 
  Phone, 
  ShieldCheck 
} from "lucide-react";
import { MockOrder } from "@/lib/mockData";
import { getRiskConfig } from "@/constants/status";
import { getStationConfig, getAllStations } from "@/constants/stations";
import { ordersRepository } from "@/lib/repositories/ordersRepository";

const DELAY_METADATA: Record<string, {
  reasonCategory: "Überlastung" | "Material" | "Kundenfreigabe" | "Zusatzarbeit" | "Entlackung";
  reasonDetail: string;
  recommendedAction: string;
}> = {
  "A-2026-0042": {
    reasonCategory: "Zusatzarbeit",
    reasonDetail: "Extrem tiefe Rostnarben erfordern hohen Schleif- & Glättungsaufwand.",
    recommendedAction: "Zusatzstunden buchen / Express-Kupferbad aktivieren",
  },
  "A-2026-0038": {
    reasonCategory: "Überlastung",
    reasonDetail: "Schleiferei & Polierstation aktuell durch Parallelaufträge voll belegt.",
    recommendedAction: "Schichtzuteilung Schleiferei optimieren / Prio erhöhen",
  },
  "A-2026-0035": {
    reasonCategory: "Kundenfreigabe",
    reasonDetail: "Kostenvoranschlag von 420 CHF per E-Mail gesendet. Freigabe steht aus.",
    recommendedAction: "Mitarbeiter anweisen: Telefonische Nachfassung",
  },
  "A-2026-0040": {
    reasonCategory: "Material",
    reasonDetail: "Spezifisches Feinsilber-Badesalz knapp, Lieferung verzögert sich.",
    recommendedAction: "Lieferant anrufen / Express-Expressversand verlangen",
  },
  "A-2026-0027": {
    reasonCategory: "Entlackung",
    reasonDetail: "Hartnäckige, alte Epoxid-Spachtelschicht im chemischen Bad verzögert die Reinigung.",
    recommendedAction: "Einwirkzeit erhöhen / Manuelle Nacharbeit freigeben",
  }
};

export default function StatusDelayPage() {
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [selectedStation, setSelectedStation] = useState<string | null>(null);
  const [orders, setOrders] = useState<MockOrder[]>([]);

  // Load from ordersRepository on mount & sync on storage changes
  useEffect(() => {
    const loadData = async () => {
      const all = await ordersRepository.getAll();
      setOrders(all as unknown as MockOrder[]);
    };
    loadData();
    window.addEventListener("storage", loadData);
    return () => window.removeEventListener("storage", loadData);
  }, []);

  const handleTriggerAction = async (orderNumber: string) => {
    const changes = {
      risk: "green" as const,
      statusText: "Im Plan (Gegenmaßnahme eingeleitet)",
      delayReason: undefined,
      recommendedAction: undefined,
      dueLabel: "Fällig in",
      dueValue: "10 Tagen"
    };

    // Update through unified repository supporting offline queuing
    await ordersRepository.updateOrder(orderNumber, changes);

    // Refresh state
    const all = await ordersRepository.getAll();
    setOrders(all as unknown as MockOrder[]);
  };

  // Compute stats dynamically from the loaded state
  const countRed = orders.filter(o => o.risk === "red").length;
  const countOrange = orders.filter(o => o.risk === "orange" || o.risk === "yellow").length;
  const countBlocked = orders.filter(o => o.risk === "blocked").length;

  // Build the list of active delays/blockers (risk !== "green")
  const delayedOrders = orders.filter(o => o.risk !== "green");

  const delaysList = delayedOrders.map(o => {
    const meta = DELAY_METADATA[o.orderNumber] || {
      reasonCategory: o.risk === "blocked" ? "Kundenfreigabe" : "Überlastung",
      reasonDetail: o.delayReason || "Keine näheren Werkstattdetails hinterlegt.",
      recommendedAction: o.recommendedAction || "Prozessgeschwindigkeit überprüfen",
    };

    let severity: "critical" | "warning" | "minor" = "minor";
    if (o.risk === "red") severity = "critical";
    else if (o.risk === "orange" || o.risk === "yellow" || o.risk === "blocked") severity = "warning";

    return {
      id: o.orderNumber,
      orderId: o.id,
      customerName: o.customerName,
      task: o.task,
      delayText: o.dueValue ? `${o.dueLabel} ${o.dueValue}` : o.statusText,
      reasonCategory: meta.reasonCategory,
      reasonDetail: meta.reasonDetail,
      recommendedAction: meta.recommendedAction,
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
    let colorClass = "bg-emerald-50/50 border-emerald-200 text-emerald-950 shadow-emerald-100";
    
    if (load >= 90) {
      blockerSymbol = "⚠️ Engpass / Überlastet";
      colorClass = "bg-red-50 border-red-200 text-red-950 shadow-red-100 animate-pulse";
    } else if (load >= 75) {
      blockerSymbol = "🔥 Hohe Auslastung";
      colorClass = "bg-orange-50 border-orange-200 text-orange-950 shadow-orange-100";
    } else if (load >= 45) {
      blockerSymbol = "⏱️ Normaler Betrieb";
      colorClass = "bg-yellow-50/50 border-yellow-200 text-yellow-950 shadow-yellow-100";
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
      
      {/* Top Title Area */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3.5xl font-bold font-serif text-slate-900 tracking-tight flex items-center gap-2">
            <ShieldAlert className="h-8 w-8 text-red-600 animate-pulse" /> Werkstatt-Eskalationszentrale
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Operative Steuerung bei Verzug, Materialengpässen und Kundenfreigaben.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            className="gap-2 bg-white h-12" 
            onClick={() => { setFilterCategory("all"); setSelectedStation(null); }}
          >
            <RefreshCw className="h-4 w-4" /> Filter zurücksetzen
          </Button>
        </div>
      </div>

      {/* Summary Info Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-red-200 bg-red-50/10">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-black text-xl shrink-0">
              {countRed}
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block leading-none">Kritischer Verzug</span>
              <span className="font-extrabold text-slate-800 text-sm mt-1 inline-block">Sofortige Klärung nötig</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-orange-200 bg-orange-50/10">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-black text-xl shrink-0">
              {countOrange}
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block leading-none">Gefährdet / Achtung</span>
              <span className="font-extrabold text-slate-800 text-sm mt-1 inline-block">Terminliche Engpässe</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-slate-50/10">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-black text-xl shrink-0">
              {countBlocked}
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block leading-none">Wartet auf Freigabe</span>
              <span className="font-extrabold text-slate-800 text-sm mt-1 inline-block">Kundenentscheidung offen</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Grid: Escalation List (Left) & Station Heatmap (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Left Columns: Blocker Details & Cards */}
        <div className="lg:col-span-2 space-y-4">
          
          {/* Reason Category Pills Filter */}
          <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100 rounded-lg border text-xs">
            {[
              { id: "all", label: "Alle Gründe" },
              { id: "Zusatzarbeit", label: "🛠️ Zusatzaufwand" },
              { id: "Überlastung", label: "⚠️ Überbelegung" },
              { id: "Kundenfreigabe", label: "⏱️ KV-Freigabe" },
              { id: "Material", label: "📦 Materialmangel" },
              { id: "Entlackung", label: "🧪 Badprozess" }
            ].map(cat => (
              <button
                key={cat.id}
                onClick={() => setFilterCategory(cat.id)}
                className={`px-3 py-2 rounded-md font-bold transition-all ${
                  filterCategory === cat.id
                    ? "bg-white text-slate-900 shadow-sm font-extrabold"
                    : "text-slate-505 hover:text-slate-850"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Cards List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-400 font-bold px-1">
              <span>{filteredDelays.length} aktive Eskalationskandidaten</span>
              {selectedStation && (
                <span 
                  className="text-blue-900 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded cursor-pointer flex items-center gap-1 font-bold" 
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
                  ? "border-red-300 bg-red-50/20 shadow-red-50/50 shadow-md"
                  : isWarning 
                    ? "border-orange-200 bg-orange-50/10 shadow-sm"
                    : "border-slate-200 bg-white shadow-sm";

                return (
                  <Card key={item.id} className={`transition-all duration-200 ${cardStyle} border-l-8 ${borderStyle}`}>
                    <CardContent className="p-5 space-y-4">
                      
                      {/* Top Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-extrabold text-slate-900 text-base">{item.id}</span>
                            <span className="text-xs text-slate-500 font-semibold">• {item.customerName}</span>
                          </div>
                          <h4 className="font-bold text-slate-800 text-sm sm:text-base font-serif">{item.task}</h4>
                        </div>

                        <div className="text-left sm:text-right shrink-0">
                          <Badge variant="outline" className={`text-[9px] font-extrabold tracking-wider py-0.5 px-2 ${badgeStyle}`}>
                            {item.reasonCategory.toUpperCase()} • {item.stationName}
                          </Badge>
                          <span className={`block font-black text-sm mt-1 ${
                            isCritical ? "text-red-650" : isWarning ? "text-orange-650" : "text-slate-650"
                          }`}>
                            {item.delayText}
                          </span>
                        </div>
                      </div>

                      {/* Detail Text */}
                      <div className="text-xs text-slate-600 leading-relaxed font-medium bg-slate-50/50 p-3.5 rounded-xl border border-slate-100">
                        <span className="font-extrabold text-[10px] text-slate-400 block uppercase mb-1">Problembeschreibung</span>
                        {item.reasonDetail}
                      </div>

                      {/* Action Bar */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                        <div className="text-[10px] text-slate-450 font-bold uppercase leading-relaxed">
                          Empfehlung: <span className="text-slate-700 font-black">{item.recommendedAction}</span>
                        </div>
                        
                        <div className="flex gap-2 w-full sm:w-auto">
                          {item.reasonCategory === "Kundenfreigabe" ? (
                            <Button 
                              size="sm" 
                              onClick={() => handleTriggerAction(item.id)}
                              className="bg-blue-900 text-white hover:bg-blue-800 h-12 text-xs font-bold w-full sm:w-auto px-4 rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                            >
                              <Phone className="h-4 w-4" /> Kunde anrufen
                            </Button>
                          ) : (
                            <Button 
                              size="sm"
                              onClick={() => handleTriggerAction(item.id)}
                              className={`h-12 text-xs font-bold w-full sm:w-auto px-4 rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-sm ${
                                isCritical 
                                  ? "bg-red-600 text-white hover:bg-red-700" 
                                  : "bg-blue-900 text-white hover:bg-blue-800"
                              }`}
                            >
                              <Flame className="h-4 w-4 text-orange-400 animate-pulse" /> Maßnahme einleiten
                            </Button>
                          )}
                        </div>
                      </div>

                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <Card className="p-12 text-center text-slate-400 bg-white border border-slate-200 border-dashed rounded-xl space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center mx-auto text-emerald-600">
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
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold text-slate-800 font-serif">Stations-Engpass-Heatmap</CardTitle>
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
                        isSelected ? "ring-2 ring-blue-900 border-transparent scale-[0.98]" : "hover:shadow-md"
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex justify-between items-start gap-1">
                          <span className="font-bold text-xs sm:text-sm tracking-tight font-serif leading-none block">{station.name}</span>
                          <span className="text-[10px] font-bold text-slate-400 block shrink-0">{station.load}%</span>
                        </div>
                        <Badge className="text-[8px] bg-slate-900/10 text-slate-850 font-bold border-0 mt-1">
                          {station.blockerSymbol}
                        </Badge>
                      </div>

                      <div className="mt-4 flex items-end justify-between">
                        <div>
                          <span className="text-[9px] text-slate-400 font-bold uppercase block leading-none">Wartende Teile</span>
                          <span className="text-2xl font-black block mt-0.5 leading-none">{station.partsWaiting} Stk.</span>
                        </div>
                        
                        <span className="text-[8px] font-extrabold text-blue-900 bg-blue-50 border border-blue-100 rounded px-1 group-hover:bg-blue-100/50">
                          Slot: {station.nextFreeSlot.split(" ")[0]}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Heatmap Legend */}
              <div className="flex items-center justify-between text-[9px] font-bold text-slate-400 border-t pt-3 px-1 uppercase tracking-wider">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-red-500 rounded-sm"></span> Überlast (&gt;90%)</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-orange-500 rounded-sm"></span> Hoch (70-90%)</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-emerald-500 rounded-sm"></span> Optimal (&lt;70%)</span>
              </div>

            </CardContent>
          </Card>
        </div>

      </div>

    </div>
  );
}
