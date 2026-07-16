'use client';

import React from 'react';

interface WareneingangActiveProps {
  orderId: string;
}

export const WareneingangActive: React.FC<WareneingangActiveProps> = ({ orderId }) => {
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

        <p role="status" style={{ color: 'var(--ci-danger)', fontSize: '12px', marginBottom: '10px' }}>
          Der alte Direktabschluss ist gesperrt. Auftrag {orderId} darf nur über die atomare Stationsabschluss-Erfassung mit Zeit-, Material- und Kostenbeleg weitergeschaltet werden.
        </p>
      </div>
    </div>
  );
};
