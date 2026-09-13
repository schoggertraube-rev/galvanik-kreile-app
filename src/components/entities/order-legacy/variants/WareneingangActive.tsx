'use client';

import React from 'react';

interface WareneingangActiveProps {
  orderId: string;
}

export const WareneingangActive: React.FC<WareneingangActiveProps> = ({ orderId }) => {
  void orderId;

  return (
    <div className="station-context highlight" style={{ background: 'var(--ci-bg)', border: '1px solid var(--ci-border)', borderLeft: '3px solid var(--ci-accent)', borderRadius: '18px', padding: '16px 18px', marginTop: '4px' }}>
      <div className="sc-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div className="sc-title" style={{ fontFamily: 'var(--ci-font-serif)', fontSize: '16px', color: 'var(--ci-ink)' }}>
          Wareneingang
        </div>
      </div>

      <div className="erf-block" style={{ marginBottom: '14px' }}>
        <div className="erf-block-label" style={{ fontSize: '11px', color: 'var(--ci-ink-2)', marginBottom: '12px', fontWeight: 500 }}>
          Vollständigkeitsprüfung
        </div>
        <p style={{ fontSize: '13px', color: 'var(--ci-ink-3)', marginBottom: '16px' }}>
          Bitte prüfen Sie, ob Auftrag und Kunde korrekt erfasst sind, alle Teile mit Mengen und Fotos dokumentiert sind und das gewünschte Zielfinish festgelegt wurde.
        </p>

        <p style={{ color: 'var(--ci-danger)', fontSize: '12px', marginBottom: '10px' }}>
          NOT_AVAILABLE: Stationswechsel benötigen den W3-Command-Vertrag.
        </p>
        <button
          disabled
          style={{ width: '100%', padding: '12px', background: 'var(--ci-ink)', color: 'var(--ci-surface)', borderRadius: '8px', fontWeight: 500, fontSize: '13px', border: 'none', cursor: 'not-allowed', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', opacity: 0.7 }}
        >
          Übergabe zur Bearbeitung
        </button>
      </div>
    </div>
  );
};
