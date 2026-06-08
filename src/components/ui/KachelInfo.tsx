"use client";

import { Info } from "lucide-react";
import { useState, useRef, useEffect } from "react";

interface KachelInfoProps {
  wasZeigtDieKachel: string;
  wasBedeutetDas: string;
  datenquelle: string;
}

export function KachelInfo({ wasZeigtDieKachel, wasBedeutetDas, datenquelle }: KachelInfoProps) {
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div className="relative inline-block" ref={popoverRef}>
      <button 
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        className="w-11 h-11 flex items-center justify-center -mr-3 -mt-3 text-neutral-gray-400 hover:text-navy-600 transition-colors"
        aria-label="Informationen anzeigen"
      >
        <Info className="w-5 h-5" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-xl border border-neutral-gray-200 z-50 p-4 text-left cursor-default"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-3">
            <h5 className="font-bold text-navy-900 text-xs uppercase tracking-wider mb-1">Was zeigt diese Kachel?</h5>
            <p className="text-sm text-text-muted">{wasZeigtDieKachel}</p>
          </div>
          <div className="mb-3">
            <h5 className="font-bold text-navy-900 text-xs uppercase tracking-wider mb-1">Was bedeutet das für mich?</h5>
            <p className="text-sm text-text-muted">{wasBedeutetDas}</p>
          </div>
          <div>
            <h5 className="font-bold text-navy-900 text-xs uppercase tracking-wider mb-1">Datenquelle</h5>
            <p className="text-xs text-neutral-gray-500 italic">{datenquelle}</p>
          </div>
        </div>
      )}
    </div>
  );
}
