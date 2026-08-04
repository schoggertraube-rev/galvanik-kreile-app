"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

interface ZeitSliderProps {
  value: number;
  onChange: (min: number) => void;
  min?: number;
  max?: number;
  step?: number;
  vorschlagWert?: number;
}

export function ZeitSlider({
  value,
  onChange,
  min = 15,
  max = 240,
  step = 1,
  vorschlagWert
}: ZeitSliderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const calculateValueFromClientX = useCallback((clientX: number) => {
    if (!containerRef.current) return value;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percentage = x / rect.width;
    const rawValue = min + percentage * (max - min);
    return Math.round(rawValue / step) * step;
  }, [max, min, step, value]);

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    const newValue = calculateValueFromClientX(e.clientX);
    onChange(newValue);
    if (navigator.vibrate) navigator.vibrate(10);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const newValue = calculateValueFromClientX(e.clientX);
    if (newValue !== value) {
      onChange(newValue);
    }
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      const handleGlobalPointerMove = (e: PointerEvent) => {
        const newValue = calculateValueFromClientX(e.clientX);
        if (newValue !== value) {
          onChange(newValue);
        }
      };
      const handleGlobalPointerUp = () => setIsDragging(false);
      
      window.addEventListener('pointermove', handleGlobalPointerMove);
      window.addEventListener('pointerup', handleGlobalPointerUp);
      
      return () => {
        window.removeEventListener('pointermove', handleGlobalPointerMove);
        window.removeEventListener('pointerup', handleGlobalPointerUp);
      };
    }
  }, [calculateValueFromClientX, isDragging, onChange, value]);

  const percentage = Math.max(0, Math.min(((value - min) / (max - min)) * 100, 100));
  const vorschlagPercentage = vorschlagWert !== undefined 
    ? Math.max(0, Math.min(((vorschlagWert - min) / (max - min)) * 100, 100))
    : undefined;

  return (
    <div className="w-full flex flex-col items-center">
      <div className="text-3xl font-black text-navy-900 mb-6">
        {value} <span className="text-xl font-bold text-text-muted">Min</span>
      </div>

      <div 
        ref={containerRef}
        className="relative w-full h-16 flex items-center cursor-pointer touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* Track Background */}
        <div className="absolute left-0 right-0 h-3 bg-neutral-gray-200 rounded-full overflow-hidden">
          {/* Active Track */}
          <div 
            className="absolute left-0 top-0 bottom-0 bg-[#C2185B] rounded-full"
            style={{ width: `${percentage}%` }}
          />
        </div>

        {/* Vorschlag Marker */}
        {vorschlagPercentage !== undefined && (
          <div 
            className="absolute top-1/2 -translate-y-1/2 w-1.5 h-6 bg-blue-400 rounded-full shadow-sm z-0"
            style={{ left: `calc(${vorschlagPercentage}% - 3px)` }}
          />
        )}

        {/* Thumb */}
        <motion.div 
          className="absolute top-1/2 -translate-y-1/2 w-8 h-8 bg-white border-4 border-[#C2185B] rounded-full shadow-md z-10 flex items-center justify-center"
          style={{ left: `calc(${percentage}% - 16px)` }}
          animate={{ scale: isDragging ? 1.2 : 1 }}
          transition={{ duration: 0.1 }}
        >
          {/* Touch target expansion */}
          <div className="absolute inset-[-12px] bg-transparent rounded-full" />
        </motion.div>
      </div>

      <div className="w-full flex justify-between mt-2 text-sm font-bold text-text-muted">
        <span>{min} Min</span>
        <span>{max} Min</span>
      </div>
    </div>
  );
}
