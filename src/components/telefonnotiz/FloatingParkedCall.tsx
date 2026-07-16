"use client";

import { PhoneCall, X } from "lucide-react";
import { useParkedCall } from "@/contexts/ParkedCallContext";

export function FloatingParkedCall() {
  const { activeParkedCall, resumeCall, dismissParkedHint } = useParkedCall();
  if (!activeParkedCall) return null;

  return (
    <div className="fixed bottom-6 right-6 z-100 flex items-center gap-2 rounded-xl border border-white/10 bg-[#1A1714] p-2 pl-4 text-[#EDE8DD] shadow-xl">
      <button type="button" onClick={resumeCall} className="flex items-center gap-3 text-left">
        <span className="text-xs font-bold">Geparkte Telefonnotiz fortsetzen</span>
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#C2410C] text-white">
          <PhoneCall size={19} />
        </span>
      </button>
      <button
        type="button"
        onClick={dismissParkedHint}
        className="rounded-md p-1 text-white/60 hover:bg-white/10 hover:text-white"
        aria-label="Hinweis ausblenden; Datenbankstatus bleibt geparkt"
        title="Nur Hinweis ausblenden; Datenbankstatus bleibt geparkt"
      >
        <X size={16} />
      </button>
    </div>
  );
}
