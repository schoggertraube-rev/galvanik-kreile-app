"use client";

import { Check, CheckCheck, Sun } from "lucide-react";

export function WeatherBubble() {
  const now = new Date();
  const timeString = now.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="absolute top-6 right-6 max-w-[280px] bg-white rounded-2xl rounded-tr-sm p-4 shadow-kreile-card border border-kreile-border-strong animate-in fade-in slide-in-from-top-4 duration-500 delay-300 fill-mode-both">
      <div className="flex gap-2.5 items-start mb-2">
        <div className="bg-kreile-surface-warm p-1.5 rounded-full text-kreile-accent shrink-0">
          <Sun className="w-4 h-4" />
        </div>
        <p className="text-[13px] leading-relaxed text-kreile-navy font-medium">
          Heute: 20°C und noch 4 Stunden hell – perfekte Bedingungen, um nach Feierabend noch kurz an den Main zu gehen.
        </p>
      </div>
      
      <div className="flex justify-end items-center gap-1 mt-1">
        <span className="text-[10px] text-kreile-muted font-mono">{timeString}</span>
        <CheckCheck className="w-3.5 h-3.5 text-status-green" />
      </div>
    </div>
  );
}
