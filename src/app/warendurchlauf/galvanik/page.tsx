"use client";

import Link from "next/link";
import { ArrowRight, Layers, PlayCircle, CheckCircle2 } from "lucide-react";

export default function GalvanikPage() {
  return (
    <div className="w-full h-full font-sans antialiased text-[#1a1a1a]">
      <div className="w-full mx-auto px-5 md:px-8 lg:px-12 xl:px-16 py-6">
        
        {/* Titel */}
        <div className="text-[13px] font-bold text-[#5e5850] mb-3 flex items-center gap-2">
          Galvanik Bearbeitung
          <span className="flex-1 h-px bg-[#d8d0c4]" />
        </div>
        <p className="text-sm text-[#9e9689] mb-5">Bearbeitung, Bäder und laufende Werkstücke</p>

        {/* Aktionskarten */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div
            className="flex flex-col gap-2 p-5 rounded-[14px] cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md hover:bg-[#f4f0e8]"
            style={{ background: "#faf8f4", border: "1.5px solid #d8d0c4" }}
          >
            <div className="w-10 h-10 rounded-[10px] bg-[#fef3e2] flex items-center justify-center mb-2">
              <Layers className="w-5 h-5 text-[#c8922a]" />
            </div>
            <span className="text-[15px] font-bold text-[#1a1a1a]">Bereit für Galvanik</span>
            <span className="text-xs text-[#9e9689]">Ware aus Vorbereitung</span>
          </div>

          <div
            className="flex flex-col gap-2 p-5 rounded-[14px] cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md hover:bg-[#f4f0e8]"
            style={{ background: "#faf8f4", border: "1.5px solid #d8d0c4" }}
          >
            <div className="w-10 h-10 rounded-[10px] bg-[#e6f4ea] flex items-center justify-center mb-2">
              <PlayCircle className="w-5 h-5 text-[#1a6b38]" />
            </div>
            <span className="text-[15px] font-bold text-[#1a1a1a]">In Bearbeitung</span>
            <span className="text-xs text-[#9e9689]">Laufende Bäder</span>
          </div>

          <div
            className="flex flex-col gap-2 p-5 rounded-[14px] cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md hover:bg-[#f4f0e8]"
            style={{ background: "#faf8f4", border: "1.5px solid #d8d0c4" }}
          >
            <div className="w-10 h-10 rounded-[10px] bg-[#fef3e2] flex items-center justify-center mb-2">
              <CheckCircle2 className="w-5 h-5 text-[#c8922a]" />
            </div>
            <span className="text-[15px] font-bold text-[#1a1a1a]">Fertige Werkstücke</span>
            <span className="text-xs text-[#9e9689]">QS & Nacharbeit</span>
          </div>

          <Link
            href="/warendurchlauf/warenausgang"
            className="flex flex-col gap-2 p-5 rounded-[14px] cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md text-white"
            style={{ background: "#1a6b38", border: "1.5px solid #1a6b38" }}
          >
            <div className="w-10 h-10 rounded-[10px] bg-white/15 flex items-center justify-center mb-2">
              <ArrowRight className="w-5 h-5 text-white" />
            </div>
            <span className="text-[15px] font-bold">Weiter zu Warenausgang</span>
            <span className="text-xs text-white/60">Fertige Ware weiterleiten</span>
          </Link>
        </div>

      </div>
    </div>
  );
}
