"use client";

import { Crown } from "lucide-react";

export function TopKundenKachel() {
  return (
    <div className="bg-white rounded-2xl border border-neutral-gray-200 shadow-sm flex flex-col h-[450px]">
      <div className="p-6 pb-4 flex items-center gap-3 border-b border-neutral-gray-100">
        <Crown className="w-5 h-5 text-gold-500" />
        <h3 className="font-bold text-navy-900 text-lg">Top Kunden (nach DB)</h3>
      </div>
      <div className="flex-1 p-6 flex flex-col justify-center items-center relative">
        <div className="absolute inset-0 bg-neutral-gray-50/50 m-6 rounded-xl border-2 border-dashed border-neutral-gray-200 flex items-center justify-center">
           <span className="text-neutral-gray-400 font-medium text-sm">Bereich wird in Phase 8 angebunden</span>
        </div>
      </div>
    </div>
  );
}
