"use client";

import { usePageView } from "@/hooks/usePageView";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  CheckCircle2, 
  FileText, 
  AlertTriangle, 
  AlertCircle, 
  PauseCircle, 
  Zap, 
  Phone,
  Calendar
} from "lucide-react";
import type { Order } from "@/lib/repositories/ordersRepository";
import type { Customer } from "@/lib/types/customer";
const INITIAL_ORDERS: Order[] = [];
const INITIAL_CUSTOMERS: Customer[] = [];
import { getRiskConfig } from "@/constants/status";
import { getStationConfig } from "@/constants/stations";
import { ordersRepository } from "@/lib/repositories/ordersRepository";
import { customersRepository } from "@/lib/repositories/customersRepository";
import { PageHeader } from "@/components/ui/PageHeader";

export default function TodayDashboard() {
  usePageView();
  const [orders, setOrders] = useState<Order[]>(INITIAL_ORDERS);
  const [customers, setCustomers] = useState<Customer[]>(INITIAL_CUSTOMERS);
  const [filter, setFilter] = useState<string>("all");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>("o1");

  // Load from Repositories on mount
  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      try {
        const dbOrders = await ordersRepository.getAll();
        if (isMounted && dbOrders && dbOrders.length > 0) {
          setOrders(dbOrders);
        }
        
        const dbCustomers = await customersRepository.getAll();
        if (isMounted && dbCustomers && dbCustomers.length > 0) {
          setCustomers(dbCustomers);
        }
      } catch (e) {
        console.error("Fehler beim Laden aus Repositories", e);
      }
    };
    loadData();

    const handleSync = () => {
      console.log("[TodayDashboard] Sync event received, reloading data...");
      loadData();
    };

    window.addEventListener('kreile-sync-orders', handleSync);
    window.addEventListener('kreile-sync-customers', handleSync);
    window.addEventListener('kreile-sync-focus', handleSync);

    return () => {
      isMounted = false;
      window.removeEventListener('kreile-sync-orders', handleSync);
      window.removeEventListener('kreile-sync-customers', handleSync);
      window.removeEventListener('kreile-sync-focus', handleSync);
    };
  }, []);

  // Filter orders for "today" - overdue (red) or due today (orange)
  // Priority is computed server-side (single source of truth). Filter on the
  // canonical risk instead of recomputing it on the client from a display string.
  const todayOrders = orders.filter(o =>
    o.risk === "red" || o.risk === "orange" || o.risk === "yellow"
  );

  // Dynamic status counts based ONLY on today's orders
  const countRed = todayOrders.filter(o => o.risk === "red").length;
  const countOrange = todayOrders.filter(o => o.risk === "orange" || o.risk === "yellow").length;
  // Central workshop station names helper
  const getStationName = (station: string) => {
    return getStationConfig(station).fullName || station;
  };

  const getCustomerPhone = (customerId: string, customerName: string) => {
    const customer = customers.find(
      c => c.id === customerId || String(c?.name ?? "").toLowerCase().includes(String(customerName ?? "").toLowerCase())
    );
    return customer && customer.phone && customer.phone.trim() !== "" ? customer.phone : null;
  };

  const filteredOrders = todayOrders.filter(o => {
    if (filter === "all") return true;
    if (filter === "critical") return o.risk === "red" || o.risk === "orange";
    return o.risk === filter;
  });

  const selectedOrder = orders.find(o => o.id === selectedOrderId) || null;
  const activeOrdersCount = todayOrders.length;
  const hour = new Date().getHours();
  const greeting = hour < 11 ? "Guten Morgen" : hour < 18 ? "Guten Tag" : "Guten Abend";
  const userName = "Max";

  return (
    <div className="space-y-6 pb-12 font-sans antialiased text-navy-900">
      <PageHeader
        title="Heute im Blick"
        subtitle="Kritische Fälligkeiten, Express-Freigaben und Gegenmaßnahmen für die Schicht."
      />

      {/* Cockpit Status Summary - Quiet elegance */}
      <div className="bg-linear-to-r from-navy-900 to-navy-700 text-white p-6 md:p-8 rounded-2xl border border-white/10 shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 -mt-20 -mr-20 w-80 h-80 bg-gold-600/5 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 border border-white/20 rounded-full text-white/80 text-xs font-bold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse"></span>
              Fällige Aufträge für Heute
            </div>
            <h2 className="text-3xl md:text-4xl font-serif font-black tracking-tight text-white">
              {greeting}, {userName}.
            </h2>
            <p className="text-white/85 text-xs md:text-sm max-w-2xl font-sans font-medium">
              Heute stehen {activeOrdersCount} Aufträge auf dem Programm.<br className="hidden md:block"/>
              {countRed} kritisch, {countOrange} gefährdet. Lass uns das abarbeiten.
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-3 sm:gap-4 shrink-0">
            <div className="bg-accent-orange-soft/50 border border-danger-red/30 px-5 py-4 rounded-xl shadow-sm text-center min-w-[90px] md:min-w-[110px] animate-pulse">
              <div className="text-3xl md:text-4xl font-black text-danger-red leading-none">{countRed}</div>
              <div className="text-[10px] md:text-xs font-extrabold text-danger-red uppercase tracking-wider mt-1.5 font-sans">Kritisch</div>
            </div>
            <div className="bg-gold-1000/15 border border-accent-orange/30 px-5 py-4 rounded-xl shadow-sm text-center min-w-[90px] md:min-w-[110px]">
              <div className="text-3xl md:text-4xl font-black text-accent-orange leading-none">{countOrange}</div>
              <div className="text-[10px] md:text-xs font-extrabold text-accent-orange uppercase tracking-wider mt-1.5 font-sans">Fällig</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link href="/" className="block w-full">
          <Button className="w-full bg-white text-navy-900 hover:bg-bg-app-soft h-16 rounded-xl flex items-center justify-center gap-3 text-lg font-extrabold shadow-sm border-2 border-neutral-gray-300 active:scale-98 transition-all cursor-pointer">
            <Calendar className="h-6 w-6 text-navy-900 stroke-[2.5]" />
            <span>Gesamter Leitstand</span>
          </Button>
        </Link>
        
        <Button
          onClick={() => setFilter(filter === "critical" ? "all" : "critical")}
          className={`w-full h-16 rounded-xl flex items-center justify-center gap-3 text-lg font-extrabold shadow-sm border-2 active:scale-98 transition-all cursor-pointer ${
            filter === "critical" 
              ? "bg-danger-red text-white border-danger-red hover:bg-danger-red" 
              : "bg-accent-orange-soft text-danger-red border-danger-red hover:bg-danger-red"
          }`}
        >
          <AlertCircle className={`h-6 w-6 ${filter === "critical" ? "text-white animate-pulse" : "text-danger-red"}`} />
          <span>{filter === "critical" ? "Alle anzeigen" : "Kritische Punkte"}</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Left Side: Order Queue */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="font-extrabold text-xl text-navy-900 font-serif">Tages-Warteschlange</h3>
            <span className="text-xs text-text-muted font-bold bg-bg-app-soft px-2.5 py-1 rounded-full">{filteredOrders.length} Aufträge</span>
          </div>

          <div className="space-y-4">
            {filteredOrders.length === 0 ? (
                <div className="p-8 text-center text-text-muted">Für heute sind keine Aufträge fällig.</div>
            ) : filteredOrders.map((order) => {
              const config = getRiskConfig(order.risk);
              const isSelected = selectedOrderId === order.id;
              const isRed = order.risk === "red";
              const isOrange = order.risk === "orange";
              
              let cardStyle = config.cardClass;
              if (isSelected) {
                cardStyle += " ring-2 ring-navy-900";
              }
              const leftBorderColor = config.leftBorderClass;
              
              let iconElement = <CheckCircle2 className="h-6 w-6 text-success-green" />;

              if (order.risk === "red") {
                iconElement = (
                  <div className="p-2.5 bg-danger-red rounded-xl shrink-0 border border-danger-red">
                    <svg className="h-7 w-7 text-danger-red animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                  </div>
                );
              } else if (order.risk === "orange" || order.risk === "yellow") {
                iconElement = (
                  <div className="p-2 bg-orange-100 rounded-xl shrink-0 border border-accent-orange">
                    <AlertTriangle className="h-6 w-6 text-accent-orange" />
                  </div>
                );
              } else if (order.risk === "blocked") {
                iconElement = (
                  <div className="p-2 bg-neutral-gray-100 rounded-xl shrink-0">
                    <PauseCircle className="h-5 w-5 text-text-muted" />
                  </div>
                );
              } else {
                iconElement = (
                  <div className="p-2 bg-emerald-55 rounded-xl shrink-0">
                    <CheckCircle2 className="h-5 w-5 text-success-green" />
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
                          <span className="font-mono font-black text-navy-900 text-lg tracking-tight">{order.orderNumber}</span>
                          <span className="text-xs text-text-muted font-bold bg-bg-app-soft px-2.5 py-0.5 rounded-full border border-neutral-gray-300">{order.customerName}</span>
                          {isRed && (
                            <Badge className="bg-danger-red hover:bg-danger-red text-white font-extrabold text-[10px] uppercase tracking-wider px-2 py-0.5 border border-danger-red animate-pulse">
                              Express-Aktion
                            </Badge>
                          )}
                          {isSelected && (
                            <Badge className="bg-navy-900 text-white font-bold text-[9px] uppercase tracking-wider px-2 py-0.5">
                              Ausgewählt
                            </Badge>
                          )}
                        </div>
                        <h4 className={`font-black text-slate-850 tracking-tight ${isRed ? "text-xl md:text-2xl text-danger-red font-serif" : "text-base md:text-lg"}`}>
                          {order.task}
                        </h4>
                        
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted pt-1">
                          <span className="font-bold text-navy-900 bg-bg-app-soft border border-neutral-gray-300 px-2 py-0.5 rounded-md">Station: {getStationName(order.station)}</span>
                          <span>•</span>
                          <span>Teile: {order.parts.length} Werkstücke</span>
                        </div>
                      </div>
                    </div>

                    <div className="w-full md:w-auto flex flex-row md:flex-col justify-between items-end gap-3 self-stretch md:self-auto border-t md:border-0 pt-3 md:pt-0">
                      
                      <div className="text-left md:text-right">
                        <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider block">{order.dueLabel}</span>
                        <span className={`font-black tracking-tight leading-none ${isRed ? "text-3xl text-danger-red" : isOrange ? "text-2xl text-accent-orange" : "text-xl text-navy-900"}`}>
                          {order.dueValue}
                        </span>
                      </div>

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
            <Card className="border-neutral-gray-300 shadow-lg rounded-2xl overflow-hidden bg-white ring-2 ring-navy-900/10">
              
              <div className="bg-navy-900 text-white p-5 flex justify-between items-start">
                <div className="space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-accent-orange bg-orange-950/50 px-2.5 py-0.5 rounded border border-accent-orange/30">
                    Details & Leitstand
                  </span>
                  <h3 className="text-2xl font-mono font-black tracking-tight text-white">{selectedOrder.orderNumber}</h3>
                  <p className="text-xs text-text-muted font-bold">{selectedOrder.customerName}</p>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setSelectedOrderId(null)}
                  className="text-text-muted hover:text-white hover:bg-navy-900 -mr-2 -mt-2 h-8 w-8 p-0 rounded-full flex items-center justify-center cursor-pointer"
                >
                  ✕
                </Button>
              </div>
              
              <CardContent className="p-5 space-y-5">
                
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Arbeitsauftrag</span>
                  <h4 className="font-black text-lg text-navy-900 leading-tight">{selectedOrder.task}</h4>
                  <div className="flex items-center justify-between text-xs text-text-muted pt-1.5">
                    <span className="font-extrabold text-navy-900 bg-bg-app-soft border border-neutral-gray-300 px-2.5 py-0.5 rounded-md">
                      Station: {getStationName(selectedOrder.station)}
                    </span>
                    <span className="font-bold text-text-muted bg-bg-app-soft px-2.5 py-0.5 rounded border border-neutral-gray-300">
                      Status: {getRiskConfig(selectedOrder.risk).label}
                    </span>
                  </div>
                </div>

                <hr className="border-neutral-gray-100" />

                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">Frist / Dringlichkeit</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-text-muted font-semibold">{selectedOrder.dueLabel}:</span>
                    <span className={`text-sm font-extrabold ${selectedOrder.risk === "red" ? "text-danger-red" : selectedOrder.risk === "orange" ? "text-accent-orange" : "text-slate-850"}`}>
                      {selectedOrder.dueValue}
                    </span>
                  </div>
                </div>

                {selectedOrder.delayReason && (
                  <>
                    <hr className="border-neutral-gray-100" />
                    <div className={`p-4 rounded-xl border flex gap-3 text-xs leading-relaxed ${
                      selectedOrder.risk === "red" 
                        ? "bg-accent-orange-soft border-danger-red text-danger-red" 
                        : selectedOrder.risk === "blocked"
                        ? "bg-bg-app-soft border-neutral-gray-300 text-slate-850"
                        : "bg-gold-100 border-accent-orange text-accent-orange"
                    }`}>
                      <AlertCircle className={`h-5 w-5 shrink-0 ${
                        selectedOrder.risk === "red" ? "text-danger-red" : "text-gold-600"
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
                    <hr className="border-neutral-gray-100" />
                    <div className="space-y-2">
                      <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">Empfohlene Gegenmaßnahme</span>
                      <div className="bg-bg-app-soft border border-neutral-gray-300 p-3.5 rounded-xl flex items-center gap-2.5 text-xs text-navy-900">
                        <Zap className="h-4 w-4 text-navy-900 shrink-0" />
                        <span className="font-semibold">{selectedOrder.recommendedAction}</span>
                      </div>
                    </div>
                  </>
                )}

                <div className="space-y-2 border-t pt-4">
                  <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">Zugeordnete Werkstücke</span>
                  <div className="space-y-2">
                    {(selectedOrder.parts || []).map((part, idx) => {
                      const p = part as { id?: string; name?: string; surfaceRequested?: string; material?: string };
                      return (
                      <div key={p.id || idx} className="p-2 bg-bg-app-soft border rounded-lg flex items-center justify-between text-xs">
                        <div>
                          <p className="font-bold text-navy-900">{p.name}</p>
                          <p className="text-[10px] text-text-muted">
                            Oberfläche: {p.surfaceRequested || "—"}{p.material ? ` | Material: ${p.material}` : ""}
                          </p>
                        </div>
                        {p.id && (
                          <Badge variant="outline" className="font-mono text-[9px] bg-white text-text-muted">
                            {p.id}
                          </Badge>
                        )}
                      </div>
                      );
                    })}
                  </div>
                </div>

                <hr className="border-neutral-gray-100" />

                <div className="space-y-2 pt-1">
                  {(() => {
                    const phone = getCustomerPhone(selectedOrder.customerId, selectedOrder.customerName ?? "");
                    if (phone) {
                      return (
                        <a 
                          href={`tel:${phone}`}
                          className="w-full h-11 bg-white hover:bg-bg-app-soft text-navy-900 font-bold border-2 border-neutral-gray-300 rounded-xl flex items-center justify-center gap-2 text-xs shadow-sm transition-all"
                        >
                          <Phone className="h-4 w-4 text-success-green shrink-0" />
                          <span>Kunde anrufen ({phone})</span>
                        </a>
                      );
                    } else {
                      return (
                        <Link 
                          href="/customers"
                          className="w-full h-11 bg-white hover:bg-bg-app-soft text-text-muted hover:text-navy-900 font-semibold border-2 border-dashed border-neutral-gray-300 hover:border-gold-600 rounded-xl flex items-center justify-center gap-2 text-xs transition-all text-center"
                        >
                          <AlertTriangle className="h-4 w-4 text-gold-600 shrink-0" />
                          <span>Telefonnummer in Kundenkartei prüfen</span>
                        </Link>
                      );
                    }
                  })()}

                  <div className="grid grid-cols-2 gap-2">
                    <Link href="/customers" className="block w-full">
                      <Button 
                        variant="outline" 
                        className="w-full h-10 text-xs font-bold border-neutral-gray-300 hover:bg-bg-app-soft rounded-xl cursor-pointer"
                      >
                        Kundendaten öffnen
                      </Button>
                    </Link>
                    <Link href={`/orders?station=${selectedOrder.station}`} className="block w-full">
                      <Button 
                        variant="outline"
                        className="w-full h-10 text-xs font-bold border-neutral-gray-300 hover:bg-bg-app-soft rounded-xl cursor-pointer"
                      >
                        Station einsehen
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed border-2 border-neutral-gray-300 bg-bg-app-soft/50 p-6 text-center rounded-2xl space-y-2">
              <div className="h-12 w-12 rounded-full bg-bg-app-soft flex items-center justify-center mx-auto text-text-muted">
                <FileText className="h-6 w-6" />
              </div>
              <h4 className="font-extrabold text-sm text-navy-900">Kein Auftrag ausgewählt</h4>
              <p className="text-xs text-text-muted max-w-xs mx-auto leading-relaxed">
                Wähle links in der Tages-Warteschlange einen Auftrag aus, um die detaillierten Leitstands-Informationen und internen Maßnahmen freizuschalten.
              </p>
            </Card>
          )}
          
        </div>
      </div>
    </div>
  );
}
