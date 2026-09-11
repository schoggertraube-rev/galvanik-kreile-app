'use client';

import React from 'react';

export const GalvanikExtras: React.FC = () => {
  return (
    <div className="erf-block" style={{ marginBottom: '14px' }}>
      <div className="erf-block-label" style={{ fontSize: '11px', color: 'var(--ci-ink-2)', marginBottom: '8px', fontWeight: 500, display: 'flex', justifyContent: 'space-between' }}>
        Galvanik-Spezifisch
        <span className="erf-hint" style={{ fontSize: '10px', color: 'var(--ci-ink-3)', fontWeight: 400, fontStyle: 'italic' }}>Bad-Erfassung folgt in Spec 46</span>
      </div>
      <div style={{ background: 'var(--ci-surface)', border: '1px solid var(--ci-border)', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: 'var(--ci-ink-3)' }}>
        <div style={{ marginBottom: '8px' }}>
          <strong>Bad-Auswahl</strong>
          <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
            <span><span style={{ color: 'var(--ci-ink-3)' }}>○</span> Nickelbad 1</span>
            <span><span style={{ color: 'var(--ci-ink)' }}>●</span> Chrombad 2</span>
            <span><span style={{ color: 'var(--ci-ink-3)' }}>○</span> Kupferbad 1</span>
          </div>
        </div>
        <div>
          <strong>Schichtdicke</strong>
          <div style={{ marginTop: '4px' }}>
            ━━━━●━━━━━━━━  12 µm (Standard: 8–15 µm)
          </div>
        </div>
      </div>
    </div>
  );
};
