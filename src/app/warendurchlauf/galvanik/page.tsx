"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight, Layers, PlayCircle, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { ordersRepository } from "@/lib/repositories/ordersRepository";
import { OrderCompactCard, UrgencyType } from "@/components/orders/OrderCompactCard";
import { useOrderModal } from "@/components/orders/OrderModalProvider";
import { getStationOrders, getStationReadyOrders, startProcessingStation } from "@/app/warendurchlauf/actions";
import type { WarendurchlaufOrder } from "@/app/warendurchlauf/actions";

type GalvanikBucket = "ready" | "in_progress" | "finished";
type GalvanikOrder = WarendurchlaufOrder & { statusText?: string };

function sortByUrgency(orders: GalvanikOrder[]) {
  const priorityRank: Record<string, number> = {
    red: 0,
    orange: 1,
    yellow: 2,
    green: 3,
    blocked: 4,
  };
  return [...orders].sort((a, b) => {
    const aRank = priorityRank[a.risk] ?? 5;
    const bRank = priorityRank[b.risk] ?? 5;
    return aRank - bRank;
  });
}

function mapRiskToUrgency(risk: string): UrgencyType {
  if (risk === "red") return "crit";
  if (risk === "orange" || risk === "yellow") return "soon";
  if (risk === "blocked") return "wait";
  return "ok";
}

export default function GalvanikPage() {
  const [activeBucket, setActiveBucket] = useState<GalvanikBucket>("ready");
  const [readyOrders, setReadyOrders] = useState<GalvanikOrder[]>([]);
  const [inProgressOrders, setInProgressOrders] = useState<GalvanikOrder[]>([]);
  const [finishedOrders, setFinishedOrders] = useState<GalvanikOrder[]>([]);
  const [topUrgent, setTopUrgent] = useState<GalvanikOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { openOrder } = useOrderModal();

  useEffect(() => {
    async function load() {
      try {
        const [resReady, resActive] = await Promise.all([
          getStationReadyOrders("galvanik"),
          getStationOrders("galvanik")
        ]);
        
        let ready: GalvanikOrder[] = [];
        if (resReady.ok && resReady.data) {
          ready = sortByUrgency(resReady.data);
        }
        
        let active: GalvanikOrder[] = [];
        let done: GalvanikOrder[] = [];
        if (resActive.ok && resActive.data) {
          const allActive = resActive.data;
          active = sortByUrgency(allActive.filter(o => o.status === "in_progress"));
          done = sortByUrgency(allActive.filter(o => o.status === "done" || o.status === "quality_check"));
        }
        
        setReadyOrders(ready);
        setInProgressOrders(active);
        setFinishedOrders(done);
        
        const combined = [...ready, ...active, ...done];
        setTopUrgent(sortByUrgency(combined).filter(o => o.risk === "red" || o.risk === "orange").slice(0, 3));

      } catch (err) {
        console.error("Failed to load orders in Galvanik", err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  const handleAdvance = async (e: React.MouseEvent, orderId: string, currentBucket: GalvanikBucket) => {
    e.stopPropagation();
    
    if (currentBucket === "ready") {
      // Move to in progress
      const order = readyOrders.find(o => o.id === orderId);
      if (order) {
         setReadyOrders(prev => prev.filter(o => o.id !== orderId));
         setInProgressOrders(prev => sortByUrgency([...prev, { ...order, status: "in_progress", statusText: "In Bearbeitung" }]));
         await startProcessingStation(orderId, "galvanik");
      }
    } else if (currentBucket === "in_progress") {
      // Move to warenausgang via existing repo locally for demo
      const order = inProgressOrders.find(o => o.id === orderId);
      if (order) {
        setInProgressOrders(prev => prev.filter(o => o.id !== orderId));
        await ordersRepository.updateOrder(orderId, { station: "warenausgang", status: "ready" });
      }
    }
  };

  const renderOrderList = (orders: GalvanikOrder[], bucket: GalvanikBucket) => {
    const isActive = activeBucket === bucket;
    return (
      <div className={`flex flex-col gap-3 transition-all duration-500 ${isActive ? 'opacity-100' : ''}`}>
        {orders.length === 0 ? (
          <div className="text-xs text-[#9e9689] italic p-4 border border-dashed border-[#d8d0c4] rounded-[14px] text-center">
            {isActive ? "Keine Aufträge in dieser Kategorie" : "-"}
          </div>
        ) : (
          orders.map((o) => (
            <OrderCompactCard
              key={o.id}
              id={o.id}
              orderNumber={o.orderNumber}
              customerName={o.customerName || "Kunde nicht hinterlegt"}
              article={o.itemDescription || "Artikel nicht hinterlegt"}
              surface={o.surfaceRequested || "Oberfläche nicht hinterlegt"}
              urgency={mapRiskToUrgency(o.risk)}
              dueValue={o.dueValue || "--"}
              dueLabel={o.dueLabel || "Tage"}
              badgeText={o.statusText || o.status}
              onClick={() => isActive ? openOrder(o.id) : setActiveBucket(bucket)}
              onAdvance={isActive ? (e) => handleAdvance(e, o.id, bucket) : undefined}
            />
          ))
        )}
      </div>
    );
  };

  return (
    <div className="w-full h-full font-sans antialiased text-[#1a1a1a] pb-16">
      <div className="w-full mx-auto px-5 md:px-8 lg:px-12 xl:px-16 py-6">

        {/* Titel */}
        <div className="text-[13px] font-bold text-[#5e5850] mb-6 flex items-center gap-2">
          Galvanik Bearbeitung
          <span className="flex-1 h-px bg-[#d8d0c4]" />
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-[#9e9689]">
            <Loader2 className="w-8 h-8 animate-spin mb-4" />
            <p>Lade Galvanik Aufträge...</p>
          </div>
        ) : (
          <>

            {/* Top Urgent */}
            {topUrgent.length > 0 && (
              <div className="mb-8 bg-[#fdf0ee] border border-[#c0392b]/20 p-4 rounded-[14px]">
                <div className="flex items-center gap-2 text-[#c0392b] font-bold text-sm mb-3">
                  <AlertTriangle className="w-4 h-4" /> Dringlich in Galvanik
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {topUrgent.map(o => (
                    <OrderCompactCard
                      key={`urg-${o.id}`}
                      id={o.id}
                      orderNumber={o.orderNumber}
                      customerName={o.customerName || "Kunde nicht hinterlegt"}
                      article={o.itemDescription || "Artikel nicht hinterlegt"}
                      surface={o.surfaceRequested || "Oberfläche nicht hinterlegt"}
                      urgency={mapRiskToUrgency(o.risk)}
                      dueValue={o.dueValue || "--"}
                      dueLabel={o.dueLabel || "Tage"}
                      badgeText={o.statusText || o.status}
                      onClick={() => openOrder(o.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Buckets Header */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <button
                onClick={() => setActiveBucket("ready")}
                className={`flex flex-row items-center gap-3 p-3 rounded-[14px] cursor-pointer transition-all text-left ${activeBucket === "ready"
                    ? "bg-[#e6f4ea] border-2 border-[#1a6b38] shadow-md transform scale-[1.02]"
                    : "bg-[#faf8f4] border-[1.5px] border-[#d8d0c4] hover:bg-[#f4f0e8] opacity-70"
                  }`}
              >
                <div className={`w-8 h-8 rounded-[8px] shrink-0 flex items-center justify-center ${activeBucket === "ready" ? "bg-white" : "bg-[#fef3e2]"}`}>
                  <Layers className={`w-4 h-4 ${activeBucket === "ready" ? "text-[#1a6b38]" : "text-[#c8922a]"}`} />
                </div>
                <div className="flex flex-col flex-1 min-w-0">
                  <span className={`text-[13px] font-bold truncate ${activeBucket === "ready" ? "text-[#1a6b38]" : "text-[#1a1a1a]"}`}>Bereit</span>
                  <span className="text-[10px] text-[#9e9689]">{readyOrders.length} Aufträge</span>
                </div>
              </button>

              <button
                onClick={() => setActiveBucket("in_progress")}
                className={`flex flex-row items-center gap-3 p-3 rounded-[14px] cursor-pointer transition-all text-left ${activeBucket === "in_progress"
                    ? "bg-[#e6f4ea] border-2 border-[#1a6b38] shadow-md transform scale-[1.02]"
                    : "bg-[#faf8f4] border-[1.5px] border-[#d8d0c4] hover:bg-[#f4f0e8] opacity-70"
                  }`}
              >
                <div className={`w-8 h-8 rounded-[8px] shrink-0 flex items-center justify-center ${activeBucket === "in_progress" ? "bg-white" : "bg-[#e6f4ea]"}`}>
                  <PlayCircle className={`w-4 h-4 ${activeBucket === "in_progress" ? "text-[#1a6b38]" : "text-[#1a6b38]"}`} />
                </div>
                <div className="flex flex-col flex-1 min-w-0">
                  <span className={`text-[13px] font-bold truncate ${activeBucket === "in_progress" ? "text-[#1a6b38]" : "text-[#1a1a1a]"}`}>In Bearbeitung</span>
                  <span className="text-[10px] text-[#9e9689]">{inProgressOrders.length} Aufträge</span>
                </div>
              </button>

              <button
                onClick={() => setActiveBucket("finished")}
                className={`flex flex-row items-center gap-3 p-3 rounded-[14px] cursor-pointer transition-all text-left ${activeBucket === "finished"
                    ? "bg-[#e6f4ea] border-2 border-[#1a6b38] shadow-md transform scale-[1.02]"
                    : "bg-[#faf8f4] border-[1.5px] border-[#d8d0c4] hover:bg-[#f4f0e8] opacity-70"
                  }`}
              >
                <div className={`w-8 h-8 rounded-[8px] shrink-0 flex items-center justify-center ${activeBucket === "finished" ? "bg-white" : "bg-[#fef3e2]"}`}>
                  <CheckCircle2 className={`w-4 h-4 ${activeBucket === "finished" ? "text-[#1a6b38]" : "text-[#c8922a]"}`} />
                </div>
                <div className="flex flex-col flex-1 min-w-0">
                  <span className={`text-[13px] font-bold truncate ${activeBucket === "finished" ? "text-[#1a6b38]" : "text-[#1a1a1a]"}`}>Fertig (QS)</span>
                  <span className="text-[10px] text-[#9e9689]">{finishedOrders.length} Aufträge</span>
                </div>
              </button>

              <Link
                href="/warendurchlauf/warenausgang?context=readyFromGalvanik"
                className="flex flex-row items-center gap-3 p-3 rounded-[14px] cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md text-white opacity-90 hover:opacity-100"
                style={{ background: "#1a6b38", border: "1.5px solid #1a6b38" }}
              >
                <div className="w-8 h-8 rounded-[8px] shrink-0 bg-white/15 flex items-center justify-center">
                  <ArrowRight className="w-4 h-4 text-white" />
                </div>
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="text-[13px] font-bold truncate">Warenausgang</span>
                  <span className="text-[10px] text-white/60">Aktion</span>
                </div>
              </Link>
            </div>

            {/* Listen Bereich (3 Spalten mit Verdrängungslogik) */}
            <div className="flex gap-3 overflow-x-auto snap-x md:grid md:grid-cols-3 md:overflow-visible w-full pb-4">
              <div className={`transition-all duration-500 ease-in-out snap-center min-w-[85vw] md:min-w-0 ${activeBucket === "ready" ? "w-full md:w-[80%]" : "w-full md:w-[10%] opacity-50 grayscale-[0.8]"}`}>
                <h3 className="text-sm font-bold text-[#9e9689] uppercase tracking-wider mb-4 border-b border-[#d8d0c4] pb-2 truncate">Bereit</h3>
                {renderOrderList(readyOrders, "ready")}
              </div>
              <div className={`transition-all duration-500 ease-in-out snap-center min-w-[85vw] md:min-w-0 ${activeBucket === "in_progress" ? "w-full md:w-[80%]" : "w-full md:w-[10%] opacity-50 grayscale-[0.8]"}`}>
                <h3 className="text-sm font-bold text-[#9e9689] uppercase tracking-wider mb-4 border-b border-[#d8d0c4] pb-2 truncate">In Bearbeitung</h3>
                {renderOrderList(inProgressOrders, "in_progress")}
              </div>
              <div className={`transition-all duration-500 ease-in-out snap-center min-w-[85vw] md:min-w-0 ${activeBucket === "finished" ? "w-full md:w-[80%]" : "w-full md:w-[10%] opacity-50 grayscale-[0.8]"}`}>
                <h3 className="text-sm font-bold text-[#9e9689] uppercase tracking-wider mb-4 border-b border-[#d8d0c4] pb-2 truncate">Fertig (QS)</h3>
                {renderOrderList(finishedOrders, "finished")}
              </div>
            </div>

            {/* Demo Tag Removed */}

          </>
        )}

      </div>
    </div>
  );
}
