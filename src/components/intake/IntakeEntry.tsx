"use client";

import { useState, useEffect } from "react";
import { WorkflowStrip } from "@/components/flow/WorkflowStrip";
import { inquiriesRepository } from "@/lib/repositories/inquiriesRepository";
import { ArrowRight, Clock, Info } from "lucide-react";
import Link from "next/link";

export function IntakeEntry({
  onSelect,
}: {
  onSelect: (mode: "camera" | "manual") => void;
}) {
  const [openQuotes, setOpenQuotes] = useState(0);

  useEffect(() => {
    const fetch = async () => {
      const count = await inquiriesRepository.getOpenCount();
      setOpenQuotes(count);
    };
    fetch();
    window.addEventListener("kreile-inquiries-updated", fetch);
    return () => window.removeEventListener("kreile-inquiries-updated", fetch);
  }, []);

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 animate-in fade-in duration-400">

      {/* Prozessleiste */}
      <WorkflowStrip />

      {/* Neue Annahme erfassen Überschrift */}
      <div className="relative mb-2">
        <h2 className="text-2xl font-black font-sans text-kreile-navy tracking-tight">Neue Annahme erfassen</h2>
        <div className="h-1 w-14 bg-kreile-accent rounded-full mt-2" />
      </div>

      {/* HAUPT KACHELN */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        {/* KAMERA — Pfirsichfarbene Kachel mit orangem Icon (wie im Bild) */}
        <button
          onClick={() => onSelect("camera")}
          className="bg-[#FFF6EA] rounded-3xl border border-[#F5EAD9] p-8 text-left flex items-center justify-between hover:shadow-md hover:border-kreile-accent/30 transition-all duration-200 active:scale-98 group cursor-pointer"
        >
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-full bg-white border border-[#F5EAD9] flex items-center justify-center shrink-0">
              <svg viewBox="0 0 24 24" fill="none" stroke="#F28A0C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            </div>
            <div>
              <p className="text-xl font-black text-kreile-navy leading-snug">Kamera</p>
              <p className="text-sm text-kreile-muted mt-0.5">Foto aufnehmen</p>
            </div>
          </div>
          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm border border-[#F5EAD9] group-hover:bg-[#F28A0C] transition-colors">
            <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4 text-[#F28A0C] group-hover:text-white transition-colors">
              <path d="M5 2l6 6-6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </button>

        {/* MANUELL — Soft Off-white Hintergrund mit gold/orangefarbenem Bleistift-Icon */}
        <button
          onClick={() => onSelect("manual")}
          className="bg-[#FEFBF7] rounded-3xl border border-kreile-border p-8 text-left flex items-center justify-between hover:shadow-md hover:border-kreile-accent/20 transition-all duration-200 active:scale-98 group cursor-pointer"
        >
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-full bg-[#FFF6EA] flex items-center justify-center shrink-0">
              <svg viewBox="0 0 24 24" fill="none" stroke="#F28A0C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8">
                <path d="M12 20h9"/>
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
              </svg>
            </div>
            <div>
              <p className="text-xl font-black text-kreile-navy leading-snug">Manuell anlegen</p>
              <p className="text-sm text-kreile-muted mt-0.5">Ohne Scan erfassen</p>
            </div>
          </div>
          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm border border-kreile-border group-hover:bg-[#F28A0C] transition-colors">
            <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4 text-[#F28A0C] group-hover:text-white transition-colors">
              <path d="M5 2l6 6-6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </button>
      </div>

      {/* ANFRAGEN KACHEL — zentriert, schmaler */}
      <div className="flex justify-center">
        <Link
          href="/quotes"
          className="flex items-center justify-between w-full md:w-[60%] bg-[#FEFBF7] rounded-3xl border border-kreile-border p-5 hover:shadow-md hover:border-kreile-accent/20 transition-all group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-kreile-bg flex items-center justify-center shrink-0">
              <svg viewBox="0 0 24 24" fill="none" stroke="#001B38" strokeWidth="2" strokeLinecap="round" className="w-6 h-6 text-kreile-navy">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-kreile-navy text-lg">Anfragen</span>
                {openQuotes > 0 && (
                  <span className="bg-status-red text-white text-xs font-black px-2.5 py-0.5 rounded-full">
                    {openQuotes}
                  </span>
                )}
              </div>
              <p className="text-sm text-kreile-muted mt-0.5">Offene Angebotsanfragen</p>
            </div>
          </div>
          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm border border-kreile-border group-hover:bg-[#F28A0C] transition-colors">
            <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4 text-[#F28A0C] group-hover:text-white transition-colors">
              <path d="M5 2l6 6-6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </Link>
      </div>

      {/* LETZTE ANNAHMEN */}
      <div className="space-y-2">
        <p className="text-sm font-bold text-kreile-navy tracking-wide">Letzte Annahmen</p>
        <Link
          href="/orders"
          className="flex items-center justify-between p-5 bg-[#FEFBF7] rounded-2xl border border-kreile-border hover:shadow-sm hover:border-kreile-accent/10 transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#FFF6EA] flex items-center justify-center shrink-0">
              <svg viewBox="0 0 24 24" fill="none" stroke="#F28A0C" strokeWidth="2" strokeLinecap="round" className="w-5 h-5">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
            </div>
            <span className="text-sm font-bold text-kreile-muted group-hover:text-kreile-navy transition-colors">Letzte Annahmen anzeigen</span>
          </div>
          <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4 text-kreile-muted group-hover:text-kreile-navy transition-colors shrink-0">
            <polyline points="6 12 10 8 6 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </Link>
      </div>

      {/* TIPP BANNER — wunderschönes pfirsichfarbenes Panel mit orangem Info-Kreis, dunklem Text und orangefarbenem Link */}
      <div className="flex items-center justify-between p-5 bg-[#FFF6EA] rounded-2xl border border-[#F5EAD9]">
        <div className="flex items-center gap-3.5">
          <div className="w-8 h-8 bg-[#F28A0C] rounded-full flex items-center justify-center shrink-0 shadow-sm">
            <span className="text-white font-extrabold text-sm font-serif">i</span>
          </div>
          <p className="text-sm font-semibold text-kreile-navy leading-relaxed">
            Tipp: Scanne Lieferschein, Zettel oder Kundenbegleitschreiben für schnellere Erfassung.
          </p>
        </div>
        <button className="text-sm font-black text-[#F28A0C] hover:text-[#001B38] shrink-0 whitespace-nowrap flex items-center gap-1 transition-colors cursor-pointer">
          <span>So funktioniert's</span>
          <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5">
            <polyline points="6 12 10 8 6 4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

    </div>
  );
}
