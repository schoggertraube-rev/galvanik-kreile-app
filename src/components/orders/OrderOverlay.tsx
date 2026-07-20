import React, { useState } from "react";
import { useOverlayStore } from "@/lib/overlayStore";
import { useOrderLive } from "@/lib/useOrderLive";
import { PaymentDrawer } from "./PaymentDrawer";
import { StatusMailDrawer } from "./StatusMailDrawer";
import { ItemDrawer } from "./ItemDrawer";
import { 
  X, Check, AlertTriangle, Clock, Package, Info,
  Send, Phone, FileText, Receipt, Truck, ArrowRight
} from "lucide-react";
import { HeadCostBadge } from "./HeadCostBadge";
import { AppOverlayPortal } from "@/components/ui/AppOverlayPortal";
import { parseRouteSnapshot } from "@/lib/orders/routeSnapshot";
import { normalizeStoredOrderStatus } from "@/lib/orders/orderMutationContract";
import { HandoverVariant } from "./variants/HandoverVariant";
import { StationStatusButton } from "./StationStatusButton";

function riskLabel(value: string | null): string {
  switch (value) {
    case "green": return "Im Plan";
    case "yellow": return "Achtung";
    case "orange": return "Gefährdet";
    case "red": return "Kritisch";
    case "blocked": return "Blockiert";
    default: return "Nicht bewertet";
  }
}

function stationLabel(value: string | null): string {
  if (!value) return "Nicht hinterlegt";
  return value.replaceAll("_", " ").replace(/^./, (character) => character.toUpperCase());
}

export function OrderOverlay() {
  const stack = useOverlayStore(state => state.stack);
  const orderStack = useOverlayStore((state) => state.orderStack);
  const popOrder = useOverlayStore((state) => state.popOrder);
  const openCustomer = useOverlayStore((state) => state.openCustomer);
  const [showPayment, setShowPayment] = useState(false);
  const [showMail, setShowMail] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | 'new' | null>(null);

  const currentOrderId = orderStack.length > 0 ? orderStack[orderStack.length - 1] : null;

  const { orderData, loading, error } = useOrderLive(currentOrderId);

  if (!currentOrderId) return null;
  
  // Calc z-indexes
  const stackIndex = stack.findLastIndex(item => item.type === 'order' && item.id === currentOrderId);
  const zIndex = 1010 + (stackIndex >= 0 ? stackIndex * 10 : 0);

  if (loading) {
    return (
      <AppOverlayPortal>
        <div className="fixed inset-0 z-[1000]">
          <div className="absolute inset-0 bg-black/35 backdrop-blur-sm" />
          <div className="relative h-full w-full flex items-center justify-center" style={{ zIndex }}>
            <div className="bg-[var(--ci-surface)] p-8 rounded-[18px] shadow-lg flex flex-col items-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--ci-ink)] mb-4"></div>
              <span className="text-[var(--ci-ink-2)] font-medium text-sm">Lade Auftragsdaten...</span>
            </div>
          </div>
        </div>
      </AppOverlayPortal>
    );
  }

  if (!orderData) {
    return (
      <AppOverlayPortal>
        <div className="fixed inset-0 z-[1000]">
          <div className="absolute inset-0 bg-black/35 backdrop-blur-sm" />
          <div className="relative h-full w-full flex items-center justify-center" style={{ zIndex }}>
            <div className="bg-[var(--ci-surface)] p-8 rounded-[18px] shadow-lg max-w-md w-full text-center">
              <AlertTriangle className="h-10 w-10 text-[var(--ci-warn)] mx-auto mb-4" />
              <h3 className="text-lg font-serif text-[var(--ci-ink)] mb-2">Auftrag nicht gefunden</h3>
              <p className="text-[var(--ci-ink-3)] text-sm mb-6">{error || "Auftrag wurde nicht gefunden."}</p>
              <button onClick={popOrder} className="px-6 py-2 bg-[var(--ci-ink)] text-white rounded-[12px] font-medium hover:opacity-80 transition-opacity">
                Schließen
              </button>
            </div>
          </div>
        </div>
      </AppOverlayPortal>
    );
  }

  const hasItems = orderData.items && orderData.items.length > 0;
  const canViewPrices = orderData.capabilities.canViewPrices;
  const canViewCustomerDetails = orderData.capabilities.canViewCustomerDetails;
  const canEditOrders = orderData.capabilities.canEditOrders;
  const canCompleteHandover = orderData.capabilities.canCompleteHandover;
  const currentCost = canViewPrices && orderData.dbIst != null ? Number(orderData.dbIst) : null;
  const benchmarkCost = canViewPrices && orderData.dbGeplant != null ? Number(orderData.dbGeplant) : undefined;
  const storedStation = orderData.currentStationId || orderData.station || null;
  const storedStatus = normalizeStoredOrderStatus(orderData.status || "");

  return (
    <AppOverlayPortal>
      <style>{`
        .ci-modal-wrap {
          /* Tokens from ci-tokens.css are applied globally */
        }
        .ci-backdrop { position: absolute; inset: 0; background: rgba(0,0,0,0.35); backdrop-filter: blur(4px); }
        .ci-modal-container { 
          position: relative; 
          height: 100%; 
          width: 100%;
          display: flex; 
          justify-content: center; 
          align-items: center; 
          padding: 0;
        }
        @media (min-width: 640px) {
          .ci-modal-container { padding: 12px; }
        }
        .ci-modal { 
          background: var(--ci-surface); 
          box-shadow: 0 12px 32px rgba(20,15,5,0.08); 
          font-family: var(--ci-font-sans); 
          color: var(--ci-ink);
          display: flex;
          flex-direction: column;
        }
        .ci-modal-head { padding: 24px 28px 18px; border-bottom: 1px solid var(--ci-border); display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
        .ci-head-left { flex: 1; }
        .ci-order-number { font-family: var(--ci-font-serif); font-size: 38px; font-weight: 400; line-height: 1; color: var(--ci-ink); letter-spacing: -0.5px; }
        .ci-order-title { font-family: var(--ci-font-serif); font-size: 22px; font-weight: 400; color: var(--ci-ink); margin-top: 6px; }
        .ci-head-meta { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 10px; }
        .ci-pill { display: inline-flex; align-items: center; gap: 6px; padding: 5px 11px; border-radius: 999px; font-size: 12px; font-weight: 500; }
        .ci-pill-accent { background: var(--ci-accent); color: #fff; }
        .ci-pill-warn { background: var(--ci-warn-soft); color: #6B4A0D; }
        .ci-pill-success { background: var(--ci-success-soft); color: #2D5132; }
        .ci-pill-customer { background: var(--ci-ink); color: var(--ci-surface); padding: 7px 14px; text-decoration: none; cursor: pointer; transition: background 0.15s; }
        .ci-pill-customer:hover { background: #2A3045; }
        .ci-close-btn { background: transparent; border: 1px solid var(--ci-border); width: 40px; height: 40px; border-radius: 999px; cursor: pointer; display: flex; align-items: center; justify-content: center; color: var(--ci-ink-2); flex-shrink: 0; transition: background 0.15s; }
        .ci-close-btn:hover { background: var(--ci-surface-soft); }
        .ci-modal-body { display: grid; grid-template-columns: 1.6fr 1fr; gap: 0; }
        @media (max-width: 900px) { .ci-modal-body { grid-template-columns: 1fr; } }
        .ci-col-left { padding: 22px 24px 28px; border-right: 1px solid var(--ci-border); }
        .ci-col-right { padding: 22px 24px 28px; background: var(--ci-bg); }
        .ci-section { margin-bottom: 22px; }
        .ci-section:last-child { margin-bottom: 0; }
        .ci-section-label { font-size: 10px; color: var(--ci-ink-3); letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 12px; font-weight: 500; }
        .ci-stations { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; align-items: start; }
        .ci-station { display: flex; flex-direction: column; align-items: center; gap: 8px; cursor: pointer; padding: 6px 4px; border-radius: 12px; transition: background 0.15s; }
        .ci-station:hover { background: var(--ci-surface-soft); }
        .ci-station-circle { width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .ci-station-done { background: var(--ci-success); color: #fff; }
        .ci-station-active { background: var(--ci-accent); color: #fff; box-shadow: 0 0 0 4px rgba(194, 24, 91, 0.18); }
        .ci-station-wait { background: transparent; border: 1.5px dashed var(--ci-border); color: var(--ci-ink-3); }
        .ci-station-label { font-size: 12px; font-weight: 500; color: var(--ci-ink); text-align: center; }
        .ci-station-label.muted { color: var(--ci-ink-3); font-weight: 400; }
        .ci-station-sub { font-size: 10px; color: var(--ci-ink-3); text-align: center; }
        .ci-station-sub.accent { color: var(--ci-accent); font-weight: 500; }
        .ci-kpi-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
        .ci-kpi-card { background: var(--ci-surface); border: 1px solid var(--ci-border); border-radius: var(--ci-radius-button); padding: 13px 14px; }
        .ci-kpi-card.warn { background: var(--ci-warn-soft); border-color: rgba(216,154,44,0.25); }
        .ci-kpi-label { font-size: 10px; color: var(--ci-ink-3); letter-spacing: 0.5px; text-transform: uppercase; }
        .ci-kpi-value { font-family: var(--ci-font-serif); font-size: 22px; font-weight: 400; color: var(--ci-ink); margin-top: 4px; line-height: 1.1; }
        .ci-kpi-value.warn-text { color: #6B4A0D; }
        .ci-kpi-trend { font-size: 11px; color: var(--ci-success); margin-top: 4px; }
        .ci-kpi-trend.warn-text { color: #6B4A0D; }
        .ci-kpi-sub { font-size: 11px; color: var(--ci-ink-3); margin-top: 2px; }
        .ci-item-list { display: flex; flex-direction: column; gap: 8px; }
        .ci-item-card { background: var(--ci-surface); border: 1px solid var(--ci-border); border-radius: 14px; padding: 12px 14px; cursor: pointer; transition: transform 0.12s, box-shadow 0.12s; display: grid; grid-template-columns: 56px 1fr auto; gap: 12px; align-items: center; }
        .ci-item-card:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(20,15,5,0.06); }
        .ci-item-photo { width: 56px; height: 56px; border-radius: 10px; background: var(--ci-surface-soft); display: flex; align-items: center; justify-content: center; color: var(--ci-ink-3); font-size: 11px; }
        .ci-item-photo.has-photo { background: linear-gradient(135deg, #B89F7A, #8E7355); color: rgba(255,255,255,0.85); }
        .ci-item-body { min-width: 0; }
        .ci-item-top { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .ci-item-num { font-family: var(--ci-font-serif); font-size: 14px; color: var(--ci-ink); }
        .ci-item-name { font-size: 14px; font-weight: 500; color: var(--ci-ink); }
        .ci-item-condition { padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: 500; }
        .ci-cond-mid { background: var(--ci-warn-soft); color: #6B4A0D; }
        .ci-cond-light { background: var(--ci-success-soft); color: #2D5132; }
        .ci-cond-strong { background: var(--ci-danger-soft); color: #6B1E1B; }
        .ci-item-meta { font-size: 12px; color: var(--ci-ink-2); margin-top: 4px; }
        .ci-item-progress { font-size: 11px; color: var(--ci-ink-3); margin-top: 4px; display: flex; align-items: center; gap: 6px; }
        .ci-item-progress-dots { display: inline-flex; gap: 3px; }
        .ci-pdot { width: 6px; height: 6px; border-radius: 50%; }
        .ci-pdot.done { background: var(--ci-success); }
        .ci-pdot.active { background: var(--ci-accent); }
        .ci-pdot.wait { background: var(--ci-border); }
        .ci-item-price { text-align: right; }
        .ci-item-price-val { font-family: var(--ci-font-serif); font-size: 18px; color: var(--ci-ink); }
        .ci-item-price-val.missing { color: var(--ci-danger); font-size: 12px; font-family: var(--ci-font-sans); }
        .ci-item-price-sub { font-size: 10px; color: var(--ci-ink-3); }
        .ci-add-item-btn { background: transparent; border: 1.5px dashed var(--ci-border); color: var(--ci-ink-2); padding: 12px; border-radius: 14px; cursor: pointer; font-family: var(--ci-font-sans); font-size: 13px; display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; transition: all 0.15s; }
        .ci-add-item-btn:hover { border-color: var(--ci-accent); color: var(--ci-accent); }
        .ci-item-sum { display: flex; justify-content: space-between; align-items: baseline; padding: 12px 4px 0; border-top: 1px solid var(--ci-border); margin-top: 8px; }
        .ci-item-sum-label { font-size: 11px; color: var(--ci-ink-3); letter-spacing: 0.5px; text-transform: uppercase; }
        .ci-item-sum-val { font-family: var(--ci-font-serif); font-size: 22px; color: var(--ci-ink); }
        .ci-cust-row { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; }
        .ci-cust-card { background: var(--ci-surface); border: 1px solid var(--ci-border); border-radius: 10px; padding: 10px; text-align: left; }
        .ci-cust-label { font-size: 9px; color: var(--ci-ink-3); letter-spacing: 0.5px; text-transform: uppercase; }
        .ci-cust-val { font-family: var(--ci-font-serif); font-size: 16px; color: var(--ci-ink); margin-top: 2px; line-height: 1.1; }
        .ci-cust-val.green { color: var(--ci-success); }
        .ci-quick-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
        .ci-qa { background: var(--ci-surface); border: 1px solid var(--ci-border); padding: 12px 8px; border-radius: var(--ci-radius-button); cursor: pointer; font-family: var(--ci-font-sans); display: flex; flex-direction: column; align-items: center; gap: 5px; color: var(--ci-ink); transition: background 0.12s; }
        .ci-qa:hover { background: var(--ci-surface-soft); }
        .ci-qa.primary { background: var(--ci-ink); color: var(--ci-surface); border-color: var(--ci-ink); }
        .ci-qa.primary:hover { background: #2A3045; }
        .ci-qa-label { font-size: 11px; }
        .ci-history { display: flex; flex-direction: column; gap: 2px; }
        .ci-h-item { display: grid; grid-template-columns: 28px 1fr; gap: 10px; padding: 10px 0; position: relative; }
        .ci-h-item:not(:last-child)::after { content: ""; position: absolute; left: 13px; top: 32px; bottom: -4px; width: 1px; background: var(--ci-border); }
        .ci-h-dot { width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; z-index: 2; position: relative; flex-shrink: 0; }
        .ci-h-dot.done { background: var(--ci-success-soft); color: var(--ci-success); }
        .ci-h-dot.info { background: var(--ci-surface-soft); color: var(--ci-ink-2); }
        .ci-h-dot.warn { background: var(--ci-warn-soft); color: var(--ci-warn); }
        .ci-h-time { font-size: 10px; color: var(--ci-ink-3); }
        .ci-h-title { font-size: 13px; color: var(--ci-ink); margin-top: 1px; }
        .ci-h-sub { font-size: 11px; color: var(--ci-ink-3); margin-top: 1px; }
        .ci-modal-foot { padding: 16px 28px; background: var(--ci-bg); border-top: 1px solid var(--ci-border); display: flex; justify-content: flex-end; gap: 8px; border-bottom-left-radius: var(--ci-radius-card); border-bottom-right-radius: var(--ci-radius-card); }
        .ci-btn { padding: 10px 18px; border-radius: var(--ci-radius-button); font-family: var(--ci-font-sans); font-size: 13px; font-weight: 500; cursor: pointer; border: 1px solid var(--ci-border); background: var(--ci-surface); color: var(--ci-ink); }
        .ci-btn:hover { background: var(--ci-surface-soft); }
        .ci-btn-primary { background: var(--ci-ink); color: var(--ci-surface); border-color: var(--ci-ink); display: inline-flex; align-items: center; gap: 6px; }
        .ci-btn-primary:hover { background: #2A3045; }
      `}</style>

      <div className="fixed inset-0 z-[1000]">
        <div className="ci-backdrop" onClick={popOrder}></div>
        <div className="ci-modal-container" style={{ zIndex }}>
          <div className={`ci-modal
            fixed inset-0
            h-[100dvh] w-screen
            overflow-y-auto
            bg-white
            sm:inset-auto sm:relative
            sm:w-full sm:md:w-[92vw] sm:lg:max-w-6xl
            sm:h-auto sm:max-h-[92dvh]
            sm:rounded-2xl
          `}>
            {/* HEADER */}
            <div className="ci-modal-head">
              <div className="ci-head-left">
                <div className="ci-order-number">{orderData.orderNumber || orderData.id}</div>
                <div className="ci-order-title">{orderData.title || orderData.task || "Kein Titel vergeben"}</div>
                <div className="ci-head-meta">
                  {orderData.priority === 'express' && <span className="ci-pill ci-pill-accent"><AlertTriangle className="w-3 h-3"/>Express</span>}
                  <span className="ci-pill ci-pill-warn"><span className="w-1.5 h-1.5 bg-[var(--ci-warn)] rounded-full"></span>{stationLabel(storedStation)}</span>
                  {orderData.dueDate && <span className="ci-pill ci-pill-success">Fällig {new Date(orderData.dueDate).toLocaleDateString()}</span>}
                  <button 
                    className="ci-pill ci-pill-customer flex items-center gap-1"
                    disabled={!canViewCustomerDetails}
                    title={canViewCustomerDetails ? "Kundendetails öffnen" : "Kundendetails sind für diese Rolle nicht freigegeben"}
                    onClick={() => {
                      if (!canViewCustomerDetails) return;
                      const cid = orderData.customer?.id || orderData.customerId;
                      if (cid) openCustomer(cid);
                    }}
                  >
                    <Info className="w-3 h-3"/> {orderData.customer?.name || "Kunde nicht verfügbar"} <ArrowRight className="w-3 h-3"/>
                  </button>
                </div>
              </div>

              {currentCost !== null && Number.isFinite(currentCost) && (
                <HeadCostBadge
                  currentCostEur={currentCost}
                  benchmarkEur={benchmarkCost !== undefined && Number.isFinite(benchmarkCost) ? benchmarkCost : undefined}
                />
              )}

              <button className="ci-close-btn" onClick={popOrder} aria-label="Schließen">
                <X className="w-5 h-5"/>
              </button>
            </div>

            {/* BODY */}
            <div className="ci-modal-body">
              {/* LINKE SPALTE */}
              <div className="ci-col-left">
                
                {/* Gespeicherte Stationswahrheit; keine Route wird abgeleitet. */}
                <div className="ci-section">
                  <div className="ci-section-label">Aktuelle Lage</div>
                  <div className="rounded-xl border border-[var(--ci-border)] bg-[var(--ci-surface)] p-4">
                    <div className="flex items-center gap-3">
                      <div className="ci-station-circle ci-station-active"><Package className="h-5 w-5" /></div>
                      <div>
                        <div className="text-xs uppercase tracking-wider text-[var(--ci-ink-3)]">Gespeicherte aktuelle Station</div>
                        <div className="font-semibold text-[var(--ci-ink)]">{stationLabel(storedStation)}</div>
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-[var(--ci-ink-3)]">Ein historischer Stationsweg wird erst angezeigt, wenn ein versionierter Routen-Snapshot und atomare Übergabebelege vorhanden sind.</p>
                  </div>
                </div>

                {storedStation === "warenausgang" ? (
                  <div id="active-handover" className="ci-section">
                    {!canCompleteHandover ? (
                      <div className="rounded-xl border border-dashed border-[var(--ci-border)] p-4 text-xs text-[var(--ci-ink-3)]">
                        Keine Berechtigung zum Bestätigen der physischen Übergabe.
                      </div>
                    ) : storedStatus === "ready" ? (
                      <div className="space-y-3">
                        <p className="text-xs text-[var(--ci-ink-3)]">Vor dem Übergabebeleg muss der Warenausgang atomar gestartet werden.</p>
                        <StationStatusButton
                          orderId={orderData.id}
                          customerId={orderData.customerId}
                          currentStationId="warenausgang"
                          currentStatus="ready"
                        />
                      </div>
                    ) : storedStatus === "in_progress" ? (
                      <HandoverVariant orderId={orderData.id} customerName={orderData.customer?.name || "Kunde nicht verfügbar"} />
                    ) : storedStatus === "shipped" || storedStatus === "completed" ? (
                      <div className="rounded-xl border border-green-300 bg-green-50 p-4 text-sm font-semibold text-green-900">
                        Der Auftrag besitzt einen terminalen Übergabestatus. Der zugehörige Beleg ist in der Auftragshistorie sichtbar.
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-[var(--ci-border)] p-4 text-xs text-[var(--ci-ink-3)]">
                        Der gespeicherte Auftragsstatus erlaubt aktuell keinen Übergabebeleg.
                      </div>
                    )}
                  </div>
                ) : (
                  <div id="station-context-block" className="ci-section rounded-xl border border-dashed border-[var(--ci-border)] p-4 text-xs text-[var(--ci-ink-3)]">
                    Stationskosten und Margen sind in diesem Overlay noch nicht belastbar instrumentiert. Buchungen erfolgen über die verifizierten Teile- und Lagerpfade.
                  </div>
                )}

                {/* KPIs */}
                <div className="ci-section">
                  <div className="ci-kpi-row">
                    <div className={`ci-kpi-card ${orderData.risk === 'red' ? 'bg-[var(--ci-danger-soft)] border-red-200' : orderData.risk === 'yellow' ? 'bg-[var(--ci-warn-soft)] border-yellow-200' : ''}`}>
                      <div className="ci-kpi-label"><Clock className="w-3 h-3 inline-block" /> Risiko</div>
                      <div className={`ci-kpi-value ${orderData.risk === 'red' ? 'text-[var(--ci-danger)]' : orderData.risk === 'yellow' ? 'text-[#6B4A0D]' : ''}`}>
                        {riskLabel(orderData.risk)}
                      </div>
                    </div>
                    <div className="ci-kpi-card ci-warn">
                      <div className="ci-kpi-label">Status</div>
                      <div className="ci-kpi-value ci-warn-text">{orderData.statusText || orderData.status || 'Nicht hinterlegt'}</div>
                    </div>
                    <div className="ci-kpi-card">
                      <div className="ci-kpi-label">Fällig</div>
                      <div className="ci-kpi-value">{orderData.dueDate ? new Date(orderData.dueDate).toLocaleDateString() : '-'}</div>
                    </div>
                  </div>
                </div>

                {/* TEILELISTE */}
                <div className="ci-section">
                  <div className="flex justify-between items-baseline mb-3">
                    <div className="ci-section-label !mb-0">Teile · {hasItems ? orderData.items.length : 0}</div>
                  </div>
                  <div className="ci-item-list">
                    {!hasItems ? (
                      <div className="text-center p-6 bg-[var(--ci-surface)] border border-[var(--ci-border)] rounded-[14px]">
                        <span className="text-[var(--ci-ink-3)] text-sm">Noch keine Daten erfasst</span>
                      </div>
                    ) : (
                      orderData.items.map((item, idx) => {
                        const itemPriceLines = (orderData.priceLines || []).filter((line) => line.itemId === item.id);
                        const itemPrice = itemPriceLines.reduce((sum, line) => sum + Number(line.unitTotalEur || 0), 0);

                        return <div key={item.id || idx} className={`ci-item-card transition-colors ${canEditOrders ? "cursor-pointer hover:border-[var(--ci-ink-3)]" : ""}`} onClick={() => canEditOrders && setEditingItemId(item.id)}>
                          <div className={`ci-item-photo ${Array.isArray(item.photoIds) && item.photoIds.length > 0 ? 'has-photo' : ''}`}>
                            <Package className="w-5 h-5"/>
                          </div>
                          <div className="ci-item-body">
                            <div className="ci-item-top">
                              <span className="ci-item-num">T-{String(idx+1).padStart(2, '0')}</span>
                              <span className="ci-item-name">{item.name}</span>
                              <span className="ci-item-condition ci-cond-light">Menge: {item.quantity}</span>
                            </div>
                            <div className="ci-item-meta">{item.material || 'Material erfassen'} → {item.surfaceRequested || 'Zielfinish erfassen'}</div>
                          </div>
                          <div className="ci-item-price">
                            {!canViewPrices ? (
                              <div className="ci-item-price-val missing">Nicht freigegeben</div>
                            ) : itemPriceLines.length > 0 ? (
                              <div className="ci-item-price-val">{itemPrice.toFixed(2)} €</div>
                            ) : (
                              <div className="ci-item-price-val missing">Preis offen</div>
                            )}
                          </div>
                        </div>;
                      })
                    )}

                    {canViewPrices ? (
                      <div className="ci-item-sum">
                        <span className="ci-item-sum-label">Summe netto</span>
                        <span className="ci-item-sum-val">
                          {(orderData.priceLines || []).reduce((sum, line) => sum + Number(line.unitTotalEur || 0), 0).toFixed(2)} €
                        </span>
                      </div>
                    ) : (
                      <div className="ci-item-sum text-xs text-[var(--ci-ink-3)]">Preise sind für diese Rolle nicht freigegeben.</div>
                    )}
                  </div>
                </div>

                {/* CUSTOMER KPIs */}
                <div className="ci-section">
                  <div className="ci-section-label">Kunden-Werte</div>
                  {!canViewCustomerDetails ? (
                    <div className="text-[var(--ci-ink-3)] text-xs">Kundenauswertungen sind für diese Rolle nicht freigegeben.</div>
                  ) : orderData.customerKpis ? (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-[var(--ci-surface)] border border-[var(--ci-border)] rounded-lg p-3">
                        <div className="text-[9px] text-[var(--ci-ink-3)] uppercase tracking-wider mb-1">Lifetime Revenue</div>
                        <div className="text-xs font-bold text-[var(--ci-ink-3)]">Nicht angebunden</div>
                      </div>
                      <div className="bg-[var(--ci-surface)] border border-[var(--ci-border)] rounded-lg p-3">
                        <div className="text-[9px] text-[var(--ci-ink-3)] uppercase tracking-wider mb-1">Aktive Aufträge</div>
                        <div className="font-serif text-lg text-[var(--ci-ink)]">{orderData.customerKpis.activeOrdersCount}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-[var(--ci-ink-3)] text-xs">Noch keine Daten erfasst</div>
                  )}
                </div>
              </div>

              {/* RECHTE SPALTE */}
              <div className="ci-col-right">
                
                {/* QUICK ACTIONS */}
                <div className="ci-section">
                  <div className="ci-section-label">Schnellaktionen</div>
                  <div className="ci-quick-actions">
                    <button
                      className="ci-qa accent-link"
                      onClick={() => setEditingItemId(orderData.items[0]?.id || "new")}
                      style={{ background: 'var(--ci-accent)', color: '#fff', borderColor: 'var(--ci-accent)' }}
                    >
                      <Package className="w-[18px] h-[18px]"/><span className="ci-qa-label">Teile</span>
                    </button>
                    <button className="ci-qa ci-primary" onClick={() => setShowMail(true)}>
                      <Send className="w-[18px] h-[18px]"/><span className="ci-qa-label">Status-Mail</span>
                    </button>
                    
                    <button className="ci-qa" disabled title="Fotos werden sicher am konkreten Teil erfasst."><span className="ci-qa-label">Foto am Teil</span></button>

                    {orderData.customer?.phone ? (
                      <a className="ci-qa" href={`tel:${orderData.customer.phone}`}><Phone className="w-[18px] h-[18px]"/><span className="ci-qa-label">Anrufen</span></a>
                    ) : (
                      <button className="ci-qa" disabled title="Keine Telefonnummer hinterlegt"><Phone className="w-[18px] h-[18px]"/><span className="ci-qa-label">Anrufen</span></button>
                    )}
                    <button className="ci-qa" disabled title="Kostenvoranschlag ist hier noch nicht angebunden"><FileText className="w-[18px] h-[18px]"/><span className="ci-qa-label">KV</span></button>
                    {canViewPrices ? (
                      <button className="ci-qa" onClick={() => setShowPayment(true)}>
                        <Receipt className="w-[18px] h-[18px]"/><span className="ci-qa-label">Zahlungslink</span>
                      </button>
                    ) : (
                      <button className="ci-qa" disabled title="Finanzdaten sind für diese Rolle nicht freigegeben">
                        <Receipt className="w-[18px] h-[18px]"/><span className="ci-qa-label">Zahlungslink</span>
                      </button>
                    )}
                    <button
                      className="ci-qa"
                      disabled={storedStation !== "warenausgang" || !canCompleteHandover}
                      title={storedStation === "warenausgang" && canCompleteHandover ? "Zum Übergabebeleg" : "Nur im Warenausgang mit Statusberechtigung verfügbar"}
                      onClick={() => document.getElementById("active-handover")?.scrollIntoView({ behavior: "smooth", block: "center" })}
                    ><Truck className="w-[18px] h-[18px]"/><span className="ci-qa-label">Übergabe</span></button>
                    <button className="ci-qa" disabled title="Reklamationserfassung ist hier noch nicht angebunden"><AlertTriangle className="w-[18px] h-[18px]"/><span className="ci-qa-label">Reklam.</span></button>
                  </div>
                </div>

                {/* AUFTRAGSHISTORIE */}
                <div className="ci-section">
                  <div className="ci-section-label">Auftragshistorie</div>
                  <div className="ci-history">
                    {orderData.events && orderData.events.length > 0 ? (
                      orderData.events.map((evt, i) => (
                        <div key={evt.id || i} className="ci-h-item">
                          <div className={`ci-h-dot ${evt.status === 'success' ? 'done' : 'info'}`}>
                            {evt.status === 'success' ? <Check className="w-3.5 h-3.5"/> : <Info className="w-3.5 h-3.5"/>}
                          </div>
                          <div>
                            <div className="ci-h-time">{new Date(evt.createdAt).toLocaleString()}</div>
                            <div className="ci-h-title">{evt.description || evt.eventType}</div>
                            {evt.notes && <div className="ci-h-sub">{evt.notes}</div>}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center p-4 text-[var(--ci-ink-3)] text-sm">Noch keine Daten erfasst</div>
                    )}
                  </div>
                </div>

              </div>
            </div>

            {/* FOOTER */}
            <div className="ci-modal-foot sticky bottom-0 z-20 flex flex-col gap-2 border-t bg-white/95 p-4 backdrop-blur sm:flex-row sm:justify-end">
              <button className="ci-btn" onClick={popOrder}>Schließen</button>
              <button className="ci-btn-primary ci-btn" onClick={() => setShowMail(true)}>
                <Send className="w-4 h-4"/> Kunden-Update senden
              </button>
            </div>

          </div>
        </div>
      </div>

      {showPayment && canViewPrices && <PaymentDrawer orderData={orderData} onClose={() => setShowPayment(false)} />}
      {showMail && <StatusMailDrawer orderData={orderData} onClose={() => setShowMail(false)} />}
      {editingItemId && (
        <ItemDrawer 
          orderId={orderData.id} 
          itemId={editingItemId} 
          existingItems={(orderData.items || []).map((item) => {
            const routeSnapshot = parseRouteSnapshot(item.stationSequence);
            return {
            id: item.id,
            orderId: item.orderId,
            name: item.name,
            quantity: item.quantity,
            material: item.material || undefined,
            surfaceRequested: item.surfaceRequested || undefined,
            photoIds: Array.isArray(item.photoIds) ? item.photoIds.filter((value): value is string => typeof value === "string") : [],
            currentStationId: item.currentStationId || undefined,
            stationSequence: routeSnapshot?.stations ?? (Array.isArray(item.stationSequence) ? item.stationSequence.filter((value): value is string => typeof value === "string") : []),
            currentStep: item.currentStep ?? 0,
            ...(routeSnapshot ? { routeTemplateId: routeSnapshot.templateId, routeSnapshotVersion: routeSnapshot.contractVersion } : {}),
            internalNotes: item.internalNotes || undefined,
          };})}
          onClose={() => setEditingItemId(null)}
          onSaved={() => {}} 
        />
      )}
    </AppOverlayPortal>
  );
}
