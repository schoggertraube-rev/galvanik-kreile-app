"use client";

import Link from "next/link";
import {
  Camera, PenLine, Phone, MessageSquare, Clock,
  ChevronRight, Zap
} from "lucide-react";
import { useState, Suspense, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useErfassung } from "@/components/erfassung/ErfassungProvider";
import { OrderCompactCard } from "@/components/orders/OrderCompactCard";
import { getUrgency } from "@/lib/orders/getUrgency";
import { useOverlayStore } from "@/lib/overlayStore";
import {
  getWareneingangOrdersAction,
  getWarendurchlaufKPIs,
  type WarendurchlaufOrder,
} from "@/app/warendurchlauf/actions";
import { WareneingangHandoffButton } from "@/components/orders/WareneingangHandoffButton";

function getLegacyStatusText(order: WarendurchlaufOrder) {
  if (
    typeof order === "object" &&
    "statusText" in order &&
    typeof order.statusText === "string"
  ) {
    return order.statusText;
  }

  return undefined;
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   Warendurchlauf Leitstand — v4 Layout
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

function WarendurchlaufLeitstandContent() {
  const searchParams = useSearchParams();
  void searchParams;
  const router = useRouter();
  const { openErfassung } = useErfassung();
  const { openOrder } = useOverlayStore();
  const [orders, setOrders] = useState<WarendurchlaufOrder[]>([]);
  const [stationOrders, setStationOrders] = useState<WarendurchlaufOrder[]>([]);
  const [todos, setTodos] = useState<{ id: number; title: string; subtitle: string; tags: string[]; action: string; priority?: string; live?: boolean; targetHref?: string; done: boolean }[]>([]);
  const [kpiUnavailableMessage, setKpiUnavailableMessage] = useState<string | null>(null);
  const [stationUnavailableMessage, setStationUnavailableMessage] = useState<string | null>(null);
  const [stationListPending, setStationListPending] = useState(true);
  const [handoffSuccessMessage, setHandoffSuccessMessage] = useState<string | null>(null);
  const [handoffConflictMessage, setHandoffConflictMessage] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const resKPI = await getWarendurchlaufKPIs();
        if (!resKPI.ok) {
          setKpiUnavailableMessage(resKPI.message);
          setOrders([]);
          setTodos([]);
        } else {
          const typedOrders = resKPI.data.orders;
          setOrders(typedOrders);

          // Build dynamic checklist
          const newTodos = [];
          const kritisch = typedOrders.filter(o => o.risk === 'red' || o.risk === 'orange');
          if (kritisch.length > 0) {
             newTodos.push({
                id: 1, title: `Kritische Aufträge (${kritisch.length})`, subtitle: "Aufträge mit hohem Risiko",
                tags: ["Warendurchlauf"], action: "Ansehen", priority: "Hoch", targetHref: "/kontrolle",
                live: true, done: false
             });
          }
          const auslieferungen = typedOrders.filter(o => o.currentStationId === 'warenausgang' || o.station === 'warenausgang');
          if (auslieferungen.length > 0) {
             newTodos.push({
                id: 2, title: `Auslieferungen klären (${auslieferungen.length})`, subtitle: "Aufträge im Warenausgang",
                tags: ["Warenausgang"], action: "Prüfen", targetHref: "/warendurchlauf/warenausgang",
                live: true, done: false
             });
          }
          setTodos(newTodos);
          setKpiUnavailableMessage(null);
        }
      } catch (error) {
        setKpiUnavailableMessage(String(error));
        setOrders([]);
        setTodos([]);
      }

      setStationListPending(true);
      try {
        const resList = await getWareneingangOrdersAction();
        if (!resList.ok) {
          setStationUnavailableMessage(resList.message);
        } else {
          setStationOrders(resList.data);
          setStationUnavailableMessage(null);
        }
      } catch {
        setStationUnavailableMessage("NOT_AVAILABLE: Stationsliste konnte nicht sicher geladen werden.");
      } finally {
        setStationListPending(false);
      }
    };
    load();

    const handleIntakeCreated = () => { void load(); };
    window.addEventListener("order-intake:created", handleIntakeCreated);
    return () => window.removeEventListener("order-intake:created", handleIntakeCreated);

  }, []);

  const countUeberfaellig = orders.filter(o => o.risk === 'red').length;
  const countDieseWoche = orders.filter(o => o.risk === 'orange' || o.risk === 'yellow').length;
  const countWartend = orders.filter(o => o.risk === 'blocked').length;
  const countImPlan = orders.filter(o => o.risk === 'green').length;

  const totalBar = (countUeberfaellig + countDieseWoche + countWartend + countImPlan) || 1;

  return (
    <div className="w-full h-full font-sans antialiased text-[#1a1a1a]">
      <div className="w-full mx-auto px-5 md:px-8 lg:px-12 xl:px-16 py-6">




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
                onClick={() => openErfassung({ mode: "order" })}
                className="flex flex-col items-center gap-3 p-6 rounded-[14px] cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md hover:bg-[#f4f0e8] text-center"
                style={{ background: "#faf8f4", border: "1.5px solid #d8d0c4" }}
              >
                <div className="w-[52px] h-[52px] rounded-[14px] bg-[#fef3e2] flex items-center justify-center">
                  <PenLine className="w-6 h-6 text-[#c8922a]" />
                </div>
                <span className="text-[15px] font-bold text-[#1a1a1a]">Wareneingang anlegen</span>
                <span className="text-xs text-[#9e9689]">Kunde &middot; Teile &middot; Termin</span>
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
                <div className="text-[13px] font-bold text-[#1a1a1a]">Letzte Annahmen</div>
                <div className="text-[11px] text-[#9e9689]">28 gesamt anzeigen</div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#9e9689] shrink-0" />
            </Link>
          </div>

          {/* RECHTE SEITE */}
          <div className="flex flex-col gap-3">
            {kpiUnavailableMessage ? (
              <div className="p-3 rounded-[14px] text-sm text-[#5e5850]" role="status" style={{ background: "#faf8f4", border: "1.5px solid #d8d0c4" }}>
                {kpiUnavailableMessage}
              </div>
            ) : <>
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
                {totalBar === 1 && orders.length === 0 && <div className="rounded bg-neutral-gray-200" style={{ flex: 1 }} />}
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                <StatRow color="#c0392b" label="Überfällig" value={countUeberfaellig.toString()} />
                <StatRow color="#d4850a" label="Diese Woche" value={countDieseWoche.toString()} />
                <StatRow color="#2471a3" label="Wartend" value={countWartend.toString()} />
                <StatRow color="#1e7e45" label="Im Plan" value={countImPlan.toString()} />
              </div>
            </div>

            {/* Checkliste */}
            <div className="p-3 rounded-[14px]" style={{ background: "#faf8f4", border: "1.5px solid #d8d0c4" }}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[13px] font-bold text-[#1a1a1a]">Checkliste Heute</span>
                <span
                  className="text-[9px] font-semibold px-2 py-[3px] rounded-[5px] border cursor-pointer uppercase tracking-[.4px] hidden"
                  style={{ background: "#f4f0e8", borderColor: "#d8d0c4", color: "#5e5850" }}
                >
                  Auswertung
                </span>
              </div>

              {/* Hebel-Hinweis */}
              <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-[7px] bg-[#fef3e2] mb-2 text-[10px]">
                <Zap className="w-3 h-3 text-[#c8922a]" />
                <span className="text-[#5e5850]">Hebel: </span>
                <b className="text-[#c8922a]">Kritische Aufträge entschärfen</b>
              </div>

              {/* Items */}
              <div className="flex flex-col">
                {todos.length === 0 ? (
                  <div className="text-[11px] text-[#9e9689] p-2 text-center border border-dashed rounded-[7px] border-[#d8d0c4]">
                    Alles erledigt für heute!
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
                      done={t.done}
                      onClick={() => {
                        if (t.targetHref) router.push(t.targetHref);
                        else {
                          setTodos(prev => prev.map(td => td.id === t.id ? { ...td, done: !td.done } : td));
                        }
                      }}
                    />
                  ))
                )}
              </div>
            </div>
            </>}

            {/* Demo-Badge removed */}
          </div>
        </div>

        {/* â”€â”€ ARBEITSLISTE WARENEINGANG â”€â”€ */}
        <div className="mt-12" style={{ animation: "fadeUp .5s .2s ease both" }}>
          <div className="text-[15px] font-bold text-[#5e5850] mb-4 flex items-center gap-2">
            Aktuelle Aufträge im Wareneingang
            <span className="flex-1 h-px bg-[#d8d0c4]" />
            {!stationListPending && !stationUnavailableMessage && <span className="text-xs bg-[#f4f0e8] px-2 py-1 rounded text-[#9e9689]">{stationOrders.length}</span>}
          </div>

          {stationListPending ? (
            <div className="p-3 rounded-[14px] text-sm text-[#5e5850]" role="status" style={{ background: "#faf8f4", border: "1.5px solid #d8d0c4" }}>
              Stationsliste wird geladen.
            </div>
          ) : stationUnavailableMessage ? (
            <div className="p-3 rounded-[14px] text-sm text-[#5e5850]" role="status" style={{ background: "#faf8f4", border: "1.5px solid #d8d0c4" }}>
              {stationUnavailableMessage}
            </div>
          ) : <>
            <p className="mb-3 text-xs text-[#9e9689]">Die Übergabe an Galvanik wird erst nach einem bestätigten Reload als erfolgreich angezeigt. Weitere Auftragsbearbeitung bleibt nicht verfügbar.</p>
            {handoffSuccessMessage ? <p className="mb-3 text-xs text-[#1a6b38]" role="status">{handoffSuccessMessage}</p> : null}
            {handoffConflictMessage ? <p className="mb-3 text-xs text-[#c0392b]" role="alert">{handoffConflictMessage}</p> : null}
            <div className="flex flex-col gap-2">
              {stationOrders.length > 0 ? (
                stationOrders.map((order) => {
                  const u = getUrgency(order.dueDate);
                  let urgencyType: "ok" | "soon" | "crit" | "wait" | "unknown" = "ok";
                  if (order.risk === "red") urgencyType = "crit";
                  else if (order.risk === "orange" || u === "gefaehrdet") urgencyType = "soon";
                  else if (order.risk === "blocked") urgencyType = "wait";
                  else if (order.risk === "unknown" || u === "unknown") urgencyType = "unknown";

                  return (
                    <div key={order.id}>
                    <OrderCompactCard
                      id={order.id}
                      orderNumber={order.orderNumber}
                      customerName={order.customerName || "Kunde nicht hinterlegt"}
                      article={order.itemDescription || "Artikel nicht hinterlegt"}
                      surface={order.surfaceRequested || "Oberfläche nicht hinterlegt"}
                      urgency={urgencyType}
                      dueValue={order.dueValue || (urgencyType === "unknown" ? "Nicht erfasst" : "--")}
                      dueLabel={order.dueLabel || (urgencyType === "unknown" ? "Termin" : "Fällig")}
                      badgeText={getLegacyStatusText(order) || "Wartend"}
                      onClick={() => openOrder(order.id)}
                    />
                    {Number.isSafeInteger(order.version) && order.version > 0 ? (
                      <WareneingangHandoffButton
                        orderId={order.id}
                        expectedVersion={order.version}
                        onConfirmedReadback={(nextWeOrders) => {
                          setStationOrders(nextWeOrders);
                          setHandoffConflictMessage(null);
                          setHandoffSuccessMessage("Übergabe an Galvanik bestätigt.");
                        }}
                        onConflictReadback={(nextWeOrders, message) => {
                          setStationOrders(nextWeOrders);
                          setHandoffSuccessMessage(null);
                          setHandoffConflictMessage(message);
                        }}
                      />
                    ) : null}
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center border-2 border-dashed border-[#d8d0c4] rounded-[14px] text-[#9e9689]">
                  Noch keine Daten erfasst. <Link href="/orders">Aufträge anzeigen</Link>
                </div>
              )}
            </div>
          </>}
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
  done,
  onClick,
}: {
  title: string;
  subtitle: string;
  tags: string[];
  action: string;
  priority?: string;
  live?: boolean;
  done?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`flex items-start gap-2 py-[7px] border-b border-[#d8d0c4] last:border-b-0 cursor-pointer transition-colors hover:bg-[#f4f0e8] hover:mx-[-6px] hover:px-[6px] hover:rounded-md ${done ? 'opacity-50' : ''}`}
    >
      <div className={`w-4 h-4 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center ${done ? 'border-[#1e7e45] bg-[#1e7e45]' : 'border-[#d8d0c4]'}`}>
        {done && <svg viewBox="0 0 24 24" className="w-2.5 h-2.5"><path d="M5 12l5 5 9-11" stroke="#fff" strokeWidth="3" fill="none" /></svg>}
      </div>
      <div className={`flex-1 min-w-0 ${done ? 'line-through text-[#9e9689]' : ''}`}>
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
