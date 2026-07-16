"use client";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { BackButton } from "@/components/ui/BackButton";
import { trackUiEvent } from "@/lib/tracking/tracking";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
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
// Mock data removed
import { getStationConfig, getAllStations } from "@/constants/stations";
import { getOrdersDb } from "@/app/actions/orders.actions";
import { getCustomersDb } from "@/app/actions/customers.actions";
import type { Customer } from "@/lib/types/customer";
import type { OrderResponse } from "@/app/actions/orders.actions";

type Order = any; // Fallback since Order was from repo
import { usePageView } from "@/hooks/usePageView";
import { OrderWideCard, type UrgencyType } from "@/components/orders/OrderWideCard";
import { useAppShortcut } from "@/components/ui/AppShortcutContext";
import { useOrderModal } from "@/components/orders/OrderModalProvider";
import { getUrgency } from "@/lib/orders/getUrgency";

const safe = (value: unknown) => String(value ?? "").toLowerCase();


function OrdersPageInner() {
  usePageView();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { openShortcut } = useAppShortcut();
  const stationFilter = searchParams.get("station");
  const [searchTerm, setSearchTerm] = useState("");
  
  const statusParam = searchParams.get("status") || searchParams.get("filter");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [surfaceFilter, setSurfaceFilter] = useState<string | null>(null);
  const [prevStatusParam, setPrevStatusParam] = useState<string | null>(null);

  if (statusParam !== prevStatusParam) {
    setPrevStatusParam(statusParam);
    if (statusParam && ["all", "waiting", "critical", "active"].includes(statusParam)) {
      setStatusFilter(statusParam);
    }
  }

  const [orders, setOrders] = useState<Order[]>([]);

  const [customersList, setCustomersList] = useState<Customer[]>([]);
  
  const { openOrder } = useOrderModal();

  // Load from Repositories on mount
  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      try {
        const dbOrdersResult = await getOrdersDb();
        if (dbOrdersResult && !dbOrdersResult.ok && dbOrdersResult.error === "UNAUTHORIZED") {
          router.push("/start?reason=session_expired");
          return;
        }
        if (isMounted && dbOrdersResult.ok) {
          setOrders(dbOrdersResult.data as any);
      console.log("[ORDERS_CLIENT]", (dbOrdersResult.data as any).map((o:any)=>({id:o.id, number:o.orderNumber, source:o.source})) );
        }
        
        const dbCustomersResult = await getCustomersDb();
        if (dbCustomersResult && !dbCustomersResult.ok && dbCustomersResult.error === "UNAUTHORIZED") {
          router.push("/start?reason=session_expired");
          return;
        }
        if (isMounted && dbCustomersResult.ok) {
          setCustomersList(dbCustomersResult.data as any);
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
  }, [router]);

  // Wait... we don't need selected order locally anymore!

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

    // 5. Surface filter
    if (surfaceFilter) {
      const text = (o.task + " " + (o.parts?.map((p: any) => p.surfaceRequested || p.finish).join(" ") || "")).toLowerCase();
      if (!text.includes(surfaceFilter.toLowerCase())) return false;
    }

    return true;
  });

  const counts = {
    red: orders.filter(o => o.risk === 'red').length,
    orange: orders.filter(o => o.risk === 'orange').length,
    blocked: orders.filter(o => o.risk === 'blocked').length,
    green: orders.filter(o => o.risk === 'green' || o.risk === 'yellow').length,
  };

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

  // Datensparsame Suchmessung: niemals Suchtext oder Entitäts-IDs übertragen.
  useEffect(() => {
    const queryLength = searchTerm.trim().length;
    if (queryLength === 0) return;
    const timer = setTimeout(() => {
      trackUiEvent("search", {
        target: "orders",
        queryLength,
        resultCount: filteredOrders.length,
        outcome: filteredOrders.length === 0 ? "empty" : "success",
      });
    }, 800);
    return () => clearTimeout(timer);
  }, [searchTerm, statusFilter, stationFilter, surfaceFilter, filteredOrders.length]);

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
    <div className="pb-12 max-w-[1400px] mx-auto px-4 md:px-6 mt-6 font-sans">
      <div className="mb-6">
        <Breadcrumb items={[{label:'Home',href:'/'}, {label:'Orders',href:'/orders'}]} />
        <BackButton label="Home" href="/" />
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        .topbar { display: flex; align-items: center; height: 44px; margin-bottom: 16px; }
        .top-tabs { display: flex; background: #faf8f4; border: 1.5px solid #d8d0c4; border-radius: 24px; padding: 3px; }
        .top-tab { padding: 6px 18px; border-radius: 20px; font-size: 13px; font-weight: 600; border: none; cursor: pointer; background: transparent; color: #5e5850; transition: all 0.15s; }
        .top-tab.active { background: #2c2c2c; color: #fff; }
        .topbar-title { flex: 1; text-align: center; font-size: 16px; font-weight: 700; letter-spacing: 0.5px; color: #1a1a1a; }
        .btn-new { padding: 7px 18px; background: #2c2c2c; color: #fff; border: none; border-radius: 20px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.15s; }
        .btn-new:hover { background: #444; }

        .status-strip { display: flex; gap: 3px; height: 10px; border-radius: 5px; overflow: hidden; margin-bottom: 14px; }
        .status-strip div { border-radius: 5px; transition: flex 0.3s; }
        .sr { background: #c0392b; }
        .sa { background: #d4850a; }
        .sb { background: #2471a3; }
        .sg { background: #1e7e45; }

        .filter-row { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
        .search-box { width: 240px; padding: 8px 14px 8px 36px; border: 1.5px solid #d8d0c4; border-radius: 10px; background: #faf8f4; font-size: 13px; color: #1a1a1a; outline: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' fill='%239e9689' viewBox='0 0 16 16'%3E%3Cpath d='M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85zm-5.242.156a5 5 0 1 1 0-10 5 5 0 0 1 0 10z'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: 12px center; transition: border-color 0.15s; }
        .search-box:focus { border-color: #b0a898; }
        .search-box::placeholder { color: #9e9689; }

        .sep { width: 1px; height: 24px; background: #d8d0c4; margin: 0 2px; }

        .f-pill { display: flex; align-items: center; gap: 5px; padding: 6px 12px; border: 1.5px solid #d8d0c4; border-radius: 18px; background: #faf8f4; font-size: 12px; font-weight: 500; color: #5e5850; cursor: pointer; transition: all 0.15s; white-space: nowrap; }
        .f-pill:hover { border-color: #b0a898; }
        .f-pill.active { background: #2c2c2c; color: #fff; border-color: #2c2c2c; }
        .pdot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
        .f-pill.active .pdot { box-shadow: 0 0 0 2px rgba(255,255,255,0.25); }
        .pcnt { font-family: 'JetBrains Mono', monospace; font-size: 10px; font-weight: 700; background: rgba(0,0,0,0.06); padding: 1px 6px; border-radius: 8px; }
        .f-pill.active .pcnt { background: rgba(255,255,255,0.18); }

        .sdot-f { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; border: 1px solid rgba(0,0,0,0.12); }
        .sf-zink { background: linear-gradient(135deg, #8a9ea8, #b0c4ce); }
        .sf-chrom { background: linear-gradient(135deg, #c0c0c0, #eaeaea); }
        .sf-nickel { background: linear-gradient(135deg, #b0a890, #d4c9a8); }
        .sf-gold { background: linear-gradient(135deg, #d4a017, #f0d060); }
        .sf-kupfer { background: linear-gradient(135deg, #b87333, #da9a5b); }

        .count-line { font-size: 12px; color: #9e9689; margin-bottom: 10px; font-weight:500; }
        
        .card-list { display: flex; flex-direction: column; gap: 8px; }
      `}} />

      <div className="topbar hidden sm:flex">
        <div className="top-tabs">
          <button className="top-tab active">Alle Aufträge</button>
          <button className="top-tab" onClick={() => window.location.href='/customers'}>Kundenkartei</button>
        </div>
        <div className="topbar-title">{getStationHeadline()}</div>
        <button className="btn-new" onClick={() => openShortcut("new_order")}>+ Neuer Auftrag</button>
      </div>
      
      {/* Mobile topbar fallback */}
      <div className="flex sm:hidden justify-between items-center mb-4">
        <div className="font-bold text-lg">{getStationHeadline()}</div>
        <button className="btn-new py-1.5 px-3 text-xs" onClick={() => openShortcut("new_order")}>+ Neu</button>
      </div>

      <div className="status-strip">
        <div className="sr" style={{ flex: counts.red || 0.1 }}></div>
        <div className="sa" style={{ flex: counts.orange || 0.1 }}></div>
        <div className="sb" style={{ flex: counts.blocked || 0.1 }}></div>
        <div className="sg" style={{ flex: counts.green || 0.1 }}></div>
      </div>

      <div className="filter-row">
        <input 
          className="search-box" 
          type="text" 
          placeholder="Suchen nach Auftragsnummer, Kunde..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        
        <button className={`f-pill ${statusFilter === 'all' ? 'active' : ''}`} onClick={() => setStatusFilter('all')}>
          Alle <span className="pcnt">{orders.length}</span>
        </button>
        <button className={`f-pill ${statusFilter === 'critical' ? 'active' : ''}`} onClick={() => setStatusFilter('critical')}>
          <span className="pdot" style={{background: '#c0392b'}}></span> Überfällig <span className="pcnt">{counts.red}</span>
        </button>
        <button className={`f-pill ${statusFilter === 'verzug' ? 'active' : ''}`} onClick={() => setStatusFilter('verzug')}>
          <span className="pdot" style={{background: '#d4850a'}}></span> Diese Woche <span className="pcnt">{counts.orange}</span>
        </button>
        <button className={`f-pill ${statusFilter === 'waiting' ? 'active' : ''}`} onClick={() => setStatusFilter('waiting')}>
          <span className="pdot" style={{background: '#2471a3'}}></span> Wartend <span className="pcnt">{counts.blocked}</span>
        </button>

        <div className="sep hidden md:block"></div>

        <button className={`f-pill ${surfaceFilter === 'zink' ? 'active' : ''} hidden md:flex`} onClick={() => setSurfaceFilter(surfaceFilter === 'zink' ? null : 'zink')}>
          <span className="sdot-f sf-zink"></span> Zink
        </button>
        <button className={`f-pill ${surfaceFilter === 'chrom' ? 'active' : ''} hidden md:flex`} onClick={() => setSurfaceFilter(surfaceFilter === 'chrom' ? null : 'chrom')}>
          <span className="sdot-f sf-chrom"></span> Chrom
        </button>
        <button className={`f-pill ${surfaceFilter === 'nickel' ? 'active' : ''} hidden md:flex`} onClick={() => setSurfaceFilter(surfaceFilter === 'nickel' ? null : 'nickel')}>
          <span className="sdot-f sf-nickel"></span> Nickel
        </button>
      </div>

      <div className="count-line">{filteredOrders.length} Aufträge gefunden</div>

      {filteredOrders.length > 0 ? (
        <div className="card-list">
          {filteredOrders.map((order) => {
            const u = getUrgency(order.dueDate);
            let urgencyType: UrgencyType = "ok";
            if (order.risk === "red") urgencyType = "crit";
            else if (order.risk === "orange" || u === "gefaehrdet") urgencyType = "soon";
            else if (order.risk === "blocked") urgencyType = "wait";

            const textForSurface = (order.task + " " + (order.parts?.map((p: any) => p.surfaceRequested || p.finish).join(" ") || "")).toLowerCase();
            let surfaceKey: "chrom" | "nickel" | "gold" | "kupfer" | "zink" | "offen" = "offen";
            if (textForSurface.includes("chrom")) surfaceKey = "chrom";
            else if (textForSurface.includes("nickel")) surfaceKey = "nickel";
            else if (textForSurface.includes("gold")) surfaceKey = "gold";
            else if (textForSurface.includes("kupfer")) surfaceKey = "kupfer";
            else if (textForSurface.includes("zink")) surfaceKey = "zink";

            let surfaceLabel = surfaceKey !== "offen" ? surfaceKey.charAt(0).toUpperCase() + surfaceKey.slice(1) : "Oberfläche offen";
            if (surfaceKey === "chrom") surfaceLabel = "Vernickeln → Chrom";
            if (surfaceKey === "zink") surfaceLabel = "Verzinken";

            return (
              <OrderWideCard
                key={order.id}
                id={order.id}
                orderNumber={order.orderNumber}
                customerName={order.customerName || "Kunde nicht hinterlegt"}
                article={order.task || ""}
                surface={surfaceLabel}
                surfaceKey={surfaceKey}
                badgeText={order.statusText}
                urgency={urgencyType}
                dueValue={order.dueValue || "14 T"}
                dueLabel={order.dueLabel || "Fällig in"}
                onClick={() => {
                  trackUiEvent("detail_open", { target: "order" });
                  openOrder(order.id);
                }}
              />
            );
          })}
        </div>
      ) : (
        <div className="p-12 text-center text-text-muted bg-[#faf8f4] border border-[#d8d0c4] rounded-xl space-y-2 mt-4">
          <Package className="h-8 w-8 mx-auto text-[#9e9689] animate-pulse" />
          <p className="font-bold text-[#5e5850]">Noch keine Aufträge erfasst</p>
          <p className="text-xs">Passe den Filter oder den Suchbegriff an.</p>
        </div>
      )}

      {/* Detail Overlay removed and centralized */}
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
