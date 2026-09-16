"use client";

import React, { useCallback, useState, useEffect } from "react";
import Link from "next/link";
import { Layers, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { OrderQueueRow } from "@/modules/orders/public";
import { useOverlayStore } from "@/lib/overlayStore";
import {
  getGalvanikOrdersAction,
  type WarendurchlaufOrder,
} from "@/app/warendurchlauf/actions";
import { ORDER_LIFECYCLE_STATUS } from "@/modules/orders/public";

// D-ARCH-001: galvanik is a single stable outside station covering all
// production (no internal steps, no workflow engine). This route therefore
// exposes exactly one active bucket (status=galvanik) plus the finished view.
// F1.3 performs the atomic finish/freeze from the central live order card;
// there remains deliberately no separate start command.
type GalvanikBucket = "galvanik" | "finished";
type GalvanikOrder = WarendurchlaufOrder & { statusText?: string };

const GALVANIK_LOAD_ERROR =
  "Die Galvanik-Aufträge konnten gerade nicht geladen werden. Bitte erneut versuchen oder die Auftragsliste öffnen.";
const GALVANIK_ACCESS_DENIED =
  "Für diese Ansicht fehlt die Berechtigung. Bitte den Zugriff mit dem Systemadministrator klären.";

function sortByUrgency(orders: GalvanikOrder[]) {
  const priorityRank: Record<string, number> = {
    red: 0,
    orange: 1,
    yellow: 2,
    green: 3,
    blocked: 4,
    unknown: 5,
  };
  return [...orders].sort((a, b) => {
    const aRank = priorityRank[a.risk] ?? 5;
    const bRank = priorityRank[b.risk] ?? 5;
    return aRank - bRank;
  });
}

export default function GalvanikPage() {
  const [activeBucket, setActiveBucket] = useState<GalvanikBucket>("galvanik");
  const [galvanikOrders, setGalvanikOrders] = useState<GalvanikOrder[]>([]);
  const [finishedOrders, setFinishedOrders] = useState<GalvanikOrder[]>([]);
  const [topUrgent, setTopUrgent] = useState<GalvanikOrder[]>([]);
  const [dataState, setDataState] = useState<
    "loading" | "loaded" | "denied" | "error"
  >("loading");
  const [unavailableMessage, setUnavailableMessage] =
    useState(GALVANIK_LOAD_ERROR);
  const openOrder = useOverlayStore((state) => state.openOrder);

  // Consistently derives galvanikOrders/finishedOrders/topUrgent from one fresh
  // getGalvanikOrdersAction dataset. Every row opens the one V8 order card;
  // mutations and their readbacks live only in its typed AppAdapter.
  const applyGalvanikDataset = useCallback((allGalvanik: GalvanikOrder[]) => {
    const active = sortByUrgency(
      allGalvanik.filter(
        (order) => order.status === ORDER_LIFECYCLE_STATUS.GALVANIK,
      ),
    );
    const done = sortByUrgency(
      allGalvanik.filter(
        (order) =>
          order.status === "done" ||
          order.status === "quality_check" ||
          order.status === ORDER_LIFECYCLE_STATUS.FERTIG,
      ),
    );

    setGalvanikOrders(active);
    setFinishedOrders(done);

    const combined = [...active, ...done];
    setTopUrgent(
      sortByUrgency(combined)
        .filter((o) => o.risk === "red" || o.risk === "orange")
        .slice(0, 3),
    );
  }, []);

  const load = useCallback(async () => {
    setDataState("loading");
    setGalvanikOrders([]);
    setFinishedOrders([]);
    setTopUrgent([]);
    setUnavailableMessage(GALVANIK_LOAD_ERROR);
    try {
      const result = await getGalvanikOrdersAction();

      if (!result.ok) {
        const denied =
          result.error === "AUTH_ERROR" || result.error === "FORBIDDEN";
        setUnavailableMessage(
          denied ? GALVANIK_ACCESS_DENIED : GALVANIK_LOAD_ERROR,
        );
        setDataState(denied ? "denied" : "error");
        return;
      }

      applyGalvanikDataset(result.data);
      setDataState("loaded");
    } catch {
      setGalvanikOrders([]);
      setFinishedOrders([]);
      setTopUrgent([]);
      setUnavailableMessage(GALVANIK_LOAD_ERROR);
      setDataState("error");
    }
  }, [applyGalvanikDataset]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const renderOrderList = (orders: GalvanikOrder[], bucket: GalvanikBucket) => {
    const isActive = activeBucket === bucket;
    return (
      <div
        className={`flex flex-col gap-3 transition-all duration-500 ${isActive ? "opacity-100" : ""}`}
        data-testid={`galvanik-${bucket}-orders`}
      >
        {orders.length === 0 ? (
          <div className="text-xs text-[#9e9689] italic p-4 border border-dashed border-[#d8d0c4] rounded-[14px] text-center">
            {isActive ? (
              <>
                Noch keine Daten erfasst.{" "}
                <Link href="/orders">Aufträge anzeigen</Link>
              </>
            ) : (
              "-"
            )}
          </div>
        ) : (
          orders.map((o) => (
            <OrderQueueRow
              key={o.id}
              order={{
                id: o.id,
                orderNumber: o.orderNumber,
                customerName: o.customerName || "Kunde nicht hinterlegt",
                title: o.itemDescription || "Artikel nicht hinterlegt",
                detail: o.surfaceRequested || null,
                station: o.statusText || o.status,
                dueLabel: o.dueValue || "Termin nicht erfasst",
                risk: o.risk,
              }}
              onOpen={(orderId) =>
                isActive ? openOrder(orderId) : setActiveBucket(bucket)
              }
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
        <h1 className="text-[13px] font-bold text-[#5e5850] mb-6 flex items-center gap-2">
          Galvanik Bearbeitung
          <span className="flex-1 h-px bg-[#d8d0c4]" />
        </h1>
        <p className="mb-4 text-sm text-[#9e9689]">
          Auftrag öffnen, Mehrarbeit je Teil erfassen und anschließend mit
          bestätigtem Beleg fertigsetzen. Ein separater Start-Klick bleibt
          bewusst entfallen.
        </p>

        {dataState === "loading" ? (
          <div className="flex flex-col items-center justify-center py-20 text-[#9e9689]">
            <Loader2 className="w-8 h-8 animate-spin mb-4" />
            <p>Lade Galvanik Aufträge...</p>
          </div>
        ) : dataState === "denied" ? (
          <div className="py-20 text-center text-[#9e9689]" role="status">
            <p className="mb-2 text-sm font-bold text-[#c0392b]">
              Zugriff nicht erlaubt
            </p>
            {unavailableMessage}
          </div>
        ) : dataState === "error" ? (
          <div className="py-20 text-center text-[#9e9689]" role="status">
            <p className="mb-2 text-sm font-bold text-[#c0392b]">
              Daten konnten nicht geladen werden
            </p>
            {unavailableMessage}
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
                  {topUrgent.map((o) => (
                    <OrderQueueRow
                      key={`urg-${o.id}`}
                      order={{
                        id: o.id,
                        orderNumber: o.orderNumber,
                        customerName:
                          o.customerName || "Kunde nicht hinterlegt",
                        title: o.itemDescription || "Artikel nicht hinterlegt",
                        detail: o.surfaceRequested || null,
                        station: o.statusText || o.status,
                        dueLabel: o.dueValue || "Termin nicht erfasst",
                        risk: o.risk,
                      }}
                      onOpen={openOrder}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Buckets Header */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <button
                onClick={() => setActiveBucket("galvanik")}
                className={`flex flex-row items-center gap-3 p-3 rounded-[14px] cursor-pointer transition-all text-left ${
                  activeBucket === "galvanik"
                    ? "bg-[#e6f4ea] border-2 border-[#1a6b38] shadow-md transform scale-[1.02]"
                    : "bg-[#faf8f4] border-[1.5px] border-[#d8d0c4] hover:bg-[#f4f0e8] opacity-70"
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-[8px] shrink-0 flex items-center justify-center ${activeBucket === "galvanik" ? "bg-white" : "bg-[#fef3e2]"}`}
                >
                  <Layers
                    className={`w-4 h-4 ${activeBucket === "galvanik" ? "text-[#1a6b38]" : "text-[#c8922a]"}`}
                  />
                </div>
                <div className="flex flex-col flex-1 min-w-0">
                  <span
                    className={`text-[13px] font-bold truncate ${activeBucket === "galvanik" ? "text-[#1a6b38]" : "text-[#1a1a1a]"}`}
                  >
                    Galvanik
                  </span>
                  <span className="text-[10px] text-[#9e9689]">
                    {galvanikOrders.length} Aufträge
                  </span>
                </div>
              </button>

              <button
                data-testid="galvanik-finished-tab"
                onClick={() => setActiveBucket("finished")}
                className={`flex flex-row items-center gap-3 p-3 rounded-[14px] cursor-pointer transition-all text-left ${
                  activeBucket === "finished"
                    ? "bg-[#e6f4ea] border-2 border-[#1a6b38] shadow-md transform scale-[1.02]"
                    : "bg-[#faf8f4] border-[1.5px] border-[#d8d0c4] hover:bg-[#f4f0e8] opacity-70"
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-[8px] shrink-0 flex items-center justify-center ${activeBucket === "finished" ? "bg-white" : "bg-[#fef3e2]"}`}
                >
                  <CheckCircle2
                    className={`w-4 h-4 ${activeBucket === "finished" ? "text-[#1a6b38]" : "text-[#c8922a]"}`}
                  />
                </div>
                <div className="flex flex-col flex-1 min-w-0">
                  <span
                    className={`text-[13px] font-bold truncate ${activeBucket === "finished" ? "text-[#1a6b38]" : "text-[#1a1a1a]"}`}
                  >
                    Fertig (QS)
                  </span>
                  <span className="text-[10px] text-[#9e9689]">
                    {finishedOrders.length} Aufträge
                  </span>
                </div>
              </button>
            </div>

            {/* Listen Bereich (2 Spalten mit Verdrängungslogik) */}
            <div className="flex gap-3 overflow-x-auto snap-x md:grid md:grid-cols-2 md:overflow-visible w-full pb-4">
              <div
                className={`transition-all duration-500 ease-in-out snap-center min-w-[85vw] md:min-w-0 ${activeBucket === "galvanik" ? "w-full md:w-[80%]" : "w-full md:w-[10%] opacity-50 grayscale-[0.8]"}`}
              >
                <h3 className="text-sm font-bold text-[#9e9689] uppercase tracking-wider mb-4 border-b border-[#d8d0c4] pb-2 truncate">
                  Galvanik
                </h3>
                {renderOrderList(galvanikOrders, "galvanik")}
              </div>
              <div
                className={`transition-all duration-500 ease-in-out snap-center min-w-[85vw] md:min-w-0 ${activeBucket === "finished" ? "w-full md:w-[80%]" : "w-full md:w-[10%] opacity-50 grayscale-[0.8]"}`}
              >
                <h3 className="text-sm font-bold text-[#9e9689] uppercase tracking-wider mb-4 border-b border-[#d8d0c4] pb-2 truncate">
                  Fertig (QS)
                </h3>
                {renderOrderList(finishedOrders, "finished")}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
