'use client';

import React, { useState } from 'react';
import { STATION_ORDER, STATION_LABELS } from '@/lib/orders/stationContext';

interface StationCost {
  zeitMin: number;
  zeitEur: number;
  matEur: number;
  extraEur: number;
}

interface CostSummaryTableProps {
  stationCosts: Record<string, StationCost>;
  activeStation: string;
  orderRevenue: number;
  orderMargin: number;
  orderMarginPercent: number;
}

export const CostSummaryTable: React.FC<CostSummaryTableProps> = ({ 
  stationCosts, 
  activeStation,
  orderRevenue,
  orderMargin,
  orderMarginPercent
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const getStationRow = (stationKey: string, index: number, activeIndex: number) => {
    const isPast = index < activeIndex;
    const isActive = index === activeIndex;
    const isPending = index > activeIndex;
    
    const cost = stationCosts[stationKey] || { zeitMin: 0, zeitEur: 0, matEur: 0, extraEur: 0 };
    const gesamt = cost.zeitEur + cost.matEur + cost.extraEur;

    let icon = <span style={{ color: 'var(--ci-ink-3)' }}>○</span>;
    if (isPast) icon = <span style={{ color: 'var(--ci-success)' }}>✓</span>;
    if (isActive) icon = <span style={{ color: 'var(--ci-accent)' }}>●</span>;

    const rowClass = isActive ? 'active' : isPending ? 'pending' : '';
    
    // Benchmarks are not fully spec'd dynamically here, so we will show a placeholder "~X €" for pending
    // and a hardcoded bench for active if missing, but we should just omit if we don't have it.
    
    return (
      <tr key={stationKey} className={rowClass} style={isActive ? { background: 'var(--ci-bench-soft)' } : isPending ? { opacity: 0.5 } : {}}>
        <td style={{ padding: '7px 0', borderBottom: '1px solid var(--ci-border)' }}>{icon} {STATION_LABELS[stationKey] || stationKey}</td>
        <td className="r" style={{ padding: '7px 0', borderBottom: '1px solid var(--ci-border)', textAlign: 'right', fontFamily: 'var(--ci-font-serif)' }}>{cost.zeitMin > 0 ? `${cost.zeitMin} Min` : '—'}</td>
        <td className="r" style={{ padding: '7px 0', borderBottom: '1px solid var(--ci-border)', textAlign: 'right', fontFamily: 'var(--ci-font-serif)' }}>{cost.matEur > 0 ? `${cost.matEur.toFixed(0)} €` : '—'}</td>
        <td className="r" style={{ padding: '7px 0', borderBottom: '1px solid var(--ci-border)', textAlign: 'right', fontFamily: 'var(--ci-font-serif)' }}>{cost.extraEur > 0 ? `${cost.extraEur.toFixed(0)} €` : '—'}</td>
        <td className="r" style={{ padding: '7px 0', borderBottom: '1px solid var(--ci-border)', textAlign: 'right', fontFamily: 'var(--ci-font-serif)' }}>{gesamt > 0 ? `${gesamt.toFixed(0)} €` : '—'}</td>
        <td className="r bench-col" style={{ padding: '7px 0', borderBottom: '1px solid var(--ci-border)', textAlign: 'right', fontFamily: 'var(--ci-font-sans)', fontSize: '11px', color: 'var(--ci-ink-3)' }}></td>
      </tr>
    );
  };

  const activeIndex = Math.max(0, STATION_ORDER.findIndex(station => station === activeStation));

  let totalMin = 0;
  let totalMat = 0;
  let totalExtra = 0;
  let totalGesamt = 0;
  
  Object.values(stationCosts).forEach(c => {
    totalMin += c.zeitMin;
    totalMat += c.matEur;
    totalExtra += c.extraEur;
    totalGesamt += c.zeitEur + c.matEur + c.extraEur;
  });

  return (
    <>
      <div 
        className="calc-toggle" 
        onClick={() => setIsOpen(!isOpen)}
        style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--ci-ink-3)', cursor: 'pointer', userSelect: 'none', padding: '8px 0' }}
      >
        <i className={`ti ${isOpen ? 'ti-chevron-up' : 'ti-chevron-down'}`} style={{ fontSize: '14px' }}></i>
        Gesamtkalkulation über alle Stationen anzeigen
      </div>
      
      {isOpen && (
        <>
          <table className="calc-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginTop: '4px' }}>
            <thead>
              <tr>
                <th style={{ fontSize: '9px', color: 'var(--ci-ink-3)', textTransform: 'uppercase', letterSpacing: '1px', textAlign: 'left', padding: '6px 0', borderBottom: '1px solid var(--ci-border)', fontWeight: 500 }}>Station</th>
                <th className="r" style={{ fontSize: '9px', color: 'var(--ci-ink-3)', textTransform: 'uppercase', letterSpacing: '1px', textAlign: 'right', padding: '6px 0', borderBottom: '1px solid var(--ci-border)', fontWeight: 500 }}>Zeit</th>
                <th className="r" style={{ fontSize: '9px', color: 'var(--ci-ink-3)', textTransform: 'uppercase', letterSpacing: '1px', textAlign: 'right', padding: '6px 0', borderBottom: '1px solid var(--ci-border)', fontWeight: 500 }}>Material</th>
                <th className="r" style={{ fontSize: '9px', color: 'var(--ci-ink-3)', textTransform: 'uppercase', letterSpacing: '1px', textAlign: 'right', padding: '6px 0', borderBottom: '1px solid var(--ci-border)', fontWeight: 500 }}>Zusatz</th>
                <th className="r" style={{ fontSize: '9px', color: 'var(--ci-ink-3)', textTransform: 'uppercase', letterSpacing: '1px', textAlign: 'right', padding: '6px 0', borderBottom: '1px solid var(--ci-border)', fontWeight: 500 }}>Gesamt</th>
                <th className="r" style={{ fontSize: '9px', color: 'var(--ci-ink-3)', textTransform: 'uppercase', letterSpacing: '1px', textAlign: 'right', padding: '6px 0', borderBottom: '1px solid var(--ci-border)', fontWeight: 500 }}>Benchmark</th>
              </tr>
            </thead>
            <tbody>
              {STATION_ORDER.map((s, i) => getStationRow(s, i, activeIndex))}
            </tbody>
            <tfoot>
              <tr>
                <td style={{ borderTop: '2px solid var(--ci-ink)', paddingTop: '10px', fontWeight: 500, paddingBottom: '7px' }}>Auftrag gesamt</td>
                <td className="r" style={{ borderTop: '2px solid var(--ci-ink)', paddingTop: '10px', fontWeight: 500, paddingBottom: '7px', textAlign: 'right', fontFamily: 'var(--ci-font-serif)' }}>{totalMin} Min</td>
                <td className="r" style={{ borderTop: '2px solid var(--ci-ink)', paddingTop: '10px', fontWeight: 500, paddingBottom: '7px', textAlign: 'right', fontFamily: 'var(--ci-font-serif)' }}>{totalMat.toFixed(0)} €</td>
                <td className="r" style={{ borderTop: '2px solid var(--ci-ink)', paddingTop: '10px', fontWeight: 500, paddingBottom: '7px', textAlign: 'right', fontFamily: 'var(--ci-font-serif)' }}>{totalExtra.toFixed(0)} €</td>
                <td className="r" style={{ borderTop: '2px solid var(--ci-ink)', paddingTop: '10px', fontWeight: 500, paddingBottom: '7px', textAlign: 'right', fontFamily: 'var(--ci-font-serif)', fontSize: '16px' }}>{totalGesamt.toFixed(0)} €</td>
                <td className="r bench-col" style={{ borderTop: '2px solid var(--ci-ink)', paddingTop: '10px', fontWeight: 500, paddingBottom: '7px', textAlign: 'right', fontFamily: 'var(--ci-font-sans)', fontSize: '11px', color: 'var(--ci-ink-3)' }}></td>
              </tr>
            </tfoot>
          </table>
          <div className="calc-foot-summary" style={{ padding: '10px 0 0', fontSize: '11px', color: 'var(--ci-ink-2)' }}>
            KV-Betrag: {(orderRevenue * 1.19).toFixed(0)} € brutto ({orderRevenue.toFixed(0)} € netto) · <b style={{ color: 'var(--ci-success)', fontWeight: 600 }}>voraussichtliche Marge: {orderMargin.toFixed(0)} € ({orderMarginPercent.toFixed(0)} %)</b>
          </div>
        </>
      )}
    </>
  );
};
