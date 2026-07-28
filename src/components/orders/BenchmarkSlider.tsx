'use client';

import React, { useCallback, useRef, useState, useEffect } from 'react';
import '@/styles/ci-tokens.css'; // Assume we have CI tokens globally available

interface BenchmarkSliderProps {
  name: string;
  value: number; // 15 to 240
  onChange: (val: number) => void;
  benchmark?: number; // Median
  sampleSize?: number;
  maxBenchAllowedPercent?: number; // e.g. 40% over benchmark
}

export const BenchmarkSlider: React.FC<BenchmarkSliderProps> = ({
  name,
  value,
  onChange,
  benchmark,
  sampleSize = 0,
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const min = 15;
  const max = 240;

  const getPercent = (v: number) => Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100));

  const handleMove = useCallback((clientX: number) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const rawVal = min + pct * (max - min);
    onChange(Math.round(rawVal));
  }, [max, min, onChange]);

  useEffect(() => {
    const onMouseUp = () => setIsDragging(false);
    const onMouseMove = (e: MouseEvent) => {
      if (isDragging) handleMove(e.clientX);
    };

    if (isDragging) {
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [handleMove, isDragging]);

  const valPercent = getPercent(value);
  const benchPercent = benchmark ? getPercent(benchmark) : 0;
  
  const showBench = (sampleSize >= 3 && benchmark);
  const isOver = showBench && value > benchmark! * 1.1;
  const isDanger = showBench && value > benchmark! * 1.4;

  // Determine color gradients based on performance against benchmark
  let fillBg = 'linear-gradient(90deg, var(--ci-success-soft), var(--ci-success))'; // default: green
  if (isDanger) {
    fillBg = 'linear-gradient(90deg, var(--ci-danger-soft), var(--ci-danger))'; // red
  } else if (isOver) {
    fillBg = 'linear-gradient(90deg, var(--ci-warn-soft), var(--ci-warn))'; // orange/yellow
  }

  let overText = '';
  if (isOver && benchmark) {
    const diff = Math.round(((value / benchmark) - 1) * 100);
    overText = ` · <span style="color: var(--ci-warn); font-weight: 600;">+${diff} % drüber</span>`;
  }

  return (
    <div className="slider-row" style={{ marginBottom: '10px' }}>
      <div className="slider-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
        <span className="slider-name" style={{ fontSize: '13px', color: 'var(--ci-ink)' }}>{name}</span>
        <span className="slider-val" style={{ fontFamily: 'var(--ci-font-serif)', fontSize: '15px', color: 'var(--ci-ink)' }}>
          {value} <span className="unit" style={{ fontSize: '10px', color: 'var(--ci-ink-2)', fontFamily: 'var(--ci-font-sans)' }}>Min</span>
        </span>
      </div>
      <div 
        className="slider-track" 
        ref={trackRef}
        onMouseDown={(e) => { setIsDragging(true); handleMove(e.clientX); }}
        style={{ position: 'relative', height: '32px', background: 'var(--ci-surface)', borderRadius: '8px', border: '1px solid var(--ci-border)', overflow: 'hidden', cursor: 'pointer' }}
      >
        {showBench && (
          <div className="slider-bench" style={{ position: 'absolute', left: 0, top: 0, height: '100%', background: 'var(--ci-bench-soft)', borderRight: '2px dashed var(--ci-bench)', transition: 'width 0.2s', width: `${benchPercent}%` }}></div>
        )}
        <div className="slider-fill" style={{ position: 'absolute', left: 0, top: 0, height: '100%', borderRadius: '8px 0 0 8px', background: fillBg, opacity: 0.9, transition: 'width 0.2s', width: `${valPercent}%` }}></div>
        <div 
          className="slider-thumb" 
          style={{ position: 'absolute', top: '1px', width: '28px', height: '28px', background: 'var(--ci-surface)', border: '2px solid var(--ci-ink)', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.12)', cursor: 'grab', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 600, transition: 'left 0.1s', left: `calc(${valPercent}% - 14px)` }}
        >
          {value}
        </div>
      </div>
      <div className="slider-legend" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '3px', fontSize: '10px', color: 'var(--ci-ink-3)' }}>
        <span>15</span>
        {showBench && (
          <span className="bench-hint" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <span className="bench-dot" style={{ width: '8px', height: '8px', borderRadius: '2px', background: 'var(--ci-bench)' }}></span> 
            <a className="bench-link" title={`Median aus ${sampleSize} vergleichbaren Aufträgen`} dangerouslySetInnerHTML={{__html: `Benchmark ${benchmark} Min · n=${sampleSize}${overText}`}}></a>
          </span>
        )}
        {!showBench && <span>Kein Benchmark</span>}
        <span>240</span>
      </div>
    </div>
  );
};
