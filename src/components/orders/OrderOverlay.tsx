import React, { useState } from "react";
import { useOverlayStore } from "@/lib/overlayStore";
import { useOrderLive } from "@/lib/useOrderLive";
import { PaymentDrawer } from "./PaymentDrawer";
import { StatusMailDrawer } from "./StatusMailDrawer";
import { ItemDrawer } from "./ItemDrawer";
import { 
  X, Check, AlertTriangle, Clock, Droplet, Package, Info, Plus, 
  Send, Camera, Phone, FileText, Receipt, Truck, ArrowRight, CameraOff, Wrench
} from "lucide-react";

export function OrderOverlay() {
  const orderStack = useOverlayStore((state) => state.orderStack);
  const popOrder = useOverlayStore((state) => state.popOrder);
  const [showPayment, setShowPayment] = useState(false);
  const [showMail, setShowMail] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | 'new' | null>(null);

  const currentOrderId = orderStack.length > 0 ? orderStack[orderStack.length - 1] : null;

  const { orderData, loading } = useOrderLive(currentOrderId);

  if (!currentOrderId) return null;

  if (loading) {
    return (
      <div className="fixed inset-0 bg-[var(--ci-ink)]/40 backdrop-blur-sm z-[999] flex items-center justify-center">
        <div className="bg-[var(--ci-surface)] p-8 rounded-[18px] shadow-lg flex flex-col items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--ci-ink)] mb-4"></div>
          <span className="text-[var(--ci-ink-2)] font-medium text-sm">Lade Auftragsdaten...</span>
        </div>
      </div>
    );
  }

  if (!orderData) {
    return (
      <div className="fixed inset-0 bg-[var(--ci-ink)]/40 backdrop-blur-sm z-[999] flex items-center justify-center">
        <div className="bg-[var(--ci-surface)] p-8 rounded-[18px] shadow-lg max-w-md w-full text-center">
          <AlertTriangle className="h-10 w-10 text-[var(--ci-warn)] mx-auto mb-4" />
          <h3 className="text-lg font-serif text-[var(--ci-ink)] mb-2">Auftrag nicht gefunden</h3>
          <p className="text-[var(--ci-ink-3)] text-sm mb-6">Noch keine Daten erfasst oder gelöscht.</p>
          <button onClick={popOrder} className="px-6 py-2 bg-[var(--ci-ink)] text-white rounded-[12px] font-medium hover:opacity-80 transition-opacity">
            Schließen
          </button>
        </div>
      </div>
    );
  }

  // Calculate sum of parts
  const hasItems = orderData.items && orderData.items.length > 0;
  const partsSum = hasItems ? orderData.items.reduce((acc: number, item: any) => acc + (Number(item.price) || 0), 0) : 0;
  const dbPrice = Number(orderData.quoteTotalGross || orderData.dbGeplant || 0);
  const totalValue = partsSum > 0 ? partsSum : dbPrice;

  return (
    <>
      <style>{`
        .ci-modal-wrap {
          /* Tokens from ci-tokens.css are applied globally */
        }
        .ci-backdrop { position: fixed; inset: 0; background: rgba(26, 31, 46, 0.42); backdrop-filter: blur(8px); z-index: 998; }
        .ci-modal-container { position: fixed; inset: 0; z-index: 999; display: flex; justify-content: center; align-items: flex-start; padding-top: 32px; overflow-y: auto; padding-bottom: 32px; }
        .ci-modal { width: 100%; max-width: 1080px; background: var(--ci-surface); border-radius: var(--ci-radius-card); box-shadow: 0 1px 2px rgba(20,15,5,0.04), 0 12px 32px rgba(20,15,5,0.08); overflow: hidden; border: 1px solid var(--ci-border); font-family: var(--ci-font-sans); color: var(--ci-ink); }
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

      <div className="ci-modal-wrap">
        <div className="ci-backdrop" onClick={popOrder}></div>
        <div className="ci-modal-container">
          <div className="ci-modal">

            {/* HEADER */}
            <div className="ci-modal-head">
              <div className="ci-head-left">
                <div className="ci-order-number">{orderData.orderNumber || orderData.id}</div>
                <div className="ci-order-title">{orderData.title || orderData.task || "Kein Titel vergeben"}</div>
                <div className="ci-head-meta">
                  {orderData.priority === 'express' && <span className="ci-pill ci-pill-accent"><AlertTriangle className="w-3 h-3"/>Express</span>}
                  <span className="ci-pill ci-pill-warn"><span className="w-1.5 h-1.5 bg-[var(--ci-warn)] rounded-full"></span>{orderData.station || 'Wareneingang'}</span>
                  {orderData.dueDate && <span className="ci-pill ci-pill-success">Fällig {new Date(orderData.dueDate).toLocaleDateString()}</span>}
                  <button className="ci-pill ci-pill-customer flex items-center gap-1">
                    <Info className="w-3 h-3"/> {orderData.customer?.name || orderData.customerName || "Unbekannter Kunde"} <ArrowRight className="w-3 h-3"/>
                  </button>
                </div>
              </div>
              <button className="ci-close-btn" onClick={popOrder} aria-label="Schließen">
                <X className="w-5 h-5"/>
              </button>
            </div>

            {/* BODY */}
            <div className="ci-modal-body">
              {/* LINKE SPALTE */}
              <div className="ci-col-left">
                
                {/* Stationen */}
                <div className="ci-section">
                  <div className="ci-section-label">Aktuelle Lage</div>
                  <div className="ci-stations">
                    {(() => {
                      const STATIONS = ['wareneingang', 'entmetallisierung', 'schleiferei', 'galvanik', 'warenausgang'];
                      const LABELS = ['Wareneingang', 'Entmetallisierung', 'Schleiferei', 'Galvanik', 'Warenausgang'];
                      const ICONS = [Droplet, Wrench, Wrench, Droplet, Package];
                      
                      const currentStation = orderData.station || 'wareneingang';
                      let currentIndex = STATIONS.indexOf(currentStation);
                      if (orderData.status === 'completed') {
                        currentIndex = STATIONS.length;
                      } else if (currentIndex < 0) {
                        currentIndex = 0;
                      }
                      
                      const handleStationClick = async (newStation: string) => {
                        try {
                          const { setOrderStationDb } = await import("@/app/actions/orders.actions");
                          await setOrderStationDb(orderData.id, newStation);
                          // We emit a custom event to show a toast, or use a toast library if one exists.
                          // For simplicity, using alert or custom toast logic (omitted complex toast for basic one)
                          const el = document.createElement("div");
                          el.className = "fixed bottom-4 right-4 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg z-[9999] transition-opacity";
                          el.textContent = "Station aktualisiert. Rückgängig machen?";
                          el.style.cursor = "pointer";
                          el.onclick = async () => {
                            await setOrderStationDb(orderData.id, currentStation);
                            el.remove();
                          };
                          document.body.appendChild(el);
                          setTimeout(() => { if (document.body.contains(el)) el.remove(); }, 5000);
                        } catch (e) {
                          console.error(e);
                        }
                      };

                      return STATIONS.map((station, idx) => {
                        const Icon = ICONS[idx];
                        const isDone = idx < currentIndex;
                        const isActive = idx === currentIndex;
                        const isWait = idx > currentIndex;
                        
                        let circleClass = "ci-station-wait";
                        if (isDone) circleClass = "ci-station-done";
                        if (isActive) circleClass = "ci-station-active";
                        
                        return (
                          <div key={station} className="ci-station" onClick={() => handleStationClick(station)}>
                            <div className={`ci-station-circle ${circleClass}`}>
                              {isDone ? <Check className="w-5 h-5"/> : <Icon className="w-5 h-5"/>}
                            </div>
                            <div className="ci-station-label">{LABELS[idx]}</div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>

                {/* KPIs */}
                <div className="ci-section">
                  <div className="ci-kpi-row">
                    <div className={`ci-kpi-card ${orderData.risk === 'red' ? 'bg-[var(--ci-danger-soft)] border-red-200' : orderData.risk === 'yellow' ? 'bg-[var(--ci-warn-soft)] border-yellow-200' : ''}`}>
                      <div className="ci-kpi-label"><Clock className="w-3 h-3 inline-block" /> Risiko</div>
                      <div className={`ci-kpi-value ${orderData.risk === 'red' ? 'text-[var(--ci-danger)]' : orderData.risk === 'yellow' ? 'text-[#6B4A0D]' : ''}`}>
                        {orderData.risk === 'red' ? 'Kritisch' : orderData.risk === 'yellow' ? 'Achtung' : 'Im Plan'}
                      </div>
                    </div>
                    <div className="ci-kpi-card ci-warn">
                      <div className="ci-kpi-label">Status</div>
                      <div className="ci-kpi-value ci-warn-text">{orderData.statusText || 'In Arbeit'}</div>
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
                      orderData.items.map((item: any, idx: number) => (
                        <div key={item.id || idx} className="ci-item-card cursor-pointer hover:border-[var(--ci-ink-3)] transition-colors" onClick={() => setEditingItemId(item.id)}>
                          <div className={`ci-item-photo ${item.photo ? 'has-photo' : ''}`}>
                            {item.photo ? <Camera className="w-5 h-5"/> : <CameraOff className="w-5 h-5"/>}
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
                            {item.price ? (
                              <div className="ci-item-price-val">{Number(item.price).toFixed(2)} €</div>
                            ) : (
                              <div className="ci-item-price-val missing">Preis offen</div>
                            )}
                          </div>
                        </div>
                      ))
                    )}

                    <button className="ci-add-item-btn" onClick={() => setEditingItemId('new')}>
                      <Plus className="w-4 h-4"/> Teil hinzufügen
                    </button>

                    <div className="ci-item-sum">
                      <span className="ci-item-sum-label">Summe netto</span>
                      <span className="ci-item-sum-val">
                        {(orderData.priceLines || []).reduce((sum: number, line: any) => sum + Number(line.unitTotalEur || 0), 0).toFixed(2)} €
                      </span>
                    </div>
                  </div>
                </div>

                {/* CUSTOMER KPIs */}
                <div className="ci-section">
                  <div className="ci-section-label">Kunden-Werte</div>
                  {orderData.customerKpis ? (
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-[var(--ci-surface)] border border-[var(--ci-border)] rounded-lg p-3">
                        <div className="text-[9px] text-[var(--ci-ink-3)] uppercase tracking-wider mb-1">Lifetime Revenue</div>
                        <div className="font-serif text-lg text-[var(--ci-ink)]">{orderData.customerKpis.ltv.toFixed(2)} €</div>
                      </div>
                      <div className="bg-[var(--ci-surface)] border border-[var(--ci-border)] rounded-lg p-3">
                        <div className="text-[9px] text-[var(--ci-ink-3)] uppercase tracking-wider mb-1">Aktive Aufträge</div>
                        <div className="font-serif text-lg text-[var(--ci-ink)]">{orderData.customerKpis.activeOrdersCount}</div>
                      </div>
                      <div className="bg-[var(--ci-surface)] border border-[var(--ci-border)] rounded-lg p-3">
                        <div className="text-[9px] text-[var(--ci-ink-3)] uppercase tracking-wider mb-1">Nächster Auftrag</div>
                        <div className="font-serif text-lg text-[var(--ci-ink)]">-</div>
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
                    <button className="ci-qa ci-primary" onClick={() => setShowMail(true)}>
                      <Send className="w-[18px] h-[18px]"/><span className="ci-qa-label">Status-Mail</span>
                    </button>
                    <button className="ci-qa"><Camera className="w-[18px] h-[18px]"/><span className="ci-qa-label">Foto +</span></button>
                    <button className="ci-qa"><Phone className="w-[18px] h-[18px]"/><span className="ci-qa-label">Anrufen</span></button>
                    <button className="ci-qa" onClick={() => setShowPayment(true)}>
                      <Receipt className="w-[18px] h-[18px]"/><span className="ci-qa-label">Zahlung</span>
                    </button>
                    <button className="ci-qa"><Truck className="w-[18px] h-[18px]"/><span className="ci-qa-label">Versand</span></button>
                    <button className="ci-qa"><AlertTriangle className="w-[18px] h-[18px]"/><span className="ci-qa-label">Reklam.</span></button>
                  </div>
                </div>

                {/* AUFTRAGSHISTORIE */}
                <div className="ci-section">
                  <div className="ci-section-label">Auftragshistorie</div>
                  <div className="ci-history">
                    {orderData.events && orderData.events.length > 0 ? (
                      orderData.events.map((evt: any, i: number) => (
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
            <div className="ci-modal-foot">
              <button className="ci-btn" onClick={popOrder}>Schließen</button>
              <button className="ci-btn-primary ci-btn" onClick={() => setShowMail(true)}>
                <Send className="w-4 h-4"/> Kunden-Update senden
              </button>
            </div>

          </div>
        </div>
      </div>

      {showPayment && <PaymentDrawer orderData={orderData} onClose={() => setShowPayment(false)} />}
      {showMail && <StatusMailDrawer orderData={orderData} onClose={() => setShowMail(false)} />}
      {editingItemId && (
        <ItemDrawer 
          orderId={orderData.id} 
          itemId={editingItemId} 
          existingItems={orderData.items || []} 
          onClose={() => setEditingItemId(null)}
          onSaved={() => {}} 
        />
      )}
    </>
  );
}
