'use client';

import React, { useState } from 'react';
import { ErfassungVariant } from './ErfassungVariant';

interface WareneingangReadOnlyProps {
  orderId: string;
  orderRevenue: number;
  orderMargin: number;
  orderMarginPercent: number;
  canViewFinance: boolean;
}

export const WareneingangReadOnly: React.FC<WareneingangReadOnlyProps> = ({ orderId, orderRevenue, orderMargin, orderMarginPercent, canViewFinance }) => {
  const [editMode, setEditMode] = useState(false);

  if (editMode && canViewFinance) {
    return (
      <div style={{ position: 'relative' }}>
        <button 
          onClick={() => setEditMode(false)}
          style={{ position: 'absolute', right: '18px', top: '22px', zIndex: 10, background: 'transparent', border: 'none', fontSize: '11px', color: 'var(--ci-ink-3)', cursor: 'pointer', textDecoration: 'underline' }}
        >
          Zurück zur Ansicht
        </button>
        <ErfassungVariant 
          orderId={orderId} 
          station="wareneingang" 
          onBooked={() => setEditMode(false)}
          orderRevenue={orderRevenue}
          orderMargin={orderMargin}
          orderMarginPercent={orderMarginPercent}
        />
      </div>
    );
  }

  return (
    <div className="station-context" style={{ background: 'var(--ci-bg)', border: '1px solid var(--ci-border)', borderLeft: '3px solid var(--ci-success)', borderRadius: '18px', padding: '16px 18px', marginTop: '4px' }}>
      <div className="sc-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div className="sc-title" style={{ fontFamily: 'var(--ci-font-serif)', fontSize: '16px', color: 'var(--ci-ink)' }}>
          Wareneingang · <span className="sc-station" style={{ color: 'var(--ci-success)' }}>abgeschlossen</span>
        </div>
        <div className="sc-toggle">
          {canViewFinance && (
            <button className="sc-collapse" onClick={() => setEditMode(true)} style={{ background: 'transparent', border: '1px solid var(--ci-border)', color: 'var(--ci-ink-3)', padding: '4px 10px', borderRadius: '999px', fontSize: '11px', cursor: 'pointer' }}>
              <i className="ti ti-edit" style={{ fontSize: '11px' }}></i> nacherfassen
            </button>
          )}
        </div>
      </div>

      <div className="erf-block" style={{ marginBottom: '14px' }}>
        <div className="erf-block-label" style={{ fontSize: '11px', color: 'var(--ci-ink-2)', marginBottom: '8px', fontWeight: 500 }}>
          {canViewFinance
            ? 'Keine belegten Kostendaten in dieser Ansicht.'
            : 'Kosten- und Preisdaten sind für diese Rolle nicht freigegeben.'}
        </div>
      </div>
    </div>
  );
};
