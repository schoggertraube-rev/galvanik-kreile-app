"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CalendarDays, Loader2, PackageCheck, UserRound } from "lucide-react";
import {
  getExtraWorkMasterDataAction,
  getLiveOrderCardAction,
} from "@/app/actions/orders.actions";
import { AppOverlayPortal } from "@/components/ui/AppOverlayPortal";
import { ExtraWorkAdminPanel } from "@/components/orders/ExtraWorkAdminPanel";
import { OrderExtraWorkEditor } from "@/components/orders/OrderExtraWorkEditor";
import { OrderFreezeButton } from "@/components/orders/OrderFreezeButton";
import { OrderFreezeCorrectionButton } from "@/components/orders/OrderFreezeCorrectionButton";
import { OrderTaskAssignmentPanel } from "@/components/orders/OrderTaskAssignmentPanel";
import { usePermissions } from "@/lib/auth/PermissionsContext";
import { useOverlayStore } from "@/lib/overlayStore";
import type { EvidenceReadRecord } from "@/lib/server/evidenceRead";
import type { ExtraWorkMasterData, LiveOrderCard } from "@/lib/server/orderCardRead";

type DataState = "loading" | "data" | "empty" | "denied" | "error";
const STATIONS = ["angenommen", "galvanik", "fertig", "abgeholt"] as const;

function dateLabel(value: string | null): string {
  if (!value) return "Nicht erfasst";
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(date)
    : "Nicht verfügbar";
}

function EvidenceList({ evidence }: { evidence: EvidenceReadRecord[] }) {
  if (evidence.length === 0) {
    return <p className="text-xs text-text-muted">Noch keine Nachweise erfasst.</p>;
  }
  return (
    <ul className="grid gap-2 md:grid-cols-2">
      {evidence.map((record) => (
        <li key={record.evidenceKey} className="rounded-xl border border-neutral-gray-200 bg-white p-3">
          <p className="text-xs font-semibold text-navy-900">
            {record.source === "ORDER_INTAKE_ATTACHMENT" ? "Annahme-Original" : record.source === "ORDER_STATION_ATTACHMENT" ? "Stationsfoto" : "Alt-Nachweis"}
          </p>
          <p className="mt-1 text-[11px] text-text-muted">
            {record.original.state} · {dateLabel(record.recordedAt)}
          </p>
          {record.original.hash ? (
            <p className="mt-1 truncate font-mono text-[10px] text-text-muted" title={record.original.hash}>
              SHA-256 {record.original.hash}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function OrderOverlay() {
  const stack = useOverlayStore((state) => state.stack);
  const orderStack = useOverlayStore((state) => state.orderStack);
  const popOrder = useOverlayStore((state) => state.popOrder);
  const openCustomer = useOverlayStore((state) => state.openCustomer);
  const currentOrderId = orderStack.at(-1);
  const { role } = usePermissions();
  const [dataState, setDataState] = useState<DataState>("loading");
  const [message, setMessage] = useState("Auftragskarte wird geladen.");
  const [card, setCard] = useState<LiveOrderCard | null>(null);
  const [evidence, setEvidence] = useState<EvidenceReadRecord[]>([]);
  const [masterData, setMasterData] = useState<ExtraWorkMasterData | null>(null);

  const load = useCallback(async (orderId: string) => {
    setDataState("loading");
    setMessage("Auftragskarte wird geladen.");
    setCard(null);
    setEvidence([]);
    try {
      const [cardResult, masterResult] = await Promise.all([
        getLiveOrderCardAction({ orderId }),
        getExtraWorkMasterDataAction(),
      ]);
      if (cardResult.code !== "OK") {
        setMessage(cardResult.message);
        setDataState(
          cardResult.code === "UNAUTHENTICATED" || cardResult.code === "FORBIDDEN"
            ? "denied"
            : cardResult.code === "NOT_FOUND" ? "empty" : "error",
        );
        return;
      }
      if (masterResult.code !== "OK") {
        setMessage(masterResult.message);
        setDataState(
          masterResult.code === "UNAUTHENTICATED" || masterResult.code === "FORBIDDEN"
            ? "denied" : "error",
        );
        return;
      }
      setCard(cardResult.data.card);
      setEvidence(cardResult.data.evidence);
      setMasterData(masterResult.data);
      setDataState("data");
    } catch {
      setMessage("Auftragskarte konnte nicht sicher geladen werden.");
      setDataState("error");
    }
  }, []);

  useEffect(() => {
    if (!currentOrderId) return;
    const timer = window.setTimeout(() => void load(currentOrderId), 0);
    return () => window.clearTimeout(timer);
  }, [currentOrderId, load]);

  if (!currentOrderId) return null;

  const stackIndex = stack.findLastIndex((item) => item.type === "order" && item.id === currentOrderId);
  const zIndex = stackIndex >= 0 ? 1010 + stackIndex * 10 : 1010;
  const currentStationIndex = card ? STATIONS.indexOf(card.station as (typeof STATIONS)[number]) : -1;

  return (
    <AppOverlayPortal>
      <div className="fixed inset-0 z-[1000]">
        <button aria-label="Auftragskarte schließen" className="absolute inset-0 h-full w-full cursor-default bg-black/35 backdrop-blur-sm" data-testid="order-overlay-backdrop" onClick={popOrder} type="button" />
        <div className="relative flex h-full w-full items-center justify-center p-0 sm:p-3" style={{ zIndex }}>
          <section aria-label="Lebende Auftragskarte" className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[94dvh] sm:max-w-6xl sm:rounded-2xl" data-testid="live-order-card" onClick={(event) => event.stopPropagation()}>
            <header className="flex shrink-0 items-center justify-between border-b border-neutral-gray-200 bg-bg-app-soft px-4 py-4 md:px-6">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Lebende Auftragskarte</p>
                <h2 className="truncate text-xl font-bold text-navy-900">{card ? `${card.orderNumber} · ${card.title}` : "Auftrag"}</h2>
              </div>
              <button aria-label="Auftragskarte schließen" className="min-h-11 min-w-11 rounded-full border border-neutral-gray-200 bg-white text-xl text-navy-900" onClick={popOrder} type="button">×</button>
            </header>

            <div className="flex-1 overflow-y-auto p-4 pb-8 md:p-6">
              {dataState === "loading" ? (
                <div className="flex min-h-64 flex-col items-center justify-center text-text-muted" role="status">
                  <Loader2 className="mb-3 h-7 w-7 animate-spin" />
                  <p>{message}</p>
                </div>
              ) : dataState === "denied" ? (
                <div className="mx-auto max-w-xl rounded-xl bg-[#fdf0ee] p-5 text-center text-[#c0392b]" role="status">
                  <AlertTriangle className="mx-auto mb-2 h-6 w-6" />
                  <strong>Zugriff nicht erlaubt</strong>
                  <p className="mt-1 text-sm">{message}</p>
                </div>
              ) : dataState === "empty" ? (
                <div className="mx-auto max-w-xl rounded-xl border border-dashed border-neutral-gray-300 p-6 text-center text-text-muted" role="status">
                  <PackageCheck className="mx-auto mb-2 h-6 w-6" />
                  <p>Auftrag wurde nicht gefunden oder gehört nicht zu diesem Mandanten.</p>
                </div>
              ) : dataState === "error" || !card || !masterData ? (
                <div className="mx-auto max-w-xl rounded-xl bg-[#fdf0ee] p-5 text-center text-[#c0392b]" role="status">
                  <AlertTriangle className="mx-auto mb-2 h-6 w-6" />
                  <p>{message}</p>
                  <button type="button" onClick={() => void load(currentOrderId)} className="mt-3 min-h-10 rounded-lg border border-[#c0392b]/40 bg-white px-4 text-sm font-semibold">Erneut laden</button>
                </div>
              ) : (
                <div className="space-y-6">
                  <section className="grid gap-3 md:grid-cols-3">
                    <button type="button" data-testid="order-customer-trigger" onClick={() => openCustomer(card.customerId)} className="flex min-h-20 items-center gap-3 rounded-xl border border-neutral-gray-200 bg-white p-4 text-left hover:border-navy-900">
                      <UserRound className="h-5 w-5 text-text-muted" />
                      <span><span className="block text-xs text-text-muted">Kunde</span><strong className="text-sm text-navy-900">{card.customerName}</strong></span>
                    </button>
                    <div className="flex min-h-20 items-center gap-3 rounded-xl border border-neutral-gray-200 bg-white p-4">
                      <CalendarDays className="h-5 w-5 text-text-muted" />
                      <span><span className="block text-xs text-text-muted">Termin</span><strong className="text-sm text-navy-900">{dateLabel(card.dueAt)}</strong></span>
                    </div>
                    <div className="min-h-20 rounded-xl border border-neutral-gray-200 bg-white p-4">
                      <span className="block text-xs text-text-muted">Annahme</span><strong className="text-sm text-navy-900">{dateLabel(card.intakeAt)}</strong>
                    </div>
                  </section>

                  <section aria-label="Ortskette" className="rounded-xl border border-neutral-gray-200 bg-bg-app-soft p-4">
                    <div className="grid grid-cols-4 gap-2">
                      {STATIONS.map((station, index) => (
                        <div key={station} className={`rounded-lg px-2 py-3 text-center text-xs font-semibold ${index <= currentStationIndex ? "bg-navy-900 text-white" : "bg-white text-text-muted"}`}>
                          {station[0]?.toUpperCase()}{station.slice(1)}
                        </div>
                      ))}
                    </div>
                    <p className="mt-3 text-xs text-text-muted">Ort ist der Werkstattzustand; Zahlung bleibt eine getrennte, hier inaktive Achse.</p>
                  </section>

                  <OrderTaskAssignmentPanel
                    order={card}
                    role={role}
                    onConfirmedCard={setCard}
                  />

                  {card.note ? <section className="rounded-xl border border-neutral-gray-200 bg-white p-4"><h3 className="text-sm font-semibold text-navy-900">Notiz</h3><p className="mt-1 whitespace-pre-wrap text-sm text-text-muted">{card.note}</p></section> : null}

                  <section>
                    <h3 className="mb-3 text-base font-bold text-navy-900">Teile und Mehrarbeit</h3>
                    <div className="space-y-4">
                      {card.items.map((item) => (
                        <article key={item.id} className="rounded-2xl border border-neutral-gray-200 bg-bg-app-soft p-4">
                          <div className="mb-3 grid gap-2 md:grid-cols-[auto_1fr_auto] md:items-center">
                            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-navy-900 text-xs font-bold text-white">{item.position}</span>
                            <div><h4 className="font-semibold text-navy-900">{item.name}</h4><p className="text-xs text-text-muted">{item.quantity} Stück · {item.material ?? "Material nicht erfasst"} · {item.surfaceRequested}</p></div>
                            <span className="text-xs font-semibold text-text-muted">6 Intake-Felder bestätigt</span>
                          </div>
                          <OrderExtraWorkEditor
                            order={card}
                            item={item}
                            masterData={masterData}
                            onConfirmedCard={setCard}
                          />
                        </article>
                      ))}
                    </div>
                  </section>

                  <section><h3 className="mb-3 text-base font-bold text-navy-900">Nachweise</h3><EvidenceList evidence={evidence} /></section>

                  <section className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-xl border border-dashed border-neutral-gray-300 p-4"><p className="text-xs text-text-muted">Geplanter Kennzahlen-Steckplatz</p><strong className="text-sm text-navy-900">Deckungsbeitrag: —</strong></div>
                    <div className="rounded-xl border border-dashed border-neutral-gray-300 p-4"><p className="text-xs text-text-muted">Geplanter Kennzahlen-Steckplatz</p><strong className="text-sm text-navy-900">Durchlaufkennzahl: —</strong></div>
                  </section>

                  {role === "admin" ? (
                    <ExtraWorkAdminPanel
                      masterData={masterData}
                      onConfirmed={setMasterData}
                    />
                  ) : null}

                  <OrderFreezeButton order={card} rateConfigured={masterData.currentRate !== null} onConfirmedCard={setCard} />

                  <OrderFreezeCorrectionButton
                    order={card}
                    role={role}
                    onConfirmedCard={setCard}
                  />

                  <section className="rounded-xl border border-dashed border-neutral-gray-300 p-4 text-sm text-text-muted">
                    Zahlung und Abholung sind sichtbar geplant, bleiben in F1.3 jedoch inaktiv. Keine Buchungs- oder Warenausgangsaktion wurde vorgezogen.
                  </section>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </AppOverlayPortal>
  );
}
