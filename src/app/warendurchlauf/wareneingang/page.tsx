"use client";

import Link from "next/link";
import {
  Camera, PenLine, Phone, MessageSquare, Clock,
  ChevronRight
} from "lucide-react";
import { useState, Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useErfassung } from "@/components/erfassung/ErfassungProvider";
import { OrderCompactCard } from "@/components/orders/OrderCompactCard";
import { getUrgency } from "@/lib/orders/getUrgency";
import { useOverlayStore } from "@/lib/overlayStore";
import {
  getWareneingangOrdersAction,
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

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   Wareneingang — nur echte Stationsdaten
   Einzige Datenquelle: getWareneingangOrdersAction.
   Es gibt keine abgeleiteten KPI-, Tages-, Trend- oder
   Checklistenanzeigen und keine festen Zaehlwerte.
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

function WarendurchlaufLeitstandContent() {
  const searchParams = useSearchParams();
  void searchParams;
  const { openErfassung } = useErfassung();
  const { openOrder } = useOverlayStore();
  const [stationOrders, setStationOrders] = useState<WarendurchlaufOrder[]>([]);
  const [stationUnavailableMessage, setStationUnavailableMessage] = useState<string | null>(null);
  const [stationAccessDenied, setStationAccessDenied] = useState(false);
  const [stationListLoaded, setStationListLoaded] = useState(false);
  const [stationListPending, setStationListPending] = useState(true);
  const [handoffSuccessMessage, setHandoffSuccessMessage] = useState<string | null>(null);
  const [handoffConflictMessage, setHandoffConflictMessage] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setStationListPending(true);
      setHandoffSuccessMessage(null);
      setHandoffConflictMessage(null);
      try {
        const resList = await getWareneingangOrdersAction();
        if (!resList.ok) {
          // Fail closed: kein Kartenbestand und kein leerer Erfolgszustand ohne gelesene Wahrheit.
          setStationOrders([]);
          setStationListLoaded(false);
          setStationAccessDenied(resList.error === "AUTH_ERROR" || resList.error === "FORBIDDEN");
          setStationUnavailableMessage(resList.message);
        } else {
          setStationOrders(resList.data);
          setStationListLoaded(true);
          setStationAccessDenied(false);
          setStationUnavailableMessage(null);
        }
      } catch {
        setStationOrders([]);
        setStationListLoaded(false);
        setStationAccessDenied(false);
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

  const showStationCount = !stationListPending && stationListLoaded && !stationUnavailableMessage;

  return (
    <div className="w-full h-full font-sans antialiased text-[#1a1a1a]">
      <div className="w-full mx-auto px-5 md:px-8 lg:px-12 xl:px-16 py-6">

        {stationAccessDenied ? (
          /* Denial: keine Karten, kein leerer Erfolgszustand, keine Intake-Controls. */
          <div
            data-testid="wareneingang-denied"
            role="status"
            className="p-4 rounded-[14px] text-sm text-[#5e5850]"
            style={{ background: "#faf8f4", border: "1.5px solid #d8d0c4" }}
          >
            <div className="text-[15px] font-bold text-[#1a1a1a] mb-1">Dieser Bereich ist geschützt</div>
            <p>{stationUnavailableMessage}</p>
          </div>
        ) : (
          <>
            {/* â”€â”€ NEUE ANNAHME ERFASSEN â”€â”€ */}
            <div style={{ animation: "fadeUp .4s .1s ease both" }}>
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

                {/* Telefonnotiz */}
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
                  data-testid="wareneingang-create-order"
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
                  <div className="text-[11px] text-[#9e9689]">Auftragsübersicht öffnen</div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#9e9689] shrink-0" />
              </Link>
            </div>

            {/* â”€â”€ ARBEITSLISTE WARENEINGANG â”€â”€ */}
            <div className="mt-12" style={{ animation: "fadeUp .5s .2s ease both" }}>
              <div className="text-[15px] font-bold text-[#5e5850] mb-4 flex items-center gap-2">
                Aktuelle Aufträge im Wareneingang
                <span className="flex-1 h-px bg-[#d8d0c4]" />
                {showStationCount && <span className="text-xs bg-[#f4f0e8] px-2 py-1 rounded text-[#9e9689]">{stationOrders.length}</span>}
              </div>

              {stationListPending ? (
                <div data-testid="wareneingang-loading" className="p-3 rounded-[14px] text-sm text-[#5e5850]" role="status" style={{ background: "#faf8f4", border: "1.5px solid #d8d0c4" }}>
                  Stationsliste wird geladen.
                </div>
              ) : stationUnavailableMessage ? (
                /* Error: keine Karten und kein leerer Erfolgszustand. */
                <div data-testid="wareneingang-error" className="p-3 rounded-[14px] text-sm text-[#5e5850]" role="status" style={{ background: "#faf8f4", border: "1.5px solid #d8d0c4" }}>
                  {stationUnavailableMessage}
                </div>
              ) : stationListLoaded ? (
                <>
                  <p className="mb-3 text-xs text-[#9e9689]">Die Übergabe an Galvanik wird erst nach einem bestätigten Reload als erfolgreich angezeigt. Weitere Auftragsbearbeitung bleibt nicht verfügbar.</p>
                  {handoffSuccessMessage ? <p className="mb-3 text-xs text-[#1a6b38]" data-testid="wareneingang-handoff-status" role="status">{handoffSuccessMessage}</p> : null}
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
                          <div data-testid={`wareneingang-order-${order.id}`} key={order.id}>
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
                </>
              ) : null}
            </div>
          </>
        )}
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
