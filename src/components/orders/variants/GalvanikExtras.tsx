'use client';

import React from 'react';

export const GalvanikExtras: React.FC = () => {
  return (
    <div className="erf-block" style={{ marginBottom: '14px' }}>
      <div className="erf-block-label" style={{ fontSize: '11px', color: 'var(--ci-ink-2)', marginBottom: '8px', fontWeight: 500, display: 'flex', justifyContent: 'space-between' }}>
        Galvanik-Spezifisch
        <span className="erf-hint" style={{ fontSize: '10px', color: 'var(--ci-ink-3)', fontWeight: 400, fontStyle: 'italic' }}>Badbeteiligungs-Adapter erforderlich</span>
      </div>
      <div style={{ background: 'var(--ci-surface)', border: '1px solid var(--ci-border)', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: 'var(--ci-ink-3)' }}>
        Es ist kein Auftrag-zu-Bad-Beleg bestätigt. Bad, Positionen und Prozesswerte werden hier deshalb weder erfunden noch als auswählbar dargestellt; der Stationsabschluss bleibt serverseitig gesperrt.
      </div>
    </div>
  );
};
