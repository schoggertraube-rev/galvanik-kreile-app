"use client";
import React from "react";
import { PhoneCall, X } from "lucide-react";
import { useParkedCall } from "@/contexts/ParkedCallContext";

export function FloatingParkedCall() {
  const { activeParkedCall, resumeCall, finishCall, showResumePrompt, setShowResumePrompt } = useParkedCall();

  if (!activeParkedCall) return null;

  return (
    <>
      {/* 1. Global Floating Button (pulsating) */}
      <div 
        className="fixed bottom-24 right-6 z-50 flex items-center gap-3 cursor-pointer group"
        onClick={resumeCall}
      >
        <div className="bg-[#1A1714] text-[#EDE8DD] rounded-xl px-4 py-2 shadow-xl border border-white/10 opacity-0 translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all pointer-events-none">
          <div className="text-xs font-bold whitespace-nowrap">Offener Anruf: {activeParkedCall.matchedCustomerName || "Unbekannt"}</div>
        </div>
        <div className="w-14 h-14 bg-[#C2410C] text-white rounded-full shadow-2xl flex items-center justify-center relative">
          <PhoneCall size={24} />
          {/* Pulsating effect */}
          <div className="absolute inset-0 rounded-full border-2 border-[#C2410C] animate-ping opacity-75"></div>
        </div>
      </div>

      {/* 2. Full-Screen Inactivity Resume Prompt */}
      {showResumePrompt && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#FDFBF7] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-[#E5DFD3]">
            <div className="bg-[#1F1A14] p-4 flex justify-between items-center text-white">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#C2410C] flex items-center justify-center">
                  <PhoneCall size={16} />
                </div>
                <span className="font-bold text-sm">Aktiver Anruf</span>
              </div>
              <button onClick={() => setShowResumePrompt(false)} className="text-white/60 hover:text-white transition-colors p-1">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6">
              <h3 className="text-lg font-bold text-[#292119] mb-2">Offenen Anruf fortsetzen?</h3>
              <p className="text-sm text-[#7A7265] mb-6">
                Du hast noch einen offenen Anruf von <strong>{activeParkedCall.matchedCustomerName || "Unbekannt"}</strong>. Er wurde vorhin geparkt.
              </p>
              
              <div className="bg-[#F5F1EB] p-4 rounded-xl text-sm italic text-[#A09889] mb-6 line-clamp-2">
                "{activeParkedCall.rawText}"
              </div>
              
              <div className="flex flex-col gap-3">
                <button 
                  onClick={resumeCall}
                  className="w-full bg-[#C2410C] hover:bg-[#A3360A] text-white font-bold py-3 px-4 rounded-xl transition-colors"
                >
                  Jetzt fortsetzen
                </button>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setShowResumePrompt(false)}
                    className="flex-1 border border-[#E5DFD3] hover:bg-[#F5F1EB] text-[#292119] font-bold py-3 px-4 rounded-xl transition-colors"
                  >
                    Später
                  </button>
                  <button 
                    onClick={() => {
                      if(window.confirm("Anruf wirklich ohne Abschluss verwerfen?")) {
                        finishCall();
                      }
                    }}
                    className="flex-1 text-[#DC2626] hover:bg-red-50 font-bold py-3 px-4 rounded-xl transition-colors"
                  >
                    Verwerfen
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
