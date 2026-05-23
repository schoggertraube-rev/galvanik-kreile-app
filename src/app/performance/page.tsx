"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  CheckCircle2, 
  Clock, 
  MessageSquareWarning, 
  Camera, 
  AlertCircle, 
  TrendingUp, 
  TrendingDown,
  Flame, 
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Box,
  Layers,
  Disc,
  Droplets,
  Truck,
  Activity,
  Info
} from "lucide-react";
import { INITIAL_ORDERS, MockOrder } from "@/lib/mockData";
import { getAllStations } from "@/constants/stations";
import { bathsRepository, Bath } from "@/lib/repositories/bathsRepository";
import { calculateWorkshopHealthScore } from "@/lib/performance/score";

// Mapping string names to Lucide icons
const ICON_MAP: Record<string, React.ElementType> = {
  Camera: Camera,
  Box: Box,
  Layers: Layers,
  Disc: Disc,
  Droplets: Droplets,
  Truck: Truck
};

export default function PerformancePage() {
  const [orders, setOrders] = useState<MockOrder[]>([]);
  const [baths, setBaths] = useState<Bath[]>([]);
  const [healthData, setHealthData] = useState<{score: number; details: Record<string, number>} | null>(null);
  const [showFormulaDetails, setShowFormulaDetails] = useState(false);
  const [hourlyRate, setHourlyRate] = useState(95);
  const [fixedCosts, setFixedCosts] = useState(2500);

  const exportCSV = () => {
    const headers = ["Monat", "Auftragsnummer", "Kundennummer", "Kundenname", "Leistung", "Netto-Umsatz (EUR)", "Lohnkosten (EUR)", "Materialkosten (EUR)", "Deckungsbeitrag (EUR)", "Status"];
    const dataRows = orders.map(o => {
      const isDone = o.status === "completed" || o.status === "shipped";
      const rev = isDone ? 450 : 0;
      const mat = isDone ? 65 : 12;
      const labor = isDone ? 2.5 * hourlyRate : 0;
      const db = rev - (mat + labor);
      return [
        "2026-05",
        o.orderNumber,
        o.customerId || "K-000100",
        o.customerName || "Unbekannt",
        o.task,
        rev.toFixed(2),
        labor.toFixed(2),
        mat.toFixed(2),
        db.toFixed(2),
        o.status
      ];
    });
    
    const csvContent = [
      headers.join(";"),
      ...dataRows.map(row => row.map(val => `"${(val ?? "").toString().replace(/"/g, '""')}"`).join(";"))
    ].join("\n");
    
    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `kreile_buchhaltungsexport_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    const loadData = async () => {
      if (typeof window !== "undefined") {
        const savedOrders = localStorage.getItem("kreile_orders");
        if (savedOrders) {
          try {
            setOrders(JSON.parse(savedOrders));
          } catch (e) {
            console.error("Fehler beim Laden von kreile_orders aus localStorage", e);
          }
        } else {
          setOrders(INITIAL_ORDERS);
        }

        try {
          const loadedBaths = await bathsRepository.getAllBaths();
          setBaths(loadedBaths);
          
          const health = await calculateWorkshopHealthScore();
          setHealthData(health);
        } catch (e) {
          console.error("Fehler beim Laden der Performance-Daten", e);
        }
      }
    };

    loadData();

    const handleStorageChange = () => {
      loadData();
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  // Helper to count parts at a given station
  const getPartsCountForStation = (stationKey: string) => {
    return orders
      .filter(o => o.station === stationKey)
      .reduce((sum, o) => sum + o.parts.length, 0);
  };

  // Helper mathematical clamp
  const clamp = (val: number, min: number, max: number) => Math.min(max, Math.max(min, val));

  // 1. Dynamic Key Performance Indicators
  const greenCount = orders.filter(o => o.risk === "green").length;
  const totalCount = orders.length || 1;
  const rawOnTimeRate = greenCount / totalCount;
  
  // Normalized on-time delivery score (0-100)
  const onTimeScore = clamp(rawOnTimeRate * 100, 0, 100);

  // Average throughput calculation based on current bottlenecks
  const totalDelayParts = orders
    .filter(o => o.risk !== "green")
    .reduce((sum, o) => sum + o.parts.length, 0);
  
  const baseDurchlaufzeit = 3.2; // base days
  const dynamicDurchlaufzeit = parseFloat((baseDurchlaufzeit + (totalDelayParts * 0.15)).toFixed(1));
  
  // Cycle Index target is 4.0 days
  const avgCycleTimeIndex = dynamicDurchlaufzeit / 4.0;
  const cycleScore = clamp(100 - (avgCycleTimeIndex - 1) * 50, 0, 100);

  // Blocker / Escalation candidates count
  const criticalOrders = orders.filter(o => o.risk === "red" || o.risk === "orange").length;
  const criticalScore = clamp(100 - criticalOrders * 15, 0, 100);

  // Complaint rate (Fehlerquote)
  const dynamicReklaQuote = parseFloat((1.2 + (criticalOrders * 0.1)).toFixed(1));
  const complaintsScore = clamp(100 - (dynamicReklaQuote / 100) * 100, 0, 100);

  // Scan & Documentation Rates (mocked but slightly adjusted based on backlog)
  const scanRate = clamp(0.88 + (greenCount * 0.005) - (criticalOrders * 0.01), 0.5, 0.99);
  const documentationRate = clamp(0.92 + (greenCount * 0.003) - (criticalOrders * 0.005), 0.5, 0.99);
  const docsScore = clamp(((scanRate + documentationRate) / 2) * 100, 0, 100);

  // 2. Calculations for the 5 shopfloor steps
  const heatmapStations = getAllStations().map(station => {
    const partsWaiting = getPartsCountForStation(station.key);
    
    // Determine dynamic workload percentage
    let load = station.standardLoad;
    if (partsWaiting === 0) {
      load = 15;
    } else {
      load = Math.min(95, Math.max(30, partsWaiting * 15));
    }

    // Dynamic processing time based on load
    let baseTime = 0.5;
    if (station.key === "wareneingang") baseTime = 0.4;
    else if (station.key === "entmetallisierung") baseTime = 1.1;
    else if (station.key === "schleiferei") baseTime = 1.8;
    else if (station.key === "beschichtung") baseTime = 2.3;
    else if (station.key === "warenausgang") baseTime = 0.4;

    const dynamicTime = (baseTime + (partsWaiting * 0.15)).toFixed(1);

    // Blocker status and visual styling
    let colorClass = "border-emerald-250 bg-emerald-50/10 text-emerald-950 hover:bg-emerald-50/20";
    let badgeColor = "bg-emerald-100 text-emerald-800";
    let trendIcon = <TrendingDown className="h-3.5 w-3.5 text-emerald-600 shrink-0" />;
    let trendLabel = "Stabil / Optimal";

    if (load >= 90) {
      colorClass = "border-red-300 bg-red-50/20 text-red-950 hover:bg-red-50/30 animate-pulse";
      badgeColor = "bg-red-100 text-red-800 border-red-200";
      trendIcon = <TrendingUp className="h-3.5 w-3.5 text-red-600 shrink-0" />;
      trendLabel = "Kritischer Stau";
    } else if (load >= 75) {
      colorClass = "border-orange-250 bg-orange-50/10 text-orange-950 hover:bg-orange-50/20";
      badgeColor = "bg-orange-100 text-orange-800 border-orange-200";
      trendIcon = <TrendingUp className="h-3.5 w-3.5 text-orange-600 shrink-0" />;
      trendLabel = "ErhÃ¶htes Volumen";
    } else if (load >= 45) {
      colorClass = "border-yellow-250 bg-yellow-50/10 text-yellow-950 hover:bg-yellow-50/20";
      badgeColor = "bg-yellow-100 text-yellow-800 border-yellow-200";
      trendIcon = <Activity className="h-3.5 w-3.5 text-yellow-600 shrink-0" />;
      trendLabel = "RegulÃ¤r";
    }

    const IconComponent = ICON_MAP[station.iconName] || Activity;

    return {
      key: station.key,
      name: station.name,
      fullName: station.fullName,
      stepNumber: station.stepNumber,
      load,
      partsWaiting,
      throughputTime: dynamicTime,
      colorClass,
      badgeColor,
      trendIcon,
      trendLabel,
      action: station.action,
      IconComponent
    };
  });

  // Calculate Station Health Index dynamically
  const hasCriticalBath = baths.some(b => b.status === "critical");
  
  const stationHealthIndex = heatmapStations.reduce((acc, station) => {
    let stationHealth = 1.0;
    if (station.load >= 90) stationHealth = 0.2;
    else if (station.load >= 75) stationHealth = 0.6;
    else if (station.load >= 45) stationHealth = 0.9;
    
    // Penalize beschichtung if a bath is critical
    if (station.key === "beschichtung" && hasCriticalBath) {
      stationHealth = Math.max(0.1, stationHealth - 0.3);
    }
    
    return acc + stationHealth;
  }, 0) / heatmapStations.length;

  const stationsScore = clamp(stationHealthIndex * 100, 0, 100);

  // 3. Overall Master Performance Score (§12)
  const masterScore = healthData?.score || 0;

  // Qualifying the calculated score
  let scoreQualityLabel = "Gute Performance";
  let scoreQualityColor = "text-amber-400";
  let scoreQualityBg = "border-amber-500/30 bg-amber-500/10";
  
  if (masterScore >= 85) {
    scoreQualityLabel = "Exzellente Werkstattleistung";
    scoreQualityColor = "text-emerald-400";
    scoreQualityBg = "border-emerald-500/30 bg-emerald-500/10";
  } else if (masterScore < 70) {
    scoreQualityLabel = "Kritischer Handlungsbedarf";
    scoreQualityColor = "text-red-400";
    scoreQualityBg = "border-red-500/30 bg-red-500/10";
  }

  // Circular gauge setup
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (masterScore / 100) * circumference;

  // Active dynamic bottleneck alert lists
  const bottleneckWarnings = heatmapStations
    .filter(s => s.load >= 75)
    .map(s => {
      let recommendation = "";
      let link = `/orders?station=${s.key}`;
      let cta = "Auftragsliste filtern";
      
      if (s.key === "schleiferei") {
        recommendation = "Schleiferei Ã¼berlastet. Zusatzschicht koordinieren oder SchleifvorgÃ¤nge aufteilen, um RÃ¼ckstau zu verringern.";
      } else if (s.key === "beschichtung") {
        recommendation = "Kritische GalvanikkapazitÃ¤t. Badzusatz-Buchungen oder Sperren/Freigaben auf der Leitkarte prÃ¼fen.";
        link = "/items";
        cta = "Badregelkarte Ã¶ffnen";
      } else if (s.key === "entmetallisierung") {
        recommendation = "Entmetallisierung unter Hochdruck. Chemiewerte und Badregelkarte kontrollieren.";
        link = "/items";
        cta = "Chemiebestand prÃ¼fen";
      } else {
        recommendation = `ErhÃ¶hte Auslastung in Station ${s.name}. ÃœberprÃ¼fe die anstehenden Teile.`;
      }
      
      return {
        key: s.key,
        name: s.name,
        load: s.load,
        partsWaiting: s.partsWaiting,
        recommendation,
        link,
        cta
      };
    });

  // Inject critical baths to recommendations if any
  const criticalBathAlerts = baths.filter(b => b.status === "critical");

  // â”€â”€ Finance Controlling â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const finCompletedCount = orders.filter(o => o.status === "completed" || o.status === "shipped").length;
  const finActiveCount    = orders.filter(o => o.status !== "completed" && o.status !== "shipped" && o.status !== "cancelled").length;
  const finRevenue  = finCompletedCount * 450;
  const finMat      = finCompletedCount * 65 + finActiveCount * 12;
  const finLabor    = finCompletedCount * 2.5 * hourlyRate;
  const finDB       = finRevenue - (finMat + finLabor);
  const finProfit   = finDB - fixedCosts;
  const finForecast = finRevenue + finActiveCount * 420 * 0.7;
  const finKpis = [
    { label: "Umsatz",           value: finRevenue,   color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", sign: "+" },
    { label: "Materialkosten",   value: finMat,       color: "text-orange-700",  bg: "bg-orange-50",  border: "border-orange-200",  sign: "-" },
    { label: "Lohnkosten",       value: finLabor,     color: "text-blue-700",    bg: "bg-blue-50",    border: "border-blue-200",    sign: "-" },
    { label: "Deckungsbeitrag",  value: finDB,        color: finDB >= 0 ? "text-slate-800" : "text-red-700",      bg: "bg-slate-50",   border: "border-slate-200",   sign: finDB >= 0 ? "+" : "" },
    { label: "Fixkosten / Monat",value: fixedCosts,   color: "text-purple-700",  bg: "bg-purple-50",  border: "border-purple-200",  sign: "-" },
    { label: "Gewinn / Verlust", value: finProfit,    color: finProfit >= 0 ? "text-emerald-700" : "text-red-700", bg: finProfit >= 0 ? "bg-emerald-50" : "bg-red-50", border: finProfit >= 0 ? "border-emerald-200" : "border-red-200", sign: finProfit >= 0 ? "+" : "" },
  ];

  return (
    <div className="space-y-6 pb-12 font-sans max-w-6xl text-slate-900">
      
      {/* Top Banner indicating Cockpit Active State */}
      <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex items-start gap-3 shadow-xs">
        <AlertCircle className="h-5.5 w-5.5 text-blue-650 shrink-0 mt-0.5" />
        <div>
          <h5 className="font-extrabold text-sm text-blue-950 flex items-center gap-2">
            Performance Monitor Cockpit <Badge className="bg-blue-900 text-white font-bold text-[9px] py-0 px-1.5 uppercase border-none">Aktiviert</Badge>
          </h5>
          <p className="text-xs text-blue-800 mt-1 leading-relaxed">
            Dieses Cockpit berechnet die Werkstatteffizienz in Echtzeit basierend auf den AuftrÃ¤gen im LocalStorage und dem Status der BÃ¤der. Klicke auf die Heatmap-Kacheln, um betroffene Stationen direkt zu filtern.
          </p>
        </div>
      </div>

      {/* Header Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight font-serif">Werkstatt-Performance & Analyse</h1>
          <p className="text-slate-500 text-sm mt-1">Echtzeitauswertungen von Durchlaufzeiten, KapazitÃ¤ten und QualitÃ¤tskennzahlen.</p>
        </div>
        <select className="bg-white border-slate-200 border text-slate-700 text-sm rounded-md px-3 py-2 shadow-sm font-semibold h-11">
          <option>Diese Woche (KW 21)</option>
          <option>Letzte Woche (KW 20)</option>
          <option>Diesen Monat (Mai 2026)</option>
        </select>
      </div>

      {/* Asymmetrical Layout Grid: Overall Master Score + KPIs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Stunning Master Performance Score Circular Gauge */}
        <Card className="bg-gradient-to-br from-slate-900 via-slate-950 to-blue-950 border-slate-800 shadow-xl text-white overflow-hidden relative flex flex-col justify-between p-5 min-h-[300px]">
          <div className="absolute right-0 top-0 -mt-12 -mr-12 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
          
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[9px] uppercase font-black text-slate-400 tracking-widest block font-mono">Gesamtbewertung</span>
                <h3 className="font-extrabold text-lg mt-0.5 tracking-tight font-serif">Master Performance Score</h3>
              </div>
              <Info className="h-4.5 w-4.5 text-slate-400 hover:text-slate-200 cursor-pointer" onClick={() => setShowFormulaDetails(!showFormulaDetails)} />
            </div>

            <div className="flex items-center justify-center gap-6 py-6">
              {/* SVG circular gauge */}
              <div className="relative">
                <svg className="w-32 h-32 transform -rotate-90">
                  <circle
                    cx="64"
                    cy="64"
                    r="50"
                    className="stroke-slate-800 fill-transparent"
                    strokeWidth="8.5"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r="50"
                    className="stroke-blue-500 fill-transparent transition-all duration-1000 ease-out"
                    strokeWidth="8.5"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    style={{ stroke: "url(#scoreGrad)" }}
                  />
                  <defs>
                    <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#3b82f6" />
                      <stop offset="50%" stopColor="#8b5cf6" />
                      <stop offset="100%" stopColor="#10b981" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-black text-white tracking-tight">{masterScore}%</span>
                  <span className="text-[9px] font-bold text-blue-200 uppercase tracking-widest">Score</span>
                </div>
              </div>

              {/* Status details */}
              <div className="space-y-1">
                <Badge variant="outline" className={`font-extrabold text-[10px] uppercase tracking-wider px-2 py-0.5 ${scoreQualityBg} ${scoreQualityColor} border`}>
                  {scoreQualityLabel}
                </Badge>
                <p className="text-xs text-slate-400 leading-relaxed max-w-[140px] mt-1 font-medium">
                  Gewichteter Leistungsindex aus Termintreue, BÃ¤dern, Durchlaufzeit & QS.
                </p>
              </div>
            </div>
          </div>

          {/* Interactive expandable formula breakdown panel */}
          <div className="border-t border-slate-800 pt-3">
            <button 
              onClick={() => setShowFormulaDetails(!showFormulaDetails)}
              className="w-full flex items-center justify-between text-xs text-slate-400 font-bold hover:text-slate-200 transition-colors"
            >
              <span>Detaillierte Zusammensetzung</span>
              {showFormulaDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>

            {showFormulaDetails && (
              <div className="mt-3 space-y-2 bg-slate-950/60 p-3 rounded-lg border border-slate-800 text-[11px] font-medium text-slate-300 divide-y divide-slate-900/50">
                <div className="flex justify-between pb-1.5">
                  <span>Termintreue (25% Gewicht)</span>
                  <span className="font-bold text-white">{Math.round(onTimeScore)}% (+{Math.round(onTimeScore * 0.25)} Pkt)</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span>Durchlaufzeit-Index (20% Gewicht)</span>
                  <span className="font-bold text-white">{Math.round(cycleScore)}% (+{Math.round(cycleScore * 0.20)} Pkt)</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span>Kritische AuftrÃ¤ge (20% Gewicht)</span>
                  <span className="font-bold text-white">{Math.round(criticalScore)}% (+{Math.round(criticalScore * 0.20)} Pkt)</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span>Fehlerquote QS (15% Gewicht)</span>
                  <span className="font-bold text-white">{Math.round(complaintsScore)}% (+{Math.round(complaintsScore * 0.15)} Pkt)</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span>OCR- & Scan-Dokumentation (10%)</span>
                  <span className="font-bold text-white">{Math.round(docsScore)}% (+{Math.round(docsScore * 0.10)} Pkt)</span>
                </div>
                <div className="flex justify-between pt-1.5">
                  <span>Werkstatt-Stationen Health (10%)</span>
                  <span className="font-bold text-white">{Math.round(stationsScore)}% (+{Math.round(stationsScore * 0.10)} Pkt)</span>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Right Side: The 4 Key metrics Cards */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          
          <Link href="/orders?filter=active" className="transition-all hover:scale-[1.01] block group">
            <Card className="border-l-4 border-l-emerald-500 shadow-sm relative h-[140px] flex flex-col justify-between group-hover:border-slate-350">
              <CardContent className="p-5 flex flex-col justify-between h-full">
                <div>
                  <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider group-hover:text-blue-900">
                    <span>Termintreue</span>
                    <CheckCircle2 className="h-4.5 w-4.5 text-emerald-500" />
                  </div>
                  <div className="text-4xl font-black text-slate-900 leading-none mt-2">{Math.round(onTimeScore)} %</div>
                </div>
                <p className="text-[10px] text-slate-400 font-semibold flex items-center justify-between">
                  <span>Zielwert: &ge; 95% â€¢ PÃ¼nktlich freigegebene Teile</span>
                  <span className="text-[9px] text-blue-900 font-extrabold uppercase opacity-0 group-hover:opacity-100 transition-opacity">Filtern &rarr;</span>
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/orders" className="transition-all hover:scale-[1.01] block group">
            <Card className="border-l-4 border-l-emerald-500 shadow-sm h-[140px] flex flex-col justify-between group-hover:border-slate-350">
              <CardContent className="p-5 flex flex-col justify-between h-full">
                <div>
                  <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider group-hover:text-blue-900">
                    <span>Ã˜ Durchlaufzeit</span>
                    <Clock className="h-4.5 w-4.5 text-emerald-500" />
                  </div>
                  <div className="text-4xl font-black text-slate-900 leading-none mt-2">{dynamicDurchlaufzeit} Tage</div>
                </div>
                <p className="text-[10px] text-slate-400 font-semibold flex items-center justify-between">
                  <span>Basis: {baseDurchlaufzeit} Tage â€¢ Ziel: &le; 4.0 Tage</span>
                  <span className="text-[9px] text-blue-900 font-extrabold uppercase opacity-0 group-hover:opacity-100 transition-opacity">Alle Anzeigen &rarr;</span>
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/orders?filter=critical" className="transition-all hover:scale-[1.01] block group">
            <Card className="border-l-4 border-l-orange-500 shadow-sm h-[140px] flex flex-col justify-between group-hover:border-slate-350">
              <CardContent className="p-5 flex flex-col justify-between h-full">
                <div>
                  <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider group-hover:text-blue-900">
                    <span>Fehlerquote (QS)</span>
                    <MessageSquareWarning className="h-4.5 w-4.5 text-orange-500" />
                  </div>
                  <div className="text-4xl font-black text-orange-600 leading-none mt-2">{dynamicReklaQuote} %</div>
                </div>
                <p className="text-[10px] text-slate-400 font-semibold flex items-center justify-between">
                  <span>Zielwert: &le; 2.0% â€¢ Kritische VerzÃ¶gerungen</span>
                  <span className="text-[9px] text-blue-900 font-extrabold uppercase opacity-0 group-hover:opacity-100 transition-opacity">Kritische Filtern &rarr;</span>
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/orders?filter=waiting" className="transition-all hover:scale-[1.01] block group">
            <Card className="border-l-4 border-l-blue-900 shadow-sm h-[140px] flex flex-col justify-between group-hover:border-slate-350">
              <CardContent className="p-5 flex flex-col justify-between h-full">
                <div>
                  <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider group-hover:text-blue-900">
                    <span>OCR & Dokumentenquote</span>
                    <Camera className="h-4.5 w-4.5 text-blue-900" />
                  </div>
                  <div className="text-4xl font-black text-blue-900 leading-none mt-2">{Math.round(docsScore)} %</div>
                </div>
                <p className="text-[10px] text-slate-400 font-semibold flex items-center justify-between">
                  <span>Erfassungskonfidenz: {Math.round(scanRate * 100)}%</span>
                  <span className="text-[9px] text-blue-900 font-extrabold uppercase opacity-0 group-hover:opacity-100 transition-opacity">Wartende Filtern &rarr;</span>
                </p>
              </CardContent>
            </Card>
          </Link>

        </div>

      </div>

      {/* Finanzcontrolling & Wirtschaftlichkeit */}
      <Card className="shadow-md border-slate-200 bg-white">
        <CardHeader className="pb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <CardTitle className="text-xl font-black text-slate-800 font-serif flex items-center gap-2">
              <span>ðŸ“Š Finanzcontrolling & RentabilitÃ¤t</span>
              <Badge className="bg-emerald-600 text-white font-bold text-[9px] py-0.5 px-2 uppercase border-none">Live</Badge>
            </CardTitle>
            <CardDescription className="text-xs">
              Echtzeit-Mittelwertkalkulation basierend auf abgeschlossenen AuftrÃ¤gen. Verschiebe die Regler, um Auswirkungen sofort zu simulieren.
            </CardDescription>
          </div>
          <button 
            onClick={exportCSV}
            className="bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-2 cursor-pointer border-none"
          >
            ðŸ“¥ Buchhaltungsexport (DATEV/Lexware CSV)
          </button>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Sliders Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-5 rounded-2xl border border-slate-200">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-black text-slate-700 uppercase tracking-wider">Verrechnungssatz (Stundenlohn Netto)</label>
                <span className="font-extrabold text-blue-750 text-sm">{hourlyRate} â‚¬ / Std</span>
              </div>
              <input 
                type="range" 
                min="50" 
                max="200" 
                value={hourlyRate} 
                onChange={(e) => setHourlyRate(parseInt(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-900"
              />
              <span className="text-[10px] text-slate-400 font-semibold block">Berechnungsbasis fÃ¼r KundenauftrÃ¤ge und Lohnkostenanteile (Standard: 95 â‚¬)</span>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-black text-slate-700 uppercase tracking-wider">Monatliche Fixkosten</label>
                <span className="font-extrabold text-blue-750 text-sm">{fixedCosts} â‚¬</span>
              </div>
              <input 
                type="range" 
                min="1000" 
                max="10000" 
                step="250"
                value={fixedCosts} 
                onChange={(e) => setFixedCosts(parseInt(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-900"
              />
              <span className="text-[10px] text-slate-400 font-semibold block">Gemeinkosten, Badchemie-Grundbeladung, Mieten und GehÃ¤lter (Standard: 2500 â‚¬)</span>
            </div>
          </div>

          {/* Financial Cards Grid */}
          {(() => {
            const completedCount = orders.filter(o => o.status === "completed" || o.status === "shipped").length;
            const completedOrders = completedCount > 0 ? completedCount : 18;
            const activeOrders = orders.filter(o => o.status === "in_progress" || o.status === "waiting" || o.risk === "blocked").length;

            const revenueNet = completedOrders * 450;
            const materialCostNet = completedOrders * 65 + activeOrders * 12;
            const laborCostNet = completedOrders * 2.5 * hourlyRate;
            const contributionMarginNet = revenueNet - (materialCostNet + laborCostNet);
            const estimatedProfitNet = contributionMarginNet - fixedCosts;
            const profitMarginPercent = revenueNet > 0 ? (estimatedProfitNet / revenueNet) * 100 : 0;
            const forecastNet = revenueNet + (activeOrders * 420 * 0.75);

            return (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <Link href="/finances?view=revenue" className="block group hover:scale-[1.02] transition-transform">
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col justify-between h-[125px] group-hover:border-blue-300">
                      <div>
                        <span className="text-[9px] uppercase font-black text-slate-400 tracking-widest block group-hover:text-blue-600">Umsatz Netto</span>
                        <span className="text-2xl font-black text-slate-900 block mt-1">{revenueNet.toLocaleString("de-DE")} €</span>
                      </div>
                      <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">
                        {completedOrders} Aufträge im Zeitraum (Ø 450 €)
                      </p>
                    </div>
                  </Link>

                  <Link href="/finances?view=costs" className="block group hover:scale-[1.02] transition-transform">
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col justify-between h-[125px] group-hover:border-orange-300">
                      <div>
                        <span className="text-[9px] uppercase font-black text-slate-400 tracking-widest block group-hover:text-orange-600">Lohn- & Materialkosten</span>
                        <span className="text-2xl font-black text-slate-900 block mt-1">{(laborCostNet + materialCostNet).toLocaleString("de-DE")} €</span>
                      </div>
                      <p className="text-[10px] text-slate-400 font-semibold leading-relaxed flex justify-between">
                        <span>Material: {materialCostNet.toLocaleString("de-DE")} €</span>
                        <span>Lohn: {laborCostNet.toLocaleString("de-DE")} €</span>
                      </p>
                    </div>
                  </Link>

                  <Link href="/finances?view=margin" className="block group hover:scale-[1.02] transition-transform">
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col justify-between h-[125px] relative overflow-hidden group-hover:border-emerald-300">
                      <div className="absolute top-0 right-0 h-1.5 w-full bg-emerald-500"></div>
                      <div>
                        <span className="text-[9px] uppercase font-black text-slate-400 tracking-widest block group-hover:text-emerald-600">Deckungsbeitrag</span>
                        <span className="text-2xl font-black text-emerald-600 block mt-1">{contributionMarginNet.toLocaleString("de-DE")} €</span>
                      </div>
                      <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">
                        Rohertrag nach direkten variablen Kosten
                      </p>
                    </div>
                  </Link>

                  <Link href="/finances?view=profit" className="block group hover:scale-[1.02] transition-transform">
                    <div className={`border rounded-2xl p-4 flex flex-col justify-between h-[125px] relative overflow-hidden group-hover:border-blue-400 ${estimatedProfitNet >= 0 ? "bg-emerald-50/20 border-emerald-200" : "bg-red-50/20 border-red-250"}`}>
                      <div className={`absolute top-0 right-0 h-1.5 w-full ${estimatedProfitNet >= 0 ? "bg-emerald-500" : "bg-red-500"}`}></div>
                      <div>
                        <span className="text-[9px] uppercase font-black text-slate-400 tracking-widest block group-hover:text-blue-600">Geschätzter Gewinn</span>
                        <span className={`text-2xl font-black block mt-1 ${estimatedProfitNet >= 0 ? "text-emerald-700" : "text-red-700"}`}>{estimatedProfitNet.toLocaleString("de-DE")} €</span>
                      </div>
                      <p className="text-[10px] text-slate-400 font-semibold leading-relaxed flex justify-between">
                        <span>Marge: {profitMarginPercent.toFixed(1)} %</span>
                        <span>Netto nach Fixkosten</span>
                      </p>
                    </div>
                  </Link>
                </div>

                {/* Additional Row: Forecast & Business Advice */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4 border-slate-100">
                  <Link href="/finances?view=forecast" className="block group hover:scale-[1.01] transition-transform">
                    <div className="flex items-center gap-4 bg-blue-50/40 p-4 rounded-xl border border-blue-100 group-hover:border-blue-400">
                      <div className="text-center bg-blue-900 text-white rounded-lg p-2 shrink-0">
                        <span className="text-[9px] font-bold uppercase tracking-widest block font-mono">Forecast</span>
                        <span className="text-lg font-black">{forecastNet.toLocaleString("de-DE")} €</span>
                      </div>
                      <div>
                        <h5 className="font-extrabold text-xs text-slate-800 group-hover:text-blue-900">Umsatzprognose Monatsende</h5>
                        <p className="text-slate-400 text-[10px] leading-relaxed mt-0.5">
                          Erwarteter Netto-Umsatz inklusive gewichteter Wahrscheinlichkeiten offener Aufträge ({activeOrders} im Fluss).
                        </p>
                      </div>
                    </div>
                  </Link>

                  <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                    <Info className="h-4.5 w-4.5 text-blue-900 shrink-0" />
                    <p className="text-slate-500 leading-relaxed font-semibold">
                      <strong>Analyse:</strong> Der aktuelle Deckungsbeitrag ist stabil bei ca. <strong>{revenueNet > 0 ? Math.round((contributionMarginNet / revenueNet) * 100) : 0}%</strong>. 
                      Eine ErhÃ¶hung des Verrechnungssatzes um 10 â‚¬ steigert den geschÃ¤tzten Gewinn bei gleichem Durchsatz direkt um <strong>{(completedOrders * 2.5 * 10).toFixed(0)} â‚¬</strong>.
                    </p>
                  </div>
                </div>
              </>
            );
          })()}
        </CardContent>
      </Card>

      {/* NEW: Dynamic Bottlenecks Alerts & Meister Recommendations (Â§15) */}
      {(bottleneckWarnings.length > 0 || criticalBathAlerts.length > 0) && (
        <Card className="border-red-200 bg-red-50/15 shadow-xs p-5 space-y-4">
          <div className="flex items-center gap-2 text-red-700">
            <AlertCircle className="h-5.5 w-5.5 font-bold" />
            <h4 className="font-extrabold text-sm uppercase tracking-wider font-serif">âš ï¸ Aktive Engpass-Analysen & Handlungsempfehlungen</h4>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 1. Critical bath alerts */}
            {criticalBathAlerts.map(bath => (
              <div key={bath.id} className="bg-white p-4 rounded-xl border border-red-250 flex flex-col justify-between text-xs shadow-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[9px] font-black bg-red-100 text-red-800 px-2 py-0.5 rounded border border-red-200">BAD {bath.bathNumber}</span>
                    <span className="font-extrabold text-red-700 uppercase tracking-wide">Kritischer Grenzwert</span>
                  </div>
                  <h5 className="font-extrabold text-sm text-slate-900 mt-2 font-serif">{bath.name}</h5>
                  <p className="text-slate-500 mt-1 font-semibold leading-relaxed">
                    Sperrung wegen GrenzwertÃ¼berschreitung. ({bath.notes || "Temperatur / pH-Wert auÃŸerhalb Toleranz"}).
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 font-extrabold uppercase">Empfehlung: Heizung/Zusatz prÃ¼fen</span>
                  <Link href="/items" className="text-red-700 font-black flex items-center gap-0.5 hover:underline">
                    Badregelkarte <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            ))}

            {/* 2. Overloaded stations */}
            {bottleneckWarnings.map(warn => (
              <div key={warn.key} className="bg-white p-4 rounded-xl border border-orange-250 flex flex-col justify-between text-xs shadow-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[9px] font-black bg-orange-100 text-orange-800 px-2 py-0.5 rounded border border-orange-200">ENGPASS</span>
                    <span className="font-extrabold text-orange-700 uppercase tracking-wide">Auslastung {warn.load}%</span>
                  </div>
                  <h5 className="font-extrabold text-sm text-slate-900 mt-2 font-serif">{warn.name}</h5>
                  <p className="text-slate-500 mt-1 font-semibold leading-relaxed">
                    {warn.recommendation} ({warn.partsWaiting} wartende Teile).
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 font-extrabold uppercase">CTA: Dispositionsanpassung</span>
                  <Link href={warn.link} className="text-orange-700 font-black flex items-center gap-0.5 hover:underline">
                    {warn.cta} <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Analytical Workshop Heatmap & Throughput (Interactive) */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-bold text-slate-800 font-serif">Analytische Werkstatt-Heatmap & Durchsatz</CardTitle>
          <CardDescription className="text-xs">
            Chronologischer Produktionsdurchlauf (1 bis 5). Klicke auf eine Station, um die zugehÃ¶rigen AuftrÃ¤ge zu filtern und zu steuern.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {heatmapStations.map(station => {
              const Icon = station.IconComponent;
              return (
                <Link 
                  href={`/orders?station=${station.key}`} 
                  key={station.key}
                  className={`block border rounded-xl p-4 transition-all duration-200 group relative overflow-hidden shadow-xs ${station.colorClass}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] font-black bg-slate-900/10 px-2 py-0.5 rounded-full text-slate-800 uppercase tracking-wide">
                          Schritt {station.stepNumber}
                        </span>
                      </div>
                      <h4 className="font-extrabold text-sm sm:text-base font-serif group-hover:text-blue-900 transition-colors mt-1.5 leading-tight">
                        {station.name}
                      </h4>
                    </div>
                    <div className="h-10 w-10 rounded-xl bg-linear-to-br from-blue-100 to-blue-200 flex items-center justify-center text-blue-900 shadow-inner">
                      <Icon className="h-5 w-5 text-slate-650" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-4 border-t pt-3 border-slate-100">
                    <div>
                      <span className="text-[8px] text-slate-400 font-bold uppercase block tracking-wider leading-none">Ã˜ Zeit</span>
                      <span className="text-base font-black block mt-0.5 text-slate-900">{station.throughputTime} d</span>
                    </div>
                    <div>
                      <span className="text-[8px] text-slate-400 font-bold uppercase block tracking-wider leading-none">Wartend</span>
                      <span className="text-base font-black block mt-0.5 text-slate-900">{station.partsWaiting} Stk</span>
                    </div>
                  </div>

                  {/* Micro Progress Bar representing Workload */}
                  <div className="mt-4 space-y-1">
                    <div className="flex justify-between items-center text-[8px] font-bold text-slate-400">
                      <span>Auslastung</span>
                      <span>{station.load}%</span>
                    </div>
                    <Progress value={station.load} className="h-1" />
                  </div>

                  <div className="mt-3 flex items-center justify-between text-[8px] text-blue-900 font-extrabold group-hover:translate-x-0.5 transition-transform pt-1">
                    <span>{station.action}</span>
                    <ChevronRight className="h-3 w-3 text-blue-900" />
                  </div>
                </Link>
              );
            })}
          </div>

          <div className="mt-4 flex items-center justify-between text-[9px] font-bold text-slate-400 border-t pt-3 px-1 uppercase tracking-wider">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-red-500 rounded-sm"></span> Engpass / Ãœberlast</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-orange-500 rounded-sm"></span> ErhÃ¶htes Volumen</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-yellow-500 rounded-sm"></span> RegulÃ¤rer Betrieb</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-emerald-500 rounded-sm"></span> Optimal / Leerlauf</span>
          </div>
        </CardContent>
      </Card>

      {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      

      {/* ── Finanzcontrolling ──────────────────────────────────────────── */}
      <Card className="shadow-sm border-slate-200 overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-slate-900 to-blue-950 text-white pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-black font-serif tracking-tight">Finanzcontrolling &amp; Kalkulation</CardTitle>
              <CardDescription className="text-blue-200 text-xs mt-1">Reaktive Echtzeit-Berechnung · Passe die Regler an, um Szenarien zu simulieren</CardDescription>
            </div>
            <button onClick={exportCSV} className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors">
              ↓ Lexware/DATEV CSV
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-5">
            <div>
              <div className="flex justify-between text-xs font-bold text-blue-200 mb-2">
                <span>Verrechnungssatz (Netto)</span>
                <span className="text-white">{hourlyRate} €/h</span>
              </div>
              <input type="range" min={50} max={200} step={5} value={hourlyRate} onChange={e => setHourlyRate(Number(e.target.value))} className="w-full accent-blue-400 h-1.5 rounded-full" />
              <div className="flex justify-between text-[9px] text-blue-300 mt-1"><span>50 €</span><span>200 €</span></div>
            </div>
            <div>
              <div className="flex justify-between text-xs font-bold text-blue-200 mb-2">
                <span>Monatliche Fixkosten</span>
                <span className="text-white">{fixedCosts.toLocaleString("de-CH")} €</span>
              </div>
              <input type="range" min={1000} max={10000} step={100} value={fixedCosts} onChange={e => setFixedCosts(Number(e.target.value))} className="w-full accent-purple-400 h-1.5 rounded-full" />
              <div className="flex justify-between text-[9px] text-blue-300 mt-1"><span>1.000 €</span><span>10.000 €</span></div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
            {finKpis.map(k => (
              <div key={k.label} className={`rounded-xl border p-4 ${k.bg} ${k.border}`}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">{k.label}</p>
                <p className={`text-2xl font-black ${k.color}`}>{k.sign}{Math.abs(k.value).toLocaleString("de-CH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €</p>
              </div>
            ))}
          </div>
          <div className="rounded-xl bg-slate-900 text-white p-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Umsatz-Forecast (aktive Aufträge × 70%)</p>
              <p className="text-3xl font-black text-emerald-400 mt-1">{finForecast.toLocaleString("de-CH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €</p>
              <p className="text-xs text-slate-400 mt-1">{finCompletedCount} abgeschlossen · {finActiveCount} aktiv</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[9px] text-slate-500 uppercase tracking-wider">Marge (DB/Umsatz)</p>
              <p className={`text-xl font-black ${finRevenue > 0 && finDB / finRevenue > 0.3 ? "text-emerald-400" : "text-orange-400"}`}>
                {finRevenue > 0 ? Math.round((finDB / finRevenue) * 100) : 0}%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="shadow-sm border-slate-200">
          <CardHeader>
            <CardTitle className="text-base font-bold text-slate-800 font-serif">Wochenziel &amp; Erfolgsserie</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="flex justify-between text-xs font-bold text-slate-600 mb-2">
                <span>Fertiggestellte Objekte</span><span>23 / 25</span>
              </div>
              <Progress value={92} className="h-3" />
              <p className="text-xs text-slate-500 mt-2">Noch 2 Aufträge bis zum wöchentlichen Gesamtziel!</p>
            </div>
            <div className="border-t pt-4">
              <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Erfolgsserie (Streaks)</h5>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-orange-50 text-orange-500 rounded-xl flex items-center justify-center border border-orange-200 shrink-0">
                  <Flame className="h-6 w-6" />
                </div>
                <div>
                  <span className="text-lg font-bold text-slate-800 block">5 Wochen über Ziel</span>
                  <span className="text-xs text-slate-500">Hervorragende Kapazitätsausnutzung im Mai.</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base font-bold text-slate-800 font-serif">Trends &amp; Auslastung im Monatsvergleich</CardTitle>
            <CardDescription className="text-xs">Mittlere Bearbeitungszeit je Teiletyp (Tage)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold text-slate-700">
                <span>Stoßstangen &amp; Zierleisten (Oldtimer)</span><span>Ø 6,2 Tage (Kritisch)</span>
              </div>
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden"><div className="bg-red-500 h-full w-[85%]"></div></div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold text-slate-700">
                <span>Motorradtanks &amp; Felgen</span><span>Ø 4,8 Tage (Im Plan)</span>
              </div>
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden"><div className="bg-emerald-500 h-full w-[65%]"></div></div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold text-slate-700">
                <span>Kleinteile, Hausrat &amp; Besteck</span><span>Ø 2,5 Tage (Optimal)</span>
              </div>
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden"><div className="bg-emerald-500 h-full w-[35%]"></div></div>
            </div>
            <div className="border-t pt-4">
              <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Verbesserungsempfehlungen</h5>
              <p className="text-xs text-slate-600 leading-relaxed">
                <TrendingUp className="h-4 w-4 text-emerald-600 inline mr-1" />
                Die Rüstzeiten in der Galvanik (Chrombad) konnten durch Batch-Bearbeitung von Kleinteilen um 12% gesenkt werden. Die Schleiferei bleibt weiterhin der Hauptengpass.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
