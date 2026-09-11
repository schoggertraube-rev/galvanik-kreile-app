'use client';

import React from 'react';

interface ExtraCostEntry {
  name: string;
  active: boolean;
  minutes: number;
  costEur: number;
  eventType: string;
  causedBy: string;
}

interface ExtraEffortTogglesProps {
  items: ExtraCostEntry[];
  onChange: (index: number, active: boolean) => void;
}

export const ExtraEffortToggles: React.FC<ExtraEffortTogglesProps> = ({ items, onChange }) => {
  return (
    <>
      {items.map((item, i) => (
        <div key={i} className="extra-row" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '10px', alignItems: 'center', background: 'var(--ci-surface)', border: '1px solid var(--ci-border)', borderRadius: '8px', padding: '7px 12px', marginBottom: '6px' }}>
          <div>
            <div className="extra-name" style={{ fontSize: '12px', fontWeight: 500, color: 'var(--ci-ink)' }}>{item.name}</div>
            <div className="extra-sub" style={{ fontSize: '10px', color: 'var(--ci-ink-3)' }}>
              pauschal {item.minutes > 0 ? `${item.minutes} Min · ` : ''}{item.costEur} €
            </div>
          </div>
          <div className="extra-toggle" style={{ display: 'flex', gap: '3px' }}>
            <button 
              className={`et-btn ${item.active ? 'active' : ''}`} 
              onClick={() => onChange(i, true)}
              style={{ padding: '4px 12px', border: '1px solid var(--ci-border)', borderRadius: '6px', fontSize: '10px', background: item.active ? 'var(--ci-ink)' : 'var(--ci-surface-soft)', cursor: 'pointer', color: item.active ? 'var(--ci-surface)' : 'var(--ci-ink-2)', borderColor: item.active ? 'var(--ci-ink)' : 'var(--ci-border)' }}
            >
              Ja
            </button>
            <button 
              className={`et-btn ${!item.active ? 'active' : ''}`} 
              onClick={() => onChange(i, false)}
              style={{ padding: '4px 12px', border: '1px solid var(--ci-border)', borderRadius: '6px', fontSize: '10px', background: !item.active ? 'var(--ci-ink)' : 'var(--ci-surface-soft)', cursor: 'pointer', color: !item.active ? 'var(--ci-surface)' : 'var(--ci-ink-2)', borderColor: !item.active ? 'var(--ci-ink)' : 'var(--ci-border)' }}
            >
              Nein
            </button>
          </div>
        </div>
      ))}
    </>
  );
};
