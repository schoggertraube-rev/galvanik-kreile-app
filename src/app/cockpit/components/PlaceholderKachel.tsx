"use client";

import { ReactNode } from "react";

export function PlaceholderKachel({ title, icon, height = "h-[300px]" }: { title: string, icon?: ReactNode, height?: string }) {
  return (
    <div className={`bg-white rounded-2xl border border-neutral-gray-200 shadow-sm flex flex-col p-6 ${height}`}>
      <div className="flex items-center gap-3 mb-6">
        {icon}
        <h3 className="font-bold text-navy-900 text-lg">{title}</h3>
      </div>
      <div className="flex-1 border-2 border-dashed border-neutral-gray-200 rounded-xl flex items-center justify-center bg-neutral-gray-50/50">
        <span className="text-neutral-gray-400 font-medium text-sm">Bereich wird in Phase 8 angebunden</span>
      </div>
    </div>
  );
}
