'use client';

import React, { useState, useEffect } from 'react';
import { BenchmarkSlider } from '../BenchmarkSlider';
import { MaterialStepper } from '../MaterialStepper';
import { ExtraEffortToggles } from '../ExtraEffortToggles';
import { GalvanikExtras } from './GalvanikExtras';
import { CostSummaryTable } from '../CostSummaryTable';
import { bookStationCosts, getBenchmarkData, getStationCostSummary } from '@/features/orders/orderCost.actions';
import type { WorkEntry, MaterialEntry, ExtraCostEntry } from '@/lib/orders/costCalculation';
import { calcStationTotal } from '@/lib/orders/costCalculation';
import { DEFAULT_STATION_STEPS, STATION_LABELS } from '@/lib/orders/stationContext';

interface ErfassungVariantProps {
  orderId: string;
  station: string;
  onBooked?: () => void;
  orderRevenue: number;
  orderMargin: number;
  orderMarginPercent: number;
}

type BenchmarkWorkEntry = WorkEntry & {
  benchmark?: number;
  sampleSize: number;
};

type BenchmarkMaterialEntry = MaterialEntry & {
  benchmarkHint: string;
};

type LegacyStationCost = {
  zeitMin: number;
  zeitEur: number;
  matEur: number;
  extraEur: number;
};

export const ErfassungVariant: React.FC<ErfassungVariantProps> = ({ 
  orderId, 
  station,
  onBooked,
  orderRevenue,
  orderMargin,
  orderMarginPercent
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [workEntries, setWorkEntries] = useState<BenchmarkWorkEntry[]>([]);
  const [consumableEntries, setConsumableEntries] = useState<BenchmarkMaterialEntry[]>([]);
  const [extras, setExtras] = useState<ExtraCostEntry[]>([
    { name: 'Richten / Dellen', active: false, minutes: 45, costEur: 53, eventType: 'quality_rework', causedBy: 'quality_issue' },
    { name: 'Löten / Reparatur', active: false, minutes: 30, costEur: 35, eventType: 'quality_rework', causedBy: 'quality_issue' },
    { name: 'Express-Zuschlag', active: false, minutes: 0, costEur: 50, eventType: 'express_surcharge', causedBy: 'customer_change' },
  ]);

  const [stationCosts, setStationCosts] = useState<Record<string, LegacyStationCost>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      
      const [benchRes, summaryRes] = await Promise.all([
        getBenchmarkData(station),
        getStationCostSummary(orderId)
      ]);

      if (!mounted) return;

      if (!benchRes.available || !summaryRes.available) {
        setStationCosts({});
        setError(benchRes.message || summaryRes.message);
        setLoading(false);
        return;
      }
      
      setStationCosts(summaryRes.stations || {});
      
      const costPerHour = benchRes.kostensatzEurProStunde || 70; // fallback 70€/h
      
      // Init work entries based on vorlage or default
      const steps = DEFAULT_STATION_STEPS[station] || ['Bearbeitung gesamt'];
      const initialWork = steps.map(step => {
        const v = benchRes.zeitVorlagen.find(z => z.taetigkeit === step);
        return {
          step,
          minutes: v && v.n_referenzauftraege >= 3 ? v.dauer_median_minuten : 0,
          costPerHour,
          benchmark: v ? v.dauer_median_minuten : undefined,
          sampleSize: v ? v.n_referenzauftraege : 0
        };
      });
      setWorkEntries(initialWork);

      // Init materials
      const initialMat = benchRes.verbrauchVorlagen.map(v => ({
        itemName: v.artikel_name || 'Material',
        quantity: Math.max(1, v.menge_median || 1),
        unitCostEur: v.einzelpreis_eur || 1.5,
        inventoryItemId: v.inventory_item_id,
        vorlageId: v.id,
        benchmarkHint: `üblich ${v.menge_median} ${v.einheit} · ${v.einzelpreis_eur} €/${v.einheit}`
      }));
      setConsumableEntries(initialMat);

      // Reset extras
      setExtras(currentExtras => currentExtras.map(e => ({ ...e, active: false })));
      
      setLoading(false);
    }
    load();
    return () => { mounted = false; };
  }, [station, orderId]);

  const handleBook = async () => {
    setSaving(true);
    setError(null);
    const res = await bookStationCosts({
      orderId,
      station,
      workEntries,
      consumableEntries,
      extraCostEvents: extras,
      kostenstelleKuerzel: station
    });
    setSaving(false);
    if (res.success) {
      if (onBooked) onBooked();
    } else {
      setError(res.errors.join(', '));
    }
  };

  if (loading) return <div style={{ padding: '20px' }}>Lade Erfassungsdaten...</div>;

  const totalCost = calcStationTotal(workEntries, consumableEntries, extras);
  const totalMin = workEntries.reduce((sum, e) => sum + e.minutes, 0) + extras.filter(e => e.active).reduce((sum, e) => sum + e.minutes, 0);
  const matCost = consumableEntries.reduce((sum, e) => sum + (e.quantity * e.unitCostEur), 0);
  const extraCost = extras.filter(e => e.active).reduce((sum, e) => sum + e.costEur, 0);
  const workCost = workEntries.reduce((sum, e) => sum + ((e.minutes/60) * e.costPerHour), 0);

  return (
    <div className="station-context highlight" id="station-context-block" style={{ background: 'var(--ci-bg)', border: '1px solid var(--ci-border)', borderLeft: '3px solid var(--ci-accent)', borderRadius: '18px', padding: '16px 18px', marginTop: '4px' }}>
      <div className="sc-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div className="sc-title" style={{ fontFamily: 'var(--ci-font-serif)', fontSize: '16px', color: 'var(--ci-ink)' }}>
          Erfassung · <span className="sc-station" style={{ color: 'var(--ci-accent)' }}>{STATION_LABELS[station] || station}</span>
        </div>
        <div className="sc-toggle" style={{ display: 'flex', gap: '4px' }}>
          <button className="sc-collapse" onClick={() => setCollapsed(!collapsed)} style={{ background: 'transparent', border: '1px solid var(--ci-border)', color: 'var(--ci-ink-3)', padding: '4px 10px', borderRadius: '999px', fontSize: '11px', cursor: 'pointer' }}>
            <i className={`ti ${collapsed ? 'ti-chevron-down' : 'ti-chevron-up'}`} style={{ fontSize: '12px' }}></i> {collapsed ? 'ausklappen' : 'einklappen'}
          </button>
        </div>
      </div>

      {!collapsed && (
        <>
          {/* ARBEITSZEIT */}
          <div className="erf-block" style={{ marginBottom: '14px' }}>
            <div className="erf-block-label" style={{ fontSize: '11px', color: 'var(--ci-ink-2)', marginBottom: '8px', fontWeight: 500, display: 'flex', justifyContent: 'space-between' }}>
              Arbeitszeit
              <span className="erf-hint" style={{ fontSize: '10px', color: 'var(--ci-ink-3)', fontWeight: 400, fontStyle: 'italic' }}>bisher 0 Min erfasst · Kostensatz {workEntries[0]?.costPerHour || 70} €/h</span>
            </div>
            {workEntries.map((w, i) => (
              <BenchmarkSlider 
                key={i} 
                name={w.step} 
                value={w.minutes} 
                benchmark={w.benchmark}
                sampleSize={w.sampleSize}
                onChange={(val) => {
                  const newEntries = [...workEntries];
                  newEntries[i].minutes = val;
                  setWorkEntries(newEntries);
                }} 
              />
            ))}
          </div>

          {/* GALVANIK-ZUSATZ */}
          {station === 'galvanik' && <GalvanikExtras />}

          {/* MATERIAL */}
          <div className="erf-block" style={{ marginBottom: '14px' }}>
            <div className="erf-block-label" style={{ fontSize: '11px', color: 'var(--ci-ink-2)', marginBottom: '8px', fontWeight: 500, display: 'flex', justifyContent: 'space-between' }}>
              Material
              <span className="erf-hint" style={{ fontSize: '10px', color: 'var(--ci-ink-3)', fontWeight: 400, fontStyle: 'italic' }}>vorgeschlagen aus Vorlage</span>
            </div>
            <div className="mat-grid" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {consumableEntries.map((m, i) => (
                <MaterialStepper 
                  key={i} 
                  name={m.itemName} 
                  count={m.quantity} 
                  unitCostEur={m.unitCostEur} 
                  benchmarkHint={m.benchmarkHint}
                  onChange={(val) => {
                    const newMat = [...consumableEntries];
                    newMat[i].quantity = val;
                    setConsumableEntries(newMat);
                  }}
                />
              ))}
              <div className="mat-add" style={{ padding: '6px 10px', border: '1px dashed var(--ci-border)', borderRadius: '8px', textAlign: 'center', fontSize: '11px', color: 'var(--ci-ink-3)', cursor: 'pointer' }}>+ Weiteres Material</div>
            </div>
          </div>

          {/* ZUSATZAUFWAND */}
          <div className="erf-block" style={{ marginBottom: '14px' }}>
            <div className="erf-block-label" style={{ fontSize: '11px', color: 'var(--ci-ink-2)', marginBottom: '8px', fontWeight: 500, display: 'flex', justifyContent: 'space-between' }}>
              Zusatzaufwand
              <span className="erf-hint" style={{ fontSize: '10px', color: 'var(--ci-ink-3)', fontWeight: 400, fontStyle: 'italic' }}>nur wenn zusätzlich zum Standard</span>
            </div>
            <ExtraEffortToggles 
              items={extras} 
              onChange={(i, active) => {
                const nx = [...extras];
                nx[i].active = active;
                setExtras(nx);
              }}
            />
          </div>

          {error && <div style={{ color: 'var(--ci-danger)', fontSize: '12px', marginBottom: '10px' }}>Fehler: {error}</div>}

          {/* ERFASSUNGS-FOOTER */}
          <div className="erf-foot" style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--ci-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="erf-foot-sum" style={{ fontSize: '11px', color: 'var(--ci-ink-3)' }}>
              Stationskosten {STATION_LABELS[station] || station}
              <b style={{ fontFamily: 'var(--ci-font-serif)', fontSize: '16px', color: 'var(--ci-ink)', fontWeight: 500, display: 'block', marginTop: '2px' }}>{totalCost.toFixed(2).replace('.', ',')} €</b>
              <span style={{ fontSize: '10px' }}>{totalMin} Min Arbeit ({workCost.toFixed(0)} €) + {matCost.toFixed(2).replace('.', ',')} € Material + {extraCost} € Zusatz</span>
            </div>
            <button 
              className="erf-book-btn" 
              onClick={handleBook}
              disabled={saving}
              style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 500, background: 'var(--ci-ink)', color: 'var(--ci-surface)', border: 'none', cursor: 'pointer', opacity: saving ? 0.7 : 1 }}
            >
              <i className="ti ti-check" style={{ fontSize: '11px' }}></i> {saving ? 'Speichert...' : 'Erfassung buchen'}
            </button>
          </div>

          {/* KALKULATION */}
          <CostSummaryTable 
            stationCosts={stationCosts} 
            activeStation={station}
            orderRevenue={orderRevenue}
            orderMargin={orderMargin}
            orderMarginPercent={orderMarginPercent}
          />
        </>
      )}
    </div>
  );
};
