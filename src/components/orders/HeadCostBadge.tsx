'use client';

import React from 'react';

interface HeadCostBadgeProps {
  currentCostEur: number;
  benchmarkEur?: number;
  onClick?: () => void;
}

export const HeadCostBadge: React.FC<HeadCostBadgeProps> = ({ currentCostEur, benchmarkEur, onClick }) => {
  const showBench = typeof benchmarkEur === 'number' && benchmarkEur > 0;
  void (showBench && currentCostEur > benchmarkEur);
  let overText = null;

  if (showBench && benchmarkEur) {
    const diffPercent = Math.round(((currentCostEur / benchmarkEur) - 1) * 100);
    if (diffPercent > 0) {
      overText = <span className="over" style={{ color: 'var(--ci-warn)', fontWeight: 600 }}>+{diffPercent} %</span>;
    } else {
      overText = <span style={{ color: 'var(--ci-success)' }}>{diffPercent} %</span>;
    }
  }

  return (
    <div 
      className="head-cost" 
      onClick={onClick}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0, padding: '0 12px', borderRight: '1px solid var(--ci-border)', marginRight: '8px', cursor: onClick ? 'pointer' : 'default' }}
    >
      <div className="head-cost-label" style={{ fontSize: '9px', color: 'var(--ci-ink-3)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
        Bisherige Kosten
      </div>
      <div className="head-cost-val" style={{ fontFamily: 'var(--ci-font-serif)', fontSize: '22px', color: 'var(--ci-ink)' }}>
        {currentCostEur.toFixed(0)} €
      </div>
      {showBench ? (
        <div className="head-cost-sub" style={{ fontSize: '10px', color: 'var(--ci-ink-3)' }}>
          von ~{benchmarkEur.toFixed(0)} € Benchmark · {overText}
        </div>
      ) : (
        <div className="head-cost-sub" style={{ fontSize: '10px', color: 'var(--ci-ink-3)' }}>
          Kein Benchmark
        </div>
      )}
    </div>
  );
};
