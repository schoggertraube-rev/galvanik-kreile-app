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
  CheckCircle2,
  Edit2
} from "lucide-react";
import { INITIAL_ORDERS, INITIAL_CUSTOMERS, MockOrder, MockCustomer } from "@/lib/mockData";
import { getStationConfig, getAllStations } from "@/constants/stations";
import { evaluateOrderPriority } from "@/lib/priority";
import { ordersRepository, type Order } from "@/lib/repositories/ordersRepository";
import { customersRepository, type Customer } from "@/lib/repositories/customersRepository";
import { getUrgency, Urgency } from "@/lib/orders/getUrgency";
import { OrderEditModal } from "@/components/orders/OrderEditModal";
import { PageHeader } from "@/components/ui/PageHeader";
import { SearchToolbar } from "@/components/ui/SearchToolbar";
import { ResponsiveDetailDrawer } from "@/components/ui/ResponsiveDetailDrawer";

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
  const [isEditingOrder, setIsEditingOrder] = useState(false);

  // Load from Repositories on mount
  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      try {
        const dbOrders = await ordersRepository.getAll();
        if (isMounted && dbOrders && dbOrders.length > 0) {
          setOrders(dbOrders as unknown as MockOrder[]);
        }
        
        const dbCustomers = await customersRepository.getAll();
        if (isMounted && dbCustomers && dbCustomers.length > 0) {
          setCustomersList(dbCustomers as unknown as MockCustomer[]);
        }
      } catch (e) {
        console.error("Fehler beim Laden aus Repositories", e);
      }
    };
    loadData();

    const handleSync = () => {
      console.log("[OrdersPage] Sync event received, reloading orders...");
      loadData();
    };

    window.addEventListener('kreile-sync-orders', handleSync);
    window.addEventListener('kreile-sync-focus', handleSync);

    return () => {
      isMounted = false;
      window.removeEventListener('kreile-sync-orders', handleSync);
      window.removeEventListener('kreile-sync-focus', handleSync);
    };
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

  const handleSaveOrder = async (changes: Partial<Order>) => {
    if (!selectedOrderId) return;
    try {
      const updatedOrder = await ordersRepository.updateOrder(selectedOrderId, changes);
      if (updatedOrder) {
        setOrders(prev => prev.map(o => o.id === selectedOrderId ? (updatedOrder as unknown as MockOrder) : o));
      }
    } catch (e: unknown) {
      console.error("Fehler beim Speichern der Auftragsdaten", e);
      throw e;
    }
  };

  // Find currently selected order
  const selectedOrder = orders.find(o => o.id === selectedOrderId) || null;

  if (selectedOrderId && !selectedOrder && process.env.NODE_ENV === "development") {
    console.warn("Selected order not found", { selectedOrderId, availableIds: orders.map(o => o.id) });
  }

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

    // 4. Verzug filter
    if (statusFilter === "verzug") {
      const u = getUrgency(o.dueDate);
      if (u !== "kritisch" && u !== "gefaehrdet") return false;
    }

    return true;
  });

  // Sort by urgency, then dueDate
  filteredOrders.sort((a, b) => {
    const ua = getUrgency(a.dueDate);
    const ub = getUrgency(b.dueDate);
    const score = { "kritisch": 0, "gefaehrdet": 1, "im_plan": 2 };
    if (score[ua] !== score[ub]) return score[ua] - score[ub];
    
    const da = new Date(a.dueDate || "9999-12-31").getTime();
    const db = new Date(b.dueDate || "9999-12-31").getTime();
    return da - db;
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
          { id: "verzug",  label: "Nur Verzug", count: orders.filter(o => { const u = getUrgency(o.dueDate); return u === "kritisch" || u === "gefaehrdet"; }).length },
        ]}
        activeFilter={statusFilter}
        onFilterChange={setStatusFilter}
      />

      {/* Main Content Layout */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-text-muted font-semibold px-1">
          <span>{filteredOrders.length} Aufträge an dieser Station</span>
          <span>Klicke für Details</span>
        </div>

        {filteredOrders.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
              let itemBg = "bg-white hover:bg-bg-app-soft/50";

              if (isRed) {
                borderStyle = `${evalRes.config.leftBorderClass} border-l-[8px] ring-1 ring-red-500/25`;
                badgeStyle = evalRes.config.badgeClass;
                itemBg = isSelected ? "bg-accent-orange-soft/50" : "bg-accent-orange-soft/50";
              } else if (isOrange) {
                borderStyle = `${evalRes.config.leftBorderClass} border-l-[6px]`;
                badgeStyle = evalRes.config.badgeClass;
                itemBg = isSelected ? "bg-gold-100/20" : "bg-white";
              } else if (isYellow) {
                borderStyle = `${evalRes.config.leftBorderClass} border-l-[6px]`;
                badgeStyle = evalRes.config.badgeClass;
                itemBg = isSelected ? "bg-gold-100/20" : "bg-white";
              } else if (isBlocked) {
                borderStyle = `${evalRes.config.leftBorderClass} border-l-4`;
                badgeStyle = evalRes.config.badgeClass;
                itemBg = isSelected ? "bg-neutral-gray-100/40" : "bg-bg-app-soft/70";
              }

              return (
                <Card
                  key={order.id}
                  onClickCapture={(e) => {
                    console.log("Card onClickCapture fired!", { id: order.id });
                    setSelectedOrderId(order.id);
                  }}
                  className={`transition-all duration-200 cursor-pointer border-neutral-gray-100 shadow-sm ${itemBg} ${borderStyle} ${
                    isSelected ? "ring-2 ring-navy-900 border-transparent shadow" : "hover:border-neutral-gray-300"
                  }`}
                >
                  <CardContent className="p-4 flex flex-col justify-between h-full gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {(() => {
                          const u = getUrgency(order.dueDate);
                          const dotColor = u === "kritisch" ? "bg-danger-red" : u === "gefaehrdet" ? "bg-accent-orange" : "bg-success-green";
                          return <div className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />;
                        })()}
                        <span className="font-mono font-extrabold text-navy-900 text-base">{order.orderNumber}</span>
                        <span className="text-xs text-text-muted">• {order.customerName}</span>
                      </div>
                      <Badge variant="outline" className={`text-[9px] font-bold tracking-wider py-0 px-1.5 w-fit ${badgeStyle}`}>
                        {order.statusText}
                      </Badge>
                      <h4 className="font-bold text-navy-900 text-sm md:text-base font-serif mt-2 line-clamp-2">{order.task}</h4>
                      <div className="flex items-center gap-3 text-xs text-text-muted font-semibold pt-0.5">
                        <span>Eingang: {order.intakeDate}</span>
                        <span>•</span>
                        <span>Teile: {order.parts?.length || 0}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-right shrink-0 border-t border-neutral-gray-100 pt-3 mt-2">
                      <div className="flex flex-col items-start">
                        <span className="text-[10px] text-text-muted font-bold uppercase">{order.dueLabel}</span>
                        <span className={`font-black text-lg ${isRed ? "text-danger-red" : isOrange ? "text-accent-orange" : "text-slate-750"}`}>
                          {order.dueValue}
                        </span>
                      </div>
                      <ChevronRight className={`h-5 w-5 transition-transform ${isSelected ? "text-navy-900 translate-x-1" : "text-text-muted"}`} />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="p-12 text-center text-text-muted bg-white border border-neutral-gray-300 rounded-xl space-y-2">
            <Package className="h-8 w-8 mx-auto text-text-muted animate-pulse" />
            <p className="font-bold text-text-muted">Keine Aufträge in dieser Station</p>
            <p className="text-xs">Ändere den Filter, passe den Suchbegriff an oder wähle eine andere Station.</p>
          </div>
        )}
      </div>

      {/* Detail Drawer */}
      {selectedOrder && (
        <ResponsiveDetailDrawer
          isOpen={!!selectedOrderId}
          onClose={() => setSelectedOrderId(null)}
          title={`Auftrag ${selectedOrder.orderNumber}`}
        >
          <div className="space-y-5 relative">
            <button
              onClick={() => setIsEditingOrder(true)}
              className="absolute right-0 -top-10 text-navy-900/70 hover:text-navy-900 transition-colors bg-white/80 p-2 rounded-full"
              title="Auftrag bearbeiten"
            >
              <Edit2 className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2">
              <Badge className="bg-navy-700 text-white border-0 text-[8px] font-bold uppercase tracking-wider py-0.5">
                Station: {getStationConfig(selectedOrder.station).name.toUpperCase()}
              </Badge>
            </div>
            <h3 className="font-black text-xl leading-tight text-navy-900">{selectedOrder.task}</h3>
            <p className="text-sm text-text-muted font-medium">Kunde: {selectedOrder.customerName || "Unbekannter Kunde"}</p>

            {actionSuccessMessage && (
              <div className="bg-success-green-soft border border-success-green p-3.5 rounded-xl text-success-green text-xs font-semibold flex items-start gap-2.5 relative">
                <CheckCircle2 className="h-4.5 w-4.5 text-success-green shrink-0 mt-0.5" />
                <div className="pr-6 leading-relaxed">
                  <span className="font-extrabold uppercase text-[9px] tracking-wide text-success-green block">Systemmeldung</span>
                  {actionSuccessMessage}
                </div>
                <button 
                  onClick={() => setActionSuccessMessage(null)} 
                  className="absolute right-2 top-2 text-text-muted hover:text-slate-650 text-xs"
                >
                  ✕
                </button>
              </div>
            )}
            
            {/* Dates & Urgency */}
            <div className="grid grid-cols-2 gap-3 bg-bg-app-soft p-3 rounded-lg border border-neutral-gray-100 text-xs">
              <div>
                <span className="text-text-muted block font-semibold text-[10px] uppercase">Eingang</span>
                <span className="font-bold text-navy-900">{selectedOrder.intakeDate || "Kein Datum"}</span>
              </div>
              <div>
                <span className="text-text-muted block font-semibold text-[10px] uppercase">Liefertermin</span>
                <span className="font-bold text-navy-900">{selectedOrder.dueDate || "Nicht gesetzt"}</span>
              </div>
            </div>

            {/* Parts / Werkstücke */}
            {selectedOrder.parts && selectedOrder.parts.length > 0 && (
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block font-sans">Zu bearbeitende Teile</span>
                <div className="bg-white border border-neutral-gray-100 rounded-lg overflow-hidden divide-y divide-neutral-gray-100">
                  {selectedOrder.parts.map((p, i) => (
                    <div key={i} className="p-3 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-3">
                        <span className="bg-navy-900 text-white font-mono text-[10px] px-2 py-0.5 rounded font-bold">
                          {p.quantity}x
                        </span>
                        <span className="font-bold text-navy-900">{p.name || "Unbekanntes Teil"}</span>
                      </div>
                      {p.surfaceRequested && (
                        <span className="text-[10px] font-mono bg-bg-app-soft text-text-muted px-2 py-1 rounded">
                          {p.surfaceRequested}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Delay alerts */}
            {selectedOrder.delayReason && (
              <div className="bg-gold-100 border border-accent-orange text-accent-orange p-3.5 rounded-lg flex items-start gap-2.5 text-xs">
                <AlertTriangle className="h-4.5 w-4.5 text-accent-orange shrink-0 mt-0.5" />
                <div>
                   <span className="font-extrabold uppercase text-[9px] tracking-wider text-accent-orange">Störungsursache</span>
                  <p className="mt-0.5 font-medium leading-relaxed">{selectedOrder.delayReason}</p>
                </div>
              </div>
            )}

            {/* Actions Simulation Bar */}
            <div className="space-y-3 border-t pt-4">
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block font-sans">Risiko-Status ändern</span>
                <div className="flex gap-1 flex-wrap">
                  {(
                    [
                      { risk: "green", label: "Plan", color: "bg-success-green-soft0 hover:bg-success-green" },
                      { risk: "yellow", label: "Achtung", color: "bg-yellow-400 hover:bg-gold-1000" },
                      { risk: "orange", label: "Gefahr", color: "bg-gold-1000 hover:bg-orange-600" },
                      { risk: "red", label: "Kritisch", color: "bg-accent-orange-soft0 hover:bg-danger-red" },
                      { risk: "blocked", label: "Pause", color: "bg-bg-app-soft0 hover:bg-gold-1000" }
                    ] as { risk: "green" | "yellow" | "orange" | "red" | "blocked"; label: string; color: string }[]
                  ).map(btn => (
                    <button
                      key={btn.risk}
                      onClick={() => handleStatusChange(selectedOrder.id, btn.risk)}
                      className={`flex-1 min-w-[60px] py-2.5 rounded text-xs text-center text-white font-bold transition-all border ${
                        selectedOrder.risk === btn.risk ? "ring-2 ring-navy-900 border-white font-black scale-105" : "opacity-80 hover:opacity-100"
                      } ${btn.color}`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2 border-t pt-3">
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block font-sans">Arbeitsstation ändern</span>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
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
                        className={`py-2 rounded text-xs text-center font-bold transition-all border ${
                          selectedOrder.station === station.key 
                            ? "bg-navy-900 border-navy-900 text-white font-black ring-1 ring-navy-900" 
                            : "bg-bg-app border-neutral-gray-100 text-text-muted hover:bg-gold-100"
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
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Zugeordnete Werkstücke ({(selectedOrder.parts || []).length})</span>
              </div>

              <div className="space-y-2">
                {(selectedOrder.parts || []).map(part => (
                  <div key={part.id} className="p-3 bg-bg-app-soft border rounded-lg flex flex-col gap-1 text-xs hover:border-gold-600 transition-colors">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-navy-900">{part.name}</span>
                      <span className="font-mono text-[9px] bg-neutral-gray-100 text-text-muted px-1 rounded">{part.id}</span>
                    </div>
                    <p className="text-[10px] text-text-muted">
                      Ziel: <span className="font-semibold text-navy-900">{part.finish}</span> | Mat: {part.material}
                    </p>
                    <div className="flex items-center gap-1.5 text-[9px] text-navy-900 font-bold mt-1">
                      <MapPin className="h-3 w-3 text-accent-orange" /> {part.location}
                      <span className="text-text-muted">•</span>
                      <Package className="h-3 w-3 text-slate-450" /> Soll: {part.hours}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Touch actions with robust Phone Fallback Logic */}
            <div className="flex flex-col gap-3 pt-6 border-t pb-4">
              {(() => {
                const phoneDetails = getCustomerPhoneDetails(selectedOrder.customerName, selectedOrder.customerId);
                if (phoneDetails.hasPhone) {
                  return (
                    <a 
                      href={`tel:${phoneDetails.phone}`}
                      className="w-full h-12 bg-white hover:bg-bg-app-soft text-navy-900 font-bold border-2 border-neutral-gray-300 rounded-xl flex items-center justify-center gap-2 text-sm shadow-sm transition-all"
                    >
                      <PhoneCall className="h-5 w-5 text-success-green shrink-0" />
                      <span>Kunde anrufen ({phoneDetails.phone})</span>
                    </a>
                  );
                } else {
                  return (
                    <Link 
                      href="/customers"
                      className="w-full h-12 bg-white hover:bg-bg-app-soft text-text-muted hover:text-navy-900 font-semibold border-2 border-dashed border-neutral-gray-300 hover:border-gold-600 rounded-xl flex items-center justify-center gap-2 text-sm transition-all text-center"
                    >
                      <AlertTriangle className="h-5 w-5 text-gold-600 shrink-0" />
                      <span>Telefonnummer in Kundenkartei prüfen</span>
                    </Link>
                  );
                }
              })()}
              
              {selectedOrder.recommendedAction && (
                <Button 
                  onClick={() => handleRecommendedActionClick(selectedOrder)}
                  className="w-full h-12 bg-navy-900 hover:bg-navy-900/90 text-white font-extrabold text-sm rounded-xl flex items-center justify-center gap-2 shadow"
                >
                  <Zap className="h-5 w-5 text-accent-orange shrink-0" />
                  <span>{selectedOrder.recommendedAction}</span>
                </Button>
              )}
            </div>
          </div>
        </ResponsiveDetailDrawer>
      )}

      {isEditingOrder && selectedOrder && (
        <OrderEditModal
          order={selectedOrder as unknown as Order}
          customers={customersList as unknown as Customer[]}
          onClose={() => setIsEditingOrder(false)}
          onSave={handleSaveOrder}
        />
      )}
    </div>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={
      <div className="p-12 text-center text-text-muted space-y-3 max-w-md mx-auto">
        <RefreshCw className="h-8 w-8 mx-auto text-text-muted animate-spin" />
        <p className="font-extrabold text-navy-900">Lade Auftragsbuch...</p>
        <p className="text-xs text-text-muted">Die Werkstatt-Daten werden abgeglichen.</p>
      </div>
    }>
      <OrdersPageInner />
    </Suspense>
  );
}

