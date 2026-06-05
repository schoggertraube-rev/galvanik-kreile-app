"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowRight, Layers, PlayCircle, CheckCircle2, AlertTriangle } from "lucide-react";
import { INITIAL_ORDERS, MockOrder } from "@/lib/mockData";
import { OrderWideCard, UrgencyType } from "@/components/orders/OrderWideCard";

type GalvanikBucket = "ready" | "in_progress" | "finished";

function sortByUrgency(orders: MockOrder[]) {
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
  const [activeBucket, setActiveBucket] = useState<GalvanikBucket>("in_progress");

  // Get orders in Beschichtung/Galvanik (we also include some global ones for demo)
  const galvanikOrders = INITIAL_ORDERS.filter(o => o.station === "beschichtung" || o.station === "galvanik" || o.statusText?.toLowerCase().includes("bad") || o.statusText?.toLowerCase().includes("qs"));

  // Buckets assignment (mock logic)
  const readyOrders = sortByUrgency(galvanikOrders.filter(o => o.status === "ready" || o.statusText?.toLowerCase().includes("bereit") || o.statusText?.toLowerCase().includes("warte")));
  const inProgressOrders = sortByUrgency(galvanikOrders.filter(o => o.status === "in_progress" || o.statusText?.toLowerCase().includes("bad") || o.statusText?.toLowerCase().includes("läuft")));
  const finishedOrders = sortByUrgency(galvanikOrders.filter(o => o.status === "done" || o.status === "quality_check" || o.statusText?.toLowerCase().includes("fertig") || o.statusText?.toLowerCase().includes("qs")));

  // Top Urgent overall
  const topUrgent = sortByUrgency(galvanikOrders).filter(o => o.risk === "red" || o.risk === "orange").slice(0, 3);

  const renderOrderList = (orders: MockOrder[], bucket: GalvanikBucket) => {
    const isActive = activeBucket === bucket;
    return (
      <div className={`flex flex-col gap-3 transition-all duration-500 ${isActive ? 'opacity-100' : 'opacity-50 grayscale-[0.5] hover:opacity-70'}`}>
        {orders.length === 0 ? (
          <div className="text-xs text-[#9e9689] italic p-4 border border-dashed border-[#d8d0c4] rounded-[14px] text-center">Keine Aufträge in dieser Kategorie</div>
        ) : (
          orders.map((o) => (
            <OrderWideCard
              key={o.id}
              id={o.id}
              orderNumber={o.orderNumber}
              customerName={o.customerName}
              article={o.task || "Unbekannt"}
              surface={o.parts?.[0]?.finish || "Offen"}
              surfaceKey={o.parts?.[0]?.finish?.toLowerCase().includes("chrom") ? "chrom" : o.parts?.[0]?.finish?.toLowerCase().includes("nickel") ? "nickel" : o.parts?.[0]?.finish?.toLowerCase().includes("gold") ? "gold" : "offen"}
              urgency={mapRiskToUrgency(o.risk)}
              dueValue={o.dueValue || "--"}
              dueLabel={o.dueLabel || "Tage"}
              badgeText={o.statusText}
              onClick={() => setActiveBucket(bucket)}
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
        
        {/* Top Urgent */}
        {topUrgent.length > 0 && (
          <div className="mb-8 bg-[#fdf0ee] border border-[#c0392b]/20 p-4 rounded-[14px]">
            <div className="flex items-center gap-2 text-[#c0392b] font-bold text-sm mb-3">
              <AlertTriangle className="w-4 h-4" /> Dringlich in Galvanik
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {topUrgent.map(o => (
                <OrderWideCard
                  key={`urg-${o.id}`}
                  id={o.id}
                  orderNumber={o.orderNumber}
                  customerName={o.customerName}
                  article={o.task || "Unbekannt"}
                  surface={o.parts?.[0]?.finish || "Offen"}
                  surfaceKey={o.parts?.[0]?.finish?.toLowerCase().includes("chrom") ? "chrom" : "offen"}
                  urgency={mapRiskToUrgency(o.risk)}
                  dueValue={o.dueValue || "--"}
                  dueLabel={o.dueLabel || "Tage"}
                  badgeText={o.statusText}
                  onClick={() => {}}
                />
              ))}
            </div>
          </div>
        )}

        {/* Buckets Header */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <button
            onClick={() => setActiveBucket("ready")}
            className={`flex flex-col gap-2 p-5 rounded-[14px] cursor-pointer transition-all text-left ${
              activeBucket === "ready" 
                ? "bg-[#e6f4ea] border-2 border-[#1a6b38] shadow-md transform scale-[1.02]" 
                : "bg-[#faf8f4] border-[1.5px] border-[#d8d0c4] hover:bg-[#f4f0e8] opacity-70"
            }`}
          >
            <div className={`w-10 h-10 rounded-[10px] flex items-center justify-center mb-2 ${activeBucket === "ready" ? "bg-white" : "bg-[#fef3e2]"}`}>
              <Layers className={`w-5 h-5 ${activeBucket === "ready" ? "text-[#1a6b38]" : "text-[#c8922a]"}`} />
            </div>
            <span className={`text-[15px] font-bold ${activeBucket === "ready" ? "text-[#1a6b38]" : "text-[#1a1a1a]"}`}>Bereit für Galvanik</span>
            <span className="text-xs text-[#9e9689]">{readyOrders.length} Aufträge</span>
          </button>

          <button
            onClick={() => setActiveBucket("in_progress")}
            className={`flex flex-col gap-2 p-5 rounded-[14px] cursor-pointer transition-all text-left ${
              activeBucket === "in_progress" 
                ? "bg-[#e6f4ea] border-2 border-[#1a6b38] shadow-md transform scale-[1.02]" 
                : "bg-[#faf8f4] border-[1.5px] border-[#d8d0c4] hover:bg-[#f4f0e8] opacity-70"
            }`}
          >
            <div className={`w-10 h-10 rounded-[10px] flex items-center justify-center mb-2 ${activeBucket === "in_progress" ? "bg-white" : "bg-[#e6f4ea]"}`}>
              <PlayCircle className={`w-5 h-5 ${activeBucket === "in_progress" ? "text-[#1a6b38]" : "text-[#1a6b38]"}`} />
            </div>
            <span className={`text-[15px] font-bold ${activeBucket === "in_progress" ? "text-[#1a6b38]" : "text-[#1a1a1a]"}`}>In Bearbeitung</span>
            <span className="text-xs text-[#9e9689]">{inProgressOrders.length} Aufträge</span>
          </button>

          <button
            onClick={() => setActiveBucket("finished")}
            className={`flex flex-col gap-2 p-5 rounded-[14px] cursor-pointer transition-all text-left ${
              activeBucket === "finished" 
                ? "bg-[#e6f4ea] border-2 border-[#1a6b38] shadow-md transform scale-[1.02]" 
                : "bg-[#faf8f4] border-[1.5px] border-[#d8d0c4] hover:bg-[#f4f0e8] opacity-70"
            }`}
          >
            <div className={`w-10 h-10 rounded-[10px] flex items-center justify-center mb-2 ${activeBucket === "finished" ? "bg-white" : "bg-[#fef3e2]"}`}>
              <CheckCircle2 className={`w-5 h-5 ${activeBucket === "finished" ? "text-[#1a6b38]" : "text-[#c8922a]"}`} />
            </div>
            <span className={`text-[15px] font-bold ${activeBucket === "finished" ? "text-[#1a6b38]" : "text-[#1a1a1a]"}`}>Fertige Werkstücke</span>
            <span className="text-xs text-[#9e9689]">{finishedOrders.length} Aufträge</span>
          </button>

          <Link
            href="/warendurchlauf/warenausgang?context=readyFromGalvanik"
            className="flex flex-col gap-2 p-5 rounded-[14px] cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md text-white opacity-90 hover:opacity-100"
            style={{ background: "#1a6b38", border: "1.5px solid #1a6b38" }}
          >
            <div className="w-10 h-10 rounded-[10px] bg-white/15 flex items-center justify-center mb-2">
              <ArrowRight className="w-5 h-5 text-white" />
            </div>
            <span className="text-[15px] font-bold">Weiter zu Warenausgang</span>
            <span className="text-xs text-white/60">Aktion ausführen</span>
          </Link>
        </div>

        {/* Listen Bereich (3 Spalten mit Verdrängungslogik) */}
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-4 items-start">
          <div className={`w-full transition-all duration-500 ease-in-out ${activeBucket === "ready" ? "lg:w-[45%]" : "lg:w-[27.5%]"}`}>
            <h3 className="text-sm font-bold text-[#9e9689] uppercase tracking-wider mb-4 border-b border-[#d8d0c4] pb-2">Bereit</h3>
            {renderOrderList(readyOrders, "ready")}
          </div>
          <div className={`w-full transition-all duration-500 ease-in-out ${activeBucket === "in_progress" ? "lg:w-[45%]" : "lg:w-[27.5%]"}`}>
            <h3 className="text-sm font-bold text-[#9e9689] uppercase tracking-wider mb-4 border-b border-[#d8d0c4] pb-2">In Bearbeitung</h3>
            {renderOrderList(inProgressOrders, "in_progress")}
          </div>
          <div className={`w-full transition-all duration-500 ease-in-out ${activeBucket === "finished" ? "lg:w-[45%]" : "lg:w-[27.5%]"}`}>
            <h3 className="text-sm font-bold text-[#9e9689] uppercase tracking-wider mb-4 border-b border-[#d8d0c4] pb-2">Fertig (QS)</h3>
            {renderOrderList(finishedOrders, "finished")}
          </div>
        </div>

        <div className="mt-12 text-center">
          <span className="inline-block text-[10px] font-bold bg-[#fef3e2] text-[#c8922a] px-3 py-1 rounded-full border border-[#c8922a]/20">
            Aus vorhandenen Testaufträgen berechnet (Demo-Auswertung)
          </span>
        </div>

      </div>
    </div>
  );
}
