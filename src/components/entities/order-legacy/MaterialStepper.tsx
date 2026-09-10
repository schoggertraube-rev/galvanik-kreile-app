'use client';

import React from 'react';

interface MaterialStepperProps {
  name: string;
  count: number;
  unitCostEur: number;
  benchmarkHint?: string;
  onChange: (val: number) => void;
}

export const MaterialStepper: React.FC<MaterialStepperProps> = ({
  name,
  count,
  unitCostEur,
  benchmarkHint,
  onChange,
}) => {
  const totalCost = (count * unitCostEur).toFixed(2).replace('.', ',');

  return (
    <div className="mat-row" style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '10px', alignItems: 'center', background: 'var(--ci-surface)', border: '1px solid var(--ci-border)', borderRadius: '10px', padding: '8px 12px' }}>
      <div>
        <div className="mat-name" style={{ fontSize: '12px', fontWeight: 500, color: 'var(--ci-ink)' }}>{name}</div>
        <div className="mat-bench-tag" style={{ fontSize: '10px', color: 'var(--ci-ink-3)', marginTop: '1px' }}>
          {benchmarkHint || `üblich — · ${unitCostEur.toFixed(2).replace('.', ',')} €/Stk`}
        </div>
      </div>
      <div className="mat-stepper" style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
        <button 
          className="mat-btn" 
          onClick={() => onChange(Math.max(0, count - 1))}
          style={{ width: '28px', height: '28px', border: '1px solid var(--ci-border)', background: 'var(--ci-surface-soft)', cursor: 'pointer', fontSize: '14px', fontWeight: 600, color: 'var(--ci-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px 0 0 6px' }}
        >−</button>
        <div className="mat-count" style={{ width: '36px', height: '28px', borderTop: '1px solid var(--ci-border)', borderBottom: '1px solid var(--ci-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--ci-font-serif)', fontSize: '14px', background: 'var(--ci-surface)' }}>
          {count}
        </div>
        <button 
          className="mat-btn" 
          onClick={() => onChange(count + 1)}
          style={{ width: '28px', height: '28px', border: '1px solid var(--ci-border)', background: 'var(--ci-surface-soft)', cursor: 'pointer', fontSize: '14px', fontWeight: 600, color: 'var(--ci-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '0 6px 6px 0' }}
        >+</button>
      </div>
      <div className="mat-cost" style={{ fontFamily: 'var(--ci-font-serif)', fontSize: '13px', color: 'var(--ci-ink)', textAlign: 'right', whiteSpace: 'nowrap' }}>
        {totalCost} €
      </div>
    </div>
  );
};
