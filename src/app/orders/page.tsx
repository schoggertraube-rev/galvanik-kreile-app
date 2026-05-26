"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  AlertTriangle, 
  ChevronRight, 
  PhoneCall, 
  RefreshCw, 
  Search, 
  X, 
  Package, 
  MapPin, 
  Zap,
  ArrowLeft,
  CheckCircle2
} from "lucide-react";
import { INITIAL_ORDERS, INITIAL_CUSTOMERS, MockOrder, MockCustomer } from "@/lib/mockData";
import { getStationConfig, getAllStations } from "@/constants/stations";
import { evaluateOrderPriority } from "@/lib/priority";
import { ordersRepository } from "@/lib/repositories/ordersRepository";
import { customersRepository } from "@/lib/repositories/customersRepository";
import { PageHeader } from "@/components/ui/PageHeader";
import { SearchToolbar } from "@/components/ui/SearchToolbar";

const safe = (value: unknown) => String(value ?? "").toLowerCase();


function OrdersPageInner() {
  const searchParams = useSearchParams();
  const stationFilter = searchParams.get("station");
  const [searchTerm, setSearchTerm] = useState("");
  
  const statusParam = searchParams.get("status") || searchParams.get("filter");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [prevStatusParam, setPrevStatusParam] = useState<string | null>(null);

  if (statusParam !== prevStatusParam) {
    setPrevStatusParam(statusParam);
    if (statusParam && ["all", "waiting", "critical", "active"].includes(statusParam)) {
      setStatusFilter(statusParam);
    }
  }

  // Initialize orders state from centralized mock data
  const [orders, setOrders] = useState<MockOrder[]>(INITIAL_ORDERS);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [prevOrderParam, setPrevOrderParam] = useState<string | null>(null);

  const orderParam = searchParams.get("order") || searchParams.get("id");
  if (orderParam !== prevOrderParam) {
    setPrevOrderParam(orderParam);
    if (orderParam) {
      setSelectedOrderId(orderParam);
    }
  }
  const [customersList, setCustomersList] = useState<MockCustomer[]>(INITIAL_CUSTOMERS as unknown as MockCustomer[]);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  // Load from Repositories on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const dbOrders = await ordersRepository.getAll();
        if (dbOrders && dbOrders.length > 0) {
          setOrders(dbOrders as unknown as MockOrder[]);
        }
        
        const dbCustomers = await customersRepository.getAll();
        if (dbCustomers && dbCustomers.length > 0) {
          setCustomersList(dbCustomers as unknown as MockCustomer[]);
        }
      } catch (e) {
        console.error("Fehler beim Laden aus Repositories", e);
      }
    };
    loadData();
  }, []);

  const handleStatusChange = (orderId: string, newRisk: "green" | "yellow" | "orange" | "red" | "blocked") => {
    const updated = orders.map(o => {
      if (o.id === orderId) {
        let statusText = "IM PLAN";
        let dueLabel = o.dueLabel;
        let dueValue = o.dueValue;
        if (newRisk === "red") {
          statusText = "KRITISCH – ÜBERFÄLLIG";
          dueLabel = "Überfällig seit";
          dueValue = "3 Std.";
        } else if (newRisk === "orange") {
          statusText = "GEFÄHRDET";
          dueLabel = "Fällig";
          dueValue = "Morgen";
        } else if (newRisk === "yellow") {
          statusText = "LEICHT KRITISCH";
        } else if (newRisk === "blocked") {
          statusText = "WARTET AUF FREIGABE";
          dueLabel = "Wartet auf";
          dueValue = "Freigabe";
        }

        return { ...o, risk: newRisk, statusText, dueLabel, dueValue };
      }
      return o;
    });

    setOrders(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem("kreile_orders", JSON.stringify(updated));
    }
    try {
      const orderToUpdate = updated.find(o => o.id === orderId);
      if (orderToUpdate) {
        ordersRepository.updateOrder(orderId, (orderToUpdate as unknown) as Parameters<typeof ordersRepository.updateOrder>[1]);
      }
    } catch (e) {
      console.error("Fehler beim Speichern des Status", e);
    }
  };

  const handleStationUpdate = (orderId: string, newStation: MockOrder["station"]) => {
    const updated = orders.map(o => {
      if (o.id === orderId) {
        // Also update all parts' station to the new station, so they display in /items if lager
        const updatedParts = o.parts.map(p => ({ ...p, station: newStation }));
        return { ...o, station: newStation, currentStationId: newStation, parts: updatedParts };
      }
      return o;
    });

    setOrders(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem("kreile_orders", JSON.stringify(updated));
    }
    try {
      const orderToUpdate = updated.find(o => o.id === orderId);
      if (orderToUpdate) {
        ordersRepository.updateOrder(orderId, (orderToUpdate as unknown) as Parameters<typeof ordersRepository.updateOrder>[1]);
      }
    } catch (e) {
      console.error("Fehler beim Speichern der Station", e);
    }
  };

  const handleRecommendedActionClick = (order: MockOrder) => {
    const updated = orders.map(o => {
      if (o.id === order.id) {
        return {
          ...o,
          risk: "green" as const,
          statusText: "Im Plan (Gegenmaßnahme eingeleitet)",
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
    try {
      const orderToUpdate = updated.find(o => o.id === order.id);
      if (orderToUpdate) {
        ordersRepository.updateOrder(order.id, (orderToUpdate as unknown) as Parameters<typeof ordersRepository.updateOrder>[1]);
      }
    } catch (e) {
      console.error("Fehler beim Speichern der Maßnahme", e);
    }
    setActionSuccessMessage(`Gegenmaßnahme für ${order.orderNumber} eingeleitet: "${order.recommendedAction}" wurde erfolgreich umgesetzt.`);
    // Auto-close after 6 seconds
    setTimeout(() => {
      setActionSuccessMessage(null);
    }, 6000);
  };

  // Find currently selected order
  const selectedOrder = orders.find(o => o.id === selectedOrderId) || null;

  // Filter orders by search term, status filter AND station filter
  const filteredOrders = orders.filter(o => {
    const cleanTerm = searchTerm.toLowerCase();
    const matchesSearch = safe(o.orderNumber).includes(cleanTerm) ||
                          safe(o.task).includes(cleanTerm) ||
                          safe(o.customerName).includes(cleanTerm);
    
    if (!matchesSearch) return false;

    // 2. Status filter match
    if (statusFilter === "waiting" && o.risk !== "blocked") return false;
    if (statusFilter === "critical" && o.risk !== "red" && o.risk !== "orange") return false;
    if (statusFilter === "active" && o.risk === "blocked") return false;

    // 3. Station filter match (strictly segregates orders per station screen)
    if (stationFilter && o.station !== stationFilter) return false;

    return true;
  });

  // Station display helper
  const getStationHeadline = () => {
    if (!stationFilter) return "Alle Aufträge / Auftragsbuch";
    const config = getStationConfig(stationFilter);
    const suffixMap: Record<string, string> = {
      wareneingang: " (Neue & Unvollständige Aufträge)",
      entmetallisierung: "",
      schleiferei: " (Vorarbeit & Polieren)",
      beschichtung: " (Beschichtung)",
      warenausgang: " (Versand & Abholung)"
    };
    return `${config.fullName}${suffixMap[stationFilter] || ""}`;
  };

  // Find customer information for phone details checking
  const getCustomerPhoneDetails = (customerName: string, customerId: string) => {
    const customer = customersList.find(
      c => c.id === customerId || safe(c?.name).includes(safe(customerName))
    );
    if (customer && customer.phone && customer.phone.trim() !== "") {
      return { hasPhone: true, phone: customer.phone };
    }
    return { hasPhone: false, phone: "" };
  };

  return (
    <div className="space-y-5 pb-12 max-w-6xl">
      <PageHeader
        title={getStationHeadline()}
        subtitle={
          stationFilter
            ? `Stationsspezifische Übersicht: ${stationFilter.toUpperCase()}`
            : "Alle Werkstattaufträge — wähle einen Auftrag für Details."
        }
        backHref={stationFilter ? "/orders" : undefined}
        action={{
          label: "Zurücksetzen",
          variant: "outline",
          onClick: () => { setSearchTerm(""); setStatusFilter("all"); setSelectedOrderId(null); },
        }}
      />
      <SearchToolbar
        value={searchTerm}
        onChange={setSearchTerm}
        placeholder="Suchen nach Auftragsnummer, Kunde, Arbeit..."
        filters={[
          { id: "all",      label: "Alle Status" },
          { id: "active",  label: "Aktiv" },
          { id: "waiting", label: "Wartend" },
          { id: "critical",label: "Kritisch", count: orders.filter(o => o.risk === "red" || o.risk === "orange").length },
        ]}
        activeFilter={statusFilter}
        onFilterChange={setStatusFilter}
      />

      {/* Main Content Layout (Master-Detail) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Left Columns: Master Order List */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between text-xs text-kreile-muted font-semibold px-1">
            <span>{filteredOrders.length} Aufträge an dieser Station</span>
            <span>Klicke für Details</span>
          </div>

          {filteredOrders.length > 0 ? (
            <div className="space-y-3">
              {filteredOrders.map((order) => {
                const isSelected = selectedOrderId === order.id;
                const isRed = order.risk === "red";
                const isOrange = order.risk === "orange";
                const isYellow = order.risk === "yellow";
                const isBlocked = order.risk === "blocked";

                const evalRes = evaluateOrderPriority({
                  dueDate: order.dueValue,
                  risk: order.risk,
                });
                let borderStyle = evalRes.config.leftBorderClass;
                let badgeStyle = evalRes.config.badgeClass;
                let itemBg = "bg-white hover:bg-kreile-surface-soft/50";

                if (isRed) {
                  borderStyle = `${evalRes.config.leftBorderClass} border-l-[8px] ring-1 ring-red-500/25`;
                  badgeStyle = evalRes.config.badgeClass;
                  itemBg = isSelected ? "bg-red-50/30" : "bg-red-50/10";
                } else if (isOrange) {
                  borderStyle = `${evalRes.config.leftBorderClass} border-l-[6px]`;
                  badgeStyle = evalRes.config.badgeClass;
                  itemBg = isSelected ? "bg-orange-50/20" : "bg-white";
                } else if (isYellow) {
                  borderStyle = `${evalRes.config.leftBorderClass} border-l-[6px]`;
                  badgeStyle = evalRes.config.badgeClass;
                  itemBg = isSelected ? "bg-yellow-50/20" : "bg-white";
                } else if (isBlocked) {
                  borderStyle = `${evalRes.config.leftBorderClass} border-l-4`;
                  badgeStyle = evalRes.config.badgeClass;
                  itemBg = isSelected ? "bg-kreile-border/40" : "bg-kreile-surface-soft/70";
                }

                return (
                  <Card
                    key={order.id}
                    onClick={() => setSelectedOrderId(order.id)}
                    className={`transition-all duration-200 cursor-pointer border-kreile-border shadow-sm ${itemBg} ${borderStyle} ${
                      isSelected ? "ring-2 ring-kreile-navy border-transparent shadow" : ""
                    }`}
                  >
                    <CardContent className="p-4 flex items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-extrabold text-kreile-navy text-base">{order.orderNumber}</span>
                          <span className="text-xs text-kreile-muted">• {order.customerName}</span>
                          <Badge variant="outline" className={`text-[9px] font-bold tracking-wider py-0 px-1.5 ${badgeStyle}`}>
                            {order.statusText}
                          </Badge>
                        </div>
                        <h4 className="font-bold text-kreile-navy text-sm md:text-base font-serif">{order.task}</h4>
                        <div className="flex items-center gap-3 text-xs text-kreile-muted font-semibold pt-0.5">
                          <span>Eingang: {order.intakeDate}</span>
                          <span>•</span>
                          <span>Teile: {order.parts.length}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-right shrink-0">
                        <div className="flex flex-col items-end">
                          <span className="text-[10px] text-kreile-muted font-bold uppercase">{order.dueLabel}</span>
                          <span className={`font-black text-lg ${isRed ? "text-red-650" : isOrange ? "text-orange-650" : "text-slate-750"}`}>
                            {order.dueValue}
                          </span>
                        </div>
                        <ChevronRight className={`h-5 w-5 transition-transform ${isSelected ? "text-kreile-navy translate-x-1" : "text-kreile-muted"}`} />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="p-12 text-center text-kreile-muted bg-white border border-kreile-border-strong rounded-xl space-y-2">
              <Package className="h-8 w-8 mx-auto text-kreile-muted animate-pulse" />
              <p className="font-bold text-kreile-muted">Keine Aufträge in dieser Station</p>
              <p className="text-xs">Ändere den Filter, passe den Suchbegriff an oder wähle eine andere Station.</p>
            </div>
          )}
        </div>

        {/* Right Column: Detail View panel */}
        <div className="lg:col-span-1">
          {selectedOrder ? (
            <Card className="shadow-md border-kreile-border overflow-hidden sticky top-6">
              
              {/* Header — Kreile Navy */}
              <div className="bg-kreile-navy text-white p-5 relative">
                <button
                  onClick={() => setSelectedOrderId(null)}
                  className="absolute right-4 top-4 text-white/70 hover:text-white transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-white/70">{selectedOrder.orderNumber}</span>
                  <Badge className="bg-kreile-navy-soft text-white border-0 text-[8px] font-bold uppercase tracking-wider py-0.5">
                    Station: {getStationConfig(selectedOrder.station).name.toUpperCase()}
                  </Badge>
                </div>
                <h3 className="font-black text-base mt-1 leading-tight">{selectedOrder.task}</h3>
                <p className="text-xs text-white/60 mt-1 font-medium">Kunde: {selectedOrder.customerName}</p>
              </div>

              {/* Specs */}
              <CardContent className="p-5 space-y-5">
                {actionSuccessMessage && (
                  <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl text-emerald-800 text-xs font-semibold flex items-start gap-2.5 relative">
                    <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="pr-6 leading-relaxed">
                      <span className="font-extrabold uppercase text-[9px] tracking-wide text-emerald-700 block">Systemmeldung</span>
                      {actionSuccessMessage}
                    </div>
                    <button 
                      onClick={() => setActionSuccessMessage(null)} 
                      className="absolute right-2 top-2 text-kreile-muted hover:text-slate-650 text-xs"
                    >
                      ✕
                    </button>
                  </div>
                )}
                
                {/* Dates & Urgency */}
                <div className="grid grid-cols-2 gap-3 bg-kreile-surface-soft p-3 rounded-lg border border-slate-100 text-xs">
                  <div>
                    <span className="text-kreile-muted block font-semibold text-[10px] uppercase">Eingang</span>
                    <span className="font-bold text-kreile-navy">{selectedOrder.intakeDate}</span>
                  </div>
                  <div>
                    <span className="text-kreile-muted block font-semibold text-[10px] uppercase">Liefertermin</span>
                    <span className="font-bold text-kreile-navy">{selectedOrder.dueDate}</span>
                  </div>
                </div>

                {/* Delay alerts */}
                {selectedOrder.delayReason && (
                  <div className="bg-orange-50 border border-orange-200 text-orange-950 p-3.5 rounded-lg flex items-start gap-2.5 text-xs">
                    <AlertTriangle className="h-4.5 w-4.5 text-orange-600 shrink-0 mt-0.5" />
                    <div>
                       <span className="font-extrabold uppercase text-[9px] tracking-wider text-orange-850">Störungsursache</span>
                      <p className="mt-0.5 font-medium leading-relaxed">{selectedOrder.delayReason}</p>
                    </div>
                  </div>
                )}

                {/* Actions Simulation Bar */}
                <div className="space-y-3 border-t pt-4">
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-kreile-muted uppercase tracking-wider block font-sans">Risiko-Status ändern (Sim)</span>
                    <div className="flex gap-1">
                      {(
                        [
                          { risk: "green", label: "Plan", color: "bg-emerald-500 hover:bg-emerald-600" },
                          { risk: "yellow", label: "Achtung", color: "bg-yellow-400 hover:bg-yellow-500" },
                          { risk: "orange", label: "Gefahr", color: "bg-orange-500 hover:bg-orange-600" },
                          { risk: "red", label: "Kritisch", color: "bg-red-500 hover:bg-red-600" },
                          { risk: "blocked", label: "Pause", color: "bg-kreile-surface-soft0 hover:bg-slate-600" }
                        ] as { risk: "green" | "yellow" | "orange" | "red" | "blocked"; label: string; color: string }[]
                      ).map(btn => (
                        <button
                          key={btn.risk}
                          onClick={() => handleStatusChange(selectedOrder.id, btn.risk)}
                          className={`flex-1 py-1.5 rounded text-[10px] text-center text-white font-bold transition-all border ${
                            selectedOrder.risk === btn.risk ? "ring-2 ring-kreile-navy border-white font-black" : "opacity-80 hover:opacity-100"
                          } ${btn.color}`}
                        >
                          {btn.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2 border-t pt-3">
                    <span className="text-[10px] font-bold text-kreile-muted uppercase tracking-wider block font-sans">Arbeitsstation ändern (Sim)</span>
                    <div className="grid grid-cols-5 gap-1">
                      {getAllStations().map(station => {
                        const labelMap: Record<string, string> = {
                          wareneingang: "1. WE",
                          entmetallisierung: "2. Entmet.",
                          schleiferei: "3. Schleif.",
                          beschichtung: "4. Galv.",
                          warenausgang: "5. WA"
                        };
                        const label = labelMap[station.key] || station.name;
                        return (
                          <button
                            key={station.key}
                            type="button"
                            onClick={() => handleStationUpdate(selectedOrder.id, station.key)}
                            className={`py-1.5 rounded text-[10px] text-center font-bold transition-all border ${
                              selectedOrder.station === station.key 
                                ? "bg-kreile-navy border-kreile-navy text-white font-black ring-1 ring-kreile-navy" 
                                : "bg-kreile-bg border-kreile-border text-kreile-muted hover:bg-kreile-sand"
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Associated parts */}
                <div className="space-y-3 border-t pt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-kreile-muted uppercase tracking-wider">Zugeordnete Werkstücke ({selectedOrder.parts.length})</span>
                  </div>

                  <div className="space-y-2">
                    {selectedOrder.parts.map(part => (
                      <div key={part.id} className="p-3 bg-kreile-surface-soft border rounded-lg flex items-center justify-between text-xs hover:border-kreile-gold-muted">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-kreile-navy">{part.name}</span>
                            <span className="font-mono text-[9px] bg-kreile-border text-kreile-muted px-1 rounded">{part.id}</span>
                          </div>
                          <p className="text-[10px] text-kreile-muted">
                            Ziel: <span className="font-semibold text-kreile-navy">{part.finish}</span> | Mat: {part.material}
                          </p>
                          <div className="flex items-center gap-1.5 text-[9px] text-kreile-navy font-bold mt-1">
                            <MapPin className="h-3 w-3 text-orange-500" /> {part.location}
                            <span className="text-kreile-muted">•</span>
                            <Package className="h-3 w-3 text-slate-450" /> Soll: {part.hours}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Touch actions with robust Phone Fallback Logic */}
                <div className="flex flex-col gap-2 pt-4 border-t">
                  {(() => {
                    const phoneDetails = getCustomerPhoneDetails(selectedOrder.customerName, selectedOrder.customerId);
                    if (phoneDetails.hasPhone) {
                      return (
                        <a 
                          href={`tel:${phoneDetails.phone}`}
                          className="w-full h-11 bg-white hover:bg-kreile-surface-soft text-kreile-navy font-bold border-2 border-kreile-border-strong rounded-xl flex items-center justify-center gap-2 text-xs shadow-sm transition-all"
                        >
                          <PhoneCall className="h-4 w-4 text-emerald-600 shrink-0" />
                          <span>Kunde anrufen ({phoneDetails.phone})</span>
                        </a>
                      );
                    } else {
                      return (
                        <Link 
                          href="/customers"
                          className="w-full h-11 bg-white hover:bg-kreile-surface-soft text-kreile-muted hover:text-kreile-navy font-semibold border-2 border-dashed border-kreile-border-strong hover:border-kreile-gold-muted rounded-xl flex items-center justify-center gap-2 text-xs transition-all text-center"
                        >
                          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                          <span>Telefonnummer in Kundenkartei prüfen</span>
                        </Link>
                      );
                    }
                  })()}
                  
                  {selectedOrder.recommendedAction && (
                    <Button 
                      onClick={() => handleRecommendedActionClick(selectedOrder)}
                      className="w-full h-11 bg-kreile-navy hover:bg-kreile-navy/90 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 shadow"
                    >
                      <Zap className="h-4 w-4 text-orange-450 shrink-0" />
                      <span>{selectedOrder.recommendedAction}</span>
                    </Button>
                  )}
                </div>

              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed border-2 border-kreile-border-strong text-center p-12 text-kreile-muted">
              <div className="w-12 h-12 bg-kreile-surface-soft rounded-full border border-slate-100 flex items-center justify-center mx-auto mb-3">
                <ChevronRight className="h-6 w-6 text-kreile-muted rotate-90" />
              </div>
              <p className="font-bold text-sm">Kein Auftrag selektiert</p>
              <p className="text-xs max-w-[200px] mx-auto mt-1">Klicke links auf einen Auftrag in der Liste, um seine Teile und Steuerung anzuzeigen.</p>
            </Card>
          )}
        </div>

      </div>

    </div>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={
      <div className="p-12 text-center text-kreile-muted space-y-3 max-w-md mx-auto">
        <RefreshCw className="h-8 w-8 mx-auto text-kreile-muted animate-spin" />
        <p className="font-extrabold text-kreile-navy">Lade Auftragsbuch...</p>
        <p className="text-xs text-kreile-muted">Die Werkstatt-Daten werden abgeglichen.</p>
      </div>
    }>
      <OrdersPageInner />
    </Suspense>
  );
}

