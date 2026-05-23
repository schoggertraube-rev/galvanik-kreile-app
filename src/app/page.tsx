"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  CheckCircle2, 
  FileText, 
  AlertTriangle, 
  AlertCircle, 
  PauseCircle, 
  Camera,
  Zap, 
  Phone,
  Calendar
} from "lucide-react";
import { INITIAL_ORDERS, INITIAL_CUSTOMERS, INITIAL_SCAN_LOG, MockOrder, MockCustomer } from "@/lib/mockData";
import { getRiskConfig } from "@/constants/status";
import { getStationConfig } from "@/constants/stations";
import { evaluateOrderPriority } from "@/lib/priority";

export default function HeuteDashboard() {
  const [orders, setOrders] = useState<MockOrder[]>(INITIAL_ORDERS);
  const [filter, setFilter] = useState<string>("all");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>("o1");
  const selectedOrder = orders.find(o => o.id === selectedOrderId) ?? null;

  // Load from localStorage on mount
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
        }
      }
    };
    loadData();
  }, []);

  // Dynamic status counts
  const countRed = orders.filter(o => o.risk === "red").length;
  const countOrange = orders.filter(o => o.risk === "orange" || o.risk === "yellow").length;
  const countGreen = orders.filter(o => o.risk === "green").length;

  // Central workshop station names helper
  const getStationName = (station: string) => {
    return getStationConfig(station).fullName || station;
  };

  // Dynamic station parts calculation for actual warehouse workload (non-fake scales)
  const getPartsCountForStation = (stationKey: string) => {
    return orders
      .filter(o => o.station === stationKey)
      .reduce((sum, o) => sum + o.parts.length, 0);
  };

  // Visibly change order status upon initiating counter-measures (no fake alert dialogs)
  const handleAction = (orderId: string) => {
    const updated = orders.map(o => {
      if (o.id === orderId || o.orderNumber === orderId) {
        return {
          ...o,
          risk: "green" as const,
          statusText: "IM PLAN (Gegenmaßnahme eingeleitet)",
          delayReason: undefined,
          recommendedAction: undefined,
          dueLabel: "Fällig in",
          dueValue: "10 Tagen"
        };
      }
      return o;
    });

    setOrders(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem("kreile_orders", JSON.stringify(updated));
    }
  };

  // Phone lookup helper – deterministic, uses only mock data for initial render
  const getCustomerPhone = (customerId: string, customerName: string) => {
    // Use the initial mock data; this is identical on server and client during first render
    const list: MockCustomer[] = INITIAL_CUSTOMERS;
    const customer = list.find(
      c => c.id === customerId || String(c?.name ?? "").toLowerCase().includes(String(customerName ?? "").toLowerCase())
    );
    return customer && customer.phone && customer.phone.trim() !== "" ? customer.phone : null;
  };

  const filteredOrders = orders.filter(o => {
    if (filter === "all") return true;
    if (filter === "critical") return o.risk === "red" || o.risk === "orange";
    return o.risk === filter;
  });

  // Deterministic count of active orders (same on server and client)
  const activeOrdersCount = orders.length;

  const [greeting, setGreeting] = useState<string>('');
  const userName = "Max"; // Später dynamisch aus Auth

  // Compute greeting on client after mount to avoid SSR/CSR mismatch
  useEffect(() => {
    const hour = new Date().getHours();
    const g = hour < 11 ? "Guten Morgen" : hour < 18 ? "Guten Tag" : "Guten Abend";
    setTimeout(() => setGreeting(g), 0);
  }, []);

  return (
    <div className="space-y-6 pb-12 font-sans antialiased text-slate-900">
      
      {/* Hero-Section as Cockpit Header */}
      <div className="bg-linear-to-br from-slate-900 via-slate-850 to-blue-950 text-white p-6 md:p-8 rounded-2xl border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 -mt-20 -mr-20 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute left-1/3 bottom-0 -mb-20 w-80 h-80 bg-orange-500/5 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/15 border border-blue-500/35 rounded-full text-blue-300 text-xs font-bold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
              Operativer Leitstand
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight font-serif text-white">
              {greeting}, {userName}.
            </h1>
            <p className="text-slate-300 text-sm md:text-base max-w-2xl font-medium">
              Heute sind {activeOrdersCount} Aufträge aktiv.<br className="hidden md:block"/>
              {countRed} kritisch, {countOrange} gefährdet, {countGreen} im Plan.<br className="hidden md:block"/>
              Aktueller Engpass: Schleiferei.
            </p>
          </div>
          
          {/* Status-Board Kennzahlen - dynamic and easy to capture on tablet */}
          <div className="grid grid-cols-3 gap-3 sm:gap-4 shrink-0">
            <div className="bg-red-500/10 border border-red-500/30 px-5 py-4 rounded-xl shadow-sm text-center min-w-[90px] md:min-w-[110px] animate-pulse">
              <div className="text-3xl md:text-4xl font-black text-red-400 leading-none">{countRed}</div>
              <div className="text-[10px] md:text-xs font-bold text-red-300 uppercase tracking-wider mt-1.5">Kritisch</div>
            </div>
            <div className="bg-orange-500/10 border border-orange-500/30 px-5 py-4 rounded-xl shadow-sm text-center min-w-[90px] md:min-w-[110px]">
              <div className="text-3xl md:text-4xl font-black text-orange-400 leading-none">{countOrange}</div>
              <div className="text-[10px] md:text-xs font-bold text-orange-300 uppercase tracking-wider mt-1.5">Gefährdet</div>
            </div>
            <div className="bg-emerald-500/10 border border-emerald-500/30 px-5 py-4 rounded-xl shadow-sm text-center min-w-[90px] md:min-w-[110px]">
              <div className="text-3xl md:text-4xl font-black text-emerald-400 leading-none">{countGreen}</div>
              <div className="text-[10px] md:text-xs font-bold text-emerald-300 uppercase tracking-wider mt-1.5">Im Plan</div>
            </div>
          </div>
        </div>
      </div>

      {/* Touch-optimized Navigation Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/today" className="block w-full">
          <Button className="w-full bg-white text-slate-800 hover:bg-slate-50 h-16 rounded-xl flex items-center justify-center gap-3 text-lg font-extrabold shadow-sm border-2 border-slate-200 active:scale-98 transition-all cursor-pointer">
            <Calendar className="h-6 w-6 text-blue-900 stroke-[2.5]" />
            <span>Zum heutigen Tag</span>
          </Button>
        </Link>

        <Link href="/orders/new" className="block w-full">
          <Button className="w-full bg-blue-900 text-white hover:bg-blue-800 h-16 rounded-xl flex items-center justify-center gap-3 text-lg font-extrabold shadow-md active:scale-98 transition-all border-2 border-blue-950 cursor-pointer">
            <Camera className="h-6 w-6 text-orange-400 stroke-[2.5]" />
            <span>Wareneingang</span>
          </Button>
        </Link>
        
        <Button
          onClick={() => setFilter(filter === "critical" ? "all" : "critical")}
          className={`w-full h-16 rounded-xl flex items-center justify-center gap-3 text-lg font-extrabold shadow-sm border-2 active:scale-98 transition-all cursor-pointer ${
            filter === "critical" 
              ? "bg-red-600 text-white border-red-700 hover:bg-red-700" 
              : "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
          }`}
        >
          <AlertCircle className={`h-6 w-6 ${filter === "critical" ? "text-white animate-pulse" : "text-red-600"}`} />
          <span>{filter === "critical" ? "Alle anzeigen" : "Kritische Punkte"}</span>
        </Button>
      </div>

      {/* Main Shopfloor Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Left Side: Order Queue */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="font-extrabold text-xl text-slate-800 font-serif">Kommende Arbeiten (Prioritäts-Warteschlange)</h3>
            <span className="text-xs text-slate-500 font-bold bg-slate-100 px-2.5 py-1 rounded-full">{filteredOrders.length} Aufträge</span>
          </div>

          <div className="space-y-4">
            {filteredOrders.map((order) => {
              const evalRes = evaluateOrderPriority({
                dueDate: order.dueValue,
                risk: order.risk,
              });
              const isSelected = selectedOrderId === order.id;
              const isRed = order.risk === "red";
              const isOrange = order.risk === "orange";
              
              let cardStyle = evalRes.config.cardClass;
              if (isSelected) {
                // Ensure selection ring is clearly visible
                cardStyle += " ring-2 ring-blue-900";
              }
              const leftBorderColor = evalRes.config.leftBorderClass;
              
              let iconElement = <CheckCircle2 className="h-6 w-6 text-emerald-500" />;

              if (order.risk === "red") {
                iconElement = (
                  <div className="p-2.5 bg-red-100 rounded-xl shrink-0 border border-red-200">
                    <svg className="h-7 w-7 text-red-600 animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                  </div>
                );
              } else if (order.risk === "orange") {
                iconElement = (
                  <div className="p-2 bg-orange-100 rounded-xl shrink-0 border border-orange-200">
                    <AlertTriangle className="h-6 w-6 text-orange-600" />
                  </div>
                );
              } else if (order.risk === "yellow") {
                iconElement = (
                  <div className="p-2 bg-yellow-100 rounded-xl shrink-0 border border-yellow-200">
                    <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  </div>
                );
              } else if (order.risk === "blocked") {
                iconElement = (
                  <div className="p-2 bg-slate-200 rounded-xl shrink-0">
                    <PauseCircle className="h-5 w-5 text-slate-600" />
                  </div>
                );
              } else {
                iconElement = (
                  <div className="p-2 bg-emerald-55 rounded-xl shrink-0">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  </div>
                );
              }

              return (
                <Card 
                  key={order.id} 
                  onClick={() => setSelectedOrderId(order.id)}
                  className={`transition-all duration-300 cursor-pointer ${cardStyle} ${leftBorderColor}`}
                >
                  <CardContent className={`p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${isRed ? "py-6" : ""}`}>
                    
                    <div className="flex items-start gap-4">
                      {iconElement}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-black text-slate-900 text-lg tracking-tight">{order.orderNumber}</span>
                          <span className="text-xs text-slate-500 font-bold bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">{order.customerName}</span>
                          {isRed && (
                            <Badge className="bg-red-600 hover:bg-red-700 text-white font-extrabold text-[10px] uppercase tracking-wider px-2 py-0.5 border border-red-700 animate-pulse">
                              Express-Aktion
                            </Badge>
                          )}
                          {isSelected && (
                            <Badge className="bg-blue-900 text-white font-bold text-[9px] uppercase tracking-wider px-2 py-0.5">
                              Ausgewählt
                            </Badge>
                          )}
                        </div>
                        <h4 className={`font-black text-slate-850 tracking-tight ${isRed ? "text-xl md:text-2xl text-red-950 font-serif" : "text-base md:text-lg"}`}>
                          {order.task}
                        </h4>
                        
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 pt-1">
                          <span className="font-bold text-slate-700 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md">Station: {getStationName(order.station)}</span>
                          <span>•</span>
                          <span>Teile: {order.parts.length} Werkstücke</span>
                        </div>
                      </div>
                    </div>

                    <div className="w-full md:w-auto flex flex-row md:flex-col justify-between items-end gap-3 self-stretch md:self-auto border-t md:border-0 pt-3 md:pt-0">
                      
                      <div className="text-left md:text-right">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">{order.dueLabel}</span>
                        <span className={`font-black tracking-tight leading-none ${isRed ? "text-3xl text-red-650" : isOrange ? "text-2xl text-orange-600" : "text-xl text-slate-800"}`}>
                          {order.dueValue}
                        </span>
                      </div>

                      {order.recommendedAction && (
                        <Button 
                          size="sm" 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAction(order.id);
                          }}
                          className={`h-10 font-extrabold text-xs gap-2 px-4 rounded-xl border shadow-sm transition-all cursor-pointer ${
                            isRed 
                              ? "bg-red-600 text-white hover:bg-red-700 border-red-700 hover:scale-[1.03]" 
                              : "bg-blue-900 text-white hover:bg-blue-800 border-blue-950 hover:scale-[1.03]"
                          }`}
                        >
                          <Zap className="h-3.5 w-3.5" /> 
                          <span>{order.recommendedAction}</span>
                        </Button>
                      )}
                    </div>

                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Right Side: Interactive Detailpanel */}
        <div className="space-y-6">
          
          {selectedOrder ? (
            <Card className="border-slate-350 shadow-lg rounded-2xl overflow-hidden bg-white ring-2 ring-blue-900/10">
              
              <div className="bg-slate-900 text-white p-5 flex justify-between items-start">
                <div className="space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-orange-400 bg-orange-950/50 px-2.5 py-0.5 rounded border border-orange-900/30">
                    Details & Leitstand
                  </span>
                  <h3 className="text-2xl font-mono font-black tracking-tight text-white">{selectedOrder.orderNumber}</h3>
                  <p className="text-xs text-slate-300 font-bold">{selectedOrder.customerName}</p>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setSelectedOrderId(null)}
                  className="text-slate-400 hover:text-white hover:bg-slate-800 -mr-2 -mt-2 h-8 w-8 p-0 rounded-full flex items-center justify-center cursor-pointer"
                >
                  ✕
                </Button>
              </div>
              
              <CardContent className="p-5 space-y-5">
                
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Arbeitsauftrag</span>
                  <h4 className="font-black text-lg text-slate-900 leading-tight">{selectedOrder.task}</h4>
                  <div className="flex items-center justify-between text-xs text-slate-500 pt-1.5">
                    <span className="font-extrabold text-slate-700 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-md">
                      Station: {getStationName(selectedOrder.station)}
                    </span>
                    <span className="font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded border border-slate-200">
                      Status: {getRiskConfig(selectedOrder.risk).label}
                    </span>
                  </div>
                </div>

                <hr className="border-slate-100" />

                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Frist / Dringlichkeit</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 font-semibold">{selectedOrder.dueLabel}:</span>
                    <span className={`text-sm font-extrabold ${selectedOrder.risk === "red" ? "text-red-650" : selectedOrder.risk === "orange" ? "text-orange-650" : "text-slate-850"}`}>
                      {selectedOrder.dueValue}
                    </span>
                  </div>
                </div>

                {selectedOrder.delayReason && (
                  <>
                    <hr className="border-slate-100" />
                    <div className={`p-4 rounded-xl border flex gap-3 text-xs leading-relaxed ${
                      selectedOrder.risk === "red" 
                        ? "bg-red-50 border-red-200 text-red-950" 
                        : selectedOrder.risk === "blocked"
                        ? "bg-slate-100 border-slate-200 text-slate-850"
                        : "bg-orange-50 border-orange-200 text-orange-950"
                    }`}>
                      <AlertCircle className={`h-5 w-5 shrink-0 ${
                        selectedOrder.risk === "red" ? "text-red-600" : "text-amber-500"
                      }`} />
                      <div className="space-y-1">
                        <h5 className="font-black uppercase tracking-wider text-[10px]">Störung / Blocker-Grund</h5>
                        <p className="font-medium">{selectedOrder.delayReason}</p>
                      </div>
                    </div>
                  </>
                )}

                {selectedOrder.recommendedAction && (
                  <>
                    <hr className="border-slate-100" />
                    <div className="space-y-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Empfohlene Gegenmaßnahme</span>
                      <div className="bg-blue-50/50 border border-blue-150 p-3.5 rounded-xl flex items-center gap-2.5 text-xs text-blue-950">
                        <Zap className="h-4 w-4 text-blue-900 shrink-0" />
                        <span className="font-semibold">{selectedOrder.recommendedAction}</span>
                      </div>
                    </div>
                  </>
                )}

                {/* Associated parts under select order */}
                <div className="space-y-2 border-t pt-4">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Zugeordnete Werkstücke</span>
                  <div className="space-y-2">
                    {selectedOrder.parts.map(part => (
                      <div key={part.id} className="p-2 bg-slate-50 border rounded-lg flex items-center justify-between text-xs">
                        <div>
                          <p className="font-bold text-slate-800">{part.name}</p>
                          <p className="text-[10px] text-slate-500">
                            Oberfläche: {part.finish} | Ort: {part.location}
                          </p>
                        </div>
                        <Badge variant="outline" className="font-mono text-[9px] bg-white text-slate-500">
                          {part.id}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>

                <hr className="border-slate-100" />

                {/* CRM actions with authentic telephone check */}
                <div className="space-y-2 pt-1">
                  {(() => {
                    const phone = getCustomerPhone(selectedOrder.customerId, selectedOrder.customerName);
                    if (phone) {
                      return (
                        <a 
                          href={`tel:${phone}`}
                          className="w-full h-11 bg-white hover:bg-slate-50 text-slate-800 font-bold border-2 border-slate-200 rounded-xl flex items-center justify-center gap-2 text-xs shadow-sm transition-all"
                        >
                          <Phone className="h-4 w-4 text-emerald-600 shrink-0" />
                          <span>Kunde anrufen ({phone})</span>
                        </a>
                      );
                    } else {
                      return (
                        <Link 
                          href="/customers"
                          className="w-full h-11 bg-white hover:bg-slate-50 text-slate-600 hover:text-blue-900 font-semibold border-2 border-dashed border-slate-200 hover:border-slate-300 rounded-xl flex items-center justify-center gap-2 text-xs transition-all text-center"
                        >
                          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                          <span>Telefonnummer in Kundenkartei prüfen</span>
                        </Link>
                      );
                    }
                  })()}

                  {selectedOrder.recommendedAction && (
                    <Button 
                      className="w-full bg-blue-900 hover:bg-blue-800 text-white font-extrabold text-xs h-11 rounded-xl flex items-center justify-center gap-2 border border-blue-950 shadow-sm transition-all cursor-pointer"
                      onClick={() => handleAction(selectedOrder.id)}
                    >
                      <Zap className="h-3.5 w-3.5 text-orange-400" />
                      <span>Interne Maßnahme einleiten</span>
                    </Button>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <Link href="/customers" className="block w-full">
                      <Button 
                        variant="outline" 
                        className="w-full h-10 text-xs font-bold border-slate-200 hover:bg-slate-50 rounded-xl cursor-pointer"
                      >
                        Kundendaten öffnen
                      </Button>
                    </Link>
                    <Link href={`/orders?station=${selectedOrder.station}`} className="block w-full">
                      <Button 
                        variant="outline"
                        className="w-full h-10 text-xs font-bold border-slate-200 hover:bg-slate-50 rounded-xl cursor-pointer"
                      >
                        Station einsehen
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed border-2 border-slate-200 bg-slate-50/50 p-6 text-center rounded-2xl space-y-2">
              <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                <FileText className="h-6 w-6" />
              </div>
              <h4 className="font-extrabold text-sm text-slate-700">Kein Auftrag ausgewählt</h4>
              <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                Wähle links in der Prioritäts-Warteschlange einen Auftrag aus, um die detaillierten Leitstands-Informationen und internen Maßnahmen freizuschalten.
              </p>
            </Card>
          )}
          
          {/* Workload bottlenecks based on live parts database count */}
          <Card className="shadow-sm border-slate-200 rounded-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-extrabold text-slate-800 font-serif">Arbeitsauslastung & Engpässe</CardTitle>
              <CardDescription className="text-xs">Aktuelle Verteilung der Werkstücke.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              
              {/* Schleiferei Alert */}
              <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0 animate-pulse" />
                <div>
                  <h5 className="font-extrabold text-sm text-red-950">Engpass: Schleiferei</h5>
                  <p className="text-xs text-red-700 mt-1">
                    Auslastung hoch – {getPartsCountForStation("schleiferei")} Teile in Vorarbeit.
                  </p>
                  <Link href="/orders?station=schleiferei">
                    <Button variant="outline" size="sm" className="h-8 text-[10px] font-extrabold mt-2.5 border-red-300 text-red-700 hover:bg-red-100 bg-white cursor-pointer">
                      Schleiferei anzeigen
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Beschichtung / Galvanik load bar */}
              {(() => {
                const partsCount = getPartsCountForStation("beschichtung");
                const percentage = Math.min(100, Math.round((partsCount / 4) * 100));
                return (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs font-bold text-slate-600">
                      <span>Galvanik (Beschichtung)</span>
                      <span className={percentage > 70 ? "text-orange-600" : "text-emerald-600"}>{percentage}% ({partsCount} Teile)</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${percentage > 70 ? "bg-orange-500" : "bg-emerald-500"}`} 
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })()}

              {/* Entmetallisierung load bar */}
              {(() => {
                const partsCount = getPartsCountForStation("entmetallisierung");
                const percentage = Math.min(100, Math.round((partsCount / 3) * 100));
                return (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs font-bold text-slate-600">
                      <span>Entmetallisierung</span>
                      <span className="text-slate-500">{percentage}% ({partsCount} Teile)</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-blue-500 h-full" style={{ width: `${percentage}%` }}></div>
                    </div>
                  </div>
                );
              })()}

            </CardContent>
          </Card>

          {/* Actionable resolutions and approvals */}
          <Card className="shadow-sm border-slate-200 rounded-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-extrabold text-slate-800 font-serif">Handlungsbedarf / Freigaben</CardTitle>
            </CardHeader>
            <CardContent className="p-0 border-t">
              <div className="divide-y text-xs">
                {orders.filter(o => o.risk === "blocked").map(order => {
                  const phone = getCustomerPhone(order.customerId, order.customerName);
                  return (
                    <div key={order.id} className="p-3.5 flex justify-between items-center gap-2 hover:bg-slate-50 transition-colors">
                      <div>
                        <span className="font-mono font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">{order.orderNumber}</span>
                        <p className="font-bold text-slate-800 mt-1">{order.customerName}</p>
                        <p className="text-slate-500 mt-0.5">{order.delayReason || "Entscheidung ausstehend"}</p>
                      </div>
                      {phone ? (
                        <a 
                          href={`tel:${phone}`}
                          className="h-8 text-[10px] font-extrabold px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl flex items-center justify-center shrink-0"
                        >
                          Anrufen
                        </a>
                      ) : (
                        <Link 
                          href="/customers" 
                          className="h-8 text-[10px] font-extrabold px-2 py-2 text-amber-600 bg-white border border-slate-200 border-dashed hover:bg-slate-50 rounded-xl flex items-center justify-center text-center shrink-0"
                          title="Telefonnummer in Kundenkartei prüfen"
                        >
                          Kundenkartei
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Live Scan Log widget */}
          <Card className="shadow-sm border-slate-200 rounded-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-extrabold text-slate-800 font-serif flex items-center justify-between">
                <span>Letzte Scans / Aktivitäten</span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 border-t">
              <div className="divide-y text-xs">
                {INITIAL_SCAN_LOG.map((log, idx) => (
                  <div key={idx} className="p-3.5 hover:bg-slate-50 transition-colors flex items-start gap-2">
                    <span className="font-mono font-bold text-slate-400 shrink-0 mt-0.5">{log.time}</span>
                    <div className="space-y-0.5">
                      <span className="font-bold text-[9px] uppercase tracking-wider text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-100 inline-block">{log.type}</span>
                      <p className="font-bold text-slate-800 mt-1">{log.desc}</p>
                      <p className="text-[10px] text-slate-500 font-medium">{log.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}
