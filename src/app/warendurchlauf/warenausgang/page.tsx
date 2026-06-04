"use client";

import Link from "next/link";
import { CheckCircle2, Package, Truck, MessageSquare, CreditCard } from "lucide-react";

export default function WarenausgangPage() {
  return (
    <div className="w-full h-full font-sans antialiased text-[#1a1a1a]">
      <div className="w-full mx-auto px-5 md:px-8 lg:px-12 xl:px-16 py-6">
        
        {/* Titel */}
        <div className="text-[13px] font-bold text-[#5e5850] mb-3 flex items-center gap-2">
          Warenausgang
          <span className="flex-1 h-px bg-[#d8d0c4]" />
        </div>
        <p className="text-sm text-[#9e9689] mb-5">Fertige Aufträge, Abholung, Versand und Zahlung</p>

        {/* Aktionskarten */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <Link
            href="/orders"
            className="flex flex-col gap-2 p-5 rounded-[14px] cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md hover:bg-[#f4f0e8]"
            style={{ background: "#faf8f4", border: "1.5px solid #d8d0c4" }}
          >
            <div className="w-10 h-10 rounded-[10px] bg-[#e6f4ea] flex items-center justify-center mb-2">
              <CheckCircle2 className="w-5 h-5 text-[#1a6b38]" />
            </div>
            <span className="text-[15px] font-bold text-[#1a1a1a]">Heute fertig</span>
            <span className="text-xs text-[#9e9689]">Ware aus der Produktion</span>
          </Link>

          <Link
            href="/warendurchlauf?station=warenausgang"
            className="flex flex-col gap-2 p-5 rounded-[14px] cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md hover:bg-[#f4f0e8]"
            style={{ background: "#faf8f4", border: "1.5px solid #d8d0c4" }}
          >
            <div className="w-10 h-10 rounded-[10px] bg-[#fef3e2] flex items-center justify-center mb-2">
              <Package className="w-5 h-5 text-[#c8922a]" />
            </div>
            <span className="text-[15px] font-bold text-[#1a1a1a]">Abholbereit</span>
            <span className="text-xs text-[#9e9689]">Auf Kunden wartend</span>
          </Link>

          <Link
            href="/warendurchlauf?station=warenausgang"
            className="flex flex-col gap-2 p-5 rounded-[14px] cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md hover:bg-[#f4f0e8]"
            style={{ background: "#faf8f4", border: "1.5px solid #d8d0c4" }}
          >
            <div className="w-10 h-10 rounded-[10px] bg-[#fef3e2] flex items-center justify-center mb-2">
              <Truck className="w-5 h-5 text-[#c8922a]" />
            </div>
            <span className="text-[15px] font-bold text-[#1a1a1a]">Versand vorbereiten</span>
            <span className="text-xs text-[#9e9689]">Packen & Tracking</span>
          </Link>
          
          <Link
            href="/kommunikation"
            className="flex flex-col gap-2 p-5 rounded-[14px] cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md hover:bg-[#f4f0e8]"
            style={{ background: "#faf8f4", border: "1.5px solid #d8d0c4" }}
          >
            <div className="w-10 h-10 rounded-[10px] bg-[#fef3e2] flex items-center justify-center mb-2">
              <MessageSquare className="w-5 h-5 text-[#c8922a]" />
            </div>
            <span className="text-[15px] font-bold text-[#1a1a1a]">Kunde informieren</span>
            <span className="text-xs text-[#9e9689]">Benachrichtigung senden</span>
          </Link>

          <Link
            href="/buchhaltung/zahlung"
            className="flex flex-col gap-2 p-5 rounded-[14px] cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md hover:bg-[#f4f0e8]"
            style={{ background: "#faf8f4", border: "1.5px solid #d8d0c4" }}
          >
            <div className="w-10 h-10 rounded-[10px] bg-[#fef3e2] flex items-center justify-center mb-2">
              <CreditCard className="w-5 h-5 text-[#c8922a]" />
            </div>
            <span className="text-[15px] font-bold text-[#1a1a1a]">Zahlstatus erfassen</span>
            <span className="text-xs text-[#9e9689]">Zahlung vorbereiten & prüfen</span>
          </Link>
        </div>

      </div>
    </div>
  );
}
