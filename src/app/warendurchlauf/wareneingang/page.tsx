"use client";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { BackButton } from "@/components/ui/BackButton";

import Link from "next/link";
import {
  Camera, PenLine, Phone, MessageSquare, Clock,
  ChevronRight, Zap
} from "lucide-react";
import { useState, Suspense, useEffect } from "react";
import { createPortal } from "react-dom";
import { useSearchParams, useRouter } from "next/navigation";
import { useErfassung } from "@/components/erfassung/ErfassungProvider";
import { OrderCompactCard } from "@/components/orders/OrderCompactCard";
import { getUrgency } from "@/lib/orders/getUrgency";
import { normalizeStoredOrderStatus } from "@/lib/orders/orderMutationContract";
import { useOverlayStore } from "@/lib/overlayStore";
import type { OrderResponse } from "@/app/actions/orders.actions";

type WorklistTodo = {
  id: number;
  title: string;
  subtitle: string;
  tags: string[];
  action: string;
  priority?: string;
  live?: boolean;
  targetHref: string;
};

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   Warendurchlauf Leitstand — v4 Layout
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

function WarendurchlaufLeitstandContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { openErfassung } = useErfassung();
  const { openOrder } = useOverlayStore();

  const [orders, setOrders] = useState<OrderResponse[]>([]);
  const [stationOrders, setStationOrders] = useState<OrderResponse[]>([]);
  const [todos, setTodos] = useState<WorklistTodo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [kpiState, setKpiState] = useState<"loading" | "ready" | "error">("loading");
  const [stationState, setStationState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const load = async () => {
      const failures: string[] = [];
      setIsLoading(true);
      setKpiState("loading");
      setStationState("loading");
      try {
        const { getWarendurchlaufKPIs, getStationOrders } = await import("@/app/warendurchlauf/actions");
        
        // 1. Load KPIs and checklist separately
        const resKPI = await getWarendurchlaufKPIs();
        if (resKPI.ok && resKPI.data) {
          const typedOrders = resKPI.data.orders;
          setOrders(typedOrders);

          // Build dynamic checklist
          const newTodos: WorklistTodo[] = [];
          const kritisch = typedOrders.filter((o) => o.risk === 'red' || o.risk === 'orange');
          if (kritisch.length > 0) {
             newTodos.push({
                id: 1, title: `Kritische Aufträge (${kritisch.length})`, subtitle: "Aufträge mit hohem Risiko",
                tags: ["Warendurchlauf"], action: "Ansehen", priority: "Hoch", targetHref: "/kontrolle",
                live: true,
             });
          }
          const auslieferungen = typedOrders.filter((o) => o.currentStationId === 'warenausgang' || o.station === 'warenausgang');
          if (auslieferungen.length > 0) {
             newTodos.push({
                id: 2, title: `Auslieferungen klären (${auslieferungen.length})`, subtitle: "Aufträge im Warenausgang",
                tags: ["Warenausgang"], action: "Prüfen", targetHref: "/warendurchlauf/warenausgang",
                live: true,
             });
          }
          setTodos(newTodos);
          setKpiState("ready");
        } else {
          setOrders([]);
          setTodos([]);
          setKpiState("error");
          failures.push(resKPI.message || "Kennzahlen sind nicht verfügbar.");
        }

        // 2. Load dedicated station orders
        const resList = await getStationOrders("wareneingang");
        if (resList.ok && resList.data) {
          setStationOrders(resList.data);
          setStationState("ready");
        } else {
          setStationOrders([]);
          setStationState("error");
          failures.push(resList.message || "Stationsaufträge sind nicht verfügbar.");
        }
        setLoadError(failures.length > 0 ? failures.join(" ") : null);
      } catch (error) {
        console.error("Failed to load Wareneingang", error);
        setOrders([]);
        setTodos([]);
        setStationOrders([]);
        setKpiState("error");
        setStationState("error");
        setLoadError("Wareneingangsdaten konnten nicht vollständig geladen werden.");
      } finally {
        setIsLoading(false);
      }
    };
    load();

    const handleUpdate = () => load();
    window.addEventListener("kreile-orders-updated", handleUpdate);
    return () => window.removeEventListener("kreile-orders-updated", handleUpdate);
  }, []);

  const countUeberfaellig = orders.filter(o => o.risk === 'red').length;
  const countDieseWoche = orders.filter(o => o.risk === 'orange' || o.risk === 'yellow').length;
  const countWartend = orders.filter(o => o.risk === 'blocked').length;
  const countImPlan = orders.filter(o => o.risk === 'green').length;
  const countUnbewertet = orders.length - countUeberfaellig - countDieseWoche - countWartend - countImPlan;

  const totalBar = (countUeberfaellig + countDieseWoche + countWartend + countImPlan + countUnbewertet) || 1;

  return (
    <div className="w-full h-full font-sans antialiased text-[#1a1a1a]">
      <div className="w-full mx-auto px-5 md:px-8 lg:px-12 xl:px-16 py-6">

        {loadError && (
          <div role="alert" className="mb-6 rounded-[14px] border border-[#c0392b]/25 bg-[#fdf0ee] p-4 text-sm text-[#8f2c22]">
            {loadError}
          </div>
        )}
        {isLoading && (
          <div className="mb-6 rounded-[14px] border border-[#d8d0c4] bg-[#faf8f4] p-4 text-sm text-[#5e5850]">
            Wareneingangsdaten werden geladen.
          </div>
        )}




        {/* â”€â”€ UNTERER BEREICH â”€â”€ */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_minmax(280px,380px)] gap-6" style={{ animation: "fadeUp .4s .1s ease both" }}>

          {/* LINKE SEITE */}
          <div>
            {/* Titel */}
            <div className="text-[13px] font-bold text-[#5e5850] mb-3 flex items-center gap-2">
              Neue Annahme erfassen
              <span className="flex-1 h-px bg-[#d8d0c4]" />
            </div>

            {/* Aktionskarten */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
              {/* Kamera — primary */}
              <button
                onClick={() => openErfassung({ mode: "scan" })}
                className="flex flex-col items-center gap-3 p-6 rounded-[14px] cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md text-center text-white"
                style={{ background: "#1a6b38", border: "1.5px solid #1a6b38" }}
              >
                <div className="w-[52px] h-[52px] rounded-[14px] bg-white/15 flex items-center justify-center">
                  <Camera className="w-6 h-6 text-white" />
                </div>
                <span className="text-[15px] font-bold">Kamera</span>
                <span className="text-xs text-white/60">Foto &middot; Scan</span>
              </button>

              {/* Telefonnotiz (ersetzt Datei-Upload) */}
              <Link
                href="/telefonnotiz?returnTo=/warendurchlauf/wareneingang"
                className="flex flex-col items-center gap-3 p-6 rounded-[14px] cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md hover:bg-[#f4f0e8] text-center"
                style={{ background: "#faf8f4", border: "1.5px solid #d8d0c4" }}
              >
                <div className="w-[52px] h-[52px] rounded-[14px] bg-[#fef3e2] flex items-center justify-center">
                  <Phone className="w-6 h-6 text-[#2471a3]" />
                </div>
                <span className="text-[15px] font-bold text-[#1a1a1a]">Telefonnotiz</span>
                <span className="text-xs text-[#9e9689]">Schnellerfassung</span>
              </Link>

              {/* Manuell anlegen */}
              <button
                onClick={() => openErfassung({ mode: "gate" })}
                className="flex flex-col items-center gap-3 p-6 rounded-[14px] cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md hover:bg-[#f4f0e8] text-center"
                style={{ background: "#faf8f4", border: "1.5px solid #d8d0c4" }}
              >
                <div className="w-[52px] h-[52px] rounded-[14px] bg-[#fef3e2] flex items-center justify-center">
                  <PenLine className="w-6 h-6 text-[#c8922a]" />
                </div>
                <span className="text-[15px] font-bold text-[#1a1a1a]">Manuell anlegen</span>
                <span className="text-xs text-[#9e9689]">Kunde &middot; Auftrag</span>
              </button>
            </div>

            {/* Breite Verweiskarten */}
            <Link
              href="/quotes"
              className="flex items-center gap-4 p-4 rounded-[14px] cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-sm hover:bg-[#f4f0e8] mb-3"
              style={{ background: "#faf8f4", border: "1.5px solid #d8d0c4" }}
            >
              <div className="w-10 h-10 rounded-[10px] bg-[#fef3e2] flex items-center justify-center shrink-0">
                <MessageSquare className="w-5 h-5 text-[#c8922a]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-bold text-[#1a1a1a]">Anfragen</div>
                <div className="text-[11px] text-[#9e9689]">Offene Angebotsanfragen</div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#9e9689] shrink-0" />
            </Link>

            <Link
              href="/orders"
              className="flex items-center gap-4 p-4 rounded-[14px] cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-sm hover:bg-[#f4f0e8]"
              style={{ background: "#faf8f4", border: "1.5px solid #d8d0c4" }}
            >
              <div className="w-10 h-10 rounded-[10px] bg-[#fef3e2] flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5 text-[#c8922a]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-bold text-[#1a1a1a]">Auftragsbuch</div>
                <div className="text-[11px] text-[#9e9689]">
                  {kpiState === "ready" ? `${orders.length} geladene Aufträge` : "Anzahl nicht verfügbar"}
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#9e9689] shrink-0" />
            </Link>
          </div>

          {/* RECHTE SEITE */}
          <div className="flex flex-col gap-3">
            {/* Tagesstand */}
            <div className="p-3 rounded-[14px]" style={{ background: "#faf8f4", border: "1.5px solid #d8d0c4" }}>
              <div className="text-[10px] font-bold tracking-[1px] uppercase text-[#9e9689] mb-2" style={{ fontFamily: "monospace" }}>
                Tagesstand
              </div>
              {/* Bar */}
              <div className="h-2 rounded flex gap-0.5 overflow-hidden mb-2">
                <div className="rounded bg-[#c0392b]" style={{ flex: countUeberfaellig, display: countUeberfaellig ? 'block' : 'none' }} />
                <div className="rounded bg-[#d4850a]" style={{ flex: countDieseWoche, display: countDieseWoche ? 'block' : 'none' }} />
                <div className="rounded bg-[#2471a3]" style={{ flex: countWartend, display: countWartend ? 'block' : 'none' }} />
                <div className="rounded bg-[#1e7e45]" style={{ flex: countImPlan, display: countImPlan ? 'block' : 'none' }} />
                <div className="rounded bg-[#9e9689]" style={{ flex: countUnbewertet, display: countUnbewertet ? 'block' : 'none' }} />
                {totalBar === 1 && orders.length === 0 && <div className="rounded bg-neutral-gray-200" style={{ flex: 1 }} />}
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                <StatRow color="#c0392b" label="Risiko rot" value={kpiState === "ready" ? countUeberfaellig.toString() : "—"} />
                <StatRow color="#d4850a" label="Risiko gelb/orange" value={kpiState === "ready" ? countDieseWoche.toString() : "—"} />
                <StatRow color="#2471a3" label="Blockiert" value={kpiState === "ready" ? countWartend.toString() : "—"} />
                <StatRow color="#1e7e45" label="Risiko grün" value={kpiState === "ready" ? countImPlan.toString() : "—"} />
                <StatRow color="#9e9689" label="Nicht bewertet" value={kpiState === "ready" ? countUnbewertet.toString() : "—"} />
              </div>
            </div>

            {/* Checkliste */}
            <div className="p-3 rounded-[14px]" style={{ background: "#faf8f4", border: "1.5px solid #d8d0c4" }}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[13px] font-bold text-[#1a1a1a]">Aktuelle Hinweise</span>
                <span
                  className="text-[9px] font-semibold px-2 py-[3px] rounded-[5px] border cursor-pointer uppercase tracking-[.4px] hidden"
                  style={{ background: "#f4f0e8", borderColor: "#d8d0c4", color: "#5e5850" }}
                >
                  Auswertung
                </span>
              </div>

              {todos.length > 0 && (
                <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-[7px] bg-[#fef3e2] mb-2 text-[10px]">
                  <Zap className="w-3 h-3 text-[#c8922a]" />
                  <b className="text-[#c8922a]">{todos.length} datenbasierte Arbeitsbereiche offen</b>
                </div>
              )}

              {/* Items */}
              <div className="flex flex-col">
                {kpiState !== "ready" ? (
                  <div className="text-[11px] text-[#9e9689] p-2 text-center border border-dashed rounded-[7px] border-[#d8d0c4]">
                    {kpiState === "loading" ? "Arbeitsliste wird geladen." : "Arbeitsliste nicht verfügbar."}
                  </div>
                ) : todos.length === 0 ? (
                  <div className="text-[11px] text-[#9e9689] p-2 text-center border border-dashed rounded-[7px] border-[#d8d0c4]">
                    Keine offenen Hinweise aus den geladenen Risiko- und Stationsdaten.
                  </div>
                ) : (
                  todos.map(t => (
                    <CheckItem
                      key={t.id}
                      title={t.title}
                      subtitle={t.subtitle}
                      tags={t.tags}
                      action={t.action}
                      priority={t.priority}
                      live={t.live}
                      onClick={() => router.push(t.targetHref)}
                    />
                  ))
                )}
              </div>
            </div>

            {/* Demo-Badge removed */}
          </div>
        </div>

        {/* â”€â”€ ARBEITSLISTE WARENEINGANG â”€â”€ */}
        <div className="mt-12" style={{ animation: "fadeUp .5s .2s ease both" }}>
          <div className="text-[15px] font-bold text-[#5e5850] mb-4 flex items-center gap-2">
            Aktuelle Aufträge im Wareneingang
            <span className="flex-1 h-px bg-[#d8d0c4]" />
            <span className="text-xs bg-[#f4f0e8] px-2 py-1 rounded text-[#9e9689]">
              {stationState === "ready" ? stationOrders.length : "—"}
            </span>
          </div>

          <div className="flex flex-col gap-2">
            {stationState === "loading" ? (
              <div className="p-8 text-center border-2 border-dashed border-[#d8d0c4] rounded-[14px] text-[#9e9689]">
                Stationsaufträge werden geladen.
              </div>
            ) : stationState === "error" ? (
              <div role="alert" className="p-8 text-center border-2 border-dashed border-[#c0392b] rounded-[14px] text-[#8f2c22]">
                Stationsaufträge sind nicht verfügbar; es wird keine leere Liste behauptet.
              </div>
            ) : stationOrders.length > 0 ? (
              stationOrders.map((order) => {
                const dueTimestamp = order.dueDate ? new Date(order.dueDate).getTime() : Number.NaN;
                const dueUrgency = Number.isFinite(dueTimestamp) ? getUrgency(order.dueDate) : null;
                let urgencyType: "ok" | "soon" | "crit" | "wait" = "wait";
                if (order.risk === "red" || dueUrgency === "kritisch") urgencyType = "crit";
                else if (order.risk === "orange" || order.risk === "yellow" || dueUrgency === "gefaehrdet") urgencyType = "soon";
                else if (order.risk === "green") urgencyType = "ok";

                return (
                  <OrderCompactCard
                    key={order.id}
                    id={order.id}
                    orderNumber={order.orderNumber}
                    customerName={order.customerName || "Kunde nicht hinterlegt"}
                    article={order.itemDescription || "Artikel nicht hinterlegt"}
                    surface={order.surfaceRequested || "Oberfläche nicht hinterlegt"}
                    urgency={urgencyType}
                    dueValue={order.dueValue || "—"}
                    dueLabel={order.dueLabel || "Kein Fälligkeitstermin"}
                    badgeText={order.statusText || statusLabel(order.status)}
                    onClick={() => openOrder(order.id)}
                  />
                );
              })
            ) : (
              <div className="p-8 text-center border-2 border-dashed border-[#d8d0c4] rounded-[14px] text-[#9e9689]">
                Aktuell keine Aufträge in dieser Station.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Animation */}
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

export default function WarendurchlaufLeitstand() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Lade Leitstand...</div>}>
      <WarendurchlaufLeitstandContent />
    </Suspense>
  );
}

/* â”€â”€ Hilfskomponenten â”€â”€ */

function statusLabel(value: string): string {
  switch (normalizeStoredOrderStatus(value)) {
    case "in_progress": return "In Bearbeitung";
    case "ready": return "Bereit";
    case "blocked": return "Blockiert";
    case "completed": return "Abgeschlossen";
    case "shipped": return "Übergeben";
    case "cancelled": return "Storniert";
    default: return "Status nicht klassifiziert";
  }
}

function StatRow({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-[3px] text-[11px]">
      <div className="flex items-center gap-[5px] text-[#5e5850]">
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
        {label}
      </div>
      <span className="font-bold text-[12px]" style={{ fontFamily: "monospace" }}>{value}</span>
    </div>
  );
}

function CheckItem({
  title,
  subtitle,
  tags,
  action,
  priority,
  live,
  onClick,
}: {
  title: string;
  subtitle: string;
  tags: string[];
  action: string;
  priority?: string;
  live?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="flex items-start gap-2 py-[7px] border-b border-[#d8d0c4] last:border-b-0 cursor-pointer transition-colors hover:bg-[#f4f0e8] hover:mx-[-6px] hover:px-[6px] hover:rounded-md"
    >
      <div className="w-4 h-4 rounded-full border-2 shrink-0 mt-0.5 border-[#d8d0c4]" />
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-bold text-[#1a1a1a]">{title}</div>
        <div className="text-[10px] text-[#9e9689]">{subtitle}</div>
        <div className="flex gap-1 items-center mt-0.5 flex-wrap">
          {tags.map(t => (
            <span key={t} className="text-[8px] font-bold px-[5px] py-px rounded-[3px] bg-[#f4f0e8] text-[#5e5850] border border-[#d8d0c4]">{t}</span>
          ))}
          <span className="text-[9px] text-[#c8922a] font-semibold flex items-center gap-0.5">
            <Zap className="w-2.5 h-2.5" /> {action}
          </span>
        </div>
      </div>
      <div className="flex gap-[3px] shrink-0 mt-0.5">
        {priority && (
          <span className="text-[8px] font-bold px-[5px] py-px rounded-[3px] bg-[rgba(192,57,43,.1)] text-[#c0392b]">{priority}</span>
        )}
        {live && (
          <span className="text-[8px] font-bold px-[5px] py-px rounded-[3px] bg-[#1e7e45] text-white">Live</span>
        )}
      </div>
    </div>
  );
}
