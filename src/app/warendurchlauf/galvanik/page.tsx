"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Layers, PlayCircle, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import type { OrderResponse as Order } from "@/app/actions/orders.actions";
import { OrderCompactCard, UrgencyType } from "@/components/orders/OrderCompactCard";
import { useOrderModal } from "@/components/orders/OrderModalProvider";
import { getStationOrders, getStationReadyOrders, startProcessingStation } from "@/app/warendurchlauf/actions";

type GalvanikBucket = "ready" | "in_progress" | "finished";
type BucketLoadState = "loading" | "ready" | "error";

function sortByUrgency(orders: Order[]) {
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
  if (risk === "green") return "ok";
  return "wait";
}

export default function GalvanikPage() {
  const [activeBucket, setActiveBucket] = useState<GalvanikBucket>("ready");
  const [readyOrders, setReadyOrders] = useState<Order[]>([]);
  const [inProgressOrders, setInProgressOrders] = useState<Order[]>([]);
  const [finishedOrders, setFinishedOrders] = useState<Order[]>([]);
  const [bucketStates, setBucketStates] = useState<Record<GalvanikBucket, BucketLoadState>>({
    ready: "loading",
    in_progress: "loading",
    finished: "loading",
  });
  const [loadWarning, setLoadWarning] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [advancingId, setAdvancingId] = useState<string | null>(null);
  const startRequestIds = useRef(new Map<string, string>());
  const { openOrder } = useOrderModal();

  useEffect(() => {
    async function load() {
      try {
        const [resReady, resActive, resFinished] = await Promise.all([
          getStationReadyOrders("galvanik").catch(() => null),
          getStationOrders("galvanik").catch(() => null),
          getStationOrders("qualitaetssicherung").catch(() => null),
        ]);

        const readyAvailable = Boolean(resReady?.ok && resReady.data);
        const activeAvailable = Boolean(resActive?.ok && resActive.data);
        const finishedAvailable = Boolean(resFinished?.ok && resFinished.data);

        if (resReady?.ok && resReady.data) {
          setReadyOrders(sortByUrgency(resReady.data));
        }
        if (resActive?.ok && resActive.data) {
          setInProgressOrders(sortByUrgency(resActive.data.filter((order) => order.status === "in_progress")));
        }
        if (resFinished?.ok && resFinished.data) {
          setFinishedOrders(sortByUrgency(resFinished.data));
        }

        setBucketStates({
          ready: readyAvailable ? "ready" : "error",
          in_progress: activeAvailable ? "ready" : "error",
          finished: finishedAvailable ? "ready" : "error",
        });
        setLoadWarning(
          readyAvailable && activeAvailable && finishedAvailable
            ? null
            : "Mindestens eine Galvanik-Datenquelle ist nicht verfügbar. Betroffene Zähler und Listen werden nicht als leer dargestellt.",
        );
      } catch (err) {
        console.error("Failed to load orders in Galvanik", err);
        setBucketStates({ ready: "error", in_progress: "error", finished: "error" });
        setLoadWarning("Galvanik-Aufträge konnten nicht geladen werden.");
      }
    }
    load();
  }, []);

  const topUrgent = sortByUrgency([...readyOrders, ...inProgressOrders])
    .filter((order) => order.risk === "red" || order.risk === "orange")
    .slice(0, 3);

  const handleStart = async (e: React.MouseEvent, orderId: string) => {
    e.stopPropagation();
    if (advancingId) return;
    setAdvancingId(orderId);
    setActionError(null);

    try {
      const order = readyOrders.find(o => o.id === orderId);
      if (order) {
        let clientRequestId = startRequestIds.current.get(orderId);
        if (!clientRequestId) {
          clientRequestId = crypto.randomUUID();
          startRequestIds.current.set(orderId, clientRequestId);
        }
        const result = await startProcessingStation(orderId, "galvanik", clientRequestId);
        if (!result.ok || !result.data) throw new Error(result.message);
        startRequestIds.current.delete(orderId);
        setReadyOrders(prev => prev.filter(o => o.id !== orderId));
        setInProgressOrders(prev => sortByUrgency([...prev, {
          ...order,
          status: result.data.newStatus,
          statusText: result.data.newStatus === "in_progress" ? "In Bearbeitung" : result.data.newStatus,
          currentStationId: result.data.newStation,
        }]));
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Statusänderung konnte nicht bestätigt werden.");
    } finally {
      setAdvancingId(null);
    }
  };

  const renderOrderList = (orders: Order[], bucket: GalvanikBucket) => {
    const isActive = activeBucket === bucket;
    const loadState = bucketStates[bucket];
    return (
      <div className={`flex flex-col gap-3 transition-all duration-500 ${isActive ? 'opacity-100' : ''}`}>
        {loadState === "loading" ? (
          <div className="text-xs text-[#9e9689] italic p-4 border border-dashed border-[#d8d0c4] rounded-[14px] text-center">
            Daten werden geladen …
          </div>
        ) : loadState === "error" ? (
          <div className="text-xs text-[#8f2c22] p-4 border border-dashed border-[#c0392b]/30 rounded-[14px] text-center">
            Datenquelle nicht verfügbar – Bestand unbekannt
          </div>
        ) : orders.length === 0 ? (
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
              dueValue={o.dueValue || "—"}
              dueLabel={o.dueLabel || (o.dueValue ? "Tage" : "Kein Termin")}
              badgeText={o.statusText || o.status}
              onClick={() => isActive ? openOrder(o.id) : setActiveBucket(bucket)}
              onAdvance={isActive && bucket === "ready" && advancingId === null ? (e) => handleStart(e, o.id) : undefined}
            />
          ))
        )}
      </div>
    );
  };

  const initialLoading = Object.values(bucketStates).every((state) => state === "loading");
  const bucketCount = (bucket: GalvanikBucket, orders: Order[]) => {
    if (bucketStates[bucket] === "loading") return "Wird geladen";
    if (bucketStates[bucket] === "error") return "Nicht verfügbar";
    return `${orders.length} Aufträge`;
  };

  return (
    <div className="w-full h-full font-sans antialiased text-[#1a1a1a] pb-16">
      <div className="w-full mx-auto px-5 md:px-8 lg:px-12 xl:px-16 py-6">

        {/* Titel */}
        <div className="text-[13px] font-bold text-[#5e5850] mb-6 flex items-center gap-2">
          Galvanik Bearbeitung
          <span className="flex-1 h-px bg-[#d8d0c4]" />
        </div>

        {initialLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-[#9e9689]">
            <Loader2 className="w-8 h-8 animate-spin mb-4" />
            <p>Lade Galvanik Aufträge...</p>
          </div>
        ) : (
          <>

            {loadWarning && (
              <div role="status" className="mb-6 rounded-[14px] border border-[#c8922a]/30 bg-[#fef3e2] p-4 text-sm text-[#765615]">
                {loadWarning}
              </div>
            )}

            {actionError && (
              <div role="alert" className="mb-6 rounded-[14px] border border-[#c0392b]/25 bg-[#fdf0ee] p-4 text-sm text-[#8f2c22]">
                {actionError}
              </div>
            )}

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
                      dueValue={o.dueValue || "—"}
                      dueLabel={o.dueLabel || (o.dueValue ? "Tage" : "Kein Termin")}
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
                  <span className="text-[10px] text-[#9e9689]">{bucketCount("ready", readyOrders)}</span>
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
                  <span className="text-[10px] text-[#9e9689]">{bucketCount("in_progress", inProgressOrders)}</span>
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
                  <span className={`text-[13px] font-bold truncate ${activeBucket === "finished" ? "text-[#1a6b38]" : "text-[#1a1a1a]"}`}>In QS</span>
                  <span className="text-[10px] text-[#9e9689]">{bucketCount("finished", finishedOrders)}</span>
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
                <h3 className="text-sm font-bold text-[#9e9689] uppercase tracking-wider mb-4 border-b border-[#d8d0c4] pb-2 truncate">In Qualitätssicherung</h3>
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
